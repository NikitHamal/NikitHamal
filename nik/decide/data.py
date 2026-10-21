"""Nik-Decide training data: every task is multiple choice over <= 8 options with an exact label, built from the
audited teacher generators (no hand-labelled or external data). Row: {task, context, question, options, label}."""
import random, re, sys, os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'teacher'))
import chat, colmath, compose, correct, frame, lexicon as L, names, read, skills  # noqa: E402
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reading_wide  # noqa: E402

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
    # put the claimed value into the options, so the option span can be matched against the passage (as in lookup);
    # with value-free options (ho/haina) both v1 and v2 stayed at chance although the rows are 99.4% answerable
    import re as _re
    m = _re.search(r'ke \w+ (.+?)(?: ma baschha| ma baschhin| lai man parchha| gayo| gain| ho)\?$', q) or _re.search(r'ke \w+ (?:lai )?(.+?)\?$', q)
    v = m.group(1) if m else ''
    opts = [f'ho, {v}', f'haina, {v} haina', 'thaha chhaina'] if v else YNU
    return dict(task='read-yesno', context=c, question=q, options=opts, label=0 if e['gold'] == 'ho' else 1)


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


EQ = re.compile(r'(\d+) ([-+x/]) (\d+) = (\d+)')
OPS = {'+': lambda a, b: a + b, '-': lambda a, b: a - b, 'x': lambda a, b: a * b, '/': lambda a, b: a // b if b else 0}


def step(R):
    """Which line is a valid step for THIS question? The live model writes chain-shaped lines with invented operands
    (ladder L2 0/12); this is the per-step check a verifier / step reward needs. Distractors: an operand that is not
    in the question, the wrong operator, or the wrong result."""
    e = compose.sample(R)
    eqs = EQ.findall(e['think'])
    if not eqs:
        return step(R)
    a, op, b, c = R.choice(eqs)
    qnums = set(re.findall(r'\d+', e['q'])) | {x for t in eqs for x in (t[0], t[2], t[3])}
    good = f'{a} {op} {b} = {c}'
    bad = set()
    for _ in range(60):
        if len(bad) >= R.randint(3, 5):
            break
        k = R.random()
        if k < 0.4:                                           # invented operand, computed correctly
            x = str(int(a) + R.choice([-11, -2, -1, 1, 2, 10, 20]) * R.randint(1, 3))
            if x in qnums or int(x) < 0:
                continue
            cand = f'{x} {op} {b} = {OPS[op](int(x), int(b))}'
        elif k < 0.65:                                        # wrong operator, computed correctly
            o2 = R.choice([o for o in OPS if o != op])
            cand = f'{a} {o2} {b} = {OPS[o2](int(a), int(b))}'
        else:                                                 # right operands, wrong result
            cand = f'{a} {op} {b} = {int(c) + R.choice([-10, -2, -1, 1, 2, 10, 100])}'
        if cand != good:
            bad.add(cand)
    opts = list(bad) + [good]; R.shuffle(opts)
    return dict(task='math-step', context=e['q'], question='yo prashna ko sahi hisab ko line kun ho?', options=opts, label=opts.index(good))


def word(R):
    """Pick the final answer of a word problem. Hard negatives are the problem's own numbers and its intermediate
    results: copying an operand or stopping one step early is exactly how Nik gets word problems wrong."""
    e = frame.sample(R)
    q, gold = e['messages'][0]['content'], str(e['gold'])
    think = e['messages'][-1].get('think', '')
    inter = [c for _, _, _, c in EQ.findall(think) if c != gold]
    nums = [x for x in re.findall(r'\d+', q) if x != gold]
    pool = list(dict.fromkeys(inter + R.sample(nums, min(len(nums), 3))))
    g = int(gold)
    for d in (1, 10, 100, -1, -10):
        if len(pool) >= 6:
            break
        if g + d >= 0 and str(g + d) != gold:
            pool.append(str(g + d))
    opts = list(dict.fromkeys(pool[:R.randint(3, 6)])) + [gold]
    R.shuffle(opts)
    return dict(task='math-word', context=q, question='yo prashna ko antim uttar kun ho?', options=opts, label=opts.index(gold))


VALUES = sorted({v for v in L.PLACES + L.FOODS + L.JOBS + L.HOBBIES}, key=len, reverse=True)


def memory(R):
    """Latest value wins: after a correction, the old value is the trap."""
    for _ in range(20):
        e = correct.sample(R)
        if e['cat'] not in ('understand-correct-fix', 'understand-correct-now'):
            continue
        gold, msgs = e['gold'], e['messages'][:-1]
        new = next((v for v in VALUES if v in gold), None)
        if not new:
            continue
        said = ' '.join(m['content'] for m in msgs if m['role'] == 'user')
        olds = [v for v in VALUES if v in said and v != new and v not in new and new not in v][:3]
        if not olds:
            continue
        opts = [gold] + [gold.replace(new, o) for o in olds] + ['thaha chhaina']
        R.shuffle(opts)
        ctx = ' '.join(('user: ' if m['role'] == 'user' else 'nik: ') + m['content'] for m in msgs[:-1])
        return dict(task='memory-latest', context=ctx, question=msgs[-1]['content'], options=opts, label=opts.index(gold))
    return memory(R)


_POLICY = []


def nik_pick(R):
    """Pick the right answer among Nik's own sampled answers (rows from policy_data.py, NIK_POLICY_ROWS=path)."""
    if not _POLICY:
        import json
        _POLICY.extend(json.loads(l) for l in open(os.environ['NIK_POLICY_ROWS']))
    r = dict(R.choice(_POLICY)); o = list(r['options']); g = o[r['label']]; R.shuffle(o)
    return dict(task='nik-pick', context=r['context'], question=r['question'], options=o, label=o.index(g))


TASKS = [(yes_no, .1), (unknown, .05), (lookup, .12), (arith, .11), (step, .09), (word, .08), (memory, .06), (reading_wide.sample, .24), (intent, .15)]


if os.environ.get('NIK_POLICY_ROWS'):
    TASKS = [(f, w * 0.85) for f, w in TASKS] + [(nik_pick, .15)]


def sample(R):
    x, acc = R.random(), 0.0
    for f, w in TASKS:
        acc += w
        if x < acc:
            return f(R)
    return intent(R)
