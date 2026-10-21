"""Keyword-trap gate (owner report: "mero naam nikit ho" -> Nikit's biography). Messages that MENTION nikit/nik/hamal
but do not ask about Nikit must not get persona facts, and the name must be used as the user's/friend's name.
Hand-written, never used for training. Exit 1 if more than --max-fail fail.

    python nik/trap_check.py --model nik/web/model/nik-0.1.bin
"""
import argparse, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import torch  # noqa: E402
from eval_understand import load_any  # noqa: E402
from model import generate_ar  # noqa: E402
from prepare import render_chat  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402

PERSONA = re.compile(r'android|consica|full-?stack|developer|engineer|lami|nebians|astroweb|essay|head of operations|sunya dekhi|banaunubhayo')
# (turns, must-contain any of | for the last reply ('' = no requirement))
TRAPS = [
    (['mero naam nikit ho.'], 'nikit'),
    (['ma nikit, kathmandu bata.'], 'nikit|kathmandu'),
    (['mero naam nikit ho.', 'mero naam k ho?'], 'nikit'),
    (['mero sathi nikit lai chiya man parchha.'], 'chiya'),
    (['hijo nikit sanga football kheleko thiye.'], 'football|khel'),
    (['nikit le 4 ota syau kinyo. nikit le kati syau kinyo?'], '4'),
    (['mero bhai ko naam nik ho, u 10 barsha ko chha.', 'mero bhai kati barsha ko?'], '10'),
    (['hamal thar ko euta sathi chha mero.'], ''),
    (['nikita mero didi ho.', 'mero didi ko naam k ho?'], 'nikita'),
    (['aaja nikit birami chha, k garne?'], ''),
    (['ma pani nikit jasto coder banna chahanchhu.'], ''),
    (['nik bhanne mero kukur ko naam ho.', 'mero kukur ko naam k ho?'], 'nik'),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--max-fail', type=int, default=2)
    a = ap.parse_args()
    tok = Tokenizer.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web/model/tokenizer.json'))
    model = load_any(a.model).eval()
    fails = 0
    for turns, want in TRAPS:
        msgs = []
        for t in turns:
            msgs.append({'role': 'user', 'content': t})
            ids, _ = render_chat(tok, msgs)
            with torch.no_grad():
                g = generate_ar(model, ids[:-1] + [6], 120, temperature=0.0)
            out = re.sub(r'<\|think\|>.*?(<\|/think\|>|$)', '', tok.decode(g), flags=re.S).replace('<|end|>', '').strip()
            msgs.append({'role': 'nik', 'content': out})
        low = out.lower()
        bad = bool(PERSONA.search(low)) or bool(want and not any(w in low for w in want.split('|')))
        fails += bad
        print(f"[{'FAIL' if bad else 'ok  '}] {turns[-1]!r} -> {out[:140]!r}")
    print(f'trap check: {len(TRAPS) - fails}/{len(TRAPS)} ok')
    sys.exit(1 if fails > a.max_fail else 0)


if __name__ == '__main__':
    main()
