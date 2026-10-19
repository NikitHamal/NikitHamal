"""Self-improvement by rejection-sampling fine-tuning (STaR / RFT / expert iteration).

Nik solves fresh problems whose answers we know, samples K reasoning paths per
problem, keeps only paths that reach the right answer, and is fine-tuned on its
own successful reasoning. Repeat for a few rounds: each round the model's
reasoning distribution sharpens toward what actually works.

  Zelikman et al. 2022 (STaR) · Yuan et al. 2023 (RFT) · Singh et al. 2024 (ReST-EM).

Problems that are solved sometimes (1..K-1 of K) carry the most signal and are
kept preferentially; always-solved ones are kept once; never-solved ones are
reported (they show where the next round of data should go).

    python nik/selfimprove.py --model nik/runs/nik-0.1/sft/ckpt.pt --out data/rft.jsonl --problems 3000 --k 8
    python nik/prepare.py --data data --sft-only --sft-name rft      # -> data/rft_tok.bin / rft_mask.bin
    python nik/train.py --stage sft --sft-name rft --init nik/runs/nik-0.1/sft/ckpt.pt --out nik/runs/nik-0.1/rft1 \
                        --steps 1500 --lr 5e-4 --mix 0.2
"""
from __future__ import annotations
import argparse, collections, json, os, random, re, sys, time

import torch

sys.path.insert(0, os.path.dirname(__file__))
from model import NikConfig, NikLM, generate_batch  # noqa: E402
from prepare import render_chat  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402

DAYS = ['aaitabar', 'sombar', 'mangalbar', 'budhabar', 'bihibar', 'sukrabar', 'sanibar']
NAMES = ['ram', 'sita', 'hari', 'gita', 'bikash', 'anita', 'suman', 'pooja', 'nabin', 'maya']
ITEMS = ['syau', 'suntala', 'kalam', 'kitab', 'chakleti', 'kapi', 'kera']


def problems(n: int, seed: int):
    """Yields (question, gold, kind). gold is an int or a weekday string."""
    R = random.Random(seed)
    for _ in range(n):
        k = R.random()
        if k < 0.22:
            a, b = R.randint(10, 9999), R.randint(10, 999)
            yield R.choice([f'{a} + {b} kati hunchha?', f'{a} ra {b} jod']), a + b, 'add'
        elif k < 0.40:
            a, b = sorted([R.randint(10, 9999), R.randint(10, 999)], reverse=True)
            yield R.choice([f'{a} - {b} kati hunchha?', f'{a} bata {b} ghatau']), a - b, 'sub'
        elif k < 0.54:
            a, b = R.randint(11, 999), R.randint(2, 30)
            yield R.choice([f'{a} x {b} kati hunchha?', f'{a} lai {b} le gunan gara']), a * b, 'mul'
        elif k < 0.62:
            b, c = R.randint(2, 12), R.randint(2, 99)
            yield f'{b * c} / {b} kati hunchha?', c, 'div'
        elif k < 0.80:
            n_, it = R.choice(NAMES), R.choice(ITEMS)
            a, b = R.randint(3, 40), R.randint(1, 20)
            if R.random() < 0.5:
                yield f'{n_} sanga {a} wata {it} thiyo. aama le {b} wata thap dinubhayo. aba jamma kati bhayo?', a + b, 'word+'
            else:
                b = min(b, a)
                yield f'{n_} sanga {a} wata {it} chha. usle {b} wata sathi lai diyo. aba {n_} sanga kati {it} baki chha?', a - b, 'word-'
        elif k < 0.90:
            price, qty = R.choice([5, 10, 15, 20, 25, 30, 45, 50]), R.randint(2, 12)
            yield f'ek wata {R.choice(ITEMS)} ko {price} rupiya parchha. {qty} wata kinda kati rupiya lagchha?', price * qty, 'price'
        else:
            i, d = R.randrange(7), R.randint(1, 10)
            phr = {1: 'bholi', 2: 'parsi'}.get(d, f'{d} din pachhi')
            yield f'aaja {DAYS[i]} ho bhane {phr} kun bar hunchha?', DAYS[(i + d) % 7], ('day', DAYS[i], d)


def split(text: str):
    think, ans = '', text
    if '<|think|>' in text and '<|/think|>' in text:
        think = text.split('<|think|>', 1)[1].split('<|/think|>', 1)[0].strip()
        ans = text.split('<|/think|>', 1)[1]
    return think, ans.replace('<|end|>', '').replace('<|eos|>', '').strip()


EQ = re.compile(r'(-?\d+(?:\s*[+\-x*/]\s*\d+)+)\s*=\s*(-?\d+)')


def steps_valid(think: str, gold, kind) -> bool:
    """Process check: every equation in the trace must be true and the trace must
    actually arrive at the gold answer. Lucky guesses with broken reasoning are
    rejected, so self-training only reinforces sound reasoning."""
    if isinstance(kind, tuple):                       # weekday walk
        _, start, d = kind
        chain = [w.strip(' .') for w in think.split('->')]
        return f'{start} bata {d} din' in think and len(chain) == d + 1 and chain[0].split()[-1] == start and chain[-1] == gold
    eqs = EQ.findall(think.replace(',', ''))
    if not eqs:
        return False
    for lhs, rhs in eqs:
        expr = lhs.replace('x', '*')
        if '/' in expr:                                   # integer division; remainders are checked by "jaach"
            try:
                x, y = [int(t) for t in expr.split('/')]
            except ValueError:
                return False
            if y == 0 or x // y != int(rhs):
                return False
            continue
        if not re.fullmatch(r'[-\d\s+*]+', expr) or eval(expr) != int(rhs):   # digits and + - * only
            return False
    return str(gold) in think


def correct(ans: str, gold) -> bool:
    if isinstance(gold, str):
        found = [d for d in DAYS if d in ans]
        return bool(found) and found[-1] == gold
    nums = re.findall(r'-?\d+', ans.replace(',', ''))
    return bool(nums) and int(nums[-1]) == gold


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True, help='checkpoint .pt')
    ap.add_argument('--tok', default=os.path.join(os.path.dirname(__file__), 'web/model/tokenizer.json'))
    ap.add_argument('--out', default='data/rft.jsonl')
    ap.add_argument('--problems', type=int, default=3000)
    ap.add_argument('--k', type=int, default=8)
    ap.add_argument('--temperature', type=float, default=0.8)
    ap.add_argument('--seed', type=int, default=0, help='use a new seed every round for fresh problems')
    ap.add_argument('--minutes', type=float, default=0, help='stop collecting after this many minutes')
    ap.add_argument('--device', default='cuda' if torch.cuda.is_available() else 'cpu')
    a = ap.parse_args()
    torch.manual_seed(a.seed)
    ck = torch.load(a.model, map_location='cpu')
    model = NikLM(NikConfig(**ck['cfg']))
    model.load_state_dict(ck['model'])
    model.to(a.device).eval()
    tok = Tokenizer.load(a.tok)

    stats = collections.defaultdict(lambda: [0, 0, 0])   # kind -> [problems, samples correct, problems solved]
    kept, t0 = 0, time.time()
    with open(a.out, 'w') as f:
        for qi, (q, gold, kind) in enumerate(problems(a.problems, 1000 + a.seed)):
            ids, _ = render_chat(tok, [{'role': 'user', 'content': q}])
            outs = generate_batch(model, ids[:-1] + [6], n=a.k, max_new=200, temperature=a.temperature)
            good = {}
            for toks, lp in outs:
                think, ans = split(tok.decode(toks))
                if think and ans and correct(ans, gold) and steps_valid(think, gold, kind):
                    good.setdefault(think, (lp, think, ans))
            kname = kind[0] if isinstance(kind, tuple) else kind
            s = stats[kname]
            s[0] += 1
            s[1] += sum(1 for toks, _ in outs if correct(split(tok.decode(toks))[1], gold))
            s[2] += bool(good)
            # sometimes-solved problems carry the most signal: keep up to 2 distinct paths
            keep = sorted(good.values(), reverse=True)[: (2 if 0 < s[1] and len(good) < a.k else 1)]
            for _, think, ans in keep:
                f.write(json.dumps({'cat': f'rft-{kname}', 'messages': [{'role': 'user', 'content': q},
                                    {'role': 'nik', 'content': ans, 'think': think}]}, ensure_ascii=False) + '\n')
                kept += 1
            if a.minutes and time.time() - t0 > a.minutes * 60:
                print(f'time cap reached after {qi + 1} problems', flush=True)
                break
            if (qi + 1) % 100 == 0:
                print(f'{qi + 1}/{a.problems} problems, kept {kept} traces, {time.time() - t0:.0f}s', flush=True)

    report = {k: {'problems': v[0], 'pass@1': round(v[1] / (v[0] * a.k), 3), f'pass@{a.k}': round(v[2] / v[0], 3)} for k, v in sorted(stats.items())}
    tot = [sum(v[i] for v in stats.values()) for i in range(3)]
    report['ALL'] = {'problems': tot[0], 'pass@1': round(tot[1] / (tot[0] * a.k), 3), f'pass@{a.k}': round(tot[2] / tot[0], 3), 'kept_traces': kept}
    print(json.dumps(report, indent=2))
    json.dump(report, open(a.out.replace('.jsonl', '_report.json'), 'w'), indent=2)


if __name__ == '__main__':
    main()
