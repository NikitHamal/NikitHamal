"""Turn the teacher mix's family ratio into an explicit knob, without re-generating.

`build.py` bakes in 16% understanding + 14% reading + 10% skills. Whether v4f's
understanding drop is a *dose* problem is answered by resampling the same rows to a
different family share and re-training - same content, same seeds, only the ratio moves.

Shares are measured in **tokens, not rows**: rows differ ~3x in length, and a row share
that looks like 12% can already be 30% of the gradient (see nik/docs/LEARNINGS.md).

    python nik/data/resample_mix.py in.jsonl out.jsonl --und 0.30 --seed 3
"""
import argparse
import json
import random
import sys
from collections import Counter

UND_PREFIX = ('understand-', 'skill-', 'read-')


def cat_of(row):
    c = row.get('cat') or ''
    if c.startswith(UND_PREFIX):
        return 'und'
    if c.startswith('math-'):
        return 'math'
    if c.startswith('reason-'):
        return 'reason'
    if c.startswith('explain'):
        return 'explain'
    return 'other'


def row_len(row):
    return sum(len(m.get('content', '') or '') + len(m.get('think') or '')
               for m in row.get('messages', []))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--und', type=float, default=None, help='target token share for understand/skill/read')
    ap.add_argument('--math', type=float, default=None, help='target token share for math-*')
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    if a.und is None and a.math is None:
        raise SystemExit('nothing to do: pass --und and/or --math')

    rows = [json.loads(ln) for ln in open(a.src, encoding='utf-8') if ln.strip()]
    groups = {}
    for r in rows:
        groups.setdefault(cat_of(r), []).append(r)
    toks = {g: sum(row_len(r) for r in rs) for g, rs in groups.items()}
    total = sum(toks.values()) or 1
    before = {g: 100.0 * t / total for g, t in toks.items()}

    R = random.Random(a.seed)
    out = {g: list(rs) for g, rs in groups.items()}
    targets = {'und': a.und, 'math': a.math}
    for g, share in targets.items():
        if share is None or g not in groups or not groups[g]:
            continue
        others = total - toks[g]
        want = others * share / max(1e-9, (1.0 - share))
        keep = max(1, int(round(len(groups[g]) * want / toks[g])))
        out[g] = [R.choice(groups[g]) for _ in range(keep)]
        toks[g] = sum(row_len(r) for r in out[g])

    merged = [r for rs in out.values() for r in rs]
    R.shuffle(merged)
    newtotal = sum(row_len(r) for r in merged) or 1
    after = Counter()
    for r in merged:
        after[cat_of(r)] += row_len(r)

    print('rows %d -> %d | tokens %.1fM -> %.1fM' % (len(rows), len(merged), total / 1e6, newtotal / 1e6))
    for g in sorted(set(list(before) + list(after))):
        print('  %-7s %5.1f%% -> %5.1f%% of tokens' % (g, before.get(g, 0.0), 100.0 * after.get(g, 0) / newtotal))
    if a.dry_run:
        print('dry run, nothing written')
        return
    with open(a.dst, 'w', encoding='utf-8') as h:
        for r in merged:
            h.write(json.dumps(r, ensure_ascii=False) + '\n')
    print('wrote', a.dst)


if __name__ == '__main__':
    main()
