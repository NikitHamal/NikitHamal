"""Everyday conversions and weekdays, in the many ways people actually ask (Claude, 2026-10-22).

chat_audit.mjs on live m50: `3 km ma kati meter hunchha?` -> `3 meter` (think: `3 x 3 = 9`), `2.5 kg ma kati gram?` ->
nonsense, `aaja sombar ho bhane 3 din pachhi kun bar?` -> `shukrabar`. The existing families each have ONE question
shape (colmath.units: full unit names, whole numbers, big -> small; reason_gen.weekday: `aaja X ho. k din pachhi kun bar
hunchha?`), so the model learned the sentence, not the skill. Here every skill has many shapes: abbreviations (km, kg,
ml, hr), user spellings (minet, mitar), decimals, both directions, lakh / karod, and for days: bholi / parsi / hijo /
asti, `... ho bhane`, backwards (`3 din agadi`), English. The think always states the fact first (`ek km = 1000 meter`)
and then computes, so the exact pencil can fill the arithmetic.

Held-out phrasings (never generated here) are in nik/tests/chat/everyday_heldout.json (chat_audit.mjs).
"""
import random

# (big names, small names, factor, canonical big, canonical small); first name in each list is the canonical one
UNITS = [
    (['kilometer', 'km', 'kilomitar', 'kilo meter'], ['meter', 'm', 'mitar'], 1000),
    (['meter', 'm', 'mitar'], ['centimeter', 'cm', 'senti'], 100),
    (['centimeter', 'cm'], ['millimeter', 'mm'], 10),
    (['kilogram', 'kg', 'kilo', 'kilogram'], ['gram', 'g', 'gm'], 1000),
    (['liter', 'l', 'litre', 'litar'], ['milliliter', 'ml', 'mili'], 1000),
    (['ghanta', 'hr', 'hour', 'ghanta'], ['minute', 'min', 'minet', 'minut'], 60),
    (['minute', 'min', 'minet'], ['second', 'sec', 'sekend'], 60),
    (['din', 'din', 'day'], ['ghanta', 'ghanta', 'hour'], 24),
    (['hapta', 'hapta', 'week'], ['din', 'din', 'day'], 7),
    (['barsha', 'sal', 'barsa', 'year'], ['mahina', 'mahina', 'month'], 12),
    (['darjan', 'darjan', 'dozen'], ['wata', 'ota', 'wata'], 12),
    (['rupiya', 'rs', 'rupaiya'], ['paisa', 'paisa'], 100),
    (['lakh', 'lakh', 'lac'], ['hajar', 'hajar', 'thousand'], 100),
    (['karod', 'karod', 'crore'], ['lakh', 'lakh'], 100),
]
NUMWORDS = [('hajar', 1000), ('lakh', 100000), ('karod', 10000000)]

PRE = ['', '', '', 'nik, ', 'ekchin, ', 'malai bhana: ', 'ali help gara: ', 'ok, ']
DOWN_Q = ['{k} {B} ma kati {s}?', '{k} {B} ma kati {s} hunchha?', '{k} {B} barabar kati {s}?', '{k} {B} lai {s} ma badla.',
          '{k} {B} = kati {s}?', '{k} {B} kati {s} ho?', '{k} {B} lai {s} ma lekha.', '{k} {B} ma jamma kati {s} parchha?',
          '{k} {B} {s} ma kati hunchha?', '{k} {B} chha bhane {s} ma kati?']
DOWN_EN = ['how many {s} in {k} {B}?', 'convert {k} {B} to {s}.', '{k} {B} in {s}?', 'what is {k} {B} in {s}?']
UP_Q = ['{k} {s} ma kati {B}?', '{k} {s} lai {B} ma badla.', '{k} {s} barabar kati {B}?', '{k} {s} kati {B} hunchha?',
        '{k} {s} = kati {B}?']
UP_EN = ['how many {B} is {k} {s}?', 'convert {k} {s} to {B}.']
DOWN_A = ['{k} {B} = {r} {s}.', '{k} {B} ma {r} {s} hunchha.', 'jawaf: {r} {s}.', '{r} {s} hunchha.']
UP_A = ['{k} {s} = {r} {B}.', '{k} {s} ma {r} {B} hunchha.', 'jawaf: {r} {B}.']
EN_A = ['{k} {u1} = {r} {u2}.', 'it is {r} {u2}.']


def _num(R):
    """A quantity: mostly whole, sometimes a simple decimal (x.5, x.25, x.75, 0.x)."""
    u = R.random()
    if u < 0.6:
        return str(R.randint(2, 15) if R.random() < 0.7 else R.randint(16, 250))
    if u < 0.85:
        return f'{R.randint(1, 12)}.5'
    return R.choice(['0.5', '0.25', '1.25', '2.75', '0.75', '3.25', '0.2', '1.2'])


def _fmt(x):
    s = f'{x:.4f}'.rstrip('0').rstrip('.')
    return s


def units(R):
    bigs, smalls, f = R.choice(UNITS)
    en = R.random() < 0.15
    if en:
        bigs = [b for b in bigs if b.isascii()]; smalls = [s for s in smalls if s.isascii()]
    B, s_ = R.choice(bigs), R.choice(smalls)        # what the user writes
    cB, cs = bigs[0], smalls[0]                      # what Nik writes
    if R.random() < 0.7:                             # big -> small: k x f
        k = _num(R)
        r = _fmt(float(k) * f)
        if '.' in r:                                 # e.g. 0.25 lakh -> 25 hajar is fine, 1.2 cm -> 12 mm fine; skip fractions
            return units(R)
        q = R.choice(DOWN_EN if en else DOWN_Q).format(k=k, B=B, s=s_)
        think = f'ek {cB} = {f} {cs}. {k} x {f} = {r}.'
        a = (R.choice(EN_A).format(k=k, u1=cB, u2=cs, r=r) if en else R.choice(DOWN_A).format(k=k, B=cB, s=cs, r=r))
    else:                                            # small -> big: exact division only
        m = R.randint(2, 40) if R.random() < 0.8 else R.choice([1, 50, 100])
        k = str(m * f)
        r = str(m)
        q = R.choice(UP_EN if en else UP_Q).format(k=k, B=B, s=s_)
        think = f'ek {cB} = {f} {cs}. tyasaile {k} / {f} = {r}.'
        a = (R.choice(EN_A).format(k=k, u1=cs, u2=cB, r=r) if en else R.choice(UP_A).format(k=k, B=cB, s=cs, r=r))
    return {'cat': 'everyday-units', 'gold': r, 'messages': [
        {'role': 'user', 'content': R.choice(PRE) + q}, {'role': 'nik', 'content': a, 'think': think}]}


def numwords(R):
    """`3 lakh` -> 300000 and back (Nepali number words)."""
    w, v = R.choice(NUMWORDS)
    k = R.randint(1, 99) if R.random() < 0.8 else R.choice([1.5, 2.5, 12.5])
    r = _fmt(k * v)
    k = _fmt(k)
    if R.random() < 0.6:
        q = R.choice(['{k} {w} lai ank ma lekha.', '{k} {w} bhaneko kati ho, ank ma?', '{k} {w} = ?', '{k} {w} ma kati shunya?',
                      'write {k} {w} in digits.'])
        if 'shunya' in q:
            if '.' in k:
                return numwords(R)
            r0 = r
            r = str(len(r0) - len(r0.rstrip('0')))
            think = f'ek {w} = {v}. {k} x {v} = {r0}. {r0} ma {r} wata shunya chhan.'
            a = f'{k} {w} = {r0}, jasma {r} wata shunya chhan.'
        else:
            think = f'ek {w} = {v}. {k} x {v} = {r}.'
            a = R.choice([f'{k} {w} = {r}.', f'ank ma: {r}.'])
        q = q.format(k=k, w=w)
    else:
        if '.' in k:
            return numwords(R)
        q = R.choice(['{r} lai {w} ma bhana.', '{r} kati {w} ho?', '{r} bhaneko kati {w}?']).format(r=r, w=w)
        think = f'ek {w} = {v}. {r} / {v} = {k}.'
        a = R.choice([f'{r} bhaneko {k} {w} ho.', f'{k} {w} ho.'])
        r = k
    return {'cat': 'everyday-numwords', 'gold': r, 'messages': [
        {'role': 'user', 'content': R.choice(PRE) + q}, {'role': 'nik', 'content': a, 'think': think}]}


DAYS = ['aaitabar', 'sombar', 'mangalbar', 'budhabar', 'bihibar', 'sukrabar', 'sanibar']
SPELL = {'aaitabar': ['aaitabar', 'aitabar', 'aaitbar', 'aaitabaar'], 'sombar': ['sombar', 'sombaar', 'somabar'],
         'mangalbar': ['mangalbar', 'mangalbaar'], 'budhabar': ['budhabar', 'budhbar', 'budhabaar'],
         'bihibar': ['bihibar', 'bihibaar', 'bihivar'], 'sukrabar': ['sukrabar', 'shukrabar', 'sukrabaar'],
         'sanibar': ['sanibar', 'shanibar', 'sanibaar']}
EN_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
REL = {'bholi': 1, 'parsi': 2, 'hijo': -1, 'asti': -2}


def _walk(i, k):
    """Think text that moves k days from DAYS[i] (k may be negative)."""
    j = (i + k) % 7
    step = 1 if k > 0 else -1
    if abs(k) <= 6:
        names = [DAYS[(i + step * t) % 7] for t in range(1, abs(k) + 1)]
        way = 'agadi' if k > 0 else 'pachhadi'
        return f'{DAYS[i]} bata {abs(k)} din {way} gane: ' + ', '.join(names) + '.', j
    a = abs(k)
    q, m = divmod(a, 7)
    t = f'hapta ma 7 din, tyasaile {a} lai 7 le bhag garchhu: 7 x {q} = {7 * q}, baki {a} - {7 * q} = {m}. '
    if m == 0:
        return t + f'pura {q} hapta, tyasaile feri {DAYS[i]} nai.', j
    sub, _ = _walk(i, m if k > 0 else -m)
    return t + sub, j


def weekday(R):
    i = R.randrange(7)
    d = R.choice(SPELL[DAYS[i]])
    u = R.random()
    if u < 0.2:                                     # bholi / parsi / hijo / asti
        rel = R.choice(list(REL)); k = REL[rel]
        q = R.choice(['aaja {d} ho bhane {rel} kun bar?', 'aaja {d}. {rel} k bar?', 'aaja {d} ho, {rel} chai kun bar parchha?',
                      '{rel} kun bar ho, aaja {d} bhaye?']).format(d=d, rel=rel)
        think, j = _walk(i, k)
        think = f'{rel} bhaneko {"aaja bhanda " + str(abs(k)) + " din " + ("pachhi" if k > 0 else "aghi")}. ' + think
        a = R.choice([f'{rel} {DAYS[j]} ho.', f'{rel} {DAYS[j]} parchha.'])
    elif u < 0.3:                                    # yesterday/tomorrow given -> today
        rel, k = R.choice([('bholi', 1), ('hijo', -1)])
        q = R.choice(['{rel} {d} ho bhane aaja kun bar?', '{rel} {d} thiyo bhane aaja k bar?' if k < 0 else
                      '{rel} {d} parchha bhane aaja kun bar?']).format(d=d, rel=rel)
        think, j = _walk(i, -k)
        think = f'{rel} {DAYS[i]} ho bhane aaja tyo bhanda {"ek din aghi" if k > 0 else "ek din pachhi"}. ' + think
        a = f'aaja {DAYS[j]} ho.'
    elif u < 0.45:                                   # backwards
        k = R.randint(1, 20)
        q = R.choice(['aaja {d} ho. {k} din agadi kun bar thiyo?', 'aaja {d} bhaye {k} din aghi k bar thiyo?',
                      '{k} din pahile kun bar thiyo, aaja {d} ho bhane?']).format(d=d, k=k)
        think, j = _walk(i, -k)
        a = R.choice([f'{k} din aghi {DAYS[j]} thiyo.', f'{DAYS[j]} thiyo.'])
    elif u < 0.55:                                   # English
        k = R.randint(1, 20)
        q = R.choice(['today is {D}. what day is it after {k} days?', 'if today is {D}, what day will it be in {k} days?']
                     ).format(D=EN_DAYS[i], k=k)
        j = (i + k) % 7
        m = k % 7
        think = (f'7 days in a week: 7 x {k // 7} = {7 * (k // 7)}, and {k} - {7 * (k // 7)} = {m} days left. ' if k >= 7 else '') + f'{EN_DAYS[i]} plus {m} days is {EN_DAYS[j]}.'
        a = f'it will be {EN_DAYS[j]}.'
        return {'cat': 'everyday-weekday', 'gold': EN_DAYS[j], 'messages': [
            {'role': 'user', 'content': q}, {'role': 'nik', 'content': a, 'think': think}]}
    else:                                            # forwards, many shapes
        k = R.randint(1, 6) if R.random() < 0.5 else R.randint(7, 40)
        q = R.choice(['aaja {d} ho bhane {k} din pachhi kun bar?', 'aaja {d}. {k} din pachhi k bar parchha?',
                      '{k} din pachhi kun bar hunchha? aaja {d} ho.', 'aaja {d} bhaye {k} din pachhi kun bar?',
                      'aaja {d} ho. aba {k} din pachhi k bar?', '{d} bata {k} din pachhi kun bar?']).format(d=d, k=k)
        think, j = _walk(i, k)
        a = R.choice([f'{k} din pachhi {DAYS[j]} hunchha.', f'{DAYS[j]} parchha.', f'{DAYS[j]} hunchha.'])
    return {'cat': 'everyday-weekday', 'gold': DAYS[j], 'messages': [
        {'role': 'user', 'content': R.choice(PRE) + q}, {'role': 'nik', 'content': a, 'think': think}]}


def sample(R):
    u = R.random()
    if u < 0.5:
        return units(R)
    if u < 0.65:
        return numwords(R)
    return weekday(R)


if __name__ == '__main__':
    import json
    R = random.Random(1)
    for _ in range(14):
        print(json.dumps(sample(R), ensure_ascii=False))
