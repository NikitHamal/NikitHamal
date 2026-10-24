"""Verified self-training data (Claude, 2026-10-24): rejection-sampling fine-tuning (STaR / ReST-EM) with Nik's own
answers, through the exact /chat path, for the skills where its answer can be checked.

    python nik/scripts/rft_collect.py --model cand.bin --out data_v3/rft.jsonl --problems 6000 --k 8

For every problem (fresh numbers, never an eval item): sample K reasoning paths (temperature 0.8, batched); keep a path
only if its final answer equals the exact gold AND every completed equation in it is true (verify.py) AND its think
copies the question's long numbers digit for digit (the 5746673 + 574673 failure). Problems where every path is right
teach nothing new and problems where none is right have no target, so per problem we keep at most 2 verified paths and
weight toward problems the model solves only sometimes (pass rate 1/8 .. 6/8: the edge of competence). Rows are written
in the hand-data format (expand_hand / render_chat), with the think as the model wrote it.

Sources: colmath / colbig arithmetic (+ - x /, 1-10 digits), money1 / everyday word problems with an integer gold,
weekday / unit facts from everyday.py. Anything a generator cannot grade exactly is left out.
"""
import argparse
import importlib
import json
import os
import random
import re
import sys
import time

import torch

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path[:0] = [ROOT, os.path.join(ROOT, 'data', 'teacher'), os.path.join(ROOT, 'scripts')]
from export import load_exported          # noqa: E402
from model import generate_multi          # noqa: E402
from prepare import NIK, render_chat      # noqa: E402
from tokenizer import Tokenizer           # noqa: E402
import verify                             # noqa: E402

NUM = re.compile(r'-?\d+(?:\.\d+)?')


def final_number(text):
    m = NUM.findall(text.replace(',', ''))
    return m[-1] if m else None


def problems(R, n):
    """(question, gold, source) with an exact integer/decimal gold"""
    import colbig
    import colmath
    out = []
    fams = [('colmath', 0.45), ('colbig', 0.25), ('money1', 0.15), ('everyday', 0.15)]
    mods = {}
    for name, _ in fams:
        try:
            mods[name] = importlib.import_module(name)
        except Exception as e:
            print('skip', name, type(e).__name__, e, flush=True)
    names = [f for f, _ in fams if f in mods]
    weights = [w for f, w in fams if f in mods]
    tries = 0
    while len(out) < n and tries < n * 20:
        tries += 1
        src = R.choices(names, weights)[0]
        try:
            if src == 'colmath':
                f = R.choices([f for f, _ in colmath.FAMILIES], [w for _, w in colmath.FAMILIES])[0]
                ex = f(R)
            elif src == 'colbig':
                ex = colbig.big_add(R) if R.random() < 0.6 else colbig.big_sub(R)
            else:
                ex = mods[src].sample(R)
        except Exception:
            continue
        q, gold = _qa(ex)
        if q is None or gold is None:
            continue
        out.append((q, str(gold), src))
    return out


def _qa(ex):
    """question + gold from either generator format (math_gen.ex dict or a chat row with 'gold')"""
    if 'messages' in ex:
        msgs = ex['messages']
        if sum(m['role'] == 'user' for m in msgs) != 1:
            return None, None
        g = ex.get('gold')
        q = msgs[0]['content']
    else:
        q, g = ex.get('q') or ex.get('question'), ex.get('gold', ex.get('answer'))
    if g is None or not NUM.fullmatch(str(g).replace(',', '').strip()):
        return None, None          # word golds (weekdays, names) are graded elsewhere: numbers only here
    return q, str(g).replace(',', '').strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--problems', type=int, default=6000); ap.add_argument('--k', type=int, default=8)
    ap.add_argument('--temperature', type=float, default=0.8); ap.add_argument('--max-new', type=int, default=320)
    ap.add_argument('--batch', type=int, default=48, help='problems per generate_multi call (x k rows)')
    ap.add_argument('--seed', type=int, default=4242); ap.add_argument('--keep', type=int, default=2)
    a = ap.parse_args()
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    tok = Tokenizer.load(os.path.join(ROOT, 'web', 'model', 'tokenizer.json'))
    model = load_exported(a.model).to(dev).eval()
    R = random.Random(a.seed)
    probs = problems(R, a.problems)
    print(f'{len(probs)} problems', flush=True)
    stats = {'problems': 0, 'paths': 0, 'right': 0, 'verified': 0, 'kept': 0, 'all_right': 0, 'none_right': 0, 'by_src': {}}
    t0 = time.time()
    with open(a.out, 'w') as fo:
        for i in range(0, len(probs), a.batch):
            chunk = probs[i:i + a.batch]
            prompts = []
            for q, _, _ in chunk:
                ids, _ = render_chat(tok, [{'role': 'user', 'content': q.lower()}])
                prompts.append(ids[:-1] + [NIK])
            outs = generate_multi(model, prompts, n_per_prompt=a.k, max_new=a.max_new, temperature=a.temperature)
            for (q, gold, src), paths in zip(chunk, outs):
                stats['problems'] += 1
                longs = re.findall(r'\d{4,}', q.replace(',', ''))
                good = []
                n_right = 0
                for toks, lp in paths:
                    text = tok.decode([t for t in toks if t not in (2, 9)])
                    stats['paths'] += 1
                    if '<|/think|>' in text:
                        think, ans = text.split('<|/think|>', 1)
                        think = think.replace('<|think|>', '').strip()
                    else:
                        think, ans = '', text
                    ans = ans.strip()
                    fn = final_number(ans)
                    if fn is None or abs(float(fn) - float(gold)) > 1e-9:
                        continue
                    n_right += 1
                    _, bad = verify.check_equations(think + ' ' + ans)
                    if bad or any(n not in think.replace(',', '') for n in longs) or not ans:
                        continue
                    good.append((lp, think, ans))
                stats['right'] += n_right; stats['verified'] += len(good)
                s = stats['by_src'].setdefault(src, [0, 0, 0])
                s[0] += 1; s[1] += n_right
                if n_right == len(paths):
                    stats['all_right'] += 1
                if n_right == 0:
                    stats['none_right'] += 1
                    continue
                # edge of competence: keep up to `keep` distinct verified paths when the model is unreliable here,
                # one when it is already always right (a light reminder, so solved skills are not forgotten)
                keep = 1 if n_right == len(paths) else a.keep
                seen = set()
                for lp, think, ans in sorted(good, key=lambda g: -g[0]):
                    if (think, ans) in seen:
                        continue
                    seen.add((think, ans))
                    msg = {'role': 'nik', 'content': ans}
                    if think:
                        msg['think'] = think
                    fo.write(json.dumps({'cat': f'rft-{src}', 'messages': [{'role': 'user', 'content': q}, msg], 'gold': gold,
                                         'pass': f'{n_right}/{len(paths)}'}, ensure_ascii=False) + '\n')
                    stats['kept'] += 1; s[2] += 1
                    if len(seen) >= keep:
                        break
            el = time.time() - t0
            print(f'{stats["problems"]}/{len(probs)} problems | pass@1 {stats["right"] / max(1, stats["paths"]):.3f} | '
                  f'kept {stats["kept"]} | all-right {stats["all_right"]} none-right {stats["none_right"]} | {el / 60:.1f} min', flush=True)
    stats['by_src'] = {k: {'problems': v[0], 'pass@1': round(v[1] / max(1, v[0] * a.k), 3), 'kept': v[2]} for k, v in stats['by_src'].items()}
    json.dump(stats, open(a.out + '.stats.json', 'w'), indent=1)
    print(json.dumps(stats), flush=True)


if __name__ == '__main__':
    main()
