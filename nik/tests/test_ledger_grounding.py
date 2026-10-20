"""Tests for the ledger grounding re-check (Local-C, issue #9)."""
import json
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SCRIPT = os.path.join(REPO, 'scripts', 'ledger_grounding_check.py')
sys.path.insert(0, os.path.join(REPO, 'nik', 'data', 'teacher'))


class TestLedgerGrounding(unittest.TestCase):
    def test_generated_ledger_rows_are_grounded(self):
        """every value the ledger teaches the model to bind must appear in the user turn"""
        import ledger
        import random
        R = random.Random(5)
        rows = [ledger.sample(R) for _ in range(150)]
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'l.jsonl')
            with open(p, 'w', encoding='utf8') as f:
                for r in rows:
                    f.write(json.dumps(r, ensure_ascii=False) + '\n')
            out = subprocess.run([sys.executable, SCRIPT, '--jsonl', p],
                                 capture_output=True, text=True).stdout
        self.assertIn('values checked', out)
        self.assertIn('0.00%', out)
        self.assertIn('OK: every taught binding appears', out)

    def test_reports_an_ungrounded_value(self):
        """a corrupted row (a value that is not in the user turn) must be reported"""
        import ledger
        import random
        R = random.Random(6)
        row = ledger.sample(R)
        think = row['messages'][-1].get('think', '')
        row['messages'][-1]['think'] = think.replace('[items0=', '[items0=999999', 1)
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'l.jsonl')
            with open(p, 'w', encoding='utf8') as f:
                f.write(json.dumps(row, ensure_ascii=False) + '\n')
            out = subprocess.run([sys.executable, SCRIPT, '--jsonl', p],
                                 capture_output=True, text=True).stdout
        self.assertNotIn('OK: every taught binding appears', out)
        self.assertIn('ungrounded', out)


if __name__ == '__main__':
    unittest.main()
