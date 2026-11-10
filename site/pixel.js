/* pixel.js — a tiny software rasteriser for crisp, cheap, animated pixel art.
   Everything draws straight into a Uint32Array that is blitted once per frame. */
(function () {
  'use strict';
  const PX = (window.PX = {});

  PX.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  PX.lerp = (a, b, t) => a + (b - a) * t;
  PX.smooth = (t) => t * t * (3 - 2 * t);
  PX.reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  PX.hex = (h) => {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  PX.mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // packed little-endian RGBA (alpha 255)
  PX.pack = (c) => (255 << 24) | ((c[2] & 255) << 16) | ((c[1] & 255) << 8) | (c[0] & 255);
  // blend two packed colours, t in 0..1
  PX.bl = (a, b, t) => {
    if (t <= 0) return a;
    if (t >= 1) return b;
    const ar = a & 255, ag = (a >> 8) & 255, ab = (a >> 16) & 255, br = b & 255, bg = (b >> 8) & 255, bb = (b >> 16) & 255;
    return (255 << 24) | (((ab + (bb - ab) * t) & 255) << 16) | (((ag + (bg - ag) * t) & 255) << 8) | ((ar + (br - ar) * t) & 255);
  };
  PX.packr = (c) => PX.pack([Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]);
  PX.shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

  // 4x4 ordered-dither matrix, normalised to (0,1)
  PX.BAY = new Float32Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16));
  PX.dither = (x, y, a) => a > PX.BAY[((y & 3) << 2) | (x & 3)];

  // seeded rng + value noise
  PX.rng = (seed) => {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  PX.hash = (x, y, s) => {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 144665)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  PX.noise1 = (x, s) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return PX.hash(i, 0, s) * (1 - u) + PX.hash(i + 1, 0, s) * u;
  };
  PX.noise2 = (x, y, s) => {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = PX.hash(i, j, s), b = PX.hash(i + 1, j, s), c = PX.hash(i, j + 1, s), d = PX.hash(i + 1, j + 1, s);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  };

  /* Buffer */
  class Buf {
    constructor(canvas, w, h) {
      this.cv = canvas;
      canvas.width = w;
      canvas.height = h;
      this.w = w;
      this.h = h;
      this.ctx = canvas.getContext('2d', { alpha: true });
      this.img = this.ctx.createImageData(w, h);
      this.d = new Uint32Array(this.img.data.buffer);
    }
    clear() { this.d.fill(0); }
    fill(c) { this.d.fill(c); }
    px(x, y, c) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      this.d[y * this.w + x] = c;
    }
    // blend an rgb colour over what is already there
    mixpx(x, y, r, g, b, a) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = y * this.w + x, o = this.d[i];
      const or = o & 255, og = (o >> 8) & 255, ob = (o >> 16) & 255;
      this.d[i] = (255 << 24) | (((ob + (b - ob) * a) & 255) << 16) | (((og + (g - og) * a) & 255) << 8) | ((or + (r - or) * a) & 255);
    }
    rect(x, y, w, h, c) {
      x |= 0; y |= 0; w |= 0; h |= 0;
      const x0 = Math.max(0, x), x1 = Math.min(this.w, x + w), y0 = Math.max(0, y), y1 = Math.min(this.h, y + h);
      for (let j = y0; j < y1; j++) {
        const row = j * this.w;
        for (let i = x0; i < x1; i++) this.d[row + i] = c;
      }
    }
    disc(cx, cy, r, c) {
      const r2 = r * r + r * 0.6;
      for (let j = -Math.ceil(r); j <= Math.ceil(r); j++)
        for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) if (i * i + j * j <= r2) this.px(cx + i, cy + j, c);
    }
    // ordered-dither halo, additive-looking glow
    glow(cx, cy, R, rgb, strength) {
      const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(this.w - 1, Math.ceil(cx + R));
      const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(this.h - 1, Math.ceil(cy + R));
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const d = Math.hypot(x - cx, y - cy) / R;
          if (d >= 1) continue;
          const q = Math.round((1 - d) * (1 - d) * strength * 10) / 10;
          if (q > 0) this.mixpx(x, y, rgb[0], rgb[1], rgb[2], q * 0.5);
        }
    }
    line(x0, y0, x1, y1, c) {
      x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        this.px(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    sprite(x, y, rows, pal) {
      for (let j = 0; j < rows.length; j++) {
        const r = rows[j];
        for (let i = 0; i < r.length; i++) {
          const ch = r[i];
          if (ch !== '.' && pal[ch] !== undefined) this.px(x + i, y + j, pal[ch]);
        }
      }
    }
    flush() { this.ctx.putImageData(this.img, 0, 0); }
  }
  PX.Buf = Buf;

  /* Run a draw loop only while visible, throttled, and still when motion is reduced. */
  PX.loop = (el, draw, fps) => {
    const step = 1000 / (fps || 30);
    let raf = 0, last = 0, vis = true, running = false;
    const api = {
      t0: performance.now(),
      render() { draw((performance.now() - api.t0) / 1000, 0); },
    };
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (now - last < step) return;
      const dt = (now - last) / 1000;
      last = now;
      draw((now - api.t0) / 1000, Math.min(dt, 0.1));
    };
    const start = () => { if (!running && vis && !document.hidden) { running = true; last = 0; raf = requestAnimationFrame(tick); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    api.start = start;
    api.stop = stop;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { vis = es[0].isIntersecting; vis ? start() : stop(); }, { rootMargin: '80px' }).observe(el);
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    api.render();
    if (!PX.reduced) start();
    return api;
  };

  /* Pixel icons: draw from strings, returns an inline svg string */
  PX.icon = (rows, pal, size) => {
    let p = '';
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        const ch = r[x];
        if (ch !== '.' && pal[ch]) p += `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[ch]}"/>`;
      }
    });
    const w = rows[0].length, h = rows.length;
    return `<svg viewBox="0 0 ${w} ${h}" width="${size || w * 2}" height="${size ? (size * h) / w : h * 2}" shape-rendering="crispEdges" aria-hidden="true">${p}</svg>`;
  };
})();
