// "Yamapanchak": the Tihar reel. 1080x1920, 30 fps, 120 BPM (beat = 15 f, bar = 60 f), 36 bars = 2160 f (72 s).
// Cold open mid-Laxmi-Puja (one lamp lights the valley), the turn ("it begins with a crow"), Yama and Yamuna, the five
// days one by one (crow, dog, cow + Laxmi, Deusi-Bhailo, Govardhan + Mha Puja and Nepal Sambat, Bhai Tika), a montage,
// then seven colours of tika painted on the viewer that collapse into a map of Nepal made of lamps.
// Every cue is mirrored in score_tihar.py.
'use strict';
const TIHAR = (() => {
  const { P, K, hex, rng, hash, clamp, mix, prog, E, lerpC } = PX; const { T, line, typed, chapter, w, h, W, H, FPS } = ENG;
  const BEAT = 15, BAR = 60, bar = n => n * BAR, TOTAL = bar(36);
  const NP = n => String(n).replace(/\d/g, d => '०१२३४५६७८९'[d]);
  const C = { cream: '#fff4dc', gold: '#ffd25a', makh: '#ee4f8f' };
  let NEPAL = null, DOG = null;

  function caption(c, lt, t0, t1, a, b, o = {}) { const y = o.y ?? 1560;
    if (lt >= t0 - 0.1 && lt <= t1 + 0.4) { const al = clamp((lt - t0 + 0.1) * 3) * (1 - clamp((lt - t1) / 0.4)); const g = c.createLinearGradient(0, y - 160, 0, y + 180); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, `rgba(0,0,0,${0.45 * al})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, y - 160, W, 340); }
    line(c, a, lt, t0, t1, W / 2, y, o.size || 60, o.fam || 'Fraunces', o.col || C.cream, { weight: o.weight || 600, maxW: 960, shadow: ['rgba(0,0,0,.55)', 18] });
    if (b) line(c, b, lt, t0 + 0.3, t1, W / 2, y + (o.gap || 70), o.size2 || 38, 'Fraunces', o.col2 || C.gold, { italic: true, maxW: 980, shadow: ['rgba(0,0,0,.6)', 14], weight: 500 });
    if (o.c) line(c, o.c, lt, t0 + 0.6, t1, W / 2, y + (o.gap || 70) + 54, o.size2 || 38, 'Fraunces', o.col2 || C.gold, { italic: true, maxW: 980, shadow: ['rgba(0,0,0,.6)', 14], weight: 500 }); }
  function person(R, x, y, col, ph = 0, o = {}) { const { hat = false, skin = hex('#b9764a'), hair = P.ink, kid = false, skirt = false } = o; const s = kid ? 0.75 : 1, lg = Math.round(Math.sin(ph) * 1.5);
    R.line(x - 1, y, x - 1 + lg, y - 3 * s, P.ink); R.line(x + 1, y, x + 1 - lg, y - 3 * s, P.ink); R.rect(x - 2, y - 9 * s, 5, 6 * s, col); if (skirt) R.rect(x - 3, y - 5 * s, 7, 4 * s, col); R.disc(x, y - 11 * s, 2, skin); R.rect(x - 2, y - 13 * s, 5, 1, hair); if (skirt) R.rect(x + 2, y - 12 * s, 1, 5, hair);
    if (hat) { R.rect(x - 2, y - 15 * s, 5, 2, hex('#e8e0c8')); R.hline(x - 2, x + 2, y - 14 * s, P.sindoor); } }
  function night(R, seed = 1, top = P.night0, bot = P.night2) { R.vgrad(0, h, [[0, top], [0.6, P.night1], [1, bot]]); for (let i = 0; i < 90; i++) R.px(hash(i, 1, seed) * w, hash(i, 2, seed) * h * 0.65, P.white, 0.3 + 0.5 * hash(i, 3, seed)); }
  // the five-lamp day strip: one diyo per day of Tihar, lit as the days pass
  const DAYS = ['KAG', 'KUKUR', 'GAI · LAXMI', 'GORU · MHA', 'BHAI TIKA'];
  function dayStrip(R, day, t) { for (let d = 1; d <= 5; d++) { const x = 22 + (d - 1) * (w - 44) / 4; K.diyo(R, x, 26, d === day ? 1.6 : 1.1, t, d, { lit: d <= day ? 1 : 0, glow: d === day }); } }
  function dayOv(c, day, lt) { const x = (22 + (day - 1) * (w - 44) / 4) * 6; T(c, 'DAY ' + day + ' · ' + DAYS[day - 1], x, 26 * 6 + 70, 22, 'SilkB', C.gold, { align: day === 1 ? 'left' : day === 5 ? 'right' : 'center', ls: 3, alpha: clamp(lt * 3) }); }
  function smallBuffalo(R, x, y, col) { R.ellipse(x, y, 12, 6, col); R.disc(x + 11, y - 2, 4, col); R.line(x + 9, y - 6, x + 6, y - 9, col); R.line(x + 13, y - 6, x + 16, y - 9, col); for (const lx of [-8, -4, 5, 9]) R.rect(x + lx, y + 4, 2, 6, col); }
  function nepalPts(cx, cy, wd) { const x0 = 80.06, x1 = 88.2, y0 = 26.35, y1 = 30.47, k = wd / (x1 - x0), lat = Math.cos(28.3 * Math.PI / 180); return NEPAL.pts.map(([x, y]) => [cx + (x - (x0 + x1) / 2) * k, cy - (y - (y0 + y1) / 2) * k / lat * 0.97]); }
  function inPoly(pts, x, y) { let o = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) o = !o; } return o; }

  const S = []; const shot = (a, b, draw, ov, tr, td, to) => S.push({ a, b, draw, ov, tr, td, to });

  // 0. COLD OPEN: a match, one diyo, then lamp to lamp to the whole valley. f 0..180. First firework f 150.
  shot(0, 180, (R, lt, f) => {
    if (f < 60) { R.clear(hex('#05040c')); const lit = f >= 12; if (f >= 6 && f < 14) { R.glow(w / 2 + 30 - (f - 6) * 3, 170, 40, P.flame1, 0.9, 3); R.disc(w / 2 + 30 - (f - 6) * 3, 172, 2, P.flame0); }
      if (lit) R.halo(w / 2, 170, 120 * E.out(clamp((f - 12) / 20)), P.flame2, 0.35, 1.3); K.diyo(R, w / 2, 190, 6, lt, 1, { lit: lit ? E.out(clamp((f - 12) / 8)) : 0 }); }
    else if (f < 120) { R.clear(hex('#0a0614')); const k = (f - 60) / 60; R.rect(0, 200, w, h - 200, hex('#2a1a14')); R.rect(0, 200, w, 2, hex('#4a2a1a'));
      for (let i = -5; i <= 5; i++) { const x = w / 2 + i * 15, on = Math.abs(i) * 4 <= f - 60; K.diyo(R, x, 198, 2.2, lt, i + 9, { lit: on ? 1 : 0 }); } }
    else { night(R, 4, P.night0, hex('#4a2a6a')); const k = E.inOut(clamp((f - 120) / 40)); K.himal(R, 170, 18, 9, { col: hex('#1c1c46'), colD: hex('#1a1a42'), snow: hex('#5a5a96'), snowS: hex('#4a4a84'), peaks: K.fishtail(w * 0.4, 40, 16) });
      for (let i = 0; i < 200; i++) { const x = hash(i, 7) * w, y = 174 + hash(i, 8) * 70; if (x / w < k * 1.2 - 0.1 + hash(i, 9) * 0.2) { R.px(x, y, i % 5 ? P.flame1 : P.flame0); R.glow(x, y, 3, P.flame2, 0.2, 2); } }
      K.houses(R, -4, w + 4, h - 20, 17, { night: true, lit: k * 0.9, t: lt }); R.rect(0, h - 20, w, 20, P.ink); K.pagoda(R, w * 0.7, h - 22, 1.3, 3, { night: true, lit: k }); for (let x = 4; x < w * k; x += 9) K.diyo(R, x, h - 17, 0.8, lt, x);
      K.firework(R, w * 0.3, 80, (f - 150) / FPS + 0.6, P.makhL, 1, 40, 30); }
  }, (c, lt, f) => { typed(c, 'AUNSI · KARTIK · 2083 BS', lt, 0.1, 3.0, W / 2, 1720, 24, '#fff', { shadow: ['rgba(0,0,0,.5)', 8] });
    caption(c, lt, 0.5, 2.9, 'On the darkest night of the year,', null, { y: 1500 }); caption(c, lt, 3.2, 5.8, 'one lamp lights another,', 'until the whole valley is on fire.', { y: 1500 }); });

  // 1. THE TURN: "it begins with a crow". f 180..240
  shot(180, 240, (R, lt, f) => { R.clear(hex('#0a0a12')); for (let i = 0; i < 400; i++) R.px(hash(i, f % 7) * w, hash(i, 3 + f % 5) * h, hex('#1a1a2a'));
    K.crow(R, mix(-20, w + 20, lt / 2), 150 + Math.sin(lt * 4) * 8, 3, lt * 1.4); },
  (c, lt) => { caption(c, lt, 0.05, 1.9, 'But Tihar doesn’t begin with light.', 'It begins with a crow.', { y: 1300, size: 62, size2: 52 }); }, 'blocks', 6);

  // 2. YAMA AND YAMUNA. f 240..420
  shot(240, 420, (R, lt, f) => {
    R.vgrad(0, h, [[0, hex('#06101a')], [0.7, hex('#0c2a34')], [1, hex('#123a44')]]); for (let i = 0; i < 60; i++) R.px(hash(i, 4) * w, hash(i, 5) * 160, P.white, 0.4);
    K.moon(R, 140, 50, 10, 0.92, hex('#c8d8e0'));
    for (let y = 230; y < h; y++) for (let x = 0; x < w; x++) { const v = Math.sin(x * 0.12 + y * 0.6 - lt * 3) + Math.sin(x * 0.05 - lt * 1.3); R.px(x, y, v > 1.2 ? hex('#5aa0b0') : v > 0.2 ? hex('#1e5a6a') : hex('#144a58')); }
    const yx = mix(-30, 54, E.out(clamp(lt / 2.5))); smallBuffalo(R, yx, 214, hex('#04080c')); person(R, yx + 2, 208, hex('#04080c'), 0, { skin: hex('#04080c'), hair: hex('#04080c') }); R.rect(yx + 1, 192, 3, 2, P.gold);
    person(R, 130, 224, P.makh, 0, { skirt: true }); K.diyo(R, 124, 214, 0.8, lt, 3); R.halo(126, 210, 40, P.flame2, 0.3, 1.2);
    R.text('यमपञ्चक', w / 2, 120, '30px Yatra', hex('#cfe8f0'), { outline: hex('#06101a'), shadow: hex('#0c2a34'), sdx: 0, sdy: 2, a: clamp(lt * 2) });
  }, (c, lt) => { chapter(c, '01', 'THE STORY', lt, 0.1, 5.6, C.gold, 150);
    caption(c, lt, 0.4, 2.8, 'Tihar is also Yamapanchak:', 'five days of Yama, the god of death.', { y: 1520 });
    caption(c, lt, 3.0, 5.7, 'Once, Yama visited his sister Yamuna.', 'She honoured him for five days.', { y: 1520 }); }, 'dither', 10);

  // 3. DAY 1 · KAG TIHAR. f 420..540
  shot(420, 540, (R, lt, f) => {
    R.vgrad(0, h, [[0, hex('#f6c08a')], [0.5, hex('#9ad0f0')], [1, hex('#cfe6f5')]]); K.himal(R, 170, 20, 3, { peaks: K.fishtail(w * 0.7, 40, 16) }); R.rect(0, 220, w, h - 220, P.brick); R.rect(0, 216, w, 4, P.roof); R.hline(0, w, 216, P.roofL);
    for (let k = 0; k < 3; k++) { const x = 40 + k * 50; R.ellipse(x, 222, 10, 3, hex('#3a7a3a')); R.ellipse(x, 220, 7, 2, P.rice); }
    for (let i = 0; i < 4; i++) { const tx = 30 + i * 40, land = 0.6 + i * 0.4, u = E.out(clamp((lt - i * 0.3) / land)); const x = mix(w + 40 + i * 20, tx, u), y = mix(40 + i * 10, 212, u); K.crow(R, x, y, 1.8, lt * (u < 1 ? 1.2 : 0.2) + i, true); }
    dayStrip(R, 1, lt);
  }, (c, lt) => { dayOv(c, 1, lt); caption(c, lt, 0.2, 3.8, 'Day 1 · काग तिहार · Kag Tihar', 'Crows, Yama’s messengers, are fed first,', { c: 'so that no bad news reaches the house.', y: 1500, size: 54 }); }, 'wipeDown', 10);

  // 4. DAY 2 · KUKUR TIHAR: the site's own dog walks in, sits; a garland drops on; a tika appears. f 540..660
  shot(540, 660, (R, lt, f) => {
    night(R, 6, P.night0, hex('#5a2a5a')); R.rect(0, 250, w, h - 250, hex('#2a1a2a')); R.halo(w / 2, 230, 110, P.flame2, 0.4, 1.3); for (let i = 0; i < 9; i++) K.diyo(R, 10 + i * 20, 262 + (i % 2) * 4, 1.1, lt, i);
    dayStrip(R, 2, lt);
  }, (c, lt, f) => { dayOv(c, 2, lt);
    const walk = clamp(lt / 1.6), gx = mix(-150, W / 2 + 60, E.out(walk)), gy = 250 * 6, ds = 7; DOG.draw(c, gx, gy, ds, walk < 1 ? 'walk' : 'sit', lt, { wag: walk < 1 ? 0 : 0.5, mouth: 'pant' });
    if (lt > 1.8) { const R2 = new PX.Raster(Math.ceil(W / ds), Math.ceil(H / ds)), hx = gx / ds, hy = gy / ds, drop = E.out(clamp((lt - 1.8) / 0.5)), dy = (1 - drop) * -60;
      for (let k = 0; k <= 14; k++) { const a = Math.PI * (0.08 + k / 14 * 0.84), x = hx + 7.5 + Math.cos(a) * 7, y = hy - 33 + Math.sin(a) * 8.5 + dy; k % 3 === 1 ? (R2.disc(x, y, 1.6, P.makhD), R2.disc(x, y, 1.1, P.makh)) : K.marigold(R2, x, y, 1.8, k); }
      if (lt > 2.6) { R2.ellipse(hx + 14.5, hy - 40, 1.2, 1.6, P.sindoor); R2.px(hx + 14.1, hy - 40.9, P.sindoorL); } R2.blit(c, ds); }
    caption(c, lt, 0.2, 3.8, 'Day 2 · कुकुर तिहार · Kukur Tihar', 'The Rig Veda gives Yama two four-eyed dogs.', { c: 'Today every dog gets a garland, a tika and a feast.', y: 1580, size: 54 }); }, 'dither', 10);

  // 5. DAY 3 · GAI TIHAR (bar 11), then LAXMI PUJA (bars 12-14). f 660..900
  shot(660, 720, (R, lt, f) => {
    R.vgrad(0, h, [[0, P.sky1], [1, P.sky3]]); K.hills(R, 190, 20, 4, [P.hill2, P.hill1]); R.rect(0, 220, w, h - 220, P.hill3);
    const cx = w / 2, cy = 210, s = 2; R.ellipse(cx, cy + 1 * s, 16 * s, 9 * s, hex('#f0ece4')); R.disc(cx - 17 * s, cy - 4 * s, 6 * s, hex('#f0ece4')); R.line(cx - 21 * s, cy - 10 * s, cx - 23 * s, cy - 14 * s, hex('#c0a070')); R.line(cx - 13 * s, cy - 10 * s, cx - 11 * s, cy - 14 * s, hex('#c0a070'));
    R.disc(cx + 4 * s, cy, 3 * s, hex('#8a6a4a')); for (const lx of [-12, -6, 6, 12]) R.rect(cx + lx * s, cy + 8 * s, 2 * s, 9 * s, hex('#d0c8bc')); R.disc(cx - 17 * s, cy - 6 * s, 1.5 * s, P.sindoor); R.px(cx - 20 * s, cy - 4 * s, P.ink);
    for (let k = 0; k <= 12; k++) { const a = Math.PI * (0.1 + k / 12 * 0.8); K.marigold(R, cx - 12 * s + Math.cos(a) * 8 * s, cy - 2 * s + Math.sin(a) * 6 * s, 2, k); } dayStrip(R, 3, lt);
  }, (c, lt) => { dayOv(c, 3, lt); caption(c, lt, 0.1, 1.8, 'Day 3 · गाई तिहार · Gai Tihar', 'The cow, a form of Laxmi, is worshipped at dawn.', { y: 1560, size: 54 }); }, 'iris', 10);
  shot(720, 900, (R, lt, f) => {
    R.clear(hex('#3a1a12')); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x * 3 + y * 7) % 11 === 0) R.px(x, y, hex('#42201a'));
    const cx = w / 2, cy = 150, rad = 62, k = E.out(clamp(lt / 1.6)); R.halo(cx, cy, rad * 1.6 * k, P.flame2, 0.35, 1.2); K.rangoli(R, cx, cy, rad, k, lt, { spin: true });
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, on = lt > 1.6 + i * 0.06; K.diyo(R, cx + Math.cos(a) * (rad + 9), cy + Math.sin(a) * (rad + 9), 1, lt, i, { lit: on ? 1 : 0 }); }
    const steps = Math.min(6, Math.floor((f - 720 - 60) / BEAT)); for (let s2 = 0; s2 < steps; s2++) { const y = h - 10 - s2 * 18, x = cx + (s2 % 2 ? 6 : -6); if (y < cy + rad + 16) break; R.ellipse(x, y, 3, 4.5, P.sindoor); R.disc(x, y - 6, 1.5, P.sindoor); for (let t = -1; t <= 1; t++) R.px(x + t * 2, y - 8, P.sindoorL); }
    if (lt > 4.2) for (let i = 0; i < 12; i++) { const a = hash(i, 2) * 6.28, d = hash(i, 3) * rad * 0.4; R.px(cx + Math.cos(a) * d, cy + Math.sin(a) * d, (Math.floor(lt * 10) + i) % 3 ? P.goldL : P.white); }
    dayStrip(R, 3, lt);
  }, (c, lt) => { dayOv(c, 3, lt); caption(c, lt, 0.3, 2.9, 'Night: लक्ष्मी पूजा · Laxmi Puja', 'Rangoli at the door, a lamp in every window.', { y: 1300, size: 54 });
    caption(c, lt, 3.1, 5.8, 'Footprints are painted in from the street,', 'so the goddess of wealth finds her way home.', { y: 1300, size: 50 }); }, 'dither', 10);

  // 6. DEUSI-BHAILO: call and response, door to door. f 900..1080 (calls on every other beat)
  const CALLS = ['भैलो!', 'भैलो!', 'देउसी रे!', 'देउसी रे!', 'देउसी रे!', 'देउसी रे!'];
  shot(900, 1080, (R, lt, f) => {
    night(R, 8); R.rect(0, 222, w, h - 222, hex('#1a1426')); const bx = 110; R.rect(bx, 122, 60, 100, P.brick); R.rect(bx + 22, 172, 16, 50, P.wood); R.rect(bx + 24, 174, 12, 46, hex('#ffb35a')); R.halo(bx + 30, 197, 60, P.flame2, 0.35, 1.2);
    R.rect(bx - 2, 118, 64, 4, P.roof); bulbs(R, 0, 92, bx, 122, 8, lt, 2); bulbs(R, bx + 60, 122, w, 92, 8, lt, 4); for (let i = 0; i < 5; i++) K.diyo(R, bx + 4 + i * 13, 224, 0.8, lt, i);
    const girls = f < 960; const beat = Math.floor((f - 900) / BEAT), bounce = (f - 900) % BEAT < 4 ? -2 : 0;
    for (let k = 0; k < 6; k++) { const x = 16 + k * 14, b2 = (k + beat) % 2 ? bounce : 0; person(R, x, 236 + b2, girls ? [P.makh, P.mari, P.teal][k % 3] : [hex('#2a3a6a'), P.white, hex('#5a3a2a')][k % 3], 0, { skirt: girls, hat: !girls && k % 2 === 0 }); }
    if (!girls) { const mx = 16 + 2 * 14; R.ellipse(mx + 4, 228, 6, 3, hex('#7a3a1a')); R.ellipse(mx - 2, 228, 2, 3, hex('#e0c890')); R.ellipse(mx + 10, 228, 2, 3, hex('#e0c890')); }
  }, (c, lt, f) => { chapter(c, '02', 'DEUSI · BHAILO', lt, 0.1, 5.6, C.gold, 150); const i = Math.floor((f - 900) / 30), lf = (f - 900) % 30, u = E.back(clamp(lf / 6));
    T(c, CALLS[Math.min(5, i)], W / 2 - 120 + (i % 2) * 240, 560 + (i % 2) * 120, 120 * u, 'Yatra', i < 2 ? C.makh : C.gold, { shadow: ['rgba(0,0,0,.7)', 0, 8, 8], alpha: 1 - clamp((lf - 20) / 10) });
    caption(c, lt, 0.2, 5.7, 'Then the singing starts.', 'Girls sing Bhailo, boys sing Deusi, door to door,', { c: 'and every house answers with sel roti and a blessing.', y: 1620, size: 54 }); }, 'blocks', 10);
  function bulbs(R, x0, y0, x1, y1, sag, t = 0, seed = 0) { const cols = [P.flame1, P.makhL, P.teal, P.lime, P.flame2, hex('#7cbcf4')], n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 4);
    for (let i = 0; i <= n; i++) { const u = i / n, x = mix(x0, x1, u), y = mix(y0, y1, u) + Math.sin(u * Math.PI) * sag; const c = cols[(i + seed + Math.floor(t * 4)) % cols.length]; R.px(x, y, c); R.glow(x, y, 3, c, 0.25, 2); } }

  // 7. DAY 4: Govardhan (bars 18-19), then Mha Puja and Nepal Sambat 1147 (bar 20). f 1080..1260
  shot(1080, 1200, (R, lt, f) => {
    R.vgrad(0, h, [[0, hex('#1a2030')], [1, hex('#3a4a5a')]]); if (hash(Math.floor(lt * 5), 9) > 0.85) R.rect(0, 0, w, h, hex('#c8d8f0'), 0.35);
    R.rect(0, 250, w, h - 250, hex('#2a3a2a')); const lift = E.out(clamp((lt - 0.6) / 1.2)), hy = mix(250, 150, lift);
    R.poly([[20, hy], [w - 20, hy], [w * 0.65, hy - 50], [w * 0.4, hy - 56]], hex('#4a5a3a')); R.poly([[30, hy], [w * 0.5, hy], [w * 0.42, hy - 48]], hex('#5a6a42')); for (let k = 0; k < 12; k++) R.px(30 + k * 12, hy - 8 - (k % 3) * 6, P.hill3);
    if (lift > 0) { R.line(w / 2, 250, w / 2, hy + 2, hex('#2a4a8a')); person(R, w / 2, 250, hex('#2a4a8a'), 0, { skin: hex('#3a5a9a') }); R.line(w / 2, 238, w / 2, hy + 1, hex('#3a5a9a'));
      for (let k = 0; k < 6; k++) person(R, 40 + k * 20 + (k > 2 ? 30 : 0), 250, [P.mari, P.white, P.makh, P.teal, P.gold, P.sindoor][k], 0, { kid: k % 2 === 1 }); smallBuffalo(R, 150, 244, hex('#d0c8bc')); }
    for (let i = 0; i < 160; i++) { const x = (hash(i, 1) * w + lt * 30) % w, y = (hash(i, 2) * h + lt * 400 * (0.8 + hash(i, 3) * 0.4)) % h; if (lift > 0.5 && x > 20 && x < w - 20 && y > hy - 50 && y < 250) continue; R.vline(x, y, y + 4, hex('#9ab0d0'), 0.7); }
    dayStrip(R, 4, lt);
  }, (c, lt) => { dayOv(c, 4, lt); caption(c, lt, 0.2, 3.8, 'Day 4 · गोरु तिहार · Govardhan Puja', 'Oxen are honoured, and Krishna is remembered', { c: 'lifting a whole hill to shelter a village from the storm.', y: 1560, size: 52 }); }, 'wipeUp', 10);
  shot(1200, 1260, (R, lt, f) => {
    R.clear(hex('#2a0e1a')); R.halo(w / 2, 150, 120, P.gold, 0.3, 1.2); K.rangoli(R, w / 2, 170, 44, 1, lt, { spin: true, cols: [P.sindoor, P.gold, P.white, P.teal, P.makh, P.mari, P.lime] }); K.diyo(R, w / 2, 172, 1.4, lt, 2); dayStrip(R, 4, lt);
  }, (c, lt, f) => { dayOv(c, 4, lt); const flip = E.inOut(clamp((lt - 0.6) / 0.5)), y = 1500;
    T(c, 'NEPAL SAMBAT', W / 2, 1300, 30, 'SilkB', C.gold, { ls: 6 }); c.save(); c.beginPath(); c.rect(0, 1320, W, 160); c.clip(); T(c, '1146', W / 2, 1440 - flip * 150, 130, 'SilkB', C.cream, { ls: 10, alpha: 1 - flip }); T(c, '1147', W / 2, 1440 + (1 - flip) * 150, 130, 'SilkB', C.gold, { ls: 10, alpha: flip }); c.restore();
    caption(c, lt, 0.1, 1.9, 'म्ह पूजा · Mha Puja: the Newar worship of the self,', 'and the new year of Nepal Sambat.', { y: 1640, size: 46 }); }, 'dither', 8);

  // 8. DAY 5 · BHAI TIKA: oil line, seven colours (one per beat from bar 22), the makhamali that never wilts. f 1260..1560
  const SEVEN = ['#d7192a', '#ff8a1c', '#ffd400', '#2fae4a', '#1f7ae0', '#2a2aa8', '#8a2be2'];
  shot(1260, 1560, (R, lt, f) => {
    R.clear(hex('#1a0a24')); R.halo(w / 2, 150, 140, hex('#ff8a5a'), 0.25, 1.2); const cx = w / 2, cy = 160, sk = hex('#b47a52'), sd = hex('#8a5636');
    R.ellipse(cx, cy + 10, 62, 76, sd); R.ellipse(cx, cy + 8, 60, 74, sk); R.ellipse(cx, cy - 56, 64, 30, P.ink); R.rect(cx - 64, cy - 56, 128, 18, P.ink);
    R.hline(cx - 34, cx - 14, cy + 12, sd); R.hline(cx + 14, cx + 34, cy + 12, sd); R.hline(cx - 34, cx - 14, cy + 13, P.ink); R.hline(cx + 14, cx + 34, cy + 13, P.ink);   // eyes closed
    const n = clamp(Math.floor((f - 1320) / BEAT) + 1, 0, 7); for (let k = 0; k < n; k++) { const x = cx - 10 + k * 3, hh = 34 - Math.abs(k - 3) * 2, u = k === n - 1 ? E.out(clamp(((f - 1320) % BEAT) / 6)) : 1; R.rect(x, cy - 40, 3, hh * u, hex(SEVEN[k])); R.px(x, cy - 40, P.white, 0.4); }
    if (f >= 1440) { const k = E.out(clamp((f - 1440) / 24)); for (let i = 0; i <= 26; i++) { const a = Math.PI * (0.05 + i / 26 * 0.9), x = cx + Math.cos(a) * 66, y = cy + 64 + Math.sin(a) * 30 - (1 - k) * 200; R.disc(x, y, 3.4, P.makhD); R.disc(x - 0.5, y - 0.5, 2.6, P.makh); R.px(x - 1, y - 1, P.makhL); } }
    if (f >= 1500) { const k = clamp((f - 1500) / 10); R.ellipse(30, 280, 9, 7, hex('#8a6a3a')); if (k >= 1) { R.ellipse(26, 280, 5, 7, hex('#8a6a3a')); R.ellipse(36, 282, 5, 7, hex('#7a5a2a')); } }
    const ring = E.out(clamp((f - 1260) / 40)); R.ring(cx, cy + 20, 86 * ring + 2, hex('#c8a040'), 1, 0.8);
    dayStrip(R, 5, lt);
  }, (c, lt, f) => { dayOv(c, 5, lt);
    caption(c, lt, 0.2, 1.9, 'Day 5 · भाइटीका · Bhai Tika', 'A sister draws a line of oil around her brother.', { y: 1500, size: 54 });
    caption(c, lt, 2.1, 5.1, 'Then seven colours of tika.', null, { y: 1500, size: 54 });
    caption(c, lt, 5.6, 9.8, 'Yamuna asked Yama to stay', 'until the tika faded and the makhamali wilted.', { c: 'Makhamali never wilts.', y: 1500, size: 54 }); }, 'iris', 12);

  // 9. MONTAGE: six beat-cuts of 30 f. f 1560..1740
  const VIG = [
    ['SEL ROTI', 'rings of rice dough in hot ghee', (R, t) => { R.clear(hex('#2a1a10')); R.ellipse(w / 2, 170, 70, 40, hex('#3a3a3a')); R.ellipse(w / 2, 168, 64, 34, hex('#c8902a'));
      for (let i = 0; i < 40; i++) { const a = hash(i, 1) * 6.28, d = hash(i, 2) * 30; R.px(w / 2 + Math.cos(a) * d * 2, 168 + Math.sin(a) * d, (Math.floor(t * 20) + i) % 3 ? hex('#e8b84a') : P.white); }
      for (let k = 0; k < 3; k++) { const x = w / 2 - 30 + k * 30; R.ring(x, 168, 10, hex('#8a4a1a'), 3); R.ring(x, 168, 9, hex('#c8762a'), 1); } }],
    ['PATAKA', 'crackers on every street', (R, t) => { night(R, 11); for (let k = 0; k < 5; k++) K.firework(R, 30 + k * 30, 60 + (k % 2) * 40, t + 0.6 + k * 0.08, [P.makhL, P.flame1, P.teal, P.lime, P.white][k], k, 30, 24); K.houses(R, -4, w + 4, h, 21, { night: true, lit: 0.8, t }); }],
    ['JHILIMILI', 'bulbs that blink all night', (R, t) => { night(R, 12); for (let k = 0; k < 7; k++) bulbs(R, 0, 40 + k * 32, w, 50 + k * 32, 10, t * 2, k); }],
    ['MALA', 'marigold, makhamali, on every door', (R, t) => { R.clear(hex('#3a1a12')); for (let k = 0; k < 6; k++) K.garland(R, 0, 30 + k * 44, w, 30 + k * 44, 16, 3, t + k); }],
    ['RANGOLI', 'colour on every doorstep', (R, t) => { R.clear(hex('#2a120c')); K.rangoli(R, w / 2, 160, 80, 1, t, { spin: true }); }],
    ['GHAR', 'and someone waiting at home', (R, t) => { night(R, 13); K.houses(R, -4, w + 4, 280, 31, { night: true, lit: 1, t }); for (let x = 4; x < w; x += 9) K.diyo(R, x, 284, 0.8, t, x); }],
  ];
  shot(1560, 1740, (R, lt, f) => { const i = Math.min(5, Math.floor((f - 1560) / 30)); VIG[i][2](R, (f - 1560 - i * 30) / FPS + i * 0.2); },
    (c, lt, f) => { const i = Math.min(5, Math.floor((f - 1560) / 30)), lf = f - 1560 - i * 30, u = E.back(clamp(lf / 5)); chapter(c, '03', 'TIHAR', lt, 0, 6, C.gold, 150);
      T(c, VIG[i][0], W / 2, 1600, 110 * u, 'SilkB', '#fff', { ls: 10, maxW: 980, shadow: ['rgba(0,0,0,.6)', 0, 8, 8] }); T(c, VIG[i][1], W / 2, 1680, 40, 'Fraunces', C.cream, { italic: true, alpha: clamp(lf / 5), shadow: ['rgba(0,0,0,.6)', 12] }); }, 'blocks', 8);

  // 10. POV: seven colours painted onto the viewer, one per beat. f 1740..1860
  shot(1740, 1860, (R, lt, f) => {
    R.clear(hex('#1a0a24')); R.halo(w / 2, h / 2, 160, hex('#ff8a5a'), 0.3, 1.2); const n = clamp(Math.floor((f - 1755) / BEAT) + 1, 0, 7);
    for (let k = 0; k < n; k++) { const u = k === n - 1 ? E.inOut(clamp(((f - 1755) % BEAT) / 10)) : 1, x0 = Math.round(k * w / 7); R.rect(x0, 0, Math.ceil(w / 7) + 1, h * u, hex(SEVEN[k])); for (let y = 0; y < h * u; y += 3) R.px(x0 + (y * 7) % Math.ceil(w / 7), y, P.white, 0.25); }
  }, (c, lt, f) => { if (f < 1800) caption(c, lt, 0.1, 1.9, 'And these seven', 'are for you.', { y: 1500 }); }, 'dither', 10);

  // 11. FINALE: the colours collapse into lamps that draw Nepal; the wish. f 1860..2160 (map lit by bar 33, last firework bar 34)
  let LAMPS = null;
  function lamps() { if (LAMPS) return LAMPS; const pts = nepalPts(w / 2, 150, 170), out = [], n = pts.length;
    for (let i = 0; i < n; i += 9) out.push({ x: pts[i][0], y: pts[i][1], edge: true, t: i / n });
    for (let y = 120; y < 185; y += 6) for (let x = 6; x < w - 6; x += 6) { const xx = x + (Math.floor(y / 6) % 2) * 3; if (inPoly(pts, xx, y)) out.push({ x: xx, y, edge: false, t: hash(xx, y) }); }
    return (LAMPS = { pts, out }); }
  shot(1860, 2160, (R, lt, f) => {
    night(R, 21, P.night0, hex('#3a1a4a')); const { pts, out } = lamps(), k1 = clamp((f - 1860) / 40), k2 = clamp((f - 1900) / 60), k3 = clamp((f - 1960) / 60);
    for (let k = 0; k < 7; k++) { const x0 = k * w / 7, a = 1 - k1; if (a > 0) R.rect(x0, 0, Math.ceil(w / 7) + 1, h * (1 - E.in(k1)), hex(SEVEN[k])); }
    for (let i = 0; i < pts.length; i++) { const [a, b] = pts[i], [c2, d] = pts[(i + 1) % pts.length]; if (i / pts.length < k2) R.line(a, b, c2, d, hex('#3a2a5a')); }
    for (const L of out) { const on = L.edge ? L.t < k2 : L.t < k3; if (on) { const fl = 0.75 + 0.25 * Math.sin(lt * 9 + L.x * 1.7 + L.y); R.px(L.x, L.y, L.edge ? P.flame0 : P.flame1); R.px(L.x, L.y - 1, P.flame2, fl); R.glow(L.x, L.y, 4, P.flame2, 0.18 * fl, 2); } }
    const ktm = [w / 2 + (85.32 - 84.13) * 170 / 8.14, 150 - (27.71 - 28.41) * 170 / 8.14 / Math.cos(28.3 * Math.PI / 180) * 0.97];
    if (f >= 2040) K.firework(R, ktm[0], ktm[1] - 50, (f - 2040) / FPS, P.makhL, 5, 44, 36); if (f >= 2070) K.firework(R, ktm[0] - 50, ktm[1] - 70, (f - 2070) / FPS, P.flame1, 6, 36, 28); if (f >= 2085) K.firework(R, ktm[0] + 40, ktm[1] - 80, (f - 2085) / FPS, P.teal, 7, 30, 24);
    for (let x = 4; x < w; x += 9) K.diyo(R, x, h - 8, 0.8, lt, x, { lit: clamp((f - 1990 - x * 0.3) / 6) });
  }, (c, lt, f) => {
    const a = E.back(clamp((f - 1990) / 14)); if (a > 0.02) T(c, 'शुभ दीपावली', W / 2, 1360, 150 * a, 'Yatra', C.gold, { shadow: ['rgba(0,0,0,.7)', 0, 8, 8] });
    line(c, 'Happy Tihar ' + 2083, lt, 4.6, 12, W / 2, 1470, 58, 'Fraunces', C.cream, { weight: 600, shadow: ['rgba(0,0,0,.7)', 14] });
    line(c, 'One lamp lit another.', lt, 5.4, 12, W / 2, 1580, 46, 'Fraunces', C.gold, { italic: true, weight: 500 }); line(c, 'That is the whole festival.', lt, 6.0, 12, W / 2, 1640, 46, 'Fraunces', C.gold, { italic: true, weight: 500 });
    if (lt > 7.2) { const u = E.out(clamp((lt - 7.2) / 0.6)); T(c, '— Nikit Hamal', W / 2, 1790, 54, 'Fraunces', '#fff', { italic: true, weight: 600, alpha: u }); T(c, 'NIKIT.IS-A.DEV', W / 2, 1846, 24, 'SilkB', C.gold, { ls: 6, alpha: u }); }
  }, 'cut', 0);

  function overlay(c, f) { const a = Math.max(1 - f / 4, prog(f, TOTAL - 18, TOTAL)); if (a > 0) { c.fillStyle = `rgba(0,0,0,${a})`; c.fillRect(0, 0, W, H); } }
  function shake(f) { for (const s of [150, 2040]) { const d = f - s - 18; if (d >= 0 && d < 8) return 3 * (1 - d / 8); } const g = f - 1100; if (g >= 0 && g < 30 && hash(Math.floor(g / 3), 9) > 0.85) return 2; return 0; }
  async function load() { NEPAL = await (await fetch('../lib/nepal.json')).json(); DOG = LIB.dogKit('shiba'); }
  return ENG.make({ shots: S, total: TOTAL, overlay, shake, load });
})();
