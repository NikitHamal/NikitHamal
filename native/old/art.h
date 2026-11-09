// Hanomi native — procedural pixel art: ground tiles, blocks, objects, buildings, item icons.
#pragma once
#include "world.h"

struct Spr { Img im; int ax = 0, ay = 0; }; // drawn at (px-ax, py-ay), (px,py)=bottom-centre of the tile
static Img mk(int w, int h) { return Img(w, h); }
struct PaintGuard { Img* old; explicit PaintGuard(Img* n) : old(T) { T = n; } ~PaintGuard() { T = old; } };
#define PG_CAT2(a, b) a##b
#define PG_CAT(a, b) PG_CAT2(a, b)
#define PAINT(img) PaintGuard PG_CAT(_pg, __LINE__)(&(img));
#define ENDPAINT

inline u32 groundBase(int g) {
  static const u32 C[G_COUNT] = {0x4aa8cf, 0x2a6aa0, 0xe6d092, 0x6cab4c, 0x4c8a3c, 0x96704a, 0xc6a878, 0x8c8a94, 0x6a4730, 0x47301f, 0xb07e44, 0x8f8f9a, 0x7fb85a, 0x5a7c48, 0xd6cab0, 0xe9f1f8, 0xc9d28c, 0x58c0c0};
  return HEX(C[g]);
}
struct Art {
  Img ground[G_COUNT][4]; Img block[B_COUNT][2][4];
  Spr obj[O_MAX][8]; Spr cropSpr[5][4]; Spr fence[16]; Spr gateOpen, gateClosed;
  std::vector<Img> icon; std::unordered_map<u64, Spr> houses; Img coin, heartF, heartE, heartH, drumstick, drumstickE;
  Img petal[2];

  /* ---- foliage helpers ---- */
  static void blob(float cx, float cy, float rx, float ry, u32 base, u32 seed, float contrast = 1.f) {
    for (int j = (int)std::floor(cy - ry); j <= (int)std::ceil(cy + ry); j++) for (int i = (int)std::floor(cx - rx); i <= (int)std::ceil(cx + rx); i++) {
      float dx = (i + .5f - cx) / rx, dy = (j + .5f - cy) / ry, d2 = dx * dx + dy * dy; if (d2 > 1) continue;
      float l = -(dx * 0.55f + dy * 0.85f) * 0.5f + 0.5f, n = hash2(i, j, seed);
      float k = (l - 0.5f) * 3.2f * contrast + (n - 0.5f) * 1.1f - (d2 > 0.8f ? 0.6f : 0);
      putpx(i, j, ramp(base, std::round(clampf(k, -2, 2)) * 0.85f));
    }
  }
  static void trunk(int x, int y0, int y1, int w, u32 c) { for (int y = y0; y < y1; y++) for (int i = 0; i < w; i++) putpx(x + i, y, i == 0 ? ramp(c, 0.8f) : i == w - 1 ? ramp(c, -1.4f) : (hash2(i, y, 3) < 0.2f ? ramp(c, -0.7f) : c)); }
  static void finish(Img& im, u32 oc = 0xFF1c1424u) { outlineImg(im, oc); }

  /* ---- ground tiles ---- */
  void genGround(int g, int v) {
    Img& im = ground[g][v]; im = mk(16, 16); PAINT(im); u32 base = groundBase(g); u32 sd = g * 131 + v * 17 + 5;
    for (int y = 0; y < 16; y++) for (int x = 0; x < 16; x++) {
      float n = hash2(x, y, sd), b = bayer(x, y); float k = 0; u32 c = base;
      switch (g) {
        case G_GRASS: case G_FOREST: case G_SAKURA: case G_MARSH: k = n < 0.1f ? -1 : n > 0.93f ? 1 : 0; if (b < 0.35f && n < 0.45f) k = -0.5f; c = ramp(base, k); break;
        case G_SAND: k = n < 0.08f ? -0.8f : n > 0.94f ? 0.8f : 0; { float rip = std::sin((x + v * 3) * 0.7f + std::sin(y * 0.9f + v) * 1.5f); if (rip > 0.92f && y % 4 == 1) k = -0.6f; } c = ramp(base, k); break;
        case G_DIRT: k = n < 0.16f ? -1 : n > 0.9f ? 0.9f : 0; c = ramp(base, k); break;
        case G_PATH: k = n < 0.1f ? -0.8f : n > 0.9f ? 0.7f : 0; c = ramp(base, k); break;
        case G_ROCK: k = n < 0.15f ? -1 : n > 0.88f ? 1 : 0; c = ramp(base, k); break;
        case G_SNOW: k = (b < 0.3f && n < 0.3f) ? -0.5f : 0; if (n > 0.985f) c = HEX(0xffffff); else c = mixc(ramp(base, k), HEX(0xcfe0f4), k < 0 ? 0.5f : 0); break;
        case G_TILLED: case G_WET: { bool fur = (y & 3) < 2; k = fur ? -0.8f : 0.3f; if (n < 0.15f) k += 0.5f; c = ramp(base, k); } break;
        case G_WOOD: { int row = y / 4, seam = (x + row * 5 + v * 3) % 16; k = (y & 3) == 3 ? -1.4f : (y & 3) == 0 ? 0.6f : (n < 0.15f ? -0.5f : 0); if (seam == 0 && (y & 3) < 3) k = -1.4f; c = ramp(base, k + (row & 1 ? -0.2f : 0.1f)); } break;
        case G_COBBLE: { int cy = y / 4, ox = (cy & 1) * 3, cx = (x + ox + v) % 8; bool mortar = (y & 3) == 3 || cx == 7; k = mortar ? -1.8f : (cx == 0 || (y & 3) == 0) ? 0.7f : (n < 0.2f ? -0.4f : n > 0.85f ? 0.3f : 0); c = ramp(base, k); } break;
        case G_PLAZA: { bool seam = (x & 7) == 7 || (y & 7) == 7; k = seam ? -1.2f : ((x & 7) == 0 || (y & 7) == 0) ? 0.5f : (n < 0.12f ? -0.4f : 0); c = ramp(base, k); } break;
        case G_TATAMI: { bool edge = x == 0 || y == 0 || x == 15 || y == 15; k = edge ? -1.5f : (((x + y) & 1) ? 0.15f : -0.15f); if (x % 4 == 0 && !edge) k -= 0.3f; c = ramp(base, k); } break;
        default: c = base;
      }
      putpx(x, y, c);
    }
    auto dot = [&](int cnt, auto fn) { for (int i = 0; i < cnt; i++) fn(hash2i(i, g, sd + 9)); };
    if (g == G_GRASS || g == G_FOREST || g == G_SAKURA || g == G_MARSH) {
      dot(6, [&](u32 h) { int x = h & 15, y = (h >> 4) & 15; putpx(x, y, ramp(base, 1.6f)); putpx(x, y - 1, ramp(base, 1.1f)); putpx(x, y + 1, ramp(base, -1.2f)); });
      if (g == G_SAKURA) dot(3, [&](u32 h) { putpx((h >> 3) & 15, (h >> 8) & 15, HEX(0xf6b8ca)); });
      if (g == G_FOREST) dot(3, [&](u32 h) { putpx((h >> 3) & 15, (h >> 8) & 15, HEX(0x8a6a3a)); });
      if (g == G_MARSH) dot(2, [&](u32 h) { int x = (h >> 3) & 14, y = (h >> 8) & 14; frect(x, y, 2, 1, HEX(0x3a5a58)); });
    }
    if (g == G_PATH) dot(4, [&](u32 h) { int x = h & 14, y = (h >> 4) & 14; putpx(x, y, ramp(base, 1.3f)); putpx(x + 1, y + 1, ramp(base, -1.5f)); });
    if (g == G_ROCK) dot(2, [&](u32 h) { int x = h & 11, y = (h >> 4) & 11; line(x, y, x + 3, y + 2, ramp(base, -1.6f)); });
    if (g == G_DIRT) dot(3, [&](u32 h) { putpx(h & 15, (h >> 4) & 15, ramp(base, 1.4f)); });
    ENDPAINT
  }
  /* ---- blocks (stone / ores / walls) ---- */
  void genBlock(int b, int south, int v) { // south=1 => has solid block below (no front face)
    Img& im = block[b][south][v]; im = mk(16, 16); PAINT(im);
    u32 top, front; u32 sd = b * 77 + v * 13 + south;
    switch (b) { case B_DARK: top = 0x5e5a70; break; case B_WOODWALL: top = 0xa8763e; break; case B_STONEWALL: top = 0xa8a8b4; break; default: top = 0x8d8a98; }
    front = ramp(HEX(top), -1.4f); int fh = south ? 0 : 5;
    for (int y = 0; y < 16 - fh; y++) for (int x = 0; x < 16; x++) {
      float n = hash2(x, y, sd); float k = n < 0.14f ? -0.8f : n > 0.9f ? 0.8f : 0; if (y == 0) k += 0.9f; if (x == 0) k += 0.4f; if (x == 15) k -= 0.6f;
      u32 c = ramp(HEX(top), k);
      if (b == B_WOODWALL) { int row = y / 4; c = ramp(HEX(top), ((y & 3) == 3 ? -1.4f : (y & 3) == 0 ? 0.6f : 0) + (hash2(x / 8, row, sd) - 0.5f) * 0.6f + ((x + row * 7) % 16 == 0 ? -1.2f : 0)); }
      if (b == B_STONEWALL) { int row = y / 5; int off = (row & 1) * 4; bool mo = y % 5 == 4 || (x + off) % 8 == 7; c = ramp(HEX(top), mo ? -1.7f : ((y % 5 == 0) ? 0.7f : k * 0.5f)); }
      putpx(x, y, c);
    }
    for (int y = 16 - fh; y < 16; y++) for (int x = 0; x < 16; x++) { float n = hash2(x, y, sd + 3); u32 c = ramp(front, n < 0.2f ? -0.6f : n > 0.9f ? 0.5f : 0); if (y == 16 - fh) c = ramp(HEX(top), -0.6f); if (b == B_WOODWALL) c = ramp(HEX(0x8a5a30), (y == 16 - fh ? 0.2f : -0.4f) + ((x & 3) == 3 ? -0.6f : 0)); if (b == B_STONEWALL) c = ramp(HEX(0x8a8a96), -0.8f + (((x + y * 3) & 7) == 7 ? -0.9f : 0)); putpx(x, y, c); }
    auto ore = [&](u32 col, int cnt, bool crystal) {
      for (int i = 0; i < cnt; i++) { u32 h = hash2i(i, b, sd + v * 5); int x = 2 + (h & 7) + ((h >> 8) & 3), y = 1 + ((h >> 4) & 7); x = std::min(x, 12); y = std::min(y, 9 - fh / 3);
        if (crystal) { vline(x, y - 1, 4, ramp(col, 0.8f)); vline(x + 1, y, 3, ramp(col, -0.4f)); putpx(x, y - 1, HEX(0xe8fff4)); }
        else { frect(x, y, 2, 2, col); putpx(x, y, ramp(col, 1.2f)); putpx(x + 1, y + 1, ramp(col, -1.2f)); } }
    };
    if (b == B_COAL) ore(HEX(0x2a2832), 6, false); if (b == B_IRON) ore(HEX(0xd8a888), 5, false); if (b == B_GOLD) ore(HEX(0xf2c24a), 5, false); if (b == B_GEM) ore(HEX(0x4ae0a8), 3, true);
    if (b == B_STONE || b == B_DARK) for (int i = 0; i < 2; i++) { u32 h = hash2i(i, v, sd); int x = h & 7, y = 1 + ((h >> 4) & 5); line(x, y, x + 4, y + 1, ramp(HEX(top), -1.6f)); }
    ENDPAINT
  }

  /* ---- objects ---- */
  Spr& O(int o, int v = 0) { return obj[o][v & 7]; }
  static Spr mkSpr(int w, int h, int ax, int ay) { Spr s; s.im = Img(w, h); s.ax = ax; s.ay = ay; return s; }
  void genTrees() {
    for (int v = 0; v < 4; v++) {
      { Spr s = mkSpr(34, 42, 17, 40); PAINT(s.im); u32 sd = 100 + v;
        trunk(14, 26, 40, 5, 0x6a4428); fcircle(16.5f, 40, 3.5f, 0x2a1f2a); // root shadow
        frect(12, 39, 9, 1, withA(0x000000, 70));
        trunk(14, 26, 40, 5, 0x6a4428); putpx(12, 39, 0xFF5a3a22); putpx(20, 39, 0xFF5a3a22);
        u32 lc = v == 3 ? 0x7ab24a : 0x4e9a3e;
        blob(17, 20, 13, 11, ramp(HEX(lc), -0.5f), sd, 1); blob(10, 17, 8, 8, HEX(lc), sd + 1); blob(24, 16, 8, 8, HEX(lc), sd + 2); blob(17, 11, 9, 8, ramp(HEX(lc), 0.4f), sd + 3);
        for (int i = 0; i < 7; i++) { u32 h = hash2i(i, v, sd); putpx(6 + (h & 15) + (h >> 8 & 7), 8 + (h >> 4 & 15), ramp(HEX(lc), 1.8f)); }
        finish(s.im); ENDPAINT obj[O_OAK][v] = s; }
      { Spr s = mkSpr(30, 48, 15, 46); PAINT(s.im); u32 sd = 200 + v; frect(10, 45, 9, 1, withA(0x000000, 70)); trunk(13, 36, 46, 4, 0x5a3a24);
        u32 lc = v & 1 ? 0x2f7a52 : 0x3a8a4a;
        for (int t = 0; t < 4; t++) { float cy = 36 - t * 8.5f, w = 13 - t * 2.6f; for (int j = 0; j < 12; j++) { float f = (float)j / 11, hw = w * (0.15f + 0.85f * f); for (int i = -(int)hw; i <= (int)hw; i++) { float dx = i / std::max(hw, 1.f); float k = -dx * 1.2f + (1 - f) * 0.5f - 0.3f + (hash2(i, j + t * 20, sd) - 0.5f) * 0.9f; if (j == 11) k -= 0.9f; putpx(15 + i, (int)cy - 10 + j, ramp(HEX(lc), std::round(clampf(k, -2, 2)) * 0.9f)); } } }
        if (v >= 2) for (int t = 0; t < 4; t++) hline(11 + t * 2, 14 + t * 8, 3, HEX(0xf4f8ff)); // snowy
        finish(s.im); ENDPAINT obj[O_PINE][v] = s; }
      { Spr s = mkSpr(36, 42, 18, 40); PAINT(s.im); u32 sd = 300 + v; frect(13, 39, 9, 1, withA(0x000000, 70)); trunk(15, 27, 40, 5, 0x5a3e34);
        u32 lc = 0xf2a8c0; blob(18, 20, 14, 11, ramp(HEX(lc), -0.6f), sd); blob(10, 17, 9, 8, HEX(lc), sd + 1); blob(26, 16, 9, 8, HEX(lc), sd + 2); blob(18, 11, 10, 8, ramp(HEX(lc), 0.5f), sd + 3);
        for (int i = 0; i < 9; i++) { u32 h = hash2i(i, v, sd); putpx(6 + (h & 15) + (h >> 8 & 7), 8 + (h >> 4 & 15), i & 1 ? HEX(0xffe4ee) : HEX(0xd8789a)); }
        finish(s.im, 0xFF3a1a2e); ENDPAINT obj[O_SAKURA][v] = s; }
      { Spr s = mkSpr(30, 42, 15, 40); PAINT(s.im); u32 sd = 400 + v; frect(11, 39, 8, 1, withA(0x000000, 70));
        for (int y = 14; y < 40; y++) for (int i = 0; i < 4; i++) putpx(13 + i, y, i == 0 ? HEX(0xf4f0e8) : i == 3 ? HEX(0xb8b0a4) : ((y + v * 3) % 7 == 0 && i < 3 ? HEX(0x3a3430) : HEX(0xe2dccc)));
        blob(15, 15, 11, 9, HEX(0x9acb52), sd); blob(9, 20, 7, 6, HEX(0x8abb48), sd + 1); blob(21, 19, 7, 6, HEX(0x8abb48), sd + 2); blob(15, 9, 7, 6, ramp(HEX(0x9acb52), 0.5f), sd + 3);
        finish(s.im); ENDPAINT obj[O_BIRCH][v] = s; }
    }
    for (int v = 0; v < 4; v++) { Spr s = mkSpr(32, 40, 16, 38); PAINT(s.im); frect(11, 37, 9, 1, withA(0x000000, 60)); trunk(14, 18, 38, 4, 0x4a3a34);
      line(16, 24, 7 + v, 12 - v, HEX(0x4a3a34)); line(17, 22, 26 - v, 10 + v, HEX(0x4a3a34)); line(16, 28, 9, 22, HEX(0x5a463c)); line(17, 20, 17, 8 + v, HEX(0x4a3a34)); finish(s.im); ENDPAINT obj[O_DEADTREE][v] = s; }
    { Spr s = mkSpr(16, 14, 8, 14); PAINT(s.im); for (int y = 4; y < 13; y++) for (int i = 3; i < 13; i++) putpx(i, y, ramp(HEX(0x8a5a34), i < 5 ? 0.6f : i > 10 ? -1 : (hash2(i, y, 4) < 0.2f ? -0.5f : 0)));
      fellipse(8, 5, 5.5f, 2.6f, HEX(0xc89a5a)); fellipse(8, 5, 3.2f, 1.4f, HEX(0xa87a44)); finish(s.im); ENDPAINT obj[O_STUMP][0] = s; }
    for (int v = 0; v < 4; v++) { Spr s = mkSpr(16, 40, 8, 38); PAINT(s.im); u32 c = 0x86c04e; int w = 3 + (v & 1);
      for (int st = 0; st < 2; st++) { int x = 3 + st * 7 + (v >> 1); for (int y = 0; y < 38; y++) for (int i = 0; i < w; i++) putpx(x + i, y, ramp(HEX(c), i == 0 ? 1 : i == w - 1 ? -1.3f : (y % 12 < 1 ? -1.6f : 0)));
        for (int y = 6; y < 38; y += 11) { frect(x - 1, y, w + 2, 1, ramp(HEX(c), -1.8f)); }
        for (int k = 0; k < 3; k++) { int ly = 4 + k * 9; for (int q = 0; q < 4; q++) putpx(x + w + q, ly - q / 2, ramp(HEX(0x6aa83c), 0.3f * k)); } }
      finish(s.im, 0xFF1a2a1a); ENDPAINT obj[O_BAMBOO][v] = s; }
  }
  void genPlants() {
    for (int v = 0; v < 2; v++) { Spr s = mkSpr(20, 14, 10, 14); PAINT(s.im); u32 c = v ? 0x5a9a3e : 0x6ab04a; blob(10, 8, 8, 5, HEX(c), 500 + v); blob(6, 9, 5, 4, ramp(HEX(c), 0.4f), 501 + v); finish(s.im); ENDPAINT obj[O_BUSH][v] = s; }
    { Spr s = mkSpr(20, 14, 10, 14); PAINT(s.im); blob(10, 8, 8, 5, HEX(0x5a9a3e), 510); blob(6, 9, 5, 4, HEX(0x6ab04a), 511); for (int i = 0; i < 6; i++) { u32 h = hash2i(i, 5, 51); fcircle(4 + (h & 7) + (h >> 8 & 5), 5 + (h >> 4 & 5), 1.2f, HEX(0xd83a4a)); putpx(4 + (h & 7) + (h >> 8 & 5), 4 + (h >> 4 & 5), HEX(0xff9aa8)); } finish(s.im); ENDPAINT obj[O_BERRY][0] = s; }
    for (int v = 0; v < 8; v++) { Spr s = mkSpr(18, 14, 9, 14); PAINT(s.im); int sz = 4 + (v & 3) * 2; u32 c = 0x8c8a98;
      blob(9, 14 - sz / 2.f - 1, sz + 2, sz * 0.62f + 1, HEX(c), 600 + v, 1.2f); if (v & 1) blob(5, 12, 3.5f, 2.5f, ramp(HEX(c), 0.3f), 640 + v); if (v == 5) fcircle(9, 9, 1.2f, HEX(0x5aa84a)); finish(s.im); ENDPAINT obj[O_BOULDER][v] = s; }
    for (int v = 0; v < 8; v++) { Spr s = mkSpr(14, 8, 7, 8); PAINT(s.im); for (int i = 0; i < 3; i++) { u32 h = hash2i(i, v, 61); blob(3 + (h & 7), 5 + (h >> 4 & 1), 2.2f, 1.6f, HEX(0x9a98a4), 700 + v * 3 + i, 1.2f); } finish(s.im); ENDPAINT obj[O_PEBBLE][v] = s; }
    for (int v = 0; v < 4; v++) { Spr s = mkSpr(16, 14, 8, 14); PAINT(s.im); u32 c = v == 3 ? 0x7ab04a : 0x6aa83c;
      for (int k = 0; k < 7; k++) { u32 h = hash2i(k, v, 71); int x = 2 + (h & 11), hh = 5 + (h >> 4 & 6); for (int y = 0; y < hh; y++) putpx(x + (y > hh / 2 ? ((h >> 9 & 1) ? 1 : -1) * (y - hh / 2) / 3 : 0), 13 - y, ramp(HEX(c), y > hh - 3 ? 1.4f : y < 2 ? -1.4f : 0.2f * (k & 1))); }
      ENDPAINT obj[O_TALLGRASS][v] = s; }
    { static const u32 FC[8] = {0xf6b8ca, 0xfff0a0, 0xffffff, 0xb8a8f0, 0xf08a5a, 0xf0d040, 0xff7aa0, 0x8ac8f8};
      for (int v = 0; v < 8; v++) { Spr s = mkSpr(14, 12, 7, 12); PAINT(s.im); for (int k = 0; k < 3; k++) { int x = 3 + k * 4 + (v >> 2), y = 6 + (k & 1) * 2 - (v & 1); vline(x, y + 1, 12 - y - 1, HEX(0x4a8a3a)); putpx(x - 1, y, HEX(FC[(v + k) & 7])); putpx(x + 1, y, HEX(FC[(v + k) & 7])); putpx(x, y - 1, ramp(HEX(FC[(v + k) & 7]), 0.6f)); putpx(x, y + 1, HEX(FC[(v + k) & 7])); putpx(x, y, HEX(0xf8d848)); } ENDPAINT obj[O_FLOWERS][v] = s; } }
    for (int v = 0; v < 2; v++) { Spr s = mkSpr(18, 20, 9, 20); PAINT(s.im); u32 c = 0x6a8a3a; for (int k = 0; k < 6; k++) { int x = 3 + k * 2 + (v & 1), hh = 10 + (k * 7 + v * 3) % 9; for (int y = 0; y < hh; y++) putpx(x + (y > hh - 4 ? 1 : 0), 19 - y, ramp(HEX(c), y > hh - 4 ? 1.2f : -0.4f + (k & 1) * 0.5f)); frect(x, 19 - hh - 2, 2, 3, HEX(0x7a4a2a)); } ENDPAINT obj[O_REEDS][v] = s; }
    { static const u32 MC[8] = {0xd84a3a, 0xe8d8b8, 0xb8783a, 0xd84a3a, 0xe8d8b8, 0xb8783a, 0xc86ac0, 0xf0b040};
      for (int v = 0; v < 8; v++) { Spr s = mkSpr(12, 12, 6, 12); PAINT(s.im); u32 c = MC[v]; vline(5, 7, 4, HEX(0xefe4cc)); vline(6, 7, 4, HEX(0xcfc2a6)); fellipse(6, 6, 4.5f, 3, HEX(c)); frect(2, 7, 9, 1, ramp(HEX(c), -1.2f)); if (v % 3 == 0) { putpx(4, 4, HEX(0xffffff)); putpx(7, 5, HEX(0xffffff)); } finish(s.im); ENDPAINT obj[O_MUSHROOM][v] = s; } }
    { Spr s = mkSpr(16, 10, 8, 8); PAINT(s.im); fellipse(8, 5, 6.5f, 3.5f, HEX(0x4a9a48)); fellipse(8, 5, 6.5f, 3.5f, HEX(0x4a9a48)); for (int i = 0; i < 6; i++) putpx(6 + i, 5 - (i < 3), HEX(0x3a82e0)); putpx(8, 4, HEX(0xf6b8ca)); putpx(7, 3, HEX(0xfff0f4)); putpx(9, 3, HEX(0xfff0f4)); fellipse(8, 5, 6.5f, 3.5f, 0); ENDPAINT
      Spr t = mkSpr(16, 10, 8, 8); PAINT(t.im); for (int y = 0; y < 10; y++) for (int x = 0; x < 16; x++) { float dx = (x + .5f - 8) / 6.5f, dy = (y + .5f - 5) / 3.5f; float d = dx * dx + dy * dy; if (d <= 1 && !(x > 8 && y < 5 && y > 4 - (x - 8) / 3)) putpx(x, y, ramp(HEX(0x4aa04a), (dy < -0.3f ? 0.7f : d > 0.7f ? -0.9f : 0))); } putpx(9, 4, HEX(0xf6b8ca)); putpx(8, 4, HEX(0xfff0f4)); putpx(10, 4, HEX(0xd878a0)); putpx(9, 3, HEX(0xf6b8ca)); obj[O_LILY][0] = t; ENDPAINT }
    { Spr s = mkSpr(16, 28, 8, 28); PAINT(s.im); frect(5, 27, 7, 1, withA(0x000000, 60)); for (int y = 6; y < 27; y++) for (int i = 0; i < 6; i++) putpx(5 + i, y, ramp(HEX(0x4aa05a), i < 2 ? 0.8f : i > 3 ? -1.2f : (i == 2 && y % 5 == 0 ? -1 : 0)));
      for (int y = 11; y < 20; y++) { for (int i = 0; i < 3; i++) putpx(2 + i, y, ramp(HEX(0x4aa05a), i == 0 ? 0.6f : -0.8f)); putpx(2, 11, ramp(HEX(0x4aa05a), 0.6f)); } for (int y = 14; y < 22; y++) for (int i = 0; i < 3; i++) putpx(11 + i, y, ramp(HEX(0x4aa05a), i == 0 ? 0.6f : -0.8f)); putpx(8, 5, HEX(0xf06a8a)); putpx(7, 5, HEX(0xf06a8a)); finish(s.im, 0xFF14281c); ENDPAINT obj[O_CACTUS][0] = s; }
    { Spr s = mkSpr(12, 14, 6, 13); PAINT(s.im); vline(6, 7, 6, HEX(0x6a4a2a)); blob(6, 5, 3.5f, 3, HEX(0x62b04a), 810); blob(4, 6, 2.5f, 2, ramp(HEX(0x62b04a), 0.5f), 811); finish(s.im); ENDPAINT obj[O_SAPLING][0] = s; }
    // crops: 4 growth stages
    for (int c = 0; c < 5; c++) for (int st = 0; st < 4; st++) {
      Spr s = mkSpr(16, 18, 8, 15); PAINT(s.im); float gf = st / 3.f; int hgt = 3 + (int)(gf * 9);
      u32 leaf = 0x5aa040, fruit[5] = {0xe8c050, 0xf08a2a, 0xe03a3a, 0xe88a2a, 0xe8e0a0}; u32 fc = fruit[c];
      if (c == 3) { // pumpkin: broad leaves + gourds
        if (st == 0) { putpx(8, 13, HEX(leaf)); putpx(8, 12, HEX(leaf)); } else { blob(5, 12, 3.5f + gf * 2, 2.5f, HEX(leaf), 820); blob(11, 12, 3.5f + gf * 2, 2.5f, ramp(HEX(leaf), 0.3f), 821); }
        if (st == 3) { fellipse(8, 11.5f, 5, 3.6f, HEX(fc)); for (int i = -3; i <= 3; i += 3) vline(8 + i, 9, 5, ramp(HEX(fc), -1.2f)); vline(8, 7, 2, HEX(0x4a8a30)); putpx(6, 10, ramp(HEX(fc), 1.4f)); }
      } else for (int k = 0; k < 5; k++) { int x = 2 + k * 3; int hh = hgt - (k & 1) * 2; if (st == 0) hh = 2 + (k & 1);
        for (int y = 0; y < hh; y++) putpx(x, 14 - y, ramp(HEX(leaf), y > hh - 2 ? 1 : -0.4f)); if (st >= 1 && c != 4) { putpx(x - 1, 14 - hh / 2, HEX(leaf)); putpx(x + 1, 14 - hh / 2 - 1, HEX(leaf)); }
        if (st == 3) { if (c == 0) { frect(x - 1, 14 - hh - 3, 3, 4, HEX(fc)); putpx(x, 14 - hh - 4, ramp(HEX(fc), 1)); vline(x - 1, 14 - hh - 2, 2, ramp(HEX(fc), -1)); } if (c == 1) { frect(x - 1, 13, 3, 2, HEX(fc)); putpx(x, 15, HEX(fc)); putpx(x, 12, HEX(0x5aa040)); putpx(x - 1, 11, HEX(0x5aa040)); putpx(x + 1, 11, HEX(0x5aa040)); }
          if (c == 2) { fcircle(x, 14 - hh / 2, 1.6f, HEX(fc)); putpx(x - 1, 14 - hh / 2 - 1, HEX(0xff9a8a)); } if (c == 4) { for (int q = 0; q < 3; q++) putpx(x + (q & 1), 14 - hh - q, HEX(0xe0d080)); putpx(x - 1, 14 - hh - 1, HEX(0xe0d080)); } } }
      finish(s.im, 0xFF1a2a14); ENDPAINT cropSpr[c][st] = s; }
  }
  /* ---- placeables ---- */
  void genPlaceables() {
    auto S = [&](int o, int w, int h, int ax, int ay, std::function<void()> f) { Spr s = mkSpr(w, h, ax, ay); PAINT(s.im); f(); finish(s.im); ENDPAINT obj[o][0] = s; };
    S(O_TORCH, 8, 16, 4, 16, [] { vline(3, 7, 8, HEX(0x7a5430)); vline(4, 7, 8, HEX(0x5a3a22)); frect(2, 5, 4, 3, HEX(0x3a3038)); });
    S(O_CAMPFIRE, 18, 14, 9, 14, [] { for (int i = 0; i < 6; i++) putpx(2 + i * 2, 12 - (i & 1), HEX(0x8a8a96)), putpx(3 + i * 2, 12 - (i & 1), HEX(0x6a6a76)); capsule(4, 11, 13, 8, 1.6f, HEX(0x6a4428)); capsule(5, 8, 12, 11, 1.6f, HEX(0x7a5434)); });
    S(O_CHEST, 16, 14, 8, 14, [] { frect(2, 5, 12, 8, HEX(0x9a6a3a)); frect(2, 3, 12, 4, HEX(0xb07e44)); hline(2, 3, 12, HEX(0xd0a060)); hline(2, 7, 12, HEX(0x3a3038)); frect(7, 6, 2, 3, HEX(0xf2c24a)); vline(2, 3, 10, HEX(0x6a4428)); vline(13, 3, 10, HEX(0x5a3820)); hline(2, 12, 12, HEX(0x5a3820)); });
    S(O_BENCH, 20, 16, 10, 16, [] { frect(1, 4, 18, 5, HEX(0xb07e44)); hline(1, 4, 18, HEX(0xd0a060)); hline(1, 8, 18, HEX(0x7a5430)); frect(2, 9, 2, 6, HEX(0x7a5430)); frect(16, 9, 2, 6, HEX(0x6a4428)); frect(5, 2, 4, 2, HEX(0x9a9aa4)); frect(12, 3, 4, 1, HEX(0x6a4428)); });
    S(O_FURNACE, 16, 18, 8, 18, [] { frect(1, 3, 14, 14, HEX(0x8a8a96)); for (int y = 3; y < 17; y += 4) hline(1, y, 14, HEX(0x6a6a76)); hline(1, 3, 14, HEX(0xb0b0bc)); frect(4, 9, 8, 6, HEX(0x2a2430)); frect(5, 11, 6, 3, HEX(0xf08a2a)); frect(6, 12, 4, 2, HEX(0xf8d060)); frect(5, 0, 3, 3, HEX(0x6a6a76)); });
    S(O_ANVIL, 18, 14, 9, 14, [] { frect(2, 3, 14, 4, HEX(0x7a7a88)); hline(2, 3, 14, HEX(0xb4b4c0)); frect(0, 4, 3, 2, HEX(0x7a7a88)); frect(6, 7, 6, 3, HEX(0x5a5a68)); frect(4, 10, 10, 3, HEX(0x4a4a58)); hline(4, 10, 10, HEX(0x6a6a78)); });
    S(O_BED, 16, 18, 8, 18, [] { frect(1, 2, 14, 15, HEX(0x7a5430)); frect(2, 4, 12, 12, HEX(0xf0e6d0)); frect(2, 4, 12, 3, HEX(0xffffff)); frect(2, 8, 12, 8, HEX(0xe8788a)); hline(2, 8, 12, HEX(0xf8a0b0)); hline(2, 15, 12, HEX(0xb85870)); });
    S(O_LANTERN, 12, 22, 6, 22, [] { frect(3, 20, 6, 2, HEX(0x7a7a88)); frect(5, 11, 2, 9, HEX(0x8a8a96)); frect(2, 6, 8, 6, HEX(0x8a8a96)); frect(3, 7, 6, 4, HEX(0xffd878)); frect(4, 8, 4, 2, HEX(0xfff4c0)); frect(1, 4, 10, 2, HEX(0x6a6a76)); frect(3, 2, 6, 2, HEX(0x7a7a88)); putpx(5, 1, HEX(0x8a8a96)); putpx(6, 1, HEX(0x8a8a96)); });
    S(O_SCARECROW, 20, 26, 10, 26, [] { vline(9, 8, 17, HEX(0x7a5430)); vline(10, 8, 17, HEX(0x5a3a22)); frect(1, 11, 18, 2, HEX(0x7a5430)); frect(6, 11, 8, 8, HEX(0xc8a050)); frect(6, 13, 8, 1, HEX(0xa88030)); fcircle(10, 6, 4, HEX(0xe8c080)); frect(5, 4, 11, 2, HEX(0xa86a3a)); frect(7, 1, 7, 4, HEX(0xa86a3a)); putpx(8, 6, HEX(0x2a2028)); putpx(11, 6, HEX(0x2a2028)); frect(1, 13, 2, 3, HEX(0xc8a050)); frect(17, 13, 2, 3, HEX(0xc8a050)); });
    S(O_SIGN, 16, 20, 8, 20, [] { vline(7, 9, 11, HEX(0x7a5430)); vline(8, 9, 11, HEX(0x5a3a22)); frect(1, 2, 14, 8, HEX(0xc89a5a)); hline(1, 2, 14, HEX(0xe0b878)); hline(1, 9, 14, HEX(0x8a6234)); hline(3, 5, 10, HEX(0x6a4428)); hline(3, 7, 7, HEX(0x6a4428)); });
    S(O_WELL, 20, 26, 10, 26, [] { frect(2, 14, 16, 11, HEX(0x8a8a96)); for (int y = 14; y < 25; y += 3) hline(2, y, 16, HEX(0x6a6a76)); hline(2, 14, 16, HEX(0xb4b4c0)); frect(4, 14, 12, 3, HEX(0x2a5a8a)); frect(2, 4, 2, 11, HEX(0x7a5430)); frect(16, 4, 2, 11, HEX(0x6a4428)); frect(0, 1, 20, 4, HEX(0x6a7a9a)); hline(0, 1, 20, HEX(0x9aaaca)); frect(9, 5, 2, 5, HEX(0xc8a470)); frect(8, 9, 4, 3, HEX(0x7a5430)); });
    S(O_BARREL, 14, 16, 7, 16, [] { frect(2, 2, 10, 13, HEX(0x9a6a3a)); fellipse(7, 2.5f, 5, 2, HEX(0xc89a5a)); hline(2, 5, 10, HEX(0x4a4a58)); hline(2, 11, 10, HEX(0x4a4a58)); vline(2, 3, 11, HEX(0xc08a4a)); vline(11, 3, 11, HEX(0x6a4428)); });
    S(O_CRATE, 16, 16, 8, 16, [] { frect(1, 2, 14, 13, HEX(0xb07e44)); srect(1, 2, 14, 13, HEX(0x6a4428)); line(2, 3, 13, 14, HEX(0x8a5a30)); line(13, 3, 2, 14, HEX(0x8a5a30)); hline(1, 2, 14, HEX(0xd0a060)); });
    S(O_HAY, 18, 18, 9, 18, [] { fellipse(9, 11, 8, 6, HEX(0xe0b84a)); for (int i = 0; i < 12; i++) { u32 h = hash2i(i, 3, 9); putpx(2 + (h & 13), 6 + (h >> 4 & 9), (i & 1) ? HEX(0xf8e07a) : HEX(0xb88a2a)); } frect(2, 11, 14, 1, HEX(0x8a6a2a)); });
    S(O_STALL, 28, 32, 14, 32, [] { frect(2, 12, 24, 4, HEX(0xc89a5a)); hline(2, 12, 24, HEX(0xe0b878)); frect(2, 16, 24, 10, HEX(0x9a6a3a)); hline(2, 25, 24, HEX(0x5a3820)); frect(2, 8, 2, 18, HEX(0x7a5430)); frect(24, 8, 2, 18, HEX(0x6a4428));
      for (int i = 0; i < 28; i++) frect(i, 2 + (i % 4 < 2 ? 0 : 1), 1, 8 - (i % 4 < 2 ? 0 : 1), (i / 4) & 1 ? HEX(0xf6f0e4) : HEX(0xd8484a)); for (int i = 0; i < 4; i++) { fcircle(6 + i * 5, 11, 1.8f, i & 1 ? HEX(0xe8a02a) : HEX(0xd83a3a)); } });
    S(O_TORII, 42, 40, 21, 40, [] { frect(5, 8, 4, 32, HEX(0xc8423a)); frect(33, 8, 4, 32, HEX(0xc8423a)); vline(5, 8, 32, HEX(0xe8605a)); vline(33, 8, 32, HEX(0xe8605a)); frect(0, 4, 42, 4, HEX(0x2a2430)); frect(1, 2, 40, 3, HEX(0xc8423a)); frect(0, 0, 42, 2, HEX(0x2a2430)); frect(3, 12, 36, 3, HEX(0xc8423a)); frect(18, 7, 6, 6, HEX(0x2a2430)); frect(4, 36, 6, 4, HEX(0x2a2430)); frect(32, 36, 6, 4, HEX(0x2a2430)); });
    S(O_KOI, 16, 16, 8, 16, [] { fellipse(8, 11, 7, 4, HEX(0x8a8a96)); fellipse(8, 10, 5.5f, 3, HEX(0x4aa8cf)); putpx(6, 9, HEX(0xff8a3a)); putpx(7, 9, HEX(0xff8a3a)); putpx(10, 11, HEX(0xffffff)); });
    S(O_GRAVE, 16, 14, 8, 14, [] { fellipse(8, 10, 6, 3, HEX(0x6a4a2a)); frect(4, 5, 8, 6, HEX(0xa07040)); hline(4, 5, 8, HEX(0xc89a5a)); frect(7, 3, 2, 3, HEX(0xf2c24a)); });
    S(O_SPIKES, 16, 12, 8, 12, [] { for (int i = 0; i < 4; i++) { int x = 1 + i * 4; for (int y = 0; y < 8; y++) frect(x + (y < 3 ? 1 : 0), 3 + y, y < 3 ? 1 : 3, 1, y < 3 ? HEX(0xd8dce8) : HEX(0x8a8a98)); } });
    S(O_TOWER, 28, 52, 14, 52, [] { for (int x : {3, 22}) { frect(x, 20, 3, 31, HEX(0x7a5430)); vline(x, 20, 31, HEX(0xa07040)); } frect(3, 30, 22, 2, HEX(0x7a5430)); line(5, 32, 22, 48, HEX(0x6a4428)); line(22, 32, 5, 48, HEX(0x6a4428)); frect(1, 12, 26, 8, HEX(0xb07e44)); hline(1, 12, 26, HEX(0xd0a060)); for (int x = 2; x < 27; x += 4) vline(x, 13, 7, HEX(0x7a5430)); frect(0, 8, 28, 4, HEX(0x4a5a7a)); frect(4, 4, 20, 4, HEX(0x5a6a8a)); frect(9, 1, 10, 3, HEX(0x6a7a9a)); });
    S(O_POT, 14, 14, 7, 14, [] { fellipse(7, 8, 6, 5, HEX(0x3a3640)); fellipse(7, 5, 5, 2, HEX(0xb85a2a)); frect(2, 10, 10, 2, HEX(0x2a2630)); frect(0, 5, 2, 2, HEX(0x4a4a58)); frect(12, 5, 2, 2, HEX(0x4a4a58)); frect(3, 12, 2, 2, HEX(0x5a4a3a)); frect(9, 12, 2, 2, HEX(0x5a4a3a)); });
    S(O_SHRINE, 22, 28, 11, 28, [] { frect(2, 24, 18, 4, HEX(0x8a8a96)); frect(4, 14, 14, 10, HEX(0xb0aab8)); hline(4, 14, 14, HEX(0xd0cad8)); frect(8, 17, 6, 7, HEX(0x2a2430)); frect(0, 9, 22, 5, HEX(0x6a4a3a)); frect(2, 6, 18, 4, HEX(0xc8423a)); frect(5, 3, 12, 4, HEX(0xd8584a)); frect(8, 24, 6, 1, HEX(0xf2c24a)); putpx(11, 20, HEX(0xf2c24a)); });
    S(O_DIG, 14, 10, 7, 10, [] { fellipse(7, 6, 5, 2.5f, HEX(0x6a4a30)); fellipse(7, 6, 3.5f, 1.5f, HEX(0x7a5a3a)); putpx(5, 5, HEX(0xf2c24a)); });
    S(O_BANNER, 14, 34, 7, 34, [] { frect(6, 3, 2, 31, HEX(0x7a5430)); frect(1, 3, 12, 2, HEX(0x7a5430)); frect(2, 5, 10, 18, HEX(0xffffff)); for (int y = 20; y < 24; y++) { int x0 = 2 + (y - 20); frect(2, y, x0 - 2 + (y > 21 ? 4 : 0), 1, 0); } });
    // fences (16 connection masks: 1=N,2=E,4=S,8=W) and gates
    for (int m = 0; m < 16; m++) { Spr s = mkSpr(16, 20, 8, 16); PAINT(s.im); u32 w = 0xb8864a;
      auto post = [&](int x) { frect(x, 4, 3, 12, HEX(w)); vline(x, 4, 12, ramp(HEX(w), 0.8f)); vline(x + 2, 4, 12, ramp(HEX(w), -1.2f)); frect(x, 3, 3, 1, ramp(HEX(w), 1.2f)); };
      if (m & 2) { frect(8, 6, 8, 2, HEX(w)); hline(8, 6, 8, ramp(HEX(w), 0.8f)); frect(8, 11, 8, 2, HEX(w)); hline(8, 12, 8, ramp(HEX(w), -1)); }
      if (m & 8) { frect(0, 6, 8, 2, HEX(w)); hline(0, 6, 8, ramp(HEX(w), 0.8f)); frect(0, 11, 8, 2, HEX(w)); hline(0, 12, 8, ramp(HEX(w), -1)); }
      if (m & 4) { frect(7, 8, 2, 8, HEX(ramp(HEX(w), -0.4f))); vline(7, 8, 8, ramp(HEX(w), 0.6f)); }
      if (m & 1) { frect(7, 3, 2, 6, HEX(ramp(HEX(w), -0.4f))); }
      post(6); finish(s.im); ENDPAINT fence[m] = s; }
    { Spr s = mkSpr(16, 20, 8, 16); PAINT(s.im); u32 w = 0xb8864a; frect(1, 4, 3, 12, HEX(w)); frect(12, 4, 3, 12, HEX(ramp(HEX(w), -0.6f))); frect(4, 6, 8, 2, HEX(0xd0a060)); frect(4, 11, 8, 2, HEX(0xd0a060)); line(4, 12, 11, 7, HEX(0x8a5a30)); finish(s.im); ENDPAINT gateClosed = s; }
    { Spr s = mkSpr(16, 20, 8, 16); PAINT(s.im); u32 w = 0xb8864a; frect(1, 4, 3, 12, HEX(w)); frect(12, 4, 3, 12, HEX(ramp(HEX(w), -0.6f))); frect(1, 6, 3, 2, HEX(0xd0a060)); frect(12, 6, 3, 2, HEX(0xd0a060)); frect(0, 8, 2, 7, HEX(0xa07040)); finish(s.im); ENDPAINT gateOpen = s; }
  }

  /* ---- buildings ---- */
  Spr& houseSpr(const Struct& st) {
    u64 key = ((u64)st.style << 8) ^ ((u64)st.kind << 4) ^ ((u64)st.w << 16) ^ ((u64)st.h << 24); auto it = houses.find(key); if (it != houses.end()) return it->second;
    int W = st.w * 16 + 10, H = st.h * 16 + 16; Spr s = mkSpr(W, H, 5, 0); PAINT(s.im);
    static const u32 roofs[] = {0x4a5f86, 0x5a4a6a, 0x7a4a3a, 0x4a6a62, 0x6a5a4a}; u32 roof = st.kind == 3 ? 0xc86a8a : st.kind == 1 ? 0x8a3a3a : st.kind == 2 ? 0x4a4a58 : roofs[st.style % 5];
    int wallH = 18, roofH = H - wallH + 5; u32 wall = 0xf0e6d0;
    for (int y = H - wallH; y < H; y++) for (int x = 5; x < W - 5; x++) { float n = hash2(x, y, st.style); bool beam = ((x - 5) % 16 == 0) || ((x - 5) % 16 == 15 && false) || y == H - wallH + 4 || y == H - 1; u32 c = beam ? HEX(0x6a4a2e) : ramp(HEX(wall), n < 0.1f ? -0.5f : n > 0.9f ? 0.3f : 0); if (y < H - wallH + 3) c = mixc(c, HEX(0x2a2030), 0.35f); putpx(x, y, c); }
    for (int i = 0; i < st.w; i++) { int x = 5 + i * 16; if (i == st.w / 2) { frect(x + 3, H - 15, 10, 15, HEX(0x3a2a22)); frect(x + 4, H - 14, 8, 14, HEX(0x5a3a28)); vline(x + 8, H - 14, 14, HEX(0x2a1c18)); putpx(x + 6, H - 7, HEX(0xf2c24a)); frect(x + 2, H - 18, 12, 4, HEX(0x2a3a5a)); frect(x + 4, H - 16, 8, 2, HEX(0xf6f0e4)); }
      else { frect(x + 3, H - 14, 10, 9, HEX(0x7a5a34)); frect(x + 4, H - 13, 8, 7, HEX(0xfff4d0)); vline(x + 8, H - 13, 7, HEX(0x9a7a4a)); hline(x + 4, H - 10, 8, HEX(0x9a7a4a)); } }
    // roof: hip shape narrowing to a ridge, tiled rows with curved eaves
    for (int y = 0; y < roofH; y++) { float f = (float)y / (roofH - 1); int inset = (int)std::round((1 - f) * std::min(14.f, W * 0.28f)); int flare = (y > roofH - 4) ? 1 : 0;
      for (int x = inset - flare; x < W - inset + flare; x++) { int row = y / 4; float n = hash2(x, y, st.style + 1); bool tileLine = (y & 3) == 3, col = ((x + (row & 1) * 3) % 6) == 5; float k = tileLine ? -1.3f : col ? -0.7f : (y & 3) == 0 ? 0.6f : 0; k += (n - 0.5f) * 0.3f + (x < inset + 3 ? 0.5f : 0) - (x > W - inset - 4 ? 0.8f : 0) - f * 0.0f;
        if (y < 3) k += 1.4f; if (y >= roofH - 2) k -= 0.9f; putpx(x, y, ramp(HEX(roof), k)); } }
    hline(std::min(14, W / 4), 0, W - 2 * std::min(14, W / 4), ramp(HEX(roof), 2.2f)); frect(W / 2 - 3, 0, 6, 2, HEX(0x2a2030));
    for (int y = roofH - 2; y < roofH; y++) hline(0, y, W, ramp(HEX(roof), -2.0f)); frect(0, roofH, W, 2, withA(0x000000, 60));
    finish(s.im); ENDPAINT return houses[key] = s;
  }

  /* ---- item icons (16x16) ---- */
  static void leafShape(int x, int y, u32 c) { putpx(x, y, c); putpx(x + 1, y - 1, ramp(c, 0.8f)); putpx(x + 1, y, ramp(c, -0.4f)); }
  Img makeIcon(const ItemDef& it) {
    Img im = mk(16, 16); PAINT(im); const std::string& id = it.id; u32 sd = hash2i((int)id.size(), (int)id[0], (int)id.back());
    auto toolC = [&](const std::string& s) { return s.find("wood") != std::string::npos ? 0xb0804a : s.find("stone") != std::string::npos ? 0x9a9aa6 : 0xcfd4e0; };
    auto round_ = [&](u32 c, float r = 5) { blob(8, 8.5f, r, r * 0.9f, HEX(c), sd); };
    auto has = [&](const char* p) { return id.find(p) != std::string::npos; };
    if (it.kind == K_PLACE && it.po && OBJS[it.po].name) { // miniature of the object
      Spr& s = obj[it.po][0]; if (s.im.w) { float sc = std::min(1.f, 15.f / std::max(s.im.w, s.im.h)); int dw = std::max(1, (int)(s.im.w * sc + .5f)), dh = std::max(1, (int)(s.im.h * sc + .5f)); blitScaled(s.im, (16 - dw) / 2, 15 - dh, dw, dh); }
    } else if (it.kind == K_PLACE && it.po == 0) {
      if (it.pb) { block[it.pb][0][0].w ? blit(block[it.pb][1][0], 1, 1) : void(); frect(1, 12, 14, 3, ramp(HEX(it.pb == B_WOODWALL ? 0xa8763e : 0xa8a8b4), -1.2f)); } else if (it.pg >= 0) { for (int y = 3; y < 14; y++) for (int x = 1; x < 15; x++) putpx(x, y, ground[it.pg][0].get(x, y)); }
    } else if (it.kind == K_TOOL && (it.tool == TL_AXE || it.tool == TL_PICK || it.tool == TL_HOE)) {
      u32 hc = toolC(id); capsule(3, 14, 11, 5, 0.9f, HEX(0x8a5a34)); capsule(3.5f, 13.5f, 11.5f, 4.5f, 0.2f, HEX(0xb07e44));
      if (it.tool == TL_AXE) { for (int i = 0; i < 6; i++) { frect(8 + i / 2, 2 + i, 6 - i, 1, ramp(HEX(hc), i < 2 ? 1 : i > 4 ? -1 : 0)); } frect(8, 4, 3, 4, HEX(hc)); }
      if (it.tool == TL_PICK) { for (int i = 0; i < 10; i++) { float t = i / 9.f; putpx(2 + (int)(t * 12), 3 + (int)(std::sin(t * PI) * -2.f + 3 + std::fabs(t - .5f) * 4), ramp(HEX(hc), t < 0.2f || t > 0.8f ? -0.4f : 0.6f)); putpx(2 + (int)(t * 12), 4 + (int)(std::sin(t * PI) * -2.f + 3 + std::fabs(t - .5f) * 4), ramp(HEX(hc), -0.8f)); } }
      if (it.tool == TL_HOE) { frect(9, 2, 5, 2, HEX(hc)); frect(12, 3, 2, 4, HEX(hc)); putpx(9, 2, ramp(HEX(hc), 1)); }
    } else if (it.kind == K_WEAPON && it.tool == TL_SWORD) {
      u32 bc = has("wood") ? 0xc89a5a : has("stone") ? 0xa8a8b4 : id == "katana" ? 0xbfffe0 : 0xe0e4f0; capsule(3, 12, 12, 3, 1.2f, HEX(bc)); capsule(3, 12, 12, 3, 0.3f, HEX(ramp(HEX(bc), 1.4f))); capsule(2.5f, 13.5f, 4.5f, 11.5f, 0.9f, HEX(0x6a3a28)); capsule(4.5f, 9.5f, 7.5f, 12.5f, 0.7f, HEX(id == "katana" ? 0xf2c24a : 0x8a8a96)); putpx(13, 2, HEX(0xffffff));
    } else if (it.tool == TL_SPEAR) { capsule(3, 13, 12, 4, 0.6f, HEX(0x8a5a34)); for (int i = 0; i < 4; i++) frect(11 + i / 2, 3 - i / 2 + (i > 2 ? 1 : 0), 1, 2, HEX(0xdfe3ee)); putpx(13, 2, HEX(0xffffff)); putpx(12, 3, HEX(0xdfe3ee)); putpx(11, 4, HEX(0xa8aebe));
    } else if (it.tool == TL_BOW) { for (int i = 0; i < 14; i++) { float t = i / 13.f; putpx(10 - (int)(std::sin(t * PI) * 5), 1 + i, HEX(0x8a5a34)); } line(10, 1, 10, 14, HEX(0xe8e0d0)); putpx(9, 8, HEX(0xc89a5a));
    } else if (it.kind == K_AMMO) { line(3, 13, 13, 3, HEX(0x8a5a34)); putpx(14, 2, HEX(0xdfe3ee)); putpx(13, 2, HEX(0xdfe3ee)); putpx(14, 3, HEX(0xdfe3ee)); putpx(2, 14, HEX(0xf8f0e8)); putpx(3, 14, HEX(0xf8f0e8)); putpx(2, 13, HEX(0xf8f0e8));
    } else if (it.tool == TL_ROD) { line(3, 14, 12, 3, HEX(0x8a5a34)); line(12, 3, 14, 10, HEX(0xe8e0d0)); fcircle(14, 11, 1.2f, HEX(0xe84a3a)); putpx(5, 12, HEX(0x6a6a76));
    } else if (it.tool == TL_CAN) { frect(3, 6, 8, 7, HEX(0x7aa0c8)); hline(3, 6, 8, HEX(0xaccae8)); hline(3, 12, 8, HEX(0x4a6a90)); line(11, 8, 14, 5, HEX(0x7aa0c8)); frect(13, 3, 3, 2, HEX(0x4a6a90)); capsule(4, 6, 8, 3, 0.6f, HEX(0x5a7aa0));
    } else if (it.tool == TL_SHEARS) { capsule(4, 4, 11, 11, 0.7f, HEX(0xcfd4e0)); capsule(11, 4, 4, 11, 0.7f, HEX(0xa8aebe)); fcircle(4, 13, 1.6f, HEX(0xd8484a)); fcircle(12, 13, 1.6f, HEX(0xb83a3a)); putpx(8, 8, HEX(0x4a4a58));
    } else if (it.tool == TL_BUCKET) { frect(3, 5, 10, 9, HEX(0x9a9aa6)); hline(3, 5, 10, HEX(0xc8c8d4)); hline(3, 13, 10, HEX(0x6a6a76)); vline(12, 6, 7, HEX(0x7a7a86)); line(3, 5, 8, 2, HEX(0x6a6a76)); line(13, 5, 8, 2, HEX(0x6a6a76));
    } else if (it.kind == K_ARMOR) { u32 c = id == "armor_iron" ? 0xc8423a : 0xa8723a; frect(3, 4, 10, 9, HEX(c)); frect(1, 4, 3, 4, ramp(HEX(c), -0.4f)); frect(12, 4, 3, 4, ramp(HEX(c), -0.4f)); hline(3, 4, 10, ramp(HEX(c), 1)); frect(6, 3, 4, 2, HEX(0x2a2430)); for (int y = 6; y < 13; y += 2) hline(3, y, 10, ramp(HEX(c), -0.9f)); if (id == "armor_iron") { frect(7, 6, 2, 6, HEX(0xf2c24a)); }
    } else if (id == "wood") { capsule(3, 11, 12, 6, 2.6f, HEX(0x8a5a34)); fellipse(12.5f, 5.8f, 2.2f, 2.6f, HEX(0xc89a5a)); fellipse(12.5f, 5.8f, 1.1f, 1.4f, HEX(0xa87a44)); capsule(3, 11.5f, 11, 7.5f, 0.3f, HEX(0xb07e44));
    } else if (id == "stick") { capsule(3, 13, 13, 3, 0.9f, HEX(0x8a5a34)); capsule(3, 12.5f, 12.5f, 2.5f, 0.2f, HEX(0xb07e44)); capsule(7, 9, 11, 10, 0.5f, HEX(0x7a4a2a));
    } else if (id == "stone" || id == "flint" || id == "coal" || has("_ore")) { u32 c = id == "stone" ? 0x9a9aa6 : id == "flint" ? 0x5a5a6a : id == "coal" ? 0x35323c : id == "iron_ore" ? 0x9a8a92 : 0x9a9a8a; blob(8, 9.5f, 5.5f, 4.5f, HEX(c), sd, 1.2f); if (has("_ore")) for (int i = 0; i < 4; i++) { u32 h = hash2i(i, 4, sd); frect(4 + (h & 7), 6 + (h >> 4 & 5), 2, 2, HEX(id == "iron_ore" ? 0xe0a880 : 0xf2c24a)); } if (id == "coal") putpx(6, 7, HEX(0x7a7a8a)); if (id == "flint") { putpx(6, 7, HEX(0xa0a0b4)); putpx(7, 7, HEX(0xa0a0b4)); }
    } else if (id == "iron" || id == "gold") { u32 c = id == "iron" ? 0xcfd4e0 : 0xf2c24a; frect(2, 7, 12, 6, HEX(c)); frect(3, 6, 10, 1, ramp(HEX(c), 1.4f)); hline(2, 7, 12, ramp(HEX(c), 1)); hline(2, 12, 12, ramp(HEX(c), -1.6f)); vline(13, 8, 4, ramp(HEX(c), -1)); putpx(5, 8, HEX(0xffffff)); finish(im);
    } else if (id == "jade") { vline(8, 2, 11, HEX(0x4ae0a8)); for (int i = 1; i < 5; i++) { vline(8 - i, 4 + i, 9 - i * 2, ramp(HEX(0x4ae0a8), 0.6f - i * 0.4f)); vline(8 + i, 4 + i, 9 - i * 2, ramp(HEX(0x4ae0a8), -0.4f - i * 0.4f)); } putpx(7, 4, HEX(0xe8fff4)); putpx(7, 5, HEX(0xb8ffe0));
    } else if (id == "fiber" || id == "wheat" || id == "rice") { u32 c = id == "fiber" ? 0x8fbf5a : id == "wheat" ? 0xe0b84a : 0xe8e4b0; for (int i = 0; i < 4; i++) { line(5 + i * 2, 14, 4 + i * 3, 4, HEX(ramp(HEX(0x8fbf5a), i * 0.2f))); if (id != "fiber") for (int k = 0; k < 3; k++) { putpx(3 + i * 3, 3 + k * 2, HEX(c)); putpx(5 + i * 3, 4 + k * 2, ramp(HEX(c), 0.6f)); } }
    } else if (id == "rope") { for (int r = 0; r < 3; r++) { fellipse(8, 8, 6 - r * 1.6f, 5 - r * 1.2f, HEX(ramp(HEX(0xc8a470), r == 1 ? 0.8f : -0.4f))); } fellipse(8, 8, 1.5f, 1.2f, 0); putpx(13, 12, HEX(0xc8a470)); putpx(14, 13, HEX(0xc8a470));
    } else if (id == "leather" || id == "rotten") { u32 c = id == "leather" ? 0xa06a3a : 0x7a8a50; blob(8, 8, 6, 5, HEX(c), sd); putpx(5, 6, ramp(HEX(c), 1)); frect(11, 4, 2, 2, ramp(HEX(c), -1));
    } else if (id == "wool") { for (int i = 0; i < 5; i++) { u32 h = hash2i(i, 8, sd); blob(5 + (h & 5), 6 + (h >> 4 & 3), 3.5f, 3, HEX(0xf4f0e8), sd + i); }
    } else if (id == "feather") { line(3, 13, 12, 3, HEX(0xf8f4ec)); for (int i = 0; i < 6; i++) { putpx(5 + i, 11 - i - 1, HEX(0xe8e4dc)); putpx(5 + i - 1, 11 - i + 1, HEX(0xcfcac0)); } putpx(2, 14, HEX(0x9a9488));
    } else if (id == "bone") { capsule(4, 12, 12, 4, 1.1f, HEX(0xf0ead8)); fcircle(3.5f, 12.5f, 1.8f, HEX(0xf0ead8)); fcircle(5.5f, 13.5f, 1.8f, HEX(0xe0d8c4)); fcircle(12.5f, 3.5f, 1.8f, HEX(0xf0ead8)); fcircle(10.5f, 2.5f, 1.8f, HEX(0xe0d8c4));
    } else if (id == "bamboo") { for (int s2 = 0; s2 < 2; s2++) { frect(4 + s2 * 5, 2, 3, 12, HEX(0x86c04e)); vline(4 + s2 * 5, 2, 12, HEX(0xa8e070)); vline(6 + s2 * 5, 2, 12, HEX(0x5a9a34)); for (int y = 5; y < 14; y += 4) hline(4 + s2 * 5, y, 3, HEX(0x3a6a22)); }
    } else if (id == "petals") { for (int i = 0; i < 5; i++) { u32 h = hash2i(i, 2, 7); fellipse(4 + (h & 7), 5 + (h >> 4 & 7), 2.2f, 1.5f, HEX(i & 1 ? 0xf6b8ca : 0xffd4e0)); }
    } else if (id == "flower") { vline(8, 8, 6, HEX(0x4a8a3a)); for (int a = 0; a < 5; a++) fcircle(8 + std::cos(a * TAU / 5) * 2.8f, 6 + std::sin(a * TAU / 5) * 2.8f, 1.7f, HEX(0xf6b8ca)); fcircle(8, 6, 1.4f, HEX(0xf8d848));
    } else if (id == "lotus") { for (int a = -2; a <= 2; a++) { line(8, 12, 8 + a * 2, 4 + std::abs(a), HEX(0xf6b8e0)); putpx(8 + a * 2, 4 + std::abs(a), HEX(0xffe4f4)); } frect(5, 12, 6, 2, HEX(0x4a9a48)); fcircle(8, 9, 1.3f, HEX(0xf8d848));
    } else if (id == "egg") { fellipse(8, 9, 3.8f, 4.8f, HEX(0xf4ecd8)); putpx(7, 6, HEX(0xffffff)); fellipse(9, 11, 2, 2.2f, HEX(0xe0d6c0)); finish(im);
    } else if (id == "berries") { for (int i = 0; i < 5; i++) { u32 h = hash2i(i, 3, 5); fcircle(4 + (h & 7), 6 + (h >> 4 & 5), 2.1f, HEX(0xc83a6a)); putpx(3 + (h & 7), 5 + (h >> 4 & 5), HEX(0xff8aa8)); } putpx(8, 3, HEX(0x4a8a3a));
    } else if (id == "apple" || id == "tomato") { u32 c = id == "apple" ? 0xd83a3a : 0xe8482a; blob(8, 9.5f, 5.2f, 4.8f, HEX(c), sd); putpx(8, 4, HEX(0x6a4a2a)); leafShape(9, 4, HEX(0x5aa040)); putpx(5, 7, HEX(0xffb8a8));
    } else if (id == "carrot") { for (int i = 0; i < 10; i++) { frect(7 - i / 5 + (i > 6 ? 1 : 0), 5 + i, 4 - i * 4 / 10, 1, ramp(HEX(0xf08a2a), i % 3 == 0 ? -0.8f : 0.3f)); } leafShape(5, 4, HEX(0x5aa040)); leafShape(8, 3, HEX(0x6ab04a)); leafShape(10, 4, HEX(0x5aa040));
    } else if (id == "pumpkin" || id == "pie") { if (id == "pie") { fellipse(8, 10, 6.5f, 3.5f, HEX(0xe0a860)); fellipse(8, 9, 5.5f, 2.6f, HEX(0xe88a2a)); line(4, 9, 12, 9, HEX(0xf8c880)); putpx(8, 8, HEX(0xfff0d0)); } else { blob(8, 9, 6, 5, HEX(0xe88a2a), sd); for (int i = -3; i <= 3; i += 3) vline(8 + i, 6, 7, ramp(HEX(0xe88a2a), -1.2f)); vline(8, 3, 3, HEX(0x4a8a30)); }
    } else if (id == "mushroom") { vline(7, 9, 4, HEX(0xefe4cc)); vline(8, 9, 4, HEX(0xcfc2a6)); fellipse(8, 8, 5.5f, 4, HEX(0xb8783a)); hline(3, 9, 10, HEX(0x8a5a2a)); putpx(6, 6, HEX(0xe8d8b8)); putpx(10, 7, HEX(0xe8d8b8));
    } else if (id == "milk") { frect(5, 5, 6, 9, HEX(0xf4f4f4)); hline(5, 5, 6, HEX(0xffffff)); frect(6, 2, 4, 3, HEX(0xc8e0f0)); frect(5, 9, 6, 3, HEX(0x7aa8d8)); vline(10, 6, 7, HEX(0xcfd4dc));
    } else if (id == "raw_meat" || id == "cooked_meat") { u32 c = id == "raw_meat" ? 0xd8607a : 0x9a5a34; blob(7, 9, 6, 4.5f, HEX(c), sd); capsule(11, 9, 14, 11, 1.2f, HEX(0xf0ead8)); fcircle(14.5f, 11.5f, 1.4f, HEX(0xf0ead8)); if (id == "cooked_meat") { line(4, 8, 9, 8, HEX(0x5a3220)); line(5, 11, 10, 11, HEX(0x5a3220)); } else putpx(5, 7, HEX(0xffa0b0));
    } else if (it.kind == K_FISH || id == "raw_fish" || id == "cooked_fish") { u32 c = id == "fish_golden" ? 0xf2c24a : id == "fish_salmon" ? 0xf08a7a : id == "fish_trout" ? 0x9ab8a0 : id == "fish_catfish" ? 0x7a7a8a : id == "fish_eel" ? 0x5a6a5a : id == "cooked_fish" ? 0xb8783a : id == "raw_fish" ? 0x8aa8c8 : 0xd8884a;
      fellipse(7.5f, 8.5f, 5.5f, 3.2f, HEX(c)); fellipse(7.5f, 9.5f, 4.5f, 1.8f, ramp(HEX(c), 1.2f)); line(13, 8, 15, 5, HEX(ramp(HEX(c), -0.6f))); line(13, 9, 15, 12, HEX(ramp(HEX(c), -0.6f))); putpx(14, 8, HEX(ramp(HEX(c), -0.6f))); putpx(4, 7, HEX(0x1a1a24)); line(6, 6, 9, 6, ramp(HEX(c), -1)); if (id == "cooked_fish") line(6, 9, 11, 9, HEX(0x5a3220));
    } else if (id == "bread") { fellipse(8, 9, 6.5f, 4, HEX(0xd8a050)); fellipse(8, 8, 5.5f, 3, HEX(0xe8b868)); for (int i = 0; i < 3; i++) line(5 + i * 3, 6, 6 + i * 3, 9, HEX(0xb87a34));
    } else if (id == "onigiri") { for (int y = 3; y < 13; y++) { int hw = 1 + (y - 3) * 5 / 9 + (y > 10 ? 0 : 0); frect(8 - hw, y, hw * 2 + 1, 1, HEX(y > 9 ? 0xe8e4d8 : 0xfbfaf4)); } frect(5, 9, 7, 5, HEX(0x1e2a2a)); hline(5, 9, 7, HEX(0x3a4a42)); putpx(7, 6, HEX(0xffffff));
    } else if (id == "stew") { fellipse(8, 10, 6.5f, 4, HEX(0x6a4a3a)); fellipse(8, 8, 5.8f, 2.6f, HEX(0xb8683a)); putpx(6, 7, HEX(0xf08a2a)); putpx(9, 8, HEX(0x5aa040)); putpx(10, 7, HEX(0xe8e0c0)); line(4, 3, 5, 5, withA(0xffffff, 150)); line(8, 2, 9, 5, withA(0xffffff, 150));
    } else if (id == "sushi") { fellipse(8, 10, 6, 3, HEX(0xf6f2e6)); fellipse(8, 8, 5.5f, 2.6f, HEX(0xf08a7a)); line(4, 8, 12, 7, HEX(0xffd0c8)); frect(7, 6, 2, 6, HEX(0x1e2a2a));
    } else if (id == "mochi") { blob(8, 9, 5.5f, 4, HEX(0xf8e4ee), sd); fcircle(8, 5.5f, 1.4f, HEX(0xf6a0b8)); putpx(7, 5, HEX(0xffd4e0)); putpx(9, 5, HEX(0xffd4e0));
    } else if (it.kind == K_SEED) { if (it.tree) { u32 c = it.tree == O_SAKURA ? 0xf2a8c0 : it.tree == O_PINE ? 0x8a5a34 : 0xb07e44; if (id == "acorn") { fellipse(8, 10, 3.5f, 3.6f, HEX(c)); frect(5, 5, 7, 3, HEX(0x7a5430)); putpx(8, 4, HEX(0x5a3a22)); putpx(7, 9, HEX(0xd8a868)); } else if (id == "pinecone") { fellipse(8, 9, 3.4f, 5, HEX(c)); for (int y = 5; y < 14; y += 2) hline(5, y, 6, HEX(0x5a3a22)); putpx(7, 6, HEX(0xb8844a)); } else { vline(8, 8, 6, HEX(0x6a4a2a)); blob(8, 6, 4, 3.4f, HEX(id == "sakura_sapling" ? 0xf2a8c0 : 0x62b04a), sd); } }
      else { frect(3, 3, 10, 11, HEX(0xe8dcc0)); hline(3, 3, 10, HEX(0xfff4d8)); hline(3, 13, 10, HEX(0xb8a888)); u32 pc = it.plant == O_WHEAT ? 0xe0b84a : it.plant == O_TOMATO ? 0xe03a3a : it.plant == O_PUMPKIN ? 0xe88a2a : 0x8fbf5a; fcircle(8, 8, 2.2f, HEX(pc)); vline(8, 5, 3, HEX(0x5aa040)); putpx(6, 5, HEX(0x5aa040)); putpx(10, 5, HEX(0x5aa040)); }
    } else if (id == "dog_treat") { capsule(4, 9, 12, 9, 2, HEX(0xc8884a)); fcircle(4, 7.5f, 1.8f, HEX(0xc8884a)); fcircle(4, 10.5f, 1.8f, HEX(0xc8884a)); fcircle(12, 7.5f, 1.8f, HEX(0xc8884a)); fcircle(12, 10.5f, 1.8f, HEX(0xc8884a)); hline(5, 8, 6, HEX(0xe8a860));
    } else { round_(0xb0a8b8); }
    if (!(it.kind == K_PLACE && (it.po || it.pb || it.pg >= 0)) || true) { if (!has("_ore") || true) {} }
    ENDPAINT
    bool noOutline = it.kind == K_PLACE; if (!noOutline) { outlineImg(im, HEX(0x1c1424)); } else outlineImg(im, HEX(0x1c1424));
    return im;
  }

  void init() {
    initItems(); for (int g = 0; g < G_COUNT; g++) for (int v = 0; v < 4; v++) genGround(g, v);
    for (int b = 1; b < B_COUNT; b++) for (int s = 0; s < 2; s++) for (int v = 0; v < 4; v++) genBlock(b, s, v);
    genTrees(); genPlants(); genPlaceables();
    icon.resize(ITEMS.size()); for (size_t i = 1; i < ITEMS.size(); i++) icon[i] = makeIcon(ITEMS[i]);
    coin = mk(10, 10); { PAINT(coin) fcircle(5, 5, 4, HEX(0xf2c24a)); fcircle(5, 5, 2.6f, HEX(0xf8e07a)); vline(5, 3, 4, HEX(0xc8962a)); putpx(3, 3, HEX(0xffffff)); outlineImg(coin, HEX(0x7a5a1a)); ENDPAINT }
    auto heart = [&](Img& im, u32 c, u32 hi, u32 dk) { im = mk(11, 10); PAINT(im) static const char* P[] = {".XX...XX...", "XXXX.XXXX..", "XXXXXXXXX..", "XXXXXXXXX..", ".XXXXXXX...", "..XXXXX....", "...XXX.....", "....X......"}; for (int y = 0; y < 8; y++) for (int x = 0; x < 11; x++) if (P[y][x] == 'X') putpx(x + 1, y + 1, y > 4 ? dk : c); putpx(2, 2, hi); putpx(3, 2, hi); putpx(2, 3, hi); outlineImg(im, HEX(0x2a1020)); ENDPAINT };
    heart(heartF, HEX(0xe8384a), HEX(0xffa0a8), HEX(0xb01c34)); heart(heartE, HEX(0x4a2a38), HEX(0x5a3a48), HEX(0x3a1e2c)); heart(heartH, HEX(0xe8384a), HEX(0xffa0a8), HEX(0xb01c34));
    for (int y = 0; y < heartH.h; y++) for (int x = 6; x < heartH.w; x++) { u32 e = heartE.get(x, y); if (ca(heartH.get(x, y))) heartH.set(x, y, e); }
    drumstick = mk(11, 10); { PAINT(drumstick) blob(6, 4.5f, 4, 3.6f, HEX(0xc8783a), 5); capsule(4, 8, 2, 9, 0.8f, HEX(0xf0ead8)); fcircle(1.5f, 9.2f, 1.1f, HEX(0xf0ead8)); outlineImg(drumstick, HEX(0x2a1020)); ENDPAINT }
    drumstickE = mk(11, 10); { PAINT(drumstickE) blob(6, 4.5f, 4, 3.6f, HEX(0x4a3a30), 5); capsule(4, 8, 2, 9, 0.8f, HEX(0x6a6258)); fcircle(1.5f, 9.2f, 1.1f, HEX(0x6a6258)); outlineImg(drumstickE, HEX(0x2a1020)); ENDPAINT }
  }
};
static Art ART;
