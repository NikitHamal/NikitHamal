/*!
 * <pixel-scene> — small, hand-tuned, animated pixel-art vignettes for the writing pages.
 * Everything is painted procedurally into a tiny canvas (no image files), scaled up by an
 * integer factor so pixels stay crisp, paused when off-screen, and calm under
 * prefers-reduced-motion. Tap / hover to interact.
 *
 *   <pixel-scene scene="sakura"></pixel-scene>     scenes: sakura, plum, maple, lantern,
 *   <pixel-scene seed="post-slug"></pixel-scene>    koi, bonsai, torii, bamboo, incense, lotus,
 *                                                   snow, fuji, chime, heron, waterfall, cat, rabbit, tea
 */
(() => {
'use strict';
if (customElements.get('pixel-scene')) return;

/* ---------------- tiny raster ---------------- */
const hex = h => [h >> 16 & 255, h >> 8 & 255, h & 255];
const pk = (h, a = 255) => ((a << 24) | ((h & 255) << 16) | (h & 0xff00) | ((h >> 16) & 255)) >>> 0;
function mul(h, f) { const [r, g, b] = hex(h); const c = v => Math.max(0, Math.min(255, Math.round(v * f))); return (c(r) << 16) | (c(g) << 8) | c(b); }
function mix(a, b, t) { const A = hex(a), B = hex(b), c = i => Math.round(A[i] + (B[i] - A[i]) * t); return (c(0) << 16) | (c(1) << 8) | c(2); }
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hstr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function h2(x, y, s) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function noise(x, y, s) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy, s), b = h2(ix + 1, iy, s), c = h2(ix, iy + 1, s), d = h2(ix + 1, iy + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
class Img {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); }
  set(x, y, c, a) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h || c == null) return; this.d[y * this.w + x] = pk(c, a == null ? 255 : a); }
  has(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && (this.d[y * this.w + x] >>> 24) > 0; }
  get(x, y) { const c = this.d[y * this.w + x]; return ((c & 255) << 16) | (c & 0xff00) | ((c >> 16) & 255); }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, typeof c === 'function' ? c(x + i, y + j) : c); }
  ell(cx, cy, rx, ry, c) { for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) { const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry; if (u * u + v * v <= 1) this.set(x, y, typeof c === 'function' ? c(u, v, x, y) : c); } }
  line(x0, y0, x1, y1, c, w = 1) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1; for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, ww = typeof w === 'function' ? w(t) : w;
    for (let yy = Math.floor(y - ww / 2); yy <= y + ww / 2; yy++) for (let xx = Math.floor(x - ww / 2); xx <= x + ww / 2; xx++) if ((xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 <= (ww / 2) ** 2 + 0.25) this.set(xx, yy, typeof c === 'function' ? c(t, xx - x, yy - y) : c); } }
  outline(c, test) { const src = this.d.slice(), W = this.w, H = this.h; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (src[i] >>> 24) continue;
    const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < W && yy < H && (src[yy * W + xx] >>> 24) && (!test || test(xx, yy)); if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) this.d[i] = pk(c); } }
  canvas() { const cv = document.createElement('canvas'); cv.width = this.w; cv.height = this.h; const x = cv.getContext('2d'), im = x.createImageData(this.w, this.h); new Uint32Array(im.data.buffer).set(this.d); x.putImageData(im, 0, 0); return cv; }
}

/* ---------------- shared painters ---------------- */
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => BAY[((y & 3) << 2) | (x & 3)] / 16;
const pick = (P, l) => P[Math.max(0, Math.min(P.length - 1, Math.round(l * (P.length - 1))))];

// A floating diorama island: a grassy/earthy top surface with a ragged edge, and an earth face
// below it with strata, pebbles and dangling roots. Returns topAt(x) for things to stand on.
function island(img, cx, cy, rx, ry, depth, T, S, seed, o = {}) {
  const r = rng(seed), W = img.w, top = new Int16Array(W).fill(999), bot = new Int16Array(W).fill(-1);
  for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
    if (x < 0 || x >= W) continue; const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = u * u + v * v + (noise(x * 0.35, y * 0.35, seed) - 0.5) * 0.35;
    if (d > 1) continue; if (y < top[x]) top[x] = y; if (y > bot[x]) bot[x] = y;
    const l = 0.62 - v * 0.42 - u * 0.12 + (h2(x >> 1, y, seed) - 0.5) * 0.35, edge = d > 0.82;
    img.set(x, y, edge && v > 0 ? T[0] : pick(T, l + bay(x, y) * 0.12));
  }
  // earth face under the front rim
  for (let x = 0; x < W; x++) { if (bot[x] < 0) continue; const u = (x + 0.5 - cx) / rx, k = Math.sqrt(Math.max(0, 1 - u * u)), dd = Math.round(depth * k * (0.75 + noise(x * 0.4, 9, seed) * 0.5));
    for (let j = 1; j <= dd; j++) { const y = bot[x] + j, f = j / Math.max(1, dd); let c = pick(S, 0.85 - f * 0.9 - u * 0.15 + (h2(x, y >> 1, seed + 2) - 0.5) * 0.3); if (j === 1) c = S[S.length - 1]; if (((y + (x >> 2)) % 4 === 0) && j > 1) c = S[Math.max(0, S.indexOf(c) - 1)]; img.set(x, y, c); }
    if (dd > 2 && h2(x, 3, seed) < 0.12) { const rl = 1 + (r() * 3 | 0); for (let j = 1; j <= rl; j++) img.set(x, bot[x] + dd + j, o.root ?? S[0]); } }
  for (let k = 0; k < rx * 0.6; k++) { const x = Math.round(cx + (r() - 0.5) * rx * 1.6); if (bot[x] < 0) continue; const y = bot[x] + 2 + (r() * Math.max(1, depth * 0.6) | 0); img.set(x, y, o.stone ?? 0x8a8478); img.set(x + 1, y, o.stoneD ?? 0x6a6660); }
  // grass blades along the back and front edges
  if (o.blades !== false) for (let k = 0; k < rx * 2.4; k++) { const x = Math.round(cx + (r() - 0.5) * rx * 1.9); if (top[x] > 900) continue; const y = r() < 0.5 ? top[x] + 1 : bot[x] - (r() * 2 | 0), h = 1 + (r() * 3 | 0);
    for (let j = 0; j < h; j++) img.set(x + (j === h - 1 && r() < 0.4 ? 1 : 0), y - j, T[Math.min(T.length - 1, 2 + (j > 0 ? 1 : 0))]); }
  return x => { x = Math.round(x); if (x < 0 || x >= W || top[x] > 900) return 999; return Math.round((top[x] + bot[x]) / 2 + 1); };
}
// Blossom/leaf crowns built from overlapping clumps: each clump is a tiny lit sphere, so the
// crown reads like the hand-pixelled cauliflower masses of classic pixel trees.
function crown(img, blobs, P, seed, top, bot, o = {}) {
  const W = img.w, H = img.h, r = rng(seed), n = P.length, ins = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let best = -9; for (const [cx, cy, rx, ry] of blobs) { const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = 1 - (u * u + v * v); if (d > best) best = d; }
    if (best + (noise(x * 0.5, y * 0.5, seed) - 0.5) * 0.38 > 0) ins[y * W + x] = 1; }
  const light = (x, y) => 1.05 - (y - top) / (bot - top) * 1.1 - Math.abs(x - (o.lx ?? W * 0.44)) / W * 0.45 + (noise(x * 0.16, y * 0.22, seed + 2) - 0.5) * 0.35;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ins[y * W + x]) img.set(x, y, pick(P, light(x, y) - 0.12));
  // clumps, back (darker) to front (lighter-topped)
  const cl = []; for (let k = 0; k < (o.clumps ?? W * H * 0.05); k++) { const x = r() * W, y = top + r() * (bot - top); if (ins[(y | 0) * W + (x | 0)]) cl.push([x, y, 1.6 + r() * 1.6]); }
  cl.sort((a, b) => a[1] - b[1]);
  for (const [cx, cy, rr] of cl) { const L = light(cx, cy);
    for (let y = Math.floor(cy - rr); y <= cy + rr; y++) for (let x = Math.floor(cx - rr * 1.3); x <= cx + rr * 1.3; x++) { const u = (x + 0.5 - cx) / (rr * 1.3), v = (y + 0.5 - cy) / rr; if (u * u + v * v > 1 || !ins[y * W + x]) continue;
      img.set(x, y, pick(P, L + (v < -0.25 ? 0.22 : v > 0.45 ? -0.24 : 0.02) - (u > 0.55 ? 0.1 : 0))); } }
  // underside: ragged dark rim and a few hanging tufts
  for (let x = 0; x < W; x++) { let y = H - 1; while (y > 0 && !ins[y * W + x]) y--; if (y <= top + 2) continue; img.set(x, y, P[0]); if (h2(x, 1, seed) < 0.3) { img.set(x, y + 1, P[1]); if (h2(x, 2, seed) < 0.4) img.set(x, y + 2, P[0]); } }
  // tiny highlight sparkles on the sunny top
  for (let k = 0; k < (o.sparks ?? 14); k++) { const x = r() * W | 0, y = top + r() * (bot - top) * 0.45 | 0; if (ins[y * W + x]) img.set(x, y, P[n - 1]); }
}
function bark(img, pts, w0, w1, B, seed) { // tapered limb, lit from the left, with bark streaks
  const r = rng(seed);
  img.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], (t, dx) => { const w = w0 + (w1 - w0) * t, u = dx / (w / 2 + 0.01); return u < -0.5 ? B[3] : u < 0.1 ? B[2] : u < 0.6 ? B[1] : B[0]; }, t => w0 + (w1 - w0) * t);
  for (let k = 0; k < w0 * 2; k++) { const t = r(), x = pts[0][0] + (pts[1][0] - pts[0][0]) * t + (r() - 0.3) * w0 * 0.5, y = pts[0][1] + (pts[1][1] - pts[0][1]) * t; img.set(x, y, B[0]); img.set(x, y + 1, B[1]); }
}
// Sway: draw a layer in 1px rows, each shifted by a bend that grows toward the top (rooted at baseY)
function sway(c, cv, top, baseY, bend, x0 = 0) {
  for (let y = 0; y < cv.height; y++) { const k = y >= baseY ? 0 : Math.pow((baseY - y) / Math.max(1, baseY - top), 1.3), off = Math.round(bend * k); c.drawImage(cv, 0, y, cv.width, 1, x0 + off, y, cv.width, 1); }
}
function spring(st, dt) { // damped spring for shakes: st.sx position, st.sv velocity
  st.sv += (-st.sx * 70 - st.sv * 6) * dt; st.sx += st.sv * dt; return st.sx;
}
function chime() { try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; const a = chime.a || (chime.a = new C()); const t = a.currentTime;
  for (const [f, v] of [[1568, 0.05], [2349, 0.025], [3136, 0.012]]) { const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = f * (0.98 + Math.random() * 0.04); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 2.5); } } catch (e) {} }

/* ---------------- 2x sculpting: paint volumes at double size, then mode-filter down ---------------- */
const KEEP = new Set([0x16101a, 0xffffff, 0x2a1a14]);
function halveImg(src) { const o = new Img(src.w >> 1, src.h >> 1), cnt = new Map();
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) { cnt.clear(); let n = 0;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const xx = x * 2 + i, yy = y * 2 + j; if (!src.has(xx, yy)) continue; n++; const c = src.get(xx, yy); cnt.set(c, (cnt.get(c) || 0) + (KEEP.has(c) ? 2.6 : 1)); }
    if (n < 2) { for (const [c] of cnt) if (KEEP.has(c) && c !== 0xffffff) o.set(x, y, c); continue; }
    let b = 0, bw = -1; for (const [c, k] of cnt) if (k > bw) { bw = k; b = c; } o.set(x, y, b); }
  return o; }
function hi(w, h, paint, out) { const big = new Img(w * 2, h * 2); paint(big); const s = halveImg(big); if (out != null) s.outline(out); return s; }
// a lit volume: ellipse shaded from the top-left with a 4-5 step ramp, optional rotation
function vol(img, cx, cy, rx, ry, R, o = {}) { const ca = Math.cos(o.rot || 0), sa = Math.sin(o.rot || 0), M = Math.max(rx, ry) + 1;
  for (let y = Math.floor(cy - M); y <= cy + M; y++) for (let x = Math.floor(cx - M); x <= cx + M; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry; if (u * u + v * v > 1) continue;
    const l = 0.62 - u * 0.28 - v * 0.5 + (o.k || 0) - (u * u + v * v > 0.8 ? 0.12 : 0); img.set(x, y, o.fn ? o.fn(u, v, x, y, l) : pick(R, l)); } }

/* ---------------- particles ---------------- */
function Petals(cols, opt = {}) { // falling petals/leaves that flutter, then settle on the ground
  return { list: [], cols, opt,
    spawn(x, y, vx = 0, vy) { if (this.list.length > (opt.max || 26)) return; this.list.push({ x, y, vx: vx + (Math.random() - 0.4) * 4, vy: vy ?? (3 + Math.random() * 5), t: Math.random() * 6, c: cols[(Math.random() * cols.length) | 0], life: 0, land: null }); },
    step(dt, groundY, wind) { for (const p of this.list) { p.life += dt; p.t += dt * (2.2 + (p.vy * 0.15));
      if (p.land == null) { p.vy += (5 - p.vy) * dt * 1.5; p.x += (p.vx + Math.sin(p.t) * 5 + wind) * dt; p.vx *= Math.pow(0.6, dt); p.y += p.vy * dt * (0.8 + Math.sin(p.t * 2) * 0.25); const gy = groundY(p.x); if (gy < 900 && p.y >= gy && p.y < gy + 3) { p.y = gy; p.land = 0; } }
      else p.land += dt; }
      this.list = this.list.filter(p => (p.land == null || p.land < (opt.rest || 4)) && p.y < 70 && p.x > -6 && p.x < 70); },
    draw(c) { for (const p of this.list) { if (p.land != null && p.land > (opt.rest || 4) - 0.8 && ((p.land * 10) | 0) % 2) continue; c.fillStyle = p.c;
      const f = p.land != null ? 0 : ((p.t * 1.6) | 0) % 4, x = Math.round(p.x), y = Math.round(p.y); if (f === 0) c.fillRect(x, y, 2, 1); else if (f === 2) c.fillRect(x, y, 1, 2); else c.fillRect(x, y, 1, 1); } } };
}

/* ---------------- scenes ---------------- */
const SCENES = {};
const GRASS = [0x2e5a2e, 0x3e7234, 0x548a3e, 0x6ea24a, 0x8cbc5a], EARTH = [0x3a2418, 0x5a3a26, 0x7a5236, 0x946644, 0xb08058];

// Blossom trees: sakura / plum / maple
function blossomScene(name, pal) {
  SCENES[name] = { w: 64, h: 64,
    bake(seed) {
      const r = rng(seed), back = new Img(64, 64), crownI = new Img(64, 64), B = pal.bark;
      const topAt = island(back, 32, 54, 25, 5, 6, pal.ground, EARTH, seed + 1);
      // petal carpet over the island
      for (let k = 0; k < 160; k++) { const x = 9 + r() * 46, y = 50 + r() * 9; const d = ((x - 32) / 24) ** 2 + ((y - 54) / 5) ** 2; if (d < 0.85 + r() * 0.2) back.set(x, y, pick(pal.pile, 0.25 + r() * 0.75 - (y - 50) * 0.04)); }
      const T = (x0, y0, x1, y1, w0, w1, k) => bark(back, [[x0, y0], [x1, y1]], w0, w1, B, seed + k);
      T(31, 55, 31, 44, 7.5, 6, 2); T(31, 46, 29, 33, 6, 4, 3); T(25, 56, 28, 51, 4, 2.5, 4); T(37, 56, 34, 51, 3.6, 2.5, 5);
      T(32, 44, 41, 36, 3, 2, 6); T(40, 37, 46, 31, 2, 1.3, 7); T(30, 39, 21, 33, 2.4, 1.3, 8); T(29, 35, 25, 27, 1.8, 1.2, 9);
      for (let y = 44; y < 55; y++) if (h2(30, y, seed) < 0.4) back.set(28 + ((y >> 1) & 1), y, B[3]);
      back.set(31, 49, B[0]); back.set(32, 50, B[0]); back.set(31, 51, B[1]);
      crown(crownI, [[32, 21, 26, 12], [15, 26, 11, 8], [49, 25, 11, 8], [31, 12, 17, 9], [43, 15, 12, 8], [21, 15, 11, 8], [32, 30, 18, 6]], pal.leaf, seed + 12, 3, 38, { clumps: 300 });
      return { back: back.canvas(), crown: crownI.canvas(), topAt };
    },
    init(st) { st.p = Petals(pal.fall, { max: 28, rest: 4.5 }); st.sx = 0; st.sv = 0; },
    frame(c, st, dt, t, B) {
      const wind = Math.sin(t * 0.33) * 1.6 + Math.sin(t * 1.1) * 0.6, shake = spring(st, dt);
      if (Math.random() < dt * (1.4 + Math.abs(st.sv) * 0.2)) st.p.spawn(8 + Math.random() * 48, 20 + Math.random() * 16, wind + st.sv * 0.3);
      st.p.step(dt, B.topAt, wind * 0.5);
      c.drawImage(B.back, 0, 0);
      sway(c, B.crown, 4, 40, Math.sin(t * 0.7) * 0.7 + wind * 0.15 + shake);
      st.p.draw(c);
    },
    poke(st) { st.sv += 22 * (Math.random() < 0.5 ? 1 : -1); for (let k = 0; k < 16; k++) st.p.spawn(8 + Math.random() * 48, 12 + Math.random() * 24, (Math.random() - 0.5) * 14, 1 + Math.random() * 3); },
    hover: true,
  };
}
blossomScene('sakura', { leaf: [0x5a3a5e, 0x7e4470, 0xa8507a, 0xd0688a, 0xec8a98, 0xf8a8a4, 0xffc4b0], bark: [0x3e1e1c, 0x5e2e26, 0x844630, 0xa8643e], pile: [0x9a3e6a, 0xc85a86, 0xe47ea0, 0xf4a2b6, 0xffc4c8], fall: ['#f8a8a4', '#ec8a98', '#ffc4b0', '#d0688a'], ground: GRASS });
blossomScene('plum', { leaf: [0x2e2448, 0x48346a, 0x6a4a8c, 0x9068aa, 0xb48ec6, 0xd4b4dc, 0xf0dcf0], bark: [0x2a1a1c, 0x44282a, 0x5e3a36, 0x7a5046], pile: [0x5a4282, 0x7e60a2, 0xa88ac4, 0xcab0dc, 0xeadcf2], fall: ['#d4b4dc', '#b48ec6', '#f0dcf0'], ground: GRASS });
blossomScene('maple', { leaf: [0x4a161c, 0x6e2020, 0x9a2e22, 0xc44a26, 0xe4702e, 0xf6983a, 0xffc260], bark: [0x2e1c16, 0x4a2c1e, 0x664030, 0x845640], pile: [0x8a2a1e, 0xb84626, 0xe06a30, 0xf4943c, 0xffbe60], fall: ['#e4702e', '#f6983a', '#c44a26', '#ffc260'], ground: [0x5a5a2a, 0x6e6e30, 0x868238, 0x9e9644, 0xb8aa58] });

// Stone lantern (tōrō) on a mossy islet; warm light spills on the stone and moss. Tap: light/dim.
SCENES.lantern = { w: 64, h: 64,
  bake(seed) {
    const g = new Img(64, 64), S = [0x46424c, 0x625e68, 0x7e7a82, 0x9e9aa0, 0xc0bcbe], M = [0x3a5a32, 0x4e7a3e, 0x6a9a4e];
    const topAt = island(g, 32, 54, 22, 5, 6, [0x2a4a2c, 0x34583a, 0x426a42, 0x56804a, 0x6e9654], [0x2e2a30, 0x423c42, 0x58525a, 0x6e6870, 0x868088], seed, { stone: 0x9a9aa0 });
    const blk = (x, y, w, h, k = 0) => g.rect(x, y, w, h, (xx, yy) => S[Math.max(0, Math.min(4, (xx - x < 2 ? 3 : xx - x > w - 3 ? 1 : 2) + k + (h2(xx, yy, seed) < 0.1 ? -1 : 0)))]);
    blk(23, 50, 18, 3, -1); g.rect(23, 50, 18, 1, S[3]); blk(26, 47, 12, 3); blk(28, 37, 8, 10); g.rect(28, 41, 8, 1, S[1]);
    blk(21, 33, 22, 4, 1); g.rect(21, 33, 22, 1, S[4]); g.rect(21, 36, 22, 1, S[0]);
    blk(24, 22, 16, 11); g.rect(26, 24, 12, 8, 0x1a1418); g.rect(31, 24, 2, 8, S[1]); g.rect(26, 27, 12, 1, S[1]); // window with lattice
    for (let y = 13; y < 22; y++) { const w = 6 + (y - 13) * 2.8; g.rect(Math.round(32 - w / 2), y, Math.round(w), 1, S[y < 16 ? 4 : y < 19 ? 3 : 2]); }
    g.rect(32 - 16, 21, 32, 1, S[0]); g.set(15, 20, S[3]); g.set(48, 20, S[3]); g.set(14, 19, S[3]); g.set(49, 19, S[3]);
    g.rect(30, 9, 4, 4, S[3]); g.rect(31, 7, 2, 2, S[4]); g.set(31, 6, S[4]);
    for (let k = 0; k < 34; k++) { const x = 21 + h2(k, 1, seed) * 22 | 0, y = 13 + h2(k, 2, seed) * 38 | 0; if (g.has(x, y) && g.get(x, y) !== 0x1a1418 && h2(k, 3, seed) < 0.65) { g.set(x, y, M[k % 3]); if (k % 2) g.set(x + 1, y, M[1]); } }
    // a small fern and a stepping stone
    for (let k = 0; k < 7; k++) { const a = -2.6 + k * 0.42, L = 5 + (k % 2) * 2; g.line(46, 52, 46 + Math.cos(a) * L, 52 + Math.sin(a) * L * 0.8, M[k % 2 ? 2 : 1]); }
    g.ell(17, 55, 4, 1.6, (u, v) => v < 0 ? 0xa8a4a6 : 0x7e7a80);
    g.outline(0x18141c, (x, y) => true);
    // lit version: warm light falloff onto everything already painted
    const lit = new Img(64, 64); lit.d.set(g.d); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { if (!lit.has(x, y)) continue; const d = Math.hypot(x - 32, (y - 28) * 1.3); if (d > 24) continue; const a = Math.ceil((1 - d / 24) * 4) / 4 * 0.42; lit.set(x, y, mix(lit.get(x, y), 0xffb860, a)); }
    return { g: g.canvas(), lit: lit.canvas(), topAt };
  },
  init(st) { st.on = 1; st.k = 1; st.flies = Array.from({ length: 6 }, () => ({ x: 14 + Math.random() * 36, y: 10 + Math.random() * 36, t: Math.random() * 9 })); },
  frame(c, st, dt, t, B) {
    st.k += ((st.on ? 1 : 0) - st.k) * Math.min(1, dt * 4);
    c.drawImage(B.g, 0, 0); if (st.k > 0.02) { const fl = 0.86 + Math.sin(t * 9) * 0.07 + Math.sin(t * 23) * 0.05; c.globalAlpha = st.k * fl; c.drawImage(B.lit, 0, 0); c.globalAlpha = 1;
      c.fillStyle = '#d8602a'; c.fillRect(26, 24, 5, 3); c.fillRect(33, 24, 5, 3); c.fillRect(26, 28, 5, 4); c.fillRect(33, 28, 5, 4); c.fillStyle = '#ffb040'; c.fillRect(28, 25, 2, 6); c.fillRect(34, 25, 2, 6); c.fillStyle = '#fff0a0'; c.fillRect(29, 26 + (fl > 0.9 ? 0 : 1), 1, 3); c.fillRect(34, 26 + (fl > 0.9 ? 1 : 0), 1, 3); c.globalAlpha = 1; }
    for (const f of st.flies) { f.t += dt; f.x += Math.sin(f.t * 0.7) * dt * 6; f.y += Math.cos(f.t * 0.9) * dt * 4; if (f.x < 4 || f.x > 60 || f.y < 2 || f.y > 50) { f.x = 32 + (Math.random() - 0.5) * 30; f.y = 26 + (Math.random() - 0.5) * 20; }
      const a = 0.5 + 0.5 * Math.sin(f.t * 3); if (a < 0.3) continue; c.fillStyle = `rgba(214,240,110,${a})`; c.fillRect(Math.round(f.x), Math.round(f.y), 1, 1); c.fillStyle = `rgba(214,240,110,${a * 0.35})`; c.fillRect(Math.round(f.x) - 1, Math.round(f.y), 3, 1); c.fillRect(Math.round(f.x), Math.round(f.y) - 1, 1, 3); }
  },
  poke(st) { st.on = !st.on; },
};

// Pond diorama painter shared by koi & lotus: an islet with an organic pond carved into it
function pondIsland(g, seed, o = {}) {
  const topAt = island(g, 32, 40, 30, 17, 7, GRASS, EARTH, seed, { blades: true });
  const W = 64, inside = new Uint8Array(W * 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < W; x++) { const u = (x + 0.5 - 32) / 22, v = (y + 0.5 - 40) / 11.5, d = u * u + v * v + (noise(x * 0.18, y * 0.18, seed + 4) - 0.5) * 0.5; if (d < 1) inside[y * W + x] = 1; }
  for (let y = 0; y < 64; y++) for (let x = 0; x < W; x++) { if (!inside[y * W + x]) continue; let dep = 0; for (let k = 1; k < 6; k++) if (inside[(y - k) * W + x] && inside[(y + k) * W + x] && inside[y * W + x - k] && inside[y * W + x + k]) dep = k; else break;
    const top = !inside[(y - 1) * W + x] || !inside[(y - 2) * W + x]; g.set(x, y, top ? 0x3a2a1e : !inside[(y - 3) * W + x] ? 0x2e5a6a : pick([0x8ad2ca, 0x62b4bc, 0x4496aa, 0x347a96, 0x2a6284, 0x225070], dep / 5 + (noise(x * 0.25, y * 0.4, seed + 6) - 0.5) * 0.2)); }
  const r = rng(seed + 7); // rim stones
  for (let k = 0; k < 34; k++) { const a = r() * Math.PI * 2, x = 32 + Math.cos(a) * 22.5, y = 40 + Math.sin(a) * 12; if (Math.sin(a) < -0.2 && r() < 0.5) continue; const s = 1.4 + r() * 1.3; g.ell(x, y, s * 1.3, s, (u, v) => v < -0.2 ? 0xc8c2b8 : u > 0.3 ? 0x7e7870 : 0xa49e94); }
  return { topAt, inside };
}
SCENES.koi = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64), P = pondIsland(g, seed);
    g.ell(16, 34, 3.6, 2.4, (u, v) => (u > 0 && Math.abs(v) < 0.2) ? null : v < -0.3 ? 0x86c45a : 0x4e9a42); g.ell(48, 46, 3, 2, (u, v) => v < -0.3 ? 0x86c45a : 0x4e9a42); g.ell(15, 33, 1.3, 1, 0xf6b8ca);
    for (let k = 0; k < 5; k++) { g.set(52 + k, 30 - (k & 1), 0x5a8a3a); g.line(53 + k, 31, 53 + k, 26 - (k % 3), 0x6a9a3a); } g.set(54, 25, 0x7a4a2a); g.set(56, 24, 0x7a4a2a);
    return { g: g.canvas(), inside: P.inside }; },
  init(st) { const C = [['#f6f2ea', '#e0402a'], ['#f2b23a', '#ffd86a'], ['#f6f2ea', '#1a1414'], ['#e86a2a', '#f6f2ea'], ['#f6f2ea', '#f6f2ea']]; st.fish = C.map((c, i) => ({ x: 22 + i * 5, y: 38 + (i % 2) * 4, a: i * 1.3, c, sp: 6 + i, turn: 0 })); st.food = []; st.rip = []; },
  frame(c, st, dt, t, B) {
    c.drawImage(B.g, 0, 0); const IN = (x, y) => B.inside[(y | 0) * 64 + (x | 0)];
    for (let k = 0; k < 10; k++) { const x = Math.round(16 + ((k * 13 + t * 3) % 32)), y = 34 + ((k * 7) % 12); if (IN(x, y) && Math.sin(t * 2 + k * 1.7) > 0.4) { c.fillStyle = 'rgba(220,250,255,0.55)'; c.fillRect(x, y, 2 + (k & 1), 1); } }
    for (const r of st.rip) { r.t += dt; const rr = 1 + r.t * 8; c.fillStyle = `rgba(230,250,255,${Math.max(0, 0.75 - r.t)})`; for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283, x = Math.round(r.x + Math.cos(a) * rr), y = Math.round(r.y + Math.sin(a) * rr * 0.6); if (IN(x, y)) c.fillRect(x, y, 1, 1); } } st.rip = st.rip.filter(r => r.t < 0.8);
    for (const f of st.fish) {
      const tgt = st.food[0]; if (tgt) { const want = Math.atan2(tgt.y - f.y, tgt.x - f.x); f.a += Math.atan2(Math.sin(want - f.a), Math.cos(want - f.a)) * dt * 5; if (Math.hypot(tgt.x - f.x, tgt.y - f.y) < 2) tgt.e = 1; } else { f.turn += (Math.random() - 0.5) * dt * 3; f.turn *= 0.97; f.a += f.turn * dt; }
      const sp = (tgt ? 14 : f.sp) * dt, nx = f.x + Math.cos(f.a) * sp, ny = f.y + Math.sin(f.a) * sp * 0.7; if (IN(nx + Math.cos(f.a) * 3, ny + Math.sin(f.a) * 2) && IN(nx, ny)) { f.x = nx; f.y = ny; } else f.a += 2.2;
      const ca = Math.cos(f.a), sa = Math.sin(f.a) * 0.7, w = Math.sin(t * 9 + f.sp) * 0.7;
      c.fillStyle = 'rgba(10,30,50,0.3)'; for (let k = 0; k < 6; k++) c.fillRect(Math.round(f.x - ca * k) + 1, Math.round(f.y - sa * k) + 2, 1, 1);
      for (let k = 0; k < 7; k++) { const px = f.x - ca * k + -sa * w * k / 7, py = f.y - sa * k + ca * w * k / 7; c.fillStyle = (k === 2 || k === 3) ? f.c[1] : f.c[0]; c.fillRect(Math.round(px), Math.round(py), k < 5 ? 2 : 1, k < 4 ? 2 : 1); }
    }
    st.food = st.food.filter(f => !f.e); for (const f of st.food) { c.fillStyle = '#c8945a'; c.fillRect(Math.round(f.x), Math.round(f.y), 1, 1); }
  },
  poke(st, x, y, B) { if (!B.inside[(y | 0) * 64 + (x | 0)]) { x = 32; y = 40; } for (let k = 0; k < 3; k++) st.food.push({ x: x + (Math.random() - 0.5) * 4, y: y + (Math.random() - 0.5) * 3 }); st.rip.push({ x, y, t: 0 }); },
};
SCENES.lotus = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64), P = pondIsland(g, seed + 3);
    const pads = [[20, 40, 6.5], [40, 34, 6], [33, 46, 4.5], [46, 44, 4]];
    for (const [x, y, rr] of pads) { g.ell(x + 1, y + 1, rr, rr * 0.55, 0x23506a); g.ell(x, y, rr, rr * 0.55, (u, v) => (u > 0.1 && Math.abs(v) < 0.14) ? null : v < -0.35 ? 0x92ce62 : u > 0.45 ? 0x2e7a34 : 0x58a448); }
    g.ell(40, 30, 3.6, 2.6, (u, v) => v < -0.3 ? 0xffe0ea : u > 0.4 ? 0xe07a9a : 0xf6a8c0); g.ell(37.5, 31, 1.8, 1.4, 0xf28aaa); g.ell(42.5, 31, 1.8, 1.4, 0xe0789a); g.set(40, 29, 0xf6d04a);
    for (const [x, y] of [[12, 30], [52, 30], [54, 34]]) for (let j = 0; j < 7; j++) g.set(x + (j > 4 ? 1 : 0), y - j, j > 4 ? 0x7a4a2a : 0x5a8a3a);
    return { g: g.canvas(), pads, inside: P.inside }; },
  init(st, B) { st.f = { pad: 0, x: B.pads[0][0], y: B.pads[0][1] - 2, hop: null, blink: 0 }; st.rip = []; },
  frame(c, st, dt, t, B) { c.drawImage(B.g, 0, 0); const f = st.f;
    for (const r of st.rip) { r.t += dt; const rr = 2 + r.t * 9; c.fillStyle = `rgba(230,250,255,${Math.max(0, 0.7 - r.t)})`; for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283, x = Math.round(r.x + Math.cos(a) * rr), y = Math.round(r.y + Math.sin(a) * rr * 0.55); if (B.inside[y * 64 + x]) c.fillRect(x, y, 1, 1); } } st.rip = st.rip.filter(r => r.t < 0.7);
    let x = f.x, y = f.y, z = 0, stretch = 0; if (f.hop) { f.hop.t += dt * 1.8; const k = Math.min(1, f.hop.t); x = f.hop.x0 + (f.hop.x1 - f.hop.x0) * k; y = f.hop.y0 + (f.hop.y1 - f.hop.y0) * k; z = Math.sin(k * Math.PI) * 9; stretch = 1; if (k >= 1) { f.x = x; f.y = y; f.hop = null; st.rip.push({ x, y: y + 2, t: 0 }); } }
    const X = Math.round(x), Y = Math.round(y - z), G = '#5aa040', L = '#86c45a', D = '#2e6a28';
    if (z > 1) { c.fillStyle = 'rgba(10,30,40,0.3)'; c.fillRect(X - 2, Math.round(y) + 2, 5, 1); }
    c.fillStyle = D; c.fillRect(X - 3, Y + 1 + stretch, 7, 2); c.fillStyle = G; c.fillRect(X - 2, Y - stretch, 5, 3 + stretch); c.fillStyle = L; c.fillRect(X - 1, Y - stretch, 3, 1);
    c.fillStyle = G; c.fillRect(X - 3, Y - 1 - stretch, 2, 2); c.fillRect(X + 2, Y - 1 - stretch, 2, 2); c.fillStyle = '#16101a'; f.blink -= dt; if (f.blink < -3 - Math.random() * 3) f.blink = 0.15;
    if (f.blink <= 0) { c.fillRect(X - 3, Y - 1 - stretch, 1, 1); c.fillRect(X + 3, Y - 1 - stretch, 1, 1); } c.fillStyle = '#e8f8c8'; c.fillRect(X - 1, Y + 2, 3, 1);
    if (!f.hop && Math.sin(t * 1.7) > 0.96) { c.fillStyle = '#eefad8'; c.fillRect(X - 1, Y + 3, 3, 2); } },
  poke(st, x, y, B) { const f = st.f; if (f.hop) return; let n = (f.pad + 1 + (Math.random() * 3 | 0)) % B.pads.length; if (n === f.pad) n = (n + 1) % B.pads.length; const p = B.pads[n]; f.hop = { x0: f.x, y0: f.y, x1: p[0], y1: p[1] - 2, t: 0 }; f.pad = n; },
};

// Bonsai pine on a stone in a glazed pot; tap for a breeze
SCENES.bonsai = { w: 64, h: 64,
  bake(seed) { const B = [0x2a1a12, 0x46301f, 0x664632, 0x8a6446, 0xa8805a];
    const pot = hi(48, 16, b => { const P = [0x1e2e5a, 0x2c4278, 0x3e5a98, 0x5a7ab8, 0x8aa6d6];
      b.rect(4, 2, 88, 4, (x, y) => y === 2 ? P[4] : P[3]); b.rect(4, 6, 88, 2, P[0]);
      for (let y = 8; y < 24; y++) { const ins = (y - 8) * 0.25; for (let x = Math.round(8 + ins); x < 88 - ins; x++) { const u = (x - 8) / 80; b.set(x, y, pick(P, 0.72 - u * 0.55 - (y - 8) / 16 * 0.25 + (h2(x >> 2, y >> 2, seed) - 0.5) * 0.12)); } }
      for (const fx of [14, 76]) { b.rect(fx, 24, 8, 5, P[0]); b.rect(fx, 24, 2, 5, P[2]); } b.line(20, 15, 76, 15, P[2], 1); }, 0x101828);
    const tree = hi(60, 26, b => {
      vol(b, 60, 10, 32, 5, [0x3a2e22, 0x4e3e2c, 0x665036], { k: -0.05 }); for (let k = 0; k < 40; k++) { const x = 32 + h2(k, 1, seed) * 56, y = 6 + h2(k, 2, seed) * 6; b.set(x, y, k & 1 ? 0x5a8a3e : 0x76a84e); }
      vol(b, 40, 4, 12, 9, [0x5a5660, 0x7a7680, 0x9a96a0, 0xbcb8c0], { fn: (u, v, x, y, l) => (Math.abs(u + v * 0.6) < 0.08 || Math.abs(u - 0.5 + v * 0.3) < 0.06) ? 0x4a4650 : (v < -0.55 && h2(x, y, seed) < 0.6 ? 0x6a9a4e : pick([0x5a5660, 0x7a7680, 0x9a96a0, 0xbcb8c0], l)) });
    }, null);
    const trunk = hi(64, 50, b => { const T = (x0, y0, x1, y1, w0, w1, k) => bark(b, [[x0, y0], [x1, y1]], w0, w1, B, seed + k);
      T(66, 96, 70, 80, 11, 9, 1); T(70, 82, 62, 68, 9, 7, 2); T(63, 70, 70, 56, 7, 5.5, 3); T(69, 58, 58, 44, 5.5, 4, 4); T(60, 46, 64, 34, 4, 3, 5);
      T(62, 70, 86, 62, 4.5, 2.6, 6); T(84, 63, 98, 66, 2.6, 1.8, 7); T(66, 58, 42, 50, 4, 2.4, 8); T(44, 51, 34, 52, 2.4, 1.6, 9); T(62, 44, 80, 38, 3, 2, 10);
      b.line(68, 84, 72, 70, B[4], 1); b.line(64, 66, 68, 58, B[4], 1); }, 0x1a100a);
    const G = [0x14321e, 0x1e4a28, 0x2e6434, 0x447c40, 0x62984e, 0x84b064];
    const pads = new Img(64, 64); for (const [cx, cy, rx] of [[17, 26, 9], [45, 20, 10], [50, 33, 7], [30, 15, 8], [24, 30, 6]]) crown(pads, [[cx, cy, rx, rx * 0.42], [cx - rx * 0.4, cy - 1.5, rx * 0.6, rx * 0.3]], G, seed + cx, cy - rx * 0.5, cy + rx * 0.45, { clumps: 30, sparks: 5, lx: cx - 3 });
    pads.outline(0x0e1a12);
    return { pot: pot.canvas(), tree: tree.canvas(), trunk: trunk.canvas(), pads: pads.canvas() }; },
  init(st) { st.sx = 0; st.sv = 0; st.cloud = Math.random() * 90; st.leaves = Petals(['#447c40', '#62984e', '#84b064'], { max: 8, rest: 2 }); },
  frame(c, st, dt, t, B) { st.cloud = (st.cloud + dt * 2.2) % 100; const cx = Math.round(st.cloud - 24); c.fillStyle = 'rgba(220,226,240,0.9)'; c.fillRect(cx, 8, 13, 2); c.fillStyle = '#ffffff'; c.fillRect(cx + 3, 6, 7, 2); c.fillRect(cx + 18, 11, 8, 1);
    const sh = spring(st, dt); c.drawImage(B.pot, 8, 46); c.drawImage(B.tree, 2, 42); sway(c, B.trunk, 12, 46, (Math.sin(t * 0.8) * 0.3 + sh) * 0.5); sway(c, B.pads, 10, 40, Math.sin(t * 0.8) * 0.5 + sh);
    if (Math.abs(st.sv) > 4 && Math.random() < 0.3) st.leaves.spawn(14 + Math.random() * 40, 22 + Math.random() * 10, st.sv * 0.4); st.leaves.step(dt, () => 47, 2); st.leaves.draw(c); },
  poke(st) { st.sv += 16; },
  hover: true,
};


// Torii on a hill with a stone path; the moon hangs behind. Tap for a shooting star.
SCENES.torii = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64), Rd = [0x7a1812, 0xa8281e, 0xd03e2c, 0xe8604a];
    g.ell(50, 8, 7, 7, (u, v) => { const r2 = u * u + v * v, d = (u - 0.3) ** 2 + (v + 0.15) ** 2; return r2 > 0.8 ? 0xd8ccae : d < 0.1 ? 0xe2d6bc : d < 0.18 ? 0xeae0c8 : (u + v < -0.5 ? 0xfffaf0 : 0xf4ecd8); }); g.set(48, 6, 0xd8d2c4); g.set(52, 9, 0xd8d2c4);
    for (const [x, y, w] of [[40, 10, 9], [54, 13, 8]]) { g.rect(x, y, w, 1, 0xe8ecf6); g.rect(x + 2, y - 1, w - 4, 1, 0xffffff); }
    const topAt = island(g, 32, 53, 27, 6, 6, GRASS, EARTH, seed);
    for (let y = 48; y < 60; y++) for (let x = 27; x < 38; x++) { const w = 3 + (y - 48) * 0.45; if (Math.abs(x + 0.5 - 32.5) < w && g.has(x, y) && y < 58) g.set(x, y, ((x + (y & 1) * 2) % 4 === 0 || y % 3 === 0) ? 0x7a746a : 0xa8a296); }
    for (const px of [20, 41]) { g.rect(px, 22, 4, 28, (x) => Rd[x === px ? 3 : x === px + 3 ? 0 : 2]); g.rect(px - 1, 48, 6, 2, 0x2a2224); }
    g.rect(16, 27, 32, 3, (x, y) => Rd[y === 27 ? 3 : 1]);
    for (let x = 11; x < 53; x++) { const lift = Math.round(Math.pow(Math.abs(x - 31.5) / 21, 3) * 3); g.set(x, 17 - lift, 0x2a2024); g.set(x, 18 - lift, x < 32 ? 0x4a3a3e : 0x3a2e32); g.rect(x, 19 - lift, 1, 2, Rd[x < 32 ? 3 : 2]); }
    g.rect(28, 21, 8, 6, (x, y) => (x === 28 || x === 35 || y === 21 || y === 26) ? 0x221a1e : 0xe8c86a); g.rect(30, 23, 4, 1, 0x8a6a2a); g.rect(30, 25, 3, 1, 0x8a6a2a);
    for (const lx of [11, 52]) { g.rect(lx - 1, 46, 3, 5, 0x7e7a72); g.rect(lx - 2, 43, 5, 3, 0x9a968e); g.set(lx, 44, 0xffd06a); g.rect(lx - 3, 42, 7, 1, 0x6e6a62); g.set(lx, 41, 0x9a968e); }
    g.outline(0x16101a, (x, y) => y > 14);
    return { g: g.canvas(), topAt }; },
  init(st) { st.star = null; st.next = 3 + Math.random() * 5; st.p = Petals(['#f6b8ca', '#ffd8e4'], { max: 6 }); },
  frame(c, st, dt, t, B) { c.drawImage(B.g, 0, 0);
    for (const [x, y, k] of [[8, 6, 0], [24, 3, 1], [60, 28, 2], [14, 15, 3], [28, 10, 4]]) { const a = Math.sin(t * 2 + k * 2.1); if (a > 0.3) { c.fillStyle = '#ffeaa0'; c.fillRect(x, y, 1, 1); if (a > 0.8) { c.fillStyle = 'rgba(255,234,160,0.5)'; c.fillRect(x - 1, y, 3, 1); c.fillRect(x, y - 1, 1, 3); } } }
    if ((st.next -= dt) <= 0 && !st.star) { st.star = { x: 62, y: 2 + Math.random() * 6 }; st.next = 7 + Math.random() * 9; }
    if (st.star) { const s = st.star; s.x -= dt * 60; s.y += dt * 16; for (let k = 0; k < 8; k++) { c.fillStyle = `rgba(255,240,190,${(1 - k / 8) * 0.95})`; c.fillRect(Math.round(s.x + k * 2), Math.round(s.y - k * 0.5), 1, 1); } if (s.x < -16) st.star = null; }
    for (const lx of [11, 52]) { c.fillStyle = `rgba(255,208,106,${0.55 + Math.sin(t * 7 + lx) * 0.25})`; c.fillRect(lx - 1, 44, 3, 1); }
    if (Math.random() < dt * 0.5) st.p.spawn(Math.random() * 64, 0, 3); st.p.step(dt, B.topAt, 2); st.p.draw(c); },
  poke(st) { st.star = { x: 62, y: 2 + Math.random() * 8 }; },
};

// Bamboo grove on an islet; stalks sway, leaves drift; tap to rustle
SCENES.bamboo = { w: 64, h: 64,
  bake(seed) { const back = new Img(64, 64), front = new Img(64, 64);
    const topAt = island(back, 32, 55, 26, 5, 6, GRASS, EARTH, seed);
    const Gf = [0x3e7a2c, 0x56963a, 0x74b04a, 0x9ccc62, 0xc6e48a], Gb = [0x2a5a28, 0x3a6e30, 0x4e8238, 0x6a9a48, 0x88b05a];
    const leaf = (img, x, y, ang, len, C) => { for (let i = 0; i < len; i++) { const t = i / len, w = t < 0.2 ? 1 : t < 0.65 ? 2 : 1, xx = x + Math.cos(ang) * i, yy = y + Math.sin(ang) * i + t * t * 2.2;
      for (let j = 0; j < w; j++) img.set(xx, yy + j, j === 0 ? C[t < 0.5 ? 3 : 2] : C[1]); } };
    const stalk = (img, x0, top, w, C, k) => {
      for (let y = top; y < 56; y++) { const node = (y + k * 5) % 10 === 0; for (let i = 0; i < w; i++) { const u = i / (w - 1 || 1); let c = u < 0.25 ? C[4] : u < 0.6 ? C[3] : u < 0.85 ? C[2] : C[1]; if (node) c = i === 0 ? C[4] : C[1]; if ((y + k * 5) % 10 === 1) c = C[0]; img.set(x0 + i, y, c); }
        if (node) { img.set(x0 - 1, y, C[1]); img.set(x0 + w, y, C[0]); } }
      for (let n = 0; n < 3; n++) { const ny = top + 6 + n * 13 + ((k * 3) % 5); if (ny > 44) break; const dir = (n + k) % 2 ? 1 : -1, bx = dir > 0 ? x0 + w : x0 - 1;
        img.line(bx, ny, bx + dir * 4, ny - 2, C[1]); for (let f = 0; f < 3; f++) leaf(img, bx + dir * 4, ny - 2, (dir > 0 ? 0 : Math.PI) + dir * (-0.45 + f * 0.45), 7 + (f & 1) * 2, C); } };
    const ks = [[6, 4, 3], [17, 0, 4], [26, 6, 3], [36, 1, 4], [46, 5, 3], [55, 2, 3]];
    ks.forEach(([x, top, w], k) => stalk(k % 2 ? back : front, x + (h2(k, 0, seed) * 2 | 0), top + 2, w, k % 2 ? Gb : Gf, k));
    back.outline(0x183a1a, (x, y) => y < 52); front.outline(0x16301a);
    return { back: back.canvas(), front: front.canvas(), topAt }; },
  init(st) { st.p = Petals(['#9ccc62', '#c6e48a', '#74b04a'], { max: 12 }); st.sx = 0; st.sv = 0; },
  frame(c, st, dt, t, B) { const sh = spring(st, dt), w = Math.sin(t * 0.6) * 1.1; sway(c, B.back, 2, 52, w * 0.8 + sh * 0.7); sway(c, B.front, 2, 52, w + sh);
    if (Math.random() < dt * (0.6 + Math.abs(st.sv) * 0.3)) st.p.spawn(4 + Math.random() * 56, 4 + Math.random() * 30, 3 + st.sv * 0.2); st.p.step(dt, B.topAt, 2); st.p.draw(c); },
  poke(st) { st.sv += 18; },
  hover: true,
};


// Snow-laden pine on a snowy islet; snowfall; tap/hover for a gust
SCENES.snow = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64), tree = new Img(64, 64), G = [0x163028, 0x1e4034, 0x2a5440, 0x3a6a4c], S = [0xb8c6dc, 0xdae4f0, 0xffffff];
    const topAt = island(g, 32, 55, 24, 5, 6, [0x9aaac4, 0xb8c6dc, 0xd2dcec, 0xe8eef6, 0xfafcff], [0x3a3240, 0x544a58, 0x6e6472, 0x8a8090, 0xa8a0b0], seed, { blades: false, stone: 0xe8eef6 });
    bark(g, [[32, 56], [32, 46]], 4, 3, [0x2a1a14, 0x3e281c, 0x56382a, 0x6e4a36], seed);
    for (let t = 4; t >= 0; t--) { const y0 = 5 + t * 8.2, y1 = y0 + 13, hw = 5 + t * 4.4;
      for (let y = Math.floor(y0); y <= y1; y++) { const f = (y - y0) / (y1 - y0), w = 1 + (hw - 1) * f, zig = ((y * 3 + t) % 4 < 2) ? 1 : 0;
        for (let x = Math.round(32 - w); x <= 32 + w; x++) { const u = (x - 32) / w, bot = y > y1 - 1.5 - zig; let c = G[Math.max(0, Math.min(3, Math.round(2.4 - u * 1.2 - f * 0.8)))]; if (bot) c = G[0];
          if (f < 0.42 + h2(x, t, seed) * 0.22 && u < 0.6 - f * 0.4) c = f < 0.2 || u < -0.35 ? S[2] : S[1]; if (bot && h2(x, y, seed) < 0.25) c = S[1]; tree.set(x, y, c); } } }
    tree.outline(0x0e1c18); for (let k = 0; k < 6; k++) { const x = 20 + k * 5, y = 56 + (k & 1); g.set(x, y, 0xb8c6dc); }
    return { g: g.canvas(), tree: tree.canvas(), topAt }; },
  init(st) { st.flakes = Array.from({ length: 40 }, () => ({ x: Math.random() * 64, y: Math.random() * 64, s: 4 + Math.random() * 7, ph: Math.random() * 6 })); st.sx = 0; st.sv = 0; st.fall = Petals(['#ffffff', '#dae4f0'], { max: 30, rest: 2 }); },
  frame(c, st, dt, t, B) { const sh = spring(st, dt); c.drawImage(B.g, 0, 0); sway(c, B.tree, 4, 47, Math.sin(t * 0.6) * 0.4 + sh);
    for (const f of st.flakes) { f.y += f.s * dt; f.x += (Math.sin(t + f.ph) * 3 + 2 + Math.abs(st.sv) * 0.6) * dt; if (f.y > 62) { f.y = -2; f.x = Math.random() * 64; } if (f.x > 64) f.x -= 64;
      c.fillStyle = f.s > 8 ? '#ffffff' : 'rgba(200,214,236,0.95)'; c.fillRect(Math.round(f.x), Math.round(f.y), 1, 1); }
    if (Math.abs(st.sv) > 3 && Math.random() < 0.7) st.fall.spawn(16 + Math.random() * 32, 8 + Math.random() * 38, st.sv * 0.4); st.fall.step(dt, B.topAt, 4); st.fall.draw(c); },
  poke(st) { st.sv += 20; },
  hover: true,
};

// A little waterfall over mossy rocks into a pool; mist and spray; tap to splash
SCENES.waterfall = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64), R = [0x34303a, 0x4a4552, 0x625c6a, 0x7c7684, 0x9a94a0, 0xbab4bc], M = [0x2e5a2a, 0x447a34, 0x5e9a42, 0x82b85a];
    island(g, 32, 53, 28, 6, 6, GRASS, EARTH, seed);
    const rocks = hi(64, 50, b => { // faceted boulders: lit top planes, darker fronts, crevices, moss caps
      const boulders = [[22, 34, 20, 15], [104, 30, 21, 17], [14, 64, 15, 14], [112, 62, 15, 14], [36, 58, 13, 12], [92, 56, 14, 13], [30, 86, 18, 12], [98, 86, 18, 12]];
      boulders.sort((a, b) => a[1] - b[1]).forEach(([cx, cy, rx, ry], i) => {
        for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = Math.max(Math.abs(u) * 0.85 + Math.abs(v) * 0.45, Math.hypot(u, v) * 0.92) + (noise(x * 0.2, y * 0.2, seed + i) - 0.5) * 0.25; if (d > 1) continue;
          const top = v < -0.25 + u * 0.15, side = u > 0.35; let l = top ? 0.85 - (v + 0.6) * 0.3 : side ? 0.28 : 0.52; l += (h2(x >> 2, y >> 2, seed + i) - 0.5) * 0.18; if (d > 0.9) l -= 0.25;
          let c = pick(R, l); if (top && noise(x * 0.25, y * 0.25, seed + 9 + i) > 0.5) c = pick(M, l); if (Math.abs(u * 0.7 - v + 0.2) < 0.04 && !top) c = R[0]; b.set(x, y, c); } }); }, 0x16141a);
    g.d.set(g.d); const pool = new Img(64, 64);
    for (let y = 44; y < 60; y++) for (let x = 0; x < 64; x++) { const u = (x + 0.5 - 32) / 17, v = (y + 0.5 - 52) / 5.4; if (u * u + v * v < 1) pool.set(x, y, pick([0x2e6e8c, 0x3a88a0, 0x5aa8b4, 0x7fc8c4], 0.2 + (1 - u * u - v * v) * 0.5 + bay(x, y) * 0.25)); }
    for (let k = 0; k < 9; k++) { const x = 4 + k * 7, y = 50; if (x > 14 && x < 50) continue; for (let j = 0; j < 4; j++) g.set(x + (j & 1), y - j, M[1 + (j > 1 ? 1 : 0)]); }
    return { g: g.canvas(), rocks: rocks.canvas(), pool: pool.canvas() }; },
  init(st) { st.drops = []; st.big = 0; },
  frame(c, st, dt, t, B) { c.drawImage(B.g, 0, 0); c.drawImage(B.pool, 0, 0); c.drawImage(B.rocks, 0, 2); if (st.big > 0) st.big -= dt;
    for (let x = 28; x < 37; x++) for (let y = 10; y < 49; y++) { const edge = x === 28 || x === 36, v = Math.sin((y - t * 40 + x * 3.1) * 0.5) + Math.sin(x * 1.9 + y * 0.05); c.fillStyle = edge ? '#2e6e8c' : v > 1.15 ? '#f2fcff' : v > 0.35 ? '#a8e0ee' : v > -0.6 ? '#62b0cc' : '#3e90b0'; c.fillRect(x, y, 1, 1); }
    c.fillStyle = '#ffffff'; for (let x = 27; x < 38; x++) if ((x + Math.floor(t * 12)) % 3) c.fillRect(x, 9 + ((x * 7 + Math.floor(t * 9)) % 2), 1, 1);
    if (Math.random() < dt * (16 + st.big * 40)) st.drops.push({ x: 27 + Math.random() * 11, y: 48, vx: (Math.random() - 0.5) * 22, vy: -12 - Math.random() * 16 - st.big * 10, t: 0 });
    for (const d of st.drops) { d.t += dt; d.vy += 60 * dt; d.x += d.vx * dt; d.y += d.vy * dt; c.fillStyle = d.t < 0.3 ? '#ffffff' : 'rgba(220,245,255,0.75)'; c.fillRect(Math.round(d.x), Math.round(d.y), 1, 1); }
    st.drops = st.drops.filter(d => d.y < 51 && d.t < 1.2);
    for (let k = 0; k < 7; k++) { const a = 0.22 + Math.sin(t * 1.3 + k) * 0.08; c.fillStyle = `rgba(244,252,255,${a})`; c.fillRect(Math.round(21 + k * 3 + Math.sin(t + k) * 2), 45 - (k % 3), 4, 2); }
    for (let k = 0; k < 4; k++) { const rr = ((t * 6 + k * 3) % 12); c.fillStyle = `rgba(230,250,255,${0.5 - rr / 24})`; c.fillRect(Math.round(32 - rr * 1.2), 51 + (k & 1), 1, 1); c.fillRect(Math.round(32 + rr * 1.2), 51 + (k & 1), 1, 1); } },
  poke(st) { st.big = 1; },
};


// Matcha bowl on a wooden tray with steam; a petal drifts down and lands on the tea; tap for another
SCENES.tea = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64), W = [0x5a3a24, 0x7a5232, 0x9a6c44, 0xb88a5a, 0xd0a474];
    const tray = hi(52, 14, b => { b.rect(4, 6, 96, 10, (x, y) => W[y < 8 ? 4 : y > 13 ? 0 : (x % 18 === 0 ? 1 : 2 + (h2(x >> 2, y, seed) < 0.3 ? 1 : 0))]); b.rect(10, 16, 8, 8, W[1]); b.rect(86, 16, 8, 8, W[0]); b.rect(10, 16, 2, 8, W[3]); }, 0x2a1a10);
    const bowl = hi(32, 22, b => { vol(b, 32, 26, 28, 18, [0x26303c, 0x34404e, 0x46566a, 0x627488, 0x8a9caa], { fn: (u, v, x, y, l) => v < -0.3 ? null : (Math.abs(v - 0.15 - Math.sin(x * 0.4) * 0.08) < 0.07 ? 0xd8c8a8 : (h2(x, y, seed) < 0.05 ? 0x9aaab8 : pick([0x26303c, 0x34404e, 0x46566a, 0x627488, 0x8a9caa], l))) });
      vol(b, 32, 18, 27, 7, [0x26303c, 0x34404e]); vol(b, 32, 18, 24, 5.6, [0x4a8a2a, 0x62a43a, 0x80bc4c, 0xa8d870], { k: 0.1 }); for (let k = 0; k < 10; k++) b.ell(18 + k * 3, 17 + (k & 1), 1, 0.6, 0xc8e898); b.rect(20, 42, 24, 3, 0x2a3440); }, 0x161a22);
    const scoop = hi(14, 6, b => { b.line(2, 8, 24, 4, 0xd8b878, 2); vol(b, 24, 4, 3, 2, [0xb8985a, 0xd8b878]); }, 0x5a4020);
    const whisk = hi(10, 14, b => { b.rect(8, 2, 5, 9, 0xb89060); b.rect(8, 2, 2, 9, 0xd8b480); for (let k = 0; k < 9; k++) { const x = 3 + k * 1.8; b.line(10.5, 11, x, 20, 0xead8a8, 1); b.line(x, 20, 10.5 + (x - 10.5) * 0.4, 27, k % 2 ? 0xf4e4b8 : 0xdcc490, 1); } vol(b, 10.5, 24, 5, 3.6, [0xc8b080, 0xe8d4a4], { k: 0.2 }); }, 0x5a4020);
    return { tray: tray.canvas(), bowl: bowl.canvas(), scoop: scoop.canvas(), whisk: whisk.canvas() }; },
  draw0(c, B) { c.drawImage(B.tray, 6, 44); c.drawImage(B.bowl, 14, 27); c.drawImage(B.scoop, 44, 44); c.drawImage(B.whisk, 6, 34); },
  init(st) { st.steam = []; st.petal = null; st.rings = []; st.next = 2; },
  frame(c, st, dt, t, B) { SCENES.tea.draw0(c, B);
    if (Math.random() < dt * 6) st.steam.push({ x: 22 + Math.random() * 16, y: 33, t: 0, ph: Math.random() * 6 });
    for (const s of st.steam) { s.t += dt; s.y -= dt * 5; s.x += Math.sin(s.t * 2 + s.ph) * dt * 3; c.fillStyle = `rgba(240,240,248,${Math.max(0, 0.5 - s.t * 0.17)})`; c.fillRect(Math.round(s.x), Math.round(s.y), 1, s.t > 1.5 ? 2 : 1); } st.steam = st.steam.filter(s => s.t < 3);
    if (!st.petal && (st.next -= dt) <= 0) { st.petal = { x: 14 + Math.random() * 12, y: -2, t: 0 }; st.next = 8 + Math.random() * 6; }
    const P = st.petal; if (P) { P.t += dt; if (!P.land) { P.y += dt * 8; P.x += Math.sin(P.t * 2) * dt * 8 + dt * 3; if (P.y >= 35 && Math.abs(P.x - 30) < 10) { P.land = 1; st.rings.push({ x: P.x, y: 36, t: 0 }); } if (P.y > 64) st.petal = null; } else P.land += dt;
      c.fillStyle = '#f6b8ca'; const f = ((P.t * 2) | 0) % 3; c.fillRect(Math.round(P.x), Math.round(P.y), f === 1 ? 1 : 2, f === 2 ? 2 : 1); c.fillStyle = '#ffd8e4'; c.fillRect(Math.round(P.x), Math.round(P.y), 1, 1); if (P.land > 6) st.petal = null; }
    for (const r of st.rings) { r.t += dt; const rr = 1 + r.t * 6; c.fillStyle = `rgba(200,240,170,${Math.max(0, 0.7 - r.t)})`; for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283; c.fillRect(Math.round(r.x + Math.cos(a) * rr), Math.round(r.y + Math.sin(a) * rr * 0.35), 1, 1); } } st.rings = st.rings.filter(r => r.t < 0.8); },
  poke(st) { if (!st.petal) st.petal = { x: 10 + Math.random() * 20, y: -2, t: 0 }; },
};

// ---- sculpted sprites (2x) for the creature scenes ----
const GINGER = [0x7a3418, 0xa8541f, 0xd27a34, 0xeea05a, 0xfccc92], CWHITE = [0xc8b8a8, 0xe8dccc, 0xfff6ea, 0xffffff], STRIPE = 0x9a4618;
function catSleep(breath) { return hi(40, 24, g => {
  vol(g, 30, 33, 20, 12 + breath, GINGER, { fn: (u, v, x, y, l) => (Math.sin(Math.atan2(v, u) * 6) > 0.55 && v < 0.5) ? STRIPE : pick(GINGER, l) });            // curled body
  vol(g, 15, 30, 10, 11, GINGER, { k: -0.05 });                                                                                                                   // haunch
  vol(g, 40, 41, 26, 5, GINGER, { k: 0.05 }); vol(g, 62, 41, 6, 4, CWHITE);                                                                                     // tail wrapped in front, white tip
  vol(g, 56, 36, 7, 4, CWHITE);                                                                                                                                   // front paws
  vol(g, 58, 27, 11, 9.5, GINGER, { fn: (u, v, x, y, l) => v > 0.25 && Math.abs(u) < 0.45 ? pick(CWHITE, l + 0.2) : (v < -0.3 && Math.abs(u) < 0.15 ? STRIPE : pick(GINGER, l)) }); // head
  for (const ex of [49, 63]) { g.line(ex, 21, ex + 2, 12, GINGER[2], 5); g.line(ex + 1, 19, ex + 2, 14, 0xf0a0a0, 2); }                                           // ears
  g.line(52, 28, 56, 29, 0x2a1a14, 1.4); g.line(60, 29, 64, 28, 0x2a1a14, 1.4); g.ell(58, 32, 1.4, 1, 0xd86a7a);                                                  // shut eyes, nose
}, 0x3a1a0c); }
function catSit(eyes, tail) { return hi(40, 30, g => {
  vol(g, 18, 46, 13, 13, GINGER, { fn: (u, v, x, y, l) => (Math.sin((y) * 0.5) > 0.6 && u < 0.4) ? STRIPE : pick(GINGER, l) });  // body
  vol(g, 30, 46, 7, 13, CWHITE, { k: 0.05 });                                                                                     // chest
  g.line(28, 50, 30, 58, CWHITE[1], 5); g.line(34, 50, 36, 58, CWHITE[2], 5);                                                      // front legs
  g.line(8, 54, 2 - tail, 44 - tail * 2, GINGER[2], 5); g.line(2 - tail, 44 - tail * 2, 6 - tail, 34, GINGER[3], 4);               // tail up
  vol(g, 30, 26, 12, 10.5, GINGER, { fn: (u, v, x, y, l) => v > 0.2 && Math.abs(u) < 0.5 ? pick(CWHITE, l + 0.2) : (v < -0.3 && Math.abs(u) < 0.12 ? STRIPE : pick(GINGER, l)) });
  for (const ex of [20, 36]) { g.line(ex + 2, 19, ex + 4, 8, GINGER[2], 6); g.line(ex + 3, 17, ex + 4, 11, 0xf0a0a0, 2); }
  if (eyes) { for (const ex of [24, 34]) { g.ell(ex, 26, 2.2, 2.6, 0x16101a); g.set(ex - 1, 25, 0xffffff); g.set(ex - 1, 26, 0xffffff); } } else { g.line(22, 27, 26, 27, 0x2a1a14, 1.4); g.line(32, 27, 36, 27, 0x2a1a14, 1.4); }
  g.ell(29, 31, 1.6, 1.1, 0xd86a7a); g.line(27, 33, 31, 33, 0x9a5a4a, 1);
}, 0x3a1a0c); }
function catStretch() { return hi(44, 26, g => {
  vol(g, 30, 30, 20, 8, GINGER, { rot: 0.28, fn: (u, v, x, y, l) => (Math.sin(x * 0.45) > 0.6 && v < 0.4) ? STRIPE : pick(GINGER, l) });
  g.line(12, 30, 6, 46, GINGER[2], 6); g.line(18, 32, 14, 46, GINGER[1], 6); g.line(44, 38, 62, 46, CWHITE[1], 5); g.line(46, 40, 66, 46, CWHITE[2], 5);  // hind & fore legs
  g.line(10, 26, 4, 10, GINGER[3], 5);                                                                                                                       // tail high
  vol(g, 58, 38, 10, 9, GINGER, { fn: (u, v, x, y, l) => v > 0.2 && Math.abs(u) < 0.5 ? pick(CWHITE, l + 0.2) : pick(GINGER, l) });
  for (const ex of [50, 62]) { g.line(ex, 32, ex + 2, 22, GINGER[2], 5); }
  g.line(52, 38, 56, 39, 0x2a1a14, 1.4); g.line(60, 39, 64, 38, 0x2a1a14, 1.4); g.ell(58, 43, 3, 2.4, 0xc84a5a); g.ell(58, 44, 1.6, 1.4, 0xf28a9a); // yawn
}, 0x3a1a0c); }
const RAB = [0xb8b0a8, 0xd8d2cc, 0xf2eeea, 0xffffff];
function rabbitFrame(k) { return hi(34, 32, g => { // seated moon rabbit facing right; k: mallet 0 (raised) .. 1 (struck)
  const a = -2.25 + k * 2.55, px = 40, py = 40, ex = px + Math.cos(a) * 24, ey = py + Math.sin(a) * 24;
  if (k < 0.5) { g.line(px, py, ex, ey, 0x7a4e2c, 3.4); vol(g, ex, ey, 7, 5, [0x5a3a20, 0x8a5a34, 0xb07c4a, 0xd0a06a], { rot: a + Math.PI / 2 }); }   // mallet behind the head when raised
  vol(g, 22, 46, 15, 13, RAB, { k: 0.02 });                                   // round body
  vol(g, 10, 52, 8, 7, RAB, { k: 0.06 }); vol(g, 6, 44, 4.5, 4.5, CWHITE, { k: 0.2 }); // haunch, cotton tail
  vol(g, 14, 58, 9, 3, [0xc8c0b8, 0xe0dad4]);                                // hind foot
  g.line(27, 17, 17, 3, RAB[1], 7); g.line(27, 17, 18, 5, 0xf2b4c0, 2.4);     // back ear
  g.line(31, 17, 31, 1, RAB[2], 7); g.line(31, 16, 31, 4, 0xf6c2cc, 2.6);     // front ear (pink inner)
  vol(g, 32, 27, 11, 10, RAB, { k: 0.06 });                                   // head
  vol(g, 40, 31, 5.5, 4.5, [0xe8e2dc, 0xfaf6f2, 0xffffff], { k: 0.1 });        // muzzle
  g.ell(35, 25, 2.4, 2.8, 0x8a1a2a); g.ell(35, 25, 1.4, 1.8, 0xd02a3a); g.set(34, 24, 0xffffff); // ruby eye
  g.ell(44, 30, 1.4, 1.1, 0xe07a8a); g.set(41, 34, 0xc89aa0); g.ell(30, 31, 2.2, 1.4, 0xf8c8d0); // nose, mouth, blush
  if (k >= 0.5) { g.line(px, py, ex, ey, 0x7a4e2c, 3.4); vol(g, ex, ey, 7, 5, [0x5a3a20, 0x8a5a34, 0xb07c4a, 0xd0a06a], { rot: a + Math.PI / 2 }); }  // struck mallet in front
  vol(g, 38, 41, 4.4, 3.6, RAB, { k: 0.15 }); vol(g, 43, 40, 3.6, 3, RAB, { k: 0.2 }); // paws gripping the handle
}, 0x4e4448); }
const HERON = [0x5a606c, 0x7e8490, 0xa8aeb8, 0xd8dce4, 0xf6f8fa];
function heronStand(dip) { return hi(26, 30, g => {
  vol(g, 24, 34, 13, 8, HERON, { rot: -0.25 }); vol(g, 14, 38, 8, 4, [0x3e444e, 0x5a606c, 0x6e7480], { rot: -0.5 }); // body & dark tail plumes
  vol(g, 26, 30, 9, 5, HERON, { rot: -0.25, k: 0.12 });
  const nx = 32 + dip * 10, ny = 10 + dip * 26; g.line(32, 28, 30 + dip * 4, 18 + dip * 10, HERON[3], 5); g.line(30 + dip * 4, 18 + dip * 10, nx, ny, HERON[4], 4);
  vol(g, nx, ny, 5, 4, HERON, { k: 0.25 }); g.line(nx - 4, ny - 2, nx - 11, ny - 1, 0x2a2a30, 1.6); g.ell(nx + 1, ny - 1, 1.2, 1.2, 0x16101a); g.set(nx + 1, ny - 2, 0xffffff);
  g.line(nx + 4, ny, nx + 14, ny + 1 + dip * 4, 0xe8b030, 2.4);
}, 0x2a2e36); }
function heronFly(f) { return hi(30, 18, g => {
  vol(g, 30, 18, 14, 5, HERON); vol(g, 46, 14, 5, 4, HERON, { k: 0.2 }); g.line(50, 14, 58, 15, 0xe8b030, 2); g.ell(47, 13, 1, 1, 0x16101a); g.line(16, 19, 6, 20, 0xb8a070, 2);
  const wy = f ? -12 : 12; g.poly ? 0 : 0; for (let k = 0; k < 14; k++) { const t = k / 13; g.line(26 + t * 8, 16, 18 + t * 10, 16 + wy * (1 - t * 0.3), HERON[k < 4 ? 1 : 2], 3); }
}, 0x2a2e36); }

// ---- creature scenes (replace the earlier versions) ----
SCENES.cat = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64), S = [0x6a6460, 0x847e78, 0x9e9890, 0xbab4aa, 0xd2ccc2];
    for (let y = 38; y < 60; y++) for (let x = 5; x < 59; x++) { const row = Math.floor((y - 38) / 7), off = (row & 1) * 7, bx = Math.floor((x + off) / 14), ly = (y - 38) % 7, lx = (x + off) % 14;
      const mortar = ly === 6 || lx === 0; const base = h2(bx, row, seed); let q = 1 + (base * 2.4 | 0); if (ly === 0) q++; if (lx === 13 || ly === 5) q--; if (h2(x, y, seed) < 0.06) q--;
      g.set(x, y, mortar ? 0x4a4440 : S[Math.max(0, Math.min(4, q))]); }
    for (let x = 3; x < 61; x++) for (let y = 33; y < 38; y++) g.set(x, y, y === 33 ? 0x8aa0c8 : y === 34 ? 0x5a6e98 : y === 37 ? 0x1e2436 : ((x + (y & 1) * 2) % 4 === 0 ? 0x2e3a56 : 0x3e4c6c));
    for (let k = 0; k < 30; k++) { const x = 6 + h2(k, 3, seed) * 52 | 0, y = 39 + h2(k, 4, seed) * 20 | 0; if (h2(k, 5, seed) < 0.5) { g.set(x, y, 0x5a8a4a); g.set(x + 1, y, 0x6a9a50); g.set(x, y + 1, 0x4a7a3a); } }
    // ivy trailing down the wall + a morning glory
    for (let y = 38; y < 60; y++) { const x = 52 + Math.round(Math.sin(y * 0.5) * 2); g.set(x, y, 0x3a6a2e); if (y % 3 === 0) { g.set(x + 1, y, 0x5a9a3e); g.set(x - 1, y - 1, 0x6aaa4a); } } g.ell(50, 44, 2, 1.6, 0x7a8ae8); g.set(50, 44, 0xffffff);
    for (let x = 2; x < 62; x++) for (let y = 60; y < 64; y++) g.set(x, y, h2(x, y, seed) < 0.4 ? 0x3e6a32 : 0x4e7a3a);
    g.outline(0x1a1618, (x, y) => y > 30);
    const sleep = [catSleep(0), catSleep(1)].map(i => i.canvas()), sit = [catSit(true, 0), catSit(true, 2), catSit(false, 1)].map(i => i.canvas()), stretch = catStretch().canvas();
    return { g: g.canvas(), sleep, sit, stretch }; },
  init(st) { st.mode = 'sleep'; st.mt = 0; st.z = []; st.hearts = []; },
  frame(c, st, dt, t, B) { c.drawImage(B.g, 0, 0); st.mt += dt;
    if (st.mode === 'sleep') { c.drawImage(B.sleep[Math.sin(t * 1.8) > 0 ? 1 : 0], 14, 11); if (Math.random() < dt * 0.7) st.z.push({ x: 47, y: 14, t: 0 }); }
    else if (st.mode === 'sit') { c.drawImage(B.sit[st.mt > 1.6 ? 2 : (Math.sin(t * 5) > 0 ? 0 : 1)], 20, 4); if (st.mt > 0.9 && st.mt < 1.6 && Math.random() < dt * 5) st.hearts.push({ x: 34 + Math.random() * 6, y: 8, t: 0 }); if (st.mt > 2.4) { st.mode = 'stretch'; st.mt = 0; } }
    else { c.drawImage(B.stretch, 12, 10); if (st.mt > 1.3) { st.mode = 'sleep'; st.mt = 0; } }
    for (const z of st.z) { z.t += dt; z.x += dt * 3; z.y -= dt * 4.5; const a = Math.max(0, 1 - z.t / 2.4), s = z.t > 1.2 ? 1 : 0; c.fillStyle = `rgba(90,96,140,${a})`; c.fillRect(Math.round(z.x), Math.round(z.y), 3 + s, 1); c.fillRect(Math.round(z.x) + 1 + s, Math.round(z.y) + 1, 1, 1); c.fillRect(Math.round(z.x), Math.round(z.y) + 2, 3 + s, 1); } st.z = st.z.filter(z => z.t < 2.4);
    for (const h of st.hearts) { h.t += dt; h.y -= dt * 8; const x = Math.round(h.x + Math.sin(h.t * 6)), y = Math.round(h.y); c.fillStyle = `rgba(232,80,110,${Math.max(0, 1 - h.t)})`; c.fillRect(x - 1, y, 1, 1); c.fillRect(x + 1, y, 1, 1); c.fillRect(x - 1, y + 1, 3, 1); c.fillRect(x, y + 2, 1, 1); } st.hearts = st.hearts.filter(h => h.t < 1); },
  poke(st) { if (st.mode === 'sleep') { st.mode = 'sit'; st.mt = 0; st.z = []; } },
};
SCENES.rabbit = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64);
    const moon = hi(32, 32, b => { vol(b, 32, 32, 28, 28, [0xd8ccae, 0xe8dec4, 0xf4ecd8, 0xfffaee], { k: 0.15, fn: (u, v, x, y, l) => { let c = pick([0xd8ccae, 0xe8dec4, 0xf4ecd8, 0xfffaee], l + 0.2);
      for (const [cx, cy, r] of [[22, 20, 5], [38, 36, 7], [24, 42, 4], [42, 18, 3.5], [34, 26, 2.5]]) { const d = Math.hypot(x - cx, y - cy) / r; if (d < 1) c = d > 0.72 && (x - cx) + (y - cy) > 0 ? 0xfffaee : d > 0.7 ? 0xc8bc9e : 0xdcd0b4; } return c; } }); }, 0xc8b890);
    g.d.set(g.d); const topAt = island(g, 32, 55, 26, 5, 6, [0x56663e, 0x6a7a4a, 0x7e8e56, 0x96a466, 0xb0ba78], EARTH, seed);
    for (const [x, y] of [[9, 53], [12, 51], [53, 52], [56, 54], [59, 53]]) { for (let j = 0; j < 9; j++) g.set(x + (j > 6 ? 1 : 0), y - j, j > 6 ? 0xe8d898 : (j & 1 ? 0xb8a868 : 0xa89858)); g.set(x + 2, y - 9, 0xf2e6b0); g.set(x + 1, y - 10, 0xfff2c8); }
    const usu = hi(18, 13, b => { b.rect(6, 12, 24, 12, (x, y) => [0x4a3420, 0x6a4a2e, 0x8a643e, 0xa87c4c][x < 10 ? 3 : x > 25 ? 0 : (y & 3 ? 2 : 1)]); vol(b, 18, 24, 12, 3, [0x3a2818, 0x5a4028]); vol(b, 18, 12, 13, 5, [0x5a4028, 0x7a5a3a, 0x9a7650, 0xb89068]);
      vol(b, 18, 10, 10, 4, [0xd8d0c4, 0xece6dc, 0xfaf6f0, 0xffffff], { k: 0.1 }); }, 0x2a1a10);
    const dango = hi(10, 8, b => { b.line(2, 13, 18, 13, 0x8a6a4a, 2); for (const [x, c] of [[5, 0xf6b8ca], [10, 0xfaf6f0], [15, 0x9ccc6a]]) vol(b, x, 8, 3.4, 3.2, [mul(c, 0.75), c, mix(c, 0xffffff, 0.4)]); }, 0x3a2a2a);
    return { g: g.canvas(), moon: moon.canvas(), usu: usu.canvas(), dango: dango.canvas(), frames: [0, 0.4, 0.75, 1].map(k => rabbitFrame(k).canvas()) }; },
  init(st) { st.ph = 0; st.speed = 1; st.puffs = []; },
  frame(c, st, dt, t, B) { c.drawImage(B.moon, 30, 2); for (const [x, y, w] of [[24, 16, 12], [50, 26, 10]]) { c.fillStyle = 'rgba(232,236,248,0.9)'; c.fillRect(x + Math.round(Math.sin(t * 0.3) * 2), y, w, 1); c.fillStyle = '#ffffff'; c.fillRect(x + 2 + Math.round(Math.sin(t * 0.3) * 2), y - 1, w - 4, 1); }
    c.drawImage(B.g, 0, 0); c.drawImage(B.dango, 3, 45); st.speed += (1 - st.speed) * dt * 0.6; st.ph = (st.ph + dt * 1.2 * st.speed) % 1;
    const k = st.ph < 0.62 ? st.ph / 0.62 * 0.25 : Math.min(1, 0.25 + (st.ph - 0.62) / 0.2 * 0.75), fi = k < 0.2 ? 0 : k < 0.6 ? 1 : k < 0.95 ? 2 : 3;
    c.drawImage(B.usu, 38, 42); c.drawImage(B.frames[fi], 10, 21);
    if (fi === 3 && !st.was) for (let i = 0; i < 6; i++) st.puffs.push({ x: 46 + (Math.random() - 0.5) * 8, y: 46, vx: (Math.random() - 0.5) * 18, vy: -10 - Math.random() * 12, t: 0 }); st.was = fi === 3;
    for (const p of st.puffs) { p.t += dt; p.vy += 40 * dt; p.x += p.vx * dt; p.y += p.vy * dt; c.fillStyle = '#fffaf0'; c.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); } st.puffs = st.puffs.filter(p => p.t < 0.6); },
  poke(st) { st.speed = 3.5; },
};


// ---- rebuilt: Fuji (no hard edges), wind chime (sculpted glass bell), incense burner (bronze koro) ----
SCENES.heron = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64);
    const topAt = island(g, 32, 50, 29, 9, 6, GRASS, EARTH, seed);
    for (let y = 40; y < 62; y++) for (let x = 0; x < 64; x++) { const u = (x + 0.5 - 32) / 20, v = (y + 0.5 - 51) / 6.5, d = u * u + v * v + (noise(x * 0.3, y * 0.3, seed) - 0.5) * 0.35; if (d < 1 && g.has(x, y)) g.set(x, y, d > 0.84 ? 0x3a2a1e : pick([0x8fd2cc, 0x6ab8c0, 0x4a98ac, 0x387c98], (1 - d) * 1.2 + bay(x, y) * 0.3)); }
    for (let k = 0; k < 22; k++) { const x = 3 + h2(k, 1, seed) * 58 | 0, h = 9 + h2(k, 2, seed) * 16 | 0, y0 = topAt(x) + 3; if (y0 > 900 || (x > 14 && x < 50)) continue; const lean = (h2(k, 3, seed) - 0.5) * 3;
      for (let j = 0; j < h; j++) { const xx = x + Math.round(lean * (j / h) ** 2); g.set(xx, y0 - j, j < h * 0.4 ? 0x3e6a2c : j < h * 0.8 ? 0x5a8a36 : 0x7aa848); } if (k % 3 === 0) { g.rect(x + Math.round(lean) - 0, y0 - h - 3, 2, 4, 0x6a3a1e); g.set(x + Math.round(lean), y0 - h - 3, 0x8a5a2e); } }
    for (const [x, y] of [[20, 49], [44, 54]]) { g.ell(x, y, 3.2, 1.8, (u, v) => (u > 0 && Math.abs(v) < 0.2) ? null : v < -0.3 ? 0x86c45a : 0x4e9a42); }
    return { g: g.canvas(), stand: [0, 0.5, 1].map(d => heronStand(d).canvas()), fly: [heronFly(0).canvas(), heronFly(1).canvas()] }; },
  init(st) { st.h = { fly: 0, dip: 0 }; st.rip = []; },
  frame(c, st, dt, t, B) { c.drawImage(B.g, 0, 0); const H = st.h;
    for (const r of st.rip) { r.t += dt; const rr = 2 + r.t * 9; c.fillStyle = `rgba(230,250,255,${Math.max(0, 0.7 - r.t)})`; for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283; c.fillRect(Math.round(r.x + Math.cos(a) * rr), Math.round(r.y + Math.sin(a) * rr * 0.5), 1, 1); } } st.rip = st.rip.filter(r => r.t < 0.7);
    if (H.fly > 0) { H.fly += dt; const k = H.fly, x = 34 + Math.sin(k * 1.3) * 26 - 15, y = 40 - Math.sin(Math.min(1, k / 3.2) * Math.PI) * 32;
      c.drawImage(B.fly[Math.sin(k * 12) > 0 ? 1 : 0], Math.round(x), Math.round(y)); if (k > 3.2) { H.fly = 0; st.rip.push({ x: 34, y: 52, t: 0 }); } return; }
    if (H.dip <= 0 && Math.random() < dt * 0.22) H.dip = 1.4; if (H.dip > 0) H.dip -= dt; const d = H.dip > 0 ? Math.sin((1.4 - H.dip) / 1.4 * Math.PI) : 0;
    c.fillStyle = '#a89060'; c.fillRect(31, 41, 1, 11); c.fillRect(30, 51, 3, 1); c.fillStyle = '#c8b080'; c.fillRect(28, 41, 1, 11); c.fillRect(26, 51, 3, 1); c.fillRect(28, 46, 1, 1);
    c.drawImage(B.stand[d > 0.7 ? 2 : d > 0.25 ? 1 : 0], 18, 23); if (d > 0.9 && Math.random() < 0.3) st.rip.push({ x: 41, y: 51, t: 0 }); },
  poke(st) { if (!st.h.fly) st.h.fly = 0.01; },
};

SCENES.fuji = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64), cl = new Img(64, 64), cl2 = new Img(64, 64);
    g.ell(32, 31, 12, 12, (u, v) => u * u + v * v < 0.3 ? 0xfff4d0 : u * u + v * v < 0.65 ? 0xffd890 : 0xf6b06a);
    for (const [y, w] of [[24, 30], [28, 34], [33, 30]]) g.rect(32 - w / 2, y, w, 1, null);
    const M = [0x2e2a5a, 0x3e3a6e, 0x524c82, 0x6a6496, 0x8680ae], SN = [0x9aa6c8, 0xbcc6de, 0xdce4f2, 0xffffff];
    const peak = hi(64, 44, b => { for (let y = 6; y < 88; y++) { const hw = 5 + (y - 6) * 0.62 + Math.max(0, y - 56) * 0.55; for (let x = Math.round(64 - hw); x <= 64 + hw; x++) { if (x < 0 || x >= 128) continue;
      const u = (x - 64) / hw, gully = Math.sin(u * 9 + y * 0.03) * 0.6 + Math.sin(u * 23) * 0.25, l = 0.66 - u * 0.5 + gully * 0.13 - (y - 6) / 82 * 0.2 + (noise(x * 0.12, y * 0.06, seed) - 0.5) * 0.1;
      const snowLine = 30 + Math.round(gully * 7 + Math.abs(u) * 6 + noise(x * 0.2, 2, seed) * 4); b.set(x, y, y < snowLine ? pick(SN, l + 0.15) : pick(M, l)); } } });
    g.d.set(g.d); const P = peak.canvas();
    for (let k = 0; k < 7; k++) { const x = 8 + k * 8 + h2(k, 4, seed) * 4; for (let j = 0; j < 6; j++) g.rect(Math.round(x - j * 0.7), 44 + j, Math.max(1, Math.round(j * 1.4)), 1, null); }
    for (let k = 0; k < 34; k++) { const x = 3 + h2(k, 5, seed) * 58, y = 48 + h2(k, 6, seed) * 6 - Math.abs(x - 32) * 0.06, rr = 2.4 + h2(k, 7, seed) * 3.4 * (1 - Math.abs(x - 32) / 44); cl.ell(x, y, rr * 1.5, rr, (u, v) => v < -0.45 ? 0xffffff : v < 0.15 ? 0xf6e6f0 : u > 0.35 ? 0xd2bed8 : 0xe4d2e4); }
    for (let k = 0; k < 5; k++) { const x = 8 + h2(k, 8, seed) * 48, y = 38 + h2(k, 9, seed) * 8; cl2.ell(x, y, 4, 1.4, (u, v) => v < 0 ? 0xffffff : 0xeae0f0); }
    cl.outline(0xb8a4c4, (x, y) => true);
    return { g: g.canvas(), peak: P, cl: cl.canvas(), cl2: cl2.canvas() }; },
  init(st) { st.birds = []; st.next = 1; st.d1 = 0; st.d2 = 30; },
  frame(c, st, dt, t, B) { st.d1 = (st.d1 + dt * 1.4) % 64; st.d2 = (st.d2 + dt * 3) % 64; c.drawImage(B.g, 0, 0); c.drawImage(B.peak, 0, 8);
    c.drawImage(B.cl2, Math.round(Math.sin(t * 0.3) * 3), 0); c.drawImage(B.cl, Math.round(Math.sin(t * 0.2 + 1) * 1.5), 0);
    if ((st.next -= dt) <= 0) { st.next = 6 + Math.random() * 6; for (let k = 0; k < 3; k++) st.birds.push({ x: -4 - k * 7, y: 10 + k * 3 + Math.random() * 4, t: Math.random() * 6 }); }
    for (const b of st.birds) { b.t += dt; b.x += dt * 9; const f = Math.sin(b.t * 6) > 0, x = Math.round(b.x), y = Math.round(b.y + Math.sin(b.t * 1.5)); c.fillStyle = '#2a2440'; c.fillRect(x, y, 1, 1); c.fillRect(x - 1, y + (f ? -1 : 1), 1, 1); c.fillRect(x + 1, y + (f ? -1 : 1), 1, 1); if (f) { c.fillRect(x - 2, y - 1, 1, 1); c.fillRect(x + 2, y - 1, 1, 1); } }
    st.birds = st.birds.filter(b => b.x < 70); },
  poke(st) { for (let k = 0; k < 5; k++) st.birds.push({ x: -2 - k * 5, y: 8 + Math.abs(k - 2) * 3 + Math.random() * 3, t: k }); },
};
SCENES.chime = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64), W = [0x3a2418, 0x5a3a26, 0x7a5236, 0x9a6c46, 0xb8885a], T = [0x26304a, 0x34405e, 0x485878, 0x62749a];
    const eave = hi(64, 16, b => { b.rect(28, 14, 72, 8, (x, y) => W[y < 16 ? 4 : y > 19 ? 0 : 2]); for (let x = 32; x < 96; x += 10) { b.rect(x, 22, 4, 5, W[1]); b.rect(x, 22, 1, 5, W[3]); }
      for (let y = 0; y < 14; y++) for (let x = 20 + Math.round((14 - y) * 0.6); x < 108 - Math.round((14 - y) * 0.6); x++) { const row = y >> 2, col = (x + (row & 1) * 5) % 10; b.set(x, y, (y & 3) === 3 ? T[0] : col < 2 ? T[1] : col < 4 ? T[3] : T[2]); }
      for (let x = 22; x < 104; x += 10) vol(b, x + 5, 14, 4, 3, T, { k: 0.1 }); vol(b, 20, 9, 5, 6, T, { k: 0.2 }); vol(b, 108, 9, 5, 6, T, { k: 0.1 }); }, 0x14121e);
    const bell = hi(24, 20, b => { b.d.fill(0); vol(b, 24, 20, 19, 17, [0x5a90a8, 0x88c0d4, 0xb8e0ec, 0xe8f8fc], { fn: (u, v, x, y, l) => v > 0.62 ? null : (u * u + v * v < 0.12 && u < 0) ? 0xffffff : pick([0x5a90a8, 0x88c0d4, 0xb8e0ec, 0xe8f8fc], l) });
      b.line(6, 31, 42, 31, 0x3a6a84, 2.4); vol(b, 16, 18, 5, 3.2, [0xa8201a, 0xd8382e, 0xff6a50], { rot: -0.3 }); b.line(12, 17, 7, 13, 0xd8382e, 2.6); b.line(12, 19, 7, 23, 0xd8382e, 2.6); b.ell(19, 17, 1, 1, 0x16101a);
      b.line(30, 27, 33, 15, 0x3a8a4a, 1.6); b.line(34, 27, 36, 18, 0x4aa05a, 1.6); vol(b, 24, 4, 4, 2.4, [0x3a2a1e, 0x6a4a2e]); b.line(10, 8, 14, 5, 0xffffff, 1.4); }, 0x234a5e);
    const branch = hi(26, 22, b => { b.line(52, 40, 18, 22, W[1], 4); b.line(30, 28, 22, 10, W[1], 2.5); b.line(40, 33, 44, 18, W[0], 2);
      for (const [x, y, r] of [[20, 20, 5], [28, 26, 4.5], [38, 30, 5], [46, 36, 4.5], [22, 9, 4], [44, 17, 4], [14, 26, 3.6]]) { vol(b, x, y, r, r * 0.9, [0xc4607e, 0xe8869a, 0xf8b0bc, 0xffd8e0]); b.ell(x, y, 1.2, 1.2, 0xf2c24a); } }, 0x6a2e4a);
    g.d.set(g.d); return { eave: eave.canvas(), bell: bell.canvas(), branch: branch.canvas() }; },
  init(st) { st.a = 0; st.av = 0; st.rings = []; st.p = Petals(['#f8b0bc', '#ffd8e0', '#e8869a'], { max: 8 }); },
  frame(c, st, dt, t, B) { const wind = Math.sin(t * 0.9) * 0.25 + Math.sin(t * 2.3) * 0.12; st.av += (-st.a * 18 - st.av * 1.8 + wind * 6) * dt; st.a += st.av * dt;
    c.drawImage(B.branch, 36, 16); c.drawImage(B.eave, 0, 2); const ang = st.a * 0.35, bx = Math.round(Math.sin(ang) * 9);
    c.fillStyle = '#4a3428'; for (let k = 0; k < 9; k++) c.fillRect(Math.round(30 + Math.sin(ang) * k), 15 + k, 1, 1);
    c.drawImage(B.bell, 18 + bx, 22);
    const sx = 30 + bx + Math.round(Math.sin(ang * 1.8 + 0.3) * 2); c.fillStyle = '#e8e0d0'; for (let k = 0; k < 6; k++) c.fillRect(Math.round(30 + bx + (sx - 30 - bx) * k / 6), 40 + k, 1, 1);
    const sw = Math.sin(t * 3) * 1.2 + st.a * 4; for (let k = 0; k < 15; k++) { const px = Math.round(sx + sw * k / 15 - 2), py = 46 + k; c.fillStyle = k < 2 ? '#c84a5a' : (k === 6 || k === 7 || k === 10 ? '#3a2a2a' : '#f6ecd0'); c.fillRect(px, py, 5, 1); if (k > 1 && k !== 6 && k !== 7 && k !== 10) { c.fillStyle = '#fffaf0'; c.fillRect(px, py, 1, 1); } }
    for (const r of st.rings) { r.t += dt; const rr = 6 + r.t * 16; c.fillStyle = `rgba(150,210,235,${Math.max(0, 0.65 - r.t * 0.6)})`; for (let k = 0; k < 18; k++) { const a = -Math.PI + k / 17 * Math.PI; c.fillRect(Math.round(30 + bx + Math.cos(a) * rr), Math.round(32 + Math.sin(a) * rr * 0.55), 1, 1); } } st.rings = st.rings.filter(r => r.t < 1);
    if (Math.random() < dt * 0.6) st.p.spawn(40 + Math.random() * 20, 24, -2); st.p.step(dt, () => 999, -3); st.p.draw(c); },
  poke(st) { st.av += 3.5 * (Math.random() < 0.5 ? 1 : -1); st.rings.push({ t: 0 }); chime(); },
};
SCENES.incense = { w: 64, h: 64,
  bake(seed) { const BR = [0x3a2a14, 0x5a4220, 0x7e5e2c, 0xa8823e, 0xd4ae5a, 0xf2d48a];
    const stand = hi(56, 14, b => { b.rect(4, 6, 104, 10, (x, y) => y < 8 ? 0xd85a46 : y > 13 ? 0x5a1410 : (x < 10 ? 0xb83a2e : 0x9a2a22)); b.rect(4, 6, 104, 1, 0xf08a70);
      for (const lx of [12, 94]) { b.rect(lx, 16, 6, 10, 0x6a1a14); b.rect(lx, 16, 2, 10, 0x9a2a22); } }, 0x2a0e0c);
    const koro = hi(44, 32, b => { for (const lx of [26, 62]) { b.line(lx, 44, lx - 3, 60, BR[1], 5); b.line(lx - 1, 44, lx - 4, 58, BR[3], 1.4); } b.line(44, 48, 44, 61, BR[1], 5);
      vol(b, 44, 34, 30, 18, BR, { fn: (u, v, x, y, l) => v < -0.56 ? null : (Math.abs(v - 0.08) < 0.07 ? BR[1] : (Math.abs(v - 0.3) < 0.05 && (x & 3) === 0 ? BR[5] : pick(BR, l + 0.05))) });
      vol(b, 44, 25, 28, 5, [0x7a7468, 0x9a948a, 0xbcb6aa, 0xdcd6ca, 0xf0ece4], { k: 0.05 }); for (let k = 0; k < 26; k++) b.set(20 + k * 1.9, 24 + ((k * 5) % 4), 0x8a8478);
      for (const [x, y] of [[13, 32], [75, 32]]) { vol(b, x, y, 5, 4.4, BR, { k: 0.15 }); vol(b, x, y, 2.6, 2, [0x1e140a, 0x2e2012]); }
      for (let x = 22; x < 68; x += 7) vol(b, x, 40, 2, 2, BR.slice(3), { k: 0.2 }); }, 0x1e140c);
    const offer = hi(14, 10, b => { vol(b, 14, 15, 12, 3, [0x8a8478, 0xc8c2b4, 0xf2ece0]); for (const [x, c] of [[8, 0xf6b8ca], [14, 0xfaf6f0], [20, 0x9ccc6a]]) vol(b, x, 10, 3.6, 3.4, [mul(c, 0.72), c, mix(c, 0xffffff, 0.45)]); }, 0x3a2a2a);
    return { stand: stand.canvas(), koro: koro.canvas(), offer: offer.canvas() }; },
  init(st) { st.trail = [[], []]; st.push = 0; },
  frame(c, st, dt, t, B) { c.drawImage(B.stand, 4, 48); c.drawImage(B.koro, 10, 20); c.drawImage(B.offer, 46, 41);
    const sticks = [[30, 33, 30, 12], [37, 33, 39, 15]];
    for (const [x0, y0, x1, y1] of sticks) for (let k = 0; k <= 20; k++) { const x = Math.round(x0 + (x1 - x0) * k / 20), y = Math.round(y0 + (y1 - y0) * k / 20); c.fillStyle = k > 17 ? '#5a5a5a' : '#8a4a2a'; c.fillRect(x, y, 1, 1); c.fillStyle = '#b06a3a'; if (k < 17) c.fillRect(x - 1, y, 1, 1); }
    if (st.push > 0) st.push -= dt;
    sticks.forEach(([, , x1, y1], i) => { const tr = st.trail[i]; tr.unshift({ x: x1, y: y1 - 1, t: 0, ph: t }); if (tr.length > 46) tr.pop();
      for (const p of tr) { p.t += dt; p.y -= dt * (7 + p.t * 3); p.x += (Math.sin(p.t * 2.2 + p.ph * 1.3 + i * 2) * (2 + p.t * 6) + (st.push > 0 ? st.push * 16 : 0)) * dt; }
      for (let k = 1; k < tr.length; k++) { const a = Math.max(0, 0.75 - tr[k].t * 0.22) * (k < 3 ? k / 3 : 1); if (a <= 0) continue; c.fillStyle = `rgba(196,198,222,${a * (tr[k].t > 0.8 ? 0.6 : 1)})`; const w = tr[k].t > 1.4 ? 3 : tr[k].t > 0.7 ? 2 : 1; c.fillRect(Math.round(tr[k].x - (w >> 1)), Math.round(tr[k].y), w, 1); }
      c.fillStyle = Math.sin(t * 6 + i) > 0 ? '#ff7a2a' : '#ffd06a'; c.fillRect(x1, y1, 1, 1); c.fillStyle = 'rgba(255,140,60,0.35)'; c.fillRect(x1 - 1, y1, 3, 1); }); },
  poke(st) { st.push = 1.5; },
};


const LIST = ['sakura', 'plum', 'maple', 'lantern', 'koi', 'bonsai', 'torii', 'bamboo', 'incense', 'lotus', 'snow', 'fuji', 'chime', 'heron', 'waterfall', 'cat', 'rabbit', 'tea'];
const THEMES = [[/ocean|water|flow/, ['koi', 'lotus', 'waterfall', 'heron']], [/love|relationship|heart|you-never|take-me|blessed/, ['sakura', 'plum', 'lotus', 'cat', 'tea']], [/god|divine|self|curse|prayer/, ['torii', 'incense', 'lantern', 'rabbit']],
  [/thought|wisdom|step|effort|cloud|wake/, ['bonsai', 'bamboo', 'incense', 'fuji', 'chime']], [/happy|unity|world|met|lie/, ['maple', 'sakura', 'lantern', 'tea', 'cat']], [/trust/, ['lantern', 'bamboo', 'snow', 'heron']]];
function pickScene(seed) { for (const [re, opts] of THEMES) if (re.test(seed)) return opts[hstr(seed) % opts.length]; return LIST[hstr(seed) % LIST.length]; }

/* ---------------- element ---------------- */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const live = new Set(); let raf = 0, last = 0;
function loop(ts) { raf = requestAnimationFrame(loop); const dt = Math.min(0.06, (ts - (last || ts)) / 1000); last = ts; for (const el of live) el.tick(dt); }
class PixelScene extends HTMLElement {
  static get observedAttributes() { return ['scene', 'seed']; }
  connectedCallback() {
    if (this._on) return; this._on = true;
    const name = this.getAttribute('scene') || pickScene((this.getAttribute('seed') || location.pathname).toLowerCase()), S = SCENES[name] || SCENES.sakura;
    this.S = S; this.name = name; const seed = hstr((this.getAttribute('seed') || name) + name);
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>:host{display:inline-block;line-height:0;user-select:none;-webkit-tap-highlight-color:transparent}canvas{width:100%;height:auto;image-rendering:pixelated;image-rendering:crisp-edges;cursor:pointer;display:block;touch-action:manipulation}</style><canvas width="${S.w}" height="${S.h}" role="img" aria-label="Pixel art: ${name}. Tap to interact."></canvas>`;
    this.cv = root.querySelector('canvas'); this.ctx = this.cv.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    this.B = S.bake(seed); this.st = {}; S.init(this.st, this.B); this.t = Math.random() * 10;
    // warm up so particles are already falling on first sight
    for (let i = 0; i < 90; i++) this.step(1 / 30, true);
    this.draw();
    const poke = e => { const r = this.cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * S.w, y = (e.clientY - r.top) / r.height * S.h; S.poke && S.poke(this.st, x, y, this.B); if (reduced) { for (let i = 0; i < 20; i++) this.step(1 / 30); this.draw(); } };
    this.cv.addEventListener('pointerdown', poke);
    this.cv.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && S.hover && !this._hv) { this._hv = 1; setTimeout(() => this._hv = 0, 1200); S.poke(this.st, 32, 20, this.B); } });
    if (!reduced) {
      if ('IntersectionObserver' in window) { this.io = new IntersectionObserver(es => { if (es[0].isIntersecting) live.add(this); else live.delete(this); }); this.io.observe(this); } else live.add(this);
      if (!raf) raf = requestAnimationFrame(loop);
    }
  }
  disconnectedCallback() { live.delete(this); if (this.io) this.io.disconnect(); this._on = false; }
  step(dt, quiet) { this.t += dt; this._q = quiet; this.S.frame(quiet ? this.dummy || (this.dummy = { fillRect() {}, drawImage() {}, beginPath() {}, ellipse() {}, stroke() {} }) : this.ctx, this.st, dt, this.t, this.B); }
  tick(dt) { if (document.hidden) return; this.acc = (this.acc || 0) + dt; if (this.acc < 1 / 30) return; const d = this.acc; this.acc = 0; this.draw(d); }
  draw(dt = 0) { this.ctx.clearRect(0, 0, this.S.w, this.S.h); this.step(dt); }
}
customElements.define('pixel-scene', PixelScene);
window.PixelScene = { scenes: LIST, pick: pickScene };

/* ---------------- page wiring (writing list + reading pages) ---------------- */
function mount() {
  const slug = (location.pathname.split('/').filter(Boolean).pop() || 'writing').toLowerCase();
  const cover = document.getElementById('readCoverArt');
  if (cover) {
    cover.innerHTML = ''; cover.classList.add('has-pixel-scene'); cover.removeAttribute('aria-hidden');
    const sc = document.createElement('pixel-scene'); sc.setAttribute('seed', slug); cover.appendChild(sc);
    const main = document.getElementById('read-content');
    if (main && !document.querySelector('.read-end-scene')) {
      const end = document.createElement('div'); end.className = 'read-end-scene';
      const first = pickScene(slug), pool = ['incense', 'bonsai', 'lotus', 'lantern', 'koi', 'bamboo', 'snow', 'fuji', 'chime', 'heron', 'waterfall', 'cat', 'rabbit', 'tea'].filter(n => n !== first);
      const es = document.createElement('pixel-scene'); es.setAttribute('scene', pool[hstr(slug + 'end') % pool.length]); es.setAttribute('seed', slug + '-end');
      end.appendChild(es); main.after(end);
    }
  }
  const head = document.querySelector('.writing-page-header');
  if (head && !head.querySelector('.writing-scenes')) {
    const row = document.createElement('div'); row.className = 'writing-scenes';
    for (const n of ['lantern', 'sakura', 'koi']) { const e = document.createElement('pixel-scene'); e.setAttribute('scene', n); e.setAttribute('seed', 'writings-' + n); row.appendChild(e); }
    head.prepend(row);
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
