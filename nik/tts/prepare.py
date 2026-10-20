"""Build the NikTTS training set from OpenSLR 43 (Google Nepali TTS, CC BY-SA 4.0).

Transcripts (Devanagari) are converted with Nik's own romanizer, so the voice
learns to read exactly the casual romanized Nepali that Nik writes.

    python nik/tts/prepare.py --root data_tts/ne_np_female --out data_tts/set.pt
"""
import argparse, os, sys, urllib.request, zipfile

import numpy as np
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'data'))
from audio import load_wav, mel  # noqa: E402
from text import encode, normalize  # noqa: E402
from phonemes import deva_text, encode_phones  # noqa: E402

URL = 'https://www.openslr.org/resources/43/ne_np_female.zip'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='data_tts/ne_np_female')
    ap.add_argument('--out', default='data_tts/set.pt')
    ap.add_argument('--lexicon', default='', help='romanizer lexicon tsv (optional, improves romanization)')
    ap.add_argument('--limit', type=int, default=0)
    a = ap.parse_args()
    idx = next((os.path.join(a.root, f) for f in ('line_index.tsv', 'metadata.tsv', 'metadata.csv') if os.path.exists(os.path.join(a.root, f))), None)
    if idx is None:
        base = os.path.dirname(a.root) or '.'
        os.makedirs(base, exist_ok=True)
        z = os.path.join(base, 'ne_np_female.zip')
        if not os.path.exists(z):
            print('downloading', URL, flush=True)
            urllib.request.urlretrieve(URL, z)
        zipfile.ZipFile(z).extractall(base)
        idx = os.path.join(a.root, 'line_index.tsv')
    from romanize import Romanizer
    rom = Romanizer.load(a.lexicon or None)
    rows = []
    for l in open(idx, encoding='utf-8'):
        parts = l.rstrip('\n').split('\t') if '\t' in l else l.rstrip('\n').split('|')
        if len(parts) >= 2 and parts[0] and parts[-1]:
            rows.append((os.path.splitext(os.path.basename(parts[0]))[0], parts[-1]))
    if a.limit:
        rows = rows[: a.limit]
    spk_of = lambda fn: fn.split('_')[1] if fn.count('_') >= 2 else '0'  # noqa: E731
    spk_names = sorted({spk_of(r[0]) for r in rows})
    spk_id = {s: i for i, s in enumerate(spk_names)}
    items = []
    for i, (fn, txt) in enumerate(rows):
        path = os.path.join(a.root, 'wavs', fn + '.wav')
        if not os.path.exists(path):
            continue
        w = load_wav(path)
        if len(w) < 22050 * 0.6 or len(w) > 22050 * 14:
            continue
        r = rom(txt)
        ids = encode(r)
        m = mel(torch.from_numpy(w)[None])[0]
        ph = encode_phones(deva_text(txt))        # v2: exact phonemes from the Devanagari transcript
        items.append({'ids': np.array(ids, np.int16), 'phones': np.array(ph, np.int16), 'text': normalize(r), 'mel': m.numpy().astype(np.float16),
                      'wav': (w * 32767).astype(np.int16), 'spk': spk_id[spk_of(fn)]})
        if i % 200 == 0:
            print(f'{i}/{len(rows)}  {r[:60]!r}', flush=True)
    dur = sum(len(x['wav']) for x in items) / 22050 / 3600
    counts = np.bincount([x['spk'] for x in items], minlength=len(spk_names))
    torch.save({'items': items, 'speakers': spk_names, 'counts': counts.tolist()}, a.out)
    print(f'saved {a.out}: {len(items)} utterances, {dur:.2f} h, {len(spk_names)} speakers, per-speaker {counts.tolist()}')


if __name__ == '__main__':
    main()
