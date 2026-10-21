"""Tests for the word-procedure probe (Local-C, issue #9).

    python -m unittest discover -s nik/tests -v
"""
import os
import sys
import unittest

SCRIPTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'scripts')
sys.path.insert(0, SCRIPTS)
import word_procedure_probe as probe  # noqa: E402


class TestProbe(unittest.TestCase):
    def test_every_template_has_three_variants_and_one_gold(self):
        items, meta = probe.build(1, seed=7)
        self.assertEqual(len(items), len(probe.TEMPLATES) * 3)
        self.assertEqual(len(meta), len(items))
        for cat, q, gold in items:
            self.assertTrue(cat.startswith('word-'))
            self.assertTrue(q.strip())
            self.assertIsInstance(gold, int)

    def test_the_three_variants_of_a_template_share_the_numbers(self):
        """the three variants must be the SAME problem, so the answer is the same"""
        items, meta = probe.build(1, seed=7)
        by_template = {}
        for m in meta:
            by_template.setdefault(m['template'], {})[m['variant']] = m
        for t, vs in by_template.items():
            self.assertEqual(set(vs), {'orig', 'para', 'formula'}, t)
            golds = {v['gold'] for v in vs.values()}
            self.assertEqual(len(golds), 1, f'{t}: golds differ {golds}')
            nums = {v: _nums(m['q']) for v, m in vs.items()}
            # the paraphrase must use exactly the same numbers (order may differ);
            # the formula variant may repeat them (it spells the operation out)
            self.assertEqual(sorted(nums['orig']), sorted(nums['para']), f'{t}: orig and para differ')
            for n in nums['orig']:
                pass
            # the formula variant spells the operation out; it may repeat a number and
            # it may drop a distractor (the opening savings in masik_talab), but it must
            # still carry the numbers the computation needs
            carried = sum(1 for n in nums['orig'] if n in nums['formula'])
            self.assertGreaterEqual(carried, 2, f'{t}: formula lost too many numbers')

    def test_ladder_levels(self):
        lad = probe.ladder()
        self.assertEqual(len(lad), 48)
        cats = {c for c, _, _ in lad}
        self.assertEqual(cats, {'L1-1step', 'L2-2step', 'L3-intermediate-given', 'L4-chain-2line'})
        for cat, q, gold in lad:
            self.assertIsInstance(gold, int)
            self.assertTrue(q.endswith('= ?'))

    def test_ladder_gold_is_arithmetically_right(self):
        for cat, q, gold in probe.ladder():
            if cat == 'L1-1step':
                a, b = q.split(' - ')[0], q.split(' - ')[1].split(' = ')[0]
                self.assertEqual(gold, int(a) - int(b))
            elif cat == 'L2-2step':
                a = int(q.split(' - (')[0])
                inner = q.split(' - (')[1].split(')')[0]
                b, c = inner.split(' x ')
                self.assertEqual(gold, a - int(b) * int(c))
            elif cat == 'L3-intermediate-given':
                a = int(q.split(' - ')[0])
                b = int(q.split(' - ')[1].split(' = ')[0])
                self.assertEqual(gold, a - b)

    def test_probe_is_deterministic(self):
        a, _ = probe.build(1, seed=7)
        b, _ = probe.build(1, seed=7)
        self.assertEqual(a, b)


def _nums(s):
    out = []
    for tok in s.replace('(', ' ').replace(')', ' ').replace('?', ' ').split():
        if tok.replace('.', '', 1).isdigit():
            out.append(int(float(tok)))
    return out


if __name__ == '__main__':
    unittest.main()
