"""Entity mentions that are NOT questions about the entity (fixes "mero naam nikit ho" -> Nikit's biography).
The model saw "nikit" almost only in persona rows, so it learned keyword -> stored biography. Here "nikit", "nik",
"hamal" and ordinary names appear as the USER's name, a friend, a story character, a shop owner ...; the reply must
respond to what the sentence says. Multi-turn rows check that the name is remembered as the user's name."""
import random

import lexicon as L

SPECIAL = ['nikit', 'nikit hamal', 'nik', 'hamal', 'nikita']


def U(t):
    return {'role': 'user', 'content': t}


def N(t):
    return {'role': 'nik', 'content': t}


def _name(R):
    return R.choice(SPECIAL) if R.random() < 0.45 else R.choice(L.NAMES_M + L.NAMES_F)


def intro(R):
    n = _name(R); p = R.choice(L.PLACES)
    k = R.random()
    if k < 0.4:
        q = R.choice([f'mero naam {n} ho', f'ma {n} hu', f'hi, ma {n}', f'namaste, mero naam {n}', f'ma {n}, {p} bata'])
        a = R.choice([f'namaste {n}! tapai lai bhetera khusi lagyo. aaja k kura garne?', f'hello {n}! k chha khabar? kasari help garu?',
                      f'namaste {n}! ramro naam. bhannus, k sodhna man chha?'])
        if p in q:
            a = f'namaste {n}! {p} ta ramro thau ho. aaja k ma sahayog garu?'
        msgs = [U(q), N(a)]
        if R.random() < 0.6:
            msgs += [U(R.choice(['mero naam k ho?', 'maile mero naam k bhane?', 'ma ko hu, bhana ta'])), N(f'tapai ko naam {n} ho.')]
        return {'cat': 'names-intro', 'gold': n, 'messages': msgs}
    if k < 0.7:
        f = R.choice(L.FOODS); r = R.choice(['sathi', 'dai', 'bhai', 'didi', 'bahini', 'chhimeki'])
        q = R.choice([f'mero {r} {n} lai {f} man parchha', f'{n} mero {r} ho, u {p} ma baschha', f'hijo {n} sanga bhet bhayo'])
        if 'man parchha' in q:
            a = R.choice([f'{f}! tapai ko {r} {n} ko choice ramro chha. tapai lai ni man parchha?', f'{n} lai {f} man parne raichha. sangai khana jaanus na!'])
        elif 'baschha' in q:
            a = f'{p} ma basne {r} {n}, ramro. tapai pani {p} tira jaanu hunchha?'
        else:
            a = f'{n} sanga bhet bhayo, ramro! k kura bhayo?'
        return {'cat': 'names-mention', 'gold': n, 'messages': [U(q), N(a)]}
    c = R.randint(2, 9); t, unit = R.choice(L.THINGS)
    q = f'"{n} le {c} {unit} {t} kinyo." {n} le kati {t} kinyo?'
    return {'cat': 'names-read', 'gold': str(c), 'messages': [U(q), N(f'{n} le {c} {unit} {t} kinyo.')]}


def sample(R):
    return intro(R)
