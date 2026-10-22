"""Build an SFT mix with a configurable share of CHAIN data (Local-C, issue #9).

Why: the ladder probe (nik/scripts/word_procedure_probe.py --ladder) shows the live
model cannot compose two steps - L2 = 0/12 in all four shipped models - and the
scratchpads show it inventing operands.  The prediction is that the medicine is
*chain* data (one complete 1-step equation per line, operands copied from the
question, the result carried forward), and that the amount matters.

sft7 (the live model's mix) has 0% chains; sft8 (the next mix) has 5% frame + 3%
iter.  This script builds any share in between or beyond, from the same base mix, so
the *only* difference between two runs is the chain share:

    python nik/scripts/chain_mix.py --base sft7 --name chain30 --frame 0.20 --iter 0.10
    python nik/scripts/chain_mix.py --base sft7 --name chain0  --frame 0     --iter 0

The base mix's own chain rows (cat 'math-word-frame' / 'reason-iter') are removed
first, so the share below is the real one.  Then the mix is tokenized exactly like
make_sft2.py does (prepare.py --sft-only).
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
TEACHER = os.path.join(ROOT, 'data', 'teacher')
if not os.path.isdir(TEACHER):
    TEACHER = os.path.join(ROOT, 'nik', 'data', 'teacher')
sys.path.insert(0, TEACHER)

CHAIN_CATS = ('math-word-frame', 'reason-iter', 'math-reduce')


def eval_prompts():
    """The prompts the *gates* use, so the mix can stop training on them.

    @Local-A (issue #9) found that the gold rows include 8 writing/chat strings that
    the stress suite (and chat_check) also use ("tihar ... message lekha", "haiku",
    "dhanyabad", ...).  Both the live model and every candidate are therefore
    *inflated* on those items - the gate is partly measuring memorisation.  A mix that
    trains on an evaluation prompt is not an honest gate, so the rows that repeat a
    gate prompt are dropped here.

    Returns the normalised set of gate prompts (stress + chat_check + the held-out
    understanding probes).
    """
    import importlib.util
    root = ROOT
    texts = set()

    def grab(path, attr):
        spec = importlib.util.spec_from_file_location('m_' + os.path.basename(path)[:-3], path)
        mod = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(mod)
        except Exception:
            return
        for v in getattr(mod, attr, []) or []:
            if isinstance(v, str):
                texts.add(v)
            elif isinstance(v, (list, tuple)):
                for x in v:
                    if isinstance(x, str):
                        texts.add(x)
                    elif isinstance(x, (list, tuple)) and x and isinstance(x[0], str):
                        texts.add(x[0])
                        for y in x[1:]:
                            if isinstance(y, dict) and isinstance(y.get('content'), str):
                                texts.add(y['content'])

    grab(os.path.join(root, 'nik', 'stress.py'), 'P')
    grab(os.path.join(root, 'nik', 'chat_check.py'), 'MSGS')
    return {norm(t) for t in texts if t.strip()}


def persona_rows(n, seed):
    """Extra identity/persona rows (nik/data/gen_sft.py).

    Why (issue #9): the mix keeps only 12-20% of the v1 chat file, so the persona
    rows are ~1,300 out of ~880,000 (0.15%).  With the grounded-role family added at
    12% the share halves again, and the persona gate (which is strict: 1.0) drops to
    0.857.  The persona behaviour is *fragile because it is rare*, not because it is
    hard - so the fix is to put the rows back in.
    """
    import importlib.util
    spec = importlib.util.spec_from_file_location('gen_sft_mod',
                                                  os.path.join(ROOT, 'nik', 'data', 'gen_sft.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    R = random.Random(seed)
    gens = [mod.identity, mod.nikit]
    rows, seen = [], set()
    tries = 0
    while len(rows) < n and tries < n * 20:
        tries += 1
        g = gens[R.randrange(len(gens))]
        d = g()
        for m in d['messages']:
            if m['role'] == 'user':
                m['content'] = mod.chat_noise(m['content'])
        key = d['messages'][0]['content']
        if key in seen:
            continue
        seen.add(key)
        rows.append({'cat': d.get('cat', 'identity'), 'gold': None, 'messages': d['messages']})
    return rows


def norm(s):
    """lower, drop the punctuation and collapse the spaces - the comparison key"""
    s = s.lower().strip()
    s = re.sub(r'[\"\'\u2018\u2019\u201c\u201d\u0964\u0965,.!?;:\-]', ' ', s)
    return ' '.join(s.split())


def row_prompt(d):
    """the user turn of a mix row"""
    for m in d.get('messages', []) or []:
        if m.get('role') == 'user':
            return m.get('content', '')
    return ''



def chain_rows(n_frame, n_iter, n_roles, seed, symbolic=True, n_reduce=0):
    import frame
    import iter as itgen
    R = random.Random(seed)
    rows = []
    for _ in range(n_frame):
        d = frame.sample(R)
        rows.append({'cat': d['cat'], 'gold': d['gold'], 'messages': d['messages']})
    for _ in range(n_iter):
        d = itgen.make(R)
        rows.append({'cat': d['cat'], 'gold': d['gold'], 'messages': d['messages']})
    for _ in range(n_roles):
        import roles
        d = roles.sample(R)
        rows.append({'cat': d['cat'], 'gold': d['gold'], 'messages': d['messages']})
    for _ in range(n_reduce):
        import reduce as red
        d = red.sample(R)
        rows.append({'cat': d.get('cat', 'math-reduce'), 'gold': d.get('gold'),
                     'messages': d['messages']})
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default='data')
    ap.add_argument('--base', required=True, help='the base mix name (data/<base>.jsonl)')
    ap.add_argument('--name', required=True, help='output mix name')
    ap.add_argument('--frame', type=float, default=0.20, help='share of rows that are frame chains')
    ap.add_argument('--iter', type=float, default=0.10, help='share of rows that are iteration chains')
    ap.add_argument('--roles', type=float, default=0.0,
                    help='share of rows that are grounded-role rows (roles.py): bind the '
                         'numbers in a text to their roles, then compute (issue #9)')
    ap.add_argument('--seed', type=int, default=77)
    ap.add_argument('--reduce', type=float, default=0.0,
                    help="share of rows that are reduce.py rows (Sky's symbolic two-step: "
                         "v4f + 40%% of them took ladder L2 from 0/12 to 12/12, but that dose "
                         "crowded out the iteration rows and cost the reason family)")
    ap.add_argument('--symbolic', type=int, default=1,
                    help='1: the symbolic two-step gets 25% of the role rows; 0: it does not')
    ap.add_argument('--persona', type=int, default=0,
                    help='extra identity/persona rows to add (the mix keeps only ~0.15% of them)')
    ap.add_argument('--keep-eval-prompts', action='store_true',
                    help='do not drop the rows that repeat a gate prompt (stress / chat_check)')
    ap.add_argument('--no-tokenize', action='store_true')
    a = ap.parse_args()

    base_path = os.path.join(a.data, f'{a.base}.jsonl')
    if not os.path.exists(base_path):
        raise SystemExit(f'{base_path} not found - build the base mix first (make_sft2.py)')
    rows, dropped = [], 0
    for line in open(base_path, encoding='utf8'):
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        if (d.get('cat') or '') in CHAIN_CATS:
            dropped += 1
            continue
        rows.append(line)
    n_base = len(rows)
    if a.persona:
        extra_persona = persona_rows(a.persona, a.seed + 5)
        banned0 = eval_prompts()
        extra_persona = [r for r in extra_persona if norm(row_prompt(r)) not in banned0]
        for r in extra_persona:
            rows.append(json.dumps(r, ensure_ascii=False))
        print(f'+ {len(extra_persona)} extra persona/identity rows', flush=True)
    if not a.keep_eval_prompts:
        banned = eval_prompts()
        keep = []
        dropped_eval = 0
        for line in rows:
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                keep.append(line)
                continue
            if norm(row_prompt(d)) in banned:
                dropped_eval += 1
                continue
            keep.append(line)
        if dropped_eval:
            print(f'dropped {dropped_eval} rows whose user turn is a gate prompt '
                  f'(stress / chat_check / held-out probes)', flush=True)
        rows = keep
        n_base = len(rows)
    share = a.frame + a.iter + a.roles + a.reduce
    total = n_base + int(round(share / max(1e-9, 1 - share) * n_base))
    n_frame = int(round(a.frame * total))
    n_iter = int(round(a.iter * total))
    n_roles = int(round(a.roles * total))
    n_reduce = int(round(a.reduce * total))
    os.environ['ROLES_SYMBOLIC'] = '1' if a.symbolic else '0'
    extra = chain_rows(n_frame, n_iter, n_roles, a.seed, a.symbolic, n_reduce)
    for e in extra:
        rows.append(json.dumps(e, ensure_ascii=False))
    random.Random(a.seed + 1).shuffle(rows)
    out_path = os.path.join(a.data, f'{a.name}.jsonl')
    with open(out_path, 'w', encoding='utf8') as f:
        f.write('\n'.join(rows) + '\n')
    print(f'base {a.base}: {n_base} rows ({dropped} chain rows removed) '
          f'+ {n_frame} frame + {n_iter} iter + {n_roles} roles + {n_reduce} reduce '
          f'= {len(rows)} -> {out_path}', flush=True)
    print(f'chain share: {100 * (n_frame + n_iter) / max(1, len(rows)):.1f}% of rows, '
          f'roles share: {100 * n_roles / max(1, len(rows)):.1f}%', flush=True)
    if not a.no_tokenize:
        pkg = os.path.join(ROOT, 'nik')
        if not os.path.isdir(pkg):
            pkg = ROOT
        subprocess.run([sys.executable, os.path.join(pkg, 'prepare.py'), '--data', a.data,
                        '--tok', os.path.join(pkg, 'web/model/tokenizer.json'),
                        '--sft-only', '--sft-name', a.name], check=True)


if __name__ == '__main__':
    main()
