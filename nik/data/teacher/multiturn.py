"""Multi-turn robustness rows (Sky, issue #9): Nik must read the LATEST question with ITS OWN numbers, and recall a
fact the user stated several exchanges back.

Why: the live v4f solves 46/60 NikBench items single-turn and 6/60 after 8 ordinary chat exchanges (old /chat prompt
policy): after `18 x 7 kati?` it solves `38 x 26` as `18 x 6` (cross-turn number leakage). And a fact 4 exchanges back
is recalled 0/16 times even when it is in the prompt (nik/scripts/memory_long.mjs). Training rows are almost all
single-turn, or multi-turn with short replies.

Two row kinds, history as the worker sends it (earlier Nik replies without their think):
  fresh  - 1-4 earlier exchanges (math with different numbers, chat, writing), then a new problem; only the last reply
           has a think, computed from the new problem's numbers (it is a normal teacher row).
  recall - a fact about the user, 2-6 ordinary exchanges with long replies, then a question about it (or, 15%, about
           something never said -> an honest "you did not tell me").
Vocabulary is disjoint from eval_understand.py / stress.py / memory_long.mjs (test_multiturn.py checks it).
"""
import random

import build
import chat
import write

NAMES = ['anita', 'bikash', 'puja', 'ramesh', 'sushma', 'deepak', 'nirmala', 'sagar', 'kopila', 'tilak', 'sarad', 'junu',
         'manoj', 'samjhana', 'subash', 'parbati', 'umesh', 'kamala', 'dipesh', 'menuka']
PLACES = ['hetauda', 'nepalgunj', 'rolpa', 'palpa', 'damak', 'tansen', 'gorkha', 'bhaktapur', 'itahari', 'baglung',
          'surkhet', 'dhangadhi', 'banepa', 'syangja', 'bardiya']
JOBS = ['teacher', 'driver', 'kisan', 'dokan', 'darji', 'sikarmi', 'police', 'plumber', 'accountant', 'engineer ko intern',
        'hotel', 'school ko peon']
PETS = ['jhyaure', 'kale', 'tiger', 'jhumri', 'seto', 'lucky', 'bholu', 'chandu']
FOODS = ['dal bhat', 'sekuwa', 'yomari', 'dhido', 'bara', 'chatpate', 'juju dhau', 'gundruk']
COLOURS = ['hariyo', 'pahelo', 'gulabi', 'khairo', 'baijani', 'sunaulo']
THINGS = ['cycle', 'jhola', 'chhata', 'jutta', 'topi']

FACTS = [   # (statement, question, answer, value list)
    ('mero naam {v} ho.', ['mero naam k ho?', 'malai k bhanera bolauchhau?'], 'tapai ko naam {v} ho.', NAMES),
    ('ma {v} ma baschhu.', ['ma kaha baschhu?', 'ma kun thau ma baschhu bhaneko thiye?'], 'tapai {v} ma basnuhunchha.', PLACES),
    ('ma {v} ko kaam garchhu.', ['ma k kaam garchhu?', 'mero kaam k ho?'], 'tapai {v} ko kaam garnuhunchha.', JOBS),
    ('mero kukur ko naam {v} ho.', ['mero kukur ko naam k ho?'], 'tapai ko kukur ko naam {v} ho.', PETS),
    ('malai {v} sabai bhanda man parchha.', ['malai sabai bhanda k man parchha?', 'mero man parne khana k ho?'],
     'tapai lai {v} sabai bhanda man parchha.', FOODS),
    ('mero dai ko naam {v} ho.', ['mero dai ko naam k ho?'], 'tapai ko dai ko naam {v} ho.', NAMES),
    ('ma {v} barsha ko hu.', ['ma kati barsha ko hu?', 'mero umer kati ho?'], 'tapai {v} barsha ko hunuhunchha.', [str(i) for i in range(12, 70)]),
    ('mero {t} {v} rang ko chha.', ['mero {t} kun rang ko chha?'], 'tapai ko {t} {v} rang ko chha.', COLOURS),
]
ACKS = ['thik chha!', 'ramro!', 'hunchha, yaad rakhchhu.', 'la, ramro kura.', 'bujhe.']
UNKNOWN = 'tapai le malai tyo kura bhannubhayeko chhaina.'


def exchange(R):
    """one ordinary earlier exchange, reply without think (what the worker sends back)"""
    k = R.random()
    row = chat.sample(R) if k < 0.35 else write.sample(R) if k < 0.55 else build.one(R)
    m = row['messages']
    return [{'role': 'user', 'content': m[0]['content']}, {'role': 'nik', 'content': m[1]['content']}]


def fresh(R):
    hist = []
    for _ in range(R.randint(1, 4)):
        hist += exchange(R)
    while True:
        last = build.one(R)
        if last['cat'].startswith(('math', 'reason')) and len(last['messages']) == 2 and last['messages'][1].get('think'):
            break
    return {'cat': 'multiturn-fresh', 'gold': last['gold'], 'messages': hist + last['messages']}


def recall(R):
    st, qs, ans, vals = R.choice(FACTS)
    v, t = R.choice(vals), R.choice(THINGS)
    msgs = [{'role': 'user', 'content': st.format(v=v, t=t)}, {'role': 'nik', 'content': R.choice(ACKS)}]
    for _ in range(R.randint(2, 6)):
        msgs += exchange(R)
    if R.random() < 0.15:         # asked about something the user never said
        other = R.choice([f for f in FACTS if f[0] != st])
        q, a, gold = R.choice(other[1]).format(t=t), UNKNOWN, None
    else:
        q, a, gold = R.choice(qs).format(t=t), ans.format(v=v, t=t), v
    msgs.append({'role': 'user', 'content': q})
    msgs.append({'role': 'nik', 'content': a})
    return {'cat': 'multiturn-recall', 'gold': gold, 'messages': msgs}


def sample(R):
    return fresh(R) if R.random() < 0.5 else recall(R)


if __name__ == '__main__':
    R = random.Random(0)
    for _ in range(3):
        d = sample(R)
        print(d['cat'], [m['content'][:50] for m in d['messages']])
