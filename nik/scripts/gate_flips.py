"""Paired view of a full_gate result (Claude, 2026-10-22): per gate row, how many items the candidate FIXED (live wrong,
candidate right) and BROKE (live right, candidate wrong), and the exact two-sided sign-test p-value of the net change.

A net -1 on a row can be 0 fixed / 1 broken (a real, if tiny, loss) or 12 fixed / 13 broken (two models that disagree
on 25 items and tie): the totals in gate_verdict.py cannot tell these apart, the flips can.
    python nik/scripts/gate_flips.py /tmp/gate_live /tmp/gate_k3 [/tmp/gate_r1 ...]
"""
import json
import math
import os
import re
import sys


def _rows(d, f, key, ok):
    try:
        rows = json.load(open(os.path.join(d, f)))[key]
    except (FileNotFoundError, KeyError, json.JSONDecodeError):
        return None
    return [bool(r.get(ok)) for r in rows]


def _traps(d):
    try:
        t = open(os.path.join(d, 'trap.txt')).read()
    except FileNotFoundError:
        return None
    v = [m == 'ok  ' for m in re.findall(r'^\[(ok  |FAIL)\]', t, re.M)]
    return v or None


ROWS = {
    'bench': lambda d: _rows(d, 'bench.json', 'rows', 'ok'),
    'nested': lambda d: _rows(d, 'nbench.json', 'rows', 'ok'),
    'understanding': lambda d: _rows(d, 'und.json', 'rows', 'pass'),
    'RW items': lambda d: _rows(d, 'rw.json', 'rows', 'ok'),
    'shapes': lambda d: _rows(d, 'shape.json', 'rows', 'ok'),
    'reading pairs': lambda d: _rows(d, 'reading.json', 'rows', 'pair_ok'),
    'ladder': lambda d: _rows(d, 'ladder.json', 'rows', 'ok'),
    'traps': _traps,
}


def sign_p(b, c):
    """Exact two-sided binomial (sign) test of b broken vs c fixed under H0: equally likely."""
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    p = sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n
    return min(1.0, 2 * p)


def compare(live, cand):
    out = []
    for name, get in ROWS.items():
        L, C = get(live), get(cand)
        if L is None or C is None or len(L) != len(C):
            out.append((name, None))
            continue
        fixed = sum(1 for a, b in zip(L, C) if not a and b)
        broke = sum(1 for a, b in zip(L, C) if a and not b)
        out.append((name, (sum(L), sum(C), fixed, broke, sign_p(broke, fixed))))
    return out


def main():
    live, cands = sys.argv[1], sys.argv[2:]
    for c in cands:
        print(f'== {os.path.basename(c.rstrip("/"))} vs {os.path.basename(live.rstrip("/"))}')
        print(f'{"row":15s} {"live":>5s} {"cand":>5s} {"fixed":>6s} {"broke":>6s} {"p":>6s}')
        for name, r in compare(live, c):
            if r is None:
                print(f'{name:15s}   (missing or different items)')
                continue
            a, b, f, k, p = r
            mark = 'real drop?' if b < a and p < 0.1 else ('real gain?' if b > a and p < 0.1 else '')
            print(f'{name:15s} {a:5d} {b:5d} {f:6d} {k:6d} {p:6.2f}  {mark}')


if __name__ == '__main__':
    main()
