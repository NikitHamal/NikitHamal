/*!
 * <pixel-scene> — small, hand-tuned, animated pixel-art vignettes for the writing pages.
 * Everything is painted procedurally into a tiny canvas (no image files), scaled up by an
 * integer factor so pixels stay crisp, paused when off-screen, and calm under
 * prefers-reduced-motion. Tap / hover to interact.
 *
 *   <pixel-scene scene="sakura"></pixel-scene>     scenes: sakura, plum, maple, lantern,
 *   <pixel-scene seed="post-slug"></pixel-scene>    koi, bonsai, torii, bamboo, incense, lotus
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
// A clustered "leaf-cloud" canopy like hand-pixelled blossom trees: soft volume shading,
// short horizontal leaf strokes, ragged edges and hanging lumps underneath.
function canopy(img, blobs, P, seed, opt = {}) {
  const r = rng(seed), W = img.w, H = img.h, inside = new Float32Array(W * H).fill(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let best = -1; for (const [cx, cy, rx, ry] of blobs) { const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = 1 - (u * u + v * v); if (d > best) best = d; }
    const rag = (noise(x * 0.45, y * 0.45, seed) - 0.5) * 0.5 + (h2(x, y, seed + 1) - 0.5) * 0.18;
    if (best + rag * 0.55 > 0) inside[y * W + x] = best;
  }
  const n = P.length, cx0 = opt.lx ?? W * 0.42, cy0 = opt.ly ?? H * 0.1;
  const shade = (x, y) => { const dx = (x - cx0) / W, dy = (y - cy0) / H; let l = 1 - Math.hypot(dx * 1.15, dy * 1.55) * 1.35; l += (noise(x * 0.22, y * 0.3, seed + 2) - 0.5) * 0.45; return l; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (inside[i] < 0) continue;
    let q = Math.round(Math.max(0, Math.min(1, shade(x, y))) * (n - 1)); if (inside[i] < 0.08) q = Math.max(0, q - 1); img.set(x, y, P[q]); }
  // leaf strokes
  const strokes = opt.strokes ?? Math.round(W * H * 0.09);
  for (let k = 0; k < strokes; k++) { const x = Math.floor(r() * W), y = Math.floor(r() * H); if (inside[y * W + x] < 0) continue;
    const l = shade(x, y), q = Math.max(0, Math.min(n - 1, Math.round(l * (n - 1)) + (r() < 0.6 ? 1 : -1))), len = 2 + (r() * 3 | 0);
    for (let j = 0; j < len; j++) if (inside[y * W + x + j] >= 0) img.set(x + j, y + (j > 2 && r() < 0.3 ? 1 : 0), P[q]); }
  // dark gaps for depth
  for (let k = 0; k < strokes * 0.25; k++) { const x = Math.floor(r() * W), y = Math.floor(H * 0.35 + r() * H * 0.55); if (inside[y * W + x] < 0.15) continue; if (shade(x, y) < 0.55) { img.set(x, y, P[0]); img.set(x + 1, y, P[Math.min(1, n - 1)]); } }
  return inside;
}
function bark(img, pts, w0, w1, B, seed) { // tapered trunk / branch with left light & bark streaks
  const r = rng(seed);
  img.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], (t, dx) => { const w = w0 + (w1 - w0) * t, u = dx / (w / 2 + 0.01); return u < -0.45 ? B[3] : u < 0.15 ? B[2] : u < 0.6 ? B[1] : B[0]; }, t => w0 + (w1 - w0) * t);
  for (let k = 0; k < 6; k++) { const t = r(), x = pts[0][0] + (pts[1][0] - pts[0][0]) * t, y = pts[0][1] + (pts[1][1] - pts[0][1]) * t; img.set(x + (r() - 0.5) * (w0 * 0.6), y, B[0]); img.set(x + (r() - 0.5) * (w0 * 0.6), y + 1, B[0]); }
}
function groundPile(img, cx, cy, rx, ry, P, seed) { // a soft ragged mound of fallen petals/leaves
  const r = rng(seed);
  for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
    const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = u * u + v * v + (h2(x, y, seed) - 0.5) * 0.5; if (d > 1) continue;
    const l = 0.75 - v * 0.6 - Math.abs(u) * 0.25 + (h2(x >> 1, y, seed + 3) - 0.5) * 0.5; img.set(x, y, P[Math.max(0, Math.min(P.length - 1, Math.round(l * (P.length - 1))))]); }
  for (let k = 0; k < rx * 1.6; k++) { const a = r() * Math.PI * 2, d = 1 + r() * 0.5; img.set(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d * 0.8, P[1 + (r() * (P.length - 1) | 0)]); }
}

const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function disc(img, cx, cy, R, ramp, rim) { // round window with a dithered vertical gradient
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d > R) continue;
    if (d > R - 1) { img.set(x, y, rim); continue; } const f = (y - (cy - R)) / (2 * R) * (ramp.length - 1), i = Math.floor(f), fr = f - i;
    img.set(x, y, ramp[Math.min(ramp.length - 1, i + (fr * 16 > BAY[((y & 3) << 2) | (x & 3)] ? 1 : 0))]); }
}
function inDisc(cx, cy, R) { return (x, y) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= R - 1; }

/* ---------------- particles ---------------- */
function Petals(cols, opt = {}) { // falling petals/leaves that flutter, then settle
  return { list: [], cols, opt,
    spawn(x, y, vx = 0) { if (this.list.length > (opt.max || 26)) return; this.list.push({ x, y, vx: vx + (Math.random() - 0.4) * 4, vy: 3 + Math.random() * 5, t: Math.random() * 6, c: cols[(Math.random() * cols.length) | 0], life: 0, land: null }); },
    step(dt, groundY, wind) { for (const p of this.list) { p.life += dt; p.t += dt * (2.2 + (p.vy * 0.15));
      if (p.land == null) { p.x += (p.vx + Math.sin(p.t) * 6 + wind) * dt; p.y += p.vy * dt * (0.8 + Math.sin(p.t * 2) * 0.25); if (p.y >= groundY(p.x)) { p.y = groundY(p.x); p.land = 0; } }
      else p.land += dt; }
      this.list = this.list.filter(p => (p.land == null || p.land < (opt.rest || 3.5)) && p.y < 400 && p.x > -10 && p.x < 400); },
    draw(c) { for (const p of this.list) { if (p.land != null && p.land > (opt.rest || 3.5) - 0.8 && ((p.land * 10) | 0) % 2) continue; c.fillStyle = p.c;
      const f = p.land != null ? 0 : ((p.t * 1.6) | 0) % 3, x = Math.round(p.x), y = Math.round(p.y); if (f === 0) c.fillRect(x, y, 2, 1); else if (f === 1) c.fillRect(x, y, 1, 1); else c.fillRect(x, y, 1, 2); } } };
}

/* ---------------- scenes ---------------- */
const SCENES = {};

// Blossom tree (sakura / plum / maple share the painter) — after the classic hand-pixelled
// sakura: a big cloud crown lit from above (peach) sinking into plum shadow, built from short
// leaf strokes, ragged clumps hanging off the bottom, a branch showing through, petal carpet.
function crown(img, blobs, P, seed, top, bot) {
  const W = img.w, H = img.h, r = rng(seed), n = P.length, ins = new Float32Array(W * H).fill(-9);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let best = -9; for (const [cx, cy, rx, ry] of blobs) { const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = 1 - (u * u + v * v); if (d > best) best = d; }
    best += (noise(x * 0.5, y * 0.5, seed) - 0.5) * 0.42 + (h2(x, y, seed + 1) - 0.5) * 0.12; if (best > 0) ins[y * W + x] = best; }
  const L = (x, y) => 1.08 - (y - top) / (bot - top) * 1.15 - Math.abs(x - W * 0.46) / W * 0.35 + (noise(x * 0.18, y * 0.26, seed + 2) - 0.5) * 0.5;
  const q = (x, y, k = 0) => P[Math.max(0, Math.min(n - 1, Math.round(L(x, y) * (n - 1)) + k))];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = ins[y * W + x]; if (v <= -9) continue; img.set(x, y, q(x, y, v < 0.07 && y > (top + bot) / 2 ? -1 : 0)); }
  // leaf strokes: short horizontal dashes a shade lighter (sunny side) or darker (shadow side)
  for (let k = 0; k < W * H * 0.16; k++) { const x = r() * W | 0, y = r() * H | 0; if (ins[y * W + x] <= 0.02) continue; const lit = L(x, y), up = r() < lit * 0.9;
    const c = q(x, y, up ? 1 : -1), len = 2 + (r() * 3 | 0); for (let j = 0; j < len; j++) if (ins[y * W + x + j] > 0) img.set(x + j, y, c); if (!up && r() < 0.5) img.set(x + 1, y + 1, q(x, y, -1)); }
  // ragged clumps dangling from the underside
  for (let k = 0; k < 16; k++) { const x = 6 + r() * (W - 12) | 0; let y = bot; while (y > top && ins[y * W + x] <= -9) y--; if (y <= top + 4) continue;
    const h = 1 + (r() * 3 | 0); for (let j = 1; j <= h; j++) { img.set(x, y + j, P[j === h ? 0 : 1]); if (r() < 0.6) img.set(x + 1, y + j - 1, P[1]); } }
  return ins;
}
function blossomScene(name, pal) {
  SCENES[name] = { w: 64, h: 64,
    bake(seed) {
      const r = rng(seed), back = new Img(64, 64), top = new Img(64, 64), B = pal.bark;
      // petal carpet behind the roots
      groundPile(back, 32, 58, 21, 4.2, pal.pile, seed + 9);
      for (let k = 0; k < 60; k++) { const x = 12 + r() * 40 | 0, y = 55 + r() * 5 | 0, hgt = 1 + (r() * 3 | 0); for (let j = 0; j < hgt; j++) back.set(x, y - j, pal.pile[Math.min(pal.pile.length - 1, 1 + j)]); }
      // trunk: thick, a little bent, root flare, a forked branch reaching into the crown
      const T = (x0, y0, x1, y1, w0, w1, k) => bark(back, [[x0, y0], [x1, y1]], w0, w1, B, seed + k);
      T(30, 58, 31, 44, 8, 6.5, 1); T(31, 46, 29, 34, 6.5, 4, 2); T(24, 59, 28, 54, 4.5, 3, 3); T(37, 59, 33, 54, 4, 3, 4);
      T(32, 46, 41, 37, 3.2, 2, 5); T(40, 38, 46, 33, 2, 1.4, 6); T(30, 40, 22, 35, 2.4, 1.4, 7);
      for (let y = 44; y < 57; y++) if (h2(31, y, seed) < 0.35) back.set(28 + ((y >> 1) & 1), y, B[3]); // bark light
      back.set(31, 50, B[0]); back.set(32, 51, B[0]); back.set(31, 52, B[1]); // knot
      // crown
      crown(top, [[32, 21, 27, 13], [16, 26, 11, 9], [48, 25, 12, 9], [31, 12, 17, 9], [42, 15, 12, 8], [22, 15, 11, 8]], pal.leaf, seed + 12, 3, 40);
      return { back: back.canvas(), top: top.canvas(), bottomY: x => 57 + (Math.abs(x - 32) > 18 ? 4 : Math.abs(x - 32) > 12 ? 1 : 0) };
    },
    init(st) { st.p = Petals(pal.fall, { max: 24, rest: 4 }); st.wind = 0; st.shake = 0; },
    frame(c, st, dt, t, B) {
      st.wind = Math.sin(t * 0.35) * 2 + Math.sin(t * 1.3) * 0.8; if (st.shake > 0) st.shake -= dt;
      if (Math.random() < dt * (1.6 + st.shake * 12)) st.p.spawn(8 + Math.random() * 48, 22 + Math.random() * 16, st.wind);
      st.p.step(dt, B.bottomY, st.wind * 0.6);
      const j = st.shake > 0 ? Math.round(Math.sin(t * 42)) : 0, sw = Math.round(Math.sin(t * 0.8) * 0.6) + j, sw2 = Math.round(Math.sin(t * 0.8 + 0.7) * 0.5);
      c.drawImage(B.back, 0, 0);
      c.drawImage(B.top, 0, 0, 64, 16, sw, 0, 64, 16); c.drawImage(B.top, 0, 16, 64, 48, sw2 + (j ? -j : 0), 16, 64, 48);
      st.p.draw(c);
    },
    poke(st) { st.shake = 0.6; for (let k = 0; k < 14; k++) st.p.spawn(8 + Math.random() * 48, 14 + Math.random() * 22, (Math.random() - 0.5) * 12); },
  };
}
blossomScene('sakura', { leaf: [0x5a3a5e, 0x7e4470, 0xa8507a, 0xd0688a, 0xec8a98, 0xf8a8a4, 0xffc4b0], bark: [0x3e1e1c, 0x5e2e26, 0x844630, 0xa8643e], pile: [0x6a2a50, 0x9a3e6a, 0xc85a86, 0xe47ea0, 0xf4a2b6], fall: ['#f8a8a4', '#ec8a98', '#ffc4b0', '#d0688a'], out: 0x4a2a44 });
blossomScene('plum', { leaf: [0x2e2448, 0x48346a, 0x6a4a8c, 0x9068aa, 0xb48ec6, 0xd4b4dc, 0xf0dcf0], bark: [0x2a1a1c, 0x44282a, 0x5e3a36, 0x7a5046], pile: [0x3a2a5a, 0x5a4282, 0x7e60a2, 0xa88ac4, 0xcab0dc], fall: ['#d4b4dc', '#b48ec6', '#f0dcf0'], out: 0x2e2040 });
blossomScene('maple', { leaf: [0x4a161c, 0x6e2020, 0x9a2e22, 0xc44a26, 0xe4702e, 0xf6983a, 0xffc260], bark: [0x2e1c16, 0x4a2c1e, 0x664030, 0x845640], pile: [0x5a1a18, 0x8a2a1e, 0xb84626, 0xe06a30, 0xf4943c], fall: ['#e4702e', '#f6983a', '#c44a26', '#ffc260'], out: 0x3a1418 });

// Stone lantern (tōrō) at dusk inside a round window: warm flame, moths, fireflies; tap to light/dim
SCENES.lantern = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64), S = [0x3e3a44, 0x5a5662, 0x76727c, 0x96929a, 0xb8b4b8];
    disc(g, 32, 32, 31, [0x2a2448, 0x3e2e5e, 0x6a3e6e, 0x9a5070, 0xc87266, 0xe89a6a], 0x1e1a2e);
    // far hills + trees silhouette
    for (let x = 1; x < 63; x++) { const hh = 40 + Math.round(noise(x * 0.08, 1, seed) * 6); for (let y = hh; y < 63; y++) if (Math.hypot(x + 0.5 - 32, y + 0.5 - 32) < 30) g.set(x, y, y < hh + 2 ? 0x3a2a4a : 0x2a1e3a); }
    // mossy ground
    for (let x = 1; x < 63; x++) for (let y = 50; y < 63; y++) if (Math.hypot(x + 0.5 - 32, y + 0.5 - 32) < 30) g.set(x, y, y === 50 + ((x * 7) % 3 === 0 ? 0 : 1) ? 0x4a6a3a : h2(x, y, seed) < 0.3 ? 0x2a3e2a : 0x324a30);
    const blk = (x, y, w, h, k = 0) => g.rect(x, y, w, h, (xx, yy) => S[Math.max(0, Math.min(4, (xx - x < 2 ? 3 : xx - x > w - 3 ? 1 : 2) + k + (h2(xx, yy, seed) < 0.1 ? -1 : 0)))]);
    blk(22, 52, 20, 3, -1); blk(25, 49, 14, 3); blk(28, 38, 8, 11); blk(29, 36, 6, 2, 1); // base, post
    blk(22, 33, 20, 3, 1); g.rect(22, 33, 20, 1, S[4]); // platform
    blk(25, 23, 14, 10); g.rect(27, 25, 10, 7, 0x1a1418); g.rect(26, 23, 1, 10, S[1]); g.rect(37, 23, 1, 10, S[1]); // fire box with opening
    for (let y = 15; y < 23; y++) { const w = 8 + (y - 15) * 2.4; g.rect(Math.round(32 - w / 2), y, Math.round(w), 1, S[y < 18 ? 4 : y < 21 ? 3 : 2]); } // roof
    g.set(12, 22, S[2]); g.set(51, 22, S[2]); g.set(11, 21, S[3]); g.set(52, 21, S[3]); // curled corners
    g.rect(30, 11, 4, 4, S[3]); g.rect(31, 9, 2, 2, S[4]); // hōju finial
    for (let k = 0; k < 26; k++) { const x = 22 + h2(k, 1, seed) * 20 | 0, y = 15 + h2(k, 2, seed) * 40 | 0; if (g.has(x, y) && g.get(x, y) !== 0x1a1418 && h2(k, 3, seed) < 0.7 && y < 50) { g.set(x, y, 0x5a8a4a); g.set(x + 1, y, 0x7aa858); } }
    // tufts of grass in front
    for (let k = 0; k < 14; k++) { const x = 6 + h2(k, 5, seed) * 52 | 0, y = 56 + h2(k, 6, seed) * 5 | 0; if (Math.hypot(x - 32, y - 32) > 27) continue; g.set(x, y, 0x5a8a4a); g.set(x - 1, y + 1, 0x4a7a3a); g.set(x + 1, y + 1, 0x4a7a3a); }
    // halo: precomputed dithered warm light inside the disc
    const halo = new Img(64, 64); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const d = Math.hypot(x + 0.5 - 32, (y + 0.5 - 28) * 1.2); if (d > 18 || Math.hypot(x + 0.5 - 32, y + 0.5 - 32) > 30) continue; const a = (1 - d / 18); if (a * 16 > BAY[((y & 3) << 2) | (x & 3)] * 1.6) halo.set(x, y, 0xffc070, Math.round(40 + a * 60)); }
    return { g: g.canvas(), halo: halo.canvas(), clip: inDisc(32, 32, 31) }; },
  init(st) { st.on = true; st.flies = Array.from({ length: 7 }, () => ({ x: 10 + Math.random() * 44, y: 10 + Math.random() * 44, t: Math.random() * 9 })); },
  frame(c, st, dt, t, B) {
    c.drawImage(B.g, 0, 0);
    if (st.on) { const fl = Math.sin(t * 9) * 0.5 + Math.sin(t * 23) * 0.5; c.globalAlpha = 0.85 + fl * 0.15; c.drawImage(B.halo, 0, 0); c.globalAlpha = 1;
      c.fillStyle = '#e8702e'; c.fillRect(27, 25, 10, 7); c.fillStyle = '#ffb040'; c.fillRect(29, 26, 6, 6); c.fillStyle = '#fff0a0'; c.fillRect(31, 27 + (fl > 0.3 ? 0 : 1), 2, 4 - (fl > 0.3 ? 0 : 1)); }
    for (const f of st.flies) { f.t += dt; f.x += Math.sin(f.t * 0.7) * dt * 6; f.y += Math.cos(f.t * 0.9) * dt * 4; if (!B.clip(f.x, f.y)) { f.x = 32 + (Math.random() - 0.5) * 30; f.y = 30 + (Math.random() - 0.5) * 30; }
      const a = 0.5 + 0.5 * Math.sin(f.t * 3); if (a < 0.25) continue; c.fillStyle = `rgba(230,255,150,${a})`; c.fillRect(Math.round(f.x), Math.round(f.y), 1, 1); c.fillStyle = `rgba(230,255,150,${a * 0.3})`; c.fillRect(Math.round(f.x) - 1, Math.round(f.y), 3, 1); c.fillRect(Math.round(f.x), Math.round(f.y) - 1, 1, 3); }
  },
  poke(st) { st.on = !st.on; },
};

// Koi circling a small round pond, seen from above; tap to drop food
SCENES.koi = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64);
    g.ell(32, 33, 29, 26, (u, v, x, y) => h2(x >> 1, y >> 1, seed) < 0.5 ? 0x4e7a3e : 0x5e8a46);
    g.ell(32, 33, 24, 21, (u, v, x, y) => { const d = Math.sqrt(u * u + v * v); return d > 0.86 ? 0xa8a29a : d > 0.8 ? 0x86827c : [0x1e4a5e, 0x255a6e, 0x2e6a7e, 0x3a7c8c][Math.max(0, Math.min(3, Math.round((1 - d) * 3 + (h2(x, y, seed) - 0.5))))]; });
    for (let k = 0; k < 26; k++) { const a = k / 26 * Math.PI * 2, x = 32 + Math.cos(a) * 23.5, y = 33 + Math.sin(a) * 20.5; g.ell(x, y, 2.4, 2, (u, v) => v < -0.2 ? 0xd2ccc2 : 0x9a948c); }
    g.ell(18, 24, 4, 3, (u, v) => v < -0.3 ? 0x7ab858 : 0x4a8a3a); g.set(18, 24, 0x2e6a7e); g.set(19, 24, 0x2e6a7e); g.ell(17, 23, 1.4, 1.2, 0xf6b8ca);
    g.ell(46, 44, 3.4, 2.6, (u, v) => v < -0.3 ? 0x7ab858 : 0x4a8a3a);
    return { g: g.canvas() }; },
  init(st) { const C = [['#f6f2ea', '#e0402a'], ['#f2b23a', '#ffd86a'], ['#f6f2ea', '#1a1414'], ['#e86a2a', '#f6f2ea']]; st.fish = C.map((c, i) => ({ a: i * 1.6, r: 8 + i * 3, sp: 0.5 + i * 0.12, c })); st.food = []; st.rip = []; },
  frame(c, st, dt, t, B) {
    c.drawImage(B.g, 0, 0);
    for (const r of st.rip) { r.t += dt; const rr = 1 + r.t * 9; c.strokeStyle = `rgba(220,245,255,${Math.max(0, 0.7 - r.t)})`; c.lineWidth = 1; c.beginPath(); c.ellipse(r.x + 0.5, r.y + 0.5, rr, rr * 0.75, 0, 0, Math.PI * 2); c.stroke(); }
    st.rip = st.rip.filter(r => r.t < 0.7);
    for (const f of st.fish) {
      const tgt = st.food[0]; let x, y, ang;
      if (tgt) { f.x = f.x ?? 32; f.y = f.y ?? 33; const dx = tgt.x - f.x, dy = tgt.y - f.y, d = Math.hypot(dx, dy); f.x += dx / (d || 1) * dt * 16; f.y += dy / (d || 1) * dt * 16; x = f.x; y = f.y; ang = Math.atan2(dy, dx); if (d < 2) { tgt.e = 1; } }
      else { f.a += dt * f.sp; x = 32 + Math.cos(f.a) * f.r; y = 33 + Math.sin(f.a) * f.r * 0.8; f.x = x; f.y = y; ang = f.a + Math.PI / 2; }
      const ca = Math.cos(ang), sa = Math.sin(ang), w = Math.sin(t * 8 + f.a) * 0.6;
      for (let k = 0; k < 7; k++) { const px = x - ca * k + -sa * w * k / 7, py = y - sa * k + ca * w * k / 7; c.fillStyle = k === 0 ? f.c[0] : (k === 2 || k === 3) ? f.c[1] : f.c[0]; c.fillRect(Math.round(px), Math.round(py), k < 5 ? 2 : 1, k < 4 ? 2 : 1); }
      c.fillStyle = 'rgba(10,30,40,0.35)'; c.fillRect(Math.round(x - ca * 2) + 1, Math.round(y - sa * 2) + 2, 2, 1);
    }
    st.food = st.food.filter(f => !f.e); for (const f of st.food) { c.fillStyle = '#c8945a'; c.fillRect(Math.round(f.x), Math.round(f.y), 1, 1); }
  },
  poke(st, x, y) { const d = Math.hypot((x - 32) / 22, (y - 33) / 19); if (d > 1) { x = 32; y = 33; } st.food.push({ x, y }); st.rip.push({ x, y, t: 0 }); },
};

// Bonsai pine on a stone with drifting cloud; tap for a breeze
SCENES.bonsai = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64), B = [0x2e1e18, 0x4a3226, 0x664634, 0x846048];
    g.rect(14, 54, 36, 6, (x, y) => y === 54 ? 0x6a8ab8 : (x + y) % 9 === 0 ? 0x2a4a78 : 0x3a5a90); g.rect(12, 52, 40, 2, 0x8aa8d0); g.rect(16, 60, 4, 2, 0x2a3a5a); g.rect(44, 60, 4, 2, 0x2a3a5a);
    g.ell(32, 51, 17, 3.2, (u, v, x, y) => h2(x, y, seed) < 0.3 ? 0x6a5a4a : 0x5a4a3a);
    g.ell(25, 47, 8, 5, (u, v) => v < -0.3 ? 0xb8b2a8 : u > 0.3 ? 0x6e6a66 : 0x928c86);
    bark(g, [[33, 50], [36, 40]], 4, 3, B, seed); bark(g, [[36, 40], [28, 32]], 3, 2.4, B, seed + 1); bark(g, [[29, 33], [42, 26]], 2.4, 1.6, B, seed + 2); bark(g, [[36, 41], [47, 38]], 2, 1.4, B, seed + 3);
    const G = [0x14321e, 0x1e4a28, 0x2e6434, 0x447c40, 0x62984e];
    for (const [cx, cy, rx] of [[20, 30, 8], [44, 25, 9], [50, 37, 6], [30, 22, 7]]) canopy(g, [[cx, cy, rx, rx * 0.45]], G, seed + cx, { strokes: 18, lx: cx - 3, ly: cy - 6 });
    g.outline(0x101a14); return { g: g.canvas() }; },
  init(st) { st.cloud = 0; st.breeze = 0; st.leaves = Petals(['#447c40', '#62984e'], { max: 6, rest: 2 }); },
  frame(c, st, dt, t, B) { st.cloud = (st.cloud + dt * 2) % 90; c.fillStyle = 'rgba(255,255,255,0.55)'; const cx = Math.round(st.cloud - 20); c.fillRect(cx, 9, 12, 2); c.fillRect(cx + 3, 7, 6, 2); c.fillRect(cx + 16, 12, 7, 1);
    c.drawImage(B.g, Math.round(st.breeze > 0 ? Math.sin(t * 30) * 0.6 : 0), 0); if (st.breeze > 0) { st.breeze -= dt; if (Math.random() < 0.2) st.leaves.spawn(20 + Math.random() * 30, 26, 8); }
    st.leaves.step(dt, () => 52, 6); st.leaves.draw(c); },
  poke(st) { st.breeze = 1.2; },
};

// Torii under the moon, framed in a round window; tap for a shooting star
SCENES.torii = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64), Rd = [0x7a1812, 0xa8281e, 0xd03e2c, 0xe8604a];
    disc(g, 32, 32, 31, [0x0e1430, 0x162048, 0x22305e, 0x2e4472, 0x3e5a86], 0x0a0c1e);
    const clip = inDisc(32, 32, 31);
    for (let k = 0; k < 26; k++) { const x = h2(k, 1, seed) * 64, y = 4 + h2(k, 2, seed) * 34; if (clip(x, y)) g.set(x, y, h2(k, 3, seed) < 0.3 ? 0xffffff : 0x9aaad8); }
    g.ell(44, 17, 7, 7, (u, v) => (u - 0.3) ** 2 + (v + 0.1) ** 2 < 0.3 ? 0xdcdeea : u + v < -0.4 ? 0xfffaf0 : 0xf0ead8); g.set(42, 15, 0xd8d2c4); g.set(46, 19, 0xd8d2c4); g.set(41, 19, 0xe0dace); g.set(47, 14, 0xe0dace);
    for (let x = 0; x < 64; x++) { const hh = 44 + Math.round(noise(x * 0.07, 3, seed) * 5); for (let y = hh; y < 64; y++) if (clip(x, y)) g.set(x, y, 0x182030); }
    for (let x = 0; x < 64; x++) for (let y = 50; y < 64; y++) if (clip(x, y)) g.set(x, y, (x > 24 && x < 40) ? (y === 50 ? 0xa8a29a : ((x + y * 3) % 7 ? 0x8a8478 : 0x6e6a62)) : (h2(x, y, seed) < 0.25 ? 0x1e3a2a : 0x26442e));
    for (const px of [21, 40]) g.rect(px, 24, 4, 27, (x) => Rd[x === px ? 3 : x === px + 3 ? 0 : 2]);
    g.rect(17, 29, 31, 3, (x, y) => Rd[y === 29 ? 3 : 1]);
    for (let x = 12; x < 53; x++) { const lift = Math.round(Math.pow(Math.abs(x - 32) / 21, 3) * 3); g.rect(x, 20 - lift, 1, 2, 0x1e1418); g.rect(x, 22 - lift, 1, 2, Rd[x < 32 ? 3 : 2]); }
    g.rect(29, 23, 7, 6, (x, y) => (x === 29 || x === 35 || y === 23 || y === 28) ? 0x1e1418 : 0xe8c86a);
    // stone lanterns flanking the path
    for (const lx of [12, 50]) { g.rect(lx - 1, 46, 3, 5, 0x6e6a62); g.rect(lx - 2, 43, 5, 3, 0x8a8478); g.set(lx, 44, 0xffd06a); g.rect(lx - 3, 42, 7, 1, 0x6e6a62); }
    return { g: g.canvas(), clip }; },
  init(st) { st.star = null; st.next = 3 + Math.random() * 5; },
  frame(c, st, dt, t, B) { c.drawImage(B.g, 0, 0);
    for (let k = 0; k < 5; k++) { const x = (k * 17 + 9) % 56 + 4, y = (k * 11 + 8) % 26 + 6; if (Math.sin(t * 2 + k * 3) > 0.75 && B.clip(x, y)) { c.fillStyle = '#ffffff'; c.fillRect(x, y, 1, 1); c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(x - 1, y, 3, 1); c.fillRect(x, y - 1, 1, 3); } }
    if ((st.next -= dt) <= 0 && !st.star) { st.star = { x: 58, y: 6 + Math.random() * 8 }; st.next = 7 + Math.random() * 9; }
    if (st.star) { const s = st.star; s.x -= dt * 60; s.y += dt * 18; for (let k = 0; k < 7; k++) { const x = Math.round(s.x + k * 2), y = Math.round(s.y - k * 0.6); if (B.clip(x, y)) { c.fillStyle = `rgba(255,248,220,${(1 - k / 7) * 0.9})`; c.fillRect(x, y, 1, 1); } } if (s.x < 4) st.star = null; }
    for (const lx of [12, 50]) { c.fillStyle = `rgba(255,208,106,${0.5 + Math.sin(t * 7 + lx) * 0.2})`; c.fillRect(lx - 1, 44, 3, 1); } },
  poke(st) { st.star = { x: 58, y: 6 + Math.random() * 10 }; },
};

// Bamboo with falling leaves and a sparrow; tap rustles
SCENES.bamboo = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64), G = [0x2e5a2a, 0x447a34, 0x5e9a42, 0x86ba5a, 0xb0d47a];
    groundPile(g, 32, 59, 30, 4.5, [0x4a3a26, 0x5a4a32, 0x6e5a3e, 0x86704c], seed); for (let k = 0; k < 40; k++) { const x = 4 + h2(k, 7, seed) * 56 | 0, y = 56 + h2(k, 8, seed) * 4 | 0; g.set(x, y, 0x5e9a42); g.set(x, y - 1, 0x86ba5a); }
    for (let k = 0; k < 6; k++) { const x0 = 6 + k * 10 + (h2(k, 0, seed) * 4 | 0), top = (h2(k, 1, seed) * 10) | 0, far = k % 2;
      for (let y = top; y < 59; y++) { const node = (y + k * 4) % 12 === 0; g.set(x0, y, node ? 0xd8e8a0 : G[far ? 1 : 3]); g.set(x0 + 1, y, node ? G[2] : G[far ? 0 : 2]); g.set(x0 + 2, y, node ? G[1] : G[far ? 0 : 1]); }
      for (let j = 0; j < 3; j++) { const ly = top + 6 + j * 13 + (h2(k, j, seed) * 6 | 0), dir = (j + k) % 2 ? 1 : -1; for (let i = 0; i < 7; i++) { g.set(x0 + 1 + dir * (2 + i), ly + (i >> 1), G[i < 4 ? 3 : 2]); g.set(x0 + 1 + dir * (2 + i), ly + 1 + (i >> 1), G[1]); } } }
    g.outline(0x16301a); return { g: g.canvas() }; },
  init(st) { st.p = Petals(['#86ba5a', '#b0d47a', '#5e9a42'], { max: 10 }); st.rustle = 0; },
  frame(c, st, dt, t, B) { if (st.rustle > 0) st.rustle -= dt; c.drawImage(B.g, st.rustle > 0 ? Math.round(Math.sin(t * 35)) : 0, 0);
    if (Math.random() < dt * (0.6 + st.rustle * 8)) st.p.spawn(4 + Math.random() * 56, 4 + Math.random() * 30, 3); st.p.step(dt, () => 58, 2); st.p.draw(c); },
  poke(st) { st.rustle = 0.8; },
};

// Incense: a stick in a bowl with curling smoke; tap to breathe the smoke aside
SCENES.incense = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64);
    g.ell(32, 54, 14, 5, (u, v) => v < -0.2 ? 0x3a3a46 : u < -0.3 ? 0x5a5a6a : 0x2a2a34); g.ell(32, 51.5, 12, 2.4, (u, v) => (h2(u * 9 | 0, v * 9 | 0, seed) < 0.3) ? 0xb8b2a4 : 0xd0cabc);
    g.rect(20, 57, 24, 2, 0x5a3a24); g.rect(18, 59, 28, 2, 0x7a5232);
    g.line(32, 51, 34, 26, 0x8a4a2a, 1); g.set(34, 25, 0xff8a3a); g.set(34, 24, 0xffd06a);
    g.outline(0x16121a, (x, y) => y > 46); return { g: g.canvas() }; },
  init(st) { st.puffs = []; st.push = 0; },
  frame(c, st, dt, t, B) { c.drawImage(B.g, 0, 0); if (st.push > 0) st.push -= dt;
    if (Math.random() < dt * 9) st.puffs.push({ x: 34, y: 23, t: 0, ph: Math.random() * 6 });
    for (const p of st.puffs) { p.t += dt; p.y -= dt * 7; p.x += Math.sin(p.t * 1.6 + p.ph) * dt * 4 + (st.push > 0 ? dt * 18 : 0); const a = Math.max(0, 0.6 - p.t * 0.17); c.fillStyle = `rgba(220,220,236,${a})`; const s = p.t > 1.5 ? 2 : 1; c.fillRect(Math.round(p.x), Math.round(p.y), s, s); }
    st.puffs = st.puffs.filter(p => p.t < 3.6);
    if (Math.sin(t * 5) > 0.6) { c.fillStyle = '#fff2b0'; c.fillRect(34, 25, 1, 1); } },
  poke(st) { st.push = 1.4; },
};

// Lotus pond with a frog that hops between pads when tapped
SCENES.lotus = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64);
    g.ell(32, 32, 31, 31, (u, v, x, y) => { const d = Math.hypot(u, v); if (d > 0.9) return h2(x >> 1, y >> 1, seed) < 0.5 ? 0x4e7a3e : 0x5e8a46; const n = noise(x * 0.12, y * 0.12, seed) - d * 0.2; return n > 0.5 ? 0x3c8a9c : n > 0.33 ? 0x2e7488 : 0x245e72; });
    for (let k = 0; k < 30; k++) { const a = k / 30 * Math.PI * 2; g.ell(32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28, 2.2, 1.8, (u, v) => v < -0.2 ? 0xd2ccc2 : 0x9a948c); }
    for (let k = 0; k < 8; k++) { const a = h2(k, 9, seed) * 6.28, x = 32 + Math.cos(a) * 25, y = 32 + Math.sin(a) * 25; for (let j = 0; j < 6; j++) g.set(x + (j & 1), y - j, 0x6a9a3a); g.set(x, y - 6, 0x7a4a2a); }
    const pads = [[19, 38, 8], [41, 26, 7], [30, 48, 5.5], [46, 43, 5]];
    for (const [x, y, r] of pads) g.ell(x, y, r, r * 0.7, (u, v) => (u > 0 && Math.abs(v) < 0.12) ? null : v < -0.4 ? 0x86c45a : u > 0.4 ? 0x2e7a34 : 0x4e9a42);
    g.ell(41, 22, 4, 3, (u, v) => v < -0.3 ? 0xffd8e4 : 0xf2a0b8); g.ell(41, 20, 2, 2.2, 0xffeef2); g.set(41, 21, 0xf6d04a);
    return { g: g.canvas(), pads }; },
  init(st, B) { st.f = { pad: 0, x: B.pads[0][0], y: B.pads[0][1] - 3, hop: null }; st.rip = []; },
  frame(c, st, dt, t, B) { c.drawImage(B.g, 0, 0); const f = st.f;
    for (const r of st.rip) { r.t += dt; const rr = 2 + r.t * 10; c.strokeStyle = `rgba(220,245,255,${Math.max(0, 0.6 - r.t)})`; c.beginPath(); c.ellipse(r.x, r.y, rr, rr * 0.6, 0, 0, Math.PI * 2); c.stroke(); } st.rip = st.rip.filter(r => r.t < 0.6);
    let x = f.x, y = f.y, z = 0; if (f.hop) { f.hop.t += dt * 1.6; const k = Math.min(1, f.hop.t); x = f.hop.x0 + (f.hop.x1 - f.hop.x0) * k; y = f.hop.y0 + (f.hop.y1 - f.hop.y0) * k; z = Math.sin(k * Math.PI) * 9; if (k >= 1) { f.x = x; f.y = y; f.hop = null; st.rip.push({ x, y: y + 3, t: 0 }); } }
    const X = Math.round(x), Y = Math.round(y - z), G = '#5aa040', D = '#2e6a28';
    c.fillStyle = D; c.fillRect(X - 3, Y + 1, 7, 3); c.fillStyle = G; c.fillRect(X - 2, Y, 5, 3); c.fillRect(X - 3, Y - 1, 2, 2); c.fillRect(X + 2, Y - 1, 2, 2); c.fillStyle = '#16101a'; c.fillRect(X - 3, Y - 1, 1, 1); c.fillRect(X + 3, Y - 1, 1, 1); c.fillStyle = '#d8f0a0'; c.fillRect(X - 1, Y + 2, 3, 1);
    if (!f.hop && Math.sin(t * 1.7) > 0.97) { c.fillStyle = '#e8f8c8'; c.fillRect(X, Y + 3, 2, 2); } },
  poke(st, x, y, B) { const f = st.f; if (f.hop) return; let n = (f.pad + 1 + (Math.random() * 3 | 0)) % B.pads.length; if (n === f.pad) n = (n + 1) % B.pads.length; const p = B.pads[n]; f.hop = { x0: f.x, y0: f.y, x1: p[0], y1: p[1] - 3, t: 0 }; f.pad = n; },
};

// Snow-laden pine in falling snow; tap for a gust that shakes snow from the boughs
SCENES.snow = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64), G = [0x163028, 0x1e4034, 0x2a5440, 0x3a6a4c], S = [0xc8d4e8, 0xe2eaf4, 0xffffff];
    groundPile(g, 32, 58, 22, 4.5, [0xa8b8d0, 0xc8d4e8, 0xe2eaf4, 0xf6f8fc], seed);
    bark(g, [[32, 58], [32, 48]], 4, 3, [0x2a1a14, 0x3e281c, 0x56382a, 0x6e4a36], seed);
    for (let t = 4; t >= 0; t--) { const y0 = 6 + t * 8.5, y1 = y0 + 13, hw = 6 + t * 4.2;
      for (let y = Math.floor(y0); y <= y1; y++) { const f = (y - y0) / (y1 - y0), w = 1 + (hw - 1) * f, zig = ((y * 3 + t) % 4 < 2) ? 1 : 0;
        for (let x = Math.round(32 - w); x <= 32 + w; x++) { const u = (x - 32) / w, bot = y > y1 - 1.5 - zig; let c = G[Math.max(0, Math.min(3, Math.round(2.4 - u * 1.2 - f * 0.8)))]; if (bot) c = G[0];
          if (f < 0.42 + h2(x, t, seed) * 0.2 && u < 0.55 - f * 0.4) c = f < 0.22 || u < -0.3 ? S[2] : S[1]; g.set(x, y, c); } } }
    g.outline(0x0e1c18, (x, y) => y < 54); return { g: g.canvas() }; },
  init(st) { st.flakes = Array.from({ length: 34 }, () => ({ x: Math.random() * 64, y: Math.random() * 64, s: 4 + Math.random() * 6, ph: Math.random() * 6 })); st.gust = 0; st.fall = Petals(['#ffffff', '#e2eaf4'], { max: 30, rest: 2 }); },
  frame(c, st, dt, t, B) { if (st.gust > 0) st.gust -= dt; c.drawImage(B.g, st.gust > 0 ? Math.round(Math.sin(t * 30) * 0.7) : 0, 0);
    for (const f of st.flakes) { f.y += f.s * dt * (st.gust > 0 ? 1.8 : 1); f.x += (Math.sin(t + f.ph) * 3 + (st.gust > 0 ? 22 : 2)) * dt; if (f.y > 62) { f.y = -2; f.x = Math.random() * 64; } if (f.x > 64) f.x -= 64;
      c.fillStyle = f.s > 8 ? '#ffffff' : 'rgba(200,214,236,0.9)'; c.fillRect(Math.round(f.x), Math.round(f.y), 1, 1); }
    if (st.gust > 0 && Math.random() < 0.6) st.fall.spawn(18 + Math.random() * 28, 10 + Math.random() * 36, 14); st.fall.step(dt, () => 56, 6); st.fall.draw(c); },
  poke(st) { st.gust = 1.4; },
};

// Mt Fuji at sunrise in a round window, cranes crossing; tap to send a flock
SCENES.fuji = { w: 64, h: 64,
  bake(seed) { const g = new Img(64, 64);
    disc(g, 32, 32, 31, [0x3a4a8a, 0x6a5a9a, 0xb07090, 0xe8907a, 0xf6b880, 0xffd8a0], 0x22243e);
    const clip = inDisc(32, 32, 31);
    g.ell(32, 40, 9, 9, (u, v) => v < 0 ? (u * u + v * v < 0.4 ? 0xfff2c8 : 0xffd890) : null);
    for (let y = 18; y < 64; y++) { const hw = 4 + (y - 18) * 1.25 + (y > 40 ? (y - 40) * 0.8 : 0); for (let x = Math.round(32 - hw); x <= 32 + hw; x++) { if (!clip(x, y)) continue; const u = (x - 32) / hw, snow = y < 27 + Math.round(Math.sin(x * 1.3) * 1.5 + h2(x, 1, seed) * 2);
      g.set(x, y, snow ? (u < 0.1 ? 0xffffff : 0xd0d8ec) : u < -0.2 ? 0x5a5a8a : u < 0.4 ? 0x46467a : 0x36366a); } }
    for (let x = 0; x < 64; x++) for (let y = 50; y < 64; y++) if (clip(x, y)) { const c = y < 53 ? 0x6a7aa8 : (x + y * 2) % 9 === 0 ? 0x9aaad0 : 0x5a6a98; g.set(x, y, c); }
    for (let k = 0; k < 10; k++) { const x = 4 + k * 6 + h2(k, 2, seed) * 3, y = 51 + h2(k, 3, seed) * 3; if (clip(x, y)) { g.set(x, y, 0xffe0a0); g.set(x + 1, y, 0xffe0a0); } }
    for (const [x, y, w] of [[10, 22, 10], [44, 16, 12], [20, 34, 8]]) { g.rect(x, y, w, 1, 0xffffff); g.rect(x + 2, y - 1, w - 4, 1, 0xfff2e6); }
    return { g: g.canvas(), clip }; },
  init(st) { st.birds = []; st.next = 1; },
  frame(c, st, dt, t, B) { c.drawImage(B.g, 0, 0);
    if ((st.next -= dt) <= 0) { st.next = 6 + Math.random() * 6; for (let k = 0; k < 3; k++) st.birds.push({ x: -4 - k * 7, y: 14 + k * 3 + Math.random() * 4, t: Math.random() * 6 }); }
    for (const b of st.birds) { b.t += dt; b.x += dt * 9; const f = Math.sin(b.t * 6) > 0, x = Math.round(b.x), y = Math.round(b.y + Math.sin(b.t * 1.5)); if (!B.clip(x, y)) continue; c.fillStyle = '#2a2440'; c.fillRect(x, y, 1, 1); c.fillRect(x - 1, y + (f ? -1 : 1), 1, 1); c.fillRect(x + 1, y + (f ? -1 : 1), 1, 1); if (f) { c.fillRect(x - 2, y - 1, 1, 1); c.fillRect(x + 2, y - 1, 1, 1); } }
    st.birds = st.birds.filter(b => b.x < 70); },
  poke(st) { for (let k = 0; k < 5; k++) st.birds.push({ x: -2 - k * 5, y: 10 + Math.abs(k - 2) * 3 + Math.random() * 3, t: k }); },
};

const LIST = ['sakura', 'plum', 'maple', 'lantern', 'koi', 'bonsai', 'torii', 'bamboo', 'incense', 'lotus', 'snow', 'fuji'];
const THEMES = [[/ocean|water|flow/, ['koi', 'lotus', 'fuji']], [/love|relationship|heart|you-never|take-me|blessed/, ['sakura', 'plum', 'lotus']], [/god|divine|self|curse|prayer/, ['torii', 'incense', 'lantern']], [/ocean|water|flow|interconnected/, ['koi', 'lotus']],
  [/thought|wisdom|step|effort|cloud|wake/, ['bonsai', 'bamboo', 'incense', 'fuji']], [/happy|unity|world|met|lie/, ['maple', 'sakura', 'lantern']], [/trust/, ['lantern', 'bamboo', 'snow']]];
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
    this.cv.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && ['sakura', 'plum', 'maple', 'bamboo', 'snow'].includes(this.name)) S.poke && S.poke(this.st, 32, 20, this.B); });
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
      const first = pickScene(slug), pool = ['incense', 'bonsai', 'lotus', 'lantern', 'koi', 'bamboo', 'snow', 'fuji'].filter(n => n !== first);
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
