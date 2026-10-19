"""Export a NikLM checkpoint to the compact browser format (nik-*.bin).

Layout (little-endian):
    b"NIK1" | u32 header_len | header JSON (utf-8) | zero pad to 16 B | tensor data
Header: {"config": {...}, "tensors": {name: {"dtype": "i8"|"f32", "shape": [...],
         "offset": int, "scale_offset": int}}}
Matrices are int8 with one f32 scale per output row (symmetric, absmax/127);
norm weights stay f32. The tied embedding doubles as the output head.

    python nik/export.py --ckpt nik/runs/sft/ckpt.pt --out nik/web/model/nik-0.1.bin
"""
from __future__ import annotations
import argparse, json, os, struct, sys

import numpy as np
import torch

sys.path.insert(0, os.path.dirname(__file__))
from model import NikConfig, NikLM  # noqa: E402


def quantize_rows(w: np.ndarray):
    amax = np.abs(w).max(axis=1, keepdims=True)
    scale = np.where(amax > 0, amax / 127.0, 1.0).astype(np.float32)
    q = np.clip(np.round(w / scale), -127, 127).astype(np.int8)
    return q, scale.reshape(-1)


def export(ckpt_path: str, out: str):
    ck = torch.load(ckpt_path, map_location='cpu')
    cfg = NikConfig(**ck['cfg'])
    sd = {k: v.float().numpy() for k, v in ck['model'].items()}
    blobs, table, off = [], {}, 0

    def put(arr: bytes):
        nonlocal off
        pad = (-off) % 16
        if pad:
            blobs.append(b'\0' * pad); off += pad
        o = off
        blobs.append(arr); off += len(arr)
        return o

    err = []
    for name, w in sd.items():
        if w.ndim == 2:
            q, s = quantize_rows(w)
            err.append(float(np.abs(q * s[:, None] - w).mean() / (np.abs(w).mean() + 1e-12)))
            table[name] = {'dtype': 'i8', 'shape': list(w.shape), 'offset': put(q.tobytes()),
                           'scale_offset': put(s.astype('<f4').tobytes())}
        else:
            table[name] = {'dtype': 'f32', 'shape': list(w.shape), 'offset': put(w.astype('<f4').tobytes())}
    header = json.dumps({'format': 'nik1', 'config': cfg.to_dict(), 'tensors': table}).encode()
    pre = b'NIK1' + struct.pack('<I', len(header)) + header
    pre += b'\0' * ((-len(pre)) % 16)
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    with open(out, 'wb') as f:
        f.write(pre)
        for b in blobs:
            f.write(b)
    size = os.path.getsize(out)
    print(f'wrote {out}: {size / 1e6:.2f} MB, {sum(v.size for v in sd.values()) / 1e6:.2f}M params, '
          f'mean rel. quant error {np.mean(err) * 100:.2f}%')
    return out


def load_exported(path: str) -> NikLM:
    """Load a .bin back into PyTorch (dequantized) to check export fidelity."""
    raw = open(path, 'rb').read()
    assert raw[:4] == b'NIK1'
    hl = struct.unpack('<I', raw[4:8])[0]
    head = json.loads(raw[8:8 + hl])
    base = 8 + hl + ((-(8 + hl)) % 16)
    model = NikLM(NikConfig(**head['config']))
    sd = {}
    for name, t in head['tensors'].items():
        n = int(np.prod(t['shape']))
        if t['dtype'] == 'i8':
            q = np.frombuffer(raw, np.int8, n, base + t['offset']).reshape(t['shape']).astype(np.float32)
            s = np.frombuffer(raw, '<f4', t['shape'][0], base + t['scale_offset'])
            sd[name] = torch.from_numpy(q * s[:, None])
        else:
            sd[name] = torch.from_numpy(np.frombuffer(raw, '<f4', n, base + t['offset']).reshape(t['shape']).copy())
    model.load_state_dict(sd)
    return model.eval()


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--ckpt', required=True)
    ap.add_argument('--out', default='nik/web/model/nik-0.1.bin')
    a = ap.parse_args()
    export(a.ckpt, a.out)
