// Hanomi native - multi-world save system (v3): one file per world in <AppData>/Hanomi/worlds/*.hsav,
// atomic writes with .bak rollback, header metadata for the world browser, legacy hanomi.sav import.
#pragma once
#include "game.h"
#include <ctime>
#include <sys/stat.h>
#ifndef _WIN32
#include <dirent.h>
#include <unistd.h>
#endif

struct SaveMeta { std::string path, id, name = "Unnamed world", diff = "normal", dog = "Kuma", breed = "bernese"; u32 seed = 0; int day = 1, skin = 1, hair = 1, shirt = 0, style = 0; double playTime = 0; i64 ts = 0; bool ok = false, legacy = false; size_t size = 0; };

namespace Sv {
  static const u32 MAGIC2 = 0x324D4E48, MAGIC3 = 0x334D4E48, BODY = 0x42444E48;
  static std::string join(const std::string& a, const std::string& b) { if (a.empty()) return b; char c = a.back(); return (c == '/' || c == '\\') ? a + b : a + "/" + b; }
  static std::string worldsDir(const std::string& dir) { return join(dir, "worlds"); }
  static bool mkdirs(const std::string& p) {
#ifdef _WIN32
    CreateDirectoryA(p.c_str(), nullptr); DWORD a = GetFileAttributesA(p.c_str()); return a != INVALID_FILE_ATTRIBUTES && (a & FILE_ATTRIBUTE_DIRECTORY);
#else
    if (mkdir(p.c_str(), 0755) != 0) {} struct stat st; return stat(p.c_str(), &st) == 0 && S_ISDIR(st.st_mode);
#endif
  }
  static bool exists(const std::string& p) { struct stat st; return stat(p.c_str(), &st) == 0; }
  static bool del(const std::string& p) {
#ifdef _WIN32
    return DeleteFileA(p.c_str()) != 0;
#else
    return ::remove(p.c_str()) == 0;
#endif
  }
  static bool move(const std::string& a, const std::string& b) {
#ifdef _WIN32
    return MoveFileExA(a.c_str(), b.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_COPY_ALLOWED) != 0;
#else
    return ::rename(a.c_str(), b.c_str()) == 0;
#endif
  }
  static bool readAll(const std::string& p, std::string& out, size_t maxBytes = (size_t)1 << 30) {
    FILE* f = fopen(p.c_str(), "rb"); if (!f) return false; out.clear(); char tmp[65536]; size_t n; while ((n = fread(tmp, 1, sizeof tmp, f)) > 0) { out.append(tmp, n); if (out.size() > maxBytes) break; } fclose(f); return true; }
  static bool writeAll(const std::string& p, const char* d, size_t n) { FILE* f = fopen(p.c_str(), "wb"); if (!f) return false; size_t w = fwrite(d, 1, n, f); bool ok = (w == n) && fflush(f) == 0; fclose(f); return ok; }
  static bool copy(const std::string& a, const std::string& b) { std::string d; if (!readAll(a, d)) return false; return writeAll(b, d.data(), d.size()); }
  static std::vector<std::string> list(const std::string& dir, const std::string& ext) {
    std::vector<std::string> r;
#ifdef _WIN32
    WIN32_FIND_DATAA fd; HANDLE h = FindFirstFileA(join(dir, "*" + ext).c_str(), &fd); if (h == INVALID_HANDLE_VALUE) return r;
    do { if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY)) { std::string n = fd.cFileName; if (n.size() >= ext.size() && n.compare(n.size() - ext.size(), ext.size(), ext) == 0) r.push_back(n); } } while (FindNextFileA(h, &fd)); FindClose(h);
#else
    DIR* d = opendir(dir.c_str()); if (!d) return r; while (dirent* e = readdir(d)) { std::string n = e->d_name; if (n.size() >= ext.size() && n.compare(n.size() - ext.size(), ext.size(), ext) == 0) r.push_back(n); } closedir(d);
#endif
    return r;
  }
  static i64 mtime(const std::string& p) { struct stat st; if (stat(p.c_str(), &st) != 0) return 0; return (i64)st.st_mtime; }
  static std::string newId() { static int ctr = 0; char b[64]; snprintf(b, 64, "w%lld%02d%03d", (long long)time(nullptr), ctr++ % 100, (int)(rand() % 1000)); return b; }
  static std::string fmtDate(i64 ts) { if (ts <= 0) return "-"; time_t t = (time_t)ts; struct tm* m = localtime(&t); if (!m) return "-"; char b[48]; strftime(b, sizeof b, "%b %d, %H:%M", m); return b; }
  static std::string fmtDur(double s) { int m = (int)(s / 60); char b[32]; if (m < 60) snprintf(b, 32, "%dm", m); else snprintf(b, 32, "%dh %02dm", m / 60, m % 60); return b; }
}

struct BW { std::string b; template <class T> void p(T v) { b.append((const char*)&v, sizeof v); } void s(const std::string& x) { p<u32>((u32)x.size()); b += x; } };
struct BR { const char* d; size_t n, i = 0; bool ok = true;
  template <class T> T g() { T v{}; if (i + sizeof v > n) { ok = false; return v; } memcpy(&v, d + i, sizeof v); i += sizeof v; return v; }
  std::string s() { u32 l = g<u32>(); if (!ok || i + l > n) { ok = false; return ""; } std::string r(d + i, l); i += l; return r; }
  u32 cnt(u32 lim = 4000000) { u32 v = g<u32>(); if (v > lim || (size_t)v > n) { ok = false; return 0; } return v; } };

namespace Sv {
  // header: magic, name, seed, difficulty, day, playTime, timestamp, dog, breed, skin, hair, shirt, style
  static bool parseMeta(const std::string& buf, SaveMeta& m) {
    BR r{buf.data(), buf.size()}; u32 mg = r.g<u32>();
    if (mg == MAGIC3) { m.name = r.s(); m.seed = r.g<u32>(); m.diff = r.s(); m.day = r.g<int>(); m.playTime = r.g<double>(); m.ts = r.g<i64>(); m.dog = r.s(); m.breed = r.s(); m.skin = r.g<int>(); m.hair = r.g<int>(); m.shirt = r.g<int>(); m.style = r.g<int>(); m.ok = r.ok; return r.ok; }
    if (mg == MAGIC2) { m.legacy = true; m.name = r.s(); m.seed = r.g<u32>(); m.diff = r.s(); m.skin = r.g<int>(); m.hair = r.g<int>(); m.shirt = r.g<int>(); m.style = r.g<int>(); m.breed = r.s(); m.dog = r.s(); double clk = r.g<double>(); m.day = (int)std::floor(clk / DAY_LEN) + 1; m.ok = r.ok; return r.ok; }
    return false; }
  static bool readMeta(const std::string& path, SaveMeta& m) {
    m.path = path; m.size = 0; FILE* f = fopen(path.c_str(), "rb"); if (!f) return false; char tmp[4096]; size_t n = fread(tmp, 1, sizeof tmp, f); fseek(f, 0, SEEK_END); m.size = (size_t)ftell(f); fclose(f);
    bool ok = parseMeta(std::string(tmp, n), m); if (m.ts <= 0) m.ts = mtime(path); return ok; }
  // list every world (newest first). Imports the pre-v3 single-slot hanomi.sav once.
  static std::vector<SaveMeta> scan(const std::string& dir) {
    std::string wd = worldsDir(dir); mkdirs(dir); mkdirs(wd);
    std::string legacy = join(dir, "hanomi.sav"); if (exists(legacy)) { std::string dst = join(wd, "imported.hsav"); if (!exists(dst)) { if (copy(legacy, dst)) move(legacy, legacy + ".migrated"); } else move(legacy, legacy + ".migrated"); }
    std::vector<SaveMeta> r; for (auto& n : list(wd, ".hsav")) { SaveMeta m; m.id = n.substr(0, n.size() - 5); if (readMeta(join(wd, n), m)) r.push_back(m); else { std::string bak = join(wd, n) + ".bak"; SaveMeta b; b.id = m.id; if (exists(bak) && readMeta(bak, b)) { b.path = join(wd, n); r.push_back(b); } else { m.ok = false; m.name = "Damaged world (" + m.id + ")"; r.push_back(m); } } }
    std::sort(r.begin(), r.end(), [](const SaveMeta& a, const SaveMeta& b) { return a.ts > b.ts; }); return r; }
  static bool deleteWorld(const std::string& path) { bool a = del(path); del(path + ".bak"); del(path + ".tmp"); return a || !exists(path); }
  static std::string uniquePath(const std::string& dir) { std::string wd = worldsDir(dir); mkdirs(dir); mkdirs(wd); for (int i = 0; i < 50; i++) { std::string p = join(wd, newId() + ".hsav"); if (!exists(p)) return p; } return join(wd, newId() + "x.hsav"); }
  // rewrite only the name of a world: simplest robust approach is to load header + patch by re-encoding the header.
  static bool renameWorld(const std::string& path, const std::string& nn) {
    std::string buf; if (!readAll(path, buf)) return false; SaveMeta m; if (!parseMeta(buf, m) || m.legacy) { if (!m.legacy) return false; }
    BR r{buf.data(), buf.size()}; u32 mg = r.g<u32>(); BW w; w.p<u32>(MAGIC3);
    if (mg == MAGIC3) { r.s(); w.s(nn); size_t from = r.i; w.b.append(buf, from, std::string::npos); }
    else { return false; }
    std::string tmp = path + ".tmp"; if (!writeAll(tmp, w.b.data(), w.b.size())) return false; copy(path, path + ".bak"); return move(tmp, path); }
}

bool Game::saveGame(bool) {
  if (!player) return false; if (savePath.empty()) savePath = Sv::uniquePath(saveDir);
  BW w; w.p<u32>(Sv::MAGIC3); w.s(opts.name); w.p(opts.seed); w.s(opts.difficulty); w.p<int>(day); w.p<double>(playTime); w.p<i64>((i64)time(nullptr)); w.s(opts.dogName); w.s(opts.breed); w.p(opts.skin); w.p(opts.hair); w.p(opts.shirt); w.p(opts.style);
  w.p<u32>(Sv::BODY); w.s(opts.name); w.p(opts.seed); w.s(opts.difficulty); w.p(opts.skin); w.p(opts.hair); w.p(opts.shirt); w.p(opts.style); w.s(opts.breed); w.s(opts.dogName);
  w.p<double>(clock); w.p<double>(weather.rain); w.p<double>(weather.target); w.p<double>(weather.t); w.p<int>(goal); w.p<int>(koiFeeds); w.p<int>(koiDay); w.p<int>(stats.zombies); w.p<int>(stats.fish); w.p<int>(stats.built); w.p<int>(stats.eaten); w.p<int>(stats.born); w.p<int>(stats.harvested); w.p<int>(stats.mined); w.p<int>(stats.chopped); w.p<int>(stats.fetches); w.p<int>(stats.prayed); w.p<int>(stats.dug); w.p<int>(stats.tasks); w.p<double>(playTime);
  w.p<u32>((u32)stats.made.size()); for (auto& m : stats.made) w.s(m); w.p<u32>((u32)prayed.size()); for (auto& kv : prayed) { w.s(kv.first); w.p<int>(kv.second); } w.p<u8>(hasSpawnPoint); w.p<double>(spawnX); w.p<double>(spawnY);
  w.p<u32>((u32)nations.size()); for (auto& kv : nations) { Nation& n = kv.second; w.s(n.id); w.s(n.name); w.s(n.ruler); w.s(n.temper); w.s(n.status); w.p<int>(n.color); w.p<double>(n.rel); w.p<u8>(n.spawned); w.p<u8>(n.met); w.p<double>(n.x); w.p<double>(n.y); w.p<u8>(n.hasQuest); w.s(n.questId); w.p<int>(n.questN); w.p<int>(n.questReward); }
  Ent* p = player.get(); w.p<double>(p->x); w.p<double>(p->y); w.p<double>(p->hp); w.p<double>(p->food); w.p<int>(p->sel); w.p<int>(p->coins); w.p<double>(p->buff); w.p<int>(opts.skin); w.p<int>(opts.hair); w.s(p->armor.id); w.p<int>(p->armor.n); w.p<int>(p->armor.d); for (auto& s : p->inv) { w.s(s.id); w.p<int>(s.n); w.p<int>(s.d); }
  { std::unordered_map<i64, std::vector<SavedTile>> all = world.saved; for (auto& kv : world.chunks) { Chunk* c = kv.second.get(); if (c->mod.empty()) continue; std::vector<SavedTile> a; for (int i : c->mod) a.push_back({i, c->g[i], c->b[i], c->o[i], c->m[i]}); all[kv.first] = a; } w.p<u32>((u32)all.size()); for (auto& kv : all) { w.p<i64>(kv.first); w.p<u32>((u32)kv.second.size()); for (auto& t : kv.second) { w.p<u16>((u16)t.idx); w.p<u8>((u8)t.g); w.p<u8>((u8)t.b); w.p<u8>((u8)t.o); w.p<u8>((u8)t.m); } } }
  w.p<u32>((u32)world.chests.size()); for (auto& kv : world.chests) { w.s(kv.first); w.p<u32>((u32)kv.second.size()); for (auto& s : kv.second) { w.s(s.first); w.p<int>(s.second.first); w.p<int>(s.second.second); } }
  w.p<u32>((u32)interiors.size()); for (auto& kv : interiors) { Room& r = kv.second; w.s(r.key); w.s(r.vid); w.s(r.kind); w.p<int>(r.si); w.p<int>(r.x); w.p<int>(r.y); w.p<int>(r.w); w.p<int>(r.h); w.p<double>(r.retx); w.p<double>(r.rety); } w.s(inside ? inside->key : std::string());
  std::vector<Ent*> sv; for (auto& e : ents) if (!e->dead && e->persist && (e->kind == E_VILLAGER || e->kind == E_SOLDIER || e->kind == E_DOG || e->kind == E_ANIMAL) && !(e->kind == E_SOLDIER && !e->mine && e->order == "raid")) sv.push_back(e.get()); w.p<u32>((u32)sv.size());
  for (Ent* e : sv) { w.p<u8>((u8)e->kind); w.p<double>(e->x); w.p<double>(e->y); w.p<double>(e->hp); w.s(e->vid); w.s(e->role); w.p<unsigned>(e->seed); w.p<double>(e->hx); w.p<double>(e->hy); w.s(e->name); w.p<int>(e->doorX); w.p<int>(e->doorY); w.p<int>(e->homeSi); w.p<u8>(e->archer); w.p<u8>(e->mine); w.p<int>(e->color); w.s(e->order); w.p<double>(e->postX); w.p<double>(e->postY); w.p<int>(e->slot); w.s(e->breed); w.p<u8>(e->owned); w.p<double>(e->love); w.s(e->akind); w.p<u8>(e->hasPen); w.p<double>(e->baby); w.p<double>(e->produceT); w.p<u8>(e->shorn); }
  w.p<u32>(0x444E4548);  // end marker: detects truncated files
  Sv::mkdirs(saveDir); Sv::mkdirs(Sv::worldsDir(saveDir)); std::string tmp = savePath + ".tmp";
  if (!Sv::writeAll(tmp, w.b.data(), w.b.size())) { loadErr = "Could not write the save file (disk full or folder locked)."; return false; }
  if (Sv::exists(savePath)) Sv::copy(savePath, savePath + ".bak");
  if (!Sv::move(tmp, savePath)) { if (!Sv::writeAll(savePath, w.b.data(), w.b.size())) { loadErr = "Could not replace the save file."; return false; } Sv::del(tmp); }
  hasSave = true; return true; }

bool Game::loadGame() { return loadFile(savePath); }
bool Game::loadFile(const std::string& path) {
  loadErr.clear(); std::string buf; bool got = Sv::readAll(path, buf) && !buf.empty(); std::string bak = path + ".bak";
  if (got) { savePath = path; if (loadBuf(buf)) return true; }
  std::string why = got ? (loadErr.empty() ? "the file is damaged" : loadErr) : "the file is missing";
  if (Sv::readAll(bak, buf) && !buf.empty()) { savePath = path; if (loadBuf(buf)) { toast("Recovered from backup save.", "hint"); return true; } }
  player.reset(); ents.clear(); loadErr = "Could not load this world: " + why + "."; return false; }

bool Game::loadBuf(const std::string& buf) {
  BR r{buf.data(), buf.size()}; u32 mg = r.g<u32>(); int ver = 2;
  if (mg == Sv::MAGIC3) { SaveMeta m; if (!Sv::parseMeta(buf, m)) { loadErr = "header unreadable"; return false; } r.s(); r.g<u32>(); r.s(); r.g<int>(); r.g<double>(); r.g<i64>(); r.s(); r.s(); r.g<int>(); r.g<int>(); r.g<int>(); r.g<int>(); if (r.g<u32>() != Sv::BODY) { loadErr = "body marker missing"; return false; } ver = 3; }
  else if (mg != Sv::MAGIC2) { loadErr = "not a Hanomi save"; return false; }
  if (ver == 3) { u32 endm; memcpy(&endm, buf.data() + buf.size() - 4, 4); if (endm != 0x444E4548) { loadErr = "file is truncated"; return false; } }
  GameOpts o; o.name = r.s(); o.seed = r.g<u32>(); o.difficulty = r.s(); o.skin = r.g<int>(); o.hair = r.g<int>(); o.shirt = r.g<int>(); o.style = r.g<int>(); o.breed = r.s(); o.dogName = r.s(); if (!r.ok) { loadErr = "header unreadable"; return false; }
  opts = o; world.init(o.seed); ents.clear(); nations.clear(); fx = FX(); diff = o.difficulty == "peaceful" ? 0 : o.difficulty == "hard" ? 1.6 : 1; raidOn = false; interiors.clear(); inside = nullptr; toasts.clear(); dmg.clear(); shakeTiles.clear(); stats = {}; modalEnt = nullptr; fading = false; fadeState = 0; fadeT = 0; fadeCb = nullptr; sleeping = false; sleepCb = nullptr; deathCb = nullptr; hitstop = 0; bannerTime = 0; player.reset(); grid.clear();
  clock = r.g<double>(); weather.rain = r.g<double>(); weather.target = r.g<double>(); weather.t = r.g<double>(); goal = r.g<int>(); koiFeeds = r.g<int>(); koiDay = r.g<int>(); stats.zombies = r.g<int>(); stats.fish = r.g<int>(); stats.built = r.g<int>(); stats.eaten = r.g<int>(); stats.born = r.g<int>(); stats.harvested = r.g<int>(); stats.mined = r.g<int>(); stats.chopped = r.g<int>(); stats.fetches = r.g<int>(); stats.prayed = r.g<int>(); stats.dug = r.g<int>(); stats.tasks = r.g<int>(); playTime = r.g<double>();
  u32 k = r.cnt(); for (u32 i = 0; i < k && r.ok; i++) stats.made.insert(r.s()); k = r.cnt(); prayed.clear(); for (u32 i = 0; i < k && r.ok; i++) { std::string key = r.s(); prayed[key] = r.g<int>(); } hasSpawnPoint = r.g<u8>(); spawnX = r.g<double>(); spawnY = r.g<double>();
  k = r.cnt(); for (u32 i = 0; i < k && r.ok; i++) { Nation n2; n2.id = r.s(); n2.name = r.s(); n2.ruler = r.s(); n2.temper = r.s(); n2.status = r.s(); n2.color = r.g<int>(); n2.rel = r.g<double>(); n2.spawned = r.g<u8>(); n2.met = r.g<u8>(); n2.x = r.g<double>(); n2.y = r.g<double>(); n2.hasQuest = r.g<u8>(); n2.questId = r.s(); n2.questN = r.g<int>(); n2.questReward = r.g<int>(); nations[n2.id] = n2; }
  if (!r.ok) { loadErr = "nations unreadable"; return false; }
  double px = r.g<double>(), py = r.g<double>(); if (!std::isfinite(px) || !std::isfinite(py)) { loadErr = "bad player position"; return false; } player = mk(E_PLAYER, px, py); Ent* p = player.get(); p->hp = r.g<double>(); p->food = r.g<double>(); p->sel = r.g<int>(); p->coins = r.g<int>(); p->buff = r.g<double>(); r.g<int>(); r.g<int>(); p->look = playerLook(o.skin, o.hair, o.shirt, o.style); p->frames = bakeChar(p->look); p->team = "player"; p->maxHp = 20; p->speed = 66; p->swims = true; p->walkFps = 9;
  if (!(p->hp > 0)) p->hp = 1; if (p->hp > p->maxHp) p->hp = p->maxHp; p->sel = std::max(0, std::min(7, p->sel));
  p->armor.id = r.s(); p->armor.n = r.g<int>(); p->armor.d = r.g<int>(); for (auto& s : p->inv) { s.id = r.s(); s.n = r.g<int>(); s.d = r.g<int>(); }
  k = r.cnt(); for (u32 i = 0; i < k && r.ok; i++) { i64 key = r.g<i64>(); u32 m = r.cnt(70000); std::vector<SavedTile> a; for (u32 j = 0; j < m && r.ok; j++) { SavedTile t; t.idx = r.g<u16>(); t.g = r.g<u8>(); t.b = r.g<u8>(); t.o = r.g<u8>(); t.m = r.g<u8>(); a.push_back(t); } world.saved[key] = a; }
  k = r.cnt(); for (u32 i = 0; i < k && r.ok; i++) { std::string key = r.s(); u32 m = r.cnt(); std::vector<std::pair<std::string, std::pair<int, int>>> a; for (u32 j = 0; j < m && r.ok; j++) { std::string id = r.s(); int nn = r.g<int>(), d = r.g<int>(); a.push_back({id, {nn, d}}); } world.chests[key] = a; }
  k = r.cnt(); for (u32 i = 0; i < k && r.ok; i++) { Room rm; rm.key = r.s(); rm.vid = r.s(); rm.kind = r.s(); rm.si = r.g<int>(); rm.x = r.g<int>(); rm.y = r.g<int>(); rm.w = r.g<int>(); rm.h = r.g<int>(); rm.retx = rm.rety = 0; if (ver >= 3) { rm.retx = r.g<double>(); rm.rety = r.g<double>(); } interiors[rm.key] = rm; }
  std::string insideKey; if (ver >= 3) insideKey = r.s(); if (!r.ok) { loadErr = "world data unreadable"; return false; }
  k = r.cnt(); for (u32 i = 0; i < k && r.ok; i++) { int kind = r.g<u8>(); double x = r.g<double>(), y = r.g<double>(), hp = r.g<double>(); std::string vid = r.s(), role = r.s(); unsigned seed = r.g<unsigned>(); double hx = r.g<double>(), hy = r.g<double>(); std::string name = r.s(); int dX = r.g<int>(), dY = r.g<int>(), hsi = r.g<int>(); bool archer = r.g<u8>(), mine = r.g<u8>(); int color = r.g<int>(); std::string order = r.s(); double pX = r.g<double>(), pY = r.g<double>(); int slot = r.g<int>();
    std::string breed = r.s(); bool owned = r.g<u8>(); double love = r.g<double>(); std::string ak = r.s(); bool pen = r.g<u8>(); double baby = r.g<double>(), prod = r.g<double>(); bool shorn = r.g<u8>(); if (!r.ok) break; EP e;
    if (kind == E_VILLAGER) { e = spawnVillager(x, y, vid, role, seed); e->hx = hx; e->hy = hy; e->name = name; e->doorX = dX; e->doorY = dY; e->homeSi = hsi; } else if (kind == E_SOLDIER) { e = spawnSoldier(x, y, vid, color, archer, mine, order, pX, pY); e->slot = slot; e->name = name; } else if (kind == E_DOG) { e = spawnDog(x, y, breed, name, owned, false, love); } else if (kind == E_ANIMAL) { e = spawnAnimal(ak, x, y, pen, owned, baby); e->produceT = prod; if (shorn) e->setShorn(true); } if (e) e->hp = hp; }
  if (!r.ok) { loadErr = "entities unreadable"; return false; }
  if (!insideKey.empty()) { auto it = interiors.find(insideKey); if (it != interiors.end()) inside = &it->second; }
  lastHour = hour(); day = (int)std::floor(clock / DAY_LEN) + 1; camX = px - viewW / 2; camY = py - viewH / 2; REN.inited = false; hasSave = true; return true; }
