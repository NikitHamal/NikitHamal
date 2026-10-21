"""Minimal-pair reading/understanding data.

The model's measured failure is not arithmetic: it binds a keyword to a memorised
answer and ignores the question ("mero naam nikit ho" and "nikit ko ho?" both
return the same creator bio; held-out word families are 0/48). This generator
emits *pairs*: the same context, two different questions/roles, two different
gold answers. Memorising the entity cannot pass both items.

Identity slice: user named Nikit vs creator question vs third-person Nikit vs
ambiguous vs assistant identity. General slice: who-did-what, negation, temporal
order, coreference, distractors, comparisons, units, sequences, conditions,
multi-turn corrections.

    python nik/data/teacher/reading_contrast.py --n 5000 --seed 1 --out /tmp/rc.jsonl
    python nik/data/teacher/reading_contrast.py --pairs 500 --seed 1 --out /tmp/rc_pairs.jsonl
"""
import argparse
import json
import random

NAMES = ['sita', 'ram', 'hari', 'gita', 'bikash', 'anita', 'suman', 'kiran', 'rita', 'prakash',
         'nabin', 'sarita', 'dipesh', 'puja', 'roshan', 'sabina', 'manoj', 'asmita', 'kamal', 'binita']
ITEMS = [('kalam', 'wata'), ('kapi', 'wata'), ('syau', 'wata'), ('kera', 'wata'), ('kitab', 'wata'),
         ('ball', 'wata'), ('phool', 'wata'), ('suntala', 'wata')]
JOBS = ['doctor', 'engineer', 'teacher', 'pilot', 'farmer', 'driver', 'nurse', 'shopkeeper']
PLACES = ['pokhara', 'butwal', 'dharan', 'biratnagar', 'kathmandu', 'chitwan', 'ilam', 'jhapa']
REL = [('didi', 'she'), ('bhai', 'he'), ('aama', 'she'), ('buwa', 'he'), ('sathi', 'she')]

# ---------------------------------------------------------------- identity slice
INTROS = ['mero naam nikit ho', 'ma nikit', 'namaste, ma nikit', 'hi, nikit here',
          'mero naam nikit ho, kathmandu bata', 'ma nikit, timi ko hau?', 'mero naam nikit ho, timilai kasto chha?']
CREATOR_Q = ['nikit ko ho?', 'nikit kasle banayo?', 'nikit ko project k k chhan?', 'nikit kaha baschha?',
             'nikit ko essay kaha padhne?', 'nikit ko umer kati?', 'nikit kun college ma padhnu bhayo?']
THIRD_Q = ['mero sathi nikit ho. usko naam k ho?', 'nikit bhanne dai kaha baschhau?',
           'mero teacher nikit ho, unko subject k ho?', 'mero bhai ko naam nikit ho.']
CREATOR_A = [
    'nikit hamal nepal ka android ra full-stack developer hunuhunchha. uha consica labs, lami nepal, nebians ra astroweb jasta project ma kaam garnuhunchha.',
    'nikit le malai banaunubhayeko ho. mero code unko portfolio repo ko nik folder ma chha.',
    'nikit ko essay haru nikit.is-a.dev/writings ma chhan. dherai jaso maya, chetana ra jeevan ko barema chhan.',
    'nikit ko umer malai thaha chhaina. tyo niji kura ho, tyasaile anuman gardina.',
    'nikit kun college ma padhnu bhayo tyo malai thaha chhaina. uha ko kaam ra project matra jaandachhu.',
]
ASSISTANT_A = [
    'ma Nik ho, nikit hamal le banaunubhayeko sano AI. ma browser mai offline chalchhu.',
    'malai nikit hamal le banaunubhayo. ma math, reading ra Nepali kura ma sahayog garna banaieko sano model hu.',
    'ma Nik hu, timro sano Nepali assistant. mero code nikit ko portfolio repo ma chha.',
]
INTRO_OPEN = ['namaste {n}!', 'hi {n}!', 'oh namaste {n}!', 'bhetera khusi lagyo, {n}!', 'ramro, namaste {n}!', 'hey {n}!']
INTRO_FOLLOW = ['kasto chha?', 'aaja k gardai?', 'k ma help garu?', 'timro din kasto gayo?', 'kehi sodhna chahanchhau?',
                'kaha bata?', 'k gardai chhau aaja?']


def identity_pair(R):
    """(kind, context, q1, a1, q2, a2) with the same context and different questions."""
    k = R.random()
    n = 'nikit'
    if k < 0.30:
        intro = R.choice(INTROS)
        q1 = intro
        a1 = R.choice(INTRO_OPEN).format(n=n) + ' ' + R.choice(INTRO_FOLLOW)
        q2 = R.choice(CREATOR_Q)
        a2 = R.choice(CREATOR_A)
        return 'identity-intro-vs-creator', '', q1, a1, q2, a2
    if k < 0.45:
        intro = R.choice(INTROS)
        q1 = intro + ' mero naam k ho?'
        a1 = 'tapai ko naam nikit ho.'
        q2 = intro + ' timro naam k ho?'
        a2 = 'mero naam Nik ho. nikit hamal le banaunubhayeko.'
        return 'identity-self-vs-assistant', intro, q1, a1, q2, a2
    if k < 0.60:
        q1 = 'mero sathi nikit ho. usko naam k ho?'
        a1 = 'tapai ko sathi ko naam nikit ho.'
        q2 = 'mero sathi nikit ho. timro naam k ho?'
        a2 = 'mero naam Nik ho.'
        return 'identity-third-vs-assistant', '', q1, a1, q2, a2
    if k < 0.75:
        intro = R.choice(INTROS)
        q1 = intro + ' nikit ko barema bhana.'
        a1 = 'tapai afno barema sodhnu bhayo ki nikit hamal ko barema? duitai ma help garna sakchhu.'
        q2 = intro + ' timi ko hau?'
        a2 = R.choice(ASSISTANT_A)
        return 'identity-ambiguous-vs-assistant', intro, q1, a1, q2, a2
    if k < 0.90:
        q1 = R.choice(CREATOR_Q)
        a1 = R.choice(CREATOR_A)
        q2 = R.choice(['timi ko hau?', 'timilai kasle banayo?', 'timi chatgpt hau?'])
        a2 = R.choice(ASSISTANT_A)
        return 'identity-creator-vs-assistant', '', q1, a1, q2, a2
    intro = R.choice(['mero naam nikit ho', 'ma nikit, pokhara bata'])
    q1 = intro + ' namaste!'
    a1 = 'namaste nikit! kasto chha?'
    q2 = intro + ' malai momo man parchha.'
    a2 = 'momo ta mitho hunchha ni! kaha khadai chhau?'
    return 'identity-smalltalk', intro, q1, a1, q2, a2


# ---------------------------------------------------------------- general reading pairs
def general_pair(R):
    k = R.randrange(11)
    if k == 0:
        a, b = R.sample(NAMES, 2); ja, jb = R.sample(JOBS, 2)
        ctx = f'{a} {ja} hun ra {b} {jb} hun.'
        return ctx, f'{a} k kaam garchhan?', f'{a} {ja} hun.', f'{b} k kaam garchhan?', f'{b} {jb} hun.'
    if k == 1:
        a, b = R.sample(NAMES, 2); n = R.randint(2, 12); item = R.choice(ITEMS)[0]
        ctx = f'{a} le {b} lai {n} wata {item} diyo.'
        return ctx, 'kasle kitab diyo?'.replace('kitab', item), f'{a} le diyo.', f'kasle {item} payo?', f'{b} le payo.'
    if k == 2:
        a = R.choice(NAMES); food, other = R.sample(['momo', 'chowmein', 'dal bhat', 'chiya', 'pizza'], 2)
        ctx = f'{a} lai {food} man parchha tara {other} man pardaina.'
        return ctx, f'{a} lai {food} man parchha?', 'ho, man parchha.', f'{a} lai {other} man parchha?', 'pardaina.'
    if k == 3:
        x, y = R.randint(2, 9), R.randint(2, 9)
        ctx = f'{R.choice(NAMES)} le pahile {x} km hidyo, pachhi {y} km hidyo.'
        return ctx, 'jamma kati km hidyo?', f'{x + y} km.', 'pahilo palat kati km hidyo?', f'{x} km.'
    if k == 4:
        n = R.choice(NAMES); age = R.randint(30, 70); c = R.randint(2, 8); p = R.choice([50, 100, 150, 200, 250]); item = R.choice(ITEMS)[0]
        ctx = f'{n} {age} barsha ko chha. usle {c} wata {item} kinyo, ek ko {p} rupiya.'
        return ctx, 'jamma kati kharcha bhayo?', f'{c * p} rupiya.', f'{n} kati barsha ko chha?', f'{age} barsha.'
    if k == 5:
        a = R.choice(NAMES); rel, g = R.choice(REL); place = R.choice(PLACES)
        ctx = f'{a} ko {rel} {place} ma baschhin. unko pasal chha.'
        return ctx, f'{a} ko {rel} kaha baschhin?', f'{place} ma.', f'{a} kaha baschha?', 'thaha chhaina, bhaneko chhaina.'
    if k == 6:
        a, b = R.randint(10, 40), R.randint(10, 40)
        ctx = f'kaksha ma {a} keta ra {b} keti chhan.'
        return ctx, 'jamma kati jana chhan?', f'{a + b} jana.', 'keta ra keti ma kati farak chhan?', f'{abs(a - b)} jana.'
    if k == 7:
        s, h = R.choice([40, 50, 60, 70, 80]), R.randint(2, 5)
        ctx = f'euta bus {s} km/h ma {h} ghanta gayo.'
        return ctx, 'jamma kati km gayo?', f'{s * h} km.', 'kati ghanta gayo?', f'{h} ghanta.'
    if k == 8:
        a, d = R.randint(1, 20), R.randint(2, 9)
        ctx = f'shrinkhala: {a}, {a + d}, {a + 2 * d}, {a + 3 * d}, ...'
        return ctx, 'arko number kati?', f'arko number {a + 4 * d} ho.', 'farak kati chha?', f'farak {d} ho.'
    if k == 9:
        a, b = R.randint(3, 12), R.randint(2, 8)
        ctx = f'{a} wata kitab {b} jana ma barabar baadyo.'
        return ctx, 'ek jana le kati kitab pauchha?', f'{a // b} wata.' if a % b == 0 else 'thaha chhaina, barabar baddaina.', 'jamma kati kitab thiyo?', f'{a} wata.'
    n = R.choice(NAMES); old, new = R.sample(PLACES, 2)
    ctx = f'{n} pahile {old} ma basthe, aile {new} ma baschha.'
    return ctx, f'{n} aile kaha baschha?', f'{new} ma.', f'{n} pahile kaha basthe?', f'{old} ma.'


def _row(cat, q, a, gold, think=''):
    msg = {'role': 'nik', 'content': a}
    if think:
        msg['think'] = think
    return {'cat': cat, 'gold': gold, 'messages': [{'role': 'user', 'content': q}, msg]}


def identity_rows(R):
    kind, ctx, q1, a1, q2, a2 = identity_pair(R)
    q1 = (ctx + ' ' + q1).strip() if ctx and not q1.startswith(ctx) else q1
    q2 = (ctx + ' ' + q2).strip() if ctx and not q2.startswith(ctx) else q2
    return [_row(f'chat-{kind}', q1, a1, None), _row(f'chat-{kind}', q2, a2, None)]


def general_rows(R):
    ctx, q1, a1, q2, a2 = general_pair(R)
    return [_row('reading-contrast', f'{ctx} {q1}', a1, a1.rstrip('.')),
            _row('reading-contrast', f'{ctx} {q2}', a2, a2.rstrip('.'))]


def sample_pair(R):
    return identity_rows(R) if R.random() < 0.55 else general_rows(R)


def sample(R):
    return R.choice(sample_pair(R))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=5000)
    ap.add_argument('--pairs', type=int, default=0, help='emit this many pairs (2 rows each) instead of n single rows')
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--out', default='reading_contrast.jsonl')
    a = ap.parse_args()
    R = random.Random(a.seed)
    rows = []
    if a.pairs:
        for _ in range(a.pairs):
            rows.extend(sample_pair(R))
    else:
        rows = [sample(R) for _ in range(a.n)]
    with open(a.out, 'w') as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + '\n')
    print('wrote', a.out, len(rows))


if __name__ == '__main__':
    main()
