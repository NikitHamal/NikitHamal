/* scene.js — the arched window: a procedurally painted Himalayan day, in 144x192 pixels.
   Time of day (dawn, day, dusk, night) is a single float `c` that flows forward through the cycle. */
(function () {
  'use strict';
  const { Buf, hex, mix, packr, pack, clamp, lerp, smooth, BAY, hash, noise1, noise2 } = PX;
  const W = 144, H = 192, PAD = 26, LV = 11, SKYH = 146;
  const NAMES = ['dawn', 'day', 'dusk', 'night'];

  /* ---------- palettes: one entry per phase [dawn, day, dusk, night] ---------- */
  const KF = {
    skyTop: ['#4a4f93', '#5d9ad2', '#2f2560', '#070a1c'],
    skyMid: ['#cf8aa6', '#9fcbe6', '#b04a70', '#141a42'],
    skyHor: ['#f8b985', '#e6f2e8', '#f78f4f', '#2b3169'],
    far: ['#9a90bd', '#a3bad6', '#86629b', '#2c3269'],
    mid: ['#766fa3', '#7893b8', '#624583', '#202654'],
    near: ['#4f4e80', '#58759e', '#43305f', '#151a3b'],
    hill: ['#34405a', '#44625e', '#2d2447', '#0d1131'],
    fore: ['#1c1b33', '#212e36', '#171229', '#070a1b'],
    snowLit: ['#ffe9d8', '#ffffff', '#ffd4b2', '#b3bdf0'],
    snowSh: ['#bba6cd', '#c5d6ea', '#a27eaa', '#5b659c'],
    mist: ['#f5c6b3', '#ffffff', '#f2aa93', '#3b4382'],
    cloud: ['#ffd8c4', '#ffffff', '#ffbb94', '#3a417c'],
    gold: ['#e9b34b', '#f2c352', '#f1a63e', '#b8923f'],
    robe: ['#d8562c', '#d34a26', '#e0602f', '#9b3a2a'],
  };
  const SC = {
    dark: [0.3, 0, 0.58, 1],
    star: [0.5, 0, 0.32, 1],
  };
  const RGB = {};
  for (const k in KF) RGB[k] = KF[k].map(hex);

  function pal(c) {
    c = ((c % 4) + 4) % 4;
    const i = Math.floor(c), j = (i + 1) % 4, f = smooth(c - i);
    const o = {};
    for (const k in RGB) o[k] = mix(RGB[k][i], RGB[k][j], f);
    for (const k in SC) o[k] = lerp(SC[k][i], SC[k][j], f);
    return o;
  }
  const sunA = (c) => (c >= 3.4 ? (c - 4 + 0.35) / 3 : (c + 0.35) / 3);
  const moonA = (c) => ((c >= 2 ? c : c + 4) - 2.2) / 1.8;

  /* ---------- shared state, also used by the footer lake ---------- */
  const root = document.documentElement;
  const hour = new Date().getHours() + new Date().getMinutes() / 60;
  const autoPhase = hour >= 5 && hour < 8 ? 0 : hour >= 8 && hour < 17 ? 1 : hour >= 17 && hour < 19.5 ? 2 : 3;
  let saved = null;
  try { saved = localStorage.getItem('nh-phase'); } catch (e) {}
  const startIdx = NAMES.indexOf(saved) >= 0 ? NAMES.indexOf(saved) : autoPhase;
  const S = (window.Scene = {
    names: NAMES,
    c: startIdx,
    target: startIdx,
    idx: startIdx,
    pal,
    sunA,
    moonA,
    cbs: [],
    on(fn) { S.cbs.push(fn); fn(S.idx, true); },
    set(name, persist) {
      const i = typeof name === 'number' ? name : NAMES.indexOf(name);
      if (i < 0) return;
      S.idx = i;
      S.target = i;
      root.dataset.phase = NAMES[i];
      if (persist) { try { localStorage.setItem('nh-phase', NAMES[i]); } catch (e) {} }
      if (PX.reduced) { S.c = i; }
      S.cbs.forEach((f) => f(i, false));
    },
    step(dt) {
      if (S.c === S.target) return false;
      const rem = (S.target - S.c + 4) % 4;
      const sp = Math.min(1.5, 0.35 + rem * 1.2);
      const d = sp * dt;
      if (d >= rem) { S.c = S.target; } else { S.c = (S.c + d) % 4; }
      return true;
    },
  });
  root.dataset.phase = NAMES[startIdx];

  /* ---------- terrain ---------- */
  const N = W + PAD * 2;
  function ridge(seed, base, amp, f, sharp, bumps) {
    const a = new Int16Array(N);
    for (let x = 0; x < N; x++) {
      const r1 = 1 - Math.abs(2 * noise1(x * f, seed) - 1);
      const r2 = 1 - Math.abs(2 * noise1(x * f * 2.3, seed + 7) - 1);
      const r3 = 1 - Math.abs(2 * noise1(x * f * 5.1, seed + 13) - 1);
      let v = Math.pow(r1 * 0.62 + r2 * 0.28 + r3 * 0.1, sharp);
      let y = base - amp * v;
      for (const b of bumps || []) y -= b[1] * Math.exp(-Math.pow((x - PAD - b[0]) / b[2], 2));
      a[x] = Math.round(y);
    }
    return a;
  }
  const LAY = [
    { key: 'far', top: ridge(3, 112, 62, 0.03, 1.5, [[108, 30, 17], [26, 14, 12]]), base: 112, snow: 1, fade: 0.8, k: 2 },
    { key: 'mid', top: ridge(11, 126, 40, 0.045, 1.4, [[56, 10, 14]]), base: 126, snow: 0.55, fade: 0.7, k: 4 },
    { key: 'near', top: ridge(29, 139, 26, 0.06, 1.3, [[122, 8, 12]]), base: 139, snow: 0, fade: 0.5, k: 7 },
  ];
  LAY.forEach((L, li) => {
    L.sn = new Int8Array(N);
    for (let x = 0; x < N; x++) {
      const h = L.base - L.top[x];
      L.sn[x] = L.snow ? clamp(Math.round((h - 20) * 0.5 * L.snow + noise1(x * 0.35, li * 5) * 5 - 2), 0, 22) : 0;
    }
    L.cr = new Uint8Array(N * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < N; x++) L.cr[y * N + x] = noise2(x * 0.55 + y * 0.22, y * 0.42, 40 + li) > 0.68 ? 1 : 0;
  });

  const HILL_X = 76, GY = 146;
  const hillTop = new Int16Array(N);
  for (let x = 0; x < N; x++) {
    const dist = Math.abs(x - PAD - HILL_X);
    hillTop[x] = dist < 28 ? GY : Math.round(GY + (dist - 28) * 0.34 + noise1(x * 0.2, 5) * 2);
  }
  const cliffTop = new Int16Array(N);
  for (let x = 0; x < N; x++) {
    const xc = x - PAD;
    let y = xc < 34 ? 163 + noise1(xc * 0.3, 2) * 2 : 163 + (xc - 34) * 0.62;
    if (xc > 68) y = Math.max(y, 0) > 184 ? 184 + noise1(xc * 0.3, 9) * 1.5 : y;
    if (xc > 112) y = 184 - (xc - 112) * 0.6;
    cliffTop[x] = Math.round(Math.min(y, 186));
  }
  const grass = new Uint8Array(N * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < N; x++) grass[y * N + x] = hash(x, y, 77) < 0.1 ? 1 : 0;

  /* ---------- little worlds that move ---------- */
  const stars = [];
  for (let i = 0; i < 70; i++) stars.push({ x: Math.floor(hash(i, 1, 9) * W), y: Math.floor(hash(i, 2, 9) * 100), th: hash(i, 3, 9), ph: hash(i, 4, 9) * 6.28, big: hash(i, 5, 9) > 0.9 });
  const clouds = [
    { x: 22, y: 34, v: 1.4, b: [[0, 0, 13, 4], [-9, 2, 8, 3], [10, 2, 9, 3]] },
    { x: 104, y: 60, v: 0.8, b: [[0, 0, 10, 3], [-7, 1, 6, 2], [7, 1, 7, 2]] },
    { x: 66, y: 18, v: 1.0, b: [[0, 0, 9, 3], [8, 1, 6, 2]] },
  ];
  const birds = [{ x: 30, y: 52, v: 5, ph: 0 }, { x: 44, y: 58, v: 5, ph: 1.3 }, { x: 12, y: 62, v: 5, ph: 2.1 }];
  const flies = [];
  for (let i = 0; i < 9; i++) flies.push({ x: 40 + hash(i, 1, 4) * 70, y: 120 + hash(i, 2, 4) * 50, a: 0.4 + hash(i, 3, 4), ph: hash(i, 4, 4) * 6.28 });
  const houses = [{ x: 106, w: 9 }, { x: 119, w: 8 }, { x: 129, w: 7 }];
  const FLAG = ['#2f6fe0', '#f2f2ec', '#d83b2e', '#31a35c', '#f3c333'].map(hex);

  /* ---------- the canvas ---------- */
  const cv = document.getElementById('sceneCanvas');
  if (!cv) return;
  const B = new Buf(cv, W, H);
  const D = B.d;
  const hero = document.getElementById('hero') || cv;

  let tx = 0, ty = 0, px = 0, born = performance.now();
  hero.addEventListener('pointermove', (e) => { tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });
  hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; });
  let py = 0;

  const bandCols = new Uint32Array(LV + 2);
  const rowBand = new Uint8Array(H), rowFrac = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    const v = clamp(y / SKYH, 0, 1) * LV;
    rowBand[y] = Math.min(LV, Math.floor(v));
    rowFrac[y] = v - Math.floor(v);
  }

  function skyAt(p, t) {
    return t < 0.55 ? mix(p.skyTop, p.skyMid, t / 0.55) : mix(p.skyMid, p.skyHor, (t - 0.55) / 0.45);
  }

  function inBlob(bl, x, y) {
    const dx = (x - bl[0]) / bl[2], dy = (y - bl[1]) / bl[3];
    return dx * dx + dy * dy < 1;
  }

  function draw(t, dt) {
    const moving = S.step(dt || 0);
    const c = S.c;
    const p = pal(c);
    px += (tx - px) * 0.06;
    py += (ty - py) * 0.06;
    const drift = Math.sin(t * 0.15) * 0.35;
    const par = px + drift;

    /* sky, dithered in 11 bands */
    for (let k = 0; k <= LV + 1; k++) bandCols[k] = packr(skyAt(p, Math.min(1, k / LV)));
    for (let y = 0; y < H; y++) {
      const b = rowBand[y], f = rowFrac[y], row = y * W, yy = (y & 3) << 2;
      for (let x = 0; x < W; x++) D[row + x] = bandCols[b + (f > BAY[yy | (x & 3)] ? 1 : 0)];
    }

    /* stars */
    const sv = p.star;
    if (sv > 0.02) {
      const sc = packr(mix(p.snowLit, [255, 255, 255], 0.5)), dim = packr(mix(p.skyMid, p.snowLit, 0.5));
      for (const s of stars) {
        if (s.th > sv) continue;
        const tw = Math.sin(t * 1.6 + s.ph);
        B.px(s.x - par * 1.2, s.y + py * 0.6, tw > -0.5 ? sc : dim);
        if (s.big && tw > 0.2) { B.px(s.x - par * 1.2 - 1, s.y + py * 0.6, dim); B.px(s.x - par * 1.2 + 1, s.y + py * 0.6, dim); B.px(s.x - par * 1.2, s.y - 1, dim); B.px(s.x - par * 1.2, s.y + 1, dim); }
      }
    }

    /* moon */
    const ma = moonA(c), sa = sunA(c);
    let lightDir = -1;
    if (ma > -0.1 && ma < 1.1) {
      const mx = lerp(18, 126, ma) - par * 1.5, my = 122 - Math.sin(Math.PI * clamp(ma, 0, 1)) * 82;
      B.glow(mx, my, 20, [175, 195, 255], 0.55 * (0.4 + p.dark * 0.6));
      const mc = packr([236, 240, 255]), sh = packr([200, 210, 245]);
      for (let j = -6; j <= 6; j++)
        for (let i = -6; i <= 6; i++) {
          if (i * i + j * j > 28) continue;
          if ((i - 2.2) * (i - 2.2) + (j + 1.4) * (j + 1.4) < 22) continue;
          B.px(mx + i, my + j, (i + j) % 5 === 0 && i < -2 ? sh : mc);
        }
      lightDir = mx < W / 2 ? -1 : 1;
    }
    /* sun */
    if (sa > -0.1 && sa < 1.1) {
      const sx = lerp(14, 130, sa) - par * 1.5, sy = 124 - Math.sin(Math.PI * clamp(sa, 0, 1)) * 86;
      B.glow(sx, sy, 28, mix(p.snowLit, [255, 200, 120], 0.5), 0.9);
      const sc = packr(mix([255, 250, 225], p.snowLit, 0.35));
      B.disc(sx, sy, 6, sc);
      lightDir = sx < W / 2 ? -1 : 1;
    }

    /* clouds */
    const cl = packr(p.cloud), cs = packr(mix(p.cloud, p.skyMid, 0.55)), ch = packr(mix(p.cloud, [255, 255, 255], 0.45));
    for (const k of clouds) {
      k.x += k.v * (dt || 0);
      if (k.x > W + 40) k.x = -40;
      const ox = Math.round(k.x - par * 3), oy = k.y;
      for (let y = -8; y <= 9; y++)
        for (let x = -26; x <= 26; x++) {
          let ins = false, up = false, dn = false;
          for (const b of k.b) {
            if (inBlob(b, x, y)) ins = true;
            if (inBlob(b, x, y - 2)) up = true;
            if (inBlob(b, x, y + 2)) dn = true;
          }
          if (!ins) continue;
          B.px(ox + x, oy + y, !up ? ch : !dn ? cs : cl);
        }
    }

    /* mountains */
    const sunTint = p.snowLit;
    for (let li = 0; li < LAY.length; li++) {
      const L = LAY[li];
      const off = Math.round(par * L.k + (li === 0 ? 0 : 0));
      const base = p[L.key];
      const litC = packr(mix(base, sunTint, 0.2)), shC = packr(shade2(base, 0.76)), crC = packr(shade2(base, 0.64));
      const snL = packr(p.snowLit), snS = packr(p.snowSh), snC = packr(mix(p.snowSh, base, 0.35));
      const mist = packr(mix(p.mist, base, 0.5));
      const fs = L.base - 14, fl = 34;
      for (let x = 0; x < W; x++) {
        const i = x + PAD - off;
        if (i < 3 || i >= N - 3) continue;
        const top = L.top[i];
        const slope = L.top[i + 3] - L.top[i - 3];
        const lit = slope === 0 ? (x & 1) === 0 : (slope > 0 ? 1 : -1) === lightDir;
        const snowY = top + L.sn[i];
        const yEnd = Math.min(H, L.base + 40);
        for (let y = Math.max(0, top); y < yEnd; y++) {
          let col;
          if (y < snowY && y < top + 22) col = L.cr[y * N + i] ? snC : lit ? snL : snS;
          else col = L.cr[y * N + i] ? crC : lit ? litC : shC;
          if (y === top) col = lit ? (L.snow ? snL : litC) : col;
          const g = ((y - fs) / fl) * L.fade;
          if (g > 0) col = PX.bl(col, mist, g > 1 ? 1 : Math.round(g * 8) / 8);
          D[y * W + x] = col;
        }
      }
      if (li === 0) birdsDraw(t, dt || 0, p, par);
    }

    /* the hill with the stupa */
    const hoff = Math.round(par * 9);
    const hc = packr(p.hill), hl = packr(mix(p.hill, p.snowLit, 0.14)), hs = packr(shade2(p.hill, 0.82)), hr = packr(mix(p.hill, p.skyHor, 0.35));
    for (let x = 0; x < W; x++) {
      const i = x + PAD - hoff;
      if (i < 0 || i >= N) continue;
      const top = hillTop[i];
      for (let y = top; y < H; y++) D[y * W + x] = y === top ? hr : grass[y * N + i] ? hl : y > top + 6 && (y + x) % 7 === 0 ? hs : hc;
    }
    const ox = hoff; // objects that sit on the hill travel with it
    houseDraw(p, t, ox);
    stupaDraw(p, t, ox, lightDir);

    /* foreground cliff, figure, pines */
    const foff = Math.round(par * 14);
    const fc = packr(p.fore), fgl = packr(mix(p.fore, p.snowLit, 0.12)), frim = packr(mix(p.fore, p.skyHor, 0.4));
    for (let x = 0; x < W; x++) {
      const i = x + PAD - foff;
      if (i < 0 || i >= N) continue;
      const top = cliffTop[i];
      for (let y = top; y < H; y++) D[y * W + x] = y === top ? frim : grass[y * N + i] && y < top + 14 ? fgl : fc;
    }
    figureDraw(p, t, foff);
    pineDraw(p, t, foff);

    /* fireflies */
    if (p.dark > 0.3) {
      const a = (p.dark - 0.3) / 0.7;
      const fcol = packr(mix(p.gold, [255, 240, 170], 0.5));
      for (const f of flies) {
        const fx = f.x + Math.sin(t * f.a + f.ph) * 7 + foff * 0.8, fy = f.y + Math.cos(t * f.a * 0.8 + f.ph) * 5;
        const bl = Math.sin(t * 2.2 + f.ph * 3);
        if (bl > -0.4 && f.ph / 6.28 < a + 0.2) { B.px(fx, fy, fcol); B.glow(fx, fy, 4, p.gold, 0.7); }
      }
    }

    /* the arrival: a dither that lifts the curtain */
    const age = (performance.now() - born) / 1000 - 0.15;
    if (age < 2.6) {
      const r = clamp(age / 2.2, 0, 1.05);
      for (let y = 0; y < H; y++) {
        const yy = (y & 3) << 2, base = 1 - y / H;
        for (let x = 0; x < W; x++) {
          const thr = BAY[yy | (x & 3)] * 0.45 + base * 0.55;
          if (smooth(Math.min(1, r)) * 1.05 < thr) D[y * W + x] = 0;
        }
      }
    }
    B.flush();
    if (PX.reduced && !moving) return;
  }

  function shade2(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }

  function birdsDraw(t, dt, p, par) {
    if (p.dark > 0.92) return;
    const col = packr(mix(p.fore, p.mid, 0.3));
    for (const b of birds) {
      b.x += b.v * dt;
      if (b.x > W + 10) b.x = -10;
      const y = b.y + Math.sin(t * 0.8 + b.ph) * 3 - 0;
      const up = Math.sin(t * 7 + b.ph) > 0;
      const x = b.x - par * 3;
      if (up) { B.px(x - 2, y - 1, col); B.px(x - 1, y, col); B.px(x, y, col); B.px(x + 1, y, col); B.px(x + 2, y - 1, col); }
      else { B.px(x - 2, y + 1, col); B.px(x - 1, y, col); B.px(x, y, col); B.px(x + 1, y, col); B.px(x + 2, y + 1, col); }
    }
  }

  function houseDraw(p, t, ox) {
    const wall = packr(mix(p.snowSh, p.hill, 0.45)), wallL = packr(mix(p.snowLit, p.hill, 0.45)), roof = packr(mix(hex('#b5472f'), p.fore, p.dark * 0.6));
    const win = p.dark > 0.3 ? packr(mix(p.gold, [255, 235, 160], 0.3)) : packr(shade2(p.fore, 0.9));
    for (const h of houses) {
      const x = Math.round(h.x + ox), gy = hillTop[clamp(h.x + PAD, 0, N - 1)] || GY;
      const y = gy;
      B.rect(x, y - 6, h.w, 6, wall);
      B.rect(x, y - 6, 2, 6, wallL);
      B.rect(x - 1, y - 8, h.w + 2, 2, roof);
      B.rect(x + 1, y - 9, h.w - 2, 1, roof);
      B.rect(x + (h.w >> 1), y - 4, 2, 2, win);
      if (p.dark > 0.3) B.glow(x + (h.w >> 1) + 1, y - 3, 6, p.gold, 0.7 * p.dark);
    }
  }

  function stupaDraw(p, t, ox, ld) {
    const cx = Math.round(HILL_X + ox), gy = GY;
    const lit = packr(mix(p.snowLit, [255, 250, 240], 0.3)), sh = packr(p.snowSh), mids = packr(mix(p.snowLit, p.snowSh, 0.5));
    const gold = packr(p.gold), goldSh = packr(shade2(p.gold, 0.7)), goldL = packr(mix(p.gold, [255, 245, 200], 0.4));
    const dk = packr(shade2(p.fore, 1)), verm = packr(hex('#d23a2a'));
    /* flags first (behind) */
    flagsDraw(p, t, cx, gy - 47);
    /* plinth */
    const tiers = [[54, 0], [48, 3], [42, 6]];
    for (const [w, d] of tiers) {
      const y = gy - d - 3;
      B.rect(cx - (w >> 1), y, w, 3, lit);
      const sw = Math.round(w * 0.38);
      if (ld < 0) B.rect(cx + (w >> 1) - sw, y, sw, 3, sh); else B.rect(cx - (w >> 1), y, sw, 3, sh);
      B.rect(cx - (w >> 1), y + 2, w, 1, mids);
    }
    /* butter lamps */
    if (p.dark > 0.25) {
      for (let k = -3; k <= 3; k++) {
        const lx = cx + k * 7, ly = gy - 10, fl = Math.sin(t * 7 + k * 2) > -0.2;
        if (fl) { B.px(lx, ly, packr([255, 220, 130])); B.px(lx, ly - 1, packr([255, 170, 70])); }
        B.glow(lx, ly, 5, p.gold, 0.8 * p.dark);
      }
    }
    /* dome */
    const rx = 17, ry = 14, dcy = gy - 9;
    for (let y = -ry; y <= 0; y++)
      for (let x = -rx; x <= rx; x++) {
        const e = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        if (e > 1) continue;
        let s = clamp(0.5 + 0.55 * (x / rx) * -ld + (y / ry) * 0.1 + (e > 0.8 ? 0.12 : 0), 0, 1);
        const col = s > BAY[(((dcy + y) & 3) << 2) | ((cx + x) & 3)] ? (s > 0.78 ? sh : mids) : lit;
        B.px(cx + x, dcy + y, col);
      }
    B.rect(cx - 17, gy - 10, 35, 1, gold);
    /* harmika with the eyes that see everything */
    const hy = gy - 33;
    B.rect(cx - 6, hy, 13, 9, gold);
    B.rect(cx - 6, hy, 13, 1, goldL);
    B.rect(cx + (ld < 0 ? 3 : -6), hy + 1, 4, 8, goldSh);
    const blink = t % 6.5 < 0.16;
    for (const sd of [-1, 1]) {
      const ex = cx + sd * 3;
      B.rect(ex - 1, hy + 3, 3, 1, dk);
      if (blink) B.rect(ex - 1, hy + 5, 3, 1, dk);
      else { B.rect(ex - 1, hy + 5, 3, 1, packr([250, 250, 244])); B.px(ex, hy + 5, dk); }
    }
    B.px(cx, hy + 1, verm);
    B.px(cx, hy + 5, verm); B.px(cx, hy + 6, verm); B.px(cx - 1, hy + 7, verm);
    /* the thirteen steps to nowhere */
    for (let k = 0; k < 8; k++) {
      const w = 9 - k, y = hy - 2 * (k + 1);
      B.rect(cx - (w >> 1), y, w, 2, k % 2 ? goldL : gold);
      B.rect(cx - (w >> 1), y + 1, w, 1, goldSh);
    }
    /* canopy and finial */
    const ty = hy - 18;
    B.rect(cx - 6, ty, 13, 2, gold);
    B.rect(cx - 4, ty - 1, 9, 1, goldL);
    B.rect(cx - 1, ty - 7, 1, 6, goldSh);
    B.px(cx - 1, ty - 8, verm);
    B.px(cx - 2, ty - 8, gold); B.px(cx, ty - 8, gold);
    if (p.dark > 0.3) B.glow(cx, hy + 4, 18, p.gold, 0.35 * p.dark);
  }

  function curve(ax, ay, bx, by, sag, f) {
    const mx = (ax + bx) / 2, my = (ay + by) / 2 + sag;
    const u = 1 - f;
    return [u * u * ax + 2 * u * f * mx + f * f * bx, u * u * ay + 2 * u * f * my + f * f * by];
  }
  function flagsDraw(p, t, tx_, ty_) {
    const line = packr(mix(p.fore, p.hill, 0.5));
    const anchors = [[10, 141, 12], [34, 143, 9], [128, 140, 10], [112, 145, 8]];
    anchors.forEach((a, ai) => {
      const bx = a[0] + (tx_ - HILL_X), by = hillTop[clamp(a[0] + PAD, 0, N - 1)] - 8;
      B.rect(bx, by, 1, 8, line);
      for (let k = 0; k <= 36; k++) {
        const q = curve(tx_, ty_, bx, by, a[2], k / 36);
        B.px(q[0], q[1], line);
      }
      for (let k = 1; k < 12; k++) {
        const f = k / 12.5, q = curve(tx_, ty_, bx, by, a[2], f);
        const wv = Math.sin(t * 3.4 + f * 15 + ai * 1.7);
        const colr = FLAG[(k + ai) % 5];
        const col = packr(mix(colr, p.fore, p.dark * 0.55));
        const x = Math.round(q[0]), y = Math.round(q[1]);
        B.rect(x, y + 1, 1, 3, col);
        B.rect(x + 1, y + 1 + (wv > 0.3 ? 1 : 0), 1, 2 + (wv < -0.4 ? 1 : 0), col);
      }
    });
  }

  function figureDraw(p, t, ox) {
    const fx = Math.round(24 + ox), gy = cliffTop[24 + PAD] - 1;
    const breath = Math.sin(t * 1.3) > 0.2 ? 1 : 0;
    const dk = p.dark;
    const robe = packr(mix(p.robe, p.fore, dk * 0.5)), robeS = packr(shade2(mix(p.robe, p.fore, dk * 0.5), 0.72));
    const skin = packr(mix(hex('#cf9470'), p.fore, dk * 0.55)), hair = packr(shade2(p.fore, 0.8));
    // aura
    const ay = gy - 11, pul = 0.7 + Math.sin(t * 1.3) * 0.12;
    B.glow(fx, ay, 15, mix(p.gold, [255, 235, 170], 0.3), 0.55 * pul * (0.35 + dk * 0.65));
    // legs
    B.rect(fx - 6, gy - 2, 13, 3, robeS);
    B.rect(fx - 5, gy - 3, 11, 1, robe);
    // torso
    B.rect(fx - 3 - breath, gy - 9, 7 + breath * 2, 7, robe);
    B.rect(fx + 1, gy - 9, 3 + breath, 7, robeS);
    // arms resting
    B.rect(fx - 4, gy - 5, 9, 2, robeS);
    B.px(fx, gy - 4, skin);
    // head
    B.rect(fx - 2, gy - 14 - breath * 0, 5, 5, skin);
    B.rect(fx - 2, gy - 15, 5, 2, hair);
    B.px(fx - 2, gy - 13, hair);
    B.px(fx, gy - 15 - 1, hair);
  }

  function pineDraw(p, t, ox) {
    const fc = packr(p.fore), rim = packr(mix(p.fore, p.snowLit, 0.16));
    const trees = [[124, 24, 0.7], [135, 36, 0], [112, 20, 1.3], [142, 18, 2]];
    for (const [x0, h, ph] of trees) {
      const x = Math.round(x0 + ox), i = clamp(x0 + PAD, 0, N - 1), base = cliffTop[i] + 1;
      B.rect(x - 1, base - 4, 2, 4, fc);
      const tiers = 5;
      for (let k = 0; k < tiers; k++) {
        const yy = base - 4 - h + Math.round((k * h) / tiers);
        const hw = 2 + Math.round(((k + 1) * (h / 4.2)) / tiers) + k;
        const sway = Math.round(Math.sin(t * 0.9 + ph) * 0.6 * (1 - k / tiers));
        const th = Math.ceil(h / tiers) + 2;
        for (let j = 0; j < th; j++) {
          const w = Math.round(hw * ((j + 1) / th));
          B.rect(x - w + sway, yy + j, w * 2 + 1, 1, fc);
          if (j === th - 1) B.px(x - w + sway, yy + j, rim);
        }
      }
    }
  }

  /* ---------- go ---------- */
  const loop = PX.loop(hero, draw, 30);
  S.redraw = () => { if (PX.reduced) loop.render(); };
  S.on(() => S.redraw());
  addEventListener('resize', () => S.redraw());
  if (PX.reduced) { born = -1e9; loop.render(); }
})();
