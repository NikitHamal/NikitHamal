"""chat.py must hold out *every* strict-eval surface, not the four it happens to list.

sft8 - the mix the live v4f was trained on - shipped 9,144 rows whose user turn is
verbatim from chat_check.py / stress.py (`subha ratri` x2,628, `namaste! k chha?` x3,537,
`k gardai chhau?` x1,334), and the chat-* categories were the source. chat.py's guard
listed 4 surfaces while chat_check.py has 15, so `dhanyabad hai` walked straight through.

    python -m unittest discover -s nik/tests -v
"""
import os
import random
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
NIK = os.path.dirname(HERE)
ROOT = os.path.dirname(NIK)
sys.path.insert(0, os.path.join(NIK, 'data', 'teacher'))
sys.path.insert(0, os.path.join(NIK, 'scripts'))
import chat  # noqa: E402
import leak_audit  # noqa: E402

PROMPTS = leak_audit.collect_prompts(ROOT)
FATAL = {leak_audit.norm(p) for s in leak_audit.FATAL for p in PROMPTS.get(s, [])}


class TestChatHoldsOutEveryEvalSurface(unittest.TestCase):
    def test_guard_knows_surfaces_the_hand_list_misses(self):
        """`dhanyabad hai` is a chat_check prompt and was never in chat.py's HELD"""
        extra = [p for p in PROMPTS.get('chat_check', []) if p == 'dhanyabad hai']
        self.assertTrue(extra, 'chat_check.py no longer contains the surface this test is about')
        d = {'messages': [{'role': 'user', 'content': 'dhanyabad hai'},
                          {'role': 'nik', 'content': 'k chha'}]}
        self.assertTrue(chat._held(d), 'chat.py let a chat_check prompt through')

    def test_generated_chat_rows_are_clean(self):
        R = random.Random(7)
        bad = []
        for _ in range(4000):
            d = chat.sample(R)
            for m in d['messages']:
                if m['role'] == 'user' and leak_audit.norm(m['content']) in FATAL:
                    bad.append(m['content'][:60])
        self.assertEqual(bad[:5], [], 'chat.py generated %d fatal eval surfaces' % len(bad))

    def test_ordinary_chat_still_passes_the_guard(self):
        d = {'messages': [{'role': 'user', 'content': 'malai pahaad garna man parchha'},
                          {'role': 'nik', 'content': 'ramro!'}]}
        self.assertFalse(chat._held(d))


if __name__ == '__main__':
    unittest.main()
