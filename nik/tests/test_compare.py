"""Tests for nik/compare.py (paired benchmark comparison)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import compare  # noqa: E402


def row(cat, q, gold, ok, out=None):
    return {'cat': cat, 'q': q, 'gold': str(gold), 'ok': ok, 'out': out if out is not None else f'{q} -> {gold}'}


class McNemar(unittest.TestCase):
    def test_no_discordance(self):
        self.assertEqual(compare.mcnemar_exact(0, 0), 1.0)

    def test_all_one_way(self):
        self.assertAlmostEqual(compare.mcnemar_exact(10, 0), 2 * 0.5 ** 10, places=12)
        self.assertAlmostEqual(compare.mcnemar_exact(0, 10), 2 * 0.5 ** 10, places=12)

    def test_small(self):
        # n=4, k=1: 2 * (C(4,0)+C(4,1)) / 16 = 0.625
        self.assertAlmostEqual(compare.mcnemar_exact(1, 3), 0.625, places=12)

    def test_balanced_is_one(self):
        self.assertEqual(compare.mcnemar_exact(5, 5), 1.0)


class Compare(unittest.TestCase):
    def test_pairing_groups_and_delta(self):
        a = [row('arith-add2', 'q1', 1, True), row('arith-add2', 'q2', 2, True),
             row('arith-add2', 'q3', 3, False), row('arith-add2', 'q4', 4, False),
             row('word', 'w1', 5, True), row('word', 'w2', 6, False)]
        b = [row('arith-add2', 'q1', 1, True), row('arith-add2', 'q2', 2, False),
             row('arith-add2', 'q3', 3, True), row('arith-add2', 'q4', 4, True),
             row('word', 'w1', 5, True), row('word', 'w2', 6, True)]
        r = compare.compare(a, b)
        self.assertEqual(r['paired'], 6)
        self.assertEqual(r['overall']['ok_a'], 3)
        self.assertEqual(r['overall']['ok_b'], 5)
        self.assertAlmostEqual(r['overall']['delta_pp'], 200 / 6, places=9)
        # b: q3, q4, w2 (A wrong -> B right); c: q2 (A right -> B wrong)
        self.assertEqual((r['overall']['b'], r['overall']['c']), (3, 1))
        self.assertAlmostEqual(r['overall']['p'], 0.625, places=12)
        self.assertEqual(r['groups']['arith']['n'], 4)
        self.assertEqual(r['groups']['word']['n'], 2)

    def test_duplicate_items_are_paired_by_occurrence(self):
        a = [row('arith', 'same', 1, True), row('arith', 'same', 1, False)]
        b = [row('arith', 'same', 1, False), row('arith', 'same', 1, True)]
        r = compare.compare(a, b)
        self.assertEqual(r['paired'], 2)
        self.assertEqual((r['overall']['b'], r['overall']['c']), (1, 1))

    def test_missing_items(self):
        a = [row('arith', 'q1', 1, True), row('arith', 'q2', 2, True)]
        b = [row('arith', 'q1', 1, True)]
        r = compare.compare(a, b)
        self.assertEqual(r['paired'], 1)
        self.assertEqual(r['missing_b'], 1)   # in A, not in B
        self.assertEqual(r['missing_a'], 0)

    def test_ok_fallback_from_out(self):
        a = [{'cat': 'arith', 'q': 'q', 'gold': '12', 'out': 'jamma 12 hunchha.'}]
        b = [{'cat': 'arith', 'q': 'q', 'gold': '12', 'out': 'jamma 13 hunchha.'}]
        r = compare.compare(a, b)
        self.assertEqual(r['overall']['ok_a'], 1)
        self.assertEqual(r['overall']['ok_b'], 0)


if __name__ == '__main__':
    unittest.main()
