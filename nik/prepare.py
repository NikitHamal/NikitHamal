"""Tokenize corpora into flat uint16 arrays for training.

pretrain:  data/pretrain.txt -> data/pre_train.bin, data/pre_val.bin
           documents joined as  <|bos|> doc <|eos|> ...
sft:       data/sft.jsonl    -> data/sft_tok.bin + data/sft_mask.bin (1 = learn this token)
           chat template (identical in web/nik.js):
             <|bos|><|user|>{q}<|end|><|nik|>[<|think|>{t}<|/think|>]{a}<|end|> ...
           only Nik's side (think + answer + <|end|>) is learned.

    python nik/prepare.py --data data --tok nik/web/model/tokenizer.json [--max-docs N]
"""
from __future__ import annotations
import argparse, json, os, sys
from multiprocessing import Pool
from pathlib import Path

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from tokenizer import Tokenizer  # noqa: E402

BOS, EOS, USER, NIK, THINK, ETHINK, END = 1, 2, 5, 6, 7, 8, 9
_tok: Tokenizer | None = None


def _init(path):
    global _tok
    _tok = Tokenizer.load(path)


def _enc_docs(lines):
    out = []
    for line in lines:
        line = line.strip()
        if line:
            out.append(BOS)
            out.extend(_tok.encode(line, allow_special=False))
            out.append(EOS)
    return np.array(out, dtype=np.uint16)


def render_chat(tok: Tokenizer, messages: list[dict]) -> tuple[list[int], list[int]]:
    ids, mask = [BOS], [0]
    for m in messages:
        if m['role'] == 'user':
            seg = [USER] + tok.encode(m['content'], allow_special=False) + [END]
            ids += seg; mask += [0] * len(seg)
        else:
            ids.append(NIK); mask.append(0)
            seg = []
            if m.get('think'):
                seg += [THINK] + tok.encode(m['think'], allow_special=False) + [ETHINK]
            seg += tok.encode(m['content'], allow_special=False) + [END]
            ids += seg; mask += [1] * len(seg)
    ids.append(EOS); mask.append(1)
    return ids, mask


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default='data')
    ap.add_argument('--tok', default='nik/web/model/tokenizer.json')
    ap.add_argument('--max-docs', type=int, default=0)
    ap.add_argument('--val-frac', type=float, default=0.005)
    ap.add_argument('--workers', type=int, default=os.cpu_count() or 2)
    ap.add_argument('--sft-only', action='store_true')
    a = ap.parse_args()

    tok = Tokenizer.load(a.tok)
    if a.sft_only:
        return prepare_sft(tok, a.data)
    with open(os.path.join(a.data, 'pretrain.txt')) as f:
        lines = f.readlines()
    if a.max_docs:
        lines = lines[: a.max_docs]
    n_val = max(1, int(len(lines) * a.val_frac))
    chunks = [lines[i:i + 2000] for i in range(n_val, len(lines), 2000)]
    with Pool(a.workers, initializer=_init, initargs=(a.tok,)) as p:
        parts = []
        for k, arr in enumerate(p.imap(_enc_docs, chunks)):
            parts.append(arr)
            if k % 20 == 0:
                print(f'pretrain chunk {k}/{len(chunks)}', flush=True)
    if not parts: raise ValueError('Need at least two non-empty pretraining documents')
    train = np.concatenate(parts)
    _init(a.tok)
    val = _enc_docs(lines[:n_val])
    train.tofile(os.path.join(a.data, 'pre_train.bin'))
    val.tofile(os.path.join(a.data, 'pre_val.bin'))
    chars = sum(len(x) for x in lines)
    print(f'pretrain: {len(train):,} train tokens, {len(val):,} val tokens, {chars / max(1, len(train) + len(val)):.2f} chars/token')

    prepare_sft(tok, a.data)


def prepare_sft(tok, data):
    for source, prefix in [('sft.jsonl', 'sft'), ('sft_val.jsonl', 'sft_val')]:
        path = Path(data) / source
        if not path.exists():
            if source == 'sft_val.jsonl':
                raise ValueError('Independent sft_val.jsonl is required; never evaluate on training rows')
            continue
        ids, mask = [], []
        for line in path.read_text().splitlines():
            i, m = render_chat(tok, json.loads(line)['messages'])
            ids += i; mask += m
        np.array(ids, dtype=np.uint16).tofile(Path(data) / (prefix + '_tok.bin'))
        np.array(mask, dtype=np.uint8).tofile(Path(data) / (prefix + '_mask.bin'))
        print(f'{prefix}: {len(ids):,} tokens, {sum(mask):,} supervised')


if __name__ == '__main__':
    main()
