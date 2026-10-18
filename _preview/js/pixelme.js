/*!
 * Pixel me — two small animated scenes with a full-body pixel-art Nikit.
 *   • Me & my dog: the homepage rottie (drawn from the <pixel-dog> rig, js/pixel-dog.js). I pet it,
 *     and throw a ball that it chases, picks up, brings back and drops at my feet.
 *   • Under the sakura: I sit against a pixel cherry tree (tools/pixeltree.py) watching petals fall,
 *     get drowsy, nod off; petals settle on my hair; tap to wake me or shake the tree.
 *   • Campfire, rainy street lamp, late-night coding, fishing at a Himalayan lake, stargazing, snow day.
 * The face is a symmetric 30×32 pixel portrait built from my painting (tools/pixelhead.py) and the
 * body uses the same skin colours; the body is painted pixel by pixel each frame from a pose.
 */
(() => {
'use strict';
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
  RGB.skin = info.skin; RGB.skinShade = info.skinShade; RGB.skinDeep = info.skinShade.map(v => Math.round(v * 0.8));   // body = face skin
});

// ---- sprite buffer
const SW = 64, SH = 100, GY = 92;      // sprite size, sole row (drawn on the ground)
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
    if (P.eyes === 'closed' || P.eyes === 'sleepy' || P.eyes === 'happy') {
      for (let i = -1; i <= 1; i++) { pxc(X + i, Y - 1, ...skinUnder); pxc(X + i, Y, ...skinUnder); }    // erase lid + eye
      if (P.eyes === 'closed') { pxc(X - 1, Y, 34, 24, 20); pxc(X, Y, 34, 24, 20); pxc(X + 1, Y, 34, 24, 20); }          // one closed line
      else if (P.eyes === 'sleepy') { for (let i = -1; i <= 1; i++) pxc(X + i, Y - 1, 34, 24, 20); pxc(X - 1, Y, 236, 226, 214); pxc(X, Y, 40, 22, 14); pxc(X + 1, Y, 236, 226, 214); }   // heavy lid, half-open
      else { pxc(X - 1, Y, 34, 24, 20); pxc(X, Y - 1, 34, 24, 20); pxc(X + 1, Y, 34, 24, 20); }   // ^ smiling eyes
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

// cross-legged: thighs out to the knees, shins crossed in front, shoes tucked under the opposite knee
function crossLegs(cx, hipY) {
  limb(cx + 3, hipY + 1, cx + 15, hipY + 6, 3.2, 'jean', 'jeanShade');               // right thigh (behind)
  limb(cx + 15, hipY + 7, cx - 4, hipY + 9, 3, 'jean', 'jeanShade');                 // right shin crossing left
  limb(cx - 3, hipY + 1, cx - 15, hipY + 6, 3.2, 'jean', 'jeanShade');               // left thigh
  limb(cx - 15, hipY + 7, cx + 4, hipY + 9, 3, 'jean', 'jeanShade');                 // left shin in front
  for (let i = 0; i <= 19; i++) px(cx - 15 + i, hipY + 6 + Math.round(i * 2 / 19), 'jeanDeep');   // fold where the shins cross
  for (const [x, f] of [[cx - 11, -1], [cx + 7, 1]]) { rect(x, hipY + 8, 5, 3, 'shoe'); rect(x + (f > 0 ? 3 : 0), hipY + 9, 2, 1, 'shoeShade'); rect(x, hipY + 10, 5, 1, 'sole'); }   // both shoes peek out
  px(cx - 15, hipY + 5, 'jeanDeep'); px(cx + 15, hipY + 5, 'jeanDeep');               // knees
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
    const el = [sx + sg * Math.sin(ar) * 10.5, sy + Math.cos(ar) * 10.5], hd = [el[0] + sg * Math.sin(fr) * 10, el[1] + Math.cos(fr) * 10];
    limb(sx, sy, el[0], el[1], 2.4, 'skin', 'skinShade'); limb(el[0], el[1], hd[0], hd[1], 2.2, 'skin', 'skinShade');
    const hx_ = Math.round(hd[0]), hy_ = Math.round(hd[1]); rect(hx_ - 1, hy_ - 1, 4, 4, 'skin'); rect(hx_ - 1, hy_ + 2, 4, 1, 'skinShade'); px(hx_ + (side > 0 ? 3 : -1), hy_, 'skinShade'); px(hx_ - side * 2 + (side > 0 ? 0 : 1), hy_ - 1, 'skin');   // hand + thumb
    // sleeve
    limb(sx, sy - 0.5, sx + sg * Math.sin(ar) * 4.5, sy + Math.cos(ar) * 4.5, 3.4, 'tee', side > 0 ? 'teeShade' : null);
  };
  if (P.cross) crossLegs(cx, hipY); else { leg(-1, P.lL, P.kL, P.liftL || 0); leg(1, P.lR, P.kR, P.liftR || 0); }
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

// ---------------------------------------------------------------- shared bits
const ME_TMP = document.createElement('canvas'); ME_TMP.width = SW; ME_TMP.height = SH; const meCtx = ME_TMP.getContext('2d'), meImg = new ImageData(SW, SH);
function drawMe(ctx, x, gy, P, lift = 0) { paint(P); meImg.data.set(buf); meCtx.putImageData(meImg, 0, 0); ctx.drawImage(ME_TMP, Math.round(x - SW / 2), Math.round(gy + 1 - GY - lift)); }
function handPos(P, x, gy, side) {   // screen position of a hand (side -1 = left, 1 = right) for a pose drawn with drawMe/drawMeT at (x, gy)
  const cx = 32 + (P.dx || 0), shY = 34 + (P.bob || 0), sx = cx + side * 12, sy = shY + 2, a = (side < 0 ? P.aL : P.aR) * Math.PI / 180, f = (side < 0 ? P.fL : P.fR) * Math.PI / 180;
  const ex = sx + side * Math.sin(a) * 10.5, ey = sy + Math.cos(a) * 10.5, hx = ex + side * Math.sin(a + f) * 10, hy = ey + Math.cos(a + f) * 10;
  return [Math.round(x - SW / 2) + Math.round(hx) + 1, Math.round(gy + 1 - GY) + Math.round(hy) + 1];
}
// two-bone IK: set an arm's angles so its hand lands on a screen point (same maths as paint/handPos)
function reach(P, x, gy, side, tx, ty) {
  const L1 = 10.5, L2 = 10, cx = 32 + (P.dx || 0), shY = 34 + (P.bob || 0);
  const sx = Math.round(x - SW / 2) + cx + side * 12 + 1, sy = Math.round(gy + 1 - GY) + shY + 2 + 1;
  let ox = (tx - sx) * side, oy = ty - sy, d = Math.hypot(ox, oy); const k = Math.min(1, (L1 + L2 - 0.05) / Math.max(d, 1e-3)); ox *= k; oy *= k; d = Math.min(d, L1 + L2 - 0.05);
  const th = Math.atan2(ox, oy), al = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)))), be = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2))));
  const a = (th + al) * 180 / Math.PI, f = -(Math.PI - be) * 180 / Math.PI;
  if (side < 0) { P.aL = a; P.fL = f; } else { P.aR = a; P.fR = f; }
  return P;
}
function basePose(t) {
  return { dx: 0, bob: Math.sin(t * 2.4) > 0.6 ? -1 : 0, headDx: 0, headDy: 0, lL: 0, lR: 0, kL: 0, kR: 0, aL: 8, aR: 8, fL: 6, fR: 6,
    liftL: 0, liftR: 0, sway: Math.sin(t * 1.8) * 0.8, eyes: 'open', look: 0, browUp: 0, mouth: 'line', blush: false, armsBehind: false };
}
const sitPose = (P, t) => { P.bob = 22; P.cross = true; P.aL = 26; P.aR = 26; P.fL = -22; P.fR = -22; return P; };   // hands resting on the thighs
const BLADES = []; for (let i = 0; i < 900; i++) { const r = Math.sin(i * 12.9898) * 43758.5453; const f = r - Math.floor(r), g = (Math.sin(i * 78.233) * 9631.4) % 1; BLADES.push({ x: i * 0.83 + f * 0.6, h: 1 + Math.floor(Math.abs(g) * 4), c: Math.floor(f * 4), ph: f * 6 }); }
function grass(ctx, W, H, gy, t = 0) {
  const G = ['#6c9a48', '#5a8a3e', '#4c7a35', '#426c30', '#3a612c', '#33552a'];
  for (let y = gy + 1, i = 0; y < H; y++, i++) { ctx.fillStyle = G[Math.min(i, G.length - 1)]; ctx.fillRect(0, y, W, 1); }
  // texture in the turf
  ctx.fillStyle = '#7aa850'; for (let x = 1; x < W; x += 7) ctx.fillRect(x, gy + 2 + (x % 3), 1, 1);
  ctx.fillStyle = '#3e6630'; for (let x = 4; x < W; x += 9) ctx.fillRect(x, gy + 3 + (x % 2), 2, 1);
  // blades along the top, leaning in the breeze
  const BC = ['#86b85a', '#6ea24a', '#5a8f40', '#9cc868'];
  for (const b of BLADES) { if (b.x > W) break; const lean = b.h >= 3 ? Math.round(Math.sin(t * 1.6 + b.x * 0.15 + b.ph) * 0.8) : 0; ctx.fillStyle = BC[b.c];
    for (let k = 0; k < b.h; k++) ctx.fillRect(Math.round(b.x) + (k === b.h - 1 ? lean : 0), gy - k, 1, 1); }
  // a few little flowers
  for (let x = 13; x < W; x += 41) { ctx.fillStyle = '#6ea24a'; ctx.fillRect(x, gy - 1, 1, 2); ctx.fillStyle = x % 2 ? '#fff6d8' : '#f6d25a'; ctx.fillRect(x - 1, gy - 2, 3, 1); ctx.fillRect(x, gy - 3, 1, 3); ctx.fillStyle = '#e6a63a'; ctx.fillRect(x, gy - 2, 1, 1); }
}
const HEART = ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'];
function heart(ctx, x, y) { HEART.forEach((r, j) => [...r].forEach((c, i) => c === 'x' && ctx.fillRect(Math.round(x) + i - 2, Math.round(y) + j, 1, 1))); }
function zee(ctx, x, y, sz) { x = Math.round(x); y = Math.round(y); ctx.fillRect(x, y, sz, 1); ctx.fillRect(x + sz - 2, y + 1, 1, 1); if (sz > 3) ctx.fillRect(x + 1, y + 2, 1, 1); ctx.fillRect(x, y + sz - 1, sz, 1); }
const ease = t => t * t * (3 - 2 * t);

// a pixel stage: canvas + crisp scaling + a loop that only runs while visible
function Stage(el, update, opt = {}) {
  const cv = document.createElement('canvas'); el.appendChild(cv); const ctx = cv.getContext('2d');
  const st = { el, cv, ctx, W: 0, H: 0, scale: 3, t: 0 };
  st.layout = () => { const r = el.getBoundingClientRect(); st.scale = r.width < 520 ? 2 : r.width >= 900 ? (opt.scale || 3) : 3; st.W = Math.floor(r.width / st.scale); st.H = Math.floor(r.height / st.scale); cv.width = st.W; cv.height = st.H; cv.style.width = st.W * st.scale + 'px'; cv.style.height = st.H * st.scale + 'px'; st.onLayout && st.onLayout(); };
  st.local = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / st.scale, y: (e.clientY - r.top) / st.scale }; };
  let vis = false, last = 0, acc = 0;
  const loop = now => { if (!vis) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; st.t += dt; update(dt); acc += dt; if (acc >= 1 / 30 || reduce) { acc = 0; ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, st.W, st.H); st.render(); } requestAnimationFrame(loop); };
  new IntersectionObserver(e => { vis = e[0].isIntersecting; if (vis) { last = performance.now(); requestAnimationFrame(loop); } }, { threshold: 0.05 }).observe(el);
  addEventListener('resize', st.layout); requestAnimationFrame(st.layout);
  return st;
}

// tinted / rotated versions of me (firelight, moonlight, lying on the grass)
function meLayer(P, tint) { paint(P); meImg.data.set(buf); meCtx.putImageData(meImg, 0, 0); if (tint) { meCtx.globalCompositeOperation = 'source-atop'; meCtx.fillStyle = tint; meCtx.fillRect(0, 0, SW, SH); meCtx.globalCompositeOperation = 'source-over'; } return ME_TMP; }
function drawMeT(ctx, x, gy, P, tint) { ctx.drawImage(meLayer(P, tint), Math.round(x - SW / 2), Math.round(gy + 1 - GY)); }
function drawMeLying(ctx, x, y, P, tint) { const L = meLayer(P, tint); ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(-Math.PI / 2); ctx.drawImage(L, -SW / 2, -GY + 6); ctx.restore(); }
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
// vertical gradient in hard pixel bands, dithered where bands meet
function skyBands(ctx, W, y0, y1, cols) {
  const n = cols.length - 1;
  for (let y = y0; y < y1; y++) { const f = (y - y0) / Math.max(1, y1 - y0) * n, i = Math.min(n - 1, Math.floor(f)), fr = f - i;
    for (let x = 0; x < W; x++) { const th = BAYER4[(y & 3) * 4 + (x & 3)] / 16; ctx.fillStyle = fr > th ? cols[i + 1] : cols[i]; ctx.fillRect(x, y, 1, 1); } }
}
function hills(ctx, W, base, amp, col, seed, freq = 0.03) { ctx.fillStyle = col; for (let x = 0; x < W; x++) { const h = Math.round(amp * (0.55 + 0.3 * Math.sin(x * freq + seed) + 0.15 * Math.sin(x * freq * 2.7 + seed * 3))); ctx.fillRect(x, base - h, 1, h + 400); } }
function cache(st, key, draw) { const k = key + st.W + 'x' + st.H; if (st._c && st._k === k) return st._c; const c = document.createElement('canvas'); c.width = st.W; c.height = st.H; const x = c.getContext('2d'); draw(x); st._c = c; st._k = k; return c; }
const STARS = []; for (let i = 0; i < 260; i++) { const a = Math.sin(i * 91.7) * 9631.1, b = Math.sin(i * 17.3) * 3141.6; STARS.push({ x: a - Math.floor(a), y: b - Math.floor(b), p: (i * 0.37) % 6.28, big: i % 23 === 0 }); }
function stars(ctx, W, H, t, maxY, dim = 1) { for (const s of STARS) { const y = s.y * maxY; if (y > maxY) continue; const tw = 0.55 + 0.45 * Math.sin(t * 2 + s.p * 3); ctx.globalAlpha = tw * dim; ctx.fillStyle = s.big ? '#fff6d8' : '#dfe6ff'; const x = Math.round(s.x * W); ctx.fillRect(x, Math.round(y), 1, 1); if (s.big && tw > 0.8) { ctx.fillRect(x - 1, Math.round(y), 3, 1); ctx.fillRect(x, Math.round(y) - 1, 1, 3); } } ctx.globalAlpha = 1; }
// draw an image row by row, bending more toward the top (rooted at rootY): trees, grass, curtains
function bendDraw(ctx, img, x0, y0, rootY, bend) { for (let y = 0; y < img.height; y++) { const k = y >= rootY ? 0 : Math.pow((rootY - y) / rootY, 1.4); ctx.drawImage(img, 0, y, img.width, 1, x0 + Math.round(bend * k), y0 + y, img.width, 1); } }

// ---------------------------------------------------------------- the dog (rig from js/pixel-dog.js)
function makeDog() {
  const C = customElements.get('pixel-dog'); if (!C || !C.rig) return null;
  const R = C.rig, V = Object.assign({}, R.BREEDS.rottie); V.m = R.PATTERNS[V.pattern] || {};
  const c = document.createElement('canvas'); c.width = R.DW; c.height = R.H; const img = new ImageData(R.DW, R.H);
  const d = { R, V, pal: R.buildPal(V), L: R.mk(R.DW, R.H), tmp: new Uint8Array(R.DW * R.H), c, cx: c.getContext('2d'), img, u32: new Uint32Array(img.data.buffer) };
  d.draw = (ctx, x, gy, face, P) => {
    R.drawDog(d.L, P, d.V); R.outline(d.L, d.tmp);
    const b = d.L.b; for (let i = 0; i < b.length; i++) d.u32[i] = b[i] ? d.pal[b[i]] : 0;
    d.cx.putImageData(d.img, 0, 0);
    ctx.save(); ctx.translate(Math.round(x), gy + 1 - R.G); if (face < 0) ctx.scale(-1, 1); ctx.drawImage(c, -R.X0, 0); ctx.restore();
  };
  return d;
}

// ---------------------------------------------------------------- scene 1: me & my dog
(function dogScene() {
  const el = document.getElementById('dogStage'); if (!el) return;
  let DOG = null; customElements.whenDefined('pixel-dog').then(() => (DOG = makeDog()));
  const me = { x: 0, mode: 'idle', mt: 0, blink: 2, look: 1 };
  const dog = { x: 0, face: -1, mode: 'sit', mt: 0, ph: 0, blink: 3, hasBall: false, tilt: 0 };
  const ball = { on: false, x: 0, y: 0, vx: 0, vy: 0, held: true, ground: false };
  const hearts = [], dust = [];
  let lastAct = 0, nextAuto = 'fetch';
  const S = Stage(el, update, { scale: 4 });
  S.onLayout = () => { me.x = Math.round(S.W * 0.3); if (!dog.x || dog.mode === "sit") dog.x = me.x + 46; };
  const gy = () => S.H - 6, home = () => me.x + 46;
  const setMe = m => { me.mode = m; me.mt = 0; }, setDog = m => { dog.mode = m; dog.mt = 0; };
  const busy = () => me.mode !== 'idle' || (dog.mode !== 'sit' && dog.mode !== 'happy');
  function pet() { if (busy()) return; setMe('pet'); setDog('pet'); lastAct = S.t; }
  function throwBall(tx) { if (busy()) return; ball.tx = Math.max(me.x + 70, Math.min(S.W - 40, tx || S.W * 0.8)); setMe('throw'); lastAct = S.t; }
  el.addEventListener('pointerdown', e => { const p = S.local(e); if (Math.abs(p.x - dog.x) < 18 && p.y > gy() - 44) pet(); else throwBall(p.x); });
  document.querySelectorAll('[data-dog]').forEach(b => b.addEventListener('click', () => (b.dataset.dog === 'pet' ? pet() : throwBall())));

  function update(dt) {
    const t = S.t; me.mt += dt; dog.mt += dt;
    me.blink -= dt; if (me.blink < -0.12) me.blink = 2 + Math.random() * 3.5;
    dog.blink -= dt; if (dog.blink < -0.15) dog.blink = 2.5 + Math.random() * 4;
    // ---- me
    if (me.mode === 'throw') {
      if (me.mt > 0.42 && ball.held) {   // release: from the raised hand, up and over in an arc
        ball.held = false; ball.on = true; ball.ground = false; { const [hx, hy] = handPos(mePose(), me.x, gy(), 1); ball.x = hx; ball.y = hy - 2; }
        const T = 0.9; ball.vx = (ball.tx - ball.x) / T; ball.vy = -60; setDog('chase');
      }
      if (me.mt > 0.9) setMe('watch');
    }
    if (me.mode === 'pet' && me.mt > 3.4) { setMe('idle'); setDog('happy'); }
    if (me.mode === 'pickup' && me.mt > 0.9) { setMe('idle'); ball.on = false; ball.held = true; }
    if (me.mode === 'idle' && t - lastAct > 7) { nextAuto === 'fetch' ? throwBall() : pet(); nextAuto = nextAuto === 'fetch' ? 'pet' : 'fetch'; }
    if (me.mode === 'pet' && Math.random() < dt * 2.4) hearts.push({ x: dog.x - 8 + Math.random() * 8, y: gy() - 48, l: 0 });
    // ---- ball physics
    if (ball.on && !ball.held && !dog.hasBall && !ball.ground) {
      ball.vy += 150 * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.y >= gy() - 2) { ball.y = gy() - 2; ball.vy *= -0.42; ball.vx *= 0.6; dust.push({ x: ball.x, l: 0 }); if (Math.abs(ball.vy) < 12) { ball.ground = true; ball.vy = 0; } }
      ball.x = Math.min(S.W - 4, ball.x);
    }
    if (ball.ground && !dog.hasBall) ball.x += ball.vx * dt, ball.vx *= Math.pow(0.05, dt);
    // ---- dog
    const runTo = (tx, sp) => { const dx = tx - dog.x; if (Math.abs(dx) < 1.5) return true; dog.face = Math.sign(dx); const mv = Math.max(-sp * dt, Math.min(sp * dt, dx)); dog.x += mv; dog.ph += Math.abs(mv) / (sp > 60 ? 9 : 6); return false; };
    if (dog.mode === 'chase' && dog.mt > 0.15) { const target = ball.x - 13; if (runTo(target, 92) && ball.ground) setDog('pick'); else if (dog.mt > 0.15 && Math.random() < dt * 8) dust.push({ x: dog.x - dog.face * 8, l: 0 }); }
    if (dog.mode === 'pick' && dog.mt > 0.45) { dog.hasBall = true; ball.on = false; setDog('return'); }
    if (dog.mode === 'return') { if (runTo(home(), 80)) { dog.face = -1; setDog('present'); } }
    if (dog.mode === 'present' && dog.mt > 1.1) { dog.hasBall = false; ball.on = true; ball.ground = true; ball.held = false; ball.vx = 0; ball.x = dog.x - 15; ball.y = gy() - 2; setDog('sit'); setMe('pickup'); }
    if (dog.mode === 'happy' && dog.mt > 1.6) setDog('sit');
    if (dog.mode === 'sit' && Math.abs(dog.x - home()) > 2) setDog('return');
    if (me.mode === 'watch' && dog.mode === 'present') setMe('idle');
    // look
    const lk = me.mode === 'watch' || dog.mode === 'chase' || dog.mode === 'return' ? Math.sign(dog.x - me.x) : 1;
    me.look += (lk - me.look) * Math.min(1, dt * 6);
    for (const h of hearts) { h.l += dt; h.y -= 9 * dt; h.x += Math.sin(h.l * 4) * 3 * dt; } while (hearts.length && hearts[0].l > 1.6) hearts.shift();
    for (const d of dust) d.l += dt; while (dust.length && dust[0].l > 0.4) dust.shift();
  }
  function mePose() {
    const t = S.t, mt = me.mt, P = basePose(t); P.look = me.look; P.eyes = me.blink < 0 ? 'closed' : 'open';
    if (me.mode === 'pet') {
      const st = Math.sin(mt * 5.5);
      P.bob = 15; P.lL = -42; P.kL = 42; P.lR = 42; P.kR = -42; P.liftL = 3; P.liftR = 3;          // squat, feet planted
      reach(P, me.x, gy(), 1, dog.x - 12 + Math.round(st * 3), gy() - 40 + (st > 0.3 ? 1 : 0)); P.aL = 24; P.fL = -40;   // stroke along the dog's head; other hand on the knee
      P.eyes = mt > 0.5 ? 'happy' : 'open'; P.mouth = 'smile'; P.blush = true; P.headDx = 1;
    }
    if (me.mode === 'throw') {   // wind up overhead, then throw forward and follow through
      const u = mt / 0.42;
      if (u < 1) { P.aR = 30 + ease(u) * 140; P.fR = 10 + ease(u) * 30; P.bob = Math.round(ease(u) * 2); P.lL = -6; P.lR = 6; }
      else { const v = Math.min(1, (mt - 0.42) / 0.25); P.aR = 170 - ease(v) * 120; P.fR = 40 - v * 50; P.bob = -1; P.lR = 10; P.kR = -10; }
      P.aL = 20; P.mouth = 'smile'; P.look = 1;
    }
    if (me.mode === 'watch') { P.mouth = 'smile'; if (Math.floor(mt * 3) % 4 === 0) P.browUp = 1; }
    if (me.mode === 'pickup') { const u = Math.sin(Math.min(1, mt / 0.9) * Math.PI); P.bob = Math.round(u * 15); P.lL = -42 * u; P.kL = 42 * u; P.lR = 42 * u; P.kR = -42 * u; P.liftL = P.liftR = 3 * u; if (u > 0.2) reach(P, me.x, gy(), 1, ball.x, gy() - 2 - (mt > 0.45 ? (mt - 0.45) * 30 : 0)); P.mouth = 'smile'; }
    if (me.mode === 'idle' && dog.mode === 'happy') { P.mouth = 'smile'; P.eyes = 'happy'; }
    return P;
  }
  function dogPose() {
    const R = DOG.R, Q = R.poses, t = S.t, mt = dog.mt; let P;
    switch (dog.mode) {
      case 'chase': case 'return':
        P = R.cp(Q.STAND); R.gait(P, dog.ph, 6, 4, R.RUN_PH); P.b[4] = Math.sin(dog.ph + 0.6) * 0.08; P.ears = [-2.5, 2, -2, 2]; P.tl[4] = 0.6; P.mouth = dog.hasBall ? 'ball' : 'pant';
        if (dog.mode === 'chase' && mt < 0.15) { P = R.cp(Q.STAND); P.ears = [0.5, -1.5, 0.5, -1.5]; } break;
      case 'pick': P = R.cp(Q.SNIFF); if (mt > 0.3) P.mouth = 'ball'; break;
      case 'present': P = R.cp(Q.SIT); P.mouth = 'ball'; P.tl[2] += Math.sin(t * 13) * 0.35; P.eye = 'happy'; break;
      case 'pet': P = R.cp(Q.SIT); P.eye = 'happy'; P.blush = 1; P.mouth = 'pant'; P.hd[1] += Math.sin(dog.mt * 5.5) > 0 ? 1 : 0; P.tl[2] += Math.sin(t * 13) * 0.35; break;
      case 'happy': P = R.cp(Q.BOW); P.mouth = 'pant'; P.eye = 'happy'; P.tl[2] += Math.sin(t * 15) * 0.4; break;
      default: P = R.cp(Q.SIT); P.tl[2] += Math.sin(t * 3) * 0.1; if (dog.blink < 0) P.eye = 'blink'; if (me.mode === 'throw') { P.ears = [0.5, -1.5, 0.5, -1.5]; P.hd[1] -= 1; }
    }
    return P;
  }
  S.render = () => {
    const c = S.ctx, g = gy();
    c.drawImage(cache(S, 'park', x => { skyBands(x, S.W, 0, g, ['#e7eef2', '#eef0ea', '#f2ece0']); hills(x, S.W, g - 8, 22, '#cfdcc2', 7, 0.018); hills(x, S.W, g, 12, '#b4caa0', 3, 0.03);
      for (let i = 0; i < 9; i++) { const tx = Math.round((i + 0.3) * S.W / 9), r = 7 + (i * 5) % 6; x.fillStyle = '#6a4a32'; x.fillRect(tx, g - 14, 2, 10); x.fillStyle = i % 2 ? '#8fb070' : '#7aa060'; x.beginPath(); x.ellipse(tx + 1, g - 16 - r * 0.5, r, r * 0.8, 0, 0, 7); x.fill(); x.fillStyle = '#a6c484'; x.beginPath(); x.ellipse(tx - 1, g - 18 - r * 0.6, r * 0.5, r * 0.4, 0, 0, 7); x.fill(); }
      x.fillStyle = '#c9a77c'; for (let fx = 2; fx < S.W; fx += 10) { x.fillRect(fx, g - 13, 2, 13); x.fillStyle = '#e0c49a'; x.fillRect(fx, g - 13, 1, 13); x.fillStyle = '#c9a77c'; } x.fillRect(0, g - 11, S.W, 2); x.fillRect(0, g - 6, S.W, 2); x.fillStyle = '#e0c49a'; x.fillRect(0, g - 11, S.W, 1); x.fillRect(0, g - 6, S.W, 1); }), 0, 0);
    grass(c, S.W, S.H, g, S.t);
    c.fillStyle = 'rgba(20,35,15,.3)'; c.fillRect(me.x - 8, g + 1, 16, 1); c.fillRect(me.x - 5, g + 2, 10, 1); c.fillRect(Math.round(dog.x) - 14, g + 1, 24, 1);
    if (DOG) DOG.draw(c, dog.x, g, dog.face, dogPose());
    drawMe(c, me.x, g, mePose());
    if (me.mode === 'pickup' && me.mt > 0.45) { const [hx, hy] = handPos(mePose(), me.x, g, 1); ball.x = hx; ball.y = hy - 1; }
    if (me.mode === 'throw' && ball.held) { const [hx, hy] = handPos(mePose(), me.x, g, 1); c.fillStyle = '#4e5a1c'; c.fillRect(hx - 2, hy - 3, 4, 4); c.fillStyle = '#d4e24a'; c.fillRect(hx - 1, hy - 2, 2, 2); }
    if (ball.on) { const bx = Math.round(ball.x), by = Math.round(ball.y); c.fillStyle = '#4e5a1c'; c.fillRect(bx - 2, by - 1, 4, 3); c.fillRect(bx - 1, by - 2, 2, 5); c.fillStyle = '#d4e24a'; c.fillRect(bx - 1, by - 1, 2, 3); c.fillRect(bx - 1, by - 1, 2, 2); c.fillStyle = '#f2f7b0'; c.fillRect(bx - 1, by - 1, 1, 1); }
    c.fillStyle = 'rgba(200,185,165,.85)'; for (const d of dust) c.fillRect(Math.round(d.x + d.l * 12 * (Math.random() < 0.5 ? 1 : -1)), Math.round(g - d.l * 5), d.l < 0.2 ? 1 : 2, d.l < 0.2 ? 1 : 2);
    c.fillStyle = '#e0607e'; for (const h of hearts) { c.globalAlpha = Math.min(1, h.l * 4) * (1 - h.l / 1.6); heart(c, h.x, h.y); } c.globalAlpha = 1;
  };
})();

// ---------------------------------------------------------------- scene 2: under the sakura
(function treeScene() {
  const el = document.getElementById('treeStage'); if (!el) return;
  let TR = null;
  Promise.all([fetch('art/tree/tree.json').then(r => r.json()), ...['trunk', 'back', 'front'].map(n => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = `art/tree/${n}.png`; }))])
    .then(([info, trunk, back, front]) => (TR = { info, trunk, back, front }));
  const me = { mode: 'sit', mt: 0, blink: 2, look: 0, nod: 0 };
  const petals = [], ground = [], onHair = [], zs = [];
  let shake = 0, sv = 0, lastPoke = -9, tx = 0, gust = 0, gustT = 4;
  const PC = ['#f19fb6', '#fbc8d4', '#dc7598'];
  const S = Stage(el, update);
  S.onLayout = () => { tx = Math.round(S.W * 0.58); };
  const gy = () => S.H - 6, meX = () => tx - 24, headY = () => gy() + 1 - GY + 22 + 20;   // sitting head centre
  const set = m => { me.mode = m; me.mt = 0; };
  function spawn(n, spread) { for (let i = 0; i < n; i++) petals.push({ x: tx + (Math.random() - 0.5) * 150, y: gy() - 150 + Math.random() * spread, vy: 7 + Math.random() * 7, ph: Math.random() * 6, c: (Math.random() * 3) | 0 }); }
  function poke() { sv += 9 * (Math.random() < 0.5 ? 1 : -1); spawn(22, 60); lastPoke = S.t; onHair.length = 0; if (me.mode === 'sleep' || me.mode === 'drowsy') set('wake'); else set('lookup'); }
  function nap() { if (me.mode === 'sleep') return; set('drowsy'); me.mt = 3.5; }
  el.addEventListener('pointerdown', e => { const p = S.local(e); if (me.mode === 'sleep' || me.mode === 'drowsy') { set('wake'); return; } if (Math.abs(p.x - tx) < 85 && p.y < gy() - 80) poke(); else set('wave'); });
  document.querySelectorAll('[data-tree]').forEach(b => b.addEventListener('click', () => (b.dataset.tree === 'shake' ? poke() : nap())));

  function update(dt) {
    const t = S.t; me.mt += dt; me.blink -= dt; if (me.blink < -0.12) me.blink = 2 + Math.random() * 3.5;
    sv += (-shake * 60 - sv * 6) * dt; shake += sv * dt;
    gustT -= dt; if (gustT < 0) { gust = 1; gustT = 6 + Math.random() * 8; } gust *= Math.pow(0.35, dt);   // every so often the breeze picks up
    const wind = Math.sin(t * 0.4) * 6 + Math.sin(t * 1.3) * 3 + gust * 18;
    if (Math.random() < dt * (1.5 + gust * 10) && petals.length < 60) spawn(1, 50);
    for (const p of petals) { p.ph += dt * 3; p.x += (wind + Math.sin(p.ph) * 10) * dt; p.y += p.vy * dt; }
    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i], hx = meX(), hy = headY() - 14;
      if (Math.abs(p.x - hx) < 9 && Math.abs(p.y - hy) < 2 && onHair.length < 4 && Math.random() < 0.5) { onHair.push({ dx: Math.round(p.x - hx), dy: Math.round(p.y - hy), c: p.c }); petals.splice(i, 1); continue; }
      if (p.y >= gy()) { if (ground.length < 80) ground.push({ x: p.x, c: p.c % 2 }); petals.splice(i, 1); }
      else if (p.x < -4 || p.x > S.W + 4) petals.splice(i, 1);
    }
    // the afternoon: sit and watch → drowsy → asleep
    if (me.mode === 'sit' && me.mt > 8) set('drowsy');
    if (me.mode === 'drowsy' && me.mt > 6) set('sleep');
    if ((me.mode === 'wake' || me.mode === 'lookup') && me.mt > 2.2) set('sit');
    if (me.mode === 'wave' && me.mt > 1.6) set('sit');
    if (me.mode === 'sit' && me.mt > 3 && !me.catchP && Math.random() < dt * 0.25) { const p = petals.find(q => Math.abs(q.x - (meX() + 16)) < 14 && q.y < headY() - 4 && q.y > headY() - 40); if (p) { me.catchP = p; me.catchT = 0; } }
    if (me.catchP) { me.catchT += dt; if (me.catchT > 2.6) me.catchP = null; else if (me.catchT > 0.55 && petals.includes(me.catchP)) { petals.splice(petals.indexOf(me.catchP), 1); me.held = me.catchP.c; } }   // the hand reaches it: caught
    if (me.mode === 'sleep' && Math.random() < dt * 0.8) zs.push({ x: meX() + 12, y: headY() - 18, l: 0 });
    for (const z of zs) { z.l += dt; z.y -= 6 * dt; z.x += Math.sin(z.l * 3) * 4 * dt; } while (zs.length && zs[0].l > 2.4) zs.shift();
    // eyes follow a petal while awake
    let lk = 0; if (me.mode === 'sit' && petals.length) { const p = petals.reduce((a, b) => (Math.abs(b.y - headY()) < Math.abs(a.y - headY()) ? b : a)); lk = Math.max(-1, Math.min(1, (p.x - meX()) / 30)); }
    me.look += (lk - me.look) * Math.min(1, dt * 3);
  }
  function mePose() {
    const t = S.t, mt = me.mt, P = sitPose(basePose(t), t); P.look = me.look; P.eyes = me.blink < 0 ? 'closed' : 'open';
    if (me.mode === 'drowsy') { P.eyes = me.blink < 0.6 ? 'closed' : 'sleepy'; const nod = (mt % 2.2) < 0.5; P.headDy = nod ? 1 : 0; me.blink = Math.min(me.blink, 1.2); }
    if (me.mode === 'sleep') { P.eyes = 'closed'; P.headDy = 1; P.headDx = 1; P.bob = 22 + (Math.sin(t * 1.4) > 0.3 ? 0 : 1); P.sway = 1.5; P.aL = 22; P.aR = 22; P.fL = -12; P.fR = -12; }
    if (me.mode === 'wake') { if (mt < 0.5) { P.eyes = 'open'; P.browUp = 1; P.mouth = 'o'; P.bob = 21; } else { P.mouth = 'smile'; P.eyes = mt < 1.4 ? 'happy' : P.eyes; } }
    if (me.mode === 'lookup') { P.browUp = 1; P.mouth = mt < 0.8 ? 'o' : 'smile'; P.look = 0; P.eyes = mt > 0.8 && mt < 1.6 ? 'happy' : 'open'; }
    if (me.mode === 'wave') { P.aR = 150; P.fR = [10, 28, 44, 28][Math.floor(mt * 10) % 4]; P.eyes = 'happy'; P.mouth = 'smile'; P.blush = true; }
    if (me.mode === 'sit') P.mouth = 'line';
    if (me.mode === 'sit' && me.catchP) {   // reach for a falling petal, then look at it in my palm
      const p = me.catchP, u = Math.min(1, me.catchT / 0.5), down = Math.max(0, (me.catchT - 1.3) / 0.9);
      const tx2 = petals.includes(p) ? p.x : meX() + 16, ty2 = petals.includes(p) ? Math.max(p.y, headY() - 10) : headY() + 8 + down * 14;
      reach(P, meX(), gy(), 1, meX() + 12 + (tx2 - meX() - 12) * u, headY() + 22 + (ty2 - headY() - 22) * u); P.look = 1; P.browUp = petals.includes(p) ? 1 : 0; if (!petals.includes(p)) { P.mouth = 'smile'; P.eyes = 'happy'; }
    }
    return P;
  }
  S.render = () => {
    const c = S.ctx, g = gy();
    c.drawImage(cache(S, 'day', x => { skyBands(x, S.W, 0, g, ['#f6e7e4', '#f3e2dc', '#eedfd2', '#e9e2cf']); hills(x, S.W, g - 4, 26, '#cfd6c0', 2, 0.02); hills(x, S.W, g + 1, 14, '#b9c9a6', 5, 0.035); }), 0, 0);
    if (TR) {
      const I = TR.info, x0 = Math.round(tx - I.cx), y0 = g + 1 - I.gy;
      const bend = Math.sin(S.t * 0.9) * 1.1 + Math.sin(S.t * 0.37) * 0.6 + gust * 3 + shake;
      bendDraw(c, TR.back, x0, y0, I.crownBot + 6, bend * 0.8); c.drawImage(TR.trunk, x0, y0);
      grass(c, S.W, S.H, g, S.t);
      c.fillStyle = 'rgba(40,60,30,.22)'; for (let i = -70; i <= 70; i++) c.fillRect(tx + i, g + 1, 1, Math.round(2.6 * Math.sqrt(1 - (i / 71) ** 2)));
      for (const [dx, dy, k] of I.carpet) { c.fillStyle = `rgb(${I.petals[(k - 5) % 4]})`; c.fillRect(tx + dx, g + 1 + Math.max(0, dy), 1, 1); }
      for (const p of ground) { c.fillStyle = PC[p.c]; c.fillRect(Math.round(p.x), g + 1 + (p.c & 1), 1, 1); }
      const MP = mePose(); drawMe(c, meX(), g, MP);
      if (me.catchP && !petals.includes(me.catchP)) { const [hx, hy] = handPos(MP, meX(), g, 1); c.fillStyle = PC[me.held || 0]; c.fillRect(hx - 1, hy - 3, 2, 1); }
      for (const h of onHair) { c.fillStyle = PC[h.c]; c.fillRect(meX() + h.dx, headY() - 14 + h.dy + (me.mode === 'sleep' ? 1 : 0), 2, 1); }
      bendDraw(c, TR.front, x0, y0, I.crownBot + 6, bend);
    } else { grass(c, S.W, S.H, g, S.t); drawMe(c, meX(), g, mePose()); }
    for (const p of petals) { c.fillStyle = PC[p.c]; const f = Math.sin(p.ph) > 0; c.fillRect(Math.round(p.x), Math.round(p.y), f ? 2 : 1, f ? 1 : 2); }
    c.fillStyle = '#5b4a7a'; for (const z of zs) { c.globalAlpha = Math.min(1, z.l * 3) * (1 - z.l / 2.4); zee(c, z.x, z.y, z.l > 1.2 ? 4 : 3); } c.globalAlpha = 1;
  };
})();

// ================================================================ more scenes
const rnd = Math.random, clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
function ring(ctx, cx, cy, rx, ry, col, steps = 5, a0 = 0.22, add = false) {   // stepped radial glow (pixel-style light pool)
  if (add) ctx.globalCompositeOperation = 'lighter';
  for (let i = steps; i >= 1; i--) { const f = i / steps; ctx.globalAlpha = a0 * (1 - f) + 0.02; ctx.fillStyle = col;
    for (let y = -Math.ceil(ry * f); y <= ry * f; y++) { const w = Math.round(rx * f * Math.sqrt(Math.max(0, 1 - (y / (ry * f)) ** 2))); ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); } }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function pine(ctx, x, base, h, col, snow) { for (let y = 0; y < h; y++) { const w = Math.round((y / h) * h * 0.32 * (1 + ((y % 6) < 2 ? 0.25 : 0))); ctx.fillStyle = col; ctx.fillRect(x - w, base - h + y, w * 2 + 1, 1); if (snow && (y % 6) === 0 && y > 2) { ctx.fillStyle = snow; ctx.fillRect(x - w, base - h + y, w * 2 + 1, 1); } } ctx.fillStyle = col; ctx.fillRect(x - 1, base, 3, 3); }

// ---------------------------------------------------------------- campfire under the stars
(function campfire() {
  const el = document.getElementById('fireStage'); if (!el) return;
  const S = Stage(el, update, { scale: 4 }); let fx = 0, flare = 0, toast = 0, mall = 1, blink = 2;
  const flames = [], embers = [], smoke = [];
  S.onLayout = () => { fx = Math.round(S.W * 0.56); };
  const gy = () => S.H - 6, meX = () => fx - 34;
  el.addEventListener('pointerdown', () => { flare = 1; for (let i = 0; i < 22; i++) embers.push({ x: fx + (rnd() - 0.5) * 8, y: gy() - 8, vx: (rnd() - 0.5) * 30, vy: -30 - rnd() * 40, l: 0 }); });
  document.querySelectorAll('[data-fire]').forEach(b => b.addEventListener('click', () => { if (b.dataset.fire === 'new') { toast = 0; mall = 1; } else el.dispatchEvent(new PointerEvent('pointerdown')); }));
  function update(dt) {
    flare *= Math.pow(0.3, dt); blink -= dt; if (blink < -0.12) blink = 2 + rnd() * 3;
    if (mall) { toast += dt * (0.05 + flare * 0.4); if (toast > 1.2) { mall = 0; setTimeout(() => { toast = 0; mall = 1; }, 2600); } }
    const n = 6 + Math.round(flare * 8); for (let i = 0; i < n; i++) flames.push({ x: fx + (rnd() - 0.5) * (14 + flare * 6), y: gy() - 4, vy: -(18 + rnd() * 22) * (1 + flare), l: 0, max: 0.45 + rnd() * 0.4 });
    for (const f of flames) { f.l += dt; f.y += f.vy * dt; f.x += Math.sin(f.l * 20 + f.y) * 6 * dt + (fx - f.x) * dt * 2.5; }
    for (let i = flames.length - 1; i >= 0; i--) if (flames[i].l > flames[i].max) flames.splice(i, 1);
    if (rnd() < dt * 4) embers.push({ x: fx + (rnd() - 0.5) * 6, y: gy() - 10, vx: (rnd() - 0.5) * 8, vy: -16 - rnd() * 14, l: 0 });
    for (const e of embers) { e.l += dt; e.x += (e.vx + Math.sin(e.l * 5) * 6) * dt; e.y += e.vy * dt; e.vy *= Math.pow(0.7, dt); } while (embers.length && embers[0].l > 2.2) embers.shift();
    if (rnd() < dt * 2) smoke.push({ x: fx, y: gy() - 26, l: 0, r: 2 }); for (const s of smoke) { s.l += dt; s.y -= 8 * dt; s.x += Math.sin(s.l * 1.5) * 5 * dt + 3 * dt; s.r += dt * 2; } while (smoke.length && smoke[0].l > 4) smoke.shift();
  }
  const FL = ['#fff4c2', '#ffd45a', '#ff9a2e', '#e8501e', '#a8281e'];
  S.render = () => {
    const c = S.ctx, g = gy(), t = S.t, flick = 0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 7.3) + flare * 0.4;
    c.drawImage(cache(S, 'night', x => { skyBands(x, S.W, 0, g, ['#0c1028', '#141a3c', '#22244e', '#3a2f5c']); x.fillStyle = '#f2ecd2'; const mx = Math.round(S.W * 0.82); x.beginPath(); x.arc(mx, 22, 8, 0, 7); x.fill(); x.fillStyle = '#1b2042'; x.beginPath(); x.arc(mx + 4, 20, 7, 0, 7); x.fill();
      hills(x, S.W, g - 18, 18, '#1a1f3a', 4, 0.02); for (let i = 0; i < 16; i++) pine(x, Math.round(i * S.W / 15 + (i % 3) * 5), g - 6 - (i % 2) * 4, 22 + (i * 7) % 14, '#111530'); }), 0, 0);
    stars(c, S.W, S.H, t, g - 40, 0.9);
    // ground lit by the fire
    for (let y = g + 1; y < S.H; y++) { c.fillStyle = ['#1e2a1c', '#1a2418', '#162014'][Math.min(2, y - g - 1)] || '#141c12'; c.fillRect(0, y, S.W, 1); }
    c.globalCompositeOperation = 'lighter';   // firelight: many faint warm discs = a smooth falloff
    for (let i = 10; i >= 1; i--) { const f = i / 10; c.globalAlpha = 0.045; c.fillStyle = '#ff7a20'; c.beginPath(); c.ellipse(fx, g - 10, 64 * f * flick, 46 * f * flick, 0, 0, 7); c.fill(); }
    for (let i = 6; i >= 1; i--) { const f = i / 6; c.globalAlpha = 0.07; c.fillStyle = '#ffb050'; c.fillRect(Math.round(fx - 74 * f * flick), g + 1, Math.round(148 * f * flick), 2); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    // logs and stones
    c.fillStyle = '#3a2216'; c.fillRect(fx - 13, g - 3, 26, 4); c.fillStyle = '#6b4128'; c.fillRect(fx - 12, g - 4, 11, 3); c.fillRect(fx + 2, g - 2, 12, 3); c.fillStyle = '#c86a2a'; c.fillRect(fx - 3, g - 2, 6, 1);
    for (let i = -3; i <= 3; i++) { c.fillStyle = i % 2 ? '#5a5a62' : '#74747e'; c.fillRect(fx + i * 5 - 2, g - 1, 4, 3); }
    // smoke, flames, embers
    for (const s of smoke) { c.globalAlpha = 0.1 * (1 - s.l / 4); c.fillStyle = '#8a90a8'; c.fillRect(Math.round(s.x - s.r / 2), Math.round(s.y), Math.round(s.r), 1); c.fillRect(Math.round(s.x - s.r / 3), Math.round(s.y) - 1, Math.round(s.r * 0.66), 1); } c.globalAlpha = 1;
    for (const f of flames) { const k = f.l / f.max; c.fillStyle = FL[Math.min(4, Math.floor(k * 5))]; const sz = k < 0.35 ? 3 : k < 0.65 ? 2 : 1; c.fillRect(Math.round(f.x), Math.round(f.y), sz, sz); }
    c.fillStyle = '#fff4c2'; c.fillRect(fx - 2, g - 6, 4, 3); c.fillStyle = '#ffd45a'; c.fillRect(fx - 4, g - 4, 8, 2);
    for (const e of embers) { c.fillStyle = e.l < 1 ? '#ffd45a' : '#ff7a2e'; c.globalAlpha = 1 - e.l / 2.2; c.fillRect(Math.round(e.x), Math.round(e.y), 1, 1); } c.globalAlpha = 1;
    // me, toasting a marshmallow, warm firelight on one side
    const P = sitPose(basePose(t), t); reach(P, meX(), g, 1, meX() + 22, g - 34 + Math.round(Math.sin(t * 2) * 1)); P.aL = 26; P.fL = -22; P.look = 1; P.eyes = blink < 0 ? 'closed' : 'open'; P.mouth = toast > 0.7 && toast < 1 ? 'smile' : !mall ? 'o' : 'line';
    drawMeT(c, meX(), g, P, `rgba(255,140,60,${(0.1 + 0.08 * flick).toFixed(3)})`);
    const [hx, hy] = handPos(P, meX(), g, 1), ex = fx - 3, ey = g - 19 + Math.round(Math.sin(t * 2) * 1); c.fillStyle = '#7a5236'; const n_ = Math.max(Math.abs(ex - hx), Math.abs(ey - hy)); for (let i = 0; i <= n_; i++) c.fillRect(Math.round(hx + (ex - hx) * i / n_), Math.round(hy + (ey - hy) * i / n_), 1, 1);
    if (mall) { const tc = toast < 0.5 ? '#fbf6ea' : toast < 0.85 ? '#e8b46a' : toast < 1.05 ? '#a8642e' : '#3a2418'; c.fillStyle = '#2a1d18'; c.fillRect(ex - 2, ey - 2, 5, 5); c.fillStyle = tc; c.fillRect(ex - 1, ey - 1, 3, 3); c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(ex - 1, ey - 1, 1, 1); }
  };
})();

// ---------------------------------------------------------------- rainy night under the street lamp
(function rain() {
  const el = document.getElementById('rainStage'); if (!el) return;
  const S = Stage(el, update, { scale: 4 }); let lx = 0, flash = 0, startle = 0, blink = 2;
  const drops = [], splashes = [], rings = [];
  const WIN = []; for (let i = 0; i < 160; i++) WIN.push({ on: rnd() < 0.55, t: rnd() * 20 });
  S.onLayout = () => { lx = Math.round(S.W * 0.6); };
  const gy = () => S.H - 10, meX = () => lx - 46;
  el.addEventListener('pointerdown', () => { flash = 1; startle = 0.6; });
  document.querySelectorAll('[data-rain]').forEach(b => b.addEventListener('click', () => el.dispatchEvent(new PointerEvent('pointerdown'))));
  function update(dt) {
    flash *= Math.pow(0.05, dt); startle = Math.max(0, startle - dt); blink -= dt; if (blink < -0.12) blink = 2 + rnd() * 3;
    for (let i = 0; i < 5; i++) drops.push({ x: rnd() * (S.W + 40) - 20, y: -4, v: 110 + rnd() * 40 });
    for (const d of drops) { d.y += d.v * dt; d.x -= d.v * 0.18 * dt; }
    for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i], ux = meX() + 12, inU = Math.abs(d.x - ux) < 27 && d.y > gy() - 112 && d.y < gy() - 106;
      if (inU || d.y > gy()) { splashes.push({ x: d.x, y: inU ? gy() - 106 + Math.round(Math.abs(d.x - ux) / 6) : gy() + 1, l: 0 }); if (!inU && rnd() < 0.3) rings.push({ x: d.x, y: gy() + 3 + (rnd() * 4 | 0), l: 0 }); drops.splice(i, 1); } }
    for (const s of splashes) s.l += dt; while (splashes.length && splashes[0].l > 0.2) splashes.shift();
    for (const r of rings) r.l += dt; while (rings.length && rings[0].l > 0.8) rings.shift();
    for (const w of WIN) { w.t -= dt; if (w.t < 0) { w.on = !w.on; w.t = 5 + rnd() * 25; } }
  }
  S.render = () => {
    const c = S.ctx, g = gy(), t = S.t;
    c.drawImage(cache(S, 'rain', x => { skyBands(x, S.W, 0, g, ['#141a2e', '#1c2440', '#28304e', '#353a58']);
      for (let i = 0, bx = 0; bx < S.W; i++) { const w = 14 + (i * 7) % 16, h = 30 + (i * 13) % 46; x.fillStyle = i % 2 ? '#1d2236' : '#22283e'; x.fillRect(bx, g - h, w, h); bx += w + 2; } }), 0, 0);
    // windows flicker on and off
    let k = 0; for (let i = 0, bx = 0; bx < S.W; i++) { const w = 14 + (i * 7) % 16, h = 30 + (i * 13) % 46; for (let y = g - h + 4; y < g - 6; y += 5) for (let x = bx + 2; x < bx + w - 2; x += 4) { const W2 = WIN[k++ % WIN.length]; if (W2.on) { c.fillStyle = (k % 5) ? '#f2c66a' : '#9ad0ff'; c.fillRect(x, y, 2, 2); } } bx += w + 2; }
    // wet street, lamp reflection
    for (let y = g + 1; y < S.H; y++) { c.fillStyle = y % 2 ? '#20263a' : '#252c42'; c.fillRect(0, y, S.W, 1); }
    for (let y = g + 1; y < S.H; y++) { c.globalAlpha = 0.5 * (1 - (y - g) / 10); c.fillStyle = '#ffd68a'; c.fillRect(lx - 2 + Math.round(Math.sin(t * 3 + y) * 1), y, 4, 1); } c.globalAlpha = 1;
    // lamp: post, head, cone of light
    c.fillStyle = '#2a2e3e'; c.fillRect(lx, g - 92, 3, 92); c.fillRect(lx - 6, g - 94, 14, 3); c.fillStyle = '#3c4256'; c.fillRect(lx - 1, g - 92, 1, 92);
    c.fillStyle = '#ffe6a8'; c.fillRect(lx - 4, g - 91, 10, 2);
    ring(c, lx + 1, g - 88, 6, 4, '#fff1c4', 3, 0.6);
    for (let y = 0; y < 86; y++) { const w = Math.round(4 + y * 0.42); c.globalAlpha = 0.07 + 0.05 * (y / 86); c.fillStyle = '#ffd98e'; c.fillRect(lx + 1 - w, g - 88 + y, w * 2, 1); } c.globalAlpha = 1;
    ring(c, lx + 1, g + 1, 40, 4, '#ffd98e', 4, 0.3);
    // me with the umbrella
    const P = basePose(t); P.aR = 40; P.fR = -110; P.look = startle > 0 ? 0 : -0.4; P.eyes = blink < 0 ? 'closed' : 'open'; if (startle > 0) { P.browUp = 1; P.mouth = 'o'; P.eyes = 'open'; }
    drawMeT(c, meX(), g, P, 'rgba(40,60,120,0.22)');
    const [ux, hyU] = handPos(P, meX(), g, 1), uy = g - 95; c.fillStyle = '#2a1d18'; c.fillRect(ux, uy, 1, hyU - uy + 4); c.fillRect(ux - 1, hyU + 3, 3, 1);
    for (let y = 0; y < 10; y++) { const w = Math.round(28 * Math.sqrt(1 - ((10 - y) / 10.5) ** 2)); c.fillStyle = y < 2 ? '#e05656' : y > 7 ? '#8e2630' : '#c43a42'; c.fillRect(ux - w, uy - 10 + y, w * 2 + 1, 1); }
    c.fillStyle = '#6e1e26'; for (let i = -3; i <= 3; i++) c.fillRect(ux + i * 8, uy - 1, 1, 2); c.fillStyle = '#2a1d18'; c.fillRect(ux, uy - 12, 1, 2);
    // rain, splashes, ripples
    c.fillStyle = 'rgba(170,190,230,0.55)'; for (const d of drops) { c.fillRect(Math.round(d.x), Math.round(d.y), 1, 3); }
    c.fillStyle = 'rgba(200,215,240,0.7)'; for (const s of splashes) { const r = 1 + Math.round(s.l * 10); c.fillRect(Math.round(s.x - r), Math.round(s.y) - 1, 1, 1); c.fillRect(Math.round(s.x + r), Math.round(s.y) - 1, 1, 1); }
    c.fillStyle = 'rgba(160,180,220,0.35)'; for (const r of rings) { const w = Math.round(1 + r.l * 6); c.globalAlpha = 1 - r.l / 0.8; c.fillRect(Math.round(r.x - w), r.y, w * 2, 1); } c.globalAlpha = 1;
    if (flash > 0.02) { c.fillStyle = `rgba(230,236,255,${(flash * 0.7).toFixed(3)})`; c.fillRect(0, 0, S.W, S.H); }
  };
})();

// ---------------------------------------------------------------- late-night coding
(function desk() {
  const el = document.getElementById('deskStage'); if (!el) return;
  const S = Stage(el, update, { scale: 4 }); let dx = 0, mode = 'type', mt = 0, blink = 2, win = 0, nextSip = 6;
  const steam = [], confetti = [], code = [];
  for (let i = 0; i < 14; i++) code.push({ w: 3 + (rnd() * 14 | 0), ind: (rnd() * 3 | 0) * 3, c: ['#7ad3ff', '#f2c66a', '#c38aff', '#8ee08a', '#e8e8f0'][i % 5] });
  S.onLayout = () => { dx = Math.round(S.W * 0.5); };
  const gy = () => S.H - 6;
  el.addEventListener('pointerdown', () => { mode = 'yay'; mt = 0; win = 1; for (let i = 0; i < 40; i++) confetti.push({ x: dx + (rnd() - 0.5) * 20, y: gy() - 60, vx: (rnd() - 0.5) * 70, vy: -40 - rnd() * 50, c: ['#f2c66a', '#e05656', '#7ad3ff', '#8ee08a', '#c38aff'][i % 5], l: 0 }); });
  document.querySelectorAll('[data-desk]').forEach(b => b.addEventListener('click', () => el.dispatchEvent(new PointerEvent('pointerdown'))));
  function update(dt) {
    mt += dt; blink -= dt; if (blink < -0.12) blink = 2 + rnd() * 3; win = Math.max(0, win - dt * 0.3); nextSip -= dt;
    if (mode === 'type' && nextSip < 0) { mode = rnd() < 0.5 ? 'sip' : 'stretch'; mt = 0; nextSip = 7 + rnd() * 6; }
    if ((mode === 'sip' && mt > 2.2) || (mode === 'stretch' && mt > 2.4) || (mode === 'yay' && mt > 2.2)) { mode = 'type'; mt = 0; }
    if (mode === 'type' && rnd() < dt * 3) { code.push(code.shift()); }
    if (rnd() < dt * 3) steam.push({ x: dx + 34, y: gy() - 38, l: 0 }); for (const s of steam) { s.l += dt; s.y -= 7 * dt; s.x += Math.sin(s.l * 4) * 3 * dt; } while (steam.length && steam[0].l > 1.8) steam.shift();
    for (const p of confetti) { p.l += dt; p.vy += 90 * dt; p.x += p.vx * dt; p.y += p.vy * dt; } while (confetti.length && confetti[0].l > 2.5) confetti.shift();
  }
  S.render = () => {
    const c = S.ctx, g = gy(), t = S.t;
    c.drawImage(cache(S, 'room', x => { x.fillStyle = '#2a2440'; x.fillRect(0, 0, S.W, S.H); for (let y = 0; y < S.H; y += 6) { x.fillStyle = '#2f2848'; x.fillRect(0, y, S.W, 1); }
      const wx = Math.round(S.W * 0.12), ww = 70, wh = 56; x.fillStyle = '#1a1530'; x.fillRect(wx - 3, 14, ww + 6, wh + 6); skyBands(x, ww, 0, 0, []); x.fillStyle = '#0f1430'; x.fillRect(wx, 17, ww, wh);
      x.fillStyle = '#f2ecd2'; x.beginPath(); x.arc(wx + 52, 30, 5, 0, 7); x.fill(); for (let i = 0; i < 9; i++) { x.fillStyle = '#1b2244'; const h = 8 + (i * 7) % 16; x.fillRect(wx + i * 8, 17 + wh - h, 7, h); }
      x.fillStyle = '#3a3256'; x.fillRect(wx + ww / 2 - 1, 17, 2, wh); x.fillRect(wx, 17 + wh / 2, ww, 2);
      x.fillStyle = '#4a3a2c'; x.fillRect(S.W - 60, 30, 40, 3); x.fillStyle = '#7a5236'; for (let i = 0; i < 5; i++) x.fillRect(S.W - 58 + i * 7, 20 + (i % 2) * 2, 5, 10 - (i % 2) * 2);   // shelf + books
      x.fillStyle = '#1a1530'; x.fillRect(Math.round(S.W * 0.4), 18, 30, 40); x.fillStyle = '#e05656'; x.fillRect(Math.round(S.W * 0.4) + 2, 20, 26, 36); x.fillStyle = '#f2c66a'; x.beginPath(); x.arc(Math.round(S.W * 0.4) + 15, 34, 7, 0, 7); x.fill(); x.fillStyle = '#2a1530'; x.fillRect(Math.round(S.W * 0.4) + 4, 44, 22, 2); x.fillRect(Math.round(S.W * 0.4) + 4, 48, 14, 2);
      x.fillStyle = '#3a6a3a'; x.fillRect(S.W - 30, 22, 6, 8); x.fillStyle = '#5a9a4a'; x.fillRect(S.W - 32, 18, 4, 5); x.fillRect(S.W - 26, 17, 4, 6); }), 0, 0);
    // me, seated behind the desk, lit by the screen
    const P = basePose(t); P.eyes = blink < 0 ? 'closed' : 'open'; P.look = 0;
    if (mode === 'type') { const a = Math.floor(t * 9) % 2, b2 = Math.floor(t * 4.5) % 3; reach(P, dx - 4, g + 4, -1, dx - 2 - 10 + b2, g - 35 - (a ? 1 : 0)); reach(P, dx - 4, g + 4, 1, dx - 2 + 9 - b2, g - 35 - (a ? 0 : 1)); }   // fingers on the keys, tapping
    if (mode === 'sip') { reach(P, dx - 4, g + 4, -1, dx - 6, g - 58 + Math.round(Math.sin(Math.min(1, mt / 2.2) * Math.PI) * -2)); reach(P, dx - 4, g + 4, 1, dx + 7, g - 35); P.aL = 34; P.fL = -60; P.eyes = mt > 0.6 && mt < 1.6 ? 'closed' : P.eyes; }
    if (mode === 'stretch') { const u = Math.sin(Math.min(1, mt / 2.4) * Math.PI); P.aL = P.aR = 30 + u * 140; P.fL = P.fR = -40 + u * 30; P.mouth = u > 0.5 ? 'o' : 'line'; P.eyes = u > 0.5 ? 'closed' : P.eyes; }
    if (mode === 'yay') { P.aL = P.aR = 155; P.fL = P.fR = Math.sin(mt * 18) * 20; P.eyes = 'happy'; P.mouth = 'smile'; P.blush = true; }
    ring(c, dx, g - 52, 40, 26, win > 0 ? '#8ee08a' : '#7ab8ff', 4, 0.1);
    c.fillStyle = '#3a2c46'; c.fillRect(dx - 16, g - 52, 32, 26); c.fillStyle = '#463656'; c.fillRect(dx - 16, g - 52, 32, 2);   // chair back
    drawMeT(c, dx - 4, g + 4, P, `rgba(${win > 0 ? '120,255,160' : '110,170,255'},0.12)`);
    if (mode === 'sip') { const [hx, hy] = handPos(P, dx - 4, g + 4, -1); c.fillStyle = '#e8e2d4'; c.fillRect(hx - 4, hy - 6, 7, 7); c.fillStyle = '#c9c2b2'; c.fillRect(hx + 3, hy - 4, 2, 3); }
    // desk with drawers, monitor turned toward us, keyboard, mug, lamp, a sleeping cat
    c.fillStyle = '#6b4a32'; c.fillRect(dx - 64, g - 30, 128, 4); c.fillStyle = '#86603e'; c.fillRect(dx - 64, g - 30, 128, 1);
    c.fillStyle = '#4e3524'; c.fillRect(dx - 62, g - 26, 124, S.H - g + 26); c.fillStyle = '#5a3e2a'; c.fillRect(dx - 58, g - 22, 54, 10); c.fillRect(dx + 4, g - 22, 54, 10); c.fillStyle = '#c9a46a'; c.fillRect(dx - 33, g - 18, 4, 1); c.fillRect(dx + 29, g - 18, 4, 1);
    // seen from the front: me, then the keyboard by my hands, then the monitor (its back to us) nearest the viewer.
    // The screen sits on a tall neck so the keyboard shows through the gap under it; a real keyboard is a bit narrower than the screen.
    const mx = dx - 2, my = g - 55, kw = 26, ky = g - 34;
    c.fillStyle = '#1c1a24'; c.fillRect(mx - kw / 2, ky + 2, kw, 1);                                   // keyboard shadow on the desk
    c.fillStyle = '#9a9aa8'; c.fillRect(mx - kw / 2, ky, kw, 2); c.fillStyle = '#c8c8d2'; c.fillRect(mx - kw / 2, ky, kw, 1);
    c.fillStyle = '#7a7a88'; for (let i = 0; i < 8; i++) c.fillRect(mx - kw / 2 + 1 + i * 3, ky + 1, 2, 1);
    if (mode === 'type') { const k = Math.floor(t * 9) % 8; c.fillStyle = '#7ab8ff'; c.fillRect(mx - kw / 2 + 1 + k * 3, ky + 1, 2, 1); }   // the key being pressed
    ring(c, mx, my - 6, 34, 22, win > 0 ? '#1a4a20' : '#10304a', 5, 0.55, true);           // its screen lights my face
    c.fillStyle = '#2a2836'; c.fillRect(mx - 15, my, 30, 19); c.fillStyle = '#3a3848'; c.fillRect(mx - 15, my, 30, 1); c.fillRect(mx - 15, my, 1, 19);
    c.fillStyle = win > 0 ? '#8ee08a' : '#7ab8ff'; c.fillRect(mx - 16, my + 1, 1, 17); c.fillRect(mx + 15, my + 1, 1, 17); c.fillRect(mx - 14, my - 1, 28, 1);   // screen glow around the edges
    c.fillStyle = '#4a4858'; c.fillRect(mx - 3, my + 7, 6, 4);                                      // VESA plate
    c.fillStyle = '#23212e'; c.fillRect(mx, my + 19, 2, g - 31 - (my + 19)); c.fillRect(mx - 5, g - 31, 12, 1);   // neck in front of the keyboard, foot on the desk
    // what's on screen, shown as a small window on the wall behind me
    const px = Math.round(S.W * 0.58), py = 14; c.fillStyle = 'rgba(14,18,34,0.92)'; c.fillRect(px, py, 50, 36); c.fillStyle = '#3a3256'; c.fillRect(px, py, 50, 4);
    code.slice(0, 7).forEach((l, i) => { c.fillStyle = win > 0 && i === 6 ? '#8ee08a' : l.c; c.fillRect(px + 3 + l.ind, py + 7 + i * 4, Math.min(42 - l.ind, l.w * 2), 1); });
    if (Math.floor(t * 2) % 2) { c.fillStyle = '#e8e8f0'; c.fillRect(px + 3, py + 34, 2, 1); }
    if (mode !== 'sip') { c.fillStyle = '#e8e2d4'; c.fillRect(dx - 34, g - 38, 8, 8); c.fillStyle = '#c9c2b2'; c.fillRect(dx - 27, g - 36, 2, 4); c.fillStyle = '#4a2c1c'; c.fillRect(dx - 33, g - 37, 6, 1); }   // mug (in my hand while sipping)
    c.fillStyle = '#2a2836'; c.fillRect(dx - 58, g - 31, 8, 1); c.fillRect(dx - 55, g - 52, 2, 21); c.fillRect(dx - 55, g - 53, 12, 2); c.fillStyle = '#e0a83a'; c.fillRect(dx - 46, g - 54, 8, 4);   // desk lamp
    ring(c, dx - 42, g - 34, 26, 8, '#5a3a10', 4, 0.6, true);
    const cb = Math.sin(t * 1.3) > 0 ? 0 : 1; c.fillStyle = '#2a2430'; c.fillRect(dx - 62, g - 37 + cb, 14, 7 - cb); c.fillRect(dx - 64, g - 35, 3, 5); c.fillStyle = '#3a3242'; c.fillRect(dx - 61, g - 36 + cb, 10, 2);   // cat, breathing
    c.fillStyle = '#2a2430'; c.fillRect(dx - 66, g - 35, 2, 2); c.fillRect(dx - 65, g - 37, 1, 2); c.fillRect(dx - 62, g - 37, 1, 1); const tf = Math.floor(t * 1.5) % 4 === 0 ? 1 : 0; c.fillRect(dx - 48, g - 32 - tf, 5, 2);
    c.fillStyle = 'rgba(230,230,240,0.45)'; for (const s2 of steam) { c.globalAlpha = 0.5 * (1 - s2.l / 1.8); c.fillRect(Math.round(s2.x - 64), Math.round(s2.y), 1, 2); } c.globalAlpha = 1;
    for (const p of confetti) { c.fillStyle = p.c; c.fillRect(Math.round(p.x), Math.round(p.y), 2, 1); }
  };
})();

// ---------------------------------------------------------------- fishing at a Himalayan lake
(function fishing() {
  const el = document.getElementById('fishStage'); if (!el) return;
  const S = Stage(el, update, { scale: 4 }); let mode = 'wait', mt = 0, blink = 2, bob = 0, nextBite = 5 + rnd() * 5, fish = null, catches = 0;
  const ripples = [], drops = [];
  const gy = () => S.H - 6, wy = () => Math.round(S.H * 0.62), dockEnd = () => Math.round(S.W * 0.42), meX = () => dockEnd() - 18, bobX = () => Math.round(S.W * 0.7);
  const reel = () => { if (mode === 'bite' || mode === 'wait') { mode = 'reel'; mt = 0; fish = { x: bobX(), y: wy(), l: 0 }; } };
  el.addEventListener('pointerdown', reel); document.querySelectorAll('[data-fish]').forEach(b => b.addEventListener('click', reel));
  function update(dt) {
    mt += dt; blink -= dt; if (blink < -0.12) blink = 2 + rnd() * 3; nextBite -= dt;
    if (mode === 'wait' && nextBite < 0) { mode = 'bite'; mt = 0; }
    if (mode === 'bite' && mt > 2.2) { mode = 'wait'; nextBite = 4 + rnd() * 6; }
    if (mode === 'reel' && mt > 1.6) { mode = 'release'; mt = 0; catches++; }
    if (mode === 'release' && mt > 1.4) { mode = 'wait'; nextBite = 5 + rnd() * 6; fish = null; }
    if (rnd() < dt * (mode === 'bite' ? 5 : 0.8)) ripples.push({ x: bobX(), l: 0 });
    for (const r of ripples) r.l += dt; while (ripples.length && ripples[0].l > 1.4) ripples.shift();
    for (const d of drops) { d.l += dt; d.vy += 120 * dt; d.x += d.vx * dt; d.y += d.vy * dt; } while (drops.length && drops[0].l > 1) drops.shift();
    if (fish) { fish.l += dt; if (mode === 'reel') { const u = Math.min(1, mt / 1.6); fish.x = bobX() + (meX() + 30 - bobX()) * u; fish.y = wy() - Math.sin(u * Math.PI) * 40; if (mt < 0.1) for (let i = 0; i < 10; i++) drops.push({ x: bobX(), y: wy(), vx: (rnd() - 0.5) * 40, vy: -50 - rnd() * 30, l: 0 }); }
      else { const u = Math.min(1, mt / 1); fish.x = meX() + 30 + u * 30; fish.y = wy() - 40 + u * u * 40 + Math.sin(u * 3) * 0; if (u >= 1 && !fish.sp) { fish.sp = 1; for (let i = 0; i < 8; i++) drops.push({ x: fish.x, y: wy(), vx: (rnd() - 0.5) * 30, vy: -40 - rnd() * 20, l: 0 }); } } }
    bob = mode === 'bite' ? (Math.sin(mt * 18) > 0.3 ? 2 : 0) : Math.round(Math.sin(S.t * 2) * 0.6);
  }
  S.render = () => {
    const c = S.ctx, w = wy(), t = S.t;
    c.drawImage(cache(S, 'lake', x => { skyBands(x, S.W, 0, w, ['#f6c48a', '#f2a07a', '#d97a86', '#8e6aa0', '#5a5a92']);
      // Himalayan peaks with snow
      const peaks = [[0.08, 40], [0.22, 62], [0.36, 50], [0.5, 74], [0.63, 58], [0.78, 68], [0.92, 46]];
      const ridge = X => { let h = 18; for (const [px, ph] of peaks) { const d = Math.abs(X / S.W - px) * S.W; h = Math.max(h, ph - d * (0.9 + 0.25 * Math.sin(X * 0.3 + ph))); } return Math.round(h + Math.sin(X * 0.7) * 1.5); };
      for (let X = 0; X < S.W; X++) { const h = ridge(X), lit = ridge(X - 1) < h; for (let y = w - h; y < w; y++) { const dep = y - (w - h), snowLine = h > 40 ? 6 + (h - 40) * 0.5 + (X % 4 === 0 ? 2 : 0) : 0; x.fillStyle = dep < snowLine ? (lit ? '#fbf6f8' : '#d6cde4') : (lit ? '#7a6c9c' : '#5e5486'); x.fillRect(X, y, 1, 1); } }
      const sx0 = Math.round(S.W * 0.62); for (let r = 14; r > 0; r -= 3) { x.globalAlpha = 0.18; x.fillStyle = '#ffe6a8'; x.beginPath(); x.arc(sx0, w - 6, r + 6, 0, 7); x.fill(); } x.globalAlpha = 1; x.fillStyle = '#ffd88a'; x.beginPath(); x.arc(sx0, w - 6, 9, 0, 7); x.fill(); x.fillStyle = '#fff2c8'; x.beginPath(); x.arc(sx0 - 2, w - 8, 5, 0, 7); x.fill();
      hills(x, S.W, w, 14, '#3e4a6e', 3, 0.05); for (let i = 0; i < 40; i++) { const px_ = (i * 37) % S.W, h = 6 + (i % 4) * 2; x.fillStyle = '#2e3858'; for (let k = 0; k < h; k++) x.fillRect(px_ - Math.floor(k / 3), w - 4 - h + k, 1 + Math.floor(k / 3) * 2, 1); }
      // water + reflections
      for (let y = w; y < S.H; y++) { const f = (y - w) / (S.H - w); x.fillStyle = f < 0.3 ? '#8a7aa8' : f < 0.6 ? '#6a6496' : '#4e4c7e'; x.fillRect(0, y, S.W, 1); } }), 0, 0);
    for (let y = w + 1; y < S.H; y++) { const half = Math.round(3 + (y - w) * 0.35), j = Math.round(Math.sin(t * 3 + y * 1.7) * 2); c.globalAlpha = 0.5 - (y - w) / (S.H - w) * 0.3; c.fillStyle = (y + Math.floor(t * 6)) % 3 ? '#ffd88a' : '#fff2c8'; c.fillRect(Math.round(S.W * 0.62) - half + j, y, (y % 2) ? half * 2 : half, 1); } c.globalAlpha = 1;   // sun glitter
    for (let i = 0; i < 26; i++) { const y = w + 2 + (i * 7) % (S.H - w - 4), x0 = ((i * 53 + t * 8 * (i % 3 + 1)) % (S.W + 30)) - 15; c.fillStyle = i % 3 ? 'rgba(250,210,190,0.35)' : 'rgba(255,240,220,0.5)'; c.fillRect(Math.round(x0), y, 6 + (i % 5) * 2, 1); }
    // dock
    const de = dockEnd(), dy = w - 2; c.fillStyle = '#6b4a32'; c.fillRect(0, dy, de, 5); c.fillStyle = '#86603e'; for (let x = 0; x < de; x += 7) c.fillRect(x, dy, 6, 1); c.fillStyle = '#4a3222'; c.fillRect(0, dy + 4, de, 1);
    for (const px of [4, de - 8, Math.round(de / 2)]) { c.fillStyle = '#3e2a1c'; c.fillRect(px, dy + 5, 4, S.H - dy); }
    // me sitting on the dock with the rod
    const P = sitPose(basePose(t), t); P.eyes = blink < 0 ? 'closed' : 'open'; P.look = 1;
    if (mode === 'bite') { P.browUp = 1; P.mouth = 'o'; P.eyes = 'open'; }
    if (mode === 'reel') { P.mouth = 'smile'; P.aR = 120 + Math.sin(mt * 20) * 10; P.fR = 20; } else { P.aR = 70; P.fR = -10; }
    if (mode === 'release') { P.eyes = 'happy'; P.mouth = 'smile'; P.blush = true; }
    drawMeT(c, meX(), dy, P, 'rgba(255,170,120,0.08)');
    const [hx, hy] = handPos(P, meX(), dy, 1), tipX = hx + 42, tipY = hy - (mode === 'reel' ? 34 : 26);
    c.fillStyle = '#2a1d18'; c.fillRect(hx - 1, hy - 1, 3, 3); c.fillStyle = '#3a2a1e'; for (let i = 0; i <= 40; i++) { const u = i / 40, bendy = mode === 'reel' ? Math.sin(u * Math.PI) * 6 : 0; c.fillRect(Math.round(hx + (tipX - hx) * u), Math.round(hy + (tipY - hy) * u + bendy * u), 1, 1); }
    if (mode !== 'reel' && mode !== 'release') { c.fillStyle = 'rgba(255,255,255,0.6)'; const bx = bobX(); for (let i = 0; i <= 30; i++) { const u = i / 30; c.fillRect(Math.round(tipX + (bx - tipX) * u), Math.round(tipY + (w + bob - 2 - tipY) * u + Math.sin(u * Math.PI) * 6), 1, 1); }
      c.fillStyle = '#e05656'; c.fillRect(bx - 1, w + bob - 3, 3, 2); c.fillStyle = '#fff'; c.fillRect(bx - 1, w + bob - 1, 3, 1); }
    for (const r of ripples) { const rr = Math.round(2 + r.l * 9); c.globalAlpha = 0.6 * (1 - r.l / 1.4); c.fillStyle = '#fff2e6'; c.fillRect(bobX() - rr, w + 1, 2, 1); c.fillRect(bobX() + rr - 1, w + 1, 2, 1); } c.globalAlpha = 1;
    if (fish) { const fx = Math.round(fish.x), fy = Math.round(fish.y); c.fillStyle = '#2a3a4a'; c.fillRect(fx - 5, fy - 2, 10, 4); c.fillStyle = '#e8a04a'; c.fillRect(fx - 4, fy - 1, 8, 2); c.fillStyle = '#f6d28a'; c.fillRect(fx - 3, fy - 1, 3, 1); c.fillStyle = '#c86a2a'; c.fillRect(fx + 4, fy - 2, 2, 4); c.fillStyle = '#111'; c.fillRect(fx - 3, fy - 1, 1, 1); }
    c.fillStyle = '#fff2e6'; for (const d of drops) c.fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
    if (catches) { c.fillStyle = 'rgba(30,24,40,0.55)'; c.fillRect(4, 4, 34, 9); c.fillStyle = '#f6d28a'; c.fillRect(7, 7, 4, 3); c.fillStyle = '#fff'; for (let i = 0; i < Math.min(catches, 6); i++) c.fillRect(14 + i * 4, 7, 2, 3); }
  };
})();

// ---------------------------------------------------------------- stargazing on a hill
(function stargaze() {
  const el = document.getElementById('starStage'); if (!el) return;
  const S = Stage(el, update, { scale: 4 }); let blink = 2, smile = 0, next = 3;
  const shooting = [], flies = []; for (let i = 0; i < 14; i++) flies.push({ x: rnd(), y: rnd(), ph: rnd() * 6 });
  const gy = () => S.H - 6;
  const shoot = (x) => shooting.push({ x: x ?? S.W * (0.2 + rnd() * 0.6), y: 6 + rnd() * 20, l: 0, vx: 90 + rnd() * 40, vy: 40 + rnd() * 20 });
  el.addEventListener('pointerdown', e => { shoot(S.local(e).x - 30); smile = 2; }); document.querySelectorAll('[data-star]').forEach(b => b.addEventListener('click', () => { shoot(); smile = 2; }));
  function update(dt) { blink -= dt; if (blink < -0.15) blink = 2.5 + rnd() * 3; smile -= dt; next -= dt; if (next < 0) { shoot(); next = 4 + rnd() * 6; smile = 1.6; }
    for (const s of shooting) { s.l += dt; s.x += s.vx * dt; s.y += s.vy * dt; } while (shooting.length && shooting[0].l > 1.1) shooting.shift();
    for (const f of flies) { f.ph += dt; f.x += Math.sin(f.ph * 0.7) * 0.004; f.y += Math.cos(f.ph * 0.5) * 0.003; } }
  S.render = () => {
    const c = S.ctx, g = gy(), t = S.t;
    c.drawImage(cache(S, 'stars', x => { skyBands(x, S.W, 0, S.H, ['#070a1c', '#0c1230', '#141c44', '#202a56', '#2c3462']);
      // milky way: a dithered diagonal band
      for (let y = 0; y < S.H; y++) for (let X = 0; X < S.W; X++) { const d = Math.abs((X * 0.45 - y) - S.W * 0.08) / 22; if (d < 1 && BAYER4[(y & 3) * 4 + (X & 3)] / 16 > d * 0.9 + 0.1) { x.fillStyle = d < 0.4 ? '#4a4a86' : '#34386e'; x.fillRect(X, y, 1, 1); } } }), 0, 0);
    stars(c, S.W, S.H, t, S.H - 30, 1);
    // constellation (the Plough), faint lines
    const C = [[0.62, 0.18], [0.67, 0.2], [0.72, 0.19], [0.76, 0.23], [0.8, 0.31], [0.74, 0.34], [0.71, 0.27]]; c.fillStyle = 'rgba(160,180,255,0.25)';
    for (let i = 0; i < C.length - 1; i++) { const [a, b] = [C[i], C[i + 1]]; for (let k = 0; k <= 16; k++) c.fillRect(Math.round((a[0] + (b[0] - a[0]) * k / 16) * S.W), Math.round((a[1] + (b[1] - a[1]) * k / 16) * S.H), 1, 1); }
    c.fillStyle = '#fff6d8'; for (const [a, b] of C) c.fillRect(Math.round(a * S.W), Math.round(b * S.H), 2, 2);
    for (const s of shooting) { for (let k = 0; k < 14; k++) { c.globalAlpha = (1 - k / 14) * (1 - s.l / 1.1); c.fillStyle = k < 2 ? '#ffffff' : '#bcd0ff'; c.fillRect(Math.round(s.x - k * 2), Math.round(s.y - k), 1, 1); } } c.globalAlpha = 1;
    // the hill and me lying on it, looking up
    for (let X = 0; X < S.W; X++) { const h = Math.round(22 + 10 * Math.sin(X * 0.012 + 0.5)); for (let y = g - h; y < S.H; y++) { c.fillStyle = y === g - h ? '#3a5a3a' : y < g - h + 3 ? '#26402a' : '#1a2e1e'; c.fillRect(X, y, 1, 1); } }
    const mx = Math.round(S.W * 0.4), hillY = X => g - Math.round(22 + 10 * Math.sin(X * 0.012 + 0.5)), my = hillY(mx);
    for (let i = -26; i <= 26; i++) { const yy = hillY(mx + i); for (let k = 0; k < 3; k++) { c.fillStyle = (((i + 30) >> 2) + k) % 2 ? '#a83a4a' : '#d8cfc0'; c.fillRect(mx + i, yy - 1 + k, 1, 1); } }   // checked picnic blanket
    const P = sitPose(basePose(t), t); P.aL = 34; P.fL = -16; P.aR = 34; P.fR = -16; P.armsBehind = true; P.headDy = -1; P.browUp = 1;   // leaning back on my hands, face to the sky
    P.look = shooting.length ? Math.max(-1, Math.min(1, (shooting[shooting.length - 1].x - mx) / 40)) : 0; P.eyes = blink < 0 ? 'closed' : smile > 0 ? 'happy' : 'open'; P.mouth = smile > 0 ? 'smile' : 'line';
    drawMeT(c, mx, my, P, 'rgba(40,60,140,0.3)');
    for (const f of flies) { const a = 0.5 + 0.5 * Math.sin(f.ph * 3); if (a < 0.3) continue; c.globalAlpha = a; c.fillStyle = '#e8ff8a'; const x = Math.round(f.x * S.W), y = Math.round(g - 8 - f.y * 30); c.fillRect(x, y, 1, 1); c.globalAlpha = a * 0.3; c.fillRect(x - 1, y, 3, 1); c.fillRect(x, y - 1, 1, 3); } c.globalAlpha = 1;
  };
})();

// ---------------------------------------------------------------- snowy evening with a snowman
(function snow() {
  const el = document.getElementById('snowStage'); if (!el) return;
  const S = Stage(el, update, { scale: 4 }); let blink = 2, mode = 'idle', mt = 0, hat = 0, hatV = 0, hatY = 0;
  const flakes = [], breath = [], ball = { on: false };
  for (let i = 0; i < 140; i++) flakes.push({ x: rnd(), y: rnd(), z: rnd(), ph: rnd() * 6 });
  const gy = () => S.H - 10, meX = () => Math.round(S.W * 0.36), snX = () => Math.round(S.W * 0.62);
  const throwB = () => { if (mode !== 'idle') return; mode = 'throw'; mt = 0; };
  el.addEventListener('pointerdown', throwB); document.querySelectorAll('[data-snow]').forEach(b => b.addEventListener('click', throwB));
  function update(dt) {
    mt += dt; blink -= dt; if (blink < -0.12) blink = 2 + rnd() * 3;
    for (const f of flakes) { f.y += (0.05 + f.z * 0.08) * dt; f.ph += dt; f.x += Math.sin(f.ph) * 0.0006; if (f.y > 1) { f.y = 0; f.x = rnd(); } }
    if (rnd() < dt * 0.9) breath.push({ x: meX() + 3, y: gy() - 70, l: 0 }); for (const b of breath) { b.l += dt; b.x += 6 * dt; b.y -= 3 * dt; } while (breath.length && breath[0].l > 1.2) breath.shift();
    if (mode === 'throw' && mt > 0.42 && !ball.on && !ball.done) { ball.on = true; ball.done = true; ball.x = meX() + 12; ball.y = gy() - 82; ball.vx = (snX() - ball.x) / 0.7; ball.vy = -6; }
    if (ball.on) { ball.vy += 120 * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt; if (ball.x >= snX() - 6 && ball.y < gy() - 56) { ball.on = false; hatV = -70; hat = 1; mode = 'laugh'; mt = 0; } else if (ball.y > gy()) { ball.on = false; mode = 'idle'; ball.done = false; } }
    if (hat) { hatV += 140 * dt; hatY += hatV * dt; if (hatY > 0 && hatV > 0 && hat === 1) { hatY = 0; hatV = 0; hat = 2; } }
    if (mode === 'laugh' && mt > 2.4) { mode = 'idle'; ball.done = false; hat = 0; hatY = 0; }
    if (mode === 'throw' && mt > 1.4 && !ball.on) { /* waiting for impact */ }
  }
  S.render = () => {
    const c = S.ctx, g = gy(), t = S.t;
    c.drawImage(cache(S, 'snow', x => { skyBands(x, S.W, 0, g, ['#3a4a7a', '#5a6a9a', '#8a90b8', '#b6b4cc']); hills(x, S.W, g - 6, 20, '#dfe4f2', 1, 0.025);
      for (let i = 0; i < 12; i++) pine(x, Math.round(i * S.W / 11 + (i % 3) * 6), g - 4 - (i % 2) * 6, 24 + (i * 5) % 16, '#2e4a50', '#eef2fa');
      for (let y = g; y < S.H; y++) { x.fillStyle = y === g ? '#ffffff' : y < g + 3 ? '#eef2fa' : '#dce2f0'; x.fillRect(0, y, S.W, 1); } }), 0, 0);
    // window glow of a cabin far away
    c.fillStyle = '#f2c66a'; c.fillRect(Math.round(S.W * 0.9), g - 20, 3, 3);
    for (const f of flakes) { if (f.z > 0.5) continue; c.fillStyle = '#ffffff'; c.globalAlpha = 0.6; c.fillRect(Math.round(f.x * S.W), Math.round(f.y * S.H), 1, 1); } c.globalAlpha = 1;
    // snowman
    const sx = snX(); const snowB = (cx, cy, r) => { for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); c.fillStyle = y > r * 0.4 || -w + 0 > 0 ? '#cfd6ea' : '#ffffff'; c.fillRect(cx - w, cy + y, w * 2 + 1, 1); c.fillStyle = '#c4cce2'; c.fillRect(cx + w - 1, cy + y, 1, 1); } };
    snowB(sx, g - 13, 14); snowB(sx, g - 35, 10); snowB(sx, g - 52, 7);
    c.fillStyle = '#2a2a32'; c.fillRect(sx - 3, g - 55, 2, 2); c.fillRect(sx + 2, g - 55, 2, 2); for (const k of [-2, 0, 2]) c.fillRect(sx, g - 36 + k * 3, 2, 2); for (const k of [-2, -1, 0, 1, 2]) c.fillRect(sx + k * 2, g - 49 + Math.abs(k) * -1 + 1, 1, 1);
    c.fillStyle = '#e8862a'; c.fillRect(sx, g - 52, 6, 2); c.fillRect(sx + 6, g - 52, 2, 1); c.fillStyle = '#c43a42'; c.fillRect(sx - 9, g - 45, 19, 3); c.fillRect(sx + 6, g - 44, 3, 8); c.fillStyle = '#e05656'; c.fillRect(sx - 9, g - 45, 19, 1);
    c.fillStyle = '#6b4a32'; for (let i = 0; i < 14; i++) { c.fillRect(sx - 10 - i, g - 38 - Math.round(i * 0.7), 1, 1); c.fillRect(sx + 10 + i, g - 38 - Math.round(i * 0.7), 1, 1); } c.fillRect(sx - 22, g - 48, 1, 3); c.fillRect(sx + 22, g - 48, 1, 3);
    const hy = g - 68 + Math.round(hatY), hx2 = sx + (hat ? Math.round(hatY * -0.3) : 0); c.fillStyle = '#1e1e26'; c.fillRect(hx2 - 7, hy + 8, 15, 2); c.fillRect(hx2 - 5, hy, 11, 9); c.fillStyle = '#c43a42'; c.fillRect(hx2 - 5, hy + 6, 11, 2);
    // me in a scarf
    const P = basePose(t); P.eyes = blink < 0 ? 'closed' : 'open'; P.look = 1;
    if (mode === 'throw') { const u = Math.min(1, mt / 0.42); if (mt < 0.42) { P.aR = 30 + u * 140; P.fR = 10 + u * 30; } else { const v = Math.min(1, (mt - 0.42) / 0.25); P.aR = 170 - v * 110; P.fR = 40 - v * 50; } P.mouth = 'smile'; }
    if (mode === 'laugh') { P.eyes = 'happy'; P.mouth = 'smile'; P.blush = true; P.bob = Math.floor(mt * 8) % 2 ? -1 : 0; }
    drawMeT(c, meX(), g, P, 'rgba(120,140,200,0.12)');
    c.fillStyle = '#c43a42'; c.fillRect(meX() - 6, g + 1 - GY + 33 + P.bob, 13, 3); c.fillRect(meX() + 3, g + 1 - GY + 35 + P.bob, 3, 8); c.fillStyle = '#e05656'; c.fillRect(meX() - 6, g + 1 - GY + 33 + P.bob, 13, 1);
    const hx = meX(), ht = g + 1 - GY + P.bob + 4; c.fillStyle = '#8e2630'; c.fillRect(hx - 13, ht + 2, 26, 7); c.fillRect(hx - 10, ht, 20, 3); c.fillStyle = '#a82e38'; for (let i = -12; i < 13; i += 3) c.fillRect(hx + i, ht + 2, 1, 5); c.fillStyle = '#c43a42'; c.fillRect(hx - 13, ht + 7, 26, 3); for (let i = -12; i < 13; i += 2) { c.fillStyle = '#e05656'; c.fillRect(hx + i, ht + 8, 1, 1); } c.fillStyle = '#f4f0f6'; c.fillRect(hx - 2, ht - 3, 4, 4); c.fillStyle = '#d8d2e6'; c.fillRect(hx + 1, ht - 1, 1, 2);   // knit beanie with a pom-pom
    c.fillStyle = '#cfd6ea'; for (let i = 0; i < 6; i++) { const fx = hx - 20 - i * 9; c.fillRect(fx, g + 2 + (i % 2), 3, 1); }   // footprints
    if (ball.on) { c.fillStyle = '#ffffff'; c.fillRect(Math.round(ball.x) - 1, Math.round(ball.y) - 1, 3, 3); }
    c.fillStyle = 'rgba(255,255,255,0.6)'; for (const b of breath) { c.globalAlpha = 0.5 * (1 - b.l / 1.2); c.fillRect(Math.round(b.x), Math.round(b.y), 2 + Math.round(b.l * 2), 1); } c.globalAlpha = 1;
    for (const f of flakes) { if (f.z <= 0.5) continue; c.fillStyle = '#ffffff'; const x = Math.round(f.x * S.W), y = Math.round(f.y * S.H); c.fillRect(x, y, f.z > 0.85 ? 2 : 1, f.z > 0.85 ? 2 : 1); }
  };
})();

})();
