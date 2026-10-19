"""Train NikLM with the hybrid AR + block-diffusion objective.

Stage 1, pretrain:  python nik/train.py --stage pretrain --preset nik-0.1 --data data --out nik/runs/base
Stage 2, sft:       python nik/train.py --stage sft --init nik/runs/base/ckpt.pt --data data --out nik/runs/sft

Works on CPU (smoke tests), a single CUDA GPU (Colab T4 / Kaggle P100 / T4x2: fp16 autocast), or Apple MPS.
Use --minutes to cap wall-clock time; a checkpoint is always written at the end.
"""
from __future__ import annotations
import argparse, json, math, os, sys, time

import copy

import numpy as np
import torch

sys.path.insert(0, os.path.dirname(__file__))
from model import NikLM, NikConfig, PRESETS, hybrid_loss, generate_ar, generate_ssbd  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402
from prepare import render_chat  # noqa: E402

PROMPTS = ['nepal ko rajdhani', 'ma bholi bihana', 'hamro gaun ma']
CHATS = ['timi ko hau?', 'nikit hamal ko ho?', '12 + 25 kati hunchha?', 'namaste! k chha?',
         'aaja sombar ho bhane parsi kun bar hunchha?', 'khusi kasari hune?']


def zeropower_ns(G, steps=5):
    """Newton-Schulz iteration: approximately orthogonalise G (Muon's core op)."""
    a, b, c = 3.4445, -4.7750, 2.0315
    X = G.bfloat16() if G.is_cuda and torch.cuda.is_bf16_supported() else G.float()
    X = X / (X.norm() + 1e-7)
    tr = X.size(0) > X.size(1)
    if tr:
        X = X.T
    for _ in range(steps):
        A = X @ X.T
        X = a * X + (b * A + c * A @ A) @ X
    return (X.T if tr else X).to(G.dtype)


class Muon(torch.optim.Optimizer):
    """MomentUm Orthogonalized by Newton-schulz (Jordan et al., 2024; used in the
    modded-nanoGPT speed records). For 2-D hidden weight matrices only; embeddings
    and norms stay on AdamW. Updates are orthogonalised momentum, scaled so their
    RMS matches AdamW's (Liu et al. 2025, "Muon is scalable"), so one LR schedule
    drives both optimisers."""

    def __init__(self, params, lr=0.02, momentum=0.95, wd=0.0):
        super().__init__(params, dict(lr=lr, momentum=momentum, wd=wd))

    @torch.no_grad()
    def step(self):
        for g in self.param_groups:
            for p in g['params']:
                if p.grad is None:
                    continue
                st = self.state[p]
                buf = st.setdefault('m', torch.zeros_like(p.grad))
                buf.mul_(g['momentum']).add_(p.grad)
                upd = zeropower_ns(p.grad.add(buf, alpha=g['momentum']))
                if g['wd']:
                    p.mul_(1 - g['lr'] * g['wd'])
                p.add_(upd, alpha=-g['lr'] * 0.2 * max(p.size(0), p.size(1)) ** 0.5)


class MultiOpt:
    """Drive several optimisers as one (works with GradScaler and the LR loop)."""

    def __init__(self, opts):
        self.opts = opts
        self.param_groups = [g for o in opts for g in o.param_groups]

    def step(self):
        for o in self.opts:
            o.step()

    def zero_grad(self, set_to_none=True):
        for o in self.opts:
            o.zero_grad(set_to_none=set_to_none)

    def state_dict(self):
        return [o.state_dict() for o in self.opts]

    def load_state_dict(self, sd):
        for o, d in zip(self.opts, sd):
            o.load_state_dict(d)


class Batches:
    """Random windows of length ctx+1 from token arrays (+ optional loss mask)."""

    def __init__(self, tok_path, mask_path=None, mix_path=None, mix_frac=0.0, seed=0):
        self.tok = np.memmap(tok_path, dtype=np.uint16, mode='r')
        self.mask = np.memmap(mask_path, dtype=np.uint8, mode='r') if mask_path else None
        self.mix = np.memmap(mix_path, dtype=np.uint16, mode='r') if mix_path else None
        self.mix_frac = mix_frac
        self.rng = np.random.default_rng(seed)

    def get(self, n, L, device):
        xs, ms = [], []
        for _ in range(n):
            if self.mix is not None and self.rng.random() < self.mix_frac:
                i = int(self.rng.integers(0, len(self.mix) - L - 1))
                xs.append(self.mix[i:i + L + 1]); ms.append(np.ones(L + 1, np.uint8))
                continue
            i = int(self.rng.integers(0, len(self.tok) - L - 1))
            xs.append(self.tok[i:i + L + 1])
            ms.append(self.mask[i:i + L + 1] if self.mask is not None else np.ones(L + 1, np.uint8))
        x = torch.from_numpy(np.stack(xs).astype(np.int64)).to(device)
        m = torch.from_numpy(np.stack(ms).astype(np.bool_)).to(device)
        return x, m


def lr_at(step, total, peak, warmup, floor=0.1, p_time=0.0):
    """Warmup + cosine. With a wall-clock cap the schedule follows whichever is
    further along, steps or time, so a capped run still ends fully annealed."""
    if step < warmup:
        return peak * (step + 1) / warmup
    p = min(1.0, max((step - warmup) / max(1, total - warmup), p_time))
    return peak * (floor + (1 - floor) * 0.5 * (1 + math.cos(math.pi * p)))


@torch.no_grad()
def evaluate(model, batches, L, device, n_batches=8, bs=16, amp=None):
    model.eval()
    ars, dfs = [], []
    for _ in range(n_batches):
        x, m = batches.get(bs, L, device)
        with amp():
            _, ar, df = hybrid_loss(model, x, m)
        ars.append(ar.item()); dfs.append(df.item())
    model.train()
    return float(np.mean(ars)), float(np.mean(dfs))


@torch.no_grad()
def samples(model, tok, stage):
    model.eval()
    out = []
    if stage == 'pretrain':
        for p in PROMPTS:
            ids = generate_ar(model, [1] + tok.encode(p, allow_special=False), 40, temperature=0.8, stop=(2,))
            out.append(f'  [{p}] ' + tok.decode(ids, skip_special=True))
    else:
        for q in CHATS:
            ids, _ = render_chat(tok, [{'role': 'user', 'content': q}])
            prompt = ids[:-1] + [6]                       # drop <|eos|>, open Nik's turn
            gen, passes = generate_ssbd(model, prompt, 80, temperature=0.0)
            out.append(f'  Q: {q}\n  A: {tok.decode(gen)}   [{len(gen)} tok / {passes} passes]')
    model.train()
    return '\n'.join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stage', choices=['pretrain', 'sft'], default='pretrain')
    ap.add_argument('--preset', default='nik-0.1', choices=list(PRESETS))
    ap.add_argument('--init', default=None, help='checkpoint to start from (sft)')
    ap.add_argument('--resume', action='store_true')
    ap.add_argument('--data', default='data')
    ap.add_argument('--tok', default=os.path.join(os.path.dirname(__file__), 'web/model/tokenizer.json'))
    ap.add_argument('--out', default='nik/runs/base')
    ap.add_argument('--steps', type=int, default=20000)
    ap.add_argument('--minutes', type=float, default=0, help='stop after this many minutes (0 = no limit)')
    ap.add_argument('--bs', type=int, default=32)
    ap.add_argument('--accum', type=int, default=1)
    ap.add_argument('--ctx', type=int, default=0, help='override training context')
    ap.add_argument('--lr', type=float, default=3e-3)
    ap.add_argument('--warmup', type=int, default=500)
    ap.add_argument('--wd', type=float, default=0.1)
    ap.add_argument('--diff-weight', type=float, default=1.0)
    ap.add_argument('--mix', type=float, default=0.25, help='sft: fraction of pretrain windows mixed in')
    ap.add_argument('--eval-every', type=int, default=500)
    ap.add_argument('--compile', action='store_true')
    ap.add_argument('--device', default='auto')
    ap.add_argument('--threads', type=int, default=0)
    ap.add_argument('--opt', choices=['adamw', 'muon'], default='adamw', help='muon: Muon for hidden matrices + AdamW for the rest')
    ap.add_argument('--ema', type=float, default=0.0, help='keep an EMA of weights (e.g. 0.999) and save it as the checkpoint')
    ap.add_argument('--sft-name', default='sft', help='SFT token files <name>_tok.bin / <name>_mask.bin')
    ap.add_argument('--add-abacus', type=int, default=0, help='warm-start: add abacus digit embeddings to a checkpoint without them')
    a = ap.parse_args()

    if a.threads:
        torch.set_num_threads(a.threads)
    device = a.device if a.device != 'auto' else ('cuda' if torch.cuda.is_available() else
                                                 'mps' if torch.backends.mps.is_available() else 'cpu')
    os.makedirs(a.out, exist_ok=True)
    torch.manual_seed(0)

    ck = None
    if a.resume and os.path.exists(os.path.join(a.out, 'ckpt.pt')):
        ck = torch.load(os.path.join(a.out, 'ckpt.pt'), map_location='cpu')
    elif a.init:
        ck = torch.load(a.init, map_location='cpu')
    tok = Tokenizer.load(a.tok)
    if ck:
        cfg = NikConfig(**ck['cfg'])
        if a.add_abacus and not cfg.abacus:
            cfg.abacus = a.add_abacus
            cfg.digit_sp = [tok.encode(f' {d}', allow_special=False)[0] for d in range(10)]
            cfg.digit_ns = [tok.encode(str(d), allow_special=False)[0] for d in range(10)]
    else:
        import dataclasses
        cfg = dataclasses.replace(PRESETS[a.preset])
        if cfg.abacus:
            cfg.digit_sp = [tok.encode(f' {d}', allow_special=False)[0] for d in range(10)]
            cfg.digit_ns = [tok.encode(str(d), allow_special=False)[0] for d in range(10)]
    model = NikLM(cfg).to(device)
    if ck:
        missing, unexpected = model.load_state_dict(ck['model'], strict=False)
        assert not unexpected and all(k.startswith('abacus') for k in missing), (missing, unexpected)
    L = a.ctx or cfg.ctx
    assert tok.vocab_size == cfg.vocab, (tok.vocab_size, cfg.vocab)
    print(f'NikLM {model.n_params() / 1e6:.2f}M params | {cfg.n_layers} effective layers | device {device} | ctx {L}', flush=True)

    D = a.data
    if a.stage == 'pretrain':
        train_b = Batches(os.path.join(D, 'pre_train.bin'))
        val_b = Batches(os.path.join(D, 'pre_val.bin'), seed=1)
    else:
        train_b = Batches(os.path.join(D, f'{a.sft_name}_tok.bin'), os.path.join(D, f'{a.sft_name}_mask.bin'),
                          os.path.join(D, 'pre_train.bin'), a.mix)
        val_b = Batches(os.path.join(D, f'{a.sft_name}_tok.bin'), os.path.join(D, f'{a.sft_name}_mask.bin'), seed=1)

    decay = [p for n, p in model.named_parameters() if p.dim() >= 2]
    no_decay = [p for n, p in model.named_parameters() if p.dim() < 2]
    if a.opt == 'muon':
        hidden = [p for n, p in model.named_parameters() if p.dim() == 2 and n.startswith('blocks.')]
        hid = {id(p) for p in hidden}
        decay = [p for p in decay if id(p) not in hid]
        opt = MultiOpt([Muon(hidden, lr=a.lr, wd=a.wd),
                        torch.optim.AdamW([{'params': decay, 'weight_decay': a.wd}, {'params': no_decay, 'weight_decay': 0.0}],
                                          lr=a.lr, betas=(0.9, 0.95), eps=1e-8)])
    else:
        opt = torch.optim.AdamW([{'params': decay, 'weight_decay': a.wd}, {'params': no_decay, 'weight_decay': 0.0}],
                                lr=a.lr, betas=(0.9, 0.95), eps=1e-8, fused=(device == 'cuda'))
    step = 0
    if a.resume and ck and 'opt' in ck:
        try:
            opt.load_state_dict(ck['opt']); step = ck['step']
        except (ValueError, KeyError, TypeError):
            print('optimizer state not compatible (different --opt); restarting optimizer', flush=True)
            step = ck['step']
        if 'model_raw' in ck:
            model.load_state_dict(ck['model_raw'], strict=False)
    ema = None
    if a.ema:
        ema = copy.deepcopy(model).eval()
        for p in ema.parameters():
            p.requires_grad_(False)

    use_cuda_amp = device == 'cuda'
    amp_dtype = torch.bfloat16 if use_cuda_amp and torch.cuda.is_bf16_supported() else torch.float16
    scaler = torch.amp.GradScaler('cuda', enabled=use_cuda_amp and amp_dtype == torch.float16)

    def amp():
        return torch.autocast('cuda', dtype=amp_dtype) if use_cuda_amp else torch.autocast('cpu', enabled=False)

    fwd_model = torch.compile(model) if a.compile else model
    log = open(os.path.join(a.out, 'log.jsonl'), 'a')
    t0, tok_seen = time.time(), 0

    def save(tag='ckpt'):
        d = {'model': (ema or model).state_dict(), 'cfg': cfg.to_dict(), 'opt': opt.state_dict(), 'step': step, 'stage': a.stage}
        if ema is not None:
            d['model_raw'] = model.state_dict()     # resume continues from the raw weights
        torch.save(d, os.path.join(a.out, f'{tag}.pt'))

    while step < a.steps:
        lr = lr_at(step, a.steps, a.lr, a.warmup, p_time=(time.time() - t0) / (a.minutes * 60) if a.minutes else 0.0)
        for g in opt.param_groups:
            g['lr'] = lr
        tot = ar = df = 0.0
        for _ in range(a.accum):
            x, m = train_b.get(a.bs, L, device)
            with amp():
                loss, l_ar, l_df = hybrid_loss(fwd_model, x, m, diff_weight=a.diff_weight)
            scaler.scale(loss / a.accum).backward()
            tot += loss.item() / a.accum; ar += l_ar.item() / a.accum; df += l_df.item() / a.accum
            tok_seen += x.numel()
        scaler.unscale_(opt)
        gn = torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        scaler.step(opt); scaler.update(); opt.zero_grad(set_to_none=True)
        if ema is not None:
            with torch.no_grad():
                for pe, pm in zip(ema.parameters(), model.parameters()):
                    pe.lerp_(pm, 1 - a.ema)
        step += 1
        el = time.time() - t0
        if step % 25 == 0 or step == 1:
            print(f'step {step} | loss {tot:.3f} (ar {ar:.3f} diff {df:.3f}) | lr {lr:.2e} | gn {float(gn):.2f} | '
                  f'{tok_seen / el:,.0f} tok/s | {el / 60:.1f} min', flush=True)
        if step % a.eval_every == 0 or step == a.steps:
            v_ar, v_df = evaluate(ema or model, val_b, L, device, amp=amp)
            print(f'== eval step {step}: val ar {v_ar:.3f} (ppl {math.exp(v_ar):.1f}) | val diff {v_df:.3f}', flush=True)
            print(samples(ema or model, tok, a.stage), flush=True)
            log.write(json.dumps({'step': step, 'val_ar': v_ar, 'val_diff': v_df, 'loss': tot, 'min': el / 60}) + '\n'); log.flush()
            save()
        if a.minutes and el > a.minutes * 60:
            print(f'time limit reached at step {step}', flush=True)
            break
    v_ar, v_df = evaluate(ema or model, val_b, L, device, amp=amp)
    print(f'== final step {step}: val ar {v_ar:.3f} (ppl {math.exp(v_ar):.1f}) | val diff {v_df:.3f}', flush=True)
    print(samples(ema or model, tok, a.stage), flush=True)
    save()
    print('saved', os.path.join(a.out, 'ckpt.pt'))


if __name__ == '__main__':
    main()
