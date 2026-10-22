"""NikBench-Long: fact recall across long contexts (Claude, 2026-10-22). One fact at a random depth in long Nepali
text (teacher rows as filler), asked at the end; 6 items per length (400, 1k, 2k, 4k, 8k, 15k tokens). Names and fact
kinds are disjoint from data/teacher/longctx.py, so a gain is recall, not template memory. Lengths beyond the
model's cfg.ctx are skipped. Pass = the reply (think removed) contains the value.

    python nik/bench_long.py --model <bin> --out long.json
"""
import argparse
import json
import os
import random
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.join(HERE, 'data', 'teacher')]

NAMES = ['hemanta', 'sulochana', 'dinanath', 'bhawana', 'trilochan', 'manjari']
KINDS = [('{n} ko locker ko code {v} ho.', '{n} ko locker ko code kati ho?'),
         ('{n} ko gadi ko number {v} ho.', '{n} ko gadi ko number kati ho?'),
         ('{n} ko jaga ko kitta number {v} ho.', '{n} ko jaga ko kitta number kati ho?')]
LENGTHS = [400, 1000, 2000, 4000, 8000, 15000]


def make(R, tok, n_tok):
    import build
    from prepare import render_chat
    n, (st, q) = R.choice(NAMES), R.choice(KINDS); v = str(R.randint(1000, 99999))
    parts = []
    while True:
        m = build.one(R)['messages']; parts.append(' '.join(x['content'] for x in m[:2]))
        msg = ' '.join(parts)
        if len(render_chat(tok, [{'role': 'user', 'content': msg}])[0]) >= n_tok:
            break
    parts.insert(R.randint(0, len(parts)), st.format(n=n, v=v))
    return ' '.join(parts) + ' ' + q.format(n=n), v


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--model', required=True); ap.add_argument('--out', default=None)
    ap.add_argument('--per', type=int, default=6); ap.add_argument('--seed', type=int, default=2026)
    a = ap.parse_args()
    import torch
    from eval_understand import load_any
    from model import generate_ar
    from prepare import render_chat
    from tokenizer import Tokenizer
    tok = Tokenizer.load(os.path.join(HERE, 'web/model/tokenizer.json'))
    m = load_any(a.model).eval(); R = random.Random(a.seed)
    res, rows = {}, []
    for L in LENGTHS:
        items = [make(R, tok, L) for _ in range(a.per)]
        if L + 64 > m.cfg.ctx:
            res[f'{L}'] = 'skip (ctx)'; continue
        ok = 0
        for msg, v in items:
            ids, _ = render_chat(tok, [{'role': 'user', 'content': msg}])
            with torch.no_grad():
                out = tok.decode(generate_ar(m, ids[:-1] + [6], 120, temperature=0.0))
            out = re.sub(r'<\|think\|>.*?(<\|/think\|>|$)', '', out, flags=re.S).replace('<|end|>', '').strip()
            hit = v in out; ok += hit; rows.append({'len': L, 'gold': v, 'reply': out, 'ok': hit})
        res[f'{L}'] = f'{ok}/{a.per}'
    print(json.dumps(res)); print('NikBench-Long:', ' '.join(f'{k}={v}' for k, v in res.items()))
    if a.out:
        json.dump({'summary': res, 'rows': rows}, open(a.out, 'w'), indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
