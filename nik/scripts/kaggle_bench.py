"""Throughput benchmark for NikLM on the Kaggle GPU: times one optimizer step per configuration."""
import os, subprocess, sys, time
subprocess.run('git clone -q https://github.com/NikitHamal/NikitHamal.git /kaggle/working/NikitHamal', shell=True, check=True)
sys.path.insert(0, '/kaggle/working/NikitHamal/nik')
import torch, torch.nn.functional as F
import dataclasses
from model import NikLM, PRESETS, hybrid_loss
sys.argv = ['x']
import train as T

dev = 'cuda'
print(torch.__version__, torch.cuda.get_device_name(0), flush=True)
cfg = dataclasses.replace(PRESETS['nik-0.1'])
cfg.digit_sp = list(range(400, 410)); cfg.digit_ns = list(range(64, 74))


def bench(name, bs=16, L=512, ckpt=False, opt='adamw', two_stream=True, dtype=torch.float16, steps=4):
    torch.cuda.empty_cache(); torch.cuda.reset_peak_memory_stats()
    m = NikLM(cfg).to(dev); m.grad_ckpt = ckpt
    if opt == 'muon':
        hid = [p for n, p in m.named_parameters() if p.dim() == 2 and n.startswith('blocks.')]
        ids = {id(p) for p in hid}
        o = T.MultiOpt([T.Muon(hid, lr=3e-3), torch.optim.AdamW([p for p in m.parameters() if id(p) not in ids], lr=3e-3)])
    else:
        o = torch.optim.AdamW(m.parameters(), lr=3e-3, fused=True)
    sc = torch.amp.GradScaler('cuda', enabled=dtype == torch.float16)
    x = torch.randint(16, 4096, (bs, L + 1), device=dev)
    try:
        for i in range(steps + 1):
            if i == 1:
                torch.cuda.synchronize(); t0 = time.time()
            with torch.autocast('cuda', dtype=dtype):
                if two_stream:
                    loss = hybrid_loss(m, x)[0]
                else:
                    lg = m(x[:, :-1]); loss = F.cross_entropy(lg.float().reshape(-1, cfg.vocab), x[:, 1:].reshape(-1))
            sc.scale(loss).backward(); sc.unscale_(o); sc.step(o); sc.update(); o.zero_grad(set_to_none=True)
        torch.cuda.synchronize(); dt = (time.time() - t0) / steps
        print(f'{name:42s} {dt * 1000:8.0f} ms/step  {bs * L / dt:9.0f} clean tok/s  peak {torch.cuda.max_memory_allocated() / 2**30:5.1f} GB', flush=True)
    except torch.OutOfMemoryError:
        print(f'{name:42s} OOM', flush=True)
    del m, o


# attention kernel availability with a float mask
q = torch.randn(16, 12, 1024, 32, device=dev, dtype=torch.float16)
mask = torch.zeros(1024, 1024, device=dev, dtype=torch.float16)
for be in ['EFFICIENT_ATTENTION', 'FLASH_ATTENTION', 'MATH']:
    try:
        with torch.nn.attention.sdpa_kernel(getattr(torch.nn.attention.SDPBackend, be)):
            torch.cuda.synchronize(); t0 = time.time()
            for _ in range(5):
                F.scaled_dot_product_attention(q, q, q, attn_mask=mask if be != 'FLASH_ATTENTION' else None, is_causal=be == 'FLASH_ATTENTION')
            torch.cuda.synchronize(); print(f'sdpa {be:22s} {(time.time() - t0) / 5 * 1000:.1f} ms', flush=True)
    except Exception as e:
        print(f'sdpa {be:22s} unavailable: {str(e)[:100]}', flush=True)

bench('two-stream bs16 ckpt adamw', ckpt=True)
bench('two-stream bs16 ckpt muon', ckpt=True, opt='muon')
bench('two-stream bs8 no-ckpt adamw', bs=8)
bench('two-stream bs16 no-ckpt adamw', bs=16)
bench('single-stream(AR only) bs16 adamw', two_stream=False)
bench('single-stream(AR only) bs32 adamw', bs=32, two_stream=False)
bench('two-stream bs16 ckpt fp32', ckpt=True, dtype=torch.float32, steps=2)
print('BENCH DONE', flush=True)
