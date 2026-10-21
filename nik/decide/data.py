"""Nik-Decide training data: every task is multiple choice over <= 8 options with an exact label, built from the
audited teacher generators (no hand-labelled or external data). Row: {task, context, question, options, label}."""
import random, re, sys, os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'teacher'))
import chat, colmath, compose, lexicon as L, names, read, skills  # noqa: E402

YNU = ['ho', 'haina', 'thaha chhaina']
INTENTS = ['kura (chat)', 'hisab (math)', 'padhera jawaf (reading)', 'nik/nikit barema (persona)', 'anuvad/grammar (language)', 'lekhai (writing)']
PERSONA_Q = ['timi ko hau?', 'timi lai kasle banako?', 'nikit ko ho?', 'nikit hamal ko barema bhana', 'nikit le k k banaunu bhayo?',
             'timi kati thulo model hau?', 'nik bhaneko k ho?', 'tapai lai kasle train garyo?', 'nikit kaha ko ho?', 'timi chatgpt hau?']


def _user(e):
    return ' '.join(m['content'] for m in e['messages'] if m['role'] == 'user')


def _split(text):
    """passage -> context, final question -> question (NLI-style: the claim gets its own segment)."""
    import re as _re
    m = _re.search(r'([^.\n"]*\?)\s*$', text)
    if not m:
        return '', text
    return text[:m.start()].strip(), m.group(1).strip()


def yes_no(R):
    e = read.yes_no(R)
    c, q = _split(_user(e))
    return dict(task='read-yesno', context=c, question=q, options=YNU, label=0 if e['gold'] == 'ho' else 1)


def unknown(R):
    e = read.not_mentioned(R)
    c, q = _split(_user(e))
    return dict(task='read-unknown', context=c, question=q, options=YNU, label=2)


def lookup(R):
    e = read.lookup(R)
    gold = e['gold']
    pool = [x for x in (L.JOBS + L.PLACES + L.FOODS + L.HOBBIES + L.VENUES + L.PET_NAMES + [str(i) for i in range(2, 40)]) if x != gold]
    full = _user(e)
    near = [x for x in pool if x in full and x != gold]          # distractors that also appear in the passage (hard negatives)
    opts = list(dict.fromkeys(near[:3] + R.sample(pool, 6)))[:R.randint(3, 6)] + [gold]
    R.shuffle(opts)
    c, q = _split(full)
    return dict(task='read-lookup', context=c, question=q, options=opts, label=opts.index(gold))


def arith(R):
    e = colmath.sample(R) if R.random() < 0.6 else compose.sample(R)
    try:
        g = int(str(e['gold']).replace(',', ''))
    except ValueError:
        return arith(R)
    cands, want = {g}, R.randint(4, 6)
    for _ in range(100):                      # near-miss distractors (answers can be negative)
        if len(cands) >= want:
            break
        k = R.random()
        c = g + R.choice([-1, 1]) * R.choice([1, 2, 9, 10, 11, 100]) if k < 0.6 else int(str(g)[::-1]) if k < 0.75 and g > 9 else g + R.randint(-20, 20)
        if c != g:
            cands.add(c)
    opts = [str(c) for c in cands]; R.shuffle(opts)
    return dict(task='math-verify', context='', question=e['q'], options=opts, label=opts.index(str(g)))


def intent(R):
    k = R.random()
    if k < 0.22:
        e = chat.sample(R); lab = 0
    elif k < 0.34:
        e = names.sample(R); lab = 2 if e['cat'] == 'names-read' else 0   # "mero naam nikit ho" is chat, not persona
    elif k < 0.5:
        e = {'messages': [{'role': 'user', 'content': (colmath.sample(R) if R.random() < .5 else compose.sample(R))['q']}]}; lab = 1
    elif k < 0.64:
        e = read.sample(R); lab = 2
    elif k < 0.76:
        q = R.choice(PERSONA_Q)
        e = {'messages': [{'role': 'user', 'content': q}]}; lab = 3
    elif k < 0.9:
        e = skills.translate(R) if R.random() < .6 else skills.grammar(R); lab = 4
    else:
        import write as wgen
        e = wgen.sample(R); lab = 5
    q = e['messages'][0]['content']
    return dict(task='intent', context='', question=q, options=INTENTS, label=lab)


TASKS = [(yes_no, .18), (unknown, .1), (lookup, .22), (arith, .2), (intent, .3)]


def sample(R):
    x, acc = R.random(), 0.0
    for f, w in TASKS:
        acc += w
        if x < acc:
            return f(R)
    return intent(R)
