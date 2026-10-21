"""Build a small POLISH mix: the identity/persona/chat rows, plus a slice of the mix.

Why (Local-C, issue #9): the full mix is ~880k rows and the identity/persona rows are
~1,300 of them (0.15%) - the persona behaviour is fragile because it is *rare*, and
the persona gate is strict (1.0).  Two ways to fix it: put the rows back in the full
mix (chain_mix.py --persona), or do a **short second stage** on a small mix that is
mostly those rows - which is what @Local-A's la-f3b does (1.5 min, lr 1e-4, 20%
reading / 10% identity / 45% chat / 25% math) and it works: v4f3 + that stage is
+4.2pp on the bench with understanding equal to the live model.

This script builds that stage's mix: a slice of the base mix (so the maths and the
reasoning do not drift) plus the persona/identity rows and the chat rows, with the
gate prompts filtered out (nik/scripts/chain_mix.py's eval_prompts()).

    python nik/scripts/polish_mix.py --data data --base sft13 --name sft22 \
        --persona 20000 --chat 30000 --share 0.25
"""
from __future__ import annotations

import argparse
import json
import os
import random
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
if not os.path.isdir(os.path.join(ROOT, 'nik', 'data', 'teacher')):
    ROOT = os.path.dirname(ROOT)
sys.path.insert(0, os.path.join(ROOT, 'nik', 'scripts'))

from chain_mix import eval_prompts, norm, persona_rows, row_prompt  # noqa: E402


def persona_rows_aug(n, seed):
    """Identity/persona rows, *augmented* so there are enough distinct ones.

    The identity facts are a fixed set (~100 hand-written answers), so asking for 40k
    rows of them without the augmentation never terminates and returns ~2.4k.  The
    augmentation (data/teacher/augment.py, the same one make_sft2.py uses) varies the
    surface, which is exactly what the persona gate needs: the probe asks
    "nikit hamal ko ho?" and the model has to answer it *in its own words* and still
    contain the facts.
    """
    import importlib.util
    spec = importlib.util.spec_from_file_location('gen_sft_mod',
                                                  os.path.join(ROOT, 'nik', 'data', 'gen_sft.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    sys.path.insert(0, os.path.join(ROOT, 'nik', 'data', 'teacher'))
    from augment import augment_example
    R = random.Random(seed)
    rows, seen = [], set()
    tries = 0
    while len(rows) < n and tries < n * 10:
        tries += 1
        g = mod.identity if R.random() < 0.5 else mod.nikit
        e = augment_example(g(), R, 0.5)
        key = e['messages'][0]['content']
        if key in seen:
            continue
        seen.add(key)
        rows.append({'cat': e.get('cat', 'identity'), 'gold': e.get('gold'),
                     'messages': e['messages']})
    return rows


def shape_rows(n, seed):
    """The *shapes* - the rows that pay the forgetting tax back.

    Why (issue #9): the control arm shows that a plain second stage on a full mix
    costs understanding (19/26 -> 16/26) and the bench (v4f -> v4m: 72.2 -> 68.8),
    while the *named data shapes* (the money scene, the grounded-role family) pay it
    back.  So a polish stage must be shape-heavy, not mix-heavy: these rows are the
    money scene (frame.py), the grounded-role family (roles.py) and the iteration
    chains (iter.py).
    """
    import frame
    import roles
    import iter as itgen
    R = random.Random(seed)
    rows = []
    for _ in range(n):
        pick = R.random()
        if pick < 0.5:
            d = roles.sample(R)
        elif pick < 0.85:
            d = frame.sample(R)
        else:
            d = itgen.make(R)
        rows.append({'cat': d['cat'], 'gold': d['gold'], 'messages': d['messages']})
    return rows


def chat_rows(n, seed):
    """everyday-conversation rows (data/teacher/chat.py), leak-filtered.

    The generators have a *fixed* set of facts, so the variety has to come from the
    augmentation (data/teacher/augment.py) - exactly what make_sft2.py does.  Without
    the augmentation the distinct-prompt count is in the hundreds and asking for 50k
    rows never terminates.
    """
    import importlib.util
    spec = importlib.util.spec_from_file_location('chat_mod',
                                                  os.path.join(ROOT, 'nik', 'data', 'teacher', 'chat.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    sys.path.insert(0, os.path.join(ROOT, 'nik', 'data', 'teacher'))
    from augment import augment_example
    R = random.Random(seed)
    rows, seen = [], set()
    tries = 0
    while len(rows) < n and tries < n * 10:
        tries += 1
        e = augment_example(mod.sample(R), R, 0.5)
        key = e['messages'][0]['content']
        if key in seen:
            continue
        seen.add(key)
        rows.append({'cat': e.get('kind', 'chat'), 'gold': e.get('gold'),
                     'messages': e['messages']})
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default='data')
    ap.add_argument('--base', required=True)
    ap.add_argument('--name', required=True)
    ap.add_argument('--persona', type=int, default=20000)
    ap.add_argument('--chat', type=int, default=30000)
    ap.add_argument('--shapes', type=int, default=0,
                    help='rows of the named data shapes (the money scene, the role '
                         'family, the iteration chains) - a polish stage must be '
                         'shape-heavy, or it pays the forgetting tax again')
    ap.add_argument('--share', type=float, default=0.25, help='the share of the base mix to keep')
    ap.add_argument('--seed', type=int, default=77)
    a = ap.parse_args()
    banned = eval_prompts()
    R = random.Random(a.seed)

    base = []
    for line in open(os.path.join(a.data, f'{a.base}.jsonl'), encoding='utf8'):
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        if norm(row_prompt(d)) in banned:
            continue
        base.append(line)
    keep = [x for x in base if R.random() < a.share]
    extra = persona_rows_aug(a.persona, a.seed + 5)
    extra = [r for r in extra if norm(row_prompt(r)) not in banned]
    print(f'  persona rows: {len(extra)} of {a.persona} requested '
          f'(the identity facts are a fixed set - the surface variety comes from the '
          f'other generators)', flush=True)
    for r in extra:
        keep.append(json.dumps(r, ensure_ascii=False))
    if a.shapes:
        sh = shape_rows(a.shapes, a.seed + 13)
        sh = [r for r in sh if norm(row_prompt(r)) not in banned]
        for r in sh:
            keep.append(json.dumps(r, ensure_ascii=False))
        print(f'+ {len(sh)} shape rows', flush=True)
    cr = chat_rows(a.chat, a.seed + 9)
    cr = [r for r in cr if norm(row_prompt(r)) not in banned]
    for r in cr:
        keep.append(json.dumps(r, ensure_ascii=False))
    R.shuffle(keep)
    out = os.path.join(a.data, f'{a.name}.jsonl')
    with open(out, 'w', encoding='utf8') as f:
        f.write('\n'.join(keep) + '\n')
    print(f'polish mix {a.name}: {len(keep)} rows '
          f'({len(keep) - len(base) and ""}{len(extra)} persona, {len(cr)} chat, '
          f'{sum(1 for x in keep if x not in set(extra and [] or [])) and ""}base slice)', flush=True)
    print(f'  base {a.base}: {len(base)} -> kept {a.share:.0%}, total {len(keep)}', flush=True)
    pkg = os.path.join(ROOT, 'nik')
    if not os.path.isdir(pkg):
        pkg = ROOT
    subprocess.run([sys.executable, os.path.join(pkg, 'prepare.py'), '--data', a.data,
                    '--tok', os.path.join(pkg, 'web/model/tokenizer.json'),
                    '--sft-only', '--sft-name', a.name], check=True)


if __name__ == '__main__':
    main()
