"""Read before you compute: questions whose answer is WRITTEN in the text, beside questions on the same facts that
need a calculation (Claude, 2026-10-22).

Why: the repaired-mix models (k5, k5b, k5c, k8) fail trap items that only ask for a stated number, where the p8mxe
family (r1, k4, s4) passes them: `... bazar bata 3 kilo syau lyaye. kati kilo syau lyaye?` -> "18 kilo" (4/4 models),
`... dubai 20 barsha ka hun. hari kati barsha ko ho?` -> no number or 40 (3/4). The no-think repair gave thinks to the
only-number format rows ("numbers in the question -> compute") and nothing teaches when NOT to compute. Each context
here gets ONE question: a lookup (the think quotes the sentence that holds the answer and says no calculation is
needed) or a calculation on the same facts (the think computes), so only the question tells them apart.
Also `A le B lai ... diyo` (who gave / who got, `bata` = from) and `X gayo tara Y gayena`: the two bench_reading pairs
every k5-family model lost. Sentences equal to a bench_reading context or a trap_check prompt are never emitted
(the eval-prompt guard in make_sft2 drops exact user turns as well).
"""
import os
import random
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lexicon as L  # noqa: E402

SPECIAL = ['nikit', 'nik', 'hamal', 'nikita', 'nikit hamal']
# no syau: trap_check asks `... bazar bata 3 kilo syau lyaye. kati kilo syau lyaye?` (kept a held-out test of the skill)
GOODS = [('aanp', 'kilo'), ('aalu', 'kilo'), ('chamal', 'kilo'), ('pyaj', 'kilo'), ('chini', 'kilo'), ('golbheda', 'kilo'),
         ('dudh', 'liter'), ('tel', 'liter'), ('kapi', 'wata'), ('kalam', 'wata'), ('anda', 'wata'), ('kera', 'wata'),
         ('suntala', 'wata'), ('kitab', 'wata'), ('ball', 'wata'), ('phool', 'wata')]
# (where from, plural verb, singular verb)
BRING = [('bazar bata', 'lyaye', 'lyayo'), ('pasal bata', 'kine', 'kinyo'), ('ghar bata', 'lyaye', 'lyayo'),
         ('mela bata', 'kine', 'kinyo')]
ACK = ['thik chha, bujhe.', 'hunchha, bujhe. k sodhna man chha?', 'ramro, sune.', 'thik chha.']
NO_CALC = ['yo sidhai lekheko chha, hisab garnu pardaina.', 'yo path mai chha, jodnu ya gunnu pardaina.',
           'jawaf lekhai ma chha, kunai hisab chahindaina.']


FEMALE = set(L.NAMES_F) | {'nikita'}


def _name(R, avoid=(), male=False):
    """male=True for sentences whose verb agrees with one subject (gayo / gai): only male names there."""
    while True:
        n = R.choice(SPECIAL) if R.random() < 0.3 else R.choice(L.NAMES_M if male else L.NAMES_M + L.NAMES_F)
        if n not in avoid and not (male and n in FEMALE):
            return n


def _held():
    """normalized bench_reading contexts + trap_check prompts (never emitted)."""
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
    norm = lambda t: ' '.join(t.lower().split()).strip(' ?!.')
    held = set()
    try:
        sys.path.insert(0, root)
        import bench_reading
        held |= {norm(p['ctx']) for p in bench_reading.PAIRS}
    except Exception:
        pass
    try:
        txt = open(os.path.join(root, 'trap_check.py')).read()
        held |= {norm(t) for t in re.findall(r"'([^']{8,})'", txt)}
    except Exception:
        pass
    return held, norm


HELD, NORM = _held()


def _row(cat, gold, ctx, q, think, ans, R):
    if NORM(ctx) in HELD or any(NORM(s) in HELD for s in re.split(r'(?<=[.?])\s+', ctx)):
        return None
    if R.random() < 0.3:      # story first, question in the next turn
        msgs = [{'role': 'user', 'content': ctx}, {'role': 'nik', 'content': R.choice(ACK)},
                {'role': 'user', 'content': q}, {'role': 'nik', 'content': ans, 'think': think}]
    else:
        msgs = [{'role': 'user', 'content': f'{ctx} {q}'}, {'role': 'nik', 'content': ans, 'think': think}]
    return {'cat': cat, 'gold': str(gold), 'messages': msgs}


def quantity(R):
    two = R.random() < 0.6
    a = _name(R, male=not two); b = _name(R, (a,))
    item, unit = R.choice(GOODS)
    frm, vpl, vsg = R.choice(BRING)
    n = R.randint(2, 12) if unit != 'wata' else R.randint(2, 30)
    who, verb = (f'{a} ra {b} le', vpl) if two else (f'{a} le', vsg)
    ctx = f'{who} {frm} {n} {unit} {item} {verb}.'
    if R.random() < 0.3:
        ctx = R.choice([f'aaja {R.randint(2, 28)} gate ho. ', f'ghar ma {R.randint(2, 9)} jana chhan. ']) + ctx
    k = R.random()
    if k < 0.55:              # lookup
        q = R.choice([f'kati {unit} {item} {verb}?', f'{who} kati {unit} {item} {verb}?', f'jamma kati {unit} {item} {verb}?'])
        think = f'prashna: kati {unit} {item} {verb}. path ma "{n} {unit} {item} {verb}" lekheko chha. {R.choice(NO_CALC)}'
        return _row('lookup-stated', n, ctx, q, think, R.choice([f'{n} {unit} {item} {verb}.', f'{n} {unit}.']), R)
    if k < 0.75 and two and n % 2 == 0:   # share equally between the two
        q = f'{a} ra {b} le barabar baadda ek jana le kati {unit} paunchha?'
        think = f'jamma {n} {unit}, 2 jana ma barabar: {n} / 2 = {n // 2}.'
        return _row('lookup-compute', n // 2, ctx, q, think, f'ek jana le {n // 2} {unit} paunchha.', R)
    if k < 0.9:               # add more
        m = R.randint(1, 9)
        q = R.choice([f'aru {m} {unit} thapda jamma kati hunchha?', f'pachhi {m} {unit} pheri {verb} bhane jamma kati?'])
        think = f'pahile {n} {unit}, thap {m} {unit}: {n} + {m} = {n + m}.'
        return _row('lookup-compute', n + m, ctx, q, think, f'jamma {n + m} {unit} hunchha.', R)
    m = R.randint(1, n - 1)   # used some
    q = f'tyasmadhye {m} {unit} sakiyo bhane kati baki chha?'
    think = f'{n} {unit} thiyo, {m} sakiyo: {n} - {m} = {n - m}.'
    return _row('lookup-compute', n - m, ctx, q, think, f'{n - m} {unit} baki chha.', R)


def both(R):
    # not hari / nikit: trap_check asks `nikit ra hari dubai 20 barsha ka hun. hari kati barsha ko ho?` (held out)
    a = _name(R, ('hari', 'nikit')); b = _name(R, (a, 'hari', 'nikit'))
    k = R.random()
    word = R.choice(['dubai', 'duwai', 'duijana nai'])
    if k < 0.45:
        age = R.randint(5, 60)
        ctx = f'{a} ra {b} {word} {age} barsha ka hun.'
        if R.random() < 0.7:
            x = R.choice([a, b])
            q = R.choice([f'{x} kati barsha ko ho?', f'{x} ko umer kati ho?'])
            think = f'"{word} {age} barsha ka hun" bhaneko {a} pani {age}, {b} pani {age} barsha. {R.choice(NO_CALC)}'
            return _row('lookup-both', age, ctx, q, think, f'{x} {age} barsha {"ki" if x in FEMALE else "ko"} ho.', R)
        q = 'duijana ko umer jodda kati hunchha?'
        think = f'pratyek {age} barsha. jodda: {age} + {age} = {2 * age}.'
        return _row('lookup-compute', 2 * age, ctx, q, think, f'duijana ko umer jodda {2 * age} barsha hunchha.', R)
    if k < 0.75:
        p = R.choice(L.PLACES)
        ctx = f'{a} ra {b} {word} {p} ma baschhan.'
        x = R.choice([a, b])
        think = f'"{word} {p} ma baschhan" bhaneko {x} pani {p} ma baschha.'
        v = 'baschhin' if x in FEMALE else 'baschha'
        think = f'"{word} {p} ma baschhan" bhaneko {x} pani {p} ma {v}.'
        return _row('lookup-both', p, ctx, R.choice([f'{x} kaha {v}?', f'{x} ko ghar kaha ho?']), think, f'{x} {p} ma {v}.', R)
    f = R.choice(L.FOODS)
    ctx = f'{a} ra {b} {word} lai {f} man parchha.'
    x = R.choice([a, b])
    think = f'"{word} lai {f} man parchha" bhaneko {x} lai pani {f} man parchha.'
    return _row('lookup-both', f, ctx, R.choice([f'{x} lai k man parchha?', f'{x} lai kun khana man parchha?']), think,
                f'{x} lai {f} man parchha.', R)


def give(R):
    a = _name(R, male=True); b = _name(R, (a,), male=True)
    item, unit = R.choice([g for g in GOODS if g[1] == 'wata'])
    n = R.randint(2, 15)
    form = R.random()
    if form < 0.5:
        ctx = f'{a} le {b} lai {n} wata {item} diyo.'
        rule = f'"{a} le {b} lai ... diyo": "le" lagne {a} dine ho, "lai" lagne {b} paune ho.'
    elif form < 0.75:
        ctx = f'{b} lai {a} le {n} wata {item} diyo.'
        rule = f'"{b} lai {a} le ... diyo": "le" lagne {a} dine ho, "lai" lagne {b} paune ho.'
    else:
        ctx = f'{b} le {a} bata {n} wata {item} payo.'
        rule = f'"{b} le {a} bata ... payo": "bata" lagne {a} dine ho, {b} paune ho.'
    k = R.random()
    if k < 0.35:
        return _row('lookup-give', a, ctx, R.choice([f'kasle {item} diyo?', f'{item} kasle diyo?']), rule,
                    f'{a} le {item} diyo.', R)
    if k < 0.7:
        return _row('lookup-give', b, ctx, R.choice([f'kasle {item} payo?', f'{item} kasle payo?', f'{item} kaslai diyo?']), rule,
                    f'{b} le {item} payo.', R)
    q = R.choice([f'{b} le kati wata {item} payo?', f'kati wata {item} diyo?'])
    think = rule + f' sankhya path mai chha: {n} wata. {R.choice(NO_CALC)}'
    return _row('lookup-stated', n, ctx, q, think, f'{n} wata {item}.', R)


def negation(R):
    a = _name(R, male=True)
    kind = R.random()
    if kind < 0.5:
        p1, p2 = R.sample(L.PLACES, 2)
        ctx = f'{a} {p1} gayo tara {p2} gayena.'
        rule = f'"{p1} gayo tara {p2} gayena": {a} {p1} gayo, {p2} gayena.'
        k = R.random()
        if k < 0.4:
            return _row('lookup-not', p1, ctx, R.choice([f'{a} kaha gayo?', f'{a} kun thau gayo?']), rule, f'{a} {p1} gayo.', R)
        if k < 0.8:
            return _row('lookup-not', 'haina', ctx, f'ke {a} {p2} gayo?', rule, f'haina, {a} {p2} gayena.', R)
        return _row('lookup-not', 'ho', ctx, f'ke {a} {p1} gayo?', rule, f'ho, {a} {p1} gayo.', R)
    f1, f2 = R.sample(L.FOODS, 2)
    ctx = f'{a} le {f1} khayo tara {f2} khayena.'
    rule = f'"{f1} khayo tara {f2} khayena": {a} le {f1} khayo, {f2} khayena.'
    k = R.random()
    if k < 0.4:
        return _row('lookup-not', f1, ctx, f'{a} le k khayo?', rule, f'{a} le {f1} khayo.', R)
    if k < 0.8:
        return _row('lookup-not', 'haina', ctx, f'ke {a} le {f2} khayo?', rule, f'haina, {a} le {f2} khayena.', R)
    return _row('lookup-not', 'ho', ctx, f'ke {a} le {f1} khayo?', rule, f'ho, {a} le {f1} khayo.', R)


GENS = [(quantity, 0.35), (both, 0.25), (give, 0.2), (negation, 0.2)]


def sample(R):
    while True:
        g = R.choices([g for g, _ in GENS], weights=[w for _, w in GENS])[0]
        r = g(R)
        if r is not None:
            return r


if __name__ == '__main__':
    import json
    R = random.Random(1)
    for _ in range(12):
        print(json.dumps(sample(R), ensure_ascii=False))
