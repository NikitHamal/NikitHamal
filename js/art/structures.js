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
  { tile: [0x7a5a26, 0x9a7a36, 0xbc9a4a, 0xd8ba66], ridge: 0x5a4018, thatch: 1 }, // thatch
  { tile: [0x7a2e22, 0x963a2a, 0xb24e36, 0xc8664a], ridge: 0x52201a },        // terracotta
  { tile: [0x2a5a52, 0x347066, 0x40867a, 0x58a092], ridge: 0x1e4038 },        // copper green
];
const WOOD = [0x3e2618, 0x56361f, 0x6e4628, 0x8a5a34];
const PLASTER = [0xcfc2a6, 0xe2d6bc, 0xf0e8d2];
function house(w, h, style, opt = {}) {
  const W = w * 16, Hf = h * 16, eave = 7, rise = opt.hall ? 34 : 24, SW = W + eave * 2, SH = Hf + rise;
  const s = new Spr(SW, SH), R = ROOFS[style % ROOFS.length], r = mulberry32(w * 31 + h * 7 + style * 3 + (opt.hall ? 99 : 0));
  const wallH = opt.hall ? 42 : 34, wallTop = SH - wallH, ox = eave, lights = [];
  const Wd = opt.hall ? [0x4a1a16, 0x7a2420, 0xa8302a, 0xc8483a] : [0x3a2416, 0x543420, 0x6e4628, 0x8c5c36];
  const T = R.tile, thatch = !!R.thatch;
  // ---------- stone foundation + engawa (veranda) ----------
  for (let x = ox - 2; x < ox + W + 2; x++) for (let y = SH - 4; y < SH; y++) { const c = ((x >> 2) + (y > SH - 3 ? 1 : 0)) % 3 === 0 ? 0x8a8478 : 0x9e988a; s.set(x, y, y === SH - 1 ? 0x4a4640 : y === SH - 4 ? 0xb8b2a4 : c); }
  for (let x = ox - 2; x < ox + W + 2; x++) for (let y = SH - 8; y < SH - 4; y++) s.set(x, y, y === SH - 8 ? 0xc89a62 : y === SH - 5 ? Wd[0] : ((x + (y & 1) * 5) % 9 === 0 ? Wd[1] : 0xa47448));
  // ---------- walls ----------
  const wy0 = wallTop + 2, wy1 = SH - 8;
  for (let y = wy0; y < wy1; y++) for (let x = ox; x < ox + W; x++) {
    const ly = y - wy0, lower = ly > (wy1 - wy0) * 0.58; let c;
    if (thatch && !opt.hall) c = lower ? Wd[(x % 4 === 0) ? 1 : 2] : ((x % 5 === 0) ? Wd[1] : (ly % 6 === 0 ? Wd[2] : Wd[3]));
    else c = lower ? ((x % 4 === 0) ? Wd[1] : Wd[2]) : (hash2(x, y, 6) < 0.06 ? 0xe2d6bc : 0xf2ead6);
    if (!lower && ly === 0) c = 0xd8ccb2;
    s.set(x, y, c);
  }
  // beams
  for (let x = ox; x < ox + W; x++) { s.set(x, wy0, Wd[1]); s.set(x, wy0 + 1, Wd[0]); const mid = wy0 + Math.round((wy1 - wy0) * 0.58); s.set(x, mid, Wd[3]); s.set(x, mid + 1, Wd[1]); }
  // pillars standing on the veranda
  const posts = [ox - 1, ox + W - 2]; for (let px = ox + 32; px < ox + W - 20; px += 32) posts.push(px);
  for (const px of posts) for (let y = wallTop - 1; y < SH - 5; y++) { s.set(px, y, Wd[3]); s.set(px + 1, y, Wd[2]); s.set(px + 2, y, Wd[0]); }
  // door (sliding) with noren
  const dcol = opt.door != null ? opt.door : (w >> 1), dx = ox + dcol * 16 + 1, dw = 14, dTop = wy0 + 3;
  for (let y = dTop; y < wy1; y++) for (let x = dx; x < dx + dw; x++) { const lx = x - dx, ly = y - dTop; s.set(x, y, lx === 0 || lx === dw - 1 || lx === 7 ? Wd[0] : (ly % 5 === 4 ? Wd[1] : (lx < 7 ? Wd[2] : Wd[3]))); }
  const nc = opt.color != null ? opt.color : 0x2a4a7a, nd = mul(nc, 0.7), nl = mix(nc, 0xffffff, 0.25);
  for (let y = dTop; y < dTop + 8; y++) for (let x = dx; x < dx + dw; x++) { const lx = x - dx; if ((lx === 4 || lx === 9) && y > dTop + 2) continue; s.set(x, y, y === dTop ? nd : (lx % 5 === 0 ? nl : nc)); }
  s.set(dx + 6, dTop + 3, 0xf6eedc); s.set(dx + 7, dTop + 3, 0xf6eedc); s.set(dx + 6, dTop + 4, 0xf6eedc); s.set(dx + 7, dTop + 5, 0xf6eedc);
  // shoji windows / lattice windows
  for (let k = 0; k < w; k++) { const wx = ox + k * 16 + 3; if (wx + 11 > dx - 2 && wx < dx + dw + 2) continue; if (r() < 0.2 && w > 3) continue;
    const wyy = wy0 + 5, ww = 10, wh = opt.hall ? 13 : 10, lattice = !thatch && r() < 0.4;
    for (let y = wyy - 1; y <= wyy + wh; y++) for (let x = wx - 1; x <= wx + ww; x++) { const ex = x === wx - 1 || x === wx + ww || y === wyy - 1 || y === wyy + wh;
      s.set(x, y, ex ? Wd[0] : lattice ? ((x - wx) % 2 === 0 ? Wd[2] : 0x2a2018) : ((x - wx) % 3 === 2 || (y - wyy) % 3 === 2) ? Wd[2] : (y - wyy < 2 ? 0xfff6dc : 0xf2e6c8)); }
    if (!lattice) lights.push({ x: wx, y: wyy, w: ww, h: wh }); else lights.push({ x: wx, y: wyy, w: ww, h: wh, dim: 1 });
    if (r() < 0.45 && !opt.hall) { const fy = wyy + wh + 1; for (let x = wx - 1; x <= wx + ww; x++) s.set(x, fy, Wd[1]); for (let k2 = 0; k2 < 4; k2++) { const fx = wx + 1 + k2 * 3; s.set(fx, fy - 1, [0xe8504a, 0xf2c24a, 0xf6b8ca, 0xffffff][(k2 + w) % 4]); s.set(fx + 1, fy - 1, 0x4a8a3a); } } }
  // ---------- roof ----------
  const roofBot = wallTop + 2, ridgeY = opt.hall ? 7 : 5, inset = Math.min(22, W * 0.24);
  for (let y = ridgeY; y <= roofBot; y++) {
    const f = (y - ridgeY) / (roofBot - ridgeY), xl = Math.round(inset * (1 - f) - (f > 0.9 ? (f - 0.9) * 20 : 0)), xr = SW - 1 - xl;
    for (let x = xl; x <= xr; x++) {
      const side = Math.min(x - xl, xr - x) < 2 + f * (inset * 0.45), ry = y - ridgeY;
      let c;
      if (thatch) { const n = hash2(x >> 1, y, 3); c = T[(ry % 5 === 4) ? 0 : n < 0.25 ? 1 : n > 0.85 ? 3 : 2]; if ((x + ry * 3) % 7 === 0) c = T[1]; }
      else { const row = Math.floor(ry / 4), yy = ry % 4, col = (x + (row & 1) * 2) % 4;
        c = yy === 3 ? T[0] : yy === 0 ? T[3] : col === 0 ? T[1] : col === 1 ? T[3] : T[2]; }
      if (side) c = mul(c, 0.82);
      if (y >= roofBot - 1) c = thatch ? T[1] : T[0];
      s.set(x, y, c);
    }
    if (!thatch && y === roofBot - 2) for (let x = xl; x <= xr; x += 4) { s.set(x + 1, y, T[3]); s.set(x + 2, y, T[3]); } // tile ends
  }
  if (thatch) for (let x = 0; x < SW; x++) if (hash2(x, 1, 9) < 0.5) s.set(x, roofBot + 1, T[1]); // ragged fringe
  // irimoya gable with lattice
  if (!thatch) { const gy1 = ridgeY + Math.round((roofBot - ridgeY) * 0.48), gw = Math.min(W * 0.2, 24);
    for (let y = ridgeY + 1; y <= gy1; y++) { const f = (y - ridgeY) / (gy1 - ridgeY), hw = gw * f;
      for (let x = Math.round(SW / 2 - hw); x <= Math.round(SW / 2 + hw); x++) { const edge = Math.abs(x - SW / 2) > hw - 1.5 || y === gy1;
        s.set(x, y, edge ? Wd[0] : (y > gy1 - 5 && (x % 3 === 0) ? Wd[1] : (y < gy1 - 4 ? 0xf2ead6 : 0xd8ccb2))); } }
    for (let x = Math.round(SW / 2 - gw - 3); x <= Math.round(SW / 2 + gw + 3); x++) { s.set(x, gy1 + 1, R.ridge); s.set(x, gy1 + 2, T[3]); s.set(x, gy1 + 3, T[0]); } }
  // ridge with upturned onigawara ends
  const rl = Math.round(inset) - 1, rr = SW - Math.round(inset);
  for (let x = rl; x <= rr; x++) { s.set(x, ridgeY - 3, R.ridge); s.set(x, ridgeY - 2, mix(T[3], 0xffffff, 0.2)); s.set(x, ridgeY - 1, T[2]); s.set(x, ridgeY, R.ridge); }
  for (const [x, d] of [[rl, -1], [rr, 1]]) { s.set(x + d, ridgeY - 4, R.ridge); s.set(x + d * 2, ridgeY - 5, R.ridge); s.set(x + d, ridgeY - 3, T[3]); s.set(x + d * 2, ridgeY - 4, T[2]); }
  if (opt.hall) { s.rect(Math.round(SW / 2) - 3, ridgeY - 6, 6, 3, 0xd8a83a); s.set(Math.round(SW / 2) - 1, ridgeY - 6, 0xfff08a); }
  // eave shadow + rafter ends
  for (let x = ox - 2; x < ox + W + 2; x++) for (let k = 1; k <= 3; k++) { const y = roofBot + k; if (s.has(x, y)) s.set(x, y, mul(s.hex(x, y), 0.55 + k * 0.1)); }
  for (let x = ox; x < ox + W; x += 4) s.set(x, roofBot + 1, 0xd8b088);
  // red paper lantern by the door
  const lx = dx + dw + 3, ly = dTop;
  s.rect(lx + 1, ly - 2, 2, 2, Wd[0]); s.ell(lx + 2, ly + 3, 3, 3.6, (u, v) => (Math.abs(v) > 0.55 ? 0x2a1a14 : v < -0.25 ? 0xff8a6a : (Math.abs(v) % 0.4 < 0.1 ? 0xb82820 : 0xe0382e)));
  lights.push({ x: lx - 1, y: ly, w: 6, h: 7, lantern: 1 });
  // little extras: potted plant / firewood / barrel by the walls
  const ex = r() < 0.5 ? ox + 3 : ox + W - 10;
  if (r() < 0.6 && Math.abs(ex - dx) > 18) { s.ell(ex + 3, SH - 9, 3, 2.4, 0x8a4a2a); s.ell(ex + 3, SH - 13, 3.6, 3.4, (u, v) => v < -0.2 ? 0x7ab85a : 0x3e7a3a); }
  else if (Math.abs(ex - dx) > 18) for (let k = 0; k < 3; k++) for (let j = 0; j < 3 - k; j++) s.ell(ex + 2 + j * 3 + k * 1.5, SH - 10 - k * 3, 1.6, 1.4, (u, v) => u * u + v * v < 0.3 ? 0xd8b080 : 0x8a5a34);
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

/* ------------------------- interiors & wayside props ------------------------- */
const DW = [0x3a2416, 0x543420, 0x6e4628, 0x8c5c36, 0xa8744a];
function lowTable() { const s = new Spr(22, 14); s.ell(11, 6, 9.5, 4.2, (u, v) => v < -0.3 ? DW[4] : u > 0.5 ? DW[2] : DW[3]); s.rect(3, 8, 16, 2, DW[1]); s.rect(4, 10, 2, 3, DW[0]); s.rect(16, 10, 2, 3, DW[0]);
  s.ell(9, 4, 2.4, 2, (u, v) => v < -0.2 ? 0x6a8a6a : 0x3a5a4a); s.set(11, 3, 0x2a3a2a); s.set(13, 5, 0xf2ecd8); s.set(14, 5, 0xd8d0c0); s.set(6, 6, 0xf2ecd8); s.outline(0x1a100a); return s; }
function hearth(f) { const s = new Spr(26, 30);
  s.rect(7, 0, 2, 16, DW[2]); s.rect(6, 12, 4, 2, 0x3a3a42); // jizai-kagi hook
  s.rect(1, 14, 24, 14, (x, y) => (x < 3 || x > 22 || y < 16 || y > 25) ? (y === 14 || x === 1 ? DW[4] : DW[2]) : (((x + y) % 5 === 0) ? 0xa8a49c : 0x8e8a82));
  if (f >= 0) { s.ell(13, 21, 4.5, 2.5, (u, v) => v < -0.2 ? 0xffd04a : 0xe8602a); s.ell(13 + (f % 2 ? 1 : -1), 18, 1.8, 3, f === 1 ? 0xfff2a0 : 0xffb02a); }
  s.rect(9, 20, 9, 2, 0x5a3a24); s.ell(8, 15, 4.2, 3.4, (u, v) => v < -0.3 ? 0x5a5a66 : 0x2e2e36); s.rect(7, 11, 2, 2, 0x2e2e36);
  s.outline(0x1a100a); return s; }
function tansu() { const s = new Spr(18, 26); s.rect(1, 6, 16, 19, (x, y) => (y % 6 === 5 || x === 1 || x === 16) ? DW[0] : x < 6 ? DW[3] : DW[2]);
  for (let y = 8; y < 24; y += 6) { s.rect(5, y, 2, 1, 0xc8a050); s.rect(11, y, 2, 1, 0xc8a050); }
  s.ell(9, 3.5, 2.5, 3, (u, v) => v < -0.3 ? 0x8ab8d8 : 0x3a6a9a); s.set(9, 0, 0xf6b8ca); s.set(8, 1, 0xf6b8ca); s.outline(0x1a100a); return s; }
function bonsai() { const s = new Spr(16, 18); s.rect(3, 13, 10, 4, (x, y) => y === 13 ? 0x5a7aa8 : 0x3a5a88); s.stroke(8, 13, 6, 8, 2, 1, DW[1]); s.stroke(6, 9, 10, 6, 1.5, 1, DW[1]);
  s.ell(5, 7, 3.4, 2.2, (u, v) => v < -0.2 ? 0x7ab85a : 0x3e7a3a); s.ell(11, 5, 3.2, 2, (u, v) => v < -0.2 ? 0x7ab85a : 0x3e7a3a); s.outline(0x14200e); return s; }
function andon() { const s = new Spr(12, 22); s.rect(2, 19, 8, 2, DW[1]); s.rect(2, 6, 8, 13, (x, y) => (x === 2 || x === 9 || y === 6 || y === 12 || y === 18) ? DW[1] : (y < 10 ? 0xfff6d0 : 0xffe6a0)); s.rect(5, 2, 2, 4, DW[2]); s.outline(0x1a100a); return { s, light: { x: 3, y: 7, w: 6, h: 11 } }; }
function cushion(c) { const s = new Spr(14, 10); s.rect(1, 2, 12, 7, (x, y) => y === 2 ? mix(c, 0xffffff, 0.3) : (x + y) % 7 === 0 ? mul(c, 0.8) : c); s.set(7, 5, 0xf2c24a); s.outline(mul(c, 0.35)); return s; }
function byobu() { const s = new Spr(34, 26); for (let k = 0; k < 4; k++) { const x0 = 1 + k * 8, sk = k % 2 ? 2 : 0;
  s.poly([[x0, 3 + sk], [x0 + 8, 3 + (2 - sk)], [x0 + 8, 24 - sk], [x0, 24 - (2 - sk)]], (x, y) => y > 18 - sk ? 0x8a6a2a : (y < 7 && ((x * 7 + y) % 9 === 0)) ? 0xffffff : 0xe8c050); }
  s.line(3, 18, 12, 10, 0x4a6a3a); s.line(12, 10, 20, 16, 0x4a6a3a); s.line(20, 16, 30, 9, 0x4a6a3a); s.ell(24, 7, 2, 2, 0xd8302a); s.set(9, 7, 0x2a2a2a); s.set(10, 6, 0x2a2a2a);
  s.outline(0x2a1a0a); return s; }
function kamado(f) { const s = new Spr(24, 20); s.rect(1, 6, 22, 13, (x, y) => y === 6 ? 0xe0c8a8 : (x < 4 ? 0xd0b494 : 0xb89a7a)); for (let x = 1; x < 23; x += 6) for (let y = 9; y < 19; y += 4) s.set(x, y, 0x9a7a5a);
  for (const cx of [7, 17]) { s.ell(cx, 6, 4, 1.8, 0x2a2224); s.ell(cx, 4, 4, 2.6, (u, v) => v < -0.3 ? 0x5a5a62 : 0x3a3a42); s.rect(cx - 1, 1, 2, 1, 0x2a2a32); }
  s.rect(5, 12, 5, 5, f >= 0 ? (x, y) => (x + y + f) % 3 ? 0xe8602a : 0xffd04a : 0x1a1414); s.rect(15, 12, 5, 5, f >= 0 ? (x, y) => (x + y + f + 1) % 3 ? 0xe8602a : 0xffd04a : 0x1a1414);
  s.outline(0x2a1a10); return s; }
function exitMat() { const s = new Spr(16, 10); s.rect(1, 2, 14, 7, (x, y) => y === 2 ? 0xb8b2a4 : (x + y) % 5 === 0 ? 0x8a8478 : 0x9e988a); s.rect(5, 0, 6, 2, 0x6b4428); s.outline(0x3a3630); return s; }
function shojiWin() { const s = new Spr(16, 14); s.rect(1, 1, 14, 12, (x, y) => (x === 1 || x === 14 || y === 1 || y === 12) ? DW[1] : ((x - 1) % 4 === 0 || (y - 1) % 4 === 0) ? DW[3] : (y < 5 ? 0xfff8e0 : 0xf2e6c4)); s.outline(0x1a100a); return { s, light: { x: 2, y: 2, w: 12, h: 10 } }; }
function scroll() { const s = new Spr(10, 20); s.rect(1, 1, 8, 1, DW[1]); s.rect(2, 2, 6, 15, (x, y) => (x === 2 || x === 7) ? 0x6a8a6a : 0xf2ead2); s.line(4, 5, 5, 9, 0x2a2a2a); s.line(5, 9, 4, 13, 0x2a2a2a); s.set(6, 6, 0x2a2a2a); s.ell(6, 14, 1, 1, 0xd8302a); s.rect(1, 17, 8, 1, DW[1]); s.outline(0x1a100a); return s; }
function shrine() { const s = new Spr(24, 30); const Rd = [0x8a2018, 0xb8302a, 0xd84a3a];
  s.rect(4, 22, 16, 7, (x, y) => y === 22 ? 0xb8b2a4 : (x + y) % 4 === 0 ? 0x8a8478 : 0x9e988a);
  s.rect(6, 11, 12, 11, (x, y) => (x === 6 || x === 17) ? DW[1] : y < 14 ? DW[3] : DW[2]); s.rect(9, 14, 6, 7, 0x1e1410); s.ell(12, 18, 2, 2.2, 0xd8d0c0); s.set(11, 17, 0x2a2a2a); s.set(13, 17, 0x2a2a2a); s.rect(10, 20, 4, 1, Rd[1]);
  s.poly([[1, 12], [23, 12], [18, 4], [6, 4]], (x, y) => y > 10 ? Rd[0] : (x + y) % 3 ? Rd[1] : Rd[2]); s.rect(10, 2, 4, 2, Rd[0]);
  s.rect(3, 24, 2, 2, 0xffffff); s.rect(19, 24, 2, 2, 0xf2c24a); s.set(4, 23, 0xf6b8ca);
  s.outline(0x1a100a); return { s, light: { x: 9, y: 14, w: 6, h: 6 } }; }
function digSpot() { const s = new Spr(14, 9); s.ell(7, 5, 6, 3.4, (u, v) => v < -0.2 ? 0x9a7048 : 0x7a5434); s.line(4, 3, 9, 7, 0x4a2e18); s.line(9, 3, 4, 7, 0x4a2e18); s.set(10, 2, 0xfff6c0); s.outline(0x3a2414); return s; }

export function bakeStructures(nationColors) {
  put('table', lowTable(), 11, 13, [9, 2]); for (let f = -1; f < 3; f++) put('hearth' + f, hearth(f), 13, 29, [11, 3]);
  put('tansu', tansu(), 9, 25, [8, 2]); put('bonsai', bonsai(), 8, 17, [5, 2]);
  { const a = andon(); put('andon', a.s, 6, 21, [4, 2], { lights: [a.light] }); }
  [0xc8423a, 0x3a6fc8, 0x7a46b8, 0x2f9a6a].forEach((c, i) => put('cushion' + i, cushion(c), 7, 9));
  put('byobu', byobu(), 17, 25, [14, 2]); for (let f = -1; f < 2; f++) put('kamado' + f, kamado(f), 12, 19, [11, 2]);
  put('exit', exitMat(), 8, 11); { const w2 = shojiWin(); put('window', w2.s, 8, 16, null, { lights: [w2.light] }); } put('scroll', scroll(), 5, 18);
  { const sh = shrine(); put('shrine', sh.s, 12, 29, [10, 3], { lights: [sh.light] }); } put('dig', digSpot(), 7, 8);

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
