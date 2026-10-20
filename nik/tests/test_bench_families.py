"""Tests for the per-family bench report (Local-C, issue #9)."""
import json
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(os.path.dirname(HERE), 'scripts', 'bench_families.py')


def row(cat, q, ok, gold='1'):
    return {'cat': cat, 'q': q, 'ok': ok, 'gold': gold, 'out': ''}


class TestBenchFamilies(unittest.TestCase):
    def test_groups_the_families(self):
        sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'scripts'))
        import bench_families as bf
        rows = [row('word', 'a bus travels at 60 km per hour for 3 hours, then 15 km more. How far?', False),
                row('word', 'bibek sanga 65 rupiya chha. usle 4 wata chakleti kinyo', True),
                row('reason', 'shrinkhala: 1, 2, 3, arko number?', False),
                row('reason', '3 ghanta ma kati minute?', True),
                row('arith-add2', '1 + 2 = ?', True)]
        bd = bf.breakdown(rows)
        self.assertEqual(bd[('word', 'bus (English)')], [0, 1])
        self.assertEqual(bd[('word', 'chakleti (buys snacks)')], [1, 1])
        self.assertEqual(bd[('reason', 'arithmetic sequence')], [0, 1])
        self.assertEqual(bd[('reason', 'unit (h->min)')], [1, 1])
        # the arith category is not part of the word/reason view
        self.assertEqual(len(bd), 4)

    def test_cli_reports_and_compares(self):
        with tempfile.TemporaryDirectory() as d:
            a = os.path.join(d, 'a.json')
            b = os.path.join(d, 'b.json')
            json.dump({'overall': 0.5, 'groups': {}, 'rows': [
                row('word', 'bus travels at 60 km per hour', False),
                row('reason', 'shrinkhala: 1, 2, 3, arko number?', False)]}, open(a, 'w'))
            json.dump({'overall': 0.75, 'groups': {}, 'rows': [
                row('word', 'bus travels at 60 km per hour', True),
                row('reason', 'shrinkhala: 1, 2, 3, arko number?', False)]}, open(b, 'w'))
            out = subprocess.run([sys.executable, SCRIPT, '--json', a, '--json', b],
                                 capture_output=True, text=True).stdout
            self.assertIn('bus (English)', out)
            self.assertIn('per-family delta', out)
            self.assertIn('+1', out)

    def test_understand_probes_by_kind(self):
        with tempfile.TemporaryDirectory() as d:
            u = os.path.join(d, 'u.json')
            json.dump({'score': 1, 'of': 3, 'rows': [
                {'kind': 'memory', 'q': 'q1', 'a': 'a1', 'pass': True},
                {'kind': 'memory', 'q': 'q2', 'a': 'a2', 'pass': False},
                {'kind': 'grammar', 'q': 'q3', 'a': 'a3', 'pass': True}]}, open(u, 'w'))
            out = subprocess.run([sys.executable, SCRIPT, '--understand', u],
                                 capture_output=True, text=True).stdout
            self.assertIn('memory', out)
            self.assertIn('1/2', out)
            self.assertIn('failing probes', out)


if __name__ == '__main__':
    unittest.main()
