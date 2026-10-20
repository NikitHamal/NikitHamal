"""Per-family breakdown of a saved NikBench result (Local-C, issue #9).

The category aggregate hides the structure.  "word 2/24" reads like an 8% skill; the
real picture (measured on the live v4b) is:

    2/5  on the one template the model memorised
    0/19 on every template it has not seen

and "reason 11/24" is 11/11 on one-step facts and 0/11 on iteration.  A new model that
moves the *held-out* families off zero is a real improvement; a new model that moves the
memorised template is not.  This script makes that visible for any saved bench JSON.

    python nik/scripts/bench_families.py --json nik/web/model/logs/v4b/bench-v4b.json
    python nik/scripts/bench_families.py --json bench-ablApre.json --json-out families.json
    python nik/scripts/bench_families.py --json a.json --json b.json     # compare two runs

Only reads a JSON that bench.py already wrote (per-item rows); it does not touch
bench.py and does not re-score anything.
"""
from __future__ import annotations

import argparse
import json
import os
import re

# --- how a question is grouped into a *family* ------------------------------
WORD_FAMILIES = [
    ('chakleti (buys snacks)', 'chakleti'),
    ('bus (English)', 'bus travels'),
    ('bagaincha (lines of beads)', 'bagaincha'),
    ('kalam (pens)', 'wata kalam'),
    ('boxes of apples (English)', 'boxes with'),
    ('kitab + discount %', 'kitab ko mol'),
    ('kaksha (classroom)', 'kaksha ma'),
    ('masik talab (savings)', 'masik talab'),
    ('rupiya chha (money)', 'rupiya chha'),
    ('kursi / khidki (things)', 'kursi'),
]
REASON_FAMILIES = [
    ('arithmetic sequence', 'shrinkhala'),
    ('geometric pattern', 'pattern'),
    ('weekday', 'kun bar'),
    ('age comparison', 'barsha jetho'),
    ('unit (km->m)', 'kilometer ma'),
    ('unit (h->min)', 'ghanta ma kati minute'),
]


def family(q, cat):
    table = WORD_FAMILIES if cat == 'word' else REASON_FAMILIES if cat == 'reason' else []
    for name, key in table:
        if key in q:
            return name
    return 'other: ' + q[:28]


def breakdown(rows):
    out = {}
    for r in rows:
        cat = r.get('cat', '?')
        if cat not in ('word', 'reason'):
            continue
        key = (cat, family(r.get('q', ''), cat))
        v = out.setdefault(key, [0, 0])
        v[0] += 1 if r.get('ok') else 0
        v[1] += 1
    return out


def load(path):
    j = json.load(open(path, encoding='utf8'))
    return j.get('rows') or [], j


def understanding_report(path):
    """per-kind breakdown of the understanding probes (eval_understand.py JSON)."""
    j = json.load(open(path, encoding='utf8'))
    rows = j.get('rows') or []
    by = {}
    for r in rows:
        v = by.setdefault(r.get('kind', '?'), [0, 0])
        v[0] += 1 if r.get('pass') else 0
        v[1] += 1
    fails = [r for r in rows if r.get('pass') is False]
    return by, fails, j


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--json', action='append', default=[], help='a saved bench JSON (repeatable)')
    ap.add_argument('--understand', default='', help='a saved eval_understand.py JSON')
    ap.add_argument('--json-out', default='')
    ap.add_argument('--show-failures', action='store_true')
    a = ap.parse_args()
    if not a.json and not a.understand:
        ap.error('need --json or --understand')

    report = {}
    for path in a.json:
        rows, j = load(path)
        bd = breakdown(rows)
        report[path] = {
            'overall': j.get('overall'),
            'groups': j.get('groups'),
            'by_family': {f'{c}/{f}': {'right': v[0], 'total': v[1]} for (c, f), v in sorted(bd.items())},
        }
        print(f'\n=== {path}  (overall {j.get("overall")}) ===')
        for cat in ('word', 'reason'):
            items = [(f, v) for (c, f), v in sorted(bd.items()) if c == cat]
            if not items:
                continue
            dead = sum(1 for _, v in items if v[0] == 0)
            print(f'  {cat}: {dead}/{len(items)} families at zero')
            for f, v in items:
                mark = '  <-- at zero' if v[0] == 0 else ''
                print(f'    {v[0]:2d}/{v[1]:<2d} {f}{mark}')
        if a.show_failures:
            for r in rows:
                if not r.get('ok'):
                    print(f'    FAIL [{r.get("cat")}] gold={r.get("gold")} {r.get("q", "")[:70]}')

    if a.understand:
        by, fails, j = understanding_report(a.understand)
        report[a.understand] = {'score': j.get('score'), 'of': j.get('of'),
                                'by_kind': {k: {'right': v[0], 'total': v[1]} for k, v in sorted(by.items())}}
        print(f'\n=== {a.understand}  ({j.get("score")}/{j.get("of")}) ===')
        for k, v in sorted(by.items(), key=lambda kv: kv[1][1]):
            mark = '  <-- at zero' if v[0] == 0 else ''
            print(f'    {v[0]:2d}/{v[1]:<2d} {k}{mark}')
        if fails:
            print(f'  failing probes ({len(fails)}):')
            for r in fails:
                print(f'    [{r.get("kind")}] {r.get("q", "")[:58]} -> {(r.get("a") or "")[:70]}')

    if len(a.json) == 2:
        p1, p2 = a.json
        b1, _ = load(p1)
        b2, _ = load(p2)
        f1, f2 = breakdown(b1), breakdown(b2)
        # IMPORTANT: bench.py draws every item from ONE rng stream and generates the arith
        # block first, so the item set of --n 8 is NOT a subset of --n 16 (measured: only
        # 3 of 24 word items are shared).  A per-family delta between two runs with
        # different item sets is NOT a paired comparison - only compare.py's paired dump
        # (the same items for both models) is.
        q1 = {r.get('q', '') for r in b1}
        q2 = {r.get('q', '') for r in b2}
        shared = len(q1 & q2)
        print(f'\n=== per-family delta: {os.path.basename(p2)} vs {os.path.basename(p1)} ===')
        if shared < min(len(q1), len(q2)) * 0.9:
            print(f'  NOTE: the two runs share only {shared}/{min(len(q1), len(q2))} of their items '
                  f'-> DIFFERENT item sets, so this delta is NOT paired. Compare with compare.py (paired).')
        for key in sorted(set(f1) | set(f2)):
            v1, v2 = f1.get(key, [0, 0]), f2.get(key, [0, 0])
            d = v2[0] - v1[0]
            print(f'  {v1[0]:2d}/{v1[1]:<2d} -> {v2[0]:2d}/{v2[1]:<2d}  ({d:+d})  {key[0]}/{key[1]}')
    if a.json_out:
        json.dump(report, open(a.json_out, 'w', encoding='utf8'), indent=1, ensure_ascii=False)
        print(f'\nwrote {a.json_out}')


if __name__ == '__main__':
    main()
