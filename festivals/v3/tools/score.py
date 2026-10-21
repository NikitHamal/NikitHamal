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
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); A = f"{HERE}/build/audio"
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
    music, amb, fx, vo = Bus(), Bus(), Bus(), Bus()
    sx = lambda k: load(k, "sfx")
    # ---------------- narration
    for sid, s in S.items():
        if s.get("vo_at"):
            y, sr = librosa.load(f"{HERE}/audio/vo/{sid:02d}.mp3", sr=SR, mono=True)
            vo.put(y / (np.abs(y).max() + 1e-9), s["vo_at"], -1.5, 0.005, 0.08)
    # ---------------- open: a diyo is struck in a dark room, the drone arrives
    amb.put(load("lamp_lighting", offset=0.0, seconds=4.0), 0.55, -6, 0.01, 1.0)
    fx.put(load("singing_bowl", seconds=12), 1.0, -10, 0.005, 3.0)
    amb.put(load("fire_crackle", seconds=12), 1.0, -24, 1.5, 2.0)
    music.put(load("tanpura", tune=True), 0.8, -9, 4.0, 3.0, dur=at(3) + 1.0, loop=True)
    fx.put(sx("shimmer"), at(2) + 0.1, -9)
    fx.put(sx("subdrop"), at(2) + 0.05, -6)
    # ---------------- myth
    music.put(load("harmonium_drone", tune=True), at(3) - 0.5, -14, 2.0, 2.0, dur=at(8) - at(3) + 0.5, loop=True)
    amb.put(load("paper_flutter", seconds=6, offset=3.0), at(3) + 0.3, -20, 0.5, 1.5)
    fx.put(sx("braam_low"), at(4) + 0.2, -6)
    amb.put(load("buffalo", seconds=6, offset=8.0), at(4, 0.42), -15, 0.2, 1.5)
    music.put(load("taiko_seq", tune=False), at(4, 0.35), -13, 2.5, 1.5, dur=at(7) - at(4, 0.35), loop=True)
    fx.put(sx("riser_long"), at(5, 0.4) - 5.0, -10)
    fx.put(sx("impact"), at(5, 0.4), -4)
    fx.put(load("conch", seconds=9), at(5, 0.43), -9, 0.05, 2.0)
    fx.put(load("ghanta_big", seconds=12), at(5, 0.45), -11, 0.01, 4.0)
    for n in range(9):                          # one small bell per night
        fx.put(load("bell_small"), at(6, 0.74 * n / 9) + 0.05, -17 + n * 0.5, pan=-0.4 + 0.1 * n)
    fx.put(sx("riser"), at(6, 0.74) - 3.0, -12)
    fx.put(sx("impact"), at(6, 0.74), -3)
    fx.put(sx("braam"), at(6, 0.74), -8)
    amb.put(load("kite_wind", seconds=12), at(7), -20, 0.8, 1.5)
    fx.put(sx("whoosh"), at(7, 0.3) - 0.3, -7)
    # ---------------- Nepal: the drone again, the flute begins
    music.put(load("tanpura", tune=True), at(8) - 0.4, -11, 2.0, 2.0, dur=at(11) - at(8) + 0.6, loop=True)
    music.put(load("bansuri_grave", tune=True), at(8) + 0.8, -12, 0.6, 2.0)
    fx.put(sx("subdrop"), at(8, 0.05), -9)
    amb.put(load("amb_patan_bells_conch", seconds=14, offset=20), at(9), -16, 1.0, 1.5, dur=S[9]["dur"])
    fx.put(load("temple_bells", seconds=10), at(9, 0.45), -12, 0.05, 2.5)
    music.put(load("bansuri_tremolo", tune=True), at(10) + 0.4, -15, 0.8, 2.0)
    fx.put(sx("riser"), at(10, 0.15), -16)
    amb.put(load("amb_durbar", seconds=12), at(10, 0.6), -22, 1.0, 1.5)
    # ---------------- the days: tabla enters; one 8-bit blip per moon on the pixel calendar
    music.put(load("tabla_kherwa", tune=False), at(11) + 0.2, -14, 0.4, 2.0, dur=at(17) - at(11), loop=True)
    music.put(load("tanpura", tune=True), at(11), -13, 1.0, 2.0, dur=at(17) - at(11) + 0.5, loop=True)
    for i in range(15): fx.put(sx("blip%d" % (i % 15)), at(11) + 0.15 + i * 0.07, -20)
    amb.put(load("rice_grains", seconds=6), at(12, 0.1), -17, 0.3, 1.5)
    amb.put(load("crickets", seconds=12), at(12), -26, 1.0, 1.0, dur=S[12]["dur"])
    music.put(load("bansuri_set6", tune=True), at(12) + 0.5, -16, 0.5, 1.5)
    for v in (0.55, 0.68, 0.81):
        fx.put(load("musket_volley", seconds=4), at(13, v), -8, 0.002, 1.2, pan=0.15)
    amb.put(load("gun_salute", seconds=8, offset=2.0), at(13, 0.5), -20, 0.4, 1.5)
    amb.put(load("fire_crackle", seconds=8), at(14), -18, 0.5, 1.0, dur=S[14]["dur"] * 0.47)
    fx.put(load("bell_small"), at(14, 0.1), -16)
    fx.put(sx("shing"), at(14, 0.47) + 0.1, -10)
    amb.put(load("amb_patan_bells_conch", seconds=12, offset=60), at(15), -18, 0.8, 1.5, dur=S[15]["dur"])
    amb.put(load("rice_pour", seconds=4, offset=1.0), at(15, 0.2), -20, 0.3, 1.0)
    amb.put(load("amb_night_bird", seconds=12), at(16), -18, 0.8, 1.5, dur=S[16]["dur"])
    fx.put(load("singing_bowl", seconds=8, offset=0.0), at(16, 0.35), -16, 0.01, 3.0)
    # ---------------- the people: madal and the street
    music.put(load("hand_drums", tune=False, offset=40), at(17) - 0.2, -15, 0.8, 1.5, dur=at(20) - at(17) + 0.4)
    music.put(load("bansuri_dhun", tune=True, offset=95, seconds=40), at(17) + 0.5, -14, 1.5, 2.0, dur=at(20) - at(17) + 0.4)
    amb.put(load("children_playing", seconds=12), at(17), -20, 0.5, 1.0, dur=S[17]["dur"])
    amb.put(load("rope_creak", seconds=10, offset=5), at(17), -18, 0.5, 1.0, dur=S[17]["dur"])
    amb.put(load("kite_wind", seconds=10, offset=12), at(17, 0.3), -22, 0.6, 1.0)
    amb.put(load("bus_idle", seconds=10), at(18), -16, 0.4, 0.8, dur=S[18]["dur"])
    fx.put(load("bus_horn", seconds=3, offset=1.0), at(18, 0.35), -18, 0.01, 0.6)
    amb.put(load("amb_patan_walla", seconds=12, offset=30), at(19), -18, 0.6, 1.2, dur=S[19]["dur"])
    amb.put(load("girls_laughing", seconds=4), at(19, 0.6), -22, 0.2, 0.8)
    # ---------------- blessing and the wish
    music.put(load("tanpura", tune=True), at(20) - 0.5, -10, 1.5, 3.0, dur=TL["duration"] - at(20) + 2.0, loop=True)
    music.put(load("bansuri_dhun", tune=True, offset=60, seconds=30), at(20) + 0.3, -12, 1.2, 3.0, dur=TL["duration"] - at(20) + 1.5)
    fx.put(sx("riser"), at(20, 0.8) - 3.0, -14)
    fx.put(sx("impact_soft"), at(20, 0.99), -8)
    fx.put(load("ghanta_big", seconds=14), at(21) + 0.4, -12, 0.01, 4.0)
    fx.put(sx("shimmer"), at(21) + 0.6, -12)
    fx.put(load("bell_small"), at(22) + 0.2, -16)
    # ---------------- mix: duck music and ambience under the voice
    v = np.abs(vo.x).mean(1)
    env = signal.lfilter([1 - 0.9995], [1, -0.9995], (v > 0.02).astype(np.float32))
    env = np.clip(env * 4, 0, 1)
    duck_m = (1 - 0.55 * env)[:, None]; duck_a = (1 - 0.4 * env)[:, None]
    mix = music.x * duck_m * db(-1) + amb.x * duck_a + fx.x + vo.x * db(1.5)
    meter = pyln.Meter(SR)
    lufs = meter.integrated_loudness(mix)
    mix = mix * db(-14 - lufs)
    pk = np.abs(mix).max()
    if pk > db(-1): mix = np.tanh(mix / db(-1)) * db(-1)
    sf.write(f"{A}/score.wav", mix.astype(np.float32), SR, subtype="PCM_24")
    sf.write(f"{A}/stems_vo.wav", vo.x, SR, subtype="PCM_16")
    print("score", round(len(mix) / SR, 2), "s; was", round(lufs, 1), "LUFS -> -14; peak", round(20 * np.log10(np.abs(mix).max()), 2), "dBFS")


main()
