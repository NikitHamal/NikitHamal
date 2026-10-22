"""Vague follow-ups that point back at Nik's own previous reply (Claude, 2026-10-22).

Owner's /chat report: after `347 + 285 kati hunchha?` -> `jawaf 632 ho.`, the follow-up `kati rey?` got nonsense.
Real users do this all the time: ask again, ask to repeat, ask "sure?". Rows: one ordinary exchange from the teacher
mix (build.one), then a vague follow-up, then a reply that restates the previous answer (numbers: the gold value).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ASK_NUM = ['kati rey?', 'kati bhanyo?', 'jawaf kati aayo?', 'ani jawaf?', 'feri bhana ta, kati?', 'kati bhannubhayo?',
           'bujhina, kati?', 'kati ho bhaneko?']
ASK_ANY = ['feri bhana ta.', 'k bhannubhayo?', 'bujhina, feri bhannus na.', 'ek choti feri bhana.', 'k bhaneko?']
SURE = ['pakka ho?', 'sachchai?', 'thik ho ni?', 'pakka thik ho?']
NUM_REPLY = ['jawaf {g} ho.', 'maile bhaneko jawaf {g} ho.', '{g} ho.', 'feri bhanda: jawaf {g} ho.']
SURE_REPLY = ['ho, pakka. jawaf {g} nai ho.', 'ho, {g} nai ho.', 'ho, maile jaach gare: jawaf {g} ho.']


def sample(R):
    import build
    while True:
        r = build.one(R)
        m = r['messages']
        if len(m) < 2 or m[0]['role'] != 'user' or m[1]['role'] != 'nik':
            continue
        prev = [{'role': 'user', 'content': m[0]['content']}, {'role': 'nik', 'content': m[1]['content']}]
        g = r.get('gold')
        if g is not None and str(g) in m[1]['content'] and len(str(g)) <= 12:
            if R.random() < 0.3:
                q, a = R.choice(SURE), R.choice(SURE_REPLY).format(g=g)
            else:
                q, a = R.choice(ASK_NUM), R.choice(NUM_REPLY).format(g=g)
            return {'cat': 'followup-num', 'gold': str(g), 'messages': prev + [{'role': 'user', 'content': q},
                                                                              {'role': 'nik', 'content': a}]}
        if len(m[1]['content']) < 300:
            return {'cat': 'followup-repeat', 'gold': None,
                    'messages': prev + [{'role': 'user', 'content': R.choice(ASK_ANY)}, {'role': 'nik', 'content': m[1]['content']}]}
