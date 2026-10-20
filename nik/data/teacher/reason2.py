"""Second wave of reasoning: verification (critique), explaining on request,
constraint puzzles, truth-teller puzzles and reading a small table.
Some of these return multi-turn conversations: dict(messages=[...], gold, kind)."""
import random

import math_gen
import math2
from math_gen import NAMES, ITEMS, ex, pick
from verify import evaluate

NUMERIC = [math_gen.add_column, math_gen.sub_column, math_gen.mul_partial, math_gen.percent_of, math_gen.linear_eq,
           math_gen.shopping, math_gen.average, math2.bodmas, math2.consecutive, math2.distractor, math2.best_buy]


def critique(R):
    """User proposes an answer; Nik verifies it step by step and confirms or gently corrects."""
    for _ in range(20):
        e = pick(R, NUMERIC)(R)
        if evaluate(e['gold']) is not None:
            break
    gold = evaluate(e['gold'])
    right = R.random() < 0.4
    if right:
        claim = gold
    else:
        delta = R.choice([1, 2, 10, -1, -10, 9, 100]) if gold > 20 else R.choice([1, -1, 2])
        claim = gold + delta
    cs = str(claim.numerator) if claim.denominator == 1 else f'{claim.numerator}/{claim.denominator}'
    q = pick(R, [f'{e["q"]} maile {cs} aayo, thik ho?', f'{e["q"]} mero jawaf {cs}. check garnus na.', f'{e["q"]} {cs} hunchha hola, hoina?'])
    think = 'user ko jawaf janchnu chha, tyasaile afai step step hisab garchhu. ' + e['think']
    if right:
        a = f'ho, tapai ko jawaf thik chha! {e["a"]}'
    else:
        a = f'najik hunuhunchha, tara alikati galti bhayo. sahi jawaf {e["gold"]} ho, {cs} haina. {e["a"]}'
    return {'kind': 'critique', 'gold': e['gold'], 'messages': [{'role': 'user', 'content': q}, {'role': 'nik', 'content': a, 'think': think}]}


def explain_on_request(R):
    """Short answer first; when the user asks 'kasari?' Nik explains its reasoning in prose."""
    e = pick(R, NUMERIC)(R)
    first = {'role': 'nik', 'content': e['a']}
    ask = pick(R, ['kasari aayo?', 'kasari nikalnu bhayo? bistar ma bhannus na.', 'yo kasari hunchha, bujhaidinus.', 'step step dekhaunus.'])
    steps = e['think'].replace(' jaach:', ' antama jaach garchhu:')
    return {'kind': 'followup', 'gold': e['gold'],
            'messages': [{'role': 'user', 'content': e['q']}, first, {'role': 'user', 'content': ask},
                         {'role': 'nik', 'content': f'hunchha, step step bhanchhu. {steps}'}]}


def seating(R):
    a, b, c = R.sample(NAMES, 3)
    q = (f'{a}, {b} ra {c} ek line ma basekachhan. {a} sabai bhanda baya chhaina. {c} bich ma chha. '
         f'{b} {a} ko daya tira chhaina. sabai bhanda baya ko chha?')
    # c is middle, so the ends are a and b. a is not leftmost, so a is rightmost and b leftmost.
    think = (f'{c} bich ma chha, tyasaile dubai chheu ma {a} ra {b} chhan. {a} sabai bhanda baya chhaina, tyasaile {a} daya chheu ma chha. '
             f'baki baya chheu {b} ko bhayo. jaach: {b} {a} ko baya tira chha, daya tira chhaina, milyo. kram: {b}, {c}, {a}.')
    return ex(q, think, f'sabai bhanda baya {b} chha.', b, 'puzzle')


def truth_teller(R):
    a, b = R.sample(NAMES, 2)
    q = (f'euta gaun ma kehi manchhe sadhai sach bolchhan ra kehi sadhai jhut. {a} le bhanyo: "{b} jhut bolchha." '
         f'{b} le bhanyo: "hami duitai sach bolchhau." ko sach bolchha?')
    think = (f'yadi {b} sach bolthyo bhane "hami duitai sach bolchhau" sach hunthyo, tara {a} le {b} lai jhuto bhaneko pani sach hunu parthyo. yo ek arka ko birodh ho. '
             f'tyasaile {b} jhut bolchha. ani "{b} jhut bolchha" bhanne {a} ko kura sach bhayo, tyasaile {a} sach bolchha.')
    return ex(q, think, f'{a} sach bolchha ra {b} jhut bolchha.', a, 'puzzle')


def table_reading(R):
    rows = R.sample(ITEMS[:10], 4)
    prices = {it: R.choice([10, 15, 20, 25, 30, 40, 50, 60, 80]) for it, _ in rows}
    while len(set(prices.values())) < 4:
        prices = {it: R.choice([10, 15, 20, 25, 30, 40, 50, 60, 80]) for it, _ in rows}
    table = '; '.join(f'{it}: {p} rupiya' for it, p in prices.items())
    k = R.random()
    if k < 0.5:
        it = max(prices, key=prices.get)
        q = f'pasal ko mol suchi: {table}. sabai bhanda mahango kun ho?'
        think = f'mol haru tulana garchhu: ' + ', '.join(f'{i} {p}' for i, p in prices.items()) + f'. sabai bhanda thulo {prices[it]}, jun {it} ko ho.'
        return ex(q, think, f'sabai bhanda mahango {it} ho, {prices[it]} rupiya.', it, 'table')
    i1, i2 = R.sample(list(prices), 2)
    n1, n2 = R.randint(2, 5), R.randint(1, 4)
    tot = n1 * prices[i1] + n2 * prices[i2]
    q = f'pasal ko mol suchi: {table}. {n1} wata {i1} ra {n2} wata {i2} kinda kati lagchha?'
    think = f'suchi bata: {i1} {prices[i1]}, {i2} {prices[i2]}. {n1} x {prices[i1]} = {n1 * prices[i1]}. {n2} x {prices[i2]} = {n2 * prices[i2]}. jamma: {n1 * prices[i1]} + {n2 * prices[i2]} = {tot}.'
    return ex(q, think, f'jamma {tot} rupiya lagchha.', tot, 'table')


def as_messages(e):
    if 'messages' in e:
        return e
    return {'kind': e['kind'], 'gold': e['gold'], 'messages': [{'role': 'user', 'content': e['q']}, {'role': 'nik', 'content': e['a'], 'think': e['think']}]}


FAMILIES = [(critique, 3), (explain_on_request, 2), (seating, 1), (truth_teller, 0.8), (table_reading, 2)]


def sample(R):
    f = R.choices([f for f, _ in FAMILIES], weights=[w for _, w in FAMILIES])[0]
    return as_messages(f(R))
