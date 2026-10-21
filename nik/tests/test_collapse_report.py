"""Tests for the collapse / mechanism report (Local-C, issue #9)."""
import os
import sys
import unittest

SCRIPTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'scripts')
sys.path.insert(0, SCRIPTS)
import collapse_report as cr  # noqa: E402


class TestCollapse(unittest.TestCase):
    def test_executed_the_mult(self):
        self.assertTrue(cr.executed_the_mult('39 - (8 x 2) = ?', 'pehla 8 x 2 = 16'))
        self.assertTrue(cr.executed_the_mult('39 - (8 x 2) = ?', 'ani 16 bhayo'))
        self.assertFalse(cr.executed_the_mult('39 - (8 x 2) = ?', 'pahila 29 - 39 nikalchhu'))
        self.assertFalse(cr.executed_the_mult('39 - (8 x 2) = ?', ''))
        self.assertIsNone(cr.executed_the_mult('39 - 8 = ?', 'x'))

    def test_reduced_to_one_op(self):
        self.assertTrue(cr.reduced_to_one_op('39 - (8 x 2) = ?', 31))   # 39 - 8
        self.assertTrue(cr.reduced_to_one_op('39 - (8 x 2) = ?', 16))   # 8 * 2
        self.assertFalse(cr.reduced_to_one_op('39 - (8 x 2) = ?', 23))  # the right answer
        self.assertFalse(cr.reduced_to_one_op('39 - (8 x 2) = ?', None))

    def test_numbers(self):
        self.assertEqual(cr.numbers('39 - (8 x 2) = ?'), [39, 8, 2])
        self.assertEqual(cr.numbers('1,200 ko kati'), [1200])


if __name__ == '__main__':
    unittest.main()
