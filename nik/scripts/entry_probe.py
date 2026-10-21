"""Does the arithmetic *entry point* depend on the prompt's surface? (Local-A)

Local-C's p11/p12 diagnosis: the model still owns the column routine (its own samples show
it working) but on the bench's exact prompt it opens with a comparison ("66 ra 47 tulana
garau") instead of the routine. Their probe shows the same model answering correctly with a
dummy assistant turn inserted.

That implies the entry point is surface-conditioned. If the *live* model already flips the
same way, then the mix did not create the fragility - it inherited it - and the fix is to
train the bench-shaped entry, not to remove one family from the mix. This measures it on
one model, greedy, CPU/GPU, ~50 generations.

    python nik/scripts/entry_probe.py --model nik/web/model/nik-0.1.bin
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from export import load_exported  # noqa: E402
from model import generate_ar  # noqa: E402
from prepare import render_chat  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402

NUMS = re.compile(r'-?\d+(?:\.\d+)?')

CASES = [((66, 47), '+'), ((38, 26), '+'), ((345, 278), '+'), ((84, 19), '-'), ((512, 147), '-'),
         ((9, 12), '*')]


def surfaces(a, b, op):
    sym = {'+': '+', '-': '-', '*': 'x'}[op]
    bare = '%d %s %d kati?' % (a, sym, b)
    if op == '+':
        verb = 'jodnus'
    elif op == '-':
        verb = 'ghatnus'
    else:
        verb = 'gunnus'
    return [
        ('bare', [], bare),
        ('verb', [], '%s %d ra %d' % (verb, a, b)),
        ('chatty', [], '%d ra %d jodda kati hunchha?' % (a, b) if op == '+' else '%d %s %d kati hunchha?' % (a, sym, b)),
        ('dummy-turn', [{'role': 'nik', 'content': 'thik chha.'}], '%s %d ra %d' % (verb, a, b)),
        ('lead-user', [{'role': 'user', 'content': 'euta hisab sodhna man chha.'},
                       {'role': 'nik', 'content': 'sodhnus.'}], '%s %d ra %d' % (verb, a, b)),
        ('bench-like', [], '%d %s %d' % (a, sym, b)),
    ]


def answer(model, tok, msgs, max_new=120):
    ids, _ = render_chat(tok, msgs + [{'role': 'nik', 'content': 'x'}])
    cut = len(ids) - 1 - ids[::-1].index(6)
    out = generate_ar(model, ids[:cut + 1], max_new, temperature=0.0)
    text = tok.decode(out).split('<|/think|>')[-1].replace('<|end|>', '').strip()
    return text


def last_int(text):
    found = NUMS.findall(text.replace(',', ''))
    return int(float(found[-1])) if found else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--out', default='')
    a = ap.parse_args()
    import torch
    torch.set_grad_enabled(False)
    tok = Tokenizer.load(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                      'web/model/tokenizer.json'))
    m = load_exported(a.model).to('cuda' if torch.cuda.is_available() else 'cpu')
    rows = []
    for (x, y), op in CASES:
        gold = x + y if op == '+' else (x - y if op == '-' else x * y)
        for name, ctx, q in surfaces(x, y, op):
            out = answer(m, tok, ctx + [{'role': 'user', 'content': q}])
            got = last_int(out)
            rows.append({'item': '%d%s%d' % (x, op, y), 'gold': gold, 'surface': name,
                         'q': q, 'reply': out, 'got': got, 'ok': got == gold})
    by = {}
    for r in rows:
        by.setdefault(r['surface'], [0, 0])
        by[r['surface']][1] += 1
        by[r['surface']][0] += int(r['ok'])
    print('%-11s %s' % ('surface', 'correct'))
    for name, (ok, n) in by.items():
        print('%-11s %d/%d' % (name, ok, n))
    for r in rows:
        print('[%s] %-11s %-22s -> %-40s %s' % ('PASS' if r['ok'] else 'FAIL', r['surface'], r['q'][:22],
                                                (r['reply'] or '')[:40].replace('\n', ' '),
                                                '' if r['ok'] else 'want %s got %s' % (r['gold'], r['got'])))
    if a.out:
        json.dump(rows, open(a.out, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
