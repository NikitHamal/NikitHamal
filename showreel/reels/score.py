"""Code-made scores for the post reels (27 s, 100 BPM): python3 score.py <slug>. Cues come from reels.json, the same file the picture reads. Every sound sits on a picture cue from film.js (frames @ 60 fps):
a brush for every enso, a temple bell when it closes, felt piano under the words, koto-like plucks per word, a glass tone per Nikit,
a small sound for each world (wind chime, moon chime, lantern bell, wood blocks, water drops, mountain wind), the pond at golden hour
turning to crickets at night, and one deep bell for the name. Sends go through a convolution reverb. Master: -14 LUFS, TP <= -1.5."""
import os, numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy.signal import butter, sosfilt, fftconvolve
import sys, json
SLUG = sys.argv[1] if len(sys.argv) > 1 else 'the-lie-of-being-yourself'
R = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reels.json')))[SLUG]
SR = 48000; FPS = 60; TOTAL = 1620; N = int(SR * TOTAL / FPS)
rng = np.random.default_rng(23)
DRY = np.zeros((N, 2)); WET = np.zeros((N, 2))
fr = lambda f: f / FPS
note = lambda n: 440 * 2 ** ((n - 69) / 12)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'highpass', fs=SR, output='sos'), x)
def env(n, a, d, k=4.0): t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-k * np.maximum(0, t - a) / max(d, 1e-4))
def add(sig, t, g=1.0, pan=0.0, wet=0.3):
    i = int(round(t * SR)); j = min(N, i + len(sig))
    if i >= N or j <= max(i, 0): return
    s = sig[max(0, -i): j - i] * g; i = max(i, 0); l, r = np.sqrt(0.5 * (1 - pan)) * 1.414, np.sqrt(0.5 * (1 + pan)) * 1.414
    DRY[i:j, 0] += s * l * (1 - wet * 0.5); DRY[i:j, 1] += s * r * (1 - wet * 0.5); WET[i:j, 0] += s * l * wet; WET[i:j, 1] += s * r * wet

# ---- voices
def piano(freqs, dur=3.0, vel=1.0, bright=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; x = np.zeros(n)
    for fq in freqs:
        for k, a in ((1, 1), (2, .4), (3, .18), (4, .08), (5, .04)): x += a * np.sin(2 * np.pi * fq * k * t * (1 + 0.0003 * k * k)) * np.exp(-t * (0.9 + k * 0.9))
    hammer = hp(rng.standard_normal(n), 1500) * env(n, 0.001, 0.01, 6) * 0.05
    return lp(x + hammer, 1400 + 1800 * bright) * np.minimum(1, t / 0.006) * vel
def koto(freq, dur=1.6, bright=0.6):   # Karplus-Strong pluck
    n = int(dur * SR); p = max(2, int(SR / freq)); buf = rng.uniform(-1, 1, p) * np.hanning(p) ** 0.3; out = np.zeros(n); damp = 0.996 - 0.004 * (1 - bright)
    for i in range(n): v = buf[i % p]; out[i] = v; buf[i % p] = damp * 0.5 * (v + buf[(i + 1) % p])
    return lp(out, 2500 + 3000 * bright) * np.minimum(1, np.arange(n) / SR / 0.002)
def bell(freqs, dur=3.0, decay=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; x = np.zeros(n)
    for fq in freqs:
        for k, (m, a) in enumerate(((0.5, 0.4), (1, 1), (2.0, 0.5), (2.76, 0.35), (5.4, 0.12), (8.9, 0.05))): x += a * np.sin(2 * np.pi * fq * m * t + k) * np.exp(-t * (0.6 + k * 0.9) / decay)
    return x * np.minimum(1, t / 0.003)
def glass(freq, dur=2.4): n = int(dur * SR); t = np.arange(n) / SR; return (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 2.01 * t) * np.exp(-t * 2)) * env(n, 0.02, dur * 0.5, 3)
def pad(freqs, dur, bright=0.4):
    n = int(dur * SR); t = np.arange(n) / SR; x = np.zeros(n)
    for fq in freqs:
        for det in (-0.003, 0.0, 0.004): x += np.sin(2 * np.pi * fq * (1 + det) * t + rng.uniform(0, 6)) + 0.25 * np.sin(4 * np.pi * fq * (1 + det) * t)
    a = np.minimum(1, t / min(1.5, dur / 3)) * np.minimum(1, (dur - t) / min(1.5, dur / 3)); return lp(x, 600 + 1400 * bright) * a / max(1, len(freqs))
def brush(dur, g=1.0):   # a brush stroke on paper: band noise with a slow swell and grain
    n = int(dur * SR); t = np.linspace(0, 1, n); x = bp(rng.standard_normal(n), 400, 3200) * (np.sin(np.pi * t) ** 0.7) * (0.7 + 0.3 * np.sin(t * 40 + rng.uniform(0, 6)))
    return x * g
def pen(dur):
    n = int(dur * SR); x = bp(rng.standard_normal(n), 2000, 7000); g = np.zeros(n); i = 0
    while i < n: L = int(SR * rng.uniform(0.02, 0.08)); g[i:i + L] = np.hanning(min(L, n - i)) * rng.uniform(0.5, 1); i += L + int(SR * rng.uniform(0.004, 0.02))
    return x * g
def nib(): n = int(0.05 * SR); t = np.arange(n) / SR; return hp(rng.standard_normal(n), 1800) * env(n, 0.0005, 0.008, 6) + 0.3 * np.sin(2 * np.pi * 220 * t) * env(n, 0.001, 0.02, 5)
def air(dur, up=True):
    n = int(dur * SR); t = np.linspace(0, 1, n); x = rng.standard_normal(n + 2048); out = np.zeros(n); seg = 512
    for i in range(0, n, seg): c = 300 + 2600 * (t[i] if up else 1 - t[i]); out[i:i + seg] = bp(x[i:i + seg + 2048], c * 0.7, c * 1.4)[:len(out[i:i + seg])]
    return out * np.sin(np.pi * t) ** 1.5
def riser(dur):
    n = int(dur * SR); t = np.linspace(0, 1, n); x = rng.standard_normal(n + 2048); out = np.zeros(n); seg = 512
    for i in range(0, n, seg): c = 300 + 5000 * t[i] ** 2; out[i:i + seg] = bp(x[i:i + seg + 2048], c * 0.8, min(c * 1.25, 20000))[:len(out[i:i + seg])]
    return out * t ** 2
def tick(freq=2600): n = int(0.05 * SR); t = np.arange(n) / SR; return np.sin(2 * np.pi * freq * t) * env(n, 0.001, 0.015, 6)
def riser(dur):
    n = int(dur * SR); t = np.linspace(0, 1, n); x = rng.standard_normal(n + 2048); out = np.zeros(n); seg = 512
    for i in range(0, n, seg): c = 300 + 5000 * t[i] ** 2; out[i:i + seg] = bp(x[i:i + seg + 2048], c * 0.8, min(c * 1.25, 20000))[:len(out[i:i + seg])]
    return out * t ** 2
def tick(freq=2600): n = int(0.05 * SR); t = np.arange(n) / SR; return np.sin(2 * np.pi * freq * t) * env(n, 0.001, 0.015, 6)
def boom(): n = int(1.6 * SR); t = np.arange(n) / SR; return np.sin(2 * np.pi * np.cumsum(32 + 40 * np.exp(-t * 6)) / SR) * env(n, 0.003, 1.0, 3) + 0.25 * lp(rng.standard_normal(n), 900) * env(n, 0.002, 0.25, 5)
def shaker(): n = int(0.06 * SR); return hp(rng.standard_normal(n), 6000) * env(n, 0.004, 0.03, 5)
def crack(): n = int(0.5 * SR); return hp(rng.standard_normal(n), 1200) * env(n, 0.0005, 0.06, 6) + 0.6 * np.sin(2 * np.pi * np.cumsum(60 + 100 * np.exp(-np.arange(n) / SR * 30)) / SR) * env(n, 0.002, 0.3, 4)
def saw(freqs, dur): n = int(dur * SR); t = np.arange(n) / SR; x = sum(2 * ((fq * t) % 1) - 1 for fq in freqs) / len(freqs); return lp(x, 900) * np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.4)
def thump(): n = int(0.5 * SR); t = np.arange(n) / SR; return np.sin(2 * np.pi * np.cumsum(42 + 30 * np.exp(-t * 20)) / SR) * env(n, 0.004, 0.25, 4)
def wood(freq=900): n = int(0.12 * SR); t = np.arange(n) / SR; return (np.sin(2 * np.pi * freq * t) + 0.5 * np.sin(2 * np.pi * freq * 2.7 * t)) * env(n, 0.0008, 0.03, 6)
def drop(freq): n = int(0.25 * SR); t = np.arange(n) / SR; fq = freq * (1 + 1.2 * np.exp(-t * 40)); return np.sin(2 * np.pi * np.cumsum(fq) / SR) * env(n, 0.001, 0.07, 5)
def chime(base=88, k=6, spread=0.5):
    out = np.zeros(int(2.5 * SR))
    for i in range(k): s = bell([note(base + rng.choice([0, 2, 4, 7, 9, 12]))], 1.6, 0.5) * 0.3; o = int(rng.uniform(0, spread) * SR); out[o:o + len(s)] += s[:len(out) - o]
    return out
def crickets(dur):
    n = int(dur * SR); t = np.arange(n) / SR; x = np.zeros(n)
    for fq, rate, ph in ((4300, 18, 0), (4700, 21, 1.3), (5200, 16, 2.1)): gate = (np.sin(2 * np.pi * rate * t + ph) > 0.6) * (np.sin(2 * np.pi * 0.7 * t + ph) > -0.2); x += np.sin(2 * np.pi * fq * t) * lp(gate.astype(float), 200)
    return x * 0.3
def water(dur): n = int(dur * SR); return lp(rng.standard_normal(n), 700) * 0.6 + bp(rng.standard_normal(n), 2000, 5000) * 0.06

# ----# ---- the arrangement, built from reels.json
BEAT, END = 36, 1404
K = R['key']; MAJ = [(K, K + 4, K + 7, K + 11), (K - 3, K + 4, K + 7, K + 12), (K - 7, K, K + 4, K + 9), (K - 5, K + 2, K + 7, K + 11)]
DRK = [(K - 3, K, K + 4, K + 7), (K - 7, K - 3, K, K + 4)]
n_all = int(fr(TOTAL) * SR); tt = np.arange(n_all) / SR
SIL = []   # windows where everything but the room drops out
for b in R['beats']:
    if b['kind'] == 'swaps':
        seg = (b['to'] - b['from']) / len(b['swaps'])
        for i, (lead, a, bb) in enumerate(b['swaps']):
            if not bb: SIL.append((b['from'] + i * seg + 64, b['from'] + (i + 1) * seg))
gate = np.ones(n_all)
for a0, a1 in SIL:
    i0, i1 = int(fr(a0) * SR), int(fr(a1) * SR); gate[i0 - int(0.3 * SR):i0] = np.linspace(1, 0.04, int(0.3 * SR)); gate[i0:i1] = 0.04; gate[i1:i1 + int(0.4 * SR)] = np.linspace(0.04, 1, int(0.4 * SR))
bed = pad([note(K - 24), note(K - 17), note(K - 12)], fr(TOTAL)) * np.minimum(1, tt / 1.0) * np.minimum(1, (fr(TOTAL) - tt) / 1.5)
add(bed * gate, 0, 0.2, 0, 0.2)
def words(L, f0, base, g=0.1):
    sc = [0, 2, 4, 7, 9, 12, 14]
    for i, w in enumerate(L['t'].split(' ')): add(koto(note(base + sc[i % 7] + 12), 1.4, 0.5), fr(f0 + L['at'] + i * L['step']), g, (-0.25 + 0.5 * (i % 2)), 0.45)
for bi, b in enumerate(R['beats']):
    s, e, dark = b['from'], b['to'], b['mode'] == 'dark'
    silent = lambda f: any(a0 <= f < a1 for a0, a1 in SIL)
    if dark:
        if s > 0: add(riser(0.9), fr(s) - 0.9, 0.22, 0, 0.3)
        add(boom(), fr(s), 0.5, 0, 0.15); ch = DRK[bi % 2]; add(pad([note(n) for n in ch], fr(e - s), 0.25), fr(s), 0.2, 0, 0.5); add(piano([note(ch[0] - 12), note(ch[0])], 3.0, 0.9, 0.4), fr(s), 0.24, 0, 0.4)
        for f in range(s + BEAT, e - 8, BEAT): add(thump(), fr(f), 0.2, 0, 0.1)
    else:
        for k, f in enumerate(range(s, e - 30, BEAT * 4)): ch = MAJ[(bi + k) % 4]; add(piano([note(n) for n in ch], 3.4, 0.7, 0.55), fr(f + 2), 0.22, 0, 0.45)
        for f in range(s, e - 8, BEAT // 2):
            if not silent(f): add(shaker(), fr(f), 0.05 if (f - s) % BEAT else 0.08, 0.3 if (f // 18) % 2 else -0.3, 0.1)
        for f in range(s, e - 8, BEAT * 2):
            if not silent(f): add(thump(), fr(f), 0.14, 0, 0.1)
    if b['mode'] == 'pond':
        pw = water(fr(e - s)); pw *= np.minimum(1, np.arange(len(pw)) / SR / 0.4) * np.minimum(1, (len(pw) - np.arange(len(pw))) / SR / 0.4); add(pw, fr(s), 0.2, 0, 0.1)
        if b.get('clip') == 'night': cr = crickets(fr(e - s)); add(cr * np.minimum(1, np.arange(len(cr)) / SR / 0.5), fr(s), 0.04, 0.3, 0.3)
    for L in b['lines']:
        words(L, s, K - 3 if dark else K, 0.11 if L['size'] < 100 else 0.14)
        if L['size'] >= 110: add(piano([note(K - 12), note(K + 7)], 2.4, 1.0, 0.4), fr(s + L['at']), 0.2, 0, 0.4)
    k = b['kind']
    if k == 'strike':
        for t0 in b['strikes']: add(brush(0.3, 1.4), fr(s + t0), 0.26, 0, 0.25)
    if k == 'dis': add(glass(note(K + 26), 2.0), fr(s + b['dis']), 0.14, 0, 0.6); add(tick(1800), fr(s + b['dis'] + 4), 0.1)
    if k == 'center':
        for j in range(4): add(glass(note(K + 24 + j * 3), 2.0), fr(s + 40 + j * 12), 0.06, 0, 0.7)
    if k == 'again':
        for j in range(len(b['lines'][0]['t'].split(' '))): add(tick(2400 + j * 120), fr(s + b['again'] + j * 6), 0.07)
    if k == 'dog':
        for f in range(s + 10, s + b['stop'], 9):
            sp = min(1, (f - s) / 140) * (1 if f < s + b['stop'] - 60 else max(0.1, (s + b['stop'] - f) / 60))
            if rng.random() < 0.5 + sp * 0.5: add(wood(1400 + rng.uniform(-100, 100)), fr(f), 0.05 * max(0.3, sp), rng.uniform(-0.4, 0.4), 0.2)
        add(bell([note(K + 24)], 2.0, 0.8), fr(s + b['stop'] + 4), 0.16, 0, 0.6)
    if k == 'wake': add(air(0.8), fr(s + b['open']) - 0.4, 0.2, 0, 0.3); add(bell([note(K + 24), note(K + 31)], 3.0, 0.8), fr(s + b['open']), 0.24, 0, 0.6); add(piano([note(n) for n in MAJ[0]], 4.0, 0.9, 0.8), fr(s + b['open'] + 4), 0.26, 0, 0.5)
    if k == 'brackets': add(wood(600), fr(s + b['lock']), 0.25, -0.3, 0.3); add(wood(600), fr(s + b['lock'] + 6), 0.25, 0.3, 0.3)
    if k == 'un': add(air(0.5), fr(s + b['un']), 0.15, -0.3, 0.3); add(bell([note(K + 19)], 2.5, 0.8), fr(s + b['un'] + 26), 0.16, 0, 0.6)
    if k == 'breaks':
        add(crack(), fr(s + b['crack']), 0.4, 0, 0.3)
        for j in range(7): add(glass(note(K + 31 - j * 2), 0.6), fr(s + b['crack'] + 10 + j * 5), 0.05, rng.uniform(-0.5, 0.5), 0.5)
    if k == 'wind': add(air(2.2, False), fr(s + b['blow']) - 0.2, 0.32, 0.3, 0.4)
    if k == 'couplets':
        seg = (e - s) / len(b['pairs'])
        for j in range(len(b['pairs'])): f0 = s + j * seg; add(piano([note(K + [14, 12, 10][j % 3])], 2.2, 1.0), fr(f0 + 4), 0.22); add(piano([note(K + [19, 17, 14][j % 3])], 2.2, 0.8), fr(f0 + 44), 0.18); add(bell([note(K + [31, 29, 26][j % 3])], 1.2), fr(f0 + 50), 0.05)
    if k == 'drops':
        for j in range(30): add(drop(note(rng.choice([K + 36, K + 38, K + 41, K + 43, K + 45]))), fr(s + b['fall'] + j * 4.5 + rng.uniform(0, 3)), 0.07, rng.uniform(-0.7, 0.7), 0.6)
    if k == 'gather': add(riser(1.2), fr(s + b['gather']), 0.25, 0, 0.3); add(bell([note(K), note(K + 12)], 4.5, 1.4), fr(s + b['gather'] + 70), 0.3, 0, 0.55); add(drop(note(K + 24)), fr(s + b['gather'] + 66), 0.2, 0, 0.6)
    if k == 'swaps':
        seg = (e - s) / len(b['swaps'])
        for j, (lead, a, bb) in enumerate(b['swaps']):
            f0 = s + j * seg; words({'t': lead, 'at': 4, 'step': 7}, f0, K - 2, 0.08); add(air(0.6), fr(f0 + 60) - 0.2, 0.16, 0, 0.3)
            if a == 'gold': add(bell([note(K + 28)], 1.4, 0.6), fr(f0 + 12), 0.12, 0, 0.5); add(boom(), fr(f0 + 66), 0.35, 0, 0.1)
            elif a == 'tears': add(drop(note(K + 33)), fr(f0 + 16), 0.12, 0, 0.6); [add(koto(note(K + 24 + q * 3), 0.8, 0.8), fr(f0 + 66 + q * 5), 0.1, -0.3 + q * 0.2) for q in range(4)]
            elif a == 'humility': add(saw([note(K - 12), note(K - 5), note(K)], 2.0), fr(f0 + 60), 0.22, 0, 0.4)
            elif a == 'worship': add(bell([note(K - 12)], 1.0, 0.4), fr(f0 + 10), 0.1, 0, 0.5)
    if k == 'scene':     # the pixel window boots: a soft chime, then the scene's own air
        add(chime(K + 24, 5, 0.4), fr(s + 4), 0.12, 0.2, 0.6); add(bell([note(K + 19)], 2.4, 0.9), fr(s + 28), 0.1, -0.2, 0.6)
        amb = water(fr(e - s)) if R.get('sceneAmb') == 'water' else air(fr(e - s), True) * 0.5
        amb = amb * np.minimum(1, np.arange(len(amb)) / SR / 0.5) * np.minimum(1, (len(amb) - np.arange(len(amb))) / SR / 0.5); add(amb, fr(s), 0.08, 0, 0.3)
    if k == 'zoom':      # the word comes through the lens: air rising into it, a bell when it settles
        z = s + b.get('zat', 0); add(air(0.7, True), fr(z) - 0.1, 0.22, 0, 0.3); add(bell([note(K + 24), note(K + 31)], 3.0, 1.0), fr(z + 40), 0.2, 0, 0.6); add(thump(), fr(z + 40), 0.25, 0, 0.1)
    if k == 'type':      # one soft key per character
        for L in b['lines']:
            for j in range(len(L['t'])):
                if L['t'][j] != ' ': add(tick(3200 + (j % 5) * 140), fr(s + L['at'] + j * L.get('rate', 2)), 0.035, rng.uniform(-0.3, 0.3), 0.05)
# the end: one bell and the chord resolving under the title, nibs for the address
add(riser(0.8), fr(END) - 0.8, 0.18, 0, 0.3); add(bell([note(K - 12), note(K)], 5.0, 1.6), fr(END), 0.42, 0, 0.55); add(piano([note(n) for n in (K - 12, K, K + 7, K + 12, K + 16)], 5.0, 0.8, 0.5), fr(END), 0.28, 0, 0.55)
for j in range(len(R['title'].split(' '))): add(koto(note(K + [7, 9, 12, 14, 16, 19][j % 6] + 12), 1.6, 0.5), fr(END + 16 + j * 5), 0.1, 0, 0.5)
for j in range(30): add(nib(), fr(END + 70 + j * 0.9), 0.06, 0.1, 0.1)
add(bell([note(K + 36)], 1.0, 0.5), fr(END + 170) + 0.03, 0.08, -0.2, 0.5)

# ---- reverb (stereo convolution with decaying noise) and master
L = int(3.2 * SR); t = np.arange(L) / SR; ir = np.stack([lp(rng.standard_normal(L), 6000) * np.exp(-t * 2.2), lp(rng.standard_normal(L), 6000) * np.exp(-t * 2.2)], 1); ir[: int(0.012 * SR)] = 0; ir /= np.sqrt((ir ** 2).sum(0))
rev = np.stack([fftconvolve(WET[:, k], ir[:, k])[:N] for k in range(2)], 1) * 0.9
mix_ = DRY + rev; mix_ = np.tanh(mix_ * 1.05) / 1.05
meter = pyln.Meter(SR); mix_ = pyln.normalize.loudness(mix_, meter.integrated_loudness(mix_), -14.0)
lim = 10 ** (-1.8 / 20)
if np.max(np.abs(mix_)) > lim: mix_ = np.tanh(mix_ / lim * 0.98) * lim
g = -14.0 - meter.integrated_loudness(mix_); mix_ *= min(10 ** (g / 20), lim / np.max(np.abs(mix_)) * 0.97)
fade = int(1.0 * SR); mix_[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(out, exist_ok=True)
sf.write(os.path.join(out, SLUG + '_raw.wav'), mix_.astype(np.float32), SR, subtype='PCM_24')
print('LUFS', round(meter.integrated_loudness(mix_), 2), 'peak dBFS', round(20 * np.log10(np.max(np.abs(mix_))), 2), 'len', len(mix_) / SR)
