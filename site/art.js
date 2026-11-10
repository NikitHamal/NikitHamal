/* art.js — the mandala that falls apart, the illuminated plates, and the lake of lamps. */
(function () {
  'use strict';
  const { Buf, hex, mix, packr, clamp, lerp, smooth, BAY, hash, noise1 } = PX;
  const root = document.documentElement;
  const cs = getComputedStyle(root);

  function cssRGB(name, fb) {
    let v = cs.getPropertyValue(name).trim();
    let m = v.match(/rgba?\(([^)]+)\)/);
    if (m) { const a = m[1].split(/[ ,\/]+/).map(Number); return [a[0], a[1], a[2]]; }
    if (v[0] === '#') { if (v.length === 4) v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]; return hex(v); }
    return fb || [128, 128, 128];
  }
  const mixc = (a, b, t) => packr(mix(a, b, t));

  /* =========================================================
     1. THE MANDALA  — every one is different, none lasts
     ========================================================= */
  const mc = document.getElementById('mandala');
  if (mc) {
    const M = 96, C = 47.5, RMAX = 46;
    const B = new Buf(mc, M, M);
    const rr = new Float32Array(M * M), th = new Float32Array(M * M), hh = new Float32Array(M * M);
    for (let y = 0; y < M; y++)
      for (let x = 0; x < M; x++) {
        const i = y * M + x, dx = x - C, dy = y - C;
        rr[i] = Math.hypot(dx, dy);
        th[i] = Math.atan2(dy, dx) + Math.PI;
        hh[i] = hash(x, y, 31);
      }

    function gen(seed) {
      const R = PX.rng(seed);
      const rings = [{ r0: 0, r1: 3.2, type: 'bindu' }];
      let r = 3.6, n = [8, 12, 16][(R() * 3) | 0];
      while (r < RMAX - 3) {
        const type = ['petalOut', 'petalIn', 'zig', 'dots', 'line', 'petalOut', 'band', 'petalIn'][(R() * 8) | 0];
        const wid = type === 'line' ? 1 : type === 'dots' ? 3 + ((R() * 2) | 0) : 5 + ((R() * 7) | 0);
        if (R() < 0.5) n = [8, 12, 16, 24][(R() * 4) | 0];
        rings.push({ r0: r, r1: Math.min(RMAX - 2, r + wid), type, n, col: [2, 3, 3, 1][(R() * 4) | 0] });
        r += wid + (R() < 0.45 ? 1 : 0);
      }
      rings.push({ r0: RMAX - 2, r1: RMAX - 1, type: 'line', col: 3 }, { r0: RMAX - 0.2, r1: RMAX + 1.2, type: 'line', col: 1 });
      const out = new Uint8Array(M * M);
      for (let i = 0; i < M * M; i++) {
        const r_ = rr[i];
        if (r_ > RMAX + 1.2) continue;
        let g = null;
        for (const q of rings) if (r_ >= q.r0 && r_ < q.r1) { g = q; break; }
        if (!g) continue;
        out[i] = ringPix(g, r_, th[i], i);
      }
      return out;
    }
    function ringPix(g, r, a, i) {
      if (g.type === 'bindu') return r < 2.2 ? 2 : 1;
      if (g.type === 'line') return g.col === 1 ? 1 : 3;
      const ph = (a * g.n) / (2 * Math.PI);
      const fr = ph - Math.floor(ph);
      const fold = Math.abs(fr - 0.5) * 2;
      if (g.type === 'petalOut') {
        const e = g.r0 + (g.r1 - g.r0) * (1 - Math.pow(fold, 1.7));
        if (r > e) return 0;
        if (r > e - 1.1) return 1;
        return (r - g.r0) / (e - g.r0 + 0.01) > BAY[((i / M | 0) & 3) * 4 + ((i % M) & 3)] * 1.1 ? g.col : 0;
      }
      if (g.type === 'petalIn') {
        const e = g.r1 - (g.r1 - g.r0) * (1 - Math.pow(fold, 1.7));
        if (r < e) return 0;
        if (r < e + 1.1) return 1;
        return (g.r1 - r) / (g.r1 - e + 0.01) > BAY[((i / M | 0) & 3) * 4 + ((i % M) & 3)] * 1.1 ? g.col : 0;
      }
      if (g.type === 'zig') {
        const tri = Math.abs(fr * 2 - 1);
        return r > g.r0 + (g.r1 - g.r0) * tri * 0.92 ? g.col : 0;
      }
      if (g.type === 'dots') {
        const dl = (fr - 0.5) * ((2 * Math.PI) / g.n) * r, dr = r - (g.r0 + g.r1) / 2;
        return dl * dl + dr * dr < 2.6 ? g.col : 0;
      }
      if (g.type === 'band') {
        if (r < g.r0 + 1 || r > g.r1 - 1) return 4;
        return fr < 0.5 ? g.col : 0;
      }
      return 0;
    }

    const day = Math.floor(Date.now() / 864e5);
    let seed = day * 7 + 3, cur = gen(seed), nxt = null, tt = 1, count = 0, last = 0;
    const lut = new Uint32Array(8);
    let ink = [30, 30, 50], acc = [190, 60, 40], gold = [200, 150, 50], mute = [140, 130, 120], fr = 0;
    const cap = document.getElementById('mandalaCap');
    const setCap = () => { if (cap) cap.textContent = 'No. ' + String(seed % 10000).padStart(4, '0'); };
    setCap();

    function frame(t, dt) {
      if (fr++ % 6 === 0) {
        ink = cssRGB('--ink', ink); acc = cssRGB('--accent', acc); gold = cssRGB('--gold', gold); mute = cssRGB('--mute', mute);
      }
      lut[1] = packr(ink); lut[2] = packr(acc); lut[4] = packr(mute); lut[5] = mixc(gold, [255, 255, 255], 0.65);
      const gD = packr(mix(gold, ink, 0.35)), gM = packr(gold), gL = packr(mix(gold, [255, 250, 220], 0.5));
      if (nxt) { tt += (dt || 0.033) / 2.1; if (tt >= 1) { tt = 1; cur = nxt; nxt = null; } }
      const D = B.d;
      for (let i = 0; i < M * M; i++) {
        let v = cur[i], spark = false;
        if (nxt) {
          const r = rr[i] / RMAX, h = hh[i];
          if (tt < 0.42) {
            const k = tt / 0.42, thr = 1 - (h * 0.55 + r * 0.45);
            if (k > thr) { v = 0; if (k - thr < 0.07 && cur[i]) { v = 5; } }
          } else {
            v = 0;
            const k = (tt - 0.5) / 0.5, thr = h * 0.35 + r * 0.65;
            if (k * 1.08 > thr) { v = nxt[i]; if (k * 1.08 - thr < 0.07 && v) v = 5; }
          }
        }
        if (v === 0) D[i] = 0;
        else if (v === 3) {
          const w = Math.sin(t * 2.2 - rr[i] * 0.34);
          D[i] = w > 0.45 ? gL : w > -0.25 ? gM : gD;
        } else D[i] = lut[v];
      }
      B.flush();
    }
    const L = PX.loop(mc, frame, 15);
    const wrap = mc.closest('.mandala-wrap') || mc;
    const trigger = () => {
      if (nxt) return;
      seed = (seed * 31 + 17 + ((Math.random() * 9973) | 0)) >>> 0;
      nxt = gen(seed); tt = 0; count++;
      setCap();
      if (PX.reduced) { cur = nxt; nxt = null; tt = 1; L.render(); }
      else L.start();
    };
    wrap.addEventListener('click', trigger);
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger(); } });
    Scene.on(() => setTimeout(() => PX.reduced && L.render(), 30));
  }

  /* =========================================================
     2. THE PLATES  — small illuminated miniatures
     ========================================================= */
  function vgrad(B, y0, y1, c0, c1, lv) {
    const D = B.d, w = B.w;
    for (let y = y0; y < y1; y++) {
      const v = ((y - y0) / Math.max(1, y1 - y0 - 1)) * lv, b = Math.floor(v), f = v - b;
      const ca = packr(mix(c0, c1, Math.min(1, b / lv))), cb = packr(mix(c0, c1, Math.min(1, (b + 1) / lv)));
      for (let x = 0; x < w; x++) D[y * w + x] = f > BAY[((y & 3) << 2) | (x & 3)] ? cb : ca;
    }
  }
  function stars(B, n, t, ymax, seed) {
    const a = packr([255, 244, 214]), b = packr([150, 160, 210]);
    for (let i = 0; i < n; i++) {
      const x = hash(i, 1, seed) * B.w, y = hash(i, 2, seed) * ymax;
      B.px(x, y, Math.sin(t * 1.4 + i * 2.1) > -0.3 ? a : b);
    }
  }
  function curve(ax, ay, bx, by, sag, f) {
    const mx = (ax + bx) / 2, my = (ay + by) / 2 + sag, u = 1 - f;
    return [u * u * ax + 2 * u * f * mx + f * f * bx, u * u * ay + 2 * u * f * my + f * f * by];
  }
  const GLY = {
    '+': ['000', '010', '111', '010', '000'], '=': ['000', '111', '000', '111', '000'], x: ['000', '101', '010', '101', '000'], p: ['111', '101', '101', '101', '101'],
    N: ['101', '111', '111', '101', '101'], I: ['111', '010', '010', '010', '111'], K: ['101', '101', '110', '101', '101'],
  };
  function glyph(B, g, x, y, col) {
    GLY[g].forEach((r, j) => { for (let i = 0; i < 3; i++) if (r[i] === '1') B.px(x + i, y + j, col); });
  }

  const PLATES = {
    /* Lami: two lamps, one garland, a heart between them */
    lami(B, t) {
      vgrad(B, 0, 58, [38, 22, 72], [240, 138, 108], 9);
      B.rect(0, 58, 120, 22, packr([42, 16, 34]));
      B.rect(0, 58, 120, 1, packr([110, 52, 68]));
      stars(B, 22, t, 36, 3);
      const mx = 98, my = 14;
      B.disc(mx, my, 6, packr([255, 238, 205]));
      B.disc(mx + 3, my - 2, 5, packr([70, 40, 96]));
      for (let k = 0; k <= 34; k++) { const q = curve(4, 12, 116, 12, 26 + Math.sin(t * 0.8) * 1.2, k / 34); const m = (k % 3) === 0; if (m) { const c = [packr([255, 176, 40]), packr([255, 120, 30]), packr([240, 70, 50])][(k / 3) % 3 | 0]; B.rect(q[0] - 1, q[1], 2, 2, c); } else B.px(q[0], q[1], packr([90, 140, 70])); }
      [36, 84].forEach((x, i) => {
        const dir = i ? -1 : 1;
        B.rect(x - 8, 62, 17, 2, packr([205, 104, 58]));
        B.rect(x - 7, 64, 15, 3, packr([160, 70, 48]));
        B.rect(x - 4, 67, 9, 1, packr([110, 48, 40]));
        B.rect(x - 6, 62, 13, 1, packr([247, 196, 106]));
        B.glow(x, 55, 22, [255, 190, 90], 0.95);
        const sw = Math.sin(t * 5 + i * 2) * 0.7 + dir * 1.2;
        const w = [1, 2, 3, 3, 3, 2, 1];
        for (let j = 0; j < 7; j++) {
          const lean = Math.round(sw * ((6 - j) / 6));
          const ww = w[j];
          B.rect(x - (ww >> 1) + lean, 55 + j, ww, 1, j < 3 ? packr([255, 150, 40]) : packr([255, 200, 70]));
          if (j > 2 && j < 6) B.px(x + lean, 55 + j, packr([255, 250, 220]));
        }
        for (let k = 0; k < 5; k++) {
          const f = ((t * 0.5 + k / 5 + i * 0.3) % 1), px = x + Math.sin(f * 9 + k) * 2 + dir * f * 4, py = 52 - f * 26;
          if (PX.dither(px | 0, py | 0, 1 - f)) B.mixpx(px, py, 255, 220, 190, 0.5);
        }
      });
      const bob = Math.round(Math.sin(t * 1.6) * 2), beat = Math.sin(t * 5) > 0.6;
      const heart = ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'];
      B.glow(60, 42 + bob, 16, [255, 100, 120], 0.8);
      const hc = packr(beat ? [255, 120, 130] : [240, 70, 96]);
      heart.forEach((r, j) => { for (let i = 0; i < 7; i++) if (r[i] === 'x') B.px(57 + i, 39 + bob + j, hc); });
      B.px(58, 40 + bob, packr([255, 200, 205])); B.px(59, 40 + bob, packr([255, 200, 205]));
    },

    /* NEBians: an owl keeps the lamp company */
    nebians(B, t) {
      vgrad(B, 0, 62, [10, 16, 48], [40, 66, 126], 9);
      stars(B, 30, t, 40, 8);
      B.disc(100, 16, 7, packr([232, 238, 255])); B.disc(103, 14, 6, packr([16, 26, 66]));
      B.rect(0, 62, 120, 18, packr([48, 32, 30]));
      B.rect(0, 62, 120, 1, packr([96, 66, 50]));
      // lamp
      B.glow(24, 52, 34, [255, 200, 110], 0.9);
      B.line(14, 62, 18, 40, packr([36, 30, 40])); B.line(18, 40, 26, 36, packr([36, 30, 40]));
      for (let j = 0; j < 7; j++) B.rect(24 - j, 36 + j, 2 + j * 2 + 3, 1, j < 1 ? packr([255, 220, 150]) : packr([220, 130, 60]));
      B.rect(18, 62, 12, 2, packr([36, 30, 40]));
      B.rect(20, 44, 9, 1, packr([255, 232, 170]));
      // books
      const books = [[52, 44, 'teal', 38, 7], [54, 51, 'red', 34, 7], [50, 58, 'ind', 42, 4]];
      const bc = { teal: [[44, 140, 150], [28, 94, 110]], red: [[214, 82, 62], [150, 50, 44]], ind: [[84, 80, 170], [54, 50, 120]] };
      // draw bottom up so the top book is last
      [[48, 55, 'ind', 44, 7], [52, 48, 'red', 36, 7], [54, 41, 'teal', 32, 7]].forEach(([x, y, k, w, h]) => {
        B.rect(x, y, w, h, packr(bc[k][0]));
        B.rect(x, y + h - 2, w, 2, packr(bc[k][1]));
        B.rect(x + 2, y + 2, w - 4, 1, packr([250, 232, 190]));
        B.rect(x + w - 4, y, 2, h, packr([240, 196, 90]));
      });
      // owl
      const k = packr([27, 18, 38]), b = packr([140, 104, 72]), w = packr([244, 230, 200]), o = packr([236, 164, 58]), bl = (t % 4.2) < 0.16;
      const rows = ['..k......k..', '.kbk....kbk.', '.kbbbbbbbbk.', 'kbbwwbbwwbbk', 'kbwwwbbwwwbk', 'kbbwwbbwwbbk', '.kbbbooobbk.', '.kbbbbobbbk.', '.kbwwbbwwbk.', '.kbwwwwwwbk.', '..kbwwwwbk..', '..kbbbbbbk..', '...oo..oo...'];
      const ox = 60, oy = 28;
      const pal = { k, b, w, o };
      B.sprite(ox, oy, rows, pal);
      const look = Math.round(Math.sin(t * 0.7) * 1);
      if (bl) { B.rect(ox + 2, oy + 4, 3, 1, k); B.rect(ox + 7, oy + 4, 3, 1, k); B.rect(ox + 2, oy + 3, 3, 1, b); B.rect(ox + 7, oy + 3, 3, 1, b); }
      else { B.px(ox + 3 + look, oy + 4, k); B.px(ox + 8 + look, oy + 4, k); }
      for (let i = 0; i < 4; i++) {
        const f = (t * 0.22 + i / 4) % 1, g = ['+', '=', 'x', 'p'][i], gx = 78 + i * 7 + Math.sin(f * 7 + i) * 3, gy = 54 - f * 46;
        if (f < 0.9) glyph(B, g, gx | 0, gy | 0, packr(mix([255, 226, 150], [90, 110, 190], f)));
      }
    },

    /* Nik: tokens go in, a small mind turns, tokens come out */
    nik(B, t) {
      vgrad(B, 0, 80, [8, 12, 30], [28, 20, 66], 9);
      const nodes = [], cols = [[36, 4], [60, 5], [84, 4]];
      cols.forEach(([x, n], ci) => { for (let i = 0; i < n; i++) nodes.push({ x, y: 40 + (i - (n - 1) / 2) * 11, c: ci }); });
      const lc = packr([60, 64, 130]);
      let e = 0;
      for (const a of nodes) for (const b of nodes) {
        if (b.c !== a.c + 1) continue;
        B.line(a.x, a.y, b.x, b.y, lc);
        const f = (t * 0.6 + hash(e, 1, 5)) % 1;
        const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
        B.px(x, y, packr([255, 214, 120])); B.mixpx(x + 1, y, 255, 214, 120, 0.4); B.mixpx(x - 1, y, 255, 214, 120, 0.4);
        e++;
      }
      nodes.forEach((n, i) => {
        const p = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.3);
        B.glow(n.x, n.y, 8, [255, 200, 110], 0.5 * p);
        B.disc(n.x, n.y, 2, packr(mix([120, 126, 220], [255, 224, 150], p)));
      });
      // streams
      const rows = [24, 35, 46, 57];
      rows.forEach((y, r) => {
        let x = -((t * (6 + r * 2)) % 24);
        for (let i = 0; x < 26; i++) {
          const w = 3 + ((hash(i + r * 9, 1, 2) * 5) | 0);
          if (x + w > 0) B.rect(Math.max(0, x), y, Math.min(w, 26 - x) , 2, packr(mix([110, 116, 200], [190, 196, 250], hash(i, r, 4))));
          x += w + 2;
        }
        let x2 = 96 + 24 - ((t * (6 + r * 2)) % 24);
        x2 -= 24;
        for (let i = 0; x2 < 120; i++) {
          const w = 3 + ((hash(i + r * 9, 7, 2) * 5) | 0);
          if (x2 > 94) B.rect(x2, y, Math.min(w, 120 - x2), 2, packr(mix([255, 196, 90], [255, 236, 170], hash(i, r, 6))));
          x2 += w + 2;
        }
      });
      glyph(B, 'N', 6, 6, packr([255, 214, 120])); glyph(B, 'I', 10, 6, packr([255, 214, 120])); glyph(B, 'K', 14, 6, packr([255, 214, 120]));
      if (Math.sin(t * 4) > 0) B.rect(19, 6, 2, 5, packr([255, 214, 120]));
    },

    /* AstroWeb: a wheel of houses, planets walking it */
    astro(B, t) {
      vgrad(B, 0, 80, [6, 8, 26], [30, 18, 72], 9);
      stars(B, 36, t, 78, 12);
      const cx = 60, cy = 40, gold = packr([240, 190, 90]), lil = packr([140, 120, 220]), dim = packr([84, 78, 150]);
      const ring = (r, col, a0) => { for (let a = 0; a < 6.283; a += 0.5 / r) B.px(cx + Math.cos(a + (a0 || 0)) * r, cy + Math.sin(a + (a0 || 0)) * r, col); };
      ring(34, gold); ring(30, dim); ring(23, lil); ring(10, dim);
      const rot = t * 0.06;
      for (let i = 0; i < 72; i++) {
        const a = rot + (i * Math.PI * 2) / 72, long = i % 6 === 0, r0 = 30, r1 = long ? 34 : 32;
        for (let r = r0; r <= r1; r++) B.px(cx + Math.cos(a) * r, cy + Math.sin(a) * r, long ? gold : dim);
      }
      for (let i = 0; i < 12; i++) {
        const a = -rot * 1.5 + (i * Math.PI) / 6;
        B.line(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, cx + Math.cos(a) * 23, cy + Math.sin(a) * 23, dim);
        const a2 = rot + (i * Math.PI) / 6 + Math.PI / 12, gx = cx + Math.cos(a2) * 26.5, gy = cy + Math.sin(a2) * 26.5;
        B.rect(gx - 1, gy - 1, 2, 2, [gold, lil, packr([240, 120, 100]), packr([110, 200, 190])][i % 4]);
      }
      B.glow(cx, cy, 16, [255, 210, 120], 0.8);
      B.disc(cx, cy, 3, packr([255, 232, 160]));
      [[14, 0.9, [240, 120, 100]], [19, 0.6, [110, 200, 190]], [27.5, 0.35, [180, 150, 255]], [7, 1.4, [255, 255, 255]]].forEach(([r, s, c], i) => {
        const a = t * s + i * 1.9;
        B.glow(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 5, c, 0.7);
        B.disc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1, packr(c));
      });
    },

    /* Hanomi: a sakura village, kept cozy */
    hanomi(B, t) {
      vgrad(B, 0, 50, [158, 204, 234], [253, 226, 214], 9);
      // far hills
      for (let x = 0; x < 120; x++) {
        const h1 = 40 + Math.sin(x * 0.07) * 5 + noise1(x * 0.1, 3) * 6, h2 = 46 + Math.sin(x * 0.11 + 2) * 3 + noise1(x * 0.2, 5) * 3;
        B.rect(x, h1, 1, 12, packr([196, 180, 218]));
        B.rect(x, h2, 1, 10, packr([160, 200, 160]));
      }
      vgrad(B, 50, 80, [140, 196, 120], [86, 150, 94], 6);
      // pond
      const pcx = 82, pcy = 66;
      for (let y = -7; y <= 7; y++) for (let x = -26; x <= 26; x++) if ((x * x) / 676 + (y * y) / 49 < 1) B.px(pcx + x, pcy + y, (x + y + (t * 2 | 0)) % 9 === 0 ? packr([150, 214, 236]) : packr([104, 178, 214]));
      for (let k = 0; k < 2; k++) { const f = (t * 0.3 + k * 0.5) % 1, rx = f * 14, ry = f * 3.6; for (let a = 0; a < 6.283; a += 0.18) if (PX.dither(a * 10 | 0, k, 1 - f)) B.px(pcx - 6 + Math.cos(a) * rx, pcy + Math.sin(a) * ry, packr([210, 238, 250])); }
      [[0, 1], [3.1, -1]].forEach(([ph, d], i) => { const a = t * 0.5 * d + ph, kx = pcx + Math.cos(a) * 15, ky = pcy + Math.sin(a) * 3.6; B.rect(kx - 1, ky, 3, 1, packr([255, 150, 70])); B.px(kx + (d > 0 ? -2 : 2) * (Math.sin(a) > 0 ? -1 : 1), ky, packr([255, 244, 230])); });
      // hut
      const hx = 100, hy = 56;
      B.rect(hx, hy - 9, 14, 9, packr([250, 236, 208])); B.rect(hx + 10, hy - 9, 4, 9, packr([226, 204, 174]));
      for (let j = 0; j < 7; j++) B.rect(hx - 3 + j, hy - 16 + j, 20 - j * 2, 1, j > 4 ? packr([142, 52, 54]) : packr([176, 70, 64]));
      B.rect(hx + 5, hy - 5, 4, 5, packr([116, 70, 56])); B.rect(hx + 1, hy - 7, 3, 3, packr([255, 224, 150]));
      for (let i = 0; i < 6; i++) B.rect(hx - 6 + i * 2, hy + 1, 1, 3, packr([150, 100, 70]));
      // sakura
      const tx = 30;
      B.rect(tx - 2, 52, 4, 20, packr([96, 62, 52])); B.rect(tx + 1, 52, 1, 20, packr([70, 44, 40]));
      B.line(tx, 54, tx - 12, 42, packr([96, 62, 52])); B.line(tx, 52, tx + 12, 40, packr([96, 62, 52]));
      const blobs = [[0, 30, 16], [-13, 38, 11], [13, 34, 12], [-5, 22, 11], [8, 24, 10]];
      const inB = (b, x, y) => (x - tx - b[0]) ** 2 + (y - b[1]) ** 2 < b[2] * b[2];
      for (let y = 8; y < 56; y++) for (let x = tx - 28; x < tx + 28; x++) {
        let ins = false, hi = false, lo = false;
        for (const b of blobs) { if (inB(b, x, y)) ins = true; if (inB(b, x + 3, y + 3)) hi = true; if (inB(b, x - 3, y - 3)) lo = true; }
        if (!ins) continue;
        const n = hash(x, y, 21);
        B.px(x, y, !hi ? (n < 0.5 ? packr([255, 222, 232]) : packr([255, 200, 220])) : !lo ? (n < 0.4 ? packr([226, 128, 168]) : packr([236, 150, 184])) : n < 0.18 ? packr([255, 214, 228]) : n < 0.8 ? packr([248, 182, 206]) : packr([238, 150, 186]));
      }
      for (let i = 0; i < 18; i++) {
        const f = (t * 0.1 + hash(i, 1, 6)) % 1, x = tx - 20 + hash(i, 2, 6) * 70 + Math.sin(f * 12 + i) * 5 + f * 14, y = 28 + f * 46;
        if (y < 76) B.px(x, y, i % 3 ? packr([255, 190, 214]) : packr([255, 236, 244]));
      }
    },
  };

  const plates = [...document.querySelectorAll('canvas[data-plate]')];
  plates.forEach((cv) => {
    const fn = PLATES[cv.dataset.plate];
    if (!fn) return;
    const B = new Buf(cv, 120, 80);
    PX.loop(cv, (t) => { B.clear(); fn(B, t); B.flush(); }, 12);
  });

  /* =========================================================
     3. THE LAKE  — click the water to light a butter lamp
     ========================================================= */
  const lk = document.getElementById('lakeCanvas');
  if (lk) {
    const SC = 3, HOR = 44, LH = 92;
    let B, W, D, ridges, lamps = [], ripples = [], count = 0;
    const out = document.getElementById('lampCount');
    const wrap = lk.parentElement;
    const mk = () => {
      W = Math.ceil(wrap.clientWidth / SC) + 1;
      B = new Buf(lk, W, LH);
      D = B.d;
      lk.style.width = W * SC + 'px';
      lk.style.height = LH * SC + 'px';
      ridges = [0, 1, 2].map((l) => { const a = new Int16Array(W); for (let x = 0; x < W; x++) a[x] = Math.round(HOR - 4 - [16, 9, 4][l] * (0.3 + noise1(x * [0.045, 0.07, 0.11][l], 70 + l * 9)) - (l === 0 ? 10 * Math.exp(-Math.pow((x - W * 0.7) / 18, 2)) : 0)); return a; });
      if (!lamps.length) for (let i = 0; i < 3; i++) lamps.push({ x: W * (0.25 + i * 0.22), y: HOR + 14 + i * 7, vx: 0.4 + i * 0.1, ph: i * 2, born: -99 });
    };
    mk();
    const WATER_T = [14, 24, 52], WATER_B = [8, 14, 32];
    function frame(t, dt) {
      dt = dt || 0.05;
      const p = Scene.pal(Scene.c);
      const c = Scene.c;
      /* upper world */
      const wt = mix(p.skyMid, [20, 30, 70], 0.5);
      for (let y = 0; y < HOR; y++) {
        const v = (y / HOR) * 9, b = Math.floor(v), f = v - b;
        const g = (k) => { const q = Math.min(1, k / 9); return packr(q < 0.55 ? mix(p.skyTop, p.skyMid, q / 0.55) : mix(p.skyMid, p.skyHor, (q - 0.55) / 0.45)); };
        const ca = g(b), cb = g(b + 1);
        for (let x = 0; x < W; x++) D[y * W + x] = f > BAY[((y & 3) << 2) | (x & 3)] ? cb : ca;
      }
      const dk = p.dark;
      if (p.star > 0.02) { const sc = packr([255, 244, 214]); for (let i = 0; i < 90; i++) { if (hash(i, 3, 9) > p.star) continue; const x = hash(i, 1, 9) * W, y = hash(i, 2, 9) * (HOR - 14); if (Math.sin(t * 1.6 + i) > -0.4) B.px(x, y, sc); } }
      const sa = Scene.sunA(c), ma = Scene.moonA(c);
      let sunx = -99, moonx = -99, sunY = 0, moonY = 0;
      const arcY = (a, h) => HOR - 6 - Math.sin(Math.PI * clamp(a, 0, 1)) * h;
      if (ma > -0.1 && ma < 1.1) { moonx = lerp(W * 0.1, W * 0.9, ma); moonY = arcY(ma, 34); B.glow(moonx, moonY, 18, [175, 195, 255], 0.5); B.disc(moonx, moonY, 5, packr([236, 240, 255])); B.disc(moonx + 2, moonY - 1, 4, packr(mix(p.skyMid, p.skyTop, 0.5))); }
      if (sa > -0.1 && sa < 1.1) { sunx = lerp(W * 0.1, W * 0.9, sa); sunY = arcY(sa, 36); B.glow(sunx, sunY, 28, mix(p.snowLit, [255, 200, 120], 0.5), 0.9); B.disc(sunx, sunY, 5, packr([255, 248, 224])); }
      const rc = [p.far, p.mid, p.near];
      ridges.forEach((rg, l) => {
        const col = packr(rc[l]), lit = packr(mix(rc[l], p.snowLit, 0.18)), mist = packr(p.mist);
        for (let x = 0; x < W; x++) for (let y = rg[x]; y < HOR; y++) { let cc = y === rg[x] ? lit : col; if (y > HOR - 9 && (y - HOR + 9) / 9 > BAY[((y & 3) << 2) | (x & 3)] * 1.2) cc = mist; D[y * W + x] = cc; }
      });
      /* chorten on the shore */
      const sx = Math.round(W * 0.2), gy = HOR;
      const stc = packr(mix(p.snowLit, p.fore, 0.15 + dk * 0.4)), gd = packr(p.gold);
      B.rect(sx - 8, gy - 3, 17, 3, stc); B.rect(sx - 6, gy - 5, 13, 2, stc);
      for (let y = -6; y <= 0; y++) for (let x = -6; x <= 6; x++) if ((x * x) / 36 + (y * y) / 42 < 1) B.px(sx + x, gy - 5 + y, stc);
      B.rect(sx - 2, gy - 15, 5, 4, gd); B.rect(sx - 1, gy - 19, 3, 4, gd); B.px(sx, gy - 21, gd);
      B.rect(sx - 2, gy - 14, 1, 1, packr(p.fore)); B.rect(sx + 1, gy - 14, 1, 1, packr(p.fore));
      /* reflection */
      const tint = mix(p.skyMid, [10, 20, 50], 0.45);
      for (let y = HOR; y < LH; y++) {
        const dy = y - HOR, sy = Math.max(0, HOR - 1 - dy * 0.92);
        const amp = 0.6 + dy * 0.05, f = Math.min(0.85, 0.3 + dy * 0.012);
        for (let x = 0; x < W; x++) {
          const shift = Math.round(Math.sin(dy * 0.9 + t * 1.4 + x * 0.05) * amp + (hash(x, dy, (t * 2) | 0) > 0.985 ? 1 : 0));
          const s = D[(sy | 0) * W + clamp(x + shift, 0, W - 1)];
          const r = s & 255, g = (s >> 8) & 255, b = (s >> 16) & 255;
          D[y * W + x] = (255 << 24) | (((b + (tint[2] - b) * f) & 255) << 16) | (((g + (tint[1] - g) * f) & 255) << 8) | ((r + (tint[0] - r) * f) & 255);
        }
      }
      /* shimmer under sun and moon */
      [[sunx, 1, [255, 235, 190]], [moonx, 0.7, [200, 215, 255]]].forEach(([mx, k, col]) => {
        if (mx < -50) return;
        for (let y = HOR + 1; y < LH; y += 1) {
          const dy = y - HOR, w2 = 2 + dy * 0.12;
          for (let x = mx - w2; x <= mx + w2; x++) if (Math.sin(dy * 2.3 + t * 3 + x * 1.7) > 0.55 + dy * 0.004) B.mixpx(x, y, col[0], col[1], col[2], 0.65 * k);
        }
      });
      /* ripples */
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]; r.t += dt;
        const f = r.t / 2.2; if (f >= 1) { ripples.splice(i, 1); continue; }
        const rx = 3 + f * 26, ry = rx * 0.28;
        for (let a = 0; a < 6.283; a += 0.9 / rx) if (PX.dither(a * 16 | 0, (r.x | 0), (1 - f) * 0.9)) B.mixpx(r.x + Math.cos(a) * rx, r.y + Math.sin(a) * ry, 255, 240, 210, 0.6);
      }
      /* lamps */
      for (let i = lamps.length - 1; i >= 0; i--) {
        const l = lamps[i];
        l.x += l.vx * dt * 3; l.y += Math.sin(t * 0.4 + l.ph) * dt * 0.8;
        l.y = clamp(l.y, HOR + 5, LH - 8);
        l.age = (l.age || 0) + dt;
        if (l.x > W + 12 || l.age > 140) { lamps.splice(i, 1); continue; }
        const bob = Math.round(Math.sin(t * 1.5 + l.ph) * 0.6), x = Math.round(l.x), y = Math.round(l.y) + bob;
        const glowK = 0.5 + dk * 0.5;
        B.glow(x, y - 3, 16, [255, 190, 90], 0.8 * glowK);
        B.rect(x - 3, y, 7, 1, packr([212, 108, 58])); B.rect(x - 2, y + 1, 5, 1, packr([150, 66, 46]));
        B.rect(x - 2, y - 1, 5, 1, packr([247, 196, 106]));
        const fl = Math.sin(t * 6 + l.ph * 3) * 0.7;
        B.px(x + Math.round(fl * 0.6), y - 3, packr([255, 150, 40])); B.px(x, y - 2, packr([255, 210, 80]));
        B.px(x + Math.round(fl), y - 4, packr([255, 190, 60]));
        // reflection of the flame
        B.mixpx(x, y + 3, 255, 200, 100, 0.55); B.mixpx(x + Math.round(Math.sin(t * 3 + l.ph)), y + 5, 255, 200, 100, 0.35);
      }
      /* lotus & pads in front */
      const pad = packr([40, 110, 80]), padL = packr([70, 150, 100]), pk = packr([244, 150, 190]), pkL = packr([255, 214, 232]);
      [[0.06, 80], [0.4, 86], [0.93, 82], [0.82, 88]].forEach(([fx, y], i) => {
        const x = Math.round(W * fx), sway = Math.round(Math.sin(t * 0.6 + i) * 0.6);
        for (let a = -7; a <= 7; a++) { const h = Math.round(Math.sqrt(Math.max(0, 1 - (a * a) / 49)) * 3); B.rect(x + a, y - h + 2, 1, h * 2 - 2, a < 0 ? padL : pad); }
        if (i % 2 === 0) {
          B.rect(x + sway, y - 6, 1, 6, pad);
          B.rect(x - 3 + sway, y - 8, 7, 3, pk); B.rect(x - 2 + sway, y - 10, 5, 2, pk); B.rect(x - 1 + sway, y - 12, 3, 2, pkL); B.px(x + sway, y - 9, packr([250, 210, 90]));
        }
      });
      B.flush();
    }
    const L = PX.loop(lk, frame, 24);
    lk.addEventListener('pointerdown', (e) => {
      const r = lk.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * LH;
      const yy = Math.max(y, HOR + 6);
      lamps.push({ x, y: Math.min(yy, LH - 10), vx: 0.35 + Math.random() * 0.35, ph: Math.random() * 6, age: 0 });
      ripples.push({ x, y: Math.min(yy, LH - 10), t: 0 });
      if (lamps.length > 28) lamps.shift();
      count++;
      if (out) out.textContent = String(count);
      if (PX.reduced) L.render();
    });
    let rt;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { mk(); L.render(); }, 150); });
    Scene.on(() => PX.reduced && setTimeout(L.render, 30));
  }
})();
