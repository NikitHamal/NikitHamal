"""Nepali phonemes for NikTTS v2.

Romanized text loses distinctions Nepali speakers make (त/ट, द/ड, अ/आ, ...), which is
what made v1 sound generic. v2 trains on phonemes derived from the *Devanagari*
transcripts (exact), and at inference maps Nik's romanized words to phonemes
through a lexicon built with Nik's own romanizer (exact for ~60k common words),
with a rule fallback for the rest. Mirrored in nik/web/tts.js.

Inventory (ASCII tokens):
  vowels   a(अ, schwa)  aa(आ)  i  u  e  o  ai  au   + nasalisation "~"
  stops    k kh g gh | c ch j jh | T Th D Dh (retroflex) | t th d dh (dental) | p ph b bh
  others   ng ny N(ण) n m  y r l w  s(श/ष/स)  h
"""
import re
import unicodedata

VOWELS = ['a', 'aa', 'i', 'u', 'e', 'o', 'ai', 'au']
CONS = ['k', 'kh', 'g', 'gh', 'ng', 'c', 'ch', 'j', 'jh', 'ny', 'T', 'Th', 'D', 'Dh', 'N',
        't', 'th', 'd', 'dh', 'n', 'p', 'ph', 'b', 'bh', 'm', 'y', 'r', 'l', 'w', 's', 'h']
PUNCT = [' ', '.', ',', '?', '!', '-']
SYMBOLS = ['<pad>', '<bos>', '<eos>', '~'] + VOWELS + CONS + PUNCT
ID = {s: i for i, s in enumerate(SYMBOLS)}

# ---------------------------------------------------------------- Devanagari -> phonemes
DCONS = {'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng', 'च': 'c', 'छ': 'ch', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
         'ट': 'T', 'ठ': 'Th', 'ड': 'D', 'ढ': 'Dh', 'ण': 'N', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
         'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'w',
         'श': 's', 'ष': 's', 'स': 's', 'ह': 'h', 'ळ': 'l'}
NUKTA = {'ड़': 'D', 'ढ़': 'Dh', 'फ़': 'ph', 'ज़': 'j', 'क़': 'k', 'ख़': 'kh', 'ग़': 'g'}
DVOW = {'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au'}
MATRA = {'ा': 'aa', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au'}
VIRAMA = '्'


def _expand(v):
    return ['r', 'i'] if v == 'ri' else [v]


def deva_word(w: str) -> list:
    """One Devanagari word -> phoneme list, with Nepali word-final schwa deletion."""
    w = unicodedata.normalize('NFC', w)
    units = []                      # [cons or None, vowel list, inherent?]
    i = 0
    while i < len(w):
        ch = w[i]
        nx = w[i + 1] if i + 1 < len(w) else ''
        if ch in DCONS or (ch + nx) in NUKTA:
            if nx == '़':
                c = NUKTA.get(ch + nx, DCONS.get(ch)); i += 2
            else:
                c = DCONS[ch]; i += 1
            if i < len(w) and w[i] == VIRAMA:
                units.append([c, [], False]); i += 1
            elif i < len(w) and w[i] in MATRA:
                units.append([c, _expand(MATRA[w[i]]), False]); i += 1
            else:
                units.append([c, ['a'], True])
        elif ch in DVOW:
            units.append([None, _expand(DVOW[ch]), False]); i += 1
        elif ch in 'ंँ':
            if units:
                units[-1][1] = units[-1][1] + ['~']
            i += 1
        elif ch == 'ः':
            if units:
                units[-1][1] = units[-1][1] + ['h']
            i += 1
        else:
            i += 1
    # schwa deletion: drop word-final inherent 'a' unless the word is one syllable
    # or the final consonant closes a cluster (e.g. धर्म dharma)
    if units and units[0][0] == 'w':           # word-initial व is /b/ in Nepali (विकास bikaas)
        units[0][0] = 'b'
    if len(units) >= 2 and units[-1][2] and not (units[-2][1] == [] and units[-2][0]) and units[-1][0] != 'y':
        units[-1][1] = []
    # medial schwa deletion (V C a C V -> V C C V): नेपालको nepaalko, राजधानी raajdhaani
    for j in range(1, len(units) - 1):
        cur, prv, nxt = units[j], units[j - 1], units[j + 1]
        if cur[2] and cur[1] == ['a'] and prv[1] and prv[1] != [] and nxt[0] and nxt[1] and not (j >= 2 and units[j - 1][2] and units[j - 1][1] == []):
            if prv[1][-1] != '~':
                cur[1] = []
                cur[2] = False
    out = []
    for c, v, _ in units:
        if c:
            out.append(c)
        out.extend(v)
    return out


DIGITS = {chr(0x0966 + i): str(i) for i in range(10)}


def deva_text(text: str) -> list:
    """Devanagari sentence -> phoneme tokens (numbers via spoken words)."""
    from text import number_words
    text = ''.join(DIGITS.get(c, c) for c in text).replace('।', '.')
    toks = []
    for m in re.finditer(r'[ऀ-ॿ]+|\d+|[.,?!-]', text):
        t = m.group(0)
        if t.isdigit():
            for wd in number_words(int(t[:12])).split():
                toks += roman_word(wd) + [' ']
            continue
        if t in '.,?!-':
            if toks and toks[-1] == ' ':
                toks.pop()
            toks += [t, ' ']
            continue
        toks += deva_word(t) + [' ']
    while toks and toks[-1] == ' ':
        toks.pop()
    return toks


# ---------------------------------------------------------------- romanized -> phonemes (fallback rules)
R_CONS = [('chh', 'ch'), ('ch', 'c'), ('kh', 'kh'), ('gh', 'gh'), ('jh', 'jh'), ('th', 'th'), ('dh', 'dh'), ('ph', 'ph'),
          ('bh', 'bh'), ('sh', 's'), ('ng', 'ng'), ('gy', 'g'), ('ksh', 'k'), ('k', 'k'), ('g', 'g'), ('c', 'c'), ('j', 'j'),
          ('t', 't'), ('d', 'd'), ('n', 'n'), ('p', 'p'), ('f', 'ph'), ('b', 'b'), ('v', 'bh'), ('m', 'm'), ('y', 'y'), ('r', 'r'),
          ('l', 'l'), ('w', 'w'), ('s', 's'), ('h', 'h'), ('q', 'k'), ('x', 'ch'), ('z', 'j')]
R_VOW = [('aa', 'aa'), ('ai', 'ai'), ('au', 'au'), ('ee', 'i'), ('oo', 'u'), ('a', 'a'), ('i', 'i'), ('u', 'u'), ('e', 'e'), ('o', 'o')]


def roman_rules(w: str) -> list:
    out, i = [], 0
    while i < len(w):
        for src, ph in R_VOW + R_CONS:
            if w.startswith(src, i):
                if src == 'ksh':
                    out += ['k', 's']
                elif src == 'gy':
                    out += ['g', 'y']
                else:
                    out.append(ph)
                i += len(src)
                break
        else:
            i += 1
    # casual romanization writes आ as "a": a word-final or stressed-open "a" after a consonant is usually aa
    n_vowels = sum(1 for p in out if p in VOWELS)
    if n_vowels >= 2 and len(out) >= 2 and out[-1] == 'a' and out[-2] in CONS:
        out[-1] = 'aa'
    return out


LEX = {}                             # romanized word -> phoneme list (loaded from lexicon file)


def load_lexicon(path):
    import json
    LEX.update({k: v.split() for k, v in json.load(open(path)).items()})


def roman_word(w: str) -> list:
    return LEX.get(w) or roman_rules(w)


def roman_text(text: str) -> list:
    """Nik's romanized output -> phoneme tokens (used at inference / in the browser)."""
    from text import normalize
    t = normalize(text)
    toks = []
    for m in re.finditer(r"[a-z']+|[.,?!\-]", t):
        s = m.group(0)
        if s in '.,?!-':
            if toks and toks[-1] == ' ':
                toks.pop()
            toks += [s, ' ']
        else:
            w = s.replace("'", '')
            sent_start = not toks or toks[-2:-1] in (['.'], ['?'], ['!'], [','])
            if w == 'ma':                 # म (I) vs मा (in): both are written "ma" in romanized Nepali
                toks += (['m', 'a'] if sent_start else ['m', 'aa']) + [' ']
                continue
            toks += roman_word(w) + [' ']
    while toks and toks[-1] == ' ':
        toks.pop()
    return toks


def encode_phones(toks: list) -> list:
    return [ID['<bos>']] + [ID[t] for t in toks if t in ID] + [ID['<eos>']]


if __name__ == '__main__':
    import sys, os
    sys.path.insert(0, os.path.dirname(__file__))
    for s in ['नमस्ते, म निक हुँ।', 'काठमाडौं नेपालको राजधानी हो।', 'धर्म र कर्म', 'मलाई कम काम छ।']:
        print(s, '->', ' '.join(deva_text(s)))
    for s in ['namaste! ma nik hu.', 'kathmandu nepalko rajdhani ho.']:
        print(s, '->', ' '.join(roman_text(s)))
