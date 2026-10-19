"""Build Nik's romanized-Nepali pretraining corpus.

Sources (all Apache-2.0 / MIT):
  - sabin1234/NEPALI_TO_ROMANIZED_WIKIPEDIA   (we use the clean Devanagari column)
  - Sakonii/nepalitext-language-model-dataset (news/web lines; --shards N)
  - syubraj/roman2nepali-transliteration      (2.4M-word lexicon for the romanizer)

Pipeline: download -> romanize (lexicon + rules) -> clean -> dedupe -> shuffle ->
write  <out>/pretrain.txt  (one document per line).

    python nik/data/build_corpus.py --out data --shards 1
"""
from __future__ import annotations
import argparse, hashlib, json, os, random, re, sys, urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from romanize import Romanizer  # noqa: E402

HF = 'https://huggingface.co/datasets'
SRC = {
    'wiki': f'{HF}/sabin1234/NEPALI_TO_ROMANIZED_WIKIPEDIA/resolve/main/nepali_romanized.jsonl',
    'lex': f'{HF}/syubraj/roman2nepali-transliteration/resolve/main/data/train-00000-of-00001.parquet',
    'news': f'{HF}/Sakonii/nepalitext-language-model-dataset/resolve/main/data/train-{{:05d}}-of-00014.parquet',
}


def fetch(url: str, path: str):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    print('downloading', url, flush=True)
    tmp = path + '.part'
    urllib.request.urlretrieve(url, tmp)
    os.replace(tmp, path)
    return path


def build_lexicon(raw: str, out: str):
    if os.path.exists(out):
        return out
    import pyarrow.parquet as pq
    t = pq.read_table(fetch(SRC['lex'], os.path.join(raw, 'r2n.parquet'))).column('translation').to_pylist()
    with open(out, 'w', encoding='utf-8') as f:
        for x in t:
            a, b = x['nepali'].strip(), x['roman'].strip().lower()
            if a and b and b.isascii():
                f.write(f'{a}\t{b}\n')
    return out


ALLOWED = re.compile(r"[^a-z0-9 .,!?'\"():;%\-/&+=\n]")


def clean(line: str) -> str | None:
    line = line.lower()
    line = re.sub(r'https?://\S+|www\.\S+', '', line)
    bad = len(ALLOWED.findall(line))
    if bad > max(2, len(line) * 0.02):
        return None                    # leftover foreign script / junk
    line = ALLOWED.sub('', line)
    line = re.sub(r'\s+', ' ', line).strip()
    line = re.sub(r'([.,!?])\1{2,}', r'\1', line)
    if len(line) < 25 or len(line.split()) < 5:
        return None
    return line


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='data')
    ap.add_argument('--shards', type=int, default=1, help='news shards (each ~190M Devanagari chars)')
    ap.add_argument('--max-news-lines', type=int, default=0)
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--stories', type=int, default=80000, help='synthetic coherent stories/explanations to mix in')
    a = ap.parse_args()
    raw = os.path.join(a.out, 'raw')
    os.makedirs(raw, exist_ok=True)
    rom = Romanizer.load(build_lexicon(raw, os.path.join(raw, 'lexicon.tsv')))
    seen, docs = set(), []

    def add(text):
        c = clean(rom(text))
        if not c:
            return
        h = hashlib.md5(c.encode()).digest()[:8]
        if h in seen:
            return
        seen.add(h)
        docs.append(c)

    wiki = fetch(SRC['wiki'], os.path.join(raw, 'wiki.jsonl'))
    with open(wiki, encoding='utf-8') as f:
        for line in f:
            text = json.loads(line)['devanagari_text']
            # split long articles into paragraph-sized docs (~600 chars)
            sents = re.split(r'(?<=[।?!])\s+', text)
            buf = ''
            for s in sents:
                buf += s + ' '
                if len(buf) > 600:
                    add(buf); buf = ''
            if buf:
                add(buf)
    print('wiki docs', len(docs), flush=True)

    import pyarrow.parquet as pq
    n_news = 0
    for k in range(a.shards):
        p = fetch(SRC['news'].format(k), os.path.join(raw, f'news{k}.parquet'))
        lines = pq.read_table(p).column('text').to_pylist()
        # Each row is its own document. Rows are NOT packed together: neighbouring
        # rows are unrelated headlines, and stitching them taught the model to
        # jump topics mid-sentence. Short headline-only rows are dropped.
        for line in lines:
            line = line.strip()
            if len(line) < 160:
                continue
            add(line); n_news += 1
            if a.max_news_lines and n_news >= a.max_news_lines:
                break
        print('after shard', k, 'docs', len(docs), flush=True)

    if a.stories:
        import subprocess
        sp = os.path.join(a.out, 'stories.txt')
        subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'gen_stories.py'), '--out', sp, '--n', str(a.stories)], check=True)
        with open(sp) as f:
            docs.extend(l.strip() for l in f if l.strip())
        print('with stories', len(docs), flush=True)

    random.Random(a.seed).shuffle(docs)
    out = os.path.join(a.out, 'pretrain.txt')
    with open(out, 'w') as f:
        for d in docs:
            f.write(d + '\n')
    print('wrote', out, len(docs), 'docs', sum(map(len, docs)) / 1e6, 'M chars')


if __name__ == '__main__':
    main()
