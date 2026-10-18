/*!
 * Pixel me — two small animated scenes with a full-body pixel-art Nikit.
 *   • Me & my dog: the homepage rottie (drawn from the <pixel-dog> rig, js/pixel-dog.js). I pet it,
 *     and throw a ball that it chases, picks up, brings back and drops at my feet.
 *   • Under the sakura: I sit against a pixel cherry tree (tools/pixeltree.py) watching petals fall,
 *     get drowsy, nod off; petals settle on my hair; tap to wake me or shake the tree.
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

// ---------------------------------------------------------------- shared bits
const ME_TMP = document.createElement('canvas'); ME_TMP.width = SW; ME_TMP.height = SH; const meCtx = ME_TMP.getContext('2d'), meImg = new ImageData(SW, SH);
function drawMe(ctx, x, gy, P, lift = 0) { paint(P); meImg.data.set(buf); meCtx.putImageData(meImg, 0, 0); ctx.drawImage(ME_TMP, Math.round(x - SW / 2), Math.round(gy + 1 - GY - lift)); }
function basePose(t) {
  return { dx: 0, bob: Math.sin(t * 2.4) > 0.6 ? -1 : 0, headDx: 0, headDy: 0, lL: 0, lR: 0, kL: 0, kR: 0, aL: 8, aR: 8, fL: 6, fR: 6,
    liftL: 0, liftR: 0, sway: Math.sin(t * 1.8) * 0.8, eyes: 'open', look: 0, browUp: 0, mouth: 'line', blush: false, armsBehind: false };
}
const sitPose = (P, t) => { P.bob = 22; P.lL = 84; P.lR = -84; P.kL = -150; P.kR = 150; P.aL = 18; P.aR = 18; P.fL = -40; P.fR = -40; return P; };
function grass(ctx, W, H, gy) {
  const G = ['#6c9a48', '#58863c', '#4a7634', '#40692e', '#385e2a', '#33552a'];
  for (let y = gy + 1, i = 0; y < H; y++, i++) { ctx.fillStyle = G[Math.min(i, G.length - 1)]; ctx.fillRect(0, y, W, 1); }
  ctx.fillStyle = '#86b25a'; for (let x = 2; x < W; x += 5) ctx.fillRect(x, gy, 1, 1);
}
const HEART = ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'];
function heart(ctx, x, y) { HEART.forEach((r, j) => [...r].forEach((c, i) => c === 'x' && ctx.fillRect(Math.round(x) + i - 2, Math.round(y) + j, 1, 1))); }
function zee(ctx, x, y, sz) { x = Math.round(x); y = Math.round(y); ctx.fillRect(x, y, sz, 1); ctx.fillRect(x + sz - 2, y + 1, 1, 1); if (sz > 3) ctx.fillRect(x + 1, y + 2, 1, 1); ctx.fillRect(x, y + sz - 1, sz, 1); }
const ease = t => t * t * (3 - 2 * t);

// a pixel stage: canvas + crisp scaling + a loop that only runs while visible
function Stage(el, update) {
  const cv = document.createElement('canvas'); el.appendChild(cv); const ctx = cv.getContext('2d');
  const st = { el, cv, ctx, W: 0, H: 0, scale: 3, t: 0 };
  st.layout = () => { const r = el.getBoundingClientRect(); st.scale = r.width < 520 ? 2 : 3; st.W = Math.floor(r.width / st.scale); st.H = Math.floor(r.height / st.scale); cv.width = st.W; cv.height = st.H; cv.style.width = st.W * st.scale + 'px'; cv.style.height = st.H * st.scale + 'px'; st.onLayout && st.onLayout(); };
  st.local = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / st.scale, y: (e.clientY - r.top) / st.scale }; };
  let vis = false, last = 0, acc = 0;
  const loop = now => { if (!vis) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; st.t += dt; update(dt); acc += dt; if (acc >= 1 / 30 || reduce) { acc = 0; ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, st.W, st.H); st.render(); } requestAnimationFrame(loop); };
  new IntersectionObserver(e => { vis = e[0].isIntersecting; if (vis) { last = performance.now(); requestAnimationFrame(loop); } }, { threshold: 0.05 }).observe(el);
  addEventListener('resize', st.layout); requestAnimationFrame(st.layout);
  return st;
}

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
  const S = Stage(el, update);
  S.onLayout = () => { me.x = Math.round(S.W * 0.3); if (!dog.x || dog.mode === 'sit') dog.x = me.x + 40; };
  const gy = () => S.H - 6, home = () => me.x + 40;
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
        ball.held = false; ball.on = true; ball.ground = false; ball.x = me.x + 12; ball.y = gy() - 82;
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
      P.aR = 66 + st * 5; P.fR = 30 + st * 14; P.aL = 20; P.fL = -30;                               // stroke the head
      P.eyes = mt > 0.5 ? 'happy' : 'open'; P.mouth = 'smile'; P.blush = true; P.headDx = 1;
    }
    if (me.mode === 'throw') {   // wind up overhead, then throw forward and follow through
      const u = mt / 0.42;
      if (u < 1) { P.aR = 30 + ease(u) * 140; P.fR = 10 + ease(u) * 30; P.bob = Math.round(ease(u) * 2); P.lL = -6; P.lR = 6; }
      else { const v = Math.min(1, (mt - 0.42) / 0.25); P.aR = 170 - ease(v) * 120; P.fR = 40 - v * 50; P.bob = -1; P.lR = 10; P.kR = -10; }
      P.aL = 20; P.mouth = 'smile'; P.look = 1;
    }
    if (me.mode === 'watch') { P.mouth = 'smile'; if (Math.floor(mt * 3) % 4 === 0) P.browUp = 1; }
    if (me.mode === 'pickup') { const u = Math.sin(Math.min(1, mt / 0.9) * Math.PI); P.bob = Math.round(u * 15); P.lL = -42 * u; P.kL = 42 * u; P.lR = 42 * u; P.kR = -42 * u; P.liftL = P.liftR = 3 * u; P.aR = 8 + u * 30; P.fR = 6 - u * 10; P.mouth = 'smile'; }
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
    const c = S.ctx, g = gy(); grass(c, S.W, S.H, g);
    c.fillStyle = 'rgba(30,40,20,.25)'; c.fillRect(me.x - 7, g + 1, 14, 1); c.fillRect(Math.round(dog.x) - 12, g + 1, 22, 1);
    if (DOG) DOG.draw(c, dog.x, g, dog.face, dogPose());
    drawMe(c, me.x, g, mePose());
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
  let shake = 0, sv = 0, lastPoke = -9, tx = 0;
  const PC = ['#f19fb6', '#fbc8d4', '#dc7598'];
  const S = Stage(el, update);
  S.onLayout = () => { tx = Math.round(S.W * 0.56); };
  const gy = () => S.H - 6, meX = () => tx - 22, headY = () => gy() + 1 - GY + 22 + 20;   // sitting head centre
  const set = m => { me.mode = m; me.mt = 0; };
  function spawn(n, spread) { for (let i = 0; i < n; i++) petals.push({ x: tx + (Math.random() - 0.5) * 130, y: gy() - 150 + Math.random() * spread, vy: 7 + Math.random() * 7, ph: Math.random() * 6, c: (Math.random() * 3) | 0 }); }
  function poke() { sv += 9 * (Math.random() < 0.5 ? 1 : -1); spawn(22, 60); lastPoke = S.t; onHair.length = 0; if (me.mode === 'sleep' || me.mode === 'drowsy') set('wake'); else set('lookup'); }
  function nap() { if (me.mode === 'sleep') return; set('drowsy'); me.mt = 3.5; }
  el.addEventListener('pointerdown', e => { const p = S.local(e); if (me.mode === 'sleep' || me.mode === 'drowsy') { set('wake'); return; } if (Math.abs(p.x - tx) < 70 && p.y < gy() - 70) poke(); else set('wave'); });
  document.querySelectorAll('[data-tree]').forEach(b => b.addEventListener('click', () => (b.dataset.tree === 'shake' ? poke() : nap())));

  function update(dt) {
    const t = S.t; me.mt += dt; me.blink -= dt; if (me.blink < -0.12) me.blink = 2 + Math.random() * 3.5;
    sv += (-shake * 60 - sv * 6) * dt; shake += sv * dt;
    const wind = Math.sin(t * 0.4) * 6 + Math.sin(t * 1.3) * 3;
    if (Math.random() < dt * 1.5 && petals.length < 40) spawn(1, 50);
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
    if (me.mode === 'sleep' && Math.random() < dt * 0.8) zs.push({ x: meX() + 12, y: headY() - 18, l: 0 });
    for (const z of zs) { z.l += dt; z.y -= 6 * dt; z.x += Math.sin(z.l * 3) * 4 * dt; } while (zs.length && zs[0].l > 2.4) zs.shift();
    // eyes follow a petal while awake
    let lk = 0; if (me.mode === 'sit' && petals.length) { const p = petals.reduce((a, b) => (Math.abs(b.y - headY()) < Math.abs(a.y - headY()) ? b : a)); lk = Math.max(-1, Math.min(1, (p.x - meX()) / 30)); }
    me.look += (lk - me.look) * Math.min(1, dt * 3);
  }
  function mePose() {
    const t = S.t, mt = me.mt, P = sitPose(basePose(t), t); P.look = me.look; P.eyes = me.blink < 0 ? 'closed' : 'open';
    if (me.mode === 'drowsy') { P.eyes = me.blink < 0.6 ? 'closed' : 'sleepy'; const nod = (mt % 2.2) < 0.5; P.headDy = nod ? 1 : 0; me.blink = Math.min(me.blink, 1.2); }
    if (me.mode === 'sleep') { P.eyes = 'closed'; P.headDy = 1; P.headDx = 1; P.bob = 22 + (Math.sin(t * 1.4) > 0.3 ? 0 : 1); P.sway = 1.5; }
    if (me.mode === 'wake') { if (mt < 0.5) { P.eyes = 'open'; P.browUp = 1; P.mouth = 'o'; P.bob = 20; } else { P.mouth = 'smile'; P.eyes = mt < 1.4 ? 'happy' : P.eyes; } }
    if (me.mode === 'lookup') { P.browUp = 1; P.mouth = mt < 0.8 ? 'o' : 'smile'; P.look = 0; P.eyes = mt > 0.8 && mt < 1.6 ? 'happy' : 'open'; }
    if (me.mode === 'wave') { P.aR = 150; P.fR = [10, 28, 44, 28][Math.floor(mt * 10) % 4]; P.eyes = 'happy'; P.mouth = 'smile'; P.blush = true; }
    if (me.mode === 'sit') P.mouth = 'line';
    return P;
  }
  S.render = () => {
    const c = S.ctx, g = gy();
    if (TR) {
      const I = TR.info, x0 = Math.round(tx - I.cx), y0 = g + 1 - I.gy, sway = k => Math.round(Math.sin(S.t * 0.9 + k) * 0.8 + Math.sin(S.t * 0.37) * 0.5 + shake * (1 + k));
      c.drawImage(TR.back, x0 + sway(0), y0); c.drawImage(TR.trunk, x0, y0);
      grass(c, S.W, S.H, g);
      c.fillStyle = 'rgba(40,60,30,.22)'; for (let i = -62; i <= 62; i++) c.fillRect(tx + i, g + 1, 1, Math.round(2.4 * Math.sqrt(1 - (i / 63) ** 2)));
      for (const p of ground) { c.fillStyle = PC[p.c]; c.fillRect(Math.round(p.x), g + 1 + (p.c & 1), 1, 1); }
      drawMe(c, meX(), g, mePose());
      for (const h of onHair) { c.fillStyle = PC[h.c]; c.fillRect(meX() + h.dx, headY() - 14 + h.dy + (me.mode === 'sleep' ? 1 : 0), 2, 1); }
      c.drawImage(TR.front, x0 + sway(0.7), y0 + (Math.abs(shake) > 1 ? 1 : 0));
    } else { grass(c, S.W, S.H, g); drawMe(c, meX(), g, mePose()); }
    for (const p of petals) { c.fillStyle = PC[p.c]; const f = Math.sin(p.ph) > 0; c.fillRect(Math.round(p.x), Math.round(p.y), f ? 2 : 1, f ? 1 : 2); }
    c.fillStyle = '#5b4a7a'; for (const z of zs) { c.globalAlpha = Math.min(1, z.l * 3) * (1 - z.l / 2.4); zee(c, z.x, z.y, z.l > 1.2 ? 4 : 3); } c.globalAlpha = 1;
  };
})();
})();
