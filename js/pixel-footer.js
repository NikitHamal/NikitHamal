/* pixel-footer.js — <pixel-footer>: a quiet, minimal landscape above the footer, drawn from scratch.
 *  - two faceted mountain ranges with clean snow caps
 *  - a few rigged trees: procedural skeletons whose branches sway hierarchically in the wind (round broadleaf
 *    canopies and tiered pines); click a tree to shake it
 *  - a meadow of individual grass blades that wave in the wind and part around the pointer
 *  - butterflies (they wander and settle on grass tips), darting dragonflies, fireflies at night, leaves that
 *    drift down, settle and fade
 * Follows day / night and snow. Renders at 30 fps, only while on screen; still under prefers-reduced-motion. */
(() => {
  'use strict';
  if (customElements.get('pixel-footer')) return;
  const D = document, R = D.documentElement, S = 3;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDark = () => R.getAttribute('data-theme') === 'dark';
  const weather = () => (window.PixelSky && window.PixelSky.weather) || 'fair';
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16), bay = (x, y) => BAY[(y & 3) * 4 + (x & 3)];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  let seed = 1; const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ra = (a, b) => a + rnd() * (b - a), pick = a => a[Math.floor(rnd() * a.length)];
  const cv = (w, h) => { const c = D.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

  const PAL = {
    day: { farL: '#cfdae7', farS: '#b9c8da', nearL: '#c3dac6', nearS: '#acc9b3', snow: '#ffffff', snowS: '#e2eaf3',
      leaf: ['#a6d47e', '#7cb860', '#56954a', '#3a6f3d'], pine: ['#6aa476', '#478358', '#2f6343'], bark: ['#8a6a52', '#634a3a'],
      meadow: ['#b9db93', '#97c573', '#77ad5c'], blade: ['#86bd62', '#69a650', '#a9d47f'], fall: ['#e9b44c', '#dc7b4b', '#a6d47e', '#c9a640'] },
    night: { farL: '#384263', farS: '#2b3352', nearL: '#2d4246', nearS: '#25373b', snow: '#8d9ac2', snowS: '#6f7ca6',
      leaf: ['#4f746c', '#3a5b56', '#2a4441', '#1d3130'], pine: ['#33564e', '#25423c', '#19302c'], bark: ['#433c44', '#2e2a31'],
      meadow: ['#3f5c4c', '#32493e', '#273b32'], blade: ['#41614f', '#33503f', '#5a7f68'], fall: ['#9a8a5a', '#8a6a52', '#4f746c'] }
  };
  const snowify = P => Object.assign({}, P, { nearL: P === PAL.night ? '#5d6a92' : '#eef3f8', nearS: P === PAL.night ? '#4e5a80' : '#dbe5ef', meadow: P === PAL.night ? ['#6f7ca6', '#5d6a92', '#4e5a80'] : ['#f6f9fc', '#e3ebf4', '#cbd8e6'],
    blade: P === PAL.night ? ['#7f8bb2', '#6a769c', '#98a4c8'] : ['#dbe5ef', '#c5d3e2', '#ffffff'], fall: ['#ffffff', '#e3ebf4'] });

  // a soft, shaded leaf clump (lit from the top-left), with an optional snow cap
  function clump(r, P, snowy, s) {
    seed = s; const d = Math.ceil(r * 2) + 2, c = cv(d, d), g = c.getContext('2d'), m = d / 2;
    for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
      const dx = x + .5 - m, dy = y + .5 - m, n = Math.sin(x * 1.7 + s) * .6 + Math.cos(y * 1.3 + s * 2) * .6, rr = r + n * .8;
      if (dx * dx + dy * dy > rr * rr) continue;
      const l = (-dx * .55 - dy * .85) / r + (bay(x, y) - .5) * .35, k = Math.hypot(dx, dy) / rr;
      let col = l > .45 ? P.leaf[0] : l > -.05 ? P.leaf[1] : l > -.5 ? P.leaf[2] : P.leaf[3];
      if (k > .82 && dy > 0) col = P.leaf[3];
      if (snowy && dy < -rr * .25 && l > -.2 && bay(x + 1, y) < .8) col = l > .3 ? P.snow : P.snowS;
      g.fillStyle = col; g.fillRect(x, y, 1, 1);
    }
    return c;
  }
  // one pine tier: a jagged, shaded triangle
  function tier(w, h, P, snowy, s) {
    seed = s; const c = cv(w, h), g = c.getContext('2d'), m = w / 2;
    for (let y = 0; y < h; y++) { const half = (y + 1) / h * m + (y === h - 1 ? 0 : Math.sin(y * 2.3 + s) * .6);
      for (let x = 0; x < w; x++) { const dx = x + .5 - m; if (Math.abs(dx) > half) continue;
        let col = dx < -half * .2 ? P.pine[0] : dx < half * .45 ? P.pine[1] : P.pine[2]; if (y === h - 1 && bay(x, 0) < .5) col = P.pine[2];
        if (snowy && y < h * .45 && (y < 2 || Math.abs(dx) > half - 1.2)) col = dx < 0 ? P.snow : P.snowS;
        g.fillStyle = col; g.fillRect(x, y, 1, 1); } }
    return c;
  }

  /* ---------- rigged trees ---------- */
  function broadleaf(x, h, s, P, snowy) {
    seed = s; const segs = [], tips = [];
    const add = (p, len, ang, w, d) => { const sg = { p, len, ang, w, d, ph: rnd() * 6 }; segs.push(sg); return sg; };
    const grow = (sg, d) => {
      const n = d === 1 ? 3 : 2;
      for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * ra(.55, .8) + ra(-.12, .12), c = add(sg, sg.len * ra(.5, .62), a, Math.max(1, sg.w * .6), d); if (d < 2) grow(c, d + 1); else tips.push({ sg: c, r: h * ra(.17, .22) }); }
    };
    const trunk = add(null, h * .46, ra(-.04, .04), Math.max(3, Math.round(h / 10)), 0); grow(trunk, 1);
    tips.unshift({ sg: trunk, r: h * .3 });   // the big crown first, smaller clumps around it
    tips.forEach((t, i) => t.spr = clump(t.r, P, snowy, s * 7 + i));
    return { kind: 'broad', x, segs, tips, shake: 0 };
  }
  function pine(x, h, s, P, snowy) {
    seed = s; const n = Math.max(3, Math.round(h / 8)), tiers = [];
    for (let i = 0; i < n; i++) { const u = i / (n - 1), w = Math.round((1 - u) * h * .5 + 5), th = Math.round(h * .32 - u * h * .1); tiers.push({ spr: tier(w, th, P, snowy, s + i * 13), y: Math.min(Math.round(h - th - 3), Math.round(h * .18 + (h * .82) * (1 - u) - th * .55)), w }); }
    return { kind: 'pine', x, h, tiers, shake: 0, trunkW: Math.max(2, Math.round(h / 16)) };
  }
  // world pose of a broadleaf skeleton for this frame (branches inherit their parent's sway)
  function poseTree(tr, gy, t, wind) {
    for (const sg of tr.segs) {
      const base = sg.p ? sg.p.end : [tr.x, gy], pa = sg.p ? sg.p.abs : 0;
      const sway = reduce ? 0 : Math.sin(t * 1.15 + sg.ph + sg.d * .8) * (.018 + sg.d * .02) * wind + Math.sin(t * 9 + sg.ph) * .02 * sg.d * tr.shake;
      sg.abs = pa + sg.ang + sway; sg.start = base; sg.end = [base[0] + Math.sin(sg.abs) * sg.len, base[1] - Math.cos(sg.abs) * sg.len];
    }
  }
  function limb(g, a, b, w0, w1, P) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
    for (let i = 0; i <= n; i++) { const u = i / n, x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u, w = Math.max(1, Math.round(w0 + (w1 - w0) * u));
      g.fillStyle = P.bark[1]; g.fillRect(Math.round(x - w / 2), Math.round(y), w, 1); if (w > 1) { g.fillStyle = P.bark[0]; g.fillRect(Math.round(x - w / 2), Math.round(y), 1, 1); } }
  }

  class PixelFooter extends HTMLElement {
    connectedCallback() {
      if (this._on) return; this._on = true; this.setAttribute('aria-hidden', 'true');
      this.c = D.createElement('canvas'); this.appendChild(this.c); this.g = this.c.getContext('2d');
      this.vis = false; this.io = new IntersectionObserver(es => { this.vis = es[es.length - 1].isIntersecting; }, { rootMargin: '80px' }); this.io.observe(this);
      this.ro = new ResizeObserver(() => { clearTimeout(this._rz); this._rz = setTimeout(() => this.build(), 120); }); this.ro.observe(this);
      const rebuild = () => this.build(true);
      this.mo = new MutationObserver(rebuild); this.mo.observe(R, { attributes: true, attributeFilter: ['data-theme'] });
      D.addEventListener('sky:weather', this._wx = rebuild);
      addEventListener('pointermove', this._pm = e => { const r = this.getBoundingClientRect(); if (e.clientY < r.top - 40 || e.clientY > r.bottom + 40) { this.mx = null; return; } this.mx = (e.clientX - r.left) / S; this.my = (e.clientY - r.top) / S; }, { passive: true });
      this.addEventListener('click', e => this.onClick(e));
      let last = 0; const loop = now => { this.raf = requestAnimationFrame(loop); if (!this.W || !this.vis || D.hidden || now - last < 32) return; const dt = Math.min(.1, (now - last) / 1000); last = now; this.frame(dt, now / 1000); };
      this.raf = requestAnimationFrame(loop);
    }
    disconnectedCallback() { this._on = false; cancelAnimationFrame(this.raf); this.io.disconnect(); this.ro.disconnect(); this.mo.disconnect(); D.removeEventListener('sky:weather', this._wx); removeEventListener('pointermove', this._pm); }

    build(fade) {
      const narrow = this.clientWidth < 640, W = Math.ceil(this.clientWidth / S), H = narrow ? 58 : 74; if (!W) return;
      if (fade && this.W) { const p = cv(this.W, this.H); p.getContext('2d').drawImage(this.c, 0, 0); this.prev = p; this.prevT = performance.now(); }
      this.W = W; this.H = H; this.gy = H - 7; this.narrow = narrow; this.style.height = H * S + 'px';
      this.c.width = W; this.c.height = H; this.c.style.width = W * S + 'px'; this.c.style.height = H * S + 'px'; this.g.imageSmoothingEnabled = false;
      const dark = isDark(), snowy = weather() === 'snow', P = snowy ? snowify(dark ? PAL.night : PAL.day) : dark ? PAL.night : PAL.day;
      this.P = P; this.dark = dark; this.snowy = snowy;
      // mountains: two faceted ranges, lit from the left, with clean snow caps; their feet melt into haze
      const mt = cv(W, H), mg = mt.getContext('2d'), gy = this.gy;
      const range = (peaks, base, colL, colS, snowFrac, sd) => { seed = sd; const pk = []; for (let i = 0; i < peaks; i++) pk.push([ra(-10, W + 10), ra(.55, 1), ra(16, 30)]);
        const h = x => { let v = 0; for (const [px, a, w] of pk) v = Math.max(v, a * Math.max(0, 1 - Math.abs(x - px) / w)); return v; };
        for (let x = 0; x < W; x++) { const v = h(x), top = Math.round(base - v * (H * .62)), lit = h(x + 1) < v || (h(x + 1) === v && h(x - 1) < v);
          const sl = top + Math.max(2, Math.round(v * H * .62 * snowFrac));
          for (let y = top; y < gy; y++) { const fadeK = (y - (gy - 14)) / 14; if (fadeK > 0 && bay(x, y) < fadeK) continue;
            mg.fillStyle = y < sl + (Math.sin(x * 1.9) > .3 ? 1 : 0) && v > .45 ? (lit ? P.snow : P.snowS) : (lit ? colL : colS); mg.fillRect(x, y, 1, 1); } } };
      range(Math.max(4, Math.round(W / 45)), gy - 3, P.farL, P.farS, .3, 11);
      // soft rolling hills in front: rounded, lit on the left slopes
      seed = 29; const hp = []; for (let i = 0; i < Math.max(3, W / 70); i++) hp.push([ra(-20, W + 20), ra(5, 11), ra(30, 60)]);
      const hh = x => { let v = 2; for (const [px, a, w] of hp) { const u = (x - px) / w; if (Math.abs(u) < 1) v = Math.max(v, a * (Math.cos(u * Math.PI) * .5 + .5)); } return v; };
      for (let x = 0; x < W; x++) { const v = hh(x), top = Math.round(gy - v), lit = hh(x - 1) < v; for (let y = top; y < gy + 1; y++) { mg.fillStyle = y === top ? (lit ? P.nearL : P.nearS) : (bay(x, y) < .35 ? P.nearS : P.nearL); mg.fillRect(x, y, 1, 1); } }
      this.mt = mt;
      // the meadow strip: a soft band that dithers into the page at the bottom
      const md = cv(W, H), mdg = md.getContext('2d');
      for (let y = gy; y < H; y++) { const k = (y - gy) / (H - gy), i = Math.min(P.meadow.length - 2, Math.floor(k * (P.meadow.length - 1)));
        for (let x = 0; x < W; x++) { if (y > H - 4 && bay(x, y) < (y - (H - 4)) / 4) continue; mdg.fillStyle = bay(x, y) < k * 2 - i ? P.meadow[i + 1] : P.meadow[i]; mdg.fillRect(x, y, 1, 1); } }
      this.md = md;
      // trees: a pine pair on the left, a broadleaf (and a small one) on the right
      const sc = H / 74 * 1.12, trees = [];
      if (narrow) { trees.push(pine(Math.round(W * .1), 30 * sc, 3, P, snowy)); trees.push(broadleaf(Math.round(W * .86), 36 * sc, 7, P, snowy)); }
      else { trees.push(pine(Math.round(W * .07), 40 * sc, 3, P, snowy)); trees.push(pine(Math.round(W * .115), 29 * sc, 5, P, snowy)); trees.push(broadleaf(Math.round(W * .86), 44 * sc, 7, P, snowy)); trees.push(broadleaf(Math.round(W * .935), 26 * sc, 9, P, snowy)); }
      this.trees = trees;
      // grass blades
      seed = 77; this.blades = []; for (let x = 0; x < W; x += ra(1.6, 3.4)) { const tall = rnd() < .25; this.blades.push({ x, h: tall ? ra(5, narrow ? 7 : 9) : ra(2, 4.5), c: pick(P.blade), ph: rnd() * 6, bend: 0 }); }
      this.leaves = this.leaves || []; this.bugs = null; this.flies = [];
      if (reduce) this.frame(0, 0);
    }
    onClick(e) {
      const r = this.getBoundingClientRect(), mx = (e.clientX - r.left) / S, my = (e.clientY - r.top) / S;
      for (const tr of this.trees) { const h = tr.kind === 'pine' ? tr.h : tr.segs[0].len * 2.4; if (Math.abs(mx - tr.x) < h * .45 && my > this.gy - h - 4 && my < this.gy + 2) {
        tr.shake = 1; D.dispatchEvent(new CustomEvent('sky:sfx', { detail: 'drop' }));
        if (tr.kind === 'broad') for (let i = 0; i < 7; i++) this.dropLeaf(tr); return; } }
    }
    dropLeaf(tr) { const t = pick(tr.tips); if (!t || !t.sg.end) return; this.leaves.push({ x: t.sg.end[0] + ra(-t.r, t.r), y: t.sg.end[1] + ra(-t.r * .5, t.r * .5), vx: ra(-2, 3), vy: ra(4, 8), ph: rnd() * 6, c: pick(this.P.fall), rest: 0, life: 1 }); }

    frame(dt, t) {
      const { g, W, H, gy, P } = this; if (!W) return;
      const wind = .8 + .5 * Math.sin(t * .23) * Math.sin(t * .09 + 1);
      g.clearRect(0, 0, W, H); g.drawImage(this.mt, 0, 0);
      for (const tr of this.trees) {
        tr.shake = Math.max(0, tr.shake - dt * 1.2);
        if (tr.kind === 'pine') {
          limb(g, [tr.x, gy + 1], [tr.x, gy - tr.h * .3], tr.trunkW, tr.trunkW, P);
          tr.tiers.forEach((ti, i) => { const u = 1 - ti.y / tr.h, sway = reduce ? 0 : (Math.sin(t * 1.1 + tr.x) * wind * .9 + Math.sin(t * 10 + i) * tr.shake * 1.4) * u * u * 1.6;
            g.drawImage(ti.spr, Math.round(tr.x - ti.w / 2 + sway), Math.round(gy - tr.h + ti.y)); });
        } else {
          poseTree(tr, gy + 1, t, wind);
          for (const sg of tr.segs) limb(g, sg.start, sg.end, sg.w, Math.max(1, sg.w * .7), P);
          for (const tp of tr.tips) g.drawImage(tp.spr, Math.round(tp.sg.end[0] - tp.spr.width / 2), Math.round(tp.sg.end[1] - tp.spr.height / 2));
          if (!reduce && !this.snowy && Math.random() < dt * .25) this.dropLeaf(tr);
        }
      }
      g.drawImage(this.md, 0, 0);
      // grass blades: wind wave + they part around the pointer
      for (const b of this.blades) {
        let push = 0; if (this.mx != null && Math.abs(this.my - gy) < 14) { const d = b.x - this.mx; if (Math.abs(d) < 8) push = Math.sign(d || 1) * (8 - Math.abs(d)) * .45; }
        b.bend += (push - b.bend) * Math.min(1, dt * 8);
        const tip = reduce ? 0 : Math.sin(t * 1.8 + b.x * .16 + b.ph * .3) * wind * 1.1 + b.bend, h = b.h;
        g.fillStyle = b.c;
        for (let j = 0; j < h; j++) { const u = j / h; g.fillRect(Math.round(b.x + tip * u * u), Math.round(gy + 1 - j), 1, 1); }
        b.ty = gy + 1 - h;
      }
      // leaves drift down, settle in the grass, fade
      for (let i = this.leaves.length - 1; i >= 0; i--) { const l = this.leaves[i];
        if (l.rest > 0) { l.rest -= dt; l.life = Math.min(1, l.rest / 1.5); if (l.rest <= 0) { this.leaves.splice(i, 1); continue; } }
        else { l.ph += dt * 3; l.x += (l.vx + Math.sin(l.ph) * 6 + wind * 2) * dt; l.y += l.vy * dt; if (l.y >= gy + (l.ph % 3) - 1) l.rest = 3 + (l.ph % 3); }
        g.globalAlpha = l.life; g.fillStyle = l.c; const x = Math.round(l.x), y = Math.round(l.y), f = (Math.floor(l.ph) & 1);
        g.fillRect(x, y, 1, 1); g.fillRect(x + (f ? 1 : 0), y + (f ? 0 : 1), 1, 1); g.globalAlpha = 1; }
      this.insects(dt, t);
      if (this.prev) { const k = (performance.now() - this.prevT) / 900; if (k >= 1) this.prev = null; else { g.globalAlpha = 1 - k; g.drawImage(this.prev, 0, 0); g.globalAlpha = 1; } }
    }
    insects(dt, t) {
      const { g, W, gy } = this; if (reduce) return;
      if (!this.bugs) { seed = 404; const n = this.dark ? 0 : this.narrow ? 2 : 3, m = this.dark ? 0 : this.narrow ? 1 : 2; this.bugs = [];
        for (let i = 0; i < n; i++) this.bugs.push({ type: 'b', x: ra(W * .2, W * .8), y: gy - ra(6, 20), tx: W / 2, ty: gy - 12, t: 0, rest: 0, col: pick(['#f2a65a', '#ffffff', '#8ec5ff', '#f2c14e']) });
        for (let i = 0; i < m; i++) this.bugs.push({ type: 'd', x: ra(W * .3, W * .7), y: gy - ra(8, 18), tx: W / 2, ty: gy - 12, t: 0, hold: 0 }); }
      for (const b of this.bugs) {
        b.t -= dt;
        if (b.type === 'b') {      // butterfly: wanders, sometimes settles on a grass tip
          if (b.rest > 0) { b.rest -= dt; } else {
            if (b.t <= 0) { b.t = 1.5 + Math.random() * 2; if (Math.random() < .3) { const bl = this.blades[Math.floor(Math.random() * this.blades.length)]; b.tx = bl.x; b.ty = bl.ty - 1; b.landing = true; } else { b.tx = clamp(b.x + (Math.random() - .5) * 80, 4, W - 4); b.ty = gy - 6 - Math.random() * 20; b.landing = false; } }
            if (this.mx != null && Math.hypot(this.mx - b.x, this.my - b.y) < 10) { b.tx = b.x + (b.x - this.mx) * 3; b.ty = b.y - 8; b.landing = false; }
            b.x += (b.tx - b.x) * dt * .9 + Math.sin(t * 4 + b.ty) * dt * 6; b.y += (b.ty - b.y) * dt * .9 + Math.sin(t * 7 + b.tx) * dt * 5;
            if (b.landing && Math.hypot(b.tx - b.x, b.ty - b.y) < 1) { b.rest = 2 + Math.random() * 2; b.landing = false; } }
          const flap = b.rest > 0 ? (Math.sin(t * 2) > .6 ? 1 : 0) : Math.floor(t * 12 + b.ty) % 3, x = Math.round(b.x), y = Math.round(b.y);
          g.fillStyle = b.col; if (flap === 0) { g.fillRect(x - 2, y - 1, 2, 2); g.fillRect(x + 1, y - 1, 2, 2); } else if (flap === 1) { g.fillRect(x - 1, y - 2, 1, 2); g.fillRect(x + 1, y - 2, 1, 2); } else { g.fillRect(x - 2, y, 2, 1); g.fillRect(x + 1, y, 2, 1); }
          g.fillStyle = '#3a3040'; g.fillRect(x, y - 1, 1, 2);
        } else {                   // dragonfly: hovers, then darts
          if (b.t <= 0) { b.t = 1.2 + Math.random() * 1.8; b.tx = clamp(b.x + (Math.random() - .5) * 100, 6, W - 6); b.ty = gy - 6 - Math.random() * 16; b.hold = .25; }
          const k = b.hold > 0 ? 0 : 1 - Math.pow(.002, dt); b.hold -= dt; b.x += (b.tx - b.x) * k; b.y += (b.ty - b.y) * k + Math.sin(t * 13) * .08;
          const x = Math.round(b.x), y = Math.round(b.y), dir = b.tx >= b.x ? 1 : -1, w = Math.floor(t * 30) & 1;
          g.fillStyle = '#2f8f9a'; for (let i = 0; i < 5; i++) g.fillRect(x - dir * i, y, 1, 1); g.fillStyle = '#5fd0d8'; g.fillRect(x + dir, y, 1, 1);
          g.globalAlpha = .55; g.fillStyle = '#e8f6ff'; g.fillRect(x - dir, y - 1 - w, 1, 1); g.fillRect(x - dir * 2, y - 1 - w, 1, 1); g.fillRect(x - dir, y + 1 + w, 1, 1); g.fillRect(x - dir * 2, y + 1 + w, 1, 1); g.globalAlpha = 1;
        }
      }
      // fireflies at night
      if (this.dark && !this.snowy) { while (this.flies.length < (this.narrow ? 7 : 14)) this.flies.push({ x: Math.random() * W, y: gy - Math.random() * 30, ph: Math.random() * 7, sp: .4 + Math.random() * .5 });
        for (const f of this.flies) { f.x += Math.cos(t * f.sp + f.ph) * 5 * dt; f.y += Math.sin(t * f.sp * 1.4 + f.ph * 2) * 3 * dt; f.y = clamp(f.y, gy - 34, gy - 1); if (f.x < -2) f.x = W + 1; if (f.x > W + 2) f.x = -1;
          const a = Math.max(0, Math.sin(t * 1.6 + f.ph)); if (a < .05) continue; const x = Math.round(f.x), y = Math.round(f.y);
          g.globalAlpha = a * .35; g.fillStyle = '#d9f27a'; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); g.globalAlpha = a; g.fillStyle = '#f4ffb0'; g.fillRect(x, y, 1, 1); }
        g.globalAlpha = 1; }
    }
  }
  customElements.define('pixel-footer', PixelFooter);
})();
