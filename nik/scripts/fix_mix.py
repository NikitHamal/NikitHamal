"""Repair an existing SFT mix for the two no-think lessons found 2026-10-22 (Claude), then tokenize it.

1. Multi-turn follow-up rows (followup-*, reason-followup) carried their FIRST answer without a think (as /chat sends
   history) and prepare.py trained every Nik turn, so each row also taught "arithmetic question -> bare answer". Every
   Nik turn but the last becomes context only ("train": false).
2. Only-number format rows (`24 x 4 kati? number matra lekha.` -> `96`) get their working as a hidden think
   (format_ask.only_number_think); the visible answer is unchanged.
k4 (nested 212 vs 222, 4 fixed / 14 broken): `jodnus 87 ra 68` -> `355` with no think.
    python nik/scripts/fix_mix.py --data data_en --base p8mxm --name p8mxn
"""
import argparse
import collections
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path[:0] = [os.path.join(ROOT, 'nik', 'data', 'teacher')]
from format_ask import only_number_think  # noqa: E402

HISTORY_CATS = ('followup', 'reason-followup')


def fix(r, c):
    cat = r.get('cat', '')
    nik = [m for m in r['messages'] if m['role'] == 'nik']
    if cat.startswith(HISTORY_CATS) and len(nik) > 1:
        for m in nik[:-1]:
            if not m.get('think') and m.get('train', True):
                m['train'] = False
                c['history turn -> context only'] += 1
    if cat == 'understand-format' and len(nik) == 1 and not nik[0].get('think'):
        t = only_number_think(r['messages'][0]['content'], nik[0]['content'])
        if t:
            nik[0]['think'] = t
            c['format row + think'] += 1
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True); ap.add_argument('--base', required=True); ap.add_argument('--name', required=True)
    a = ap.parse_args()
    c = collections.Counter()
    with open(os.path.join(a.data, f'{a.base}.jsonl')) as f, open(os.path.join(a.data, f'{a.name}.jsonl'), 'w') as g:
        for line in f:
            g.write(json.dumps(fix(json.loads(line), c), ensure_ascii=False) + '\n')
            c['rows'] += 1
    print(dict(c), flush=True)
    subprocess.run([sys.executable, os.path.join(ROOT, 'nik', 'prepare.py'), '--data', a.data, '--sft-only', '--sft-name', a.name,
                    '--tok', os.path.join(ROOT, 'nik', 'web', 'model', 'tokenizer.json')], check=True)


if __name__ == '__main__':
    main()
