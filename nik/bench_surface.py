"""Surface matrix: the same skill asked three different ways.

Live v4f scores understanding 13/26, yet `250 x 4 kati?` works while
`euta kitab 250 rupiya ko chha. 4 wata...` does not. One 26-probe number cannot tell
those failures apart, and a "fix" that only re-tunes the probe surface looks identical
to one that restores the skill.

Each case is one skill with three surfaces:
  probe - the shape eval_understand.py uses (quoted slot, English prose, story framing)
  alt   - the same skill with the trigger removed (no quotes, romanised, digits only)
  alt2  - a second alt, further from any training template

Verdicts (see `classify`):
  brittle - fails probe, passes an alt  -> the skill is in the weights, the surface beats it
  missing - fails all three             -> the capability is really gone
  fragile - passes probe, fails alts    -> it memorised the probe shape (the worst case)
  solid   - passes all
This is why a model that scores 20/26 and a model that scores 20/26 are not the same model.

Content is disjoint from the evals and from the generators' worlds; `nik/tests/test_bench_surface.py`
checks that against a real mix.

    python nik/bench_surface.py --model nik/web/model/nik-0.1.bin --out surface.json
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from eval_understand import answer, load_any  # noqa: E402

U = lambda t: {'role': 'user', 'content': t}  # noqa: E731
N = lambda t: {'role': 'nik', 'content': t}   # noqa: E731

# (skill, [(surface, context, question, expected)])  expected entry: str, or tuple = any-of
CASES = [
    ('vocab-dust', [
        ('probe', [], 'english ko "dust" lai nepali ma k bhanchha?', [('dhulo', 'dhuwo')]),
        ('alt', [], 'dust ko nepali sabda ke ho?', [('dhulo',)]),
        ('alt2', [], 'dhulo lai english ma k bhaninchha?', [('dust',)]),
    ]),
    ('vocab-umbrella', [
        ('probe', [], 'english ko "umbrella" lai nepali ma k bhanchha?', [('chhata', 'chat', 'chhyattu')]),
        ('alt', [], 'chhata ko english ke hunchha?', [('umbrella',)]),
        ('alt2', [], 'haati le chhata jasto saman, rain ma kun liyera hunchha, nepali ma bhana.',
         [('chhata', 'chat')]),
    ]),
    ('translate-progressive', [
        ('probe', [], '"they are eating" nepali ma bhana.', [('khadai', 'khaadai')]),
        ('alt', [], 'they are eating lai nepali ma bhana.', [('khadai',)]),
        ('alt2', [], 'english ma they are eating lekhyo, nes garda k hunchha?', [('khadai',)]),
    ]),
    ('wordproblem-english', [
        ('probe', [], 'Tulasi had 9 pens and 4 broke. How many does she have now?', [('5',)]),
        ('alt', [], 'tulasi ko sanga 9 pen thiyo, 4 bezale. aba kati baki?', [('5',)]),
        ('alt2', [], '9 bata 4 ghatne ho bhane kati?', [('5',)]),
    ]),
    ('wordproblem-money', [
        ('probe', [], 'euta topi 180 rupiya ko chha. 3 wata topi ko kati parchha?', [('540',)]),
        ('alt', [], 'topi ko euta 180 rupiya, 3 topi ko jamma kati?', [('540',)]),
        ('alt2', [], '180 x 3 kati?', [('540',)]),
    ]),
    ('wordproblem-change', [
        ('probe', [], 'mero sanga 700 rupiya thiyo. 240 kharcha bhayo. kati baki?', [('460',)]),
        ('alt', [], '700 ma bata 240 gayo pachi kati bachchha?', [('460',)]),
        ('alt2', [], '700 minus 240 kati?', [('460',)]),
    ]),
    ('memory-age', [
        ('probe', [U('meri thuldai ko naam kiran ho ra u 9 barsha ko chha.')],
         'thuldai kati barsha ko bhayo?', [('9',)]),
        ('alt', [U('meri thuldai ko naam kiran ho ra u 9 barsha ko chha.')],
         'kiran kati barsha ko chha?', [('9',)]),
        ('alt2', [U('meri thuldai ko naam kiran ho ra u 9 barsha ko chha.')],
         'umar bhana: kiran kati ko?', [('9',)]),
    ]),
    ('memory-place', [
        ('probe', [U('ma pahila hetauda ma basthe, aile pokhara ma baschhu.')],
         'aile ma kaha basti chhu?', [('pokhara',)]),
        ('alt', [U('ma pahila hetauda ma basthe, aile pokhara ma baschhu.')],
         'aile ma basne sahar ko naam ke?', [('pokhara',)]),
        ('alt2', [U('ma pahila hetauda ma basthe, aile pokhara ma baschhu.')],
         'hetauda ki pokhara: aile kata, ek shabda.', [('pokhara',)]),
    ]),
    ('memory-preference', [
        ('probe', [U('malai dahi bhanda lassi badi man parchha.'), N('lassi ramro!')],
         'malai kun badi man parchha bhaneko?', [('lassi',)]),
        ('alt', [U('malai dahi bhanda lassi badi man parchha.'), N('lassi ramro!')],
         'dahi ki lassi, malai kun parchha?', [('lassi',)]),
        ('alt2', [U('malai dahi bhanda lassi badi man parchha.'), N('lassi ramro!')],
         'maile mitho bhaneko dudh ko pierko ke ho?', [('lassi',)]),
    ]),
    ('lettercount', [
        ('probe', [], 'english ko "palang" ma kati akshar chha?', [('6',)]),
        ('alt', [], 'palang bhanne sabda ma kati wata akshar hunchha?', [('6',)]),
        ('alt2', [], 'p-a-l-a-n-g: jamma kati akshar?', [('6',)]),
    ]),
    ('context-compare', [
        ('probe', [], 'afsama 21 jana le kiji gare ra 13 jana le baje gare. kiji gare ko badi, ra kati le?',
         [('8',)]),
        ('alt', [], '21 le kiji gare, 13 le baje gare. kun samuh badi, kati le?', [('8',)]),
        ('alt2', [], '21 bata 13 ghatne bhane kati?', [('8',)]),
    ]),
    ('yesno-from-context', [
        ('probe', [], '"nirmal ghar gayo tara roshan office mai basyo." ke roshan ghar gayo?', [('hoina',)]),
        ('alt', [], 'nirmal ghar gayo tara roshan office mai basyo. roshan ghar gareko chha?', [('hoina',)]),
        ('alt2', [], 'nirmal ghar gayo. roshan chai office mai basyo. roshan le ghar gayo, ho ki hoina?',
         [('hoina',)]),
    ]),
    ('reading-agent', [
        ('probe', [], '"deepa le bazaar bata 4 kilo baigun ra 7 kilo kauli kinyo." deepa le kati kilo kauli kinyo?',
         [('7',)]),
        ('alt', [], 'deepa le 4 kilo baigun ra 7 kilo kauli kinisaki, kauli kati kilo?', [('7',)]),
        ('alt2', [], 'deepa le baigun 4 kilo ra kauli 7 kilo kinyo. kauli ko kilo bhana.', [('7',)]),
    ]),
]


def want_hit(ans, want):
    """every expected slot must match; a tuple slot passes on any of its spellings"""
    low = ans.lower()
    for w in want:
        alts = w if isinstance(w, (tuple, list)) else (w,)
        if not any(re.search(r'(?<![\w])' + re.escape(a.lower()) + r'(?![\w])', low) for a in alts):
            return False
    return True


def score_matrix(model, tok, max_new=80):
    rows = []
    for skill, surfaces in CASES:
        for name, ctx, q, want in surfaces:
            ans = answer(model, tok, ctx + [U(q)], max_new=max_new)
            rows.append({'skill': skill, 'surface': name, 'q': q, 'a': ans,
                         'pass': bool(want_hit(ans, want))})
    return rows


def classify(rows):
    by = {}
    for r in rows:
        by.setdefault(r['skill'], {})[r['surface']] = r['pass']
    out = {}
    for skill, s in by.items():
        probe = s.get('probe')
        alts = [v for k, v in s.items() if k != 'probe']
        alt_any = any(alts)
        if probe is False and alt_any:
            out[skill] = 'brittle'
        elif probe is False:
            out[skill] = 'missing'
        elif probe and not alt_any:
            out[skill] = 'fragile'
        else:
            out[skill] = 'solid'
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--tok', default=os.path.join(os.path.dirname(__file__), 'web/model/tokenizer.json'))
    ap.add_argument('--out', default='')
    ap.add_argument('--max-new', type=int, default=80)
    a = ap.parse_args()
    import torch
    torch.set_grad_enabled(False)
    from tokenizer import Tokenizer
    tok = Tokenizer.load(a.tok)
    model = load_any(a.model)
    rows = score_matrix(model, tok, a.max_new)
    cls = classify(rows)
    for r in rows:
        print('[%s] %-20s %-5s %s -> %r' % ('PASS' if r['pass'] else 'FAIL', r['skill'],
                                            r['surface'], r['q'][:56], r['a'][:76].replace('\n', ' ')),
              flush=True)
    passed = sum(1 for r in rows if r['pass'])
    print('\nsurface matrix: %d/%d items pass' % (passed, len(rows)))
    for k in ('solid', 'brittle', 'fragile', 'missing'):
        names = [s for s, c in cls.items() if c == k]
        if names:
            print('  %-8s %2d  %s' % (k, len(names), ', '.join(names)))
    print('present-in-weights (solid+brittle): %d/%d skills' %
          (sum(1 for c in cls.values() if c in ('solid', 'brittle')), len(cls)))
    if a.out:
        json.dump({'items_pass': passed, 'items': len(rows), 'classify': cls, 'rows': rows},
                  open(a.out, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
