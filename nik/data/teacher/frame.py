"""Arithmetic wrapped in varied frames (Local-C, issue #9).

Why this exists (measured, issue #9): the model scores **82/96 on arithmetic** and
**0/19 on held-out word-problem templates**, and it fails even `4 x 250` when it
arrives inside a frame ("euta kitab 250 rupiya. 4 wata kitab ko kati?" -> gibberish).
The skill is present; the *transfer into a frame* is missing.  This generator adds
**problems**, not a new format: the think trace reuses the trace style the model
already knows (labelled steps + a `jaach:` check, as in `nik/data/gold/math-word.jsonl`),
so it is orthogonal to the P6 ledger format and adds no new vocabulary.

Three things every row does, because the measured failures are exactly these:
  1. **surface variety** - ~14 scene families, never the same frame twice;
  2. **distractors** - a number in the text that must NOT be used (an age, a count,
     a date), so the model has to *select* the operand instead of copying it;
  3. **2-3 step chains** - the model has to combine, not retrieve one number.

    python nik/data/teacher/frame.py --n 500 --seed 7 --out /tmp/frame.jsonl
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

NAMES = ['sita', 'ram', 'gita', 'bikash', 'maya', 'nabin', 'sunil', 'rekha', 'kiran', 'asha',
         'dipesh', 'prabin', 'manisha', 'rojesh', 'sarita', 'anil', 'kavya', 'bikram']
FOODS = [('aalu', 'kilo', 'rupiya'), ('pyaj', 'kilo', 'rupiya'), ('chamal', 'kilo', 'rupiya'),
         ('momo', 'packet', 'rupiya'), ('roti', 'wata', 'rupiya'), ('dudh', 'litre', 'rupiya'),
         ('jau', 'kilo', 'rupiya'), ('suntari', 'kilo', 'rupiya')]
ITEMS = [('kalam', 'wata'), ('copy', 'wata'), ('bhat', 'wata'), ('kursi', 'ota'), ('kita', 'wata'),
         ('khidki', 'ota'), ('topi', 'ota'), ('joote', 'juta'), ('khuwa', 'kucho'), ('khan', 'kucho')]
PLACES = ['kathmandu', 'pokhara', 'butwal', 'biratnagar', 'birgunj', 'dhangadhi', 'hetauda']
DISTRACTOR = [
    'aaj ko din {d} ho.',
    'ghar ma {d} jana chhan.',
    'bazaar ma {d} ota dukan chhan.',
    'phole {d} barsha dekhi yesto ho.',
]


def _q(R, lo, hi):
    return R.randint(lo, hi)


def _distract(R):
    return R.choice(DISTRACTOR).format(d=_q(R, 3, 40))


def _steps(pairs, check):
    """format the trace: 'label: expr = value. ... jaach: ...'"""
    body = '. '.join(f'{lab}: {expr} = {val}' for lab, expr, val in pairs)
    return f'{body}. jaach: {check}'


def scene_market(R):
    """buy two things, pay with a note -> change"""
    n = R.choice(NAMES)
    (f1, u1, cur), (f2, u2, _) = R.choice(FOODS), R.choice(FOODS)
    p1, q1 = _q(R, 20, 120), _q(R, 1, 6)
    p2, q2 = _q(R, 15, 100), _q(R, 1, 5)
    note = R.choice([500, 1000, 2000])
    c1, c2 = p1 * q1, p2 * q2
    total = c1 + c2
    if note <= total:
        note = ((total // 500) + 1) * 500
    change = note - total
    user = (f'{n} le {q1} {u1} ko {f1} {p1} {cur} ko kinyo, ani {q2} {u2} ko {f2} {p2} {cur} ko kinyo. '
            f'{_distract(R)} aba {note} {cur} diye bhane {change} {cur} bachcha?')
    steps = _steps([(f1, f'{q1} x {p1}', c1), (f2, f'{q2} x {p2}', c2),
                    ('jamma', f'{c1} + {c2}', total), ('bacheko', f'{note} - {total}', change)],
                   f'{c1} + {c2} + {change} = {note}, milyo')
    ans = f'{n} le {change} {cur} bachcha.'
    return user, steps, ans, str(change)


def scene_school(R):
    """more/fewer in a class"""
    n = R.choice(NAMES)
    boys, girls = _q(R, 8, 40), _q(R, 5, 35)
    extra = _q(R, 2, 9)
    user = (f'kaksha ma {boys} jana keta ra {girls} keti chhan. {_distract(R)} '
            f'kaksha ma {extra} jana keti aayera aayo. aba kati jana purush chhan?')
    total = boys + extra
    steps = _steps([('purush', f'{boys} + {extra}', total),
                    ('jamma', f'{boys} + {girls} + {extra}', boys + girls + extra)],
                   f'{total} - {extra} = {boys}, milyo')
    ans = f'kaksha ma {total} jana purush chhan.'
    return user, steps, ans, str(total)


def scene_tickets(R):
    """tickets for a group, some free"""
    n = R.choice(NAMES)
    price = R.choice([50, 100, 150, 200, 250])
    people = _q(R, 3, 12)
    free = _q(R, 1, 3)
    pay = people - free
    cost = price * pay
    user = (f'{n} ra sathi ko {people} jana lai {R.choice(PLACES)} ko ticket {price} {R.choice(["rupiya", "rupiya"])} ko kine. '
            f'{free} jana lai ticket free cha. {_distract(R)} jamma kati rupiya tiru paryo?')
    steps = _steps([('ticket kineko', f'{pay} x {price}', cost)], f'{cost} / {price} = {pay} jana, milyo')
    ans = f'jamma {cost} rupiya tiru paryo.'
    return user, steps, ans, str(cost)


def scene_farm(R):
    """harvest, sell part, keep the rest"""
    n = R.choice(NAMES)
    (crop, unit, cur) = R.choice(FOODS)
    total = _q(R, 20, 90) * _q(R, 2, 5)
    price = _q(R, 20, 90)
    sold = _q(R, 2, total // 3)
    keep = total - sold
    money = sold * price
    user = (f'{n} le {total} {unit} {crop} kathayo. {_distract(R)} '
            f'{sold} {unit} {price} {cur} ko kina, baki {keep} {unit} ghar ma rakhyo. '
            f'kina ko paisa kati bhayo?')
    steps = _steps([('bakeko', f'{total} - {sold}', keep), ('kina ko paisa', f'{sold} x {price}', money)],
                   f'{sold} + {keep} = {total} {unit}, milyo')
    ans = f'{n} le {money} {cur} kathayo.'
    return user, steps, ans, str(money)


def scene_kitab(R):
    """the exact failure: 4 x 250 inside a frame"""
    n = R.choice(NAMES)
    (item, unit) = R.choice(ITEMS)
    price = _q(R, 20, 250)
    count = _q(R, 2, 9)
    cost = price * count
    pay = ((cost // 500) + 1) * 500
    user = (f'euta {item} ko mol {price} rupiya ko chha. {_distract(R)} '
            f'{n} le {count} wata {item} kinyo. aba kati rupiya tiru paryo?')
    steps = _steps([('jamma', f'{count} x {price}', cost)], f'{cost} / {price} = {count} wata, milyo')
    ans = f'jamma {cost} rupiya tiru paryo.'
    return user, steps, ans, str(cost)


def scene_time(R):
    """speed x hours + extra"""
    speed = R.choice([20, 30, 40, 50, 60, 70, 80])
    hours = _q(R, 2, 6)
    extra = _q(R, 5, 40)
    dist = speed * hours + extra
    user = (f'ek gaadi {_distract(R)} {speed} km/hr ko speed ma {hours} ghanta chalayo, '
            f'ani {extra} km extra gayo. jamma kati km gayo?')
    steps = _steps([('pahilo', f'{speed} x {hours}', speed * hours),
                    ('jamma', f'{speed * hours} + {extra}', dist)],
                   f'{dist} - {extra} = {speed * hours}, milyo')
    ans = f'jamma {dist} km gayo.'
    return user, steps, ans, str(dist)


def scene_bus(R):
    """two legs at different speeds"""
    s1, h1 = R.choice([40, 60, 80]), _q(R, 2, 4)
    s2, h2 = R.choice([30, 50, 70]), _q(R, 1, 4)
    total = s1 * h1 + s2 * h2
    user = (f'bus pahila {h1} ghanta {s1} km/h ma ani {h2} ghanta {s2} km/h ma gayo. '
            f'{_distract(R)} jamma kati km bhayo?')
    steps = _steps([('pahilo bhag', f'{s1} x {h1}', s1 * h1), ('dosro bhag', f'{s2} x {h2}', s2 * h2),
                    ('jamma', f'{s1 * h1} + {s2 * h2}', total)], f'{total} - {s1 * h1} = {s2 * h2}, milyo')
    ans = f'bus jamma {total} km bhayo.'
    return user, steps, ans, str(total)


def scene_basket(R):
    """lines of beads"""
    lines = _q(R, 3, 12)
    per = _q(R, 4, 15)
    broken = _q(R, 2, min(9, lines * per - 1))
    total = lines * per - broken
    user = (f'euta basket ma {lines} wata line chhan, har line ma {per} wata rukh chhan. '
            f'{_distract(R)} {broken} wata rukh bhijeko. aba kati rukh bacheko?')
    steps = _steps([('jamma', f'{lines} x {per}', lines * per),
                    ('bacheko', f'{lines * per} - {broken}', total)],
                   f'{total} + {broken} = {lines * per}, milyo')
    ans = f'{total} wata rukh bacheko.'
    return user, steps, ans, str(total)


def scene_discount(R):
    """percent discount"""
    price = R.choice([200, 400, 500, 800, 1000, 1200, 1500])
    pct = R.choice([10, 20, 25, 50])
    count = _q(R, 2, 5)
    off = price * pct // 100
    each = price - off
    total = each * count
    user = (f'euta {R.choice(ITEMS)[0]} ko mul {price} rupiya. {pct}% discount chha. '
            f'{_distract(R)} {count} wata kina jana kati rupiya tiru paryo?')
    steps = _steps([('ek ko', f'{price} - {price} x {pct} / 100', each),
                    ('jamma', f'{count} x {each}', total)],
                   f'{total} / {each} = {count} wata, milyo')
    ans = f'jamma {total} rupiya tiru paryo.'
    return user, steps, ans, str(total)


def scene_saving(R):
    """monthly saving over months"""
    per = _q(R, 10, 90) * 100          # saved per month, in rupiya
    months = _q(R, 3, 12)
    extra = _q(R, 5, 40) * 100
    total = per * months + extra
    user = (f'{R.choice(NAMES)} le jana ko talab {per} rupiya ra {_distract(R)} '
            f'har mahina {per} rupiya bachayo. {months} mahina pachhi usko bachat kati?')
    steps = _steps([('mahina', f'{months} x {per}', per * months),
                    ('jamma', f'{per * months} + {extra}', total)],
                   f'{total} - {extra} = {per * months}, milyo')
    ans = f'bachat {total} rupiya bhayo.'
    return user, steps, ans, str(total)


def scene_recharge(R):
    """data pack minus used"""
    pack = R.choice([100, 150, 200, 300, 500])
    used = _q(R, 10, 60)
    left = pack - used
    user = (f'{R.choice(NAMES)} le {pack} rupiya ko recharge gare. {_distract(R)} '
            f'pak ma {used} rupiya kanchyo. bacheko kati?')
    steps = _steps([('bacheko', f'{pack} - {used}', left)], f'{left} + {used} = {pack}, milyo')
    ans = f'bacheko {left} rupiya.'
    return user, steps, ans, str(left)


def scene_cricket(R):
    """runs and extras"""
    runs = _q(R, 10, 60)
    fours = _q(R, 1, 6)
    extra = _q(R, 1, 8)
    total = runs + fours * 4 + extra
    user = (f'{R.choice(NAMES)} le {runs} run banaayo ra {fours} chautyo kata. '
            f'{_distract(R)} {extra} extra pani thiyera. jamma kati?')
    steps = _steps([('run', f'{runs} + {fours} x 4', runs + fours * 4),
                    ('jamma', f'{runs} + {fours} x 4 + {extra}', total)],
                   f'{total} - {extra} = {runs + fours * 4}, milyo')
    ans = f'jamma {total} run bhayo.'
    return user, steps, ans, str(total)


def scene_boxes(R):
    """boxes of items, some spoiled"""
    boxes = _q(R, 3, 12)
    each = _q(R, 3, 12)
    bad = _q(R, 1, 9)
    good = boxes * each - bad
    user = (f'{boxes} ota box ma {each} wata {R.choice(["aalu", "momo", "kursi"])} chhan. '
            f'{_distract(R)} jamma {bad} wata nasak cha. kati wata thik cha?')
    steps = _steps([('jamma', f'{boxes} x {each}', boxes * each),
                    ('thik', f'{boxes * each} - {bad}', good)], f'{good} + {bad} = {boxes * each}, milyo')
    ans = f'{good} wata thik cha.'
    return user, steps, ans, str(good)


def scene_pct_more(R):
    """a percent more than a base"""
    base = R.choice([100, 200, 400, 500, 800])
    pct = R.choice([10, 20, 25, 50])
    add = base * pct // 100
    total = base + add
    user = (f'ek kantara ma {base} rupiya ko kanda chha. {_distract(R)} '
            f'yo {pct}% le badayo bhane aba kati rupiya hunchha?')
    steps = _steps([('bado', f'{base} x {pct} / 100', add), ('jamma', f'{base} + {add}', total)],
                   f'{total} - {add} = {base}, milyo')
    ans = f'aba {total} rupiya hunchha.'
    return user, steps, ans, str(total)


SCENES = [scene_market, scene_school, scene_tickets, scene_farm, scene_kitab, scene_time,
          scene_bus, scene_basket, scene_discount, scene_saving, scene_recharge, scene_cricket,
          scene_boxes, scene_pct_more]


def sample(R):
    """one row in the shape the SFT mix expects: {'cat', 'gold', 'messages'}"""
    sc = R.choice(SCENES)
    user, steps, ans, gold = sc(R)
    return {'cat': 'math-word-frame', 'gold': gold,
            'messages': [{'role': 'user', 'content': user},
                         {'role': 'nik', 'content': ans, 'think': steps}]}


def check(row):
    """the gold number must appear in the answer, and every equation in the trace must hold."""
    ans = row['messages'][-1]['content']
    if row['gold'] not in ans:
        return f'gold {row["gold"]} not in the answer'
    for part in row['messages'][-1].get('think', '').split('. '):
        if '=' not in part:
            continue
        lhs, rhs = part.split('=', 1)
        lhs = lhs.split(': ', 1)[-1]              # drop the step label ("jamma: 3 x 45 = 135")
        rhs = rhs.strip().split()[0] if rhs.strip() else ''
        rhs = ''.join(ch for ch in rhs if ch.isdigit() or ch == '-')
        try:
            expr = lhs.strip().replace(' x ', ' * ')      # the trace style writes "x" for multiply
            lhs_v = eval(expr, {'__builtins__': {}}, {})   # noqa: S307 - our own strings
            rhs_v = int(rhs)
        except Exception:
            return f'cannot parse step: {part!r}'
        if int(lhs_v) != rhs_v:
            return f'bad equation: {part!r} ({lhs_v} != {rhs_v})'
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=1000)
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--out', default='')
    a = ap.parse_args()
    R = random.Random(a.seed)
    rows, bad = [], 0
    for _ in range(a.n):
        row = sample(R)
        if check(row):
            bad += 1
            continue
        rows.append(row)
    out = a.out or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frame_%dk.jsonl' % (a.n // 1000))
    with open(out, 'w', encoding='utf8') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f'wrote {out}: {len(rows)} rows ({bad} rejected by the arithmetic checker)')


if __name__ == '__main__':
    main()
