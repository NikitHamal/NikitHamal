// Hanomi — world renderer: chunk layers, water, y-sorted sprites, lighting, weather.
import { TS, CS, CPX, G, B, O, OBJ, CROPS, isWater } from './defs.js';
import { bakeChunk, bakeWalls, makeWaterFx, WH } from './art/terrain.js';
import { S as NS } from './art/nature.js';
import { S as SS, houseSprite, bannerSprite, stallSprite } from './art/structures.js';
import { Spr } from './pix.js';
import { createKoiPond } from './koipond.js';
import { clamp, hash2, hash2i, rand, pick, bayer, mulberry32, TAU } from './util.js';

const WALLS = new Set([B.STONE, B.DARK, B.COAL, B.IRON, B.GOLD, B.GEM, B.WOODWALL, B.STONEWALL]);

export class Renderer {
  constructor(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d', { alpha: false }); this.lc = document.createElement('canvas'); this.lx = this.lc.getContext('2d');
    this.water = makeWaterFx(); this.wpat = this.water.map(f => this.ctx.createPattern(f, 'repeat'));
    this.lights = new Map(); this.shadows = new Map(); this.dl = []; this.zoom = 0; this.t = 0; this.rain = [];
    this.cam = { x: 0, y: 0, scale: 4, dpr: 1, w: 480, h: 270 };
    this.resize();
  }
  resize() {
    const dpr = window.devicePixelRatio || 1, W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
    let sc = Math.max(1, Math.round(Math.sqrt(W * H / 129600)) + (this.zoom || 0)); sc = Math.max(1, sc);
    const w = Math.ceil(W / sc), h = Math.ceil(H / sc);
    this.cv.width = w; this.cv.height = h; this.cv.style.width = (w * sc / dpr) + 'px'; this.cv.style.height = (h * sc / dpr) + 'px';
    this.lc.width = w; this.lc.height = h;
    Object.assign(this.cam, { scale: sc, dpr, w, h }); this.ctx.imageSmoothingEnabled = false;
  }
  lightSprite(r) {
    const k = r | 0; if (this.lights.has(k)) return this.lights.get(k);
    const R = k * TS, s = new Spr(R * 2, R * 2);
    for (let y = 0; y < R * 2; y++) for (let x = 0; x < R * 2; x++) {
      const d = Math.hypot(x + 0.5 - R, y + 0.5 - R) / R; if (d > 1) continue;
      let a = 1 - d * d; a = Math.floor(a * 5 + (bayer(x, y) - 0.5) * 0.9) / 5; if (a <= 0) continue;
      s.set(x, y, 0xffffff, Math.round(clamp(a, 0, 1) * 255));
    }
    const c = s.canvas(); this.lights.set(k, c); return c;
  }
  glowSprite() { if (this._glow) return this._glow; const R = 24, s = new Spr(R * 2, R * 2); for (let y = 0; y < R * 2; y++) for (let x = 0; x < R * 2; x++) { const d = Math.hypot(x + 0.5 - R, y + 0.5 - R) / R; if (d > 1) continue; const a = Math.floor((1 - d) * 4 + bayer(x, y) * 0.8) / 4; if (a > 0) s.set(x, y, 0xffa040, Math.round(a * 90)); } return (this._glow = s.canvas()); }
  shadowSprite(rx, ry) {
    const k = rx * 100 + ry; if (this.shadows.has(k)) return this.shadows.get(k);
    const s = new Spr(rx * 2 + 1, ry * 2 + 1); s.ell(rx + 0.5, ry + 0.5, rx + 0.3, ry + 0.3, 0x14101e);
    const c = s.canvas(); this.shadows.set(k, c); return c;
  }
  /* ---------- main ---------- */
  render(g, dt) {
    this.t += dt; this.dtLast = dt; const ctx = this.ctx, cam = this.cam, w = g.world, p = g.player;
    // camera
    let tx = p.x - cam.w / 2, ty = p.y - 12 - cam.h / 2;
    const room = g.inside;
    if (room) { const rx = room.x * TS, ry = room.y * TS, rw = room.w * TS, rh = room.h * TS + 12;
      tx = rw < cam.w ? rx + rw / 2 - cam.w / 2 : Math.max(rx - 8, Math.min(rx + rw + 8 - cam.w, tx));
      ty = rh < cam.h ? ry + rh / 2 - cam.h / 2 : Math.max(ry - 8, Math.min(ry + rh + 8 - cam.h, ty)); }
    if (this._room !== room) { this._room = room; this._init = false; }
    if (!this._init) { cam.fx = tx; cam.fy = ty; this._init = true; }
    const k = 1 - Math.pow(0.0008, dt); cam.fx += (tx - cam.fx) * k; cam.fy += (ty - cam.fy) * k;
    let sx = 0, sy = 0; if (g.fx.shakeA > 0 && g.settings.shake) { sx = (Math.random() - 0.5) * g.fx.shakeA * 2; sy = (Math.random() - 0.5) * g.fx.shakeA * 2; }
    cam.x = Math.round(cam.fx + sx); cam.y = Math.round(cam.fy + sy);
    const ox = cam.x, oy = cam.y, vw = cam.w, vh = cam.h;
    ctx.fillStyle = '#1e3a2c'; ctx.fillRect(0, 0, vw, vh);
    // chunks
    const c0 = Math.floor(ox / CPX), c1 = Math.floor((ox + vw) / CPX), r0 = Math.floor(oy / CPX), r1 = Math.floor((oy + vh) / CPX);
    let budget = 2; const vis = [];
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const c = w.chunk(cx, cy);
      if (c.dirty && (budget-- > 0 || !c.cv)) bakeChunk(w, c);
      vis.push(c);
    }
    for (const c of vis) if (c.wcv) ctx.drawImage(c.wcv, c.cx * CPX - ox, c.cy * CPX - oy);
    // animated water glints
    const fr = ((this.t * 6) | 0) % this.wpat.length;
    ctx.save(); ctx.fillStyle = this.wpat[fr]; ctx.translate(-ox % 64 - 64, -oy % 64 - 64);
    for (const c of vis) if (c.wcv) ctx.fillRect(c.cx * CPX - ox + (ox % 64) + 64, c.cy * CPX - oy + (oy % 64) + 64, CPX, CPX);
    ctx.restore();
    for (const c of vis) if (c.cv) ctx.drawImage(c.cv, c.cx * CPX - ox, c.cy * CPX - oy);
    // ---- collect drawables ----
    const dl = this.dl; dl.length = 0; const shadows = [];
    const tx0 = Math.floor(ox / TS) - 2, tx1 = Math.floor((ox + vw) / TS) + 2, ty0 = Math.floor(oy / TS) - 1, ty1 = Math.floor((oy + vh) / TS) + 4;
    const lights = []; const night = 1 - g.daylight;
    const rm = g.inside;
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
      if (rm && (x < rm.x || y < rm.y || x >= rm.x + rm.w || y >= rm.y + rm.h)) continue;
      const b = w.block(x, y);
      const o = w.obj(x, y);
      if (o) { dl.push({ k: y * TS + (o === O.LILY || o === O.EXIT || o === O.CUSHION ? -100 : OBJ[o].wall ? 16.5 : 15), t: 2, x, y, o, m: w.meta(x, y) }); const L = OBJ[o].light; if (L && (night > 0.05 || g.inside)) lights.push([x * TS + 8, y * TS + (o === O.TORCH ? -2 : 4), L, OBJ[o].warm]); }
    }
    for (const c of vis) {
      if (c.wallcv === undefined || c.wrv !== c.rv) bakeWalls(w, c);
      if (!c.wallcv) continue;
      for (let r = 0; r < CS; r++) if (c.wrows[r]) { const wy = (c.cy * CS + r) * TS; if (wy > oy + vh || wy + TS + WH < oy) continue; dl.push({ k: wy + 15.9, t: 1, c, r }); }
    }
    // the chunk row just above the view can hang its front faces down into it
    for (let cx = c0; cx <= c1; cx++) { const c = w.peek(cx, r0 - 1); if (c && c.wrows && c.wrows[CS - 1] && r0 * CPX + WH > oy) { if (c.wrv !== c.rv) bakeWalls(w, c); if (c.wallcv) dl.push({ k: (c.cy * CS + CS - 1) * TS + 15.9, t: 1, c, r: CS - 1 }); } }
    for (const v of w.villagesNear((ox + vw / 2) / TS, (oy + vh / 2) / TS, Math.max(vw, vh) / TS)) for (const s of v.structs) {
      const sx0 = s.x * TS, sy1 = (s.y + s.h) * TS; if (sx0 > ox + vw + 16 || sx0 + s.w * TS < ox - 16 || sy1 < oy - 8 || sy1 - 90 > oy + vh) continue;
      dl.push({ k: sy1 - 0.5, t: 3, s, v });
    }
    for (const e of g.ents) { if (e.dead || e.x < ox - 40 || e.x > ox + vw + 40 || e.y < oy - 20 || e.y > oy + vh + 50) continue; dl.push({ k: e.y, t: 4, e }); const sh = e.shadow && e.shadow(); if (sh) shadows.push(sh); }
    if (!p.dead) { dl.push({ k: p.y, t: 4, e: p }); shadows.push(p.shadow()); }
    if (p.item && p.item.id === 'torch' && night > 0.05) lights.push([p.x, p.y - 12, 5, 1]);
    // shadows
    const shA = 0.22 + 0.1 * g.daylight - g.weather.rain * 0.08, shOff = (g.hour - 12) * 0.25;
    ctx.globalAlpha = Math.max(0.1, shA);
    for (const [x, y, rx, ry] of shadows) { const sp = this.shadowSprite(Math.round(rx), Math.round(ry)); ctx.drawImage(sp, Math.round(x - ox - rx + shOff * 0.3), Math.round(y - oy - ry)); }
    for (const d of dl) if (d.t === 2) { const sp = this.objSprite(g, d); if (sp && sp.sh) { const s = this.shadowSprite(sp.sh[0], sp.sh[1]); ctx.drawImage(s, Math.round(d.x * TS + 8 - ox - sp.sh[0] + shOff), Math.round(d.y * TS + 14 - oy - sp.sh[1])); } }
    ctx.globalAlpha = 1;
    // sorted draw
    dl.sort((a, b) => a.k - b.k);
    const pBox = { x: p.x, y: p.y };
    for (const d of dl) {
      if (d.t === 4) { d.e.draw(ctx, ox, oy); continue; }
      if (d.t === 1) { const c = d.c; ctx.drawImage(c.wallcv, 0, d.r * TS, CPX, TS + WH, c.cx * CPX - ox, c.cy * CPX + d.r * TS - oy, CPX, TS + WH); continue; }
      if (d.t === 3) { this.drawStruct(g, d.s, d.v, ox, oy, pBox, lights, night); continue; }
      const sp = this.objSprite(g, d); if (!sp) continue;
      let dx = d.x * TS + 8 - sp.ax - ox, dy = d.y * TS + 16 - sp.ay - oy;
      const sh = g.shakeTiles.get(d.x + ',' + d.y); if (sh) dx += Math.round(Math.sin(sh * 80) * 1.5);
      let fade = false;
      if (sp.h > 26 && pBox.y < d.y * TS + 12 && pBox.y > d.y * TS + 16 - sp.ay + 4 && Math.abs(pBox.x - (d.x * TS + 8)) < sp.w / 2 - 2) fade = true;
      if (fade) ctx.globalAlpha = 0.55;
      ctx.drawImage(sp.cv, Math.round(dx), Math.round(dy));
      if (fade) ctx.globalAlpha = 1;
      if (sp.lights && (night > 0.05 || g.inside)) for (const L of sp.lights) lights.push([d.x * TS + 8 - sp.ax + L.x + L.w / 2, d.y * TS + 16 - sp.ay + L.y + L.h / 2, 4, 0]);
    }
    // damage cracks
    for (const [k2, dm] of g.dmg) { const [x, y] = k2.split(',').map(Number); const b = w.block(x, y), o = w.obj(x, y); const hp = b ? 6 : (o && OBJ[o].hp) || 1; const st = clamp(Math.ceil(dm.v / Math.max(1, hp) * 3), 1, 3); if (b) ctx.drawImage(SS['crack' + st].cv, x * TS - ox, y * TS - oy); }
    g.fx.draw(ctx, ox, oy, false);
    if (room) { // cut the room out of the world
      const rx = room.x * TS - ox, ry = room.y * TS - oy, rw = room.w * TS, rh = room.h * TS + 12; ctx.fillStyle = '#0c0a10';
      ctx.fillRect(0, 0, vw, Math.max(0, ry)); ctx.fillRect(0, ry + rh, vw, vh); ctx.fillRect(0, ry, Math.max(0, rx), rh); ctx.fillRect(rx + rw, ry, vw, rh); }
    // target reticle
    if (g.target && !g.ui.modal && g.showTarget()) this.drawTarget(ctx, g.target.x * TS - ox, (g.target.y * TS - oy) - 0);
    // rain
    if (!room) this.drawRain(g, ctx, vw, vh, dt);
    // lighting
    this.drawLight(g, ctx, lights, ox, oy, vw, vh);
    g.fx.draw(ctx, ox, oy, true);
    if (!room) this.ambient(g, dt, ox, oy, vw, vh);
  }
  objSprite(g, d) {
    const o = d.o, m = d.m, x = d.x, y = d.y, t = this.t;
    switch (o) {
      case O.OAK: return NS['oak' + (m & 3)];
      case O.PINE: return NS[(g.world.ground(x, y) === G.SNOW ? 'pinesnow' : 'pine') + (m & 3)];
      case O.SAKURA: return NS['sakura' + (m & 3)];
      case O.BIRCH: return NS['birch' + (m & 3)];
      case O.DEADTREE: return NS['dead' + (m & 3)];
      case O.STUMP: return NS.stump;
      case O.BUSH: return NS['bush' + (hash2i(x, y) % 3)];
      case O.BERRY: return NS[(m ? 'berryx' : 'berry') + (hash2i(x, y) % 3)];
      case O.BOULDER: return NS['boulder' + (m & 7)];
      case O.PEBBLE: return NS['pebbles' + (m & 7)];
      case O.TALLGRASS: { const near = Math.abs(g.player.x - (x * TS + 8)) < 10 && Math.abs(g.player.y - (y * TS + 12)) < 8; return NS['grass' + ((near || ((t * 1.3 + x * 0.37 + y * 0.21) % 2) > 1) ? 1 : 0)]; }
      case O.FLOWERS: return NS['flowers' + (m & 7)];
      case O.REEDS: return NS.reeds;
      case O.MUSHROOM: return NS['mush' + (m & 7)];
      case O.LILY: return NS['lily' + (hash2i(x, y) & 7)];
      case O.SAPLING: return NS.sapling;
      case O.CACTUS: return NS.cactus;
      case O.WHEAT: return NS['wheat' + (m & 3)]; case O.CARROT: return NS['carrot' + (m & 3)]; case O.TOMATO: return NS['tomato' + (m & 3)]; case O.PUMPKIN: return NS['pumpkin' + (m & 3)]; case O.RICE: return NS['rice' + (m & 3)];
      case O.TORCH: return SS['torch' + (((t * 8 + x) | 0) % 3)];
      case O.CAMPFIRE: { if (Math.random() < 0.08) g.fx.spawn({ x: x * TS + 8 + rand(-3, 3), y: y * TS + 12, z: 10, vz: 18, life: 1.2, c: '#8a8a90', k: 'smoke', s: 3 }); if (Math.random() < 0.05) g.fx.spawn({ x: x * TS + 8, y: y * TS + 12, z: 8, vz: 30, vx: rand(-8, 8), life: 0.6, c: '#ffd04a', k: 'dot', top: true }); return SS['fire' + (((t * 8) | 0) % 4)]; }
      case O.CHEST: return SS.chest; case O.BENCH: return SS.bench; case O.ANVIL: return SS.anvil; case O.BED: return SS.bed;
      case O.FURNACE: return SS['furnace' + (((t * 6) | 0) % 3)];
      case O.FENCE: return SS['fence' + this.fenceMask(g, x, y)];
      case O.GATE: return SS['gate' + (m & 1)];
      case O.LANTERN: return SS.lantern; case O.SCARECROW: return SS.scarecrow; case O.SIGN: return SS.sign; case O.WELL: return SS.well;
      case O.BARREL: return SS.barrel; case O.CRATE: return SS.crate; case O.HAY: return SS.hay; case O.TORII: return SS.torii; case O.GRAVE: return SS.satchel; case O.SPIKES: return SS.spikes; case O.TOWER: return SS.tower;
      case O.POT: return SS['pot' + (((t * 5) | 0) % 2)];
      case O.BANNER: { const v = g.world.villagesNear(x, y, 3).find(v => v.banner && v.banner.x === x && v.banner.y === y); const n = v && g.nations.get(v.id); const col = n ? n.color : 0xe87a9a; return bannerSprite(col)[((t * 4 + x) | 0) % 4]; }
      case O.TABLE: return SS.table; case O.HEARTH: return SS['hearth' + (((t * 6) | 0) % 3)]; case O.SHELF: return SS.tansu; case O.BONSAI: return SS.bonsai; case O.ANDON: return SS.andon;
      case O.CUSHION: return SS['cushion' + (m & 3)]; case O.SCREEN: return SS.byobu; case O.STOVE: return SS['kamado' + (((t * 5) | 0) % 2)]; case O.EXIT: return SS.exit;
      case O.WINDOW: return SS.window; case O.SCROLL: return SS.scroll; case O.SHRINE: return SS.shrine;
      case O.DIG: { if (Math.random() < 0.02) g.fx.spawn({ x: x * TS + 4 + rand(8), y: y * TS + 10, z: rand(2, 6), vz: 6, life: 0.6, c: '#fff6c0', k: 'spark', g: 0 }); return SS.dig; }
      case O.STALL: { const v = g.world.villagesNear(x, y, 3)[0]; const n = v && g.nations.get(v.id); return stallSprite(n ? n.color : 0x3a6fc8); }
    }
    return null;
  }
  fenceMask(g, x, y) { const w = g.world, f = (xx, yy) => { const o = w.obj(xx, yy); return o === O.FENCE || o === O.GATE || WALLS.has(w.block(xx, yy)); }; return (f(x, y - 1) ? 1 : 0) | (f(x + 1, y) ? 2 : 0) | (f(x, y + 1) ? 4 : 0) | (f(x - 1, y) ? 8 : 0); }
  drawWall(g, x, y, b, ox, oy) {
    const w = g.world, nat = b !== B.WOODWALL && b !== B.STONEWALL;
    const con = (xx, yy) => { const n = w.block(xx, yy); if (!n || n === B.BLDG) return false; const nn = n !== B.WOODWALL && n !== B.STONEWALL; return nat ? nn : n === b; };
    const mask = (con(x, y - 1) ? 1 : 0) | (con(x + 1, y) ? 2 : 0) | (con(x, y + 1) ? 4 : 0) | (con(x - 1, y) ? 8 : 0);
    const sp = SS[`w${b}_${mask}_${hash2i(x, y) & 1}`]; if (!sp) return;
    let dx = 0; const sh = g.shakeTiles.get(x + ',' + y); if (sh) dx = Math.round(Math.sin(sh * 80));
    this.ctx.drawImage(sp.cv, x * TS - ox + dx, y * TS - 8 - oy);
  }
  drawStruct(g, s, v, ox, oy, pBox, lights, night) {
    const ctx = this.ctx;
    if (s.kind === 'koi') return this.drawKoi(g, s, ox, oy);
    const n = g.nations.get(v.id), col = s.home ? 0xd8486a : (n ? n.color : v.color);
    const sp = houseSprite(s.w, s.h, s.home ? 0 : s.kind === 'hall' ? 2 : s.kind === 'barracks' ? 0 : s.style, { hall: s.kind === 'hall', door: s.door ? s.door.x - s.x : null, color: col });
    const x0 = s.x * TS - sp.ax - ox, y0 = (s.y + s.h) * TS - sp.ay - oy;
    const behind = pBox.y < (s.y + s.h) * TS - 4 && pBox.y > (s.y + s.h) * TS - sp.h + 6 && pBox.x > s.x * TS && pBox.x < (s.x + s.w) * TS;
    if (behind) ctx.globalAlpha = 0.6;
    ctx.drawImage(sp.cv, Math.round(x0), Math.round(y0));
    if (behind) ctx.globalAlpha = 1;
    if (night > 0.05 && sp.lights) for (const L of sp.lights) { lights.push([x0 + ox + L.x + L.w / 2, y0 + oy + L.y + L.h / 2, L.lantern ? 3 : 3, 1]); (this._win || (this._win = [])).push([x0 + L.x, y0 + L.y, L.w, L.h, L.lantern]); }
  }
  drawKoi(g, s, ox, oy) { // the portfolio's own pond simulation, embedded in the world
    if (!this.pond) { this.pond = createKoiPond(s.w * TS, s.h * TS); this.pondT = 0; }
    const P = this.pond; this.pondT += this.dtLast || 0;
    if (this.pondT >= 1 / 30) { P.setRain(g.raining); P.step(Math.min(0.1, this.pondT)); this.pondT = 0; }
    this.ctx.drawImage(P.canvas, s.x * TS - ox, s.y * TS - oy);
  }
  drawTarget(ctx, x, y) {
    const a = 0.55 + 0.25 * Math.sin(this.t * 6); ctx.globalAlpha = a; ctx.fillStyle = '#fff8e8';
    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + 15, y, -1, 1], [x, y + 15, 1, -1], [x + 15, y + 15, -1, -1]]) { ctx.fillRect(cx, cy, 3 * dx || 1, 1); ctx.fillRect(cx, cy, 1, 3 * dy || 1); if (dx < 0) ctx.fillRect(cx - 2, cy, 3, 1); if (dy < 0) ctx.fillRect(cx, cy - 2, 1, 3); }
    ctx.globalAlpha = 1;
  }
  drawRain(g, ctx, vw, vh, dt) {
    const R = g.weather.rain; const want = Math.floor(R * vw * vh / 900);
    while (this.rain.length < want) this.rain.push({ x: rand(vw), y: rand(-vh, vh), l: rand(4, 8), s: rand(220, 300) });
    if (this.rain.length > want) this.rain.length = want;
    if (!this.rain.length) return;
    const snow = g.world.ground(g.player.tx, g.player.ty) === G.SNOW;
    ctx.fillStyle = snow ? 'rgba(255,255,255,0.8)' : 'rgba(190,215,240,0.45)';
    for (const r of this.rain) {
      r.y += r.s * dt * (snow ? 0.18 : 1); r.x -= r.s * dt * (snow ? 0.05 : 0.18);
      if (r.y > vh) { r.y = rand(-20, 0); r.x = rand(vw + 40); if (!snow && Math.random() < 0.4) g.fx.spawn({ x: g.renderer.cam.x + r.x, y: g.renderer.cam.y + rand(vh), life: 0.25, k: 'ring', s: 2, c: '#cfe6f8', fade: false }); }
      if (snow) ctx.fillRect(r.x | 0, r.y | 0, 1, 1); else { ctx.fillRect(r.x | 0, r.y | 0, 1, r.l | 0); }
    }
  }
  drawLight(g, ctx, lights, ox, oy, vw, vh) {
    const d = g.daylight, h = g.hour, rain = g.inside ? 0 : g.weather.rain, blood = g.bloodMoon && !g.inside;
    // dusk / dawn warmth
    const dusk = (h > 16.5 && h < 20.5) ? 1 - Math.abs(h - 18.6) / 2 : (h > 4 && h < 7.5) ? 1 - Math.abs(h - 5.8) / 1.8 : 0;
    if (dusk > 0.02 && !g.inside) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(255,${190 + (1 - dusk) * 60 | 0},${150 + (1 - dusk) * 100 | 0},1)`; ctx.globalAlpha = dusk * 0.6; ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    const dark = g.inside ? 0.16 + (1 - d) * 0.6 : (1 - d) * 0.8 + rain * 0.18;
    if (dark < 0.02) { this._win = null; return; }
    const L = this.lx; L.globalCompositeOperation = 'source-over'; L.clearRect(0, 0, vw, vh);
    L.fillStyle = blood ? `rgba(40,4,10,${Math.min(0.86, dark)})` : `rgba(8,12,${34 + rain * 10 | 0},${Math.min(0.84, dark)})`; L.fillRect(0, 0, vw, vh);
    L.globalCompositeOperation = 'destination-out';
    const fl = Math.sin(this.t * 13) * 0.04 + Math.sin(this.t * 7.3) * 0.03;
    for (const [x, y, r, warm] of lights) { const sp = this.lightSprite(r), s = r * TS * (1 + (warm ? fl : 0)); L.drawImage(sp, Math.round(x - ox - s), Math.round(y - oy - s), Math.round(s * 2), Math.round(s * 2)); }
    // fireflies punch tiny holes
    ctx.drawImage(this.lc, 0, 0);
    if (d < 0.6) {
      ctx.globalCompositeOperation = 'lighter'; const gl = this.glowSprite(); ctx.globalAlpha = Math.min(1, (1 - d)) * 0.7;
      for (const [x, y, r, warm] of lights) if (warm) ctx.drawImage(gl, Math.round(x - ox - 24), Math.round(y - oy - 24));
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (this._win) { ctx.globalAlpha = Math.min(1, (1 - d) * 1.2); for (const [x, y, w, hh, lan] of this._win) { ctx.fillStyle = lan ? '#ff6a4a' : '#ffd88a'; ctx.globalAlpha = (lan ? 0.6 : 0.85) * Math.min(1, (1 - d) * 1.3); ctx.fillRect(Math.round(x), Math.round(y), w, hh); } ctx.globalAlpha = 1; }
    }
    this._win = null;
  }
  ambient(g, dt, ox, oy, vw, vh) {
    // petals, leaves, fireflies, butterflies
    const p = g.player, b = g.world.biomeAt(p.tx, p.ty), fx = g.fx;
    const nearHome = Math.hypot(p.x / TS, p.y / TS) < 26;
    if ((b === 'sakura' || nearHome) && Math.random() < dt * 6) fx.spawn({ x: ox + rand(vw + 40), y: oy + rand(-20, vh * 0.6), z: rand(30, 60), vz: -rand(4, 8), vx: rand(-14, -4), vy: rand(2, 6), life: rand(4, 7), c: pick(['#f6b8ca', '#ffd8e4', '#ea98b0']), k: 'petal', g: 0 });
    if (b === 'forest' && Math.random() < dt * 2) fx.spawn({ x: ox + rand(vw), y: oy + rand(vh * 0.7), z: rand(30, 50), vz: -rand(4, 8), vx: rand(-6, 6), life: rand(4, 6), c: pick(['#8aa83a', '#c8a03a', '#6a8a2a']), k: 'leaf', g: 0 });
    if (g.daylight < 0.4 && (b === 'meadow' || b === 'sakura' || b === 'marsh' || b === 'forest') && Math.random() < dt * 3) fx.spawn({ x: ox + rand(vw), y: oy + rand(vh), z: rand(4, 20), vx: rand(-6, 6), vy: rand(-4, 4), vz: rand(-2, 2), life: rand(3, 6), c: pick(['#e8ff8a', '#c8ff6a', '#fff2a0']), k: 'glow', g: 0, top: true, fade: false, drag: 0.99 });
    if (g.daylight > 0.8 && !g.raining && (b === 'meadow' || b === 'sakura') && Math.random() < dt * 0.6) fx.spawn({ x: ox + rand(vw), y: oy + rand(vh), z: rand(6, 16), vx: rand(-12, 12), vy: rand(-8, 8), life: rand(4, 8), c: pick(['#ffffff', '#f2d84a', '#9cc8f4', '#f6b8ca']), k: 'petal', g: 0, drag: 1 });
  }
}
