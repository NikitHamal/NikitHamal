"""Big-number column arithmetic (Claude, 2026-10-24). The live model breaks on 7-digit sums (3/12 on random 7-digit
additions): it was trained on 1-6 digits, so it stops one column early (`3631528 + 2854` -> `366006`: no `das lakh`
column), and it mis-copies numbers with repeated digits (owner's case `5746673 + 574673`: the think adds `574667`).
Same column procedure as colmath.py, for 5-10 digits, with a first line that copies each number and counts its digits
(`sankhya haru: 5746673 (7 ank) ra 574673 (6 ank).`) so the number of columns is planned before the columns start.
Numbers often repeat digits (5746673, 1122334, 9900099), the case where copying fails."""
import random

from colmath import PLACE, add_steps, sub_steps
from math_gen import ex, pick


def bignum(R, lo=5, hi=10):
    k = R.randint(lo, hi)
    if R.random() < 0.35:                      # repeated digits: runs and echoes (the copy trap)
        ds = [R.randint(1, 9)]
        while len(ds) < k:
            r = R.random()
            ds.append(ds[-1] if r < 0.35 else ds[-2] if r < 0.5 and len(ds) > 1 else R.randint(0, 9))
        return int(''.join(map(str, ds)))
    return R.randint(10 ** (k - 1), 10 ** k - 1)


def head(a, b):
    return f'sankhya haru: {a} ({len(str(a))} ank) ra {b} ({len(str(b))} ank).'


def big_add(R):
    a = bignum(R)
    b = bignum(R, 1, 10) if R.random() < 0.5 else bignum(R)
    if R.random() < 0.5:
        a, b = b, a
    c = a + b
    q = pick(R, [f'{a} + {b} kati hunchha?', f'{a} + {b} kati hunxa?', f'{a} ra {b} jodda kati?', f'{a} ma {b} thapda kati hunchha?',
                 f'jod: {a} + {b}', f'{a} + {b} = ?', f'what is {a} + {b}?', f'{a} plus {b} kati?', f'{a}+{b}'])
    think = f'{head(a, b)} thau anusar ek bata suru garchhu. {add_steps(a, b)}. tyasaile {a} + {b} = {c}.'
    return ex(q, think, pick(R, [f'{a} + {b} = {c}.', f'jawaf {c} ho.']), c, 'add')


def big_sub(R):
    a, b = sorted([bignum(R), bignum(R, 1, 10) if R.random() < 0.5 else bignum(R)], reverse=True)
    c = a - b
    q = pick(R, [f'{a} - {b} kati hunchha?', f'{a} - {b} kati hunxa?', f'{a} bata {b} ghataunda kati?', f'ghatau: {a} - {b}',
                 f'what is {a} - {b}?', f'{a} minus {b}?', f'{a}-{b}'])
    think = f'{head(a, b)} thau anusar ek bata suru garchhu. {sub_steps(a, b)}. tyasaile {a} - {b} = {c}. jaach: {c} + {b} = {a}.'
    return ex(q, think, pick(R, [f'{a} - {b} = {c}.', f'jawaf {c} ho.']), c, 'sub')


def sample(R):
    import build
    from augment import augment_example
    f = big_add if R.random() < 0.6 else big_sub
    return augment_example(build.to_example(f(R), 'math', R), R)


if __name__ == '__main__':
    R = random.Random(3)
    for _ in range(4):
        r = sample(R)
        print(r['messages'][0]['content'], '||', r['messages'][1].get('think', '')[:400], '||', r['messages'][1]['content'])
    assert len(PLACE) >= 10
