"""Build the Nik teacher dataset: math + reasoning + explanations, audited.

    python nik/data/teacher/build.py --n 5000 --out nik/data/teacher/nik_teacher_5k.jsonl
    python nik/data/teacher/build.py --n 200000 --seed 7 --out data/teacher_200k.jsonl   # same quality, any size

Mix: 52% math (41 families), 32% reasoning (17 families incl. critique and explain-on-request dialogs),
10% hand-written explanations (~85 topics), 6% two-turn follow-up problems. Only examples that
pass every audit check are written.
"""
import argparse, json, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import math_gen, math2, reason_gen, reason2  # noqa: E402
from audit import audit  # noqa: E402
from explain import GOLD  # noqa: E402
from explain2 import GOLD2  # noqa: E402
ALL_GOLD = GOLD + GOLD2

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
    qs, a = R.choice(ALL_GOLD)
    return {'cat': 'explain', 'gold': None, 'messages': [{'role': 'user', 'content': R.choice(qs)}, {'role': 'nik', 'content': a}]}


def one(R):
    k = R.random()
    if k < 0.34:
        return to_example(math_gen.sample(R), 'math', R)
    if k < 0.52:
        return to_example(math2.sample(R), 'math', R)
    if k < 0.70:
        return to_example(reason_gen.sample(R), 'reason', R)
    if k < 0.84:
        e = reason2.sample(R)
        return {'cat': f'reason-{e["kind"]}', 'gold': e['gold'], 'messages': e['messages']}
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
    cap = max(10, a.n // 3000)          # each hand-written explanation appears at most this often
    while len(good) < a.n:
        rows += [one(R) for _ in range(int((a.n - len(good)) * 1.2) + 50)]
        good, _ = audit(rows, verbose=False)
        seen, kept = {}, []
        for ex in good:
            if ex['cat'] == 'explain':
                k = ex['messages'][-1]['content']
                seen[k] = seen.get(k, 0) + 1
                if seen[k] > cap:
                    continue
            kept.append(ex)
        good = kept
    good = good[: a.n]
    _, fails = audit(rows)
    os.makedirs(os.path.dirname(a.out) or '.', exist_ok=True)
    with open(a.out, 'w') as f:
        for ex in good:
            f.write(json.dumps(ex, ensure_ascii=False) + '\n')
    print('wrote', a.out, len(good))


if __name__ == '__main__':
    main()
