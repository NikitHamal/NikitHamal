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
# with hand-written gold data (nik/data/gold) the canned v1 replies are cut further: thousands of copies of the same
# identity answer are what made "recite the nearest stored reply" the winning strategy
KEEP_WITH_GOLD = {'identity': 0.12, 'nikit': 0.2, 'chat': 0.12, 'smalltalk': 0.12, 'nepal': 0.2, 'philosophy': 0.25, 'multi': 0.15}


def gold_rows(gold_dir, rep, R):
    """Hand-written gold conversations (written by the coding agent as Nik's teacher). `steps` -> `think`.
    Each conversation is repeated `rep` times; every copy after the first gets user-side phrasing augmentation,
    so the stable signal is the content, not the surface form."""
    import glob
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data/teacher'))
    from augment import augment_example
    out, n = [], 0
    for f in sorted(glob.glob(os.path.join(gold_dir, '*.jsonl'))):
        for line in open(f):
            d = json.loads(line)
            for m in d['messages']:
                if 'steps' in m:
                    m['think'] = m.pop('steps')
            n += 1
            for r in range(rep):
                e = json.loads(json.dumps(d))
                if r:
                    augment_example(e, R, 0.8)
                out.append(json.dumps(e, ensure_ascii=False) + '\n')
    return out, n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default='data')
    ap.add_argument('--teacher', type=int, default=200000)
    ap.add_argument('--seed', type=int, default=21)
    ap.add_argument('--name', default='sft2', help='output data/<name>.jsonl and <name>_tok.bin')
    ap.add_argument('--parts', type=int, default=1, help='build the teacher set in N parallel processes (different seeds)')
    ap.add_argument('--gold', default=None, help='dir of hand-written gold jsonl (default nik/data/gold if it exists; "none" to skip)')
    ap.add_argument('--gold-rep', type=int, default=16)
    a = ap.parse_args()
    R = random.Random(a.seed)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tpath = os.path.join(a.data, f'teacher_{a.name}.jsonl')
    per = a.teacher // a.parts
    procs = [subprocess.Popen([sys.executable, os.path.join(root, 'data/teacher/build.py'), '--n', str(per), '--seed', str(a.seed + 1000 * i),
                               '--out', f'{tpath}.part{i}'], stdout=subprocess.DEVNULL) for i in range(a.parts)]
    assert all(p.wait() == 0 for p in procs), 'teacher build failed'
    seen = set()
    with open(tpath, 'w') as f:                       # merge parts, dropping cross-part duplicates
        for i in range(a.parts):
            for line in open(f'{tpath}.part{i}'):
                k = json.dumps([m['content'] for m in json.loads(line)['messages'] if m['role'] == 'user'])
                if k not in seen:
                    seen.add(k); f.write(line)
            os.remove(f'{tpath}.part{i}')
    gold_dir = a.gold or os.path.join(root, 'data/gold')
    use_gold = a.gold != 'none' and os.path.isdir(gold_dir)
    keep = KEEP_WITH_GOLD if use_gold else KEEP
    rows, kept = [], {}
    src = os.path.join(a.data, 'sft.jsonl')
    if not os.path.exists(src):          # no v1 file: regenerate the chat/persona rows (no corpus -> no "write" rows)
        src = os.path.join(a.data, 'sft_v1_chat.jsonl')
        subprocess.run([sys.executable, os.path.join(root, 'data/gen_sft.py'), '--out', src, '--n', '60000'], check=True)
    if os.path.exists(src):
        for line in open(src):
            d = json.loads(line)
            c = d.get('cat') or ''
            if any(m.get('think') for m in d.get('messages', [])):   # old math scratchpads (size-specific tricks): drop
                continue
            if R.random() < keep.get(c, 0.0):
                rows.append(line if line.endswith('\n') else line + '\n')
                kept[c] = kept.get(c, 0) + 1
    rows += open(tpath).readlines()
    if use_gold:
        subprocess.run([sys.executable, os.path.join(gold_dir, 'check.py')], check=True)   # valid, exact, no test leaks
        g, ng = gold_rows(gold_dir, a.gold_rep, R)
        rows += g
        print(f'gold: {ng} conversations x {a.gold_rep} = {len(g)} rows', flush=True)
    R.shuffle(rows)
    with open(os.path.join(a.data, f'{a.name}.jsonl'), 'w') as f:
        f.writelines(rows)
    print('kept from v1:', kept, '| teacher:', len(seen), '| total', len(rows), flush=True)
    subprocess.run([sys.executable, os.path.join(root, 'prepare.py'), '--data', a.data, '--tok', os.path.join(root, 'web/model/tokenizer.json'),
                    '--sft-only', '--sft-name', a.name], check=True)


if __name__ == '__main__':
    main()
