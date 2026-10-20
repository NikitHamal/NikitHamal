"""Auditor for teacher data: every example must pass every check, or it is rejected.

    python nik/data/teacher/audit.py data/teacher.jsonl      # report + exit code 1 on failures
"""
import collections, json, re, sys

from verify import check_equations, evaluate

# Nik writes in one consistent style: chat-style spellings are fine in USER turns only.
NON_STYLE = re.compile(r'\b(xa|xu|xau|xan|xaina|hunxa|garxu|garxa|cha|chu|chau|chaina|tmro|tmi|vayo|vanne|k cha)\b')
WORD_REPEAT = re.compile(r'\b(\w+)( \1\b){2,}')


def final_number(s):
    m = re.findall(r'\d+(?:/\d+)?(?:\.\d+)?', s.replace(',', ''))
    return m[-1] if m else None


def check(ex):
    """Returns list of failure reasons (empty = pass)."""
    errs = []
    msgs = ex.get('messages', [])
    if len(msgs) < 2:
        return ['structure']
    for m in msgs:
        t = m.get('content', '') + ' ' + m.get('think', '')
        if re.search(r'[ऀ-ॿ]', t):
            errs.append('devanagari')
        if re.search(r'[^\x00-\x7F]', t.replace('✓', '')):
            errs.append('non-ascii')
        if m['role'] == 'nik':
            body = (m.get('think', '') + ' ' + m['content']).lower()
            if NON_STYLE.search(body):
                errs.append('style:' + NON_STYLE.search(body).group(0))
            if WORD_REPEAT.search(body):
                errs.append('repetition')
            if not (3 <= len(m['content']) <= 900) or len(m.get('think', '')) > 1400:
                errs.append('length')
            n, bad = check_equations(m.get('think', '') + ' . ' + m['content'])
            if bad:
                errs.append('math:' + bad[0])
    gold = ex.get('gold')
    kind = ex.get('cat', '')
    if gold is not None:
        ans = msgs[-1]['content'].lower()
        if re.fullmatch(r'-?\d+(?:/\d+)?(?:\.\d+)?', str(gold)):
            fn = final_number(ans)
            if fn is None or evaluate(fn) != evaluate(str(gold)):
                if str(gold) not in ans.replace(',', ''):
                    errs.append(f'answer!=gold({gold})')
        elif str(gold).lower() not in ans:
            errs.append(f'answer-missing-gold({gold})')
        if kind.startswith(('math', 'reason')) and not msgs[-1].get('think'):
            errs.append('no-think')
    return errs


def audit(rows, verbose=True):
    fails = collections.Counter()
    by_kind = collections.Counter()
    good, seen = [], set()
    for ex in rows:
        key = json.dumps([m['content'] for m in ex['messages'] if m['role'] == 'user'])
        e = check(ex)
        if key in seen and not ex.get('cat', '').startswith('explain'):
            e.append('duplicate')
        seen.add(key)
        if e:
            for r in e:
                fails[r.split(':')[0].split('(')[0]] += 1
        else:
            good.append(ex)
            by_kind[ex.get('cat', '?')] += 1
    if verbose:
        print(f'audit: {len(good)}/{len(rows)} passed ({100 * len(good) / max(1, len(rows)):.1f}%)')
        print('  failures:', dict(fails))
        print('  passed by category:', dict(sorted(by_kind.items())))
    return good, fails


if __name__ == '__main__':
    rows = [json.loads(l) for l in open(sys.argv[1])]
    good, fails = audit(rows)
    sys.exit(1 if fails else 0)
