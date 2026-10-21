"""nik/agents/vault.py - share molab box URLs + tokens with the agents, without ever publishing them.

The repo is public, so secrets never go into it in plain text. Instead:

1. Each agent makes a keypair ON ITS OWN MACHINE and posts only the public line in issue #8:
       python nik/agents/vault.py keygen --name Local-A
   The private key stays in ~/.nik-vault/<name>.key (mode 600). Never post, commit or log it.
2. The owner approves the key (a `DECISION`/`OWNER` message naming the agent and the key's fingerprint).
   Only then does the sealer add it to nik/agents/vault/recipients.json.
3. The sealer (whoever drives the boxes, today Claude) encrypts the box list to every approved key and
   commits only the ciphertext, nik/agents/vault/boxes.vault.json:
       python nik/agents/vault.py seal --name Claude --in ~/.nik-vault/boxes.json
   boxes.json (plain, outside the repo): {"boxes": [{"name": "box 2", "url": "...", "token": "...", "note": "..."}]}
4. Any approved agent reads it locally:
       python nik/agents/vault.py open --name Local-A            # prints the boxes to the terminal only
   `open` refuses a vault that is not signed by a sealer listed in recipients.json.

Crypto: X25519 key agreement per recipient (ephemeral key) + HKDF-SHA256 wraps a random 32-byte file key;
the box list is sealed with ChaCha20-Poly1305 under that key; the sealer signs the whole vault with Ed25519.
Needs `pip install cryptography`. Boxes die within hours, so a leaked token has a short life, but treat the
decrypted output like a password: do not paste it into issues, logs, notebooks or commits.
"""
from __future__ import annotations

import argparse
import base64
import datetime
import hashlib
import json
import os
import sys

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

HERE = os.path.dirname(os.path.abspath(__file__))
VAULT_DIR = os.path.join(HERE, 'vault')
RECIPIENTS = os.path.join(VAULT_DIR, 'recipients.json')
VAULT = os.path.join(VAULT_DIR, 'boxes.vault.json')
KEY_DIR = os.path.expanduser(os.environ.get('NIK_VAULT_HOME', '~/.nik-vault'))
RAW = serialization.Encoding.Raw
b64 = lambda b: base64.b64encode(b).decode()
unb64 = base64.b64decode


def fingerprint(pub_line: str) -> str:
    return hashlib.sha256(pub_line.encode()).hexdigest()[:16]


def _key_path(name):
    return os.path.join(KEY_DIR, f'{name}.key')


def keygen(name, force=False):
    """private key file = 32-byte X25519 secret + 32-byte Ed25519 seed (base64); returns the public line"""
    os.makedirs(KEY_DIR, mode=0o700, exist_ok=True)
    p = _key_path(name)
    if os.path.exists(p) and not force:
        sys.exit(f'{p} exists (use --force to replace it; the old public key then stops working)')
    x, e = X25519PrivateKey.generate(), Ed25519PrivateKey.generate()
    raw = x.private_bytes(RAW, serialization.PrivateFormat.Raw, serialization.NoEncryption()) + \
        e.private_bytes(RAW, serialization.PrivateFormat.Raw, serialization.NoEncryption())
    fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as f:
        f.write(b64(raw))
    return public_line(name)


def _load(name):
    raw = unb64(open(_key_path(name)).read().strip())
    return X25519PrivateKey.from_private_bytes(raw[:32]), Ed25519PrivateKey.from_private_bytes(raw[32:])


def public_line(name):
    x, e = _load(name)
    xp = x.public_key().public_bytes(RAW, serialization.PublicFormat.Raw)
    ep = e.public_key().public_bytes(RAW, serialization.PublicFormat.Raw)
    return f'nik-vault-pub:{name}:{b64(xp)}:{b64(ep)}'


def parse_public(line):
    tag, name, xp, ep = line.strip().split(':')
    assert tag == 'nik-vault-pub', 'not a nik-vault public key line'
    return name, X25519PublicKey.from_public_bytes(unb64(xp)), Ed25519PublicKey.from_public_bytes(unb64(ep))


def _wrap_key(recipient_x: X25519PublicKey, file_key: bytes, info: bytes):
    eph = X25519PrivateKey.generate()
    shared = eph.exchange(recipient_x)
    kek = HKDF(hashes.SHA256(), 32, None, info).derive(shared)
    nonce = os.urandom(12)
    return {'eph': b64(eph.public_key().public_bytes(RAW, serialization.PublicFormat.Raw)), 'nonce': b64(nonce),
            'key': b64(ChaCha20Poly1305(kek).encrypt(nonce, file_key, info))}


def _unwrap_key(x: X25519PrivateKey, w, info: bytes):
    shared = x.exchange(X25519PublicKey.from_public_bytes(unb64(w['eph'])))
    kek = HKDF(hashes.SHA256(), 32, None, info).derive(shared)
    return ChaCha20Poly1305(kek).decrypt(unb64(w['nonce']), unb64(w['key']), info)


def _signed_part(v):
    return json.dumps({k: v[k] for k in ('v', 'sealer', 'created', 'recipients', 'nonce', 'data')}, sort_keys=True).encode()


def seal(sealer, plain: dict, recipients: dict):
    """recipients: {name: public line}. Returns the vault dict (ciphertext only)."""
    _, sign_key = _load(sealer)
    if sealer not in recipients:
        sys.exit(f'sealer {sealer} must itself be in recipients.json')
    file_key, nonce = ChaCha20Poly1305.generate_key(), os.urandom(12)
    created = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    aad = f'nik-vault-v1|{sealer}|{created}'.encode()
    wrapped = {}
    for name, line in sorted(recipients.items()):
        n, xpub, _ = parse_public(line)
        assert n == name, f'recipients.json key {name} holds a public line for {n}'
        wrapped[name] = _wrap_key(xpub, file_key, aad + b'|' + name.encode())
    v = {'v': 1, 'sealer': sealer, 'created': created, 'recipients': wrapped, 'nonce': b64(nonce),
         'data': b64(ChaCha20Poly1305(file_key).encrypt(nonce, json.dumps(plain).encode(), aad))}
    v['sig'] = b64(sign_key.sign(_signed_part(v)))
    return v


def open_vault(name, v: dict, recipients: dict, sealers):
    sealer = v['sealer']
    if sealer not in sealers or sealer not in recipients:
        raise ValueError(f'vault sealed by {sealer!r}, who is not an approved sealer')
    _, _, spub = parse_public(recipients[sealer])
    spub.verify(unb64(v['sig']), _signed_part(v))          # raises InvalidSignature on a forged/edited vault
    if name not in v['recipients']:
        raise ValueError(f'{name} is not a recipient of this vault (ask for your key to be approved)')
    x, _ = _load(name)
    aad = f'nik-vault-v1|{sealer}|{v["created"]}'.encode()
    file_key = _unwrap_key(x, v['recipients'][name], aad + b'|' + name.encode())
    return json.loads(ChaCha20Poly1305(file_key).decrypt(unb64(v['nonce']), unb64(v['data']), aad))


def _read_recipients():
    r = json.load(open(RECIPIENTS))
    return r['keys'], r.get('sealers', [])


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    k = sub.add_parser('keygen'); k.add_argument('--name', required=True); k.add_argument('--force', action='store_true')
    p = sub.add_parser('pub'); p.add_argument('--name', required=True)
    s = sub.add_parser('seal'); s.add_argument('--name', required=True); s.add_argument('--in', dest='inp', required=True)
    o = sub.add_parser('open'); o.add_argument('--name', required=True)
    a = ap.parse_args()
    if a.cmd == 'keygen':
        line = keygen(a.name, a.force)
        print(f'private key: {_key_path(a.name)} (keep it there; never post it)\npost this line in issue #8:\n{line}\nfingerprint: {fingerprint(line)}')
    elif a.cmd == 'pub':
        line = public_line(a.name); print(line); print('fingerprint:', fingerprint(line))
    elif a.cmd == 'seal':
        keys, sealers = _read_recipients()
        if a.name not in sealers:
            sys.exit(f'{a.name} is not listed as a sealer in recipients.json')
        v = seal(a.name, json.load(open(os.path.expanduser(a.inp))), keys)
        with open(VAULT, 'w') as f:
            json.dump(v, f, indent=1)
        print(f'sealed for {", ".join(sorted(keys))} -> {os.path.relpath(VAULT)}')
    elif a.cmd == 'open':
        keys, sealers = _read_recipients()
        data = open_vault(a.name, json.load(open(VAULT)), keys, sealers)
        print(f'(sealed by {json.load(open(VAULT))["sealer"]} at {json.load(open(VAULT))["created"]}; do not paste this anywhere)')
        for b in data.get('boxes', []):
            print(f"{b.get('name')}: {b.get('url')}  token {b.get('token')}  {b.get('note', '')}")


if __name__ == '__main__':
    main()
