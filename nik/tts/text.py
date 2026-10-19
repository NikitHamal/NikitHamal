"""NikTTS text front-end: romanized Nepali -> character ids.

The voice reads exactly what Nik writes (casual romanized Nepali), so the model
is trained on transcripts converted with Nik's own romanizer and the input
alphabet is the romanized character set. Numbers become spoken Nepali words.
Mirrored in nik/web/tts.js (keep the two in sync).
"""
import re

PAD, BOS, EOS = 0, 1, 2
CHARS = list(" abcdefghijklmnopqrstuvwxyz'.,?!-:;")
SYMBOLS = ['<pad>', '<bos>', '<eos>'] + CHARS
ID = {c: i for i, c in enumerate(SYMBOLS)}

NUM = ('shunya ek dui tin char pach chha sat aath nau das eghara bahra tera chaudha pandhra sorha satra athara unnais '
       'bis ekkais bais teis chaubis pachchis chhabbis sattais atthais unantis tis ekattis battis tettis chauntis paitis '
       'chhattis saitis athtis unanchalis chalis ekchalis bayalis trichalis chawalis paintalis chhayalis satchalis athchalis '
       'unanchas pachas ekaunna bauanna tripanna chauanna pachpanna chhapanna santaunna anthaunna unansathi sathi eksathi '
       'baisatthi trisatthi chausatthi painsatthi chhaisatthi satsatthi athsatthi unanshattari sattari ekahattar bahattar '
       'trihattar chauhattar pachahattar chhahattar sathattar athahattar unanasi asi ekasi bayasi triyasi chaurasi pachasi '
       'chhayasi sataasi athasi unannabbe nabbe ekanabbe bayanabbe triyanabbe chauranabbe panchanabbe chhayanabbe santanabbe '
       'anthanabbe unansaya').split()
assert len(NUM) == 100


def number_words(n: int) -> str:
    if n < 100:
        return NUM[n]
    out = []
    for unit, word in ((10 ** 7, 'karod'), (10 ** 5, 'lakh'), (1000, 'hajar'), (100, 'saya')):
        if n >= unit:
            q, n = divmod(n, unit)
            out.append(f'{number_words(q)} {word}')
    if n:
        out.append(NUM[n])
    return ' '.join(out)


def normalize(text: str) -> str:
    t = text.lower()
    t = re.sub(r'<\|[^|]*\|>', ' ', t)
    t = t.replace('%', ' pratishat').replace('+', ' plus ').replace('=', ' barabar ').replace('&', ' ra ')
    t = re.sub(r'(?<=\d)\s*x\s*(?=\d)', ' guna ', t)
    t = re.sub(r'(?<=\d)\s*/\s*(?=\d)', ' bhag ', t)
    t = re.sub(r'\d+', lambda m: ' ' + number_words(int(m.group(0)[:12])) + ' ', t)
    t = re.sub(r"[^a-z'.,?!\-:; ]", ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


def encode(text: str) -> list[int]:
    return [BOS] + [ID[c] for c in normalize(text) if c in ID] + [EOS]


if __name__ == '__main__':
    for s in ['namaste! ma nik ho.', '47 + 38 = 85', 'nepal ma 7 wata pradesh chhan', '2081 saal']:
        print(s, '->', normalize(s))
