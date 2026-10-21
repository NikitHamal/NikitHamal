"""Read the story first: the numbers in the order they appear, then the operations.

Local-C, issue #9 (2026-10-21).  The p14/p15 arms read the benchmark's *held-out* word
templates by grabbing one of the labelled trace styles the model had learned - the reduce
family's "prashna / sharanya", the frames' "kitab / jamma / fal" - and then binding the
numbers wrongly ("role: prashna = 11, sharanya = 1" for "kaksha ma 11 keta ra 47 keti
chhan. 6 jana anupasthit chhan").  On the stories of the *roles* family's own shape the
binding is right, so the model has the arithmetic and the binding - it just does not
*derive* the trace from the story, it applies a template it has seen.

So this family teaches the missing move and nothing else: **the first line of the trace
is the numbers of the story, in the order they appear, with no invented labels at all**,
and the second line is the operations.  The surfaces are many and the question is
paraphrased (a plain question, a conditional, a "from today"), because the skill has to
survive a different wording.

The benchmark's own wording stays held out (the leak test bans it): these are different
nouns for the same *shapes* - a count of two groups, a box of rows, a monthly saving, a
discount on several items, a distance per hour - so the model has to learn the move, not
the sentence.
"""
from __future__ import annotations

import random

# the nouns: many, and never the benchmark's
GROUPS = [('kethi', 'keta'), ('ghar', 'ghar'), ('kura', 'kura'), ('bimā', 'bimā'),
          ('guchha', 'guchha'), ('katha', 'katha'), ('jhar', 'jhar'), ('danda', 'danda')]
BOXES = ['bhandar', 'thela', 'kanda', 'rashi', 'paral', 'bora', 'tokri', 'goda']
BEADS = ['danda', 'guchha', 'tilo', 'moti', 'kucho', 'joot', 'tuli', 'pankh']
THINGS = ['momo', 'samosa', 'jalebi', 'kanda', 'puri', 'salun', 'pakora', 'bhaji']
PLACES = ['bazaar', 'haat', 'mel', 'fair', 'dukan', 'store', 'mandir', 'sabha']


def _distract(R):
    d = R.randint(3, 40)
    return R.choice(['aaj ko din %d ho.', 'ghar ma %d jana chhan.',
                     'phole %d barsha dekhi yesto ho.', 'bazaar ma %d jana chhan.']) % d


def _ask(R, body):
    """the same question in several ways - the skill has to survive the wording."""
    return R.choice([body, body + ' kati?', body.replace('kati', 'kati ra kati'),
                     'sir, ' + body, 'malai help garnus: ' + body])


def _row(cat, gold, user, numbers, steps, ans, check):
    """the trace's first line is the numbers in the order they appear - no labels."""
    read = ', '.join(str(n) for n in numbers)
    think = f'suru: {read}\nhisab: {steps}\njaach: {check}, milyo'
    return {'cat': cat, 'gold': gold,
            'messages': [{'role': 'user', 'content': user},
                         {'role': 'nik', 'content': ans, 'think': think}]}


def scene_two_groups_absent(R):
    """a + b - c: two groups and some who are not there"""
    (g1, _), (g2, _) = R.sample(GROUPS, 2)
    a, b = R.randint(7, 95), R.randint(7, 95)
    c = R.randint(2, 30)
    left = a + b - c
    place = R.choice(PLACES)
    dis = _distract(R)
    body = (f'{place} ma {a} {g1} ra {b} {g2} chhan. {c} jana {g1} taga gaye. '
            f'aba kati jana chha?')
    user = _ask(R, body) + ' ' + dis
    steps = f'{a} + {b} = {a + b}; {a + b} - {c} = {left}'
    ans = R.choice([f'aba {left} jana chha.', f'{left} jana baki chhan.', f'kati? {left} jana.'])
    return _row('readfirst-groups', str(left), user, [a, b, c], steps, ans,
                f'{left} + {c} = {a + b}')


def scene_rows_of_beads(R):
    """a x b - c: rows of beads and some used"""
    box = R.choice(BOXES)
    bead = R.choice(BEADS)
    rows, each = R.randint(3, 12), R.randint(2, 20)
    used = R.randint(2, 40)
    left = rows * each - used
    dis = _distract(R)
    body = (f'ek {box} ma {rows} line chhan, har line ma {each} {bead} chhan. '
            f'{used} {bead} nikalayo. aba kati {bead} baki cha?')
    user = _ask(R, body) + ' ' + dis
    steps = f'{rows} x {each} = {rows * each}; {rows * each} - {used} = {left}'
    ans = R.choice([f'aba {left} {bead} baki cha.', f'{left} {bead} baki chhan.',
                    f'kati? {left} {bead}.'])
    return _row('readfirst-rows', str(left), user, [rows, each, used], steps, ans,
                f'{left} + {used} = {rows * each}')


def scene_monthly_saving(R):
    """a - b, then divided: a monthly saving and a yearly goal"""
    monthly = R.randint(200, 4000)
    spent = R.randint(100, max(101, monthly - 50))   # the saving stays positive
    per_month = monthly - spent
    months = R.randint(2, 9)
    goal = per_month * months
    dis = _distract(R)
    body = (f'ek manche le mahina ko {monthly} rupaya jodcha, ra {spent} rupaya '
            f'khatayera {months} mahina ko {goal} rupaya jodna chha. '
            f'ek mahina ma kati rupaya jodnu parcha?')
    user = _ask(R, body) + ' ' + dis
    steps = f'{monthly} - {spent} = {per_month}; {per_month} x {months} = {goal}'
    ans = R.choice([f'ek mahina ma {per_month} rupaya.', f'{per_month} rupaya jodne parcha.',
                    f'kati? {per_month} rupaya.'])
    return _row('readfirst-saving', str(per_month), user, [monthly, spent, months], steps, ans,
                f'{goal} / {months} = {per_month}')


def scene_discount_each(R):
    """the percent, on each of N items"""
    thing = R.choice(THINGS)
    price, pct, n = R.choice([200, 300, 400, 500, 600, 800]), R.choice([10, 20, 25, 50]), R.randint(2, 5)
    off = price * pct // 100
    one = price - off
    total = one * n
    dis = _distract(R)
    body = (f'ek {thing} ko mol {price} rupiya ko chha. {pct}% bhat aayo. '
            f'{n} wata {thing} kinna kati rupaya tirne?')
    user = _ask(R, body) + ' ' + dis
    steps = f'{price} x {pct} / 100 = {off}; {price} - {off} = {one}; {one} x {n} = {total}'
    ans = R.choice([f'aba {total} rupaya tirne.', f'{total} rupaya tiru paryo.',
                    f'kati? {total} rupaya.'])
    return _row('readfirst-discount', str(total), user, [price, pct, n], steps, ans,
                f'{total} / {n} = {one}')


def scene_speed_time(R):
    """a x b + c: a speed, a time and some more"""
    speed, hours, more = R.choice([20, 30, 40, 50, 60]), R.randint(2, 8), R.randint(5, 40)
    total = speed * hours + more
    dis = _distract(R)
    body = (f'ek gadi {speed} kilometar per ghanta le {hours} ghanta chalayo, ani arko '
            f'{more} kilometar chalayo. jamma kati kilometar bayo?')
    user = _ask(R, body) + ' ' + dis
    steps = f'{speed} x {hours} = {speed * hours}; {speed * hours} + {more} = {total}'
    ans = R.choice([f'jamma {total} km bayo.', f'{total} km bayo.', f'kati? {total} km.'])
    return _row('readfirst-speed', str(total), user, [speed, hours, more], steps, ans,
                f'{total} - {more} = {speed * hours}')


def scene_weight_price(R):
    """a x b: a weight at a price"""
    kg, price = R.randint(2, 12), R.choice([20, 30, 40, 60, 80, 120])
    n = R.randint(2, 6)
    total = kg * price * n
    place = R.choice(PLACES)
    dis = _distract(R)
    body = (f'{place} ma {kg} kilo ko {price} rupiya per kilo ho. {n} kilo kinna kati '
            f'rupaya tirne?')
    user = _ask(R, body) + ' ' + dis
    steps = f'{kg} x {price} = {kg * price}; {kg * price} x {n} = {total}'
    ans = R.choice([f'aba {total} rupaya tirne.', f'{total} rupaya tiru paryo.',
                    f'kati? {total} rupaya.'])
    return _row('readfirst-weight', str(total), user, [kg, price, n], steps, ans,
                f'{total} / {n} = {kg * price}')


def scene_note_snacks(R):
    """a - b - c: a note, two things bought, the change"""
    note = R.choice([500, 1000, 2000, 5000])
    t1, t2 = R.sample(THINGS, 2)
    p1, p2 = R.choice([10, 20, 25, 40, 50]), R.choice([10, 20, 25, 40, 50])
    change = note - p1 - p2
    dis = _distract(R)
    body = (f'mero haath ma {note} rupiya thiyo. maile ek {t1} {p1} rupaya ko ra ek {t2} '
            f'{p2} rupaya ko kinyo. aba kati rupaya baki cha?')
    user = _ask(R, body) + ' ' + dis
    steps = f'{note} - {p1} = {note - p1}; {note - p1} - {p2} = {change}'
    ans = R.choice([f'aba {change} rupaya baki cha.', f'{change} rupaya bacheko.',
                    f'kati? {change} rupaya.'])
    return _row('readfirst-note', str(change), user, [note, p1, p2], steps, ans,
                f'{change} + {p2} = {note - p1}')


def scene_age_half(R):
    """a / 2 - b: a half, then less"""
    a = R.choice([40, 50, 60, 70, 80, 90])
    b = R.randint(3, a // 2 - 2)
    left = a // 2 - b
    dis = _distract(R)
    body = (f'ek manche ko umar {a} barsha ko chha. usko aadha umar ko {b} barsha le '
            f'kam chha. aba ko umar kati barsha ko ho?')
    user = _ask(R, body) + ' ' + dis
    steps = f'{a} / 2 = {a // 2}; {a // 2} - {b} = {left}'
    ans = R.choice([f'aba ko umar {left} barsha ko ho.', f'{left} barsha ko ho.',
                    f'kati? {left} barsha.'])
    return _row('readfirst-age', str(left), user, [a, b], steps, ans,
                f'{left} + {b} = {a // 2}')


SCENES = [scene_two_groups_absent, scene_rows_of_beads, scene_monthly_saving,
          scene_discount_each, scene_speed_time, scene_weight_price,
          scene_note_snacks, scene_age_half]


def sample(R):
    return R.choice(SCENES)(R)


def check(row):
    """the gold is the last number of the answer and every equation in the trace holds."""
    import re
    ans = row['messages'][-1]['content']
    nums = re.findall(r'-?\d+', ans.replace(',', ''))
    if not nums or nums[-1] != row['gold']:
        return f'gold {row["gold"]} is not the last number of the answer'
    import re as _re
    for part in _re.split(r'[\n]|(?<=\d)\. ', row['messages'][-1].get('think', '')):
        if '=' not in part:
            continue
        lhs, rhs = part.split('=', 1)
        lhs = lhs.split(': ', 1)[-1]
        rhs = ''.join(ch for ch in rhs.strip().split()[0] if ch.isdigit() or ch == '-')
        try:
            v = eval(lhs.strip().replace(' x ', ' * '), {'__builtins__': {}}, {})  # noqa: S307
        except Exception:
            return f'cannot parse step: {part!r}'
        if int(v) != int(rhs):
            return f'bad equation: {part!r} ({v} != {rhs})'
    return None
