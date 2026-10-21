"""Does the sft8 data actually contain the chains the ladder needs?

Local-C's finding (issue #9): the live model cannot compose two steps, and the ladder
(L2/L4) is the probe for that.  The prediction for sft8 (frame.py 5% + iter.py 3%) is
that the ladder moves because the chains are the thing being taught.

That prediction assumes the training rows actually *contain* the chains the ladder
needs.  This script checks the data side, per generator:

  * how many 1-step equations the think block contains (a "chain" needs >= 2);
  * whether every number in those equations comes from the user turn (grounding);
  * whether the last line of the chain is the gold answer;
  * the vocabulary of the chain (does it use the "step1: a op b = c" shape the model
    would have to produce, or a different one).

    python nik/scripts/chain_check.py --n 500
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TEACHER = os.path.join(os.path.dirname(HERE), 'data', 'teacher')
sys.path.insert(0, TEACHER)

EQ = re.compile(r'(\d+)\s*([+\-x*/])\s*(\d+)\s*=\s*(\d+)')
NUM = re.compile(r'-?\d+(?:\.\d+)?')


def nums(text):
    return {float(x) for x in NUM.findall((text or '').replace(',', ''))}


def check_row(row):
    user = ''
    think = ''
    gold = str(row.get('gold', ''))
    for m in row.get('messages', []):
        if m.get('role') == 'user':
            user = m.get('content', '')
        else:
            think += ' ' + (m.get('content', '') or '') + ' ' + (m.get('think', '') or '')
    eqs = EQ.findall(think)
    qn = nums(user)
    # a chain is *closed* when every operand is either a number from the question or a
    # result the chain itself produced - that is the property that teaches the model to
    # carry its own intermediate forward instead of inventing one.
    known = set(qn)
    grounded = 0
    closed = 0
    first_grounded = False
    for i, (a, op, b, c) in enumerate(eqs):
        if float(a) in qn and float(b) in qn:
            grounded += 1
            if i == 0:
                first_grounded = True
        if float(a) in known and float(b) in known:
            closed += 1
        known.add(float(c))
    return {
        'cat': row.get('cat'),
        'equations': len(eqs),
        'grounded': grounded,
        'all_grounded': bool(eqs) and grounded == len(eqs),
        'first_grounded': first_grounded,
        'closed': bool(eqs) and closed == len(eqs),
        'gold_in_chain': any(abs(float(c) - float(gold)) < 1e-9 for _, _, _, c in eqs) if eqs else False,
        'steps_style': bool(re.search(r'\bstep\s*\d+', think)),
        'verify_line': 'jaach' in think.lower(),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=500, help='rows per generator')
    ap.add_argument('--seed', type=int, default=5)
    a = ap.parse_args()
    out = {}
    for mod_name in ('frame', 'iter'):
        try:
            mod = __import__(mod_name)
        except ImportError:
            print(f'{mod_name}: not importable')
            continue
        maker = getattr(mod, 'sample', None) or getattr(mod, 'make')
        R = random.Random(a.seed)
        rows = []
        for _ in range(a.n):
            try:
                rows.append(maker(R))
            except Exception as e:
                print(f'{mod_name}: sample failed: {e}')
                break
        if not rows:
            continue
        res = [check_row(r) for r in rows]
        n = len(res)
        out[mod_name] = {
            'rows': n,
            'mean_equations': round(sum(r['equations'] for r in res) / n, 2),
            'chain_rows_pct': round(100 * sum(1 for r in res if r['equations'] >= 2) / n, 1),
            'first_step_grounded_pct': round(100 * sum(1 for r in res if r['first_grounded']) / n, 1),
            'closed_chain_pct': round(100 * sum(1 for r in res if r['closed']) / n, 1),
            'gold_in_chain_pct': round(100 * sum(1 for r in res if r['gold_in_chain']) / n, 1),
            'steps_style_pct': round(100 * sum(1 for r in res if r['steps_style']) / n, 1),
            'verify_line_pct': round(100 * sum(1 for r in res if r['verify_line']) / n, 1),
        }
    print(json.dumps(out, indent=1, ensure_ascii=False))


if __name__ == '__main__':
    main()
