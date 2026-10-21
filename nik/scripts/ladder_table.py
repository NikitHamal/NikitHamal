"""The mechanism table across runs: one line per model, one column per level.

    python nik/scripts/ladder_table.py --runs logs/chain0 logs/chain15 logs/chain30

Prints the execution ladder (L1 one step, L2 two steps, L3 intermediate given, L4
chain), the three word surfaces and the operand coverage, for every run given.  The
point of the table is the L2 column: it is the only column that says whether the model
can *compose two steps*, and it has stayed at 0/12 through every mix we have tried.
"""
from __future__ import annotations

import argparse
import json
import os

LEVELS = ['L1-1step', 'L2-2step', 'L3-intermediate-given', 'L4-chain-2line',
          'word-orig', 'word-para', 'word-formula']


def read_rows(path):
    d = json.load(open(path, encoding='utf8'))
    rows = d['rows'] if isinstance(d, dict) else d
    g = {}
    for r in rows:
        if r['cat'].startswith('contrast-'):
            continue
        k = g.setdefault(r['cat'], [0, 0, 0.0])
        k[0] += 1 if r['ok'] else 0
        k[1] += 1
        k[2] += (r.get('grounding') or {}).get('coverage', 0.0)
    return {k: (v[0], v[1], round(v[2] / v[1], 2) if v[1] else 0.0) for k, v in g.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('runs', nargs='+', help='ladder-*.json files (or dirs containing them)')
    a = ap.parse_args()
    table = {}
    for r in a.runs:
        path = r
        if os.path.isdir(r):
            cands = sorted(f for f in os.listdir(r) if f.startswith('ladder') and f.endswith('.json'))
            path = os.path.join(r, cands[-1]) if cands else None
        if not path or not os.path.exists(path):
            print(f'  (no ladder rows for {r})')
            continue
        table[os.path.basename(path).replace('ladder-', '').replace('.json', '')] = read_rows(path)
    print(f'{"run":14s} ' + ' '.join(f'{l.split("-")[0]:>9s}' for l in LEVELS) + '   cov L2/L4')
    for tag, g in table.items():
        cells = []
        for l in LEVELS:
            v = g.get(l)
            cells.append(f'{str(v[0]) + "/" + str(v[1]):>9s}' if v else f'{"-":>9s}')
        cov = f'{g.get("L2-2step", (0, 0, 0))[2]}/{g.get("L4-chain-2line", (0, 0, 0))[2]}'
        print(f'{tag:14s} ' + ' '.join(cells) + '   ' + cov)


if __name__ == '__main__':
    main()
