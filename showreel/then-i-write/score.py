"""Code-made score for "then, I write." (32 s, 80 BPM, D major / B minor). Every sound sits on a picture cue from film.js (frames @ 60 fps):
a brush for every enso, a temple bell when it closes, felt piano under the words, koto-like plucks per word, a glass tone per Nikit,
a small sound for each world (wind chime, moon chime, lantern bell, wood blocks, water drops, mountain wind), the pond at golden hour
turning to crickets at night, and one deep bell for the name. Sends go through a convolution reverb. Master: -14 LUFS, TP <= -1.5."""
import os, numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy.signal import butter, sosfilt, fftconvolve
SR = 48000; FPS = 60; TOTAL = 1920; N = int(SR * TOTAL / FPS)
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

# ---- the arrangement (frames from film.js T)
T = dict(enso=(16, 104), bloom=(96, 150), wake=168, hi=60, write=236, be=372, strike=(430, 448), which=456, trio=536, met=600, how=640,
         worlds=720, isle=90, ring=(1260, 1300), pond=1280, drops=1316, night=(1400, 1440), star=1446, irisOut=(1546, 1590), ensoB=(1590, 1660), lname=1640, lsub=1676, lurl=1712, wink=1846)
BAR = 180
# bed: a drone from frame 0, felt piano one chord per bar, pad swells
add(pad([note(38), note(45), note(50)], fr(TOTAL)) * np.minimum(1, np.arange(int(fr(TOTAL) * SR)) / SR / 2.5) * np.minimum(1, (fr(TOTAL) - np.arange(int(fr(TOTAL) * SR)) / SR) / 2), 0, 0.22, 0, 0.2)
CHORDS = [(50, 57, 61, 64), (47, 54, 57, 62), (43, 50, 54, 59), (45, 52, 55, 61), (50, 57, 61, 66), (47, 54, 57, 62), (43, 50, 54, 59), (45, 50, 52, 57), (50, 57, 62, 66), (50, 57, 62, 66)]
for b in range(1, 10):
    f0 = b * BAR
    if f0 >= T['lname']: break
    if T['night'][0] <= f0 < T['irisOut'][1]: continue
    add(piano([note(n) for n in CHORDS[b]], 3.5, 0.75, 0.6), fr(f0), 0.26, 0, 0.45)
    add(pad([note(n) for n in CHORDS[b][1:]], min(3.2, fr(T['lname'] - f0)), 0.35), fr(f0), 0.12, 0, 0.5)
# act 1: the brush draws the enso; a temple bell when it closes; eyes open; words
add(brush(fr(T['enso'][1] - T['enso'][0]) + 0.2), fr(T['enso'][0]), 0.22, -0.2, 0.3)
add(bell([note(50)], 6.0, 1.6), fr(T['enso'][1]), 0.42, 0, 0.5)
add(pad([note(62), note(66), note(69), note(73)], 2.4, 0.5), fr(T['bloom'][0]), 0.14, 0, 0.6)
add(glass(note(81)), fr(T['wake']), 0.12, 0.2, 0.6)
for i, nt in enumerate([69, 71, 74]): add(koto(note(nt)), fr(T['hi'] + i * 7), 0.2, -0.2 + i * 0.2, 0.45)
add(pen(1.0), fr(T['write']), 0.16, 0.2, 0.3)
for i, nt in enumerate([74, 76, 78]): add(koto(note(nt), 2.0, 0.5), fr(T['write'] + i * 9), 0.18, 0.1, 0.5)
# act 2: be yourself / which self / how many Nikits
for k, ch in enumerate('Be yourself.'):
    if ch != ' ': add(nib(), fr(T['be'] + k * 3), 0.16, rng.uniform(-0.2, 0.2), 0.15)
add(brush(0.35, 1.4), fr(T['strike'][0]), 0.3, 0.2, 0.25)
for i, nt in enumerate([66, 64, 62, 61, 59, 57]): add(koto(note(nt + 12), 1.8, 0.45), fr(T['which'] + i * 6), 0.13, -0.3 + i * 0.12, 0.5)
for i, nt in enumerate([74, 78, 81]): add(glass(note(nt + 12), 2.6), fr(T['trio'] + i * 10 + 4), 0.13, -0.5 + i * 0.5, 0.6)
add(piano([note(62), note(69)], 3.0, 0.7), fr(T['met']), 0.22, 0, 0.5)
for i, nt in enumerate([69, 71, 74, 76, 78, 81]): add(koto(note(nt), 1.4, 0.55), fr(T['how'] + i * 5), 0.12, -0.3 + i * 0.12, 0.5)
# act 3: the worlds — a soft pulse, a phrase and a foley per island
for f in range(T['worlds'], T['ring'][0], 45): add(thump(), fr(f), 0.33 if (f - T['worlds']) % 90 == 0 else 0.18, 0, 0.1)
MOTIF = [[74, 78, 81], [76, 79, 83], [69, 74, 78], [71, 74, 79], [74, 76, 81], [69, 76, 81]]
for i in range(6):
    a = T['worlds'] + i * T['isle']
    add(air(0.7), fr(a) - 0.2, 0.2, -0.3 + i * 0.12, 0.3)
    for j, nt in enumerate(MOTIF[i]): add(koto(note(nt), 1.8, 0.55), fr(a + 6 + j * 8), 0.16, -0.2 + j * 0.2, 0.5)
    if i == 0: add(chime(91, 7, 0.9), fr(a + 10), 0.18, 0.4, 0.5)
    if i == 1: add(glass(note(93), 3.0), fr(a + 20), 0.1, -0.3, 0.7)
    if i == 2: add(bell([note(57)], 4.0, 1.0), fr(a + 8), 0.16, 0, 0.5)
    if i == 3: add(wood(820), fr(a + 10), 0.25, -0.3, 0.3); add(wood(980), fr(a + 16), 0.2, 0.3, 0.3)
    if i == 4:
        for k in range(4): add(drop(note(rng.choice([81, 84, 86, 88]))), fr(a + 10 + k * 7), 0.12, rng.uniform(-0.5, 0.5), 0.5)
    if i == 5: add(air(1.8, False), fr(a + 6), 0.22, 0.2, 0.4)
# act 4: the enso opens onto the pond; golden hour, then night
add(brush(fr(T['ring'][1] - T['ring'][0]) + 0.2), fr(T['ring'][0]), 0.22, 0.2, 0.3)
add(bell([note(45)], 5.0, 1.4), fr(T['ring'][1]), 0.32, 0, 0.5)
pw = water(fr(T['irisOut'][1] - T['pond'] + 30)); pw *= np.minimum(1, np.arange(len(pw)) / SR / 0.8) * np.minimum(1, (len(pw) - np.arange(len(pw))) / SR / 1.0); add(pw, fr(T['pond']), 0.2, 0, 0.1)
for k in range(9): add(drop(note(rng.choice([86, 88, 90, 93]))), fr(T['drops']) + k * 0.24 + rng.uniform(0, 0.08), 0.1, rng.uniform(-0.6, 0.6), 0.6)
add(piano([note(62), note(66), note(69), note(74)], 4.0, 0.7), fr(T['drops']), 0.2, 0, 0.6)
cr = crickets(fr(T['irisOut'][1] - T['night'][0])); cr *= np.minimum(1, np.arange(len(cr)) / SR / 1.0) * np.minimum(1, (len(cr) - np.arange(len(cr))) / SR / 0.8); add(cr, fr(T['night'][0]), 0.05, 0.3, 0.3)
add(pad([note(47), note(54), note(62), note(66)], fr(T['irisOut'][1] - T['night'][0]), 0.25), fr(T['night'][0]), 0.2, 0, 0.6)
add(glass(note(88), 3.0), fr(T['star']), 0.13, 0.3, 0.7); add(glass(note(93), 3.0), fr(T['star'] + 24), 0.1, -0.3, 0.7)
add(air(1.2, False), fr(T['irisOut'][0]), 0.2, 0, 0.4)
# act 5: the enso again, one deep bell for the name, the pup asleep, a last wink
add(brush(fr(T['ensoB'][1] - T['ensoB'][0]) + 0.2), fr(T['ensoB'][0]), 0.2, -0.2, 0.3)
add(bell([note(38), note(50)], 7.0, 2.0), fr(T['lname']), 0.5, 0, 0.55)
add(piano([note(n) for n in (38, 50, 57, 62, 66, 69, 73)], 6.0, 0.8, 0.5), fr(T['lname']), 0.28, 0, 0.55)
for i, nt in enumerate([78, 76, 74, 73]): add(koto(note(nt), 2.0, 0.45), fr(T['lsub'] + i * 6), 0.12, 0.2, 0.55)
for k in range(21): add(nib(), fr(T['lurl'] + k * 1.2), 0.07, 0.1, 0.1)
def snore(d=1.0): n = int(d * SR); t = np.arange(n) / SR; return lp(rng.standard_normal(n), 420) * np.sin(np.pi * t / d) ** 2 * (0.6 + 0.4 * np.sin(2 * np.pi * 26 * t))
for f in (1720, 1800): add(snore(), fr(f), 0.06, 0.4, 0.1)
add(bell([note(93)], 1.2, 0.5), fr(T['wink']) + 0.03, 0.1, -0.2, 0.5)

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
sf.write(os.path.join(out, 'soundtrack_raw.wav'), mix_.astype(np.float32), SR, subtype='PCM_24')
print('LUFS', round(meter.integrated_loudness(mix_), 2), 'peak dBFS', round(20 * np.log10(np.max(np.abs(mix_))), 2), 'len', len(mix_) / SR)
