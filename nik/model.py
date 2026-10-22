"""NikLM — a tiny hybrid autoregressive / block-diffusion transformer.

One set of weights, two ways to generate:

  * AR mode       — classic causal next-token prediction (quality anchor).
  * Diffusion mode — a block of B "<|mask|>" slots placed after the prefix is
                     denoised *in parallel* (bidirectional inside the block,
                     causal to the prefix), like BD3-LM / Fast-dLLM-v2.

At inference the two modes are fused into **Self-Speculative Block Diffusion
(SSBD)**: the diffusion head drafts B tokens in one pass and the AR head verifies
them in the next, so we keep AR quality while emitting several tokens per step.
Because draft and verifier are the *same* network, no extra draft model ships to
the browser (contrast: DFlash / Medusa / EAGLE need extra weights).

Training uses a vectorised two-stream sequence [x_noisy ; x_clean] of length 2L
with a structured attention mask, so ONE forward pass yields both the AR loss
(clean stream) and the masked-diffusion loss (noisy stream).

Tiny-model choices (MobileLLM, Liu et al. 2024; SmolLM; Gemma):
  deep-and-thin, SwiGLU, GQA, tied embeddings, RMSNorm, QK-norm, RoPE, and
  immediate block-wise weight sharing (each unique block is applied twice), which
  doubles effective depth at zero parameter cost — the file stays under 10 MB.
"""
from __future__ import annotations
import math
from dataclasses import dataclass, asdict, field

import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.utils.checkpoint


@dataclass
class NikConfig:
    vocab: int = 4096
    d: int = 288
    n_unique: int = 8          # distinct transformer blocks (parameters)
    n_repeat: int = 2          # each block applied this many times in a row
    heads: int = 9
    kv_heads: int = 3
    ffn: int = 768
    ctx: int = 512
    block: int = 8             # diffusion block size B
    rope_base: float = 10000.0
    eps: float = 1e-5
    mask_id: int = 3           # <|mask|>
    # Abacus digit embeddings (McLeish et al., 2024): every digit token gets an
    # extra learned embedding for its position inside its number (1, 2, 3, ...),
    # so column arithmetic can align place values. 0 disables.
    abacus: int = 0
    digit_sp: list = field(default_factory=list)    # " 0".." 9" token ids (start a number)
    digit_ns: list = field(default_factory=list)    # "0".."9" token ids (continue a number)
    # Ternary weights (BitNet b1.58, Ma et al. 2024): every Linear in the blocks is trained quantization-aware to
    # {-1, 0, +1} x one scale per matrix, activations to int8 per token (straight-through gradients). 1.58 bits/weight
    # (packed 2 bits) lets ~4x more parameters fit the same 25 MB budget, and the browser matmul becomes add/subtract.
    ternary: bool = False

    @property
    def head_dim(self) -> int:
        return self.d // self.heads

    @property
    def n_layers(self) -> int:
        return self.n_unique * self.n_repeat

    def to_dict(self):
        return asdict(self)


PRESETS = {
    # ~20.5M params, 24 effective layers -> ~20.6 MB int8 (25 MB cap). The flagship.
    # ~73M params with ternary block weights: 70M x 2 bits + int8 embeddings ~= 20 MB (same budget as nik-0.1, 3.5x params).
    'nik-0.2t': NikConfig(d=640, n_unique=16, n_repeat=2, heads=10, kv_heads=2, ffn=1792, ctx=512, abacus=20, ternary=True),
    # same shape at full precision (for the ablation: is ternary the loss, or the size?)
    'nik-0.2f': NikConfig(d=640, n_unique=16, n_repeat=2, heads=10, kv_heads=2, ffn=1792, ctx=512, abacus=20),
    # P4 check (issue #9): same params as nik-0.1, each block applied 3x (36 effective layers, +50% compute)
    'nik-0.1r3': NikConfig(d=384, n_unique=12, n_repeat=3, heads=12, kv_heads=4, ffn=1024, ctx=512, abacus=20),
    # Local-C (issue #9): fill the 25 MB cap with int8: 14 unique blocks -> 23.6M params, 23.8 MB, +16% FLOPs, no new kernels
    'nik-0.1w': NikConfig(d=384, n_unique=14, n_repeat=2, heads=12, kv_heads=4, ffn=1024, ctx=512, abacus=20),
    'nik-0.1': NikConfig(d=384, n_unique=12, n_repeat=2, heads=12, kv_heads=4, ffn=1024, ctx=512, abacus=20),
    # ~8.3M params -> ~8.4 MB int8 (the original <10 MB design).
    'nik-small': NikConfig(abacus=20),
    # ~4M params middle ground.
    'nik-mini': NikConfig(d=224, n_unique=6, n_repeat=2, heads=7, kv_heads=1, ffn=608, ctx=384, abacus=20),
    # ~2M params, for CPU smoke tests and fast iteration.
    'nik-nano': NikConfig(d=160, n_unique=5, n_repeat=2, heads=5, kv_heads=1, ffn=432, ctx=256, abacus=20),
}


class RMSNorm(nn.Module):
    def __init__(self, dim: int, eps: float):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))

    def forward(self, x):
        return x * torch.rsqrt(x.float().pow(2).mean(-1, keepdim=True) + self.eps).to(x.dtype) * self.weight


def rope_cache(cfg: NikConfig, n: int, device):
    hd = cfg.head_dim
    inv = 1.0 / (cfg.rope_base ** (torch.arange(0, hd, 2, device=device).float() / hd))
    t = torch.arange(n, device=device).float()
    f = torch.outer(t, inv)
    return f.cos(), f.sin()


def apply_rope(x, cos, sin):
    # x: (N, H, T, hd); cos/sin: (T, hd/2) gathered by position
    x1, x2 = x[..., 0::2], x[..., 1::2]
    o1 = x1 * cos - x2 * sin
    o2 = x1 * sin + x2 * cos
    return torch.stack((o1, o2), dim=-1).flatten(-2)


class BitLinear(nn.Linear):
    """BitNet b1.58 linear: ternary weights (absmean scale), int8 per-token activations, straight-through estimator.
    Same parameter names/shapes as nn.Linear, so checkpoints, Muon and init are unchanged."""

    def forward(self, x):
        w = self.weight
        s = w.abs().mean().clamp(min=1e-5)
        wq = (w / s).round().clamp(-1, 1) * s
        w = w + (wq - w).detach()
        a = x.abs().amax(dim=-1, keepdim=True).clamp(min=1e-5) / 127.0
        xq = (x / a).round().clamp(-128, 127) * a
        x = x + (xq - x).detach()
        return F.linear(x, w)


class Block(nn.Module):
    def __init__(self, cfg: NikConfig):
        super().__init__()
        self.cfg = cfg
        hd = cfg.head_dim
        self.n1 = RMSNorm(cfg.d, cfg.eps)
        Lin = BitLinear if cfg.ternary else nn.Linear
        self.q = Lin(cfg.d, cfg.heads * hd, bias=False)
        self.kv = Lin(cfg.d, 2 * cfg.kv_heads * hd, bias=False)
        self.o = Lin(cfg.heads * hd, cfg.d, bias=False)
        self.qn = RMSNorm(hd, cfg.eps)
        self.kn = RMSNorm(hd, cfg.eps)
        self.n2 = RMSNorm(cfg.d, cfg.eps)
        self.up = Lin(cfg.d, 2 * cfg.ffn, bias=False)    # [gate ; up] fused
        self.down = Lin(cfg.ffn, cfg.d, bias=False)

    def forward(self, x, cos, sin, mask, cache=None):
        cfg = self.cfg
        N, T, _ = x.shape
        hd = cfg.head_dim
        h = self.n1(x)
        q = self.q(h).view(N, T, cfg.heads, hd).transpose(1, 2)
        k, v = self.kv(h).view(N, T, 2, cfg.kv_heads, hd).unbind(2)
        k, v = k.transpose(1, 2), v.transpose(1, 2)
        q, k = self.qn(q), self.kn(k)
        q, k = apply_rope(q, cos, sin), apply_rope(k, cos, sin)
        if cache is not None:                     # incremental decoding: append this step's keys/values
            if 'k' in cache:
                k = torch.cat([cache['k'], k], 2); v = torch.cat([cache['v'], v], 2)
            cache['k'], cache['v'] = k, v
        rep = cfg.heads // cfg.kv_heads
        if rep > 1:
            k = k.repeat_interleave(rep, dim=1)
            v = v.repeat_interleave(rep, dim=1)
        if mask is None:
            a = F.scaled_dot_product_attention(q, k, v, is_causal=True)
        else:
            a = F.scaled_dot_product_attention(q, k, v, attn_mask=mask)
        x = x + self.o(a.transpose(1, 2).reshape(N, T, -1))
        g, u = self.up(self.n2(x)).chunk(2, dim=-1)
        return x + self.down(F.silu(g) * u)


class NikLM(nn.Module):
    def __init__(self, cfg: NikConfig):
        super().__init__()
        self.cfg = cfg
        self.emb = nn.Embedding(cfg.vocab, cfg.d)
        if cfg.abacus:
            self.abacus = nn.Embedding(cfg.abacus + 1, cfg.d, padding_idx=0)
            self.register_buffer('_dsp', torch.tensor(cfg.digit_sp or [-1], dtype=torch.long), persistent=False)
            self.register_buffer('_dns', torch.tensor(cfg.digit_ns or [-1], dtype=torch.long), persistent=False)
        self.blocks = nn.ModuleList(Block(cfg) for _ in range(cfg.n_unique))
        self.norm = RMSNorm(cfg.d, cfg.eps)
        self.grad_ckpt = False        # activation checkpointing (train.py --grad-ckpt)
        self.apply(self._init)
        if cfg.abacus:
            nn.init.normal_(self.abacus.weight, std=0.02)
            with torch.no_grad():
                self.abacus.weight[0].zero_()
        for b in self.blocks:   # scaled residual init (GPT-2 / MobileLLM)
            nn.init.normal_(b.o.weight, std=0.02 / math.sqrt(2 * cfg.n_layers))
            nn.init.normal_(b.down.weight, std=0.02 / math.sqrt(2 * cfg.n_layers))

    @staticmethod
    def _init(m):
        if isinstance(m, (nn.Linear, nn.Embedding)):
            nn.init.normal_(m.weight, std=0.02)

    def n_params(self) -> int:
        return sum(p.numel() for p in self.parameters())

    def digit_index(self, idx):
        """Position of each digit inside its number: 1, 2, 3, ... (0 = not a digit).
        A space-prefixed digit (" 4") starts a number; a bare digit continues one.
        Causal: depends only on the current and earlier tokens."""
        sp = torch.isin(idx, self._dsp)
        ns = torch.isin(idx, self._dns)
        dig = sp | ns
        prev = torch.zeros_like(dig)
        prev[:, 1:] = dig[:, :-1]
        start = dig & (sp | ~prev)
        t = torch.arange(idx.shape[1], device=idx.device).expand_as(idx)
        last = torch.where(start, t, torch.full_like(t, -1)).cummax(dim=1).values
        k = torch.where(dig & (last >= 0), t - last + 1, torch.zeros_like(t))
        return k.clamp(max=self.cfg.abacus)

    def forward(self, idx, pos=None, mask=None, digits=None):
        """idx: (N, T). pos: (T,) positions (default arange). mask: (T, T) bool, True = may attend.
        digits: optional precomputed abacus indices (N, T)."""
        N, T = idx.shape
        if pos is None:
            pos = torch.arange(T, device=idx.device)
        causal = mask is None                   # plain causal: SDPA is_causal (flash kernel, no T x T mask in memory)
        cos, sin = rope_cache(self.cfg, int(pos.max()) + 1, idx.device)
        cos, sin = cos[pos].to(self.emb.weight.dtype), sin[pos].to(self.emb.weight.dtype)
        if pos.dim() == 2:                      # per-row positions (N, T) for left-padded batches: broadcast over heads
            cos, sin = cos.unsqueeze(1), sin.unsqueeze(1)
        if not causal and mask.dim() == 3:      # per-row masks (N, T, T)
            mask = mask.unsqueeze(1)
        if not causal and mask.dtype == torch.bool:
            # additive float mask in the activation dtype lets SDPA pick the
            # memory-efficient kernel instead of materialising T x T scores per layer
            dt = self.emb.weight.dtype
            if idx.is_cuda and torch.is_autocast_enabled():
                dt = torch.get_autocast_dtype('cuda') if hasattr(torch, 'get_autocast_dtype') else torch.get_autocast_gpu_dtype()
            mask = torch.zeros(mask.shape, dtype=dt, device=idx.device).masked_fill(~mask, float('-inf'))
        x = self.emb(idx)
        if self.cfg.abacus:
            x = x + self.abacus(self.digit_index(idx) if digits is None else digits)
        for b in self.blocks:
            for _ in range(self.cfg.n_repeat):
                if self.grad_ckpt and self.training:
                    x = torch.utils.checkpoint.checkpoint(b, x, cos, sin, mask, use_reentrant=False)
                else:
                    x = b(x, cos, sin, mask)
        return F.linear(self.norm(x), self.emb.weight)


# --------------------------------------------------------------------------
# Hybrid AR + block-diffusion objective
# --------------------------------------------------------------------------

@torch.no_grad()
def forward_cached(model, idx, pos, mask, caches, digits=None):
    """One incremental step for generate_multi: idx (N, t) new tokens, pos (N, t) their positions, mask (N, t, Tk) bool
    over all keys so far (cached + new); caches: list with one dict per effective layer (filled in place)."""
    cfg = model.cfg
    cos, sin = rope_cache(cfg, int(pos.max()) + 1, idx.device)
    cos, sin = cos[pos].to(model.emb.weight.dtype).unsqueeze(1), sin[pos].to(model.emb.weight.dtype).unsqueeze(1)
    dt = model.emb.weight.dtype
    m = torch.zeros(mask.shape, dtype=dt, device=idx.device).masked_fill(~mask, float('-inf')).unsqueeze(1)
    x = model.emb(idx)
    if cfg.abacus and digits is not None:
        x = x + model.abacus(digits)
    li = 0
    for b in model.blocks:
        for _ in range(cfg.n_repeat):
            x = b(x, cos, sin, m, cache=caches[li]); li += 1
    return F.linear(model.norm(x), model.emb.weight)


def two_stream_mask(L: int, B: int, offset: int, device) -> torch.Tensor:
    """(2L, 2L) bool mask for the sequence [noisy(0..L-1) ; clean(0..L-1)].

    noisy i -> noisy j  iff same block            (bidirectional denoising)
    noisy i -> clean j  iff block(j) < block(i)   (sees the clean prefix only)
    clean i -> clean j  iff j <= i                (plain causal LM)
    clean i -> noisy j  never
    Blocks start at a random phase `offset` so that, at inference, a draft block
    may begin at any position.
    """
    i = torch.arange(L, device=device)
    blk = (i + offset) // B
    same = blk[:, None] == blk[None, :]
    before = blk[None, :] < blk[:, None]
    causal = i[None, :] <= i[:, None]
    top = torch.cat([same, before], dim=1)
    bot = torch.cat([torch.zeros(L, L, dtype=torch.bool, device=device), causal], dim=1)
    return torch.cat([top, bot], dim=0)


def two_stream_mask_seg(L: int, B: int, offset: int, s: int, Ln: int, device) -> torch.Tensor:
    """Like two_stream_mask, but the noisy stream covers only positions s..s+Ln-1.
    Shape (Ln + L, Ln + L) for the sequence [noisy segment ; clean]."""
    i = torch.arange(L, device=device)
    blk = (i + offset) // B
    pn = torch.arange(s, s + Ln, device=device)
    bn = (pn + offset) // B
    same = bn[:, None] == bn[None, :]
    before = blk[None, :] < bn[:, None]
    causal = i[None, :] <= i[:, None]
    top = torch.cat([same, before], dim=1)
    bot = torch.cat([torch.zeros(L, Ln, dtype=torch.bool, device=device), causal], dim=1)
    return torch.cat([top, bot], dim=0)


def _kl_to_ref(ref, clean, logits, w, kl):
    """Self-distillation anchor (Claude, 2026-10-22): KL(ref || student) on the target positions, ref = the frozen
    live model. With kl <= 1 the gold token still wins the argmax wherever CE supervises it (optimal p(y) >=
    (1 + kl * p_ref(y)) / (1 + kl)), while every unsupervised direction stays near the reference: new skills without drift."""
    with torch.no_grad():
        lr = F.log_softmax(ref(clean).float(), -1)
    lp = F.log_softmax(logits.float(), -1)
    v = (lr.exp() * (lr - lp)).sum(-1)
    t = (v * w).sum() / w.sum().clamp(min=1)
    hybrid_loss.last_kl = t.detach()
    return kl * t


def hybrid_loss(model, x: torch.Tensor, loss_mask: torch.Tensor | None = None,
                diff_weight: float = 1.0, t_min: float = 0.1, diff_frac: float = 1.0, user_w=0.0, ref=None, kl=0.0,
                kl_all=False):
    """x: (N, L+1) token ids. loss_mask: (N, L+1) 1 where tokens count as targets
    (SFT: assistant tokens only). diff_frac < 1 trains the diffusion stream on a
    random window of that fraction of the sequence (the AR stream always sees all
    of it): attention cost drops from (2L)^2 to ((1+f)L)^2. Works with a DDP wrapper.
    Returns (total, ar_loss, diff_loss)."""
    core = getattr(model, 'module', model)
    cfg = core.cfg
    N, L1 = x.shape
    L = L1 - 1
    clean, tgt = x[:, :L], x[:, 1:]
    lm = torch.ones_like(x, dtype=torch.bool) if loss_mask is None else loss_mask.bool()
    if diff_weight <= 0:   # pure autoregressive: no diffusion stream, all compute on next-token prediction
        lm = torch.ones_like(x, dtype=torch.bool) if loss_mask is None else loss_mask.bool()
        logits = model(clean)
        ar_w = lm[:, 1:].float()
        if user_w > 0:     # also learn the user's side a little: models the *questions*, not just the answers
            ar_w = ar_w + user_w * (~lm[:, 1:]).float()
        ar = (F.cross_entropy(logits.reshape(-1, cfg.vocab).float(), tgt.reshape(-1), reduction='none') * ar_w.reshape(-1)).sum() / ar_w.sum().clamp(min=1)
        kw = torch.ones_like(lm[:, 1:], dtype=torch.float) if kl_all else lm[:, 1:].float()
        total = ar + (_kl_to_ref(ref, clean, logits, kw, kl) if ref is not None and kl > 0 else 0)
        return total, ar.detach(), torch.zeros((), device=x.device)
    B = cfg.block
    offset = int(torch.randint(0, B, (1,)))
    Ln = L if diff_frac >= 1 else max(B, int(round(L * diff_frac / B)) * B)
    s = 0 if Ln >= L else int(torch.randint(0, L - Ln + 1, (1,)))
    seg = clean[:, s:s + Ln]
    pn = torch.arange(s, s + Ln, device=x.device)
    bn = (pn + offset) // B
    bn = bn - bn.min()
    t = torch.rand(N, int(bn.max()) + 1, device=x.device) * (1 - t_min) + t_min      # mask rate per block
    m = torch.rand(N, Ln, device=x.device) < t[:, bn]
    m &= lm[:, s:s + Ln]                                                              # only corrupt target tokens
    noisy = torch.where(m, torch.full_like(seg, cfg.mask_id), seg)
    inp = torch.cat([noisy, clean], dim=1)
    pos = torch.cat([pn, torch.arange(L, device=x.device)])
    mask = two_stream_mask_seg(L, B, offset, s, Ln, x.device)
    digits = None
    if cfg.abacus:   # per stream, so a run never continues across the [noisy ; clean] seam
        digits = torch.cat([core.digit_index(noisy), core.digit_index(clean)], dim=1)
    logits = model(inp, pos=pos, mask=mask, digits=digits)
    ln, lc = logits[:, :Ln], logits[:, Ln:]
    ar_w = lm[:, 1:].float()
    ar = (F.cross_entropy(lc.reshape(-1, cfg.vocab).float(), tgt.reshape(-1), reduction='none') * ar_w.reshape(-1)).sum() / ar_w.sum().clamp(min=1)
    mf = m.float()
    df = (F.cross_entropy(ln.reshape(-1, cfg.vocab).float(), seg.reshape(-1), reduction='none') * mf.reshape(-1)).sum() / mf.sum().clamp(min=1)
    total = ar + diff_weight * df
    if ref is not None and kl > 0:
        total = total + _kl_to_ref(ref, clean, lc, torch.ones_like(ar_w) if kl_all else ar_w, kl)
    return total, ar.detach(), df.detach()


hybrid_loss.last_kl = torch.zeros(())


# --------------------------------------------------------------------------
# Reference decoding (Python). The browser engine in web/nik.js mirrors this.
# --------------------------------------------------------------------------

def _sample(logits, temperature: float, top_p: float, generator=None):
    if temperature <= 0:
        return int(logits.argmax())
    p = torch.softmax(logits.float() / temperature, -1)
    sp, si = p.sort(descending=True)
    keep = sp.cumsum(-1) - sp < top_p
    sp = sp * keep
    return int(si[torch.multinomial(sp / sp.sum(), 1, generator=generator)])


@torch.no_grad()
def generate_ar(model, prompt: list[int], max_new: int = 128, temperature: float = 0.7, top_p: float = 0.9,
                stop: tuple[int, ...] = (2, 9), calc=None):
    """calc: optional calc.Calc -> verified arithmetic: completed equations in the generated text are checked and a
    wrong result is replaced by the exact value (the model then continues from the corrected text)."""
    ids = list(prompt)
    dev = next(model.parameters()).device
    upto = 0
    steps = 0
    # a calc rewrite does not lengthen the text, so the length test alone can spin forever when a rewrite keeps
    # reappearing (k13b's bench_rw ran 30+ min at 100% CPU on 2026-10-22): also cap the number of model steps
    while len(ids) - len(prompt) < max_new and steps < 3 * max_new:
        steps += 1
        ctx = torch.tensor([ids[-model.cfg.ctx:]], device=dev)
        nxt = _sample(model(ctx)[0, -1], temperature, top_p)
        ids.append(nxt)
        if calc is not None:
            new, upto = calc.check(ids[len(prompt):], upto)
            if new is not None:
                ids = ids[:len(prompt)] + new
                if new and new[-1] in stop:
                    break
                continue
        if nxt in stop:
            break
    return ids[len(prompt):]


@torch.no_grad()
def generate_ssbd(model, prompt: list[int], max_new: int = 128, temperature: float = 0.0, top_p: float = 0.9,
                  stop: tuple[int, ...] = (2, 9)):
    """Self-Speculative Block Diffusion (mirrors web/nik.js `generate`).

    t0 is sampled from the AR head. The block [t0, M, ..., M] is denoised in
    parallel by the diffusion stream to draft d1..d_{B-1}. One causal pass then
    verifies: walking left to right, the AR head samples s_j and the draft token is
    kept while s_j == d_j; the first mismatch is emitted and becomes the next t0.
    Every emitted token is an AR sample, so outputs are AR-distributed (greedy
    output is identical to greedy AR). Returns (tokens, n_forward_passes)."""
    cfg = model.cfg
    B, M = cfg.block, cfg.mask_id
    ids, passes = list(prompt), 1
    dev = next(model.parameters()).device
    ctx = ids[-(cfg.ctx - 2 * B):]
    t0 = _sample(model(torch.tensor([ctx], device=dev))[0, -1], temperature, top_p)
    out = []
    while True:
        out.append(t0)
        if t0 in stop or len(out) >= max_new:
            break
        ctx = (ids + out[:-1])[-(cfg.ctx - 2 * B):]
        n = len(ctx)
        blk = [t0] + [M] * (B - 1)
        T = n + B
        mask = torch.ones(T, T, dtype=torch.bool, device=dev).tril()
        mask[n:, n:] = True
        dl = model(torch.tensor([ctx + blk], device=dev), mask=mask)[0, n:]
        passes += 1
        dl[:, [0, 1, M, 4, 5, 6]] = -float('inf')
        draft = [t0] + dl[1:].argmax(-1).tolist()
        vl = model(torch.tensor([ctx + draft], device=dev))[0, n:]
        passes += 1
        nxt = None
        for j in range(B):
            s_ = _sample(vl[j], temperature, top_p)
            if j + 1 < B and s_ == draft[j + 1]:
                out.append(s_)
                if s_ in stop or len(out) >= max_new:
                    return out, passes
                continue
            nxt = s_
            break
        t0 = nxt
    return out, passes


@torch.no_grad()
def generate_multi(model, prompts: list, n_per_prompt: int = 8, max_new: int = 160, temperature: float = 0.8,
                   min_p: float = 0.05, stop: tuple = (2, 9)):
    """Sample n_per_prompt continuations for EVERY prompt in one left-padded batch (GRPO throughput).
    Per-row positions start at 0 after the padding, and pads are never attended, so each row computes exactly what
    generate_ar would on its own prompt (greedy-identical; tested). Returns, per prompt, [(tokens, mean_logprob)]."""
    dev = next(model.parameters()).device
    rows = [p for p in prompts for _ in range(n_per_prompt)]
    N, L0 = len(rows), max(len(p) for p in rows)
    pad = torch.tensor([L0 - len(p) for p in rows], device=dev)
    x = torch.zeros(N, L0, dtype=torch.long, device=dev)
    for i, p in enumerate(rows):
        x[i, L0 - len(p):] = torch.tensor(p, device=dev)
    done = torch.zeros(N, dtype=torch.bool, device=dev)
    lp_sum = torch.zeros(N, device=dev); lens = torch.zeros(N, device=dev)
    out = [[] for _ in range(N)]
    stop_t = torch.tensor(stop, device=dev)
    cfg = model.cfg
    caches = [dict() for _ in range(cfg.n_layers)]
    ar = torch.arange(L0, device=dev)
    pos = (ar[None] - pad[:, None]).clamp(min=0)
    real = ar[None] >= pad[:, None]
    mask = (torch.ones(L0, L0, dtype=torch.bool, device=dev).tril()[None] & real[:, None, :]) | torch.eye(L0, dtype=torch.bool, device=dev)[None]
    digits = model.digit_index(x) if cfg.abacus else None
    logits = forward_cached(model, x, pos, mask, caches, digits)[:, -1].float()      # prefill once
    for step in range(max_new):
        logits[:, [0, 1, 3, 4, 5]] = -float('inf')
        if temperature <= 0:
            nxt = logits.argmax(-1)
        else:
            p_ = torch.softmax(logits / temperature, -1)
            p_ = torch.where(p_ >= min_p * p_.max(-1, keepdim=True).values, p_, torch.zeros_like(p_))
            nxt = torch.multinomial(p_ / p_.sum(-1, keepdim=True), 1).squeeze(1)
        lp = torch.log_softmax(logits, -1).gather(1, nxt[:, None]).squeeze(1)
        live = ~done
        lp_sum += lp * live; lens += live.float()
        for i in torch.nonzero(live).flatten().tolist():
            out[i].append(int(nxt[i]))
        done |= torch.isin(nxt, stop_t)
        x = torch.cat([x, nxt[:, None]], 1)
        if bool(done.all()) or x.shape[1] >= cfg.ctx or step == max_new - 1:
            break
        T = x.shape[1]
        real = torch.cat([real, torch.ones(N, 1, dtype=torch.bool, device=dev)], 1)
        pos_new = (T - 1 - pad)[:, None]
        d_new = model.digit_index(x)[:, -1:] if cfg.abacus else None              # digit position needs the context
        logits = forward_cached(model, nxt[:, None], pos_new, real[:, None, :], caches, d_new)[:, -1].float()
    res = [(o, float(s / max(1.0, float(l)))) for o, s, l in zip(out, lp_sum, lens)]
    return [res[i * n_per_prompt:(i + 1) * n_per_prompt] for i in range(len(prompts))]


@torch.no_grad()
def generate_batch(model, prompt: list[int], n: int = 8, max_new: int = 160, temperature: float = 0.8,
                   min_p: float = 0.05, stop: tuple[int, ...] = (2, 9)):
    """Sample n continuations of one prompt in parallel (used for self-improvement
    and self-consistency). min-p sampling: keep tokens with p >= min_p * p_max,
    which stays coherent at higher temperatures better than top-p for small models.
    Returns [(tokens, mean_logprob)]."""
    dev = next(model.parameters()).device
    x = torch.tensor([prompt] * n, device=dev)
    done = torch.zeros(n, dtype=torch.bool, device=dev)
    lp_sum = torch.zeros(n, device=dev)
    lens = torch.zeros(n, device=dev)
    out = [[] for _ in range(n)]
    stop_t = torch.tensor(stop, device=dev)
    for _ in range(max_new):
        ctx = x[:, -model.cfg.ctx:]
        logits = model(ctx)[:, -1].float()
        logits[:, [0, 1, 3, 4, 5]] = -float('inf')
        p = torch.softmax(logits / max(temperature, 1e-4), -1)
        p = torch.where(p >= min_p * p.max(-1, keepdim=True).values, p, torch.zeros_like(p))
        nxt = torch.multinomial(p / p.sum(-1, keepdim=True), 1).squeeze(1)
        lp = torch.log_softmax(logits, -1).gather(1, nxt[:, None]).squeeze(1)
        live = ~done
        lp_sum += lp * live
        lens += live.float()
        for i in torch.nonzero(live).flatten().tolist():
            out[i].append(int(nxt[i]))
        done |= torch.isin(nxt, stop_t)
        x = torch.cat([x, nxt[:, None]], 1)
        if bool(done.all()):
            break
    return [(o, float(lp_sum[i] / lens[i].clamp(min=1))) for i, o in enumerate(out)]
