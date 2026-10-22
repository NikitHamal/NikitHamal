"""Long-context rows for the 16k model (Claude, 2026-10-22): recall across thousands of tokens.

  needle   one fact hidden at a random depth inside long Nepali text, asked at the end
  multi    three facts at different depths, one of them asked (the others are distractors)
  chat     a long multi-turn chat (ordinary exchanges from the teacher generators) with a fact said early

Filler = real teacher rows (questions + answers from build.one), so the text around the fact is varied Nepali.
Target length is drawn per row (--min/--max tokens via sample(R, lo, hi)); ~4 characters per token.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

NAMES = ['saugat', 'rijana', 'pramod', 'samjhana', 'bikash', 'anisha', 'kushal', 'pratiksha']
KINDS = [  # (statement, question, answer) with {n} name and {v} value
    ('{n} ko gopya number {v} ho.', '{n} ko gopya number kati ho?', '{n} ko gopya number {v} ho.'),
    ('{n} ko bus ticket ko number {v} ho.', '{n} ko bus ticket ko number kati thiyo?', 'ticket ko number {v} thiyo.'),
    ('{n} {v} baje aaunchhan.', '{n} kati baje aaunchhan?', '{n} {v} baje aaunchhan.'),
    ('{n} ko kotha number {v} ho.', '{n} ko kotha number kati ho?', 'kotha number {v} ho.'),
]


def _filler(R, chars):
    import build
    out, n = [], 0
    while n < chars:
        m = build.one(R)['messages']
        t = ' '.join(x['content'] for x in m[:2])
        out.append(t); n += len(t) + 1
    return out


def _fact(R, used):
    n = R.choice([x for x in NAMES if x not in used]); used.add(n)
    st, q, a = R.choice(KINDS)
    v = str(R.randint(2, 12)) if 'baje' in st else str(R.randint(100, 9999))
    return st.format(n=n, v=v), q.format(n=n), a.format(n=n, v=v), v


def sample(R, lo=None, hi=None):
    lo = lo or int(os.environ.get('NIK_LONG_LO', 1500)); hi = hi or int(os.environ.get('NIK_LONG_HI', 10000))
    k = R.random()
    target = R.randint(lo, hi) * 4
    if k < 0.75:
        used = set(); facts = [_fact(R, used) for _ in range(1 if k < 0.45 else 3)]
        parts = _filler(R, target)
        for st, _, _, _ in facts:
            parts.insert(R.randint(0, len(parts)), st)
        st, q, a, v = R.choice(facts)
        return {'cat': 'long-' + ('needle' if len(facts) == 1 else 'multi'), 'gold': v,
                'messages': [{'role': 'user', 'content': ' '.join(parts) + ' ' + q},
                             {'role': 'nik', 'content': a, 'think': f'mathi lekheko chha: "{st}"'}]}
    used = set(); st, q, a, v = _fact(R, used)
    import build
    msgs = [{'role': 'user', 'content': st}, {'role': 'nik', 'content': 'hunchha, yaad rakhe.'}]
    n = 0
    while n < target:
        m = build.one(R)['messages']
        msgs += [{'role': 'user', 'content': m[0]['content']}, {'role': 'nik', 'content': m[1]['content']}]
        n += len(m[0]['content']) + len(m[1]['content'])
    msgs += [{'role': 'user', 'content': q}, {'role': 'nik', 'content': a}]
    return {'cat': 'long-chat', 'gold': v, 'messages': msgs}
