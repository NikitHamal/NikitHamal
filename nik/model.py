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


class Block(nn.Module):
    def __init__(self, cfg: NikConfig):
        super().__init__()
        self.cfg = cfg
        hd = cfg.head_dim
        self.n1 = RMSNorm(cfg.d, cfg.eps)
        self.q = nn.Linear(cfg.d, cfg.heads * hd, bias=False)
        self.kv = nn.Linear(cfg.d, 2 * cfg.kv_heads * hd, bias=False)
        self.o = nn.Linear(cfg.heads * hd, cfg.d, bias=False)
        self.qn = RMSNorm(hd, cfg.eps)
        self.kn = RMSNorm(hd, cfg.eps)
        self.n2 = RMSNorm(cfg.d, cfg.eps)
        self.up = nn.Linear(cfg.d, 2 * cfg.ffn, bias=False)    # [gate ; up] fused
        self.down = nn.Linear(cfg.ffn, cfg.d, bias=False)

    def forward(self, x, cos, sin, mask):
        cfg = self.cfg
        N, T, _ = x.shape
        hd = cfg.head_dim
        h = self.n1(x)
        q = self.q(h).view(N, T, cfg.heads, hd).transpose(1, 2)
        k, v = self.kv(h).view(N, T, 2, cfg.kv_heads, hd).unbind(2)
        k, v = k.transpose(1, 2), v.transpose(1, 2)
        q, k = self.qn(q), self.kn(k)
        q, k = apply_rope(q, cos, sin), apply_rope(k, cos, sin)
        rep = cfg.heads // cfg.kv_heads
        if rep > 1:
            k = k.repeat_interleave(rep, dim=1)
            v = v.repeat_interleave(rep, dim=1)
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
        if mask is None:
            mask = torch.ones(T, T, dtype=torch.bool, device=idx.device).tril()
        cos, sin = rope_cache(self.cfg, int(pos.max()) + 1, idx.device)
        cos, sin = cos[pos].to(self.emb.weight.dtype), sin[pos].to(self.emb.weight.dtype)
        if mask.dtype == torch.bool:
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


def hybrid_loss(model: NikLM, x: torch.Tensor, loss_mask: torch.Tensor | None = None,
                diff_weight: float = 1.0, t_min: float = 0.1):
    """x: (N, L+1) token ids. loss_mask: (N, L+1) 1 where tokens count as targets
    (SFT: assistant tokens only). Returns (total, ar_loss, diff_loss)."""
    cfg = model.cfg
    N, L1 = x.shape
    L = L1 - 1
    clean, tgt = x[:, :L], x[:, 1:]
    lm = torch.ones_like(x, dtype=torch.bool) if loss_mask is None else loss_mask.bool()
    B = cfg.block
    offset = int(torch.randint(0, B, (1,)))
    blk = (torch.arange(L, device=x.device) + offset) // B
    nblk = int(blk.max()) + 1
    t = torch.rand(N, nblk, device=x.device) * (1 - t_min) + t_min      # mask rate per block
    m = torch.rand(N, L, device=x.device) < t[:, blk]
    m &= lm[:, :L]                                                    # only corrupt target tokens
    noisy = torch.where(m, torch.full_like(clean, cfg.mask_id), clean)
    inp = torch.cat([noisy, clean], dim=1)
    pos = torch.cat([torch.arange(L, device=x.device)] * 2)
    mask = two_stream_mask(L, B, offset, x.device)
    digits = None
    if cfg.abacus:   # per stream, so a run never continues across the [noisy ; clean] seam
        digits = torch.cat([model.digit_index(noisy), model.digit_index(clean)], dim=1)
    logits = model(inp, pos=pos, mask=mask, digits=digits)
    ln, lc = logits[:, :L], logits[:, L:]
    ar_w = lm[:, 1:].float()
    ar = (F.cross_entropy(lc.reshape(-1, cfg.vocab).float(), tgt.reshape(-1), reduction='none') * ar_w.reshape(-1)).sum() / ar_w.sum().clamp(min=1)
    mf = m.float()
    df = (F.cross_entropy(ln.reshape(-1, cfg.vocab).float(), clean.reshape(-1), reduction='none') * mf.reshape(-1)).sum() / mf.sum().clamp(min=1)
    return ar + diff_weight * df, ar.detach(), df.detach()


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
                stop: tuple[int, ...] = (2, 9)):
    ids = list(prompt)
    dev = next(model.parameters()).device
    for _ in range(max_new):
        ctx = torch.tensor([ids[-model.cfg.ctx:]], device=dev)
        nxt = _sample(model(ctx)[0, -1], temperature, top_p)
        ids.append(nxt)
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
