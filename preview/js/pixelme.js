/*!
 * Pixel me — a full-body pixel-art Nikit living in a little scene with the portfolio's own pixel art:
 * the <pixel-dog> rottie (drawn from its rig, js/pixel-dog.js) and a sakura tree.
 * The face is a symmetric 30×32 pixel portrait built from my painting (tools/pixelhead.py), the tree is
 * painted at the same pixel size (tools/pixeltree.py); the body is painted
 * pixel by pixel every frame from a pose rig. He walks, waves, hops, dances, pets the dog, sits under
 * the sakura and naps there with the dog curled up beside him (pixel Zzz); the dog follows him around.
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

// ---- the face: a pixel portrait made from my painting
let HEAD = null, HINFO = null;
Promise.all([fetch('art/pixelhead.json').then(r => r.json()), new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = 'art/pixelhead.png'; })]).then(([info, im]) => {
  const c = document.createElement('canvas'); c.width = info.w; c.height = info.h; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  HEAD = x.getImageData(0, 0, info.w, info.h).data; HINFO = info;
});

// ---- sprite buffer
const SW = 64, SH = 100, GY = 96;      // sprite size, feet line
const buf = new Uint8ClampedArray(SW * SH * 4); let ids = new Uint8Array(SW * SH);
function clear() { buf.fill(0); ids.fill(0); }
function px(x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= SW || y >= SH) return; const i = (y * SW + x) * 4, r = RGB[c]; buf[i] = r[0]; buf[i + 1] = r[1]; buf[i + 2] = r[2]; buf[i + 3] = 255; ids[y * SW + x] = 1; }
function pxc(x, y, r, g, b) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= SW || y >= SH) return; const i = (y * SW + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255; ids[y * SW + x] = 1; }
function rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); }
function disc(cx, cy, r, c) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) px(x, y, c); }
function ell(cx, cy, rx, ry, c, shade, sc) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry; if (u * u + v * v <= 1) px(x, y, shade && u > sc ? shade : c); } }
// thick limb from (x0,y0) to (x1,y1), with a shaded right edge
function limb(x0, y0, x1, y1, r, c, shade) {   // constant-width limb with a crisp square brush, shaded right edge
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2)), w = Math.round(r * 2 - 0.6), h = w >> 1;
  for (let i = 0; i <= n; i++) { const t = i / n, x = Math.round(lerp(x0, x1, t)), y = Math.round(lerp(y0, y1, t)); rect(x - h, y - h, w, w, c); }
  if (shade) for (let i = 0; i <= n; i++) { const t = i / n, x = Math.round(lerp(x0, x1, t)), y = Math.round(lerp(y0, y1, t)); rect(x - h + w - 1, y - h + 1, 1, w - 2, shade); }
}
function outline() {
  const src = ids.slice();
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    if (src[y * SW + x]) continue;
    if ((x > 0 && src[y * SW + x - 1]) || (x < SW - 1 && src[y * SW + x + 1]) || (y > 0 && src[(y - 1) * SW + x]) || (y < SH - 1 && src[(y + 1) * SW + x])) px(x, y, 'outline');
  }
}

// head sprite + expressions drawn over it
function head(P, hx, headY) {
  const I = HINFO, ox = Math.round(hx - I.w / 2), oy = Math.round(headY + 10 - I.chin[1]);
  for (let y = 0; y < I.h; y++) for (let x = 0; x < I.w; x++) { const k = (y * I.w + x) * 4; if (HEAD[k + 3] > 128) pxc(ox + x, oy + y, HEAD[k], HEAD[k + 1], HEAD[k + 2]); }
  // sway: the lowest hair locks at the sides lag one pixel behind
  const sw = Math.round(P.sway / 2.5);
  if (sw) for (let y = I.h - 9; y < I.h - 2; y++) for (const side of [0, I.w - 1]) { const k = (y * I.w + side) * 4; if (HEAD[k + 3] > 128 && HEAD[k] < 70) pxc(ox + side + sw, oy + y, HEAD[k], HEAD[k + 1], HEAD[k + 2]); }
  const sk = I.skin, at = (x, y) => { const k = (y * I.w + x) * 4; return [HEAD[k], HEAD[k + 1], HEAD[k + 2]]; };
  for (const [ex, ey] of I.eyes) {
    const X = ox + ex, Y = oy + ey;
    const skinUnder = at(ex, Math.min(I.h - 1, ey + 2));
    if (P.eyes === 'closed' || P.eyes === 'sleepy') {   // lid down
      for (let i = -1; i <= 1; i++) { pxc(X + i, Y, ...skinUnder); pxc(X + i, Y + (P.eyes === 'sleepy' ? 0 : 1), 34, 24, 20); }
      if (P.eyes === 'sleepy') { pxc(X, Y + 1, 40, 22, 14); }
    } else if (P.eyes === 'happy') {                     // ^ ^
      for (let i = -1; i <= 1; i++) pxc(X + i, Y, ...skinUnder);
      pxc(X - 1, Y + 1, 34, 24, 20); pxc(X, Y, 34, 24, 20); pxc(X + 1, Y + 1, 34, 24, 20); pxc(X - 1, Y - 1 + 1, ...skinUnder);
    } else {                                             // look left/right: move the iris pixel
      const l = clamp(Math.round(P.look), -1, 1); if (l) { pxc(X, Y, 236, 226, 214); pxc(X + l, Y, 40, 22, 14); }
    }
    if (P.browUp) for (let i = -1; i <= 1; i++) { const c = at(ex + i, ey - 2); pxc(X + i, Y - 3, c[0], c[1], c[2]); }
  }
  const [mx, my] = I.mouth, MX = ox + mx, MY = oy + my;
  if (P.mouth === 'o') { pxc(MX, MY, 70, 30, 28); pxc(MX + 1, MY, 70, 30, 28); pxc(MX, MY + 1, 90, 40, 36); pxc(MX + 1, MY + 1, 90, 40, 36); }
  else if (P.mouth === 'smile') { pxc(MX - 3, MY - 1, 150, 82, 70); pxc(MX + 3, MY - 1, 150, 82, 70); }
  if (P.blush) { pxc(ox + I.eyes[0][0] - 1, oy + I.eyes[0][1] + 3, 214, 120, 104); pxc(ox + I.eyes[1][0] + 1, oy + I.eyes[1][1] + 3, 214, 120, 104); }
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
    const sx = cx + side * 12, sy = shY + 2, ar = a * Math.PI / 180, fr = (a + f) * Math.PI / 180, sg = side;
    const el = [sx + sg * Math.sin(ar) * 9, sy + Math.cos(ar) * 9], hd = [el[0] + sg * Math.sin(fr) * 9, el[1] + Math.cos(fr) * 9];
    limb(sx, sy, el[0], el[1], 2.4, 'skin', 'skinShade'); limb(el[0], el[1], hd[0], hd[1], 2.2, 'skin', 'skinShade');
    disc(hd[0], hd[1] + 0.5, 2.3, 'skin'); px(hd[0] + side, hd[1] + 1, 'skinShade'); px(hd[0] - side * 2, hd[1] - 1, 'skin');   // thumb
    // sleeve
    limb(sx, sy - 0.5, sx + sg * Math.sin(ar) * 4.5, sy + Math.cos(ar) * 4.5, 3.4, 'tee', side > 0 ? 'teeShade' : null);
  };
  leg(-1, P.lL, P.kL, P.liftL || 0); leg(1, P.lR, P.kR, P.liftR || 0);
  if (P.armsBehind) { arm(-1, P.aL, P.fL); arm(1, P.aR, P.fR); }
  // torso: tee with soft folds
  for (let y = shY; y <= hipY; y++) {
    const t = (y - shY) / (hipY - shY), half = Math.round(lerp(12, 9, Math.min(1, t * 1.6)) + (t > 0.85 ? 0.5 : 0));
    for (let x = -half; x <= half; x++) px(cx + x, y, x > half - 3 ? 'teeShade' : x > half - 1 ? 'teeDeep' : 'tee');
  }
  for (let y = shY + 6; y < hipY - 2; y += 4) px(cx + 3 + (y % 3), y, 'teeShade');   // fold hints
  rect(cx - 9, hipY - 1, 19, 2, 'jean'); rect(cx - 9, hipY - 1, 19, 1, 'belt');
  // neck + crew collar
  rect(hx - 3, headY + 9, 7, Math.max(2, shY - headY - 8), 'skin'); rect(hx + 1, headY + 9, 3, Math.max(2, shY - headY - 9), 'skinShade');
  for (let x = -4; x <= 4; x++) px(cx + x, shY + (Math.abs(x) < 3 ? 2 : 1), 'teeShade');
  if (!P.armsBehind) { arm(-1, P.aL, P.fL); arm(1, P.aR, P.fR); }
  if (HEAD) head(P, hx, headY); else ell(hx, headY, 8.6, 10.6, 'skin', 'skinShade', 0.55);
  outline();
}

// ---- stage, state, input
const T = { x: 0 };   // the sakura tree
const S = { x: 0, target: null, face: 1, mode: 'idle', mt: 0, t: 0, y: 0, vy: 0, last: performance.now(), lastInput: performance.now(), blink: 2, blinkOn: 0, look: 0, ptr: null, zs: [], dust: [], hearts: [], after: null, scale: 4, W: 0, H: 0 };
function layout() { const r = stage.getBoundingClientRect(); S.scale = r.width < 520 ? 2 : 3; S.W = Math.floor(r.width / S.scale); S.H = Math.floor(r.height / S.scale); cv.width = S.W; cv.height = S.H; cv.style.width = S.W * S.scale + 'px'; cv.style.height = S.H * S.scale + 'px'; if (!S.x) S.x = S.W * 0.36; T.x = Math.round(S.W * 0.74); }
layout(); addEventListener('resize', layout);
const set = m => { S.mode = m; S.mt = 0; };
const loc = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / S.scale, y: (e.clientY - r.top) / S.scale }; };
const onHim = p => Math.abs(p.x - S.x) < 14 && p.y > S.H - 6 - GY + 4 + S.y && p.y < S.H - 4;
function wake() { S.lastInput = performance.now(); if (S.mode === 'sleep') set('startle'); else if (S.mode === 'glance' || S.mode === 'yawn') set('idle'); }
stage.addEventListener('pointermove', e => { S.ptr = loc(e); wake(); });
stage.addEventListener('pointerleave', () => (S.ptr = null));
stage.addEventListener('pointerdown', e => {
  const p = loc(e); wake(); const gy = S.H - 6;
  if (onHim(p)) hop();
  else if (D && Math.abs(p.x - D.x) < 16 && p.y > gy - 34) go('pet');
  else if (Math.abs(p.x - T.x) < 60 && p.y < gy - 60) { pokeTree(); go('tree'); }
  else { S.after = null; S.target = clamp(p.x, 14, S.W - 14); set('walk'); }
});
// walk somewhere, then do something
function go(what) {
  S.lastInput = performance.now();
  if (what === 'pet' && D) { const side = S.x < D.x ? -1 : 1; S.target = clamp(D.x + side * 38, 16, S.W - 16); S.after = 'pet'; D.wait = true; }
  else if (what === 'tree' || what === 'nap') { S.target = T.x - 2; S.after = what === 'nap' ? 'nap' : 'sit'; }
  else return set(what);
  if (Math.abs(S.target - S.x) < 0.8) arrive(); else set('walk');
}
function arrive() {
  const a = S.after; S.after = null;
  if (a === 'pet') { set('pet'); if (D) D.face = S.x < D.x ? -1 : 1; S.face = -D.face; }
  else if (a === 'sit') set('sit'); else if (a === 'nap') { set('sit'); S.mt = 2.9; } else set('wave');
}
document.querySelectorAll('[data-pixel]').forEach(b => b.addEventListener('click', () => { S.lastInput = performance.now(); const a = b.dataset.pixel; a === 'hop' ? hop() : go(a); }));
function hop() { if (S.mode === 'crouch' || S.y < 0) return; set('crouch'); }

function step(dt) {
  S.t += dt; S.mt += dt; const idle = (performance.now() - S.lastInput) / 1000, m = S.mode;
  if (m === 'idle' && idle > 5 && S.mt > 2.5) set('glance');
  if (m === 'glance' && S.mt > 3) set(idle > 10 ? 'yawn' : 'idle');
  if (m === 'yawn' && S.mt > 2.4) { if (idle > 13) go('tree'); else set('idle'); }   // sleepy: off to the sakura
  if (m === 'sit' && S.mt > 6) set('sleep');
  if (m === 'pet' && S.mt > 4.5) { set('idle'); if (D) D.wait = false; if (D) D.happy = 1.5; }
  if (m === 'pet' && Math.random() < dt * 2.2) S.hearts.push({ x: (D ? D.x : S.x) + (Math.random() - 0.5) * 8, y: S.H - 6 - 40, l: 0 });
  if (m === 'startle' && S.mt > 0.6) set('wave');
  if (m === 'wave' && S.mt > 2) set('idle');
  if (m === 'dance' && S.mt > 6) set('idle');
  if (m === 'crouch' && S.mt > 0.14) { S.vy = -95; set('air'); }
  if (m === 'land' && S.mt > 0.25) set('idle');
  if (m === 'walk') { const dx = S.target - S.x; if (Math.abs(dx) < 0.6) { arrive(); } else { S.face = Math.sign(dx); const mv = clamp(dx, -26 * dt, 26 * dt); S.x += mv; S.walkPh = (S.walkPh || 0) + Math.abs(mv) / 9 * Math.PI; if (Math.floor(S.t * 8) % 4 === 0 && Math.random() < 0.3) S.dust.push({ x: S.x - S.face * 3, y: S.H - 5, l: 0 }); } }
  if (S.y < 0 || S.vy < 0) { S.vy += 380 * dt; S.y += S.vy * dt; if (S.y >= 0) { S.y = 0; S.vy = 0; set('land'); for (let i = 0; i < 5; i++) S.dust.push({ x: S.x + (i - 2) * 3, y: S.H - 5, l: 0 }); } }
  S.blink -= dt; if (S.blink < 0) { S.blinkOn = 0.12; S.blink = 2 + Math.random() * 3.5; }
  S.blinkOn -= dt;
  let lk = 0; if (S.ptr) lk = clamp((S.ptr.x - S.x) / 30, -1, 1); if (m === 'glance') lk = Math.sin(S.mt * 2.2) > 0 ? 1 : -1; if (m === 'walk') lk = S.face;
  S.look = lerp(S.look, lk, 1 - Math.pow(0.001, dt));
  if (m === 'sleep' && Math.random() < dt * 0.9) S.zs.push({ x: S.x + 10, y: S.H - 8 - 66, l: 0 });
  S.zs.forEach(z => { z.l += dt; z.y -= 6 * dt; z.x += Math.sin(z.l * 3) * 4 * dt; }); S.zs = S.zs.filter(z => z.l < 2.4);
  S.dust.forEach(d => { d.l += dt; }); S.dust = S.dust.filter(d => d.l < 0.4);
  S.hearts.forEach(h => { h.l += dt; h.y -= 9 * dt; h.x += Math.sin(h.l * 4) * 3 * dt; }); S.hearts = S.hearts.filter(h => h.l < 1.6);
  stepDog(dt); stepTree(dt);
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
  if (m === 'pet') {
    const st = Math.sin(mt * 5.5), side = D && D.x > S.x ? 1 : -1;
    P.bob = 15; P.lL = -42; P.kL = 42; P.lR = 42; P.kR = -42; P.liftL = 3; P.liftR = 3;   // squatting down to the dog
    if (side > 0) { P.aR = 66 + st * 5; P.fR = 30 + st * 14; P.aL = 20; P.fL = -30; } else { P.aL = 66 + st * 5; P.fL = 30 + st * 14; P.aR = 20; P.fR = -30; }   // stroking the head; other hand on the knee
    P.eyes = mt > 0.6 ? 'happy' : 'open'; P.mouth = 'smile'; P.blush = true; P.look = side; P.headDx = side;
  }
  if (m === 'glance') P.browUp = Math.sin(mt * 2.2) > 0.95 ? 1 : 0;
  if (S.blinkOn > 0 && P.eyes === 'open') P.eyes = 'closed';
  if (S.ptr && onHim(S.ptr) && (m === 'idle' || m === 'glance')) { P.eyes = 'happy'; P.mouth = 'smile'; P.blush = true; }
  return P;
}

// ---- the dog: the portfolio's own <pixel-dog> rottie, drawn from its rig (js/pixel-dog.js)
let D = null;
function dogInit() {
  const C = customElements.get('pixel-dog'); if (!C || !C.rig) return;
  const R = C.rig, V = Object.assign({}, R.BREEDS.rottie); V.m = R.PATTERNS[V.pattern] || {};
  const c = document.createElement('canvas'); c.width = R.DW; c.height = R.H;
  D = { R, V, pal: R.buildPal(V), L: R.mk(R.DW, R.H), tmp: new Uint8Array(R.DW * R.H), c, ctx: c.getContext('2d'), img: new ImageData(R.DW, R.H),
    x: S.x + 28, face: -1, mode: 'sit', mt: 0, ph: 0, wait: false, happy: 0, blink: 3 };
  D.u32 = new Uint32Array(D.img.data.buffer);
}
customElements.whenDefined('pixel-dog').then(dogInit);
function stepDog(dt) {
  if (!D) return; if (D.wait && S.mode !== 'pet' && S.after !== 'pet') D.wait = false; D.mt += dt; D.happy = Math.max(0, D.happy - dt); D.blink -= dt; if (D.blink < -0.15) D.blink = 2 + Math.random() * 4;
  const m = S.mode, atTree = (m === 'sit' || m === 'sleep') && Math.abs(S.x - (T.x - 2)) < 2;
  const tx = D.wait ? D.x : atTree ? T.x + 26 : S.x + (D.x >= S.x ? 42 : -42);
  const dx = tx - D.x;
  if (Math.abs(dx) > (D.mode === 'walk' ? 1 : 7)) {          // trot after me
    const mv = clamp(dx, -34 * dt, 34 * dt); D.x += mv; D.face = Math.sign(dx); D.ph += Math.abs(mv) / 6;
    if (D.mode !== 'walk') { D.mode = 'walk'; D.mt = 0; }
  } else {
    const want = atTree ? (m === 'sleep' ? 'sleep' : 'lie') : (D.mt > 9 && m === 'idle' ? 'lie' : 'sit');
    if (D.mode === 'walk') { D.mode = 'sit'; D.mt = 0; }
    else if (D.mode !== want && (want !== 'lie' || D.mt > 1.2)) { D.mode = want; D.mt = 0; }
    if (D.mode !== 'sleep') D.face = S.x > D.x ? 1 : -1;      // keeps an eye on me
  }
}
function dogPose() {
  const { R } = D, Q = R.poses, t = S.t, joy = S.mode === 'pet' || D.happy > 0;
  let P;
  if (D.mode === 'walk') { P = R.cp(Q.STAND); R.gait(P, D.ph, 3.4, 2.6, R.WALK_PH); P.tl[2] += Math.sin(t * 9) * 0.25; }
  else if (D.mode === 'lie') { P = R.cp(Q.LIE); P.tl[2] += Math.sin(t * 2) * 0.1; }
  else if (D.mode === 'sleep') P = R.cp(Q.SLEEP);
  else { P = R.cp(Q.SIT); P.tl[2] += Math.sin(t * (joy ? 13 : 3)) * (joy ? 0.35 : 0.1); }
  if (joy && D.mode === 'sit') { P.eye = 'happy'; P.blush = 1; P.mouth = 'pant'; P.hd[1] += S.mode === 'pet' ? 1 + (Math.sin(S.mt * 5.5) > 0 ? 1 : 0) : 0; }
  else if ((S.mode === 'dance' || S.mode === 'air') && D.mode === 'sit') { P.mouth = 'pant'; P.eye = 'happy'; }
  else if (D.blink < 0 && D.mode !== 'sleep') P.eye = 'blink';
  return P;
}
function drawDog(gy) {
  if (!D) return; const { R } = D;
  R.drawDog(D.L, dogPose(), D.V); R.outline(D.L, D.tmp);
  const b = D.L.b; for (let i = 0; i < b.length; i++) D.u32[i] = b[i] ? D.pal[b[i]] : 0;
  D.ctx.putImageData(D.img, 0, 0);
  out.save(); out.translate(Math.round(D.x), gy + 1 - R.G); if (D.face < 0) out.scale(-1, 1); out.drawImage(D.c, -R.X0, 0); out.restore();
  if (D.mode === 'sleep' && Math.random() < 0.012) S.zs.push({ x: D.x + D.face * 10, y: gy - 22, l: 0.6 });
}

// ---- the sakura: a pixel tree painted at my pixel size (tools/pixeltree.py), swaying, petals falling
let TR = null;
Promise.all([fetch('art/tree/tree.json').then(r => r.json()), ...['trunk', 'back', 'front'].map(n => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = `art/tree/${n}.png`; }))])
  .then(([info, trunk, back, front]) => { TR = { info, trunk, back, front, petals: [], ground: [], shake: 0, sv: 0 }; for (let i = 0; i < 26; i++) TR.ground.push({ x: (Math.random() - 0.5) * 120, c: Math.random() < 0.5 ? 0 : 1 }); });
const PET_C = ['#f19fb6', '#fbc8d4', '#dc7598'];
function stepTree(dt) {
  if (!TR) return; const I = TR.info;
  TR.sv += (-TR.shake * 60 - TR.sv * 6) * dt; TR.shake += TR.sv * dt;                       // springy shake when poked
  const wind = Math.sin(S.t * 0.4) * 6 + Math.sin(S.t * 1.3) * 3;
  if (Math.random() < dt * (1.6 + Math.abs(TR.sv) * 0.5) && TR.petals.length < 40) TR.petals.push({ x: T.x + (Math.random() - 0.5) * 130, y: S.H - 6 - (I.gy - I.crown[1]) + (Math.random() - 0.3) * 50, vx: 0, vy: 6 + Math.random() * 6, ph: Math.random() * 6, c: (Math.random() * 3) | 0, l: 0 });
  for (const p of TR.petals) { p.l += dt; p.ph += dt * 3; p.x += (wind + Math.sin(p.ph) * 10) * dt; p.y += p.vy * dt; }
  TR.petals = TR.petals.filter(p => { if (p.y >= S.H - 6) { if (TR.ground.length < 70) TR.ground.push({ x: p.x - T.x, c: p.c % 2 }); return false; } return p.x > -5 && p.x < S.W + 5; });
}
function pokeTree() { if (!TR) return; TR.sv += 9 * (Math.random() < 0.5 ? 1 : -1); for (let i = 0; i < 16; i++) TR.petals.push({ x: T.x + (Math.random() - 0.5) * 120, y: S.H - 6 - 110 + Math.random() * 60, vx: 0, vy: 8 + Math.random() * 8, ph: Math.random() * 6, c: (Math.random() * 3) | 0, l: 0 }); }
function drawTree(gy) {
  if (!TR) return; const I = TR.info, x0 = Math.round(T.x - I.cx), y0 = gy + 1 - I.gy;
  out.fillStyle = 'rgba(40,60,30,.22)'; for (let i = -62; i <= 62; i++) { const h = Math.round(2.4 * Math.sqrt(1 - (i / 63) ** 2)); out.fillRect(T.x + i, gy + 1, 1, h); }   // canopy shadow on the grass
  const sway = k => Math.round(Math.sin(S.t * 0.9 + k) * 0.8 + Math.sin(S.t * 0.37) * 0.5 + TR.shake * (1 + k));
  out.drawImage(TR.back, x0 + sway(0), y0); out.drawImage(TR.trunk, x0, y0); out.drawImage(TR.front, x0 + sway(0.7), y0 + (Math.abs(TR.shake) > 1 ? 1 : 0));
}
function drawPetals(gy) {
  if (!TR) return;
  for (const g of TR.ground) { out.fillStyle = PET_C[g.c]; out.fillRect(Math.round(T.x + g.x), gy + 1 + (g.c & 1), 1, 1); }
  for (const p of TR.petals) { out.fillStyle = PET_C[p.c]; const flip = Math.sin(p.ph) > 0; out.fillRect(Math.round(p.x), Math.round(p.y), flip ? 2 : 1, flip ? 1 : 2); }
}

// ---- render: ground, tree, dog, me, particles
const img = new ImageData(SW, SH), tmp = document.createElement('canvas'); tmp.width = SW; tmp.height = SH; const tctx = tmp.getContext('2d');
const HEART = ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'];
function render() {
  out.imageSmoothingEnabled = false; out.clearRect(0, 0, S.W, S.H);
  const gy = S.H - 6;
  drawTree(gy);
  // grass band (hides the floating island's underside and gives everyone a floor)
  const G = ['#6c9a48', '#58863c', '#4a7634', '#40692e', '#385e2a', '#33552a'];
  for (let y = gy + 1, i = 0; y < S.H; y++, i++) { out.fillStyle = G[Math.min(i, G.length - 1)]; out.fillRect(0, y, S.W, 1); }
  out.fillStyle = '#86b25a'; for (let x = (S.W * 7) % 5; x < S.W; x += 5) out.fillRect(x, gy, 1, 1);
  const lift = clamp(-S.y / 20, 0, 1), sw = Math.round(14 * (1 - lift * 0.5) * (S.mode === 'sit' || S.mode === 'sleep' ? 1.3 : 1));
  out.fillStyle = 'rgba(30,40,20,.25)'; out.fillRect(Math.round(S.x - sw / 2), gy + 1, sw, 1);
  drawPetals(gy);
  drawDog(gy);
  paint(pose()); img.data.set(buf); tctx.putImageData(img, 0, 0);
  out.drawImage(tmp, Math.round(S.x - SW / 2), Math.round(gy + 1 - GY + S.y));
  out.fillStyle = 'rgba(200,185,165,.8)'; for (const d of S.dust) { const r = d.l < 0.2 ? 1 : 2; out.fillRect(Math.round(d.x + (d.l * 10) * (d.x > S.x ? 1 : -1)), Math.round(d.y - d.l * 4), r, r); }
  out.fillStyle = '#e0607e';
  for (const h of S.hearts) { out.globalAlpha = Math.min(1, h.l * 4) * (1 - h.l / 1.6); HEART.forEach((row, j) => [...row].forEach((c, i) => c === 'x' && out.fillRect(Math.round(h.x) + i - 2, Math.round(h.y) + j, 1, 1))); }
  out.globalAlpha = 1; out.fillStyle = '#5b4a7a';
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
