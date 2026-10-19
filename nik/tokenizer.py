"""Nik byte-level BPE tokenizer, written from scratch (no dependencies).

Design for a ~8M-parameter romanized-Nepali model:
  * 4096-token vocabulary: 16 specials, 256 raw bytes (so nothing is ever
    out-of-vocabulary), and 3824 merges learned on romanized Nepali.
  * Digits are always single tokens (" 4", "2"): arithmetic reasoning works on
    digits, and the model never has to memorise "1987" as one symbol.
  * The exact same algorithm is implemented in web/nik.js; tokenizer.json is the
    single source of truth for both.

    python nik/tokenizer.py train --input data/pretrain.txt --sft data/sft.jsonl --out nik/web/model/tokenizer.json
"""
from __future__ import annotations
import argparse, collections, json, re

SPECIALS = ['<|pad|>', '<|bos|>', '<|eos|>', '<|mask|>', '<|sys|>', '<|user|>', '<|nik|>',
            '<|think|>', '<|/think|>', '<|end|>', '<|r1|>', '<|r2|>', '<|r3|>', '<|r4|>', '<|r5|>', '<|r6|>']
N_SPECIAL = len(SPECIALS)
BYTE0 = N_SPECIAL                      # id of byte 0
PAT = re.compile(r" ?[a-z]+| ?[0-9]| ?[^\sa-z0-9]+|\s+(?!\S)|\s+")
SPECIAL_RE = re.compile('(' + '|'.join(re.escape(s) for s in SPECIALS) + ')')


class Tokenizer:
    def __init__(self, merges: list[tuple[int, int]]):
        self.merges = [tuple(m) for m in merges]
        self.rank = {m: i for i, m in enumerate(self.merges)}
        self.vocab: list[bytes] = [s.encode() for s in SPECIALS] + [bytes([b]) for b in range(256)]
        for a, b in self.merges:
            self.vocab.append(self.vocab[a] + self.vocab[b])
        self.special = {s: i for i, s in enumerate(SPECIALS)}
        self.cache: dict[str, list[int]] = {}

    # ----- encoding -------------------------------------------------------
    def _bpe(self, piece: str) -> list[int]:
        ids = self.cache.get(piece)
        if ids is not None:
            return ids
        ids = [BYTE0 + b for b in piece.encode('utf-8')]
        while len(ids) > 1:
            best, bi = None, -1
            for i in range(len(ids) - 1):
                r = self.rank.get((ids[i], ids[i + 1]))
                if r is not None and (best is None or r < best):
                    best, bi = r, i
            if best is None:
                break
            ids[bi:bi + 2] = [N_SPECIAL + 256 + best]
        if len(self.cache) < 500_000:
            self.cache[piece] = ids
        return ids

    def encode(self, text: str, allow_special: bool = True) -> list[int]:
        out: list[int] = []
        parts = SPECIAL_RE.split(text) if allow_special else [text]
        for part in parts:
            if not part:
                continue
            if allow_special and part in self.special:
                out.append(self.special[part])
                continue
            for m in PAT.findall(part):
                out.extend(self._bpe(m))
        return out

    def decode(self, ids: list[int], skip_special: bool = False) -> str:
        bs = b''.join(self.vocab[i] for i in ids if not (skip_special and i < N_SPECIAL))
        return bs.decode('utf-8', errors='replace')

    @property
    def vocab_size(self) -> int:
        return len(self.vocab)

    # ----- io ---------------------------------------------------------------
    def save(self, path: str):
        with open(path, 'w') as f:
            json.dump({'version': 1, 'pattern': PAT.pattern, 'specials': SPECIALS,
                       'byte0': BYTE0, 'merges': self.merges}, f, separators=(',', ':'))

    @classmethod
    def load(cls, path: str) -> 'Tokenizer':
        with open(path) as f:
            d = json.load(f)
        assert d['specials'] == SPECIALS, 'special token table changed'
        return cls(d['merges'])


def train(texts, vocab_size: int = 4096, min_freq: int = 2, verbose: bool = True) -> Tokenizer:
    """Classic BPE over word types with incremental pair-count updates."""
    words = collections.Counter()
    for t in texts:
        words.update(PAT.findall(t))
    seqs = [[BYTE0 + b for b in w.encode()] for w in words]
    freqs = list(words.values())
    pairs = collections.Counter()
    where = collections.defaultdict(set)
    for wi, s in enumerate(seqs):
        f = freqs[wi]
        for i in range(len(s) - 1):
            p = (s[i], s[i + 1])
            pairs[p] += f
            where[p].add(wi)
    merges = []
    n_merges = vocab_size - N_SPECIAL - 256
    for k in range(n_merges):
        if not pairs:
            break
        best, cnt = max(pairs.items(), key=lambda kv: (kv[1], -kv[0][0], -kv[0][1]))
        if cnt < min_freq:
            break
        new = N_SPECIAL + 256 + len(merges)
        merges.append(best)
        for wi in list(where[best]):
            s, f = seqs[wi], freqs[wi]
            # remove old pair counts of this word
            for i in range(len(s) - 1):
                p = (s[i], s[i + 1])
                pairs[p] -= f
                if pairs[p] <= 0:
                    del pairs[p]
                where[p].discard(wi)
            i, out = 0, []
            while i < len(s):
                if i < len(s) - 1 and s[i] == best[0] and s[i + 1] == best[1]:
                    out.append(new); i += 2
                else:
                    out.append(s[i]); i += 1
            seqs[wi] = out
            for i in range(len(out) - 1):
                p = (out[i], out[i + 1])
                pairs[p] += f
                where[p].add(wi)
        where.pop(best, None)
        if verbose and k % 500 == 0:
            tok = Tokenizer(merges)
            print(f'merge {k}/{n_merges}: {tok.vocab[new]!r} x{cnt}', flush=True)
    return Tokenizer(merges)


def _iter_training_text(path: str, sft: str | None, limit_chars: int):
    n = 0
    with open(path) as f:
        for line in f:
            yield line
            n += len(line)
            if n > limit_chars:
                break
    if sft:
        with open(sft) as f:
            for line in f:
                d = json.loads(line)
                for m in d['messages']:
                    yield m['content']


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    t = sub.add_parser('train')
    t.add_argument('--input', required=True)
    t.add_argument('--sft', default=None)
    t.add_argument('--out', required=True)
    t.add_argument('--vocab', type=int, default=4096)
    t.add_argument('--chars', type=int, default=40_000_000)
    e = sub.add_parser('encode')
    e.add_argument('--tok', required=True)
    e.add_argument('text')
    a = ap.parse_args()
    if a.cmd == 'train':
        # Digits never merge: drop them from the merge vocabulary by training on
        # text where every digit is isolated by the pre-tokenizer pattern.
        tok = train(_iter_training_text(a.input, a.sft, a.chars), a.vocab)
        tok.save(a.out)
        print('saved', a.out, 'vocab', tok.vocab_size)
    else:
        tok = Tokenizer.load(a.tok)
        ids = tok.encode(a.text)
        print(ids)
        print([tok.decode([i]) for i in ids])
