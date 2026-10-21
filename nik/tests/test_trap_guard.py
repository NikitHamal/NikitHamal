"""trap_check prompts stay held out of SFT mixes (make_sft2 eval-prompt guard).

names.py emitted the trap sentence "mero naam nikit ho" ~700x per 100k rows, so trap_check scored a trained
prompt. The guard drops rows with a full trap sentence and keeps generic follow-ups ("mero naam k ho?").
CPU only.
"""
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
NIK = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(NIK, 'scripts'))
import leak_audit as la  # noqa: E402
import make_sft2  # noqa: E402


def line(*users):
    msgs = []
    for u in users:
        msgs += [{'role': 'user', 'content': u}, {'role': 'nik', 'content': 'jawaf'}]
    return json.dumps({'cat': 't', 'messages': msgs}) + '\n'


class TrapGuard(unittest.TestCase):
    def test_trap_prompts_are_collected(self):
        p = la._prompts_trap_check(os.path.join(NIK, 'trap_check.py'))
        self.assertIn('mero naam nikit ho.', p)
        self.assertIn('nik bhanne mero kukur ko naam ho.', p)
        self.assertGreaterEqual(len(p), 12)

    def test_guard_drops_trap_sentences_keeps_context_questions(self):
        rows = [line('Mero naam nikit ho'), line('ma nikit, kathmandu bata.'),
                line('mero naam sita ho', 'mero naam k ho?'), line('mero naam nikit hamal ho')]
        kept = make_sft2._drop_eval_prompts(rows, NIK)
        self.assertEqual(kept, rows[2:])


if __name__ == '__main__':
    unittest.main()
