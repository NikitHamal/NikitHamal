/* motion.js — the site's motion layer.
 *  - entrance: the first screen assembles itself in a choreographed cascade (avatar, the name letter by letter,
 *    bio, sections), and everything further down reveals as it scrolls into view
 *  - header: tucks away while you read down, slides back when you scroll up
 *  - avatar: tilts toward the pointer in 3D with a moving sheen
 *  - controls: a light magnetic pull on nav links and toggles
 * Pure progressive enhancement: html.motion is only set (in the <head>) when motion is allowed, and every
 * element is force-revealed after a few seconds no matter what. */
(() => {
  'use strict';
  const D = document, R = D.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- entrance + scroll reveals ---------- */
  function reveals() {
    const groups = [
      '.top-bar', '.avatar-container', '.profile-name', '.profile-name-row pixel-dog', '.profile-bio',
      '.accordion-item', '.read-article-header', '.read-cover-art', '.read-prose-body', '.writing-header', '.page-header',
      '.writing-controls', '.writing-list > *', '.writing-grid > *', 'pixel-footer', '.minimal-footer', '.pond-head', '.pond-frame'
    ];
    const els = [];
    groups.forEach(sel => D.querySelectorAll(sel).forEach(el => { if (!els.includes(el) && !el.closest('.rv')) els.push(el); }));
    if (!R.classList.contains('motion') || reduce) return;
    const name = D.querySelector('.profile-name');
    if (name && !name.querySelector('.ch')) {
      const txt = name.textContent; name.setAttribute('aria-label', txt); name.textContent = '';
      [...txt].forEach((c, i) => { const s = D.createElement('span'); s.className = 'ch'; s.setAttribute('aria-hidden', 'true'); s.style.setProperty('--ci', i); s.textContent = c; name.appendChild(s); });
    }
    let first = 0;
    els.forEach(el => {
      el.classList.add('rv'); if (el.matches('.avatar-container')) el.classList.add('rv-avatar');
      const r = el.getBoundingClientRect();
      // the first screen cascades in order; later elements reveal on their own as they arrive
      el.style.setProperty('--rv-i', r.top < innerHeight ? Math.min(first++, 10) : 0);
    });
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px', threshold: .01 });
    requestAnimationFrame(() => requestAnimationFrame(() => els.forEach(el => io.observe(el))));
    // after the cascade, drop the stagger so later hovers/reflows are instant
    setTimeout(() => els.forEach(el => { if (el.classList.contains('in')) el.style.setProperty('--rv-i', 0); }), 2200);
    setTimeout(() => els.forEach(el => el.classList.add('in')), 6000);   // safety net
  }

  /* ---------- stagger indices for cascades inside sections ---------- */
  function indices() {
    ['.project-cards', '.contact-rows', '.skills-mini-grid', '.writing-mini-list'].forEach(sel => D.querySelectorAll(sel).forEach(box => [...box.children].forEach((c, i) => c.style.setProperty('--i', i))));
    // the writing preview fills in later
    const wp = D.getElementById('writing-preview');
    if (wp) new MutationObserver(() => [...wp.children].forEach((c, i) => c.style.setProperty('--i', i))).observe(wp, { childList: true });
  }

  /* ---------- smart header ---------- */
  function header() {
    const h = D.querySelector('.site-header'); if (!h || reduce) return;
    let lastY = scrollY, acc = 0, ticking = false;
    const progress = () => { const max = R.scrollHeight - innerHeight; h.style.setProperty('--progress', max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0); };
    progress(); addEventListener('resize', progress, { passive: true });
    addEventListener('scroll', () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        const y = scrollY, d = y - lastY; lastY = y; ticking = false; progress();
        acc = (d > 0) === (acc > 0) ? acc + d : d;
        if (y < 140 || acc < -24) h.classList.remove('is-hidden');
        else if (acc > 48 && !h.contains(D.activeElement)) h.classList.add('is-hidden');
      });
    }, { passive: true });
  }

  /* ---------- avatar tilt ---------- */
  function tilt() {
    const box = D.getElementById('avatarContainer'), av = D.getElementById('avatarPainted'); if (!box || !av || reduce || !fine) return;
    box.addEventListener('pointermove', e => {
      const r = av.getBoundingClientRect(), u = (e.clientX - r.left) / r.width - .5, v = (e.clientY - r.top) / r.height - .5;
      box.classList.add('is-tilting');
      av.style.setProperty('--ry', (u * 16).toFixed(2) + 'deg'); av.style.setProperty('--rx', (-v * 14).toFixed(2) + 'deg');
      av.style.setProperty('--sx', ((u + .5) * 100).toFixed(1) + '%'); av.style.setProperty('--sy', ((v + .5) * 100).toFixed(1) + '%');
    });
    box.addEventListener('pointerleave', () => { box.classList.remove('is-tilting'); av.style.setProperty('--rx', '0deg'); av.style.setProperty('--ry', '0deg'); });
  }

  /* ---------- magnetic controls ---------- */
  function magnetic() {
    if (reduce || !fine) return;
    D.querySelectorAll('.site-nav-link, .theme-toggle, .weather-toggle, .nav-back-link, .skill-orb, .contact-orb').forEach(el => {
      el.classList.add('magnetic'); el.style.transition = (getComputedStyle(el).transition || '') + ', translate .5s cubic-bezier(.34,1.56,.64,1)';
      el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2; el.style.translate = `${(x * .18).toFixed(1)}px ${(y * .22).toFixed(1)}px`; });
      el.addEventListener('pointerleave', () => { el.style.translate = ''; });
    });
  }

  /* ---------- koi pond: opens full screen or not at all ----------
     The pond's window shape is tied to its scroll position: closed, it is an inset rounded window; as it rises it
     widens until it fills the screen exactly when it reaches the top. When scrolling settles halfway, it glides fully
     open (heading down) or fully closed (heading up). "dive in" / "back up" buttons and Esc do the same. */
  function pondSnap() {
    const frame = D.getElementById('pond'), sec = frame && frame.closest('.pond-section'); if (!frame || !sec) return;
    let lastY = scrollY, dir = 0, timer = 0, anim = 0, touching = false, gliding = false, wasOpen = false, ticking = false;
    const ease = t => t < .5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2;     // easeInOutQuint
    const openTop = () => scrollY + frame.getBoundingClientRect().top, closedTop = () => openTop() - innerHeight;
    const shape = () => {                                     // window shape follows the scroll position
      ticking = false; const r = frame.getBoundingClientRect(), vh = innerHeight;
      const p = Math.max(0, Math.min(1, 1 - r.top / vh)), k = Math.pow(1 - p, 1.4);
      sec.style.setProperty('--pk', k.toFixed(4)); sec.style.setProperty('--pp', p.toFixed(4));
      const open = Math.abs(r.top) < 2; sec.classList.toggle('is-open', open);
      if (open !== wasOpen) { wasOpen = open; D.dispatchEvent(new CustomEvent('sky:sfx', { detail: open ? 'open' : 'close' })); }
    };
    const glide = to => {
      cancelAnimationFrame(anim); const from = scrollY, dist = to - from; if (Math.abs(dist) < 2) return;
      if (reduce) { scrollTo({ top: to, behavior: 'instant' }); return; }
      gliding = true; const dur = Math.min(1000, 520 + Math.abs(dist) * .55), t0 = performance.now();
      const step = now => { const k = Math.min(1, (now - t0) / dur); scrollTo({ top: from + dist * ease(k), behavior: 'instant' }); if (k < 1) anim = requestAnimationFrame(step); else { gliding = false; lastY = scrollY; } };
      anim = requestAnimationFrame(step);
    };
    const settle = () => {
      if (touching || gliding) return;
      const r = frame.getBoundingClientRect(), vh = innerHeight, vis = Math.min(vh, r.bottom) - Math.max(0, r.top);
      if (vis <= 1 || Math.abs(r.top) < 2 || r.top < 0) return;
      const frac = vis / vh, open = dir >= 0 ? frac > .1 : frac > .9;
      glide(open ? openTop() : closedTop());
    };
    addEventListener('scroll', () => {
      const y = scrollY; if (!gliding && y !== lastY) dir = y > lastY ? 1 : -1; lastY = y;
      if (!ticking) { ticking = true; requestAnimationFrame(shape); }
      if (!gliding) { clearTimeout(timer); timer = setTimeout(settle, 150); }
    }, { passive: true });
    addEventListener('resize', shape, { passive: true }); shape();
    addEventListener('touchstart', () => { touching = true; if (gliding) { cancelAnimationFrame(anim); gliding = false; } }, { passive: true });
    addEventListener('touchend', () => { touching = false; clearTimeout(timer); timer = setTimeout(settle, 200); }, { passive: true });
    addEventListener('wheel', () => { if (gliding) { cancelAnimationFrame(anim); gliding = false; } }, { passive: true });
    const dive = sec.querySelector('.pond-dive'), up = sec.querySelector('.pond-up');
    if (dive) dive.addEventListener('click', () => { dir = 1; glide(openTop()); });
    if (up) up.addEventListener('click', () => { dir = -1; glide(closedTop()); });
    D.addEventListener('keydown', e => { if (e.key === 'Escape' && sec.classList.contains('is-open') && !D.querySelector('dialog[open]')) { dir = -1; glide(closedTop()); } });
  }

  function boot() { indices(); reveals(); header(); tilt(); pondSnap(); setTimeout(magnetic, 50); }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot); else boot();
})();
