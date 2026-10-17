// Hanomi — the game state: world, time, weather, entities, nations, rules.
import { TS, CS, G, B, O, OBJ, BLOCK, CROPS, DAY_LEN, isWater, VERSION } from './defs.js';
import { World } from './world.js';
import { FX } from './fx.js';
import { Ent, Human, Villager, Soldier, Zombie, Dog, Animal, Drop, Arrow, setNextId, nextId } from './entities.js';
import { Player } from './player.js';
import { ITEMS } from './items.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { clamp, rand, randi, pick, dist2, TAU, hash2 } from './util.js';

const TOOLNAME = { axe: 'an axe', pick: 'a pickaxe', hoe: 'a hoe' };
export class Game {
  constructor(opts, data) {
    this.opts = opts; this.world = new World(opts.seed); this.fx = new FX(); this.ents = []; this.grid = new Map(); this.dmg = new Map(); this.shakeTiles = new Map();
    this.clock = DAY_LEN * (2 / 24); this.day = 1; this.weather = { rain: 0, target: 0, t: rand(200, 500) }; this.nations = new Map(); this.stats = { zombies: 0, fish: 0, built: 0, eaten: 0, born: 0, harvested: 0, mined: 0, chopped: 0 };
    this.target = null; this.hitstop = 0; this.paused = false; this.lastHour = 0; this.raid = null; this.playTime = 0; this.saveId = opts.saveId; this.spawnPoint = null; this.koiT = 0; this.interiors = {}; this.inside = null;
    this.diff = { peaceful: 0, normal: 1, hard: 1.6 }[opts.difficulty || 'normal'];
    if (data) this.load(data); else this.fresh();
  }
  /* ---------- setup ---------- */
  fresh() {
    const home = this.world.villageForRegion(0, 0);
    const sp = home.spawn;
    this.player = new Player(this, sp.x * TS + 8, sp.y * TS + 8, this.opts.look);
    for (const [id, n] of [['axe_wood', 1], ['pick_wood', 1], ['hoe_wood', 1], ['sword_wood', 1], ['wheat_seeds', 6], ['carrot', 3], ['rod', 1], ['bread', 3], ['torch', 6], ['dog_treat', 3], ['stick', 3]]) this.player.add(id, n);
    this.player.coins = 30;
    this.nationState(home);
    this.activateVillages(true);
  }
  nationState(v) {
    if (!v) return null; let n = this.nations.get(v.id);
    if (!n) { const base = { peaceful: 60, proud: 45, greedy: 40, warlike: 25, honest: 50, kind: 100 }[v.temper] ?? 45;
      n = { id: v.id, name: v.name, color: v.color, ruler: v.ruler, temper: v.temper, rel: base, status: v.home ? 'home' : 'neutral', spawned: false, quest: null, troopsDay: -9, x: v.x, y: v.y, met: v.home }; this.nations.set(v.id, n); }
    return n;
  }
  nationOf(vid) { return this.nations.get(vid); }
  villageById(vid) { const [rx, ry] = vid.split(',').map(Number); return this.world.villageForRegion(rx, ry); }
  activateVillages(force) {
    const p = this.player, vs = this.world.villagesNear(p.x / TS, p.y / TS, 60);
    for (const v of vs) {
      const n = this.nationState(v);
      if (!n.met && dist2(v.x, v.y, p.x / TS, p.y / TS) < 30 * 30) { n.met = true; this.ui && this.ui.banner(v.name, n.status === 'war' ? 'At war with you' : `${cap(v.temper)} clan of ${v.ruler}`); Audio.play('bell'); }
      if (n.spawned) continue; n.spawned = true;
      for (const s of v.spawns) {
        const x = s.x * TS + 8, y = s.y * TS + 8;
        if (s.k === 'villager' || s.k === 'merchant' || s.k === 'chief') {
          const e = this.add(new Villager(this, x, y, { vid: v.id, role: s.k, seed: hash2(s.x, s.y, 5) * 1e6 | 0 }));
          if (s.home != null && v.structs[s.home]) { e.homeDoor = v.structs[s.home].door; e.homeSi = s.home; }
          if (s.k === 'chief') e.name = v.ruler;
        } else if (s.k === 'guard') this.add(new Soldier(this, x, y, { vid: v.id, color: v.color, archer: Math.random() < 0.3, post: { x: v.x * TS, y: v.y * TS + 32 } }));
        else if (s.k === 'dog') this.add(new Dog(this, x, y, { breed: this.opts.breed, name: this.opts.dogName, owned: true, love: 50 }));
        else this.add(new Animal(this, x, y, { kind: s.k, pen: s.pen, owned: v.home }));
      }
      if (!v.home && Math.random() < 0.45) this.add(new Dog(this, v.x * TS + rand(-60, 60), v.y * TS + rand(20, 60), { breed: pick(['shiba', 'golden', 'collie', 'lab', 'husky']), name: pick(['Pochi', 'Hachi', 'Shiro', 'Kuro', 'Momo', 'Taro', 'Sakura', 'Yuki']) }));
    }
  }
  add(e) { this.ents.push(e); return e; }
  /* ---------- queries ---------- */
  rebuildGrid() {
    this.grid.clear();
    for (const e of this.ents) { if (e.dead || e.team === 'item') continue; const k = ((e.x >> 6) * 73856093) ^ ((e.y >> 6) * 19349663); let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(e); }
  }
  query(x, y, r, f) {
    const out = [], c0 = (x - r) >> 6, c1 = (x + r) >> 6, r0 = (y - r) >> 6, r1 = (y + r) >> 6, r2 = r * r;
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) { const a = this.grid.get((cx * 73856093) ^ (cy * 19349663)); if (!a) continue; for (const e of a) if (!e.dead && dist2(e.x, e.y, x, y) <= r2 && (!f || f(e))) out.push(e); }
    if (this.player && !this.player.dead && dist2(this.player.x, this.player.y, x, y) <= r2 && (!f || f(this.player)) && !out.includes(this.player)) out.push(this.player);
    return out;
  }
  nearest(x, y, r, f) { let best = null, bd = 1e18; for (const e of this.query(x, y, r, f)) { const d = dist2(e.x, e.y, x, y); if (d < bd) { bd = d; best = e; } } return best; }
  hostile(a, b) {
    if (!a || !b || a === b) return false; const ta = a.team, tb = b.team;
    if (ta === tb || tb === 'item' || tb === 'proj' || ta === 'item' || ta === 'proj') return false;
    if (ta === 'undead') return tb !== 'wild' && (tb !== 'nature' || b.livestock || b.isDog);
    if (tb === 'undead') return ta !== 'nature' && ta !== 'wild';
    if (ta === 'wild') return tb === 'player' || b.livestock || tb.startsWith('v:');
    if (tb === 'wild') return ta === 'player' || ta.startsWith('v:');
    const war = (t) => { if (!t.startsWith('v:')) return false; const n = this.nations.get(t.slice(2)); return n && n.status === 'war'; };
    if (ta === 'player' && tb.startsWith('v:')) return war(tb) && (b instanceof Soldier || b.isPlayer);
    if (tb === 'player' && ta.startsWith('v:')) return war(ta) && (a instanceof Soldier);
    return false;
  }
  holding(foods) { const s = this.player.item; return !!(s && foods && foods.includes(s.id)); }
  entAtTile(tx, ty, solidOnly) { return this.ents.some(e => !e.dead && e.solidEnt !== false && e.team !== 'item' && Math.floor(e.x / TS) === tx && Math.floor(e.y / TS) === ty) || (Math.floor(this.player.x / TS) === tx && Math.floor(this.player.y / TS) === ty); }
  pan(x) { return clamp((x - this.player.x) / 200, -1, 1); }
  vol(x, y) { return clamp(1 - Math.hypot(x - this.player.x, y - this.player.y) / 260, 0, 1); }
  aimWorld() { if (!Input.onScreen || !this.cam) return null; return { x: this.cam.x + Input.mx / this.cam.scale * this.cam.dpr, y: this.cam.y + Input.my / this.cam.scale * this.cam.dpr }; }
  /* ---------- pathfinding (bounded A*) ---------- */
  findPath(sx, sy, tx, ty) {
    const w = this.world, M = 14, x0 = Math.min(sx, tx) - M, y0 = Math.min(sy, ty) - M, W = Math.abs(tx - sx) + M * 2 + 1, H = Math.abs(ty - sy) + M * 2 + 1;
    if (W * H > 5000) return null;
    const N = W * H, gS = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N), open = [];
    const idx = (x, y) => (y - y0) * W + (x - x0), si = idx(sx, sy), ti = idx(tx, ty);
    const solid = (x, y) => x !== tx || y !== ty ? w.solid(x, y) : false;
    const push = (f, i) => { open.push([f, i]); let k = open.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (open[p][0] <= open[k][0]) break; [open[p], open[k]] = [open[k], open[p]]; k = p; } };
    const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === k) break; [open[m], open[k]] = [open[k], open[m]]; k = m; } } return top; };
    gS[si] = 0; push(Math.abs(tx - sx) + Math.abs(ty - sy), si);
    let it = 0, best = si, bestH = 1e9;
    while (open.length && it++ < 1400) {
      const [, ci] = pop(); if (closed[ci]) continue; closed[ci] = 1;
      const cx = ci % W + x0, cy = ((ci / W) | 0) + y0, h = Math.abs(tx - cx) + Math.abs(ty - cy);
      if (h < bestH) { bestH = h; best = ci; }
      if (ci === ti) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy; if (nx < x0 || ny < y0 || nx >= x0 + W || ny >= y0 + H) continue;
        const ni = idx(nx, ny); if (closed[ni] || solid(nx, ny)) continue;
        const ng = gS[ci] + (isWater(w.ground(nx, ny)) ? 3 : 1); if (ng < gS[ni]) { gS[ni] = ng; from[ni] = ci; push(ng + Math.abs(tx - nx) + Math.abs(ty - ny), ni); }
      }
    }
    const path = []; let c = best; while (c !== si && c >= 0) { path.push([c % W + x0, ((c / W) | 0) + y0]); c = from[c]; }
    path.reverse(); return path.length ? path : null;
  }
  /* ---------- world interaction ---------- */
  drop(id, n, x, y) { const d = new Drop(this, x + rand(-3, 3), y + rand(-3, 3), id, n); this.add(d); return d; }
  pickup(d) {
    const p = this.player;
    if (d.item === 'coin') { p.coins += d.n; d.dead = true; Audio.play('coin', { vol: 0.6 }); this.ui.dirty(); this.ui.toast(`+${d.n} coins`, 'coin', 'coin'); return; }
    const left = p.add(d.item, d.n); if (left === d.n) return;
    const got = d.n - left; d.n = left; if (!left) d.dead = true;
    Audio.play('pickup', { vol: 0.5 }); this.ui.toast(`+${got} ${ITEMS[d.item].n}`, 'item', d.item);
  }
  shoot(src, tx, ty, dmg) { this.add(new Arrow(this, src, tx, ty, dmg)); Audio.play('arrow', { pan: this.pan(src.x), vol: this.vol(src.x, src.y) }); }
  useTool(tx, ty, it, src) {
    const w = this.world, gr = w.ground(tx, ty), b = w.block(tx, ty), o = w.obj(tx, ty), m = w.meta(tx, ty);
    const tool = it ? it.tool : null;
    if (o && OBJ[o].crop) { if ((m & 3) === 3) { this.harvest(tx, ty); return false; } if (tool === 'hoe' || !tool) return false; }
    if (o === O.DIG) { if (tool !== 'hoe') { this.toastOnce('Something glints in the soil… dig it with a hoe.'); return false; } this.dig(tx, ty); return true; }
    if (tool === 'hoe' && !b && (!o || OBJ[o].tool === 'any' && !OBJ[o].crop) && [G.GRASS, G.DIRT, G.FOREST, G.SAKURA, G.SNOW, G.PATH, G.MARSH].includes(gr)) {
      if (o) this.breakObj(tx, ty, o, m);
      w.set(tx, ty, { g: G.TILLED, o: 0 }); Audio.play('till'); this.fx.burst(tx * TS + 8, ty * TS + 10, 6, ['#6a472f', '#88603f', '#5a3b27'], {}); return true;
    }
    if (b) {
      const def = BLOCK[b]; if (def.tool === 'none') return false;
      if (def.tool !== tool) { if (b !== B.BLDG) this.toastOnce(`You need ${TOOLNAME[def.tool]} for that.`); this.damageTile(tx, ty, 0, src); return false; }
      if ((it.tier || 0) < def.tier) { this.toastOnce(`Needs a stronger ${def.tool === 'pick' ? 'pickaxe' : 'axe'}.`); this.damageTile(tx, ty, 0, src); return false; }
      this.damageTile(tx, ty, it.pow || 1, src); return true;
    }
    if (o) {
      const def = OBJ[o]; if (def.tool === 'none') return false;
      if (def.harvest && m === 0) { this.interactTile(tx, ty); return false; }
      let pow = 1;
      if (def.tool === 'any') pow = 99; else if (def.tool === tool) pow = it.pow || 1; else if (def.tool === 'axe' && !tool) pow = 0.5; else if (def.tool === 'axe' && tool === 'sword') pow = 0.6; else { this.toastOnce(`You need ${TOOLNAME[def.tool]} for that.`); this.damageTile(tx, ty, 0, src); return false; }
      this.damageTile(tx, ty, pow, src); return def.tool !== 'any';
    }
    return false;
  }
  toastOnce(t) { const now = performance.now(); if (this._lt === t && now - this._ltt < 2500) return; this._lt = t; this._ltt = now; this.ui.toast(t, 'hint'); Audio.play('error', { vol: 0.4 }); }
  damageTile(tx, ty, pow, src, zombie) {
    const w = this.world, k = tx + ',' + ty, b = w.block(tx, ty), o = w.obj(tx, ty);
    let hp, mat;
    if (b) { const def = BLOCK[b]; if (zombie && !def.built) return; hp = def.hp; mat = def.tool === 'axe' ? 'wood' : 'stone'; }
    else if (o) { const def = OBJ[o]; if (zombie && !(o === O.FENCE || o === O.GATE || o === O.CHEST || o === O.SCARECROW || o === O.TORCH || o === O.CAMPFIRE || o === O.SPIKES)) return; hp = def.hp; mat = def.tool === 'axe' || def.tree ? 'wood' : def.tool === 'pick' ? 'stone' : 'plant'; if (zombie) hp = Math.max(hp, 4); }
    else return;
    if (hp >= 1e8) return;
    this.shakeTiles.set(k, 0.18);
    const cx = tx * TS + 8, cy = ty * TS + (b ? 2 : 10);
    if (mat === 'wood') { Audio.play('chop', { pan: this.pan(cx), vol: this.vol(cx, cy) }); this.fx.burst(cx, cy, 4, ['#c8945a', '#8a5a34', '#e8c08a'], { z: 10 }); if (o && OBJ[o].tree) this.fx.burst(cx, cy - 10, 3, o === O.SAKURA ? ['#f6b8ca', '#ffd8e4'] : ['#4f8c4c', '#72ae4a'], { z: 30, g: 40, l0: 0.8, l1: 1.6, k: o === O.SAKURA ? 'petal' : 'dot' }); }
    else if (mat === 'stone') { Audio.play('mine', { pan: this.pan(cx), vol: this.vol(cx, cy) }); this.fx.burst(cx, cy, 5, ['#9e9891', '#6e6a66', '#fff8e0'], { z: 8 }); }
    if (!pow) return;
    const d = this.dmg.get(k) || { v: 0, t: 0 }; d.v += pow; d.t = 4; this.dmg.set(k, d);
    if (d.v >= hp) { this.dmg.delete(k); if (b) this.breakBlock(tx, ty, b); else this.breakObj(tx, ty, o, w.meta(tx, ty)); }
  }
  breakBlock(tx, ty, b) {
    const def = BLOCK[b]; this.world.set(tx, ty, { b: 0 });
    for (const [id, a, c] of def.drop) { const n = randi(a, c); if (n) this.drop(id, n, tx * TS + 8, ty * TS + 8); }
    Audio.play('break', { pan: this.pan(tx * TS) }); this.fx.burst(tx * TS + 8, ty * TS + 6, 14, ['#9e9891', '#6e6a66', '#4a4644'], { z: 8, sp1: 70 }); this.stats.mined++;
    if (b === B.GEM) this.ui.toast('Jade! A rare find.', 'good', 'jade');
  }
  breakObj(tx, ty, o, m) {
    const def = OBJ[o], w = this.world, cx = tx * TS + 8, cy = ty * TS + 10;
    if (def.crop) { w.set(tx, ty, { o: 0, m: 0 }); const c = CROPS[o]; if ((m & 3) === 3) this.harvest(tx, ty); else this.drop(c.seed, 1, cx, cy); return; }
    if (o === O.CHEST) { const k = tx + ',' + ty, inv = w.chests.get(k); if (inv) { for (const s of inv) if (s) this.drop(s.id, s.n, cx, cy); w.chests.delete(k); } }
    if (o === O.SAPLING) { const tree = m || O.OAK; this.drop(tree === O.SAKURA ? 'sakura_sapling' : tree === O.PINE ? 'pinecone' : 'acorn', 1, cx, cy); w.set(tx, ty, { o: 0, m: 0 }); return; }
    w.set(tx, ty, { o: def.tree && def.stump ? O.STUMP : 0, m: 0 });
    for (const [id, a, c] of def.drop || []) { const n = randi(a, c); if (n) this.drop(id, n, cx, cy); }
    if (def.tree) { Audio.play('break'); this.fx.burst(cx, cy - 20, 22, o === O.SAKURA ? ['#f6b8ca', '#ffd8e4', '#ea98b0'] : o === O.PINE ? ['#275640', '#437c56'] : ['#4f8c4c', '#72ae4a', '#3e7543'], { z: 30, g: 30, l0: 1, l1: 2, sp1: 60, k: o === O.SAKURA ? 'petal' : 'leaf' }); this.fx.shake(2, 0.12); this.stats.chopped++; }
    else if (def.tool === 'any') { Audio.play('harvest', { vol: 0.5 }); this.fx.burst(cx, cy, 6, ['#58a448', '#78bc58', '#2f6a32'], {}); }
    else Audio.play('break');
  }
  harvest(tx, ty) {
    const w = this.world, o = w.obj(tx, ty), c = CROPS[o]; if (!c) return;
    const cx = tx * TS + 8, cy = ty * TS + 10;
    this.drop(c.crop, randi(c.n[0], c.n[1]), cx, cy); const s = randi(c.seeds[0], c.seeds[1]); if (s) this.drop(c.seed, s, cx, cy);
    w.set(tx, ty, { o: o === O.TOMATO ? O.TOMATO : 0, m: o === O.TOMATO ? 1 : 0 });
    Audio.play('harvest'); this.fx.burst(cx, cy - 4, 8, ['#f2d06a', '#8ac85a', '#ffffff'], { z: 6 }); this.stats.harvested++;
  }
  interactEnt(e) {
    const p = this.player, s = p.item;
    if (e instanceof Dog) {
      if (s && s.id === 'dog_treat') { p.useUp(); e.hp = e.maxHp; e.down = 0; if (!e.owned) { const owned = this.ents.filter(d => d.isDog && d.owned && !d.dead).length; if (owned >= 3) { this.ui.toast('Your pack is full (3 dogs).'); } else { e.owned = true; e.team = 'player'; e.persist = true; this.ui.toast(`${e.name} joined your pack!`, 'good'); Audio.play('levelup'); } } e.pet(); return true; }
      if (!e.owned) { e.pet(); this.ui.toast(`${e.name} wags its tail. (Offer a dog treat to adopt)`, 'hint'); return true; }
      e.pet(); return true;
    }
    if (e instanceof Animal) {
      if (s && e.def.food.includes(s.id)) { if (e.baby > 0) { e.baby = Math.max(0, e.baby - 60); } else e.love = 20; p.useUp(); Audio.play(e.def.sound || 'pet'); if (!e.owned) { e.owned = true; e.persist = true; e.livestock = true; } return true; }
      if (s && s.id === 'shears' || s && s.id === 'bucket') { p.animalTool(ITEMS[s.id].tool); return true; }
      this.ui.toast(`${cap(e.kind)}${e.owned ? ' (yours)' : ''} — feed it ${ITEMS[e.def.food[0]].n.toLowerCase()} to tame & breed.`, 'hint'); return true;
    }
    if (e instanceof Soldier) { if (e.mine) { this.ui.open('soldier', e); return true; } e.say(this.hostile(e, p) ? 'For our clan!' : pick(['Move along.', 'Halt. State your business.', 'Stay out of trouble.', 'The roads are dangerous at night.'])); return true; }
    if (e instanceof Villager) {
      const n = this.nationOf(e.vid);
      if (n && n.status === 'war') { e.say(pick(['Leave us be!', 'Murderer!', 'Guards!'])); return true; }
      if (e.role === 'merchant') { this.ui.open('trade', e); return true; }
      if (e.role === 'chief') { this.ui.open('chief', e); return true; }
      this.ui.open('talk', e); return true;
    }
    return false;
  }
  structAt(tx, ty) { for (const v of this.world.villagesNear(tx, ty, 4)) for (const s of v.structs) if (tx >= s.x && ty >= s.y && tx < s.x + s.w && ty < s.y + s.h) return [v, s]; return null; }
  interactTile(tx, ty) {
    const w = this.world, o = w.obj(tx, ty), m = w.meta(tx, ty), b = w.block(tx, ty), p = this.player;
    if (!o) { const r = this.structAt(tx, ty); if (r && r[1].kind === 'koi') return this.feedKoi(r[1]); }
    if (b === B.BLDG) { const r = this.structAt(tx, ty); if (!r) return false; const [v, s] = r;
      if (s.kind === 'koi') { this.feedKoi(s); return true; }
      if (s.door && tx === s.door.x && ty === s.door.y) { this.enterHouse(v, s); return true; }
      if (s.home) { this.ui.toast('Your home. Walk in through the door.', 'hint'); return true; }
      if (s.kind === 'hall') { this.ui.toast(`${v.ruler}'s hall. The chief is usually out front.`, 'hint'); return true; }
      this.ui.toast(pick(['Nobody answers the door.', 'You hear a kettle whistling inside.', 'A cat watches you from the window.', 'Shoes are neatly lined by the door.']), 'hint'); return true; }
    if (!o) return false;
    const def = OBJ[o];
    if (def.crop && (m & 3) === 3) { this.harvest(tx, ty); return true; }
    if (o === O.BERRY && m === 0) { w.set(tx, ty, { m: 1 }); this.drop('berries', randi(2, 4), tx * TS + 8, ty * TS + 8); Audio.play('harvest'); return true; }
    if (o === O.GATE) { w.set(tx, ty, { m: m ^ 1 }); Audio.play('door'); return true; }
    if (o === O.CHEST) { this.ui.open('chest', tx + ',' + ty); return true; }
    if (o === O.BED) { this.trySleep({ x: tx * TS + 8, y: (ty + 1) * TS + 6 }); return true; }
    if (def.station) { this.ui.open('craft', def.station); return true; }
    if (o === O.WELL) { const can = p.inv.find(s => s && s.id === 'can'); if (can) { can.d = ITEMS.can.dur; this.ui.toast('Watering can refilled.'); this.ui.dirty(); } else this.ui.toast('Cool, clear well water.', 'hint'); Audio.play('splash'); return true; }
    if (o === O.BANNER) { const r = this.world.villagesNear(tx, ty, 4).find(v => v.banner && v.banner.x === tx && v.banner.y === ty); if (r) this.ui.open('banner', r); return true; }
    if (o === O.STALL) { const v = this.world.villagesNear(tx, ty, 4)[0]; const mer = v && this.ents.find(e => e.role === 'merchant' && e.vid === v.id && !e.dead); if (mer) this.interactEnt(mer); else this.ui.toast('The stall is empty.', 'hint'); return true; }
    if (o === O.GRAVE) { const k = tx + ',' + ty, inv = w.chests.get(k); if (inv) { for (const s of inv) if (s) { const left = p.add(s.id, s.n); if (left) this.drop(s.id, left, p.x, p.y); } w.chests.delete(k); } w.set(tx, ty, { o: 0 }); this.ui.toast('You recovered your satchel.', 'good'); Audio.play('pickup'); return true; }
    if (o === O.SHRINE) { this.pray(tx, ty); return true; }
    if (o === O.DIG) { this.ui.toast('Something glints in the soil… dig it with a hoe.', 'hint'); return true; }
    if (o === O.SIGN) { this.ui.toast('"Hanomi — where the sakura never stop falling."', 'hint'); return true; }
    if (o === O.TORII) { this.ui.toast('A torii gate. You feel watched over.', 'hint'); return true; }
    return false;
  }
  dig(tx, ty) {
    const w = this.world, cx = tx * TS + 8, cy = ty * TS + 10, r = Math.random();
    w.set(tx, ty, { o: 0 }); Audio.play('till'); this.fx.burst(cx, cy, 10, ['#9a7048', '#7a5434', '#fff6c0'], {});
    this.drop('coin', randi(8, 25 + this.day * 2), cx, cy);
    const loot = r < 0.08 ? ['jade', 1] : r < 0.25 ? ['gold', randi(1, 2)] : r < 0.5 ? ['iron', randi(1, 3)] : r < 0.7 ? [pick(['pumpkin_seeds', 'tomato_seeds', 'sakura_sapling']), randi(2, 4)] : r < 0.85 ? ['arrow', randi(6, 12)] : ['lotus', 1];
    this.drop(loot[0], loot[1], cx, cy); this.ui.toast('Buried treasure!', 'good', loot[0]); Audio.play('levelup'); this.stats.dug = (this.stats.dug || 0) + 1;
  }
  pray(tx, ty) {
    const p = this.player, k = tx + ',' + ty; this.prayed = this.prayed || {};
    if (this.prayed[k] === this.day) { this.ui.toast('The shrine is quiet. Return tomorrow.', 'hint'); return; }
    this.prayed[k] = this.day; p.hp = p.maxHp; p.food = Math.min(20, p.food + 6); p.buff = Math.max(p.buff, 180); this.ui.dirty();
    for (let i = 0; i < 18; i++) this.fx.spawn({ x: tx * TS + 8 + rand(-10, 10), y: ty * TS + 10, z: rand(6, 24), vz: rand(10, 24), life: rand(1, 2), c: pick(['#fff6c0', '#f6b8ca', '#ffffff']), k: 'spark', g: 0, top: true });
    Audio.play('bell'); this.ui.toast('A gentle warmth fills you. (Healed · Blessed)', 'good', 'lotus'); this.stats.prayed = (this.stats.prayed || 0) + 1;
  }
  throwStick(tx, ty) {
    const p = this.player, dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, 90 / d);
    const st = this.drop('stick', 1, p.x, p.y - 8); st.vx = dx * k * 1.6; st.vy = dy * k * 1.6; st.vz = 90; st.z = 10; st.pickDelay = 3; st.fetch = true;
    p.remove('stick', 1); p.swing(0.3); Audio.play('swing');
    const dog = this.nearest(p.x, p.y, 200, e => e.isDog && e.owned && !e.dead && !(e.down > 0)); if (dog) { dog.fetch = st; dog.carry = false; Audio.play('bark', { vol: 0.5 }); }
  }
  feedKoi(s) {
    const P = this.renderer && this.renderer.pond, p = this.player; if (!P) return;
    const lx = p.x - s.x * TS, ly = p.y - 8 - s.y * TS, pt = P.nearestWater(lx, ly, s.w * 8, s.h * 8);
    if (!pt || !P.feed(pt.x, pt.y)) return;
    p.swing(0.25); Audio.play('splash', { vol: 0.25 }); p.dir = Math.abs(pt.x - lx) > Math.abs(pt.y - ly) ? (pt.x > lx ? 1 : 3) : (pt.y > ly ? 0 : 2);
    const today = this.koiDay === this.day; this.koiFeeds = today ? (this.koiFeeds || 0) + 1 : 1; this.koiDay = this.day;
    if (this.koiFeeds === 4) { p.buff = 300; this.ui.dirty(); this.ui.toast('Serenity — the koi calm your heart. (+regen, +damage)', 'good', 'lotus'); Audio.play('levelup'); for (let k = 0; k < 14; k++) this.fx.spawn({ x: p.x + rand(-12, 12), y: p.y, z: rand(4, 20), vz: 16, life: 1.4, c: pick(['#f6b8ca', '#ffd8e4', '#ffffff']), k: 'petal', g: 0 }); }
    return true;
  }
  /* ---------- house interiors ---------- */
  doorAt(tx, ty) { const r = this.structAt(tx, ty); if (r && r[1].door && r[1].door.x === tx && r[1].door.y === ty && r[1].kind !== 'koi') return r; return null; }
  interiorOf(vid, si) { return this.interiors[vid + ':' + si] || null; }
  enterHouse(v, s) {
    const si = v.structs.indexOf(s), key = v.id + ':' + si;
    let rec = this.interiors[key];
    if (!rec) { const n = Object.keys(this.interiors).length; rec = this.interiors[key] = { key, vid: v.id, si, x: 20000 + n * 24, y: 20000, w: Math.max(9, Math.min(15, s.w * 2 + (s.kind === 'hall' ? 3 : 1))), h: Math.max(8, Math.min(11, s.h * 2 + 2)), kind: s.home ? 'home' : s.kind }; this.buildInterior(rec, v); }
    rec.ret = { x: s.door.x * TS + 8, y: (s.door.y + 1) * TS + 10 };
    this.ui.fade(() => {
      const p = this.player; this.inside = rec; p.x = (rec.x + (rec.w >> 1)) * TS + 8; p.y = (rec.y + rec.h - 2) * TS + 8; p.dir = 2; p.path = null;
      for (const d of this.ents) if (d.isDog && d.owned && !d.dead && dist2(d.x, d.y, rec.ret.x, rec.ret.y) < (10 * TS) ** 2) { d.x = p.x - 14; d.y = p.y; d.indoor = rec.key; }
      Audio.play('door');
    });
  }
  exitHouse() {
    const rec = this.inside; if (!rec) return;
    this.ui.fade(() => { const p = this.player; p.x = rec.ret.x; p.y = rec.ret.y; p.dir = 0; this.inside = null;
      for (const d of this.ents) if (d.isDog && d.owned && !d.dead && d.indoor === rec.key) { d.x = p.x + 12; d.y = p.y + 4; d.indoor = null; }
      Audio.play('door'); });
  }
  buildInterior(rec, v) {
    const w = this.world, { x, y, w: W, h: H } = rec, r = (k) => hash2(x + k, y, 77 + k), home = rec.kind === 'home', hall = rec.kind === 'hall';
    const dx = x + (W >> 1);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const X = x + i, Y = y + j, edge = i <= 0 || i >= W - 1 || j <= 1 || j >= H - 1;
      let b = edge ? B.IWALL : 0, g = j >= H - 2 ? G.WOOD : G.TATAMI, o = 0;
      if (X === dx && j === H - 1) { b = 0; g = G.WOOD; o = O.EXIT; }
      w.set(X, Y, { g, b, o, m: 0 });
    }
    const put = (i, j, o, m = 0) => w.set(x + i, y + j, { o, m });
    // back wall decor (second wall row)
    put(2, 1, O.WINDOW); put(W - 3, 1, O.WINDOW); put(W >> 1, 1, O.SCROLL); if (W > 11) { put(4, 1, O.WINDOW); put(W - 5, 1, O.WINDOW); }
    // furniture
    const cx = W >> 1, cy = 2 + ((H - 4) >> 1);
    if (home || r(1) < 0.6) { put(cx, cy, O.HEARTH); put(cx - 1, cy + 1, O.CUSHION, 0); put(cx + 1, cy + 1, O.CUSHION, 1); }
    else { put(cx, cy, O.TABLE); put(cx - 1, cy, O.CUSHION, 2); put(cx + 1, cy, O.CUSHION, 3); }
    put(1, 2, O.BED); put(W - 2, 2, O.SHELF); put(W - 2, H - 3, O.BONSAI); put(1, H - 3, O.ANDON); put(W - 3, 2, O.ANDON);
    if (home) { put(2, 2, O.CHEST); put(1, H - 4, O.STOVE); put(3, H - 3, O.BENCH); }
    else if (r(2) < 0.5) put(2, H - 3, O.STOVE);
    if (hall) { put(cx, 2, O.SCREEN); put(cx - 2, 3, O.ANDON); put(cx + 2, 3, O.ANDON); }
  }
  trySleep(at) {
    const h = this.hour;
    if (!(h >= 19 || h < 5)) { this.ui.toast('You can only sleep at night.', 'hint'); return; }
    if (this.nearest(this.player.x, this.player.y, 200, e => e.team === 'undead' || e.team === 'wild')) { this.ui.toast("You can't sleep with monsters nearby!", 'bad'); return; }
    if (at) this.spawnPoint = at;
    this.ui.sleep(() => {
      const target = (h >= 19 ? (24 - h + 6) : (6 - h)) / 24 * DAY_LEN;
      for (let k = 0; k < 12; k++) this.randomTicks(target / 12, true);
      this.clock += target; this.player.hp = this.player.maxHp; this.player.food = Math.max(0, this.player.food - 3);
      for (const e of this.ents) if (e.team === 'undead') e.dead = true;
      this.save(); this.ui.dirty();
    });
  }
  /* ---------- day / time ---------- */
  get frac() { return (this.clock % DAY_LEN) / DAY_LEN; }
  get hour() { return (this.frac * 24 + 6) % 24; }
  get daylight() { const h = this.hour; if (h >= 7 && h < 17.5) return 1; if (h >= 20 || h < 4.5) return 0; if (h < 7) return (h - 4.5) / 2.5; return 1 - (h - 17.5) / 2.5; }
  get bloodMoon() { return this.day % 5 === 0 && (this.hour >= 20 || this.hour < 5) && this.diff > 0; }
  tickTime(dt) {
    this.clock += dt; const d = Math.floor((this.clock + DAY_LEN * (6 / 24)) / DAY_LEN) + 1; // day rolls at midnight-ish
    const h = this.hour;
    if (Math.floor(h) !== Math.floor(this.lastHour)) this.onHour(Math.floor(h));
    this.lastHour = h; this.day = Math.floor(this.clock / DAY_LEN) + 1; void d;
  }
  onHour(h) {
    if (h === 6) { Audio.play('bell'); this.dawn(); }
    if (h === 21 && this.bloodMoon) this.startRaid();
    if (h === 12) this.middayEvents();
  }
  dawn() {
    let tribute = 0; for (const n of this.nations.values()) if (n.status === 'vassal') tribute += 15;
    if (tribute) { this.player.coins += tribute; this.ui.toast(`Tribute collected: +${tribute} coins`, 'coin', 'coin'); this.ui.dirty(); }
    if (this.raid) { const home = this.home(); const alive = this.ents.filter(e => e.vid === home.id && e instanceof Villager && !e.dead).length; this.ui.banner('The Blood Moon has set', alive ? `Hanomi stands! ${alive} villagers safe.` : 'Hanomi suffered greatly...'); if (alive) { this.player.coins += 40; this.ui.dirty(); } this.raid = null; }
    this.ui.toast(`Day ${this.day}`, 'day');
  }
  middayEvents() {
    for (const n of this.nations.values()) {
      if (n.status === 'neutral' && n.met && n.temper === 'warlike' && n.rel < 20 && Math.random() < 0.35) { n.status = 'war'; this.ui.banner(`${n.name} declares war!`, `${n.ruler}'s soldiers march on Hanomi.`); Audio.play('horn'); }
      if (n.status === 'war' && Math.random() < 0.5 && this.diff > 0) this.warParty(n);
    }
  }
  warParty(n) {
    const home = this.home(), a = rand(TAU), r = 30 * TS, cnt = 2 + Math.min(5, Math.floor(this.day / 3));
    for (let k = 0; k < cnt; k++) { const x = home.x * TS + Math.cos(a) * r + rand(-30, 30), y = home.y * TS + Math.sin(a) * r + rand(-30, 30); if (this.world.solid(Math.floor(x / TS), Math.floor(y / TS))) continue;
      const s = this.add(new Soldier(this, x, y, { vid: n.id, color: n.color, archer: Math.random() < 0.35, order: 'raid' })); s.raidTo = { x: home.x * TS, y: home.y * TS }; s.persist = false; }
    this.ui.toast(`${n.name} raiders approach Hanomi!`, 'bad');
  }
  home() { return this.world.villageForRegion(0, 0); }
  startRaid() {
    const home = this.home(); this.raid = { t: 0 }; Audio.play('horn'); this.ui.banner('Blood Moon', 'The dead march on Hanomi. Defend the village!');
    const n = Math.round((7 + this.day * 1.2) * this.diff);
    for (let k = 0; k < n; k++) { const a = rand(TAU), r = rand(26, 32) * TS, x = home.x * TS + Math.cos(a) * r, y = home.y * TS + Math.sin(a) * r;
      if (this.world.solid(Math.floor(x / TS), Math.floor(y / TS)) || isWater(this.world.ground(Math.floor(x / TS), Math.floor(y / TS)))) continue;
      const z = this.add(new Zombie(this, x, y, this.day > 8 && Math.random() < 0.25 ? 2 : this.day > 3 && Math.random() < 0.3 ? 1 : 0)); z.raid = true; z.raidTo = { x: home.x * TS, y: home.y * TS }; }
    for (const nn of this.nations.values()) if (nn.status === 'ally') { for (let k = 0; k < 2; k++) { const s = this.add(new Soldier(this, home.x * TS + rand(-40, 40), home.y * TS + rand(10, 40), { vid: nn.id, color: nn.color, order: 'patrol', post: { x: home.x * TS, y: home.y * TS } })); s.persist = false; s.allyHelp = true; } this.ui.toast(`${nn.name} sends soldiers to help!`, 'good'); }
  }
  /* ---------- weather & ambience ---------- */
  tickWeather(dt) {
    const W = this.weather; W.t -= dt; if (W.t <= 0) { W.target = W.target > 0 ? 0 : (Math.random() < 0.45 ? rand(0.5, 1) : 0); W.t = W.target ? rand(90, 220) : rand(240, 600); }
    W.rain += (W.target - W.rain) * Math.min(1, dt * 0.25);
    // thunderstorms: heavy rain brings lightning
    if (this.flash > 0) this.flash -= dt * 2.5;
    if (W.rain > 0.82 && !this.inside && (W.bolt = (W.bolt ?? 6) - dt) <= 0) { W.bolt = rand(7, 22); this.flash = 1; setTimeout(() => Audio.play('drum', { pitch: 0.45, vol: 0.8 }), rand(200, 1400)); }
  }
  get raining() { return this.weather.rain > 0.3; }
  waterBiome(tx, ty) { const b = this.world.biomeAt(tx, ty), s = this.world.sample(tx, ty); if (s.river) return 'river'; if (b === 'deep' || s.e < 0.36) return 'sea'; if (b === 'marsh' || this.world.ground(tx, ty) === G.WATER && this.world.biomeAt(tx + 3, ty) === 'marsh') return 'marsh'; return 'lake'; }
  /* ---------- random ticks: crops, saplings, soil ---------- */
  randomTicks(dt, fast) {
    const p = this.player, pcx = Math.floor(p.x / TS / CS), pcy = Math.floor(p.y / TS / CS), w = this.world;
    const per = 2 * dt * (fast ? 1 : 1);
    for (let cy = pcy - 3; cy <= pcy + 3; cy++) for (let cx = pcx - 3; cx <= pcx + 3; cx++) {
      const c = w.peek(cx, cy); if (!c) continue;
      let n = per; while (n > 0) { if (n < 1 && Math.random() > n) break; n -= 1;
        const i = (Math.random() * CS * CS) | 0, o = c.o[i], g = c.g[i], x = cx * CS + (i % CS), y = cy * CS + ((i / CS) | 0);
        if (CROPS[o]) { const st = c.m[i] & 3; if (st < 3) { const wet = g === G.WET || (o === O.RICE && isWater(g)); const pr = (256 / 2) / (DAY_LEN * CROPS[o].days / 3) * (wet ? 1 : 0.25); if (Math.random() < pr) w.set(x, y, { m: st + 1 }); } }
        else if (o === O.SAPLING) { if (Math.random() < 0.12) w.set(x, y, { o: c.m[i] || O.OAK, m: (Math.random() * 4) | 0 }); }
        else if (o === O.BERRY && c.m[i] === 1) { if (Math.random() < 0.2) w.set(x, y, { m: 0 }); }
        if (g === G.TILLED && this.raining) w.set(x, y, { g: G.WET });
        else if (g === G.WET && !this.raining && Math.random() < 0.18) w.set(x, y, { g: G.TILLED });
      }
    }
  }
  /* ---------- spawning ---------- */
  spawnAnimal(kind, x, y, o = {}) { return this.add(new Animal(this, x, y, Object.assign({ kind }, o))); }
  tickSpawns() {
    const p = this.player, w = this.world, near = this.query(p.x, p.y, 40 * TS);
    // despawn far transients
    for (const e of this.ents) if (!e.persist && !(e instanceof Drop) && !(e instanceof Arrow) && dist2(e.x, e.y, p.x, p.y) > (52 * TS) ** 2) e.dead = true;
    const randTile = (r0, r1) => { const a = rand(TAU), r = rand(r0, r1) * TS; return [Math.floor((p.x + Math.cos(a) * r) / TS), Math.floor((p.y + Math.sin(a) * r) / TS)]; };
    const free = (tx, ty) => !w.solid(tx, ty) && !isWater(w.ground(tx, ty)) && !w.obj(tx, ty);
    const inVillage = (tx, ty) => this.world.villagesNear(tx, ty, 2).some(v => dist2(v.x, v.y, tx, ty) < 24 * 24);
    // wildlife
    const wild = near.filter(e => e instanceof Animal && !e.persist).length;
    if (wild < 9) { const [tx, ty] = randTile(15, 26); if (free(tx, ty) && !inVillage(tx, ty)) {
      const b = w.biomeAt(tx, ty), opts = { meadow: ['rabbit', 'rabbit', 'sheep', 'cow', 'pig', 'deer'], forest: ['deer', 'boar', 'rabbit', 'boar'], sakura: ['rabbit', 'deer', 'sheep'], snow: ['rabbit', 'deer'], marsh: ['boar', 'pig'], rock: ['rabbit'] }[b];
      if (opts) { const k = pick(opts), n = k === 'rabbit' ? 1 : randi(1, 3); for (let i = 0; i < n; i++) this.spawnAnimal(k, tx * TS + 8 + rand(-16, 16), ty * TS + 8 + rand(-16, 16)); } } }
    if (this.diff <= 0) return;
    // wolves in forest/snow at dusk & night
    const night = this.daylight < 0.3;
    const wolves = near.filter(e => e.isDog && e.wild).length;
    if (wolves < 3 && Math.random() < (night ? 0.08 : 0.015)) { const [tx, ty] = randTile(18, 26); const b = w.biomeAt(tx, ty); if ((b === 'forest' || b === 'snow') && free(tx, ty) && !inVillage(tx, ty)) for (let k = 0; k < randi(2, 3); k++) this.add(new Dog(this, tx * TS + rand(-12, 12), ty * TS + rand(-12, 12), { breed: b === 'snow' ? 'wolf' : (Math.random() < 0.3 ? 'shadow' : 'wolf'), wild: true })); }
    // zombies at night
    if (night) {
      const zs = near.filter(e => e.team === 'undead' && !e.raid).length, cap = Math.round((5 + Math.min(12, this.day * 0.7)) * this.diff);
      if (zs < cap) for (let tries = 0; tries < 3; tries++) { const [tx, ty] = randTile(17, 25); if (!free(tx, ty) || inVillage(tx, ty) || this.lit(tx, ty)) continue;
        const k = this.day > 6 && Math.random() < 0.12 ? 2 : this.day > 2 && Math.random() < 0.25 ? 1 : 0; this.add(new Zombie(this, tx * TS + 8, ty * TS + 8, k)); break; }
    }
  }
  lit(tx, ty) { const w = this.world; for (let y = ty - 5; y <= ty + 5; y++) for (let x = tx - 5; x <= tx + 5; x++) { const o = w.obj(x, y); if (o && OBJ[o].light) return true; } return false; }
  /* ---------- deaths ---------- */
  onDeath(e, src) {
    if (e === this.player) return this.playerDied();
    if (e.team === 'undead') { this.stats.zombies++; const v = this.world.villagesNear(e.x / TS, e.y / TS, 4).find(v => dist2(v.x, v.y, e.x / TS, e.y / TS) < 30 * 30); if (v && src && (src.isPlayer || src.team === 'player')) { const n = this.nationState(v); if (n.status === 'neutral' || n.status === 'ally') n.rel = Math.min(100, n.rel + 1); } }
    if (e.team && e.team.startsWith('v:') && src && (src.isPlayer || src.team === 'player')) {
      const n = this.nationOf(e.vid); if (n && n.status !== 'war') { n.rel = Math.max(0, n.rel - 40); if (n.status !== 'vassal') { n.status = 'war'; this.ui.banner(`${n.name} declares war!`, 'You attacked their people.'); Audio.play('horn'); } }
    }
    if (e instanceof Soldier && e.mine) this.ui.toast(`${e.name} has fallen.`, 'bad');
    if (e instanceof Villager && e.vid === this.home().id) this.ui.toast(`${e.name} of Hanomi was lost...`, 'bad');
  }
  playerDied() {
    const p = this.player; Audio.play('death'); this.ui.toast('You fell...', 'bad');
    // leave a satchel with half the coins and the backpack (not the hotbar)
    const tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS); const w = this.world; let gx = tx, gy = ty;
    for (let r = 0; r < 4 && (w.solid(gx, gy) || w.obj(gx, gy) || isWater(w.ground(gx, gy))); r++) { gx = tx + randi(-r, r); gy = ty + randi(-r, r); }
    const bag = p.inv.slice(8).filter(Boolean); if (bag.length) { w.set(gx, gy, { o: O.GRAVE }); w.chests.set(gx + ',' + gy, bag.map(s => ({ ...s }))); for (let i = 8; i < 32; i++) p.inv[i] = null; }
    p.coins = Math.floor(p.coins / 2);
    this.ui.death(() => { const sp = this.spawnPoint || (() => { const s = this.home().spawn; return { x: s.x * TS + 8, y: s.y * TS + 8 }; })(); p.x = sp.x; p.y = sp.y; p.hp = p.maxHp; p.food = Math.max(p.food, 12); p.dead = false; p.alive = true; p.ifr = 1.5; p.cancelFish(); this.ui.dirty(); });
  }
  /* ---------- realm ---------- */
  army() { return this.ents.filter(e => e instanceof Soldier && e.mine && !e.dead); }
  armyCap() { let v = 0; for (const n of this.nations.values()) if (n.status === 'vassal') v++; return 6 + v * 3; }
  recruit(archer, at) {
    const cost = archer ? 55 : 40, p = this.player;
    if (this.army().length >= this.armyCap()) { this.ui.toast('Your army is at its limit. Conquer villages to grow it.', 'bad'); return false; }
    if (p.coins < cost) { this.ui.toast(`Need ${cost} coins.`, 'bad'); Audio.play('error'); return false; }
    p.coins -= cost; const slot = this.army().length;
    const s = this.add(new Soldier(this, at.x + rand(-10, 10), at.y + rand(10, 20), { mine: true, color: 0xe87a9a, archer, slot }));
    this.ui.toast(`${s.name} the ${archer ? 'archer' : 'spearman'} joins you!`, 'good'); Audio.play('levelup'); this.ui.dirty(); return true;
  }
  conquer(v) {
    const n = this.nationState(v);
    const guards = this.ents.filter(e => e instanceof Soldier && e.vid === v.id && !e.dead && !e.mine && dist2(e.x, e.y, v.x * TS, v.y * TS) < (30 * TS) ** 2);
    if (guards.length) { this.ui.toast(`Defeat their guards first (${guards.length} remain).`, 'bad'); return false; }
    n.status = 'vassal'; n.rel = 40; n.color = 0xe87a9a; this.ui.banner(`${v.name} is yours!`, 'Their banner now flies Hanomi pink. Tribute flows each dawn.'); Audio.play('levelup'); Audio.play('drum');
    for (const e of this.ents) if (e.vid === v.id && e instanceof Villager) e.team = 'v:' + v.id;
    return true;
  }
  /* ---------- per-frame update ---------- */
  update(dt) {
    if (this.paused) return;
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.playTime += dt; this.tickTime(dt); this.tickWeather(dt);
    this.rebuildGrid();
    this.player.update(dt);
    if (this.world.ground(this.player.tx, this.player.ty) === G.ONSEN) { const p = this.player; this._ons = (this._ons || 0) + dt; if (this._ons > 1.5) { this._ons = 0; if (p.hp < p.maxHp) { p.hp++; this.ui.dirty(); } if (!this._onsMsg) { this._onsMsg = 1; this.ui.toast('The hot spring soothes your aches.', 'good'); } } }
    { const p = this.player, w = this.world, ptx = Math.floor(p.x / TS), pty = Math.floor(p.y / TS);
      if (this.inside) { if (w.obj(ptx, pty) === O.EXIT && p.dir === 0 && !this._fading) this.exitHouse(); }
      else if (p.moving && p.dir === 2 && !this._fading) { const r = this.doorAt(ptx, Math.floor((p.y - 6) / TS)); if (r) this.enterHouse(r[0], r[1]); } }
    for (const e of this.ents) { if (e.dead) continue; const far = dist2(e.x, e.y, this.player.x, this.player.y) > (60 * TS) ** 2; if (far && e.persist) continue; e.update(dt); }
    for (const e of this.ents) if (e.solidEnt !== false && !e.dead && e.team !== 'item' && e.team !== 'proj') { // soft separation
      const others = this.query(e.x, e.y, 10, o => o !== e && o.solidEnt !== false && o.team !== 'item' && o.team !== 'proj');
      for (const o of others) { const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || 0.01; if (d < 9 && !o.isPlayer) { const k = (9 - d) * 0.25; e.move(dx / d * k, dy / d * k); } }
    }
    if (this.ents.some(e => e.dead)) this.ents = this.ents.filter(e => !e.dead);
    this.fx.update(dt);
    for (const [k, d] of this.dmg) { d.t -= dt; if (d.t <= 0) this.dmg.delete(k); }
    for (const [k, t] of this.shakeTiles) { if (t - dt <= 0) this.shakeTiles.delete(k); else this.shakeTiles.set(k, t - dt); }
    this.randomTicks(dt);
    this._gl = (this._gl || 0) + dt; if (this._gl > 1) { this._gl = 0; const G0 = GOALS[this.goal || 0];
      if (G0 && G0.ok(this)) { this.goal = (this.goal || 0) + 1; this.player.coins += G0.r; Audio.play('levelup'); this.ui.toast(`Goal complete: ${G0.t} (+${G0.r} coins)`, 'good', 'coin'); this.ui.dirty(); } }
    this._vs = (this._vs || 0) + dt; if (this._vs > 2) { this._vs = 0; const night = this.hour >= 20 || this.hour < 6;
      for (const e of this.ents) if (e instanceof Villager && e.inside && !night) { e.inside = false; if (e.inRoom && e.homeDoor) { e.x = e.homeDoor.x * TS + 8; e.y = (e.homeDoor.y + 1) * TS + 10; } e.inRoom = null; } }
    this._sp = (this._sp || 0) + dt; if (this._sp > 1.5 && !this.inside) { this._sp = 0; this.tickSpawns(); this.activateVillages(); this.world.unloadFar(this.player.x / TS, this.player.y / TS, 7); }
    this._as = (this._as || 0) + dt; if (this._as > 120) { this._as = 0; this.save(true); }
    if (this.raid) this.raid.t += dt;
    // music mode
    const danger = this.nearest(this.player.x, this.player.y, 140, e => (e.team === 'undead' || e.team === 'wild' || (e instanceof Soldier && this.hostile(e, this.player))) && e.target);
    this.mood = danger || this.bloodMoon ? 'battle' : this.daylight < 0.35 ? 'night' : 'day';
  }
  /* ---------- persistence ---------- */
  serialize() {
    return { v: VERSION, opts: this.opts, world: this.world.serialize(), player: this.player.save(), ents: this.ents.map(e => e.save()).filter(Boolean), nations: [...this.nations.values()],
      clock: this.clock, weather: this.weather, goal: this.goal || 0, prayed: this.prayed, koiFeeds: this.koiFeeds, koiDay: this.koiDay, interiors: this.interiors, inside: this.inside ? this.inside.key : null, spawnPoint: this.spawnPoint, stats: this.stats, playTime: this.playTime };
  }
  save(auto) {
    if (!this.onSave) return; this.onSave(this.serialize(), auto);
  }
  load(d) {
    this.world.load(d.world); this.clock = d.clock; this.day = Math.floor(this.clock / DAY_LEN) + 1; this.weather = d.weather || this.weather; this.spawnPoint = d.spawnPoint; this.stats = Object.assign(this.stats, d.stats || {}); this.playTime = d.playTime || 0;
    for (const n of d.nations || []) this.nations.set(n.id, n);
    this.interiors = d.interiors || {}; this.goal = d.goal || 0; this.prayed = d.prayed || {}; this.koiFeeds = d.koiFeeds || 0; this.koiDay = d.koiDay; this.inside = d.inside ? this.interiors[d.inside] || null : null;
    const P = d.player; this.player = new Player(this, P.x, P.y, P.look); Object.assign(this.player, { hp: P.hp, food: P.food, sel: P.sel, armor: P.armor, coins: P.coins, buff: P.buff || 0 }); this.player.inv = Array.isArray(P.inv) ? P.inv : new Array(32).fill(null); while (this.player.inv.length < 32) this.player.inv.push(null);
    for (const e of d.ents || []) {
      let o = null;
      if (e.k === 'villager') { o = new Villager(this, e.x, e.y, { vid: e.vid, role: e.role, seed: e.seed, hx: e.hx, hy: e.hy, name: e.name }); o.homeDoor = e.door; o.homeSi = e.homeSi; }
      else if (e.k === 'soldier') o = new Soldier(this, e.x, e.y, e);
      else if (e.k === 'dog') o = new Dog(this, e.x, e.y, e);
      else if (e.k === 'animal') o = new Animal(this, e.x, e.y, e);
      if (o) { if (e.hp != null) o.hp = e.hp; this.add(o); }
    }
    this.lastHour = this.hour;
  }
}
export const GOALS = [
  { t: 'Gather 10 wood', ok: g => g.player.count('wood') >= 10 || g.stats.chopped >= 3, r: 10 },
  { t: 'Craft a workbench', ok: g => made(g, 'bench'), r: 10 },
  { t: 'Throw a stick for your dog', ok: g => (g.stats.fetches || 0) >= 1, r: 10 },
  { t: 'Craft a stone pickaxe', ok: g => made(g, 'pick_stone'), r: 15 },
  { t: 'Harvest a crop', ok: g => g.stats.harvested >= 1, r: 15 },
  { t: 'Catch a fish', ok: g => g.stats.fish >= 1, r: 15 },
  { t: 'Feed the koi in Hanomi', ok: g => (g.koiFeeds || 0) >= 1, r: 10 },
  { t: 'Survive your first night', ok: g => g.day >= 2, r: 20 },
  { t: 'Pray at a wayside shrine', ok: g => (g.stats.prayed || 0) >= 1, r: 20 },
  { t: 'Find buried treasure', ok: g => (g.stats.dug || 0) >= 1, r: 20 },
  { t: 'Meet a neighbouring clan', ok: g => [...g.nations.values()].some(n => n.met && n.status !== 'home'), r: 20 },
  { t: 'Complete a chief\'s task', ok: g => (g.stats.tasks || 0) >= 1, r: 30 },
  { t: 'Smelt an iron ingot', ok: g => made(g, 'iron'), r: 25 },
  { t: 'Recruit a soldier', ok: g => g.army().length >= 1, r: 25 },
  { t: 'Survive a Blood Moon', ok: g => g.day >= 6, r: 50 },
  { t: 'Forge an iron sword', ok: g => made(g, 'sword_iron'), r: 40 },
  { t: 'Form an alliance', ok: g => [...g.nations.values()].some(n => n.status === 'ally'), r: 60 },
  { t: 'Claim a village for Hanomi', ok: g => [...g.nations.values()].some(n => n.status === 'vassal'), r: 100 },
  { t: 'Forge the Jade katana', ok: g => made(g, 'katana'), r: 150 },
];
const made = (g, id) => !!(g.stats.made && g.stats.made[id]);
export const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
