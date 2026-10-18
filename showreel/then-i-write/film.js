// "then, I write." — a 32 s artistic / philosophical reel for Nikit Hamal. 60 fps, 80 BPM (beat = 45 f, bar = 180 f).
// Landscape 1920x1080 by default; ?v=portrait renders the hand-laid-out 1080x1920 cut.
// Made only from the portfolio's own art: the painted portraits with live eyes, the essays' line-art motion forms
// (js/motion-forms*.js), the writing pages' <pixel-scene> vignettes, the homepage koi pond, the <pixel-dog>, and his words.
// Device: the enso — one brush circle that opens the film, frames every world, and closes it. Engine: ../shared/lib.js.
'use strict';
const { E, clamp, prog, mix, hash, img, font, typed, rise, wordsIn, portrait, form, cover, scene } = LIB;
const PORT = new URLSearchParams(location.search).get('v') === 'portrait';
const W = PORT ? 1080 : 1920, H = PORT ? 1920 : 1080, CX = W / 2, CY = H / 2, TOTAL = 1920;
const C = { paper: '#f4ede2', paper2: '#efe6d8', ink: '#1d1a17', ink2: '#5b544c', mute: '#8a8178', pink: '#d9779a', rose: '#c9607f' };
// ---- timeline (frames). score.py mirrors these numbers.
const T = {
  guides: [0, 40], enso: [16, 104], bloom: [96, 150], wake: 168, hi: 60, name: 120, write: 236, blink1: 214,
  be: 372, strike: [430, 448], which: 456, eye: [450, 540], many: 540, trio: [536, 600], met: 600, how: 640, trioOut: [684, 708],
  worlds: 720, isle: 90, move: 26,
  ring: [1260, 1300], pond: 1280, drops: 1316, night: [1400, 1440], star: 1446, irisOut: [1546, 1590],
  close: 1560, ensoB: [1590, 1660], lname: 1640, lsub: 1676, lurl: 1712, wink: 1846, end: 1920,
};
const ISLES = [   // vignette, motion form (vol2 name), quote lines, essay
  ['sakura', 'lotus-eight', ['Take me as I am,', 'whatever I may be.'], 'TAKE ME AS I AM'],
  ['rabbit', 'moon-phases', ['What was before', 'your physical birth?'], 'EVERYTHING IS THOUGHT'],
  ['lantern', 'witness-eye', ['Unless you open your eyes,', 'no one can show you.'], 'WISDOM CANNOT BE TAUGHT'],
  ['torii', 'one-step', ['There is only', 'one single step.'], 'THERE IS ONLY ONE STEP'],
  ['heron', 'river-flow', ['Let life take care', 'of its guests.'], 'WISDOM CANNOT BE TAUGHT'],
  ['fuji', 'mountain-silence', ['Just wake up,', 'and all is finished.'], 'THERE IS ONLY ONE STEP'],
];
const LY = PORT ? {
  enso: [540, 800, 980], hiY: 1440, nameY: 1330, writeY: 1450, txt: 76, small: 30,
  be: [540, 820, 150], which: [540, 1080, 58, true], eye: [540, 860, 900],
  trio: [[540, 520, 330], [540, 900, 330], [540, 1280, 330]], trioCap: [540, 1580], isleGap: 1500, isle: [540, 720, 9], formS: 860, quote: [540, 1260, 56], capY: 1440,
  pondTxt: [540, 1500, 64], lock: { enso: [540, 740, 900], name: [540, 1330, 132], sub: [540, 1428, 48], url: [540, 1540], dog: [540, 1760, 6.4] },
} : {
  enso: [960, 455, 800], hiY: 960, nameY: 930, writeY: 1010, txt: 80, small: 26,
  be: [960, 450, 170], which: [960, 640, 64, false], eye: [960, 520, 760],
  trio: [[560, 470, 330], [960, 470, 330], [1360, 470, 330]], trioCap: [960, 820], isleGap: 1150, isle: [960, 420, 7], formS: 640, quote: [960, 860, 56], capY: 990,
  pondTxt: [960, 900, 72], lock: { enso: [600, 540, 760], name: [1010, 520, 150], sub: [1016, 614, 48], url: [1018, 724], dog: [1330, 850, 5.2] },
};
const A = {};
async function load() {
  await LIB.fonts();
  // eyes: closed until the enso is drawn, then they open; they follow the words, look at each other in the trio, and wink at the end
  const nowTrack = LIB.eyeTrack({ keys: [[0, 0, 0.1], [170, 0, 0], [230, PORT ? 0 : 0.2, PORT ? 0.7 : 0.6], [300, 0, 0.1], [1600, 0, 0], [1700, PORT ? 0 : 0.6, PORT ? 0.6 : 0.15], [1780, 0, 0], [1880, 0.1, 0.05]],
    blinks: [T.blink1, 660, 1700, 1800], winks: [[T.wink, 'l']] });
  const asleep = f => f < T.wake ? 0 : clamp((f - T.wake) / 18);
  const nowT = f => { const s = nowTrack(f); const o = asleep(f); if (f < T.wake + 18) { s.L = Math.min(s.L, o); s.R = Math.min(s.R, o); } return s; };
  A.now = await LIB.loadPortrait('../shared/art', 'now', nowT);
  const look = (k1, k2) => LIB.eyeTrack({ keys: [[560, 0, 0], [610, k1, 0.1], [650, k2, 0.05], [690, 0, 0]], blinks: [628 + k1 * 9, 676] });
  A.young = await LIB.loadPortrait('../shared/art', 'young', PORT ? LIB.eyeTrack({ keys: [[560, 0, 0], [610, 0, 0.9], [650, 0.5, 0.6], [690, 0, 0]], blinks: [630, 676] }) : look(1, 0.9));
  A.curls = await LIB.loadPortrait('../shared/art', 'curls', PORT ? LIB.eyeTrack({ keys: [[560, 0, 0], [610, 0, -0.9], [650, 0, 0.8], [690, 0, 0]], blinks: [622, 680] }) : look(-1, 0.9));
  A.trioNow = { ...A.now, track: PORT ? LIB.eyeTrack({ keys: [[560, 0, 0], [610, 0, -0.9], [650, -0.4, -0.7], [690, 0, 0]], blinks: [640] }) : look(-1, -0.9) };
  A.forms = LIB.loadForms(); const base = A.forms.length - window.MOTION_FORMS_VOL2_NAMES.length; A.formByName = n => A.forms[base + window.MOTION_FORMS_VOL2_NAMES.indexOf(n)];
  A.scenes = await LIB.loadScenes('../shared/scenes', ['sakura', 'rabbit', 'lantern', 'torii', 'heron', 'fuji', 'koi']);
  A.petals = await Promise.all([0, 1, 2, 3, 4, 5].map(i => img(`../portfolio-reel/assets/sakura-${i}.svg`)));
  const o = PORT ? 'port' : 'land'; A.golden = await LIB.loadClip(`../shared/pond/${o}_golden.webm`, 150); A.night = await LIB.loadClip(`../shared/pond/${o}_night.webm`, 150);
  A.dog = LIB.dogKit('rottie');
  // paper grain, made once
  A.grain = document.createElement('canvas'); A.grain.width = 512; A.grain.height = 512; const g = A.grain.getContext('2d'), id = g.createImageData(512, 512);
  for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 70; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } g.putImageData(id, 0, 0);
}

// ---- paper, grain, vignette
function paper(c, f) {
  c.fillStyle = C.paper; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(CX, CY * 0.9, Math.min(W, H) * 0.2, CX, CY, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(255,252,246,0.55)'); g.addColorStop(1, 'rgba(150,120,90,0.16)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
}
function grain(c, f) { c.save(); c.globalAlpha = 0.07; c.globalCompositeOperation = 'overlay'; const ox = (hash(Math.floor(f / 2)) * 512) | 0, oy = (hash(Math.floor(f / 2) + 7) * 512) | 0;
  for (let y = -oy; y < H; y += 512) for (let x = -ox; x < W; x += 512) c.drawImage(A.grain, x, y); c.restore(); }
function petals(c, f, n = 14, a = 0.55, sc = 1) {
  for (let i = 0; i < n; i++) {
    const t = f / 60 + hash(i) * 9, x = ((hash(i + 1) * W + t * (28 + hash(i + 2) * 40)) % (W + 200)) - 100, y = ((hash(i + 3) * H + t * (36 + hash(i + 5) * 40)) % (H + 200)) - 100;
    const s = (26 + hash(i + 6) * 30) * sc; c.save(); c.translate(x + Math.sin(t * 1.1 + i) * 34, y); c.rotate(Math.sin(t * 0.8 + i) * 0.8); c.globalAlpha = a * (0.6 + 0.4 * hash(i + 9));
    c.imageSmoothingEnabled = false; c.drawImage(A.petals[i % 6], 24, 4, 12, 10, -s / 2, -s / 2, s, s * 0.84); c.restore();
  }
}
// the enso: the "enso" motion form, guides drawn faint first, then the brush circle in ink
function enso(c, f, cx, cy, size, p, weight = 7, col = C.ink, only) { form(c, A.formByName('enso'), cx, cy, size, p, col, 0, weight, only); }

// ---- act 1: hi
function act1(c, f) {
  if (f >= T.be + 20) return; const [ex, ey, es] = LY.enso, out = E.inOut(prog(f, T.be - 30, T.be + 10));
  c.save(); c.globalAlpha = 1 - out; c.translate(CX, CY); c.scale(1 + out * 0.25, 1 + out * 0.25); c.translate(-CX, -CY);
  const b = E.out(prog(f, ...T.bloom)), r = es * 0.355 * b, pe = prog(f, T.guides[0], T.enso[1]);
  c.save(); c.globalAlpha *= 1 - b * 0.6; enso(c, f, ex, ey, es, pe, 7, C.ink, 'guide'); c.restore();
  if (b > 0) { c.save(); c.beginPath(); c.arc(ex, ey, r, 0, 7); c.clip(); portrait(c, A.now, f, ex, ey, es * 0.355 * 2 * 1000 / 640, 1, [es, es], 450); c.restore(); }
  enso(c, f, ex, ey, es, pe, 7, C.ink, 'main');
  const ty = PORT ? LY.hiY : LY.hiY;
  if (f < T.write) { wordsIn(c, "hi, I'm Nikit.", f, T.hi, 7, CX, ty, LY.txt, 'serif', C.ink, 'center', T.write - 16); }
  wordsIn(c, 'then, I write.', f, T.write, 9, CX, ty, LY.txt, 'serifI', C.ink, 'center');
  c.restore();
}
// ---- act 2: which self?
function act2(c, f) {
  if (f < T.be - 4 || f >= T.worlds + 30) return;
  const [bx, by, bs] = LY.be, up = E.inOut(prog(f, T.many - 30, T.many));
  c.save(); c.globalAlpha = 1 - up; c.translate(0, -up * 120);
  const [fx, fy, fs] = LY.eye; c.save(); c.globalAlpha *= 0.55; form(c, A.formByName('witness-eye'), fx, fy, fs, prog(f, ...T.eye), C.ink, 0, 1.2); c.restore();
  typed(c, 'Be yourself.', f, T.be, bx, by, bs, { kind: 'serif', rate: 3, align: 'center', caretUntil: T.strike[0], col: C.ink, caretCol: C.ink });
  const s = E.out(prog(f, ...T.strike)); if (s > 0) { font(c, 'serif', bs); const w = c.measureText('Be yourself.').width; c.strokeStyle = C.rose; c.lineWidth = bs * 0.06; c.lineCap = 'round';
    c.beginPath(); const x0 = bx - w / 2 - 20, y0 = by - bs * 0.3; c.moveTo(x0, y0 + 6); for (let i = 1; i <= 24; i++) { const t = i / 24 * s; c.lineTo(x0 + (w + 40) * t, y0 + 6 - 14 * t + Math.sin(t * 9) * 2); } c.stroke(); }
  const [wx, wy, ws, split] = LY.which;
  if (split) { wordsIn(c, 'Which self are you', f, T.which, 6, wx, wy, ws, 'serifI', C.ink2); wordsIn(c, 'talking about?', f, T.which + 24, 6, wx, wy + ws * 1.3, ws, 'serifI', C.ink2); }
  else wordsIn(c, 'Which self are you talking about?', f, T.which, 6, wx, wy, ws, 'serifI', C.ink2);
  c.restore();
  // how many Nikits: three paintings, three ages, looking at each other
  if (f >= T.trio[0]) {
    const ex = E.inOut(prog(f, ...T.trioOut));
    [[A.young, 0], [A.curls, 1], [A.trioNow, 2]].forEach(([P, i]) => {
      const [x, y, d] = LY.trio[i], u = E.out(prog(f, T.trio[0] + i * 10, T.trio[0] + 30 + i * 10)); if (u <= 0) return;
      const D = d * mix(0.6, 1, u) * (1 - ex * 0.4); c.save(); c.globalAlpha = u * (1 - ex); c.translate(0, (1 - u) * 40 - ex * 60);
      portrait(c, P, f, x, y, D * 1000 / 700, 1, [D, D], 440); c.strokeStyle = C.ink; c.globalAlpha *= 0.25; c.lineWidth = 2; c.beginPath(); c.arc(x, y, D / 2 + 8, 0, 7); c.stroke(); c.restore();
    });
    const [tx, ty] = LY.trioCap; c.save(); c.globalAlpha = 1 - ex;
    rise(c, 'We never met.', f, T.met, T.how - 6, tx, ty, LY.txt * 0.8, 'serif', C.ink);
    if (PORT) { wordsIn(c, 'Do you see, how many', f, T.how, 5, tx, ty - 30, LY.txt * 0.7, 'serifI', C.ink); wordsIn(c, 'Nikits are there?', f, T.how + 20, 5, tx, ty + LY.txt * 0.85 - 30, LY.txt * 0.7, 'serifI', C.rose); }
    else { wordsIn(c, 'Do you see, how many', f, T.how, 5, tx - 30, ty, LY.txt * 0.7, 'serifI', C.ink, 'right'); wordsIn(c, 'Nikits are there?', f, T.how + 20, 5, tx - 6, ty, LY.txt * 0.7, 'serifI', C.rose, 'left'); }
    c.restore();
  }
}
// ---- act 3: worlds — floating vignettes, each with its essay's line form and a line from it
function camAt(f) {   // which island and the eased camera position (in island units)
  const k = (f - T.worlds) / T.isle, i = Math.max(0, Math.floor(k)), lf = (f - T.worlds) - i * T.isle;
  return i + E.inOut(clamp(lf / T.move)) - 1 + (i === 0 ? 1 - E.inOut(clamp(lf / T.move)) : 0) + clamp((lf - T.move) / (T.isle - T.move)) * 0.04;
}
function act3(c, f) {
  if (f < T.worlds - 30 || f >= T.ring[1] + 10) return;
  const enter = E.out(prog(f, T.worlds - 8, T.worlds + 26)), cam = Math.max(0, camAt(f)), gap = LY.isleGap, [ix, iy, isc] = LY.isle;
  c.save(); c.globalAlpha = enter;
  ISLES.forEach(([sc, fm, q, cap], i) => {
    const d = i - cam; if (Math.abs(d) > 1.3) return; const off = d * gap, bob = Math.sin((f + i * 40) / 50) * 8, arrive = T.worlds + i * T.isle;
    const x = PORT ? ix : ix + off, y = PORT ? iy + off : iy, near = clamp(1 - Math.abs(d) * 1.4);
    c.save(); c.globalAlpha *= 0.5 * near; form(c, A.formByName(fm), x, y + 10, LY.formS, E.smooth(prog(f, arrive - 10, arrive + 60)), C.ink, (f - arrive) * 0.002, 1.1); c.restore();
    c.save(); c.globalAlpha *= clamp(1 - Math.abs(d) * 0.9); scene(c, A.scenes[sc], f + i * 13, x, y + bob, 64 * isc); c.restore();
    const tn = clamp(1 - Math.abs(d) * 3.2);
    if (tn > 0.02) { const [qx, qy, qs] = LY.quote, qxx = PORT ? qx : qx + off, qyy = PORT ? qy + off : qy;
      c.save(); c.globalAlpha *= tn; wordsIn(c, q[0], f, arrive + 4, 4, qxx, qyy, qs, 'serif', C.ink); wordsIn(c, q[1], f, arrive + 16, 4, qxx, qyy + qs * 1.25, qs, 'serifI', C.ink2);
      c.globalAlpha *= E.out(prog(f, arrive + 30, arrive + 50)); font(c, 'mono', LY.small - 6, 500); c.letterSpacing = '4px'; c.fillStyle = C.mute; c.textAlign = 'center'; c.fillText('— ' + cap, qxx, PORT ? LY.capY + off : LY.capY); c.letterSpacing = '0px'; c.restore(); }
  });
  c.restore();
}
// ---- act 4: the pond — opened by an enso ring; golden hour, then night
function act4(c, f) {
  if (f < T.ring[0] || f >= T.irisOut[1] + 2) return;
  const r0 = Math.min(W, H) * 0.26, open = E.inOut(prog(f, T.ring[1] - 6, T.pond + 46)), shut = E.inOut(prog(f, ...T.irisOut));
  const R = mix(r0, Math.hypot(W, H) / 2 + 30, open), [ex, ey, es] = LY.lock.enso, Rf = mix(R, es * 0.355, shut), cx = mix(CX, ex, shut), cy = mix(CY, ey, shut);
  if (f < T.pond + 46) { c.save(); c.globalAlpha *= 1 - open; enso(c, f, CX, CY, r0 * 2 / 0.72, prog(f, T.ring[0], T.ring[1]), 7); c.restore(); }
  if (f < T.ring[1] - 8) return;
  c.save(); c.beginPath(); c.arc(cx, cy, Rf, 0, 7); c.clip();
  const z = mix(1.3, 1.08, E.smooth(prog(f, T.pond, T.irisOut[0]))), k = Math.floor((f - T.pond) / 2), nt = E.smooth(prog(f, ...T.night));
  cover(c, A.golden[((k % 150) + 150) % 150], 0, 0, W, H, z, 0.5, 0.45);
  if (nt > 0) { c.globalAlpha = nt; cover(c, A.night[((k % 150) + 150) % 150], 0, 0, W, H, z, 0.5, 0.45); c.globalAlpha = 1; }
  if (shut > 0) { c.globalAlpha = shut; c.fillStyle = C.paper; c.fillRect(0, 0, W, H); c.restore(); c.save(); c.globalAlpha = shut; const rr = es * 0.355; c.beginPath(); c.arc(ex, ey, rr, 0, 7); c.clip(); portrait(c, A.now, f, ex, ey, rr * 2 * 1000 / 640, 1, [es, es], 450); c.globalAlpha = 1; }
  c.restore();
  // his words over the water
  const [px, py, ps] = LY.pondTxt; c.save(); c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 24; c.globalAlpha = 1 - shut;
  if (f < T.night[0] + 10) { wordsIn(c, 'countless drops,', f, T.drops, 6, px, py - ps * 0.6, ps, 'serif', '#fff', 'center', T.night[0] - 10); wordsIn(c, 'for the boundless sea,', f, T.drops + 24, 6, px, py + ps * 0.65, ps, 'serifI', '#fff', 'center', T.night[0] - 10); }
  else { wordsIn(c, 'a guiding star,', f, T.star, 6, px, py - ps * 0.6, ps, 'serif', '#fff', 'center', T.irisOut[0] - 14); wordsIn(c, 'for the lost to see.', f, T.star + 24, 6, px, py + ps * 0.65, ps, 'serifI', '#ffd7e4', 'center', T.irisOut[0] - 14); }
  c.shadowBlur = 0; c.globalAlpha = (1 - shut) * E.out(prog(f, T.drops + 40, T.drops + 60)); font(c, 'mono', LY.small - 6, 500); c.letterSpacing = '4px'; c.fillStyle = 'rgba(255,255,255,0.85)'; c.textAlign = 'center';
  c.fillText('— YOU', px, py + ps * 1.9); c.restore();
}
// ---- act 5: close — the enso again, the name, the pup asleep
function act5(c, f) {
  if (f < T.close + 20) return; const L = LY.lock, [ex, ey, es] = L.enso, a = E.out(prog(f, T.irisOut[1] - 4, T.irisOut[1] + 10));
  const pe = prog(f, ...T.ensoB); c.save(); c.globalAlpha *= 0.4; enso(c, f, ex, ey, es, pe, 7, C.ink, 'guide'); c.restore();
  if (f >= T.irisOut[1]) { const r = es * 0.355; c.save(); c.beginPath(); c.arc(ex, ey, r, 0, 7); c.clip(); portrait(c, A.now, f, ex, ey, r * 2 * 1000 / 640, 1, [es, es], 450); c.restore(); }
  enso(c, f, ex, ey, es, pe, 7, C.ink, 'main');
  const [nx, ny, ns] = L.name, al = PORT ? 'center' : 'left';
  if (f >= T.lname) { const u = E.out(prog(f, T.lname, T.lname + 30)); c.save(); font(c, 'serif', ns); c.textAlign = al; c.fillStyle = C.ink; c.globalAlpha = u; c.filter = u < 1 ? `blur(${((1 - u) * 8).toFixed(1)}px)` : 'none'; c.fillText('Nikit Hamal', nx, ny + (1 - u) * 24); c.restore(); }
  const [sx, sy, ss] = L.sub; wordsIn(c, 'writing about the self.', f, T.lsub, 6, sx, sy, ss, 'serifI', C.ink2, al);
  if (f >= T.lurl) { const u = E.out(prog(f, T.lurl, T.lurl + 26)), [ux, uy] = L.url; c.save(); c.globalAlpha = u; font(c, 'mono', PORT ? 34 : 30, 500); c.letterSpacing = '2px'; c.fillStyle = C.ink; c.textAlign = al; c.fillText('nikit.is-a.dev/writing', ux, uy);
    const w = c.measureText('nikit.is-a.dev/writing').width, x0 = al === 'center' ? ux - w / 2 : ux; c.strokeStyle = C.pink; c.lineWidth = 2.5; c.beginPath(); for (let xx = 0; xx <= w * E.out(prog(f, T.lurl + 8, T.lurl + 50)); xx += 4) { const yy = uy + 18 + Math.sin(xx / 8) * 3.5; xx ? c.lineTo(x0 + xx, yy) : c.moveTo(x0, yy); } c.stroke(); c.restore(); }
  const [dx, dy, ds] = L.dog, du = E.out(prog(f, T.lsub, T.lsub + 40)); if (du > 0) { const t = (f - T.close) / 60; c.save(); c.globalAlpha = du; A.dog.draw(c, dx, dy, ds, 'sleep', t); A.dog.zzz(c, dx, dy, ds, t); c.restore(); }
}
function draw(c, f) {
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none'; c.imageSmoothingEnabled = true;
  paper(c, f);
  petals(c, f, PORT ? 10 : 14, f > T.ring[0] && f < T.irisOut[1] ? 0 : 0.5);
  act1(c, f); act2(c, f); act3(c, f); act4(c, f); act5(c, f);
  grain(c, f);
  const fade = Math.max(1 - prog(f, 0, 14), prog(f, TOTAL - 20, TOTAL - 1) * 0.0); if (fade > 0) { c.fillStyle = C.paper; c.globalAlpha = fade; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
}
const cv = document.getElementById('c'); cv.width = W; cv.height = H;
const FAST = [[T.be - 30, T.be + 10, 8], [T.many - 30, T.many, 8], ...ISLES.map((_, i) => [T.worlds + i * T.isle, T.worlds + i * T.isle + T.move, 12]), [T.ring[1] - 6, T.pond + 46, 10], [T.irisOut[0], T.irisOut[1], 10], [T.trioOut[0], T.trioOut[1], 8]];
const frame = LIB.blurFrame(cv, draw, FAST, 10);
window.film = { load, frame, TOTAL, T, W, H };
