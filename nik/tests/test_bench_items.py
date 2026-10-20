"""Tests for the NikBench item set (Local-C, issue #9).

The item set of --n 8 used to be unrelated to the item set of --n 16 (one shared rng
stream, arith generated first), so cross-n comparisons were unpaired.  With
nested=True the sets are nested, which makes the live_eval trend (n=4) comparable with
the decision eval (n=16).
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bench  # noqa: E402


def words(items):
    return [i[1] for i in items if i[0] == 'word']


def reasons(items):
    return [i[1] for i in items if i[0] == 'reason']


class TestBenchItems(unittest.TestCase):
    def test_default_behaviour_is_unchanged(self):
        """the default must keep the historical item set (the shipped scores stay valid)"""
        self.assertEqual(len(words(bench.items(8))), 24)
        self.assertEqual(len(reasons(bench.items(8))), 24)
        self.assertEqual(len([i for i in bench.items(8) if i[0].startswith('arith')]), 96)

    def test_default_is_not_nested(self):
        """this is the bug the --nested-items flag fixes: n=8 and n=16 do not share items"""
        a, b = words(bench.items(8)), words(bench.items(16))
        self.assertNotEqual(a, b[:24])

    def test_nested_sets_are_prefixes(self):
        for n in (4, 8):
            a, b = words(bench.items(n, nested=True)), words(bench.items(16, nested=True))
            self.assertEqual(a, b[:len(a)], f'word items of n={n} are not a prefix of n=16')
            ra, rb = reasons(bench.items(n, nested=True)), reasons(bench.items(16, nested=True))
            self.assertEqual(ra, rb[:len(ra)], f'reason items of n={n} are not a prefix of n=16')

    def test_nested_is_deterministic(self):
        self.assertEqual(bench.items(8, nested=True), bench.items(8, nested=True))

    def test_item_counts(self):
        for n in (2, 8, 16):
            it = bench.items(n, nested=True)
            self.assertEqual(len(words(it)), 3 * n)
            self.assertEqual(len(reasons(it)), 3 * n)
            self.assertEqual(len([i for i in it if i[0].startswith('arith')]), 12 * n)


if __name__ == '__main__':
    unittest.main()
