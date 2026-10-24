"""One general algorithm per operation (column addition/subtraction with carries/borrows,
long multiplication by digits, long division), for every number size from 1 to 6 digits.
Size-specific tricks ("das ko thau: 10 + 40") gave right answers for 2 digits and wrong ones
for 3+, and self-improvement reinforced them; a single algorithm generalises to any length.
Every intermediate step is an equation the verifier checks.
"""
import random

from math_gen import pick, ex

PLACE = ['ek', 'das', 'saya', 'hajar', 'das hajar', 'lakh', 'das lakh', 'karod', 'das karod', 'arab', 'das arab', 'kharab']


def ndigit(R, lo, hi):
    k = R.randint(lo, hi)
    return R.randint(10 ** (k - 1) if k > 1 else 0, 10 ** k - 1)


def add_steps(a, b):
    da, db = str(a)[::-1], str(b)[::-1]
    steps, carry = [], 0
    for i in range(max(len(da), len(db))):
        x = int(da[i]) if i < len(da) else 0
        y = int(db[i]) if i < len(db) else 0
        s = x + y + carry
        steps.append(f'{PLACE[i]}: {x} + {y}' + (f' + {carry}' if carry else '') + f' = {s}' + (f', {s % 10} lekhne, {s // 10} haat' if s >= 10 else ''))
        carry = s // 10
    if carry:
        steps.append(f'bacheko haat {carry} agadi lekhne')
    return '. '.join(steps)


def sub_steps(a, b):
    da, db = str(a)[::-1], str(b)[::-1]
    steps, borrow = [], 0
    for i in range(len(da)):
        x = int(da[i]) - borrow
        y = int(db[i]) if i < len(db) else 0
        if x < y:
            steps.append(f'{PLACE[i]}: {x} bata {y} ghatdaina, 1 sapati: {x + 10} - {y} = {x + 10 - y}')
            borrow = 1
        else:
            steps.append(f'{PLACE[i]}: {x} - {y} = {x - y}')
            borrow = 0
    return '. '.join(steps)


def mul1_steps(a, d):
    """a x single digit d, digit by digit with carries."""
    da = str(a)[::-1]
    steps, carry = [], 0
    for i, ch in enumerate(da):
        p = int(ch) * d + carry
        steps.append(f'{ch} x {d}' + (f' + {carry}' if carry else '') + f' = {p}' + (f', {p % 10} lekhne, {p // 10} haat' if p >= 10 and i < len(da) - 1 else ''))
        carry = p // 10 if i < len(da) - 1 else 0
    return '; '.join(steps)


def col_add(R):
    a, b = ndigit(R, 1, 6), ndigit(R, 1, 6)
    if R.random() < 0.08:                      # big round numbers: 1000000 + 1
        a, b = 10 ** R.randint(3, 7) * R.randint(1, 9), R.randint(1, 999)
    c = a + b
    q = pick(R, [f'{a} + {b} kati hunchha?', f'{a} ra {b} jodda kati?', f'{a} ma {b} thapda kati hunchha?', f'jod: {a} + {b}', f'{a} plus {b}?',
                 f'what is {a} + {b}?'])
    think = f'thau anusar ek bata suru garchhu. {add_steps(a, b)}. tyasaile {a} + {b} = {c}.'
    return ex(q, think, pick(R, [f'{a} + {b} = {c}.', f'jawaf {c} ho.']), c, 'add')


def col_sub(R):
    a, b = sorted([ndigit(R, 1, 6), ndigit(R, 1, 6)], reverse=True)
    if R.random() < 0.15 and a != b:           # negative result: small - big
        q = pick(R, [f'{b} - {a} kati hunchha?', f'what is {b} - {a}?', f'{b} bata {a} ghataunda kati?'])
        think = (f'{a} chai {b} bhanda thulo chha, tyasaile uttar rinatmak (minus) hunchha. pahila {a} - {b} nikalchhu: {sub_steps(a, b)}. '
                 f'{a} - {b} = {a - b}, tyasaile {b} - {a} = -{a - b}.')
        return ex(q, think, pick(R, [f'{b} - {a} = -{a - b}.', f'jawaf -{a - b} ho.']), -(a - b), 'sub')
    c = a - b
    q = pick(R, [f'{a} - {b} kati hunchha?', f'{a} bata {b} ghataunda kati?', f'ghatau: {a} - {b}', f'what is {a} - {b}?', f'{a} minus {b}?'])
    think = f'thau anusar ek bata suru garchhu. {sub_steps(a, b)}. tyasaile {a} - {b} = {c}. jaach: {c} + {b} = {a}.'
    return ex(q, think, pick(R, [f'{a} - {b} = {c}.', f'jawaf {c} ho.']), c, 'sub')


def col_mul(R):
    if R.random() < 0.06:                      # zero rule
        a = ndigit(R, 1, 5)
        q = pick(R, [f'0 x {a} kati?', f'{a} x 0 kati hunchha?', f'what is {a} x 0?'])
        return ex(q, f'kunai pani sankhya lai 0 le gunda 0 hunchha: {a} x 0 = 0.', 'jawaf 0 ho.', 0, 'mul')
    a = ndigit(R, 2, 4)
    b = ndigit(R, 1, 2) if R.random() < 0.6 else R.randint(2, 9)
    b = max(b, 2)
    q = pick(R, [f'{a} x {b} kati hunchha?', f'{a} lai {b} le gunda kati?', f'gun: {a} x {b}', f'what is {a} x {b}?', f'{a} * {b} = ?'])
    if b < 10:
        think = f'{a} lai {b} le ank ank gari gunchhu (ek bata): {mul1_steps(a, b)}. tyasaile {a} x {b} = {a * b}.'
    else:
        t, o = divmod(b, 10)
        parts = []
        if o:
            parts.append(f'{a} x {o}: {mul1_steps(a, o)}, so {a} x {o} = {a * o}')
        parts.append(f'{a} x {t}: {mul1_steps(a, t)}, so {a} x {t} = {a * t}, das ko thau ma bhayeko le {a * t} x 10 = {a * t * 10}')
        total = f'{a * o} + {a * t * 10}' if o else f'{a * t * 10}'
        think = (f'{b} ma {t} das ra {o} ek chhan. ' + '. '.join(parts) + '. ' +
                 (f'aba jodchhu: {add_steps(a * o, a * t * 10)}. ' if o else '') + f'tyasaile {a} x {b} = {total} = {a * b}.')
    return ex(q, think.replace(', so ', ', tyasaile '), pick(R, [f'{a} x {b} = {a * b}.', f'jawaf {a * b} ho.']), a * b, 'mul')


def col_div(R):
    d = R.randint(2, 9)
    qv = ndigit(R, 2, 4)
    r = R.randint(0, d - 1) if R.random() < 0.3 else 0
    n = d * qv + r
    q = pick(R, [f'{n} / {d} kati hunchha?', f'{n} lai {d} le bhag garda kati?', f'what is {n} / {d}?', f'bhag: {n} / {d}'])
    steps, cur, out = [], 0, ''
    for ch in str(n):
        cur = cur * 10 + int(ch)
        k = cur // d
        if out or k:
            steps.append(f'{cur} ma {d} {k} palta: {d} x {k} = {d * k}, baki {cur} - {d * k} = {cur - d * k}')
            out += str(k)
        cur -= k * d
    think = f'lamo bhag, baya bata: ' + '. '.join(steps) + f'. bhagfal {qv}' + (f', sesh {r}' if r else '') + '.'
    think += f' jaach: {d} x {qv}' + (f' + {r}' if r else '') + f' = {n}.'
    a = (f'{n} lai {d} le bhag garda {qv} aauchha, sesh {r}.' if r else pick(R, [f'{n} / {d} = {qv}.', f'jawaf {qv} ho.']))
    return ex(q, think, a, qv, 'div')


UNITS = [('din', 'ghanta', 24), ('ghanta', 'minute', 60), ('minute', 'second', 60), ('hapta', 'din', 7), ('barsha', 'mahina', 12),
         ('kilometer', 'meter', 1000), ('meter', 'centimeter', 100), ('kilo', 'gram', 1000), ('liter', 'milliliter', 1000), ('darjan', 'wata', 12),
         ('rupiya', 'paisa', 100)]


def units(R):
    big, small, f = pick(R, UNITS)
    k = 1 if R.random() < 0.35 else R.randint(2, 12)
    if k == 1:
        q = pick(R, [f'ek {big} ma kati {small} hunchha?', f'1 {big} = kati {small}?', f'{big} ma kati {small}?'])
        return ex(q, f'yo napne ekai ko niyam ho: ek {big} barabar {f} {small}.', f'ek {big} ma {f} {small} hunchha.', f, 'units')
    q = pick(R, [f'{k} {big} ma kati {small}?', f'{k} {big} lai {small} ma lekha.'])
    return ex(q, f'ek {big} ma {f} {small} hunchha. {k} {big} ma {k} x {f} = {k * f} {small}.', f'{k} {big} ma {k * f} {small} hunchha.', k * f, 'units')


def dec_compare(R):
    a = R.randint(1, 99) / (10 if R.random() < 0.5 else 100)
    b = R.randint(1, 99) / (10 if R.random() < 0.5 else 100)
    if a == b:
        b = round(b + 0.01, 2)
    sa, sb = f'{a:g}', f'{b:g}'
    pa, pb = f'{a:.2f}', f'{b:.2f}'
    big = sa if a > b else sb
    q = pick(R, [f'kun thulo: {sa} ki {sb}?', f'{sa} ra {sb} madhye kun thulo?', f'which is bigger, {sa} or {sb}?'])
    ia, fa = pa.split('.'); ib, fb = pb.split('.')
    if ia != ib:
        think = f'pahila purnanka bhag herchhu: {sa} ko {ia} ra {sb} ko {ib}. {max(int(ia), int(ib))} thulo, tyasaile {big} thulo.'
    else:
        think = (f'purnanka bhag barabar ({ia}). dashamlav pachhi ank barabar banaunchhu: {sa} = {pa}, {sb} = {pb}. '
                 f'saya bhag ma tulana: {fa} ra {fb}. {max(fa, fb)} thulo, tyasaile {big} thulo.')
    return ex(q, think, f'{big} thulo ho.', big, 'decimal')


FAMILIES = [(col_add, 3), (col_sub, 3), (col_mul, 4), (col_div, 2), (units, 1), (dec_compare, 0.8)]


def sample(R):
    return R.choices([f for f, _ in FAMILIES], weights=[w for _, w in FAMILIES])[0](R)
