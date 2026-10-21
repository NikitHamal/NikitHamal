import os, random, re, sys, unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'decide'))
import reading_wide as rw  # noqa: E402


class ReadingWide(unittest.TestCase):
    def test_bench_reading_vocabulary_is_held_out(self):
        self.assertTrue(rw.HELD, 'bench_reading.py not found')
        vocab = set(w for v in rw.NAMES + rw.OBJECTS + rw.FOODS + rw.PLACES + rw.JOBS for w in v.split())
        self.assertFalse(vocab & rw.HELD - {'le', 'ko', 'ma', 'ra', 'lai'})

    def test_rows_are_well_formed_and_gold_is_in_the_passage_or_computed(self):
        R = random.Random(3)
        for _ in range(3000):
            r = rw.sample(R)
            self.assertLess(r['label'], len(r['options']))
            self.assertEqual(len(r['options']), len(set(r['options'])))
            self.assertGreaterEqual(len(r['options']), 2)
            gold = r['options'][r['label']]
            if r['task'] in ('rw-giver', 'rw-receiver', 'rw-owner', 'rw-doer', 'rw-first', 'rw-last', 'rw-rel-name'):
                self.assertIn(gold, r['context'])


if __name__ == '__main__':
    unittest.main()
