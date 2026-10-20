"""Build the Nik teacher dataset: math + reasoning + explanations, audited.

    python nik/data/teacher/build.py --n 5000 --out nik/data/teacher/nik_teacher_5k.jsonl
    python nik/data/teacher/build.py --n 200000 --seed 7 --out data/teacher_200k.jsonl   # same quality, any size

Mix: 37% math (41 families), 23% reasoning (17 families), 29% understanding (21 families: memory,
reading, translation, grammar, English, instructions), 6% explanations, 5% two-turn follow-ups. Only examples that
pass every audit check are written.
"""
import argparse, json, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import colmath, math_gen, math2, reason_gen, reason2, understand, understand2  # noqa: E402
from audit import audit  # noqa: E402
from augment import augment_example  # noqa: E402
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
    return augment_example(_one(R), R)


def _one(R):
    k = R.random()
    if k < 0.12:     # one general column algorithm for + - x / at every size (1-6 digits)
        return to_example(colmath.sample(R), 'math', R)
    if k < 0.26:
        return to_example(math_gen.sample(R), 'math', R)
    if k < 0.37:
        return to_example(math2.sample(R), 'math', R)
    if k < 0.49:
        return to_example(reason_gen.sample(R), 'reason', R)
    if k < 0.58:
        e = reason2.sample(R)
        return {'cat': f'reason-{e["kind"]}', 'gold': e['gold'], 'messages': e['messages']}
    if k < 0.88:     # understanding: answers built from the user's own words (anti-memorisation)
        e = (understand if R.random() < 0.5 else understand2).sample(R)
        return {'cat': f'understand-{e["kind"]}', 'gold': e['gold'], 'messages': e['messages']}
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
    good, seen, uses, total, tries = [], set(), {}, 0, 0
    cap = max(10, a.n // 3000)          # each hand-written explanation appears at most this often
    while len(good) < a.n and tries < 400:     # incremental: only new rows are audited
        batch = [one(R) for _ in range(min(50000, int((a.n - len(good)) * 1.3) + 100))]
        total += len(batch); tries += 1
        ok, _ = audit(batch, verbose=False, seen=seen)
        for ex in ok:
            if ex['cat'] == 'explain':
                k = ex['messages'][-1]['content']
                uses[k] = uses.get(k, 0) + 1
                if uses[k] > cap:
                    continue
            good.append(ex)
    good = good[: a.n]
    print(f'audit: {len(good)} kept of {total} generated ({len(good) / max(1, total):.1%}); every kept row passed all checks')
    import collections
    print('  by category:', dict(sorted(collections.Counter(e['cat'] for e in good).items())))
    os.makedirs(os.path.dirname(a.out) or '.', exist_ok=True)
    with open(a.out, 'w') as f:
        for ex in good:
            f.write(json.dumps(ex, ensure_ascii=False) + '\n')
    print('wrote', a.out, len(good))


if __name__ == '__main__':
    main()
