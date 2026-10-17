// Hanomi — the player: movement, tools, combat, building, fishing, interaction.
import { TS, G, B, O, OBJ, BLOCK, CROPS, isWater } from './defs.js';
import { Human, dirOf, DIRV, Animal, Dog, Villager, Soldier } from './entities.js';
import { bakeChar, playerLook } from './art/chars.js';
import { ITEMS, FISH_TABLE } from './items.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { clamp, rand, randi, pick, dist2, TAU } from './util.js';

export class Player extends Human {
  constructor(g, x, y, look) {
    super(g, x, y, playerLook(look)); this.lookOpts = look; this.isPlayer = true; this.team = 'player'; this.persist = false;
    this.hp = this.maxHp = 20; this.food = 20; this.speed = 66; this.inv = new Array(32).fill(null); this.sel = 0; this.armor = null; this.coins = 0;
    this.useCd = 0; this.rollT = 0; this.rollCd = 0; this.idleT = 0; this.fish = null; this.hungerT = 0; this.regenT = 0; this.buff = 0; this.r = 4; this.alive = true; this.walkFps = 9; this.stepT = 0;
  }
  // ---------- inventory ----------
  get item() { return this.inv[this.sel]; }
  add(id, n = 1) {
    const it = ITEMS[id]; if (!it) return n;
    for (let i = 0; i < this.inv.length && n > 0; i++) { const s = this.inv[i]; if (s && s.id === id && s.n < it.st) { const k = Math.min(n, it.st - s.n); s.n += k; n -= k; } }
    for (let i = 0; i < this.inv.length && n > 0; i++) { if (!this.inv[i]) { const k = Math.min(n, it.st); this.inv[i] = { id, n: k, d: it.dur || 0 }; n -= k; } }
    this.g.ui && this.g.ui.dirty(); return n;
  }
  count(id) { let n = 0; for (const s of this.inv) if (s && s.id === id) n += s.n; return n; }
  remove(id, n = 1) { for (let i = this.inv.length - 1; i >= 0 && n > 0; i--) { const s = this.inv[i]; if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (!s.n) this.inv[i] = null; } } this.g.ui && this.g.ui.dirty(); return n === 0; }
  useUp(slot = this.sel, n = 1) { const s = this.inv[slot]; if (!s) return; s.n -= n; if (s.n <= 0) this.inv[slot] = null; this.g.ui.dirty(); }
  wear(slot = this.sel) { const s = this.inv[slot]; if (!s || !ITEMS[s.id].dur) return; s.d--; if (s.d <= 0) { this.inv[slot] = null; this.g.toast(`${ITEMS[s.id].n} broke!`); Audio.play('break'); } this.g.ui.dirty(); }
  // ---------- main update ----------
  update(dt) {
    const g = this.g; this.physics(dt); this.held = this.item ? this.item.id : null;
    if (this.dead) return;
    if (this.useCd > 0) this.useCd -= dt; if (this.rollCd > 0) this.rollCd -= dt;
    if (this.buff > 0) this.buff -= dt;
    this.updateVitals(dt);
    const busy = g.ui.modal || g.paused;
    // movement
    let mx = 0, my = 0;
    if (!busy) {
      if (Input.down('a') || Input.down('ArrowLeft')) mx -= 1; if (Input.down('d') || Input.down('ArrowRight')) mx += 1;
      if (Input.down('w') || Input.down('ArrowUp')) my -= 1; if (Input.down('s') || Input.down('ArrowDown')) my += 1;
      if (Input.joy.on) { mx = Input.joy.x; my = Input.joy.y; if (Math.hypot(mx, my) < 0.2) mx = my = 0; }
    }
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    if (this.fish && (mx || my)) this.cancelFish();
    if (this.rollT > 0) { this.rollT -= dt; this.move(this.rollVx * dt, this.rollVy * dt); this.moving = true; if (Math.random() < 0.5) g.fx.spawn({ x: this.x, y: this.y, z: 1, vz: 6, life: 0.4, c: '#d8c8a8', k: 'smoke', s: 2 }); }
    else if (mx || my) {
      const sprint = (Input.down('Shift') || (Input.joy.on && ml > 0.95)) && this.food > 2;
      let sp = this.speed * (sprint ? 1.45 : 1) * (this.inWater() ? 0.55 : 1) * (this.actT > 0 ? 0.55 : 1);
      this.move(mx * sp * dt, my * sp * dt); this.moving = true; this.idleT = 0;
      if (!this.facingLock) this.dir = dirOf(mx, my);
      this.stepT -= dt * (sprint ? 1.5 : 1); if (this.stepT <= 0) { this.stepT = 0.32; if (this.inWater()) { g.fx.burst(this.x, this.y, 3, ['#bfe7e4', '#ffffff'], { z: 1, vz0: 20, vz1: 40, sp1: 20 }); Audio.play('splash', { vol: 0.15 }); } else Audio.play('step', { vol: 0.12 }); }
      if (sprint) this.hungerT += dt * 1.5;
    } else { this.moving = false; this.idleT += dt; }
    // roll
    if (!busy && (Input.pressed(' ') || Input.tbtnHit.roll) && this.rollCd <= 0 && this.rollT <= 0 && !this.fish) {
      const [dx, dy] = (mx || my) ? [mx, my] : DIRV[this.dir]; const l = Math.hypot(dx, dy) || 1; this.rollVx = dx / l * 170; this.rollVy = dy / l * 170; this.rollT = 0.22; this.rollCd = 0.75; this.ifr = 0.3; Audio.play('swing', { vol: 0.5, pitch: 0.7 });
    }
    // aim
    this.facingLock = false;
    const aim = g.aimWorld();
    if (aim && !Input.touch) { if (Input.mdown[0] || Input.mdown[2] || this.actT > 0) { this.dir = dirOf(aim.x - this.x, aim.y - (this.y - 8)); this.facingLock = true; } }
    g.target = this.computeTarget(aim);
    if (busy) return;
    // hotbar
    for (let k = 1; k <= 8; k++) if (Input.pressed(String(k))) { this.sel = k - 1; g.ui.dirty(); this.cancelFish(); }
    if (Input.wheel) { this.sel = (this.sel + (Input.wheel > 0 ? 1 : -1) + 8) % 8; g.ui.dirty(); this.cancelFish(); }
    if (Input.pressed('q')) this.dropSel();
    // actions
    const useHeld = Input.mdown[0] || Input.tbtn.use, usePressed = Input.mhit[0] || Input.tbtnHit.use || Input.pressed('j');
    const alt = Input.mhit[2] || Input.pressed('e') || Input.tbtnHit.alt || Input.pressed('k');
    if (this.fish) { this.updateFish(dt, usePressed); return; }
    if (alt) { if (this.interact()) return; }
    if ((useHeld || usePressed) && this.useCd <= 0 && this.rollT <= 0) this.use(usePressed);
    this.updateSwing(dt);
  }
  updateVitals(dt) {
    const g = this.g;
    this.hungerT += dt; if (this.hungerT > 26) { this.hungerT = 0; this.food = Math.max(0, this.food - 1); g.ui.dirty(); }
    this.regenT += dt;
    const rate = this.buff > 0 ? 1.2 : (this.food >= 16 ? 4 : this.food >= 8 ? 8 : 1e9);
    if (this.food <= 0) { if (this.regenT > 4) { this.regenT = 0; this.hurt(1, null, 0); g.toast('You are starving...'); } }
    else if (this.hp < this.maxHp && this.regenT > rate) { this.regenT = 0; this.hp = Math.min(this.maxHp, this.hp + 1); g.ui.dirty(); }
  }
  computeTarget(aim) {
    const g = this.g, cx = this.x, cy = this.y - 6;
    if (aim && !Input.touch) {
      const tx = Math.floor(aim.x / TS), ty = Math.floor(aim.y / TS), d = Math.hypot(tx * TS + 8 - cx, ty * TS + 8 - cy);
      if (d <= 44) return { x: tx, y: ty, aim: true };
    }
    // facing tile; prefer something interesting just ahead
    const [dx, dy] = DIRV[this.dir];
    const t1 = { x: Math.floor((this.x + dx * 12) / TS), y: Math.floor((this.y - 3 + dy * 12) / TS) };
    return t1;
  }
  // ---------- using held items ----------
  use(fresh) {
    const g = this.g, s = this.item, it = s ? ITEMS[s.id] : null, T = g.target;
    if (it && (it.k === 'food' || it.k === 'fish') && fresh) return this.eat();
    if (it && it.k === 'seed' && fresh) return this.plant(T, it);
    if (it && it.k === 'place') return fresh && this.place(T, it);
    if (it && it.tool === 'rod' && fresh) return this.cast();
    if (it && it.tool === 'bow') { if (!fresh && this.useCd > 0) return; return this.shoot(); }
    if (it && it.tool === 'can' && fresh) return this.water(T);
    if (it && (it.tool === 'shears' || it.tool === 'bucket') && fresh) return this.animalTool(it.tool);
    if (it && it.k === 'armor' && fresh) { const a = this.armor; this.armor = s; this.inv[this.sel] = a; g.toast(`Equipped ${it.n}`); Audio.play('place'); g.ui.dirty(); return; }
    if (it && it.k === 'misc' && fresh) return this.interact();
    if (s && s.id === 'stick' && fresh && g.ents.some(e => e.isDog && e.owned && !e.dead)) { const a = g.aimWorld(); const [dx, dy] = DIRV[this.dir]; return g.throwStick(a && !Input.touch ? a.x : this.x + dx * 80, a && !Input.touch ? a.y : this.y + dy * 80); }
    // swing (tools, weapons, hands)
    this.swing(it && it.tool === 'spear' ? 0.38 : 0.3); this.useCd = it && it.k === 'weapon' ? 0.36 : 0.32; this.swingHit = false; this.swingK = 1;
    Audio.play('swing', { vol: 0.35 });
    if (it && it.k === 'weapon') { const [dx, dy] = DIRV[this.dir], px = -dy, py = dx; for (let k = 0; k < 7; k++) { const a = (k / 6 - 0.5) * 2.2, r = 15; this.g.fx.spawn({ x: this.x + (dx * Math.cos(a) + px * Math.sin(a)) * r, y: this.y - 6 + (dy * Math.cos(a) + py * Math.sin(a)) * r * 0.8, z: 4, life: 0.12 + k * 0.015, c: k % 2 ? '#ffffff' : '#ffe8f0', k: 'spark' }); } }
  }
  updateSwing(dt) {
    if (this.actT <= 0 || this.swingHit) return;
    const p = 1 - this.actT / this.actDur; if (p < 0.4) return;
    this.swingHit = true; const g = this.g, s = this.item, it = s ? ITEMS[s.id] : null;
    const [dx, dy] = DIRV[this.dir], reach = (it && it.reach ? 22 : 14);
    const hx = this.x + dx * reach, hy = this.y - 6 + dy * reach;
    // entities first
    const tgt = g.query(hx, hy, it && it.reach ? 16 : 14, e => e !== this && !e.dead && e.hurt && e.team !== 'item' && e.team !== 'proj' && this.canHit(e));
    if (tgt.length) {
      const dmg = (it ? (it.dmg || 1) : 1) * (this.buff > 0 ? 1.25 : 1);
      for (const e of tgt.slice(0, it && it.tool === 'sword' ? 3 : 1)) { e.hurt(dmg, this, 120); }
      Audio.play('hit'); g.fx.shake(1.5, 0.08); g.hitstop = 0.04; if (it && it.dur) this.wear(); return;
    }
    // tiles
    const T = g.target; if (!T) return;
    const r = g.useTool(T.x, T.y, it, this);
    if (r && it && it.dur) this.wear();
  }
  canHit(e) {
    const g = this.g;
    if (e.isDog && e.owned) return false; if (e instanceof Soldier && e.mine) return false;
    if (e.team && e.team.startsWith('v:')) { const n = g.nationOf(e.vid); if (n && n.status === 'war') return true; return false; }
    return true;
  }
  eat() {
    const g = this.g, s = this.item, it = ITEMS[s.id];
    if (this.food >= 20 && !(it.heal && this.hp < this.maxHp)) { g.toast("You're full."); return; }
    this.food = Math.min(20, this.food + (it.food || 1)); if (it.heal) this.hp = Math.min(this.maxHp, this.hp + it.heal);
    if (s.id === 'rotten' && Math.random() < 0.5) { this.food = Math.max(0, this.food - 2); g.toast('Ugh... that was rotten.'); }
    this.useUp(); this.useCd = 0.5; Audio.play('eat'); g.fx.burst(this.x, this.y - 14, 6, ['#f2d8a0', '#c8945a', '#ffffff'], { z: 14, sp1: 30 }); g.ui.dirty(); g.stats.eaten++;
  }
  plant(T, it) {
    const g = this.g, w = g.world, gr = w.ground(T.x, T.y), o = w.obj(T.x, T.y);
    if (it.plant) {
      if ((gr === G.TILLED || gr === G.WET) && !o && !w.block(T.x, T.y)) { w.set(T.x, T.y, { o: it.plant, m: 0 }); this.useUp(); Audio.play('plant'); this.useCd = 0.2; g.fx.burst(T.x * TS + 8, T.y * TS + 12, 4, ['#6a472f', '#88603f'], {}); return; }
      g.toast('Plant seeds in tilled soil (use a hoe).', 'hint'); return;
    }
    if (it.tree) {
      if ((gr === G.GRASS || gr === G.FOREST || gr === G.SAKURA || gr === G.DIRT || gr === G.SNOW) && !o && !w.block(T.x, T.y) && !g.entAtTile(T.x, T.y)) { w.set(T.x, T.y, { o: O.SAPLING, m: it.tree }); this.useUp(); Audio.play('plant'); this.useCd = 0.2; return; }
      g.toast('Saplings need open ground.', 'hint');
    }
  }
  place(T, it) {
    const g = this.g, w = g.world, P = it.place, gr = w.ground(T.x, T.y);
    const tileFree = !w.block(T.x, T.y) && !w.obj(T.x, T.y) && !isWater(gr);
    if (P.g != null) { if (w.block(T.x, T.y) || gr === P.g || (isWater(gr) && P.g !== G.WOOD)) return; if (isWater(gr) && w.obj(T.x, T.y)) w.set(T.x, T.y, { o: 0 }); if (isWater(gr)) { g.toast('Bridge plank laid.', 'hint'); } if (w.obj(T.x, T.y) && OBJ[w.obj(T.x, T.y)].solid) return; w.set(T.x, T.y, { g: P.g }); }
    else if (P.b != null) { if (!tileFree || g.entAtTile(T.x, T.y, true)) { g.toast("Can't build there."); Audio.play('error'); return; } w.set(T.x, T.y, { b: P.b }); }
    else if (P.o != null) {
      if (!tileFree) { g.toast("Can't place there."); Audio.play('error'); return; }
      if (OBJ[P.o].solid && g.entAtTile(T.x, T.y, true)) { g.toast('Something is in the way.'); return; }
      w.set(T.x, T.y, { o: P.o, m: 0 });
      if (P.o === O.BED) { g.spawnPoint = { x: T.x * TS + 8, y: (T.y + 1) * TS + 8 }; g.toast('Spawn point set.'); }
    }
    this.useUp(); this.useCd = 0.18; this.swing(0.2); Audio.play('place'); g.fx.burst(T.x * TS + 8, T.y * TS + 14, 5, ['#d8c8a8', '#a89878'], {}); g.stats.built++;
  }
  shoot() {
    const g = this.g; if (!this.count('arrow')) { g.toast('No arrows.'); this.useCd = 0.4; return; }
    const aim = g.aimWorld(); let tx, ty;
    if (aim && !Input.touch) { tx = aim.x; ty = aim.y; } else { const e = g.nearest(this.x, this.y, 140, e => g.hostile(this, e) || (e instanceof Animal)); if (e) { tx = e.x; ty = e.y - 8; } else { const [dx, dy] = DIRV[this.dir]; tx = this.x + dx * 100; ty = this.y - 9 + dy * 100; } }
    this.dir = dirOf(tx - this.x, ty - this.y); this.remove('arrow', 1); g.shoot(this, tx, ty, (ITEMS.bow.dmg) * (this.buff > 0 ? 1.25 : 1), 'arrow'); this.swing(0.3); this.useCd = 0.55; this.wear();
  }
  water(T) {
    const g = this.g, w = g.world, s = this.item;
    const gr = w.ground(T.x, T.y);
    if (isWater(gr)) { s.d = ITEMS.can.dur; g.toast('Watering can refilled.'); Audio.play('splash'); g.ui.dirty(); return; }
    if (s.d <= 0) { g.toast('The can is empty. Refill at water.'); return; }
    if (gr === G.TILLED) { w.set(T.x, T.y, { g: G.WET }); s.d = Math.max(0, s.d - 10); Audio.play('water'); this.swing(0.25); this.useCd = 0.25; g.fx.burst(T.x * TS + 8, T.y * TS + 8, 8, ['#7fd3cf', '#bfe7f4'], { z: 8, sp1: 25 }); g.ui.dirty(); }
  }
  animalTool(tool) {
    const g = this.g, a = g.nearest(this.x + DIRV[this.dir][0] * 12, this.y + DIRV[this.dir][1] * 12, 18, e => e instanceof Animal);
    if (!a) return;
    if (tool === 'shears' && a.kind === 'sheep' && !a.shorn && !a.baby) { a.setShorn(1); a.produceT = 240; g.drop('wool', randi(1, 3), a.x, a.y); Audio.play('sheep'); this.wear(); this.swing(0.25); }
    else if (tool === 'bucket' && a.kind === 'cow' && a.milked <= 0 && !a.baby) { a.milked = 200; this.add('milk', 1); Audio.play('cow'); g.toast('+1 Milk'); this.swing(0.25); }
  }
  dropSel() { const s = this.item; if (!s) return; const n = Input.down('Shift') ? s.n : 1; const [dx, dy] = DIRV[this.dir]; const d = this.g.drop(s.id, n, this.x + dx * 14, this.y + dy * 14); d.pickDelay = 1.5; if (s.n > n) s.n -= n; else this.inv[this.sel] = null; this.g.ui.dirty(); }
  // ---------- interaction ----------
  interact() {
    const g = this.g, T = g.target, aim = g.aimWorld();
    // entities near the cursor / in front
    const px = aim && !Input.touch && dist2(aim.x, aim.y, this.x, this.y) < 60 * 60 ? aim.x : this.x + DIRV[this.dir][0] * 14;
    const py = aim && !Input.touch && dist2(aim.x, aim.y, this.x, this.y) < 60 * 60 ? aim.y + 6 : this.y + DIRV[this.dir][1] * 14;
    const e = g.nearest(px, py, 18, e => e !== this && !e.dead && (e instanceof Villager || e instanceof Soldier || e instanceof Dog || e instanceof Animal) && (!e.inside || e.inRoom) && !e.wild);
    if (e) { this.dir = dirOf(e.x - this.x, e.y - this.y); return g.interactEnt(e); }
    if (T) return g.interactTile(T.x, T.y);
    return false;
  }
  // ---------- fishing ----------
  cast() {
    const g = this.g, aim = g.aimWorld(); let tx, ty;
    if (aim && !Input.touch) { const dx = aim.x - this.x, dy = aim.y - this.y, d = Math.hypot(dx, dy), k = Math.min(1, 80 / (d || 1)); tx = this.x + dx * k; ty = this.y + dy * k; }
    else { const [dx, dy] = DIRV[this.dir]; tx = this.x + dx * 48; ty = this.y + dy * 48; }
    this.dir = dirOf(tx - this.x, ty - this.y); this.swing(0.35);
    this.fish = { st: 'fly', x0: this.x, y0: this.y - 14, x: this.x, y: this.y - 14, tx, ty, t: 0, wait: 0 }; Audio.play('cast');
  }
  cancelFish() { if (this.fish) { this.fish = null; this.g.ui.fishBar(null); } }
  updateFish(dt, press) {
    const g = this.g, F = this.fish; F.t += dt;
    if (F.st === 'fly') {
      const k = Math.min(1, F.t / 0.5); F.x = F.x0 + (F.tx - F.x0) * k; F.y = F.y0 + (F.ty - F.y0) * k - Math.sin(k * Math.PI) * 20;
      if (k >= 1) { const tx = Math.floor(F.tx / TS), ty = Math.floor(F.ty / TS);
        if (!isWater(g.world.ground(tx, ty)) || g.world.block(tx, ty)) { g.toast('Cast into open water.', 'hint'); this.cancelFish(); return; }
        F.st = 'wait'; F.t = 0; F.wait = rand(2, 7) * (g.raining ? 0.7 : 1); Audio.play('splash', { vol: 0.4 }); g.fx.spawn({ x: F.x, y: F.y, life: 0.8, k: 'ring', s: 6, c: '#e8fbff' }); F.biome = g.waterBiome(tx, ty); }
      return;
    }
    if (F.st === 'wait') { if (Math.random() < dt * 0.8) g.fx.spawn({ x: F.x + rand(-6, 6), y: F.y + rand(-3, 3), life: 0.7, k: 'ring', s: 3, c: '#cfefff' }); if (press) { this.cancelFish(); return; } if (F.t > F.wait) { F.st = 'bite'; F.t = 0; Audio.play('bite'); this.say('!', 0.8); } return; }
    if (F.st === 'bite') { if (press) { F.st = 'reel'; F.t = 0; F.prog = 0.3; F.zone = 0.3; F.zv = 0; F.fishPos = 0.5; F.fv = 0; F.item = pick(FISH_TABLE[F.biome] || FISH_TABLE.lake); if (g.hour < 4 && Math.random() < 0.04) F.item = 'fish_golden'; F.diff = { fish_carp: 0.6, fish_trout: 0.8, fish_salmon: 1.0, fish_catfish: 0.9, fish_eel: 1.3, fish_golden: 1.6 }[F.item] || 1; Audio.play('reel'); }
      else if (F.t > 0.9) { g.toast('It got away...'); this.cancelFish(); } return; }
    if (F.st === 'reel') {
      const hold = Input.mdown[0] || Input.tbtn.use || Input.down('j') || Input.down(' ');
      F.zv += (hold ? 2.6 : -2.2) * dt; F.zv *= Math.pow(0.15, dt); F.zone = clamp(F.zone + F.zv * dt * 1.6, 0, 0.72); if (F.zone === 0 || F.zone === 0.72) F.zv *= -0.3;
      F.fv += (Math.random() - 0.5) * 9 * F.diff * dt + Math.sin(F.t * (1.5 + F.diff)) * 0.8 * dt * F.diff; F.fv *= Math.pow(0.4, dt); F.fishPos = clamp(F.fishPos + F.fv * dt * 2, 0.02, 0.98); if (F.fishPos <= 0.02 || F.fishPos >= 0.98) F.fv *= -0.5;
      const inZone = F.fishPos >= F.zone && F.fishPos <= F.zone + 0.28;
      F.prog = clamp(F.prog + (inZone ? 0.32 : -0.24 * F.diff) * dt, 0, 1);
      if (Math.random() < dt * 3) g.fx.spawn({ x: F.x + rand(-5, 5), y: F.y + rand(-2, 2), z: 2, vz: 20, g: 120, life: 0.5, c: '#e8fbff' });
      g.ui.fishBar(F);
      if (F.prog >= 1) { this.add(F.item, 1); g.toast(`Caught a ${ITEMS[F.item].n}!`, 'good', F.item); Audio.play('catch'); g.stats.fish++; this.wear(); this.cancelFish(); }
      else if (F.prog <= 0) { g.toast('The fish escaped.'); this.cancelFish(); }
    }
  }
  hurt(d, src, kb) {
    if (this.rollT > 0) return false;
    const def = this.armor ? ITEMS[this.armor.id].def : 0; d = Math.max(1, Math.round(d * (1 - def / (def + 6))));
    const r = super.hurt(d, src, kb);
    if (r) { this.ifr = 0.6; this.g.fx.shake(3, 0.18); Audio.play('hurt'); this.g.ui.dirty(); this.g.ui.hurtFlash(); if (this.armor && Math.random() < 0.3) { this.armor.d = (this.armor.d || 200) - 1; } }
    return r;
  }
  die() { this.alive = false; }
  draw(ctx, ox, oy) {
    super.draw(ctx, ox, oy);
    if (this.fish) { const F = this.fish, [dx] = DIRV[this.dir];
      const tipx = Math.round(this.x - ox + dx * 10 + (this.dir === 0 ? -8 : this.dir === 2 ? 8 : 0)), tipy = Math.round(this.y - oy - 22);
      const bx = Math.round(F.x - ox), by = Math.round(F.y - oy + (F.st === 'bite' ? 2 : F.st === 'reel' ? Math.sin(F.t * 30) : Math.sin(F.t * 3) * 0.6));
      ctx.strokeStyle = 'rgba(240,240,255,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tipx + 0.5, tipy + 0.5); ctx.quadraticCurveTo((tipx + bx) / 2, Math.max(tipy, by) + 6, bx + 0.5, by + 0.5); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(bx - 1, by - 1, 3, 1); ctx.fillStyle = '#e03a2a'; ctx.fillRect(bx - 1, by, 3, 2); }
  }
  save() { return { x: this.x, y: this.y, hp: this.hp, food: this.food, inv: this.inv, sel: this.sel, armor: this.armor, coins: this.coins, look: this.lookOpts, buff: this.buff }; }
}
