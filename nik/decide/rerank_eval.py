"""Does Nik-Decide make Nik better? Nik samples K answers per NikBench item; Nik-Decide picks among the distinct final
numbers. Reports greedy / majority vote / Decide pick / vote x Decide / oracle (any sample right) on the same items.

    python nik/decide/rerank_eval.py --nik nik/web/model/nik-0.1.bin --decide /tmp/nik_decide5/decide.pt --k 8 --out rerank.json
"""
import argparse, json, os, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE); sys.path.insert(0, ROOT)
import torch  # noqa: E402
import torch.nn.functional as F  # noqa: E402
from bench import items, final_number, load_any  # noqa: E402
from prepare import render_chat  # noqa: E402
from decider import Decider, encode  # noqa: E402
from model import generate_ar, generate_multi  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402


def decide_format(cat, q, opts):
    if cat == 'word':
        return dict(context=q, question='yo prashna ko antim uttar kun ho?', options=opts)
    return dict(context='', question=q, options=opts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--nik', required=True)
    ap.add_argument('--decide', required=True)
    ap.add_argument('--k', type=int, default=8)
    ap.add_argument('--n', type=int, default=16)
    ap.add_argument('--temp', type=float, default=0.8)
    ap.add_argument('--out', default='rerank.json')
    a = ap.parse_args()
    torch.set_grad_enabled(False)
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    tok = Tokenizer.load(os.path.join(ROOT, 'web', 'model', 'tokenizer.json'))
    nik = load_any(a.nik).to(dev).eval()
    sd = torch.load(a.decide, map_location='cpu', weights_only=False)
    dm = Decider(); dm.load_state_dict({k: v.float() for k, v in (sd.get('model', sd)).items()}); dm.to(dev).eval()

    def ans_of(text):
        return final_number(text.split('<|/think|>')[-1])

    rows, tot = [], Counter()
    its = items(a.n)
    for i in range(0, len(its), 16):
        chunk = its[i:i + 16]
        prs = [render_chat(tok, [{'role': 'user', 'content': q}])[0][:-1] + [6] for _, q, _ in chunk]
        groups = generate_multi(nik, prs, n_per_prompt=a.k, max_new=320, temperature=a.temp)
        for (cat, q, g), pr, outs in zip(chunk, prs, groups):
            greedy = ans_of(tok.decode(generate_ar(nik, pr, 320, temperature=0.0)))
            samples = [ans_of(tok.decode(t)) for t, _ in outs]
            votes = Counter(s for s in samples if s is not None)
            if greedy is not None:
                votes.setdefault(greedy, 0)
            cands = list(votes)[:8]
            gold = str(g)
            r = {'cat': cat, 'gold': gold, 'greedy': greedy, 'cands': cands, 'votes': dict(votes)}
            if len(cands) >= 2:
                ids, seg = encode(tok, decide_format(cat, q, cands))
                lo = dm(torch.tensor([ids], device=dev), torch.tensor([seg], device=dev), torch.zeros(1, len(ids), dtype=torch.bool, device=dev))[0]
                p = F.softmax(lo[lo > -1e30].float(), -1).tolist()
                r['p'] = dict(zip(cands, [round(x, 4) for x in p]))
                pick = cands[max(range(len(cands)), key=lambda j: p[j])]
                vxd = max(cands, key=lambda c: (votes[c] + 1) * r['p'][c])
            else:
                pick = vxd = cands[0] if cands else None
            maj = votes.most_common(1)[0][0] if votes else greedy
            res = {'greedy': greedy == gold, 'majority': maj == gold, 'decide': pick == gold, 'vote_x_decide': vxd == gold, 'oracle': gold in votes}
            r.update(res); rows.append(r)
            for k, v in res.items():
                tot[(cat.split('-')[0], k)] += v; tot[('ALL', k)] += v
            tot[(cat.split('-')[0], 'n')] += 1; tot[('ALL', 'n')] += 1
        print(f'{len(rows)}/{len(its)}', flush=True)
    keys = ['greedy', 'majority', 'decide', 'vote_x_decide', 'oracle']
    print(f"{'group':8s} {'n':>4s} " + ' '.join(f'{k:>14s}' for k in keys))
    summary = {}
    for grp in ['arith', 'word', 'reason', 'ALL']:
        n = tot[(grp, 'n')]
        if not n:
            continue
        summary[grp] = {k: round(tot[(grp, k)] / n, 4) for k in keys} | {'n': n}
        print(f'{grp:8s} {n:4d} ' + ' '.join(f'{tot[(grp, k)] / n:14.1%}' for k in keys))
    json.dump({'summary': summary, 'k': a.k, 'temp': a.temp, 'rows': rows}, open(a.out, 'w'), indent=1)


if __name__ == '__main__':
    main()
