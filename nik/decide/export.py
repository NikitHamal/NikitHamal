"""Export Nik-Decide to a browser file: 'NDC1' + u32 header length + JSON header + fp16 tensors (row-major, in header order).
    python nik/decide/export.py --ckpt nik/decide/checkpoints/decide-v3-fp16.pt --out nik/web/decide/decide-v3.bin"""
import argparse, json, os, struct, sys

import numpy as np
import torch

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from decider import Decider  # noqa: E402

ap = argparse.ArgumentParser(); ap.add_argument('--ckpt', required=True); ap.add_argument('--out', required=True)
a = ap.parse_args()
sd = torch.load(a.ckpt, map_location='cpu', weights_only=False)['model']
m = Decider(); m.load_state_dict({k: v.float() for k, v in sd.items()})
cfg = {'vocab': 4096, 'd': 256, 'layers': 6, 'heads': 8, 'ffn': 768, 'ctx': m.ctx, 'segs': m.seg.num_embeddings}
names, blobs = [], []
for k, v in m.state_dict().items():
    arr = v.detach().float().numpy().astype(np.float16)
    names.append({'name': k, 'shape': list(arr.shape)}); blobs.append(arr.tobytes())
head = json.dumps({'format': 'NDC1', 'config': cfg, 'tensors': names}).encode()
os.makedirs(os.path.dirname(a.out) or '.', exist_ok=True)
with open(a.out, 'wb') as f:
    f.write(b'NDC1'); f.write(struct.pack('<I', len(head))); f.write(head)
    for b in blobs:
        f.write(b)
print('wrote', a.out, os.path.getsize(a.out), 'bytes')
