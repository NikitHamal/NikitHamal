"""NikBench-EN: English ability + language fidelity (Claude, 2026-10-22).

Rows (all from held-out data that build_en.py keeps OUT of training):
  en_qa_ppl     per-token NLL of the reference answers to held-out human questions (Dolly) - lower is better
  en_wiki_ppl   per-token NLL of held-out Simple English Wikipedia paragraphs - lower is better
  en_reply      held-out English questions: reply is English and does not loop (rate)
  en_contains   held-out English questions: reply contains the reference answer (strict, reported)
  ne_fidelity   the understanding probes' romanized-Nepali questions: reply stays Nepali (rate) - must not drop
Language id: counts of common English vs romanized-Nepali function words. Generation uses /chat's sampler (seeded).

    python nik/bench_en.py --model nik/web/model/nik-0.1.bin --data data/english --out en.json
"""
import argparse
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.join(HERE, 'scripts')]

EN = set('the a an is are was were be of to and in on at it this that you your i my we he she they what which who '
         'how why when where have has had do does did not can will would with for from by as but or if'.split())
NE = set('ho chha chhan chhu ma ko ki ka le lai ra hunchha bhayo thiyo garnu tapai mero timro hamro k ke kati kasari '
         'kina kaha ani pani haru bhane garera gareko ramro sanga bata matra yo tyo'.split())


def lang(text):
    w = re.findall(r"[a-z']+", text.lower())
    e, n = sum(x in EN for x in w), sum(x in NE for x in w)
    return 'en' if e > n else 'ne' if n > e else '?'


def looped(t):
    w = t.split()
    return len(w) > 24 and len(set(w)) < 0.35 * len(w)


def norm(s):
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', s.lower())).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--data', default='data/english')
    ap.add_argument('--n-gen', type=int, default=60)
    ap.add_argument('--out', default=None)
    ap.add_argument('--greedy', action='store_true', help='greedy instead of /chat sampling')
    a = ap.parse_args()
    import torch
    import torch.nn.functional as F
    from eval_understand import load_any
    from model import generate_ar
    from prepare import render_chat
    from tokenizer import Tokenizer
    import leak_audit
    tok = Tokenizer.load(os.path.join(HERE, 'web/model/tokenizer.json'))
    m = load_any(a.model).eval()
    ctx = m.cfg.ctx
    dev = next(m.parameters()).device
    qa = [json.loads(l) for l in open(os.path.join(a.data, 'en_heldout.jsonl'))]
    wiki = [l.strip() for l in open(os.path.join(a.data, 'en_wiki_heldout.txt')) if l.strip()]

    def nll(ids, mask):
        ids, mask = ids[:ctx], mask[:ctx]
        x = torch.tensor([ids[:-1]], device=dev); y = torch.tensor(ids[1:], device=dev); w = torch.tensor(mask[1:], dtype=torch.float, device=dev)
        with torch.no_grad():
            lp = F.cross_entropy(m(x)[0].float(), y, reduction='none')
        return float((lp * w).sum()), float(w.sum())

    s = t = 0.0
    for r in qa:
        ids, mask = render_chat(tok, [{'role': 'user', 'content': r['q']}, {'role': 'nik', 'content': r['a']}])
        a1, b1 = nll(ids, mask); s += a1; t += b1
    qa_ppl = math.exp(s / t)
    s = t = 0.0
    for d in wiki:
        ids = [1] + tok.encode(d, allow_special=False)
        a1, b1 = nll(ids, [0] + [1] * (len(ids) - 1)); s += a1; t += b1
    wiki_ppl = math.exp(s / t)

    exempt = {i for i in range(tok.vocab_size)
              if re.fullmatch(r'[\s\d.,:;!?+\-x/=()%]*', tok.decode([i]) or '')}

    def chat_decode(ids, n, seed):
        # /chat's sampler (nik.js sample): rep penalty 1.15 on recent tokens (digits/punct exempt), temperature 0.7,
        # top-p 0.9, min-p 0.05; no penalty inside <|think|>. Seeded per item, so the run is reproducible.
        g = torch.Generator().manual_seed(seed); out = list(ids); think = False
        for _ in range(n):
            with torch.no_grad():
                lg = m(torch.tensor([out[-ctx:]], device=dev))[0, -1].float().cpu()
            if not think:
                for t in set(out[len(ids):][-64:]) - exempt:
                    lg[t] = lg[t] / 1.15 if lg[t] > 0 else lg[t] * 1.15
            pr = torch.softmax(lg / 0.7, -1)
            pr[pr < 0.05 * pr.max()] = 0
            sp, si = torch.sort(pr, descending=True); keep = torch.cumsum(sp, 0) - sp < 0.9
            pr2 = torch.zeros_like(pr); pr2[si[keep]] = sp[keep]
            nxt = int(torch.multinomial(pr2 / pr2.sum(), 1, generator=g))
            out.append(nxt)
            think = (think or nxt == 7) and nxt != 8
            if nxt in (2, 9):
                break
        return out[len(ids):]

    def reply(q):
        ids, _ = render_chat(tok, [{'role': 'user', 'content': q}])
        with torch.no_grad():
            gen = (generate_ar(m, ids[:-1] + [6], 160, temperature=0.0) if a.greedy
                   else chat_decode(ids[:-1] + [6], 160, seed=len(q)))
            out = tok.decode(gen)
        return re.sub(r'<\|think\|>.*?(<\|/think\|>|$)', '', out, flags=re.S).replace('<|end|>', '').strip()

    rows, en_ok, contains = [], 0, 0
    for r in qa[:a.n_gen]:
        o = reply(r['q'])
        ok = lang(o) == 'en' and not looped(o)
        hit = norm(r['a']) in norm(o) if len(r['a'].split()) <= 4 else False
        en_ok += ok; contains += hit
        rows.append({'q': r['q'], 'gold': r['a'], 'reply': o, 'english': ok, 'contains': hit})
    ne_q = leak_audit._prompts_understand(os.path.join(HERE, 'eval_understand.py'))
    ne_q = [q for q in ne_q if lang(q) == 'ne' and 'english' not in q.lower()]   # probes that ask for English are excluded
    ne_ok = 0
    for q in ne_q:
        o = reply(q)
        ok = lang(o) != 'en' and not looped(o)   # fail = drifted into English (short neutral answers are fine)
        ne_ok += ok
        rows.append({'q': q, 'reply': o, 'nepali': ok})
    res = {'en_qa_ppl': round(qa_ppl, 2), 'en_wiki_ppl': round(wiki_ppl, 2),
           'en_reply': f'{en_ok}/{min(a.n_gen, len(qa))}', 'en_contains': f'{contains}/{min(a.n_gen, len(qa))}',
           'ne_fidelity': f'{ne_ok}/{len(ne_q)}'}
    for r in rows:
        if r.get('english') is False or r.get('nepali') is False:
            print('[FAIL]', repr(r['q'][:60]), '->', repr(r['reply'][:90]))
    print(json.dumps(res)); print('NikBench-EN:', ' '.join(f'{k}={v}' for k, v in res.items()))
    if a.out:
        json.dump({'summary': res, 'rows': rows}, open(a.out, 'w'), indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
