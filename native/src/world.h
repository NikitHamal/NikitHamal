// Hanomi native — infinite procedural world: terrain, biomes, ores, villages, chunk storage.
#pragma once
#include "data.h"

constexpr int REG = 104, VR = 21;
static const char* SYL1[] = {"Aka", "Hana", "Kiri", "Mizu", "Yama", "Kaze", "Tsuki", "Hoshi", "Kumo", "Ishi", "Mori", "Sora", "Yuki", "Kawa", "Hino", "Nagi", "Ao", "Shira", "Kuro", "Taka", "Fuyu", "Asa"};
static const char* SYL2[] = {"mura", "zawa", "hara", "oka", "shima", "no", "gawa", "mine", "dera", "saki", "tani", "machi", "ba", "ishi", "kage", "ya"};
static const char* RULERS[] = {"Ren", "Haru", "Aoi", "Sora", "Kaito", "Yuna", "Daichi", "Mei", "Riku", "Hina", "Takeshi", "Akane", "Isamu", "Nobu", "Sayo", "Jun"};
static const u32 NATION_COLORS[] = {0xc8423a, 0x3a6fc8, 0xd8a23a, 0x7a46b8, 0x2f9a6a, 0xd86a2a, 0x2aa0b0, 0xb83a7a, 0x6a7a2a, 0x5a4a3a};
static const char* TEMPER[] = {"peaceful", "proud", "greedy", "warlike", "honest"};
enum Biome { BI_DEEP, BI_WATER, BI_BEACH, BI_ROCK, BI_SNOW, BI_MARSH, BI_FOREST, BI_SAKURA, BI_MEADOW };

struct Slot { int id = 0, n = 0, d = 0; };
struct Tile { u8 g = 0, b = 0, o = 0, m = 0; };
struct OvT { int g = -1, b = -1, o = -1, m = -1; };
struct Struct { int kind = 0; int x = 0, y = 0, w = 0, h = 0, doorx = 0, doory = 0; u32 style = 0; }; // kind 0 house, 1 hall, 2 barracks, 3 home
struct Spawn { std::string k; int x = 0, y = 0, home = -1; bool pen = false; int px = 0, py = 0, pw = 0, ph = 0; };
struct Village {
  int rx = 0, ry = 0, x = 0, y = 0; bool home = false; std::string name, ruler, temper; u32 color = 0; int size = 1;
  std::unordered_map<i64, OvT> ov; std::vector<Struct> structs; std::vector<Spawn> spawns; int bx = 0, by = 0, sx = 0, sy = 0, spx = 0, spy = 0; int hall = -1;
  std::string id() const { return std::to_string(rx) + "," + std::to_string(ry); }
};
inline i64 K2(int x, int y) { return ((i64)(u32)x << 32) | (u32)y; }

struct Chunk {
  int cx, cy; u8 g[256], b[256], o[256], m[256]; u8 mod[256]; int nmod = 0; bool water = false, dirty = true; u32 rv = 0; int lastUse = 0; Img surf; u8 shore[256] = {0};
  Chunk(int X, int Y) : cx(X), cy(Y) { memset(g, 0, 256); memset(b, 0, 256); memset(o, 0, 256); memset(m, 0, 256); memset(mod, 0, 256); }
};
struct ModTile { u16 i; u8 g, b, o, m; };

struct World {
  u32 seed = 1, S[8]; std::unordered_map<i64, std::unique_ptr<Chunk>> chunks; std::unordered_map<i64, std::vector<ModTile>> saved;
  std::unordered_map<i64, std::unique_ptr<Village>> villages; std::unordered_map<i64, std::vector<Slot>> chests;
  Chunk* lastC = nullptr; int frame = 0;
  void init(u32 sd) { seed = sd; for (int k = 1; k <= 8; k++) S[k - 1] = hash2i(k, 99, seed) % 100000; chunks.clear(); saved.clear(); villages.clear(); chests.clear(); lastC = nullptr; }

  struct Samp { float e, m, t, h; bool river; };
  Samp sample(int x, int y) const {
    float d0 = std::hypot((float)x, (float)y);
    float e = fbm(x / 120.f, y / 120.f, S[0], 5) * 0.72f + fbm(x / 420.f, y / 420.f, S[1], 3) * 0.38f - 0.05f;
    e += std::max(0.f, 1 - d0 / 70) * 0.32f;
    float m = fbm(x / 85.f + 300, y / 85.f, S[2], 4);
    float t = fbm(x / 260.f, y / 260.f + 50, S[3], 3) + std::max(0.f, 1 - d0 / 180) * 0.25f;
    float h = fbm(x / 64.f, y / 64.f, S[4], 4) - std::max(0.f, 1 - d0 / 60) * 0.25f;
    float rv = fbm(x / 190.f, y / 190.f, S[5], 3);
    bool river = std::fabs(rv - 0.5f) < 0.0105f + fbm(x / 30.f, y / 30.f, S[6], 2) * 0.006f && d0 > 34 && e < 0.66f;
    return {e, m, t, h, river};
  }
  int biomeAt(int x, int y) const {
    Samp s = sample(x, y);
    if (s.e < 0.34f) return BI_DEEP; if (s.e < 0.4f || s.river) return BI_WATER; if (s.e < 0.425f) return BI_BEACH;
    if (s.h > 0.6f && s.e > 0.44f) return BI_ROCK; if (s.t < 0.33f) return BI_SNOW; if (s.e < 0.47f && s.m > 0.58f) return BI_MARSH;
    if (s.m > 0.585f) return BI_FOREST; if (fbm(x / 46.f, y / 46.f, S[7], 3) > 0.63f) return BI_SAKURA; return BI_MEADOW;
  }
  Tile base(int x, int y) const {
    Samp s = sample(x, y); auto H = [&](int k) { return hash2(x, y, seed + k); };
    u8 g = G_GRASS, b = 0, o = 0, m = 0;
    if (s.e < 0.34f) g = G_DEEP;
    else if (s.e < 0.4f || s.river) { g = G_WATER; if (H(1) < 0.025f && s.e > 0.37f) o = O_LILY; }
    else if (s.e < 0.425f) { g = G_SAND; float r = H(2); if (r < 0.012f) o = O_PEBBLE; else if (r < 0.016f) o = O_BOULDER; }
    else if (s.h > 0.6f && s.e > 0.44f) {
      g = G_ROCK;
      if (s.h > 0.632f) {
        b = s.h > 0.7f ? B_DARK : B_STONE;
        float v1 = fbm(x / 5.f, y / 5.f, S[1] + 7, 2), v2 = fbm(x / 6.f, y / 6.f, S[2] + 9, 2), v3 = fbm(x / 4.f, y / 4.f, S[3] + 11, 2);
        if (v1 > 0.69f) b = B_COAL; if (s.h > 0.655f && v2 > 0.71f) b = B_IRON; if (s.h > 0.685f && v3 > 0.74f) b = B_GOLD; if (s.h > 0.7f && H(3) < 0.012f) b = B_GEM;
      } else if (fbm(x / 9.f, y / 9.f, S[5] + 13, 2) > 0.7f && s.h < 0.62f) g = G_ONSEN;
      else { float r = H(4); if (r < 0.04f) o = O_BOULDER; else if (r < 0.08f) o = O_PEBBLE; else if (r < 0.095f) o = O_PINE; }
    }
    else if (s.t < 0.33f) { g = G_SNOW; float r = H(5); if (r < 0.09f) o = O_PINE; else if (r < 0.105f) o = O_BOULDER; else if (r < 0.12f) o = O_DEADTREE; else if (r < 0.13f) o = O_BERRY; }
    else if (s.e < 0.47f && s.m > 0.58f) {
      g = G_MARSH; if (fbm(x / 7.f, y / 7.f, S[4] + 3, 2) > 0.64f) { g = G_WATER; if (H(6) < 0.08f) o = O_LILY; }
      else { float r = H(7); if (r < 0.1f) o = O_REEDS; else if (r < 0.13f) o = O_DEADTREE; else if (r < 0.16f) o = O_MUSHROOM; else if (r < 0.2f) o = O_TALLGRASS; }
    }
    else if (s.m > 0.585f) {
      g = G_FOREST; float r = H(8), k = H(9); bool bam = fbm(x / 30.f, y / 30.f, S[6] + 5, 2) > 0.66f;
      if (bam && r < 0.26f) o = O_BAMBOO; else if (r < 0.2f) o = k < 0.45f ? O_OAK : k < 0.8f ? O_PINE : O_BIRCH;
      else if (r < 0.23f) o = O_MUSHROOM; else if (r < 0.27f) o = O_BUSH; else if (r < 0.285f) o = O_BERRY; else if (r < 0.33f) o = O_TALLGRASS;
    }
    else if (fbm(x / 46.f, y / 46.f, S[7], 3) > 0.63f) {
      g = G_SAKURA; float r = H(10);
      if (r < 0.085f) o = O_SAKURA; else if (r < 0.13f) o = O_FLOWERS; else if (r < 0.16f) o = O_TALLGRASS; else if (r < 0.17f) o = O_BOULDER;
    } else {
      float r = H(11); bool dry = s.m < 0.42f;
      if (r < (dry ? 0.012f : 0.03f)) o = H(12) < 0.8f ? O_OAK : O_BIRCH; else if (r < 0.05f) o = O_BUSH; else if (r < 0.06f) o = O_BERRY; else if (r < (dry ? 0.16f : 0.11f)) o = O_TALLGRASS;
      else if (r < 0.14f) o = O_FLOWERS; else if (r < 0.147f) o = O_BOULDER; else if (r < 0.152f) o = O_PEBBLE;
    }
    if (!o && !b && (g == G_GRASS || g == G_FOREST || g == G_SAKURA || g == G_SAND || g == G_SNOW)) { float q = H(31); if (q < 0.0009f && g != G_SAND) o = O_SHRINE; else if (q < 0.0026f) o = O_DIG; }
    if (o && OBJS[o].tree) m = hash2i(x, y, 77) & 3;
    if (o == O_FLOWERS || o == O_MUSHROOM || o == O_BOULDER || o == O_PEBBLE) m = hash2i(x, y, 78) & 7;
    return {g, b, o, m};
  }

  /* ---------- villages ---------- */
  Village* villageForRegion(int rx, int ry) {
    i64 key = K2(rx, ry); auto it = villages.find(key); if (it != villages.end()) return it->second.get();
    std::unique_ptr<Village> v;
    if (rx == 0 && ry == 0) v = makeVillage(rx, ry, 0, 0, true);
    else if (!(std::abs(rx) <= 1 && std::abs(ry) <= 1 && hash2(rx, ry, seed) < 0.35f)) {
      RNG r(hash2i(rx, ry, seed + 404));
      if (r.next() < 0.78f) for (int tries = 0; tries < 6 && !v; tries++) {
        int cx = (int)std::round(rx * REG + r.r(-REG * 0.3f, REG * 0.3f)), cy = (int)std::round(ry * REG + r.r(-REG * 0.3f, REG * 0.3f));
        if (std::hypot((float)cx, (float)cy) < 70) continue; bool ok = true;
        for (int k = 0; k < 13 && ok; k++) { float a = k / 12.f * TAU, rr = k == 12 ? 0 : 15; int bb = biomeAt((int)std::round(cx + std::cos(a) * rr), (int)std::round(cy + std::sin(a) * rr)); if (bb == BI_WATER || bb == BI_DEEP || bb == BI_ROCK) ok = false; }
        if (ok) v = makeVillage(rx, ry, cx, cy, false);
      }
    }
    Village* p = v.get(); villages[key] = std::move(v); return p;
  }
  std::vector<Village*> villagesNear(float x, float y, int rad = VR + 2) {
    std::vector<Village*> out; int rx0 = (int)std::floor((x - rad) / REG + 0.5f) - 1, rx1 = (int)std::floor((x + rad) / REG + 0.5f) + 1, ry0 = (int)std::floor((y - rad) / REG + 0.5f) - 1, ry1 = (int)std::floor((y + rad) / REG + 0.5f) + 1;
    for (int ry = ry0; ry <= ry1; ry++) for (int rx = rx0; rx <= rx1; rx++) { Village* v = villageForRegion(rx, ry); if (v && std::fabs(v->x - x) <= rad + VR && std::fabs(v->y - y) <= rad + VR) out.push_back(v); }
    return out;
  }
  std::unique_ptr<Village> makeVillage(int rx, int ry, int cx, int cy, bool home) {
    RNG r(hash2i(cx, cy, seed + 7)); auto v = std::make_unique<Village>(); v->rx = rx; v->ry = ry; v->x = cx; v->y = cy; v->home = home;
    v->name = home ? "Hanomi" : std::string(SYL1[r.i(0, 21)]) + SYL2[r.i(0, 15)]; v->ruler = RULERS[r.i(0, 15)]; v->color = home ? 0xe87a9a : NATION_COLORS[r.i(0, 9)]; v->temper = home ? "kind" : TEMPER[r.i(0, 4)]; v->size = home ? 1 : r.i(1, 3);
    Village& V = *v;
    auto set = [&](int x, int y, int g, int b, int o, int m) { OvT& c = V.ov[K2(x, y)]; if (g >= 0) c.g = g; if (b >= 0) c.b = b; if (o >= 0) c.o = o; if (m >= 0) c.m = m; };
    const int R2 = VR * VR;
    for (int y = -VR; y <= VR; y++) for (int x = -VR; x <= VR; x++) {
      int d2 = x * x + y * y; if (d2 > R2) continue; Tile bs = base(cx + x, cy + y); int g = bs.g; if (isWater(g) || g == G_ROCK || g == G_MARSH || g == G_SAND) g = G_GRASS;
      int o = (d2 < (VR - 4) * (VR - 4)) ? 0 : (OBJS[bs.o].tree ? 0 : bs.o);
      set(cx + x, cy + y, home ? (d2 < (VR - 3) * (VR - 3) ? G_SAKURA : G_GRASS) : g, 0, isWater(bs.g) ? 0 : o, 0);
    }
    std::unordered_set<i64> used; auto mark = [&](int x, int y, int w, int h) { for (int j = -1; j <= h; j++) for (int i = -1; i <= w; i++) used.insert(K2(x + i, y + j)); };
    auto isPath = [&](int x, int y) { auto it = V.ov.find(K2(x, y)); return it != V.ov.end() && (it->second.g == G_PATH || it->second.g == G_PLAZA); };
    auto freeA = [&](int x, int y, int w, int h) { for (int j = -1; j <= h; j++) for (int i = -1; i <= w; i++) { if (used.count(K2(x + i, y + j)) || isPath(x + i, y + j)) return false; int dx = x + i - cx, dy = y + j - cy; if (dx * dx + dy * dy > (VR - 3) * (VR - 3)) return false; } return true; };
    const int L = VR - 2; const int arms[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
    for (auto& a : arms) for (int s = -2; s <= L; s++) for (int wd = 0; wd < 2; wd++) { int px = cx + a[0] * s + (a[0] ? 0 : wd), py = cy + a[1] * s + (a[1] ? 0 : wd); set(px, py, G_PATH, 0, 0, 0); }
    int pr = home ? 3 : 2; for (int j = -pr; j <= pr + 1; j++) for (int i = -pr; i <= pr + 1; i++) set(cx + i, cy + j, G_PLAZA, 0, 0, 0);
    for (int j = -pr - 1; j <= pr + 2; j++) for (int i = -pr - 1; i <= pr + 2; i++) used.insert(K2(cx + i, cy + j));
    auto structure = [&](int kind, int x, int y, int w, int h) {
      Struct s; s.kind = kind; s.x = x; s.y = y; s.w = w; s.h = h; s.style = hash2i(x, y, seed); s.doorx = x + w / 2; s.doory = y + h - 1;
      for (int j = 0; j < h; j++) for (int i = 0; i < w; i++) set(x + i, y + j, G_DIRT, B_BLDG, 0, 0);
      set(s.doorx, s.doory, G_WOOD, 0, 0, 0); for (int i = -1; i <= w; i++) { set(x + i, y + h, G_PATH, 0, 0, 0); }
      set(s.doorx, s.doory + 1, G_PATH, 0, 0, 0); set(s.doorx, s.doory + 2, G_PATH, 0, 0, 0);
      mark(x, y, w, h); V.structs.push_back(s); return (int)V.structs.size() - 1; };
    if (home) {
      int hs = structure(3, cx - 12, cy - 10, 8, 4); V.spx = V.structs[hs].doorx; V.spy = V.structs[hs].doory + 3;
      // koi pond (water + stone rim + marker)
      for (int j = -1; j <= 4; j++) for (int i = -1; i <= 5; i++) { int X = cx + 6 + i, Y = cy - 9 + j; bool rim = j == -1 || j == 4 || i == -1 || i == 5; set(X, Y, rim ? G_COBBLE : G_WATER, 0, 0, 0); }
      set(cx + 8, cy - 5, -1, 0, O_KOI, 0); for (int k = 0; k < 4; k++) set(cx + 7 + k, cy - 8 + (k & 1) * 2, -1, 0, O_LILY, 0); mark(cx + 6, cy - 9, 5, 4);
      for (int j = 5; j < 9; j++) { set(cx - 12, cy + j, -1, 0, O_FENCE, 0); set(cx - 5, cy + j, -1, 0, O_FENCE, 0); } mark(cx - 12, cy + 4, 8, 6); set(cx - 7, cy + 7, -1, 0, O_SCARECROW, 0);
      set(cx + 3, cy + 3, -1, 0, O_BANNER, 0); V.bx = cx + 3; V.by = cy + 3; set(cx - 3, cy - 3, -1, 0, O_WELL, 0);
      V.sx = cx - 3; V.sy = cy + 3; set(V.sx, V.sy, -1, 0, O_STALL, 0); V.spawns.push_back({"merchant", V.sx, V.sy + 1}); V.spawns.push_back({"dog", cx - 6, cy - 4});
    } else {
      set(cx, cy - 2, -1, 0, O_BANNER, 0); V.bx = cx; V.by = cy - 2; set(cx + 2, cy + 2, -1, 0, O_WELL, 0);
      int hl = structure(1, cx - 4, cy - 10, 8, 4); V.hall = hl; V.spawns.push_back({"chief", V.structs[hl].doorx, V.structs[hl].doory + 2});
      V.sx = cx - 3; V.sy = cy + 3; set(V.sx, V.sy, -1, 0, O_STALL, 0); V.spawns.push_back({"merchant", V.sx, V.sy + 1});
      if (V.size >= 2) structure(2, cx + 6, cy - 10, 6, 4);
    }
    int nH = home ? 4 : 6 + V.size * 3, placed = 0; std::vector<int> hp = {4, 5, 5, 6}, hh = {3, 3, 4};
    for (int tries = 0; tries < 260 && placed < nH; tries++) {
      int w = r.pick(hp), h = r.pick(hh), x, y; bool along = tries < 90;
      if (along) { auto& arm = arms[r.i(0, 3)]; int s = r.i(6, L - 3), side = r.chance(0.5f) ? 1 : -1; if (arm[0]) { if (side > 0) continue; x = cx + arm[0] * s - (w >> 1); y = cy - h - 1; } else { y = cy + arm[1] * s - h; x = side < 0 ? cx - w - 1 : cx + 3; } }
      else { float a = r.r(0, TAU), d = r.r(7, VR - 6); x = (int)std::round(cx + std::cos(a) * d - w / 2.f); y = (int)std::round(cy + std::sin(a) * d - h / 2.f); }
      if (!freeA(x, y, w, h)) continue;
      int si = structure(0, x, y, w, h); placed++; Struct& hs2 = V.structs[si];
      int px = hs2.doorx, py = hs2.doory + 2;
      if (!isPath(px, py)) { bool horiz = std::abs(px - cx) >= std::abs(py - cy); for (int k = 0; k < 40 && !isPath(px, py); k++) { if (horiz) { if (px == cx) break; px += px < cx ? 1 : -1; } else { if (py == cy) break; py += py < cy ? 1 : -1; } if (used.count(K2(px, py)) && !isPath(px, py)) break; set(px, py, G_PATH, 0, 0, 0); } }
      V.spawns.push_back({"villager", hs2.doorx, hs2.doory + 2, si});
    }
    for (int f = 0; f < (home ? 0 : 2); f++) for (int tries = 0; tries < 30; tries++) {
      int w = r.i(5, 7), h = r.i(3, 4), x = cx + r.i(-L + 1, L - w - 1), y = cy + r.i(-L + 1, L - h - 1); if (!freeA(x - 1, y - 1, w + 2, h + 2)) continue;
      int crop = r.chance(0.4f) ? O_WHEAT : r.pick(std::vector<int>{O_CARROT, O_TOMATO, O_RICE, O_WHEAT});
      for (int j = 0; j < h; j++) for (int i = 0; i < w; i++) set(x + i, y + j, G_TILLED, 0, crop, r.i(1, 3));
      for (int i = -1; i <= w; i++) { set(x + i, y - 1, -1, 0, O_FENCE, 0); set(x + i, y + h, -1, 0, i == (w >> 1) ? O_GATE : O_FENCE, 0); }
      for (int j = 0; j < h; j++) { set(x - 1, y + j, -1, 0, O_FENCE, 0); set(x + w, y + j, -1, 0, O_FENCE, 0); } mark(x - 1, y - 1, w + 2, h + 2); break;
    }
    for (int tries = 0; tries < 30; tries++) {
      int w = 6, h = 4, x = cx + r.i(-L + 2, L - w - 2), y = cy + r.i(-L + 2, L - h - 2); if (!freeA(x - 1, y - 1, w + 2, h + 2)) continue;
      for (int i = -1; i <= w; i++) { set(x + i, y - 1, -1, 0, O_FENCE, 0); set(x + i, y + h, -1, 0, i == 2 ? O_GATE : O_FENCE, 0); }
      for (int j = 0; j < h; j++) { set(x - 1, y + j, -1, 0, O_FENCE, 0); set(x + w, y + j, -1, 0, O_FENCE, 0); } set(x + w - 1, y, -1, 0, O_HAY, 0);
      std::vector<std::string> pk = {"cow", "sheep", "chicken"}; std::vector<std::string> kinds = home ? std::vector<std::string>{"chicken", "chicken", "chicken"} : std::vector<std::string>{r.pick(pk), r.pick(pk), "chicken"};
      for (size_t k = 0; k < kinds.size(); k++) { Spawn s{kinds[k], x + 1 + (int)k * 2, y + 2}; s.pen = true; s.px = x; s.py = y; s.pw = w; s.ph = h; V.spawns.push_back(s); }
      mark(x - 1, y - 1, w + 2, h + 2); break;
    }
    for (auto& a : arms) for (int s = 7; s < L - 1; s += 6) { int px = cx + a[0] * s + (a[1] ? (s % 12 ? 3 : -2) : 0), py = cy + a[1] * s + (a[0] ? (s % 12 ? -2 : 3) : 0); if (!used.count(K2(px, py))) { set(px, py, -1, 0, O_LANTERN, 0); used.insert(K2(px, py)); } }
    set(cx, cy + L - 1, -1, 0, O_TORII, 0);
    static const int decor[] = {O_BARREL, O_CRATE, O_FLOWERS, O_SAKURA, O_FLOWERS, O_BUSH, O_SAKURA, O_OAK};
    for (int k = 0; k < 14; k++) { int x = cx + r.i(-L, L), y = cy + r.i(-L, L); i64 key = K2(x, y); auto it = V.ov.find(key); if (used.count(key) || it == V.ov.end() || it->second.g == G_PATH || it->second.g == G_PLAZA || it->second.b > 0) continue; if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > (VR - 4) * (VR - 4)) continue; set(x, y, -1, 0, decor[r.i(0, 7)], r.i(0, 3)); used.insert(key); }
    if (!home) for (int k = 0; k < 2 + V.size; k++) V.spawns.push_back({"guard", cx + r.i(-3, 3), cy + r.i(4, 6)});
    if (home) for (int k = 0; k < 2; k++) V.spawns.push_back({"villager", cx + r.i(-2, 2), cy + 5});
    return v;
  }

  /* ---------- chunks ---------- */
  Chunk* chunk(int cx, int cy) {
    if (lastC && lastC->cx == cx && lastC->cy == cy) return lastC;
    i64 k = K2(cx, cy); auto it = chunks.find(k); Chunk* c;
    if (it == chunks.end()) { auto n = std::make_unique<Chunk>(cx, cy); c = n.get(); genChunk(*c); chunks[k] = std::move(n); } else c = it->second.get();
    c->lastUse = frame; lastC = c; return c;
  }
  Chunk* peek(int cx, int cy) { auto it = chunks.find(K2(cx, cy)); return it == chunks.end() ? nullptr : it->second.get(); }
  void genChunk(Chunk& c) {
    int x0 = c.cx * CS, y0 = c.cy * CS; auto vs = villagesNear(x0 + CS / 2.f, y0 + CS / 2.f, CS);
    for (int j = 0; j < CS; j++) for (int i = 0; i < CS; i++) {
      int x = x0 + i, y = y0 + j, idx = j * CS + i; Tile t = base(x, y);
      for (Village* v : vs) { auto it = v->ov.find(K2(x, y)); if (it != v->ov.end()) { const OvT& o = it->second; if (o.g >= 0) t.g = o.g; if (o.b >= 0) t.b = o.b; if (o.o >= 0) t.o = o.o; if (o.m >= 0) t.m = o.m; break; } }
      c.g[idx] = t.g; c.b[idx] = t.b; c.o[idx] = t.o; c.m[idx] = t.m; if (isWater(t.g)) c.water = true;
    }
    auto sv = saved.find(K2(c.cx, c.cy));
    if (sv != saved.end()) for (auto& t : sv->second) { c.g[t.i] = t.g; c.b[t.i] = t.b; c.o[t.i] = t.o; c.m[t.i] = t.m; if (!c.mod[t.i]) { c.mod[t.i] = 1; c.nmod++; } if (isWater(t.g)) c.water = true; }
  }
  Chunk* at(int x, int y, int& idx) { int cx = fdiv(x, CS), cy = fdiv(y, CS); Chunk* c = chunk(cx, cy); idx = (y - cy * CS) * CS + (x - cx * CS); return c; }
  int ground(int x, int y) { int i; return at(x, y, i)->g[i]; }
  int block(int x, int y) { int i; return at(x, y, i)->b[i]; }
  int obj(int x, int y) { int i; return at(x, y, i)->o[i]; }
  int meta(int x, int y) { int i; return at(x, y, i)->m[i]; }
  void setM(int x, int y, int m) { int i; Chunk* c = at(x, y, i); c->m[i] = m; mark(*c, i); }
  void mark(Chunk& c, int i) { if (!c.mod[i]) { c.mod[i] = 1; c.nmod++; } }
  void set(int x, int y, int g, int b, int o, int m = -1) { // -1 = unchanged
    int i; Chunk* c = at(x, y, i); u8 og = c->g[i], ob = c->b[i];
    if (g >= 0) c->g[i] = g; if (b >= 0) c->b[i] = b; if (o >= 0) c->o[i] = o; if (m >= 0) c->m[i] = m; mark(*c, i);
    if (g >= 0 && g != og) { c->dirty = true; if (isWater(g)) c->water = true; dirtyNb(*c, i); }
    if (b >= 0 && b != ob) { c->rv++; c->dirty = true; dirtyNb(*c, i); }
  }
  void dirtyNb(Chunk& c, int i) {
    int lx = i % CS, ly = i / CS; int xs[3] = {0, 0, 0}, ys[3] = {0, 0, 0}, nx = 1, ny = 1;
    if (lx <= 1) xs[nx++] = -1; if (lx >= CS - 2) xs[nx++] = 1; if (ly <= 1) ys[ny++] = -1; if (ly >= CS - 2) ys[ny++] = 1;
    for (int a = 0; a < nx; a++) for (int b = 0; b < ny; b++) if (xs[a] || ys[b]) { Chunk* n = peek(c.cx + xs[a], c.cy + ys[b]); if (n) n->dirty = true; }
  }
  int depth(int x, int y) { // 0 dry, 1 shallow, 2 deep
    int g = ground(x, y); if (!isWater(g)) return 0; if (g == G_DEEP) return 2;
    for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) if ((dx || dy) && !isWater(ground(x + dx, y + dy))) return 1; return 2;
  }
  bool solid(int x, int y, bool swim) {
    int i; Chunk* c = at(x, y, i); if (c->b[i]) return true; int g = c->g[i];
    if (!swim && isWater(g) && depth(x, y) == 2) return true;
    int o = c->o[i]; if (o && OBJS[o].solid) { if (o == O_GATE && (c->m[i] & 1)) return false; return true; } return false;
  }
  void unloadFar(float px, float py, int keep = 6) {
    int cx = (int)std::floor(px / CS), cy = (int)std::floor(py / CS); lastC = nullptr;
    for (auto it = chunks.begin(); it != chunks.end();) {
      Chunk& c = *it->second; if (std::abs(c.cx - cx) > keep || std::abs(c.cy - cy) > keep) {
        if (c.nmod) { auto& v = saved[it->first]; v.clear(); for (int i = 0; i < 256; i++) if (c.mod[i]) v.push_back({(u16)i, c.g[i], c.b[i], c.o[i], c.m[i]}); }
        it = chunks.erase(it);
      } else ++it;
    }
  }
  void collectMods(std::unordered_map<i64, std::vector<ModTile>>& out) {
    out = saved; for (auto& kv : chunks) { Chunk& c = *kv.second; if (!c.nmod) continue; auto& v = out[kv.first]; v.clear(); for (int i = 0; i < 256; i++) if (c.mod[i]) v.push_back({(u16)i, c.g[i], c.b[i], c.o[i], c.m[i]}); }
  }
};
