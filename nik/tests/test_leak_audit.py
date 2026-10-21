"""Tests for the eval-prompt leak gate.

    cd F:\\NikitHamal && python -m unittest nik.tests.test_leak_audit -v

CPU only: no model, GPU, network or Node.
"""
import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
NIK = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(NIK, 'scripts'))
import leak_audit as la  # noqa: E402

PROMPTS = {
    'eval_understand': ['"river" lai nepali ma k bhanchha?', 'ma aile kaha baschhu?'],
    'chat_check': ['namaste! k chha?'],
    'bench_hard': ['mero naam nikit ho'],
}


def row(*users, cat='test'):
    return {'cat': cat, 'messages': [{'role': 'user', 'content': u} for u in users]
            + [{'role': 'nik', 'content': 'jawaf'}]}


class LeakAuditTest(unittest.TestCase):
    def test_exact_leak_is_found(self):
        r = la.audit_rows([row('"river" lai nepali ma k bhanchha?')], PROMPTS)
        self.assertEqual(r['by_source'], {'eval_understand': 1})
        self.assertEqual(r['exact'][0]['source'], 'eval_understand')

    def test_case_space_and_trailing_punctuation_do_not_evade(self):
        r = la.audit_rows([row('  NAMASTE!   k chha?  ')], PROMPTS)
        self.assertEqual(r['by_source'], {'chat_check': 1})

    def test_paraphrase_is_not_an_exact_leak(self):
        r = la.audit_rows([row('"river" ko nepali shabda k ho?')], PROMPTS)
        self.assertEqual(r['by_source'], {})

    def test_multiturn_second_user_turn_is_checked(self):
        r = la.audit_rows([row('mero naam binod ho', 'ma aile kaha baschhu?')], PROMPTS)
        self.assertEqual(r['exact'][0]['source'], 'eval_understand')

    def _run_main(self, mix):
        fd, path = tempfile.mkstemp(suffix='.jsonl')
        os.close(fd)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(json.dumps(mix) + '\n')
        out = io.StringIO()
        try:
            with mock.patch.object(la, 'collect_prompts', lambda root: PROMPTS), \
                 mock.patch.object(sys, 'argv', ['leak_audit.py', path]), \
                 contextlib.redirect_stdout(out):
                code = la.main()
        finally:
            os.unlink(path)
        return code, out.getvalue()

    def test_bench_hard_overlap_is_advisory_only(self):
        code, text = self._run_main(row('mero naam nikit ho'))
        self.assertEqual(code, 0)
        self.assertIn('exact bench_hard: 1', text)

    def test_fatal_exact_fails(self):
        code, text = self._run_main(row('namaste! k chha?'))
        self.assertEqual(code, 1)
        self.assertIn('FAIL leak_audit', text)

    def test_near_hit_flags_long_shared_span(self):
        prompts = {'eval_understand': ['mero naam binod ho ra ma kathmandu ma baschhu']}
        r = la.audit_rows([row('mero naam binod ho ra ma kathmandu ma baschhu, thik chha?')], prompts)
        self.assertEqual(r['exact'], [])
        self.assertEqual(r['near'][0]['source'], 'eval_understand')

    def test_behavior_mix_drops_eval_prompts(self):
        sys.path.insert(0, os.path.join(NIK, 'data'))
        import behavior_mix
        self.assertTrue(behavior_mix.leaks_eval(row('timi chatgpt hau?')))
        self.assertFalse(behavior_mix.leaks_eval(row('mero naam ram ho')))

    def test_real_eval_sets_contain_the_known_river_probe(self):
        prompts = la.collect_prompts(la.ROOT)
        self.assertTrue(any('river' in p for p in prompts['eval_understand']))
        self.assertTrue(any(p == 'namaste! k chha?' for p in prompts['chat_check']))
        self.assertTrue(any(p == 'mero naam nikit ho' for p in prompts['bench_hard']))


if __name__ == '__main__':
    unittest.main()
