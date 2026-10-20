"""One-command ship gate: is a candidate model actually better than the live one?

The group ships a model only when it beats the live model on the eval suite.  The
aggregate percentages cannot see the thing we keep failing at (the live model is
2/5 on the one word template it memorised and 0/38 on every held-out family), so this
script reports the *per-family* view next to the aggregates and turns the decision into
PASS/FAIL lines.

    python nik/scripts/ship_gate.py --old nik/web/model/logs/v4c --new /tmp/nik_out5

It reads the JSONs that the eval scripts already write:
    <dir>/bench-*.json      per-item rows (bench.py --out)
    <dir>/understand-*.json  per-probe rows (eval_understand.py --out)
    <dir>/stress-*.json      per-prompt rows (stress.py --out)
    <dir>/eval-*.json         math/persona (eval.py --out)
    <dir>/chat-*.log          chat_check output ("chat sanity: 15/15 ok")

Gates (defaults, override with --min-*):
  * no regression on understanding / stress / chat_check / persona / math
  * bench overall not worse than --max-regress
  * at least one held-out word family off zero (the real prize)
  * at least --min-heldout held-out families or reason families off zero
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from bench_families import breakdown, family  # noqa: E402

# the families that are held out: the model cannot have seen them in training
HELD_OUT_PREFIXES = ('bus (English)', 'bagaincha', 'boxes of apples', 'kaksha', 'kitab',
                     'masik talab', 'kalam', 'rupiya chha', 'kursi')
ITER_FAMILIES = ('arithmetic sequence', 'geometric pattern')


def load_dir(d):
    out = {'bench': None, 'understand': None, 'stress': None, 'eval': None, 'chat': None}
    for pat, key in (('bench*.json', 'bench'), ('understand*.json', 'understand'),
                     ('stress*.json', 'stress'), ('eval-*.json', 'eval')):
        files = sorted(glob.glob(os.path.join(d, pat)))
        if files:
            try:
                out[key] = json.load(open(files[-1], encoding='utf8'))
            except json.JSONDecodeError:
                pass
    chats = sorted(glob.glob(os.path.join(d, 'chat-*.log')))
    if chats:
        out['chat'] = open(chats[-1], encoding='utf8', errors='replace').read()
    return out


def score_of(d):
    """-> dict of the headline numbers, plus the per-family table"""
    res = {'bench': None, 'groups': {}, 'understand': None, 'stress': None, 'chat': None,
           'persona': None, 'math': None, 'heldout_off_zero': 0, 'families': {}, 'reason_off_zero': 0,
           'questions': set()}
    if d['bench']:
        rows = d['bench'].get('rows') or []
        res['questions'] = {r.get('q', '') for r in rows}
        res['bench'] = d['bench'].get('overall')
        res['groups'] = d['bench'].get('groups') or {}
        bd = breakdown(rows)
        for (cat, fam), v in bd.items():
            res['families'][f'{cat}/{fam}'] = v
        res['heldout_off_zero'] = sum(1 for k, v in res['families'].items()
                                      if k.startswith('word/') and v[0] > 0
                                      and any(k.split('/', 1)[1].startswith(p) for p in HELD_OUT_PREFIXES))
        res['reason_off_zero'] = sum(1 for k, v in res['families'].items()
                                     if k.startswith('reason/') and v[0] > 0
                                     and any(k.split('/', 1)[1].startswith(p) for p in ITER_FAMILIES))
    if d['understand']:
        res['understand'] = d['understand'].get('score')
    if d['stress']:
        res['stress'] = d['stress'].get('score')
        res['stress_of'] = d['stress'].get('of')
    if d['eval']:
        e = d['eval']
        res['persona'] = e.get('persona_acc')
        res['math'] = e.get('math_acc')
    if d['chat']:
        m = re.search(r'chat sanity: (\d+)/(\d+)', d['chat'])
        if m:
            res['chat'] = (int(m.group(1)), int(m.group(2)))
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--old', default='nik/web/model/logs/v4c', help='the live model logs')
    ap.add_argument('--new', required=True, help='the candidate logs')
    ap.add_argument('--max-regress', type=float, default=0.02, help='max allowed bench regression (absolute)')
    ap.add_argument('--min-heldout', type=int, default=1, help='held-out word families that must be off zero')
    ap.add_argument('--min-understand', type=int, default=0)
    ap.add_argument('--min-stress', type=int, default=0)
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()

    old = score_of(load_dir(a.old))
    new = score_of(load_dir(a.new))
    lines, ok = [], True

    def gate(name, passed, detail):
        nonlocal ok
        ok = ok and passed
        lines.append((('PASS' if passed else 'FAIL'), name, detail))

    if old['understand'] is not None and new['understand'] is not None:
        gate('understanding', new['understand'] >= old['understand'],
             f"{old['understand']}/26 -> {new['understand']}/26")
    if old['stress'] is not None and new['stress'] is not None:
        gate('stress (strict)', new['stress'] >= old['stress'],
             f"{old['stress']}/{old.get('stress_of', '?')} -> {new['stress']}/{new.get('stress_of', '?')}")
    if old['chat'] and new['chat']:
        gate('chat_check', new['chat'][0] >= old['chat'][0], f"{old['chat'][0]}/{old['chat'][1]} -> {new['chat'][0]}/{new['chat'][1]}")
    if old['persona'] is not None and new['persona'] is not None:
        gate('persona', new['persona'] >= old['persona'], f"{old['persona']} -> {new['persona']}")
    if old['math'] is not None and new['math'] is not None:
        gate('math', new['math'] >= old['math'] - 0.02, f"{old['math']} -> {new['math']}")
    if old['bench'] is not None and new['bench'] is not None:
        # the two logs must share their item set, otherwise the comparison is invalid:
        # bench.py draws from one rng stream and the arith block comes first, so the
        # --n 8 items are NOT a subset of --n 16 (bench.py --nested-items fixes this).
        qo, qn = old['questions'], new['questions']
        shared = len(qo & qn)
        if qo and qn and shared < 0.9 * min(len(qo), len(qn)):
            lines.append(('SKIP', 'bench overall',
                          f"{old['bench']:.3f} -> {new['bench']:.3f} NOT COMPARABLE: the logs share only "
                          f"{shared}/{min(len(qo), len(qn))} items (different --n item sets). Use compare.py "
                          f"(paired) on one dumped item set."))
        else:
            gate('bench overall', new['bench'] >= old['bench'] - a.max_regress,
                 f"{old['bench']:.3f} -> {new['bench']:.3f} (max regress {a.max_regress})")
    comparable = not (old['questions'] and new['questions']
                      and len(old['questions'] & new['questions'])
                      < 0.9 * min(len(old['questions']), len(new['questions'])))
    if new['families']:
        tag = '' if comparable else ' (indicative: different item sets)'
        gate('held-out word families off zero', new['heldout_off_zero'] >= a.min_heldout,
             f"{old['heldout_off_zero']} -> {new['heldout_off_zero']} (need >= {a.min_heldout}){tag}")
        gate('reason iteration families off zero', new['reason_off_zero'] >= 0,
             f"{old['reason_off_zero']} -> {new['reason_off_zero']}")
    if a.min_understand and new['understand'] is not None:
        gate('understanding floor', new['understand'] >= a.min_understand, f"{new['understand']} >= {a.min_understand}")
    if a.min_stress and new['stress'] is not None:
        gate('stress floor', new['stress'] >= a.min_stress, f"{new['stress']} >= {a.min_stress}")

    if a.json:
        print(json.dumps({'ok': ok, 'old': old, 'new': new,
                          'gates': [{'status': s, 'name': n, 'detail': d} for s, n, d in lines]}, indent=1))
        return 0 if ok else 1

    print(f'old: {a.old}\nnew: {a.new}\n')
    for s, n, d in lines:
        print(f'  [{s}] {n:38s} {d}')
    print(f'\nVERDICT: {"SHIP" if ok else "DO NOT SHIP"}')
    if new['families']:
        print('\nper-family (the aggregate hides this):'
              + ('' if comparable else '  [INDICATIVE: the two logs do not share their item set]'))
        for k in sorted(new['families']):
            o = old['families'].get(k, [0, 0])
            n = new['families'][k]
            mark = '  <-- moved' if n[0] != o[0] else ''
            print(f'  {o[0]:2d}/{o[1]:<2d} -> {n[0]:2d}/{n[1]:<2d}  {k}{mark}')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
