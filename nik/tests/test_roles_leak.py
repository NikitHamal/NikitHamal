"""The benchmark's word templates must stay held out of the *grounded-role* data too.

Local-C, issue #9.  `nik/data/teacher/roles.py` teaches exactly the skill the
benchmark's word family measures (bind the numbers in a text to their roles, then
compute) - which is exactly why it could become a leak: if a training row reproduces
a benchmark template, the benchmark stops measuring the skill and starts measuring
memorisation.  That is what happened with frame.py's basket scene and the "bagaincha"
family (0/5 -> 10/10 with L2 still 0/12).

So the same rule applies: no generated role row may contain the distinctive wording of
any benchmark word template, and the rows must not reproduce the evaluation probes in
nik/eval_understand.py either.

    python -m unittest discover -s nik/tests -v
"""
import os
import random
import sys
import unittest

TEACHER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'teacher')
sys.path.insert(0, TEACHER)
import roles  # noqa: E402


class TestRolesLeak(unittest.TestCase):
    def test_no_benchmark_wording_in_the_role_rows(self):
        R = random.Random(41)
        bad = []
        for _ in range(3000):
            row = roles.sample(R)
            text = ' '.join(m.get('content', '') for m in row['messages'])
            text += ' ' + ' '.join((m.get('think') or '') for m in row['messages'])
            low = text.lower()
            for w in roles.BANNED:
                if w in low:
                    bad.append((w, text[:120]))
        self.assertEqual(bad[:5], [], f'benchmark wording leaked into the role rows: {bad[:5]}')

    def test_the_ban_list_covers_every_benchmark_word_template(self):
        bench = open(os.path.join(os.path.dirname(TEACHER), '..', 'bench.py'), encoding='utf8').read()
        word = bench.split('def reason')[0].lower()
        banned = ' '.join(roles.BANNED)
        for marker in ('chakleti', 'bagaincha', 'aalu', 'chhora', 'bus travels at', 'kalam',
                       'boxes with', 'masik talab', 'kaksha ma', 'kitab ko mol'):
            self.assertIn(marker, word, f'bench marker missing: {marker}')
            key = {'bus travels at': 'km per hour', 'boxes with': 'apples', 'kaksha ma': 'anupasthit',
                   'kitab ko mol': 'chhut'}.get(marker, marker)
            self.assertIn(key, banned, f'benchmark template not banned: {marker}')

    def test_every_row_passes_its_own_checker(self):
        R = random.Random(97)
        for i in range(600):
            row = roles.sample(R)
            self.assertIsNone(roles.check(row), f'row {i}: {roles.check(row)}')

    def test_the_role_rows_never_reproduce_an_evaluation_probe(self):
        """the understanding probes must stay unseen (the probes are the measurement)"""
        src = open(os.path.join(os.path.dirname(TEACHER), '..', 'eval_understand.py'), encoding='utf8').read()
        i = src.index('PROBES = [')
        j = src.index('\n]\n', i) + 2
        ns = {'U': lambda t: {'role': 'user', 'content': t},
              'N': lambda t: {'role': 'nik', 'content': t}}
        exec(src[i:j], ns)
        prompts = []
        for kind, msgs, want in ns['PROBES']:
            prompts.append(msgs[-1]['content'].lower())
        R = random.Random(53)
        bad = []
        for _ in range(3000):
            row = roles.sample(R)
            q = row['messages'][0]['content'].lower()
            for p in prompts:
                # the exact probe text, or a probe with only the numbers changed
                bare = ''.join(ch for ch in p if not ch.isdigit())
                bare_row = ''.join(ch for ch in q if not ch.isdigit())
                if bare and bare == bare_row:
                    bad.append(p)
        self.assertEqual(bad[:5], [], f'an evaluation probe was reproduced: {bad[:5]}')


if __name__ == '__main__':
    unittest.main()
