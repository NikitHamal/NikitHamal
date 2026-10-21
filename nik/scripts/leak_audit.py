"""Fail an SFT mix that contains an evaluation prompt verbatim.

The 2026-10 generator review found `vocab.py` emitting the exact understanding probe
`"river" lai nepali ma k bhanchha?` (gold `nadi`), and `chat.py` emitting four exact
`chat_check` prompts. Both would turn a capability gate into memorisation. This audit
is the standing guard: it reads every user turn in a JSONL mix and compares it with
the fixed prompts of the eval sets.

    python nik/scripts/leak_audit.py data/behavior.jsonl
    python nik/scripts/leak_audit.py mix.jsonl --max-exact 0 --show 10

Fatal by default: eval_understand, chat_check, stress. `bench_hard` overlaps are
reported as advisory because one identity item (`mero naam nikit ho`) is intentionally
trained - the unseen items are the honest measurement. Exact match = normalised
lowercase, collapsed spaces, trailing punctuation stripped.

Exit 1 when a fatal source has an exact hit (or when the 8-gram overlap share for a
fatal source exceeds --max-near, default 0.02 of user turns).
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

FATAL = ('eval_understand', 'chat_check', 'stress')


def _quoted(text: str):
    return re.findall(r"'([^']*)'", text) + re.findall(r'"([^"]*)"', text)


def _read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def _prompts_understand(path):
    src = _read(path)
    return re.findall(r"U\('((?:[^'\\]|\\.)*)'\)", src)


def _prompts_chat_check(path):
    src = _read(path)
    m = re.search(r'MSGS\s*=\s*\[(.*?)\]', src, re.S)
    return _quoted(m.group(1)) if m else []


def _prompts_stress(path):
    src = _read(path)
    return [q for _, q in re.findall(r"\('([^']+)',\s*'([^']+)',\s*(?:\[[^\]]*\]|None)\)", src)]


def _prompts_bench_hard(path):
    if not os.path.exists(path):
        return []
    src = _read(path)
    out = re.findall(r"'q':\s*'([^']*)'", src)
    out += re.findall(r"'q[12]':\s*'([^']*)'", src)
    out += [q for q in re.findall(r"\('([^']{6,})',\s*\[", src) if ' ' in q]
    return out


def collect_prompts(root=ROOT):
    out = {}
    out['eval_understand'] = _prompts_understand(os.path.join(root, 'nik', 'eval_understand.py'))
    out['chat_check'] = _prompts_chat_check(os.path.join(root, 'nik', 'chat_check.py'))
    out['stress'] = _prompts_stress(os.path.join(root, 'nik', 'stress.py'))
    out['bench_hard'] = _prompts_bench_hard(os.path.join(root, 'nik', 'bench_hard.py'))
    return {k: [p for p in v if p.strip()] for k, v in out.items() if v}


def norm(s):
    s = re.sub(r'\s+', ' ', (s or '').lower()).strip()
    return s.rstrip(' .!?।')


def grams(s, n=8):
    w = norm(s).split()
    return {' '.join(w[i:i + n]) for i in range(max(0, len(w) - n + 1))}


def audit_rows(rows, prompts, near_n=8, near=True):
    pnorms = {source: {norm(p): p for p in ps} for source, ps in prompts.items()}
    pgrams = {source: [grams(p, near_n) for p in ps] for source, ps in prompts.items()} if near else {}
    exact = []
    near_hits = []
    by_source = {}
    distinct = {}
    for row in rows:
        cat = row.get('cat', '?')
        for m in row.get('messages', []):
            if m.get('role') != 'user':
                continue
            text = m.get('content', '')
            nt = norm(text)
            if not nt:
                continue
            for source, table in pnorms.items():
                hit = table.get(nt)
                if hit:
                    exact.append({'cat': cat, 'source': source, 'prompt': hit, 'text': text})
                    by_source[source] = by_source.get(source, 0) + 1
                    distinct[(source, hit)] = distinct.get((source, hit), 0) + 1
                    break
            else:
                if not near:
                    continue
                gs = grams(text, near_n)
                if gs:
                    for source in pgrams:
                        if any(gs & pg for pg in pgrams[source]):
                            near_hits.append({'cat': cat, 'source': source, 'text': text})
                            break
    return {'exact': exact, 'near': near_hits, 'by_source': by_source, 'distinct': distinct}


def load_rows(paths):
    rows = []
    for path in paths:
        for line in open(path, encoding='utf-8'):
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('jsonl', nargs='+')
    ap.add_argument('--max-exact', type=int, default=0, help='allowed exact hits in fatal sources')
    ap.add_argument('--max-near', type=float, default=0.02, help='allowed near-hit share in fatal sources')
    ap.add_argument('--show', type=int, default=5)
    ap.add_argument('--exact-only', action='store_true', help='skip the 8-gram near pass on very large mixes')
    ap.add_argument('--root', default=ROOT)
    a = ap.parse_args()
    paths = [p for pat in a.jsonl for p in (glob.glob(pat) or [pat])]
    rows = load_rows(paths)
    prompts = collect_prompts(a.root)
    report = audit_rows(rows, prompts, near=not a.exact_only)
    fatal_hits = sum(n for s, n in report['by_source'].items() if s in FATAL)
    fatal_near = sum(1 for r in report['near'] if r['source'] in FATAL)
    users = sum(1 for row in rows for m in row.get('messages', []) if m.get('role') == 'user')
    print(f'rows {len(rows):,} | user turns {users:,} | exact {len(report["exact"])} '
          f'(fatal {fatal_hits}) | near {len(report["near"])} (fatal {fatal_near})')
    for source, n in sorted(report['by_source'].items()):
        print(f'  exact {source}: {n}')
    for (source, prompt), n in sorted(report['distinct'].items(), key=lambda kv: -kv[1])[:a.show]:
        print(f'  TOP [{source}] x{n}: {prompt[:110]}')
    for r in report['exact'][:a.show]:
        print(f'  LEAK [{r["source"]}] {r["cat"]}: {r["text"][:110]}')
    for r in [x for x in report['near'] if x['source'] in FATAL][:a.show]:
        print(f'  NEAR [{r["source"]}] {r["cat"]}: {r["text"][:110]}')
    near_share = fatal_near / max(1, users)
    failed = fatal_hits > a.max_exact or near_share > a.max_near
    print(f'{"FAIL" if failed else "PASS"} leak_audit '
          f'(exact <= {a.max_exact}, fatal near share {near_share:.3f} <= {a.max_near})')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
