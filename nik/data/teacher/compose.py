"""Compositional word problems (after "Physics of Language Models 2.1" / iGSM): a random chain of
2-5 events acting on a small world state (money + items), rendered with varied phrasing in
romanized Nepali or English, sometimes with irrelevant distractor facts. No fixed template exists,
so the only way to answer is to read each sentence. The think grounds every step in the sentence
it came from, then computes it; every equation is checked by the verifier.
"""
import random

from math_gen import pick, ex

NAMES = ['sita', 'ram', 'hari', 'gita', 'bikash', 'anita', 'suman', 'kiran', 'rita', 'prakash', 'nabin', 'sarita', 'dipesh', 'puja', 'roshan',
         'sabina', 'manoj', 'asmita', 'kamal', 'binita']
ITEMS = [('syau', 'apples'), ('kalam', 'pens'), ('kapi', 'notebooks'), ('anda', 'eggs'), ('chakleti', 'chocolates'), ('kera', 'bananas'),
         ('ball', 'balls'), ('phool', 'flowers'), ('kitab', 'books'), ('suntala', 'oranges')]
OTHERS = ['sathi', 'didi', 'bhai', 'aama', 'buwa', 'hajurba', 'teacher', 'chhimeki']
OTHERS_EN = ['a friend', 'his sister', 'her brother', 'mother', 'father', 'grandpa', 'the teacher', 'a neighbour']
DISTRACT = [('usko umer {n} barsha ho.', 'is {n} years old.'), ('uslai school pugna {n} minute lagchha.', 'takes {n} minutes to reach school.'),
            ('uniharu ko ghar ma {n} wata jhyal chhan.', 'has {n} windows at home.'), ('aaja tapkram {n} degree chha.', 'notes that it is {n} degrees today.')]


def world(R):
    return {'items': R.randint(0, 30) if R.random() < 0.6 else 0, 'money': R.choice([0, R.randint(5, 60) * 10])}


def event(R, st, en):
    """Returns (sentence, think_step) and mutates st, or None if not applicable."""
    o = R.randrange(len(OTHERS))
    who, who_en = OTHERS[o], OTHERS_EN[o]
    k = R.random()
    I = st['item']
    if k < 0.2:
        n = R.randint(2, 25)
        b = st['items']; st['items'] += n
        s = (f'{who} le {n} wata {I[0]} thap diyo.', pick(R, [f'{who} le aru {n} wata {I[0]} diyo.', f'pachhi {n} wata {I[0]} thapiyo.'])) if not en else \
            (f'Then {who_en} gave {n} more {I[1]}.',)
        return pick(R, s), f'thapiyo: {b} + {n} = {st["items"]}'
    if k < 0.38 and st['items'] >= 2:
        n = R.randint(1, st['items'])
        b = st['items']; st['items'] -= n
        s = (f'usle {who} lai {n} wata {I[0]} diyo.', f'{n} wata {I[0]} haraye.', f'{n} wata {I[0]} kharab bhayo ra phaliyo.') if not en else \
            (f'Then {n} {I[1]} were given to {who_en}.', f'{n} {I[1]} got lost.')
        return pick(R, s), f'gayo: {b} - {n} = {st["items"]}'
    if k < 0.56:
        n, p = R.randint(2, 9), R.randint(2, 30) * 5
        if st['money'] < n * p:
            add = n * p - st['money'] + R.randint(0, 10) * 10
            st['money'] += add
            pre = (f'aama le {add} rupiya dinubhayo. ' if not en else f'Mother gave {add} rupees. ')
            pre_t = f'paisa thapiyo: {st["money"] - add} + {add} = {st["money"]}. '
        else:
            pre, pre_t = '', ''
        bi, bm = st['items'], st['money']
        st['items'] += n; st['money'] -= n * p
        s = (f'usle {n} wata {I[0]} kinyo, ek ko {p} rupiya.', f'{p} rupiya ko dar le {n} wata {I[0]} kinyo.') if not en else \
            (f'Then {n} {I[1]} were bought at {p} rupees each.',)
        return pre + pick(R, s), pre_t + f'kinyo: kharcha {n} x {p} = {n * p}, paisa {bm} - {n * p} = {st["money"]}, {I[0]} {bi} + {n} = {st["items"]}'
    if k < 0.7 and st['items'] >= 2:
        n, p = R.randint(1, st['items']), R.randint(2, 20) * 5
        bi, bm = st['items'], st['money']
        st['items'] -= n; st['money'] += n * p
        s = (f'usle {n} wata {I[0]} {p} rupiya ko dar le bechyo.',) if not en else (f'Then {n} {I[1]} were sold for {p} rupees each.',)
        return pick(R, s), f'bechyo: aamdani {n} x {p} = {n * p}, paisa {bm} + {n * p} = {st["money"]}, {I[0]} {bi} - {n} = {st["items"]}'
    if k < 0.82:
        g, e = R.randint(2, 6), R.randint(2, 12)
        b = st['items']; st['items'] += g * e
        s = (f'pachhi usle {g} wata packet lyayo, har packet ma {e} wata {I[0]}.', f'{g} wata baakas aaye, pratyek ma {e} wata {I[0]} thiyo.') if not en else \
            (f'Then {g} packs arrived with {e} {I[1]} in each.',)
        return pick(R, s), f'packet: {g} x {e} = {g * e} thapiyo, {b} + {g * e} = {st["items"]}'
    if st['items'] >= 4:
        divs = [m for m in range(2, 7) if st['items'] % m == 0]
        if divs:
            m = R.choice(divs)
            b = st['items']; st['items'] //= m
            s = (f'usle sabai {I[0]} {m} jana ma barabar baadyo ra aafno bhag matra rakhyo.',) if not en else \
                (f'Then all the {I[1]} were shared equally among {m} people, keeping one share.',)
            return pick(R, s), f'barabar bhag: {b} / {m} = {st["items"]}'
    return None


def problem(R):
    en = R.random() < 0.25
    n = pick(R, NAMES)
    st = world(R); st['item'] = pick(R, ITEMS)
    I = st['item']
    sents, steps = [], []
    if st['items']:
        sents.append(f'{n} sanga {st["items"]} wata {I[0]} chha.' if not en else f'{n.title()} has {st["items"]} {I[1]}.')
        steps.append(f'suru ma {I[0]} {st["items"]}')
    if st['money']:
        sents.append(f'{n} sanga {st["money"]} rupiya pani chha.' if not en else f'{n.title()} also has {st["money"]} rupees.')
        steps.append(f'suru ma paisa {st["money"]}')
    want = R.randint(2, 5)
    tries = 0
    while len(sents) < want + 2 and tries < 20:
        tries += 1
        e = event(R, st, en)
        if e:
            sents.append(e[0]); steps.append(e[1])
    if len(steps) < 3:
        return None
    if R.random() < 0.35:
        dn, de = pick(R, DISTRACT)
        v = R.randint(5, 60)
        pos = R.randint(1, len(sents))
        sents.insert(pos, dn.format(n=v) if not en else f'{n.title()} {de.format(n=v)}')
        steps.insert(pos, f'({v} wala kura prashna sanga sambandhit chhaina)')
    ask_money = st['money'] > 0 and R.random() < 0.4
    if ask_money:
        q = pick(R, ['antya ma usko sanga kati rupiya chha?', 'aba kati paisa baki chha?']) if not en else 'How many rupees are left at the end?'
        gold, unit = st['money'], 'rupiya'
    else:
        q = pick(R, [f'antya ma {n} sanga kati wata {I[0]} chha?', f'aba jamma kati {I[0]} bhayo?']) if not en else f'How many {I[1]} are there at the end?'
        gold, unit = st['items'], f'wata {I[0]}'
    question = ' '.join(sents) + ' ' + q
    think = 'ek ek wakya padhchhu. ' + '. '.join(f'({i + 1}) {s}' for i, s in enumerate(steps)) + f'. sodheko: {unit}. uttar {gold}.'
    a = (f'antya ma {gold} {unit} hunchha.' if not en else f'At the end there are {gold} ' + ('rupees.' if ask_money else f'{I[1]}.'))
    return ex(question, think, a, gold, 'compose')


def sample(R):
    while True:
        e = problem(R)
        if e:
            return e
