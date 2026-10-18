/* Painted portraits with live eyes, for the homepage: the avatar, the portraits gallery and the fullscreen viewer.
 * Each [data-painted="<id>"] gets the eye-less painting (assets/painted/<id>.webp, 800x1000) and the eyes
 * as an inline SVG on top (assets/painted/<id>-eyes.svg): the irises follow the pointer while it is near the painting
 * (or drift on their own when it is far / idle / on touch), the eyes blink now and then, and a tap on a face in the
 * viewer winks the eye on that side.
 * The viewer opens with a shared-element zoom from the thumbnail you clicked, slides between paintings, follows a
 * swipe under your finger and flies back home on close. */
(() => {
  'use strict';
  const IDS = ['now', 'curls', 'young', 'teen', 'kid', 'baby'];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(.22,1,.36,1)';
  const svgText = {}, live = new Set(); let uid = 0;
  const eyesFor = id => svgText[id] || (svgText[id] = fetch(`assets/painted/${id}-eyes.svg`).then(r => r.text()));

  async function mount(el) {
    const id = el.dataset.painted; el.classList.add('painted'); el.textContent = '';
    const img = new Image(); img.alt = el.dataset.alt || 'Nikit Hamal, painted'; img.decoding = 'async'; img.draggable = false;
    if (el.dataset.eager == null) img.loading = 'lazy';
    img.src = `assets/painted/${id}.webp`; el.appendChild(img);   // 800x1000 everywhere, so the painting is as sharp as the vector eyes
    const ov = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); ov.setAttribute('viewBox', '0 0 800 1000'); ov.setAttribute('class', 'painted-eyes'); ov.setAttribute('aria-hidden', 'true');
    // 'slice' scales the eyes exactly like object-fit: cover scales the painting, so they stay glued to the face
    // even if the box is ever not exactly 4:5 (the old 'meet' default shrank them on narrow phones)
    ov.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const n = ++uid; ov.innerHTML = (await eyesFor(id)).replace(/id="([^"]+)"/g, `id="$1-${n}"`).replace(/url\(#([^)]+)\)/g, `url(#$1-${n})`);
    el.appendChild(ov); el._seed = Math.random() * 100; el._g = { x: 0, y: 0 }; live.add(el);
    return img.decode ? img.decode().catch(() => {}) : null;
  }
  // blink (both eyes) or wink (one side)
  function shut(el, side, ms) {
    const sel = side ? `.eye-${side}, .lid-${side}` : '.eye, .lid';
    const parts = el.querySelectorAll(sel); parts.forEach(p => p.classList.add('shut')); setTimeout(() => parts.forEach(p => p.classList.remove('shut')), ms || (side ? 320 : 130));
  }

  // ---- gaze: follow the pointer while it is close to a painting, otherwise drift
  // A painting only "notices" the pointer inside a halo around itself (about 2x its own size, at least 170px),
  // so moving around the rest of the page no longer drags the eyes along. The viewer's painting fills the screen,
  // so its halo is simply the open dialog.
  let px = -1e5, py = -1e5, lastMove = -1e9;
  addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; px = e.clientX; py = e.clientY; lastMove = performance.now(); }, { passive: true });
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now; const idle = (now - lastMove) / 1000;
    for (const el of live) {
      if (!el.isConnected) { live.delete(el); continue; }
      const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height * 0.37, dx = px - cx, dy = py - cy, m = Math.hypot(dx, dy) || 1;
      const full = el.classList.contains('painted-full'), reach = full ? Infinity : Math.max(170, Math.max(r.width, r.height) * 1.9);
      const near = idle < 3 && m < reach && !reduce;
      let tx, ty;
      if (near) { const k = Math.min(1, m / (r.width * (full ? 0.9 : 1.4))); tx = dx / m * k; ty = dy / m * k; }
      else if (!reduce) { const s = el._seed, t = now / 1000; tx = Math.sin(t * 0.37 + s) * 0.7 + Math.sin(t * 0.91 + s * 2) * 0.3; ty = Math.sin(t * 0.29 + s * 3) * 0.35; if (Math.sin(t * 0.21 + s) > 0.93) tx = Math.sign(tx) * 0.95; }
      else { tx = 0; ty = 0; }
      const g = el._g, f = 1 - Math.pow(near ? 0.0004 : 0.08, dt); g.x += (tx - g.x) * f; g.y += (ty - g.y) * f;
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
  let at = 0, origin = null, busy = false;
  const stage = dlg && dlg.querySelector('.painted-stage');

  function makeFull(i) {
    const el = document.createElement('div'); el.dataset.painted = IDS[i]; el.dataset.eager = ''; el.className = 'painted-full';
    el.addEventListener('click', e => { if (el._dragged) return; const r = el.getBoundingClientRect(); shut(el, e.clientX - r.left < r.width / 2 ? 'l' : 'r'); });   // wink the eye on the side you tap
    return el;
  }
  function setDots() { dlg.querySelectorAll('.painted-dot').forEach((d, k) => d.setAttribute('aria-current', k === at ? 'true' : 'false')); }

  // slide to painting i; dir = +1 (next, comes in from the right) / -1; from = current drag offset in px
  async function show(i, dir, from) {
    if (busy) return; const next = (i + IDS.length) % IDS.length;
    const cur = stage.querySelector('.painted-full');
    if (cur && next === at && !from) return;
    at = next; setDots();
    const el = makeFull(at); el.style.visibility = 'hidden'; stage.appendChild(el);
    await mount(el); el.style.visibility = '';
    if (!cur || reduce) { if (cur) cur.remove(); return; }
    busy = true; const w = stage.getBoundingClientRect().width + 40, d = dir || 1;
    cur.style.position = 'absolute'; cur.style.inset = '0';
    const out = cur.animate([{ transform: `translateX(${from || 0}px)`, opacity: 1 }, { transform: `translateX(${-d * w * 0.6}px) scale(.9) rotate(${-d * 2}deg)`, opacity: 0, filter: 'blur(3px)' }], { duration: 520, easing: EASE, fill: 'forwards' });
    el.animate([{ transform: `translateX(${d * w * 0.7 + (from || 0)}px) scale(.94) rotate(${d * 2.5}deg)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 640, easing: EASE });
    await out.finished.catch(() => {}); cur.remove(); busy = false;
  }

  // FLIP: fly a painting between a thumbnail rect and the stage rect
  function fly(el, fromRect, toRect, back) {
    const sx = fromRect.width / toRect.width, sy = fromRect.height / toRect.height;
    const tx = fromRect.left + fromRect.width / 2 - (toRect.left + toRect.width / 2), ty = fromRect.top + fromRect.height / 2 - (toRect.top + toRect.height / 2);
    const thumb = { transform: `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`, borderRadius: `${14 / sx}px` }, big = { transform: 'none', borderRadius: '16px' };
    return el.animate(back ? [big, thumb] : [thumb, big], { duration: back ? 460 : 640, easing: back ? 'cubic-bezier(.5,0,.2,1)' : EASE, fill: 'both' });
  }

  async function open(i, fromEl) {
    if (!dlg) return; at = (i + IDS.length) % IDS.length; origin = fromEl || null; setDots();
    stage.replaceChildren(); const el = makeFull(at); stage.appendChild(el);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    dlg.classList.remove('is-closing'); dlg.classList.add('is-opening');
    const ready = mount(el);
    if (!reduce && origin) {
      el.style.visibility = 'hidden'; await Promise.race([ready, new Promise(r => setTimeout(r, 400))]); el.style.visibility = '';
      fly(el, origin.getBoundingClientRect(), stage.getBoundingClientRect()).finished.then(a => { el.getAnimations().forEach(x => x.cancel()); }).catch(() => {});
      origin.style.visibility = 'hidden';
    }
    requestAnimationFrame(() => dlg.classList.remove('is-opening'));
  }
  async function close() {
    if (!dlg || !dlg.open || dlg.classList.contains('is-closing')) return;
    const el = stage.querySelector('.painted-full');
    dlg.classList.add('is-closing');
    // only fly home to the thumbnail that is actually showing this painting
    const home = origin && origin.isConnected && origin.dataset.paintedIndex == at ? origin : document.querySelector(`[data-painted-index="${at}"]`);
    if (!reduce && el) {
      if (home && home.getBoundingClientRect().bottom > 0 && home.getBoundingClientRect().top < innerHeight) {
        home.style.visibility = 'hidden';
        await fly(el, home.getBoundingClientRect(), stage.getBoundingClientRect(), true).finished.catch(() => {});
      } else await el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.92)' }], { duration: 300, easing: EASE, fill: 'forwards' }).finished.catch(() => {});
    }
    document.querySelectorAll('[data-painted-index]').forEach(t => { t.style.visibility = ''; });
    dlg.close(); dlg.classList.remove('is-closing'); stage.replaceChildren(); origin = null;
  }

  if (dlg) {
    dlg.querySelector('.painted-prev').addEventListener('click', () => show(at - 1, -1));
    dlg.querySelector('.painted-next').addEventListener('click', () => show(at + 1, 1));
    dlg.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') show(at - 1, -1); if (e.key === 'ArrowRight') show(at + 1, 1); if (e.key === 'Escape') { e.preventDefault(); close(); } });
    dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
    // swipe: the painting follows the finger, then either snaps back or slides on
    let sx = null, sy = 0, dx = 0, drag = null;
    stage.addEventListener('pointerdown', e => { if (busy || e.button > 0) return; sx = e.clientX; sy = e.clientY; dx = 0; drag = stage.querySelector('.painted-full'); if (drag) drag._dragged = false; });
    addEventListener('pointermove', e => {
      if (sx == null || !drag) return; dx = e.clientX - sx;
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - sy)) { drag._dragged = true; drag.style.transform = `translateX(${dx}px) rotate(${dx / 60}deg)`; drag.style.transition = 'none'; }
    }, { passive: true });
    addEventListener('pointerup', () => {
      if (sx == null || !drag) { sx = null; return; } const el = drag; sx = null; drag = null;
      if (Math.abs(dx) > 60) { el.style.transform = ''; show(at + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1, dx); }
      else if (el._dragged) { el.animate([{ transform: el.style.transform }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.3,1.6,.5,1)' }); el.style.transform = ''; }
      setTimeout(() => { el._dragged = false; }, 0);
    });
    const dots = dlg.querySelector('.painted-dots'); IDS.forEach((_, k) => { const b = document.createElement('button'); b.className = 'painted-dot'; b.setAttribute('aria-label', `Painting ${k + 1} of ${IDS.length}`); b.addEventListener('click', () => show(k, k > at ? 1 : -1)); dots.appendChild(b); });
    dlg.querySelector('[data-close]').addEventListener('click', close);
    dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  }

  // ---- mount: the avatar now, the gallery when it is first seen
  const av = document.getElementById('avatarPainted');
  if (av) { av.dataset.paintedIndex = 0; mount(av); document.getElementById('avatarContainer').addEventListener('click', () => open(0, av)); }
  const grid = document.getElementById('paintedGrid');
  if (grid) {
    IDS.forEach((id, k) => { const b = document.createElement('button'); b.className = 'painted-card'; b.style.setProperty('--i', k); b.setAttribute('aria-label', `Open painting ${k + 1} of ${IDS.length}`); const d = document.createElement('div'); d.dataset.painted = id; d.dataset.paintedIndex = k; b.appendChild(d); b.addEventListener('click', () => open(k, d)); grid.appendChild(b); });
    const go = () => grid.querySelectorAll('[data-painted]').forEach(d => mount(d));
    if ('IntersectionObserver' in window) new IntersectionObserver((es, o) => { if (es.some(e => e.isIntersecting)) { o.disconnect(); go(); } }, { rootMargin: '300px' }).observe(grid); else go();
  }
})();
