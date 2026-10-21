"""Why does a model fail NikBench-RW? Classify every failure, not just count it.

m50 scores 25/135 items and 1/45 groups on RW, which reads as "the model cannot do
real-world problems". The rows say something much more actionable: the largest classes
are behavioural, not arithmetic - it never abstains when the prompt lacks the fact
(0/18), it rarely follows an output-format instruction (1/18), and it copies a number
from the prompt instead of computing (19). Only ~10 of 135 failures are a chain that
stopped one step short.

    python nik/scripts/rw_diagnose.py nik/web/model/logs/rw/rw-m50.json [--examples 4]

Modes are inferred from the prompt/reply numbers, so the arithmetic modes are
heuristics; `unknown` and `format` are exact, because they are decided by the scorer.
"""
import argparse
import json
import re
from collections import Counter, defaultdict


def nums(text):
    return [float(x.replace(',', '')) for x in re.findall(r'\d+(?:\.\d+)?', text or '')]


def combos(values):
    """every value reachable by applying ONE operation to two of the prompt's numbers"""
    out = set()
    vals = list(dict.fromkeys(values))
    for i, a in enumerate(vals):
        for b in vals[i + 1:]:
            for v in (a + b, a - b, b - a, a * b, (a / b) if b else None, (b / a) if a else None):
                if v is not None and abs(v) < 1e6:
                    out.add(round(v, 4))
    return out


def classify(row):
    if row.get('ok'):
        return 'pass'
    cat = row.get('cat')
    if cat == 'unknown':
        return 'should abstain, answered instead'
    if cat == 'format':
        return 'format not followed'
    pn = nums(row.get('prompt'))
    rn = nums(row.get('reply'))
    if not rn:
        return 'no number in reply'
    last = round(rn[-1], 4)
    if last in {round(x, 4) for x in pn}:
        return 'copied a prompt number'
    if last in combos(pn):
        return 'one step, not the chain'
    if len(pn) >= 3:
        return 'invented arithmetic'
    return 'wrong value'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('rw_json')
    ap.add_argument('--examples', type=int, default=0)
    a = ap.parse_args()
    d = json.load(open(a.rw_json, encoding='utf-8'))
    rows = d['rows']
    s = d['summary']
    print('RW: %s groups, %s items (n=%d)' % (s['groups'], s['items'], len(rows)))
    by_cat = defaultdict(Counter)
    for r in rows:
        by_cat[r['cat']][classify(r)] += 1
    print('\n%-8s %-5s %-5s | failure modes' % ('cat', 'pass', 'fail'))
    for cat in sorted(by_cat):
        c = by_cat[cat]
        fail = sum(v for k, v in c.items() if k != 'pass')
        modes = ', '.join('%s x%d' % (k, v) for k, v in c.most_common() if k != 'pass')
        print('%-8s %-5d %-5d | %s' % (cat, c.get('pass', 0), fail, modes))
    tot = Counter()
    for c in by_cat.values():
        for k, v in c.items():
            if k != 'pass':
                tot[k] += v
    print('\ntotal by mode:')
    for k, v in tot.most_common():
        print('  %4d  %s' % (v, k))
    if a.examples:
        print('\nexamples:')
        for mode in [k for k, _ in tot.most_common()]:
            n = 0
            for r in rows:
                if classify(r) != mode:
                    continue
                print('  [%s / %s] %s' % (r['cat'], mode, r['prompt'][:92]))
                print('        -> %r' % (r['reply'][:70]))
                n += 1
                if n >= a.examples:
                    break


if __name__ == '__main__':
    main()
