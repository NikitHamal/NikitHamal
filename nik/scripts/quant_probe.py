"""What does a quantisation change actually cost? (Local-C, issue #9)

Parses a NIK1 .bin with numpy only (no torch) and re-quantises every block matrix
with the candidate schemes, so a quantisation change can be priced *before* training:

    int8 per-row absmax      what export.py ships today
    ternary, one global      absmean scale per matrix   (current BitLinear in model.py)
    ternary, per-row         absmean scale per output row (BitNet b1.58 reference)

Reported per matrix: relative Frobenius error and the number of dead output rows
(>=90% zero weights).  Also prints the effective bits of the weight distribution.

    python nik/scripts/quant_probe.py nik/web/model/nik-0.1.bin
    python nik/scripts/quant_probe.py nik/web/model/nik-0.1.bin --json
"""
from __future__ import annotations

import argparse
import json
import os
import struct
import sys

import numpy as np


def load_nik1(path: str):
    """-> (config, {name: (array, shape)}) with int8 tensors dequantised to f32."""
    raw = open(path, 'rb').read()
    if raw[:4] != b'NIK1':
        raise ValueError(f'not a NIK1 file: {path}')
    hl = struct.unpack('<I', raw[4:8])[0]
    head = json.loads(raw[8:8 + hl])
    base = 8 + hl + ((-(8 + hl)) % 16)
    out = {}
    for name, t in head['tensors'].items():
        n = int(np.prod(t['shape']))
        if t['dtype'] == 'i8':
            q = np.frombuffer(raw, np.int8, n, base + t['offset']).reshape(t['shape']).astype(np.float32)
            s = np.frombuffer(raw, '<f4', t['shape'][0], base + t['scale_offset'])
            out[name] = (q * s[:, None], list(t['shape']))
        else:
            out[name] = (np.frombuffer(raw, '<f4', n, base + t['offset']).reshape(t['shape']).copy(), list(t['shape']))
    return head['config'], out


def relerr(W, Q):
    return float(np.linalg.norm(Q - W) / (np.linalg.norm(W) + 1e-12))


def int8_row(W):
    amax = np.abs(W).max(axis=1, keepdims=True)
    sc = np.where(amax > 0, amax / 127.0, 1.0)
    return np.clip(np.round(W / sc), -127, 127) * sc


def tern_global(W):
    s = max(float(np.abs(W).mean()), 1e-5)
    return np.clip(np.round(W / s), -1, 1) * s


def tern_row(W):
    s = np.maximum(np.abs(W).mean(axis=1, keepdims=True), 1e-5)
    return np.clip(np.round(W / s), -1, 1) * s


def dead_rows(W, Q, thr=0.9):
    return int(((Q == 0).mean(axis=1) >= thr).sum())


def entropy_bits(W, bins=16):
    a = np.abs(W).ravel()
    a = a / (a.max() + 1e-12)
    h, _ = np.histogram(a, bins=bins, range=(0, 1))
    p = h / max(h.sum(), 1)
    p = p[p > 0]
    return float(-(p * np.log2(p)).sum())


def probe(path: str):
    cfg, tensors = load_nik1(path)
    mats = {k: v for k, v in tensors.items() if len(v[1]) == 2 and 'emb' not in k}
    rows, tot, n_tot = [], {}, 0
    for name, (W, shape) in sorted(mats.items()):
        r = {'name': name, 'shape': shape,
             'int8': relerr(W, int8_row(W)),
             'tern_global': relerr(W, tern_global(W)),
             'tern_row': relerr(W, tern_row(W)),
             'dead_global': dead_rows(W, tern_global(W)),
             'dead_row': dead_rows(W, tern_row(W)),
             'rows': shape[0],
             'entropy_bits': entropy_bits(W)}
        rows.append(r)
        n = int(np.prod(shape))
        n_tot += n
        for k in ('int8', 'tern_global', 'tern_row'):
            tot[k] = tot.get(k, 0.0) + r[k] ** 2 * n
        tot['dead_global'] = tot.get('dead_global', 0) + r['dead_global']
        tot['dead_row'] = tot.get('dead_row', 0) + r['dead_row']
        tot['rows'] = tot.get('rows', 0) + r['rows']
    summary = {k: (float(np.sqrt(v / n_tot)) if k in ('int8', 'tern_global', 'tern_row') else v)
               for k, v in tot.items()}
    emb = tensors.get('emb.weight')
    emb_row = None
    if emb is not None:
        E = emb[0]
        emb_row = {'int8': relerr(E, int8_row(E)), 'tern_global': relerr(E, tern_global(E)),
                   'tern_row': relerr(E, tern_row(E))}
    return {'file': path, 'config': cfg, 'rows': rows, 'summary': summary, 'embedding': emb_row}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file', nargs='?', default=os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), 'web', 'model', 'nik-0.1.bin'))
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--max-rows', type=int, default=12, help='how many matrices to print')
    a = ap.parse_args()
    r = probe(a.file)
    if a.json:
        print(json.dumps(r, indent=1))
        return
    c = r['config']
    print(f"file: {r['file']}")
    print(f"config: d={c['d']} layers={c['n_unique'] * c['n_repeat']} heads={c['heads']} "
          f"kv={c['kv_heads']} ffn={c['ffn']} ctx={c['ctx']} ternary={c.get('ternary')}")
    print(f"\n{'matrix':26s} {'shape':14s} {'int8':>8s} {'tern GLOBAL':>11s} {'tern ROW':>9s} "
          f'{"deadG":>6s} {"deadR":>6s} {"entBits":>7s}')
    for row in r['rows'][:a.max_rows]:
        print(f"{row['name']:26s} {str(row['shape']):14s} {row['int8'] * 100:7.2f}% {row['tern_global'] * 100:10.2f}% "
              f"{row['tern_row'] * 100:8.2f}% {row['dead_global']:6d} {row['dead_row']:6d} {row['entropy_bits']:7.2f}")
    if len(r['rows']) > a.max_rows:
        print(f"... {len(r['rows']) - a.max_rows} more matrices")
    s = r['summary']
    print(f"\nparam-weighted relative error: int8 {s['int8'] * 100:.2f}%  "
          f"ternary-global {s['tern_global'] * 100:.2f}%  ternary-row {s['tern_row'] * 100:.2f}%")
    print(f"dead output rows (>=90% zeros): ternary-global {s['dead_global']}/{s['rows']}  "
          f"ternary-row {s['dead_row']}/{s['rows']}")
    if r['embedding']:
        e = r['embedding']
        print(f"embedding: int8 {e['int8'] * 100:.2f}%  ternary-global {e['tern_global'] * 100:.2f}%  "
              f"ternary-row {e['tern_row'] * 100:.2f}%  (embeddings stay int8 in the nik-0.2t plan)")
    print(f"\nglobal-vs-per-row scale difference: {(s['tern_global'] - s['tern_row']) * 100:+.2f} pp "
          f"-> {'not a bottleneck' if abs(s['tern_global'] - s['tern_row']) < 0.02 else 'worth fixing'}")


if __name__ == '__main__':
    sys.exit(main())
