"""The shape probe: the five compositions the failing bench items named.

Local-C, issue #9 (2026-10-21).  p8 was 76.0% on the nested bench and still lost 34 of
the 288 items; reading the scratchpads of those items named five *specific* shapes it
could not do:

    (a + b) - c        the two counts first, then the absent ones
    (a x b) - c        the intermediate gets muddled ("24 ... 28")
    the percent        applied to *each* of N items, not to the total
    (a / 2) - b        the half first
    the rule inference  the sequence states no rule ("14, 28, 56, ...")

and four three-step ones:

    a - b - c          the money goes out twice
    (a x b) with a percent off the total
    (a / 2) + b        half of it, plus something
    (a - b) / c        the items into boxes

This probe measures *those shapes* and nothing else, on surfaces that are not in the
training data (hand-written, different nouns, different verbs, different distractors,
different numbers), so a rise here is the mechanism and not the template.

    python nik/scripts/shape_probe.py --model nik/web/model/nik-0.1.bin
    python nik/scripts/shape_probe.py --model <bin> --out nik/web/model/logs/<tag>/shape-<tag>.json
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
    # ---- (a + b) - c
    ('add-then-minus', 'aafai ma 23 keti ra 19 ghar chhan. 8 ghar le aafai bata gaye. aba aafai ma kati ghar chhan?', '34'),
    ('add-then-minus', 'school ma 41 keta ra 26 keti chhan. 11 keta le school bata nikalke. aba school ma kati chha?', '56'),
    ('add-then-minus', 'bazar ma 17 wata mithu ra 22 wata karko thiyo. 9 wata milayo. aba kati wata baki cha?', '30'),
    ('add-then-minus', 'ghar ma 28 jana chhan: 15 jana purkhar, 13 jana nari. 12 jana bahira gaye. aba ghar ma kati jana chhan?', '16'),
    # ---- (a x b) - c
    ('mul-then-minus', 'thela ma 8 kanda thiyo, har kanda ma 12 wata. 19 wata nikalayo. aba kati wata baki cha?', '77'),
    ('mul-then-minus', 'jhola ma 6 kanda thiyo, har kanda ma 9 wata. 14 wata nikalayo. aba jhola ma kati wata cha?', '40'),
    ('mul-then-minus', 'crate ma 7 kanda thiyo, har kanda ma 15 wata. 23 wata nikalayo. aba kati wata baki cha?', '82'),
    # ---- the percent, per item, times N
    ('percent-each', 'ek notebook ko mol 250 rupiya ko chha. 20% bhat pachhi 3 wata notebook ko kati rupiya tirne?', '600'),
    ('percent-each', 'ek khidai ko mol 400 rupiya ko chha. 50% bhat pachhi 4 wata khidai ko kati rupiya tirne?', '800'),
    ('percent-each', 'ek jhanda ko mol 600 rupiya ko chha. 10% bhat pachhi 5 wata jhanda ko kati rupiya tirne?', '2700'),
    # ---- (a / 2) - b
    ('half-minus', 'kaka sanga 56 ota thiyo. aadha usle diyo. aayera 9 ota khatayo. aba kati ota baki cha?', '19'),
    ('half-minus', 'didi sanga 84 rupiya thiyo. aadha bahira diyo. 15 rupiya khatayo. aba kati rupiya baki cha?', '27'),
    ('half-minus', 'ghar ma 62 ota thiyo. aadha banaayo. 8 ota khaayo. aba kati ota chha?', '23'),
    # ---- the rule is not stated: infer it
    ('infer-rule', 'number ko series: 6, 12, 24, 48, ... aba aune k ho?', '96'),
    ('infer-rule', 'number ko series: 5, 10, 20, 40, ... aune k ho?', '80'),
    ('infer-rule', 'number ko series: 3, 6, 12, 24, ... aune k ho?', '48'),
    ('infer-rule', 'number ko series: 4, 8, 16, 32, ... aba k aauncha?', '64'),
    # ---- the additive rule, inferred
    ('infer-add', 'number ko series: 7, 11, 15, 19, ... aba k aauncha?', '23'),
    ('infer-add', 'number ko series: 4, 9, 14, 19, ... aune k ho?', '24'),
    # ---- three steps: a - b - c
    ('three-money', 'mahina ko 9000 rupaya thiyo. bhuya ko 2400 diyo ani bhat ko 1500 kina. aba kati rupaya bacheko?', '5100'),
    ('three-money', 'jamma 15000 rupaya chha. 4500 ra 3000 rupaya khatayo. aba kati bacheko?', '7500'),
    # ---- three steps: (a x b) with a percent off the total
    ('group-discount', '6 jana lai 350 rupiya ko ticket kinyo. 20% discount. aba kati rupiya tirne?', '1680'),
    ('group-discount', '4 wata 250 rupiya ko kina. 25% bhat aayo. aba kati rupaya tirne?', '750'),
    # ---- three steps: (a / 2) + b
    ('half-plus', 'ek jhola ma 40 ota thiyo, aadha jana le liyo. Baki le 7 ota liyo. aba jhola ma kati ota bacha?', '13'),
    ('half-plus', 'aadha 30 ota ma thiyo, maile 9 ota add gare. aba kati ota chha?', '24'),
    # ---- three steps: (a - b) / c
    ('div-after-minus', '90 ota ma 10 ota kina. Baki 80 ota ma 4 ota ko kanda banaune. har kanda ma kati ota huncha?', '20'),
    ('div-after-minus', '120 ota ma 20 ota chhauchha. Baki 100 ota 5 ota ko kanda ma rakhne. har kanda ma kati ota huncha?', '20'),

    # ---------------------------------------------------------------- the paraphrases
    # The same shapes, asked the way a person would ask them - no "kram" hints, no
    # order given, no template.  The gap between this block and the one above IS the
    # generalization gap: the owner showed a paraphrase of a weekday question that the
    # model answers perfectly in the benchmark's own wording and with pure noise in
    # real-world wording.
    ('para-add-minus', 'kaksha ma 12 keta ra 19 keti chhan. 5 keta le aayo. aba kaksha ma kati jana chha?', '26'),
    ('para-add-minus', 'bazar ma 14 wata sana ra 11 wata karko thiyo. 6 wata milayo. aba kati wata baki cha?', '19'),
    ('para-mul-minus', 'thela ma 5 kanda thiyo, har kanda ma 11 wata. 13 wata nikalayo. aba kati wata cha?', '42'),
    ('para-percent-each', 'ek khidai ko mol 300 rupiya ho. 20% bhat pachhi 3 wata khidai ko kati rupiya tirne?', '720'),
    ('para-percent-each', 'ek jhanda ko mol 500 rupiya ho. 10% bhat pachhi 4 wata jhanda ko kati rupiya tirne?', '1800'),
    ('para-half', 'kaka sanga 70 ota thiyo. aadha usle liyo. 12 ota khatayo. aba kati ota baki cha?', '23'),
    ('para-half', 'didi sanga 50 rupiya thiyo. aadha bahira diyo. 8 rupiya khatayo. aba kati rupiya bacha?', '17'),
    ('para-infer-rule', 'kram: 7, 14, 28, 56, ... aune k ho?', '112'),
    ('para-infer-rule', 'yo series ko aune k ho: 9, 18, 36, 72, ...?', '144'),
    ('para-three-money', 'mahina ko 12000 rupaya thiyo. bhuya ko 3000 diyo ani bhat ko 2500 kina. aba kati rupaya bacheko?', '6500'),
    ('para-group-discount', '5 jana lai 400 rupiya ko ticket kinyo. 20% discount. aba kati rupiya tirne?', '1600'),
    ('para-half-plus', '40 ota ko aadha ma thiyo, maile 11 ota add gare. aba kati ota chha?', '31'),
    ('para-div-after-minus', '100 ota ma 25 ota chhauchha. Baki 75 ota 3 ota ko kanda ma rakhne. har kanda ma kati ota huncha?', '25'),

    # ---- the weekday: the benchmark's own wording states the day order, the
    #      paraphrase states nothing - and the model answers them very differently
    ('weekday-template', 'aaja sombar ho. 3 din pachhi kun bar? (bar ko kram number: aaitabar 1 ... sanibar 7)', '5'),
    ('weekday-paraphrase', 'aaja sombar ho bhane 3 din pachhi kun bar hunchha?', '5'),
    ('weekday-paraphrase', 'sombar bata 3 din pachhi ko din kun ho?', '5'),
    ('weekday-paraphrase', 'sombar diye 3 din gatayo, tyo din kun ho?', '5'),
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
            print('  FAIL', r['kind'], '|', r['q'][:74], '->', r['a'][:90].replace('\n', ' '))
    if a.out:
        os.makedirs(os.path.dirname(a.out), exist_ok=True)
        with open(a.out, 'w', encoding='utf8') as f:
            json.dump({'model': a.model, 'passed': total, 'of': len(PROBES),
                       'by_kind': {k: f'{v[0]}/{v[1]}' for k, v in by_kind.items()},
                       'rows': rows}, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
