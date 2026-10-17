// Hanomi — livestock and wildlife, side view (right-facing; left = mirrored).
// Built like the portfolio dog: each animal is posed on a small skeleton and painted at 2x with
// shaded anatomical volumes (chest, loin, rump, neck, skull, muzzle, jointed legs), then halved
// with a feature-preserving mode filter and re-outlined — so they sit beside the dog naturally.
import { Spr, mix, mul } from '../pix.js';
import { hash2, clamp } from '../util.js';

const R4 = c => [mix(mul(c, 0.55), 0x2a1640, 0.2), mix(mul(c, 0.78), 0x3a2050, 0.08), c, mix(c, 0xfff4dc, 0.32)];
const lit = (C, u, v, k = 0) => { const l = 0.6 - u * 0.22 - v * 0.55 + k; return C[l > 0.88 ? 3 : l > 0.36 ? 2 : l > 0.02 ? 1 : 0]; };
const PRI = new Set([0x16101a, 0xffffff, 0xf0b8c0]);

// ---------- 2x painter helpers ----------
function E(s, cx, cy, rx, ry, C, k = 0, rot = 0) { // shaded ellipse (optionally rotated)
  const ca = Math.cos(rot), sa = Math.sin(rot), R = Math.max(rx, ry) + 1;
  for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
    if (u * u + v * v <= 1) s.set(x, y, typeof C === 'function' ? C(u, v, x, y) : lit(C, u, v, k));
  }
}
function limb(s, pts, w0, w1, C, k = 0) { // tapered jointed limb through points
  let tot = 0; for (let i = 1; i < pts.length; i++) tot += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let acc = 0;
  for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay), n = Math.max(2, Math.ceil(L * 1.5));
    for (let j = 0; j <= n; j++) { const t = j / n, f = (acc + L * t) / tot, w = w0 + (w1 - w0) * f, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      for (let yy = Math.floor(y - w / 2); yy <= y + w / 2; yy++) for (let xx = Math.floor(x - w / 2); xx <= x + w / 2; xx++) { const u = (xx + 0.5 - x) / (w / 2); if ((xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 <= (w / 2) ** 2 + 0.3) s.set(xx, yy, C[u < -0.35 ? 3 - k : u > 0.4 ? 1 - Math.min(k, 1) : 2 - k]); } }
    acc += L; }
}
// legs: hip -> knee -> hock/fetlock -> hoof, with a simple 2-phase gait
function leg(s, hx, hy, len, ph, C, hoofC, opt = {}) {
  const sw = Math.sin(ph) * (opt.amp || 4), lift = Math.max(0, Math.cos(ph)) * (opt.lift || 3), back = !!opt.back;
  const kx = hx + sw * 0.4 + (back ? -2 : 1), ky = hy + len * 0.45 - lift * 0.4;
  const fx = hx + sw, fy = hy + len - lift, jx = (kx + fx) / 2 + (back ? 2.5 : -0.5), jy = ky + (fy - ky) * 0.6;
  limb(s, [[hx, hy], [kx, ky], [jx, jy], [fx, fy - 2]], opt.w0 || 7, opt.w1 || 3.2, C, opt.far ? 1 : 0);
  s.rect(Math.round(fx - 2), Math.round(fy - 3), opt.hoofW || 4, 3, hoofC);
}
function eye(s, x, y, big) { s.rect(x, y, 2, 2, 0x16101a); if (big) s.rect(x, y + 2, 2, 1, 0x16101a); s.set(x, y, 0xffffff); }

// ---------- species ----------
const SPEC = {
  deer(s, ph, graze) {
    const F = R4(0xc4844e), Fd = R4(0xa86a3c), Wt = R4(0xf6ecd8), H = R4(0x3a2a20), gy = graze ? 14 : 0;
    const bob = Math.sin(ph * 2) * 0.8;
    leg(s, 22, 34 + bob, 26, ph + Math.PI, Fd, H[1], { far: 1, back: 1 }); leg(s, 46, 32 + bob, 28, ph, Fd, H[1], { far: 1 });
    E(s, 22, 30 + bob, 11, 10, F); E(s, 34, 31 + bob, 12, 9, F); E(s, 45, 29 + bob, 11, 11, F, 0.05); // rump, loin, chest
    E(s, 34, 37 + bob, 13, 3.5, Wt, 0.1); E(s, 12, 26 + bob, 4, 5, Wt, 0.2); s.rect(9, 22 + bob | 0, 3, 3, F[1]); // belly, rump patch, tail
    for (let k = 0; k < 9; k++) { const x = 20 + ((k * 7) % 26), y = 24 + ((k * 5) % 7) + bob | 0; s.rect(x, y, 2, 1, Wt[3]); }
    limb(s, [[48, 26 + bob], [52, 16 + gy * 0.6], [55, 9 + gy]], 9, 6, F); // neck
    const hx = 57, hy = 8 + gy; E(s, hx, hy, 6, 5, F); E(s, hx + 6, hy + 2, 4, 3, F, 0.1); s.rect(hx + 9, hy + 1, 2, 2, 0x2a1a14);
    E(s, hx - 4, hy - 5, 2.4, 4.5, F, 0, -0.6); E(s, hx - 4, hy - 5, 1.2, 3, Wt, 0, -0.6); // ear
    const A = [0xe8d8b0, 0xc8b48a]; if (!graze || 1) { limb(s, [[hx - 1, hy - 4], [hx - 3, hy - 12], [hx - 7, hy - 18]], 3.4, 2.4, [A[1], A[1], A[0], A[0]]); limb(s, [[hx - 3, hy - 10], [hx + 2, hy - 15]], 2.6, 2.2, [A[1], A[1], A[0], A[0]]); limb(s, [[hx + 1, hy - 4], [hx + 2, hy - 13], [hx + 5, hy - 18]], 3.4, 2.4, [A[1], A[1], A[0], A[0]]); }
    leg(s, 25, 34 + bob, 26, ph, F, H[1], { back: 1 }); leg(s, 49, 32 + bob, 28, ph + Math.PI, F, H[1]);
    eye(s, hx + 1, hy - 1, 1);
  },
  cow(s, ph, graze) {
    const Wh = R4(0xf4f0ea), Bk = R4(0x3e3438), Pk = R4(0xf2a8a8), gy = graze ? 10 : 0, bob = Math.sin(ph * 2) * 0.6;
    const patch = (u, v, x, y) => { const sp = ((x - 28) ** 2 / 90 + (y - 22) ** 2 / 40 < 1) || ((x - 50) ** 2 / 50 + (y - 30) ** 2 / 30 < 1) || ((x - 14) ** 2 / 30 + (y - 26) ** 2 / 50 < 1); return lit(sp ? Bk : Wh, u, v); };
    leg(s, 16, 34 + bob, 18, ph + Math.PI, Wh, Bk[0], { far: 1, back: 1, w0: 9, w1: 5, hoofW: 5 }); leg(s, 50, 34 + bob, 18, ph, Wh, Bk[0], { far: 1, w0: 9, w1: 5, hoofW: 5 });
    E(s, 18, 28 + bob, 13, 12, patch); E(s, 34, 27 + bob, 15, 12, patch); E(s, 50, 28 + bob, 12, 12, patch);
    E(s, 34, 40 + bob, 4, 2.5, Pk); limb(s, [[5, 20 + bob], [3, 30 + bob], [4, 38 + bob]], 2, 1.6, Wh); E(s, 4, 39 + bob, 2.4, 2.4, Bk);
    limb(s, [[54, 24 + bob], [60, 22 + gy]], 12, 10, Wh);
    const hx = 63, hy = 20 + gy; E(s, hx, hy, 8.5, 8, Wh); E(s, hx + 5, hy + 5, 5, 4, Pk); s.rect(hx + 6, hy + 4, 2, 2, 0x8a4a4a); s.rect(hx + 8, hy + 6, 1, 2, 0x8a4a4a);
    E(s, hx - 7, hy - 3, 4, 2, Bk, 0, 0.3); s.rect(hx - 4, hy - 11, 3, 5, 0xece0c4); s.rect(hx + 2, hy - 11, 3, 5, 0xece0c4); s.set(hx - 3, hy - 9, 0xfff6e0); s.set(hx + 2, hy - 9, 0xfff6e0);
    leg(s, 20, 34 + bob, 18, ph, Wh, Bk[0], { back: 1, w0: 9, w1: 5, hoofW: 5 }); leg(s, 53, 34 + bob, 18, ph + Math.PI, Wh, Bk[0], { w0: 9, w1: 5, hoofW: 5 });
    eye(s, hx + 1, hy - 2, 1);
  },
  sheep(s, ph, graze, shorn) {
    const Wl = R4(shorn ? 0xe8dccc : 0xf8f4ec), Fc = R4(0x3a3236), gy = graze ? 8 : 0, bob = Math.sin(ph * 2) * 0.6;
    leg(s, 16, 28 + bob, 14, ph + Math.PI, Fc, Fc[0], { far: 1, back: 1, w0: 5, w1: 3 }); leg(s, 36, 28 + bob, 14, ph, Fc, Fc[0], { far: 1, w0: 5, w1: 3 });
    if (shorn) E(s, 26, 22 + bob, 17, 9, Wl);
    else for (const [x, y, r] of [[10, 22, 7], [17, 15, 8], [27, 13, 8.5], [36, 16, 8], [41, 22, 7], [15, 27, 7], [25, 28, 7.5], [35, 27, 7], [26, 20, 10]]) E(s, x, y + bob, r, r * 0.92, (u, v, xx, yy) => { const l = 0.62 - u * 0.25 - v * 0.6 + (hash2(xx >> 1, yy >> 1, 4) - 0.5) * 0.2; return Wl[l > 0.85 ? 3 : l > 0.35 ? 2 : l > 0 ? 1 : 0]; });
    const hx = 47, hy = 16 + gy; E(s, hx, hy, 6, 7.5, Fc); E(s, hx - 6, hy - 1, 4, 2, Fc, 0, 0.4); if (!shorn) E(s, hx - 2, hy - 7, 5, 3.5, Wl);
    leg(s, 19, 28 + bob, 14, ph, Fc, Fc[0], { back: 1, w0: 5, w1: 3 }); leg(s, 39, 28 + bob, 14, ph + Math.PI, Fc, Fc[0], { w0: 5, w1: 3 });
    s.rect(hx + 1, hy - 2, 2, 2, 0xffffff); s.set(hx + 2, hy - 1, 0x16101a); s.set(hx + 2, hy - 2, 0x16101a);
  },
  pig(s, ph, graze) {
    const Pk = R4(0xf4aab4), Sn = R4(0xe88898), gy = graze ? 4 : 0, bob = Math.sin(ph * 2) * 0.6;
    leg(s, 14, 24 + bob, 10, ph + Math.PI, Pk, Sn[0], { far: 1, back: 1, w0: 7, w1: 4 }); leg(s, 34, 24 + bob, 10, ph, Pk, Sn[0], { far: 1, w0: 7, w1: 4 });
    E(s, 24, 19 + bob, 18, 11, Pk); E(s, 24, 25 + bob, 14, 4, Pk, -0.1);
    limb(s, [[6, 14 + bob], [3, 12 + bob], [4, 9 + bob], [7, 10 + bob]], 2, 1.6, Pk); // curly tail
    const hx = 41, hy = 16 + gy; E(s, hx, hy, 7, 7, Pk); E(s, hx + 7, hy + 2, 3, 4, Sn); s.rect(hx + 7, hy + 1, 1, 2, 0x8a3a4a); s.rect(hx + 8, hy + 3, 1, 2, 0x8a3a4a);
    E(s, hx - 2, hy - 7, 3, 2.4, Pk, 0, -0.6);
    leg(s, 17, 24 + bob, 10, ph, Pk, Sn[0], { back: 1, w0: 7, w1: 4 }); leg(s, 37, 24 + bob, 10, ph + Math.PI, Pk, Sn[0], { w0: 7, w1: 4 });
    eye(s, hx + 1, hy - 2);
  },
  boar(s, ph, graze) {
    const F = R4(0x6a4c3c), M = R4(0x3a2a22), gy = graze ? 4 : 0, bob = Math.sin(ph * 2) * 0.8;
    const fur = (u, v, x, y) => { const l = 0.6 - u * 0.22 - v * 0.55 + (hash2(x, y >> 1, 7) - 0.5) * 0.35; return F[l > 0.85 ? 3 : l > 0.36 ? 2 : l > 0.02 ? 1 : 0]; };
    leg(s, 14, 26 + bob, 12, ph + Math.PI, M, M[0], { far: 1, back: 1, w0: 7, w1: 4 }); leg(s, 36, 26 + bob, 12, ph, M, M[0], { far: 1, w0: 7, w1: 4 });
    E(s, 24, 20 + bob, 18, 11, fur); E(s, 32, 14 + bob, 12, 8, fur, 0.1);
    for (let x = 14; x < 40; x += 2) { const t = (x - 14) / 26; s.rect(x, Math.round(8 + bob + Math.abs(t - 0.6) * 6), 1, 3, M[0]); }
    s.rect(4, 15 + bob | 0, 3, 2, M[1]);
    const hx = 43, hy = 20 + gy; E(s, hx, hy, 7, 6.5, fur); E(s, hx + 7, hy + 2, 3.4, 3.4, M); s.rect(hx + 8, hy + 1, 2, 2, 0x1a1210);
    limb(s, [[hx + 4, hy + 4], [hx + 7, hy], [hx + 6, hy - 2]], 2, 1.2, [0xd8d0b8, 0xe8e0c8, 0xfaf2dc, 0xffffff]); E(s, hx - 3, hy - 6, 2.4, 3, M, 0, -0.5);
    leg(s, 17, 26 + bob, 12, ph, F, M[0], { back: 1, w0: 7, w1: 4 }); leg(s, 39, 26 + bob, 12, ph + Math.PI, F, M[0], { w0: 7, w1: 4 });
    s.rect(hx + 1, hy - 2, 2, 2, 0xd8302a); s.set(hx + 1, hy - 2, 0xffd0a0);
  },
  chicken(s, ph, graze) {
    const W = R4(0xf6f2e8), Y = [0xb87a20, 0xd8962a, 0xf2b030, 0xffd060], gy = graze ? 7 : 0, bob = Math.abs(Math.sin(ph)) * 1.2;
    for (const [x, o] of [[13, 0], [17, Math.PI]]) { const up = Math.max(0, Math.cos(ph + o)) * 2; limb(s, [[x, 22], [x + Math.sin(ph + o) * 2, 30 - up]], 1.8, 1.4, Y); s.rect(Math.round(x + Math.sin(ph + o) * 2) - 2, 30 - up | 0, 5, 1, Y[1]); }
    E(s, 6, 13 - bob, 5, 7, W, 0, 0.5); E(s, 15, 17 - bob, 10, 8, W); E(s, 14, 18 - bob, 6, 4, W, -0.15); // tail, body, wing
    limb(s, [[20, 13 - bob], [23, 8 + gy]], 6, 5, W);
    const hx = 24, hy = 6 + gy - bob; E(s, hx, hy, 4.5, 4.5, W); for (let k = 0; k < 3; k++) E(s, hx - 2 + k * 2, hy - 5, 1.6, 2, [0xa8201a, 0xd8302a, 0xff4a3a, 0xff7a6a]);
    s.rect(hx + 4, hy, 3, 2, Y[2]); s.set(hx + 6, hy + 1, Y[1]); E(s, hx + 2, hy + 4, 1.2, 1.8, [0xa8201a, 0xd8302a, 0xff4a3a, 0xff7a6a]);
    eye(s, hx + 1, hy - 1);
  },
  rabbit(s, ph) {
    const F = R4(0xc8a684), Wt = R4(0xf6f0e6), hop = Math.max(0, Math.sin(ph)) * 4;
    E(s, 12, 18 - hop, 9, 7, F); E(s, 7, 20 - hop, 6, 5, F, 0.05); E(s, 13, 22 - hop, 6, 2.5, Wt, 0.1); E(s, 2, 15 - hop, 3, 3, Wt, 0.3);
    limb(s, [[6, 22 - hop], [3 + hop * 0.5, 26 - hop * 0.5]], 4, 3, F); limb(s, [[18, 22 - hop], [20 + hop * 0.4, 26 - hop * 0.3]], 2.5, 2, F);
    const hx = 21, hy = 12 - hop; E(s, hx, hy, 5, 4.6, F); E(s, hx + 4, hy + 1, 2.4, 2.4, Wt);
    E(s, hx - 3, hy - 7, 1.8, 5.5, F, 0, -0.25); E(s, hx - 3, hy - 7, 0.8, 4, [0xd8909a, 0xf0b0b8, 0xf0b8c0, 0xffd0d8], 0, -0.25); E(s, hx, hy - 8, 1.8, 5.5, F, 0.05, 0.1);
    s.set(hx + 6, hy + 1, 0xd88a90); eye(s, hx + 1, hy - 2);
  },
  fox(s, ph) {
    const F = R4(0xe0782e), Wt = R4(0xfaf2e6), Dk = R4(0x3a2a24), bob = Math.sin(ph * 2) * 0.6;
    leg(s, 16, 24 + bob, 14, ph + Math.PI, Dk, Dk[0], { far: 1, back: 1, w0: 5, w1: 3 }); leg(s, 34, 24 + bob, 14, ph, Dk, Dk[0], { far: 1, w0: 5, w1: 3 });
    limb(s, [[10, 18 + bob], [3, 20 + bob], [0, 14 + bob]], 7, 5, F); E(s, 0, 13 + bob, 3, 3, Wt);
    E(s, 18, 19 + bob, 10, 7, F); E(s, 31, 18 + bob, 9, 7.5, F); E(s, 30, 22 + bob, 7, 3.5, Wt, 0.1);
    const hx = 40, hy = 11; E(s, hx, hy, 5.5, 5, F); E(s, hx + 5, hy + 2, 4, 2.4, Wt); s.rect(hx + 8, hy + 1, 2, 2, 0x16101a);
    for (const ex of [-3, 1]) { for (let k = 0; k < 6; k++) s.rect(hx + ex - (k >> 1) + 1, hy - 5 - k, Math.max(1, 3 - (k >> 1)), 1, k > 3 ? Dk[2] : F[2]); }
    leg(s, 19, 24 + bob, 14, ph, F, Dk[0], { back: 1, w0: 5, w1: 3 }); leg(s, 37, 24 + bob, 14, ph + Math.PI, F, Dk[0], { w0: 5, w1: 3 });
    eye(s, hx + 1, hy - 1);
  },
};
const SIZE = { deer: [70, 64], cow: [76, 56], sheep: [58, 44], pig: [52, 38], boar: [56, 42], chicken: [32, 34], rabbit: [30, 30], fox: [50, 40] };
const OUT = { deer: 0x2e1a10, cow: 0x2a2226, sheep: 0x3a3236, pig: 0x7a3444, boar: 0x1a120c, chicken: 0x5a4a42, rabbit: 0x3e2c1e, fox: 0x3a1a0c };

function halve(src) { // 2x -> 1x mode filter that keeps eyes / features
  const W = Math.ceil(src.w / 2), H = Math.ceil(src.h / 2), o = new Spr(W, H), cnt = new Map();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    cnt.clear(); let n = 0;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const xx = x * 2 + i, yy = y * 2 + j; if (!src.has(xx, yy)) continue; n++; const c = src.hex(xx, yy); cnt.set(c, (cnt.get(c) || 0) + (PRI.has(c) ? 2.6 : 1)); }
    if (n < 2) { for (const [c] of cnt) if (PRI.has(c) && c !== 0xffffff) o.set(x, y, c); continue; }
    let best = 0, bw = -1; for (const [c, k] of cnt) if (k > bw) { bw = k; best = c; } o.set(x, y, best);
  }
  return o;
}
function bake1(kind, ph, graze, shorn) {
  const [W, H] = SIZE[kind], s = new Spr(W, H); SPEC[kind](s, ph, graze, shorn);
  const h = halve(s); h.outline(OUT[kind]); return h;
}
export const ANIMALS = Object.keys(SPEC);
const cache = {};
export function bakeAnimal(kind, variant) {
  const k = kind + (variant || ''); if (cache[k]) return cache[k];
  const shorn = variant === 'shorn', mk = arr => arr.map(s => ({ n: s.canvas(), f: s.flipX().canvas() }));
  const res = { walk: mk([0, 1, 2, 3, 4, 5].map(i => bake1(kind, i / 6 * Math.PI * 2, false, shorn))), idle: mk([bake1(kind, 0, false, shorn), bake1(kind, 0, true, shorn)]) };
  const s0 = res.walk[0].n; res.w = s0.width; res.h = s0.height;
  cache[k] = res; return res;
}
