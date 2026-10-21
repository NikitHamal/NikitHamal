"""Chat rows from nik/decide/reading_wide.py (Claude, 2026-10-21): the 10 reading relations (giver/receiver, owner,
negation, before/after, subset, coref, compare, units, sequence) as user question -> short grounded answer.
bench_reading's vocabulary (v1 + v2) is excluded inside reading_wide, so bench_reading stays held out."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'decide'))
import reading_wide  # noqa: E402


def sample(R):
    while True:   # relational questions only: numeric ones would teach an answer without its working
        r = reading_wide.sample(R)
        gold = r['options'][r['label']]
        if not any(ch.isdigit() for ch in gold):
            break
    ctx = ' '.join(r['context'].split())
    return {'cat': 'read-' + r['task'].replace('rw-', ''), 'gold': gold,
            'messages': [{'role': 'user', 'content': f'{ctx} {r["question"]}'},
                         {'role': 'nik', 'content': f'{gold}.', 'think': f'"{ctx}" ma herda: {gold}.'}]}
