"""Prompts for nik/web/selfdistill.mjs (Claude, 2026-10-22): a first turn with a known numeric answer (the teacher mix:
arithmetic, money, word problems) and a follow-up that points back at the answer. The live model answers both; only
conversations where both answers state the gold number are kept.
    python nik/scripts/followup_prompts.py --n 24000 --seed 61 --out /tmp/claude/sd/prompts.jsonl
The owner's cases (nik/tests/chat/owner_cases.json) and every held-out chat set are never emitted.
"""
import argparse
import glob
import json
import os
import random
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path[:0] = [os.path.join(ROOT, 'nik', 'data', 'teacher')]
import build  # noqa: E402
import followup  # noqa: E402

FOLLOW = followup.ASK_NUM + followup.SURE + ['jawaf feri bhana ta.', 'kati aayo bhannus ta?', 'ani jawaf kati?',
                                              'feri ek choti bhannus, kati?', 'pakka ho ni?', 'thik ho?']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=24000); ap.add_argument('--seed', type=int, default=61); ap.add_argument('--out', required=True)
    a = ap.parse_args()
    R = random.Random(a.seed)
    norm = lambda t: ' '.join(t.lower().split()).strip(' ?!.')
    held = set()
    for f in glob.glob(os.path.join(ROOT, 'nik', 'tests', 'chat', '*.json')):
        for c in json.load(open(f)):
            if f.endswith('_heldout.json') or os.path.basename(f) == 'owner_cases.json':
                held |= {norm(t) for t in c['turns']}
    rows, seen = [], set()
    while len(rows) < a.n:
        r = build.one(R)
        m = r['messages']
        g = r.get('gold')
        if len(m) != 2 or m[0]['role'] != 'user' or g is None or followup._int(g) is None:
            continue
        q = m[0]['content']
        if len(q) > 240 or norm(q) in held or norm(q) in seen:
            continue
        seen.add(norm(q))
        rows.append({'first': q, 'gold': str(g), 'follow': R.choice(FOLLOW)})
    with open(a.out, 'w') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f'{len(rows)} prompts -> {a.out}')


if __name__ == '__main__':
    main()
