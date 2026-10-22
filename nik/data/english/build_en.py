"""Filter the English sources into Nik rows (Claude, 2026-10-22).

Out:
  <out>/en_sft.jsonl  chat rows {'cat','gold','messages'} - OASST1 top-ranked human replies (1-2 turns) + Dolly
  <out>/en_wiki.txt   Simple English Wikipedia lead paragraphs, one doc per line (for the replay corpus)
Filters: English only, mostly ASCII, no code/URLs/tables, fits the 512-token context with Nik's tokenizer (English costs
~2.5-3 tokens/word), exact dedup, and every eval prompt (leak_audit sources + NikBench-RW) dropped by exact match or
shared 8-gram. A slice of rows asks for English in romanized Nepali ("english ma jawaf deu: ..."), so an explicit
request switches the language; plain Nepali chat elsewhere in the mix stays Nepali by default.

    python nik/data/english/build_en.py --raw data/english/raw --out data/english
"""
import argparse
import gzip
import json
import os
import random
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path[:0] = [os.path.join(ROOT, 'nik'), os.path.join(ROOT, 'nik', 'scripts')]
from tokenizer import Tokenizer  # noqa: E402

ASK_EN = ['english ma jawaf deu: ', 'yo kura english ma bhana: ', 'please english ma: ', 'english ma bhannus: ']
BLOCK = re.compile(r'\b(sex\w*|porn\w*|nude|naked|stripper|exotic dancer|erotic|kill(ing)? (him|her|them)|suicide)\b', re.I)
BAD = re.compile(r'```|https?://|www\.|\|.*\||\bdef \w+\(|[{};]\s*$|<[a-z]+>', re.M)


def norm(s):
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', s.lower())).strip()


def grams(s, n=8):
    w = norm(s).split()
    return {' '.join(w[i:i + n]) for i in range(max(0, len(w) - n + 1))}


def eval_prompts():
    import leak_audit
    ps = [p for v in leak_audit.collect_prompts(ROOT).values() for p in v]
    import bench_rw
    ps += [t for g in bench_rw.G for v in g[3] for t in (v if isinstance(v, list) else [v])]
    return {norm(p) for p in ps}, set().union(*(grams(p) for p in ps))


def clean(t):
    t = t.strip()
    if not t or BAD.search(t) or BLOCK.search(t):
        return None
    if sum(c.isascii() for c in t) / len(t) < 0.97:
        return None
    return re.sub(r'\n{3,}', '\n\n', t)


def oasst(path):
    with gzip.open(path, 'rt') as f:
        for line in f:
            p = json.loads(line)['prompt']
            if p.get('lang') != 'en':
                continue
            best = [r for r in p.get('replies', []) if r.get('rank') == 0]
            if not best:
                continue
            a = best[0]
            turns = [('user', p['text']), ('nik', a['text'])]
            yield 'oasst', turns
            follow = a.get('replies', [])
            if follow:
                b = [r for r in follow[0].get('replies', []) if r.get('rank') == 0]
                if b:
                    yield 'oasst', turns + [('user', follow[0]['text']), ('nik', b[0]['text'])]


def dolly(path):
    for line in open(path):
        d = json.loads(line)
        if d['category'] == 'creative_writing' and len(d['response']) > 900:
            continue
        q = d['instruction'].strip()
        if d.get('context', '').strip():
            q = d['context'].strip() + '\n\n' + q
        yield d['category'], [('user', q), ('nik', d['response'])]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', default='data/english/raw')
    ap.add_argument('--out', default='data/english')
    ap.add_argument('--max-tokens', type=int, default=440)
    ap.add_argument('--ask-share', type=float, default=0.15)
    ap.add_argument('--wiki-docs', type=int, default=80000)
    ap.add_argument('--seed', type=int, default=7)
    ap.add_argument('--heldout', type=int, default=200, help='short-answer QA kept OUT of training, for bench_en')
    a = ap.parse_args()
    R = random.Random(a.seed)
    tok = Tokenizer.load(os.path.join(ROOT, 'nik', 'web', 'model', 'tokenizer.json'))
    held, held_g = eval_prompts()
    os.makedirs(a.out, exist_ok=True)
    seen, stats, rows, heldout = set(), {}, [], []
    for src, gen in (('oasst', oasst(os.path.join(a.raw, 'oasst_trees.jsonl.gz'))), ('dolly', dolly(os.path.join(a.raw, 'dolly.jsonl')))):
        for cat, turns in gen:
            turns = [(r, clean(t)) for r, t in turns]
            why = None
            if any(t is None for _, t in turns):
                why = 'filter'
            else:
                users = [t for r, t in turns if r == 'user']
                if any(norm(u) in held or grams(u) & held_g for u in users):
                    why = 'eval-leak'
                elif norm(users[0]) in seen:
                    why = 'dup'
                elif sum(len(tok.encode(t)) for _, t in turns) > a.max_tokens:
                    why = 'too-long'
            stats[f'{src}:{why or "kept"}'] = stats.get(f'{src}:{why or "kept"}', 0) + 1
            if why:
                continue
            seen.add(norm(turns[0][1]))
            if (cat in ('open_qa', 'closed_qa', 'classification') and len(turns) == 2 and len(turns[1][1].split()) <= 6
                    and '\n' not in turns[0][1] and len(heldout) < a.heldout and R.random() < 0.15):
                heldout.append({'q': turns[0][1], 'a': turns[1][1], 'cat': cat}); continue
            msgs = [{'role': r, 'content': t} for r, t in turns]
            if R.random() < a.ask_share:
                msgs[0]['content'] = R.choice(ASK_EN) + msgs[0]['content']
            rows.append({'cat': f'en-{src}', 'gold': None, 'messages': msgs})
    R.shuffle(rows)
    with open(os.path.join(a.out, 'en_heldout.jsonl'), 'w') as f:
        for h in heldout:
            f.write(json.dumps(h, ensure_ascii=False) + '\n')
    with open(os.path.join(a.out, 'en_sft.jsonl'), 'w') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    import pyarrow.parquet as pq
    t = pq.read_table(os.path.join(a.raw, 'simplewiki.parquet'), columns=['text'])
    n, hold = 0, open(os.path.join(a.out, 'en_wiki_heldout.txt'), 'w')
    with open(os.path.join(a.out, 'en_wiki.txt'), 'w') as f:
        for txt in t.column('text').to_pylist():
            paras = [p.strip() for p in txt.split('\n') if len(p.split()) >= 25]
            if not paras:
                continue
            doc = ' '.join(paras[:2])
            doc = clean(doc)
            if not doc or len(tok.encode(doc)) > 500 or grams(doc) & held_g:
                continue
            if n % 400 == 399 and hold.tell() < 200_000:   # ~200 docs held out for bench_en's English perplexity
                hold.write(doc.replace('\n', ' ') + '\n'); n += 1; continue
            f.write(doc.replace('\n', ' ') + '\n'); n += 1
            if n >= a.wiki_docs:
                break
    print(json.dumps(stats, indent=1)); print(f'en_sft rows: {len(rows)} | heldout: {len(heldout)} | en_wiki docs: {n}')


if __name__ == '__main__':
    main()
