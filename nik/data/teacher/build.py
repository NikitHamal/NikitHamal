"""Build the Nik teacher dataset: math + reasoning + explanations, audited.

    python nik/data/teacher/build.py --n 5000 --out nik/data/teacher/nik_teacher_5k.jsonl
    python nik/data/teacher/build.py --n 200000 --seed 7 --out data/teacher_200k.jsonl   # same quality, any size

Mix: 36% math (colmath, compose, math_gen, math2), 14% reasoning, 16% understanding (understand/2),
14% reading comprehension over random worlds (read.py), 10% compositional skills (skills.py: translation from verb
tables, grammar, list/word ops, percent), 5% explanations, 5% two-turn follow-ups. Rows that copy an
understanding-probe item are dropped (the probes must stay unseen). Only examples that
pass every audit check are written.
"""
import argparse, json, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import colmath, compose, correct, frame, vocab, ledger, math_gen, math2, read, reason_gen, reason2, reduce, skills, understand, understand2  # noqa: E402
from audit import audit  # noqa: E402
from augment import augment_example  # noqa: E402
from explain import GOLD  # noqa: E402
from explain2 import GOLD2  # noqa: E402
ALL_GOLD = GOLD + GOLD2

LEAD = ['', '', '', 'ek prashna: ', 'malai help garnus: ', 'yo bujhina, ', 'kripaya solve garnus: ', 'sir, ']
# reduce-and-rewrite multi-step arithmetic (reduce.py, Sky, issue #9): L2 0 -> 11/12 in a CPU micro-SFT.
REDUCE_SHARE = float(os.environ.get('NIK_REDUCE_SHARE', '0.06'))
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
    x = R.random() if not os.environ.get('NIK_NO_FRAME_ITER') else 1.0   # control runs: sft7 recipe without frame/iter
    if x < 0.05:            # held-out-style word frames with distractors (frame.py, Local-C, issue #9)
        d = frame.sample(R)
        return {'cat': d['cat'], 'gold': d['gold'], 'messages': d['messages']}
    if 0.12 <= x < 0.14:    # English <-> Nepali vocabulary, 150 hand-written pairs (vocab.py)
        d = vocab.sample(R)
        return {'cat': d['cat'], 'gold': d['gold'], 'messages': d['messages']}
    if 0.08 <= x < 0.12:    # memory with updates/corrections, latest value wins (correct.py; v4f regressed on this)
        d = correct.sample(R)
        return {'cat': d['cat'], 'gold': None, 'messages': d['messages']}
    if x < 0.08:            # iterate-a-rule sequences, one line per step (iter.py, Local-C): sequence/pattern were 0/11
        import iter as itgen
        d = itgen.make(R)
        return {'cat': d['cat'], 'gold': d['gold'], 'messages': d['messages']}
    if 0.14 <= x < 0.26:    # grounded roles: bind each number to its role, carry the intermediate (roles.py, Local-C: word 0 -> 9/48)
        import roles
        d = roles.sample(R)
        return {'cat': d['cat'], 'gold': d['gold'], 'messages': d['messages']}
    if R.random() < 0.04:   # 4% of rows ~= 12% of tokens (ledger rows are ~3x longer; Local-C, issue #9). P6 Grounded Ledger (Local-A, issue #9): bind quantities from the text, then formula, then compute
        d = ledger.sample(R)
        return {'cat': d['cat'], 'gold': d['gold'], 'messages': d['messages']}
    if REDUCE_SHARE and R.random() < REDUCE_SHARE:
        return reduce.sample(R)
    k = R.random()
    if k < 0.10:     # one general column algorithm for + - x / at every size (1-6 digits)
        return to_example(colmath.sample(R), 'math', R)
    if k < 0.22:     # compositional multi-step word problems (no fixed template; grounded steps)
        return to_example(compose.sample(R), 'math', R)
    if k < 0.29:
        return to_example(math_gen.sample(R), 'math', R)
    if k < 0.36:
        return to_example(math2.sample(R), 'math', R)
    if k < 0.44:
        return to_example(reason_gen.sample(R), 'reason', R)
    if k < 0.50:
        e = reason2.sample(R)
        return {'cat': f'reason-{e["kind"]}', 'gold': e['gold'], 'messages': e['messages']}
    if k < 0.66:     # understanding: answers built from the user's own words (anti-memorisation)
        e = (understand if R.random() < 0.5 else understand2).sample(R)
        return {'cat': f'understand-{e["kind"]}', 'gold': e['gold'], 'messages': e['messages']}
    if k < 0.80:     # reading comprehension over random worlds (large lexicons, quote-then-answer)
        e = read.sample(R)
        return {'cat': e['kind'], 'gold': e['gold'], 'messages': e['messages']}
    if k < 0.90:     # compositional translation / grammar / list + word ops / percent
        e = skills.sample(R)
        return {'cat': e['kind'], 'gold': e['gold'], 'messages': e['messages']}
    if k < 0.95:
        return explanation(R)
    a = to_example(math_gen.sample(R) if R.random() < 0.6 else reason_gen.sample(R), 'math', R)
    b = to_example(math_gen.sample(R) if R.random() < 0.5 else reason_gen.sample(R), 'math', R, lead=False)
    b['messages'][0]['content'] = R.choice(FOLLOW) + b['messages'][0]['content']
    return {'cat': 'math-multiturn', 'gold': b['gold'], 'messages': a['messages'] + b['messages']}


# ---------------------------------------------------------------- keep the understanding probes unseen
def _probe_guard():
    import re
    here = os.path.dirname(os.path.abspath(__file__))
    src = open(os.path.join(here, '..', '..', 'eval_understand.py')).read()
    i = src.index('PROBES = ['); j = src.index('\n]\n', i) + 2
    ns = {'U': lambda t: {'role': 'user', 'content': t}, 'N': lambda t: {'role': 'nik', 'content': t}}
    exec(src[i:j], ns)
    qs = [m['content'].lower() for _, msgs, _ in ns['PROBES'] for m in msgs if m['role'] == 'user']
    norm = lambda t: ' '.join(re.sub(r'[^a-z0-9 ]', ' ', t.lower()).split())  # noqa: E731
    exact = {norm(q) for q in qs}
    quoted = {norm(x) for q in qs for x in re.findall(r'"([^"]+)"', q)}
    lists = {norm(x) for q in qs for x in re.findall(r'\d+(?:, \d+)+', q)}

    def leaks(ex):
        for m in ex['messages']:
            if m['role'] != 'user':
                continue
            t = norm(m['content'])
            if t in exact or any(norm(x) in quoted for x in re.findall(r'"([^"]+)"', m['content'])) or any(l in t for l in lists):
                return True
        return False
    return leaks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=5000)
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--out', default='nik/data/teacher/nik_teacher_5k.jsonl')
    a = ap.parse_args()
    R = random.Random(a.seed)
    good, seen, uses, total, tries = [], set(), {}, 0, 0
    cap = max(10, a.n // 3000)
    leaks = _probe_guard()          # each hand-written explanation appears at most this often
    while len(good) < a.n and tries < 400:     # incremental: only new rows are audited
        batch = [one(R) for _ in range(min(50000, int((a.n - len(good)) * 1.3) + 100))]
        total += len(batch); tries += 1
        ok, _ = audit(batch, verbose=False, seen=seen)
        for ex in ok:
            if leaks(ex):
                continue
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
