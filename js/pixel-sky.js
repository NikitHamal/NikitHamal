/*!
 * pixel-sky.js — a living, hand-tuned 2D pixel-art sky for nikit.is-a.dev. No images, no deps.
 *
 *  - The sky:   a dithered sky band, procedurally shaded cumulus in three parallax depths, a sun with stepped
 *               rays and a moon showing tonight's real phase, twinkling stars, shooting stars, birds, a hot-air
 *               balloon, fireflies. Everything lives in page space and scrolls with the page at its own depth
 *               (nothing is pinned to the screen).
 *  - Weather:   fair / clear / wind / rain / storm / snow, cross-faded; rain splashes, branching lightning,
 *               wind streaks with curls, tumbling sakura petals, drifting snow. A pixel weather button sits next to
 *               the theme toggle.
 *  - Play:      click a cloud and it rains, click the sun for a flare, the moon to turn its phase, empty sky for
 *               a shooting star / a flock of birds / a bolt of lightning / a gust. Moving the mouse through the sky
 *               pushes clouds, rain and petals around.
 *  - Day/night: switching the theme sets the sun and raises the moon through a dusk sky (and back at dawn).
 *  - Also:      the pixel sun/moon theme icon, the pixel section icons, a Himalayan <pixel-horizon> with a stupa and
 *               prayer flags above the footer, and little pixel sparkles when you press things.
 *
 * Calm under prefers-reduced-motion (a still sky), paused in background tabs. <script data-mode="calm"> (essay
 * pages) keeps the sky quieter behind long-form text.
 */
(() => {
'use strict';
if (window.PixelSky) return;
const D = document, R = D.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const me = D.currentScript, calm = !!(me && me.dataset.mode === 'calm');
const S = 3;   // one art pixel = 3 css px

/* ---------------- tiny helpers ---------------- */
let seed = 0x2f6b9d1;
const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const ra = (a, b) => a + rnd() * (b - a), ri = (a, b) => Math.floor(ra(a, b + 1)), pick = a => a[Math.floor(rnd() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const hex = c => '#' + (c >>> 0).toString(16).padStart(6, '0');
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
// 8x8 ordered dither for long, smooth gradients (sky bands, mountain mist)
const B8 = (() => { const m = [0]; let n = 1; let a = [[0]]; while (n < 8) { const b = []; for (let y = 0; y < n * 2; y++) { b.push([]); for (let x = 0; x < n * 2; x++) b[y].push(4 * a[y % n][x % n] + [[0, 2], [3, 1]][y / n | 0][x / n | 0]); } a = b; n *= 2; } return a.flat().map(v => (v + .5) / 64); })();
const bay8 = (x, y) => B8[(y & 7) * 8 + (x & 7)];
const cv = (w, h) => { const c = D.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
const isDark = () => R.getAttribute('data-theme') === 'dark';

/* string art -> canvas / svg. pal maps a char to a css colour ('currentColor' allowed in svg) */
function art(rows, pal) {
  const c = cv(rows[0].length, rows.length), g = c.getContext('2d');
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const p = pal[r[x]]; if (p) { g.fillStyle = p; g.fillRect(x, y, 1, 1); } } });
  return c;
}
function svgRects(rows, pal, ox = 0, oy = 0) {
  let s = '';
  rows.forEach((r, y) => { let x = 0; while (x < r.length) { const ch = r[x]; let e = x + 1; while (e < r.length && r[e] === ch) e++; if (pal[ch]) s += `<rect x="${x + ox}" y="${y + oy}" width="${e - x}" height="1" fill="${pal[ch]}"/>`; x = e; } });
  return s;
}
function grid(n, fn) { const rows = []; for (let y = 0; y < n; y++) { let r = ''; for (let x = 0; x < n; x++) r += fn(x, y) || '.'; rows.push(r); } return rows; }

/* ================================================================== */
/*  ART                                                               */
/* ================================================================== */

/* sky bands: colour stops top -> bottom; the lower part dithers away to transparent */
const BANDS = {
  day:   [0xa9d0f0, 0xbad9f3, 0xcbe3f6, 0xdbebf7, 0xe8f1f6],
  dusk:  [0x2e2b5e, 0x5d3b72, 0xa5506f, 0xe17d5b, 0xf7bd6e],
  night: [0x0a0f2a, 0x0f1638, 0x141c43, 0x182046, 0x161b38],
  storm: [0x8f99aa, 0xa0a9b8, 0xb2bac6, 0xc4cad4, 0xd2d7de],
  stormN:[0x0d1120, 0x121727, 0x161b2d, 0x191e31, 0x171b2c]
};
function makeBand(cols, w, h) {
  const c = cv(w, h), g = c.getContext('2d'), im = g.createImageData(w, h), d = new Uint32Array(im.data.buffer);
  const px = cols.map(v => (0xff000000 | ((v & 255) << 16) | (v & 0xff00) | ((v >> 16) & 255)) >>> 0);
  for (let y = 0; y < h; y++) {
    const t = y / h, ct = clamp(t / 0.7, 0, 1) * (cols.length - 1), i = Math.min(cols.length - 2, Math.floor(ct)), f = ct - i;
    const a = t < 0.42 ? 1 : 1 - (t - 0.42) / 0.58;
    for (let x = 0; x < w; x++) { if (bay8(x + 3, y + 5) >= a * a) continue; d[y * w + x] = bay8(x, y) < f ? px[i + 1] : px[i]; }
  }
  g.putImageData(im, 0, 0); return c;
}

/* cumulus: puffs on a flat base, lit from the top-left, dithered between five tones */
const CLOUD_PAL = {
  day:    [0xffffff, 0xf3f7fb, 0xe1eaf3, 0xc9d6e4, 0xb0c0d3],
  night:  [0x7180a6, 0x4f5b7f, 0x3c4769, 0x2e3755, 0x232b44],
  storm:  [0xb4bbc6, 0x99a1ae, 0x7e8796, 0x666e7e, 0x4f5767],
  stormN: [0x4b5269, 0x3b4156, 0x303547, 0x262b3a, 0x1d212d]
};
function cloudSprites(w, h) {
  const base = h - 2, n = Math.max(2, Math.round(w / 11)), circ = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? .5 : i / (n - 1), mid = 1 - Math.abs(u - .5) * 1.3;
    const r = ra(.34, .5) * h * (0.6 + 0.4 * mid);
    circ.push([lerp(w * .2, w * .8, u) + ra(-2, 2), Math.max(r + 1, base - r * ra(.7, 1.15) - mid * h * .12), r]);
  }
  const ex = w / 2, ey = base - h * .16, erx = w / 2 - 1.5, ery = h * .26;
  const inside = (x, y) => {
    if (y > base || x < 0 || y < 0 || x >= w) return false;
    const px = x + .5, py = y + .5;
    if (((px - ex) / erx) ** 2 + ((py - ey) / ery) ** 2 <= 1) return true;
    for (const [cx, cy, r] of circ) if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r) return true;
    return false;
  };
  const idx = new Uint8Array(w * h);
  let top = h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y)) top = Math.min(top, y);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x, y)) continue;
    let up = 0; while (up < 6 && inside(x, y - up - 1)) up++;
    let v = clamp((y - top) / (base - top + 1), 0, 1) * .78;
    if (up <= 1) v -= .42; else if (up <= 2) v -= .2;
    if (!inside(x + 1, y) || !inside(x + 2, y - 1)) v += .14;
    if (!inside(x - 1, y)) v -= .08;
    const q = v + (bay(x, y) - .5) * .2;
    let k = q < .12 ? 1 : q < .4 ? 2 : q < .63 ? 3 : 4;
    if (!inside(x, y + 1) && y > top + (base - top) * .45) k = 5;
    idx[y * w + x] = k;
  }
  const out = {};
  for (const name in CLOUD_PAL) {
    const c = cv(w, h), g = c.getContext('2d'), im = g.createImageData(w, h), d = new Uint32Array(im.data.buffer), P = CLOUD_PAL[name];
    for (let i = 0; i < idx.length; i++) if (idx[i]) { const v = P[idx[i] - 1]; d[i] = (0xff000000 | ((v & 255) << 16) | (v & 0xff00) | ((v >> 16) & 255)) >>> 0; }
    g.putImageData(im, 0, 0); out[name] = c;
  }
  out.mask = idx; out.w = w; out.h = h; return out;
}

/* sun disk (noon / sunset) with a dithered halo */
function sunSprite(Rr, pal) {
  const pad = 8, sz = (Rr + pad) * 2, c = cv(sz, sz), g = c.getContext('2d'), m = sz / 2;
  for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) {
    const dx = x + .5 - m, dy = y + .5 - m, d = Math.hypot(dx, dy);
    if (d <= Rr) {
      const l = (-dx * .6 - dy * .8) / Rr, v = d / Rr; let col;
      if (v > .86) col = pal[3]; else { const q = l * .45 + (1 - v) * .55 + (bay(x, y) - .5) * .25; col = q > .62 ? pal[0] : q > .32 ? pal[1] : pal[2]; }
      if (Math.hypot(dx + Rr * .38, dy + Rr * .38) < Rr * .18) col = pal[4];
      g.fillStyle = hex(col); g.fillRect(x, y, 1, 1);
    } else if (d <= Rr + pad - 1) {
      const a = 1 - (d - Rr) / (pad - 1);
      if (bay(x, y) < a * .55) { g.fillStyle = hex(pal[5]); g.globalAlpha = .35 + a * .3; g.fillRect(x, y, 1, 1); g.globalAlpha = 1; }
    }
  }
  return c;
}
const SUN_NOON = [0xfff6c4, 0xffd85c, 0xffb93d, 0xf59a2c, 0xffffff, 0xffe08a];
const SUN_SET  = [0xffd9a0, 0xff9a4a, 0xf2703a, 0xd9502e, 0xffe6c0, 0xff9f6a];

/* moon: lit fraction from the real synodic phase p (0 new .. .5 full .. 1), craters, earthshine, cool halo */
function moonSprite(Rr, p) {
  const pad = 7, sz = (Rr + pad) * 2, c = cv(sz, sz), g = c.getContext('2d'), m = sz / 2, k = Math.cos(2 * Math.PI * p);
  const craters = [[-.35, -.25, .22], [.3, .25, .16], [.05, -.5, .12], [-.1, .45, .14], [.45, -.2, .1]];
  for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) {
    const dx = x + .5 - m, dy = y + .5 - m, d = Math.hypot(dx, dy);
    if (d <= Rr) {
      const nx = dx / Rr, ny = dy / Rr, xt = k * Math.sqrt(Math.max(0, 1 - ny * ny));
      const lit = p < .5 ? nx > xt : nx < -xt;
      let col;
      if (lit) {
        const cr = craters.some(([cx, cy, r]) => Math.hypot(nx - cx, ny - cy) < r);
        const v = d / Rr, q = (1 - v) * .5 + (-nx * .25 - ny * .25) + (bay(x, y) - .5) * .2;
        col = cr ? (q > .3 ? 0xd8d2b8 : 0xc4bd9f) : v > .9 ? 0xd9d3b9 : q > .3 ? 0xfffbea : 0xf0eacf;
        g.fillStyle = hex(col); g.fillRect(x, y, 1, 1);
      } else { g.fillStyle = 'rgba(120,135,180,.28)'; g.fillRect(x, y, 1, 1); }
    } else if (d <= Rr + pad - 1) {
      const a = 1 - (d - Rr) / (pad - 1);
      if (bay(x, y) < a * .5) { g.fillStyle = 'rgba(190,205,255,.32)'; g.fillRect(x, y, 1, 1); }
    }
  }
  return c;
}
function realMoonPhase() { const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14) / 864e5; let p = ((Date.now() / 864e5 - ref) / syn) % 1; if (p < 0) p += 1; return p; }

const BIRD = [
  [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0]],
  [[0, 1], [1, 1], [2, 2], [3, 1], [4, 1]],
  [[0, 2], [1, 1], [2, 2], [3, 1], [4, 2]]
];
const BALLOON = art([
  '...aaaaa...',
  '..abbabbaa.',
  '.aabbabbaaa',
  '.aabbabbaaa',
  'aaabbabbaaa',
  '.aabbabbaa.',
  '..aabbbaa..',
  '...aabaa...',
  '....aaa....',
  '....c.c....',
  '....c.c....',
  '....ddd....',
  '....ddd....'
], { a: '#e3606d', b: '#f7d36a', c: '#6b5b4a', d: '#9a6a44' });

/* ================================================================== */
/*  THE SKY                                                           */
/* ================================================================== */
const WX = {
  fair:  { label: 'Fair',  cover: .62, wind: 3.5, rain: 0,   snow: 0, storm: 0,   petals: .45, streaks: .12, birds: 1 },
  clear: { label: 'Clear', cover: .2,  wind: 2.5, rain: 0,   snow: 0, storm: 0,   petals: .2,  streaks: 0,   birds: 1 },
  wind:  { label: 'Windy', cover: .7,  wind: 20,  rain: 0,   snow: 0, storm: .1,  petals: 2.4, streaks: 1.4, birds: .4 },
  rain:  { label: 'Rain',  cover: .96, wind: 5,   rain: 1,   snow: 0, storm: .5,  petals: 0,   streaks: 0,   birds: 0 },
  storm: { label: 'Storm', cover: 1,   wind: 11,  rain: 1.9, snow: 0, storm: 1,   petals: 0,   streaks: .35, birds: 0, bolts: 1 },
  snow:  { label: 'Snow',  cover: .92, wind: 2.5, rain: 0,   snow: 1, storm: .3,  petals: 0,   streaks: 0,   birds: 0 }
};
const ORDER = ['fair', 'clear', 'wind', 'rain', 'storm', 'snow'];
let weather = 'fair';
try { const w = localStorage.getItem('sky-weather'); if (WX[w]) weather = w; } catch (e) {}
const P = Object.assign({}, WX[weather]); P.bolts = WX[weather].bolts || 0;

const sky = { c: null, g: null, fx: null, fg: null, W: 0, H: 0, docH: 0 };
let bands = {}, clouds = [], stars = [], drops = [], flakes = [], petals = [], streaks = [], sparks = [], birds = [], bolts = [], shoots = [], flies = [], balloon = null;
let sunSpr = {}, moonSpr = null, moonP = realMoonPhase(), sunR = 11, moonR = 10;
let night = isDark() ? 1 : 0, nFrom = night, nTo = night, nT0 = 0;
let flash = 0, flare = 0, ptr = { x: -999, y: -999, vx: 0, vy: 0, lx: 0, ly: 0, t: 0 }, lastScroll = scrollY, t = 0;
let rainbow = null, rainbowSpr = null, wasWet = WX[weather].rain > 0;
let nextBird = 6, nextBolt = 3, nextShoot = 5, nextBalloon = 25;

const LAYERS = [
  { d: .16, w: [22, 40], a: .6,  sp: .35, dens: 1.3 },
  { d: .3,  w: [32, 58], a: .85, sp: .6,  dens: 1 },
  { d: .52, w: [46, 84], a: 1,   sp: 1,   dens: .6 }
];

function measure() {
  const W = Math.ceil(innerWidth / S), H = Math.ceil(innerHeight / S);
  const docH = Math.max(R.scrollHeight, innerHeight * 2);
  const changed = W !== sky.W || H !== sky.H;
  sky.W = W; sky.H = H;
  if (changed) {
    sky.c.width = W; sky.c.height = H; sky.fx.width = W; sky.fx.height = H;
    sky.g.imageSmoothingEnabled = false; sky.fg.imageSmoothingEnabled = false;
    const bh = Math.round(H * 1.35);
    for (const k in BANDS) bands[k] = makeBand(BANDS[k], W, bh);
    sunR = W < 200 ? 8 : 11; moonR = W < 200 ? 7 : 10;
    sunSpr = { noon: sunSprite(sunR, SUN_NOON), set: sunSprite(sunR, SUN_SET) }; moonSpr = moonSprite(moonR, moonP); rainbowSpr = null;
  }
  if (changed || Math.abs(docH - sky.docH) > 400) { sky.docH = docH; populate(); }
}

function populate() {
  const { W, H } = sky, docU = sky.docH / S;
  seed = 0x51ed27;
  clouds = [];
  for (const L of LAYERS) {
    const span = docU * L.d + H + 40, n = Math.ceil(span * Math.max(W, 220) / 21000 * L.dens * (calm ? .7 : 1));
    for (let i = 0; i < n; i++) {
      const w = ri(L.w[0], L.w[1]) * (W < 200 ? .75 : 1) | 0, h = Math.round(w * ra(.48, .62));
      clouds.push({ L, spr: cloudSprites(w, h), x: ra(-w, W + w), y: ra(-10, span), vx: 0, thr: rnd(), vis: 0, rain: 0, bob: rnd() * 6 });
    }
  }
  clouds.sort((a, b) => a.L.d - b.L.d);
  stars = [];
  const sspan = docU * .22 + H, ns = Math.ceil(sspan * W / 1100);
  for (let i = 0; i < ns; i++) {
    const r = rnd(); stars.push({ x: ri(0, W), y: ri(0, sspan | 0), k: r < .7 ? 0 : r < .93 ? 1 : 2, ph: rnd() * 7, sp: ra(.6, 2.2), thr: ra(.3, .95), c: pick(['#ffffff', '#ffffff', '#d6e4ff', '#ffecc0']) });
  }
}

function sunPos() {
  const { W } = sky, base = W < 200 ? 50 : 40;
  return { x: Math.round(W - Math.max(W < 200 ? 22 : 44, W * .12)), y: base - scrollY / S * .38 };
}

function makeRainbow(W, H) {
  const c = cv(W, H), g = c.getContext('2d'), cx = W * .26, cy = H * 1.05, r0 = Math.max(W * .27, H * .58);
  const cols = ['#e8505f', '#f29544', '#f6d04d', '#6cc66a', '#4f9be6', '#8a6fdc'];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot(x + .5 - cx, y + .5 - cy), band = Math.floor((r0 - d) / 2);
    if (band < 0 || band >= cols.length) continue;
    const fadeH = clamp((cy - y) / (H * .55), 0, 1);           // melts into the horizon
    if (bay8(x, y) >= fadeH) continue;
    g.fillStyle = cols[band]; g.fillRect(x, y, 1, 1);
  }
  return c;
}

/* ---------- spawning ---------- */
function spawnDrop(x, y, d, fromCloud) {
  drops.push({ x, y, d, vy: ra(170, 230) * (.6 + d * .6), len: d > .45 ? ri(6, 9) : ri(3, 5), stop: fromCloud ? y + ra(30, 110) : ra(sky.H * .35, sky.H + 4) });
}
function splash(x, y, col) { for (let i = 0; i < 3; i++) sparks.push({ x, y, vx: ra(-25, 25), vy: ra(-45, -15), g: 160, life: ra(.15, .3), age: 0, c: col, s: 1 }); }
function burst(x, y, cols, n = 14, sp = 60) {
  for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, v = ra(sp * .3, sp); sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 30, life: ra(.4, .9), age: 0, c: pick(cols), s: rnd() < .3 ? 2 : 1 }); }
}
function flock(x, y, dir) {
  const n = ri(3, 6), sp = ra(26, 38) * dir;
  for (let i = 0; i < n; i++) birds.push({ x: x - dir * i * ra(5, 8), y: y + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * ra(3, 5), vx: sp, ph: rnd() * 3, d: .4, wob: rnd() * 6 });
}
function bolt(x0, y0, x1, y1) {
  const segs = []; let x = x0, y = y0;
  while (y < y1) { const nx = x + ra(-2.5, 2.5) + (x1 - x) * .08, ny = y + ra(2, 4); segs.push([x, y, nx, ny, 1]); if (rnd() < .14) { let bx = nx, by = ny; const dir = rnd() < .5 ? -1 : 1; for (let j = 0; j < ri(2, 5); j++) { const ex = bx + dir * ra(1, 3), ey = by + ra(2, 3); segs.push([bx, by, ex, ey, 0]); bx = ex; by = ey; } } x = nx; y = ny; }
  bolts.push({ segs, age: 0, life: .45 }); flash = Math.max(flash, .55);
}
function shootingStar(x, y) { const dir = x > sky.W / 2 ? -1 : 1; shoots.push({ x, y, vx: dir * ra(110, 160), vy: ra(40, 70), age: 0, life: ra(.7, 1.1) }); }

/* ---------- frame ---------- */
function line(g, x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (let i = 0; i < 200; i++) { g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}

function frame(dt) {
  const { W, H, g, fg } = sky; t += dt;
  // day <-> night
  if (nFrom !== nTo) { const k = clamp((performance.now() - nT0) / 1900, 0, 1); night = lerp(nFrom, nTo, ease(k)); if (k >= 1) { night = nTo; nFrom = nTo; } }
  const n = night, dusk = Math.max(0, 1 - Math.abs(n * 2 - 1));
  // weather params ease toward target
  const tw = WX[weather], f = 1 - Math.exp(-dt / 1.4);
  for (const k of ['cover', 'wind', 'rain', 'snow', 'storm', 'petals', 'streaks', 'birds']) P[k] += (tw[k] - P[k]) * f;
  P.bolts = tw.bolts || 0;
  const st = P.storm, wind = P.wind, scroll = scrollY / S, dScroll = (scrollY - lastScroll) / S; lastScroll = scrollY;
  // pointer velocity (art px / s), decays when still
  ptr.vx *= Math.exp(-dt * 6); ptr.vy *= Math.exp(-dt * 6);

  g.clearRect(0, 0, W, H);
  /* --- sky band --- */
  const by = Math.round(-scroll * .55);
  if (by > -bands.day.height) {
    const dayA = (1 - n) * (1 - dusk * .6), nightA = n * (1 - dusk * .4);
    const layer = (b, a) => { if (a > .01) { g.globalAlpha = a; g.drawImage(b, 0, by); } };
    layer(bands.day, dayA * (1 - st * .7)); layer(bands.storm, dayA * st * .7);
    layer(bands.night, nightA * (1 - st * .6)); layer(bands.stormN, nightA * st * .6);
    layer(bands.dusk, dusk * .95);
    g.globalAlpha = 1;
  }
  /* --- shooting stars --- */
  for (let i = shoots.length - 1; i >= 0; i--) {
    const s = shoots[i]; s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt - dScroll * .3; if (s.age > s.life) { shoots.splice(i, 1); continue; }
    const a = Math.sin(Math.PI * s.age / s.life), L = 14, ux = s.vx / Math.hypot(s.vx, s.vy), uy = s.vy / Math.hypot(s.vx, s.vy);
    for (let j = 0; j < L; j++) { g.globalAlpha = a * (1 - j / L); g.fillStyle = j < 2 ? '#ffffff' : '#bcd0ff'; g.fillRect(Math.round(s.x - ux * j), Math.round(s.y - uy * j), 1, 1); }
    g.globalAlpha = 1;
  }
  /* --- sun & moon --- */
  const sp = sunPos();
  if (n < .999) {
    const drop = ease(n) * (H * .8 + 40), x = Math.round(sp.x + n * 10), y = Math.round(sp.y + drop), fl = flare;
    const sa = (1 - st * .7) * (calm ? .85 : 1);
    if (y - sunR < H + 10) {
      g.globalAlpha = sa; const sw = sunSpr.noon.width / 2;
      g.drawImage(sunSpr.noon, x - sw, y - sw);
      if (n > .02) { g.globalAlpha = sa * clamp(n * 2.2, 0, 1); g.drawImage(sunSpr.set, x - sw, y - sw); }
      // stepped rotating rays
      const rot = reduce ? 0 : Math.floor(t * 2) * (Math.PI / 24), nr = 12;
      g.fillStyle = n > .4 ? '#ff9a4a' : '#ffc23d';
      for (let k = 0; k < nr; k++) {
        const a = rot + k * Math.PI * 2 / nr, long = k % 2 === 0, pulse = reduce ? 0 : Math.round((Math.sin(t * 3 + k) + 1) * .6);
        const len = (long ? 4 : 2) + pulse + Math.round(fl * 6);
        for (let r = sunR + 3; r < sunR + 3 + len; r++) { g.globalAlpha = sa * (1 - (r - sunR - 3) / (len + 2)) ; g.fillRect(Math.round(x + Math.cos(a) * r - .5), Math.round(y + Math.sin(a) * r - .5), 1, 1); }
      }
      g.globalAlpha = 1;
    }
  }
  if (n > .001) {
    const rise = ease(1 - n) * (H * .8 + 40), x = Math.round(sp.x - (1 - n) * 10), y = Math.round(sp.y + rise), mw = moonSpr.width / 2;
    if (y - moonR < H + 10) { g.globalAlpha = 1 - st * .55; g.drawImage(moonSpr, x - mw, y - mw); g.globalAlpha = 1; }
  }
  flare = Math.max(0, flare - dt * .9);
  // a rainbow arcs over the sky when the rain stops in the daytime
  if (rainbow) {
    rainbow.age += dt; const k = rainbow.age / rainbow.life;
    if (k >= 1 || n > .6) rainbow = null;
    else { if (!rainbowSpr) rainbowSpr = makeRainbow(W, H); g.globalAlpha = Math.min(1, k * 5, (1 - k) * 3) * (1 - n) * .4; g.drawImage(rainbowSpr, 0, Math.round(-scroll * .3 + H * .1)); g.globalAlpha = 1; }
  }

  /* ====== fx layer: clouds & weather (faded under the text column) ====== */
  fg.clearRect(0, 0, W, H);
  /* --- stars --- */
  if (n > .3) {
    const so = scroll * .22, cov = 1 - st * .75;
    for (const s of stars) {
      const y = Math.round(s.y - so); if (y < -3 || y > H + 3) continue;
      const a = clamp((n - s.thr) * 6, 0, 1) * cov; if (a <= 0) continue;
      const tw2 = reduce ? 1 : .55 + .45 * Math.sin(t * s.sp + s.ph);
      fg.globalAlpha = a * (s.k ? tw2 : .5 + tw2 * .3); fg.fillStyle = s.c; fg.fillRect(s.x, y, 1, 1);
      if (s.k === 2 && tw2 > .55) { fg.globalAlpha = a * (tw2 - .4); fg.fillRect(s.x - 1, y, 3, 1); fg.fillRect(s.x, y - 1, 1, 3); if (tw2 > .9) { fg.globalAlpha = a * .5; fg.fillRect(s.x - 2, y, 5, 1); fg.fillRect(s.x, y - 2, 1, 5); } }
    }
    fg.globalAlpha = 1;
  }
  const cover = P.cover;
  const wDay = (1 - n) * (1 - st), wDayS = (1 - n) * st, wN = n * (1 - st), wNS = n * st;
  const birdsAfterClouds = [];
  for (const c of clouds) {
    const L = c.L, sw = c.spr.w, sh = c.spr.h;
    c.vx *= Math.exp(-dt * .7);
    if (!reduce) c.x += (wind * L.sp * (1 + st * .3) + c.vx) * dt;
    const span = W + sw * 2 + 40; if (c.x > W + sw + 20) c.x -= span; if (c.x < -sw - 20) c.x += span;
    const tv = clamp((cover - c.thr) * 5, 0, 1); c.vis += (tv - c.vis) * f;
    const y = Math.round(c.y - scroll * L.d + (reduce ? 0 : Math.sin(t * .4 + c.bob) * .6)), x = Math.round(c.x - sw / 2);
    c.sx = x; c.sy = y;
    if (y > H + 4 || y + sh < -4) continue;
    // the pointer pushes clouds it passes through
    if (L.d > .2 && ptr.x > x - 4 && ptr.x < x + sw + 4 && ptr.y > y - 4 && ptr.y < y + sh + 4) c.vx = clamp(c.vx + ptr.vx * .05 * L.sp, -40, 40);
    const a = c.vis * L.a * (c.rain > 0 ? 1 : 1); if (a < .02) continue;
    const draw = (spr, w) => { if (w > .01) { fg.globalAlpha = a * w; fg.drawImage(spr, x, y); } };
    const dark = c.rain > 0 ? Math.min(1, c.rain) * .8 : 0;
    draw(c.spr.day, wDay * (1 - dark)); draw(c.spr.storm, wDayS + wDay * dark); draw(c.spr.night, wN * (1 - dark)); draw(c.spr.stormN, wNS + wN * dark);
    if (c.rain > 0) { c.rain -= dt; if (!reduce && rnd() < dt * 40 * (sw / 40)) spawnDrop(x + ra(3, sw - 3), y + sh - 2, L.d + .2, true); }
  }
  fg.globalAlpha = 1;
  // at dusk and dawn the clouds catch the low sun
  if (dusk > .02) { fg.globalCompositeOperation = 'source-atop'; fg.globalAlpha = dusk * .5; fg.fillStyle = '#ff8f6b'; fg.fillRect(0, 0, W, H); fg.globalAlpha = 1; fg.globalCompositeOperation = 'source-over'; }

  // birds (day)
  if (!reduce && (nextBird -= dt) < 0) { nextBird = ra(14, 30); if (n < .3 && P.birds > .5 && !calm) { const dir = rnd() < .5 ? 1 : -1; flock(dir > 0 ? -10 : W + 10, ra(H * .12, H * .5), dir); } }
  fg.fillStyle = n > .5 ? '#9aa6c8' : '#454b5a';
  for (let i = birds.length - 1; i >= 0; i--) {
    const b = birds[i];
    if (!b.scared && Math.abs(b.x - ptr.x) < 16 && Math.abs(b.y - ptr.y) < 12) { b.scared = 1; b.vy = ra(-55, -35); b.vx *= 1.7; b.ph += 10; }
    b.vy = (b.vy || 0) * Math.exp(-dt * 1.5);
    b.x += (b.vx + wind * .3) * dt; b.y += Math.sin(t * 2 + b.wob) * .08 + b.vy * dt - dScroll * b.d;
    if (b.x < -30 || b.x > W + 30 || b.y < -20) { birds.splice(i, 1); continue; }
    const fr = BIRD[Math.floor(t * (b.scared ? 16 : 8) + b.ph) % 3], bx = Math.round(b.x) - 2, byy = Math.round(b.y), flip = b.vx < 0;
    fg.globalAlpha = .85; for (const [px2, py2] of fr) fg.fillRect(bx + (flip ? 4 - px2 : px2), byy + py2, 1, 1);
  }
  fg.globalAlpha = 1;
  // hot-air balloon (day, rare)
  if (!reduce && !calm && (nextBalloon -= dt) < 0 && !balloon) { nextBalloon = ra(50, 90); if (n < .3 && P.rain < .2 && P.snow < .2) balloon = { x: -14, y: ra(H * .15, H * .45), ph: rnd() * 6 }; }
  if (balloon) { balloon.x += (4 + wind * .25) * dt; balloon.y -= dScroll * .3; if (balloon.x > W + 14) balloon = null; else { fg.globalAlpha = .9 * (1 - n); fg.drawImage(BALLOON, Math.round(balloon.x), Math.round(balloon.y + Math.sin(t * .8 + balloon.ph) * 2)); fg.globalAlpha = 1; } }

  // rain
  if (!reduce) {
    const rate = P.rain * W * (calm ? .22 : .38);
    for (let k = rate * dt + rnd(); k > 1; k--) spawnDrop(ra(-20, W + 20), ra(-12, -2), rnd() < .4 ? .7 : .35, false);
  }
  const rc = n > .5 ? '#8ea8d8' : '#6f97c4', slant = wind * 1.6;
  fg.fillStyle = rc;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i]; d.y += d.vy * dt - dScroll * d.d; d.x += slant * dt + ptr.near(d.x, d.y) * dt;
    if (d.y >= d.stop) { if (d.y < H && d.d > .45 && rnd() < .6) splash(d.x, d.y, rc); drops.splice(i, 1); continue; }
    fg.globalAlpha = d.d > .45 ? .85 : .5; const kx = slant / d.vy;
    for (let j = 0; j < d.len; j++) fg.fillRect(Math.round(d.x - kx * j), Math.round(d.y - j), 1, 1);
  }
  fg.globalAlpha = 1;
  // snow
  if (!reduce) for (let k = P.snow * W * .5 * dt + rnd(); k > 1; k--) flakes.push({ x: ra(-10, W + 10), y: -3, vy: ra(7, 16), ph: rnd() * 7, s: rnd() < .25 ? 2 : 1, d: ra(.2, .7) });
  const sc = n > .5 ? '#f2f6ff' : '#b9cde4';
  for (let i = flakes.length - 1; i >= 0; i--) {
    const s = flakes[i]; s.y += s.vy * dt * (.6 + s.d) - dScroll * s.d; s.x += (Math.sin(t * 1.3 + s.ph) * 4 + wind * .6) * dt + ptr.near(s.x, s.y) * dt * 1.5;
    if (s.y > H + 3 || s.y < -10) { flakes.splice(i, 1); continue; }
    fg.globalAlpha = .55 + s.d * .5; fg.fillStyle = sc; const x = Math.round(s.x), y = Math.round(s.y);
    if (s.s === 2) { fg.fillRect(x - 1, y, 3, 1); fg.fillRect(x, y - 1, 1, 3); } else fg.fillRect(x, y, 1, 1);
  }
  fg.globalAlpha = 1;
  // petals & leaves
  if (!reduce) for (let k = P.petals * W * .02 * dt + rnd(); k > 1; k--) petals.push({ x: wind > 8 ? -6 : ra(0, W), y: wind > 8 ? ra(-10, H * .8) : -4, vy: ra(5, 11), vx: ra(-2, 4), ph: rnd() * 7, fr: ri(0, 3), c: rnd() < .8 ? ['#f6aec0', '#e47b98'] : ['#9cc58a', '#6f9e5e'], d: ra(.3, .8) });
  for (let i = petals.length - 1; i >= 0; i--) {
    const p = petals[i]; p.y += (p.vy + Math.sin(t * 2 + p.ph) * 3) * dt - dScroll * p.d; p.x += (p.vx + wind * (.8 + p.d * .6) + Math.cos(t * 1.7 + p.ph) * 4) * dt + ptr.near(p.x, p.y) * dt * 2;
    if (p.y > H + 4 || p.x > W + 8 || p.x < -10 || p.y < -14) { petals.splice(i, 1); continue; }
    const x = Math.round(p.x), y = Math.round(p.y), fr = (Math.floor(t * 5 + p.ph) + p.fr) % 4;
    fg.fillStyle = p.c[0]; fg.fillRect(x, y, 1, 1); fg.fillStyle = p.c[1];
    if (fr === 0) fg.fillRect(x + 1, y, 1, 1); else if (fr === 1) fg.fillRect(x + 1, y + 1, 1, 1); else if (fr === 2) fg.fillRect(x, y + 1, 1, 1); else { fg.fillStyle = p.c[0]; fg.fillRect(x - 1, y + 1, 1, 1); }
  }
  // wind streaks with curls
  if (!reduce) for (let k = P.streaks * dt * 1.6 + rnd() * .02; k > 1 || (rnd() < P.streaks * dt * 1.4); k--) { streaks.push({ x: ra(-20, W * .8), y: ra(4, H - 4), len: ri(14, 34), age: 0, life: ra(1, 1.8), curl: rnd() < .45, ph: rnd() * 6 }); if (k <= 1) break; }
  fg.fillStyle = n > .5 ? '#6c7ca3' : '#a7b8cb';
  for (let i = streaks.length - 1; i >= 0; i--) {
    const s = streaks[i]; s.age += dt; s.x += (wind * 2.2 + 10) * dt; s.y -= dScroll * .4; const p = s.age / s.life; if (p >= 1) { streaks.splice(i, 1); continue; }
    const head = s.len * Math.min(1, p * 2), tail = s.len * Math.max(0, p * 2 - 1);
    fg.globalAlpha = .6 * Math.sin(Math.PI * p);
    for (let j = Math.floor(tail); j < head; j++) fg.fillRect(Math.round(s.x + j), Math.round(s.y + Math.sin((s.x + j) * .12 + s.ph)), 1, 1);
    if (s.curl && p > .25 && p < .8) { const cx = Math.round(s.x + head), cy = Math.round(s.y + Math.sin((s.x + head) * .12 + s.ph)); for (const [a2, b2] of [[0, 0], [1, -1], [1, -2], [0, -3], [-1, -3], [-2, -2], [-2, -1], [-1, 0]]) fg.fillRect(cx + a2, cy + b2, 1, 1); }
  }
  fg.globalAlpha = 1;
  // lightning
  if (!reduce && P.bolts && (nextBolt -= dt) < 0) {
    nextBolt = ra(2.5, 7);
    const vis = clouds.filter(c => c.L.d > .25 && c.vis > .5 && c.sy > -10 && c.sy < H * .5);
    const c = vis.length ? pick(vis) : null, x0 = c ? c.sx + c.spr.w / 2 : ra(W * .1, W * .9), y0 = c ? c.sy + c.spr.h - 2 : 0;
    bolt(x0, y0, x0 + ra(-20, 20), ra(H * .5, H * .95));
  }
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i]; b.age += dt; if (b.age > b.life) { bolts.splice(i, 1); continue; }
    const fr = Math.floor(b.age / .05); if (fr === 3 || fr === 5) continue;
    fg.fillStyle = 'rgba(190,210,255,.45)'; for (const s of b.segs) if (s[4]) { line(fg, s[0] - 1, s[1], s[2] - 1, s[3]); line(fg, s[0] + 1, s[1], s[2] + 1, s[3]); }
    fg.fillStyle = '#fffbe6'; for (const s of b.segs) line(fg, s[0], s[1], s[2], s[3]);
  }
  // fireflies (night)
  if (n > .7 && P.rain < .3 && P.snow < .3 && !reduce) { while (flies.length < (calm ? 5 : 10)) flies.push({ x: ra(0, W), y: ra(H * .45, H), ph: rnd() * 7, sp: ra(.3, .8) }); } else if (flies.length) flies.length = 0;
  for (const fl2 of flies) {
    fl2.x += Math.cos(t * fl2.sp + fl2.ph) * 6 * dt + wind * .1 * dt; fl2.y += Math.sin(t * fl2.sp * 1.3 + fl2.ph * 2) * 4 * dt - dScroll * .5;
    if (fl2.x < -4) fl2.x = W + 3; if (fl2.x > W + 4) fl2.x = -3; if (fl2.y < -4) fl2.y = H + 3; if (fl2.y > H + 4) fl2.y = -3;
    const a = Math.max(0, Math.sin(t * 1.6 + fl2.ph)) * clamp((n - .7) * 4, 0, 1); if (a < .05) continue;
    const x = Math.round(fl2.x), y = Math.round(fl2.y);
    fg.globalAlpha = a * .35; fg.fillStyle = '#d9f27a'; fg.fillRect(x - 1, y, 3, 1); fg.fillRect(x, y - 1, 1, 3);
    fg.globalAlpha = a; fg.fillStyle = '#f4ffb0'; fg.fillRect(x, y, 1, 1);
  }
  fg.globalAlpha = 1;
  // sparks (splashes, flares, bursts)
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]; s.age += dt; if (s.age > s.life) { sparks.splice(i, 1); continue; }
    s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt - dScroll * .5;
    fg.globalAlpha = 1 - s.age / s.life; fg.fillStyle = s.c; const x = Math.round(s.x), y = Math.round(s.y);
    if (s.s === 2) { fg.fillRect(x - 1, y, 3, 1); fg.fillRect(x, y - 1, 1, 3); } else fg.fillRect(x, y, 1, 1);
  }
  fg.globalAlpha = 1;

  // fade the fx layer under the reading column so text always wins
  fg.globalCompositeOperation = 'destination-out';
  const colHalf = Math.min(W, 700 / S) / 2, cx = W / 2, k = calm ? .72 : .5;
  if (W * S > 860) {
    const gr = fg.createLinearGradient(cx - colHalf - 24, 0, cx + colHalf + 24, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.12, `rgba(0,0,0,${k})`); gr.addColorStop(.88, `rgba(0,0,0,${k})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    fg.fillStyle = gr; fg.fillRect(0, 0, W, H);
  } else { fg.fillStyle = `rgba(0,0,0,${k * .6})`; fg.fillRect(0, 0, W, H); }
  fg.globalCompositeOperation = 'source-over';
  g.drawImage(sky.fx, 0, 0);

  // lightning flash lights the whole sky
  if (flash > .01) { g.fillStyle = n > .5 ? `rgba(200,215,255,${flash * .35})` : `rgba(255,255,255,${flash * .55})`; g.fillRect(0, 0, W, H); flash *= Math.exp(-dt * 9); }

  // shooting stars now and then at night
  if (!reduce && n > .9 && P.cover < .9 && (nextShoot -= dt) < 0) { nextShoot = ra(6, 16); shootingStar(ra(W * .1, W * .9), ra(2, H * .35)); }
}
ptr.near = (x, y) => { const dx = x - ptr.x, dy = y - ptr.y, d2 = dx * dx + dy * dy; return d2 < 400 ? ptr.vx * (1 - d2 / 400) * .6 : 0; };

/* ---------- theme changes animate the sky ---------- */
function onTheme() {
  const to = isDark() ? 1 : 0; if (to === nTo) return;
  if (reduce) { night = nFrom = nTo = to; return; }
  nFrom = night; nTo = to; nT0 = performance.now();
  if (to === 1) setTimeout(() => { for (let i = 0; i < 2; i++) setTimeout(() => shootingStar(ra(sky.W * .2, sky.W * .8), ra(4, sky.H * .3)), i * 420); }, 1300);
  else setTimeout(() => { if (P.birds > .5) flock(-8, sky.H * .3, 1); }, 900);
}

/* ---------- clicks on open sky ---------- */
const NOT_SKY = 'a,button,input,textarea,select,label,summary,dialog,img,svg,video,iframe,p,h1,h2,h3,h4,h5,li,blockquote,figure,pre,code,article,table,.accordion-header,.accordion-inner,.project-card,.site-header,.top-bar,pixel-dog,pixel-scene,pixel-horizon,.pond-section,.reader-dock,.settings,[contenteditable],[role="button"],[role="dialog"]';
function onSkyClick(e) {
  if (e.button > 0 || e.defaultPrevented || !sky.c) return;
  if (e.target.closest && e.target.closest(NOT_SKY)) return;
  const sel = getSelection && getSelection(); if (sel && !sel.isCollapsed) return;
  const dog = D.querySelector('pixel-dog'); if (dog) { const r = dog.getBoundingClientRect(); if (e.clientY > r.top - 10 && e.clientY < r.bottom + 10) return; }
  const x = e.clientX / S, y = e.clientY / S, n = night;
  // sun / moon
  const sp = sunPos();
  if (Math.hypot(x - sp.x, y - sp.y) < (n < .5 ? sunR : moonR) + 5) {
    if (n < .5) { flare = 1; burst(sp.x, sp.y, ['#ffe27a', '#ffc23d', '#fff6c4', '#ff9a4a'], 22, 80); }
    else { moonP = (moonP + .125) % 1; moonSpr = moonSprite(moonR, moonP); burst(sp.x, sp.y, ['#ffffff', '#d6e4ff', '#fffbea'], 14, 50); }
    return;
  }
  // a cloud: rain from it (near layers first)
  for (let i = clouds.length - 1; i >= 0; i--) {
    const c = clouds[i]; if (c.vis < .4 || c.L.d < .2) continue;
    const lx = Math.floor(x - c.sx), ly = Math.floor(y - c.sy);
    if (lx >= 0 && ly >= 0 && lx < c.spr.w && ly < c.spr.h && c.spr.mask[ly * c.spr.w + lx]) { c.rain = 4.5; c.vx += ra(-6, 6); if (st() > .6) bolt(c.sx + c.spr.w / 2, c.sy + c.spr.h - 2, x + ra(-10, 10), Math.min(sky.H - 4, y + ra(40, 90))); return; }
  }
  // open sky
  if (P.rain > .5) bolt(x + ra(-12, 12), 0, x, y);
  else if (P.snow > .5) { for (let i = 0; i < 24; i++) flakes.push({ x: x + ra(-10, 10), y: y + ra(-6, 6), vy: ra(4, 12), ph: rnd() * 7, s: rnd() < .4 ? 2 : 1, d: ra(.3, .7) }); }
  else if (P.wind > 12) { for (let i = 0; i < 18; i++) petals.push({ x: x + ra(-6, 6), y: y + ra(-6, 6), vy: ra(-6, 6), vx: ra(10, 30), ph: rnd() * 7, fr: ri(0, 3), c: ['#f6aec0', '#e47b98'], d: .6 }); }
  else if (n > .5) { shootingStar(x, y); burst(x, y, ['#ffffff', '#d6e4ff'], 8, 30); }
  else flock(x, y, x < sky.W / 2 ? 1 : -1);
}
const st = () => P.storm;
function skyHot(e, x, y) {
  if (!e.target || !e.target.closest || e.target.closest(NOT_SKY)) return false;
  const sp = sunPos(); if (Math.hypot(x - sp.x, y - sp.y) < (night < .5 ? sunR : moonR) + 5) return true;
  for (let i = clouds.length - 1; i >= 0; i--) { const c = clouds[i]; if (c.vis < .4 || c.L.d < .2) continue; const lx = Math.floor(x - c.sx), ly = Math.floor(y - c.sy); if (lx >= 0 && ly >= 0 && lx < c.spr.w && ly < c.spr.h && c.spr.mask[ly * c.spr.w + lx]) return true; }
  return false;
}
let barColor = '';
function tintBar() {
  const m = D.querySelector('meta[name="theme-color"]'); if (!m) return;
  const top = scrollY < innerHeight * .5, dark = isDark();
  const want = top ? (dark ? '#0a0f2a' : '#a9d0f0') : getComputedStyle(D.body).backgroundColor;
  if (want !== barColor) { barColor = want; m.setAttribute('content', want); }
}

/* ---------- boot the sky ---------- */
function bootSky() {
  const c = D.createElement('canvas'); c.className = 'pixel-sky'; c.setAttribute('aria-hidden', 'true');
  D.body.prepend(c); sky.c = c; sky.g = c.getContext('2d'); sky.fx = cv(1, 1); sky.fg = sky.fx.getContext('2d');
  R.classList.add('has-sky');
  measure();
  addEventListener('resize', () => { clearTimeout(bootSky.rz); bootSky.rz = setTimeout(measure, 120); }, { passive: true });
  setInterval(() => { if (Math.abs(R.scrollHeight - sky.docH) > 400) measure(); }, 2500);
  new MutationObserver(onTheme).observe(R, { attributes: true, attributeFilter: ['data-theme'] });
  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return; const now = performance.now(), x = e.clientX / S, y = e.clientY / S, dt = Math.max(8, now - ptr.t) / 1000;
    if (now - ptr.t < 120) { ptr.vx = lerp(ptr.vx, clamp((x - ptr.x) / dt, -260, 260), .5); ptr.vy = lerp(ptr.vy, clamp((y - ptr.y) / dt, -260, 260), .5); }
    ptr.x = x; ptr.y = y; ptr.t = now;
    R.classList.toggle('sky-hot', skyHot(e, x, y));
  }, { passive: true });
  D.addEventListener('click', onSkyClick);
  addEventListener('scroll', tintBar, { passive: true }); new MutationObserver(() => setTimeout(tintBar, 60)).observe(R, { attributes: true, attributeFilter: ['data-theme'] }); tintBar();
  if (reduce) c.classList.add('on');
  let last = performance.now();
  const loop = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!D.hidden) { frame(reduce ? 0 : dt); if (!c.classList.contains('on')) c.classList.add('on'); }
    requestAnimationFrame(loop);
  };
  if (reduce) { frame(0); addEventListener('scroll', () => requestAnimationFrame(() => frame(0)), { passive: true }); new MutationObserver(() => frame(0)).observe(R, { attributes: true, attributeFilter: ['data-theme'] }); }
  else requestAnimationFrame(loop);
}

/* ================================================================== */
/*  WEATHER BUTTON + THEME ICON                                       */
/* ================================================================== */
const WP = { y: '#ffc23d', o: '#ff9a1f', h: '#fff1a8', w: '#ffffff', g: '#b9c7d8', d: '#5b6b82', b: '#4f8fe0', l: '#ffd23f', s: '#bcd8ff', n: '#8aa1bb' };
const CLOUD12 = ['....ddd.....', '...dwwwddd..', '.dddwwwwwwd.', 'dwwwwwwwwwwd', 'dwwwwwwwwggd', '.dggggggggd.', '..dddddddd..'];
const WICONS = {
  clear: { base: grid(12, (x, y) => { const d = Math.hypot(x + .5 - 6, y + .5 - 6); return d < 2.4 ? (x < 6 && y < 6 && d > 1 ? 'h' : 'y') : d < 3.3 ? 'o' : ''; }),
           anim: grid(12, (x, y) => { const d = Math.hypot(x + .5 - 6, y + .5 - 6), a = Math.atan2(y + .5 - 6, x + .5 - 6) / (Math.PI / 4); return d > 4.2 && d < 5.9 && Math.abs(a - Math.round(a)) < .2 ? 'y' : ''; }), cls: 'wx-spin' },
  fair:  { base: ['..y.........', 'y.oo.y......', '.oyyo.......', '.oyyoddd....', 'y.oodwwwd...', '...dwwwwwdd.', '.ddwwwwwwwwd', 'dwwwwwwwwwwd', 'dwwwwwwwwggd', '.dggggggggd.', '..dddddddd..', '............'], cls: 'wx-bob' },
  wind:  { base: ['............', '.nnnnnnn....', '........n...', '..nnnn..n...', '......nn....', 'nnnnnnnnnn..', '..........n.', '.nnnnnn...n.', '.......nnn..', '..nnnnnnn...', '............', '............'], cls: 'wx-blow' },
  rain:  { base: CLOUD12.concat(['', '', '', '', '']), anim: ['', '', '', '', '', '', '', '............', '..b...b...b.', '.b...b...b..', '............', '...b...b....'], cls: 'wx-fall' },
  storm: { base: CLOUD12.concat(['......ll....', '.....ll.....', '....llll....', '......l.....', '.....l......']), anim: ['', '', '', '', '', '', '', '.b.........b', 'b.........b.', '............', '', ''], cls: 'wx-flash' },
  snow:  { base: CLOUD12.concat(['', '', '', '', '']), anim: ['', '', '', '', '', '', '', '..s.....s...', '.sss...sss..', '..s..s..s...', '.....s......', '....sss.....'], cls: 'wx-fall' }
};
const pad12 = rows => rows.map(r => (r || '').padEnd(12, '.'));
function weatherSVG(k) {
  const ic = WICONS[k];
  return `<svg viewBox="0 0 12 12" aria-hidden="true" shape-rendering="crispEdges"><g class="wx-base">${svgRects(pad12(ic.base), WP)}</g>${ic.anim ? `<g class="wx-anim ${ic.cls}">${svgRects(pad12(ic.anim), WP)}</g>` : ''}</svg>`;
}
function themeSVG() {
  const sunDisk = grid(16, (x, y) => { const d = Math.hypot(x + .5 - 8, y + .5 - 8); return d < 2.9 ? (x < 8 && y < 8 && d > 1.4 ? 'h' : 'y') : d < 3.9 ? 'o' : ''; });
  const rays = grid(16, (x, y) => { const d = Math.hypot(x + .5 - 8, y + .5 - 8), a = Math.atan2(y + .5 - 8, x + .5 - 8) / (Math.PI / 4), on = Math.abs(a - Math.round(a)) < .17; const card = Math.round(a) % 2 === 0; return on && d > 5 && d < (card ? 7.6 : 6.6) ? 'y' : ''; });
  const moon = grid(16, (x, y) => { const px = x + .5, py = y + .5, d1 = Math.hypot(px - 7.5, py - 8.5), d2 = Math.hypot(px - 10.2, py - 6.4); if (d1 > 5.1 || d2 < 4.2) return ''; if ((x === 5 && y === 10) || (x === 6 && y === 7) || (x === 8 && y === 12)) return 'c'; return d1 > 4.2 || d2 < 5 ? 'm' : 'l'; });
  const star = (cx, cy) => grid(16, (x, y) => (x === cx && y === cy) ? 'w' : (Math.abs(x - cx) + Math.abs(y - cy) === 1) ? 's' : '');
  const pal = { y: '#ffc23d', o: '#f2931f', h: '#fff1a8', l: '#fbf3d5', m: '#d9cc9c', c: '#c4b585', w: '#ffffff', s: '#ffe48a' };
  const ground = ['', '', '', '', '', '', '', '', '', '', '', '', '', '...........ggg..', '.gggg....ggggggg', 'gggggggggggggggg'].map(r => r.padEnd(16, '.'));
  return `<svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges">
    <g class="ti-sun"><g class="ti-rays">${svgRects(rays, pal)}</g>${svgRects(sunDisk, pal)}</g>
    <g class="ti-moon">${svgRects(moon, pal)}</g>
    <g class="ti-star ti-s1">${svgRects(star(13, 3), pal)}</g><g class="ti-star ti-s2">${svgRects(star(3, 2), pal)}</g>
    <g class="ti-ground">${svgRects(ground, { g: 'currentColor' })}</g></svg>`;
}
let tipEl = null, tipT = 0;
function tip(btn, text) {
  if (!tipEl) { tipEl = D.createElement('span'); tipEl.className = 'wx-tip'; tipEl.setAttribute('role', 'status'); D.body.appendChild(tipEl); }
  const r = btn.getBoundingClientRect(); tipEl.textContent = text;
  tipEl.style.left = `${r.left + r.width / 2}px`; tipEl.style.top = `${r.bottom + 10}px`;
  tipEl.classList.remove('show'); void tipEl.offsetWidth; tipEl.classList.add('show');
  clearTimeout(tipT); tipT = setTimeout(() => tipEl.classList.remove('show'), 1300);
}
const MONO = ['X...X.X...X', 'XX..X.X...X', 'X.X.X.XXXXX', 'X..XX.X...X', 'X...X.X...X'];
function bootBrand() {
  const h = D.querySelector('.site-header'); if (!h || h.querySelector('.site-brand')) return;
  const a = D.createElement('a'); a.className = 'site-brand'; a.href = '/'; a.setAttribute('aria-label', 'Nikit Hamal, home');
  // each letter is its own group so they can hop one after the other
  const letter = (x0, x1) => MONO.map(r => r.slice(x0, x1));
  a.innerHTML = `<svg viewBox="-1 -1 13 7" aria-hidden="true" shape-rendering="crispEdges"><g class="sb-n">${svgRects(letter(0, 5), { X: 'currentColor' })}</g><g class="sb-h">${svgRects(letter(6, 11), { X: 'currentColor' }, 6)}</g><rect class="sb-dot" x="11.5" y="4" width="1" height="1" fill="#e8505f"/></svg>`;
  if (location.pathname === '/' || location.pathname.endsWith('/index.html')) a.addEventListener('click', e => { e.preventDefault(); scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });
  h.prepend(a);
  const bar = D.createElement('span'); bar.className = 'site-progress'; bar.setAttribute('aria-hidden', 'true'); h.appendChild(bar);
}
function bootControls() {
  bootBrand();
  D.querySelectorAll('.theme-toggle .theme-icon').forEach(s => { s.textContent = ''; s.innerHTML = themeSVG(); s.classList.add('is-pixel'); });
  const tog = D.querySelector('.theme-toggle'); if (!tog || D.querySelector('.weather-toggle')) return;
  const b = D.createElement('button'); b.type = 'button'; b.className = 'weather-toggle';
  const set = (k, anim) => {
    b.setAttribute('aria-label', `Weather: ${WX[k].label}. Click to change. Tip: click a cloud to make it rain.`); b.title = `Weather: ${WX[k].label} — click to change (tip: click a cloud, the sun or the moon)`;
    const next = D.createElement('span'); next.className = 'wx-icon'; next.innerHTML = weatherSVG(k);
    const old = b.querySelector('.wx-icon');
    if (old && anim && !reduce) { old.classList.add('wx-out'); next.classList.add('wx-in'); setTimeout(() => old.remove(), 420); b.appendChild(next); }
    else b.replaceChildren(next);
  };
  set(weather, false);
  b.addEventListener('click', () => {
    weather = ORDER[(ORDER.indexOf(weather) + 1) % ORDER.length];
    try { localStorage.setItem('sky-weather', weather); } catch (e) {}
    set(weather, true); tip(b, WX[weather].label);
    const wet = WX[weather].rain > 0; if (wasWet && !wet && !WX[weather].snow && !isDark() && !reduce) setTimeout(() => { rainbow = { age: 0, life: 16 }; }, 1800); wasWet = wet;
    if (weather === 'storm' && sky.c) { const vis = clouds.filter(c => c.vis > .3 && c.sy > 0 && c.sy < sky.H * .5); const c = vis.length ? pick(vis) : null; setTimeout(() => bolt(c ? c.sx + c.spr.w / 2 : sky.W * .7, c ? c.sy + c.spr.h : 0, sky.W * ra(.3, .8), sky.H * .8), 500); }
  });
  tog.parentNode.insertBefore(b, tog);
}

/* ================================================================== */
/*  PIXEL SECTION ICONS                                               */
/* ================================================================== */
const IP = { k: 'currentColor', s: '#e8b48a', b: '#6b8fd6', p: '#f6efe2', y: '#f2c14e', r: '#e0607e', u: '#5aa0e0', g: '#9aa7b8', w: '#eef2f7', f: '#ffb43d', e: '#f6efe2', l: '#b9a98e' };
const ICONS = {
  about:     ['...kkkk...', '..kssssk..', '..kskksk..', '..kssssk..', '...kssk...', '..kbbbbk..', '.kbbbbbbk.', '.kbbbbbbk.', 'kkkkkkkkkk', '..........'],
  portraits: ['....kk....', '.kkkkkkkk.', '.kppppppk.', '.kpyyrppk.', '.kpyurrpk.', '.kppppppk.', '.kkkkkkkk.', '..k.kk.k..', '.k..kk..k.', 'k...kk...k'],
  skills:    ['....kk....', '.kk.gg.kk.', '.kggggggk.', '..gg..gg..', 'kgg.kk.ggk', 'kgg.kk.ggk', '..gg..gg..', '.kggggggk.', '.kk.gg.kk.', '....kk....'],
  projects:  ['....kk....', '...kwwk...', '...kwwk...', '...kuuk...', '...kwwk...', '..kwwwwk..', '.krkwwkrk.', '.kr.kk.rk.', '....ff....', '...f..f...'],
  writing:   ['..........', 'kkkk..kkkk', 'kppkkkkppk', 'kpllkkllpk', 'kppkkkkppk', 'kpllkkllpk', 'kppkkkkppk', 'kkkkkkkkkk', '..........', '..........'],
  contact:   ['..........', 'kkkkkkkkkk', 'kkwwwwwwkk', 'kwkwwwwkwk', 'kwwkrrkwwk', 'kwwwkkwwwk', 'kwwwwwwwwk', 'kkkkkkkkkk', '..........', '..........']
};
function bootIcons() {
  D.querySelectorAll('.accordion-item[data-accordion]').forEach(it => {
    const rows = ICONS[it.dataset.accordion], pre = it.querySelector('.accordion-prefix'); if (!rows || !pre || pre.querySelector('svg')) return;
    pre.classList.add('pix-ico'); pre.innerHTML = `<svg viewBox="0 0 10 10" aria-hidden="true" shape-rendering="crispEdges">${svgRects(rows, IP)}</svg>`;
  });
}

/* ================================================================== */
/*  <pixel-horizon>: Himalaya, a stupa and prayer flags in the mist   */
/* ================================================================== */
class PixelHorizon extends HTMLElement {
  connectedCallback() {
    if (this._on) return; this._on = true; this.setAttribute('aria-hidden', 'true');
    this.c = D.createElement('canvas'); this.appendChild(this.c); this.g = this.c.getContext('2d');
    this.ro = new ResizeObserver(() => this.build()); this.ro.observe(this);
    this.mo = new MutationObserver(() => this.build()); this.mo.observe(R, { attributes: true, attributeFilter: ['data-theme'] });
    this.vis = false; this.io = new IntersectionObserver(es => { this.vis = es[0].isIntersecting; }, { rootMargin: '100px' }); this.io.observe(this);
    const loop = () => { if (this.vis && !D.hidden) this.draw(); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop);
  }
  disconnectedCallback() { this._on = false; cancelAnimationFrame(this.raf); this.ro.disconnect(); this.mo.disconnect(); this.io.disconnect(); }
  build() {
    const W = Math.ceil(this.clientWidth / S), H = Math.ceil(this.clientHeight / S); if (!W || !H) return;
    this.W = W; this.H = H; this.c.width = W; this.c.height = H; this.g.imageSmoothingEnabled = false;
    const dark = isDark(), C = dark
      ? { far: '#27304e', farS: '#1f2743', snow: '#8796bf', snowS: '#5f6d96', mid: '#1c2438', midS: '#171e30', tree: '#121827', near: '#131928', nearS: '#0f1420' }
      : { far: '#c3d1e5', farS: '#aebfd8', snow: '#ffffff', snowS: '#dce6f2', mid: '#a7bdad', midS: '#94ab9a', tree: '#7d9884', near: '#8ca393', nearS: '#7b9282' };
    this.C = C; this.dark = dark; seed = 0x9e3779b;
    // ridge profiles
    const ridge = (amp, base, rough, peaks) => { const h = new Float32Array(W + 1); const pk = []; for (let i = 0; i < peaks; i++) pk.push([ra(0, W), ra(.55, 1) * amp, ra(Math.max(12, W * .05), Math.max(22, W * .14))]);   // peaks keep a sane base width on phones
      for (let x = 0; x <= W; x++) { let v = 0; for (const [px, a, wd] of pk) v = Math.max(v, a * (1 - Math.abs(x - px) / wd)); h[x] = base + v + Math.sin(x * .21) * rough + Math.sin(x * .057 + 2) * rough * 1.6; } return h; };
    const far = ridge(H * .62, H * .22, 1.2, Math.max(3, Math.round(W / 45)));
    const mid = ridge(H * .18, H * .3, 1.5, Math.max(3, Math.round(W / 60)));
    const near = ridge(H * .08, H * .14, 1, Math.max(3, Math.round(W / 50)));
    const L = (h, fill) => { const c = cv(W, H), g = c.getContext('2d'); fill(g, h); return c; };
    const fade = (g, top) => { // the lower part melts into mist
      const im = g.getImageData(0, 0, W, H), d = new Uint32Array(im.data.buffer);
      for (let y = 0; y < H; y++) { const a = clamp(1 - (y - top) / (H - top), 0, 1); for (let x = 0; x < W; x++) if (bay8(x, y) >= a * a) d[y * W + x] = 0; }
      g.putImageData(im, 0, 0); };
    this.far = L(far, (g, h) => {
      for (let x = 0; x < W; x++) { const top = Math.round(H - h[x]), lit = h[x + 1] < h[x]; const snowLine = H - h[x] + Math.min(h[x] - H * .3, 7 + h[x] * .1);
        for (let y = top; y < H; y++) { const sn = h[x] > H * .45 && y < snowLine + (bay(x, y) - .5) * 3; g.fillStyle = sn ? (lit ? C.snow : C.snowS) : (lit ? C.far : C.farS); g.fillRect(x, y, 1, 1); } }
      fade(g, H * .45); });
    this.mid = L(mid, (g, h) => {
      for (let x = 0; x < W; x++) { const top = Math.round(H - h[x]); g.fillStyle = h[x + 1] < h[x] ? C.mid : C.midS; g.fillRect(x, top, 1, H - top);
        if (bay(x * 7, x) < .12) { g.fillStyle = C.tree; const th = ri(3, 6); for (let k = 0; k < th; k++) { const hw = Math.floor(k / 2); g.fillRect(x - hw, top - th + k, hw * 2 + 1, 1); } } }
      fade(g, H * .7); });
    const stupaX = Math.round(W * (W < 200 ? .7 : .78)), sTop = Math.round(H - near[stupaX]);
    this.near = L(near, (g, h) => {
      for (let x = 0; x < W; x++) { const top = Math.round(H - h[x]); g.fillStyle = h[x + 1] < h[x] ? C.near : C.nearS; g.fillRect(x, top, 1, H - top); }
      fade(g, H * .86); });
    // stupa (Boudhanath eyes) and lights
    const stupa = ['......y......', '.....yyy.....', '......y......', '.....yyy.....', '.....yyy.....', '....yyyyy....', '.....ooo.....', '....wwwww....', '....wkwkw....', '...wwwwwww...', '..wwwwwwwww..', '.wwwwwwwwwww.', 'wwwwwwwwwwwww'];
    this.stupa = art(stupa, dark ? { y: '#c79a3b', o: '#8a6a2a', w: '#b7bfd6', k: '#2a3150' } : { y: '#f2c14e', o: '#c28a2a', w: '#ffffff', k: '#2b3a55' });
    this.sx = stupaX - 6; this.sy = sTop - stupa.length + 2;
    this.anchorL = [Math.round(stupaX - W * .16), Math.round(H - near[Math.max(0, Math.round(stupaX - W * .16))])];
    this.anchorR = [Math.min(W - 1, Math.round(stupaX + W * .14)), Math.round(H - near[Math.min(W, Math.round(stupaX + W * .14))])];
    this.lights = []; if (dark) for (let i = 0; i < Math.round(W / 25); i++) { const x = ri(0, W - 1); this.lights.push([x, Math.round(H - near[x]) + ri(1, 4), rnd() * 6]); }
    this.draw();
  }
  draw() {
    if (!this.W) return; const { g, W, H } = this, r = this.getBoundingClientRect(), p = clamp((innerHeight - r.top) / (innerHeight + r.height), 0, 1);
    const off = k => reduce ? 0 : Math.round((1 - p) * k), now = performance.now() / 1000;
    g.clearRect(0, 0, W, H);
    g.drawImage(this.far, 0, off(16)); g.drawImage(this.mid, 0, off(9));
    const o = off(3); g.drawImage(this.near, 0, o);
    g.drawImage(this.stupa, this.sx, this.sy + o);
    // prayer flags from the spire to the hills, fluttering
    const flags = ['#3d7be0', '#ffffff', '#e0473c', '#3fae5a', '#f2c24b'], top = [this.sx + 6, this.sy + o];
    for (const an of [this.anchorL, this.anchorR]) {
      const ax = an[0], ay = an[1] + o - 1, n = Math.max(6, Math.round(Math.abs(ax - top[0]) / 3));
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = Math.round(lerp(top[0], ax, u)), sag = Math.sin(Math.PI * u) * 5, y = Math.round(lerp(top[1], ay, u) + sag);
        g.fillStyle = this.dark ? '#4a5270' : '#8a8f99'; g.fillRect(x, y, 1, 1);
        if (i % 2 === 1 && i < n) { const fl = reduce ? 0 : Math.round(Math.sin(now * 6 + i * .9) * .7); g.fillStyle = flags[(i >> 1) % 5]; g.globalAlpha = this.dark ? .65 : 1; g.fillRect(x, y + 1, 2, 2 + (fl > 0 ? 1 : 0)); g.fillRect(x + (fl < 0 ? 1 : 0), y + 3 + (fl > 0 ? 1 : 0), 1, 1); g.globalAlpha = 1; }
      }
    }
    for (const [x, y, ph] of this.lights) { const a = .6 + .4 * Math.sin(now * 2 + ph * 3); g.globalAlpha = a; g.fillStyle = '#ffd36b'; g.fillRect(x, y + o, 1, 1); }
    g.globalAlpha = 1;
  }
}
if (!customElements.get('pixel-horizon')) customElements.define('pixel-horizon', PixelHorizon);

/* ================================================================== */
/*  pixel sparkles on presses                                         */
/* ================================================================== */
function bootSparkles() {
  if (reduce) return;
  const c = D.createElement('canvas'); c.className = 'pixel-fx'; c.setAttribute('aria-hidden', 'true'); D.body.appendChild(c);
  const g = c.getContext('2d'); let parts = [], raf = 0, last = 0;
  const size = () => { c.width = Math.ceil(innerWidth / S); c.height = Math.ceil(innerHeight / S); g.imageSmoothingEnabled = false; }; size(); addEventListener('resize', size, { passive: true });
  const COLS = ['#ffc23d', '#f6aec0', '#8ec5ff', '#a7e3a1', '#ffffff'];
  const run = now => {
    const dt = Math.min(.05, (now - last) / 1000 || .016); last = now; g.clearRect(0, 0, c.width, c.height);
    parts = parts.filter(p => (p.age += dt) < p.life);
    for (const p of parts) { p.vy += 120 * dt; p.vx *= .97; p.x += p.vx * dt; p.y += p.vy * dt; const x = Math.round(p.x), y = Math.round(p.y), a = 1 - p.age / p.life; g.globalAlpha = a; g.fillStyle = p.c;
      if (p.s && p.age < p.life * .6) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); } else g.fillRect(x, y, 1, 1); }
    g.globalAlpha = 1; raf = parts.length ? requestAnimationFrame(run) : 0;
  };
  D.addEventListener('pointerdown', e => {
    const el = e.target.closest && e.target.closest('button, a, .skill-orb, .contact-row, .accordion-header'); if (!el || el.closest('dialog, pixel-dog, .pond-section')) return;
    const x = e.clientX / S, y = e.clientY / S, n = 10;
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i / n - .5) * Math.PI * 1.6, v = ra(30, 70); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: ra(.35, .6), c: pick(COLS), s: rnd() < .4 }); }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(run); }
  });
}

/* ================================================================== */
function boot() {
  bootControls(); bootIcons();
  // a horizon above the footer on every page
  const foot = D.querySelector('.minimal-footer');
  if (foot && !D.querySelector('pixel-horizon')) { const h = D.createElement('pixel-horizon'); foot.parentNode.insertBefore(h, foot); }
  bootSky(); bootSparkles();
}
window.PixelSky = { setWeather(k) { if (WX[k]) weather = k; }, get weather() { return weather; }, bolt: () => bolt(sky.W / 2, 0, sky.W / 2, sky.H * .8) };
if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot); else boot();
})();
