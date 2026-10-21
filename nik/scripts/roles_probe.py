"""The grounded-role probe: can the model bind numbers in a text to their roles?

This is the *held-out* measurement for `nik/data/teacher/roles.py` (issue #9).  Every
surface in this file is written by hand and deliberately differs from the training
surfaces: different nouns, different verbs, different word order, different
distractors.  The numbers differ too, so no item here can be answered by recognising
a template.

It measures three things separately, because they are three different abilities:

  * **one step in a sentence** - find the right number, apply one operation;
  * **two steps in a sentence** - compute an intermediate result and *carry* it into
    the second operation (this is the shape the benchmark's word family needs, and
    the shape the ladder's L2 measures without a story);
  * **pick the right number** - the question asks about one role and the text
    contains other numbers that must not be used.

    python nik/scripts/roles_probe.py --model nik/web/model/nik-0.1.bin
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import torch  # noqa: E402
from export import load_exported  # noqa: E402
from model import NikConfig, NikLM, generate_ar  # noqa: E402
from prepare import render_chat  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402

U = lambda t: {'role': 'user', 'content': t}  # noqa: E731
N = lambda t: {'role': 'nik', 'content': t}   # noqa: E731

# (kind, question, gold)  - the gold number must appear in the answer
PROBES = [
    # ---- one step, money, unseen surfaces
    ('1step-money', 'mero haath ma 700 rupiya thyo, maile 240 rupiya ko kirana kinyo. aba mero haath ma kati rupiya cha?', '460'),
    ('1step-money', 'gopal sanga 1450 rupiya thiyo, usle 700 rupiya kharera diyo. aba gopal sanga kati rupiya baki cha?', '750'),
    ('1step-money', 'sita ko jeb ma 980 rupiya thiyo; bazaar ma 155 rupiya ko kaka ma diyo. aba kati rupiya chha?', '825'),
    # ---- two steps, grounded, the intermediate carried
    ('2step-buy', 'mero paas 900 rupiya thiyo. maile 4 ota katha 175 rupiya ko kinyo. aba mero paas kati rupiya baki cha?', '200'),
    ('2step-buy', 'gopal sanga 1500 rupiya thiyo. usle 3 wata kalam 250 rupiya ko kinyo. aba gopal sanga kati rupiya baki cha?', '750'),
    ('2step-buy', 'sita le 5 wata kukur 60 rupiya ko kinyo. usko sanga 500 rupiya thiyo. aba kati rupiya bakaicha?', '200'),
    ('2step-buy', 'mero haath ma 1200 rupiya thyo. 6 ota penko 95 rupiya ko kinyo. aba kati rupiya baaki cha?', '630'),
    ('2step-time', 'gadi 45 km per hour le 4 ghanta chalayo ani 30 km arko chalayo. jamma kati km bayo?', '210'),
    ('2step-time', 'bus 20 km per hour le 3 ghanta chala, ani 40 km thaqi chala. total kati km ho?', '100'),
    # ---- two steps, add then subtract
    ('2step-mix', 'ram sanga 18 wata kalam thiyo. usle 7 wata diyo ani 5 wata aayo. aba ram sanga kati wata kalam chha?', '16'),
    ('2step-mix', 'sita sanga 45 wata thiyo. 12 wata kata, 20 wata pauyo. aba kati wata baki cha?', '53'),
    # ---- pick the right number (the others are distractors)
    ('pick', 'gopal ko 3 jana beta chhan ra sita ko 5 jana. dui jana bata kati jana chha?', '5'),
    ('pick', 'maya ko umar 24 barsha ho, ra uski bahini ko 19 barsha. bahini kati barsha ko chha?', '19'),
    ('pick', 'bikram le 8 ota kukur kinyo, ra 5 ota sita le kinyo. bikram sanga kati ota kukur chha?', '8'),
    # ---- inverse verbs (away / lost / gave -> subtract)
    ('away', 'momo ko 12 ota thiyo, 5 ota khaiyera gayo. aba kati ota momo baki cha?', '7'),
    ('away', 'sita le 14 ota kalam kinyo, 6 ota bata gayo. aba sita sanga kati ota kalam chha?', '8'),
    ('away', 'ram ko 25 ota kukur thiyo, 9 ota bikeu. aba kati ota kukur baki cha?', '16'),
    # ---- percent, average, division with a remainder
    ('percent', 'euta joga ko mol 800 rupiya ko chha. 25% chhut pachhi aba kati rupiya tirne?', '600'),
    ('average', 'gopal sanga 30 wata kalam cha ra sita sanga 50 wata. duijon lai jamma 80 wata bata ek jana jamma dinu bhanda kati wata pauyera?', '40'),
    ('divide', '37 wata katha 4 jana lai jamma dinu bhanda kati bachcha?', '9'),
    # ---- the formula form, without a story (the ladder's L2 shape)
    ('formula', '39 - (8 x 2) = ?', '23'),
    ('formula', '54 - (7 x 3) = ?', '33'),
    ('formula', '80 - (6 x 5) = ?', '50'),
    # ---- English, one and two steps
    ('english-1', 'Ram had 900 dollars. He spent 275 dollars. How much does he have left?', '625'),
    ('english-2', 'Asha had 800 dollars. She bought 4 pens at 95 dollars each. How much is left?', '420'),
    # ---- a distractor-heavy two step
    ('2step-distract', 'aaj ko din 23 ho. ram sanga 640 rupiya thiyo. usle 3 wata notebook 85 rupiya ko kinyo. aba ram sanga kati rupiya baki cha?', '385'),
]


def answer(model, tok, msgs, max_new=170):
    ids, _ = render_chat(tok, msgs + [N('x')])
    cut = len(ids) - 1 - ids[::-1].index(6)
    out = generate_ar(model, ids[:cut + 1], max_new, temperature=0.0)
    return tok.decode(out).split('<|/think|>')[-1].replace('<|end|>', '').strip()


def load_any(path):
    if path.endswith('.bin'):
        m = load_exported(path)
    else:
        ck = torch.load(path, map_location='cpu', weights_only=False)
        m = NikLM(NikConfig(**ck['cfg']))
        m.load_state_dict(ck['model'])
    m.eval()
    return m.to('cuda' if torch.cuda.is_available() else 'cpu')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--tok', default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                                   'web', 'model', 'tokenizer.json'))
    ap.add_argument('--out', default='')
    a = ap.parse_args()
    torch.set_grad_enabled(False)
    tok = Tokenizer.load(a.tok)
    model = load_any(a.model)
    rows, by_kind = [], {}
    for kind, q, gold in PROBES:
        ans = answer(model, tok, [U(q)])
        ok = gold in ans.replace(' ', '')
        by_kind.setdefault(kind, [0, 0])
        by_kind[kind][0] += ok
        by_kind[kind][1] += 1
        rows.append({'kind': kind, 'q': q, 'gold': gold, 'a': ans, 'ok': bool(ok)})
    total = sum(v[0] for v in by_kind.values())
    print(json.dumps({'model': a.model, 'passed': total, 'of': len(PROBES),
                      'by_kind': {k: f'{v[0]}/{v[1]}' for k, v in sorted(by_kind.items())}},
                     ensure_ascii=False))
    for r in rows:
        if not r['ok']:
            print('  FAIL', r['kind'], '|', r['q'][:78], '->', r['a'][:80].replace('\n', ' '))
    if a.out:
        with open(a.out, 'w', encoding='utf8') as f:
            json.dump({'model': a.model, 'passed': total, 'of': len(PROBES),
                       'by_kind': {k: f'{v[0]}/{v[1]}' for k, v in by_kind.items()},
                       'rows': rows}, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
