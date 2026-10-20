"""Grounding re-check for the ledger rows of a built mix (Local-C, issue #9).

@Local-A asked for this check on the sft7 mix: every value the model is *taught* to
bind must appear in the user turn, otherwise the training data itself teaches the model
to invent quantities.  It uses Local-A's own `nik/ledger_scoring.has_value`, so the
token-boundary rule is exactly the one the browser-side guard uses.

    python nik/scripts/ledger_grounding_check.py --jsonl data/sft7.jsonl --n 2000
    python nik/scripts/ledger_grounding_check.py --jsonl data/sft7.jsonl --cat math-word-ledger

Read-only: it opens the mix and prints kept/total.  It re-scores nothing and changes
nothing.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO)
sys.path.insert(0, os.path.join(REPO, 'nik'))

from ledger_scoring import has_value, parse_bindings   # noqa: E402


def values_of(row):
    """the [role=value] bindings the row teaches the model to copy."""
    think = ''
    for m in row.get('messages', []):
        if m.get('role') == 'nik':
            think = m.get('think', '') or ''
    out = []
    for role, value in (parse_bindings(think) or {}).items():
        out.append((role, value))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--jsonl', required=True)
    ap.add_argument('--cat', default='math-word-ledger')
    ap.add_argument('--n', type=int, default=0, help='only check the first N matching rows (0 = all)')
    ap.add_argument('--show', type=int, default=10, help='how many bad rows to print')
    a = ap.parse_args()

    total = rows = bad_rows = bad_values = 0
    checked_values = 0
    examples = []
    with open(a.jsonl, encoding='utf8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if row.get('cat') != a.cat:
                continue
            total += 1
            if a.n and rows >= a.n:
                continue
            rows += 1
            user = ''
            for m in row.get('messages', []):
                if m.get('role') == 'user':
                    user = m.get('content', '')
            bad = 0
            for role, value in values_of(row):
                checked_values += 1
                if not has_value(user, value):
                    bad += 1
                    if len(examples) < a.show:
                        examples.append((role, value, user[:110]))
            if bad:
                bad_rows += 1
                bad_values += bad

    print(f'file          : {a.jsonl}')
    print(f'category      : {a.cat}')
    print(f'rows in mix   : {total:,}')
    print(f'rows checked  : {rows:,}')
    print(f'values checked: {checked_values:,}')
    print(f'rows with an ungrounded value : {bad_rows:,} ({bad_rows / max(rows, 1):.2%})')
    print(f'ungrounded values             : {bad_values:,} '
          f'({bad_values / max(checked_values, 1):.2%} of all bindings)')
    for role, value, user in examples:
        print(f'  {role}={value!r} not in: {user!r}')
    if rows and bad_rows == 0:
        print('OK: every taught binding appears in its user turn (extractive).')


if __name__ == '__main__':
    main()
