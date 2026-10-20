"""Reasoning teacher: logic and common-sense puzzles with explicit, sound reasoning
in romanized Nepali. Includes cases where the right answer is "we cannot know", so
Nik learns not to over-claim. Each generator returns dict(q, think, a, gold, kind).
"""
import random

from math_gen import NAMES, ex, pick

DAYS = ['aaitabar', 'sombar', 'mangalbar', 'budhabar', 'bihibar', 'sukrabar', 'sanibar']
MONTHS = [('baishakh', 31), ('jestha', 31), ('asar', 32), ('shrawan', 31), ('bhadra', 31), ('ashwin', 30),
          ('kartik', 30), ('mangsir', 29), ('poush', 30), ('magh', 29), ('falgun', 30), ('chaitra', 30)]
DIRS = ['uttar', 'purba', 'dakshin', 'pashchim']          # clockwise: north, east, south, west


def ordering(R):
    k = R.randint(3, 5)
    ppl = R.sample(NAMES, k)                     # ppl[0] is the tallest ... ppl[-1] the shortest
    adj, adjw = pick(R, [('aglo', 'hocho'), ('jetho', 'kanchho'), ('chhito', 'dhilo')])
    facts = [f'{ppl[i]} {ppl[i + 1]} bhanda {adj} chha' for i in range(k - 1)]
    R.shuffle(facts)
    ask = R.random()
    chain = ' > '.join(ppl)
    if ask < 0.4:
        q, gold = f'{". ".join(facts)}. sabai bhanda {adj} ko ho?', ppl[0]
    elif ask < 0.7:
        q, gold = f'{". ".join(facts)}. sabai bhanda {adjw} ko ho?', ppl[-1]
    else:
        q, gold = f'{". ".join(facts)}. {adj} pana ma dosro sthan ma ko chha?', ppl[1]
    think = f'diyeka tathya lai ek line ma milauchhu ({adj} bata suru): {chain}. ' + {ppl[0]: f'sabai bhanda agadi {ppl[0]} chha.',
                                                                                  ppl[-1]: f'sabai bhanda pachhadi {ppl[-1]} chha.', ppl[1]: f'dosro sthan ma {ppl[1]} chha.'}[gold]
    return ex(q, think, f'jawaf {gold} ho.', gold, 'logic')


SYL = [('kukur', 'janawar', 'saas ferchhan'), ('danfe', 'chara', 'pwankh hunchha'), ('syau', 'fal', 'biu hunchha'),
       ('rohu', 'machha', 'pani ma baschhan'), ('gulab', 'phool', 'rang hunchha'), ('sagarmatha', 'himal', 'hiun hunchha')]


def syllogism(R):
    x, cat, prop = pick(R, SYL)
    k = R.random()
    if k < 0.45:
        q = f'sabai {cat} ko {prop}. {x} ek {cat} ho. ke {x} ko pani {prop}?'
        think = f'pahilo niyam sabai {cat} ma lagu hunchha. {x} {cat} ho, tyasaile niyam {x} ma pani lagu hunchha.'
        return ex(q, think, f'ho, {x} ko pani {prop}.', 'ho', 'logic')
    if k < 0.75:
        q = f'sabai {x} {cat} hun. ke sabai {cat} {x} hun?'
        think = f'sabai {x} {cat} hun bhanda {cat} ko samuha bhitra {x} parchha. tara {cat} ma aru pani hunasakchhan, tyasaile ulto bhanna mildaina.'
        return ex(q, think, f'haina, sabai {cat} {x} hudainan. {x} bhaneko {cat} ko ek prakar matra ho.', 'haina', 'logic')
    other = pick(R, [s for s in SYL if s[1] != cat])[1]
    q = f'kehi {cat} sano hunchhan. kehi sano kura {other} hun. ke kehi {cat} pakka {other} hun?'
    think = f'"kehi {cat} sano" ra "kehi sano kura {other}" bata yo pakka hudaina ki duitai samuha ma eutai kura parchha. tathya pugdaina.'
    return ex(q, think, 'diyeko jankari le pakka bhanna sakidaina.', 'sakidaina', 'logic')


# (condition, result, result did-not-happen, result would-have-happened, condition did-not-happen)
COND = [('pani paryo', 'bato bhijchha', 'bato bhijena', 'bato bhijthyo', 'pani parena'),
        ('phone ko battery sakiyo', 'phone band hunchha', 'phone band bhaena', 'phone band hunthyo', 'battery sakieko chhaina'),
        ('dudh umaliyo', 'bhanda ma fij aauchha', 'bhanda ma fij aaena', 'fij aaunthyo', 'dudh umalieko chhaina'),
        ('ghaam lagyo', 'luga sukchha', 'luga sukena', 'luga sukthyo', 'ghaam lageko chhaina'),
        ('parikshya ma 40 bhanda badhi ank aayo', 'bidyarthi pass hunchha', 'bidyarthi pass bhaena', 'pass hunthyo', '40 bhanda badhi ank aaena')]


def conditional(R):
    cond, res, res_no, res_would, cond_no = pick(R, COND)
    k = R.random()
    if k < 0.4:
        q = f'yadi {cond} bhane {res}. aaja {cond}. ke {res}?'
        return ex(q, f'niyam: {cond} bhane {res}. aaja sharta pura bhayo, tyasaile parinam pani hunchha.', f'ho, {res}.', 'ho', 'logic')
    if k < 0.75:
        q = f'yadi {cond} bhane {res}. tara aaja {res_no}. ke {cond}?'
        think = f'sharta pura bhaeko bhae {res_would}. tara {res_no}, tyasaile sharta pura bhaena: {cond_no}.'
        return ex(q, think, f'haina, {cond_no}.', 'haina', 'logic')
    q = f'yadi {cond} bhane {res}. aaja {res}. ke pakka {cond}?'
    think = f'parinam aru karan le pani huna sakchha. parinam matra dekhera karan pakka bhanna mildaina.'
    return ex(q, think, 'pakka bhanna sakidaina, kinaki yo aru karan le pani huna sakchha.', 'sakidaina', 'logic')


def directions(R):
    start = R.randrange(4)
    turns = [R.choice(['daya', 'baya']) for _ in range(R.randint(1, 4))]
    face, steps = start, [f'suru ma {DIRS[start]} tira']
    for t in turns:
        face = (face + (1 if t == 'daya' else -1)) % 4
        steps.append(f'{t} modda {DIRS[face]} tira')
    q = f'{pick(R, NAMES)} le {DIRS[start]} tira mukh garyo. ani kramashah ' + ', '.join(f'{t} tira' for t in turns) + ' modyo. aba mukh kun disha tira chha?'
    think = 'daya modda ghadi ko sui ko disha (uttar -> purba -> dakshin -> pashchim), baya modda ulto. ' + ', '.join(steps) + '.'
    return ex(q, think, f'aba mukh {DIRS[face]} tira chha.', DIRS[face], 'logic')


RELATIONS = [('mero buwa ko dai', 'thulo buwa'), ('mero buwa ko bhai', 'kaka'), ('mero aama ko dai', 'mama'), ('mero aama ko bhai', 'mama'),
             ('mero aama ki didi', 'thuli aama'), ('mero aama ki bahini', 'sani aama'), ('mero buwa ki didi', 'fupu'), ('mero buwa ki bahini', 'fupu'),
             ('mero buwa ko buwa', 'hajurbuwa'), ('mero aama ki aama', 'hajuraama'), ('mero dai ko chhora', 'bhatija'), ('mero dai ki chhori', 'bhatiji'),
             ('mero didi ko chhora', 'bhanja'), ('mero didi ki chhori', 'bhanji'), ('mero kaka ki shrimati', 'kaki'), ('mero mama ki shrimati', 'maiju'),
             ('mero fupu ko shriman', 'fupaju'), ('mero dai ki shrimati', 'bhauju'), ('mero didi ko shriman', 'bhinaju'), ('mero shrimati ko bhai', 'salo')]


def family(R):
    rel, name = pick(R, RELATIONS)
    q = pick(R, [f'{rel} lai nepali ma k bhaninchha?', f'{rel} lai k bhanne?', f'nepali nata ma {rel} ko sambodhan k ho?'])
    return ex(q, f'nata hernu: {rel}. nepali ma yo nata lai {name} bhaninchha.', f'{rel} lai {name} bhaninchha.', name, 'common')


def weekday(R):
    i, k = R.randrange(7), R.randint(3, 40)
    j = (i + k) % 7
    q = f'aaja {DAYS[i]} ho. {k} din pachhi kun bar hunchha?'
    think = f'hapta ma 7 din hunchhan, tyasaile {k} lai 7 le bhag garchhu: 7 x {k // 7} = {7 * (k // 7)}, baki {k} - {7 * (k // 7)} = {k % 7}. {DAYS[i]} bata {k % 7} din agadi gaye {DAYS[j]} aauchha.'
    return ex(q, think, f'{k} din pachhi {DAYS[j]} hunchha.', DAYS[j], 'calendar')


def nepali_date(R):
    m = R.randrange(12); name, nd = MONTHS[m]
    d, k = R.randint(1, nd), R.randint(5, 40)
    t = d + k
    if t <= nd:
        q = f'aaja {name} {d} gate ho. {k} din pachhi kati gate hunchha?'
        think = f'{name} ma {nd} din hunchhan. {d} + {k} = {t}, yo {nd} bhanda badhi chhaina, tyasaile {name} mai {t} gate.'
        return ex(q, think, f'{k} din pachhi {name} {t} gate hunchha.', f'{name} {t}', 'calendar')
    nn = MONTHS[(m + 1) % 12][0]
    if t - nd > MONTHS[(m + 1) % 12][1]:
        return nepali_date(R)
    q = f'aaja {name} {d} gate ho. {k} din pachhi kati gate hunchha? (yo barsha {name} ma {nd} din chhan.)'
    think = f'{d} + {k} = {t}. tara {name} ma {nd} din matra chhan, tyasaile mahina nageko din: {t} - {nd} = {t - nd}. arko mahina {nn} ko {t - nd} gate.'
    return ex(q, think, f'{k} din pachhi {nn} {t - nd} gate hunchha.', f'{nn} {t - nd}', 'calendar')


def handshakes(R):
    n = R.randint(3, 20)
    h = n * (n - 1) // 2
    q = f'euta bhela ma {n} jana chhan. sabai le ek arka sanga ek palta haat milaye bhane jamma kati palta haat milaiyo?'
    think = f'har manchhe le baki {n - 1} jana sanga haat milauchha: {n} x {n - 1} = {n * (n - 1)}. tara A-B ra B-A eutai ho, tyasaile 2 le bhag: {n * (n - 1)} / 2 = {h}.'
    return ex(q, think, f'jamma {h} palta haat milaiyo.', h, 'combinatorics')


def chickens_goats(R):
    c, g = R.randint(2, 20), R.randint(2, 20)
    heads, legs = c + g, 2 * c + 4 * g
    q = f'euta farm ma kukhura ra bakhra chhan. jamma {heads} wata tauko ra {legs} wata khutta chhan. kati wata bakhra chhan?'
    think = (f'sabai {heads} lai kukhura maandaa khutta: {heads} x 2 = {2 * heads}. tara jamma {legs} chhan, farak: {legs} - {2 * heads} = {legs - 2 * heads}. '
             f'har bakhra le kukhura bhanda 2 khutta badhi dinchha: {legs - 2 * heads} / 2 = {g}. kukhura: {heads} - {g} = {c}. jaach: {c} x 2 + {g} x 4 = {legs}, milyo.')
    return ex(q, think, f'{g} wata bakhra ra {c} wata kukhura chhan.', g, 'algebra')


def venn(R):
    tot = R.randint(30, 80); a, b = R.randint(10, tot - 5), R.randint(10, tot - 5)
    both = R.randint(max(0, a + b - tot), min(a, b))
    none = tot - (a + b - both)
    q = f'euta kaksha ma {tot} jana bidyarthi chhan. {a} jana lai cricket man parchha, {b} jana lai football, ra {both} jana lai duitai. kati jana lai kunai pani man pardaina?'
    think = f'kamsekam ek man parne: {a} + {b} - {both} = {a + b - both} (duitai man parne dui palta gannu hunna). kunai pani man naparne: {tot} - {a + b - both} = {none}.'
    return ex(q, think, f'{none} jana lai kunai pani khel man pardaina.', none, 'sets')


def sequence(R):
    k = R.random()
    if k < 0.35:
        a, d = R.randint(1, 30), R.randint(2, 12); s = [a + d * i for i in range(5)]; nxt = s[-1] + d
        rule = f'har palta {d} le badhchha ({s[1]} - {s[0]} = {d})'
    elif k < 0.6:
        a, r = R.randint(1, 5), R.choice([2, 3]); s = [a * r ** i for i in range(5)]; nxt = s[-1] * r
        rule = f'har palta {r} guna hunchha ({s[0]} x {r} = {s[1]})'
    elif k < 0.8:
        o = R.randint(1, 5); s = [(o + i) ** 2 for i in range(5)]; nxt = (o + 5) ** 2
        rule = f'yi barga sankhya hun: {o} x {o} = {s[0]}, {o + 1} x {o + 1} = {s[1]}'
    else:
        a, b = R.randint(1, 5), R.randint(1, 8); s = [a, b]
        for _ in range(3):
            s.append(s[-1] + s[-2])
        nxt = s[-1] + s[-2]
        rule = f'har sankhya agadi ka dui sankhya ko jod ho ({s[0]} + {s[1]} = {s[2]})'
    q = f'yo shrinkhala ma arko sankhya kun ho: {", ".join(map(str, s))}, ...?'
    return ex(q, f'dhanchha khojchhu: {rule}. tyasaile {s[-1]} pachhi {nxt} aauchha.', f'arko sankhya {nxt} ho.', nxt, 'pattern')


ODD = [(['syau', 'kera', 'aanp', 'aalu'], 'aalu', 'aalu tarkari ho, baki sabai fal hun'),
       (['kukur', 'biralo', 'gai', 'bhyaguto'], 'bhyaguto', 'bhyaguto ubhayachar ho, baki sabai stanadhari hun'),
       (['kathmandu', 'pokhara', 'dilli', 'butwal'], 'dilli', 'dilli bharat ma chha, baki sabai nepal ka sahar hun'),
       (['ratо', 'nilo', 'hariyo', 'gol'], 'gol', 'gol aakar ho, baki sabai rang hun'),
       (['2', '4', '7', '8'], '7', '7 bijod sankhya ho, baki sabai jod hun'),
       (['dashain', 'tihar', 'chhath', 'sombar'], 'sombar', 'sombar bar ho, baki sabai chad hun'),
       (['kalam', 'pencil', 'chammach', 'marker'], 'chammach', 'chammach khana khane saman ho, baki lekhne saman hun'),
       (['sagarmatha', 'kanchanjunga', 'makalu', 'fewa'], 'fewa', 'fewa tal ho, baki sabai himal hun'),
       (['koshi', 'gandaki', 'karnali', 'rara'], 'rara', 'rara tal ho, baki sabai nadi hun'),
       (['bus', 'truck', 'motorcycle', 'hawaijahaj'], 'hawaijahaj', 'hawaijahaj aakash ma udchha, baki sabai sadak ma chalchhan'),
       (['3', '5', '9', '11'], '9', '9 ruddha sankhya haina (3 x 3 = 9), baki sabai ruddha sankhya hun'),
       (['danfe', 'kag', 'bakulla', 'chamero'], 'chamero', 'chamero stanadhari ho, baki sabai chara hun'),
       (['android', 'kotlin', 'python', 'javascript'], 'android', 'android operating system ho, baki sabai programming bhasha hun'),
       (['dal', 'bhat', 'tarkari', 'thal'], 'thal', 'thal bhanda ho, baki sabai khana hun')]


def odd_one(R):
    opts, ans, why = pick(R, ODD)
    opts = [o.replace('о', 'o') for o in opts]
    why = why.replace('о', 'o')
    sh = opts[:]; R.shuffle(sh)
    q = f'yi madhye kun chai farak chha: {", ".join(sh)}?'
    return ex(q, f'samuha khojchhu: {why}.', f'{ans} farak chha, kinaki {why}.', ans, 'common')


FAMILIES = [(ordering, 3), (syllogism, 2.5), (conditional, 2.5), (directions, 1.5), (family, 1), (weekday, 2), (nepali_date, 1.5),
            (handshakes, 1), (chickens_goats, 1.5), (venn, 1.5), (sequence, 2.5), (odd_one, 1.5)]


def sample(R):
    f = R.choices([f for f, _ in FAMILIES], weights=[w for _, w in FAMILIES])[0]
    return f(R)
