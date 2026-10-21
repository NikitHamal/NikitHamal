"""Tests for the framed word-problem generator (Local-C, issue #9).

    python -m unittest discover -s nik/tests -v
"""
import os
import random
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'teacher'))
import frame  # noqa: E402


class TestFrame(unittest.TestCase):
    def test_every_row_passes_the_arithmetic_checker(self):
        """the generator's own checker must accept every row it produces (it rejects
        a row whose trace disagrees with the answer)."""
        R = random.Random(41)
        for i in range(2000):
            row = frame.sample(R)
            err = frame.check(row)
            self.assertIsNone(err, f'row {i}: {err} :: {row}')

    def test_gold_is_in_the_answer(self):
        R = random.Random(7)
        for _ in range(500):
            row = frame.sample(R)
            self.assertIn(row['gold'], row['messages'][-1]['content'])

    def test_shape_matches_the_sft_mix(self):
        R = random.Random(3)
        row = frame.sample(R)
        self.assertEqual(row['cat'], 'math-word-frame')
        self.assertIn('gold', row)
        self.assertEqual(len(row['messages']), 2)
        self.assertEqual(row['messages'][0]['role'], 'user')
        self.assertEqual(row['messages'][1]['role'], 'nik')
        # the scratchpad must be in 'think': that is the key audit.py inspects, and
        # audit.check() rejects a math row whose assistant turn has no think block.
        self.assertIn('think', row['messages'][1])
        self.assertTrue(row['messages'][1]['think'].strip())

    def test_rows_pass_the_real_audit(self):
        """the rows must survive nik/data/teacher/audit.py, which is what build.py
        filters on.  (This is how the 'steps' vs 'think' bug was found: with the wrong
        key every single row was rejected with 'no-think'.)"""
        from audit import audit
        R = random.Random(99)
        rows = []
        for _ in range(500):
            d = frame.sample(R)
            rows.append({'cat': d['cat'], 'gold': d['gold'], 'messages': d['messages']})
        ok, _ = audit(rows, verbose=False, seen=None)
        self.assertGreater(len(ok) / len(rows), 0.95,
                           f'only {len(ok)}/{len(rows)} rows survived the audit')

    def test_all_scenes_are_reachable(self):
        R = random.Random(11)
        seen = set()
        for _ in range(3000):
            seen.add(frame.sample(R)['messages'][0]['content'][:20])
        # every scene family must show up in a few thousand rows
        self.assertGreaterEqual(len(seen), 10)
        self.assertEqual(len(frame.SCENES), 33)   # 14 + 10 surfaces + 4 diagnostic + 4 three-step + the English frames

    def test_every_row_has_a_distractor(self):
        """a number in the text that must not be used: the model's measured failure is
        choosing the wrong operand, so every problem must contain a decoy number."""
        R = random.Random(5)
        for _ in range(300):
            user = frame.sample(R)['messages'][0]['content']
            # the English frames carry an English decoy (the same job: a number in the
            # text that must not be used)
            self.assertTrue(any(k in user for k in ('aaj ko din', 'ghar ma', 'bazaar ma', 'phole',
                                                    'opens at', 'Yesterday', 'walked for',
                                                    'clock on the wall', 'weighs')),
                            f'no distractor in: {user}')

    def test_rows_are_multi_step(self):
        R = random.Random(13)
        for _ in range(300):
            steps = frame.sample(R)['messages'][1]['think']
            self.assertGreaterEqual(steps.count('='), 2, f'not a chain: {steps}')

    def test_cli_writes_rows(self):
        import json
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, 'f.jsonl')
            frame.main.__globals__['sys'].argv = ['frame.py', '--n', '50', '--seed', '1', '--out', out]
            frame.main()
            rows = [json.loads(l) for l in open(out, encoding='utf8')]
            self.assertEqual(len(rows), 50)
            for r in rows:
                self.assertIsNone(frame.check(r))


if __name__ == '__main__':
    unittest.main()
