"""Tests for the iteration generator (Local-C, issue #9)."""
import os
import random
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'teacher'))
import iter as it  # noqa: E402


class TestIter(unittest.TestCase):
    def test_rows_pass_their_own_checker(self):
        R = random.Random(3)
        for i in range(2000):
            row = it.make(R)
            self.assertIsNone(it.check(row), f'row {i}: {it.check(row)} :: {row}')

    def test_rows_pass_the_real_audit(self):
        """build.py filters on nik/data/teacher/audit.py - the rows must survive it."""
        from audit import audit
        R = random.Random(17)
        rows = []
        for _ in range(1000):
            d = it.make(R)
            rows.append({'cat': d['cat'], 'gold': d['gold'], 'messages': d['messages']})
        ok, _ = audit(rows, verbose=False, seen=None)
        self.assertGreater(len(ok) / len(rows), 0.75,
                           f'only {len(ok)}/{len(rows)} rows survived the audit')

    def test_shape(self):
        R = random.Random(1)
        row = it.make(R)
        self.assertEqual(row['cat'], 'reason-iter')
        self.assertIn('think', row['messages'][1])
        self.assertIn(row['gold'], row['messages'][1]['content'])

    def test_one_line_per_iteration(self):
        """the point of the generator: the rule is applied one step at a time."""
        R = random.Random(2)
        for _ in range(300):
            think = it.make(R)['messages'][1]['think']
            self.assertGreaterEqual(think.count('='), 3, f'not iterative enough: {think}')

    def test_benchmark_phrasings_are_not_copied(self):
        """the bench strings must stay held out: the skill transfers, the string does not."""
        R = random.Random(4)
        banned = ('shrinkhala', 'pattern: ')
        for _ in range(500):
            q = it.make(R)['messages'][0]['content']
            for b in banned:
                self.assertNotIn(b, q, f'copied a benchmark phrasing: {q}')

    def test_terms_are_positive_and_integral(self):
        R = random.Random(5)
        for _ in range(500):
            row = it.make(R)
            nums = [int(x) for x in row['messages'][1]['think'].replace('=', ' ').split()
                    if x.isdigit()]
            self.assertTrue(all(v > 0 for v in nums), f'non-positive term: {row}')


if __name__ == '__main__':
    unittest.main()
