"""Build the romanized -> phoneme lexicon used in the browser.

Keys are produced by *Nik's own romanizer*, so they match exactly what Nik writes;
values come from the Devanagari spelling (exact phonemes). Most frequent words first.
    python nik/tts/build_lexicon.py --news data/raw/news0.parquet --wiki data/raw/wiki.jsonl --out nik/web/tts/lexicon.json
"""
import argparse, collections, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'data'))
from phonemes import deva_word  # noqa: E402
from romanize import Romanizer  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('--news', nargs='*', default=[])
ap.add_argument('--wiki', default='')
ap.add_argument('--tsv', default='', help='TTS transcripts (line_index.tsv / metadata.tsv)')
ap.add_argument('--lexicon', default='', help="Nik's romanizer lexicon tsv")
ap.add_argument('--top', type=int, default=60000)
ap.add_argument('--out', required=True)
a = ap.parse_args()
cnt = collections.Counter()
W = re.compile(r'[ऀ-ॿ]+')
for p in a.news:
    import pyarrow.parquet as pq
    for t in pq.read_table(p).column('text').to_pylist():
        cnt.update(W.findall(t))
if a.wiki:
    for l in open(a.wiki, encoding='utf-8'):
        cnt.update(W.findall(json.loads(l)['devanagari_text']))
if a.tsv:
    for l in open(a.tsv, encoding='utf-8'):
        cnt.update({w: 50 for w in W.findall(l)})       # TTS vocabulary always included
rom = Romanizer.load(a.lexicon or None)
best = {}
for w, c in cnt.most_common(a.top * 2):
    r = rom.word(w)
    if not r.isascii() or not r:
        continue
    if r not in best or c > best[r][0]:
        best[r] = (c, ' '.join(deva_word(w)))
    if len(best) >= a.top:
        break
json.dump({k: v for k, (c, v) in best.items()}, open(a.out, 'w'), separators=(',', ':'))
print('wrote', a.out, len(best), 'words', os.path.getsize(a.out) // 1024, 'KB')
