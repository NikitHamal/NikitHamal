"""Grounded-ledger word problems: binding-first scratchpads with counterfactual variants.

The failure mode this targets (see issue #9): on NikBench v4b word problems are 2/24, and
both passes are the one template seen verbatim in training. In the failures the model does
not mis-add; it binds the wrong quantity or picks the wrong operation (12/12 inspected).
An equation-only trace reproduces the same mistake. So every trace here starts with an
*extractive* ledger that binds each number to a role before any arithmetic:

    dieko: [money0=1200] [buy1_count=3] [buy1_price=150] [items0=29]
    sodheko: money_final
    sutra: cost1 = buy1_count * buy1_price; money_final = money0 - cost1
    hisab: 3 * 150 = 450; 1200 - 450 = 750
    jaach: 750 + 450 = 1200

Every `[role=value]` value is copied verbatim from the user turn, so a JS validator can
reject a hallucinated binding at decode time. `sample_variants` renders the same event
skeleton with new numbers, which makes template+number memorisation useless.

Rows match the teacher-data contract (`cat`, `gold`, `messages`) and additionally carry
`ledger` = {bindings, ask, gold} for binding-aware scoring.

    python nik/data/teacher/ledger.py --n 5000 --seed 1 --out /tmp/ledger.jsonl
"""
import argparse
import json
import random
from collections import OrderedDict

NAMES = ['sita', 'ram', 'hari', 'gita', 'bikash', 'anita', 'suman', 'kiran', 'rita', 'prakash',
         'nabin', 'sarita', 'dipesh', 'puja', 'roshan', 'sabina', 'manoj', 'asmita', 'kamal', 'binita']
ITEMS = [('kalam', 'wata'), ('kapi', 'wata'), ('syau', 'wata'), ('anda', 'wata'), ('chakleti', 'wata'),
         ('kera', 'wata'), ('ball', 'wata'), ('phool', 'wata'), ('kitab', 'wata'), ('suntala', 'wata'),
         ('pencil', 'wata'), ('biskut', 'packet')]
PEOPLE = ['sathi', 'didi', 'bhai', 'aama', 'buwa', 'hajaram', 'chhimeki', 'shikshak', 'mama', 'kauju']
EVENTS = ['add', 'remove', 'buy', 'sell', 'pack', 'share']
DISTRACT = [('age', '{name} {n} barsha ko ho'), ('windows', '{name} ko ghar ma {n} wata jhyal chhan'),
            ('minutes', '{name} lai school pugna {n} minute lagchha'), ('degrees', 'aaja tapkram {n} degree chha')]


def _used_numbers(spec, row_bindings):
    return {str(v) for v in row_bindings.values()}


def make_spec(R):
    """A reusable event skeleton: entities, event types and *surface wording* fixed;
    only numbers change between counterfactual variants."""
    name = R.choice(NAMES)
    item, unit = R.choice(ITEMS)
    start_items = R.randint(2, 30)
    start_money = R.randint(20, 60) * 50
    n_events = R.randint(2, 4)
    money_ask = R.random() < 0.45
    events = []
    for _ in range(n_events):
        events.append(R.choice(EVENTS))
    if money_ask:
        events[R.randrange(len(events))] = 'buy'   # always renders; guarantees a money step
    elif not any(e in ('add', 'buy', 'pack') for e in events):
        events[0] = 'add'
    distractor = R.choice(DISTRACT) if R.random() < 0.35 else None
    return {'name': name, 'item': item, 'unit': unit, 'start_items': start_items,
            'start_money': start_money, 'events': events, 'ask': 'money_final' if money_ask else 'items_final',
            'distractor': distractor,
            'surface': {'events': [R.randrange(3) for _ in events], 'question': R.randrange(3),
                        'distractor_pos': R.randrange(2, 5)},
            'who': [R.choice(PEOPLE) for _ in events]}


def _say(variant, name, item, event, n, p, g, e, m, who):
    if event == 'add':
        opts = [f'{who} le {n} wata {item} thap diyo.',
                f'pachhi {n} wata {item} thapiyo.',
                f'{who} le aru {n} wata {item} diyo.']
    elif event == 'remove':
        opts = [f'{n} wata {item} harayo.',
                f'{who} lai {n} wata {item} diyo.',
                f'{n} wata {item} kharab bhayo ra phaliyo.']
    elif event == 'buy':
        opts = [f'{name} le {n} wata {item} kinyo, ek ko {p} rupiya.',
                f'{p} rupiya ko dar le {n} wata {item} kinyo.']
    elif event == 'sell':
        opts = [f'{name} le {n} wata {item} {p} rupiya ko dar le bechyo.',
                f'{n} wata {item} {p} rupiya ma bechiyo.']
    elif event == 'pack':
        opts = [f'pachhi {g} wata packet aaye, pratyek ma {e} wata {item}.',
                f'{g} wata baakas aaye, pratyek ma {e} wata {item} thiyo.']
    else:
        opts = [f'usle sabai {item} {m} jana ma barabar baadyo ra aafno bhag matra rakhyo.',
                f'sabai {item} {m} jana ma barabar bhag lagaune bhanda ek bhag matra rakhyo.']
    return opts[variant % len(opts)]


def render(spec, R):
    """Render one number assignment: sentences, bindings, and a query-focused chain.

    The `hisab` chain contains only the steps needed for `sodheko`, in the same
    order as `sutra`, and its last result is the gold. Every operand is either a
    `dieko` value or an earlier hisab result. Values for the other state stay in
    `dieko` as distractors.
    """
    name, item, unit = spec['name'], spec['item'], spec['unit']
    items, money = spec['start_items'], spec['start_money']
    bindings = OrderedDict([('items0', items), ('money0', money)])
    sents = [f'{name} sanga {items} wata {item} chha.', f'{name} sanga {money} rupiya pani chha.']
    item_steps, money_steps = [], []
    item_var, money_var = 'items0', 'money0'
    item_n = money_n = 0

    def push(steps, target, expr, eq, value, reverse):
        steps.append({'target': target, 'expr': expr, 'eq': eq, 'value': value, 'reverse': reverse})

    for i, ev in enumerate(spec['events'], 1):
        who = spec['who'][i - 1]
        variant = spec['surface']['events'][i - 1]
        if ev == 'add':
            n = R.randint(2, 20)
            before = items; items += n
            bindings[f'add{i}'] = n
            sents.append(_say(variant, name, item, 'add', n, 0, 0, 0, 0, who))
            item_n += 1
            push(item_steps, f'items{item_n}', f'{item_var} + add{i}',
                 f'{before} + {n} = {items}', items, f'{items} - {n} = {before}')
            item_var = f'items{item_n}'
        elif ev == 'remove' and items >= 1:
            n = R.randint(1, items)
            before = items; items -= n
            bindings[f'remove{i}'] = n
            sents.append(_say(variant, name, item, 'remove', n, 0, 0, 0, 0, who))
            item_n += 1
            push(item_steps, f'items{item_n}', f'{item_var} - remove{i}',
                 f'{before} - {n} = {items}', items, f'{items} + {n} = {before}')
            item_var = f'items{item_n}'
        elif ev == 'buy':
            n = R.randint(1, 8)
            p = R.randint(2, 50) * 5
            if n * p > money:
                n = max(1, money // max(1, p))
            cost = n * p
            if cost > money or n < 1:
                continue
            before_i, before_m = items, money
            items += n; money -= cost
            bindings[f'buy{i}_count'] = n
            bindings[f'buy{i}_price'] = p
            sents.append(_say(variant, name, item, 'buy', n, p, 0, 0, 0, who))
            item_n += 1
            push(item_steps, f'items{item_n}', f'{item_var} + buy{i}_count',
                 f'{before_i} + {n} = {items}', items, f'{items} - {n} = {before_i}')
            item_var = f'items{item_n}'
            push(money_steps, f'cost{i}', f'buy{i}_count * buy{i}_price', f'{n} * {p} = {cost}', cost, None)
            money_n += 1
            push(money_steps, f'money{money_n}', f'{money_var} - cost{i}',
                 f'{before_m} - {cost} = {money}', money, f'{money} + {cost} = {before_m}')
            money_var = f'money{money_n}'
        elif ev == 'sell' and items >= 1:
            n = R.randint(1, items)
            p = R.randint(2, 40) * 5
            before_i, before_m = items, money
            items -= n; money += n * p
            bindings[f'sell{i}_count'] = n
            bindings[f'sell{i}_price'] = p
            sents.append(_say(variant, name, item, 'sell', n, p, 0, 0, 0, who))
            item_n += 1
            push(item_steps, f'items{item_n}', f'{item_var} - sell{i}_count',
                 f'{before_i} - {n} = {items}', items, f'{items} + {n} = {before_i}')
            item_var = f'items{item_n}'
            push(money_steps, f'revenue{i}', f'sell{i}_count * sell{i}_price', f'{n} * {p} = {n * p}', n * p, None)
            money_n += 1
            push(money_steps, f'money{money_n}', f'{money_var} + revenue{i}',
                 f'{before_m} + {n * p} = {money}', money, f'{money} - {n * p} = {before_m}')
            money_var = f'money{money_n}'
        elif ev == 'pack':
            g, e = R.randint(2, 6), R.randint(2, 12)
            before = items; add = g * e; items += add
            bindings[f'pack{i}_groups'] = g
            bindings[f'pack{i}_per'] = e
            sents.append(_say(variant, name, item, 'pack', 0, 0, g, e, 0, who))
            push(item_steps, f'pack_add{i}', f'pack{i}_groups * pack{i}_per', f'{g} * {e} = {add}', add, None)
            item_n += 1
            push(item_steps, f'items{item_n}', f'{item_var} + pack_add{i}',
                 f'{before} + {add} = {items}', items, f'{items} - {add} = {before}')
            item_var = f'items{item_n}'
        elif ev == 'share' and items >= 2:
            divs = [m for m in range(2, 7) if items % m == 0]
            if not divs:
                continue
            m = R.choice(divs)
            before = items; items //= m
            bindings[f'share{i}_people'] = m
            sents.append(_say(variant, name, item, 'share', 0, 0, 0, 0, m, who))
            item_n += 1
            push(item_steps, f'items{item_n}', f'{item_var} / share{i}_people',
                 f'{before} / {m} = {items}', items, f'{items} * {m} = {before}')
            item_var = f'items{item_n}'
    # one distractor fact: bound in the ledger, never used in the arithmetic
    if spec['distractor']:
        kind, tmpl = spec['distractor']
        used = {str(v) for v in bindings.values()}
        for _ in range(20):
            v = R.randint(6, 60) if kind != 'minutes' else R.randint(5, 40)
            if str(v) not in used:
                break
        else:
            v = 61
        role = f'note{kind}'
        bindings[role] = v
        sents.insert(min(spec['surface']['distractor_pos'], len(sents)), f'{tmpl.format(name=name, n=v)}.')
    ask = spec['ask']
    steps = item_steps if ask == 'items_final' else money_steps
    if not steps:
        return None
    steps[-1]['target'] = ask
    gold = steps[-1]['value']
    sutra = '; '.join(f'{s["target"]} = {s["expr"]}' for s in steps)
    hisab = '; '.join(s['eq'] for s in steps)
    check = steps[-1]['reverse']
    qv = spec['surface']['question'] % 3
    if ask == 'items_final':
        q = [f'antya ma {name} sanga kati wata {item} chha?',
             f'aba jamma kati {item} bhayo?', f'kati wata {item} baki chha?'][qv]
        answer = f'antya ma {gold} wata {item} hunchha.'
        unit_text = f'wata {item}'
    else:
        q = [f'antya ma {name} sanga kati rupiya chha?', f'aba kati rupiya baki chha?',
             f'usko sanga kati paisa baki bhayo?'][qv]
        answer = f'antya ma {gold} rupiya hunchha.'
        unit_text = 'rupiya'
    ledger = (f'dieko: ' + ' '.join(f'[{k}={v}]' for k, v in bindings.items()) + '\n'
              f'sodheko: {ask}\n'
              f'sutra: {sutra}\n'
              f'hisab: {hisab}\n'
              f'jaach: {check}')
    question = ' '.join(sents) + ' ' + q
    return {'cat': 'math-word-ledger', 'gold': str(gold),
            'messages': [{'role': 'user', 'content': question},
                         {'role': 'nik', 'content': answer, 'think': ledger}],
            'ledger': {'bindings': dict(bindings), 'ask': ask, 'gold': gold, 'unit': unit_text}}


def sample(R):
    for _ in range(10):
        row = render(make_spec(R), R)
        if row is not None:
            return row
    raise RuntimeError('ledger: could not render a spec with a non-empty asked chain')


_EVENT_ROLE = {'add': 'add{}', 'remove': 'remove{}', 'buy': 'buy{}_count', 'sell': 'sell{}_count',
               'pack': 'pack{}_groups', 'share': 'share{}_people'}


def _complete(spec, row):
    """True if every event in the spec actually rendered (no number-dependent skip)."""
    bindings = row['ledger']['bindings']
    return all(_EVENT_ROLE[event].format(i) in bindings for i, event in enumerate(spec['events'], 1))


def sample_variants(R, k=3, attempts=6):
    """Same event skeleton and surface wording, k different number assignments.

    A number-dependent branch can skip an event (unaffordable buy, non-divisible
    share, exhausted remove), which changes the story. Retry a few times and keep
    the triple with the most complete variants.
    """
    spec = make_spec(R)
    best_score, best = -1, None
    for _ in range(attempts):
        variants = [render(spec, R) for _ in range(k)]
        if any(v is None for v in variants):
            continue
        score = sum(_complete(spec, v) for v in variants)
        if score > best_score:
            best_score, best = score, variants
        if score == k:
            break
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=5000)
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--variants', type=int, default=1,
                    help='counterfactual variants per skeleton (same surface story, different numbers)')
    ap.add_argument('--out', default='nik/data/teacher/ledger_5k.jsonl')
    a = ap.parse_args()
    R = random.Random(a.seed)
    rows = []
    if a.variants > 1:
        while len(rows) < a.n:
            rows.extend(sample_variants(R, a.variants))
        rows = rows[:a.n]
    else:
        rows = [sample(R) for _ in range(a.n)]
    import os
    os.makedirs(os.path.dirname(a.out) or '.', exist_ok=True)
    with open(a.out, 'w') as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + '\n')
    print('wrote', a.out, len(rows))


if __name__ == '__main__':
    main()
