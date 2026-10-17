// Hanomi — livestock and wildlife, side view (right-facing; left = mirrored).
// Parts are painted on separate layers with sel-out outlines, lit from the top-left.
import { Spr, mix, mul } from '../pix.js';
import { hash2, clamp } from '../util.js';

const R4 = c => [mix(mul(c, 0.55), 0x2a1640, 0.22), mix(mul(c, 0.78), 0x3a2050, 0.1), c, mix(c, 0xfff4dc, 0.35)];
const shade = (C, u, v, k = 0) => { const l = 0.58 - u * 0.25 - v * 0.5 + k; return C[l > 0.85 ? 3 : l > 0.38 ? 2 : l > 0.05 ? 1 : 0]; };
function L(w, h) { return new Spr(w, h); }
function put(dst, l, out) { l.outline(out); dst.draw(l, 0, 0); }
// legs: [x, top, len] ; ph walk phase ; front/back pairs alternate
function legs(s, W, H, xs, top, bot, C, ph, out, far) {
  const l = L(W, H);
  xs.forEach((x, i) => { const p = ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0), sw = Math.round(Math.sin(p) * 1.4), up = Math.cos(p) > 0.4 ? 1 : 0;
    for (let y = top; y <= bot - up; y++) { const k = (y - top) / (bot - top); const xx = x + Math.round(sw * k); l.set(xx, y, far ? C[1] : C[2]); l.set(xx + 1, y, far ? C[0] : C[1]); }
    const fx = x + sw; l.set(fx, bot - up, C[0]); l.set(fx + 1, bot - up, C[0]); });
  put(s, l, out);
}
const eye = (s, x, y, big) => { s.set(x, y, 0x16101a); if (big) { s.set(x, y + 1, 0x16101a); s.set(x, y, 0xffffff); } };

const P = {
  chicken(ph, graze) {
    const W = 18, H = 17, s = new Spr(W, H), Wt = R4(0xf6f2e8), b = graze ? 3 : 0, O = 0x6a5a50;
    { const l = L(W, H); for (const [x, top] of [[7, 12], [10, 12]]) { const up = Math.cos(ph + (x > 8 ? Math.PI : 0)) > 0.5 ? 1 : 0; l.rect(x, top, 1, 3 - up, 0xe8a83a); l.rect(x - 1, 15 - up, 3, 1, 0xd08a2a); } s.draw(l, 0, 0); }
    { const l = L(W, H); l.ell(8, 9, 5.8, 4.2, (u, v) => shade(Wt, u, v)); // body
      l.ell(3.2, 6.5, 2.2, 3, (u, v) => shade(Wt, u, v, -0.1)); l.set(2, 3, Wt[3]); l.set(3, 4, Wt[2]); // tail
      l.ell(8, 9.5, 3.2, 2, (u, v) => v < -0.2 ? Wt[2] : Wt[1]); l.set(6, 9, Wt[3]); // wing
      put(s, l, O); }
    { const l = L(W, H); l.ell(12.5, 5 + b, 2.8, 2.8, (u, v) => shade(Wt, u, v)); l.rect(11, 1 + b, 3, 2, 0xe0302a); l.set(12, 0 + b, 0xff5a4a); l.set(14, 7 + b, 0xe0302a);
      l.set(15, 5 + b, 0xf2b030); l.set(16, 5 + b, 0xd08a20); put(s, l, O); eye(s, 13, 4 + b); }
    return s;
  },
  cow(ph, graze) {
    const W = 34, H = 26, s = new Spr(W, H), Wh = R4(0xf4f0ea), Bk = R4(0x3e3438), hy = graze ? 6 : 0, O = 0x2a2226;
    legs(s, W, H, [7, 23], 15, 24, R4(0xd8d0c6), ph, O, true);
    { const l = L(W, H); // body: rounded box with patches
      for (let y = 6; y <= 17; y++) for (let x = 3; x <= 26; x++) { const u = (x - 14.5) / 11.5, v = (y - 11.5) / 5.8; if (Math.pow(Math.abs(u), 4) + Math.pow(Math.abs(v), 3) > 1) continue;
        const spot = ((x - 8) ** 2 / 16 + (y - 9) ** 2 / 7 < 1) || ((x - 19) ** 2 / 12 + (y - 13) ** 2 / 9 < 1) || ((x - 24) ** 2 / 5 + (y - 7) ** 2 / 4 < 1); l.set(x, y, shade(spot ? Bk : Wh, u, v)); }
      l.ell(16, 18, 2.4, 1.4, 0xf2a8a8); // udder
      for (let y = 8; y < 15; y++) l.set(2, y, Wh[1]); l.rect(1, 14, 2, 3, Bk[1]); // tail
      put(s, l, O); }
    legs(s, W, H, [10, 26], 15, 24, R4(0xe8e2da), ph + 1, O, false);
    { const l = L(W, H); const hx = 28, yy = 8 + hy;
      for (let k = 0; k < 4; k++) l.rect(24 + k, 9 + (hy * k / 4 | 0), 3, 5, Wh[2]); // neck
      l.ell(hx, yy, 4.2, 3.8, (u, v) => shade(Wh, u, v)); l.ell(hx + 2.5, yy + 2.6, 2.6, 1.9, (u, v) => v < 0 ? 0xf8c0b8 : 0xe8a0a0); l.set(hx + 3, yy + 2, 0x8a4a4a);
      l.set(hx - 3, yy - 3, Bk[2]); l.set(hx - 4, yy - 3, Bk[1]); l.set(hx - 4, yy - 2, Bk[1]); // ear
      l.set(hx - 1, yy - 4, 0xece0c4); l.set(hx - 1, yy - 5, 0xfff4dc); l.set(hx + 2, yy - 4, 0xece0c4); l.set(hx + 2, yy - 5, 0xfff4dc); // horns
      put(s, l, O); eye(s, hx + 1, yy - 1, true); }
    return s;
  },
  sheep(ph, graze, shorn) {
    const W = 26, H = 22, s = new Spr(W, H), Wl = R4(shorn ? 0xe8dccc : 0xf8f4ec), Fc = R4(0x3a3236), hy = graze ? 4 : 0, O = 0x5a5050;
    legs(s, W, H, [6, 16], 13, 20, Fc, ph, 0x1a1418, true);
    { const l = L(W, H);
      if (shorn) l.ell(11, 10, 8, 4.6, (u, v) => shade(Wl, u, v));
      else for (const [x, y, r] of [[5, 9, 3.6], [9, 6.5, 3.8], [13.5, 6.5, 3.8], [17, 9, 3.4], [7, 12, 3.4], [11, 12, 3.6], [15, 12, 3.4], [11, 9, 4]]) l.ell(x, y, r, r * 0.9, (u, v) => shade(Wl, u, v));
      put(s, l, O); }
    legs(s, W, H, [8, 18], 13, 20, Fc, ph + 1, 0x1a1418, false);
    { const l = L(W, H), hx = 20.5, yy = 7 + hy; l.ell(hx, yy, 3, 3.6, (u, v) => shade(Fc, u, v)); l.set(hx - 3, yy - 1, Fc[1]); l.set(hx - 4, yy, Fc[1]);
      if (!shorn) l.ell(hx - 1, yy - 3, 2.4, 1.6, (u, v) => shade(Wl, u, v)); put(s, l, 0x1a1418); s.set(hx + 1, yy - 1, 0xffffff); s.set(hx + 1, yy, 0x16101a); }
    return s;
  },
  pig(ph, graze) {
    const W = 24, H = 18, s = new Spr(W, H), Pk = R4(0xf4aab0), hy = graze ? 2 : 0, O = 0x8a3a4a;
    legs(s, W, H, [5, 14], 11, 16, Pk, ph, O, true);
    { const l = L(W, H); l.ell(11, 8.5, 8.4, 5.4, (u, v) => shade(Pk, u, v)); l.set(2, 6, Pk[1]); l.set(1, 5, Pk[1]); l.set(2, 4, Pk[2]); put(s, l, O); }
    legs(s, W, H, [7, 16], 11, 16, Pk, ph + 1, O, false);
    { const l = L(W, H), hx = 19, yy = 7 + hy; l.ell(hx, yy, 3.4, 3.2, (u, v) => shade(Pk, u, v)); l.rect(hx + 3, yy, 2, 3, 0xe88898); l.set(hx + 4, yy + 1, 0x8a3a4a);
      l.set(hx - 2, yy - 3, Pk[1]); l.set(hx - 1, yy - 4, Pk[2]); put(s, l, O); eye(s, hx + 1, yy - 1); }
    return s;
  },
  rabbit(ph) {
    const W = 15, H = 13, s = new Spr(W, H), F = R4(0xc8a684), hop = Math.max(0, Math.sin(ph)) * 2 | 0, O = 0x4a3424;
    const l = L(W, H); l.ell(6, 9 - hop, 4.6, 3.2, (u, v) => shade(F, u, v)); l.ell(10.5, 6.5 - hop, 2.6, 2.4, (u, v) => shade(F, u, v));
    l.rect(9, 1 - hop, 1, 4, F[2]); l.rect(10, 1 - hop, 1, 4, F[1]); l.set(9, 2 - hop, 0xf2b0b8); l.ell(1.8, 8 - hop, 1.5, 1.5, 0xffffff); l.rect(4, 11 - hop, 3, 1, F[1]); l.rect(8, 11 - hop, 2, 1, F[1]);
    put(s, l, O); eye(s, 11, 6 - hop); s.set(13, 7 - hop, 0xd88a90); return s;
  },
  deer(ph, graze) {
    const W = 30, H = 30, s = new Spr(W, H), F = R4(0xc0804e), hy = graze ? 8 : 0, O = 0x3a2214;
    legs(s, W, H, [7, 19], 16, 28, F, ph, O, true);
    { const l = L(W, H); l.ell(13.5, 13, 9.5, 5, (u, v, x, y) => (v < -0.1 && hash2(x, y, 3) < 0.09) ? 0xf6ead4 : shade(F, u, v)); l.ell(13, 16.5, 6, 1.4, 0xead2b0);
      l.ell(4, 11, 1.6, 2, 0xfff8ee); put(s, l, O); }
    legs(s, W, H, [9, 21], 16, 28, F, ph + 1, O, false);
    { const l = L(W, H); for (let k = 0; k < 6; k++) l.rect(20 + k * 0.6 | 0, 11 - k + (hy * k / 6 | 0), 3, 2, F[2]);
      const hx = 25, yy = 5 + hy; l.ell(hx, yy, 2.8, 2.4, (u, v) => shade(F, u, v)); l.rect(hx + 2, yy, 2, 2, F[1]); l.set(hx + 3, yy, 0x2a1a14); l.set(hx - 2, yy - 2, F[1]); l.set(hx - 3, yy - 3, F[2]);
      put(s, l, O); eye(s, hx, yy - 1);
      const A = 0xe0d0a8; s.line(hx, yy - 3, hx - 2, yy - 8, A); s.line(hx - 1, yy - 6, hx - 4, yy - 7, A); s.line(hx + 1, yy - 3, hx + 2, yy - 8, A); s.line(hx + 2, yy - 6, hx + 4, yy - 7, A); }
    return s;
  },
  boar(ph, graze) {
    const W = 26, H = 19, s = new Spr(W, H), F = R4(0x6a4c3c), hy = graze ? 2 : 0, O = 0x1e140e;
    legs(s, W, H, [5, 15], 12, 17, R4(0x3a2a22), ph, O, true);
    { const l = L(W, H); l.ell(11.5, 9.5, 9.4, 6, (u, v, x, y) => hash2(x, y, 2) < 0.18 ? F[1] : shade(F, u, v)); for (let x = 5; x < 17; x += 2) { l.set(x, 3, F[0]); l.set(x + 1, 4, F[0]); } put(s, l, O); }
    legs(s, W, H, [7, 17], 12, 17, R4(0x4a3a2e), ph + 1, O, false);
    { const l = L(W, H), hx = 21, yy = 10 + hy; l.ell(hx, yy, 3.6, 3.2, (u, v) => shade(F, u, v)); l.rect(hx + 3, yy, 2, 2, 0x4a3426); l.set(hx - 2, yy - 3, F[1]); put(s, l, O);
      s.set(hx + 2, yy + 2, 0xfaf2dc); s.set(hx + 3, yy + 1, 0xfaf2dc); s.set(hx + 1, yy - 1, 0xd8302a); }
    return s;
  },
};
export const ANIMALS = ['chicken', 'cow', 'sheep', 'pig', 'rabbit', 'deer', 'boar'];
const cache = {};
export function bakeAnimal(kind, variant) {
  const k = kind + (variant || ''); if (cache[k]) return cache[k];
  const f = (ph, g) => P[kind](ph, g, variant === 'shorn');
  const mk = arr => arr.map(s => ({ n: s.canvas(), f: s.flipX().canvas() }));
  const res = { walk: mk([0, 1, 2, 3].map(i => f(i / 4 * Math.PI * 2, false))), idle: mk([f(0, false), f(0, true)]) };
  const s0 = res.walk[0].n; res.w = s0.width; res.h = s0.height;
  cache[k] = res; return res;
}
