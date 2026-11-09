// Hanomi native — UI: HUD, hotbar, minimap, inventory/crafting, trade, chest, dialogue, map, realm, goals, pause/settings/help, koi-pond title.
#pragma once
#include "render.h"

namespace UI {
static Slot cursor; static float tabScroll = 0, craftScroll = 0; static int invTab = 0, tradeTab = 0; static Img mapImg; static float mapT = -99; static int mapCx = 0, mapCy = 0; static std::string hoverTip; static float selFlash = 0; static int lastSel = -1;
static float titleT = 0; static bool fromTitle = true; static int helpPage = 0; static bool quitReq = false; static float saveFlash = 0;
inline bool inR(float mx, float my, int x, int y, int w, int h) { return mx >= x && my >= y && mx < x + w && my < y + h; }
inline bool hov(int x, int y, int w, int h) { return IN.mouseOn && inR(IN.mx, IN.my, x, y, w, h); }
inline bool clicked(int x, int y, int w, int h) { return hov(x, y, w, h) && IN.mhit[0]; }
inline void panel(int x, int y, int w, int h, const char* title = nullptr, u32 acc = 0xFFf6b8ca) {
  frect(x + 1, y, w - 2, h, HEX(0x1b1420) & 0x00FFFFFF | 0xF0000000); frect(x, y + 1, w, h - 2, 0xF01b1420); hline(x + 2, y + 1, w - 4, 0xFF5a4670); hline(x + 2, y + h - 2, w - 4, 0xFF0e0a14); vline(x + 1, y + 2, h - 4, 0xFF4a3a5e); vline(x + w - 2, y + 2, h - 4, 0xFF0e0a14);
  hline(x + 1, y, w - 2, 0xFF8a6aa0); hline(x + 1, y + h - 1, w - 2, 0xFF2a1f38); vline(x, y + 1, h - 2, 0xFF6a5088); vline(x + w - 1, y + 1, h - 2, 0xFF2a1f38); if (title) { drawText(title, x + 8, y + 6, acc, 1, 0xFF000000); hline(x + 6, y + 16, w - 12, 0x80f6b8ca); }
}
inline bool button(int x, int y, int w, int h, const std::string& label, bool enabled = true, u32 col = 0xFF3a2a52) {
  bool hv = hov(x, y, w, h) && enabled; u32 bg = !enabled ? 0xFF2a2430 : hv ? 0xFF6a4a8a : col; frect(x + 1, y, w - 2, h, bg); frect(x, y + 1, w, h - 2, bg); hline(x + 1, y, w - 2, enabled ? 0xFF9a7ab8 : 0xFF3a3440); hline(x + 1, y + h - 1, w - 2, 0xFF1a1022); drawTextC(label, x + w / 2, y + (h - 7) / 2, enabled ? (hv ? 0xFFffffff : 0xFFe8dcf0) : 0xFF6a6270, 1, 0xFF000000);
  if (hv && IN.mhit[0]) { Audio::play(S_CLICK, 0.6f); return true; } return false;
}
inline void slotBox(int x, int y, bool sel, bool hi = false) { frect(x, y, 18, 18, sel ? 0xFF5a3a6e : 0xFF2a2038); srect(x, y, 18, 18, sel ? 0xFFf6b8ca : hi ? 0xFF9a7ab8 : 0xFF4a3a5e); hline(x + 1, y + 1, 16, 0x30ffffff); }
inline void drawSlot(Game& g, int x, int y, const Slot& s, bool sel, bool showTip = true) {
  bool hi = hov(x, y, 18, 18); slotBox(x, y, sel, hi); if (s.id) { blit(ART.icon[s.id], x + 1, y + 1); const ItemDef& d = ITEMS[s.id]; if (s.n > 1) { std::string n = std::to_string(s.n); drawText(n, x + 17 - textW(n), y + 10, 0xFFffffff, 1, 0xFF000000); } if (d.dur && s.d < d.dur) { int w = (int)(14.f * s.d / d.dur); frect(x + 2, y + 15, 14, 2, 0xFF1c1424); frect(x + 2, y + 15, w, 1, s.d * 4 < d.dur ? 0xFFe8484a : s.d * 2 < d.dur ? 0xFFf2c24a : 0xFF8ae070); } if (hi && showTip) { hoverTip = d.name; if (d.kind == K_FOOD || d.kind == K_FISH) hoverTip += fmt("  (+%d food)", d.food); if (d.dmg && d.kind == K_WEAPON) hoverTip += fmt("  (dmg %d)", d.dmg); hoverTip += fmt("  [%dc]", d.value); } }
}
inline void heartRow(Game& g, int x, int y) { for (int i = 0; i < 10; i++) { float hp = g.player->hp - i * 2; const Img& im = hp >= 2 ? ART.heartF : hp >= 1 ? ART.heartH : ART.heartE; int jig = (g.player->hp <= 5 && !g.player->dead) ? (int)std::round(std::sin(REN.time * 20 + i) * 0.8f) : 0; blit(im, x + i * 9, y + jig); } }
inline void foodRow(Game& g, int x, int y) { for (int i = 0; i < 10; i++) { float f = g.food - i * 2; blit(f >= 1 ? ART.drumstick : ART.drumstickE, x + i * 9, y); if (f >= 1 && f < 2) frect(x + i * 9 + 6, y + 1, 4, 8, 0xFF4a3a30); } }
inline void sunIcon(int x, int y, bool moon, bool blood) { if (!moon) { fcircle(x + 5, y + 5, 3.2f, HEX(0xf8d848)); for (int k = 0; k < 8; k++) putpx((int)(x + 5 + std::cos(k * 0.785f) * 5.2f), (int)(y + 5 + std::sin(k * 0.785f) * 5.2f), HEX(0xf8d848)); } else { u32 c = blood ? 0xFFe8484a : 0xFFe8e4f4; fcircle(x + 5, y + 5, 4.2f, c); fcircle(x + 7.5f, y + 4, 3.6f, 0xF01b1420); } }

inline void drawMinimap(Game& g, int x, int y) {
  const int S = 56, SC = 2; REN.miniT -= 1.f / 60; if (REN.minimap.w != S || REN.miniT <= 0) { REN.minimap.alloc(S, S); REN.miniT = 0.3f; int px = g.player->tx(), py = g.player->ty(); for (int j = 0; j < S; j++) for (int i = 0; i < S; i++) { int tx = px + (i - S / 2) * SC, ty = py + (j - S / 2) * SC; Chunk* c = g.world.peek(fdiv(tx, CS), fdiv(ty, CS)); u32 col = 0xFF1b1420; if (c) { int idx = fmod_i(ty, CS) * CS + fmod_i(tx, CS); int gg = c->g[idx], b = c->b[idx], o = c->o[idx]; col = isWater(gg) ? (gg == G_DEEP ? 0xFF2a6aa0 : 0xFF4aa8cf) : groundBase(gg); if (b == B_BLDG) col = 0xFFb89a7a; else if (b) col = b == B_COAL ? 0xFF3a3a44 : b == B_IRON ? 0xFFb88a6a : b == B_GOLD ? 0xFFd8b040 : b == B_GEM ? 0xFF4ae0a8 : 0xFF6a6a78; else if (o && OBJS[o].tree) col = mixc(col, HEX(0x2a6a3a), 0.6f); else if (o == O_TORII || o == O_BANNER) col = 0xFFe8484a; col = gg == G_PATH || gg == G_PLAZA ? 0xFFc8b898 : col; } REN.minimap.p[j * S + i] = col; } }
  frect(x - 2, y - 2, S + 4, S + 4, 0xFF1b1420); srect(x - 2, y - 2, S + 4, S + 4, 0xFF8a6aa0); blit(REN.minimap, x, y);
  float pxx = x + S / 2.f, pyy = y + S / 2.f; auto dot = [&](float wx, float wy, u32 c) { int dx = (int)((wx - g.player->x) / (TS * SC)), dy = (int)((wy - g.player->y) / (TS * SC)); if (std::abs(dx) < S / 2 - 1 && std::abs(dy) < S / 2 - 1) { putpx((int)pxx + dx, (int)pyy + dy, c); putpx((int)pxx + dx + 1, (int)pyy + dy, c); } };
  for (auto& e : g.ents) if (!e->dead && !e->inside) { if (e->type == E_ZOMBIE) dot(e->x, e->y, 0xFF8ae070); else if (e->type == E_SOLDIER) dot(e->x, e->y, e->mine ? 0xFFf6b8ca : 0xFFe8484a); else if (e->type == E_DOG && e->owned) dot(e->x, e->y, 0xFFf2c24a); }
  Village* h = g.home(); dot(h->x * TS, h->y * TS, 0xFFf6b8ca); int fl = ((int)(REN.time * 3)) & 1; putpx((int)pxx, (int)pyy, 0xFFffffff); putpx((int)pxx + 1, (int)pyy, 0xFFffffff); putpx((int)pxx, (int)pyy + 1, fl ? 0xFFffe060 : 0xFFffffff); putpx((int)pxx + 1, (int)pyy + 1, 0xFFffffff);
}
inline std::string promptText(Game& g) {
  if (g.modal != M_NONE || g.player->dead) return ""; Ent& p = *g.player; int o = g.world.obj(g.tgx, g.tgy); float d = std::hypot(g.tgx * TS + 8 - p.x, g.tgy * TS + 8 - (p.y - 6));
  Ent* e = g.nearest(p.x + DIRV[p.dir][0] * 10, p.y - 6 + DIRV[p.dir][1] * 10, 18, [&](Ent* q) { return q != g.player && (q->type == E_VILLAGER || q->type == E_DOG || (q->type == E_SOLDIER && q->mine)); }); if (e) { if (e->type == E_DOG) return "E: Pet the dog"; if (e->role == R_MERCHANT) return "E: Trade"; if (e->role == R_CHIEF) return "E: Speak with " + e->name; if (e->type == E_SOLDIER) return "E: Hold / Follow"; return "E: Talk"; }
  if (o && d < 40 && OBJS[o].use) { std::string u = OBJS[o].use; return u == "chest" ? "E: Open chest" : u == "gate" ? "E: Open / close gate" : u == "bed" ? "E: Sleep" : u == "well" ? "E: Drink / refill" : u == "banner" ? "E: Set spawn here" : u == "trade" ? "E: Browse the stall" : u == "koi" ? "E: Feed the koi" : u == "shrine" ? "E: Pray" : u == "grave" ? "E: Recover satchel" : ""; }
  if (o == O_DIG && d < 40) return "Dig with J / click (any hoe)"; return "";
}
inline void drawHUD(Game& g) {
  int W = g.viewW, H = g.viewH; hoverTip.clear(); Ent& p = *g.player;
  // vitals
  panel(3, 3, 104, 36); heartRow(g, 9, 8); foodRow(g, 9, 19); blit(ART.coin, 9, 29); drawText(std::to_string(g.coins), 22, 30, 0xFFf2c24a, 1, 0xFF000000);
  float h = g.hour(); int hh = (int)h, mm = (int)((h - hh) * 60); bool moon = g.daylight() < 0.45f; sunIcon(60, 28, moon, g.bloodMoon()); drawText(fmt("D%d %02d:%02d", g.day, hh, mm), 72, 30, g.bloodMoon() ? 0xFFe8484a : 0xFFe8dcf0, 1, 0xFF000000);
  if (g.buff > 0) { drawText("Blessed", 9, 43, 0xFFfff2c0, 1, 0xFF000000); }
  if (g.goal < NGOALS && SET.minimap) { drawText(std::string("> ") + GOALS[g.goal].t, 9, g.buff > 0 ? 53 : 43, 0xFFd8c8f0, 1, 0xFF000000); }
  if (g.bloodMoon()) { std::string t = "BLOOD MOON"; int a = 150 + (int)(std::sin(REN.time * 4) * 80); drawTextC(t, W / 2, 6, withA(0xE8484A, a), 1, 0xFF000000); }
  if (SET.minimap) drawMinimap(g, W - 62, 5);
  if (SET.showFps) drawText(fmt("%d fps  ents %d  chunks %d", (int)g.fps, (int)g.ents.size(), (int)g.world.chunks.size()), 4, H - 10, 0xFFa8f0a8, 1, 0xFF000000);
  if (g.raidOn) { auto ar = g.armyList(); (void)ar; }
  if (!g.armyList().empty()) { drawText(fmt("Army %d/%d", (int)g.armyList().size(), g.armyCap()), W - 62, 66, 0xFFf6b8ca, 1, 0xFF000000); }
  // hotbar
  int hx = W / 2 - 8 * 10 + 1, hy = H - 24; panel(hx - 4, hy - 4, 8 * 20 + 7, 26); for (int i = 0; i < 8; i++) { drawSlot(g, hx + i * 20, hy, g.inv[i], i == g.sel); drawText(std::to_string(i + 1), hx + i * 20 + 2, hy + 2, 0xB0e8dcf0, 1, 0xFF000000); }
  if (g.sel != lastSel) { lastSel = g.sel; selFlash = 1.6f; } selFlash -= 1.f / 60; if (selFlash > 0 && g.inv[g.sel].id) drawTextC(ITEMS[g.inv[g.sel].id].name, W / 2, hy - 14, withA(0xFFFFFF, (int)clampf(selFlash * 255, 0, 255)), 1, withA(0, (int)clampf(selFlash * 255, 0, 255)));
  if (g.armor.id) { slotBox(hx - 26, hy, false); blit(ART.icon[g.armor.id], hx - 25, hy + 1); }
  std::string pr = promptText(g); if (!pr.empty()) drawTextC(pr, W / 2, hy - 26, 0xFFfff2c0, 1, 0xFF000000);
  // toasts
  int ty = H - 52 - 0; for (int i = (int)g.toasts.size() - 1; i >= 0; i--) { auto& t = g.toasts[i]; int a = (int)clampf(t.t * 3 * 255, 0, 255); int w = textW(t.text) + 8; frect(6, ty - 2, w, 11, withA(0x1b1420, a * 3 / 4)); drawText(t.text, 10, ty, withA(t.col, a), 1, withA(0, a)); ty -= 12; }
  // banner
  if (g.bannerT > 0) { float t = g.bannerT, a = clampf(std::min(t, 4.2f - t) * 3, 0, 1); int A = (int)(255 * a); int by = 52; frect(0, by - 6, W, 40, withA(0x1b1420, A * 2 / 3)); hline(0, by - 6, W, withA(0xf6b8ca, A / 2)); hline(0, by + 33, W, withA(0xf6b8ca, A / 2)); drawTextC(g.bannerA, W / 2, by, withA(0xFFE4EE, A), 3, withA(0x2a1030, A)); drawTextC(g.bannerB, W / 2, by + 26 - 3, withA(0xE8DCF0, A), 1, withA(0, A)); }
  // fishing minigame
  if (g.fishing && g.fishPhase == 2) { int bx = W / 2 + 40, by = H / 2 - 40, bh = 80; frect(bx - 3, by - 3, 14, bh + 6, 0xE01b1420); frect(bx, by, 8, bh, 0xFF2a5a7a); int zy = by + (int)((1 - g.fishBar) * bh) - 12; frect(bx, std::max(by, zy), 8, std::min(24, by + bh - std::max(by, zy)), 0xFF8ae070); int fy = by + (int)((1 - g.fishPos) * bh) - 3; blit(ART.icon[g.fishItem], bx - 4, fy - 5); frect(bx + 12, by + bh - (int)(bh * g.fishProg), 3, (int)(bh * g.fishProg), 0xFFf2c24a); srect(bx + 11, by, 5, bh, 0xFF8a6aa0); drawTextC("Hold J / click to reel", W / 2, by + bh + 8, 0xFFe8f0ff, 1, 0xFF000000); }
  else if (g.fishing && g.fishPhase == 1) drawTextC("Bite! Press J / click!", W / 2, H / 2 + 50, 0xFFffe060, 1, 0xFF000000);
  else if (g.fishing) drawTextC("Waiting for a bite...", W / 2, H / 2 + 50, 0xFFd8e8f0, 1, 0xFF000000);
  if (g.fade > 0) frect(0, 0, W, H, withA(0x000000, (int)(255 * clampf(g.fade, 0, 1))));
  if (!hoverTip.empty() && g.modal == M_NONE) { int w = textW(hoverTip) + 8, x = clampi((int)IN.mx + 8, 2, W - w - 2), y = clampi((int)IN.my - 14, 2, H - 14); frect(x, y, w, 11, 0xF01b1420); srect(x, y, w, 11, 0xFF8a6aa0); drawText(hoverTip, x + 4, y + 2, 0xFFf6eee0); }
  if (g.modal == M_NONE && IN.mouseOn && !IN.k(K_SHIFT) && false) {}
}

/* ---------------- inventory & crafting ---------------- */
inline void invClick(Game& g, int i) { Slot& s = g.inv[i]; if (cursor.id && s.id == cursor.id && ITEMS[s.id].st > 1) { int k = std::min(cursor.n, ITEMS[s.id].st - s.n); s.n += k; cursor.n -= k; if (!cursor.n) cursor = Slot(); } else std::swap(s, cursor); Audio::play(S_TICK, 0.5f); }
inline void drawInventory(Game& g) {
  int W = g.viewW, H = g.viewH; int pw = 426, ph = 214, px = (W - pw) / 2, py = (H - ph) / 2 - 6; panel(px, py, pw, ph, "Bag & Crafting");
  int gx = px + 10, gy = py + 26; drawText("Backpack", gx, gy - 2, 0xFFcfc0e8); for (int i = 0; i < 32; i++) { int x = gx + (i % 8) * 20, y = gy + 10 + (i / 8) * 20 + (i >= 8 ? 4 : 0); drawSlot(g, x, y, g.inv[i], i == g.sel); if (clicked(x, y, 18, 18)) { invClick(g, i); } else if (hov(x, y, 18, 18) && IN.mhit[2] && g.inv[i].id) { const ItemDef& d = ITEMS[g.inv[i].id]; if (d.kind == K_ARMOR) { std::swap(g.armor, g.inv[i]); Audio::play(S_PLACE, 0.5f); } else if (d.food) { g.sel = i < 8 ? i : g.sel; } else { g.dropItem(g.inv[i].id, g.inv[i].n, g.player->x, g.player->y); g.inv[i] = Slot(); } } }
  int ax = gx, ay = gy + 108; drawText("Armor", ax, ay, 0xFFcfc0e8); slotBox(ax + 34, ay - 5, false); if (g.armor.id) blit(ART.icon[g.armor.id], ax + 35, ay - 4); if (clicked(ax + 34, ay - 5, 18, 18)) { std::swap(g.armor, cursor); if (cursor.id && ITEMS[cursor.id].kind != K_ARMOR) { std::swap(g.armor, cursor); } }
  drawText(fmt("Coins %d", g.coins), ax + 70, ay, 0xFFf2c24a); drawText("Right-click: equip / drop", ax, ay + 14, 0xFF8a7aa0); drawText("Q: drop selected", ax, ay + 24, 0xFF8a7aa0);
  if (cursor.id) { blit(ART.icon[cursor.id], (int)IN.mx - 8, (int)IN.my - 8); if (cursor.n > 1) drawText(std::to_string(cursor.n), (int)IN.mx + 4, (int)IN.my + 2, 0xFFffffff, 1, 0xFF000000); if (IN.mhit[2] && !hov(gx, gy, 160, 100)) { g.dropItem(cursor.id, cursor.n, g.player->x, g.player->y); cursor = Slot(); } }
  // crafting
  int cx = px + 186, cy = py + 24, cw = pw - 196, ch = ph - 32; drawText("Crafting", cx, cy - 2, 0xFFcfc0e8); std::string near; const char* sts[] = {"bench", "furnace", "anvil", "fire", "pot"}; for (auto s : sts) if (g.stationNear(s)) near += std::string(near.empty() ? "" : ", ") + stationName(s); drawText(near.empty() ? "Hands only" : near, cx + 50, cy - 2, 0xFF8ae0a0);
  std::vector<int> order; for (int i = 0; i < (int)RECIPES.size(); i++) order.push_back(i); std::stable_sort(order.begin(), order.end(), [&](int a, int b) { return g.canCraft(RECIPES[a]) > g.canCraft(RECIPES[b]); });
  int rowH = 20, visible = (ch - 12) / rowH; if (IN.mouseOn && hov(cx, cy + 8, cw, ch - 8)) craftScroll = clampf(craftScroll - IN.wheel * 1.f, 0, (float)std::max(0, (int)order.size() - visible)); int start = (int)craftScroll; frect(cx, cy + 8, cw, ch - 10, 0xFF150f1c);
  for (int k = 0; k < visible; k++) { int ri = start + k; if (ri >= (int)order.size()) break; const Recipe& r = RECIPES[order[ri]]; bool can = g.canCraft(r); int y = cy + 10 + k * rowH; bool hv = hov(cx, y, cw, rowH - 1); frect(cx + 1, y, cw - 2, rowH - 1, can ? (hv ? 0xFF4a3a62 : 0xFF2e2440) : 0xFF1e1828); blit(ART.icon[itm(r.out)], cx + 3, y + 2); std::string nm = ITEMS[itm(r.out)].name + (r.n > 1 ? fmt(" x%d", r.n) : ""); drawText(nm, cx + 22, y + 2, can ? 0xFFffffff : 0xFF8a8298, 1, 0xFF000000);
    int ix = cx + 22; std::string st = r.at ? stationName(r.at) : ""; if (r.at) drawText(std::string("@") + st, cx + cw - textW(std::string("@") + st) - 4, y + 2, g.stationNear(r.at) ? 0xFF8ae0a0 : 0xFFa08898); for (auto& in : r.in) { int have = g.count(itm(in.first)); blitScaled(ART.icon[itm(in.first)], ix, y + 10, 8, 8); std::string t = fmt("%d/%d", have, in.second); drawText(t, ix + 10, y + 10, have >= in.second ? 0xFFa8f0a8 : 0xFFf08a8a); ix += 13 + textW(t) + 3; }
    if (clicked(cx, y, cw, rowH - 1) && can) { g.craft(r); } }
  if ((int)order.size() > visible) { int bh = ch - 14; frect(cx + cw - 3, cy + 10, 2, bh, 0xFF2a2038); int th = std::max(8, bh * visible / (int)order.size()); frect(cx + cw - 3, cy + 10 + (int)((bh - th) * (craftScroll / std::max(1, (int)order.size() - visible))), 2, th, 0xFFf6b8ca); }
  if (!hoverTip.empty()) { int w = textW(hoverTip) + 8, x = clampi((int)IN.mx + 8, 2, W - w - 2), y = clampi((int)IN.my - 14, 2, H - 14); frect(x, y, w, 11, 0xF01b1420); srect(x, y, w, 11, 0xFF8a6aa0); drawText(hoverTip, x + 4, y + 2, 0xFFf6eee0); }
}
inline void closeInv(Game& g) { if (cursor.id) { int left = g.add(cursor.id, cursor.n); if (left) g.dropItem(cursor.id, left, g.player->x, g.player->y); cursor = Slot(); } g.modal = M_NONE; }

/* ---------------- trade, chest, dialogue ---------------- */
static const char* STOCK[] = {"wheat_seeds", "tomato_seeds", "pumpkin_seeds", "rice_seeds", "carrot", "bread", "rope", "torch", "arrow", "dog_treat", "rod", "shears", "bucket", "can", "hoe_wood", "sapling", "leather", "wool", "stick", "flint"};
inline void drawTrade(Game& g) {
  int W = g.viewW, H = g.viewH, pw = 300, ph = 200, px = (W - pw) / 2, py = (H - ph) / 2; panel(px, py, pw, ph, "Market stall"); drawText(fmt("Coins: %d", g.coins), px + pw - 80, py + 6, 0xFFf2c24a);
  if (button(px + 10, py + 22, 60, 14, "Buy", true, tradeTab == 0 ? 0xFF6a4a8a : 0xFF3a2a52)) tradeTab = 0; if (button(px + 74, py + 22, 60, 14, "Sell", true, tradeTab == 1 ? 0xFF6a4a8a : 0xFF3a2a52)) tradeTab = 1;
  int y0 = py + 42; if (tradeTab == 0) { int n = sizeof(STOCK) / sizeof(STOCK[0]); for (int i = 0; i < n; i++) { int cx = px + 10 + (i % 2) * 144, cy = y0 + (i / 2) * 15; int id = itm(STOCK[i]); int price = std::max(1, (int)std::round(ITEMS[id].value * 1.7f)); bool can = g.coins >= price; bool hv = hov(cx, cy, 140, 14); frect(cx, cy, 140, 14, hv && can ? 0xFF4a3a62 : 0xFF2a2038); blit(ART.icon[id], cx, cy - 1, false); drawText(ITEMS[id].name, cx + 18, cy + 3, can ? 0xFFffffff : 0xFF8a8298); drawText(fmt("%dc", price), cx + 136 - textW(fmt("%dc", price)), cy + 3, can ? 0xFFf2c24a : 0xFF8a7a50); if (clicked(cx, cy, 140, 14)) { if (can && g.add(id, 1) == 0) { g.coins -= price; Audio::play(S_COIN, 0.7f); } else Audio::play(S_ERROR, 0.5f); } } }
  else { int shown = 0; for (int i = 0; i < 32; i++) { Slot& s = g.inv[i]; if (!s.id) continue; int cx = px + 10 + (shown % 2) * 144, cy = y0 + (shown / 2) * 15; shown++; if (cy > py + ph - 20) break; const ItemDef& d = ITEMS[s.id]; int price = std::max(d.value / 2, 1); if (d.value <= 0) price = 0; bool hv = hov(cx, cy, 140, 14); frect(cx, cy, 140, 14, hv ? 0xFF4a3a62 : 0xFF2a2038); blit(ART.icon[s.id], cx, cy - 1); drawText(d.name + (s.n > 1 ? fmt(" x%d", s.n) : ""), cx + 18, cy + 3, 0xFFffffff); drawText(fmt("%dc", price), cx + 136 - textW(fmt("%dc", price)), cy + 3, 0xFFf2c24a); if (clicked(cx, cy, 140, 14)) { g.coins += price; if (--s.n <= 0) s = Slot(); Audio::play(S_COIN, 0.7f); } } if (!shown) drawText("Nothing to sell.", px + 10, y0, 0xFF8a7aa0); }
  if (button(px + pw - 62, py + ph - 20, 54, 14, "Close")) g.modal = M_NONE;
}
inline void drawChest(Game& g) {
  int W = g.viewW, H = g.viewH, pw = 252, ph = 190, px = (W - pw) / 2, py = (H - ph) / 2; panel(px, py, pw, ph, "Chest"); auto& ch = g.world.chests[g.chestTile]; if (ch.size() < 20) ch.resize(20); drawText("Chest", px + 10, py + 22, 0xFFcfc0e8);
  for (int i = 0; i < 20; i++) { int x = px + 10 + (i % 10) * 20, y = py + 32 + (i / 10) * 20; drawSlot(g, x, y, ch[i], false); if (clicked(x, y, 18, 18)) { Slot& s = ch[i]; if (cursor.id && s.id == cursor.id && ITEMS[s.id].st > 1) { int k = std::min(cursor.n, ITEMS[s.id].st - s.n); s.n += k; cursor.n -= k; if (!cursor.n) cursor = Slot(); } else std::swap(s, cursor); Audio::play(S_TICK, 0.5f); } }
  drawText("Backpack", px + 10, py + 78, 0xFFcfc0e8); for (int i = 0; i < 32; i++) { int x = px + 10 + (i % 10) * 20 - 0, y = py + 90 + (i / 10) * 20; if (i % 10 >= 10) continue; drawSlot(g, x, y, g.inv[i], i == g.sel); if (clicked(x, y, 18, 18)) invClick(g, i); }
  if (cursor.id) { blit(ART.icon[cursor.id], (int)IN.mx - 8, (int)IN.my - 8); if (cursor.n > 1) drawText(std::to_string(cursor.n), (int)IN.mx + 4, (int)IN.my + 2, 0xFFffffff, 1, 0xFF000000); }
  if (button(px + pw - 62, py + ph - 18, 54, 14, "Close")) { closeInv(g); }
}
inline void buildDialog(Game& g, Ent* e, Village*& v, Nation*& n) { v = g.villageById(e->vid); n = v ? &g.nation(v) : nullptr; }
inline void drawDialog(Game& g) {
  Ent* e = g.talkEnt; if (!e) { g.modal = M_NONE; return; } int W = g.viewW, H = g.viewH, pw = 300, ph = 176, px = (W - pw) / 2, py = (H - ph) / 2; Village* v; Nation* n; buildDialog(g, e, v, n); if (!n) { g.modal = M_NONE; return; }
  panel(px, py, pw, ph, (e->name + ", chief of " + n->name).c_str(), 0xFFffe0a0); drawText(fmt("Temper: %s    Standing: %d    Status: %s", n->temper.c_str(), (int)n->rel, n->status.c_str()), px + 10, py + 22, 0xFFb8a8d0);
  std::string txt = g.dialogText; std::string cur, word; int yy = py + 36; auto flush = [&]() { if (word.empty()) return; if (textW(cur + " " + word) > pw - 24 && !cur.empty()) { drawText(cur, px + 12, yy, 0xFFf6eee0); yy += 10; cur = word; } else cur += (cur.empty() ? "" : " ") + word; word.clear(); }; for (char c : txt) { if (c == ' ') flush(); else word += c; } flush(); drawText(cur, px + 12, yy, 0xFFf6eee0);
  int by = py + 74; auto opt = [&](const std::string& l, bool en, std::function<void()> fn) { if (button(px + 12, by, pw - 24, 14, l, en)) fn(); by += 17; };
  opt("Greetings", true, [&] { g.dialogText = n->temper == "warlike" ? "Strength decides everything out here." : n->temper == "greedy" ? "Coins keep the roads safe. Remember that." : n->temper == "peaceful" ? "May your fields grow tall and your nights be quiet." : n->temper == "proud" ? "Our clan has stood for generations." : "A fair word for a fair traveller."; });
  bool hasTask = n->task >= 0; std::string tl = hasTask ? fmt("Deliver %d x %s (have %d)", n->taskN, ITEMS[n->taskItem].name.c_str(), g.count(n->taskItem)) : "Ask for a task";
  opt(tl, !hasTask || g.count(n->taskItem) >= n->taskN, [&] { if (!hasTask) { static const char* T[] = {"wood", "stone", "wheat", "raw_fish", "coal", "iron", "bread", "leather"}; n->taskItem = itm(T[irand(0, 7)]); n->taskN = irand(4, 10); n->task = 1; g.dialogText = fmt("Bring me %d %s and I will reward you.", n->taskN, ITEMS[n->taskItem].name.c_str()); } else { g.remove(n->taskItem, n->taskN); int rw = 25 + n->taskN * 4; g.coins += rw; n->rel = std::min(100.f, n->rel + 12); n->task = -1; g.stats["tasks"]++; g.dialogText = fmt("Well done. Take %d coins.", rw); Audio::play(S_COIN, 0.8f); } });
  opt("Gift 20 coins (+10 standing)", g.coins >= 20, [&] { g.coins -= 20; n->rel = std::min(100.f, n->rel + 10); g.dialogText = "A generous gift. I will remember it."; Audio::play(S_COIN, 0.8f); });
  opt(n->status == "ally" ? "Allied - they fight beside you on Blood Moons" : "Propose alliance (100 coins, standing 50+)", n->status == "neutral" && n->rel >= 50 && g.coins >= 100, [&] { g.coins -= 100; n->status = "ally"; g.banner("Alliance formed", n->name + " will aid Hanomi."); Audio::play(S_LEVELUP, 0.8f); g.dialogText = "Together, then. Our soldiers will march when the moon turns red."; });
  opt(n->status == "vassal" ? "They pay tribute each dawn" : "Claim this village (guards must be defeated)", n->status != "vassal" && n->status != "home", [&] { if (g.conquer(v)) { g.dialogText = "The village is yours."; } else g.dialogText = "My guards still stand. You will not take us."; });
  if (button(px + pw - 62, py + ph - 20, 54, 14, "Leave")) g.modal = M_NONE;
}

/* ---------------- map / realm / goals ---------------- */
inline void drawMap(Game& g) {
  int W = g.viewW, H = g.viewH; const int S = 128, SC = 3; int pw = S + 150, ph = S + 36, px = (W - pw) / 2, py = (H - ph) / 2; panel(px, py, pw, ph, "Map"); int ptx = g.player->tx(), pty = g.player->ty();
  if (mapImg.w != S || std::abs(ptx - mapCx) > 12 || std::abs(pty - mapCy) > 12 || REN.time - mapT > 6) { mapT = REN.time; mapCx = ptx; mapCy = pty; mapImg.alloc(S, S); for (int j = 0; j < S; j++) for (int i = 0; i < S; i++) { int tx = ptx + (i - S / 2) * SC, ty = pty + (j - S / 2) * SC; int bi = g.world.biomeAt(tx, ty); static const u32 BC[] = {0xFF2a6aa0, 0xFF4aa8cf, 0xFFe6d092, 0xFF8c8a94, 0xFFe9f1f8, 0xFF5a7c48, 0xFF4c8a3c, 0xFFf2a8c0, 0xFF6cab4c}; mapImg.p[j * S + i] = BC[bi]; } }
  blit(mapImg, px + 8, py + 24); srect(px + 7, py + 23, S + 2, S + 2, 0xFF8a6aa0); auto dot = [&](float wx, float wy, u32 c, int sz = 2) { int dx = (int)((wx / TS - ptx) / SC) + S / 2, dy = (int)((wy / TS - pty) / SC) + S / 2; if (dx >= 1 && dy >= 1 && dx < S - 1 && dy < S - 1) { frect(px + 8 + dx - sz / 2, py + 24 + dy - sz / 2, sz, sz, c); } };
  for (auto& kv : g.world.villages) if (kv.second) { Village* v = kv.second.get(); Nation& n = g.nation(v); if (!v->home && !n.met) continue; u32 c = v->home ? 0xFFf6b8ca : n.status == "war" ? 0xFFe8484a : n.status == "vassal" ? 0xFFf2c24a : n.status == "ally" ? 0xFF8ae070 : 0xFFffffff; dot(v->x * TS, v->y * TS, c, 4); } dot(g.spawnX, g.spawnY, 0xFFffe060, 3); dot(g.player->x, g.player->y, ((int)(REN.time * 3) & 1) ? 0xFFff4040 : 0xFFffffff, 3);
  int tx = px + S + 18, ty = py + 24; drawText("Legend", tx, ty, 0xFFcfc0e8); const char* L[] = {"Hanomi", "Neutral clan", "Ally", "Vassal", "At war", "You"}; u32 C[] = {0xFFf6b8ca, 0xFFffffff, 0xFF8ae070, 0xFFf2c24a, 0xFFe8484a, 0xFFff4040}; for (int i = 0; i < 6; i++) { frect(tx, ty + 14 + i * 11, 5, 5, C[i]); drawText(L[i], tx + 9, ty + 12 + i * 11, 0xFFe8dcf0); }
  drawText(fmt("Position %d, %d", ptx, pty), tx, ty + 86, 0xFFb8a8d0); drawText(GROUND_NAME[g.world.ground(ptx, pty)], tx, ty + 97, 0xFFb8a8d0); drawText("M / Esc: close", tx, ty + 112, 0xFF8a7aa0);
}
inline void drawRealm(Game& g) {
  int W = g.viewW, H = g.viewH, pw = 330, ph = 220, px = (W - pw) / 2, py = (H - ph) / 2; panel(px, py, pw, ph, "Realm of Hanomi", 0xFFf6b8ca); auto army = g.armyList(); drawText(fmt("Army %d / %d", (int)army.size(), g.armyCap()), px + 10, py + 22, 0xFFf6b8ca); drawText(fmt("Coins %d", g.coins), px + 100, py + 22, 0xFFf2c24a);
  if (button(px + 150, py + 18, 80, 13, "Spearman 40c", g.coins >= 40)) g.recruit(false); if (button(px + 234, py + 18, 86, 13, "Archer 55c", g.coins >= 55)) g.recruit(true);
  if (button(px + 10, py + 34, 100, 13, army.empty() ? "No soldiers" : "Hold / follow all", !army.empty())) { bool anyHold = false; for (auto* e : army) if (e->state == 9) anyHold = true; for (auto* e : army) e->state = anyHold ? 0 : 9; }
  drawText("Clans you have met", px + 10, py + 54, 0xFFcfc0e8); int y = py + 66; int n = 0; for (auto& kv : g.nations) { Nation& nt = kv.second; if (nt.status == "home" || !nt.met) continue; if (y > py + ph - 40) break; frect(px + 10, y, pw - 20, 20, 0xFF2a2038); frect(px + 12, y + 2, 4, 16, 0xFF000000 | nt.color); drawText(nt.name + " - " + nt.ruler, px + 22, y + 3, 0xFFffffff); u32 sc = nt.status == "war" ? 0xFFe8484a : nt.status == "ally" ? 0xFF8ae070 : nt.status == "vassal" ? 0xFFf2c24a : 0xFFb8a8d0; drawText(cap1(nt.status), px + pw - 20 - textW(cap1(nt.status)), y + 3, sc); drawText(cap1(nt.temper) + ", standing " + std::to_string((int)nt.rel), px + 22, y + 12, 0xFF9a8ab0); y += 22; n++; }
  if (!n) drawText("You have not met any neighbouring clans yet. Follow the roads.", px + 10, y, 0xFF8a7aa0); drawText("Speak to a chief to trade favours, ally, or claim a village.", px + 10, py + ph - 30, 0xFF8a7aa0); if (button(px + pw - 62, py + ph - 20, 54, 14, "Close")) g.modal = M_NONE;
}
inline void drawGoals(Game& g) {
  int W = g.viewW, H = g.viewH, pw = 250, ph = 250, px = (W - pw) / 2, py = (H - ph) / 2; panel(px, py, pw, ph, "Journal"); for (int i = 0; i < NGOALS; i++) { int y = py + 22 + i * 10; bool done = i < g.goal, cur = i == g.goal; if (cur) frect(px + 6, y - 1, pw - 12, 10, 0xFF3a2a52); drawText(done ? "x" : cur ? ">" : "-", px + 10, y, done ? 0xFF8ae070 : cur ? 0xFFfff2c0 : 0xFF6a6280); drawText(GOALS[i].t, px + 22, y, done ? 0xFF8a8298 : cur ? 0xFFffffff : 0xFF8a8298); drawText(fmt("%dc", GOALS[i].r), px + pw - 36, y, done ? 0xFF6a6a50 : 0xFFf2c24a); }
  if (button(px + pw - 62, py + ph - 16, 54, 12, "Close")) g.modal = M_NONE;
}
/* ---------------- pause / settings / help / death ---------------- */
static bool fullscreenToggleReq = false;
inline void slider(int x, int y, int w, float& v, const char* label) { drawText(label, x, y, 0xFFe8dcf0); int sx = x + 80; frect(sx, y + 2, w, 3, 0xFF3a2a52); frect(sx, y + 2, (int)(w * v), 3, 0xFFf6b8ca); fcircle((float)sx + w * v, (float)y + 3.5f, 3, HEX(0xffffff)); if (IN.mdown[0] && hov(sx - 4, y - 3, w + 8, 12)) { v = clampf((IN.mx - sx) / w, 0, 1); } drawText(fmt("%d%%", (int)(v * 100)), sx + w + 8, y, 0xFFb8a8d0); }
inline void drawSettings(Game& g) {
  int W = g.viewW, H = g.viewH, pw = 250, ph = 164, px = (W - pw) / 2, py = (H - ph) / 2; panel(px, py, pw, ph, "Settings"); slider(px + 14, py + 28, 90, SET.music, "Music"); slider(px + 14, py + 44, 90, SET.sfx, "Effects"); Audio::setVolumes(SET.music, SET.sfx);
  if (button(px + 14, py + 62, 100, 14, fmt("Zoom: %+d", SET.zoom))) SET.zoom = SET.zoom >= 2 ? -2 : SET.zoom + 1; if (button(px + 120, py + 62, 116, 14, SET.shake ? "Screen shake: on" : "Screen shake: off")) SET.shake = !SET.shake;
  if (button(px + 14, py + 80, 100, 14, SET.minimap ? "Minimap: on" : "Minimap: off")) SET.minimap = !SET.minimap; if (button(px + 120, py + 80, 116, 14, SET.showFps ? "FPS counter: on" : "FPS counter: off")) SET.showFps = !SET.showFps;
  if (button(px + 14, py + 98, 100, 14, "Fullscreen (F11)")) fullscreenToggleReq = true; drawText("Settings apply instantly.", px + 14, py + 120, 0xFF8a7aa0);
  if (button(px + pw / 2 - 30, py + ph - 22, 60, 14, "Back")) g.modal = fromTitle ? M_TITLE : M_PAUSE;
}
inline void drawHelp(Game& g) {
  int W = g.viewW, H = g.viewH, pw = 340, ph = 214, px = (W - pw) / 2, py = (H - ph) / 2; panel(px, py, pw, ph, "How to play"); const char* L[] = {"WASD / arrows ..... move       Shift ..... sprint", "Space ............. dodge roll (brief invulnerability)", "Left click / J ..... use tool, attack, plant, place", "Right click / E .... interact (chests, doors, people, pets)", "1-8 / wheel ........ hotbar      Q ... drop item", "Tab ... bag & crafting    M ... map    N ... realm", "G ... journal    Esc ... pause    F11 ... fullscreen    F2 ... screenshot", "", "Chop trees, mine stone, craft a workbench, farm with a hoe", "(till soil, plant seeds, water them), fish with a rod,", "tame the dog with treats, raise animals, cook at fires.", "Every 5th night the Blood Moon brings a zombie raid.", "Meet neighbouring clans: trade, ally, or conquer them", "and raise your own army. Keep a torch lit at night."};
  for (int i = 0; i < 14; i++) drawText(L[i], px + 12, py + 24 + i * 11, i < 7 ? 0xFFe8dcf0 : 0xFFb8c8e0); if (button(px + pw / 2 - 30, py + ph - 20, 60, 14, "Back")) g.modal = fromTitle ? M_TITLE : M_PAUSE;
}
inline void drawPause(Game& g) {
  int W = g.viewW, H = g.viewH, pw = 140, ph = 138, px = (W - pw) / 2, py = (H - ph) / 2; panel(px, py, pw, ph, "Paused"); int y = py + 24; auto B = [&](const char* l) { bool r = button(px + 14, y, pw - 28, 15, l); y += 19; return r; };
  if (B("Resume")) g.modal = M_NONE; if (B("Save game")) g.saveGame(); if (B("Settings")) { g.modal = M_SETTINGS; fromTitle = false; } if (B("How to play")) { g.modal = M_HELP; fromTitle = false; } if (B("Save & quit to title")) { g.saveGame(true); g.modal = M_TITLE; titleT = 0; g.hasSave = true; }
}
inline void drawDead(Game& g) {
  int W = g.viewW, H = g.viewH; frect(0, 0, W, H, 0x90300810); drawTextC("You fell", W / 2, H / 2 - 40, 0xFFffd0d8, 3, 0xFF200810); drawTextC("Your satchel waits where you fell.", W / 2, H / 2 - 8, 0xFFe8c8d0, 1, 0xFF000000); if (g.lastDeathCoins) drawTextC(fmt("%d coins inside.", g.lastDeathCoins), W / 2, H / 2 + 4, 0xFFf2c24a, 1, 0xFF000000); if (button(W / 2 - 40, H / 2 + 22, 80, 16, "Wake at home")) g.respawn();
}

/* ---------------- koi-pond title screen ---------------- */
struct Koi { float x, y, a, sp, tx, ty; u32 c1, c2, c3; int pat; float px[9], py[9]; float ph; };
static std::vector<Koi> kois; static bool koiInit = false; static std::vector<Particle> tpet; static std::vector<std::array<float, 4>> ripples; static Ent* titleDog = nullptr; static AnimalRig dogRig; static AniState dogState;
inline void drawKoi(Koi& k, int W, int H) {
  static const float R[9] = {2.7f, 3.3f, 3.4f, 3.0f, 2.5f, 2.0f, 1.5f, 1.0f, 0.6f};
  for (int i = 0; i < 9; i++) { float t = k.ph; float sw = std::sin(t * 4 - i * 0.7f) * i * 0.18f; float nx = -std::sin(k.a), ny = std::cos(k.a); (void)nx; (void)ny; }
  for (int pass = 0; pass < 2; pass++) { // shadow then body
    float off = pass == 0 ? 5.f : 0; for (int i = 0; i < 9; i++) { float r = R[i] * 1.15f; u32 col; if (pass == 0) col = withA(0x0a1a30, 70); else { u32 base = k.c1; if (k.pat == 1 && (i == 2 || i == 3 || i == 6)) base = k.c2; if (k.pat == 2 && (i >= 1 && i <= 3)) base = k.c2; if (k.pat == 3 && i % 3 == 1) base = k.c2; if (i == 1 && k.pat == 0) base = k.c3; col = base; }
      if (pass == 1 && i >= 5) { /* tail: translucent */ col = withA(k.c1, 200 - (i - 5) * 30); }
      float cx = k.px[i], cy = k.py[i] + off; if (pass == 0) fcircle(cx, cy, r, col); else { fcircle(cx, cy, r, ramp(col, -0.8f)); fcircle(cx - 0.3f, cy - 0.4f, r * 0.8f, col); if (i > 0 && i < 5) putpx((int)cx - 1, (int)cy - 1, ramp(col, 1.3f)); } }
    if (pass == 1) { putpx((int)k.px[0] + (int)std::round(std::cos(k.a) * 1.6f), (int)k.py[0] + (int)std::round(std::sin(k.a) * 1.6f) - 1, 0xFF14101a); float fa = k.a + 1.9f; for (int s = -1; s <= 1; s += 2) { float ax = k.px[2] + std::cos(k.a + s * 1.7f) * 3.5f, ay = k.py[2] + std::sin(k.a + s * 1.7f) * 3.5f; line((int)k.px[2], (int)k.py[2], (int)ax, (int)ay, withA(k.c1, 180)); (void)fa; } }
  }
}
inline void drawTitle(Game& g, float dt) {
  int W = g.viewW, H = g.viewH; titleT += dt; REN.time += dt; Img& sc = REN.screen; if (sc.w != W || sc.h != H) sc.alloc(W, H); T = &sc;
  if (!koiInit) { koiInit = true; RNG r(5); static const u32 C1[] = {0xf6f0e8, 0xf08a3a, 0xf2c24a, 0x2a2a34, 0xf6f0e8, 0xe8484a}, C2[] = {0xe8602a, 0xf6f0e8, 0xf6f0e8, 0xf6f0e8, 0x2a2a34, 0xf6f0e8}; for (int i = 0; i < 9; i++) { Koi k{}; k.x = r.r(40, W - 40); k.y = r.r(60, H - 40); k.a = r.r(0, TAU); k.sp = r.r(14, 26); k.c1 = HEX(C1[i % 6]); k.c2 = HEX(C2[i % 6]); k.c3 = HEX(0xe8484a); k.pat = i % 4; k.tx = k.x; k.ty = k.y; k.ph = r.r(0, 6); for (int j = 0; j < 9; j++) { k.px[j] = k.x; k.py[j] = k.y; } kois.push_back(k); } }
  // water bg
  for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) { float sh = 0.55f + 0.35f * std::sin(x * 0.01f + y * 0.012f); u32 c = Renderer::waterCol(G_WATER, x + 400, y + 300, titleT, sh, 0, x & 15, y & 15); float v = 1.f - 0.45f * (((x - W / 2.f) * (x - W / 2.f)) / (W * W * 0.25f) + ((y - H / 2.f) * (y - H / 2.f)) / (H * H * 0.25f)) * 0.5f; sc.p[(size_t)y * W + x] = shadec(c, clampf(v, 0.5f, 1.f)); }
  // lily pads & blossoms
  for (int i = 0; i < 14; i++) { float lx = std::fmod(hash2(i, 1, 9) * W * 1.2f + titleT * 0.6f * (0.5f + hash2(i, 2, 9)), W * 1.1f) - 20, ly = hash2(i, 3, 9) * H; int r = 5 + (int)(hash2(i, 4, 9) * 4); fcircle(lx, ly + 2, (float)r, withA(0x0a2a3a, 80)); fcircle(lx, ly, (float)r, HEX(0x3e9a48)); fcircle(lx - 1, ly - 1, r * 0.7f, HEX(0x4aaa52)); line((int)lx, (int)ly, (int)lx + r, (int)ly - 1, HEX(0x2a7a3a)); if (i % 3 == 0) { fcircle(lx - 1, ly - 1, 2.2f, HEX(0xf6b8ca)); putpx((int)lx - 1, (int)ly - 1, HEX(0xfff0f4)); } }
  // koi
  for (auto& k : kois) { k.ph += dt; if (dist2f(k.x, k.y, k.tx, k.ty) < 100 || frand() < dt * 0.1f) { if (frand() < 0.8f) { k.tx = frandr(20, W - 20); k.ty = frandr(40, H - 20); } } float want = std::atan2(k.ty - k.y, k.tx - k.x), da = std::atan2(std::sin(want - k.a), std::cos(want - k.a)); k.a += clampf(da, -1.5f * dt, 1.5f * dt) + std::sin(k.ph * 3) * 0.4f * dt; float sp = k.sp * (0.7f + 0.3f * std::sin(k.ph * 2)); k.x += std::cos(k.a) * sp * dt; k.y += std::sin(k.a) * sp * dt; if (k.x < -20) k.x = W + 10; if (k.x > W + 20) k.x = -10; if (k.y < 30) k.ty = H / 2; if (k.y > H - 10) k.ty = H / 2;
    k.px[0] = k.x; k.py[0] = k.y; for (int i = 1; i < 9; i++) { float dx = k.px[i] - k.px[i - 1], dy = k.py[i] - k.py[i - 1], d = std::hypot(dx, dy) + 0.001f; float want2 = 3.0f - i * 0.12f; float sw = std::sin(k.ph * 5 - i * 0.8f) * 0.35f * i * 0.25f; k.px[i] = k.px[i - 1] + dx / d * want2 + -dy / d * sw; k.py[i] = k.py[i - 1] + dy / d * want2 + dx / d * sw; }
    for (auto& r : ripples) { float d = std::hypot(k.x - r[0], k.y - r[1]); if (r[3] < 0.3f && d < 90) { k.tx = r[0]; k.ty = r[1]; } } }
  for (auto& k : kois) drawKoi(k, W, H);
  // ripples (from clicks)
  for (auto& r : ripples) { r[2] += dt; r[3] += dt; float rr = r[2] * 30; for (int ring = 0; ring < 3; ring++) { float q = rr - ring * 7; if (q <= 0) continue; int n = (int)(q * 3); for (int k = 0; k < n; k++) { float a = k * TAU / n; putpx((int)(r[0] + std::cos(a) * q), (int)(r[1] + std::sin(a) * q * 0.55f), withA(0xFFFFFF, (int)(200 * std::max(0.f, 1 - r[2] / 2.2f)))); } } } ripples.erase(std::remove_if(ripples.begin(), ripples.end(), [](const std::array<float, 4>& r) { return r[2] > 2.2f; }), ripples.end());
  if (IN.mhit[0] && g.modal == M_TITLE && titleT > 0.2f && !(IN.mx > W / 2 - 60 && IN.mx < W / 2 + 60 && IN.my > H / 2 - 10)) { ripples.push_back({IN.mx, IN.my, 0, 0}); Audio::play(S_WATER, 0.5f, frandr(0.9f, 1.3f)); for (int i = 0; i < 6; i++) tpet.push_back({IN.mx + frandr(-8, 8), IN.my + frandr(-6, 6), 0, frandr(-6, 6), frandr(-4, 4), 0, 0, 1.2f, 1.2f, 1, 0xFFf2e0b0, 0xFFf2e0b0, 0}); }
  // falling petals
  if (frand() < dt * 9) tpet.push_back({frandr(-20, (float)W), -4.f, 0, 0, frandr(10, 22), 0, 0, 12.f, 12.f, frand() * 6, 0xFFf6b8ca, 0xFFd8789a, 3}); for (auto& p : tpet) { p.life -= dt; p.x += (p.kind == 3 ? std::sin(titleT * 2 + p.s) * 10 + 8 : p.vx) * dt; p.y += p.vy * dt; if (p.kind == 3) { putpx((int)p.x, (int)p.y, p.c); putpx((int)p.x + 1, (int)p.y, p.c2); } else putpx((int)p.x, (int)p.y, withA(p.c, (int)(255 * clampf(p.life, 0, 1)))); } tpet.erase(std::remove_if(tpet.begin(), tpet.end(), [&](const Particle& p) { return p.life <= 0 || p.y > H + 4; }), tpet.end());
  // vignette
  for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) { float dx = (x - W / 2.f) / (W / 2.f), dy = (y - H / 2.f) / (H / 2.f); float d = dx * dx * 0.6f + dy * dy; if (d > 0.5f) { u32& p = sc.p[(size_t)y * W + x]; float k = clampf((d - 0.5f) * 0.5f, 0, 0.6f); p = mixc(p, HEX(0x1b1420), k); } }
  for (int y = 0; y < H / 2 + 20; y++) { for (int x = 0; x < W; x++) { u32& p = sc.p[(size_t)y * W + x]; p = mixc(p, HEX(0x1b1420), 0.35f * (1 - y / (H / 2.f + 20))); } }
  // logo
  const char* name = "Hanomi"; int lw = 0; for (int i = 0; i < 6; i++) lw += 7 * 7; int lx = W / 2 - textW(name, 6) / 2; for (int i = 0; i < 6; i++) { std::string ch(1, name[i]); float bob = std::sin(titleT * 2 + i * 0.7f) * 2.f; int cx = lx; for (int j = 0; j < i; j++) cx += textW(std::string(1, name[j]), 6) + 6; u32 c = mixc(HEX(0xffd0e0), HEX(0xf08ab0), i / 5.f); drawText(ch, cx + 1, 26 + (int)bob + 2, 0xFF2a1030, 6); drawText(ch, cx, 26 + (int)bob, c, 6, 0xFF5a2a60); frect(cx + 1, 26 + (int)bob + 1, textW(ch, 6) - 2, 2, withA(0xffffff, 60)); }
  drawTextC("a sakura village survival", W / 2, 76, 0xFFf6e8f0, 1, 0xFF2a1030);
  int by = H / 2 - 8, bw = 120; int n = 0; auto B = [&](const char* l, bool en = true) { bool r = button(W / 2 - bw / 2, by + n * 19, bw, 15, l, en); n++; return r; };
  if (g.modal == M_TITLE) { if (B("Continue", g.hasSave)) { if (!g.loadGame()) g.toast("Could not load the save."); } if (B("New world")) { g.newGame((u32)(time(nullptr) * 2654435761u + (u32)(titleT * 1000))); } if (B("Settings")) { g.modal = M_SETTINGS; fromTitle = true; } if (B("How to play")) { g.modal = M_HELP; fromTitle = true; } if (B("Quit")) quitReq = true; }
  drawTextC("Click the water to call the koi", W / 2, H - 14, 0xB0e8dcf0, 1, 0xFF000000); drawText("by Nikit Hamal  -  native build", 6, H - 10, 0x90e8dcf0, 1, 0xFF000000);
  // sleeping dog
  dogState.t += dt; dogState.sleeping = true; dogState.moving = false; dogState.seed = 3; dogRig.update(dt, dogState, ANISPEC[7]); { int dx = 56, dy = H - 22; dogRig.draw(dogState, 7, dx, dy, false, false, 0, 1.f); if (std::fmod(titleT, 3.f) < 1.5f) drawText("z", dx + 14, dy - 18 - (int)(std::fmod(titleT, 3.f) * 4), 0xFFe8f0ff, 1, 0xFF000000); if (std::fmod(titleT + 1.2f, 3.f) < 1.5f) drawText("Z", dx + 20, dy - 24 - (int)(std::fmod(titleT + 1.2f, 3.f) * 4), 0xFFe8f0ff, 1, 0xFF000000); }
}
}
