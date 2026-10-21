"""Scoring tests for the hard bench (no model)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bench_hard as B


class IdentityScoring(unittest.TestCase):
    def test_user_intro_passes_without_bio(self):
        self.assertTrue(B.identity_pass('user_intro', 'namaste nikit! k ma help garu?'))
        self.assertTrue(B.identity_pass('user_intro', 'hi nikit, kasto chha?'))

    def test_user_intro_fails_on_bio(self):
        bio = 'nikit hamal nepal ka android app developer ra full-stack engineer hunuhunchha. uha consica labs ma head of operations hunuhunchha.'
        self.assertFalse(B.identity_pass('user_intro', bio))

    def test_creator_needs_fact(self):
        self.assertTrue(B.identity_pass('creator', 'nikit hamal le malai banaunubhayeko ho.'))
        self.assertFalse(B.identity_pass('creator', 'namaste nikit!'))

    def test_ambiguous_needs_clarification(self):
        self.assertTrue(B.identity_pass('ambiguous', 'tapai afno barema sodhnu bhayo ki nikit hamal ko?'))
        self.assertFalse(B.identity_pass('ambiguous', 'nikit hamal android developer hunuhunchha.'))

    def test_assistant_identity(self):
        self.assertTrue(B.identity_pass('assistant', 'ma Nik ho, nikit hamal le banaunubhayeko.'))


class PairScoring(unittest.TestCase):
    def test_number_boundaries(self):
        self.assertTrue(B.contains('jamma 600 rupiya.', ['600']))
        self.assertFalse(B.contains('jamma 600 rupiya.', ['6']))
        self.assertFalse(B.contains('10 km', ['1']))
        self.assertTrue(B.contains('10 km', ['10']))

    def test_pair_requires_both(self):
        p = {'e1': ['kamal'], 'e2': ['sita']}
        self.assertTrue(B.pair_pass('kamal le diyo.', 'sita le payo.', p))
        self.assertFalse(B.pair_pass('kamal le diyo.', 'kamal le payo.', p))


if __name__ == '__main__':
    unittest.main()
