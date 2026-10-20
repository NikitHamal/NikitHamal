"""Token budget for an SFT mix (Local-C, issue #9).

A mix is usually described in *rows* ("10% ledger"), but rows differ in length by 3x,
so a row share is not a token share.  The token share is what decides whether a format
is learned and whether it crowds the others out.  Measured on sft6:

    average sft6 row          96.8 tokens
    one math-word-ledger row  286.9 tokens  (2.96x)  -> a 10% row branch is a ~32% token branch

This script reports rows AND estimated tokens per category for a mix .jsonl:

    python nik/scripts/mix_budget.py --jsonl data/sft7.jsonl
    python nik/scripts/mix_budget.py --jsonl data/sft6.jsonl --sample 2000   # exact on a sample
    python nik/scripts/mix_budget.py --jsonl data/sft7.jsonl --json

It streams the file (no full load) and estimates tokens from characters using the
3.97 chars/token measured for this tokenizer (ARCHITECTURE.md).  With --sample it
also tokenises a random subset exactly, to calibrate the estimate.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO)
CHARS_PER_TOKEN = 3.97   # ARCHITECTURE.md: this BPE averages 3.97 characters per token


def row_chars(row):
    """characters of the rendered conversation (user + assistant content + think)."""
    n = 0
    for m in row.get('messages', []):
        n += len(m.get('content', ''))
        n += len(m.get('think', '') or '')
    return n


def row_assistant_chars(row):
    n = 0
    for m in row.get('messages', []):
        if m.get('role') == 'nik':
            n += len(m.get('content', ''))
            n += len(m.get('think', '') or '')
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--jsonl', required=True, help='mix .jsonl (e.g. data/sft7.jsonl)')
    ap.add_argument('--sample', type=int, default=0, help='tokenise this many random rows exactly')
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()

    per = {}
    total_rows = total_chars = total_asst = 0
    reservoir = []
    R = random.Random(a.seed)
    with open(a.jsonl, encoding='utf8') as f:
        for i, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            cat = row.get('cat', '?')
            c = per.setdefault(cat, {'rows': 0, 'chars': 0, 'asst_chars': 0})
            ch = row_chars(row)
            c['rows'] += 1
            c['chars'] += ch
            c['asst_chars'] += row_assistant_chars(row)
            total_rows += 1
            total_chars += ch
            total_asst += c['asst_chars'] - c['asst_chars']  # keep totals simple
            if a.sample and len(reservoir) < a.sample:
                reservoir.append(row)
            elif a.sample and R.random() < 0.02:
                reservoir[R.randrange(len(reservoir))] = row

    exact = {}
    if a.sample and reservoir:
        from tokenizer import Tokenizer
        from prepare import render_chat
        tok = Tokenizer.load(os.path.join(REPO, 'web', 'model', 'tokenizer.json'))
        for row in reservoir:
            ids, _ = render_chat(tok, row['messages'])
            cat = row.get('cat', '?')
            e = exact.setdefault(cat, {'rows': 0, 'tokens': 0})
            e['rows'] += 1
            e['tokens'] += len(ids)
        print(f'exact tokenisation of {len(reservoir)} sampled rows', file=sys.stderr)

    rows = []
    for cat, v in per.items():
        est = v['chars'] / CHARS_PER_TOKEN
        row = {'cat': cat, 'rows': v['rows'],
               'row_share': v['rows'] / max(total_rows, 1),
               'est_tokens': round(est),
               'token_share': est / max(total_chars / CHARS_PER_TOKEN, 1e-9),
               'tokens_per_row': est / max(v['rows'], 1)}
        if cat in exact:
            e = exact[cat]
            row['exact_tokens_per_row'] = e['tokens'] / e['rows']
            row['exact_token_share'] = (e['tokens'] / e['rows'] * v['rows']) / max(
                sum(exact[c]['tokens'] / exact[c]['rows'] * per[c]['rows'] for c in exact), 1e-9)
        rows.append(row)
    rows.sort(key=lambda r: -r['est_tokens'])

    if a.json:
        print(json.dumps({'file': a.jsonl, 'rows': total_rows, 'est_tokens': round(total_chars / CHARS_PER_TOKEN),
                          'categories': rows}, indent=1))
        return

    print(f'{a.jsonl}: {total_rows:,} rows, ~{total_chars / CHARS_PER_TOKEN:,.0f} tokens '
          f'(estimate at {CHARS_PER_TOKEN} chars/token)')
    print(f'{"category":26s} {"rows":>9s} {"row %":>7s} {"~tokens":>12s} {"token %":>8s} {"tok/row":>8s}')
    for r in rows:
        print(f'{r["cat"]:26s} {r["rows"]:9,d} {r["row_share"] * 100:6.2f}% {r["est_tokens"]:12,d} '
              f'{r["token_share"] * 100:7.2f}% {r["tokens_per_row"]:8.1f}')
    if exact:
        print('\nexact (sampled):')
        for r in rows:
            if 'exact_tokens_per_row' in r:
                print(f'  {r["cat"]:26s} {r["exact_tokens_per_row"]:8.1f} tok/row  '
                      f'{r["exact_token_share"] * 100:6.2f}% of the sampled tokens')


if __name__ == '__main__':
    main()
