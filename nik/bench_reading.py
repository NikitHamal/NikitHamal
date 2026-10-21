"""Held-out reading bench: 20 minimal pairs (40 items), hand-written, vocabulary disjoint
from every training generator (names, objects, places, jobs, foods are all different from
reading_contrast.py / names.py / frame.py / roles.py / bench_hard.py).

A pair passes only if BOTH items are right, so entity memorisation cannot score. The suite
is itself leak-audited: run

    python nik/scripts/leak_audit.py data/behavior.jsonl

with `bench_reading` added to the prompt sources, or the reverse check in the tests.

    python nik/bench_reading.py --model nik/web/model/nik-0.1.bin --out reading.json
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import torch  # noqa: E402
from eval_understand import load_any  # noqa: E402
from model import generate_ar  # noqa: E402
from prepare import render_chat  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402

PAIRS = [
    {'tag': 'give', 'ctx': 'aashish le dinesh lai 6 wata sel roti diyo.',
     'q1': 'kasle sel roti diyo?', 'e1': ['aashish'], 'q2': 'kasle sel roti payo?', 'e2': ['dinesh']},
    {'tag': 'negation', 'ctx': 'bikram lai kwati man parchha tara tama man pardaina.',
     'q1': 'bikram lai kwati man parchha?', 'e1': ['ho', 'parchha'], 'q2': 'bikram lai tama man parchha?',
     'e2': ['pardaina', 'haina', 'chhaina']},
    {'tag': 'temporal', 'ctx': 'srijana pahile 5 kilo chura lyai, pachhi 3 kilo thapi.',
     'q1': 'srijana le pachhi kati kilo chura lyai?', 'e1': ['3'], 'q2': 'srijana le pahile kati kilo chura lyai?',
     'e2': ['5']},
    {'tag': 'distractor', 'ctx': 'raju ko ghar ma 9 wata ghadi chhan, 4 wata bigreko chhan.',
     'q1': 'kati wata ghadi ramro chhan?', 'e1': ['5'], 'q2': 'jamma kati wata ghadi chhan?', 'e2': ['9']},
    {'tag': 'coref', 'ctx': 'manisha lekhpadi hun, unko dai malis ho.',
     'q1': 'manisha ko dai ko kaam k ho?', 'e1': ['malis'], 'q2': 'manisha k kaam garchhin?', 'e2': ['lekhpadi']},
    {'tag': 'compare', 'ctx': 'sunil 28 barsha ko chha, rojina 34 barsha ki chha.',
     'q1': 'ko jetho ho?', 'e1': ['rojina'], 'q2': 'ko sano ko ho?', 'e2': ['sunil']},
    {'tag': 'units', 'ctx': 'sneha le 2 kilo bhutuwa 90 rupiya kilo ko dar le kinyo.',
     'q1': 'jamma kati rupiya tiryo?', 'e1': ['180'], 'q2': 'kati kilo bhutuwa kinyo?', 'e2': ['2']},
    {'tag': 'sequence', 'ctx': 'kushal le 3, 9, 27, 81 lekhyo.',
     'q1': 'arko number kati?', 'e1': ['243'], 'q2': 'ke le gunera badhyo?', 'e2': ['3']},
    {'tag': 'buy-not', 'ctx': 'manisha le chura kinyo tara kwati kinyena.',
     'q1': 'manisha le ke kinyo?', 'e1': ['chura'], 'q2': 'ke manisha le kwati kinyo?',
     'e2': ['kinyena', 'haina', 'chaina', 'pardaina']},
    {'tag': 'role', 'ctx': 'dinesh le aashish ko tiffin bokyo.',
     'q1': 'kasle tiffin bokyo?', 'e1': ['dinesh'], 'q2': 'kasko tiffin thiyo?', 'e2': ['aashish']},
    {'tag': 'negation2', 'ctx': 'rojina janakpur ma baschhain, u damak ma baschha.',
     'q1': 'rojina kaha baschha?', 'e1': ['damak'], 'q2': 'ke rojina janakpur ma baschha?',
     'e2': ['baschhain', 'haina', 'chaina']},
    {'tag': 'quantity', 'ctx': 'bikram sanga 12 wata topi thiyo, 5 wata usle bechyo.',
     'q1': 'kati wata topi baki chha?', 'e1': ['7'], 'q2': 'kati wata bechyo?', 'e2': ['5']},
    {'tag': 'order', 'ctx': 'pahile manisha aai, pachhi raju aayo.',
     'q1': 'ko pahile aayo?', 'e1': ['manisha'], 'q2': 'ko pachhi aayo?', 'e2': ['raju']},
    {'tag': 'distractor2', 'ctx': 'srijana le 4 wata chata kinyo ra 200 rupiya tiryo.',
     'q1': 'ek wata chata ko kati parchha?', 'e1': ['50'], 'q2': 'kati wata chata kinyo?', 'e2': ['4']},
    {'tag': 'coref2', 'ctx': 'sunil ko bahini sneha ho ra u tansen ma padhchha.',
     'q1': 'sneha kaha padhchha?', 'e1': ['tansen'], 'q2': 'sneha ko dai ko naam k ho?', 'e2': ['sunil']},
    {'tag': 'compare2', 'ctx': 'kushal ko jutta 42 size ko chha, dinesh ko 39 size ko.',
     'q1': 'kasko jutta ko size thulo?', 'e1': ['kushal'], 'q2': 'dinesh ko size kati?', 'e2': ['39']},
    {'tag': 'units2', 'ctx': 'aashish le 3 mitar kapaad ra 2 mitar dori kinyo.',
     'q1': 'jamma kati mitar kinyo?', 'e1': ['5'], 'q2': 'kati mitar dori kinyo?', 'e2': ['2']},
    {'tag': 'sequence2', 'ctx': 'sneha le 40, 36, 32, 28 lekhi.',
     'q1': 'arko number kati?', 'e1': ['24'], 'q2': 'kati le ghatcha?', 'e2': ['4']},
    {'tag': 'went-not', 'ctx': 'sunil damak gayo tara janakpur gayena.',
     'q1': 'sunil kaha gayo?', 'e1': ['damak'], 'q2': 'ke sunil janakpur gayo?',
     'e2': ['gayena', 'haina', 'chaina']},
    {'tag': 'role2', 'ctx': 'raju le rojina lai ghadi diyo, rojina le badal ma chura dii.',
     'q1': 'raju le ke diyo?', 'e1': ['ghadi'], 'q2': 'rojina le ke dii?', 'e2': ['chura']},
]

NUM_RE = re.compile(r'-?\d+(?:\.\d+)?')


def norm(s):
    return re.sub(r'\s+', ' ', (s or '').lower()).strip()


def contains(answer, expected):
    a = norm(answer)
    for value in expected:
        v = norm(value)
        if NUM_RE.fullmatch(v):
            if re.search(r'(?<![\d.])' + re.escape(v) + r'(?![\d.])', a):
                return True
        elif v in a:
            return True
    return False


def answer_after_think(text):
    return re.sub(r'<\|think\|>[\s\S]*?(<\|/think\|>|$)', '', text or '').replace('<|end|>', '').strip()


def ask(model, tok, context, question, max_new=120):
    ids, _ = render_chat(tok, [{'role': 'user', 'content': f'{context} {question}'}])
    out = generate_ar(model, ids[:-1] + [6], max_new, temperature=0.0)
    return tok.decode(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--tok', default=os.path.join(os.path.dirname(__file__), 'web/model/tokenizer.json'))
    ap.add_argument('--out', default='')
    a = ap.parse_args()
    torch.set_grad_enabled(False)
    tok = Tokenizer.load(a.tok)
    model = load_any(a.model).eval()
    rows, pair_ok = [], 0
    for p in PAIRS:
        a1 = answer_after_think(ask(model, tok, p['ctx'], p['q1']))
        a2 = answer_after_think(ask(model, tok, p['ctx'], p['q2']))
        ok1, ok2 = contains(a1, p['e1']), contains(a2, p['e2'])
        both = ok1 and ok2
        pair_ok += both
        rows.append({'tag': p['tag'], 'ctx': p['ctx'], 'q1': p['q1'], 'a1': a1, 'ok1': ok1,
                     'q2': p['q2'], 'a2': a2, 'ok2': ok2, 'pair_ok': both})
        print(f"[{'ok  ' if both else 'FAIL'}] {p['tag']:14s} {p['q1'][:40]} -> {a1[:60]}")
        print(f"                 {p['q2'][:40]} -> {a2[:60]}")
    result = {'items': 2 * len(PAIRS), 'item_pass': sum(r['ok1'] + r['ok2'] for r in rows),
              'pairs': len(PAIRS), 'pair_pass': pair_ok, 'rows': rows}
    print(f"reading bench: items {result['item_pass']}/{result['items']}  pairs {pair_ok}/{len(PAIRS)}")
    if a.out:
        with open(a.out, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
