"""Eval-set contamination detection for corpus v2.

Builds an n-gram index from the *question/prompt* text of every eval suite:
bench.py (n=25), eval_understand probes, stress.py prompts, bench_ledger.py.
A document is flagged only when it matches **at least two distinct n-grams of the
same prompt** (one when the prompt is too short to have two): a single common
8-gram, such as a news date string, is not evidence of a leak. Prompts shorter
than 3 words use an exact normalised substring check. The eval prompts are short,
so n = min(8, prompt words).
"""
from __future__ import annotations

import os
import sys
from collections import defaultdict

from dedup import _hash64, normalize, tokens

MAX_N = 8
MIN_N = 3


class EvalIndex:
    def __init__(self, prompt_sets):
        self.by_n = defaultdict(lambda: defaultdict(list))   # n -> hash -> [(set, pid, prompt)]
        self.need = {}
        self.short = []
        for set_name, prompts in prompt_sets.items():
            for pid, text in enumerate(prompts):
                ts = tokens(text)
                if not ts:
                    continue
                if len(ts) < MIN_N:
                    self.short.append((set_name, pid, normalize(text), text))
                    continue
                n = min(MAX_N, len(ts))
                hashes = {_hash64(' '.join(ts[i:i + n])) for i in range(len(ts) - n + 1)}
                self.need[(set_name, pid)] = 2 if len(hashes) >= 2 else 1
                for h in hashes:
                    self.by_n[n][h].append((set_name, pid, text))
        self.size = sum(len(table) for table in self.by_n.values()) + len(self.short)

    def check(self, text):
        ts = tokens(text)
        matched = defaultdict(set)          # (set, pid) -> distinct n-grams matched
        for n, table in self.by_n.items():
            if len(ts) < n:
                continue
            for i in range(len(ts) - n + 1):
                h = _hash64(' '.join(ts[i:i + n]))
                for set_name, pid, prompt in table.get(h, ()):
                    key = (set_name, pid)
                    matched[key].add(h)
                    if len(matched[key]) >= self.need.get(key, 1):
                        return {'set': set_name, 'prompt_id': pid, 'prompt': prompt[:200], 'n': n}
        norm = normalize(text)
        for set_name, pid, prompt_norm, prompt in self.short:
            if prompt_norm in norm:
                return {'set': set_name, 'prompt_id': pid, 'prompt': prompt[:200], 'n': 0}
        return None


def load_eval_sets():
    """Load the four eval suites. Heavy imports (torch) happen only here."""
    here = os.path.dirname(os.path.abspath(__file__))
    nik = os.path.abspath(os.path.join(here, '..', '..'))
    sys.path[:0] = [nik, os.path.join(nik, 'data', 'teacher')]
    import bench
    import bench_ledger
    import eval_understand
    import stress

    sets = {}
    sets['bench'] = [q for _, q, _ in bench.items(25)]
    sets['understand'] = [m['content'] for _, msgs, _ in eval_understand.PROBES for m in msgs if m['role'] == 'user']
    stress_prompts = []
    for _, prompt, _ in stress.P:
        stress_prompts.extend(prompt if isinstance(prompt, list) else [prompt])
    sets['stress'] = stress_prompts
    sets['ledger'] = [row['q'] for row in bench_ledger.items(8)]
    return sets
