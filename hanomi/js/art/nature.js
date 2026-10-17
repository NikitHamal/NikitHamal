// Hanomi — trees, plants, rocks and crops, painted procedurally.
import { Spr, mix, mul } from '../pix.js';
import { mulberry32, hash2, bayer, clamp } from '../util.js';

export const S = {}; // name -> {cv, ax, ay, sh:[rx,ry]}  (ax,ay = ground anchor inside sprite)
const put = (name, spr, ax, ay, sh) => { S[name] = { cv: spr.canvas(), ax, ay, sh, w: spr.w, h: spr.h }; return S[name]; };

// --- canopy painter: clumps with top-left light, dark gaps between clumps, leaf speckle ---
function canopy(s, clumps, ramp, seed, opt = {}) {
  const W = s.w, H = s.h, id = new Int16Array(W * H).fill(-1), U = new Float32Array(W * H), V = new Float32Array(W * H);
  const r = mulberry32(seed);
  clumps.forEach((c, k) => {
    for (let y = Math.floor(c[1] - c[3] - 1); y <= c[1] + c[3] + 1; y++) for (let x = Math.floor(c[0] - c[2] - 1); x <= c[0] + c[2] + 1; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const u = (x + 0.5 - c[0]) / c[2], v = (y + 0.5 - c[1]) / c[3], wob = (hash2(x, y, seed) - 0.5) * 0.18;
      if (u * u + v * v <= 1 + wob) { const i = y * W + x; id[i] = k; U[i] = u; V[i] = v; }
    }
  });
  const n = ramp.length;
  // foliage "bubbles": jittered 4px cells, each lit as a small sphere, so leaves read as clusters
  const cs = opt.cell || 4, pts = [];
  for (let gy = -1; gy <= H / cs + 1; gy++) for (let gx = -1; gx <= W / cs + 1; gx++) pts.push([(gx + 0.25 + r() * 0.5) * cs + (gy & 1) * cs * 0.5, (gy + 0.25 + r() * 0.5) * cs]);
  const gw = Math.ceil(W / cs) + 3;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, k = id[i]; if (k < 0) continue;
    const u = U[i], v = V[i];
    let best = 1e9, bp = null;
    const gx0 = Math.floor(x / cs), gy0 = Math.floor(y / cs);
    for (let gy = gy0 - 1; gy <= gy0 + 2; gy++) for (let gx = gx0 - 1; gx <= gx0 + 2; gx++) { const p = pts[(gy + 1) * gw + gx + 1]; if (!p) continue; const d = (p[0] - x - 0.5) ** 2 + (p[1] - y - 0.5) ** 2; if (d < best) { best = d; bp = p; } }
    const cu = bp ? (x + 0.5 - bp[0]) / cs : 0, cv = bp ? (y + 0.5 - bp[1]) / cs : 0;
    let l = 0.6 - u * 0.3 - v * 0.55 + (clumps[k][4] || 0) - (cu + cv) * 0.42 + (Math.sqrt(best) / cs > 0.62 ? -0.22 : 0);
    let q = Math.floor(clamp(l, 0, 0.999) * n + (bayer(x, y) - 0.5) * 0.45); q = clamp(q, 0, n - 1);
    const below = y + 1 < H ? id[i + W] : -1;
    if (below > k && below >= 0) q = 0;
    else if (y + 2 < H && id[i + 2 * W] > k) q = Math.max(0, q - 2);
    let col = ramp[q];
    if (opt.speck && hash2(x, y, seed + 5) < opt.speck[0]) col = opt.speck[1 + ((hash2(x, y, seed + 6) * (opt.speck.length - 1)) | 0)];
    s.set(x, y, col);
  }
  void r;
}
function trunkShadow(s, ramp, leafTest) { // canopy shade falling on the trunk + bark grooves
  const src = new Spr(s.w, s.h); src.d.set(s.d); const tr = new Set(ramp);
  for (let y = 1; y < s.h; y++) for (let x = 0; x < s.w; x++) { const c = src.hex(x, y); if (!src.has(x, y) || !tr.has(c)) continue;
    let k = 0; for (let d = 1; d <= 4; d++) { if (!src.has(x, y - d)) break; const a = src.hex(x, y - d); if (!tr.has(a) && leafTest(a)) { k = d; break; } }
    if (k && k <= 3) s.set(x, y, mul(ramp[0], 0.7)); else if (k === 4) s.set(x, y, ramp[0]);
  }
}
function trunk(s, cx, top, bot, w, ramp, roots = true) {
  for (let y = top; y <= bot; y++) {
    const t = (y - top) / Math.max(1, bot - top), ww = w + (roots && t > 0.75 ? Math.round((t - 0.75) * 10) : 0);
    for (let x = -Math.floor(ww / 2); x < Math.ceil(ww / 2); x++) {
      const u = (x + 0.5) / (ww / 2); let q = u < -0.45 ? 2 : u < 0.2 ? 1 : 0;
      if (hash2(cx + x, y >> 1, 77) < 0.14 || ((x + 7) % 3 === 0 && hash2(x, y >> 2, 78) < 0.5 && q > 0)) q = Math.max(0, q - 1);
      s.set(cx + x, y, ramp[q]);
    }
  }
}
const OUT_LEAF = 0x1f3a26;

function oak(v) {
  const s = new Spr(46, 58), r = mulberry32(100 + v), cx = 23;
  const T = [0x4a3122, 0x6b4730, 0x8a5f3f];
  trunk(s, cx, 30, 54, 7, T);
  const greens = v === 3 ? [0x5a6a26, 0x7a8a2c, 0x9aa236, 0xb8b440, 0xd4c25a] : [0x2e5a2e, 0x3f7a37, 0x56963f, 0x72ae4a, 0x92c45a];
  const cl = [];
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + r() * 0.5; cl.push([cx + Math.cos(a) * 11 + r() * 2, 20 + Math.sin(a) * 7 + r() * 2, 9 + r() * 3, 8 + r() * 2]); }
  cl.sort((a, b) => a[1] - b[1]);
  cl.unshift([cx, 18, 15, 12]);
  cl.push([cx - 6 + r() * 4, 28, 10, 7, -0.1], [cx + 6 + r() * 4, 29, 9, 6, -0.1]);
  canopy(s, cl, greens, 200 + v, { speck: [0.025, 0xb6d86a, 0x2a4a2a] });
  trunkShadow(s, T, c => true);
  if (v === 1) for (let k = 0; k < 6; k++) { const x = 10 + r() * 26 | 0, y = 8 + r() * 22 | 0; if (s.has(x, y)) { s.set(x, y, 0xe8433a); s.set(x + 1, y, 0xc0302c); s.set(x, y - 1, 0xff8a6a); } }
  s.outline(c => c === T[0] || c === T[1] || c === T[2] ? 0x2a1a12 : OUT_LEAF);
  return s;
}
function pine(v, snow) {
  const s = new Spr(34, 56), cx = 17;
  trunk(s, cx, 40, 53, 5, [0x3e2a1c, 0x5a3c26, 0x74503a], false);
  const G = [0x163a2c, 0x1f4c36, 0x2a5e40, 0x3a724c, 0x4e8658];
  const tiers = 4 + (v & 1), H0 = 2, H1 = 44;
  for (let t = tiers - 1; t >= 0; t--) {
    const y0 = H0 + t * ((H1 - H0 - 12) / tiers), y1 = y0 + 13 + t * 1.2, hw1 = 6 + t * 2.7 + (v & 2 ? 1 : 0);
    for (let y = Math.floor(y0); y <= Math.ceil(y1) + 1; y++) for (let x = cx - 16; x <= cx + 16; x++) {
      const f = (y - y0) / (y1 - y0), hw = 1 + (hw1 - 1) * Math.min(1, f) ;
      const zig = ((x + t) % 4 < 2) ? 1 : 0, bot = y1 - zig - (Math.abs(x - cx) / hw1) * 2.2;
      if (Math.abs(x + 0.5 - cx) > hw || y > bot + 1) continue;
      const u = (x + 0.5 - cx) / hw;
      let q = Math.floor(clamp(0.66 - u * 0.42 - f * 0.18 + (hash2(x, y >> 1, 9 + v) - 0.5) * 0.2, 0, 0.99) * G.length);
      if (y > bot - 0.5) q = 0; else if (y > bot - 1.5) q = Math.max(0, q - 2);
      let col = G[q];
      if (snow && f < 0.55 && u < 0.5 - f * 0.4 && y <= bot - 2) col = (f < 0.3 || u < -0.4) ? 0xf4f7fb : 0xd4e0ee;
      s.set(x, y, col);
    }
  }
  s.outline(0x0e2219);
  return s;
}
function sakura(v) {
  const s = new Spr(48, 56), r = mulberry32(300 + v), cx = 24;
  const T = [0x3a2420, 0x56352c, 0x6f4638];
  trunk(s, cx, 30, 52, 6, T);
  // two branches
  s.stroke(cx - 1, 34, cx - 9, 24, 3, 2, T[1]); s.stroke(cx + 1, 33, cx + 10, 25, 3, 2, T[0]);
  const P = [0xb4587a, 0xd47896, 0xea98b0, 0xf6b8ca, 0xffd8e4];
  const cl = [[cx, 17, 16, 11]];
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + r() * 0.4; cl.push([cx + Math.cos(a) * 13 + r() * 2, 19 + Math.sin(a) * 7, 8 + r() * 3, 6 + r() * 2]); }
  cl.sort((a, b) => a[1] - b[1]);
  canopy(s, cl, P, 400 + v, { speck: [0.03, 0xffffff, 0x9a3e64] });
  trunkShadow(s, T, c => true);
  s.outline(c => c === T[0] || c === T[1] || c === T[2] ? 0x24140f : 0x7a2e4e);
  return s;
}
function birch(v) {
  const s = new Spr(36, 56), r = mulberry32(500 + v), cx = 18;
  for (let y = 26; y <= 53; y++) for (let x = -2; x <= 2; x++) { let c = x < 0 ? 0xf2efe6 : x < 2 ? 0xd8d4c8 : 0xb0aa9c; if (hash2(x, y >> 1, 3 + v) < 0.18) c = 0x2a2624; s.set(cx + x, y, c); }
  const G = [0x4a6a2a, 0x648a32, 0x82a83c, 0xa2c24c, 0xc2d870];
  const cl = [[cx, 16, 12, 11]]; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + r(); cl.push([cx + Math.cos(a) * 8, 18 + Math.sin(a) * 8, 7 + r() * 2, 6 + r() * 2]); }
  cl.sort((a, b) => a[1] - b[1]);
  canopy(s, cl, G, 600 + v, { speck: [0.03, 0xe6ec8a] });
  s.outline(c => c === 0x2a2624 || c > 0xa00000 && c < 0xffffff && (c & 0xff) > 0x90 ? 0x3a3630 : 0x2a3a18);
  return s;
}
function deadtree(v) {
  const s = new Spr(36, 50), cx = 18, T = [0x3e3430, 0x5a4c44, 0x72645a], r = mulberry32(700 + v);
  trunk(s, cx, 18, 47, 5, T);
  const br = (x, y, a, len, w) => { if (len < 3) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; s.stroke(x, y, x2, y2, w, Math.max(1, w - 1), T[1]); br(x2, y2, a - 0.5 - r() * 0.3, len * 0.62, Math.max(1, w - 1)); br(x2, y2, a + 0.4 + r() * 0.3, len * 0.55, Math.max(1, w - 1)); };
  br(cx, 22, -Math.PI / 2 - 0.5, 12, 3); br(cx, 24, -Math.PI / 2 + 0.6, 11, 3);
  s.outline(0x1e1816);
  return s;
}
function bamboo(v) {
  const s = new Spr(22, 58), r = mulberry32(1600 + v), G = [0x3e7a32, 0x5a9a3e, 0x7ab84a, 0xa0d06a];
  for (let k = 0; k < 4; k++) { const x0 = 3 + k * 4 + (r() * 2 | 0), top = 2 + (r() * 10 | 0), lean = (r() - 0.5) * 3;
    for (let y = top; y < 56; y++) { const t = (56 - y) / (56 - top), x = Math.round(x0 + lean * t * t); const node = (y + k * 3) % 9 === 0;
      s.set(x, y, node ? 0xc8d890 : G[2]); s.set(x + 1, y, node ? 0x8ab060 : G[1]); s.set(x - 1, y, node ? G[0] : G[3]); }
    for (let j = 0; j < 3; j++) { const ly = top + 4 + j * 9 + (r() * 4 | 0), lx = x0 + (j % 2 ? 2 : -2), dir = j % 2 ? 1 : -1; for (let i = 0; i < 6; i++) { s.set(lx + i * dir, ly + (i >> 1), G[i < 3 ? 2 : 1]); s.set(lx + i * dir, ly + 1 + (i >> 1), G[0]); } } }
  s.outline(0x173a1a); return s;
}
function stump() { const s = new Spr(16, 14); s.ell(8, 9, 6, 4.5, (u, v) => v < -0.1 ? (u * u + v * v < 0.3 ? 0xd8b07a : 0xc09060) : u < -0.3 ? 0x8a5f3f : 0x6b4730); s.rect(2, 9, 12, 3, (x) => x < 6 ? 0x8a5f3f : 0x6b4730); s.set(8, 7, 0xa8784a); s.outline(0x2a1a12); return s; }
function bush(v, berry, picked) {
  const s = new Spr(20, 16), r = mulberry32(800 + v);
  const G = [0x285a2e, 0x357236, 0x468a3e, 0x5ea24a, 0x7ab85a];
  const cl = [[10, 8, 8, 6.5], [5.5, 10, 5, 4.5], [14.5, 10, 5, 4.5], [10, 11, 6, 4]];
  canopy(s, cl, G, 900 + v, { speck: [0.03, 0x9ccc6a] });
  if (berry && !picked) for (let k = 0; k < 7; k++) { const x = 4 + r() * 12 | 0, y = 4 + r() * 9 | 0; if (s.has(x, y) && s.has(x + 1, y)) { s.set(x, y, 0xb02a4a); s.set(x + 1, y, 0x7a1a3a); s.set(x, y - 1, 0xff7a8a); } }
  s.outline(0x173322); return s;
}
function boulder(v, moss) {
  const s = new Spr(20, 16), r = mulberry32(1000 + v);
  const R = [0x55504c, 0x6e6863, 0x89827b, 0xa39c93, 0xbcb5aa];
  const rx = 8 + r() * 1.5, ry = 6 + r(), cx = 10, cy = 9;
  s.ell(cx, cy, rx, ry, (u, vv, x, y) => { let l = 0.6 - u * 0.35 - vv * 0.55 + (hash2(x, y, v) - 0.5) * 0.15; if (vv > 0.55) l -= 0.25; return R[clamp(Math.floor(l * 5 + (bayer(x, y) - 0.5) * 0.6), 0, 4)]; });
  for (let k = 0; k < 2; k++) { let x = cx - 3 + r() * 6 | 0, y = cy - 3 + r() * 3 | 0; for (let j = 0; j < 4; j++) { if (s.has(x, y)) s.set(x, y, R[0]); x += r() < 0.5 ? 1 : 0; y++; } }
  if (moss) s.map((c, x, y) => (y < cy - 2 && hash2(x, y, 3) < 0.55) ? (hash2(x, y, 4) < 0.5 ? 0x5a8a3a : 0x76a24a) : null);
  s.outline(0x2e2a28); return s;
}
function pebbles(v) { const s = new Spr(16, 10), r = mulberry32(1100 + v); for (let k = 0; k < 3; k++) { const x = 3 + r() * 10, y = 3 + r() * 4, rr = 1.2 + r() * 1.2; s.ell(x, y, rr * 1.3, rr, (u, vv) => vv < -0.2 ? 0xb8b0a4 : 0x8a847c); } s.outline(0x3e3a36); return s; }
function tallgrass(f) {
  const s = new Spr(16, 18), r = mulberry32(1200), G = [0x2a6230, 0x3a8038, 0x52a046, 0x70b856, 0x8ccc68];
  for (let k = 0; k < 13; k++) { const x0 = 2 + r() * 12, h = 7 + r() * 9, lean = (r() - 0.5) * 5 + (f ? 1.6 : -0.6), c = 1 + (k % 4);
    for (let j = 0; j < h; j++) { const t = j / h; s.set(x0 + lean * t * t, 17 - j, G[clamp(c - (t < 0.35 ? 1 : 0) + (t > 0.75 ? 1 : 0) - (k < 4 ? 1 : 0), 0, 4)]); } }
  s.outline(c => null);
  return s;
}
function flowers(v) {
  const s = new Spr(16, 16), r = mulberry32(1300 + v), cols = [[0xf6f2f8, 0xc8c0d8], [0xf7d84a, 0xd0a02a], [0xf28fb0, 0xc0587a], [0x8cb8f4, 0x5a7ac8], [0xe8615a, 0xa83a3a], [0xc89cf0, 0x8a5ab8], [0xffa84a, 0xc87228], [0xffffff, 0xd8d8e8]][v & 7];
  for (let k = 0; k < 5; k++) { const x = 3 + r() * 10 | 0, y = 4 + r() * 8 | 0;
    s.line(x, y + 1, x + (r() < 0.5 ? 0 : 1), y + 4, 0x3a7a3a); s.set(x - 1, y, cols[0]); s.set(x + 1, y, cols[0]); s.set(x, y - 1, cols[0]); s.set(x, y + 1, cols[1]); s.set(x, y, 0xf2c24a); }
  return s;
}
function reeds() { const s = new Spr(16, 22), r = mulberry32(1400); for (let k = 0; k < 6; k++) { const x = 3 + r() * 10 | 0, h = 10 + r() * 9 | 0; for (let j = 0; j < h; j++) s.set(x + (j > h * 0.6 ? (k & 1) : 0), 21 - j, j > h - 4 && k % 2 === 0 ? 0x6a3f22 : 0x5a7a34); if (k % 2 === 0) { s.set(x + (k & 1), 21 - h, 0x8a5a32); } } s.outline(0x2a3a1a); return s; }
function mushroom(v) { const s = new Spr(16, 14), red = v % 2 === 0; const cap = red ? [0xa8282a, 0xd8403a, 0xf06a5a] : [0x8a5a3a, 0xa8744a, 0xc8945a];
  const one = (x, y, k) => { s.rect(x - 1, y, 2 + k, 4, 0xece2cc); s.ell(x + k / 2, y, 3 + k, 2.4 + k * 0.5, (u, vv) => cap[vv < -0.3 ? 2 : u > 0.3 ? 0 : 1]); if (red) { s.set(x - 1, y - 1, 0xffffff); s.set(x + 2, y, 0xffffff); } };
  one(6, 7, 1); one(11, 9, 0); s.outline(0x3a1a14); return s; }
function lily(v) { const s = new Spr(18, 14); s.ell(9, 7, 7, 5, (u, vv) => (u > 0 && Math.abs(vv) < 0.18) ? null : vv < -0.3 ? 0x6ab45a : u > 0.4 ? 0x2f7a3a : 0x4a9a48);
  s.outline(0x1f4a2a); if (v % 3 === 0) { s.ell(8, 6, 2.5, 2, 0xf6b8ca); s.set(8, 5, 0xffffff); s.set(7, 6, 0xfff2a0); } return s; }
function sapling() { const s = new Spr(12, 16); s.line(6, 15, 6, 7, 0x6b4730); s.ell(6, 6, 4, 3.5, (u, v) => v < -0.2 ? 0x7ab85a : 0x468a3e); s.ell(3, 9, 2, 1.5, 0x468a3e); s.outline(0x173322); return s; }
function cactus() { const s = new Spr(16, 22); s.rect(6, 4, 5, 17, x => x < 8 ? 0x5aa04a : x < 10 ? 0x3e8a3a : 0x2a6a2e); s.rect(2, 8, 3, 6, 0x3e8a3a); s.rect(12, 6, 3, 6, 0x3e8a3a); s.outline(0x1a3a1a); return s; }

// --- crops: 4 stages ---
function crop(kind, st) {
  const s = new Spr(16, 22), r = mulberry32(1500 + st * 7 + kind.length);
  const leaf = [0x2f7a32, 0x4a9a3a, 0x6ab84a];
  if (kind === 'wheat' || kind === 'rice') {
    const n = [3, 5, 7, 7][st], ht = [4, 8, 13, 15][st], ripe = st === 3;
    for (let k = 0; k < n; k++) { const x = 2 + (k * 12 / n) + r() * 1.5 | 0, h = ht - r() * 3 | 0;
      for (let j = 0; j < h; j++) s.set(x + (j > h * 0.7 && kind === 'rice' && ripe ? 1 : 0), 21 - j, ripe ? (j > h - 4 ? (kind === 'rice' ? 0xe8d89a : 0xe8b84a) : 0xb89a3a) : leaf[(j + k) % 3]);
      if (st >= 2) for (let j = 0; j < 3; j++) s.set(x + (kind === 'rice' ? 1 : 0), 21 - h + j, ripe ? (kind === 'rice' ? 0xf6eab4 : 0xf6d06a) : 0x8ac85a); }
  } else if (kind === 'carrot') {
    const n = [2, 3, 4, 4][st]; for (let k = 0; k < n; k++) { const x = 4 + k * 3; const h = [3, 5, 7, 8][st]; for (let j = 0; j < h; j++) { s.set(x - (j % 3 === 1 ? 1 : 0), 21 - j, leaf[j % 3]); if (j > 2) s.set(x + 1, 21 - j, leaf[(j + 1) % 3]); } if (st === 3) { s.set(x, 21, 0xf07a2a); s.set(x + 1, 21, 0xd85a1a); s.set(x, 20, 0xffa04a); } }
  } else if (kind === 'tomato') {
    const h = [4, 9, 14, 15][st]; s.line(8, 21, 8, 21 - h, 0x8a6a3a);
    for (let j = 2; j < h; j += 2) { s.set(7, 21 - j, leaf[1]); s.set(9, 20 - j, leaf[2]); s.set(6, 20 - j, leaf[0]); s.set(10, 21 - j, leaf[1]); }
    if (st >= 2) for (let k = 0; k < (st === 3 ? 5 : 2); k++) { const x = 6 + (k % 2) * 4, y = 19 - k * 3; s.ell(x, y, 1.6, 1.6, st === 3 ? 0xe03a2a : 0x8ac85a); if (st === 3) s.set(x - 1, y - 1, 0xff8a7a); }
  } else if (kind === 'pumpkin') {
    s.line(2, 19, 14, 18, leaf[0]); for (let k = 0; k < [2, 4, 5, 5][st]; k++) s.ell(3 + k * 3, 17 + (k & 1), 2, 1.5, leaf[(k % 2) + 1]);
    if (st >= 2) { const rr = st === 3 ? 5.5 : 3; s.ell(9, 21 - rr * 0.75, rr, rr * 0.75, (u, v, x) => st === 3 ? (Math.abs(u) < 0.15 || Math.abs(Math.abs(u) - 0.55) < 0.1 ? 0xc85a1a : v < -0.3 ? 0xffa84a : 0xf07a22) : 0x8ac85a); s.set(9, 21 - rr * 1.5, 0x5a4a2a); }
  }
  if (st === 0 && kind !== 'pumpkin') { /* sprout */ }
  s.outline(c => 0x1e3a1c);
  return s;
}

export function bakeNature() {
  for (let v = 0; v < 4; v++) {
    put('oak' + v, oak(v), 23, 54, [11, 4]);
    put('pine' + v, pine(v, false), 17, 53, [8, 3]);
    put('pinesnow' + v, pine(v, true), 17, 53, [8, 3]);
    put('sakura' + v, sakura(v), 24, 52, [12, 4]);
    put('birch' + v, birch(v), 18, 53, [9, 3]);
    put('dead' + v, deadtree(v), 18, 47, [7, 3]);
  }
  put('stump', stump(), 8, 12, [6, 2]);
  for (let v = 0; v < 3; v++) put('bamboo' + v, bamboo(v), 11, 56, [8, 2]);
  for (let v = 0; v < 3; v++) { put('bush' + v, bush(v), 10, 14, [8, 2]); put('berry' + v, bush(v, true), 10, 14, [8, 2]); put('berryx' + v, bush(v, true, true), 10, 14, [8, 2]); }
  for (let v = 0; v < 8; v++) { put('boulder' + v, boulder(v, v >= 5), 10, 14, [8, 3]); put('flowers' + v, flowers(v), 8, 14); put('pebbles' + v, pebbles(v), 8, 8); put('mush' + v, mushroom(v), 8, 12); put('lily' + v, lily(v), 9, 10); }
  put('grass0', tallgrass(0), 8, 17); put('grass1', tallgrass(1), 8, 17);
  put('reeds', reeds(), 8, 21); put('sapling', sapling(), 6, 15); put('cactus', cactus(), 8, 21, [6, 2]);
  for (const k of ['wheat', 'carrot', 'tomato', 'pumpkin', 'rice']) for (let st = 0; st < 4; st++) put(k + st, crop(k, st), 8, 20);
  return S;
}
