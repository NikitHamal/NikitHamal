"""Operation words: the same arithmetic when the verb, not the symbol, says what to do.

The live model reads symbols perfectly (84 - 19 -> 65, 9 x 12 -> 108, 6/6 in
`nik/scripts/entry_probe.py`) and `jodnus` correctly, but the arithmetic *verbs* are barely
in the data: `ghatnus` and `gunnus` appear **0 times** in `nik/data/teacher/` and
`nik/data/gold/`, `jod` 12 times, `guna` 5. So `84 ra 19 ghatnus` comes back
`84 + 19 = 103`, while `84 bata 19 ghatnus` - where `bata` marks the minuend - is correct.

The lesson is that the argument structure carries the operation, so this generator writes
the **unambiguous** forms only: `a bata b ghatnus`, never `a ra b ghatnus`, which is
genuinely ambiguous Nepali and which the model already resolves as addition. Each reply
repeats the equation, so the row teaches both the reading and the operation word.

    python nik/data/teacher/opwords.py --n 24 --seed 1
"""
import random

OPS = {
    '+': ('+', ['jodnus', 'jodda', 'jodera', 'jodne']),
    '-': ('-', ['ghatnus', 'ghatda', 'ghatayera', 'ghatne']),
    '*': ('x', ['gunnus', 'gunda', 'gunayera', 'gunne']),
    '/': ('/', ['bhagnus', 'baantnus', 'baandda', 'bhagera']),
}


def _pair(R, op):
    if op == '+':
        a, b = R.randint(12, 98), R.randint(11, 89)
        return a, b, a + b
    if op == '-':
        a = R.randint(21, 99)
        b = R.randint(10, a - 5)
        return a, b, a - b
    if op == '*':
        a, b = R.randint(3, 19), R.randint(2, 12)
        return a, b, a * b
    b = R.randint(2, 9)
    q = R.randint(3, 19)
    return b * q, b, q


def _prompt(R, op, a, b, verb):
    if op == '+':
        return R.choice(['%d ra %d %s' % (a, b, verb), 'euta %d ra arko %d %s' % (a, b, verb),
                         '%d ra %d lai %s' % (a, b, verb)])
    if op == '-':
        return R.choice(['%d bata %d %s' % (a, b, verb),
                         '%d bata %d %s garda kati hunchha?' % (a, b, verb)])
    if op == '*':
        return R.choice(['%d lai %d le %s' % (a, b, verb),
                         '%d lai %d le %s garda kati hunchha?' % (a, b, verb)])
    return R.choice(['%d lai %d le %s' % (a, b, verb),
                     '%d lai %d ma %s garda kati hunchha?' % (a, b, verb)])


def sample(R):
    op = R.choice(list(OPS))
    sym, verbs = OPS[op]
    a, b, gold = _pair(R, op)
    q = _prompt(R, op, a, b, R.choice(verbs))
    reply = '%d %s %d = %d. uttar %d ho.' % (a, sym, b, gold, gold)
    return {'cat': 'understand-opwords', 'kind': 'num', 'gold': str(gold),
            'messages': [{'role': 'user', 'content': q}, {'role': 'nik', 'content': reply}]}


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
        print(json.dumps({k: v for k, v in r.items() if k != 'kind'}, ensure_ascii=False))
    if a.out:
        with open(a.out, 'w', encoding='utf-8') as h:
            for r in rows:
                h.write(json.dumps({k: v for k, v in r.items() if k != 'kind'}, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
