(() => {
'use strict';
/*
 * Pencil portraits drawn in code (tools/pencil.py). Each portrait ships as:
 *   smudge.webp (the blending-stump base), strokes.pcl (every pencil stroke), still/large.webp (finished).
 * The time-lapse replays strokes.pcl onto a canvas straight from its ArrayBuffer — no per-stroke objects.
 * Files are split into ≤85 KB chunks listed in art/index.json.
 */
const ST = [['baby', 'Baby'], ['kid', 'Kid'], ['teen', 'Teen'], ['young', 'Young'], ['curls', 'Curls'], ['now', 'Now']];
const $ = s => document.querySelector(s);
const DPR = Math.min(2, devicePixelRatio || 1), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const GRAPHITE = 'rgb(46,46,52)', PAPER = '#f6f3ec';

let manifest; const files = {};
const getBlob = (f, type) => files[f] || (files[f] = (manifest = manifest || fetch('art/index.json').then(r => r.json()))
  .then(m => Promise.all(Array.from({ length: m[f] }, (_, i) => fetch(`art/${f}.${i}`).then(r => r.arrayBuffer())))).then(p => new Blob(p, { type })));
const urls = {};
Living.setLoader(getBlob);
const imgURL = (id, v) => urls[id + v] || (urls[id + v] = getBlob(`${id}/${v}.webp`, 'image/webp').then(b => URL.createObjectURL(b)));
const bitmap = async (id, v, w, h) => createImageBitmap(await getBlob(`${id}/${v}.webp`, 'image/webp'), { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });

// strokes.pcl → DataView + stroke offsets (Uint32Array): the only per-portrait memory beyond the bytes
const parsed = {};
function strokes(id) {
  return parsed[id] || (parsed[id] = getBlob(`${id}/strokes.pcl`).then(b => b.arrayBuffer()).then(buf => {
    const v = new DataView(buf); let o = 4; const W = v.getUint16(o, true), H = v.getUint16(o + 2, true), n = v.getUint32(o + 4, true); o += 8;
    const np = v.getUint8(o++), pass = {};
    for (let i = 0; i < np; i++) { pass[v.getUint8(o)] = [v.getFloat32(o + 1, true), v.getFloat32(o + 5, true)]; o += 9; }
    const off = new Uint32Array(n);
    for (let i = 0; i < n; i++) { off[i] = o; o += 6 + (v.getUint8(o + 1) - 1) * 2; }
    return { v, W, H, n, pass, off };
  }));
}

// live eyes: the eye groups from the colour drawing, layered over an eye-less portrait
const eyeSvg = {};
const eyesFor = id => eyeSvg[id] || (eyeSvg[id] = getBlob(`${id}/eyes.svg`).then(b => b.text()));
let uid = 0;
async function mountEyes(el, id) {
  let ov = el.querySelector('svg.eyes');
  if (!ov) { ov = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); ov.setAttribute('class', 'eyes'); ov.setAttribute('viewBox', '0 0 800 1000'); ov.setAttribute('aria-hidden', 'true'); el.appendChild(ov); }
  const n = ++uid; ov.innerHTML = (await eyesFor(id)).replace(/id="([^"]+)"/g, `id="$1-${n}"`).replace(/url\(#([^)]+)\)/g, `url(#$1-${n})`);
  live.add(el); return ov;
}

// ---- interaction: gaze (pointer, phone tilt, or idle wandering), drowsiness, blink, wink, tilt
const live = new Set();
let px = innerWidth / 2, py = innerHeight / 3, lastMove = performance.now(), asleep = false;
const wakeUp = () => { lastMove = performance.now(); if (asleep) { asleep = false; for (const el of live) { el.classList.remove('drowsy'); blink(el); setTimeout(() => blink(el), 240); } } };
addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; wakeUp(); }, { passive: true });
addEventListener('scroll', wakeUp, { passive: true });
addEventListener('deviceorientation', e => { if (e.gamma == null) return; px = innerWidth / 2 + e.gamma / 30 * innerWidth / 2; py = innerHeight / 2 + (e.beta - 45) / 30 * innerHeight / 2; wakeUp(); }, { passive: true });
const askLook = () => {};
// ~30 fps, only touching portraits that are on screen
let lt = performance.now();
setInterval(() => {
  if (document.hidden || !live.size) return;
  const now = performance.now(), dt = Math.min(0.1, (now - lt) / 1000), idle = (now - lastMove) / 1000; lt = now;
  if (idle > 20 && !asleep) { asleep = true; for (const el of live) el.classList.add('drowsy'); }
  for (const el of live) {
    if (!el.isConnected) { live.delete(el); continue; }
    const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
    let tx, ty;
    if (idle < 3.5) {
      const dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height * 0.36), m = Math.hypot(dx, dy) || 1, k = Math.min(1, m / (r.width * 1.2));
      tx = dx / m * k; ty = dy / m * k;
    } else {   // idle: the eyes drift around on their own, each portrait to its own rhythm
      const s = (el._seed = el._seed || Math.random() * 100), t = now / 1000;
      tx = Math.sin(t * 0.37 + s) * 0.7 + Math.sin(t * 0.91 + s * 2) * 0.3; ty = Math.sin(t * 0.29 + s * 3) * 0.35 + (asleep ? 0.5 : 0);
      if (Math.sin(t * 0.21 + s) > 0.92) { tx = Math.sign(tx) * 0.95; }   // a sudden sideways glance now and then
    }
    const g = el._g || (el._g = { x: 0, y: 0 }), f = 1 - Math.pow(idle < 3.5 ? 0.0004 : 0.08, dt);
    g.x += (tx - g.x) * f; g.y += (ty - g.y) * f;
    const tfm = `translate(${(g.x * 6).toFixed(2)}px,${(g.y * 3.5).toFixed(2)}px)`;
    if (el._last !== tfm) { el._last = tfm; el.querySelectorAll('.iris').forEach(i => (i.style.transform = tfm)); }
    if (el.classList.contains('tilt')) el.style.transform = `perspective(900px) rotateY(${(g.x * 2.4).toFixed(2)}deg) rotateX(${(-g.y * 1.6).toFixed(2)}deg)`;
  }
}, 33);
function blink(el, which = '.eye', ms) { const e = el.querySelectorAll(which); e.forEach(x => x.classList.add('shut')); setTimeout(() => e.forEach(x => x.classList.remove('shut')), ms || (which === '.eye' ? 130 : 320)); }
(function blinker() { for (const el of live) { const r = el.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight && Math.random() < (asleep ? 0.12 : 0.35)) { blink(el, '.eye', asleep ? 700 : 130); if (!asleep && Math.random() < 0.15) setTimeout(() => blink(el), 260); } } setTimeout(blinker, 1400 + Math.random() * 1600); })();
function interactive(el) {
  el.addEventListener('pointerdown', e => { const r = el.getBoundingClientRect(); blink(el, (e.clientX - r.left) < r.width / 2 ? '.eye-l' : '.eye-r'); }); // wink
}

function Drawing(el, mode = () => 'paint') {
  const cv = document.createElement('canvas'); el.innerHTML = ''; el.appendChild(cv); const ctx = cv.getContext('2d');
  let job = 0;
  async function play(id, dur = 3.6, onState, animate = true) {
    const my = ++job, paint = mode() === 'paint', w = Math.round((el.clientWidth || 300) * DPR); cv.width = w; cv.height = Math.round(w * 1.25);
    el.classList.toggle('pencil', !paint); const ov = el.querySelector('svg.eyes'); if (ov) ov.style.opacity = 0;
    const finName = paint ? (w > 640 ? 'paintlarge_ne' : 'paint_ne') : (w > 640 ? 'large' : 'still');   // pencil keeps its own graphite eyes
    const [S, smudge, fin] = await Promise.all([strokes(id), bitmap(id, 'smudge', w, cv.height), bitmap(id, finName, w, cv.height), mountEyes(el, id)]);
    if (my !== job) { smudge.close(); fin.close(); return; }
    const showEyes = () => { const o = el.querySelector('svg.eyes'); if (o) o.style.opacity = 1; askLook(); };
    const k = w / S.W, v = S.v; ctx.lineCap = ctx.lineJoin = 'round';
    if (reduce || !animate) { ctx.drawImage(fin, 0, 0); smudge.close(); fin.close(); showEyes(); onState && onState(`${S.n.toLocaleString()} strokes`); return; }
    ctx.globalAlpha = 1; ctx.fillStyle = PAPER; ctx.fillRect(0, 0, w, cv.height);
    const t0 = performance.now(), fadeIn = 0.35, wash = paint ? 1.0 : 0.45; let next = 0, smudged = 0;
    const stroke = i => {
      let o = S.off[i]; const p = S.pass[v.getUint8(o)] || [1, 0.1], n = v.getUint8(o + 1); let x = v.getUint16(o + 2, true), y = v.getUint16(o + 4, true); o += 6;
      ctx.globalAlpha = p[1]; ctx.lineWidth = p[0] * k; ctx.beginPath(); ctx.moveTo(x * k, y * k);
      for (let j = 1; j < n; j++) { x += v.getInt8(o); y += v.getInt8(o + 1); o += 2; ctx.lineTo(x * k, y * k); }
      ctx.stroke();
    };
    ctx.strokeStyle = GRAPHITE; onState && onState('drawing…');
    let washed = 0;
    (function frame(now) {
      if (my !== job) { smudge.close(); fin.close(); return; }
      const t = (now - t0) / 1000;
      if (smudged < 1) { const a = Math.min(1, t / fadeIn); ctx.globalAlpha = a - smudged; ctx.drawImage(smudge, 0, 0); smudged = a; }
      // eased pace: the loose hatching races, the fine strokes land last
      const f = Math.min(1, Math.max(0, (t - fadeIn * 0.5) / dur)), upto = Math.floor(S.n * (1 - Math.pow(1 - f, 2)));
      while (next < upto) stroke(next++);
      if (f < 1) return requestAnimationFrame(frame);
      const g = Math.min(1, (t - fadeIn * 0.5 - dur) / wash);
      ctx.globalAlpha = (g - washed) / (1 - washed + 1e-6); ctx.drawImage(fin, 0, 0); washed = g;   // exact alpha compositing toward the finished art
      if (g > 0.6) showEyes();
      if (g < 1) return requestAnimationFrame(frame);
      ctx.globalAlpha = 1; ctx.drawImage(fin, 0, 0); smudge.close(); fin.close(); onState && onState(`${S.n.toLocaleString()} strokes`);
    })(t0);
  }
  return { play, stop() { job++; } };
}

// ---- hero
const heroEl = $('#hero'); heroEl.classList.add('tilt'); interactive(heroEl);
let cur = 'now', medium = 'paint';
const hero = Drawing(heroEl, () => medium);
function show(id, animate = true) {
  cur = id; [...$('#chips').children].forEach(b => b.classList.toggle('on', b.dataset.id === id)); Living.detach(heroEl);
  hero.play(id, 3.8, s => { $('#status').textContent = s; if (/strokes$/.test(s) && medium === 'paint' && cur === id) Living.attach(heroEl, id, 'paintlarge_ne', { fps: 60 }); }, animate);
}
ST.forEach(([id, label]) => { const b = document.createElement('button'); b.textContent = label; b.dataset.id = id; b.onclick = () => show(id); $('#chips').appendChild(b); });
$('#redraw').onclick = () => show(cur);
$('#mode').onclick = e => { medium = medium === 'paint' ? 'pencil' : 'paint'; e.target.textContent = 'medium: ' + medium; show(cur); };
new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { o.disconnect(); show('now'); } }).observe(heroEl);

// ---- galleries: every card is a live, interactive portrait (static image + live eyes)
function card(grid, label, sub) {
  const f = document.createElement('figure'); f.className = 'card'; f.innerHTML = `<div class="art paper"></div><figcaption><b>${label}</b><span>${sub}</span></figcaption>`;
  grid.appendChild(f); return f;
}
const onView = (el, fn) => new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { o.disconnect(); fn(); } }, { rootMargin: '150px 0px' }).observe(el);
async function still(a, id, v, alt) { a.innerHTML = `<img src="${await imgURL(id, v)}" alt="${alt}">`; if (/paint/.test(v)) { await mountEyes(a, id); a.querySelector('svg.eyes').style.opacity = 1; interactive(a); Living.attach(a, id, v); } askLook(); }
for (const [id, label] of ST) {
  const pf = card($('#paints'), label, 'painted'); onView(pf, () => still(pf.firstChild, id, 'paint_ne', `Painted portrait of Nikit: ${label}`));
  pf.querySelector('figcaption').onclick = () => big(id, label, true);
  const f = card($('#stills'), label, 'graphite'); f.firstChild.classList.add('pencil'); onView(f, () => still(f.firstChild, id, 'still', `Pencil portrait of Nikit: ${label}`));
  f.querySelector('figcaption').onclick = () => big(id, label, false);
}
async function big(id, label, paint) {
  $('#lb').hidden = false; $('#lbTitle').textContent = `${label} · ${paint ? 'painted' : 'graphite'}`;
  const a = $('#lbArt'); a.className = 'art paper tilt' + (paint ? '' : ' pencil'); await still(a, id, paint ? 'paintlarge_ne' : 'large', '');
}
const closeLb = () => { $('#lb').hidden = true; live.delete($('#lbArt')); Living.detach($('#lbArt')); $('#lbArt').innerHTML = ''; };
$('#lb').onclick = e => { if (e.target.id === 'lb' || e.target.id === 'lbClose') closeLb(); };
addEventListener('keydown', e => e.key === 'Escape' && closeLb());
})();
