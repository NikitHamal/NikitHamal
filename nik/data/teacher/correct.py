"""Memory with updates and corrections (v4f regressed: "ma pahila butwal basthe, aile lalitpur ma baschhu" -> "butwal").
Each row states a fact, then changes or corrects it (past -> now, "haina, galti bhayo", "aba ... sare"), with distractor
facts and small talk in between; the final question must be answered with the LATEST value, and some rows ask for the
OLD value explicitly ("pahila kaha basthe?"). Slots cover place, job, age, favourite food/colour, sibling name, phone count."""
import random

import lexicon as L


def U(t):
    return {'role': 'user', 'content': t}


def N(t):
    return {'role': 'nik', 'content': t}


ACK = ['hunchha, bujhe.', 'thik chha, yaad rakhe.', 'ok, yaad gare.', 'bujhe!', 'hunchha.']
SLOTS = {
    # (wording kept different from the eval_understand probe "ma pahila butwal basthe, aile lalitpur ma baschhu")
    'place': (lambda R: R.choice(L.PLACES), 'ma {v} ma baschhu', 'ma kaha baschhu?', 'tapai {v} ma basnuhunchha.',
              'dherai barsha {o} ma bitaye, gaye mahina {v} sareko chhu', 'pahila ma kun thau ma thiye?', 'tapai pahila {o} ma hunuhunthyo.'),
    'job': (lambda R: R.choice(L.JOBS), 'ma {v} hu', 'mero kaam k ho?', 'tapai {v} hunuhunchha.',
            'pahila ma {o} thiye, aba {v} bhaye', 'pahila mero kaam k thiyo?', 'pahila tapai {o} hunuhunthyo.'),
    'food': (lambda R: R.choice(L.FOODS), 'malai {v} man parchha', 'malai k man parchha?', 'tapai lai {v} man parchha.',
             'pahila malai {o} man parthyo, aajkal {v} man parchha', 'pahila malai k man parthyo?', 'pahila tapai lai {o} man parthyo.'),
    'color': (lambda R: R.choice(L.COLORS), 'mero favourite rang {v} ho', 'mero favourite rang k ho?', 'tapai ko favourite rang {v} ho.',
              'pahila mero favourite rang {o} thiyo, aba {v} ho', 'pahila mero favourite rang k thiyo?', 'pahila tapai ko favourite rang {o} thiyo.'),
    'age': (lambda R: str(R.randint(8, 70)), 'mero umer {v} barsha ho', 'mero umer kati ho?', 'tapai ko umer {v} barsha ho.',
            'gaye barsha ma {o} barsha ko thiye, aile {v} bhaye', 'gaye barsha ma kati barsha ko thiye?', 'gaye barsha tapai {o} barsha ko hunuhunthyo.'),
    'sib': (lambda R: R.choice(L.NAMES_M + L.NAMES_F), 'mero bhai ko naam {v} ho', 'mero bhai ko naam k ho?', 'tapai ko bhai ko naam {v} ho.',
            'mero bhai ko naam pahila {o} thiyo, aba {v} rakhyau', 'bhai ko pahila ko naam k thiyo?', 'pahila bhai ko naam {o} thiyo.'),
}
FILLER = [('aaja mausam ramro chha', 'ho ni, ramro din!'), ('ma chiya khadai chhu', 'chiya ko maja nai arkai!'),
          ('hijo dherai kaam thiyo', 'thakai lagyo hola, aaram garnus.'), ('mero sathi aaudai chha', 'ramro! ramailo gaff hos.')]


def sample(R):
    keys = R.sample(list(SLOTS), R.randint(1, 3))
    target = keys[0]
    gen, state, ask, ans, change, ask_old, ans_old = SLOTS[target]
    v0 = gen(R)
    v1 = gen(R)
    while v1 == v0:
        v1 = gen(R)
    msgs, k = [], R.random()
    if k < 0.45:                        # explicit correction of a mistake
        msgs += [U(state.format(v=v0) + '.'), N(R.choice(ACK))]
        for other in keys[1:]:
            o = SLOTS[other]; msgs += [U(o[1].format(v=o[0](R)) + '.'), N(R.choice(ACK))]
        if R.random() < 0.5:
            f = R.choice(FILLER); msgs += [U(f[0]), N(f[1])]
        msgs += [U(R.choice(['haina, galti bhayo: ', 'sorry, sachyaunu: ', 'oh haina, ']) + state.format(v=v1) + '.'),
                 N(R.choice(['thik chha, sachyaeko.', 'bujhe, aba yahi yaad rakhchhu.', 'hunchha, update gare.']))]
        msgs += [U(ask), N(ans.format(v=v1))]
        kind = 'correct-fix'
    else:                               # a change over time (past vs now), sometimes asking for the past value
        for other in keys[1:]:
            o = SLOTS[other]; msgs += [U(o[1].format(v=o[0](R)) + '.'), N(R.choice(ACK))]
        msgs += [U(change.format(o=v0, v=v1) + '.'), N(R.choice(ACK))]
        if R.random() < 0.4:
            f = R.choice(FILLER); msgs += [U(f[0]), N(f[1])]
        if R.random() < 0.35:
            msgs += [U(ask_old), N(ans_old.format(o=v0))]; kind = 'correct-past'
        else:
            msgs += [U(ask), N(ans.format(v=v1))]; kind = 'correct-now'
    return {'cat': f'understand-{kind}', 'gold': msgs[-1]['content'], 'messages': msgs}


if __name__ == '__main__':
    import json, sys
    R = random.Random(int(sys.argv[1]) if len(sys.argv) > 1 else 0)
    for _ in range(4):
        d = sample(R); print(' || '.join(m['content'] for m in d['messages']))
