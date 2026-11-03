#!/usr/bin/env python3
"""Weight-space reconnaissance of a NIK1 model: per-tensor statistics, outliers, int8 saturation, per-head norms.

    python research/inspect_weights.py nik/web/model/nik-0.1.bin [--json research/weight_stats.json]
"""
import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nikbin import NikBin  # noqa: E402


def kurt(x):
    x = x.ravel().astype(np.float64)
    m = x.mean()
    v = x.var() + 1e-20
    return float(((x - m) ** 4).mean() / v ** 2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("bin")
    ap.add_argument("--json", default="")
    a = ap.parse_args()
    nb = NikBin(a.bin)
    print("config:", {k: v for k, v in nb.cfg.items() if not k.startswith("digit")})
    rows = []
    for name in nb.names():
        t = nb.head["tensors"][name]
        if t["dtype"] == "i8":
            q, s = nb.get(name)
            W = q.astype(np.float32) * s[:, None]
            rn = np.linalg.norm(W, axis=1)
            rows.append(dict(
                name=name, kind="i8", shape=t["shape"], absmax=float(np.abs(W).max()), std=float(W.std()),
                kurtosis=kurt(W), sat127=float((np.abs(q) == 127).mean()),
                scale_min=float(s.min()), scale_max=float(s.max()), scale_cv=float(s.std() / s.mean()),
                rownorm_max_over_med=float(rn.max() / np.median(rn)), worst_row=int(rn.argmax())))
        else:
            w = nb.get(name)
            rows.append(dict(name=name, kind="f32", shape=t["shape"], mean=float(w.mean()), std=float(w.std()),
                             min=float(w.min()), max=float(w.max())))
    print(f"\n{'tensor':26s} {'shape':>14s} {'absmax':>8s} {'std':>7s} {'kurt':>7s} {'sat127%':>8s} {'rowN max/med':>12s}")
    for r in rows:
        if r["kind"] == "i8":
            print(f"{r['name']:26s} {str(r['shape']):>14s} {r['absmax']:8.3f} {r['std']:7.4f} {r['kurtosis']:7.1f} "
                  f"{100 * r['sat127']:8.3f} {r['rownorm_max_over_med']:12.2f}")
    print("\n-- kurtosis outliers per matrix type (|z|>1.8 across the 12 blocks) --")
    for typ in ("q", "kv", "o", "up", "down"):
        ks = {r["name"]: r["kurtosis"] for r in rows if r["kind"] == "i8" and r["name"].endswith(f".{typ}.weight")}
        v = np.array(list(ks.values()))
        z = (v - v.mean()) / (v.std() + 1e-9)
        for (n, k), zz in zip(ks.items(), z):
            if abs(zz) > 1.8:
                print(f"  {n}: kurtosis {k:.1f} (z={zz:+.2f}, type mean {v.mean():.1f})")
    print("\n-- RMSNorm gains --")
    for r in rows:
        if r["kind"] == "f32" and (r["name"].endswith((".n1.weight", ".n2.weight")) or r["name"] == "norm.weight"):
            print(f"  {r['name']:22s} mean {r['mean']:.3f} std {r['std']:.3f} min {r['min']:.3f} max {r['max']:.3f}")
    print("\n-- attention o-proj Frobenius norm per head, block: [h0..h11] --")
    hd = nb.cfg["d"] // nb.cfg["heads"]
    heads = {}
    for b in range(nb.cfg["n_unique"]):
        W = nb.dequant(f"blocks.{b}.o.weight")
        heads[b] = [float(np.linalg.norm(W[:, h * hd:(h + 1) * hd])) for h in range(nb.cfg["heads"])]
        print(f"  b{b:2d}: " + " ".join(f"{x:5.2f}" for x in heads[b]))
    E = nb.dequant("emb.weight")
    en = np.linalg.norm(E, axis=1)
    print(f"\nembedding row-norm: median {np.median(en):.3f} max {en.max():.3f} (token {int(en.argmax())}); tied with the output head")
    tot = sum(int(np.prod(nb.head["tensors"][n]["shape"])) for n in nb.names())
    print(f"total stored parameters: {tot / 1e6:.2f}M; {nb.cfg['n_unique']} unique blocks x {nb.cfg['n_repeat']} repeats = "
          f"{nb.cfg['n_unique'] * nb.cfg['n_repeat']} effective layers")
    if a.json:
        json.dump(dict(rows=rows, heads=heads), open(a.json, "w"), indent=1)


if __name__ == "__main__":
    main()
