"""corpus_v2, half 1 of 2: romanize with OUR romanizer, and measure how well it did.

The LLM speaks romanized Nepali, so every Devanagari document has to be romanized
before it can enter the training mix - and a badly romanized document teaches the model
the *wrong spelling*.  So the failure rate is a hard per-document gate, not a global
average, and the report says which words the romanizer got wrong (that list is the
work-order for the lexicon, not a footnote).

    python nik/data/corpus_v2/romanize.py --in clean/newiki.jsonl --out roman/newiki.jsonl \
        --report roman/newiki_report.json --lex raw/lexicon.tsv

Two rates per document:
  leftover_rate  words whose romanized form still contains Devanagari / words
                 (the hard gate: --max-leftover, default 0.02)
  rule_rate      words the romanizer had to guess with the rule engine instead of the
                 lexicon / words (reported; hard gate only with --strict-rule)

Rejected documents are counted per reason, exactly like the cleaning step.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import statistics
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass
from romanize import Romanizer  # noqa: E402

DEVA = re.compile(r'[\u0900-\u097F]')
WORD_RE = re.compile(r'[^\W\d_]+', re.UNICODE)


def analyse(doc_text, rom):
    """-> (romanized_text, leftover_rate, rule_rate, leftover_words, rule_words)"""
    words = WORD_RE.findall(doc_text)
    total = len(words) or 1
    out = rom(doc_text)
    out_words = out.split()
    leftover = [w for w in out_words if DEVA.search(w)]
    # a word is "guessed" when it was not in the lexicon (the rule engine had to invent it)
    guessed = []
    for w in words:
        if not DEVA.search(w):
            continue
        if w in rom.lex:
            continue
        guessed.append(w)
    return out, len(leftover) / total, len(guessed) / total, leftover, guessed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='inp', required=True, help='cleaned jsonl (Devanagari)')
    ap.add_argument('--out', required=True, help='romanized jsonl')
    ap.add_argument('--report', default='')
    ap.add_argument('--lex', default=os.environ.get('NIK_LEXICON', ''), help='lexicon tsv')
    ap.add_argument('--max-leftover', type=float, default=0.02, help='hard per-doc gate')
    ap.add_argument('--max-rule-rate', type=float, default=0.35, help='reported per-doc rate')
    ap.add_argument('--strict-rule', action='store_true', help='also reject on the rule rate')
    ap.add_argument('--top', type=int, default=40, help='how many missed words to report')
    a = ap.parse_args()

    rom = Romanizer.load(a.lex or None)
    rejects = Counter()
    leftover_words = Counter()
    rule_words = Counter()
    rates_leftover, rates_rule = [], []
    docs_in = docs_out = chars_in = chars_out = 0
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
            out, lr, rr, lw, gw = analyse(text, rom)
            if lr > a.max_leftover:
                rejects['romanize_leftover'] += 1
                leftover_words.update(lw)
                rule_words.update(gw)
                continue
            if a.strict_rule and rr > a.max_rule_rate:
                rejects['romanize_guessed'] += 1
                leftover_words.update(lw)
                rule_words.update(gw)
                continue
            fout.write(json.dumps({'source': d.get('source', src),
                                   'doc_id': d.get('doc_id'),
                                   'text': out,
                                   'leftover_rate': round(lr, 4),
                                   'rule_rate': round(rr, 4)}, ensure_ascii=False) + '\n')
            docs_out += 1
            chars_out += len(out)
            rates_leftover.append(lr)
            rates_rule.append(rr)
            leftover_words.update(lw)
            rule_words.update(gw)
    report = {
        'source': src, 'in': a.inp, 'out': a.out,
        'lexicon': a.lex or '(none: rule engine + built-in common words only)',
        'docs_in': docs_in, 'docs_out': docs_out,
        'chars_in': chars_in, 'chars_out': chars_out,
        'rejects': dict(rejects.most_common()),
        'max_leftover': a.max_leftover, 'max_rule_rate': a.max_rule_rate,
        'strict_rule': a.strict_rule,
        'leftover_rate_mean': round(statistics.fmean(rates_leftover), 5) if rates_leftover else None,
        'leftover_rate_median': round(statistics.median(rates_leftover), 5) if rates_leftover else None,
        'rule_rate_mean': round(statistics.fmean(rates_rule), 5) if rates_rule else None,
        'rule_rate_median': round(statistics.median(rates_rule), 5) if rates_rule else None,
        'top_leftover_words': leftover_words.most_common(a.top),
        'top_guessed_words': rule_words.most_common(a.top),
    }
    if a.report:
        os.makedirs(os.path.dirname(os.path.abspath(a.report)), exist_ok=True)
        json.dump(report, open(a.report, 'w', encoding='utf8'), indent=1, ensure_ascii=False)
    slim = dict(report)
    slim['top_leftover_words'] = slim['top_leftover_words'][:10]
    slim['top_guessed_words'] = slim['top_guessed_words'][:10]
    print(json.dumps(slim, indent=1, ensure_ascii=False))


if __name__ == '__main__':
    main()
