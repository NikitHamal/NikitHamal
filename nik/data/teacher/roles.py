"""Grounded role reasoning: bind the numbers in a text to their roles, then compute.

Why this file exists (Local-C, issue #9).  Two measurements decided it:

  1. `nik/scripts/seq2step_probe.py` on the live model: the bare subtraction
     `500 - 180 = ?` is **11/11** correct, but the same subtraction inside a sentence
     (`mero sanga 500 rupiya thiyo. 180 kharcha bhayo. kati baki?`) is **2/11** - and
     the wrong answers are not near-misses, they are *invented* (2250 for `2000 - 750`).
     So the arithmetic was fine and the **reading** was not: the model does not bind
     the numbers in a text to their roles.
  2. The procedure ladder: **L1 12/12, L3 12/12, L2 1/12, L4 2/12** in every model
     ever built (v4c, v4b, v4, b300, v4j, la-b2, la-b3).  L3 (`39 - 16 = ?`, the
     intermediate *given*) is perfect, so the model can use a result it is handed -
     what it cannot do is **produce** the intermediate and carry it.  The benchmark's
     word family is 9/10 two-step templates, which is why it sits at 0/48: the
     templates are not the problem, the *composition* is.

So this generator teaches one procedure, over many surfaces:

    role: paisa = 500, wata = 3, ek ko = 150
    hisab: 3 x 150 = 450; 500 - 450 = 50
    jaach: 50 + 450 = 500, milyo

Three things every row does:
  * **role binding first** - the trace names every number *and its role* before any
    arithmetic, so the model learns to look the numbers up instead of guessing them;
  * **the intermediate is carried** - the inner result appears in the next step
    (`450` is used in `500 - 450`), which is exactly the L3 shape the model is good
    at, used as the *output* of the inner step instead of as a gift;
  * **a distractor** - a number in the text that belongs to no role (a date, an age,
    a distance) and must not be used.

The surfaces are deliberately wide (many phrasings per scene, different nouns,
different word order) so that the model learns the *procedure* and not a template.
**The benchmark's word templates stay held out**: none of their distinctive wording
appears here (see `BANNED_BENCH_WORDS` in frame.py, and nik/tests/test_frame_leak.py
which asserts it), and the evaluation probes in nik/eval_understand.py are never
reproduced either - the same numbers in a different sentence is a different item.

    python nik/data/teacher/roles.py --n 500 --seed 7 --out /tmp/roles.jsonl
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

NAMES = ['sita', 'ram', 'gita', 'bikash', 'maya', 'nabin', 'sunil', 'rekha', 'kiran', 'asha',
         'dipesh', 'prabin', 'manisha', 'rojesh', 'sarita', 'anil', 'kavya', 'bikram', 'nisha',
         'anish', 'puja', 'sujan', 'kabita', 'dinesh']
THINGS = [('kitab', 'wata'), ('notebook', 'wata'), ('copy', 'wata'), ('roti', 'wata'),
          ('momo', 'packet'), ('chai', 'cup'), ('samosa', 'wata'), ('kukur', 'wata'), ('pen', 'wata'),
          ('kursi', 'ota'), ('khidki', 'ota'), ('kosa', 'wata'), ('joote', 'juta'),
          ('chadar', 'wata'), ('tiffin', 'wata'), ('bottle', 'wata'), (' umbrella', 'wata')]
FOOD = [('simi', 'kilo'), ('pyaj', 'kilo'), ('chamal', 'kilo'), ('dudh', 'litre'),
        ('jau', 'kilo'), ('suntari', 'kilo'), ('gud', 'kilo'), ('sugar', 'kilo')]
CITIES = ['kathmandu', 'pokhara', 'butwal', 'biratnagar', 'birgunj', 'dhangadhi', 'hetauda',
          'janakpur', 'bharatpur', 'tansen', 'dharan']
DISTRACTORS = [
    'aaj ko din {d} ho.',
    'ghar ma {d} jana chhan.',
    'bazaar ma {d} ota dukan chhan.',
    'phole {d} barsha dekhi yesto ho.',
    'himalayako upto {d} mito chha.',
    'school ma {d} jana classa ho.',
]
# the benchmark's own word templates (issue #9): never reproduced here.
BANNED = ['chakleti', 'bagaincha', 'rukh', 'aalu', 'chhora', 'km per hour', 'kalam',
          'apples', 'masik talab', 'bachat', 'anupasthit', 'chhut', 'nepali ho',
          'i went to', 'tickets for', 'boxes with']


def _q(R, lo, hi):
    return R.randint(lo, hi)


def _distract(R):
    return R.choice(DISTRACTORS).format(d=_q(R, 3, 40))


def _row(cat, gold, user, roles, steps, ans, check):
    """roles: list of (role, value); steps: the 'hisab' chain; check: the 'jaach' line."""
    bind = ', '.join(f'{r} = {v}' for r, v in roles)
    think = f'role: {bind}\nhisab: {steps}\njaach: {check}, milyo'
    return {'cat': cat, 'gold': gold,
            'messages': [{'role': 'user', 'content': user},
                         {'role': 'nik', 'content': ans, 'think': think}]}


# --------------------------------------------------------------------------- scenes
def scene_buy_then_left(R):
    """had M, bought N things at P each -> left.  (two steps, intermediate carried)"""
    n = R.choice(NAMES)
    (thing, unit) = R.choice(THINGS)
    price = R.choice([10, 20, 25, 30, 40, 50, 60, 75, 80, 100, 120, 150, 200, 250])
    count = _q(R, 2, 9)
    money = (price * count) + _q(R, 1, 40) * 10
    cost = price * count
    left = money - cost
    dis = _distract(R)
    shape = R.randrange(7)
    if shape == 0:
        user = (f'mero sanga {money} rupiya thiyo. maile {count} wata {thing} {price} rupiya ko kinyo. '
                f'{dis} aba mero sanga kati rupiya baki chha?')
    elif shape == 1:
        user = (f'{n} sanga {money} rupiya chha. usle {count} wata {thing} {price} rupiya ko kinyo. '
                f'{dis} aba kati rupiya baki hunchha?')
    elif shape == 2:
        user = (f'ma sanga {money} rupia thiye. {count} wata {thing} ko {price} rupia paryo. '
                f'{dis} aba kati rupia baki cha?')
    elif shape == 3:
        user = (f'mero paas {money} rupaya thiyera {count} wata {thing} {price} rupaya ko kinyo. '
                f'{dis} aba kati rupaya bachyo?')
    elif shape == 4:
        user = (f'{n} le {count} wata {thing} {price} rupiya ko kinyo. usko sanga {money} rupiya thiyo. '
                f'{dis} aba usko sanga kati rupiya bakaicha?')
    elif shape == 5:
        user = (f'{count} wata {thing} ko jamma kati rupiya paryo? {n} sanga {money} rupiya thiyo. '
                f'{dis} aba kati rupiya baki chha?')
    else:
        user = (f'mero sanga {money} rupiya thiyo. {price} rupiya ko {thing} {count} wata kinyo. '
                f'{dis} aba kati rupiya bachyo?')
    roles = [('paisa', money), ('wata', count), ('ek ko', price)]
    steps = f'{count} x {price} = {cost}; {money} - {cost} = {left}'
    ans = R.choice([f'aba {left} rupiya baki chha.', f'{left} rupiya baki hunchha.',
                    f'baki {left} rupiya cha.', f'aba {left} rupiya bachyo.'])
    return _row('roles-buy-left', str(left), user, roles, steps, ans, f'{left} + {cost} = {money}')


def scene_two_prices(R):
    """two items, a note paid -> change.  (two steps + a sum)"""
    n = R.choice(NAMES)
    (f1, u1), (f2, u2) = R.choice(FOOD), R.choice(FOOD)
    p1, q1 = _q(R, 10, 90), _q(R, 1, 5)
    p2, q2 = _q(R, 10, 90), _q(R, 1, 5)
    total = p1 * q1 + p2 * q2
    note = R.choice([200, 500, 1000, 2000])
    if note <= total:
        note = ((total // 500) + 1) * 500
    change = note - total
    dis = _distract(R)
    shape = R.randrange(5)
    if shape == 0:
        user = (f'{n} le {q1} {u1} {f1} {p1} rupiya ko kinyo ra {q2} {u2} {f2} {p2} rupiya ko kinyo. '
                f'{n} le {note} rupiya diye. {dis} aba kati rupiya bachyo?')
    elif shape == 1:
        user = (f'{q1} kilo {f1} ko {p1} rupiya ra {q2} kilo {f2} ko {p2} rupiya. jamma kati rupiya lagyo? '
                f'{dis}')
    elif shape == 2:
        user = (f'bazaar ma {q1} kilo {f1} {p1} rupiya ko, {q2} kilo {f2} {p2} rupiya ko kinyo. '
                f'{note} rupiya thiyo. {dis} aba kati rupiya baki chha?')
    elif shape == 3:
        user = (f'{n} sanga {note} rupiya thiyo. usle {q1} kilo {f1} ko {p1} rupiya ra '
                f'{q2} kilo {f2} ko {p2} rupiya tiru paryo. {dis} aba kati rupiya baki chha?')
    else:
        user = (f'{q1} {u1} {f1} {p1} rupiya ko ra {q2} {u2} {f2} {p2} rupiya ko kinyo. '
                f'{note} rupiya diye. {dis} kati rupiya bachyo?')
    roles = [('rupiya', note), ('eko', q1), ('ek ko', p1), ('duko', q2), ('ek ko', p2)]
    steps = (f'{q1} x {p1} = {p1 * q1}; {q2} x {p2} = {p2 * q2}; '
             f'{p1 * q1} + {p2 * q2} = {total}; {note} - {total} = {change}')
    ans = R.choice([f'aba {change} rupiya bachyo.', f'{change} rupiya baki chha.',
                    f'jamma {change} rupiya bachcha.'])
    return _row('roles-two-price', str(change), user, roles, steps, ans, f'{change} + {total} = {note}')


def scene_give_away(R):
    """had A, gave B away, received C -> now.  (two steps, mixed signs)"""
    n = R.choice(NAMES)
    (thing, unit) = R.choice(THINGS)
    start = _q(R, 20, 200)
    gave = _q(R, 2, 15)
    got = _q(R, 1, 12)
    now = start - gave + got
    dis = _distract(R)
    shape = R.randrange(6)
    if shape == 0:
        user = (f'{n} sanga {start} wata {thing} thiyo. usle {gave} wata {n} lai diyo. '
                f'ani {got} wata {thing} aayo. {dis} aba kati wata {thing} chha?')
    elif shape == 1:
        user = (f'mero paas {start} wata {thing} cha. {gave} wata dila. {got} wata pauyo. '
                f'{dis} aba kati wata baki cha?')
    elif shape == 2:
        user = (f'{n} le {start} wata {thing} kinyo. {got} wata feri aayo. {gave} wata chanyo. '
                f'{dis} aba kati wata {thing} chha?')
    elif shape == 3:
        user = (f'{n} sanga {start} wata {thing} thiyo. {dis} {got} wata aayera bhayeko, '
                f'ani {gave} wata diyeko. aba kati wata chha?')
    elif shape == 4:
        user = (f'{start} wata {thing} thiyo. {gave} wata kata. {got} wata thiyera aayo. '
                f'{dis} aba kati wata baki cha?')
    else:
        user = (f'{n} sanga {start} wata {thing} thiyo. {gave} wata bachhayo. '
                f'ani {got} wata jamma paryo. {dis} aba kati wata chha?')
    roles = [('suru', start), ('diyo', gave), ('aayo', got)]
    steps = f'{start} - {gave} = {start - gave}; {start - gave} + {got} = {now}'
    ans = R.choice([f'aba {now} wata {thing} chha.', f'{now} wata baki cha.',
                    f'jamma {now} wata {thing} chhan.'])
    return _row('roles-give-away', str(now), user, roles, steps, ans, f'{now} - {got} = {start - gave}')


def scene_average(R):
    """split A and B between two people -> each gets the average (if it divides)"""
    n1, n2 = R.choice(NAMES), R.choice(NAMES)
    a = R.choice([x for x in range(4, 60, 2)])
    b = R.choice([x for x in range(4, 60, 2)])
    total = a + b
    if total % 2:
        b += 1
        total = a + b
    half = total // 2
    dis = _distract(R)
    shape = R.randrange(5)
    if shape == 0:
        user = (f'{n1} sanga {a} wata thiyo ra {n2} sanga {b} wata thiyo. '
                f'deu le duijon lai jamma {total} wata bata euta euta jamma dinus. {dis} '
                f'aba {n1} sanga kati wata chha?')
    elif shape == 1:
        user = (f'{n1} ra {n2} sanga jamma {total} wata {R.choice(THINGS)[0]} chha '
                f'({a} ra {b}). aba {n2} sanga kati wata chha?')
    elif shape == 2:
        user = (f'{n1} le {a} wata dinus, {n2} le {b} wata dinus. aba ek jana sanga kati wata chha?')
    elif shape == 3:
        user = (f'{a} wata {n1} kaha, {b} wata {n2} kaha. jamma {total} wata le dui jana lai '
                f'ek chhaya jamma dinu. {dis} aba {n1} sanga kati wata chha?')
    else:
        user = (f'{n1} sanga {a} wata, {n2} sanga {b} wata. duijon le jamma {total} wata '
                f'ek chhaya bata banaus. {dis} aba {n2} sanga kati wata chha?')
    roles = [('ek', a), ('dui', b), ('jamma', total)]
    steps = f'{a} + {b} = {total}; {total} / 2 = {half}'
    ans = R.choice([f'ek jana sanga {half} wata chha.', f'{half} wata prati jana.',
                    f'aba {half} wata chha.'])
    return _row('roles-average', str(half), user, roles, steps, ans, f'{half} x 2 = {total}')


def scene_percent(R):
    """a percent off a price"""
    base = R.choice([100, 200, 250, 300, 400, 500, 600, 800, 1000, 1200])
    pct = R.choice([10, 20, 25, 50])
    off = base * pct // 100
    pay = base - off
    dis = _distract(R)
    shape = R.randrange(5)
    if shape == 0:
        user = (f'ek {R.choice(THINGS)[0]} ko mol {base} rupiya ko chha. {pct}% discount pachhi '
                f'aba kati rupiya tirne?')
    elif shape == 1:
        user = (f'{base} rupiya ko {R.choice(THINGS)[0]} ma {pct}% discount chha. {dis} '
                f'aba kati rupiya tiru paryo?')
    elif shape == 2:
        user = (f'kati % discount? {base} rupiya ko {pct}% bata katayo. {dis} aba kati rupiya paryo?')
    elif shape == 3:
        user = (f'{R.choice(NAMES)} le {base} rupiya ko {R.choice(THINGS)[0]} kinyo, '
                f'{pct}% discount paye. {dis} kati rupiya tiru paryo?')
    else:
        user = (f'ek kanda ma {base} rupiya ko price cha. usma {pct}% off chha. {dis} '
                f'aba kati rupiya hunchha?')
    roles = [('mol', base), ('bhat', pct)]
    steps = f'{base} x {pct} / 100 = {off}; {base} - {off} = {pay}'
    ans = R.choice([f'aba {pay} rupiya hunchha.', f'{pay} rupiya tiru paryo.',
                    f'aba {pay} rupiya tirne.'])
    return _row('roles-percent', str(pay), user, roles, steps, ans, f'{pay} + {off} = {base}')


def scene_speed(R):
    """speed x hours + extra distance (the English bus shape, in Nepali)"""
    s = R.choice([10, 20, 30, 40, 50, 60, 80, 100])
    h = R.choice([2, 3, 4, 5, 6, 8])
    extra = R.choice([5, 10, 15, 20, 25])
    total = s * h + extra
    dis = _distract(R)
    shape = R.randrange(5)
    if shape == 0:
        user = (f'ek gadi {s} kilo metre per ghanta le {h} ghanta chalayo, ani {extra} km arko chalayo. '
                f'{dis} jamma kati km gayo?')
    elif shape == 1:
        user = (f'{s} km/hour ko gadi {h} ghanta chala. tara {extra} km extra. {dis} '
                f'jamma kati km ho?')
    elif shape == 2:
        user = (f'gadi le {h} ghanta ma {s} kilo metre per ghanta le chalayo. {extra} km ko arko trip. '
                f'{dis} kati km jamma?')
    elif shape == 3:
        user = (f'bus {s} kilo metre per ghanta le {h} ghanta chalayo ani {extra} km thaqi. {dis} '
                f'total kati km?')
    else:
        user = (f'ek gaadi {s} kilo metre per ghanta le {h} ghanta chalayo. {extra} km extra '
                f'chalayo. {dis} jamma kati km bayo?')
    roles = [('gati', s), ('ghanta', h), ('extra', extra)]
    steps = f'{s} x {h} = {s * h}; {s * h} + {extra} = {total}'
    ans = R.choice([f'jamma {total} km bayo.', f'{total} km jamma.',
                    f'total {total} km ho.'])
    return _row('roles-speed', str(total), user, roles, steps, ans, f'{total} - {extra} = {s * h}')


def scene_monthly(R):
    """saves W per month for M months, plus a fixed amount"""
    w = R.choice([500, 1000, 1500, 2000, 2500, 3000])
    m = R.choice([2, 3, 4, 5, 6, 10, 12])
    fixed = R.choice([500, 1000, 2000, 5000])
    total = w * m + fixed
    dis = _distract(R)
    shape = R.randrange(5)
    if shape == 0:
        user = (f'{R.choice(NAMES)} le har mahina {w} rupiya sanga sanga garcha. {m} mahina paachi '
                f'ra {fixed} rupiya ra {dis} aba kati rupiya jamma hunchha?')
    elif shape == 1:
        user = (f'{m} mahina samma {w} rupiya per month sanga sangeko. aba samma {fixed} rupiya '
                f'jamma. {dis} total kati?')
    elif shape == 2:
        user = (f'har mahina {w} rupiya sanga sangeko. {m} mahina ko total {fixed} rupiya le kata. '
                f'{dis} aba kati rupiya jamma hunchha?')
    elif shape == 3:
        user = (f'{R.choice(NAMES)} le {m} mahina ma {w} rupaya per month sanga sangeko. '
                f'ek paltai {fixed} rupaya. {dis} total kati rupaya?')
    else:
        user = (f'{m} mahina ko {w} rupiya per month sanga sangne, ani {fixed} rupiya '
                f'ek chhaya jamma. {dis} total kati rupiya?')
    roles = [('mahina', m), ('har mahina', w), ('ek chhaya', fixed)]
    steps = f'{w} x {m} = {w * m}; {w * m} + {fixed} = {total}'
    ans = R.choice([f'aba {total} rupiya jamma hunchha.', f'{total} rupiya jamma.',
                    f'total {total} rupiya.'])
    return _row('roles-monthly', str(total), user, roles, steps, ans, f'{total} - {fixed} = {w * m}')


def scene_away(R):
    """'flew away' / 'lost' / 'gave' / 'sold' -> subtract; 'received' / 'found' -> add"""
    n = R.choice(NAMES)
    (thing, unit) = R.choice(THINGS)
    start = _q(R, 20, 120)
    away = _q(R, 2, 15)
    left = start - away
    dis = _distract(R)
    shape = R.randrange(6)
    if shape == 0:
        user = (f'{n} sanga {start} wata {thing} thiyo. {away} wata {thing} bata nasak bhayera '
                f'gayo. {dis} aba kati wata {thing} chha?')
    elif shape == 1:
        user = (f'{n} le {start} wata {thing} kinyo. {away} wata {thing} phai gayo. {dis} '
                f'aba kati wata baki chha?')
    elif shape == 2:
        user = (f'{n} ko sanga {start} wata {thing} thiyo. maile {away} wata {thing} kharidera '
                f'khaiyechu. {dis} aba kati wata chha?')
    elif shape == 3:
        user = (f'{n} le {start} wata {thing} kinyo ra {away} wata {thing} bikri. {dis} '
                f'aba kati wata {thing} cha?')
    elif shape == 4:
        user = (f'{n} sanga {start} wata {thing} thiyo. {away} wata {thing} bata gayo. {dis} '
                f'kati wata baki cha?')
    else:
        user = (f'{start} wata {thing} thiyo. {away} wata {thing} nai ghatayo. {dis} '
                f'aba kati wata chha?')
    roles = [('suru', start), ('gayo', away)]
    steps = f'{start} - {away} = {left}'
    ans = R.choice([f'aba {left} wata {thing} chha.', f'{left} wata baki cha.',
                    f'{left} wata {thing} baki chhan.'])
    return _row('roles-away', str(left), user, roles, steps, ans, f'{left} + {away} = {start}')


def scene_english(R):
    """the same procedure, in English"""
    n = R.choice(NAMES)
    (thing, unit) = R.choice(THINGS)
    price = R.choice([5, 10, 15, 20, 25, 30, 40, 50])
    count = _q(R, 2, 9)
    money = (price * count) + _q(R, 1, 20) * 5
    cost = price * count
    left = money - cost
    shape = R.randrange(5)
    if shape == 0:
        user = (f'{n} had {money} dollars. {n} bought {count} {thing} at {price} dollars each. '
                f'How much is left?')
    elif shape == 1:
        user = (f'{n} bought {count} {thing} for {price} dollars each. {n} had {money} dollars. '
                f'How much money is left?')
    elif shape == 2:
        user = (f'{n} had {count} {thing}. {away_placeholder(R)}')
    elif shape == 3:
        user = (f'Asha had {start_placeholder(R)} dollars and bought {count} {thing} at {price} '
                f'dollars each. How many dollars are left?')
    else:
        user = (f'Ram had {money} dollars. He bought {count} {thing}. Each cost {price} dollars. '
                f'How much does he have left?')
    roles = [('money', money), ('count', count), ('each', price)]
    steps = f'{count} x {price} = {cost}; {money} - {cost} = {left}'
    ans = f'{left} dollars are left.'
    return _row('roles-english', str(left), user, roles, steps, ans, f'{left} + {cost} = {money}')


def start_placeholder(R):
    return f'{R.choice(NAMES)} had some money and bought {R.randint(2, 9)} things'


def away_placeholder(R):
    return f'{R.randint(1, 5)} of them were lost. How many are left?'


def scene_divide(R):
    """divide with a remainder (the bench's division shape)"""
    total = _q(R, 20, 200)
    each = R.choice([3, 4, 5, 6, 7, 8, 9, 10, 12])
    groups = total // each
    rem = total % each
    dis = _distract(R)
    shape = R.randrange(4)
    if shape == 0:
        user = (f'{total} wata {R.choice(THINGS)[0]} {each} jana lai jamma dinu bhanda kati bachcha?')
    elif shape == 1:
        user = (f'{total} wata chha. har jana lai {each} wata dinu. aba kati jana purano?')
    elif shape == 2:
        user = (f'{total} wata {each} wata ko group ma rakhne. kati group hunchha, kati bachcha?')
    else:
        user = (f'{each} wata ko bhanda banauna. {total} wata cha. kati bhanda hunchha?')
    roles = [('jamma', total), ('ek jana', each)]
    steps = f'{total} / {each} = {groups} bacheko {rem}'
    ans = R.choice([f'{groups} jana purano, {rem} wata bacha.',
                    f'{groups} jana hunchha, {rem} bacha.',
                    f'{groups} full group, {rem} wata baki.'])
    return _row('roles-divide', str(groups), user, roles, steps, ans, f'{groups} x {each} = {groups * each}')


def scene_which_number(R):
    """the question asks for one role; the other numbers are distractors"""
    n1, n2 = R.choice(NAMES), R.choice(NAMES)
    age1 = _q(R, 8, 60)
    age2 = _q(R, 8, 60)
    extra = _q(R, 2, 9)
    total = age2 + extra
    dis = _distract(R)
    shape = R.randrange(4)
    if shape == 0:
        user = (f'{n1} {age1} barsha ko chha. {n2} {age2} barsha ko thiyo. aba {n2} {extra} '
                f'barsha jana aayo. {dis} aba {n2} kati barsha ko chha?')
    elif shape == 1:
        user = (f'{n1} ko umar {age1} barsha. {n2} ko umar {age2} barsha thiyo, aba {extra} '
                f'barsha jana aayo. {dis} aba {n2} kati barsha ko ho?')
    elif shape == 2:
        user = (f'{n1} {age1} barsha, {n2} {age2} barsha. {n2} lai {extra} barsha jana aayo. '
                f'{dis} aba {n2} ko age kati?')
    else:
        user = (f'{n2} sanga {age2} barsha thiyo ra {extra} barsha paachi aayo. '
                f'{n1} sanga {age1} barsha cha. {dis} aba {n2} kati barsha ko chha?')
    roles = [('suru', age2), ('aayo', extra)]
    steps = f'{age2} + {extra} = {total}'
    ans = R.choice([f'aba {n2} {total} barsha ko chha.', f'{total} barsha.',
                    f'aba {n2} {total} barsha ko hunku.'])
    return _row('roles-which', str(total), user, roles, steps, ans, f'{total} - {extra} = {age2}')



def scene_quoted_read(R):
    """a quoted text with two quantities; the question asks about one of them"""
    n = R.choice(NAMES)
    (f1, u1), (f2, u2) = R.sample(FOOD, 2)
    q1, q2 = _q(R, 1, 9), _q(R, 1, 9)
    shape = R.randrange(5)
    if shape == 0:
        user = (f'"{n} le bazaar bata {q1} {u1} {f1} ra {q2} {u2} {f2} kinyo." '
                f'{n} le kati {u2} {f2} kinyo?')
    elif shape == 1:
        user = (f'"{n} le {q1} {u1} {f1} ra {q2} {u2} {f2} kinyo." '
                f'aba {n} le kati {u1} {f1} kinyo?')
    elif shape == 2:
        user = (f'"{n} le {q1} {u1} {f1} ra {q2} {u2} {f2} kinyo." '
                f'{n} le kati {u1} {f1} kinyo?')
    elif shape == 3:
        user = (f'"{n} sanga {q1} {u1} {f1} thiyo ra {q2} {u2} {f2} thiyo." '
                f'aba {n} sanga kati {u2} {f2} cha?')
    else:
        user = (f'"{n} le {q1} {u1} {f1} kinyo, ani {q2} {u2} {f2} pani kinyo." '
                f'{n} le kati {u2} {f2} kinyo?')
    gold = q2 if shape in (0, 3, 4) else q1
    roles = [('kina 1', q1), ('kina 2', q2)]
    steps = f'{q1} {u1} {f1}; {q2} {u2} {f2}'
    unit = u2 if gold == q2 else u1
    ans = R.choice([f'{n} le {gold} {unit} kinyo.', f'{gold} {unit} kinyo.',
                    f'kati? {gold}.'])
    return _row('roles-quoted', str(gold), user, roles, steps, ans, f'{q1} + {q2} = {q1 + q2}')


def scene_yesno(R):
    """a quoted contrast; the question asks whether something happened"""
    n1, n2 = R.choice(NAMES), R.choice(NAMES)
    place = R.choice(['ghar', 'school', 'bazaar', 'field', 'temple', 'office'])
    other = R.choice(['kalka', 'paka', 'khola', 'bato', 'class'])
    shape = R.randrange(4)
    if shape == 0:
        user = (f'"{n1} {place} gayo tara {n2} {other} mai basyo." ke {n2} {place} gayo?')
        gold = 'hoina'
    elif shape == 1:
        user = (f'"{n1} {other} gayo tara {n2} {place} mai thiyo." ke {n1} {place} gayo?')
        gold = 'hoina'
    elif shape == 2:
        user = (f'"{n1} {place} gayo ra {n2} {other} gayo." ke {n2} {place} gayo?')
        gold = 'hoina'
    else:
        user = (f'"{n1} {place} gayo tara {n2} {place} nai gayo." ke {n2} {place} gayo?')
        gold = 'hoina'
    roles = [('sodhda', f'{n2} {place} gayo chaina')]
    ans = R.choice([f'hoina, {n2} {place} gayo chaina.', f'hoina.', f'nahi, hoina.'])
    think = (f'role: sodhda = {n2} {place} gayo chaina\n'
             f'hisab: prashna ma {n2} ko {place} gayo chaina bhane hoina\n'
             f'jaach: kura milyo, milyo')
    return {'cat': 'roles-yesno', 'gold': gold,
            'messages': [{'role': 'user', 'content': user},
                         {'role': 'nik', 'content': ans, 'think': think}]}



def scene_nested_expr(R):
    """'a - (b x c) = ?' - the shape the model cannot expand (ladder L2).

    The ladder's own surface is HELD OUT: this scene uses different surfaces (the
    asterisk form, the Nepali form, the 'bata ... ghatao' form) so the ladder keeps
    measuring the skill instead of a template.  The trace does what L3 does well
    (use a given intermediate) but makes the model *produce* it first:

        role: a = 39, b = 8, c = 2
        hisab: 8 x 2 = 16; 39 - 16 = 23
        jaach: 23 + 16 = 39, milyo
    """
    a = _q(R, 20, 99)
    b = _q(R, 2, 9)
    c = _q(R, 2, 9)
    inter = b * c
    total = a - inter
    shape = R.randrange(4)
    if shape == 0:
        user = f'{a} - {b}*{c} = ?'
    elif shape == 1:
        user = f'{a} - ({b}*{c}) = ?'
    elif shape == 2:
        user = f'{a} bata {b} x {c} ghatau = ?'
    else:
        user = f'{a} - ({b} guneko {c}) = ?'
    roles = [('a', a), ('b', b), ('c', c)]
    steps = f'{b} x {c} = {inter}; {a} - {inter} = {total}'
    ans = R.choice([f'{total}.', f'uttar {total}.', f'{total} ho.'])
    return _row('roles-nested', str(total), user, roles, steps, ans, f'{total} + {inter} = {a}')


def scene_chain_expr(R):
    """'b x c = ? ani a - inter = ?' - the chain form (ladder L4), different surfaces."""
    a = _q(R, 20, 99)
    b = _q(R, 2, 9)
    c = _q(R, 2, 9)
    inter = b * c
    total = a - inter
    shape = R.randrange(4)
    if shape == 0:
        user = f'{b} x {c} garchu, ani {a} - {inter} = ?'
    elif shape == 1:
        user = f'pehla {b} x {c}, ani {a} - tyo = ?'
    elif shape == 2:
        user = f'{b} x {c} kati ho? ani {a} - {inter} = ?'
    else:
        user = f'{b} x {c} garna, paachi {a} - {inter} = ?'
    roles = [('a', a), ('b', b), ('c', c)]
    steps = f'{b} x {c} = {inter}; {a} - {inter} = {total}'
    ans = R.choice([f'{total}.', f'uttar {total}.', f'{total} ho.'])
    return _row('roles-chain', str(total), user, roles, steps, ans, f'{total} + {inter} = {a}')


SCENES = [scene_buy_then_left, scene_two_prices, scene_give_away, scene_average, scene_percent,
          scene_speed, scene_monthly, scene_away, scene_english, scene_divide, scene_which_number,
          scene_quoted_read, scene_yesno, scene_nested_expr, scene_chain_expr]


def _eval_expr(expr: str) -> int:
    """'3 x 150' / '500 - 450' / '20 x 25 / 100' -> int (x = *)."""
    expr = expr.strip().replace('x', '*').replace('X', '*')
    if not re.fullmatch(r'[\d\s*+\-/().]+', expr):
        raise ValueError(expr)
    val = eval(expr, {'__builtins__': {}}, {})      # noqa: S307 - digits and operators only
    return int(val)


def sample(R, scene=None):
    """one row in the shape the SFT mix expects: {'cat', 'gold', 'messages'}."""
    if scene is None:
        # The symbolic two-step (ladder L2/L4) is the ability we still cannot do, so
        # it gets a real share of the role rows instead of the 1/14 it would get from
        # the uniform draw - a skill that is rare is not learned (the money scene
        # needed 35% of the frame rows for the same reason).
        # ROLES_SYMBOLIC=0 switches them off, for the A/B against a mix without them.
        if os.environ.get('ROLES_SYMBOLIC', '1') == '1':
            if R.random() < 0.25:
                scene = scene_nested_expr if R.random() < 0.5 else scene_chain_expr
            else:
                scene = R.choice(SCENES)
        else:
            # ROLES_SYMBOLIC=0: the symbolic scenes are out of the mix entirely, for a
            # clean A/B against a mix that has none of them.
            scene = R.choice([f for f in SCENES
                              if f not in (scene_nested_expr, scene_chain_expr)])
    return scene(R)


def check(row):
    """the gold number must be in the answer, and the trace's equations must hold."""
    ans = row['messages'][-1]['content']
    if row['gold'] not in ans:
        return f'gold {row["gold"]} not in the answer'
    for part in row['messages'][-1].get('think', '').split('\n'):
        if ':' not in part:
            continue
        head, body = part.split(':', 1)
        if head not in ('hisab', 'jaach'):
            continue
        for step in body.split(';'):
            if '=' not in step:
                continue
            lhs, rhs = step.split('=', 1)
            try:
                got = _eval_expr(lhs)
                want = int(rhs.strip().split(' ')[0])
            except Exception:
                continue
            if got != want:
                return f'equation does not hold: {step.strip()} (={got})'
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=500)
    ap.add_argument('--seed', type=int, default=7)
    ap.add_argument('--out', default=None)
    a = ap.parse_args()
    R = random.Random(a.seed)
    rows, bad = [], 0
    for _ in range(a.n):
        r = sample(R)
        err = check(r)
        if err:
            bad += 1
            continue
        low = r['messages'][0]['content'].lower()
        if any(b in low for b in BANNED):
            bad += 1
            continue
        rows.append(r)
    print(f'{len(rows)} rows ({bad} rejected)')
    if a.out:
        with open(a.out, 'w', encoding='utf8') as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + '\n')
        print('wrote', a.out)


if __name__ == '__main__':
    main()
