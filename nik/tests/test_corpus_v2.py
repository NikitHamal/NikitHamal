"""Tests for the corpus v2 audit pipeline (no heavy eval imports)."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

NIK = Path(__file__).resolve().parents[1]
CORPUS = NIK / 'data' / 'corpus_v2'
sys.path[:0] = [str(NIK), str(CORPUS)]
import corpus_audit  # noqa: E402
import contamination  # noqa: E402
import dedup  # noqa: E402
import manifest  # noqa: E402

WORDS = ['kathmandu', 'pokhara', 'nepal', 'bazar', 'kitab', 'kalam', 'pani', 'kheti', 'himal', 'gaun']


def long_doc(seed=0, n=120):
    return ' '.join(WORDS[(i + seed) % len(WORDS)] + str(i) for i in range(n)) + '.'


class DedupTests(unittest.TestCase):
    def test_exact_after_normalization(self):
        d = dedup.Deduper()
        self.assertIsNone(d.add('Hello   World.') [0])
        self.assertEqual(d.add('hello world.')[0], 'exact')

    def test_near_dup_one_word(self):
        a = long_doc(0)
        b = a.replace('pokhara1', 'kalam9', 1)
        d = dedup.Deduper(near_threshold=8)
        self.assertIsNone(d.add(a)[0])
        kind, idx = d.add(b)
        self.assertEqual(kind, 'near')
        self.assertEqual(idx, 0)

    def test_short_docs_are_not_near_matched(self):
        d = dedup.Deduper(near_min_tokens=8)
        self.assertIsNone(d.add('short one')[0])
        self.assertIsNone(d.add('short two')[0])


class ContaminationTests(unittest.TestCase):
    def test_prompt_in_doc(self):
        prompt = 'euta kitab 250 rupiya ko chha. 4 wata kitab ko kati parchha?'
        idx = contamination.EvalIndex({'bench': [prompt]})
        hit = idx.check('yo kitab ko kura ho. ' + prompt)
        self.assertIsNotNone(hit)
        self.assertEqual(hit['set'], 'bench')
        self.assertIsNone(idx.check('kathmandu nepal ko rajdhani ho.'))

    def test_short_prompt(self):
        idx = contamination.EvalIndex({'stress': ['timi ko hau?']})
        self.assertIsNotNone(idx.check('malai tha chhaina, timi ko hau?'))
        self.assertIsNone(idx.check('namaste, sanchai chha?'))


class LicenceTests(unittest.TestCase):
    def test_verified_ok(self):
        errors, _ = manifest.validate({'sakonii_news'})
        self.assertEqual(errors, [])

    def test_tbd_fails(self):
        errors, _ = manifest.validate({'culturax_ne'})
        self.assertTrue(errors)

    def test_unknown_fails(self):
        errors, _ = manifest.validate({'not_a_source'})
        self.assertTrue(any('not in the licence registry' in e for e in errors))


class AuditTests(unittest.TestCase):
    def write(self, rows):
        fd, path = tempfile.mkstemp(suffix='.jsonl')
        os.close(fd)
        with open(path, 'w', encoding='utf-8') as handle:
            for row in rows:
                handle.write(json.dumps(row, ensure_ascii=False) + '\n')
        return path

    def test_clean_corpus_passes(self):
        rows = [{'source': 'sakonii_news', 'doc_id': i, 'text': long_doc(i)} for i in range(5)]
        idx = contamination.EvalIndex({'bench': ['a completely different eval prompt with enough words']})
        result = corpus_audit.run_audit(self.write(rows), eval_index=idx, min_tokens=0, sample_n=10)
        self.assertTrue(result['pass'], result['reasons'])
        self.assertEqual(result['kept'], 5)

    def test_bad_corpus_fails_all_gates(self):
        a = long_doc(0)
        prompt = 'euta kitab 250 rupiya ko chha. 4 wata kitab ko kati parchha?'
        dev = 'नेपालको राजधानी काठमाडौं हो। ' * 10
        rows = [
            {'source': 'sakonii_news', 'doc_id': 1, 'text': a},
            {'source': 'sakonii_news', 'doc_id': 2, 'text': a},
            {'source': 'wikipedia_ne', 'doc_id': 3, 'text': a.replace('pokhara1', 'kalam9', 1)},
            {'source': 'wikipedia_ne', 'doc_id': 4, 'text': prompt + ' ' + long_doc(2)},
            {'source': 'sakonii_news', 'doc_id': 5, 'text': dev},
            {'source': 'sakonii_news', 'doc_id': 6, 'text': 'x' * 20},
            {'source': 'mystery', 'doc_id': 7, 'text': long_doc(3)},
            {'source': 'culturax_ne', 'doc_id': 8, 'text': long_doc(4)},
        ]
        idx = contamination.EvalIndex({'bench': [prompt]})
        result = corpus_audit.run_audit(self.write(rows), eval_index=idx, min_tokens=0, sample_n=10)
        self.assertFalse(result['pass'])
        self.assertGreaterEqual(result['contaminated'], 1)
        self.assertGreaterEqual(result['sources']['sakonii_news']['exact_dup'], 1)
        self.assertGreaterEqual(result['sources']['wikipedia_ne']['near_dup'], 1)
        self.assertGreaterEqual(result['sources']['sakonii_news']['devanagari'], 1)
        self.assertGreaterEqual(result['sources']['sakonii_news']['short'], 1)
        self.assertGreaterEqual(result['sources']['mystery']['unknown_source'], 1)
        self.assertTrue(result['licence_errors'])

    def test_token_estimate(self):
        rows = [{'source': 'sakonii_news', 'doc_id': 1, 'text': 'a' * 400}]
        result = corpus_audit.run_audit(self.write(rows), eval_index=contamination.EvalIndex({}), min_tokens=0, sample_n=10)
        self.assertEqual(result['tokens_estimated'], 100)


if __name__ == '__main__':
    unittest.main()
