"""Splice the two RW-behaviour families into an already-built mix, by token share.

The families live in `nik/data/teacher/abstain.py` and `format_ask.py`; this only decides
how many rows and writes them, so a mix stays the caller's own (no edit to build.py,
polish_mix.py or chain_mix.py). Shares are **tokens, not rows** - the lesson from
sft28, where 18% of rows was 17.2% of characters but `math` inflated 16.7% -> 26.1%.

    python nik/scripts/add_rw_behaviours.py --in data/sft28.jsonl --out data/sft29.jsonl \
        --abstain-share 0.02 --format-share 0.02 --seed 11

Then check it like any other mix:
    python nik/scripts/leak_audit.py data/sft29.jsonl --exact-only
"""
import argparse
import json
import os
import random
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'nik', 'data', 'teacher'))
import abstain  # noqa: E402
import format_ask  # noqa: E402
from audit import check  # noqa: E402


def row_chars(row):
    return sum(len(m.get('content', '') or '') + len(m.get('think') or '') for m in row.get('messages', []))


def build(sampler, want_chars, seed):
    R = random.Random(seed)
    out, seen, chars, tries = [], set(), 0, 0
    while chars < want_chars and tries < want_chars * 4 + 1000:
        tries += 1
        r = sampler(R)
        key = r['messages'][0]['content']
        if key in seen or check(r):
            continue
        seen.add(key)
        out.append(r)
        chars += row_chars(r)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='src', required=True)
    ap.add_argument('--out', dest='dst', required=True)
    ap.add_argument('--abstain-share', type=float, default=0.02, help='of the final mix tokens')
    ap.add_argument('--format-share', type=float, default=0.02, help='of the final mix tokens')
    ap.add_argument('--seed', type=int, default=11)
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    rows = [json.loads(l) for l in open(a.src, encoding='utf-8') if l.strip()]
    base_chars = sum(row_chars(r) for r in rows) or 1
    # target share s of the final mix  ->  new_chars = base * s / (1 - s)
    want_ab = int(base_chars * a.abstain_share / max(1e-9, 1 - a.abstain_share - a.format_share))
    want_fm = int(base_chars * a.format_share / max(1e-9, 1 - a.abstain_share - a.format_share))
    ab = build(abstain.sample, want_ab, a.seed)
    fm = build(format_ask.sample, want_fm, a.seed + 1)
    merged = rows + ab + fm
    random.Random(a.seed + 2).shuffle(merged)
    total = sum(row_chars(r) for r in merged) or 1
    print('base %d rows / %.1fM chars' % (len(rows), base_chars / 1e6))
    print('added %d abstain + %d format rows' % (len(ab), len(fm)))
    got_ab = 100.0 * sum(row_chars(r) for r in ab) / total
    got_fm = 100.0 * sum(row_chars(r) for r in fm) / total
    print('final %d rows / %.1fM chars | abstain %.2f%% + format %.2f%% of tokens' % (
        len(merged), total / 1e6, got_ab, got_fm))
    for name, got, want in (('abstain', got_ab, 100 * a.abstain_share), ('format', got_fm, 100 * a.format_share)):
        if want and got < 0.8 * want:
            print('WARNING: %s reached %.2f%% of a %.2f%% target - the generator pool is exhausted '
                  '(dedup); widen its content or accept the lower share' % (name, got, want))
    if a.dry_run:
        print('dry run, nothing written')
        return
    with open(a.dst, 'w', encoding='utf-8') as h:
        for r in merged:
            h.write(json.dumps(r, ensure_ascii=False) + '\n')
    print('wrote', a.dst)


if __name__ == '__main__':
    main()
