"""Code-made soundtrack for "Drawn in code" (15 s, 120 BPM, A minor). Every sound sits on a picture cue (frames @ 60 fps)
from the film's timeline; music stops on a beat before the lockup, then one clean hit and its tail. Master: -14 LUFS, TP <= -1.5."""
import numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy.signal import butter, sosfilt
SR = 48000; DUR = 15.0; N = int(SR * DUR); FPS = 60
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)
fr = lambda f: f / FPS
def add(sig, t, gain=1.0, pan=0.0):
    i = int(round(t * SR)); j = min(N, i + len(sig))
    if i >= N or j <= max(i, 0): return
    s = sig[max(0, -i): j - i] * gain; i = max(i, 0)
    L[i:j] += s * np.sqrt(0.5 * (1 - pan)) * 1.414; R[i:j] += s * np.sqrt(0.5 * (1 + pan)) * 1.414
def env(n, a, d, shape=4.0): t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-shape * np.maximum(0, t - a) / max(d, 1e-4)); return e
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, 'highpass', fs=SR, output='sos'), x)
def lp(x, f, order=2): return sosfilt(butter(order, f, 'lowpass', fs=SR, output='sos'), x)
note = lambda n: 440 * 2 ** ((n - 69) / 12)

# ---- timeline (frames), mirrored from film.js
BEAT = 30; STOP = 780; HIT = 806; BREAK = (660, 720)
CHORDS = [(57, 60, 64), (53, 57, 60), (48, 52, 55), (55, 59, 62), (57, 60, 64), (53, 57, 60), (48, 52, 55)]   # Am F C G Am F C (per bar)
def chord_at(f): return CHORDS[min(len(CHORDS) - 1, int(f // 120))]

# ---- voices
def kick():
    n = int(0.32 * SR); t = np.arange(n) / SR; f = 46 + 70 * np.exp(-t * 28); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env(n, 0.002, 0.22, 5) + 0.25 * hp(rng.standard_normal(n), 2000) * env(n, 0.001, 0.008, 6)
def clap():
    n = int(0.22 * SR); x = bp(rng.standard_normal(n), 900, 4200) * env(n, 0.001, 0.12, 5)
    for k in (0.008, 0.016): x[int(k * SR):] += bp(rng.standard_normal(n - int(k * SR)), 900, 4200) * env(n - int(k * SR), 0.001, 0.05, 6) * 0.6
    return x + 0.3 * np.sin(2 * np.pi * 185 * np.arange(n) / SR) * env(n, 0.001, 0.05, 6)
def hat(open_=False): n = int((0.16 if open_ else 0.045) * SR); return hp(rng.standard_normal(n), 7000) * env(n, 0.001, 0.12 if open_ else 0.03, 5)
def pluck(freq, dur=0.5, bright=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; x = sum(np.sin(2 * np.pi * freq * k * t) / k ** (1.6 - 0.4 * bright) for k in range(1, 7))
    return lp(x, min(9000, 2200 + 4000 * bright)) * env(n, 0.003, dur * 0.5, 4)
def bass(freq, dur=0.24): n = int(dur * SR); t = np.arange(n) / SR; x = np.tanh(2.2 * np.sin(2 * np.pi * freq * t)) + 0.5 * np.sin(2 * np.pi * freq * 2 * t); return lp(x, 900) * env(n, 0.004, dur * 0.7, 3)
def pad(freqs, dur):
    n = int(dur * SR); t = np.arange(n) / SR; x = np.zeros(n)
    for fq in freqs:
        for det in (-0.004, 0, 0.005): ph = 2 * np.pi * fq * (1 + det) * t; x += (2 * (ph / (2 * np.pi) % 1) - 1) * 0.2
    a = np.minimum(1, t / 0.35) * np.minimum(1, (dur - t) / 0.3); return lp(x, 1400) * a
def whoosh(dur=0.5, up=True):
    n = int(dur * SR); x = rng.standard_normal(n); t = np.linspace(0, 1, n)
    out = np.zeros(n); seg = 512
    for i in range(0, n, seg):   # swept band-pass
        c = 400 + 5200 * (t[i] if up else 1 - t[i]); out[i:i + seg] = bp(x[i:i + seg + 2048], c * 0.7, min(c * 1.4, 20000))[:len(out[i:i + seg])]
    return out * np.sin(np.pi * t) ** 1.6
def tick(freq=2600): n = int(0.06 * SR); t = np.arange(n) / SR; return (np.sin(2 * np.pi * freq * t) * env(n, 0.001, 0.02, 6) + 0.4 * hp(rng.standard_normal(n), 5000) * env(n, 0.0005, 0.004, 6))
def bleep(f0, f1, dur=0.11): n = int(dur * SR); t = np.arange(n) / SR; fq = np.linspace(f0, f1, n); ph = 2 * np.pi * np.cumsum(fq) / SR; return np.sign(np.sin(ph)) * 0.5 * env(n, 0.002, dur * 0.6, 3)
def scratch(dur):
    n = int(dur * SR); x = bp(rng.standard_normal(n), 2200, 7000); g = np.zeros(n); i = 0
    while i < n:   # pencil grains: short strokes with tiny pauses
        L_ = int(SR * rng.uniform(0.03, 0.11)); g[i:i + L_] = np.hanning(min(L_, n - i)) * rng.uniform(0.5, 1); i += L_ + int(SR * rng.uniform(0.005, 0.03))
    return x * g
def bell(freqs, dur=1.9):
    n = int(dur * SR); t = np.arange(n) / SR; x = np.zeros(n)
    for fq in freqs:
        for k, (m, a) in enumerate(((1, 1), (2.76, 0.35), (5.4, 0.14))): x += a * np.sin(2 * np.pi * fq * m * t) * np.exp(-t * (2.2 + k * 2.5))
    return x * np.minimum(1, t / 0.002)

# ---- the arrangement
add(lp(rng.standard_normal(int(2.2 * SR)), 300) * env(int(2.2 * SR), 0.12, 1.6, 2) * 0.5 + pad((note(45), note(57)), 2.2) * 0.8, 0, 0.35)   # entry with intent on frame 0
add(scratch(fr(146 - 22)), fr(22), 0.33)
for f in range(120, STOP, BEAT):
    if BREAK[0] <= f < BREAK[1]: continue
    add(kick(), fr(f), 0.95)
    if f >= 240 and (f // BEAT) % 2 == 1: add(clap(), fr(f), 0.42, 0.05)
for f in range(360, STOP, BEAT // 2):
    if BREAK[0] <= f < BREAK[1]: continue
    add(hat((f // 15) % 4 == 3), fr(f), 0.16, 0.35 if (f // 15) % 2 else -0.25)
for f in range(240, STOP, BEAT // 2):   # bass on 8ths
    if BREAK[0] <= f < BREAK[1] and f % BEAT: continue
    root = chord_at(f)[0] - 24 + (12 if (f // 15) % 4 == 2 else 0); add(bass(note(root)), fr(f), 0.5)
for b in range(1, 7):   # pads per bar
    f0 = b * 120
    if f0 >= STOP: break
    add(pad([note(n - 12) for n in chord_at(f0)], min(2.0, fr(STOP - f0))), fr(f0), 0.22 if not (BREAK[0] <= f0 < BREAK[1]) else 0.3)
# whooshes: onset ahead, apex on the visual peak
for apex, d in [(176, 0.5), (286, 0.4), (405, 0.42), (645, 0.5), (765, 0.5)]: add(whoosh(d), fr(apex) - d * 0.55, 0.3)
for k in range(6): add(whoosh(0.3), fr(510 + 20 * k + 7) - 0.18, 0.26, -0.4 + 0.16 * k)   # one per whip
# every age: a pluck per portrait, climbing A minor pentatonic
for k, nt in enumerate([69, 72, 74, 76, 79, 81]): add(pluck(note(nt), 0.6, 0.6 + 0.08 * k), fr(300 + 15 * k + (10 if k else 0)), 0.42, -0.3 + 0.12 * k)
# pixels: square bleeps stepping down, then a pop up on the cut
for f, (a, b2) in zip((426, 441, 455), ((1760, 1320), (1320, 880), (880, 440))): add(bleep(a, b2), fr(f), 0.12)
for k, fq in enumerate((440, 554, 659, 880)): add(bleep(fq, fq, 0.06), fr(465) + k * 0.035, 0.11)
# text: one soft tick per fragment, on its resolve
for f in (74, 242, 344, 446, 680, 722): add(tick(), fr(f), 0.12)
add(tick(3100), fr(866), 0.08)
# lockup: music has stopped at 780; one clean hit as the name resolves, and its tail
n = int(1.5 * SR); t = np.arange(n) / SR
add(np.sin(2 * np.pi * 55 * t) * np.exp(-t * 5) * 0.9 + bell([note(57), note(64), note(69), note(73)]) [:n] * 0.5, fr(HIT), 0.6)
add(bell([note(69), note(76)], 2.2)[: int(fr(900 - HIT) * SR)] * 0.18, fr(HIT) + 0.03, 1.0)

# ---- master: loudness to -14 LUFS, true peak under -1.5 dBTP
mix_ = np.stack([L, R], 1); mix_ = np.tanh(mix_ * 1.1) / 1.1
meter = pyln.Meter(SR); lufs = meter.integrated_loudness(mix_); mix_ = pyln.normalize.loudness(mix_, lufs, -14.0)
peak = np.max(np.abs(mix_)); lim = 10 ** (-1.8 / 20)
if peak > lim: mix_ = np.tanh(mix_ / lim * 0.98) * lim
g = -14.0 - meter.integrated_loudness(mix_); mix_ *= min(10 ** (g / 20), lim / np.max(np.abs(mix_)) * 0.97)   # final trim onto target
fade = int(0.02 * SR); mix_[-fade:] *= np.linspace(1, 0, fade)[:, None]
import os; sf.write(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'soundtrack_raw.wav'), mix_.astype(np.float32), SR, subtype='PCM_24')
print('LUFS', round(meter.integrated_loudness(mix_), 2), 'peak dBFS', round(20 * np.log10(np.max(np.abs(mix_))), 2), 'len', len(mix_) / SR)
