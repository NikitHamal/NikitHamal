// Hanomi native - art/chars.js ported 1:1 (24x32 chibi characters: layered body parts, sel-outlined, hue-shifted ramps).
#pragma once
#include "spr.h"
constexpr int FW = 24, FH = 32, CFX = 12, CFY = 30;
static const int SKINS[5] = {0xf8d8bc, 0xecbf98, 0xd09a70, 0xa06c48, 0x744c34};
static const int HAIRS[9] = {0x2c2430, 0x4e3224, 0x7c4a2a, 0xc8883a, 0xecd496, 0xb8402a, 0x9898a6, 0x3a4a86, 0xe08aac};
static const int SHIRTS[9] = {0x3a6fc8, 0xc8423a, 0x2f9a6a, 0xd8a23a, 0x7a46b8, 0xe8e0d0, 0x4a4a5a, 0xd86a8a, 0x4a9aaa};
enum HairStyle { HS_SHORT, HS_LONG, HS_BUN, HS_PONY, HS_SPIKY, HS_BALD };
enum Hat { HAT_NONE, HAT_KASA, HAT_HELM, HAT_HOOD, HAT_CROWN, HAT_BAND, HAT_EBOSHI };
struct Look { u32 seed = 1; int skin = 0, hair = 0, hairStyle = HS_SHORT, shirt = 0, pants = 0, shoes = 0, sash = 0, armor = -1, hat = HAT_NONE, hatColor = 0xd8b850, crest = -1, eyes = -1; bool beard = false, lash = false, zombie = false;
  std::string key() const { char b[200]; snprintf(b, 200, "%u,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d%d%d", seed, skin, hair, hairStyle, shirt, pants, shoes, sash, armor, hat, hatColor, crest, eyes, beard, lash, zombie); return b; } };
struct CharFrames { Img f[4][3][4]; double hx[4][3][4], hy[4][3][4]; };
struct CF { double bob = 0, la = 0, lb = 0, sa = 0, sb = 0, stride = 0; bool blink = false; };
static const int OUTC = 0x2a1a22;
struct R4 { int c[4]; R4() {} R4(int c0) { c[0] = mixh(mulh(c0, 0.52), 0x2a1640, 0.25); c[1] = mixh(mulh(c0, 0.76), 0x3a2050, 0.12); c[2] = c0; c[3] = mixh(c0, 0xfff2d0, 0.32); } int operator[](int i) const { return c[i]; } };
static inline int sgn(double v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
struct CharOut { Spr s; double hx = 0, hy = 0; };
static CharOut drawChar(const Look& L, int dir, const CF& f) {
  Spr s(FW, FH); const bool Z = L.zombie; R4 Sk;
  if (Z) Sk = R4(L.skin); else { Sk.c[0] = mixh(mulh(L.skin, 0.62), 0x8a2a3a, 0.2); Sk.c[1] = mixh(mulh(L.skin, 0.86), 0xd05a5a, 0.12); Sk.c[2] = L.skin; Sk.c[3] = mixh(L.skin, 0xfff8ee, 0.4); }
  R4 Hr(L.hair), Sh(L.shirt), Pn(L.pants), Sb(L.shoes), Ss(L.sash); bool hasAr = L.armor >= 0; R4 Ar; if (hasAr) Ar = R4(L.armor);
  double bob = f.bob; int hy = (int)(11 + bob + (Z ? 1 : 0)), hx = 12; int skinOut = mulh(L.skin, 0.45), hairOut = mixh(mulh(L.hair, 0.4), OUTC, 0.5); int legTop = (int)(24 + bob);
  auto stamp = [&](Spr& l, int outline) { l.outline(outline); s.draw(l, 0, 0); };
  auto leg = [&](int x, int lift, int dx, bool far) { Spr l(FW, FH); int bot = 29 - lift; int P[3] = {far ? Pn[0] : Pn[1], far ? Pn[1] : Pn[2], far ? Pn[1] : Pn[3]};
    for (int y = legTop; y <= bot; y++) for (int i = 0; i < 3; i++) l.set(x + i + (y > bot - 2 ? dx : 0), y, i == 0 ? P[2] : i == 2 ? P[0] : P[1]);
    int sx = x + dx; for (int i = 0; i < (dir == 1 ? 4 : 3); i++) l.set(sx + i, bot + 1, i == 0 ? Sb[3] : Sb[2]); if (dir != 2) l.set(sx + 1, bot, mixh(Sb[3], 0xffffff, 0.3)); stamp(l, mulh(L.pants, 0.4)); };
  if (dir == 1) { double st = f.stride; leg((int)(10 - st), std::max(0.0, -st) > 1 ? 1 : 0, 0, true); leg((int)(11 + st), std::max(0.0, st) > 1 ? 1 : 0, 0, false); } else { leg(8, (int)f.la, 0, false); leg(13, (int)f.lb, 0, false); }
  const R4& sleeve = hasAr ? Ar : Sh;
  auto armSide = [&](int x, int y, double swing, bool far) { Spr l(FW, FH); int C[4] = {far ? sleeve[0] : sleeve[0], far ? sleeve[1] : sleeve[1], far ? sleeve[1] : sleeve[2], far ? sleeve[2] : sleeve[3]};
    if (Z) { for (int i = 0; i < 6; i++) for (int j = 0; j < 3; j++) l.set(x + i, y + j, j == 0 ? C[3] : C[2]); l.rect(x + 6, y, 2, 3, Sk[far ? 1 : 2]); stamp(l, mulh(L.shirt, 0.4)); return; }
    int ax = (int)(x + swing); for (int j = 0; j < 5; j++) for (int i = 0; i < 3; i++) l.set(ax + (j > 2 ? sgn(swing) : 0) + i, y + j, i == 0 ? C[3] : i == 2 ? C[1] : C[2]);
    l.rect(ax + sgn(swing) + (swing > 0 ? 1 : 0), y + 5, 2, 2, far ? Sk[1] : Sk[2]); stamp(l, mulh(L.shirt, 0.4)); };
  if (dir == 1) armSide(9, (int)(18 + bob), -f.sa, true);
  { Spr l(FW, FH); int y0 = (int)(17 + bob), x0 = dir == 1 ? 9 : 7, w = dir == 1 ? 7 : 10;
    for (int y = y0; y < y0 + 8; y++) { int flare = y > y0 + 5 ? 1 : 0; for (int x = x0 - flare; x < x0 + w + flare; x++) { double u = (x - x0 + 0.5) / w; int c = u < 0.22 ? Sh[3] : u > 0.8 ? Sh[1] : Sh[2]; if (y == y0) c = Sh[3];
        if (hasAr && y < y0 + 5) c = u < 0.3 ? Ar[3] : u > 0.75 ? Ar[1] : Ar[2]; l.set(x, y, c); } }
    if (dir == 0 && !hasAr) { int cx = x0 + 5; l.set(cx - 1, y0, 0xf6efe2); l.set(cx, y0, 0xf6efe2); l.set(cx - 1, y0 + 1, 0xe2d8c8); l.set(cx + 1, y0 + 1, Sh[1]); l.set(cx - 2, y0, Sh[3]); l.set(cx + 1, y0, Sh[1]); l.set(cx, y0 + 1, Sh[1]); l.set(cx, y0 + 2, Sh[1]); }
    if (dir == 1 && !hasAr) { l.set(x0 + 5, y0, 0xf6efe2); l.set(x0 + 4, y0 + 1, Sh[0]); l.set(x0 + 5, y0 + 2, Sh[0]); }
    for (int x = x0 - 1; x <= x0 + w; x++) { l.set(x, y0 + 5, Ss[3]); l.set(x, y0 + 6, Ss[1]); }
    if (dir == 2) { l.rect(x0 + 3, y0 + 4, 4, 4, Ss[2]); l.set(x0 + 4, y0 + 5, Ss[3]); } if (dir == 1) { l.set(x0 - 1, y0 + 5, Ss[2]); l.set(x0 - 2, y0 + 6, Ss[1]); }
    if (hasAr) { for (int x = x0; x < x0 + w; x += 2) l.set(x, y0 + 4, Ar[0]); l.set(x0 + 4, y0 + 2, L.crest >= 0 ? L.crest : Ar[3]); }
    if (Z) for (int k = 0; k < 5; k++) { int x = x0 + (int)(hash2(k, L.seed, 1) * w), y = y0 + 1 + (int)(hash2(k, L.seed, 2) * 5); l.set(x, y, Sk[1]); l.set(x + 1, y, Sk[0]); }
    stamp(l, mulh(L.shirt, 0.38)); }
  double handx = 0, handy = 0;
  if (dir == 1) { armSide(11, (int)(18 + bob), f.sa, false); double sw = f.sa; handx = 11 + sw + 1.5 + sgn(sw); handy = 24 + bob; }
  if (dir != 1) {
    auto arm = [&](int x, double sw, bool right) { Spr l(FW, FH); const R4& C = sleeve; int y0 = (int)(18 + bob);
      if (Z && dir == 0) { l.rect(x, y0 + 1, 3, 3, C[2]); l.rect(x, y0 + 4, 3, 2, Sk[2]); l.set(x + 1, y0 + 4, Sk[3]); stamp(l, mulh(L.shirt, 0.38)); return; }
      int isw = (int)sw; for (int j = 0; j < 5; j++) for (int i = 0; i < 3; i++) l.set(x + i, y0 + j + isw, (right ? i == 2 : i == 0) ? C[1] : j == 0 ? C[3] : C[2]);
      l.rect(x, y0 + 5 + isw, 3, 2, Sk[2]); l.set(x + (right ? 0 : 2), y0 + 6 + isw, Sk[1]); if (dir == 0) l.set(x + 1, y0 + 5 + isw, Sk[3]); stamp(l, mulh(L.shirt, 0.38)); };
    arm(4, f.sa, false); arm(17, f.sb, true); handx = dir == 0 ? 5.5 : 18.5; handy = 23.5 + bob + (dir == 0 ? f.sa : f.sb);
  }
  { Spr l(FW, FH); l.ellf(hx, hy, dir == 1 ? 6.6 : 7.1, 6.3, [&](double u, double v, int, int) { double k = 0.55 - u * 0.28 - v * 0.38; return Sk[k > 0.78 ? 3 : k > 0.18 ? 2 : 1]; });
    if (dir == 1) { l.set(hx + 7, hy + 1, Sk[2]); l.set(hx + 6, hy + 2, Sk[1]); } stamp(l, skinOut); }
  int style = L.hairStyle;
  if (style != HS_BALD) { Spr l(FW, FH);
    auto shine = [&](int x, int y, double u, double v) { double k = 0.6 - u * 0.32 - v * 0.42 + (((x + y * 2) % 5 == 0) ? 0.08 : 0); return Hr[k > 0.86 ? 3 : k > 0.42 ? 2 : k > 0.05 ? 1 : 0]; };
    if (dir == 0) {
      l.ellf(hx, hy - 1.6, 7.8, 6, [&](double u, double v, int x, int y) { bool fringe = v < 0.08 + (std::fabs(u) > 0.66 ? 0.75 : 0) + ((x + (style == HS_SPIKY ? 1 : 0)) % 3 == 0 ? 0.18 : 0) - (std::fabs(u) < 0.15 ? 0.06 : 0); return fringe ? shine(x, y, u, v) : -1; });
      if (style == HS_LONG) for (int y = hy; y < hy + 9; y++) { l.set(hx - 8, y, Hr[2]); l.set(hx - 7, y, Hr[1]); l.set(hx + 7, y, Hr[1]); l.set(hx + 8, y, Hr[0]); }
    } else if (dir == 2) {
      l.ellf(hx, hy - 1, 7.8, 6.6, [&](double u, double v, int x, int y) { return shine(x, y, u, v); }); l.ellf(hx, hy + 3, 6.6, 3.2, [&](double, double v, int, int) { return Hr[v > 0.3 ? 1 : 2]; });
      if (style == HS_LONG) for (int y = hy + 3; y < hy + 11; y++) for (int x = hx - 6; x <= hx + 6; x++) l.set(x, y, (x + y) % 5 == 0 ? Hr[1] : x < hx - 2 ? Hr[3] : Hr[2]);
      if (style == HS_PONY) for (int y = hy + 4; y < hy + 12; y++) { l.set(hx - 1, y, Hr[2]); l.set(hx, y, Hr[2]); l.set(hx + 1, y, Hr[1]); }
    } else {
      l.ellf(hx - 0.8, hy - 1.4, 7.0, 6.1, [&](double u, double v, int x, int y) { return (u < -0.1 - v * 0.35 || v < -0.3) ? shine(x, y, u, v) : -1; });
      for (int k = 0; k < 3; k++) l.set(hx + 2 + k, hy - 4 + (k == 2 ? 1 : 0), Hr[2]);
      if (style == HS_LONG) for (int y = hy; y < hy + 9; y++) { l.set(hx - 6, y, Hr[2]); l.set(hx - 5, y, Hr[1]); l.set(hx - 7, y, Hr[1]); }
      if (style == HS_PONY) { for (int y = hy - 1; y < hy + 6; y++) { l.set(hx - 8 - (y > hy + 2 ? 1 : 0), y, Hr[2]); l.set(hx - 7 - (y > hy + 2 ? 1 : 0), y, Hr[1]); } l.set(hx - 6, hy - 1, Ss[2]); }
    }
    if (style == HS_BUN) { int bx = dir == 1 ? hx - 5 : hx; l.ellf(bx, hy - 8, 3.2, 2.8, [&](double u, double v, int, int) { return Hr[v < -0.3 ? 3 : u > 0.4 ? 1 : 2]; }); l.set(bx + 2, hy - 7, Ss[3]); }
    if (style == HS_SPIKY) for (int k = -2; k <= 2; k++) { int x = hx + k * 3 - (dir == 1 ? 1 : 0); l.set(x, hy - 8, Hr[3]); l.set(x, hy - 9, Hr[2]); l.set(x + 1, hy - 8, Hr[2]); }
    if (L.beard && dir != 2) { int bx = dir == 1 ? hx + 1 : hx - 3; for (int i = 0; i < (dir == 1 ? 4 : 7); i++) { l.set(bx + i, hy + 4, Hr[1]); if (i > 0 && i < (dir == 1 ? 3 : 6)) l.set(bx + i, hy + 5, Hr[0]); } }
    stamp(l, hairOut); }
  if (dir != 2) {
    int ey = hy + 1, iris = L.eyes >= 0 ? L.eyes : 0x3a2a54;
    auto eye = [&](int x) {
      if (Z) { s.set(x, ey, 0x140808); s.set(x + 1, ey, 0x140808); s.set(x, ey + 1, 0xff4a3a); s.set(x + 1, ey + 1, 0x8a1a1a); return; }
      if (f.blink) { s.set(x, ey + 1, OUTC); s.set(x + 1, ey + 1, OUTC); return; }
      s.set(x, ey - 1, OUTC); s.set(x + 1, ey - 1, OUTC); s.set(x, ey, 0xffffff); s.set(x + 1, ey, OUTC); s.set(x, ey + 1, iris); s.set(x + 1, ey + 1, mulh(iris, 0.6));
      if (L.lash) s.set(x + (dir == 1 ? 2 : (x < hx ? -1 : 2)), ey - 1, OUTC); };
    int blush = mixh(L.skin, 0xff6a80, Z ? 0 : 0.5), mouth = Z ? 0x3a1a1a : mixh(L.skin, 0x9a3a3a, 0.45);
    if (dir == 0) { eye(hx - 4); eye(hx + 3); s.set(hx - 5, ey + 3, blush); s.set(hx - 4, ey + 3, blush); s.set(hx + 4, ey + 3, blush); s.set(hx + 5, ey + 3, blush); s.set(hx, ey + 3, mouth); if (Z) { s.set(hx - 1, ey + 3, 0x3a1a1a); s.set(hx + 1, ey + 3, 0x3a1a1a); } }
    else { eye(hx + 3); s.set(hx + 3, ey + 3, blush); s.set(hx + 4, ey + 3, blush); s.set(hx + 5, ey + 3, mouth); }
  }
  if (L.hat != HAT_NONE) { Spr l(FW, FH); R4 hc(L.hatColor ? L.hatColor : 0xd8b850);
    if (L.hat == HAT_KASA) { l.polyf({{(double)hx - 11, (double)hy - 1}, {(double)hx + 11, (double)hy - 1}, {(double)hx + 3, (double)hy - 9}, {(double)hx - 3, (double)hy - 9}}, [&](int x, int y) { return y > hy - 3 ? hc[1] : (x + y * 2) % 4 == 0 ? hc[1] : x < hx - 2 ? hc[3] : hc[2]; }); for (int x = hx - 10; x <= hx + 10; x++) l.set(x, hy - 1, hc[0]); }
    else if (L.hat == HAT_HELM) { l.ellf(hx, hy - 3.5, 7.6, 4.8, [&](double u, double v, int, int) { return v > 0.5 ? -1 : v < -0.45 ? hc[3] : u > 0.45 ? hc[1] : hc[2]; });
      for (int x = hx - 9; x <= hx + 9; x++) { l.set(x, hy - 2, hc[3]); l.set(x, hy - 1, hc[1]); } if (dir != 2) { l.rect(hx - 10, hy - 1, 2, 4, hc[1]); l.rect(hx + 8, hy - 1, 2, 4, hc[1]); }
      if (L.crest >= 0) { R4 C(L.crest); l.set(hx, hy - 9, C[3]); l.set(hx - 1, hy - 10, C[2]); l.set(hx + 1, hy - 10, C[2]); l.set(hx - 2, hy - 11, C[3]); l.set(hx + 2, hy - 11, C[3]); l.set(hx, hy - 8, C[1]); } }
    else if (L.hat == HAT_HOOD) l.ellf(hx, hy - 1, 8.2, 7.2, [&](double u, double v, int, int) { return (dir == 0 && v > -0.38 && std::fabs(u) < 0.64) ? -1 : (dir == 1 && u > 0.28 && v > -0.42) ? -1 : hc[u > 0.45 ? 1 : v < -0.45 ? 3 : 2]; });
    else if (L.hat == HAT_CROWN) { l.rectf(hx - 4, hy - 9, 8, 3, [&](int x, int y, int, int) { return (y == hy - 9 && ((x - hx) % 2 != 0)) ? -1 : 0xe8c040; }); l.set(hx, hy - 8, 0xd8302a); }
    else if (L.hat == HAT_BAND) { for (int x = hx - 7; x <= hx + 7; x++) { l.set(x, hy - 4, hc[3]); l.set(x, hy - 3, hc[2]); } if (dir != 0) { int kx = dir == 1 ? hx - 7 : hx; l.set(kx, hy - 2, hc[2]); l.set(kx - 1, hy - 1, hc[1]); l.set(kx + 1, hy - 1, hc[1]); } }
    else if (L.hat == HAT_EBOSHI) l.rectf(hx - 3, hy - 13, 6, 8, [&](int x, int y, int, int) { return x == hx + 2 ? 0x101014 : y == hy - 13 ? 0x3a3a46 : 0x24242c; });
    stamp(l, mulh(L.hatColor ? L.hatColor : 0x404040, 0.35)); }
  return {s, handx, handy};
}
static std::unordered_map<std::string, std::unique_ptr<CharFrames>> CHAR_CACHE;
static const CharFrames* bakeChar(const Look& Lk) {
  std::string k = Lk.key(); auto it = CHAR_CACHE.find(k); if (it != CHAR_CACHE.end()) return it->second.get();
  auto R = std::make_unique<CharFrames>(); Look L = Lk;
  const CF WALK_F[4] = {{0, 1, 0, -1, 1}, {-1}, {0, 0, 1, 1, -1}, {-1}}, WALK_S[4] = {{0, 0, 0, -2, 0, 2}, {-1}, {0, 0, 0, 2, 0, -2}, {-1}};
  CF IDLE[4] = {{}, {}, {}, {}}; IDLE[2].bob = 1; IDLE[3].blink = true; const CF ACT[3] = {{0, 0, 0, -2, -1}, {0, 0, 0, 1, 0}, {1, 0, 0, 2, 0}};
  CF wf[4], ws[4]; for (int i = 0; i < 4; i++) { wf[i] = WALK_F[i]; ws[i] = WALK_S[i]; }
  // bob is the first field of CF: fix up the shorthand initialisers above
  wf[0].bob = 0; wf[0].la = 1; wf[0].lb = 0; wf[0].sa = -1; wf[0].sb = 1; wf[1] = CF(); wf[1].bob = -1; wf[2] = CF(); wf[2].la = 0; wf[2].lb = 1; wf[2].sa = 1; wf[2].sb = -1; wf[3] = CF(); wf[3].bob = -1;
  ws[0] = CF(); ws[0].stride = 2; ws[0].sa = -2; ws[1] = CF(); ws[1].bob = -1; ws[2] = CF(); ws[2].stride = -2; ws[2].sa = 2; ws[3] = CF(); ws[3].bob = -1;
  CF act[3]; act[0] = CF(); act[0].sa = -2; act[0].sb = -1; act[1] = CF(); act[1].sa = 1; act[2] = CF(); act[2].sa = 2; act[2].bob = 1;
  for (int dir : {0, 1, 2}) for (int name = 0; name < 3; name++) { int n = name == 2 ? 3 : 4;
    for (int i = 0; i < n; i++) { CF f = name == 0 ? IDLE[i] : name == 1 ? (dir == 1 ? ws[i] : wf[i]) : act[i]; if (L.zombie && name == 1 && dir != 1) { f.sa = 0; f.sb = 0; }
      CharOut o = drawChar(L, dir, f); Img im(FW, FH); im.p = o.s.d; R->f[dir][name][i] = im; R->hx[dir][name][i] = o.hx; R->hy[dir][name][i] = o.hy;
      if (dir == 1) { Img fl(FW, FH); for (int y = 0; y < FH; y++) for (int x = 0; x < FW; x++) fl.p[y * FW + x] = im.p[y * FW + FW - 1 - x]; R->f[3][name][i] = fl; R->hx[3][name][i] = FW - o.hx; R->hy[3][name][i] = o.hy; } } }
  return (CHAR_CACHE[k] = std::move(R)).get();
}
inline Look villagerLook(u32 seed, bool chief = false, bool merchant = false) {
  RNG r(seed); Look L; L.seed = seed; auto p = [&](const int* a, int n) { return a[(int)std::floor(r.next() * n)]; };
  L.skin = p(SKINS, 5); L.hair = p(HAIRS, 7); static const int VHS[6] = {HS_SHORT, HS_LONG, HS_BUN, HS_PONY, HS_SHORT, HS_SPIKY}; L.hairStyle = VHS[(int)std::floor(r.next() * 6)]; L.shirt = p(SHIRTS, 9);
  static const int PANTS[6] = {0x5a6488, 0x7a5a44, 0x4a6a8a, 0x6a5a7a, 0x5a7a5a, 0x8a7a6a}; L.pants = p(PANTS, 6); L.shoes = 0x6b4428; static const int SASH[5] = {0x2a2a46, 0xc8423a, 0xe8c040, 0x3a6a3a, 0xe87a9a}; L.sash = p(SASH, 5);
  L.hat = r.next() < 0.3 ? HAT_KASA : (r.next() < 0.2 ? HAT_BAND : HAT_NONE); static const int HC[4] = {0xd8b850, 0xc8a050, 0xe8433a, 0x3a6fc8}; L.hatColor = p(HC, 4); L.beard = r.next() < 0.15; L.lash = r.next() < 0.5;
  if (chief) { L.hat = HAT_EBOSHI; L.shirt = 0x3a2a4a; L.sash = 0xe8c040; L.beard = true; } else if (merchant) { L.hat = HAT_KASA; L.hatColor = 0xc8a050; }
  return L;
}
inline Look soldierLook(u32 seed, int color, bool archer) { RNG r(seed); Look L; L.seed = seed; L.skin = SKINS[(int)std::floor(r.next() * 4)]; L.hair = HAIRS[(int)std::floor(r.next() * 5)]; L.hairStyle = HS_SHORT; L.shirt = mulh(color, 0.9); L.pants = 0x4a4a5a; L.shoes = 0x4a3426; L.sash = 0x2a2a36;
  L.armor = archer ? -1 : 0x9a9aa8; L.hat = archer ? HAT_HOOD : HAT_HELM; L.hatColor = archer ? mulh(color, 0.75) : 0x8a8a98; L.crest = color; return L; }
inline Look zombieLook(u32 seed, int kind) { RNG r(seed + 999); Look L; L.seed = seed; L.zombie = true; static const int skins[4] = {0x8ab07a, 0x9ab89a, 0x7a9a6a, 0xa8b08a};
  L.skin = kind == 2 ? 0x7a8a9a : skins[(int)std::floor(r.next() * 4)]; static const int hr[3] = {0x2c2430, 0x4e3224, 0x5a5a4a}; L.hair = hr[(int)std::floor(r.next() * 3)]; static const int hs[4] = {HS_SHORT, HS_SPIKY, HS_LONG, HS_BALD}; L.hairStyle = hs[(int)std::floor(r.next() * 4)];
  static const int sh[4] = {0x6a7a9a, 0x9a6a5a, 0x7a7a6a, 0x5a6a5a}; L.shirt = mulh(sh[(int)std::floor(r.next() * 4)], 0.85); L.pants = 0x5a5058; L.shoes = 0x3a3234; L.sash = 0x3a3a3a; L.hat = kind == 2 ? HAT_HELM : HAT_NONE; L.hatColor = 0x5a5a62; return L; }
inline Look playerLook(int skin, int hair, int shirt, int style, int hat = HAT_BAND) { Look L; L.seed = 7; L.skin = SKINS[skin]; L.hair = HAIRS[hair]; L.hairStyle = style; L.shirt = SHIRTS[shirt]; L.pants = 0x6a7090; L.shoes = 0x7a5034; L.sash = 0x2a2a46; L.hat = hat; L.hatColor = 0xd8302a; L.lash = true; return L; }
