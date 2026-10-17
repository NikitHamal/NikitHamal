(() => {
'use strict';
const ST = [['baby', 'Baby'], ['kid', 'Kid'], ['teen', 'Teen'], ['young', 'Young'], ['curls', 'Curls'], ['now', 'Now']];
const $ = s => document.querySelector(s), cache = {};
// each drawing is stored as a few text parts (art/<id>.<i>.part, listed in art/index.json)
let manifest;
const svgText = id => cache[id] || (cache[id] = (manifest = manifest || fetch('art/index.json').then(r => r.json()))
  .then(m => Promise.all(Array.from({ length: m[id] }, (_, i) => fetch(`art/${id}.${i}.part`).then(r => r.text())))).then(p => p.join('')));
const svgURL = id => svgText(id).then(t => URL.createObjectURL(new Blob([t], { type: 'image/svg+xml' })));
let uid = 0;
// inline an svg, giving its internal ids a unique suffix so many copies can share the page
async function mount(el, id, cls = '') {
  const n = ++uid; let t = await svgText(id);
  t = t.replace(/id="([^"]+)"/g, `id="$1-${n}"`).replace(/url\(#([^)]+)\)/g, `url(#$1-${n})`);
  el.innerHTML = t; if (cls) el.classList.add(...cls.split(' ')); return el.querySelector('svg');
}
const onView = (el, fn) => new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { o.disconnect(); fn(); } }, { rootMargin: '150px 0px' }).observe(el);

// ---- draw-in animation: ink in reading order (outlines → features → hair), colour after
function animate(svg, total = 3.2) {
  const art = svg.parentElement; art.classList.remove('drawing'); void art.offsetWidth;
  const paths = [...svg.querySelectorAll('.inks path, .details path')], n = paths.length;
  paths.forEach((p, i) => { p.setAttribute('pathLength', '1'); p.style.setProperty('--t', (i / n * total).toFixed(3) + 's'); p.style.setProperty('--d', (0.5 + Math.random() * 0.6).toFixed(2) + 's'); });
  art.style.setProperty('--ce', (total * 0.55).toFixed(2) + 's'); art.style.setProperty('--cw', (total + 0.4).toFixed(2) + 's');
  art.classList.add('drawing');
}
// ---- life: blink + gaze
const living = new Set();
function live(art) {
  living.add(art);
  const blink = () => { if (!art.isConnected) return; const e = art.querySelectorAll('.eye'); e.forEach(x => x.classList.add('shut')); setTimeout(() => e.forEach(x => x.classList.remove('shut')), 120); setTimeout(blink, 2200 + Math.random() * 4000); };
  setTimeout(blink, 4500 + Math.random() * 2000);
}
let px = innerWidth / 2, py = innerHeight / 3;
function gaze() {
  for (const art of living) {
    const r = art.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
    const dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height * 0.32), m = Math.hypot(dx, dy) || 1, k = Math.min(1, m / 300), sc = 800 / r.width;
    const tx = dx / m * 5 * k, ty = dy / m * 3 * k;
    art.querySelectorAll('.iris').forEach(i => (i.style.transform = `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px)`));
  }
}
addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; gaze(); }, { passive: true });
addEventListener('scroll', gaze, { passive: true });

// ---- hero
const hero = $('#hero'); let cur = 'now', lineMode = false;
async function show(id) {
  cur = id; [...$('#chips').children].forEach(b => b.classList.toggle('on', b.dataset.id === id));
  const svg = await mount(hero, id); hero.classList.toggle('lineart', lineMode); animate(svg); live(hero); gaze();
}
ST.forEach(([id, label]) => { const b = document.createElement('button'); b.textContent = label; b.dataset.id = id; b.onclick = () => show(id); $('#chips').appendChild(b); });
$('#redraw').onclick = () => show(cur);
$('#mode').onclick = e => { lineMode = !lineMode; e.target.textContent = 'mode: ' + (lineMode ? 'line art' : 'colour'); hero.classList.toggle('lineart', lineMode); };
onView(hero, () => show('now'));

// ---- galleries
function card(grid, id, label, sub, fill) {
  const f = document.createElement('figure'); f.className = 'card'; f.innerHTML = `<div class="art"></div><figcaption><b>${label}</b><span>${sub}</span></figcaption>`;
  grid.appendChild(f); onView(f, () => fill(f.firstChild)); return f;
}
for (const [id, label] of ST) {
  card($('#colour'), id, label, 'illustration', async a => (a.innerHTML = `<img src="${await svgURL(id)}" alt="Illustration of Nikit: ${label}">`)).onclick = () => big(id, label, false);
  card($('#lines'), id, label, 'line art', a => mount(a, id, 'lineart')).onclick = () => big(id, label, true);
  const c = card($('#alive'), id, label, 'animated', async a => { const s = await mount(a, id, 'alive'); animate(s); live(a); });
  c.classList.add('live'); c.onclick = () => { const s = c.querySelector('svg'); s && animate(s); };
}
async function big(id, label, line) { $('#lb').hidden = false; $('#lbTitle').textContent = `${label} · ${line ? 'line art' : 'illustration'}`; const a = $('#lbArt'); a.className = 'art' + (line ? ' lineart' : ''); await mount(a, id); }
$('#lb').onclick = e => { if (e.target.id === 'lb' || e.target.id === 'lbClose') $('#lb').hidden = true; };
addEventListener('keydown', e => e.key === 'Escape' && ($('#lb').hidden = true));
})();
