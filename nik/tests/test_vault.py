"""nik/agents/vault.py: only approved recipients can read the box list; edits and forged sealers are rejected.
CPU only, temp key dir. Skipped when `cryptography` is not installed."""
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'agents'))
try:
    import vault
except ImportError:  # pragma: no cover
    vault = None

BOXES = {'boxes': [{'name': 'box 2', 'url': 'https://example.invalid/', 'token': 'secret-token'}]}


@unittest.skipIf(vault is None, 'cryptography not installed')
class VaultTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        vault.KEY_DIR = self.tmp.name
        self.keys = {n: vault.keygen(n) for n in ('Claude', 'Local-A', 'Mallory')}
        self.rec = {n: self.keys[n] for n in ('Claude', 'Local-A')}

    def tearDown(self):
        self.tmp.cleanup()

    def test_recipient_reads_and_ciphertext_has_no_secret(self):
        v = vault.seal('Claude', BOXES, self.rec)
        self.assertNotIn('secret-token', str(v))
        self.assertEqual(vault.open_vault('Local-A', v, self.rec, ['Claude']), BOXES)

    def test_non_recipient_cannot_read(self):
        v = vault.seal('Claude', BOXES, self.rec)
        with self.assertRaises(ValueError):
            vault.open_vault('Mallory', v, self.rec, ['Claude'])

    def test_tampered_vault_is_rejected(self):
        v = vault.seal('Claude', BOXES, self.rec)
        v['data'] = v['data'][:-4] + ('AAAA' if not v['data'].endswith('AAAA') else 'BBBB')
        with self.assertRaises(Exception):
            vault.open_vault('Local-A', v, self.rec, ['Claude'])

    def test_unapproved_sealer_is_rejected(self):
        rec = dict(self.rec, Mallory=self.keys['Mallory'])
        v = vault.seal('Mallory', BOXES, rec)
        with self.assertRaises(ValueError):
            vault.open_vault('Local-A', v, rec, ['Claude'])

    def test_private_key_file_is_owner_only(self):
        mode = os.stat(os.path.join(self.tmp.name, 'Claude.key')).st_mode & 0o777
        self.assertEqual(mode, 0o600)


if __name__ == '__main__':
    unittest.main()
