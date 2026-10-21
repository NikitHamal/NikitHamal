"""corpus_v2, half 1 of 2: the cleaning rules (Local-C, issue #9).

Takes the raw {source, doc_id, text} JSONL from fetch.py and writes a cleaned JSONL in
the same shape, plus a report that the audit half (Local-A) can quote: every document
that was dropped is counted **per reason**, so the report is a histogram and not a vibe.

    python nik/data/corpus_v2/clean.py --in raw/newiki.jsonl --out clean/newiki.jsonl \
        --report clean/newiki_report.json

The rules, in the order they are applied (a document is dropped at the first rule it
fails, and every rule it *did* trigger is also counted, so the histogram shows both):

  empty                  nothing left after stripping
  too_short              fewer than --min-chars characters or --min-words words
  mixed_script           neither Devanagari nor romanized Nepali (usually English or junk)
  boilerplate            more than --max-boiler-ratio of the lines are nav/menu/login noise
  repeated_lines         the same line appears 3+ times (template spam)
  repetitive             more than --max-ngram-repeat of the 8-grams are duplicates
  profanity              adult/violent word list
  empty_after_boilerplate  only boilerplate was left

Long documents are **chunked**, not rejected (--chunk-chars, default 1200) - a 40 kB
wiki article is worth 30 chunks.  URLs, emails and phone numbers are **scrubbed**, not
rejected, and the number of scrubs is reported (PII must not reach the training mix, but
a single phone number in a 30 kB article is not a reason to throw the article away).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from collections import Counter

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

DEVA = re.compile(r'[\u0900-\u097F]')
LETTER = re.compile(r'[^\W\d_]', re.UNICODE)
URL_RE = re.compile(r'(?:https?://|www\.)\S+')
EMAIL_RE = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')
PHONE_RE = re.compile(r'(?<!\d)(?:9(?:6|7|8|9)\d{8}|98\d{8}|0\d{1,3}[- ]?\d{5,7})(?!\d)')
LONGNUM_RE = re.compile(r'(?<!\d)\d{9,}(?!\d)')

BOILERPLATE = [
    'cookie', 'log in', 'login', 'sign up', 'signup', 'subscribe', 'subscription',
    'advertisement', 'privacy policy', 'terms of use', 'all rights reserved',
    'read more', 'click here', 'share this', 'follow us', 'contact us', 'about us',
    'copyright', 'newsletter', 'loading...', 'javascript', 'browser', 'enable javascript',
    'skip to content', 'menu', 'search', 'home page', 'page not found', '404',
    'गोपनीयता', 'विज्ञापन', 'लगइन', 'खाता खोल्न', 'सदस्यता', 'सम्पर्क', 'हामी बारे', 'सबै अधिकार',
    'पढ्नुहोस्', 'शेयर गर्नुहोस्', 'खोज्नुहोस्', 'गृहपृष्ठ',
]

# A rude word does not disqualify a 5,000 word article: the word is removed and
# counted, the article stays.  Whole words only - the substring version matched
# "population by sex", "Dikshit" and "फोहोरा" and threw away real news articles.
PROFANITY_EN = ['fuck', 'shit', 'bitch', 'cunt', 'asshole', 'slut', 'whore', 'porn',
                'nude', 'naked', 'bastard', 'dickhead']
PROFANITY_NE = ['मुट्याउ', 'गुदा', 'होरा', 'रूमी', 'कुत्ता']
PROFANITY_RE = [re.compile(r'(?<![\w])' + re.escape(w) + r'(?![\w])', re.IGNORECASE)
                for w in PROFANITY_EN]

# english function words: a document full of them is english, not romanized Nepali
ENGLISH_MARKERS = (' the ', ' and ', ' of ', ' in ', ' is ', ' to ', ' for ', ' that ',
                   ' with ', ' as ', ' on ', ' was ', ' from ', ' by ', ' at ', ' are ',
                   ' this ', ' or ', ' an ', ' be ', ' has ', ' was ', ' were ')

# --- MediaWiki markup -----------------------------------------------------------
# The raw ne.wikipedia dump is wikitext, not prose: ~45% of a random page is
# templates, tables, refs and HTML.  Romanizing that teaches the model wiki syntax.
WIKI_COMMENT = re.compile(r'<!--.*?-->', re.DOTALL)
WIKI_REF = re.compile(r'<ref[^>/]*>.*?</ref>|<ref[^>]*/>', re.DOTALL | re.IGNORECASE)
WIKI_TAG = re.compile(r'<[^>]{1,300}>')
WIKI_HTML_ENTITY = re.compile(r'&[a-zA-Z#0-9]{1,10};')
WIKI_FILE = re.compile(r'\[\[(?:File|Image|चित्र|फाइल|मुद्रण):[^\]]{0,300}\]\]', re.IGNORECASE)
WIKI_LINK_PIPE = re.compile(r'\[\[[^\]\n|]{1,200}\|([^\]\n]{0,200})\]\]')
WIKI_LINK = re.compile(r'\[\[([^\]\n]{1,200})\]\]')
WIKI_HEADING = re.compile(r'^\s*={2,6}\s*(.*?)\s*={2,6}\s*$', re.MULTILINE)
WIKI_LIST = re.compile(r'^\s*[*#:;]+\s*', re.MULTILINE)
WIKI_BOLD = re.compile(r"'{2,5}")


def _strip_braces(text):
    """remove {{templates}} and {|tables|} including nesting"""
    out = []
    i = 0
    n = len(text)
    while i < n:
        if text.startswith('{{', i) or text.startswith('{|', i):
            depth = 0
            j = i
            while j < n:
                two = text[j:j + 2]
                if two in ('{{', '{|'):
                    depth += 1
                    j += 2
                    continue
                if two in ('}}', '|}'):
                    depth -= 1
                    j += 2
                    if depth == 0:
                        break
                    continue
                j += 1
            out.append(' ')
            i = j
            continue
        out.append(text[i])
        i += 1
    return ''.join(out)


def strip_wikitext(text):
    """-> (clean_text, markup_ratio)"""
    if not ('{{' in text or '[[' in text or '<ref' in text.lower() or '{|' in text):
        return text, 0.0
    orig = len(text)
    t = WIKI_COMMENT.sub(' ', text)
    t = WIKI_REF.sub(' ', t)
    t = _strip_braces(t)
    t = WIKI_FILE.sub(' ', t)
    t = WIKI_LINK_PIPE.sub(r'\1', t)
    t = WIKI_LINK.sub(r'\1', t)
    t = WIKI_TAG.sub(' ', t)
    t = WIKI_HTML_ENTITY.sub(' ', t)
    t = WIKI_HEADING.sub(r'\1', t)
    t = WIKI_LIST.sub('', t)
    t = WIKI_BOLD.sub('', t)
    t = re.sub(r'\n{3,}', '\n\n', t)
    left = len(t.strip())
    ratio = 0.0 if not orig else max(0.0, 1.0 - left / orig)
    return t, ratio


def is_english(text):
    low = ' ' + text.lower() + ' '
    hits = sum(1 for m in ENGLISH_MARKERS if m in low)
    return hits >= 3



def devanagari_ratio(text):
    letters = LETTER.findall(text)
    if not letters:
        return 0.0
    return sum(1 for c in letters if DEVA.match(c)) / len(letters)


def ascii_letter_ratio(text):
    letters = LETTER.findall(text)
    if not letters:
        return 0.0
    return sum(1 for c in letters if c.isascii() and c.isalpha()) / len(letters)


def line_repetition(lines):
    c = Counter(l.strip() for l in lines if l.strip())
    return max(c.values()) if c else 0


def ngram_repeat(text, n=8):
    w = text.split()
    if len(w) < n * 3:
        return 0.0
    grams = [' '.join(w[i:i + n]) for i in range(len(w) - n + 1)]
    c = Counter(grams)
    return 1.0 - (len(c) / len(grams))


class Cleaner:
    def __init__(self, min_chars=80, min_words=12, chunk_chars=1200, max_boiler_ratio=0.5,
                 max_ngram_repeat=0.5, min_dev_ratio=0.5, max_ascii_ratio=0.9,
                 strip_markup=True, max_markup_ratio=0.9):
        self.p = dict(min_chars=min_chars, min_words=min_words, chunk_chars=chunk_chars,
                      max_boiler_ratio=max_boiler_ratio, max_ngram_repeat=max_ngram_repeat,
                      min_dev_ratio=min_dev_ratio, max_ascii_ratio=max_ascii_ratio,
                      strip_markup=strip_markup, max_markup_ratio=max_markup_ratio)
        self.lowers = [b.lower() for b in BOILERPLATE]

    def is_boiler(self, line):
        l = line.strip().lower()
        if not l:
            return False
        return any(b in l for b in self.lowers)

    def scrub(self, text):
        counts = Counter()
        for key, rx in (('url', URL_RE), ('email', EMAIL_RE), ('phone', PHONE_RE),
                        ('longnum', LONGNUM_RE)):
            hits = rx.findall(text)
            if hits:
                counts[key] += len(hits)
                text = rx.sub(' ', text)
        for rx in PROFANITY_RE:
            n = len(rx.findall(text))
            if n:
                counts['profanity'] += n
                text = rx.sub(' ', text)
        for w in PROFANITY_NE:
            rx = re.compile(r'(?<![\wऀ-ॿ])' + re.escape(w) + r'(?![\wऀ-ॿ])')
            n = len(rx.findall(text))
            if n:
                counts['profanity'] += n
                text = rx.sub(' ', text)
        return text, counts

    def clean_doc(self, text):
        """-> (chunks, first_reason_or_None, all_reasons, scrub_counts)"""
        reasons = []
        scrubs = Counter()
        text = unicodedata.normalize('NFC', text or '')
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        if not text.strip():
            return [], 'empty', reasons, scrubs

        if self.p['strip_markup']:
            text, markup = strip_wikitext(text)
            if markup > self.p['max_markup_ratio']:
                return [], 'mostly_markup', reasons + ['mostly_markup'], scrubs
            if markup > 0.05:
                reasons.append('markup_stripped')

        lines = text.split('\n')
        boiler = [l for l in lines if self.is_boiler(l)]
        if lines and len(boiler) / len(lines) > self.p['max_boiler_ratio']:
            return [], 'boilerplate', reasons + ['boilerplate'], scrubs
        kept = [l for l in lines if not self.is_boiler(l)]
        text = '\n'.join(kept)
        if not text.strip():
            return [], 'empty_after_boilerplate', reasons + ['empty_after_boilerplate'], scrubs

        if line_repetition(kept) >= 3:
            return [], 'repeated_lines', reasons + ['repeated_lines'], scrubs

        text, sc = self.scrub(text)
        scrubs.update(sc)

        dev = devanagari_ratio(text)
        asc = ascii_letter_ratio(text)
        if dev >= self.p['min_dev_ratio']:
            pass
        elif asc >= self.p['max_ascii_ratio'] and not is_english(text):
            pass
        else:
            return [], 'mixed_script', reasons + ['mixed_script'], scrubs

        text = re.sub(r'[ \t]+', ' ', text)
        text = re.sub(r'\n{3,}', '\n\n', text).strip()

        chunks = []
        size = self.p['chunk_chars']
        for i in range(0, len(text), size):
            c = text[i:i + size].strip()
            if len(c) < self.p['min_chars'] or len(c.split()) < self.p['min_words']:
                reasons.append('too_short_chunk')
                continue
            chunks.append(c)
        if not chunks:
            return [], 'too_short', reasons + ['too_short'], scrubs
        if ngram_repeat(' '.join(chunks)) > self.p['max_ngram_repeat']:
            return [], 'repetitive', reasons + ['repetitive'], scrubs
        return chunks, None, reasons, scrubs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='inp', required=True, help='raw jsonl from fetch.py')
    ap.add_argument('--out', required=True, help='cleaned jsonl')
    ap.add_argument('--report', default='', help='where to write the report json')
    ap.add_argument('--min-chars', type=int, default=80)
    ap.add_argument('--min-words', type=int, default=12)
    ap.add_argument('--chunk-chars', type=int, default=1200)
    ap.add_argument('--max-boiler-ratio', type=float, default=0.5)
    ap.add_argument('--max-ngram-repeat', type=float, default=0.5)
    ap.add_argument('--min-dev-ratio', type=float, default=0.5)
    ap.add_argument('--samples', type=int, default=3, help='rejected docs dumped per reason')
    a = ap.parse_args()

    c = Cleaner(min_chars=a.min_chars, min_words=a.min_words, chunk_chars=a.chunk_chars,
                max_boiler_ratio=a.max_boiler_ratio, max_ngram_repeat=a.max_ngram_repeat,
                min_dev_ratio=a.min_dev_ratio)
    rejects = Counter()
    all_reasons = Counter()
    scrubs = Counter()
    samples = {}
    docs_in = docs_out = chunks = chars_in = chars_out = 0
    src = os.path.splitext(os.path.basename(a.inp))[0]
    out_dir = os.path.dirname(os.path.abspath(a.out))
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(a.inp, encoding='utf8') as fin, open(a.out, 'w', encoding='utf8') as fout:
        for line in fin:
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                rejects['bad_json'] += 1
                continue
            docs_in += 1
            text = d.get('text', '')
            chars_in += len(text)
            keep, reason, reasons, sc = c.clean_doc(text)
            scrubs.update(sc)
            for r in reasons:
                all_reasons[r] += 1
            if reason:
                rejects[reason] += 1
                s = samples.setdefault(reason, [])
                if len(s) < a.samples:
                    s.append({'doc_id': d.get('doc_id'), 'text': text[:200]})
                continue
            for i, ch in enumerate(keep):
                fout.write(json.dumps({'source': d.get('source', src),
                                       'doc_id': f"{d.get('doc_id')}-c{i:02d}",
                                       'text': ch}, ensure_ascii=False) + '\n')
                chunks += 1
                chars_out += len(ch)
            docs_out += 1
    report = {
        'source': src, 'in': a.inp, 'out': a.out,
        'docs_in': docs_in, 'docs_out': docs_out, 'chunks': chunks,
        'chars_in': chars_in, 'chars_out': chars_out,
        'rejects': dict(rejects.most_common()),
        'reject_total': sum(rejects.values()),
        'all_rules_triggered': dict(all_reasons.most_common()),
        'scrubs': dict(scrubs),
        'rules': c.p,
        'samples': samples,
    }
    if a.report:
        os.makedirs(os.path.dirname(os.path.abspath(a.report)), exist_ok=True)
        json.dump(report, open(a.report, 'w', encoding='utf8'), indent=1, ensure_ascii=False)
    print(json.dumps({k: v for k, v in report.items() if k not in ('samples', 'all_rules_triggered')},
                     indent=1, ensure_ascii=False))


if __name__ == '__main__':
    main()
