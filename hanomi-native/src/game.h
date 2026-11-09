// Hanomi native — game state: entities & AI, player actions, farming/fishing/mining/building, nations, raids, time, weather, goals, saves.
#pragma once
#include "rig.h"
#include "audio.h"
#include <set>

struct InputState {
  bool down[256] = {0}, hit[256] = {0}; float mx = 0, my = 0; bool mdown[3] = {0}, mhit[3] = {0}; int wheel = 0; bool mouseOn = false; float padX = 0, padY = 0; bool padUse = false, padAlt = false, padRoll = false;
  bool k(int c) const { return down[c & 255]; } bool p(int c) const { return hit[c & 255]; }
  void endFrame() { memset(hit, 0, sizeof hit); mhit[0] = mhit[1] = mhit[2] = false; wheel = 0; padUse = padAlt = padRoll = false; }
};
static InputState IN;
enum { K_SHIFT = 16, K_SPACE = 32, K_TAB = 9, K_ESC = 27, K_ENTER = 13, K_LEFT = 37, K_UP = 38, K_RIGHT = 39, K_DOWN = 40, K_F2 = 113, K_F11 = 122, K_BACK = 8 };

struct Particle { float x, y, z, vx, vy, vz, g, life, max, s; u32 c, c2; int kind; };
struct Floater { float x, y, t; std::string text; u32 col; };
struct FXSys {
  std::vector<Particle> ps; float shake = 0, shakeT = 0, flash = 0; std::vector<Floater> fl;
  void spawn(Particle p) { if (ps.size() < 1800) ps.push_back(p); }
  void burst(float x, float y, int n, const std::vector<u32>& cols, float z = 8, float sp0 = 20, float sp1 = 60, float l0 = 0.25f, float l1 = 0.5f, float vz0 = 20, float vz1 = 60, float g = 200) {
    for (int i = 0; i < n; i++) { float a = frand() * TAU, sp = frandr(sp0, sp1); u32 c = cols[irand(0, (int)cols.size() - 1)]; float l = frandr(l0, l1); spawn({x, y, z, std::cos(a) * sp, std::sin(a) * sp * 0.6f, frandr(vz0, vz1), g, l, l, 1, c, c, 0}); }
  }
  void ring(float x, float y, float r, u32 c, float life = 0.7f) { spawn({x, y, 0, 0, 0, 0, 0, life, life, r, c, c, 1}); }
  void dust(float x, float y) { for (int i = 0; i < 2; i++) spawn({x + frandr(-3, 3), y, 1, frandr(-8, 8), frandr(-3, 3), frandr(4, 14), 0, 0.4f, 0.4f, 1.6f, 0xFFd8c8a8, 0xFFd8c8a8, 7}); }
  void floatText(float x, float y, const std::string& t, u32 c) { fl.push_back({x, y, 0.9f, t, c}); }
  void kick(float a, float t) { shake = std::max(shake, a); shakeT = std::max(shakeT, t); }
  void update(float dt) {
    for (auto& p : ps) { p.life -= dt; p.vz -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.z < 0 && p.kind != 3 && p.kind != 9) { p.z = 0; p.vz *= -0.3f; p.vx *= 0.6f; p.vy *= 0.6f; } if (p.kind == 3) { p.vx = std::sin(p.life * 5 + p.s) * 14 + 6; } }
    ps.erase(std::remove_if(ps.begin(), ps.end(), [](const Particle& p) { return p.life <= 0; }), ps.end());
    for (auto& f : fl) { f.t -= dt; f.y -= dt * 14; } fl.erase(std::remove_if(fl.begin(), fl.end(), [](const Floater& f) { return f.t <= 0; }), fl.end());
    if (shakeT > 0) shakeT -= dt; else shake = 0; if (flash > 0) flash -= dt * 2;
  }
};

enum EType { E_PLAYER, E_VILLAGER, E_SOLDIER, E_ZOMBIE, E_DOG, E_ANIMAL, E_DROP, E_ARROW };
enum Role { R_VILLAGER, R_MERCHANT, R_CHIEF, R_GUARD };
struct Nation { std::string id, name, ruler, temper; u32 color = 0; std::string status = "neutral"; float rel = 50; bool met = false; int task = -1, taskN = 0, taskItem = 0; };
struct Ent {
  int type = 0, id = 0; float x = 0, y = 0, z = 0, vz = 0, r = 4, hp = 10, maxHp = 10, speed = 40, t = 0, flash = 0, kbx = 0, kby = 0, atkCd = 0, ifr = 0, stuck = 0, bubbleT = 0, st = 0, gx = 0, gy = 0, actT = 0, actDur = 0.3f;
  bool dead = false, moving = false, swims = false, noWater = false, persist = false, inside = false, mine = false, archer = false, raid = false, owned = false, baby = false, shorn = false, angry = false;
  int dir = 0, team = 0, role = 0, state = 0, aniIdx = 0, kindLevel = 0, item = 0, n = 0, homeStruct = -1, act = 0; float deadT = 0;
  std::string kind, vid, name, bubble; std::vector<std::pair<int, int>> path; HumanRig rig; RigState rs; AnimalRig arig; AniState as; Look look;
  float homeX = 0, homeY = 0, raidX = 0, raidY = 0, love = 0, produceT = 0, milked = 0, panic = 0, wanderT = 0, pickT = 0, vx = 0, vy = 0; bool hasRaid = false; float st2 = 0, x2dir = 1; int slot = 0; float waterT = 0, sayCd = 0, shootCd = 0; int fetchState = 0; float sleepT = 0, wag = 0, hop = 0; int penX = 0, penY = 0, penW = 0, penH = 0; bool hasPen = false; float aggroT = 0;
  int tx() const { return (int)std::floor(x / TS); } int ty() const { return (int)std::floor(y / TS); }
  bool human() const { return type == E_PLAYER || type == E_VILLAGER || type == E_SOLDIER || type == E_ZOMBIE; }
};
struct Dmg { float hp; float t; };
struct Goal { const char* t; int r; };
static const Goal GOALS[] = {{"Chop a tree", 10}, {"Craft a workbench", 10}, {"Craft a wooden pickaxe", 15}, {"Mine some stone", 15}, {"Build a campfire", 15}, {"Till soil and plant a seed", 15}, {"Harvest a crop", 15}, {"Catch a fish", 15}, {"Feed the koi in Hanomi", 10}, {"Survive your first night", 20}, {"Pray at a wayside shrine", 20}, {"Find buried treasure", 20}, {"Meet a neighbouring clan", 20}, {"Complete a chief's task", 30}, {"Smelt an iron ingot", 25}, {"Recruit a soldier", 25}, {"Survive a Blood Moon", 50}, {"Forge an iron sword", 40}, {"Form an alliance", 60}, {"Claim a village for Hanomi", 100}, {"Forge the Jade katana", 150}};
constexpr int NGOALS = sizeof(GOALS) / sizeof(GOALS[0]);
struct Toast { std::string text; u32 col; float t; int icon; };
enum Modal { M_NONE, M_INV, M_MAP, M_REALM, M_GOALS, M_PAUSE, M_TRADE, M_CHEST, M_DIALOG, M_SETTINGS, M_HELP, M_TITLE, M_DEAD };

struct Settings { float music = 0.6f, sfx = 0.8f; int zoom = 0; bool shake = true, fullscreen = false, minimap = true, showFps = false; };
static Settings SET;

struct Game {
  World world; std::vector<std::unique_ptr<Ent>> ents; Ent* player = nullptr; FXSys fx; Art* art = &ART; int nextId = 1;
  float clock = DAY_LEN * (7.f / 24), playTime = 0, hitstop = 0; int day = 1; bool paused = false; int modal = M_TITLE; u32 seed = 1;
  float rain = 0, rainTarget = 0, weatherT = 300, bolt = 8, lightning = 0;
  std::map<std::string, Nation> nations; std::unordered_map<i64, Dmg> dmg; std::unordered_map<i64, float> shakeTiles;
  std::vector<Toast> toasts; std::string bannerA, bannerB; float bannerT = 0; int goal = 0; std::map<std::string, int> made; std::map<std::string, int> stats;
  int tgx = 0, tgy = 0; bool tgAim = false; float camX = 0, camY = 0; int viewW = 480, viewH = 270; int zoomScale = 4;
  bool raidOn = false; float raidT = 0; int lastHour = -1, mood = 0; float spawnT = 0, tickT = 0, saveT = 0, autoT = 0; float koiT = 0; bool hadKoiToday = false; int koiFeeds = 0, koiDay = 0;
  float fishT = 0; int fishPhase = 0; float bobX = 0, bobY = 0, fishProg = 0, fishPos = 0.5f, fishTarget = 0.5f, fishBar = 0.5f, fishBarV = 0; int fishItem = 0; bool fishing = false; float fishBiteT = 0;
  float coinsAnim = 0, waterT = 0; int hoverEnt = -1; std::string tipText; std::string saveDir = "."; bool wantQuit = false, hasSave = false, godMode = false; float screenshotReq = 0; float onsenT = 0;
  Ent* talkEnt = nullptr; int tradeMode = 0; int chestKey = 0; i64 chestTile = 0; float fade = 0; bool hurtVignette = false; float hurtT = 0; float fps = 60; int prayedBuffDay = 0;
  float spawnX = 0, spawnY = 0; bool spawnSet = false; std::string dialogText; std::vector<std::string> dialogOpts; int dialogMode = 0;

  /* ---------------- helpers ---------------- */
  float hour() const { return std::fmod(clock / DAY_LEN * 24.f, 24.f); }
  float daylight() const { float h = hour(); if (h >= 7 && h <= 18) return 1; if (h < 5 || h > 21) return 0; if (h < 7) return smoothf((h - 5) / 2); return 1 - smoothf((h - 18) / 3); }
  bool night() const { return daylight() < 0.35f; }
  bool bloodMoon() const { float h = hour(); return day % 5 == 0 && (h >= 20 || h < 5); }
  bool raining() const { return rain > 0.3f; }
  Village* home() { return world.villageForRegion(0, 0); }
  Ent* add(std::unique_ptr<Ent> e) { e->id = nextId++; Ent* p = e.get(); ents.push_back(std::move(e)); return p; }
  void toast(const std::string& s, u32 col = 0xFFe8e0f0, int icon = 0) { for (auto& t : toasts) if (t.text == s && t.t > 1) { t.t = 3.5f; return; } toasts.push_back({s, col, 3.5f, icon}); if (toasts.size() > 5) toasts.erase(toasts.begin()); }
  void banner(const std::string& a, const std::string& b = "") { bannerA = a; bannerB = b; bannerT = 4.2f; }
  void sfx(int id, float x, float y, float vol = 1, float pitch = 1) { float d = std::hypot(x - player->x, y - player->y); float v = vol * clampf(1.1f - d / 260.f, 0, 1); if (v > 0.02f) Audio::play(id, v, pitch, clampf((x - player->x) / 200.f, -0.8f, 0.8f)); }
  void sfxUI(int id, float vol = 1, float pitch = 1) { Audio::play(id, vol, pitch, 0); }
  Ent* nearest(float x, float y, float r, const std::function<bool(Ent*)>& f) { Ent* b = nullptr; float bd = r * r; for (auto& e : ents) if (!e->dead && f(e.get())) { float d = dist2f(x, y, e->x, e->y); if (d < bd) { bd = d; b = e.get(); } } return b; }
  std::vector<Ent*> query(float x, float y, float r, const std::function<bool(Ent*)>& f) { std::vector<Ent*> o; float r2 = r * r; for (auto& e : ents) if (!e->dead && dist2f(x, y, e->x, e->y) < r2 && f(e.get())) o.push_back(e.get()); return o; }
  int ID(const char* s) { return itm(s); }
  Nation& nation(Village* v) { std::string id = v->id(); auto it = nations.find(id); if (it == nations.end()) { Nation n; n.id = id; n.name = v->name; n.ruler = v->ruler; n.temper = v->temper; n.color = v->color; n.status = v->home ? "home" : "neutral"; n.rel = v->temper == "peaceful" || v->temper == "honest" ? 60 : v->temper == "warlike" ? 30 : 45; it = nations.emplace(id, n).first; } return it->second; }
  Village* villageById(const std::string& id) { for (auto& kv : world.villages) if (kv.second && kv.second->id() == id) return kv.second.get(); return nullptr; }

  /* ---------------- player inventory ---------------- */
  Slot inv[32]; Slot armor; int coins = 0, sel = 0; float food = 20; float hungerT = 0, regenT = 0, buff = 0; int lastDeathCoins = 0;
  int count(int id) { int n = 0; for (auto& s : inv) if (s.id == id) n += s.n; return n; }
  int add(int id, int n = 1) {
    ItemDef& d = ITEMS[id]; for (auto& s : inv) if (s.id == id && s.n < d.st && n > 0) { int k = std::min(n, d.st - s.n); s.n += k; n -= k; }
    for (auto& s : inv) if (!s.id && n > 0) { int k = std::min(n, d.st); s = {id, k, d.dur}; n -= k; } return n;
  }
  bool remove(int id, int n = 1) { if (count(id) < n) return false; for (int i = 31; i >= 0 && n > 0; i--) if (inv[i].id == id) { int k = std::min(n, inv[i].n); inv[i].n -= k; n -= k; if (!inv[i].n) inv[i] = Slot(); } return true; }
  void wear(int slot) { Slot& s = inv[slot]; if (!s.id || !ITEMS[s.id].dur) return; if (--s.d <= 0) { toast(ITEMS[s.id].name + " broke!"); sfxUI(S_BREAK); s = Slot(); } }
  bool stationNear(const char* at) {
    if (!at) return true; int px = player->tx(), py = player->ty(); std::string a = at;
    for (int dy = -4; dy <= 4; dy++) for (int dx = -4; dx <= 4; dx++) { int o = world.obj(px + dx, py + dy); if (!o) continue; const char* st = OBJS[o].station; if (!st) continue; if (a == st) return true; if (a == "fire" && (std::string(st) == "furnace" || std::string(st) == "pot")) return true; }
    return false;
  }
  bool canCraft(const Recipe& r) { if (!stationNear(r.at)) return false; for (auto& in : r.in) if (count(itm(in.first)) < in.second) return false; return true; }
  bool craft(const Recipe& r) {
    if (!canCraft(r)) { sfxUI(S_ERROR); return false; } for (auto& in : r.in) remove(itm(in.first), in.second); int o = itm(r.out); int left = add(o, r.n); if (left) dropItem(o, left, player->x, player->y);
    made[r.out]++; sfxUI(S_PLACE, 0.7f); sfxUI(S_PICKUP, 0.5f); toast(fmt("Crafted %s x%d", ITEMS[o].name.c_str(), r.n), 0xFFcfe8ff); return true;
  }
  void dropItem(int id, int n, float x, float y, float vx = 0, float vy = 0) {
    if (!id || n <= 0) return; auto e = std::make_unique<Ent>(); e->type = E_DROP; e->x = x + frandr(-3, 3); e->y = y + frandr(-3, 3); e->item = id; e->n = n; e->vz = 80; e->z = 4; e->r = 3; e->pickT = 0.5f; e->hp = 1;
    e->rs.t = frand() * 6; float a = frand() * TAU; e->kbx = vx + std::cos(a) * 25; e->kby = vy + std::sin(a) * 18; e->persist = false; e->st = 120; add(std::move(e));
  }
  void dropRange(const std::vector<DropDef>& d, float x, float y) { for (auto& q : d) { int n = irand(q.a, q.b); if (n > 0) dropItem(itm(q.item), n, x, y); } }

  /* ---------------- collision / movement ---------------- */
  bool blocked(Ent& e, float px, float py) {
    int x0 = (int)std::floor((px - e.r) / TS), x1 = (int)std::floor((px + e.r) / TS), y0 = (int)std::floor((py - 4) / TS), y1 = (int)std::floor(py / TS);
    for (int ty = y0; ty <= y1; ty++) for (int tx = x0; tx <= x1; tx++) { if (world.solid(tx, ty, e.swims)) return true; if (e.noWater && isWater(world.ground(tx, ty))) return true; } return false;
  }
  bool move(Ent& e, float dx, float dy) { bool hit = false; if (dx) { if (!blocked(e, e.x + dx, e.y)) e.x += dx; else hit = true; } if (dy) { if (!blocked(e, e.x, e.y + dy)) e.y += dy; else hit = true; } return hit; }
  int waterLevel(Ent& e) { return world.depth(e.tx(), e.ty()); }
  static int dirOf(float dx, float dy) { return std::fabs(dx) > std::fabs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 0 : 2); }
  bool findPath(Ent& e, int sx, int sy, int gx, int gy) {
    e.path.clear(); if (std::abs(gx - sx) + std::abs(gy - sy) > 60) return false;
    struct N { int x, y, g, f, p; }; std::vector<N> nodes; std::unordered_map<i64, int> best; auto h = [&](int x, int y) { return (std::abs(x - gx) + std::abs(y - gy)) * 10; };
    auto cmp = [&](int a, int b) { return nodes[a].f > nodes[b].f; }; std::vector<int> open; nodes.push_back({sx, sy, 0, h(sx, sy), -1}); open.push_back(0); best[K2(sx, sy)] = 0; int iters = 0;
    while (!open.empty() && iters++ < 500) {
      std::pop_heap(open.begin(), open.end(), cmp); int ci = open.back(); open.pop_back(); N c = nodes[ci];
      if (c.x == gx && c.y == gy) { std::vector<std::pair<int, int>> p; for (int i = ci; i >= 0 && nodes[i].p >= 0; i = nodes[i].p) p.push_back({nodes[i].x, nodes[i].y}); std::reverse(p.begin(), p.end()); e.path = p; return true; }
      for (int d = 0; d < 4; d++) { int nx = c.x + DIRV[d][0], ny = c.y + DIRV[d][1]; if ((nx != gx || ny != gy) && world.solid(nx, ny, e.swims)) continue; if (e.noWater && isWater(world.ground(nx, ny))) continue; int ng = c.g + 10; auto it = best.find(K2(nx, ny)); if (it != best.end() && it->second <= ng) continue; best[K2(nx, ny)] = ng; nodes.push_back({nx, ny, ng, ng + h(nx, ny), ci}); open.push_back((int)nodes.size() - 1); std::push_heap(open.begin(), open.end(), cmp); }
    }
    return false;
  }
  bool seek(Ent& e, float tx, float ty, float sp, float dt, float stopAt = 2) {
    float gx = tx, gy = ty; if (!e.path.empty()) { auto n = e.path.front(); gx = n.first * TS + 8; gy = n.second * TS + 12; if (dist2f(e.x, e.y, gx, gy) < 25) e.path.erase(e.path.begin()); }
    float dx = gx - e.x, dy = gy - e.y, d = std::hypot(dx, dy); if (d < stopAt && e.path.empty()) { e.moving = false; return true; }
    int wl = waterLevel(e); float k = (wl == 2 ? 0.5f : wl ? 0.7f : 1.f) * sp * dt / (d > 0.001f ? d : 1.f); float ox = e.x, oy = e.y; move(e, dx * k, dy * k); e.dir = dirOf(dx, dy); e.moving = true;
    float moved = std::fabs(e.x - ox) + std::fabs(e.y - oy); if (moved < sp * dt * 0.3f) { e.stuck += dt; if (e.stuck > 0.45f) { e.stuck = 0; findPath(e, e.tx(), e.ty(), (int)std::floor(tx / TS), (int)std::floor(ty / TS)); } } else e.stuck = std::max(0.f, e.stuck - dt);
    return false;
  }

  /* ---------------- spawning ---------------- */
  static Look randomLook(RNG& r, int kind) {
    static const u32 TOPS[] = {0x6fa8c8, 0xc8a050, 0x8ab870, 0xb8788a, 0xa8a0d0, 0xd88a5a, 0x7ac0b0, 0xc86a6a}, BOTS[] = {0x3a4a7a, 0x4a3a5a, 0x5a4a3a, 0x3a5a4a, 0x2a3a5a}, HAIRS[] = {0x2a1c24, 0x4a2a1c, 0x1a1a22, 0x7a4a2a, 0xcfcfd8, 0xc89a4a}, SKIN[] = {0xf2c9a0, 0xe8b88a, 0xd8a070, 0xf6d6b8, 0xc88a60};
    Look l; l.skin = SKIN[r.i(0, 4)]; l.hair = HAIRS[r.i(0, 5)]; l.top = TOPS[r.i(0, 7)]; l.bottom = BOTS[r.i(0, 4)]; l.accent = TOPS[r.i(0, 7)]; l.hairStyle = r.i(0, 4); l.hat = r.chance(0.3f) ? 1 : 0; l.kind = kind; return l;
  }
  Ent* spawnHuman(int type, float x, float y, const Look& look) { auto e = std::make_unique<Ent>(); e->type = type; e->x = x; e->y = y; e->look = look; e->rig.look = look; e->r = 4; e->hp = e->maxHp = 10; e->speed = 34; e->rs.t = frand() * 10; e->wanderT = frand() * 3; e->homeX = x; e->homeY = y; return add(std::move(e)); }
  Ent* spawnVillager(Village* v, const Spawn& sp, RNG& r) {
    float x = sp.x * TS + 8, y = sp.y * TS + 10; Look l = randomLook(r, 0); Ent* e = nullptr; Nation& n = nation(v);
    if (sp.k == "merchant") { l.top = 0x7a46b8; l.accent = 0xf2c24a; l.hairStyle = 3; l.hat = 0; e = spawnHuman(E_VILLAGER, x, y, l); e->role = R_MERCHANT; e->name = "Merchant"; }
    else if (sp.k == "chief") { l.top = ((v->color >> 16) & 255) << 16 | ((v->color >> 8) & 255) << 8 | (v->color & 255); l.top |= 0; l.hair = 0xcfcfd8; l.hairStyle = 3; l.accent = 0xf2c24a; l.hat = 0; e = spawnHuman(E_VILLAGER, x, y, l); e->role = R_CHIEF; e->name = v->ruler; e->hp = e->maxHp = 20; }
    else if (sp.k == "guard") return spawnSoldier(v, x, y, r.chance(0.35f), false);
    else { e = spawnHuman(E_VILLAGER, x, y, l); e->name = RULERS[r.i(0, 15)]; e->role = R_VILLAGER; e->homeStruct = sp.home; if (sp.home >= 0 && sp.home < (int)v->structs.size()) { e->homeX = v->structs[sp.home].doorx * TS + 8; e->homeY = (v->structs[sp.home].doory + 1) * TS + 10; } }
    e->vid = v->id(); e->team = v->home ? 1 : 3; e->persist = true; e->homeX = e->homeX ? e->homeX : x; (void)n; e->rs.t = r.next() * 10; e->homeX = (sp.k == "villager" && sp.home >= 0) ? e->homeX : x; e->homeY = (sp.k == "villager" && sp.home >= 0) ? e->homeY : y; return e;
  }
  Ent* spawnSoldier(Village* v, float x, float y, bool archer, bool mineF) {
    Look l; l.armor = true; l.hat = 2; l.kind = 2; l.hairStyle = 3; l.skin = 0xe8b88a; l.hair = 0x2a1c24; u32 col = v ? v->color : 0xe87a9a; l.top = col; l.bottom = shadec(col, 0.55f) | 0xFF000000; l.accent = 0xf2c24a; l.shoe = 0x2a2028;
    Ent* e = spawnHuman(E_SOLDIER, x, y, l); e->hp = e->maxHp = archer ? 14 : 20; e->archer = archer; e->speed = 40; e->mine = mineF; e->vid = v ? v->id() : ""; e->team = mineF ? 1 : 3; e->persist = mineF; e->name = RULERS[irand(0, 15)]; e->homeX = x; e->homeY = y; return e;
  }
  Ent* spawnZombie(float x, float y, int lvl) {
    Look l; l.kind = 3; l.skin = 0x8fb070; l.hair = 0x2a2a1a; l.top = lvl == 2 ? 0x4a4a5a : lvl == 1 ? 0x6a4a3a : 0x5a6a7a; l.bottom = 0x3a3a3a; l.accent = 0x5a3a3a; l.hairStyle = irand(0, 2); l.hat = 0; l.shoe = 0x2a2a2a;
    Ent* e = spawnHuman(E_ZOMBIE, x, y, l); e->team = 2; e->kindLevel = lvl; e->hp = e->maxHp = lvl == 2 ? 28 : lvl == 1 ? 16 : 10; e->speed = lvl == 2 ? 30 : 24 + lvl * 4; return e;
  }
  Ent* spawnAnimal(const std::string& k, float x, float y, bool pen = false, bool baby = false) {
    auto e = std::make_unique<Ent>(); e->type = k == "dog" ? E_DOG : E_ANIMAL; e->kind = k; e->aniIdx = k == "wolf" ? 6 : aniIndex(k); const AniSpec& sp = ANISPEC[e->aniIdx]; e->x = x; e->y = y; e->r = sp.len > 13 ? 6 : 4; e->noWater = true; e->as.seed = irand(0, 99);
    static const std::map<std::string, std::array<float, 2>> HP = {{"cow", {14, 22}}, {"sheep", {10, 24}}, {"pig", {10, 22}}, {"deer", {12, 46}}, {"boar", {16, 34}}, {"fox", {9, 38}}, {"wolf", {16, 36}}, {"chicken", {5, 22}}, {"rabbit", {4, 44}}, {"dog", {20, 46}}};
    auto it = HP.find(k); e->hp = e->maxHp = it != HP.end() ? it->second[0] : 8; e->speed = it != HP.end() ? it->second[1] : 25; e->baby = baby; e->persist = pen; e->team = k == "wolf" ? 0 : 0; e->produceT = frandr(60, 200); e->st = frandr(0, 3);
    e->rs.t = frand() * 10; if (k == "wolf") { e->team = 4; e->speed = 40; } return add(std::move(e));
  }
  Ent* spawnChicken(float x, float y, bool pen) { Ent* e = spawnAnimal("cow", x, y, pen); e->kind = "chicken"; e->aniIdx = 100; e->hp = e->maxHp = 5; e->speed = 22; e->r = 3; return e; }

  /* ---------------- new game ---------------- */
  void newGame(u32 sd) {
    seed = sd; ents.clear(); player = nullptr; activated.clear(); world.init(sd); fx = FXSys(); toasts.clear(); dmg.clear(); nations.clear(); made.clear(); stats.clear(); goal = 0; clock = DAY_LEN * (7.f / 24); day = 1; rain = rainTarget = 0; raidOn = false; koiFeeds = 0;
    for (auto& s : inv) s = Slot(); armor = Slot(); coins = 0; food = 20; sel = 0; spawnSet = false; modal = M_NONE; playTime = 0; spawnT = 0; nextId = 1;
    Village* h = home(); spawnX = h->spx * TS + 8; spawnY = h->spy * TS + 8;
    auto p = std::make_unique<Ent>(); p->type = E_PLAYER; p->x = spawnX; p->y = spawnY; p->hp = p->maxHp = 20; p->speed = 66; p->swims = true; p->team = 1; Look l; l.scarf = true; l.hairStyle = 2; p->look = l; p->rig.look = l; p->r = 4; player = add(std::move(p));
    add(itm("axe_wood"), 1); add(itm("pick_wood"), 1); add(itm("torch"), 3); add(itm("bread"), 3); coins = 10;
    camX = player->x; camY = player->y - 8; activateVillages(); banner("Hanomi", "A sakura village. Your story begins at dawn.");
  }
  std::set<std::string> activated;
  void activateVillages() {
    float px = player->x / TS, py = player->y / TS; for (Village* v : world.villagesNear(px, py, 34)) { if (activated.count(v->id() + ":" + std::to_string(seed))) continue; if (std::hypot(v->x - px, v->y - py) > 40) continue; activated.insert(v->id() + ":" + std::to_string(seed)); RNG r(hash2i(v->x, v->y, seed + 11));
      nation(*&v); for (auto& sp : v->spawns) { if (sp.k == "villager" || sp.k == "merchant" || sp.k == "chief" || sp.k == "guard") spawnVillager(v, sp, r); else if (sp.k == "dog") { Ent* d = spawnAnimal("dog", sp.x * TS + 8, sp.y * TS + 8); d->owned = false; d->persist = true; } else if (sp.k == "chicken") { Ent* c = spawnChicken(sp.x * TS + 8, sp.y * TS + 8, true); c->hasPen = true; c->penX = sp.px; c->penY = sp.py; c->penW = sp.pw; c->penH = sp.ph; } else { Ent* a = spawnAnimal(sp.k, sp.x * TS + 8, sp.y * TS + 8, true); a->hasPen = sp.pen; a->penX = sp.px; a->penY = sp.py; a->penW = sp.pw; a->penH = sp.ph; } } }
  }
  std::set<std::string> activatedSave;

  /* ---------------- hostility ---------------- */
  bool hostile(Ent* a, Ent* b) {
    if (a == b || a->dead || b->dead) return false; auto bad = [&](Ent* x) { return x->type == E_ZOMBIE; };
    auto atWar = [&](Ent* x) { if (x->vid.empty() || x->team != 3) return false; auto it = nations.find(x->vid); return it != nations.end() && it->second.status == "war"; };
    if (bad(a)) return !bad(b) && (b->human() || b->type == E_DOG || b->type == E_ANIMAL ? (b->type != E_ANIMAL) : false);
    if (a->type == E_SOLDIER || a->type == E_VILLAGER) { if (bad(b)) return true; if (a->type == E_SOLDIER && a->mine) return atWar(b) && b->type == E_SOLDIER; if (a->type == E_SOLDIER && atWar(a)) return b->mine || b->type == E_PLAYER || (b->team == 1 && b->type == E_SOLDIER); if (a->team == 1 && b->type == E_SOLDIER) return atWar(b); return false; }
    if (a->type == E_ANIMAL && a->angry) return false; return false;
  }

  /* ---------------- damage ---------------- */
  void hurt(Ent* e, float d, Ent* src, float kb = 90) {
    if (e->dead || e->ifr > 0 || godMode && e == player) return; if (e == player && armor.id) d = std::max(1.f, d - ITEMS[armor.id].def * 0.5f);
    e->hp -= d; e->flash = 0.18f; if (e == player) { e->ifr = 0.5f; hurtT = 0.45f; fx.kick(2.2f, 0.18f); sfxUI(S_HURT, 0.7f); fx.flash = 0.25f; } else e->ifr = 0.12f;
    if (src) { float dx = e->x - src->x, dy = e->y - src->y, l = std::hypot(dx, dy); if (l < 0.01f) l = 1; e->kbx = dx / l * kb; e->kby = dy / l * kb; }
    u32 blood = e->type == E_ZOMBIE ? 0xFF7ab04a : (e->type == E_ANIMAL || e->type == E_DOG) ? 0xFFc83a4a : 0xFFd8484a; fx.burst(e->x, e->y, 6, {blood, blood, 0xFFf8e8e0}, 8, 20, 60, 0.25f, 0.5f);
    if (e != player || d > 0) fx.floatText(e->x, e->y - 22, fmt("%d", (int)std::ceil(d)), e == player ? 0xFFff6a6a : 0xFFfff2c0);
    if (e->type == E_ANIMAL) { e->panic = 3; e->state = 3; if (src) { e->gx = src->x; e->gy = src->y; } if (e->kind == "boar" && src) e->angry = true; sfxAnimal(e); }
    if (e->type == E_VILLAGER && src && src == player) { auto it = nations.find(e->vid); if (it != nations.end() && it->second.status != "home") { it->second.rel = std::max(0.f, it->second.rel - 40); if (it->second.status != "vassal" && it->second.status != "war") { it->second.status = "war"; banner(it->second.name + " declares war!", "You attacked their people."); sfxUI(S_HORN); } } else e->bubble = "Hey! Why?!", e->bubbleT = 2; }
    if (e->type == E_ZOMBIE) sfx(S_GROAN, e->x, e->y, 0.4f, frandr(0.9f, 1.2f));
    if (e->hp <= 0) kill(e, src);
  }
  void sfxAnimal(Ent* e) { int s = e->kind == "cow" ? S_MOO : e->kind == "sheep" ? S_BAA : e->kind == "pig" || e->kind == "boar" ? S_OINK : e->kind == "chicken" ? S_CLUCK : e->kind == "dog" ? S_BARK : S_POP; sfx(s, e->x, e->y, 0.6f, frandr(0.9f, 1.15f)); }
  void kill(Ent* e, Ent* src) {
    e->dead = true; e->deadT = 0; sfx(S_DIE, e->x, e->y, 0.5f); fx.burst(e->x, e->y, 12, {0xFFe8e0d0, 0xFFc8b8a8, 0xFFd8484a}, 8, 30, 80, 0.3f, 0.7f);
    if (e->type == E_ZOMBIE) { stats["zombies"]++; dropItem(itm("rotten"), irand(0, 1), e->x, e->y); if (frand() < 0.25f) dropItem(itm("bone"), 1, e->x, e->y); if (frand() < 0.12f) dropItem(itm("iron"), 1, e->x, e->y); coinDrop(e, irand(1, 3) + e->kindLevel * 2); }
    else if (e->type == E_ANIMAL) { static const std::map<std::string, std::vector<DropDef>> D = {{"cow", {{"raw_meat", 1, 3}, {"leather", 1, 2}}}, {"sheep", {{"raw_meat", 1, 2}, {"wool", 1, 2}}}, {"pig", {{"raw_meat", 1, 3}}}, {"deer", {{"raw_meat", 1, 3}, {"leather", 1, 2}}}, {"boar", {{"raw_meat", 1, 3}, {"leather", 0, 1}, {"bone", 0, 1}}}, {"fox", {{"raw_meat", 0, 1}, {"leather", 0, 1}}}, {"wolf", {{"raw_meat", 1, 2}, {"leather", 1, 1}, {"bone", 0, 2}}}, {"chicken", {{"raw_meat", 1, 1}, {"feather", 1, 3}}}, {"rabbit", {{"raw_meat", 1, 1}, {"leather", 0, 1}}}};
      auto it = D.find(e->kind); if (it != D.end() && !e->baby) dropRange(it->second, e->x, e->y); }
    else if (e->type == E_VILLAGER || e->type == E_SOLDIER) { if (e->type == E_SOLDIER && !e->mine && src && (src == player || src->mine)) coinDrop(e, irand(3, 8)); if (e->type == E_VILLAGER) coinDrop(e, irand(1, 4)); if (e->mine) toast(e->name + " has fallen.", 0xFFff8a8a); auto it = nations.find(e->vid); if (src && src == player && it != nations.end() && it->second.status != "home" && !e->mine) { it->second.rel = std::max(0.f, it->second.rel - 25); if (it->second.status != "war" && it->second.status != "vassal") { it->second.status = "war"; banner(it->second.name + " declares war!", "You slew one of their own."); sfxUI(S_HORN); } } }
    else if (e == player) die();
  }
  void coinDrop(Ent* e, int n) { for (int i = 0; i < n && i < 6; i++) dropItem(itm("none"), 0, 0, 0); coins += 0; for (int i = 0; i < n; i++) { /* coins go straight to purse w/ popup */ } coins += n; fx.floatText(e->x, e->y - 30, fmt("+%d", n), 0xFFf2c24a); sfxUI(S_COIN, 0.5f); }
  void die() {
    // drop a satchel with everything
    int tx = player->tx(), ty = player->ty(); int ox = tx, oy = ty; for (int r = 0; r < 4; r++) { bool ok = false; for (int dy = -r; dy <= r && !ok; dy++) for (int dx = -r; dx <= r && !ok; dx++) { int x = tx + dx, y = ty + dy; if (!world.solid(x, y, false) && !world.obj(x, y) && !isWater(world.ground(x, y))) { ox = x; oy = y; ok = true; } } if (ok) break; }
    std::vector<Slot> items; for (auto& s : inv) if (s.id) items.push_back(s); if (armor.id) items.push_back(armor); if (items.empty() && coins == 0) {} else { world.set(ox, oy, -1, -1, O_GRAVE); world.chests[K2(ox, oy)] = items; Slot c; c.id = itm("none"); c.n = coins; world.chests[K2(ox, oy)].push_back(c); }
    for (auto& s : inv) s = Slot(); armor = Slot(); lastDeathCoins = coins; coins = 0; modal = M_DEAD; stats["deaths"]++; sfxUI(S_DIE); fx.kick(5, 0.4f);
  }
  void respawn() {
    player->dead = false; player->hp = player->maxHp; food = 14; player->x = spawnX; player->y = spawnY; player->ifr = 2; player->rs.dead = 0; player->path.clear(); modal = M_NONE; fishing = false; add(itm("axe_wood"), 1); if (!count(itm("pick_wood"))) add(itm("pick_wood"), 1); player->deadT = 0;
    if (inRaidDanger()) {} banner("You wake at home", "Your satchel lies where you fell."); camX = player->x; camY = player->y - 8;
  }
  bool inRaidDanger() { return raidOn; }

  /* ---------------- tile actions ---------------- */
  i64 tkey(int x, int y) { return K2(x, y); }
  void chip(int tx, int ty, u32 c1, u32 c2) { fx.burst(tx * TS + 8, ty * TS + 12, 5, {c1, c2}, 6, 15, 45, 0.25f, 0.5f, 20, 70); shakeTiles[tkey(tx, ty)] = 0.15f; }
  int toolTier(int toolKind, const ItemDef* it) { return it && it->tool == toolKind ? it->tier : -1; }
  bool useTool(int tx, int ty, const ItemDef* it, Ent* who, int slot) {
    int o = world.obj(tx, ty), b = world.block(tx, ty); float pow = 1; int tool = it ? it->tool : 0; int tier = it ? it->tier : -1; if (it && (tool == TL_AXE || tool == TL_PICK || tool == TL_HOE)) pow = (float)it->pow; else if (it && it->kind == K_WEAPON) pow = 0.5f;
    float cx = tx * TS + 8, cy = ty * TS + 8;
    if (b && BLOCKS[b].hp < 1e8f) {
      const BlockDef& bd = BLOCKS[b]; if (tool != bd.tool && !(bd.tool == TL_AXE && tool == TL_AXE)) { if (tool != bd.tool) { toastOnce(bd.tool == TL_PICK ? "You need a pickaxe." : "You need an axe."); sfxUI(S_TICK); return false; } }
      if (bd.tool == TL_PICK && tier < bd.tier) { toastOnce("Your pickaxe is too weak for this."); sfx(S_MINE, cx, cy, 0.5f, 0.7f); return false; }
      Dmg& d = dmg[tkey(tx, ty)]; if (d.t <= 0) d.hp = bd.hp; d.t = 4; d.hp -= pow; chip(tx, ty, 0xFFa8a8b4, 0xFF7a7a88); sfx(bd.tool == TL_PICK ? S_MINE : S_CHOP, cx, cy, 0.8f, frandr(0.9f, 1.1f));
      if (d.hp <= 0) { dmg.erase(tkey(tx, ty)); world.set(tx, ty, -1, 0, -1); dropRange(bd.drop, cx, cy); fx.burst(cx, cy, 10, {0xFFa8a8b4, 0xFF7a7a88, 0xFFd0d0dc}, 6, 20, 70, 0.3f, 0.6f); stats["mined"]++; sfx(S_BREAK, cx, cy, 0.4f); if (b != B_WOODWALL) stats["mined_stone"]++; }
      return true;
    }
    if (o && OBJS[o].hp < 1e8f) {
      const ObjDef& od = OBJS[o]; int need = od.tool;
      if (need == TL_AXE && tool != TL_AXE) { toastOnce("You need an axe to chop this."); sfxUI(S_TICK); return false; } if (need == TL_PICK && tool != TL_PICK) { toastOnce("You need a pickaxe for this."); sfxUI(S_TICK); return false; }
      if (od.crop) { const CropDef* cd = cropDef(o); int m = world.meta(tx, ty); if (m < 3) { toastOnce("Not ripe yet."); return false; } int n = irand(cd->n0, cd->n1); dropItem(itm(cd->crop), n, cx, cy); int sd = irand(cd->s0, cd->s1); if (sd) dropItem(itm(cd->seed), sd, cx, cy); world.set(tx, ty, -1, -1, 0, 0); stats["harvested"]++; sfx(S_HARVEST, cx, cy); fx.burst(cx, cy, 6, {0xFF8fbf5a, 0xFFe0d080}, 6, 15, 40); return true; }
      Dmg& d = dmg[tkey(tx, ty)]; if (d.t <= 0) d.hp = od.hp; d.t = 4; d.hp -= std::max(pow, 1.f); bool tree = od.tree; chip(tx, ty, tree ? 0xFF8a5a34 : 0xFFb8b8c4, tree ? 0xFF5aa040 : 0xFF8a8a96); sfx(tree || need == TL_AXE ? S_CHOP : (need == TL_PICK ? S_MINE : S_HARVEST), cx, cy, 0.8f, frandr(0.92f, 1.08f));
      if (tree) { for (int i = 0; i < 2; i++) fx.spawn({cx + frandr(-8, 8), cy - 18, 14, frandr(-6, 6), frandr(-2, 2), 0, 0, 1.3f, 1.3f, frand() * 6, o == O_SAKURA ? 0xFFf6b8ca : 0xFF6ab04a, 0xFF4a8a3a, 3}); }
      if (d.hp <= 0) { dmg.erase(tkey(tx, ty)); dropRange(od.drop, cx, cy); if (od.station && !od.tree) {} world.set(tx, ty, -1, -1, (tree && o != O_DEADTREE && o != O_BAMBOO && frand() < 0.5f) ? O_STUMP : 0, 0); stats["chopped"] += tree; fx.burst(cx, cy, 8, {0xFF8a5a34, 0xFF6ab04a, 0xFFc89a5a}, 8, 20, 60); if (tree) { fx.kick(1.2f, 0.12f); sfx(S_BREAK, cx, cy, 0.4f, 0.8f); } if (o == O_CAMPFIRE || o == O_TORCH) {} }
      return true;
    }
    int g = world.ground(tx, ty);
    if (it && tool == TL_HOE) { if ((g == G_GRASS || g == G_DIRT || g == G_SAKURA || g == G_FOREST) && !o && !b) { world.set(tx, ty, raining() ? G_WET : G_TILLED, -1, -1); sfx(S_PLANT, cx, cy); fx.burst(cx, cy, 5, {0xFF6a4730, 0xFF8a6a4a}, 4, 10, 30); stats["tilled"]++; return true; } toastOnce("Can't till here."); return false; }
    return false;
  }
  float lastToast = 0; std::string lastToastTxt;
  void toastOnce(const std::string& s) { if (lastToastTxt != s || playTime - lastToast > 2.f) { toast(s); lastToast = playTime; lastToastTxt = s; } }

  void plantSeed(const ItemDef& it) {
    int tx = tgx, ty = tgy; int g = world.ground(tx, ty), o = world.obj(tx, ty), b = world.block(tx, ty); float cx = tx * TS + 8, cy = ty * TS + 8; if (std::hypot(cx - player->x, cy - player->y) > 52) { toastOnce("Too far."); return; }
    if (it.plant) { if ((g == G_TILLED || g == G_WET) && !o) { world.set(tx, ty, -1, -1, it.plant, 0); remove(itm(it.id), 1); sfx(S_PLANT, cx, cy); act(ACT_BEND, 0.5f); stats["planted"]++; return; } toastOnce("Seeds need tilled soil."); }
    else if (it.tree) { if ((g == G_GRASS || g == G_FOREST || g == G_SAKURA || g == G_DIRT) && !o && !b) { world.set(tx, ty, -1, -1, O_SAPLING, (it.tree) & 7); remove(itm(it.id), 1); sfx(S_PLANT, cx, cy); act(ACT_BEND, 0.5f); return; } toastOnce("Plant on grass."); }
  }
  void placeItem(const ItemDef& it) {
    int tx = tgx, ty = tgy; float cx = tx * TS + 8, cy = ty * TS + 8; if (std::hypot(cx - player->x, cy - (player->y - 6)) > 54) { toastOnce("Too far to place."); return; } if (std::abs(tx - player->tx()) + std::abs(ty - player->ty()) == 0 && (it.po || it.pb)) { if (it.po && !OBJS[it.po].solid) {} else { toastOnce("Not on yourself."); return; } }
    int g = world.ground(tx, ty), o = world.obj(tx, ty), b = world.block(tx, ty);
    if (it.pg >= 0) { if (b || o || (isWater(g) && g != G_WATER)) { toastOnce("Can't build a floor here."); return; } if (g == it.pg) return; world.set(tx, ty, it.pg, -1, -1); }
    else if (it.pb) { if (b || o || isWater(g)) { toastOnce("Can't build a wall here."); return; } if (near(tx, ty)) { toastOnce("Something's in the way."); return; } world.set(tx, ty, -1, it.pb, -1); }
    else if (it.po) { if (b || (o && !(OBJS[o].hp < 1e8f && !OBJS[o].tree && OBJS[o].solid == 0 && o != O_TORII)) || (isWater(g))) { toastOnce("Can't place that here."); return; } if (o) { toastOnce("Occupied."); return; } if (OBJS[it.po].solid && near(tx, ty)) { toastOnce("Something's in the way."); return; } world.set(tx, ty, -1, -1, it.po, 0); if (it.po == O_FENCE || it.po == O_GATE) {} }
    remove(itm(it.id), 1); sfx(S_PLACE, cx, cy); stats["built"]++; fx.burst(cx, cy + 4, 5, {0xFFd8c8a8, 0xFFb8a888}, 4, 10, 30); act(ACT_BEND, 0.4f);
    if (it.po == O_CAMPFIRE) stats["campfire"]++; if (it.po == O_BENCH) {}
  }
  bool near(int tx, int ty) { for (auto& e : ents) if (!e->dead && e->human() && e->tx() == tx && e->ty() == ty) return true; return false; }
  void act(int type, float dur) { player->act = type; player->actDur = dur; player->actT = dur; }

  /* ---------------- player ---------------- */
  float useCd = 0, rollCd = 0, rollT = 0, rollVx = 0, rollVy = 0, stepT = 0, eatCd = 0; bool swingHit = true; int swingKind = 0;
  Slot* itemSlot() { return inv[sel].id ? &inv[sel] : nullptr; }
  void aimTarget() {
    float wx = camX - viewW / 2.f + IN.mx, wy = camY - viewH / 2.f + IN.my; bool mouse = IN.mouseOn && !usingPad; int tx, ty;
    if (mouse) { tx = (int)std::floor(wx / TS); ty = (int)std::floor(wy / TS); float d = std::hypot(tx * TS + 8 - player->x, ty * TS + 8 - (player->y - 6)); if (d <= 48) { tgx = tx; tgy = ty; tgAim = true; return; } }
    tgAim = false; tgx = (int)std::floor((player->x + DIRV[player->dir][0] * 12) / TS); tgy = (int)std::floor((player->y - 3 + DIRV[player->dir][1] * 12) / TS);
  }
  bool usingPad = false; float aimWx = 0, aimWy = 0;
  void playerUpdate(float dt) {
    Ent& p = *player; p.t += dt; p.rs.t += dt; if (p.flash > 0) p.flash -= dt; if (p.ifr > 0) p.ifr -= dt; if (useCd > 0) useCd -= dt; if (rollCd > 0) rollCd -= dt; if (buff > 0) buff -= dt; if (eatCd > 0) eatCd -= dt;
    if (p.actT > 0) { p.actT -= dt; if (p.actT <= 0) p.act = 0; }
    if (p.kbx || p.kby) { move(p, p.kbx * dt, p.kby * dt); float d = std::pow(0.002f, dt); p.kbx *= d; p.kby *= d; if (std::fabs(p.kbx) + std::fabs(p.kby) < 2) p.kbx = p.kby = 0; }
    // vitals
    hungerT += dt * (p.moving && IN.k(K_SHIFT) ? 1.5f : 1.f); if (hungerT > 26) { hungerT = 0; food = std::max(0.f, food - 1); }
    regenT += dt; float rate = buff > 0 ? 1.2f : (food >= 16 ? 4.f : food >= 8 ? 8.f : 1e9f);
    if (food <= 0) { if (regenT > 4) { regenT = 0; hurt(&p, 1, nullptr, 0); toast("You are starving...", 0xFFff9a8a); } } else if (p.hp < p.maxHp && regenT > rate) { regenT = 0; p.hp = std::min(p.maxHp, p.hp + 1); }
    bool busy = modal != M_NONE || paused;
    float mx = 0, my = 0; if (!busy) { if (IN.k('A') || IN.k(K_LEFT)) mx -= 1; if (IN.k('D') || IN.k(K_RIGHT)) mx += 1; if (IN.k('W') || IN.k(K_UP)) my -= 1; if (IN.k('S') || IN.k(K_DOWN)) my += 1; if (std::fabs(IN.padX) > 0.2f || std::fabs(IN.padY) > 0.2f) { mx = IN.padX; my = IN.padY; usingPad = true; } else if (mx || my) usingPad = IN.k('A') || IN.k('D') || IN.k('W') || IN.k('S') ? false : usingPad; }
    float ml = std::hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    if (fishing && (mx || my)) cancelFish(); int wl = waterLevel(p); bool sprint = false;
    if (rollT > 0) { rollT -= dt; move(p, rollVx * dt, rollVy * dt); p.moving = true; p.rs.roll = 1 - rollT / 0.28f; if (frand() < 0.5f) fx.dust(p.x, p.y); if (rollT <= 0) p.rs.roll = -1; }
    else if (mx || my) {
      sprint = (IN.k(K_SHIFT)) && food > 2; float sp = p.speed * (sprint && wl < 2 ? 1.45f : 1.f) * (wl == 2 ? 0.55f : wl ? 0.75f : 1.f) * (p.actT > 0 ? 0.55f : 1.f) * (buff > 0 ? 1.1f : 1.f);
      float ox = p.x, oy = p.y; move(p, mx * sp * dt, my * sp * dt); p.moving = true; if (!(IN.mdown[0] || p.actT > 0)) p.dir = dirOf(mx, my);
      p.rs.walkT += dt * (sprint ? 2.1f : 1.5f) * (wl ? 0.6f : 1.f) * (std::hypot(p.x - ox, p.y - oy) > 0.01f ? 1 : 0); stepT -= dt * (sprint ? 1.5f : 1.f);
      if (stepT <= 0) { stepT = 0.32f; if (wl) Audio::play(S_SPLASH, wl == 2 ? 0.25f : 0.15f, wl == 2 ? 0.8f : 1.2f); else { int g = world.ground(p.tx(), p.ty()); Audio::play(g == G_WOOD || g == G_COBBLE || g == G_PLAZA || g == G_PATH ? S_STEP2 : S_STEP, 0.3f, frandr(0.9f, 1.1f)); fx.dust(p.x, p.y); } }
      if (sprint) hungerT += dt * 1.5f;
    } else p.moving = false;
    // splash when entering water
    static bool wasWet = false; if (wl && !wasWet) { fx.burst(p.x, p.y, 10, {0xFFe8fbff, 0xFFbfe7f4, 0xFFffffff}, 2, 10, 40, 0.3f, 0.7f, 30, 80); Audio::play(S_SPLASH_BIG, 0.5f); fx.ring(p.x, p.y, 10, 0xFFe8fbff, 0.9f); } wasWet = wl > 0;
    if (wl) { waterT += dt; if (waterT > (p.moving ? 0.25f : 0.9f)) { waterT = 0; fx.ring(p.x, p.y - (wl == 2 ? 4 : 1), wl == 2 ? 9 : 6, 0xFFe8fbff, p.moving ? 0.6f : 1.1f); } }
    // roll
    if (!busy && (IN.p(K_SPACE) || IN.padRoll) && rollCd <= 0 && rollT <= 0 && !fishing && wl < 2) { float dx = mx, dy = my; if (!dx && !dy) { dx = (float)DIRV[p.dir][0]; dy = (float)DIRV[p.dir][1]; } float l = std::hypot(dx, dy); rollVx = dx / l * 170; rollVy = dy / l * 170; rollT = 0.28f; rollCd = 0.8f; p.ifr = 0.34f; sfxUI(S_ROLL, 0.6f); p.dir = dirOf(dx, dy); }
    p.rs.dir = p.dir; p.rs.moving = p.moving; p.rs.speed = sprint ? 1.6f : 1; p.rs.sprint = sprint; p.rs.wl = wl; p.rs.hurt = p.flash; p.rs.dead = 0; p.rs.held = inv[sel].id; p.rs.fish = fishing; p.rs.act = p.act; p.rs.actP = p.actT > 0 ? 1 - p.actT / p.actDur : -1; p.rs.vx = p.vx; p.rs.vy = p.vy;
    if (fishing && p.actT <= 0) { p.rs.act = ACT_CAST; p.rs.actP = 0.9f; }
    aimTarget(); float wx = camX - viewW / 2.f + IN.mx, wy = camY - viewH / 2.f + IN.my; if (IN.mouseOn && !usingPad && (IN.mdown[0] || IN.mdown[2] || p.actT > 0) && !busy) { p.dir = dirOf(wx - p.x, wy - (p.y - 8)); } p.rs.aim = std::atan2(IN.mouseOn && !usingPad ? wy - (p.y - 9) : (float)DIRV[p.dir][1], IN.mouseOn && !usingPad ? wx - p.x : (float)DIRV[p.dir][0]);
    p.rig.update(dt, p.rs);
    if (busy) return;
    for (int k = 1; k <= 8; k++) if (IN.p('0' + k)) { sel = k - 1; cancelFish(); sfxUI(S_TICK, 0.5f); } if (IN.wheel) { sel = (sel + (IN.wheel > 0 ? 1 : -1) + 8) % 8; cancelFish(); sfxUI(S_TICK, 0.5f); }
    if (IN.p('Q')) { Slot& s = inv[sel]; if (s.id) { dropItem(s.id, 1, p.x + DIRV[p.dir][0] * 12, p.y - 4, DIRV[p.dir][0] * 40.f, DIRV[p.dir][1] * 30.f); if (--s.n <= 0) s = Slot(); } }
    bool useHeld = IN.mdown[0] || IN.k('J') || IN.padUse, usePressed = IN.mhit[0] || IN.p('J') || IN.padUse, alt = IN.mhit[2] || IN.p('E') || IN.p('K') || IN.padAlt;
    if (fishing) { updateFish(dt, usePressed || (useHeld && fishPhase == 2)); return; }
    if (alt) { if (interact()) return; }
    if ((useHeld || usePressed) && useCd <= 0 && rollT <= 0) { if (wl == 2) { if (usePressed) toastOnce("You can't use that while swimming."); } else useItem(usePressed); }
    updateSwing();
  }
  void useItem(bool fresh) {
    Ent& p = *player; Slot* s = itemSlot(); const ItemDef* it = s ? &ITEMS[s->id] : nullptr;
    if (it && (it->kind == K_FOOD || it->kind == K_FISH) && fresh) return eat();
    if (it && it->kind == K_SEED && fresh) return plantSeed(*it);
    if (it && it->kind == K_PLACE) { if (fresh) placeItem(*it); return; }
    if (it && it->tool == TL_ROD && fresh) return cast();
    if (it && it->tool == TL_BOW) { if (!fresh && useCd > 0) return; return shoot(); }
    if (it && it->tool == TL_CAN && fresh) return waterTile();
    if (it && (it->tool == TL_SHEARS || it->tool == TL_BUCKET) && fresh) return animalTool(it->tool);
    if (it && it->kind == K_ARMOR && fresh) { Slot a = armor; armor = *s; inv[sel] = a; toast("Equipped " + it->name, 0xFFcfe8ff); sfxUI(S_PLACE); return; }
    if (it && it->id == "dog_treat" && fresh) { interact(); return; }
    if (s && s->id == itm("stick") && fresh) { for (auto& e : ents) if (e->type == E_DOG && e->owned && !e->dead) { throwStick(); return; } }
    int type = it && it->tool == TL_AXE ? ACT_CHOP : it && it->tool == TL_PICK ? ACT_PICK : it && it->tool == TL_SPEAR ? ACT_THRUST : ACT_SWING; swingKind = type;
    act(type, it && it->tool == TL_SPEAR ? 0.38f : 0.3f); useCd = it && it->kind == K_WEAPON ? 0.36f : 0.32f; swingHit = false; sfx(S_SWING, p.x, p.y, 0.4f, frandr(0.9f, 1.1f));
  }
  void updateSwing() {
    Ent& p = *player; if (p.actT <= 0 || swingHit || (swingKind != ACT_SWING && swingKind != ACT_CHOP && swingKind != ACT_PICK && swingKind != ACT_THRUST)) return; float pr = 1 - p.actT / p.actDur; if (pr < 0.4f) return; swingHit = true;
    Slot* s = itemSlot(); const ItemDef* it = s ? &ITEMS[s->id] : nullptr; float reach = it && it->reach > 0 ? 22 : 14; float hx = p.x + DIRV[p.dir][0] * reach, hy = p.y - 6 + DIRV[p.dir][1] * reach;
    auto tg = query(hx, hy, it && it->reach > 0 ? 16 : 14, [&](Ent* e) { return e != player && e->type != E_DROP && e->type != E_ARROW && canHit(e); });
    if (!tg.empty()) { float dm = (it ? (float)std::max(1, it->dmg) : 1.f) * (buff > 0 ? 1.25f : 1.f); int lim = it && it->tool == TL_SWORD ? 3 : 1; for (int i = 0; i < (int)tg.size() && i < lim; i++) hurt(tg[i], dm, player, 120); sfxUI(S_HIT, 0.7f, frandr(0.9f, 1.1f)); fx.kick(1.5f, 0.08f); hitstop = 0.04f; if (it && it->dur) wear(sel); return; }
    if (useTool(tgx, tgy, it, player, sel) && it && it->dur) wear(sel);
  }
  bool canHit(Ent* e) { if (e->type == E_VILLAGER && e->role == R_CHIEF) return true; return true; }
  void eat() {
    Slot& s = inv[sel]; const ItemDef& it = ITEMS[s.id]; if (!it.food) return; if (food >= 20 && player->hp >= player->maxHp) { toastOnce("You're not hungry."); return; }
    food = std::min(20.f, food + it.food); if (it.heal) player->hp = std::min(player->maxHp, player->hp + it.heal); if (it.id == "rotten") {} stats["eaten"]++; act(ACT_EAT, 0.6f); useCd = 0.6f; sfxUI(S_EAT, 0.8f); fx.burst(player->x, player->y - 14, 4, {0xFFe8d0a0, 0xFFc8a870}, 12, 10, 25, 0.25f, 0.45f); if (--s.n <= 0) s = Slot(); fx.floatText(player->x, player->y - 26, fmt("+%d", it.food), 0xFFf2c24a);
  }
  void waterTile() {
    int g = world.ground(tgx, tgy); float cx = tgx * TS + 8, cy = tgy * TS + 8; if (std::hypot(cx - player->x, cy - player->y) > 52) return; Slot& s = inv[sel]; if (isWater(g)) { s.n = 1; s.d = ITEMS[s.id].dur; fx.ring(cx, cy, 8, 0xFFe8fbff, 0.7f); sfx(S_WATER, cx, cy, 0.6f); toastOnce("Watering can refilled."); act(ACT_BEND, 0.4f); canWater = 20; return; }
    if (canWater <= 0) { toastOnce("Empty! Fill it at any water."); return; }
    if (g == G_TILLED) { world.set(tgx, tgy, G_WET, -1, -1); canWater--; sfx(S_WATER, cx, cy, 0.6f); for (int i = 0; i < 8; i++) fx.spawn({cx + frandr(-5, 5), cy - 6, 10, 0, 0, 0, 120, 0.5f, 0.5f, 1, 0xFF8ac8f0, 0xFF8ac8f0, 0}); act(ACT_BEND, 0.4f); useCd = 0.3f; wear(sel); }
  }
  int canWater = 20;
  void animalTool(int tool) {
    Ent* a = nearest(player->x + DIRV[player->dir][0] * 12, player->y + DIRV[player->dir][1] * 12, 20, [&](Ent* e) { return e->type == E_ANIMAL; }); if (!a) { toastOnce(tool == TL_SHEARS ? "Shear a sheep." : "Milk a cow."); return; }
    if (tool == TL_SHEARS && a->kind == "sheep" && !a->shorn && !a->baby) { a->shorn = true; a->produceT = frandr(150, 300); dropItem(itm("wool"), irand(1, 3), a->x, a->y); sfx(S_SWING, a->x, a->y); fx.burst(a->x, a->y, 8, {0xFFf4f0e8}, 10, 10, 40); wear(sel); act(ACT_BEND, 0.4f); }
    else if (tool == TL_BUCKET && a->kind == "cow" && a->milked <= 0 && !a->baby) { a->milked = 120; dropItem(itm("milk"), 1, a->x, a->y); sfx(S_WATER, a->x, a->y, 0.5f, 0.7f); act(ACT_BEND, 0.4f); } else toastOnce("Nothing to collect.");
  }
  void shoot() {
    Ent& p = *player; if (!count(itm("arrow"))) { toastOnce("No arrows."); useCd = 0.3f; return; } remove(itm("arrow"), 1); float wx = camX - viewW / 2.f + IN.mx, wy = camY - viewH / 2.f + IN.my; float a = IN.mouseOn && !usingPad ? std::atan2(wy - (p.y - 9), wx - p.x) : std::atan2((float)DIRV[p.dir][1], (float)DIRV[p.dir][0]);
    act(ACT_SHOOT, 0.45f); useCd = 0.5f; fireArrow(&p, p.x, p.y - 9, a, 7, true); sfx(S_BOW, p.x, p.y, 0.7f); wear(sel);
  }
  void fireArrow(Ent* from, float x, float y, float a, float dmgv, bool mineF) {
    auto e = std::make_unique<Ent>(); e->type = E_ARROW; e->x = x + std::cos(a) * 6; e->y = y + std::sin(a) * 6 + 8; e->z = 8; e->vx = std::cos(a) * 230; e->vy = std::sin(a) * 230; e->st = 1.2f; e->hp = dmgv; e->team = from->team; e->mine = mineF; e->kindLevel = from->id; e->r = 2; e->dir = 0; e->gx = a; add(std::move(e));
  }
  void throwStick() {
    Slot& s = inv[sel]; for (auto& e : ents) if (e->type == E_DOG && e->owned && !e->dead) { float wx = camX - viewW / 2.f + IN.mx, wy = camY - viewH / 2.f + IN.my; float tx = IN.mouseOn && !usingPad ? wx : player->x + DIRV[player->dir][0] * 70, ty = IN.mouseOn && !usingPad ? wy : player->y + DIRV[player->dir][1] * 70; float dx = tx - player->x, dy = ty - player->y, l = std::hypot(dx, dy); if (l > 90) { dx *= 90 / l; dy *= 90 / l; } e->fetchState = 1; e->gx = player->x + dx; e->gy = player->y + dy; e->state = 5; dropItem(itm("stick"), 0, 0, 0); if (--s.n <= 0) s = Slot(); fx.ring(e->gx, e->gy, 6, 0xFFd8c8a8, 0.5f); act(ACT_SWING, 0.3f); sfx(S_SWING, player->x, player->y, 0.4f); e->wag = 3; return; }
  }
  /* fishing */
  void cast() {
    Ent& p = *player; float tx = p.x + DIRV[p.dir][0] * 44, ty = p.y - 4 + DIRV[p.dir][1] * 36; float wx = camX - viewW / 2.f + IN.mx, wy = camY - viewH / 2.f + IN.my; if (IN.mouseOn && !usingPad) { float dx = wx - p.x, dy = wy - p.y, l = std::hypot(dx, dy); if (l > 70) { dx *= 70 / l; dy *= 70 / l; } tx = p.x + dx; ty = p.y + dy; }
    int gx = (int)std::floor(tx / TS), gy = (int)std::floor(ty / TS); if (!isWater(world.ground(gx, gy)) || world.obj(gx, gy) == O_LILY && false) { toastOnce("Cast over water."); return; }
    fishing = true; fishPhase = 0; bobX = tx; bobY = ty; fishT = frandr(2.0f, 5.5f); fishProg = 0; act(ACT_CAST, 0.4f); useCd = 0.4f; sfx(S_CAST, p.x, p.y, 0.7f); fx.ring(bobX, bobY, 7, 0xFFe8fbff, 0.8f); p.rs.fish = true;
  }
  void cancelFish() { if (fishing) { fishing = false; fishPhase = 0; } }
  void updateFish(float dt, bool press) {
    fishT -= dt; if (fishPhase == 0) { if (fishT <= 0) { fishPhase = 1; fishBiteT = 1.0f; sfx(S_BITE, bobX, bobY, 0.9f); fx.ring(bobX, bobY, 9, 0xFFffffff, 0.6f); fx.floatText(bobX, bobY - 14, "!", 0xFFffe060); } if (press && fishT > 0 && fishT < 99) { toastOnce("Too early..."); cancelFish(); } }
    else if (fishPhase == 1) { fishBiteT -= dt; bobY += std::sin(playTime * 30) * 0.15f; if (press) { fishPhase = 2; fishProg = 0.3f; fishPos = 0.5f; fishTarget = frand(); fishBar = 0.5f; fishBarV = 0; fishItem = pickFish(); sfx(S_SPLASH, bobX, bobY, 0.8f); } else if (fishBiteT <= 0) { toast("It got away..."); cancelFish(); } }
    else if (fishPhase == 2) {
      fishBarV += ((press || IN.mdown[0] || IN.k('J')) ? 1.6f : -1.3f) * dt; fishBarV = clampf(fishBarV, -0.9f, 0.9f); fishBar = clampf(fishBar + fishBarV * dt, 0.06f, 0.94f); if (fishBar <= 0.06f || fishBar >= 0.94f) fishBarV *= -0.3f;
      static float tt = 0; tt += dt; if (tt > 0.9f) { tt = 0; fishTarget = frand(); } fishPos += (fishTarget - fishPos) * dt * 1.8f;
      bool ok = std::fabs(fishBar - fishPos) < 0.15f; fishProg += (ok ? 0.28f : -0.2f) * dt; fishProg = clampf(fishProg, 0, 1); if (frand() < dt * 8) fx.ring(bobX + frandr(-4, 4), bobY + frandr(-2, 2), 4, 0xFFe8fbff, 0.4f);
      if (fishProg >= 1) { int id = fishItem; float px = player->x, py = player->y; dropItem(id, 1, px + DIRV[player->dir][0] * 10, py); toast("Caught " + ITEMS[id].name + "!", 0xFFfff2c0); stats["fish"]++; sfxUI(S_PICKUP); fx.burst(bobX, bobY, 12, {0xFFe8fbff, 0xFFffffff}, 4, 20, 60, 0.4f, 0.8f, 40, 90); if (player->dir >= 0) wear(sel); cancelFish(); }
      else if (fishProg <= 0) { toast("The line snapped!", 0xFFff9a8a); sfxUI(S_ERROR, 0.5f); cancelFish(); }
    }
  }
  int pickFish() {
    int bi = world.biomeAt((int)(bobX / TS), (int)(bobY / TS)); const char* river[] = {"fish_carp", "fish_trout", "fish_trout", "fish_salmon", "fish_eel"}, *lake[] = {"fish_carp", "fish_carp", "fish_catfish", "fish_trout", "fish_eel"}, *sea[] = {"fish_salmon", "fish_salmon", "fish_eel", "fish_catfish"}, *marsh[] = {"fish_catfish", "fish_catfish", "fish_eel", "fish_carp"};
    int g = world.ground((int)(bobX / TS), (int)(bobY / TS)); if (frand() < 0.006f) return itm("fish_golden"); if (bi == BI_MARSH) return itm(marsh[irand(0, 3)]); if (world.depth((int)(bobX / TS), (int)(bobY / TS)) == 2 && g == G_DEEP) return itm(sea[irand(0, 3)]); return frand() < 0.5f ? itm(river[irand(0, 4)]) : itm(lake[irand(0, 4)]);
  }
  /* interaction (E / right click) */
  bool interact() {
    Ent& p = *player; float cx = tgx * TS + 8, cy = tgy * TS + 8; float reach = std::hypot(cx - p.x, cy - (p.y - 6));
    // entities first: villagers, dog, animals
    float fx0 = p.x + DIRV[p.dir][0] * 10, fy0 = p.y - 6 + DIRV[p.dir][1] * 10; Ent* e = nearest(tgAim ? cx : fx0, tgAim ? cy : fy0, 20, [&](Ent* q) { return q != player && (q->type == E_VILLAGER || q->type == E_DOG || q->type == E_ANIMAL || q->type == E_SOLDIER) && std::hypot(q->x - player->x, q->y - player->y) < 36; });
    if (e) { if (talk(e)) return true; }
    if (reach > 40) return false; int o = world.obj(tgx, tgy); const ObjDef* od = o ? &OBJS[o] : nullptr; if (!od || !od->use) return false; std::string u = od->use;
    if (u == "chest") { chestTile = K2(tgx, tgy); world.chests[chestTile].resize(std::max<size_t>(20, world.chests[chestTile].size())); modal = M_CHEST; sfxUI(S_DOOR, 0.5f); return true; }
    if (u == "gate") { int m = world.meta(tgx, tgy); world.setM(tgx, tgy, m ^ 1); sfx(S_DOOR, cx, cy, 0.6f); return true; }
    if (u == "bed") { if (night() || hour() < 6) { sleepNight(); } else toast("You can only sleep at night.", 0xFFcfd8ff); return true; }
    if (u == "well") { if (food < 20) { food = std::min(20.f, food + 1); } toast("Cool, clear water.", 0xFFbfe7f4); sfx(S_WATER, cx, cy, 0.7f); for (auto& s : inv) if (s.id && ITEMS[s.id].tool == TL_CAN) { s.d = ITEMS[s.id].dur; } canWater = 20; return true; }
    if (u == "banner") { spawnX = cx; spawnY = cy + 14; spawnSet = true; toast("Spawn point set at this banner.", 0xFFf6b8ca); sfxUI(S_BELL, 0.5f); return true; }
    if (u == "trade") { Ent* m = nearest(cx, cy, 60, [&](Ent* q) { return q->role == R_MERCHANT; }); modal = M_TRADE; tradeMode = 0; sfxUI(S_COIN, 0.5f); (void)m; return true; }
    if (u == "koi") { feedKoi(); return true; }
    if (u == "shrine") { pray(tgx, tgy); return true; }
    if (u == "grave") { collectGrave(tgx, tgy); return true; }
    return false;
  }
  void feedKoi() { Slot* s = itemSlot(); bool food2 = s && (ITEMS[s->id].id == "rice" || ITEMS[s->id].id == "bread" || ITEMS[s->id].id == "wheat" || ITEMS[s->id].id == "wheat_seeds" || ITEMS[s->id].id == "rice_seeds" || ITEMS[s->id].id == "petals"); if (!food2) { toast("The koi look up hopefully. (Hold rice, bread or wheat.)", 0xFFf6b8ca); return; }
    if (--s->n <= 0) *s = Slot(); koiFeeds++; koiBurst = 1.f; for (int i = 0; i < 10; i++) fx.spawn({player->x + frandr(-20, 20), player->y - 20, 6, frandr(-10, 10), frandr(-4, 4), 0, 100, 0.8f, 0.8f, 1, 0xFFf2e0b0, 0xFFf2e0b0, 0}); toast("The koi swarm to eat.", 0xFFf6b8ca); sfxUI(S_WATER, 0.5f); if (koiDay != day) { koiDay = day; if (frand() < 0.5f) { dropItem(itm("lotus"), 1, player->x, player->y + 10); toast("A koi leaves a lotus blossom.", 0xFFf6b8ca); } } if (frand() < 0.02f) { dropItem(itm("fish_golden"), 1, player->x, player->y + 10); toast("A golden koi rises!", 0xFFf2c24a); } }
  float koiBurst = 0;
  void pray(int tx, int ty) { if (prayedBuffDay == day * 1000 + tx * 7 + ty) { toast("The shrine is quiet.", 0xFFcfd8ff); return; } if (coins >= 1) coins--; prayedBuffDay = day * 1000 + tx * 7 + ty; buff = 300; player->hp = player->maxHp; food = std::min(20.f, food + 4); stats["prayed"]++; toast("You pray. A warm blessing settles over you.", 0xFFfff2c0); sfxUI(S_BELL); for (int i = 0; i < 20; i++) fx.spawn({tx * TS + 8 + frandr(-10, 10), ty * TS + 8, 4, frandr(-6, 6), frandr(-4, 4), frandr(20, 40), -10, 1.6f, 1.6f, 1, 0xFFfff2c0, 0xFFf2c24a, 5}); }
  void collectGrave(int tx, int ty) { auto it = world.chests.find(K2(tx, ty)); if (it != world.chests.end()) { for (auto& s : it->second) { if (s.id == itm("none")) { coins += s.n; continue; } if (s.id) { int left = add(s.id, s.n); if (left) dropItem(s.id, left, player->x, player->y); } } world.chests.erase(it); } world.set(tx, ty, -1, -1, 0); toast("You recover your satchel.", 0xFFfff2c0); sfxUI(S_PICKUP); }
  void sleepNight() { if (raidOn || bloodMoon()) { toast("The Blood Moon keeps you awake.", 0xFFff9a8a); return; } fade = 1; float h = hour(); float add2 = h >= 6 ? (24 - h + 6.5f) : (6.5f - h); clock += add2 / 24.f * DAY_LEN; day = (int)(clock / DAY_LEN) + 1; player->hp = player->maxHp; food = std::max(6.f, food - 3); toast("You sleep soundly until morning.", 0xFFcfd8ff); spawnX = player->x; spawnY = player->y; spawnSet = true; for (auto& e : ents) if (e->type == E_ZOMBIE && !e->raid) e->dead = true; }
  bool talk(Ent* e);
  void pet(Ent* d);

  /* ---------------- per-type AI ---------------- */
  void updateEnts(float dt);
  void updateHuman(Ent& e, float dt);
  void updateZombie(Ent& e, float dt);
  void updateSoldier(Ent& e, float dt);
  void updateVillager(Ent& e, float dt);
  void updateAnimal(Ent& e, float dt);
  void updateDog(Ent& e, float dt);
  void updateDrop(Ent& e, float dt);
  void updateArrow(Ent& e, float dt);
  void meleeTarget(Ent& e, float dt, float range, float dmgv, float cd);

  /* ---------------- world ticks ---------------- */
  void tickTime(float dt) {
    clock += dt; int nd = (int)(clock / DAY_LEN) + 1; if (nd != day) { day = nd; onDawn(); } int h = (int)hour(); if (h != lastHour) { lastHour = h; onHour(h); }
    float dl = daylight(); mood = (raidOn || bloodMoon() || danger()) ? 2 : dl < 0.35f ? 1 : 0; Audio::setMood(mood); Audio::setAmbience(raining() ? rain : 0, 1 - dl, 0.12f + rain * 0.25f, false);
  }
  bool danger() { for (auto& e : ents) if (!e->dead && e->type == E_ZOMBIE && std::hypot(e->x - player->x, e->y - player->y) < 110) return true; return false; }
  void onDawn() {
    banner(fmt("Day %d", day), bloodMoon() ? "A Blood Moon will rise tonight..." : day % 5 == 4 ? "The moon looks strange tonight..." : "A new day dawns."); sfxUI(S_BELL, 0.5f); int tribute = 0; for (auto& kv : nations) if (kv.second.status == "vassal") tribute += 15; if (tribute) { coins += tribute; toast(fmt("Tribute collected: +%d coins", tribute), 0xFFf2c24a); }
    if (raidOn) { raidOn = false; int alive = 0; for (auto& e : ents) if (e->type == E_VILLAGER && !e->dead && e->team == 1) alive++; banner("The Blood Moon has set", alive ? fmt("Hanomi stands! %d villagers safe.", alive) : "Hanomi suffered terribly."); }
    for (auto& e : ents) if (e->type == E_ZOMBIE && !e->raid) { if (std::hypot(e->x - player->x, e->y - player->y) > 140) e->dead = true; }
    for (auto& kv : nations) { Nation& n = kv.second; if (n.status == "neutral" && n.met && n.temper == "warlike" && n.rel < 20 && frand() < 0.35f) { n.status = "war"; banner(n.name + " declares war!", n.ruler + "'s soldiers march on Hanomi."); sfxUI(S_HORN); } if (n.status == "war" && frand() < 0.5f) warParty(n); n.rel = std::min(100.f, n.rel + 2); }
  }
  void warParty(Nation& n) { Village* hv = home(); Village* v = villageById(n.id); if (!v) return; float a = frand() * TAU; for (int i = 0; i < 3 + irand(0, 3); i++) { Ent* s = spawnSoldier(v, hv->x * TS + std::cos(a) * 330 + frandr(-20, 20), hv->y * TS + std::sin(a) * 330 + frandr(-20, 20), frand() < 0.35f, false); s->raid = true; s->hasRaid = true; s->raidX = hv->x * TS; s->raidY = hv->y * TS; s->persist = false; s->team = 3; } toast(n.name + " raiders approach Hanomi!", 0xFFff8a8a); }
  void onHour(int h) {
    if (h == 21 && bloodMoon()) startRaid(); if (h == 20 && day % 5 == 0) toast("The sky turns red...", 0xFFff6a6a);
  }
  void startRaid() { Village* hv = home(); raidOn = true; raidT = 0; sfxUI(S_HORN); banner("Blood Moon", "The dead march on Hanomi. Defend the village!"); int n = 8 + std::min(14, day); for (int i = 0; i < n; i++) { float a = frand() * TAU, d = frandr(300, 380); Ent* z = spawnZombie(hv->x * TS + std::cos(a) * d, hv->y * TS + std::sin(a) * d, day > 8 && frand() < 0.25f ? 2 : day > 3 && frand() < 0.3f ? 1 : 0); z->raid = true; z->hasRaid = true; z->raidX = hv->x * TS; z->raidY = hv->y * TS; z->persist = false; }
    for (auto& kv : nations) if (kv.second.status == "ally") { Village* v = villageById(kv.first); for (int k = 0; k < 2; k++) { Ent* s = spawnSoldier(v, hv->x * TS + frandr(-40, 40), hv->y * TS + frandr(10, 40), k == 1, false); s->team = 1; s->hasRaid = false; s->homeX = hv->x * TS; s->homeY = hv->y * TS + 30; } } }
  void tickWeather(float dt) {
    weatherT -= dt; if (weatherT <= 0) { rainTarget = rainTarget > 0 ? 0 : (frand() < 0.45f ? frandr(0.5f, 1) : 0); weatherT = rainTarget ? frandr(90, 220) : frandr(240, 600); } rain += (rainTarget - rain) * std::min(1.f, dt * 0.25f);
    bolt -= dt; if (rain > 0.82f && bolt <= 0) { bolt = frandr(7, 22); lightning = 1; Audio::play(S_THUNDER, 0.8f, frandr(0.8f, 1.1f)); } if (lightning > 0) lightning -= dt * 2.5f;
  }
  void randomTicks(float dt) {
    tickT += dt; if (tickT < 0.5f) return; tickT = 0; int px = player->tx(), py = player->ty();
    for (int i = 0; i < 90; i++) { int x = px + irand(-24, 24), y = py + irand(-16, 16); int g = world.ground(x, y), o = world.obj(x, y);
      if (o >= O_WHEAT && o <= O_RICE) { int m = world.meta(x, y); if (m < 3) { float stage = cropDef(o)->days * DAY_LEN / 3.f * (g == G_WET ? 0.5f : 1.f); if (frand() < 0.5f / (0.133f * stage)) world.setM(x, y, m + 1); } }
      else if (o == O_SAPLING && frand() < 0.5f / (0.133f * 500)) { int t = world.meta(x, y); world.set(x, y, -1, -1, t == O_SAKURA ? O_SAKURA : t == O_PINE ? O_PINE : O_OAK, hash2i(x, y, 77) & 3); }
      if (g == G_TILLED && raining()) world.set(x, y, G_WET, -1, -1); else if (g == G_WET && !raining() && frand() < 0.18f) world.set(x, y, G_TILLED, -1, -1); }
  }
  void tickSpawns() {
    int px = player->tx(), py = player->ty(); int animals = 0, zombies = 0, wolves = 0; for (auto& e : ents) if (!e->dead) { float d = std::hypot(e->x - player->x, e->y - player->y); if (d < 420) { if (e->type == E_ANIMAL && !e->persist) animals++; if (e->type == E_ZOMBIE && !e->raid) zombies++; if (e->kind == "wolf") wolves++; } }
    auto randTile = [&](int a, int b, int& tx, int& ty) { float ang = frand() * TAU, d = frandr((float)a, (float)b); tx = px + (int)(std::cos(ang) * d); ty = py + (int)(std::sin(ang) * d); };
    auto freeT = [&](int x, int y) { return !world.solid(x, y, false) && !isWater(world.ground(x, y)); }; auto inVillage = [&](int x, int y) { for (Village* v : world.villagesNear((float)x, (float)y, 4)) if (std::hypot(v->x - x, v->y - y) < VR + 2) return true; return false; };
    if (animals < 14 && frand() < 0.5f) { int tx, ty; randTile(18, 28, tx, ty); if (freeT(tx, ty) && !inVillage(tx, ty)) { int b = world.biomeAt(tx, ty); std::vector<std::string> o; if (b == BI_MEADOW) o = {"rabbit", "rabbit", "sheep", "cow", "pig", "deer", "chicken"}; else if (b == BI_FOREST) o = {"deer", "boar", "rabbit", "boar", "fox"}; else if (b == BI_SAKURA) o = {"rabbit", "deer", "sheep", "fox"}; else if (b == BI_SNOW) o = {"rabbit", "deer", "fox"}; else if (b == BI_MARSH) o = {"boar", "pig"}; if (!o.empty()) { std::string k = o[irand(0, (int)o.size() - 1)]; int n = k == "rabbit" || k == "sheep" ? irand(1, 3) : 1; for (int i = 0; i < n; i++) { Ent* a = k == "chicken" ? spawnChicken(tx * TS + 8 + i * 8, ty * TS + 8, false) : spawnAnimal(k, tx * TS + 8 + i * 8, ty * TS + 8); a->persist = false; } } } }
    if (wolves < 3 && frand() < (night() ? 0.08f : 0.015f)) { int tx, ty; randTile(18, 26, tx, ty); int b = world.biomeAt(tx, ty); if ((b == BI_FOREST || b == BI_SNOW) && freeT(tx, ty) && !inVillage(tx, ty)) for (int k = 0; k < irand(2, 3); k++) spawnAnimal("wolf", tx * TS + 8 + k * 10, ty * TS + 8)->persist = false; }
    if (night() && !raidOn) { int cap = (int)std::round((5 + std::min(12.f, day * 0.7f))); if (zombies < cap && frand() < 0.35f) { int tx, ty; randTile(16, 26, tx, ty); if (freeT(tx, ty) && !inVillage(tx, ty)) { spawnZombie(tx * TS + 8, ty * TS + 8, day > 8 && frand() < 0.25f ? 2 : day > 3 && frand() < 0.3f ? 1 : 0); } } }
    // despawn far wanderers
    for (auto& e : ents) if (!e->dead && !e->persist && e->type != E_PLAYER && e->type != E_DROP && !e->raid && std::hypot(e->x - player->x, e->y - player->y) > 480) e->dead = true;
  }
  void checkGoals() {
    if (goal >= NGOALS) return; bool ok = false; auto M = [&](const char* k) { return made.count(k) && made[k] > 0; };
    switch (goal) { case 0: ok = stats["chopped"] >= 1; break; case 1: ok = M("bench"); break; case 2: ok = M("pick_wood"); break; case 3: ok = stats["mined_stone"] >= 1 || count(itm("stone")) > 0; break; case 4: ok = stats["campfire"] >= 1; break; case 5: ok = stats["planted"] >= 1; break; case 6: ok = stats["harvested"] >= 1; break; case 7: ok = stats["fish"] >= 1; break; case 8: ok = koiFeeds >= 1; break; case 9: ok = day >= 2; break; case 10: ok = stats["prayed"] >= 1; break; case 11: ok = stats["dug"] >= 1; break; case 12: for (auto& kv : nations) if (kv.second.met && kv.second.status != "home") ok = true; break; case 13: ok = stats["tasks"] >= 1; break; case 14: ok = M("iron"); break; case 15: ok = armyList().size() >= 1; break; case 16: ok = day >= 6; break; case 17: ok = M("sword_iron"); break; case 18: for (auto& kv : nations) if (kv.second.status == "ally") ok = true; break; case 19: for (auto& kv : nations) if (kv.second.status == "vassal") ok = true; break; case 20: ok = M("katana"); break; }
    if (ok) { coins += GOALS[goal].r; toast(fmt("Goal complete: %s (+%d coins)", GOALS[goal].t, GOALS[goal].r), 0xFFfff2c0); sfxUI(S_LEVELUP, 0.8f); goal++; }
  }
  std::vector<Ent*> armyList() { std::vector<Ent*> o; for (auto& e : ents) if (e->type == E_SOLDIER && e->mine && !e->dead) o.push_back(e.get()); return o; }
  int armyCap() { int v = 0; for (auto& kv : nations) if (kv.second.status == "vassal") v++; return 6 + v * 3; }
  bool recruit(bool archer) {
    int cost = archer ? 55 : 40; Village* hv = home(); if (std::hypot(hv->bx * TS - player->x, hv->by * TS - player->y) > 400) { toast("Recruit at Hanomi's banner.", 0xFFff9a8a); return false; } if ((int)armyList().size() >= armyCap()) { toast("Your army is at its limit. Conquer villages to grow it.", 0xFFff9a8a); sfxUI(S_ERROR); return false; } if (coins < cost) { toast(fmt("Need %d coins.", cost), 0xFFff9a8a); sfxUI(S_ERROR); return false; }
    coins -= cost; Ent* s = spawnSoldier(hv, player->x + frandr(-10, 10), player->y + frandr(10, 20), archer, true); s->slot = (int)armyList().size(); toast(s->name + " joins you!", 0xFFb8ffb8); sfxUI(S_LEVELUP, 0.7f); return true;
  }
  bool conquer(Village* v) {
    Nation& n = nation(v); int guards = 0; for (auto& e : ents) if (e->type == E_SOLDIER && e->vid == v->id() && !e->dead && !e->mine && std::hypot(e->x - v->x * TS, e->y - v->y * TS) < 30 * TS) guards++;
    if (guards) { toast(fmt("Defeat their guards first (%d remain).", guards), 0xFFff9a8a); return false; } n.status = "vassal"; n.rel = 40; n.color = 0xe87a9a; banner(v->name + " is yours!", "Their banner now flies Hanomi pink. Tribute flows each dawn."); sfxUI(S_LEVELUP); sfxUI(S_DRUM);
    for (auto& e : ents) if (e->vid == v->id() && e->type == E_VILLAGER) e->team = 1; return true;
  }
  void metCheck() { float px = player->x / TS, py = player->y / TS; for (Village* v : world.villagesNear(px, py, 34)) { if (v->home) continue; Nation& n = nation(v); if (!n.met && std::hypot(v->x - px, v->y - py) < 30) { n.met = true; banner(v->name, n.status == "war" ? "At war with you" : cap1(v->temper) + " clan of " + v->ruler); sfxUI(S_BELL); } } }
  void digTreasure(int tx, int ty) {}

  /* ---------------- main update ---------------- */
  float daySpeed = 1;
  void update(float dt) {
    if (modal == M_TITLE) { return; }
    if (paused || modal == M_PAUSE || modal == M_SETTINGS || modal == M_HELP) { Audio::paused = false; return; }
    if (hitstop > 0) { hitstop -= dt; return; }
    world.frame++; playTime += dt; tickTime(dt); tickWeather(dt); if (hurtT > 0) hurtT -= dt; if (fade > 0) fade -= dt * 0.8f; if (bannerT > 0) bannerT -= dt; if (koiBurst > 0) koiBurst -= dt;
    if (player->hp > 0 && !player->dead) playerUpdate(dt);
    else if (modal == M_DEAD) { player->rs.dead = std::min(2.f, player->rs.dead + dt); }
    updateEnts(dt); fx.update(dt); for (auto it = dmg.begin(); it != dmg.end();) { it->second.t -= dt; if (it->second.t <= 0) it = dmg.erase(it); else ++it; } for (auto it = shakeTiles.begin(); it != shakeTiles.end();) { it->second -= dt; if (it->second <= 0) it = shakeTiles.erase(it); else ++it; }
    randomTicks(dt); for (auto& t : toasts) t.t -= dt; toasts.erase(std::remove_if(toasts.begin(), toasts.end(), [](const Toast& t) { return t.t <= 0; }), toasts.end());
    spawnT += dt; if (spawnT > 1.5f) { spawnT = 0; tickSpawns(); activateVillages(); metCheck(); world.unloadFar(player->x / TS, player->y / TS, 7); checkGoals(); }
    autoT += dt; if (autoT > 120) { autoT = 0; saveGame(true); }
    if (raidOn) raidT += dt; if (world.ground(player->tx(), player->ty()) == G_ONSEN) { onsenT += dt; if (onsenT > 1.5f) { onsenT = 0; if (player->hp < player->maxHp) player->hp++; } fx.spawn({player->x + frandr(-6, 6), player->y, 8, 0, 0, 14, -4, 1.2f, 1.2f, 3, 0x80ffffff, 0x80ffffff, 4}); }
    // dig treasure: standing on glinting soil with a hoe/any digs automatically on interact
    float tgt = player->x; camX += (player->x - camX) * std::min(1.f, dt * 7); camY += ((player->y - 8) - camY) * std::min(1.f, dt * 7); (void)tgt;
    if (IN.p('B') && false) {}
  }
  /* ---------------- save / load ---------------- */
  std::string savePath() { return saveDir + "/hanomi.sav"; }
  template <class T2> static void W(std::vector<u8>& b, const T2& v) { const u8* p = (const u8*)&v; b.insert(b.end(), p, p + sizeof v); }
  static void WS(std::vector<u8>& b, const std::string& s) { u32 n = (u32)s.size(); W(b, n); b.insert(b.end(), s.begin(), s.end()); }
  struct RD { const u8* p; const u8* e; bool ok = true; template <class T2> T2 r() { T2 v{}; if (p + sizeof v > e) { ok = false; return v; } memcpy(&v, p, sizeof v); p += sizeof v; return v; } std::string s() { u32 n = r<u32>(); if (!ok || p + n > e) { ok = false; return ""; } std::string o((const char*)p, n); p += n; return o; } };
  void saveGame(bool quiet = false) {
    std::vector<u8> b; W<u32>(b, 0x484e4d32); W(b, seed); W(b, clock); W(b, rain); W(b, rainTarget); W(b, goal); W(b, coins); W(b, food); W(b, player->hp); W(b, player->x); W(b, player->y); W(b, spawnX); W(b, spawnY); W(b, playTime); W(b, koiFeeds); W(b, prayedBuffDay);
    for (auto& s : inv) { W(b, s.id); W(b, s.n); W(b, s.d); } W(b, armor.id); W(b, armor.n); W(b, armor.d); W<u32>(b, (u32)stats.size()); for (auto& kv : stats) { WS(b, kv.first); W(b, kv.second); } W<u32>(b, (u32)made.size()); for (auto& kv : made) { WS(b, kv.first); W(b, kv.second); }
    W<u32>(b, (u32)nations.size()); for (auto& kv : nations) { WS(b, kv.first); WS(b, kv.second.status); W(b, kv.second.rel); W<u8>(b, kv.second.met); W(b, kv.second.task); W(b, kv.second.taskN); W(b, kv.second.taskItem); }
    std::unordered_map<i64, std::vector<ModTile>> mods; world.collectMods(mods); W<u32>(b, (u32)mods.size()); for (auto& kv : mods) { W(b, kv.first); W<u32>(b, (u32)kv.second.size()); for (auto& t : kv.second) W(b, t); }
    W<u32>(b, (u32)world.chests.size()); for (auto& kv : world.chests) { W(b, kv.first); W<u32>(b, (u32)kv.second.size()); for (auto& s : kv.second) { W(b, s.id); W(b, s.n); W(b, s.d); } }
    std::vector<Ent*> keep; for (auto& e : ents) if (!e->dead && ((e->type == E_SOLDIER && e->mine) || (e->type == E_DOG && e->owned) || (e->type == E_ANIMAL && e->owned))) keep.push_back(e.get()); W<u32>(b, (u32)keep.size()); for (Ent* e : keep) { W(b, e->type); WS(b, e->kind); WS(b, e->name); W(b, e->x); W(b, e->y); W(b, e->hp); W<u8>(b, e->archer); }
    FILE* f = fopen(savePath().c_str(), "wb"); if (f) { fwrite(b.data(), 1, b.size(), f); fclose(f); hasSave = true; if (!quiet) toast("Game saved.", 0xFFb8ffb8); } else if (!quiet) toast("Could not save!", 0xFFff9a8a);
  }
  bool loadGame() {
    FILE* f = fopen(savePath().c_str(), "rb"); if (!f) return false; std::vector<u8> b; u8 tmp[8192]; size_t n; while ((n = fread(tmp, 1, sizeof tmp, f)) > 0) b.insert(b.end(), tmp, tmp + n); fclose(f); RD r{b.data(), b.data() + b.size()}; if (r.r<u32>() != 0x484e4d32) return false;
    u32 sd = r.r<u32>(); newGame(sd); activated.clear(); ents.erase(std::remove_if(ents.begin(), ents.end(), [&](const std::unique_ptr<Ent>& e) { return e.get() != player; }), ents.end());
    clock = r.r<float>(); day = (int)(clock / DAY_LEN) + 1; rain = r.r<float>(); rainTarget = r.r<float>(); goal = r.r<int>(); coins = r.r<int>(); food = r.r<float>(); player->hp = r.r<float>(); player->x = r.r<float>(); player->y = r.r<float>(); spawnX = r.r<float>(); spawnY = r.r<float>(); playTime = r.r<float>(); koiFeeds = r.r<int>(); prayedBuffDay = r.r<int>();
    for (auto& s : inv) { s.id = r.r<int>(); s.n = r.r<int>(); s.d = r.r<int>(); if (s.id < 0 || s.id >= (int)ITEMS.size()) s = Slot(); } armor.id = r.r<int>(); armor.n = r.r<int>(); armor.d = r.r<int>(); if (armor.id < 0 || armor.id >= (int)ITEMS.size()) armor = Slot();
    stats.clear(); u32 c = r.r<u32>(); for (u32 i = 0; i < c && r.ok; i++) { std::string k = r.s(); stats[k] = r.r<int>(); } made.clear(); c = r.r<u32>(); for (u32 i = 0; i < c && r.ok; i++) { std::string k = r.s(); made[k] = r.r<int>(); }
    c = r.r<u32>(); for (u32 i = 0; i < c && r.ok; i++) { std::string id = r.s(), st = r.s(); Nation n; n.id = id; n.status = st; n.rel = r.r<float>(); n.met = r.r<u8>(); n.task = r.r<int>(); n.taskN = r.r<int>(); n.taskItem = r.r<int>(); savedNations[id] = n; }
    c = r.r<u32>(); world.saved.clear(); for (u32 i = 0; i < c && r.ok; i++) { i64 k = r.r<i64>(); u32 m = r.r<u32>(); auto& v = world.saved[k]; for (u32 j = 0; j < m && r.ok; j++) v.push_back(r.r<ModTile>()); }
    c = r.r<u32>(); world.chests.clear(); for (u32 i = 0; i < c && r.ok; i++) { i64 k = r.r<i64>(); u32 m = r.r<u32>(); auto& v = world.chests[k]; for (u32 j = 0; j < m && r.ok; j++) { Slot s; s.id = r.r<int>(); s.n = r.r<int>(); s.d = r.r<int>(); v.push_back(s); } }
    c = r.r<u32>(); for (u32 i = 0; i < c && r.ok; i++) { int type = r.r<int>(); std::string kind = r.s(), name = r.s(); float x = r.r<float>(), y = r.r<float>(), hp = r.r<float>(); bool arch = r.r<u8>(); Ent* e = nullptr; if (type == E_SOLDIER) { e = spawnSoldier(home(), x, y, arch, true); e->name = name; } else if (type == E_DOG || type == E_ANIMAL) { e = spawnAnimal(kind, x, y); e->owned = true; e->persist = true; } if (e) e->hp = hp; }
    world.chunks.clear(); world.lastC = nullptr; camX = player->x; camY = player->y - 8; for (auto& kv : savedNations) nations[kv.first] = kv.second; activateVillages(); for (auto& kv : savedNations) { auto it = nations.find(kv.first); if (it != nations.end()) { it->second.status = kv.second.status; it->second.rel = kv.second.rel; it->second.met = kv.second.met; } }
    modal = M_NONE; banner("Welcome back", fmt("Day %d", day)); return r.ok;
  }
  std::map<std::string, Nation> savedNations;
};
