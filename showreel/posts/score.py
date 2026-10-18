"""Code-made scores for the post films (13.5 s each): python3 score.py <slug>. Every sound sits on a picture cue from film.js (frames @ 60 fps):
a brush for every enso, a temple bell when it closes, felt piano under the words, koto-like plucks per word, a glass tone per Nikit,
a small sound for each world (wind chime, moon chime, lantern bell, wood blocks, water drops, mountain wind), the pond at golden hour
turning to crickets at night, and one deep bell for the name. Sends go through a convolution reverb. Master: -14 LUFS, TP <= -1.5."""
import os, numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy.signal import butter, sosfilt, fftconvolve
import sys
SLUG = sys.argv[1] if len(sys.argv) > 1 else 'the-lie-of-being-yourself'
SR = 48000; FPS = 60; TOTAL = 1440; N = int(SR * TOTAL / FPS)   # title 0-150, kinetic 150-720, excerpts 720-1140, end card 1140-1440
rng = np.random.default_rng(23)
DRY = np.zeros((N, 2)); WET = np.zeros((N, 2))
OFF = 0; fr = lambda f: (f + OFF) / FPS   # OFF shifts the kinetic scene's cues (written in scene-local frames)
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

# ----# ---- per-post cues (frames from film.js) and a key for each post
def words(f0, n, step=5, base=62, g=0.12, pan=0.0):
    sc = [0, 2, 4, 7, 9, 12, 14, 16, 19]
    for i in range(n): add(koto(note(base + sc[i % len(sc)] + 12), 1.6, 0.5), fr(f0 + i * step), g, pan + (-0.2 + 0.4 * (i % 2)), 0.5)
def typing(f0, n, rate=3):
    for k in range(n): add(nib(), fr(f0 + k * rate), 0.14, rng.uniform(-0.2, 0.2), 0.15)
KEYS = {'the-lie-of-being-yourself': 50, 'the-wrong-guy-trying-to-wake-up': 52, 'you-never-trusted-anyone-2': 47, 'where-is-god': 50, 'god-and-the-ocean': 45, 'i-offer-my-curse-to-god': 43, 'you': 50, 'perfect': 52}
R = KEYS.get(SLUG, 50)
CH = [(R, R + 7, R + 11, R + 14), (R - 3, R + 4, R + 7, R + 12), (R - 7, R, R + 4, R + 9), (R - 5, R + 2, R + 5, R + 11)]
n_all = int(fr(TOTAL) * SR); tt = np.arange(n_all) / SR
add(pad([note(R - 12), note(R - 5), note(R)], fr(TOTAL)) * np.minimum(1, tt / 1.5) * np.minimum(1, (fr(TOTAL) - tt) / 1.2), 0, 0.22, 0, 0.2)
for b in range(0, 10): add(piano([note(n) for n in CH[b % 4]], 3.4, 0.7, 0.55), fr(b * 150 + 4), 0.22, 0, 0.45); add(pad([note(n) for n in CH[b % 4][1:]], 2.8, 0.3), fr(b * 150 + 4), 0.1, 0, 0.5)
S = SLUG
# the title card: the cover art draws, a bell, a pluck per word of the title
add(brush(1.6, 0.7), fr(0), 0.12, 0, 0.3); add(bell([note(R)], 4.0, 1.2), fr(16), 0.22, 0, 0.5); words(14, 4, 5, R + 7, 0.1)
OFF = 150
if S == 'the-lie-of-being-yourself':
    typing(6, 12, 2); typing(46, 14, 2); typing(86, 24, 2)
    for f in (168, 192, 216): add(brush(0.3, 1.4), fr(f), 0.26, 0, 0.25)
    words(300, 6, 5, R + 2); words(410, 9, 5, R - 3, 0.08)
elif S == 'the-wrong-guy-trying-to-wake-up':
    words(16, 7, 5, R); words(140, 10, 5, R - 3, 0.09)
    for f in range(30, 380, 9):   # paws on the floor, quickening, then slowing to a stop
        sp = 0.5 + 0.5 * min(1, (f - 20) / 240) if f < 300 else max(0.1, 1 - (f - 300) / 80)
        if rng.random() < 0.4 + sp * 0.6: add(wood(1400 + rng.uniform(-100, 100)), fr(f), 0.05 * sp, rng.uniform(-0.4, 0.4), 0.2)
    add(air(1.2), fr(150), 0.12, 0, 0.3); add(bell([note(R + 24)], 2.0, 0.8), fr(384), 0.18, 0, 0.6)
    words(300, 3, 5, R); words(380, 5, 5, R + 4); words(460, 5, 5, R - 1, 0.09)
elif S == 'you-never-trusted-anyone-2':
    words(6, 5, 5, R); words(50, 6, 5, R - 2, 0.09); add(wood(600), fr(120), 0.25, -0.3, 0.3); add(wood(600), fr(126), 0.25, 0.3, 0.3)
    words(214, 7, 5, R); add(glass(note(R + 26), 2.4), fr(262), 0.1, 0, 0.6); add(air(0.5), fr(320), 0.15, -0.3, 0.3); add(bell([note(R + 19)], 2.5, 0.8), fr(346), 0.16, 0, 0.6)
    words(420, 5, 5, R - 3); words(470, 4, 5, R + 2)
elif S == 'where-is-god':
    words(4, 3, 6, R); add(bell([note(R)], 4.0, 1.4), fr(30), 0.25, 0, 0.5)
    for i, f in enumerate((86, 170, 254, 338)): add(piano([note(R + [14, 12, 10, 7][i])], 2.2, 1.0), fr(f), 0.22); add(piano([note(R + [19, 17, 14, 12][i])], 2.2, 0.8), fr(f + 16), 0.18); add(bell([note(R + [31, 29, 26, 24][i])], 1.2), fr(f + 22), 0.05)
    words(432, 5, 6, R + 2)
elif S == 'god-and-the-ocean':
    words(4, 6, 5, R); words(150, 8, 5, R - 3, 0.09)
    for k in range(26): add(drop(note(rng.choice([R + 36, R + 38, R + 41, R + 43, R + 45]))), fr(120 + k * 5.5 + rng.uniform(0, 3)), 0.07, rng.uniform(-0.7, 0.7), 0.6)
    words(292, 5, 5, R); words(340, 9, 5, R - 3, 0.09)
    for k in range(18): add(glass(note(rng.choice([R + 31, R + 34, R + 38, R + 41])), 0.8), fr(360 + k * 4), 0.04, rng.uniform(-0.8, 0.8), 0.6)
    add(bell([note(R)], 4.0, 1.4), fr(468), 0.22, 0, 0.5); words(500, 8, 5, R + 2)
elif S == 'i-offer-my-curse-to-god':
    for i in range(4):
        f0 = 6 + i * 104; words(f0, 6, 5, R + 2 * i, 0.09)
        add(air(0.6), fr(f0 + 50) - 0.2, 0.16, 0, 0.3)
        if i == 0: add(bell([note(R + 26)], 1.5, 0.6), fr(f0 + 12), 0.12, 0, 0.5); add(thump(), fr(f0 + 56), 0.3, 0, 0.1)
        elif i == 1: add(piano([note(R + 12), note(R + 13)], 1.6, 0.9), fr(f0 + 56), 0.18)
        elif i == 2: add(koto(note(R + 24), 1.0, 0.8), fr(f0 + 56), 0.12); add(koto(note(R + 28), 1.0, 0.8), fr(f0 + 62), 0.12)
    words(432, 6, 5, R); words(470, 8, 5, R + 2)
elif S == 'you':
    for i in range(6): f0 = 8 + i * 84; words(f0, 2, 6, R + [0, 2, 4, 7, 4, 0][i], 0.12); words(f0 + 14, 4, 5, R + [7, 9, 11, 12, 9, 7][i], 0.1)
    for i in range(6): add(glass(note(R + 24 + [0, 2, 4, 7, 4, 0][i]), 2.2), fr(8 + i * 84), 0.06, 0, 0.7)
elif S == 'perfect':
    add(brush(1.0, 0.8), fr(0), 0.15, 0, 0.3)
    for i, f in enumerate((30, 160, 290, 420)): words(f, 4, 5, R + 2 * i); add(bell([note(R + 24 + 2 * i)], 1.6, 0.7), fr(f + 4), 0.1, 0, 0.6); words(f + 18, 6, 5, R + 2 * i + 4, 0.09)
OFF = 0
# the excerpts: a soft chord as each passage begins, low plucks as it is read, a glass tone on the highlighted phrase
NEX = {'god-and-the-ocean': 1}.get(S, 2); seg = (1140 - 720) / NEX
for i in range(NEX):
    f0 = 720 + i * seg; add(piano([note(n) for n in CH[(i + 1) % 4]], 3.6, 0.6, 0.45), fr(f0 + 4), 0.2, 0, 0.5)
    words(f0 + 14, 10, 9, R - 5 + 2 * i, 0.05); add(glass(note(R + 26 + 2 * i), 2.4), fr(f0 + 80), 0.07, 0, 0.7)
# the end card: one bell and a chord for the title, nibs for the address
add(bell([note(R - 12), note(R)], 5.0, 1.6), fr(1140), 0.4, 0, 0.55); add(piano([note(n) for n in (R - 12, R, R + 7, R + 12, R + 16)], 4.0, 0.8, 0.5), fr(1140), 0.26, 0, 0.55)
for k in range(28): add(nib(), fr(1200 + k * 0.9), 0.06, 0.1, 0.1)

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
