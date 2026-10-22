#!/usr/bin/env python3
"""Score + mix (run on molab): narration, an original arrangement built from CC0 instrument recordings (tanpura, harmonium,
bansuri, tabla, hand drums, taiko), CC0 field recordings from Nepal, and the synthesised designed sounds (tools/sfx.py).
Every melodic source is moved to one tonic (D) so drone, flute and synth agree. Music ducks under the voice.
-> build/audio/score.wav (48 kHz, stereo, -14 LUFS integrated, peaks under -1 dBFS)."""
import json, os
import numpy as np
import soundfile as sf
import librosa
import pyloudnorm as pyln
from scipy import signal
SR = 48000
ROOTV = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); HERE = f"{ROOTV}/tihar"; A = f"{ROOTV}/build/audio"; OUTA = f"{ROOTV}/build_tihar/audio"
TL = json.load(open(f"{HERE}/timeline.json")); S = {s["id"]: s for s in TL["shots"]}
N = int((TL["duration"] + 2.5) * SR)
TONIC = 2  # D (pitch class)


def db(x): return 10 ** (x / 20)


_c = {}


def load(key, folder="src", tune=False, seconds=None, offset=0.0):
    ck = (key, folder, tune, seconds, offset)
    if ck in _c: return _c[ck]
    y, sr = sf.read(f"{A}/{folder}/{key}.wav", dtype="float32", always_2d=True)
    if sr != SR: y = librosa.resample(y.T, orig_sr=sr, target_sr=SR).T
    y = y[int(offset * SR):]
    if seconds: y = y[:int(seconds * SR)]
    if tune:
        mono = librosa.to_mono(y.T)[: SR * 30]
        chroma = librosa.feature.chroma_cqt(y=mono, sr=SR).mean(1)
        pc = int(np.argmax(chroma)); steps = ((TONIC - pc + 6) % 12) - 6
        if steps: y = np.stack([librosa.effects.pitch_shift(y[:, c], sr=SR, n_steps=steps) for c in range(2)], 1)
        print(f"tune {key}: pc {pc} -> D ({steps:+d} st)")
    y = y / (np.abs(y).max() + 1e-9)
    _c[ck] = y.astype(np.float32); return _c[ck]


class Bus:
    def __init__(self): self.x = np.zeros((N, 2), np.float32)

    def put(self, y, t, gain=0.0, fi=0.01, fo=0.05, dur=None, pan=0.0, loop=False):
        if y.ndim == 1: y = np.stack([y, y], 1)
        n = int(dur * SR) if dur else len(y)
        if loop and n > len(y): y = np.concatenate([y] * (n // len(y) + 1))
        y = y[:n].copy(); n = len(y)
        e = np.ones(n, np.float32); a = min(n, int(fi * SR)); b = min(n - a, int(fo * SR))
        if a: e[:a] = np.linspace(0, 1, a) ** 2
        if b: e[-b:] *= np.linspace(1, 0, b) ** 2
        y *= (e * db(gain))[:, None]
        if pan: y *= np.array([np.sqrt((1 - pan) / 2) * 1.414, np.sqrt((1 + pan) / 2) * 1.414], np.float32)
        s = int(t * SR); s0 = max(0, s); e0 = min(N, s + n)
        if e0 > s0: self.x[s0:e0] += y[s0 - s:e0 - s]


def at(sid, u=0.0): return S[sid]["start"] + u * S[sid]["dur"]


def main():
    os.makedirs(OUTA, exist_ok=True)
    music, amb, fx, vo = Bus(), Bus(), Bus(), Bus()
    sx = lambda k: load(k, "sfx")
    for sid, s in S.items():
        if s.get("vo_at"):
            y, sr = librosa.load(f"{HERE}/audio/vo/{sid:02d}.mp3", sr=SR, mono=True)
            vo.put(y / (np.abs(y).max() + 1e-9), s["vo_at"], -1.5, 0.005, 0.08)
    D = TL["duration"]
    # open: a lamp is lit, the valley fills with light; distant fireworks
    amb.put(load("lamp_lighting", seconds=4.0), 0.4, -7, 0.01, 1.0)
    amb.put(load("fire_crackle", seconds=12), 0.8, -26, 1.5, 2.0)
    amb.put(load("fireworks_distant", seconds=12, offset=20), 2.0, -24, 2.0, 2.0, dur=at(3) - 2.0)
    music.put(load("tanpura", tune=True), 0.6, -10, 4.0, 3.0, dur=at(3) + 1.0, loop=True)
    fx.put(sx("shimmer"), at(2) + 0.1, -9); fx.put(sx("subdrop"), at(2) + 0.05, -7)
    fx.put(load("singing_bowl", seconds=10), at(2) + 0.2, -14, 0.01, 3.0)
    # the legend: Yama's shadow, the oil ring, Yamuna's words
    music.put(load("harmonium_drone", tune=True), at(3) - 0.4, -13, 2.0, 2.5, dur=at(7) - at(3) + 0.4, loop=True)
    fx.put(sx("braam_low"), at(3, 0.12), -7)
    amb.put(load("wind_mountain_crickets", seconds=14), at(3), -20, 1.0, 1.5, dur=S[3]["dur"])
    amb.put(load("buffalo", seconds=4, offset=8.0), at(3, 0.55), -18, 0.2, 1.0)
    amb.put(load("oil_pour", seconds=10, offset=5), at(4, 0.1), -14, 0.3, 1.0, dur=S[4]["dur"] * 0.85)
    fx.put(load("bell_small"), at(4, 0.05), -16)
    music.put(load("bansuri_grave", tune=True), at(5) + 0.3, -13, 0.8, 2.0)
    fx.put(sx("shimmer"), at(6, 0.1), -12)
    fx.put(load("temple_bells_hindu", seconds=8), at(6, 0.3), -17, 0.1, 2.0)
    # the five days
    music.put(load("tabla_kherwa", tune=False), at(7) + 0.2, -15, 0.5, 1.5, dur=at(11) - at(7), loop=True)
    music.put(load("tanpura", tune=True), at(7), -13, 1.0, 2.0, dur=at(16) - at(7), loop=True)
    amb.put(load("amb_nagarkot_dawn", seconds=12, offset=30), at(7), -18, 0.8, 1.2, dur=S[7]["dur"])
    amb.put(load("crows_01", seconds=10), at(7, 0.1), -12, 0.2, 1.2)
    amb.put(load("crows_murder", seconds=8, offset=10), at(7, 0.45), -16, 0.5, 1.5)
    for i in range(10): fx.put(sx("blip%d" % [0, 4, 7, 12, 7, 4, 0, 4, 7, 12][i]), at(8) + 0.2 + i * 0.16, -21)
    amb.put(load("dog_barking", seconds=6, offset=2), at(8, 0.3), -15, 0.05, 0.8)
    amb.put(load("dogs_group", seconds=6, offset=4), at(8, 0.7), -22, 0.3, 1.0)
    amb.put(load("cow_bell", seconds=8), at(9, 0.05), -15, 0.05, 1.5)
    amb.put(load("cow_moo", seconds=5), at(9, 0.2), -20, 0.1, 1.0)
    fx.put(load("conch", seconds=8), at(9, 0.48), -12, 0.05, 1.5)
    amb.put(load("amb_patan_bells_conch", seconds=12, offset=40), at(9, 0.5), -19, 0.6, 1.2, dur=S[9]["dur"] * 0.5)
    amb.put(load("fireworks_diwali", seconds=14, offset=30), at(10) - 0.3, -15, 0.6, 1.2, dur=S[10]["dur"] + 0.3)
    fx.put(load("firecracker", seconds=4), at(10, 0.35), -14); fx.put(load("firecracker", seconds=4), at(10, 0.7), -17)
    music.put(load("busker_madal_ktm", tune=False, offset=4), at(11) - 0.2, -12, 0.5, 1.2, dur=S[11]["dur"] + 0.4)
    amb.put(load("children_playing", seconds=10), at(11), -19, 0.5, 1.0, dur=S[11]["dur"])
    amb.put(load("girls_laughing", seconds=4), at(11, 0.55), -19, 0.2, 0.8)
    amb.put(load("cow_bell", seconds=6, offset=4), at(12, 0.1), -16, 0.2, 1.2)
    music.put(load("bansuri_set", tune=True), at(12) + 0.4, -15, 0.6, 1.5)
    fx.put(load("singing_bowl", seconds=8), at(13, 0.1), -15, 0.01, 2.5)
    amb.put(load("amb_patan_walla", seconds=10, offset=50), at(13), -21, 0.6, 1.2, dur=S[13]["dur"])
    fx.put(sx("riser"), at(14, 0.25) - 3.0, -13); fx.put(sx("impact_soft"), at(14, 0.25), -8); fx.put(load("conch", seconds=8), at(14, 0.28), -12, 0.05, 1.5)
    music.put(load("bansuri_dhun", tune=True, offset=95, seconds=60), at(15) - 0.3, -13, 1.5, 3.0, dur=D - at(15) + 2.0)
    fx.put(load("walnut_crack", seconds=1.5), at(15, 0.62), -10)
    amb.put(load("girls_laughing", seconds=4, offset=6), at(15, 0.75), -21, 0.2, 0.8)
    fx.put(sx("shimmer"), at(16, 0.1), -12); fx.put(load("bell_small"), at(16, 0.4), -16)
    amb.put(load("fireworks_distant", seconds=12, offset=60), at(17), -20, 1.0, 1.5, dur=S[17]["dur"])
    music.put(load("tanpura", tune=True), at(16) - 0.5, -11, 1.5, 3.0, dur=D - at(16) + 2.0, loop=True)
    fx.put(load("ghanta_big", seconds=14), at(18) + 0.4, -12, 0.01, 4.0); fx.put(sx("shimmer"), at(18) + 0.6, -12); fx.put(load("bell_small"), at(19) + 0.2, -16)
    v = np.abs(vo.x).mean(1)
    env = np.clip(signal.lfilter([1 - 0.9995], [1, -0.9995], (v > 0.02).astype(np.float32)) * 4, 0, 1)
    mix = music.x * (1 - 0.55 * env)[:, None] * db(-1) + amb.x * (1 - 0.4 * env)[:, None] + fx.x + vo.x * db(1.5)
    meter = pyln.Meter(SR); lufs = meter.integrated_loudness(mix); mix = mix * db(-14 - lufs)
    if np.abs(mix).max() > db(-1): mix = np.tanh(mix / db(-1)) * db(-1)
    sf.write(f"{OUTA}/score.wav", mix.astype(np.float32), SR, subtype="PCM_24")
    print("tihar score", round(len(mix) / SR, 2), "s; was", round(lufs, 1), "LUFS -> -14")


main()
