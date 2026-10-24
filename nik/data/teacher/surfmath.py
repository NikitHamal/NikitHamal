"""Arithmetic in the surfaces people type (Claude, 2026-10-24; owner: "isn't it the model's understanding problem too?").

Raw m50, v2s14 and v3s14 on 30 fresh sums (scripts/surface_math.py): `a + b kati hunchha?` 22/30, but `a+b kati hunxa?`
4-7/30 and `a+b=?` 0-1/30. The column skill was tied to the spaced training shape: a model that understood addition
would not care about two missing spaces. This source writes the full column procedure (colmath / colbig) under the
surfaces the generators never used: no spaces (`5674674+3644849`), `=?`, the number first and the question after,
mixed English, the operator as a word, plus a first think line that restates the sum in the training shape
(`sodheko: 5674674 + 3644849.`), so whatever the surface, the work starts from the same place.
Gold is exact; every equation is checked by verify.py in the test below.
"""
import random
import re

import colbig
import colmath
from math_gen import ex, pick

SURF = [
    lambda e: f'{e}', lambda e: f'{e}=?', lambda e: f'{e} = ?', lambda e: f'{e} kati?', lambda e: f'{e} kati hunxa?',
    lambda e: f'{e} kati hunchha', lambda e: f'{e} ko answer?', lambda e: f'{e} solve gara', lambda e: f'{e}=', lambda e: f'calculate {e}',
    lambda e: f'{e} kati aauchha?', lambda e: f'yo kati: {e}', lambda e: f'{e} bhanda kati?', lambda e: f'{e} plz', lambda e: f'{e}?',
]
WORD = {'+': ['plus', 'jod', 'ra'], '-': ['minus', 'ghatau'], 'x': ['guna', 'times', 'into'], '/': ['bhag', 'divided by']}


def _src(R):
    r = R.random()
    if r < 0.35:
        return colbig.big_add(R) if R.random() < 0.6 else colbig.big_sub(R)
    fam = [f for f, _ in colmath.FAMILIES if f.__name__ in ('col_add', 'col_sub', 'col_mul', 'col_div')]
    return R.choice(fam)(R)


def sample(R):
    import build
    for _ in range(20):
        e = _src(R)
        t = re.search(r'tyasaile (-?\d+) ([-+x/]) (-?\d+) =', e['think'])
        if t:
            a, op, b = t.group(1), t.group(2), t.group(3)
            break
    else:
        return build.to_example(e, 'math', R)
    tight = R.random() < 0.7
    expr = f'{a}{op}{b}' if tight else f'{a} {op} {b}'
    if R.random() < 0.15:
        expr = f'{a} {pick(R, WORD[op])} {b}'
    q = R.choice(SURF)(expr)
    if R.random() < 0.3:
        q = q.replace('?', '') if R.random() < 0.5 else q
    think = f'sodheko: {a} {op} {b}. ' + e['think']
    out = ex(q, think, e['a'], e['gold'], e.get('kind', 'math'))
    return build.to_example(out, 'math', R)


if __name__ == '__main__':
    import sys
    sys.path.insert(0, '.')
    import verify
    R = random.Random(7); bad = 0; n = 0
    for i in range(4000):
        r = sample(R); m = r['messages'][1]
        k, b = verify.check_equations(m.get('think', '') + ' ' + m['content']); n += k
        if b:
            bad += 1
            if bad < 3: print('BAD', b, r)
        if i < 6: print(r['messages'][0]['content'], '||', m.get('think', '')[:120], '||', m['content'])
    print('bad rows', bad, 'of 4000; equations', n)
