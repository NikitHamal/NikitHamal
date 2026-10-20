"""Eval-set contamination detection for corpus v2.

Builds an n-gram index from the *question/prompt* text of every eval suite:
bench.py (n=25), eval_understand probes, stress.py prompts, bench_ledger.py.
A corpus document that contains any indexed n-gram is flagged; the audit treats
a flag as a hard failure. The eval prompts are short, so n = min(8, prompt words)
and prompts shorter than 3 words use an exact normalised substring check.
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
        self.by_n = defaultdict(dict)
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
                for i in range(len(ts) - n + 1):
                    h = _hash64(' '.join(ts[i:i + n]))
                    self.by_n[n].setdefault(h, (set_name, pid, text))
        self.size = sum(len(table) for table in self.by_n.values()) + len(self.short)

    def check(self, text):
        ts = tokens(text)
        for n, table in self.by_n.items():
            if len(ts) < n:
                continue
            for i in range(len(ts) - n + 1):
                hit = table.get(_hash64(' '.join(ts[i:i + n])))
                if hit is not None:
                    return {'set': hit[0], 'prompt_id': hit[1], 'prompt': hit[2][:200], 'n': n}
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
