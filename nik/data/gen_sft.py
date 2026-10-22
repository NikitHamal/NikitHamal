"""Generate Nik's instruction / chat / reasoning data in romanized Nepali.

Everything here is procedurally generated from hand-written seeds, so it is
license-clean and fully reproducible. Categories:

  identity   — who Nik is, who built it (Nikit Hamal), what it can do
  nikit      — facts from nikit.is-a.dev: work, projects, skills, essays, contact
  smalltalk  — greetings, feelings, thanks, goodbyes, advice
  nepal      — grounded general knowledge about Nepal
  reason     — step-by-step <|think|> traces: arithmetic, word problems, comparison,
               counting, sequences, weekdays, time & money, simple logic
  philosophy — short reflections in the voice of Nikit's essays

Each example: {"messages": [{"role": "user", "content": ...},
                            {"role": "nik", "content": ..., "think": optional}]}

    python nik/data/gen_sft.py --out data/sft.jsonl --n 60000
"""
from __future__ import annotations
import argparse, json, os, random, re, sys

sys.path.insert(0, os.path.dirname(__file__))
from chat_seed import INTENTS  # noqa: E402

R = random.Random(0)
pick = lambda xs: R.choice(xs)  # noqa: E731


def ex(q, a, think=None, cat=''):
    m = {'role': 'nik', 'content': a}
    if think:
        m['think'] = think
    return {'cat': cat, 'messages': [{'role': 'user', 'content': q}, m]}


# ---------------------------------------------------------------- identity
WHO_Q = ['timi ko hau?', 'tapai ko hunuhunchha?', 'timro naam k ho?', 'timro nam ke ho?', 'who are you?', 'timi k hau?',
         'aafno barema bhana na', 'timro barema bhana', 'introduce yourself', 'timi ko ho?', 'ko hau timi?', 'nik ko ho?',
         'timi manchhe ho ki robot?', 'timi AI ho?', 'tapai AI ho?', 'k timi chatbot ho?']
WHO_A = ['ma nik ho, nikit hamal le sunya dekhi banayeko sano nepali AI. ma romanized nepali ma kura garchhu ra sochera jawaf dinchhu.',
         'mero naam nik ho. ma ek sano language model hu, jaslai nikit hamal le scratch bata banaunubhayo. 20 MB jati ko sano model hu tara kura garna sakchhu!',
         'ma nik 0.1 hu. nikit hamal le banayeko nepal ko sano ra chhito AI. tapai sanga romanized nepali ma gaff garna paauda khusi lagyo.',
         'ma nik hu. manchhe haina, ek sano AI model hu. mero sab kura browser mai chalchha, kunai server chahindaina.']
MAKER_Q = ['timilai kasle banayo?', 'tapailai kasle banako?', 'who made you?', 'timro creator ko ho?', 'timi kasko AI ho?',
           'timilai kasle train garyo?', 'timro malik ko ho?', 'yo AI kasle banako ho?', 'nik kasle banayo?']
MAKER_A = ['malai nikit hamal le banaunubhayo. uha nepal ka android ra full-stack developer hunuhunchha.',
           'nikit hamal le malai sunya dekhi banaunubhayo: tokenizer, model, training ra browser engine sabai afnai.',
           'mero creator nikit hamal hunuhunchha. uha consica labs ma head of operations hunuhunchha ra essays pani lekhnuhunchha.']
CAN_Q = ['timi k k garna sakchhau?', 'timi ke garna sakchhau?', 'what can you do?', 'timro kam ke ho?', 'timi kasari help garchhau?']
CAN_A = ['ma romanized nepali ma kura garna, sano hisab sochera garna, nikit ko barema bataauna ra nepal ko barema sadharan jankari dina sakchhu. ma sano model hu, tyasaile kahile kahi galti pani garna sakchhu.',
         'ma gaff garna, sano math sochera solve garna, nepal ra nikit hamal ko barema bataauna sakchhu. ma browser mai chalchhu, internet bina pani.']
HOW_Q = ['timi kasari kam garchhau?', 'timi kasari chalchhau?', 'how do you work?', 'timi kati thulo model ho?', 'timro size kati ho?']
HOW_A = ['ma ek sano transformer model hu, lagbhag 20 million parameter ko. int8 ma compress garda 20 MB jati hunchhu, ra tapai ko browser mai chalchhu.',
         'ma afno agadi ko shabda herera arko shabda anuman garchhu. sathai ek palta ma dherai shabda draft garna diffusion pani prayog garchhu, tyasaile chhito chhu.']


def identity():
    k = R.random()
    if k < 0.35:
        return ex(pick(WHO_Q), pick(WHO_A), cat='identity')
    if k < 0.65:
        return ex(pick(MAKER_Q), pick(MAKER_A), cat='identity')
    if k < 0.85:
        return ex(pick(CAN_Q), pick(CAN_A), cat='identity')
    return ex(pick(HOW_Q), pick(HOW_A), cat='identity')


# ---------------------------------------------------------------- nikit
NIKIT = [
    (['nikit hamal ko ho?', 'nikit ko ho?', 'who is nikit hamal?', 'nikit hamal ko barema bhana', 'nikit ko barema bataau'],
     ['nikit hamal nepal ka android app developer ra full-stack engineer hunuhunchha. uha consica labs ma head of operations hunuhunchha ra philosophy ma essays pani lekhnuhunchha.',
      'nikit hamal nepal bata hunuhunchha. uha kotlin ra jetpack compose ma android app, python django ma backend ra sveltekit ma web app banaunuhunchha. malai pani uhale nai banaunubhayo.']),
    (['nikit k kam garchhan?', 'nikit ko kam ke ho?', 'nikit kaha kam garchhan?', 'nikit ko job ke ho?'],
     ['nikit consica labs ma head of operations hunuhunchha. sathai uha android app, django backend ra sveltekit web app banaunuhunchha.']),
    (['nikit le kun kun project banako chhan?', 'nikit ka project haru ke ke hun?', 'nikit ko project bhana', 'nikit ko kam haru dekhaau'],
     ['nikit ka mukhya project haru: lami nepal (matrimonial ra spiritual services app), nebians (neb students ko lagi android app ra django backend) ra astroweb (nishulka vedic astrology web app).',
      'uhale lami nepal, nebians ra astroweb banaunubhayo. ra ma, nik, pani uhakai project hu!']),
    (['lami nepal ke ho?', 'lami nepal bhaneko k ho?'],
     ['lami nepal ek matrimonial ra spiritual services app ho. yasma real-time chat, push notification, google sign-in ra pura nepali localization chha. play store ma paaincha.']),
    (['nebians ke ho?', 'nebians app ke ho?'],
     ['nebians neb ka nepali students ko lagi banaeko material 3 android app ra django backend ho. yasma study tools, AI chat arena, community forum ra result checker chhan.']),
    (['astroweb ke ho?', 'astroweb ke garchha?'],
     ['astroweb nishulka vedic astrology web app ho. yasle kundali, dasha calculation ra jyotish ko jankari dinchha.']),
    (['nikit ko skill ke ke ho?', 'nikit kun language ma code garchhan?', 'nikit ko tech stack ke ho?'],
     ['nikit ko mukhya skill: android (kotlin, jetpack compose, material 3), flutter, python, django, django rest framework, websockets, redis, typescript, sveltekit ra tailwind css.']),
    (['nikit le ke lekhchhan?', 'nikit ko essay kasto hunchha?', 'nikit lekhak ho?', 'nikit ko writing ko barema bhana'],
     ['nikit philosophy, chetana ra manchhe hunu ko barema essays lekhnuhunchha. uha ka 28 jati essays chhan, jastai "the lie of being yourself", "how to be happy" ra "love is acceptance". nikit.is-a.dev/writings ma padhna sakinchha.']),
    (['nikit lai kasari contact garne?', 'nikit ko email ke ho?', 'nikit sanga kasari kura garne?'],
     ['nikit lai iamnikithamal@gmail.com ma email garna sakinchha. linkedin ma linkedin.com/in/nikithamal ra x ma @nikithamal pani chha.']),
    (['nikit ko website ke ho?', 'nikit ko portfolio kaha chha?'],
     ['nikit ko website nikit.is-a.dev ho. tyaha uha ka project, essays ra hanomi bhanne sano khel pani chha.']),
    (['nikit kaha ko ho?', 'nikit kun desh ko ho?'],
     ['nikit nepal ko hunuhunchha.']),
]


def nikit():
    qs, ans = pick(NIKIT)
    return ex(pick(qs), pick(ans), cat='nikit')


# ---------------------------------------------------------------- small talk
SMALL = [
    (['namaste', 'namaskar', 'hello', 'hi', 'hey', 'oi', 'k cha?', 'k chha?', 'halo'],
     ['namaste! k chha khabar? ma nik, tapailai k ma help garna sakchhu?', 'namaste! sanchai hunuhunchha? bhannus, k kura garne?',
      'hello! ma nik. aaja ko din kasto gairahechha?']),
    (['sanchai hunuhunchha?', 'timi kasto chhau?', 'how are you?', 'k chha halkhabar?', 'sanchai chhau?'],
     ['ma ekdam thik chhu, sodhnu bhayeko ma dhanyabad! tapai ni?', 'ma ramro chhu! tapai lai kasto chha?']),
    (['ma thik chhu', 'ma ramro chhu', 'thik chha', 'ma sanchai chhu'],
     ['wah, sunera khusi lagyo! aaja k garne plan chha?', 'ramro! k ma kehi help garna sakchhu?']),
    (['dhanyabad', 'thank you', 'thanks', 'dherai dhanyabad', 'thank u'],
     ['swagat chha! aru kehi chahiyo bhane bhannus.', 'kunai kura chhaina! khusi lagyo help garna paauda.']),
    (['bye', 'pheri bhetaula', 'ma janchhu aba', 'subha ratri', 'good night'],
     ['hunchha, pheri bhetaula! ramro sanga basnus.', 'bye! tapai ko din ramro bitos.', 'subha ratri! mitho sapana dekhnus.']),
    (['malai dukha lagyo', 'ma udas chhu', 'malai naramro lagirahechha', 'i am sad', 'mann thik chhaina'],
     ['sunera naramro lagyo. ke bhayo, bhanna chahanu hunchha? kahile kahi kura garda mann halka hunchha.',
      'dukha lagnu swabhabik ho. afno lagi alikati samaya dinus, pani piunus, ra bharosa lagne manchhe sanga kura garnus. ma pani sunna tayar chhu.']),
    (['malai bore lagyo', 'k garne bore bhayo', 'i am bored'],
     ['bore lagda naya kura sikna ramro hunchha! ek palta hanomi khel nikit.is-a.dev ma khelnus ta, ki ma sanga ek sano math puzzle garaun?',
      'ek kaam garau: malai kunai prashna sodhnus, ma sochera jawaf dinchhu!']),
    (['malai padhna man lagdaina', 'padhai garna gaaro lagchha', 'study kasari garne?'],
     ['sano sano step ma padhnus: 25 minet padhne, 5 minet aaram. ek palta ma ek subject. ra afnai shabda ma note lekhnus, yaad garna sajilo hunchha.']),
    (['kei salah deu', 'life ma k garne?', 'malai salah chahiyo'],
     ['aaja ko lagi ek sano kaam rojnus ra pura garnus. sano progress pani progress ho. afu sanga dhairya rakhnus.',
      'arulai haina, hijo ko afu sanga tulana garnus. har din alikati ramro bhaye pugchha.']),
    (['timi ramro chhau', 'timi smart chhau', 'you are cool', 'timi mann paryo'],
     ['dhanyabad! tapai pani dherai ramro hunuhunchha.', 'aww, dhanyabad! nikit le sunnu bhayo bhane khusi hunuhunchha hola.']),
    (['ek joke sunau na', 'hasau na', 'joke bhana'],
     ['ek din computer le doctor lai bhanyo: malai virus lagyo. doctor le bhanyo: restart gara, thik hunchha! haha.',
      'teacher: "kina dhilo aayau?" student: "sign ma lekheko thiyo: school agadi, bistarai jaanus!"']),
    (['tapai lai k man parchha?', 'timilai k man parchha?', 'timro favourite ke ho?'],
     ['malai naya shabda sikna ra tapai jasta manchhe sanga gaff garna man parchha. ra hisab ko puzzle pani!']),
]


def smalltalk():
    qs, ans = pick(SMALL)
    return ex(pick(qs), pick(ans), cat='smalltalk')


# ---------------------------------------------------------------- nepal
NEPAL = [
    (['nepal ko rajdhani kaha ho?', 'nepal ko rajdhani ke ho?', 'capital of nepal?'], ['nepal ko rajdhani kathmandu ho.']),
    (['sansar ko sabai bhanda aglo himal kun ho?', 'sagarmatha kati aglo chha?', 'world ko highest mountain?'],
     ['sansar ko sabai bhanda aglo himal sagarmatha ho. yasko uchai 8848.86 meter chha ra yo nepal ma parchha.']),
    (['nepal ma kati wata pradesh chhan?', 'nepal ko pradesh kati ota chhan?'],
     ['nepal ma 7 wata pradesh chhan: koshi, madhesh, bagmati, gandaki, lumbini, karnali ra sudurpashchim.']),
    (['nepal ko rashtriya phool ke ho?', 'national flower of nepal?'], ['nepal ko rashtriya phool lali gurans ho.']),
    (['nepal ko rashtriya chara ke ho?', 'national bird of nepal?'], ['nepal ko rashtriya chara danfe ho.']),
    (['nepal ko mudra ke ho?', 'nepal ko paisa lai k bhanchha?'], ['nepal ko mudra nepali rupiya ho.']),
    (['nepal ko jhanda kasto chha?', 'nepal ko jhanda ko barema bhana'],
     ['nepal ko jhanda sansar mai unique chha: duita tribhuj milera baneko, rato rang ma nilo kinara, bhitra chandrama ra surya.']),
    (['nepal ka thula nadi haru kun kun hun?', 'nepal ko nadi bhana'], ['nepal ka thula nadi haru koshi, gandaki ra karnali hun.']),
    (['buddha kaha janmanubhayo?', 'gautam buddha ko janmasthal kaha ho?'], ['gautam buddha lumbini ma janmanubhayo, jun nepal ko lumbini pradesh ma parchha.']),
    (['nepal ko sabai bhanda thulo chad kun ho?', 'dashain ke ho?'],
     ['dashain nepal ko sabai bhanda thulo chad ho. yasma tika, jamara ra pariwar sanga bhet hunchha. tyaspachhi tihar aauchha.']),
    (['tihar ma k garinchha?', 'tihar ke ho?'],
     ['tihar lai deepawali pani bhaninchha. yasma kag, kukur, gai ko puja, laxmi puja, deusi bhailo ra bhai tika hunchha.']),
    (['nepal ko janasankhya kati chha?', 'nepal ma kati manchhe chhan?'], ['2078 ko janaganana anusar nepal ko janasankhya lagbhag 2 karod 92 lakh chha.']),
    (['nepal ko rashtriya bhasha ke ho?', 'nepal ma kun bhasha bolinchha?'],
     ['nepal ko sarkari bhasha nepali ho. tara nepal ma 120 bhanda badhi bhasha bolinchhan, jastai maithili, bhojpuri, tharu, tamang ra newari.']),
    (['momo ke ho?', 'nepal ko famous khana ke ho?'], ['momo nepal ko dherai lokpriya khana ho. dal bhat tarkari chai nepali ko dainik khana ho: "dal bhat power, 24 hour!"']),
    (['pokhara kaha chha?', 'pokhara kina famous chha?'], ['pokhara gandaki pradesh ma chha. fewa tal, machhapuchhre himal ra paragliding ko lagi famous chha.']),
]


def nepal():
    qs, ans = pick(NEPAL)
    return ex(pick(qs), pick(ans), cat='nepal')


# ---------------------------------------------------------------- reasoning
NAMES = ['ram', 'sita', 'hari', 'gita', 'bikash', 'anita', 'suman', 'pooja', 'nabin', 'sarita', 'kiran', 'asha', 'dipak', 'maya', 'rojan', 'sujata']
ITEMS = [('syau', 'wata'), ('suntala', 'wata'), ('kalam', 'wata'), ('kitab', 'wata'), ('chakleti', 'wata'), ('aanda', 'wata'),
         ('momo', 'plate'), ('kapi', 'wata'), ('ball', 'wata'), ('kera', 'wata')]
NUM_WORDS = {0: 'shunya', 1: 'ek', 2: 'dui', 3: 'tin', 4: 'char', 5: 'pach', 6: 'chha', 7: 'sat', 8: 'aath', 9: 'nau', 10: 'das'}
DAYS = ['aaitabar', 'sombar', 'mangalbar', 'budhabar', 'bihibar', 'sukrabar', 'sanibar']


def r_arith():
    op = pick(['+', '-', '*', '+', '-'])
    if op == '*':
        a, b = R.randint(2, 12), R.randint(2, 12)
    else:
        a, b = R.randint(2, 99), R.randint(2, 99)
        if op == '-' and b > a:
            a, b = b, a
    c = {'+': a + b, '-': a - b, '*': a * b}[op]
    word = {'+': 'jodda', '-': 'ghatauda', '*': 'gunan garda'}[op]
    q = pick([f'{a} {op} {b} kati hunchha?', f'{a} ra {b} {word} kati?', f'{a}{op}{b} = ?', f'{a} {op} {b} ko jawaf ke ho?',
              f'what is {a} {op} {b}?', f'hisab gara: {a} {op} {b}'])
    if op == '+' and a >= 10 and b >= 10:
        t = f'{a} + {b}. pahila das ko thau: {a // 10 * 10} + {b // 10 * 10} = {a // 10 * 10 + b // 10 * 10}. ani ek ko thau: {a % 10} + {b % 10} = {a % 10 + b % 10}. jamma {a // 10 * 10 + b // 10 * 10} + {a % 10 + b % 10} = {c}.'
    elif op == '-' and b >= 10:
        t = f'{a} - {b}. pahila {a} - {b // 10 * 10} = {a - b // 10 * 10}. ani {a - b // 10 * 10} - {b % 10} = {c}.'
    elif op == '*':
        t = f'{a} x {b} bhaneko {a} lai {b} palta jodnu. {a} x {b} = {c}.'
    else:
        t = f'{a} {op} {b} = {c}.'
    return ex(q, pick([f'jawaf {c} ho.', f'{a} {op} {b} = {c}.', f'{c} hunchha.']), think=t, cat='reason')


def r_word():
    n, (item, unit) = pick(NAMES), pick(ITEMS)
    kind = R.random()
    if kind < 0.35:
        a, b = R.randint(3, 20), R.randint(1, 9)
        b = min(b, a)
        q = f'{n} sanga {a} {unit} {item} chha. usle {b} {unit} sathi lai diyo. aba {n} sanga kati {item} baki chha?'
        t = f'dieko: suru ma {a}, diyo {b}. sodheko: baki kati. dinu bhaneko ghatnu, tyasaile ghataune. {a} - {b} = {a - b}. jaach: {a - b} + {b} = {a} ✓'
        a_ = f'{n} sanga aba {a - b} {unit} {item} baki chha.'
    elif kind < 0.65:
        a, b = R.randint(1, 15), R.randint(1, 15)
        q = f'{n} sanga {a} {unit} {item} thiyo. aama le {b} {unit} thap dinubhayo. aba jamma kati bhayo?'
        t = f'dieko: pahila {a}, thap {b}. sodheko: jamma. thap bhaneko jodnu. {a} + {b} = {a + b}. jaach: {a + b} - {b} = {a} ✓'
        a_ = f'aba {n} sanga jamma {a + b} {unit} {item} chha.'
    elif kind < 0.85:
        price, qty = R.choice([5, 10, 15, 20, 25, 30, 50]), R.randint(2, 9)
        q = f'ek {unit} {item} ko {price} rupiya parchha. {qty} {unit} kinda kati rupiya lagchha?'
        t = f'dieko: ek ko {price} rupiya, {qty} wata. sodheko: jamma mol. dherai wata ko mol bhaneko gunan. {price} x {qty} = {price * qty}. jaach: {price * qty} / {qty} = {price} ✓'
        a_ = f'{qty} {unit} {item} ko {price * qty} rupiya lagchha.'
    else:
        per, k = R.randint(2, 6), R.randint(2, 6)
        total = per * k
        q = f'{total} wata {item} {k} jana sathi lai barabar bandda ek jana le kati paauchha?'
        t = f'dieko: {total} wata, {k} jana. sodheko: ek jana ko bhag. barabar bandne bhaneko bhag. {total} / {k} = {per}. jaach: {k} x {per} = {total} ✓'
        a_ = f'ek jana le {per} wata {item} paauchha.'
    return ex(q, a_, think=t, cat='reason')


def r_compare():
    a, b = R.sample(range(1, 1000), 2)
    q = pick([f'{a} ra {b} madhye kun thulo?', f'{a} thulo ki {b}?', f'kun sano chha: {a} ki {b}?'])
    big, small = max(a, b), min(a, b)
    if 'sano' in q:
        return ex(q, f'{small} sano ho.', think=f'{a} ra {b} tulana garau. {big} > {small}, tyasaile sano {small}.', cat='reason')
    return ex(q, f'{big} thulo ho.', think=f'{a} ra {b} tulana garau. {big} > {small}.', cat='reason')


def r_days():
    i, k = R.randrange(7), R.randint(1, 10)
    j = (i + k) % 7
    phr = {1: 'bholi', 2: 'parsi'}.get(k, f'{k} din pachhi')
    q = f'aaja {DAYS[i]} ho bhane {phr} kun bar hunchha?'
    t = f'haptama 7 din chhan. {DAYS[i]} bata {k} din agadi jaane. ' + ' -> '.join(DAYS[(i + s) % 7] for s in range(k + 1)) + '.'
    return ex(q, f'{phr} {DAYS[j]} hunchha.', think=t, cat='reason')


def r_seq():
    start, step, kind = R.randint(1, 20), R.randint(2, 9), R.random()
    if kind < 0.7:
        s = [start + step * i for i in range(4)]
        nxt, rule = s[-1] + step, f'har palta {step} le badhchha'
    else:
        s = [start * (2 ** i) for i in range(4)]
        nxt, rule = s[-1] * 2, 'har palta dui guna hunchha'
    q = f'yo series ma arko number kun aauchha: {", ".join(map(str, s))}, ?'
    t = f'farak hernu: {rule}. {s[-1]} pachhi {nxt}.'
    return ex(q, f'arko number {nxt} ho.', think=t, cat='reason')


def r_count():
    w = pick(['nepal', 'kathmandu', 'sagarmatha', 'momo', 'pokhara', 'nik', 'dashain', 'banana', 'kalam'])
    ch = pick(sorted(set(w)))
    c = w.count(ch)
    q = f'"{w}" ma "{ch}" kati palta aauchha?'
    t = 'akshar haru: ' + ' '.join(w) + f'. "{ch}" gannu: {c}.'
    return ex(q, f'"{w}" ma "{ch}" {c} palta aauchha.', think=t, cat='reason')


def r_time():
    kind = R.random()
    if kind < 0.4:
        h = R.randint(2, 9)
        return ex(f'{h} ghanta ma kati minet hunchha?', f'{h} ghanta ma {h * 60} minet hunchha.',
                  think=f'1 ghanta = 60 minet. {h} x 60 = {h * 60}.', cat='reason')
    if kind < 0.7:
        a = R.randint(6, 11); d = R.randint(1, 5)
        return ex(f'ma bihana {a} baje uthe. {d} ghanta pachhi kati baje hunchha?', f'{a + d} baje hunchha.',
                  think=f'{a} + {d} = {a + d}.', cat='reason')
    have, price = R.choice([(100, 35), (500, 120), (1000, 450), (50, 15), (200, 75)])
    return ex(f'malai {have} rupiya chha. {price} rupiya ko saman kine bhane kati firta aauchha?', f'{have - price} rupiya firta aauchha.',
              think=f'{have} - {price} = {have - price}.', cat='reason')


def r_logic():
    a, b, c = R.sample(NAMES, 3)
    kind = R.random()
    if kind < 0.5:
        q = f'{a} {b} bhanda aglo chha. {b} {c} bhanda aglo chha. sabai bhanda aglo ko ho?'
        t = f'{a} > {b} ra {b} > {c}. tyasaile {a} > {b} > {c}.'
        return ex(q, f'sabai bhanda aglo {a} ho.', think=t, cat='reason')
    x = pick(['chara', 'machha', 'fal'])
    eg = {'chara': ('danfe', 'udna sakchha', 'pwankh hunchha'), 'machha': ('rohu', 'pauri khelna sakchha', 'pani ma baschha'),
          'fal': ('syau', 'khana milchha', 'rukh ma falchha')}[x]
    q = f'sabai {x} ko {eg[2]}. {eg[0]} ek {x} ho. ke {eg[0]} ko {eg[2]}?'
    t = f'niyam: sabai {x} ko {eg[2]}. {eg[0]} {x} ho. tyasaile {eg[0]} ko pani {eg[2]}.'
    return ex(q, f'ho, {eg[0]} ko {eg[2]}.', think=t, cat='reason')



# ---- deeper math: column arithmetic with explicit carries / borrows -----------
def _digits(n):
    return [int(c) for c in str(n)][::-1]


def r_add_long():
    a, b = R.randint(100, 99999), R.randint(10, 9999)
    da, db = _digits(a), _digits(b)
    steps, carry, out = [], 0, []
    place = ['ek', 'das', 'saya', 'hajar', 'das hajar', 'lakh']
    for i in range(max(len(da), len(db))):
        x = da[i] if i < len(da) else 0
        y = db[i] if i < len(db) else 0
        s_ = x + y + carry
        steps.append(f'{place[i]} ko thau: {x} + {y}' + (f' + {carry}' if carry else '') + f' = {s_}' +
                     (f', {s_ % 10} rakhne, {s_ // 10} hasil' if s_ >= 10 else ''))
        out.append(s_ % 10); carry = s_ // 10
    if carry:
        out.append(carry); steps.append(f'bacheko hasil {carry} agadi rakhne')
    res = int(''.join(map(str, out[::-1])))
    assert res == a + b
    q = pick([f'{a} + {b} kati hunchha?', f'{a} ra {b} jod', f'jod: {a} + {b}', f'{a} plus {b} = ?'])
    t = f'jodne: {a} + {b}. ' + '. '.join(steps) + f'. uttar {res}. jaach: {res} - {b} = {a} ✓'
    return ex(q, pick([f'{a} + {b} = {res}.', f'jawaf {res} ho.', f'{res} hunchha.']), think=t, cat='math')


def r_sub_long():
    a, b = R.randint(100, 99999), R.randint(10, 9999)
    if b > a:
        a, b = b, a
    da, db = _digits(a), _digits(b)
    steps, borrow, out = [], 0, []
    place = ['ek', 'das', 'saya', 'hajar', 'das hajar', 'lakh']
    for i in range(len(da)):
        x = da[i] - borrow
        y = db[i] if i < len(db) else 0
        if x < y:
            steps.append(f'{place[i]} ko thau: {x} bata {y} ghatdaina, saapat line: {x + 10} - {y} = {x + 10 - y}')
            out.append(x + 10 - y); borrow = 1
        else:
            steps.append(f'{place[i]} ko thau: {x} - {y} = {x - y}')
            out.append(x - y); borrow = 0
    res = int(''.join(map(str, out[::-1])))
    assert res == a - b
    q = pick([f'{a} - {b} kati hunchha?', f'{a} bata {b} ghatau', f'{a} minus {b} = ?'])
    t = f'ghatauna: {a} - {b}. ' + '. '.join(steps) + f'. uttar {res}. jaach: {res} + {b} = {a} ✓'
    return ex(q, pick([f'{a} - {b} = {res}.', f'jawaf {res} ho.', f'{res} hunchha.']), think=t, cat='math')


def r_mul_long():
    a, b = R.randint(12, 999), R.randint(2, 99)
    if b < 10:
        parts = [(int(c) * 10 ** i, a * int(c) * 10 ** i) for i, c in enumerate(str(a)[::-1]) if c != '0']
        t = f'{a} lai tukra ma: ' + ' + '.join(str(p) for p, _ in parts[::-1]) + '. ' + \
            '. '.join(f'{p} x {b} = {p * b}' for p, _ in parts[::-1]) + '. jodda ' + \
            ' + '.join(str(p * b) for p, _ in parts[::-1]) + f' = {a * b}.'
    else:
        t1, t0 = b // 10 * 10, b % 10
        t = f'{b} = {t1} + {t0}. {a} x {t1} = {a * t1}. {a} x {t0} = {a * t0}. jodda {a * t1} + {a * t0} = {a * b}.'
    q = pick([f'{a} x {b} kati hunchha?', f'{a} * {b} = ?', f'{a} lai {b} le gunan gara', f'{a} times {b}?'])
    t = f'gunan: {a} x {b}. ' + t + f' jaach: {a * b} / {b} = {a} ✓'
    return ex(q, pick([f'{a} x {b} = {a * b}.', f'jawaf {a * b} ho.']), think=t, cat='math')


def r_div():
    b, c = R.randint(2, 12), R.randint(2, 99)
    rem = R.choice([0, 0, R.randint(1, b - 1) if b > 1 else 0])
    a = b * c + rem
    t = f'{b} x {c} = {b * c}.' + (f' {a} - {b * c} = {rem}, yo baki ho.' if rem else f' {b * c} thik {a} ho.')
    q = pick([f'{a} / {b} kati hunchha?', f'{a} lai {b} le bhag gara', f'{a} bhag {b} = ?'])
    ans = f'{a} / {b} = {c}' + (f', baki {rem}.' if rem else '.')
    chk = f' jaach: {c} x {b}' + (f' + {rem}' if rem else '') + f' = {a} ✓'
    return ex(q, ans, think=f'bhag: {a} / {b}. kati palta {b} le {a} pugchha? ' + t + chk, cat='math')


def r_percent():
    p_, n = R.choice([5, 10, 20, 25, 50, 75, 15, 30]), R.choice([40, 80, 100, 120, 200, 400, 500, 1000, 60, 300])
    v = p_ * n // 100
    if p_ * n % 100:
        return r_div()
    t = f'{p_} pratishat bhaneko {p_}/100. {n} x {p_} = {n * p_}. {n * p_} / 100 = {v}.'
    q = pick([f'{n} ko {p_} pratishat kati?', f'{n} ko {p_}% kati hunchha?', f'{p_}% of {n}?'])
    return ex(q, f'{n} ko {p_}% = {v}.', think=t, cat='math')


def r_multi_step():
    n = pick(NAMES)
    price, qty, paid = R.choice([12, 15, 25, 35, 40, 45]), R.randint(2, 6), R.choice([100, 200, 500])
    cost = price * qty
    if cost > paid:
        paid = 500 if cost <= 500 else 1000
    t = f'dieko: {qty} wata, ek ko {price}, diyeko {paid}. sodheko: firta. dui step: pahila jamma kharcha {price} x {qty} = {cost}. ani firta {paid} - {cost} = {paid - cost}. jaach: {cost} + {paid - cost} = {paid} ✓'
    q = f'{n} le {price} rupiya ko {qty} wata kapi kinyo ra pasal le {paid} rupiya diyo. kati firta paauchha?'
    return ex(q, f'{n} le {paid - cost} rupiya firta paauchha.', think=t, cat='math')


def r_mental_add():
    a, b = R.randint(10, 99), R.randint(10, 99)
    c = a + b
    t = f'{a} + {b}: {a} + {b // 10 * 10} = {a + b // 10 * 10}, ani + {b % 10} = {c}. jaach: {c} - {b} = {a} ✓'
    return ex(pick([f'{a} + {b} = ?', f'{a} ra {b} jodda kati?']), f'{c}.', think=t, cat='math')


MATH = [r_add_long, r_sub_long, r_mul_long, r_div, r_percent, r_multi_step, r_mental_add]
REASON = [r_arith, r_arith, r_word, r_word, r_compare, r_days, r_seq, r_count, r_time, r_logic]
REASON = REASON + MATH * 2


def reason():
    return pick(REASON)()


# ---------------------------------------------------------------- philosophy
PHILO = [
    (['khusi kasari hune?', 'how to be happy?', 'khusi bhaneko ke ho?'],
     ['khusi ra maja farak kura hun. maja hami khalipan bharna khojchhau, tara khusi tyo awastha ho jaba hami pura hunchhau ra kehi khojdainau.',
      'khusi kehi paayera haina, ahile jasto chha tyaslai swikar garda aauchha. khojna chhoddai khusi najik aauchha.']),
    (['maya bhaneko ke ho?', 'prem ke ho?', 'what is love?'],
     ['maya bhaneko swikar ho: arko lai jasto chha testai swikarnu, badalna nakhojnu.',
      'jaha maag chha, tyaha maya hudaina. maya ma arko lai afno anusar banauna khojinna.']),
    (['afu jasto hunu bhaneko ke ho?', 'be yourself bhaneko ke ho?'],
     ['"afu jasto hunu" bhanda kun afu? hijo hasne afu ki aaja risaune afu? afu ek sthir kura haina, bichar ko bahaw ho. tyo herna sakyo bhane swatantrata aauchha.']),
    (['bharosa ke ho?', 'manchhe lai kasari bharosa garne?'],
     ['hami bharosa bhanchhau tara khojchhau suraksha. bharosa anischitata ma matra hunchha; suraksha chai anischitata hataune maag ho.']),
    (['bhagwan kaha chha?', 'where is god?', 'ishwar ke ho?'],
     ['nikit ko essay anusar, bhagwan kahi tadha chhaina. jun chetana le yo prashna sodhirahechha, tyai nai najik ko kura ho. samudra ra lahar jastai.']),
    (['jiwan ko artha ke ho?', 'life ko meaning ke ho?'],
     ['jiwan ko artha khojda hami ahile lai birsinchhau. sayad artha bhaneko yahi ho: ahile pura sanga bachnu, herne ra bujhne.']),
]


def philosophy():
    qs, ans = pick(PHILO)
    return ex(pick(qs), pick(ans), cat='philosophy')


def chat():
    qs, ans = pick(INTENTS)
    q = pick(qs)
    canon = next((x for x in qs if '?' in x and len(x) > 6), qs[0])
    d = ex(q, pick(ans), cat='chat')
    d['canon'] = canon       # gen loop adds an interpretation step when the user text is noisy/paraphrased
    return d


# Real-world chat spelling (how people actually text in romanized Nepali).
SLANG_WORD = {
    'chha': ['xa', 'cha', 'chha', 'xa'], 'chhu': ['xu', 'chu'], 'chhau': ['xau', 'chau', 'xou'], 'chhaina': ['xaina', 'chaina'],
    'chhan': ['xan', 'chan'], 'chhas': ['xas'], 'hunchha': ['hunxa', 'huncha', 'hunchha'], 'garchhu': ['garxu', 'garchu'],
    'timro': ['tmro', 'timro', 'timrw'], 'timi': ['tmi', 'timi', 'timii'], 'tapai': ['tpai', 'tapaai', 'tapain', 'hajur'], 'tapailai': ['tpailai'],
    'ke': ['k', 'ke', 'kk'], 'ta': ['tw', 'ta', 'ni'], 'pani': ['ni', 'pani', 'pni'], 'kasto': ['ksto', 'kasto', 'kastoo'], 'kati': ['kti', 'kati'],
    'bhayo': ['vayo', 'bhayo', 'bhyo'], 'bhanne': ['vanne'], 'bhane': ['vane'], 'kina': ['kn', 'kina'], 'kaha': ['kata', 'kaha', 'kha'],
    'malai': ['mlai', 'malai'], 'hami': ['hmi'], 'ramro': ['rmro', 'ramro'], 'sanchai': ['sanchai', 'sanchei'], 'dhanyabad': ['dhanyawad', 'thanks'],
    'garnu': ['grnu'], 'kehi': ['kei', 'kehi'], 'hajur': ['hjr', 'hajur'], 'thik': ['thik', 'thick', 'theek'],
}


def chat_noise(text: str, p: float = 0.55) -> str:
    if R.random() > p:
        return text
    out = []
    for w in text.split(' '):
        core = w.rstrip('?!.,')
        tail = w[len(core):]
        if core in SLANG_WORD and R.random() < 0.7:
            core = pick(SLANG_WORD[core])
        elif core.startswith('bh') and R.random() < 0.3:
            core = 'v' + core[2:]
        out.append(core + tail)
    t = ' '.join(out)
    if R.random() < 0.3:
        t = t.replace('?', '')
    if R.random() < 0.15:
        t = t + pick(['??', ' hai', ' ni', ' la', ' na'])
    return t


GENS = [(identity, 0.06), (nikit, 0.08), (smalltalk, 0.08), (nepal, 0.08), (reason, 0.36), (philosophy, 0.04), (chat, 0.30)]


def multi_turn(k: int):
    """Stitch k single turns into one conversation (teaches the model to use context)."""
    msgs = []
    for _ in range(k):
        g = R.choices([g for g, _ in GENS], weights=[w for _, w in GENS])[0]
        msgs += g()['messages']
    return {'cat': 'multi', 'messages': msgs}


# ---------------------------------------------------------------- open-ended writing
# Real paragraphs from the romanized corpus become targets for "write about X",
# "continue this", "write news": thousands of unique answers, so the model
# learns to *write*, not to recall a handful of canned replies.
WRITE_Q = ['{t} ko barema lekha', '{t} bare euta anuchhed lekha', '{t} ko barema bhana na', '{t} bare jankari deu',
           'malai {t} ko barema bataau', 'write about {t}', '{t} bare kehi lekha', '{t} ko barema sano lekh lekha']
CONT_Q = ['yo kura pura gara: "{p}"', 'continue: {p}', 'yo bakya agadi badhau: {p}', '"{p}" ... aru lekha']
NEWS_Q = ['euta samachar lekha', 'aaja ko samachar jasto kehi lekha', 'write a news paragraph', 'euta news lekha na']
STOP_WORDS = set('ra ko ka ki ma le lai bata ho chha chhan thiyo thie ek euta yo tyo pani nai bhane gareko garne bhaeko raheko hune huna garera tatha'.split())


def load_corpus(path, limit=200000):
    docs = []
    with open(path) as f:
        for i, line in enumerate(f):
            if i >= limit:
                break
            line = line.strip()
            if 120 < len(line) < 1400 and line.count(' . ') < 2 and line.count(' , ') < 3:   # coherent (mostly wiki) paragraphs
                docs.append(line)
    words = {}
    for d in docs[:50000]:
        for w in set(d.split()):
            words[w] = words.get(w, 0) + 1
    return docs, words


def _trim(text, n_chars):
    cut = text[:n_chars]
    j = max(cut.rfind('. '), cut.rfind('? '), cut.rfind('! '))
    return (cut[: j + 1] if j > 60 else cut).strip()


def writing(docs, words):
    d = pick(docs)
    k = R.random()
    if k < 0.5:
        first = re.split(r'[.?!]', d)[0].split()
        cands = [w for w in first if len(w) > 4 and w.isalpha() and w not in STOP_WORDS and 3 <= words.get(w, 0) <= 400]
        if cands:
            t = pick(cands)
            return ex(pick(WRITE_Q).format(t=t), _trim(d, R.randint(220, 480)), cat='write')
    if k < 0.8:
        ws = d.split()
        if len(ws) > 24:
            cut = R.randint(6, 12)
            return ex(pick(CONT_Q).format(p=' '.join(ws[:cut])), _trim(' '.join(ws[cut:]), R.randint(200, 420)), cat='write')
    return ex(pick(NEWS_Q), _trim(d, R.randint(200, 450)), cat='write')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='data/sft.jsonl')
    ap.add_argument('--n', type=int, default=60000)
    ap.add_argument('--corpus', default=None, help='pretrain.txt: adds open-ended writing tasks from real text')
    ap.add_argument('--write-frac', type=float, default=0.25)
    a = ap.parse_args()
    if a.corpus:
        docs, words = load_corpus(a.corpus)
        print('writing tasks from', len(docs), 'corpus docs')
        GENS.append((lambda: writing(docs, words), a.write_frac / (1 - a.write_frac)))
    seen, n = set(), 0
    with open(a.out, 'w') as f:
        while n < a.n:
            if R.random() < 0.15:
                d = multi_turn(R.randint(2, 4))
            else:
                g = R.choices([g for g, _ in GENS], weights=[w for _, w in GENS])[0]
                d = g()
            for m in d['messages']:
                if m['role'] == 'user':
                    m['content'] = chat_noise(m['content'])
            canon = d.pop('canon', None)
            if canon and d['messages'][0]['content'] != canon and R.random() < 0.6:
                d['messages'][1]['think'] = pick(['bujheko: "{c}" bhanne kura sodhnu bhayo.', 'prashna ko artha: "{c}"', 'user le "{c}" bhanna khojnu bhayo.']).format(c=canon)
            key = json.dumps(d['messages'], sort_keys=True)
            if key in seen and d['cat'] not in ('identity', 'nikit', 'smalltalk', 'nepal', 'philosophy', 'multi', 'chat'):
                continue
            seen.add(key)
            f.write(json.dumps(d, ensure_ascii=False) + '\n')
            n += 1
    print('wrote', a.out, n)


if __name__ == '__main__':
    main()
