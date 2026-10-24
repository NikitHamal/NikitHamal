"""Real-world chat check on HELD-OUT hand-written conversations (Claude, 2026-10-24).

The gate rows are mostly template skills (NikBench, probes, traps). This measures what users meet in /chat: how well
a model predicts Claude's held-out hand-written replies (answer-token loss, per category, history rendered the way
/chat sends it), whether it gets the gold answer of held-out math / reasoning / reading items, and it saves greedy
replies to every held-out first question so a person can read them side by side.

    python nik/scripts/hand_eval.py --model a.bin [b.bin ...] --heldout data_v3/hand_heldout.jsonl --out /tmp/hand_eval.json

Held-out conversations come from build_mix_v2 --hand-holdout (never trained). Models trained on ALL hand data (the
v2 arms) are not comparable on this row.
"""
import argparse
import json
import os
import re
import sys
import time

import torch
import torch.nn.functional as F

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path[:0] = [ROOT, os.path.join(ROOT, 'scripts')]
from build_mix_v2 import expand_hand          # noqa: E402
from calc import Calc                         # noqa: E402
from export import load_exported              # noqa: E402
from model import generate_ar, generate_multi  # noqa: E402
from prepare import NIK, render_chat          # noqa: E402
from tokenizer import Tokenizer               # noqa: E402

NUM = re.compile(r'-?\d+(?:\.\d+)?')


def gold_ok(text, gold):
    """the gold answer appears in the reply (numbers compared as numbers, words as words)"""
    t = text.lower().replace(',', '')
    g = str(gold).lower().replace(',', '').strip()
    if NUM.fullmatch(g):
        return any(abs(float(x) - float(g)) < 1e-9 for x in NUM.findall(t))
    return re.search(r'(?<![a-z])' + re.escape(g) + r'(?![a-z])', t) is not None


def loss_rows(model, tok, rows, dev, L=512):
    """token-weighted answer loss per category over expanded rows (one trained Nik turn each)"""
    out = {}
    with torch.no_grad():
        for r in rows:
            ids, mask = render_chat(tok, r['messages'])
            ids, mask = ids[-(L + 1):], mask[-(L + 1):]
            x = torch.tensor([ids], device=dev)
            lg = model(x[:, :-1])
            l = F.cross_entropy(lg[0].float(), x[0, 1:], reduction='none')
            w = torch.tensor(mask[1:], dtype=torch.float, device=dev)
            c = out.setdefault(r['cat'], [0.0, 0.0])
            c[0] += float((l * w).sum()); c[1] += float(w.sum())
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', nargs='+', required=True)
    ap.add_argument('--heldout', required=True)
    ap.add_argument('--out', default='/tmp/hand_eval.json')
    ap.add_argument('--gen', type=int, default=12, help='greedy replies saved per category (first user turn)')
    ap.add_argument('--max-new', type=int, default=220)
    ap.add_argument('--pencil-n', type=int, default=60, help='gold items also run with the pencil (sequential, slow)')
    a = ap.parse_args()
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    tok = Tokenizer.load(os.path.join(ROOT, 'web', 'model', 'tokenizer.json'))
    convs = [json.loads(l) for l in open(a.heldout) if l.strip()]
    rows = expand_hand(convs)
    for r in rows:   # /chat lowercases what users type (the mix does too)
        for m in r['messages']:
            if m['role'] == 'user':
                m['content'] = m['content'].lower()
    gold = [c for c in convs if c.get('gold') and sum(m['role'] == 'user' for m in c['messages']) == 1]
    bycat = {}
    for c in convs:
        bycat.setdefault(c['cat'], []).append(c)
    res = {'n_conversations': len(convs), 'n_rows': len(rows), 'n_gold': len(gold), 'models': {}}
    for path in a.model:
        t0 = time.time()
        model = load_exported(path).to(dev).eval()
        lr = loss_rows(model, tok, rows, dev)
        tot = sum(v[0] for v in lr.values()) / max(1, sum(v[1] for v in lr.values()))
        per = {k: round(v[0] / max(1, v[1]), 3) for k, v in sorted(lr.items())}
        calc = Calc(tok)
        ok_raw = ok_calc = 0
        prompts = []
        for c in gold:
            ids, _ = render_chat(tok, [{'role': 'user', 'content': c['messages'][0]['content'].lower()}])
            prompts.append(ids[:-1] + [NIK])
        raws = []
        for i in range(0, len(prompts), 64):    # greedy, batched (generate_multi is greedy-identical to generate_ar)
            raws += [r[0][0] for r in generate_multi(model, prompts[i:i + 64], n_per_prompt=1, max_new=a.max_new, temperature=0.0)]
        for c, p, r in zip(gold, prompts, raws):
            raw = tok.decode(r)
            ok_raw += gold_ok(raw.split('<|/think|>')[-1], c['gold'])
        for c, p in list(zip(gold, prompts))[:a.pencil_n]:   # the pencil rewrites tokens: one at a time, a subset
            pen = tok.decode(generate_ar(model, p, a.max_new, temperature=0.0, calc=calc))
            ok_calc += gold_ok(pen.split('<|/think|>')[-1], c['gold'])
        samples, todo = {}, []
        for cat, cs in sorted(bycat.items()):
            for c in cs[:a.gen]:
                q = c['messages'][0]['content']
                ids, _ = render_chat(tok, [{'role': 'user', 'content': q.lower()}])
                todo.append((cat, q, next(m['content'] for m in c['messages'] if m['role'] == 'nik'), ids[:-1] + [NIK]))
        outs = []
        for i in range(0, len(todo), 64):
            outs += [r[0][0] for r in generate_multi(model, [t[3] for t in todo[i:i + 64]], n_per_prompt=1, max_new=a.max_new, temperature=0.0)]
        for (cat, q, ref, _), o in zip(todo, outs):
            samples.setdefault(cat, []).append({'q': q, 'nik': tok.decode(o), 'ref': ref})
        res['models'][os.path.basename(path)] = {'loss': round(tot, 4), 'loss_by_cat': per,
                                                 'gold_raw': f'{ok_raw}/{len(gold)}', 'gold_pencil': f'{ok_calc}/{min(len(gold), a.pencil_n)}',
                                                 'samples': samples, 'sec': round(time.time() - t0)}
        print(f'{os.path.basename(path)}: held-out hand loss {tot:.3f} | gold raw {ok_raw}/{len(gold)} pencil {ok_calc}/{min(len(gold), a.pencil_n)} | '
              + ' '.join(f'{k.replace("hand-", "")} {v}' for k, v in per.items()), flush=True)
    json.dump(res, open(a.out, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
