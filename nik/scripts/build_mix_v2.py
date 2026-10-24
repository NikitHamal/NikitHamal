"""One-pass SFT mix builder (Claude, 2026-10-23): the recipe of the best arms of 2026-10-22 (k13 / s13) plus the
hand-written data, built in one run from what survives on Kaggle, instead of eight incremental add_rows steps.

    python nik/scripts/build_mix_v2.py --data data --out data_v2 --name v2 \
        --en data/english --selfrows data/selfdistill/followup_self_m50.jsonl --hand nik/data/hand/hand.jsonl

Base: data/p8m_tok.bin + p8m_mask.bin (Kaggle nik-p8m-mix; tokenized only, so additions are tokenized and joined at
the token level). Every addition is a share of the FINAL mix's tokens (defaults = k13's mix, see SHARES):
English chat rows (en_sft.jsonl + english_basic.py), generators (abstain, format_ask, multiturn, short needles,
everyday, colrows, money1, lookup, mention), the live model's own follow-up replies (selfrows) and the hand-written
data (repeats get augment.py's user-side variation). Row-level repairs as in fix_mix.py (history turns of follow-up
rows are context only; only-number format rows carry their working), the eval-prompt guard (make_sft2), user turns
lowercased (the browser lowercases what users type). The additions go FIRST: train.py holds out the LAST 0.5% of
conversations as validation, which then stays on the base as before. Replay: data/pre_train.bin + Simple English
Wikipedia docs (as add_english.py). Writes <out>/<name>_tok.bin, <name>_mask.bin, <name>.manifest.json.
"""
import argparse
import importlib
import json
import os
import random
import sys
from multiprocessing import Pool

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path[:0] = [os.path.join(ROOT, 'nik'), os.path.join(ROOT, 'nik', 'data', 'teacher'), os.path.join(ROOT, 'nik', 'scripts')]

# shares of the final mix's tokens (k13's mix p8mxs, approximately; hand-written data on top)
SHARES = {'english': 0.09, 'abstain': 0.027, 'format_ask': 0.027, 'multiturn': 0.045, 'longctx': 0.027,
          'everyday': 0.03, 'colrows': 0.04, 'money1': 0.02, 'lookup': 0.025, 'mention': 0.015, 'selfrows': 0.015,
          'hand': 0.06}
HISTORY_CATS = ('followup', 'reason-followup')
TOK = None


def _init():
    global TOK
    from tokenizer import Tokenizer
    TOK = Tokenizer.load(os.path.join(ROOT, 'nik', 'web', 'model', 'tokenizer.json'))


def _render(line):
    from prepare import render_chat
    r = json.loads(line)
    ids, mask = render_chat(TOK, r['messages'])
    if r.get('nokl'):          # KL-free row (train.py mask values): targets 1 -> 2, context 0 -> 3
        mask = [2 if v else 3 for v in mask]
    return ids, mask


def holdout_key(conv):
    """stable per-conversation key (first user turn), so every expanded row of a held-out conversation stays out"""
    import hashlib
    first = next((m['content'] for m in conv['messages'] if m['role'] == 'user'), '')
    return int(hashlib.md5(' '.join(first.lower().split()).encode()).hexdigest()[:8], 16) % 10000


def expand_hand(rows):
    """One training row per trained Nik turn of a hand-written conversation, with the history the way /chat sends it
    (chat/index.html passes {role, content} only): earlier Nik turns without their think and context only
    ("train": false). Hand rows otherwise trained every Nik turn on a history that carried thinks, which /chat never
    shows. Turns already marked "train": false (raw `C:` lines, e.g. a slip the user corrects) are never targets."""
    out = []
    for r in rows:
        msgs = r['messages']
        last = len(msgs) - 1
        for i, m in enumerate(msgs):
            if m['role'] != 'nik' or not m.get('train', True):
                continue
            hist = [dict(h) if h['role'] == 'user' else {'role': 'nik', 'content': h['content'], 'train': False} for h in msgs[:i]]
            row = {'cat': r['cat'], 'messages': hist + [dict(m)]}
            if i == last and r.get('gold'):
                row['gold'] = r['gold']
            out.append(row)
    return out


def fix(r):
    """fix_mix.py's repairs + lowercased user turns."""
    from format_ask import only_number_think
    cat = r.get('cat', '')
    nik = [m for m in r['messages'] if m['role'] == 'nik']
    if cat.startswith(HISTORY_CATS) and len(nik) > 1:
        for m in nik[:-1]:
            if not m.get('think'):
                m['train'] = False
    if cat == 'understand-format' and len(nik) == 1 and not nik[0].get('think'):
        t = only_number_think(r['messages'][0]['content'], nik[0]['content'])
        if t:
            nik[0]['think'] = t
    for m in r['messages']:
        if m['role'] == 'user':
            m['content'] = m['content'].lower()
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default='data'); ap.add_argument('--out', default='data_v2'); ap.add_argument('--name', default='v2')
    ap.add_argument('--base', default='p8m'); ap.add_argument('--en', default='data/english')
    ap.add_argument('--selfrows', default='data/selfdistill/followup_self_m50.jsonl')
    ap.add_argument('--hand', default=os.path.join(ROOT, 'nik', 'data', 'hand', 'hand.jsonl'))
    ap.add_argument('--share', action='append', default=[], help='source=share, overrides SHARES (share of final tokens)')
    ap.add_argument('--seed', type=int, default=71); ap.add_argument('--workers', type=int, default=os.cpu_count() or 2)
    ap.add_argument('--no-replay', action='store_true')
    ap.add_argument('--hand-nokl', action='store_true', help='hand rows train without the KL anchor (mask 2/3)')
    ap.add_argument('--hand-holdout', type=float, default=0.0, help='fraction of hand conversations kept out -> <out>/hand_heldout.jsonl')
    a = ap.parse_args()
    shares = dict(SHARES)
    for s in a.share:
        k, v = s.split('='); shares[k] = float(v)
    shares = {k: v for k, v in shares.items() if v > 0}
    R = random.Random(a.seed)
    os.makedirs(a.out, exist_ok=True)
    for f in os.listdir(a.data):
        src, dst = os.path.abspath(os.path.join(a.data, f)), os.path.join(a.out, f)
        if not os.path.exists(dst) and f != 'pre_train.bin' and not f.startswith(a.name):
            os.symlink(src, dst)

    base_tok = np.memmap(os.path.join(a.data, f'{a.base}_tok.bin'), dtype=np.uint16, mode='r')
    base_mask = np.memmap(os.path.join(a.data, f'{a.base}_mask.bin'), dtype=np.uint8, mode='r')
    base_share = 1 - sum(shares.values())
    assert base_share > 0.3, shares
    total = len(base_tok) / base_share
    _init()
    from prepare import render_chat
    import make_sft2
    from augment import augment_example
    os.environ.setdefault('NIK_LONG_LO', '200'); os.environ.setdefault('NIK_LONG_HI', '440')

    def ntok(r):
        return len(render_chat(TOK, r['messages'])[0])

    files = {}
    if 'english' in shares:
        files['english'] = [json.loads(l) for l in open(os.path.join(a.en, 'en_sft.jsonl')) if l.strip()]
    for k, p in (('selfrows', a.selfrows), ('hand', a.hand)):
        if k in shares:
            files[k] = [json.loads(l) for l in open(p) if l.strip()]
    if 'hand' in files and a.hand_holdout > 0:
        held = [r for r in files['hand'] if holdout_key(r) < a.hand_holdout * 10000]
        files['hand'] = [r for r in files['hand'] if holdout_key(r) >= a.hand_holdout * 10000]
        with open(os.path.join(a.out, 'hand_heldout.jsonl'), 'w') as f:
            for r in held:
                f.write(json.dumps(r, ensure_ascii=False) + '\n')
        print(f'hand: {len(held):,} conversations held out -> {a.out}/hand_heldout.jsonl', flush=True)
    if 'hand' in files:
        n0 = len(files['hand']); files['hand'] = expand_hand(files['hand'])
        print(f'hand: {n0:,} conversations -> {len(files["hand"]):,} rows (one per trained Nik turn)', flush=True)
    rows, manifest = [], {'base': a.base, 'base_tokens': int(len(base_tok)), 'shares': shares, 'sources': {}}
    for src, share in shares.items():
        want, got, n, uniq = share * total, 0, 0, set()
        if src in files:
            pool = files[src]
            order = list(range(len(pool)))
            while got < want:
                R.shuffle(order)
                for i in order:
                    r = json.loads(json.dumps(pool[i]))
                    if i in uniq:
                        augment_example(r, R, 0.8)        # repeats vary the user side (typos, chat spellings, case)
                    uniq.add(i)
                    if src == 'english' and R.random() < 0.10:
                        import english_basic
                        r = english_basic.sample(R)
                    if src == 'hand' and a.hand_nokl:
                        r['nokl'] = True
                    rows.append(json.dumps(fix(r), ensure_ascii=False)); got += ntok(r); n += 1
                    if got >= want:
                        break
        else:
            mod = importlib.import_module(src)
            while got < want:
                r = fix(mod.sample(R))
                rows.append(json.dumps(r, ensure_ascii=False)); got += ntok(r); n += 1
        manifest['sources'][src] = {'rows': n, 'tokens': int(got), 'unique': len(uniq) if src in files else n}
        print(f'{src:11s} {n:9,} rows {got / 1e6:7.1f}M tokens (target {share:.1%})', flush=True)
    rows = [l + '\n' for l in rows]
    rows = make_sft2._drop_eval_prompts(rows, os.path.join(ROOT, 'nik'))
    R.shuffle(rows)
    with Pool(a.workers, initializer=_init) as pool:
        parts = pool.map(_render, rows, chunksize=2000)
    add_tok = np.fromiter((t for ids, _ in parts for t in ids), dtype=np.uint16)
    add_mask = np.fromiter((m for _, ms in parts for m in ms), dtype=np.uint8)
    np.concatenate([add_tok, np.asarray(base_tok)]).tofile(os.path.join(a.out, f'{a.name}_tok.bin'))
    np.concatenate([add_mask, np.asarray(base_mask)]).tofile(os.path.join(a.out, f'{a.name}_mask.bin'))
    manifest.update({'addition_tokens': int(len(add_tok)), 'total_tokens': int(len(add_tok) + len(base_tok)),
                     'addition_rows': len(rows)})
    json.dump(manifest, open(os.path.join(a.out, f'{a.name}.manifest.json'), 'w'), indent=1)
    print(f'{a.name}: {len(add_tok) / 1e6:.1f}M added + {len(base_tok) / 1e6:.1f}M base = {(len(add_tok) + len(base_tok)) / 1e6:.1f}M tokens', flush=True)
    dst = os.path.join(a.out, 'pre_train.bin')
    if os.path.islink(dst) or os.path.exists(dst):
        os.remove(dst)
    pre = np.fromfile(os.path.join(a.data, 'pre_train.bin'), dtype=np.uint16)
    if a.no_replay or not os.path.exists(os.path.join(a.en, 'en_wiki.txt')):
        pre.tofile(dst); return
    out = []
    for line in open(os.path.join(a.en, 'en_wiki.txt')):
        if line.strip():
            out += [1] + TOK.encode(line.strip(), allow_special=False) + [2]
    en_tok = np.array(out, dtype=np.uint16)
    np.concatenate([pre, en_tok]).tofile(dst)
    print(f'replay: {len(pre):,} + {len(en_tok):,} English tokens ({100 * len(en_tok) / (len(pre) + len(en_tok)):.1f}%)')


if __name__ == '__main__':
    main()
