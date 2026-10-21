"""Nik-Decide: tiny NON-autoregressive decision model (Jev-style). One forward pass over
[bos] question [eos] option_1 [eos] ... option_k [eos] with full (bidirectional) attention; each option's span is
mean-pooled, combined with the pooled question, and scored; softmax over options -> typed answer + confidence."""
import torch
import torch.nn as nn
import torch.nn.functional as F


class Decider(nn.Module):
    def __init__(self, vocab=4096, d=256, layers=6, heads=8, ffn=768, ctx=384):
        super().__init__()
        self.ctx = ctx
        self.emb = nn.Embedding(vocab, d)
        self.pos = nn.Embedding(ctx, d)
        self.seg = nn.Embedding(9, d)          # 0 = question, 1..8 = option index
        layer = nn.TransformerEncoderLayer(d, heads, ffn, dropout=0.0, activation='gelu', batch_first=True, norm_first=True)
        self.enc = nn.TransformerEncoder(layer, layers, enable_nested_tensor=False)
        self.norm = nn.LayerNorm(d)
        self.qmix = nn.Linear(2 * d, d)
        self.score = nn.Sequential(nn.Linear(3 * d, d), nn.GELU(), nn.Linear(d, 1))

    def forward(self, ids, seg, pad):
        """ids/seg: (B, T) long; pad: (B, T) bool True = padding. Returns option logits (B, 8), -inf for absent options."""
        B, T = ids.shape
        x = self.emb(ids) + self.pos(torch.arange(T, device=ids.device))[None] + self.seg(seg)
        h = self.norm(self.enc(x, src_key_padding_mask=pad))
        valid = (~pad).float()
        q = ((seg == 0).float() * valid).unsqueeze(-1)
        # question vector = [bos] summary token + mean of the question (the mean alone washes out the one decisive
        # fact in yes/no; v0 sat at chance on read-yesno)
        qv = self.qmix(torch.cat([h[:, 0], (h * q).sum(1) / q.sum(1).clamp(min=1)], -1))
        out = []
        for k in range(1, 9):
            m = ((seg == k).float() * valid).unsqueeze(-1)
            ov = (h * m).sum(1) / m.sum(1).clamp(min=1)
            s = self.score(torch.cat([qv, ov, qv * ov], -1)).squeeze(-1)
            out.append(torch.where(m.sum((1, 2)) > 0, s, torch.full_like(s, float('-inf'))))
        return torch.stack(out, 1)

    def n_params(self):
        return sum(p.numel() for p in self.parameters())


def encode(tok, row, ctx=384):
    """row -> (ids, seg). The question is truncated from the left so options always fit."""
    opts = [tok.encode(' ' + o, allow_special=False)[:24] + [2] for o in row['options']]
    q = tok.encode((row.get('context', '') + ' ' + row['question']).strip(), allow_special=False)
    room = ctx - 2 - sum(len(o) for o in opts)
    q = q[-room:] if room > 0 else q[-16:]
    ids, seg = [1] + q + [2], [0] * (len(q) + 2)
    for k, o in enumerate(opts, 1):
        ids += o; seg += [k] * len(o)
    return ids[:ctx], seg[:ctx]
