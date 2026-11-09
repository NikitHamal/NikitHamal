// Hanomi native — world renderer: chunk bake with edge blending, live water, y-sorted sprites, swaying foliage, lighting, weather, fx.
#pragma once
#include "ai.h"

struct Renderer {
  Img screen; Img light; float time = 0; int W = 480, H = 270; int camL = 0, camT = 0;
  struct Bird { float x, y, vx, t; }; std::vector<Bird> birds; float birdT = 5; float ambT = 0;
  Img minimap; float miniT = 0; std::vector<u8> mark;

  static int prio(int g) { switch (g) { case G_SAND: return 1; case G_DIRT: return 2; case G_PATH: return 2; case G_ROCK: return 3; case G_MARSH: return 4; case G_GRASS: return 6; case G_FOREST: return 7; case G_SAKURA: return 7; case G_SNOW: return 8; default: return 0; } }
  static bool hard(int g) { return g == G_TILLED || g == G_WET || g == G_WOOD || g == G_COBBLE || g == G_PLAZA || g == G_TATAMI || isWater(g); }

  void bakeChunk(Game& G, Chunk& c) {
    World& w = G.world; if (c.surf.w != CPX) c.surf.alloc(CPX, CPX); std::fill(c.surf.p.begin(), c.surf.p.end(), 0u); int x0 = c.cx * CS, y0 = c.cy * CS; c.water = false;
    for (int j = 0; j < CS; j++) for (int i = 0; i < CS; i++) {
      int idx = j * CS + i, x = x0 + i, y = y0 + j, g = c.g[idx]; int nb[4] = {w.ground(x, y - 1), w.ground(x + 1, y), w.ground(x, y + 1), w.ground(x - 1, y)}; // N E S W
      int var = hash2i(x, y, 9) & 3; bool wat = isWater(g); u8 mask = 0; if (wat) { c.water = true; for (int s = 0; s < 4; s++) if (!isWater(nb[s])) mask |= 1 << s; int dg[4][2] = {{1, -1}, {1, 1}, {-1, 1}, {-1, -1}}; for (int s = 0; s < 4; s++) if (!isWater(w.ground(x + dg[s][0], y + dg[s][1]))) mask |= 16 << s; } c.shore[idx] = mask;
      int blk = c.b[idx]; bool isBlock = blk && blk != B_BLDG;
      for (int py = 0; py < 16; py++) for (int px = 0; px < 16; px++) {
        int wx = x * 16 + px, wy = y * 16 + py; u32 col = 0;
        if (!wat) {
          col = ART.ground[g][var].p[py * 16 + px]; float lf = vnoise(wx / 24.f, wy / 24.f, 3); if (g == G_GRASS || g == G_FOREST || g == G_SAKURA || g == G_MARSH || g == G_SAND || g == G_DIRT) col = lf > 0.62f ? ramp(col, 0.35f) : lf < 0.38f ? ramp(col, -0.35f) : col;
          if (!hard(g)) for (int s = 0; s < 4; s++) { int n = nb[s]; if (n == g || hard(n) || prio(n) <= prio(g)) continue; int d = s == 0 ? py : s == 1 ? 15 - px : s == 2 ? 15 - py : px; float th = 1 + 3.6f * hash2(wx >> 1, wy >> 1, 41 + s) * (0.5f + vnoise(wx / 5.f, wy / 5.f, 8)); if (d < th) { col = ART.ground[n][hash2i(x + DIRV[s][0], y + DIRV[s][1], 9) & 3].p[py * 16 + px]; if (d + 1 >= th) col = ramp(col, -0.6f); } }
          for (int s = 0; s < 4; s++) if (isWater(nb[s])) { int d = s == 0 ? py : s == 1 ? 15 - px : s == 2 ? 15 - py : px; if (d == 0) col = ramp(col, -1.1f); else if (d == 1 && hash2(wx, wy, 5) < 0.6f) col = ramp(col, -0.5f); }
          if (isBlock) { int south = w.block(x, y + 1) && w.block(x, y + 1) != B_BLDG; col = ART.block[blk][south][hash2i(x, y, 5) & 3].p[py * 16 + px]; }
          if (blk == B_BLDG) col = ART.ground[G_DIRT][var].p[py * 16 + px];
        } else {
          // land spilling into the water edge
          for (int s = 0; s < 4; s++) if (mask >> s & 1) { int n = nb[s]; int d = s == 0 ? py : s == 1 ? 15 - px : s == 2 ? 15 - py : px; float th = 0.5f + 2.3f * hash2(wx >> 1, wy >> 1, 61 + s) * (0.4f + vnoise(wx / 4.f, wy / 4.f, 9)); if (d < th) { col = ART.ground[n][hash2i(x + DIRV[s][0], y + DIRV[s][1], 9) & 3].p[py * 16 + px]; col = ramp(col, d + 1 >= th ? -1.0f : -0.3f); } }
        }
        c.surf.p[(j * 16 + py) * CPX + i * 16 + px] = col;
      }
    }
    c.dirty = false;
  }
  static u32 waterCol(int g, int wx, int wy, float t, float shallow, u8 mask, int px, int py) {
    u32 base = g == G_DEEP ? 0x2a6aa0 : g == G_ONSEN ? 0x58c8c4 : 0x46a4cc; u32 sh = g == G_ONSEN ? 0x8ae8dc : 0x78d0dc; u32 c = mixc(HEX(base), HEX(sh), shallow * (g == G_DEEP ? 0.4f : 1.f));
    float w1 = std::sin(wx * 0.19f + t * 1.3f + std::sin(wy * 0.12f + t * 0.5f) * 2.f) + std::sin(wy * 0.27f - t * 0.9f + std::sin(wx * 0.1f) * 1.5f) + std::sin((wx + wy) * 0.11f + t * 0.6f);
    float b = bayer(wx, wy); if (w1 > 1.5f + b * 0.5f) c = ramp(c, 1.2f); else if (w1 < -1.4f - b * 0.4f) c = ramp(c, -0.9f); else if (w1 > 0.9f && b < 0.3f) c = ramp(c, 0.5f);
    if (hash2(wx, wy, (u32)(t * 3)) > 0.9975f) c = HEX(0xf4ffff);
    if (g == G_ONSEN && hash2(wx >> 1, wy >> 1, (u32)(t * 2)) > 0.97f) c = HEX(0xd8fff8);
    if (mask & 15) { float th = 2.2f + std::sin(t * 2.f + wx * 0.31f + wy * 0.17f) * 1.1f; for (int s = 0; s < 4; s++) if (mask >> s & 1) { int d = s == 0 ? py : s == 1 ? 15 - px : s == 2 ? 15 - py : px; float n = hash2(wx, wy, 77); if (d >= 1 && d < th + n * 1.5f && (d < th * 0.6f || n < 0.5f)) c = mixc(c, HEX(0xffffff), d < th * 0.5f ? 0.8f : 0.45f); else if (d >= th && d < th + 2.4f && hash2(wx, wy, 78) < 0.2f) c = ramp(c, 0.6f); } }
    return c;
  }
  void drawWater(Game& G, Chunk& c) {
    int x0 = c.cx * CS, y0 = c.cy * CS; for (int j = 0; j < CS; j++) for (int i = 0; i < CS; i++) { int idx = j * CS + i; int g = c.g[idx]; if (!isWater(g)) continue; int sx = (x0 + i) * 16 - camL, sy = (y0 + j) * 16 - camT; if (sx > W || sy > H || sx < -16 || sy < -16) continue; u8 mask = c.shore[idx]; float shallow = mask ? 1.f : (g == G_ONSEN ? 1.f : 0.f); if (!mask && g != G_DEEP) shallow = 0.5f;
      for (int py = 0; py < 16; py++) { int Y = sy + py; if (Y < 0 || Y >= H) continue; for (int px = 0; px < 16; px++) { int X = sx + px; if (X < 0 || X >= W) continue; u32 surf = c.surf.p[(j * 16 + py) * CPX + i * 16 + px]; if (surf >> 24) { screen.p[(size_t)Y * W + X] = surf; continue; }
        float sh = shallow; if (mask & 15) { int dm = 99; for (int s = 0; s < 4; s++) if (mask >> s & 1) dm = std::min(dm, s == 0 ? py : s == 1 ? 15 - px : s == 2 ? 15 - py : px); sh = clampf(1.f - dm / 9.f, 0.2f, 1.f); }
        screen.p[(size_t)Y * W + X] = waterCol(g, (x0 + i) * 16 + px, (y0 + j) * 16 + py, time, sh, mask, px, py); } } }
  }
  /* ---------- swaying sprite ---------- */
  void drawSway(const Spr& s, int px, int py, float amp, float phase, bool flip = false) {
    int bx = px - s.ax, by = py - s.ay; const Img& im = s.im; for (int j = 0; j < im.h; j++) { int Y = by + j; if (Y < 0 || Y >= H) continue; float f = 1.f - (float)j / im.h; int off = (int)std::round(std::sin(time * 1.7f + phase) * amp * f * f); for (int i = 0; i < im.w; i++) { u32 c = im.p[j * im.w + (flip ? im.w - 1 - i : i)]; if (!(c >> 24)) continue; int X = bx + i + off; if (X >= 0 && X < W) { u32& d = screen.p[(size_t)Y * W + X]; d = ca(c) == 255 ? c : blendOver(d, c); } } }
  }
  void drawSpr(const Spr& s, int px, int py) { blit(s.im, px - s.ax, py - s.ay); }

  struct DI { float y; int kind; int a, b; void* p; };
  void drawChicken(Ent& e, int sx, int sy, bool flash) {
    static Img buf(28, 24); std::fill(buf.p.begin(), buf.p.end(), 0u); Img* old = T; T = &buf; float t = e.as.t; bool mv = e.moving; float ph = e.as.walkT * TAU, ox = 14, oy = 20; float bob = mv ? -std::fabs(std::sin(ph)) * 0.8f : 0; float peck = (e.as.graze > 0 || (e.state == 2)) ? std::max(0.f, std::sin(t * 9)) * 3 : 0; u32 body = e.baby ? 0xf8e070 : (hash2i(e.id, 1, 2) & 1) ? 0xf8f4ec : 0xc8883a;
    for (int i = 0; i < 2; i++) { float s = std::sin(ph + i * PI); float lift = mv ? std::max(0.f, std::cos(ph + i * PI)) * 1.6f : 0; line((int)(ox + (i ? 1 : -1) + s * 1.5f), (int)(oy - 3 + bob), (int)(ox + (i ? 1 : -1) + s * 2.5f), (int)(oy - lift), HEX(0xe8a02a)); putpx((int)(ox + (i ? 1 : -1) + s * 2.5f) + 1, (int)(oy - lift), HEX(0xe8a02a)); }
    sellipse(ox - 1.5f, oy - 7 + bob, 5.5f, 4.2f, body); scap(ox - 6, oy - 9 + bob, ox - 8.5f, oy - 11 + bob, 1.6f, ramp(HEX(body), -0.4f)); sellipse(ox - 1.5f, oy - 6 + bob, 3.2f, 2.2f, ramp(HEX(body), -0.6f));
    float hx = ox + 4.5f + peck * 0.5f, hy = oy - 12 + bob + peck; scap(ox + 2, oy - 8 + bob, hx, hy, 1.5f, body); sellipse(hx, hy, 2.4f, 2.3f, body); putpx((int)(hx + 2), (int)(hy + 0.5f), HEX(0xe8a02a)); putpx((int)(hx + 3), (int)(hy + 1), HEX(0xe8a02a)); putpx((int)(hx + 1), (int)(hy - 0.5f), HEX(0x14101a)); putpx((int)hx, (int)(hy - 3), HEX(0xe83a3a)); putpx((int)hx + 1, (int)(hy - 3), HEX(0xe83a3a)); putpx((int)hx + 1, (int)(hy + 2), HEX(0xe83a3a));
    T = old; Img o = buf; outlineImg(o, HEX(0x1c1424)); bool fl = e.dir == 3 || (e.dir != 1 && e.as.seed & 1); (void)fl; bool flip = e.dir == 3 || e.x2dir < 0; int rows = 24; for (int j = 0; j < rows; j++) for (int i = 0; i < 28; i++) { u32 c = o.p[j * 28 + (flip ? 27 - i : i)]; if (!(c >> 24)) continue; if (flash) c = mixc(c, HEX(0xffffff), 0.75f); putpx(sx - 14 + i, sy - 20 + j, c); }
  }
  void shadow(int x, int y, int rx, int ry, int a) { for (int j = -ry; j <= ry; j++) for (int i = -rx; i <= rx; i++) { float d = (float)(i * i) / (rx * rx) + (float)(j * j) / (ry * ry); if (d <= 1) { int X = x + i, Y = y + j; if (X >= 0 && X < W && Y >= 0 && Y < H) { u32& p = screen.p[(size_t)Y * W + X]; p = mixc(p, HEX(0x101028), a / 255.f * (d > 0.6f ? 0.6f : 1.f)); } } } }

  void drawWorld(Game& G) {
    time += 1.f / 60.f; W = G.viewW; H = G.viewH; if (screen.w != W || screen.h != H) screen.alloc(W, H); T = &screen; World& w = G.world; Ent& pl = *G.player;
    float shk = SET.shake ? G.fx.shake : 0; float sox = shk > 0 ? (hash2((int)(time * 90), 1) - 0.5f) * shk : 0, soy = shk > 0 ? (hash2((int)(time * 90), 2) - 0.5f) * shk : 0;
    camL = (int)std::round(G.camX - W / 2.f + sox); camT = (int)std::round(G.camY - H / 2.f + soy); int tx0 = fdiv(camL, 16) - 1, ty0 = fdiv(camT, 16) - 1, tx1 = fdiv(camL + W, 16) + 2, ty1 = fdiv(camT + H, 16) + 2;
    int cx0 = fdiv(tx0, CS), cx1 = fdiv(tx1, CS), cy0 = fdiv(ty0, CS), cy1 = fdiv(ty1, CS);
    std::fill(screen.p.begin(), screen.p.end(), 0xFF1b1420u); int budget = G.world.frame < 3 ? 99 : 3;
    for (int cy = cy0; cy <= cy1; cy++) for (int cx = cx0; cx <= cx1; cx++) { Chunk* c = w.chunk(cx, cy); if (c->dirty || c->surf.w == 0) { if (budget-- <= 0 && c->surf.w) {} else bakeChunk(G, *c); } if (c->surf.w == 0) continue; int sx = cx * CPX - camL, sy = cy * CPX - camT;
      for (int j = std::max(0, -sy); j < std::min(CPX, H - sy); j++) for (int i = std::max(0, -sx); i < std::min(CPX, W - sx); i++) { u32 p = c->surf.p[j * CPX + i]; if (p >> 24) screen.p[(size_t)(sy + j) * W + sx + i] = p; } if (c->water) drawWater(G, *c); }
    // ground decals: shadows
    float dl = G.daylight(); int shA = (int)(70 * (0.35f + 0.65f * dl));
    std::vector<DI> items; items.reserve(512);
    for (int ty = ty0 - 1; ty <= ty1 + 3; ty++) for (int tx = tx0 - 2; tx <= tx1 + 1; tx++) { Chunk* c = w.chunk(fdiv(tx, CS), fdiv(ty, CS)); int idx = fmod_i(ty, CS) * CS + fmod_i(tx, CS); int o = c->o[idx]; if (o) items.push_back({(float)(ty + 1) * 16 - (o == O_TORII ? 0 : 0) + (OBJS[o].tree ? 0 : 0), 0, tx, ty, nullptr}); }
    for (Village* v : w.villagesNear(G.camX / 16.f, G.camY / 16.f, 40)) for (auto& s : v->structs) { float by = (s.y + s.h) * 16.f; if (s.x * 16 - 8 > camL + W || (s.x + s.w) * 16 + 8 < camL || by < camT || by - s.h * 16 - 24 > camT + H) continue; items.push_back({by - 1, 1, 0, 0, (void*)&s}); }
    for (auto& e : G.ents) { if (e->dead && e->type != E_PLAYER && e->type != E_ANIMAL && !e->human() && e->type != E_DOG) continue; if (e->inside) continue; if (e->x < camL - 40 || e->x > camL + W + 40 || e->y < camT - 20 || e->y > camT + H + 60) continue; items.push_back({e->y + (e->type == E_DROP ? 0 : 0), 2, 0, 0, e.get()}); }
    std::sort(items.begin(), items.end(), [](const DI& a, const DI& b) { return a.y < b.y; });
    // shadows pass
    for (auto& d : items) { if (d.kind == 2) { Ent* e = (Ent*)d.p; if (e->type == E_ARROW || e->dead || G.waterLevel(*e)) continue; int sx = (int)std::round(e->x) - camL, sy = (int)std::round(e->y) - camT; if (e->type == E_DROP) shadow(sx, sy, 3, 1, shA); else if (e->type == E_ANIMAL || e->type == E_DOG) shadow(sx, sy, (int)(ANISPEC[std::min(e->aniIdx, 8)].len * 0.45f), 2, shA); else shadow(sx, sy, 5, 2, shA); }
      else if (d.kind == 0) { int o = w.obj(d.a, d.b); if (OBJS[o].tree) shadow(d.a * 16 + 8 - camL, d.b * 16 + 14 - camT, o == O_BAMBOO ? 4 : 9, 3, shA); } }
    // sorted draw
    for (auto& d : items) {
      if (d.kind == 0) drawObject(G, d.a, d.b);
      else if (d.kind == 1) { Struct& s = *(Struct*)d.p; Spr& sp = ART.houseSpr(s); blit(sp.im, s.x * 16 - 5 - camL, (s.y + s.h) * 16 - sp.im.h + 2 - camT);
        if (s.kind == 1) { /* hall banner */ } }
      else drawEnt(G, *(Ent*)d.p);
    }
    // sort-independent overlays: target, fishing, particles
    drawTarget(G); drawFishing(G); drawParticles(G); drawBirds(G);
    for (auto& f : G.fx.fl) { int a = (int)clampf(f.t * 400, 0, 255); drawTextC(f.text, (int)f.x - camL, (int)f.y - camT, withA(f.col, a), 1, withA(0x000000, a * 3 / 4)); }
    lighting(G); weather(G);
    for (auto& e : G.ents) if (!e->dead && !e->inside && !e->bubble.empty() && e->bubbleT > 0) bubble(*e);
  }
  void bubble(Ent& e) {
    int sx = (int)std::round(e.x) - camL, sy = (int)std::round(e.y) - camT - (e.human() ? 33 : 24); std::vector<std::string> lines; std::string cur, word; auto flush = [&]() { if (!word.empty()) { if (textW(cur + (cur.empty() ? "" : " ") + word) > 84 && !cur.empty()) { lines.push_back(cur); cur = word; } else cur += (cur.empty() ? "" : " ") + word; word.clear(); } };
    for (char c : e.bubble) { if (c == ' ') flush(); else word += c; } flush(); if (!cur.empty()) lines.push_back(cur); int w = 0; for (auto& l : lines) w = std::max(w, textW(l)); int h = (int)lines.size() * 9 + 4, bx = sx - w / 2 - 3, by = sy - h; float a = std::min(1.f, e.bubbleT * 3);
    int A = (int)(255 * a); frect(bx + 1, by, w + 5, h, withA(0xFFF6EE, A)); frect(bx, by + 1, w + 7, h - 2, withA(0xFFF6EE, A)); frect(sx - 1, by + h, 3, 1, withA(0xFFF6EE, A)); putpx(sx, by + h + 1, withA(0xFFF6EE, A)); srect(bx, by + 1, w + 7, h - 2, withA(0x2a1f3a, A / 2)); for (size_t i = 0; i < lines.size(); i++) drawText(lines[i], bx + 3, by + 3 + (int)i * 9, withA(0x2a1f3a, A));
  }
  void drawObject(Game& G, int tx, int ty) {
    World& w = G.world; int idx; Chunk* c = w.at(tx, ty, idx); int o = c->o[idx], m = c->m[idx]; int px = tx * 16 + 8 - camL, py = ty * 16 + 16 - camT; float ph = hash2(tx, ty, 5) * 6.28f; float rainWind = 1 + G.rain * 0.6f; float shk = 0; auto it = G.shakeTiles.find(K2(tx, ty)); if (it != G.shakeTiles.end()) shk = it->second * 18;
    switch (o) {
      case O_OAK: case O_PINE: case O_SAKURA: case O_BIRCH: case O_DEADTREE: drawSway(ART.obj[o][m & 3], px, py + 2, 1.1f * rainWind + (shk ? std::sin(time * 60) * shk * 0.3f : 0), ph); if (o == O_SAKURA && hash2((int)(time * 8), tx * 7 + ty, 3) > 0.9985f) G.fx.spawn({(float)tx * 16 + 8 + frandr(-10, 10), (float)ty * 16 + 4, 18, 0, 0, 0, 0, 3.f, 3.f, frand() * 6, 0xFFf6b8ca, 0xFFd8789a, 3}); break;
      case O_BAMBOO: drawSway(ART.obj[o][m & 3], px, py + 1, 1.8f * rainWind, ph); break;
      case O_TALLGRASS: case O_REEDS: drawSway(ART.obj[o][m & (o == O_REEDS ? 1 : 3)], px, py - 1, 1.6f * rainWind, ph + tx); break;
      case O_FLOWERS: case O_MUSHROOM: case O_BOULDER: case O_PEBBLE: { int v = m & 7; if (o == O_FLOWERS) drawSway(ART.obj[o][v], px, py - 1, 1.2f * rainWind, ph); else drawSpr(ART.obj[o][v], px, py - 1); break; }
      case O_BUSH: drawSway(ART.obj[o][(tx + ty) & 1], px, py, 0.7f * rainWind, ph); break;
      case O_BERRY: case O_STUMP: case O_SAPLING: case O_CACTUS: drawSway(ART.obj[o][0], px, py, o == O_SAPLING ? 1.f : 0.f, ph); break;
      case O_LILY: { int bob = (int)std::round(std::sin(time * 1.5f + ph) * 0.6f); drawSpr(ART.obj[o][0], px, py - 4 + bob); break; }
      case O_WHEAT: case O_CARROT: case O_TOMATO: case O_PUMPKIN: case O_RICE: drawSway(ART.cropSpr[o - O_WHEAT][clampi(m, 0, 3)], px, py, 0.8f * rainWind, ph); break;
      case O_FENCE: case O_GATE: { auto isF = [&](int x, int y) { int q = w.obj(x, y); return q == O_FENCE || q == O_GATE; }; int mask = (isF(tx, ty - 1) ? 1 : 0) | (isF(tx + 1, ty) ? 2 : 0) | (isF(tx, ty + 1) ? 4 : 0) | (isF(tx - 1, ty) ? 8 : 0); if (o == O_GATE) drawSpr((m & 1) ? ART.gateOpen : ART.gateClosed, px, py); else drawSpr(ART.fence[mask], px, py); break; }
      case O_BANNER: { Spr& s = ART.obj[o][0]; u32 col = 0xe87a9a; for (Village* v : w.villagesNear((float)tx, (float)ty, 3)) if (v->bx == tx && v->by == ty) { col = G.nation(v).color; break; } int bx = px - s.ax, by = py - s.ay; blit(s.im, bx, by); int wave = (int)std::round(std::sin(time * 2.2f + ph) * 1.2f); for (int y = 5; y < 23; y++) { int off = (int)std::round(std::sin(time * 3 + y * 0.3f + ph) * (y - 4) * 0.06f); for (int x = 2; x < 12; x++) { u32 p = s.im.get(x, y); if (p == 0xFFFFFFFFu || ca(p)) { float sh = x < 4 ? 0.5f : x > 9 ? -0.6f : 0; u32 cc = ramp(HEX(col), sh + (y > 20 ? -0.5f : 0)); if (y >= 19 && (x + y) % 2 == 0 && y > 21) continue; putpx(bx + x + off, by + y, cc); } } } (void)wave; frect(bx + 4, by + 10, 5, 5, HEX(0xffffff)); fcircle(bx + 6.5f, by + 12.5f, 2, ramp(HEX(col), 0.8f)); putpx(bx + 6, by + 12, HEX(0xffffff)); break; }
      case O_TORCH: case O_CAMPFIRE: case O_LANTERN: case O_POT: case O_FURNACE: { drawSpr(ART.obj[o][0], px, py); float fl = std::sin(time * 14 + ph) * 0.5f + std::sin(time * 23 + ph * 2) * 0.5f; int fx0 = px, fy0 = py - (o == O_TORCH ? 11 : o == O_CAMPFIRE ? 9 : o == O_LANTERN ? 14 : o == O_POT ? 8 : 6);
        if (o == O_LANTERN) { frect(fx0 - 2, fy0 + 1, 4, 3, withA(0xFFE08A, 200 + (int)(fl * 30))); break; } if (o == O_POT) { frect(fx0 - 4, fy0 + 3, 8, 1, HEX(0xFFD878)); break; }
        int h = 4 + (int)(fl * 1.4f) + (o == O_CAMPFIRE ? 3 : 0); for (int j = 0; j < h; j++) { float f = (float)j / h; int hw = (int)std::round((1 - f) * (o == O_CAMPFIRE ? 3.2f : 1.6f) + 0.4f); u32 c = f < 0.35f ? 0xFFFFE9A0 : f < 0.7f ? 0xFFF8A82A : 0xFFE0482A; frect(fx0 - hw + (int)(fl * (f)), fy0 - j, hw * 2, 1, c); }
        if (frand() < 0.05f) G.fx.spawn({(float)tx * 16 + 8, (float)ty * 16 + 8, (float)(o == O_TORCH ? 12 : 10), frandr(-6, 6), frandr(-3, 3), frandr(18, 36), -6, 0.9f, 0.9f, 1, 0xFFffd060, 0xFFe0482a, 5}); if (frand() < 0.02f) G.fx.spawn({(float)tx * 16 + 8, (float)ty * 16 + 8, 14, frandr(-3, 3), 0, frandr(10, 18), -2, 1.6f, 1.6f, 2, 0x70a0a0a0, 0x00a0a0a0, 4}); break; }
      case O_DIG: drawSpr(ART.obj[o][0], px, py); if (std::fmod(time + ph, 2.4f) < 0.25f) { putpx(px, py - 6, HEX(0xffffff)); putpx(px - 1, py - 6, HEX(0xf2c24a)); putpx(px + 1, py - 6, HEX(0xf2c24a)); putpx(px, py - 7, HEX(0xf2c24a)); putpx(px, py - 5, HEX(0xf2c24a)); } break;
      case O_KOI: drawSpr(ART.obj[o][0], px, py); break; case O_SHRINE: drawSpr(ART.obj[o][0], px, py); if (std::fmod(time * 0.7f + ph, 3.f) < 0.12f) putpx(px + 2, py - 26, HEX(0xffffff)); break;
      default: if (ART.obj[o][0].im.w) drawSpr(ART.obj[o][0], px, py); break;
    }
    // damage bar
    auto di = G.dmg.find(K2(tx, ty)); if (di != G.dmg.end() && (c->o[idx] || c->b[idx])) { float mx = c->b[idx] ? BLOCKS[c->b[idx]].hp : OBJS[o].hp; float f = clampf(di->second.hp / mx, 0, 1); int bx = tx * 16 + 2 - camL, by = ty * 16 - 4 - camT; frect(bx - 1, by - 1, 14, 4, HEX(0x1c1424)); frect(bx, by, 12, 2, HEX(0x4a2a38)); frect(bx, by, (int)std::round(12 * f), 2, f > 0.5f ? HEX(0x8ae070) : f > 0.25f ? HEX(0xf2c24a) : HEX(0xe8484a)); }
  }
  void drawEnt(Game& G, Ent& e) {
    int sx = (int)std::round(e.x) - camL, sy = (int)std::round(e.y - e.z) - camT; bool flash = e.flash > 0 && std::fmod(e.flash * 30, 2.f) < 1.f; int wl = e.type == E_DROP || e.type == E_ARROW ? 0 : (e.z > 0 ? 0 : G.waterLevel(e));
    switch (e.type) {
      case E_DROP: { const Img& ic = ART.icon[e.item]; float bob = std::sin(e.rs.t * 3) * 1.5f; int s = 11; blitScaled(ic, sx - s / 2, sy - 12 - (int)bob - (int)e.z, s, s); if (e.st < 10 && std::fmod(e.st * 6, 2.f) < 1.f) {} break; }
      case E_ARROW: { float a = e.gx; float cs = std::cos(a), sn = std::sin(a); int x = sx, y = sy - (int)e.z; line((int)(x - cs * 5), (int)(y - sn * 5), x, y, HEX(0x8a5a34)); putpx(x + (int)(cs * 1), y + (int)(sn * 1), HEX(0xdfe3ee)); putpx((int)(x - cs * 5), (int)(y - sn * 5), HEX(0xf8f0e8)); break; }
      case E_PLAYER: case E_VILLAGER: case E_SOLDIER: case E_ZOMBIE: {
        if (e.type == E_PLAYER && e.ifr > 0 && !e.dead && std::fmod(e.ifr * 20, 2.f) < 0.7f && e.flash <= 0) break;
        int cut = wl == 2 ? 27 : wl == 1 ? 13 : 0; int dy = wl == 2 ? 4 : 0; e.rig.draw(e.rs, sx, sy + dy, cut, flash);
        if (wl) { int by = sy + dy + 56 - cut - 46; frect(sx - 8, by, 16, 1, withA(0xE8FBFF, 200)); frect(sx - 10, by + 1, 20, 1, withA(0xBEE6F0, 110)); }
        if (e.type == E_VILLAGER && e.role == R_CHIEF) { auto it = G.nations.find(e.vid); if (it != G.nations.end() && std::fmod(G.playTime, 1.2f) < 0.8f) drawTextC("!", sx, sy - 42, HEX(0xffe060), 1, HEX(0x000000)); }
        if (e.type == E_SOLDIER && e.mine) { fcircle(sx, sy - 36, 1.5f, HEX(0xe87a9a)); }
        if ((e.type == E_ZOMBIE || e.type == E_SOLDIER) && e.hp < e.maxHp && !e.dead) { int w = 14; frect(sx - w / 2 - 1, sy - 38, w + 2, 4, HEX(0x1c1424)); frect(sx - w / 2, sy - 37, w, 2, HEX(0x4a2a38)); frect(sx - w / 2, sy - 37, (int)(w * clampf(e.hp / e.maxHp, 0, 1)), 2, e.type == E_ZOMBIE ? HEX(0x8ae070) : HEX(0xe8484a)); }
        if (e.type == E_VILLAGER && e.role != R_VILLAGER && std::hypot(e.x - G.player->x, e.y - G.player->y) < 50) drawTextC(e.role == R_MERCHANT ? "Merchant" : e.name + ", chief", sx, sy - 44, HEX(0xf6eee0), 1, HEX(0x1c1424));
        break; }
      case E_DOG: case E_ANIMAL: {
        bool flip = e.dir == 3 || (e.dir != 1 && (e.as.seed & 1)); if (e.kind == "chicken") { e.x2dir = e.dir == 3 ? -1 : e.dir == 1 ? 1 : e.x2dir; drawChicken(e, sx, sy, flash); break; }
        AniState st = e.as; st.moving = e.moving; st.shorn = e.shorn; st.baby = e.baby; st.dead = e.dead ? e.deadT * 1.6f : 0; st.hurt = e.flash; float sc = e.baby ? 0.66f : 1.f; if (e.type == E_DOG && e.as.sleeping) {}
        int cut = wl == 2 ? 20 : wl == 1 ? 8 : 0; e.arig.draw(st, e.type == E_DOG ? 7 : std::min(e.aniIdx, 8), sx, sy + (wl == 2 ? 3 : 0), flip, flash, cut, sc); if (wl) frect(sx - 9, sy + (wl == 2 ? 3 : 0) + 8 - cut / 1, 18, 1, withA(0xE8FBFF, 180));
        if (e.type == E_DOG && e.owned && std::hypot(e.x - G.player->x, e.y - G.player->y) < 40) {} break; }
    }
  }
  void drawTarget(Game& G) {
    if (G.modal != M_NONE || G.player->dead) return; Slot* s = G.itemSlot(); int tx = G.tgx, ty = G.tgy; int bx = tx * 16 - camL, by = ty * 16 - camT; bool interesting = G.world.obj(tx, ty) || G.world.block(tx, ty) || (s && (ITEMS[s->id].kind == K_PLACE || ITEMS[s->id].kind == K_SEED || ITEMS[s->id].tool == TL_HOE || ITEMS[s->id].tool == TL_CAN));
    if (!interesting && !G.tgAim) return; float pul = 0.5f + 0.5f * std::sin(time * 6); u32 col = withA(0xFFFFFF, (int)(110 + pul * 90)); int L = 4;
    if (s && ITEMS[s->id].kind == K_PLACE) { const ItemDef& it = ITEMS[s->id]; int g = G.world.ground(tx, ty); bool ok = !G.world.block(tx, ty) && !G.world.obj(tx, ty) && !isWater(g); col = ok ? withA(0x9AFFA0, 200) : withA(0xFF7A7A, 200); if (it.po && ART.obj[it.po][0].im.w && ok) { Spr& sp = ART.obj[it.po][0]; Img& im = sp.im; for (int j = 0; j < im.h; j++) for (int i = 0; i < im.w; i++) { u32 c = im.p[j * im.w + i]; if (c >> 24) putpx(bx + 8 - sp.ax + i, by + 16 - sp.ay + j, withA(c, 110)); } } }
    for (int k = 0; k < 4; k++) { int x = k & 1 ? bx + 16 - 1 : bx, y = k & 2 ? by + 16 - 1 : by; int dx = k & 1 ? -1 : 1, dy = k & 2 ? -1 : 1; for (int i = 0; i < L; i++) { putpx(x + dx * i, y, col); putpx(x, y + dy * i, col); } }
  }
  void drawFishing(Game& G) {
    if (!G.fishing) return; Ent& p = *G.player; int hx = (int)p.x - camL + DIRV[p.dir][0] * 8 + (p.dir == 2 ? 2 : 0), hy = (int)p.y - camT - 16; int rx = hx + DIRV[p.dir][0] * 6 + (p.dir == 0 ? 6 : 0), ry = hy - 7; int bx = (int)G.bobX - camL, by = (int)G.bobY - camT; line(hx, hy, rx, ry, HEX(0x8a5a34));
    for (int k = 0; k <= 16; k++) { float t = k / 16.f; int x = (int)(rx + (bx - rx) * t), y = (int)(ry + (by - ry) * t + std::sin(t * PI) * 7); putpx(x, y, withA(0xFFFFFF, 190)); }
    float bob = G.fishPhase == 1 ? std::sin(time * 40) * 1.2f : std::sin(time * 3) * 0.6f; frect(bx - 1, by - 2 + (int)bob, 3, 2, HEX(0xE8484A)); frect(bx - 1, by + (int)bob, 3, 1, HEX(0xFFFFFF)); if (G.fishPhase == 1) drawTextC("!", bx, by - 14, HEX(0xFFE060), 2, HEX(0x000000));
  }
  void drawParticles(Game& G) {
    for (auto& p : G.fx.ps) { int x = (int)std::round(p.x) - camL, y = (int)std::round(p.y - p.z) - camT; if (x < -8 || y < -8 || x > W + 8 || y > H + 8) continue; float f = clampf(p.life / p.max, 0, 1); u32 c = mixc(p.c2, p.c, f); int a = (int)(ca(c) * clampf(f * 2.5f, 0, 1));
      switch (p.kind) { case 0: putpx(x, y, withA(c, a)); if (p.s > 1.5f) putpx(x + 1, y, withA(c, a)); break;
        case 1: { float r = p.s * (1 - f); int n = std::max(8, (int)(r * 4)); for (int k = 0; k < n; k++) { float aa = k * TAU / n; putpx((int)std::round(p.x - camL + std::cos(aa) * r), (int)std::round(p.y - camT + std::sin(aa) * r * 0.5f), withA(c, (int)(220 * f))); } break; }
        case 2: { static const char* H[] = {".X.X.", "XXXXX", "XXXXX", ".XXX.", "..X.."}; u32 hc = withA(c, a); for (int j = 0; j < 5; j++) for (int i = 0; i < 5; i++) if (H[j][i] == 'X') putpx(x - 2 + i, y - 2 + j, hc); break; }
        case 3: putpx(x, y, withA(c, a)); putpx(x + 1, y, withA(ramp(c, -1), a)); break; case 4: { int r = 1 + (int)((1 - f) * 3); fcircle((float)x, (float)y, (float)r, withA(c, (int)(ca(c) * f))); break; }
        case 5: putpx(x, y, withA(c, a)); if (f > 0.5f) { putpx(x + 1, y, withA(c, a / 2)); putpx(x, y - 1, withA(c, a / 2)); } break; case 7: { int r = 1 + (int)((1 - f) * 2); fcircle((float)x, (float)y, (float)r, withA(c, (int)(120 * f))); break; }
        case 9: break; default: putpx(x, y, withA(c, a)); } }
  }
  void drawBirds(Game& G) {
    birdT -= 1.f / 60; if (birdT <= 0 && G.daylight() > 0.6f && !G.raining() && birds.size() < 3) { birdT = frandr(8, 25); float y = G.camY + frandr(-90, 60); bool r = frand() < 0.5f; birds.push_back({G.camX + (r ? -W / 2.f - 20 : W / 2.f + 20), y, (r ? 1 : -1) * frandr(28, 44), frand() * 6}); if (G.player && frand() < 0.5f) Audio::play(S_CHIRP, 0.35f, frandr(0.9f, 1.3f), r ? -0.5f : 0.5f); }
    for (auto& b : birds) { b.x += b.vx / 60; b.t += 0.3f; int x = (int)b.x - camL, y = (int)b.y - camT + (int)(std::sin(b.t * 0.5f) * 2); shadow(x, y + 40, 3, 1, 40); int wing = (int)std::round(std::sin(b.t * 2) * 2); putpx(x, y, HEX(0x2a2430)); putpx(x - 1, y - wing, HEX(0x2a2430)); putpx(x + 1, y - wing, HEX(0x2a2430)); putpx(x - 2, y - wing - 1, HEX(0x2a2430)); putpx(x + 2, y - wing - 1, HEX(0x2a2430)); putpx(x + (b.vx > 0 ? 1 : -1), y + 1, HEX(0x6a5a50)); }
    birds.erase(std::remove_if(birds.begin(), birds.end(), [&](const Bird& b) { return std::fabs(b.x - G.camX) > W; }), birds.end());
  }
  /* ---------- lighting ---------- */
  void lighting(Game& G) {
    float dl = G.daylight(); float dark = (1 - dl) * 0.8f; bool bm = G.bloodMoon(); float h = G.hour(); float dusk = (h > 16.5f && h < 20.f) ? std::sin((h - 16.5f) / 3.5f * PI) : (h > 4.5f && h < 7.5f) ? std::sin((h - 4.5f) / 3.f * PI) : 0.f; dusk *= 0.6f;
    if (G.rain > 0.2f) dark = std::max(dark, 0.12f * G.rain);
    if (dark < 0.01f && dusk < 0.01f && G.lightning <= 0) return;
    int LW = (W + 1) / 2, LH = (H + 1) / 2; light.alloc(LW, LH); std::vector<float> L((size_t)LW * LH, 0.f);
    auto addLight = [&](float wx, float wy, float r, float inten, float flick) { float cx = (wx - camL) / 2, cy = (wy - camT) / 2, rr = r / 2 * (1 + flick * 0.03f); int x0 = std::max(0, (int)(cx - rr)), x1 = std::min(LW - 1, (int)(cx + rr)), y0 = std::max(0, (int)(cy - rr)), y1 = std::min(LH - 1, (int)(cy + rr)); for (int y = y0; y <= y1; y++) for (int x = x0; x <= x1; x++) { float dx = x - cx, dy = y - cy, d = std::sqrt(dx * dx + dy * dy) / rr; if (d >= 1) continue; float v = (1 - d); v = v * v * (3 - 2 * v) * inten; float& q = L[(size_t)y * LW + x]; q = std::min(1.f, q + v); } };
    int tx0 = fdiv(camL, 16) - 8, ty0 = fdiv(camT, 16) - 8, tx1 = fdiv(camL + W, 16) + 8, ty1 = fdiv(camT + H, 16) + 8; World& w = G.world;
    if (dark > 0.02f) { for (int ty = ty0; ty <= ty1; ty++) for (int tx = tx0; tx <= tx1; tx++) { int o = w.obj(tx, ty); if (o && OBJS[o].light) addLight(tx * 16.f + 8, ty * 16.f + 8, OBJS[o].light * 16.f, 1.f, std::sin(time * 11 + tx * 3 + ty) + std::sin(time * 17 + tx)); }
      addLight(G.player->x, G.player->y - 8, 52, 0.55f, 0); if (G.inv[G.sel].id && ITEMS[G.inv[G.sel].id].id == "torch") addLight(G.player->x, G.player->y - 10, 88, 1.f, std::sin(time * 13)); for (auto& e : G.ents) if (!e->dead && e->type == E_SOLDIER && !e->inside) addLight(e->x, e->y - 8, 26, 0.35f, 0); for (auto& e : G.ents) if (!e->dead && !e->inside && e->type == E_VILLAGER && e->x > camL - 40 && e->x < camL + W + 40) addLight(e->x, e->y - 8, 20, 0.25f, 0); for (auto& e : G.ents) if (e->type == E_ARROW) addLight(e->x, e->y - e->z, 10, 0.4f, 0);
      for (auto& p : G.fx.ps) if (p.kind == 5 && p.life > 0.2f) addLight(p.x, p.y - p.z, 9, 0.35f, 0); for (Village* v : w.villagesNear(G.camX / 16.f, G.camY / 16.f, 30)) for (auto& s : v->structs) { float dx = (s.x + s.w / 2.f) * 16 - camL, dy = (s.y + s.h) * 16 - camT; if (dx < -80 || dx > W + 80 || dy < -80 || dy > H + 80) continue; addLight((s.x + s.w / 2.f) * 16, (s.y + s.h) * 16 - 10, s.w * 8 + 10, 0.55f, 0.f); } }
    // colour grade
    u32 night = bm ? 0x3a0e1c : 0x0c1236; float nr = cr(HEX(night)), ng = cg(HEX(night)), nb = cb(HEX(night)); float lf = G.lightning > 0 ? G.lightning : 0.f;
    for (int y = 0; y < H; y++) { u32* row = &screen.p[(size_t)y * W]; for (int x = 0; x < W; x++) {
        float lv = L[(size_t)(y >> 1) * LW + (x >> 1)]; float dk = dark * (1 - lv); u32 p = row[x]; float r = cr(p), g = cg(p), b = cb(p);
        if (dk > 0.003f) { float q = dk * 0.92f; r = r * (1 - q) + nr * q * 1.0f; g = g * (1 - q) + ng * q; b = b * (1 - q) + nb * q; r *= 1 - dk * 0.45f; g *= 1 - dk * 0.42f; b *= 1 - dk * 0.28f; }
        if (lv > 0 && dark > 0.02f) { float wa = lv * dark * 0.38f; r += (255 - r) * wa * 0.55f; g += (200 - g) * wa * 0.5f; b += (110 - b) * wa * 0.3f; }
        if (dusk > 0.01f) { r = r * (1 - dusk * 0.12f) + 255 * dusk * 0.07f; g *= 1 - dusk * 0.2f; b *= 1 - dusk * 0.38f; }
        if (lf > 0) { float a = lf * 0.7f; r += (255 - r) * a; g += (255 - g) * a; b += (255 - b) * a; }
        row[x] = 0xFF000000u | ((u32)clampi((int)r, 0, 255) << 16) | ((u32)clampi((int)g, 0, 255) << 8) | (u32)clampi((int)b, 0, 255); } }
  }
  void weather(Game& G) {
    float rain = G.rain; if (rain > 0.05f) { int bi = G.world.biomeAt((int)(G.player->x / 16), (int)(G.player->y / 16)); bool snow = bi == BI_SNOW; int n = (int)(rain * (snow ? 90 : 160)); for (int i = 0; i < n; i++) { u32 h = hash2i(i, (int)(time * 60) / 2, 91); float fx = (h & 1023) / 1023.f, fy0 = ((h >> 10) & 1023) / 1023.f; float spd = snow ? 0.3f : 1.f; float t = std::fmod(time * (snow ? 0.35f : 1.9f) + hash2(i, 5, 3), 1.f); int x = (int)(std::fmod(fx * (W + 80) + t * (snow ? 10 : -22) * (snow ? std::sin(i + time) : 1), (float)W + 80)) - 40 + (int)(t * 24 * (snow ? 0 : 1)), y = (int)(t * (H + 20)) - 10 + (int)(fy0 * 0); x = (int)(fx * W + t * (snow ? std::sin(time + i) * 8 : 18)); (void)spd; if (snow) { putpx(x, y, HEX(0xFFFFFF)); if (i % 3 == 0) putpx(x + 1, y, withA(0xFFFFFF, 160)); } else { u32 c = withA(0xBFD8F0, 150); putpx(x, y, c); putpx(x - 1, y + 2, c); putpx(x - 2, y + 4, withA(0xBFD8F0, 90)); } }
      if (!snow) { for (int i = 0; i < (int)(rain * 18); i++) { int x = (int)(hash2(i, (int)(time * 12), 4) * W), y = (int)(hash2(i, (int)(time * 12), 5) * H); int ri = (int)(time * 12) % 3; putpx(x - 1, y, withA(0xE0F0FF, 120)); putpx(x + 1, y, withA(0xE0F0FF, 120)); putpx(x, y - (ri == 1), withA(0xE0F0FF, 90)); } }
      for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) { u32& p = screen.p[(size_t)y * W + x]; p = mixc(p, HEX(snow ? 0xE8F0FF : 0x6a7a90), rain * (snow ? 0.08f : 0.13f)); } }
    int bi = G.world.biomeAt((int)(G.player->x / 16), (int)(G.player->y / 16)); if (bi == BI_SAKURA && G.rain < 0.3f && frand() < 0.18f) G.fx.spawn({G.player->x + frandr(-W / 2.f, W / 2.f), G.player->y + frandr(-H / 2.f, 0), 40, 0, 0, 0, 0, 3.f, 3.f, frand() * 6, 0xFFf6b8ca, 0xFFd8789a, 3});
    if (G.daylight() < 0.4f && G.rain < 0.4f && bi != BI_SNOW && frand() < 0.1f) G.fx.spawn({G.player->x + frandr(-W / 2.f, W / 2.f), G.player->y + frandr(-H / 3.f, H / 3.f), frandr(6, 24), frandr(-5, 5), frandr(-3, 3), frandr(-4, 4), 0, 2.2f, 2.2f, 1, 0xFFd8ff80, 0xFF70c040, 5});
    if (G.hurtT > 0) { float a = G.hurtT / 0.45f; for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) { float dx = (x - W / 2.f) / (W / 2.f), dy = (y - H / 2.f) / (H / 2.f); float d = dx * dx + dy * dy; if (d > 0.35f) { u32& p = screen.p[(size_t)y * W + x]; p = mixc(p, HEX(0xc81a2a), clampf((d - 0.35f) * 0.55f * a, 0, 0.6f)); } } }
    if (G.player->hp <= 5 && !G.player->dead) { float a = (0.5f + 0.5f * std::sin(time * 6)) * 0.22f; for (int y = 0; y < H; y += 1) for (int x = 0; x < W; x += 1) { float dx = (x - W / 2.f) / (W / 2.f), dy = (y - H / 2.f) / (H / 2.f); float d = dx * dx + dy * dy; if (d > 0.5f) { u32& p = screen.p[(size_t)y * W + x]; p = mixc(p, HEX(0xc81a2a), clampf((d - 0.5f) * a, 0, 0.5f)); } } }
    // soft vignette
    for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) { float dx = (x - W / 2.f) / (W / 2.f), dy = (y - H / 2.f) / (H / 2.f); float d = dx * dx * 0.7f + dy * dy; if (d > 0.7f) { u32& p = screen.p[(size_t)y * W + x]; float k = clampf((d - 0.7f) * 0.35f, 0, 0.35f); p = RGB((int)(cr(p) * (1 - k)), (int)(cg(p) * (1 - k)), (int)(cb(p) * (1 - k))); } }
  }
};
static Renderer REN;
