"""Code-made score for "I write." (56 s, 80 BPM, D major / B minor). Every sound sits on a picture cue from film.js (frames @ 60 fps):
a brush for every enso, a temple bell when it closes, felt piano under the words, koto-like plucks per word, a glass tone per Nikit,
a small sound for each world (wind chime, moon chime, lantern bell, wood blocks, water drops, mountain wind), the pond at golden hour
turning to crickets at night, and one deep bell for the name. Sends go through a convolution reverb. Master: -14 LUFS, TP <= -1.5."""
import os, numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy.signal import butter, sosfilt, fftconvolve
SR = 48000; FPS = 60; TOTAL = 3360; N = int(SR * TOTAL / FPS)
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

# ----# ---- the arrangement (frames from film.js T)
T = dict(type=8, fall=(104, 150), write=150, big=(300, 350), split=(440, 490), trio=480, glance=(560, 650), met=600, many=660, trioOut=744,
         ideas=790, mirror=850, ideasOut=944, be=966, strike=(1026, 1044), which=1052, iy=1204, near=(1214, 1290), melt=(1300, 1330), love=1318,
         sf=1446, part=(1520, 1560), between=1556, un=1626, drift=(1660, 1730), pretense=1680, th=1806, echo=(1830, 1920), mind=1904, nothing=(1950, 1990),
         god=1990, scroll=(1996, 2052), neither=(2060, 2116, 2172), dream=2256, step=2340, wake=2424, finished=2436, pond=2524, drops=2570, night=(2650, 2690),
         star=2700, irisOut=(2788, 2820), take=2830, morph=(2850, 2900, 2950), takeTxt=2870, lock=3000, lname=3040, lwrite=3080, lurl=3120, wink=3290)
BAR = 180
SIL = (T['nothing'][0], T['god'] + 10)    # the one silence: "out of mind, there is nothing."
n_all = int(fr(TOTAL) * SR); tt = np.arange(n_all) / SR
drone = pad([note(38), note(45), note(50)], fr(TOTAL)) * np.minimum(1, tt / 2.5) * np.minimum(1, (fr(TOTAL) - tt) / 2)
gate = np.ones(n_all); a0, a1 = int(fr(SIL[0]) * SR), int(fr(SIL[1]) * SR); gate[a0 - int(0.8 * SR):a0] = np.linspace(1, 0.05, int(0.8 * SR)); gate[a0:a1] = 0.05; gate[a1:a1 + int(1.2 * SR)] = np.linspace(0.05, 1, int(1.2 * SR))
add(drone * gate, 0, 0.22, 0, 0.2)
CHORDS = [(50, 57, 61, 64), (47, 54, 57, 62), (43, 50, 54, 59), (45, 52, 55, 61)]
for b in range(1, TOTAL // BAR):
    f0 = b * BAR
    if f0 >= T['lname'] or (SIL[0] - 120 <= f0 < SIL[1]) or (T['pond'] <= f0 < T['irisOut'][1]): continue
    ch = CHORDS[b % 4]; add(piano([note(n) for n in ch], 3.6, 0.7, 0.55), fr(f0), 0.24, 0, 0.45); add(pad([note(n) for n in ch[1:]], 3.0, 0.3), fr(f0), 0.1, 0, 0.5)
for f in list(range(960, SIL[0] - 40, 90)) + list(range(2060, 2250, 90)): add(thump(), fr(f), 0.22, 0, 0.1)
# 1. hello -> I write -> the I -> three
for k, ch in enumerate("hi, I'm Nikit."):
    if ch != ' ': add(nib(), fr(T['type'] + k * 4), 0.16, rng.uniform(-0.2, 0.2), 0.15)
for i in range(12): add(koto(note([81, 78, 76, 74, 71, 69, 66, 64, 62, 59, 57, 54][i]), 1.2, 0.4), fr(T['fall'][0] + i * 2.5), 0.07, (-1 if i % 2 else 1) * 0.4, 0.5)
add(piano([note(62), note(69), note(74), note(78)], 3.0, 0.8), fr(T['write']), 0.26, 0, 0.5)
for k in range(6): add(nib(), fr(T['write'] + k * 4), 0.1, 0.2, 0.15)
add(air(1.0), fr(T['big'][0]) - 0.2, 0.22, 0, 0.3); add(bell([note(38)], 6.0, 1.6), fr(T['big'][1]), 0.4, 0, 0.5)
for i, nt in enumerate([74, 78, 81]): add(glass(note(nt + 12), 2.4), fr(T['split'][0] + 10 + i * 6), 0.12, -0.6 + i * 0.6, 0.6)
# 2. three ages
for i, nt in enumerate([69, 74, 78]): add(koto(note(nt)), fr(T['trio'] + i * 8 + 6), 0.18, -0.5 + i * 0.5, 0.5)
for i, f in enumerate((580, 600, 620, 650)): add(glass(note([86, 83, 88, 81][i]), 0.8), fr(f), 0.05, [-0.5, 0.5, -0.2, 0.2][i], 0.5)
add(piano([note(62), note(69)], 3.0, 0.7), fr(T['met']), 0.22, 0, 0.5)
for i, nt in enumerate([69, 71, 74, 76, 78, 81]): add(koto(note(nt), 1.4, 0.55), fr(T['many'] + i * 5), 0.12, -0.3 + i * 0.12, 0.5)
# 3. ideas, with a reflection
for i, nt in enumerate([66, 69, 74]): add(koto(note(nt + 12), 1.6, 0.5), fr(T['ideas'] + i * 8), 0.12, 0, 0.5)
add(glass(note(90), 3.0), fr(T['mirror']), 0.1, -0.3, 0.7); add(glass(note(90), 3.0), fr(T['mirror'] + 12), 0.06, 0.3, 0.9)
# 4. be yourself
for k, ch in enumerate('Be yourself.'):
    if ch != ' ': add(nib(), fr(T['be'] + k * 3), 0.16, rng.uniform(-0.2, 0.2), 0.15)
add(brush(0.35, 1.4), fr(T['strike'][0]), 0.3, 0.2, 0.25)
for i, nt in enumerate([66, 64, 62, 61, 59, 57]): add(koto(note(nt + 12), 1.8, 0.45), fr(T['which'] + i * 5), 0.13, -0.3 + i * 0.12, 0.5)
# 5. "I" and "You": two voices, one each side; they lean in; only love is left
add(piano([note(50)], 4.0, 0.9), fr(T['iy']), 0.3, -0.7, 0.4); add(piano([note(57)], 4.0, 0.9), fr(T['iy'] + 8), 0.3, 0.7, 0.4)
add(riser(fr(T['near'][1] - T['near'][0])), fr(T['near'][0]), 0.25, 0, 0.3)
add(air(0.8, False), fr(T['melt'][0]), 0.2, 0, 0.4); add(piano([note(n) for n in (50, 57, 62, 66, 69, 73)], 5.0, 0.8, 0.7), fr(T['love']), 0.3, 0, 0.55); add(bell([note(74)], 3.0, 1.0), fr(T['love']), 0.12, 0, 0.6)
# 6. selfish, or not: the halves part left and right; nothing in between
for i in range(5): add(koto(note([62, 64, 66, 69, 71][i])), fr(T['sf'] + i * 6), 0.12, -0.4, 0.4)
for i in range(4): add(koto(note([71, 69, 66, 64][i])), fr(T['sf'] + 30 + i * 6), 0.12, 0.4, 0.4)
add(air(0.6), fr(T['part'][0]), 0.15, -0.8, 0.3); add(air(0.6), fr(T['part'][0]), 0.15, 0.8, 0.3); add(glass(note(93), 2.6), fr(T['between']), 0.12, 0, 0.7)
# 7. UNITY flies apart
for i in range(5): add(koto(note([62, 66, 69, 74, 78][i]), 1.6, 0.6), fr(T['un'] + i * 4), 0.16, -0.6 + i * 0.3, 0.45)
for k in (-0.9, 0.9): add(air(1.2, False), fr(T['drift'][0]), 0.15, k, 0.4)
for i, nt in enumerate([74, 73, 71, 69]): add(koto(note(nt), 1.6, 0.4), fr(T['pretense'] + i * 5), 0.1, 0.1, 0.5)
# 8. everything is thought: the word echoes; then nothing
for k in range(5): add(bell([note(81)], 1.5, 0.6), fr(T['echo'][0] + k * 10), 0.12 * (0.7 ** k), (-1) ** k * 0.5 * k / 4, 0.7)
for i, nt in enumerate([69, 66, 64, 62]): add(koto(note(nt), 1.8, 0.4), fr(T['mind'] + i * 6), 0.1, 0, 0.5)
# 9. where is God
for f in range(T['scroll'][0], T['scroll'][1], 4): add(tick(2200 + (f - T['scroll'][0]) * 6), fr(f), 0.04)
add(bell([note(62), note(69)], 4.0, 1.2), fr(T['scroll'][1]), 0.22, 0, 0.5)
for i, f in enumerate(T['neither']): add(piano([note([64, 62, 60][i] + 12)], 2.2, 1.0), fr(f), 0.22); add(piano([note([69, 67, 64][i] + 12)], 2.2, 0.8), fr(f + 16), 0.18); add(bell([note([81, 79, 76][i])], 1.2), fr(f + 22), 0.05)
# 10. the dream, one step, waking
add(pad([note(62), note(66), note(69), note(74)], fr(T['wake'] - T['dream']), 0.2), fr(T['dream']), 0.14, 0, 0.6)
for i in range(8): add(koto(note([86, 81, 78, 74, 78, 81, 86, 90][i]), 1.6, 0.3), fr(T['dream'] + 10 + i * 18), 0.05, (-1) ** i * 0.3, 0.7)
add(wood(700), fr(T['step']), 0.3, 0, 0.3)
add(air(0.7), fr(T['wake']) - 0.35, 0.22, 0, 0.3); add(bell([note(86), note(93)], 3.0, 0.8), fr(T['wake']), 0.25, 0, 0.6); add(piano([note(n) for n in (50, 57, 62, 66, 69, 74)], 4.0, 0.9, 0.8), fr(T['finished']), 0.28, 0, 0.5)
# 11. you: the pond
pw = water(fr(T['irisOut'][1] - T['pond'] + 30)); pw *= np.minimum(1, np.arange(len(pw)) / SR / 0.8) * np.minimum(1, (len(pw) - np.arange(len(pw))) / SR / 1.0); add(pw, fr(T['pond']), 0.2, 0, 0.1)
for k in range(9): add(drop(note(rng.choice([86, 88, 90, 93]))), fr(T['drops']) + k * 0.22 + rng.uniform(0, 0.08), 0.1, rng.uniform(-0.6, 0.6), 0.6)
add(piano([note(62), note(66), note(69), note(74)], 4.0, 0.7), fr(T['drops']), 0.2, 0, 0.6)
cr = crickets(fr(T['irisOut'][1] - T['night'][0])); cr *= np.minimum(1, np.arange(len(cr)) / SR / 1.0) * np.minimum(1, (len(cr) - np.arange(len(cr))) / SR / 0.8); add(cr, fr(T['night'][0]), 0.05, 0.3, 0.3)
add(pad([note(47), note(54), note(62), note(66)], fr(T['irisOut'][1] - T['night'][0]), 0.25), fr(T['night'][0]), 0.2, 0, 0.6)
add(glass(note(88), 3.0), fr(T['star']), 0.13, 0.3, 0.7); add(glass(note(93), 3.0), fr(T['star'] + 24), 0.1, -0.3, 0.7)
# 12. take me as I am: three faces become one
for i, f in enumerate(T['morph']): add(glass(note([74, 78, 81][i] + 12), 2.8), fr(f), 0.12, -0.4 + i * 0.4, 0.6)
add(piano([note(n) for n in (47, 54, 62, 66)], 4.0, 0.7), fr(T['takeTxt']), 0.24, 0, 0.5)
# 13. the name, and again: I write.
add(bell([note(38), note(50)], 7.0, 2.0), fr(T['lname']), 0.5, 0, 0.55)
add(piano([note(n) for n in (38, 50, 57, 62, 66, 69, 73)], 6.0, 0.8, 0.5), fr(T['lname']), 0.28, 0, 0.55)
for i, nt in enumerate([74, 78, 81]): add(koto(note(nt), 2.0, 0.45), fr(T['lwrite'] + i * 8), 0.14, 0.1, 0.55)
for k in range(21): add(nib(), fr(T['lurl'] + k * 1.2), 0.07, 0.1, 0.1)
def snore(d=1.0): n = int(d * SR); t = np.arange(n) / SR; return lp(rng.standard_normal(n), 420) * np.sin(np.pi * t / d) ** 2 * (0.6 + 0.4 * np.sin(2 * np.pi * 26 * t))
for f in (3170, 3250): add(snore(), fr(f), 0.06, 0, 0.1)
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
