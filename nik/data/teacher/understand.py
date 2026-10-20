"""Understanding tasks: the answer is built from the user's own message, so it cannot be
memorised. This breaks the "find nearest stored reply" shortcut a small model learns from
fixed chat data. Each generator returns dict(q, a, gold, kind[, think]) or a multi-turn messages dict.
"""
import random

from math_gen import NAMES, PLACES, pick

FOODS = ['momo', 'dal bhat', 'chowmein', 'sel roti', 'pizza', 'aalu tama', 'chiya', 'dhido', 'samosa', 'kheer']
HOBBIES = ['gita gaune', 'football khelne', 'kitab padhne', 'chitra banaune', 'coding garne', 'ghumna jaane', 'nachne', 'cycle chalaune']
JOBS = ['shikshak', 'doctor', 'engineer', 'kisan', 'driver', 'nurse', 'developer', 'bidyarthi', 'byapari', 'lekhak']
CATS = {
    'fal': ['syau', 'kera', 'aanp', 'suntala', 'angur', 'mewa', 'litchi', 'nashpati', 'aaru', 'bhuin katahar'],
    'rang': ['rato', 'nilo', 'hariyo', 'pahelo', 'seto', 'kalo', 'khairo', 'gulabi', 'baijani', 'suntala rang'],
    'janawar': ['kukur', 'biralo', 'gai', 'bakhra', 'bagh', 'hatti', 'bandar', 'ghoda', 'bhalu', 'kharayo'],
    'tarkari': ['aalu', 'kauli', 'banda', 'golbheda', 'pharsi', 'bhanta', 'gajar', 'saag', 'mula', 'karela'],
    'bar': ['aaitabar', 'sombar', 'mangalbar', 'budhabar', 'bihibar', 'sukrabar', 'sanibar'],
    'nepali mahina': ['baishakh', 'jestha', 'asar', 'shrawan', 'bhadra', 'ashwin', 'kartik', 'mangsir', 'poush', 'magh', 'falgun', 'chaitra'],
    'pradesh': ['koshi', 'madhesh', 'bagmati', 'gandaki', 'lumbini', 'karnali', 'sudurpashchim'],
}
ANTONYM = [('thulo', 'sano'), ('ramro', 'naramro'), ('dherai', 'thorai'), ('mathi', 'tala'), ('din', 'raat'), ('garmi', 'jado'),
           ('sajilo', 'garho'), ('chhito', 'dhilo'), ('naya', 'purano'), ('tato', 'chiso'), ('aglo', 'hocho'), ('khusi', 'dukhi'),
           ('bhitra', 'bahira'), ('agadi', 'pachhadi'), ('najik', 'tadha'), ('ujyalo', 'andhyaro'), ('sukha', 'dukha'), ('dhani', 'garib'),
           ('jitnu', 'harnu'), ('kholnu', 'thunnu'), ('aaunu', 'jaanu'), ('sach', 'jhut'), ('baliyo', 'kamjor'), ('lamo', 'chhoto')]
EN = [('ghar', 'house'), ('pani', 'water'), ('khana', 'food'), ('kitab', 'book'), ('sathi', 'friend'), ('aama', 'mother'), ('buwa', 'father'),
      ('school', 'school'), ('bato', 'road'), ('rukh', 'tree'), ('phool', 'flower'), ('aakash', 'sky'), ('ghaam', 'sun'), ('jun', 'moon'),
      ('pahad', 'hill'), ('himal', 'mountain'), ('nadi', 'river'), ('sahar', 'city'), ('gaun', 'village'), ('dukan', 'shop'),
      ('paisa', 'money'), ('samaya', 'time'), ('maya', 'love'), ('khusi', 'happiness'), ('kaam', 'work'), ('chara', 'bird'),
      ('kukur', 'dog'), ('biralo', 'cat'), ('jhyal', 'window'), ('dhoka', 'door'), ('kalam', 'pen'), ('bhasa', 'language')]
# verb: (romanized stem for present continuous, english base, english -ing, nepali past 3rd person, english past)
VERBS = [('ja', 'go', 'going', 'gayo', 'went'), ('kha', 'eat', 'eating', 'khayo', 'ate'), ('padh', 'read', 'reading', 'padhyo', 'read'),
         ('lekh', 'write', 'writing', 'lekhyo', 'wrote'), ('khel', 'play', 'playing', 'khelyo', 'played'), ('sut', 'sleep', 'sleeping', 'sutyo', 'slept'),
         ('pakau', 'cook', 'cooking', 'pakayo', 'cooked'), ('kin', 'buy', 'buying', 'kinyo', 'bought'), ('her', 'watch', 'watching', 'heryo', 'watched'),
         ('gaa', 'sing', 'singing', 'gayo', 'sang'), ('dagur', 'run', 'running', 'dagur yo', 'ran')]
VERBS = [v for v in VERBS if ' ' not in v[3]]
SUBJ = [('ma', 'I', 'chhu', 'am'), ('hami', 'we', 'chhau', 'are'), ('timi', 'you', 'chhau', 'are'), ('tapai', 'you', 'hunuhunchha', 'are'),
        ('u', 'he', 'chha', 'is'), ('uni', 'she', 'chhin', 'is')]


def cont(stem):
    """present continuous participle: ja -> jadai, padh -> padhdai, pakau -> pakaudai, gaa -> gaaudai"""
    if stem == 'gaa':
        return 'gaaudai'
    return stem + 'dai'


def ex(q, a, gold, kind, think=None):
    d = {'q': q, 'a': a, 'gold': gold, 'kind': kind}
    if think:
        d['think'] = think
    return d


# ---------------------------------------------------------------- remember what the user said
def recall(R):
    n, p, f, h, j = pick(R, NAMES), pick(R, PLACES), pick(R, FOODS), pick(R, HOBBIES), pick(R, JOBS)
    age = R.randint(8, 70)
    facts = [('naam', f'mero naam {n} ho', n), ('thau', f'ma {p} ma baschhu', p), ('khana', f'malai {f} man parchha', f),
             ('ruchi', f'malai {h} man parchha', h), ('umer', f'mero umer {age} barsha ho', str(age)), ('kaam', f'ma {j} hu', j)]
    shown = R.sample(facts, R.randint(2, 4))
    key, _, gold = pick(R, shown)
    ask = {'naam': 'mero naam k ho?', 'thau': 'ma kaha baschhu?', 'khana': 'malai kun khana man parchha?', 'ruchi': 'mero ruchi k ho?',
           'umer': 'mero umer kati ho?', 'kaam': 'ma k kaam garchhu?'}[key]
    ans = {'naam': f'tapai ko naam {n} ho.', 'thau': f'tapai {p} ma basnuhunchha.', 'khana': f'tapailai {f} man parchha.',
           'ruchi': f'tapailai {h} man parchha.', 'umer': f'tapai ko umer {age} barsha ho.', 'kaam': f'tapai {j} hunuhunchha.'}[key]
    q = '. '.join(s for _, s, _ in shown) + '. ' + ask
    think = f'user le aafno barema bhannu bhayo: {"; ".join(s for _, s, _ in shown)}. sodheko {key} ho, jun {gold} ho.'
    return ex(q, ans, gold, 'recall', think)


def intro_reply(R):
    n, p = pick(R, NAMES), pick(R, PLACES)
    k = R.random()
    if k < 0.5:
        q = pick(R, [f'namaste, ma {n} hu.', f'hi, mero naam {n} ho.', f'ma {n}, {p} bata.'])
        a = pick(R, [f'namaste {n}! tapailai bhetera khusi lagyo. aaja k ma help garu?', f'namaste {n}ji! k chha khabar? k kura garne?',
                     f'hello {n}! ma nik. tapai sanga kura garna paauda khusi lagyo.'])
        return ex(q, a, n, 'intro')
    j = pick(R, JOBS)
    q = f'ma {n} ho, ra ma {j} hu. mero kaam ko barema ek wakya bhannus.'
    a = f'{n}ji, {j} ko kaam samaj ko lagi dherai mahattwapurna chha. tapai ko mehanat le arulai pani faida pugchha.'
    return ex(q, a, j, 'intro')


# ---------------------------------------------------------------- read a story, answer about it
GOALS = [('euta sano bagaincha banauna', 'bagaincha'), ('school ko daud pratiyogita jitna', 'pratiyogita'), ('aama ko lagi upahar kinna', 'upahar'),
         ('naya kitab padhna', 'kitab'), ('himal ko suryodaya herna', 'suryodaya'), ('cycle chalauna sikna', 'cycle')]
HELP = [('hajurba', 'dhairya rakhna sikaunubhayo'), ('didi', 'bato dekhaidinubhayo'), ('teacher', 'pheri prayas garna hausala dinubhayo'),
        ('sathi', 'sangai abhyas garyo'), ('aama', 'paisa bachauna sikaunubhayo')]
PROBLEM = [('pahilo prayas ma u asafal bhayo', 'pahilo prayas ma asafal bhayo'), ('ekdam pani paryo', 'pani paryo'),
           ('usko paisa pugena', 'paisa pugena'), ('uslai dar lagyo', 'dar lagyo')]


def story_qa(R):
    n, place = pick(R, NAMES), pick(R, PLACES)
    goal, gk = pick(R, GOALS)
    helper, act = pick(R, HELP)
    prob, probk = pick(R, PROBLEM)
    story = (f'{place} ma {n} naam ko euta baccha thiyo. ek din {n} le {goal} chahyo. tara {prob}. '
             f'tyasbela usko {helper} le {act}. {n} le pheri prayas garyo ra antama safal bhayo.')
    qs = [(f'{n} kaha basthyo?', f'{n} {place} ma basthyo.', place),
          (f'{n} le k garna chahyo?', f'{n} le {goal} chahyo.', gk),
          (f'{n} lai kasle madat garyo?', f'usko {helper} le madat garnubhayo.', helper),
          (f'suru ma k samasya bhayo?', f'suru ma {probk}.', probk.split()[0]),
          ('katha ko sikai k ho?', 'katha le sikauchha: samasya aaye pani madat line ra pheri prayas garne bani le safalta dinchha.', 'prayas')]
    q, a, g = pick(R, qs)
    return ex(f'yo katha padhnus: "{story}" prashna: {q}', a, g, 'reading', f'katha ma hernu: {a}')


# ---------------------------------------------------------------- translation
def translate(R):
    s_np, s_en, aux_np, aux_en = pick(R, SUBJ)
    v_stem, v_en, v_ing, _, _ = pick(R, VERBS)
    np_sent = f'{s_np} {cont(v_stem)} {aux_np}'
    en_sent = f'{s_en} {aux_en} {v_ing}'
    if R.random() < 0.5:
        q = pick(R, [f'"{en_sent}" lai nepali ma kasari bhanne?', f'translate to nepali: {en_sent}', f'english bata nepali: "{en_sent}"'])
        think = f'subject "{s_en}" = "{s_np}", kriya "{v_ing}" = "{cont(v_stem)}", ani {s_np} sanga "{aux_np}" milchha.'
        return ex(q, f'nepali ma: "{np_sent}".', np_sent, 'translate', think)
    q = pick(R, [f'"{np_sent}" ko english k hunchha?', f'translate to english: {np_sent}', f'"{np_sent}" lai english ma bhannus.'])
    return ex(q, f'english ma: "{en_sent}".', en_sent, 'translate')


def word_meaning(R):
    np_w, en_w = pick(R, EN)
    if R.random() < 0.5:
        return ex(pick(R, [f'"{np_w}" ko english k ho?', f'{np_w} lai english ma k bhanchhan?']), f'"{np_w}" lai english ma "{en_w}" bhaninchha.', en_w, 'vocab')
    return ex(pick(R, [f'"{en_w}" ko nepali k ho?', f'{en_w} lai nepali ma k bhanchhan?']), f'"{en_w}" lai nepali ma "{np_w}" bhaninchha.', np_w, 'vocab')


# ---------------------------------------------------------------- grammar transformations
def grammar(R):
    s_np, _, aux_np, _ = pick(R, SUBJ)
    v_stem = pick(R, VERBS)[0]
    k = R.random()
    if k < 0.35:
        neg = {'chhu': 'chhaina', 'chhau': 'chhainau', 'hunuhunchha': 'hunuhunna', 'chha': 'chhaina', 'chhin': 'chhinan'}[aux_np]
        neg = 'chhaina' if s_np == 'ma' else neg
        src = f'{s_np} {cont(v_stem)} {aux_np}'
        out = f'{s_np} {cont(v_stem)} {neg}' if s_np != 'ma' else f'ma {cont(v_stem)} chhaina'
        return ex(f'yo wakya lai nakaratmak banaunus: "{src}"', f'nakaratmak: "{out}".', out, 'grammar',
                  f'"{aux_np}" ko nakaratmak rup "{neg}" ho.')
    if k < 0.65:
        src = f'timi {cont(v_stem)} chhau'
        out = f'tapai {cont(v_stem)} hunuhunchha'
        return ex(f'yo wakya lai aadarsuchak (honorific) banaunus: "{src}"', f'aadarsuchak: "{out}".', out, 'grammar',
                  '"timi" ko satta "tapai" ra "chhau" ko satta "hunuhunchha" prayog garinchha.')
    w = pick(R, ['keta', 'keti', 'kitab', 'ghar', 'rukh', 'sathi', 'chara', 'gaadi', 'phool', 'bidyarthi'])
    return ex(f'"{w}" ko bahubachan (plural) k hunchha?', f'"{w}" ko bahubachan "{w}haru" hunchha.', f'{w}haru', 'grammar',
              'nepali ma bahubachan banauna shabda pachhi "haru" jodinchha.')


def past_tense(R):
    n = pick(R, NAMES)
    v_stem, _, _, past, _ = pick(R, VERBS)
    return ex(f'"{n} {cont(v_stem)} chha" lai bhutkal ma lekhnus.', f'bhutkal: "{n} le {past}" wa "{n} {past}".', past, 'grammar',
              f'"{cont(v_stem)} chha" chalirahekko kaam ho; sakieko kaam lai "{past}" bhaninchha.')


# ---------------------------------------------------------------- instructions on text
def text_ops(R):
    k = R.random()
    if k < 0.25:
        w = pick(R, [x for x in sum(CATS.values(), []) if ' ' not in x and 3 <= len(x) <= 9])
        rv = w[::-1]
        return ex(f'"{w}" lai ulto lekhnus.', f'"{w}" ulto: "{rv}".', rv, 'textop', 'akshar haru: ' + ' '.join(w) + '. ulto kram: ' + ' '.join(rv) + '.')
    if k < 0.5:
        w = pick(R, [x for x in sum(CATS.values(), []) if ' ' not in x])
        return ex(f'"{w}" ma kati wata akshar chhan?', f'"{w}" ma {len(w)} wata akshar chhan.', str(len(w)), 'textop',
                  'gannu: ' + ', '.join(f'{c}({i + 1})' for i, c in enumerate(w)) + '.')
    if k < 0.75:
        words = R.sample(sum(CATS.values(), []), R.randint(3, 8))
        sent = ' '.join(words)
        n = len(sent.split())
        return ex(f'yo wakya ma kati shabda chhan: "{sent}"?', f'tyasma {n} wata shabda chhan.', str(n), 'textop',
                  'shabda haru: ' + ' | '.join(sent.split()) + f'. jamma {n}.')
    words = R.sample(sum(CATS.values(), []), 4)
    which = R.choice(['pahilo', 'antim'])
    w = words[0] if which == 'pahilo' else words[-1]
    return ex(f'yo suchi ko {which} shabda kun ho: {", ".join(words)}?', f'{which} shabda "{w}" ho.', w, 'textop')


def list_items(R):
    cat = pick(R, list(CATS))
    k = R.randint(2, min(5, len(CATS[cat])))
    items = R.sample(CATS[cat], k)
    q = pick(R, [f'{k} wata {cat} ko naam bhannus.', f'malai {k} wata {cat} bhana na.', f'{cat} ka {k} wata udaharan dinus.'])
    return ex(q, f'{k} wata {cat}: {", ".join(items)}.', items[0], 'list')


def antonym(R):
    a, b = pick(R, ANTONYM)
    if R.random() < 0.5:
        a, b = b, a
    return ex(pick(R, [f'"{a}" ko ulto artha k ho?', f'{a} ko bipariarthi shabda bhannus.', f'opposite of {a}?']),
              f'"{a}" ko ulto "{b}" ho.', b, 'vocab')


def context_compare(R):
    it = R.sample(['syau', 'suntala', 'kera', 'aanp', 'kalam', 'kitab'], 2)
    a, b = R.randint(1, 30), R.randint(1, 30)
    if a == b:
        b += 1
    more = it[0] if a > b else it[1]
    q = f'mero jhola ma {a} wata {it[0]} ra {b} wata {it[1]} chhan. kun chai dherai chha, ra kati le?'
    return ex(q, f'{more} dherai chha, {abs(a - b)} le.', more, 'context',
              f'{it[0]} {a}, {it[1]} {b}. {max(a, b)} - {min(a, b)} = {abs(a - b)}.')


def one_word(R):
    pairs = [('nepal ko rajdhani', 'kathmandu'), ('sansar ko sabai bhanda aglo himal', 'sagarmatha'), ('nepal ko rashtriya phool', 'lali gurans'),
             ('nepal ko rashtriya chara', 'danfe'), ('buddha ko janmasthal', 'lumbini'), ('hapta ko pahilo din', 'aaitabar'),
             ('nepal ko mudra', 'rupiya'), ('nik lai banaune manchhe', 'nikit hamal')]
    s, a = pick(R, pairs)
    return ex(pick(R, [f'ek shabda ma jawaf dinus: {s} k ho?', f'chhoto ma bhannus, {s}?', f'only one word: {s}?']), f'{a}.', a, 'format')


def multi_turn_memory(R):
    n, f, p = pick(R, NAMES), pick(R, FOODS), pick(R, PLACES)
    m = [{'role': 'user', 'content': f'namaste! mero naam {n} ho.'},
         {'role': 'nik', 'content': f'namaste {n}! k chha? aaja k kura garne?'},
         {'role': 'user', 'content': f'ma {p} ma baschhu ra malai {f} khana dherai man parchha.'},
         {'role': 'nik', 'content': f'wah, {p} ramro thau ho! {f} ta mitho hunchha.'}]
    k = R.random()
    if k < 0.34:
        m += [{'role': 'user', 'content': 'mero naam yaad chha?'}, {'role': 'nik', 'content': f'ho, tapai ko naam {n} ho.'}]
        g = n
    elif k < 0.67:
        m += [{'role': 'user', 'content': 'ma kaha baschhu bhaneko thiye?'}, {'role': 'nik', 'content': f'tapai le {p} ma baschhu bhannu bhayo.'}]
        g = p
    else:
        m += [{'role': 'user', 'content': 'malai k khana man parchha?'}, {'role': 'nik', 'content': f'tapailai {f} man parchha.'}]
        g = f
    return {'kind': 'memory', 'gold': g, 'messages': m}


FAMILIES = [(recall, 3), (intro_reply, 1.5), (story_qa, 3), (translate, 2.5), (word_meaning, 1.5), (grammar, 2.5), (past_tense, 1),
            (text_ops, 2.5), (list_items, 1.5), (antonym, 1.5), (context_compare, 1.5), (one_word, 1), (multi_turn_memory, 2)]


def sample(R):
    f = R.choices([f for f, _ in FAMILIES], weights=[w for _, w in FAMILIES])[0]
    e = f(R)
    if 'messages' in e:
        return e
    msg = {'role': 'nik', 'content': e['a']}
    if e.get('think'):
        msg['think'] = e['think']
    return {'kind': e['kind'], 'gold': e['gold'], 'messages': [{'role': 'user', 'content': e['q']}, msg]}
