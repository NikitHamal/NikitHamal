"""Soundtrack for "Vijaya" (the Dashain reel), synthesised from scratch in numpy: no samples, no licences.
100 BPM, 30 fps (beat = 18 f, bar = 72 f), 74.4 s. Sa = D. Voices: madal (bass + treble head), jhyamta (hand cymbals),
tanpura drone with a breathing jawari, bansuri (breath, meend glides, delayed vibrato), temple bells (ghanta), shankha
(conch), a choir pad for Durga, and sound design (kite-string saw and snap, a tape rewind, cannons, impacts, risers).
Every cue is a frame number from film/dashain.js. Writes festivals/out/dashain_score.wav (48 kHz, -14 LUFS)."""
import os, sys, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import synth
FPS = 30; BEAT = 18; BAR = 72; TOTAL_F = 31 * BAR
synth.init(TOTAL_F / FPS + 1.5, BEAT, 2083)
from synth import *

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

master('dashain', TOTAL_F / FPS)
