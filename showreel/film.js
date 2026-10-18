// "Drawn in code" — a 15 s showreel for Nikit Hamal. 1920x1080 @ 60 fps, 120 BPM (beat = 30 f, bar = 120 f).
// Everything is a function of the frame number; frames are rendered in order (the pencil replay accumulates).
'use strict';
const W = 1920, H = 1080, FPS = 60, BEAT = 30, BAR = 120, TOTAL = 900;
const C = { paper: '#f3eee6', ink: '#211a16', accent: '#b4553c', mute: '#76685c', paper2: '#e9e1d3' };   // brand-supplied
const AGES = ['baby', 'kid', 'teen', 'young', 'curls', 'now'];
const SCENES = ['fireStage', 'rainStage', 'deskStage', 'fishStage', 'starStage', 'snowStage'];
// ---- timeline (frames) — shared with the score (timeline.json)
const T = {
  lineIn: [-14, 40], pencil: [22, 146], copy1: 48,
  wipe: [150, 198], push: [198, 270], copy2: 216,
  shrink: [270, 300], back: [300, 300], step0: 300, stepN: 15, copy3: 318,
  grow: [390, 420], pix: [426, 441, 455], cut: 465, zoom: [465, 510], copy4: 420,
  whip0: 510, whipLen: 20, whipMove: 14,
  pull: [630, 660], cells0: 638, copy5a: 654, copy5b: 696,
  wipeOut: [750, 780], under: [776, 800], name: [790, 818], url: 840,
};
// ---- easing (cubic-bezier) + helpers
function bez(x1, y1, x2, y2) { const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  return t => { if (t <= 0) return 0; if (t >= 1) return 1; let x = t; for (let i = 0; i < 8; i++) { const fx = ((ax * x + bx) * x + cx) * x - t, d = (3 * ax * x + 2 * bx) * x + cx; if (Math.abs(fx) < 1e-6 || !d) break; x -= fx / d; } return ((ay * x + by) * x + cy) * x; }; }
const E = { out: bez(.16, 1, .3, 1), outSoft: bez(.22, 1, .36, 1), inOut: bez(.87, 0, .13, 1), cam: bez(.48, .1, 0, .9), whip: bez(.6, 0, .15, 1), smooth: bez(.65, 0, .35, 1), exit: bez(.55, .055, .675, .19), rest: bez(.45, 0, .1, 1) };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const prog = (f, a, b) => clamp((f - a) / (b - a));
const mix = (a, b, t) => a + (b - a) * t, lmix = (a, b, t) => Math.exp(mix(Math.log(a), Math.log(b), t));

// ---- assets
const A = {};
const img = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
async function load() {
  await document.fonts.load('700 100px Jakarta'); await document.fonts.load('500 40px Jakarta');
  for (const a of AGES) A['paint_' + a] = await img(`assets/paint_${a}.png`);
  A.tone = await img('assets/now_tone.png'); A.smudge = await img('assets/now_smudge.png'); A.head = await img('assets/pixelhead.png');
  A.clips = {};
  for (const s of [...SCENES, 'treeStage', 'dogStage', 'mascot']) { const n = s === 'mascot' ? 48 : 72; A.clips[s] = []; for (let i = 0; i < n; i++) A.clips[s].push(await img(`clips/${s}/${String(i).padStart(3, '0')}.png`)); }
  // pencil strokes
  const buf = await (await fetch('assets/now.pcl')).arrayBuffer(), v = new DataView(buf); let o = 4;
  const pw = v.getUint16(o, true), ph = v.getUint16(o + 2, true), n = v.getUint32(o + 4, true); o += 8; const np = v.getUint8(o++), pass = {};
  for (let i = 0; i < np; i++) { pass[v.getUint8(o)] = [v.getFloat32(o + 1, true), v.getFloat32(o + 5, true)]; o += 9; }
  const off = new Uint32Array(n); for (let i = 0; i < n; i++) { off[i] = o; o += 6 + (v.getUint8(o + 1) - 1) * 2; }
  A.pcl = { v, n, pass, off, pw, ph };
  A.pen = document.createElement('canvas'); A.pen.width = 800; A.pen.height = 1000; A.penX = A.pen.getContext('2d'); A.penX.fillStyle = '#f6f3ec'; A.penX.fillRect(0, 0, 800, 1000); A.penDone = 0;
  A.pix = document.createElement('canvas'); A.pixX = A.pix.getContext('2d');
}
const clipAt = (s, f, fps = 30) => { const L = A.clips[s]; return L[Math.floor(Math.max(0, f) / (FPS / fps)) % L.length]; };

// ---- canvas
const cv = document.getElementById('c'), x = cv.getContext('2d');
const acc = document.createElement('canvas'); acc.width = W; acc.height = H; const ax = acc.getContext('2d');

function pencilTo(count) {   // replay pencil strokes (graphite) up to count, accumulating
  const P = A.pcl, v = P.v, c = A.penX; c.lineCap = c.lineJoin = 'round'; c.strokeStyle = 'rgb(46,46,52)';
  if (A.penDone === 0) { c.globalAlpha = 1; c.drawImage(A.smudge, 0, 0, 800, 1000); c.globalAlpha = 0; }
  while (A.penDone < count) { let o = P.off[A.penDone++]; const p = P.pass[v.getUint8(o)] || [1, 0.1], n = v.getUint8(o + 1); let px = v.getUint16(o + 2, true), py = v.getUint16(o + 4, true); o += 6;
    c.globalAlpha = p[1]; c.lineWidth = p[0] * 800 / P.pw; c.beginPath(); c.moveTo(px * 800 / P.pw, py * 1000 / P.ph);
    for (let j = 1; j < n; j++) { px += v.getInt8(o); py += v.getInt8(o + 1); o += 2; c.lineTo(px * 800 / P.pw, py * 1000 / P.ph); } c.stroke(); }
  c.globalAlpha = 1;
}
// one copy fragment: rises 0.32 em with a crisp ease, arrives in the accent, relaxes to ink; exits as a whole
function words(c, text, f, inF, outF, cx, cy, size = 96, col = C.ink) {
  if (f < inF || f > outF + 16) return;
  const u = E.out(prog(f, inF, inF + 26)), e = E.exit(prog(f, outF, outF + 16)), relax = prog(f, inF + 26, inF + 46);
  c.save(); c.font = `700 ${size}px Jakarta`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.globalAlpha = u * (1 - e); const y = cy + (1 - u) * size * 0.32 - e * size * 0.25;
  c.fillStyle = relax < 1 && col === C.ink ? lerpCol(C.accent, C.ink, relax) : col; c.fillText(text, cx, Math.round(y)); c.restore();
}
function lerpCol(a, b, t) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A1 = p(a), B1 = p(b); return `rgb(${A1.map((v, i) => Math.round(v + (B1[i] - v) * t)).join(',')})`; }
function plate(c, cx, cy, w, h) { c.save(); c.fillStyle = C.paper; c.globalAlpha = 0.94; const r = h / 2; c.beginPath(); c.roundRect(cx - w / 2, cy - h / 2, w, h, r); c.fill(); c.restore(); }
function cover(c, im, dx, dy, dw, dh, fx = 0.5, fy = 0.35, zoom = 1) {   // draw image cropped to fill a box
  const s = Math.max(dw / im.width, dh / im.height) * zoom, sw = dw / s, sh = dh / s, sx = clamp((im.width - sw) * fx, 0, im.width - sw), sy = clamp((im.height - sh) * fy, 0, im.height - sh);
  c.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh);
}
function pixelImg(c, im, cx, cy, s) { c.imageSmoothingEnabled = false; c.drawImage(im, Math.round(cx - im.width * s / 2), Math.round(cy - im.height * s / 2), Math.round(im.width * s), Math.round(im.height * s)); c.imageSmoothingEnabled = true; }

// ================================================================ the frame
function draw(c, f) {
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = C.paper; c.fillRect(0, 0, W, H);
  const PH = 820, PW = 656, px0 = (W - PW) / 2, py0 = 40;
  // ------------------------------------------------ act 1–2: line → pencil → colour
  if (f < T.shrink[1]) {
    const cnt = Math.floor(A.pcl.n * Math.pow(prog(f, ...T.pencil), 1.25)); if (cnt > A.penDone) pencilTo(cnt);
    const push = lmix(1, 1.06, E.cam(prog(f, T.push[0], T.push[1] + 60)));
    const sh = E.inOut(prog(f, ...T.shrink)), sc = push * lmix(1, 420 / 820, sh), tx = mix(0, 5 * 384 - 5 * 384, sh);   // shrinking into its card slot
    c.save(); c.translate(W / 2 + tx, mix(py0 + PH / 2, H / 2, sh)); c.scale(sc, sc); c.translate(-PW / 2, -PH / 2);
    const fade = prog(f, T.pencil[0] - 2, T.pencil[0] + 10); c.globalAlpha = fade; c.drawImage(A.pen, 0, 0, PW, PH); c.globalAlpha = 1;
    // colour wipe along a diagonal; the device line is its edge
    const wp = E.inOut(prog(f, ...T.wipe));
    if (wp > 0) { const d = wp * (PW + PH) * 1.08 - 40; c.save(); c.beginPath(); c.moveTo(0, 0); c.lineTo(d, 0); c.lineTo(d - PH, PH); c.lineTo(0, PH); c.closePath(); c.clip(); c.drawImage(A.paint_now, 0, 0, PW, PH); c.restore();
      if (wp < 1) { c.strokeStyle = C.ink; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(d + 30, -30); c.lineTo(d - PH - 30, PH + 30); c.stroke(); } }
    if (sh > 0) { c.strokeStyle = C.ink; c.globalAlpha = sh; c.lineWidth = 3 / sc; c.strokeRect(0, 0, PW, PH); c.globalAlpha = 1; }
    c.restore();
    // the device: one ink line arrives, already moving, and curls into the drawing
    const li = prog(f, ...T.lineIn), lo = prog(f, T.lineIn[0] + 18, T.pencil[0] + 30);
    if (li > 0 && lo < 1) { const head = E.out(li), tail = E.smooth(lo); c.save(); c.strokeStyle = C.ink; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath();
      const pt = u => { const a = u; return [mix(-120, 960, a) + Math.sin(a * 3.1) * 220 * (1 - a), mix(860, 250, a * a) + Math.sin(a * 6) * 40 * (1 - a)]; };
      for (let k = 0; k <= 60; k++) { const u = tail + (head - tail) * k / 60, [X, Y] = pt(u); k ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.stroke(); c.restore(); }
    words(c, 'one line', f, T.copy1, T.wipe[0] - 22, W / 2, 1000, 72);
    if (f >= T.copy2 - 1) words(c, 'becomes me.', f, T.copy2, T.shrink[0] - 4, W / 2, 1000, 72);
  }
  // ------------------------------------------------ act 3: every age, on a film strip
  if (f >= T.shrink[0] && f < T.grow[1]) {
    const sh = E.inOut(prog(f, ...T.shrink)), grow = E.inOut(prog(f, ...T.grow));
    // camera index: 5 (now) → back to 0 → steps 0..5 on 8ths → grows on 5
    let ci = 5;   // 'now' lands in its card; match cut on the card frame to 'baby'; then one age per 8th note
    if (f >= T.step0) { ci = 0; for (let k = 1; k < 6; k++) { const s0 = T.step0 + k * T.stepN; if (f >= s0) ci = (k - 1) + E.rest(prog(f, s0, s0 + 14)); } }
    const cs = lmix(1, 820 / 420, grow), cw = 336 * cs, ch = 420 * cs, gap = 48 * cs;
    if (f >= T.shrink[1] - 1) for (let k = 0; k < 6; k++) {
      const cx = W / 2 + (k - ci) * (cw + gap); if (cx < -cw || cx > W + cw) continue;
      const act = 1 - clamp(Math.abs(k - ci)), lift = act * 0.06;
      c.save(); c.translate(cx, mix(H / 2, py0 + PH / 2, grow)); c.scale(1 + lift, 1 + lift); c.drawImage(A['paint_' + AGES[k]], -cw / 2, -ch / 2, cw, ch);
      c.fillStyle = `rgba(243,238,230,${(0.55 * (1 - act)).toFixed(3)})`; c.fillRect(-cw / 2, -ch / 2, cw, ch);
      c.strokeStyle = act > 0.5 ? C.accent : C.ink; c.lineWidth = act > 0.5 ? 4 : 2; c.strokeRect(-cw / 2, -ch / 2, cw, ch); c.restore();
    }
    // the device as the strip's rail
    if (f >= T.shrink[1] - 1 && grow < 1) { c.fillStyle = C.ink; c.globalAlpha = 1 - grow; c.fillRect(0, H / 2 + ch / 2 + 28, W, 4); c.globalAlpha = 1; }
    if (f >= T.copy3 - 1) words(c, 'every age', f, T.copy3, T.grow[0] - 6, W / 2, 1000, 72);
  }
  // ------------------------------------------------ act 4: pixels
  if (f >= T.grow[1] && f < T.whip0) {
    if (f < T.cut) {
      const steps = [1, 6, 16, 34]; let bs = 1; T.pix.forEach((s, i) => { if (f >= s) bs = steps[i + 1]; });
      const pw2 = Math.max(4, Math.round(PW / bs)), ph2 = Math.max(5, Math.round(PH / bs)); A.pix.width = pw2; A.pix.height = ph2; A.pixX.imageSmoothingEnabled = true; A.pixX.drawImage(A.paint_now, 0, 0, pw2, ph2);
      c.imageSmoothingEnabled = bs === 1; c.drawImage(A.pix, px0, py0, PW, PH); c.imageSmoothingEnabled = true;
      c.strokeStyle = C.accent; c.lineWidth = 4; c.strokeRect(px0, py0, PW, PH);
    } else {
      // the same me, now in pixels: start on my face, pull back to the sakura
      const z = E.cam(prog(f, ...T.zoom)), clip = clipAt('treeStage', f - T.cut), sTo = 6, sFrom = 22;
      const s = lmix(sFrom, sTo, z), fx_ = mix(193, 375 / 2, z), fy_ = mix(158, 213 / 2 + 6, z);
      c.imageSmoothingEnabled = false; c.drawImage(clip, Math.round(W / 2 - fx_ * s), Math.round(H / 2 - fy_ * s), Math.round(375 * s), Math.round(213 * s)); c.imageSmoothingEnabled = true;
    }
    if (f < T.cut + 4) words(c, 'in pixels', f, T.copy4, T.cut - 14, W / 2, 1000, 72);
  }
  // ------------------------------------------------ act 5: whip through the scenes
  if (f >= T.whip0 && f < T.pull[0]) {
    const k = Math.floor((f - T.whip0) / T.whipLen), local = (f - T.whip0) - k * T.whipLen;
    let u = k + E.whip(prog(local, 0, T.whipMove)) - 1;   // u = position along the scene list (-1 = the sakura)
    if (f >= T.whip0 + 6 * T.whipLen) u = 5;
    const list = ['treeStage', ...SCENES], at = u + 1;
    for (let i = Math.floor(at); i <= Math.ceil(at); i++) {
      const s = list[i]; if (!s) continue; const off = (i - at) * W, clip = clipAt(s, f - T.whip0 + i * 7), sc = s === 'treeStage' ? 6 : 9;
      c.save(); c.beginPath(); c.rect(off, 0, W, H); c.clip(); c.imageSmoothingEnabled = false;
      c.drawImage(clip, Math.round(off + W / 2 - clip.width * sc / 2), Math.round(H / 2 - clip.height * sc / 2), clip.width * sc, clip.height * sc); c.restore();
      if (i > at - 1 && i !== Math.floor(at)) { c.fillStyle = C.ink; c.fillRect(Math.round(off) - 4, 0, 8, H); }   // the device rides the seam
    }
  }
  // ------------------------------------------------ act 6: the wall
  if (f >= T.pull[0] && f < T.wipeOut[1]) {
    const cols = 4, rows = 3, cw = 420, ch = 236, g = 28, gw = cols * cw + (cols - 1) * g, gh = rows * ch + (rows - 1) * g;
    const drift = (f - T.pull[0]) * 0.5, creep = lmix(1, 1.035, prog(f, T.pull[0], T.wipeOut[1]));
    const cells = ['paint_now', 'pencil', 'treeStage', 'fireStage', 'paint_kid', 'mascot', 'rainStage', 'paint_young', 'deskStage', 'paint_baby', 'fishStage', 'snowStage'];
    c.save(); c.translate(W / 2, H / 2); c.scale(creep, creep); c.translate(-gw / 2 - drift * 0.6, -gh / 2 - drift * 0.25);
    cells.forEach((id, i) => {
      const r = Math.floor(i / cols), q = i % cols, X = q * (cw + g), Y = r * (ch + g), last = i === cells.length - 1;
      let a = 1, sc = 1;
      if (!last) { const d = T.cells0 + ((i * 5) % 12) * 4; a = E.out(prog(f, d, d + 20)); sc = mix(0.92, 1, a); }
      else { const p = E.inOut(prog(f, ...T.pull)); if (p < 1) { c.restore(); c.save(); const fs = lmix(W / cw, 1, p) * creep;   // the snow scene shrinks into its cell
        const tx = mix(W / 2, W / 2 + (X + cw / 2 - gw / 2 - drift * 0.6) * creep, p), ty = mix(H / 2, H / 2 + (Y + ch / 2 - gh / 2 - drift * 0.25) * creep, p);
        c.translate(tx, ty); c.scale(fs, fs); cellDraw(c, id, f, -cw / 2, -ch / 2, cw, ch); c.restore(); c.save(); c.translate(W / 2, H / 2); c.scale(creep, creep); c.translate(-gw / 2 - drift * 0.6, -gh / 2 - drift * 0.25); return; } }
      if (a <= 0) return; c.save(); c.globalAlpha = a; c.translate(X + cw / 2, Y + ch / 2); c.scale(sc, sc); cellDraw(c, id, f, -cw / 2, -ch / 2, cw, ch); c.restore();
    });
    c.restore();
    if (f >= T.copy5a - 1) { const out = T.wipeOut[0] - 2;
      c.save(); c.font = '700 80px Jakarta'; const w1 = c.measureText('all drawn').width, sp = c.measureText(' ').width, w2 = c.measureText('in code.').width; c.restore();
      const k = f >= T.copy5b ? E.out(prog(f, T.copy5b, T.copy5b + 26)) : 0, L = W / 2 - (w1 + sp + w2) / 2;
      plate(c, W / 2, 974, mix(w1 + 120, w1 + sp + w2 + 120, k), 116);
      const ax = mix(W / 2, L + w1 / 2, k); words(c, 'all drawn', f, T.copy5a, out, ax, 1004, 80); words(c, 'in code.', f, T.copy5b, out, ax + w1 / 2 + sp + w2 / 2, 1004, 80); }
    // the line sweeps across and clears the wall to paper
    const wo = E.inOut(prog(f, ...T.wipeOut));
    if (wo > 0) { const xw = wo * (W + 200) - 100; c.fillStyle = C.paper; c.fillRect(0, 0, xw, H); c.fillStyle = C.ink; c.fillRect(Math.round(xw) - 4, 0, 8, H); }
  }
  // ------------------------------------------------ act 7: lockup
  if (f >= T.wipeOut[1] - 1) {
    const ub = E.out(prog(f, ...T.under)), creep = lmix(1, 1.03, prog(f, T.name[1], TOTAL));
    c.save(); c.translate(W / 2, 560); c.scale(creep, creep);
    // the line, now the underline the name stands on
    const half = 430; c.fillStyle = C.ink; c.fillRect(Math.round(-half), 26, Math.round(half * 2 * ub), 7);
    const nm = E.out(prog(f, ...T.name)); c.save(); c.beginPath(); c.rect(-1000, -200, 2000, 226); c.clip();
    c.font = '700 150px Jakarta'; c.textAlign = 'center'; c.fillStyle = C.ink; c.fillText('Nikit Hamal', 0, Math.round(mix(180, 0, nm))); c.restore();
    const ul = E.out(prog(f, T.url, T.url + 26)); c.globalAlpha = ul; c.font = '500 52px Jakarta'; c.fillStyle = C.mute; c.textAlign = 'center'; c.fillText('nikit.is-a.dev', 0, Math.round(110 + (1 - ul) * 14));
    c.globalAlpha = 1; c.fillStyle = C.accent; c.fillRect(Math.round(-half + half * 2 * ub) - 6, 26, ub > 0.02 ? 12 : 0, 7);   // the line's live tip, in the accent
    c.restore();
  }
}
function cellDraw(c, id, f, X, Y, w, h) {
  c.save(); c.beginPath(); c.rect(X, Y, w, h); c.clip(); c.fillStyle = '#fbf8f3'; c.fillRect(X, Y, w, h);
  if (id.startsWith('paint_')) cover(c, A[id], X, Y, w, h, 0.5, 0.3);
  else if (id === 'pencil') cover(c, A.tone, X, Y, w, h, 0.5, 0.3);
  else if (id === 'mascot') { const im = clipAt('mascot', f, 25); cover(c, im, X, Y, w, h, 0.5, 0.55, 1.2); }
  else { const im = clipAt(id, f + id.length * 9); c.imageSmoothingEnabled = false; cover(c, im, X, Y, w, h, 0.5, 0.6, id === 'treeStage' ? 1.25 : 1.05); c.imageSmoothingEnabled = true; }
  c.restore(); c.strokeStyle = C.ink; c.lineWidth = 2; c.strokeRect(X, Y, w, h);
}
// ---- motion blur: frames with fast moves are averaged from sub-frame samples
const FAST = [[T.wipe[0], T.wipe[1]], [T.shrink[0], T.shrink[1]], [T.step0 + 14, T.step0 + 90], [T.grow[0], T.grow[1]], [T.whip0, T.pull[0] + 10], [T.pull[0], T.pull[1]], [T.wipeOut[0], T.wipeOut[1]]];
function frame(f) {
  const fast = FAST.some(([a, b]) => f >= a && f <= b);
  if (!fast || f < T.pencil[1]) { draw(x, f); return; }
  const n = (f >= T.whip0 && f <= T.pull[1]) ? 16 : 8; ax.clearRect(0, 0, W, H);
  for (let k = 0; k < n; k++) { draw(x, f - 0.5 + (k + 0.5) / n); ax.globalAlpha = 1 / (k + 1); ax.drawImage(cv, 0, 0); }
  ax.globalAlpha = 1; x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(acc, 0, 0);
}
window.film = { load, frame, TOTAL, T };
