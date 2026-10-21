"""multiturn.py rows pass the audit, and the fact vocabulary stays out of the memory evals (Sky, issue #9).

    python -m unittest nik.tests.test_multiturn -v
"""
import os
import random
import re
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
NIK = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(NIK, 'data', 'teacher'))
import audit       # noqa: E402
import multiturn   # noqa: E402


def eval_words():
    text = ''
    for f in ('eval_understand.py', 'stress.py', os.path.join('scripts', 'memory_long.mjs')):
        text += open(os.path.join(NIK, f), encoding='utf8').read().lower()
    return set(re.findall(r'[a-z]+', text))


class TestMultiturn(unittest.TestCase):
    def test_fact_values_are_not_eval_words(self):
        ev = eval_words()
        vals = {w for _, _, _, vs in multiturn.FACTS for v in vs for w in re.findall(r'[a-z]+', v)}
        common = {'kaam', 'ko', 'dal', 'bhat', 'engineer', 'intern', 'school', 'hotel', 'police', 'teacher', 'driver'}
        self.assertEqual(sorted((vals & ev) - common), [])

    def test_rows_pass_the_audit(self):
        R = random.Random(3)
        for _ in range(600):
            row = multiturn.sample(R)
            self.assertEqual(audit.check(row), [], row['messages'][-2:])

    def test_only_the_last_reply_thinks(self):
        R = random.Random(4)
        for _ in range(300):
            row = multiturn.sample(R)
            self.assertTrue(all(not m.get('think') for m in row['messages'][:-1]))


if __name__ == '__main__':
    unittest.main()
