// The five Tihar cards (loaded before cards.js; uses its helpers at call time).
'use strict';
const TIHAR = {};
const TH = { night: '#0a0d2a', gold: '#ffd25a', cream: '#fff4dc', makh: '#ee4f8f' };

// shared night sky with stars
function nightSky(R, top = PX.P.night0, bot = PX.P.night3, seed = 1) { const { P, hash } = PX; R.vgrad(0, R.h, [[0, top], [0.55, PX.P.night1], [0.85, PX.P.night2], [1, bot]]); for (let i = 0; i < R.w * R.h / 220; i++) R.px(hash(i, 1, seed) * R.w, hash(i, 2, seed) * R.h * 0.7, P.white, 0.25 + 0.6 * hash(i, 3, seed)); }
// a string of bulbs between two points; colour cycles by index
function bulbs(R, x0, y0, x1, y1, sag, t = 0, seed = 0) { const { P, mix, hex } = PX; const cols = [P.flame1, P.makhL, P.teal, P.lime, P.flame2, hex('#7cbcf4')], n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 4);
  for (let i = 0; i <= n; i++) { const u = i / n, x = mix(x0, x1, u), y = mix(y0, y1, u) + Math.sin(u * Math.PI) * sag; R.px(x, y - 1, P.ink); const c = cols[(i + seed + Math.floor(t * 4)) % cols.length]; R.px(x, y, c); R.glow(x, y, 3, c, 0.25, 2); } }

// T1 "Deepawali" (pixel): the valley at night, every window and rooftop lit, bulbs strung across, fireworks.
TIHAR.deepawali = (c, W, H) => {
  const { P, K, hex } = PX, L = lay(W, H), { S, R } = pixR(W, H), w = R.w, h = R.h; nightSky(R, P.night0, hex('#4a2a6a'), 3);
    const fy0 = L.land ? 0.3 : 0.4; K.firework(R, w * 0.18, h * fy0, 0.95, P.makhL, 1, 36, 26); K.firework(R, w * 0.82, h * (fy0 + 0.06), 1.1, P.flame1, 2, 40, 30); K.firework(R, w * 0.6, h * (fy0 - 0.05), 0.85, P.teal, 3, 28, 18); K.firework(R, w * 0.4, h * (fy0 + 0.1), 1.0, P.lime, 4, 24, 14);
  const hy = h * (L.land ? 0.62 : 0.6); K.himal(R, hy, h * 0.06, 9, { col: hex('#1c1c46'), colD: hex('#1a1a42'), snow: hex('#5a5a96'), snowS: hex('#4a4a84'), peaks: K.fishtail(w * 0.4, h * 0.14, w * 0.1) });
  for (let i = 0; i < w * 1.2; i++) { const x = PX.hash(i, 7) * w, y = hy + 4 + PX.hash(i, 8) * (h * 0.22); if (R.get(x, y) !== 0) { R.px(x, y, i % 5 ? P.flame1 : P.flame0); R.glow(x, y, 3, P.flame2, 0.2, 2); } }
  const base = h - (L.land ? 6 : h * 0.07); const win = K.houses(R, -4, w + 4, base, 17, { night: true, lit: 0.85, t: 1 }); R.rect(0, base, w, h - base, P.ink);
  K.pagoda(R, w * 0.7, base - 4, L.land ? 1 : 1.25, 3, { night: true, lit: 1 }); K.stupa(R, w * 0.18, base - 2, L.land ? 0.6 : 0.75, { night: true });
  for (let i = 0; i < 5; i++) bulbs(R, i * w / 5, base - 34 - (i % 2) * 6, (i + 1) * w / 5, base - 30 - ((i + 1) % 2) * 6, 6, 0, i);
  for (let x = 4; x < w; x += 9) K.diyo(R, x, base + 3, 0.8, x * 0.37, x);
  const fs = Math.round(Math.min(w * (L.land ? 0.08 : 0.14), h * 0.13)), tx = L.land ? w * 0.05 : w / 2, ty = L.land ? h * 0.26 : h * (L.tall ? 0.24 : 0.26), al = L.land ? 'left' : 'center';
  const m = R.text('शुभ दीपावली', tx, ty, `${fs}px Yatra`, (u, v) => v < 0.5 ? P.flame0 : P.flame1, { align: al, outline: P.night0, shadow: P.flame3, sdx: 0, sdy: 2 });
  R.blit(c, S); const u = L.u, x = L.land ? tx * S : W / 2, y = (ty + m.des) * S + 56 * u;
  T(c, 'HAPPY TIHAR ' + YEAR, x, y, 32 * u, 'SilkB', TH.gold, { align: al, ls: 6 * u, shadow: ['#000', 0, 3 * u, 3 * u] });
  T(c, 'May every window you love stay lit.', x, y + 50 * u, 28 * u, 'Fraunces', TH.cream, { align: al, italic: true, maxW: L.land ? W * 0.5 : W * 0.86, shadow: ['rgba(0,0,0,.7)', 10 * u] });
  signature(c, L, TH.cream, L.land ? W - 40 * u : W / 2, L.land ? 70 * u : 120 * u, L.land ? 'right' : 'center', { k: 0.85 });
};

// T2 "Panch Tihar" (pixel infographic): five days, five beings honoured, in five lit panels.
const FIVE = [
  ['काग तिहार', 'KAG', 'the crow, messenger of Yama'], ['कुकुर तिहार', 'KUKUR', 'the dog, guardian of the gates'], ['गाई तिहार', 'GAI · LAXMI PUJA', 'the cow, and Laxmi at night'],
  ['गोरु तिहार', 'GORU · MHA PUJA', 'the ox, the hill, the self'], ['भाइटीका', 'BHAI TIKA', 'seven colours from a sister']];
function iconFor(R, i, cx, cy, s, t = 1) { const { P, K, hex } = PX;
  if (i === 0) { K.crow(R, cx, cy, s * 1.4, t); R.outline((x, y) => { const v = R.get(x, y); return v === P.ink || v === hex('#3a3550'); }, hex('#8a86c0')); }
  if (i === 1) { R.ellipse(cx, cy + 2 * s, 7 * s, 4 * s, hex('#d98a3d')); R.disc(cx + 6 * s, cy - 3 * s, 3.4 * s, hex('#d98a3d')); R.poly([[cx + 4 * s, cy - 6 * s], [cx + 6 * s, cy - 10 * s], [cx + 7 * s, cy - 5 * s]], hex('#a8642a')); R.px(cx + 8 * s, cy - 3 * s, P.ink); R.disc(cx + 6 * s, cy - 5 * s, 0.8 * s, P.sindoor);
    for (const lx of [-5, -2, 3, 5]) R.rect(cx + lx * s, cy + 5 * s, Math.max(1, s), 3 * s, hex('#a8642a')); R.line(cx - 7 * s, cy, cx - 10 * s, cy - 4 * s, hex('#d98a3d')); for (let k = -2; k <= 2; k++) K.marigold(R, cx + 4 * s + k * 1.6 * s, cy + 1 * s + Math.abs(k) * -0.6 * s, Math.max(1, 0.9 * s), k); }
  if (i === 2) { R.ellipse(cx, cy + 1 * s, 8 * s, 4.5 * s, hex('#f0ece4')); R.disc(cx - 8 * s, cy - 2 * s, 3 * s, hex('#f0ece4')); R.line(cx - 10 * s, cy - 5 * s, cx - 11 * s, cy - 7 * s, hex('#c0a070')); R.line(cx - 6 * s, cy - 5 * s, cx - 5 * s, cy - 7 * s, hex('#c0a070'));
    R.disc(cx + 2 * s, cy, 1.5 * s, hex('#8a6a4a')); for (const lx of [-6, -3, 3, 6]) R.rect(cx + lx * s, cy + 4 * s, Math.max(1, s), 3.5 * s, hex('#d0c8bc')); R.disc(cx - 8 * s, cy - 3 * s, 0.7 * s, P.sindoor); K.diyo(R, cx + 9 * s, cy + 6 * s, s * 0.6, t, 2); }
  if (i === 3) { R.poly([[cx - 10 * s, cy + 7 * s], [cx + 10 * s, cy + 7 * s], [cx + 4 * s, cy - 6 * s], [cx - 2 * s, cy - 8 * s]], hex('#6a4a2a')); R.poly([[cx - 8 * s, cy + 7 * s], [cx + 2 * s, cy + 7 * s], [cx - 2 * s, cy - 6 * s]], hex('#8a6a3a')); for (let k = 0; k < 5; k++) R.vline(cx - 6 * s + k * 3 * s, cy - 2 * s + Math.abs(k - 2) * 2 * s, cy + 6 * s, P.jam2); R.ring(cx + 6 * s, cy - 7 * s, 2.6 * s, P.gold, 1); }
  if (i === 4) { const cols = P.rainbow; for (let k = 0; k < 7; k++) R.rect(cx - 7 * s + k * 2 * s, cy - 7 * s + Math.abs(k - 3) * s * 0.8, Math.max(1, 2 * s), 12 * s - Math.abs(k - 3) * s * 1.6, cols[k]); R.ring(cx, cy, 10 * s, P.makh, Math.max(1, s)); } }
TIHAR.panch = (c, W, H) => {
  const { P, K, hex } = PX, L = lay(W, H), { S, R } = pixR(W, H), w = R.w, h = R.h; nightSky(R, P.night0, P.night2, 5);
  const cols = L.land ? 5 : L.tall ? 1 : L.sq ? 5 : 1, rows = Math.ceil(5 / cols); const top = L.land ? h * 0.36 : L.tall ? h * 0.2 : L.sq ? h * 0.42 : h * 0.24, bot = L.land ? h * 0.86 : L.tall ? h * 0.9 : L.sq ? h * 0.78 : h * 0.88;
  const pw = (w - 12) / cols, ph = (bot - top) / rows, cells = [];
  for (let i = 0; i < 5; i++) { const cx = 6 + (i % cols) * pw, cy = top + Math.floor(i / cols) * ph; cells.push([cx, cy]);
    R.rect(cx + 2, cy + 2, pw - 4, ph - 4, hex('#151a46')); R.rect(cx + 2, cy + 2, pw - 4, 1, P.gold); R.rect(cx + 2, cy + ph - 3, pw - 4, 1, P.goldD); R.halo(cx + (cols === 1 ? 24 : pw / 2), cy + (cols === 1 ? ph / 2 : ph * 0.36), Math.min(pw, ph) * 0.5, P.flame2, 0.25, 1.2);
    iconFor(R, i, cx + (cols === 1 ? 24 : pw / 2), cy + (cols === 1 ? ph / 2 : ph * 0.36), Math.max(1, Math.round(Math.min(pw, ph) / (cols === 1 ? 26 : 30))), i); }
  K.toran(R, 0, 0.5, { n: L.land ? 7 : 4, sag: 6, r: 2 });
  const fs = Math.round(Math.min(w * (L.land ? 0.07 : 0.12), h * 0.11)), ty = L.land ? h * 0.2 : h * (cols === 1 ? 0.12 : 0.2);
  const m = R.text('पञ्च तिहार', w / 2, ty, `${fs}px Yatra`, P.flame1, { outline: P.night0, shadow: P.flame3, sdx: 0, sdy: 2 });
  R.blit(c, S); const u = L.u;
  T(c, 'FIVE DAYS · FIVE BEINGS HONOURED · ' + YEAR, W / 2, (ty + m.des) * S + 44 * u, 22 * u, 'SilkB', TH.gold, { ls: 4 * u, maxW: W * 0.9 });
  cells.forEach(([cx, cy], i) => { const [np, en, gl] = FIVE[i];
    if (cols === 1) { const x = (cx + 50) * S, y = (cy + ph / 2) * S; T(c, np, x, y - 6 * u, 40 * u, 'Mukta', TH.cream, { align: 'left', weight: 800 }); T(c, 'DAY ' + (i + 1) + ' · ' + en, x, y + 30 * u, 16 * u, 'SilkB', TH.gold, { align: 'left', ls: 3 * u }); T(c, gl, x, y + 64 * u, 24 * u, 'Fraunces', TH.cream, { align: 'left', italic: true, alpha: 0.85 }); }
    else { const x = (cx + pw / 2) * S, y = (cy + ph * 0.72) * S; T(c, np, x, y, (L.land ? 30 : 26) * u, 'Mukta', TH.cream, { weight: 800, maxW: (pw - 6) * S }); T(c, 'DAY ' + (i + 1), x, y + 30 * u, 14 * u, 'SilkB', TH.gold, { ls: 3 * u }); T(c, gl, x, y + 58 * u, 17 * u, 'Fraunces', TH.cream, { italic: true, alpha: 0.85, maxW: (pw - 4) * S }); } });
  signature(c, L, TH.cream, W / 2, H - (L.land ? 36 : 70) * u, 'center', { k: L.land ? 0.6 : 0.8 });
};

// T3 "Kukur Tihar" (pixel): the dog from nikit.is-a.dev, garlanded, with a red tika, among diyos.
TIHAR.kukur = (c, W, H) => {
  const { P, K, hex } = PX, L = lay(W, H), { S, R } = pixR(W, H), w = R.w, h = R.h; nightSky(R, P.night0, hex('#5a2a5a'), 9);
  const fy = L.land ? h * 0.82 : h * 0.74; R.rect(0, fy, w, h - fy, hex('#2a1a2a')); for (let x = 0; x < w; x++) if (x % 8 < 4) R.px(x, fy, hex('#3a2a3a'));
  R.halo(L.land ? w * 0.66 : w / 2, fy - 20, Math.min(w, h) * 0.45, P.flame2, 0.4, 1.3);
  for (let i = 0; i < 9; i++) { const x = (L.land ? w * 0.36 : 8) + i * ((L.land ? w * 0.6 : w - 16) / 8); K.diyo(R, x, fy + 6 + (i % 2) * 4, 1.1, i * 0.7, i); }
  K.toran(R, 0, 1, { n: L.land ? 7 : 4, sag: 7, r: 2 }); R.blit(c, S);
  // the site's dog, drawn with its own rig, sitting; scale chosen so it reads at every size
  const dk = LIB.dogKit('shiba'), ds = Math.round(Math.min(W, H) / (L.land ? 110 : 125)), gx = L.land ? W * 0.62 : W / 2 + 10 * ds, gy = fy * S;
  dk.draw(c, gx, gy, ds, 'sit', 0.6, { wag: 0.4, mouth: 'pant' });
  // its garland (mala) and tika, drawn on top in the same pixel grid as the dog
  const R2 = new PX.Raster(Math.ceil(W / ds), Math.ceil(H / ds)); const hx = gx / ds, hy = gy / ds;
  for (let k = 0; k <= 14; k++) { const a = Math.PI * (0.08 + k / 14 * 0.84), x = hx + 7.5 + Math.cos(a) * 7, y = hy - 33 + Math.sin(a) * 8.5; k % 3 === 1 ? (R2.disc(x, y, 1.6, P.makhD), R2.disc(x, y, 1.1, P.makh)) : K.marigold(R2, x, y, 1.8, k); }
  R2.ellipse(hx + 14.5, hy - 40, 1.2, 1.6, P.sindoor); R2.px(hx + 14.1, hy - 40.9, P.sindoorL); R2.blit(c, ds);
  const u = L.u, x = L.land ? W * 0.07 : W / 2, al = L.land ? 'left' : 'center', y0 = L.land ? H * 0.32 : H * (L.tall ? 0.16 : 0.13);
  T(c, 'कुकुर तिहार', x, y0, (L.land ? 120 : 110) * u, 'Yatra', TH.gold, { align: al, shadow: ['#000', 0, 6 * u, 6 * u], maxW: L.land ? W * 0.45 : W * 0.9 });
  T(c, 'KUKUR TIHAR · DAY 2', x, y0 + 56 * u, 22 * u, 'SilkB', TH.cream, { align: al, ls: 5 * u });
  T(c, 'Every dog gets a garland, a tika and a feast.', x, y0 + 110 * u, 30 * u, 'Fraunces', TH.cream, { align: al, italic: true, maxW: L.land ? W * 0.45 : W * 0.88 });
  T(c, 'Mine too. Happy Tihar ' + YEAR + '.', x, y0 + 152 * u, 30 * u, 'Fraunces', TH.gold, { align: al, italic: true, maxW: L.land ? W * 0.45 : W * 0.88 });
  signature(c, L, TH.cream, L.land ? W * 0.07 : W / 2, H - (L.land ? 120 : 90) * u, al, { k: 0.85 });
};

// T4 "Laxmi Puja" (pixel, top-down): a rangoli mandala ringed with diyos; Laxmi's footprints walk in from the door.
TIHAR.laxmi = (c, W, H) => {
  const { P, K, hex } = PX, L = lay(W, H), { S, R } = pixR(W, H), w = R.w, h = R.h; R.clear(hex('#3a1a12')); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x * 3 + y * 7) % 11 === 0) R.px(x, y, hex('#42201a'));
  const cx = L.land ? w * 0.68 : w / 2, cy = L.land ? h * 0.5 : h * (L.tall ? 0.52 : L.sq ? 0.6 : 0.58), rad = Math.min(w, h) * (L.land ? 0.36 : L.sq ? 0.27 : 0.31);
  R.halo(cx, cy, rad * 1.6, P.flame2, 0.35, 1.2); K.rangoli(R, cx, cy, rad, 1, 0);
  for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283, x = cx + Math.cos(a) * (rad + 9), y = cy + Math.sin(a) * (rad + 9); K.diyo(R, x, y, 1, k * 0.5, k); }
  // footprints (paila) from the bottom edge to the mandala: Laxmi is invited in
  const fx = cx, steps = 5; for (let k = 0; k < steps; k++) { const y = h - 8 - k * ((h - (cy + rad + 16)) / steps), x = fx + (k % 2 ? 5 : -5); if (y < cy + rad + 14) break; R.ellipse(x, y, 2.4, 3.6, P.sindoor); R.disc(x, y - 4.8, 1.2, P.sindoor); for (let t = -1; t <= 1; t++) R.px(x + t * 1.5, y - 6.6, P.sindoorL); }
  for (let k = 0; k < 7; k++) { const a = k * 0.9, x = cx + Math.cos(a) * rad * 0.2, y = cy + Math.sin(a) * rad * 0.2; R.disc(x, y, 1.6, P.gold); R.px(x - 0.5, y - 0.5, P.goldL); }
  R.blit(c, S); const u = L.u, x = L.land ? W * 0.07 : W / 2, al = L.land ? 'left' : 'center', y0 = L.land ? H * 0.33 : H * (L.tall ? 0.13 : 0.1);
  T(c, 'शुभ दीपावली', x, y0, (L.land ? 120 : 100) * u, 'Yatra', TH.gold, { align: al, shadow: ['#000', 0, 6 * u, 6 * u], maxW: L.land ? W * 0.4 : W * 0.9 });
  T(c, 'LAXMI PUJA · THE NIGHT OF AUNSI', x, y0 + 54 * u, 20 * u, 'SilkB', TH.cream, { align: al, ls: 4 * u, maxW: L.land ? W * 0.42 : W * 0.9 });
  T(c, 'Light every lamp, leave the door open,', x, y0 + 108 * u, 30 * u, 'Fraunces', TH.cream, { align: al, italic: true, maxW: L.land ? W * 0.42 : W * 0.88 });
  T(c, 'and may prosperity find its way in.', x, y0 + 148 * u, 30 * u, 'Fraunces', TH.cream, { align: al, italic: true, maxW: L.land ? W * 0.42 : W * 0.88 });
  signature(c, L, TH.cream, L.land ? W * 0.07 : W / 2, H - (L.land ? 120 : 70) * u, al, { k: 0.8 });
};

// T5 "Bhai Tika" (clean): the saptarangi tika of seven colours inside a ring of makhamali that never wilts.
TIHAR.bhaitika = (c, W, H) => {
  const { rng, clamp } = PX, L = lay(W, H), u = L.u; const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a0a24'); g.addColorStop(1, '#3a0f2e'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const cx = L.land ? W * 0.3 : W / 2, cy = L.land ? H * 0.5 : H * (L.tall ? 0.36 : L.sq ? 0.36 : 0.4), r = Math.min(W, H) * (L.land ? 0.3 : L.sq ? 0.22 : 0.27);
  // makhamali (globe amaranth) garland: a ring of soft magenta globes with tiny leaves
  const R_ = rng(5), n = 34; for (let k = 0; k < n; k++) { const a = k / n * 6.283, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, s = r * 0.095 * (0.9 + R_() * 0.2);
    c.fillStyle = '#1f5a2a'; c.beginPath(); c.ellipse(x + Math.cos(a + 1.2) * s * 0.9, y + Math.sin(a + 1.2) * s * 0.9, s * 0.6, s * 0.25, a, 0, 7); c.fill();
    const gg = c.createRadialGradient(x - s * 0.3, y - s * 0.3, s * 0.1, x, y, s); gg.addColorStop(0, '#ff8ab8'); gg.addColorStop(0.6, '#d81b60'); gg.addColorStop(1, '#7d0f3c'); c.fillStyle = gg; c.beginPath(); c.arc(x, y, s, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.25)'; for (let q = 0; q < 6; q++) { c.beginPath(); c.arc(x + (R_() - .5) * s, y + (R_() - .5) * s, s * 0.12, 0, 7); c.fill(); } }
  // the seven-colour tika: vertical strokes, as a sister draws them on the brother's forehead
  const cols = ['#d7192a', '#ff8a1c', '#ffd400', '#2fae4a', '#1f7ae0', '#2a2aa8', '#8a2be2'], sw = r * 0.085, th = r * 0.95;
  cols.forEach((col, k) => { const x = cx + (k - 3) * sw * 1.05, hh = th * (1 - Math.abs(k - 3) * 0.07); c.fillStyle = col; c.beginPath(); c.roundRect(x - sw / 2, cy - hh / 2, sw, hh, sw / 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.roundRect(x - sw / 2 + sw * 0.15, cy - hh / 2 + sw * 0.3, sw * 0.25, hh - sw * 0.6, sw * 0.12); c.fill(); });
  c.fillStyle = '#fff6e6'; c.beginPath(); c.ellipse(cx, cy + th / 2 + r * 0.1, sw * 0.9, sw * 0.6, 0, 0, 7); c.fill();   // a dot of curd/rice under the tika
  const ink = TH.cream, x = L.land ? W * 0.58 : W / 2, al = L.land ? 'left' : 'center', y0 = L.land ? H * 0.34 : cy + r + (L.tall ? 230 : L.sq ? 120 : 150) * u, mw = L.land ? W * 0.38 : W * 0.88;
  T(c, 'भाइटीका', x, y0, (L.tall ? 150 : 120) * u, 'Tiro', '#ffd25a', { align: al, maxW: mw });
  T(c, 'Seven colours. One promise.', x, y0 + 66 * u, 40 * u, 'Fraunces', ink, { align: al, italic: true, maxW: mw });
  T(c, 'शुभ दीपावली तथा भाइटीका ' + NPNUM(YEAR), x, y0 + 130 * u, 32 * u, 'Mukta', TH.makh, { align: al, weight: 700, maxW: mw });
  T(c, 'BHAI TIKA · THE FIFTH DAY OF TIHAR', L.land ? x : W / 2, L.land ? H * 0.2 : 90 * u, 18 * u, 'SilkB', '#ffd25a', { align: al, ls: 5 * u, maxW: mw });
  signature(c, L, ink, L.land ? x : W / 2, L.land ? H * 0.8 : H - 100 * u, al);
  grain(c, W, H, 0.08, 11);
};
