"""Build the v2 SFT mix (data/sft2.jsonl) that teaches understanding instead of recall.

  python nik/scripts/make_sft2.py --data data --teacher 200000

Changes vs v1 (data/sft.jsonl):
  * drops "write about <keyword>" rows: their targets were unrelated corpus paragraphs, which
    taught Nik that an answer does not have to be about the question
  * keeps only a slice of the fixed-answer chat/persona rows (enough for persona and tone,
    too few to make "recite the nearest stored reply" the winning strategy)
  * replaces old math/reason rows with a fresh audited teacher set whose largest new part is
    understanding tasks (memory, reading, translation, grammar, English, instructions)
"""
import argparse, json, os, random, subprocess, sys

KEEP = {'identity': 0.5, 'nikit': 0.5, 'chat': 0.3, 'smalltalk': 0.3, 'nepal': 0.35, 'philosophy': 0.35, 'multi': 0.3}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default='data')
    ap.add_argument('--teacher', type=int, default=200000)
    ap.add_argument('--seed', type=int, default=21)
    a = ap.parse_args()
    R = random.Random(a.seed)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tpath = os.path.join(a.data, 'teacher2.jsonl')
    subprocess.run([sys.executable, os.path.join(root, 'data/teacher/build.py'), '--n', str(a.teacher), '--seed', str(a.seed), '--out', tpath], check=True)
    rows, kept = [], {}
    src = os.path.join(a.data, 'sft.jsonl')
    if not os.path.exists(src):          # no v1 file: regenerate the chat/persona rows (no corpus -> no "write" rows)
        src = os.path.join(a.data, 'sft_v1_chat.jsonl')
        subprocess.run([sys.executable, os.path.join(root, 'data/gen_sft.py'), '--out', src, '--n', '60000'], check=True)
    if os.path.exists(src):
        for line in open(src):
            d = json.loads(line)
            c = d.get('cat') or ''
            if R.random() < KEEP.get(c, 0.0):
                rows.append(line if line.endswith('\n') else line + '\n')
                kept[c] = kept.get(c, 0) + 1
    rows += open(tpath).readlines()
    R.shuffle(rows)
    with open(os.path.join(a.data, 'sft2.jsonl'), 'w') as f:
        f.writelines(rows)
    print('kept from v1:', kept, '| teacher:', a.teacher, '| total', len(rows), flush=True)
    subprocess.run([sys.executable, os.path.join(root, 'prepare.py'), '--data', a.data, '--tok', os.path.join(root, 'web/model/tokenizer.json'),
                    '--sft-only', '--sft-name', 'sft2'], check=True)


if __name__ == '__main__':
    main()
