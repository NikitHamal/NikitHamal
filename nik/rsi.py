"""Nik RSI: a closed-loop, verifier-gated recursive self-improvement engine.

Every generation the *current* model produces the data that trains its successor:

  1. probe     measure pass@1 per skill at the current curriculum level
  2. adapt     self-curriculum: level up a skill when pass@1 >= 0.6, down when < 0.15,
               so training always sits at the edge of competence
  3. generate  sample K reasoning paths per fresh problem; keep only paths whose final
               answer is right AND whose every equation is true (process verification)
  4. train     fine-tune a candidate on its own verified reasoning (+ SFT replay)
  5. gate      promote the candidate only if it beats the incumbent on a fixed
               held-out benchmark without losing language ability (ppl guard);
               otherwise roll back and retry the next generation with more samples
  6. log       rsi/log.jsonl: per-generation held-out score, levels, pass rates

What this is: verifier-gated self-training with an autonomous curriculum
(STaR / ReST-EM / expert iteration + self-paced curricula). What it is not:
unbounded self-modification. The loop improves the weights, not its own
learning algorithm, and it stops when the gate stops being passed.

    python nik/rsi.py --init nik/runs/nik-0.1/sft/ckpt.pt --data data --out nik/runs/rsi --generations 6
"""
from __future__ import annotations
import argparse, json, math, os, random, re, shutil, subprocess, sys, time

import numpy as np
import torch

sys.path.insert(0, os.path.dirname(__file__))
from model import NikConfig, NikLM, generate_ar, generate_batch  # noqa: E402
from prepare import render_chat  # noqa: E402
from selfimprove import DAYS, ITEMS, NAMES, correct, split, steps_valid  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402

SKILLS = ['add', 'sub', 'mul', 'div', 'word', 'price', 'day']
MAX_LEVEL = 6


def make(skill: str, level: int, R: random.Random):
    """One problem at a difficulty level. Returns (question, gold, kind)."""
    d = level + 1
    rnd = lambda k: R.randint(10 ** (k - 1), 10 ** k - 1)  # noqa: E731
    if skill == 'add':
        a, b = rnd(d), rnd(max(2, d - R.randint(0, 1)))
        return R.choice([f'{a} + {b} kati hunchha?', f'{a} ra {b} jod']), a + b, 'add'
    if skill == 'sub':
        a, b = sorted([rnd(d), rnd(max(2, d - R.randint(0, 1)))], reverse=True)
        return R.choice([f'{a} - {b} kati hunchha?', f'{a} bata {b} ghatau']), a - b, 'sub'
    if skill == 'mul':
        a, b = rnd(max(2, d)), R.randint(2, 9 if level < 3 else 99)
        return R.choice([f'{a} x {b} kati hunchha?', f'{a} lai {b} le gunan gara']), a * b, 'mul'
    if skill == 'div':
        b, c = R.randint(2, 12), rnd(max(1, d - 1))
        return f'{b * c} / {b} kati hunchha?', c, 'div'
    if skill == 'word':
        n_, it = R.choice(NAMES), R.choice(ITEMS)
        a, b = rnd(max(1, d - 1)) + 2, rnd(max(1, d - 1))
        if R.random() < 0.5:
            return f'{n_} sanga {a} wata {it} thiyo. aama le {b} wata thap dinubhayo. aba jamma kati bhayo?', a + b, 'word+'
        a, b = max(a, b), min(a, b)
        return f'{n_} sanga {a} wata {it} chha. usle {b} wata sathi lai diyo. aba {n_} sanga kati {it} baki chha?', a - b, 'word-'
    if skill == 'price':
        price, qty = R.choice([5, 10, 15, 20, 25, 30, 45, 50]) * (10 if level > 3 else 1), R.randint(2, 4 + 2 * level)
        return f'ek wata {R.choice(ITEMS)} ko {price} rupiya parchha. {qty} wata kinda kati rupiya lagchha?', price * qty, 'price'
    i, k = R.randrange(7), R.randint(1, 2 + 2 * level)
    phr = {1: 'bholi', 2: 'parsi'}.get(k, f'{k} din pachhi')
    return f'aaja {DAYS[i]} ho bhane {phr} kun bar hunchha?', DAYS[(i + k) % 7], ('day', DAYS[i], k)


def prompt_ids(tok, q):
    ids, _ = render_chat(tok, [{'role': 'user', 'content': q}])
    return ids[:-1] + [6]


def load(path, dev):
    ck = torch.load(path, map_location='cpu')
    m = NikLM(NikConfig(**ck['cfg']))
    m.load_state_dict(ck['model'])
    return m.to(dev).eval()


@torch.no_grad()
def heldout(model, tok, data, n_per_level=8, seed=777):
    """Fixed benchmark across skills and levels 0..3 (greedy), plus a ppl guard."""
    R = random.Random(seed)
    ok = tot = 0
    by = {}
    for s in SKILLS:
        for lv in range(4):
            for _ in range(n_per_level):
                q, gold, _ = make(s, lv, R)
                text = tok.decode(generate_ar(model, prompt_ids(tok, q), 200, temperature=0.0))
                good = correct(split(text)[1], gold)
                ok += good; tot += 1
                by[s] = by.get(s, 0) + good
    ppl = float('nan')
    val = os.path.join(data, 'pre_val.bin')
    if os.path.exists(val):
        arr = np.memmap(val, dtype=np.uint16, mode='r')
        L, nll, n = model.cfg.ctx, 0.0, 0
        dev = next(model.parameters()).device
        for i in range(0, min(len(arr) - L - 1, 30 * L), L):
            x = torch.from_numpy(arr[i:i + L + 1].astype(np.int64))[None].to(dev)
            nll += torch.nn.functional.cross_entropy(model(x[:, :-1])[0], x[0, 1:], reduction='sum').item(); n += L
        ppl = math.exp(nll / n)
    return {'acc': ok / tot, 'per_skill': {s: round(by[s] / (4 * n_per_level), 3) for s in SKILLS}, 'ppl': ppl}


@torch.no_grad()
def probe_and_collect(model, tok, levels, n_problems, k, temperature, R, minutes, with_counts=False):
    """Sample K paths per problem at the current levels; return verified traces + pass rates."""
    stats = {s: [0, 0] for s in SKILLS}          # [samples, correct, (+1 per rationalized trace)]
    traces, t0 = [], time.time()
    for i in range(n_problems):
        s = SKILLS[i % len(SKILLS)]
        q, gold, kind = make(s, levels[s], R)
        outs = generate_batch(model, prompt_ids(tok, q), n=k, max_new=220, temperature=temperature)
        good = {}
        for toks, lp in outs:
            think, ans = split(tok.decode(toks))
            right = correct(ans, gold)
            stats[s][0] += 1; stats[s][1] += right
            if right and think and steps_valid(think, gold, kind):
                good.setdefault(think, (lp, think, ans))
        if not good:
            # STaR rationalization: show the answer as a hint, let the model reason toward it,
            # verify every step, then store the trace under the ORIGINAL (hint-free) question.
            hint = f'{q} (sanket: uttar {gold} ho)'
            for toks, lp in generate_batch(model, prompt_ids(tok, hint), n=max(2, k // 2), max_new=220, temperature=temperature):
                think, ans = split(tok.decode(toks))
                if think and correct(ans, gold) and steps_valid(think, gold, kind) and 'sanket' not in think:
                    good.setdefault(think, (lp - 1.0, think, ans))
                    stats[s].append(1)
        for _, think, ans in sorted(good.values(), reverse=True)[:2]:
            traces.append({'cat': f'rsi-{s}', 'messages': [{'role': 'user', 'content': q}, {'role': 'nik', 'content': ans, 'think': think}]})
        if minutes and time.time() - t0 > minutes * 60:
            break
    rates = {s: (v[1] / v[0] if v[0] else 0.0) for s, v in stats.items()}
    print('rationalized traces:', sum(len(v) - 2 for v in stats.values()), flush=True)
    if with_counts:
        return traces, rates, {s: [v[0], v[1]] for s, v in stats.items()}
    return traces, rates


def collect_parallel(a, champ, levels, g, k):
    """Run probe_and_collect on every GPU at once (one process per GPU, disjoint seeds)."""
    n = a.workers
    procs, outs = [], []
    for w in range(n):
        o = os.path.join(a.out, f'collect_g{g}_w{w}.json')
        outs.append(o)
        env = dict(os.environ, CUDA_VISIBLE_DEVICES=str(w)) if torch.cuda.is_available() else dict(os.environ)
        cmd = [sys.executable, os.path.abspath(__file__), '--collect-worker', o, '--init', champ, '--data', a.data, '--tok', a.tok,
               '--levels', json.dumps(levels), '--seed', str(10_000 + 97 * g + w), '--problems', str(max(1, a.problems // n)),
               '--k', str(k), '--collect-min', str(a.collect_min)]
        procs.append(subprocess.Popen(cmd, env=env))
    for p in procs:
        p.wait()
    traces, tot = [], {s: [0, 0] for s in SKILLS}
    for o in outs:
        if not os.path.exists(o):
            continue
        d = json.load(open(o))
        traces += d['traces']
        for s, (n_, c_) in d['counts'].items():
            tot[s][0] += n_; tot[s][1] += c_
    return traces, {s: (v[1] / v[0] if v[0] else 0.0) for s, v in tot.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--init', required=True)
    ap.add_argument('--data', default='data')
    ap.add_argument('--out', default='nik/runs/rsi')
    ap.add_argument('--tok', default=os.path.join(os.path.dirname(__file__), 'web/model/tokenizer.json'))
    ap.add_argument('--generations', type=int, default=6)
    ap.add_argument('--problems', type=int, default=1400)
    ap.add_argument('--k', type=int, default=8)
    ap.add_argument('--diff-weight', type=float, default=1.0, help='0 = pure autoregressive training')
    ap.add_argument('--collect-min', type=float, default=25)
    ap.add_argument('--train-min', type=float, default=15)
    ap.add_argument('--bs', type=int, default=16)
    ap.add_argument('--launch', default='python', help='e.g. "torchrun --standalone --nproc_per_node 2"')
    ap.add_argument('--ppl-tolerance', type=float, default=0.05, help='max relative ppl increase allowed at the gate')
    ap.add_argument('--min-traces', type=int, default=50)
    ap.add_argument('--heldout-n', type=int, default=8, help='held-out problems per skill per level')
    ap.add_argument('--workers', type=int, default=1, help='parallel collection processes (one per GPU)')
    ap.add_argument('--collect-worker', default=None, help=argparse.SUPPRESS)
    ap.add_argument('--levels', default=None, help=argparse.SUPPRESS)
    ap.add_argument('--seed', type=int, default=0, help=argparse.SUPPRESS)
    ap.add_argument('--budget-min', type=float, default=0, help='stop starting new generations after this many minutes')
    a = ap.parse_args()
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    tok = Tokenizer.load(a.tok)
    if a.collect_worker:                      # child process of collect_parallel
        model = load(a.init, dev)
        R = random.Random(a.seed)
        traces, rates, counts = probe_and_collect(model, tok, json.loads(a.levels), a.problems, a.k, 0.8, R, a.collect_min, with_counts=True)
        json.dump({'traces': traces, 'counts': counts}, open(a.collect_worker, 'w'), ensure_ascii=False)
        return
    os.makedirs(a.out, exist_ok=True)
    logf = open(os.path.join(a.out, 'log.jsonl'), 'a')
    T0 = time.time()

    champ = os.path.join(a.out, 'champion.pt')
    shutil.copy(a.init, champ)
    model = load(champ, dev)
    best = heldout(model, tok, a.data, a.heldout_n)
    levels = {s: 0 for s in SKILLS}
    k, lr = a.k, 4e-4
    print('gen 0 held-out', json.dumps(best), flush=True)
    logf.write(json.dumps({'gen': 0, 'heldout': best, 'levels': levels}) + '\n'); logf.flush()

    gen_min = a.collect_min + a.train_min + 3          # first estimate of one generation's length
    for g in range(1, a.generations + 1):
        tg = time.time()
        if a.budget_min and (time.time() - T0) / 60 + gen_min > a.budget_min:
            print(f'budget reached (a generation takes ~{gen_min:.0f} min)', flush=True)
            break
        R = random.Random(10_000 + g)
        if a.workers > 1:
            traces, rates = collect_parallel(a, champ, levels, g, k)
        else:
            traces, rates = probe_and_collect(model, tok, levels, a.problems, k, 0.8, R, a.collect_min)
        # self-curriculum: move each skill toward its competence edge
        new_levels = dict(levels)
        for s, r in rates.items():
            if r >= 0.6 and levels[s] < MAX_LEVEL:
                new_levels[s] += 1
            elif r < 0.15 and levels[s] > 0:
                new_levels[s] -= 1
        print(f'gen {g}: {len(traces)} verified traces | pass@1 {json.dumps({s: round(r, 2) for s, r in rates.items()})} | levels -> {new_levels}', flush=True)
        if len(traces) < a.min_traces:
            levels = new_levels
            k = min(32, k * 2)
            logf.write(json.dumps({'gen': g, 'skipped': 'too few verified traces', 'traces': len(traces), 'rates': rates, 'levels': levels}) + '\n'); logf.flush()
            continue
        mix = traces * 2
        sft = os.path.join(a.data, 'sft.jsonl')
        if os.path.exists(sft):
            lines = open(sft).read().splitlines()
            random.Random(g).shuffle(lines)
            mix += [json.loads(l) for l in lines[: max(2 * len(traces), 8000)]]
        random.Random(g + 1).shuffle(mix)
        with open(os.path.join(a.data, 'rsi.jsonl'), 'w') as f:
            for d in mix:
                f.write(json.dumps(d, ensure_ascii=False) + '\n')
        here = os.path.dirname(os.path.abspath(__file__))
        subprocess.run([sys.executable, os.path.join(here, 'prepare.py'), '--data', a.data, '--tok', a.tok, '--sft-only', '--sft-name', 'rsi'], check=True)
        cand_dir = os.path.join(a.out, f'gen{g}')
        cmd = (f'{a.launch} {os.path.join(here, "train.py")} --stage sft --sft-name rsi --init {champ} --data {a.data} --out {cand_dir} '
               f'--steps 1000000 --minutes {a.train_min} --bs {a.bs} --lr {lr} --warmup 50 --eval-every 1000000 --mix 0.15 '
               f'--opt muon --ema 0.995 --diff-frac 0.25 --diff-weight {a.diff_weight} --tok {a.tok}')
        subprocess.run(cmd, shell=True, check=True)
        cand = load(os.path.join(cand_dir, 'ckpt.pt'), dev)
        score = heldout(cand, tok, a.data, a.heldout_n)
        ppl_ok = not (score['ppl'] > best['ppl'] * (1 + a.ppl_tolerance))
        promoted = score['acc'] > best['acc'] and ppl_ok
        print(f'gen {g}: candidate acc {score["acc"]:.3f} ppl {score["ppl"]:.1f} vs champion acc {best["acc"]:.3f} ppl {best["ppl"]:.1f} -> '
              f'{"PROMOTED" if promoted else "rejected"}', flush=True)
        if promoted:
            shutil.copy(os.path.join(cand_dir, 'ckpt.pt'), champ)
            model, best = cand, score
            k = a.k
        else:
            k = min(32, k * 2)          # harder search next time
            lr *= 0.7
        levels = new_levels
        logf.write(json.dumps({'gen': g, 'heldout': score, 'champion': best, 'promoted': promoted, 'traces': len(traces),
                               'rates': rates, 'levels': levels, 'k': k, 'minutes': (time.time() - T0) / 60}) + '\n'); logf.flush()
        shutil.rmtree(cand_dir, ignore_errors=True) if not promoted else None
        gen_min = (time.time() - tg) / 60
    print('final champion', json.dumps(best), flush=True)


if __name__ == '__main__':
    main()
