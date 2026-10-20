// PX: the pixel-art engine for the Dashain / Tihar cards and films.
// A low-res RGBA raster (Uint32, little-endian ABGR) that is drawn with ordered (Bayer) dithering instead of
// alpha, then blown up with nearest-neighbour onto the full-res canvas, where crisp type can sit on top.
// Everything is deterministic: randomness comes from seeded generators, motion from the time argument.
'use strict';
const PX = (() => {
  // ---------- maths
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v, mix = (a, b, t) => a + (b - a) * t;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  function bez(x1, y1, x2, y2) { const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    return t => { if (t <= 0) return 0; if (t >= 1) return 1; let x = t; for (let i = 0; i < 8; i++) { const fx = ((ax * x + bx) * x + cx) * x - t, d = (3 * ax * x + 2 * bx) * x + cx; if (Math.abs(fx) < 1e-6 || !d) break; x -= fx / d; } return ((ay * x + by) * x + cy) * x; }; }
  const E = { out: bez(.16, 1, .3, 1), inOut: bez(.87, 0, .13, 1), smooth: bez(.65, 0, .35, 1), in: bez(.55, .055, .675, .19), whip: bez(.6, 0, .15, 1), soft: bez(.33, 0, .2, 1),
    back: t => { const c = 1.70158 * 1.3; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }, lin: t => clamp(t) };
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const hash = (x, y = 0, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function noise1(x, s = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return mix(hash(i, 0, s), hash(i + 1, 0, s), u); }
  const fbm = (x, s = 0, o = 4) => { let v = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { v += a * noise1(x * f, s + i * 17); a *= 0.5; f *= 2; } return v / (1 - Math.pow(0.5, o)); };

  // ---------- colour
  const hex = (h, a = 1) => { h = h.replace('#', ''); const n = parseInt(h, 16); return (((a * 255) & 255) << 24 | (n & 255) << 16 | ((n >> 8) & 255) << 8 | (n >> 16)) >>> 0; };
  const rgbOf = c => [c & 255, (c >> 8) & 255, (c >> 16) & 255];
  const pack = (r, g, b) => (255 << 24 | (b & 255) << 16 | (g & 255) << 8 | (r & 255)) >>> 0;
  const lerpC = (a, b, t) => { const A = rgbOf(a), B = rgbOf(b); return pack(mix(A[0], B[0], t), mix(A[1], B[1], t), mix(A[2], B[2], t)); };
  const css = c => { const [r, g, b] = rgbOf(c); return `rgb(${r},${g},${b})`; };
  // 4x4 Bayer matrix, normalised to (0,1)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

  // ---------- the raster
  class Raster {
    constructor(w, h) { this.w = w; this.h = h; this.cv = document.createElement('canvas'); this.cv.width = w; this.cv.height = h; this.x = this.cv.getContext('2d', { willReadFrequently: true });
      this.im = this.x.createImageData(w, h); this.b = new Uint32Array(this.im.data.buffer); this.tmp = document.createElement('canvas'); this.tx = this.tmp.getContext('2d', { willReadFrequently: true }); this.ox = 0; this.oy = 0; }
    clear(c = 0) { this.b.fill(c); }
    // plain pixel; with a < 1 the pixel is kept or dropped by the Bayer threshold (dithered transparency)
    px(x, y, c, a = 1) { x = (x + this.ox) | 0; y = (y + this.oy) | 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; if (a < 1 && a <= bayer(x, y)) return; this.b[y * this.w + x] = c; }
    get(x, y) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0; return this.b[y * this.w + x]; }
    // true colour blend (for glows that should stay smooth inside bands)
    blend(x, y, c, a) { x = (x + this.ox) | 0; y = (y + this.oy) | 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return; const i = y * this.w + x; this.b[i] = lerpC(this.b[i], c, clamp(a)); }
    add(x, y, c, a) { x = (x + this.ox) | 0; y = (y + this.oy) | 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return; const i = y * this.w + x, A = rgbOf(this.b[i]), B = rgbOf(c);
      this.b[i] = pack(Math.min(255, A[0] + B[0] * a), Math.min(255, A[1] + B[1] * a), Math.min(255, A[2] + B[2] * a)); }
    rect(x, y, w, h, c, a = 1) { x = Math.round(x); y = Math.round(y); for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c, a); }
    hline(x0, x1, y, c, a = 1) { for (let i = Math.round(x0); i <= Math.round(x1); i++) this.px(i, y, c, a); }
    vline(x, y0, y1, c, a = 1) { for (let j = Math.round(y0); j <= Math.round(y1); j++) this.px(x, j, c, a); }
    disc(cx, cy, r, c, a = 1) { const R = r + 0.5; for (let j = Math.floor(cy - R); j <= Math.ceil(cy + R); j++) for (let i = Math.floor(cx - R); i <= Math.ceil(cx + R); i++) { const dx = i - cx, dy = j - cy; if (dx * dx + dy * dy <= r * r + r * 0.8) this.px(i, j, c, a); } }
    ring(cx, cy, r, c, th = 1, a = 1) { const R = r + 1; for (let j = Math.floor(cy - R); j <= Math.ceil(cy + R); j++) for (let i = Math.floor(cx - R); i <= Math.ceil(cx + R); i++) { const d = Math.hypot(i - cx, j - cy); if (d <= r + 0.5 && d > r + 0.5 - th) this.px(i, j, c, a); } }
    ellipse(cx, cy, rx, ry, c, a = 1) { for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++) for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) { const dx = (i - cx) / (rx + .4), dy = (j - cy) / (ry + .4); if (dx * dx + dy * dy <= 1) this.px(i, j, c, a); } }
    line(x0, y0, x1, y1, c, a = 1) { x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy, n = 0;
      while (n++ < 4000) { this.px(x0, y0, c, a); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } }
    // quadratic curve (string / rope), drawn as short Bresenham segments
    curve(x0, y0, cx, cy, x1, y1, c, a = 1, seg = 16) { let px = x0, py = y0; for (let i = 1; i <= seg; i++) { const t = i / seg, u = 1 - t, x = u * u * x0 + 2 * u * t * cx + t * t * x1, y = u * u * y0 + 2 * u * t * cy + t * t * y1; this.line(px, py, x, y, c, a); px = x; py = y; } }
    // scan-line polygon fill: pts = [[x,y],...]
    poly(pts, c, a = 1) { let y0 = 1e9, y1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) { const yc = y + 0.5, xs = []; for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax)); }
        xs.sort((p, q) => p - q); for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.px(x, y, c, a); } }
    // vertical gradient through colour stops [[t, col],...]: quantised into bands a few pixels tall, with an ordered-dither seam between bands
    vgrad(y0, y1, stops, x0 = 0, x1 = this.w, band = 7) { const at = t => { let k = 0; while (k < stops.length - 2 && stops[k + 1][0] < t) k++; const [ta, ca] = stops[k], [tb, cb] = stops[k + 1]; return lerpC(ca, cb, clamp((t - ta) / (tb - ta || 1))); };
      const n = Math.max(2, Math.round((y1 - y0) / band)), cols = []; for (let i = 0; i <= n; i++) cols.push(at(i / n));
      for (let y = Math.floor(y0); y < y1; y++) { const f = clamp((y - y0) / (y1 - y0)) * n, i = Math.min(n - 1, Math.floor(f)), u = clamp((f - i - 0.55) / 0.45);
        for (let x = x0; x < x1; x++) this.px(x, y, u > bayer(x + this.ox, y + this.oy) ? cols[i + 1] : cols[i]); } }
    // radial glow in hard bands (pixel-art style): additive light that falls off in `bands` steps
    glow(cx, cy, r, c, k = 0.5, bands = 4) { for (let j = Math.floor(cy - r); j <= cy + r; j++) for (let i = Math.floor(cx - r); i <= cx + r; i++) { const d = Math.hypot(i - cx, j - cy) / r; if (d >= 1) continue;
      const v = Math.ceil((1 - d) * (1 - d) * bands) / bands; this.add(i, j, c, v * k); } }
    // posterised radial falloff of a solid colour (sun, halo): solid rings, each a step brighter, with a dithered seam
    halo(cx, cy, r, c, a = 1, p = 1.5, bands = 5) { for (let j = Math.floor(cy - r); j <= cy + r; j++) for (let i = Math.floor(cx - r); i <= cx + r; i++) { const d = Math.hypot(i - cx, j - cy) / r; if (d >= 1) continue;
      const v = Math.pow(1 - d, p) * bands, k = Math.floor(v), fr = v - k, q = (k + (fr > 0.75 && (fr - 0.75) / 0.25 > bayer(i, j) ? 1 : 0)) / bands; if (q > 0) this.blend(i, j, c, a * q); } }
    // 1-px outline around every pixel that differs from `bg`-free space, sampled from a mask function
    outline(mask, c) { const w = this.w, h = this.h, out = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!mask(x, y) && (mask(x - 1, y) || mask(x + 1, y) || mask(x, y - 1) || mask(x, y + 1))) out.push(x, y); for (let i = 0; i < out.length; i += 2) this.b[out[i + 1] * w + out[i]] = c; }
    // ASCII sprite: rows of chars, pal maps char -> colour (space/'.' transparent); sc integer scale; flip mirrors
    spr(rows, pal, x, y, sc = 1, flip = false, a = 1) { const H = rows.length, W = rows[0].length; for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const ch = rows[j][flip ? W - 1 - i : i], c = pal[ch]; if (c === undefined) continue;
      for (let v = 0; v < sc; v++) for (let u = 0; u < sc; u++) this.px(x + i * sc + u, y + j * sc + v, c, a); } }
    // pixel text: rasterise any font (Devanagari too) at low res, threshold the coverage, then optionally outline + drop shadow
    text(str, x, y, font, c, o = {}) { const { align = 'center', base = 'alphabetic', thr = 0.45, outline = null, shadow = null, sdx = 1, sdy = 1, a = 1, ls = 0 } = o; const tx = this.tx;
      tx.font = font; if (ls) tx.letterSpacing = ls + 'px'; else tx.letterSpacing = '0px'; const m = tx.measureText(str), tw = Math.ceil(m.width) + 8, asc = Math.ceil(m.actualBoundingBoxAscent) + 6, des = Math.ceil(m.actualBoundingBoxDescent) + 6, th = asc + des;
      this.tmp.width = tw; this.tmp.height = th; tx.font = font; tx.letterSpacing = ls ? ls + 'px' : '0px'; tx.fillStyle = '#fff'; tx.textBaseline = 'alphabetic'; tx.fillText(str, 4, asc);
      const d = tx.getImageData(0, 0, tw, th).data, X = Math.round(align === 'center' ? x - m.width / 2 : align === 'right' ? x - m.width : x) - 4, Y = Math.round(base === 'middle' ? y - (asc - 6 - (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) / 2) - 6 + 6 : y) - asc;
      const on = (i, j) => i >= 0 && j >= 0 && i < tw && j < th && d[(j * tw + i) * 4 + 3] > thr * 255;
      if (shadow !== null) for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) if (on(i, j)) for (let s = 1; s <= Math.max(Math.abs(sdx), Math.abs(sdy)); s++) this.px(X + i + Math.sign(sdx) * Math.min(s, Math.abs(sdx)), Y + j + Math.sign(sdy) * Math.min(s, Math.abs(sdy)), shadow, a);
      if (outline !== null) for (let j = -1; j <= th; j++) for (let i = -1; i <= tw; i++) if (!on(i, j) && (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1))) this.px(X + i, Y + j, outline, a);
      for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) if (on(i, j)) this.px(X + i, Y + j, typeof c === 'function' ? c(i / tw, j / th) : c, a);
      return { x: X + 4, y: Y + asc, w: m.width, asc: m.actualBoundingBoxAscent, des: m.actualBoundingBoxDescent }; }
    commit() { this.x.putImageData(this.im, 0, 0); return this.cv; }
    // nearest-neighbour blow-up onto the full-res context at integer scale s (with an optional sub-pixel camera offset)
    blit(ctx, s, dx = 0, dy = 0, dw = this.w * s, dh = this.h * s) { this.commit(); ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(this.cv, dx, dy, dw, dh); ctx.restore(); }
  }

  // ---------- palettes
  const P = {
    // Dashain: autumn sky, sindoor, marigold, jamara, temple brick
    sky0: hex('#1f4e8c'), sky1: hex('#3d7cc9'), sky2: hex('#7fb4e6'), sky3: hex('#cfe6f5'), cloud: hex('#f6f3ea'), cloudS: hex('#c9d6e3'),
    snow: hex('#f4f7fb'), snowS: hex('#b8c7da'), rock: hex('#5b6b85'), rockD: hex('#3e4a60'), hill0: hex('#2f5d50'), hill1: hex('#3f7a5a'), hill2: hex('#5b9a62'), hill3: hex('#86b86a'),
    brick: hex('#9c3b26'), brickD: hex('#6e2418'), brickL: hex('#c0573a'), wood: hex('#4a2a1a'), woodL: hex('#6d4128'), roof: hex('#3a2c2a'), roofL: hex('#5a4642'), gold: hex('#f2b733'), goldD: hex('#b97a12'), goldL: hex('#ffe08a'),
    sindoor: hex('#d7192a'), sindoorD: hex('#9a0f1c'), sindoorL: hex('#ff4a4a'), rice: hex('#fff1dc'), curd: hex('#fff8ee'),
    jam0: hex('#f5f0a0'), jam1: hex('#e3e05a'), jam2: hex('#b9c93a'), jam3: hex('#7f9a2a'),
    mari: hex('#ff9f1c'), mariD: hex('#e0610e'), mariL: hex('#ffd25a'), leaf: hex('#2f7d3a'), leafD: hex('#1d5428'),
    ink: hex('#1a1220'), inkS: hex('#2c2133'), paper: hex('#f6eedf'), paperD: hex('#e7d8bf'), white: hex('#ffffff'), black: hex('#000000'),
    // Tihar: night, diyo, rangoli, makhamali
    night0: hex('#070a1f'), night1: hex('#0f1640'), night2: hex('#22205e'), night3: hex('#3b2a74'), dusk: hex('#7a3d7a'), flame0: hex('#fff6c8'), flame1: hex('#ffd25a'), flame2: hex('#ff8a1c'), flame3: hex('#e0400e'),
    clay: hex('#a8532c'), clayD: hex('#6b2e17'), clayL: hex('#cf7a45'), makh: hex('#c2185b'), makhL: hex('#ee4f8f'), makhD: hex('#7d0f3c'), teal: hex('#1fb5a6'), violet: hex('#7c4dff'), lime: hex('#a6e22e'),
  };
  P.rainbow = ['#d7192a', '#ff8a1c', '#ffd400', '#2fae4a', '#1f7ae0', '#2a2aa8', '#8a2be2'].map(h => hex(h));   // the seven colours of Bhai Tika's saptarangi tika

  // ---------- sprite kit (each is a function of the raster and parameters; t = seconds for anything alive)
  const K = {};
  // Himalayan ridge: layered noise with snow above a line, light from the left
  K.himal = (R, y, amp, seed, o = {}) => { const { snowLine = 0.55, x0 = 0, x1 = R.w, freq = 0.035, col = P.rock, colD = P.rockD, snow = P.snow, snowS = P.snowS, peaks = [] } = o;
    const H = x => { let v = fbm(x * freq, seed, 3) * amp; for (const p of peaks) v = Math.max(v, p.h * Math.max(0, 1 - Math.pow(Math.abs(x - p.x) / p.w, p.k || 1.1))); return v; };
    for (let x = x0; x < x1; x++) { const top = y - H(x), slope = H(x + 3) - H(x - 3) + (H(x + 1) - H(x - 1)) * 0.5; for (let j = Math.floor(top); j < R.h; j++) { const depth = j - top, lit = slope > 0;
      const hgt = y - top, mx = Math.max(amp, ...peaks.map(p => p.h)), sn = hgt > mx * 0.42 && depth < (hgt - mx * 0.42) * (0.55 + 0.5 * fbm(x * 0.06, seed + 9, 2)) + 1;
      R.px(x, j, sn ? (lit ? snow : snowS) : (lit ? col : colD)); } } return H; };
  // fishtail (Machhapuchhre) silhouette peak: two horns
  K.fishtail = (x, h, w) => [{ x: x, h: h, w: w, k: 1.25 }, { x: x + w * 0.22, h: h * 0.93, w: w * 0.55, k: 1.2 }];
  K.hills = (R, y, amp, seed, cols, o = {}) => { const { freq = 0.02 } = o; for (let x = 0; x < R.w; x++) { const top = Math.round(y - fbm(x * freq + seed * 3.1, seed, 4) * amp); for (let j = top; j < R.h; j++) { const d = j - top; R.px(x, j, d < 1 ? cols[0] : d < 3 && (x + j) % 2 ? cols[0] : cols[1]); } } };
  // terraced fields: stacked arcs, alternating shades, with a lighter lip
  K.terraces = (R, y0, y1, seed, cols) => { let y = y0, k = 0; while (y < y1) { const hh = 4 + Math.floor(hash(k, 1, seed) * 2) + Math.floor(k / 3); for (let x = 0; x < R.w; x++) { const off = Math.round(Math.sin(x * 0.025 + k * 1.7 + seed) * 2.2 + Math.sin(x * 0.011 + k) * 1.5);
    for (let j = 0; j < hh; j++) R.px(x, y + j + off, j === 0 ? cols[2] : cols[k % 2]); } y += hh; k++; } };
  K.cloud = (R, x, y, s, c = P.cloud, cs = P.cloudS) => { const b = [[0, 0, 5], [6, -3, 7], [14, -1, 6], [20, 1, 4], [-6, 1, 4]]; for (const [dx, dy, r] of b) R.disc(x + dx * s, y + dy * s, r * s, cs); for (const [dx, dy, r] of b) R.disc(x + dx * s, y + dy * s - 1, r * s, c); R.rect(x - 9 * s, y + 1 * s, 33 * s, 4 * s, cs); };
  // a multi-tier Newar pagoda (Nyatapola-ish): plinth steps, tiers of roofs with gilded finial
  K.pagoda = (R, cx, base, s, tiers = 3, o = {}) => { const { lit = 0, night = false } = o; const roof = night ? P.night2 : P.roof, roofL = night ? P.night3 : P.roofL, brick = night ? P.inkS : P.brick, brickD = night ? P.ink : P.brickD;
    let y = base; for (let k = 0; k < 3; k++) { const w = Math.round((26 - k * 5) * s), h = Math.round(3 * s); R.rect(cx - w / 2, y - h, w, h, k % 2 ? brickD : brick); R.hline(cx - w / 2, cx + w / 2 - 1, y - h, brickD); y -= h; }
    for (let k = 0; k < tiers; k++) { const bw = Math.round((12 - k * 2.6) * s), bh = Math.round(5 * s), rw = Math.round((22 - k * 4.8) * s), rh = Math.round(4 * s);
      R.rect(cx - bw / 2, y - bh, bw, bh, brick); R.rect(cx - 1, y - bh + 1, 2, bh - 1, night ? (lit ? P.flame1 : P.ink) : P.wood); if (lit) R.glow(cx, y - bh / 2, 6 * s, P.flame2, 0.35 * lit);
      y -= bh; R.poly([[cx - rw / 2 - 1, y + 1], [cx + rw / 2 + 1, y + 1], [cx + bw / 2 - 1, y - rh], [cx - bw / 2 + 1, y - rh]], roof); R.hline(cx - rw / 2 - 1, cx + rw / 2, y, roofL);
      for (let i = -rw / 2; i < rw / 2; i += 3) R.px(cx + i, y + 1, P.goldD); y -= rh; }
    R.rect(cx - 1, y - Math.round(5 * s), 2, Math.round(5 * s), P.gold); R.disc(cx, y - Math.round(5 * s), 1, P.goldL); return y; };
  // Swayambhu-style stupa with the eyes of the Buddha
  K.stupa = (R, cx, base, s, o = {}) => { const { night = false } = o; const W = night ? P.night3 : P.paper, WD = night ? P.night2 : P.paperD;
    R.ellipse(cx, base - 6 * s, 16 * s, 9 * s, WD); R.ellipse(cx - 1, base - 7 * s, 15 * s, 8 * s, W); R.rect(cx - 16 * s, base - 6 * s, 32 * s, 6 * s, WD); R.rect(cx - 5 * s, base - 19 * s, 10 * s, 6 * s, P.gold);
    R.rect(cx - 4 * s, base - 17 * s, 3 * s, 1, P.ink); R.rect(cx + 1 * s, base - 17 * s, 3 * s, 1, P.ink); R.px(cx, base - 15 * s, P.ink); R.px(cx, base - 14 * s, P.ink);
    for (let k = 0; k < 9; k++) { const w = (8 - k * 0.7) * s; R.rect(cx - w / 2, base - 20 * s - k * 2 * s, w, 2 * s - (k % 2 ? 0 : 1), k % 2 ? P.goldD : P.gold); } R.disc(cx, base - 40 * s, 2 * s, P.gold); return base - 40 * s; };
  // a row of brick houses with windows; lit: windows glow and get a diyo on the sill
  K.houses = (R, x0, x1, base, seed, o = {}) => { const { night = false, lit = 0, t = 0 } = o; const r = rng(seed); let x = x0; const out = [];
    while (x < x1) { const w = 12 + Math.floor(r() * 10), h = 14 + Math.floor(r() * 16), c = night ? (r() < .5 ? P.inkS : P.night1) : (r() < 0.6 ? P.brick : P.brickL);
      R.rect(x, base - h, w, h, c); R.rect(x - 1, base - h - 2, w + 2, 2, night ? P.ink : P.roof); R.hline(x - 1, x + w, base - h - 2, night ? P.night2 : P.roofL);
      for (let fy = base - h + 3; fy < base - 5; fy += 6) for (let fx = x + 2; fx < x + w - 3; fx += 5) { const on = night && hash(fx, fy, seed) < lit;
        R.rect(fx, fy, 3, 3, night ? (on ? P.flame1 : P.ink) : P.wood); if (!night) R.px(fx + 1, fy + 1, P.woodL); if (on) { R.glow(fx + 1, fy + 1, 7, P.flame2, 0.25 + 0.08 * Math.sin(t * 7 + fx)); out.push([fx + 1, fy + 3]); } }
      x += w + 1 + Math.floor(r() * 3); } return out; };
  // changa (patang): a diamond kite with spine, cross-spar, tail; ang = tilt in radians
  K.kite = (R, x, y, s, col, col2, ang = 0, tailT = 0, o = {}) => { const { tail = true, strCol = null, sx = null, sy = null } = o; const ca = Math.cos(ang), sa = Math.sin(ang), rot = (u, v) => [x + (u * ca - v * sa) * s, y + (u * sa + v * ca) * s];
    const T = rot(0, -7), Rr = rot(6, 0), B = rot(0, 9), L = rot(-6, 0); R.poly([T, Rr, B, L], col); R.poly([T, Rr, rot(0, 0)], col2); R.poly([B, L, rot(0, 0)], col2);
    R.line(...T, ...B, P.ink, 0.6); R.line(...L, ...Rr, P.ink, 0.6);
    if (tail) { let [px_, py_] = B; for (let k = 1; k < 7; k++) { const [qx, qy] = rot(Math.sin(tailT * 6 + k * 0.9) * k * 0.7, 9 + k * 2.4); R.line(px_, py_, qx, qy, col); px_ = qx; py_ = qy; if (k % 2 === 0) R.px(qx, qy, col2); } }
    if (strCol !== null && sx !== null) { const [cxp, cyp] = rot(0, 2); R.curve(cxp, cyp, (cxp + sx) / 2 + 6, Math.max(cyp, sy) + 10, sx, sy, strCol, 0.75, 24); } };
  // jamara: barley shoots; n blades, height h, sway in [-1,1]; the pale yellow-green of shoots grown in the dark
  K.jamara = (R, cx, base, h, n, seed, t = 0, o = {}) => { const { spread = 6, grow = 1 } = o; const r = rng(seed); for (let i = 0; i < n; i++) { const off = (r() - 0.5) * 2 * spread, hh = h * (0.65 + 0.35 * r()) * grow, ph = r() * 6, lean = (r() - 0.5) * 0.7;
      const col = [P.jam0, P.jam1, P.jam2, P.jam3][Math.floor(r() * 4)]; let px_ = cx + off, py_ = base; const segs = Math.max(2, Math.round(hh / 2));
      for (let k = 1; k <= segs; k++) { const u = k / segs, sw = Math.sin(t * 1.6 + ph) * 1.6 * u * u + lean * u * hh * 0.5, x = cx + off + sw + off * u * 0.25, y = base - u * hh; R.line(px_, py_, x, y, col); px_ = x; py_ = y; } } };
  // clay diyo with a living flame; flick = flame size multiplier
  K.diyo = (R, x, y, s = 1, t = 0, seed = 0, o = {}) => { const { lit = 1, glow = true } = o; const fl = 0.85 + 0.15 * Math.sin(t * 13 + seed * 3) + 0.08 * Math.sin(t * 29 + seed);
    R.poly([[x - 4 * s, y], [x + 4 * s, y], [x + 2.5 * s, y + 2.4 * s], [x - 2.5 * s, y + 2.4 * s]], P.clay); R.hline(x - 4 * s, x + 4 * s - 1, y, P.clayL); R.hline(x - 2 * s, x + 2 * s, y + Math.ceil(2.4 * s) - 1, P.clayD); R.px(x + 4 * s, y - 1, P.clay);
    if (lit <= 0) return; const fh = Math.max(2, Math.round(5 * s * fl * lit)), sway = Math.round(Math.sin(t * 5 + seed) * 0.6 * s);
    if (glow) R.glow(x, y - fh / 2, 14 * s * lit, P.flame2, 0.32 * lit * fl);
    for (let j = 0; j < fh; j++) { const u = j / fh, w = Math.max(0, Math.round((1 - u) * 1.6 * s * (u < 0.3 ? u / 0.3 : 1))); const cx = x + Math.round(sway * u); R.hline(cx - w, cx + w, y - 1 - j, u < 0.25 ? P.flame0 : u < 0.6 ? P.flame1 : P.flame2); }
    R.px(x + sway, y - fh - 1, P.flame3, 0.7); };
  // sayapatri (marigold) bloom
  K.marigold = (R, x, y, r = 2, seed = 0) => { R.disc(x, y, r, P.mariD); R.disc(x - 0.4, y - 0.4, Math.max(0, r - 0.8), P.mari); for (let k = 0; k < 4; k++) { const a = k * 1.57 + seed; R.px(x + Math.round(Math.cos(a) * r * 0.5), y + Math.round(Math.sin(a) * r * 0.5), P.mariL); } };
  // a sagging garland of alternating marigold/makhamali between two points
  K.garland = (R, x0, y0, x1, y1, sag, r = 2, t = 0, alt = true) => { const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / (r * 1.8))); for (let i = 0; i <= n; i++) { const u = i / n, x = mix(x0, x1, u), y = mix(y0, y1, u) + Math.sin(u * Math.PI) * sag + Math.sin(t * 2 + u * 3) * 0.6;
    if (alt && i % 3 === 1) { R.disc(x, y, r - 0.5, P.makhD); R.disc(x - 0.3, y - 0.3, r - 1.2, P.makh); } else K.marigold(R, x, y, r, i); } };
  // dithered moon at phase p in [0,1]: 0 new -> 0.5 full -> 1 new (waxing until 0.5)
  K.moon = (R, cx, cy, r, phase, lit = P.paper, dark = null) => { const k = Math.cos(phase * 2 * Math.PI); for (let j = -r; j <= r; j++) { const hw = Math.sqrt(Math.max(0, r * r - j * j)); for (let i = -Math.ceil(hw); i <= Math.ceil(hw); i++) { if (i * i + j * j > r * r + r * .6) continue;
    const xn = i / (hw || 1), on = phase <= 0.5 ? xn > k : xn < -k; if (on) R.px(cx + i, cy + j, lit); else if (dark !== null) R.px(cx + i, cy + j, dark); } } };
  // a crow (kag), flapping
  K.crow = (R, x, y, s, t, flip = false) => { const w = Math.sin(t * 9); const C = P.ink, B = hex('#3a3550'); R.ellipse(x, y, 4 * s, 2 * s, C); R.disc(x + (flip ? -4 : 4) * s, y - 1 * s, 1.6 * s, C); R.px(x + (flip ? -6 : 6) * s, y - 1 * s, P.goldD); R.px(x + (flip ? -4 : 4) * s, y - 1.6 * s, P.white);
    R.poly([[x - 1 * s, y - 1], [x + 2 * s, y - 1], [x - 2 * s, y - 1 - (5 + 3 * w) * s]], B); R.poly([[x - (flip ? -4 : 4) * s, y], [x - (flip ? -8 : 8) * s, y - 1 * s], [x - (flip ? -8 : 8) * s, y + 2 * s]], C); };
  // a flying bird "v"
  K.bird = (R, x, y, t, c = P.ink) => { const w = Math.round(Math.sin(t * 10) * 1.5); R.px(x, y, c); R.px(x - 1, y - 1 - w, c); R.px(x + 1, y - 1 - w, c); R.px(x - 2, y - 1 - w * 2, c); R.px(x + 2, y - 1 - w * 2, c); };
  // a firework burst: age in seconds, colour
  K.firework = (R, x, y, age, c, seed, n = 26, rad = 22) => { if (age < 0) return; if (age < 0.6) { const u = age / 0.6; R.px(x, y + (1 - u) * 60, P.flame1); R.px(x, y + (1 - u) * 60 + 1, P.flame2, 0.6); return; } const a2 = age - 0.6; if (a2 > 1.6) return;
    const r = rad * E.out(Math.min(1, a2 / 0.9)), fade = 1 - a2 / 1.6; for (let k = 0; k < n; k++) { const ang = k / n * 6.283 + seed, rr = r * (0.85 + 0.15 * hash(k, seed)), px_ = x + Math.cos(ang) * rr, py_ = y + Math.sin(ang) * rr + a2 * a2 * 9;
      R.line(x + Math.cos(ang) * rr * 0.62, y + Math.sin(ang) * rr * 0.62 + a2 * a2 * 6, px_, py_, c, fade * 0.55); R.px(px_, py_, k % 3 ? c : P.flame0, fade); R.glow(px_, py_, 3, c, 0.3 * fade, 2); } if (a2 < 0.15) R.glow(x, y, 20, c, 0.6); };
  // trishul (trident of Durga)
  K.trishul = (R, cx, top, h, c = P.gold, cd = P.goldD, k = 1, cl = P.goldL) => { const q = v => Math.round(v * k);
    R.rect(cx - q(1.5), top + q(20), q(3), h - q(20), cd); R.rect(cx - q(1.5), top + q(20), Math.max(1, q(1.5)), h - q(20), c);
    R.poly([[cx - q(2.2), top + q(16)], [cx + q(2.2), top + q(16)], [cx + q(2.2), top + q(2)], [cx, top - q(5)], [cx - q(2.2), top + q(2)]], c); R.vline(cx - q(1), top - q(2), top + q(14), cl);
    for (const sd of [-1, 1]) { const pts = []; for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push([cx + sd * q(3 + 9 * Math.sin(u * 1.5)), top + q(18) - u * q(20) - (u > 0.75 ? (u - 0.75) * q(14) : 0)]); }
      const w = Math.max(1, q(1.6)); for (let i = 0; i < pts.length - 1; i++) for (let o = 0; o < w; o++) { R.line(pts[i][0] + sd * o, pts[i][1], pts[i + 1][0] + sd * o, pts[i + 1][1], o === 0 ? cl : c); } R.line(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[pts.length - 1][0] + sd * q(1), pts[pts.length - 1][1] - q(4), c); }
    R.rect(cx - q(11), top + q(17), q(22), q(3), c); R.hline(cx - q(11), cx + q(11) - 1, top + q(17), cl); R.hline(cx - q(11), cx + q(11) - 1, top + q(20), cd);
    R.disc(cx, top + q(26), q(3), P.sindoor); R.px(cx - q(1), top + q(25), P.sindoorL); R.disc(cx, top + q(33), q(1.5), c); // a damaru-knot and ribbon
    for (let i = 0; i < q(16); i++) { R.px(cx + q(3) + i * 0.5 + Math.sin(i * 0.5) * q(2), top + q(22) + i, P.sindoor); R.px(cx - q(3) - i * 0.4 - Math.sin(i * 0.6) * q(2), top + q(22) + i * 0.9, P.sindoorD); } };
  // ping: a bamboo swing (four poles tied at the top) with a rider at angle th
  K.ping = (R, cx, base, h, th, o = {}) => { const { rider = true, col = P.sindoor, rs = 1, pole = P.woodL, pole2 = P.wood, rope = P.paperD, skin = hex('#c98a5e'), hair = P.ink } = o; const top = base - h, sp = h * 0.3;
    for (const [dx, c, dz] of [[-sp * 0.62, pole2, -3], [sp * 0.62, pole2, -3], [-sp, pole, 0], [sp, pole, 0]]) { R.line(cx + dx, base + dz, cx, top, c); R.line(cx + dx + 1, base + dz, cx + 1, top, c); }
    R.rect(cx - 4, top - 2, 9, 3, pole2); R.hline(cx - 4, cx + 4, top - 2, pole);
    const L = h * 0.8, sx = cx + Math.sin(th) * L, sy = top + Math.cos(th) * L, hw = 4 * rs, ux = Math.cos(th), uy = -Math.sin(th);
    R.line(cx - 1, top, sx - hw * ux, sy - hw * uy, rope); R.line(cx + 1, top, sx + hw * ux, sy + hw * uy, rope); R.line(sx - (hw + 1) * ux, sy - (hw + 1) * uy, sx + (hw + 1) * ux, sy + (hw + 1) * uy, pole2); R.line(sx - (hw + 1) * ux, sy - (hw + 1) * uy + 1, sx + (hw + 1) * ux, sy + (hw + 1) * uy + 1, pole2);
    if (rider) { const k = rs, bx = sx, by = sy - 1, ax = -Math.sin(th), ay = -Math.cos(th);   // standing on the plank, leaning with the swing (axis along the rope)
      const P2 = (d, side = 0) => [bx + ax * d * k + ux * side * k, by + ay * d * k + uy * side * k];
      for (const sd of [-1.2, 1.2]) R.line(...P2(0, sd), ...P2(5, sd * 0.6), hair);
      R.poly([P2(4.5, -1.8), P2(4.5, 1.8), P2(11, 1.6), P2(11, -1.6)], col);
      for (const sd of [-1, 1]) R.line(...P2(10, sd * 2), ...P2(15, sd * (hw / k - 0.5)), skin);
      const [hx, hy] = P2(13); R.disc(hx, hy, 1.7 * k, skin); const [hx2, hy2] = P2(13.8, -0.5); R.disc(hx2, hy2, 1.3 * k, hair); }
    return [sx, sy]; };
  // kalash for Ghatasthapana: copper pot, mango leaves, coconut/lamp, sindoor marks
  K.kalash = (R, cx, base, s = 1) => { R.ellipse(cx, base - 7 * s, 7 * s, 7 * s, hex('#b5602a')); R.ellipse(cx - 2 * s, base - 9 * s, 3 * s, 3 * s, hex('#d98a4a')); R.rect(cx - 3 * s, base - 16 * s, 6 * s, 4 * s, hex('#9a4a1c'));
    R.rect(cx - 5 * s, base - 1 * s, 10 * s, 1 * s, hex('#7a3510')); for (let k = -2; k <= 2; k++) R.poly([[cx + k * 2 * s, base - 16 * s], [cx + k * 3.4 * s, base - 21 * s], [cx + k * 2.5 * s + 1, base - 16 * s]], k % 2 ? P.leaf : P.leafD);
    R.ellipse(cx, base - 19 * s, 3 * s, 3.5 * s, hex('#7a4a22')); R.disc(cx, base - 8 * s, 1.5 * s, P.sindoor); R.hline(cx - 5 * s, cx + 5 * s, base - 12 * s, P.gold); };
  // tika thali: brass plate with a heap of red tika rice, jamara, a diyo and flowers
  K.thali = (R, cx, cy, s = 1, t = 0, o = {}) => { R.ellipse(cx, cy + 1, 22 * s, 7 * s, P.goldD); R.ellipse(cx, cy, 22 * s, 6.5 * s, P.gold); R.ellipse(cx, cy, 18 * s, 4.8 * s, P.goldL); R.ellipse(cx, cy, 16.5 * s, 4 * s, P.gold);
    R.ellipse(cx - 6 * s, cy - 2 * s, 6 * s, 3.4 * s, P.sindoorD); R.ellipse(cx - 6 * s, cy - 2.6 * s, 5 * s, 2.6 * s, P.sindoor); for (let k = 0; k < 18; k++) R.px(cx - 6 * s + (hash(k, 3) - .5) * 9 * s, cy - 2.6 * s + (hash(k, 4) - .5) * 4 * s, P.sindoorL);
    K.jamara(R, cx + 7 * s, cy - 1 * s, 13 * s, 16, 5, t, { spread: 3 * s }); K.marigold(R, cx + 13 * s, cy + 1, 2, 1); K.marigold(R, cx - 14 * s, cy + 1, 2, 2); if (o.diyo !== false) K.diyo(R, cx + 1 * s, cy + 2 * s, 0.8, t, 7); };
  // corner frame of marigolds (top-left / top-right hanging toran)
  K.toran = (R, y, t = 0, o = {}) => { const { n = 5, sag = 6, r = 2 } = o; const w = R.w / n; for (let i = 0; i < n; i++) K.garland(R, i * w, y, (i + 1) * w, y, sag, r, t + i); for (let i = 0; i <= n; i++) { const x = i * w; for (let k = 1; k < 5; k++) K.marigold(R, x, y + k * r * 1.9, r, k); } };
  // rangoli mandala: concentric petals in rainbow, k = reveal 0..1
  K.rangoli = (R, cx, cy, rad, k = 1, t = 0, o = {}) => { const cols = o.cols || [P.makh, P.mari, P.gold, P.teal, P.violet, P.sindoor, P.lime]; for (let j = Math.floor(cy - rad); j <= cy + rad; j++) for (let i = Math.floor(cx - rad); i <= cx + rad; i++) { const dx = i - cx, dy = j - cy, d = Math.hypot(dx, dy); if (d > rad * k) continue;
      const a = Math.atan2(dy, dx), ring = Math.floor(d / rad * 7), petals = 6 + ring * 2, pv = Math.abs(Math.cos(a * petals / 2 + ring * 0.6 + (o.spin ? t * 0.3 * (ring % 2 ? 1 : -1) : 0))), edge = (d / rad * 7) % 1;
      if (pv > 0.35 + edge * 0.5) R.px(i, j, cols[ring % cols.length]); else if (edge < 0.18) R.px(i, j, P.white); } };

  // ---------- full-res helpers
  function cover(ctx, img, W, H) { const s = Math.max(W / img.width, H / img.height); ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s); }
  async function fonts(list) { for (const f of list) await document.fonts.load(f.spec, f.sample || 'Aaशुभ'); }
  // CSS colour + alpha helper
  const rgba = (h, a) => { const n = parseInt(h.replace('#', ''), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  return { clamp, mix, prog, E, bez, rng, hash, noise1, fbm, hex, rgbOf, pack, lerpC, css, rgba, bayer, Raster, P, K, cover, fonts };
})();
if (typeof module !== 'undefined') module.exports = PX;
