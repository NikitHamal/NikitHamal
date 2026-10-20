"""Evaluate a Nik checkpoint or exported .bin.

  * math   — 200 fresh arithmetic problems (add / sub / mul / div / word problems);
             exact-match on the final number of the answer.
  * persona — key facts about Nik / Nikit must appear in the answer.
  * ppl    — validation perplexity of the AR head on held-out pretraining text.
  * ssbd   — tokens per sequential step with self-speculative block diffusion.

    python nik/eval.py --model nik/web/model/nik-0.1.bin --data data
"""
from __future__ import annotations
import argparse, json, math, os, random, re, sys

import numpy as np
import torch

sys.path.insert(0, os.path.dirname(__file__))
from export import load_exported  # noqa: E402
from model import NikConfig, NikLM, generate_ar, generate_ssbd  # noqa: E402
from prepare import render_chat  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402

PERSONA = [('timi ko hau?', ['nik']), ('timilai kasle banayo?', ['nikit']), ('nikit hamal ko ho?', ['developer', 'android']),
           ('nepal ko rajdhani kaha ho?', ['kathmandu']), ('nikit ko email ke ho?', ['iamnikithamal']),
           ('nepal ma kati wata pradesh chhan?', ['7']), ('sagarmatha kati aglo chha?', ['8848'])]


def math_set(n=200, seed=123):
    R = random.Random(seed)
    out = []
    for _ in range(n):
        k = R.random()
        if k < 0.3:
            a, b = R.randint(10, 999), R.randint(10, 999); out.append((f'{a} + {b} kati hunchha?', a + b))
        elif k < 0.55:
            a, b = sorted([R.randint(10, 999), R.randint(10, 999)], reverse=True); out.append((f'{a} - {b} kati hunchha?', a - b))
        elif k < 0.75:
            a, b = R.randint(2, 99), R.randint(2, 12); out.append((f'{a} x {b} kati hunchha?', a * b))
        elif k < 0.85:
            b, c = R.randint(2, 12), R.randint(2, 50); out.append((f'{b * c} / {b} kati hunchha?', c))
        else:
            a, b = R.randint(3, 20), R.randint(1, 9)
            out.append((f'ram sanga {a} wata syau chha. aama le {b} wata thap dinubhayo. aba jamma kati bhayo?', a + b))
    return out


def ask(model, tok, q, max_new=120):
    ids, _ = render_chat(tok, [{'role': 'user', 'content': q}])
    out = generate_ar(model, ids[:-1] + [6], max_new, temperature=0.0)
    text = tok.decode(out)
    ans = text.split('<|/think|>')[-1]
    return text, ans.replace('<|end|>', '').strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True, help='.bin export or .pt checkpoint')
    ap.add_argument('--tok', default=os.path.join(os.path.dirname(__file__), 'web/model/tokenizer.json'))
    ap.add_argument('--data', default='data')
    ap.add_argument('--n-math', type=int, default=200)
    ap.add_argument('--out', default=None, help='write results json here')
    a = ap.parse_args()
    torch.set_grad_enabled(False)
    if a.model.endswith('.bin'):
        from eval_understand import load_any
        model = load_any(a.model)   # .bin or .pt (ternary models are evaluated from the checkpoint)
    else:
        ck = torch.load(a.model, map_location='cpu')
        model = NikLM(NikConfig(**ck['cfg'])); model.load_state_dict(ck['model']); model.eval()
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    model.to(dev)
    tok = Tokenizer.load(a.tok)
    res = {}

    probs = math_set(a.n_math)
    ok = 0
    for q, gold in probs:
        _, ans = ask(model, tok, q)
        nums = re.findall(r'-?\d+', ans)
        ok += bool(nums) and int(nums[-1]) == gold
    res['math_acc'] = ok / len(probs)

    hit, samples = 0, []
    for q, keys in PERSONA:
        full, ans = ask(model, tok, q)
        good = all(k in ans.lower() for k in keys)
        hit += good
        samples.append({'q': q, 'a': full, 'ok': good})
    res['persona_acc'] = hit / len(PERSONA)
    res['samples'] = samples

    val = os.path.join(a.data, 'pre_val.bin')
    if os.path.exists(val):
        arr = np.memmap(val, dtype=np.uint16, mode='r')
        L, nll, n = model.cfg.ctx, 0.0, 0
        for i in range(0, min(len(arr) - L - 1, 40 * L), L):
            x = torch.from_numpy(arr[i:i + L + 1].astype(np.int64))[None].to(dev)
            lg = model(x[:, :-1])
            nll += torch.nn.functional.cross_entropy(lg[0], x[0, 1:], reduction='sum').item(); n += L
        res['val_ppl'] = math.exp(nll / n)

    tot_tok = tot_pass = 0
    for q, _ in PERSONA[:4] + [(p, 0) for p, _ in probs[:4]]:
        ids, _ = render_chat(tok, [{'role': 'user', 'content': q}])
        out, passes = generate_ssbd(model, ids[:-1] + [6], 80)
        tot_tok += len(out); tot_pass += passes
    res['ssbd_tokens_per_pass'] = tot_tok / max(1, tot_pass)

    print(json.dumps({k: v for k, v in res.items() if k != 'samples'}, indent=2))
    for s in samples:
        print(('OK  ' if s['ok'] else 'MISS'), s['q'], '->', s['a'][:160])
    if a.out:
        json.dump(res, open(a.out, 'w'), indent=2, ensure_ascii=False)


if __name__ == '__main__':
    main()
