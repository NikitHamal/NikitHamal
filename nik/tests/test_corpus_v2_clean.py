"""Tests for the corpus_v2 fetch/clean/romanize half (Local-C, issue #9).

    python -m unittest discover -s nik/tests -v
"""
import json
import os
import subprocess
import sys
import tempfile
import unittest

DATA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
CV2 = os.path.join(DATA, 'corpus_v2')
sys.path.insert(0, DATA)
sys.path.insert(0, CV2)
import clean as cv2clean  # noqa: E402


SENTS = [
    'नेपालमा आज भएको मौसम धेरै रमाइलो छ र सबै मानिसहरू बाहिर निस्केका छन्।',
    'काठमाडौंको सडकमा मानिसहरू हिँडिरहेका छन् र गाडी चलिरहेको छ।',
    'हिमालमा हिम पर्ने season सुरु भइसकेको छ भन्ने खबर छ।',
    'बजारमा आज दाम सामान्य भन्दा अलि बढी भएको जानकारी छ।',
    'विद्यालयमा आज नयाँ विद्यार्थीहरू भर्ना भएको छ भन्ने कुरा छ।',
    'पुस्तकालयमा अध्ययन गर्ने students को संख्या बढेको छ।',
    'सुबहै देखि नै बजारमा भीडभाड्ड बढेको थियो भन्ने गुनासो छ।',
    'पहाडी बाटोमा हावा चलेर अपन अनुभव सुनाउने मानिसहरू भेटिए।',
]


def nepali(n=1):
    """n distinct Devanagari sentences (distinct so the repetition rule does not fire)"""
    return ' '.join((SENTS * 4)[:n])


class TestClean(unittest.TestCase):
    def setUp(self):
        self.c = cv2clean.Cleaner()

    def test_normal_doc_survives(self):
        chunks, reason, reasons, scrubs = self.c.clean_doc(nepali(2))
        self.assertIsNone(reason)
        self.assertTrue(chunks)
        self.assertEqual(scrubs['url'], 0)

    def test_empty(self):
        chunks, reason, _, _ = self.c.clean_doc('   \n  ')
        self.assertEqual(reason, 'empty')
        self.assertEqual(chunks, [])

    def test_too_short(self):
        _, reason, _, _ = self.c.clean_doc('नेपाल।')
        self.assertEqual(reason, 'too_short')

    def test_boilerplate(self):
        _, reason, _, _ = self.c.clean_doc('\n'.join(['Log in', 'Subscribe', 'Privacy policy'] * 10))
        self.assertEqual(reason, 'boilerplate')

    def test_empty_after_boilerplate(self):
        # one boilerplate line out of three: under the boilerplate ratio, but nothing
        # is left once it is removed
        _, reason, _, _ = self.c.clean_doc('Log in\n\n')
        self.assertEqual(reason, 'empty_after_boilerplate')

    def test_repeated_lines(self):
        line = 'भेली भेली भेली भेली भेली भेली भेली भेली भेली भेली भेली भेली भेली भेली भेली भेली भेली भेली'
        _, reason, _, _ = self.c.clean_doc('\n'.join([line] * 4))
        self.assertEqual(reason, 'repeated_lines')

    def test_mixed_script_is_rejected(self):
        _, reason, _, _ = self.c.clean_doc('This is an English sentence about nothing at all, '
                                           'with no Nepali words in it whatsoever today.')
        self.assertEqual(reason, 'mixed_script')

    def test_profanity_is_scrubbed_not_rejected(self):
        """one rude word does not disqualify an article; the word goes, the article stays"""
        chunks, reason, _, scrubs = self.c.clean_doc(nepali(2) + ' shit ' + nepali(2))
        self.assertIsNone(reason)
        self.assertTrue(chunks)
        self.assertGreater(scrubs['profanity'], 0)
        self.assertNotIn('shit', ' '.join(chunks))

    def test_profanity_matches_whole_words_only(self):
        """the substring version matched 'population by sex', 'Dikshit' and 'फोहोरा'"""
        for text in ('population by sex and age ' * 6, 'Dikshit and Schwartzberg wrote ' * 6,
                     'बाहिर निस्केको पानी धारा, फोहोरा आदि नामले ' * 6):
            _, reason, _, _ = self.c.clean_doc(text)
            self.assertNotEqual(reason, 'mixed_script')
            self.assertNotIn('profanity', reason or '')

    def test_english_is_rejected_but_romanized_nepali_is_not(self):
        _, reason, _, _ = self.c.clean_doc('This is an English sentence about the weather '
                                           'and the people in the city of London today.')
        self.assertEqual(reason, 'mixed_script')
        _, reason, _, _ = self.c.clean_doc('nepal ko rajdhani kathmandu ho ani timi yaha aau '
                                           'bhanera bhayo ma yesto bhanne thiye.')
        self.assertIsNone(reason)

    def test_wikitext_is_stripped(self):
        """the raw ne.wikipedia dump is wikitext: templates, tables, refs, links"""
        text = ("{{Infobox country|jmpl=1}}\n{| class=\"wikitable\"\n|-\n! नाम\n| नेपाल\n|}\n"
                "नेपाल [[दक्षिण एसियामा|दक्षिण एसियाको]] एक देश हो र यहाँ धेरै मानिसहरू बस्छन्।"
                "<ref>citation here</ref>\n"
                "'''महत्वपूर्ण''' पनि हो किनभने यो देशको इतिहास धेरै पुरानो छ।\n")
        chunks, reason, reasons, _ = self.c.clean_doc(text)
        self.assertIsNone(reason)
        self.assertIn('markup_stripped', reasons)
        joined = ' '.join(chunks)
        self.assertNotIn('{{', joined)
        self.assertNotIn('[[', joined)
        self.assertNotIn('<ref', joined)
        self.assertIn('नेपाल', joined)

    def test_mostly_markup_is_rejected(self):
        text = '{{Infobox|country=Nepal}}\n{{Infobox|country=Nepal}}\n{{short description|x=y}}\n'
        _, reason, _, _ = self.c.clean_doc(text)
        self.assertEqual(reason, 'mostly_markup')

    def test_pii_is_scrubbed_not_rejected(self):
        text = nepali(2) + ' samay: 9801234567 email: ram@例.com http://example.com/x '
        chunks, reason, _, scrubs = self.c.clean_doc(text)
        self.assertIsNone(reason)
        self.assertTrue(chunks)
        self.assertGreater(scrubs['phone'], 0)
        self.assertGreater(scrubs['url'], 0)
        self.assertNotIn('9801234567', chunks[0])

    def test_long_doc_is_chunked_not_rejected(self):
        varied = ' '.join(f'{s} सङ्ख्या {i}।' for i, s in enumerate(SENTS * 5))
        chunks, reason, _, _ = self.c.clean_doc(varied)
        self.assertIsNone(reason)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(len(ch) <= 1200 for ch in chunks))


class TestRomanizeGate(unittest.TestCase):
    def _run(self, docs, extra=()):
        d = tempfile.mkdtemp()
        inp = os.path.join(d, 'in.jsonl')
        out = os.path.join(d, 'out.jsonl')
        rep = os.path.join(d, 'rep.json')
        with open(inp, 'w', encoding='utf8') as f:
            for i, t in enumerate(docs):
                f.write(json.dumps({'source': 's', 'doc_id': f'd{i}', 'text': t}, ensure_ascii=False) + '\n')
        cmd = [sys.executable, os.path.join(CV2, 'romanize.py'), '--in', inp, '--out', out,
               '--report', rep] + list(extra)
        r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf8')
        self.assertEqual(r.returncode, 0, r.stderr)
        return json.load(open(rep, encoding='utf8')), [json.loads(l) for l in open(out, encoding='utf8')]

    def test_normal_doc_passes_the_gate(self):
        rep, kept = self._run([nepali(2)])
        self.assertEqual(rep['docs_out'], 1)
        self.assertEqual(len(kept), 1)
        self.assertEqual(rep['rejects'], {})

    def test_exotic_devanagari_is_rejected_and_reported(self):
        bad = 'नेपाल ॐ ज्ञान ॰ यन्त्र ॐ तीर्थ ॰ ' + nepali(2)
        rep, kept = self._run([bad, nepali(2)])
        self.assertEqual(len(kept), 1)
        self.assertGreaterEqual(rep['rejects'].get('romanize_leftover', 0), 1)
        self.assertTrue(rep['top_leftover_words'])

    def test_max_leftover_is_a_hard_gate(self):
        rep, kept = self._run([nepali(2)], extra=('--max-leftover', '0.0'))
        self.assertEqual(len(kept), 1)   # a rate of exactly 0.0 is not above the gate
        bad = 'नेपाल ॐ ज्ञान ॰ यन्त्र ॐ तीर्थ ॰ ' + nepali(2)
        rep, kept = self._run([bad], extra=('--max-leftover', '0.0'))
        self.assertEqual(len(kept), 0)
        self.assertEqual(rep['rejects'].get('romanize_leftover'), 1)


if __name__ == '__main__':
    unittest.main()
