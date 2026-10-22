"""Abstention rows: the prompt states something adjacent to what is asked, and the answer is "I don't know".

NikBench-RW's `unknown` category is 0/18 for the live model: asked `"mero bhai school
janchha." mero bhai kati kaksha ma padhchha?` it answers `tapaiki bahini ma padhnuhunchha.`
or quotes the prompt back. It never produces an abstention cue, because nothing in the
mix ever asked it to. This generator writes that behaviour, in the three registers the RW
scorer requires (formal / chatty / clipped), for facts the *bench* does not use.

Every gold answer is checked against `bench_rw.score('unknown', None, gold)` in
`nik/tests/test_rw_families.py`, so a row can never teach a phrasing the bench rejects.
The rule is: a cue from bench_rw.UNKNOWN_CUES and **no digit anywhere**.

    python nik/data/teacher/abstain.py --n 24 --seed 1
"""
import random

NAMES = ['suraj', 'kiran', 'manisha', 'bikram', 'srijana', 'dinesh', 'rojina', 'aashish', 'sunita',
         'raju', 'nirmal', 'deepa', 'tulasi', 'roshan', 'buddhi', 'narayan', 'sneha', 'kushal',
         'prakash', 'maya', 'sabina', 'anil', 'rita', 'suman', 'gita', 'hari', 'milan', 'sarita']
RELATIONS = ['bhai', 'didi', 'dai', 'sathi', 'mama', 'thuldai', 'bahini']
PLACES = ['dharan', 'pokhara', 'butwal', 'hetauda', 'janakpur', 'biratnagar', 'nepalgunj', 'tansen',
          'gorkha', 'damak', 'birgunj', 'banepa', 'dhangadhi', 'ilam', 'bhaktapur']
FOODS = ['momo', 'chiya', 'sel roti', 'dal bhat', 'kwati', 'dhido', 'samosa', 'kheer', 'chowmein',
         'lassi', 'dahi', 'roti', 'tarkari', 'panipuri']
OBJECTS = ['kitab', 'kalam', 'topi', 'jutta', 'ghadi', 'chhata', 'bag', 'mobile', 'cycle', 'radio']
ANIMALS = ['biralo', 'kukur', 'kharayo', 'suga', 'machha', 'bakhra', 'gai', 'ghoda']
SPORTS = ['football', 'cricket', 'basketball', 'badminton', 'volleyball', 'table tennis', 'kabaddi']

# (context template, question template) - the asked fact is never in the context
SCENES = [
    ('mero {relation} ko naam {name} ho.', '{relation} kati barsha ko chha?'),
    ('mero {relation} ko naam {name} ho.', 'u kati barsha ko bhayo?'),
    ('meri {relation} {place} ma baschhin.', 'meri {relation} k kaam garchhin?'),
    ('mero {relation} {name} {place} ma baschha.', '{relation} ko job ke ho?'),
    ('ma {name} sanga bholi bhetne chhu.', 'bholi kati baje bhetne?'),
    ('malai {food} dherai man parchha.', '{food} kati ko hunchha?'),
    ('hijo hami {place} ghumna gayau.', 'hijo jamma kati kharcha bhayo?'),
    ('mero sathi le {object} kinyo.', 'tyo sathi ko naam ke ho?'),
    ('aaja {place} ma pani paryo.', 'kati millimeter pani paryo?'),
    ('mero ghar ma {animal} chha.', '{animal} ko naam ke ho?'),
    ('hami {n} jana team ma kaam garchhau.', 'sabai ko experience kati barsha?'),
    ('yo {object} {name} le banayeko ho.', '{object} kati ma kineko?'),
    ('bholi {place} ma {object} ko pasal band chha.', 'kina band chha?'),
    ('malai {sport} khelna man parchha.', 'malai kun kheladi man parchha?'),
    ('mero {relation} {food} pakaunuhunchha.', '{food} ma kati masala halincha?'),
]

# the three registers the RW group scorer needs; placeholders {given} / {ask}
REGISTERS = [
    ('formal', '{ctx} {ask}'),
    ('quoted', '"{ctx}" {ask}'),
    ('chatty', '{ctx} ta ho ni, {ask}'),
    ('clipped', '{ctx} - {ask}'),
]

CUES = ['thaha chhaina', 'malai thaha chhaina', 'yo kura bhaneko chhaina', 'tyo lekheko chhaina',
        'malai thaha bhayena', 'yo kura maile bhannubhayeko chhaina', 'tyo jankari chhaina']
# a short lead-in so the reply is a sentence, never a bare cue; still no digits
LEADS = ['maile', 'hmm,', 'maile bhane anusar,', 'yaha samma,']


def _fill(R):
    return {'name': R.choice(NAMES), 'relation': R.choice(RELATIONS), 'place': R.choice(PLACES),
            'food': R.choice(FOODS), 'object': R.choice(OBJECTS), 'animal': R.choice(ANIMALS),
            'sport': R.choice(SPORTS), 'n': R.randint(3, 12)}


def sample(R):
    ctx_t, ask_t = R.choice(SCENES)
    slots = _fill(R)
    ctx, ask = ctx_t.format(**slots).rstrip('.'), ask_t.format(**slots)
    _, tmpl = R.choice(REGISTERS)
    q = tmpl.format(ctx=ctx, ask=ask)
    a = ('%s %s.' % (R.choice(LEADS), R.choice(CUES))).replace('  ', ' ').strip()
    a = a[0].upper() + a[1:]
    return {'cat': 'understand-abstain', 'kind': 'unknown', 'gold': a,
            'messages': [{'role': 'user', 'content': q}, {'role': 'nik', 'content': a}]}


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
        line = json.dumps({k: v for k, v in r.items() if k != 'kind'}, ensure_ascii=False)
        print(line)
    if a.out:
        with open(a.out, 'w', encoding='utf-8') as h:
            for r in rows:
                h.write(json.dumps({k: v for k, v in r.items() if k != 'kind'}, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
