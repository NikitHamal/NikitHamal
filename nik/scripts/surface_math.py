"""Surface robustness of arithmetic (Claude, 2026-10-24; owner: "isn't it the model's understanding problem too?").

The owner's `5674674+3644849 kati hunxa?` was read as a story (/chat now spaces operators, but that is a patch on the
input, not understanding). This asks the SAME sum in many surfaces and counts how often the model gets it right:

    plain      `a + b kati hunchha?`            (the training shape)
    nospace    `a+b kati hunxa?`
    words      `a ra b jodda kati?` / `a ma b thapda?`
    english    `what is a plus b?`
    xa         `a + b kati hunxa?`
    tight-q    `a+b=?`
    padded     `kati hunchha a + b ?` (question word first)

Problems are fresh random 3-7 digit sums / differences (seeded), never eval items. Greedy, no pencil, no input
normalisation: the raw model. A surface where accuracy collapses is a place the model never learned the skill, only
the shape; a robust model scores the same on every row.

    python nik/scripts/surface_math.py --model a.bin [b.bin ...] --n 24 --out /tmp/surface_math.json
"""
import argparse
import json
import os
import random
import re
import sys

import torch

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path[:0] = [ROOT]
from export import load_exported          # noqa: E402
from model import generate_multi          # noqa: E402
from prepare import NIK, render_chat      # noqa: E402
from tokenizer import Tokenizer           # noqa: E402

SURF = {
    'plain': lambda a, o, b: f'{a} {o} {b} kati hunchha?',
    'nospace': lambda a, o, b: f'{a}{o}{b} kati hunxa?',
    'words': lambda a, o, b: f'{a} ra {b} jodda kati?' if o == '+' else f'{a} bata {b} ghataunda kati?',
    'english': lambda a, o, b: f'what is {a} {"plus" if o == "+" else "minus"} {b}?',
    'xa': lambda a, o, b: f'{a} {o} {b} kati hunxa?',
    'tight-q': lambda a, o, b: f'{a}{o}{b}=?',
    'q-first': lambda a, o, b: f'kati hunchha {a} {o} {b}?',
}


def last_num(t):
    m = re.findall(r'-?\d+', t.replace(',', ''))
    return m[-1] if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', nargs='+', required=True); ap.add_argument('--n', type=int, default=24)
    ap.add_argument('--seed', type=int, default=99); ap.add_argument('--out', default='')
    a = ap.parse_args()
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    tok = Tokenizer.load(os.path.join(ROOT, 'web', 'model', 'tokenizer.json'))
    R = random.Random(a.seed)
    probs = []
    for i in range(a.n):
        k1, k2 = R.randint(3, 7), R.randint(3, 7)
        x, y = R.randint(10 ** (k1 - 1), 10 ** k1 - 1), R.randint(10 ** (k2 - 1), 10 ** k2 - 1)
        o = '+' if i % 3 else '-'
        if o == '-' and y > x:
            x, y = y, x
        probs.append((x, o, y, x + y if o == '+' else x - y))
    res = {}
    for path in a.model:
        model = load_exported(path).to(dev).eval()
        rows = {}
        for sname, f in SURF.items():
            prompts = []
            for x, o, y, _ in probs:
                ids, _ = render_chat(tok, [{'role': 'user', 'content': f(x, o, y).lower()}])
                prompts.append(ids[:-1] + [NIK])
            outs = generate_multi(model, prompts, n_per_prompt=1, max_new=300, temperature=0.0)
            ok = 0
            for (x, o, y, g), r in zip(probs, outs):
                t = tok.decode(r[0][0]).split('<|/think|>')[-1]
                ok += last_num(t) == str(g)
            rows[sname] = ok
        res[os.path.basename(path)] = rows
        print(f'{os.path.basename(path):24s} ' + '  '.join(f'{k} {v}/{a.n}' for k, v in rows.items()), flush=True)
    if a.out:
        json.dump({'n': a.n, 'surfaces': list(SURF), 'models': res}, open(a.out, 'w'), indent=1)


if __name__ == '__main__':
    main()
