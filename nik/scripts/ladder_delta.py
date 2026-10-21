"""Compare two ladder/probe runs level by level (the mechanism delta).

    python nik/scripts/ladder_delta.py old_rows.json new_rows.json

Prints every level of the probe (the L1-L4 ladder, the three word surfaces and the
contrast pairs) with the two scores side by side, plus the operand coverage, so the
report says *which* level moved and by how much.
"""
from __future__ import annotations

import argparse
import json
from collections import defaultdict


def load(path):
    d = json.load(open(path, encoding='utf8'))
    rows = d['rows'] if isinstance(d, dict) else d
    g = defaultdict(lambda: {'ok': 0, 'n': 0, 'cov': 0.0})
    for r in rows:
        c = r['cat']
        if c.startswith('contrast-'):
            continue
        g[c]['n'] += 1
        g[c]['ok'] += 1 if r.get('ok') else 0
        g[c]['cov'] += (r.get('grounding') or {}).get('coverage', 0.0)
    return g


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('old')
    ap.add_argument('new')
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()
    o, n = load(a.old), load(a.new)
    order = ['L1-1step', 'L2-2step', 'L3-intermediate-given', 'L4-chain-2line',
             'word-orig', 'word-para', 'word-formula']
    keys = [k for k in order if k in n or k in o] + sorted(k for k in n if k not in order)
    out = {}
    print(f'{"level":26s} {"old":>9s} {"new":>9s} {"delta":>7s} {"cov old":>8s} {"cov new":>8s}')
    for k in keys:
        oo, nn = o.get(k, {'ok': 0, 'n': 0, 'cov': 0.0}), n.get(k, {'ok': 0, 'n': 0, 'cov': 0.0})
        po = oo['ok'] / oo['n'] if oo['n'] else 0
        pn = nn['ok'] / nn['n'] if nn['n'] else 0
        out[k] = {'old': f"{oo['ok']}/{oo['n']}", 'new': f"{nn['ok']}/{nn['n']}",
                  'delta_pp': round(100 * (pn - po), 1),
                  'coverage_old': round(oo['cov'] / oo['n'], 2) if oo['n'] else None,
                  'coverage_new': round(nn['cov'] / nn['n'], 2) if nn['n'] else None}
        print(f'{k:26s} {out[k]["old"]:>9s} {out[k]["new"]:>9s} {out[k]["delta_pp"]:>+6.1f}pp '
              f'{str(out[k]["coverage_old"]):>8s} {str(out[k]["coverage_new"]):>8s}')
    if a.json:
        print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
