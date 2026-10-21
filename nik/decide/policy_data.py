"""Verifier rows from Nik's OWN mistakes: Nik samples K answers to generator problems with an exact numeric gold;
the options are the distinct final numbers it produced (+ the gold when no sample had it). rerank_eval showed why this
is needed: trained only on synthetic near-misses, Decide picks worse than Nik's greedy answer (67.7% vs 72.2%).
Problems come from the teacher generators (grpo.problem), never from bench.py.

    python nik/decide/policy_data.py --nik nik/web/model/nik-0.1.bin --minutes 90 --out /tmp/policy_rows.jsonl
"""
import argparse, json, os, random, re, sys, time
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE); sys.path.insert(0, ROOT); sys.path.insert(0, os.path.join(ROOT, 'data', 'teacher'))
import torch  # noqa: E402
from bench import final_number, load_any  # noqa: E402
from grpo import problem  # noqa: E402
from model import generate_multi  # noqa: E402
from rsi import prompt_ids  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402

WORDY = ('frame', 'ledger', 'word', 'read', 'iter', 'compose', 'price')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--nik', required=True)
    ap.add_argument('--minutes', type=float, default=90)
    ap.add_argument('--B', type=int, default=48)
    ap.add_argument('--k', type=int, default=8)
    ap.add_argument('--temp', type=float, default=1.0)
    ap.add_argument('--out', default='/tmp/policy_rows.jsonl')
    ap.add_argument('--seed', type=int, default=4242)
    a = ap.parse_args()
    torch.set_grad_enabled(False)
    tok = Tokenizer.load(os.path.join(ROOT, 'web', 'model', 'tokenizer.json'))
    nik = load_any(a.nik).eval()
    R = random.Random(a.seed); t0 = time.time(); n = hit = seen = 0
    with open(a.out, 'a') as f:
        while time.time() - t0 < a.minutes * 60:
            probs = []
            while len(probs) < a.B:
                q, check, sk = problem(R)
                g = (check.__defaults__ or [None])[-1]
                if isinstance(g, int) or (isinstance(g, str) and re.fullmatch(r'-?\d+', g)):
                    probs.append((q, str(g), sk))
            prs = [prompt_ids(tok, q)[-(nik.cfg.ctx - 200):] for q, _, _ in probs]
            groups = generate_multi(nik, prs, n_per_prompt=a.k, max_new=200, temperature=a.temp)
            for (q, gold, sk), outs in zip(probs, groups):
                answers = [final_number(tok.decode(t).split('<|/think|>')[-1]) for t, _ in outs]
                votes = Counter(x for x in answers if x is not None)
                opts = [x for x, _ in votes.most_common(6)]
                seen += 1; hit += gold in votes
                if gold not in opts:
                    opts.append(gold)
                if len(opts) < 2:
                    continue
                R.shuffle(opts)
                wordy = any(w in sk for w in WORDY) or len(q) > 70
                row = dict(task='nik-pick', context=q if wordy else '', question='yo prashna ko antim uttar kun ho?' if wordy else q,
                           options=opts, label=opts.index(gold), skill=sk, gold_sampled=gold in votes)
                f.write(json.dumps(row, ensure_ascii=False) + '\n'); n += 1
            f.flush()
            print(f'{n} rows from {seen} problems | gold among samples {hit / max(1, seen):.0%} | {(time.time() - t0) / 60:.1f} min', flush=True)


if __name__ == '__main__':
    main()
