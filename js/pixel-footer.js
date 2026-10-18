/* pixel-footer.js — <pixel-footer>: an interactive side-scroller diorama that the footer stands on.
 * Sprites come from Hanomi's hand-built art library (hanomi/js/art: trees, props, animals, villagers) plus custom
 * parts drawn here: Himalaya, a hazy far forest, a grass edge over a soil cross-section (the footer links sit on it),
 * prayer flags, glows, fireflies, butterflies, petals, sparks, weather.
 *  - parallax: the layers drift with the pointer
 *  - wildlife: a deer, a fox, rabbits and chickens wander; they flee from the cursor and hop when clicked
 *  - click a tree to shake it (leaves / petals fall), the campfire for sparks, the lantern to switch it
 *  - day / night and the site weather (snow: snowy pines, white ground; rain / storm: wet and dark) follow the sky
 * The art library is only imported once the footer comes near the viewport; it renders at 30 fps while visible. */
(() => {
  'use strict';
  if (customElements.get('pixel-footer')) return;
  const D = document, R = D.documentElement, S = 3;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDark = () => R.getAttribute('data-theme') === 'dark';
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16), bay = (x, y) => BAY[(y & 3) * 4 + (x & 3)];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
  let seed = 7; const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ra = (a, b) => a + rnd() * (b - a), pick = a => a[Math.floor(rnd() * a.length)];
  const cv = (w, h) => { const c = D.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
  const sfx = name => D.dispatchEvent(new CustomEvent('sky:sfx', { detail: name }));
  const weatherNow = () => (window.PixelSky && window.PixelSky.weather) || 'fair';
  function tint(c, col, a) { const g = c.getContext('2d'); g.save(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = a; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); g.restore(); }
  function glowSprite(r, col) { const c = cv(r * 2, r * 2), g = c.getContext('2d'); g.fillStyle = col; for (let y = 0; y < r * 2; y++) for (let x = 0; x < r * 2; x++) { const d = Math.hypot(x + .5 - r, y + .5 - r) / r; if (d < 1 && bay(x, y) < (1 - d) * (1 - d) * .9) g.fillRect(x, y, 1, 1); } return c; }

  let ART = null, artP = null;
  function loadArt() {
    if (artP) return artP;
    artP = Promise.all([import('/hanomi/js/art/nature.js'), import('/hanomi/js/art/structures.js'), import('/hanomi/js/art/animals.js'), import('/hanomi/js/art/chars.js')])
      .then(([n, s, a, c]) => { const N = n.bakeNature(); s.bakeStructures({}); ART = { N, ST: s.S, animal: a.bakeAnimal, char: c.bakeChar, villager: c.villagerLook }; return ART; });
    return artP;
  }

  class PixelFooter extends HTMLElement {
    connectedCallback() {
      if (this._on) return; this._on = true; this.setAttribute('aria-hidden', 'true');
      this.c = D.createElement('canvas'); this.appendChild(this.c); this.g = this.c.getContext('2d');
      this.px = .5; this.tpx = .5; this.vis = false; this.parts = []; this.shake = {};
      const near = new IntersectionObserver(es => { if (es[es.length - 1].isIntersecting) { near.disconnect(); loadArt().then(() => this.build()).catch(() => {}); } }, { rootMargin: '700px 0px' }); near.observe(this);
      this.io = new IntersectionObserver(es => { this.vis = es[es.length - 1].isIntersecting; }); this.io.observe(this);
      this.ro = new ResizeObserver(() => { clearTimeout(this._rz); this._rz = setTimeout(() => ART && this.build(), 150); }); this.ro.observe(this);
      const rebuild = () => ART && this.build(true);
      this.mo = new MutationObserver(rebuild); this.mo.observe(R, { attributes: true, attributeFilter: ['data-theme'] });
      D.addEventListener('sky:weather', this._wx = rebuild);
      addEventListener('pointermove', this._pm = e => { const r = this.getBoundingClientRect(); if (e.clientY < r.top - 200 || e.clientY > r.bottom) { this.hover = null; return; } this.tpx = clamp((e.clientX - r.left) / r.width, 0, 1); this.mx = (e.clientX - r.left) / S; this.my = (e.clientY - r.top) / S; this.onHover(); }, { passive: true });
      this.addEventListener('click', e => this.onClick(e));
      let last = 0; const loop = now => { this.raf = requestAnimationFrame(loop); if (!this.ready || !this.vis || D.hidden || now - last < 32) return; const dt = Math.min(.1, (now - last) / 1000); last = now; this.tick(dt, now / 1000); };
      this.raf = requestAnimationFrame(loop);
    }
    disconnectedCallback() { this._on = false; cancelAnimationFrame(this.raf); this.io.disconnect(); this.ro.disconnect(); this.mo.disconnect(); D.removeEventListener('sky:weather', this._wx); removeEventListener('pointermove', this._pm); }

    /* ---------------- build the static layers ---------------- */
    build(fade) {
      const foot = this.nextElementSibling && this.nextElementSibling.matches('.minimal-footer') ? this.nextElementSibling : null;
      const narrow = this.clientWidth < 640;
      const sceneH = narrow ? 66 : 82, soilPx = Math.max(narrow ? 120 : 96, (foot ? foot.offsetHeight : 80) + 30);
      const soil = Math.ceil(soilPx / S), W = Math.ceil(this.clientWidth / S), H = sceneH + soil, gy = sceneH;
      this.style.height = H * S + 'px'; if (foot) foot.style.marginTop = -(soil * S) + 'px';
      if (fade && this.W) { const p = cv(this.W, this.H); p.getContext('2d').drawImage(this.c, 0, 0); this.prev = p; this.prevT = performance.now(); }
      this.W = W; this.H = H; this.gy = gy; this.narrow = narrow;
      this.c.width = W; this.c.height = H; this.c.style.width = W * S + 'px'; this.c.style.height = H * S + 'px'; this.g.imageSmoothingEnabled = false;
      const dark = isDark(), wx = weatherNow(), snowy = wx === 'snow', wet = wx === 'rain' || wx === 'storm';
      this.dark = dark; this.snowy = snowy; this.wet = wet; this.wx = wx;
      const night = (c, a = .55) => { if (dark) tint(c, '#0d1430', a); if (wet) tint(c, dark ? '#0a0e1a' : '#5b6575', dark ? .25 : .28); return c; };
      const { N, ST } = ART; seed = 1234;
      // 1. distant Himalaya
      const mtn = cv(W, H), mg = mtn.getContext('2d'), peaks = []; for (let i = 0; i < Math.max(3, W / 55); i++) peaks.push([ra(0, W), ra(.5, 1) * sceneH * .62, ra(16, 34)]);
      for (let x = 0; x < W; x++) { let h = sceneH * .2; for (const [p, a, w] of peaks) h = Math.max(h, a * (1 - Math.abs(x - p) / w) + sceneH * .2); h += Math.sin(x * .3) * .8; const top = Math.round(gy - 14 - h), lit = (x % 7) < 4;
        for (let y = top; y < gy - 8; y++) { const snowLine = top + Math.max(3, h * .28); mg.fillStyle = (snowy || h > sceneH * .42) && y < snowLine + (bay(x, y) - .5) * 3 ? (dark ? '#8a98c2' : '#ffffff') : dark ? '#28314f' : '#bfcde2'; mg.fillRect(x, y, 1, 1); } }
      if (wet) tint(mtn, dark ? '#0a0e1a' : '#a7b0bc', .45);
      // 2. far forest silhouettes
      const far = cv(W, H), fg = far.getContext('2d'); fg.fillStyle = dark ? '#1a2238' : snowy ? '#c9d6e3' : '#a9c1b5';
      for (let x = -4; x < W + 4; x += ra(3, 6) | 0) { const h = ra(10, 22) | 0, base = gy - 4; for (let k = 0; k < h; k++) { const w = Math.floor(k / 2.2); fg.fillRect(x - w, base - h + k, w * 2 + 1, 1); } }
      fg.fillRect(0, gy - 5, W, 5); if (wet) tint(far, '#6f7886', .3);
      // 3. mid tree line: Hanomi trees, hazed into the distance
      const mid = cv(W, H), mdg = mid.getContext('2d'), midKinds = snowy ? ['pinesnow0', 'pinesnow1', 'pinesnow2', 'dead0'] : ['pine0', 'pine2', 'oak1', 'birch1', 'pine3', 'oak2'];
      for (let x = ra(0, 20); x < W; x += ra(18, 34)) { const t = N[pick(midKinds)]; mdg.drawImage(t.cv, Math.round(x - t.ax), gy - 3 - t.ay); }
      tint(mid, dark ? '#141c34' : snowy ? '#e7eef5' : '#cfe0dc', dark ? .55 : .42); if (wet) tint(mid, '#6f7886', .25);
      // 4. ground: grass edge + soil cross-section
      const gr = cv(W, H), gg = gr.getContext('2d');
      const soilC = dark ? ['#3a2a20', '#30231b', '#271c16', '#1d1511'] : ['#7a5638', '#6a4a30', '#5a3f29', '#463120'];
      for (let y = gy + 2; y < H; y++) { const k = (y - gy) / (H - gy) * (soilC.length - 1), i = Math.min(soilC.length - 2, Math.floor(k)); for (let x = 0; x < W; x++) { gg.fillStyle = bay(x, y) < k - i ? soilC[i + 1] : soilC[i]; gg.fillRect(x, y, 1, 1); } }
      for (let k = 0; k < W / 9; k++) { const x = ra(0, W), y = ra(gy + 6, H - 3), rx = ra(1.5, 3.5); for (let yy = -2; yy <= 2; yy++) for (let xx = -4; xx <= 4; xx++) if ((xx / rx) ** 2 + (yy / (rx * .6)) ** 2 <= 1) { gg.fillStyle = yy < 0 ? (dark ? '#5a5560' : '#a69a8c') : (dark ? '#3e3a44' : '#7f7466'); gg.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1); } }
      const grassTop = snowy ? (dark ? ['#9aa6c8', '#7f8bb0', '#6a769c'] : ['#ffffff', '#e6eef6', '#c9d6e4']) : dark ? ['#3c6a42', '#2f5636', '#24452c'] : ['#7cc35a', '#5aa04a', '#3e8a3a'];
      for (let x = 0; x < W; x++) { for (let r2 = 0; r2 < 3; r2++) { gg.fillStyle = grassTop[r2]; gg.fillRect(x, gy + r2, 1, 1); }
        if (snowy) { const drift = 1 + Math.round(1.5 + Math.sin(x * .19) * 1.2 + Math.sin(x * .05) * .8); gg.fillStyle = grassTop[0]; gg.fillRect(x, gy - drift, 1, drift); gg.fillStyle = grassTop[1]; gg.fillRect(x, gy + 3, 1, 1); } if (rnd() < .5) { gg.fillStyle = grassTop[snowy ? 0 : 1]; gg.fillRect(x, gy - 1, 1, 1); if (rnd() < .3) gg.fillRect(x, gy - 2, 1, 1); }
        if (!snowy && rnd() < .08) { gg.fillStyle = dark ? '#5a4a30' : '#4a3424'; gg.fillRect(x, gy + 3, 1, ri(2, 5)); } }
      // 5. the main row: trees, props, a campfire with a villager, the torii
      const pos = f => Math.round(W * f), items = [];
      const tree = (k, f) => { const t = N[k]; if (t) items.push({ type: 'tree', k, x: pos(f), spr: t, sway: rnd() * 6 }); };
      const prop = (k, f, extra) => { const t = ST[k]; if (t) items.push(Object.assign({ type: 'prop', k, x: pos(f), spr: t }, extra || {})); };
      const sn = s => snowy ? s.replace(/^pine(\d)/, 'pinesnow$1') : s;
      if (narrow) { tree(sn('pine1'), .07); prop('lantern', .2, { glow: 1 }); this.fire = pos(.36); tree(snowy ? 'dead1' : 'sakura0', .72); tree(sn('pine2'), .96); }
      else { tree(sn('pine1'), .04); tree(snowy ? 'dead0' : 'oak0', .12); prop('lantern', .2, { glow: 1 }); prop('bench', .27); this.fire = pos(.34); prop('torii', .48); tree(snowy ? 'dead1' : 'sakura0', .6); prop('shrine', .7, { glow: .6 }); tree(snowy ? sn('pine3') : 'birch0', .8); prop('sign', .86); tree(sn('pine2'), .93); }
      this.items = items;
      // shrubs, boulders, flowers and grass between them
      this.deco = [];
      for (let x = 3; x < W - 3; x += ra(5, 11)) { const k = pick(snowy ? ['boulder1', 'boulder2', 'stump', 'bush0', 'pebbles2'] : ['bush0', 'bush1', 'berry0', 'boulder1', 'boulder6', 'flowers0', 'flowers2', 'flowers4', 'flowers6', 'mush0', 'mush3', 'grass0', 'grass1', 'flowers1']); if (items.some(i => Math.abs(i.x - x) < 6)) continue; const s = N[k]; if (s) this.deco.push({ x: Math.round(x), spr: s, front: rnd() < .35 }); }
      // pre-render the static main row (everything that does not animate)
      const main = cv(W, H), mng = main.getContext('2d');
      const drawItem = (g, it, dx = 0) => g.drawImage(it.spr.cv, it.x - it.spr.ax + dx, gy + 1 - it.spr.ay);
      for (const d of this.deco) if (!d.front) drawItem(mng, d);
      this.static = { mtn: night(mtn, .5), far: night(far, .45), mid: night(mid, .45), ground: night(gr, .45), main: night(main, .5) };
      // trees and props get their own night-tinted sprites (trees can shake)
      this.tintCache = new Map(); const tinted = spr => { const src = spr.cv; if (!dark && !wet) return src; let c = this.tintCache.get(src); if (c) return c; c = cv(src.width, src.height); c.getContext('2d').drawImage(src, 0, 0); night(c, .5); this.tintCache.set(src, c); return c; };   // keyed by the source canvas: no per-frame allocations
      this.tinted = tinted;
      this.front = this.deco.filter(d => d.front);
      // prayer flags between the first two trees
      const tr = items.filter(i => i.type === 'tree'); this.flags = tr.length > 1 ? [[tr[0].x + 3, gy - Math.round(tr[0].spr.ay * .55)], [tr[1].x - 3, gy - Math.round(tr[1].spr.ay * .5)]] : null;
      // the villager warming their hands, and the wildlife
      const vil = ART.char(ART.villager(5)); this.vil = vil;
      const mkA = (kind, x, range) => { const a = ART.animal(kind); return { kind, a, x, y: 0, vy: 0, dir: rnd() < .5 ? 1 : -1, state: 'walk', t: ra(1, 4), f: 0, range, speed: { deer: 6, fox: 9, rabbit: 7, chicken: 3, sheep: 3 }[kind] }; };
      this.animals = narrow ? [mkA('rabbit', W * .62, [W * .4, W * .95]), mkA('fox', W * .2, [W * .05, W * .5]), mkA('chicken', W * .72, [W * .6, W * .9])]
        : [mkA('deer', W * .56, [W * .4, W * .78]), mkA('fox', W * .15, [W * .02, W * .3]), mkA('rabbit', W * .64, [W * .55, W * .9]), mkA('rabbit', W * .9, [W * .78, W * .99]), mkA('chicken', W * .73, [W * .66, W * .84]), mkA('chicken', W * .76, [W * .66, W * .84])];
      this.glowWarm = glowSprite(16, '#ffb35c'); this.glowSoft = glowSprite(9, '#ffd98a');
      this.flies = []; this.ready = true; if (reduce) this.tick(0, 0);
    }

    /* ---------------- interaction ---------------- */
    hit(mx, my) {
      const gy = this.gy;
      for (const a of this.animals) { const s = a.a.walk[0].n; if (Math.abs(mx - a.x) < s.width / 2 + 2 && my > gy - s.height - 2 + a.y && my < gy + 2) return { a }; }
      if (this.fire && Math.abs(mx - this.fire) < 7 && my > gy - 14 && my < gy + 2) return { fire: 1 };
      for (const it of this.items) { const s = it.spr; if (mx > it.x - s.ax && mx < it.x - s.ax + s.cv.width && my > gy - s.ay && my < gy + 2) return { it }; }
      return null;
    }
    onHover() {
      if (!this.ready) return; const h = this.hit(this.mx, this.my); this.style.cursor = h ? 'pointer' : '';
      for (const a of this.animals) if (Math.abs(this.mx - a.x) < 16 && this.my > this.gy - 30 && a.state !== 'flee') { a.state = 'flee'; a.dir = a.x > this.mx ? 1 : -1; a.t = ra(1.2, 2); if (a.kind === 'rabbit' || a.kind === 'chicken') a.vy = -45; }
    }
    onClick(e) {
      if (!this.ready) return; const r = this.getBoundingClientRect(), mx = (e.clientX - r.left) / S, my = (e.clientY - r.top) / S, h = this.hit(mx, my); if (!h) return;
      if (h.a) { h.a.vy = -70; h.a.state = 'flee'; h.a.dir = -h.a.dir; h.a.t = 1.5; sfx('drop'); }
      else if (h.fire) { for (let i = 0; i < 18; i++) this.parts.push({ x: this.fire + ra(-2, 2), y: this.gy - 6, vx: ra(-14, 14), vy: ra(-55, -25), g: 25, life: ra(.6, 1.2), age: 0, c: pick(['#ffd27a', '#ff9a3c', '#fff1c0']) }); sfx('sparkle'); }
      else if (h.it) {
        const it = h.it;
        if (it.k === 'lantern') { it.off = !it.off; sfx('toggle'); return; }
        if (it.type === 'tree') { this.shake[it.x] = .5; const sak = it.k.startsWith('sakura'), cols = sak ? ['#f6aec0', '#e47b98'] : this.snowy ? ['#ffffff', '#dfe8f2'] : it.k.startsWith('birch') ? ['#e9c84c', '#b9d65a'] : ['#7cc35a', '#4a9a42', '#c9a640'];
          for (let i = 0; i < 16; i++) this.parts.push({ x: it.x + ra(-10, 10), y: this.gy - it.spr.ay + ra(4, 22), vx: ra(-8, 8), vy: ra(-6, 4), g: 12, life: ra(1.5, 2.6), age: 0, c: pick(cols), leaf: 1, ph: rnd() * 6 }); sfx('drop'); }
        else sfx('tap');
      }
    }

    /* ---------------- frame ---------------- */
    tick(dt, t) {
      const { g, W, H, gy } = this; if (!W) return;
      this.px += (this.tpx - this.px) * Math.min(1, dt * 3); const p = reduce ? 0 : this.px - .5, off = k => Math.round(p * k);
      g.clearRect(0, 0, W, H);
      g.drawImage(this.static.mtn, off(-3), 0); g.drawImage(this.static.far, off(-6), 0); g.drawImage(this.static.mid, off(-10), 0);
      g.drawImage(this.static.ground, 0, 0); g.drawImage(this.static.main, 0, 0);
      // trees (with shake) and props
      for (const it of this.items) { let dx = 0; const sh = this.shake[it.x]; if (sh > 0) { dx = Math.round(Math.sin(t * 60) * 1.2 * (sh / .5)); this.shake[it.x] = sh - dt; } g.drawImage(this.tinted(it.spr), it.x - it.spr.ax + dx, gy + 1 - it.spr.ay); }
      // prayer flags fluttering between two trees
      if (this.flags) { const [[x0, y0], [x1, y1]] = this.flags, n = Math.max(8, Math.round(Math.abs(x1 - x0) / 3)), cols = ['#3d7be0', '#ffffff', '#e0473c', '#3fae5a', '#f2c24b'];
        for (let i = 0; i <= n; i++) { const u = i / n, x = Math.round(lerp(x0, x1, u)), y = Math.round(lerp(y0, y1, u) + Math.sin(Math.PI * u) * 4); g.fillStyle = this.dark ? '#4a5270' : '#8a8f99'; g.fillRect(x, y, 1, 1);
          if (i % 2 && i < n) { const fl = reduce ? 0 : Math.round(Math.sin(t * 6 + i) * .7); g.globalAlpha = this.dark ? .6 : 1; g.fillStyle = cols[(i >> 1) % 5]; g.fillRect(x, y + 1, 2, 2 + (fl > 0)); g.globalAlpha = 1; } } }
      // campfire + villager
      if (this.fire) {
        const fr = ART.ST['fire' + (Math.floor(t * 8) % 4)] || ART.ST.fire0; g.drawImage(fr.cv, this.fire - fr.ax, gy + 1 - fr.ay);
        const vf = this.vil[0].idle[Math.floor(t * 2) % 4] || this.vil[0].idle[0]; g.drawImage(this.tinted({ cv: vf }), this.fire + 9, gy + 1 - vf.height + 2);
        if (!this.dark && !reduce && Math.random() < dt * 4) this.parts.push({ x: this.fire + ra(-1, 1), y: gy - 9, vx: ra(-2, 4), vy: ra(-9, -6), g: 0, life: ra(1.5, 2.5), age: 0, c: '#c9ccd2', smoke: 1 });
      }
      // night glows: campfire, lantern, shrine window
      if (this.dark || this.wet) { g.save(); g.globalCompositeOperation = 'lighter';
        if (this.fire) { g.globalAlpha = .35 + .12 * Math.sin(t * 9) * Math.sin(t * 3.3); g.drawImage(this.glowWarm, this.fire - 16, gy - 22); }
        for (const it of this.items) if (it.glow && !it.off) { g.globalAlpha = (.28 + .06 * Math.sin(t * 2 + it.x)) * it.glow; g.drawImage(this.glowSoft, it.x - 9, gy - it.spr.ay + (it.k === 'lantern' ? 2 : 10)); }
        g.restore(); }
      // wildlife
      for (const a of this.animals) {
        a.t -= dt; const s = a.a;
        if (a.t < 0) { if (a.state === 'flee' || a.state === 'walk') { a.state = rnd() < .45 ? 'idle' : 'walk'; a.t = ra(1.5, 4); if (rnd() < .4) a.dir = -a.dir; } else { a.state = 'walk'; a.t = ra(2, 5); } }
        const sp = a.state === 'flee' ? a.speed * 3.2 : a.state === 'walk' ? a.speed : 0;
        if (!reduce) { a.x += a.dir * sp * dt; if (a.x < a.range[0]) { a.x = a.range[0]; a.dir = 1; } if (a.x > a.range[1]) { a.x = a.range[1]; a.dir = -1; }
          if (a.kind === 'rabbit' && sp && a.y === 0 && a.vy === 0) a.vy = -30;
          a.vy += 220 * dt; a.y = Math.min(0, a.y + a.vy * dt); if (a.y === 0) a.vy = 0; }
        a.f += dt * (sp ? (a.state === 'flee' ? 14 : 8) : 0);
        const frames = sp ? s.walk : s.idle, fi = sp ? Math.floor(a.f) % frames.length : (Math.sin(t * .8 + a.x) > .2 ? 1 : 0), spr = (frames[fi] || frames[0])[a.dir > 0 ? 'n' : 'f'];
        g.drawImage(this.tinted({ cv: spr }), Math.round(a.x - spr.width / 2), Math.round(gy + 2 - spr.height + a.y));
      }
      // particles: sparks, leaves, smoke
      for (let i = this.parts.length - 1; i >= 0; i--) { const q = this.parts[i]; q.age += dt; if (q.age > q.life) { this.parts.splice(i, 1); continue; }
        q.vy += q.g * dt; q.x += (q.vx + (q.leaf ? Math.sin(t * 3 + q.ph) * 6 : 0)) * dt; q.y = Math.min(q.leaf ? gy : 1e9, q.y + q.vy * dt);
        g.globalAlpha = (1 - q.age / q.life) * (q.smoke ? .35 : 1); g.fillStyle = q.c; g.fillRect(Math.round(q.x), Math.round(q.y), q.smoke ? 2 : 1, q.smoke ? 2 : 1); }
      g.globalAlpha = 1;
      // sakura petals drift down; butterflies by day; fireflies by night
      const sak = this.items.find(i => i.k.startsWith('sakura'));
      if (sak && !this.snowy && !reduce && Math.random() < dt * 1.5) this.parts.push({ x: sak.x + ra(-12, 12), y: gy - sak.spr.ay + ra(6, 20), vx: ra(2, 6), vy: ra(2, 5), g: 2, life: 4, age: 0, c: pick(['#f6aec0', '#e47b98']), leaf: 1, ph: rnd() * 6 });
      if (!reduce) {
        const want = this.dark ? (this.wet || this.snowy ? 0 : this.narrow ? 7 : 14) : (this.wx === 'fair' || this.wx === 'clear') ? (this.narrow ? 2 : 4) : 0;
        while (this.flies.length < want) this.flies.push({ x: ra(0, W), y: ra(gy - 30, gy - 4), ph: rnd() * 7, sp: ra(.4, .9), c: this.dark ? null : pick(['#f2c14e', '#ffffff', '#e8778f', '#8ec5ff']) });
        if (this.flies.length > want) this.flies.length = want;
        for (const f of this.flies) {
          f.x += Math.cos(t * f.sp + f.ph) * (this.dark ? 6 : 14) * dt + (this.mx != null && this.dark ? clamp(this.mx - f.x, -20, 20) * .02 : 0); f.y += Math.sin(t * f.sp * 1.4 + f.ph * 2) * 5 * dt;
          if (f.x < -3) f.x = W + 2; if (f.x > W + 3) f.x = -2; f.y = clamp(f.y, gy - 40, gy - 2);
          const x = Math.round(f.x), y = Math.round(f.y);
          if (this.dark) { const a = Math.max(0, Math.sin(t * 1.7 + f.ph)); if (a < .05) continue; g.globalAlpha = a * .35; g.fillStyle = '#d9f27a'; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); g.globalAlpha = a; g.fillStyle = '#f4ffb0'; g.fillRect(x, y, 1, 1); }
          else { const up = Math.floor(t * 10 + f.ph) & 1; g.fillStyle = f.c; g.fillRect(x - 1, y - up, 1, 1); g.fillRect(x + 1, y - up, 1, 1); g.fillStyle = '#3a3040'; g.fillRect(x, y, 1, 1); }
        }
        g.globalAlpha = 1;
        // weather inside the scene
        if (this.snowy || this.wet) { this.wp = this.wp || []; const rate = this.snowy ? W * .25 : W * .9; for (let k = rate * dt + Math.random(); k > 1; k--) this.wp.push({ x: ra(-10, W), y: -2, v: this.snowy ? ra(8, 14) : ra(120, 160), ph: rnd() * 6 });
          g.fillStyle = this.snowy ? '#ffffff' : (this.dark ? '#8ea8d8' : '#6f97c4');
          for (let i = this.wp.length - 1; i >= 0; i--) { const w = this.wp[i]; w.y += w.v * dt; w.x += (this.snowy ? Math.sin(t + w.ph) * 4 : 30) * dt; if (w.y > gy + 1) { this.wp.splice(i, 1); continue; }
            g.globalAlpha = this.snowy ? .9 : .6; if (this.snowy) g.fillRect(Math.round(w.x), Math.round(w.y), 1, 1); else { g.fillRect(Math.round(w.x), Math.round(w.y), 1, 3); } }
          g.globalAlpha = 1; } else if (this.wp) this.wp.length = 0;
      }
      // foreground: dark grass tufts swaying along the edge, then the remaining front deco
      for (const d of this.front) g.drawImage(this.tinted(d.spr), d.x - d.spr.ax, gy + 1 - d.spr.ay);
      g.fillStyle = this.snowy ? (this.dark ? '#6a769c' : '#c9d6e4') : this.dark ? '#1b3322' : '#2f6b34';
      for (let x = 0; x < W; x += 3) { const h = 2 + ((x * 7) % 4), sw = reduce ? 0 : Math.round(Math.sin(t * 1.6 + x * .3) * .8 + p * 2); g.fillRect(x + sw, gy + 3 - h, 1, h); if (((x * 13) % 5) === 0) g.fillRect(x + 1 + sw, gy + 2 - h, 1, h); }
      if (this.prev) { const k = (performance.now() - this.prevT) / 1100; if (k >= 1) this.prev = null; else { g.globalAlpha = 1 - k; g.drawImage(this.prev, 0, 0); g.globalAlpha = 1; } }
    }
  }
  function ri(a, b) { return Math.floor(ra(a, b + 1)); }
  customElements.define('pixel-footer', PixelFooter);
})();
