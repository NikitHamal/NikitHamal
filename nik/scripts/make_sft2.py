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


# questions whose answer depends on the conversation (the probe's name/value differs from any training row)
CONTEXT_Q = {'mero naam k ho', 'mero naam k ho?'}
# trap_check follow-ups that only ask about an earlier turn: generic memory questions, the answer is in the context
TRAP_CONTEXT_Q = {'mero naam k ho?', 'mero kukur ko naam k ho?', 'mero didi ko naam k ho?', 'mero bhai kati barsha ko?'}


def _drop_eval_prompts(rows, root):
    import glob
    """Held-out gates stay held out: drop any row whose user turn is an exact eval_understand, stress or trap_check
    prompt (write.py had 5 stress prompts verbatim; names.py emitted the trap sentences "mero naam nikit ho" and
    "ma nikit, kathmandu bata"). chat_check is a sanity gate of generic greetings and is not filtered."""
    sys.path.insert(0, os.path.join(root, 'scripts'))
    import leak_audit as la
    norm = lambda t: ' '.join(t.lower().split()).strip(' ?!.')
    held = {norm(q) for q in la._prompts_understand(os.path.join(root, 'eval_understand.py')) + la._prompts_stress(os.path.join(root, 'stress.py'))}
    held -= {norm(q) for q in CONTEXT_Q}
    held |= {norm(q) for q in la._prompts_trap_check(os.path.join(root, 'trap_check.py'))} - {norm(q) for q in TRAP_CONTEXT_Q}
    sys.path.insert(0, root)
    import bench_rw   # NikBench-RW prompts are held out too
    held |= {norm(v[-1] if isinstance(v, list) else v) for g in bench_rw.G for v in g[3]}   # scored turns only
    # chat_audit.mjs sets (nik/tests/chat/*.json): every scored user turn
    for f in glob.glob(os.path.join(root, 'tests', 'chat', '*.json')):
        for c in json.load(open(f)):
            held |= {norm(t) for t, w in zip(c['turns'], c.get('want') or [None] * len(c['turns'])) if w}
    out = [r for r in rows if not any(m['role'] == 'user' and norm(m['content']) in held for m in json.loads(r)['messages'])]
    print(f'eval-prompt guard: dropped {len(rows) - len(out)} rows with an exact understand/stress/trap prompt', flush=True)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default='data')
    ap.add_argument('--teacher', type=int, default=200000)
    ap.add_argument('--seed', type=int, default=21)
    ap.add_argument('--name', default='sft2', help='output data/<name>.jsonl and <name>_tok.bin')
    ap.add_argument('--parts', type=int, default=1, help='build the teacher set in N parallel processes (different seeds)')
    ap.add_argument('--gold', default=None, help='dir of hand-written gold jsonl (default nik/data/gold if it exists; "none" to skip)')
    ap.add_argument('--gold-rep', type=int, default=16)
    ap.add_argument('--chat', type=int, default=0, help='rows of everyday conversation from data/teacher/chat.py (no think)')
    ap.add_argument('--write', type=int, default=0, help='rows of requested writing from data/teacher/write.py')
    ap.add_argument('--names', type=int, default=0, help='entity-mention rows (names.py): names as the user/friend, not persona questions')
    ap.add_argument('--max-same-reply', type=int, default=0, help='cap identical assistant replies across the whole mix (0 = off)')
    ap.add_argument('--keep-all', action='store_true', help='keep every v1 chat/persona row (balance a task-heavy mix)')
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
    if a.keep_all:
        keep = {k: 1.0 for k in KEEP}
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
    if a.chat:
        sys.path.insert(0, os.path.join(root, 'data/teacher'))
        import chat
        from augment import augment_example
        RC = random.Random(a.seed + 7)
        for _ in range(a.chat):
            e = augment_example(chat.sample(RC), RC, 0.5)
            rows.append(json.dumps({'cat': e['kind'], 'gold': None, 'messages': e['messages']}, ensure_ascii=False) + '\n')
        print(f'chat: {a.chat} everyday-conversation rows', flush=True)
    if a.write:
        sys.path.insert(0, os.path.join(root, 'data/teacher'))
        import write as wgen
        from augment import augment_example
        RW = random.Random(a.seed + 11)
        for _ in range(a.write):
            e = augment_example(wgen.sample(RW), RW, 0.5)
            rows.append(json.dumps({'cat': e['kind'], 'gold': None, 'messages': e['messages']}, ensure_ascii=False) + '\n')
        print(f'write: {a.write} writing rows', flush=True)
    if use_gold:
        subprocess.run([sys.executable, os.path.join(gold_dir, 'check.py')], check=True)   # valid, exact, no test leaks
        g, ng = gold_rows(gold_dir, a.gold_rep, R)
        rows += g
        print(f'gold: {ng} conversations x {a.gold_rep} = {len(g)} rows', flush=True)
    if a.names:
        sys.path.insert(0, os.path.join(root, 'data/teacher'))
        import names as ngen
        from augment import augment_example
        RN = random.Random(a.seed + 13)
        for _ in range(a.names):
            e = augment_example(ngen.sample(RN), RN, 0.5)
            rows.append(json.dumps(e, ensure_ascii=False) + '\n')
        print(f'names: {a.names} entity-mention rows', flush=True)
    if a.max_same_reply:      # recitation fix: no single assistant reply may dominate (gold x40, canned persona/chat replies)
        R.shuffle(rows)
        seen_r, kept_rows, dropped = {}, [], 0
        for line in rows:
            d = json.loads(line)
            key = ' || '.join(m['content'].strip().lower() for m in d['messages'] if m['role'] == 'nik')
            seen_r[key] = seen_r.get(key, 0) + 1
            if seen_r[key] > a.max_same_reply:
                dropped += 1; continue
            kept_rows.append(line)
        rows = kept_rows
        print(f'max-same-reply {a.max_same_reply}: dropped {dropped} rows whose reply was already used {a.max_same_reply}x', flush=True)
    rows = _drop_eval_prompts(rows, root)
    R.shuffle(rows)
    with open(os.path.join(a.data, f'{a.name}.jsonl'), 'w') as f:
        f.writelines(rows)
    print('kept from v1:', kept, '| teacher:', len(seen), '| total', len(rows), flush=True)
    subprocess.run([sys.executable, os.path.join(root, 'prepare.py'), '--data', a.data, '--tok', os.path.join(root, 'web/model/tokenizer.json'),
                    '--sft-only', '--sft-name', a.name], check=True)


if __name__ == '__main__':
    main()
