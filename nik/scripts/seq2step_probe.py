"""Local-C: the sequential two-step money probe.

The understanding probe that v4f lost is:
    'mero sanga 500 rupiya thiyo. 180 kharcha bhayo. kati baki?'  -> 320
That is a SEQUENTIAL two-step (a - b), not the nested form of my ladder (a - (b x c)).
This measures the sequential form on 10 fresh items (the eval item itself is not
trained on, it is only listed for reference).

    python nik/scripts/seq2step_probe.py --model nik/web/model/nik-0.1.bin
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import torch  # noqa: E402
from export import load_exported  # noqa: E402
from model import NikConfig, NikLM, generate_ar  # noqa: E402
from prepare import render_chat  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402

U = lambda t: {'role': 'user', 'content': t}  # noqa: E731
N = lambda t: {'role': 'nik', 'content': t}   # noqa: E731

# (money, spent) -> what is left.  The first row is the eval probe itself (reference).
CASES = [
    (500, 180), (800, 250), (1200, 450), (350, 120), (2000, 750),
    (640, 220), (950, 300), (1500, 625), (430, 95), (2750, 1000), (760, 340),
]
EVAL_ITEM = 'mero sanga 500 rupiya thiyo. 180 kharcha bhayo. kati baki?'


def question(money, spent):
    return f'mero sanga {money} rupiya thiyo. {spent} kharcha bhayo. kati baki?'


def answer(model, tok, msgs, max_new=160):
    ids, _ = render_chat(tok, msgs + [N('x')])
    cut = len(ids) - 1 - ids[::-1].index(6)
    out = generate_ar(model, ids[:cut + 1], max_new, temperature=0.0)
    return tok.decode(out).split('<|/think|>')[-1].replace('<|end|>', '').strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', default='nik/web/model/nik-0.1.bin')
    ap.add_argument('--out', default=None)
    a = ap.parse_args()
    tok = Tokenizer.load(os.path.join('nik', 'web', 'model', 'tokenizer.json'))
    m = load_exported(a.model)
    m.eval()
    rows, ok = [], 0
    for money, spent in CASES:
        q = question(money, spent)
        gold = money - spent
        ans = answer(m, tok, [U(q)])
        hit = str(gold) in ans.replace(' ', '')
        ok += hit
        rows.append({'q': q, 'gold': gold, 'ans': ans, 'ok': bool(hit),
                     'is_eval_item': q == EVAL_ITEM})
    # a second surface: the same numbers as a bare two-step chain
    chain_ok = 0
    for money, spent in CASES:
        q = f'{money} - {spent} = ?'
        gold = money - spent
        ans = answer(m, tok, [U(q)])
        hit = str(gold) in ans.replace(' ', '')
        chain_ok += hit
        rows.append({'q': q, 'gold': gold, 'ans': ans, 'ok': bool(hit), 'surface': 'chain'})
    out = {'model': a.model, 'seq2step_ok': ok, 'seq2step_n': len(CASES),
           'chain_ok': chain_ok, 'chain_n': len(CASES), 'rows': rows}
    print(json.dumps({k: v for k, v in out.items() if k != 'rows'}, ensure_ascii=False))
    for r in rows:
        print(('  OK  ' if r['ok'] else '  FAIL'), r['q'], '->', r['ans'][:90].replace('\n', ' '))
    if a.out:
        with open(a.out, 'w', encoding='utf8') as f:
            json.dump(out, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
