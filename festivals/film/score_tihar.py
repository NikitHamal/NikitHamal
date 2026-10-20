"""Soundtrack for "Yamapanchak" (the Tihar reel), synthesised from scratch with film/synth.py.
120 BPM, 30 fps (beat = 15 f, bar = 60 f), 72 s. Sa = G. A match and a single flame, lamps lighting in a chain, a valley
bursting into a Deusi groove, a hard stop and a crow, the Yama-Yamuna legend over river water, then the five days:
crows, the dog's garland, cow bells and Laxmi's shimmering puja, Bhailo/Deusi chant stabs, storm and thunder for
Govardhan, a flap counter for Nepal Sambat, seven rising chimes for the seven colours, fireworks for the finale.
Writes festivals/out/tihar_score.wav."""
import os, sys, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import synth
FPS = 30; BEAT = 15; BAR = 60; TOTAL_F = 36 * BAR
synth.init(TOTAL_F / FPS + 1.5, BEAT, 1147)
from synth import *

# ---------- Tihar-specific sound design
def strike():   # a match: scratch, flare
    t = tt(0.9); scr = bp(noise(0.9), 2500, 8000) * env(len(t), 0.002, 0.05, 5) * 0.8
    flare = lp(noise(0.9), 3000) * np.minimum(1, t / 0.08) * np.exp(-t * 3) * 0.5; return scr + flare
def ignite(): t = tt(0.6); return lp(noise(0.6), 1200) * np.minimum(1, t / 0.03) * np.exp(-t * 6) * 0.5 + np.sin(2 * np.pi * np.cumsum(120 + 200 * np.exp(-t * 10)) / SR) * env(len(t), 0.005, 0.2, 4) * 0.3
def launch(d=0.6): t = tt(d); u = t / d; return (np.sin(2 * np.pi * np.cumsum(700 + 1600 * u) / SR) * 0.15 + hp(noise(d), 4000) * 0.15) * np.sin(np.pi * u * 0.98) ** 0.5
def burst():
    t = tt(2.4); b = lp(noise(2.4), 500) * env(len(t), 0.001, 0.4, 3) * 0.9 + np.sin(2 * np.pi * np.cumsum(55 + 30 * np.exp(-t * 8)) / SR) * env(len(t), 0.001, 0.3, 3) * 0.6
    cr = np.zeros(len(t)); n = 260
    for k in range(n): i = int(SR * (0.15 + 1.6 * rng.random() ** 1.5)); L = 300; cr[i:i + L] += bp(rng.standard_normal(L), 2000, 9000) * np.exp(-np.arange(L) / 40) * (1 - i / len(t)) * rng.uniform(0.3, 1)
    return b + cr * 0.6
def firework(t_launch): add(launch(), t_launch, 0.6, rng.uniform(-0.5, 0.5), 0.2); add(burst(), t_launch + 0.6, 0.7, rng.uniform(-0.4, 0.4), 0.35)
def caw():   # a crow: harsh nasal "kaa" with a falling pitch
    t = tt(0.32); f = 520 - 140 * t / 0.32; ph = 2 * np.pi * np.cumsum(f) / SR; src = np.sign(np.sin(ph)) * 0.6 + bp(noise(0.32), 800, 3000) * 0.5
    x = bp(src, 900, 1500) + bp(src, 2200, 2800) * 0.5; return x * np.minimum(1, t / 0.02) * np.minimum(1, (0.32 - t) / 0.1) * (1 + 0.6 * np.sin(2 * np.pi * 38 * t)) * 0.5
def river(d): t = tt(d); return lp(noise(d), 700) * (0.5 + 0.3 * np.sin(2 * np.pi * 0.3 * t)) * 0.12 + bp(noise(d), 2000, 5000) * (0.5 + 0.5 * np.sin(2 * np.pi * 1.7 * t) ** 8) * 0.03
def rain(d): t = tt(d); x = bp(noise(d), 1500, 9000) * 0.18 + lp(noise(d), 400) * 0.1; return x * np.minimum(1, t / 0.5) * np.minimum(1, (d - t) / 0.5)
def thunder(): t = tt(3.0); return lp(noise(3.0), 180) * (np.exp(-t * 1.2) * (1 + 0.8 * np.sin(2 * np.pi * 3 * t) ** 2)) * np.minimum(1, t / 0.02) * 1.4 + bp(noise(3.0), 400, 1500) * env(len(t), 0.002, 0.15, 4) * 0.4
def sizzle(d): t = tt(d); return hp(noise(d), 3000) * (0.6 + 0.4 * rng.random(len(t)) ** 8) * 0.12 * np.minimum(1, t / 0.05) * np.minimum(1, (d - t) / 0.2)
def crack(): t = tt(0.25); return (hp(noise(0.25), 1200) * env(len(t), 0.0003, 0.01, 6) * 1.2 + bp(noise(0.25), 500, 1500) * env(len(t), 0.0005, 0.03, 5) * 0.5)
def flap(): t = tt(0.05); return bp(noise(0.05), 1500, 6000) * env(len(t), 0.0003, 0.006, 6) * 0.8
def cowbell(f0=540): t = tt(1.2); x = sum(np.sin(2 * np.pi * f0 * r * t + rng.uniform(0, 6)) * a * np.exp(-t * k) for r, a, k in ((1, 1, 3), (1.48, 0.6, 4), (2.33, 0.4, 6), (3.1, 0.2, 8))); return x * 0.25 + bp(noise(1.2), 2000, 5000) * env(len(t), 0.0005, 0.01, 5) * 0.2
def chant(midis, d=0.4, vowel=(500, 900, 2600)):   # a crowd's sung stab ("re!", "lo!"): detuned saws through an "o" vowel, sharp attack
    t = tt(d); x = np.zeros(len(t))
    for m in midis:
        for det in np.linspace(-0.012, 0.012, 5): f = mid(m) * (1 + det) * (1 - 0.03 * np.exp(-t * 20)); ph = 2 * np.pi * np.cumsum(f) / SR + rng.uniform(0, 6); x += 2 * ((ph / (2 * np.pi)) % 1) - 1
    y = sum(bp(x, f * 0.85, f * 1.15) * g for f, g in zip(vowel, (1, 0.7, 0.25))) + bp(noise(d), 1000, 4000) * 0.3
    return y * np.minimum(1, t / 0.015) * np.exp(-np.maximum(0, t - 0.12) * 6) * 0.1
def tap(): t = tt(0.12); return lp(noise(0.12), 900) * env(len(t), 0.001, 0.03, 5) * 0.5

# ---------- arrangement (Sa = G)
S, R, G, M, P_, D, N_ = 67, 69, 71, 72, 74, 76, 78; S2, R2, G2 = 79, 81, 83
SA = mid(55); SA_L = mid(43); PA_L = mid(50)
def groove(b0, b1, level=1.0, fill_every=4, jh=True):
    for b in range(b0, b1):
        t0 = bt(b * 4)
        pat = ['D', 't', 'T', 'D', 't', 'D', 'T', 't'] if b % fill_every != fill_every - 1 else ['D', 't', 'T', 't', 'T', 'T', 'T', 'T']   # a jhyaure-ish lilt
        for e, kind in enumerate(pat):
            tm = t0 + bt(e * 0.5) + (bt(0.5) * 0.08 if e % 2 else 0); v = level * (0.9 + 0.2 * rng.random())
            if kind == 'D': add(madal_bass(), tm, 0.85 * v, -0.15, 0.08)
            elif kind == 'T': add(madal_ta(True, 440), tm, 0.5 * v, 0.2, 0.12)
            else: add(madal_ta(False, 440), tm, 0.32 * v, 0.25, 0.08)
        if jh: [add(jhyamta(), t0 + bt(k + 0.5), 0.15 * level, 0.45, 0.2) for k in range(4)]
def drone(t0, t1, level=1.0):
    t = t0; k = 0
    while t < t1: add(tanpura([PA_L, SA, SA, SA_L][k % 4], 4.8), t, level * [1, 0.8, 0.8, 1.1][k % 4], [-0.4, -0.1, 0.1, 0.4][k % 4], 0.25); t += bt(2); k += 1
DEUSI = [(0, .5, S), (.5, .5, S), (1, .5, R), (1.5, .5, G), (2, 1, P_), (3, 1, G), (4, .5, R), (4.5, .5, G), (5, .5, R), (5.5, .5, S), (6, 2, R)]
DEUSI2 = [(0, .5, P_), (.5, .5, D), (1, .5, S2), (1.5, .5, D), (2, 1, P_), (3, 1, G), (4, .5, R), (4.5, .5, G), (5, 1, R), (6, 2, S)]
def theme(b, parts='AB', g=1.0, o=0):
    ns = []; off = 0
    for p in parts: ns += [(x + off, l, m + o) for x, l, m in (DEUSI if p == 'A' else DEUSI2)]; off += 8
    flute(ns, bt(b * 4), g)

# 0. cold open: match, one flame, lamp to lamp, the valley (groove from bar 2), first firework
add(strike(), fs(6), 0.8, 0.2, 0.2); add(ignite(), fs(12), 0.8, 0, 0.3); add(bell(mid(79), 4, 0.8), fs(12), 0.2, 0, 0.6)
drone(fs(12), fs(180), 0.8); flute([(0, 2, D), (2, 1, P_), (3, 1, G), (4, 3, P_)], fs(14), 0.7, 0.5)
lit = sorted({abs(i) * 4 for i in range(-5, 6)})
for k, d_ in enumerate(lit): add(ignite(), fs(60 + d_), 0.35, (k % 2) * 0.6 - 0.3, 0.2); add(pluck(mid([S, R, G, P_, D, S2][k])), fs(60 + d_), 0.35, (k % 2) * 0.6 - 0.3, 0.4)
add(riser(1.8), fs(120) - 0.6, 0.35, 0, 0.3); groove(2, 3, 0.9); add(choir([55, 62, 67, 71], 2.2), fs(120), 0.7, 0, 0.5)
firework(fs(150) - 0.6)
# 1. the turn: hard stop, a crow
add(impact(0.5), fs(180), 0.5, 0, 0.4); add(caw(), fs(190), 0.9, -0.3, 0.3); add(caw(), fs(203), 0.7, 0.3, 0.3); add(caw(), fs(222), 0.8, 0, 0.35)
add(whoosh(1.0, False, 300, 3000), fs(181), 0.2, 0, 0.3)
# 2. Yama and Yamuna: river, low drums, a minor flute
add(river(6.2), fs(240), 1, 0, 0.2); drone(fs(240), fs(420), 0.8)
for k in range(6): add(madal_bass(1.3), fs(240) + k * bt(2), 0.7, 0, 0.3)
flute([(0, 2, 67), (2, 1, 68), (3, 1, 70), (4, 3, 67), (8, 2, 72), (10, 1, 70), (11, 1, 68), (12, 4, 67)], fs(250), 0.7, 0.55, pan=0.2, vib=0.3)
add(bell(mid(55), 5, 0.6), fs(330), 0.25, 0, 0.6)
# 3-8. the five days: groove under everything, a bell + whoosh at each new day
groove(7, 15, 0.85); drone(fs(420), fs(1260), 0.7); theme(7, 'AB', 0.9)
for f in (420, 540, 660, 720, 1080, 1200, 1260): add(bell(mid(83), 2.5), fs(f), 0.18, 0.3, 0.6); add(whoosh(0.4, True, 500, 5000), fs(f) - 0.3, 0.18)
for k, f in enumerate((426, 440, 455, 470)): add(caw(), fs(f), 0.5, -0.4 + k * 0.25, 0.3)
add(whoosh(0.5, False, 600, 4000), fs(594), 0.3, 0, 0.3); add(bell(mid(86), 1.5, 1.4), fs(594 + 14), 0.2, 0.2, 0.5); add(bleep(900, 1500), fs(618), 0.45, 0.2)
for k in range(3): add(cowbell(), fs(670 + k * 14), 0.5, -0.2, 0.3)
add(riser(1.6), fs(720), 0.3, 0, 0.4); [add(bell(mid(91 + [0, 2, 4, 7][k % 4]), 1.0, 1.4), fs(720) + 1.6 + k * 0.06, 0.06, (k % 2) - 0.5, 0.6) for k in range(16)]
for k in range(6): add(tap(), fs(780 + k * BEAT), 0.5, (k % 2) * 0.4 - 0.2, 0.2)
for k in range(10): add(bell(mid(96 + (k % 3) * 2), 0.8, 1.6), fs(720) + 4.2 + k * 0.12, 0.05, rng.uniform(-0.6, 0.6), 0.6)
# 6. Deusi-Bhailo: the groove peaks, chant stabs on every call
groove(15, 18, 1.1, 2); theme(16, 'A', 0.8, 0)
for i in range(6): tm = fs(900 + 30 * i); add(chant([S2, D, S] if i < 2 else [S, P_ - 12, G - 12], 0.5, (600, 1000, 2700) if i < 2 else (450, 800, 2500)), tm, 1.0, (i % 2) * 0.5 - 0.25, 0.3); add(madal_bass(1.2), tm, 0.6)
# 7. Govardhan: storm, thunder on the lightning flashes, a riser as the hill lifts; Mha Puja flap counter
add(rain(4.2), fs(1080), 1, 0, 0.2)
def jshash(x, y=0, s=0):   # mirror of PX.hash so thunder lands on the film's lightning frames
    h = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xffffffff; h = h - (1 << 32) if h >= (1 << 31) else h
    h2 = (h ^ ((h & 0xffffffff) >> 13)) & 0xffffffff; h2 = (h2 * 1274126177) & 0xffffffff; return ((h2 ^ (h2 >> 16)) & 0xffffffff) / 4294967296
last = -99
for i in range(20):
    if jshash(i, 9) > 0.85 and i - last > 2: add(thunder(), fs(1080 + i * 6) + 0.05, 0.6, rng.uniform(-0.4, 0.4), 0.3); last = i
add(riser(1.2), fs(1080) + 0.6, 0.35, 0, 0.3); groove(18, 20, 0.8, 4, jh=False)
add(bell(mid(67), 3, 1), fs(1200), 0.3, 0, 0.6); [add(flap(), fs(1218) + k * 0.03, 0.5, 0.1) for k in range(12)]; add(bleep(700, 1400), fs(1234), 0.4)
# 8. Bhai Tika: tender, seven rising chimes for the seven colours, the garland, the walnut
drone(fs(1260), fs(1560), 0.9); add(choir([55, 62, 67], 4), fs(1260), 0.5, 0, 0.6)
flute([(0, 2, S2), (2, 1, D), (3, 1, P_), (4, 2, G), (6, 2, P_), (8, 3, D), (11, 1, P_), (12, 4, G)], fs(1270), 0.8, 0.5)
for k in range(7): add(bell(mid([67, 69, 71, 74, 76, 79, 81][k]), 2.5, 1.0), fs(1320 + k * BEAT), 0.3, -0.6 + k * 0.2, 0.5)
add(whoosh(0.6, False, 500, 4000), fs(1435), 0.3, 0, 0.3); add(bell(mid(86), 2.5), fs(1448), 0.25, 0, 0.6); add(crack(), fs(1510), 0.9, -0.4, 0.2)
for k in range(4): add(madal_bass(0.8), fs(1440) + bt(k * 2), 0.4, 0, 0.2)
# 9. montage: everything on, a hit per cut
groove(26, 29, 1.1, 2); drone(fs(1560), fs(1740), 0.8); theme(26, 'A', 1.0, 12)
for k in range(6): add(impact(0.3), fs(1560 + 30 * k), 0.45, 0, 0.2)
add(sizzle(1.0), fs(1560), 1, 0, 0.1); firework(fs(1590) - 0.3); firework(fs(1598) - 0.2); [add(bleep(1200 + 200 * k, 1300 + 200 * k, 0.05), fs(1620) + k * 0.12, 0.25, (k % 2) - 0.5) for k in range(8)]
add(chant([S, G - 12], 0.4), fs(1680), 0.6)
# 10. POV: seven chimes as the colours are painted on the viewer
add(choir([55, 62, 67, 71], 4), fs(1740), 0.5, 0, 0.6)
for k in range(7): add(bell(mid([67, 69, 71, 74, 76, 79, 83][k]), 3, 1.2), fs(1755 + k * BEAT), 0.32, -0.6 + k * 0.2, 0.55); add(whoosh(0.3, False, 800, 6000), fs(1755 + k * BEAT) - 0.1, 0.12)
add(riser(1.4), fs(1860) - 1.4, 0.4, 0, 0.3)
# 11. finale: lamps draw Nepal, the title lands, fireworks, final chord
add(impact(0.9), fs(1860), 0.8, 0, 0.5); drone(fs(1860), fs(2160), 1.0); add(choir([43, 50, 55, 62, 67, 71], 6), fs(1860), 0.9, 0, 0.6)
for k in range(40): add(bell(mid(91 + [0, 2, 4, 7, 9][k % 5]), 0.6, 1.5), fs(1900) + k * 0.05, 0.04, rng.uniform(-0.7, 0.7), 0.7)
groove(32, 35, 1.0); theme(32, 'AB', 1.0)
add(impact(0.8), fs(1990), 0.7, 0, 0.5); add(conch(mid(67), 2.6), fs(1990), 0.45, 0, 0.5)
for f in (2040, 2070, 2085): firework(fs(f))
tf = fs(2100); add(choir([43, 55, 62, 67, 71, 74], 3.5), tf, 1.1, 0, 0.6); add(madal_bass(1.3), tf, 1.0); add(jhyamta(1.5), tf, 0.3, 0.4, 0.5)
[add(bell(mid(m), 4), tf + d_, 0.28, p, 0.7) for m, d_, p in ((67, 0, -0.3), (74, .12, .3), (79, .24, 0), (83, .36, -.2))]
flute([(0, 3, S2)], tf, 0.8, 0.6, vib=0.3)
master('tihar', TOTAL_F / FPS)
