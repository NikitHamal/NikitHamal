"""Tests for the grounded-ledger generator and its binding-aware scorer.

Run with::

    cd F:\\NikitHamal && python -m unittest nik.tests.test_ledger -v

CPU only: no model, GPU, network or Node.
"""
import random
import re
import sys
import unittest
from copy import deepcopy
from pathlib import Path

NIK = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(NIK), str(NIK / 'data' / 'teacher')]

import ledger
import ledger_scoring
from audit import check


def user_turn(row):
    for message in row['messages']:
        if message['role'] == 'user':
            return message['content']
    return ''


def skeleton(text):
    """Surface wording only: every number becomes one placeholder."""
    return re.sub(r'\d+', '#', text)


EVENT_BINDING = {
    'add': 'add{}',
    'remove': 'remove{}',
    'buy': 'buy{}_count',
    'sell': 'sell{}_count',
    'pack': 'pack{}_groups',
    'share': 'share{}_people',
}


def all_events_rendered(spec, variant):
    """True if no number-dependent branch skipped one of the spec's events."""
    bindings = variant['ledger']['bindings']
    return all(EVENT_BINDING[event].format(index) in bindings
               for index, event in enumerate(spec['events'], 1))


class GeneratedRows(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        rng = random.Random(7)
        cls.rows = [ledger.sample(rng) for _ in range(500)]

    def test_generated_rows_pass_audit(self):
        for index, row in enumerate(self.rows):
            errors = check(row)
            self.assertEqual(errors, [], f'row {index} failed audit: {errors}\n{row}')

    def test_bindings_grounded(self):
        for index, row in enumerate(self.rows):
            user = user_turn(row)
            for role, value in row['ledger']['bindings'].items():
                self.assertTrue(
                    ledger_scoring.has_value(user, value),
                    f'row {index}: role {role} value {value!r} is not in user turn {user!r}')

    def test_hisab_derives_gold(self):
        # Every hisab step must use only dieko values or earlier results, and the
        # last result must be the gold. This catches skipped planning steps that
        # audit.check cannot see (the final answer can still be right).
        rng = random.Random(23)
        for index in range(5000):
            row = ledger.sample(rng)
            think = row['messages'][1]['think']
            dieko = re.search(r'dieko:\s*(.*)', think).group(1)
            hisab = re.search(r'hisab:\s*(.*)', think).group(1)
            allowed = set(re.findall(r'\[[^=]+=([^\]]+)\]', dieko))
            result = None
            for step in hisab.split(';'):
                numbers = re.findall(r'-?\d+(?:\.\d+)?', step)
                self.assertGreaterEqual(len(numbers), 3, f'row {index}: bad step {step!r}\n{think}')
                *operands, result = numbers
                for operand in operands:
                    self.assertIn(operand, allowed,
                                  f'row {index}: operand {operand} in {step!r} is neither a dieko value nor an earlier result; '
                                  f'allowed={sorted(allowed)}\n{think}')
                allowed.add(result)
            self.assertEqual(result, row['gold'],
                             f'row {index}: last hisab result {result} != gold {row["gold"]}\n{think}')


class CounterfactualSurface(unittest.TestCase):
    def test_counterfactuals_share_surface(self):
        rng = random.Random(11)
        golds_by_spec = []
        attempts = 0
        # render() can legitimately skip a number-dependent event (an unaffordable
        # buy, a share that does not divide), which changes the number of sentences.
        # Collect 100 specs whose events all rendered in every variant, then check
        # that their surface wording is identical up to the numbers themselves.
        while len(golds_by_spec) < 100 and attempts < 200:
            attempts += 1
            spec = ledger.make_spec(rng)
            variants = [ledger.render(spec, rng) for _ in range(3)]
            if not all(all_events_rendered(spec, variant) for variant in variants):
                continue
            surfaces = [skeleton(variant['messages'][0]['content']) for variant in variants]
            self.assertEqual(len(set(surfaces)), 1,
                             f'counterfactuals changed surface wording for spec {spec}')
            golds_by_spec.append([variant['gold'] for variant in variants])
        self.assertEqual(len(golds_by_spec), 100,
                         f'only {len(golds_by_spec)} complete specs in {attempts} attempts')
        distinct = sum(1 for golds in golds_by_spec if len(set(golds)) >= 2)
        self.assertGreaterEqual(distinct, 90,
                                f'only {distinct}/100 specs produced 2+ distinct golds')

    def test_sample_variants_prefers_same_surface(self):
        # sample_variants retries to avoid number-dependent event skips; it should
        # deliver strict counterfactual triples for the large majority of specs.
        rng = random.Random(17)
        same = 0
        for _ in range(200):
            variants = ledger.sample_variants(rng, 3)
            self.assertEqual(len(variants), 3)
            surfaces = {skeleton(v['messages'][0]['content']) for v in variants}
            same += len(surfaces) == 1
        self.assertGreaterEqual(same, 180, f'only {same}/200 strict triples')


class Scoring(unittest.TestCase):
    def setUp(self):
        self.row = ledger.sample(random.Random(1))
        self.think = self.row['messages'][1]['think']
        self.answer = self.row['messages'][1]['content']
        self.out = self.think + '<|/think|>' + self.answer

    def test_score_good_ledger(self):
        score = ledger_scoring.score_output(self.row, self.out)
        self.assertEqual(score['binding_precision'], 1.0)
        self.assertEqual(score['binding_recall'], 1.0)
        self.assertEqual(score['missing'], [])
        self.assertTrue(score['final_ok'])
        self.assertTrue(score['ledger_present'])

    def test_score_catches_wrong_binding(self):
        role = 'money0'
        match = re.search(r'\[' + re.escape(role) + r'=([^\]]*)\]', self.think)
        self.assertIsNotNone(match, 'money0 binding missing from ledger')
        old_pair = match.group(0)
        wrong_out = self.out.replace(old_pair, f'[{role}=999999]', 1)
        self.assertNotEqual(wrong_out, self.out)
        self.assertNotIn('999999', user_turn(self.row))
        score = ledger_scoring.score_output(deepcopy(self.row), wrong_out)
        self.assertLess(score['binding_precision'], 1.0)
        self.assertTrue(score['missing'])
        self.assertIn(role, score['missing'])

    def test_score_catches_missing_binding(self):
        match = re.search(r'\[[A-Za-z0-9_]+=[^\]]*\]', self.think)
        self.assertIsNotNone(match, 'ledger has no bindings')
        out = self.out.replace(match.group(0), '', 1)
        score = ledger_scoring.score_output(deepcopy(self.row), out)
        self.assertLess(score['binding_recall'], 1.0)
        self.assertTrue(score['missing'])

    def test_no_ledger(self):
        score = ledger_scoring.score_output(self.row, self.answer)
        self.assertFalse(score['ledger_present'])
        self.assertEqual(score['binding_precision'], 0.0)

    def test_numeric_boundaries_match_js(self):
        # web/ledger.js hasValue: whole numeric tokens only, fractions and signs included
        self.assertTrue(ledger_scoring.has_value('12 + 25', '25'))
        self.assertFalse(ledger_scoring.has_value('12 + 25', '2'))
        self.assertFalse(ledger_scoring.has_value('2.5', '2'))
        self.assertFalse(ledger_scoring.has_value('2/3', '2'))
        self.assertTrue(ledger_scoring.has_value('2/3', '2/3'))
        self.assertFalse(ledger_scoring.has_value('-5', '5'))
        self.assertTrue(ledger_scoring.has_value('-5', '-5'))
        self.assertTrue(ledger_scoring.has_value('kalam 5 wata', 'kalam'))
        self.assertFalse(ledger_scoring.has_value('kalams 5 wata', 'kalam'))

    def test_has_value_numeric_tokens(self):
        self.assertTrue(ledger_scoring.has_value('12 + 25', 12))
        self.assertFalse(ledger_scoring.has_value('12 + 25', 2))
        self.assertFalse(ledger_scoring.has_value('2/3', 2))
        self.assertFalse(ledger_scoring.has_value('-5', 5))
        self.assertTrue(ledger_scoring.has_value('-5', -5))
        self.assertTrue(ledger_scoring.has_value('ram le KALAM kinyo', 'kalam'))
        self.assertFalse(ledger_scoring.has_value('business', 'bus'))


if __name__ == '__main__':
    unittest.main()
