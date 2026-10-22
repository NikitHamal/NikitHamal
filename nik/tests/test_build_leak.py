"""`build.py` must hide every strict-eval question, not just eval_understand's.

A 24,000-row seed-11 mix built by build.py still contained 5 verbatim `stress.py`
questions (`mero naam k ho?` x4, `paisa kasari bachaune?` x1) because its probe guard
read only eval_understand.py. Stress is a FATAL set in leak_audit: a model trained on
those rows is measured on questions it has memorised, so stress stops being a gate.

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
TEACHER = os.path.join(NIK, 'data', 'teacher')
sys.path.insert(0, TEACHER)
sys.path.insert(0, NIK)
sys.path.insert(0, os.path.join(NIK, 'scripts'))
import build  # noqa: E402
import leak_audit  # noqa: E402


def _row(text):
    return {'messages': [{'role': 'user', 'content': text},
                         {'role': 'nik', 'content': 'thik chha.'}]}


PROMPTS = leak_audit.collect_prompts(ROOT)
GUARD = build._probe_guard()


class TestProbeGuardCoversAllEvals(unittest.TestCase):
    def test_stress_prompt_is_rejected(self):
        leaked = PROMPTS.get('stress', [])
        self.assertTrue(leaked, 'stress.py prompts must be collectable')
        for p in leaked[:12]:
            self.assertTrue(GUARD(_row(p)), 'stress prompt passes the guard: %r' % p[:70])

    def test_chat_check_prompt_is_rejected(self):
        for p in PROMPTS.get('chat_check', [])[:12]:
            self.assertTrue(GUARD(_row(p)), 'chat_check prompt passes the guard: %r' % p[:70])

    def test_understand_prompt_is_rejected(self):
        for p in PROMPTS.get('eval_understand', [])[:12]:
            self.assertTrue(GUARD(_row(p)), 'understanding prompt passes the guard: %r' % p[:70])

    def test_ordinary_row_is_not_rejected(self):
        self.assertFalse(GUARD(_row('mero sanga 12 wata kitab chha, 5 wata sathi lai diyo.')))
        self.assertFalse(GUARD(_row('bholi bihar bahat hunchha, kati bigah aunu parchha?')))


@unittest.skipUnless(os.environ.get('NIK_SLOW_TESTS') == '1', 'set NIK_SLOW_TESTS=1 to build a mix')
class TestRealMixIsClean(unittest.TestCase):
    def test_built_mix_has_zero_fatal_exact_hits(self):
        out = os.path.join(tempfile.mkdtemp(), 'mix.jsonl')
        subprocess.run([sys.executable, os.path.join(TEACHER, 'build.py'),
                        '--n', '600', '--seed', '11', '--out', out],
                       check=True, capture_output=True, timeout=900)
        rows = leak_audit.load_rows([out])
        self.assertGreater(len(rows), 400, 'the mix was not actually built, so this check is vacuous')
        res = leak_audit.audit_rows(rows, leak_audit.collect_prompts(ROOT), near=False)
        fatal = [e for e in res['exact'] if e['source'] in leak_audit.FATAL]
        self.assertEqual(fatal[:5], [], 'fatal eval prompt inside a built mix: %s'
                         % [e['prompt'][:60] for e in fatal[:5]])


if __name__ == '__main__':
    unittest.main()
