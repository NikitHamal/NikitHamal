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

function Drawing(el) {
  const cv = document.createElement('canvas'); el.innerHTML = ''; el.appendChild(cv); const ctx = cv.getContext('2d');
  let job = 0;
  async function play(id, dur = 9, onState) {
    const my = ++job, w = Math.round((el.clientWidth || 300) * DPR); cv.width = w; cv.height = Math.round(w * 1.25);
    const [S, smudge, fin] = await Promise.all([strokes(id), bitmap(id, 'smudge', w, cv.height), bitmap(id, w > 640 ? 'large' : 'still', w, cv.height)]);
    if (my !== job) { smudge.close(); fin.close(); return; }
    const k = w / S.W, v = S.v; ctx.lineCap = ctx.lineJoin = 'round';
    if (reduce) { ctx.drawImage(fin, 0, 0); smudge.close(); fin.close(); return; }
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, w, cv.height);
    const t0 = performance.now(), fadeIn = 0.9, fadeOut = 0.8; let next = 0, smudged = 0;
    const stroke = i => {
      let o = S.off[i]; const p = S.pass[v.getUint8(o)] || [1, 0.1], n = v.getUint8(o + 1); let x = v.getUint16(o + 2, true), y = v.getUint16(o + 4, true); o += 6;
      ctx.globalAlpha = p[1]; ctx.lineWidth = p[0] * k; ctx.beginPath(); ctx.moveTo(x * k, y * k);
      for (let j = 1; j < n; j++) { x += v.getInt8(o); y += v.getInt8(o + 1); o += 2; ctx.lineTo(x * k, y * k); }
      ctx.stroke();
    };
    ctx.strokeStyle = GRAPHITE; onState && onState('drawing…');
    (function frame(now) {
      if (my !== job) { smudge.close(); fin.close(); return; }
      const t = (now - t0) / 1000;
      if (smudged < 1) { const a = Math.min(1, t / fadeIn); ctx.globalAlpha = a - smudged; ctx.drawImage(smudge, 0, 0); smudged = a; }
      // ease-out pacing: loose hatching flies by, the fine work slows down
      const f = Math.min(1, Math.max(0, (t - fadeIn * 0.6) / dur)), upto = Math.floor(S.n * (1 - Math.pow(1 - f, 1.7)));
      while (next < upto) stroke(next++);
      if (f < 1) return requestAnimationFrame(frame);
      const g = Math.min(1, (t - fadeIn * 0.6 - dur) / fadeOut); ctx.globalAlpha = g * 0.35 + (g >= 1 ? 1 : 0); ctx.drawImage(fin, 0, 0);
      if (g < 1) return requestAnimationFrame(frame);
      ctx.globalAlpha = 1; ctx.drawImage(fin, 0, 0); smudge.close(); fin.close(); onState && onState(`${S.n.toLocaleString()} strokes`);
    })(t0);
  }
  return { play, stop() { job++; } };
}

// ---- hero
const hero = Drawing($('#hero')); let cur = 'now';
function show(id) { cur = id; [...$('#chips').children].forEach(b => b.classList.toggle('on', b.dataset.id === id)); hero.play(id, 10, s => ($('#status').textContent = s)); }
ST.forEach(([id, label]) => { const b = document.createElement('button'); b.textContent = label; b.dataset.id = id; b.onclick = () => show(id); $('#chips').appendChild(b); });
$('#redraw').onclick = () => show(cur);
new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { o.disconnect(); show('now'); } }).observe($('#hero'));

// ---- galleries
function card(grid, label, sub) {
  const f = document.createElement('figure'); f.className = 'card'; f.innerHTML = `<div class="art paper"></div><figcaption><b>${label}</b><span>${sub}</span></figcaption>`;
  grid.appendChild(f); return f;
}
const onView = (el, fn) => new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { o.disconnect(); fn(); } }, { rootMargin: '150px 0px' }).observe(el);
for (const [id, label] of ST) {
  const f = card($('#stills'), label, 'graphite');
  onView(f, async () => (f.firstChild.innerHTML = `<img src="${await imgURL(id, 'still')}" alt="Pencil portrait of Nikit: ${label}">`));
  f.onclick = () => big(id, label);
  const c = card($('#alive'), label, 'time-lapse'); c.classList.add('live'); const a = c.firstChild; let d = null, off = 0;
  // a canvas only while the card is on screen; the finished still otherwise
  new IntersectionObserver(async e => {
    if (e[0].isIntersecting) { clearTimeout(off); if (d) return; d = Drawing(a); d.play(id, 8); }
    else if (d) off = setTimeout(async () => { d.stop(); d = null; a.innerHTML = `<img src="${await imgURL(id, 'still')}" alt="">`; }, 1500);
  }, { rootMargin: '60px 0px' }).observe(c);
  c.onclick = () => d && d.play(id, 8);
}
async function big(id, label) { $('#lb').hidden = false; $('#lbTitle').textContent = `${label} · graphite`; $('#lbArt').innerHTML = `<img src="${await imgURL(id, 'large')}" alt="">`; }
const closeLb = () => { $('#lb').hidden = true; $('#lbArt').innerHTML = ''; };
$('#lb').onclick = e => { if (e.target.id === 'lb' || e.target.id === 'lbClose') closeLb(); };
addEventListener('keydown', e => e.key === 'Escape' && closeLb());
})();
