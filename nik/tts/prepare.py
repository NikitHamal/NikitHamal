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

URL = 'https://www.openslr.org/resources/43/ne_np_female.zip'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='data_tts/ne_np_female')
    ap.add_argument('--out', default='data_tts/set.pt')
    ap.add_argument('--lexicon', default='', help='romanizer lexicon tsv (optional, improves romanization)')
    ap.add_argument('--limit', type=int, default=0)
    a = ap.parse_args()
    if not os.path.exists(os.path.join(a.root, 'line_index.tsv')):
        base = os.path.dirname(a.root) or '.'
        os.makedirs(base, exist_ok=True)
        z = os.path.join(base, 'ne_np_female.zip')
        if not os.path.exists(z):
            print('downloading', URL, flush=True)
            urllib.request.urlretrieve(URL, z)
        zipfile.ZipFile(z).extractall(base)
    from romanize import Romanizer
    rom = Romanizer.load(a.lexicon or None)
    rows = [l.rstrip('\n').split('\t') for l in open(os.path.join(a.root, 'line_index.tsv'), encoding='utf-8') if '\t' in l]
    if a.limit:
        rows = rows[: a.limit]
    spk_names = sorted({r[0].split('_')[1] for r in rows})
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
        items.append({'ids': np.array(ids, np.int16), 'text': normalize(r), 'mel': m.numpy().astype(np.float16),
                      'wav': (w * 32767).astype(np.int16), 'spk': spk_id[fn.split('_')[1]]})
        if i % 200 == 0:
            print(f'{i}/{len(rows)}  {r[:60]!r}', flush=True)
    dur = sum(len(x['wav']) for x in items) / 22050 / 3600
    counts = np.bincount([x['spk'] for x in items], minlength=len(spk_names))
    torch.save({'items': items, 'speakers': spk_names, 'counts': counts.tolist()}, a.out)
    print(f'saved {a.out}: {len(items)} utterances, {dur:.2f} h, {len(spk_names)} speakers, per-speaker {counts.tolist()}')


if __name__ == '__main__':
    main()
