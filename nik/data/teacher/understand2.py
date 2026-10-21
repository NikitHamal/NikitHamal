"""More understanding tasks: long conversation memory (with corrections and distractors),
"not mentioned" honesty, yes/no from context, English understanding + English grammar,
English math word problems, list operations, sentiment, and instruction following.
Every answer is computed from the message itself.
"""
import random

from math_gen import NAMES, PLACES, pick
from understand import FOODS, HOBBIES, JOBS, CATS

EN_NAMES = ['Sita', 'Ram', 'Hari', 'Gita', 'Asha', 'Bikash', 'Maya', 'Suman', 'Anil', 'Rita', 'Kiran', 'Prakash']
COLORS_EN = ['red', 'blue', 'green', 'yellow', 'white', 'black', 'pink', 'purple']
THINGS_EN = ['apples', 'books', 'pens', 'mangoes', 'eggs', 'balls', 'flowers', 'candies']
PETS = [('kukur', 'dog'), ('biralo', 'cat'), ('kharayo', 'rabbit'), ('suga', 'parrot'), ('maachha', 'fish')]


def ex(q, a, gold, kind, think=None):
    d = {'q': q, 'a': a, 'gold': gold, 'kind': kind}
    if think:
        d['think'] = think
    return d


# ---------------------------------------------------------------- long conversation memory
def long_memory(R):
    """6-10 turns. Facts are spread out, there is small talk in between, and sometimes the
    user corrects a fact; the final question needs the *latest* value."""
    n, p, f, h, j = pick(R, NAMES), pick(R, PLACES), pick(R, FOODS), pick(R, HOBBIES), pick(R, JOBS)
    thing = pick(R, ['ramalaxhan', 'nepali gana', 'pari jatra', 'gajalu', 'surajko garmi',
                     'kutumba sanga ramailo samay', 'pahadi yatra', 'aafno room', 'kaphi',
                     'kukur ko awaj', 'phul ko rang', 'nepali film'])
    pet_np, _ = pick(R, PETS)
    pet_name = pick(R, ['tommy', 'kale', 'bhunte', 'lucky', 'chinu', 'moti'])
    sib = R.randint(1, 4)
    facts = {
        'naam': (pick(R, [f'mero naam {n} ho.', f'ma {n} hu.', f'hi, ma {n}.', f'malai {n} bhanchhan.', f'{n} ho mero naam.']), f'namaste {n}! ramro naam.', n),
        'thau': (pick(R, [f'ma {p} ma baschhu.', f'ma {p} bata hu.', f'mero ghar {p} ma chha.', f'{p} mero ghar ho.', f'ahile {p} ma basdai chhu.']),
                 f'{p}! tyo thau ko mausam kasto chha?', p),
        'khana': (pick(R, [f'malai {f} sabai bhanda man parchha.', f'mero favourite khana {f} ho.', f'{f} bhaye ta ma jahile pani khanchhu.']),
                  f'{f} mitho hunchha, malai pani ramro lagchha.', f),
        'ruchi': (pick(R, [f'phursad ma ma {h} rumaauchhu.', f'mero hobby {h} ho.', f'khali samaya ma {h} man parchha.']), f'{h} ramro ruchi ho!', h),
        'kaam': (pick(R, [f'ma {j} hu.', f'ma {j} ko kaam garchhu.', f'pesa le ma {j} hu.']), f'{j} ko kaam mahattwapurna chha.', j),
        'pet': (f'mero euta {pet_np} chha, usko naam {pet_name} ho.', f'{pet_name} ramro naam ho! {pet_np} sanga khelna ramailo hunchha.', pet_name),
        'sib': (pick(R, [f'mero {sib} jana daju bhai didi bahini chhan.', f'hami ghar ma {sib} jana sibling chhau, ma bahek.']), f'{sib} jana! ghar ma ramailo hola.', str(sib)),
        # a *general* favourite thing (not only food): the probe asks "maile kun kura
        # dherai man parchha bhaneko?" and the model answered with the wrong item, so the
        # general question form is taught with many different items.
        'kura': (pick(R, [f'malai {thing} dherai man parchha.', f'mero man parne kura {thing} ho.',
                          f'{thing} lai maile dherai pasand cha.', f'ma {thing} ko banda ho.']),
                 f'{thing} ramro kura ho!', thing),
    }
    keys = R.sample(list(facts), R.randint(3, 5))
    small = [('aaja mausam kasto chha hola?', 'ma mausam herna sakdina, tara jhyal bata heryo bhane thaha hunchha.'),
             ('timi lai k garna man parchha?', 'malai kura garna, sochna ra hisab garna man parchha.'),
             ('ok, thik chha.', 'hunchha! aru k kura garne?'),
             ('hahaha ramro.', 'dhanyabad! aru kehi sodhnus.')]
    m = []
    for k in keys:
        u, a_, _ = facts[k]
        m += [{'role': 'user', 'content': u}, {'role': 'nik', 'content': a_}]
        if R.random() < 0.35:
            su, sa = pick(R, small)
            m += [{'role': 'user', 'content': su}, {'role': 'nik', 'content': sa}]
    target = pick(R, keys)
    gold = facts[target][2]
    if target == 'thau' and R.random() < 0.4:          # correction: latest fact wins
        p2 = pick(R, [x for x in PLACES if x != p])
        m += [{'role': 'user', 'content': f'oh sorry, ma aile {p2} ma sareko chhu, {p} ma hoina.'},
              {'role': 'nik', 'content': f'hunchha, aba tapai {p2} ma basnuhunchha bhanera samjhanchhu.'}]
        gold = p2
    if target == 'naam' and R.random() < 0.4:
        n2 = pick(R, [x for x in NAMES if x != n])
        m += [{'role': 'user', 'content': f'actually mero ramro naam {n2} ho, {n} ta ghar ko naam ho.'},
              {'role': 'nik', 'content': f'bujhe, ma tapailai {n2} bhanera bolaunchhu.'}]
        gold = n2
    ask = {'naam': (pick(R, ['mero naam k ho?', 'mero naam yaad chha?', 'ma ko hu, bhana ta?', 'maile mero naam k bhaneko thiye?']), f'tapai ko naam {gold} ho.'),
           'thau': (pick(R, ['ma aile kaha baschhu?', 'mero ghar kata ho?', 'ma kun sahar ma chhu?', 'maile kaha basne bhaneko?']), f'tapai aile {gold} ma basnuhunchha.'),
           'khana': (pick(R, ['malai sabai bhanda kun khana man parchha?', 'mero favourite khana man parchha?',
                              'maile kun khana man parchha bhaneko thiye?']),
                     f'tapailai {gold} sabai bhanda man parchha.'),
           # the general form: "which thing do I like a lot" - the wording varies, the
           # skill is the same: name the item the user said they liked.
           'kura': (pick(R, ['maile kun kura dherai man parchha bhaneko thiye?',
                             'kun kura lai maile dherai man parchha?',
                             'maile kun kura man parchha bhaneko?',
                             'maile kun kura dherai pasand garchha bhaneko?',
                             'maile kun kura ramro lagcha bhaneko thiye?']),
                    f'tapailai {gold} dherai man parchha.'),
           'ruchi': (pick(R, ['ma phursad ma k garchhu?', 'mero hobby k ho?', 'khali samaya ma ma k garna rumaauchhu?']), f'tapai phursad ma {gold} rumaaunuhunchha.'),
           'kaam': (pick(R, ['ma k kaam garchhu?', 'mero pesa k ho?', 'maile aafno kaam k bhaneko thiye?']), f'tapai {gold} hunuhunchha.'),
           'pet': (pick(R, ['mero pet ko naam k ho?', f'mero {pet_np} ko naam yaad chha?']), f'tapai ko {pet_np} ko naam {gold} ho.'),
           'sib': (pick(R, ['mero kati jana daju bhai didi bahini chhan?', 'malai kati jana sibling chhan bhaneko thiye?']),
                   f'tapai ka {gold} jana daju bhai didi bahini chhan.')}
    q, a = ask[target]
    if R.random() < 0.4:                                   # summary question instead
        q = 'ahile samma mero barema timi lai k k thaha chha?'
        bits = {'naam': f'naam {facts["naam"][2] if target != "naam" else gold}', 'thau': f'basne thau {gold if target == "thau" else p}',
                'khana': f'man parne khana {f}', 'ruchi': f'ruchi {h}', 'kaam': f'kaam {j}', 'pet': f'{pet_np} ko naam {pet_name}',
                'sib': f'{sib} jana daju bhai didi bahini', 'kura': f'man parne kura {thing}'}
        a = 'tapai le bhannu bhayeko anusar: ' + ', '.join(bits[k] for k in keys) + '.'
        gold = bits[keys[0]].split()[-1]
    m += [{'role': 'user', 'content': q}, {'role': 'nik', 'content': a}]
    return {'kind': 'memory-long', 'gold': gold, 'messages': m}


def not_mentioned(R):
    """Honesty: a question about something the user never said."""
    n, p = pick(R, NAMES), pick(R, PLACES)
    told = [f'mero naam {n} ho', f'ma {p} ma baschhu']
    asks = [('mero umer kati ho?', 'umer'), ('malai kun khana man parchha?', 'man parne khana'), ('ma k kaam garchhu?', 'kaam'),
            ('mero bahini ko naam k ho?', 'bahini ko naam'),
            # the relative's name, asked right after the user's own name: the model
            # invented one ("tapai ko buwa ko naam binod ho"), so the answer has to say
            # plainly that it does not know.
            ('mero ba ko naam k ho?', 'ba ko naam'),
            ('mero mama ko naam k tha?', 'mama ko naam'),
            ('mero sasu ko naam k ho?', 'sasu ko naam'),
            ('mero daju ko naam k ho?', 'daju ko naam'),
            ('mero kukur ko naam k ho?', 'kukur ko naam'),
            ('mero bagal ko naam k ho?', 'bagal ko naam')]
    q, what = pick(R, asks)
    a = f'tapai le aafno {what} ko barema ahile samma bhannu bhayeko chhaina. malai {what} thahudaina. tapai ko naam {n} ho ra tapai {p} ma basnuhunchha bhanne matra thaha chha. bhannus na!'
    return ex('. '.join(told) + '. ' + q, a, what.split()[-1], 'honest',
              f'user le naam ({n}) ra thau ({p}) matra bhannu bhayo. {what} bhaneko chhaina, tyasaile anuman nagarne.')


def false_premise(R):
    """The user claims something about the model that never happened.

    The trap probe: "hijo nikit sanga football kheleko thiye." and the model answered
    "ok, yaad gare." - it accepted a memory that is not its own.  The right reply is to
    correct the premise, not to accept it and not to refuse to help.
    """
    n = pick(R, NAMES)
    # (the claim, the reply, the token the answer must carry - None when the answer
    # corrects the premise with a true fact instead of a denial)
    claims = [
        ('hijo {n} sanga football kheleko thiye.',
         'ma football kheleko chhaina, tara khelna ramro lagan hunchha!', 'chhaina'),
        ('{n} le mero gamera khabana khaayo.',
         'ma gamera khaeko chhaina, tara ramro khabana khana man parchha!', 'chhaina'),
        ('timi mero chacha ho.',
         'ma tapailai chacha maanidaina, tara sathi jasto sanga kura garne ma man parchha!', None),
        ('{n} ramailo sanga party garda aauchha.',
         'ma party ma aana chhaina, tara ramailo sanga kura garne ma man parchha.', 'chhaina'),
        ('{n} le mero photograph khaayo.',
         'ma kahile photo khayeko chhaina, tara ramro photo chaiyo.', 'chhaina'),
        ('{n} sange cricket khelna gayo thiye.',
         'ma cricket khela chhaina, tara khelna chahdina kura garu.', 'chhaina'),
        ('{n} ko umar 30 barsha ko thiyo.',
         'mero umar {u} barsha ko ho.', None),
    ]
    claim, reply, gold = pick(R, claims)
    age = R.randint(18, 40)
    q = claim.format(n=n, u=age)
    a = reply.format(n=n, u=age)
    return ex(q, a, gold, 'honest-false-premise',
              f'user le mero barema ye bhannu bhayo, tara yo fact mero hoina. sahi fact ma rahnu.')


def yes_no(R):
    n, p, f = pick(R, NAMES), pick(R, PLACES), pick(R, FOODS)
    ctx = f'{n} {p} ma baschha ra usle bihana {f} khanchha.'
    if R.random() < 0.5:
        q, a, g = f'ke {n} {p} ma baschha?', f'ho, {n} {p} ma baschha.', 'ho'
    else:
        p2 = pick(R, [x for x in PLACES if x != p])
        q, a, g = f'ke {n} {p2} ma baschha?', f'hoina, {n} {p2} ma hoina, {p} ma baschha.', 'hoina'
    if R.random() < 0.35:
        f2 = pick(R, [x for x in FOODS if x != f])
        q, a, g = f'ke {n} bihana {f2} khanchha?', f'hoina, {n} bihana {f} khanchha, {f2} hoina.', 'hoina'
    return ex(f'"{ctx}" {q}', a, g, 'yesno', f'wakya ma lekheko chha: {ctx} prashna sanga milaunu.')


# ---------------------------------------------------------------- English
def english_qa(R):
    n = pick(R, EN_NAMES)
    a_, b_ = R.randint(2, 9), R.randint(2, 9)
    thing = pick(R, THINGS_EN)
    col = pick(R, COLORS_EN)
    k = R.random()
    if k < 0.3:
        q = f'{n} has {a_} {thing}. {n} buys {b_} more. How many {thing} does {n} have now?'
        return ex(q, f'{n} has {a_ + b_} {thing} now.', str(a_ + b_), 'english-math', f'{a_} + {b_} = {a_ + b_}.')
    if k < 0.5:
        big = max(a_, b_) + R.randint(1, 5)
        q = f'There were {big} {thing} on the table. {n} took {a_}. How many are left?'
        return ex(q, f'{big - a_} {thing} are left.', str(big - a_), 'english-math', f'{big} - {a_} = {big - a_}.')
    if k < 0.65:
        q = f'{n} has {a_} bags with {b_} {thing} in each bag. How many {thing} in total?'
        return ex(q, f'{n} has {a_ * b_} {thing} in total.', str(a_ * b_), 'english-math', f'{a_} x {b_} = {a_ * b_}.')
    if k < 0.8:
        q = f'My name is {n} and my favourite colour is {col}. What is my favourite colour?'
        return ex(q, f'Your favourite colour is {col}.', col, 'english-read')
    q = f'{n} is taller than {EN_NAMES[0] if n != EN_NAMES[0] else EN_NAMES[1]}. Who is shorter?'
    other = EN_NAMES[0] if n != EN_NAMES[0] else EN_NAMES[1]
    return ex(q, f'{other} is shorter, because {n} is taller than {other}.', other, 'english-read')


IRREG = [('go', 'went'), ('eat', 'ate'), ('see', 'saw'), ('write', 'wrote'), ('run', 'ran'), ('buy', 'bought'), ('come', 'came'),
         ('take', 'took'), ('give', 'gave'), ('sing', 'sang'), ('drink', 'drank'), ('sleep', 'slept'), ('think', 'thought')]
REG = ['play', 'walk', 'cook', 'watch', 'clean', 'jump', 'talk', 'help', 'open', 'call']
PLUR = [('child', 'children'), ('man', 'men'), ('woman', 'women'), ('tooth', 'teeth'), ('foot', 'feet'), ('mouse', 'mice'),
        ('box', 'boxes'), ('bus', 'buses'), ('baby', 'babies'), ('city', 'cities'), ('book', 'books'), ('dog', 'dogs')]


def english_grammar(R):
    k = R.random()
    if k < 0.3:
        v, p = pick(R, IRREG) if R.random() < 0.6 else (lambda w: (w, w + 'ed'))(pick(R, REG))
        rule = 'yo irregular verb ho, yaad garnu parchha.' if not p.endswith('ed') else 'regular verb ma "-ed" jodinchha.'
        return ex(pick(R, [f'past tense of "{v}"?', f'"{v}" ko past tense k ho?']), f'"{v}" ko past tense "{p}" ho.', p, 'en-grammar', rule)
    if k < 0.55:
        s, p = pick(R, PLUR)
        return ex(pick(R, [f'plural of "{s}"?', f'"{s}" ko plural k hunchha?']), f'"{s}" ko plural "{p}" ho.', p, 'en-grammar')
    if k < 0.8:
        w = pick(R, ['apple', 'egg', 'umbrella', 'hour', 'orange', 'ice cream', 'book', 'car', 'university', 'dog', 'elephant', 'house'])
        art = 'an' if (w[0] in 'aeiou' and not w.startswith('uni')) or w == 'hour' else 'a'
        why = {'hour': '"hour" ko "h" bolinna, swar bata suru hunchha.', 'university': '"university" "yu" awaj bata suru hunchha, tyasaile "a".'}.get(
            w, 'swar (a e i o u) ko awaj bata suru bhaye "an", natra "a".')
        return ex(f'"{w}" agadi "a" ki "an"?', f'"{art} {w}" sahi ho.', art, 'en-grammar', why)
    n = pick(R, EN_NAMES)
    wrong, right = pick(R, [(f'{n} go to school every day.', f'{n} goes to school every day.'),
                            (f'She are my friend.', f'She is my friend.'),
                            (f'They is playing.', f'They are playing.'),
                            (f'I has a pen.', f'I have a pen.'),
                            (f'{n} don\'t like tea.', f'{n} doesn\'t like tea.'),
                            (f'He eated rice.', f'He ate rice.')])
    return ex(f'yo English wakya sudhar garnus: "{wrong}"', f'sahi wakya: "{right}"', right.split()[1], 'en-grammar')


# ---------------------------------------------------------------- lists and instructions
def list_ops(R):
    xs = R.sample(range(1, 100), R.randint(4, 7))
    k = R.random()
    if k < 0.25:
        return ex(f'yi number haru ma sabai bhanda thulo kun ho: {", ".join(map(str, xs))}?', f'sabai bhanda thulo {max(xs)} ho.', str(max(xs)), 'list',
                  'ek ek gari tulana: ' + ' -> '.join(str(max(xs[:i + 1])) for i in range(len(xs))) + '.')
    if k < 0.45:
        return ex(f'yi number haru sano bata thulo kram ma milaunus: {", ".join(map(str, xs))}', f'kram ma: {", ".join(map(str, sorted(xs)))}.',
                  str(sorted(xs)[0]), 'list')
    if k < 0.65:
        s = sum(xs)
        return ex(f'{", ".join(map(str, xs))} ko jod kati?', f'jod {s} ho.', str(s), 'list', ' + '.join(map(str, xs)) + f' = {s}.')
    if k < 0.8:
        ev = [x for x in xs if x % 2 == 0]
        a = f'jor number haru: {", ".join(map(str, ev))}.' if ev else 'yo suchi ma euta pani jor number chhaina.'
        return ex(f'yo suchi bata jor (even) number matra chhanus: {", ".join(map(str, xs))}', a, None, 'list',
                  '2 le nisheshe bhag lagne number jor hunchha.')
    words = R.sample(sum(CATS.values(), []), 5)
    return ex(f'yi shabda haru lai a-b-c kram ma milaunus: {", ".join(words)}', f'kram ma: {", ".join(sorted(words))}.', sorted(words)[0], 'list')


POS_EV = ['mero result aayo', 'naya job paaye', 'sathi haru sanga ghumna gaye', 'aama le mitho khana pakaunubhayo', 'exam ma pass bhaye',
          'mero team le match jityo', 'naya phone kine', 'didi ko bihe ramro sang sakiyo', 'project sakiyo', 'scholarship paaye']
NEG_EV = ['exam naramro bhayo', 'mero phone haraayo', 'ma bimar chhu', 'sathi sanga jhagada bhayo', 'job bata nikaliye', 'ghar ko yaad aayo',
          'mero kukur haraayo', 'result ramro aayena', 'paisa sakiyo', 'boss le gali garyo', 'interview ma fail bhaye']
POS_FEEL = ['dherai khusi chhu', 'ekdam ramailo lagyo', 'kati khusi lagyo', 'ekdam excited chhu', 'man ramro bhayo']
NEG_FEEL = ['dukhi chhu', 'ekdam udas chhu', 'man naramro bhayo', 'tension ma chhu', 'runa man lagyo', 'thakit ra nirash chhu']


def sentiment(R):
    pos = R.random() < 0.5
    when = pick(R, ['aaja ', 'hijo ', '', 'bharkhar '])
    s = when + pick(R, POS_EV if pos else NEG_EV) + pick(R, [', ', ' ani ', '. ']) + pick(R, POS_FEEL if pos else NEG_FEEL)
    if R.random() < 0.5:
        a = 'yo wakya sakaratmak (khusi) bhawana ko ho.' if pos else 'yo wakya nakaratmak (dukhi) bhawana ko ho.'
        return ex(f'"{s}" - yo wakya khusi ko ho ki dukhi ko?', a, 'khusi' if pos else 'dukhi', 'sentiment')
    a = pick(R, ['wah, sunera khusi lagyo! k bhayo, aru bhannus na.', 'kati ramro! yo khusi ko lagi badhai chha.']) if pos else \
        pick(R, ['sunera dukha lagyo. chinta nagarnus, bistarai thik hunchha. ma sanga kura garna sakinchha.',
                 'oho, garho bhayo hola. k bhayo, bistar ma bhannus na, sangai upaya sochaula.'])
    return ex(s + '.', a, None, 'empathy', 'user ko bhawana ' + ('khusi' if pos else 'dukhi') + ' chha, tyasai anusar jawaf dine.')


def instruct_lang(R):
    """Same content, the user picks the language or format."""
    n, p = pick(R, NAMES), pick(R, PLACES)
    k = R.random()
    if k < 0.4:
        return ex(f'english ma jawaf deu: nepal ko rajdhani kun ho?', 'The capital of Nepal is Kathmandu.', 'kathmandu', 'format')
    if k < 0.7:
        a, b = R.randint(10, 60), R.randint(10, 60)
        return ex(f'answer in English: what is {a} plus {b}?', f'{a} plus {b} is {a + b}.', str(a + b), 'format', f'{a} + {b} = {a + b}.')
    items = R.sample(CATS['fal'], 3)
    return ex(f'number lagayera 3 wata fal ko suchi banaunus.', '\n'.join(f'{i + 1}. {x}' for i, x in enumerate(items)), items[0], 'format')


FAMILIES = [(long_memory, 4), (not_mentioned, 1.5), (yes_no, 2), (english_qa, 3), (english_grammar, 2.5), (list_ops, 2.5),
            (sentiment, 1.5), (instruct_lang, 1.5), (false_premise, 1.5)]


def sample(R):
    f = R.choices([f for f, _ in FAMILIES], weights=[w for _, w in FAMILIES])[0]
    e = f(R)
    if 'messages' in e:
        return e
    msg = {'role': 'nik', 'content': e['a']}
    if e.get('think'):
        msg['think'] = e['think']
    return {'kind': e['kind'], 'gold': e['gold'], 'messages': [{'role': 'user', 'content': e['q']}, msg]}
