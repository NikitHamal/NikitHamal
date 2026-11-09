// Hanomi native — entity AI: villagers, soldiers, zombies, animals, dog, drops, arrows, dialogue.
#pragma once
#include "game.h"

static const char* VILLAGER_LINES[] = {"Lovely day for farming.", "The sakura are in bloom.", "Have you tried the koi pond?", "Keep a torch lit at night.", "Blood Moon every fifth night...", "Bring me rice and I'll bake you something.", "The old shrine is said to bless travellers.", "My cousin lives over the hills.", "Mind the wolves in the forest.", "Fresh bread today!", "The dog keeps stealing my sandals."};
static const char* NIGHT_LINES[] = {"It's dangerous out there!", "Get inside!", "I heard groaning...", "Stay near the lanterns."};

inline void Game::pet(Ent* d) { d->wag = 3; for (int i = 0; i < 4; i++) fx.spawn({d->x + frandr(-6, 6), d->y, 14, frandr(-4, 4), -2, 14, 0, 1.0f, 1.0f, 1, 0xFFff6a8a, 0xFFff6a8a, 2}); sfx(S_WHINE, d->x, d->y, 0.4f, 1.3f); }
inline bool Game::talk(Ent* e) {
  Slot* s = itemSlot(); const ItemDef* it = s ? &ITEMS[s->id] : nullptr;
  if (e->type == E_DOG) { if (it && it->id == "dog_treat") { if (--s->n <= 0) *s = Slot(); e->owned = true; e->persist = true; pet(e); toast("The dog wags its tail. It will follow you now.", 0xFFf6b8ca); sfxAnimal(e); return true; } pet(e); if (e->owned) toast("Good dog!", 0xFFf6b8ca); else toast("The dog sniffs you. (Offer a dog treat.)", 0xFFf6b8ca); return true; }
  if (e->type == E_ANIMAL) {
    static const std::map<std::string, std::string> FOOD = {{"cow", "wheat"}, {"sheep", "wheat"}, {"pig", "carrot"}, {"chicken", "wheat_seeds"}};
    auto f = FOOD.find(e->kind); if (f != FOOD.end() && it && it->id == f->second && e->love <= 0 && !e->baby) { if (--s->n <= 0) *s = Slot(); e->love = 12; sfxAnimal(e); toast(cap1(e->kind) + " is in the mood.", 0xFFf6b8ca); act(ACT_BEND, 0.4f); return true; } return false; }
  if (e->type == E_VILLAGER || e->type == E_SOLDIER) {
    if (e->type == E_SOLDIER && e->mine) { e->state = e->state == 9 ? 0 : 9; e->bubble = e->state == 9 ? "Holding position." : "Following you!"; e->bubbleT = 2; return true; }
    auto it2 = nations.find(e->vid); if (it2 != nations.end() && it2->second.status == "war" && e->team != 1) { e->bubble = "Leave us be!"; e->bubbleT = 2.5f; return true; }
    talkEnt = e; if (e->role == R_MERCHANT) { modal = M_TRADE; tradeMode = 0; sfxUI(S_COIN, 0.5f); return true; }
    if (e->role == R_CHIEF) { modal = M_DIALOG; dialogMode = 0; dialogText = "Welcome, traveller."; sfxUI(S_BELL, 0.4f); return true; }
    e->bubble = night() ? NIGHT_LINES[irand(0, 3)] : VILLAGER_LINES[irand(0, 10)]; e->bubbleT = 3.5f; e->dir = dirOf(player->x - e->x, player->y - e->y); e->st = 2; e->state = 3; sfx(S_POP, e->x, e->y, 0.4f); return true;
  }
  return false;
}

inline void Game::meleeTarget(Ent& e, float dt, float range, float dmgv, float cd) { (void)dt; (void)range; (void)dmgv; (void)cd; }

static inline void syncRig(Game& g, Ent& e, float dt) {
  RigState& s = e.rs; s.t += dt; s.dir = e.dir; s.moving = e.moving && !e.inside; s.speed = e.type == E_ZOMBIE ? 0.75f : (e.speed > 45 ? 1.4f : 1.f); if (e.moving) s.walkT += dt * (e.type == E_ZOMBIE ? 1.0f : 1.5f);
  s.act = e.actT > 0 ? e.act : 0; s.actP = e.actT > 0 ? 1 - e.actT / e.actDur : -1; s.wl = g.waterLevel(e); s.hurt = e.flash; s.dead = e.dead ? e.deadT * 1.6f : 0; s.aim = e.gx;
  s.held = e.type == E_SOLDIER ? (e.archer ? itm("bow") : itm("spear")) : 0; e.rig.update(dt, s);
}
static inline void physicsCommon(Game& g, Ent& e, float dt) {
  if (e.kbx || e.kby) { g.move(e, e.kbx * dt, e.kby * dt); float d = std::pow(0.002f, dt); e.kbx *= d; e.kby *= d; if (std::fabs(e.kbx) + std::fabs(e.kby) < 2) e.kbx = e.kby = 0; }
  if (e.z > 0 || e.vz) { e.vz -= 300 * dt; e.z += e.vz * dt; if (e.z <= 0) { e.z = 0; e.vz = 0; } } if (e.flash > 0) e.flash -= dt; if (e.atkCd > 0) e.atkCd -= dt; if (e.ifr > 0) e.ifr -= dt; if (e.actT > 0) { e.actT -= dt; } if (e.bubbleT > 0) { e.bubbleT -= dt; if (e.bubbleT <= 0) e.bubble.clear(); } e.t += dt; if (e.sayCd > 0) e.sayCd -= dt;
  int wl = g.waterLevel(e); static std::unordered_map<int, bool> wasWet; bool& w = wasWet[e.id]; if (wl && !w) { g.fx.burst(e.x, e.y, 6, {0xFFe8fbff, 0xFFbfe7f4}, 2, 10, 30, 0.3f, 0.6f, 20, 60); g.sfx(S_SPLASH, e.x, e.y, 0.4f); } w = wl > 0; if (wl && e.moving && frand() < dt * 3) g.fx.ring(e.x, e.y - 1, wl == 2 ? 9 : 6, 0xFFe8fbff, 0.6f);
}

inline void Game::updateVillager(Ent& e, float dt) {
  Ent& p = *player; bool nightT = hour() >= 20 || hour() < 6; float dp = std::hypot(p.x - e.x, p.y - e.y); Ent* zomb = nearest(e.x, e.y, 90, [&](Ent* q) { return q->type == E_ZOMBIE; });
  if (e.inside) { if (!nightT) { e.inside = false; e.x = e.homeX; e.y = e.homeY; } else { e.moving = false; return; } }
  e.moving = false;
  if (zomb && e.role != R_CHIEF) { float dx = e.x - zomb->x, dy = e.y - zomb->y, l = std::hypot(dx, dy) + 0.01f; e.dir = dirOf(dx, dy); move(e, dx / l * 46 * dt, dy / l * 46 * dt); e.moving = true; if (e.sayCd <= 0) { e.bubble = "Zombies!"; e.bubbleT = 2; e.sayCd = 6; sfx(S_POP, e.x, e.y, 0.5f, 1.4f); } return; }
  if (e.state == 3) { e.st -= dt; e.dir = dirOf(p.x - e.x, p.y - e.y); if (e.st <= 0) e.state = 0; return; }
  if (e.role == R_MERCHANT || e.role == R_CHIEF) { if (dp < 60) e.dir = dirOf(p.x - e.x, p.y - e.y); if (dist2f(e.x, e.y, e.homeX, e.homeY) > 14 * 14 && !nightT) seek(e, e.homeX, e.homeY, 30, dt, 3); else if (nightT && e.role == R_MERCHANT) { if (seek(e, e.homeX, e.homeY + 30, 30, dt, 3) && dp > 80) {} } return; }
  if (nightT) { if (seek(e, e.homeX, e.homeY, 38, dt, 5) || dist2f(e.x, e.y, e.homeX, e.homeY) < 100) { if (e.homeStruct >= 0 || true) { e.inside = true; e.moving = false; } } return; }
  if (dp < 50 && e.sayCd <= 0 && frand() < dt * 0.2f) { e.bubble = VILLAGER_LINES[irand(0, 10)]; e.bubbleT = 3; e.sayCd = 12; e.dir = dirOf(p.x - e.x, p.y - e.y); }
  e.wanderT -= dt; if (e.state == 0 && e.wanderT <= 0) { e.state = 1; float a = frand() * TAU, d = frandr(10, 60); e.gx = e.homeX + std::cos(a) * d; e.gy = e.homeY + std::sin(a) * d * 0.6f; e.path.clear(); e.wanderT = frandr(3, 8); }
  if (e.state == 1) { if (seek(e, e.gx, e.gy, 26, dt, 3) || e.wanderT < -6) { e.state = 0; e.wanderT = frandr(2, 7); } else if (e.wanderT <= 0) { e.wanderT = 0.1f; } }
}
inline void Game::updateZombie(Ent& e, float dt) {
  e.moving = false; if (e.dead) return; float bestd = e.raid ? 150.f : 105.f; Ent* tg = nullptr; for (auto& o : ents) { if (o->dead || o->inside || !hostile(&e, o.get())) continue; float d = std::hypot(o->x - e.x, o->y - e.y); if (d < bestd) { bestd = d; tg = o.get(); } }
  if (tg) { float d = bestd; if (d > 10) { seek(e, tg->x, tg->y, e.speed * (night() ? 1.f : 0.8f), dt, 6); } else { e.dir = dirOf(tg->x - e.x, tg->y - e.y); if (e.atkCd <= 0) { e.atkCd = 1.1f; e.act = ACT_SWING; e.actDur = 0.45f; e.actT = 0.45f; e.st = 0.45f; e.gx = 0; } } }
  else if (e.raid && e.hasRaid) { seek(e, e.raidX, e.raidY + frandr(-1, 1), e.speed, dt, 20); }
  else { e.wanderT -= dt; if (e.wanderT <= 0) { e.wanderT = frandr(2, 6); e.gx = e.x + frandr(-50, 50); e.gy = e.y + frandr(-40, 40); e.state = 1; } if (e.state == 1) { if (seek(e, e.gx, e.gy, e.speed * 0.4f, dt, 3)) e.state = 0; } }
  if (e.actT > 0 && e.st > 0) { e.st -= dt; if (e.st <= 0.22f && e.gx == 0) { e.gx = 1; Ent* t2 = tg ? tg : nullptr; if (t2 && std::hypot(t2->x - e.x, t2->y - e.y) < 18) { hurt(t2, 2.f + e.kindLevel * 1.5f, &e, 100); sfx(S_HIT, e.x, e.y, 0.5f, 0.8f); } } }
  if (e.sayCd <= 0 && frand() < dt * 0.15f && std::hypot(player->x - e.x, player->y - e.y) < 160) { sfx(S_GROAN, e.x, e.y, 0.5f, frandr(0.8f, 1.2f)); e.sayCd = 5; }
  if (!night() && !e.raid && frand() < dt * 0.02f && std::hypot(player->x - e.x, player->y - e.y) > 100) hurt(&e, 1, nullptr, 0);
}
inline void Game::updateSoldier(Ent& e, float dt) {
  e.moving = false; float sight = e.mine ? 130.f : 110.f; Ent* tg = nullptr; float bd = sight; for (auto& o : ents) { if (o->dead || o->inside || !hostile(&e, o.get())) continue; float d = std::hypot(o->x - e.x, o->y - e.y); if (d < bd) { bd = d; tg = o.get(); } }
  if (e.mine && !tg) { Ent* w = nearest(e.x, e.y, 90, [&](Ent* q) { return q->type == E_ANIMAL && q->kind == "wolf"; }); if (w) { tg = w; bd = std::hypot(w->x - e.x, w->y - e.y); } }
  float reach = e.archer ? 115.f : 17.f;
  if (tg) {
    e.gx = std::atan2(tg->y - 9 - (e.y - 9), tg->x - e.x); if (bd > reach) seek(e, tg->x, tg->y, e.speed * 1.1f, dt, reach * 0.8f); else { e.dir = dirOf(tg->x - e.x, tg->y - e.y); e.moving = false; if (e.atkCd <= 0) { e.atkCd = e.archer ? 1.5f : 0.9f; e.act = e.archer ? ACT_SHOOT : ACT_THRUST; e.actDur = e.archer ? 0.5f : 0.4f; e.actT = e.actDur; e.st = e.actDur * 0.55f; e.shootCd = 1; e.penX = (int)(tg->x); e.penY = (int)(tg->y); e.homeStruct = tg->id; } }
  } else if (e.mine) { if (e.state == 9) { e.moving = false; } else { float a = (float)e.slot / std::max(1, (int)armyList().size()) * TAU + 0.6f, d = 26 + (e.slot % 3) * 10; float tx = player->x + std::cos(a) * d, ty = player->y + std::sin(a) * d * 0.7f; float dd = std::hypot(tx - e.x, ty - e.y); if (dd > 150) { e.x = tx; e.y = ty; } else if (dd > 10) seek(e, tx, ty, std::min(e.speed * 1.5f, 40 + dd), dt, 4); } }
  else if (e.raid && e.hasRaid) seek(e, e.raidX, e.raidY, e.speed, dt, 20);
  else { e.wanderT -= dt; if (e.wanderT <= 0) { e.wanderT = frandr(3, 8); float a = frand() * TAU; e.gx = e.homeX + std::cos(a) * 40; e.gy = e.homeY + std::sin(a) * 20; e.state = 1; } if (e.state == 1 && seek(e, e.gx, e.gy, 24, dt, 4)) e.state = 0; }
  if (e.actT > 0 && e.shootCd > 0) { e.st -= dt; if (e.st <= 0) { e.shootCd = 0; Ent* t2 = nullptr; for (auto& o : ents) if (o->id == e.homeStruct && !o->dead) t2 = o.get(); if (t2) { if (e.archer) { float a = std::atan2(t2->y - 8 - (e.y - 9), t2->x - e.x) + frandr(-0.08f, 0.08f); fireArrow(&e, e.x, e.y - 9, a, 4, e.mine); sfx(S_BOW, e.x, e.y, 0.5f); } else if (std::hypot(t2->x - e.x, t2->y - e.y) < 24) { hurt(t2, 5, &e, 110); sfx(S_HIT, e.x, e.y, 0.5f); } } } }
}
inline void Game::updateAnimal(Ent& e, float dt) {
  AniState& a = e.as; a.t += dt; e.moving = false; Ent& p = *player; Slot* hs = itemSlot(); bool wolf = e.kind == "wolf"; static const std::map<std::string, std::string> FOOD = {{"cow", "wheat"}, {"sheep", "wheat"}, {"pig", "carrot"}, {"chicken", "wheat_seeds"}, {"rabbit", "carrot"}, {"deer", "berries"}};
  if (e.baby && (e.st2 += 0, true)) {} if (e.love > 0) { e.love -= dt; if (frand() < dt * 3) fx.spawn({e.x, e.y, 14, 0, 0, 12, 0, 1.0f, 1.0f, 1, 0xFFff6a8a, 0xFFff6a8a, 2});
    Ent* m = nearest(e.x, e.y, 40, [&](Ent* q) { return q != &e && q->kind == e.kind && q->love > 0 && !q->baby; }); if (m && e.id < m->id && e.love > 0) { e.love = m->love = 0; Ent* b = spawnAnimal(e.kind == "chicken" ? "cow" : e.kind, e.x, e.y, e.persist, true); if (e.kind == "chicken") { b->kind = "chicken"; b->aniIdx = 100; b->hp = b->maxHp = 5; b->speed = 22; b->r = 3; } b->hasPen = e.hasPen; b->penX = e.penX; b->penY = e.penY; b->penW = e.penW; b->penH = e.penH; b->baby = true; b->st2 = 120; stats["born"]++; for (int i = 0; i < 8; i++) fx.spawn({e.x, e.y, 10, frandr(-20, 20), frandr(-10, 10), frandr(10, 30), 0, 1.0f, 1.0f, 1, 0xFFff6a8a, 0xFFff6a8a, 2}); toast("A baby " + e.kind + " is born!", 0xFFf6b8ca); sfxAnimal(&e); } }
  if (e.baby) { e.st2 -= dt; if (e.st2 <= 0) e.baby = false; }
  if (e.persist && e.kind == "chicken" && (e.produceT -= dt) <= 0) { e.produceT = frandr(150, 300); dropItem(itm("egg"), 1, e.x, e.y); sfx(S_CLUCK, e.x, e.y, 0.5f); }
  if (e.shorn && (e.produceT -= dt) <= 0) { e.shorn = false; e.produceT = frandr(150, 300); } if (e.milked > 0) e.milked -= dt;
  float dp = std::hypot(p.x - e.x, p.y - e.y); a.speed = 1;
  if (wolf) { Ent* tg = nullptr; float bd = 95; for (auto& o : ents) if (!o->dead && !o->inside && (o->type == E_PLAYER || (o->type == E_SOLDIER && o->mine) || (o->type == E_DOG && o->owned) || (o->type == E_ANIMAL && o->kind == "rabbit" && !night()))) { float d = std::hypot(o->x - e.x, o->y - e.y); if (d < bd) { bd = d; tg = o.get(); } }
    if (e.hp < e.maxHp * 0.3f) { e.panic = 3; } if (e.panic > 0) { e.panic -= dt; float dx = e.x - p.x, dy = e.y - p.y, l = std::hypot(dx, dy) + 0.01f; move(e, dx / l * e.speed * 1.2f * dt, dy / l * e.speed * 1.2f * dt); e.moving = true; e.dir = dirOf(dx, dy); a.speed = 1.5f; }
    else if (tg) { if (bd > 11) { seek(e, tg->x, tg->y, e.speed * 1.15f, dt, 8); a.speed = 1.4f; } else if (e.atkCd <= 0) { e.atkCd = 1.2f; hurt(tg, 3, &e, 100); sfx(S_BARK, e.x, e.y, 0.5f, 0.6f); e.dir = dirOf(tg->x - e.x, tg->y - e.y); } if (frand() < dt * 0.1f) sfx(S_GROAN, e.x, e.y, 0.3f, 1.6f); return; }
  } else {
    bool flee = (e.kind == "deer" || e.kind == "rabbit" || e.kind == "fox" || e.kind == "chicken" || e.kind == "sheep" || e.kind == "pig") && !e.persist; auto fi = FOOD.find(e.kind); bool holdFood = hs && fi != FOOD.end() && ITEMS[hs->id].id == fi->second;
    if (e.angry && e.kind == "boar") { Ent* t = &p; float d = dp; if (d > 130) e.angry = false; else if (d > 12) { seek(e, t->x, t->y, e.speed * 1.5f, dt, 10); a.speed = 1.5f; return; } else if (e.atkCd <= 0) { e.atkCd = 1.1f; hurt(t, 3, &e, 120); sfx(S_OINK, e.x, e.y, 0.6f, 0.7f); return; } else return; }
    Ent* thr = nullptr; if (flee && !holdFood) { thr = nearest(e.x, e.y, e.kind == "deer" || e.kind == "rabbit" ? 60.f : 34.f, [&](Ent* q) { return q->type == E_PLAYER || q->type == E_ZOMBIE || (q->type == E_ANIMAL && q->kind == "wolf"); }); }
    if (!flee && !holdFood) thr = nearest(e.x, e.y, 60, [&](Ent* q) { return q->type == E_ZOMBIE || (q->type == E_ANIMAL && q->kind == "wolf"); }); if (e.kind == "fox") thr = nearest(e.x, e.y, 50, [&](Ent* q) { return q->type == E_PLAYER || q->type == E_ZOMBIE; });
    if (thr || e.panic > 0) { if (e.panic > 0) e.panic -= dt; float sx = thr ? thr->x : e.gx, sy = thr ? thr->y : e.gy; float dx = e.x - sx, dy = e.y - sy, l = std::hypot(dx, dy) + 0.01f; float sp = e.speed * 1.4f; if (e.hasPen) { /* stay in pen */ } move(e, dx / l * sp * dt, dy / l * sp * dt); e.moving = true; e.dir = dirOf(dx, dy); a.speed = 1.5f; e.state = 3; if (e.kind == "rabbit") { a.hop += dt * 5; } return; }
    if (holdFood && dp < 90 && dp > 20 && !e.baby) { seek(e, p.x, p.y, e.speed, dt, 18); return; }
    e.wanderT -= dt; if (e.state == 1) { if (seek(e, e.gx, e.gy, e.speed * 0.5f, dt, 2) || e.wanderT < -5) { e.state = 0; e.wanderT = frandr(2, 6); } }
    else if (e.wanderT <= 0) { e.wanderT = frandr(2, 6); if (frand() < 0.5f) { e.state = 1; float tx = e.x + frandr(-40, 40), ty = e.y + frandr(-30, 30); if (e.hasPen) { tx = clampf(tx, (e.penX + 0.5f) * TS, (e.penX + e.penW - 0.5f) * TS); ty = clampf(ty, (e.penY + 0.8f) * TS, (e.penY + e.penH - 0.3f) * TS); } e.gx = tx; e.gy = ty; e.path.clear(); } else { e.state = frand() < 0.5f ? 2 : 0; a.graze = frand() < 0.6f ? 3.f : 0.f; } }
  }
  if (e.state == 2 || a.graze > 0) { a.graze = std::max(0.f, a.graze - dt); } if (e.moving) { a.walkT += dt * (a.speed > 1.2f ? 2.4f : 1.4f); }
  if (frand() < dt * 0.04f && dp < 200 && !e.persist == false) sfxAnimal(&e);
}
inline void Game::updateDog(Ent& e, float dt) {
  AniState& a = e.as; a.t += dt; e.moving = false; Ent& p = *player; float dp = std::hypot(p.x - e.x, p.y - e.y); if (e.wag > 0) e.wag -= dt; a.wag = e.wag; a.speed = 1; a.pant = 0;
  if (e.owned) {
    if (e.state == 5) { // fetch stick
      if (e.fetchState == 1) { if (seek(e, e.gx, e.gy, 85, dt, 4)) { e.fetchState = 2; e.sleepT = 0.4f; sfx(S_BARK, e.x, e.y, 0.5f); } a.speed = 1.6f; } else if (e.fetchState == 2) { e.sleepT -= dt; if (e.sleepT <= 0) e.fetchState = 3; } else if (e.fetchState == 3) { if (seek(e, p.x, p.y, 85, dt, 14)) { dropItem(itm("stick"), 1, e.x, e.y); e.state = 0; e.fetchState = 0; e.wag = 3; sfx(S_BARK, e.x, e.y, 0.5f, 1.2f); } a.speed = 1.6f; }
      if (e.moving) a.walkT += dt * 2.6f; return; }
    if (dp > 130) { e.x = p.x + frandr(-20, 20); e.y = p.y + frandr(10, 24); }
    if (dp > 34) { seek(e, p.x, p.y, dp > 90 ? 78 : 56, dt, 26); a.speed = dp > 90 ? 1.6f : 1.f; e.sleepT = 0; e.state = 0; } else if (dp < 20 && e.moving == false) { }
    if (!e.moving) { e.sleepT += dt; a.pant = dp < 60 ? 1.f : 0.f; if (e.sleepT > 22) a.sleeping = true; else a.sleeping = false; if (dp < 30 && e.wag <= 0 && frand() < dt * 0.2f) e.wag = 2; } else a.sleeping = false;
    Ent* zt = nearest(e.x, e.y, 70, [&](Ent* q) { return q->type == E_ZOMBIE || (q->type == E_ANIMAL && q->kind == "wolf"); }); if (zt) { float d = std::hypot(zt->x - e.x, zt->y - e.y); if (d > 10) seek(e, zt->x, zt->y, 70, dt, 8); else if (e.atkCd <= 0) { e.atkCd = 0.8f; hurt(zt, 3, &e, 80); sfx(S_BARK, e.x, e.y, 0.6f); } a.speed = 1.6f; a.sleeping = false; }
  } else { e.wanderT -= dt; if (e.state == 1) { if (seek(e, e.gx, e.gy, 28, dt, 3) || e.wanderT < -5) { e.state = 0; e.wanderT = frandr(4, 14); } } else if (e.wanderT <= 0) { if (frand() < 0.5f) { e.state = 1; e.gx = e.homeX + frandr(-50, 50); e.gy = e.homeY + frandr(-30, 30); } e.wanderT = frandr(3, 10); a.sleeping = frand() < 0.4f; } if (e.moving) a.sleeping = false; if (dp < 40 && frand() < dt * 0.1f) e.wag = 2; }
  if (e.moving) a.walkT += dt * (a.speed > 1.2f ? 2.6f : 1.6f);
}
inline void Game::updateDrop(Ent& e, float dt) {
  e.rs.t += dt; e.st -= dt; if (e.st <= 0) { e.dead = true; return; } if (e.pickT > 0) e.pickT -= dt; physicsCommon(*this, e, dt);
  float d = std::hypot(player->x - e.x, (player->y - 4) - e.y);
  if (e.pickT <= 0 && !player->dead && modal != M_DEAD && d < 30) { if (d < 7) { int left = add(e.item, e.n); if (left < e.n) { sfxUI(S_PICKUP, 0.6f, frandr(0.95f, 1.15f)); fx.floatText(e.x, e.y - 10, "+" + ITEMS[e.item].name, 0xFFe8f0ff); } if (left) e.n = left; else e.dead = true; } else { float k = 150 * dt / d; e.x += (player->x - e.x) * k; e.y += ((player->y - 4) - e.y) * k; } }
  // water carries drops
  if (isWater(world.ground(e.tx(), e.ty())) && frand() < dt * 2) fx.ring(e.x, e.y, 3, 0xFFe8fbff, 0.4f);
}
inline void Game::updateArrow(Ent& e, float dt) {
  e.st -= dt; if (e.st <= 0) { e.dead = true; return; } float nx = e.x + e.vx * dt, ny = e.y + e.vy * dt; e.z = std::max(0.f, e.z - dt * 2);
  if (world.solid((int)std::floor(nx / TS), (int)std::floor((ny - e.z * 0.5f) / TS), true)) { e.dead = true; fx.burst(e.x, e.y, 4, {0xFFd8c8a8, 0xFF8a5a34}, 6, 10, 30); sfx(S_ARROW, e.x, e.y, 0.4f); return; }
  e.x = nx; e.y = ny;
  for (auto& o : ents) { if (o->dead || o->inside || o.get() == &e || o->type == E_DROP || o->type == E_ARROW || o->id == e.kindLevel) continue; if (std::hypot(o->x - e.x, (o->y - 8) - (e.y - e.z)) > 9) continue; bool ok; if (e.mine || e.team == 1) ok = !(o->type == E_PLAYER || (o->type == E_SOLDIER && o->mine) || (o->type == E_DOG && o->owned) || o->team == 1 && (o->type == E_VILLAGER || o->type == E_SOLDIER)); else ok = o->type == E_PLAYER || o->mine || o->team == 1 && o->type != E_ANIMAL || o->type == E_VILLAGER && o->team != 3; if (!ok) continue; hurt(o.get(), e.hp, &e, 80); e.dead = true; sfx(S_ARROW, e.x, e.y, 0.5f); break; }
}
inline void Game::updateEnts(float dt) {
  Ent* pl = player; for (size_t i = 0; i < ents.size(); i++) {
    Ent& e = *ents[i]; if (e.type == E_PLAYER) { if (e.dead) {} continue; }
    if (e.dead) { e.deadT += dt; continue; }
    float far = std::hypot(e.x - pl->x, e.y - pl->y); if (far > 62 * TS && e.persist) continue; if (far > 90 * TS && e.type != E_DROP) { continue; }
    switch (e.type) {
      case E_DROP: updateDrop(e, dt); break; case E_ARROW: updateArrow(e, dt); break;
      case E_VILLAGER: physicsCommon(*this, e, dt); updateVillager(e, dt); syncRig(*this, e, dt); break;
      case E_ZOMBIE: physicsCommon(*this, e, dt); updateZombie(e, dt); syncRig(*this, e, dt); break;
      case E_SOLDIER: physicsCommon(*this, e, dt); updateSoldier(e, dt); syncRig(*this, e, dt); break;
      case E_ANIMAL: physicsCommon(*this, e, dt); updateAnimal(e, dt); e.arig.update(dt, e.as, ANISPEC[std::min(e.aniIdx, 8)]); break;
      case E_DOG: physicsCommon(*this, e, dt); updateDog(e, dt); e.arig.update(dt, e.as, ANISPEC[7]); break;
    }
  }
  // soft separation between bodies
  for (size_t i = 0; i < ents.size(); i++) { Ent& a = *ents[i]; if (a.dead || a.inside || a.type == E_DROP || a.type == E_ARROW || a.type == E_PLAYER) continue; if (std::fabs(a.x - pl->x) > 400 || std::fabs(a.y - pl->y) > 300) continue;
    for (size_t j = i + 1; j < ents.size(); j++) { Ent& b = *ents[j]; if (b.dead || b.inside || b.type == E_DROP || b.type == E_ARROW) continue; float dx = a.x - b.x, dy = a.y - b.y; if (std::fabs(dx) > 9 || std::fabs(dy) > 9) continue; float d = std::hypot(dx, dy); if (d < 9 && d > 0.001f) { float k = (9 - d) * 0.25f; move(a, dx / d * k, dy / d * k); if (b.type != E_PLAYER) move(b, -dx / d * k * 0.5f, -dy / d * k * 0.5f); } } }
  ents.erase(std::remove_if(ents.begin(), ents.end(), [](const std::unique_ptr<Ent>& e) { return e->dead && e->type != E_PLAYER && (e->deadT > 1.6f || e->type == E_DROP || e->type == E_ARROW); }), ents.end());
}
