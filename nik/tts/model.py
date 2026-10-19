"""NikTTS models.

Acoustic  romanized chars -> log-mel. Transformer text encoder; alignment learned
          without labels by Monotonic Alignment Search (Glow-TTS, Kim et al. 2020)
          against a per-character Gaussian prior mu; duration predictor; transformer
          decoder that refines the expanded prior (residual) into the mel.
Vocoder   log-mel -> waveform, Vocos-style (Siuzdak 2023): ConvNeXt backbone predicts
          STFT magnitude and phase, waveform = iSTFT. Every op is a frame-rate conv,
          so it is fast on CPU and in the browser (the iSTFT runs in JS).
Discrims  multi-period (HiFi-GAN) + multi-resolution STFT discriminators.
"""
from __future__ import annotations
import math
from dataclasses import dataclass, asdict

import torch
import torch.nn as nn
import torch.nn.functional as F

from audio import N_FFT, HOP, WIN, N_MELS


@dataclass
class TTSConfig:
    n_sym: int = 38
    n_spk: int = 32
    d: int = 192
    heads: int = 2
    enc_layers: int = 4
    dec_layers: int = 4
    ffn: int = 512
    kernel: int = 5
    voc_dim: int = 256
    voc_layers: int = 8
    voc_ffn: int = 768

    def to_dict(self):
        return asdict(self)


def sinusoid(T: int, d: int, device) -> torch.Tensor:
    pos = torch.arange(T, device=device).float()[:, None]
    i = torch.arange(0, d, 2, device=device).float()
    ang = pos / (10000 ** (i / d))
    pe = torch.zeros(T, d, device=device)
    pe[:, 0::2], pe[:, 1::2] = ang.sin(), ang.cos()
    return pe


class FFTBlock(nn.Module):
    """Pre-norm self-attention + FFN of (depthwise conv k -> pointwise linears).
    The depthwise conv gives local context; the linears hold the weights and
    quantise to int8 (onnxruntime-web has no ConvInteger kernel)."""

    def __init__(self, d, heads, ffn, k):
        super().__init__()
        self.n1, self.n2 = nn.LayerNorm(d), nn.LayerNorm(d)
        self.heads = heads
        self.qkv, self.proj = nn.Linear(d, 3 * d), nn.Linear(d, d)
        self.dw = nn.Conv1d(d, d, k, padding=k // 2, groups=d)
        self.p1, self.p2 = nn.Linear(d, ffn), nn.Linear(ffn, d)
        self.drop = nn.Dropout(0.1)

    def forward(self, x, pad):              # pad: (B, T) True = padding
        B, T, d = x.shape[0], x.shape[1], x.shape[2]
        q, k, v = self.qkv(self.n1(x)).chunk(3, dim=-1)
        sh = lambda t: t.reshape(B, -1, self.heads, d // self.heads).transpose(1, 2)  # noqa: E731  (shapes stay symbolic for ONNX)
        q, k, v = sh(q), sh(k), sh(v)
        att = (q @ k.transpose(-1, -2)) * (1.0 / math.sqrt(d // self.heads))
        att = att.masked_fill(pad[:, None, None, :], -1e4).softmax(-1)
        a = (att @ v).transpose(1, 2).reshape(B, -1, d)
        x = x + self.drop(self.proj(a))
        h = self.n2(x).masked_fill(pad[..., None], 0)
        h = self.dw(h.transpose(1, 2)).transpose(1, 2)
        x = x + self.drop(self.p2(F.gelu(self.p1(h))))
        return x.masked_fill(pad[..., None], 0)


@torch.no_grad()
def mas(lp: torch.Tensor, tlen: torch.Tensor, mlen: torch.Tensor) -> torch.Tensor:
    """Monotonic alignment search. lp: (B, Tt, Tm) log-likelihoods. Returns a hard
    0/1 path (B, Tt, Tm): every frame maps to exactly one char, chars in order,
    every char gets >= 1 frame."""
    B, Tt, Tm = lp.shape
    dev = lp.device
    neg = -1e9
    tm = torch.arange(Tt, device=dev)[None, :] < tlen[:, None]
    mm = torch.arange(Tm, device=dev)[None, :] < mlen[:, None]
    lp = lp.masked_fill(~(tm[:, :, None] & mm[:, None, :]), neg)
    Q = torch.full_like(lp, neg)
    Q[:, 0, 0] = lp[:, 0, 0]
    pad = torch.full((B, 1), neg, device=dev)
    for m in range(1, Tm):
        prev = Q[:, :, m - 1]
        Q[:, :, m] = lp[:, :, m] + torch.maximum(prev, torch.cat([pad, prev[:, :-1]], 1))
    path = torch.zeros_like(lp)
    t = (tlen - 1).clone()
    ar = torch.arange(B, device=dev)
    for m in range(Tm - 1, -1, -1):
        act = m < mlen
        path[ar[act], t[act], m] = 1
        if m == 0:
            break
        up = Q[ar, (t - 1).clamp(min=0), m - 1]
        stay = Q[ar, t, m - 1]
        move = act & (t > 0) & ((t == m) | (up > stay))
        t = t - move.long()
    return path


class Acoustic(nn.Module):
    def __init__(self, c: TTSConfig):
        super().__init__()
        self.c = c
        self.emb = nn.Embedding(c.n_sym, c.d)
        self.spk = nn.Embedding(c.n_spk, c.d)
        self.enc = nn.ModuleList(FFTBlock(c.d, c.heads, c.ffn, c.kernel) for _ in range(c.enc_layers))
        self.mu = nn.Linear(c.d, N_MELS)
        self.dur = nn.Sequential(nn.Conv1d(c.d, c.d, 3, padding=1), nn.ReLU(), nn.Conv1d(c.d, c.d, 3, padding=1), nn.ReLU(), nn.Conv1d(c.d, 1, 1))
        self.dec_in = nn.Linear(c.d + N_MELS, c.d)
        self.dec = nn.ModuleList(FFTBlock(c.d, c.heads, c.ffn, c.kernel) for _ in range(c.dec_layers))
        self.out = nn.Linear(c.d, N_MELS)

    def encode(self, x, spk):
        """x: (B, Tt) ids, spk: (B,) -> h (B,Tt,d), mu (B,Tt,80), log-duration (B,Tt)."""
        pad = x == 0
        h = self.emb(x) * math.sqrt(self.c.d) + sinusoid(x.shape[1], self.c.d, x.device) + self.spk(spk)[:, None]
        for b in self.enc:
            h = b(h, pad)
        logd = self.dur(h.transpose(1, 2)).squeeze(1).masked_fill(pad, 0)
        return h, self.mu(h), logd

    def decode(self, h_exp, mu_exp, spk, fpad):
        """h_exp (B,Tm,d), mu_exp (B,Tm,80) frame-rate expanded -> mel (B,Tm,80)."""
        z = self.dec_in(torch.cat([h_exp, mu_exp], -1)) + sinusoid(h_exp.shape[1], self.c.d, h_exp.device) + self.spk(spk)[:, None]
        for b in self.dec:
            z = b(z, fpad)
        return mu_exp + self.out(z)

    def loss(self, x, xlen, mel, mlen, spk):
        """mel: (B, 80, Tm). Returns total, parts dict."""
        mel = mel.transpose(1, 2)                                  # (B, Tm, 80)
        h, mu, logd = self.encode(x, spk)
        with torch.no_grad():
            lp = -0.5 * ((mel[:, None, :, :] - mu.float()[:, :, None, :]) ** 2).sum(-1)   # (B,Tt,Tm)
            path = mas(lp, xlen, mlen)
        dur = path.sum(-1)                                         # (B, Tt) frames per char
        tmask = (torch.arange(x.shape[1], device=x.device)[None] < xlen[:, None]).float()
        l_dur = (((logd - torch.log1p(dur)) ** 2) * tmask).sum() / tmask.sum()
        pt = path.transpose(1, 2)                                  # (B, Tm, Tt)
        mu_exp, h_exp = pt @ mu, pt @ h
        fmask = (torch.arange(mel.shape[1], device=x.device)[None] < mlen[:, None])
        fm = fmask[..., None].float()
        l_prior = (((mu_exp - mel) ** 2) * fm).sum() / (fm.sum() * N_MELS)
        out = self.decode(h_exp, mu_exp, spk, ~fmask)
        l_mel = ((out - mel).abs() * fm).sum() / (fm.sum() * N_MELS)
        return l_mel + l_prior + l_dur, {'mel': l_mel.item(), 'prior': l_prior.item(), 'dur': l_dur.item()}

    @torch.no_grad()
    def infer(self, x, spk, speed: float = 1.0):
        h, mu, logd = self.encode(x, spk)
        d = torch.clamp(torch.round((torch.exp(logd) - 1) / speed), min=1).long()[0]
        idx = torch.repeat_interleave(torch.arange(x.shape[1], device=x.device), d)
        h_exp, mu_exp = h[:, idx], mu[:, idx]
        fpad = torch.zeros(1, len(idx), dtype=torch.bool, device=x.device)
        return self.decode(h_exp, mu_exp, spk, fpad).transpose(1, 2)        # (1, 80, Tm)


# ------------------------------------------------------------------ vocoder
class ConvNeXt(nn.Module):
    def __init__(self, dim, ffn):
        super().__init__()
        self.dw = nn.Conv1d(dim, dim, 7, padding=3, groups=dim)
        self.norm = nn.LayerNorm(dim)
        self.p1, self.p2 = nn.Linear(dim, ffn), nn.Linear(ffn, dim)
        self.g = nn.Parameter(torch.full((dim,), 1e-2))

    def forward(self, x):                   # (B, dim, T)
        h = self.dw(x).transpose(1, 2)
        h = self.p2(F.gelu(self.p1(self.norm(h)))) * self.g
        return x + h.transpose(1, 2)


class Vocoder(nn.Module):
    def __init__(self, c: TTSConfig):
        super().__init__()
        self.inp = nn.Conv1d(N_MELS, c.voc_dim, 7, padding=3)
        self.n0 = nn.LayerNorm(c.voc_dim)
        self.blocks = nn.ModuleList(ConvNeXt(c.voc_dim, c.voc_ffn) for _ in range(c.voc_layers))
        self.n1 = nn.LayerNorm(c.voc_dim)
        self.head = nn.Linear(c.voc_dim, N_FFT + 2)

    def spec(self, mel):
        """mel (B,80,T) -> log-magnitude (B,F,T), phase cos/sin (B,F,T) each. (ONNX export target.)"""
        x = self.n0(self.inp(mel).transpose(1, 2)).transpose(1, 2)
        for b in self.blocks:
            x = b(x)
        y = self.head(self.n1(x.transpose(1, 2))).transpose(1, 2)
        logmag, p = y.chunk(2, dim=1)
        mag = torch.exp(logmag.clamp(max=7.0))
        return mag * torch.cos(p), mag * torch.sin(p)

    def forward(self, mel):
        re_, im = self.spec(mel)
        S = torch.complex(re_.float(), im.float())
        return torch.istft(S, N_FFT, HOP, WIN, window=torch.hann_window(WIN, device=mel.device), center=True)


# ------------------------------------------------------------------ discriminators
class DiscP(nn.Module):
    def __init__(self, period, ch=(32, 64, 128, 256)):
        super().__init__()
        self.p = period
        layers, c_in = [], 1
        for c in ch:
            layers.append(nn.utils.parametrizations.weight_norm(nn.Conv2d(c_in, c, (5, 1), (3, 1), padding=(2, 0))))
            c_in = c
        layers.append(nn.utils.parametrizations.weight_norm(nn.Conv2d(c_in, c_in, (5, 1), 1, padding=(2, 0))))
        self.layers = nn.ModuleList(layers)
        self.post = nn.utils.parametrizations.weight_norm(nn.Conv2d(c_in, 1, (3, 1), 1, padding=(1, 0)))

    def forward(self, x):                   # (B, T)
        B, T = x.shape
        if T % self.p:
            x = F.pad(x, (0, self.p - T % self.p), mode='reflect')
        x = x.view(B, 1, -1, self.p)
        feats = []
        for l in self.layers:
            x = F.leaky_relu(l(x), 0.1); feats.append(x)
        return self.post(x).flatten(1), feats


class DiscR(nn.Module):
    def __init__(self, n_fft, ch=32):
        super().__init__()
        self.n_fft = n_fft
        wn = nn.utils.parametrizations.weight_norm
        self.layers = nn.ModuleList([wn(nn.Conv2d(1, ch, (3, 9), padding=(1, 4))),
                                     wn(nn.Conv2d(ch, ch, (3, 9), (1, 2), padding=(1, 4))),
                                     wn(nn.Conv2d(ch, ch, (3, 9), (1, 2), padding=(1, 4))),
                                     wn(nn.Conv2d(ch, ch, (3, 3), padding=(1, 1)))])
        self.post = wn(nn.Conv2d(ch, 1, (3, 3), padding=(1, 1)))

    def forward(self, x):
        s = torch.stft(x.float(), self.n_fft, self.n_fft // 4, self.n_fft, window=torch.hann_window(self.n_fft, device=x.device),
                       return_complex=True).abs()[:, None]
        feats = []
        for l in self.layers:
            s = F.leaky_relu(l(s), 0.1); feats.append(s)
        return self.post(s).flatten(1), feats


class Discriminators(nn.Module):
    def __init__(self):
        super().__init__()
        self.ds = nn.ModuleList([DiscP(p) for p in (2, 3, 5, 7, 11)] + [DiscR(n) for n in (512, 1024, 2048)])

    def forward(self, x):
        return [d(x) for d in self.ds]
