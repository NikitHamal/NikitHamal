"""Exact + near-duplicate detection for corpus v2.

Exact: BLAKE2b-128 of the NFC/lowercase/whitespace-normalised text.
Near: 64-bit SimHash over 3-word shingles, LSH into 4 x 16-bit bands, drop when
the Hamming distance to a bucket member is <= `near_threshold`.
SimHash is used instead of a 64-permutation MinHash because it is one pass per
document; the audit report records the method and the sampled coverage.
"""
from __future__ import annotations

import hashlib
import re
import unicodedata
import zlib
from collections import defaultdict

WORD_RE = re.compile(r'[a-z0-9]+')


def normalize(text):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', text or '').lower()).strip()


def tokens(text):
    return WORD_RE.findall(normalize(text))


def exact_key(text):
    return hashlib.blake2b(normalize(text).encode('utf-8'), digest_size=16).hexdigest()


def _hash64(s):
    b = s.encode('utf-8')
    lo = zlib.crc32(b) & 0xFFFFFFFF
    hi = zlib.crc32(b, 0x9E3779B9) & 0xFFFFFFFF
    return (hi << 32) | lo


def shingles(text, n=3, max_shingles=4096):
    ts = tokens(text)
    if not ts:
        return []
    if len(ts) < n:
        return [_hash64(' '.join(ts))]
    total = len(ts) - n + 1
    step = max(1, total // max_shingles)
    return [_hash64(' '.join(ts[i:i + n])) for i in range(0, total, step)]


def simhash(text, n=3, max_shingles=4096):
    hs = shingles(text, n, max_shingles)
    if not hs:
        return 0
    counts = [0] * 64
    for h in hs:
        for b in range(64):
            counts[b] += 1 if (h >> b) & 1 else -1
    sig = 0
    for b in range(64):
        if counts[b] > 0:
            sig |= 1 << b
    return sig


def hamming(a, b):
    return (a ^ b).bit_count()


class Deduper:
    """Streaming deduper. The first occurrence of a document wins."""

    def __init__(self, near_threshold=3, bands=4, rows=16, bucket_cap=64, near_min_tokens=8):
        self.near_threshold = near_threshold
        self.bands = bands
        self.rows = rows
        self.bucket_cap = bucket_cap
        self.near_min_tokens = near_min_tokens
        self.exact = {}
        self.buckets = defaultdict(list)
        self.items = []

    def _bands(self, sig):
        mask = (1 << self.rows) - 1
        return [((sig >> (i * self.rows)) & mask, i) for i in range(self.bands)]

    def add(self, text, meta=None):
        """Returns (kind, kept_index); kind is None for a new document."""
        key = exact_key(text)
        if key in self.exact:
            return 'exact', self.exact[key]
        sig = None
        if len(tokens(text)) >= self.near_min_tokens:
            sig = simhash(text)
            for value, band in self._bands(sig):
                for idx, other in self.buckets[(band, value)][-self.bucket_cap:]:
                    if hamming(sig, other) <= self.near_threshold:
                        self.exact[key] = idx
                        return 'near', idx
        idx = len(self.items)
        self.items.append({'key': key, 'sig': sig, 'meta': meta or {}})
        self.exact[key] = idx
        if sig is not None:
            for value, band in self._bands(sig):
                self.buckets[(band, value)].append((idx, sig))
        return None, idx

    def stats(self):
        near = sum(1 for item in self.items if item['sig'] is not None)
        return {'kept': len(self.items), 'exact_keys': len(self.exact), 'near_signatures': near,
                'buckets': len(self.buckets), 'method': f'simhash64 3-gram, {self.bands}x{self.rows}-bit LSH, hamming<={self.near_threshold}'}
