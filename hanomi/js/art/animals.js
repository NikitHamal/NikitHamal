// Hanomi — livestock and wildlife, side view (right-facing; left = mirrored).
import { Spr, mix, mul } from '../pix.js';
import { hash2, clamp } from '../util.js';

const r3 = c => [mul(c, 0.7), c, mix(c, 0xfff4d8, 0.3)];
function legs(s, xs, top, bot, col, ph, lift = 1) {
  xs.forEach((x, i) => { const sw = Math.round(Math.sin(ph + i * Math.PI) * 1.2), up = Math.max(0, Math.cos(ph + i * Math.PI)) * lift | 0;
    s.rect(x + sw, top, 2, bot - top - up + 1, (xx) => xx === x + sw ? col[2] : col[1]); s.set(x + sw, bot - up, col[0]); s.set(x + sw + 1, bot - up, col[0]); });
}
const P = {
  chicken(ph, graze) {
    const s = new Spr(16, 16), W = r3(0xf2eee4), b = graze ? 2 : 0;
    legs(s, [6, 9], 11, 14, r3(0xe8a83a), ph, 1);
    s.ell(8, 9, 5, 3.6, (u, v) => W[v < -0.3 ? 2 : u < -0.3 && v > 0.2 ? 0 : 1]); s.ell(3.5, 7, 2, 2.6, W[1]); s.set(2, 5, W[2]); s.set(3, 5, W[1]);
    s.ell(11, 5 + b, 2.6, 2.6, W[2]); s.set(14, 5 + b, 0xf0a020); s.set(13, 6 + b, 0xf0a020); s.set(12, 4 + b, 0x1a1414); s.rect(10, 2 + b, 2, 2, 0xe0302a); s.set(12, 7 + b, 0xe0302a);
    s.ell(8, 9.5, 2.5, 1.6, W[0]); s.outline(0x3a3028); return s;
  },
  cow(ph, graze) {
    const s = new Spr(30, 24), Wh = r3(0xf2eee8), Bk = r3(0x3a3236), hy = graze ? 6 : 0;
    legs(s, [6, 9, 19, 22], 15, 22, r3(0xe8e2da), ph, 1);
    s.ell(14, 11, 11, 6.5, (u, v, x, y) => { const spot = hash2(x >> 2, y >> 2, 5) < 0.35; const k = v < -0.4 ? 2 : v > 0.5 ? 0 : 1; return spot ? Bk[k] : Wh[k]; });
    s.ell(5, 12, 1.5, 1.5, Wh[0]); s.line(3, 9, 2, 14, Bk[1]);
    s.ell(25, 8 + hy, 4, 3.6, (u, v) => Wh[v < -0.3 ? 2 : 1]); s.ell(27.5, 10 + hy, 2.4, 2, 0xe8a8a0); s.set(28, 10 + hy, 0x8a5a5a);
    s.set(25, 7 + hy, 0x1a1414); s.set(22, 5 + hy, Bk[1]); s.set(23, 4 + hy, 0xe8dcc0); s.set(27, 4 + hy, 0xe8dcc0); s.ell(14, 16.5, 2, 1.2, 0xf0b0b0);
    s.outline(0x2a2224); return s;
  },
  sheep(ph, graze, shorn) {
    const s = new Spr(24, 20), Wl = r3(shorn ? 0xe8dccc : 0xf6f2ea), Fc = r3(0x3a3236), hy = graze ? 4 : 0;
    legs(s, [6, 8, 15, 17], 12, 18, Fc, ph, 1);
    if (shorn) s.ell(11, 10, 8, 4.5, Wl[1]); else for (let k = 0; k < 9; k++) s.ell(4 + (k % 5) * 3.2, 7 + (k > 4 ? 4 : 0) + (k % 2), 3.4, 3, (u, v) => Wl[v < -0.3 ? 2 : v > 0.5 ? 0 : 1]);
    s.ell(19.5, 7 + hy, 3, 3.4, (u, v) => Fc[u > 0.3 ? 0 : 1]); s.set(20, 6 + hy, 0xf2f2f2); s.rect(17, 4 + hy, 2, 2, Fc[0]);
    s.outline(0x2a2224); return s;
  },
  pig(ph, graze) {
    const s = new Spr(22, 16), Pk = r3(0xf0a8a8), hy = graze ? 2 : 0;
    legs(s, [5, 8, 13, 16], 10, 14, Pk, ph, 1);
    s.ell(11, 8, 8, 5, (u, v) => Pk[v < -0.4 ? 2 : v > 0.4 ? 0 : 1]); s.ell(18, 7 + hy, 3, 3, Pk[1]); s.rect(20, 7 + hy, 2, 2, 0xd88888); s.set(18, 6 + hy, 0x1a1414); s.set(16, 4 + hy, Pk[0]); s.set(3, 6, Pk[0]); s.set(2, 5, Pk[0]);
    s.outline(0x5a2a2a); return s;
  },
  rabbit(ph) {
    const s = new Spr(14, 12), F = r3(0xb89a7a), hop = Math.max(0, Math.sin(ph)) * 2 | 0;
    s.ell(6, 8 - hop, 4.5, 3, (u, v) => F[v < -0.3 ? 2 : 1]); s.ell(10, 6 - hop, 2.5, 2.3, F[1]); s.rect(9, 1 - hop, 1, 4, F[1]); s.rect(10, 1 - hop, 1, 4, F[0]); s.set(11, 5 - hop, 0x1a1414); s.set(2, 7 - hop, 0xffffff); s.rect(4, 10 - hop, 3, 1, F[0]);
    s.outline(0x3a2a1e); return s;
  },
  deer(ph, graze) {
    const s = new Spr(28, 28), F = r3(0xb8784a), hy = graze ? 7 : 0;
    legs(s, [7, 9, 18, 20], 16, 26, F, ph, 1);
    s.ell(13, 13, 9, 4.8, (u, v, x, y) => (v < -0.2 && hash2(x, y, 3) < 0.08) ? 0xf2e2c8 : F[v < -0.4 ? 2 : v > 0.5 ? 0 : 1]); s.ell(13, 15.5, 6, 1.5, 0xe8d0b0);
    s.line(20, 11, 23, 5 + hy, F[1]); s.line(21, 11, 24, 5 + hy, F[1]); s.ell(24.5, 5 + hy, 2.5, 2.2, F[1]); s.set(26, 6 + hy, 0x1a1414); s.set(24, 4 + hy, 0x1a1414);
    s.line(23, 3 + hy, 21, -1 + hy, 0xd8c8a0); s.line(22, 1 + hy, 20, 1 + hy, 0xd8c8a0); s.line(24, 3 + hy, 25, -1 + hy, 0xd8c8a0); s.set(4, 11, 0xffffff);
    s.outline(0x2a1a12); return s;
  },
  boar(ph, graze) {
    const s = new Spr(24, 18), F = r3(0x5a4034), hy = graze ? 2 : 0;
    legs(s, [5, 8, 15, 18], 11, 16, r3(0x3a2a22), ph, 1);
    s.ell(11, 9, 9, 5.6, (u, v, x, y) => F[v < -0.4 ? 2 : (hash2(x, y, 2) < 0.2 ? 0 : 1)]); for (let x = 5; x < 15; x += 2) s.set(x, 3, F[0]);
    s.ell(20, 9 + hy, 3.4, 3, F[1]); s.rect(22, 9 + hy, 2, 2, 0x3a2a22); s.set(21, 11 + hy, 0xf2ecd8); s.set(22, 12 + hy, 0xf2ecd8); s.set(20, 8 + hy, 0xd8302a);
    s.outline(0x1e140e); return s;
  },
  fish(c) { const s = new Spr(12, 6), F = r3(c); s.ell(5, 3, 4.5, 2, (u, v) => F[v < -0.2 ? 2 : 1]); s.poly([[9, 3], [12, 0], [12, 6]], F[0]); s.set(2, 2, 0x1a1414); s.outline(mul(c, 0.4)); return s; },
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
export function bakeFishIcon(c) { return P.fish(c).canvas(); }
