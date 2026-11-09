// Hanomi native - art/terrain.js ported 1:1: per-pixel chunk baker (ground + water layers), wall baker and animated water glints.
#pragma once
#include "world.h"
constexpr int TM = 20, TSZ = CPX + TM * 2, WH = 12;
inline u32 pk(int h) { return 0xFF000000u | (u32)h; }
inline int fdivi(int a, int b) { return (int)std::floor(a / (double)b); }
struct Ramp { u32 c[4]; };
static Ramp RAMP[24]; static bool RAMP_OK[24];
static float N128[128 * 128], JXf[64 * 64], JYf[64 * 64], FINEf[64 * 64], JX2f[64 * 64], JY2f[64 * 64]; static int8_t JXi[4096], JYi[4096]; static u8 TUFT[4096]; static int16_t VC[48 * 48]; static u8 VE[48 * 48];
static u8 GRASSY[32], WATERY[32], LOWT[32];
static u32 W1[7], ONS[4], BANKC[3], FOAMC, FOAM2C; static std::vector<Img> WATER_FX;
static void wrapNoise(float* out, int N, int period, int seed, int oct) {
  for (int i = 0; i < N * N; i++) out[i] = 0; double tot = 0, amp = 1; int per = period;
  for (int o = 0; o < oct; o++, amp *= 0.5, per *= 2) {
    double cell = (double)N / per;
    for (int y = 0; y < N; y++) for (int x = 0; x < N; x++) {
      double fx = x / cell, fy = y / cell; int ix = (int)std::floor(fx), iy = (int)std::floor(fy); double ux = fx - ix, uy = fy - iy, sx = ux * ux * (3 - 2 * ux), sy = uy * uy * (3 - 2 * uy);
      auto h = [&](int a, int b) { return hash2(((a % per) + per) % per, ((b % per) + per) % per, seed + o); };
      double v = h(ix, iy) + (h(ix + 1, iy) - h(ix, iy)) * sx + (h(ix, iy + 1) - h(ix, iy)) * sy + (h(ix, iy) - h(ix + 1, iy) - h(ix, iy + 1) + h(ix + 1, iy + 1)) * sx * sy;
      out[y * N + x] = (float)(out[y * N + x] + v * amp);
    }
    tot += amp; if (o == oct - 1) for (int i = 0; i < N * N; i++) out[i] = (float)(out[i] / tot);
  }
}
static void initTerrain() {
  static const int RS[][5] = {{G_GRASS, 0x3f7d3c, 0x4e9443, 0x5fa84b, 0x74bb57}, {G_FOREST, 0x2c5636, 0x34663c, 0x3e7543, 0x4a834b}, {G_SAKURA, 0x5a9a4c, 0x68a953, 0x79b75d, 0x8cc469}, {G_MARSH, 0x3b4d31, 0x465a37, 0x51673d, 0x5e7445},
    {G_SNOW, 0xbccbe0, 0xd0dceb, 0xe2eaf4, 0xf2f6fb}, {G_SAND, 0xd2b072, 0xdfc183, 0xe9cf95, 0xf2dcab}, {G_DIRT, 0x76503a, 0x855c40, 0x946849, 0xa27553}, {G_PATH, 0xa27c55, 0xb18a5f, 0xbf986b, 0xcca679},
    {G_ROCK, 0x6b6763, 0x7a7570, 0x88837d, 0x96918a}, {G_TILLED, 0x5a3b27, 0x6a472f, 0x7a5437, 0x88603f}, {G_WET, 0x3a2619, 0x45301f, 0x513925, 0x5c412b}, {G_WOOD, 0x7d5032, 0x8f5f3b, 0xa06d44, 0xb07c4f},
    {G_COBBLE, 0x6f7378, 0x7f8388, 0x8f9398, 0xa1a5a8}, {G_PLAZA, 0x8a8178, 0x9a9087, 0xa99f95, 0xb8aea3}, {G_TATAMI, 0x8e8c52, 0xa8a462, 0xbeb874, 0xd2cc8a}};
  for (auto& r : RS) { RAMP_OK[r[0]] = true; for (int i = 0; i < 4; i++) RAMP[r[0]].c[i] = pk(r[1 + i]); }
  for (int g : {G_GRASS, G_FOREST, G_SAKURA, G_MARSH, G_SNOW}) GRASSY[g] = 1; WATERY[G_WATER] = WATERY[G_DEEP] = WATERY[G_ONSEN] = 1; for (int g : {G_PATH, G_DIRT, G_SAND, G_PLAZA, G_COBBLE, G_TILLED, G_WET, G_ROCK, G_WOOD, G_TATAMI}) LOWT[g] = 1;
  wrapNoise(N128, 128, 4, 11, 4); wrapNoise(JXf, 64, 4, 21, 2); wrapNoise(JYf, 64, 4, 31, 2); wrapNoise(FINEf, 64, 16, 41, 2); wrapNoise(JX2f, 64, 16, 51, 1); wrapNoise(JY2f, 64, 16, 61, 1);
  for (int i = 0; i < 4096; i++) { JXi[i] = (int8_t)jround((JXf[i] - 0.5) * 13 + (JX2f[i] - 0.5) * 5); JYi[i] = (int8_t)jround((JYf[i] - 0.5) * 13 + (JY2f[i] - 0.5) * 5); }
  { RNG r(5); for (int k = 0; k < 150; k++) { int x = (int)(r.next() * 64), y = (int)(r.next() * 64); double kind = r.next(); auto put = [&](int dx, int dy, int v) { TUFT[(((y + dy) & 63) * 64) + ((x + dx) & 63)] = v; };
      if (kind < 0.55) { put(0, 0, 1); put(2, 0, 1); put(1, 1, 1); put(1, 0, 2); } else if (kind < 0.85) { put(0, 0, 1); put(0, 1, 1); put(1, -1, 2); } else { put(0, 0, 2); put(1, 1, 1); } } }
  { RNG r(9); std::vector<std::array<double, 2>> pts; for (int gy = 0; gy < 6; gy++) for (int gx = 0; gx < 6; gx++) { double a = (gx + 0.2 + r.next() * 0.6) * 8; double b = (gy + 0.2 + r.next() * 0.6) * 8; pts.push_back({a, b}); }
    for (int y = 0; y < 48; y++) for (int x = 0; x < 48; x++) { double b1 = 1e9, b2 = 1e9; int id = 0;
      for (size_t k = 0; k < pts.size(); k++) for (int oy = -48; oy <= 48; oy += 48) for (int ox = -48; ox <= 48; ox += 48) { double d = std::hypot(x - pts[k][0] - ox, (y - pts[k][1] - oy) * 1.15); if (d < b1) { b2 = b1; b1 = d; id = (int)k; } else if (d < b2) b2 = d; }
      VC[y * 48 + x] = id; VE[y * 48 + x] = b2 - b1 < 1.3 ? 1 : 0; } }
  const int w1[7] = {0x7fd3cf, 0x64c1c6, 0x4caabb, 0x3b92ae, 0x2f7aa0, 0x276592, 0x215582}, on[4] = {0xa8f0e0, 0x7ad8cc, 0x5ac0bc, 0x48a8b0}, bk[3] = {0x5e4a2e, 0x4c3b25, 0x3a2e1f};
  for (int i = 0; i < 7; i++) W1[i] = pk(w1[i]); for (int i = 0; i < 4; i++) ONS[i] = pk(on[i]); for (int i = 0; i < 3; i++) BANKC[i] = pk(bk[i]); FOAMC = pk(0xeaf7f2); FOAM2C = pk(0xbfe7e4);
  // animated water glints (16 tileable 64x64 frames)
  RNG r(3); struct St { double x, y, l, ph, sp; }; std::vector<St> st; for (int k = 0; k < 22; k++) { St s; s.x = r.next() * 64; s.y = r.next() * 64; s.l = 2 + r.next() * 5; s.ph = r.next() * PI * 2; s.sp = 0.6 + r.next() * 0.8; st.push_back(s); }
  for (int f = 0; f < 16; f++) { Img im(64, 64); for (auto& s : st) { double a = std::sin(f / 16.0 * PI * 2 * s.sp + s.ph); if (a < 0.1) continue; int len = jround(s.l * a), sx = jround(s.x + f * 0.5) & 63, sy = jround(s.y) & 63; u32 col = a > 0.7 ? RGB(225, 250, 250, 140) : RGB(190, 235, 240, 89);
      for (int i = 0; i < len; i++) { u32& d = im.p[sy * 64 + ((sx + i) & 63)]; d = col; } } WATER_FX.push_back(im); }
}
static inline u32 mulC(u32 c, double f) { return 0xFF000000u | ((u32)((cr(c)) * f) << 16) | ((u32)((cg(c)) * f) << 8) | (u32)((cb(c)) * f); }
static u8 matA[TSZ * TSZ]; static float distA[TSZ * TSZ], LG[33 * 33]; static u8 tg[(CS + 4) * (CS + 4)];
static void bakeChunk(World& world, Chunk& c) {
  int x0 = c.cx * CPX, y0 = c.cy * CPX, TG = CS + 4; bool anyWater = false;
  for (int j = -2; j < CS + 2; j++) for (int i = -2; i < CS + 2; i++) { int g; if (i >= 0 && j >= 0 && i < CS && j < CS) g = c.g[j * CS + i]; else g = world.ground(c.cx * CS + i, c.cy * CS + j); tg[(j + 2) * TG + i + 2] = g; if (WATERY[g]) anyWater = true; }
  auto tileAt = [&](int px, int py) { int tx = clampi(fdivi(px, TS), -2, CS + 1), ty = clampi(fdivi(py, TS), -2, CS + 1); return (int)tg[(ty + 2) * TG + tx + 2]; };
  for (int py = -TM; py < CPX + TM; py++) for (int px = -TM; px < CPX + TM; px++) { int wx = x0 + px, wy = y0 + py, ji = ((wy & 63) << 6) | (wx & 63); int A = tileAt(px, py), m = A;
    if (!isHard(A)) { int Jt = tileAt(px + JXi[ji], py + JYi[ji]); if (!isHard(Jt)) m = Jt; } matA[(py + TM) * TSZ + px + TM] = m; }
  if (anyWater) {
    for (int i = 0; i < TSZ * TSZ; i++) distA[i] = WATERY[matA[i]] ? 1e4f : 0;
    for (int y = 1; y < TSZ; y++) for (int x = 1; x < TSZ - 1; x++) { int i = y * TSZ + x; if (distA[i] == 0) continue; distA[i] = (float)std::min({(double)distA[i], distA[i - 1] + 1.0, distA[i - TSZ] + 1.0, distA[i - TSZ - 1] + 1.41, distA[i - TSZ + 1] + 1.41}); }
    for (int y = TSZ - 2; y >= 0; y--) for (int x = TSZ - 2; x > 0; x--) { int i = y * TSZ + x; if (distA[i] == 0) continue; distA[i] = (float)std::min({(double)distA[i], distA[i + 1] + 1.0, distA[i + TSZ] + 1.0, distA[i + TSZ + 1] + 1.41, distA[i + TSZ - 1] + 1.41}); }
  }
  if (c.cv.w != CPX) c.cv.alloc(CPX, CPX); else std::fill(c.cv.p.begin(), c.cv.p.end(), 0);
  u32* go = c.cv.p.data(); u32* wo = nullptr;
  if (anyWater) { if (c.wcv.w != CPX) c.wcv.alloc(CPX, CPX); else std::fill(c.wcv.p.begin(), c.wcv.p.end(), 0); wo = c.wcv.p.data(); c.haveWcv = true; } else c.haveWcv = false;
  c.haveCv = true; c.hasWater = anyWater;
  auto MA = [&](int px, int py) { return (int)matA[(py + TM) * TSZ + px + TM]; };
  static u8 wallAbove[(CS + 2) * (CS + 2)]; memset(wallAbove, 0, sizeof wallAbove);
  for (int j = 0; j < CS; j++) for (int i = 0; i < CS; i++) { int b = j > 0 ? c.b[(j - 1) * CS + i] : world.block(c.cx * CS + i, c.cy * CS - 1); wallAbove[(j + 1) * (CS + 2) + i + 1] = (b && b != 8) ? 1 : 0; }
  for (int j = 0; j < 33; j++) for (int i = 0; i < 33; i++) LG[j * 33 + i] = (float)fbm((x0 + i * 8) / 70.0, (y0 + j * 8) / 70.0, 555, 3);
  auto low = [&](int px, int py) { double fx = px / 8.0, fy = py / 8.0; int ix = (int)fx, iy = (int)fy; double ux = fx - ix, uy = fy - iy, a = LG[iy * 33 + ix], b = LG[iy * 33 + ix + 1], c2 = LG[iy * 33 + ix + 33], d = LG[iy * 33 + ix + 34]; return a + (b - a) * ux + (c2 - a) * uy + (a - b - c2 + d) * ux * uy; };
  static const int FLOWER_COLS[6] = {0xffffff, 0xf7d84a, 0xf28fb0, 0x9cc8f4, 0xe8615a, 0xc89cf0};
  for (int py = 0; py < CPX; py++) for (int px = 0; px < CPX; px++) {
    int wx = x0 + px, wy = y0 + py, o = py * CPX + px, mi = (py + TM) * TSZ + px + TM, m = matA[mi]; double b = bayer(wx, wy);
    if (WATERY[m]) {
      double d = distA[mi]; int deep = m == G_DEEP; double v = clampf((float)(d / 34), 0, 1) * 0.75 + deep * 0.25 + (N128[((wy & 127) << 7) | (wx & 127)] - 0.5) * 0.18; int k = (int)std::floor(v * 6 + b * 0.9); k = clampi(k, 0, 6);
      wo[o] = m == G_ONSEN ? ONS[std::min(3, (int)std::floor(clampf((float)(d / 10), 0, 1) * 3 + b * 0.8))] : W1[k];
      int bank = -1; for (int k2 = 1; k2 <= 3; k2++) if (!WATERY[matA[mi - TSZ * k2]]) { bank = k2 - 1; break; }
      if (bank >= 0) { go[o] = BANKC[bank]; continue; }
      if (d < 1.5) { go[o] = (b > 0.35) ? FOAMC : FOAM2C; continue; }
      if (d < 2.5 && b > 0.6) { go[o] = FOAM2C; continue; }
      if (bank < 0 && WATERY[matA[mi - TSZ * 4]] == 0 && b > 0.5) wo[o] = W1[std::max(0, k - 1)];
      go[o] = 0; continue;
    }
    const Ramp& rp = RAMP_OK[m] ? RAMP[m] : RAMP[G_GRASS]; u32 col;
    if (m == G_TILLED || m == G_WET) {
      int ly = wy & 15, lx = wx & 15; double n = FINEf[((wy & 63) << 6) | (wx & 63)]; int v = n > 0.58 ? 2 : 1; int cx3 = fdivi(wx, 3), cy3 = fdivi(wy, 3); double hh = hash2(cx3, cy3, 33);
      if (hh < 0.3) { int ox = wx - cx3 * 3, oy = wy - cy3 * 3; v = (ox + oy <= 1) ? 3 : (ox + oy >= 3) ? 0 : 2; }
      int up = tileAt(px, py - TS), dn = tileAt(px, py + TS), lf = tileAt(px - TS, py), rt = tileAt(px + TS, py); auto soil = [](int g) { return g == G_TILLED || g == G_WET; };
      if ((lx == 0 && !soil(lf)) || (lx == 15 && !soil(rt)) || (ly == 15 && !soil(dn))) v = 0; else if (ly == 0 && !soil(up)) v = 0; else if (ly == 1 && !soil(up)) v = 3; else if (lx == 0 || ly == 0) v = std::max(0, v - 1);
      col = rp.c[v];
    } else if (m == G_TATAMI) {
      int tcol = fdivi(wx, 16), mx = wx & 15, my = (wy + (tcol & 1) * 16) & 31;
      if (mx == 0 || mx == 15) col = pk(0x3e4a2c); else if (my == 0 || my == 31) col = pk(0x4a3a24);
      else { int st = (wy & 1) ? 1 : 2; col = rp.c[hash2(wx >> 2, wy, 41) < 0.08 ? 3 : st]; if (mx == 1) col = rp.c[3]; if (mx == 14) col = rp.c[0]; }
    } else if (m == G_WOOD) {
      int row = wy >> 2, seamX = (hash2i(row, 3, 7) & 15); int v = 2 + (FINEf[((wy & 63) << 6) | ((wx * 3) & 63)] > 0.6 ? 1 : 0) - (FINEf[((row & 63) << 6) | 5] > 0.6 ? 1 : 0);
      if ((wy & 3) == 3) v = 0; else if ((wy & 3) == 0) v = std::min(3, v + 1); if (((wx + seamX * 5) & 15) == 0) v = 0; if (((wx + seamX * 5) & 15) == 2 && (wy & 3) == 1) v = 0; col = rp.c[clampi(v, 0, 3)];
    } else if (m == G_PLAZA || m == G_COBBLE) {
      int qx = ((wx % 48) + 48) % 48, qy = ((wy % 48) + 48) % 48, qi = qy * 48 + qx;
      if (VE[qi]) col = rp.c[0]; else { int cid = VC[qi]; double h = hash2(cid, fdivi(wx, 48) * 7 + fdivi(wy, 48), 3); int v = 1 + (h > 0.66 ? 1 : 0) + (h < 0.2 ? -1 : 0);
        int qu = (((wy - 1) % 48 + 48) % 48) * 48 + qx; if (VE[qu]) v++; int qd = (((wy + 1) % 48 + 48) % 48) * 48 + qx; if (VE[qd]) v--; col = rp.c[clampi(v, 0, 3)]; }
      if (VE[qi]) col = pk(m == G_PLAZA ? 0x6a625a : 0x55595e);
    } else {
      double v = 0.5 + (low(px, py) - 0.5) * 1.9 + (N128[((wy & 127) << 7) | (wx & 127)] - 0.5) * 0.45 + (FINEf[((wy & 63) << 6) | (wx & 63)] - 0.5) * 0.22; int k = (int)std::floor(v * 4 + (b - 0.5) * 0.9); k = clampi(k, 0, 3); col = rp.c[k];
      if (GRASSY[m]) { int t = TUFT[((wy & 63) << 6) | (wx & 63)]; if (t == 1) col = rp.c[std::max(0, k - 1)]; else if (t == 2) col = rp.c[std::min(3, k + 1)];
        if (m == G_SAKURA && hash2(wx, wy, 9) < 0.012) col = pk(hash2(wx, wy, 10) < 0.5 ? 0xf4b2c8 : 0xffd9e6); if (m == G_FOREST && hash2(wx, wy, 11) < 0.006) col = pk(0x8a6a2c); if (m == G_SNOW && hash2(wx, wy, 12) < 0.004) col = pk(0xffffff);
      } else if (m == G_PATH || m == G_DIRT || m == G_SAND) { double h = hash2(wx >> 1, wy >> 1, 13); if (h < 0.018) col = pk(m == G_SAND ? 0xc49e64 : 0x7d6a58); else if (h < 0.026) col = pk(m == G_SAND ? 0xfff0cf : 0xd8c8b0);
      } else if (m == G_ROCK) { double n = FINEf[((wy & 63) << 6) | (wx & 63)]; if (std::fabs(n - 0.5) < 0.018) col = rp.c[0]; else if (hash2(wx, wy, 14) < 0.01) col = rp.c[3]; }
    }
    if (m == G_GRASS || m == G_SAKURA) { int tx = wx >> 4, ty = wy >> 4; double h = hash2(tx, ty, 21);
      if (h < 0.07) { int fx = (hash2i(tx, ty, 22) & 11) + 2, fy = (hash2i(tx, ty, 23) & 11) + 2, lx = wx & 15, ly = wy & 15, fc = FLOWER_COLS[hash2i(tx, ty, 24) % 6]; int dx = lx - fx, dy = ly - fy;
        if (dx == 0 && dy == 0) col = pk(0xf2c24a); else if (std::abs(dx) + std::abs(dy) == 1) col = pk(dy == 1 ? (fc == 0xffffff ? 0xd8d8e8 : fc) : fc); else if (dx == 0 && dy == 2) col = pk(0x2f6a32); } }
    int up = MA(px, py - 1), dn = MA(px, py + 1), lf = MA(px - 1, py), rt = MA(px + 1, py);
    if (GRASSY[m]) { if (LOWT[dn] || WATERY[dn]) col = pk(m == G_SNOW ? 0x9aaac4 : 0x2c5a2e); else if (LOWT[lf] || LOWT[rt] || LOWT[up]) col = rp.c[0]; else if (LOWT[MA(px, py + 2)]) col = rp.c[3]; }
    else if (LOWT[m]) { if (GRASSY[up]) col = mulC(col, 0.78); else if (GRASSY[MA(px, py - 2)]) col = mulC(col, 0.9);
      if (m == G_SAND && (WATERY[dn] || WATERY[up] || WATERY[lf] || WATERY[rt] || WATERY[MA(px, py + 2)] || WATERY[MA(px, py + 3)])) col = mulC(col, 0.86); }
    { int ty2 = py / TS, ly2 = py - ty2 * TS; if (ly2 >= 12 && wallAbove[(ty2 + 1) * (CS + 2) + px / TS + 1]) col = mulC(col, ly2 < 14 ? 0.62 : 0.8); }
    go[o] = col;
  }
  c.dirty = false;
}
/* ---------------- walls ---------------- */
struct WMat { int top[5], face[4], out; bool wood, inner, brick; };
static WMat WMt(int id) {
  switch (id) {
    case 1: return {{0x625e5c, 0x726e6a, 0x807b76, 0x8e8983, 0xa49e96}, {0x3e3a38, 0x4c4744, 0x5a5552, 0x6a6460}, 0x26221f, 0, 0, 0};
    case 9: return {{0x4a4852, 0x585662, 0x666472, 0x747282, 0x86849a}, {0x24222a, 0x2e2c34, 0x3a3842, 0x46444e}, 0x141218, 0, 0, 0};
    case 6: return {{0x6a4228, 0x7a5032, 0x8c5e3a, 0x9e6c44, 0xb07c50}, {0x3e2614, 0x4a2e1a, 0x5a3820, 0x6b4428}, 0x22140a, 1, 0, 0};
    case 10: return {{0x3a2416, 0x4e3220, 0x64422a, 0x7a5434, 0x8e6640}, {0x5a3a22, 0x6e4a2c, 0xe6dcc6, 0xf4ecda}, 0x1e120a, 0, 1, 0};
    default: return {{0x7a7a80, 0x8a8a90, 0x9a9aa0, 0xaaaab0, 0xbcbcc2}, {0x46464e, 0x54545c, 0x62626a, 0x72727a}, 0x1e1e24, 0, 0, 1};
  }
}
static bool ISWALL(int b) { return b == 1 || b == 2 || b == 3 || b == 4 || b == 5 || b == 6 || b == 7 || b == 9 || b == 10; }
static bool NATB(int b) { return b == 1 || b == 2 || b == 3 || b == 4 || b == 5 || b == 9; }
static void bakeWalls(World& world, Chunk& c) {
  int x0 = c.cx * CS, y0 = c.cy * CS, TG = CS + 2; std::vector<u8> bg(TG * TG); bool any = false;
  for (int j = -1; j <= CS; j++) for (int i = -1; i <= CS; i++) { int b = (i >= 0 && j >= 0 && i < CS && j < CS) ? c.b[j * CS + i] : world.block(x0 + i, y0 + j); bg[(j + 1) * TG + i + 1] = ISWALL(b) ? b : 0; if (ISWALL(b) && i >= 0 && j >= 0 && i < CS && j < CS) any = true; }
  memset(c.wrows, 0, sizeof c.wrows); c.wrv = c.rv; c.wallsBaked = true; if (!any) { c.haveWall = false; return; }
  int H = CPX + WH; if (c.wallcv.w != CPX || c.wallcv.h != H) c.wallcv.alloc(CPX, H); else std::fill(c.wallcv.p.begin(), c.wallcv.p.end(), 0); c.haveWall = true; u32* o = c.wallcv.p.data();
  auto B_ = [&](int i, int j) { return (int)bg[(j + 1) * TG + i + 1]; }; auto con = [&](int b, int n) { return n && (NATB(b) ? NATB(n) : n == b); };
  static const int ORE[6][3] = {{0, 0, 0}, {0, 0, 0}, {0x1a1818, 0x2e2a2a, 0x4a4644}, {0x8a5236, 0xc8845a, 0xf0b88a}, {0xa8741a, 0xf2c23a, 0xfff08a}, {0x1a7a5a, 0x3ad8a0, 0xc0ffe8}};
  static const u32 MOSS[3] = {pk(0x4a6a32), pk(0x5a7e3a), pk(0x6e9446)};
  for (int j = 0; j < CS; j++) for (int i = 0; i < CS; i++) {
    int b = B_(i, j); if (!b) continue; c.wrows[j] = 1; WMat mat = WMt(NATB(b) ? (b == 9 || b == 5 ? 9 : 1) : b);
    bool N = con(b, B_(i, j - 1)), S = con(b, B_(i, j + 1)), E = con(b, B_(i + 1, j)), W = con(b, B_(i - 1, j)); int wx0 = (x0 + i) * TS, wy0 = (y0 + j) * TS; bool ore = b >= 2 && b <= 5;
    for (int ly = 0; ly < 16; ly++) for (int lx = 0; lx < 16; lx++) {
      int wx = wx0 + lx, wy = wy0 + ly, cyy = j * 16 + ly; size_t idx = (size_t)cyy * CPX + i * 16 + lx; int q;
      if (mat.inner) { q = (N && E && W && !S) ? -9 : ((ly & 3) == 3 ? 1 : (lx & 7) == 0 ? 2 : 3); }
      else if (mat.wood) { q = ((wy + 1) % 5 == 0) ? 0 : 2 + ((FINEf[((wy & 63) << 6) | ((wx * 2) & 63)] > 0.55) ? 1 : 0); if (((wx + ((wy / 5)) * 7) & 15) == 0) q = 1; }
      else if (mat.brick) { int row = fdivi(wy, 4), off = (row & 1) * 4; q = ((wy & 3) == 3 || ((wx + off) & 7) == 7) ? 0 : ((wy & 3) == 0 ? 4 : 2 + (hash2(fdivi(wx + off, 8), row, 5) > 0.6 ? 1 : 0)); }
      else { int qx = ((wx % 48) + 48) % 48, qy = ((wy % 48) + 48) % 48, qi = qy * 48 + qx; int cell = VC[qi]; double hh = hash2(cell, fdivi(wx, 48) * 31 + fdivi(wy, 48), 7); q = 2 + (hh > 0.72 ? 1 : 0) - (hh < 0.2 ? 1 : 0);
        if (VE[qi]) q = (hash2(wx >> 2, wy >> 2, 4) < 0.5 ? 0 : 1); else { int up = ((((wy - 1) % 48) + 48) % 48) * 48 + qx, lf = qy * 48 + (((wx - 1) % 48 + 48) % 48); if (VE[up] || VE[lf]) q = std::min(4, q + 1); }
        if (FINEf[((wy & 63) << 6) | (wx & 63)] > 0.7 && !VE[qi]) q = std::max(0, q - 1); }
      int col = q == -9 ? (ly < 2 ? 0xd8ccb4 : ly > 13 ? 0x6e4a2c : (hash2(wx, wy, 8) < 0.05 ? 0xe6dcc6 : 0xf2eada)) : mat.top[clampi(q, 0, 4)]; if (q == -9) q = 2;
      if (!N && ly == 0) col = mat.out; else if (!N && ly == 1) col = mat.top[4];
      if (!W && lx == 0) col = mat.out; else if (!W && lx == 1 && ly > 0) col = mat.top[std::min(4, q + 1)];
      if (!E && lx == 15) col = mat.out; else if (!E && lx == 14 && ly > 0) col = mat.top[std::max(0, q - 1)];
      if (!S && ly == 15) col = mat.top[4];
      bool moss = false; if (NATB(b) && !mat.wood && N && W && E && fbm(wx / 22.0, wy / 22.0, 91, 2) > 0.62 && hash2(wx, wy, 3) < 0.85 && ly > 1) { o[idx] = MOSS[q > 2 ? 2 : q > 1 ? 1 : 0]; moss = true; }
      if (!moss) o[idx] = pk(col);
    }
    if (!S) for (int ly = 16; ly < 28; ly++) for (int lx = 0; lx < 16; lx++) {
      int wx = wx0 + lx, wy = wy0 + ly, fy = ly - 16; size_t idx = (size_t)(j * 16 + ly) * CPX + i * 16 + lx; int q;
      if (mat.inner) q = fy < 2 ? 1 : fy < 7 ? 3 : (wx & 3) == 0 ? 0 : 1;
      else if (mat.wood) q = (wx & 3) == 0 ? 0 : (wx & 3) == 1 ? 3 : 2;
      else if (mat.brick) { int off = ((fy >> 2) & 1) * 4; q = ((fy & 3) == 3 || ((wx + off) & 7) == 7) ? 0 : (fy & 3) == 0 ? 3 : 2; }
      else { q = fy < 1 ? 3 : 2 - (fy > 8 ? 1 : 0); double n = FINEf[((wy & 63) << 6) | ((wx * 2) & 63)]; if (n > 0.64) q--; if (((wx + (hash2i(wx >> 3, 1, 9) & 3)) % 7) == 0 && fy > 1) q = 0; if (fy == 4 && hash2(wx >> 2, wy, 2) < 0.5) q = std::max(0, q - 1); }
      int col = mat.face[clampi(q, 0, 3)]; if (fy == 11) col = mat.out; if ((!W && lx == 0) || (!E && lx == 15)) col = mat.out; o[idx] = pk(col);
    }
    if (ore) { int n = 2 + (hash2i(x0 + i, y0 + j, 11) & 1) + (b == 5 ? 1 : 0);
      for (int k = 0; k < n; k++) { int lx = 2 + (hash2i(x0 + i, y0 + j, 20 + k) % 12), ly = 2 + (hash2i(x0 + i, y0 + j, 40 + k) % (S ? 12 : 22)); const int* oc = ORE[b];
        auto put = [&](int dx, int dy, int cc) { int yy = j * 16 + ly + dy, xx = i * 16 + lx + dx; if (xx >= i * 16 + 1 && xx < i * 16 + 15 && yy >= j * 16 + 1 && yy < j * 16 + (S ? 16 : 27)) o[(size_t)yy * CPX + xx] = pk(cc); };
        if (b == 5) { put(0, -2, oc[2]); put(0, -1, oc[1]); put(0, 0, oc[1]); put(1, 0, oc[0]); put(-1, 1, oc[1]); put(0, 1, oc[0]); put(1, 1, oc[0]); }
        else { put(0, 0, oc[1]); put(1, 0, oc[0]); put(0, 1, oc[0]); put(1, 1, oc[0]); put(-1, 0, oc[2]); put(0, -1, oc[2]); } } }
  }
}
