"""nik/scripts/soup.py - interpolate two exported models (a "weight soup").

Why (issue #9): every fine-tune of the live model pays a *forgetting tax* - the SFT
stage overwrites the pretrained knowledge, and the understanding probes pay for it
(19/26 -> 13..17/26 for every candidate).  Interpolating the fine-tuned weights back
towards the pretrained ones buys the understanding back without training, and the
trade-off is a curve, not a switch: 0.4 * v4c + 0.6 * v4f scored 18/26 understanding
with +4.9pp on the bench, while v4f alone scored 13/26 with +9.7pp.

    python nik/scripts/soup.py --a nik/web/model/nik-0.1.bin --b cand.bin --w 0.6 \
        --out /tmp/soup.bin

`--w` is the weight of B (the fine-tuned model): 0 = A, 1 = B.  A and B must have the
same config (same architecture) - the export format is checked.
"""
from __future__ import annotations

import argparse
import json
import os
import struct
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import torch  # noqa: E402
from export import export, load_exported  # noqa: E402


def cfg_of(path: str):
    raw = open(path, 'rb').read()
    assert raw[:4] == 'NIK1'.encode(), f'{path} is not a nik1 export'
    hl = struct.unpack('<I', raw[4:8])[0]
    return json.loads(raw[8:8 + hl])['config']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--a', required=True, help='the base model (usually the live one)')
    ap.add_argument('--b', required=True, help='the fine-tuned model')
    ap.add_argument('--w', type=float, required=True, help='weight of B (0 = A, 1 = B)')
    ap.add_argument('--out', required=True, help='the souped .bin to write')
    ap.add_argument('--pt', default=None, help='also write the float checkpoint here')
    a = ap.parse_args()
    ca, cb = cfg_of(a.a), cfg_of(a.b)
    if ca != cb:
        print('CONFIG MISMATCH - the two models are not the same architecture:')
        print('  a:', json.dumps(ca, sort_keys=True))
        print('  b:', json.dumps(cb, sort_keys=True))
        sys.exit(1)
    sa = load_exported(a.a).state_dict()
    sb = load_exported(a.b).state_dict()
    w = a.w
    sd = {k: ((1.0 - w) * sa[k].float() + w * sb[k].float()) for k in sa}
    if a.pt:
        torch.save({'model': sd, 'cfg': ca}, a.pt)
    export(a.pt or _tmp_ckpt(sd, ca), a.out)


def _tmp_ckpt(sd, cfg):
    import tempfile
    p = os.path.join(tempfile.gettempdir(), 'nik_soup_ckpt.pt')
    torch.save({'model': sd, 'cfg': cfg}, p)
    return p


if __name__ == '__main__':
    main()
