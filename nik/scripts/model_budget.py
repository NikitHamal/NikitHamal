"""Browser budget calculator for NikLM presets (Local-C, issue #9).

The 25 MB cap applies to the *model file* only. What a browser tab actually pays is:

    file bytes  +  KV cache bytes  +  activation buffers

and what it *spends* per token is FLOPs (the WASM SIMD engine is compute-bound:
ARCHITECTURE.md measures 2.6 ms/token for the int8 path vs 24.0 ms/token for the
f32 path, a 9.2x gap that is a compute signal, not a bandwidth one).

This script prices any preset for any of the three shipping formats:

    int8      per-row absmax            (what export.py writes today)
    ternary   2-bit packed + f32 scales (BitNet b1.58 style, nik-0.2t)
    fp32      the latent weights        (not shippable, upper bound only)

    python nik/scripts/model_budget.py                 # all presets
    python nik/scripts/model_budget.py --preset nik-0.2t --tokens 3e8
    python nik/scripts/model_budget.py --json

No torch needed: the shapes come from the config, so this runs in milliseconds and
can be used to price a proposal before any checkpoint exists.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

# Preset shapes mirrored from nik/model.py PRESETS (kept as plain dicts so this
# script stays importable without torch).
PRESETS = {
    'nik-0.1':   dict(d=384, n_unique=12, n_repeat=2, heads=12, kv_heads=4, ffn=1024, ctx=512, abacus=20),
    'nik-0.1r3': dict(d=384, n_unique=12, n_repeat=3, heads=12, kv_heads=4, ffn=1024, ctx=512, abacus=20),
    'nik-0.1w': dict(d=384, n_unique=14, n_repeat=2, heads=12, kv_heads=4, ffn=1024, ctx=512, abacus=20),
    'nik-0.2f':  dict(d=640, n_unique=16, n_repeat=2, heads=10, kv_heads=2, ffn=1792, ctx=512, abacus=20),
    'nik-0.2t':  dict(d=640, n_unique=16, n_repeat=2, heads=10, kv_heads=2, ffn=1792, ctx=512, abacus=20),
}
VOCAB = 4096
FILE_CAP_MB = 25.0
# Chinchilla (Hoffmann et al. 2022): compute-optimal token budget ~= 20 tokens/param.
CHINCHILLA_TOKENS_PER_PARAM = 20.0
# Measured on molab RTX PRO 6000, bs 128, stage A, 20.5M params: 292 012 tok/s.
# Used only to convert a token budget into GPU-minutes; scaled by the FLOP ratio.
REF_TOK_S = 292012.0
REF_GFLOPS = 0.080


def budget(cfg: dict, fmt: str = 'auto', ctx: int | None = None) -> dict:
    """Browser + training budget for one preset.

    fmt: 'int8' | 'ternary' | 'fp32' | 'auto' (auto = ternary for a ternary preset,
    else int8).  Returns a dict of sizes in bytes and rates in tokens/param.
    """
    d, ffn = cfg['d'], cfg['ffn']
    H, KV = cfg['heads'], cfg['kv_heads']
    hd = d // H
    L = cfg['n_unique'] * cfg['n_repeat']
    C = ctx if ctx is not None else cfg['ctx']
    abacus_rows = (cfg.get('abacus') or 0) + 1 if cfg.get('abacus') else 0

    per_block = {
        'q':    H * hd * d,
        'kv':   2 * KV * hd * d,
        'o':    d * H * hd,
        'up':   2 * ffn * d,
        'down': ffn * d,
    }
    block_params = sum(per_block.values()) * cfg['n_unique']
    out_rows = (H * hd + 2 * KV * hd + d + 2 * ffn + d) * cfg['n_unique']   # one scale per output row
    emb = VOCAB * d
    norms = (d + 2 * hd + d) * cfg['n_unique'] + d
    abacus = abacus_rows * d
    total = block_params + emb + norms + abacus

    if fmt == 'auto':
        fmt = 'ternary' if cfg.get('ternary') else 'int8'
    if fmt == 'ternary':
        file_bytes = block_params * 2 / 8 + out_rows * 4 + (emb + abacus) + norms * 4
    elif fmt == 'int8':
        file_bytes = (block_params + emb + abacus) + out_rows * 4 + norms * 4
    elif fmt == 'fp32':
        file_bytes = total * 4
    else:
        raise ValueError(fmt)

    # browser KV cache: nik.js allocates Float32Array(ctx * kv_heads*head_dim) per layer, K and V
    kvw = KV * hd
    kv_f32 = L * C * kvw * 4 * 2
    kv_int8 = L * C * kvw * 1 * 2
    # f32 weights in RAM if the JS fallback dequantises (nik.js dequant())
    ram_dequant = total * 4

    # forward FLOPs per generated token: every weight of every effective layer is used once
    gflops = 2 * (block_params * cfg['n_repeat'] + emb) / 1e9

    return {
        'preset': cfg.get('name', '?'),
        'format': fmt,
        'params': total,
        'block_params': block_params,
        'emb_params': emb,
        'layers': L,
        'n_unique': cfg['n_unique'],
        'n_repeat': cfg['n_repeat'],
        'head_dim': hd,
        'file_bytes': int(file_bytes),
        'kv_f32_bytes': int(kv_f32),
        'kv_int8_bytes': int(kv_int8),
        'ram_f32_weights_bytes': int(ram_dequant),
        'gflops_per_token': gflops,
        'flops_ratio_vs_ref': gflops / REF_GFLOPS,
        'chin_tokens': CHINCHILLA_TOKENS_PER_PARAM * total,
    }


def gpu_minutes(b: dict, tokens: float) -> float:
    """GPU minutes for a token budget, at the measured 292k tok/s for the 20.5M model,
    scaled by the FLOP ratio (throughput ~ 1/FLOPs)."""
    tps = REF_TOK_S / b['flops_ratio_vs_ref']
    return tokens / tps / 60.0


def fit(preset: str, cap_mb: float = FILE_CAP_MB, fmt: str = 'auto') -> dict:
    """Largest number of *unique blocks* of `preset` that still fits the file cap.

    The 25 MB cap is a bytes cap, so a preset can be scaled until the file reaches
    it.  nik-0.2t as specified (16 unique blocks) uses only 20.79 of the 25 MB,
    i.e. it leaves budget on the table: the same shape with more blocks fits more
    parameters for free (at the cost of FLOPs per token).
    """
    base = dict(PRESETS[preset])
    base['name'] = preset
    base['ternary'] = preset.endswith('t')
    if fmt == 'auto':
        fmt = 'ternary' if base['ternary'] else 'int8'
    best = None
    for n in range(1, 64):
        c = dict(base)
        c['n_unique'] = n
        b = budget(c, fmt)
        if b['file_bytes'] <= cap_mb * 1e6:
            best = b
        else:
            break
    return best if best else budget(base, fmt)


def tokens_per_param(b: dict, tokens: float) -> float:
    return tokens / b['params']


def fmt_mb(n: float) -> str:
    return f'{n / 1e6:8.2f} MB'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preset', default='', help='one preset (default: all)')
    ap.add_argument('--fmt', default='auto', choices=['auto', 'int8', 'ternary', 'fp32'])
    ap.add_argument('--tokens', type=float, default=3e8, help='token budget for the rate columns')
    ap.add_argument('--fit', action='store_true',
                    help='largest block count of each preset that still fits the 25 MB file cap')
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()

    names = [a.preset] if a.preset else list(PRESETS)
    rows = []
    for name in names:
        cfg = dict(PRESETS[name])
        cfg['name'] = name
        cfg.setdefault('ternary', name.endswith('t'))
        b = budget(cfg, a.fmt)
        b['gpu_minutes'] = gpu_minutes(b, a.tokens)
        b['tokens_per_param'] = tokens_per_param(b, a.tokens)
        b['ram_with_kv_bytes'] = b['file_bytes'] + b['kv_f32_bytes']
        if a.fit:
            f = fit(name, FILE_CAP_MB, a.fmt)
            b['fit_n_unique'] = f['layers'] // cfg['n_repeat']
            b['fit_params'] = f['params']
            b['fit_file_bytes'] = f['file_bytes']
            b['fit_gflops'] = f['gflops_per_token']
        rows.append(b)

    if a.json:
        print(json.dumps(rows, indent=1))
        return

    print(f'token budget: {a.tokens / 1e6:.0f} M tokens   (Chinchilla-optimal = 20 tok/param)\n')
    hdr = (f'{"preset":11s} {"fmt":8s} {"params":>9s} {"file":>11s} {"KV f32":>11s} {"KV int8":>11s} '
           f'{"file+KV":>11s} {"GFLOP/tok":>9s} {"xFLOP":>6s} {"tok/param":>9s} {"GPUmin":>7s}')
    print(hdr)
    print('-' * len(hdr))
    for b in rows:
        print(f'{b["preset"]:11s} {b["format"]:8s} {b["params"] / 1e6:8.2f}M {fmt_mb(b["file_bytes"])} '
              f'{fmt_mb(b["kv_f32_bytes"])} {fmt_mb(b["kv_int8_bytes"])} {fmt_mb(b["ram_with_kv_bytes"])} '
              f'{b["gflops_per_token"]:9.3f} {b["flops_ratio_vs_ref"]:5.2f}x '
              f'{b["tokens_per_param"]:9.1f} {b["gpu_minutes"]:6.0f}m')
    print()
    for b in rows:
        flag = 'OK ' if b['file_bytes'] <= FILE_CAP_MB * 1e6 else 'OVER'
        print(f'{b["preset"]:11s} file {flag} ({b["file_bytes"] / 1e6:.2f} MB / 25 MB cap) | '
              f'Chinchilla-optimal {b["chin_tokens"] / 1e9:.3f}B tokens '
              f'({gpu_minutes(b, b["chin_tokens"]):.0f} GPU-min) | '
              f'RAM file+KV {b["ram_with_kv_bytes"] / 1e6:.1f} MB | '
              f'f32 fallback would need {b["ram_f32_weights_bytes"] / 1e6:.0f} MB')
    if a.fit:
        print('\nlargest block count that still fits 25 MB (the cap is a *bytes* cap):')
        for b in rows:
            if 'fit_params' not in b:
                continue
            n = b['fit_n_unique']
            cur = b['n_unique']
            print(f'{b["preset"]:11s} {cur:2d} -> {n:2d} unique blocks ({cur * b["n_repeat"]} -> {n * b["n_repeat"]} layers) | '
                  f'{b["params"] / 1e6:6.2f}M -> {b["fit_params"] / 1e6:6.2f}M params | '
                  f'file {b["file_bytes"] / 1e6:5.2f} -> {b["fit_file_bytes"] / 1e6:5.2f} MB | '
                  f'GFLOP/token {b["gflops_per_token"]:.3f} -> {b["fit_gflops"]:.3f} '
                  f'({b["fit_gflops"] / b["gflops_per_token"]:.2f}x)')


if __name__ == '__main__':
    sys.exit(main())
