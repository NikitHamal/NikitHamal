// Hanomi native - core: math, hashing/noise, colour, software framebuffer, pixel font.
#pragma once
#include <cstdint>
#include <cstdarg>
#include <cmath>
#include <cstring>
#include <cstdio>
#include <cstdlib>
#include <vector>
#include <string>
#include <algorithm>
#include <unordered_map>
#include <unordered_set>
#include <functional>
#include <array>
#include <memory>
#include <map>
#include <set>
#include <mutex>
#include <queue>

typedef uint32_t u32; typedef uint8_t u8; typedef uint16_t u16; typedef int64_t i64; typedef uint64_t u64;
constexpr float PI = 3.14159265358979f, TAU = 6.28318530717958f;
constexpr int TS = 16, CS = 16, CPX = TS * CS;
constexpr float DAY_LEN = 600.f;

inline float clampf(float v, float a, float b) { return v < a ? a : v > b ? b : v; }
inline int clampi(int v, int a, int b) { return v < a ? a : v > b ? b : v; }
inline float lerpf(float a, float b, float t) { return a + (b - a) * t; }
inline float smoothf(float t) { t = clampf(t, 0, 1); return t * t * (3 - 2 * t); }
inline float easeOut(float t) { t = clampf(t, 0, 1); return 1 - (1 - t) * (1 - t); }
inline float dist2f(float ax, float ay, float bx, float by) { float dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
inline int fdiv(int a, int b) { int q = a / b; return (a % b != 0 && ((a < 0) != (b < 0))) ? q - 1 : q; }
inline int fmod_i(int a, int b) { int m = a % b; return m < 0 ? m + b : m; }

/* ---------- RNG & hash (mirrors the web original's functions) ---------- */
struct RNG {
  u32 s;
  explicit RNG(u32 seed = 1) : s(seed) {}
  double next() { s += 0x6D2B79F5u; u32 t = s; t = (t ^ (t >> 15)) * (1u | t); t = (t + ((t ^ (t >> 7)) * (61u | t))) ^ t; return (double)(t ^ (t >> 14)) / 4294967296.0; }
  double r(double a, double b) { return a + next() * (b - a); }
  int i(int a, int b) { return (int)std::floor(a + next() * (b - a + 1)); }
  bool chance(double p) { return next() < p; }
  template <class T> const T& pick(const std::vector<T>& v) { return v[(size_t)(next() * v.size()) % v.size()]; }
};
static RNG gRng(0xC0FFEEu);
inline float frand() { return gRng.next(); }
inline float frandr(float a, float b) { return a + frand() * (b - a); }
inline int irand(int a, int b) { return a + (int)(frand() * (b - a + 1)); }

inline u32 hash2i(int x, int y, u32 s = 0) {
  u32 h = (u32)x * 374761393u + (u32)y * 668265263u + s * 1442695041u;
  h = (h ^ (h >> 13)) * 1274126177u; h ^= h >> 16; return h;
}
inline double hash2(int x, int y, u32 s = 0) { return hash2i(x, y, s) / 4294967296.0; }
inline double vnoise(double x, double y, u32 s = 0) {
  int ix = (int)std::floor(x), iy = (int)std::floor(y); double fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  double a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
inline double fbm(double x, double y, u32 s = 0, int o = 4) {
  double t = 0, a = 0.5, f = 1, n = 0;
  for (int i = 0; i < o; i++) { t += a * vnoise(x * f, y * f, s + i * 17); n += a; a *= 0.5; f *= 2.03; }
  return t / n;
}
static const float BAY[16] = {0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5};
inline double bayer(int x, int y) { return (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16.0; }

/* ---------- colour (0xAARRGGBB) ---------- */
inline u32 RGB(int r, int g, int b, int a = 255) { return ((u32)clampi(a, 0, 255) << 24) | ((u32)clampi(r, 0, 255) << 16) | ((u32)clampi(g, 0, 255) << 8) | (u32)clampi(b, 0, 255); }
inline u32 HEX(u32 h) { return 0xFF000000u | h; }
inline int cr(u32 c) { return (c >> 16) & 255; } inline int cg(u32 c) { return (c >> 8) & 255; } inline int cb(u32 c) { return c & 255; } inline int ca(u32 c) { return c >> 24; }
inline u32 mixc(u32 a, u32 b, float t) { return RGB((int)(cr(a) + (cr(b) - cr(a)) * t + .5f), (int)(cg(a) + (cg(b) - cg(a)) * t + .5f), (int)(cb(a) + (cb(b) - cb(a)) * t + .5f), (int)(ca(a) + (ca(b) - ca(a)) * t + .5f)); }
inline u32 shadec(u32 c, float f) { return RGB((int)(cr(c) * f), (int)(cg(c) * f), (int)(cb(c) * f), ca(c)); }
inline u32 withA(u32 c, int a) { return (c & 0x00FFFFFFu) | ((u32)clampi(a, 0, 255) << 24); }
// hue-shifted ramp: darker steps drift to cool violet, lighter to warm yellow (k in -3..3)
inline u32 ramp(u32 h, float k) {
  if (k == 0) return h;
  if (k < 0) return mixc(shadec(h, 1 + k * 0.32f), HEX(0x2a1f4a), std::min(0.5f, -k * 0.16f));
  return mixc(shadec(h, 1 + k * 0.14f), HEX(0xfff2b8), std::min(0.5f, k * 0.16f));
}
inline u32 blendOver(u32 dst, u32 src) {
  int a = ca(src); if (a >= 255) return src; if (a <= 0) return dst;
  int ia = 255 - a;
  return 0xFF000000u | ((u32)((cr(src) * a + cr(dst) * ia) / 255) << 16) | ((u32)((cg(src) * a + cg(dst) * ia) / 255) << 8) | (u32)((cb(src) * a + cb(dst) * ia) / 255);
}

/* ---------- images & drawing ---------- */
struct Img {
  int w = 0, h = 0; std::vector<u32> p;
  Img() {} Img(int W, int H) { alloc(W, H); }
  void alloc(int W, int H) { w = W; h = H; p.assign((size_t)W * H, 0); }
  u32 get(int x, int y) const { return (x < 0 || y < 0 || x >= w || y >= h) ? 0 : p[(size_t)y * w + x]; }
  void set(int x, int y, u32 c) { if (x >= 0 && y >= 0 && x < w && y < h) p[(size_t)y * w + x] = c; }
};
// Draw target (world sprites are baked onto Imgs; the screen is an Img too).
static Img* T = nullptr;
inline void putpx(int x, int y, u32 c) { if (ca(c) == 0) return; if ((unsigned)x < (unsigned)T->w && (unsigned)y < (unsigned)T->h) { u32& d = T->p[(size_t)y * T->w + x]; d = ca(c) == 255 ? c : (ca(d) == 0 ? c : blendOver(d, c)); } }
inline void frect(int x, int y, int w, int h, u32 c) {
  if (ca(c) == 0) return; int x0 = std::max(x, 0), y0 = std::max(y, 0), x1 = std::min(x + w, T->w), y1 = std::min(y + h, T->h);
  if (ca(c) == 255) { for (int j = y0; j < y1; j++) { u32* d = &T->p[(size_t)j * T->w]; for (int i = x0; i < x1; i++) d[i] = c; } }
  else for (int j = y0; j < y1; j++) { u32* d = &T->p[(size_t)j * T->w]; for (int i = x0; i < x1; i++) d[i] = ca(d[i]) == 0 ? c : blendOver(d[i], c); }
}
inline void srect(int x, int y, int w, int h, u32 c) { frect(x, y, w, 1, c); frect(x, y + h - 1, w, 1, c); frect(x, y + 1, 1, h - 2, c); frect(x + w - 1, y + 1, 1, h - 2, c); }
inline void hline(int x, int y, int w, u32 c) { frect(x, y, w, 1, c); }
inline void vline(int x, int y, int h, u32 c) { frect(x, y, 1, h, c); }
inline void line(int x0, int y0, int x1, int y1, u32 c) {
  int dx = std::abs(x1 - x0), dy = -std::abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
  for (int n = 0; n < 4096; n++) { putpx(x0, y0, c); if (x0 == x1 && y0 == y1) break; int e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
inline void fcircle(float cx, float cy, float r, u32 c) {
  for (int j = (int)std::floor(cy - r); j <= (int)std::ceil(cy + r); j++) for (int i = (int)std::floor(cx - r); i <= (int)std::ceil(cx + r); i++) { float dx = i + .5f - cx, dy = j + .5f - cy; if (dx * dx + dy * dy <= r * r) putpx(i, j, c); }
}
inline void fellipse(float cx, float cy, float rx, float ry, u32 c) {
  for (int j = (int)std::floor(cy - ry); j <= (int)std::ceil(cy + ry); j++) for (int i = (int)std::floor(cx - rx); i <= (int)std::ceil(cx + rx); i++) {
    float dx = (i + .5f - cx) / rx, dy = (j + .5f - cy) / ry; if (dx * dx + dy * dy <= 1) putpx(i, j, c);
  }
}
// thick capsule between two sub-pixel points
inline void capsule(float x0, float y0, float x1, float y1, float r, u32 c) {
  int xa = (int)std::floor(std::min(x0, x1) - r), xb = (int)std::ceil(std::max(x0, x1) + r), ya = (int)std::floor(std::min(y0, y1) - r), yb = (int)std::ceil(std::max(y0, y1) + r);
  float dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
  for (int j = ya; j <= yb; j++) for (int i = xa; i <= xb; i++) {
    float px = i + .5f - x0, py = j + .5f - y0, t = l2 > 0 ? clampf((px * dx + py * dy) / l2, 0, 1) : 0, ex = px - dx * t, ey = py - dy * t;
    if (ex * ex + ey * ey <= r * r) putpx(i, j, c);
  }
}
inline void blit(const Img& s, int x, int y, bool flip = false) {
  for (int j = 0; j < s.h; j++) { int yy = y + j; if (yy < 0 || yy >= T->h) continue;
    for (int i = 0; i < s.w; i++) { int xx = x + i; if (xx < 0 || xx >= T->w) continue; u32 c = s.p[(size_t)j * s.w + (flip ? s.w - 1 - i : i)]; if (c >> 24) { u32& d = T->p[(size_t)yy * T->w + xx]; d = ca(c) == 255 ? c : blendOver(d, c); } } }
}
inline void blitTint(const Img& s, int x, int y, u32 tint, float t, bool flip = false) {
  for (int j = 0; j < s.h; j++) for (int i = 0; i < s.w; i++) { u32 c = s.p[(size_t)j * s.w + (flip ? s.w - 1 - i : i)]; if (c >> 24) putpx(x + i, y + j, mixc(c, withA(tint, ca(c)), t)); }
}
inline void blitRows(const Img& s, int x, int y, int r0, int r1, bool flip = false) { // draws rows [r0,r1) at y
  for (int j = r0; j < std::min(r1, s.h); j++) for (int i = 0; i < s.w; i++) { u32 c = s.p[(size_t)j * s.w + (flip ? s.w - 1 - i : i)]; if (c >> 24) putpx(x + i, y + j - r0, c); }
}
inline void blitScaled(const Img& s, int x, int y, int dw, int dh) {
  for (int j = 0; j < dh; j++) for (int i = 0; i < dw; i++) { u32 c = s.get(i * s.w / dw, j * s.h / dh); if (c >> 24) putpx(x + i, y + j, c); }
}
// 1-pixel outline around opaque pixels (selective: darker version of the neighbouring colour)
inline void outlineImg(Img& im, u32 col, bool selective = true) {
  Img o = im;
  static const int D[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
  for (int j = 0; j < im.h; j++) for (int i = 0; i < im.w; i++) if (ca(im.get(i, j)) < 128) {
    for (auto& d : D) { u32 n = im.get(i + d[0], j + d[1]); if (ca(n) >= 128) { o.p[(size_t)j * im.w + i] = selective ? mixc(shadec(n, 0.38f), col, 0.5f) : col; break; } }
  }
  im = o;
}
inline Img padImg(const Img& s, int pad) { Img r(s.w + pad * 2, s.h + pad * 2); for (int j = 0; j < s.h; j++) for (int i = 0; i < s.w; i++) r.p[(size_t)(j + pad) * r.w + i + pad] = s.p[(size_t)j * s.w + i]; return r; }

/* ---------- 5x7 pixel font (proportional) ---------- */
static const u8 FONT5[95][5] = {
{0,0,0,0,0},{0,0,0x5F,0,0},{0,7,0,7,0},{0x14,0x7F,0x14,0x7F,0x14},{0x24,0x2A,0x7F,0x2A,0x12},{0x23,0x13,8,0x64,0x62},{0x36,0x49,0x56,0x20,0x50},{0,5,3,0,0},
{0,0x1C,0x22,0x41,0},{0,0x41,0x22,0x1C,0},{0x14,8,0x3E,8,0x14},{8,8,0x3E,8,8},{0,0x50,0x30,0,0},{8,8,8,8,8},{0,0x60,0x60,0,0},{0x20,0x10,8,4,2},
{0x3E,0x51,0x49,0x45,0x3E},{0,0x42,0x7F,0x40,0},{0x42,0x61,0x51,0x49,0x46},{0x21,0x41,0x45,0x4B,0x31},{0x18,0x14,0x12,0x7F,0x10},{0x27,0x45,0x45,0x45,0x39},{0x3C,0x4A,0x49,0x49,0x30},{1,0x71,9,5,3},{0x36,0x49,0x49,0x49,0x36},{6,0x49,0x49,0x29,0x1E},
{0,0x36,0x36,0,0},{0,0x56,0x36,0,0},{8,0x14,0x22,0x41,0},{0x14,0x14,0x14,0x14,0x14},{0,0x41,0x22,0x14,8},{2,1,0x51,9,6},{0x32,0x49,0x79,0x41,0x3E},
{0x7E,0x11,0x11,0x11,0x7E},{0x7F,0x49,0x49,0x49,0x36},{0x3E,0x41,0x41,0x41,0x22},{0x7F,0x41,0x41,0x22,0x1C},{0x7F,0x49,0x49,0x49,0x41},{0x7F,9,9,9,1},{0x3E,0x41,0x49,0x49,0x7A},{0x7F,8,8,8,0x7F},{0,0x41,0x7F,0x41,0},{0x20,0x40,0x41,0x3F,1},{0x7F,8,0x14,0x22,0x41},{0x7F,0x40,0x40,0x40,0x40},{0x7F,2,0x0C,2,0x7F},{0x7F,4,8,0x10,0x7F},{0x3E,0x41,0x41,0x41,0x3E},{0x7F,9,9,9,6},{0x3E,0x41,0x51,0x21,0x5E},{0x7F,9,0x19,0x29,0x46},{0x46,0x49,0x49,0x49,0x31},{1,1,0x7F,1,1},{0x3F,0x40,0x40,0x40,0x3F},{0x1F,0x20,0x40,0x20,0x1F},{0x3F,0x40,0x38,0x40,0x3F},{0x63,0x14,8,0x14,0x63},{7,8,0x70,8,7},{0x61,0x51,0x49,0x45,0x43},
{0,0x7F,0x41,0x41,0},{2,4,8,0x10,0x20},{0,0x41,0x41,0x7F,0},{4,2,1,2,4},{0x40,0x40,0x40,0x40,0x40},{0,1,2,4,0},
{0x20,0x54,0x54,0x54,0x78},{0x7F,0x48,0x44,0x44,0x38},{0x38,0x44,0x44,0x44,0x20},{0x38,0x44,0x44,0x48,0x7F},{0x38,0x54,0x54,0x54,0x18},{8,0x7E,9,1,2},{0x0C,0x52,0x52,0x52,0x3E},{0x7F,8,4,4,0x78},{0,0x44,0x7D,0x40,0},{0x20,0x40,0x44,0x3D,0},{0x7F,0x10,0x28,0x44,0},{0,0x41,0x7F,0x40,0},{0x7C,4,0x18,4,0x78},{0x7C,8,4,4,0x78},{0x38,0x44,0x44,0x44,0x38},{0x7C,0x14,0x14,0x14,8},{8,0x14,0x14,0x18,0x7C},{0x7C,8,4,4,8},{0x48,0x54,0x54,0x54,0x20},{4,0x3F,0x44,0x40,0x20},{0x3C,0x40,0x40,0x20,0x7C},{0x1C,0x20,0x40,0x20,0x1C},{0x3C,0x40,0x30,0x40,0x3C},{0x44,0x28,0x10,0x28,0x44},{0x0C,0x50,0x50,0x50,0x3C},{0x44,0x64,0x54,0x4C,0x44},
{0,8,0x36,0x41,0},{0,0,0x7F,0,0},{0,0x41,0x36,8,0},{0x10,8,8,0x10,8}};
inline int glyphSpan(char ch, int& c0, int& c1) {
  int idx = (u8)ch - 32; if (idx < 0 || idx > 94) idx = 0; const u8* g = FONT5[idx]; c0 = 0; c1 = 4;
  while (c0 < 5 && !g[c0]) c0++; if (c0 == 5) return 0; while (c1 >= 0 && !g[c1]) c1--; return c1 - c0 + 1;
}
inline int textW(const std::string& s, int sc = 1) { int w = 0; for (char ch : s) { int a, b; int n = glyphSpan(ch, a, b); w += (n ? n + 1 : 3) * sc; } return std::max(0, w - sc); }
inline void drawText(const std::string& s, int x, int y, u32 col, int sc = 1, u32 shadow = 0) {
  int cx = x;
  for (char ch : s) {
    int idx = (u8)ch - 32; if (idx < 0 || idx > 94) idx = 0; int c0, c1, n = glyphSpan(ch, c0, c1);
    if (!n) { cx += 3 * sc; continue; }
    const u8* g = FONT5[idx];
    for (int pass = shadow ? 0 : 1; pass < 2; pass++) for (int c = c0; c <= c1; c++) for (int r = 0; r < 7; r++) if (g[c] >> r & 1) {
      int px = cx + (c - c0) * sc, py = y + r * sc; if (pass == 0) { frect(px + sc, py + sc, sc, sc, shadow); frect(px, py + sc, sc, sc, shadow); frect(px + sc, py, sc, sc, shadow); } else frect(px, py, sc, sc, col);
    }
    cx += (n + 1) * sc;
  }
}
inline void drawTextC(const std::string& s, int cx, int y, u32 col, int sc = 1, u32 sh = 0) { drawText(s, cx - textW(s, sc) / 2, y, col, sc, sh); }

inline std::string cap1(std::string s) { if (!s.empty() && s[0] >= 'a' && s[0] <= 'z') s[0] -= 32; return s; }
inline std::string fmt(const char* f, ...) { char b[512]; va_list a; va_start(a, f); vsnprintf(b, sizeof b, f, a); va_end(a); return b; }
