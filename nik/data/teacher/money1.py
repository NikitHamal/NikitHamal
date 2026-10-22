"""One-step money and count problems in the ways people actually write them (Claude, 2026-10-22).

Why: the first thing a visitor types is `mero sanga 500 rupiya thiyo. 180 kharcha bhayo. kati baki?`. r1 (k3's recipe)
answers it greedily with `role: paisa = 500, wata = 180, ek ko = 180` -> `180 - 180 = 0`, and both m50 and r1 turn
`ram sanga 50 rupiya chha. usle 18 rupiya kharcha garyo.` into `ek ko = 15` (a price that is not in the text). Every
money scene in roles.py has a count AND a price, so `role:` came to mean "paisa, wata, ek ko" whatever the text says.

Rows here bind ONLY the quantities the text gives (`role: paisa = 500, kharcha = 180`), one step (+ or -), sometimes a
second step, sometimes a distractor number that belongs to no role (an age, a date) and is named as unused. Many
surfaces: mero / ma / malai / {name} sanga, kharcha / tiryo / kine / diyo / harayo / payo / thapyo, baki / bachyo /
rahyo / bhayo. The answer always restates the think's result (r1 once wrote `1000 - 350 = 650` and answered 1000).
Held-out prompts: nik/tests/chat/money_heldout.json (never generated: guarded in make_sft2).
"""
import random

NAMES = ['ram', 'sita', 'hari', 'gita', 'sunil', 'asha', 'bikash', 'puja', 'rajesh', 'anita', 'kiran', 'maya', 'suman',
         'dipak', 'sarita', 'nabin', 'binita', 'prakash', 'rojina', 'aayush']
OWN_ME = ['mero sanga', 'ma sanga', 'mero khalti ma', 'mero pocket ma']
THINGS = ['kitab', 'kapi', 'jutta', 'kalam', 'chiya', 'momo', 'tarkari', 'phal', 'cycle ko tyre', 'jhola', 'topi']
LEFT_Q = ['kati baki?', 'kati baki chha?', 'aba kati bachyo?', 'kati rahyo?', 'aba kati paisa chha?', 'kati bachyo?',
          'baki kati?', 'aba mero sanga kati chha?']
GOT_Q = ['aba kati bhayo?', 'aba jamma kati chha?', 'jamma kati bhayo?', 'aba kati paisa chha?']
# no ages: k5/k5b (money1 2%) both lost the trap `nikit ra hari dubai 20 barsha ka hun. hari kati barsha ko ho?` (no
# number), while k4 and r1 (no money1) kept it. "ma 20 barsha ko chhu" marked as unused taught "barsha = ignore".
DISTRACT = ['aaja {n} gate ho.', 'mero kaksha ma {n} jana chhan.', 'ghar ma {n} wata kursi chhan.', 'bus ma {n} jana thiye.']


def _amount(R):
    return R.choice([R.randint(2, 99) * 10, R.randint(5, 95) * 100, R.randint(11, 999), R.randint(1, 20) * 50])


def _spend(R, money):
    lo = max(1, money // 20)
    return R.randint(lo, money - 1) if R.random() < 0.95 else money    # sometimes everything is spent


def sample(R):
    me = R.random() < 0.6
    name = R.choice(NAMES)
    who = R.choice(OWN_ME) if me else f'{name} sanga'
    subj = '' if me else name
    money = _amount(R)
    kind = R.random()
    dis = R.random() < 0.25
    dtext, dnum = '', None
    if dis:
        dnum = R.randint(2, 30)
        dtext = R.choice(DISTRACT).format(n=dnum)
    if kind < 0.55:                                       # spend once
        y = _spend(R, money)
        verb = R.choice([f'{y} kharcha bhayo.', f'{y} rupiya kharcha garyo.' if not me else f'{y} rupiya kharcha gare.',
                         f'{y} ko {R.choice(THINGS)} kine.' if me else f'{y} ko {R.choice(THINGS)} kinyo.',
                         f'{y} rupiya tiryo.' if not me else f'{y} rupiya tire.', f'{y} rupiya harayo.',
                         f'bhai lai {y} rupiya diye.' if me else f'bhai lai {y} rupiya diyo.'])
        tense = R.choice(['thiyo', 'chha'])
        parts = [f'{who} {money} rupiya {tense}.', dtext, (subj + ' ' if subj and R.random() < 0.5 else '') + verb, R.choice(LEFT_Q)]
        roles = f'paisa = {money}, kharcha = {y}'
        steps = f'{money} - {y} = {money - y}'
        check = f'{money - y} + {y} = {money}'
        gold = money - y
        ans = R.choice([f'aba {gold} rupiya baki chha.', f'{gold} rupiya bachyo.', f'baki {gold} rupiya chha.',
                        f'jawaf: {gold} rupiya.']) if gold else '0 rupiya baki chha: sabai kharcha bhayo.'
    elif kind < 0.8:                                      # receive once
        y = _amount(R)
        verb = R.choice([f'aama le {y} rupiya dinubhayo.', f'buwa le {y} rupiya dinubhayo.', f'{y} rupiya kamaye.' if me else f'{y} rupiya kamayo.',
                         f'sathi le {y} rupiya firta garyo.', f'{y} rupiya bato ma bhetiyo.'])
        parts = [f'{who} {money} rupiya thiyo.', dtext, verb, R.choice(GOT_Q)]
        roles = f'paisa = {money}, payo = {y}'
        steps = f'{money} + {y} = {money + y}'
        check = f'{money + y} - {y} = {money}'
        gold = money + y
        ans = R.choice([f'aba {gold} rupiya chha.', f'jamma {gold} rupiya bhayo.', f'jawaf: {gold} rupiya.'])
    else:                                                 # spend twice
        y1 = _spend(R, money // 2 + 1) if money > 3 else 1
        y2 = R.randint(1, max(1, money - y1))
        if y1 + y2 > money:
            return sample(R)
        t1, t2 = R.sample(THINGS, 2)
        parts = [f'{who} {money} rupiya thiyo.', dtext, f'{y1} ko {t1} ra {y2} ko {t2} kine.' if me else f'{y1} ko {t1} ra {y2} ko {t2} kinyo.',
                 R.choice(LEFT_Q)]
        roles = f'paisa = {money}, kharcha = {y1} ra {y2}'
        steps = f'{y1} + {y2} = {y1 + y2}; {money} - {y1 + y2} = {money - y1 - y2}'
        check = f'{money - y1 - y2} + {y1 + y2} = {money}'
        gold = money - y1 - y2
        ans = R.choice([f'aba {gold} rupiya baki chha.', f'{gold} rupiya bachyo.', f'jawaf: {gold} rupiya.']) if gold else \
            '0 rupiya baki chha: sabai kharcha bhayo.'
    if dis:
        roles += f' ({dnum} hisab ma chahidaina)'
    user = ' '.join(p for p in parts if p)
    if R.random() < 0.5:
        user = user.replace(' rupiya', '', 1) if R.random() < 0.3 else user
    think = f'role: {roles}\nhisab: {steps}\njaach: {check}, milyo'
    return {'cat': 'money1', 'gold': str(gold), 'messages': [
        {'role': 'user', 'content': user}, {'role': 'nik', 'content': ans, 'think': think}]}


if __name__ == '__main__':
    import json
    R = random.Random(1)
    for _ in range(8):
        print(json.dumps(sample(R), ensure_ascii=False))
