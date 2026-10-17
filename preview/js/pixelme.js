/*!
 * Pixel me — a full-body pixel-art Nikit (today: long wavy centre-parted hair, moustache + chin
 * patch, white tee, jeans), painted pixel by pixel in code every frame from a pose rig, then
 * outlined and scaled up crisp. Animations: breathing idle with hair sway, blinks, glances,
 * walk cycle, wave, crouch-hop-land, dance, sit, sleep (pixel Zzz), and a startled wake-up.
 */
(() => {
'use strict';
const stage = document.getElementById('pixelStage');
if (!stage) return;
const cv = document.createElement('canvas'); stage.appendChild(cv); const out = cv.getContext('2d');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;

// ---- palette (light from the left)
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const PAL = {
  outline: '#2a1d1a', hair: '#1f1715', hairMid: '#2e231f', hairHi: '#4b3a33',
  skin: '#ebbf9e', skinShade: '#d39f7e', skinDeep: '#b9805f', blush: '#e9a58e',
  eyeW: '#f6efe8', iris: '#3a2418', brow: '#2a1d18', stache: '#3b2a22', lip: '#b8705f',
  tee: '#f4f1ea', teeShade: '#d9d3c8', teeDeep: '#bfb8ac',
  jean: '#3b5579', jeanShade: '#2c4262', jeanDeep: '#22334d',
  shoe: '#f2efe9', shoeShade: '#cfc8bf', sole: '#8d8279', belt: '#3a2a22', ground: '#d8cbb8',
};
const RGB = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, hex(v)]));

// ---- sprite buffer
const SW = 64, SH = 100, GY = 96;      // sprite size, feet line
const buf = new Uint8ClampedArray(SW * SH * 4); let ids = new Uint8Array(SW * SH);
function clear() { buf.fill(0); ids.fill(0); }
function px(x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= SW || y >= SH) return; const i = (y * SW + x) * 4, r = RGB[c]; buf[i] = r[0]; buf[i + 1] = r[1]; buf[i + 2] = r[2]; buf[i + 3] = 255; ids[y * SW + x] = 1; }
function rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); }
function disc(cx, cy, r, c) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) px(x, y, c); }
function ell(cx, cy, rx, ry, c, shade, sc) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry; if (u * u + v * v <= 1) px(x, y, shade && u > sc ? shade : c); } }
// thick limb from (x0,y0) to (x1,y1), with a shaded right edge
function limb(x0, y0, x1, y1, r, c, shade) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(x0, x1, t), y = lerp(y0, y1, t); disc(x, y, r, c); if (shade) disc(x + r * 0.55, y, r * 0.45, shade); }
}
function outline() {
  const src = ids.slice();
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    if (src[y * SW + x]) continue;
    if ((x > 0 && src[y * SW + x - 1]) || (x < SW - 1 && src[y * SW + x + 1]) || (y > 0 && src[(y - 1) * SW + x]) || (y < SH - 1 && src[(y + 1) * SW + x])) px(x, y, 'outline');
  }
}

// ---- the character, drawn from a pose
function paint(P) {
  clear();
  const cx = 32 + P.dx, by = P.bob;                  // body x, vertical bob (px)
  const hipY = 59 + by, shY = 34 + by, headY = 20 + by + P.headDy, hx = cx + P.headDx;
  // legs (thigh angle a, knee bend k; 0 = straight down)
  const leg = (side, a, k, lift = 0) => {
    const hx0 = cx + side * 4, ax = a * Math.PI / 180, kx = (a + k) * Math.PI / 180, th = 15 - lift * 3, sh = 15 - lift * 2;
    const knee = [hx0 + Math.sin(ax) * th + side * lift, hipY + Math.cos(ax) * th], foot = [knee[0] + Math.sin(kx) * sh, knee[1] + Math.cos(kx) * sh];
    limb(hx0, hipY, knee[0], knee[1], 3.2, 'jean', 'jeanShade'); limb(knee[0], knee[1], foot[0], foot[1], 3, 'jean', 'jeanShade');
    px(knee[0] - 1, knee[1], 'jeanDeep');
    const fx = Math.round(foot[0]), fy = Math.round(foot[1]);
    rect(fx - 3 + side, fy, 7, 3, 'shoe'); rect(fx + 2 + side, fy + 1, 2, 2, 'shoeShade'); rect(fx - 3 + side, fy + 3, 7, 1, 'sole');
  };
  // back hair (shoulder length, sways)
  const hairBack = () => {
    ell(hx, headY - 1, 13, 13.5, 'hair', 'hairMid', 0.45);
    for (const side of [-1, 1]) for (let y = 0; y < 14; y++) {
      const sway = P.sway * (y / 14) ** 1.5, wav = Math.round(Math.sin(y * 0.6 + side) * 1.1);
      const x0 = hx + side * (9 + y * 0.1) + sway + wav, w = 4 - Math.floor(y / 8);
      for (let i = 0; i < w; i++) px(x0 + side * i, headY + 3 + y, (i === 1 && y % 5 === 2) ? 'hairHi' : 'hair');
      if (y > 10) px(x0 + side * w + sway * 0.3, headY + 3 + y - 1, 'hair');   // curled ends
    }
  };
  const arm = (side, a, f, front) => {
    const sx = cx + side * 11, sy = shY + 2, ar = a * Math.PI / 180, fr = (a + f) * Math.PI / 180, sg = side;
    const el = [sx + sg * Math.sin(ar) * 9, sy + Math.cos(ar) * 9], hd = [el[0] + sg * Math.sin(fr) * 9, el[1] + Math.cos(fr) * 9];
    limb(sx, sy, el[0], el[1], 2.4, 'skin', 'skinShade'); limb(el[0], el[1], hd[0], hd[1], 2.2, 'skin', 'skinShade');
    disc(hd[0], hd[1] + 0.5, 2.3, 'skin'); px(hd[0] + side, hd[1] + 1, 'skinShade'); px(hd[0] - side * 2, hd[1] - 1, 'skin');   // thumb
    // sleeve
    limb(sx, sy - 0.5, sx + sg * Math.sin(ar) * 4.5, sy + Math.cos(ar) * 4.5, 3.4, 'tee', side > 0 ? 'teeShade' : null);
  };
  hairBack();
  leg(-1, P.lL, P.kL, P.liftL || 0); leg(1, P.lR, P.kR, P.liftR || 0);
  if (P.armsBehind) { arm(-1, P.aL, P.fL); arm(1, P.aR, P.fR); }
  // torso: tee with soft folds
  for (let y = shY; y <= hipY; y++) {
    const t = (y - shY) / (hipY - shY), half = Math.round(lerp(11, 9, Math.min(1, t * 1.6)) + (t > 0.85 ? 0.5 : 0));
    for (let x = -half; x <= half; x++) px(cx + x, y, x > half - 3 ? 'teeShade' : x > half - 1 ? 'teeDeep' : 'tee');
  }
  for (let y = shY + 6; y < hipY - 2; y += 4) px(cx + 3 + (y % 3), y, 'teeShade');   // fold hints
  rect(cx - 9, hipY - 1, 19, 2, 'jean'); rect(cx - 9, hipY - 1, 19, 1, 'belt');
  // neck + crew collar
  rect(hx - 3, headY + 9, 7, Math.max(2, shY - headY - 8), 'skin'); rect(hx + 1, headY + 9, 3, Math.max(2, shY - headY - 9), 'skinShade');
  for (let x = -4; x <= 4; x++) px(cx + x, shY + (Math.abs(x) < 3 ? 2 : 1), 'teeShade');
  if (!P.armsBehind) { arm(-1, P.aL, P.fL); arm(1, P.aR, P.fR); }
  // face
  ell(hx, headY, 8.6, 10.6, 'skin', 'skinShade', 0.55);
  px(hx - 8, headY + 1, 'skinShade'); px(hx + 8, headY + 1, 'skinDeep');          // ears peeking
  // eyes
  const ey = headY + 1, ex = P.look;
  for (const s of [-1, 1]) {
    const x = hx + s * 4 - 1;
    if (P.eyes === 'closed') { rect(x - 1 + (s > 0 ? 1 : 0), ey + 1, 3, 1, 'brow'); continue; }
    if (P.eyes === 'happy') { px(x - 1 + (s > 0 ? 1 : 0), ey + 1, 'brow'); rect(x + (s > 0 ? 1 : 0), ey, 1, 1, 'brow'); px(x + 1 + (s > 0 ? 1 : 0), ey + 1, 'brow'); continue; }
    rect(x - 1 + (s > 0 ? 1 : 0), ey, 3, 2, 'eyeW');
    const ix = x + (s > 0 ? 1 : 0) + clamp(Math.round(ex), -1, 1);
    rect(ix, ey, 1, 2, 'iris'); if (P.eyes !== 'sleepy') px(ix, ey, 'iris'); else rect(x - 1 + (s > 0 ? 1 : 0), ey, 3, 1, 'skinShade');
  }
  // brows
  for (const s of [-1, 1]) { const x = hx + s * 4 - 1 + (s > 0 ? 1 : 0); rect(x - 1, ey - 3 - P.browUp, 3, 1, 'brow'); px(x + (s < 0 ? -2 : 2), ey - 2 - P.browUp, 'brow'); }
  // nose, moustache, mouth, chin patch
  px(hx + 1, ey + 2, 'skinShade'); px(hx + 1, ey + 3, 'skinShade'); px(hx, ey + 5, 'skinDeep'); px(hx - 1, ey + 4, 'skinShade'); px(hx + 2, ey + 5, 'skinDeep');
  rect(hx - 3, ey + 6, 7, 1, 'stache'); px(hx - 4, ey + 7, 'stache'); px(hx + 4, ey + 7, 'stache');
  if (P.mouth === 'o') { rect(hx - 1, ey + 7, 3, 2, 'lip'); px(hx, ey + 8, 'brow'); }
  else if (P.mouth === 'smile') { rect(hx - 2, ey + 8, 5, 1, 'lip'); px(hx - 3, ey + 7, 'lip'); px(hx + 3, ey + 7, 'lip'); }
  else rect(hx - 2, ey + 8, 5, 1, 'lip');
  rect(hx - 1, ey + 10, 3, 1, 'stache');
  if (P.blush) { px(hx - 6, ey + 4, 'blush'); px(hx - 5, ey + 4, 'blush'); px(hx + 5, ey + 4, 'blush'); px(hx + 6, ey + 4, 'blush'); }
  // front hair: centre part sweeping to the temples, wavy fringe framing the face
  for (let y = -11; y <= 0; y++) for (let x = -10; x <= 10; x++) {
    const inHead = (x / 10.5) ** 2 + ((y + 1) / 11.5) ** 2 <= 1; if (!inHead) continue;
    const edge = -6 + Math.abs(x) * 0.42 + (Math.abs(x) > 6 ? (Math.abs(x) - 6) * 1.6 : 0);   // hairline
    if (y < edge - 3 || (Math.abs(x) > 6 && y < 3)) { const hi = (x === -4 || x === -5) && y > -9 && y < -4 || (x === 5 && y === -7); px(hx + x, headY + y, hi ? 'hairHi' : Math.abs(x) <= 0 && y < -8 ? 'hairMid' : 'hair'); }
  }
  for (let y = 0; y < 8; y++) { px(hx - 9 - (y > 5 ? 1 : 0), headY + y, 'hair'); px(hx - 8, headY + y - 1, 'hair'); px(hx + 9 + (y > 5 ? 1 : 0), headY + y, 'hair'); px(hx + 8, headY + y - 1, 'hair'); }
  px(hx, headY - 10, 'skinShade');   // the part
  outline();
}

// ---- stage, state, input
const S = { x: 0, target: null, face: 1, mode: 'idle', mt: 0, t: 0, y: 0, vy: 0, last: performance.now(), lastInput: performance.now(), blink: 2, blinkOn: 0, look: 0, ptr: null, zs: [], dust: [], scale: 4, W: 0, H: 0 };
function layout() { const r = stage.getBoundingClientRect(); S.scale = r.width < 520 ? 3 : 4; S.W = Math.floor(r.width / S.scale); S.H = Math.floor(r.height / S.scale); cv.width = S.W; cv.height = S.H; cv.style.width = S.W * S.scale + 'px'; cv.style.height = S.H * S.scale + 'px'; if (!S.x) S.x = S.W / 2; }
layout(); addEventListener('resize', layout);
const set = m => { S.mode = m; S.mt = 0; };
const loc = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / S.scale, y: (e.clientY - r.top) / S.scale }; };
const onHim = p => Math.abs(p.x - S.x) < 14 && p.y > S.H - 8 - SH + 6 + S.y && p.y < S.H - 4;
function wake() { S.lastInput = performance.now(); if (S.mode === 'sleep' || S.mode === 'sit') set('startle'); else if (S.mode === 'glance' || S.mode === 'yawn') set('idle'); }
stage.addEventListener('pointermove', e => { S.ptr = loc(e); wake(); });
stage.addEventListener('pointerleave', () => (S.ptr = null));
stage.addEventListener('pointerdown', e => { const p = loc(e); wake(); if (onHim(p)) hop(); else { S.target = clamp(p.x, 14, S.W - 14); set('walk'); } });
document.querySelectorAll('[data-pixel]').forEach(b => b.addEventListener('click', () => { S.lastInput = performance.now(); const a = b.dataset.pixel; a === 'hop' ? hop() : set(a); }));
function hop() { if (S.mode === 'crouch' || S.y < 0) return; set('crouch'); }

function step(dt) {
  S.t += dt; S.mt += dt; const idle = (performance.now() - S.lastInput) / 1000, m = S.mode;
  if (m === 'idle' && idle > 5 && S.mt > 2.5) set('glance');
  if (m === 'glance' && S.mt > 3) set(idle > 12 ? 'yawn' : 'idle');
  if (m === 'yawn' && S.mt > 2.4) set(idle > 16 ? 'sit' : 'idle');
  if (m === 'sit' && S.mt > 3) set('sleep');
  if (m === 'startle' && S.mt > 0.6) set('wave');
  if (m === 'wave' && S.mt > 2) set('idle');
  if (m === 'dance' && S.mt > 6) set('idle');
  if (m === 'crouch' && S.mt > 0.14) { S.vy = -95; set('air'); }
  if (m === 'land' && S.mt > 0.25) set('idle');
  if (m === 'walk') { const dx = S.target - S.x; if (Math.abs(dx) < 0.6) { set('wave'); } else { S.face = Math.sign(dx); const mv = clamp(dx, -26 * dt, 26 * dt); S.x += mv; S.walkPh = (S.walkPh || 0) + Math.abs(mv) / 9 * Math.PI; if (Math.floor(S.t * 8) % 4 === 0 && Math.random() < 0.3) S.dust.push({ x: S.x - S.face * 3, y: S.H - 5, l: 0 }); } }
  if (S.y < 0 || S.vy < 0) { S.vy += 380 * dt; S.y += S.vy * dt; if (S.y >= 0) { S.y = 0; S.vy = 0; set('land'); for (let i = 0; i < 5; i++) S.dust.push({ x: S.x + (i - 2) * 3, y: S.H - 5, l: 0 }); } }
  S.blink -= dt; if (S.blink < 0) { S.blinkOn = 0.12; S.blink = 2 + Math.random() * 3.5; }
  S.blinkOn -= dt;
  let lk = 0; if (S.ptr) lk = clamp((S.ptr.x - S.x) / 30, -1, 1); if (m === 'glance') lk = Math.sin(S.mt * 2.2) > 0 ? 1 : -1; if (m === 'walk') lk = S.face;
  S.look = lerp(S.look, lk, 1 - Math.pow(0.001, dt));
  if (m === 'sleep' && Math.random() < dt * 0.9) S.zs.push({ x: S.x + 8, y: S.H - 8 - 62, l: 0 });
  S.zs.forEach(z => { z.l += dt; z.y -= 6 * dt; z.x += Math.sin(z.l * 3) * 4 * dt; }); S.zs = S.zs.filter(z => z.l < 2.4);
  S.dust.forEach(d => { d.l += dt; }); S.dust = S.dust.filter(d => d.l < 0.4);
}

function pose() {
  const m = S.mode, t = S.t, mt = S.mt, P = { dx: 0, bob: 0, headDx: 0, headDy: 0, lL: 0, lR: 0, kL: 0, kR: 0, aL: 8, aR: 8, fL: 6, fR: 6, sway: Math.sin(t * 1.8) * 0.8, eyes: 'open', look: S.look, browUp: 0, mouth: 'line', blush: false, armsBehind: false };
  const breathe = Math.sin(t * 2.4) > 0.6 ? -1 : 0; P.bob = breathe;
  if (m === 'walk') {
    const f = Math.floor((S.walkPh || 0) / Math.PI * 4) % 8, ph = f / 8 * Math.PI * 2, d = S.face;
    const sL = Math.sin(ph), sR = -sL; P.liftL = Math.max(0, sL) * 2.2; P.liftR = Math.max(0, sR) * 2.2;
    P.lL = d * 3 + (P.liftL ? d * 4 : 0); P.lR = d * 3 + (P.liftR ? d * 4 : 0); P.kL = -P.liftL * d * 8; P.kR = -P.liftR * d * 8;
    P.aL = 8 + sR * 10; P.aR = 8 + sL * 10; P.fL = 6 + Math.max(0, sR) * 34; P.fR = 6 + Math.max(0, sL) * 34;
    P.bob = (f % 4 === 1 || f % 4 === 3) ? -1 : 0; P.dx = 0; P.sway = -d * 2 + (f % 4 < 2 ? 0 : 1); P.headDx = (f % 4 === 1) ? d : 0;
  }
  if (m === 'wave' || m === 'startle') { P.aR = 150; P.fR = [10, 28, 44, 28][Math.floor(mt * 10) % 4]; P.eyes = 'happy'; P.mouth = 'smile'; P.blush = true; if (m === 'startle') { P.bob = -Math.round(Math.sin(clamp(mt / 0.6, 0, 1) * Math.PI) * 5); P.eyes = 'open'; P.browUp = 1; P.mouth = 'o'; P.aL = 60; } }
  if (m === 'crouch') { P.bob = 3; P.kL = 40; P.kR = -40; P.lL = -20; P.lR = 20; P.aL = 30; P.aR = 30; }
  if (m === 'air') { P.aL = 150; P.aR = 150; P.fL = -20; P.fR = -20; P.kL = 30; P.kR = -30; P.lL = -12; P.lR = 12; P.eyes = 'happy'; P.mouth = 'smile'; P.sway = 3; }
  if (m === 'land') { P.bob = 2; P.kL = 25; P.kR = -25; P.lL = -12; P.lR = 12; P.aL = 25; P.aR = 25; }
  if (m === 'yawn') { const u = Math.sin(clamp(mt / 2.4, 0, 1) * Math.PI); P.aL = 8 + u * 160; P.aR = 8 + u * 160; P.fL = 0; P.fR = 0; P.eyes = u > 0.4 ? 'closed' : 'open'; P.mouth = u > 0.4 ? 'o' : 'line'; P.bob = -Math.round(u * 2); P.armsBehind = u > 0.5; }
  if (m === 'sit' || m === 'sleep') { P.bob = 15; P.lL = 84; P.lR = -84; P.kL = -150; P.kR = 150; P.aL = 18; P.aR = 18; P.fL = -40; P.fR = -40; if (m === 'sleep') { P.eyes = 'closed'; P.headDy = 1; P.headDx = 1; P.sway = 1.5; P.bob = 15 + (Math.sin(t * 1.4) > 0.3 ? 0 : 1); } else P.eyes = mt > 1.8 ? 'sleepy' : 'open'; }
  if (m === 'dance') { const f = Math.floor(t * 6) % 4; P.bob = f % 2 ? -2 : 0; P.dx = f < 2 ? -1 : 1; P.aL = f % 2 ? 150 : 110; P.aR = f % 2 ? 110 : 150; P.fL = -30; P.fR = -30; P.lL = f < 2 ? -10 : 6; P.lR = f < 2 ? -6 : 10; P.kL = f === 1 ? 30 : 0; P.kR = f === 3 ? -30 : 0; P.eyes = 'happy'; P.mouth = 'smile'; P.blush = true; P.sway = f < 2 ? -3 : 3; }
  if (m === 'glance') P.browUp = Math.sin(mt * 2.2) > 0.95 ? 1 : 0;
  if (S.blinkOn > 0 && P.eyes === 'open') P.eyes = 'closed';
  if (S.ptr && onHim(S.ptr) && (m === 'idle' || m === 'glance')) { P.eyes = 'happy'; P.mouth = 'smile'; P.blush = true; }
  return P;
}

// ---- render: stage background is the page; ground line + shadow + sprite + particles
const img = new ImageData(SW, SH), tmp = document.createElement('canvas'); tmp.width = SW; tmp.height = SH; const tctx = tmp.getContext('2d');
function render() {
  out.clearRect(0, 0, S.W, S.H);
  const gy = S.H - 5; out.fillStyle = PAL.ground; out.fillRect(0, gy + 1, S.W, 1);
  const lift = clamp(-S.y / 20, 0, 1), sw = Math.round(14 * (1 - lift * 0.5) * (S.mode === 'sit' || S.mode === 'sleep' ? 1.3 : 1));
  out.fillStyle = 'rgba(70,50,40,.18)'; out.fillRect(Math.round(S.x - sw / 2), gy, sw, 1); out.fillRect(Math.round(S.x - sw / 2 + 2), gy - 1, sw - 4, 1);
  paint(pose()); img.data.set(buf); tctx.putImageData(img, 0, 0);
  out.drawImage(tmp, Math.round(S.x - SW / 2), Math.round(gy - GY + S.y));
  out.fillStyle = 'rgba(200,185,165,.8)'; for (const d of S.dust) { const r = d.l < 0.2 ? 1 : 2; out.fillRect(Math.round(d.x + (d.l * 10) * (d.x > S.x ? 1 : -1)), Math.round(d.y - d.l * 4), r, r); }
  out.fillStyle = '#5b4a7a'; out.font = '8px monospace';
  for (const z of S.zs) { out.globalAlpha = Math.min(1, z.l * 3) * (1 - z.l / 2.4); const zx = Math.round(z.x), zy = Math.round(z.y), sz = z.l > 1.2 ? 4 : 3;   // pixel "z"
    out.fillRect(zx, zy, sz, 1); out.fillRect(zx + sz - 2, zy + 1, 1, 1); if (sz > 3) out.fillRect(zx + 1, zy + 2, 1, 1); out.fillRect(zx, zy + sz - 1, sz, 1); }
  out.globalAlpha = 1;
}
let vis = false;
new IntersectionObserver(e => { vis = e[0].isIntersecting; if (vis) { S.last = performance.now(); requestAnimationFrame(loop); } }, { threshold: 0.05 }).observe(stage);
let acc = 0;
function loop(now) {
  if (!vis) return; const dt = Math.min(0.05, (now - S.last) / 1000); S.last = now; step(dt);
  acc += dt; if (acc >= 1 / 30 || reduce) { acc = 0; render(); }   // 30 fps is plenty for pixels
  requestAnimationFrame(loop);
}
setTimeout(() => S.mode === 'idle' && set('wave'), 800);
})();
