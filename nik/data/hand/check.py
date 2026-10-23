"""Compile + validate the hand-written data (nik/data/hand/raw/**/*.txt) into nik/data/hand/hand.jsonl.

    python nik/data/hand/check.py                 # all files: stats, rejects per file, writes hand.jsonl
    python nik/data/hand/check.py raw/a/x.txt     # one file: prints every rejected example with its reason

Writing format (STYLE.md): examples are blocks; a block starts with `### <category>`; then one line per turn:
    U: user text              N: Nik's reply             T: worked solution for the NEXT N (optional)
    G: the gold answer (optional; must appear in the last N)
Every line is one turn (no line breaks inside a turn). Lines starting with `#` (not `###`) are comments.

Rejected: bad structure (turns must alternate U/N and end with N), non-ASCII / Devanagari, chat spellings in Nik's turns
(xa, cha, hunxa, vayo ...), a wrong equation anywhere in Nik's turns (`a op b = c` checked exactly), a G that the last
reply does not contain, word loops, too short/long, persona facts outside persona/identity categories, a duplicate
first user turn, and ANY user turn equal to an evaluation prompt (understanding probes, stress, traps, chat_check,
NikBench-RW, bench_reading, shape probe, ladder, NikBench items of seeds 2026/7/11, nik/tests/chat/*, ship smoke).
"""
import collections
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
NIK = os.path.dirname(os.path.dirname(HERE))
sys.path[:0] = [NIK, os.path.join(NIK, 'data', 'teacher'), os.path.join(NIK, 'scripts')]
from verify import check_equations  # noqa: E402

NON_STYLE = re.compile(r'\b(xa|xu|xau|xan|xaina|hunxa|garxu|garxa|cha|chu|chau|chaina|tmro|tmi|vayo|vanne|k cha'
                       r'|(?!bagaincha\b|galaincha\b)[a-z]+incha|(?!pancha\b|dhancha\b)[a-z]+(?:unch|anch|ench|onch)a|huncha|garcha|lagcha)\b')   # -chha verbs
WORD_REPEAT = re.compile(r'\b(\w+)( \1\b){2,}')
PERSONA = re.compile(r'android|consica|full-?stack|lami nepal|nebians|astroweb|head of operations|sunya dekhi|kotlin|flutter|django')
PERSONA_OK = ('persona', 'identity')
norm = lambda t: ' '.join(re.sub(r'[^a-z0-9 ]', ' ', t.lower()).split())  # noqa: E731


def forbidden():
    """Normalized evaluation prompts (exact-match guard)."""
    import leak_audit as la
    out = set()
    add = lambda qs: out.update(norm(q) for q in qs if q and len(q) > 3)  # noqa: E731
    add(la._prompts_understand(os.path.join(NIK, 'eval_understand.py')))
    add(la._prompts_chat_check(os.path.join(NIK, 'chat_check.py')))
    add(la._prompts_stress(os.path.join(NIK, 'stress.py')))
    add(la._prompts_trap_check(os.path.join(NIK, 'trap_check.py')))
    add(la._prompts_bench_hard(os.path.join(NIK, 'bench_hard.py')))
    try:
        import bench_rw
        add(v for g in bench_rw.G for t in g[3] for v in (t if isinstance(t, list) else [t]))
    except Exception as e:  # noqa: BLE001
        print('warn: bench_rw', e)
    try:
        import bench_reading
        for p in bench_reading.PAIRS:
            add([p['ctx'], p['q1'], p['q2'], f"{p['ctx']} {p['q1']}", f"{p['ctx']} {p['q2']}"])
    except Exception as e:  # noqa: BLE001
        print('warn: bench_reading', e)
    try:
        import shape_probe
        add(p[1] for p in shape_probe.PROBES)
    except Exception as e:  # noqa: BLE001
        print('warn: shape_probe', e)
    try:
        import bench
        for seed in (2026, 7, 11):
            for nested in (False, True):
                add(q for _, q, _ in bench.items(16, seed=seed, nested=nested))
    except Exception as e:  # noqa: BLE001
        print('warn: bench', e)
    for f in glob.glob(os.path.join(NIK, 'tests', 'chat', '*.json')):
        for c in json.load(open(f)):
            add(c['turns'])
    try:
        src = open(os.path.join(NIK, 'scripts', 'ship_smoke.mjs')).read()
        add(re.findall(r"\['([^']+)'", src))
    except Exception:  # noqa: BLE001
        pass
    lad = '/tmp/hand_ladder.json'
    if not os.path.exists(lad):
        os.system(f'{sys.executable} {os.path.join(NIK, "scripts", "word_procedure_probe.py")} --out {lad} --ladder > /dev/null 2>&1')
    try:
        add(r.get('q', '') if isinstance(r, dict) else r[1] for r in json.load(open(lad)))   # --out rows are [cat, q, gold]
    except Exception:  # noqa: BLE001
        pass
    return out


def parse(path):
    """-> list of (line_no, cat, turns, gold) ; turns = [(role, content, think)]"""
    out, cur = [], None
    for k, raw in enumerate(open(path, encoding='utf-8', errors='replace'), 1):
        line = raw.rstrip('\n').strip()
        if not line:
            continue
        if line.startswith('###'):
            if cur:
                out.append(cur)
            cur = [k, line[3:].strip(), [], None, None, []]   # line, cat, turns, gold, pending think, errors
            continue
        if line.startswith('#'):
            continue
        if cur is None:
            continue
        tag, _, text = line.partition(':')
        tag, text = tag.strip(), text.strip()
        if tag == 'U':
            cur[2].append(['user', text, None])
        elif tag == 'N':
            cur[2].append(['nik', text, cur[4]]); cur[4] = None
        elif tag == 'T':
            cur[4] = text
        elif tag == 'G':
            cur[3] = text
        else:
            cur[5].append(f'unknown line "{line[:40]}"')
    if cur:
        out.append(cur)
    return out


def check(ex, forb):
    k, cat, turns, gold, pending, errs = ex
    errs = list(errs)
    roles = [t[0] for t in turns]
    if not turns or roles != ['user', 'nik'] * (len(roles) // 2) or len(roles) % 2:
        errs.append('structure: turns must alternate U/N and end with N')
    if pending:
        errs.append('T: line not followed by an N: line')
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', cat or ''):
        errs.append('category must be lowercase-with-dashes')
    for role, text, think in turns:
        blob = text + ' ' + (think or '')
        if not blob.isascii():
            errs.append('non-ascii character')
        if not text:
            errs.append('empty turn')
        if role == 'nik':
            low = blob.lower()
            if NON_STYLE.search(low):
                errs.append(f'chat spelling in Nik turn: "{NON_STYLE.search(low).group(0)}"')
            if WORD_REPEAT.search(low):
                errs.append('word repeated 3+ times in a row')
            if not 2 <= len(text) <= 900 or len(think or '') > 1200:
                errs.append('length')
            n, bad = check_equations((think or '') + ' . ' + text)
            if bad:
                errs.append(f'wrong equation: {bad[0]}')
            if PERSONA.search(low) and not any(p in cat for p in PERSONA_OK):
                errs.append('persona facts outside a persona/identity category')
        elif norm(text) in forb:
            errs.append(f'user turn is an evaluation prompt: "{text[:60]}"')
    if gold and turns and turns[-1][0] == 'nik':
        g = gold.lower().replace(',', '')
        last = (turns[-1][1]).lower().replace(',', '')
        hit = re.search(rf'(?<![\d.]){re.escape(g)}(?![\d])', last) if re.fullmatch(r'-?\d+(\.\d+)?', g) else g in last
        if not hit:
            errs.append(f'gold "{gold}" not in the last reply')
    return errs


def to_row(ex):
    _, cat, turns, gold, _, _ = ex
    msgs = []
    for role, text, think in turns:
        m = {'role': role, 'content': text}
        if think:
            m['think'] = think
        msgs.append(m)
    row = {'cat': f'hand-{cat}', 'messages': msgs}
    if gold:
        row['gold'] = gold
    return row


def main():
    files = sys.argv[1:] or sorted(glob.glob(os.path.join(HERE, 'raw', '**', '*.txt'), recursive=True))
    one = len(sys.argv) > 1
    forb = forbidden()
    seen, rows = {}, []
    if one:   # one-file mode also catches first user turns that another raw file already has
        mine = {os.path.abspath(f) for f in files}
        for f in sorted(glob.glob(os.path.join(HERE, 'raw', '**', '*.txt'), recursive=True)):
            if os.path.abspath(f) not in mine:
                for ex in parse(f):
                    if ex[2]:
                        seen.setdefault(norm(ex[2][0][1]), f'{os.path.relpath(f, HERE)}:{ex[0]}')
    per_file, per_cat, rej_reason = collections.Counter(), collections.Counter(), collections.Counter()
    for f in files:
        exs = parse(f)
        bad = 0
        for ex in exs:
            errs = check(ex, forb)
            first = norm(ex[2][0][1]) if ex[2] else ''
            if first and first in seen and not errs:
                errs.append(f'duplicate first user turn (also {seen[first]})')
            if errs:
                bad += 1
                for e in errs:
                    rej_reason[e.split(':')[0]] += 1
                if one:
                    print(f'{os.path.relpath(f, HERE)}:{ex[0]}  REJECT  {"; ".join(errs)}')
                continue
            seen[first] = f'{os.path.relpath(f, HERE)}:{ex[0]}'
            rows.append(to_row(ex))
            per_cat[ex[1]] += 1
        per_file[os.path.relpath(f, HERE)] = (len(exs), bad)
    if one:
        for f, (n, b) in per_file.items():
            print(f'{f}: {n - b}/{n} examples pass')
        return
    with open(os.path.join(HERE, 'hand.jsonl'), 'w') as g:
        for r in rows:
            g.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f'{len(rows):,} clean examples from {len(files)} files -> hand.jsonl')
    print('by category:', dict(sorted(per_cat.items(), key=lambda kv: -kv[1])))
    print('rejections:', dict(rej_reason.most_common()))
    worst = sorted(((b / max(1, n), f, n, b) for f, (n, b) in per_file.items() if b), reverse=True)[:10]
    for frac, f, n, b in worst:
        print(f'  {f}: {b}/{n} rejected')


if __name__ == '__main__':
    main()
