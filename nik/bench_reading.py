"""Held-out reading bench: 50 minimal pairs (100 items; v2 added 30 on 2026-10-21), hand-written, vocabulary disjoint
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
    # ---- v2 (Claude, 2026-10-21): 30 more pairs so a 1-pair move is not noise; fresh names/objects ----
    {'tag': 'give3', 'ctx': 'yubaraj le chandani lai 3 wata pustak diyo.',
     'q1': 'kasle pustak diyo?', 'e1': ['yubaraj'], 'q2': 'kasle pustak payo?', 'e2': ['chandani']},
    {'tag': 'negation3', 'ctx': 'prabin lai machha man parchha tara bhanta man pardaina.',
     'q1': 'prabin lai machha man parchha?', 'e1': ['ho', 'parchha'], 'q2': 'prabin lai bhanta man parchha?',
     'e2': ['pardaina', 'haina', 'chhaina']},
    {'tag': 'temporal3', 'ctx': 'nirjala le bihana 6 ota roti banaii, beluka 4 ota banaii.',
     'q1': 'nirjala le beluka kati roti banaii?', 'e1': ['4'], 'q2': 'nirjala le bihana kati roti banaii?', 'e2': ['6']},
    {'tag': 'distractor3', 'ctx': 'bhupendra ko bagaicha ma 15 wata gamala chhan, 6 wata futeko chhan.',
     'q1': 'kati wata gamala thik chhan?', 'e1': ['9'], 'q2': 'jamma kati gamala chhan?', 'e2': ['15']},
    {'tag': 'coref3', 'ctx': 'sushmita nurse hun, unki didi pilot hun.',
     'q1': 'sushmita ki didi ko kaam k ho?', 'e1': ['pilot'], 'q2': 'sushmita k kaam garchhin?', 'e2': ['nurse']},
    {'tag': 'compare3', 'ctx': 'yubaraj 55 kilo ko chha, prabin 61 kilo ko chha.',
     'q1': 'ko garungo chha?', 'e1': ['prabin'], 'q2': 'ko halka chha?', 'e2': ['yubaraj']},
    {'tag': 'units3', 'ctx': 'chandani le 4 litre dudh 85 rupiya litre ko dar le kini.',
     'q1': 'jamma kati rupiya tiri?', 'e1': ['340'], 'q2': 'kati litre dudh kini?', 'e2': ['4']},
    {'tag': 'sequence3', 'ctx': 'nirjala le 2, 6, 18, 54 lekhi.',
     'q1': 'arko number kati?', 'e1': ['162'], 'q2': 'ke le gunera badhyo?', 'e2': ['3']},
    {'tag': 'buy-not3', 'ctx': 'bhupendra le chamal kinyo tara nun kinena.',
     'q1': 'bhupendra le ke kinyo?', 'e1': ['chamal'], 'q2': 'ke bhupendra le nun kinyo?',
     'e2': ['kinena', 'kinyena', 'haina', 'chaina']},
    {'tag': 'role3', 'ctx': 'sushmita le prabin ko cycle chalai.',
     'q1': 'kasle cycle chalai?', 'e1': ['sushmita'], 'q2': 'kasko cycle thiyo?', 'e2': ['prabin']},
    {'tag': 'place3', 'ctx': 'yubaraj ilam ma padhchha, tara usko ghar jumla ma chha.',
     'q1': 'yubaraj kaha padhchha?', 'e1': ['ilam'], 'q2': 'yubaraj ko ghar kaha chha?', 'e2': ['jumla']},
    {'tag': 'quantity3', 'ctx': 'chandani sanga 20 wata balloon thiyo, 8 wata futyo.',
     'q1': 'kati wata balloon baki chha?', 'e1': ['12'], 'q2': 'kati wata futyo?', 'e2': ['8']},
    {'tag': 'order3', 'ctx': 'pahile prabin bolyo, ani nirjala boli.',
     'q1': 'ko pahile bolyo?', 'e1': ['prabin'], 'q2': 'ko pachhi boli?', 'e2': ['nirjala']},
    {'tag': 'price3', 'ctx': 'bhupendra le 5 wata cha cup 250 rupiya ma kinyo.',
     'q1': 'ek wata cup ko kati parchha?', 'e1': ['50'], 'q2': 'kati wata cup kinyo?', 'e2': ['5']},
    {'tag': 'coref4', 'ctx': 'sushmita ko bhai yubaraj ho ra u pokhreli school ma padhchha.',
     'q1': 'yubaraj kun school ma padhchha?', 'e1': ['pokhreli'], 'q2': 'yubaraj ki didi ko naam k ho?', 'e2': ['sushmita']},
    {'tag': 'compare4', 'ctx': 'chandani ko ghar 3 talla ko chha, nirjala ko 5 talla ko.',
     'q1': 'kasko ghar aglo chha?', 'e1': ['nirjala'], 'q2': 'chandani ko ghar kati talla ko?', 'e2': ['3']},
    {'tag': 'units4', 'ctx': 'prabin 6 kilometer hidyo ra 4 kilometer daudyo.',
     'q1': 'jamma kati kilometer gayo?', 'e1': ['10'], 'q2': 'kati kilometer daudyo?', 'e2': ['4']},
    {'tag': 'sequence4', 'ctx': 'bhupendra le 50, 45, 40, 35 lekhyo.',
     'q1': 'arko number kati?', 'e1': ['30'], 'q2': 'kati le ghatchha?', 'e2': ['5']},
    {'tag': 'went-not3', 'ctx': 'nirjala bazar gai tara mandir gaina.',
     'q1': 'nirjala kaha gai?', 'e1': ['bazar'], 'q2': 'ke nirjala mandir gai?', 'e2': ['gaina', 'gayena', 'haina', 'chaina']},
    {'tag': 'role4', 'ctx': 'yubaraj le sushmita lai phool diyo, sushmita le yubaraj lai kalam dii.',
     'q1': 'yubaraj le ke diyo?', 'e1': ['phool'], 'q2': 'sushmita le ke dii?', 'e2': ['kalam']},
    {'tag': 'time3', 'ctx': 'chandani 7 baje uthi ra 9 baje school gai.',
     'q1': 'chandani kati baje uthi?', 'e1': ['7'], 'q2': 'chandani kati baje school gai?', 'e2': ['9']},
    {'tag': 'update3', 'ctx': 'party 5 baje bhaneko thiyo, pachhi 6 baje sarera bhayo.',
     'q1': 'party kati baje bhayo?', 'e1': ['6'], 'q2': 'suru ma kati baje bhaneko thiyo?', 'e2': ['5']},
    {'tag': 'count3', 'ctx': 'prabin ko 2 dai ra 3 bahini chhan.',
     'q1': 'prabin ko kati dai chhan?', 'e1': ['2'], 'q2': 'prabin ka jamma kati dajubhai didibahini chhan?', 'e2': ['5']},
    {'tag': 'owner3', 'ctx': 'ratoo jhola nirjala ko ho, kalo jhola bhupendra ko ho.',
     'q1': 'kalo jhola kasko ho?', 'e1': ['bhupendra'], 'q2': 'nirjala ko jhola kun rang ko ho?', 'e2': ['rato', 'ratoo']},
    {'tag': 'negation4', 'ctx': 'sushmita gaau janchhin tara sahar jadinan.',
     'q1': 'sushmita kaha janchhin?', 'e1': ['gaau'], 'q2': 'ke sushmita sahar janchhin?', 'e2': ['jadinan', 'jaadinan', 'haina', 'chaina']},
    {'tag': 'left3', 'ctx': 'yubaraj sanga 100 rupiya thiyo, 35 rupiya ko chiya khayo.',
     'q1': 'yubaraj sanga kati rupiya baki chha?', 'e1': ['65'], 'q2': 'chiya kati ko thiyo?', 'e2': ['35']},
    {'tag': 'ordinal3', 'ctx': 'daud ma chandani pahilo, prabin dosro ra nirjala tesro bhaye.',
     'q1': 'dosro ko bhayo?', 'e1': ['prabin'], 'q2': 'nirjala kati aun bhai?', 'e2': ['tesro', '3']},
    {'tag': 'cause3', 'ctx': 'pani paryo, tyesaile bhupendra ghar mai basyo.',
     'q1': 'bhupendra kina ghar mai basyo?', 'e1': ['pani'], 'q2': 'bhupendra kaha basyo?', 'e2': ['ghar']},
    {'tag': 'age3', 'ctx': 'sushmita 12 barsha ki chhin, unko bhai 4 barsha sano chha.',
     'q1': 'bhai kati barsha ko chha?', 'e1': ['8'], 'q2': 'sushmita kati barsha ki?', 'e2': ['12']},
    {'tag': 'location3', 'ctx': 'chabi table mathi chha, chashma daraj bhitra chha.',
     'q1': 'chashma kaha chha?', 'e1': ['daraj'], 'q2': 'chabi kaha chha?', 'e2': ['table']},
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
