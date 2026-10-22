"""Add generator rows to an existing SFT mix by TOKEN share and tokenize it (Claude, 2026-10-22).

    python nik/scripts/add_rows.py --data data_en --base sfte --name sftl --gen longctx=0.30 --seed 5
`--gen module=share` (module in nik/data/teacher with sample(R)); share = fraction of the final mix's tokens.
"""
import argparse
import importlib
import json
import os
import random
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path[:0] = [os.path.join(ROOT, 'nik'), os.path.join(ROOT, 'nik', 'data', 'teacher'), os.path.join(ROOT, 'nik', 'scripts')]
from prepare import render_chat  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default='data'); ap.add_argument('--base', required=True); ap.add_argument('--name', required=True)
    ap.add_argument('--gen', action='append', default=[]); ap.add_argument('--seed', type=int, default=5)
    ap.add_argument('--drop', action='append', default=[], help='drop base rows whose cat starts with this (repeatable)')
    a = ap.parse_args()
    R = random.Random(a.seed)
    tok = Tokenizer.load(os.path.join(ROOT, 'nik', 'web', 'model', 'tokenizer.json'))
    base = open(os.path.join(a.data, f'{a.base}.jsonl')).readlines()
    if a.drop:
        n0 = len(base)
        base = [l for l in base if not json.loads(l).get('cat', '').startswith(tuple(a.drop))]
        print(f'dropped {n0 - len(base):,} base rows with cat {a.drop}', flush=True)
    sample = R.sample(base, min(3000, len(base)))
    avg = sum(len(render_chat(tok, json.loads(l)['messages'])[0]) for l in sample) / len(sample)
    base_tok = avg * len(base)
    rows = list(base)
    for g in a.gen:
        mod, share = g.split('='); share = float(share)
        gen = importlib.import_module(mod)
        want = base_tok * share / (1 - share); got = 0; n = 0
        while got < want:
            r = gen.sample(R); got += len(render_chat(tok, r['messages'])[0]); n += 1
            rows.append(json.dumps(r, ensure_ascii=False) + '\n')
        print(f'{mod}: {n:,} rows, {got / 1e6:.1f}M tokens (target {share:.0%} of the mix)', flush=True)
    import make_sft2   # the same held-out guard as every mix: no eval / stress / trap / NikBench-RW prompt is trained on
    rows = make_sft2._drop_eval_prompts(rows, os.path.join(ROOT, 'nik'))
    R.shuffle(rows)
    with open(os.path.join(a.data, f'{a.name}.jsonl'), 'w') as f:
        f.writelines(rows)
    subprocess.run([sys.executable, os.path.join(ROOT, 'nik', 'prepare.py'), '--data', a.data, '--sft-only', '--sft-name', a.name,
                    '--tok', os.path.join(ROOT, 'nik', 'web', 'model', 'tokenizer.json')], check=True)


if __name__ == '__main__':
    main()
