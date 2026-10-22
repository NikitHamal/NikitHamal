"""The two RW-behaviour families must satisfy the bench that judges them, and stay held out.

The point of `abstain.py` and `format_ask.py` is that a row teaches a behaviour the
NikBench-RW scorer accepts. That is testable without a model: every gold answer is run
through `bench_rw.score()` with the kind and spec the row was built for. A row whose gold
fails the scorer is a row teaching the wrong envelope, which is exactly how the model
ended up answering `12 + 15 ko jawaf matra deu` with `10.`

    python -m unittest discover -s nik/tests -v
"""
import os
import random
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
NIK = os.path.dirname(HERE)
TEACHER = os.path.join(NIK, 'data', 'teacher')
sys.path.insert(0, TEACHER)
sys.path.insert(0, NIK)
sys.path.insert(0, os.path.join(NIK, 'scripts'))
import abstain  # noqa: E402
import opwords  # noqa: E402
import bench_rw  # noqa: E402
import format_ask  # noqa: E402
import leak_audit  # noqa: E402
from audit import check  # noqa: E402


class TestAbstain(unittest.TestCase):
    def test_every_gold_passes_the_rw_unknown_scorer(self):
        R = random.Random(3)
        for _ in range(400):
            row = abstain.sample(R)
            self.assertTrue(bench_rw.score('unknown', None, row['gold']),
                            'gold fails the RW unknown scorer: %r' % row['gold'])
            self.assertEqual([], bench_rw.re.findall(r'\d', row['gold']),
                              'abstention gold must not contain a digit: %r' % row['gold'])

    def test_rows_pass_the_teacher_audit(self):
        R = random.Random(4)
        for _ in range(200):
            row = abstain.sample(R)
            self.assertEqual(check(row), [], 'audit rejected %r' % row['messages'][0]['content'][:60])

    def test_registers_are_all_present(self):
        R = random.Random(5)
        qs = [abstain.sample(R)['messages'][0]['content'] for _ in range(400)]
        self.assertTrue(any(q.startswith('"') for q in qs), 'no quoted-register row')
        self.assertTrue(any('ta ho ni' in q for q in qs), 'no chatty-register row')


class TestFormat(unittest.TestCase):
    def test_every_gold_passes_the_rw_format_scorer(self):
        R = random.Random(6)
        for _ in range(400):
            row = format_ask.sample(R)
            kind, spec = row['kind'], row['spec']
            self.assertTrue(bench_rw.score(kind, spec, row['gold']),
                            '%s gold fails the scorer: %r' % (kind, row['gold']))

    def test_a_wrong_envelope_is_rejected(self):
        """the test would be vacuous if the scorer accepted a chatty answer for only_number"""
        self.assertFalse(bench_rw.score('fmt:only_number', '57', 'jawaf 57 ho.'))
        self.assertFalse(bench_rw.score('fmt:list3', None, 'aalu ra pyaj ra kauli'))


class TestHeldOut(unittest.TestCase):
    def test_no_overlap_with_the_rw_prompts(self):
        prompts = {'bench_rw': [turns for _, _, _, vs in bench_rw.G for v in vs
                                for turns in (v if isinstance(v, list) else [v])]}
        rows = []
        for seed in (7, 8, 9):
          R = random.Random(seed)
          for _ in range(300):
              rows.append(abstain.sample(R))
              rows.append(format_ask.sample(R))
        res = leak_audit.audit_rows(rows, prompts, near_n=8)
        self.assertEqual(res['exact'][:3], [], 'a generated row is a bench_rw prompt verbatim')
        self.assertEqual(res['near'][:3], [], 'a generated row is 8-gram close to a bench_rw prompt')


class TestOpwords(unittest.TestCase):
    def test_every_equation_in_the_reply_is_true(self):
        R = random.Random(11)
        for _ in range(500):
            row = opwords.sample(R)
            reply = row['messages'][1]['content']
            m = bench_rw.re.match(r'(\d+) ([-+x/]) (\d+) = (\d+)', reply)
            self.assertIsNotNone(m, 'reply has no equation: %r' % reply)
            a, sym, b, got = int(m.group(1)), m.group(2), int(m.group(3)), int(m.group(4))
            want = {'+': a + b, '-': a - b, 'x': a * b, '/': a // b}[sym]
            self.assertEqual(got, want, 'wrong arithmetic in %r' % reply)
            self.assertEqual(str(got), row['gold'])

    def test_subtraction_uses_the_unambiguous_argument_structure(self):
        """`a ra b ghatnus` is ambiguous Nepali and the live model reads it as addition"""
        R = random.Random(12)
        for _ in range(300):
            row = opwords.sample(R)
            q = row['messages'][0]['content']
            if ' ghat' in q or 'ghatnus' in q or 'ghatda' in q:
                self.assertIn('bata', q, 'ambiguous subtraction prompt: %r' % q)

    def test_rows_pass_the_teacher_audit(self):
        R = random.Random(13)
        for _ in range(300):
            self.assertEqual(check(opwords.sample(R)), [])


if __name__ == '__main__':
    unittest.main()
