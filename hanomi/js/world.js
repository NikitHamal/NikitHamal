// Hanomi — infinite procedural world: terrain, biomes, ores, villages, chunk storage.
import { TS, CS, G, B, O, OBJ, BLOCK, isWater, CROPS } from './defs.js';
import { fbm, hash2, hash2i, RNG, clamp } from './util.js';

const REG = 104;           // village region size in tiles
const VR = 21;             // village radius
const SYL1 = ['Aka', 'Hana', 'Kiri', 'Mizu', 'Yama', 'Kaze', 'Tsuki', 'Hoshi', 'Kumo', 'Ishi', 'Mori', 'Sora', 'Yuki', 'Kawa', 'Hino', 'Nagi', 'Ao', 'Shira', 'Kuro', 'Taka', 'Fuyu', 'Asa'];
const SYL2 = ['mura', 'zawa', 'hara', 'oka', 'shima', 'no', 'gawa', 'mine', 'dera', 'saki', 'tani', 'machi', 'ba', 'ishi', 'kage', 'ya'];
const RULER = ['Ren', 'Haru', 'Aoi', 'Sora', 'Kaito', 'Yuna', 'Daichi', 'Mei', 'Riku', 'Hina', 'Takeshi', 'Akane', 'Isamu', 'Nobu', 'Sayo', 'Jun'];
export const NATION_COLORS = [0xc8423a, 0x3a6fc8, 0xd8a23a, 0x7a46b8, 0x2f9a6a, 0xd86a2a, 0x2aa0b0, 0xb83a7a, 0x6a7a2a, 0x5a4a3a];
const TEMPER = ['peaceful', 'proud', 'greedy', 'warlike', 'honest'];

export class Chunk {
  constructor(cx, cy) {
    this.cx = cx; this.cy = cy; const n = CS * CS;
    this.g = new Uint8Array(n); this.b = new Uint8Array(n); this.o = new Uint8Array(n); this.m = new Uint8Array(n);
    this.mod = new Map(); this.dirty = true; this.gen = false; this.water = false; this.rv = 0;
  }
}

export class World {
  constructor(seed) {
    this.seed = seed >>> 0; this.chunks = new Map(); this.saved = {}; this.villages = new Map(); this.chests = new Map();
    this.onChange = null;
    this.S = [1, 2, 3, 4, 5, 6, 7, 8].map(k => hash2i(k, 99, this.seed) % 100000);
  }
  /* ---------- base terrain (pure function of seed + coords) ---------- */
  sample(x, y) {
    const S = this.S, d0 = Math.hypot(x, y);
    let e = fbm(x / 120, y / 120, S[0], 5) * 0.72 + fbm(x / 420, y / 420, S[1], 3) * 0.38 - 0.05;
    e += Math.max(0, 1 - d0 / 70) * 0.32;                      // home island lift
    const m = fbm(x / 85 + 300, y / 85, S[2], 4);
    const t = fbm(x / 260, y / 260 + 50, S[3], 3) + Math.max(0, 1 - d0 / 180) * 0.25;
    const h = fbm(x / 64, y / 64, S[4], 4) - Math.max(0, 1 - d0 / 60) * 0.25;
    const rv = fbm(x / 190, y / 190, S[5], 3);
    return { e, m, t, h, river: Math.abs(rv - 0.5) < 0.0105 + fbm(x / 30, y / 30, S[6], 2) * 0.006 && d0 > 34 && e < 0.66 };
  }
  biomeAt(x, y) {
    const s = this.sample(x, y);
    if (s.e < 0.34) return 'deep'; if (s.e < 0.4 || s.river) return 'water'; if (s.e < 0.425) return 'beach';
    if (s.h > 0.6 && s.e > 0.44) return 'rock';
    if (s.t < 0.33) return 'snow';
    if (s.e < 0.47 && s.m > 0.58) return 'marsh';
    if (s.m > 0.585) return 'forest';
    if (fbm(x / 46, y / 46, this.S[7], 3) > 0.63) return 'sakura';
    return 'meadow';
  }
  base(x, y) {
    const s = this.sample(x, y), H = (k) => hash2(x, y, this.seed + k);
    let g = G.GRASS, b = 0, o = 0, m = 0;
    if (s.e < 0.34) { g = G.DEEP; }
    else if (s.e < 0.4 || s.river) { g = G.WATER; if (H(1) < 0.025 && s.e > 0.37) o = O.LILY; }
    else if (s.e < 0.425) { g = G.SAND; const r = H(2); if (r < 0.012) o = O.PEBBLE; else if (r < 0.016) o = O.BOULDER; }
    else if (s.h > 0.6 && s.e > 0.44) {
      g = G.ROCK;
      if (s.h > 0.632) {
        b = s.h > 0.7 ? B.DARK : B.STONE;
        const v1 = fbm(x / 5, y / 5, this.S[1] + 7, 2), v2 = fbm(x / 6, y / 6, this.S[2] + 9, 2), v3 = fbm(x / 4, y / 4, this.S[3] + 11, 2);
        if (v1 > 0.69) b = B.COAL;
        if (s.h > 0.655 && v2 > 0.71) b = B.IRON;
        if (s.h > 0.685 && v3 > 0.74) b = B.GOLD;
        if (s.h > 0.7 && H(3) < 0.012) b = B.GEM;
      } else { const r = H(4); if (r < 0.04) o = O.BOULDER; else if (r < 0.08) o = O.PEBBLE; else if (r < 0.095) o = O.PINE; }
    }
    else if (s.t < 0.33) { g = G.SNOW; const r = H(5); if (r < 0.09) o = O.PINE; else if (r < 0.105) o = O.BOULDER; else if (r < 0.12) o = O.DEADTREE; else if (r < 0.13) o = O.BERRY; }
    else if (s.e < 0.47 && s.m > 0.58) {
      g = G.MARSH; if (fbm(x / 7, y / 7, this.S[4] + 3, 2) > 0.64) { g = G.WATER; if (H(6) < 0.08) o = O.LILY; }
      else { const r = H(7); if (r < 0.1) o = O.REEDS; else if (r < 0.13) o = O.DEADTREE; else if (r < 0.16) o = O.MUSHROOM; else if (r < 0.2) o = O.TALLGRASS; }
    }
    else if (s.m > 0.585) {
      g = G.FOREST; const r = H(8), k = H(9);
      if (r < 0.2) o = k < 0.45 ? O.OAK : k < 0.8 ? O.PINE : O.BIRCH;
      else if (r < 0.23) o = O.MUSHROOM; else if (r < 0.27) o = O.BUSH; else if (r < 0.285) o = O.BERRY; else if (r < 0.33) o = O.TALLGRASS;
    }
    else if (fbm(x / 46, y / 46, this.S[7], 3) > 0.63) {
      g = G.SAKURA; const r = H(10);
      if (r < 0.085) o = O.SAKURA; else if (r < 0.13) o = O.FLOWERS; else if (r < 0.16) o = O.TALLGRASS; else if (r < 0.17) o = O.BOULDER;
    }
    else {
      const r = H(11), dry = s.m < 0.42;
      if (r < (dry ? 0.012 : 0.03)) o = H(12) < 0.8 ? O.OAK : O.BIRCH;
      else if (r < 0.05) o = O.BUSH; else if (r < 0.06) o = O.BERRY; else if (r < (dry ? 0.16 : 0.11)) o = O.TALLGRASS;
      else if (r < 0.14) o = O.FLOWERS; else if (r < 0.147) o = O.BOULDER; else if (r < 0.152) o = O.PEBBLE;
    }
    if (o && OBJ[o] && OBJ[o].tree) m = hash2i(x, y, 77) & 3;
    if (o === O.FLOWERS || o === O.MUSHROOM || o === O.BOULDER || o === O.PEBBLE) m = hash2i(x, y, 78) & 7;
    return { g, b, o, m };
  }
  /* ---------- villages ---------- */
  villageForRegion(rx, ry) {
    const key = rx + ',' + ry; if (this.villages.has(key)) return this.villages.get(key);
    let v = null;
    if (rx === 0 && ry === 0) v = this.makeVillage(key, 0, 0, true);
    else if (Math.abs(rx) + Math.abs(ry) > 0 && !(Math.abs(rx) <= 1 && Math.abs(ry) <= 1 && hash2(rx, ry, this.seed) < 0.35)) {
      const r = new RNG(hash2i(rx, ry, this.seed + 404));
      if (r.next() < 0.78) {
        for (let tries = 0; tries < 6 && !v; tries++) {
          const cx = Math.round(rx * REG + r.r(-REG * 0.3, REG * 0.3)), cy = Math.round(ry * REG + r.r(-REG * 0.3, REG * 0.3));
          if (Math.hypot(cx, cy) < 70) continue;
          let ok = true;
          for (let k = 0; k < 13 && ok; k++) { const a = k / 12 * Math.PI * 2, rr = k === 12 ? 0 : 15; const bb = this.biomeAt(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr)); if (bb === 'water' || bb === 'deep' || bb === 'rock') ok = false; }
          if (ok) v = this.makeVillage(key, cx, cy, false);
        }
      }
    }
    this.villages.set(key, v); return v;
  }
  villagesNear(x, y, rad = VR + 2) {
    const out = [], rx0 = Math.floor((x - rad) / REG + 0.5) - 1, rx1 = Math.floor((x + rad) / REG + 0.5) + 1;
    const ry0 = Math.floor((y - rad) / REG + 0.5) - 1, ry1 = Math.floor((y + rad) / REG + 0.5) + 1;
    for (let ry = ry0; ry <= ry1; ry++) for (let rx = rx0; rx <= rx1; rx++) {
      const v = this.villageForRegion(rx, ry); if (v && Math.abs(v.x - x) <= rad + VR && Math.abs(v.y - y) <= rad + VR) out.push(v);
    }
    return out;
  }
  makeVillage(id, cx, cy, home) {
    const r = new RNG(hash2i(cx, cy, this.seed + 7));
    const name = home ? 'Hanomi' : r.pick(SYL1) + r.pick(SYL2);
    const v = { id, x: cx, y: cy, home, name, ruler: r.pick(RULER), color: home ? 0xe87a9a : r.pick(NATION_COLORS), temper: home ? 'kind' : r.pick(TEMPER),
      size: home ? 1 : r.i(1, 3), ov: new Map(), structs: [], spawns: [] };
    const set = (x, y, g, b, o, m) => {
      const k = x + ',' + y, cur = v.ov.get(k) || {};
      if (g != null) cur.g = g; if (b != null) cur.b = b; if (o != null) cur.o = o; if (m != null) cur.m = m; v.ov.set(k, cur);
    };
    const R2 = VR * VR;
    // clear the village circle: grass, no trees (base biome tint kept outside)
    for (let y = -VR; y <= VR; y++) for (let x = -VR; x <= VR; x++) {
      const d2 = x * x + y * y; if (d2 > R2) continue;
      const bs = this.base(cx + x, cy + y);
      let g = bs.g; if (isWater(g) || g === G.ROCK || g === G.MARSH || g === G.SAND) g = G.GRASS;
      const o = (d2 < (VR - 4) ** 2) ? 0 : (OBJ[bs.o] && OBJ[bs.o].tree ? 0 : bs.o);
      set(cx + x, cy + y, home ? (d2 < (VR - 3) ** 2 ? G.SAKURA : G.GRASS) : g, 0, isWater(bs.g) ? 0 : o, 0);
    }
    const path = (x, y) => { set(x, y, G.PATH, 0, 0, 0); };
    const used = new Set(); const mark = (x, y, w, h) => { for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) used.add((x + i) + ',' + (y + j)); };
    const free = (x, y, w, h) => { for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) { const k = (x + i) + ',' + (y + j); if (used.has(k)) return false; const o = v.ov.get(k); if (o && o.g === G.PATH) return false; if ((x + i - cx) ** 2 + (y + j - cy) ** 2 > (VR - 2) ** 2) return false; } return true; };
    // roads: plus shape (2 wide)
    const L = VR - 2, arms = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of arms) for (let s = 0; s <= L; s++) {
      const wob = Math.round(Math.sin(s * 0.35 + r.r(0, 0.2)) * 0.6);
      for (let w = 0; w < 2; w++) { const px = cx + dx * s + (dy ? w + wob : 0), py = cy + dy * s + (dx ? w + wob : 0); path(px, py); }
    }
    // plaza
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 17) set(cx + x, cy + y, G.PLAZA, 0, 0, 0);
    mark(cx - 4, cy - 4, 9, 9);
    const struct = (kind, x, y, w, h, extra = {}) => {
      const s = Object.assign({ kind, x, y, w, h, v: id, style: r.i(0, 3) }, extra); v.structs.push(s); mark(x, y, w, h);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, G.DIRT, B.BLDG, 0, 0);
      return s;
    };
    const doorPath = s => { const dx = s.x + (s.w >> 1); for (let yy = s.y + s.h; yy <= s.y + s.h + 1; yy++) { path(dx, yy); used.add(dx + ',' + yy); } s.door = { x: dx, y: s.y + s.h - 1 }; };
    if (home) {
      // koi pond east of the plaza, the player's home north-west, farm plot south-west
      const px0 = cx + 6, py0 = cy - 7;
      struct('koi', px0, py0, 7, 5); v.koi = { x: px0, y: py0, w: 7, h: 5 };
      for (let j = 0; j < 5; j++) for (let i = 0; i < 7; i++) set(px0 + i, py0 + j, G.GRASS, B.BLDG, 0, 0);
      set(px0 - 1, py0 + 5, null, 0, O.LANTERN, 0); set(px0 + 7, py0 + 5, null, 0, O.LANTERN, 0);
      set(px0 + 8, py0 - 1, null, 0, O.SAKURA, 1); set(px0 - 2, py0 - 2, null, 0, O.SAKURA, 2); set(px0 + 9, py0 + 3, null, 0, O.SAKURA, 0);
      const hs = struct('house', cx - 11, cy - 9, 6, 4, { style: 0, home: true }); doorPath(hs); v.homeHouse = hs;
      set(hs.x + hs.w + 1, hs.y + hs.h, null, 0, O.CHEST, 0); set(hs.x - 1, hs.y + hs.h, null, 0, O.BENCH, 0);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) set(cx - 11 + i, cy + 5 + j, G.TILLED, 0, (j === 1 || j === 2) && i < 4 ? O.WHEAT : 0, 1);
      for (let i = -1; i <= 6; i++) { set(cx - 11 + i, cy + 4, null, 0, i === 2 ? O.GATE : O.FENCE, 0); set(cx - 11 + i, cy + 9, null, 0, O.FENCE, 0); }
      for (let j = 5; j < 9; j++) { set(cx - 12, cy + j, null, 0, O.FENCE, 0); set(cx - 5, cy + j, null, 0, O.FENCE, 0); }
      mark(cx - 12, cy + 4, 8, 6);
      set(cx - 7, cy + 7, null, 0, O.SCARECROW, 0);
      set(cx + 3, cy + 3, null, 0, O.BANNER, 0); v.banner = { x: cx + 3, y: cy + 3 };
      set(cx - 3, cy - 3, null, 0, O.WELL, 0);
      v.stall = { x: cx - 3, y: cy + 3 }; set(v.stall.x, v.stall.y, null, 0, O.STALL, 0); v.spawns.push({ k: 'merchant', x: v.stall.x, y: v.stall.y + 1 });
      v.spawns.push({ k: 'dog', x: cx - 6, y: cy - 4 });
      v.spawn = { x: hs.door.x, y: hs.door.y + 2 };
    } else {
      set(cx, cy - 2, null, 0, O.BANNER, 0); v.banner = { x: cx, y: cy - 2 };
      set(cx + 2, cy + 2, null, 0, O.WELL, 0);
      const hall = struct('hall', cx - 4, cy - 10, 8, 4); doorPath(hall); v.hall = hall;
      v.spawns.push({ k: 'chief', x: hall.door.x, y: hall.door.y + 2 });
      const stall = { x: cx - 3, y: cy + 3 }; set(stall.x, stall.y, null, 0, O.STALL, 0); v.stall = stall;
      v.spawns.push({ k: 'merchant', x: stall.x, y: stall.y + 1 });
      if (v.size >= 2) { const bk = struct('barracks', cx + 6, cy - 10, 6, 4); doorPath(bk); }
    }
    // houses: first along the roads, then scattered with little paths to the nearest road
    const nH = home ? 4 : 6 + v.size * 3;
    let placed = 0;
    const isPath = (x, y) => { const o = v.ov.get(x + ',' + y); return o && (o.g === G.PATH || o.g === G.PLAZA); };
    for (let tries = 0; tries < 260 && placed < nH; tries++) {
      const w = r.pick([4, 5, 5, 6]), h = r.pick([3, 3, 4]);
      let x, y, along = tries < 90;
      if (along) {
        const arm = arms[r.i(0, 3)], s = r.i(6, L - 3), side = r.chance(0.5) ? 1 : -1;
        if (arm[0]) { if (side > 0) continue; x = cx + arm[0] * s - (w >> 1); y = cy - h - 1; }
        else { y = cy + arm[1] * s - h; x = side < 0 ? cx - w - 1 : cx + 3; }
      } else { const a = r.r(0, Math.PI * 2), d = r.r(7, VR - 6); x = Math.round(cx + Math.cos(a) * d - w / 2); y = Math.round(cy + Math.sin(a) * d - h / 2); }
      if (!free(x, y, w, h)) continue;
      const hs = struct('house', x, y, w, h); doorPath(hs); placed++;
      // connect the door to the road network
      let px = hs.door.x, py = hs.door.y + 2;
      if (!isPath(px, py)) {
        const toward = Math.abs(px - cx) < Math.abs(py - cy) ? 'v' : 'h';
        for (let k = 0; k < 40 && !isPath(px, py); k++) {
          if (toward === 'h') { if (py === cy || isPath(px, py)) break; py += py < cy ? 1 : -1; }
          else { if (px === cx || isPath(px, py)) break; px += px < cx ? 1 : -1; }
          const key = px + ',' + py; if (used.has(key) && !isPath(px, py)) break; path(px, py);
        }
      }
      v.spawns.push({ k: 'villager', x: hs.door.x, y: hs.door.y + 2, home: v.structs.length - 1 });
    }
    // fields + pens
    for (let f = 0; f < (home ? 0 : 2); f++) {
      for (let tries = 0; tries < 30; tries++) {
        const w = r.i(5, 7), h = r.i(3, 4), x = cx + r.i(-L + 1, L - w - 1), y = cy + r.i(-L + 1, L - h - 1);
        if (!free(x - 1, y - 1, w + 2, h + 2)) continue;
        const crop = r.pick([O.WHEAT, O.WHEAT, O.CARROT, O.TOMATO, O.RICE]);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, G.TILLED, 0, crop, r.i(1, 3));
        for (let i = -1; i <= w; i++) { set(x + i, y - 1, null, 0, O.FENCE, 0); set(x + i, y + h, null, 0, i === (w >> 1) ? O.GATE : O.FENCE, 0); }
        for (let j = 0; j < h; j++) { set(x - 1, y + j, null, 0, O.FENCE, 0); set(x + w, y + j, null, 0, O.FENCE, 0); }
        mark(x - 1, y - 1, w + 2, h + 2); break;
      }
    }
    { // animal pen
      for (let tries = 0; tries < 30; tries++) {
        const w = 6, h = 4, x = cx + r.i(-L + 2, L - w - 2), y = cy + r.i(-L + 2, L - h - 2);
        if (!free(x - 1, y - 1, w + 2, h + 2)) continue;
        for (let i = -1; i <= w; i++) { set(x + i, y - 1, null, 0, O.FENCE, 0); set(x + i, y + h, null, 0, i === 2 ? O.GATE : O.FENCE, 0); }
        for (let j = 0; j < h; j++) { set(x - 1, y + j, null, 0, O.FENCE, 0); set(x + w, y + j, null, 0, O.FENCE, 0); }
        set(x + w - 1, y, null, 0, O.HAY, 0);
        const kinds = home ? ['chicken', 'chicken', 'chicken'] : [r.pick(['cow', 'sheep', 'chicken']), r.pick(['cow', 'sheep', 'chicken']), 'chicken'];
        for (let k = 0; k < kinds.length; k++) v.spawns.push({ k: kinds[k], x: x + 1 + k * 2, y: y + 2, pen: { x, y, w, h } });
        mark(x - 1, y - 1, w + 2, h + 2); break;
      }
    }
    // lanterns along roads, torii at road ends
    for (const [dx, dy] of arms) {
      for (let s = 7; s < L - 1; s += 6) { const px = cx + dx * s + (dy ? (s % 12 ? 3 : -2) : 0), py = cy + dy * s + (dx ? (s % 12 ? -2 : 3) : 0); const k = px + ',' + py; if (!used.has(k)) { set(px, py, null, 0, O.LANTERN, 0); used.add(k); } }
    }
    const end = L - 1; set(cx, cy + end, null, 0, O.TORII, 0);
    // decor
    for (let k = 0; k < 14; k++) { const x = cx + r.i(-L, L), y = cy + r.i(-L, L); const key = x + ',' + y, o = v.ov.get(key);
      if (used.has(key) || !o || o.g === G.PATH || o.g === G.PLAZA || o.b) continue; if ((x - cx) ** 2 + (y - cy) ** 2 > (VR - 4) ** 2) continue;
      set(x, y, null, 0, r.pick([O.BARREL, O.CRATE, O.FLOWERS, O.SAKURA, O.FLOWERS, O.BUSH, O.SAKURA, O.OAK]), r.i(0, 3)); used.add(key); }
    if (!home) for (let k = 0; k < 2 + v.size; k++) v.spawns.push({ k: 'guard', x: cx + r.i(-3, 3), y: cy + r.i(4, 6) });
    if (home) for (let k = 0; k < 2; k++) v.spawns.push({ k: 'villager', x: cx + r.i(-2, 2), y: cy + 5 });
    return v;
  }
  /* ---------- chunks ---------- */
  key(cx, cy) { return cx + ',' + cy; }
  chunk(cx, cy) {
    const k = cx + ',' + cy; let c = this.chunks.get(k);
    if (!c) { c = new Chunk(cx, cy); this.genChunk(c); this.chunks.set(k, c); }
    return c;
  }
  peek(cx, cy) { return this.chunks.get(cx + ',' + cy); }
  genChunk(c) {
    const x0 = c.cx * CS, y0 = c.cy * CS;
    const vs = this.villagesNear(x0 + CS / 2, y0 + CS / 2, CS);
    for (let j = 0; j < CS; j++) for (let i = 0; i < CS; i++) {
      const x = x0 + i, y = y0 + j, idx = j * CS + i;
      let t = this.base(x, y), ov = null;
      for (const v of vs) { const o = v.ov.get(x + ',' + y); if (o) { ov = o; break; } }
      if (ov) t = { g: ov.g ?? t.g, b: ov.b ?? t.b, o: ov.o ?? t.o, m: ov.m ?? t.m };
      c.g[idx] = t.g; c.b[idx] = t.b; c.o[idx] = t.o; c.m[idx] = t.m;
      if (isWater(t.g)) c.water = true;
    }
    const sv = this.saved[c.cx + ',' + c.cy];
    if (sv) for (const [idx, g, b, o, m] of sv) { c.g[idx] = g; c.b[idx] = b; c.o[idx] = o; c.m[idx] = m; c.mod.set(idx, 1); if (isWater(g)) c.water = true; }
    c.gen = true;
  }
  _at(x, y) { const cx = Math.floor(x / CS), cy = Math.floor(y / CS); return [this.chunk(cx, cy), (y - cy * CS) * CS + (x - cx * CS)]; }
  ground(x, y) { const [c, i] = this._at(x, y); return c.g[i]; }
  block(x, y) { const [c, i] = this._at(x, y); return c.b[i]; }
  obj(x, y) { const [c, i] = this._at(x, y); return c.o[i]; }
  meta(x, y) { const [c, i] = this._at(x, y); return c.m[i]; }
  set(x, y, f) { // f: {g,b,o,m}
    const [c, i] = this._at(x, y);
    const old = c.g[i], oldB = c.b[i];
    if (f.g != null) c.g[i] = f.g; if (f.b != null) c.b[i] = f.b; if (f.o != null) c.o[i] = f.o; if (f.m != null) c.m[i] = f.m;
    c.mod.set(i, 1);
    if (f.g != null && f.g !== old) { c.dirty = true; if (isWater(f.g)) c.water = true; this.dirtyNeighbours(c, i); }
    if (f.b != null && f.b !== oldB) { c.rv++; c.dirty = true; this.dirtyNeighbours(c, i, true); }
    if (this.onChange) this.onChange(x, y, f);
  }
  dirtyNeighbours(c, i, walls) {
    const lx = i % CS, ly = (i / CS) | 0, xs = [0], ys = [0];
    if (lx <= 1) xs.push(-1); if (lx >= CS - 2) xs.push(1); if (ly <= 1) ys.push(-1); if (ly >= CS - 2) ys.push(1);
    for (const dx of xs) for (const dy of ys) if (dx || dy) { const n = this.peek(c.cx + dx, c.cy + dy); if (n) { n.dirty = true; if (walls) n.rv++; } }
  }
  solid(x, y) {
    const [c, i] = this._at(x, y); if (c.b[i]) return true;
    const g = c.g[i]; if (g === G.DEEP) return true;
    const o = c.o[i]; if (o && OBJ[o] && OBJ[o].solid) { if (o === O.GATE && c.m[i] & 1) return false; return true; }
    return false;
  }
  serialize() {
    const out = {};
    for (const [k, c] of this.chunks) if (c.mod.size) { const a = []; for (const i of c.mod.keys()) a.push([i, c.g[i], c.b[i], c.o[i], c.m[i]]); out[k] = a; }
    for (const k in this.saved) if (!out[k] && !this.chunks.has(k)) out[k] = this.saved[k];
    const chests = {}; for (const [k, v] of this.chests) chests[k] = v;
    return { seed: this.seed, chunks: out, chests };
  }
  load(data) { this.saved = data.chunks || {}; for (const k in data.chests || {}) this.chests.set(k, data.chests[k]); }
  unloadFar(px, py, keep = 7) {
    const cx = Math.floor(px / CS), cy = Math.floor(py / CS);
    for (const [k, c] of this.chunks) if (Math.abs(c.cx - cx) > keep || Math.abs(c.cy - cy) > keep) {
      if (c.mod.size) { const a = []; for (const i of c.mod.keys()) a.push([i, c.g[i], c.b[i], c.o[i], c.m[i]]); this.saved[k] = a; }
      if (c.cv) { c.cv = null; c.wcv = null; }
      this.chunks.delete(k);
    }
  }
}
export { REG, VR };
