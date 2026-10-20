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


_ROM = None


def _init_worker(lex_path):
    global _ROM
    _ROM = Romanizer.load(lex_path)


def _romanize_chunk(texts):
    out = []
    for t in texts:
        c = clean(_ROM(t))
        if c:
            out.append(c)
    return out


def _wiki_docs(path):
    for line in open(path, encoding='utf-8'):
        text = json.loads(line)['devanagari_text']
        sents = re.split(r'(?<=[।?!])\s+', text)
        buf = ''
        for s in sents:
            buf += s + ' '
            if len(buf) > 600:
                yield buf; buf = ''
        if buf:
            yield buf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='data')
    ap.add_argument('--shards', type=int, default=1, help='news shards (each ~190M Devanagari chars, 14 available)')
    ap.add_argument('--max-news-lines', type=int, default=0)
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--stories', type=int, default=80000, help='synthetic coherent stories/explanations to mix in')
    ap.add_argument('--workers', type=int, default=max(1, (os.cpu_count() or 2)))
    ap.add_argument('--teacher', type=int, default=0, help='also mix this many audited teacher examples (as plain text) into pretraining')
    a = ap.parse_args()
    raw = os.path.join(a.out, 'raw')
    os.makedirs(raw, exist_ok=True)
    lex = build_lexicon(raw, os.path.join(raw, 'lexicon.tsv'))
    wiki = fetch(SRC['wiki'], os.path.join(raw, 'wiki.jsonl'))
    shards = [fetch(SRC['news'].format(k), os.path.join(raw, f'news{k}.parquet')) for k in range(a.shards)]

    def jobs():
        chunk = []
        for t in _wiki_docs(wiki):
            chunk.append(t)
            if len(chunk) == 4000:
                yield chunk; chunk = []
        import pyarrow.parquet as pq
        n = 0
        for p in shards:
            # one row = one document; short headline-only rows are dropped (see DATA.md)
            for line in pq.read_table(p).column('text').to_pylist():
                line = line.strip()
                if len(line) < 160:
                    continue
                chunk.append(line); n += 1
                if len(chunk) == 4000:
                    yield chunk; chunk = []
                if a.max_news_lines and n >= a.max_news_lines:
                    break
        if chunk:
            yield chunk

    seen, docs = set(), []
    from multiprocessing import Pool
    with Pool(a.workers, initializer=_init_worker, initargs=(lex,)) as pool:
        for k, out in enumerate(pool.imap(_romanize_chunk, jobs(), chunksize=1)):
            for c in out:
                h = hashlib.md5(c.encode()).digest()[:8]
                if h not in seen:
                    seen.add(h); docs.append(c)
            if k % 25 == 0:
                print(f'chunk {k}: {len(docs):,} docs', flush=True)
    print('real-text docs', len(docs), flush=True)

    import subprocess
    if a.stories:
        sp = os.path.join(a.out, 'stories.txt')
        subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'gen_stories.py'), '--out', sp, '--n', str(a.stories)], check=True)
        docs.extend(l.strip() for l in open(sp) if l.strip())
        print('with stories', len(docs), flush=True)
    if a.teacher:
        tp = os.path.join(a.out, 'teacher_pre.jsonl')
        subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'teacher', 'build.py'), '--n', str(a.teacher), '--seed', '101', '--out', tp], check=True)
        for l in open(tp):
            d = json.loads(l)
            docs.append(' '.join((m.get('think', '') + ' ' + m['content']).strip() if m['role'] == 'nik' else m['content'] for m in d['messages']))
        print('with teacher text', len(docs), flush=True)

    random.Random(a.seed).shuffle(docs)
    out = os.path.join(a.out, 'pretrain.txt')
    with open(out, 'w') as f:
        for d in docs:
            f.write(d + '\n')
    print('wrote', out, len(docs), 'docs', sum(map(len, docs)) / 1e6, 'M chars')


if __name__ == '__main__':
    main()
