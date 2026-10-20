"""Iteration drills: apply a rule step by step (Local-C, issue #9).

The measured gap (issue #9, per-family breakdown of the live model):
    unit (h->min) 7/7 | age 2/2 | unit (km->m) 2/2   -> one-step facts: perfect
    arithmetic sequence 0/7 | geometric pattern 0/4   -> iteration: zero
The model can apply a rule once and cannot apply it again.  That is the whole 11/24.

This generator teaches the missing skill: **one line per iteration**, so the rule is
applied locally and the answer falls out of the last line.  It reuses the trace style
the model already knows (labelled steps + a `jaach:` check), so it adds problems, not
vocabulary.

The surface forms are deliberately NOT the benchmark's (the bench asks
"shrinkhala: 14, 19, 24, 29, ... arko number?" and "pattern: 3, 9, 27, ..."; those
strings must stay held out) - the *skill* has to transfer, the string must not.

    python nik/data/teacher/iter.py --n 1000 --seed 3 --out /tmp/iter.jsonl
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

NAMES = ['sita', 'ram', 'gita', 'bikash', 'maya', 'nabin', 'sunil', 'rekha', 'kiran', 'asha']
FORMS = [
    'kram: {seq}, ... aru number k hunchha?',
    'yo kram ko aru k ke ho: {seq}, ...?',
    'number ko kram dekhe aru number k aauncha: {seq}, ...?',
    '{seq}, ... yeuta kram ho. aru number k?',
    'kram ko aru member k ho: {seq}, ...?',
    'suru dekhi yeuta kram chalirakhyo: {seq}, ... auru k?',
]
PATTERNS = [
    # NB: the benchmark's own strings ("shrinkhala: ...", "pattern: ... aba aaune?") must stay
    # held out - the *skill* has to transfer, the wording must not.  test_iter.py checks this.
    'yo pattern ko aru number k hunchha: {seq}, ...?',
    'kram ko kura dekhe aru k aauncha: {seq}, ...?',
    'yo pattern ma aru number k aauncha: {seq}, ...?',
    'yo number kram ko aru member k ho: {seq}, ...?',
]


def _fmt(seq):
    return ', '.join(str(v) for v in seq)


def seq_add(R):
    """a, a+d, a+2d, ...  (d may be negative, but every term stays positive)"""
    d = R.choice([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 20, 25,
                  -1, -2, -3, -4, -5, -6, -7, -8])
    n = R.randint(3, 7)
    if d < 0:
        lo = 1 + abs(d) * n          # keep every term (and the answer) positive
        hi = max(lo + 5, 99)
    else:
        lo, hi = 2, 99
    a = R.randint(lo, hi)
    seq = [a + d * i for i in range(n)]
    nxt = a + d * n
    step = '+' if d > 0 else '-'
    dd = abs(d)
    lines = []
    for i in range(n - 1):
        lines.append((f'step{i + 1}', f'{seq[i]} {step} {dd}', seq[i + 1]))
    lines.append(('aru', f'{seq[-1]} {step} {dd}', nxt))
    rule = f'har step ma {dd} {"joda" if d > 0 else "kata"} hunchha'
    check = f'{seq[-1]} {step} {dd} = {nxt}, milyo'
    return seq, nxt, lines, rule, check


def seq_mul(R):
    """a, a*r, a*r^2, ...  (r >= 2)"""
    a = R.randint(1, 19)
    r = R.choice([2, 3, 4, 5])
    n = R.randint(3, 5)
    seq = [a * r ** i for i in range(n)]
    nxt = a * r ** n
    lines = []
    for i in range(n - 1):
        lines.append((f'step{i + 1}', f'{seq[i]} x {r}', seq[i + 1]))
    lines.append(('aru', f'{seq[-1]} x {r}', nxt))
    rule = f'har step ma {r} guna hunchha'
    check = f'{seq[-1]} x {r} = {nxt}, milyo'
    return seq, nxt, lines, rule, check


def seq_div(R):
    """a*r^n, a*r^(n-1), ... a*r  -> next is a   (every term divides exactly)"""
    a = R.randint(1, 19)
    r = R.choice([2, 3])
    n = R.randint(3, 5)                      # number of shown terms
    seq = [a * r ** (n - i) for i in range(n)]  # descending: a*r^n ... a*r
    nxt = a
    lines = []
    for i in range(n - 1):
        lines.append((f'step{i + 1}', f'{seq[i]} / {r}', seq[i + 1]))
    lines.append(('aru', f'{seq[-1]} / {r}', nxt))
    rule = f'har step ma {r} bata gata hunchha'
    check = f'{seq[-1]} / {r} = {nxt}, milyo'
    return seq, nxt, lines, rule, check


def make(R):
    kind = R.choice(['add', 'add', 'add', 'mul', 'mul', 'div'])
    if kind == 'add':
        seq, nxt, lines, rule, check = seq_add(R)
        form = R.choice(FORMS)
    elif kind == 'mul':
        seq, nxt, lines, rule, check = seq_mul(R)
        form = R.choice(PATTERNS)
    else:
        seq, nxt, lines, rule, check = seq_div(R)
        form = R.choice(PATTERNS)
    user = form.format(seq=_fmt(seq))
    body = '. '.join(f'{lab}: {expr} = {val}' for lab, expr, val in lines)
    think = f'niyam: {rule}. {body}. jaach: {check}'
    ans = f'aru number {nxt} hunchha.'
    return {'cat': 'reason-iter', 'gold': str(nxt),
            'messages': [{'role': 'user', 'content': user},
                         {'role': 'nik', 'content': ans, 'think': think}]}


def check(row):
    """the gold must be the last number of the answer, and every equation in the
    trace must hold."""
    import re
    ans = row['messages'][-1]['content']
    nums = re.findall(r'-?\d+', ans.replace(',', ''))
    if not nums or nums[-1] != row['gold']:
        return f'gold {row["gold"]} is not the last number of the answer'
    for part in row['messages'][-1].get('think', '').split('. '):
        if '=' not in part:
            continue
        lhs, rhs = part.split('=', 1)
        lhs = lhs.split(': ', 1)[-1]
        rhs = ''.join(ch for ch in rhs.strip().split()[0] if ch.isdigit() or ch == '-')
        try:
            expr = lhs.strip().replace(' x ', ' * ').replace(' / ', ' / ')
            v = eval(expr, {'__builtins__': {}}, {})   # noqa: S307 - our own strings
        except Exception:
            return f'cannot parse step: {part!r}'
        if int(v) != int(rhs):
            return f'bad equation: {part!r} ({v} != {rhs})'
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=1000)
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--out', default='')
    a = ap.parse_args()
    R = random.Random(a.seed)
    rows, bad = [], 0
    for _ in range(a.n):
        row = make(R)
        if check(row):
            bad += 1
            continue
        rows.append(row)
    out = a.out or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'iter_%dk.jsonl' % (a.n // 1000))
    with open(out, 'w', encoding='utf8') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f'wrote {out}: {len(rows)} rows ({bad} rejected by the arithmetic checker)')


if __name__ == '__main__':
    main()
