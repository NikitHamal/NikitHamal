"""Collapse rate: does the model read the input, or match it to a template?

Local-A's identity finding: the live model answers "mero naam nikit ho" and
"nikit ko ho?" with the *same* stored bio - it does not read the question, it matches
the question to a template and runs that.

The same test in the arithmetic channel, which is what the word-problem ladder cannot
separate: two problems with the **same shape and different numbers**.  A model that
reads the numbers gives two different answers; a model that matches a template gives
the same answer twice.

    python nik/scripts/word_procedure_probe.py --out items.json --contrast
    node nik/scripts/word_probe_run.mjs nik/web/model/nik-0.1.bin items.json --out rows.json
    python nik/scripts/collapse_report.py rows.json

Reports, per level: the correct rate, the identical-answer rate inside a pair (the
collapse rate), and the operand coverage.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict

PAIR = re.compile(r'^contrast-(L\d+)-p(\d+)-m(\d+)$')
NUM = re.compile(r'-?\d+')


def numbers(text):
    return [int(x) for x in NUM.findall(text.replace(',', ''))]


def reduced_to_one_op(q, ans):
    """did the model answer equal (x - y) or (y - x) for two of the question's numbers?

    '39 - (8 x 2) = ?' -> the model answered with (39 - 8 - 2) and with (7 - 4): it
    collapsed a two-operation expression into a SINGLE binary operation over two of the
    numbers.  This is the mechanism, and it is countable.
    """
    if ans is None:
        return False
    qs = sorted(set(numbers(q)))
    for i in range(len(qs)):
        for j in range(i + 1, len(qs)):
            x, y = qs[i], qs[j]
            if ans in (x - y, y - x, x + y, y * x):
                return True
    return False


def executed_the_mult(q, think):
    """did the scratchpad ever multiply the two numbers in the parentheses?

    '39 - (8 x 2) = ?' -> the model wrote 'pahila 29 - 39 nikalchhu' (it subtracted the
    operands instead of multiplying them) and never multiplied 8 x 2.  If this rate is
    ~0, the finding is crisp: the model does not execute the second operation, it
    rewrites the problem into one it can execute.
    """
    import re as _re
    m = _re.search(r'\((\d+) x (\d+)\)', q)
    if not m:
        return None
    b, c = int(m.group(1)), int(m.group(2))
    t = think or ''
    if f'{b} x {c}' in t or f'{c} x {b}' in t:
        return True
    return str(b * c) in t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('rows', help='the rows json from word_probe_run.mjs')
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()
    data = json.load(open(a.rows, encoding='utf8'))
    rows = data['rows'] if isinstance(data, dict) else data

    pairs = defaultdict(dict)
    levels = defaultdict(lambda: {'ok': 0, 'n': 0, 'coverage': 0.0, 'reduced': 0, 'reducible': 0,
                                  'mult_n': 0, 'mult_done': 0})
    for r in rows:
        m = PAIR.match(r['cat'])
        if not m:
            continue
        level, idx = m.group(1), m.group(2)
        pairs[(level, idx)][r['num']] = r
        levels[level]['n'] += 1
        levels[level]['ok'] += 1 if r['ok'] else 0
        levels[level]['coverage'] += (r.get('grounding') or {}).get('coverage', 0.0)
        if level == 'L2':
            levels[level]['reducible'] += 1
            if reduced_to_one_op(r['q'], r.get('num')):
                levels[level]['reduced'] += 1
            ex = executed_the_mult(r['q'], r.get('think'))
            if ex is not None:
                levels[level]['mult_n'] += 1
                levels[level]['mult_done'] += 1 if ex else 0

    out = {}
    for level in sorted(levels):
        same = 0
        both = 0
        for (lv, idx), members in pairs.items():
            if lv != level or len(members) < 2:
                continue
            both += 1
            answers = list(members.values())
            nums = [x.get('num') for x in answers]
            if nums[0] is not None and nums[0] == nums[1]:
                same += 1
        v = levels[level]
        out[level] = {
            'items': v['n'],
            'correct': v['ok'],
            'correct_pct': round(100 * v['ok'] / max(1, v['n']), 1),
            'pairs': both,
            'identical_answer': same,
            'collapse_pct': round(100 * same / both, 1) if both else None,
            'operand_coverage': round(v['coverage'] / max(1, v['n']), 3),
            'reduced_to_one_op': v['reduced'],
            'reduced_pct': round(100 * v['reduced'] / v['reducible'], 1) if v['reducible'] else None,
            'multiplication_executed': v['mult_done'],
            'multiplication_executed_pct': (round(100 * v['mult_done'] / v['mult_n'], 1)
                                            if v['mult_n'] else None),
        }
    if a.json:
        print(json.dumps(out, indent=1))
        return
    print(f'{"level":8s} {"correct":>9s} {"pairs":>6s} {"identical":>10s} {"collapse":>9s} '
          f'{"coverage":>9s} {"reduced":>9s} {"mult-done":>10s}')
    for level, v in out.items():
        red = f'{v["reduced_pct"]}%' if v['reduced_pct'] is not None else '-'
        mx = (f'{v["multiplication_executed_pct"]}%'
              if v.get('multiplication_executed_pct') is not None else '-')
        print(f'{level:8s} {v["correct"]:4d}/{v["items"]:<4d} {v["pairs"]:6d} '
              f'{v["identical_answer"]:10d} {str(v["collapse_pct"]) + "%":>9s} '
              f'{v["operand_coverage"]:9.2f} {red:>9s} {mx:>10s}')
    print()
    print('collapse_pct = share of same-shape pairs where the model gave the SAME answer to')
    print('both members (a model that reads the numbers cannot do that).')
    print('mult-done = share of the scratchpads that ever executed the multiplication they')
    print('were asked to execute (the second operation of the expression).')


if __name__ == '__main__':
    main()
