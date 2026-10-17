// Hanomi — rock & ore walls (autotiled 3/4 blocks), village buildings and placeable props.
import { Spr, mix, mul } from '../pix.js';
import { mulberry32, hash2, bayer, clamp } from '../util.js';
import { B } from '../defs.js';

export const S = {};
const put = (name, spr, ax, ay, sh, extra) => (S[name] = Object.assign({ cv: spr.canvas(), ax, ay, sh, w: spr.w, h: spr.h }, extra || {}));

/* ------------------------- walls ------------------------- */
const WALLMAT = {
  [B.STONE]: { top: [0x6e6a66, 0x7e7974, 0x8e8983, 0x9e9891], face: [0x4a4644, 0x5a5552, 0x6a6460], out: 0x2a2624 },
  [B.DARK]: { top: [0x4c4a52, 0x5a5862, 0x686672, 0x767482], face: [0x2e2c34, 0x3a3842, 0x46444e], out: 0x18161c },
  [B.COAL]: { base: B.STONE, ore: [0x1e1c1e, 0x34302e, 0x55504c] },
  [B.IRON]: { base: B.STONE, ore: [0x8a5a3a, 0xc88a5a, 0xe8b88a] },
  [B.GOLD]: { base: B.STONE, ore: [0xa8741a, 0xf2c23a, 0xfff08a] },
  [B.GEM]: { base: B.DARK, ore: [0x1a7a5a, 0x3ad8a0, 0xb0ffe0] },
  [B.WOODWALL]: { top: [0x7a5032, 0x8c5e3a, 0x9e6c44, 0xb07c50], face: [0x5a3820, 0x6b4428, 0x7c5030], out: 0x2a180e, wood: 1 },
  [B.STONEWALL]: { top: [0x8a8a8e, 0x9a9a9e, 0xaaaaae, 0xbcbcc0], face: [0x5a5a62, 0x6a6a72, 0x7a7a82], out: 0x26262c, brick: 1 },
};
function wallSprite(id, mask, v) {
  const mat = WALLMAT[id], base = mat.base ? WALLMAT[mat.base] : mat, s = new Spr(16, 24), r = mulberry32(id * 100 + mask * 7 + v);
  const N = mask & 1, E = mask & 2, So = mask & 4, Wt = mask & 8;
  const T = base.top, F = base.face;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let q;
    if (base.wood) { q = ((y + (x >> 3) * 2) % 5 === 0) ? 0 : (hash2(x >> 2, y, v) < 0.3 ? 1 : 2); if (x % 8 === 0) q = 1; }
    else if (base.brick) { const row = y >> 2, off = (row & 1) * 4; q = (y % 4 === 3 || (x + off) % 8 === 7) ? 0 : (y % 4 === 0 ? 3 : 2); }
    else { const n = hash2((x + v * 5) >> 2, (y + v * 3) >> 2, id) * 0.5 + hash2(x, y, id + v) * 0.3; q = clamp(Math.floor(n * 4 + bayer(x, y) * 0.6), 0, 3); }
    if (!N && y === 0) q = -1; else if (!N && y === 1) q = 3;
    if (!Wt && x === 0) q = -1; else if (!Wt && x === 1 && q >= 0) q = Math.min(3, q + 1);
    if (!E && x === 15) q = -1; else if (!E && x === 14 && q >= 0) q = Math.max(0, q - 1);
    if (!So && y === 15) q = Math.max(0, (q < 0 ? 0 : q) - 1);
    s.set(x, y, q < 0 ? base.out : T[q]);
  }
  // cracks on natural rock tops
  if (!base.wood && !base.brick) for (let k = 0; k < 2; k++) { let x = 3 + r() * 10 | 0, y = 3 + r() * 8 | 0; for (let j = 0; j < 3 + r() * 3; j++) { s.set(x, y, T[0]); x += r() < 0.5 ? 1 : -1; y += r() < 0.6 ? 1 : 0; } }
  if (!So) {
    for (let y = 16; y < 24; y++) for (let x = 0; x < 16; x++) {
      let q;
      if (base.wood) q = (x % 4 === 0) ? 0 : (x % 4 === 1 ? 2 : 1);
      else if (base.brick) { const off = (((y - 16) >> 2) & 1) * 4; q = ((y - 16) % 4 === 3 || (x + off) % 8 === 7) ? 0 : 1 + ((y - 16) % 4 === 0 ? 1 : 0); }
      else { q = (y === 16) ? 2 : clamp(Math.floor(hash2(x >> 1, y, id + 9 + v) * 2.4 + (y > 20 ? -0.6 : 0.3)), 0, 2); if (hash2(x, y >> 2, v + 3) < 0.15) q = 0; }
      if (y === 23) q = -1;
      if ((!Wt && x === 0) || (!E && x === 15)) q = -1;
      s.set(x, y, q < 0 ? base.out : F[q]);
    }
  }
  if (mat.ore) {
    const O = mat.ore, nOre = 3 + (v & 1);
    for (let k = 0; k < nOre; k++) {
      const x = 3 + r() * 10 | 0, y = 3 + r() * (So ? 10 : 15) | 0, big = r() < 0.4;
      if (id === B.GEM) { s.line(x, y + 2, x, y - 2, O[1]); s.set(x, y - 2, O[2]); s.set(x + 1, y, O[0]); s.set(x - 1, y + 1, O[1]); s.set(x + 1, y + 1, O[0]); }
      else { s.set(x, y, O[1]); s.set(x + 1, y, O[0]); s.set(x, y + 1, O[0]); s.set(x - 1, y, O[2]); if (big) { s.set(x + 1, y + 1, O[1]); s.set(x, y - 1, O[2]); } }
    }
  }
  return s;
}
function cracks(stage) {
  const s = new Spr(16, 16), r = mulberry32(50 + stage);
  for (let k = 0; k < stage * 2 + 1; k++) { let x = 8 + (r() - 0.5) * 6, y = 8 + (r() - 0.5) * 6; const a = r() * Math.PI * 2;
    for (let j = 0; j < 3 + stage * 2; j++) { s.set(x, y, 0x161412, 220); x += Math.cos(a) + (r() - 0.5); y += Math.sin(a) + (r() - 0.5); } }
  return s;
}

/* ------------------------- buildings ------------------------- */
const ROOFS = [
  { tile: [0x2a3446, 0x3a465c, 0x4c5a72, 0x62718a], ridge: 0x1e2534 },        // slate kawara
  { tile: [0x8a6a2a, 0xa8843a, 0xc49e4a, 0xdcb862], ridge: 0x6a4e1e, thatch: 1 }, // thatch
  { tile: [0x7a2e22, 0x963a2a, 0xb24e36, 0xc8664a], ridge: 0x52201a },        // terracotta
  { tile: [0x2a5a52, 0x347066, 0x40867a, 0x58a092], ridge: 0x1e4038 },        // copper green
];
const WOOD = [0x3e2618, 0x56361f, 0x6e4628, 0x8a5a34];
const PLASTER = [0xcfc2a6, 0xe2d6bc, 0xf0e8d2];
function house(w, h, style, opt = {}) {
  const W = w * 16, Hf = h * 16, eave = 5, rise = opt.hall ? 30 : 20, SW = W + eave * 2, SH = Hf + rise;
  const s = new Spr(SW, SH), R = ROOFS[style % ROOFS.length], r = mulberry32(w * 31 + h * 7 + style * 3 + (opt.hall ? 99 : 0));
  const wallH = opt.hall ? 30 : 24, wallTop = SH - wallH, ox = eave;
  const lights = [];
  // --- front wall ---
  for (let y = wallTop; y < SH; y++) for (let x = ox; x < ox + W; x++) {
    const ly = y - wallTop, lx = x - ox; let c;
    if (ly >= wallH - 3) c = ly === wallH - 1 ? 0x3a3634 : (hash2(lx >> 2, ly, 5) < 0.5 ? 0x7a7672 : 0x8e8a84);
    else if (style === 1 && !opt.hall) c = WOOD[(lx % 5 === 0) ? 1 : (lx % 5 === 4 ? 2 : 3)];
    else { c = PLASTER[ly < 3 ? 0 : (hash2(lx, ly, 6) < 0.08 ? 0 : 1)]; if (ly > wallH - 9) c = WOOD[2 + ((lx % 6 === 0) ? -1 : 0)]; }
    s.set(x, y, c);
  }
  // posts and beams
  const posts = [0, W - 3]; for (let px = 48; px < W - 20; px += 48) posts.push(px);
  for (const px of posts) for (let y = wallTop; y < SH - 3; y++) { s.set(ox + px, y, WOOD[0]); s.set(ox + px + 1, y, opt.hall ? 0xa8302a : WOOD[1]); s.set(ox + px + 2, y, opt.hall ? 0x861e1e : WOOD[0]); }
  for (let x = ox; x < ox + W; x++) { s.set(x, wallTop + 2, WOOD[1]); s.set(x, wallTop + 3, WOOD[0]); }
  // door
  const dx = ox + (opt.door != null ? opt.door : (w >> 1)) * 16 + 2, dw = 12, dTop = SH - 3 - (opt.hall ? 22 : 17);
  for (let y = dTop; y < SH - 3; y++) for (let x = dx; x < dx + dw; x++) { const lx = x - dx; s.set(x, y, lx === 0 || lx === dw - 1 ? WOOD[0] : (lx === 6 ? WOOD[1] : (y - dTop) % 4 === 0 ? WOOD[1] : WOOD[2])); }
  // noren curtain in clan colour
  const nc = opt.color != null ? opt.color : 0x2a4a7a, nd = mul(nc, 0.7);
  for (let y = dTop; y < dTop + 7; y++) for (let x = dx; x < dx + dw; x++) { const lx = x - dx; if (lx % 4 === 3 && y > dTop + 2) continue; s.set(x, y, y === dTop ? nd : nc); }
  s.set(dx + 5, dTop + 3, 0xf0e8d2); s.set(dx + 6, dTop + 3, 0xf0e8d2); s.set(dx + 5, dTop + 4, 0xf0e8d2);
  // windows (shoji)
  const wins = [];
  for (let k = 0; k < w; k++) { const wx = ox + k * 16 + 3; if (Math.abs(wx - dx) < 16) continue; if (r() < 0.25 && w > 3) continue; wins.push(wx); }
  for (const wx of wins) {
    const wy = wallTop + 6, ww = 10, wh = opt.hall ? 10 : 8;
    for (let y = wy - 1; y <= wy + wh; y++) for (let x = wx - 1; x <= wx + ww; x++) {
      const ex = x === wx - 1 || x === wx + ww || y === wy - 1 || y === wy + wh;
      s.set(x, y, ex ? WOOD[0] : ((x - wx) % 3 === 2 || (y - wy) % 3 === 2) ? WOOD[2] : 0xf4ead0);
    }
    lights.push({ x: wx, y: wy, w: ww, h: wh });
  }
  // --- roof ---
  const roofBot = wallTop + 3, ridgeY = 4, inset = Math.min(18, W * 0.22);
  for (let y = 0; y <= roofBot; y++) {
    const f = y / roofBot; // 0 at ridge … 1 at eave
    const halfTop = SW / 2 - inset, xl = Math.round(SW / 2 - (halfTop + (SW / 2 - halfTop) * f)), xr = SW - 1 - (xl - 0);
    for (let x = xl; x <= xr; x++) {
      const lx = x - xl, rx = xr - x, side = Math.min(lx, rx) < 3 + f * 2;
      let q;
      if (R.thatch) { q = (hash2(x >> 1, y, 3) < 0.35 ? 1 : 2) + ((x + (y >> 1)) % 5 === 0 ? 1 : 0); if (y % 6 === 5) q = 0; }
      else { const row = Math.floor((y - ridgeY) / 3); q = ((y - ridgeY) % 3 === 2) ? 0 : ((x + row * 2) % 4 === 0 ? 1 : 2 + ((y - ridgeY) % 3 === 0 ? 1 : 0)); }
      if (side) q = Math.max(0, q - 1);
      if (y >= roofBot - 1) q = 0;
      if (y < ridgeY) q = -1;
      s.set(x, y, q < 0 ? R.ridge : R.tile[clamp(q, 0, 3)]);
    }
  }
  // ridge cap with upturned ends
  const rl = Math.round(inset) - 1, rr = SW - Math.round(inset);
  for (let x = rl; x <= rr; x++) { s.set(x, 1, R.ridge); s.set(x, 2, mix(R.tile[3], 0xffffff, 0.15)); s.set(x, 3, R.ridge); }
  s.set(rl - 1, 0, R.ridge); s.set(rl - 2, -0, R.ridge); s.set(rr + 1, 0, R.ridge); s.set(rr + 2, 0, R.ridge);
  if (!R.thatch) { // irimoya gable: a timber-framed triangle under the ridge
    const gy1 = Math.round(roofBot * 0.5), gw = Math.min(W * 0.2, 22);
    for (let y = 4; y <= gy1; y++) { const f = (y - 4) / (gy1 - 4), hw = gw * f; for (let x = Math.round(SW / 2 - hw); x <= Math.round(SW / 2 + hw); x++) {
      const edge = Math.abs(x - SW / 2) > hw - 1.5 || y === gy1; s.set(x, y, edge ? WOOD[0] : (y === gy1 - 1 ? mul(PLASTER[0], 0.8) : ((x + y) % 4 === 0 && y > gy1 - 6 ? WOOD[1] : PLASTER[1]))); } }
    for (let x = Math.round(SW / 2 - gw - 2); x <= Math.round(SW / 2 + gw + 2); x++) { s.set(x, gy1 + 1, R.ridge); s.set(x, gy1 + 2, mul(R.tile[0], 0.8)); }
  }
  if (opt.hall) { s.rect(SW / 2 - 3, 0, 6, 3, 0xd8a83a); s.set(SW / 2 - 1, 0, 0xfff08a); }
  // eave shadow on the wall
  for (let x = ox; x < ox + W; x++) for (let k = 1; k <= 3; k++) { const y = roofBot + k; const c = s.hex(x, y); if (s.has(x, y)) s.set(x, y, mul(c, 0.62 + k * 0.08)); }
  // lantern by the door
  const lx = dx + dw + 2, ly = dTop + 1;
  s.rect(lx, ly - 1, 4, 1, WOOD[0]); s.ell(lx + 2, ly + 3, 2.5, 3.2, (u, v) => v < -0.4 ? 0xff8a6a : 0xd8382e); s.rect(lx + 1, ly + 6, 2, 1, WOOD[0]);
  lights.push({ x: lx - 1, y: ly, w: 6, h: 7, lantern: 1 });
  // outline
  s.outline(0x1c1412);
  return { s, ax: eave, ay: SH, lights };
}
function koiPond() { // 7x5 tiles footprint; base (rim + water). koi + pads drawn live
  const W = 112, H = 80 + 6, s = new Spr(W, H), r = mulberry32(77);
  const cx = W / 2, cy = 42, rx = 50, ry = 33;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = Math.pow(Math.abs(u), 2.6) + Math.pow(Math.abs(v), 2.6) + (hash2(x >> 2, y >> 2, 3) - 0.5) * 0.08;
    if (d < 0.78) { const dep = 1 - d / 0.78; const q = clamp(Math.floor(dep * 4 + bayer(x, y) * 0.8), 0, 4); s.set(x, y, [0x6ec6c2, 0x4aa8b4, 0x3a8aa6, 0x2e7096, 0x285c86][q]); if (v < -0.55 && d > 0.62) s.set(x, y, 0x3a2a1e); }
  }
  // stone rim
  for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2, rr = 0.86 + r() * 0.06;
    const x = cx + Math.cos(a) * rx * rr, y = cy + Math.sin(a) * ry * rr, sz = 3.2 + r() * 2.4, g = 120 + r() * 50 | 0, base = (g << 16) | ((g - 4) << 8) | (g - 10);
    s.ell(x, y, sz * 1.2, sz, (u, v, px, py) => { const l = 0.6 - u * 0.3 - v * 0.6; return l > 0.75 ? mix(base, 0xffffff, 0.25) : l > 0.4 ? base : mul(base, 0.72); }); }
  s.outline(0x2a2624);
  return s;
}
function torii() {
  const s = new Spr(56, 46), Rd = [0x9a2018, 0xc8302a, 0xe85040], Bk = 0x2a1a18;
  s.rect(9, 12, 5, 34, x => x === 9 ? Rd[2] : x === 13 ? Rd[0] : Rd[1]); s.rect(42, 12, 5, 34, x => x === 42 ? Rd[2] : x === 46 ? Rd[0] : Rd[1]);
  s.rect(9, 42, 5, 4, Bk); s.rect(42, 42, 5, 4, Bk);
  s.rect(5, 16, 46, 4, (x, y) => y === 16 ? Rd[2] : Rd[1]); // nuki
  for (let x = 0; x < 56; x++) { const lift = Math.round(Math.pow(Math.abs(x - 27.5) / 28, 3) * 4); s.set(x, 6 - lift, Bk); s.set(x, 7 - lift, Bk); for (let y = 8 - lift; y < 11 - lift + 1; y++) s.set(x, y, y === 8 - lift ? Rd[2] : Rd[1]); }
  s.rect(25, 10, 6, 7, (x, y) => (x === 25 || x === 30 || y === 10 || y === 16) ? Bk : 0xe8c86a);
  s.outline(0x1a0e0c); return s;
}
function lanternStone() {
  const s = new Spr(16, 30), St = [0x6a6660, 0x8a857e, 0xa8a29a, 0xc4beb4];
  s.rect(4, 26, 8, 3, x => St[x < 7 ? 2 : 1]); s.rect(6, 17, 4, 9, x => St[x < 8 ? 2 : 1]);
  s.rect(3, 15, 10, 2, St[1]); s.rect(4, 9, 8, 6, (x, y) => (x === 4 || x === 11 || y === 9) ? St[1] : 0xffd27a);
  s.set(7, 11, 0xfff2c0); s.set(8, 11, 0xfff2c0); s.set(7, 12, 0xffe08a);
  s.poly([[1, 9], [15, 9], [11, 5], [5, 5]], (x, y) => y > 7 ? St[0] : St[2]); s.rect(7, 2, 2, 3, St[2]); s.set(7, 1, St[3]);
  s.outline(0x2a2624); return { s, light: { x: 4, y: 9, w: 8, h: 6 } };
}
function torch(f) {
  const s = new Spr(8, 18); s.rect(3, 8, 2, 10, x => x === 3 ? 0x8a5a34 : 0x5a3820); s.rect(2, 7, 4, 2, 0x3a2418);
  const h = [6, 7, 5][f]; s.ell(4, 7 - h / 2, 2.2, h / 2 + 0.5, (u, v) => v < -0.3 ? 0xfff2a0 : v < 0.2 ? 0xffc23a : 0xe8602a); s.set(4 + (f === 1 ? 1 : -1 * (f === 2)), 6 - h, 0xffe08a);
  s.outline(c => (c === 0x8a5a34 || c === 0x5a3820 || c === 0x3a2418) ? 0x1e140e : null); return s;
}
function campfire(f) {
  const s = new Spr(20, 20);
  s.stroke(3, 17, 17, 14, 3, 3, 0x6b4428); s.stroke(3, 14, 17, 17, 3, 3, 0x8a5a34);
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; s.ell(10 + Math.cos(a) * 8, 16 + Math.sin(a) * 3, 1.6, 1.3, 0x7a7672); }
  if (f >= 0) { const hh = [9, 11, 8, 10][f]; s.ell(10, 15 - hh / 2, 4, hh / 2, (u, v) => v < -0.4 ? 0xfff2a0 : v < 0.1 ? 0xffb02a : 0xe8502a); s.ell(10 + (f % 2 ? 2 : -2), 10 - hh / 3, 1.6, 2.4, 0xffd04a); }
  s.outline(0x1e140e); return s;
}
function chest(open) {
  const s = new Spr(16, 15); s.rect(1, 5, 14, 9, (x, y) => (x === 1 || x === 14 || y === 13) ? 0x5a3820 : (y === 8 ? 0x3e2618 : (x % 5 === 0 ? 0x7a4e2c : 0x9a6a3c)));
  if (open) s.rect(1, 1, 14, 5, (x, y) => y === 1 ? 0x5a3820 : 0x2a180e); else s.rect(1, 2, 14, 4, (x, y) => y === 2 ? 0xb07c48 : 0x8a5a34);
  s.rect(7, 6, 2, 3, 0xe8c040); s.rect(3, 2, 1, 12, 0x6a6a72); s.rect(12, 2, 1, 12, 0x6a6a72); s.outline(0x1e140e); return s;
}
function bench() {
  const s = new Spr(20, 18); s.rect(1, 4, 18, 5, (x, y) => y === 4 ? 0xc89458 : y === 8 ? 0x6b4428 : 0xa87444); s.rect(2, 9, 2, 8, 0x6b4428); s.rect(16, 9, 2, 8, 0x6b4428);
  s.rect(5, 1, 6, 3, 0x9a9aa2); s.set(5, 1, 0xd8d8e0); s.rect(13, 2, 1, 3, 0x8a5a34); s.rect(12, 1, 3, 1, 0x7a7a82); s.rect(6, 10, 9, 2, 0x8a5a34); s.outline(0x1e140e); return s;
}
function furnace(f) {
  const s = new Spr(18, 22), St = [0x5a5652, 0x7a7672, 0x9a958e];
  s.rect(1, 3, 16, 18, (x, y) => (hash2(x >> 1, y >> 1, 2) < 0.3 ? St[0] : (x < 6 ? St[2] : St[1])));
  for (let y = 3; y < 21; y += 4) for (let x = 1; x < 17; x++) s.set(x, y, St[0]);
  s.rect(5, 11, 8, 7, f >= 0 ? (x, y) => y < 13 ? 0x3a1a10 : ((x + y + f) % 3 === 0 ? 0xffd04a : 0xe8602a) : 0x1a1414);
  s.rect(6, 0, 6, 3, St[1]); s.outline(0x1e1a18); return s;
}
function anvil() { const s = new Spr(18, 12); s.rect(2, 2, 14, 3, (x, y) => y === 2 ? 0x9a9aa6 : 0x5a5a66); s.rect(0, 3, 3, 1, 0x5a5a66); s.rect(6, 5, 6, 3, 0x4a4a54); s.rect(4, 8, 10, 3, 0x3a3a44); s.outline(0x141418); return s; }
function bed() { const s = new Spr(16, 26); s.rect(1, 1, 14, 24, 0x6b4428); s.rect(2, 2, 12, 6, 0xf2ecde); s.rect(2, 8, 12, 15, (x, y) => (y === 8 ? 0xe86a6a : (x + y) % 6 === 0 ? 0xa8343a : 0xc8424a)); s.outline(0x1e140e); return s; }
function fence(mask) { // N1 E2 S4 W8
  const s = new Spr(16, 20), P = [0x5a3820, 0x8a5a34, 0xb07c48];
  s.rect(6, 4, 4, 14, x => x === 6 ? P[2] : x === 9 ? P[0] : P[1]); s.rect(6, 3, 4, 1, P[2]);
  const rail = (x0, x1) => { for (const y of [8, 13]) { s.rect(x0, y, x1 - x0, 2, (x, yy) => yy === y ? P[2] : P[1]); } };
  if (mask & 2) rail(10, 16); if (mask & 8) rail(0, 6);
  if (mask & 4) s.rect(7, 18, 2, 2, P[1]); if (mask & 1) s.rect(7, 0, 2, 4, P[1]);
  s.outline(0x2a180e); return s;
}
function gate(open) { const s = new Spr(16, 20), P = [0x5a3820, 0x8a5a34, 0xb07c48]; s.rect(0, 4, 3, 14, P[1]); s.rect(13, 4, 3, 14, P[1]);
  if (!open) { s.rect(3, 7, 10, 2, P[2]); s.rect(3, 13, 10, 2, P[2]); s.line(3, 14, 12, 8, P[0]); } else { s.rect(3, 6, 2, 10, P[2]); }
  s.outline(0x2a180e); return s; }
function scarecrow() { const s = new Spr(18, 30); s.rect(8, 8, 2, 22, 0x6b4428); s.rect(1, 12, 16, 2, 0x6b4428); s.rect(5, 12, 8, 9, (x, y) => (x + y) % 4 ? 0x4a6aa8 : 0x3a5288); s.ell(9, 7, 4, 4, 0xe8d090); s.set(7, 7, 0x2a1a12); s.set(10, 7, 0x2a1a12); s.poly([[2, 5], [16, 5], [12, 1], [6, 1]], 0xd8b850); s.rect(1, 13, 3, 2, 0xd8b850); s.rect(14, 13, 3, 2, 0xd8b850); s.outline(0x1e140e); return s; }
function sign() { const s = new Spr(16, 18); s.rect(7, 9, 2, 9, 0x6b4428); s.rect(1, 2, 14, 8, (x, y) => (y === 2 ? 0xc89458 : 0xa87444)); s.rect(3, 5, 9, 1, 0x6b4428); s.rect(3, 7, 7, 1, 0x6b4428); s.outline(0x1e140e); return s; }
function banner(col, f) {
  const s = new Spr(20, 44); s.rect(2, 2, 2, 42, x => x === 2 ? 0xc8a070 : 0x8a5a34); s.ell(3, 2, 2, 2, 0xe8c040);
  const d = mul(col, 0.7), l = mix(col, 0xffffff, 0.3);
  for (let y = 5; y < 26; y++) for (let x = 4; x < 18; x++) { const wave = Math.round(Math.sin((x - 4) * 0.5 + f * 1.57) * 1.2 * ((x - 4) / 14)); const yy = y + wave; if (y > 22 && (x - 4) % 5 === 2 && y > 24) continue; s.set(x, yy, y < 7 ? d : ((x - 4) < 2 ? l : col)); }
  s.ell(11, 14, 3, 3, 0xf6eedc); s.ell(11, 14, 1.4, 1.4, col);
  s.outline(0x1e1412); return s;
}
function well() { const s = new Spr(28, 34), St = [0x6a6660, 0x8a857e, 0xa8a29a];
  s.ell(14, 26, 12, 7, (u, v) => v < -0.3 ? 0x2a4a5a : (v < 0 ? St[0] : u < -0.2 ? St[2] : St[1])); s.ell(14, 23, 9, 4, 0x1e3440); s.ell(14, 22.5, 7, 2.5, 0x3a7a90);
  s.rect(3, 6, 2, 20, 0x6b4428); s.rect(23, 6, 2, 20, 0x6b4428); s.poly([[0, 8], [28, 8], [22, 0], [6, 0]], (x, y) => y > 6 ? 0x2a3446 : ((x + y) % 4 ? 0x4c5a72 : 0x3a465c)); s.rect(13, 8, 2, 8, 0x8a8a8a); s.rect(11, 15, 6, 4, 0x8a5a34);
  s.outline(0x1e1a18); return s; }
function barrel() { const s = new Spr(14, 16); s.ell(7, 9, 6, 7, (u) => u < -0.3 ? 0xa87444 : u < 0.3 ? 0x8a5a34 : 0x6b4428); s.rect(1, 5, 12, 1, 0x5a5a62); s.rect(1, 12, 12, 1, 0x5a5a62); s.ell(7, 3, 5, 2, 0x6b4428); s.outline(0x1e140e); return s; }
function crate() { const s = new Spr(16, 16); s.rect(1, 3, 14, 12, (x, y) => (x === 1 || x === 14 || y === 3 || y === 14 || x === y || x === 15 - y + 3) ? 0x6b4428 : 0xb08050); s.rect(1, 1, 14, 2, 0xc89458); s.outline(0x1e140e); return s; }
function hay() { const s = new Spr(20, 16); s.ell(10, 9, 9, 6.5, (u, v, x, y) => (hash2(x, y, 4) < 0.3 ? 0xb8962a : v < -0.3 ? 0xf2d870 : 0xd8b848)); s.outline(0x5a4410); return s; }
function stall(col) { const s = new Spr(36, 34), d = mul(col, 0.7);
  s.rect(3, 10, 2, 22, 0x6b4428); s.rect(31, 10, 2, 22, 0x6b4428); s.rect(1, 18, 34, 8, (x, y) => y === 18 ? 0xc89458 : 0x8a5a34);
  for (let k = 0; k < 6; k++) { const c = [0xe8433a, 0xf2c24a, 0x8ac85a, 0xf07a22, 0xd8b848, 0x6a4ab8][k]; s.ell(5 + k * 5, 17, 2, 1.6, c); }
  for (let x = 0; x < 36; x++) for (let y = 2; y < 11; y++) s.set(x, y, ((x >> 2) & 1) ? col : 0xf6eedc); for (let x = 0; x < 36; x += 4) { s.set(x + 1, 11, (x >> 2) & 1 ? d : 0xd8d0c0); s.set(x + 2, 11, (x >> 2) & 1 ? d : 0xd8d0c0); }
  for (let x = 0; x < 36; x++) s.set(x, 2, d); s.outline(0x1e140e); return s; }
function satchel() { const s = new Spr(14, 12); s.ell(7, 7, 6, 4.5, (u, v) => v < -0.3 ? 0xb08050 : 0x8a5a34); s.rect(5, 1, 4, 3, 0x6b4428); s.set(7, 6, 0xe8c040); s.outline(0x1e140e); return s; }
function spikes() { const s = new Spr(16, 12); s.rect(1, 8, 14, 3, 0x6b4428); for (let k = 0; k < 4; k++) { s.line(3 + k * 3, 8, 3 + k * 3, 1 + (k & 1), 0xc8c8d0); s.set(3 + k * 3, 1 + (k & 1), 0xffffff); } s.outline(0x1e140e); return s; }
function tower() { const s = new Spr(32, 60); const P = [0x5a3820, 0x8a5a34, 0xb07c48];
  for (const x of [5, 25]) s.rect(x, 18, 3, 42, (xx) => xx === x ? P[2] : P[1]);
  for (let y = 26; y < 58; y += 10) { s.line(6, y, 26, y + 8, P[0]); s.line(26, y, 6, y + 8, P[0]); }
  s.rect(1, 12, 30, 8, (x, y) => (y === 12 ? P[2] : (x % 4 === 0 ? P[0] : P[1]))); s.rect(4, 4, 2, 8, P[1]); s.rect(26, 4, 2, 8, P[1]);
  s.poly([[0, 6], [32, 6], [24, 0], [8, 0]], (x, y) => (x + y) % 3 ? 0xa8843a : 0x8a6a2a); s.outline(0x1e140e); return s; }
function pot(f) { const s = new Spr(18, 18); s.ell(9, 11, 7, 5, (u) => u < -0.3 ? 0x5a5a62 : 0x3a3a42); s.ell(9, 8, 6, 2, 0xc8783a); s.set(7, 8, 0xe8a85a); s.rect(2, 15, 3, 2, 0x7a7672); s.rect(13, 15, 3, 2, 0x7a7672);
  if (f >= 0) s.ell(9, 16.5, 4, 1.5, f % 2 ? 0xffb02a : 0xe8602a); s.outline(0x141418); return s; }

export function bakeStructures(nationColors) {
  if (0) for (const id of [B.STONE, B.DARK, B.COAL, B.IRON, B.GOLD, B.GEM, B.WOODWALL, B.STONEWALL])
    for (let m = 0; m < 16; m++) for (let v = 0; v < 2; v++) put(`w${id}_${m}_${v}`, wallSprite(id, m, v), 0, 0);
  for (let k = 1; k <= 3; k++) put('crack' + k, cracks(k), 0, 0);
  put('torii', torii(), 28, 45, [0, 0]);
  { const l = lanternStone(); put('lantern', l.s, 8, 29, [6, 2], { lights: [l.light] }); }
  for (let f = 0; f < 3; f++) put('torch' + f, torch(f), 4, 17);
  for (let f = -1; f < 4; f++) put('fire' + f, campfire(f), 10, 18, [8, 3]);
  put('chest', chest(0), 8, 14, [7, 2]); put('chestopen', chest(1), 8, 14, [7, 2]);
  put('bench', bench(), 10, 17, [9, 2]); put('anvil', anvil(), 9, 11, [8, 2]); put('bed', bed(), 8, 25, [7, 2]);
  for (let f = -1; f < 3; f++) put('furnace' + f, furnace(f), 9, 21, [8, 2]);
  for (let m = 0; m < 16; m++) put('fence' + m, fence(m), 8, 18);
  put('gate0', gate(0), 8, 18); put('gate1', gate(1), 8, 18);
  put('scarecrow', scarecrow(), 9, 29, [5, 2]); put('sign', sign(), 8, 17, [5, 2]);
  put('well', well(), 14, 33, [12, 4]); put('barrel', barrel(), 7, 15, [6, 2]); put('crate', crate(), 8, 15, [7, 2]); put('hay', hay(), 10, 15, [9, 2]);
  put('satchel', satchel(), 7, 11); put('spikes', spikes(), 8, 11); put('tower', tower(), 16, 59, [14, 4]);
  for (let f = -1; f < 2; f++) put('pot' + f, pot(f), 9, 17, [7, 2]);
  put('koipond', koiPond(), 0, 0);
  return S;
}
// lazily baked per colour
export function bannerSprite(col) { const k = 'banner_' + col; if (!S[k]) for (let f = 0; f < 4; f++) put('banner_' + col + '_' + f, banner(col, f), 3, 43, [4, 2]), S[k] = 1; return [0, 1, 2, 3].map(f => S['banner_' + col + '_' + f]); }
export function stallSprite(col) { const k = 'stall_' + col; if (!S[k]) put(k, stall(col), 18, 32, [16, 3]); return S[k]; }
export function houseSprite(w, h, style, opt) {
  const k = `house_${w}_${h}_${style}_${opt.hall ? 1 : 0}_${opt.door}_${opt.color}`;
  if (!S[k]) { const o = house(w, h, style, opt); put(k, o.s, o.ax, o.ay, null, { lights: o.lights }); }
  return S[k];
}
