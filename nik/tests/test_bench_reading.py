"""Tests for the held-out reading bench.

    cd F:\\NikitHamal && python -m unittest nik.tests.test_bench_reading -v

CPU only: no model, GPU, network or Node.
"""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
NIK = os.path.dirname(HERE)
sys.path[:0] = [NIK, os.path.join(NIK, 'scripts')]
from bench_reading import PAIRS, answer_after_think, contains  # noqa: E402


class ReadingBenchTest(unittest.TestCase):
    def test_pair_count(self):
        self.assertEqual(len(PAIRS), 50)   # v2: 20 -> 50 pairs (Claude, 2026-10-21)
        self.assertEqual(len({p['tag'] for p in PAIRS}), 50)

    def test_contexts_unique(self):
        self.assertEqual(len({p['ctx'] for p in PAIRS}), len(PAIRS))

    def test_expected_answers_are_disjoint(self):
        """A pair is only discriminating if the two answers differ."""
        for p in PAIRS:
            self.assertFalse(set(p['e1']) & set(p['e2']), p['tag'])

    def test_numeric_boundary(self):
        self.assertTrue(contains('24 wata topi chha', ['24']))
        self.assertFalse(contains('24 wata topi chha', ['4']))
        self.assertFalse(contains('5 kilo', ['50']))
        self.assertTrue(contains('5', ['5']))

    def test_answer_after_think(self):
        self.assertEqual(answer_after_think('<|think|>3 x 2 = 6<|/think|>6 wata ho.<|end|>'), '6 wata ho.')

    def test_held_out_against_the_behavior_mix(self):
        mix = os.path.join(os.path.dirname(NIK), 'data', 'behavior.jsonl')
        if not os.path.exists(mix):
            self.skipTest('data/behavior.jsonl not built')
        import leak_audit
        items = [p['ctx'] + ' ' + p['q1'] for p in PAIRS] + [p['ctx'] + ' ' + p['q2'] for p in PAIRS]
        rows = leak_audit.load_rows([mix])
        report = leak_audit.audit_rows(rows, {'bench_reading': items})
        self.assertEqual(report['exact'], [])
        self.assertEqual(report['near'], [])


if __name__ == '__main__':
    unittest.main()
