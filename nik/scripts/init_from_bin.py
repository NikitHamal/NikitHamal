"""Turn an exported .bin into a training checkpoint (.pt) - the init for a local stage.

    python nik/scripts/init_from_bin.py nik/web/model/nik-0.1.bin /tmp/init.pt

The exported .bin is what the browser loads; train.py wants the torch state dict plus
the config, and this is the conversion (the same one the arm scripts do inline).
"""
from __future__ import annotations

import json
import os
import struct
import sys

import torch

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
from export import load_exported  # noqa: E402


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'web/model/nik-0.1.bin')
    dst = sys.argv[2] if len(sys.argv) > 2 else 'init.pt'
    raw = open(src, 'rb').read()
    hl = struct.unpack('<I', raw[4:8])[0]
    cfg = json.loads(raw[8:8 + hl])['config']
    torch.save({'model': load_exported(src).state_dict(), 'cfg': cfg}, dst)
    print(f'wrote {dst} from {src} (config: {cfg})')


if __name__ == '__main__':
    main()
