(() => {
'use strict';
/*
 * Each drawing is one code-generated SVG (thousands of paths). To keep the tab light, the page never
 * loads that SVG: tools/bake.js pre-renders its layers to small webp files and extracts its ink strokes,
 * and the "drawing itself" animation replays those strokes onto a <canvas>. Only the eyes stay as a tiny
 * live SVG, so they can blink and follow the cursor.
 */
const ST = [['baby', 'Baby'], ['kid', 'Kid'], ['teen', 'Teen'], ['young', 'Young'], ['curls', 'Curls'], ['now', 'Now']];
const $ = s => document.querySelector(s);
const VW = 800, VH = 1000, DPR = Math.min(2, devicePixelRatio || 1);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- data: everything is pre-baked by tools/bake.js into art/<id>/… and split into ≤85 KB chunks
// (art/index.json lists how many chunks each file has); nothing parses the big SVGs at runtime.
let manifest; const files = {};
const getBlob = (f, type) => files[f] || (files[f] = (manifest = manifest || fetch('art/index.json').then(r => r.json()))
  .then(m => Promise.all(Array.from({ length: m[f] }, (_, i) => fetch(`art/${f}.${i}`).then(r => r.arrayBuffer())))).then(p => new Blob(p, { type })));
const urlOf = {};
const imgURL = (id, v) => urlOf[id + v] || (urlOf[id + v] = getBlob(`${id}/${v}.webp`, 'image/webp').then(b => URL.createObjectURL(b)));
// decoded straight to the canvas size and closed after use, so no full-size decode lingers in the image cache
async function bitmap(id, v, w, h) {
  const b = await getBlob(`${id}/${v}.webp`, 'image/webp');
  try { return await createImageBitmap(b, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' }); }
  catch { const im = new Image(); im.src = await imgURL(id, v); await im.decode(); return im; }
}
const close = b => b && b.close && b.close();
const stillURL = (id, line) => imgURL(id, line ? 'line' : 'still');

// ---- ink strokes + eyes, loaded once per drawing
const parsed = {};
function parse(id) {
  return parsed[id] || (parsed[id] = Promise.all([getBlob(`${id}/ink.json`).then(b => b.text()), getBlob(`${id}/eyes.svg`).then(b => b.text())]).then(([j, eyes]) => {
    const ink = JSON.parse(j).map(([d, col, w, op, fill]) => {
      const nums = d.match(/-?\d+\.?\d*/g).map(Number); let len = 0;
      for (let i = 2; i + 1 < nums.length; i += 2) len += Math.hypot(nums[i] - nums[i - 2], nums[i + 1] - nums[i - 1]);
      return { path: new Path2D(d), fill: fill ? col : null, col, w: w || 1, op, len: Math.max(4, len * 0.8) };
    });
    return { ink, eyes };
  }));
}

// ---- a live portrait: canvas + eye overlay
let uid = 0; const living = new Set();
function Portrait(el) {
  el.innerHTML = '<canvas></canvas><svg class="eyes" viewBox="0 0 800 1000" aria-hidden="true"></svg>';
  const cv = el.firstChild, eyes = el.lastChild, ctx = cv.getContext('2d');
  let job = 0;
  const size = () => { const w = Math.round((el.clientWidth || 300) * DPR); if (cv.width !== w) { cv.width = w; cv.height = Math.round(w * VH / VW); } return w; };
  async function draw(id, line, animate) {
    const my = ++job, w = size(), k = w / VW;
    const [data, fin] = await Promise.all([parse(id), bitmap(id, line ? 'linefull' : 'full', w, cv.height)]);
    if (my !== job) return close(fin);
    const n = ++uid; eyes.innerHTML = data.eyes.replace(/id="([^"]+)"/g, `id="$1-${n}"`).replace(/url\(#([^)]+)\)/g, `url(#$1-${n})`);
    if (line) eyes.querySelectorAll('.eye>path:first-of-type').forEach(p => p.setAttribute('fill', '#fff'));
    if (!animate || reduce) { ctx.drawImage(fin, 0, 0, cv.width, cv.height); close(fin); eyes.style.opacity = 1; return; }
    const under = await bitmap(id, line ? 'hatch' : 'colour', w, cv.height); if (my !== job) { close(fin); close(under); return; }
    const done = document.createElement('canvas'); done.width = w; done.height = cv.height; const dx = done.getContext('2d');
    dx.setTransform(k, 0, 0, k, 0, 0); dx.lineCap = dx.lineJoin = 'round';
    const T = 3.2, N = data.ink.length, rnd = (i => () => (i = (i * 16807) % 2147483647) / 2147483647)(7);
    const items = data.ink.map((p, i) => ({ p, t0: i / N * T, dur: 0.5 + rnd() * 0.6, fin: false }));
    const bg = line ? '#ffffff' : '#f6f1e9', t0 = performance.now(); let next = 0; eyes.style.opacity = 0;
    const stroke = (c, it, f) => {
      const p = it.p; c.globalAlpha = p.op;
      if (p.fill) { c.globalAlpha = p.op * f; c.fillStyle = p.fill; c.fill(p.path); return; }
      c.strokeStyle = p.col; c.lineWidth = p.w; if (f < 1) c.setLineDash([p.len * f, p.len * 2]); else c.setLineDash([]);
      c.stroke(p.path);
    };
    (function frame(now) {
      if (my !== job) { done.width = 0; close(fin); close(under); return; }
      const t = (now - t0) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = bg; ctx.fillRect(0, 0, cv.width, cv.height);
      const wash = Math.min(1, Math.max(0, (t - T - 0.4) / 1.6)); if (wash > 0) { ctx.globalAlpha = wash; ctx.drawImage(under, 0, 0, cv.width, cv.height); ctx.globalAlpha = 1; }
      while (next < N && items[next].t0 + items[next].dur <= t) { stroke(dx, items[next], 1); items[next].fin = true; next++; }
      ctx.drawImage(done, 0, 0);
      ctx.setTransform(k, 0, 0, k, 0, 0); ctx.lineCap = ctx.lineJoin = 'round';
      for (let i = next; i < N && items[i].t0 < t; i++) if (!items[i].fin) { const it = items[i], f = (t - it.t0) / it.dur; if (f >= 1) { stroke(dx, it, 1); it.fin = true; } else stroke(ctx, it, f); }
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      eyes.style.opacity = Math.min(1, Math.max(0, (t - T * 0.55) / 0.8));
      if (t < T + 2.2) requestAnimationFrame(frame);
      else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(fin, 0, 0, cv.width, cv.height); done.width = 0; close(fin); close(under); } // settle on the exact final drawing, free scratch // settle on the exact final drawing
    })(t0);
  }
  return { draw, el, stop() { job++; } };
}

// blink + gaze for every live portrait
function live(p) {
  living.add(p.el);
  if (p.el._blink) return; p.el._blink = 1;
  const blink = () => { if (!p.el.isConnected) return; const e = p.el.querySelectorAll('.eye'); e.forEach(x => x.classList.add('shut')); setTimeout(() => e.forEach(x => x.classList.remove('shut')), 120); setTimeout(blink, 2200 + Math.random() * 4000); };
  setTimeout(blink, 4500 + Math.random() * 2000);
}
let px = innerWidth / 2, py = innerHeight / 3, gq = false;
function gaze() {
  gq = false;
  for (const el of living) {
    const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
    const dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height * 0.32), m = Math.hypot(dx, dy) || 1, k = Math.min(1, m / 300);
    const tf = `translate(${(dx / m * 5 * k).toFixed(1)}px,${(dy / m * 3 * k).toFixed(1)}px)`;
    el.querySelectorAll('.iris').forEach(i => (i.style.transform = tf));
  }
}
const askGaze = () => { if (!gq) { gq = true; requestAnimationFrame(gaze); } };
addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; askGaze(); }, { passive: true });
addEventListener('scroll', askGaze, { passive: true });
const onView = (el, fn, margin = '150px 0px') => new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { o.disconnect(); fn(); } }, { rootMargin: margin }).observe(el);

// ---- hero
const heroP = Portrait($('#hero')); let cur = 'now', lineMode = false;
function show(id, animate = true) {
  cur = id; [...$('#chips').children].forEach(b => b.classList.toggle('on', b.dataset.id === id));
  heroP.draw(id, lineMode, animate).then(() => { live(heroP); askGaze(); });
}
ST.forEach(([id, label]) => { const b = document.createElement('button'); b.textContent = label; b.dataset.id = id; b.onclick = () => show(id); $('#chips').appendChild(b); });
$('#redraw').onclick = () => show(cur);
$('#mode').onclick = e => { lineMode = !lineMode; e.target.textContent = 'mode: ' + (lineMode ? 'line art' : 'colour'); show(cur, false); };
onView($('#hero'), () => show('now'), '0px');

// ---- galleries
function card(grid, id, label, sub) {
  const f = document.createElement('figure'); f.className = 'card'; f.innerHTML = `<div class="art"></div><figcaption><b>${label}</b><span>${sub}</span></figcaption>`;
  grid.appendChild(f); return f;
}
for (const [id, label] of ST) {
  for (const line of [false, true]) {
    const f = card($(line ? '#lines' : '#colour'), id, label, line ? 'line art' : 'illustration');
    onView(f, async () => (f.firstChild.innerHTML = `<img src="${await stillURL(id, line)}" alt="${line ? 'Line drawing' : 'Illustration'} of Nikit: ${label}">`));
    f.onclick = () => big(id, label, line);
  }
  const c = card($('#alive'), id, label, 'animated'); c.classList.add('live');
  const a = c.firstChild; let p = null, off = 0;
  // a canvas portrait only while the card is on screen; a still image otherwise
  new IntersectionObserver(async e => {
    if (e[0].isIntersecting) { clearTimeout(off); if (p) return; p = Portrait(a); p.draw(id, false, true).then(() => p && live(p)); }
    else if (p) off = setTimeout(async () => { p.stop(); living.delete(a); a._blink = 0; p = null; a.innerHTML = `<img src="${await stillURL(id, false)}" alt="">`; }, 1500);
  }, { rootMargin: '80px 0px' }).observe(c);
  c.onclick = () => p && p.draw(id, false, true);
}
async function big(id, label, line) {
  $('#lb').hidden = false; $('#lbTitle').textContent = `${label} · ${line ? 'line art' : 'illustration'}`;
  $('#lbArt').innerHTML = `<img src="${await imgURL(id, line ? 'line' : 'still')}" alt="">`;
}
$('#lb').onclick = e => { if (e.target.id === 'lb' || e.target.id === 'lbClose') { $('#lb').hidden = true; $('#lbArt').innerHTML = ''; } };
addEventListener('keydown', e => { if (e.key === 'Escape') { $('#lb').hidden = true; $('#lbArt').innerHTML = ''; } });
})();
