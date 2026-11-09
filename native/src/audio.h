// Hanomi native - audio: procedural SFX bank + generative music (koto / shakuhachi / pad / taiko) + weather ambience. 44.1 kHz stereo.
#pragma once
#include "core.h"
#include <mutex>

enum Sfx_ { S_STEP, S_STEP2, S_SWING, S_HIT, S_CHOP, S_MINE, S_SPLASH, S_PICKUP, S_PLACE, S_COIN, S_BELL, S_HORN, S_DRUM, S_ERROR, S_LEVELUP, S_BREAK, S_BOW, S_ARROW, S_EAT, S_BITE, S_CAST,
  S_ROLL, S_HURT, S_GROAN, S_MOO, S_BAA, S_OINK, S_CLUCK, S_BARK, S_WHINE, S_THUNDER, S_CHIRP, S_CLICK, S_TICK, S_DOOR, S_WATER, S_HARVEST, S_PLANT, S_DIE, S_SPLASH_BIG, S_POP, S_COUNT };

namespace Audio {
constexpr int SR = 44100;
struct Snd { std::vector<float> d; };
static Snd bank[S_COUNT];
static float sinTab[2049];
inline float fsin(float ph) { float x = (ph - std::floor(ph)) * 2048.f; int i = (int)x; float f = x - i; return sinTab[i] + (sinTab[i + 1] - sinTab[i]) * f; }
struct Noise { u32 s = 12345; float n() { s = s * 1664525u + 1013904223u; return ((s >> 8) & 0xFFFF) / 32768.f - 1.f; } };
struct Voice { int kind = -1; float f = 0, ph = 0, ph2 = 0, age = 0, dur = 1, amp = 0, pan = 0, lp = 0, vib = 0; };
struct Req { int id; float vol, pitch, pan; };
static std::vector<Voice> voices(24); static std::vector<Req> queue; static std::mutex mtx;
static float musicVol = 0.6f, sfxVol = 0.8f, masterVol = 1.f, mood = 0, moodTarget = 0, rainT = 0, rainV = 0, nightT = 0, nightV = 0, windV = 0.2f; static bool inside = false, paused = false, musicOn = true;
static int moodId = 0; static double seqT = 0; static int beat = 0, bar = 0; static RNG mrng(77); static Noise nz; static float rainLp = 0, windLp = 0, rainLp2 = 0; static float cricketPh = 0, cricketG = 0, birdT = 2; static float duck = 0;
static const float SCALE_YO[5] = {0, 2, 5, 7, 9}, SCALE_IN[5] = {0, 1, 5, 7, 8}; // yo (day) / in (night, battle) pentatonic degrees (semitones)
inline float midiF(float m) { return 440.f * std::pow(2.f, (m - 69.f) / 12.f); }

template <class F> static Snd gen(float dur, F fn) { Snd s; int n = (int)(dur * SR); s.d.resize(n); for (int i = 0; i < n; i++) s.d[i] = fn(i / (float)SR, i); float pk = 0; for (float v : s.d) pk = std::max(pk, std::fabs(v)); if (pk > 0.95f) for (auto& v : s.d) v *= 0.95f / pk; return s; }
inline float env(float t, float a, float d) { return t < a ? t / a : std::exp(-(t - a) * d); }
inline float sq(float ph) { return fsin(ph) > 0 ? 1.f : -1.f; }
inline float saw(float ph) { return 2.f * (ph - std::floor(ph)) - 1.f; }
struct LP { float y = 0; float f(float x, float k) { y += (x - y) * k; return y; } };

inline void build() {
  for (int i = 0; i <= 2048; i++) sinTab[i] = std::sin(i / 2048.f * TAU);
  Noise n1; auto N = [&]() { return n1.n(); };
  bank[S_STEP] = gen(0.09f, [&](float t, int) { static LP l; return l.f(N(), 0.12f) * env(t, 0.004f, 40) * 0.9f; });
  bank[S_STEP2] = gen(0.07f, [&](float t, int) { static LP l; return l.f(N(), 0.25f) * env(t, 0.002f, 55) * 0.6f; });
  bank[S_SWING] = gen(0.22f, [&](float t, int) { static LP l; float k = 0.05f + t * 2.2f; return l.f(N(), std::min(0.6f, k)) * std::sin(t / 0.22f * PI) * 0.8f; });
  bank[S_HIT] = gen(0.18f, [&](float t, int) { static LP l; return (fsin(t * (170 - t * 400)) * 0.9f + l.f(N(), 0.4f) * 0.7f) * env(t, 0.001f, 24); });
  bank[S_CHOP] = gen(0.2f, [&](float t, int) { static LP l; return (fsin(t * (210 - t * 300)) * 0.8f + l.f(N(), 0.3f) * 0.5f) * env(t, 0.001f, 22) + fsin(t * 640) * 0.15f * env(t, 0.001f, 60); });
  bank[S_MINE] = gen(0.25f, [&](float t, int) { return (fsin(t * 1560) * 0.4f + fsin(t * 2340) * 0.3f + fsin(t * 910) * 0.35f + N() * 0.35f * env(t, 0.0005f, 120)) * env(t, 0.0005f, 18); });
  bank[S_SPLASH] = gen(0.35f, [&](float t, int) { static LP l; return l.f(N(), 0.22f - t * 0.3f) * std::sin(clampf(t / 0.05f, 0, 1) * PI / 2) * std::exp(-t * 8) * 1.1f; });
  bank[S_SPLASH_BIG] = gen(0.7f, [&](float t, int) { static LP l; return l.f(N(), 0.16f) * std::sin(clampf(t / 0.06f, 0, 1) * PI / 2) * std::exp(-t * 4.5f) * 1.2f + fsin(t * (120 - t * 60)) * 0.4f * env(t, 0.01f, 9); });
  bank[S_PICKUP] = gen(0.16f, [&](float t, int) { float f = t < 0.07f ? 880 : 1320; return fsin(t * f) * env(t, 0.002f, 16) * 0.5f + fsin(t * f * 2) * 0.1f * env(t, 0.002f, 22); });
  bank[S_PLACE] = gen(0.14f, [&](float t, int) { static LP l; return (l.f(N(), 0.18f) * 0.9f + fsin(t * 130) * 0.7f) * env(t, 0.001f, 30); });
  bank[S_COIN] = gen(0.4f, [&](float t, int) { float f = t < 0.07f ? 1568 : 2093; float e = t < 0.07f ? env(t, 0.001f, 20) : env(t - 0.07f, 0.001f, 9); return (fsin(t * f) * 0.45f + fsin(t * f * 2.01f) * 0.15f) * e; });
  bank[S_BELL] = gen(2.4f, [&](float t, int) { float e = std::exp(-t * 1.9f); return (fsin(t * 523) * 0.5f + fsin(t * 523 * 2.76f) * 0.25f * std::exp(-t * 3) + fsin(t * 523 * 5.4f) * 0.12f * std::exp(-t * 5) + fsin(t * 523 * 1.5f) * 0.18f) * e * std::min(1.f, t / 0.002f); });
  bank[S_HORN] = gen(1.6f, [&](float t, int) { static LP l; float vib = 1 + std::sin(t * 30) * 0.004f; float f = 146.8f * vib * (t < 0.15f ? 0.94f + t * 0.4f : 1.f); float s = saw(t * f) * 0.5f + saw(t * f * 1.005f) * 0.4f + sq(t * f * 0.5f) * 0.3f; float e = std::min(1.f, t / 0.18f) * (t > 1.2f ? std::max(0.f, 1 - (t - 1.2f) / 0.4f) : 1.f); return l.f(s, 0.12f + std::min(0.12f, t * 0.2f)) * e * 1.3f; });
  bank[S_DRUM] = gen(0.7f, [&](float t, int) { static LP l; float f = 52 + 90 * std::exp(-t * 28); return (fsin(t * f * 1.0f + 0) * 1.0f * std::exp(-t * 6) + l.f(N(), 0.08f) * 0.5f * std::exp(-t * 30)) * std::min(1.f, t / 0.0015f); });
  bank[S_ERROR] = gen(0.22f, [&](float t, int) { return sq(t * (t < 0.1f ? 150 : 120)) * 0.3f * env(t, 0.002f, 5); });
  bank[S_LEVELUP] = gen(0.9f, [&](float t, int) { static const float F[5] = {523, 659, 784, 1047, 1319}; int k = std::min(4, (int)(t / 0.1f)); float tt = t - k * 0.1f; return (fsin(t * F[k]) * 0.4f + fsin(t * F[k] * 2) * 0.1f) * env(tt, 0.002f, k == 4 ? 4.f : 12.f) * (k == 4 ? 1.f : 0.8f); });
  bank[S_BREAK] = gen(0.35f, [&](float t, int) { static LP l; return (l.f(N(), 0.5f) * 0.7f + fsin(t * 300 * (1 - t)) * 0.4f) * env(t, 0.001f, 12) * (((int)(t * 40) & 1) ? 1.f : 0.5f); });
  bank[S_BOW] = gen(0.3f, [&](float t, int) { return (fsin(t * (320 + std::sin(t * 90) * 12)) * 0.5f * env(t, 0.001f, 14) + N() * 0.2f * env(t, 0.001f, 40)); });
  bank[S_ARROW] = gen(0.12f, [&](float t, int) { static LP l; return (l.f(N(), 0.3f) * 0.6f + fsin(t * 240) * 0.5f) * env(t, 0.001f, 40); });
  bank[S_EAT] = gen(0.3f, [&](float t, int) { static LP l; float g = ((int)(t * 22) % 2) ? 1.f : 0.f; return l.f(N(), 0.3f) * g * 0.7f * std::exp(-t * 4) * (1 - std::fmod(t * 22, 1.f)); });
  bank[S_BITE] = gen(0.25f, [&](float t, int) { return fsin(t * (300 + t * 1400)) * 0.5f * env(t, 0.002f, 14) + N() * 0.1f * env(t, 0.001f, 40); });
  bank[S_CAST] = gen(0.4f, [&](float t, int) { static LP l; return l.f(N(), 0.04f + t * 0.4f) * std::sin(t / 0.4f * PI) * 0.7f + fsin(t * (900 - t * 800)) * 0.1f * std::sin(t / 0.4f * PI); });
  bank[S_ROLL] = gen(0.28f, [&](float t, int) { static LP l; return l.f(N(), 0.07f) * std::sin(t / 0.28f * PI) * 0.7f; });
  bank[S_HURT] = gen(0.28f, [&](float t, int) { return (sq(t * (240 - t * 380)) * 0.35f + N() * 0.12f) * env(t, 0.002f, 9); });
  bank[S_GROAN] = gen(0.9f, [&](float t, int) { static LP l; float vib = 1 + std::sin(t * 9) * 0.05f; float f = (95 - t * 35) * vib; return l.f(saw(t * f) * 0.6f + N() * 0.1f, 0.09f) * std::sin(clampf(t / 0.9f, 0, 1) * PI) * 1.4f; });
  bank[S_MOO] = gen(1.0f, [&](float t, int) { static LP l; float f = 120 * (1 + std::sin(t * 5) * 0.01f) * (t < 0.25f ? 0.85f + t * 0.6f : 1.f - (t - 0.25f) * 0.1f); return l.f(saw(t * f) * 0.7f + saw(t * f * 2.01f) * 0.2f, 0.07f) * std::sin(clampf(t, 0, 1) * PI) * 1.5f; });
  bank[S_BAA] = gen(0.7f, [&](float t, int) { static LP l; float f = 300 * (1 + std::sin(t * 38) * 0.06f) * (1 - t * 0.12f); return l.f(saw(t * f) * 0.6f, 0.12f + 0.06f * std::sin(t * 7)) * std::sin(clampf(t / 0.7f, 0, 1) * PI) * 1.3f; });
  bank[S_OINK] = gen(0.3f, [&](float t, int) { static LP l; float f = 160 - t * 60 + std::sin(t * 90) * 25; return l.f(saw(t * f) * 0.7f + N() * 0.15f, 0.2f) * env(t, 0.01f, 6) * 1.2f; });
  bank[S_CLUCK] = gen(0.22f, [&](float t, int) { float f = 620 + 280 * std::sin(t * 60); float g = std::fmod(t * 14, 1.f) < 0.5f ? 1.f : 0.f; return sq(t * f) * 0.18f * g * std::exp(-t * 6); });
  bank[S_BARK] = gen(0.22f, [&](float t, int) { static LP l; float f = 420 - t * 700; return (l.f(saw(t * f) * 0.7f + N() * 0.35f, 0.25f)) * env(t, 0.002f, 15) * 1.2f; });
  bank[S_WHINE] = gen(0.6f, [&](float t, int) { float f = 700 + std::sin(t * 6) * 80 + t * 300; return fsin(t * f) * 0.3f * std::sin(clampf(t / 0.6f, 0, 1) * PI); });
  bank[S_THUNDER] = gen(3.2f, [&](float t, int) { static LP l, l2; float x = N(); return (l.f(x, 0.02f + 0.02f * std::sin(t * 7)) * 3.f + l2.f(x, 0.1f) * 0.6f) * std::min(1.f, t / 0.12f) * std::exp(-t * 1.1f) * (0.7f + 0.3f * std::sin(t * 23)); });
  bank[S_CHIRP] = gen(0.28f, [&](float t, int) { float k = std::fmod(t * 11, 1.f); float f = 2600 + 1400 * std::sin(k * PI) + (int)(t * 11) * 200; float g = t < 0.2f ? 1.f : 0.f; return fsin(t * f) * 0.18f * g * std::sin(k * PI); });
  bank[S_CLICK] = gen(0.05f, [&](float t, int) { return fsin(t * 1200) * env(t, 0.0005f, 90) * 0.45f; });
  bank[S_TICK] = gen(0.04f, [&](float t, int) { return fsin(t * 1800) * env(t, 0.0005f, 120) * 0.35f; });
  bank[S_DOOR] = gen(0.3f, [&](float t, int) { static LP l; return (l.f(N(), 0.1f) * 0.6f + fsin(t * 90) * 0.6f) * env(t, 0.002f, 12); });
  bank[S_WATER] = gen(0.3f, [&](float t, int) { return fsin(t * (500 + 1500 * t)) * 0.3f * env(t, 0.002f, 14); });
  bank[S_HARVEST] = gen(0.2f, [&](float t, int) { static LP l; return (l.f(N(), 0.5f) * 0.7f + fsin(t * (700 + t * 400)) * 0.15f) * env(t, 0.001f, 20); });
  bank[S_PLANT] = gen(0.16f, [&](float t, int) { static LP l; return (l.f(N(), 0.15f) * 0.9f + fsin(t * 100) * 0.4f) * env(t, 0.002f, 25); });
  bank[S_DIE] = gen(0.6f, [&](float t, int) { static LP l; return (sq(t * (300 - t * 330)) * 0.3f + l.f(N(), 0.3f) * 0.25f) * env(t, 0.002f, 5); });
  bank[S_POP] = gen(0.1f, [&](float t, int) { return fsin(t * (300 + t * 3000)) * 0.4f * env(t, 0.001f, 40); });
}
inline void play(int id, float vol = 1, float pitch = 1, float pan = 0) { std::lock_guard<std::mutex> l(mtx); if (queue.size() < 48) queue.push_back({id, vol, pitch, pan}); }
inline void setMood(int m) { moodId = m; }
inline void setAmbience(float rain, float night, float wind, bool ins) { rainT = rain; nightT = night; windV = wind; inside = ins; }
inline void setVolumes(float music, float sfx) { musicVol = music; sfxVol = sfx; }

struct SfxVoice { const Snd* s = nullptr; float pos = 0, step = 1, vol = 0, pan = 0; };
static SfxVoice sv[20];
inline void spawn(int kind, float f, float dur, float amp, float pan = 0, float vib = 0) { for (auto& v : voices) if (v.kind < 0) { v.kind = kind; v.f = f; v.ph = mrng.next(); v.ph2 = mrng.next(); v.age = 0; v.dur = dur; v.amp = amp; v.pan = pan; v.lp = 0; v.vib = vib; return; } }
inline float scaleNote(const float* sc, int deg, int root, int oct) { int o = deg / 5, d = ((deg % 5) + 5) % 5; if (deg < 0) { o = -((-deg + 4) / 5); } return root + sc[d] + 12 * (o + oct); }
static int deg = 0, root = 62, chordT = 0;
inline void sequencer() { // called once per 16th note
  static int sixteenth = 0; int s16 = sixteenth++ % 16; int mood = moodId; const float* sc = (mood == 0 ? SCALE_YO : SCALE_IN); (void)sc;
  if (s16 == 0) { bar++; if (bar % 2 == 0) { int r = mood == 2 ? 50 : mood == 1 ? 53 : 55; static const int offs[4] = {0, 5, -2, 7}; root = r + offs[(bar / 2) % 4] - (mood == 0 ? 0 : 0); float rf = midiF(root - 12); spawn(2, rf, mood == 2 ? 3.5f : 7.5f, mood == 2 ? 0.1f : 0.075f, -0.2f); spawn(2, rf * 1.4983f, mood == 2 ? 3.5f : 7.5f, 0.05f, 0.2f); if (mood != 2) spawn(2, rf * 2.0f, 7.5f, 0.035f, 0.f); } }
  const float* S2 = (mood == 0) ? SCALE_YO : SCALE_IN;
  if (mood == 0) { // day: koto plucks + occasional shakuhachi
    if (s16 % 4 == 0 && mrng.next() < 0.55f) { deg = clampi(deg + mrng.i(-2, 2), -3, 7); spawn(0, midiF(scaleNote(S2, deg, root + 12, 0)), 2.2f, 0.17f, mrng.r(-0.4f, 0.4f)); }
    else if (s16 % 2 == 0 && mrng.next() < 0.12f) { deg = clampi(deg + mrng.i(-1, 1), -3, 7); spawn(0, midiF(scaleNote(S2, deg, root + 12, 0)), 1.8f, 0.12f, mrng.r(-0.4f, 0.4f)); }
    if (s16 == 0 && bar % 4 == 1 && mrng.next() < 0.6f) { int d0 = mrng.i(1, 5); spawn(1, midiF(scaleNote(S2, d0, root + 12, 1)), 3.2f, 0.11f, 0.1f, 1); }
    if (s16 == 8 && bar % 4 == 1 && mrng.next() < 0.5f) spawn(1, midiF(scaleNote(S2, mrng.i(0, 4), root + 12, 1)), 2.4f, 0.09f, 0.1f, 1);
    if (s16 == 0 && bar % 8 == 3) spawn(4, midiF(root + 24), 3.f, 0.06f, 0.3f);
  } else if (mood == 1) { // night: sparse, low, moody
    if (s16 % 8 == 0 && mrng.next() < 0.6f) { deg = clampi(deg + mrng.i(-2, 2), -4, 4); spawn(0, midiF(scaleNote(S2, deg, root, 0)), 3.2f, 0.16f, mrng.r(-0.3f, 0.3f)); }
    if (s16 == 4 && bar % 4 == 2) spawn(4, midiF(root + 12), 4.f, 0.05f, -0.2f);
    if (s16 == 0 && bar % 6 == 0 && mrng.next() < 0.5f) spawn(1, midiF(scaleNote(S2, mrng.i(0, 4), root, 1)), 4.f, 0.075f, 0.f, 1);
  } else { // battle: taiko + driving plucks
    static const int KICK[16] = {1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0}; if (KICK[s16]) spawn(3, 55 + (s16 % 8 == 0 ? 0 : 20), 0.5f, s16 % 8 == 0 ? 0.55f : 0.28f, 0);
    if (s16 % 2 == 0) { int d = (s16 / 2 + bar) % 5; spawn(0, midiF(scaleNote(S2, d + (s16 % 8 == 0 ? 0 : 0), root, 0)), 0.5f, 0.14f, mrng.r(-0.3f, 0.3f)); }
    if (s16 == 0 && bar % 4 == 0) spawn(1, midiF(scaleNote(S2, 4, root, 1)), 2.f, 0.1f, 0.f, 1);
    if (s16 % 4 == 2) spawn(6, 0, 0.08f, 0.1f);
  }
}
inline void mix(int16_t* out, int frames) {
  { std::lock_guard<std::mutex> l(mtx); for (auto& r : queue) { for (auto& v : sv) if (!v.s) { v.s = &bank[r.id]; v.pos = 0; v.step = r.pitch; v.vol = r.vol; v.pan = r.pan; break; } } queue.clear(); }
  float bpm = moodId == 2 ? 124.f : moodId == 1 ? 58.f : 70.f; double s16len = 60.0 / bpm / 4.0 * SR;
  mood += (moodId - mood) * 0.0001f; rainV += (rainT - rainV) * 0.0005f; nightV += (nightT - nightV) * 0.0003f;
  float insideK = inside ? 0.35f : 1.f;
  for (int i = 0; i < frames; i++) {
    seqT += 1; if (seqT >= s16len) { seqT -= s16len; if (musicOn && !paused) sequencer(); }
    float L = 0, R = 0;
    for (auto& v : voices) if (v.kind >= 0) {
      float dt = 1.f / SR; v.age += dt; if (v.age > v.dur) { v.kind = -1; continue; } float s = 0, e = 0; float t = v.age; float dtf = v.f * dt;
      switch (v.kind) {
        case 0: { v.ph += dtf; v.ph2 += dtf * 2.0f; float a = std::min(1.f, t / 0.004f) * std::exp(-t * 2.6f); s = (fsin(v.ph) + 0.45f * fsin(v.ph2) * std::exp(-t * 3) + 0.2f * fsin(v.ph * 3.01f) * std::exp(-t * 6)) * a * v.amp; s += nz.n() * 0.5f * std::exp(-t * 90) * v.amp; break; }
        case 1: { float vibr = 1 + std::sin(t * 5.2f) * 0.006f * std::min(1.f, t * 1.5f); v.ph += dtf * vibr; float a = std::min(1.f, t / 0.25f) * std::max(0.f, 1 - std::max(0.f, t - (v.dur - 0.9f)) / 0.9f); s = (fsin(v.ph) * 0.8f + fsin(v.ph * 2) * 0.1f + nz.n() * 0.07f) * a * v.amp; break; }
        case 2: { v.ph += dtf; v.ph2 += dtf * 1.004f; float a = std::min(1.f, t / 1.5f) * std::max(0.f, std::min(1.f, (v.dur - t) / 2.0f)); s = (fsin(v.ph) + fsin(v.ph2)) * 0.5f * a * v.amp * (0.85f + 0.15f * fsin(t * 0.25f)); break; }
        case 3: { float f = 50 + 90 * std::exp(-t * 24); v.ph += f * dt; s = (fsin(v.ph) * std::exp(-t * 7) + nz.n() * 0.3f * std::exp(-t * 40)) * std::min(1.f, t / 0.001f) * v.amp * 1.6f; break; }
        case 4: { v.ph += dtf; s = (fsin(v.ph) + 0.35f * fsin(v.ph * 2.76f) * std::exp(-t * 2) + 0.2f * fsin(v.ph * 5.4f) * std::exp(-t * 4)) * std::exp(-t * 1.0f) * std::min(1.f, t / 0.002f) * v.amp; break; }
        case 6: { s = nz.n() * std::exp(-t * 50) * v.amp; break; }
      }
      (void)e; float pn = v.pan; L += s * (1 - std::max(0.f, pn)); R += s * (1 + std::min(0.f, pn));
    }
    L *= musicVol * 0.7f * insideK; R *= musicVol * 0.7f * insideK; if (!musicOn || paused) { L = R = 0; }
    float sl = 0, sr = 0;
    for (auto& v : sv) if (v.s) { int ip = (int)v.pos; if (ip + 1 >= (int)v.s->d.size()) { v.s = nullptr; continue; } float fr = v.pos - ip, x = v.s->d[ip] + (v.s->d[ip + 1] - v.s->d[ip]) * fr; x *= v.vol * sfxVol; sl += x * (1 - std::max(0.f, v.pan)); sr += x * (1 + std::min(0.f, v.pan)); v.pos += v.step; }
    L += sl; R += sr;
    // ambience
    float w = nz.n(); rainLp += (w - rainLp) * 0.35f; rainLp2 += (rainLp - rainLp2) * 0.25f; windLp += (w - windLp) * 0.006f;
    float amb = rainV * (rainLp - rainLp2 * 0.5f) * 0.22f * (inside ? 0.4f : 1.f) + windLp * windV * 0.9f * (0.6f + 0.4f * fsin((float)bar * 0.07f + (float)seqT * 0.000002f));
    cricketPh += 4600.f / SR; cricketG += 31.f / SR; float cg = (std::fmod(cricketG, 1.f) < 0.28f && std::fmod(cricketG * 0.25f, 1.f) < 0.6f) ? 1.f : 0.f;
    amb += nightV * (1 - rainV) * fsin(cricketPh) * cg * 0.022f * insideK;
    L += amb * sfxVol; R += amb * sfxVol;
    L *= masterVol; R *= masterVol; L = std::tanh(L * 1.1f); R = std::tanh(R * 1.1f);
    out[i * 2] = (int16_t)(clampf(L, -1, 1) * 30000); out[i * 2 + 1] = (int16_t)(clampf(R, -1, 1) * 30000);
  }
}
}
