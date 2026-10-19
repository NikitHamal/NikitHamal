"""Devanagari Nepali -> casual romanized Nepali (the way people actually type).

    nepal ko rajdhani kathmandu ho.   (not: nepaala ko raajadhaanii ...)

Two layers:
  1. a lexicon (word -> roman) built from syubraj/roman2nepali-transliteration
     (2.4M inflected forms) plus a hand-curated table of the most common words;
  2. a rule engine for everything else: casual vowel folding (aa->a, ii->i),
     inherent-schwa deletion (word-final and medial V C a C V), conjunct rules,
     and casual consonant choices (छ->chh, व->b/w, फ->ph, क्ष->ksh, ज्ञ->gya).

Usage:
    from romanize import Romanizer
    r = Romanizer.load()            # optional lexicon path
    r("नेपालको राजधानी काठमाडौं हो।")  -> "nepalko rajdhani kathmandu ho."
"""
from __future__ import annotations
import json, os, re, unicodedata

VIRAMA = '्'
NUKTA = '़'
CONS = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'w', 'श': 'sh',
    'ष': 'sh', 'स': 's', 'ह': 'h', 'ळ': 'l',
    'क़': 'q', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'ड़': 'd', 'ढ़': 'dh', 'फ़': 'f', 'य़': 'y',
}
VOWELS = {'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ऋ': 'ri',
          'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऍ': 'e', 'ऑ': 'o'}
MATRAS = {'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri',
          'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॅ': 'e', 'ॉ': 'o'}
SIGNS = {'ं': 'n', 'ँ': 'n', 'ः': 'h', 'ऽ': ''}
DIGITS = {chr(0x0966 + i): str(i) for i in range(10)}
PUNCT = {'।': '.', '॥': '.', '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-'}

# Conjunct spellings people actually type.
CONJ = {('क', 'ष'): 'ksh', ('ज', 'ञ'): 'gy', ('त', 'र'): 'tr', ('श', 'र'): 'shr', ('द', 'य'): 'dy'}

# Most frequent words, hand-checked casual spellings (lexicon override).
COMMON = {
    'छ': 'chha', 'छन्': 'chhan', 'छु': 'chhu', 'छौं': 'chhau', 'छौँ': 'chhau', 'छैन': 'chhaina', 'छस्': 'chhas',
    'हो': 'ho', 'होइन': 'hoina', 'हुन्': 'hun', 'हुन': 'huna', 'थियो': 'thiyo', 'थिए': 'thie', 'थिएँ': 'thiye',
    'म': 'ma', 'मेरो': 'mero', 'मलाई': 'malai', 'हामी': 'hami', 'हाम्रो': 'hamro', 'तिमी': 'timi', 'तिम्रो': 'timro',
    'तपाईं': 'tapai', 'तपाईँ': 'tapai', 'तपाई': 'tapai', 'तपाईंको': 'tapaiko', 'तपाईँको': 'tapaiko', 'तपाईंलाई': 'tapailai',
    'उ': 'u', 'उनी': 'uni', 'उनको': 'unko', 'उहाँ': 'uha', 'उहाँको': 'uhako', 'यो': 'yo', 'त्यो': 'tyo', 'यी': 'yi', 'ती': 'ti',
    'के': 'ke', 'को': 'ko', 'कि': 'ki', 'की': 'ki', 'का': 'ka', 'र': 'ra', 'वा': 'wa', 'पनि': 'pani', 'नै': 'nai',
    'मा': 'ma', 'ले': 'le', 'लाई': 'lai', 'बाट': 'bata', 'सँग': 'sanga', 'संग': 'sanga', 'देखि': 'dekhi', 'सम्म': 'samma',
    'कस्तो': 'kasto', 'कहाँ': 'kaha', 'किन': 'kina', 'कसरी': 'kasari', 'कति': 'kati', 'कहिले': 'kahile', 'कुन': 'kun', 'को': 'ko',
    'नेपाल': 'nepal', 'नेपाली': 'nepali', 'काठमाडौं': 'kathmandu', 'काठमाडौँ': 'kathmandu', 'नेपालको': 'nepalko',
    'धन्यवाद': 'dhanyabad', 'नमस्ते': 'namaste', 'नमस्कार': 'namaskar', 'राम्रो': 'ramro', 'ठिक': 'thik', 'ठीक': 'thik',
    'एक': 'ek', 'दुई': 'dui', 'तीन': 'tin', 'चार': 'char', 'पाँच': 'pach', 'छ': 'chha', 'सात': 'sat', 'आठ': 'aath',
    'नौ': 'nau', 'दश': 'das', 'दस': 'das', 'सय': 'saya', 'हजार': 'hajar', 'लाख': 'lakh', 'करोड': 'karod',
    'पानी': 'pani', 'खाना': 'khana', 'घर': 'ghar', 'मान्छे': 'manchhe', 'मानिस': 'manis', 'देश': 'desh', 'सरकार': 'sarkar',
    'विकास': 'bikas', 'विश्व': 'bishwa', 'विद्यालय': 'bidyalaya', 'विषय': 'bishaya', 'विभिन्न': 'bibhinna', 'विशेष': 'bishesh',
    'श्री': 'shree', 'ज्ञान': 'gyan', 'क्षेत्र': 'kshetra', 'प्रदेश': 'pradesh', 'जिल्ला': 'jilla', 'गाउँ': 'gau', 'शहर': 'shahar',
    'सहर': 'sahar', 'बिहान': 'bihana', 'बेलुका': 'beluka', 'आज': 'aaja', 'भोलि': 'bholi', 'हिजो': 'hijo', 'अहिले': 'ahile',
    'समय': 'samaya', 'दिन': 'din', 'रात': 'raat', 'वर्ष': 'barsha', 'साल': 'saal', 'महिना': 'mahina', 'हप्ता': 'hapta',
    'गर्नु': 'garnu', 'गर्छ': 'garchha', 'गर्छु': 'garchhu', 'गर्छन्': 'garchhan', 'गरेको': 'gareko', 'गरे': 'gare', 'गर्ने': 'garne',
    'हुन्छ': 'hunchha', 'हुँदैन': 'hudaina', 'भयो': 'bhayo', 'भए': 'bhae', 'भएको': 'bhaeko', 'भन्ने': 'bhanne', 'भने': 'bhane',
    'जान्छु': 'janchhu', 'आउँछु': 'auchhu', 'खान्छु': 'khanchhu', 'चाहन्छु': 'chahanchhu', 'सक्छु': 'sakchhu', 'सक्नुहुन्छ': 'saknuhunchha',
    'मात्र': 'matra', 'धेरै': 'dherai', 'थोरै': 'thorai', 'सबै': 'sabai', 'अरु': 'aru', 'अरू': 'aru', 'एउटा': 'euta', 'दुईवटा': 'duiwata',
    'हुनुहुन्छ': 'hunuhunchha', 'गर्नुहुन्छ': 'garnuhunchha', 'हजुर': 'hajur', 'माया': 'maya', 'साथी': 'sathi', 'जीवन': 'jiwan',
    'प्रेम': 'prem', 'ईश्वर': 'ishwar', 'भगवान': 'bhagwan', 'मन': 'man', 'खुसी': 'khusi', 'खुशी': 'khusi', 'दुःख': 'dukha',
    'सगरमाथा': 'sagarmatha', 'हिमाल': 'himal', 'पहाड': 'pahad', 'तराई': 'tarai', 'भारत': 'bharat', 'चीन': 'chin',
}

_DEV = re.compile(r'[ऀ-ॿ]+')


def _is_cons(ch):
    return ch in CONS


def _rule(word: str) -> str:
    """Rule-based casual romanization of one Devanagari word."""
    w = unicodedata.normalize('NFC', word)
    # Fold nukta forms into precomposed keys.
    chars = []
    for ch in w:
        if ch == NUKTA and chars:
            chars[-1] = chars[-1] + NUKTA
        else:
            chars.append(ch)
    # Tokenize into syllable units: (kind, roman, has_inherent)
    units = []  # each: [roman_consonant_or_vowel, vowel or None ('a' = inherent), kind]
    i, n = 0, len(chars)
    while i < n:
        ch = chars[i]
        if ch in CONS:
            nxt = chars[i + 1] if i + 1 < n else ''
            # conjunct shortcuts
            if nxt == VIRAMA and i + 2 < n and (ch, chars[i + 2]) in CONJ:
                rom = CONJ[(ch, chars[i + 2])]
                i += 3
            else:
                rom = CONS[ch]
                i += 1
            if i < n and chars[i] == VIRAMA:
                units.append([rom, '', 'C'])          # dead consonant
                i += 1
            elif i < n and chars[i] in MATRAS:
                units.append([rom, MATRAS[chars[i]], 'C'])
                i += 1
            else:
                units.append([rom, 'a', 'Ca'])        # inherent schwa (deletable)
        elif ch in VOWELS:
            units.append([VOWELS[ch], '', 'V'])
            i += 1
        elif ch in SIGNS:
            if units:
                units[-1][1] += SIGNS[ch]
            i += 1
        elif ch in MATRAS:  # stray matra
            units.append(['', MATRAS[ch], 'V'])
            i += 1
        else:
            units.append([DIGITS.get(ch, ch), '', 'X'])
            i += 1

    # Schwa deletion: only word-final, and not after a conjunct (dharma, matra)
    # or a single-syllable word (ma, ra). Casual Nepali keeps medial schwas
    # (rahekole, laharauna), unlike Hindi.
    k = len(units)
    if k >= 2 and units[-1][2] == 'Ca':
        prev_dead = units[-2][2] == 'C' and units[-2][1] == ''
        if not prev_dead and units[-1][0] not in ('y',):
            units[-1][1] = ''
    out = ''.join(r + v for r, v, _ in units)
    # Casual spelling clean-ups.
    if out.startswith('w') and len(out) > 2 and out[1] in 'iaeu':
        out = 'b' + out[1:]           # विकास -> bikas, वर्ष -> barsha
    out = out.replace('aa', 'a').replace('ii', 'i').replace('uu', 'u').replace('ngg', 'ng')
    return out


# Postpositions/suffixes that keep their full vowel when glued to a stem.
SUFFIXES = sorted(['बाट', 'सँग', 'सँगै', 'संग', 'मात्र', 'तर्फ', 'तर्फबाट', 'भन्दा', 'सम्म', 'देखि', 'लगायत', 'लगायतका',
                   'हरू', 'हरु', 'हरूको', 'हरुको', 'हरूले', 'हरुले', 'हरूलाई', 'हरुलाई', 'हरूमा', 'हरुमा',
                   'को', 'का', 'की', 'मा', 'ले', 'लाई', 'माथि', 'भित्र', 'बीच', 'पछि', 'अघि', 'जस्ता', 'जस्तो', 'स्थित'], key=len, reverse=True)


def romanize_word(word: str, lex: dict) -> str:
    if word in lex:
        return lex[word]
    for suf in SUFFIXES:
        if word.endswith(suf) and len(word) > len(suf) + 1:
            stem = word[:-len(suf)]
            if stem[-1] == VIRAMA:
                break
            st = lex.get(stem) or _rule(stem)
            sf = lex.get(suf) or _rule(suf)
            if suf in ('बाट', 'सँग', 'संग', 'मात्र'):
                sf = {'बाट': 'bata', 'सँग': 'sanga', 'संग': 'sanga', 'मात्र': 'matra'}[suf]
            return st + sf
    return _rule(word)


class Romanizer:
    def __init__(self, lexicon: dict[str, str] | None = None):
        self.lex = dict(lexicon or {})
        self.lex.update(COMMON)
        self.cache: dict[str, str] = {}

    @classmethod
    def load(cls, path: str | None = None):
        lex = {}
        path = path or os.environ.get('NIK_LEXICON', '')
        if path and os.path.exists(path):
            with open(path, encoding='utf-8') as f:
                for line in f:
                    a, _, b = line.rstrip('\n').partition('\t')
                    if a and b:
                        lex[a] = b
        return cls(lex)

    def word(self, w: str) -> str:
        r = self.cache.get(w)
        if r is None:
            r = romanize_word(w, self.lex)
            if len(self.cache) < 2_000_000:
                self.cache[w] = r
        return r

    def __call__(self, text: str) -> str:
        text = unicodedata.normalize('NFC', text)
        for a, b in PUNCT.items():
            text = text.replace(a, b)
        text = ''.join(DIGITS.get(c, c) for c in text)
        text = _DEV.sub(lambda m: self.word(m.group(0)), text)
        text = text.replace('‍', '').replace('‌', '')
        return re.sub(r'[ \t]+', ' ', text).strip().lower()


if __name__ == '__main__':
    import sys
    r = Romanizer.load(sys.argv[1] if len(sys.argv) > 1 else None)
    for line in sys.stdin:
        print(r(line))
