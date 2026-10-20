"""Build the Nik teacher dataset: math + reasoning + explanations, audited.

    python nik/data/teacher/build.py --n 5000 --out nik/data/teacher/nik_teacher_5k.jsonl
    python nik/data/teacher/build.py --n 200000 --seed 7 --out data/teacher_200k.jsonl   # same quality, any size

Mix: 52% math (24 families), 33% reasoning (12 families), 9% hand-written explanations,
6% two-turn conversations (a follow-up problem in the same chat). Only examples that
pass every audit check are written.
"""
import argparse, json, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import math_gen, reason_gen  # noqa: E402
from audit import audit  # noqa: E402
from explain import GOLD  # noqa: E402

LEAD = ['', '', '', 'ek prashna: ', 'malai help garnus: ', 'yo bujhina, ', 'kripaya solve garnus: ', 'sir, ']
FOLLOW = ['arko prashna: ', 'ani yo chai? ', 'dhanyabad! aba yo: ', 'ramro. arko: ']


REASON_LEAD = ['', '', '', 'ek prashna: ', 'sochera bhannus: ', 'yo puzzle solve garnus: ']


def to_example(e, cat, R, lead=True):
    leads = LEAD if cat == 'math' and e['kind'] not in ('logic', 'common', 'calendar', 'pattern', 'sets') else REASON_LEAD
    if e['kind'] == 'common':
        leads = ['', '', 'ek kura sodhu? ']
    q = (R.choice(leads) if lead else '') + e['q']
    return {'cat': f'{cat}-{e["kind"]}', 'gold': e['gold'],
            'messages': [{'role': 'user', 'content': q}, {'role': 'nik', 'content': e['a'], 'think': e['think']}]}


def explanation(R):
    qs, a = R.choice(GOLD)
    return {'cat': 'explain', 'gold': None, 'messages': [{'role': 'user', 'content': R.choice(qs)}, {'role': 'nik', 'content': a}]}


def one(R):
    k = R.random()
    if k < 0.52:
        return to_example(math_gen.sample(R), 'math', R)
    if k < 0.85:
        return to_example(reason_gen.sample(R), 'reason', R)
    if k < 0.94:
        return explanation(R)
    a = to_example(math_gen.sample(R) if R.random() < 0.6 else reason_gen.sample(R), 'math', R)
    b = to_example(math_gen.sample(R) if R.random() < 0.5 else reason_gen.sample(R), 'math', R, lead=False)
    b['messages'][0]['content'] = R.choice(FOLLOW) + b['messages'][0]['content']
    return {'cat': 'math-multiturn', 'gold': b['gold'], 'messages': a['messages'] + b['messages']}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=5000)
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--out', default='nik/data/teacher/nik_teacher_5k.jsonl')
    a = ap.parse_args()
    R = random.Random(a.seed)
    rows, good = [], []
    while len(good) < a.n:
        rows += [one(R) for _ in range(int((a.n - len(good)) * 1.15) + 50)]
        good, _ = audit(rows, verbose=False)
    good = good[: a.n]
    _, fails = audit(rows)
    os.makedirs(os.path.dirname(a.out) or '.', exist_ok=True)
    with open(a.out, 'w') as f:
        for ex in good:
            f.write(json.dumps(ex, ensure_ascii=False) + '\n')
    print('wrote', a.out, len(good))


if __name__ == '__main__':
    main()
