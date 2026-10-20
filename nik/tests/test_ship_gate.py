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
            for name, data in (('old', old), ('new', new)):
                p = os.path.join(d, name)
                for fn, payload in data.items():
                    if fn.endswith('.log'):
                        open(os.path.join(p, fn), 'w').write(payload)
                    else:
                        json.dump(payload, open(os.path.join(p, fn), 'w'))
            r = subprocess.run([sys.executable, SCRIPT, '--old', od, '--new', nd],
                               capture_output=True, text=True)
            return r.stdout

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
        out = self._run(old, new)
        self.assertIn('understanding', out)
        self.assertIn('PASS', out)
        self.assertNotIn('SKIP', out)

    def test_different_item_sets_skip_the_bench_gate(self):
        old = {'bench-v4b.json': bench_json([('word', 'q-a', True)], 0.66),
               'understand-v4b.json': {'score': 16, 'of': 26, 'rows': []}}
        new = {'bench-v4c.json': bench_json([('word', 'q-b', True), ('word', 'q-c', False)], 0.62),
               'understand-v4c.json': {'score': 19, 'of': 26, 'rows': []}}
        out = self._run(old, new)
        self.assertIn('SKIP', out)
        self.assertIn('NOT COMPARABLE', out)
        self.assertIn('compare.py', out)

    def test_held_out_family_gate(self):
        """the real prize: a held-out word family must come off zero"""
        items = [('word', 'bus travels at 60 km per hour', False),
                 ('word', 'kaksha ma 14 keta', True)]
        old = {'bench-v4b.json': bench_json(items, 0.6),
               'understand-v4b.json': {'score': 16, 'of': 26, 'rows': []}}
        new = {'bench-v4c.json': bench_json(items, 0.6),
               'understand-v4c.json': {'score': 19, 'of': 26, 'rows': []}}
        out = self._run(old, new)
        self.assertIn('held-out word families off zero', out)


if __name__ == '__main__':
    unittest.main()
