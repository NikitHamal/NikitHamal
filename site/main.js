/* main.js — the quiet machinery: nav, time of day, reveals, mantras, essays, sizing. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const root = document.documentElement;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);

  /* ---------- pixel ornaments ---------- */
  const BINDU = ['...ooo...', '..o...o..', '.o..o..o.', 'o..ooo..o', 'o.ooooo.o', 'o..ooo..o', '.o..o..o.', '..o...o..', '...ooo...'];
  const LOTUS = ['......o......', '.....ooo.....', '..o..ooo..o..', '.ooo.ooo.ooo.', 'ooooooooooooo', '.ooooooooooo.', '...ooooooo...'];
  const cur = { o: 'currentColor' };
  $('#brandMark').innerHTML = PX.icon(BINDU, cur, 22);
  [1, 2, 3, 4, 5].forEach((i) => { const el = $('#lotus' + i); if (el) el.innerHTML = PX.icon(LOTUS, cur, 26); });

  const ICONS = {
    dawn: ['....o....', '.o..o..o.', '.........', '...ooo...', '..ooooo..', 'ooooooooo', '.........', '.ooooooo.', '..ooooo..'],
    day: ['....o....', '.o.....o.', '...ooo...', '..ooooo..', 'o.ooooo.o', '..ooooo..', '...ooo...', '.o.....o.', '....o....'],
    dusk: ['.........', '....o....', '...ooo...', '..ooooo..', 'ooooooooo', '.........', 'ooo.ooo.o', '..ooooo..', '....o....'],
    night: ['...ooo...', '..oo.....', '.oo...o..', '.oo......', '.oo......', '.oo..o...', '..oo...o.', '...oooo..', '.........'],
  };
  const LABEL = { dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' };
  const CAP = {
    dawn: 'Dawn — the seeker waits for what was never absent.',
    day: 'Noon — nothing hides, nothing is found.',
    dusk: 'Dusk — even the light is only passing through.',
    night: 'Night — the eyes of the stupa never close.',
  };
  const THEME = { dawn: '#f6e6d8', day: '#f3ecdc', dusk: '#241a36', night: '#0c0e1f' };

  /* ---------- time of day ---------- */
  const ph = $('#phases');
  Scene.names.forEach((n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', LABEL[n]);
    b.title = LABEL[n];
    b.dataset.p = n;
    b.innerHTML = PX.icon(ICONS[n], cur, 16);
    b.addEventListener('click', () => Scene.set(n, true));
    ph.appendChild(b);
  });
  const capEl = $('#plateCap'), meta = $('meta[name="theme-color"]');
  Scene.on((i) => {
    const n = Scene.names[i];
    $$('button', ph).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.p === n)));
    if (capEl) {
      capEl.style.opacity = 0;
      setTimeout(() => { capEl.textContent = CAP[n]; capEl.style.opacity = 1; }, 280);
    }
    if (meta) meta.content = THEME[n];
  });

  /* ---------- sizing: whole device pixels per art pixel, never smeared ---------- */
  const fit = (art, avail, max) => art * (Math.max(1, Math.min(max || 99, Math.floor((avail * dpr) / art))) / dpr);
  const archCol = $('.arch-col');
  function sizeAll() {
    if (archCol) {
      const avail = Math.min(archCol.clientWidth - 22, innerHeight * 0.62 * 0.75);
      const cw = fit(144, Math.max(avail, 144), 4.2);
      archCol.style.setProperty('--arch-w', cw + 22 + 'px');
    }
    $$('.matte').forEach((m) => {
      const cv = $('canvas', m); if (!cv) return;
      const w = fit(120, m.clientWidth - 28 - 12, 4.2);
      cv.style.width = w + 'px'; cv.style.height = (w * 80) / 120 + 'px';
    });
    const mw = $('.about-art');
    if (mw) mw.style.setProperty('--mw', fit(96, Math.min(mw.clientWidth, 400), 4.2) + 'px');
  }
  sizeAll();
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(sizeAll, 80); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeAll);

  /* ---------- nav ---------- */
  const nav = $('#nav'), prog = $('#progress'), sheet = $('#sheet'), menu = $('#menu');
  let lastY = 0, tick = false;
  const secs = ['about', 'works', 'writing', 'lab', 'contact'].map((id) => $('#' + id));
  const links = $$('.links a');
  function onScroll() {
    tick = false;
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    prog.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
    nav.classList.toggle('solid', y > 24);
    if (!sheet.classList.contains('open')) nav.classList.toggle('hide', y > 160 && y > lastY + 4 ? true : y < lastY - 4 ? false : nav.classList.contains('hide'));
    lastY = y;
    let cur = -1;
    secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * 0.4) cur = i; });
    links.forEach((a, i) => a.setAttribute('aria-current', String(i === cur)));
    if (archCol && y < innerHeight) archCol.firstElementChild.style.transform = 'translate3d(0,' + (y * 0.05).toFixed(1) + 'px,0)';
  }
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  const closeSheet = () => { sheet.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); sheet.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; };
  menu.addEventListener('click', () => {
    const o = !sheet.classList.contains('open');
    sheet.classList.toggle('open', o); menu.setAttribute('aria-expanded', String(o)); sheet.setAttribute('aria-hidden', String(!o));
    document.body.style.overflow = o ? 'hidden' : ''; nav.classList.remove('hide');
  });
  $$('a', sheet).forEach((a) => a.addEventListener('click', closeSheet));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  /* ---------- reveals ---------- */
  function split(el, ctr) {
    [...el.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const f = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((t) => {
          if (!t) return;
          if (/^\s+$/.test(t)) f.appendChild(document.createTextNode(' '));
          else { const s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--i', ctr.i++); s.textContent = t; f.appendChild(s); }
        });
        el.replaceChild(f, n);
      } else if (n.nodeType === 1) split(n, ctr);
    });
  }
  $$('[data-split]').forEach((el) => split(el, { i: 0 }));
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
  $$('[data-reveal],[data-split]').forEach((el) => io.observe(el));

  /* ---------- mantras that dissolve into each other ---------- */
  const MANTRAS = [
    ['नेति नेति', 'not this, not this'],
    ['तत् त्वम् असि', 'thou art that'],
    ['सर्वं खल्विदं ब्रह्म', 'all this is one'],
    ['अहं ब्रह्मास्मि', 'i am the infinite'],
  ];
  const mEl = $('#mantra'), sk = $('#mkSk'), tr = $('#mkTr');
  const chars = (el, text, base) => {
    el.textContent = '';
    [...text].forEach((c, i) => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; s.style.setProperty('--cd', (base + Math.random() * 0.35).toFixed(2) + 's'); el.appendChild(s); });
  };
  let mi = 0;
  chars(sk, MANTRAS[0][0], 0); chars(tr, MANTRAS[0][1], 0.15);
  if (!PX.reduced) setInterval(() => {
    if (document.hidden) return;
    mEl.classList.add('out');
    setTimeout(() => {
      mi = (mi + 1) % MANTRAS.length;
      mEl.classList.remove('out'); mEl.classList.add('pre');
      chars(sk, MANTRAS[mi][0], 0); chars(tr, MANTRAS[mi][1], 0.15);
      void mEl.offsetWidth;
      mEl.classList.remove('pre');
    }, 1000);
  }, 6200);

  /* ---------- clock ---------- */
  const clock = $('#clock');
  try {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kathmandu', hour: '2-digit', minute: '2-digit', hour12: false });
    const t = () => (clock.textContent = f.format(new Date()));
    t(); setInterval(t, 20000);
  } catch (e) { clock.textContent = '--:--'; }

  /* ---------- essays ---------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ARW = '<span class="arw" aria-hidden="true"><svg><use href="#i-ur"/></svg><svg><use href="#i-ur"/></svg></span>';
  function essayHTML(p, i) {
    const d = new Date(p.date), ds = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const ex = String(p.excerpt || '').replace(/\.\.\.$/, '…');
    return `<a class="essay${i === 0 ? ' first' : ''}" href="/writings/${esc(p.slug)}"><time class="mono" datetime="${esc(p.date)}">${ds}</time><h3>${esc(p.title)}</h3><span class="meta mono">${esc(p.category || 'Essay')}${p.mins ? ' · ' + p.mins + ' min' : ''}${ARW}</span><div class="ex"><p>${esc(ex)}</p></div></a>`;
  }
  const box = $('#essays');
  fetch('posts/summary.json').then((r) => r.json()).then((d) => {
    const ps = (d.posts || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    if (!ps.length) return;
    box.innerHTML = ps.slice(0, 8).map(essayHTML).join('');
    const all = $('.all .btn'); if (all) all.firstChild.textContent = 'All ' + ps.length + ' essays ';
  }).catch(() => {});

  /* ---------- copy email ---------- */
  const cp = $('#copy');
  cp.addEventListener('click', async () => {
    const mail = 'iamnikithamal@gmail.com';
    try { await navigator.clipboard.writeText(mail); } catch (e) { const t = document.createElement('textarea'); t.value = mail; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (_) {} t.remove(); }
    cp.classList.add('ok'); $('use', cp).setAttribute('href', '#i-ok'); $('span', cp).textContent = 'Copied';
    setTimeout(() => { cp.classList.remove('ok'); $('use', cp).setAttribute('href', '#i-copy'); $('span', cp).textContent = 'Copy'; }, 2000);
  });

  $('#year').textContent = new Date().getFullYear();
})();
