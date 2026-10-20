// Ten festival cards (5 Dashain, 5 Tihar). Each design is a function of the canvas size, so one design yields every
// platform aspect: square 1:1, portrait 4:5, story 9:16, landscape 16:9 and link 1.91:1. Pixel designs draw on a PX
// raster (short side ~200 px) blown up with nearest-neighbour; type is set at full resolution on top.
'use strict';
const { P, K, Raster, hex, rng, hash, clamp, mix, fbm, rgba } = PX;
const SIGN = { name: 'Nikit Hamal', url: 'nikit.is-a.dev' };
const NPNUM = s => String(s).replace(/\d/g, d => '०१२३४५६७८९'[d]);
const YEAR = 2083;

// ---------- full-res type
function T(c, s, x, y, size, fam, col, o = {}) {
  const { align = 'center', weight = 400, ls = 0, alpha = 1, shadow = null, base = 'alphabetic', italic = false, maxW = 0, stroke = null, sw = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${fam}`; c.letterSpacing = ls + 'px'; c.textAlign = align; c.textBaseline = base;
  if (maxW) { const w = c.measureText(s).width; if (w > maxW) { size *= maxW / w; c.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${fam}`; } }
  if (shadow) { c.shadowColor = shadow[0]; c.shadowBlur = shadow[1]; c.shadowOffsetX = shadow[2] || 0; c.shadowOffsetY = shadow[3] || 0; }
  if (stroke) { c.lineJoin = 'round'; c.strokeStyle = stroke; c.lineWidth = sw; c.strokeText(s, x, y); }
  c.fillStyle = col; c.fillText(s, x, y); const w = c.measureText(s).width; c.restore(); return { w, size }; }
function lay(W, H) { const r = W / H; return { W, H, u: Math.min(W, H) / 1080, port: r < 0.9, tall: r < 0.66, land: r > 1.25, wide: r > 1.7, sq: r >= 0.9 && r <= 1.25 }; }
function pixR(W, H) { const S = Math.max(3, Math.round(Math.min(W, H) / 200)); return { S, R: new Raster(Math.ceil(W / S), Math.ceil(H / S)) }; }
function signature(c, L, col, x, y, align = 'center', o = {}) { const u = L.u; T(c, '— ' + SIGN.name, x, y, 30 * u * (o.k || 1), 'Fraunces', col, { align, italic: true, weight: 500, alpha: 0.95 });
  T(c, SIGN.url.toUpperCase(), x, y + 34 * u * (o.k || 1), 15 * u * (o.k || 1), 'Silk', col, { align, ls: 3 * u, alpha: 0.7 }); }
function grain(c, W, H, a = 0.05, seed = 1) { const n = document.createElement('canvas'); n.width = n.height = 256; const x = n.getContext('2d'), d = x.createImageData(256, 256), r = rng(seed);
  for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255 * a; } x.putImageData(d, 0, 0); c.save(); c.fillStyle = c.createPattern(n, 'repeat'); c.globalCompositeOperation = 'overlay'; c.fillRect(0, 0, W, H); c.restore(); }
function vignette(R, k = 0.5, col = P.ink) { const cx = R.w / 2, cy = R.h / 2, m = Math.hypot(cx, cy); for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) { const d = Math.hypot(x - cx, y - cy) / m; if (d > 0.62) R.px(x, y, col, (d - 0.62) / 0.38 * k); } }

// ================================================================== DASHAIN
const D = {};

// D1: "Changa" (pixel). An autumn sky full of kites over the Kathmandu valley, Machhapuchhre on the horizon.
D.changa = (c, W, H) => {
  const L = lay(W, H), { S, R } = pixR(W, H), w = R.w, h = R.h;
  R.vgrad(0, h * 0.78, [[0, P.sky0], [0.45, P.sky1], [0.8, P.sky2], [1, P.sky3]]);
  for (const [x, y, s] of [[0.15, 0.30, 1], [0.78, 0.18, 0.8], [0.55, 0.42, 0.7], [0.92, 0.48, 0.9]]) K.cloud(R, x * w, y * h, s);
  const hy = h * (L.land ? 0.80 : 0.70), amp = Math.min(h * 0.22, w * 0.3);
  K.himal(R, hy, amp * 0.55, 3, { freq: 0.03, peaks: [...K.fishtail(w * 0.62, amp, w * 0.12), { x: w * 0.25, h: amp * 0.72, w: w * 0.18 }, { x: w * 0.9, h: amp * 0.66, w: w * 0.14 }] });
  K.hills(R, hy + 6, h * 0.06, 5, [P.hill2, P.hill1]); K.hills(R, hy + h * 0.06, h * 0.05, 8, [P.hill1, P.hill0]);
  const base = Math.round(h - (L.land ? 4 : h * 0.07)); K.houses(R, -4, w + 4, base, 11); R.rect(0, base, w, h - base, P.brickD); for (let x = 0; x < w; x++) for (let y = base + 1; y < h; y++) if ((x + (Math.floor((y - base) / 3) % 2) * 3) % 6 === 0 || (y - base) % 3 === 0) R.px(x, y, hex('#561a12'));
  K.pagoda(R, w * 0.24, base - 2, L.land ? 0.9 : 1.1, 3); K.stupa(R, w * 0.8, base - 1, L.land ? 0.55 : 0.7);
  const kites = [[0.72, 0.30, 2.2, P.sindoor, P.mari, -0.25, 0.86], [0.3, 0.42, 1.5, P.mari, P.gold, 0.2, 0.12], [0.9, 0.6, 1.1, hex('#2a6fdb'), P.white, 0.15, 0.98], [0.1, 0.66, 1, P.leaf, P.jam1, -0.3, 0.02], [0.52, 0.55, 0.9, P.makh, P.white, 0.4, 0.4], [0.4, 0.22, 0.7, P.white, P.sindoor, -0.1, 0.6]];
  const top = L.land ? 0 : h * 0.24;
  for (const [x, y, s, c1, c2, a, ax] of kites) { const kx = L.land ? (0.3 + x * 0.7) * w : x * w, ky = L.land ? (0.08 + y * 0.6) * h : top + y * (h - top) * 0.7, sx = ax * w, sy = base - 20 - (ax * 31 % 1) * 12, sc = s * Math.min(w, h) / 216;
    R.curve(kx, ky + 2 * sc, (kx + sx) / 2, (ky + sy) / 2 + Math.abs(sx - kx) * 0.25 + 8, sx, sy, hex('#26304a'), 0.7, 28); K.kite(R, kx, ky, sc, c1, c2, a, x * 7); }
  for (let i = 0; i < 6; i++) K.bird(R, w * (0.1 + i * 0.07), h * (0.12 + (i % 2) * 0.03), i);
  // pixel Devanagari title
  const tx = L.land ? w * 0.05 : w / 2, ty = L.land ? h * 0.24 : h * (L.tall ? 0.1 : 0.12), al = L.land ? 'left' : 'center', fs = Math.round(Math.min(w * (L.land ? 0.075 : 0.115), h * 0.11));
  const m = R.text('शुभ विजया दशमी', tx, ty, `${fs}px Yatra`, P.white, { align: al, outline: P.ink, shadow: P.sindoorD, sdx: 2, sdy: 2 });
  R.blit(c, S);
  const sub = (L.land ? m.x * S : W / 2), y2 = (ty + m.des) * S + 58 * L.u;
  T(c, 'HAPPY DASHAIN ' + YEAR, sub, y2, 34 * L.u, 'SilkB', '#fff', { align: al, ls: 6 * L.u, shadow: ['#0b2a55', 0, 3 * L.u, 3 * L.u] });
  T(c, 'May every string stay strong and every kite fly higher.', sub, y2 + 50 * L.u, 26 * L.u, 'Fraunces', '#fff', { align: al, italic: true, weight: 500, shadow: ['rgba(10,30,70,.6)', 8 * L.u], maxW: L.land ? W * 0.5 : W * 0.86 });
  signature(c, L, '#fff', L.land ? W - 40 * L.u : W / 2, L.land ? 70 * L.u : H - (H - base * S) / 2 - 8 * L.u, L.land ? 'right' : 'center', { k: L.land ? 1 : 0.85 });
};

// D2: "Tika" (clean). One red tika of rice, curd and abir, with jamara rising behind it like the sun's rays.
D.tika = (c, W, H) => {
  const L = lay(W, H), u = L.u; c.fillStyle = '#f7efe1'; c.fillRect(0, 0, W, H);
  const cx = L.land ? W * 0.3 : W / 2, cy = L.land ? H * 0.5 : H * (L.tall ? 0.36 : 0.40), r = Math.min(W, H) * (L.land ? 0.2 : 0.19);
  // jamara: tapered blades fanning from below the tika, pale yellow at the root to green at the tips
  const r_ = rng(4), N = 46;
  for (let i = 0; i < N; i++) { const a = -Math.PI / 2 + (i / (N - 1) - 0.5) * 2.3 + (r_() - 0.5) * 0.05, len = r * (1.5 + r_() * 0.9), bx = cx + (r_() - 0.5) * r * 0.25, by = cy + r * 0.95;
    const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len * 1.05, bend = (r_() - 0.5) * 0.25, mx = (bx + ex) / 2 + Math.cos(a + 1.57) * len * bend, my = (by + ey) / 2 + Math.sin(a + 1.57) * len * bend, wd = (3 + r_() * 4) * u;
    const g = c.createLinearGradient(bx, by, ex, ey); g.addColorStop(0, '#f3ecb0'); g.addColorStop(0.5, ['#dfe08a', '#cfd86a', '#e6e39a'][i % 3]); g.addColorStop(1, ['#8fae3c', '#a4bf4a', '#7f9e34'][i % 3]);
    c.fillStyle = g; c.globalAlpha = 0.9; c.beginPath(); c.moveTo(bx - wd, by); c.quadraticCurveTo(mx - wd * 0.6, my, ex, ey); c.quadraticCurveTo(mx + wd * 0.6, my, bx + wd, by); c.fill(); c.globalAlpha = 1; }
  // soft shadow + the tika itself: hundreds of rice grains stained with abir
  c.save(); c.fillStyle = 'rgba(120,20,20,0.18)'; c.filter = `blur(${24 * u}px)`; c.beginPath(); c.ellipse(cx + 10 * u, cy + 18 * u, r * 1.02, r * 0.98, 0, 0, 7); c.fill(); c.restore();
  const rg = c.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r); rg.addColorStop(0, '#e2283a'); rg.addColorStop(1, '#a0101e'); c.fillStyle = rg; c.beginPath();
  for (let k = 0; k <= 64; k++) { const a = k / 64 * 6.283, rr = r * (0.97 + 0.03 * Math.sin(a * 7) + 0.02 * Math.sin(a * 13 + 1)); c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } c.fill();
  const rr2 = rng(9); for (let k = 0; k < 900; k++) { const a = rr2() * 6.283, d = Math.sqrt(rr2()) * r * 1.02, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, ang = rr2() * 3.14, gl = (7 + rr2() * 3) * u * r / 200, gw = gl * 0.42;
    const lit = clamp(0.5 - ((x - cx) + (y - cy)) / (r * 2.4)), v = rr2(); c.save(); c.translate(x, y); c.rotate(ang);
    c.fillStyle = v < 0.08 ? '#f6e7d2' : `hsl(${352 + rr2() * 8},${78 + rr2() * 12}%,${30 + lit * 26 + rr2() * 8}%)`; c.beginPath(); c.ellipse(0, 0, gl / 2, gw / 2, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,220,220,0.35)'; c.beginPath(); c.ellipse(-gl * 0.12, -gw * 0.15, gl * 0.22, gw * 0.15, 0, 0, 7); c.fill(); c.restore(); }
  // type
  const ink = '#4a0d14', red = '#b3121f';
  if (L.land) { const x = W * 0.56, mw = W * 0.4;
    T(c, 'VIJAYA DASHAMI · ' + YEAR + ' BS', x, H * 0.28, 18 * u, 'SilkB', red, { align: 'left', ls: 5 * u, maxW: mw });
    T(c, 'विजया दशमी', x, H * 0.47, 120 * u, 'Tiro', ink, { align: 'left', maxW: mw });
    T(c, 'Victory, on the tenth day.', x, H * 0.59, 40 * u, 'Fraunces', ink, { align: 'left', italic: true, weight: 400, maxW: mw });
    T(c, 'हार्दिक मंगलमय शुभकामना', x, H * 0.69, 34 * u, 'Mukta', red, { align: 'left', weight: 700, maxW: mw });
    signature(c, L, ink, x, H * 0.82, 'left');
  } else { const y0 = cy + r * 1.0 + (L.tall ? 230 : 150) * u;
    T(c, 'विजया दशमी', W / 2, y0, (L.tall ? 150 : 128) * u, 'Tiro', ink, { maxW: W * 0.86 });
    T(c, 'Victory, on the tenth day.', W / 2, y0 + 70 * u, 40 * u, 'Fraunces', ink, { italic: true });
    T(c, 'हार्दिक मंगलमय शुभकामना · ' + NPNUM(YEAR), W / 2, y0 + 140 * u, 34 * u, 'Mukta', red, { weight: 700, maxW: W * 0.86 });
    T(c, 'VIJAYA DASHAMI · ' + YEAR + ' BS', W / 2, 90 * u, 18 * u, 'SilkB', red, { ls: 6 * u });
    signature(c, L, ink, W / 2, H - 100 * u); }
  grain(c, W, H, 0.10, 3);
};

// D3: "Vijaya" (pixel). The trishul of Durga against a sunrise of victory; nine moons for the nine nights.
D.vijaya = (c, W, H) => {
  const L = lay(W, H), { S, R } = pixR(W, H), w = R.w, h = R.h, cx = L.land ? w * 0.68 : w / 2, cy = L.land ? h * 0.62 : h * 0.56;
  R.vgrad(0, h, [[0, hex('#2a0610')], [0.45, hex('#7a0d1c')], [0.75, P.sindoor], [1, P.mariD]]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = Math.atan2(y - cy, x - cx), ray = Math.sin(a * 18) > 0.55; if (ray) R.px(x, y, P.mari, 0.22 * clamp(1 - Math.hypot(x - cx, y - cy) / (h * 0.9))); }
  R.halo(cx, cy, Math.min(w, h) * 0.42, P.gold, 0.55, 1.4); R.halo(cx, cy, Math.min(w, h) * 0.22, P.goldL, 0.9, 1);
  // nine moons of Navaratri on an arc
  const ar = Math.min(w, h) * (L.land ? 0.38 : 0.36);
  for (let k = 0; k < 9; k++) { const a = Math.PI * (1.08 + k / 8 * 0.84), x = cx + Math.cos(a) * ar, y = cy - (L.land ? 4 : 10) + Math.sin(a) * ar; K.moon(R, x, y, 3, 0.04 + k * 0.05, P.goldL, hex('#4a0a14')); }
  const th = Math.min(h * 0.62, w * (L.land ? 1 : 0.95)), tk = Math.min(w, h) / 120; K.trishul(R, cx, cy - th * 0.42, th, P.gold, P.goldD, tk);
  // the Himalaya and a temple silhouette in black against the dawn
  const hy = h - (L.land ? 10 : h * 0.12); K.himal(R, hy, h * 0.12, 21, { col: hex('#1a0408'), colD: hex('#14030a'), snow: hex('#3a0a14'), snowS: hex('#2a0610'), snowLine: 0.75, peaks: K.fishtail(w * 0.2, h * 0.16, w * 0.1) });
  R.rect(0, hy, w, h - hy, hex('#14030a')); K.pagoda(R, L.land ? w * 0.18 : w * 0.82, hy + 1, 0.9, 3, {}); for (let y = hy - 50; y < h; y++) for (let x = 0; x < w; x++) { const v = R.get(x, y); if (v === P.brick || v === P.brickD || v === P.roof || v === P.roofL || v === P.wood) R.b[y * w + x] = hex('#14030a'); }
  const fs = Math.round(Math.min(w * (L.land ? 0.09 : 0.15), h * 0.13)), tx = L.land ? w * 0.06 : w / 2, ty = L.land ? h * 0.36 : h * 0.14, al = L.land ? 'left' : 'center';
  const m = R.text('विजया दशमी', tx, ty, `${fs}px Yatra`, (u, v) => v < 0.55 ? P.goldL : P.gold, { align: al, outline: hex('#2a0610'), shadow: P.sindoorD, sdx: 0, sdy: 2 });
  vignette(R, 0.6, hex('#14030a')); R.blit(c, S);
  const u = L.u, sx = L.land ? tx * S : W / 2, sy = (ty + m.des) * S + 60 * u;
  T(c, 'NINE NIGHTS. ONE VICTORY.', sx, sy, 30 * u, 'SilkB', '#ffe08a', { align: al, ls: 5 * u, maxW: L.land ? W * 0.5 : W * 0.9 });
  T(c, 'May Maa Durga’s strength be with you and yours.', sx, sy + 50 * u, 28 * u, 'Fraunces', '#fff4dc', { align: al, italic: true, maxW: L.land ? W * 0.5 : W * 0.86 });
  if (L.land) T(c, 'बडा दशैं ' + NPNUM(YEAR) + 'को हार्दिक शुभकामना', sx, sy + 110 * u, 30 * u, 'Mukta', '#ffd25a', { align: al, weight: 700 });
  signature(c, L, '#ffe9c2', L.land ? tx * S : W / 2, L.land ? H - 110 * u : H - 96 * u, al);
};

// D4: "Ping" (pixel). Golden hour, a bamboo ping mid-swing above the terraces, kites in the last light.
D.ping = (c, W, H) => {
  const L = lay(W, H), { S, R } = pixR(W, H), w = R.w, h = R.h;
  R.vgrad(0, h * 0.75, [[0, hex('#2b1d5c')], [0.35, hex('#7a3d7a')], [0.65, hex('#e0614a')], [0.9, hex('#ffb347')], [1, hex('#ffd98a')]]);
  const sx = L.land ? w * 0.7 : w * 0.62, sy = h * (L.land ? 0.62 : 0.58); R.halo(sx, sy, w * 0.45, hex('#ffd98a'), 0.6, 1.6); R.disc(sx, sy, Math.min(w, h) * 0.11, hex('#fff1c4'));
  K.himal(R, h * (L.land ? 0.7 : 0.66), h * 0.1, 14, { col: hex('#8a4a6a'), colD: hex('#6a3a5a'), snow: hex('#ffc9a0'), snowS: hex('#e09a8a'), peaks: K.fishtail(w * 0.35, h * 0.14, w * 0.1) });
  K.hills(R, h * 0.72, h * 0.05, 3, [hex('#6a4a3a'), hex('#4a3530')]);
  K.terraces(R, h * 0.76, h, 6, [hex('#8a6a2a'), hex('#a8822e'), hex('#e0b54a')]);
  // ping in silhouette with the rider at the top of the arc
  const px = L.land ? w * 0.36 : w * 0.4, base = h * (L.land ? 0.97 : 0.9), ph = Math.min(h * (L.land ? 0.66 : 0.5), w * 0.75); const th = 0.5;
  K.ping(R, px, base, ph, th, { col: P.sindoor, rs: Math.max(1, Math.round(Math.min(w, h) / 75)), pole: hex('#2a1420'), pole2: hex('#2a1420'), rope: hex('#2a1420'), skin: hex('#2a1420'), hair: hex('#2a1420') });   for (const [x, y, s_, c1, c2, a, ax] of [[0.84, 0.3, 1.3, P.sindoor, P.gold, 0.2, 0.98], [0.14, 0.42, 0.9, P.teal, P.white, -0.3, 0.02]]) { const sc = s_ * Math.min(w, h) / 216; R.curve(x * w, y * h, (x + ax) / 2 * w, (y * h + h) / 2 + 10, ax * w, h, hex('#2a1420'), 0.75, 28); K.kite(R, x * w, y * h, sc, c1, c2, a, 1); }
  for (let i = 0; i < 7; i++) K.bird(R, sx - 30 + i * 9, sy - 40 - (i % 3) * 5, i * 0.7, hex('#2a1420'));
  const fs = Math.round(Math.min(w * (L.land ? 0.075 : 0.13), h * 0.12)), tx = L.land ? w * 0.05 : w / 2, ty = L.land ? h * 0.2 : h * 0.13, al = L.land ? 'left' : 'center';
  const m = R.text('दशैंको रमझम', tx, ty, `${fs}px Yatra`, hex('#fff1c4'), { align: al, outline: hex('#2b1d5c'), shadow: hex('#e0614a'), sdx: 2, sdy: 2 });
  R.blit(c, S); const u = L.u, x = L.land ? tx * S : W / 2, y = (ty + m.des) * S + 56 * u;
  T(c, 'SWING HIGH. COME HOME.', x, y, 32 * u, 'SilkB', '#fff1c4', { align: al, ls: 5 * u, shadow: ['#2b1d5c', 0, 3 * u, 3 * u] });
  T(c, 'Happy Dashain ' + YEAR + ' — to everyone who made it home.', x, y + 48 * u, 26 * u, 'Fraunces', '#fff', { align: al, italic: true, maxW: L.land ? W * 0.45 : W * 0.86, shadow: ['rgba(43,29,92,.7)', 8 * u] });
  signature(c, L, '#fff1c4', L.land ? W - 40 * u : W / 2, L.land ? 70 * u : H - 100 * u, L.land ? 'right' : 'center');
};

// D5: "Ashirvad" (typographic). The blessing elders recite while placing tika, set in Devanagari, framed in gold.
D.ashirvad = (c, W, H) => {
  const L = lay(W, H), u = L.u, { S, R } = pixR(W, H), w = R.w, h = R.h;
  R.clear(hex('#5a0b16')); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x + y) % 12 === 0 || (x - y + 1200) % 12 === 0) R.px(x, y, hex('#6a1020'));   // lattice like a carved wooden window
  const fr = 6; R.rect(fr, fr, w - fr * 2, 1, P.gold); R.rect(fr, h - fr - 1, w - fr * 2, 1, P.gold); R.rect(fr, fr, 1, h - fr * 2, P.gold); R.rect(w - fr - 1, fr, 1, h - fr * 2, P.gold);
  R.rect(fr + 2, fr + 2, w - fr * 2 - 4, 1, P.goldD); R.rect(fr + 2, h - fr - 3, w - fr * 2 - 4, 1, P.goldD); R.rect(fr + 2, fr + 2, 1, h - fr * 2 - 4, P.goldD); R.rect(w - fr - 3, fr + 2, 1, h - fr * 2 - 4, P.goldD);
  K.toran(R, 0, 0, { n: L.land ? 7 : 4, sag: L.land ? 8 : 10, r: 2 });
  K.jamara(R, 16, h - 8, h * 0.18, 26, 3, 0.6, { spread: 6 }); K.jamara(R, w - 16, h - 8, h * 0.18, 26, 4, 1.2, { spread: 6 });
  R.blit(c, S);
  const lines = ['आयुर्द्रोणसुते श्रियं दशरथे', 'शत्रुक्षयं राघवे ।', 'ऐश्वर्यं नहुषे गतिश्च पवने', 'मानञ्च दुर्योधने ॥', 'दानं सूर्यसुते बलं हलधरे', 'सत्यञ्च कुन्तीसुते ।', 'विज्ञानं विदुरे भवन्तु भवतां', 'कीर्तिश्च नारायणे ॥'];
  const gold = '#ffd98a', cream = '#fff3dc';
  if (L.land) {
    const x0 = W * 0.08, col2 = W * 0.5, fsz = H * 0.043, lh = fsz * 1.45, y0 = H * 0.24;
    T(c, 'आशीर्वचन · THE TIKA BLESSING', x0, y0 - fsz * 1.6, 18 * u, 'SilkB', gold, { align: 'left', ls: 4 * u });
    lines.forEach((s, i) => T(c, s, x0 + (i % 2) * fsz * 1.5, y0 + i * lh + Math.floor(i / 2) * lh * 0.3, fsz, 'Tiro', i % 2 ? gold : cream, { align: 'left', maxW: W * 0.4 }));
    T(c, 'शुभ विजया दशमी', col2 + W * 0.05, H * 0.47, 92 * u, 'Yatra', gold, { align: 'left', maxW: W * 0.38, shadow: ['#2a0610', 0, 4 * u, 4 * u] });
    T(c, 'Long life, wealth, courage, truth and wisdom —', col2 + W * 0.05, H * 0.58, 24 * u, 'Fraunces', cream, { align: 'left', italic: true, maxW: W * 0.38 });
    T(c, 'everything this verse asks for, I wish for you.', col2 + W * 0.05, H * 0.58 + 34 * u, 24 * u, 'Fraunces', cream, { align: 'left', italic: true, maxW: W * 0.38 });
    signature(c, L, gold, col2 + W * 0.05, H * 0.76, 'left');
  } else {
    const fsz = Math.min((L.tall ? 50 : 44) * u, H * 0.5 / 14), lh = fsz * 1.5, y0 = H * (L.tall ? 0.22 : 0.17);
    T(c, 'आशीर्वचन · THE TIKA BLESSING', W / 2, y0 - 90 * u, 20 * u, 'SilkB', gold, { ls: 4 * u });
    lines.forEach((s, i) => T(c, s, W / 2, y0 + i * lh + Math.floor(i / 2) * lh * 0.25, fsz * (i % 2 ? 0.92 : 1), 'Tiro', i % 2 ? gold : cream, { maxW: W * 0.82 }));
    const yb = y0 + 8 * lh + lh * 0.75 + (L.tall ? 140 : 40) * u;
    T(c, 'शुभ विजया दशमी', W / 2, yb, (L.tall ? 120 : L.sq ? 72 : 96) * u, 'Yatra', gold, { maxW: W * 0.8, shadow: ['#2a0610', 0, 4 * u, 4 * u] });
    T(c, 'Long life, wealth, courage, truth, wisdom: all this verse asks for, I wish for you.', W / 2, yb + 56 * u, 26 * u, 'Fraunces', cream, { italic: true, maxW: W * 0.84 });
    signature(c, L, gold, W / 2, H - (L.tall ? 170 : L.sq ? 90 : 120) * u, 'center', { k: L.sq ? 0.8 : 1 });
  }
  grain(c, W, H, 0.08, 7);
};

const DESIGNS = { dashain: D, tihar: (typeof TIHAR !== 'undefined' ? TIHAR : {}) };
async function ready() { await PX.fonts([{ spec: '40px Yatra' }, { spec: '500 40px Mukta' }, { spec: '700 40px Mukta' }, { spec: '40px Tiro' }, { spec: 'italic 500 40px Fraunces', sample: 'Aa' }, { spec: '500 40px Fraunces', sample: 'Aa' }, { spec: '40px Silk', sample: 'AA' }, { spec: '40px SilkB', sample: 'AA' }, { spec: '40px PS2P', sample: 'AA' }]); }
function render(fest, name, W, H) { const cv = document.getElementById('c'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); c.clearRect(0, 0, W, H); (DESIGNS[fest] || {})[name](c, W, H); return cv; }
window.CARDS = { ready, render, list: () => Object.fromEntries(Object.entries(DESIGNS).map(([k, v]) => [k, Object.keys(v)])) };
