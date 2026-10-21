"""Nik-Decide on the held-out reading pairs (nik/bench_reading.py): for each question the options are the two answers
of its pair (yes/no questions get ho/haina/thaha chhaina), in both orders to cancel position bias. A pair passes only
if both questions are right in both orders.

    python nik/decide/eval_reading.py --decide /tmp/nik_decide7/decide.pt
"""
import argparse, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE); sys.path.insert(0, ROOT)
import torch  # noqa: E402
from bench_reading import PAIRS  # noqa: E402
from decider import Decider, encode  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402

YN = ('ho', 'haina', 'chhaina', 'chaina', 'parchha', 'pardaina', 'kinyena', 'gayena', 'baschhain')


def options(p, which):
    q, e = p['q' + which], p['e' + which]
    if (q.startswith('ke ') or 'man parchha' in q) and any(x in YN for x in e):
        import re
        m = re.search(r'ke \w+ (?:le |lai )?(.+?) (?:man parchha|kinyo|gayo|ma baschha)\?', q)
        yes = not any(x in ('haina', 'chhaina', 'chaina', 'pardaina', 'kinyena', 'gayena', 'baschhain') for x in e)
        opts = [f'ho, {m.group(1)}', f'haina, {m.group(1)} haina', 'thaha chhaina'] if m else ['ho', 'haina', 'thaha chhaina']
        return q, opts, 0 if yes else 1
    a, b = p['e1'][0], p['e2'][0]
    gold = a if which == '1' else b
    return q, [a, b] if a != b else [a, b + '?'], [a, b].index(gold)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--decide', required=True); ap.add_argument('--out', default='')
    a = ap.parse_args()
    torch.set_grad_enabled(False)
    tok = Tokenizer.load(os.path.join(ROOT, 'web', 'model', 'tokenizer.json'))
    sd = torch.load(a.decide, map_location='cpu', weights_only=False)
    m = Decider(); m.load_state_dict({k: v.float() for k, v in sd.get('model', sd).items()}); m.eval()
    items = pairs = 0; rows = []
    for p in PAIRS:
        both = True
        for w in '12':
            q, opts, lab = options(p, w)
            ok = True
            for o in (opts, opts[::-1]):
                ids, seg = encode(tok, dict(context=p['ctx'], question=q, options=o))
                lo = m(torch.tensor([ids]), torch.tensor([seg]), torch.zeros(1, len(ids), dtype=torch.bool))[0]
                lo = lo[lo > -1e30]
                ok &= o[int(lo.argmax())] == opts[lab]
            items += ok; both &= ok
            rows.append({'tag': p['tag'], 'q': q, 'ok': ok})
        pairs += both
    print(f'Nik-Decide on bench_reading: items {items}/40, pairs {pairs}/20')
    for r in rows:
        if not r['ok']:
            print('  FAIL', r['tag'], '|', r['q'])
    if a.out:
        json.dump({'items': items, 'pairs': pairs, 'rows': rows}, open(a.out, 'w'), indent=1)


if __name__ == '__main__':
    main()
