/* pixel-cards.js — hand-built pixel-art banners for the project cards.
 *  Lami Nepal: a pagoda at sunset under a string of lanterns, hearts drifting up, marigold petals falling
 *  NEBians:    a study desk at night: books, a warm desk lamp, a graduation cap tossed in the air, formulas floating
 *  AstroWeb:   a violet starfield with a ringed planet, a crescent moon and a constellation that draws itself on hover
 * Static scenery is painted once per theme; only the small moving parts redraw, at 12 fps (30 while hovered) and
 * only while a card is on screen. Calm under prefers-reduced-motion. */
(() => {
  'use strict';
  const D = document, R = D.documentElement, S = 3;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDark = () => R.getAttribute('data-theme') === 'dark';
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16), bay = (x, y) => BAY[(y & 3) * 4 + (x & 3)];
  const cv = (w, h) => { const c = D.createElement('canvas'); c.width = w; c.height = h; return c; };
  const rnd = Math.random, ra = (a, b) => a + rnd() * (b - a);
  function art(g, rows, pal, x0, y0) { rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = pal[r[x]]; if (c) { g.fillStyle = c; g.fillRect(x0 + x, y0 + y, 1, 1); } } }); }
  function grad(g, W, H, top, bot, stops = 5) {   // dithered vertical gradient between two colours
    const A = parseInt(top.slice(1), 16), B = parseInt(bot.slice(1), 16), col = k => { const c = s => Math.round(((A >> s) & 255) * (1 - k) + ((B >> s) & 255) * k); return `rgb(${c(16)},${c(8)},${c(0)})`; };
    const cols = []; for (let i = 0; i <= stops; i++) cols.push(col(i / stops));
    for (let y = 0; y < H; y++) { const f = y / H * stops, i = Math.min(stops - 1, Math.floor(f)), k = f - i; for (let x = 0; x < W; x++) { g.fillStyle = bay(x, y) < k ? cols[i + 1] : cols[i]; g.fillRect(x, y, 1, 1); } }
  }
  const ridge = (g, W, H, base, amp, f, ph, col) => { g.fillStyle = col; for (let x = 0; x < W; x++) { const h = Math.round(base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph * 2) * amp * .4); g.fillRect(x, H - h, 1, h); } };

  const HEART = ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'];
  const PAGODA = ['......y......', '.....yyy.....', '....rrrrr....', '..rrrrrrrrr..', '....wwwww....', '...rrrrrrr...', '.rrrrrrrrrrr.', '...wwwdwww...', '..rrrrrrrrr..', 'rrrrrrrrrrrrr', '..wwwwdwwww..', '..wwwwdwwww..', '.sssssssssss.'];
  const CAP = ['...k...', '.kkkkk.', 'kkkkkkk', '.kkkkky', '..kkk.y', '..kkk.y'];
  const GLYPHS = [['xxxx', '.x.x', '.x.x', '.x.x'], ['...xx', '..x..', 'x.x..', '.x...'], ['xxx', 'x..', '.x.', 'x..', 'xxx'], ['.x.', 'xxx', '.x.'], ['x.x', '.x.', 'x.x'], ['xx', '.x', 'x.', 'xx']];

  const SCENES = {
    consica: {
      paint(g, W, H, dk) {
        grad(g, W, H, dk ? '#0e1a24' : '#cfe8ea', dk ? '#21384a' : '#9fcfd4');
        ridge(g, W, H, 8, 2, .05, 2, dk ? '#1a2c3a' : '#86b9bf');
        // a row of buildings with a lit studio in the middle
        this.wins = []; let x = 2;
        while (x < W - 2) { const w = 6 + (Math.random() * 8 | 0), h = 10 + (Math.random() * (H * .55) | 0), mid = Math.abs(x + w / 2 - W / 2) < 10;
          g.fillStyle = dk ? (mid ? '#2f4a5e' : '#1f3242') : (mid ? '#2f6f78' : '#4f8e96'); g.fillRect(x, H - h, w, h);
          g.fillStyle = dk ? '#3d5c72' : '#6fb0b8'; g.fillRect(x, H - h, w, 1);
          for (let yy = H - h + 3; yy < H - 3; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) this.wins.push([xx, yy, Math.random()]);
          x += w + 1 + (Math.random() * 3 | 0); }
      },
      init(st) { st.t = 0; },
      tick(g, st, W, H, t, dt, hot, dk) {
        for (const [x, y, r] of SCENES.consica.wins || []) { const on = Math.sin(t * .4 + r * 30) > (hot ? -.4 : .1); g.fillStyle = on ? (dk ? '#ffd98a' : '#e9fbff') : (dk ? '#18283a' : '#3f7e86'); g.fillRect(x, y, 1, 1); }
        // a few pixels drifting up, like code shipping
        for (let i = 0; i < 6; i++) { const y = H - ((t * 8 + i * 13) % (H + 4)), x = (i * 37 + 11) % W; g.globalAlpha = .6; g.fillStyle = dk ? '#7fe0d0' : '#ffffff'; g.fillRect(x, Math.round(y), 1, 1); }
        g.globalAlpha = 1;
      }
    },
    lami: {
      paint(g, W, H, dk) {
        grad(g, W, H, dk ? '#2e1c33' : '#f3b7a8', dk ? '#6a3448' : '#fde6d6');
        const sx = Math.round(W * .2), sy = H - 13;                                   // low sun / moon
        for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) { const d = Math.hypot(x, y); if (d < 6) { g.fillStyle = dk ? '#f3e7c4' : (d < 4 ? '#ffe2a0' : '#ffc27a'); g.fillRect(sx + x, sy + y, 1, 1); } else if (d < 9 && bay(sx + x, sy + y) < (9 - d) / 6) { g.fillStyle = dk ? 'rgba(255,240,210,.35)' : 'rgba(255,214,150,.55)'; g.fillRect(sx + x, sy + y, 1, 1); } }
        ridge(g, W, H, 9, 2.5, .07, 1, dk ? '#4a2638' : '#eba497'); ridge(g, W, H, 5, 1.5, .11, 3, dk ? '#331a29' : '#d98378');
        art(g, PAGODA, dk ? { y: '#d9a441', r: '#5e2630', w: '#7a5f52', d: '#2b1a17', s: '#4a3a36' } : { y: '#f2c14e', r: '#93383b', w: '#f6e6cb', d: '#5a3020', s: '#b99c86' }, Math.round(W * .8) - 6, H - 5 - PAGODA.length + 2);
      },
      init(st, W, H) { st.hearts = []; st.petals = []; st.lan = []; for (let i = 0; i < 6; i++) st.lan.push((i + .5) / 6); },
      tick(g, st, W, H, t, dt, hot, dk) {
        // lantern string sagging across the top, lanterns glowing
        for (let x = 0; x < W; x++) { const u = x / W, y = Math.round(3 + Math.sin(Math.PI * u) * 4); g.fillStyle = dk ? 'rgba(255,220,180,.35)' : 'rgba(120,60,50,.45)'; g.fillRect(x, y, 1, 1); }
        st.lan.forEach((u, i) => { const x = Math.round(u * W), y = Math.round(3 + Math.sin(Math.PI * u) * 4) + 1, f = .75 + .25 * Math.sin(t * 5 + i * 2);
          g.globalAlpha = .25 * f; g.fillStyle = '#ffb35c'; g.fillRect(x - 2, y - 1, 5, 6); g.globalAlpha = 1;
          g.fillStyle = '#c4452f'; g.fillRect(x - 1, y, 3, 1); g.fillRect(x - 1, y + 3, 3, 1); g.fillStyle = f > .85 ? '#ffd27a' : '#ff9a4a'; g.fillRect(x - 1, y + 1, 3, 2); });
        if (!reduce && rnd() < dt * (hot ? 3 : 1)) st.hearts.push({ x: ra(W * .3, W * .7), y: H + 4, v: ra(6, 10), ph: rnd() * 6 });
        if (!reduce && rnd() < dt * 2) st.petals.push({ x: ra(0, W), y: -2, v: ra(5, 9), ph: rnd() * 6 });
        st.hearts = st.hearts.filter(h => (h.y -= h.v * dt) > -6); st.petals = st.petals.filter(p => (p.y += p.v * dt) < H + 2);
        for (const h of st.hearts) { g.globalAlpha = Math.min(1, (h.y + 6) / (H * .6)) * .9; art(g, HEART, { x: dk ? '#ff7b9c' : '#e8506f' }, Math.round(h.x + Math.sin(t * 2 + h.ph) * 2), Math.round(h.y)); }
        g.globalAlpha = 1;
        for (const p of st.petals) { g.fillStyle = (Math.floor(t * 6 + p.ph) & 1) ? '#f5a524' : '#e8871e'; g.fillRect(Math.round(p.x + Math.sin(t * 1.5 + p.ph) * 3), Math.round(p.y), 1, 1); }
      }
    },
    neb: {
      paint(g, W, H, dk) {
        grad(g, W, H, dk ? '#101b33' : '#d7e6fb', dk ? '#1f3157' : '#b9d0f2');
        // a window with stars on the left wall
        const wx = Math.round(W * .1), wy = 4, ww = Math.max(12, Math.round(W * .13)), wh = Math.round(H * .45);
        g.fillStyle = dk ? '#0a1124' : '#9fc1ea'; g.fillRect(wx, wy, ww, wh); g.fillStyle = dk ? '#3a4a70' : '#ffffff'; g.fillRect(wx - 1, wy - 1, ww + 2, 1); g.fillRect(wx - 1, wy + wh, ww + 2, 1); g.fillRect(wx - 1, wy, 1, wh); g.fillRect(wx + ww, wy, 1, wh); g.fillRect(wx + (ww >> 1), wy, 1, wh); g.fillRect(wx, wy + (wh >> 1), ww, 1);
        g.fillStyle = dk ? '#f2ecd0' : '#ffffff'; for (let i = 0; i < 5; i++) g.fillRect(wx + 1 + Math.floor(rnd() * (ww - 2)), wy + 1 + Math.floor(rnd() * (wh - 2)), 1, 1);
        // the desk
        const dy = H - Math.round(H * .26); g.fillStyle = dk ? '#3d2f27' : '#9a7656'; g.fillRect(0, dy, W, H - dy); g.fillStyle = dk ? '#58443a' : '#b78d68'; g.fillRect(0, dy, W, 1);
        // a stack of books
        const bx = Math.round(W * .18); [['#d65a4a', 15], ['#3f8f6b', 13], ['#e3b448', 16], ['#5a7fd0', 12]].forEach(([c, w], i) => { g.fillStyle = dk ? '#' + c.slice(1).replace(/../g, h => Math.round(parseInt(h, 16) * .6).toString(16).padStart(2, '0')) : c; g.fillRect(bx - (w >> 1) + (i % 2), dy - 3 * (i + 1), w, 3); g.fillStyle = dk ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.45)'; g.fillRect(bx - (w >> 1) + 2 + (i % 2), dy - 3 * (i + 1) + 1, w - 4, 1); });
        // an open notebook
        const nx = Math.round(W * .44); g.fillStyle = dk ? '#c9c2ad' : '#fbf7ee'; g.fillRect(nx, dy - 2, 18, 2); g.fillStyle = dk ? '#7d7766' : '#c8d4e8'; for (let i = 2; i < 16; i += 3) g.fillRect(nx + i, dy - 2, 2, 1);
        this.lamp = [Math.round(W * .8), dy];
      },
      init(st) { st.glyphs = []; st.cap = { y: 0, v: 0, on: false, t: 2 }; },
      tick(g, st, W, H, t, dt, hot, dk) {
        const [lx, dy] = SCENES.neb.lamp || [W * .8, H * .74];
        // lamp light: a dithered warm cone onto the desk, breathing slightly
        const f = .85 + .15 * Math.sin(t * 1.3);
        for (let y = dy - 12; y < dy; y++) { const k = (y - (dy - 12)) / 12, half = 2 + k * 10; for (let x = Math.round(lx - 5 - half); x < lx - 5 + half; x++) if (bay(x, y) < (dk ? .45 : .28) * f * (1 - k * .4)) { g.fillStyle = '#ffd98a'; g.fillRect(x, y, 1, 1); } }
        g.fillStyle = dk ? '#c6a85a' : '#3d4a66'; g.fillRect(lx - 1, dy - 1, 5, 1); g.fillRect(lx + 1, dy - 7, 1, 6); g.fillRect(lx - 4, dy - 13, 6, 1); g.fillRect(lx, dy - 12, 1, 5);
        g.fillStyle = '#ffe4a0'; g.fillRect(lx - 7, dy - 12, 4, 2); g.fillStyle = dk ? '#e0b85a' : '#e2574c'; g.fillRect(lx - 8, dy - 13, 6, 1);
        // formulas drifting up
        if (!reduce && rnd() < dt * (hot ? 2.5 : .9)) st.glyphs.push({ g: GLYPHS[Math.floor(rnd() * GLYPHS.length)], x: ra(W * .3, W * .7), y: dy - 4, v: ra(3, 6), a: 1 });
        st.glyphs = st.glyphs.filter(q => (q.y -= q.v * dt) > 0);
        for (const q of st.glyphs) { g.globalAlpha = Math.min(1, q.y / (dy * .7)) * .8; art(g, q.g, { x: dk ? '#bcd3ff' : '#2f5aa8' }, Math.round(q.x), Math.round(q.y)); }
        g.globalAlpha = 1;
        // the cap gets tossed now and then (more often while hovered)
        const c = st.cap; if (!reduce) { if (!c.on && (c.t -= dt * (hot ? 3 : 1)) < 0) { c.on = true; c.y = 0; c.v = 34; c.t = ra(4, 8); } if (c.on) { c.y += c.v * dt; c.v -= 50 * dt; if (c.y < 0) c.on = false; } }
        if (c.on) art(g, Math.floor(t * 8) & 1 ? CAP : CAP.slice().reverse(), { k: dk ? '#e8e2cf' : '#1e2433', y: '#f2c14e' }, Math.round(W * .62), Math.round(dy - 7 - c.y));
      }
    },
    astro: {
      paint(g, W, H, dk) {
        grad(g, W, H, dk ? '#120d2e' : '#3a2f7d', dk ? '#3a2a6e' : '#8a78d0');
        // ringed planet on the left
        const px = Math.round(W * .17), py = Math.round(H * .58), r = Math.max(6, Math.round(H * .2));
        const ringPx = (front) => { for (let a = 0; a < Math.PI * 2; a += .02) { const x = Math.round(px + Math.cos(a) * r * 1.9), y = Math.round(py + Math.sin(a) * r * .5); if ((Math.sin(a) > 0) === front) { g.fillStyle = dk ? '#a99a78' : '#f0dfb4'; g.fillRect(x, y, 1, 1); } } };
        ringPx(false);
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y); if (d > r) continue; const band = Math.floor((y + r) / 3) % 3, lit = (-x - y) / r * .5 + (1 - d / r) * .6 + (bay(px + x, py + y) - .5) * .3; g.fillStyle = lit > .45 ? ['#f6cf92', '#efc07e', '#f9dca6'][band] : lit > .1 ? ['#d9a565', '#cf9658', '#e1b273'][band] : '#a8743f'; g.fillRect(px + x, py + y, 1, 1); }
        ringPx(true);
        // crescent moon on the right
        const mx = Math.round(W * .86), my = Math.round(H * .28); for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (Math.hypot(x, y) <= 5 && Math.hypot(x - 2.4, y - 1.4) > 4.2) { g.fillStyle = '#fbf3d5'; g.fillRect(mx + x, my + y, 1, 1); }
      },
      init(st, W, H) {
        st.stars = []; for (let i = 0; i < Math.round(W * H / 55); i++) st.stars.push([Math.floor(rnd() * W), Math.floor(rnd() * H), rnd() * 6, rnd() < .15]);
        // a little constellation (Orion-ish) to the right of the logo
        st.con = [[.62, .25], [.7, .18], [.74, .42], [.69, .5], [.76, .55], [.82, .72], [.66, .76]].map(([u, v]) => [Math.round(u * W), Math.round(v * H)]);
        st.edges = [[0, 1], [1, 2], [0, 3], [3, 2], [3, 4], [2, 4], [4, 5], [3, 6]]; st.draw = 0; st.shoot = null; st.next = 3;
      },
      tick(g, st, W, H, t, dt, hot) {
        for (const [x, y, ph, big] of st.stars) { const a = .45 + .55 * Math.max(0, Math.sin(t * 1.6 + ph)); g.globalAlpha = a; g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1); if (big && a > .8) { g.globalAlpha = a * .5; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); } }
        g.globalAlpha = 1;
        st.draw += ((hot ? 1 : .35) - st.draw) * Math.min(1, dt * 2.5);
        const total = st.edges.length * st.draw;
        st.edges.forEach(([a, b], i) => { const k = Math.max(0, Math.min(1, total - i)); if (k <= 0) return; const [x0, y0] = st.con[a], [x1, y1] = st.con[b], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
          g.fillStyle = 'rgba(190,200,255,.7)'; for (let j = 0; j <= n * k; j += 2) g.fillRect(Math.round(x0 + (x1 - x0) * j / n), Math.round(y0 + (y1 - y0) * j / n), 1, 1); });
        for (const [x, y] of st.con) { g.fillStyle = '#fff6c8'; g.fillRect(x, y, 1, 1); g.globalAlpha = .5; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); g.globalAlpha = 1; }
        if (!reduce && !st.shoot && (st.next -= dt * (hot ? 2.5 : 1)) < 0) { st.shoot = { x: ra(W * .3, W), y: ra(0, H * .3), age: 0 }; st.next = ra(3, 7); }
        if (st.shoot) { const s = st.shoot; s.age += dt; s.x -= 90 * dt; s.y += 30 * dt; for (let j = 0; j < 10; j++) { g.globalAlpha = (1 - j / 10) * Math.max(0, 1 - s.age / .8); g.fillStyle = '#ffffff'; g.fillRect(Math.round(s.x + j * 3), Math.round(s.y - j), 1, 1); } g.globalAlpha = 1; if (s.age > .8) st.shoot = null; }
      }
    }
  };

  const cards = [];
  function setup(card) {
    const kind = card.classList.contains('project-card-lami') ? 'lami' : card.classList.contains('project-card-neb') ? 'neb' : card.classList.contains('project-card-astro') ? 'astro' : null;
    const vis = card.querySelector('.project-card-visual'); if (!kind || !vis || vis.querySelector('.pc-scene')) return;
    const c = D.createElement('canvas'); c.className = 'pc-scene'; c.setAttribute('aria-hidden', 'true'); vis.prepend(c); vis.classList.add('has-scene');
    const o = { card, vis, c, g: c.getContext('2d'), kind, st: {}, hot: false, on: false, bg: null, last: 0 };
    card.addEventListener('pointerenter', () => { o.hot = true; }); card.addEventListener('pointerleave', () => { o.hot = false; });
    card.addEventListener('focusin', () => { o.hot = true; }); card.addEventListener('focusout', () => { o.hot = false; });
    cards.push(o); build(o);
  }
  function build(o) {
    const r = o.vis.getBoundingClientRect(); if (!r.width) return;
    const W = Math.ceil(r.width / S), H = Math.ceil(r.height / S); o.W = W; o.H = H;
    o.c.width = W; o.c.height = H; o.c.style.width = W * S + 'px'; o.c.style.height = H * S + 'px'; o.g.imageSmoothingEnabled = false;
    o.bg = cv(W, H); const sc = SCENES[o.kind]; sc.paint(o.bg.getContext('2d'), W, H, isDark()); o.st = {}; sc.init(o.st, W, H); draw(o, performance.now(), 0);
  }
  function draw(o, now, dt) { const { g, W, H } = o; g.clearRect(0, 0, W, H); g.drawImage(o.bg, 0, 0); SCENES[o.kind].tick(g, o.st, W, H, now / 1000, dt, o.hot, isDark()); }
  function loop(now) {
    requestAnimationFrame(loop); if (D.hidden) return;
    for (const o of cards) { if (!o.on || !o.W) continue; const gap = o.hot ? 32 : 82; if (now - o.last < gap) continue; const dt = Math.min(.12, (now - (o.last || now)) / 1000); o.last = now; draw(o, now, reduce ? 0 : dt); }
  }
  function boot() {
    D.querySelectorAll('.project-card').forEach(setup); if (!cards.length) return;
    const io = new IntersectionObserver(es => es.forEach(e => { const o = cards.find(k => k.vis === e.target); if (o) { o.on = e.isIntersecting; if (o.on && !o.W) build(o); } }), { rootMargin: '60px' });
    cards.forEach(o => io.observe(o.vis));
    let rz; const ro = new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(() => cards.forEach(build), 120); }); cards.forEach(o => ro.observe(o.vis));
    new MutationObserver(() => cards.forEach(build)).observe(R, { attributes: true, attributeFilter: ['data-theme'] });
    if (!reduce) requestAnimationFrame(loop);
  }
  // public: an animated mini scene for any canvas (js/link-previews.js)
  window.PixelCards = {
    mount(kind, canvas, wpx, hpx) {
      if (!SCENES[kind]) return null;
      const W = Math.ceil(wpx / S), H = Math.ceil(hpx / S), o = { kind, c: canvas, g: canvas.getContext('2d'), st: {}, hot: true, on: true, last: 0, W, H };
      canvas.width = W; canvas.height = H; canvas.style.width = W * S + 'px'; canvas.style.height = H * S + 'px'; o.g.imageSmoothingEnabled = false;
      o.bg = cv(W, H); SCENES[kind].paint(o.bg.getContext('2d'), W, H, isDark()); SCENES[kind].init(o.st, W, H); draw(o, performance.now(), 0);
      let raf = 0, last = performance.now(); const run = now => { raf = requestAnimationFrame(run); if (now - last < 40) return; const dt = Math.min(.1, (now - last) / 1000); last = now; draw(o, now, reduce ? 0 : dt); };
      if (!reduce) raf = requestAnimationFrame(run);
      return { stop() { cancelAnimationFrame(raf); } };
    }
  };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot); else boot();
})();
