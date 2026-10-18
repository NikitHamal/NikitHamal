// Films for individual posts (24 s each): ?post=<slug>[&v=portrait]. 60 fps, 80 BPM (beat = 45 f).
// Typographic and symmetrical, like "I write.": his words, centred on one axis, each post with its own kinetic idea,
// ending on a card with the title, the date and the post's address. Engine: ../shared/lib.js.
'use strict';
const { E, clamp, prog, mix, hash, font } = LIB;
const Q = new URLSearchParams(location.search), PORT = Q.get('v') === 'portrait', SLUG = Q.get('post') || 'the-lie-of-being-yourself';
const W = PORT ? 1080 : 1920, H = PORT ? 1920 : 1080, CX = W / 2, CY = H / 2, K = PORT ? 1.0 : 1, TOTAL = 1440, CARD = 1140, KIN = 150, EXS = 720;   // title card 0-150, kinetic scene 150-720, excerpts 720-1140, end card 1140-1440
const C = { paper: '#f4ede2', ink: '#1d1a17', ink2: '#5b544c', mute: '#8a8178', pink: '#c9607f', line: 'rgba(29,26,23,0.18)', mud: '#6b4a2e', gold: '#b8892b' };
const A = {};

// ---- shared helpers (all centred on the axis)
function fit(c, text, kind, size, maxW = W * 0.86) { font(c, kind, size); const w = c.measureText(text).width; return w > maxW ? size * maxW / w : size; }
function line(c, text, f, f0, y, size, kind = 'serif', col = C.ink, outF = 1e9, step = 5) { return LIB.wordsIn(c, text, f, f0, step, CX, y, fit(c, text, kind, size * K), kind, col, 'center', outF); }
// a sentence that wraps into lines on the narrow frame (split at '|' in portrait, joined with a space in landscape)
function sent(c, text, f, f0, y, size, kind = 'serif', col = C.ink, outF = 1e9, gapK = 1.28) {
  const parts = PORT ? text.split('|') : [text.replace(/\|/g, ' ')], n = parts.length, lh = size * K * gapK;
  parts.forEach((p, i) => line(c, p.trim(), f, f0 + i * 12, y + (i - (n - 1) / 2) * lh, size, kind, col, outF));
}
function cap(c, text, f, f0, y, outF = 1e9) { const u = E.out(prog(f, f0, f0 + 24)) * (1 - E.exit(prog(f, outF, outF + 14))); if (u <= 0) return; c.save(); c.globalAlpha *= u; font(c, 'mono', PORT ? 22 : 18, 500); c.letterSpacing = '5px'; c.fillStyle = C.mute; c.textAlign = 'center'; c.fillText(text, CX, y); c.restore(); }
function rule(c, f, f0, y, half, col = C.line, outF = 1e9) { const u = E.inOut(prog(f, f0, f0 + 30)) * (1 - E.exit(prog(f, outF, outF + 14))); if (u <= 0) return; c.save(); c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath(); c.moveTo(CX - half * u, y); c.lineTo(CX + half * u, y); c.stroke(); c.restore(); }
function fadeOut(c, f, outF, draw) { const e = E.exit(prog(f, outF, outF + 18)); if (e >= 1) return; c.save(); c.globalAlpha *= 1 - e; draw(); c.restore(); }
function typedLine(c, text, f, f0, y, size, col = C.ink, rate = 3, caretUntil = 1e9) { return LIB.typed(c, text, f, f0, CX, y, fit(c, text, 'serif', size * K), { kind: 'serif', rate, align: 'center', caretUntil, col }); }
function strike(c, text, f, f0, y, size, col = C.ink) { const s = E.out(prog(f, f0, f0 + 18)); if (s <= 0) return; const sz = fit(c, text, 'serif', size * K); font(c, 'serif', sz); const w = c.measureText(text).width;
  c.save(); c.strokeStyle = col; c.lineWidth = sz * 0.055; c.lineCap = 'round'; c.beginPath(); c.moveTo(CX - w / 2 - 14, y - sz * 0.3); c.lineTo(CX - w / 2 - 14 + (w + 28) * s, y - sz * 0.3 - 6 * s); c.stroke(); c.restore(); }
// text -> points (for words that dissolve into drops or shatter into fragments)
function points(text, kind, size, step) {
  const cv = document.createElement('canvas'), x = cv.getContext('2d', { willReadFrequently: true }); font(x, kind, size); const w = Math.ceil(x.measureText(text).width) + 20, h = Math.ceil(size * 1.4);
  cv.width = w; cv.height = h; font(x, kind, size); x.fillStyle = '#000'; x.textBaseline = 'alphabetic'; x.fillText(text, 10, size * 1.05); const d = x.getImageData(0, 0, w, h).data, pts = [];
  for (let yy = 0; yy < h; yy += step) for (let xx = 0; xx < w; xx += step) if (d[(yy * w + xx) * 4 + 3] > 128) pts.push([xx - w / 2, yy - size * 1.05]);
  return pts;
}

// ---- the posts
const POSTS = {
  'the-lie-of-being-yourself': { ex: [['Someone says something unpleasant to you, and your whole mood changes. A moment earlier you were generous, open, ready to listen. Which one was your real self?', 'Which one was your real self?'], ['Your hurt is there. Your preferences are there. Your particular way of laughing is there. But where is the separate owner of all this?', 'the separate owner']], title: 'The lie of “being yourself”', cat: 'ESSAY', date: 'SEPTEMBER 22, 2026', draw(c, f) {
    const S = PORT ? 96 : 110, rows = [['Be yourself.', 0, 168], ['Find yourself.', 40, 192], ['Know who you really are.', 80, 216]], gap = PORT ? 150 : 150;
    fadeOut(c, f, 270, () => rows.forEach(([t, f0, s0], i) => { const y = CY + (i - 1) * gap + S * 0.3; typedLine(c, t, f, f0 + 6, y, i === 2 ? S * 0.82 : S, C.ink, 2, f0 + 60); strike(c, t, f, s0, y, i === 2 ? S * 0.82 : S, C.pink); }));
    fadeOut(c, f, 540, () => { sent(c, 'Which self are you|talking about?', f, 300, CY + 10, PORT ? 92 : 104, 'serifI', C.pink); });
  } },
  'the-wrong-guy-trying-to-wake-up': { ex: [['The dog did not choose to chase. Something moved in the dog and the chasing happened.', 'did not choose'], ['You go to bed. You lie down. You close your eyes. At some point, sleep takes you.', 'sleep takes you.']], title: 'The Wrong Guy Trying to Wake Up', cat: 'ESSAY', date: 'FEBRUARY 14, 2026', draw(c, f) {
    // the site's own dog chases its tail in a circle on the axis; remove the chase and it stops
    const ds = PORT ? 6 : 5.5, R = ds * 26, cy = CY - (PORT ? 40 : 40), stopU = E.inOut(prog(f, 300, 380));
    const spd = mix(1.6, 4.2, E.smooth(prog(f, 20, 260))) * (1 - stopU), ang = A.angAt(f), t = f / 60;
    fadeOut(c, f, 560, () => {
      // seen from the side: the dog runs a small ellipse around the axis, turning to face where it is going (the site's spin)
      const gy = cy + R * 0.35, rx = R * 0.9, ry = R * 0.22; c.save(); c.strokeStyle = C.line; c.setLineDash([3, 9]); c.lineWidth = 1.5; c.globalAlpha = 1 - stopU; c.beginPath(); c.ellipse(CX, gy, rx, ry, 0, 0, 7); c.stroke(); c.restore();
      const settle = E.inOut(prog(f, 360, 400)), px = CX + Math.cos(ang) * rx * (1 - settle), py = gy + Math.sin(ang) * ry * (1 - settle), face = Math.sin(ang) >= 0 ? -1 : 1, dsc = ds * (1 + Math.sin(ang) * 0.08 * (1 - settle));
      if (f < 384) A.dog.draw(c, px, py, dsc, spd > 0.15 ? 'run' : 'stand', t * (0.6 + spd * 0.35), { face });
      else A.dog.draw(c, CX, gy, ds, 'sit', t, { wag: 0.25, face: 1 });
      const ty = PORT ? cy - R - 300 : 170, by = PORT ? cy + R + 300 : H - 150;
      if (f < 296) { line(c, 'Look at a dog chasing its tail.', f, 16, ty, 66, 'serif', C.ink, 280); sent(c, 'The faster the dog runs,|the faster the tail escapes.', f, 140, by, 56, 'serifI', C.ink2, 280); }
      else { line(c, 'Remove the chase', f, 300, ty, 66, 'serif', C.ink); line(c, 'and there is no problem.', f, 380, by - (PORT ? 40 : 30), 60, 'serifI', C.pink); line(c, 'There was never a problem.', f, 460, by + (PORT ? 60 : 50), 48, 'serif', C.ink2); }
    });
  } },
  'you-never-trusted-anyone-2': { ex: [['You will love only till the times are good, and when times are bad, rough, hard, and tough, you will stop loving?', 'you will stop loving?'], ['If someone is giving you guarantee and certainty, what value is of your trust?', 'what value is of your trust?']], title: 'You never trusted anyone (2)', cat: 'ESSAY', date: 'JANUARY 23, 2026', draw(c, f) {
    const S = PORT ? 70 : 76;
    fadeOut(c, f, 200, () => { sent(c, 'You say you want trust,', f, 6, CY - 120, S, 'serif', C.ink); sent(c, 'but what you really want is', f, 50, CY - 10, S * 0.8, 'serif', C.ink2);
      // "security." locks into a bracket
      const u = E.out(prog(f, 90, 120)), lk = E.inOut(prog(f, 120, 150)), sz = S * 1.25 * K; if (u > 0) { c.save(); c.globalAlpha *= u; font(c, 'serifI', sz); c.textAlign = 'center'; c.fillStyle = C.pink; c.fillText('security.', CX, CY + 130); const w = c.measureText('security.').width;
        if (lk > 0) { c.strokeStyle = C.ink; c.lineWidth = 3; const pad = mix(80, 26, lk), x0 = CX - w / 2 - pad, x1 = CX + w / 2 + pad, y0 = CY + 130 - sz * 0.85, y1 = CY + 130 + sz * 0.3, k = 22;
          c.beginPath(); c.moveTo(x0 + k, y0); c.lineTo(x0, y0); c.lineTo(x0, y1); c.lineTo(x0 + k, y1); c.moveTo(x1 - k, y0); c.lineTo(x1, y0); c.lineTo(x1, y1); c.lineTo(x1 - k, y1); c.globalAlpha *= lk; c.stroke(); } c.restore(); } });
    fadeOut(c, f, 400, () => { sent(c, 'Trust can only exist|where there is', f, 214, CY - 110, S, 'serif', C.ink);
      // "certainty." gains its "un"
      if (f >= 260) { const u = E.out(prog(f, 260, 290)), un = E.inOut(prog(f, 320, 356)), sz = S * 1.3 * K; font(c, 'serifI', sz); const wc = c.measureText('certainty.').width, wu = c.measureText('un').width;
        c.save(); c.globalAlpha *= u; c.textAlign = 'left'; c.fillStyle = C.ink; const x0 = CX - (wc + wu * un) / 2; c.fillText('certainty.', x0 + wu * un, CY + 110 + (1 - u) * 20);
        if (un > 0) { c.globalAlpha *= un; c.fillStyle = C.pink; c.filter = `blur(${((1 - un) * 6).toFixed(1)}px)`; c.fillText('un', x0 - (1 - un) * 60, CY + 110); } c.restore(); } });
    fadeOut(c, f, 560, () => { sent(c, 'When you ask for guarantees,', f, 420, CY - 40, S * 0.9, 'serif', C.ink); sent(c, 'you are not trusting.', f, 470, CY + 70, S, 'serifI', C.pink); });
  } },
  'where-is-god': { ex: [['With separation, god dies. People are after god. When you seek god, you kill god.', 'you kill god.'], ['To seek god is like seeking the ocean. There is no such thing as ocean.', 'There is no such thing as ocean.']], title: 'Where is God?', cat: 'REFLECTION', date: 'FEBRUARY 27, 2025', draw(c, f) {
    const up = E.inOut(prog(f, 56, 80)), ty = mix(CY + 30, PORT ? CY - 380 : 230, up);
    fadeOut(c, f, 560, () => { line(c, 'Where is God?', f, 4, ty, mix(120, 76, up), 'serif', C.ink);
      const L = [['God is neither in,', 'nor out.'], ['God is neither above,', 'nor below.'], ['God is neither time,', 'nor the timeless.'], ['God is neither anywhere,', 'nor nowhere.']], st = [86, 170, 254, 338];
      L.forEach(([a, b], i) => { const f0 = st[i], f1 = (i < 3 ? st[i + 1] : 420) - 16; if (f < f0 || f > f1 + 18) return;
        if (PORT) { line(c, a, f, f0, CY - 10, 80, 'serif', C.ink, f1); line(c, b, f, f0 + 16, CY + 90, 80, 'serifI', C.pink, f1); }
        else { LIB.wordsIn(c, a, f, f0, 5, CX - 40, CY + 60, 84, 'serif', C.ink, 'right', f1); LIB.wordsIn(c, b, f, f0 + 16, 5, CX - 10, CY + 60, 84, 'serifI', C.pink, 'left', f1); }
        rule(c, f, f0 + 20, PORT ? CY + 140 : CY + 100, PORT ? 220 : 300, C.pink, f1); });
      sent(c, 'But there is nothing|except god.', f, 432, CY + 40, 84, 'serifI', C.ink); });
  } },
  'god-and-the-ocean': { ex: [['God and the Ocean are the same; they both are, and they both are not. In the name of the Ocean, all you can show me are countless drops of water. In the name of God, all you can show me are countless fragments of creation.', 'they both are, and they both are not.']], title: 'God and The Ocean', cat: 'REFLECTION', date: 'NOVEMBER 23, 2024', draw(c, f) {
    const S = PORT ? 220 : 240;
    // "Ocean": countless drops falling out of the word
    fadeOut(c, f, 280, () => { sent(c, 'In the name of the Ocean,', f, 4, PORT ? CY - 360 : 190, 60, 'serif', C.ink2);
      const dr = prog(f, 120, 270); A.ocean.forEach(([px, py], i) => { const h1 = hash(i), d = clamp(dr * 1.6 - h1 * 0.6), g = d * d; const x = CX + px * (1 + d * 0.05) + (h1 - 0.5) * 40 * d, y = CY + 60 + py + g * (H * 0.55) * (0.6 + hash(i + 3));
        c.globalAlpha = E.out(prog(f, 20 + h1 * 30, 50 + h1 * 30)) * (1 - d * 0.9); c.fillStyle = d > 0.02 ? '#5b7b8c' : C.ink; c.beginPath(); c.arc(x, y, d > 0.02 ? 2.6 : 2.3, 0, 7); c.fill(); }); c.globalAlpha = 1;
      sent(c, 'all you can show me are|countless drops of water.', f, 150, PORT ? CY + 400 : H - 170, 60, 'serifI', C.ink); });
    // "God": countless fragments, flying outward from the axis
    fadeOut(c, f, 460, () => { if (f < 290) return; sent(c, 'In the name of God,', f, 292, PORT ? CY - 360 : 190, 60, 'serif', C.ink2);
      const fr = prog(f, 360, 450); A.god.forEach(([px, py], i) => { const h1 = hash(i * 1.7), d = E.out(clamp(fr * 1.3 - h1 * 0.3)), a = Math.atan2(py + S * 0.35, px);
        const x = CX + px + Math.cos(a) * d * (200 + 260 * hash(i + 5)), y = CY + 60 + py + Math.sin(a) * d * (200 + 260 * hash(i + 5)); c.globalAlpha = E.out(prog(f, 300 + h1 * 20, 330 + h1 * 20)) * (1 - d * 0.85);
        c.fillStyle = C.ink; c.save(); c.translate(x, y); c.rotate(d * 3 * (h1 - 0.5)); c.fillRect(-2.2, -2.2, 4.4, 4.4); c.restore(); }); c.globalAlpha = 1;
      sent(c, 'all you can show me are|countless fragments of creation.', f, 340, PORT ? CY + 400 : H - 170, 60, 'serifI', C.ink); });
    fadeOut(c, f, 560, () => { sent(c, 'God and the Ocean are the same;', f, 468, CY - 50, 66, 'serif', C.ink); sent(c, 'they both are,|and they both are not.', f, 500, CY + (PORT ? 110 : 60), 66, 'serifI', C.pink); });
  } },
  'i-offer-my-curse-to-god': { ex: [['If God desires my humility, I will stand tall in defiance. If God seeks worship, I will remain silent.', 'stand tall in defiance.'], ['Instead, I will seek to understand the truth of life, the truth of myself. For in that understanding, perhaps, lies the only offering that matters.', 'the only offering that matters.']], title: 'I offer my curse to God', cat: 'REFLECTION', date: 'NOVEMBER 25, 2024', draw(c, f) {
    // each offering the world expects turns into his: gold -> mud, prayers -> curses, tears -> laughter, worship -> silence
    const SW = [['If god is pleased by gold,', 'gold', 'mud', C.gold, C.mud], ['If god is pleased by prayers,', 'prayers', 'curses', C.ink, C.pink], ['If god is pleased by tears,', 'tears', 'laughter', '#5b7b8c', C.pink], ['If God seeks worship,', 'worship', '', C.ink, C.ink]];
    const S = PORT ? 170 : 190;
    SW.forEach(([lead, a, b, ca, cb], i) => { const f0 = 6 + i * 104, sw = f0 + 50, f1 = f0 + 98; if (f < f0 || f > f1 + 18) return;
      fadeOut(c, f, f1, () => { line(c, lead, f, f0, CY - (PORT ? 230 : 200), 58, 'serif', C.ink2); line(c, 'I offer him', f, sw - 6, CY + (PORT ? 220 : 210), 52, 'serifI', C.ink2);
        const m = E.inOut(prog(f, sw, sw + 26)), y = CY + S * 0.33;
        c.save(); c.globalAlpha *= (1 - m) * E.out(prog(f, f0 + 10, f0 + 34)); c.filter = m > 0 ? `blur(${(m * 12).toFixed(1)}px)` : 'none'; font(c, 'serifI', fit(c, a, 'serifI', S)); c.textAlign = 'center'; c.fillStyle = ca; c.fillText(a, CX, y - m * 30); c.restore();
        if (b) { c.save(); c.globalAlpha *= m; c.filter = m < 1 ? `blur(${((1 - m) * 12).toFixed(1)}px)` : 'none'; font(c, 'serif', fit(c, b, 'serif', S)); c.textAlign = 'center'; c.fillStyle = cb; c.fillText(b, CX, y + (1 - m) * 30 + (i === 0 ? m * 10 : 0)); c.restore(); }
        else { const u = E.out(prog(f, sw + 30, sw + 50)); c.save(); c.globalAlpha *= u; font(c, 'mono', PORT ? 24 : 20, 500); c.letterSpacing = '6px'; c.fillStyle = C.mute; c.textAlign = 'center'; c.fillText('( SILENCE )', CX, y - S * 0.3); c.restore(); } }); });
    fadeOut(c, f, 560, () => { sent(c, 'Instead, I will seek to understand', f, 432, CY - 60, 62, 'serif', C.ink); sent(c, 'the truth of life,|the truth of myself.', f, 470, CY + (PORT ? 110 : 50), 66, 'serifI', C.pink); });
  } },
  'you': { ex: [['a home,\nfor the homeless me,\ncountless drops,\nfor the boundless sea,\na sprouting seed,\nfor the huge huge tree,', 'boundless sea,'], ['a guiding star,\nfor the lost to see,\na tender touch,\nfor the aching me,\nthe only truth,\nfor this wandering “me”.', 'wandering “me”.']], title: 'You', cat: 'POEM', date: 'DECEMBER 3, 2024', draw(c, f) {
    const P = [['a home,', 'for the homeless me,'], ['countless drops,', 'for the boundless sea,'], ['a sprouting seed,', 'for the huge huge tree,'], ['a guiding star,', 'for the lost to see,'], ['a tender touch,', 'for the aching me,'], ['the only truth,', 'for this wandering “me”.']], st = 84;
    // a single ring on the axis that breathes with each couplet
    const k = Math.min(5, Math.floor(Math.max(0, f - 8) / st)), br = Math.sin(clamp((f - 8 - k * st) / st) * Math.PI);
    fadeOut(c, f, 560, () => { c.save(); c.strokeStyle = C.pink; c.globalAlpha = 0.35 * E.out(prog(f, 0, 30)); c.lineWidth = 1.5; c.beginPath(); c.arc(CX, CY - 10, (PORT ? 380 : 330) + br * 16, 0, 7); c.stroke(); c.restore();
      P.forEach(([a, b], i) => { const f0 = 8 + i * st, f1 = i < 5 ? f0 + st - 16 : 560; if (f < f0 || f > f1 + 18) return; line(c, a, f, f0, CY - 30, 84, 'serif', C.ink, f1); line(c, b, f, f0 + 14, CY + 70, 70, 'serifI', C.pink, f1); }); });
  } },
  'perfect': { ex: [['Perfect,\nis perfectly what you are,\nand perfectly what you do,\nlike the radiance of the morning dew,\nperfectly fresh, perfectly new.', 'the morning dew,'], ['Perfect,\nnot just a name,\nit\'s a spark, a glowing flame,\nthe beauty, the essence, the heart of life\'s game,\nconstant, steady, always the same.', 'a glowing flame,']], title: 'Perfect', cat: 'POEM', date: 'NOVEMBER 30, 2024', draw(c, f) {
    // every "perfect" lights up, inside one perfect circle drawn on the axis
    const R = PORT ? 420 : 360, d = E.inOut(prog(f, 0, 60));
    const hl = (t, f0, y, size, kind = 'serif') => { const ws = t.split(' '), s = fit(c, t, kind, size * K); font(c, kind, s); const sp = c.measureText(' ').width, wd = ws.map(w => c.measureText(w).width), tot = wd.reduce((p, q) => p + q, 0) + sp * (ws.length - 1); let x = CX - tot / 2;
      ws.forEach((w, i) => { const u = E.out(prog(f, f0 + i * 5, f0 + i * 5 + 24)); if (u > 0) { const pf = /perfect/i.test(w); c.save(); c.globalAlpha *= u; if (u < 1) c.filter = `blur(${((1 - u) * 6).toFixed(1)}px)`; font(c, pf ? 'serifI' : kind, s); c.fillStyle = pf ? C.pink : C.ink; c.fillText(w, x, y + (1 - u) * s * 0.3); c.restore(); } x += wd[i] + sp; }); };
    fadeOut(c, f, 560, () => { c.save(); c.strokeStyle = C.ink; c.globalAlpha = 0.5; c.lineWidth = 2; c.beginPath(); c.arc(CX, CY, R, -Math.PI / 2, -Math.PI / 2 + d * Math.PI * 2); c.stroke(); c.restore();
      const L = [['Perfect,', 'is the perfect name for you,'], ['which is perfectly true,', 'the perfect you.'], ['perfectly fresh,', 'perfectly new.'], ['constant, steady,', 'always the same.']], st = [30, 160, 290, 420];
      L.forEach(([a, b], i) => { const f0 = st[i], f1 = (i < 3 ? st[i + 1] : 560) - 16; if (f < f0 || f > f1 + 18) return; fadeOut(c, f, f1, () => { hl(a, f0, CY - 20, i === 0 ? 120 : 76); hl(b, f0 + 18, CY + (i === 0 ? 90 : 80), 60, 'serifI'); }); }); });
  } },
};
const P = POSTS[SLUG];

// ---- an excerpt from the post, read line by line; only the exact key phrase is set in rose, with an underline that sweeps in
function tokens(text, hi) {   // words with their line breaks, flagged when they fall inside the phrase
  const at = text.lastIndexOf(hi), out = []; let i = 0;
  for (const m of text.matchAll(/(\n)|([^ \n]+)/g)) { if (m[1]) { out.push({ br: true }); continue; } const st = m.index, en = st + m[2].length; out.push({ w: m[2], h: at >= 0 && st >= at && en <= at + hi.length }); }
  return out;
}
function excerpt(c, f, f0, f1, text, hi) {
  if (f < f0 || f > f1 + 18) return; const poem = text.includes('\n'), size = PORT ? 54 : 58, maxW = PORT ? 920 : 1280, lh = size * (poem ? 1.4 : 1.48);
  // lay out lines
  const T = tokens(text, hi), lines = [[]]; let lw = 0; font(c, 'serif', size); const sp = c.measureText(' ').width;
  for (const t of T) { if (t.br) { lines.push([]); lw = 0; continue; } font(c, t.h ? 'serifI' : 'serif', size); t.wd = c.measureText(t.w).width; if (lw + t.wd > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0; } lines[lines.length - 1].push(t); lw += t.wd + sp; }
  const y0 = CY - (lines.length - 1) * lh / 2 + size * 0.3, ex = E.exit(prog(f, f1, f1 + 18)); c.save(); c.globalAlpha = 1 - ex;
  const qu = E.out(prog(f, f0, f0 + 30)); c.save(); c.globalAlpha *= 0.12 * qu; font(c, 'serif', 300); c.textAlign = 'center'; c.fillStyle = C.pink; c.fillText('“', CX, y0 - size - 10 + 140 - (1 - qu) * 20); c.restore();
  const per = Math.min(14, (f1 - f0 - 90) / lines.length);
  lines.forEach((L, i) => { const s0 = f0 + 12 + i * per, y = y0 + i * lh, w = L.reduce((p, t) => p + t.wd, 0) + sp * (L.length - 1); let x = CX - w / 2; let ha = null, hb = null;
    L.forEach((t, k) => { const u = E.out(prog(f, s0 + k * 2, s0 + k * 2 + 22)); if (u > 0) { c.save(); c.globalAlpha *= u; if (u < 1) c.filter = `blur(${((1 - u) * 5).toFixed(1)}px)`; font(c, t.h ? 'serifI' : 'serif', size); c.fillStyle = t.h ? C.pink : C.ink; c.fillText(t.w, x, y + (1 - u) * 10); c.restore(); }
      if (t.h) { if (ha === null) ha = x; hb = x + t.wd; } x += t.wd + sp; });
    if (ha !== null) { const sw = E.inOut(prog(f, s0 + 34, s0 + 66)); c.save(); c.strokeStyle = C.pink; c.globalAlpha *= 0.7; c.lineWidth = 2; c.beginPath(); c.moveTo(ha, y + 14); c.lineTo(ha + (hb - ha) * sw, y + 14); c.stroke(); c.restore(); } });
  cap(c, '— FROM THE ' + P.cat, f, f0 + 40, y0 + (lines.length - 1) * lh + size * 1.5);
  c.restore();
}
// ---- the cover art: the post's own motion form, as on the site (js/motion-forms*.js)
function cover(c, f, a, p) { if (a <= 0 || !A.form) return; c.save(); c.globalAlpha *= a; LIB.form(c, A.form, CX, CY + (PORT ? -40 : 0), PORT ? 960 : 860, p, C.ink, 0, 1.1); c.restore(); }
// ---- the title card
function titleCard(c, f) {
  if (f > KIN + 20) return; const ex = E.exit(prog(f, KIN - 16, KIN + 6)); c.save(); c.globalAlpha = 1 - ex;
  cover(c, f, 0.22, E.smooth(prog(f, 0, 120)));
  cap(c, P.cat + ' · ' + P.date, f, 6, CY - (PORT ? 150 : 120));
  const s = fit(c, P.title, 'serif', PORT ? 104 : 120, W * 0.84); LIB.wordsIn(c, P.title, f, 14, 5, CX, CY + s * 0.3, s, 'serif', C.ink, 'center');
  rule(c, f, 30, CY + (PORT ? 90 : 90), PORT ? 200 : 240, C.pink);
  c.restore();
}
// ---- the end card
function card(c, f) {
  if (f < CARD) return; const u = E.out(prog(f, CARD, CARD + 30)), y0 = CY - (PORT ? 120 : 90);
  c.save(); cover(c, f, 0.16 * u, 1); c.globalAlpha = u; cap(c, P.cat + ' · ' + P.date, f, CARD, y0 - (PORT ? 120 : 100));
  const s = fit(c, P.title, 'serif', (PORT ? 96 : 110), W * 0.84); c.save(); c.filter = u < 1 ? `blur(${((1 - u) * 8).toFixed(1)}px)` : 'none'; font(c, 'serif', s); c.textAlign = 'center'; c.fillStyle = C.ink; c.fillText(P.title, CX, y0 + (1 - u) * 18); c.restore();
  rule(c, f, CARD + 20, y0 + (PORT ? 70 : 60), PORT ? 240 : 260, C.pink);
  const v = E.out(prog(f, CARD + 40, CARD + 66)); c.globalAlpha = v; font(c, 'serifI', PORT ? 50 : 46); c.textAlign = 'center'; c.fillStyle = C.ink2; c.fillText('Nikit Hamal', CX, y0 + (PORT ? 170 : 150));
  const url = 'nikit.is-a.dev/writings/' + SLUG, us = fit(c, url, 'mono', PORT ? 26 : 24, W * 0.88); font(c, 'mono', us, 500); c.letterSpacing = '1px'; c.fillStyle = C.ink; c.globalAlpha = E.out(prog(f, CARD + 60, CARD + 86)); c.fillText(url, CX, y0 + (PORT ? 260 : 230));
  c.restore();
}
// ---- a hairline reading-progress line along the bottom
function progress(c, f) { const y = H - (PORT ? 120 : 56), half = PORT ? 300 : 360, p = clamp(f / (TOTAL - 1)); c.save(); c.globalAlpha = 0.9; c.fillStyle = C.line; c.fillRect(CX - half, y, half * 2, 1.5); c.fillStyle = C.pink; c.fillRect(CX - half, y, half * 2 * p, 1.5); c.restore(); }
function paper(c) { c.fillStyle = C.paper; c.fillRect(0, 0, W, H); const g = c.createRadialGradient(CX, CY, Math.min(W, H) * 0.15, CX, CY, Math.hypot(W, H) * 0.6); g.addColorStop(0, 'rgba(255,252,246,0.5)'); g.addColorStop(1, 'rgba(150,120,90,0.14)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
function grain(c, f) { c.save(); c.globalAlpha = 0.06; c.globalCompositeOperation = 'overlay'; const ox = (hash(Math.floor(f / 2)) * 512) | 0, oy = (hash(Math.floor(f / 2) + 7) * 512) | 0; for (let y = -oy; y < H; y += 512) for (let x = -ox; x < W; x += 512) c.drawImage(A.grain, x, y); c.restore(); }
async function load() {
  await LIB.fonts();
  if (window.getMotionFormSvg) { const svg = window.getMotionFormSvg(SLUG), i = window.ALL_MOTION_FORMS.indexOf(svg), F = LIB.loadForms(); A.form = F[Math.max(0, i)]; }
  A.dog = LIB.dogKit('rottie');
  A.ocean = points('Ocean', 'serifI', PORT ? 220 : 240, 5); A.god = points('God', 'serif', PORT ? 260 : 280, 6);
  // the chase: angle integrated from the speed curve so slowing down is smooth
  const angs = [0]; for (let f = 1; f <= TOTAL; f++) { const sp = mix(1.6, 4.2, E.smooth(prog(f, 20, 260))) * (1 - E.inOut(prog(f, 300, 380))); angs.push(angs[f - 1] + sp * 0.022); } A.angAt = f => angs[Math.max(0, Math.min(TOTAL, Math.round(f)))];   // (kinetic-local frames)
  A.grain = document.createElement('canvas'); A.grain.width = 512; A.grain.height = 512; const g = A.grain.getContext('2d'), id = g.createImageData(512, 512); let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (rnd() - 0.5) * 70; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } g.putImageData(id, 0, 0);
}
function draw(c, f) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none'; c.imageSmoothingEnabled = true; paper(c);
  titleCard(c, f); if (f >= KIN - 4 && f < EXS + 20) P.draw(c, f - KIN);
  const n = P.ex.length, seg = (CARD - EXS) / n; P.ex.forEach(([t, h], i) => excerpt(c, f, EXS + i * seg, EXS + (i + 1) * seg - 22, t, h));
  card(c, f); progress(c, f); grain(c, f);
  const fin = 1 - prog(f, 0, 8); if (fin > 0) { c.fillStyle = C.paper; c.globalAlpha = fin; c.fillRect(0, 0, W, H); c.globalAlpha = 1; } }
const cv = document.getElementById('c'); cv.width = W; cv.height = H;
const frame = LIB.blurFrame(cv, draw, [], 8);
window.film = { load, frame, TOTAL, W, H, POSTS: Object.keys(POSTS) };
