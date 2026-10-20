"""Score for the Dashain film v2: three licensed music beds (no attribution required, see audio/SOURCES.md) cut on their own
beat grids so every picture cut lands on a beat, plus recorded SFX placed on picture events. The cue times mirror CUES in
film3d/dashain.js. Writes out/dashain3d_score.wav. Needs audio/wav/ (python3 tools/fetch_audio.py builds it)."""
import os, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); A = os.path.join(ROOT, 'audio', 'wav'); SR = 48000
bA, bB, bC = 60 / 129.2, 60 / 117.5, 60 / 80.7; tB = 16 * bA; tC = tB + 41 * bB
A_ = lambda n: n * bA; B_ = lambda n: tB + n * bB; C_ = lambda n: tC + n * bC
CUT, MAHISH, DURGA, FORM, NAVA, VICT = A_(10), B_(8), B_(16), B_(20), B_(26), B_(35)
MAP, GHATA, FUL, CANNON, ASHT, NAVM, TIKA, KOJA, LIFE, POV, STAMP, WISH, END = C_(0), C_(7), C_(13), [C_(14), C_(15), C_(16)], C_(17), C_(20), C_(23), C_(32), C_(36), C_(44), C_(47), C_(49), C_(61)
DUR = END + 1.4; N = int(DUR * SR) + SR
mixL = np.zeros((2, N)); mus = np.zeros((2, N))

def load(name):
    x, sr = sf.read(os.path.join(A, name + '.wav'), always_2d=True); x = x.T.astype(np.float64)
    if x.shape[0] == 1: x = np.vstack([x, x])
    assert sr == SR, (name, sr); return x
def db(g): return 10 ** (g / 20)
def place(buf, x, t, g=0.0, fade_in=0.0, fade_out=0.0, length=None, pan=0.0):
    x = x[:, :int(length * SR)] if length else x; x = x.copy() * db(g); n = x.shape[1]
    if fade_in: k = min(n, int(fade_in * SR)); x[:, :k] *= np.linspace(0, 1, k)
    if fade_out: k = min(n, int(fade_out * SR)); x[:, n - k:] *= np.linspace(1, 0, k) ** 1.5
    if pan: x[0] *= np.sqrt(0.5 * (1 - pan)) * 1.414; x[1] *= np.sqrt(0.5 * (1 + pan)) * 1.414
    i = int(round(t * SR))
    if i < 0: x = x[:, -i:]; i = 0
    j = min(buf.shape[1], i + x.shape[1]); buf[:, i:j] += x[:, :j - i]
def seg(x, off, length): i = int(off * SR); return x[:, i:i + int(length * SR)]
def lp(x, f): return sosfilt(butter(2, f, 'lowpass', fs=SR, output='sos'), x, axis=1)
def beat_near(path, t):
    import librosa; y, sr = librosa.load(os.path.join(A, path + '.wav'), sr=22050); _, b = librosa.beat.beat_track(y=y, sr=sr); bt = librosa.frames_to_time(b, sr=sr); return float(bt[np.argmin(np.abs(bt - t))])

# ---------- music beds, each entering on its own beat
arulo = load('music_india_arulo'); offA = beat_near('music_india_arulo', 29.6)
a = seg(arulo, offA, tB + 0.6).copy(); k0 = int((CUT - 0.02) * SR); a[:, k0:] = lp(a[:, k0:], 900) * np.linspace(1, 0.25, a.shape[1] - k0)   # after the cut the music falls away with the kite
place(mus, a, 0, -1.5, fade_in=0.02, fade_out=0.6)
drums = load('music_epic_drums_02_percussion_trailer'); offB = beat_near('music_epic_drums_02_percussion_trailer', 4.0)
place(mus, seg(drums, offB, tC - tB + 0.8), tB, -2.5, fade_in=0.05, fade_out=0.9)
taiko = load('music_taiko_drums_mastered'); offT = beat_near('music_taiko_drums_mastered', 2.4); place(mus, seg(taiko, offT, DURGA - MAHISH + 0.4), MAHISH, -9, fade_in=0.2, fade_out=0.4)
medit = load('music_indian_meditations_world'); offC = beat_near('music_indian_meditations_world', 4.5)
c = seg(medit, offC, DUR - tC + 0.5).copy(); env = np.ones(c.shape[1]); tt = np.arange(c.shape[1]) / SR + tC
env *= np.interp(tt, [POV - 0.3, POV + 0.6, STAMP, WISH - 0.2, WISH + 0.4], [1, 0.22, 0.18, 0.18, 1])   # thins out for the tika on you, returns for the wish
place(mus, c * env, tC, -2.0, fade_in=0.08, fade_out=1.6)
bans = load('music_nepali_bansuri_dhun_solo'); place(mus, seg(bans, 2.0, WISH - POV + 2.5), POV, -17, fade_in=0.6, fade_out=1.2)

# ---------- SFX on picture events
S = {n: load(n) for n in ['amb_morning_birds', 'sfx_wind_swoosh_passing_kite', 'sfx_riser_cinematic_synth', 'sfx_impact_whoosh_deep', 'sfx_crowd_cheer_short', 'sfx_wind_swoosh_transition', 'sfx_reverse_cinematic_impact', 'sfx_braam',
  'sfx_paper_rustle', 'sfx_sub_rumble_drop', 'sfx_buffalo_nepal', 'sfx_bison_snort_huffs', 'sfx_beast_growl_mythical', 'sfx_impact_epic_movie', 'sfx_conch_shankha_blow', 'sfx_temple_bell_ghanta_big', 'sfx_chime_crystal', 'sfx_bell_cinematic_hit',
  'sfx_whoosh_fast_air_sweep', 'sfx_impact_trailer_epic', 'sfx_crowd_cheer_victory', 'sfx_drums_of_war_hit', 'sfx_sparkle_fairy_whoosh', 'sfx_temple_bell_small_hand_ring', 'sfx_rice_pour', 'sfx_oil_lamp_candle_lighting', 'sfx_cannon_shot',
  'sfx_temple_bells_hindu', 'amb_crickets_night', 'sfx_whoosh_tunnel_reverb', 'sfx_rice_grains_cup', 'amb_patan_durbar_bells_conch_nepal', 'sfx_wind_chimes', 'sfx_whoosh_swirling', 'sfx_impact_big_cinematic', 'sfx_sparkle_magic_wand', 'sfx_whoosh_cinematic_fast']}
dur = lambda n: S[n].shape[1] / SR
def sfx(n, t, g, **k): place(mixL, S[n], t, g, **k)
def ending_at(n, t_end, g, **k): sfx(n, t_end - dur(n), g, **k)
# kites
sfx('amb_morning_birds', 0, -20, length=tB, fade_in=0.3, fade_out=1.0); sfx('sfx_wind_swoosh_passing_kite', 0.2, -12, pan=-0.3); sfx('sfx_wind_swoosh_passing_kite', 2.6, -15, pan=0.4)
ending_at('sfx_riser_cinematic_synth', CUT, -14); sfx('sfx_impact_whoosh_deep', CUT - 0.05, -4); sfx('sfx_crowd_cheer_short', CUT + 0.05, -7); sfx('sfx_wind_swoosh_transition', CUT + 0.3, -9)
# into the past
ending_at('sfx_reverse_cinematic_impact', tB, -8); sfx('sfx_braam', tB, -7)
for i in range(6): sfx('sfx_paper_rustle', B_(i) + 0.05, -16, length=0.8, fade_out=0.3, pan=(i % 2 - 0.5) * 0.6)
# Mahishasura
sfx('sfx_sub_rumble_drop', MAHISH, -6); sfx('sfx_buffalo_nepal', MAHISH + 0.35, -9, length=2.5, fade_out=0.6); sfx('sfx_beast_growl_mythical', MAHISH + 1.1, -14, length=2.5, fade_out=0.6); sfx('sfx_bison_snort_huffs', MAHISH + 2.6, -10, length=1.6, fade_out=0.4)
# Durga: the light converges, the form arrives on a conch and the big bell
ending_at('sfx_riser_cinematic_synth', FORM, -12); sfx('sfx_impact_epic_movie', FORM, -4); sfx('sfx_conch_shankha_blow', FORM + 0.05, -5); sfx('sfx_temple_bell_ghanta_big', FORM + 0.1, -9, length=6, fade_out=2.0); sfx('sfx_chime_crystal', FORM + 0.4, -16)
# nine nights
for n in range(9): (sfx('sfx_bell_cinematic_hit', B_(26 + n), -12, length=1.4, fade_out=0.5) if n in (0, 4, 8) else sfx('sfx_whoosh_fast_air_sweep', B_(26 + n) - 0.1, -18))
# victory
sfx('sfx_impact_trailer_epic', VICT, -3); sfx('sfx_drums_of_war_hit', VICT, -8); sfx('sfx_crowd_cheer_victory', VICT + 0.6, -12, length=2.6, fade_out=0.8)
# Nepal and the fifteen days
sfx('sfx_sparkle_fairy_whoosh', MAP + 0.2, -12); sfx('sfx_temple_bell_small_hand_ring', MAP + 1.1, -15, length=2.5, fade_out=0.8)
sfx('sfx_oil_lamp_candle_lighting', GHATA + 0.1, -11); sfx('sfx_rice_pour', GHATA + 0.7, -12, length=2.6, fade_out=0.6)
for k, tc in enumerate(CANNON): sfx('sfx_cannon_shot', tc, -5, pan=(k - 1) * 0.4)
sfx('amb_crickets_night', ASHT, -22, length=TIKA - ASHT, fade_in=0.4, fade_out=0.6); sfx('sfx_temple_bells_hindu', ASHT + 0.1, -14, length=NAVM - ASHT + 0.4, fade_out=0.6)
sfx('sfx_whoosh_tunnel_reverb', NAVM + 0.25, -14); sfx('sfx_chime_crystal', NAVM + 1.2, -16)
sfx('sfx_rice_grains_cup', TIKA + 0.3, -12); sfx('amb_patan_durbar_bells_conch_nepal', TIKA, -20, length=KOJA - TIKA, fade_in=0.4, fade_out=0.8)
sfx('amb_crickets_night', KOJA, -18, length=LIFE - KOJA, fade_in=0.3, fade_out=0.5); sfx('sfx_wind_chimes', KOJA + 0.6, -17, length=2.5, fade_out=0.8)
for i in range(4): sfx('sfx_whoosh_swirling', LIFE + i * 2 * bC - 0.25, -15, length=1.2, fade_out=0.4)
sfx('sfx_wind_swoosh_passing_kite', LIFE + 2 * bC, -14)
# the tika on you
ending_at('sfx_riser_cinematic_synth', STAMP, -11); sfx('sfx_impact_big_cinematic', STAMP, -4); sfx('sfx_temple_bell_ghanta_big', STAMP + 0.05, -7, length=8, fade_out=3); sfx('sfx_sparkle_magic_wand', STAMP + 0.3, -14)
# the wish: the kite comes back, is caught, flies; a last bell
sfx('sfx_crowd_cheer_victory', WISH + 0.3, -16, length=2.5, fade_out=0.8); sfx('sfx_wind_swoosh_passing_kite', WISH + 4.4, -11); sfx('sfx_temple_bell_small_hand_ring', END - 0.4, -11, length=3, fade_out=1)

# ---------- mix + master: duck the music a little under the big hits, glue, normalise, limit
mix = mus + mixL; t_end = int(DUR * SR); mix = mix[:, :t_end]
fade = np.ones(t_end); k = int(1.2 * SR); fade[-k:] = np.linspace(1, 0, k) ** 2; mix *= fade
import pyloudnorm as pyln
m = pyln.Meter(SR); L = m.integrated_loudness(mix.T); mix *= db(-14 - L); mix = np.tanh(mix * 1.15) / 1.15; mix *= min(1, db(-1.2) / np.max(np.abs(mix)))
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True); sf.write(os.path.join(ROOT, 'out', 'dashain3d_score.wav'), mix.T, SR, subtype='PCM_24')
print(f'score {t_end / SR:.2f}s  {m.integrated_loudness(mix.T):.1f} LUFS  offsets A {offA:.2f} B {offB:.2f} C {offC:.2f}')
