"""Make an English-augmented data dir for an SFT stage (Claude, 2026-10-22).

  data_en/<name>.jsonl     = <base>.jsonl + English chat rows (build_en.py) repeated to --share of rows, shuffled
  data_en/<name>_tok/_mask = tokenized like make_sft2 (prepare.py --sft-only)
  data_en/pre_train.bin    = data/pre_train.bin + Simple English Wikipedia docs (BOS doc EOS, same format), so the
                             replay stream (--mix) carries English too (~5% of replay tokens with 80k docs)
Everything else in data/ is symlinked. Train with `train.py --data data_en --sft-name <name>`.

    python nik/scripts/add_english.py --data data --out data_en --base sftb --name sfte --en data/english --share 0.10
"""
import argparse
import json
import os
import random
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'nik'))
from tokenizer import Tokenizer  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default='data'); ap.add_argument('--out', default='data_en')
    ap.add_argument('--base', required=True); ap.add_argument('--name', required=True)
    ap.add_argument('--en', default='data/english'); ap.add_argument('--share', type=float, default=0.10)
    ap.add_argument('--no-replay', action='store_true'); ap.add_argument('--seed', type=int, default=11)
    a = ap.parse_args()
    R = random.Random(a.seed)
    os.makedirs(a.out, exist_ok=True)
    for f in os.listdir(a.data):
        src, dst = os.path.abspath(os.path.join(a.data, f)), os.path.join(a.out, f)
        if not os.path.exists(dst) and f != 'pre_train.bin':
            os.symlink(src, dst)
    base = open(os.path.join(a.data, f'{a.base}.jsonl')).readlines()
    en = open(os.path.join(a.en, 'en_sft.jsonl')).readlines()
    want = int(len(base) * a.share / (1 - a.share))
    rows = base + [en[i % len(en)] for i in range(want)]
    R.shuffle(rows)
    with open(os.path.join(a.out, f'{a.name}.jsonl'), 'w') as f:
        f.writelines(rows)
    print(f'{a.name}: {len(base):,} base rows + {want:,} English rows ({len(en):,} unique, x{want / max(1, len(en)):.1f}) = {len(rows):,}', flush=True)
    subprocess.run([sys.executable, os.path.join(ROOT, 'nik', 'prepare.py'), '--data', a.out, '--sft-only', '--sft-name', a.name,
                    '--tok', os.path.join(ROOT, 'nik', 'web', 'model', 'tokenizer.json')], check=True)
    dst = os.path.join(a.out, 'pre_train.bin')
    if os.path.islink(dst):
        os.remove(dst)
    pre = np.fromfile(os.path.join(a.data, 'pre_train.bin'), dtype=np.uint16)
    if a.no_replay:
        pre.tofile(dst); return
    tok = Tokenizer.load(os.path.join(ROOT, 'nik', 'web', 'model', 'tokenizer.json'))
    out = []
    for line in open(os.path.join(a.en, 'en_wiki.txt')):
        if line.strip():
            out += [1] + tok.encode(line.strip(), allow_special=False) + [2]
    en_tok = np.array(out, dtype=np.uint16)
    np.concatenate([pre, en_tok]).tofile(dst)
    print(f'replay: {len(pre):,} + {len(en_tok):,} English tokens ({100 * len(en_tok) / (len(pre) + len(en_tok)):.1f}%)')


if __name__ == '__main__':
    main()
