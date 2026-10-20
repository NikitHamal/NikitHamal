"""NikBench: held-out math + reasoning benchmark with per-category accuracy.

Templates here are written separately from the training generators (different wording and
structure), numbers come from a fixed seed, and scoring is exact match on the final number of
the answer. Categories:
  arith:  add 2/3/4/5-digit, sub 3/4-digit, mul 2x1 / 3x1 / 2x2 / 3x2, div 3/4-digit by 1-digit
  word:   multi-step word problems (2-3 operations), romanized Nepali and English
  reason: day-of-week arithmetic, sequences, comparisons, ages, unit conversion

    python nik/bench.py --model nik/web/model/nik-0.1.bin --n 15 --out bench.json
"""
import argparse, json, os, random, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import torch  # noqa: E402
from eval_understand import load_any  # noqa: E402
from model import generate_ar  # noqa: E402
from prepare import render_chat  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402

NAMES = ['aarati', 'bibek', 'chandra', 'deepa', 'ganesh', 'indira', 'janak', 'kamala', 'laxmi', 'mohan', 'nirmala', 'pawan']
DAYS = ['aaitabar', 'sombar', 'mangalbar', 'budhabar', 'bihibar', 'sukrabar', 'sanibar']


def d(R, k):
    return R.randint(10 ** (k - 1), 10 ** k - 1)


def arith(R, kind):
    if kind.startswith('add'):
        k = int(kind[3]); a, b = d(R, k), d(R, k)
        return R.choice([f'{a} ra {b} ko jod kati?', f'{a} + {b} = ?', f'jodnus {a} ra {b}']), a + b
    if kind.startswith('sub'):
        k = int(kind[3]); a, b = sorted([d(R, k), d(R, k)], reverse=True)
        return R.choice([f'{a} - {b} = ?', f'{a} bata {b} ghatau', f'{a} ra {b} ko farak kati?']), a - b
    if kind.startswith('mul'):
        x, y = int(kind[3]), int(kind[5]); a, b = d(R, x), d(R, y)
        b = max(b, 2)
        return R.choice([f'{a} x {b} = ?', f'{a} ko {b} guna kati?', f'gunan garnus {a} x {b}']), a * b
    k = int(kind[3]); b = R.randint(2, 9); q = R.randint(10 ** (k - 2), (10 ** k - 1) // b)
    return R.choice([f'{q * b} / {b} = ?', f'{q * b} lai {b} barabar bhag ma bandda ek bhag kati?']), q


def word(R):
    n = R.choice(NAMES)
    t = R.randint(0, 9)
    if t == 0:
        a, b, c = R.randint(20, 90), R.randint(2, 9), R.randint(5, 40)
        return f'{n} sanga {a} rupiya chha. usle {b} wata chakleti kinyo, ek ko {c // 5 + 1} rupiya. aba kati rupiya bachyo?', a - b * (c // 5 + 1)
    if t == 1:
        a, b = R.randint(3, 12), R.randint(3, 12)
        return f'euta bagaincha ma {a} wata line chhan ra har line ma {b} wata rukh. 7 wata rukh dhale bhane kati rukh baki?', a * b - 7
    if t == 2:
        p, q = R.randint(2, 9) * 10, R.randint(2, 6)
        return f'ek kilo aalu {p} rupiya. {q} kilo aalu ra 25 rupiya ko dhaniya kinda jamma kati lagchha?', p * q + 25
    if t == 3:
        a = R.randint(15, 40) * 2
        return f'{n} {a} barsha ko chha. usko chhora usko umer ko aadha bhanda 5 barsha kam chha. chhora kati barsha ko?', a // 2 - 5
    if t == 4:
        s, h = R.randint(4, 9) * 10, R.randint(2, 5)
        return f'A bus travels at {s} km per hour for {h} hours, then 15 km more. How far did it travel in total?', s * h + 15
    if t == 5:
        a, b = R.randint(5, 30), R.randint(5, 30)
        return f'{n} sanga {a} wata kalam thiyo. sathi le {b} wata diyo, ani usle aadha bahini lai diyo. aba usko sanga kati?', (a + b) // 2 if (a + b) % 2 == 0 else None
    if t == 6:
        c, k = R.randint(3, 9), R.randint(4, 12)
        return f'There are {k} boxes with {c} apples each. 5 apples are rotten. How many good apples?', k * c - 5
    if t == 7:
        w = R.randint(200, 900)
        return f'{n} ko masik talab {w * 10} rupiya ho. usle 1000 rupiya bachat garchha. 3 mahina ma kati bachat?', 3000
    if t == 8:
        a, b = R.randint(10, 50), R.randint(10, 50)
        return f'kaksha ma {a} keta ra {b} keti chhan. 6 jana anupasthit chhan. kati jana upasthit?', a + b - 6
    a = R.randint(2, 9)
    return f'euta kitab ko mol {a * 100} rupiya. 10% chhut pachhi 2 wata kitab ko kati tirne?', 2 * a * 90


def reason(R):
    t = R.randint(0, 5)
    if t == 0:
        i, k = R.randint(0, 6), R.randint(2, 20)
        return f'aaja {DAYS[i]} ho. {k} din pachhi kun bar? (bar ko kram number: aaitabar 1 ... sanibar 7)', ((i + k) % 7) + 1
    if t == 1:
        a, s = R.randint(1, 20), R.randint(2, 9)
        seq = [a + s * j for j in range(4)]
        return f'shrinkhala: {", ".join(map(str, seq))}, ... arko number?', a + s * 4
    if t == 2:
        a, b = R.randint(5, 40), R.randint(2, 6)
        seq = [a * b ** j for j in range(3)]
        return f'pattern: {", ".join(map(str, seq))}, ... aba aaune?', a * b ** 3
    if t == 3:
        x, y = R.randint(5, 20), R.randint(1, 9)
        return f'ram shyam bhanda {y} barsha jetho chha. shyam {x} barsha ko. 5 barsha pachhi ram kati barsha ko hunchha?', x + y + 5
    if t == 4:
        m = R.randint(2, 9)
        return f'{m} kilometer ma kati meter hunchha?', m * 1000
    h = R.randint(2, 9)
    return f'{h} ghanta ma kati minute?', h * 60


ARITH = ['add2', 'add3', 'add4', 'add5', 'sub3', 'sub4', 'mul2x1', 'mul3x1', 'mul2x2', 'mul3x2', 'div3', 'div4']


def items(n, seed=2026):
    R = random.Random(seed)
    out = [('arith-' + k,) + arith(R, k) for k in ARITH for _ in range(n)]
    while len([o for o in out if o[0] == 'word']) < 3 * n:
        q, g = word(R)
        if g is not None and g >= 0:
            out.append(('word', q, g))
    out += [('reason',) + reason(R) for _ in range(3 * n)]
    return out


def final_number(text):
    nums = re.findall(r'-?\d+(?:\.\d+)?', text.replace(',', ''))
    return nums[-1] if nums else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--tok', default=os.path.join(os.path.dirname(__file__), 'web/model/tokenizer.json'))
    ap.add_argument('--n', type=int, default=15, help='items per arithmetic category (word/reason get 3n each)')
    ap.add_argument('--out', default='')
    a = ap.parse_args()
    torch.set_grad_enabled(False)
    tok = Tokenizer.load(a.tok)
    model = load_any(a.model)
    res, rows = {}, []
    for cat, q, g in items(a.n):
        ids, _ = render_chat(tok, [{'role': 'user', 'content': q}])
        text = tok.decode(generate_ar(model, ids[:-1] + [6], 320, temperature=0.0))
        ans = text.split('<|/think|>')[-1]
        ok = final_number(ans) == str(g)
        c = res.setdefault(cat, [0, 0]); c[0] += ok; c[1] += 1
        rows.append({'cat': cat, 'q': q, 'gold': g, 'out': text[-300:], 'ok': ok})
    tot = sum(v[0] for v in res.values()), sum(v[1] for v in res.values())
    groups = {}
    for k, (o, t) in res.items():
        g = groups.setdefault(k.split('-')[0], [0, 0]); g[0] += o; g[1] += t
    for k, (o, t) in sorted(res.items()):
        print(f'{k:14s} {o:3d}/{t:<3d} {o / t:6.1%}')
    print('groups:', {k: f'{o}/{t} ({o / t:.1%})' for k, (o, t) in groups.items()})
    print(f'NikBench overall: {tot[0]}/{tot[1]} ({tot[0] / tot[1]:.1%})')
    if a.out:
        json.dump({'overall': tot[0] / tot[1], 'by_cat': res, 'groups': groups, 'rows': rows}, open(a.out, 'w'), indent=1)


if __name__ == '__main__':
    main()
