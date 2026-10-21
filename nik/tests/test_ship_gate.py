"""Tests for the ship gate (Local-C, issue #9)."""
import json
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(os.path.dirname(HERE), 'scripts', 'ship_gate.py')


def bench_json(items, overall=0.6):
    return {'overall': overall, 'groups': {'word': '0/8'},
            'rows': [{'cat': c, 'q': q, 'gold': '1', 'ok': ok, 'out': ''} for c, q, ok in items]}


class TestShipGate(unittest.TestCase):
    def _run(self, old, new):
        with tempfile.TemporaryDirectory() as d:
            od, nd = os.path.join(d, 'old'), os.path.join(d, 'new')
            os.makedirs(od); os.makedirs(nd)
            for p, data in ((od, old), (nd, new)):
                for fn, payload in data.items():
                    if fn.endswith('.log'):
                        open(os.path.join(p, fn), 'w').write(payload)
                    else:
                        json.dump(payload, open(os.path.join(p, fn), 'w'))
            r = subprocess.run([sys.executable, SCRIPT, '--old', od, '--new', nd],
                               capture_output=True, text=True)
            return r.stdout, r.returncode

    def test_same_item_set_runs_every_gate(self):
        items = [('word', 'bus travels at 60 km per hour', True), ('reason', 'shrinkhala: 1, 2, 3', False)]
        old = {'bench-v4b.json': bench_json(items, 0.5),
               'understand-v4b.json': {'score': 16, 'of': 26, 'rows': []},
               'stress-v4b.json': {'score': 59, 'of': 103, 'rows': []},
               'eval-v4b.json': {'math_acc': 0.95, 'persona_acc': 1.0},
               'chat-v4b.log': 'chat sanity: 15/15 ok'}
        new = {'bench-v4c.json': bench_json(items, 0.6),
               'understand-v4c.json': {'score': 19, 'of': 26, 'rows': []},
               'stress-v4c.json': {'score': 64, 'of': 103, 'rows': []},
               'eval-v4c.json': {'math_acc': 0.945, 'persona_acc': 1.0},
               'chat-v4c.log': 'chat sanity: 15/15 ok'}
        out, code = self._run(old, new)
        self.assertIn('understanding', out)
        self.assertIn('PASS', out)
        self.assertNotIn('SKIP', out)
        self.assertEqual(code, 0)   # SHIP

    def test_different_item_sets_block_the_verdict(self):
        """Local-A's critique: a FAIL on an indicative comparison is the failure this
        tool exists to prevent.  Every row-derived gate must SKIP, and the verdict
        must be CANNOT DECIDE, not DO NOT SHIP."""
        old = {'bench-v4b.json': bench_json([('word', 'q-a', True)], 0.66),
               'understand-v4b.json': {'score': 16, 'of': 26, 'rows': []}}
        new = {'bench-v4c.json': bench_json([('word', 'q-b', True), ('word', 'q-c', False)], 0.62),
               'understand-v4c.json': {'score': 19, 'of': 26, 'rows': []}}
        out, code = self._run(old, new)
        self.assertIn('SKIP', out)
        self.assertIn('NOT COMPARABLE', out)
        self.assertIn('compare.py', out)
        self.assertIn('CANNOT DECIDE', out)
        self.assertNotIn('DO NOT SHIP', out)
        self.assertEqual(code, 2)   # CANNOT DECIDE
        # no family gate may still be a hard FAIL
        self.assertNotIn('[FAIL] held-out word families off zero', out)
        self.assertIn('[SKIP] held-out word families off zero', out)

    def test_a_real_failure_is_does_not_ship(self):
        """same item set, the candidate really is worse -> DO NOT SHIP (exit 1)"""
        items = [('word', 'bus travels at 60 km per hour', True)]
        old = {'bench-v4b.json': bench_json(items, 0.66),
               'understand-v4b.json': {'score': 19, 'of': 26, 'rows': []}}
        new = {'bench-v4c.json': bench_json(items, 0.30),
               'understand-v4c.json': {'score': 19, 'of': 26, 'rows': []}}
        out, code = self._run(old, new)
        self.assertIn('DO NOT SHIP', out)
        self.assertEqual(code, 1)

    def test_held_out_family_gate_is_hard_when_comparable(self):
        """the real prize: a held-out word family must come off zero"""
        old_items = [('word', 'kaksha ma 14 keta', True), ('word', 'masik talab ma 5000 jamma garo', True)]
        new_items = [('word', 'kaksha ma 14 keta', False), ('word', 'masik talab ma 5000 jamma garo', True)]
        old = {'bench-v4b.json': bench_json(old_items, 0.6),
               'understand-v4b.json': {'score': 16, 'of': 26, 'rows': []}}
        new = {'bench-v4c.json': bench_json(new_items, 0.6),
               'understand-v4c.json': {'score': 19, 'of': 26, 'rows': []}}
        out, code = self._run(old, new)
        # the count gate alone would pass this (2 -> 1 still means ">= 1 off zero");
        # the fallback gate is what catches a family dropping back to zero
        self.assertIn('[FAIL] no family fell back to zero', out)
        self.assertIn('word/kaksha (classroom)', out)
        self.assertIn('DO NOT SHIP', out)   # the family gate is a hard gate here
        self.assertEqual(code, 1)


    def test_a_candidate_with_no_logs_cannot_be_shipped(self):
        """a false SHIP is the worst failure of a gate: no data is not a pass"""
        old = {'bench-v4b.json': bench_json([('word', 'q-a', True)], 0.66),
               'understand-v4b.json': {'score': 16, 'of': 26, 'rows': []}}
        out, code = self._run(old, {})
        self.assertIn('CANNOT DECIDE', out)
        self.assertNotIn('VERDICT: SHIP', out)
        self.assertEqual(code, 2)

    def test_the_ladder_is_a_gate(self):
        """the procedure ladder: a candidate must move L2/L4 off zero"""
        items = [('word', 'kaksha ma 14 keta', True)]
        ladder = {'rows': [], 'groups': {
            'L1-1step': {'ok': 12, 'n': 12, 'coverage': 1.0},
            'L2-2step': {'ok': 0, 'n': 12, 'coverage': 0.75},
            'L4-chain-2line': {'ok': 2, 'n': 12, 'coverage': 0.6}}}
        old = {'bench-v4b.json': bench_json(items, 0.6),
               'understand-v4b.json': {'score': 16, 'of': 26, 'rows': []},
               'ladder-v4b.json': ladder}
        new = {'bench-v4d.json': bench_json(items, 0.6),
               'understand-v4d.json': {'score': 19, 'of': 26, 'rows': []},
               'ladder-v4d.json': ladder}
        out, code = self._run(old, new)
        self.assertIn('ladder L2 (two steps)', out)
        self.assertIn('[FAIL] ladder multi-step off zero', out)
        self.assertEqual(code, 1)


if __name__ == '__main__':
    unittest.main()
