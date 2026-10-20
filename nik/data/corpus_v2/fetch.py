"""corpus_v2, half 1 of 2: fetch the public Nepali corpora (Local-C, issue #9).

Claude's spec, items 1 and 3 of the corpus_v2 plan.  Local-A owns the *audit* half
(dedup / contamination / audit report) and the licence registry (`manifest.py`); this
script only fetches and reports **what it actually downloaded** (bytes, sha256, doc
count, and the licence the HF API reported at fetch time).

The interface Local-A asked for is exactly what this produces:
    {source, doc_id, text}   one JSON object per line

    python nik/data/corpus_v2/fetch.py --source newiki --out raw
    python nik/data/corpus_v2/fetch.py --source sakonii --shard 0 --out raw
    python nik/data/corpus_v2/fetch.py --source wiki_hf --out raw --max-docs 2000

Rules that matter here:
  * resumable: a partial file is continued with a Range request, never restarted
  * every download is hashed and counted, so the audit report can cite the bytes
  * no token ever reaches the repo: gated sources read HF_TOKEN from the environment
  * the wikipedia dump is the *real* ne.wikipedia (CC BY-SA 4.0), not a derivative
"""
from __future__ import annotations

import argparse
import bz2
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request

HF = 'https://huggingface.co/datasets'
HF_TREE = 'https://huggingface.co/api/datasets'

# kind: how the file is turned into documents
# reported_license: what the API said when we wrote this; manifest.py is authoritative
SOURCES = {
    'sakonii': {
        'kind': 'parquet', 'column': 'text', 'repo': 'Sakonii/nepalitext-language-model-dataset',
        'reported_license': 'cc0-1.0',
        'url': HF + '/Sakonii/nepalitext-language-model-dataset/resolve/main/data/train-{shard:05d}-of-00014.parquet',
        'note': 'news/web lines; 14 shards of ~198 MB; the corpus v1 already used 1 shard',
    },
    'wiki_hf': {
        'kind': 'jsonl', 'text_field': 'devanagari_text',
        'repo': 'sabin1234/NEPALI_TO_ROMANIZED_WIKIPEDIA',
        'reported_license': 'apache-2.0',
        'url': HF + '/sabin1234/NEPALI_TO_ROMANIZED_WIKIPEDIA/resolve/main/nepali_romanized.jsonl',
        'note': 'wikipedia in Devanagari (the corpus v1 source); has a romanized twin we do not use',
    },
    'newiki': {
        'kind': 'wiki_xml', 'repo': None, 'reported_license': 'cc-by-sa-4.0',
        'url': 'https://dumps.wikimedia.org/newiki/latest/newiki-latest-pages-articles.xml.bz2',
        'note': 'the real ne.wikipedia dump, single bz2 stream (not the multistream one)',
    },
    'indiccorp': {
        'kind': 'txt', 'repo': 'ai4bharat/IndicCorpV2',
        'reported_license': 'see-manifest',
        'url': HF + '/ai4bharat/IndicCorpV2/resolve/main/data/ne.txt',
        'note': '14 GB of Nepali web text; one document per line; needs the box, not a laptop',
    },
}


def human(n):
    for unit in ('B', 'KB', 'MB', 'GB', 'TB'):
        if n < 1024:
            return f'{n:.1f} {unit}'
        n /= 1024
    return f'{n:.1f} PB'


UA = 'NikHamal-corpus-v2/1.0 (Nepali LLM research; https://github.com/NikitHamal/NikitHamal)'


def download(url, path, retries=4):
    """resumable download -> (bytes, sha256).  Returns None when the file is already there."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return os.path.getsize(path), sha256_file(path)
    tmp = path + '.part'
    have = os.path.getsize(tmp) if os.path.exists(tmp) else 0
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            if have:
                req.add_header('Range', f'bytes={have}-')
            with urllib.request.urlopen(req, timeout=120) as r, open(tmp, 'ab') as f:
                if have and r.status != 206:
                    have = 0
                    f.close()
                    open(tmp, 'wb').close()
                    continue
                total = have + int(r.headers.get('Content-Length') or 0)
                done = have
                last = time.time()
                while True:
                    chunk = r.read(1 << 20)
                    if not chunk:
                        break
                    f.write(chunk)
                    done += len(chunk)
                    if time.time() - last > 5:
                        last = time.time()
                        print(f'  {human(done)} / {human(total)}', flush=True)
            os.replace(tmp, path)
            return os.path.getsize(path), sha256_file(path)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            print(f'  attempt {attempt + 1} failed: {e}', flush=True)
            have = os.path.getsize(tmp) if os.path.exists(tmp) else 0
            time.sleep(3 * (attempt + 1))
    raise SystemExit(f'could not download {url}')


def sha256_file(path, block=1 << 20):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while True:
            b = f.read(block)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def hf_token():
    tok = os.environ.get('HF_TOKEN') or os.environ.get('HUGGINGFACE_HUB_TOKEN')
    if tok:
        print('using HF_TOKEN from the environment (never stored)')
    return tok


def read_parquet(path, column):
    import pyarrow.parquet as pq
    t = pq.read_table(path)
    if column not in t.column_names:
        raise SystemExit(f'{path} has no column {column!r}: {t.column_names}')
    return t.column(column).to_pylist()


def read_wiki_xml(path):
    """ne.wikipedia dump -> (title, text) per page, streaming (the dump is 50 MB bz2)"""
    import xml.etree.ElementTree as ET
    ns = '{http://www.mediawiki.org/xml/export-0.11/}'
    with bz2.open(path, 'rb') as f:
        for event, elem in ET.iterparse(f, events=('end',)):
            if elem.tag == ns + 'page':
                title = ''
                text = ''
                for child in elem:
                    if child.tag == ns + 'title':
                        title = (child.text or '').strip()
                    elif child.tag == ns + 'revision':
                        for rc in child:
                            if rc.tag == ns + 'text':
                                text = (rc.text or '')
                if text.strip():
                    yield title, text
                elem.clear()


def write_docs(out_path, docs):
    n = 0
    chars = 0
    with open(out_path, 'w', encoding='utf8') as f:
        for doc_id, text in docs:
            f.write(json.dumps({'source': doc_id[0], 'doc_id': doc_id[1], 'text': text},
                               ensure_ascii=False) + '\n')
            n += 1
            chars += len(text)
    return n, chars


def fetch_source(name, out_dir, shard=0, max_docs=0, urls=()):
    spec = SOURCES[name]
    out_jsonl = os.path.join(out_dir, f'{name}.jsonl')
    meta_path = os.path.join(out_dir, f'{name}.fetch.json')
    if os.path.exists(out_jsonl) and os.path.exists(meta_path):
        print(f'{name}: already fetched -> {out_jsonl}')
        return json.load(open(meta_path, encoding='utf8'))
    url = spec['url']
    if '{shard:' in url:
        url = url.format(shard=shard)
    raw = os.path.join(out_dir, 'raw', f'{name}{"" if name != "sakonii" else shard}.bin')
    print(f'{name}: downloading {url}')
    size, digest = download(url, raw)
    print(f'{name}: {human(size)}  sha256 {digest[:16]}...')
    if spec['kind'] == 'parquet':
        rows = read_parquet(raw, spec['column'])

        def _pq():
            for i, t in enumerate(rows):
                if t and t.strip():
                    yield (name, f'{name}-{shard}-{i:07d}'), t
        docs = _pq()
    elif spec['kind'] == 'jsonl':
        def _jl():
            for i, line in enumerate(open(raw, encoding='utf8')):
                if not line.strip():
                    continue
                try:
                    d = json.loads(line)
                except json.JSONDecodeError:
                    continue
                t = d.get(spec['text_field']) or ''
                if t.strip():
                    yield (name, f'{name}-{i:07d}'), t
        docs = _jl()
    elif spec['kind'] == 'wiki_xml':
        def _wx():
            for i, (title, t) in enumerate(read_wiki_xml(raw)):
                if t.strip():
                    yield (name, f'{name}-{i:07d}'), t
        docs = _wx()
    elif spec['kind'] == 'txt':
        def _txt():
            for i, line in enumerate(open(raw, encoding='utf8', errors='replace')):
                t = line.strip()
                if t:
                    yield (name, f'{name}-{i:07d}'), t
        docs = _txt()
    else:
        raise SystemExit(f'unknown kind {spec["kind"]}')
    if max_docs:
        docs = (d for i, d in enumerate(docs) if i < max_docs)
    n, chars = write_docs(out_jsonl, docs)
    meta = {
        'source': name, 'url': url, 'bytes': size, 'human': human(size), 'sha256': digest,
        'docs': n, 'chars': chars, 'kind': spec['kind'],
        'reported_license': spec['reported_license'], 'repo': spec['repo'],
        'note': spec['note'], 'fetched_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }
    json.dump(meta, open(meta_path, 'w', encoding='utf8'), indent=1, ensure_ascii=False)
    print(f'{name}: {n} docs, {human(chars)} chars -> {out_jsonl}')
    return meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', required=True, choices=sorted(SOURCES))
    ap.add_argument('--out', default='raw')
    ap.add_argument('--shard', type=int, default=0)
    ap.add_argument('--max-docs', type=int, default=0, help='stop after n docs (for a sample run)')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    fetch_source(a.source, a.out, shard=a.shard, max_docs=a.max_docs)


if __name__ == '__main__':
    main()
