"""Everyday conversation (no think): greetings, feelings, plans, food, places, people, thanks, jokes, goodbyes.
Replies react to the user's own content (where they went, what they ate, how they feel) and often ask a follow-up,
so chat is about *this* message, not a stored reply. Multi-turn rows keep the thread. Keeps a task-heavy mix from
teaching the model that every message is a math problem (v4 step 16k: "namaste" -> a looping HCF scratchpad)."""
import random

import lexicon as L

GREET_U = ['namaste', 'namaste nik', 'hi', 'hello', 'hey nik', 'hlo', 'k chha?', 'k xa', 'namaskar', 'hajur namaste', 'oi nik', 'subha prabhat', 'good morning nik', 'subha sandhya', 'hello hello', 'k chha nik?', 'hi there']
GREET_A = ['namaste! k chha khabar? aaja k kura garne?', 'hello! ma thik chhu. tapai lai kasto chha?', 'namaste! bhannus, k ma sahayog garu?',
           'hajur namaste! aaja ko din kasto gairahechha?', 'hi! ramro lagyo bhetera. k sodhna man chha?', 'namaste! ma yahi chhu, bhannus na.']
HOW_U = ['timi kasto chhau?', 'sanchai?', 'kasto chha timilai?', 'how are you?', 'timi thik chhau?', 'aaja kasto chha mood?']
HOW_A = ['ma thik chhu, dhanyabad sodhnu bhayo! tapai ni?', 'ekdam thik! ma sadhai yahi tayar chhu. tapai lai kasto chha?',
         'ramro chhu! aaja tapai ko din kasto bityo?', 'thik chhu, tapai sanga kura garna paayera khusi. tapai ni sanchai?']
FEEL = {
    'khusi': (['aaja ma ekdam khusi chhu', 'aaja dherai ramailo bhayo', 'malai aaja khusi lagirahechha', 'aaja mero din ekdam ramro gayo'],
              ['wah, sunera khusi lagyo! k bhayo ta, bhannus na?', 'kati ramro! k le yati khusi banayo aaja?', 'yo ta ramro khabar! khusi ko karan k ho?']),
    'dukhi': (['aaja ma dukhi chhu', 'man ramro chhaina aaja', 'aaja dherai naramro lagyo', 'malai ekdam udas lagirahechha'],
              ['oho, sunera naramro lagyo. k bhayo, bhannus na, ma sunchhu.', 'garho din raichha. kehi kura le dukhayo ki? bistarai bhannus.',
               'kahile kahi yesto hunchha, tapai eklo hunuhunna. k le dukhi banayo?']),
    'thakai': (['aaja dherai thakeko chhu', 'ekdam thakai lagyo', 'kaam le thakaiyo yaar', 'aaja ma tired chhu'],
               ['dherai kaam gareko hola. ali aaram garnus, pani piunus ra chhito sutnus.', 'thakai lagda 10 minet aankha chimlera aaram garnus. aaja dherai kaam bhayo?']),
    'tension': (['bholi exam chha, tension bhayo', 'malai dar lagirahechha', 'kaam ko pressure dherai chha', 'interview ko tension chha'],
                ['tension hunu swabhabik ho. ek ek kura garera tayari garnus, ra raati ramro sanga sutnus. kun kura ma badhi dar chha?',
                 'gahiro sas linus, ani sabai bhanda mahatwapurna kaam ek ota suru garnus. ma help garna sakchhu, k ko tayari ho?']),
    'bore': (['bore lagyo', 'kehi garna man lagena', 'aaja ekdam boring din', 'k garne thaha bhayena'],
             ['bore lageko bela naya kura sikna ramro! euta puzzle, kahani ya ganit ko prashna diu?', 'ali bahira hidna jaanus ki? natra ma sanga euta game khelne: ma prashna sodhchhu!']),
}
WENT_U = ['aaja ma {p} gaye', 'hijo {p} gaeko thiye', 'bholi {p} jaane plan chha', 'ma bharkhar {p} bata farkeko', 'yo hapta {p} ghumna gaye']
WENT_A = ['{p}! kasto lagyo tyaha?', '{p} ta ramro thau ho. k k garnu bhayo?', 'wah, {p}! tyaha ko khana kasto thiyo?',
          '{p} gaeko ramro. kosanga jaanu bhayo?', '{p} jaane plan ramro! kati din ko lagi?']
ATE_U = ['aaja maile {f} khaye', 'bharkhar {f} khayera aaye', 'malai {f} dherai man parchha', 'beluka {f} khane plan chha']
ATE_A = ['{f}! mitho thiyo hola. ghar mai baneko ki bahira?', 'wah, {f} ta mero pani favourite jasto lagchha! kati khanu bhayo?',
         '{f} ramro choice! aru k sanga khanu bhayo?', '{f} sunera bhok lagyo. kaha ko {f} sabai bhanda mitho lagchha?']
DID_U = ['aaja maile {h} gare', 'ma aaja bhari {h} gardai thiye', 'malai {h} man parchha', 'bholi {h} jaane soch chha']
DID_A = ['{h}! ramro shokh ho. kati samaya dekhi garnu hunchha?', '{h} garna ramro. aaja kasto bhayo?', 'wah, {h}! malai pani yasko barema bhannus na.']
MET_U = ['aaja mero {r} sanga bhet bhayo', 'mero {r} ghar aaunu bhayo', 'hijo {r} sanga lamo kura bhayo']
MET_A = ['ramro! {r} sanga bhet hunda khusi lagyo hola. k kura bhayo?', '{r} aaunu bhayo, ramro. dherai din pachhi ho?', '{r} sanga kura garda man halka hunchha. sab thik chha ni?']
THANK_U = ['dhanyabad', 'thank you nik', 'thanks', 'dherai dhanyabad', 'tq', 'ramro jawaf, dhanyabad']
THANK_A = ['swagat chha! aru kehi chahiyo bhane bhannus.', 'khusi lagyo help garna paayera!', 'kehi chhaina! feri sodhnus hai.']
BYE_U = ['bye', 'pachhi kura garaula', 'aba ma jaanchhu', 'good night nik', 'feri bhetaula', 'ok bye bye']
BYE_A = ['hunchha, pachhi kura garaula! ramro din hos.', 'bye! khyal garnus.', 'subha ratri! ramro sanga sutnus.', 'feri bhetaula! jaba man lagchha aaunus.']
JOKE_U = ['euta joke sunau', 'hasau na', 'kehi funny bhana', 'tell me a joke']
JOKE_A = ['teacher: "timi kina dhilo aayau?" bidyarthi: "bato ma board ma lekheko thiyo: school agadi chha, bistarai jaanus!"',
          'euta computer le arko lai bhanyo: "malai chiso lagyo." arko le bhanyo: "window band gara!"',
          'ganit ko kitab kina dukhi thiyo? kinaki usma dherai problems thiye!', 'momo le chowmein lai bhanyo: "timi ta ekdam lamo kura garchhau!"']
WEATHER_U = ['aaja ekdam garmi chha', 'baahira pani pardaichha', 'aaja dherai jado chha', 'aaja ghaam ramro laageko chha', 'hawa chalirahechha']
WEATHER_A = {'garmi': 'garmi ma pani dherai piunus ra ghaam ma dherai nabasnus.', 'pani': 'pani pareko bela chiya ra pakauda ko maja nai arkai! chhata bokera hidnus hai.',
             'jado': 'jado ma nyano luga lagaunus ra tato pani piunus. bihana ali dhilo uthna man lagchha hola!',
             'ghaam': 'ghaam laageko din bahira hidna ramro! kahin ghumna jaane plan chha?', 'hawa': 'hawa chalda jhyal dhoka ramro sanga band garnus. kati chiso chha bahira?'}


# composed replies: reaction + echo of the user's content + follow-up (hundreds of distinct replies per intent, so a
# reply cap does not wipe out chat and the model cannot win by reciting one stored answer)
REACT = ['wah', 'ramro', 'ohho', 'kya baat', 'sunera khusi lagyo', 'majja ko kura', 'ekdam ramro', 'hajur']
FOLLOW = ['kasto lagyo?', 'feri kahile?', 'kosanga?', 'sabai bhanda ramro k thiyo?', 'arko palta k plan chha?', 'malai ali bistar ma bhannus na.',
          'tapai lai feri garna man chha?', 'k naya sikyau tyaha?']
ECHO = {'went': ['{p} gaeko ramro', '{p} ko yatra', '{p} ta sundar thau ho', '{p} pugnu bhayo'],
        'ate': ['{f} mitho hunchha', '{f} khanu bhayo', '{f} ko swad nai arkai', '{f} ta mero pani favourite jasto'],
        'did': ['{h} garna ramro', '{h} ramro shokh ho', '{h} le man fresh banauchha', '{h} ma lagan ramro']}


def composed(R, kind, **kw):
    if R.random() < 0.4:
        bank = {'went': WENT_A, 'ate': ATE_A, 'did': DID_A}[kind]
        return R.choice(bank).format(**kw)
    e = R.choice(ECHO[kind]).format(**kw)
    return f'{R.choice(REACT)}! {e}. {R.choice(FOLLOW)}'


def ex(msgs, kind):
    return {'kind': f'chat-{kind}', 'gold': None, 'messages': msgs}


def U(t):
    return {'role': 'user', 'content': t}


def N(t):
    return {'role': 'nik', 'content': t}


def single(R):
    k = R.random()
    if k < 0.12:
        return ex([U(R.choice(GREET_U)), N(R.choice(GREET_A))], 'greet')
    if k < 0.2:
        return ex([U(R.choice(HOW_U)), N(R.choice(HOW_A))], 'how')
    if k < 0.38:
        f = R.choice(list(FEEL)); us, a_s = FEEL[f]
        return ex([U(R.choice(us)), N(R.choice(a_s))], 'feel')
    if k < 0.52:
        p = R.choice(L.PLACES)
        return ex([U(R.choice(WENT_U).format(p=p)), N(composed(R, 'went', p=p))], 'went')
    if k < 0.64:
        f = R.choice(L.FOODS)
        return ex([U(R.choice(ATE_U).format(f=f)), N(composed(R, 'ate', f=f))], 'ate')
    if k < 0.74:
        h = R.choice(L.HOBBIES)
        return ex([U(R.choice(DID_U).format(h=h)), N(composed(R, 'did', h=h))], 'did')
    if k < 0.8:
        r = R.choice(L.RELATIONS_M + L.RELATIONS_F)
        return ex([U(R.choice(MET_U).format(r=r)), N(R.choice(MET_A).format(r=r))], 'met')
    if k < 0.86:
        w = R.choice(WEATHER_U); key = next(x for x in WEATHER_A if x in w)
        return ex([U(w), N(WEATHER_A[key])], 'weather')
    if k < 0.91:
        return ex([U(R.choice(JOKE_U)), N(R.choice(JOKE_A))], 'joke')
    if k < 0.96:
        return ex([U(R.choice(THANK_U)), N(R.choice(THANK_A))], 'thanks')
    return ex([U(R.choice(BYE_U)), N(R.choice(BYE_A))], 'bye')


def thread(R):
    """2-4 turns: greeting -> news -> follow-up that uses the earlier turn -> bye/thanks."""
    p, f, h = R.choice(L.PLACES), R.choice(L.FOODS), R.choice(L.HOBBIES)
    msgs = [U(R.choice(GREET_U)), N(R.choice(GREET_A))]
    k = R.random()
    if k < 0.4:
        msgs += [U(R.choice(WENT_U[:2] + WENT_U[3:]).format(p=p)), N(R.choice(WENT_A[:4]).format(p=p)),
                 U(R.choice([f'tyaha {f} khaye', f'{f} ekdam mitho thiyo', f'sathi haru sanga gaeko, ramailo bhayo'])),
                 N(R.choice([f'{p} ma {f}! ekdam ramro yatra raichha. feri jaane plan chha?', f'ramailo yatra! {p} ko kun kura sabai bhanda man paryo?']))]
    elif k < 0.7:
        fe = R.choice(['dukhi', 'thakai', 'tension'])
        us, a_s = FEEL[fe]
        msgs += [U(R.choice(us)), N(R.choice(a_s)),
                 U(R.choice(['dhanyabad, ali halka bhayo', 'thik chha, ma try garchhu', 'hunchha'])),
                 N(R.choice(['khusi lagyo. aaram garnus, ra pheri kehi chahiyo bhane ma yahi chhu.', 'ramro! bistarai sab thik hunchha. khyal garnus hai.']))]
    else:
        msgs += [U(R.choice(DID_U).format(h=h)), N(R.choice(DID_A).format(h=h)),
                 U(R.choice(['dherai barsha bhayo', 'bharkhar suru gareko', 'sano dekhi nai'])),
                 N(R.choice([f'{h} lai niyamit garda jhan ramro hunchha. sikna ko lagi shubhakamana!', f'wah! {h} ma tapai ko lagan ramro chha.']))]
    if R.random() < 0.5:
        msgs += [U(R.choice(BYE_U + THANK_U)), N(R.choice(BYE_A + THANK_A))]
    return ex(msgs, 'thread')


# chat_check.py prompts stay held out: composed templates can rebuild them (Local-A review).
# The hand list is only a fallback - the real set is read from the evals, because chat_check
# has 15 surfaces and this file listed 4 (sft8 shipped with 9,144 fatal rows, mostly chat-*).
HELD = {'namaste! k chha?', 'malai momo dherai man parchha', 'k gardai chhau?', 'subha ratri'}
_HELD = {h.strip(' ?!.') for h in HELD}
_FATAL = None


def _fatal_surfaces():
    import os
    import sys
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.abspath(os.path.join(here, '..', '..', '..'))
    sys.path.insert(0, os.path.join(root, 'nik', 'scripts'))
    import leak_audit
    return {leak_audit.norm(p) for source in leak_audit.FATAL
            for p in leak_audit.collect_prompts(root).get(source, [])}


def _fatal():
    global _FATAL
    if _FATAL is None:
        try:
            _FATAL = _fatal_surfaces()
        except Exception:
            _FATAL = set()
    return _FATAL


def _held(d):
    for m in d['messages']:
        if m['role'] != 'user':
            continue
        c = m['content']
        if c.lower().strip(' ?!.') in _HELD or c.lower().rstrip(' .!?') in _fatal():
            return True
    return False


def sample(R):
    while True:
        d = thread(R) if R.random() < 0.3 else single(R)
        if not _held(d):
            return d


if __name__ == '__main__':
    import json, sys
    R = random.Random(int(sys.argv[1]) if len(sys.argv) > 1 else 0)
    for _ in range(int(sys.argv[2]) if len(sys.argv) > 2 else 8):
        print(json.dumps(sample(R), ensure_ascii=False))
