"""Corpus v2 hard audit.

Reads the fetch+clean owner's JSONL ({source, doc_id, text}), then:
  1. licence registry gate (manifest.py; NC/ND/TBD/unverified fail),
  2. per-source script/length checks (the corpus must be romanized),
  3. eval-set contamination gate (contamination.py; any hit fails),
  4. exact + SimHash-LSH near-duplicate dedup across sources (dedup.py),
  5. audit report: kept/tokens/rejects per source, 200 kept docs sampled,
     final token estimate, PASS/FAIL.

    python nik/data/corpus_v2/corpus_audit.py --docs data/corpus_v2/docs \
        --out data/corpus_v2/audit.json --out-corpus data/corpus_v2/clean.jsonl

The report is the gate: nothing enters a training mix unless `pass` is true.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import contamination  # noqa: E402
import dedup  # noqa: E402
import manifest  # noqa: E402

DEV_RE = re.compile(r'[\u0900-\u097F]')
CHARS_PER_TOKEN = 4.0
MIN_CHARS = 50


def iter_docs(path):
    files = sorted(
        os.path.join(path, f) for f in os.listdir(path) if f.endswith('.jsonl')
    ) if os.path.isdir(path) else [path]
    for path_ in files:
        with open(path_, encoding='utf-8') as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except Exception:
                    yield None


def _blank():
    return {'in': 0, 'kept': 0, 'chars': 0, 'tokens': 0, 'exact_dup': 0, 'near_dup': 0,
            'contaminated': 0, 'devanagari': 0, 'short': 0, 'malformed': 0, 'unknown_source': 0}


def run_audit(docs_path, registry=None, eval_index=None, min_tokens=100_000_000,
              max_dup_rate=0.05, sample_n=200, require_verified=True, max_docs=0,
              out_corpus=None):
    registry = registry or manifest.SOURCES
    if eval_index is None:
        eval_index = contamination.EvalIndex(contamination.load_eval_sets())
    deduper = dedup.Deduper()
    rng = random.Random(0)
    sample, stats, seen_sources = [], {}, set()
    total = kept_seen = 0
    out_handle = open(out_corpus, 'w', encoding='utf-8') if out_corpus else None
    started = time.time()
    for row in iter_docs(docs_path):
        total += 1
        if max_docs and total > max_docs:
            break
        if not isinstance(row, dict) or not isinstance(row.get('text'), str):
            stats.setdefault('_malformed', _blank())['malformed'] += 1
            continue
        source = str(row.get('source', ''))
        s = stats.setdefault(source, _blank())
        s['in'] += 1
        seen_sources.add(source)
        if source not in registry:
            s['unknown_source'] += 1
            continue
        text = row['text']
        if len(text) < MIN_CHARS:
            s['short'] += 1
            continue
        dev = len(DEV_RE.findall(text))
        if dev / max(1, len(text)) > 0.01:
            s['devanagari'] += 1
            continue
        hit = eval_index.check(text)
        if hit is not None:
            s['contaminated'] += 1
            continue
        kind, _ = deduper.add(text, meta={'source': source, 'doc_id': row.get('doc_id')})
        if kind == 'exact':
            s['exact_dup'] += 1
            continue
        if kind == 'near':
            s['near_dup'] += 1
            continue
        s['kept'] += 1
        s['chars'] += len(text)
        s['tokens'] += int(len(text) / CHARS_PER_TOKEN)
        kept_seen += 1
        if out_handle:
            out_handle.write(json.dumps(row, ensure_ascii=False) + '\n')
        if len(sample) < sample_n:
            sample.append({'source': source, 'doc_id': row.get('doc_id'), 'text': text[:500]})
        else:
            j = rng.randrange(kept_seen)
            if j < sample_n:
                sample[j] = {'source': source, 'doc_id': row.get('doc_id'), 'text': text[:500]}

    if out_handle:
        out_handle.close()
    licence_errors, licence_warnings = manifest.validate(seen_sources, require_verified=require_verified)
    unknown = sum(s['unknown_source'] for s in stats.values())
    kept = sum(s['kept'] for s in stats.values())
    tokens = sum(s['tokens'] for s in stats.values())
    exact = sum(s['exact_dup'] for s in stats.values())
    near = sum(s['near_dup'] for s in stats.values())
    contaminated = sum(s['contaminated'] for s in stats.values())
    dup_rate = (exact + near) / max(1, total)
    reasons = []
    if licence_errors:
        reasons.append(f'licence: {len(licence_errors)} error(s)')
    if unknown:
        reasons.append(f'unknown sources: {unknown}')
    if contaminated:
        reasons.append(f'eval contamination: {contaminated}')
    if dup_rate > max_dup_rate:
        reasons.append(f'dup rate {dup_rate:.1%} > {max_dup_rate:.1%}')
    if tokens < min_tokens:
        reasons.append(f'tokens {tokens:,} < min {min_tokens:,}')
    if kept == 0:
        reasons.append('no kept documents')
    result = {
        'pass': not reasons,
        'reasons': reasons,
        'docs_in': total,
        'kept': kept,
        'tokens_estimated': tokens,
        'chars': sum(s['chars'] for s in stats.values()),
        'dup_rate': dup_rate,
        'exact_dups': exact,
        'near_dups': near,
        'contaminated': contaminated,
        'sources': stats,
        'licence_errors': licence_errors,
        'licence_warnings': licence_warnings,
        'eval_index_size': eval_index.size,
        'dedup': deduper.stats(),
        'sample_docs': sample,
        'args': {'min_tokens': min_tokens, 'max_dup_rate': max_dup_rate,
                 'sample_n': sample_n, 'require_verified': require_verified, 'max_docs': max_docs},
        'minutes': (time.time() - started) / 60,
        'token_estimate': f'chars/{CHARS_PER_TOKEN:g}',
    }
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--docs', required=True, help='JSONL file or a directory of *.jsonl')
    ap.add_argument('--out', default='corpus_v2_audit.json')
    ap.add_argument('--out-corpus', default='')
    ap.add_argument('--min-tokens', type=int, default=100_000_000)
    ap.add_argument('--max-dup-rate', type=float, default=0.05)
    ap.add_argument('--sample', type=int, default=200)
    ap.add_argument('--max-docs', type=int, default=0)
    ap.add_argument('--no-require-verified', action='store_true')
    a = ap.parse_args()
    result = run_audit(a.docs, min_tokens=a.min_tokens, max_dup_rate=a.max_dup_rate,
                       sample_n=a.sample, require_verified=not a.no_require_verified,
                       max_docs=a.max_docs, out_corpus=a.out_corpus or None)
    json.dump(result, open(a.out, 'w'), indent=1, ensure_ascii=False)
    if a.out_corpus:
        with open(a.out_corpus, 'w', encoding='utf-8') as handle:
            for row in iter_docs(a.docs):
                if isinstance(row, dict) and isinstance(row.get('text'), str):
                    handle.write(json.dumps(row, ensure_ascii=False) + '\n')
    print(f"docs {result['docs_in']:,} | kept {result['kept']:,} | tokens ~{result['tokens_estimated']:,} | "
          f"dup {result['dup_rate']:.2%} | contaminated {result['contaminated']} | "
          f"licences {len(result['licence_errors'])} error(s)")
    for name, s in sorted(result['sources'].items()):
        if name == '_malformed':
            continue
        print(f"  {name:16s} in {s['in']:8,d} kept {s['kept']:8,d} tokens~{s['tokens']:10,d} "
              f"exact {s['exact_dup']:5,d} near {s['near_dup']:5,d} contam {s['contaminated']} dev {s['devanagari']}")
    for reason in result['reasons']:
        print('  FAIL:', reason)
    print('PASS' if result['pass'] else 'FAIL', '->', a.out)
    sys.exit(0 if result['pass'] else 1)


if __name__ == '__main__':
    main()
