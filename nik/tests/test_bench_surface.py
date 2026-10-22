"""The surface matrix must be well-formed, must score what it says it scores, and must stay held out.

    python -m unittest discover -s nik/tests -v
"""
import json
import os
import random
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
NIK = os.path.dirname(HERE)
ROOT = os.path.dirname(NIK)
sys.path.insert(0, NIK)
sys.path.insert(0, os.path.join(NIK, 'scripts'))
sys.path.insert(0, os.path.join(NIK, 'data', 'teacher'))
import bench_surface as bs  # noqa: E402
import leak_audit  # noqa: E402


def row(skill, surface, ok):
    return {'skill': skill, 'surface': surface, 'pass': ok}


class TestShape(unittest.TestCase):
    def test_every_skill_has_the_three_surfaces(self):
        for skill, surfaces in bs.CASES:
            names = [n for n, _, _, _ in surfaces]
            self.assertEqual(names, ['probe', 'alt', 'alt2'], '%s: %s' % (skill, names))

    def test_skills_are_uniquely_named(self):
        names = [s for s, _ in bs.CASES]
        self.assertEqual(len(names), len(set(names)))
        self.assertGreaterEqual(len(names), 12)

    def test_questions_differ_within_a_skill(self):
        for skill, surfaces in bs.CASES:
            qs = [q for _, _, q, _ in surfaces]
            self.assertEqual(len(qs), len(set(qs)), skill)


class TestScoring(unittest.TestCase):
    def test_numeric_boundary_is_respected(self):
        self.assertFalse(bs.want_hit('jamma 540 rupiya hunchha', [('5',)]))
        self.assertTrue(bs.want_hit('aba 5 pen chha', [('5',)]))
        self.assertTrue(bs.want_hit('jamma 540 rupiya hunchha', [('540',)]))

    def test_alternative_spellings(self):
        self.assertTrue(bs.want_hit('tyo aaina ho', [('aaina', 'aina')]))
        self.assertFalse(bs.want_hit('tyo dhulo ho', [('aaina', 'aina')]))

    def test_punctuation_is_not_a_word(self):
        self.assertTrue(bs.want_hit('pokhara.', [('pokhara',)]))

    def test_classify_brittle(self):
        cls = bs.classify([row('x', 'probe', False), row('x', 'alt', True), row('x', 'alt2', False)])
        self.assertEqual(cls['x'], 'brittle')

    def test_classify_missing(self):
        cls = bs.classify([row('x', 'probe', False), row('x', 'alt', False), row('x', 'alt2', False)])
        self.assertEqual(cls['x'], 'missing')

    def test_classify_fragile(self):
        cls = bs.classify([row('x', 'probe', True), row('x', 'alt', False), row('x', 'alt2', False)])
        self.assertEqual(cls['x'], 'fragile')

    def test_classify_solid(self):
        cls = bs.classify([row('x', 'probe', True), row('x', 'alt', True), row('x', 'alt2', True)])
        self.assertEqual(cls['x'], 'solid')


class TestHeldOut(unittest.TestCase):
    def test_no_overlap_with_the_understanding_probes(self):
        """the matrix measures brittleness; it must not be the eval it is compared against"""
        prompts = leak_audit.collect_prompts(ROOT)
        mine = [{'messages': [{'role': 'user', 'content': q}]}
                for _, surfaces in bs.CASES for _, _, q, _ in surfaces]
        res = leak_audit.audit_rows(mine, prompts, near=False)
        fatal = [e for e in res['exact'] if e['source'] in leak_audit.FATAL]
        self.assertEqual(fatal[:3], [], 'surface question is an eval prompt: %s'
                         % [e['prompt'][:60] for e in fatal[:3]])


@unittest.skipUnless(os.environ.get('NIK_SLOW_TESTS') == '1', 'set NIK_SLOW_TESTS=1 to build a mix')
class TestHeldOutAgainstMix(unittest.TestCase):
    def test_mix_does_not_contain_the_surface_questions(self):
        out = os.path.join(tempfile.mkdtemp(), 'mix.jsonl')
        subprocess.run([sys.executable, os.path.join(NIK, 'data', 'teacher', 'build.py'),
                        '--n', '1500', '--seed', '5', '--out', out],
                       check=True, capture_output=True, timeout=900)
        rows = leak_audit.load_rows([out])
        self.assertGreater(len(rows), 1000)
        prompts = {'surface_bench': [q for _, s in bs.CASES for _, _, q, _ in s]}
        res = leak_audit.audit_rows(rows, prompts, near_n=6)
        self.assertEqual(res['exact'][:3], [], 'generated mix contains a surface-bench question')
        self.assertEqual(res['near'][:3], [], 'generated mix is 6-gram close to the surface bench')


if __name__ == '__main__':
    unittest.main()
