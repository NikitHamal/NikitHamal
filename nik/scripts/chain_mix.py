"""Build an SFT mix with a configurable share of CHAIN data (Local-C, issue #9).

Why: the ladder probe (nik/scripts/word_procedure_probe.py --ladder) shows the live
model cannot compose two steps - L2 = 0/12 in all four shipped models - and the
scratchpads show it inventing operands.  The prediction is that the medicine is
*chain* data (one complete 1-step equation per line, operands copied from the
question, the result carried forward), and that the amount matters.

sft7 (the live model's mix) has 0% chains; sft8 (the next mix) has 5% frame + 3%
iter.  This script builds any share in between or beyond, from the same base mix, so
the *only* difference between two runs is the chain share:

    python nik/scripts/chain_mix.py --base sft7 --name chain30 --frame 0.20 --iter 0.10
    python nik/scripts/chain_mix.py --base sft7 --name chain0  --frame 0     --iter 0

The base mix's own chain rows (cat 'math-word-frame' / 'reason-iter') are removed
first, so the share below is the real one.  Then the mix is tokenized exactly like
make_sft2.py does (prepare.py --sft-only).
"""
from __future__ import annotations

import argparse
import json
import os
import random
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
TEACHER = os.path.join(ROOT, 'data', 'teacher')
if not os.path.isdir(TEACHER):
    TEACHER = os.path.join(ROOT, 'nik', 'data', 'teacher')
sys.path.insert(0, TEACHER)

CHAIN_CATS = ('math-word-frame', 'reason-iter')


def chain_rows(n_frame, n_iter, n_roles, seed):
    import frame
    import iter as itgen
    R = random.Random(seed)
    rows = []
    for _ in range(n_frame):
        d = frame.sample(R)
        rows.append({'cat': d['cat'], 'gold': d['gold'], 'messages': d['messages']})
    for _ in range(n_iter):
        d = itgen.make(R)
        rows.append({'cat': d['cat'], 'gold': d['gold'], 'messages': d['messages']})
    for _ in range(n_roles):
        import roles
        d = roles.sample(R)
        rows.append({'cat': d['cat'], 'gold': d['gold'], 'messages': d['messages']})
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default='data')
    ap.add_argument('--base', required=True, help='the base mix name (data/<base>.jsonl)')
    ap.add_argument('--name', required=True, help='output mix name')
    ap.add_argument('--frame', type=float, default=0.20, help='share of rows that are frame chains')
    ap.add_argument('--iter', type=float, default=0.10, help='share of rows that are iteration chains')
    ap.add_argument('--roles', type=float, default=0.0,
                    help='share of rows that are grounded-role rows (roles.py): bind the '
                         'numbers in a text to their roles, then compute (issue #9)')
    ap.add_argument('--seed', type=int, default=77)
    ap.add_argument('--no-tokenize', action='store_true')
    a = ap.parse_args()

    base_path = os.path.join(a.data, f'{a.base}.jsonl')
    if not os.path.exists(base_path):
        raise SystemExit(f'{base_path} not found - build the base mix first (make_sft2.py)')
    rows, dropped = [], 0
    for line in open(base_path, encoding='utf8'):
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        if (d.get('cat') or '') in CHAIN_CATS:
            dropped += 1
            continue
        rows.append(line)
    n_base = len(rows)
    share = a.frame + a.iter + a.roles
    total = n_base + int(round(share / max(1e-9, 1 - share) * n_base))
    n_frame = int(round(a.frame * total))
    n_iter = int(round(a.iter * total))
    n_roles = int(round(a.roles * total))
    extra = chain_rows(n_frame, n_iter, n_roles, a.seed)
    for e in extra:
        rows.append(json.dumps(e, ensure_ascii=False))
    random.Random(a.seed + 1).shuffle(rows)
    out_path = os.path.join(a.data, f'{a.name}.jsonl')
    with open(out_path, 'w', encoding='utf8') as f:
        f.write('\n'.join(rows) + '\n')
    print(f'base {a.base}: {n_base} rows ({dropped} chain rows removed) '
          f'+ {n_frame} frame + {n_iter} iter + {n_roles} roles = {len(rows)} -> {out_path}',
          flush=True)
    print(f'chain share: {100 * (n_frame + n_iter) / max(1, len(rows)):.1f}% of rows, '
          f'roles share: {100 * n_roles / max(1, len(rows)):.1f}%', flush=True)
    if not a.no_tokenize:
        pkg = os.path.join(ROOT, 'nik')
        if not os.path.isdir(pkg):
            pkg = ROOT
        subprocess.run([sys.executable, os.path.join(pkg, 'prepare.py'), '--data', a.data,
                        '--tok', os.path.join(pkg, 'web/model/tokenizer.json'),
                        '--sft-only', '--sft-name', a.name], check=True)


if __name__ == '__main__':
    main()
