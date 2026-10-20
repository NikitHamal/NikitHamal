import random
import sys
import unittest
from pathlib import Path
sys.path[:0] = [str(Path(__file__).resolve().parents[1]), str(Path(__file__).resolve().parents[1] / 'data/teacher')]
import read
from grounding import check
from read_scoring import matches

class ReadingChecks(unittest.TestCase):
    def test_unstated_gold_and_assistant_echo(self):
        row = dict(kind='read-memory', gold='sombar', messages=[
            dict(role='user', content='bihana 8 baje dipak gym gayo.'),
            dict(role='nik', content='sombar.'),
            dict(role='user', content='kun bar?'), dict(role='nik', content='sombar.')])
        self.assertTrue(check(row))
    def test_pipeline_rejects_unstated_day(self):
        from audit import check as pipeline_check
        row = dict(cat='read-lookup', gold='sombar', messages=[
            dict(role='user', content='dipak gym gayo. kun bar?'),
            dict(role='nik', content='sombar ho.', think='passage ma: "dipak gym gayo".')])
        self.assertTrue(any(e.startswith('grounding:') for e in pipeline_check(row)))
    def test_bad_quote(self):
        row=read.compare(random.Random(3))
        row['messages'][-1]['think'] += ' "this was not stated"'
        self.assertTrue(check(row))
    def test_fixed_generation(self):
        rng=random.Random(821)
        for _ in range(10000):
            row=read.sample(rng)
            self.assertEqual(check(row), [], row)
    def test_unknown_does_not_hide_a_stated_job(self):
        row = dict(kind='read-unknown', gold='chhaina', messages=[
            dict(role='user', content='bimal doctor ho. bimal k kaam garchha?'),
            dict(role='nik', content='thaha chhaina.', think='passage ma bimal ko kaam khojchhu. kunai vakya ma chhaina.')])
        self.assertTrue(check(row))
    def test_numeric_scoring(self):
        self.assertTrue(matches('jamma 2 dhara chhan.', ['2']))
        self.assertTrue(matches('3 ota kapi.', ['3']))
        for answer in ['2 ra 3/3 = 2/3', '12', '2.5', '1/2', '-2', '2 ki 3']:
            self.assertFalse(matches(answer, ['2']), answer)
        self.assertFalse(matches('pilotage', ['pilot']))
        self.assertTrue(matches('haina, man pardaina.', ['haina|pardaina']))

if __name__ == '__main__': unittest.main()
