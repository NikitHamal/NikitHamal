"""Math teacher: problem families with correct, step-by-step solutions in grammatical
romanized Nepali. Every number is computed exactly; the auditor re-checks every
equation. Each generator returns dict(q, think, a, gold, kind).

Style: short numbered reasoning ("pahila ... ani ... antama ..."), equations written
with + - x / =, a closing "jaach" (check) where it makes sense, and a full-sentence answer.
"""
from fractions import Fraction
import math
import random

from verify import fmt

NAMES = ['ram', 'sita', 'hari', 'gita', 'bikash', 'anita', 'suman', 'pooja', 'nabin', 'sarita', 'kiran', 'asha', 'dipak', 'maya',
         'rojan', 'sujata', 'pemba', 'dolma', 'aayush', 'srijana', 'roshan', 'binita', 'sagar', 'nisha', 'prakash', 'manisha']
ITEMS = [('syau', 'wata'), ('suntala', 'wata'), ('kalam', 'wata'), ('kitab', 'wata'), ('kapi', 'wata'), ('kera', 'wata'),
         ('aanp', 'wata'), ('chakleti', 'wata'), ('ball', 'wata'), ('pencil', 'wata'), ('momo', 'plate'), ('chiya', 'cup')]
PLACES = ['pokhara', 'butwal', 'dharan', 'chitwan', 'biratnagar', 'nepalgunj', 'janakpur', 'dhangadhi', 'hetauda', 'ilam']


def pick(R, xs):
    return R.choice(xs)


def ex(q, think, a, gold, kind):
    return {'q': q, 'think': think, 'a': a, 'gold': fmt(gold) if not isinstance(gold, str) else gold, 'kind': kind}


# ---------------------------------------------------------------- arithmetic
PLACE = ['ek', 'das', 'saya', 'hajar', 'das hajar', 'lakh', 'das lakh']


def add_column(R):
    a, b = R.randint(100, 99999), R.randint(10, 9999)
    da, db = str(a)[::-1], str(b)[::-1]
    steps, carry, digits = [], 0, []
    for i in range(max(len(da), len(db))):
        x = int(da[i]) if i < len(da) else 0
        y = int(db[i]) if i < len(db) else 0
        s = x + y + carry
        expr = f'{x} + {y}' + (f' + {carry}' if carry else '')
        steps.append(f'{PLACE[i]} ko thau: {expr} = {s}' + (f', {s % 10} lekhne ra {s // 10} hasil lane' if s >= 10 else ''))
        digits.append(s % 10); carry = s // 10
    if carry:
        steps.append(f'antim hasil {carry} sabai bhanda agadi lekhne')
    c = a + b
    q = pick(R, [f'{a} + {b} kati hunchha?', f'{a} ra {b} jodda kati hunchha?', f'{a} ma {b} thapda kati hunchha?', f'jod garnus: {a} + {b}'])
    think = f'yo jod ho, tyasaile ek ko thau bata suru garchhu. ' + '. '.join(steps) + f'. tyasaile {a} + {b} = {c}. jaach: {c} - {b} = {a}, milyo.'
    return ex(q, think, pick(R, [f'{a} + {b} = {c} hunchha.', f'jawaf {c} ho.', f'{a} ra {b} jodda {c} hunchha.']), c, 'add')


def sub_column(R):
    a, b = sorted([R.randint(100, 99999), R.randint(10, 9999)], reverse=True)
    da, db = [int(c) for c in str(a)[::-1]], [int(c) for c in str(b)[::-1]]
    steps, borrow = [], 0
    for i in range(len(da)):
        x, y = da[i] - borrow, (db[i] if i < len(db) else 0)
        if x < y:
            steps.append(f'{PLACE[i]} ko thau: {x} bata {y} ghatdaina, tyasaile agadi bata 1 saapat line: {x + 10} - {y} = {x + 10 - y}')
            borrow = 1
        else:
            steps.append(f'{PLACE[i]} ko thau: {x} - {y} = {x - y}')
            borrow = 0
    c = a - b
    q = pick(R, [f'{a} - {b} kati hunchha?', f'{a} bata {b} ghataunus.', f'{a} ma bata {b} jhikda kati baki rahanchha?'])
    think = 'yo ghatau ho, ek ko thau bata suru garchhu. ' + '. '.join(steps) + f'. tyasaile {a} - {b} = {c}. jaach: {c} + {b} = {a}, milyo.'
    return ex(q, think, pick(R, [f'{a} - {b} = {c} hunchha.', f'jawaf {c} ho.']), c, 'sub')


def mul_partial(R):
    a, b = R.randint(12, 999), R.randint(3, 99)
    if b < 10:
        parts = [int(c) * 10 ** i for i, c in enumerate(str(a)[::-1]) if c != '0'][::-1]
        lines = [f'{p} x {b} = {p * b}' for p in parts]
        think = (f'{a} lai tukra ma chhutyaunchhu: {" + ".join(map(str, parts))}. ani pratyek tukra lai {b} le gunchhu: '
                 + ', '.join(lines) + f'. aba jodchhu: {" + ".join(str(p * b) for p in parts)} = {a * b}.')
    else:
        t, o = b // 10 * 10, b % 10
        think = (f'{b} lai {t} + {o} ma chhutyaunchhu. {a} x {t} = {a * t}. '
                 + (f'{a} x {o} = {a * o}. ' if o else '') + (f'jodda {a * t} + {a * o} = {a * b}.' if o else f'tyasaile jawaf {a * b}.'))
    think += f' jaach: {a * b} / {b} = {a}, milyo.'
    q = pick(R, [f'{a} x {b} kati hunchha?', f'{a} lai {b} le gunan garda kati hunchha?', f'{a} guna {b} kati?'])
    return ex(q, think, pick(R, [f'{a} x {b} = {a * b} hunchha.', f'jawaf {a * b} ho.']), a * b, 'mul')


def division(R):
    b, c = R.randint(2, 25), R.randint(3, 200)
    r = R.choice([0, 0, R.randint(1, b - 1)])
    a = b * c + r
    q = pick(R, [f'{a} lai {b} le bhag garda kati aauchha?', f'{a} / {b} kati hunchha?', f'{a} wata chakleti {b} jana lai barabar bandda ek jana le kati paunchha?'])
    think = f'{b} le {a} ma kati palta pugchha bhanera hernu parchha. {b} x {c} = {b * c}.'
    if r:
        think += f' {a} - {b * c} = {r}, yo {b} bhanda sano chha, tyasaile yo baki ho.'
        ans = f'{a} lai {b} le bhag garda {c} aauchha ra {r} baki rahanchha.'
        if 'chakleti' in q:
            ans = f'ek jana le {c} wata chakleti paunchha ra {r} wata baki rahanchha.'
    else:
        think += f' tyasaile {a} / {b} = {c}, kei baki rahadaina.'
        ans = f'{a} / {b} = {c} hunchha.' if 'chakleti' not in q else f'ek jana le {c} wata chakleti paunchha.'
    think += f' jaach: {b} x {c} + {r} = {a}, milyo.' if r else f' jaach: {b} x {c} = {a}, milyo.'
    return ex(q, think, ans, c, 'div')


# ---------------------------------------------------------------- fractions, percent, money
def fraction_add(R):
    a, b, c, d = R.randint(1, 5), R.randint(2, 9), R.randint(1, 5), R.randint(2, 9)
    if a >= b or c >= d:
        return fraction_add(R)
    l = b * d // math.gcd(b, d)
    s = Fraction(a, b) + Fraction(c, d)
    think = (f'har ma farak chha ({b} ra {d}), tyasaile pahila saman har banaunchhu. {b} ra {d} ko lasa {l} ho. '
             f'{a}/{b} = {a * l // b}/{l} ani {c}/{d} = {c * l // d}/{l}. aba ansh jodchhu: {a * l // b}/{l} + {c * l // d}/{l} = {a * l // b + c * l // d}/{l}.')
    if s.denominator != l:
        think += f' yaslai saral garda {a * l // b + c * l // d}/{l} = {fmt(s)} hunchha.'
    q = pick(R, [f'{a}/{b} + {c}/{d} kati hunchha?', f'bhinna jodnus: {a}/{b} ra {c}/{d}'])
    return ex(q, think, f'{a}/{b} + {c}/{d} = {fmt(s)} hunchha.', s, 'fraction')


def fraction_of(R):
    d = R.choice([2, 3, 4, 5, 8, 10]); n = R.randint(1, d - 1); k = R.randint(2, 30) * d
    v = Fraction(n, d) * k
    it, unit = pick(R, ITEMS)
    q = pick(R, [f'{k} ko {n}/{d} bhag kati hunchha?', f'{pick(R, NAMES)} sanga {k} {unit} {it} chha. usle {n}/{d} bhag sathi lai diyo. kati {unit} diyo?'])
    think = f'{k} ko {n}/{d} bhaneko {k} lai {d} barabar bhag garera {n} bhag line ho. {k} / {d} = {k // d}. ani {k // d} x {n} = {fmt(v)}.'
    a = f'{k} ko {n}/{d} bhag {fmt(v)} hunchha.' if 'ko' in q.split()[1] else f'usle {fmt(v)} {unit} {it} diyo.'
    return ex(q, think, a, v, 'fraction')


def percent_of(R):
    p, n = R.choice([5, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75]), R.choice([40, 60, 80, 120, 150, 200, 240, 300, 400, 500, 800, 1200, 2000])
    v = Fraction(p * n, 100)
    if v.denominator != 1:
        return percent_of(R)
    q = pick(R, [f'{n} ko {p} pratishat kati hunchha?', f'{n} ko {p}% kati?'])
    think = f'pratishat bhaneko saya ma kati bhanne ho. {n} ko {p}% = {n} x {p} / 100. {n} x {p} = {n * p}. ani {n * p} / 100 = {fmt(v)}.'
    return ex(q, think, f'{n} ko {p}% {fmt(v)} hunchha.', v, 'percent')


def discount(R):
    price, p = R.choice([400, 500, 800, 1000, 1200, 1500, 2000, 2500, 3000]), R.choice([10, 15, 20, 25, 30, 40])
    off = price * p // 100
    q = f'euta jacket ko mol {price} rupiya chha. pasal le {p}% chhut diyo bhane aba kati tirnu parchha?'
    think = f'pahila chhut kati bhayo nikalchhu: {price} x {p} / 100 = {off} rupiya. ani mol bata chhut ghataunchhu: {price} - {off} = {price - off} rupiya.'
    return ex(q, think, f'chhut pachhi {price - off} rupiya tirnu parchha.', price - off, 'percent')


def shopping(R):
    n = pick(R, NAMES)
    k = R.randint(2, 3)
    chosen = R.sample(ITEMS[:10], k)
    rows = [(it, R.randint(2, 6), R.choice([5, 10, 15, 20, 25, 30, 40, 50])) for it, _ in chosen]
    total = sum(q * p for _, q, p in rows)
    paid = next(x for x in [100, 200, 500, 1000] if x >= total)
    desc = ', '.join(f'{q} wata {it} (ek ko {p} rupiya)' for it, q, p in rows)
    q = f'{n} le pasal bata {desc} kinyo. usle pasale lai {paid} rupiya diyo bhane kati firta paunchha?'
    think = ('pahila pratyek saman ko mol nikalchhu: ' + ', '.join(f'{it}: {qq} x {p} = {qq * p}' for it, qq, p in rows)
             + f'. jamma kharcha: {" + ".join(str(qq * p) for _, qq, p in rows)} = {total} rupiya. ani firta: {paid} - {total} = {paid - total} rupiya.')
    return ex(q, think, f'{n} le {paid - total} rupiya firta paunchha.', paid - total, 'money')


def profit_loss(R):
    cost = R.choice([200, 400, 500, 800, 1000, 1500, 2000])
    p = R.choice([10, 20, 25, 30, 50])
    gain = R.random() < 0.6
    sell = cost + cost * p // 100 if gain else cost - cost * p // 100
    q = f'euta pasale le {cost} rupiya ma saman kinera {sell} rupiya ma bechyo. nafa bhayo ki noksan, ra kati pratishat?'
    diff = abs(sell - cost)
    word = 'nafa' if gain else 'noksan'
    think = (f'bechne mol {sell} ra kinne mol {cost}. {"bechne mol thulo" if gain else "bechne mol sano"} chha, tyasaile {word} bhayo. '
             f'farak: {max(sell, cost)} - {min(sell, cost)} = {diff} rupiya. pratishat: {diff} / {cost} x 100 = {p}.')
    return ex(q, think, f'{diff} rupiya {word} bhayo, jun {p}% ho.', p, 'money')


def simple_interest(R):
    P, r, t = R.choice([1000, 2000, 5000, 10000, 20000, 50000]), R.choice([5, 6, 8, 10, 12]), R.randint(1, 5)
    I = P * r * t // 100
    q = f'{P} rupiya bank ma {r}% barshik sadharan byaj ma {t} barsha rakhda kati byaj aauchha?'
    think = f'sadharan byaj = mool x dar x samaya / 100. {P} x {r} x {t} / 100 = {I}. jamma rakam: {P} + {I} = {P + I} rupiya.'
    return ex(q, think, f'{t} barsha ma {I} rupiya byaj aauchha, ra jamma rakam {P + I} rupiya hunchha.', I, 'money')


# ---------------------------------------------------------------- measurement, rate
def average(R):
    k = R.randint(3, 6)
    xs = [R.randint(30, 99) for _ in range(k)]
    s = sum(xs)
    if s % k:
        xs[-1] += k - s % k
        s = sum(xs)
    n = pick(R, NAMES)
    q = f'{n} le {k} wata parikshya ma {", ".join(map(str, xs))} ank lyayo. usko ausat ank kati ho?'
    think = f'ausat = jamma / sankhya. jamma: {" + ".join(map(str, xs))} = {s}. sankhya {k}. {s} / {k} = {s // k}.'
    return ex(q, think, f'{n} ko ausat ank {s // k} ho.', s // k, 'average')


def speed(R):
    v, t = R.choice([20, 30, 40, 45, 50, 60, 80]), R.randint(2, 6)
    d = v * t
    a, b = R.sample(PLACES, 2)
    kind = R.random()
    if kind < 0.4:
        q = f'euta bus {v} kilometer prati ghanta ko gati ma {t} ghanta chalyo. kati kilometer duri pār garyo?'.replace('pār', 'paar')
        think = f'duri = gati x samaya. {v} x {t} = {d} kilometer.'
        return ex(q, think, f'bus le {d} kilometer duri paar garyo.', d, 'speed')
    if kind < 0.7:
        q = f'{a} bata {b} samma {d} kilometer chha. gadi {v} kilometer prati ghanta ma gayo bhane kati ghanta lagchha?'
        think = f'samaya = duri / gati. {d} / {v} = {t} ghanta.'
        return ex(q, think, f'{t} ghanta lagchha.', t, 'speed')
    q = f'euta motorcycle le {t} ghanta ma {d} kilometer paar garyo. usko gati kati ho?'
    think = f'gati = duri / samaya. {d} / {t} = {v} kilometer prati ghanta.'
    return ex(q, think, f'motorcycle ko gati {v} kilometer prati ghanta ho.', v, 'speed')


def units(R):
    k = R.random()
    if k < 0.25:
        km = R.randint(2, 40); return ex(f'{km} kilometer ma kati meter hunchha?', f'1 kilometer = 1000 meter. {km} x 1000 = {km * 1000}.', f'{km} kilometer ma {km * 1000} meter hunchha.', km * 1000, 'units')
    if k < 0.5:
        h, m = R.randint(1, 9), R.randint(0, 59)
        return ex(f'{h} ghanta {m} minet ma jamma kati minet hunchha?', f'1 ghanta = 60 minet. {h} x 60 = {h * 60}. ani {h * 60} + {m} = {h * 60 + m}.',
                  f'jamma {h * 60 + m} minet hunchha.', h * 60 + m, 'units')
    if k < 0.75:
        g = R.choice([250, 500, 750, 1500, 2500, 3250])
        return ex(f'{g} gram lai kilo ma lekhda kati hunchha?', f'1000 gram = 1 kilo. {g} / 1000 = {fmt(Fraction(g, 1000))}.',
                  f'{g} gram bhaneko {fmt(Fraction(g, 1000))} kilo ho.', Fraction(g, 1000), 'units')
    mins = R.randint(61, 400)
    return ex(f'{mins} minet bhaneko kati ghanta ra kati minet ho?', f'1 ghanta = 60 minet. 60 x {mins // 60} = {60 * (mins // 60)}. {mins} - {60 * (mins // 60)} = {mins % 60}.',
              f'{mins} minet bhaneko {mins // 60} ghanta {mins % 60} minet ho.', mins // 60, 'units')


def geometry(R):
    k = R.random()
    if k < 0.35:
        l, w = R.randint(3, 30), R.randint(2, 20)
        return ex(f'euta kotha ko lambai {l} meter ra chaudai {w} meter chha. kotha ko kshetrafal kati ho?',
                  f'aayat ko kshetrafal = lambai x chaudai. {l} x {w} = {l * w} barga meter.', f'kotha ko kshetrafal {l * w} barga meter ho.', l * w, 'geometry')
    if k < 0.65:
        l, w = R.randint(3, 40), R.randint(2, 30)
        p = 2 * (l + w)
        return ex(f'{l} meter lamo ra {w} meter chaudai bagaincha ko charaitira bar lagauna kati meter taar chahinchha?',
                  f'charaitira ko lambai bhaneko paridhi ho. aayat ko paridhi = 2 x (lambai + chaudai). 2 x ({l} + {w}) = 2 x {l + w} = {p} meter.',
                  f'{p} meter taar chahinchha.', p, 'geometry')
    b, h = R.randint(2, 20) * 2, R.randint(2, 20)
    return ex(f'euta tribhuj ko aadhar {b} cm ra uchai {h} cm chha. kshetrafal kati ho?',
              f'tribhuj ko kshetrafal = 1/2 x aadhar x uchai. 1/2 x {b} x {h} = {b * h // 2} barga cm.', f'tribhuj ko kshetrafal {b * h // 2} barga cm ho.', b * h // 2, 'geometry')


# ---------------------------------------------------------------- algebra, number theory
def linear_eq(R):
    x, a, b = R.randint(1, 30), R.randint(2, 9), R.randint(1, 50)
    c = a * x + b
    q = pick(R, [f'{a}x + {b} = {c} bhaye x kati hunchha?', f'yo samikaran solve garnus: {a}x + {b} = {c}'])
    think = f'x eklai rakhna pahila dubai tira bata {b} ghataunchhu: {c} - {b} = {c - b}, tyasaile {a}x = {c - b}. ani dubai tira {a} le bhag garchhu: {c - b} / {a} = {x}. jaach: {a} x {x} + {b} = {c}, milyo.'
    return ex(q, think, f'x = {x} hunchha.', x, 'algebra')


def ratio(R):
    a, b, k = R.randint(1, 5), R.randint(1, 5), R.randint(10, 200)
    n1, n2 = pick(R, NAMES), pick(R, NAMES)
    if n1 == n2 or a == b:
        return ratio(R)
    total = (a + b) * k
    q = f'{n1} ra {n2} le {total} rupiya {a}:{b} ko anupat ma bandne bhaye. kasle kati paunchha?'
    think = f'anupat {a}:{b} bhaneko jamma {a} + {b} = {a + b} bhag. ek bhag = {total} / {a + b} = {k}. {n1}: {a} x {k} = {a * k}. {n2}: {b} x {k} = {b * k}. jaach: {a * k} + {b * k} = {total}, milyo.'
    return ex(q, think, f'{n1} le {a * k} rupiya ra {n2} le {b * k} rupiya paunchha.', a * k, 'ratio')


def lcm_hcf(R):
    a, b = R.randint(4, 60), R.randint(4, 60)
    if a == b:
        return lcm_hcf(R)
    g = math.gcd(a, b); l = a * b // g
    if R.random() < 0.5:
        think = f'{a} ra {b} dubai lai nisheshh bhag garne sabai bhanda thulo sankhya khojchhu. {a} / {g} = {a // g} ra {b} / {g} = {b // g}, ra {a // g} ra {b // g} ko sajha gunankhanda chhaina. tyasaile mahattam samapavartak {g} ho.'
        return ex(f'{a} ra {b} ko mahattam samapavartak (masa) kati ho?', think.replace('nisheshh', 'nishesh'), f'{a} ra {b} ko masa {g} ho.', g, 'numtheory')
    think = f'lasa = (pahilo x dosro) / masa. {a} ra {b} ko masa {g}. ({a} x {b}) / {g} = {a * b} / {g} = {l}.'
    return ex(f'{a} ra {b} ko laghuttam samapavartya (lasa) kati ho?', think, f'{a} ra {b} ko lasa {l} ho.', l, 'numtheory')


def prime_check(R):
    n = R.randint(11, 150)
    divs = [d for d in range(2, int(n ** 0.5) + 1) if n % d == 0]
    if divs:
        d = divs[0]
        think = f'{n} lai 2 dekhi {int(n ** 0.5)} samma ka sankhya le bhag gari hernu parchha. {n} / {d} = {n // d}, nishesh bhag lagyo. tyasaile {n} ruddha sankhya haina.'
        return ex(f'{n} ruddha (prime) sankhya ho?', think, f'haina, {n} ruddha sankhya haina, kinaki {d} x {n // d} = {n}.', 'haina', 'numtheory')
    think = f'{n} lai 2 dekhi {int(n ** 0.5)} samma ka kunai pani sankhya le nishesh bhag lagdaina. tyasaile {n} ruddha sankhya ho.'
    return ex(f'{n} ruddha (prime) sankhya ho?', think, f'ho, {n} ruddha sankhya ho.', 'ho', 'numtheory')


def squares(R):
    n = R.randint(4, 35)
    if R.random() < 0.5:
        return ex(f'{n} ko barga kati hunchha?', f'barga bhaneko sankhya lai afai sanga gunnu ho. {n} x {n} = {n * n}.', f'{n} ko barga {n * n} ho.', n * n, 'power')
    return ex(f'{n * n} ko bargamul kati ho?', f'kun sankhya lai afai sanga gunda {n * n} aauchha khojchhu. {n} x {n} = {n * n}.', f'{n * n} ko bargamul {n} ho.', n, 'power')


# ---------------------------------------------------------------- multi-step word problems
def bus_passengers(R):
    s, on1, off1, on2 = R.randint(10, 40), R.randint(3, 15), R.randint(2, 10), R.randint(2, 12)
    off1 = min(off1, s + on1)
    end = s + on1 - off1 + on2
    a, b = R.sample(PLACES, 2)
    q = f'euta bus ma suru ma {s} jana yatru thiye. {a} ma {on1} jana chadhe ra {off1} jana orle. {b} ma pheri {on2} jana chadhe. aba bus ma kati jana chhan?'
    think = f'suru ma {s}. {a} ma chadhe: {s} + {on1} = {s + on1}. orle: {s + on1} - {off1} = {s + on1 - off1}. {b} ma chadhe: {s + on1 - off1} + {on2} = {end}.'
    return ex(q, think, f'aba bus ma {end} jana yatru chhan.', end, 'multistep')


def ages(R):
    n1, n2 = R.sample(NAMES, 2)
    a2, d, t = R.randint(5, 30), R.randint(2, 15), R.randint(2, 10)
    q = f'{n1} {n2} bhanda {d} barsha jetho chha. {n2} ko umer ahile {a2} barsha chha. {t} barsha pachhi {n1} ko umer kati hunchha?'
    think = f'pahila {n1} ko ahile ko umer: {a2} + {d} = {a2 + d} barsha. {t} barsha pachhi: {a2 + d} + {t} = {a2 + d + t} barsha.'
    return ex(q, think, f'{t} barsha pachhi {n1} {a2 + d + t} barsha ko hunchha.', a2 + d + t, 'multistep')


def savings(R):
    n = pick(R, NAMES)
    per, weeks, goal = R.choice([50, 100, 150, 200, 250]), R.randint(3, 12), None
    have = per * weeks
    price = R.choice([x for x in [500, 800, 1000, 1500, 2000, 2500, 3000] if x > have] or [have + 500])
    q = f'{n} le har hapta {per} rupiya bachat garchha. {weeks} hapta pachhi usle {price} rupiya ko cycle kinna kati paisa pugdaina?'
    think = f'{weeks} hapta ko bachat: {per} x {weeks} = {have} rupiya. cycle ko mol {price}. pugna baki: {price} - {have} = {price - have} rupiya.'
    return ex(q, think, f'{n} lai ajhai {price - have} rupiya chahinchha.', price - have, 'multistep')


def clock(R):
    h, m = R.randint(6, 10), R.choice([0, 15, 30, 45, 10, 20, 40, 50])
    dh, dm = R.randint(1, 4), R.choice([15, 30, 45, 20, 50, 35])
    tot = m + dm
    eh, em = h + dh + tot // 60, tot % 60
    q = f'school ko class bihana {h}:{m:02d} baje suru bhayo ra {dh} ghanta {dm} minet chalyo. class kati baje sakiyo?'
    think = f'minet jodchhu: {m} + {dm} = {tot}.' + (f' {tot} minet = 1 ghanta {tot - 60} minet.' if tot >= 60 else '') + f' ghanta: {h} + {dh}' + (' + 1' if tot >= 60 else '') + f' = {eh}.'
    return ex(q, think + f' tyasaile {eh}:{em:02d}.', f'class {eh}:{em:02d} baje sakiyo.', f'{eh}:{em:02d}', 'time')


FAMILIES = [(add_column, 3), (sub_column, 3), (mul_partial, 3), (division, 2), (fraction_add, 2), (fraction_of, 2), (percent_of, 2),
            (discount, 1.5), (shopping, 2), (profit_loss, 1.5), (simple_interest, 1.5), (average, 1.5), (speed, 2), (units, 2),
            (geometry, 2), (linear_eq, 2), (ratio, 1.5), (lcm_hcf, 1.5), (prime_check, 1), (squares, 1), (bus_passengers, 1.5),
            (ages, 1.5), (savings, 1.5), (clock, 1)]


def sample(R):
    f = R.choices([f for f, _ in FAMILIES], weights=[w for _, w in FAMILIES])[0]
    return f(R)
