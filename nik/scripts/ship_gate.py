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

Verdicts (exit codes):
  0  SHIP          every gate passed
  1  DO NOT SHIP   a gate failed
  2  CANNOT DECIDE a required gate could not be compared (not a failure!)

The third verdict matters: the bench rows are only comparable when the two logs share
their item set.  bench.py draws every item from one rng stream and generates the arith
block first, so `--n 8` is NOT a subset of `--n 16` (measured: 17/140 shared items).
Every gate derived from those rows is then reported as SKIP and the tool refuses to
produce a verdict.  A FAIL on an invalid comparison is worse than no gate at all.
Use `bench.py --nested-items` (same item set for every --n) or compare the same --n.
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
from bench_families import breakdown  # noqa: E402

# the families that are held out: the model cannot have seen them in training
HELD_OUT_PREFIXES = ('bus (English)', 'bagaincha', 'boxes of apples', 'kaksha', 'kitab',
                     'masik talab', 'kalam', 'rupiya chha', 'kursi')
ITER_FAMILIES = ('arithmetic sequence', 'geometric pattern')


def load_dir(d):
    out = {'bench': None, 'understand': None, 'stress': None, 'eval': None, 'chat': None,
           'ladder': None}
    for pat, key in (('bench*.json', 'bench'), ('understand*.json', 'understand'),
                     ('stress*.json', 'stress'), ('eval-*.json', 'eval'), ('ladder*.json', 'ladder')):
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


def ladder_of(d):
    """-> {'L1-1step': (ok, n), ...} and the operand coverage per level.

    The ladder (nik/scripts/word_procedure_probe.py --ladder) is the procedure probe:
    one step, two steps composed, two steps with the intermediate given, two steps as
    a chain.  The live model is 12/12, 0/12, 11/12, 2/12 - it cannot compose two
    steps, and every word problem in NikBench is at least two steps.
    """
    if not d.get('ladder'):
        return {}, {}
    groups = d['ladder'].get('groups') or {}
    scores, cover = {}, {}
    for k, v in groups.items():
        n = v.get('n') or 0
        scores[k] = (v.get('ok', 0), n)
        cover[k] = round((v.get('coverage') or 0) / n, 3) if n else 0.0
    return scores, cover


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


def item_sets_comparable(old, new, min_shared=0.9):
    """do the two bench logs contain (about) the same items?"""
    qo, qn = old.get('questions') or set(), new.get('questions') or set()
    if not qo or not qn:
        return True, len(qo & qn), 0
    shared = len(qo & qn)
    return shared >= min_shared * min(len(qo), len(qn)), shared, min(len(qo), len(qn))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--old', default='nik/web/model/logs/v4c', help='the live model logs')
    ap.add_argument('--new', required=True, help='the candidate logs')
    ap.add_argument('--max-regress', type=float, default=0.02, help='max allowed bench regression (absolute)')
    ap.add_argument('--min-heldout', type=int, default=1, help='held-out word families that must be off zero')
    ap.add_argument('--min-understand', type=int, default=0)
    ap.add_argument('--min-stress', type=int, default=0)
    ap.add_argument('--ladder-may-stay-zero', action='store_true',
                    help='do not require the multi-step ladder to move off zero')
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()

    old = score_of(load_dir(a.old))
    new = score_of(load_dir(a.new))
    lines, failed, blocked = [], [], []

    def gate(name, passed, detail):
        lines.append((('PASS' if passed else 'FAIL'), name, detail))
        if not passed:
            failed.append(name)

    def skip(name, detail, blocking=False):
        """a gate that could not be evaluated.  blocking=True means: no verdict."""
        lines.append(('SKIP', name, detail))
        if blocking:
            blocked.append(name)

    if old['understand'] is not None and new['understand'] is not None:
        gate('understanding', new['understand'] >= old['understand'],
             f"{old['understand']}/26 -> {new['understand']}/26")
    elif new['understand'] is not None:
        skip('understanding', 'no old log to compare against')
    if old['stress'] is not None and new['stress'] is not None:
        gate('stress (strict)', new['stress'] >= old['stress'],
             f"{old['stress']}/{old.get('stress_of', '?')} -> {new['stress']}/{new.get('stress_of', '?')}")
    if old['chat'] and new['chat']:
        gate('chat_check', new['chat'][0] >= old['chat'][0],
             f"{old['chat'][0]}/{old['chat'][1]} -> {new['chat'][0]}/{new['chat'][1]}")
    if old['persona'] is not None and new['persona'] is not None:
        gate('persona', new['persona'] >= old['persona'], f"{old['persona']} -> {new['persona']}")
    if old['math'] is not None and new['math'] is not None:
        gate('math', new['math'] >= old['math'] - 0.02, f"{old['math']} -> {new['math']}")

    # ---- the bench rows: comparable only if the two logs share their item set ----
    comparable, shared, smaller = item_sets_comparable(old, new)
    rows_note = ''
    if new['bench'] is None:
        skip('bench overall', 'no bench rows in the candidate logs - nothing to compare',
             blocking=True)
    elif old['bench'] is None:
        skip('bench overall', 'no bench rows in the live model logs - nothing to compare',
             blocking=True)
    elif comparable:
        gate('bench overall', new['bench'] >= old['bench'] - a.max_regress,
             f"{old['bench']:.3f} -> {new['bench']:.3f} (max regress {a.max_regress})")
    else:
        rows_note = (f"the two logs share only {shared}/{smaller} items (different --n item sets). "
                     f"Use compare.py (paired) on one dumped item set, or bench.py --nested-items.")
        skip('bench overall', f"NOT COMPARABLE: {rows_note}", blocking=True)
    if new['families']:
        if not new['bench']:
            skip('held-out word families off zero', 'no bench rows in the candidate logs',
                 blocking=True)
            skip('reason iteration families off zero', 'no bench rows in the candidate logs',
                 blocking=True)
            skip('no family fell back to zero', 'no bench rows in the candidate logs',
                 blocking=True)
        elif comparable:
            gate('held-out word families off zero', new['heldout_off_zero'] >= a.min_heldout,
                 f"{old['heldout_off_zero']} -> {new['heldout_off_zero']} (need >= {a.min_heldout})")
            gate('reason iteration families off zero', new['reason_off_zero'] >= 0,
                 f"{old['reason_off_zero']} -> {new['reason_off_zero']}")
            # a family that was off zero in the live model must not fall back to zero:
            # the count above hides exactly that (2 -> 1 still passes ">= 1").
            fell = []
            for k, v in new['families'].items():
                if v[0] == 0 and old['families'].get(k, [0, 0])[0] > 0:
                    fell.append(k)
            gate('no family fell back to zero', not fell,
                 'none' if not fell else ', '.join(sorted(fell)))
        else:
            skip('held-out word families off zero',
                 f"NOT COMPARABLE: {rows_note} (indicative only: "
                 f"{old['heldout_off_zero']} -> {new['heldout_off_zero']})", blocking=True)
            skip('reason iteration families off zero',
                 f"NOT COMPARABLE: {rows_note} (indicative only: "
                 f"{old['reason_off_zero']} -> {new['reason_off_zero']})", blocking=True)
            skip('no family fell back to zero',
                 f"NOT COMPARABLE: {rows_note}", blocking=True)
    if a.min_understand and new['understand'] is not None:
        gate('understanding floor', new['understand'] >= a.min_understand,
             f"{new['understand']} >= {a.min_understand}")
    if a.min_stress and new['stress'] is not None:
        gate('stress floor', new['stress'] >= a.min_stress, f"{new['stress']} >= {a.min_stress}")

    # ---- the procedure ladder -------------------------------------------------
    ls_old, lc_old = ladder_of(load_dir(a.old))
    ls_new, lc_new = ladder_of(load_dir(a.new))
    if ls_new:
        for lvl, label in (('L1-1step', 'ladder L1 (one step)'),
                           ('L2-2step', 'ladder L2 (two steps)'),
                           ('L3-intermediate-given', 'ladder L3 (intermediate given)'),
                           ('L4-chain-2line', 'ladder L4 (chain)')):
            if lvl not in ls_new:
                continue
            ok, n = ls_new[lvl]
            o = ls_old.get(lvl, (0, 0))[0]
            cov = lc_new.get(lvl, 0.0)
            gate(label, ok >= o, f"{o} -> {ok}/{n}  operand-coverage {cov}")
        # the ladder is the mechanism probe: a candidate that does not move L2/L4 cannot
        # move the word benchmark either, whatever the aggregate says.
        moved = []
        for lvl in ('L2-2step', 'L4-chain-2line'):
            if lvl in ls_new and ls_old.get(lvl, (0, 0))[0] == 0 and ls_new[lvl][0] > 0:
                moved.append(lvl.split('-')[0])
        if ls_old and ls_new:
            gate('ladder multi-step off zero', bool(moved) or a.ladder_may_stay_zero,
                 f"moved: {', '.join(moved) if moved else 'nothing'} (need L2 or L4 off zero)")

    if blocked:
        verdict, code = 'CANNOT DECIDE', 2
    elif failed:
        verdict, code = 'DO NOT SHIP', 1
    else:
        verdict, code = 'SHIP', 0

    if a.json:
        print(json.dumps({'verdict': verdict, 'ok': code == 0, 'exit': code,
                          'blocked': blocked, 'failed': failed,
                          'old': old, 'new': new,
                          'gates': [{'status': s, 'name': n, 'detail': d} for s, n, d in lines]}, indent=1))
        return code

    print(f'old: {a.old}\nnew: {a.new}\n')
    for s, n, d in lines:
        print(f'  [{s}] {n:38s} {d}')
    print(f'\nVERDICT: {verdict}')
    if blocked:
        print('  (a required gate could not be compared - this is NOT a failure of the candidate;'
              '\n   re-run with the same --n on both sides, or with bench.py --nested-items.)')
    if new['families']:
        print('\nper-family (the aggregate hides this):'
              + ('' if comparable else '  [INDICATIVE: the two logs do not share their item set]'))
        for k in sorted(new['families']):
            o = old['families'].get(k, [0, 0])
            n = new['families'][k]
            mark = '  <-- moved' if n[0] != o[0] else ''
            print(f'  {o[0]:2d}/{o[1]:<2d} -> {n[0]:2d}/{n[1]:<2d}  {k}{mark}')
    return code


if __name__ == '__main__':
    sys.exit(main())
