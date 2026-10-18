// "I write." — a 56 s typographic film for Nikit Hamal, made only of his own words and his painted faces. 60 fps, 80 BPM (beat = 45 f, bar = 180 f).
// Landscape 1920x1080 by default; ?v=portrait renders the hand-laid-out 1080x1920 cut. Everything is centred on one vertical axis.
// Device: the letter "I". "hi, I'm Nikit." collapses to its "I", which becomes "I write.", then the axis the whole film is built on —
// and then every essay asks the same question of it: which "I"? Engine: ../shared/lib.js. Every frame is a pure function of f.
'use strict';
const { E, clamp, prog, mix, hash, font, portrait } = LIB;
const PORT = new URLSearchParams(location.search).get('v') === 'portrait';
const W = PORT ? 1080 : 1920, H = PORT ? 1920 : 1080, CX = W / 2, CY = H / 2, TOTAL = 3360, K = PORT ? 1.04 : 1;   // K: type scale for the narrow frame
const C = { paper: '#f4ede2', ink: '#1d1a17', ink2: '#5b544c', mute: '#8a8178', pink: '#c9607f', line: 'rgba(29,26,23,0.18)' };
// ---- timeline (frames). score.py mirrors these numbers.
const T = {
  type: 8, fall: [104, 150], write: 150, big: [300, 350], split: [440, 490],
  trio: 480, glance: [560, 650], met: 600, many: 660, trioOut: [744, 780],
  ideas: 790, mirror: 850, ideasOut: 944,
  be: 966, strike: [1026, 1044], which: 1052, beOut: 1180,
  iy: 1204, near: [1214, 1290], melt: [1300, 1330], love: 1318, iyOut: 1424,
  sf: 1446, part: [1520, 1560], between: 1556, sfOut: 1606,
  un: 1626, drift: [1660, 1730], pretense: 1680, unOut: 1786,
  th: 1806, echo: [1830, 1920], mind: 1904, nothing: [1950, 1980],
  god: 1990, scroll: [1996, 2052], neither: [2060, 2116, 2172], godOut: 2236,
  dream: 2256, dreamTxt: 2276, step: 2340, wake: 2424, finished: 2436, dreamOut: 2510,
  pond: 2524, iris: [2524, 2564], drops: 2570, night: [2650, 2690], star: 2700, irisOut: [2788, 2820],
  take: 2830, morph: [2850, 2950], takeTxt: 2870, takeOut: 2990,
  lock: 3000, lname: 3040, lwrite: 3080, lurl: 3120, wink: 3290, end: 3360,
};
const TITLES = ['A Love that never hurts', 'Blessed', 'Effort clouds effortless', 'Everything is thought', 'God and The Ocean', 'How to be happy?', '“I” and “You” cannot Love',
  'I offer my curse to God', 'In relationship, there is no love', 'Interconnectedness', 'Love is acceptance', 'Perfect', 'Take me as I am', 'The lie of “being yourself”',
  'The Non-Dual Relationship', 'The Wrong Guy Trying to Wake Up', 'There is only one step', 'Unity is a lie', 'We came out of this world', 'We never met',
  'What is divine self?', 'Where is God?', 'Wisdom cannot be taught', 'You never trusted anyone', 'You'];
const LAND = TITLES.indexOf('Where is God?');
const A = {};
async function load() {
  await LIB.fonts();
  const look = keys => LIB.eyeTrack({ keys, blinks: [], winks: [] });
  // trio: baby looks right, curls looks left then right, now looks left — they glance at each other, then at you
  const trioKeys = PORT ? [[[480, 0, 0], [580, 0, 0.9], [650, 0, 0], [720, 0.2, 0.1]], [[480, 0, 0], [580, 0, -0.9], [620, 0, 0.9], [650, 0, 0]], [[480, 0, 0], [590, 0, -0.9], [650, 0, 0], [720, -0.2, 0.1]]]
    : [[[480, 0, 0], [580, 1, 0.1], [650, 0, 0], [720, 0.3, 0.1]], [[480, 0, 0], [580, -1, 0.1], [620, 1, 0.1], [650, 0, 0]], [[480, 0, 0], [590, -1, 0.1], [650, 0, 0], [720, -0.3, 0.1]]];
  const blinks = [[612, 700], [634, 706], [600, 716]];
  A.trio = [];
  for (const [i, id] of ['baby', 'curls', 'now'].entries()) A.trio.push(await LIB.loadPortrait('../shared/art', id, LIB.eyeTrack({ keys: trioKeys[i], blinks: [...blinks[i], 2870 + i * 6], winks: [] })));
  // the dreamer: eyes shut until "Just wake up", then open; later the final wink
  const nowTrack = LIB.eyeTrack({ keys: [[0, 0, 0], [2424, 0, 0], [2440, 0, -0.2], [2470, 0, 0], [3000, 0, 0], [3060, 0, 0.15], [3200, 0.15, 0.05], [3260, 0, 0]], blinks: [3150, 3230], winks: [[T.wink, 'l']] });
  A.now = { ...A.trio[2], track: f => { const s = nowTrack(f); if (f >= T.dream - 20 && f < T.wake + 6) { const o = clamp((f - T.wake) / 6); s.L = Math.min(s.L, o); s.R = Math.min(s.R, o); } return s; } };
  const o = PORT ? 'port' : 'land'; A.golden = await LIB.loadClip(`../shared/pond/${o}_golden.webm`, 150); A.night = await LIB.loadClip(`../shared/pond/${o}_night.webm`, 150);
  A.dog = LIB.dogKit('rottie');
  A.grain = document.createElement('canvas'); A.grain.width = 512; A.grain.height = 512; const g = A.grain.getContext('2d'), id = g.createImageData(512, 512);
  let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (rnd() - 0.5) * 70; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } g.putImageData(id, 0, 0);
}

// ---- type helpers (all centred on the axis unless asked otherwise)
function fit(c, text, kind, size, maxW = W * 0.86) { font(c, kind, size); const w = c.measureText(text).width; return w > maxW ? size * maxW / w : size; }
function lineIn(c, text, f, f0, step, y, size, kind = 'serif', col = C.ink, outF = 1e9, x = CX, align = 'center') { const s = fit(c, text, kind, size * K); return LIB.wordsIn(c, text, f, f0, step, x, y, s, kind, col, align, outF); }
// per-letter drawing: fn(i, ch, f) -> {dx, dy, a, blur, s} ; returns the letter x positions
function letters(c, text, x, y, size, kind, col, fn) {
  font(c, kind, size); const ws = [...text].map(ch => c.measureText(ch).width), tw = c.measureText(text).width; let lx = x - tw / 2; const xs = [];
  [...text].forEach((ch, i) => { const o = fn ? fn(i, ch) : {}; xs.push(lx + ws[i] / 2); if ((o.a ?? 1) > 0.002) { c.save(); c.globalAlpha *= o.a ?? 1; if (o.blur > 0.3) c.filter = `blur(${o.blur.toFixed(1)}px)`;
    c.translate(lx + ws[i] / 2 + (o.dx || 0), y + (o.dy || 0)); if (o.s && o.s !== 1) c.scale(o.s, o.s); if (o.r) c.rotate(o.r); font(c, kind, size); c.fillStyle = o.col || col; c.textAlign = 'center'; c.fillText(ch, 0, 0); c.restore(); }
    lx += ws[i]; });
  return xs;
}
function cap(c, text, f, f0, y, outF = 1e9) { const u = E.out(prog(f, f0, f0 + 24)) * (1 - E.exit(prog(f, outF, outF + 14))); if (u <= 0) return; c.save(); c.globalAlpha *= u; font(c, 'mono', Math.round(18 * (PORT ? 1.2 : 1)), 500); c.letterSpacing = '5px'; c.fillStyle = C.mute; c.textAlign = 'center'; c.fillText(text, CX, y); c.restore(); }
function rule(c, f, f0, y, half, outF = 1e9, col = C.line) { const u = E.inOut(prog(f, f0, f0 + 30)) * (1 - E.exit(prog(f, outF, outF + 14))); if (u <= 0) return; c.save(); c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath(); c.moveTo(CX - half * u, y); c.lineTo(CX + half * u, y); c.stroke(); c.restore(); }
// a painted portrait, whole (no crop), in a soft card
function card(c, P, f, cx, cy, h, a = 1, s = 1) {
  if (a <= 0) return; const w = h * 0.8; c.save(); c.globalAlpha *= a; c.translate(cx, cy); c.scale(s, s);
  c.save(); c.shadowColor = 'rgba(60,40,20,0.18)'; c.shadowBlur = h * 0.08; c.shadowOffsetY = h * 0.03; c.fillStyle = '#efe7da'; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, h * 0.04); c.fill(); c.restore();
  portrait(c, P, f, 0, 0, h, 0, [w, h], 500); c.restore();
}

// ---- paper
function paper(c, f) {
  c.fillStyle = C.paper; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(CX, CY, Math.min(W, H) * 0.15, CX, CY, Math.hypot(W, H) * 0.6); g.addColorStop(0, 'rgba(255,252,246,0.5)'); g.addColorStop(1, 'rgba(150,120,90,0.14)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
}
function grain(c, f) { c.save(); c.globalAlpha = 0.06; c.globalCompositeOperation = 'overlay'; const ox = (hash(Math.floor(f / 2)) * 512) | 0, oy = (hash(Math.floor(f / 2) + 7) * 512) | 0;
  for (let y = -oy; y < H; y += 512) for (let x = -ox; x < W; x += 512) c.drawImage(A.grain, x, y); c.restore(); }

// ---- 1. "hi, I'm Nikit." -> "I write." -> the I becomes the axis -> splits into three
const HELLO = "hi, I'm Nikit.", IAT = HELLO.indexOf('I');
function sHello(c, f) {
  if (f >= T.split[1]) return; const S = 120 * K, y = CY + S * 0.32;
  font(c, 'serif', S); const helloW = c.measureText(HELLO).width, iW = c.measureText('I').width, sp = c.measureText(' ').width, wrW = c.measureText('write.').width;
  const xs0 = CX - helloW / 2; let pre = 0; font(c, 'serif', S); pre = c.measureText(HELLO.slice(0, IAT)).width;
  const iFrom = xs0 + pre + iW / 2, iTo = CX - (iW + sp + wrW) / 2 + iW / 2, fallU = E.inOut(prog(f, T.fall[0] + 10, T.fall[1] + 10));
  const big = E.inOut(prog(f, ...T.big)), sp3 = E.inOut(prog(f, ...T.split));
  // the hello, typed with a pen; then every letter but the I falls away
  if (f < T.fall[1] + 20) {
    const n = Math.min(HELLO.length, Math.floor(Math.max(0, f - T.type) / 4) + 1);
    letters(c, HELLO, CX, y, S, 'serif', C.ink, (i, ch) => {
      if (i >= n || f < T.type) return { a: 0 }; if (i === IAT) return { a: 0 };
      const d = prog(f, T.fall[0] + Math.abs(i - IAT) * 2.5, T.fall[0] + Math.abs(i - IAT) * 2.5 + 26), e = E.exit(d);
      return { a: 1 - e, dy: e * S * 0.9, blur: e * 10, r: e * (i < IAT ? -0.25 : 0.25) * (1 + (i % 3) * 0.3) };
    });
    if (f >= T.type && f < T.fall[0]) { const xe = xs0 + c.measureText(HELLO.slice(0, n)).width; if (n < HELLO.length || Math.floor(f / 15) % 2 === 0) { c.fillStyle = C.ink; c.globalAlpha = 0.8; c.fillRect(xe + 6, y - S * 0.74, 3, S * 0.9); c.globalAlpha = 1; } }
  }
  // the I: slides to its place in "I write.", then grows into the axis and splits in three
  if (f >= T.type + IAT * 4) {
    const ix = mix(iFrom, iTo, fallU), bx = mix(ix, CX, big), sz = mix(S, (PORT ? 1500 : 1000), big), by = mix(y, CY + sz * 0.33, big);
    if (sp3 <= 0) { c.save(); font(c, 'serif', sz); c.textAlign = 'center'; c.fillStyle = C.ink; c.fillText('I', bx, by); c.restore(); }
    else {   // three strokes part, widen, and fade into the three cards
      const gap = PORT ? 0 : (448 + 60), gapY = PORT ? (384 * 1.25 + 40) : 0;
      for (let k = -1; k <= 1; k++) { c.save(); c.globalAlpha = 1 - E.exit(prog(f, T.split[0] + 20, T.split[1])); const sk = mix(1, PORT ? 0.3 : 0.5, sp3); font(c, 'serif', sz * sk); c.textAlign = 'center'; c.fillStyle = C.ink;
        c.fillText('I', CX + k * gap * sp3, by + k * gapY * sp3 - (sz - sz * sk) * 0.33); c.restore(); }
    }
  }
  if (f >= T.write && big < 1) letters(c, 'write.', CX - (iW + sp + wrW) / 2 + iW + sp + wrW / 2, y, S, 'serifI', C.ink, (i) => { const u = E.out(prog(f, T.write + i * 4, T.write + i * 4 + 24)); return { a: u * (1 - big * 2), dy: (1 - u) * S * 0.4, blur: (1 - u) * 8 }; });
}
// ---- 2. how many Nikits are there?
function trioPos(i) { return PORT ? [CX, 760 + (i - 1) * (384 * 1.25 + 40), 384 * 1.25] : [CX + (i - 1) * (448 + 60), CY - 60, 560]; }
function sTrio(c, f) {
  if (f < T.trio || f > T.trioOut[1] + 2) return; const out = E.inOut(prog(f, ...T.trioOut));
  for (let i = 0; i < 3; i++) { const [x, y, h] = trioPos(i), u = E.out(prog(f, T.trio + i * 8, T.trio + 40 + i * 8)); card(c, A.trio[i], f, x, y + (1 - u) * 30, h, u * (1 - out), mix(0.94, 1, u) * mix(1, 0.92, out)); }
  const by = PORT ? 1690 : CY + 330;
  if (f < T.many + 4) { const u = E.out(prog(f, T.met, T.met + 24)) * (1 - E.exit(prog(f, T.many - 14, T.many))); c.save(); c.globalAlpha = u; lineIn(c, 'We never met.', f, T.met, 6, by, 64); c.restore(); }
  else { lineIn(c, 'Do you see,', f, T.many, 5, by - (PORT ? 0 : 0), 56, 'serifI', C.ink2, T.trioOut[0]); lineIn(c, 'how many Nikits are there?', f, T.many + 14, 5, by + 72 * K, 56, 'serifI', C.pink, T.trioOut[0]); }
}
// ---- 3. what met was our ideas of each other — with its reflection
function sIdeas(c, f) {
  if (f < T.ideas || f > T.ideasOut + 20) return; const S = 76 * K, y0 = CY - 30;
  lineIn(c, 'You and I only meet', f, T.ideas, 6, y0 - S * 1.3, 76, 'serif', C.ink, T.ideasOut);
  // "the idea of ours" sits on the axis line with its mirror image beneath, like water
  const m = E.inOut(prog(f, T.mirror, T.mirror + 40)), ex = E.exit(prog(f, T.ideasOut, T.ideasOut + 16)); const s = fit(c, 'the idea of ours', 'serifI', S);
  rule(c, f, T.mirror - 20, y0 + 16, (PORT ? 420 : 520), T.ideasOut);
  c.save(); c.globalAlpha = 1 - ex; LIB.wordsIn(c, 'the idea of ours', f, T.ideas + 30, 6, CX, y0, s, 'serifI', C.pink, 'center');
  if (m > 0) { c.save(); c.translate(0, (y0 + 16) * 2); c.scale(1, -1); c.globalAlpha *= m * 0.32; c.filter = `blur(${(1.5 + (1 - m) * 4).toFixed(1)}px)`; font(c, 'serifI', s); c.textAlign = 'center'; c.fillStyle = C.pink; c.fillText('the idea of ours', CX, y0 + 6 * Math.sin(f / 9)); c.restore(); }
  c.restore();
  lineIn(c, 'about others.', f, T.mirror + 30, 6, y0 + S * 2.0, 60, 'serif', C.ink2, T.ideasOut);
  cap(c, '— WE NEVER MET', f, T.mirror + 50, y0 + S * 3.0, T.ideasOut);
}
// ---- 4. be yourself (as it was)
function sBe(c, f) {
  if (f < T.be || f > T.beOut + 16) return; const S = 170 * K, y = CY - 20, ex = E.exit(prog(f, T.beOut, T.beOut + 16));
  c.save(); c.globalAlpha = 1 - ex;
  LIB.typed(c, 'Be yourself.', f, T.be, CX, y, S, { kind: 'serif', rate: 3, align: 'center', caretUntil: T.strike[0], col: C.ink });
  const s = E.out(prog(f, ...T.strike)); if (s > 0) { font(c, 'serif', S); const w = c.measureText('Be yourself.').width; c.strokeStyle = C.ink; c.lineWidth = S * 0.055; c.lineCap = 'round'; c.beginPath(); c.moveTo(CX - w / 2 - 20, y - S * 0.3); c.lineTo(CX - w / 2 - 20 + (w + 40) * s, y - S * 0.3 - 10 * s); c.stroke(); }
  if (PORT) { lineIn(c, 'Which self are you', f, T.which, 5, y + 150, 64, 'serifI', C.pink); lineIn(c, 'talking about?', f, T.which + 20, 5, y + 150 + 80, 64, 'serifI', C.pink); }
  else lineIn(c, 'Which self are you talking about?', f, T.which, 5, y + 140, 64, 'serifI', C.pink);
  cap(c, '— THE LIE OF “BEING YOURSELF”', f, T.which + 50, y + (PORT ? 340 : 240));
  c.restore();
}
// ---- 5. "I" and "You" cannot love: they drift together, never touch, and only love is left
function sIY(c, f) {
  if (f < T.iy || f > T.iyOut + 16) return; const S = 190 * K, y = CY + S * 0.3 - 30, ex = E.exit(prog(f, T.iyOut, T.iyOut + 16));
  const inU = E.out(prog(f, T.iy, T.iy + 30)), near = E.inOut(prog(f, ...T.near)), melt = E.inOut(prog(f, ...T.melt));
  font(c, 'serif', S); const wi = c.measureText('“I”').width, wy = c.measureText('“You”').width, far = PORT ? 330 : 560, gap = mix(far, 40, near) + Math.sin(f * 0.9) * 3 * near * (1 - melt);
  c.save(); c.globalAlpha = (1 - ex);
  [['“I”', CX - gap / 2 - wi / 2, -1], ['“You”', CX + gap / 2 + wy / 2, 1]].forEach(([t, x, sd]) => { c.save(); c.globalAlpha *= inU * (1 - melt); if (melt > 0) c.filter = `blur(${(melt * 14).toFixed(1)}px)`;
    font(c, 'serif', S * (1 - melt * 0.15)); c.textAlign = 'center'; c.fillStyle = C.ink; c.fillText(t, x + sd * melt * 40, y - melt * 30); c.restore(); });
  if (f >= T.love) { const u = E.out(prog(f, T.love, T.love + 40)); c.save(); c.globalAlpha *= u; c.filter = u < 1 ? `blur(${((1 - u) * 10).toFixed(1)}px)` : 'none'; font(c, 'serifI', S * mix(0.7, 1, u)); c.textAlign = 'center'; c.fillStyle = C.pink; c.fillText('love', CX, y); c.restore(); }
  cap(c, '— “I” AND “YOU” CANNOT LOVE', f, T.love + 40, y + (PORT ? 150 : 140));
  c.restore();
}
// ---- 6. selfish, or not: the sentence is cut exactly on the axis; the halves part symmetrically and a line is drawn between them
function sSelfish(c, f) {
  if (f < T.sf || f > T.sfOut + 16) return; const ex = E.exit(prog(f, T.sfOut, T.sfOut + 16)), part = E.inOut(prog(f, ...T.part)), wall = E.inOut(prog(f, T.part[0] + 18, T.part[1] + 14));
  const a = 'Either a person is selfish,', b = 'or they are not.', y = CY;
  c.save(); c.globalAlpha = 1 - ex;
  if (!PORT) {
    const S = 80; font(c, 'serif', S); const wa = c.measureText(a).width, sp = c.measureText(' ').width; font(c, 'serifI', S); const wb = c.measureText(b).width;
    const xs = CX - (wa + sp + wb) / 2 + wa + sp / 2, G = 170;   // where the sentence naturally breaks -> the axis
    const ra = mix(xs - sp / 2, CX - G / 2, part), lb = mix(xs + sp / 2, CX + G / 2, part);
    LIB.wordsIn(c, a, f, T.sf, 5, ra, y, S, 'serif', C.ink, 'right'); LIB.wordsIn(c, b, f, T.sf + 26, 5, lb, y, S, 'serifI', C.ink2, 'left');
    if (wall > 0) { const mid = y - S * 0.32, hh = S * 1.1 * wall; c.save(); c.strokeStyle = C.pink; c.lineWidth = 2; c.beginPath(); c.moveTo(CX, mid - hh); c.lineTo(CX, mid + hh); c.stroke();
      c.fillStyle = C.pink; [mid - hh, mid + hh].forEach(yy => { c.beginPath(); c.arc(CX, yy, 3.5 * wall, 0, 7); c.fill(); }); c.restore(); }
    lineIn(c, 'There is nothing in between.', f, T.between + 10, 5, y + 190, 54, 'serifI', C.pink);
    cap(c, '— UNITY IS A LIE', f, T.between + 30, y + 270);
  } else {
    const S = 76, g = mix(54, 150, part); line2(a, y - g + S * 0.3 - 10, 'serif', C.ink, T.sf); line2(b, y + g + S * 0.3 - 10, 'serifI', C.ink2, T.sf + 26);
    if (wall > 0) { const hw = 230 * wall; c.save(); c.strokeStyle = C.pink; c.lineWidth = 2; c.beginPath(); c.moveTo(CX - hw, y - 10); c.lineTo(CX + hw, y - 10); c.stroke();
      c.fillStyle = C.pink; [CX - hw, CX + hw].forEach(xx => { c.beginPath(); c.arc(xx, y - 10, 3.5 * wall, 0, 7); c.fill(); }); c.restore(); }
    lineIn(c, 'There is nothing in between.', f, T.between + 10, 5, y + 360, 56, 'serifI', C.pink);
    cap(c, '— UNITY IS A LIE', f, T.between + 30, y + 450);
    function line2(t, yy, kind, col, f0) { LIB.wordsIn(c, t, f, f0, 5, CX, yy, fit(c, t, kind, S), kind, col, 'center'); }
  }
  c.restore();
}
// ---- 7. UNITY flies apart
function sUnity(c, f) {
  if (f < T.un || f > T.unOut + 16) return; const S = (PORT ? 210 : 240), y = CY + 40, ex = E.exit(prog(f, T.unOut, T.unOut + 16)), dr = E.inOut(prog(f, ...T.drift));
  c.save(); c.globalAlpha = 1 - ex; c.letterSpacing = `${S * 0.08}px`;
  letters(c, 'UNITY', CX, y, S, 'serif', C.ink, (i) => { const u = E.out(prog(f, T.un + i * 4, T.un + i * 4 + 26)), d = i - 2;
    return { a: u * (1 - dr * 0.75), dy: (1 - u) * 40 + dr * Math.abs(d) * 24 * (d % 2 ? -1 : 1), dx: dr * d * (PORT ? 70 : 150), r: dr * d * 0.12, blur: dr * Math.abs(d) * 2.5 }; });
  c.letterSpacing = '0px';
  lineIn(c, 'is nothing but a pretense.', f, T.pretense, 5, y + (PORT ? 150 : 140), 64, 'serifI', C.pink);
  c.restore();
}
// ---- 8. everything is thought: the word rings outward, then even that goes; nothing
function sThought(c, f) {
  if (f < T.th || f > T.nothing[1] + 4) return; const S = 110 * K, y = CY + S * 0.3, gone = E.inOut(prog(f, ...T.nothing));
  c.save(); c.globalAlpha = 1 - gone;
  font(c, 'serif', S); const w1 = c.measureText('Everything is ').width; font(c, 'serifI', S); const w2 = c.measureText('thought.').width, x0 = CX - (w1 + w2) / 2;
  LIB.wordsIn(c, 'Everything is', f, T.th, 6, x0, y, S, 'serif', C.ink, 'left');
  const tx = x0 + w1 + w2 / 2, u = E.out(prog(f, T.th + 16, T.th + 44));
  for (let k = 0; k < 5; k++) { const p = ((f - T.echo[0]) / 46 - k * 0.22); if (f < T.echo[0] || p < 0 || p > 1) continue; c.save(); c.globalAlpha *= (1 - p) * 0.35; font(c, 'serifI', S * (1 + p * 1.6)); c.textAlign = 'center'; c.fillStyle = C.pink; c.fillText('thought.', tx, y + S * 0.3 * p * 0.4); c.restore(); }
  c.save(); c.globalAlpha *= u; font(c, 'serifI', S); c.textAlign = 'center'; c.fillStyle = C.pink; c.fillText('thought.', tx, y + (1 - u) * 30); c.restore();
  lineIn(c, 'Out of mind, there is nothing.', f, T.mind, 6, y + (PORT ? 150 : 150), 54, 'serif', C.ink2);
  c.restore();
}
// ---- 9. Where is God? (as it was: the titles scroll and land, then three couplets)
function sGod(c, f) {
  if (f < T.god || f > T.godOut + 16) return; const ex = E.exit(prog(f, T.godOut, T.godOut + 16));
  c.save(); c.globalAlpha = 1 - ex;
  const ts = 72 * K, p = E.out(prog(f, ...T.scroll)), lh = ts * 1.65, land = LAND + TITLES.length * 2, pos = mix(land - 16, land, p), fade = E.inOut(prog(f, T.god, T.god + 16));
  const nY = mix(CY, PORT ? CY - 420 : 300, E.inOut(prog(f, T.neither[0] - 10, T.neither[0] + 14)));
  for (let k = Math.floor(pos) - 8; k <= Math.floor(pos) + 8; k++) {
    const t = TITLES[((k % TITLES.length) + TITLES.length) % TITLES.length], y = nY + (k - pos) * lh, d = Math.abs(k - pos);
    const fa = clamp(1 - d / (PORT ? 6 : 4)) * fade * (k === land ? 1 : 1 - E.smooth(prog(f, T.scroll[1] - 6, T.neither[0] - 4))); if (fa <= 0) continue;
    const sz = fit(c, t, 'serif', k === land ? ts * 1.33 : ts); font(c, 'serif', sz); c.textAlign = 'center'; c.fillStyle = d < 0.5 ? C.ink : C.ink2; c.globalAlpha = (1 - ex) * fa; c.fillText(t, CX, y + 30);
  }
  c.globalAlpha = 1 - ex; c.textAlign = 'left';
  const L = [['God is neither in,', 'nor out.'], ['God is neither above,', 'nor below.'], ['God is neither time,', 'nor the timeless.']], my = CY;
  L.forEach(([a, b], i) => { const f0 = T.neither[i], f1 = (i < 2 ? T.neither[i + 1] : T.godOut) - 16; if (f < f0 || f > f1 + 18) return;
    if (PORT) { lineIn(c, a, f, f0, 5, my - 10, 84, 'serif', C.ink, f1); lineIn(c, b, f, f0 + 16, 5, my + 90, 84, 'serifI', C.pink, f1); }
    else { LIB.wordsIn(c, a, f, f0, 5, CX - 40, my + 60, 84, 'serif', C.ink, 'right', f1); LIB.wordsIn(c, b, f, f0 + 16, 5, CX - 10, my + 60, 84, 'serifI', C.pink, 'left', f1); }
    const u = E.inOut(prog(f, f0 + 20, f0 + 44)) * (1 - E.exit(prog(f, f1, f1 + 14))); if (u > 0) { c.save(); c.strokeStyle = C.pink; c.globalAlpha *= 0.6 * u; c.lineWidth = 2; const ly = PORT ? my + 140 : my + 100, hw = (PORT ? 220 : 300) * u; c.beginPath(); c.moveTo(CX - hw, ly); c.lineTo(CX + hw, ly); c.stroke(); c.restore(); } });
  c.restore();
}
// ---- 10. one single step: the painting dreams with its eyes shut — then wakes
function sDream(c, f) {
  if (f < T.dream || f > T.dreamOut + 16) return; const ex = E.exit(prog(f, T.dreamOut, T.dreamOut + 16)), u = E.out(prog(f, T.dream, T.dream + 40));
  const h = PORT ? 760 : 560, cy = PORT ? 820 : CY - 70, wk = E.out(prog(f, T.wake, T.wake + 20));
  c.save(); c.globalAlpha = 1 - ex;
  if (wk > 0 && wk < 1) { c.save(); c.globalAlpha *= (1 - wk) * 0.5; c.fillStyle = '#fffaf0'; c.fillRect(0, 0, W, H); c.restore(); }
  card(c, A.now, f, CX, cy, h, u, mix(0.97, 1, u) * (1 + wk * 0.02));
  const ty = PORT ? 1420 : CY + 300, ty2 = ty + 70 * K;
  if (f < T.step - 2) { lineIn(c, 'Before waking up,', f, T.dreamTxt, 6, ty, 58, 'serif', C.ink2, T.step - 18); lineIn(c, 'all is a dream.', f, T.dreamTxt + 16, 6, ty2, 58, 'serifI', C.ink2, T.step - 18); }
  else if (f < T.wake) { lineIn(c, 'There is only', f, T.step, 6, ty, 58, 'serif', C.ink, T.wake - 16); lineIn(c, 'one single step.', f, T.step + 16, 6, ty2, 58, 'serifI', C.ink, T.wake - 16); }
  else { lineIn(c, 'Just wake up,', f, T.finished, 6, ty, 64, 'serif', C.ink); lineIn(c, 'and all is finished.', f, T.finished + 16, 6, ty2 + 6, 64, 'serifI', C.pink); }
  cap(c, '— THERE IS ONLY ONE STEP', f, T.dreamTxt + 30, ty2 + 80 * K + 30);
  c.restore();
}
// ---- 11. you: the koi pond, golden hour into night, framed by a circle on the axis
function sPond(c, f) {
  if (f < T.iris[0] || f > T.irisOut[1] + 2) return; const op = E.inOut(prog(f, ...T.iris)), sh = E.inOut(prog(f, ...T.irisOut)), R = mix(0, Math.hypot(W, H) / 2 + 20, op) * (1 - sh);
  if (R <= 1) return; c.save(); c.beginPath(); c.arc(CX, CY, R, 0, 7); c.clip();
  const z = mix(1.25, 1.06, E.smooth(prog(f, T.pond, T.irisOut[1]))), k = ((Math.floor((f - T.pond) / 2) % 150) + 150) % 150, nt = E.smooth(prog(f, ...T.night));
  LIB.cover(c, A.golden[k], 0, 0, W, H, z, 0.5, 0.48); if (nt > 0) { c.globalAlpha = nt; LIB.cover(c, A.night[k], 0, 0, W, H, z, 0.5, 0.48); c.globalAlpha = 1; }
  c.fillStyle = 'rgba(10,12,8,0.22)'; c.fillRect(0, 0, W, H);
  c.restore(); if (op < 1 || sh > 0) { c.strokeStyle = C.ink; c.globalAlpha = 0.5; c.lineWidth = 2; c.beginPath(); c.arc(CX, CY, R, 0, 7); c.stroke(); c.globalAlpha = 1; }
  c.save(); c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 26; c.globalAlpha = 1 - sh; const ps = 72, y = CY;
  if (f < T.night[0] + 10) { lineIn(c, 'countless drops,', f, T.drops, 6, y - 30, ps, 'serif', '#fff', T.night[0] - 10); lineIn(c, 'for the boundless sea,', f, T.drops + 24, 6, y + 60, ps, 'serifI', '#fff', T.night[0] - 10); }
  else { lineIn(c, 'a guiding star,', f, T.star, 6, y - 30, ps, 'serif', '#fff', T.irisOut[0] - 10); lineIn(c, 'for the lost to see,', f, T.star + 24, 6, y + 60, ps, 'serifI', '#ffd7e4', T.irisOut[0] - 10); }
  c.shadowBlur = 0; cap(c, '— YOU', f, T.drops + 40, y + 150, T.irisOut[0]); c.restore();
}
// ---- 12. take me as I am: the three paintings become one, through time
function sTake(c, f) {
  if (f < T.take || f > T.takeOut + 16) return; const ex = E.exit(prog(f, T.takeOut, T.takeOut + 16)), u = E.out(prog(f, T.take, T.take + 30));
  const h = PORT ? 760 : 560, cy = PORT ? 820 : CY - 70, m = prog(f, ...T.morph);
  c.save(); c.globalAlpha = (1 - ex) * u;
  const a0 = clamp(1 - m * 2), a1 = clamp(1 - Math.abs(m - 0.5) * 2), a2 = clamp(m * 2 - 1);
  card(c, A.trio[0], f, CX, cy, h, 1); if (a1 > 0) card(c, A.trio[1], f, CX, cy, h, E.smooth(clamp(m * 2))); if (a2 > 0) card(c, A.trio[2], f, CX, cy, h, E.smooth(a2));
  const ty = PORT ? 1420 : CY + 300; lineIn(c, 'Take me as I am,', f, T.takeTxt, 6, ty, 64, 'serif', C.ink); lineIn(c, 'whatever I may be.', f, T.takeTxt + 18, 6, ty + 74 * K, 64, 'serifI', C.pink);
  cap(c, '— TAKE ME AS I AM', f, T.takeTxt + 40, ty + 74 * K + 70);
  c.restore();
}
// ---- 13. the name — and, again, "I write."
function sLock(c, f) {
  if (f < T.lock) return; const u = E.out(prog(f, T.lock, T.lock + 40));
  const h = PORT ? 640 : 380, cy = PORT ? 620 : 270; card(c, A.now, f, CX, cy + (1 - u) * 20, h, u);
  const ny = PORT ? 1110 : 590, nu = E.out(prog(f, T.lname, T.lname + 30));
  if (f >= T.lname) { c.save(); c.globalAlpha = nu; c.filter = nu < 1 ? `blur(${((1 - nu) * 8).toFixed(1)}px)` : 'none'; font(c, 'serif', fit(c, 'Nikit Hamal', 'serif', 140 * K)); c.textAlign = 'center'; c.fillStyle = C.ink; c.fillText('Nikit Hamal', CX, ny + (1 - nu) * 20); c.restore(); }
  if (f >= T.lwrite) { const iy = ny + (PORT ? 100 : 88); letters(c, 'I write.', CX, iy, 58 * K, 'serifI', C.pink, (i) => { const v = E.out(prog(f, T.lwrite + i * 4, T.lwrite + i * 4 + 24)); return { a: v, dy: (1 - v) * 18, blur: (1 - v) * 6 }; }); }
  if (f >= T.lurl) { const uu = E.out(prog(f, T.lurl, T.lurl + 26)), uy = ny + (PORT ? 190 : 168); c.save(); c.globalAlpha = uu; font(c, 'mono', PORT ? 32 : 28, 500); c.letterSpacing = '2px'; c.textAlign = 'center'; c.fillStyle = C.ink; c.fillText('nikit.is-a.dev/writing', CX, uy); c.restore(); rule(c, f, T.lurl + 6, uy + 22, PORT ? 230 : 210, 1e9, C.pink); }
  const du = E.out(prog(f, T.lurl + 20, T.lurl + 60)); if (du > 0) { const ds = PORT ? 6 : 4.4, gy = PORT ? 1640 : 1010, t = (f - T.lock) / 60; c.save(); c.globalAlpha = du; A.dog.draw(c, CX + 2 * ds, gy, ds, 'sleep', t); A.dog.zzz(c, CX + 2 * ds, gy, ds, t); c.restore(); }
}
function draw(c, f) {
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none'; c.imageSmoothingEnabled = true;
  paper(c, f);
  sHello(c, f); sTrio(c, f); sIdeas(c, f); sBe(c, f); sIY(c, f); sSelfish(c, f); sUnity(c, f); sThought(c, f); sGod(c, f); sDream(c, f); sPond(c, f); sTake(c, f); sLock(c, f);
  grain(c, f);
  const fin = Math.max(1 - prog(f, 0, 10), 0); if (fin > 0) { c.fillStyle = C.paper; c.globalAlpha = fin; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
}
const cv = document.getElementById('c'); cv.width = W; cv.height = H;
const FAST = [[T.big[0], T.big[1], 8], [T.split[0], T.split[1], 10], [T.scroll[0] - 4, T.scroll[0] + 30, 10], [T.iris[0], T.iris[1], 8], [T.irisOut[0], T.irisOut[1], 8]];
const frame = LIB.blurFrame(cv, draw, FAST, 8);
window.film = { load, frame, TOTAL, T, W, H };
