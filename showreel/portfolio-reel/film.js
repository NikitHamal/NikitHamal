// "Nikit Hamal": a 29 s reel of the person behind nikit.is-a.dev. 60 fps, 120 BPM (beat = 30 f, bar = 120 f).
// Landscape 1920x1080 by default; ?v=portrait renders the hand-laid-out 1080x1920 cut.
// Built from the main site only: the painted portrait with live eyes, the real apps (NEBians, Lami Nepal, AstroWeb,
// redrawn from their actual screens), the stack, operations at Consica Labs, the essays, the koi pond and the pixel pup.
// Device: the site's own "> " prompt types every act in. Engine: ../shared/lib.js. Every frame is a pure function of f.
'use strict';
const { E, clamp, prog, mix, hash, img, font, typed, rise, portrait, cover, form } = LIB;
const PORT = new URLSearchParams(location.search).get('v') === 'portrait';
const W = PORT ? 1080 : 1920, H = PORT ? 1920 : 1080, CX = W / 2, TOTAL = 1740;
const C = { bg: '#faf9f6', warm: '#f4ede2', ink: '#18181b', ink2: '#52525b', mute: '#8e8e93', line: '#e4e2dc', pink: '#d9779a',
  neb: '#1d4ed8', nebInk: '#0b1633', lami: '#b71c1c', lamiGold: '#d39e14', astro: '#1b1d33' };
// ---- timeline (frames). score.py mirrors these numbers.
const T = {
  pop: [54, 84], blink1: 112, expand: [150, 200], name: 168, sub: 190, wink1: 222,
  build: 240, out1: [240, 272], phoneIn: [248, 290], neb: 262, nebTap: 332, nebDetail: [338, 358], swipe: [400, 418],
  lami: 404, hop: [420, 432, 444], lamiTap: 462, matches: [466, 484],
  morph: [512, 546], astro: 546, astroTap: 594, chartPg: [598, 614], chart: [612, 648], planets: 640,
  stack: 660, burst: [660, 700], iconsAt: 672, stackCopy: 712,
  ops: 780, opsIn: [780, 810], ticks: [822, 837, 852, 867], bar: [822, 890],
  write: 900, warm: [900, 932], be: 928, strike: [972, 990], which: 996, scroll: [1040, 1096], neither: [1102, 1154, 1206],
  pond: 1260, iris: [1260, 1296], feed: 1322,
  mont: 1380, montN: 8, montLen: 15,
  lock: 1500, lockIn: [1500, 1536], lname: 1512, ltype: 1540, lurl: 1620, wake: 1644, wink2: 1668, end: 1740,
};
// ---- layout per orientation (hand-placed)
const LY = PORT ? {
  head: [64, 150], hello: { av: [540, 700], tx: 540, ty: 1010, pc: [540, 700], pbox: [900, 1080], ph: 1180, name: [540, 1430], sub: [540, 1520], nameSize: 140, align: 'center' },
  phone: { cx: 540, cy: 920, s: 1.52 }, label: [540, 1730, 'center'], browser: [960, 1400, 540, 900], astroLabel: [540, 1720, 'center'],
  grid: { cols: 4, gx: 220, gy: 220, cy: 860, sz: 150 }, stackCopy: [540, 1380, 34],
  card: [920, 1000], be: 150, which: 58, whichSplit: true, titles: 60, neitherSplit: true,
  lock: { av: [540, 540, 300], name: [540, 870, 132], dog: [540, 1180], lines: [540, 1290, 32, 58], url: [540, 1560], align: 'center' },
  mont: [[160, 1.3, 540, 1000], [T.neb + 80, 1.35, 540, 760], [T.matches[1] + 30, 1.35, 540, 820], [T.chart[1] + 6, 1.3, 540, 900], [T.iconsAt + 60, 1.5, 540, 860], [T.strike[1] + 30, 1.3, 540, 900], [T.feed + 20, 1.35, 540, 900], null],
} : {
  head: [96, 112], hello: { av: [560, 540], tx: 720, ty: 560, pc: [600, 540], pbox: [680, 900], ph: 960, name: [1010, 560], sub: [1016, 650], nameSize: 150, align: 'left' },
  phone: { cx: 1180, cy: 590, s: 0.98 }, label: [120, 880, 'left'], browser: [1380, 720, 960, 560], astroLabel: [960, 1000, 'center'],
  grid: { cols: 7, gx: 200, gy: 200, cy: 470, sz: 120 }, stackCopy: [960, 820, 40],
  card: [1040, 600], be: 170, which: 64, whichSplit: false, titles: 72, neitherSplit: false,
  lock: { av: [535, 300, 230], name: [420, 580, 150], dog: null, lines: [424, 680, 34, 54], url: [424, 900], align: 'left' },
  mont: [[160, 1.8, 760, 520], [T.neb + 80, 1.5, 1180, 560], [T.matches[1] + 30, 1.5, 1180, 600], [T.chart[1] + 6, 1.45, 820, 600], [T.iconsAt + 60, 1.7, 960, 470], [T.strike[1] + 30, 1.4, 960, 520], [T.feed + 20, 1.4, 960, 560], null],
};
const ICONS = ['kotlin-plain', 'jetpackcompose-original', 'android-plain', 'python-plain', 'django-plain', 'svelte-original', 'typescript-plain', 'javascript-plain', 'firebase-plain', 'tailwindcss-original', 'redis-original', 'mysql-original', 'git-plain', 'flutter-plain'];
const TITLES = ['A Love that never hurts', 'Blessed', 'Effort clouds effortless', 'Everything is thought', 'God and The Ocean', 'How to be happy?', '“I” and “You” cannot Love',
  'I offer my curse to God', 'In relationship, there is no love', 'Interconnectedness', 'Love is acceptance', 'Perfect', 'Take me as I am', 'The lie of “being yourself”',
  'The Non-Dual Relationship', 'The Wrong Guy Trying to Wake Up', 'There is only one step', 'Unity is a lie', 'We came out of this world', 'We never met',
  'What is divine self?', 'Where is God?', 'Wisdom cannot be taught', 'You never trusted anyone', 'You'];
const LAND = TITLES.indexOf('Where is God?');

// ---- assets
const A = {};
async function load() {
  await LIB.fonts();
  const track = LIB.eyeTrack({
    keys: [[0, 0.75, 0.15], [40, 0.9, 0.1], [84, 0.6, 0.05], [140, 0.2, 0], [176, -0.1, 0.05], [200, 0, 0], [1500, 0, 0], [1540, PORT ? 0 : 0.85, PORT ? 0.6 : 0.2], [1616, PORT ? 0 : 0.6, PORT ? 0.8 : 0.35], [1650, 0.5, 0.5], [1664, 0, 0]],
    blinks: [T.blink1, 330, 520, 750, 965, 1240, 1350, 1580], winks: [[T.wink1, 'l'], [T.mont + 7 * T.montLen + 3, 'r'], [T.wink2, 'l']],
    over: f => f < 140 ? { lx: PORT ? 0 : mix(0.55, 0.95, Math.min(15, Math.floor(f / 4)) / 15), ly: PORT ? mix(0.4, 0.7, Math.min(15, Math.floor(f / 4)) / 15) : 0.1 } : null });
  A.me = await LIB.loadPortrait('../shared/art', 'now', track);
  A.icons = await Promise.all(ICONS.map(n => img(`assets/icons/${n}.svg`)));
  A.lami = await img('assets/lami-logo.png'); A.neb = await img('assets/neb-logo.svg');
  A.petals = await Promise.all([0, 1, 2, 3, 4, 5].map(i => img(`assets/sakura-${i}.svg`)));
  A.pond = await LIB.loadClip(`../shared/pond/${PORT ? 'port' : 'land'}_day.webm`, 150);
  A.dog = LIB.dogKit('rottie');
}

// the site's section header: "> TITLE", letter-spaced mono, typed fast, with a rule drawing under it
function header(c, text, f, f0, f1, col = C.ink) {
  if (f < f0 || f > f1 + 12) return; const a = 1 - E.exit(prog(f, f1, f1 + 12)), [hx, hy] = LY.head, sz = PORT ? 30 : 26;
  c.save(); c.globalAlpha = a; c.letterSpacing = '4px'; font(c, 'mono', sz, 700); c.fillStyle = col; c.fillText('>', hx, hy);
  typed(c, text, f, f0 + 4, hx + sz * 1.3, hy, sz, { weight: 700, rate: 1.5, caretUntil: f0 + 40, col, caretCol: col }); c.restore();
  c.save(); c.globalAlpha = a * 0.9; c.fillStyle = col === C.ink ? C.line : 'rgba(255,255,255,0.35)'; c.fillRect(hx, hy + 24, mix(0, W - hx * 2, E.out(prog(f, f0, f0 + 40))), 2); c.restore();
}

// ---- act 1: hello
function actHello(c, f) {
  const L = LY.hello, ex = E.inOut(prog(f, ...T.expand)), out = E.whip(prog(f, ...T.out1)), pop = E.out(prog(f, ...T.pop));
  c.save(); if (PORT) c.translate(0, -out * H * 1.1); else c.translate(-out * W * 1.1, 0);
  if (f >= T.pop[0]) {   // the homepage avatar: head and shoulders in a circle, opening into the full painting
    const D = mix(0, 208, pop) * (PORT ? 1.6 : 1), cx = mix(L.av[0], L.pc[0], ex), cy = mix(L.av[1], L.pc[1], ex);
    const h = mix(D * 1000 / 700, L.ph, ex), bw = mix(D, L.pbox[0], ex), bh = mix(D, L.pbox[1], ex);
    portrait(c, A.me, f, cx, cy, h, 1 - ex, [bw, bh], mix(440, 500, ex));
    if (ex < 1) { c.save(); c.globalAlpha = 1 - ex; c.strokeStyle = C.line; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, D / 2 + 6, 0, 7); c.stroke(); c.restore(); }
  }
  const ta = 1 - E.exit(prog(f, T.name - 10, T.name + 6)), tx = PORT ? L.tx : mix(L.tx, L.name[0], ex), ty = PORT ? mix(L.ty, L.name[1], ex) : L.ty;
  c.save(); c.globalAlpha = ta; typed(c, "> hi, i'm nikit", f, 0, tx, ty, PORT ? 60 : 64, { rate: 4, caretUntil: T.name, align: L.align }); c.restore();
  if (f >= T.name) {
    const u = E.out(prog(f, T.name, T.name + 26)); c.save(); font(c, 'serif', L.nameSize); c.textAlign = L.align; c.fillStyle = C.ink; c.globalAlpha = u; c.fillText('Nikit Hamal', L.name[0], L.name[1] + (1 - u) * 40); c.restore();
    typed(c, 'android · full-stack · writing', f, T.sub, L.sub[0] + (PORT ? 0 : 6), L.sub[1], PORT ? 32 : 34, { col: C.ink2, rate: 1.6, caretUntil: T.build, align: L.align });
  }
  c.restore();
}

// ---- act 2: the apps, redrawn from their real screens
const SW = 412, SH = 860;   // phone screen in logical px
function statusBar(c, w, dark = false) { font(c, 'pop', 13, 600); c.fillStyle = dark ? '#fff' : '#1f1f1f'; c.fillText('12:09', 22, 26); c.textAlign = 'right'; font(c, 'icon', 15); c.fillText('signal_cellular_alt wifi battery_full', w - 18, 28); c.textAlign = 'left'; }
function icon(c, name, x, y, size, col) { font(c, 'icon', size); c.fillStyle = col; c.fillText(name, x, y); }
function ripple(c, f, at, x, y, col = 'rgba(29,78,216,0.18)') { const u = prog(f, at, at + 18); if (u <= 0 || u >= 1) return; c.save(); c.fillStyle = col; c.globalAlpha = 1 - u; c.beginPath(); c.arc(x, y, 12 + u * 90, 0, 7); c.fill(); c.restore(); }
function card(c, x, y, w, h, r, fill, stroke) { c.beginPath(); c.roundRect(x, y, w, h, r); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.2; c.stroke(); } }
function avatarDot(c, f, x, y, r) { c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.clip(); c.fillStyle = '#e9e1d3'; c.fillRect(x - r, y - r, r * 2, r * 2); portrait(c, A.me, f, x, y + r * 0.25, r * 2 * 1.35, 1, [r * 2.2, r * 2.2], 470); c.restore(); }
function waves(c, x, y, w, h, base, tone) { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = base; c.fillRect(x, y, w, h);
  for (let k = 0; k < 3; k++) { c.fillStyle = tone[k]; c.beginPath(); c.moveTo(x, y + h); for (let i = 0; i <= 20; i++) { const xx = x + w * i / 20; c.lineTo(xx, y + h * (0.45 + k * 0.17) + Math.sin(i * 0.7 + k * 1.7) * h * 0.08); } c.lineTo(x + w, y + h); c.fill(); } c.restore(); }
function screenNEB(c, f, w, h) {
  c.fillStyle = '#fbfcff'; c.fillRect(0, 0, w, h); statusBar(c, w);
  const d = E.inOut(prog(f, ...T.nebDetail));
  c.save(); c.translate(-d * w * 0.3, 0); c.globalAlpha = 1 - d * 0.4;
  c.drawImage(A.neb, 20, 46, 30, 30); font(c, 'pop', 19, 600); c.fillStyle = C.neb; c.fillText('NEBians', 58, 69);
  icon(c, 'search', w - 118, 72, 24, '#333'); icon(c, 'notifications_none', w - 84, 72, 24, '#333'); avatarDot(c, f, w - 34, 62, 16);
  font(c, 'pop', 22, 700); c.fillStyle = '#111'; c.fillText('Digital Library', 20, 124); icon(c, 'filter_list', w - 44, 126, 24, '#333');
  font(c, 'pop', 14, 600); [['Library', 20], ['Syllabus', 106], ['Interactive', 196]].forEach(([t, x], i) => { c.fillStyle = i ? '#555' : C.neb; c.fillText(t, x, 168); });
  c.fillStyle = '#e6e8ef'; c.fillRect(0, 180, w, 1); c.fillStyle = C.neb; c.fillRect(16, 178, 66, 3);
  card(c, 16, 196, w - 32, 40, 8, '#fff', '#e7e9f0'); font(c, 'pop', 12, 500); c.fillStyle = '#666'; c.fillText('Showing 1–16 of 16 resources', 28, 221); c.textAlign = 'right'; c.fillStyle = C.neb; c.fillText('Most Relevant ▾', w - 28, 221); c.textAlign = 'left';
  const cw = (w - 44) / 2, R = [['Mathematics', 'Probability', 'Class 10 / SEE · PDF', '11 views', '#fdecec', '#c2410c', null],
    ['Health & Physical Edu…', 'BLE | SET Solutions | Health and Physical E…', 'Class 8 · SEE · PDF', '31 views', '#eef2ff', C.neb, null],
    ['Science', 'Magnetic Field', 'Class 10 / SEE · Image', '9 views', '#fff', C.neb, ['#e9edf5', ['#c9d0dc', '#aeb7c6', '#8f99aa']]],
    ['1. Integrated Health Sci…', 'Bsc nursing 1st year, TU, IOM', 'Bachelor · PDF', '23 views', '#fff', C.neb, ['#e9f2f7', ['#c2dde8', '#9ec9da', '#6fb0c8']]]];
  R.forEach(([chip, t, meta, views, bg, cc, wv], i) => {
    const u = E.out(prog(f, T.neb + 16 + i * 7, T.neb + 40 + i * 7)); if (u <= 0) return; const x = 16 + (i % 2) * (cw + 12), y = 252 + Math.floor(i / 2) * 270 + (1 - u) * 40;
    c.save(); c.globalAlpha *= u; card(c, x, y, cw, 254, 10, '#fff', '#e3e6ee'); let ty = y + 26;
    if (wv) { font(c, 'pop', 11, 600); c.fillStyle = '#555'; c.fillText(i === 2 ? 'Image' : 'PDF', x + 12, y + 22); waves(c, x + 1, y + 32, cw - 2, 74, wv[0], wv[1]); ty = y + 126; }
    else { c.fillStyle = bg; c.beginPath(); c.roundRect(x + 1, y + 1, cw - 2, 120, [10, 10, 0, 0]); c.fill(); ty = y + 30; }
    font(c, 'pop', 11, 600); c.fillStyle = cc; c.fillText(chip, x + 12, ty); font(c, 'pop', 14, 600); c.fillStyle = '#111';
    const words = t.split(' '); let line = '', ly = ty + 26; for (const wd of words) { if (c.measureText(line + wd).width > cw - 24) { c.fillText(line, x + 12, ly); line = ''; ly += 20; } line += wd + ' '; } c.fillText(line, x + 12, ly);
    font(c, 'pop', 11, 400); c.fillStyle = '#777'; c.fillText(meta, x + 12, y + 228 - 18); c.fillText(views, x + 12, y + 244 - 14); c.restore();
  });
  ripple(c, f, T.nebTap, 16 + cw * 1.5 + 12, 330);
  c.fillStyle = '#fff'; c.fillRect(0, h - 76, w, 76); c.fillStyle = '#eceef4'; c.fillRect(0, h - 76, w, 1);
  [['home', 'Home'], ['menu_book', ''], ['forum', ''], ['person_outline', '']].forEach(([n, t], i) => { const x = 30 + i * (w - 60) / 3.3; if (!i) { card(c, x - 10, h - 58, 96, 38, 19, '#e3eaff'); icon(c, n, x, h - 30, 22, C.neb); font(c, 'pop', 13, 600); c.fillStyle = C.neb; c.fillText(t, x + 28, h - 34); } else icon(c, n, x + 40, h - 30, 24, '#555'); });
  c.restore();
  if (d > 0) {   // the resource page pushes in
    c.save(); c.translate((1 - d) * w, 0); c.fillStyle = '#f6f7fb'; c.fillRect(0, 0, w, h); c.shadowColor = 'rgba(0,0,0,0.12)'; c.shadowBlur = 20; c.fillRect(0, 0, 1, h); c.shadowBlur = 0; statusBar(c, w);
    icon(c, 'arrow_back', 18, 76, 24, '#222'); font(c, 'pop', 17, 600); c.fillStyle = '#111'; c.fillText('Resource', 54, 72);
    card(c, 16, 100, w - 32, 400, 12, '#fff', '#e3e6ee'); c.fillStyle = C.nebInk; c.fillRect(16, 100, w - 32, 4);
    [['Health & Physical Education', 18], ['PDF', 220], ['Class 8', 270]].forEach(([t, x]) => { font(c, 'pop', 11, 600); const tw = c.measureText(t).width; card(c, x + 12, 120, tw + 20, 24, 12, '#e8eeff'); c.fillStyle = C.neb; c.fillText(t, x + 22, 137); });
    font(c, 'pop', 18, 700); c.fillStyle = '#111'; c.fillText('BLE | SET Solutions | Health and', 30, 180); c.fillText('Physical Education', 30, 204);
    font(c, 'pop', 12, 500); c.fillStyle = '#666'; c.fillText('8d ago   ·   31 views   ·   48', 30, 232);
    font(c, 'pop', 12, 400); c.fillStyle = '#555'; ['BLE Health, Physical and Creative Arts SET', 'Solutions. Overview: the BLE Health and', 'Physical Education SET Solution…'].forEach((t, i) => c.fillText(t, 30, 266 + i * 19));
    font(c, 'pop', 12, 600); c.fillStyle = C.neb; c.fillText('See more', 30, 330); c.fillStyle = '#333'; c.fillText('By Anil Katwal, Bikram Adhikari', 30, 360);
    icon(c, 'thumb_up_off_alt', 30, 412, 20, '#444'); font(c, 'pop', 12, 500); c.fillText('0', 56, 408); c.fillStyle = '#e8eeff'; c.beginPath(); c.arc(98, 404, 16, 0, 7); c.fill(); icon(c, 'share', 88, 413, 18, C.neb);
    const bu = E.out(prog(f, T.nebDetail[1] - 4, T.nebDetail[1] + 16));
    c.globalAlpha = bu; card(c, 16, 520, (w - 44) / 2, 46, 23, C.neb); icon(c, 'menu_book', 52, 551, 20, '#fff'); font(c, 'pop', 14, 600); c.fillStyle = '#fff'; c.fillText('Read', 80, 548);
    card(c, 28 + (w - 44) / 2, 520, (w - 44) / 2, 46, 23, '#fff', C.neb); icon(c, 'download', 56 + (w - 44) / 2, 551, 20, C.neb); font(c, 'pop', 14, 600); c.fillStyle = C.neb; c.fillText('Download', 84 + (w - 44) / 2, 548);
    font(c, 'pop', 14, 700); c.fillStyle = '#111'; c.fillText('Comments (0)', 18, 606); card(c, 16, 622, w - 32, 50, 10, '#fff', '#e3e6ee'); font(c, 'pop', 13, 400); c.fillStyle = '#999'; c.fillText('Add a comment…', 32, 652); icon(c, 'send', w - 52, 657, 22, '#9aa');
    c.restore();
  }
}
function screenLami(c, f, w, h) {
  c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); statusBar(c, w);
  const m = E.inOut(prog(f, ...T.matches));
  c.save(); c.translate(-m * w * 0.3, 0); c.globalAlpha = 1 - m * 0.4;
  font(c, 'pop', 26, 700); c.fillStyle = '#111'; c.fillText('Namaste, Nikit!', 20, 92); font(c, 'pop', 14, 400); c.fillStyle = '#777'; c.fillText('Good Evening', 20, 116);
  const days = ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU'], sel = f < T.hop[1] ? (f < T.hop[0] ? 0 : 1) : 2, dx = (w - 40) / 6;
  const hp = T.hop[Math.max(0, sel - 1)], mv = sel ? E.out(prog(f, hp, hp + 10)) : 1, sx = mix(sel ? sel - 1 : 0, sel, mv);
  c.fillStyle = C.lami; c.beginPath(); c.arc(20 + dx * (sx + 0.5), 172, 21, 0, 7); c.fill();
  days.forEach((d, i) => { const x = 20 + dx * (i + 0.5); font(c, 'pop', 10, 600); c.textAlign = 'center'; c.fillStyle = i === sel ? C.lami : '#888'; c.fillText(d, x, 140);
    if (Math.abs(i - sx) > 0.6) { c.strokeStyle = '#e5e5e5'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, 172, 21, 0, 7); c.stroke(); }
    font(c, 'pop', 15, 600); c.fillStyle = Math.abs(i - sx) < 0.5 ? '#fff' : '#222'; c.fillText(String(9 + i), x, 178); c.textAlign = 'left'; });
  const u1 = E.out(prog(f, T.lami + 8, T.lami + 32)), u2 = E.out(prog(f, T.lami + 18, T.lami + 42));
  c.save(); c.globalAlpha *= u1; c.translate(0, (1 - u1) * 40); const g1 = c.createLinearGradient(0, 214, w, 404); g1.addColorStop(0, '#c62828'); g1.addColorStop(1, '#a81818');
  card(c, 18, 214, w - 36, 192, 18, g1); c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(80, 300, 40, 0, 7); c.fill(); c.save(); c.beginPath(); c.arc(80, 300, 30, 0, 7); c.clip(); c.drawImage(A.lami, 50, 270, 60, 60); c.restore();
  font(c, 'pop', 22, 700); c.fillStyle = '#fff'; c.fillText('Lami Nepal', 140, 262); font(c, 'pop', 13, 400); ['A trusted path to', 'meaningful', 'matchmaking'].forEach((t, i) => c.fillText(t, 140, 290 + i * 19)); font(c, 'pop', 12, 600); c.fillText('Explore  →', 140, 372); c.restore();
  c.save(); c.globalAlpha *= u2; c.translate(0, (1 - u2) * 40); const g2 = c.createLinearGradient(0, 420, w, 640); g2.addColorStop(0, '#dca51a'); g2.addColorStop(1, '#c48b0c');
  card(c, 18, 420, w - 36, 224, 18, g2); c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.roundRect(42, 486, 76, 80, 14); c.fill();
  c.fillStyle = '#7a4a10'; c.beginPath(); c.arc(80, 514, 15, 0, 7); c.fill(); c.beginPath(); c.ellipse(80, 556, 24, 16, 0, Math.PI, 0); c.fill();
  font(c, 'pop', 22, 700); c.fillStyle = '#fff'; c.fillText('Tulasi Guru', 140, 468); font(c, 'pop', 13, 400); ['Consult Tulasi Bhardwaj', 'Niraula Guru online or in', 'person for Cheena reading', 'and Vastu advice'].forEach((t, i) => c.fillText(t, 140, 494 + i * 19)); font(c, 'pop', 12, 600); c.fillText('Request now  →', 140, 590 + 16); c.restore();
  card(c, 18, 664, w - 36, 60, 14, '#fff', '#eee'); font(c, 'pop', 15, 600); c.fillStyle = '#222'; c.fillText('Advertisements', 36, 700);
  c.restore();
  if (m > 0) {   // tapping Matches
    c.save(); c.translate((1 - m) * w, 0); c.fillStyle = '#fafafa'; c.fillRect(0, 0, w, h); statusBar(c, w);
    font(c, 'pop', 22, 600); c.fillStyle = '#111'; c.fillText('Matches', 20, 78); icon(c, 'search', w - 130, 82, 24, '#333'); icon(c, 'tune', w - 92, 82, 24, '#333'); icon(c, 'people_outline', w - 54, 82, 24, '#333');
    let cx = 22; [['Matched', 0], ['All', 0], ['Men', 0], ['Women', 1]].forEach(([t, on]) => { font(c, 'pop', 13, 500); const tw = c.measureText(t).width + 30; card(c, cx, 104, tw, 34, 17, on ? '#fff5f5' : '#fff', on ? C.lami : '#ddd'); c.fillStyle = on ? C.lami : '#555'; c.fillText(t, cx + 15, 126); cx += tw + 10; });
    [['802', 'Caste: Hidden | 26 years |', 'Kathmandu'], ['753', 'Caste: Hidden | 32 years |', 'Kathmandu'], ['795', 'Caste: Khapatari | 32 years |', 'Lalitpur']].forEach(([id, a, b], i) => {
      const u = E.out(prog(f, T.matches[0] + 6 + i * 8, T.matches[0] + 30 + i * 8)); if (u <= 0) return; const y = 156 + i * 150 + (1 - u) * 30;
      c.save(); c.globalAlpha *= u; card(c, 16, y, w - 32, 136, 14, '#fff', '#ececec'); card(c, 30, y + 16, 82, 104, 10, '#f6f6f6');
      c.fillStyle = '#f58bb8'; c.beginPath(); c.arc(71, y + 68, 20, 0, 7); c.fill(); icon(c, 'female', 59, y + 80, 24, '#fff');
      font(c, 'pop', 15, 600); c.fillStyle = '#111'; c.fillText('Client ID: ' + id, 128, y + 36); c.fillStyle = '#1d6fe0'; c.beginPath(); c.arc(c.measureText('Client ID: ' + id).width + 142, y + 31, 7, 0, 7); c.fill();
      font(c, 'pop', 11, 400); c.fillStyle = '#777'; c.fillText(a, 128, y + 58); c.fillText(b, 128, y + 74); card(c, 128, y + 88, w - 160, 32, 8, '#fdecec'); font(c, 'pop', 13, 500); c.fillStyle = C.lami; c.textAlign = 'center'; c.fillText('View Profile', 128 + (w - 160) / 2, y + 109); c.textAlign = 'left'; c.restore();
    });
    card(c, 16, 618, w - 32, 44, 8, C.lami); font(c, 'pop', 14, 500); c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText('Load More', w / 2, 646); c.textAlign = 'left';
    c.restore();
  }
  ripple(c, f, T.lamiTap, w * 0.36, h - 40, 'rgba(183,28,28,0.18)');
  c.fillStyle = '#fff'; c.fillRect(0, h - 76, w, 76); c.fillStyle = '#eee'; c.fillRect(0, h - 76, w, 1);
  [['home', 'Home'], ['favorite_border', 'Matches'], ['chat_bubble_outline', 'Chat'], ['person_outline', 'Profile']].forEach(([n, t], i) => { const x = w * (i + 0.5) / 4, on = (i === 0 && m < 0.5) || (i === 1 && m >= 0.5);
    c.textAlign = 'center'; icon(c, i === 1 && on ? 'favorite' : n, x, h - 36, 24, on ? C.lami : '#666'); font(c, 'pop', 10, on ? 600 : 400); c.fillStyle = on ? C.lami : '#666'; c.fillText(t, x, h - 18); c.textAlign = 'left'; });
}
// AstroWeb (light UI, Cinzel Decorative + Poppins): the dashboard, then a tap on Kundali opens a sample birth chart
function astroLogo(c, x, y, r) { c.fillStyle = C.astro; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = '#e8a93a'; c.lineWidth = r * 0.22; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - r * 0.45, y + r * 0.55); c.lineTo(x, y - r * 0.6); c.lineTo(x + r * 0.45, y + r * 0.55); c.moveTo(x - r * 0.25, y + r * 0.15); c.lineTo(x + r * 0.25, y + r * 0.15); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y - r * 0.62, r * 0.12, 0, 7); c.fill(); }
function ticks(c, x, y, w, h) { c.strokeStyle = '#bbb'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 8, y + 16); c.lineTo(x + 8, y + 8); c.lineTo(x + 16, y + 8); c.moveTo(x + w - 16, y + h - 8); c.lineTo(x + w - 8, y + h - 8); c.lineTo(x + w - 8, y + h - 16); c.stroke(); }
function screenAstro(c, f, w, h) {
  c.fillStyle = '#f8f8f8'; c.fillRect(0, 0, w, h); const narrow = w < 1100, pad = narrow ? 28 : 56, k = E.inOut(prog(f, ...T.chartPg));
  c.save(); c.translate(-k * w * 0.25, 0); c.globalAlpha = 1 - k;
  astroLogo(c, pad + 18, 44, 18); font(c, 'cinzel', narrow ? 28 : 30, 700); c.fillStyle = C.astro; c.fillText('AstroWeb', pad + 46, 56);
  font(c, 'pop', 10, 500); c.letterSpacing = '2px'; c.fillStyle = '#888'; c.fillText('EXPLORE YOUR COSMIC JOURNEY TODAY.', pad, 84); c.letterSpacing = '0px';
  if (!narrow) { card(c, w - pad - 330, 22, 220, 48, 24, '#fff', '#ddd'); c.fillStyle = C.astro; c.fillRect(w - pad - 318, 30, 32, 32); font(c, 'pop', 12, 600); c.fillStyle = '#fff'; c.fillText('NH', w - pad - 312, 51); font(c, 'pop', 14, 500); c.fillStyle = '#222'; c.fillText('Select Profile  ⌄', w - pad - 274, 52);
    [w - pad - 96, w - pad - 44].forEach((x, i) => { card(c, x, 24, 44, 44, 22, '#fff', '#ddd'); icon(c, i ? 'settings' : 'info', x + 10, 56, 24, '#222'); }); }
  const pu = E.out(prog(f, T.astro, T.astro + 20)); c.globalAlpha *= pu || 0.001; const g = c.createLinearGradient(pad, 104, w - pad, 230); g.addColorStop(0, '#f0f0f0'); g.addColorStop(1, '#fff');
  card(c, pad, 104, w - pad * 2, 120, 0, g, '#999'); font(c, 'cinzel', narrow ? 28 : 32, 400); c.fillStyle = C.astro; c.fillText('Namaste, Nikit', pad + 28, 158);
  [['wb_sunny', 'Gemini'], ['nightlight', 'Aries']].forEach(([n, t], i) => { const x = pad + 32 + i * 130; card(c, x, 178, 116, 30, 0, '#f4f4f4', '#ddd'); icon(c, n, x + 10, 201, 18, '#555'); font(c, 'pop', 12, 500); c.fillStyle = '#444'; c.fillText(t, x + 38, 198); });
  c.globalAlpha = 1 - k;
  font(c, 'pop', 11, 600); c.letterSpacing = '2.5px'; c.fillStyle = '#555'; c.fillText('CORE READINGS', pad + 4, 262); c.letterSpacing = '0px';
  const cols = narrow ? 2 : 4, gw = (w - pad * 2 - (cols - 1) * 16) / cols, big = [['KUNDALI', 'Detailed Vedic birth charts and divisional charts', 'explore', '#fdf1c7', '#b45309'], ['COMPREHENSIVE ANALYSIS', 'In-depth algorithmic life predictions and insights', 'insights', '#cdf5ec', '#0f766e']];
  big.forEach(([t, s, n, bg, fg], i) => { const u = E.out(prog(f, T.astro + 8 + i * 5, T.astro + 30 + i * 5)); if (u <= 0) return; const bw = narrow ? w - pad * 2 : gw * 2 + 16, x = narrow ? pad : pad + i * (bw + 16), y = (narrow ? 284 + i * 128 : 284) + (1 - u) * 30;
    c.save(); c.globalAlpha *= u; card(c, x, y, bw, 112, 0, '#fff', '#ccc'); ticks(c, x, y, bw, 112); c.fillStyle = bg; c.fillRect(x + 24, y + 24, 64, 64); icon(c, n, x + 40, y + 70, 32, fg);
    font(c, 'cinzel', 21, 400); c.fillStyle = C.astro; c.fillText(t, x + 110, y + 52); font(c, 'pop', 13, 400); c.fillStyle = '#555'; c.fillText(narrow ? s.split(' ').slice(0, 4).join(' ') + '…' : s, x + 110, y + 78); c.restore(); });
  const small = [['LIFE READING', 'menu_book', '#fde7ef', '#be185d'], ['DAILY DASHBOARD', 'dashboard', '#d9f4fb', '#0e7490'], ['PANCHANG', 'event', '#dfe8ff', '#1d4ed8'], ['MUHURTA FINDER', 'event_available', '#fff', '#222'],
    ['REPORTS', 'picture_as_pdf', '#efe7ff', '#6d28d9'], ['LEARN', 'school', '#e5ebf0', '#334155'], ['AI CHAT', 'smart_toy', '#d4f7ec', '#047857'], ['DASHA PERIODS', 'timeline', '#dcfce7', '#15803d']];
  const sy0 = narrow ? 556 : 412;
  small.forEach(([t, n, bg, fg], i) => { const u = E.out(prog(f, T.astro + 14 + i * 3, T.astro + 34 + i * 3)); if (u <= 0) return; const x = pad + (i % cols) * (gw + 16), y = sy0 + Math.floor(i / cols) * 132 + (1 - u) * 30;
    if (y > h - 20) return; c.save(); c.globalAlpha *= u; card(c, x, y, gw, 116, 0, '#fff', '#ccc'); ticks(c, x, y, gw, 116); c.fillStyle = bg; if (bg === '#fff') { c.strokeStyle = '#ddd'; c.strokeRect(x + 20, y + 20, 48, 48); } c.fillRect(x + 20, y + 20, 48, 48); icon(c, n, x + 32, y + 54, 24, fg);
    font(c, 'pop', 12, 600); c.letterSpacing = '1.5px'; c.fillStyle = '#222'; c.fillText(t, x + 20, y + 96); c.letterSpacing = '0px'; c.restore(); });
  ripple(c, f, T.astroTap, pad + 56, 340, 'rgba(27,29,51,0.15)');
  c.restore();
  if (k > 0) chartPage(c, f, w, h, k, narrow, pad);
}
// the real AstroWeb chart page, with a sample chart (not anyone's real birth data)
const SIGNS = [[3, .497, .452], [4, .268, .205], [5, .207, .265], [6, .452, .497], [7, .207, .729], [8, .268, .79], [9, .5, .543], [10, .73, .79], [11, .79, .73], [12, .545, .497], [1, .79, .265], [2, .73, .205]];
const PLANETS = [['Su', .43, .194, '#111'], ['Asc', .566, .194, '#111'], ['Sa', .505, .24, '#111'], ['Ma↓', .235, .104, '#b91c1c'], ['Ju', .096, .245, '#111'], ['Ve°', .763, .086, '#1e40af'], ['Me', .765, .124, '#111'], ['Ra°', .906, .227, '#111'], ['Mo', .906, .267, '#111'], ['Ke°', .096, .75, '#111']];
function chartPage(c, f, w, h, k, narrow, pad) {
  c.save(); c.translate((1 - k) * w * 0.3, 0); c.globalAlpha = k; c.fillStyle = '#f8f8f8'; c.fillRect(0, 0, w, h);
  card(c, pad, 20, w - pad * 2, 86, 0, '#fff', '#999'); c.fillStyle = '#eee'; c.beginPath(); c.arc(pad + 30, 63, 18, 0, 7); c.fill(); icon(c, 'arrow_back', pad + 18, 75, 24, '#333');
  font(c, 'cinzel', 22, 700); c.fillStyle = C.astro; c.fillText('Sample Chart', pad + 64, 60); font(c, 'pop', 12, 400); c.fillStyle = '#888'; c.fillText('Kathmandu · 06:30 AM', pad + 64, 84);
  if (!narrow) { card(c, w - pad - 190, 34, 170, 58, 29, '#f1f1f1', '#ddd'); card(c, w - pad - 184, 40, 82, 46, 23, '#fff'); font(c, 'pop', 14, 600); c.fillStyle = '#111'; c.fillText('North', w - pad - 166, 69); c.fillStyle = '#666'; c.fillText('South', w - pad - 88, 69); }
  const cs = narrow ? Math.min(w - pad * 2 - 40, 560) : Math.min(h - 260, 480), cx0 = narrow ? (w - cs) / 2 : pad + 40, cy0 = narrow ? 210 : 190;
  card(c, narrow ? pad : pad, 128, narrow ? w - pad * 2 : cs + 80, narrow ? cs + 130 : h - 148, 0, '#fff', '#ddd');
  font(c, 'cinzel', 20, 700); c.fillStyle = C.astro; c.textAlign = 'center'; c.fillText('Birth Chart (D1)', cx0 + cs / 2, 168); c.textAlign = 'left';
  const p = prog(f, ...T.chart), segs = [[0, 0, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1], [0, 1, 0, 0], [0, 0, 1, 1], [1, 0, 0, 1], [.5, 0, 1, .5], [1, .5, .5, 1], [.5, 1, 0, .5], [0, .5, .5, 0]];
  c.strokeStyle = '#1a1a1a'; c.lineWidth = 2; c.lineCap = 'square';
  segs.forEach(([a, b, d, e], i) => { const u = E.smooth(clamp(p * segs.length * 0.62 - i * 0.55)); if (u <= 0) return; c.beginPath(); c.moveTo(cx0 + a * cs, cy0 + b * cs); c.lineTo(cx0 + mix(a, d, u) * cs, cy0 + mix(b, e, u) * cs); c.stroke(); });
  if (p > 0.6) { c.strokeRect(cx0 - 4, cy0 - 4, cs + 8, cs + 8); }
  font(c, 'pop', narrow ? 15 : 13, 700); c.textAlign = 'center';
  SIGNS.forEach(([n, hx, hy], i) => { const u = prog(f, T.chart[0] + 18 + i * 1.5, T.chart[0] + 26 + i * 1.5); c.globalAlpha = k * u; c.fillStyle = '#222'; c.fillText(String(n), cx0 + hx * cs, cy0 + hy * cs + 5); });
  PLANETS.forEach(([n, hx, hy, col], i) => { const u = E.out(prog(f, T.planets + i * 2, T.planets + i * 2 + 12)); if (u <= 0) return;
    font(c, 'pop', narrow ? 19 : 16, 800); c.fillStyle = col; c.globalAlpha = k * u; c.fillText(n, cx0 + hx * cs, cy0 + hy * cs + 6 - (1 - u) * 12); });
  c.globalAlpha = k; c.textAlign = 'left';
  // planetary positions
  const tx = narrow ? pad : cx0 + cs + 80, ty = narrow ? cy0 + cs + 80 : 128, tw = narrow ? w - pad * 2 : w - pad - tx;
  card(c, tx, ty, tw, narrow ? h - ty - 20 : h - 148, 0, '#fff', '#ddd'); font(c, 'cinzel', 18, 700); c.fillStyle = C.astro; c.fillText('Planetary Positions', tx + 20, ty + 40);
  c.fillStyle = '#efefef'; c.fillRect(tx, ty + 60, tw, 36); font(c, 'pop', 10, 600); c.letterSpacing = '1.5px'; c.fillStyle = '#666'; ['PLANET', 'SIGN', 'DEGREE', 'DIGNITY'].forEach((t, i) => c.fillText(t, tx + 20 + i * tw / 4.1, ty + 83)); c.letterSpacing = '0px';
  [['Ascendant', 'Gemini', '18° 4′', '—', '#1b1d33'], ['Sun', 'Gemini', '0° 20′', '—', '#bbb'], ['Moon', 'Aries', '29° 39′', '—', '#bbb'], ['Mars', 'Cancer', '0° 30′', '↓ Debilitated', '#c62828'], ['Venus', 'Taurus', '19° 59′', '○ Own Sign', '#1e40af'], ['Saturn', 'Gemini', '19° 52′', '—', '#bbb']].forEach((r, i) => {
    const u = E.out(prog(f, T.chart[0] + 10 + i * 4, T.chart[0] + 30 + i * 4)), y = ty + 96 + i * 52; if (u <= 0 || y + 52 > ty + (narrow ? h - ty - 20 : h - 148)) return;
    c.save(); c.globalAlpha = k * u; c.translate((1 - u) * 30, 0); c.fillStyle = '#eee'; c.fillRect(tx, y + 51, tw, 1); c.fillStyle = r[4]; c.beginPath(); c.arc(tx + 32, y + 26, 11, 0, 7); c.fill();
    font(c, 'pop', 14, 500); const red = r[3].includes('Deb'), blue = r[3].includes('Own'); c.fillStyle = red ? '#c62828' : blue ? '#1e40af' : '#222'; c.fillText(r[0], tx + 54, y + 31); c.fillStyle = '#333'; c.fillText(r[1], tx + 20 + tw / 4.1, y + 31);
    font(c, 'mono', 14, 400); c.fillText(r[2], tx + 20 + 2 * tw / 4.1, y + 31); font(c, 'pop', 13, 400); c.fillStyle = red ? '#c62828' : blue ? '#1e40af' : '#333'; c.fillText(r[3], tx + 20 + 3 * tw / 4.1, y + 31); c.restore(); });
  c.restore();
}
function actBuild(c, f) {
  if (f < T.build - 2 || f >= T.stack + 44) return;
  header(c, 'SIDE PROJECTS & WORK', f, T.build + 6, T.stack - 14);
  const P = LY.phone, B = LY.browser, ri = E.out(prog(f, ...T.phoneIn)), mo = E.inOut(prog(f, ...T.morph)), col = E.inOut(prog(f, T.burst[0], T.burst[0] + 24));
  const pw = SW + 28, ph = SH + 40, s = mix(P.s, 1, mo), w = mix(pw, B[0] / s, mo), h = mix(ph, B[1] / s, mo), rad = mix(56, 18, mo);
  const cx = mix(P.cx, B[2], mo), cy = mix(P.cy, B[3], mo) + (1 - ri) * H, sc = 1 - col; if (sc <= 0.01) return;
  c.save(); c.translate(cx, cy); c.scale(s * sc, s * sc); c.rotate(-0.04 * col);
  c.save(); c.shadowColor = 'rgba(24,24,27,0.22)'; c.shadowBlur = 60; c.shadowOffsetY = 26; c.fillStyle = '#111114'; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, rad); c.fill(); c.restore();
  const bz = mix(14, 0, mo), top = mix(20, 44, mo), sw = w - bz * 2, sh = h - bz - top, sx = -w / 2 + bz, sy = -h / 2 + top;
  if (mo > 0) { c.save(); c.globalAlpha = mo; c.fillStyle = '#ececee'; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, top + 4, [rad, rad, 0, 0]); c.fill();
    ['#ff5f57', '#febc2e', '#28c840'].forEach((k, i) => { c.fillStyle = k; c.beginPath(); c.arc(-w / 2 + 26 + i * 22, -h / 2 + 22, 7, 0, 7); c.fill(); });
    card(c, -200, -h / 2 + 9, 400, 26, 13, '#fff'); font(c, 'pop', 13, 400); c.fillStyle = '#555'; c.textAlign = 'center'; c.fillText(f < T.astroTap + 4 ? 'astroweb.consicalabs.com' : 'astroweb.consicalabs.com/kundali', 0, -h / 2 + 27); c.textAlign = 'left'; c.restore(); }
  c.save(); c.beginPath(); c.roundRect(sx, sy, sw, sh, Math.max(4, rad - bz)); c.clip(); c.translate(sx, sy);
  if (f < T.morph[0] + 14) {
    const sp = E.inOut(prog(f, ...T.swipe));
    if (sp < 1) { c.save(); c.translate(-sp * sw, 0); c.scale(sw / SW, sh / SH); screenNEB(c, f, SW, SH); c.restore(); }
    if (sp > 0) { c.save(); c.translate((1 - sp) * sw, 0); c.scale(sw / SW, sh / SH); screenLami(c, f, SW, SH); c.restore(); }
    if (mo > 0) { c.fillStyle = '#f8f8f8'; c.globalAlpha = Math.min(1, mo * 2.2); c.fillRect(0, 0, sw, sh); c.globalAlpha = 1; }
  } else screenAstro(c, f, sw, sh);
  c.restore();
  if (mo < 0.4) { c.fillStyle = '#000'; c.globalAlpha = 1 - mo * 2.5; c.beginPath(); c.arc(0, -h / 2 + 30, 8, 0, 7); c.fill(); c.globalAlpha = 1; }
  c.restore();
  // the app's name, typed; swaps with each app
  const lab = f < T.swipe[0] + 8 ? ['NEBians', 'Learn it. Pass it. Pass it on.', A.neb] : f < T.morph[0] + 16 ? ['Lami Nepal', 'matchmaking · jyotish · Nepali calendar', A.lami] : ['AstroWeb', 'free Vedic astrology · SvelteKit', null];
  const lf = f < T.swipe[0] + 8 ? T.neb : f < T.morph[0] + 16 ? T.swipe[0] + 8 : T.morph[0] + 16, la = 1 - E.exit(prog(f, T.stack - 14, T.stack + 2)), [lx, ly, al] = f >= T.morph[0] + 16 ? LY.astroLabel : LY.label;
  if (mo > 0.2 && mo < 1) return;   // the browser needs the room while it morphs
  const LYy = ly;
  c.save(); c.globalAlpha = la; const lu = E.out(prog(f, lf, lf + 18));
  font(c, 'mono', 46, 700); const nw = c.measureText(lab[0]).width, ix = al === 'center' ? lx - nw / 2 - 34 : lx;
  c.globalAlpha = la * lu; if (lab[2]) c.drawImage(lab[2], ix - (al === 'center' ? 0 : 0), LYy - 40, 44, 44); else astroLogo(c, ix + 22, LYy - 18, 22);
  c.globalAlpha = la; typed(c, lab[0], f, lf, al === 'center' ? lx + 30 : lx + 62, LYy, 46, { weight: 700, rate: 2, caretUntil: lf + 40, align: al });
  typed(c, lab[1], f, lf + 10, al === 'center' ? lx : lx + 2, LYy + 52, PORT ? 26 : 24, { col: C.ink2, rate: 0.8, caret: false, align: al }); c.restore();
}

// ---- act 3: the stack (icons burst out of the collapsing window)
function iconPos(i) { const G = LY.grid, n = ICONS.length, row = Math.floor(i / G.cols), inRow = Math.min(G.cols, n - row * G.cols), rows = Math.ceil(n / G.cols);
  return [CX + ((i % G.cols) - (inRow - 1) / 2) * G.gx, G.cy + (row - (rows - 1) / 2) * G.gy]; }
function actStack(c, f) {
  if (f < T.burst[0] || f >= T.ops + 30) return;
  header(c, 'SKILLS & EXPERIENCE', f, T.stack + 4, T.ops - 14);
  const ex = E.inOut(prog(f, T.ops - 18, T.ops + 18)), G = LY.grid;
  ICONS.forEach((n, i) => {
    const s0 = T.iconsAt + i * 3, u = E.out(prog(f, s0, s0 + 26)); if (u <= 0) return;
    const [tx, ty] = iconPos(i), a = hash(i + 4) * 6.28, sx = LY.browser[2] + Math.cos(a) * 30, sy = LY.browser[3] + Math.sin(a) * 30, drift = Math.sin((f - s0) * 0.04 + i) * 6;
    let x = mix(sx, tx, u), y = mix(sy, ty, u) + drift * u, sz = mix(30, G.sz, u); x = mix(x, CX, ex); y = mix(y, H / 2 + 60, ex); sz = mix(sz, 0, ex);
    c.save(); c.globalAlpha = Math.min(1, u * 1.5); c.fillStyle = '#fff'; c.strokeStyle = C.line; c.lineWidth = 2; c.beginPath(); c.roundRect(x - sz * 0.75, y - sz * 0.75, sz * 1.5, sz * 1.5, sz * 0.35); c.fill(); c.stroke();
    c.drawImage(A.icons[i], x - sz / 2, y - sz / 2, sz, sz); c.restore();
  });
  const ca = 1 - E.exit(prog(f, T.ops - 18, T.ops - 4)), [sx2, sy2, ss] = LY.stackCopy;
  c.save(); c.globalAlpha = ca;
  if (PORT) { typed(c, 'kotlin · compose · django', f, T.stackCopy, sx2, sy2, ss, { rate: 1.2, align: 'center', caret: false }); typed(c, 'svelte · firebase', f, T.stackCopy + 30, sx2, sy2 + 56, ss, { rate: 1.2, align: 'center', caretUntil: T.ops - 20 }); }
  else typed(c, 'kotlin · compose · django · svelte · firebase', f, T.stackCopy, sx2, sy2, ss, { rate: 1.2, align: 'center', caretUntil: T.ops - 20 });
  c.restore();
}

// ---- act 4: operations
function consica(c, x, y, s, col = C.ink) {   // the Consica Labs mark, redrawn as vectors from the 36px logo
  c.save(); c.translate(x, y); c.scale(s / 36, s / 36); c.fillStyle = col;
  c.beginPath(); c.arc(17, 19, 15, Math.PI * 0.32, Math.PI * 1.62, false); c.arc(17, 19, 9.5, Math.PI * 1.62, Math.PI * 0.32, true); c.closePath(); c.fill();
  c.beginPath(); c.arc(17, 19, 5, Math.PI * 0.5, Math.PI * 1.5); c.closePath(); c.fill(); c.fillRect(20, 2, 5, 22); c.fillRect(20, 19, 14, 5); c.fillRect(17, 29, 17, 6); c.restore();
}
function actOps(c, f) {
  if (f < T.ops - 2 || f >= T.write + 40) return;
  header(c, 'OPERATIONS', f, T.ops + 4, T.write - 14);
  const u = E.out(prog(f, ...T.opsIn)), ex = E.inOut(prog(f, T.write - 16, T.write + 24)), ks = PORT ? 1.22 : 1, cw = LY.card[0] / ks, ch = LY.card[1] / ks;
  c.save(); c.translate(0, ex * -60); c.globalAlpha = 1 - ex; c.translate(CX, H / 2 + 50 + (1 - u) * 80); c.scale(ks, ks); c.globalAlpha *= u;
  c.save(); c.shadowColor = 'rgba(24,24,27,0.10)'; c.shadowBlur = 50; c.shadowOffsetY = 20; card(c, -cw / 2, -ch / 2, cw, ch, 32, '#fff'); c.restore(); card(c, -cw / 2, -ch / 2, cw, ch, 32, null, C.line);
  const x0 = -cw / 2 + 60, y0 = -ch / 2 + 50; consica(c, x0, y0, 84); font(c, 'serif', PORT ? 58 : 64); c.fillStyle = C.ink; c.fillText('Head of Operations', x0 + 110, y0 + 54); font(c, 'mono', 26); c.fillStyle = C.ink2; c.fillText('Consica Labs', x0 + 114, y0 + 96);
  const items = ['plan the quarter', 'ship the release', 'grow the team', 'keep it running'], ly0 = y0 + 190;
  items.forEach((t, i) => {
    const y = ly0 + i * 76, k = E.out(prog(f, T.ticks[i], T.ticks[i] + 12)); font(c, 'mono', 30); c.fillStyle = k > 0.5 ? C.ink2 : C.ink; c.fillText(t, x0 + 70, y + 10);
    c.strokeStyle = k > 0 ? C.ink : '#c8c6c0'; c.lineWidth = 3; card(c, x0, y - 22, 40, 40, 10); c.stroke();
    if (k > 0) { c.save(); c.globalAlpha *= k; card(c, x0, y - 22, 40, 40, 10, C.ink); c.restore();
      c.strokeStyle = '#fff'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); const pp = [[x0 + 9, y - 2], [x0 + 17, y + 8], [x0 + 32, y - 10]]; c.moveTo(...pp[0]);
      const q = clamp(k * 2); if (q < 0.5) c.lineTo(mix(pp[0][0], pp[1][0], q * 2), mix(pp[0][1], pp[1][1], q * 2)); else { c.lineTo(...pp[1]); c.lineTo(mix(pp[1][0], pp[2][0], q * 2 - 1), mix(pp[1][1], pp[2][1], q * 2 - 1)); } c.stroke();
      c.strokeStyle = C.ink2; c.lineWidth = 2; font(c, 'mono', 30); const tw = c.measureText(t).width; c.beginPath(); c.moveTo(x0 + 70, y); c.lineTo(x0 + 70 + tw * E.out(clamp(k * 1.4 - 0.3)), y); c.stroke(); }
  });
  const b = E.out(prog(f, ...T.bar)), bx = PORT ? x0 : cw / 2 - 390, by = PORT ? ly0 + 360 : -ch / 2 + 300, bw = PORT ? cw - 120 : 330;
  card(c, bx, by, bw, 16, 8, '#efede8'); card(c, bx, by, Math.max(16, bw * b), 16, 8, C.ink);
  font(c, 'mono', PORT ? 96 : 84, 700); c.textAlign = 'right'; c.fillStyle = C.ink; c.fillText(Math.round(b * 100) + '%', bx + bw, by - 40); font(c, 'mono', 22); c.fillStyle = C.mute; c.fillText('this quarter', bx + bw, by + 60); c.textAlign = 'left';
  c.restore();
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
  if (f < T.write || f >= T.pond + 40) return;
  const wa = E.smooth(prog(f, ...T.warm)); c.fillStyle = C.warm; c.globalAlpha = wa; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
  petals(c, f, T.write); header(c, 'ESSAYS & WRITING', f, T.write + 10, T.pond - 10);
  const up = E.inOut(prog(f, T.scroll[0] - 14, T.scroll[0] + 10)), my = H / 2;
  c.save(); c.translate(0, -up * H * 0.65);
  typed(c, 'Be yourself.', f, T.be, CX, my - 20, LY.be, { kind: 'serif', rate: 3, align: 'center', caretUntil: T.strike[0] });
  const s = E.out(prog(f, ...T.strike)); if (s > 0) { font(c, 'serif', LY.be); const w = c.measureText('Be yourself.').width; c.strokeStyle = C.ink; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(CX - w / 2 - 20, my - 20 - LY.be * 0.3); c.lineTo(CX - w / 2 - 20 + (w + 40) * s, my - 20 - LY.be * 0.3 - 10 * s); c.stroke(); }
  if (LY.whichSplit) { LIB.wordsIn(c, 'Which self are you', f, T.which, 5, CX, my + 120, LY.which, 'serifI', C.pink); LIB.wordsIn(c, 'talking about?', f, T.which + 20, 5, CX, my + 120 + LY.which * 1.25, LY.which, 'serifI', C.pink); }
  else LIB.wordsIn(c, 'Which self are you talking about?', f, T.which, 5, CX, my + 120, LY.which, 'serifI', C.pink);
  c.restore();
  if (f >= T.scroll[0] - 14) {
    const p = E.out(prog(f, ...T.scroll)), lh = LY.titles * 1.65, land = LAND + TITLES.length * 2, pos = mix(land - 16, land, p), fade = E.inOut(prog(f, T.scroll[0] - 14, T.scroll[0] + 6)), ex = E.exit(prog(f, T.pond - 14, T.pond));
    const nY = mix(my, PORT ? my - 420 : 300, E.inOut(prog(f, T.neither[0] - 10, T.neither[0] + 14)));
    for (let k = Math.floor(pos) - 8; k <= Math.floor(pos) + 8; k++) {
      const t = TITLES[((k % TITLES.length) + TITLES.length) % TITLES.length], y = nY + (k - pos) * lh, d = Math.abs(k - pos), on = k === land && p > 0.98;
      const fa = clamp(1 - d / (PORT ? 6 : 4)) * fade * (1 - ex) * (k === land ? 1 : 1 - E.smooth(prog(f, T.scroll[1] - 6, T.neither[0] - 4)));
      if (fa <= 0) continue; font(c, 'serif', k === land ? LY.titles * 1.33 : LY.titles); c.textAlign = 'center'; c.fillStyle = on || d < 0.5 ? C.ink : C.ink2; c.globalAlpha = fa; c.fillText(t, CX, y + 30);
    }
    c.globalAlpha = 1; c.textAlign = 'left';
    // "Where is God?" speaks: each couplet arrives word by word out of a soft blur, holds, and clears before the next
    const L = [['God is neither in,', 'nor out.'], ['God is neither above,', 'nor below.'], ['God is neither time,', 'nor the timeless.']];
    L.forEach(([a, b], i) => { const f0 = T.neither[i], f1 = (i < 2 ? T.neither[i + 1] : T.pond) - 16;
      if (f < f0 || f > f1 + 18) return;
      if (LY.neitherSplit) { LIB.wordsIn(c, a, f, f0, 5, CX, my - 10, 80, 'serif', C.ink, 'center', f1); LIB.wordsIn(c, b, f, f0 + 16, 5, CX, my + 100, 80, 'serifI', C.pink, 'center', f1); }
      else { LIB.wordsIn(c, a, f, f0, 5, CX - 40, my + 60, 84, 'serif', C.ink, 'right', f1); LIB.wordsIn(c, b, f, f0 + 16, 5, CX - 10, my + 60, 84, 'serifI', C.pink, 'left', f1); }
      const u = E.inOut(prog(f, f0 + 20, f0 + 44)) * (1 - E.exit(prog(f, f1, f1 + 14))); if (u > 0) { c.save(); c.strokeStyle = C.pink; c.globalAlpha = 0.6 * u; c.lineWidth = 2; const ly = PORT ? my + 140 : my + 100, hw = (PORT ? 220 : 300) * u; c.beginPath(); c.moveTo(CX - hw, ly); c.lineTo(CX + hw, ly); c.stroke(); c.restore(); } });
  }
}

// ---- act 6: the koi pond (homepage footer), revealed through a widening circle
function actPond(c, f) {
  if (f < T.iris[0] || f >= T.mont) return;
  const u = E.inOut(prog(f, ...T.iris)), r = mix(0, Math.hypot(W, H) / 2 + 20, u), z = mix(1.25, 1.06, E.smooth(prog(f, T.pond, T.mont)));
  c.save(); c.beginPath(); c.arc(CX, H / 2, r, 0, 7); c.clip();
  const k = Math.floor((f - T.pond) / 2) % A.pond.length; LIB.cover(c, A.pond[k], 0, 0, W, H, z, 0.5, 0.45);
  // a pinch of food: rings spreading where it lands
  for (let i = 0; i < 3; i++) { const v = prog(f, T.feed + i * 6, T.feed + i * 6 + 40); if (v <= 0 || v >= 1) continue; c.strokeStyle = 'rgba(255,255,255,0.7)'; c.globalAlpha = 1 - v; c.lineWidth = 3; c.beginPath(); c.ellipse(CX + (PORT ? -40 : 120), H / 2 + (PORT ? 120 : 10), 10 + v * 90, (10 + v * 90) * 0.6, 0, 0, 7); c.stroke(); c.globalAlpha = 1; }
  c.restore();
  if (u < 1) { c.strokeStyle = C.ink; c.lineWidth = 3; c.beginPath(); c.arc(CX, H / 2, r, 0, 7); c.stroke(); }
  header(c, 'POND', f, T.pond + 8, T.mont - 10, '#fff');
  const hu = E.out(prog(f, T.pond + 30, T.pond + 50)); c.save(); c.globalAlpha = hu * (1 - E.exit(prog(f, T.mont - 14, T.mont)));
  font(c, 'mono', PORT ? 26 : 24); const t = 'click to feed · drag to ripple', tw = c.measureText(t).width; card(c, CX - tw / 2 - 24, H - (PORT ? 200 : 110), tw + 48, 52, 26, 'rgba(10,20,14,0.55)');
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(t, CX, H - (PORT ? 200 : 110) + 34); c.restore();
}

// ---- act 8: the lockup — the homepage header, rebuilt, with the real pup
function actLock(c, f) {
  if (f < T.lock) return; const L = LY.lock, u = E.out(prog(f, ...T.lockIn));
  c.save(); c.globalAlpha = u; c.translate(0, (1 - u) * 40);
  const [ax, ay, ad] = L.av; portrait(c, A.me, f, ax, ay, ad * 1000 / 700, 1, [ad, ad], 440);
  c.strokeStyle = C.line; c.lineWidth = 3; c.beginPath(); c.arc(ax, ay, ad / 2 + 6, 0, 7); c.stroke(); c.restore();
  const [nx, ny, ns] = L.name, nu = E.out(prog(f, T.lname, T.lname + 24)); font(c, 'serif', ns); c.textAlign = L.align; c.fillStyle = C.ink; c.globalAlpha = nu; c.fillText('Nikit Hamal', nx, ny + (1 - nu) * 30); const nw = c.measureText('Nikit Hamal').width; c.globalAlpha = 1; c.textAlign = 'left';
  // the pup: asleep beside the name (as on the homepage), wakes, sits up and wags at the end
  const du = E.out(prog(f, T.lname + 18, T.lname + 40));
  if (du > 0) { const sc = PORT ? 6 : 5.2, [gx, gy] = L.dog || [nx + nw + 40 + 30 * sc, ny + 6], t = (f - T.lock) / 60, awake = f >= T.wake;
    c.save(); c.globalAlpha = du; const startled = f < T.wake + 16; A.dog.draw(c, gx, gy, sc, !awake ? 'sleep' : startled ? 'stand' : 'sit', t, !awake ? {} : startled ? { eye: 'wide' } : { wag: 0.35, mouth: f > T.wake + 30 ? 'pant' : undefined });
    if (!awake) A.dog.zzz(c, gx, gy, sc, t); c.restore(); }
  const [lx, ly, ls, lg] = L.lines, al = L.align;
  typed(c, 'Head of Operations at Consica Labs.', f, T.ltype, lx, ly, ls, { col: C.ink2, rate: 1.1, caretUntil: T.ltype + 44, align: al });
  typed(c, 'Android & full-stack engineer from Nepal.', f, T.ltype + 40, lx, ly + lg, ls, { col: C.ink2, rate: 1.1, caretUntil: T.ltype + 90, align: al });
  typed(c, 'Writing about the self.', f, T.ltype + 86, lx, ly + lg * 2, ls, { col: C.ink2, rate: 1.1, caretUntil: T.lurl, align: al });
  if (f >= T.lurl) { const uu = E.out(prog(f, T.lurl, T.lurl + 24)), [ux, uy] = L.url; font(c, 'mono', 44, 700); c.fillStyle = C.ink; c.globalAlpha = uu; const uw = c.measureText('nikit.is-a.dev').width, x0 = al === 'center' ? ux - uw / 2 : ux; c.fillText('nikit.is-a.dev', x0, uy);
    c.strokeStyle = C.pink; c.lineWidth = 3; c.beginPath(); for (let xx = 0; xx <= uw * E.out(prog(f, T.lurl + 6, T.lurl + 40)); xx += 4) { const yy = uy + 24 + Math.sin(xx / 8) * 4; xx ? c.lineTo(x0 + xx, yy) : c.moveTo(x0, yy); } c.stroke(); c.globalAlpha = 1; }
}

// ---- compose
function backdrop(c, f) {
  c.fillStyle = C.bg; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) { const x = hash(i * 7.7) * W, y = (hash(i * 3.3) * H + f * 0.15 * (0.5 + hash(i))) % H, s = 8 + hash(i + 2) * 8, a = 0.18 + 0.12 * Math.sin(f * 0.05 + i);
    c.save(); c.translate(x, y); c.rotate(f * 0.004 * (i % 2 ? 1 : -1)); c.fillStyle = C.mute; c.globalAlpha = a; c.beginPath(); c.moveTo(0, -s); c.quadraticCurveTo(0, 0, s, 0); c.quadraticCurveTo(0, 0, 0, s); c.quadraticCurveTo(0, 0, -s, 0); c.quadraticCurveTo(0, 0, 0, -s); c.fill(); c.restore(); }
}
function scene(c, f) { backdrop(c, f); if (f < T.build + 40) actHello(c, f); actBuild(c, f); actStack(c, f); actOps(c, f); actWrite(c, f); actPond(c, f); }
function draw(c, f) {
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none'; c.imageSmoothingEnabled = true;
  if (f >= T.mont && f < T.lock) {   // montage on 8ths: earlier moments, pushed in; the last cut is the eyes, close, winking now
    const k = Math.min(T.montN - 1, Math.floor((f - T.mont) / T.montLen)), lf = f - T.mont - k * T.montLen, M = LY.mont[k];
    if (!M) { backdrop(c, f); portrait(c, A.me, f, CX, H / 2, PORT ? 2900 : 2500, 0, [W, H], 400 - lf * 0.8); }
    else { const [src, z, fx, fy] = M; c.save(); const zz = z * (1 + lf * 0.004); c.translate(CX, H / 2); c.rotate((k % 2 ? 1 : -1) * 0.012); c.scale(zz, zz); c.translate(-fx, -fy); scene(c, src + lf * 0.6); c.restore(); }
    c.fillStyle = C.ink; c.globalAlpha = lf < 2 ? 0.12 : 0; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
    font(c, 'mono', 22, 700); c.fillStyle = C.ink; const by = PORT ? H - 150 : H - 96; c.fillRect(64, by, 150, 44); c.fillStyle = C.bg; c.fillText(`0${k + 1} / 08`, 82, by + 30);
    return;
  }
  if (f >= T.lock) { backdrop(c, f); actLock(c, f); return; }
  scene(c, f);
}
const cv = document.getElementById('c'); cv.width = W; cv.height = H;
const FAST = [[T.pop[0], T.pop[0] + 14], [T.expand[0], T.expand[1]], [T.out1[0], T.phoneIn[1]], [T.nebDetail[0], T.nebDetail[1]], [T.swipe[0], T.swipe[1]], [T.matches[0], T.matches[1]], [T.morph[0], T.morph[1]], [T.chartPg[0], T.chartPg[1]],
  [T.burst[0], T.iconsAt + 66], [T.ops - 18, T.opsIn[1]], [T.write - 16, T.write + 24], [T.scroll[0] - 14, T.scroll[0] + 40], [T.neither[0] - 10, T.neither[0] + 14], [T.iris[0], T.iris[1]]];
const frame = LIB.blurFrame(cv, draw, FAST, 10);
window.film = { load, frame, TOTAL, T, W, H };
