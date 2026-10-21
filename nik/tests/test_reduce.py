"""reduce.py: the ladder's L2 shape stays held out, every row is exact and passes the audit.

Sky, issue #9.  The point of reduce.py is to test whether a rewrite trace teaches *composition*;
if it generated `a - (b x c)` itself, an L2 gain would be template transfer (the frame.py lesson).

    python -m unittest nik.tests.test_reduce -v
"""
import os
import random
import re
import sys
import unittest

TEACHER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'teacher')
sys.path.insert(0, TEACHER)
import audit   # noqa: E402
import reduce  # noqa: E402

N = r'-?\d+'
L2 = re.compile(rf'^\(?{N} - \(?{N} x {N}\)?\)?$')   # a - (b x c), a - b x c


class TestReduce(unittest.TestCase):
    def rows(self, n=3000, seed=5):
        R = random.Random(seed)
        return [reduce.sample(R) for _ in range(n)]

    def test_ladder_shape_is_never_generated(self):
        bad = []
        for row in self.rows():
            q = row['messages'][0]['content']
            for fmt in reduce.QS:
                pre, post = fmt.split('{e}')
                if q.startswith(pre) and q.endswith(post):
                    e = q[len(pre):len(q) - len(post)] if post else q[len(pre):]
                    if L2.match(e):
                        bad.append(q)
        self.assertEqual(bad[:5], [])

    def test_rows_pass_the_audit_and_gold_is_exact(self):
        for row in self.rows(2000, 9):
            self.assertEqual(audit.check(row), [], row)
            q = row['messages'][0]['content']
            expr = re.search(r'([\d(][\d ()+\-x/]*[\d)])', q).group(1)
            self.assertEqual(eval(expr.replace('x', '*').replace('/', '//')), int(row['gold']), q)

    def test_every_step_rewrites_the_rest(self):
        """after each reduced operation the trace re-writes what is left (the line the model was missing)"""
        R = random.Random(2)
        for _ in range(500):
            row = reduce.make(R, 2)
            think = row['messages'][1]['think']
            self.assertEqual(think.count(' baki chha.'), 1, think)


if __name__ == '__main__':
    unittest.main()
