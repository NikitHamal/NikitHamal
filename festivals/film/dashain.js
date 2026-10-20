// "Vijaya": the Dashain reel. 1080x1920, 30 fps, 100 BPM (beat = 18 f, bar = 72 f), 31 bars = 2232 f (74.4 s).
// Cold open mid-fight (a kite gets cut), rewind 1,500 years to the Devi Mahatmya, Durga and Mahishasura, nine nights,
// the meaning of Vijaya Dashami, Nepal's Bada Dashain day by day, life during Dashain, then a tika placed on the viewer
// and the cut kite flying again. Every cue here is mirrored in score_dashain.py (CUES).
'use strict';
const DASHAIN = (() => {
  const { P, K, hex, rng, hash, clamp, mix, prog, E, fbm, lerpC } = PX; const { T, line, typed, chapter, w, h, W, H, FPS } = ENG;
  const BEAT = 18, BAR = 72, bar = n => n * BAR;
  const CUT = bar(2), TOTAL = bar(31);
  const NP = n => String(n).replace(/\d/g, d => '०१२३४५६७८९'[d]);
  const C = { cream: '#fff4dc', gold: '#ffd98a', red: '#ff5a4a', ink: '#1a1220', sky: '#0b2a55' };
  let NEPAL = null;

  // ---------- shared bits
  function sky(R, oy = 0, k = 1) { R.vgrad(0, h, [[0, P.sky0], [0.5, P.sky1], [0.85, P.sky2], [1, P.sky3]]); }
  function clouds(R, t, oy = 0, seed = 1, n = 6) { const r = rng(seed); for (let i = 0; i < n; i++) { const x = ((r() * 260 + t * (4 + r() * 6)) % 260) - 40, y = r() * h * 1.4 - oy * (0.5 + r() * 0.5); const yy = ((y % (h + 80)) + h + 80) % (h + 80) - 40; K.cloud(R, x, yy, 0.7 + r() * 0.7); } }
  function sparks(R, x, y, t, n = 10, seed = 0) { for (let i = 0; i < n; i++) { const a = hash(i, Math.floor(t * 30), seed) * 6.28, d = hash(i, Math.floor(t * 30) + 1, seed) * 6; R.px(x + Math.cos(a) * d, y + Math.sin(a) * d, i % 3 ? P.gold : P.white); } }
  // the 15-day lunar strip: Pratipada to Purnima, today highlighted
  function moonStrip(R, day, y = 22, t = 0) { const x0 = 12, dx = (w - 24) / 14; for (let d = 1; d <= 15; d++) { const x = x0 + (d - 1) * dx, on = d === day, past = d < day;
    if (on) R.halo(x, y, 9, P.gold, 0.6, 1); K.moon(R, x, y, on ? 4 : 3, Math.min(0.5, d / 30), on ? P.goldL : past ? P.paper : hex('#7a86a8'), on ? hex('#3a2a10') : hex('#1a2040')); } }
  function stripOv(c, day, lt, label) { const x0 = 12 * 6, dx = (w - 24) / 14 * 6; T(c, 'DAY ' + day + ' / 15', x0 + (day - 1) * dx, 22 * 6 + 64, 22, 'SilkB', C.gold, { align: day > 12 ? 'right' : day < 3 ? 'left' : 'center', ls: 3, alpha: clamp(lt * 3) }); }
  function caption(c, lt, t0, t1, a, b, o = {}) { const y = o.y ?? 1560; if (lt >= t0 - 0.1 && lt <= t1 + 0.4 && o.back !== false) { const al = clamp((lt - t0 + 0.1) * 3) * (1 - clamp((lt - t1) / 0.4)); const g = c.createLinearGradient(0, y - 160, 0, y + 180); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, `rgba(0,0,0,${0.42 * al})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, y - 160, W, 340); } line(c, a, lt, t0, t1, W / 2, y, o.size || 64, o.fam || 'Fraunces', o.col || C.cream, { weight: o.weight || 600, maxW: 960, shadow: ['rgba(0,0,0,.55)', 18] });
    if (b) line(c, b, lt, t0 + 0.35, t1, W / 2, y + (o.gap || 72), o.size2 || 40, o.fam2 || 'Fraunces', o.col2 || C.gold, { italic: true, maxW: 960, shadow: ['rgba(0,0,0,.6)', 14], weight: 500 }); }
  // buffalo-demon silhouette (head and horns, shoulders), centred on (cx, cy), scale s
  function buffalo(R, cx, cy, s, col, t = 0, eye = P.sindoorL) { const br = 1 + Math.sin(t * 2.4) * 0.02;
    R.ellipse(cx, cy + 40 * s, 70 * s * br, 40 * s, col); R.ellipse(cx, cy, 30 * s, 28 * s * br, col); R.ellipse(cx, cy + 22 * s, 20 * s, 16 * s, col);
    for (const sd of [-1, 1]) { for (let k = 0; k <= 48; k++) { const u = k / 48, a = mix(0.15, 2.6, Math.pow(u, 1.25)), r = 34 * s; const x = cx + sd * (20 * s + Math.sin(a) * r * 1.5 * (1 - u * 0.15)), y = cy - 6 * s - (1 - Math.cos(a)) * r * 0.75 + u * 6 * s; R.disc(x, y, (8 - u * 7.2) * s, col); }
      R.poly([[cx + sd * 24 * s, cy - 2 * s], [cx + sd * 46 * s, cy + 6 * s], [cx + sd * 28 * s, cy + 12 * s]], col); }
    for (const sd of [-1, 1]) { R.glow(cx + sd * 11 * s, cy + 2 * s, 10 * s, eye, 0.7, 4); R.rect(cx + sd * 11 * s - 2 * s, cy + 1 * s, 4 * s, Math.max(1, 1.5 * s), eye); }
    R.ellipse(cx - 6 * s, cy + 30 * s, 2.4 * s, 1.6 * s, hex('#000000')); R.ellipse(cx + 6 * s, cy + 30 * s, 2.4 * s, 1.6 * s, hex('#000000')); }
  function nepalPts(cx, cy, wd) { const pts = NEPAL.pts, x0 = 80.06, x1 = 88.2, y0 = 26.35, y1 = 30.47, k = wd / (x1 - x0), lat = Math.cos(28.3 * Math.PI / 180);
    return pts.map(([x, y]) => [cx + (x - (x0 + x1) / 2) * k * lat / lat, cy - (y - (y0 + y1) / 2) * k / lat * 0.97]); }
  const geo = (cx, cy, wd, lon, la) => { const x0 = 80.06, x1 = 88.2, y0 = 26.35, y1 = 30.47, k = wd / (x1 - x0), lat = Math.cos(28.3 * Math.PI / 180); return [cx + (lon - (x0 + x1) / 2) * k, cy - (la - (y0 + y1) / 2) * k / lat * 0.97]; };
  // a little pixel person: body colour, facing, walk phase
  function person(R, x, y, col, ph = 0, o = {}) { const { hat = false, skin = hex('#b9764a'), hair = P.ink, kid = false } = o; const s = kid ? 0.75 : 1, lg = Math.round(Math.sin(ph) * 1.5);
    R.line(x - 1, y, x - 1 + lg, y - 3 * s, P.ink); R.line(x + 1, y, x + 1 - lg, y - 3 * s, P.ink); R.rect(x - 2, y - 9 * s, 5, 6 * s, col); R.disc(x, y - 11 * s, 2, skin); R.rect(x - 2, y - 13 * s, 5, 1, hair);
    if (hat) { R.rect(x - 2, y - 15 * s, 5, 2, hex('#e8e0c8')); R.hline(x - 2, x + 2, y - 14 * s, P.sindoor); } }

  // ---------- shots
  const S = [];
  const shot = (a, b, draw, ov, tr, td, to) => S.push({ a, b, draw, ov, tr, td, to });

  // 0. COLD OPEN: a kite fight in progress. f 0..216. The cut lands on bar 2 (CUT).
  const kiteA = t => [w * 0.36 + Math.sin(t * 1.3) * 10, 120 + Math.sin(t * 1.9) * 8, -0.25 + Math.sin(t * 2.1) * 0.15];
  const kiteB = t => [w * 0.68 + Math.sin(t * 1.6 + 1) * 9, 92 + Math.sin(t * 2.3) * 7, 0.3 + Math.sin(t * 1.7) * 0.15];
  shot(0, 216, (R, lt, f) => {
    const cut = (f - CUT) / FPS, cam = cut > 0 ? E.in(clamp(cut / 2.4)) * 220 : 0;
    sky(R); clouds(R, lt, -cam * 0.6, 3, 7);
    const hz = h + 40 - cam * 0.25; if (hz < h + 30) { K.himal(R, hz, 40, 7, { peaks: K.fishtail(w * 0.6, 60, 22) }); }
    const [ax, ay, aa] = kiteA(lt); let [bx, by, ba] = kiteB(lt);
    const X = [w * 0.53 + Math.sin(lt * 2) * 3, 190 + Math.sin(lt * 1.4) * 4];   // where the two strings cross and saw
    if (cut <= 0) { R.line(ax, ay + 8, X[0], X[1], hex('#26304a')); R.line(X[0], X[1], w * 0.25, h + 5, hex('#26304a')); R.line(bx, by + 8, X[0], X[1], hex('#3a3a6a')); R.line(X[0], X[1], w * 0.85, h + 5, hex('#3a3a6a'));
      const saw = prog(f, 60, CUT); sparks(R, X[0], X[1], lt, Math.round(4 + saw * 14)); R.halo(X[0], X[1], 6 + saw * 10, P.gold, 0.5, 1); }
    else { const ry = cam; R.oy = -ry; R.line(ax, ay + 8, X[0], X[1] + 30, hex('#26304a')); R.line(X[0], X[1] + 30, w * 0.25, h + 5 + ry, hex('#26304a')); R.oy = 0;
      bx += cut * 14 + Math.sin(cut * 5) * 6; by += cut * 30 - cam; ba += cut * 5 + cut * cut * 2; const loose = Math.max(0, 40 - cut * 10); R.line(bx, by + 8, bx - 10, by + 8 + loose, hex('#3a3a6a')); }
    if (cut <= 0 || ay - cam > -30) K.kite(R, ax, ay - cam, 3.2, P.sindoor, P.gold, aa, lt);
    K.kite(R, bx, by, 3.0, hex('#2a6fdb'), P.white, ba, lt * 1.3);
    if (cut >= 0 && cut < 0.12) R.glow(X[0], X[1], 60, P.white, 1, 3);
    if (cut > 0 && cut < 1.1) { const k = E.back(clamp(cut / 0.25)), fs = Math.round(60 * k); if (fs > 4) R.text('चेट!', w / 2, 96, `${fs}px Yatra`, P.white, { outline: P.ink, shadow: P.sindoor, sdx: 3, sdy: 3, a: 1 - prog(cut, 0.8, 1.1) }); }
    for (let i = 0; i < 5; i++) K.bird(R, 20 + i * 9 + lt * 8, 40 + (i % 2) * 4 - cam * 0.3, lt + i);
  }, (c, lt, f) => {
    typed(c, 'ASHOJ · KATHMANDU VALLEY · 2083 BS', lt, 0.15, 3.6, W / 2, 1720, 24, '#fff', { shadow: ['rgba(0,0,0,.5)', 8] });
    caption(c, lt, 0.5, 3.9, 'Every autumn,', 'a whole nation looks up.', { y: 1520 });
    caption(c, lt, 5.0, 6.9, 'One string wins.', 'One kite goes free.', { y: 1560 });
  });

  // 1. REWIND: the cut kite tumbles down through the sky, which drains into the deep past. f 216..288
  shot(216, 288, (R, lt, f) => {
    const k = lt / 2.4; R.vgrad(0, h, [[0, lerpC(P.sky1, hex('#2a1a10'), k)], [1, lerpC(P.sky3, hex('#6a4020'), k)]]);
    for (let i = 0; i < 40; i++) { const x = hash(i, 1) * w, y = ((hash(i, 2) * h - lt * 600 * (0.5 + hash(i, 3))) % h + h) % h; R.vline(x, y, y + 6 + hash(i, 4) * 12, lerpC(P.white, hex('#ffcf8a'), k), 0.6); }
    K.kite(R, w / 2 + Math.sin(lt * 3) * 12, h * 0.42, 3.0, lerpC(hex('#2a6fdb'), hex('#c08a4a'), k), lerpC(P.white, P.paper, k), lt * 9, lt);
  }, (c, lt) => { const yr = Math.round(2026 - (2026 - 500) * E.inOut(clamp((lt - 0.2) / 1.9)));
    T(c, yr > 999 ? String(yr) : yr + ' CE', W / 2, 1180, 150, 'SilkB', C.cream, { ls: 8, shadow: ['rgba(0,0,0,.5)', 0, 8, 8] }); typed(c, 'REWIND ~1,500 YEARS', lt, 0.1, 2.3, W / 2, 1290, 30, C.gold); }, 'dither', 10);

  // 2. THE TEXT: palm-leaf folios of the Devi Mahatmya stack up, one per beat. f 288..432
  shot(288, 432, (R, lt, f) => {
    R.vgrad(0, h, [[0, hex('#2a1a10')], [1, hex('#4a2c16')]]); R.halo(w / 2, h * 0.45, 140, hex('#ffcf8a'), 0.35, 1.2);
    const n = Math.min(7, 1 + Math.floor(lt / 0.6)); for (let i = 0; i < n; i++) { const y = 210 - i * 14, u = E.out(clamp((lt - i * 0.6) / 0.4)), x = mix(-160, 0, u) + (i % 2 ? 2 : -2);
      R.rect(18 + x, y, w - 36, 11, hex('#c99a5a')); R.rect(18 + x, y, w - 36, 1, hex('#e8c48a')); R.rect(18 + x, y + 10, w - 36, 1, hex('#7a5428')); R.disc(w / 2 + x, y + 5, 1.5, hex('#3a2010'));
      for (let ln = 0; ln < 3; ln++) for (let xx = 26; xx < w - 26; xx++) if (Math.abs(xx - w / 2) > 5 && hash(xx >> 1, ln + i * 3) < 0.62) R.px(xx + x, y + 2 + ln * 3, hex('#4a2a14'), 0.9); }
    R.text('देवी माहात्म्य', w / 2, 92, '30px Tiro', P.goldL, { outline: hex('#2a1a10'), shadow: hex('#7a3a10'), sdx: 0, sdy: 2, a: clamp(lt * 2) });
  }, (c, lt) => { chapter(c, '01', 'THE STORY', lt, 0.1, 4.4, C.gold, 150); typed(c, 'MARKANDEYA PURANA · c. 5TH–6TH CENTURY CE', lt, 0.6, 4.4, W / 2, 680, 24, C.gold);
    caption(c, lt, 1.2, 4.5, 'An ancient Sanskrit text', 'tells of a demon no one could defeat.', { y: 1480 }); }, 'iris', 14);

  // 3. MAHISHASURA. f 432..576
  shot(432, 576, (R, lt, f) => {
    R.vgrad(0, h, [[0, hex('#0a0204')], [0.6, hex('#3a0610')], [1, hex('#6a0d14')]]);
    for (let i = 0; i < 60; i++) { const x = hash(i, 7) * w + Math.sin(lt + i) * 4, y = h - ((lt * 30 * (0.4 + hash(i, 8)) + hash(i, 9) * h) % h); R.px(x, y, i % 4 ? P.flame2 : P.flame1, 0.8); }
    const s = 0.95 + E.out(clamp(lt / 4.8)) * 0.25; buffalo(R, w / 2, h * 0.42, s, hex('#050102'), lt);
  }, (c, lt) => { caption(c, lt, 0.4, 2.3, 'Mahishasura.', 'Half buffalo, half demon.', { y: 1500, size: 76 });
    caption(c, lt, 2.6, 4.6, 'His boon:', 'no man, no god could ever kill him.', { y: 1500 }); }, 'dither', 12);

  // 4. DURGA: the gods' light converges into one form; ten arms, a lion. f 576..720 (conch on bar 8 beat 2)
  shot(576, 720, (R, lt, f) => {
    R.vgrad(0, h, [[0, hex('#14030a')], [1, hex('#3a0a18')]]); const cx = w / 2, cy = h * 0.4, conv = E.inOut(clamp(lt / 1.6));
    for (let k = 0; k < 7; k++) { const sx = mix(-10, w + 10, k / 6), sy = -10; const ex = mix(sx, cx, conv), ey = mix(sy + 40, cy, conv); for (let d = 0; d < 3; d++) R.line(sx + d, sy, ex + d * (1 - conv), ey, [P.goldL, P.gold, P.mari, P.white, P.sindoorL, P.gold, P.goldL][k], 0.85); }
    const form = E.out(clamp((lt - 1.4) / 1.2));
    if (form > 0) { R.halo(cx, cy, 120 * form, P.gold, 0.55, 1.2); R.halo(cx, cy, 60 * form, P.goldL, 0.8, 1);
      for (let a = 0; a < 10; a++) { const ang = Math.PI * (0.05 + a / 9 * 0.9) + Math.PI + Math.sin(lt * 1.2 + a) * 0.04, L = 56 * form; const x1 = cx + Math.cos(ang) * L, y1 = cy + 6 + Math.sin(ang) * L * 0.9;
        R.line(cx, cy + 8, x1, y1, hex('#2a0a12')); R.line(cx + 1, cy + 8, x1 + 1, y1, hex('#2a0a12'));
        [() => R.ring(x1, y1, 4, P.goldL, 2), () => K.trishul(R, x1, y1 - 8, 18, P.goldL, P.gold, 0.45), () => R.line(x1, y1, x1 + Math.cos(ang) * 12, y1 + Math.sin(ang) * 12, P.white), () => R.disc(x1, y1, 3, P.makhL), () => { R.ring(x1, y1, 5, P.goldL, 1); R.line(x1 - 4, y1 - 4, x1 + 4, y1 + 4, P.goldL); }][a % 5](); }
      R.ellipse(cx, cy + 30, 18, 22, hex('#2a0a12')); R.ellipse(cx, cy - 4, 9, 11, hex('#2a0a12')); R.poly([[cx - 8, cy - 12], [cx + 8, cy - 12], [cx + 5, cy - 26], [cx, cy - 32], [cx - 5, cy - 26]], P.gold);
      R.disc(cx, cy - 8, 1.2, P.sindoorL); R.px(cx - 9, cy - 1, P.goldL); R.px(cx + 9, cy - 1, P.goldL);
      // the lion
      const ly = h * 0.62; R.ellipse(cx + 4, ly + 10, 46, 16, hex('#2a0a12')); R.disc(cx - 34, ly - 2, 16, hex('#2a0a12')); for (let k = 0; k < 14; k++) { const a = k / 14 * 6.28; R.disc(cx - 34 + Math.cos(a) * 15, ly - 2 + Math.sin(a) * 15, 5, hex('#3a0f18')); } R.disc(cx - 34, ly - 2, 11, hex('#2a0a12'));
      R.px(cx - 39, ly - 5, P.gold); for (const lx of [-30, -14, 22, 38]) R.rect(cx + lx, ly + 18, 5, 18, hex('#2a0a12')); R.line(cx + 48, ly + 6, cx + 64, ly - 10, hex('#2a0a12')); R.disc(cx + 64, ly - 11, 3, hex('#3a0f18')); }
    if (lt > 1.35 && lt < 1.6) R.glow(cx, cy, 200, P.white, 1.2, 3);
  }, (c, lt) => { caption(c, lt, 0.2, 2.0, 'So the gods poured', 'their light into one.', { y: 1560 });
    caption(c, lt, 2.3, 4.6, 'दुर्गा · Durga', 'the one beyond reach. The invincible.', { y: 1580, fam: 'Mukta', weight: 800, size: 84, col: C.gold, col2: C.cream }); }, 'iris', 10, { cy: 120 });

  // 5. NAVARATRI: nine nights of battle, one strike per night. f 720..864
  shot(720, 864, (R, lt, f) => {
    R.vgrad(0, h, [[0, P.night0], [1, P.night2]]); for (let i = 0; i < 70; i++) R.px(hash(i, 1) * w, hash(i, 2) * h * 0.7, P.white, 0.4 + 0.5 * hash(i, Math.floor(lt * 4)));
    const night = Math.min(9, 1 + Math.floor((f - 720) / 16)), lf = (f - 720) % 16;
    for (let n = 0; n < 9; n++) { const gx = 30 + (n % 3) * 60, gy = 120 + Math.floor(n / 3) * 62, on = n < night; if (on) R.halo(gx, gy, 16, n === night - 1 ? P.gold : hex('#6a5a2a'), 0.5, 1); K.moon(R, gx, gy, 9, 0.03 + n * 0.035, on ? P.goldL : hex('#2a2a50'), on ? hex('#3a2a10') : hex('#14143a')); }
    const n = night - 1, gx = 30 + (n % 3) * 60, gy = 120 + Math.floor(n / 3) * 62;
    if (lf < 6) { const u = lf / 6; R.line(gx - 26 + u * 10, gy - 26, gx + 26 - u * 4, gy + 26, P.white); R.line(gx - 25 + u * 10, gy - 26, gx + 27 - u * 4, gy + 26, P.goldL); R.glow(gx, gy, 30, P.white, 0.8 * (1 - u), 3); }
    R.text(NP(night), w / 2, 300, '44px Yatra', P.goldL, { outline: P.ink, shadow: P.sindoorD, sdx: 2, sdy: 2 });
  }, (c, lt) => { chapter(c, '', 'नवरात्रि · NAVARATRI', lt, 0.1, 4.4, C.gold, 150); caption(c, lt, 0.4, 4.5, 'Nine nights of battle.', 'Nine forms of the goddess, one each night.', { y: 1500 }); }, 'dither', 10);

  // 6. VICTORY on the tenth: the demon shatters; the name explains itself. f 864..1008
  shot(864, 1008, (R, lt, f) => {
    R.vgrad(0, h, [[0, hex('#3a0610')], [0.5, P.sindoorD], [1, P.mariD]]); const cx = w / 2, cy = h * 0.36, br = E.out(clamp(lt / 1.5));
    for (let i = 0; i < 520; i++) { const a = hash(i, 1) * 6.28, d0 = Math.sqrt(hash(i, 2)) * 40, x0 = cx + Math.cos(a) * d0 * 1.6, y0 = cy + Math.sin(a) * d0, v = 30 + hash(i, 3) * 140;
      const x = x0 + Math.cos(a) * v * br, y = y0 + Math.sin(a) * v * br + br * br * 30; if (br < 0.02) continue; R.px(x, y, i % 5 ? hex('#1a0408') : P.gold, 1 - br * 0.8); }
    if (lt < 0.08) buffalo(R, cx, cy, 1, hex('#050102'), 0);
    R.halo(cx, cy, 110 * br, P.goldL, 0.6, 1.4); if (lt < 0.2) R.glow(cx, cy, 200, P.white, 1.4, 3);
    const a1 = E.back(clamp((lt - 0.9) / 0.4)), a2 = E.back(clamp((lt - 2.3) / 0.4));
    if (a1 > 0.05) R.text('विजया', w / 2, 168, `${Math.round(46 * a1)}px Yatra`, P.white, { outline: P.ink, shadow: P.ink, sdx: 2, sdy: 3 });
    if (a2 > 0.05) R.text('दशमी', w / 2, 236, `${Math.round(46 * a2)}px Yatra`, P.goldL, { outline: P.ink, shadow: P.ink, sdx: 2, sdy: 3 });
  }, (c, lt) => { line(c, '= victory', lt, 1.2, 4.5, W / 2, 1100, 54, 'Fraunces', C.cream, { italic: true, weight: 500 }); line(c, '= the tenth (day)', lt, 2.6, 4.5, W / 2, 1520, 54, 'Fraunces', C.cream, { italic: true, weight: 500 });
    caption(c, lt, 3.2, 4.6, 'Good won, on the tenth day.', null, { y: 1700, size: 50 }); }, 'cut', 0);

  // 7. NEPAL: the official map draws itself; Bada Dashain, fifteen days. f 1008..1152
  shot(1008, 1152, (R, lt, f) => {
    R.vgrad(0, h, [[0, hex('#06123a')], [1, hex('#0e2a6a')]]); for (let i = 0; i < 50; i++) R.px(hash(i, 3) * w, hash(i, 4) * h, P.white, 0.5);
    const pts = nepalPts(w / 2, h * 0.42, 168), n = pts.length, k = E.inOut(clamp(lt / 1.8)), m = Math.floor(n * k);
    const fill = E.out(clamp((lt - 1.6) / 0.8)); if (fill > 0) { R.poly(pts, hex('#dc143c'), fill); }
    for (let i = 0; i < m; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n]; R.line(x0, y0, x1, y1, fill > 0.5 ? hex('#003893') : P.white); }
    if (m > 0 && k < 1) R.glow(...pts[m - 1], 10, P.white, 0.9, 3);
    if (fill > 0.6) { for (const [lon, la, col, d] of [[85.32, 27.71, P.goldL, 0], [84.63, 28.0, P.white, 0.4]]) { const [x, y] = geo(w / 2, h * 0.42, 168, lon, la), p = (lt * 1.2 + d) % 1; R.ring(x, y, 2 + p * 8, col, 1, 1 - p); R.disc(x, y, 1.5, col); } }
  }, (c, lt) => { chapter(c, '02', 'NEPAL', lt, 0.1, 4.4, C.gold, 150); const kt = ENG.S; const [kx, ky] = geo(w / 2, h * 0.42, 168, 85.32, 27.71), [gx, gy] = geo(w / 2, h * 0.42, 168, 84.63, 28.0);
    if (lt > 2.2) { T(c, 'Kathmandu', kx * kt + 24, ky * kt + 50, 30, 'Fraunces', C.cream, { align: 'left', italic: true, alpha: clamp((lt - 2.2) * 3) }); T(c, 'Gorkha', gx * kt - 20, gy * kt - 34, 30, 'Fraunces', C.cream, { align: 'right', italic: true, alpha: clamp((lt - 2.4) * 3) }); }
    caption(c, lt, 1.0, 4.5, 'In Nepal it is बडा दशैं · Bada Dashain,', 'the great Dashain: 15 days, the biggest of the year.', { y: 1440, size: 52 }); }, 'iris', 12);

  // 8. DAY 1 · GHATASTHAPANA: barley sown in a dark room grows into jamara. f 1152..1296
  shot(1152, 1296, (R, lt, f) => {
    R.clear(hex('#120a08')); R.halo(w / 2, h * 0.56, 120, hex('#ffb35a'), 0.35, 1.3);
    R.rect(20, h * 0.68, w - 40, 6, hex('#3a2416')); R.ellipse(w / 2 + 24, h * 0.68, 46, 7, hex('#6a4a2a')); R.ellipse(w / 2 + 24, h * 0.675, 44, 5, hex('#8a6a3a'));
    K.kalash(R, w / 2 - 48, h * 0.68, 2); K.diyo(R, w / 2 - 20, h * 0.68 - 1, 1.4, lt, 3);
    const sow = clamp(lt / 0.9); for (let i = 0; i < 30; i++) { const x = w / 2 + 24 + (hash(i, 1) - 0.5) * 80, y0 = h * 0.45, y = mix(y0 - hash(i, 2) * 30, h * 0.67, clamp(sow * 1.4 - hash(i, 3) * 0.4)); R.px(x, y, P.jam0); }
    const g = E.inOut(clamp((lt - 1.0) / 3.4)); if (g > 0) { for (let k = 0; k < 9; k++) K.jamara(R, w / 2 + 24 + (k - 4) * 9, h * 0.68 - 2, 110 * g, 9, k * 7 + 1, lt, { spread: 5 }); }
    moonStrip(R, 1);
  }, (c, lt) => { stripOv(c, 1, lt); chapter(c, '03', 'FIFTEEN DAYS', lt, 0.0, 1.6, C.gold, 360); caption(c, lt, 0.5, 4.6, 'Day 1 · घटस्थापना · Ghatasthapana', 'Barley is sown in the dark. It grows pale gold: jamara.', { y: 1560, size: 52, fam: 'Mukta', weight: 700 }); }, 'dither', 12);

  // 9. DAY 7 · FULPATI: the sacred flowers arrive from Gorkha; a gun salute at Tundikhel. f 1296..1368 (booms on beats 1,2,3)
  shot(1296, 1368, (R, lt, f) => {
    R.vgrad(0, h, [[0, P.sky1], [1, P.sky3]]); K.himal(R, 150, 30, 4, { peaks: K.fishtail(w * 0.3, 50, 20) }); K.hills(R, 160, 16, 2, [P.hill2, P.hill1]); R.rect(0, 200, w, h - 200, hex('#5b9a62')); R.rect(0, 238, w, 14, hex('#b8a888'));
    for (let i = 0; i < 9; i++) { const x = ((i * 22 + lt * 28) % (w + 40)) - 20; person(R, x, 250, i % 3 === 1 ? P.white : hex('#2a3a6a'), lt * 9 + i, { hat: true }); }
    const px = ((4 * 22 + lt * 28) % (w + 40)) - 20; R.rect(px - 10, 228, 22, 8, P.gold); for (let k = 0; k < 6; k++) K.marigold(R, px - 8 + k * 4, 226 - (k % 2) * 2, 2, k); K.jamara(R, px + 1, 226, 16, 8, 3, lt);
    for (let k = 0; k < 3; k++) { const cx = 40 + k * 50, fy = 290, bt = (f - 1296 - (k + 1) * BEAT) / FPS; R.rect(cx - 6, fy, 14, 5, hex('#3a4a3a')); R.line(cx + 6, fy + 1, cx + 16, fy - 4, P.ink); R.disc(cx - 4, fy + 6, 3, P.ink);
      if (bt >= 0) { if (bt < 0.1) R.glow(cx + 17, fy - 5, 30, P.flame1, 1.2, 3); for (let p = 0; p < 6; p++) R.disc(cx + 18 + bt * 18 + p * 3, fy - 6 - bt * 14 - p * 2, (2 + bt * 8) * (1 - p * 0.1), lerpC(P.white, P.cloudS, p / 6), clamp(1 - bt * 0.8)); } }
    moonStrip(R, 7);
  }, (c, lt) => { stripOv(c, 7, lt); caption(c, lt, 0.1, 2.3, 'Day 7 · फूलपाती · Fulpati', 'Sacred flowers arrive from Gorkha, met by a gun salute.', { y: 1560, size: 52, fam: 'Mukta', weight: 700 }); }, 'wipeDown', 10);

  // 10. DAY 8 + 9: Taleju's night, then tools and vehicles get tika too. f 1368..1440
  shot(1368, 1440, (R, lt, f) => {
    const nav = lt >= 1.2;
    if (!nav) { R.vgrad(0, h, [[0, P.night0], [1, P.night2]]); K.moon(R, 140, 40, 8, 0.27, P.paper); K.pagoda(R, w / 2, 250, 2.2, 3, { night: true, lit: 1 }); R.rect(0, 250, w, h - 250, P.ink);
      for (let i = 0; i < 14; i++) K.diyo(R, 14 + i * 12, 262, 1, lt, i); moonStrip(R, 8); }
    else { R.vgrad(0, h, [[0, P.sky1], [1, P.sky3]]); R.rect(0, 230, w, h - 230, hex('#8a8a8a')); R.rect(0, 230, w, 2, hex('#6a6a6a'));
      const bx = 40; R.rect(bx, 170, 100, 50, hex('#e8a02a')); R.rect(bx, 170, 100, 6, hex('#c0302a')); for (let k = 0; k < 6; k++) R.rect(bx + 6 + k * 15, 180, 11, 14, hex('#9ad0f0')); R.rect(bx + 86, 196, 14, 24, hex('#c0302a'));
      R.disc(bx + 20, 222, 8, P.ink); R.disc(bx + 80, 222, 8, P.ink); R.disc(bx + 20, 222, 3, hex('#8a8a8a')); R.disc(bx + 80, 222, 3, hex('#8a8a8a')); R.disc(bx + 100, 206, 4, P.white); R.disc(bx + 100, 206, 1.5, P.sindoor);
      K.garland(R, bx + 2, 172, bx + 98, 172, 10, 2, lt); R.disc(bx + 50, 200, 3, P.sindoor); moonStrip(R, 9); }
  }, (c, lt) => { if (lt < 1.2) { stripOv(c, 8, lt); caption(c, lt, 0.05, 1.05, 'Day 8 · Maha Ashtami', 'Kalaratri: the dark night of Taleju.', { y: 1560, size: 52 }); }
    else { stripOv(c, 9, lt - 1.2); caption(c, lt, 1.25, 2.3, 'Day 9 · Maha Navami', 'Even tools and vehicles get tika.', { y: 1560, size: 52 }); } }, 'dither', 8);

  // 11. DAY 10 · VIJAYA DASHAMI: the thali, and the blessing elders recite. f 1440..1584
  const SHLOKA = ['आयुर्द्रोणसुते श्रियं दशरथे', 'शत्रुक्षयं राघवे ।', 'ऐश्वर्यं नहुषे गतिश्च पवने', 'मानञ्च दुर्योधने ॥', 'दानं सूर्यसुते बलं हलधरे', 'सत्यञ्च कुन्तीसुते ।', 'विज्ञानं विदुरे भवन्तु भवतां', 'कीर्तिश्च नारायणे ॥'];
  const GLOSS = ['the long life of Ashwatthama', 'the wealth of Dasharatha', 'Rama’s victory over enemies', 'the splendour of Nahusha', 'the speed of the wind', 'the pride of Duryodhana', 'the generosity of Karna', 'the strength of Balarama', 'the truth of Yudhishthira', 'the wisdom of Vidura', 'the fame of Narayana'];
  shot(1440, 1584, (R, lt, f) => {
    R.clear(hex('#5a0b16')); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x + y) % 12 === 0 || (x - y + 1200) % 12 === 0) R.px(x, y, hex('#6a1020'));
    R.halo(w / 2, 250, 110, P.gold, 0.4, 1.4); K.thali(R, w / 2, 262, 2.6, lt); moonStrip(R, 10);
  }, (c, lt) => { stripOv(c, 10, lt); T(c, 'विजया दशमी · TIKA', W / 2, 330, 34, 'Mukta', C.gold, { weight: 800, alpha: clamp(lt * 3), ls: 2 });
    for (let i = 0; i < 8; i++) { const t0 = 0.3 + i * 0.42; line(c, SHLOKA[i], lt, t0, 4.6, W / 2, 470 + i * 78 + Math.floor(i / 2) * 18, i % 2 ? 46 : 52, 'Tiro', i % 2 ? C.gold : C.cream, { stagger: 0.04, shadow: ['rgba(0,0,0,.5)', 10] }); }
    const g = Math.min(10, Math.floor((lt - 0.4) / 0.38)); if (g >= 0) T(c, 'may you have ' + GLOSS[g] + '…', W / 2, 1210, 34, 'Fraunces', C.cream, { italic: true, alpha: 0.9 }); }, 'dither', 10);

  // 12. DAY 15 · KOJAGRAT PURNIMA: who is awake? f 1584..1656
  shot(1584, 1656, (R, lt, f) => {
    R.vgrad(0, h, [[0, P.night0], [0.7, P.night1], [1, P.night2]]); for (let i = 0; i < 80; i++) R.px(hash(i, 5) * w, hash(i, 6) * h * 0.6, P.white, 0.3 + 0.6 * hash(i, Math.floor(lt * 6)));
    const my = mix(150, 110, E.out(clamp(lt / 2))); R.halo(w / 2, my, 80, hex('#fff1c4'), 0.35, 1.4); K.moon(R, w / 2, my, 26, 0.5, hex('#fff6dc')); R.disc(w / 2 - 8, my - 6, 4, hex('#efe2c0')); R.disc(w / 2 + 9, my + 7, 3, hex('#efe2c0'));
    K.houses(R, -4, w + 4, 318, 23, { night: true, lit: 0.9, t: lt }); moonStrip(R, 15);
  }, (c, lt) => { stripOv(c, 15, lt); caption(c, lt, 0.1, 2.3, 'Day 15 · Kojagrat Purnima', 'Laxmi walks the earth asking: को जागर्ति? Who is awake?', { y: 1440, size: 52 }); }, 'iris', 10, { cy: 110 });

  // 13. TOGETHER: six beat-cut vignettes, one every two beats. f 1656..1872
  const VIG = [
    ['PING', (R, t) => { R.vgrad(0, h, [[0, hex('#2b1d5c')], [0.6, hex('#e0614a')], [1, hex('#ffd98a')]]); R.disc(w * 0.7, 200, 26, hex('#fff1c4')); K.terraces(R, 250, h, 3, [hex('#8a6a2a'), hex('#a8822e'), hex('#e0b54a')]);
      K.ping(R, w * 0.42, 300, 200, Math.sin(t * Math.PI * 2 / 2.4 + 1.2) * 0.75, { rs: 3, col: P.sindoor, pole: hex('#2a1420'), pole2: hex('#2a1420'), rope: hex('#2a1420'), skin: hex('#2a1420'), hair: hex('#2a1420') }); }],
    ['CHANGA', (R, t) => { sky(R); clouds(R, t, 0, 9, 5); const cols = [[P.sindoor, P.gold], [P.mari, P.white], [hex('#2a6fdb'), P.white], [P.leaf, P.jam1], [P.makh, P.white], [P.teal, P.gold]];
      for (let i = 0; i < 12; i++) { const x = hash(i, 1) * w, y = 30 + hash(i, 2) * 220 + Math.sin(t * 2 + i) * 6; K.kite(R, x + Math.sin(t + i) * 5, y, 1 + hash(i, 3) * 1.5, ...cols[i % 6], Math.sin(t * 2 + i) * 0.3, t + i); } K.houses(R, -4, w + 4, h, 4); }],
    ['GHAR · HOME', (R, t) => { R.vgrad(0, h, [[0, P.sky1], [1, P.sky3]]); K.himal(R, 170, 40, 12, { peaks: K.fishtail(w * 0.7, 60, 22) }); K.hills(R, 180, 30, 3, [P.hill2, P.hill1]); R.rect(0, 230, w, h, P.hill0); R.rect(0, 236, w, 20, hex('#7a7a7a'));
      const bx = w / 2 - 50 + Math.sin(t * 20) * 0.6; R.rect(bx, 196, 100, 40, hex('#2a8a6a')); R.rect(bx, 196, 100, 4, hex('#f2b733')); for (let k = 0; k < 6; k++) R.rect(bx + 6 + k * 15, 204, 11, 12, hex('#9ad0f0'));
      for (let k = 0; k < 8; k++) person(R, bx + 8 + k * 12, 196, [P.sindoor, P.mari, hex('#2a6fdb'), P.makh][k % 4], t * 3 + k, { hat: k % 2 === 0 }); R.disc(bx + 18, 238, 7, P.ink); R.disc(bx + 82, 238, 7, P.ink);
      for (let k = 0; k < 6; k++) R.rect(((k * 40 - t * 120) % (w + 40) + w + 40) % (w + 40) - 20, 245, 16, 2, P.white); }],
    ['GHAR · FAMILY', (R, t) => { R.clear(hex('#3a1a10')); R.halo(w / 2, 160, 150, hex('#ffb35a'), 0.4, 1.2); R.rect(0, 250, w, h, hex('#5a2a14')); R.rect(30, 228, 30, 12, hex('#8a4a22')); person(R, 45, 228, P.white, 0, { hat: true, hair: P.white, skin: hex('#a8683e') });
      for (let k = 0; k < 6; k++) { const x = 80 + k * 16 - (t > 0.6 ? Math.min(16, (t - 0.6) * 24) * (k === 0 ? 0 : 0) : 0); person(R, x, 250, [P.sindoor, P.makh, hex('#2a6fdb'), P.mari, P.leaf, P.gold][k], 0, { kid: k > 3 }); R.disc(x, 237 - (k > 3 ? -2 : 0), 1, P.sindoor); }
      K.thali(R, 46, 252, 0.8, t, { diyo: false }); }],
    ['TASH', (R, t) => { R.clear(hex('#1e5a3a')); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x * 7 + y * 13) % 17 === 0) R.px(x, y, hex('#24683f'));
      const n = 5; for (let k = 0; k < n; k++) { const a = (k - 2) * 0.22 * E.out(clamp(t * 2)), cx = w / 2 + Math.sin(a) * 60, cy = 210 - Math.cos(a) * 60 + 60; const ca = Math.cos(a), sa = Math.sin(a), q = (u, v) => [cx + u * ca - v * sa, cy + u * sa + v * ca];
        R.poly([q(-14, -20), q(14, -20), q(14, 20), q(-14, 20)], P.white); R.poly([q(-12, -18), q(12, -18), q(12, 18), q(-12, 18)], hex('#f6f0e6')); const [sx, sy] = q(0, 0); R.disc(sx, sy, 4, k % 2 ? P.sindoor : P.ink); const [lx, ly] = q(-8, -12); R.px(lx, ly, k % 2 ? P.sindoor : P.ink); } }],
    ['MALSHREE', (R, t) => { R.vgrad(0, h, [[0, hex('#2a1a40')], [1, hex('#5a2a40')]]); const cx = w / 2, cy = 190; R.rect(cx - 40, cy - 30, 80, 50, hex('#6a3a1a')); R.rect(cx - 36, cy - 26, 50, 42, hex('#2a1a10')); R.disc(cx + 26, cy - 10, 7, hex('#c0a070')); R.disc(cx + 26, cy + 8, 4, hex('#c0a070'));
      for (let k = 0; k < 7; k++) { const x = cx - 30 + k * 8 + Math.sin(t * 3 + k) * 4, y = cy - 50 - ((t * 40 + k * 14) % 80); R.text('♪', x, y, '12px PS2P', P.goldL, { a: 1 - ((t * 40 + k * 14) % 80) / 80 }); } }],
  ];
  shot(1656, 1872, (R, lt, f) => { const i = Math.min(5, Math.floor((f - 1656) / 36)); VIG[i][1](R, (f - 1656 - i * 36) / FPS + i * 0.3); },
    (c, lt, f) => { const i = Math.min(5, Math.floor((f - 1656) / 36)), lf = (f - 1656 - i * 36); chapter(c, '04', 'TOGETHER', lt, 0, 7, C.gold, 150);
      const u = E.back(clamp(lf / 6)); T(c, VIG[i][0], W / 2, 1600, 110 * u, 'SilkB', '#fff', { ls: 10, shadow: ['rgba(0,0,0,.6)', 0, 8, 8] });
      const sub = ['bamboo swings, built by the whole village', 'kites over every rooftop', 'the whole country goes home', 'tika from the eldest, in turn', 'card games late into the night', 'and Malshree on every radio'][i]; T(c, sub, W / 2, 1680, 40, 'Fraunces', C.cream, { italic: true, alpha: clamp(lf / 6), shadow: ['rgba(0,0,0,.6)', 12] }); }, 'blocks', 10);

  // 14. POV: an elder's hand brings the tika to YOUR forehead. Contact on bar 27 (f 1944). f 1872..2016
  const STAMP = bar(27);
  shot(1872, 2016, (R, lt, f) => {
    R.clear(hex('#2a120c')); R.halo(w / 2, h * 0.5, 170, hex('#ffb35a'), 0.45, 1.1); for (let i = 0; i < 26; i++) { const x = hash(i, 1) * w + Math.sin(lt * 0.6 + i) * 4, y = hash(i, 2) * h; R.halo(x, y, 8 + hash(i, 3) * 14, i % 3 ? hex('#ffb35a') : hex('#ff6a3a'), 0.35, 0.6, 3); }
    const k = clamp((f - 1872) / (STAMP - 1872)), u = E.inOut(k), s = mix(1.2, 3.2, u), hx = mix(w * 0.72, w / 2 + 10, u), hy = mix(h * 0.78, h * 0.52, u);
    if (f < STAMP + 4) { const sk = hex('#b47a52'), sd = hex('#8a5636'); R.ellipse(hx + 26 * s, hy + 34 * s, 22 * s, 30 * s, sd); R.ellipse(hx + 24 * s, hy + 30 * s, 20 * s, 28 * s, sk);
      R.ellipse(hx + 6 * s, hy + 6 * s, 6 * s, 14 * s, sk); R.disc(hx + 2 * s, hy - 6 * s, 6 * s, sk); for (let i = 0; i < 3; i++) R.hline(hx + 12 * s, hx + 36 * s, hy + (18 + i * 10) * s, sd);
      R.ellipse(hx + 1 * s, hy - 9 * s, 5 * s, 3.4 * s, P.sindoor); for (let i = 0; i < 20; i++) R.px(hx + (hash(i, 5) - 0.5) * 9 * s, hy - 9 * s + (hash(i, 6) - 0.5) * 6 * s, P.sindoorL);
      R.rect(hx + 10 * s, hy + 50 * s, 30 * s, 40 * s, hex('#e8e0d0')); }
    if (f >= STAMP) { const g = E.out(clamp((f - STAMP) / 20)); R.halo(w / 2, h * 0.48, 30 + g * 300, P.sindoor, 1, 0.25); R.disc(w / 2, h * 0.48, 20 + g * 220, P.sindoor);
      for (let i = 0; i < 260; i++) { const a = hash(i, 1) * 6.28, d = Math.sqrt(hash(i, 2)) * (20 + g * 240); R.px(w / 2 + Math.cos(a) * d, h * 0.48 + Math.sin(a) * d, i % 7 ? P.sindoorL : P.rice); } if (f - STAMP < 3) R.glow(w / 2, h * 0.48, 200, P.white, 1.2, 3); }
  }, (c, lt, f) => { chapter(c, '05', 'TIKA', lt, 0, 2.3, C.gold, 150); if (f < STAMP) { caption(c, lt, 0.3, 2.3, 'And this year,', 'the tika is for you.', { y: 1600 }); } }, 'dither', 12);

  // 15. THE WISH. The cut kite drifts back down; a child catches the string and it flies again. f 2016..2232
  shot(2016, 2232, (R, lt, f) => {
    R.clear(P.sindoor); for (let i = 0; i < 900; i++) { const x = hash(i, 11) * w, y = hash(i, 12) * h; R.px(x, y, i % 9 ? P.sindoorL : (i % 2 ? P.rice : P.sindoorD)); R.px(x + 1, y, i % 9 ? P.sindoorL : P.rice, 0.5); }
    R.halo(w / 2, 120, 140, P.gold, 0.35, 1.3);
    const gj = E.out(clamp(lt / 1.6)); for (let k = 0; k < 8; k++) { K.jamara(R, 6 + k * 3, h + 4, 120 * gj, 6, k + 11, lt, { spread: 3 }); K.jamara(R, w - 6 - k * 3, h + 4, 120 * gj, 6, k + 31, lt, { spread: 3 }); }
    const a = E.back(clamp((lt - 0.2) / 0.5)); if (a > 0.05) R.text('शुभ विजया', w / 2, 96, `${Math.round(30 * a)}px Yatra`, P.goldL, { outline: hex('#5a0b16'), shadow: hex('#5a0b16'), sdx: 2, sdy: 3 });
    const b2 = E.back(clamp((lt - 0.5) / 0.5)); if (b2 > 0.05) R.text('दशमी', w / 2, 146, `${Math.round(44 * b2)}px Yatra`, P.white, { outline: hex('#5a0b16'), shadow: hex('#5a0b16'), sdx: 2, sdy: 3 });
    // the kite: drifts down from above (2.4 s), is caught at bar 29.5 by the child, then climbs away for good
    const kid = [w * 0.34, 286], tc = 3.4, kt = lt; let kx, ky, ka;
    if (kt < tc) { const u = E.out(clamp(kt / tc)); kx = mix(w * 0.8, kid[0] + 6, u) + Math.sin(kt * 2.5) * 10 * (1 - u); ky = mix(-30, 248, u); ka = Math.sin(kt * 3) * 0.6 * (1 - u) + 2.4 * (1 - u); }
    else { const u = E.in(clamp((kt - tc - 0.5) / 2.4)); kx = mix(kid[0] + 6, w * 0.72, u) + Math.sin(kt * 2) * 4; ky = mix(248, 40, u); ka = Math.sin(kt * 2.2) * 0.25; }
    if (kt > tc) R.curve(kx, ky + 8, (kx + kid[0]) / 2 + 8, (ky + kid[1]) / 2 + 20, kid[0] + 3, kid[1] - 12, hex('#5a0b16'), 1, 24);
    K.kite(R, kx, ky, 1.6, hex('#2a6fdb'), P.white, ka, kt);
    const run = kt > tc + 0.3 ? Math.min(30, (kt - tc - 0.3) * 18) : 0; person(R, kid[0] - run, kid[1], P.gold, kt * (run > 0 && run < 30 ? 12 : 0), { kid: true }); R.line(kid[0] - run + 2, kid[1] - 8, kid[0] - run + 4, kid[1] - 13, hex('#b9764a'));
  }, (c, lt, f) => {
    line(c, 'Happy Vijaya Dashami ' + 2083, lt, 0.8, 9, W / 2, 1060, 60, 'Fraunces', C.cream, { weight: 600, shadow: ['rgba(90,11,22,.8)', 14] });
    line(c, 'Whatever got cut loose this year,', lt, 1.6, 9, W / 2, 1180, 46, 'Fraunces', C.gold, { italic: true, weight: 500, shadow: ['rgba(90,11,22,.8)', 12] });
    line(c, 'may it fly again.', lt, 2.2, 9, W / 2, 1240, 46, 'Fraunces', C.gold, { italic: true, weight: 500, shadow: ['rgba(90,11,22,.8)', 12] });
    if (lt > 4.6) { const u = E.out(clamp((lt - 4.6) / 0.6)); T(c, '— Nikit Hamal', W / 2, 1780, 54, 'Fraunces', '#fff', { italic: true, weight: 600, alpha: u }); T(c, 'NIKIT.IS-A.DEV', W / 2, 1836, 24, 'SilkB', C.gold, { ls: 6, alpha: u }); }
  }, 'iris', 8);

  // letterbox fades: first and last frames
  function overlay(c, f) { const a = Math.max(1 - f / 8, prog(f, TOTAL - 18, TOTAL)); if (a > 0) { c.fillStyle = `rgba(0,0,0,${a})`; c.fillRect(0, 0, W, H); } }
  function shake(f) { const d = f - CUT; if (d >= 0 && d < 12) return 6 * (1 - d / 12); const s = f - STAMP; if (s >= 0 && s < 10) return 5 * (1 - s / 10); const fb = f - 1296; for (let k = 1; k <= 3; k++) { const q = fb - k * BEAT; if (q >= 0 && q < 6) return 3 * (1 - q / 6); } return 0; }
  async function load() { NEPAL = await (await fetch('../lib/nepal.json')).json(); }
  return ENG.make({ shots: S, total: TOTAL, overlay, shake, load });
})();
