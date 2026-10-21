"""The benchmark's word templates must stay held out of the training data.

Local-C, issue #9.  The chain30 run moved the benchmark's "bagaincha" family from
0/5 to 10/10 - and the reason was NOT a learned procedure (the procedure probe, L2,
stayed at 0/12): frame.py's basket scene was a near-twin of that benchmark template
("lines x beads - used"), so the model recognised the template and scored on it.

A benchmark that a training template can imitate is not a measurement.  This test
makes the leak impossible to ship again: no generated row may contain the distinctive
wording of any benchmark word template.

    python -m unittest discover -s nik/tests -v
"""
import os
import random
import sys
import unittest

TEACHER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'teacher')
sys.path.insert(0, TEACHER)
import frame  # noqa: E402


class TestFrameLeak(unittest.TestCase):
    def test_no_benchmark_wording_in_the_training_rows(self):
        R = random.Random(31)
        bad = []
        for i in range(2000):
            row = frame.sample(R)
            text = ' '.join(m.get('content', '') for m in row['messages'])
            text += ' ' + ' '.join((m.get('think') or '') for m in row['messages'])
            low = text.lower()
            for w in frame.BANNED_BENCH_WORDS:
                if w in low:
                    bad.append((w, text[:120]))
        self.assertEqual(bad[:5], [], f'benchmark wording leaked into the training data: {bad[:5]}')

    def test_the_ban_list_covers_every_benchmark_word_template(self):
        """the ban list must mention the distinctive wording of all 10 templates"""
        bench = open(os.path.join(os.path.dirname(TEACHER), '..', 'bench.py'), encoding='utf8').read()
        word = bench.split('def reason')[0].lower()
        banned = ' '.join(frame.BANNED_BENCH_WORDS)
        for marker in ('chakleti', 'bagaincha', 'aalu', 'chhora', 'bus travels at', 'kalam',
                       'boxes with', 'masik talab', 'kaksha ma', 'kitab ko mol'):
            self.assertIn(marker, word, f'bench marker missing: {marker}')
            key = {'bus travels at': 'km per hour', 'boxes with': 'apples', 'kaksha ma': 'anupasthit',
                   'kitab ko mol': 'chhut'}.get(marker, marker)
            self.assertIn(key, banned, f'benchmark template not banned: {marker}')

    def test_every_row_still_passes_its_own_checker(self):
        R = random.Random(77)
        for i in range(500):
            row = frame.sample(R)
            self.assertIsNone(frame.check(row), f'row {i}: {frame.check(row)}')


if __name__ == '__main__':
    unittest.main()
