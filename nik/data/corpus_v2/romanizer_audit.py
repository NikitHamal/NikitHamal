"""How good is our romanizer?  Measure it against an independent romanization.

`clean.py` and `romanize.py` can tell you that the romanizer leaves *no Devanagari*
behind - that is a mechanical check.  This script asks the harder question: are the
words it produced actually the right romanization?

The reference is `sabin1234/NEPALI_TO_ROMANIZED_WIKIPEDIA`, which carries the same
ne.wikipedia articles in both scripts.  We romanize the Devanagari column with our own
romanizer and compare it word by word with their romanization of the same text.

**Their convention is a formal transliteration, ours is casual typing** (nepal ko
rajdhani kathmandu ho).  So a raw positional comparison measures the *convention*, not
our mistakes: their "eka" is our "ek" (schwa dropped), their "cha" is our "chha",
their "waa" is our "wa".  The report therefore separates the two:

  identical                the positions where the two agree as they are
  convention_divergence    the positions where they differ at all
  residual_after_heuristic the positions that still differ after a crude
                           formal->casual conversion.  **This is not an error rate**:
                           the conversion is a heuristic (the real inverse of a
                           transliterator is a project of its own), so the residual is
                           an upper bound contaminated by the conversion's crudeness.
                           The pairs are printed for a human to read.

**What this script cannot do:** give our romanizer an accuracy percentage.  The
reference is a different convention, and no cheap inverse makes it an oracle.  The
honest number for "is the romanizer good enough" is not here - it is in the repo:
the v1 corpus was romanized with this exact romanizer and the model learned fluent
casual Nepali (chat_check 15/15, persona 1.0), so the romanizer's style is the target
style and its errors are not the binding constraint.  The procedure gap is.

    python nik/data/corpus_v2/romanizer_audit.py --rows 100 --lex raw/lexicon.tsv
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass
from romanize import Romanizer  # noqa: E402

API = 'https://datasets-server.huggingface.co/rows'
DS = 'sabin1234/NEPALI_TO_ROMANIZED_WIKIPEDIA'
PUNCT = re.compile(r"[^\wऀ-ॿ']+", re.UNICODE)
DEVA_WORD = re.compile(r'[\u0900-\u097F]+')
CONS = 'bcCdDfFgGhHjJkKlLmMnNpPqQrRsStTvVwWxXyYzZ'


def fetch_rows(dataset, split='train', offset=0, length=100):
    q = urllib.parse.urlencode({'dataset': dataset, 'config': 'default', 'split': split,
                                'offset': offset, 'length': length})
    req = urllib.request.Request(f'{API}?{q}', headers={'User-Agent': 'curl/8.4.0'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)['rows']


def norm_tokens(text):
    t = PUNCT.sub(' ', text.lower())
    return [w for w in t.split() if w]


def casualize(tok):
    """the reference is a formal transliteration; map it onto our casual convention.

    'aa' in the formal form is "vowel a + schwa" (ruupamaa -> rupma), 'ii'/'uu' are
    long vowels, the final 'a' is the schwa, and 'ch' is our 'chh'.
    This is a heuristic inverse, so the residual it leaves is an upper bound on our
    error rate, not the error rate itself.
    """
    s = tok.replace('aa', 'A').replace('ii', 'i').replace('uu', 'u')
    s = re.sub(r'(?<=[CONS])A', '', s)
    s = re.sub(r'A$', '', s)
    s = s.replace('A', 'a')
    s = re.sub(r'(?<=[CONS])a$', '', s)
    s = re.sub(r'(?<=[CONS])a(?=[CONS])', '', s)
    s = re.sub(r'ch(?!h)', 'chh', s)
    s = re.sub(r'sh(?!h)', 'shh', s)
    s = s.replace('w', 'b')
    s = re.sub(r'(.)\1\1+', r'\1\1', s)
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rows', type=int, default=100, help='reference documents to compare')
    ap.add_argument('--offset', type=int, default=0)
    ap.add_argument('--lex', default=os.environ.get('NIK_LEXICON', ''))
    ap.add_argument('--out', default='', help='write the report json here')
    ap.add_argument('--top', type=int, default=40)
    a = ap.parse_args()

    rom = Romanizer.load(a.lex or None)
    same = diverge = residual = 0
    compared = 0
    aligned = 0
    pairs = Counter()
    dev_of = {}
    n_docs = 0
    for i in range(0, a.rows, 100):
        try:
            rows = fetch_rows(DS, offset=a.offset + i, length=min(100, a.rows - i))
        except Exception as e:
            print(f'row fetch failed at {a.offset + i}: {e}')
            break
        for row in rows:
            r = row['row']
            dev = r.get('devanagari_text') or ''
            ref = r.get('romanized_text') or ''
            if not dev.strip() or not ref.strip():
                continue
            n_docs += 1
            ours = norm_tokens(rom(dev))
            theirs = norm_tokens(ref)
            n = min(len(ours), len(theirs))
            aligned += n
            compared += max(len(ours), len(theirs))
            for k in range(n):
                o, t = ours[k], theirs[k]
                if o == t:
                    same += 1
                    continue
                diverge += 1
                if casualize(t) == o:
                    continue
                residual += 1
                key = (o, t)
                pairs[key] += 1
    report = {
        'reference': DS, 'docs': n_docs,
        'tokens_ours': compared, 'positions_compared': aligned,
        'identical': same,
        'convention_divergence': diverge,
        'residual_after_heuristic_conversion': residual,
        'identical_pct': round(100 * same / aligned, 2) if aligned else None,
        'convention_divergence_pct': round(100 * diverge / aligned, 2) if aligned else None,
        'residual_pct': round(100 * residual / aligned, 2) if aligned else None,
        'note': 'the reference is a formal transliteration and we write casual Nepali; '
                'the divergence is a convention difference, not an error rate',
        'top_residual_disagreements': [{'ours': o, 'reference': t, 'count': c}
                                       for (o, t), c in pairs.most_common(a.top)],
    }
    if a.out:
        os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
        json.dump(report, open(a.out, 'w', encoding='utf8'), indent=1, ensure_ascii=False)
    print(json.dumps(report, indent=1, ensure_ascii=False))


if __name__ == '__main__':
    main()
