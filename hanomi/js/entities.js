// Hanomi — entities: player, villagers, soldiers, zombies, dogs, animals, drops, arrows.
import { TS, G, O, OBJ, isWater } from './defs.js';
import { clamp, rand, randi, pick, TAU, dist2 } from './util.js';
import { bakeChar, villagerLook, soldierLook, zombieLook, FX, FY } from './art/chars.js';
import { bakeAnimal } from './art/animals.js';
import { bakeDog } from './art/dog.js';
import { ITEMS } from './items.js';
import { ICON } from './art/icons.js';
import { Audio } from './audio.js';

let NID = 1;
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
export const nextId = () => NID++;
export const setNextId = n => { NID = Math.max(NID, n); };
const DIRV = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const dirOf = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 0 : 2);

export class Ent {
  constructor(g, x, y) {
    this.g = g; this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.z = 0; this.vz = 0; this.r = 4; this.hp = this.maxHp = 10;
    this.dead = false; this.dir = 0; this.t = 0; this.flash = 0; this.kbx = 0; this.kby = 0; this.id = nextId(); this.team = 'nature';
    this.speed = 40; this.solidEnt = true; this.persist = false; this.atkCd = 0; this.target = null; this.path = null; this.stuck = 0; this.ifr = 0;
  }
  get tx() { return Math.floor(this.x / TS); } get ty() { return Math.floor(this.y / TS); }
  blocked(px, py) {
    const w = this.g.world, hw = this.r, x0 = Math.floor((px - hw) / TS), x1 = Math.floor((px + hw) / TS), y0 = Math.floor((py - 4) / TS), y1 = Math.floor(py / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (w.solid(tx, ty, this.swims) || (this.noWater && isWater(w.ground(tx, ty)))) return true;
    return false;
  }
  move(dx, dy) {
    let hit = false;
    if (dx) { if (!this.blocked(this.x + dx, this.y)) this.x += dx; else hit = true; }
    if (dy) { if (!this.blocked(this.x, this.y + dy)) this.y += dy; else hit = true; }
    return hit;
  }
  inWater() { const w = this.g.world; return isWater(w.ground(this.tx, this.ty)); }
  waterLevel() { const g = this.g; if (g.inside) return 0; const t = this.tx + this.ty * 7919; if (this._wlT !== t) { this._wlT = t; this._wl = g.world.depth(this.tx, this.ty); } return this._wl; }
  waterFx(dt) { // ripples, wake and splashes for anything standing in water
    const wl = this.waterLevel(), g = this.g;
    if (wl && !this._wasWet) { g.fx.burst(this.x, this.y, 8, ['#e8fbff', '#bfe7f4', '#ffffff'], { z: 2, vz0: 30, vz1: 70, sp1: 30, l1: 0.6 }); Audio.play('splash', { vol: g.vol(this.x, this.y) * 0.5 }); }
    this._wasWet = !!wl; if (!wl) return;
    this._rip = (this._rip || 0) - dt;
    if (this._rip <= 0) { this._rip = this.moving ? 0.22 : 0.9; g.fx.spawn({ x: this.x, y: this.y - (wl === 2 ? 4 : 1), life: this.moving ? 0.6 : 1.1, k: 'ring', s: wl === 2 ? 9 : 6, c: '#e8fbff' });
      if (this.moving) for (let k = 0; k < (wl === 2 ? 3 : 2); k++) g.fx.spawn({ x: this.x + rand(-5, 5), y: this.y - 2, z: 2, vz: rand(20, 45), vx: rand(-14, 14), g: 160, life: 0.45, c: Math.random() < 0.5 ? '#ffffff' : '#bfe7f4' }); }
  }
  // draw a sprite frame with the waterline cutting it: shallow hides the feet, deep shows head & shoulders
  drawWet(ctx, img, x, y, wl, bob) {
    const h = img.height, w = img.width, cut = wl === 2 ? 19 : h - 4 - (this.footY ? 0 : 0);
    if (wl === 1) { ctx.drawImage(img, 0, 0, w, h - 5, x, y, w, h - 5); ctx.fillStyle = 'rgba(232,251,255,0.55)'; ctx.fillRect(x + w / 2 - 6, y + h - 5, 12, 1); return; }
    const yy = y + (h - cut) - 6 + bob; ctx.drawImage(img, 0, 0, w, cut, x, yy, w, cut);
    ctx.fillStyle = 'rgba(232,251,255,0.7)'; ctx.fillRect(x + w / 2 - 7, yy + cut, 14, 1); ctx.fillStyle = 'rgba(190,230,240,0.4)'; ctx.fillRect(x + w / 2 - 9, yy + cut + 1, 18, 1);
  }
  physics(dt) {
    if (this.kbx || this.kby) { this.move(this.kbx * dt, this.kby * dt); const d = Math.pow(0.002, dt); this.kbx *= d; this.kby *= d; if (Math.abs(this.kbx) + Math.abs(this.kby) < 2) this.kbx = this.kby = 0; }
    if (this.z > 0 || this.vz) { this.vz -= 300 * dt; this.z += this.vz * dt; if (this.z <= 0) { this.z = 0; this.vz = 0; } }
    if (this.flash > 0) this.flash -= dt; if (this.atkCd > 0) this.atkCd -= dt; if (this.ifr > 0) this.ifr -= dt;
  }
  hurt(dmg, src, kb = 90) {
    if (this.dead || this.ifr > 0) return false;
    this.hp -= dmg; this.flash = 0.18;
    if (src) { const dx = this.x - src.x, dy = this.y - src.y, d = Math.hypot(dx, dy) || 1; this.kbx = dx / d * kb; this.kby = dy / d * kb; }
    this.g.fx.burst(this.x, this.y - 8, 5, this.bloodCols || ['#e8e0d0', '#c8b8a8'], { sp0: 20, sp1: 60, l0: 0.25, l1: 0.5 });
    this.onHurt && this.onHurt(src, dmg);
    if (this.hp <= 0) { this.dead = true; this.die && this.die(src); this.g.onDeath(this, src); }
    return true;
  }
  // walk toward point using steering + occasional A*
  seek(tx, ty, sp, dt, stopAt = 2) {
    let gx = tx, gy = ty;
    if (this.path && this.path.length) { const n = this.path[0]; gx = n[0] * TS + 8; gy = n[1] * TS + 12; if (dist2(this.x, this.y, gx, gy) < 25) { this.path.shift(); } }
    const dx = gx - this.x, dy = gy - this.y, d = Math.hypot(dx, dy);
    if (d < stopAt && !(this.path && this.path.length)) { this.moving = false; return true; }
    const wl = this.waterLevel(), k = (wl === 2 ? 0.5 : wl ? 0.7 : 1) * sp * dt / (d || 1);
    const ox = this.x, oy = this.y;
    this.move(dx * k, dy * k); this.dir = dirOf(dx, dy); this.moving = true;
    const moved = Math.abs(this.x - ox) + Math.abs(this.y - oy);
    if (moved < sp * dt * 0.3) { this.stuck += dt; if (this.stuck > 0.45) { this.stuck = 0; this.path = this.g.findPath(this.tx, this.ty, Math.floor(tx / TS), Math.floor(ty / TS)); } }
    else this.stuck = Math.max(0, this.stuck - dt);
    return false;
  }
  shadow() { return this.waterLevel() ? null : [this.x, this.y, 5, 2]; }
  save() { return null; }
}

/* ===================== humanoids ===================== */
export class Human extends Ent {
  constructor(g, x, y, look) { super(g, x, y); this.look = look; this.frames = bakeChar(look); this.r = 4; this.act = 0; this.actT = 0; this.held = null; this.bubble = null; this.bubbleT = 0; this.moving = false; this.bloodCols = ['#d8484a', '#a82a3a']; }
  say(text, t = 3) { this.bubble = text; this.bubbleT = t; }
  physics(dt) { super.physics(dt); this.waterFx(dt); if (this.bubbleT > 0) { this.bubbleT -= dt; if (this.bubbleT <= 0) this.bubble = null; } if (this.actT > 0) this.actT -= dt; this.t += dt; }
  frame() {
    const F = this.frames[this.dir]; let set, i;
    if (this.actT > 0) { const p = 1 - this.actT / this.actDur; set = 'act'; i = Math.min(2, (p * 3) | 0); }
    else if (this.moving) { set = 'walk'; i = ((this.t * (this.walkFps || 8)) | 0) % 4; }
    else { set = 'idle'; i = ((this.t * 1.6) | 0) % 4; }
    this._hand = F[set + 'H'] && F[set + 'H'][i]; return F[set][i];
  }
  draw(ctx, ox, oy) {
    const fr = this.frame(), x = Math.round(this.x - ox - FX), y = Math.round(this.y - oy - FY - this.z), wl = this.z > 0 ? 0 : this.waterLevel();
    if (wl === 2) { this.drawWet(ctx, fr, x, y, 2, Math.round(Math.sin(this.t * 4) * 0.8)); return; }
    const behind = this.dir === 2;
    if (behind) this.drawHeld(ctx, x, y);
    if (wl === 1) this.drawWet(ctx, fr, x, y, 1, 0); else ctx.drawImage(fr, x, y);
    if (this.flash > 0) drawFlash(ctx, fr, x, y);
    if (!behind) this.drawHeld(ctx, x, y);
  }
  heldIcon() { return this.held && ICON[this.held]; }
  // tools are gripped at the handle in the animated hand and swung through a real arc
  drawHeld(ctx, fx, fy) {
    const ic = this.heldIcon(), H = this._hand; if (!ic || !H) return;
    const it = ITEMS[this.held], d = this.dir, hx = fx + H[0], hy = fy + H[1];
    const tool = it && (it.k === 'tool' || it.k === 'weapon');
    if (!tool) { // carried things: held up in the hand, bobbing with it
      const sz = 11, bx = Math.round(hx - sz / 2 + (d === 1 ? 2 : d === 3 ? -2 : 0)), by = Math.round(hy - sz + 2);
      ctx.drawImage(ic, bx, by, sz, sz); this.grip(ctx, hx, hy); return;
    }
    const T = { 1: [-1.05, -2.7, 0.75], 0: [2.45, 4.1, 1.35], 2: [-1.9, -0.7, -3.0] }[d === 3 ? 1 : d];
    let ang = T[0] + Math.sin(this.t * 9) * (this.moving ? 0.1 : 0.03), p = -1;
    if (this.actT > 0) { p = 1 - this.actT / this.actDur;
      ang = p < 0.28 ? T[0] + (T[1] - T[0]) * ease(p / 0.28) : p < 0.58 ? T[1] + (T[2] - T[1]) * ease((p - 0.28) / 0.3) : T[2] + (T[0] - T[2]) * ease((p - 0.58) / 0.42) * 0.6; }
    if (this.fishing) ang = -0.45;
    const mir = d === 3 || (d === 2);
    ctx.save(); ctx.translate(Math.round(hx), Math.round(hy)); if (mir) ctx.scale(-1, 1);
    // motion trail during the strike
    if (p > 0.28 && p < 0.6) { ctx.fillStyle = 'rgba(255,248,232,0.55)'; const a1 = T[1] + (T[2] - T[1]) * Math.max(0, ease((p - 0.28) / 0.3) - 0.35);
      for (let k = 0; k <= 8; k++) { const a = a1 + (ang - a1) * k / 8; for (const r of [11, 13]) ctx.fillRect(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r), 1, 1); } }
    ctx.rotate(ang + 0.83); ctx.drawImage(ic, -3, -13); ctx.restore();
    this.grip(ctx, hx, hy);
  }
  grip(ctx, hx, hy) { const L = this.look; if (!L) return; ctx.fillStyle = '#' + L.skin.toString(16).padStart(6, '0'); ctx.fillRect(Math.round(hx - 1), Math.round(hy - 1), 2, 2); ctx.fillStyle = 'rgba(42,26,34,0.85)'; ctx.fillRect(Math.round(hx - 1), Math.round(hy + 1), 2, 1); }
  swing(dur = 0.32) { this.actT = this.actDur = dur; }
}
const flashCache = new WeakMap();
function drawFlash(ctx, fr, x, y) {
  let w = flashCache.get(fr);
  if (!w) { w = document.createElement('canvas'); w.width = fr.width; w.height = fr.height; const c = w.getContext('2d'); c.drawImage(fr, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#fff'; c.fillRect(0, 0, w.width, w.height); flashCache.set(fr, w); }
  ctx.globalAlpha = 0.6; ctx.drawImage(w, x, y); ctx.globalAlpha = 1;
}

/* ---------- villagers (any village), incl. merchant & chief ---------- */
const CONVOS = [
  ['Did you hear the wolves last night?', 'I kept the shutters closed till dawn.'], ['The koi in Hanomi look fat this year.', 'Someone keeps feeding them, ha!'],
  ['My carrots are finally sprouting.', 'Rain helps more than any watering can.'], ['Is that traveller from Hanomi?', 'They say the dog never leaves their side.'],
  ['Tea later?', 'Only if you bring the mochi.'], ['The chief looks worried.', 'A red moon is coming, they say.'], ['Iron prices went up again.', 'Blame the zombies in the hills.'],
  ['Look at the sakura!', 'Petals in my soup again...'], ['Have you been to the shrine?', 'Every morning. It brings good luck.'], ['Nice weather.', 'For now. Clouds in the west.'],
];
const CHAT = ['Lovely day for it.', 'The sakura bloom early this year.', 'Mind the forest after dark.', 'My back aches from the fields.', 'Have you seen the koi? So calm.', 'The rice will be good this season.',
  'They say the dead walk under a red moon.', 'Fresh fish is the best breakfast.', 'Ah, a traveller!', 'Watch your step, the soil is wet.', 'I miss my old dog...', 'Iron is found deep in the grey hills.'];
export class Villager extends Human {
  constructor(g, x, y, o) {
    const role = o.role || 'villager';
    const look = villagerLook(o.seed || randi(1, 1e6), role === 'chief' ? { hat: 'eboshi', shirt: 0x3a2a4a, sash: 0xe8c040, beard: true } : role === 'merchant' ? { hat: 'kasa', hatColor: 0xc8a050 } : {});
    super(g, x, y, look); this.role = role; this.vid = o.vid; this.seed = look.seed; this.home = o.home; this.hx = o.hx ?? x; this.hy = o.hy ?? y;
    this.team = 'v:' + o.vid; this.hp = this.maxHp = 16; this.speed = 26; this.persist = true; this.wanderT = rand(1, 4); this.goal = null; this.inside = false; this.name = o.name || pick(['Haru', 'Kenji', 'Mai', 'Sora', 'Yui', 'Taro', 'Emi', 'Goro', 'Rin', 'Aki', 'Nao', 'Hiro', 'Kiku', 'Momo']);
  }
  update(dt) {
    this.physics(dt);
    const g = this.g, night = g.hour >= 20 || g.hour < 6;
    if (this.inside) { if (!night || this.role !== 'villager') { this.inside = false; if (this.inRoom && this.homeDoor) { this.x = this.homeDoor.x * TS + 8; this.y = (this.homeDoor.y + 1) * TS + 10; } this.inRoom = null; } else { this.moving = false; return; } }
    // flee from nearby undead
    const z = g.nearest(this.x, this.y, 80, e => e.team === 'undead' || (e.hostileTo && e.hostileTo(this)));
    if (z && this.role !== 'chief') { const dx = this.x - z.x, dy = this.y - z.y, d = Math.hypot(dx, dy) || 1; this.move(dx / d * 42 * dt, dy / d * 42 * dt); this.dir = dirOf(-dx, -dy); this.moving = true; if (Math.random() < 0.01) this.say(pick(['Help!', 'Zombies!', 'Aaah!'])); return; }
    if (night && this.role === 'villager' && this.homeDoor) {
      this.held = null; this.task = null; this.chatWith = null;
      if (this.seek(this.homeDoor.x * TS + 8, (this.homeDoor.y + 1) * TS + 8, this.speed * 1.3, dt, 6)) { this.inside = true; this.moving = false;
        const rec = g.interiorOf(this.vid, this.homeSi); if (rec) { this.inRoom = rec.key; this.x = (rec.x + 2 + ((this.id * 3) % (rec.w - 4))) * TS + 8; this.y = (rec.y + 3 + (this.id % 2)) * TS + 8; this.dir = 0; } }
      return;
    }
    if (this.role === 'merchant' || this.role === 'chief') { if (dist2(this.x, this.y, this.hx, this.hy) > 400) this.seek(this.hx, this.hy, this.speed, dt); else { this.moving = false; const p = g.player; if (dist2(p.x, p.y, this.x, this.y) < 4000) this.dir = dirOf(p.x - this.x, p.y - this.y); } return; }
    // daily routine: work in the morning, gather at midday & dusk, wander in between
    const h = g.hour, v = this.village || (this.village = g.villageById(this.vid));
    const phase = h < 11 ? 'work' : h < 14 ? 'social' : h < 18 ? 'work' : 'social';
    if (this.chatWith) { // a little conversation with a neighbour
      const o = this.chatWith; if (o.dead || o.inside) { this.chatWith = null; return; } this.moving = false; this.dir = dirOf(o.x - this.x, o.y - this.y);
      if ((this.chatT -= dt) <= 0) { if (this.chatLines.length) { const [who, line] = this.chatLines.shift(); (who ? o : this).say(line, 2.6); this.chatT = 2.8; } else { this.chatWith = null; o.chatWith = null; this.wanderT = rand(6, 12); } }
      return;
    }
    if (this.goal) {
      const done = this.seek(this.goal.x, this.goal.y, this.speed, dt, 3) || (this.wanderT -= dt) < -8;
      if (done) { this.task = this.goal.task; this.goal = null; this.wanderT = rand(3, 7); this.taskT = rand(4, 9); }
    } else {
      this.moving = false;
      if (this.task === 'farm' && (this.taskT -= dt) > 0) { if (this.actT <= 0 && Math.random() < dt * 0.9) { this.swing(0.45); this.held = 'hoe_wood'; if (Math.random() < 0.3) g.fx.burst(this.x + [0, 8, 0, -8][this.dir], this.y + [8, 0, -8, 0][this.dir], 3, ['#6a472f', '#88603f'], {}); } }
      else if (this.task === 'sweep' && (this.taskT -= dt) > 0) { this.held = 'stick'; if (this.actT <= 0 && Math.random() < dt * 0.7) this.swing(0.5); }
      else { this.task = null; this.held = null; }
      if ((this.wanderT -= dt) <= 0 && v) {
        let gx, gy, task = null;
        if (phase === 'work') {
          const F = v._fields || (v._fields = [...v.ov.entries()].filter(([, o]) => o.g === G.TILLED).map(([k]) => k.split(',').map(Number)));
          if (F.length && Math.random() < 0.6) { const [fx, fy] = pick(F); gx = fx * TS + 8; gy = (fy + 1) * TS + 6; task = 'farm'; }
          else if (Math.random() < 0.4) { gx = v.x * TS + rand(-50, 50); gy = v.y * TS + rand(-40, 40); task = 'sweep'; }
        } else { gx = v.x * TS + rand(-56, 56); gy = v.y * TS + rand(-30, 50); }
        if (gx == null) { const a = rand(TAU), r = rand(16, 80); gx = this.hx + Math.cos(a) * r; gy = this.hy + Math.sin(a) * r; }
        this.goal = { x: gx, y: gy, task }; this.path = null;
      }
      // strike up a conversation
      if (phase === 'social' && !this.task && Math.random() < dt * 0.25) {
        const o = g.nearest(this.x, this.y, 28, e => e !== this && e instanceof Villager && e.role === 'villager' && !e.goal && !e.chatWith && !e.inside);
        if (o) { this.chatWith = o; o.chatWith = this; o.moving = false; o.dir = dirOf(this.x - o.x, this.y - o.y); this.chatLines = pick(CONVOS).map((l, i) => [i % 2, l]); this.chatT = 0.2; }
      }
    }
    if (!this.bubble && !this.chatWith && Math.random() < 0.0008 && dist2(g.player.x, g.player.y, this.x, this.y) < 9000) this.say(pick(CHAT), 3.5);
  }
  shadow() { return this.inside && !this.inRoom ? null : [this.x, this.y, 5, 2]; }
  draw(ctx, ox, oy) { if (!this.inside || this.inRoom) super.draw(ctx, ox, oy); }
  save() { return { k: 'villager', x: this.x, y: this.y, hp: this.hp, role: this.role, vid: this.vid, seed: this.seed, hx: this.hx, hy: this.hy, name: this.name, door: this.homeDoor, homeSi: this.homeSi }; }
}

/* ---------- soldiers: nation guards and the player's army ---------- */
export class Soldier extends Human {
  constructor(g, x, y, o) {
    const color = o.color ?? 0xc8423a; const archer = !!o.archer;
    super(g, x, y, soldierLook(o.seed || randi(1, 1e6), color, archer));
    this.seed = this.look.seed; this.archer = archer; this.color = color; this.vid = o.vid; this.mine = !!o.mine; this.persist = true;
    this.team = this.mine ? 'player' : 'v:' + o.vid; this.hp = this.maxHp = archer ? 18 : 28; this.speed = 44; this.dmg = archer ? 3 : 4; this.held = archer ? 'bow' : 'spear';
    this.order = o.order || (this.mine ? 'follow' : 'patrol'); this.post = o.post || { x, y }; this.slot = o.slot || 0; this.wanderT = 0; this.name = o.name || pick(['Ichiro', 'Jiro', 'Saburo', 'Goro', 'Kaede', 'Tomoe', 'Benkei', 'Musashi', 'Nobu', 'Kai', 'Akira', 'Ryo']);
    this.temp = o.temp || 0; this.walkFps = 9;
  }
  hostileTo(e) { return this.g.hostile(this, e); }
  update(dt) {
    this.physics(dt); const g = this.g;
    const night = g.daylight < 0.35; this.light = 0;
    if (!this.archer) { if (night && !this.target) { this.held = 'torch'; this.light = 4; } else this.held = 'spear'; }
    if (this.mine && this.hp < this.maxHp * 0.3 && this.target) { // fall back to the player and regroup
      const p = g.player; if (dist2(this.x, this.y, p.x, p.y) > 30 * 30) { this.seek(p.x, p.y, this.speed * 1.3, dt, 16); if (Math.random() < 0.01) this.say(pick(['Falling back!', 'I need a moment!'])); return; } }
    if (this.temp && g.day >= this.temp) { this.dead = true; g.toast(`${this.name} returns to their clan.`); return; }
    if (this.mine && this.hp < this.maxHp && !this.target) this.hp = Math.min(this.maxHp, this.hp + dt * 0.5);
    // target acquisition
    if (!this.target || this.target.dead || dist2(this.x, this.y, this.target.x, this.target.y) > 200 * 200 || (this.t % 1 < dt)) {
      const range = this.order === 'hold' ? 110 : 150;
      this.target = g.nearest(this.x, this.y, range, e => g.hostile(this, e) && !e.dead && !e.inside);
    }
    const T = this.target;
    if (T) {
      const d = Math.hypot(T.x - this.x, T.y - this.y), reach = this.archer ? 90 : 18;
      this.dir = dirOf(T.x - this.x, T.y - this.y);
      if (d > reach) this.seek(T.x, T.y, this.speed * 1.15, dt, reach * 0.8);
      else {
        this.moving = false;
        if (this.atkCd <= 0) {
          this.swing(this.archer ? 0.4 : 0.3); this.atkCd = this.archer ? 1.4 : 0.9;
          if (this.archer) g.shoot(this, T.x, T.y - 8, this.dmg, 'arrow');
          else { T.hurt(this.dmg, this); Audio.play('hit', { pan: g.pan(this.x), vol: g.vol(this.x, this.y) }); }
        }
      }
      return;
    }
    if (this.mine && this.order === 'follow') {
      const p = g.player, ang = -Math.PI / 2 + (this.slot % 6) / 6 * TAU, rr = 22 + Math.floor(this.slot / 6) * 14;
      const fx = p.x + Math.cos(ang) * rr, fy = p.y + Math.sin(ang) * rr * 0.7, d2 = dist2(this.x, this.y, fx, fy);
      if (d2 > 900 * 900) { this.x = p.x; this.y = p.y; }
      if (d2 > 40) this.seek(fx, fy, d2 > 6400 ? this.speed * 1.6 : this.speed, dt, 4); else { this.moving = false; this.dir = p.dir; }
      return;
    }
    if (this.order === 'raid' && this.raidTo) { this.seek(this.raidTo.x, this.raidTo.y, this.speed * 0.8, dt, 30); return; }
    // hold / patrol around post
    if (this.goal) { if (this.seek(this.goal.x, this.goal.y, this.speed * 0.6, dt, 3)) this.goal = null; }
    else { this.moving = false; if ((this.wanderT -= dt) <= 0) { this.wanderT = rand(3, 8);
      const v = !this.mine && this.vid && g.villageById(this.vid);
      if (v && this.order === 'patrol' && !night) { const arm = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]), d = rand(6, 17) * TS; this.goal = { x: v.x * TS + arm[0] * d + 8, y: v.y * TS + arm[1] * d + 20 }; }
      else { const r = this.order === 'hold' ? 20 : night ? 30 : 70, a = rand(TAU); this.goal = { x: this.post.x + Math.cos(a) * r, y: this.post.y + Math.sin(a) * r }; }
      this.path = null; } }
  }
  save() { return { k: 'soldier', x: this.x, y: this.y, hp: this.hp, vid: this.vid, mine: this.mine, archer: this.archer, color: this.color, seed: this.seed, order: this.order, post: this.post, slot: this.slot, name: this.name, temp: this.temp }; }
}

/* ---------- zombies ---------- */
export class Zombie extends Human {
  constructor(g, x, y, kind = 0) {
    super(g, x, y, zombieLook(randi(1, 1e6), kind)); this.kind = kind; this.team = 'undead'; this.bloodCols = ['#5a7a4a', '#3a5a3a', '#2a3a2a'];
    const S = [[16, 22, 2], [10, 40, 2], [42, 15, 4]][kind]; this.hp = this.maxHp = S[0] + g.day * 0.6; this.speed = S[1]; this.dmg = S[2] + Math.floor(g.day / 6);
    this.walkFps = 5; this.groanT = rand(3, 10); this.burn = 0; this.wanderT = 0; this.raid = false;
  }
  update(dt) {
    this.physics(dt); const g = this.g;
    if (g.daylight > 0.55 && !this.raid) { this.burn += dt; if (Math.random() < 0.3) g.fx.spawn({ x: this.x + rand(-4, 4), y: this.y, z: rand(6, 20), vz: 20, life: 0.6, c: pick(['#ff8a2a', '#ffd04a', '#5a5050']), k: 'dot' }); if (this.burn > 4) { this.hurt(999, null); } }
    if ((this.groanT -= dt) <= 0) { this.groanT = rand(5, 14); if (dist2(this.x, this.y, g.player.x, g.player.y) < 160 * 160) Audio.play('zombie', { pan: g.pan(this.x), vol: g.vol(this.x, this.y) * 0.7 }); }
    if (!this.target || this.target.dead || this.target.inside || (this.t % 1.2 < dt)) this.target = g.nearest(this.x, this.y, this.raid ? 260 : 170, e => e.team !== 'undead' && !e.dead && !e.inside && e.team !== 'wild' && e.alive !== false && (e.isPlayer || e instanceof Human || e.isDog || e.livestock));
    const T = this.target;
    if (T) {
      const d = Math.hypot(T.x - this.x, T.y - this.y);
      if (d > 13) { this.seek(T.x, T.y, this.speed, dt, 10); }
      else { this.moving = false; this.dir = dirOf(T.x - this.x, T.y - this.y); if (this.atkCd <= 0) { this.swing(0.4); this.atkCd = 1.1; T.hurt(this.dmg, this, 70); } }
      if (this.stuck > 0.3 && this.t % 1 < dt) this.bash();
      return;
    }
    if (this.raid && this.raidTo) { this.seek(this.raidTo.x, this.raidTo.y, this.speed, dt, 30); return; }
    if (this.goal) { if (this.seek(this.goal.x, this.goal.y, this.speed * 0.6, dt, 3)) this.goal = null; } else { this.moving = false; if ((this.wanderT -= dt) <= 0) { this.wanderT = rand(2, 5);
      // shamble around, but shy away from torchlight
      let best = null; for (let k = 0; k < 4; k++) { const a = rand(TAU), gx = this.x + Math.cos(a) * 50, gy = this.y + Math.sin(a) * 50; if (!g.lit(Math.floor(gx / 16), Math.floor(gy / 16))) { best = { x: gx, y: gy }; break; } }
      this.goal = best || { x: this.x + rand(-30, 30), y: this.y + rand(-30, 30) }; } }
  }
  onHurt(src) { if (!src) return; for (const z of this.g.query(this.x, this.y, 90, e => e.team === 'undead' && !e.target)) z.target = src; }
  bash() { // hit the built thing in our way
    const g = this.g, [dx, dy] = DIRV[this.dir], tx = Math.floor((this.x + dx * 10) / TS), ty = Math.floor((this.y - 2 + dy * 10) / TS);
    g.damageTile(tx, ty, 1, this, true);
  }
  die() { const g = this.g; if (Math.random() < 0.6) g.drop('rotten', 1, this.x, this.y); if (Math.random() < 0.3) g.drop('bone', 1, this.x, this.y); if (Math.random() < 0.45) g.drop('coin', randi(1, 3 + this.kind * 2), this.x, this.y); if (this.kind === 2 && Math.random() < 0.5) g.drop('iron', 1, this.x, this.y); Audio.play('zombieDie', { pan: g.pan(this.x), vol: g.vol(this.x, this.y) }); g.fx.burst(this.x, this.y - 8, 12, ['#5a7a4a', '#3a4a3a', '#8a9a7a'], { sp1: 70 }); }
}

/* ===================== dogs (rig sprites) ===================== */
export class Dog extends Ent {
  constructor(g, x, y, o) {
    super(g, x, y); this.breed = o.breed || 'bernese'; this.sp = bakeDog(this.breed); this.name = o.name || 'Kuma'; this.isDog = true;
    this.wild = !!o.wild; this.team = this.wild ? 'wild' : (o.owned ? 'player' : 'nature'); this.owned = !!o.owned; this.persist = !this.wild;
    this.hp = this.maxHp = this.wild ? 14 : 30; this.speed = this.wild ? 62 : 74; this.r = 5; this.state = 'sit'; this.st = 0; this.f = 1; this.love = o.love || 0; this.down = 0; this.dmg = this.wild ? 2 : 4;
    this.bloodCols = ['#d8d0c0', '#a89888']; this.heartT = 0; this.barkT = rand(4, 12); this.swims = !this.wild;
  }
  hostileTo(e) { return this.g.hostile(this, e); }
  update(dt) {
    this.physics(dt); this.waterFx(dt); this.st += dt; this.t += dt; const g = this.g, p = g.player;
    if (this.down > 0) { this.down -= dt; this.state = 'lie'; if (this.down <= 0) { this.hp = this.maxHp * 0.5; this.say && 0; } return; }
    if (this.heartT > 0) { this.heartT -= dt; if (Math.random() < dt * 4) g.fx.spawn({ x: this.x + rand(-6, 6), y: this.y, z: 22, vz: 14, life: 1, c: '#ff6a8a', k: 'heart', g: 0 }); }
    if (this.wild) return this.updateWild(dt);
    if (!this.owned) { // stray: wander & sit
      if (this.st > 4) { this.st = 0; this.state = pick(['sit', 'sit', 'idle', 'walk', 'lie']); this.goal = { x: this.x + rand(-40, 40), y: this.y + rand(-30, 30) }; }
      if (this.state === 'walk' && this.goal) { if (this.seek(this.goal.x, this.goal.y, 30, dt, 3)) this.state = 'sit'; this.f = this.vxSign(); }
      return;
    }
    // fight hostiles near the player
    if (!this.target || this.target.dead || this.t % 0.8 < dt) this.target = g.nearest(p.x, p.y, 110, e => g.hostile(this, e) && !e.dead);
    const T = this.target;
    if (T) {
      const d = Math.hypot(T.x - this.x, T.y - this.y); this.f = T.x > this.x ? 1 : -1;
      if (d > 14) { this.seek(T.x, T.y, this.speed * 1.15, dt, 10); this.state = 'run'; }
      else { this.state = 'bark'; if (this.atkCd <= 0) { this.atkCd = 0.75; this.vz = 70; T.hurt(this.dmg, this, 110); Audio.play('growl', { pan: g.pan(this.x), vol: 0.6 }); } }
      return;
    }
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (d > 520) { this.x = p.x - 12; this.y = p.y + 6; }
    if (this.fetch) { // play fetch: run to the stick, carry it back, drop it at your feet
      const st = this.fetch;
      if (!this.carry) { if (st.dead) { this.fetch = null; return; } if (st.z <= 0 && this.seek(st.x, st.y, this.speed * 1.2, dt, 6)) { st.dead = true; this.carry = true; Audio.play('pet', { vol: 0.4 }); } else if (st.z > 0) { this.seek(st.x, st.y, this.speed * 1.2, dt, 6); } this.state = 'run'; return; }
      if (this.seek(p.x + 10, p.y + 4, this.speed, dt, 10)) { const d = g.drop('stick', 1, this.x + this.f * 6, this.y); d.vz = 20; d.pickDelay = 0.2; this.fetch = null; this.carry = false; this.pet(); this.love = Math.min(100, this.love + 3); g.stats.fetches = (g.stats.fetches || 0) + 1; }
      this.state = 'run'; return;
    }
    if (d > 56) { const sp = d > 110 ? this.speed * 1.25 : this.speed * 0.7; this.seek(p.x - 14 * Math.sign(p.x - this.x || 1), p.y + 4, sp, dt, 4); this.state = d > 110 ? 'run' : 'walk'; this.f = p.x > this.x ? 1 : -1; this.st = 0; return; }
    // idle near the player
    if (this.state === 'run' || this.state === 'walk') { this.state = 'idle'; this.st = 0; }
    if (g.hour >= 21 || g.hour < 5) { if (this.st > 3 && p.idleT > 4) this.state = 'sleep'; else if (this.state !== 'sleep') this.state = 'lie'; }
    else if (this.st > rand(5, 9)) { this.st = 0; this.state = pick(['sit', 'sit', 'idle', 'lie', 'sniff']); }
    if ((this.barkT -= dt) <= 0) { this.barkT = rand(14, 40); if (this.state !== 'sleep') { this.state = 'bark'; this.st = 0; Audio.play('bark', { pan: g.pan(this.x), vol: 0.5 }); } }
    if (this.state === 'bark' && this.st > 0.8) this.state = 'sit';
    if (this.state === 'happy' && this.st > 2.2) this.state = 'sit';
  }
  updateWild(dt) {
    const g = this.g;
    if (!this.target || this.target.dead || this.t % 1 < dt) this.target = g.nearest(this.x, this.y, 130, e => (e.isPlayer || e.isDog && !e.wild || e.livestock || (e instanceof Human && e.team !== 'undead')) && !e.dead && !e.inside);
    const T = this.target;
    if (T) { const d = Math.hypot(T.x - this.x, T.y - this.y); this.f = T.x > this.x ? 1 : -1; if (d > 14) { this.seek(T.x, T.y, this.speed, dt, 10); this.state = 'run'; } else { this.state = 'bark'; if (this.atkCd <= 0) { this.atkCd = 1; this.vz = 60; T.hurt(this.dmg, this, 80); Audio.play('growl', { pan: g.pan(this.x), vol: g.vol(this.x, this.y) }); } } return; }
    if (this.goal) { this.state = 'walk'; this.f = this.vxSign(); if (this.seek(this.goal.x, this.goal.y, 30, dt, 3)) { this.goal = null; this.state = 'idle'; } }
    else if (this.st > 3) { this.st = 0; this.goal = { x: this.x + rand(-60, 60), y: this.y + rand(-50, 50) }; }
  }
  vxSign() { return this.goal ? (this.goal.x > this.x ? 1 : -1) : this.f; }
  seek(tx, ty, sp, dt, stop) { const r = super.seek(tx, ty, sp, dt, stop); if (Math.abs(tx - this.x) > 2) this.f = tx > this.x ? 1 : -1; return r; }
  hurt(d, src, kb) { if (this.owned && this.down > 0) return false; const r = super.hurt(d, src, kb); if (this.owned && this.dead) { this.dead = false; this.hp = 0; this.down = 25; this.g.toast(`${this.name} is hurt and needs rest!`); } return r; }
  die() { if (this.wild) { const g = this.g; if (Math.random() < 0.5) g.drop('leather', 1, this.x, this.y); g.drop('bone', 1, this.x, this.y); } }
  pet() { this.state = 'happy'; this.st = 0; this.heartT = 1.4; this.love = Math.min(100, this.love + 2); Audio.play('pet'); Audio.play('bark', { vol: 0.4, pitch: 1.15 }); }
  frameSet() {
    const F = this.sp.frames, s = this.state;
    if (s === 'run') return F.run[((this.t * 14) | 0) % 6];
    if (s === 'walk') return F.walk[((this.t * 10) | 0) % 8];
    if (s === 'sit') return F.sit[((this.t * 2) | 0) % 4];
    if (s === 'happy') return F.happy[((this.t * 6) | 0) % 4];
    if (s === 'lie') return F.lie[(this.t % 6 < 0.2) ? 1 : 0];
    if (s === 'sleep') return F.sleep[((this.t * 0.8) | 0) % 2];
    if (s === 'bark') return F.bark[((this.t * 6) | 0) % 2];
    if (s === 'sniff') return F.sniff[((this.t * 3) | 0) % 2];
    return F.idle[((this.t * 3) | 0) % 4];
  }
  draw(ctx, ox, oy) {
    const fr = this.frameSet(), img = this.f < 0 ? fr.f : fr.n, sp = this.sp;
    const x = Math.round(this.x - ox - (this.f < 0 ? sp.w - sp.ox : sp.ox)), y = Math.round(this.y - oy - sp.oy - this.z), wl = this.z > 0 ? 0 : this.waterLevel();
    if (wl) { const cut = wl === 2 ? sp.oy - 12 : sp.oy - 4, yy = y + (wl === 2 ? 9 + Math.round(Math.sin(this.t * 4)) : 0); ctx.drawImage(img, 0, 0, img.width, cut, x, yy, img.width, cut); ctx.fillStyle = 'rgba(232,251,255,0.6)'; ctx.fillRect(Math.round(this.x - ox) - 9, yy + cut, 18, 1); }
    else ctx.drawImage(img, x, y);
    if (this.flash > 0) drawFlash(ctx, img, x, y);
    if (this.carry) { ctx.fillStyle = '#8a5a34'; ctx.fillRect(Math.round(this.x - ox + this.f * 8) - 4, Math.round(this.y - oy - 13 - this.z), 9, 2); ctx.fillStyle = '#b07c48'; ctx.fillRect(Math.round(this.x - ox + this.f * 8) - 4, Math.round(this.y - oy - 13 - this.z), 9, 1); }
    if (this.state === 'sleep' && Math.random() < 0.01) this.g.fx.spawn({ x: this.x + this.f * 8, y: this.y, z: 16, vz: 8, vx: 4, life: 1.6, c: '#e8e8f8', k: 'z', g: 0 });
  }
  shadow() { return this.waterLevel() ? null : [this.x - this.f * 1, this.y, 8, 2]; }
  save() { return this.wild ? null : { k: 'dog', x: this.x, y: this.y, breed: this.breed, name: this.name, owned: this.owned, love: this.love, hp: this.hp }; }
}

/* ===================== animals ===================== */
const ANI = {
  chicken: { hp: 4, sp: 22, flee: 1, drops: [['raw_meat', 1, 1], ['feather', 1, 2]], food: ['wheat_seeds', 'rice_seeds'], sound: 'chicken' },
  cow: { hp: 14, sp: 16, drops: [['raw_meat', 2, 3], ['leather', 1, 2]], food: ['wheat'], sound: 'cow' },
  sheep: { hp: 10, sp: 18, drops: [['raw_meat', 1, 2], ['wool', 1, 2]], food: ['wheat'], sound: 'sheep' },
  pig: { hp: 10, sp: 18, drops: [['raw_meat', 2, 3]], food: ['carrot', 'pumpkin'] },
  rabbit: { hp: 3, sp: 46, flee: 2, drops: [['raw_meat', 1, 1], ['leather', 0, 1]], food: ['carrot'] },
  deer: { hp: 10, sp: 52, flee: 2, drops: [['raw_meat', 2, 2], ['leather', 1, 2]], food: ['apple'] },
  boar: { hp: 16, sp: 40, aggro: 1, drops: [['raw_meat', 2, 3], ['leather', 1, 1]], food: ['mushroom'] },
};
export class Animal extends Ent {
  constructor(g, x, y, o) {
    super(g, x, y); this.kind = o.kind; this.def = ANI[o.kind]; this.sp = bakeAnimal(o.kind); this.shorn = 0; this.persist = !!o.owned || !!o.pen; this.livestock = !!(o.owned || o.pen);
    this.hp = this.maxHp = this.def.hp; this.speed = this.def.sp; this.f = Math.random() < 0.5 ? 1 : -1; this.state = 'idle'; this.st = rand(0, 3); this.r = this.kind === 'cow' ? 6 : 4;
    this.baby = o.baby || 0; this.love = 0; this.produceT = o.produceT ?? rand(60, 200); this.milked = 0; this.pen = o.pen; this.owned = o.owned; this.noWater = true; this.bloodCols = ['#d8484a', '#a82a3a'];
    if (o.shorn) this.setShorn(1);
  }
  setShorn(v) { this.shorn = v; this.sp = bakeAnimal(this.kind, v ? 'shorn' : ''); }
  update(dt) {
    this.physics(dt); this.st -= dt; this.t += dt; const g = this.g, p = g.player;
    if (this.baby > 0) { this.baby -= dt; }
    if (this.love > 0) { this.love -= dt; if (Math.random() < dt * 3) g.fx.spawn({ x: this.x, y: this.y, z: 14, vz: 12, life: 1, c: '#ff6a8a', k: 'heart', g: 0 }); const m = g.nearest(this.x, this.y, 40, e => e !== this && e.kind === this.kind && e.love > 0 && !e.baby); if (m) { this.love = m.love = 0; g.spawnAnimal(this.kind, (this.x + m.x) / 2, (this.y + m.y) / 2, { baby: 240, owned: true }); g.fx.burst(this.x, this.y - 6, 10, ['#ff6a8a', '#ffd0e0'], {}); Audio.play('pet'); g.toast(`A baby ${this.kind} was born!`); g.stats.born++; } }
    if (this.livestock && this.kind === 'chicken' && (this.produceT -= dt) <= 0) { this.produceT = rand(150, 300); g.drop('egg', 1, this.x, this.y); }
    if (this.shorn && (this.produceT -= dt) <= 0) { this.setShorn(0); this.produceT = rand(150, 300); }
    if (this.milked > 0) this.milked -= dt;
    // aggro boar
    if (this.def.aggro && this.angry && !this.angry.dead) { const T = this.angry, d = Math.hypot(T.x - this.x, T.y - this.y); if (d > 120) this.angry = null; else { if (d > 12) { this.seek(T.x, T.y, this.speed, dt, 10); this.state = 'walk'; } else if (this.atkCd <= 0) { this.atkCd = 1.2; T.hurt(3, this, 120); } return; } }
    // flee
    const threat = this.def.flee ? g.nearest(this.x, this.y, this.def.flee > 1 ? 70 : 34, e => (e.isPlayer && !(g.holding(this.def.food))) || e.team === 'undead' || e.team === 'wild') : null;
    if (threat || this.panic > 0) { if (this.panic > 0) this.panic -= dt; const src = threat || this.panicFrom; if (src) { const dx = this.x - src.x, dy = this.y - src.y, d = Math.hypot(dx, dy) || 1; this.move(dx / d * this.speed * 1.3 * dt, dy / d * this.speed * 1.3 * dt); this.f = dx > 0 ? 1 : -1; this.state = 'walk'; return; } }
    // follow food
    if (g.holding(this.def.food) && dist2(p.x, p.y, this.x, this.y) < 90 * 90 && dist2(p.x, p.y, this.x, this.y) > 20 * 20) { this.seek(p.x, p.y, this.speed, dt, 18); this.state = 'walk'; this.f = p.x > this.x ? 1 : -1; return; }
    if (this.state === 'walk' && this.goal) { if (this.seek(this.goal.x, this.goal.y, this.speed * 0.5, dt, 2) || this.st < -5) { this.goal = null; this.state = 'idle'; this.st = rand(2, 6); } else this.f = this.goal.x > this.x ? 1 : -1; }
    else if (this.st <= 0) { if (Math.random() < 0.5) { this.state = 'walk';
        const herd = g.query(this.x, this.y, 80, e => e !== this && e.kind === this.kind); let hx = 0, hy = 0; for (const e of herd) { hx += e.x; hy += e.y; }
        this.goal = herd.length && Math.random() < 0.6 ? { x: hx / herd.length + rand(-20, 20), y: hy / herd.length + rand(-16, 16) } : { x: this.x + rand(-40, 40), y: this.y + rand(-30, 30) }; this.st = 0; } else { this.state = Math.random() < 0.5 ? 'graze' : 'idle'; this.st = rand(2, 6); } if (this.def.sound && Math.random() < 0.15 && dist2(p.x, p.y, this.x, this.y) < 150 * 150) Audio.play(this.def.sound, { pan: g.pan(this.x), vol: g.vol(this.x, this.y) * 0.6 }); }
  }
  onHurt(src) { if (this.def.aggro && src) this.angry = src; this.panic = 3; this.panicFrom = src; }
  die(src) { const g = this.g; for (const [id, a, b] of this.def.drops) { const n = this.baby > 0 ? 0 : randi(a, b); if (n) g.drop(id, n, this.x, this.y); } }
  draw(ctx, ox, oy) {
    const A = this.sp, fr = this.state === 'walk' ? A.walk[((this.t * 8) | 0) % 4] : A.idle[this.state === 'graze' && (this.t % 2) > 0.6 ? 1 : 0], img = this.f < 0 ? fr.f : fr.n;
    const sc = this.baby > 0 ? 0.65 : 1, w = A.w * sc, h = A.h * sc;
    const x = Math.round(this.x - ox - w / 2), y = Math.round(this.y - oy - h + 1 - this.z);
    if (sc === 1) ctx.drawImage(img, x, y); else ctx.drawImage(img, x, y, Math.round(w), Math.round(h));
    if (this.flash > 0 && sc === 1) drawFlash(ctx, img, x, y);
  }
  shadow() { const w = this.sp.w * (this.baby > 0 ? 0.6 : 1); return [this.x, this.y, Math.max(3, w * 0.3), 2]; }
  save() { return this.persist ? { k: 'animal', kind: this.kind, x: this.x, y: this.y, hp: this.hp, owned: this.owned, pen: this.pen, baby: this.baby, produceT: this.produceT, shorn: this.shorn } : null; }
}

/* ===================== drops & projectiles ===================== */
export class Drop extends Ent {
  constructor(g, x, y, id, n) { super(g, x, y); this.item = id; this.n = n; this.vz = rand(40, 70); this.z = 4; const a = rand(TAU); this.vx = Math.cos(a) * rand(10, 30); this.vy = Math.sin(a) * rand(6, 18); this.life = 300; this.solidEnt = false; this.team = 'item'; this.pickDelay = 0.4; }
  update(dt) {
    this.t += dt; this.life -= dt; this.pickDelay -= dt; if (this.life <= 0) { this.dead = true; return; }
    if (this.z > 0 || this.vz) { this.vz -= 260 * dt; this.z += this.vz * dt; this.move(this.vx * dt, this.vy * dt); if (this.z <= 0) { this.z = 0; this.vz = Math.abs(this.vz) > 30 ? -this.vz * 0.35 : 0; this.vx *= 0.5; this.vy *= 0.5; } }
    const p = this.g.player; if (this.pickDelay > 0 || p.dead) return;
    const d2 = dist2(p.x, p.y - 4, this.x, this.y);
    if (d2 < 48 * 48) { const d = Math.sqrt(d2) || 1, k = Math.min(1, 160 * dt / d); this.x += (p.x - this.x) * k; this.y += (p.y - 4 - this.y) * k; }
    if (d2 < 10 * 10) this.g.pickup(this);
  }
  draw(ctx, ox, oy) {
    const ic = this.item === 'coin' ? COIN : ICON[this.item]; if (!ic) return;
    const bob = this.z > 0 ? this.z : Math.sin(this.t * 3) * 1.5 + 2;
    if (this.life < 20 && ((this.t * 8) | 0) % 2) return;
    ctx.drawImage(ic, Math.round(this.x - ox - 6), Math.round(this.y - oy - 12 - bob), 12, 12);
  }
  shadow() { return [this.x, this.y, 3, 1]; }
}
let COIN = null;
export function setCoinIcon(c) { COIN = c; }
export class Arrow extends Ent {
  constructor(g, src, tx, ty, dmg) {
    super(g, src.x, src.y - 9); this.src = src; this.dmg = dmg; const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1; this.vx = dx / d * 230; this.vy = dy / d * 230; this.life = 0.9; this.solidEnt = false; this.team = 'proj'; this.zz = 9;
  }
  update(dt) {
    this.life -= dt; if (this.life <= 0) { this.dead = true; return; }
    const g = this.g; this.x += this.vx * dt; this.y += this.vy * dt;
    if (g.world.solid(Math.floor(this.x / TS), Math.floor((this.y + this.zz) / TS))) { this.dead = true; g.fx.burst(this.x, this.y + this.zz, 3, ['#c8a070'], { z: this.zz }); return; }
    const hit = g.nearest(this.x, this.y + this.zz, 9, e => e !== this.src && !e.dead && g.hostile(this.src, e) && e.hurt);
    if (hit) { hit.hurt(this.dmg, this.src, 70); this.dead = true; Audio.play('hit', { pan: g.pan(this.x), vol: g.vol(this.x, this.y) }); }
  }
  draw(ctx, ox, oy) {
    const a = Math.atan2(this.vy, this.vx), x = this.x - ox, y = this.y - oy;
    ctx.strokeStyle = '#e8d8b0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(x - Math.cos(a) * 7) + 0.5, Math.round(y - Math.sin(a) * 7) + 0.5); ctx.lineTo(Math.round(x) + 0.5, Math.round(y) + 0.5); ctx.stroke();
    ctx.fillStyle = '#c8ccd8'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); ctx.fillStyle = '#d84a4a'; ctx.fillRect(Math.round(x - Math.cos(a) * 7), Math.round(y - Math.sin(a) * 7), 1, 1);
  }
  shadow() { return [this.x, this.y + this.zz, 2, 1]; }
}
export { dirOf, DIRV, ANI };
