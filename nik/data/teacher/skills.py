"""Compositional language + symbol skills with explicit, checkable traces (no fixed answer templates):
  * translation EN <-> romanized Nepali from full verb tables (7 subjects x present continuous / habitual / past,
    negatives, ergative "le" with transitive past), so phrases are built, not recalled
  * grammar: Nepali negative / tense change / -haru plural; English plural (irregulars), singular, agreement fixes
  * list ops (min, max, sort up/down, sum) with a scan trace; word ops (reverse, letter count) spelled letter by letter
  * percent-of with the multiplication shown
Each generator returns dict(messages, gold, kind)."""
import random

import lexicon as L

# subject: (ne, en, key)  key selects endings
SUBJ = [('ma', 'I', '1s'), ('hami', 'we', '1p'), ('timi', 'you', '2'), ('tapai', 'you', 'h'), ('u', 'he', '3m'),
        ('uni', 'she', '3f'), ('uniharu', 'they', '3p')]
ERG = {'ma': 'maile', 'hami': 'hamile', 'timi': 'timile', 'tapai': 'tapaile', 'u': 'usle', 'uni': 'unle', 'uniharu': 'uniharule'}
EN_BE = {'1s': 'am', '1p': 'are', '2': 'are', 'h': 'are', '3m': 'is', '3f': 'is', '3p': 'are'}
CONT_AUX = {'1s': 'chhu', '1p': 'chhau', '2': 'chhau', 'h': 'hunuhunchha', '3m': 'chha', '3f': 'chhin', '3p': 'chhan'}
CONT_NEG = {'1s': 'chhuina', '1p': 'chhainau', '2': 'chhainau', 'h': 'hunuhunna', '3m': 'chhaina', '3f': 'chhainan', '3p': 'chhainan'}
# verb: ne stem, continuous participle, habitual stem, tapai stem, past forms by key, transitive, en (base, ing, s, past)
V = {
    'eat': ('kha', 'khadai', 'khan', 'kha', dict(s='khaye', p='khayau', t='khayau', h='khanubhayo', m='khayo', f='khain', P='khae'), True, ('eat', 'eating', 'eats', 'ate')),
    'go': ('ja', 'jadai', 'jan', 'ja', dict(s='gaye', p='gayau', t='gayau', h='janubhayo', m='gayo', f='gain', P='gae'), False, ('go', 'going', 'goes', 'went')),
    'read': ('padh', 'padhdai', 'padh', 'padh', dict(s='padhe', p='padhyau', t='padhyau', h='padhnubhayo', m='padhyo', f='padhin', P='padhe'), True, ('read', 'reading', 'reads', 'read')),
    'write': ('lekh', 'lekhdai', 'lekh', 'lekh', dict(s='lekhe', p='lekhyau', t='lekhyau', h='lekhnubhayo', m='lekhyo', f='lekhin', P='lekhe'), True, ('write', 'writing', 'writes', 'wrote')),
    'play': ('khel', 'kheldai', 'khel', 'khel', dict(s='khele', p='khelyau', t='khelyau', h='khelnubhayo', m='khelyo', f='khelin', P='khele'), True, ('play', 'playing', 'plays', 'played')),
    'sleep': ('sut', 'sutdai', 'sut', 'sut', dict(s='sute', p='sutyau', t='sutyau', h='sutnubhayo', m='sutyo', f='sutin', P='sute'), False, ('sleep', 'sleeping', 'sleeps', 'slept')),
    'cook': ('pakau', 'pakaudai', 'pakau', 'pakau', dict(s='pakaye', p='pakayau', t='pakayau', h='pakaunubhayo', m='pakayo', f='pakain', P='pakae'), True, ('cook', 'cooking', 'cooks', 'cooked')),
    'drink': ('piu', 'piudai', 'piun', 'piu', dict(s='piye', p='piyau', t='piyau', h='piunubhayo', m='piyo', f='piin', P='piye'), True, ('drink', 'drinking', 'drinks', 'drank')),
    'watch': ('her', 'herdai', 'her', 'her', dict(s='here', p='heryau', t='heryau', h='hernubhayo', m='heryo', f='herin', P='here'), True, ('watch', 'watching', 'watches', 'watched')),
    'come': ('aau', 'aaudai', 'aau', 'aau', dict(s='aaye', p='aayau', t='aayau', h='aaunubhayo', m='aayo', f='aain', P='aae'), False, ('come', 'coming', 'comes', 'came')),
    'run': ('dagur', 'dagurdai', 'dagur', 'dagur', dict(s='dagure', p='daguryau', t='daguryau', h='dagurnubhayo', m='daguryo', f='dagurin', P='dagure'), False, ('run', 'running', 'runs', 'ran')),
}
PKEY = {'1s': 's', '1p': 'p', '2': 't', 'h': 'h', '3m': 'm', '3f': 'f', '3p': 'P'}
HAB_END = {'1s': 'chhu', '1p': 'chhau', '2': 'chhau', '3m': 'chha', '3f': 'chhin', '3p': 'chhan'}
OBJ = {
    'eat': [('bhat', 'rice'), ('syau', 'an apple'), ('khana', 'food'), ('momo', 'momo'), ('kera', 'a banana'), ('roti', 'bread')],
    'go': [('school', 'to school'), ('ghar', 'home'), ('bazaar', 'to the market'), ('office', 'to the office'), ('mandir', 'to the temple'), ('pokhara', 'to Pokhara')],
    'read': [('kitab', 'a book'), ('akhbar', 'the newspaper'), ('chithi', 'a letter'), ('kabita', 'a poem')],
    'write': [('chithi', 'a letter'), ('kabita', 'a poem'), ('nibandha', 'an essay'), ('kahani', 'a story')],
    'play': [('football', 'football'), ('cricket', 'cricket'), ('chess', 'chess'), ('volleyball', 'volleyball')],
    'drink': [('pani', 'water'), ('chiya', 'tea'), ('dudh', 'milk'), ('coffee', 'coffee')],
    'watch': [('TV', 'TV'), ('movie', 'a movie'), ('match', 'the match'), ('news', 'the news')],
    'cook': [('bhat', 'rice'), ('tarkari', 'curry'), ('momo', 'momo'), ('dal', 'lentils')],
    'come': [('ghar', 'home')], 'sleep': [], 'run': [],
}


def hab(verb, key):
    st, _, hs, ts, _, _, _ = V[verb]
    if key == 'h':
        return ts + 'nuhunchha'
    e = HAB_END[key]
    if hs in ('kha', 'ja', 'piu'):
        hs = {'kha': 'khan', 'ja': 'jan', 'piu': 'piun'}[hs]
    if hs.endswith('au'):
        return hs + e[1:] if False else hs + e          # pakauchhu, aauchhu
    return hs + e


def sentence(R, tense=None, neg=False, subj=None, verb=None):
    ne_s, en_s, key = subj or R.choice(SUBJ)
    verb = verb or R.choice(list(V))
    st, cont, hs, ts, past, trans, (b, ing, s3, pst) = V[verb]
    tense = tense or R.choice(['cont', 'hab', 'past'])
    obj = R.choice(OBJ[verb]) if OBJ[verb] and R.random() < 0.85 else None
    o_ne = (obj[0] + ('' if verb != 'go' or obj[0] == 'ghar' else '')) if obj else ''
    o_en = obj[1] if obj else ''
    if tense == 'cont':
        ne = f"{ne_s} {o_ne} {cont} {CONT_NEG[key] if neg else CONT_AUX[key]}"
        en = f"{en_s} {EN_BE[key]}{' not' if neg else ''} {ing} {o_en}"
    elif tense == 'hab':
        ne = f"{ne_s} {o_ne} {hab(verb, key)}"
        en = f"{en_s} {s3 if key in ('3m', '3f') else b} {o_en}"
    else:
        subj_ne = ERG[ne_s] if trans and obj else ne_s
        ne = f"{subj_ne} {o_ne} {past[PKEY[key]]}"
        en = f"{en_s} {pst} {o_en}"
    ne, en = ' '.join(ne.split()), ' '.join(en.split())
    en = en[0].upper() + en[1:] + '.'
    return ne, en, dict(key=key, verb=verb, tense=tense, subj=ne_s)


def translate(R):
    ne, en, info = sentence(R, neg=R.random() < 0.15 and None)
    if R.random() < 0.5:
        q = R.choice(['"{s}" nepali ma bhana.', '"{s}" lai nepali ma k bhanchha?', 'translate to nepali: "{s}"', '"{s}" ko nepali?',
                      'nepali ma anuvad gara: "{s}"']).format(s=en.rstrip('.') if R.random() < 0.5 else en)
        a = R.choice(['"{t}"', 'nepali ma: "{t}"', '"{s}" lai nepali ma "{t}" bhanchha.']).format(t=ne, s=en.rstrip('.'))
        gold = ne
    else:
        q = R.choice(['"{s}" english ma k ho?', '"{s}" english ma bhana.', 'translate to english: "{s}"', '"{s}" ko english?',
                      '"{s}" lai english ma kasari bhanne?']).format(s=ne)
        a = R.choice(['"{t}"', 'english ma: "{t}"', '"{s}" ko english "{t}" ho.']).format(t=en, s=ne)
        gold = en.lower().rstrip('.')
    tense_ne = {'cont': 'aahile gardai gareko (continuous)', 'hab': 'sadhai garne (habitual)', 'past': 'bhutkaal (past)'}[info['tense']]
    # the trace must show the *mapping*, not just the English side: the model answered
    # "we are reading" with "uni padhdai chhin" (the wrong pronoun and the wrong
    # register), so the subject and the auxiliary are written out.
    ne_subj = info['subj']
    en_subj = {k: e for _, e, k in SUBJ}[info['key']]
    aux = CONT_AUX[info['key']]
    return {'kind': 'skill-translate', 'gold': gold, 'messages': [{'role': 'user', 'content': q},
            {'role': 'nik', 'content': a, 'think': f"kartaa: {en_subj} -> {ne_subj}, "
                    f"sahayak: {aux}, kriya: {info['verb']}, kaal: {tense_ne}."}]}


def negate(R):
    subj = R.choice(SUBJ)
    verb = R.choice(list(V))
    pos, _, _ = sentence(R, tense='cont', subj=subj, verb=verb)
    neg = pos.rsplit(' ', 1)[0] + ' ' + CONT_NEG[subj[2]]
    q = R.choice(['"{s}" lai negative banau.', '"{s}" ko negative k hunchha?', '"{s}" lai nakaratmak banau.', 'negative ma lekha: "{s}"']).format(s=pos)
    return {'kind': 'skill-negate', 'gold': neg, 'messages': [{'role': 'user', 'content': q},
            {'role': 'nik', 'content': f'"{neg}"', 'think': f'"{CONT_AUX[subj[2]]}" lai "{CONT_NEG[subj[2]]}" banaune.'}]}


def to_past(R):
    subj, verb = R.choice(SUBJ), R.choice(list(V))
    R2 = random.Random(R.random())
    st = R2.getstate()
    cont, _, _ = sentence(R2, tense='cont', subj=subj, verb=verb)
    R2.setstate(st)
    past, en, info = sentence(R2, tense='past', subj=subj, verb=verb)
    q = R.choice(['"{s}" lai bhutkaal (past) ma lekha.', '"{s}" past tense ma k hunchha?', 'yo vakya past ma badal: "{s}"']).format(s=cont)
    return {'kind': 'skill-past', 'gold': past, 'messages': [{'role': 'user', 'content': q}, {'role': 'nik', 'content': f'"{past}"'}]}


IRREG = [('child', 'children'), ('man', 'men'), ('woman', 'women'), ('tooth', 'teeth'), ('foot', 'feet'), ('mouse', 'mice'),
         ('person', 'people'), ('goose', 'geese'), ('ox', 'oxen'), ('sheep', 'sheep'), ('fish', 'fish'), ('deer', 'deer')]
REG = ['book', 'pen', 'dog', 'cat', 'house', 'car', 'tree', 'girl', 'boy', 'apple', 'chair', 'table', 'river', 'mountain',
       'city', 'baby', 'story', 'party', 'lady', 'box', 'bus', 'dish', 'church', 'glass', 'watch', 'leaf', 'knife', 'wife',
       'potato', 'tomato', 'hero', 'phone', 'friend', 'teacher', 'student', 'bird', 'flower', 'road', 'window', 'door']


def en_plural(w):
    d = dict(IRREG)
    if w in d:
        return d[w]
    if w in ('leaf', 'knife', 'wife'):
        return {'leaf': 'leaves', 'knife': 'knives', 'wife': 'wives'}[w]
    if w.endswith('y') and w[-2] not in 'aeiou':
        return w[:-1] + 'ies'
    if w.endswith(('s', 'x', 'sh', 'ch')) or w in ('potato', 'tomato', 'hero'):
        return w + 'es'
    return w + 's'


def grammar(R):
    k = R.random()
    if k < 0.3:
        w, unit = R.choice(L.THINGS)
        w = w.split()[-1]
        q = R.choice(['"{w}" ko plural?', '"{w}" lai bahubachan banau.', '"{w}" ko bahubachan k ho?', 'plural of "{w}" in nepali?']).format(w=w)
        a = f'"{w}" ko bahubachan "{w}haru" ho.'
        return {'kind': 'skill-plural-ne', 'gold': w + 'haru', 'messages': [{'role': 'user', 'content': q},
                {'role': 'nik', 'content': a, 'think': 'nepali ma naam pachhi "-haru" jodda bahubachan hunchha.'}]}
    if k < 0.6:
        w = R.choice([x for x, _ in IRREG] + REG)
        pl = en_plural(w)
        if R.random() < 0.5:
            q = R.choice(['"{w}" ko plural k ho?', 'plural of "{w}"?', 'What is the plural of "{w}"?']).format(w=w)
            return {'kind': 'skill-plural-en', 'gold': pl, 'messages': [{'role': 'user', 'content': q},
                    {'role': 'nik', 'content': f'"{w}" ko plural "{pl}" ho.' if 'What' not in q else f'The plural of "{w}" is "{pl}".'}]}
        q = R.choice(['"{p}" ko singular k ho?', 'singular of "{p}"?', '"{p}" lai ekbachan banau.']).format(p=pl)
        return {'kind': 'skill-singular-en', 'gold': w, 'messages': [{'role': 'user', 'content': q},
                {'role': 'nik', 'content': f'"{pl}" ko singular "{w}" ho.'}]}
    # English agreement fix
    subj = R.choice(['he', 'she', 'my father', 'my sister', 'ram', 'the boy', 'the teacher', 'it'])
    verb = R.choice(['eat', 'go', 'read', 'write', 'play', 'sleep', 'cook', 'drink', 'watch', 'come', 'run'])
    tail = {'eat': 'rice', 'go': 'to market', 'read': 'a book', 'write': 'a letter', 'play': 'football', 'sleep': 'early',
            'cook': 'dinner', 'drink': 'tea', 'watch': 'TV', 'come': 'home', 'run': 'fast'}[verb]
    wrong = f'{subj} {verb} {tail}.'
    right = f'{subj} {V[verb][6][2]} {tail}.'
    q = R.choice(['correct this: "{s}"', '"{s}" ma galti k chha?', 'fix the grammar: "{s}"', '"{s}" thik chha?']).format(s=wrong)
    return {'kind': 'skill-agree', 'gold': V[verb][6][2], 'messages': [{'role': 'user', 'content': q},
            {'role': 'nik', 'content': f'sahi: "{right}"', 'think': f'"{subj}" ekbachan third person ho, tyasaile "{verb}" haina "{V[verb][6][2]}".'}]}


def list_ops(R):
    n = R.randint(3, 8)
    xs = R.sample(range(1, R.choice([20, 100, 1000])), n)
    s = ', '.join(map(str, xs))
    op = R.choice(['min', 'max', 'asc', 'desc', 'sum'])
    if op in ('min', 'max'):
        cur, steps = xs[0], [f'suru: {xs[0]}']
        for x in xs[1:]:
            better = x < cur if op == 'min' else x > cur
            steps.append(f'{x} {"<" if x < cur else ">"} {cur}' + (f' -> {x}' if better else ''))
            cur = x if better else cur
        w = 'sano' if op == 'min' else 'thulo'
        q = R.choice([f'{s} madhye sabai bhanda {w} kun?', f'{s} ma sabai bhanda {w} sankhya kun ho?', f'yo list ma {w} kun: {s}?'])
        return {'kind': f'skill-{op}', 'gold': str(cur), 'messages': [{'role': 'user', 'content': q},
                {'role': 'nik', 'content': f'sabai bhanda {w} {cur} ho.', 'think': '. '.join(steps) + '.'}]}
    if op == 'sum':
        tot = sum(xs)
        run, acc = [], xs[0]
        for x in xs[1:]:
            run.append(f'{acc} + {x} = {acc + x}'); acc += x
        q = R.choice([f'{s} ko jod kati?', f'{s} jodda kati hunchha?', f'sum of {s}?'])
        return {'kind': 'skill-sum', 'gold': str(tot), 'messages': [{'role': 'user', 'content': q},
                {'role': 'nik', 'content': f'jamma {tot} hunchha.', 'think': '. '.join(run) + '.'}]}
    srt = sorted(xs, reverse=op == 'desc')
    rest, picks = list(xs), []
    for _ in range(n):
        v = (max if op == 'desc' else min)(rest); picks.append(f'{"thulo" if op == "desc" else "sano"}: {v}'); rest.remove(v)
    q = R.choice([f'{s} lai {"thulo bata sano" if op == "desc" else "sano bata thulo"} kram ma lekha.',
                  f'{s} sort gara ({"ghatdo" if op == "desc" else "badhdo"} kram).', f'{"descending" if op == "desc" else "ascending"} order ma: {s}'])
    out = ', '.join(map(str, srt))
    return {'kind': f'skill-{op}', 'gold': out, 'messages': [{'role': 'user', 'content': q},
            {'role': 'nik', 'content': out, 'think': '. '.join(picks) + '.'}]}


WORDS = L.PLACES + L.NAMES_M + L.NAMES_F + [f for f in L.FOODS if ' ' not in f] + ['nepal', 'himal', 'kitab', 'pani', 'computer', 'school', 'maya']


def word_ops(R):
    w = R.choice(WORDS)
    sp = '-'.join(w)
    if R.random() < 0.5:
        q = R.choice(['"{w}" ulto lekha.', '"{w}" lai ulto gara.', 'reverse "{w}"', '"{w}" pachhadi bata lekha.']).format(w=w)
        r = w[::-1]
        return {'kind': 'skill-reverse', 'gold': r, 'messages': [{'role': 'user', 'content': q},
                {'role': 'nik', 'content': f'"{w}" ulto: "{r}".', 'think': f'{sp} -> {"-".join(r)}.'}]}
    q = R.choice(['"{w}" ma kati akshar chha?', '"{w}" ma kati ota letter chhan?', 'how many letters in "{w}"?', '"{w}" ko lambai kati akshar?']).format(w=w)
    return {'kind': 'skill-letters', 'gold': str(len(w)), 'messages': [{'role': 'user', 'content': q},
            {'role': 'nik', 'content': f'"{w}" ma {len(w)} akshar chhan.', 'think': f'{sp}: {len(w)} ota.'}]}


def percent(R):
    p = R.choice([5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80])
    base = R.choice([x for x in range(10, 2001, 5) if x * p % 100 == 0])
    v = base * p // 100
    q = R.choice([f'{base} ko {p} percent kati?', f'{base} ko {p}% kati hunchha?', f'{p}% of {base}?', f'{base} rupiya ko {p} pratishat kati?'])
    return {'kind': 'skill-percent', 'gold': str(v), 'messages': [{'role': 'user', 'content': q},
            {'role': 'nik', 'content': f'{base} ko {p}% = {v}.', 'think': f'{base} x {p} = {base * p}. {base * p} / 100 = {v}.'}]}


GENS = [(translate, 0.26), (negate, 0.08), (to_past, 0.06), (grammar, 0.18), (list_ops, 0.2), (word_ops, 0.12), (percent, 0.1)]


def sample(R):
    x, acc = R.random(), 0.0
    for g, w in GENS:
        acc += w
        if x < acc:
            return g(R)
    return translate(R)


if __name__ == '__main__':
    import json, sys
    R = random.Random(int(sys.argv[1]) if len(sys.argv) > 1 else 0)
    for _ in range(int(sys.argv[2]) if len(sys.argv) > 2 else 8):
        print(json.dumps(sample(R), ensure_ascii=False))
