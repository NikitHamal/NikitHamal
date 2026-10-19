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
    ap.add_argument('--sft-name', default='sft', help='<name>.jsonl -> <name>_tok.bin / <name>_mask.bin')
    a = ap.parse_args()

    tok = Tokenizer.load(a.tok)
    if a.sft_only:
        return prepare_sft(tok, a.data, a.sft_name)
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
    train = np.concatenate(parts)
    _init(a.tok)
    val = _enc_docs(lines[:n_val])
    train.tofile(os.path.join(a.data, 'pre_train.bin'))
    val.tofile(os.path.join(a.data, 'pre_val.bin'))
    chars = sum(len(x) for x in lines)
    print(f'pretrain: {len(train):,} train tokens, {len(val):,} val tokens, {chars / max(1, len(train) + len(val)):.2f} chars/token')

    prepare_sft(tok, a.data, a.sft_name)


def prepare_sft(tok, data, name='sft'):
    sft = os.path.join(data, f'{name}.jsonl')
    if os.path.exists(sft):
        ids, mask = [], []
        with open(sft) as f:
            for line in f:
                i, m = render_chat(tok, json.loads(line)['messages'])
                ids += i; mask += m
        np.array(ids, dtype=np.uint16).tofile(os.path.join(data, f'{name}_tok.bin'))
        np.array(mask, dtype=np.uint8).tofile(os.path.join(data, f'{name}_mask.bin'))
        print(f'{name}: {len(ids):,} tokens, {sum(mask):,} supervised')


if __name__ == '__main__':
    main()
