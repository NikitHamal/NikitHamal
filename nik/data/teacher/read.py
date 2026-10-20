"""Reading comprehension over random small worlds (the skill NikBench/probes show Nik lacks: *reading* the input).

A world = 2-4 people with random facts (job, home, age, things bought, food, hobby, where they went, a pet), drawn
from large lexicons. It is rendered with varied sentence shapes and distractor sentences; questions are varied too.
The answer's think first QUOTES the sentence that holds the answer ("passage ma: ..."), then computes if needed:
retrieve-then-answer, so the model learns to look back at the input instead of reciting a stored reply.
Also: yes/no with correction, "not mentioned" (honest), comparisons/arithmetic across people, multi-turn memory
(passage in turn 1, questions later, corrections), and an English variant.
Each generator returns dict(messages, gold, kind).
"""
import random

import lexicon as L

M, F = 'm', 'f'


def _past(g, m_form, f_form):
    return m_form if g == M else f_form


def make_world(R, n=None):
    n = n or R.randint(2, 4)
    people, used = [], set()
    for _ in range(n):
        g = R.choice([M, F])
        pool = L.NAMES_M if g == M else L.NAMES_F
        name = R.choice([x for x in pool if x not in used]); used.add(name)
        thing, unit = R.choice(L.THINGS)
        p = dict(name=name, g=g, job=R.choice(L.JOBS), home=R.choice(L.PLACES), age=R.randint(6, 75),
                 thing=thing, unit=unit, count=R.randint(2, 15), food=R.choice(L.FOODS), hobby=R.choice(L.HOBBIES),
                 venue=R.choice(L.VENUES), time=R.choice(L.TIMES), day=R.choice(L.DAYS),
                 pet=R.choice(L.ANIMALS), pet_name=R.choice(L.PET_NAMES))
        people.append(p)
    # make shared attributes differ where questions need uniqueness
    for key, pool in (('job', L.JOBS), ('home', L.PLACES), ('food', L.FOODS), ('hobby', L.HOBBIES), ('venue', L.VENUES)):
        vals = R.sample(pool, n)
        for p, v in zip(people, vals):
            p[key] = v
    ages = R.sample(range(6, 76), n)
    for p, v in zip(people, ages):
        p['age'] = v
    return people


# ---------------------------------------------------------------- rendering facts (several surface forms each)
def say(R, p, fact):
    n, g = p['name'], p['g']
    if fact == 'job':
        return R.choice([f"{n} {p['job']} ho", f"{n} pesa le {p['job']} ho", f"{n} ko kaam {p['job']} ko ho",
                         f"{n} {p['job']} ko kaam garchh{'a' if g == M else 'in'}"])
    if fact == 'home':
        return R.choice([f"{n} {p['home']} ma baschh{'a' if g == M else 'in'}", f"{n} ko ghar {p['home']} ma chha",
                         f"{n} {p['home']} ko ho", f"{n} {p['home']} bata ho"])
    if fact == 'age':
        return R.choice([f"{n} {p['age']} barsha ko ho" if g == M else f"{n} {p['age']} barsha ki ho",
                         f"{n} ko umer {p['age']} barsha ho", f"{n} ahile {p['age']} barsha {'pugyo' if g == M else 'pugin'}"])
    if fact == 'thing':
        v = _past(g, 'kinyo', 'kinin')
        return R.choice([f"{n} le {p['count']} {p['unit']} {p['thing']} {v}", f"{n} le bazaar bata {p['count']} {p['unit']} {p['thing']} {v}",
                         f"{n} sanga {p['count']} {p['unit']} {p['thing']} chha"])
    if fact == 'food':
        return R.choice([f"{n} lai {p['food']} man parchha", f"{n} ko man parne khana {p['food']} ho",
                         f"{n} lai sabai bhanda {p['food']} mitho lagchha"])
    if fact == 'hobby':
        return R.choice([f"{n} lai {p['hobby']} man parchha", f"{n} ko ruchi {p['hobby']} ho", f"{n} ko shokh {p['hobby']} ho"])
    if fact == 'venue':
        v = _past(g, 'gayo', 'gain')
        return R.choice([f"{p['day']} {n} {p['time']} {p['venue']} {v}", f"{n} {p['day']} {p['venue']} {v}, {p['time']}",
                         f"{p['day']} {p['time']} {n} {p['venue']} tira {v}"])
    if fact == 'pet':
        return R.choice([f"{n} ko euta {p['pet']} chha, jasko naam {p['pet_name']} ho", f"{n} le {p['pet_name']} naam ko {p['pet']} paleko chha"])
    raise KeyError(fact)


DISTRACT = ['aaja mausam ramro thiyo', 'bato ma dherai bhid thiyo', 'tyo din bijuli gayeko thiyo', 'sabai jana khusi thiye',
            'bazaar ma naya pasal khuleko thiyo', 'beluka halka pani paryo', 'gaun ma mela lageko thiyo', 'school ma chhutti thiyo',
            'chiya pasal ma radio bajirahethyo', 'aakash ma badal thiyo', 'bus dhilo aayo', 'himal saphha dekhinthyo']

FACTS = ['job', 'home', 'age', 'thing', 'food', 'hobby', 'venue', 'pet']


def render(R, people, facts):
    sents = [say(R, p, f) for p, f in facts]
    if R.random() < 0.5:
        sents.insert(R.randint(0, len(sents)), R.choice(DISTRACT))
    return '. '.join(sents) + '.', sents


# ---------------------------------------------------------------- questions
def ask(R, p, fact):
    n = p['name']
    Q = {
        'job': [f"{n} k kaam garchha?", f"{n} ko pesa k ho?", f"{n} k ho, kaam ko hisab le?", f"{n} ko kaam?"],
        'home': [f"{n} kaha baschha?", f"{n} ko ghar kaha chha?", f"{n} kun thau ko ho?", f"{n} kata bata ho?"],
        'age': [f"{n} kati barsha ko ho?", f"{n} ko umer kati?", f"{n} kati barsha ko bhayo?"],
        'thing': [f"{n} sanga kati {p['unit']} {p['thing']} chha?", f"{n} le kati {p['thing']} liyo?", f"{p['thing']} kati {p['unit']} thiyo {n} ko?"],
        'food': [f"{n} lai kun khana man parchha?", f"{n} ko favourite khana k ho?", f"{n} lai k khana man parchha?"],
        'hobby': [f"{n} ko ruchi k ho?", f"{n} lai k garna man parchha?", f"{n} ko hobby k ho?"],
        'venue': [f"{n} kaha gayo?", f"{n} kata gaeko thiyo?", f"{n} kati baje gayo?", f"{n} kun bar gayo?"],
        'pet': [f"{n} ko {p['pet']} ko naam k ho?", f"{n} le kun janawar paleko chha?"],
    }[fact]
    q = R.choice(Q)
    f_ = p['g'] == F
    went, lives = ('gain', 'baschhin') if f_ else ('gayo', 'baschha')
    if fact == 'job':
        return q, f"{n} {p['job']} ho.", p['job']
    if fact == 'home':
        return q, f"{n} {p['home']} ma {lives}." if 'baschha' in q else f"{n} {p['home']} ko ho.", p['home']
    if fact == 'age':
        return q, f"{n} {p['age']} barsha {'ko' if p['g'] == M else 'ki'} ho.", str(p['age'])
    if fact == 'thing':
        return q, f"{n} sanga {p['count']} {p['unit']} {p['thing']} chha.", str(p['count'])
    if fact == 'food':
        return q, f"{n} lai {p['food']} man parchha.", p['food']
    if fact == 'hobby':
        return q, f"{n} lai {p['hobby']} man parchha.", p['hobby']
    if fact == 'venue':
        if 'kati baje' in q:
            return q, f"{n} {p['time']} {went}.", p['time'].split()[1]
        if 'kun bar' in q:
            return q, f"{n} {p['day']} {went}.", p['day']
        return q, f"{n} {p['venue']} {went}.", p['venue']
    if fact == 'pet':
        if 'kun janawar' in q:
            return q, f"{n} le {p['pet']} paleko chha, naam {p['pet_name']}.", p['pet']
        return q, f"{n} ko {p['pet']} ko naam {p['pet_name']} ho.", p['pet_name']


def quote(sent):
    return f'passage ma: "{sent}".'


FRAMES = ['"{P}" {Q}', 'yo padha: "{P}" {Q}', '{P}\n{Q}', 'passage: "{P}"\nprashna: {Q}', '"{P}"\n\n{Q}',
          'yo kura padhera bhana: "{P}" {Q}', '{P} aba bhana, {Q}', 'kahani: {P} {Q}']


def lookup(R):
    people = make_world(R)
    facts = [(p, f) for p in people for f in R.sample(FACTS, R.randint(1, 3))]
    R.shuffle(facts)
    facts = facts[:R.randint(2, 6)]
    P, sents = render(R, people, facts)
    p, f = R.choice(facts)
    # find the sentence that holds the fact (it mentions the name and the value)
    val_key = {'job': 'job', 'home': 'home', 'age': 'age', 'thing': 'thing', 'food': 'food', 'hobby': 'hobby', 'venue': 'venue', 'pet': 'pet_name'}[f]
    sent = next(s for s in sents if p['name'] in s.split() and str(p[val_key]) in s)
    q, a, gold = ask(R, p, f)
    return {'kind': 'read-lookup', 'gold': gold,
            'messages': [{'role': 'user', 'content': R.choice(FRAMES).format(P=P, Q=q)}, {'role': 'nik', 'content': a, 'think': quote(sent)}]}


def not_mentioned(R):
    people = make_world(R, R.randint(1, 3))
    facts = [(p, f) for p in people for f in R.sample(FACTS, 2)]
    P, sents = render(R, people, facts)
    p = R.choice(people)
    stated = {f for q, f in facts if q is p}
    missing = [f for f in ('job', 'home', 'age', 'food', 'hobby') if f not in stated]
    f = R.choice(missing)
    q, _, _ = ask(R, p, f)
    what = {'job': 'kaam', 'home': 'thau', 'age': 'umer', 'food': 'man parne khana', 'hobby': 'ruchi'}[f]
    a = R.choice([f"passage ma {p['name']} ko {what} bhaneko chhaina, tyasaile ma bhanna sakdina.",
                  f"yo kura diyeko chhaina: {p['name']} ko {what} passage ma lekhieko chhaina.",
                  f"malai thaha chhaina. passage ma {p['name']} ko {what} ko barema kehi chhaina."])
    return {'kind': 'read-unknown', 'gold': 'chhaina',
            'messages': [{'role': 'user', 'content': R.choice(FRAMES).format(P=P, Q=q)},
                         {'role': 'nik', 'content': a, 'think': f"passage ma {p['name']} ko {what} khojchhu. kunai vakya ma chhaina."}]}


def yes_no(R):
    people = make_world(R, R.randint(2, 3))
    p = R.choice(people)
    f = R.choice(['job', 'home', 'food', 'venue'])
    facts = [(q, R.choice(FACTS)) for q in people if q is not p] + [(p, f)]
    R.shuffle(facts)
    P, sents = render(R, people, facts)
    sent = next(s for s in sents if p['name'] in s.split() and str(p[f]) in s)
    truth = R.random() < 0.5
    pool = {'job': L.JOBS, 'home': L.PLACES, 'food': L.FOODS, 'venue': L.VENUES}[f]
    val = p[f] if truth else R.choice([x for x in pool if x != p[f]])
    n = p['name']
    went, lives = ('gain', 'baschhin') if p['g'] == F else ('gayo', 'baschha')
    q = {'job': f"ke {n} {val} ho?", 'home': f"ke {n} {val} ma baschha?", 'food': f"ke {n} lai {val} man parchha?",
         'venue': f"ke {n} {val} gayo?"}[f]
    if truth:
        a = 'ho, ' + {'job': f"{n} {val} ho.", 'home': f"{n} {val} ma {lives}.", 'food': f"{n} lai {val} man parchha.",
                      'venue': f"{n} {val} {went}."}[f]
    else:
        a = 'haina, ' + {'job': f"{n} {val} haina, {p[f]} ho.", 'home': f"{n} {val} ma haina, {p[f]} ma {lives}.",
                         'food': f"{n} lai {p[f]} man parchha, {val} haina.", 'venue': f"{n} {val} haina, {p[f]} {went}."}[f]
    return {'kind': 'read-yesno', 'gold': 'ho' if truth else 'haina',
            'messages': [{'role': 'user', 'content': R.choice(FRAMES).format(P=P, Q=q)}, {'role': 'nik', 'content': a, 'think': quote(sent)}]}


def compare(R):
    people = make_world(R, R.randint(2, 3))
    kind = R.choice(['age', 'thing'])
    if kind == 'thing':
        thing, unit = R.choice(L.THINGS)
        for p in people:
            p['thing'], p['unit'] = thing, unit
        cs = R.sample(range(2, 30), len(people))
        for p, c in zip(people, cs):
            p['count'] = c
    facts = [(p, kind) for p in people]
    R.shuffle(facts)
    P, sents = render(R, people, facts)
    a_, b_ = R.sample(people, 2)
    key = 'age' if kind == 'age' else 'count'
    sa = next(s for s in sents if a_['name'] in s.split()); sb = next(s for s in sents if b_['name'] in s.split())
    hi, lo = (a_, b_) if a_[key] > b_[key] else (b_, a_)
    d = hi[key] - lo[key]
    op = R.choice(['who', 'diff', 'sum']) if kind == 'thing' else R.choice(['who', 'diff'])
    if kind == 'age':
        q = {'who': f"{a_['name']} ra {b_['name']} madhye ko jetho?", 'diff': f"{a_['name']} ra {b_['name']} ko umer ma kati farak chha?"}[op]
        if op == 'who':
            ans, gold, calc = f"{hi['name']} jetho ho, {d} barsha le.", hi['name'], f"{hi[key]} > {lo[key]}."
        else:
            ans, gold, calc = f"umer ma {d} barsha farak chha.", str(d), f"{hi[key]} - {lo[key]} = {d}."
    else:
        t = f"{a_['thing']}"
        q = {'who': f"{a_['name']} ra {b_['name']} madhye kasko {t} badhi chha?", 'diff': f"{hi['name']} sanga {lo['name']} bhanda kati {t} badhi chha?",
             'sum': f"{a_['name']} ra {b_['name']} ko jamma kati {t} chha?"}[op]
        if op == 'who':
            ans, gold, calc = f"{hi['name']} ko badhi chha, {d} {hi['unit']} le.", hi['name'], f"{hi[key]} > {lo[key]}. {hi[key]} - {lo[key]} = {d}."
        elif op == 'diff':
            ans, gold, calc = f"{hi['name']} sanga {d} {hi['unit']} badhi chha.", str(d), f"{hi[key]} - {lo[key]} = {d}."
        else:
            s = a_[key] + b_[key]
            ans, gold, calc = f"jamma {s} {a_['unit']} {t} chha.", str(s), f"{a_[key]} + {b_[key]} = {s}."
    return {'kind': 'read-compare', 'gold': gold,
            'messages': [{'role': 'user', 'content': R.choice(FRAMES).format(P=P, Q=q)},
                         {'role': 'nik', 'content': ans, 'think': f'passage ma: "{sa}" ra "{sb}". {calc}'}]}


ACK = ['hunchha, yaad rakhe.', 'thik chha, bujhe.', 'ok, maile yaad gare.', 'bujhe! aru k?', 'hunchha.']


def memory(R):
    """facts given in turn 1 (or across turns, with a correction), questions later."""
    people = make_world(R, R.randint(1, 3))
    facts = [(p, f) for p in people for f in R.sample(FACTS, R.randint(1, 2))]
    R.shuffle(facts)
    P, sents = render(R, people, facts)
    msgs = [{'role': 'user', 'content': R.choice(['yo yaad rakha: ', 'suna: ', 'ma kehi bhanchhu, yaad gara: ', '']) + P},
            {'role': 'nik', 'content': R.choice(ACK)}]
    corrected = None
    if R.random() < 0.35:                                  # correction turn
        p, f = R.choice([x for x in facts if x[1] in ('home', 'job', 'age')] or facts[:1])
        if f in ('home', 'job', 'age'):
            old = p[f]
            p[f] = (R.choice([x for x in L.PLACES if x != old]) if f == 'home' else R.choice([x for x in L.JOBS if x != old]) if f == 'job'
                    else R.choice([x for x in range(6, 76) if x != old]))
            fix = say(R, p, f)
            msgs += [{'role': 'user', 'content': R.choice(['haina, galti bhayo: ', 'sachyaunu: ', 'oh sorry, ']) + fix + '.'},
                     {'role': 'nik', 'content': R.choice(['thik chha, sachyaeko.', 'bujhe, aba yahi yaad rakhchhu.', 'hunchha, update gare.'])}]
            corrected = (p, f, fix)
    asked = set()
    for i in range(R.randint(1, 2)):
        p, f = R.choice(facts)
        if corrected and i == 0 and R.random() < 0.7:
            p, f = corrected[0], corrected[1]
        if (p['name'], f) in asked:
            continue
        asked.add((p['name'], f))
        q, a, gold = ask(R, p, f)
        val_key = 'pet_name' if f == 'pet' else f
        src = corrected[2] if corrected and corrected[0] is p and corrected[1] == f else next(
            s for s in sents if p['name'] in s.split() and str(p[val_key]) in s)
        msgs += [{'role': 'user', 'content': q}, {'role': 'nik', 'content': a,
                  'think': (f'sachyaeko kura: "{src}".' if corrected and src == corrected[2] else f'pahile bhaneko: "{src}".')}]
    return {'kind': 'read-memory', 'gold': gold, 'messages': msgs}


def english(R):
    people = make_world(R, R.randint(2, 3))
    for p in people:
        p['job'] = R.choice([j for j in L.JOBS_EN])
    jobs = R.sample(list(L.JOBS_EN), len(people))
    for p, j in zip(people, jobs):
        p['job'] = j
    S = []
    for p in people:
        he = 'He' if p['g'] == M else 'She'
        S.append(R.choice([f"{p['name'].title()} is a {L.JOBS_EN[p['job']]} in {p['home'].title()}",
                           f"{p['name'].title()} lives in {p['home'].title()} and works as a {L.JOBS_EN[p['job']]}"]))
        S.append(f"{he} has {p['count']} {'pets' if False else 'books' if p['thing'] == 'kitab' else 'apples'}")
        p['en_thing'] = 'books' if p['thing'] == 'kitab' else 'apples'
    P = '. '.join(S) + '.'
    p = R.choice(people)
    k = R.choice(['job', 'home', 'count'])
    N = p['name'].title()
    if k == 'job':
        q, a, gold = f"What does {N} do?", f"{N} is a {L.JOBS_EN[p['job']]}.", L.JOBS_EN[p['job']]
    elif k == 'home':
        q, a, gold = f"Where does {N} live?", f"{N} lives in {p['home'].title()}.", p['home']
    else:
        q, a, gold = f"How many {p['en_thing']} does {N} have?", f"{N} has {p['count']} {p['en_thing']}.", str(p['count'])
    sent = next(s for s in S if N in s and (k != 'count' or str(p['count']) in s)) if k != 'count' else S[S.index(next(s for s in S if N in s)) + 1]
    return {'kind': 'read-english', 'gold': gold,
            'messages': [{'role': 'user', 'content': R.choice(['"{P}" {Q}', 'Read: "{P}"\n{Q}', '{P}\n{Q}']).format(P=P, Q=q)},
                         {'role': 'nik', 'content': a, 'think': f'the passage says: "{sent}".'}]}


GENS = [(lookup, 0.36), (yes_no, 0.16), (not_mentioned, 0.1), (compare, 0.14), (memory, 0.18), (english, 0.06)]


def sample(R):
    x, acc = R.random(), 0.0
    for g, w in GENS:
        acc += w
        if x < acc:
            return g(R)
    return lookup(R)


if __name__ == '__main__':
    import json, sys
    R = random.Random(int(sys.argv[1]) if len(sys.argv) > 1 else 0)
    for _ in range(int(sys.argv[2]) if len(sys.argv) > 2 else 8):
        print(json.dumps(sample(R), ensure_ascii=False))
