/* link-previews.js — hover / focus preview cards for the bio links (Consica Labs, NEBians, Lami Nepal, AstroWeb).
 * A small card rises above the link with an animated pixel banner (js/pixel-cards.js), the logo, the domain and a
 * one-line description. It springs out of the link, leans gently toward the pointer, stays open while you move
 * into it, and flips below the link when there is no room above. Pointer devices with hover only. */
(() => {
  'use strict';
  const D = document;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const INFO = {
    'consicalabs.com': { kind: 'consica', title: 'Consica Labs', tag: 'Head of Operations', desc: 'The studio behind NEBians and AstroWeb, where I lead operations.', logo: 'assets/consica-logo.png' },
    'nebians.consica.com.np': { kind: 'neb', title: 'NEBians', tag: 'Android · Django', desc: 'Material 3 Android app and Django backend for Nepali NEB students: study tools, AI chat arena, forums, result checker.', logo: 'assets/neb-logo.svg' },
    'play.google.com': { kind: 'lami', title: 'Lami Nepal', tag: 'Flutter · Firebase', desc: 'Matrimonial and spiritual services app with real-time chat, push notifications and full Nepali localization.', logo: 'assets/lami-logo-120.webp' },
    'astroweb.consicalabs.com': { kind: 'astro', title: 'AstroWeb', tag: 'SvelteKit · TypeScript', desc: 'Free Vedic astrology web app with accurate Kundali, Dasha calculations and astrological insights.', logo: 'assets/astroweb-logo.png' }
  };
  const infoFor = a => { try { const u = new URL(a.href); return INFO[u.hostname.replace(/^www\./, '')] || null; } catch (e) { return null; } };

  const card = D.createElement('div'); card.className = 'lp-card'; card.setAttribute('role', 'tooltip'); card.id = 'lp-card';
  card.innerHTML = '<div class="lp-banner"><canvas></canvas><span class="lp-logo"><img alt=""></span></div><div class="lp-body"><div class="lp-head"><strong class="lp-title"></strong><span class="lp-tag"></span></div><p class="lp-desc"></p><span class="lp-url"></span></div><span class="lp-caret"></span>';
  D.body.appendChild(card);
  const $ = s => card.querySelector(s);
  let cur = null, scene = null, openT = 0, closeT = 0, over = false;

  function place(a) {
    const r = a.getBoundingClientRect(), cw = card.offsetWidth, ch = card.offsetHeight, m = 12;
    const above = r.top - ch - 14 > 8, x = Math.min(innerWidth - cw - m, Math.max(m, r.left + r.width / 2 - cw / 2));
    const y = above ? r.top - ch - 12 : r.bottom + 12;
    card.style.left = x + 'px'; card.style.top = y + 'px';
    card.classList.toggle('below', !above);
    const cx = Math.max(16, Math.min(cw - 16, r.left + r.width / 2 - x));
    card.style.setProperty('--cx', cx + 'px'); card.style.transformOrigin = `${cx}px ${above ? '100%' : '0%'}`;
  }
  function show(a) {
    const info = infoFor(a); if (!info) return;
    clearTimeout(closeT);
    if (cur === a && card.classList.contains('on')) return;
    cur = a;
    $('.lp-title').textContent = info.title; $('.lp-tag').textContent = info.tag; $('.lp-desc').textContent = info.desc;
    $('.lp-url').textContent = new URL(a.href).hostname.replace(/^www\./, '') + ' ↗'; $('.lp-logo img').src = info.logo;
    if (scene) scene.stop(); scene = window.PixelCards ? window.PixelCards.mount(info.kind, $('canvas'), 288, 96) : null;
    a.setAttribute('aria-describedby', 'lp-card');
    card.classList.remove('on'); void card.offsetWidth; place(a); card.classList.add('on');
    D.dispatchEvent(new CustomEvent('sky:sfx', { detail: 'tap' }));
  }
  function hide(now) {
    clearTimeout(openT); clearTimeout(closeT);
    const go = () => { if (over) return; card.classList.remove('on'); if (cur) cur.removeAttribute('aria-describedby'); cur = null; setTimeout(() => { if (!cur && scene) { scene.stop(); scene = null; } }, 300); };
    if (now) go(); else closeT = setTimeout(go, 160);
  }
  D.querySelectorAll('a.bio-link').forEach(a => {
    if (!infoFor(a)) return;
    a.addEventListener('pointerenter', () => { clearTimeout(closeT); clearTimeout(openT); openT = setTimeout(() => show(a), card.classList.contains('on') ? 0 : 180); });
    a.addEventListener('pointerleave', () => { clearTimeout(openT); hide(); });
    a.addEventListener('focus', () => show(a)); a.addEventListener('blur', () => hide(true));
    // the card leans a touch toward the pointer while it moves along the link
    a.addEventListener('pointermove', e => { if (!card.classList.contains('on') || reduce) return; const r = a.getBoundingClientRect(), u = (e.clientX - r.left) / r.width - .5; card.style.setProperty('--lean', (u * 4).toFixed(2) + 'deg'); card.style.setProperty('--shift', (u * 8).toFixed(1) + 'px'); });
  });
  card.addEventListener('pointerenter', () => { over = true; clearTimeout(closeT); });
  card.addEventListener('pointerleave', () => { over = false; hide(); });
  card.addEventListener('click', () => { if (cur) cur.click(); });
  addEventListener('scroll', () => { if (card.classList.contains('on')) hide(true); }, { passive: true });
  D.addEventListener('keydown', e => { if (e.key === 'Escape') hide(true); });
})();
