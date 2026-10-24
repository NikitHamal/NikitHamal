"""Surface augmentation for user turns: the same request written the many ways people really
type it (imperative forms, question words, casual spellings, prefixes, code-mixing, punctuation).
A small model trained on 1-3 phrasings per task learns the phrasings; this makes the *content*
the only stable signal. Quoted text ("...") is never changed, so gold answers stay valid.
"""
import random
import re

SWAPS = [
    (r'\bbhannus\b', ['bhannus', 'bhana', 'bhanus', 'batau', 'bataunus', 'bhandinus', 'bhanideu']),
    (r'\blekhnus\b', ['lekhnus', 'lekha', 'lekhdeu', 'lekhidinus', 'lekh']),
    (r'\bbanaunus\b', ['banaunus', 'banau', 'banaideu', 'banaidinus']),
    (r'\bmilaunus\b', ['milaunus', 'milau', 'milaideu', 'rakha', 'lekha']),
    (r'\bdinus\b', ['dinus', 'deu', 'dinu na', 'dideu']),
    (r'\bpadhnus\b', ['padhnus', 'padha', 'hera', 'padhera bhana']),
    (r'\bsolve garnus\b', ['solve garnus', 'solve gara', 'hal gara', 'nikala']),
    (r'\bk ho\?', ['k ho?', 'ke ho?', 'k hunchha?', 'k ho hola?', 'k?']),
    (r'\bkati ho\?', ['kati ho?', 'kati?', 'kati hunchha?', 'kati hola?']),
    (r'\bkati hunchha\?', ['kati hunchha?', 'kati ho?', 'kati?', 'kati aauchha?']),
    (r'\bkun ho\b', ['kun ho', 'kun chai ho', 'kun']),
    (r'\bkaha\b', ['kaha', 'kahan', 'kata']),
    (r'\bchhan\?', ['chhan?', 'chha?', 'chhan hola?']),
    (r'\bk k\b', ['k k', 'ke ke']),
    (r'\bmalai\b', ['malai', 'mailai']),
    (r'\bramro\b', ['ramro', 'ramro', 'raamro']),
]
CASUAL = [(r'chh', ['chh', 'chh', 'chh', 'ch', 'x']), (r'\bbh', ['bh', 'bh', 'v']), (r'aa', ['aa', 'aa', 'a'])]
# the owner (2026-10-24): "most of us, including me, use xa instead of chha": a whole message in xa spelling, consistently
XA = [(r'chh', 'x'), (r'\bch(?=a\b)', 'x'), (r'\bchaina\b', 'xaina')]
PREFIX = ['', '', '', '', 'hey nik, ', 'nik, ', 'ekchin, ', 'plz ', 'ali help gara: ', 'ok ', 'dai, ', 'sun na, ', 'hello, ']
SUFFIX = ['', '', '', '', ' plz', ' hai', ' ta', ' la', ' na', ' hola']


# The same sum written the ways people type it (owner, 2026-10-24: `5674674+3644849 kati hunxa?` was read as a story).
# Raw m50 on 30 fresh sums: `a + b kati hunchha?` 22/30, `a+b kati hunxa?` 7/30, `a+b=?` 1/30: the skill was tied to
# the spaced training shape. Operators lose their spaces, the question becomes `a+b=?`, `a + b = ?`, `a+b`, `a+b kati?`.
BARE_Q = re.compile(r'^\s*(-?\d+(?:\.\d+)?(?:\s*[-+x*/]\s*-?\d+(?:\.\d+)?)+)\s*(?:kati(?: hunchha| ho| hunxa| aauchha)?|=\s*\?)?\s*\??\s*$')


def math_surface(seg, R):
    m = BARE_Q.match(seg)
    if m and R.random() < 0.6:
        e = m.group(1)
        tight = re.sub(r'\s*([-+x*/])\s*', r'\1', e)
        return R.choice([f'{tight}=?', f'{e} = ?', tight, f'{tight} kati?', f'{tight} kati hunxa?', f'{e}=?', f'{tight} = ?'])
    if R.random() < 0.5:
        return re.sub(r'(\d) ([-+x*/]) (?=-?\d)', r'\1\2', seg)
    return seg


def _outside_quotes(text, fn):
    parts = re.split(r'("[^"]*")', text)
    return ''.join(p if p.startswith('"') else fn(p) for p in parts)


def augment(text, R, strength=0.7):
    if R.random() > strength:
        return text

    def fn(seg):
        for pat, alts in SWAPS:
            if R.random() < 0.8:
                seg = re.sub(pat, lambda m: R.choice(alts), seg)
        if R.random() < 0.3:
            for pat, alts in CASUAL:
                seg = re.sub(pat, lambda m: R.choice(alts), seg)
        elif xa_all:
            for pat, rep in XA:
                seg = re.sub(pat, rep, seg)
        return math_surface(seg, R) if mathy else seg
    xa_all = R.random() < 0.3
    mathy = R.random() < 0.35
    t = _outside_quotes(text, fn)
    if R.random() < 0.15:
        t = t.replace('"', '')                        # people often skip quotes
    if R.random() < 0.25 and not t.rstrip().endswith('=?') and not t.rstrip().endswith('= ?'):
        t = t.rstrip('?.!')
    if R.random() < 0.15:
        t = t[:1].upper() + t[1:]
    t = R.choice(PREFIX) + t
    if not t.rstrip().endswith('"') and not re.search(r'=\s*\??\s*$', t):
        m = re.match(r'(.*?)([?.!]*)$', t, re.S)
        t = m.group(1) + R.choice(SUFFIX) + m.group(2)
    return re.sub(r'\s+', ' ', t).strip()


def augment_example(ex, R, strength=0.7):
    for m in ex['messages']:
        if m['role'] == 'user':
            m['content'] = augment(m['content'], R, strength)
    return ex
