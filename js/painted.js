/* Painted portraits with live eyes, for the homepage: the avatar, the portraits gallery and the fullscreen viewer.
 * Each [data-painted="<id>"] gets the eye-less painting (assets/painted/<id>.webp, or -lg.webp in the viewer) and the eyes
 * as an inline SVG on top (assets/painted/<id>-eyes.svg): the irises follow the pointer (or drift on their own when idle /
 * on touch), the eyes blink now and then, and a tap on a face in the viewer winks the eye on that side. */
(() => {
  'use strict';
  const IDS = ['now', 'curls', 'young', 'teen', 'kid', 'baby'];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const svgText = {}, live = new Set(); let uid = 0;
  const eyesFor = id => svgText[id] || (svgText[id] = fetch(`assets/painted/${id}-eyes.svg`).then(r => r.text()));

  async function mount(el, large) {
    const id = el.dataset.painted; el.classList.add('painted'); el.textContent = '';
    const img = new Image(); img.alt = el.dataset.alt || 'Nikit Hamal, painted'; img.decoding = 'async'; img.draggable = false;
    if (el.dataset.eager == null) img.loading = 'lazy';
    img.src = `assets/painted/${id}${large ? '-lg' : ''}.webp`; el.appendChild(img);
    const ov = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); ov.setAttribute('viewBox', '0 0 800 1000'); ov.setAttribute('class', 'painted-eyes'); ov.setAttribute('aria-hidden', 'true');
    const n = ++uid; ov.innerHTML = (await eyesFor(id)).replace(/id="([^"]+)"/g, `id="$1-${n}"`).replace(/url\(#([^)]+)\)/g, `url(#$1-${n})`);
    el.appendChild(ov); el._seed = Math.random() * 100; el._g = { x: 0, y: 0 }; live.add(el);
  }
  // blink (both eyes) or wink (one side)
  function shut(el, side, ms) {
    const sel = side ? `.eye-${side}, .lid-${side}` : '.eye, .lid';
    const parts = el.querySelectorAll(sel); parts.forEach(p => p.classList.add('shut')); setTimeout(() => parts.forEach(p => p.classList.remove('shut')), ms || (side ? 320 : 130));
  }

  // ---- gaze: follow the pointer while it moves, otherwise drift
  let px = innerWidth / 2, py = innerHeight / 3, lastMove = -1e9;
  addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; px = e.clientX; py = e.clientY; lastMove = performance.now(); }, { passive: true });
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now; const idle = (now - lastMove) / 1000;
    for (const el of live) {
      if (!el.isConnected) { live.delete(el); continue; }
      const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
      let tx, ty;
      if (idle < 3 && !reduce) { const dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height * 0.37), m = Math.hypot(dx, dy) || 1, k = Math.min(1, m / (r.width * 1.4)); tx = dx / m * k; ty = dy / m * k; }
      else if (!reduce) { const s = el._seed, t = now / 1000; tx = Math.sin(t * 0.37 + s) * 0.7 + Math.sin(t * 0.91 + s * 2) * 0.3; ty = Math.sin(t * 0.29 + s * 3) * 0.35; if (Math.sin(t * 0.21 + s) > 0.93) tx = Math.sign(tx) * 0.95; }
      else { tx = 0; ty = 0; }
      const g = el._g, f = 1 - Math.pow(idle < 3 ? 0.0004 : 0.08, dt); g.x += (tx - g.x) * f; g.y += (ty - g.y) * f;
      const tf = `translate(${(g.x * 12).toFixed(2)} ${(g.y * 7).toFixed(2)})`;
      if (el._tf !== tf) { el._tf = tf; el.querySelectorAll('.iris').forEach(i => i.setAttribute('transform', tf)); }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  (function blinker() {
    for (const el of live) { const r = el.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight && Math.random() < 0.4) { shut(el); if (Math.random() < 0.15) setTimeout(() => shut(el), 260); } }
    setTimeout(blinker, 1400 + Math.random() * 1800);
  })();

  // ---- the fullscreen viewer: one painting at a time, arrows / swipe / keys to move between them
  const dlg = document.getElementById('paintedDialog');
  let at = 0;
  async function show(i) {
    at = (i + IDS.length) % IDS.length; const stage = dlg.querySelector('.painted-stage');
    const el = document.createElement('div'); el.dataset.painted = IDS[at]; el.dataset.eager = ''; el.className = 'painted-full';
    el.addEventListener('click', e => { const r = el.getBoundingClientRect(); shut(el, e.clientX - r.left < r.width / 2 ? 'r' : 'l'); });   // the viewer's left is his right eye
    stage.replaceChildren(el); await mount(el, true);
    dlg.querySelectorAll('.painted-dot').forEach((d, k) => d.setAttribute('aria-current', k === at ? 'true' : 'false'));
  }
  function open(i) { if (!dlg) return; show(i); if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); }
  if (dlg) {
    dlg.querySelector('.painted-prev').addEventListener('click', () => show(at - 1));
    dlg.querySelector('.painted-next').addEventListener('click', () => show(at + 1));
    dlg.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') show(at - 1); if (e.key === 'ArrowRight') show(at + 1); });
    let sx = null; dlg.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', e => { if (sx == null) return; const d = e.changedTouches[0].clientX - sx; if (Math.abs(d) > 50) show(at + (d < 0 ? 1 : -1)); sx = null; });
    const dots = dlg.querySelector('.painted-dots'); IDS.forEach((_, k) => { const b = document.createElement('button'); b.className = 'painted-dot'; b.setAttribute('aria-label', `Painting ${k + 1} of ${IDS.length}`); b.addEventListener('click', () => show(k)); dots.appendChild(b); });
    dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  }

  // ---- mount: the avatar now, the gallery when it is first seen
  const av = document.getElementById('avatarPainted');
  if (av) { mount(av, false); document.getElementById('avatarContainer').addEventListener('click', () => open(0)); }
  const grid = document.getElementById('paintedGrid');
  if (grid) {
    IDS.forEach((id, k) => { const b = document.createElement('button'); b.className = 'painted-card'; b.setAttribute('aria-label', `Open painting ${k + 1} of ${IDS.length}`); const d = document.createElement('div'); d.dataset.painted = id; b.appendChild(d); b.addEventListener('click', () => open(k)); grid.appendChild(b); });
    const go = () => grid.querySelectorAll('[data-painted]').forEach(d => mount(d, false));
    if ('IntersectionObserver' in window) new IntersectionObserver((es, o) => { if (es.some(e => e.isIntersecting)) { o.disconnect(); go(); } }, { rootMargin: '300px' }).observe(grid); else go();
  }
})();
