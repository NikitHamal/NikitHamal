"""NikBench-RW scorers are strict (CPU only, no model)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import bench_rw as b  # noqa: E402


class BenchRW(unittest.TestCase):
    def test_shape(self):
        self.assertGreaterEqual(len(b.G), 40)
        for g in b.G:
            self.assertEqual(len(g[3]), 3, g)

    def test_strict_scoring(self):
        self.assertTrue(b.score('num', '745', '1000 - 255 = 745. 745 rupiya baki chha.'))
        self.assertFalse(b.score('num', '745', 'answer 745, ani 255 kharcha'))   # last number decides
        self.assertTrue(b.score('unknown', None, 'tyo kura message ma lekheko chhaina.'))
        self.assertFalse(b.score('unknown', None, 'kitab ko mol thaha chhaina, sayad 500.'))  # no invented digits
        self.assertTrue(b.score('fmt:only_number', '56', '56'))
        self.assertFalse(b.score('fmt:only_number', '56', '7 x 8 = 56'))
        self.assertTrue(b.score('fmt:list3', None, 'syau, kera, aanp'))
        self.assertFalse(b.score('text', (['sukrabar'], ['mangalbar']), 'mangalbar pachhi sukrabar'))


if __name__ == '__main__':
    unittest.main()
