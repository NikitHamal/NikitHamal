// Hanomi native - Spr: a 1:1 C++ port of the web game's js/pix.js pixel raster (same maths, same op order),
// plus the JS colour helpers (mul/mix) used by the ported art modules. Pixels are 0xAARRGGBB; "colour" args are 0xRRGGBB ints, -1 = none.
#pragma once
#include "core.h"
#include <functional>

inline int jround(double v) { return (int)std::floor(v + 0.5); }
inline int mulh(int h, double f) { auto c = [&](int s) { return clampi(jround(((h >> s) & 255) * f), 0, 255); }; return (c(16) << 16) | (c(8) << 8) | c(0); }
inline int mixh(int a, int b, double t) { auto c = [&](int s) { return jround(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); }; return (c(16) << 16) | (c(8) << 8) | c(0); }
inline u32 argb(int h, int a = 255) { return ((u32)a << 24) | (u32)(h & 0xffffff); }

struct Spr {
  int w = 0, h = 0; std::vector<u32> d;
  Spr() {} Spr(int W, int H) : w(W), h(H), d((size_t)W * H, 0) {}
  bool in(int x, int y) const { return x >= 0 && y >= 0 && x < w && y < h; }
  u32 get(int x, int y) const { return in(x, y) ? d[(size_t)y * w + x] : 0; }
  void set(double x, double y, int hx, int a = 255) { int xi = (int)std::floor(x), yi = (int)std::floor(y); if (!in(xi, yi) || hx < 0) return; d[(size_t)yi * w + xi] = argb(hx, a); }
  void setRaw(int x, int y, u32 c) { if (in(x, y)) d[(size_t)y * w + x] = c; }
  bool has(int x, int y) const { return (get(x, y) >> 24) > 0; }
  int hex(int x, int y) const { return get(x, y) & 0xffffff; }
  void rect(int x, int y, int W, int H, int c) { for (int j = 0; j < H; j++) for (int i = 0; i < W; i++) set(x + i, y + j, c); }
  template <class F> void rectf(int x, int y, int W, int H, F f) { for (int j = 0; j < H; j++) for (int i = 0; i < W; i++) set(x + i, y + j, f(x + i, y + j, i, j)); }
  template <class F> void ellf(double cx, double cy, double rx, double ry, F c) {
    for (int y = (int)std::floor(cy - ry - 1); y <= (int)std::ceil(cy + ry + 1); y++) for (int x = (int)std::floor(cx - rx - 1); x <= (int)std::ceil(cx + rx + 1); x++) {
      double u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry; if (u * u + v * v <= 1) { int col = c(u, v, x, y); if (col >= 0) set(x, y, col); } } }
  void ell(double cx, double cy, double rx, double ry, int c) { ellf(cx, cy, rx, ry, [&](double, double, int, int) { return c; }); }
  template <class F> void linef(double x0d, double y0d, double x1d, double y1d, F c) {
    int x0 = jround(x0d), y0 = jround(y0d), x1 = jround(x1d), y1 = jround(y1d); int dx = std::abs(x1 - x0), dy = -std::abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy, k = 0;
    for (int n = 0; n < 100000; n++) { set(x0, y0, c(k++)); if (x0 == x1 && y0 == y1) break; int e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } }
  void line(double x0, double y0, double x1, double y1, int c) { linef(x0, y0, x1, y1, [&](int) { return c; }); }
  template <class F> void polyf(const std::vector<std::array<double, 2>>& pts, F c) {
    double y0 = 1e9, y1 = -1e9; for (auto& p : pts) { y0 = std::min(y0, p[1]); y1 = std::max(y1, p[1]); }
    for (int y = (int)std::floor(y0); y <= (int)std::ceil(y1); y++) { std::vector<double> xs; double py = y + 0.5;
      for (size_t i = 0; i < pts.size(); i++) { auto& a = pts[i]; auto& b = pts[(i + 1) % pts.size()]; if ((a[1] <= py && b[1] > py) || (b[1] <= py && a[1] > py)) xs.push_back(a[0] + (py - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      std::sort(xs.begin(), xs.end()); for (size_t k = 0; k + 1 < xs.size(); k += 2) for (int x = jround(xs[k]); x < jround(xs[k + 1]); x++) set(x, y, c(x, y)); } }
  void poly(const std::vector<std::array<double, 2>>& pts, int c) { polyf(pts, [&](int, int) { return c; }); }
  // 1px outline around opaque pixels; fn(neighbourHex,x,y) -> colour
  template <class F> Spr& outlinef(F fn, bool diag = false) {
    std::vector<u32> src = d; auto n = [&](int xx, int yy) -> bool { return xx >= 0 && yy >= 0 && xx < w && yy < h && (src[(size_t)yy * w + xx] >> 24); };
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) { size_t i = (size_t)y * w + x; if (src[i] >> 24) continue;
      bool hit = n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1); if (!hit && diag) hit = n(x - 1, y - 1) || n(x + 1, y - 1) || n(x - 1, y + 1) || n(x + 1, y + 1);
      if (hit) { u32 nb = n(x, y - 1) ? src[(size_t)(y - 1) * w + x] : n(x, y + 1) ? src[(size_t)(y + 1) * w + x] : n(x - 1, y) ? src[(size_t)y * w + x - 1] : src[(size_t)y * w + x + 1]; int col = fn((int)(nb & 0xffffff), x, y); if (col >= 0) d[i] = argb(col); } }
    return *this; }
  Spr& outline(int c, bool diag = false) { return outlinef([&](int, int, int) { return c; }, diag); }
  Spr& draw(const Spr& o, int ox, int oy, bool flip = false) { for (int y = 0; y < o.h; y++) for (int x = 0; x < o.w; x++) { u32 c = o.d[(size_t)y * o.w + (flip ? o.w - 1 - x : x)]; if (c >> 24) setRaw(ox + x, oy + y, c); } return *this; }
  Spr flipX() const { Spr s(w, h); s.draw(*this, 0, 0, true); return s; }
};
