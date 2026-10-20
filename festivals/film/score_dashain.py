"""Soundtrack for "Vijaya" (the Dashain reel), synthesised from scratch in numpy: no samples, no licences.
100 BPM, 30 fps (beat = 18 f, bar = 72 f), 74.4 s. Sa = D. Voices: madal (bass + treble head), jhyamta (hand cymbals),
tanpura drone with a breathing jawari, bansuri (breath, meend glides, delayed vibrato), temple bells (ghanta), shankha
(conch), a choir pad for Durga, and sound design (kite-string saw and snap, a tape rewind, cannons, impacts, risers).
Every cue is a frame number from film/dashain.js. Writes festivals/out/dashain_score.wav (48 kHz, -14 LUFS)."""
import os, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve
SR = 48000; FPS = 30; BEAT = 18; BAR = 72; TOTAL_F = 31 * BAR; DUR = TOTAL_F / FPS + 1.5; N = int(SR * DUR)
rng = np.random.default_rng(2083)
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'out')
bus = {k: np.zeros((2, N)) for k in ('dry', 'verb')}
fs = lambda f: f / FPS                      # frame -> seconds
bt = lambda b: b * BEAT / FPS               # beat -> seconds
mid = lambda m: 440 * 2 ** ((m - 69) / 12)

def add(sig, t, g=1.0, pan=0.0, verb=0.0):
    i = int(round(t * SR)); s = np.asarray(sig) * g
    if i < 0: s = s[-i:]; i = 0
    j = min(N, i + len(s)); s = s[:j - i]
    if len(s) <= 0: return
    l, r = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
    bus['dry'][0, i:j] += s * l; bus['dry'][1, i:j] += s * r
    if verb: bus['verb'][0, i:j] += s * l * verb; bus['verb'][1, i:j] += s * r * verb
def tt(d): return np.arange(int(d * SR)) / SR
def env(n, a, d, k=4.0): t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-k * np.maximum(0, t - a) / max(d, 1e-4))
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, min(hi, SR / 2 - 100)], 'bandpass', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'highpass', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'lowpass', fs=SR, output='sos'), x)
noise = lambda d: rng.standard_normal(int(d * SR))

# ============================================================ voices
def madal_bass(p=1.0):   # the big head: a thumped membrane that drops in pitch
    t = tt(0.45); f = 78 + 70 * np.exp(-t * 30); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + 0.25 * np.sin(2 * ph + 0.5)) * env(len(t), 0.002, 0.22, 4) * p + 0.18 * lp(noise(0.45), 900) * env(len(t), 0.001, 0.02, 5)
def madal_ta(open_=False, f0=392.0):   # the small head: membrane modes + a palm slap
    d = 0.5 if open_ else 0.16; t = tt(d); x = np.zeros(len(t))
    for r, a, k in ((1, 1, 1), (1.59, 0.5, 1.4), (2.14, 0.35, 1.8), (2.3, 0.25, 2.2), (2.65, 0.18, 2.6)): x += a * np.sin(2 * np.pi * f0 * r * t) * np.exp(-t * (9 if open_ else 26) * k)
    slap = bp(noise(d), 1800, 6000) * env(len(t), 0.0005, 0.012, 5)
    return x * 0.6 + slap * (0.25 if open_ else 0.6)
def jhyamta(d=0.5):   # small brass hand cymbals: inharmonic partials, beating
    t = tt(d); x = np.zeros(len(t))
    for f, a in ((3120, 1), (3370, .8), (4710, .6), (5230, .5), (6890, .4), (8170, .3)): x += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t * (6 + f / 2500))
    return x * 0.25 + hp(noise(d), 6000) * env(len(t), 0.001, 0.05, 5) * 0.4
def tanpura(sa, d=4.8):   # one pluck: 28 harmonics whose brightness breathes (the jawari bridge), slow decay
    t = tt(d); x = np.zeros(len(t)); sweep = 0.5 + 0.5 * np.sin(2 * np.pi * 0.35 * t - 1.2)
    for k in range(1, 29):
        cen = 4 + 14 * sweep; a = np.exp(-((k - cen) ** 2) / 40) * 0.9 + 0.4 / k
        x += a * np.sin(2 * np.pi * sa * k * t * (1 + 0.0004 * k)) * np.exp(-t * (0.5 + k * 0.03))
    return x * np.minimum(1, t / 0.01) * 0.08
def bell(f0, d=4.0, bright=1.0):   # temple ghanta: hum, prime, tierce, quint, nominal... (bell partial ratios)
    t = tt(d); x = np.zeros(len(t))
    for r, a, k in ((0.5, .6, .5), (1, 1, .8), (1.183, .5, 1.2), (1.506, .4, 1.5), (2, .35, 1.8), (2.514, .25 * bright, 2.4), (2.662, .2 * bright, 2.6), (3.011, .15 * bright, 3), (4.166, .1 * bright, 4)):
        x += a * np.sin(2 * np.pi * f0 * r * t + rng.uniform(0, 6)) * np.exp(-t * k) * (1 + 0.15 * np.sin(2 * np.pi * (1.3 + r) * t))
    return x * np.minimum(1, t / 0.002) * 0.3 + hp(noise(d), 3000) * env(len(t), 0.0005, 0.01, 6) * 0.2
def conch(f0=293.66, d=3.2):   # shankha: breath onset, a nasal buzzing tone that swells and sharpens slightly
    t = tt(d); f = f0 * (1 + 0.02 * np.minimum(1, t / 0.6) + 0.004 * np.sin(2 * np.pi * 5 * t) * np.minimum(1, t))
    ph = 2 * np.pi * np.cumsum(f) / SR; saw = sum(np.sin(k * ph) / k ** 0.9 for k in range(1, 18))
    tone = bp(saw, 400, 1300, 2) * 1.2 + lp(saw, 600) * 0.6
    e = np.minimum(1, t / 0.5) ** 1.5 * np.minimum(1, (d - t) / 0.6); br = bp(noise(d), 800, 3000) * 0.15
    return (tone + br) * e * 0.35
def choir(midis, d, vowel=(800, 1150, 2900)):   # "aa" pad: detuned saws through vowel formants
    t = tt(d); x = np.zeros(len(t))
    for m in midis:
        for det in (-0.006, 0, 0.007): ph = 2 * np.pi * mid(m) * (1 + det) * t + rng.uniform(0, 6); x += 2 * ((ph / (2 * np.pi)) % 1) - 1
    y = sum(bp(x, f * 0.85, f * 1.15) * g for f, g in zip(vowel, (1, 0.6, 0.25)))
    return y * np.minimum(1, t / (d * 0.35)) * np.minimum(1, (d - t) / (d * 0.3)) * 0.12
def flute(notes, t0, gain=1.0, verb=0.35, pan=-0.1, vib=0.22):
    """Bansuri phrase. notes = [(beat, beats, midi)], legato notes glide (meend). Continuous phase across the phrase."""
    end = max(b + l for b, l, _ in notes); d = bt(end) + 0.6; n = int(d * SR); t = np.arange(n) / SR
    f = np.zeros(n); amp = np.zeros(n); onset = np.zeros(n)
    for i, (b, l, m) in enumerate(notes):
        i0, i1 = int(bt(b) * SR), min(n, int(bt(b + l) * SR)); f[i0:i1] = mid(m)
        a = np.ones(i1 - i0); ga = int(0.035 * SR); prev_end = int(bt(notes[i - 1][0] + notes[i - 1][1]) * SR) if i else -1
        legato = i and prev_end >= i0 - 10
        if not legato: a[:ga] = np.linspace(0, 1, ga) ** 1.5; onset[i0:i0 + int(0.04 * SR)] = 1
        rel = min(len(a), int(0.08 * SR)); nxt = notes[i + 1][0] if i + 1 < len(notes) else 1e9
        if bt(nxt) * SR > i1 + 10: a[-rel:] *= np.linspace(1, 0, rel)
        amp[i0:i1] = np.maximum(amp[i0:i1], a)
    f[f == 0] = np.maximum.accumulate(np.where(f > 0, f, 0))[f == 0] if np.any(f > 0) else 440
    k = int(0.05 * SR); fs_ = np.convolve(np.log(np.maximum(f, 1)), np.ones(k) / k, mode='same'); f = np.exp(fs_)      # meend: glide between notes
    held = np.zeros(n); c = 0.0
    for i in range(1, n): c = c + 1 / SR if abs(f[i] - f[i - 1]) < 0.05 else 0; held[i] = c
    v = np.minimum(1, np.maximum(0, held - 0.25) / 0.4) * vib; f = f * 2 ** (v * np.sin(2 * np.pi * 5.3 * t) / 12)
    ph = 2 * np.pi * np.cumsum(f) / SR; tone = np.sin(ph) + 0.14 * np.sin(2 * ph + 0.3) + 0.05 * np.sin(3 * ph) + 0.02 * np.sin(4 * ph)
    amp = np.convolve(amp, np.ones(400) / 400, mode='same'); breath = bp(rng.standard_normal(n), 1200, 5200) * 0.1 + lp(rng.standard_normal(n), 900) * 0.04
    chiff = bp(rng.standard_normal(n), 2000, 7000) * np.convolve(onset, np.exp(-np.arange(2400) / 300), mode='full')[:n] * 0.08
    x = (tone * (0.85 + 0.15 * np.sin(2 * np.pi * 0.7 * t)) + breath * (0.6 + 0.4 * (1 - v / max(vib, 1e-3)))) * amp + chiff
    add(lp(x, 7000) * 0.22 * gain, t0, 1, pan, verb)
def whoosh(d=0.6, up=True, lo=300, hi=6000):
    n = int(d * SR); x = rng.standard_normal(n); u = np.linspace(0, 1, n); out = np.zeros(n); seg = 1024
    for i in range(0, n, seg): c = lo + (hi - lo) * (u[i] if up else 1 - u[i]); out[i:i + seg] = bp(x[i:i + seg + 2048], c * 0.7, c * 1.4)[:len(out[i:i + seg])]
    return out * np.sin(np.pi * u) ** 1.5
def riser(d):
    n = int(d * SR); u = np.linspace(0, 1, n); x = whoosh(d, True, 200, 9000) * u ** 2 * 1.3; t = np.arange(n) / SR
    return x + 0.08 * np.sin(2 * np.pi * np.cumsum(120 + 600 * u ** 2) / SR) * u ** 2
def impact(big=1.0):
    t = tt(2.2); f = 30 + 60 * np.exp(-t * 9); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.002, 0.9, 3)
    return (s * 0.9 + lp(noise(2.2), 1600) * env(len(t), 0.001, 0.25, 4) * 0.5 + hp(noise(2.2), 3000) * env(len(t), 0.0005, 0.04, 5) * 0.3) * big
def boom():   # cannon: blast + long low tail
    t = tt(2.5); return lp(noise(2.5), 400) * env(len(t), 0.001, 0.6, 3) * 0.9 + np.sin(2 * np.pi * np.cumsum(45 + 40 * np.exp(-t * 6)) / SR) * env(len(t), 0.001, 0.5, 3) * 0.7 + bp(noise(2.5), 800, 4000) * env(len(t), 0.0005, 0.05, 5) * 0.4
def bleep(f0, f1, d=0.09): t = tt(d); ph = 2 * np.pi * np.cumsum(np.linspace(f0, f1, len(t))) / SR; return np.sign(np.sin(ph)) * env(len(t), 0.001, d * 0.6, 3) * 0.25
def tick(): t = tt(0.03); return np.sin(2 * np.pi * 2400 * t) * env(len(t), 0.0005, 0.01, 6) * 0.3 + hp(noise(0.03), 5000) * env(len(t), 0.0003, 0.004, 6) * 0.2
def pluck(fr, d=1.2, bright=1.0):   # Karplus-Strong: a sarangi/harp-like pluck
    n = int(d * SR); p = int(SR / fr); buf = rng.uniform(-1, 1, p); out = np.zeros(n)
    for i in range(n): out[i] = buf[i % p]; buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * (0.996 if bright > 0.5 else 0.99)
    return out * 0.4
def honk(): t = tt(0.22); return (np.sign(np.sin(2 * np.pi * 440 * t)) + np.sign(np.sin(2 * np.pi * 554 * t))) * env(len(t), 0.005, 0.2, 1) * 0.08
def riffle(d=0.5):
    n = int(d * SR); x = np.zeros(n); i = 0
    while i < n - 600: x[i:i + 500] += bp(rng.standard_normal(500), 2000, 7000) * np.exp(-np.arange(500) / 80); i += int(SR * rng.uniform(0.008, 0.02))
    return x * 0.3
def saw_string(d):   # two kite strings sawing against each other: friction strokes, a thin whistle on top
    n = int(d * SR); t = np.arange(n) / SR; u = t / d; rate = 6 + 10 * u
    strokes = np.abs(np.sin(np.pi * np.cumsum(rate) / SR)) ** 3
    fr = bp(rng.standard_normal(n), 1400, 5200) * strokes * (0.2 + u ** 1.5)
    wh = np.sin(2 * np.pi * np.cumsum(2200 + 300 * np.sin(2 * np.pi * 3 * t) + 400 * u) / SR) * strokes * 0.05 * u
    return fr * 0.5 + wh
def snap(): t = tt(1.0); tw = np.sin(2 * np.pi * 1180 * t) * np.exp(-t * 7) * 0.35 + np.sin(2 * np.pi * 1770 * t) * np.exp(-t * 11) * 0.2; return tw + hp(noise(1.0), 1500) * env(len(t), 0.0003, 0.008, 6) * 1.2

# ============================================================ arrangement
SA = mid(62); SA_L = mid(50); PA_L = mid(45)
S, R, G, M, P_, D, N_ = 62, 64, 66, 67, 69, 71, 73; S2, R2, G2, P2 = 74, 76, 78, 81
def groove(b0, b1, level=1.0, fill_every=4, jh=True):
    for b in range(b0, b1):
        t0 = bt(b * 4); sw = bt(0.5) * 0.06
        for e, kind in enumerate(['D', 't', 'T', 't', 'D', 'D', 'T', 't'] if b % fill_every != fill_every - 1 else ['D', 't', 'T', 't', 'T', 't', 'T', 'T']):
            tm = t0 + bt(e * 0.5) + (sw if e % 2 else 0); v = level * (0.9 + 0.2 * rng.random())
            if kind == 'D': add(madal_bass(), tm, 0.85 * v, -0.15, 0.08)
            elif kind == 'T': add(madal_ta(True), tm, 0.5 * v, 0.2, 0.12)
            else: add(madal_ta(False), tm, 0.32 * v, 0.25, 0.08)
        if jh: [add(jhyamta(), t0 + bt(k), 0.18 * level, 0.45, 0.2) for k in (1, 3)]
def drone(t0, t1, level=1.0):
    t = t0; k = 0
    while t < t1: add(tanpura([PA_L, SA, SA, SA_L][k % 4] if k % 4 != 1 else SA, 4.8), t, level * [1, 0.8, 0.8, 1.1][k % 4], [-0.4, -0.1, 0.1, 0.4][k % 4], 0.25); t += bt(1); k += 1

THEME_A = [(0, .5, P_), (.5, .5, D), (1, 1, S2), (2, .5, D), (2.5, .5, P_), (3, 1, G), (4, .5, R), (4.5, .5, G), (5, .5, P_), (5.5, .5, G), (6, 2, R)]
THEME_B = [(0, .5, P_), (.5, .5, D), (1, 1, S2), (2, .5, R2), (2.5, .5, S2), (3, 1, D), (4, .5, P_), (4.5, .5, G), (5, 1, R), (6, 2, S)]
def theme(b, which='AB', g=1.0, oct_=0):
    ns = []; off = 0
    for w_ in which: ns += [(x + off, l, m + oct_) for x, l, m in (THEME_A if w_ == 'A' else THEME_B)]; off += 8
    flute(ns, bt(b * 4), g)

# --- 0. cold open, mid-fight (bars 0-2): groove already running, flute mid-phrase, the strings saw, CUT
drone(0, fs(144), 0.8); groove(0, 2, 0.9)
flute([(x - 2, l, m) for x, l, m in THEME_A if x >= 2] + [(x + 6, l, m) for x, l, m in THEME_B], 0, 0.9)
add(saw_string(fs(144 - 40)), fs(40), 0.9, 0.1, 0.1); add(riser(1.6), fs(144) - 1.6, 0.35, 0, 0.2)
add(snap(), fs(144), 0.9, 0.2, 0.3); add(impact(1.0), fs(144), 0.9, 0, 0.35); add(bleep(900, 1800, 0.12), fs(146), 0.6, 0)
add(whoosh(2.0, False, 200, 4000), fs(150), 0.35, -0.2, 0.4)
flute([(0, 1.5, S2), (1.5, 1, D), (2.5, 1.5, P_)], fs(150), 0.6, 0.6)   # one falling phrase after the cut
for k, tm in enumerate(np.arange(0.15, 1.0, 0.045)): add(tick(), tm, 0.25, 0.3)   # the location label typing
# --- 1. rewind (bar 3): the opening plays backwards, accelerating, into the past
seg = bus['dry'][:, int(fs(144 - 72) * SR):int(fs(144) * SR)].copy()[:, ::-1]; L_ = seg.shape[1]; idx = np.cumsum(np.linspace(0.8, 3.2, int(2.4 * SR))); idx = idx[idx < L_ - 1].astype(int)
rw = lp(seg[0, idx] + seg[1, idx], 3000) * np.linspace(0.3, 1, len(idx)) * np.linspace(1, 0, len(idx)) ** 0.5; add(rw, fs(216), 0.5, 0, 0.3)
for k in range(28): add(tick(), fs(216) + 0.06 + 2.2 * (k / 28) ** 1.6, 0.35, (-1) ** k * 0.3)   # the year counter ticking back
add(whoosh(2.3, False, 400, 7000), fs(216), 0.25, 0, 0.3)
# --- 2. the text (bars 4-5): drone, a bell per folio, a low minor flute (Bhairavi colour)
drone(fs(288), fs(576), 0.9)
for k in range(7): add(bell(mid(74 - [0, 2, 3, 5, 7, 5, 3][k]) * 0.5, 3, 0.6), fs(288) + k * 0.6, 0.25, (k % 3 - 1) * 0.4, 0.5); add(whoosh(0.3, True, 800, 3000), fs(288) + k * 0.6 - 0.15, 0.1, 0)
flute([(1, 2, 62), (3, 1, 63), (4, 2, 65), (6, 1, 63), (7, 1.5, 62)], fs(288), 0.7, 0.5, vib=0.3)
# --- 3. Mahishasura (bars 6-7): sub drone, war-drum hits, a growl
t3 = fs(432)
for k in range(8): add(madal_bass(1.4), t3 + bt(k), 1.0 if k % 2 == 0 else 0.6, 0, 0.25); add(lp(noise(0.5), 300) * env(int(0.5 * SR), 0.003, 0.25, 3), t3 + bt(k), 0.5 if k % 2 == 0 else 0.25)
tg = tt(4.8); growl = lp(np.sign(np.sin(2 * np.pi * 41 * tg + 3 * np.sin(2 * np.pi * 0.7 * tg))), 220) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.42 * tg)) * np.minimum(1, tg / 1.2) * np.minimum(1, (4.8 - tg) / 0.5); add(growl * 0.18, t3, 1, 0, 0.2)
flute([(0, 3, 62), (3, 1, 63), (4, 3, 60), (7, 1, 58)], t3 + bt(0.5), 0.5, 0.6, pan=0.2)
# --- 4. Durga (bars 8-9): light converges (riser), conch at the moment of form, choir + bells
t4 = fs(576); add(riser(1.4), t4, 0.4, 0, 0.3); add(impact(0.8), fs(576 + 42), 0.6, 0, 0.5); add(conch(), fs(576 + 42), 0.8, 0, 0.45)
add(choir([50, 57, 62, 66], 3.6), fs(576 + 36), 1.0, 0, 0.5); [add(bell(mid(m), 4), fs(576 + 42) + d_, 0.22, p, 0.6) for m, d_, p in ((74, 0, -0.3), (81, 0.3, 0.3), (78, 0.6, 0))]
drone(fs(612), fs(720), 0.7)
# --- 5. Navaratri (bars 10-11): driving drums, a metallic strike every night (16 f)
groove(10, 12, 1.0, 2)
for k in range(9): tm = fs(720 + 16 * k); add(hp(noise(0.6), 2500) * env(int(0.6 * SR), 0.001, 0.08, 4) * 0.5 + bell(mid(86 + [0, 2, 4, 7, 9, 7, 4, 2, 0][k]), 0.6, 1.5) * 0.4, tm, 0.5, (k % 3 - 1) * 0.5, 0.25)
add(riser(1.0), fs(864) - 1.0, 0.4)
# --- 6. victory (bars 12-13): the demon shatters; the name pops in
t6 = fs(864); add(impact(1.2), t6, 1.0, 0, 0.4); add(hp(noise(1.5), 4000) * env(int(1.5 * SR), 0.001, 0.4, 3) * 0.35, t6, 1, 0, 0.4)
add(conch(), t6 + 0.05, 0.6, 0, 0.5); add(choir([50, 57, 62, 66, 69], 4.6), t6, 1.1, 0, 0.5); drone(t6, fs(1008), 0.8)
add(bleep(600, 1400), fs(891), 0.7, -0.2); add(bleep(700, 1700), fs(933), 0.7, 0.2); add(bell(mid(74), 3), fs(891), 0.3, -0.3, 0.5); add(bell(mid(81), 3), fs(933), 0.3, 0.3, 0.5)
theme(12, 'A', 0.8)
# --- 7. Nepal (bars 14-15): the outline draws with a rising pluck arpeggio; groove returns light
groove(14, 16, 0.6, 4, jh=False); drone(fs(1008), fs(1152), 0.7)
for k, m in enumerate([S, R, G, P_, D, S2, R2, G2, P2]): add(pluck(mid(m), 1.4), fs(1008) + k * 0.19, 0.5, -0.6 + k * 0.15, 0.35)
for k in range(4): add(bell(mid(86), 1.2, 0.5), fs(1008) + 1.9 + k * 0.85, 0.12, 0.4, 0.5)
# --- 8-12. fifteen days (bars 16-22): full groove + theme; a bell for each new day
groove(16, 23, 1.0); drone(fs(1152), fs(1656), 0.8)
theme(16, 'AB', 1.0); theme(20, 'A', 0.8, 0)
for f in (1152, 1296, 1368, 1404, 1440, 1584): add(bell(mid(81), 2.5), fs(f), 0.22, 0.3, 0.6); add(whoosh(0.4, True, 500, 5000), fs(f) - 0.3, 0.2)
for k in range(1, 4): add(boom(), fs(1296 + k * BEAT), 0.75, (k - 2) * 0.4, 0.4)   # Fulpati gun salute
for k in range(6): add(bell(mid(69 + (k % 3) * 5), 2.5, 1.2), fs(1368) + k * 0.2, 0.15, (k % 2) * 0.6 - 0.3, 0.6)   # Taleju's temple bells
add(honk(), fs(1404) + 0.4, 1, 0.3); add(honk(), fs(1404) + 0.7, 1, 0.3)
for k in range(8): add(pluck(mid([S2, D, P_, G, R, G, P_, S][k]), 1.2), fs(1440) + 0.3 + k * 0.42, 0.35, 0.2, 0.4)   # shloka lines
add(choir([50, 57, 62], 2.4), fs(1584), 0.6, 0, 0.6)
# --- 13. together (bars 23-25): peak groove, hits on every cut, a riffle, Malshree-like devotional line
groove(23, 26, 1.1, 2)
for k in range(6): add(impact(0.35), fs(1656 + 36 * k), 0.5, 0, 0.2); add(bleep(500 + 120 * k, 1200 + 150 * k), fs(1656 + 36 * k), 0.4, 0)
add(honk(), fs(1656 + 72) + 0.2, 1, -0.2); add(honk(), fs(1656 + 72) + 0.45, 1, -0.2); add(riffle(0.5), fs(1656 + 144), 1, 0.3, 0.2)
theme(23, 'A', 1.0, 12)
flute([(0, 1, S2), (1, .5, D), (1.5, .5, P_), (2, 2, G)], fs(1656 + 180), 0.9, 0.6)
drone(fs(1656), fs(2016), 0.8)
# --- 14. POV tika (bar 26): the music breathes out to a heartbeat; a riser into the stamp (bar 27)
for k in range(4): add(madal_bass(0.9), fs(1872) + bt(k), 0.5, 0, 0.2); add(madal_bass(0.6), fs(1872) + bt(k) + 0.18, 0.3, 0, 0.2)
add(riser(2.4), fs(1944) - 2.4, 0.5, 0, 0.3); add(choir([62, 66, 69], 2.4), fs(1872), 0.4, 0, 0.5)
add(impact(1.1), fs(1944), 1.0, 0, 0.5); add(bell(mid(62), 6, 1), fs(1944), 0.45, 0, 0.7); add(bell(mid(74), 6, 1), fs(1944) + 0.02, 0.3, 0.2, 0.7); add(hp(noise(2), 5000) * env(int(2 * SR), 0.01, 0.9, 3) * 0.25, fs(1944), 1, 0, 0.6)
add(choir([50, 57, 62, 66, 69], 5), fs(1944), 1.0, 0, 0.6)
# --- 15. the wish (bars 28-30): everything comes home; the kite is caught and flies; final hit on bar 30
groove(28, 30, 1.0); drone(fs(2016), fs(2232), 0.9); theme(28, 'AB', 1.1)
add(bleep(800, 1600), fs(2016 + 6), 0.5); add(bleep(900, 1900), fs(2016 + 15), 0.5)
add(pluck(mid(P2), 1.8), fs(2118), 0.6, -0.2, 0.4); add(whoosh(2.0, True, 400, 7000), fs(2118) + 0.4, 0.3, 0.3, 0.4)
tf = fs(2160); add(impact(1.0), tf, 0.9, 0, 0.5); add(madal_bass(1.3), tf, 1.0); add(jhyamta(1.5), tf, 0.35, 0.4, 0.5); add(conch(d=2.4), tf, 0.55, 0, 0.5)
add(choir([50, 57, 62, 66, 69, 74], 3.5), tf, 1.2, 0, 0.6); [add(bell(mid(m), 5), tf + d_, 0.3, p, 0.7) for m, d_, p in ((62, 0, -0.3), (69, .12, .3), (74, .24, 0), (78, .36, -.2))]
flute([(0, 4, S2)], tf, 0.8, 0.6, vib=0.3)

# ============================================================ mix + master
def ir(d=2.6, decay=2.4):
    n = int(d * SR); t = np.arange(n) / SR; e = np.exp(-t * decay * 3 / d)
    return np.stack([lp(rng.standard_normal(n), 7000) * e, lp(rng.standard_normal(n), 7000) * e]) * 0.05
I = ir(); verb = np.stack([fftconvolve(bus['verb'][c], I[c])[:N] for c in range(2)])
mix = bus['dry'] + hp(verb, 120) * 0.9
mix = np.stack([hp(mix[0], 28), hp(mix[1], 28)])
fade = np.ones(N); fl = int(1.4 * SR); end = int((TOTAL_F / FPS) * SR); fade[end - fl:end] = np.linspace(1, 0, fl) ** 2; fade[end:] = 0; mix *= fade
import pyloudnorm as pyln
meter = pyln.Meter(SR); loud = meter.integrated_loudness(mix.T); mix *= 10 ** ((-14 - loud) / 20)
mix = np.tanh(mix * 1.1) / 1.1; pk = np.max(np.abs(mix)); mix *= min(1, 0.85 / pk)
loud2 = meter.integrated_loudness(mix.T); mix = mix[:, :end]
os.makedirs(OUT, exist_ok=True); sf.write(os.path.join(OUT, 'dashain_score.wav'), mix.T, SR, subtype='PCM_24')
print(f'score: {mix.shape[1] / SR:.2f}s  {loud2:.1f} LUFS  peak {20 * np.log10(np.max(np.abs(mix))):.1f} dBFS')
