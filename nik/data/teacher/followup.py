"""Vague follow-ups that point back at Nik's own previous reply (Claude, 2026-10-22).

Owner's /chat report: after `347 + 285 kati hunchha?` -> `jawaf 632 ho.`, the follow-up `kati rey?` got nonsense.
Real users do this all the time: ask again, ask to repeat, ask "sure?". Rows: one ordinary exchange from the teacher
mix (build.one), then a vague follow-up, then a reply that restates the previous answer (numbers: the gold value).

followup-op (chat_audit.mjs, live m50: `9 x 9 kati?` -> 81, `ani 2 le gunda?` -> 81 again; `120 + 45` -> 165,
`ani tyasma 15 ghatayo bhane?` -> `25 - 15`): the follow-up does arithmetic ON the previous answer. The think names the
previous answer first (`aghi ko jawaf 81 ho.`), then computes, so the model learns to fetch the number from its own
last reply instead of from the nearest digits. followup-en: the same in English (`are you sure?` got `You smove!`).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ASK_NUM = ['kati rey?', 'kati bhanyo?', 'jawaf kati aayo?', 'ani jawaf?', 'feri bhana ta, kati?', 'kati bhannubhayo?',
           'bujhina, kati?', 'kati ho bhaneko?']
ASK_ANY = ['feri bhana ta.', 'k bhannubhayo?', 'bujhina, feri bhannus na.', 'ek choti feri bhana.', 'k bhaneko?']
SURE = ['pakka ho?', 'sachchai?', 'thik ho ni?', 'pakka thik ho?']
NUM_REPLY = ['jawaf {g} ho.', 'maile bhaneko jawaf {g} ho.', '{g} ho.', 'feri bhanda: jawaf {g} ho.']
SURE_REPLY = ['ho, pakka. jawaf {g} nai ho.', 'ho, {g} nai ho.', 'ho, maile jaach gare: jawaf {g} ho.']

# operations on the previous answer: (follow-up templates, sign, english templates)
OPS = {
    '+': (['ani tyasma {n} jodda?', 'tyasma {n} thapda kati?', 'ani {n} jodyo bhane?', 'aba {n} thap ta.',
           'tyo jawaf ma {n} jod ta.'], ['and plus {n}?', 'now add {n}.', 'what if we add {n}?']),
    '-': (['ani tyasbata {n} ghatauda?', 'ani {n} ghatayo bhane?', 'tyasma bata {n} jhikda kati?',
           'aba {n} ghata ta.'], ['and minus {n}?', 'now take away {n}.']),
    'x': (['ani {n} le gunda?', 'tyo lai {n} le gunda kati?', 'ani {n} guna garda?', 'aba {n} le gun ta.'],
          ['and times {n}?', 'now multiply that by {n}.']),
    '/': (['ani {n} le bhag garda?', 'tyo lai {n} le bhag gara.', 'ani {n} jana ma barabar baadda?'],
          ['and divided by {n}?', 'now divide that by {n}.']),
}
HALF_DOUBLE = [('yasko dobbar kati?', 'x', 2), ('tyasko dui guna?', 'x', 2), ('yasko aadha kati?', '/', 2),
               ('tyasko tin guna kati?', 'x', 3)]
OP_THINK = ['aghi ko jawaf {g} ho. {g} {op} {n} = {r}.', 'pahile ko uttar {g} thiyo. aba {g} {op} {n} = {r}.',
            'maile aghi {g} bhaneko thiye. {g} {op} {n} = {r}.']
OP_REPLY = ['{g} {op} {n} = {r} hunchha.', 'aba jawaf {r} ho.', 'uttar: {r}.', '{r} hunchha.']
EN_THINK = 'the previous answer was {g}. {g} {op} {n} = {r}.'
EN_REPLY = ['{g} {op} {n} = {r}.', 'that gives {r}.', 'the answer is {r}.']
EN_SURE = ['are you sure?', 'really?', 'is that right?', 'say it again?', 'what was the answer?']
EN_SURE_REPLY = ['yes, the answer is {g}.', 'yes, {a} {op} {b} = {g}.', 'yes, I checked: {a} {op} {b} = {g}.']


def _int(g):
    try:
        v = int(str(g))
    except ValueError:
        return None
    return v if str(v) == str(g) else None


def _apply(g, op, n):
    if op == '+':
        return g + n
    if op == '-':
        return g - n
    if op == 'x':
        return g * n
    return g // n if n and g % n == 0 else None


def op_row(R, prev, g):
    """Arithmetic on the previous integer answer g; None if no clean operation exists."""
    for _ in range(10):
        if R.random() < 0.2:
            q, op, n = R.choice(HALF_DOUBLE)
        else:
            op = R.choice('+-x/')
            n = R.randint(2, 9) if op in 'x/' else R.choice([R.randint(1, 20), R.randint(10, 500)])
            q = R.choice(OPS[op][0]).format(n=n)
        r = _apply(g, op, n)
        if r is None or r < 0 or len(str(r)) > 9:
            continue
        f = dict(g=g, op=op, n=n, r=r)
        return {'cat': 'followup-op', 'gold': str(r), 'messages': prev + [
            {'role': 'user', 'content': q},
            {'role': 'nik', 'content': R.choice(OP_REPLY).format(**f), 'think': R.choice(OP_THINK).format(**f)}]}
    return None


def en_row(R):
    """English arithmetic exchange, then a follow-up: sure / repeat (restate) or an operation on the answer."""
    a, b = R.randint(2, 99), R.randint(2, 99)
    op = R.choice('+-x')
    if op == '-' and b > a:
        a, b = b, a
    g = _apply(a, op, b)
    q0 = R.choice(['what is {a} {op} {b}?', '{a} {op} {b} = ?', 'calculate {a} {op} {b}.', 'how much is {a} {op} {b}?'])
    prev = [{'role': 'user', 'content': q0.format(a=a, op=op, b=b)},
            {'role': 'nik', 'content': f'{a} {op} {b} = {g}.', 'train': False}]
    if R.random() < 0.5:
        return {'cat': 'followup-en', 'gold': str(g), 'messages': prev + [
            {'role': 'user', 'content': R.choice(EN_SURE)},
            {'role': 'nik', 'content': R.choice(EN_SURE_REPLY).format(a=a, op=op, b=b, g=g)}]}
    op2 = R.choice('+-x')
    n = R.randint(2, 9) if op2 == 'x' else R.randint(1, 50)
    r = _apply(g, op2, n)
    if r < 0:
        op2, r = '+', g + n
    f = dict(g=g, op=op2, n=n, r=r)
    q = R.choice(OPS[op2][1]).format(n=n)
    return {'cat': 'followup-en', 'gold': str(r), 'messages': prev + [
        {'role': 'user', 'content': q},
        {'role': 'nik', 'content': R.choice(EN_REPLY).format(**f), 'think': EN_THINK.format(**f)}]}


def sample(R):
    import build
    if R.random() < 0.15:
        return en_row(R)
    while True:
        r = build.one(R)
        m = r['messages']
        if len(m) < 2 or m[0]['role'] != 'user' or m[1]['role'] != 'nik':
            continue
        # the earlier turn is context, written as /chat sends history (no think): never a lesson ("train": false), or
        # every row teaches "arithmetic question -> bare answer" (k4: nested -10, think skipped)
        prev = [{'role': 'user', 'content': m[0]['content']}, {'role': 'nik', 'content': m[1]['content'], 'train': False}]
        g = r.get('gold')
        gi = _int(g) if g is not None and str(g) in m[1]['content'] else None
        if gi is not None and gi >= 0 and R.random() < 0.45:
            row = op_row(R, prev, gi)
            if row:
                return row
        if g is not None and str(g) in m[1]['content'] and len(str(g)) <= 12:
            if not _isnum(g):                       # yes/no or word answers: "kati?" makes no sense, repeat instead
                q, a = R.choice(ASK_ANY), m[1]['content']
            elif R.random() < 0.3:
                q, a = R.choice(SURE), R.choice(SURE_REPLY).format(g=g)
            else:
                q, a = R.choice(ASK_NUM), R.choice(NUM_REPLY).format(g=g)
            return {'cat': 'followup-num', 'gold': str(g), 'messages': prev + [{'role': 'user', 'content': q},
                                                                              {'role': 'nik', 'content': a}]}
        if len(m[1]['content']) < 300:
            return {'cat': 'followup-repeat', 'gold': None,
                    'messages': prev + [{'role': 'user', 'content': R.choice(ASK_ANY)}, {'role': 'nik', 'content': m[1]['content']}]}


def _isnum(g):
    try:
        float(str(g))
        return True
    except ValueError:
        return False
