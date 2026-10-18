// "Nikit Hamal": a 25 s showreel of the person behind the portfolio. 1920x1080 @ 60 fps, 120 BPM (beat = 30 f, bar = 120 f).
// Built from the main site: the painted portrait with live eyes, the apps (NEBians, Lami Nepal, AstroWeb), the stack,
// operations at Consica Labs, the essays, the pixel dog. Device: the site's own "> " prompt types every act in.
// Every frame is a pure function of the frame number (motion blur re-draws sub-frames).
'use strict';
const W = 1920, H = 1080, FPS = 60, TOTAL = 1500;
const C = { bg: '#faf9f6', warm: '#f4ede2', ink: '#18181b', ink2: '#52525b', mute: '#8e8e93', line: '#e4e2dc', pink: '#d9779a', pinkL: '#fbc4d6',
  neb: '#2a5bd7', lami: '#c62828', astro: '#121640', gold: '#e8b54a' };
const FONT = { mono: 'Mono', serif: 'Serif', sans: 'Sans' };
// ---- timeline (frames). score.py mirrors these numbers.
const T = {
  type0: 0, pop: [54, 84], blink1: 112, expand: [150, 200], name: 168, sub: 190, wink1: 222,
  build: 240, out1: [240, 272], phoneIn: [248, 290], neb: 262, swipe: [360, 378], bub: [384, 402, 420, 438], morph: [452, 486], chart: [490, 560], planets: 556,
  stack: 600, burst: [600, 640], iconsAt: 612, stackCopy: 652,
  ops: 720, opsIn: [720, 750], ticks: [762, 777, 792, 807], bar: [762, 830],
  write: 840, warm: [840, 872], be: 868, strike: [912, 930], which: 936, scroll: [990, 1052], neither: [1056, 1086, 1116],
  mont: 1140, montN: 8, montLen: 15,
  lock: 1260, lockIn: [1260, 1296], lname: 1272, ltype: 1300, lurl: 1380, wink2: 1428, end: 1500,
};
// ---- easing + helpers
function bez(x1, y1, x2, y2) { const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  return t => { if (t <= 0) return 0; if (t >= 1) return 1; let x = t; for (let i = 0; i < 8; i++) { const fx = ((ax * x + bx) * x + cx) * x - t, d = (3 * ax * x + 2 * bx) * x + cx; if (Math.abs(fx) < 1e-6 || !d) break; x -= fx / d; } return ((ay * x + by) * x + cy) * x; }; }
const E = { out: bez(.16, 1, .3, 1), inOut: bez(.87, 0, .13, 1), smooth: bez(.65, 0, .35, 1), exit: bez(.55, .055, .675, .19), whip: bez(.6, 0, .15, 1), back: bez(.34, 1.4, .64, 1) };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), prog = (f, a, b) => clamp((f - a) / (b - a)), mix = (a, b, t) => a + (b - a) * t;
const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

// ---- assets
const A = {};
const img = src => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => j(new Error(src)); i.src = src; });
const ICONS = ['kotlin-plain', 'jetpackcompose-original', 'android-plain', 'python-plain', 'django-plain', 'svelte-original', 'typescript-plain', 'javascript-plain', 'firebase-plain', 'tailwindcss-original', 'redis-original', 'mysql-original', 'git-plain', 'flutter-plain'];
const TITLES = ['A Love that never hurts', 'Blessed', 'Effort clouds effortless', 'Everything is thought', 'God and The Ocean', 'How to be happy?', '“I” and “You” cannot Love',
  'I offer my curse to God', 'In relationship, there is no love', 'Interconnectedness', 'Love is acceptance', 'Perfect', 'Take me as I am', 'The lie of “being yourself”',
  'The Non-Dual Relationship', 'The Wrong Guy Trying to Wake Up', 'There is only one step', 'Unity is a lie', 'We came out of this world', 'We never met',
  'What is divine self?', 'Where is God?', 'Wisdom cannot be taught', 'You never trusted anyone', 'You'];
const LAND = TITLES.indexOf('Where is God?');
async function load() {
  for (const s of ['400 40px Mono', '700 40px Mono', '400 100px Serif', 'italic 400 100px SerifI', '600 40px Sans', '700 40px Sans']) await document.fonts.load(s);
  A.paint = await img('assets/now_paintlarge_ne.webp');
  A.eyes = parseEyes(await (await fetch('assets/now_eyes.svg')).text());
  A.icons = await Promise.all(ICONS.map(n => img(`assets/icons/${n}.svg`)));
  A.lami = await img('assets/lami-logo.png'); A.neb = await img('assets/neb-logo.svg');
  A.dogSleep = await img('assets/dog-sleep.svg'); A.dogSit = await img('assets/dog-sit.svg'); A.dogBlink = await img('assets/dog-blink.svg');
  A.petals = await Promise.all([0, 1, 2, 3, 4, 5].map(i => img(`assets/sakura-${i}.svg`)));
}
// eyes.svg -> canvas paths (the live eyes from the portfolio's painted portrait, drawn synchronously so motion blur can re-draw them)
function parseEyes(txt) {
  const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${txt}</svg>`, 'image/svg+xml');
  return [...doc.querySelectorAll('g.eye')].map(g => {
    const [ox, oy] = g.getAttribute('style').match(/[\d.]+/g).map(Number);
    const clip = new Path2D(g.querySelector('clipPath path').getAttribute('d'));
    const kids = [...g.children].filter(k => k.tagName !== 'clipPath'), white = kids[0], inner = kids[1], strokes = kids.slice(2);
    const iris = [...inner.querySelectorAll('.iris circle')].map(c => ({ x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), r: +c.getAttribute('r'), fill: c.getAttribute('fill') }));
    const sp = p => ({ p: new Path2D(p.getAttribute('d')), stroke: p.getAttribute('stroke'), w: +p.getAttribute('stroke-width'), a: +(p.getAttribute('stroke-opacity') || p.getAttribute('opacity') || 1) });
    return { side: g.classList.contains('eye-l') ? 'l' : 'r', ox, oy, clip, white: { p: new Path2D(white.getAttribute('d')), fill: white.getAttribute('fill') }, iris, shade: sp(inner.querySelector(':scope > path')), strokes: strokes.map(sp) };
  });
}
// eye state at frame f: where they look (-1..1) and how open each lid is
const BLINKS = [T.blink1, 330, 520, 690, 905, 1100, 1330];
const WINKS = [[T.wink1, 'l'], [1247, 'r'], [T.wink2, 'l']];
function lid(f, at, hold = 3) { const d = f - at; if (d < 0 || d > 10 + hold) return 1; return d < 3 ? 1 - d / 3 : d < 3 + hold ? 0 : clamp((d - 3 - hold) / 6); }
function eyeState(f) {
  const keys = [[0, 0.75, 0.15], [40, 0.9, 0.1], [84, 0.6, 0.05], [140, 0.2, 0], [176, -0.1, 0.05], [200, 0, 0], [1260, 0, 0], [1300, 0.85, 0.2], [1376, 0.6, 0.35], [1404, 0, 0]];
  let i = 0; while (i < keys.length - 1 && keys[i + 1][0] <= f) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)], u = b === a ? 0 : E.smooth(prog(f, b[0] - 14, b[0]));
  let lx = mix(a[1], b[1], u), ly = mix(a[2], b[2], u);
  if (f >= 0 && f < 140) { const k = Math.min(15, Math.floor(f / 4)); lx = mix(0.55, 0.95, k / 15); }   // following the caret as it types
  let L = 1, R = 1; for (const b2 of BLINKS) { const v = lid(f, b2); L = Math.min(L, v); R = Math.min(R, v); }
  for (const [at, s] of WINKS) { const v = lid(f, at, 14); if (s === 'l') L = Math.min(L, v); else R = Math.min(R, v); }
  return { lx, ly, L, R };
}
function drawEyes(c, st) {
  for (const e of A.eyes) {
    const open = e.side === 'l' ? st.L : st.R, sy = mix(0.1, 1, open);
    c.save(); c.translate(e.ox, e.oy); c.scale(1, sy); c.translate(-e.ox, -e.oy);
    if (open > 0.25) {
      c.fillStyle = e.white.fill; c.fill(e.white.p);
      c.save(); c.clip(e.clip); c.translate(st.lx * 12, st.ly * 7);
      for (const ir of e.iris) { c.fillStyle = ir.fill; c.beginPath(); c.arc(ir.x, ir.y, ir.r, 0, 7); c.fill(); }
      c.restore(); c.save(); c.clip(e.clip); c.globalAlpha = e.shade.a; c.strokeStyle = e.shade.stroke; c.lineWidth = e.shade.w; c.stroke(e.shade.p); c.restore();
    }
    for (const s of e.strokes) { c.globalAlpha = s.a; c.strokeStyle = s.stroke; c.lineCap = 'round'; c.lineWidth = s.w / Math.max(sy, 0.45); c.stroke(s.p); }
    c.globalAlpha = 1; c.restore();
  }
}
// the painted portrait (800x1000 art space), placed by its centre and height, clipped to a circle / rounded rect blend
function portrait(c, f, cx, cy, h, round = 0, crop = null) {
  const s = h / 1000, w = 800 * s; c.save(); c.translate(cx, cy);
  const cw = crop ? crop[0] : w, ch = crop ? crop[1] : h, r = mix(18, Math.min(cw, ch) / 2, round);
  c.beginPath(); c.roundRect(-cw / 2, -ch / 2, cw, ch, r); c.clip();
  const fy = crop ? crop[2] || 0 : 0;
  c.translate(-w / 2, -h / 2 + fy * s); c.scale(s, s); c.drawImage(A.paint, 0, 0); drawEyes(c, eyeState(f)); c.restore();
}

// ---- type
function font(c, kind, size, weight = 400) { c.font = kind === 'serifI' ? `italic ${weight} ${size}px SerifI` : `${weight} ${size}px ${FONT[kind]}`; }
// text typed at `rate` frames per character; returns the right edge; draws a block caret while typing / idle
function typed(c, text, f, f0, x, y, size, opts = {}) {
  const { kind = 'mono', weight = 400, col = C.ink, rate = 3, caret = true, caretUntil = 1e9, align = 'left' } = opts;
  if (f < f0) return x; const n = Math.min(text.length, Math.floor((f - f0) / rate) + 1), s = text.slice(0, n);
  c.save(); font(c, kind, size, weight); c.fillStyle = col; c.textBaseline = 'alphabetic';
  const full = c.measureText(text).width, x0 = align === 'center' ? x - full / 2 : x; c.fillText(s, x0, y); const xe = x0 + c.measureText(s).width;
  if (caret && f < caretUntil && (n < text.length || Math.floor((f - f0) / 15) % 2 === 0)) { c.fillStyle = C.ink; c.globalAlpha = 0.85; c.fillRect(xe + size * 0.08, y - size * 0.78, size * 0.5, size * 0.95); }
  c.restore(); return xe;
}
// a fragment that rises in (no overshoot), holds, exits
function rise(c, text, f, inF, outF, x, y, size, kind = 'serif', col = C.ink, align = 'center', weight = 400) {
  if (f < inF || f > outF + 14) return; const u = E.out(prog(f, inF, inF + 22)), e = E.exit(prog(f, outF, outF + 14));
  c.save(); font(c, kind, size, weight); c.textAlign = align; c.fillStyle = col; c.globalAlpha = u * (1 - e); c.fillText(text, x, y + (1 - u) * size * 0.35 - e * size * 0.2); c.restore();
}
// the site's section header: "> TITLE" in letter-spaced mono, typed fast
function header(c, text, f, f0, f1) {
  if (f < f0 || f > f1 + 12) return; const a = 1 - E.exit(prog(f, f1, f1 + 12));
  c.save(); c.globalAlpha = a; font(c, 'mono', 26, 700); c.fillStyle = C.ink; c.letterSpacing = '4px'; c.fillText('>', 96, 112);
  c.restore(); c.save(); c.globalAlpha = a; c.letterSpacing = '4px'; typed(c, text, f, f0 + 4, 130, 112, 26, { weight: 700, rate: 1.5, caretUntil: f0 + 40 }); c.restore();
  c.save(); c.globalAlpha = a * 0.9; c.fillStyle = C.line; c.fillRect(96, 136, mix(0, W - 192, E.out(prog(f, f0, f0 + 40))), 2); c.restore();
}

// ---- act 1: hello
function actHello(c, f) {
  const ex = E.inOut(prog(f, ...T.expand)), out = E.whip(prog(f, ...T.out1));
  c.save(); c.translate(-out * W * 1.1, 0);
  // avatar: pops in as the homepage circle, then opens into the full painting on the left
  const pop = E.out(prog(f, ...T.pop));
  if (f >= T.pop[0]) {
    const r = mix(0, 104, pop), cx = mix(560, 600, ex), cy = mix(540, 540, ex), h = mix(r * 2 / 0.52, 960, ex);
    const cw = mix(r * 2, 680, ex), ch = mix(r * 2, 900, ex);
    portrait(c, f, cx, cy, h, 1 - ex, [cw, ch, mix(70, 0, ex)]);
    if (ex < 1) { c.save(); c.globalAlpha = 1 - ex; c.strokeStyle = C.line; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, r + 6, 0, 7); c.stroke(); c.restore(); }
  }
  // typed hello, which hands over to the serif name
  const tx = mix(720, 1010, ex), ta = 1 - E.exit(prog(f, T.name - 10, T.name + 6));
  c.save(); c.globalAlpha = ta; typed(c, "> hi, i'm nikit", f, T.type0, tx, 560, 64, { rate: 4, caretUntil: T.name }); c.restore();
  if (f >= T.name) {
    const u = E.out(prog(f, T.name, T.name + 26)); c.save(); font(c, 'serif', 150); c.fillStyle = C.ink; c.globalAlpha = u; c.fillText('Nikit Hamal', 1010, 560 + (1 - u) * 40); c.restore();
    typed(c, 'android · full-stack · writing', f, T.sub, 1016, 650, 34, { col: C.ink2, rate: 1.6, caretUntil: T.build });
  }
  c.restore();
}

// ---- act 2: the apps
function phoneScreenNEB(c, f, w, h) {
  c.fillStyle = '#f4f7fd'; c.fillRect(0, 0, w, h);
  c.fillStyle = C.neb; c.fillRect(0, 0, w, 150); c.drawImage(A.neb, 28, 64, 56, 56);
  font(c, 'sans', 34, 700); c.fillStyle = '#fff'; c.fillText('NEBians', 98, 104); font(c, 'sans', 20, 600); c.globalAlpha = 0.8; c.fillText('study · arena · results', 100, 132); c.globalAlpha = 1;
  const items = [['Result checker', '#dfe8ff', '#1d3f9a'], ['AI chat arena', '#ffe7d6', '#9a4a12'], ['Notes & PYQs', '#dff6e6', '#1d6b3a'], ['Forums', '#efe2ff', '#5b2a9a']];
  items.forEach(([t, bg, fg], i) => {
    const u = E.out(prog(f, T.neb + 14 + i * 8, T.neb + 36 + i * 8)); if (u <= 0) return;
    const x = 24 + (i % 2) * (w / 2 - 12), y = 180 + Math.floor(i / 2) * 200 + (1 - u) * 60, cw = w / 2 - 36;
    c.save(); c.globalAlpha = u; c.fillStyle = bg; c.beginPath(); c.roundRect(x, y, cw, 180, 26); c.fill();
    c.fillStyle = fg; c.beginPath(); c.arc(x + 44, y + 50, 22, 0, 7); c.fill(); font(c, 'sans', 22, 700); c.fillText(t, x + 22, y + 140); c.restore();
  });
  const u = E.out(prog(f, T.neb + 50, T.neb + 80));   // result card with a growing score bar
  c.save(); c.globalAlpha = u; c.fillStyle = '#fff'; c.beginPath(); c.roundRect(24, 600, w - 48, 120, 24); c.fill();
  font(c, 'sans', 22, 700); c.fillStyle = C.ink; c.fillText('GPA', 50, 646); c.fillStyle = '#e1e8f8'; c.fillRect(50, 670, w - 100, 14); c.fillStyle = C.neb; c.fillRect(50, 670, (w - 100) * 0.88 * E.out(prog(f, T.neb + 60, T.neb + 100)), 14);
  font(c, 'mono', 22, 700); c.textAlign = 'right'; c.fillText((3.52 * E.out(prog(f, T.neb + 60, T.neb + 100))).toFixed(2), w - 50, 646); c.restore();
  c.fillStyle = '#fff'; c.fillRect(0, h - 90, w, 90); for (let i = 0; i < 4; i++) { c.fillStyle = i === 0 ? C.neb : '#b8c2d8'; c.beginPath(); c.roundRect(w / 8 + i * w / 4 - 18, h - 62, 36, 36, 10); c.fill(); }
}
function phoneScreenLami(c, f, w, h) {
  c.fillStyle = '#fff6f4'; c.fillRect(0, 0, w, h); c.fillStyle = C.lami; c.fillRect(0, 0, w, 150);
  c.save(); c.beginPath(); c.arc(62, 96, 32, 0, 7); c.fillStyle = '#fff'; c.fill(); c.clip(); c.drawImage(A.lami, 30, 64, 64, 64); c.restore();
  font(c, 'sans', 32, 700); c.fillStyle = '#fff'; c.fillText('Lami Nepal', 110, 104); font(c, 'sans', 19, 600); c.globalAlpha = 0.85; c.fillText('online · real-time chat', 112, 130); c.globalAlpha = 1;
  const B = [['Namaste!', 0], ['Namaste, how are you?', 1], ['Shall we talk to the families?', 0], ['Yes. Tomorrow?', 1]];
  B.forEach(([t, me], i) => {
    const u = E.out(prog(f, T.bub[i], T.bub[i] + 16)); if (u <= 0) return; font(c, 'sans', 24, 600); const tw = c.measureText(t).width + 44;
    const x = me ? w - 28 - tw : 28, y = 190 + i * 96; c.save(); c.globalAlpha = u; c.translate(x + (me ? tw : 0), y + 30); c.scale(mix(0.6, 1, u), mix(0.6, 1, u)); c.translate(-(x + (me ? tw : 0)), -(y + 30));
    c.fillStyle = me ? C.lami : '#fff'; c.beginPath(); c.roundRect(x, y, tw, 62, 26); c.fill(); if (!me) { c.strokeStyle = '#f0d6d2'; c.lineWidth = 2; c.stroke(); }
    c.fillStyle = me ? '#fff' : C.ink; c.fillText(t, x + 22, y + 40); c.restore();
  });
  if (f > T.bub[3] + 20) { for (let i = 0; i < 3; i++) { c.fillStyle = '#d7b3ae'; c.globalAlpha = 0.5 + 0.5 * Math.sin((f - i * 6) * 0.25); c.beginPath(); c.arc(56 + i * 22, 610, 7, 0, 7); c.fill(); } c.globalAlpha = 1; }
  c.fillStyle = '#fff'; c.fillRect(0, h - 96, w, 96); c.fillStyle = '#f3e6e3'; c.beginPath(); c.roundRect(24, h - 76, w - 120, 56, 28); c.fill(); c.fillStyle = C.lami; c.beginPath(); c.arc(w - 56, h - 48, 28, 0, 7); c.fill();
}
// AstroWeb: a North-Indian kundali chart drawing itself, planets landing in the houses, dasha bars
function screenAstro(c, f, w, h) {
  c.fillStyle = C.astro; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { c.fillStyle = '#fff'; c.globalAlpha = 0.15 + 0.35 * hash(i * 3.1); c.fillRect(hash(i) * w, hash(i + 9) * h, 2, 2); } c.globalAlpha = 1;
  c.fillStyle = C.gold; c.beginPath(); c.arc(46, 46, 20, 0, 7); c.fill(); c.fillStyle = C.astro; font(c, 'sans', 24, 700); c.textAlign = 'center'; c.fillText('A', 46, 55); c.textAlign = 'left';
  c.fillStyle = '#fff'; font(c, 'sans', 26, 700); c.fillText('AstroWeb', 80, 56); font(c, 'mono', 18); c.fillStyle = '#9aa0d0'; c.fillText('free vedic astrology', 230, 56);
  const s = Math.min(h - 150, w * 0.5), x0 = 70, y0 = 110, p = prog(f, ...T.chart);
  const segs = [[0, 0, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1], [0, 1, 0, 0], [0, 0, 1, 1], [1, 0, 0, 1], [.5, 0, 1, .5], [1, .5, .5, 1], [.5, 1, 0, .5], [0, .5, .5, 0]];
  c.strokeStyle = C.gold; c.lineWidth = 3; c.lineCap = 'round';
  segs.forEach(([a, b, d, e], i) => { const u = E.smooth(clamp(p * segs.length * 0.7 - i * 0.6)); if (u <= 0) return; c.beginPath(); c.moveTo(x0 + a * s, y0 + b * s); c.lineTo(x0 + mix(a, d, u) * s, y0 + mix(b, e, u) * s); c.stroke(); });
  const houses = [[.5, .25], [.25, .1], [.1, .25], [.25, .5], [.1, .75], [.25, .9], [.5, .75], [.75, .9], [.9, .75], [.75, .5], [.9, .25], [.75, .1]];
  const PL = [['Su', 0], ['Mo', 3], ['Ma', 6], ['Me', 0], ['Ju', 9], ['Ve', 11], ['Sa', 4], ['Ra', 7], ['Ke', 1]];
  font(c, 'mono', 20, 700); c.textAlign = 'center';
  houses.forEach(([hx, hy], i) => { const u = prog(f, T.chart[0] + 30 + i * 2, T.chart[0] + 40 + i * 2); c.fillStyle = '#7a80b8'; c.globalAlpha = u; c.fillText(String((i + 0) % 12 + 1), x0 + hx * s, y0 + hy * s + (i % 3 === 0 ? -24 : 30)); });
  c.globalAlpha = 1;
  PL.forEach(([n, hIdx], i) => { const u = E.out(prog(f, T.planets - 40 + i * 4, T.planets - 26 + i * 4)); if (u <= 0) return; const [hx, hy] = houses[hIdx], k = PL.slice(0, i).filter(q => q[1] === hIdx).length;
    c.globalAlpha = u; c.fillStyle = n === 'Su' ? C.gold : '#f4f1ff'; c.fillText(n, x0 + hx * s + (k - 0.5) * 36 * (PL.filter(q => q[1] === hIdx).length > 1 ? 1 : 0), y0 + hy * s + 8 - (1 - u) * 20); });
  c.globalAlpha = 1; c.textAlign = 'left';
  // dasha periods
  const dx = x0 + s + 70, dw = w - dx - 60; font(c, 'mono', 20, 700); c.fillStyle = '#fff'; c.fillText('VIMSHOTTARI DASHA', dx, y0 + 20);
  [['Jupiter', 16, C.gold], ['Saturn', 19, '#8fa0ff'], ['Mercury', 17, '#7fd6c2'], ['Ketu', 7, '#e58fb0'], ['Venus', 20, '#f2d38a']].forEach(([n, yrs, col], i) => {
    const u = E.out(prog(f, T.chart[0] + 20 + i * 8, T.chart[0] + 50 + i * 8)); const y = y0 + 60 + i * 70;
    font(c, 'mono', 18); c.fillStyle = '#c9cdf2'; c.globalAlpha = u; c.fillText(n, dx, y); c.fillText(yrs + ' y', dx + dw - 50, y);
    c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(dx, y + 14, dw, 10); c.fillStyle = col; c.fillRect(dx, y + 14, dw * yrs / 20 * u, 10); c.globalAlpha = 1;
  });
}
function actBuild(c, f) {
  if (f < T.build - 2 || f >= T.stack + 44) return;
  header(c, 'SIDE PROJECTS & WORK', f, T.build + 6, T.stack - 14);
  const rise_ = E.out(prog(f, ...T.phoneIn)), mo = E.inOut(prog(f, ...T.morph)), col = E.inOut(prog(f, T.burst[0], T.burst[0] + 24));
  let w = mix(440, 1180, mo), h = mix(880, 700, mo), rad = mix(64, 22, mo), cx = mix(960, 960, mo), cy = 590 + (1 - rise_) * 900;
  const sc = 1 - col; if (sc <= 0.01) return;
  c.save(); c.translate(cx, cy); c.scale(sc, sc); c.rotate(-0.04 * col);
  c.save(); c.shadowColor = 'rgba(24,24,27,0.18)'; c.shadowBlur = 60; c.shadowOffsetY = 24; c.fillStyle = C.ink; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, rad); c.fill(); c.restore();
  const bz = mix(14, 0, mo), top = mix(14, 44, mo), sw = w - bz * 2, sh = h - bz - top, sx = -w / 2 + bz, sy = -h / 2 + top;
  if (mo > 0) { c.globalAlpha = mo; c.fillStyle = '#2a2a30'; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, top + 4, [rad, rad, 0, 0]); c.fill();
    ['#ff5f57', '#febc2e', '#28c840'].forEach((k, i) => { c.fillStyle = k; c.beginPath(); c.arc(-w / 2 + 28 + i * 24, -h / 2 + 22, 7, 0, 7); c.fill(); });
    c.fillStyle = '#3a3a42'; c.beginPath(); c.roundRect(-180, -h / 2 + 10, 360, 24, 12); c.fill(); font(c, 'mono', 15); c.fillStyle = '#c4c4cc'; c.textAlign = 'center'; c.fillText('astroweb · kundali', 0, -h / 2 + 27); c.textAlign = 'left'; c.globalAlpha = 1; }
  c.save(); c.beginPath(); c.roundRect(sx, sy, sw, sh, Math.max(4, rad - bz)); c.clip(); c.translate(sx, sy);
  if (f < T.morph[0] + 12) {   // phone: NEBians, then swipes to Lami Nepal
    const sp = E.inOut(prog(f, ...T.swipe));
    if (sp < 1) { c.save(); c.translate(-sp * sw, 0); phoneScreenNEB(c, f, sw, sh); c.restore(); }
    if (sp > 0) { c.save(); c.translate((1 - sp) * sw, 0); phoneScreenLami(c, f, sw, sh); c.restore(); }
    if (mo > 0) { c.fillStyle = C.astro; c.globalAlpha = mo * 2; c.fillRect(0, 0, sw, sh); c.globalAlpha = 1; }
  } else screenAstro(c, f, sw, sh);
  c.restore();
  if (mo < 0.5) { c.fillStyle = '#000'; c.beginPath(); c.arc(0, -h / 2 + 34, 9, 0, 7); c.fill(); }   // punch-hole camera
  c.restore();
  // the app's name, mono, at left; swaps on the beat
  const lab = f < T.swipe[0] + 8 ? ['NEBians', 'Material 3 · Django'] : f < T.morph[0] + 16 ? ['Lami Nepal', 'chat · FCM · Nepali'] : ['AstroWeb', 'SvelteKit · Vedic maths'];
  const lf = f < T.swipe[0] + 8 ? T.neb : f < T.morph[0] + 16 ? T.swipe[0] + 8 : T.morph[0] + 16;
  const la = 1 - E.exit(prog(f, T.stack - 14, T.stack + 2));
  c.save(); c.globalAlpha = la; typed(c, lab[0], f, lf, 96, 900, 46, { weight: 700, rate: 2, caretUntil: lf + 40 }); typed(c, lab[1], f, lf + 10, 96, 950, 26, { col: C.ink2, rate: 1, caret: false }); c.restore();
}

// ---- act 3: the stack (icons burst out of the collapsing window)
function iconPos(i) { const cols = 7, gx = 200, gy = 200; return [960 + ((i % cols) - (cols - 1) / 2) * gx, 470 + (Math.floor(i / cols) - 0.5) * gy]; }
function actStack(c, f) {
  if (f < T.burst[0] || f >= T.ops + 30) return;
  header(c, 'SKILLS & EXPERIENCE', f, T.stack + 4, T.ops - 14);
  const ex = E.inOut(prog(f, T.ops - 18, T.ops + 18));
  ICONS.forEach((n, i) => {
    const s0 = T.iconsAt + i * 3, u = E.out(prog(f, s0, s0 + 26)); if (u <= 0) return;
    const [tx, ty] = iconPos(i), a = hash(i + 4) * 6.28, sx = 960 + Math.cos(a) * 30, sy = 590 + Math.sin(a) * 30;
    const drift = Math.sin((f - s0) * 0.04 + i) * 6;
    let x = mix(sx, tx, u), y = mix(sy, ty, u) + drift * u, sz = mix(30, 120, u);
    // exit: they fall into a single checklist line for the ops act
    x = mix(x, 960, ex); y = mix(y, 600, ex); sz = mix(sz, 0, ex);
    c.save(); c.globalAlpha = Math.min(1, u * 1.5); c.fillStyle = '#fff'; c.strokeStyle = C.line; c.lineWidth = 2; c.beginPath(); c.roundRect(x - sz * 0.75, y - sz * 0.75, sz * 1.5, sz * 1.5, sz * 0.35); c.fill(); c.stroke();
    c.drawImage(A.icons[i], x - sz / 2, y - sz / 2, sz, sz); c.restore();
  });
  const ca = 1 - E.exit(prog(f, T.ops - 18, T.ops - 4));
  c.save(); c.globalAlpha = ca; typed(c, 'kotlin · compose · django · svelte · firebase', f, T.stackCopy, 960, 820, 40, { rate: 1.2, align: 'center', caretUntil: T.ops - 20 }); c.restore();
}

// ---- act 4: operations
function consica(c, x, y, s, col = C.ink) {   // the Consica Labs mark, redrawn as vectors from the 36px logo
  c.save(); c.translate(x, y); c.scale(s / 36, s / 36); c.fillStyle = col;
  c.beginPath(); c.arc(17, 19, 15, Math.PI * 0.32, Math.PI * 1.62, false); c.arc(17, 19, 9.5, Math.PI * 1.62, Math.PI * 0.32, true); c.closePath(); c.fill();
  c.beginPath(); c.arc(17, 19, 5, Math.PI * 0.5, Math.PI * 1.5); c.closePath(); c.fill();
  c.fillRect(20, 2, 5, 22); c.fillRect(20, 19, 14, 5); c.fillRect(17, 29, 17, 6); c.restore();
}
function actOps(c, f) {
  if (f < T.ops - 2 || f >= T.write + 40) return;
  header(c, 'OPERATIONS', f, T.ops + 4, T.write - 14);
  const u = E.out(prog(f, ...T.opsIn)), ex = E.inOut(prog(f, T.write - 16, T.write + 24));
  c.save(); c.translate(0, ex * -60); c.globalAlpha = 1 - ex;
  const cx = 960, cy = 590; c.save(); c.translate(cx, cy + (1 - u) * 80); c.globalAlpha *= u;
  c.save(); c.shadowColor = 'rgba(24,24,27,0.10)'; c.shadowBlur = 50; c.shadowOffsetY = 20; c.fillStyle = '#fff'; c.beginPath(); c.roundRect(-520, -300, 1040, 600, 32); c.fill(); c.restore();
  c.strokeStyle = C.line; c.lineWidth = 2; c.beginPath(); c.roundRect(-520, -300, 1040, 600, 32); c.stroke();
  consica(c, -460, -250, 84); font(c, 'serif', 64); c.fillStyle = C.ink; c.fillText('Head of Operations', -350, -196); font(c, 'mono', 26); c.fillStyle = C.ink2; c.fillText('Consica Labs', -346, -154);
  const items = ['plan the quarter', 'ship the release', 'grow the team', 'keep it running'];
  items.forEach((t, i) => {
    const y = -60 + i * 76, k = E.out(prog(f, T.ticks[i], T.ticks[i] + 12)); font(c, 'mono', 30); c.fillStyle = k > 0.5 ? C.ink2 : C.ink; c.fillText(t, -380, y + 10);
    c.strokeStyle = k > 0 ? C.ink : '#c8c6c0'; c.lineWidth = 3; c.beginPath(); c.roundRect(-450, y - 22, 40, 40, 10); c.stroke();
    if (k > 0) { c.fillStyle = C.ink; c.beginPath(); c.roundRect(-450, y - 22, 40, 40, 10); c.globalAlpha *= k; c.fill(); c.globalAlpha /= k || 1;
      c.strokeStyle = '#fff'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); const pp = [[-441, y - 2], [-433, y + 8], [-418, y - 10]]; c.moveTo(...pp[0]);
      const q = clamp(k * 2); if (q < 0.5) c.lineTo(mix(pp[0][0], pp[1][0], q * 2), mix(pp[0][1], pp[1][1], q * 2)); else { c.lineTo(...pp[1]); c.lineTo(mix(pp[1][0], pp[2][0], q * 2 - 1), mix(pp[1][1], pp[2][1], q * 2 - 1)); } c.stroke();
      c.strokeStyle = C.ink2; c.lineWidth = 2; c.beginPath(); font(c, 'mono', 30); const tw = c.measureText(t).width; c.moveTo(-380, y); c.lineTo(-380 + tw * E.out(clamp(k * 1.4 - 0.3)), y); c.stroke(); }
  });
  const b = E.out(prog(f, ...T.bar)); c.fillStyle = '#efede8'; c.beginPath(); c.roundRect(120, 0, 330, 16, 8); c.fill(); c.fillStyle = C.ink; c.beginPath(); c.roundRect(120, 0, 330 * b, 16, 8); c.fill();
  font(c, 'mono', 84, 700); c.textAlign = 'right'; c.fillText(Math.round(b * 100) + '%', 450, -40); font(c, 'mono', 22); c.fillStyle = C.mute; c.fillText('this quarter', 450, 60);
  c.restore(); c.restore();
}

// ---- act 5: writing
function petals(c, f, f0, n = 22) {
  for (let i = 0; i < n; i++) {
    const t = (f - f0) / 60 + hash(i) * 9, x = ((hash(i + 1) * W + t * (40 + hash(i + 2) * 50)) % (W + 200)) - 100, y = ((hash(i + 3) * H + t * (60 + hash(i + 5) * 60)) % (H + 200)) - 100;
    const s = 30 + hash(i + 6) * 34; c.save(); c.translate(x + Math.sin(t * 1.3 + i) * 30, y); c.rotate(Math.sin(t + i) * 0.6); c.globalAlpha = 0.7;
    c.imageSmoothingEnabled = false; c.drawImage(A.petals[i % 6], 24, 4, 12, 10, -s / 2, -s / 2, s, s * 0.84); c.restore();
  }
}
function actWrite(c, f) {
  if (f < T.write || f >= T.mont + 2) return;
  const wa = E.smooth(prog(f, ...T.warm)); c.fillStyle = C.warm; c.globalAlpha = wa; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
  petals(c, f, T.write);
  header(c, 'ESSAYS & WRITING', f, T.write + 10, T.mont - 10);
  const up = E.inOut(prog(f, T.scroll[0] - 14, T.scroll[0] + 10));
  c.save(); c.translate(0, -up * 700);
  // "Be yourself." — then the line crosses it out
  const bx = typed(c, 'Be yourself.', f, T.be, 960, 520, 170, { kind: 'serif', rate: 3, align: 'center', caretUntil: T.strike[0] });
  const s = E.out(prog(f, ...T.strike)); if (s > 0) { font(c, 'serif', 170); const w = c.measureText('Be yourself.').width; c.strokeStyle = C.ink; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(960 - w / 2 - 20, 470); c.lineTo(960 - w / 2 - 20 + (w + 40) * s, 470 - 10 * s); c.stroke(); }
  const words = 'Which self are you talking about?'.split(' '); font(c, 'serifI', 64); let wx = 960 - c.measureText(words.join(' ')).width / 2;
  words.forEach((w, i) => { const u = E.out(prog(f, T.which + i * 5, T.which + i * 5 + 20)); font(c, 'serifI', 64); c.fillStyle = C.pink; c.globalAlpha = u; c.fillText(w, wx, 660 + (1 - u) * 24); wx += c.measureText(w + ' ').width; }); c.globalAlpha = 1;
  c.restore();
  // the essay titles scroll past and land on one
  if (f >= T.scroll[0] - 14) {
    const p = E.out(prog(f, ...T.scroll)), lh = 120, land = LAND + TITLES.length * 2, pos = mix(land - 16, land, p), fade = E.inOut(prog(f, T.scroll[0] - 14, T.scroll[0] + 6)), ex = E.exit(prog(f, T.mont - 14, T.mont));
    const nY = mix(540, 300, E.inOut(prog(f, T.neither[0] - 10, T.neither[0] + 14)));
    for (let k = Math.floor(pos) - 6; k <= Math.floor(pos) + 6; k++) {
      const t = TITLES[((k % TITLES.length) + TITLES.length) % TITLES.length], y = nY + (k - pos) * lh, d = Math.abs(k - pos), on = k === land && p > 0.98;
      const fa = clamp(1 - d / 4) * fade * (1 - ex) * (k === land ? 1 : 1 - E.smooth(prog(f, T.neither[0] - 26, T.neither[0] - 4)));
      if (fa <= 0) continue; font(c, 'serif', k === land ? 96 : 72); c.textAlign = 'center'; c.fillStyle = on ? C.ink : d < 0.5 ? C.ink : C.ink2; c.globalAlpha = fa; c.fillText(t, 960, y + 30);
    }
    c.globalAlpha = 1; c.textAlign = 'left';
    // and that essay speaks
    const L = [['God is neither in,', 'nor out.'], ['neither above,', 'nor below.'], ['neither time,', 'nor the timeless.']];
    L.forEach(([a, b], i) => { const f0 = T.neither[i], f1 = i < 2 ? T.neither[i + 1] - 4 : T.mont - 16; rise(c, a, f, f0, f1, 900, 600, 84, 'serif', C.ink, 'right'); rise(c, b, f, f0 + 10, f1, 930, 600, 84, 'serifI', C.pink, 'left'); });
  }
}

// ---- act 6: montage on 8ths (earlier moments, pushed in) — then the lockup
const MONT = [[T.wink1 - 6, 2.2, 600, 400], [T.neb + 70, 1.6, 960, 560], [T.bub[3] + 10, 1.5, 960, 520], [T.chart[1] - 4, 1.4, 800, 560], [T.iconsAt + 60, 1.7, 960, 470], [T.ticks[3] + 12, 1.5, 860, 560], [T.strike[1] + 30, 1.4, 960, 520], null];
function actLock(c, f) {
  if (f < T.lock) return;
  const u = E.out(prog(f, ...T.lockIn)), col = 560;
  // the homepage header, rebuilt: avatar circle, serif name with the sleeping pup, typed intro, the site
  c.save(); c.globalAlpha = u; c.translate(0, (1 - u) * 40);
  portrait(c, f, 535, 300, 400, 1, [230, 230, 70]);
  c.strokeStyle = C.line; c.lineWidth = 3; c.beginPath(); c.arc(535, 300, 121, 0, 7); c.stroke(); c.restore();
  const nu = E.out(prog(f, T.lname, T.lname + 24)); font(c, 'serif', 150); c.fillStyle = C.ink; c.globalAlpha = nu; c.fillText('Nikit Hamal', 420, 580 + (1 - nu) * 30); const nw = c.measureText('Nikit Hamal').width; c.globalAlpha = 1;
  // pup
  const du = E.out(prog(f, T.lname + 18, T.lname + 40)); if (du > 0) { c.save(); c.imageSmoothingEnabled = false; c.globalAlpha = du; const dw = 38 * 5.2, awake = f > T.wink2 - 20 && f < T.wink2 + 30;
    const dX = 420 + nw + 40, dY = 580 - 40 * 5.2 + 22; c.drawImage(awake ? A.dogSit : A.dogSleep, dX, dY, dw, 40 * 5.2); c.restore();
    if (!awake) for (let k = 0; k < 3; k++) { const t = ((f - T.lname) / 50 + k / 3) % 1; font(c, 'mono', 26 + k * 4, 700); c.fillStyle = C.ink2; c.globalAlpha = Math.sin(t * Math.PI) * du; c.fillText('z', dX + 29 * 5.2 + t * 34, dY + 22 * 5.2 - t * 80); } c.globalAlpha = 1; }
  typed(c, 'Head of Operations at Consica Labs.', f, T.ltype, 424, 680, 34, { col: C.ink2, rate: 1.1, caretUntil: T.ltype + 44 });
  typed(c, 'Android & full-stack engineer from Nepal.', f, T.ltype + 40, 424, 734, 34, { col: C.ink2, rate: 1.1, caretUntil: T.ltype + 90 });
  typed(c, 'Writing about the self.', f, T.ltype + 86, 424, 788, 34, { col: C.ink2, rate: 1.1, caretUntil: T.lurl });
  if (f >= T.lurl) { const uu = E.out(prog(f, T.lurl, T.lurl + 24)); font(c, 'mono', 44, 700); c.fillStyle = C.ink; c.globalAlpha = uu; c.fillText('nikit.is-a.dev', 424, 900); const uw = c.measureText('nikit.is-a.dev').width;
    c.strokeStyle = C.pink; c.lineWidth = 3; c.beginPath(); for (let xx = 0; xx <= uw * E.out(prog(f, T.lurl + 6, T.lurl + 40)); xx += 4) { const yy = 924 + Math.sin(xx / 8) * 4; xx ? c.lineTo(424 + xx, yy) : c.moveTo(424, yy); } c.stroke(); c.globalAlpha = 1; }
}

// ---- compose
function backdrop(c, f) {
  c.fillStyle = C.bg; c.fillRect(0, 0, W, H);
  // the site's sparkles, drifting slowly
  for (let i = 0; i < 9; i++) { const x = hash(i * 7.7) * W, y = (hash(i * 3.3) * H + f * 0.15 * (0.5 + hash(i))) % H, s = 8 + hash(i + 2) * 8, a = 0.18 + 0.12 * Math.sin(f * 0.05 + i);
    c.save(); c.translate(x, y); c.rotate(f * 0.004 * (i % 2 ? 1 : -1)); c.fillStyle = C.mute; c.globalAlpha = a; c.beginPath(); c.moveTo(0, -s); c.quadraticCurveTo(0, 0, s, 0); c.quadraticCurveTo(0, 0, 0, s); c.quadraticCurveTo(0, 0, -s, 0); c.quadraticCurveTo(0, 0, 0, -s); c.fill(); c.restore(); }
}
function scene(c, f) {
  backdrop(c, f);
  if (f < T.build + 40) actHello(c, f);
  actBuild(c, f); actStack(c, f); actOps(c, f); actWrite(c, f);
}
function draw(c, f) {
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.imageSmoothingEnabled = true;
  if (f >= T.mont && f < T.lock) {   // montage: cut on every 8th note to an earlier moment, pushed in and drifting
    const k = Math.min(T.montN - 1, Math.floor((f - T.mont) / T.montLen)), lf = f - T.mont - k * T.montLen;
    if (!MONT[k]) { backdrop(c, f); portrait(c, f, 960, 640 + lf * 2, 2300, 0, [W, H, 0]); }   // last cut: the eyes, close, winking now
    else { const [src, z, fx, fy] = MONT[k]; c.save(); const zz = z * (1 + lf * 0.004); c.translate(W / 2, H / 2); c.rotate((k % 2 ? 1 : -1) * 0.012); c.scale(zz, zz); c.translate(-fx, -fy);
    scene(c, src + lf * 0.6); c.restore(); }
    c.fillStyle = C.ink; c.globalAlpha = lf < 2 ? 0.12 : 0; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
    // frame counter, like a reel
    font(c, 'mono', 22, 700); c.fillStyle = C.ink; c.fillRect(64, H - 96, 150, 44); c.fillStyle = C.bg; c.fillText(`0${k + 1} / 08`, 82, H - 66);
    return;
  }
  if (f >= T.lock) { backdrop(c, f); actLock(c, f); return; }
  scene(c, f);
}
// ---- motion blur: fast moves are averaged from sub-frame samples
const cv = document.getElementById('c'), x = cv.getContext('2d');
const acc = document.createElement('canvas'); acc.width = W; acc.height = H; const ax = acc.getContext('2d');
const FAST = [[T.pop[0], T.pop[0] + 14], [T.expand[0], T.expand[1]], [T.out1[0], T.phoneIn[1]], [T.swipe[0], T.swipe[1]], [T.morph[0], T.morph[1]], [T.burst[0], T.iconsAt + 66], [T.ops - 18, T.opsIn[1]], [T.write - 16, T.write + 24], [T.scroll[0] - 14, T.scroll[0] + 40], [T.neither[0] - 10, T.neither[0] + 14]];
function frame(f) {
  const fast = FAST.some(([a, b]) => f >= a && f <= b);
  if (!fast) { draw(x, f); return; }
  const n = 10; ax.clearRect(0, 0, W, H);
  for (let k = 0; k < n; k++) { draw(x, f - 0.5 + (k + 0.5) / n); ax.globalAlpha = 1 / (k + 1); ax.drawImage(cv, 0, 0); }
  ax.globalAlpha = 1; x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(acc, 0, 0);
}
window.film = { load, frame, TOTAL, T };
