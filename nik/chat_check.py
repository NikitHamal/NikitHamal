"""Chat sanity gate: everyday messages must get a plain reply (no <|think|> scratchpad), no loops, not empty.
A model that answers "namaste" with a math scratchpad must never ship, whatever its benchmark score.

    python nik/chat_check.py --model out/nik-0.1.v4.bin      # exit 1 if more than --max-fail messages fail
"""
import argparse, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import torch  # noqa: E402
from eval_understand import load_any  # noqa: E402
from model import generate_ar  # noqa: E402
from prepare import render_chat  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402

MSGS = ['namaste! k chha?', 'hi nik', 'sanchai hunuhunchha?', 'aaja ma ekdam thakeko chhu.', 'dhanyabad hai', 'bye, pachhi kura garaula',
        'malai momo dherai man parchha', 'aaja pani paryo', 'hijo ma ilam gaeko thiye', 'euta joke sunau na', 'timi ko hau?',
        'ma dukhi chhu aaja', 'good morning', 'k gardai chhau?', 'subha ratri']


def looped(t):
    w = t.split()
    if len(w) < 12:
        return False
    grams = [' '.join(w[i:i + 3]) for i in range(len(w) - 2)]
    return max(grams.count(g) for g in set(grams)) >= 4


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--max-fail', type=int, default=4)   # live nik-0.1 fails 4/15 (old 'bujheko' thinks)
    a = ap.parse_args()
    tok = Tokenizer.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web/model/tokenizer.json'))
    model = load_any(a.model).eval()
    fails = 0
    for m in MSGS:
        ids, _ = render_chat(tok, [{'role': 'user', 'content': m}])
        with torch.no_grad():
            g = generate_ar(model, ids[:-1] + [6], 80, temperature=0.0)
        t = tok.decode(g)
        bad = '<|think|>' in t or looped(t) or len(re.sub(r'<\|[a-z/]+\|>', '', t).strip()) < 3
        fails += bad
        print(f"[{'FAIL' if bad else 'ok  '}] {m!r} -> {t.replace(chr(10), ' ')[:140]!r}")
    print(f'chat sanity: {len(MSGS) - fails}/{len(MSGS)} ok')
    sys.exit(1 if fails > a.max_fail else 0)


if __name__ == '__main__':
    main()
