"""Is the live model's word-problem failure a SURFACE problem or a PROCEDURE problem?

The live model (v4c) scores **0/48** on the word category of NikBench, and the word
score has been 2/24 -> 1/48 -> 0/48 across v4, v4b and arm A: four training regimes,
four mixes, no movement.  Every word benchmark we have measures the *surface* (ten
fixed story templates), so the logs cannot tell us why it fails - and that is the
question that decides what the next 30 GPU-hours buy:

  * if the model cannot even EXECUTE a procedure that is written out for it, then the
    gap is arithmetic/multi-step execution, and more story frames (sft8 = frame.py) will
    not move it;
  * if it can execute the written-out procedure but fails the same numbers inside a
    story, then the gap is the story -> procedure mapping, and more frames is the right
    medicine (that is exactly what frame.py teaches);
  * if it solves the original template but not a paraphrase of it, the model has the
    template memorised and not the procedure - a different problem again.

So for every word template we generate three items with the SAME numbers and the same
answer:

  word-orig    the bench item, verbatim (the surface we already score 0 on)
  word-para    a paraphrase: same numbers and same entities, different wording
  word-formula the procedure written out, no story:
               "60 km/h x 3 h + 15 km = ?" - can the model execute it?

    python nik/scripts/word_procedure_probe.py --out /tmp/probe_items.json
    node nik/scripts/word_probe_run.mjs nik/web/model/nik-0.1.bin /tmp/probe_items.json \
        --out /tmp/probe_rows.json

The item format is the one nik/web/test_engine.mjs already takes: [cat, question, gold].
"""
from __future__ import annotations

import argparse
import json
import os
import random

NAMES = ['sita', 'gopal', 'maya', 'bikash', 'rekha', 'nabin', 'anu', 'sabin']

# each template: (name, builder) -> dict with the three phrasings and the gold
TEMPLATES = []


def template(name):
    def deco(fn):
        TEMPLATES.append((name, fn))
        return fn
    return deco


@template('chakleti')
def _chakleti(R):
    n = R.choice(NAMES)
    a = R.randint(20, 90)
    b = R.randint(2, 9)
    unit = R.randint(5, 40) // 5 + 1
    gold = a - b * unit
    return {
        'orig': f'{n} sanga {a} rupiya chha. usle {b} wata chakleti kinyo, ek ko {unit} rupiya. aba kati rupiya bachyo?',
        'para': f'{n} ko jana ma {a} rupiya thiyo. usle {b} wata chakleti {unit} rupiya each kinaubhayoo. abhi pugcha kati rupiya baki cha?',
        'formula': f'{n}: {a} rupiya thiyo. {b} chakleti x {unit} rupiya = ? aba kati rupiya baki?',
        'gold': gold,
    }


@template('bagaincha')
def _bagaincha(R):
    a = R.randint(3, 12)
    b = R.randint(3, 12)
    gold = a * b - 7
    return {
        'orig': f'euta bagaincha ma {a} wata line chhan ra har line ma {b} wata rukh. 7 wata rukh dhale bhane kati rukh baki?',
        'para': f'bagaincha ko {a} ta line chha, ani ek line ma {b} ta rukh pauincha. jati 7 ta rukh milaera use bhayo, baki kati ta rukh bachcha?',
        'formula': f'bagaincha: {a} line, har line ma {b} rukh. jamma {a} x {b} = ? tara 7 rukh use bhayo. baki kati rukh?',
        'gold': gold,
    }


@template('aalu')
def _aalu(R):
    p = R.randint(2, 9) * 10
    q = R.randint(2, 6)
    gold = p * q + 25
    return {
        'orig': f'ek kilo aalu {p} rupiya. {q} kilo aalu ra 25 rupiya ko dhaniya kinda jamma kati lagchha?',
        'para': f'aalu ko daam ek kilo ko {p} rupiya cha. {q} kilo lene sanga 25 rupiya ko bonus pani paunu cha. jamma kati rupiya lagcha?',
        'formula': f'{q} kilo aalu x {p} rupiya per kilo = ? tara 25 rupiya ko dhaniya pani add hunchha. jamma kati rupiya?',
        'gold': gold,
    }


@template('umera')
def _umera(R):
    n = R.choice(NAMES)
    a = R.randint(15, 40) * 2
    gold = a // 2 - 5
    return {
        'orig': f'{n} {a} barsha ko chha. usko chhora usko umer ko aadha bhanda 5 barsha kam chha. chhora kati barsha ko?',
        'para': f'{n} ko umar {a} barsha ho. chhora baba ko umar baba ko umer ko aadha bata 5 barsha sano cha. chhora ko umar kati barsha ho?',
        'formula': f'{n}: umar {a} barsha. aadha = {a} / 2. tara 5 barsha kam. chhora kati barsha ko?',
        'gold': gold,
    }


@template('bus')
def _bus(R):
    s = R.randint(4, 9) * 10
    h = R.randint(2, 5)
    gold = s * h + 15
    return {
        'orig': f'A bus travels at {s} km per hour for {h} hours, then 15 km more. How far did it travel in total?',
        'para': f'A bus drives {s} kilometers in every hour. It keeps moving for {h} hours and then covers 15 more kilometers. What is the total distance it travelled?',
        'formula': f'A bus: {s} km per hour x {h} hours = ? then + 15 km. Total distance?',
        'gold': gold,
    }


@template('kalam')
def _kalam(R):
    n = R.choice(NAMES)
    a = R.randint(5, 30)
    b = R.randint(5, 30)
    if (a + b) % 2:
        b += 1
    gold = (a + b) // 2
    return {
        'orig': f'{n} sanga {a} wata kalam thiyo. sathi le {b} wata diyo, ani usle aadha bahini lai diyo. aba usko sanga kati?',
        'para': f'ghar ko sathi sanga {a} ta kalam ra {b} ta kalam tha. sabai loka aadha jana le {n} lai diyo. aba {n} ko sanga kati kalam cha?',
        'formula': f'{n}: {a} kalam + {b} kalam = ? aadha (/) = how many pencils does {n} get?',
        'gold': gold,
    }


@template('boxes')
def _boxes(R):
    c = R.randint(3, 9)
    k = R.randint(4, 12)
    gold = k * c - 5
    return {
        'orig': f'There are {k} boxes with {c} apples each. 5 apples are rotten. How many good apples?',
        'para': f'{k} cartons are packed with {c} apples apiece. Out of all of them, 5 apples have gone bad. How many apples are still good to eat?',
        'formula': f'{k} boxes x {c} apples in each box = ? then subtract 5 rotten apples. How many good apples?',
        'gold': gold,
    }


@template('masik_talab')
def _masik_talab(R):
    n = R.choice(NAMES)
    w = R.randint(200, 900)
    gold = 3000
    return {
        'orig': f'{n} ko masik talab {w * 10} rupiya ho. usle 1000 rupiya bachat garchha. 3 mahina ma kati bachat?',
        'para': f'{n} le har mahina 1000 rupiya jamma garchha. usko bachat aba {w * 10} rupiya cha. agni 3 mahina ko aanta kati hunchha?',
        'formula': f'{n}: bachat 1000 rupiya per month. 3 months. Total saved?',
        'gold': gold,
    }


@template('kaksha')
def _kaksha(R):
    a = R.randint(10, 50)
    b = R.randint(10, 50)
    gold = a + b - 6
    return {
        'orig': f'kaksha ma {a} keta ra {b} keti chhan. 6 jana anupasthit chhan. kati jana upasthit?',
        'para': f'aaj kaksha ma {a} ta keta ra {b} ta keti chhan. tara 6 jana aaja absent chhan. aaj school aaune kati jana?',
        'formula': f'kaksha: {a} boys + {b} girls = ? then 6 absent. How many present?',
        'gold': gold,
    }


@template('kitab')
def _kitab(R):
    a = R.randint(2, 9)
    gold = 2 * a * 90
    return {
        'orig': f'euta kitab ko mol {a * 100} rupiya. 10% chhut pachhi 2 wata kitab ko kati tirne?',
        'para': f'ek kitab ko price {a * 100} rupiya ho, ani 10% discount dincha. aba euta jasto kitab 2 wata kide ko kati lagcha?',
        'formula': f'kitab: {a * 100} rupiya, 10% discount -> one book = ? then 2 books = ?',
        'gold': gold,
    }


VARIANTS = ('orig', 'para', 'formula')

# --- the execution ladder -------------------------------------------------------
# A story-free ladder that isolates one ability per level.  12 items per level, all
# built from the same 12 (a, b, c) triples, so the levels are directly comparable:
#
#   L1  one step                     "39 - 8 = ?"                 can it compute?
#   L2  two steps, composed          "39 - (8 x 2) = ?"            can it compose?
#   L3  two steps, intermediate given "39 - 16 = ?"                can it use a result?
#   L4  two steps as a chain        "8 x 2 = ? ani 39 - 16 = ?"    can it chain lines?
#
# L1..L4 have no entities, no story and no Nepali - so a failure cannot be blamed on
# the surface.  This is the probe that says whether the model can do the *procedure*.
LADDER_CASES = [(39, 8, 2), (4, 11, 7), (30, 4, 25), (62, 2, 5), (50, 2, 15), (18, 18, 2),
                (7, 3, 5), (37, 13, 6), (300, 90, 2), (1000, 3, 1), (45, 6, 4), (25, 7, 3)]


def ladder():
    """-> items for the execution ladder (L1..L4)"""
    items = []
    for a, b, c in LADDER_CASES:
        inter = b * c
        items.append(['L1-1step', f'{a} - {b} = ?', a - b])
        items.append(['L2-2step', f'{a} - ({b} x {c}) = ?', a - inter])
        items.append(['L3-intermediate-given', f'{a} - {inter} = ?', a - inter])
        items.append(['L4-chain-2line', f'{b} x {c} = ? ani {a} - {inter} = ?', a - inter])
    return items


def build(n_per_template=1, seed=7, with_ladder=False):
    """-> (items, meta).  items are [cat, question, gold] for the engine harness."""
    R = random.Random(seed)
    items, meta = [], []
    for name, fn in TEMPLATES:
        for i in range(n_per_template):
            d = fn(R)
            for v in VARIANTS:
                cat = f'word-{v}'
                items.append([cat, d[v], d['gold']])
                meta.append({'cat': cat, 'template': name, 'variant': v, 'gold': d['gold'],
                             'q': d[v]})
    if with_ladder:
        for cat, q, gold in ladder():
            items.append([cat, q, gold])
            meta.append({'cat': cat, 'template': 'ladder', 'variant': cat, 'gold': gold, 'q': q})
    return items, meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True, help='items json for the engine')
    ap.add_argument('--meta', default='', help='where to write the per-item metadata')
    ap.add_argument('--n', type=int, default=1, help='items per template')
    ap.add_argument('--seed', type=int, default=7)
    ap.add_argument('--ladder', action='store_true', help='also emit the L1-L4 execution ladder')
    a = ap.parse_args()
    items, meta = build(a.n, a.seed, with_ladder=a.ladder)
    json.dump(items, open(a.out, 'w', encoding='utf8'), ensure_ascii=False)
    if a.meta:
        json.dump(meta, open(a.meta, 'w', encoding='utf8'), indent=1, ensure_ascii=False)
    print(f'{len(items)} items ({len(TEMPLATES)} templates x {a.n} x {len(VARIANTS)} variants) -> {a.out}')


if __name__ == '__main__':
    main()
