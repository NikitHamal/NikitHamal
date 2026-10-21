#!/usr/bin/env python3
"""Designed sounds, synthesised from scratch (no samples, so no licence at all): layered tone/noise voices with envelopes,
swept filters, saturation and a small algorithmic reverb. The recipe format is in the spirit of React Bits' Sound Lab
(layers + env + filter sweeps), but every recipe and the engine here are original.  -> build/audio/sfx/<name>.wav"""
import os
import numpy as np
import soundfile as sf
from scipy import signal
SR = 48000
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = f"{HERE}/build/audio/sfx"


def env(n, a, h, d, curve=3.0):
    t = np.arange(n) / SR; e = np.zeros(n)
    e[t < a] = (t[t < a] / max(a, 1e-4)) ** 0.7
    m = (t >= a) & (t < a + h); e[m] = 1
    m = t >= a + h; e[m] = np.exp(-curve * (t[m] - a - h) / max(d, 1e-4))
    return e


def sweep(n, pts):
    t = np.arange(n) / SR; xs = [p[0] for p in pts]; ys = [np.log(p[1]) for p in pts]
    return np.exp(np.interp(t, xs, ys))


def osc(n, f, wave="sine", voices=1, detune=0.0, rng=None):
    rng = rng or np.random.default_rng(0)
    f = np.broadcast_to(np.asarray(f, float), (n,))
    y = np.zeros(n)
    for v in range(voices):
        cents = (v - (voices - 1) / 2) * detune / max(1, voices - 1) * 2 if voices > 1 else 0
        ph = np.cumsum(f * 2 ** (cents / 1200) / SR) + rng.random()
        if wave == "sine": y += np.sin(2 * np.pi * ph)
        elif wave == "saw": y += 2 * (ph % 1) - 1
        elif wave == "tri": y += 2 * np.abs(2 * (ph % 1) - 1) - 1
        elif wave == "square": y += np.sign(np.sin(2 * np.pi * ph))
    return y / voices


def noise(n, color="pink", rng=None):
    rng = rng or np.random.default_rng(1); w = rng.normal(0, 1, n)
    if color == "white": return w
    b, a = ([0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400])
    p = signal.lfilter(b, a, w)
    if color == "brown": p = signal.lfilter([1], [1, -0.995], w)
    return p / (np.abs(p).max() + 1e-9)


def tvf(x, fc, kind="low", q=0.7, block=256):
    """Time-varying filter: Butterworth sections re-designed every block, state carried across blocks."""
    y = np.zeros_like(x); zi = None
    for i in range(0, len(x), block):
        f = float(np.clip(np.mean(fc[i:i + block]) if np.ndim(fc) else fc, 30, SR / 2.3))
        if kind == "band":
            lo, hi = max(20, f / (1 + 0.5 / q)), min(SR / 2.2, f * (1 + 0.5 / q))
            sos = signal.butter(1, [lo / (SR / 2), hi / (SR / 2)], btype="bandpass", output="sos")
        else:
            sos = signal.butter(2, f / (SR / 2), btype="lowpass" if kind == "low" else "highpass", output="sos")
        if zi is None: zi = np.zeros((sos.shape[0], 2))
        y[i:i + block], zi = signal.sosfilt(sos, x[i:i + block], zi=zi)
    return y


def reverb(x, mix=0.3, decay=2.5, pre=0.02, damp=4000, seed=5):
    n = int(SR * decay); rng = np.random.default_rng(seed)
    ir = rng.normal(0, 1, n) * np.exp(-6.9 * np.arange(n) / n)
    ir = signal.lfilter(*signal.butter(1, damp / (SR / 2)), ir)
    ir = np.concatenate([np.zeros(int(pre * SR)), ir]); ir /= np.sqrt(np.sum(ir ** 2))
    L = signal.fftconvolve(x, ir)[:len(x) + n] * 0.5
    R = signal.fftconvolve(x, np.roll(ir, 37))[:len(x) + n] * 0.5
    dry = np.pad(x, (0, len(L) - len(x)))
    return np.stack([dry * (1 - mix) + L * mix, dry * (1 - mix) + R * mix], 1)


def sat(x, drive):
    return np.tanh(x * (1 + 6 * drive)) / np.tanh(1 + 6 * drive) if drive > 0 else x


def norm(x, peak=0.89):
    return x * peak / (np.abs(x).max() + 1e-9)


# ------------------------------------------------------------------ recipes
def braam(dur=3.2, root=36.71):
    n = int(SR * dur); rng = np.random.default_rng(119)
    y = np.zeros(n); e = env(n, 0.05, 0.45, 2.2, 3)
    cut = sweep(n, [(0, 250), (0.25, 1600), (2.6, 320)])
    for mult, g, v in ((2, 1.0, 6), (4, 0.5, 4), (6, 0.3, 3)):
        y += g * tvf(osc(n, root * mult, "saw", v, 14, rng), cut) * e
    y += 0.8 * osc(n, root, "sine") * env(n, 0.03, 0.2, 2.4, 4)
    y += 0.2 * tvf(noise(n), sweep(n, [(0, 2000), (0.3, 300)])) * env(n, 0.01, 0, 0.3, 5)
    return reverb(norm(sat(y, 0.25)), 0.3, 3.0, 0.02, 2500)


def impact(dur=4.0, body=48.0):
    n = int(SR * dur)
    f = sweep(n, [(0, body * 3.2), (0.12, body), (dur, body * 0.85)])
    y = 1.0 * osc(n, f) * env(n, 0.002, 0.04, 1.6, 4)
    y += 0.55 * tvf(noise(n, "white"), sweep(n, [(0, 6000), (0.2, 500)])) * env(n, 0.001, 0, 0.25, 6)
    y += 0.35 * tvf(noise(n), 180) * env(n, 0.003, 0.05, 1.8, 3)
    return reverb(norm(sat(y, 0.35)), 0.35, 3.5, 0.015, 3000)


def riser(dur=3.0):
    n = int(SR * dur); t = np.arange(n) / SR; k = t / dur
    y = 0.6 * tvf(noise(n), sweep(n, [(0, 300), (dur, 9000)])) * k ** 2
    y += 0.4 * osc(n, sweep(n, [(0, 110), (dur, 880)]), "saw", 5, 20) * k ** 2.5
    y = tvf(y, sweep(n, [(0, 600), (dur, 12000)]))
    y *= np.clip((dur - t) / 0.03, 0, 1)  # hard stop so the hit lands clean
    return reverb(norm(y), 0.25, 1.5)


def whoosh(dur=1.2, up=True):
    n = int(SR * dur); t = np.arange(n) / SR
    shape = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    fc = sweep(n, [(0, 400 if up else 4000), (dur * 0.55, 3500 if up else 800), (dur, 900)])
    y = tvf(noise(n), fc, "band", 1.2) * shape
    pan = np.linspace(-0.7, 0.7, n)
    st = np.stack([y * np.sqrt((1 - pan) / 2), y * np.sqrt((1 + pan) / 2)], 1)
    return norm(st) * 0.9


def shimmer(dur=3.0, root=587.33):
    n = int(SR * dur); y = np.zeros(n); rng = np.random.default_rng(4)
    for i, m in enumerate((1, 1.5, 2, 3, 4)):
        st = int(SR * 0.06 * i)
        z = osc(n - st, root * m, "sine") * env(n - st, 0.004, 0.0, 1.6 / (1 + 0.3 * i), 3) * (0.7 ** i)
        y[st:] += z
    return reverb(norm(y), 0.5, 3.5, 0.03, 7000) * 0.8


def blip(f=880, dur=0.18):
    """8-bit square blip for the pixel calendar (one per moon)."""
    n = int(SR * dur); y = osc(n, sweep(n, [(0, f), (dur, f * 1.5)]), "square") * env(n, 0.002, 0.03, 0.08, 4)
    y = tvf(y, 5000)
    return np.stack([y, y], 1) * 0.5


def subdrop(dur=2.5):
    n = int(SR * dur)
    y = osc(n, sweep(n, [(0, 90), (dur, 28)])) * env(n, 0.01, 0.2, 1.6, 2.5)
    return norm(np.stack([y, y], 1)) * 0.9


def tick(f=2600):
    n = int(SR * 0.05); y = tvf(noise(n, "white"), f, "band", 4) * env(n, 0.0005, 0, 0.012, 5)
    return np.stack([y, y], 1) * 0.6


def shing(dur=2.0):
    """Metal blade ring (Navami tools): inharmonic partials, fast attack, long shimmer."""
    n = int(SR * dur); y = np.zeros(n)
    for f, g, d in ((1870, 1, 1.4), (2977, 0.6, 1.0), (4411, 0.4, 0.7), (6120, 0.25, 0.5), (957, 0.3, 1.6)):
        y += g * osc(n, f) * env(n, 0.001, 0, d, 3)
    y += 0.3 * tvf(noise(n, "white"), sweep(n, [(0, 9000), (0.3, 3000)]), "high") * env(n, 0.001, 0, 0.15, 5)
    return reverb(norm(y), 0.35, 2.5, 0.01, 9000) * 0.7


RECIPES = {"braam": braam, "braam_low": lambda: braam(3.6, 29.14), "impact": impact, "impact_soft": lambda: impact(3.0, 60) * 0.7,
           "riser": riser, "riser_long": lambda: riser(5.0), "whoosh": whoosh, "whoosh_down": lambda: whoosh(1.4, False),
           "shimmer": shimmer, "subdrop": subdrop, "tick": tick, "shing": shing,
           **{f"blip{i}": (lambda i=i: blip(440 * 2 ** (i / 12))) for i in range(0, 15)}}


def main():
    os.makedirs(OUT, exist_ok=True)
    for k, fn in RECIPES.items():
        y = fn()
        if y.ndim == 1: y = np.stack([y, y], 1)
        sf.write(f"{OUT}/{k}.wav", y.astype(np.float32), SR, subtype="PCM_24")
    print("sfx", len(RECIPES))


if __name__ == "__main__":
    main()
