"""Wide-surface reading rows for Nik-Decide: who did it, to whom, whose, not, before/after, how many after a
distractor, whose relative, who is older, totals, sequences. Many phrasings per relation, a large vocabulary, shuffled
filler sentences, and the passage's other entities as the hard negatives.

Held out by construction: every word in nik/bench_reading.py's passages is removed from the vocabulary
(tests/test_reading_wide.py checks it), so a gain on bench_reading is transfer, not memory.
"""
import os, random, re, sys

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)

NAMES_M = ['anil', 'bijay', 'chandan', 'deepak', 'ganesh', 'hari', 'ishwor', 'jagat', 'kamal', 'laxman', 'madan', 'nabin', 'om', 'prakash',
           'rabin', 'sagar', 'tilak', 'umesh', 'binod', 'dipesh', 'gopal', 'kiran', 'manoj', 'niraj', 'pawan', 'roshan', 'sanjay', 'tej',
           'yubraj', 'arjun', 'bishal', 'dhiraj', 'gaurav', 'hemant', 'jivan', 'kishor', 'mohan', 'narayan', 'pradip', 'rajendra',
           'santosh', 'suresh', 'ujjwal', 'bhim', 'dev', 'krishna', 'ramesh', 'shyam', 'bikash', 'saroj']
NAMES_F = ['anita', 'bimala', 'chandra', 'devi', 'gita', 'indira', 'januka', 'kabita', 'laxmi', 'mina', 'nirmala', 'pooja', 'radha',
           'sabina', 'tara', 'usha', 'bina', 'durga', 'goma', 'kamala', 'mamata', 'nisha', 'parbati', 'rita', 'sarita', 'sita', 'urmila',
           'asmita', 'bandana', 'dikshya', 'garima', 'jyoti', 'kalpana', 'menuka', 'puja', 'rachana', 'sabita', 'sujata', 'yamuna',
           'alina', 'binita', 'muna', 'prabha', 'reshma', 'samjhana', 'shanti', 'sunita', 'tulsi', 'nanda', 'hira']
OBJECTS = ['kitab', 'kalam', 'jhola', 'chasma', 'mobile', 'chhata', 'sisakalam', 'kapi', 'thal', 'gilas', 'chakku', 'tasbir', 'phul',
           'kambal', 'sirak', 'kurta', 'sari', 'tokari', 'baltin', 'saikal', 'ghanti', 'lalten', 'patrika', 'radio', 'battery', 'chabi',
           'pustak', 'rumal', 'mala', 'chura', 'dhaka topi', 'pankha', 'ghaito', 'kachaura', 'dabba', 'botal', 'kursi', 'mech']
FOODS = ['momo', 'dal bhat', 'chiura', 'aalu dum', 'sukuti', 'gundruk', 'kheer', 'chatamari', 'yomari', 'jeri', 'swari', 'malpuwa',
         'dhindo', 'thukpa', 'samosa', 'pakauda', 'laddu', 'barfi', 'achar', 'bara', 'chana', 'makai', 'bhatmas', 'aalu tama']
PLACES = ['pokhara', 'butwal', 'dharan', 'hetauda', 'biratnagar', 'birgunj', 'nepalgunj', 'dhangadhi', 'bhaktapur', 'lalitpur',
          'gorkha', 'ilam', 'jumla', 'palpa', 'bandipur', 'dang', 'surkhet', 'baglung', 'syangja', 'banepa', 'dhulikhel', 'itahari',
          'bharatpur', 'kirtipur', 'lumbini', 'mustang', 'taplejung', 'dolakha', 'rolpa', 'bardiya']
JOBS = ['shikshak', 'doctor', 'kisan', 'driver', 'nurse', 'engineer', 'pasal-e', 'police', 'pilot', 'lekhak', 'gayak', 'darji',
        'sikarmi', 'dakarmi', 'banker', 'wakil', 'patrakar', 'bhanse', 'chitrakar', 'khelaadi']
RELS = [('dai', 'm'), ('bhai', 'm'), ('didi', 'f'), ('bahini', 'f'), ('buwa', 'm'), ('aama', 'f'), ('mama', 'm'), ('kaki', 'f')]
FILLER = ['aaja bihana pani paryo.', 'bazaar ma dherai bhid thiyo.', 'tyo din shanibar thiyo.', 'gaun ma mela lageko thiyo.',
          'hawa chiso thiyo.', 'school bida thiyo.', 'baato ali hilo thiyo.', 'sabai khusi thiye.', 'bus dhilo aayo.',
          'ghar ma pahuna aaeka thiye.', 'beluka batti gayo.', 'aakash sapha thiyo.']


def _bench_words():
    try:
        sys.path.insert(0, ROOT)
        import bench_reading
        txt = ' '.join(p['ctx'] + ' ' + p['q1'] + ' ' + p['q2'] for p in bench_reading.PAIRS)
        return set(re.findall(r'[a-z]+', txt.lower()))
    except Exception:
        return set()


HELD = _bench_words()
NAMES_M, NAMES_F = [n for n in NAMES_M if n not in HELD], [n for n in NAMES_F if n not in HELD]
OBJECTS, FOODS, PLACES, JOBS = ([v for v in L if not (set(v.split()) & HELD)] for L in (OBJECTS, FOODS, PLACES, JOBS))
NAMES = NAMES_M + NAMES_F


def _two(R, pool):
    a, b = R.sample(pool, 2)
    return a, b


def _past(n, m, f):
    return f if n in NAMES_F else m


def _wrap(R, sents):
    s = list(sents)
    for _ in range(R.choice([0, 0, 1, 1, 2])):
        s.insert(R.randint(0, len(s)), R.choice(FILLER))
    return ' '.join(s)


def _row(task, ctx, q, opts, gold, R):
    opts = list(dict.fromkeys(opts))
    if gold not in opts:
        opts.append(gold)
    R.shuffle(opts)
    return dict(task='rw-' + task, context=ctx, question=q, options=opts, label=opts.index(gold))


def give(R):
    a, b = _two(R, NAMES); o = R.choice(OBJECTS); n = R.randint(2, 12); c = R.choice([x for x in NAMES if x not in (a, b)])
    verb = R.choice([('diyo', 'dii'), ('dinubhayo', 'dinubhayo'), ('thamayo', 'thamai'), ('pathayo', 'pathai')])
    s = R.choice([f'{a} le {b} lai {n} wata {o} {_past(a, *verb)}.', f'{b} lai {a} le {n} wata {o} {_past(a, *verb)}.',
                  f'{a} le aafno {n} wata {o} {b} lai {_past(a, *verb)}.'])
    ctx = _wrap(R, [s, f'{c} tyo bela ghar ma thiyo.' if R.random() < .5 else ''])
    k = R.random()
    if k < .35:
        return _row('giver', ctx, R.choice([f'kasle {o} {_past(a, *verb)}?', f'{o} kasle {_past(a, *verb)}?', f'{b} lai {o} kasle {_past(a, *verb)}?']), [b, c], a, R)
    if k < .7:
        return _row('receiver', ctx, R.choice([f'kasle {o} payo?', f'{o} kaslai {_past(a, *verb)}?', f'{a} le kaslai {o} {_past(a, *verb)}?']), [a, c], b, R)
    if k < .85:
        return _row('object', ctx, f'{a} le {b} lai ke {_past(a, *verb)}?', R.sample([x for x in OBJECTS if x != o], 3), o, R)
    return _row('count', ctx, f'{a} le kati wata {o} {_past(a, *verb)}?', [str(n + 1), str(n - 1), str(2 * n)], str(n), R)


def whose(R):
    a, b = _two(R, NAMES); o = R.choice(OBJECTS); v = R.choice([('bokyo', 'boki'), ('lyayo', 'lyai'), ('dhoyo', 'dhoi'), ('lukayo', 'lukai')])
    ctx = _wrap(R, [R.choice([f'{a} le {b} ko {o} {_past(a, *v)}.', f'{b} ko {o} {a} le {_past(a, *v)}.'])])
    if R.random() < .5:
        return _row('owner', ctx, R.choice([f'{o} kasko thiyo?', f'kasko {o} thiyo?']), [a], b, R)
    return _row('doer', ctx, R.choice([f'kasle {o} {_past(a, *v)}?', f'{o} kasle {_past(a, *v)}?']), [b], a, R)


def negation(R):
    a = R.choice(NAMES); x, y = _two(R, FOODS + OBJECTS if R.random() < .3 else FOODS)
    kind = R.choice(['like', 'buy', 'go'])
    if kind == 'go':
        x, y = _two(R, PLACES)
    v = R.choice([x, y])
    if kind == 'go':
        pos, neg = _past(a, 'gayo', 'gai'), _past(a, 'gayena', 'gaina')
        ctx = _wrap(R, [R.choice([f'{a} {x} {pos} tara {y} {neg}.', f'{a} {y} {neg}, {x} matra {pos}.'])])
        q = f'ke {a} {v} {pos}?'
    elif kind == 'buy':
        pos, neg = _past(a, 'kinyo', 'kini'), _past(a, 'kinyena', 'kinina')
        ctx = _wrap(R, [R.choice([f'{a} le {x} {pos} tara {y} {neg}.', f'{a} le {y} {neg}; {x} chahi {pos}.'])])
        q = f'ke {a} le {v} {pos}?'
    else:
        ctx = _wrap(R, [R.choice([f'{a} lai {x} man parchha tara {y} man pardaina.', f'{a} lai {y} man pardaina, {x} chahi man parchha.'])])
        q = f'ke {a} lai {v} man parchha?'
    yes = v == x
    opts = [f'ho, {v}', f'haina, {v} haina', 'thaha chhaina']
    return _row('negation', ctx, q, opts, opts[0] if yes else opts[1], R)


def temporal(R):
    a = R.choice(NAMES); f = R.choice(FOODS + OBJECTS); n1, n2 = R.sample(range(2, 15), 2)
    u = R.choice(['kilo', 'packet', 'dharni']) if f in FOODS else 'wata'
    v, th = _past(a, 'lyayo', 'lyai'), _past(a, 'thapyo', 'thapi')
    ctx = _wrap(R, [R.choice([f'{a} le pahile {n1} {u} {f} {v}, pachhi {n2} {u} {th}.', f'suru ma {a} le {n1} {u} {f} {v}. tyaspachhi {n2} {u} aru {v}.',
                              f'{a} le pachhi {n2} {u} {f} {v}, tara pahile {n1} {u} {v} thiyo.'])])
    which = R.random()
    if which < .4:
        return _row('later', ctx, R.choice([f'{a} le pachhi kati {u} {v}?', f'dosro choti kati {u} {v}?']), [str(n1), str(n1 + n2)], str(n2), R)
    if which < .8:
        return _row('earlier', ctx, R.choice([f'{a} le pahile kati {u} {v}?', f'suru ma kati {u} {v}?']), [str(n2), str(n1 + n2)], str(n1), R)
    return _row('total', ctx, f'jamma kati {u} {f} bhayo?', [str(n1), str(n2), str(abs(n1 - n2))], str(n1 + n2), R)


def order(R):
    a, b = _two(R, NAMES); c = R.choice([x for x in NAMES if x not in (a, b)])
    v1, v2 = _past(a, 'aayo', 'aai'), _past(b, 'aayo', 'aai')
    ctx = _wrap(R, [R.choice([f'pahile {a} {v1}, pachhi {b} {v2}.', f'{b} {a} bhanda pachhi {v2}.', f'{a} aaepachhi {b} {v2}.'])])
    if R.random() < .5:
        return _row('first', ctx, R.choice(['ko pahile aayo?', 'ko suru ma aayo?']), [b, c], a, R)
    return _row('last', ctx, R.choice(['ko pachhi aayo?', 'ko dhilo aayo?']), [a, c], b, R)


def subset(R):
    a = R.choice(NAMES); o = R.choice(OBJECTS); n = R.randint(5, 20); k = R.randint(1, n - 1)
    bad = R.choice(['bigreko', 'futeko', 'haraeko', 'puraano', 'bechisakeko'])
    ctx = _wrap(R, [R.choice([f'{a} sanga {n} wata {o} chhan, {k} wata {bad} chhan.', f'{a} ko ghar ma {n} wata {o} thiye; tyas madhye {k} wata {bad} thiye.'])])
    if R.random() < .55:
        return _row('rest', ctx, R.choice([f'kati wata {o} {bad} chhainan?', f'{bad} bahek kati wata {o} chhan?']), [str(n), str(k), str(n + k)], str(n - k), R)
    return _row('all', ctx, f'jamma kati wata {o} chhan?', [str(n - k), str(k), str(n + k)], str(n), R)


def coref(R):
    a = R.choice(NAMES); rel, g = R.choice(RELS); b = R.choice(NAMES_M if g == 'm' else NAMES_F); j1, j2 = R.sample(JOBS, 2); p = R.choice(PLACES)
    ctx = _wrap(R, [R.choice([f'{a} {j1} ho, {a} ko {rel} {b} {j2} ho.', f'{a} ko {rel} ko naam {b} ho. {b} {j2} ho ra {a} chahi {j1}.']),
                    R.choice([f'{b} {p} ma baschha.', ''])])
    k = R.random()
    if k < .35:
        return _row('rel-job', ctx, f'{a} ko {rel} ko kaam k ho?', [j1] + R.sample([x for x in JOBS if x not in (j1, j2)], 2), j2, R)
    if k < .7:
        return _row('self-job', ctx, f'{a} ko kaam k ho?', [j2] + R.sample([x for x in JOBS if x not in (j1, j2)], 2), j1, R)
    return _row('rel-name', ctx, f'{a} ko {rel} ko naam k ho?', [a] + R.sample([x for x in NAMES if x not in (a, b)], 2), b, R)


def compare(R):
    a, b = _two(R, NAMES); x, y = R.sample(range(8, 70), 2)
    what = R.choice([('barsha', 'jetho', 'kanchho', 'umer'), ('kilo', 'garungo', 'halukka', 'taul'), ('cm', 'aglo', 'hocho', 'uchai')])
    ctx = _wrap(R, [R.choice([f'{a} {x} {what[0]} ko chha, {b} {y} {what[0]} ko.', f'{b} ko {what[3]} {y} {what[0]} ra {a} ko {x} {what[0]} chha.'])])
    big, small = (a, b) if x > y else (b, a)
    k = R.random()
    if k < .4:
        return _row('more', ctx, f'ko {what[1]} chha?', [small], big, R)
    if k < .8:
        return _row('less', ctx, f'ko {what[2]} chha?', [big], small, R)
    return _row('value', ctx, f'{b} ko {what[3]} kati?', [str(x), str(abs(x - y))], str(y), R)


def units(R):
    a = R.choice(NAMES); f = R.choice(FOODS); n = R.randint(2, 9); pr = R.choice([20, 25, 40, 50, 60, 80, 120, 150])
    ctx = _wrap(R, [R.choice([f'{a} le {n} kilo {f} {pr} rupiya kilo ko dar le kinyo.', f'{f} ko dar kilo ko {pr} rupiya thiyo; {a} le {n} kilo kinyo.'])])
    if R.random() < .6:
        return _row('cost', ctx, R.choice(['jamma kati rupiya tiryo?', 'kati paisa laagyo?']), [str(pr), str(n), str(pr + n)], str(n * pr), R)
    return _row('amount', ctx, f'kati kilo {f} kinyo?', [str(pr), str(n * pr)], str(n), R)


def sequence(R):
    a = R.choice(NAMES)
    if R.random() < .5:
        s, d = R.randint(1, 30), R.choice([2, 3, 4, 5, 6, 7, 11, -3, -4, -5])
        seq = [s + i * d for i in range(4)] if d > 0 else [60 + i * d for i in range(4)]
        nxt = seq[-1] + d; step = abs(d); ask = 'kati le ghatchha?' if d < 0 else 'kati le badchha?'
    else:
        s, d = R.randint(1, 4), R.choice([2, 3])
        seq = [s * d ** i for i in range(4)]; nxt, step, ask = seq[-1] * d, d, 'ke le gunera badchha?'
    ctx = _wrap(R, [f'{a} le {", ".join(map(str, seq))} {_past(a, "lekhyo", "lekhi")}.'])
    if R.random() < .6:
        return _row('next', ctx, 'arko number kati?', [str(seq[-1]), str(nxt + step), str(nxt - 1)], str(nxt), R)
    return _row('step', ctx, ask, [str(step + 1), str(seq[0]), str(seq[-1])], str(step), R)


GENS = [(give, .2), (whose, .1), (negation, .14), (temporal, .12), (order, .08), (subset, .1), (coref, .1), (compare, .08), (units, .04), (sequence, .04)]


def sample(R):
    x, acc = R.random(), 0.0
    for f, w in GENS:
        acc += w
        if x < acc:
            return f(R)
    return give(R)


if __name__ == '__main__':
    R = random.Random(0)
    for _ in range(12):
        r = sample(R); print(r['task'], '|', r['context'], '|', r['question'], '|', r['options'], r['label'])
