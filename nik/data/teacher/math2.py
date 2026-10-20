"""Second wave of teacher families: deeper math skills, decisions under numbers,
distractors, and verification. Same contract as math_gen: dict(q, think, a, gold, kind)."""
from fractions import Fraction
import math
import random

from math_gen import ITEMS, NAMES, PLACES, ex, pick
from verify import fmt

NUM = ('shunya ek dui tin char pach chha sat aath nau das eghara bahra tera chaudha pandhra sorha satra athara unnais '
       'bis ekkais bais teis chaubis pachchis chhabbis sattais atthais unantis tis ekattis battis tettis chauntis paitis '
       'chhattis saitis athtis unanchalis chalis ekchalis bayalis trichalis chawalis paintalis chhayalis satchalis athchalis '
       'unanchas pachas ekaunna bauanna tripanna chauanna pachpanna chhapanna santaunna anthaunna unansathi sathi eksathi '
       'baisatthi trisatthi chausatthi painsatthi chhaisatthi satsatthi athsatthi unanshattari sattari ekahattar bahattar '
       'trihattar chauhattar pachahattar chhahattar sathattar athahattar unanasi asi ekasi bayasi triyasi chaurasi pachasi '
       'chhayasi sataasi athasi unannabbe nabbe ekanabbe bayanabbe triyanabbe chauranabbe panchanabbe chhayanabbe santanabbe '
       'anthanabbe unansaya').split()


def words(n):
    if n < 100:
        return NUM[n]
    out = []
    for u, w in ((10 ** 7, 'karod'), (10 ** 5, 'lakh'), (1000, 'hajar'), (100, 'saya')):
        if n >= u:
            q, n = divmod(n, u)
            out.append(f'{words(q)} {w}')
    if n:
        out.append(NUM[n])
    return ' '.join(out)


def bodmas(R):
    a, b, c = R.randint(2, 20), R.randint(2, 9), R.randint(2, 9)
    k = R.random()
    if k < 0.4:
        e, v = f'{a} + {b} x {c}', a + b * c
        think = f'gunan pahila garnu parchha (BODMAS). {b} x {c} = {b * c}. ani {a} + {b * c} = {v}. baya bata sidhai garda ({a} + {b}) x {c} aaunthyo, jun galat ho.'
    elif k < 0.7:
        d = R.randint(2, 6); bc = b * d
        e, v = f'{a} - {bc} / {d}', a - b
        think = f'bhag pahila garnu parchha. {bc} / {d} = {b}. ani {a} - {b} = {v}.'
    else:
        e, v = f'({a} + {b}) x {c}', (a + b) * c
        think = f'koshṭha bhitra ko pahila: {a} + {b} = {a + b}. ani {a + b} x {c} = {v}.'.replace('ṭ', 't')
    return ex(f'{e} kati hunchha?', think, f'{e} = {v} hunchha.', v, 'bodmas')


def decimals(R):
    a, b = R.randint(100, 9999) / 100, R.randint(100, 9999) / 100
    s = round(a + b, 2)
    n = pick(R, NAMES)
    q = f'{n} le {a:.2f} rupiya ko chiya ra {b:.2f} rupiya ko biskut kinyo. jamma kati rupiya bhayo?'
    think = f'dasamlab milayera jodchhu: {a:.2f} + {b:.2f} = {fmt(Fraction(s).limit_denominator(100))}.'
    return ex(q, think, f'jamma {fmt(Fraction(s).limit_denominator(100))} rupiya bhayo.', Fraction(s).limit_denominator(100), 'decimal')


def temperature(R):
    t0, d = R.randint(-12, 8), R.randint(3, 20)
    up = R.random() < 0.6
    t1 = t0 + d if up else t0 - d
    place = pick(R, ['jumla', 'mustang', 'solukhumbu', 'dolpa', 'humla'])
    q = f'{place} ma bihana tapkram {t0} degree thiyo. diuso samma {d} degree {"badhyo" if up else "ghatyo"}. aba tapkram kati bhayo?'
    think = f'{"badhda jodne" if up else "ghatda ghataune"}: {t0} {"+" if up else "-"} {d} = {t1}.'
    return ex(q, think.replace('+ -', '- ').replace('- -', '+ '), f'aba tapkram {t1} degree bhayo.', t1, 'negative')


def percent_change(R):
    old = R.choice([200, 400, 500, 800, 1000, 1200, 1500, 2000, 25000, 40000])
    p = R.choice([5, 10, 15, 20, 25, 50])
    up = R.random() < 0.6
    new = old + old * p // 100 if up else old - old * p // 100
    q = f'kunai saman ko mol {old} rupiya bata {new} rupiya bhayo. mol kati pratishat {"badhyo" if up else "ghatyo"}?'
    think = f'farak: {max(old, new)} - {min(old, new)} = {abs(new - old)}. pratishat farak sadhai purano mol sanga tulana garinchha: {abs(new - old)} / {old} x 100 = {p}.'
    return ex(q, think, f'mol {p}% {"badhyo" if up else "ghatyo"}.', p, 'percent')


def compound(R):
    P, r = R.choice([1000, 2000, 5000, 10000]), R.choice([10, 20])
    y1 = P * (100 + r) // 100; y2 = y1 * (100 + r) // 100
    q = f'{P} rupiya {r}% barshik chakriya byaj ma 2 barsha rakhda jamma kati hunchha?'
    think = f'chakriya byaj ma har barsha ko byaj pani mool ma judchha. pahilo barsha: {P} x {100 + r} / 100 = {y1}. dosro barsha: {y1} x {100 + r} / 100 = {y2}. sadharan byaj bhanda {y2 - P - 2 * P * r // 100} rupiya badhi.'
    return ex(q, think, f'2 barsha pachhi jamma {y2} rupiya hunchha.', y2, 'money')


def best_buy(R):
    item = pick(R, ['chamal', 'chini', 'daal', 'aata'])
    q1, p1 = R.choice([2, 5, 10]), None
    q2 = R.choice([x for x in [1, 3, 4, 25] if x != q1])
    u1, u2 = R.randint(60, 140), R.randint(60, 140)
    if u1 == u2:
        u2 += 3
    p1, p2 = q1 * u1, q2 * u2
    q = f'{q1} kilo {item} ko packet {p1} rupiya ma ra {q2} kilo ko packet {p2} rupiya ma paincha. prati kilo kun sasto chha?'
    better = 1 if u1 < u2 else 2
    think = f'prati kilo mol nikalera tulana garchhu. pahilo: {p1} / {q1} = {u1} rupiya prati kilo. dosro: {p2} / {q2} = {u2} rupiya prati kilo. {min(u1, u2)} sano chha.'
    a = f'{(q1, q2)[better - 1]} kilo ko packet sasto chha, prati kilo {min(u1, u2)} rupiya.'
    return ex(q, think, a, min(u1, u2), 'decision')


def work_rate(R):
    a, b = R.choice([(6, 3), (12, 6), (10, 15), (4, 12), (20, 30), (6, 12), (8, 24)])
    n1, n2 = R.sample(NAMES, 2)
    t = Fraction(a * b, a + b)
    q = f'{n1} le euta kaam {a} din ma sakchha ra {n2} le {b} din ma. duitai milera garda kati din lagchha?'
    think = f'ek din ma {n1} le kaam ko 1/{a} bhag ra {n2} le 1/{b} bhag garchhan. sangai: 1/{a} + 1/{b} = {fmt(Fraction(1, a) + Fraction(1, b))} bhag prati din. pura kaam: 1 / ({fmt(Fraction(1, a) + Fraction(1, b))}) = {fmt(t)} din.'
    return ex(q, think, f'duitai milera {fmt(t)} din ma kaam sakchhan.', t, 'rate')


def probability(R):
    r, b = R.randint(1, 9), R.randint(1, 9)
    tot = r + b
    q = f'euta jhola ma {r} wata rato ra {b} wata nilo ball chhan. aankha chimlera euta ball jhikda rato aaune sambhawana kati?'
    think = f'jamma ball: {r} + {b} = {tot}. rato aaune tarika {r}. sambhawana = {r} / {tot}' + (f' = {fmt(Fraction(r, tot))}.' if Fraction(r, tot).denominator != tot else '.')
    return ex(q, think, f'rato aaune sambhawana {fmt(Fraction(r, tot))} ho.', Fraction(r, tot), 'probability')


def stats(R):
    xs = sorted(R.randint(10, 60) for _ in range(R.choice([5, 7])))
    med = xs[len(xs) // 2]
    q = f'yi sankhya ko madhyika (median) kati ho: {", ".join(map(str, R.sample(xs, len(xs))))}?'
    think = f'pahila sano bata thulo kram ma milauchhu: {", ".join(map(str, xs))}. {len(xs)} wata sankhya chhan, bich ko {len(xs) // 2 + 1} au sankhya {med} ho.'
    return ex(q, think, f'madhyika {med} ho.', med, 'stats')


def rounding(R):
    n = R.randint(1000, 99999)
    k = R.choice([10, 100, 1000])
    r = int(math.floor(n / k + 0.5)) * k
    name = {10: 'das', 100: 'saya', 1000: 'hajar'}[k]
    think = f'najik ko {name} ma laijana {name} bhanda tala ko ank herchhu. {n} ma tyo ank {(n // (k // 10)) % 10 if k > 1 else 0} ho, ' + ('5 wa badhi bhayeko le mathi.' if (n % k) >= k // 2 else '5 bhanda kam bhayeko le tala.')
    return ex(f'{n} lai najik ko {name} ma round garda kati hunchha?', think, f'{n} lai najik ko {name} ma round garda {r} hunchha.', r, 'rounding')


def number_words(R):
    n = R.choice([R.randint(11, 99), R.randint(101, 999), R.randint(1001, 99999), R.randint(100000, 9999999)])
    w = words(n)
    q = pick(R, [f'{n} lai nepali shabda ma kasari lekhne?', f'{n} lai shabda ma lekhnus.'])
    parts = []
    m = n
    for u, nm in ((10 ** 7, 'karod'), (10 ** 5, 'lakh'), (1000, 'hajar'), (100, 'saya')):
        if m >= u:
            parts.append(f'{m // u} {nm}'); m %= u
    if m:
        parts.append(str(m))
    think = 'nepali ma karod, lakh, hajar, saya ra baki dui ank ko samuha banaunchhu: ' + ' + '.join(parts) + '.'
    return ex(q, think, f'{n} lai "{w}" lekhinchha.', w, 'words')


def volume(R):
    l, w, h = R.randint(2, 20), R.randint(2, 15), R.randint(2, 10)
    return ex(f'{l} cm lamo, {w} cm chaudai ra {h} cm aglo box ma kati ghan cm thau hunchha?',
              f'aayatakar box ko aayatan = lambai x chaudai x uchai. {l} x {w} = {l * w}. ani {l * w} x {h} = {l * w * h}.',
              f'box ko aayatan {l * w * h} ghan cm ho.', l * w * h, 'geometry')


def consecutive(R):
    x = R.randint(5, 80)
    s = 3 * x + 3
    q = f'lagatar aune tin wata sankhya ko jod {s} chha. ti sankhya kun kun hun?'
    think = f'sankhya lai x, x + 1 ra x + 2 maanchhu. jod: 3x + 3 = {s}. 3x = {s} - 3 = {s - 3}. x = {s - 3} / 3 = {x}. jaach: {x} + {x + 1} + {x + 2} = {s}, milyo.'
    return ex(q, think, f'sankhya haru {x}, {x + 1} ra {x + 2} hun.', x, 'algebra')


def div_by_3(R):
    n = R.randint(100, 99999)
    ds = [int(c) for c in str(n)]
    s = sum(ds)
    yes = s % 3 == 0
    think = f'3 le bhag lagchha ki bhanna ank haru ko jod herinchha. {" + ".join(map(str, ds))} = {s}. {s} lai 3 le ' + ('nishesh bhag lagchha.' if yes else 'nishesh bhag lagdaina.')
    return ex(f'{n} lai 3 le nishesh bhag lagchha?', think, ('ho, lagchha.' if yes else 'haina, lagdaina.'), 'ho' if yes else 'haina', 'numtheory')


def nepal_time(R):
    h, m = R.randint(0, 23), R.choice([0, 15, 30, 45])
    tot = h * 60 + m + 345
    nh, nm = (tot // 60) % 24, tot % 60
    q = f'UTC samaya {h:02d}:{m:02d} hunda nepal ma kati baje hunchha?'
    think = f'nepal ko samaya UTC bhanda 5 ghanta 45 minet agadi chha. minet: {m} + 45 = {m + 45}' + (f', jun 1 ghanta {m + 45 - 60} minet ho' if m + 45 >= 60 else '') + f'. ghanta: {h} + 5' + (' + 1' if m + 45 >= 60 else '') + f' = {h + 5 + (1 if m + 45 >= 60 else 0)}' + (' (24 bhanda badhi bhayeko le arko din)' if h + 5 + (1 if m + 45 >= 60 else 0) >= 24 else '') + '.'
    return ex(q, think, f'nepal ma {nh:02d}:{nm:02d} baje hunchha.', f'{nh:02d}:{nm:02d}', 'time')


def distractor(R):
    n, it = pick(R, NAMES), pick(R, ITEMS)[0]
    a, b, junk = R.randint(5, 40), R.randint(2, 20), R.randint(10, 99)
    place = pick(R, PLACES)
    q = (f'{n} {place} ma basne {junk} barsha ko manchhe ho. usle bihana {a} wata {it} kinyo ra beluka {b} wata thap kinyo. '
         f'usko ghar ma {R.randint(2, 8)} jana chhan. {n} le jamma kati wata {it} kinyo?')
    think = f'prashna jamma kineko {it} ko matra ho, umer ra pariwar ko sankhya yaha kam chhaina. bihana {a} ra beluka {b}: {a} + {b} = {a + b}.'
    return ex(q, think, f'{n} le jamma {a + b} wata {it} kinyo.', a + b, 'distractor')


def trick_weight(R):
    a, b = pick(R, [('kapas', 'falam'), ('pwankh', 'dhunga'), ('kagaj', 'sun')])
    k = R.choice([1, 2, 5, 10])
    q = f'{k} kilo {a} ra {k} kilo {b} madhye kun garho chha?'
    think = f'dubai ko taul {k} kilo nai chha. {b} lai garho sochnu bhram ho, kinaki {b} ko eutai aayatan garho hunchha, tara yaha taul barabar diyeko chha.'
    return ex(q, think, f'duitai barabar garho chhan, dubai {k} kilo.', 'barabar', 'trick')


FAMILIES = [(bodmas, 2), (decimals, 1.2), (temperature, 1.2), (percent_change, 1.2), (compound, 1), (best_buy, 1.5), (work_rate, 1.2),
            (probability, 1.2), (stats, 1), (rounding, 1), (number_words, 1.5), (volume, 1), (consecutive, 1.2), (div_by_3, 1),
            (nepal_time, 0.8), (distractor, 1.5), (trick_weight, 0.4)]


def sample(R):
    f = R.choices([f for f, _ in FAMILIES], weights=[w for _, w in FAMILIES])[0]
    return f(R)
