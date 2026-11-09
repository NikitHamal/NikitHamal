// Hanomi native - embedded sprite atlas (res/assets.bin, exported from the ORIGINAL web art code by tools/export_assets.mjs).
#pragma once
#include "spr.h"
#ifdef _WIN32
__asm__(".section .rdata,\"dr\"\n.global hanomi_assets\nhanomi_assets:\n.incbin \"res/assets.bin\"\n.global hanomi_assets_end\nhanomi_assets_end:\n.byte 0\n.text\n");
#else
__asm__(".section .rodata\n.global hanomi_assets\nhanomi_assets:\n.incbin \"res/assets.bin\"\n.global hanomi_assets_end\nhanomi_assets_end:\n.byte 0\n.text\n");
#endif
extern "C" const unsigned char hanomi_assets[], hanomi_assets_end[];

struct SLight { int x, y, w, h; bool lantern; };
struct Sprite { std::string name; int w = 0, h = 0, ax = 0, ay = 0, shx = -1, shy = -1; Img img, flip; std::vector<SLight> lights; std::vector<u8> mask; };
struct DogMeta { int w, h, ox, oy; };
struct Assets {
  std::unordered_map<std::string, Sprite> map; std::unordered_map<std::string, DogMeta> dogs;
  const Sprite* find(const std::string& n) const { auto it = map.find(n); return it == map.end() ? nullptr : &it->second; }
  const Sprite& get(const std::string& n) const { static Sprite none; auto it = map.find(n); return it == map.end() ? none : it->second; }
};
static Assets AS;
static void lz4Decode(const u8* s, size_t n, u8* d, size_t dn) {
  size_t i = 0, o = 0;
  while (i < n) {
    int tok = s[i++]; size_t lit = tok >> 4; if (lit == 15) { int b; do { b = s[i++]; lit += b; } while (b == 255); }
    memcpy(d + o, s + i, lit); i += lit; o += lit; if (i >= n) break;
    size_t off = s[i] | (s[i + 1] << 8); i += 2; size_t ml = (tok & 15); if (ml == 15) { int b; do { b = s[i++]; ml += b; } while (b == 255); } ml += 4;
    for (size_t k = 0; k < ml; k++) { d[o] = d[o - off]; o++; }
  }
  (void)dn;
}
// ABGR (canvas byte order) -> ARGB
static inline u32 abgr2argb(u32 c) { return (c & 0xff00ff00u) | ((c & 255) << 16) | ((c >> 16) & 255); }
static void loadAssets() {
  size_t total = hanomi_assets_end - hanomi_assets; const u8* p = hanomi_assets; u32 rawLen; memcpy(&rawLen, p, 4);
  std::vector<u8> raw(rawLen + 16); lz4Decode(p + 4, total - 4, raw.data(), rawLen);
  const u8* r = raw.data(); auto u16_ = [&]() { int v = r[0] | (r[1] << 8); r += 2; return v; }; auto i16_ = [&]() { return (int)(int16_t)u16_(); };
  u32 magic, n; memcpy(&magic, r, 4); r += 4; memcpy(&n, r, 4); r += 4;
  for (u32 k = 0; k < n; k++) {
    int nl = u16_(); Sprite s; s.name.assign((const char*)r, nl); r += nl; s.w = u16_(); s.h = u16_(); s.ax = i16_(); s.ay = i16_(); s.shx = i16_(); s.shy = i16_();
    int nlights = r[0], hasMask = r[1]; r += 2;
    for (int i = 0; i < nlights; i++) { SLight L; L.x = i16_(); L.y = i16_(); L.w = i16_(); L.h = i16_(); L.lantern = *r++; s.lights.push_back(L); }
    s.img.alloc(s.w, s.h); for (int i = 0; i < s.w * s.h; i++) { u32 c; memcpy(&c, r + i * 4, 4); s.img.p[i] = abgr2argb(c); } r += (size_t)s.w * s.h * 4;
    if (hasMask) { s.mask.assign(r, r + (size_t)s.w * s.h); r += (size_t)s.w * s.h; }
    s.flip.alloc(s.w, s.h); for (int y = 0; y < s.h; y++) for (int x = 0; x < s.w; x++) s.flip.p[(size_t)y * s.w + x] = s.img.p[(size_t)y * s.w + s.w - 1 - x];
    std::string key = s.name; AS.map.emplace(key, std::move(s));
  }
  int nd = u16_(); for (int i = 0; i < nd; i++) { int l = *r++; std::string b((const char*)r, l); r += l; DogMeta m; m.w = u16_(); m.h = u16_(); m.ox = u16_(); m.oy = u16_(); AS.dogs[b] = m; }
}
// house sprite with the nation colour applied through the exported class mask
static std::unordered_map<std::string, Sprite> houseCache;
static const Sprite* houseSprite(int w, int h, int style, bool hall, int color) {
  char key[64]; snprintf(key, 64, "house:%d:%d:%d:%d", w, h, style, hall ? 1 : 0); std::string k2 = std::string(key) + ":" + std::to_string(color);
  auto it = houseCache.find(k2); if (it != houseCache.end()) return &it->second;
  const Sprite* b = AS.find(key); if (!b) return nullptr; Sprite s = *b; int cand[3] = {color, mulh(color, 0.7), mixh(color, 0xffffff, 0.25)};
  for (size_t i = 0; i < s.mask.size(); i++) { int m = s.mask[i]; if (!m) continue; int c = m <= 3 ? cand[m - 1] : mulh(cand[m - 4], 0.85); s.img.p[i] = argb(c); }
  int W = s.w; for (int y = 0; y < s.h; y++) for (int x = 0; x < W; x++) s.flip.p[(size_t)y * W + x] = s.img.p[(size_t)y * W + W - 1 - x];
  return &houseCache.emplace(k2, std::move(s)).first->second;
}
