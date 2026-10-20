"""Validate the hand-written gold set and keep it out of the test sets.

    python nik/data/gold/check.py          # exit 1 on any problem

Checks: valid JSON, roles alternate user/nik ending with nik, ASCII only, no duplicate first turns, every
'a op b = c' in steps/content is exact, and no user turn is a near-copy (difflib ratio >= 0.8, or the same quoted
phrase) of an eval_understand.py probe. Gold rows teach skills; the probes must stay unseen phrasings.
"""
import difflib, glob, json, os, re, sys
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, '..', '..', 'eval_understand.py')).read()
i = src.index('PROBES = ['); j = src.index('\n]\n', i) + 2
ns = {'U': lambda t: {'role': 'user', 'content': t}, 'N': lambda t: {'role': 'nik', 'content': t}}
exec(src[i:j], ns)
probes = [m['content'] for _, msgs, _ in ns['PROBES'] for m in msgs if m['role'] == 'user']
norm = lambda s: re.sub(r'[^a-z0-9 ]', '', s.lower())  # noqa: E731
quoted = {q for p in probes for q in re.findall(r'"([^"]+)"', p.lower())}
NUM = r'\d+(?:\.\d+)?'
EQ = re.compile(rf'(?<![\d/.+x*-] )(?<![\d/.])({NUM}(?:\s*[-+x*/]\s*{NUM})+)\s*=\s*({NUM})(?![\d/.]\d)')
errs, seen, n = [], set(), 0
for f in sorted(glob.glob(os.path.join(HERE, '*.jsonl'))):
    for k, line in enumerate(open(f), 1):
        where = f'{os.path.basename(f)}:{k}'
        try:
            d = json.loads(line); ms = d['messages']
        except Exception as e:  # noqa: BLE001
            errs.append(f'{where} bad json {e}'); continue
        n += 1
        if not line.isascii():
            errs.append(f'{where} non-ascii')
        if [m['role'] for m in ms] != ['user', 'nik'] * (len(ms) // 2) or len(ms) % 2:
            errs.append(f'{where} roles')
        if ms[0]['content'] in seen:
            errs.append(f'{where} duplicate first turn')
        seen.add(ms[0]['content'])
        for m in ms:
            for t in ((m.get('content', ''), m.get('steps', '')) if m['role'] == 'nik' else ()):   # users may state false sums
                for mt in EQ.finditer(t):
                    e, c = mt.groups()
                    if re.match(r'\s*[-+x*/]\s*\d', t[mt.end():]) or t[max(0, mt.start() - 1):mt.start()] == '-':
                        continue                                 # chain continues (a = b + c = d) or a negative operand
                    e = re.sub(r'(\d+)/(\d+)', r'(\1 // \2)', e)    # tight a/b is one fraction
                    e = re.sub(r'(\d+(?:\.\d+)?)', r'F("\1")', e.replace('x', '*')).replace('//', '/')
                    v = eval(e, {'F': Fraction})
                    if abs(v - Fraction(c)) > Fraction(1, 100) and not (v.denominator > 1 and abs(v - Fraction(c)) < 1):
                        errs.append(f'{where} arithmetic {e} = {c} (is {float(v):g})')
            if m['role'] == 'user':
                for p in probes:
                    if difflib.SequenceMatcher(None, norm(m['content']), norm(p)).ratio() >= 0.8:
                        errs.append(f'{where} near-copy of probe: {p!r}')
                for q in re.findall(r'"([^"]+)"', m['content'].lower()):
                    if q in quoted:
                        errs.append(f'{where} uses probe phrase "{q}"')
print(f'{n} gold conversations, {len(errs)} problems')
for e in errs:
    print(' ', e)
sys.exit(1 if errs else 0)
