"""Merge several fine-tunes of the SAME base into one model (Claude, 2026-10-22).

Every polish arm from the live model gains somewhere and drifts somewhere else, and different arms drift in different
places. Merging their task vectors (child - base) can keep each gain while the drifts cancel. Linear averaging dilutes
each skill to 1/N (and our skills switch on non-linearly: the shape skill vanished in the 0.5 blend of p11), so the
default is TIES-merging (Yadav et al. 2023): per task vector keep the top `density` fraction of entries by magnitude,
elect a sign per entry from the summed trimmed vectors, average only the entries that agree with it, scale by `lam`.

    python nik/scripts/merge.py --base nik/web/model/nik-0.1.bin --models a.bin b.bin c.bin --out merged.bin
    python nik/scripts/merge.py --base live.bin --models a.bin b.bin --method linear --weights 0.5 0.5 --out m.bin

Configs must match (the base's config is written, so a child trained with --set-ctx does not change the output).
"""
from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import torch  # noqa: E402
from export import export, load_exported  # noqa: E402
from soup import cfg_of, _tmp_ckpt  # noqa: E402


def ties(base, children, density=0.2, lam=1.0, weights=None):
    out = {}
    for k, b in base.items():
        if not b.is_floating_point():
            out[k] = b
            continue
        b = b.float()
        taus = []
        for i, c in enumerate(children):
            t = c[k].float() - b
            if weights:
                t = t * weights[i]
            if density < 1 and t.numel() > 1:
                n = max(1, int(t.numel() * density))
                thr = t.abs().flatten().kthvalue(t.numel() - n + 1).values
                t = torch.where(t.abs() >= thr, t, torch.zeros_like(t))
            taus.append(t)
        T = torch.stack(taus)
        sign = torch.sign(T.sum(0))
        agree = (torch.sign(T) == sign) & (T != 0)
        merged = (T * agree).sum(0) / agree.sum(0).clamp(min=1)
        out[k] = b + lam * merged
    return out


def linear(base, children, weights):
    return {k: (b.float() + sum(w * (c[k].float() - b.float()) for w, c in zip(weights, children)))
            if b.is_floating_point() else b for k, b in base.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', required=True)
    ap.add_argument('--models', nargs='+', required=True)
    ap.add_argument('--method', choices=['ties', 'linear'], default='ties')
    ap.add_argument('--weights', nargs='*', type=float, default=None)
    ap.add_argument('--density', type=float, default=0.2)
    ap.add_argument('--lam', type=float, default=1.0)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    cb = cfg_of(a.base)
    for m in a.models:
        cm = {k: v for k, v in cfg_of(m).items() if k not in ('ctx', 'rope_base')}
        assert cm == {k: v for k, v in cb.items() if k not in ('ctx', 'rope_base')}, f'{m}: architecture differs from base'
    base = load_exported(a.base).state_dict()
    kids = [load_exported(m).state_dict() for m in a.models]
    if a.method == 'ties':
        sd = ties(base, kids, a.density, a.lam, a.weights)
    else:
        sd = linear(base, kids, a.weights or [1.0 / len(kids)] * len(kids))
    export(_tmp_ckpt(sd, cb), a.out)
    print(f'merged {len(kids)} models ({a.method}) -> {a.out}')


if __name__ == '__main__':
    main()
