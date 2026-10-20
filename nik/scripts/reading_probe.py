"""Screen fresh generated lookup questions on CPU; never add them to training.

python nik/scripts/reading_probe.py --n 24 --seed 9381 --out lookup.json
The token-boundary score is necessary, not sufficient for a meaningful answer.
"""
import argparse
import hashlib
import json
from pathlib import Path
import random
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'nik'), str(ROOT / 'nik/data/teacher')]
import torch
import read
from eval_understand import load_any
from model import generate_ar
from prepare import render_chat
from tokenizer import Tokenizer


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--n', type=int, default=24)
    ap.add_argument('--seed', type=int, default=9381)
    ap.add_argument('--model', default=str(ROOT / 'nik/web/model/nik-0.1.bin'))
    ap.add_argument('--threads', type=int, default=2)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    torch.set_num_threads(a.threads)
    torch.set_grad_enabled(False)
    tok = Tokenizer.load(str(ROOT / 'nik/web/model/tokenizer.json'))
    model = load_any(a.model).cpu().eval()
    rng, rows = random.Random(a.seed), []
    for i in range(a.n):
        example = read.lookup(rng)
        ids, _ = render_chat(tok, example['messages'][:1])
        raw = tok.decode(generate_ar(model, ids[:-1] + [6], 160, temperature=0))
        answer = re.sub(r'<\|think\|>.*?(<\|/think\|>|$)', '', raw, flags=re.S).replace('<|end|>', '').strip()
        ok = bool(re.search(r'(?<!\w)' + re.escape(example['gold']) + r'(?!\w)', answer.lower()))
        rows.append(dict(example=example, raw=raw, answer=answer, ok=ok))
        print(i, ok, answer, flush=True)
        report = dict(seed=a.seed, score=sum(r['ok'] for r in rows), of=len(rows),
                      model_sha256=hashlib.sha256(Path(a.model).read_bytes()).hexdigest(), rows=rows)
        Path(a.out).write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
