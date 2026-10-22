"""Output-format rows: the same answer, in the envelope the user asked for.

NikBench-RW's `format` category is 1/18 for the live model: asked `12 + 15 ko jawaf matra
deu` it answers `10.`; asked for three fruits comma-separated it writes prose. The envelope
is a behaviour, not a skill, so it is cheap to teach and it is 6 RW groups.

Every row is generated with its `kind` and `spec`, and `nik/tests/test_rw_families.py`
asserts `bench_rw.score(kind, spec, answer)` is True for every one - a row whose gold fails
the scorer teaches the wrong envelope. Content is disjoint from bench_rw's format items and
parameterised, because a 2% token share of a real mix is thousands of rows.

    python nik/data/teacher/format_ask.py --n 24 --seed 1
"""
import random
import re

NUMS = [19, 23, 17, 24, 31, 18, 26, 14, 27, 22, 34, 16]
MULTS = [3, 4, 5, 6, 7, 8, 9, 11, 12]

CAPITALS = [('sabai bhanda aglo himal', ['sagarmatha']), ('nepal ko sabai bhanda thulo tal', ['rara']),
            ('janakpur ko prasiddha mandir', ['janaki'])]
TRANSLATE = [('dhanyabad', ['thanks', 'thank you']), ('biralo', ['cat']), ('kitab', ['book']),
             ('pani', ['water']), ('sathi', ['friend']), ('ghar', ['house']), ('himal', ['mountain'])]
LIST3 = [('tarkari', 'aalu, pyaj, kauli'), ('rang', 'rato, nilo, hariyo'),
         ('janawar', 'kukur, biralo, gai'), ('fohor', 'kagaj, plastic, sisa'),
         ('sahar', 'kathmandu, pokhara, dharan'), ('din', 'aaitabar, sombar, mangalbar')]


def _only_number(R):
    a, b = R.choice(NUMS), R.choice(MULTS)
    variants = [
        ('%d x %d kati? number matra lekha.' % (a, b), str(a * b)),
        ('%d lai %d le gunne ho, jawaf matra deu.' % (a, b), str(a * b)),
        ('only the number: %d*%d' % (a, b), str(a * b)),
        ('%d ra %d jod, number matra deu.' % (a, b), str(a + b)),
        ('%d bata %d ghatne ho, sirf number.' % (a + b, b), str(a)),
        ('%d / %d ko jawaf matra lekha, aru kehi hoina.' % (a * b, b), str(a)),
    ]
    q, ans = R.choice(variants)
    return 'fmt:only_number', ans, q, ans


def _words2(R):
    fact, spec = R.choice(CAPITALS)
    q = R.choice(['%s ek shabda ma bhana.' % fact, 'ek shabda ma: %s?' % fact])
    return 'fmt:words<=2', (spec,), q, spec[0]


def _words3(R):
    word, spec = R.choice(TRANSLATE)
    q = R.choice(['"%s" lai english ma, ek shabda ma?' % word,
                  '%s lai english ma ek shabda ma bhana.' % word])
    return 'fmt:words<=3', (spec,), q, spec[0]


def _words4(R):
    a, b = R.choice(NUMS), R.choice(NUMS)
    if a == b:
        b += 1
    smaller = R.random() < 0.5
    if smaller:
        q = R.choice(['ho ki haina matra: %d bhanda %d sano ho?' % (a, b),
                      '%d, %d bhanda sano ho? ho/haina ma jawaf deu.' % (a, b)])
        ans = 'ho' if a < b else 'haina'
    else:
        q = R.choice(['ho ki haina matra: %d joda sankhya ho?' % a,
                      'ke %d joda sankhya ho? ho ki haina.' % a])
        ans = 'ho' if a % 2 == 0 else 'haina'
    spec = (['ho', 'haina'] if ans == 'ho' else ['haina', 'hoina'])
    return 'fmt:words<=4', (spec,), q, ans


def _list3(R):
    cat, items = R.choice(LIST3)
    q = R.choice(['tin ota %s ko naam comma le chhutyaera lekha.' % cat,
                  'tin wata %s, comma lagayera deu.' % cat,
                  'list 3 %s, comma separated.' % cat])
    return 'fmt:list3', None, q, items


GENS = [_only_number, _words2, _words3, _words4, _list3]


def only_number_think(q, a):
    """The working for an only-number arithmetic row (`24 x 4 kati? number matra lekha.` -> think `24 x 4 = 96.`).
    The user still sees only the number (the think is hidden in /chat). Without it these rows taught the model to answer
    sums with no think at all (k4 on NikBench nested: `jodnus 87 ra 68` -> `355`), which also bypasses /chat's pencil."""
    n = [int(x) for x in re.findall(r'\d+', q)]
    if len(n) != 2:
        return None
    op = 'x' if re.search(r' x |gunne|\*', q) else '+' if 'jod' in q else '-' if 'ghatne' in q else '/' if '/' in q else None
    if op is None:
        return None
    v = {'x': n[0] * n[1], '+': n[0] + n[1], '-': n[0] - n[1], '/': n[0] / n[1] if n[1] else None}[op]
    if v is None or str(int(v)) != str(a) or v != int(v):
        return None
    return f'{n[0]} {op} {n[1]} = {a}.'


def sample(R):
    kind, spec, q, a = R.choice(GENS)(R)
    nik = {'role': 'nik', 'content': a}
    if kind == 'fmt:only_number':
        t = only_number_think(q, a)
        if t:
            nik['think'] = t
    return {'cat': 'understand-format', 'kind': kind, 'spec': spec, 'gold': a,
            'messages': [{'role': 'user', 'content': q}, nik]}


def main():
    import argparse
    import json
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=24)
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--out', default='')
    a = ap.parse_args()
    R = random.Random(a.seed)
    rows = [sample(R) for _ in range(a.n)]
    for r in rows:
        print(json.dumps({k: v for k, v in r.items() if k not in ('kind', 'spec')}, ensure_ascii=False))
    if a.out:
        with open(a.out, 'w', encoding='utf-8') as h:
            for r in rows:
                h.write(json.dumps({k: v for k, v in r.items() if k not in ('kind', 'spec')},
                                   ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
