"""Code-made soundtrack for the 25 s "Nikit Hamal" reel (120 BPM, A minor). Every sound sits on a picture cue from film.js (frames @ 60 fps):
keys for every typed character, UI pops for the apps, a marimba per stack icon, checks for the ops list, felt piano in the essay
breakdown, impacts on the montage cuts, then the music stops for the name and the pup snores out. Master: -14 LUFS, TP <= -1.5."""
import os, numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy.signal import butter, sosfilt
SR = 48000; FPS = 60; TOTAL = 1500; DUR = TOTAL / FPS; N = int(SR * DUR)
rng = np.random.default_rng(11)
L = np.zeros(N); R = np.zeros(N)
fr = lambda f: f / FPS
def add(sig, t, gain=1.0, pan=0.0):
    i = int(round(t * SR)); j = min(N, i + len(sig))
    if i >= N or j <= max(i, 0): return
    s = sig[max(0, -i): j - i] * gain; i = max(i, 0)
    L[i:j] += s * np.sqrt(0.5 * (1 - pan)) * 1.414; R[i:j] += s * np.sqrt(0.5 * (1 + pan)) * 1.414
def env(n, a, d, shape=4.0): t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-shape * np.maximum(0, t - a) / max(d, 1e-4))
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, 'highpass', fs=SR, output='sos'), x)
def lp(x, f, order=2): return sosfilt(butter(order, f, 'lowpass', fs=SR, output='sos'), x)
note = lambda n: 440 * 2 ** ((n - 69) / 12)
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

def key(heavy=False):   # one keystroke: click + thock
    n = int(0.05 * SR); t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 2500 if not heavy else 1200) * env(n, 0.0005, 0.006, 6) * (0.8 + 0.4 * rng.random())
    x += np.sin(2 * np.pi * (180 + 60 * rng.random()) * t) * env(n, 0.001, 0.02, 5) * (0.9 if heavy else 0.45)
    return x
def pop(freq=900): n = int(0.12 * SR); t = np.arange(n) / SR; fq = freq * (1 + 0.8 * np.exp(-t * 60)); return np.sin(2 * np.pi * np.cumsum(fq) / SR) * env(n, 0.001, 0.05, 5)
def marimba(freq): n = int(0.5 * SR); t = np.arange(n) / SR; return (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t * 30)) * env(n, 0.002, 0.25, 4)
def piano(freqs, dur=1.6, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; x = np.zeros(n)
    for fq in freqs:
        for k, a in ((1, 1), (2, .45), (3, .22), (4, .1)): x += a * np.sin(2 * np.pi * fq * k * t * (1 + 0.0004 * k * k)) * np.exp(-t * (1.6 + k * 1.2))
    return lp(x, 2400) * np.minimum(1, t / 0.004) * vel
def riser(dur):
    n = int(dur * SR); t = np.linspace(0, 1, n); out = np.zeros(n); nz = rng.standard_normal(n + 4096); seg = 512
    for i in range(0, n, seg): c = 300 + 6000 * t[i] ** 2; out[i:i + seg] = bp(nz[i:i + seg + 2048], c * 0.8, min(c * 1.25, 20000))[:len(out[i:i + seg])]
    tone = sum(np.sin(2 * np.pi * np.cumsum(note(57 + o) * (1 + t * 1.0)) / SR) for o in (0, 7, 12)) * 0.08
    return (out + tone) * t ** 2.2
def impact(): n = int(0.9 * SR); t = np.arange(n) / SR; return np.sin(2 * np.pi * np.cumsum(40 + 90 * np.exp(-t * 18)) / SR) * env(n, 0.002, 0.5, 4) + 0.5 * lp(rng.standard_normal(n), 3000) * env(n, 0.001, 0.12, 5)
def crash(): n = int(1.2 * SR); return hp(rng.standard_normal(n), 5000) * env(n, 0.001, 0.8, 4)
def snore(dur=0.9): n = int(dur * SR); t = np.arange(n) / SR; return lp(rng.standard_normal(n), 500) * np.sin(np.pi * t / dur) ** 2 * (0.6 + 0.4 * np.sin(2 * np.pi * 28 * t))

# ---- timeline, mirrored from film.js T
T = dict(type0=0, pop=54, expand=150, name=168, sub=190, wink1=222, build=240, phoneIn=248, neb=262, swipe=360, bub=(384, 402, 420, 438), morph=452, chart=(490, 560),
         planets=556, stack=600, iconsAt=612, stackCopy=652, ops=720, ticks=(762, 777, 792, 807), bar=(762, 830), write=840, be=868, strike=(912, 930), which=936,
         scroll=(990, 1052), neither=(1056, 1086, 1116), mont=1140, lock=1260, lname=1272, ltype=1300, lurl=1380, wink2=1428)
BEAT = 30; GROOVE = (T['build'], T['write']); DROP = (T['mont'], T['lock'] - 4)
CH = [(57, 60, 64), (53, 57, 60), (48, 52, 55), (55, 59, 62)]   # Am F C G, one per bar
chord = lambda f: CH[int(max(0, f - T['build']) // 120) % 4]
def typing(text, f0, rate, gain=0.13, heavy=False):
    for k, ch in enumerate(text):
        if ch != ' ': add(key(heavy), fr(f0 + k * rate) + rng.uniform(-0.004, 0.004), gain * (1.4 if heavy else 1), rng.uniform(-0.3, 0.3))
# intro: a held pad and a soft sub, then a riser into the groove
add(pad((note(45), note(52), note(57)), fr(T['build'])) * 0.7, 0, 0.3)
typing("> hi, i'm nikit", T['type0'], 4, 0.2)
add(pop(660), fr(T['pop']), 0.3); add(marimba(note(69)), fr(T['pop']) + 0.02, 0.2)
add(whoosh(0.5), fr(175) - 0.27, 0.3)
add(piano([note(57), note(64), note(69)], 2.0, 0.6), fr(T['name']), 0.35)
typing('android · full-stack · writing', T['sub'], 1.6, 0.1)
add(bell([note(88)], 0.6), fr(T['wink1']) + 0.03, 0.14, 0.3)
add(riser(1.0), fr(T['build']) - 1.0, 0.35)
# groove + drop
def groove(a, b, full=True):
    for f in range(a, b, BEAT):
        add(kick(), fr(f), 0.95)
        if (f // BEAT) % 2 == 1: add(clap(), fr(f), 0.4, 0.05)
    for f in range(a, b, BEAT // 2): add(hat((f // 15) % 4 == 3), fr(f), 0.15, 0.35 if (f // 15) % 2 else -0.25)
    for f in range(a, b, BEAT // 2): root = chord(f)[0] - 24 + (12 if (f // 15) % 4 == 2 else 0); add(bass(note(root)), fr(f), 0.5)
    for f in range(a, b, 120): add(pad([note(n - 12) for n in chord(f)], min(2.0, fr(b - f))), fr(f), 0.2)
    for f in range(a, b, BEAT // 2):   # plucky arp
        if full and (f // 15) % 2 == 0: ch = chord(f); add(pluck(note(ch[(f // 30) % 3] + 12), 0.25, 0.7), fr(f), 0.09, 0.4 if (f // 30) % 2 else -0.4)
groove(*GROOVE)
add(impact(), fr(T['build']), 0.45); add(crash(), fr(T['build']), 0.15)
typing('SIDE PROJECTS & WORK', T['build'] + 10, 1.5, 0.08)
add(whoosh(0.45), fr(256) - 0.25, 0.3)
for i in range(4): add(pop(700 + i * 120), fr(T['neb'] + 14 + i * 8), 0.16, -0.2 + i * 0.13)
typing('NEBians', T['neb'], 2, 0.1)
add(whoosh(0.3), fr(T['swipe']) - 0.05, 0.25, 0.3)
for i, f in enumerate(T['bub']): add(pop(1050 if i % 2 else 760), fr(f), 0.25, 0.25 if i % 2 else -0.25)
add(whoosh(0.6), fr(470) - 0.33, 0.32)
for i in range(10): add(marimba(note([69, 72, 76, 79, 81][i % 5] + (12 if i >= 5 else 0))), fr(T['chart'][0] + i * 6.3), 0.07, -0.4 + i * 0.08)
for i in range(9): add(bell([note(93 + [0, 3, 7, 10, 12][i % 5])], 0.4), fr(T['planets'] - 40 + i * 4), 0.04)
# stack
add(impact(), fr(T['stack']), 0.4); add(whoosh(0.4), fr(T['stack']) - 0.1, 0.3)
typing('SKILLS & EXPERIENCE', T['stack'] + 8, 1.5, 0.08)
for i in range(14): add(marimba(note([57, 60, 62, 64, 67][i % 5] + 12 * (i // 5))), fr(T['iconsAt'] + i * 3 + 8), 0.13, -0.5 + i * 0.075)
typing('kotlin · compose · django · svelte · firebase', T['stackCopy'], 1.2, 0.08)
# ops
add(whoosh(0.45), fr(T['ops']) - 0.15, 0.3)
typing('OPERATIONS', T['ops'] + 8, 1.5, 0.08)
for i, f in enumerate(T['ticks']): add(pop(1200 + i * 150), fr(f), 0.18); add(key(True), fr(f), 0.2)
n = int(fr(T['bar'][1] - T['bar'][0]) * SR); t = np.arange(n) / SR; add(np.sin(2 * np.pi * np.cumsum(300 + 500 * (t / t[-1]) ** 0.5) / SR) * 0.15 * np.minimum(1, t / 0.05), fr(T['bar'][0]), 0.25)
add(bell([note(81), note(88)], 1.0), fr(T['bar'][1]), 0.12)
# breakdown: the essays (no drums), felt piano, typewriter, the strike, titles flicking past
add(whoosh(0.6), fr(T['write']) - 0.2, 0.25)
for i, f in enumerate(range(T['write'], T['mont'], 60)):
    ch = CH[(i // 2) % 4]; add(piano([note(n) for n in ch] + [note(ch[0] - 12)], 2.2, 0.8), fr(f), 0.3)
add(pad([note(45), note(57), note(64)], fr(T['mont'] - T['write'])), fr(T['write']), 0.16)
typing('ESSAYS & WRITING', T['write'] + 14, 1.5, 0.07)
typing('Be yourself.', T['be'], 3, 0.18, True)
add(scratch(fr(T['strike'][1] - T['strike'][0]) + 0.05), fr(T['strike'][0]), 0.5)
for i in range(6): add(pluck(note([76, 74, 72, 69, 72, 76][i]), 0.6, 0.4), fr(T['which'] + i * 5), 0.12)
def ease_out(p): return 1 - (1 - p) ** 4
prev = None
for f in range(T['scroll'][0], T['scroll'][1] + 1):
    pos = int(-16 * (1 - ease_out((f - T['scroll'][0]) / (T['scroll'][1] - T['scroll'][0]))))
    if prev is not None and pos != prev: add(tick(2200 + 40 * pos), fr(f), 0.07)
    prev = pos
add(bell([note(69), note(76)], 1.6), fr(T['scroll'][1]), 0.16)
for i, f in enumerate(T['neither']): add(piano([note([64, 62, 60][i] + 12)], 1.4, 1.0), fr(f), 0.22); add(piano([note([69, 67, 64][i] + 12)], 1.4, 0.8), fr(f + 10), 0.18)
add(riser(1.2), fr(T['mont']) - 1.2, 0.4)
# drop: montage, an impact on every cut
groove(*DROP)
for k in range(8): add(impact() if k % 2 == 0 else crash(), fr(T['mont'] + k * 15), 0.35 if k % 2 == 0 else 0.12); add(whoosh(0.2), fr(T['mont'] + k * 15) - 0.1, 0.15, -0.5 + k * 0.14)
add(bell([note(88)], 0.6), fr(1247) + 0.03, 0.14, -0.3)
# lockup: the music has stopped; one clean hit on the name, then keys, the pup snores, a last wink
nh = int(1.8 * SR); th = np.arange(nh) / SR
add(np.sin(2 * np.pi * 55 * th) * np.exp(-th * 4.5) * 0.9 + bell([note(57), note(64), note(69), note(72)], 1.8)[:nh] * 0.5, fr(T['lname']), 0.6)
add(pad([note(45), note(52), note(57), note(64)], fr(TOTAL - T['lname'])), fr(T['lname']), 0.12)
typing('Head of Operations at Consica Labs.', T['ltype'], 1.1, 0.1)
typing('Android & full-stack engineer from Nepal.', T['ltype'] + 40, 1.1, 0.1)
typing('Writing about the self.', T['ltype'] + 86, 1.1, 0.1)
add(pop(880), fr(T['lurl']), 0.18)
for f in (1300, 1350): add(snore(), fr(f), 0.07, 0.4)
add(bell([note(88)], 0.8), fr(T['wink2']) + 0.03, 0.16, -0.2); add(pop(1400), fr(T['wink2'] - 20), 0.1, 0.4)

# ---- master
mix_ = np.stack([L, R], 1); mix_ = np.tanh(mix_ * 1.1) / 1.1
meter = pyln.Meter(SR); mix_ = pyln.normalize.loudness(mix_, meter.integrated_loudness(mix_), -14.0)
lim = 10 ** (-1.8 / 20)
if np.max(np.abs(mix_)) > lim: mix_ = np.tanh(mix_ / lim * 0.98) * lim
g = -14.0 - meter.integrated_loudness(mix_); mix_ *= min(10 ** (g / 20), lim / np.max(np.abs(mix_)) * 0.97)
fade = int(0.4 * SR); mix_[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(out, exist_ok=True)
sf.write(os.path.join(out, 'soundtrack_raw.wav'), mix_.astype(np.float32), SR, subtype='PCM_24')
print('LUFS', round(meter.integrated_loudness(mix_), 2), 'peak dBFS', round(20 * np.log10(np.max(np.abs(mix_))), 2), 'len', len(mix_) / SR)
