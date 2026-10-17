// Hanomi — chibi characters (player, villagers, soldiers, zombies). 24x32 frames, feet at (12,30).
// Each body part is painted on its own layer, sel-outlined in a darker shade of its own colour,
// then stacked back-to-front — the classic hand-pixelled look, with top-left light.
import { Spr, mix, mul } from '../pix.js';
import { hash2, mulberry32, clamp } from '../util.js';

export const FW = 24, FH = 32, FX = 12, FY = 30;
export const SKINS = [0xf8d8bc, 0xecbf98, 0xd09a70, 0xa06c48, 0x744c34];
export const HAIRS = [0x2c2430, 0x4e3224, 0x7c4a2a, 0xc8883a, 0xecd496, 0xb8402a, 0x9898a6, 0x3a4a86, 0xe08aac];
export const SHIRTS = [0x3a6fc8, 0xc8423a, 0x2f9a6a, 0xd8a23a, 0x7a46b8, 0xe8e0d0, 0x4a4a5a, 0xd86a8a, 0x4a9aaa];
const OUT = 0x2a1a22;
// 4-step hue-shifted ramp: [deep, shade, base, light]
const R4 = c => [mix(mul(c, 0.52), 0x2a1640, 0.25), mix(mul(c, 0.76), 0x3a2050, 0.12), c, mix(c, 0xfff2d0, 0.32)];

function layer() { return new Spr(FW, FH); }
function stamp(dst, l, outline) { if (outline != null) l.outline(outline); dst.draw(l, 0, 0); }

// dir: 0 down, 1 right, 2 up.  f: {bob, la, lb (leg lift), sa, sb (arm swing), stride, arm (attack pose), blink}
function drawChar(L, dir, f) {
  const s = new Spr(FW, FH);
  const Sk = L.zombie ? R4(L.skin) : [mix(mul(L.skin, 0.62), 0x8a2a3a, 0.2), mix(mul(L.skin, 0.86), 0xd05a5a, 0.12), L.skin, mix(L.skin, 0xfff8ee, 0.4)], Hr = R4(L.hair), Sh = R4(L.shirt), Pn = R4(L.pants), Sb = R4(L.shoes), Ss = R4(L.sash);
  const Ar = L.armor != null ? R4(L.armor) : null, Z = !!L.zombie;
  const bob = f.bob || 0, hy = 11 + bob + (Z ? 1 : 0), hx = 12 + (dir === 1 ? 0 : 0);
  const skinOut = mul(L.skin, 0.45), hairOut = mix(mul(L.hair, 0.4), OUT, 0.5);
  const legTop = 24 + bob;
  // ---------------- legs ----------------
  const leg = (x, lift, dx = 0, far = false) => { const l = layer();
    const bot = 29 - lift, P = far ? [Pn[0], Pn[1], Pn[1]] : [Pn[1], Pn[2], Pn[3]];
    for (let y = legTop; y <= bot; y++) for (let i = 0; i < 3; i++) l.set(x + i + (y > bot - 2 ? dx : 0), y, i === 0 ? P[2] : i === 2 ? P[0] : P[1]);
    // zori / tabi
    const sx = x + dx - (dir === 1 ? 0 : 0);
    for (let i = 0; i < (dir === 1 ? 4 : 3); i++) { l.set(sx + i, bot + 1, i === 0 ? Sb[3] : Sb[2]); }
    if (dir !== 2) l.set(sx + 1, bot, mix(Sb[3], 0xffffff, 0.3));
    stamp(s, l, mul(L.pants, 0.4)); };
  if (dir === 1) {
    const st = f.stride || 0; // -2..2
    leg(10 - st, Math.max(0, -st) > 1 ? 1 : 0, 0, true); leg(11 + st, Math.max(0, st) > 1 ? 1 : 0, 0);
  } else { leg(8, f.la || 0); leg(13, f.lb || 0); }
  // ---------------- back arm (side view) ----------------
  const sleeve = Ar || Sh;
  const armSide = (x, y, swing, far) => { const l = layer(), C = far ? [sleeve[0], sleeve[1], sleeve[1], sleeve[2]] : sleeve;
    if (Z) { for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) l.set(x + i, y + j, j === 0 ? C[3] : C[2]); l.rect(x + 6, y, 2, 3, Sk[far ? 1 : 2]); stamp(s, l, mul(L.shirt, 0.4)); return; }
    const ax = x + swing; for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) l.set(ax + (j > 2 ? Math.sign(swing) : 0) + i, y + j, i === 0 ? C[3] : i === 2 ? C[1] : C[2]);
    l.rect(ax + Math.sign(swing) + (swing > 0 ? 1 : 0), y + 5, 2, 2, far ? Sk[1] : Sk[2]); stamp(s, l, mul(L.shirt, 0.4)); };
  if (dir === 1) armSide(9, 18 + bob, -(f.sa || 0), true);
  // ---------------- torso (kimono) ----------------
  { const l = layer(), y0 = 17 + bob, x0 = dir === 1 ? 9 : 7, w = dir === 1 ? 7 : 10;
    for (let y = y0; y < y0 + 8; y++) { const flare = y > y0 + 5 ? 1 : 0;
      for (let x = x0 - flare; x < x0 + w + flare; x++) { const u = (x - x0 + 0.5) / w; let c = u < 0.22 ? Sh[3] : u > 0.8 ? Sh[1] : Sh[2]; if (y === y0) c = Sh[3];
        if (Ar && y < y0 + 5) c = u < 0.3 ? Ar[3] : u > 0.75 ? Ar[1] : Ar[2]; l.set(x, y, c); } }
    if (dir === 0 && !Ar) { // overlapping lapels (migi-mae) with an under-collar
      const cx = x0 + 5; l.set(cx - 1, y0, 0xf6efe2); l.set(cx, y0, 0xf6efe2); l.set(cx - 1, y0 + 1, 0xe2d8c8); l.set(cx + 1, y0 + 1, Sh[1]);
      l.set(cx - 2, y0, Sh[3]); l.set(cx + 1, y0, Sh[1]); l.set(cx, y0 + 1, Sh[1]); l.set(cx, y0 + 2, Sh[1]); }
    if (dir === 1 && !Ar) { l.set(x0 + 5, y0, 0xf6efe2); l.set(x0 + 4, y0 + 1, Sh[0]); l.set(x0 + 5, y0 + 2, Sh[0]); }
    // obi sash with a knot
    for (let x = x0 - 1; x <= x0 + w; x++) { l.set(x, y0 + 5, Ss[3]); l.set(x, y0 + 6, Ss[1]); }
    if (dir === 2) { l.rect(x0 + 3, y0 + 4, 4, 4, Ss[2]); l.set(x0 + 4, y0 + 5, Ss[3]); }
    if (dir === 1) { l.set(x0 - 1, y0 + 5, Ss[2]); l.set(x0 - 2, y0 + 6, Ss[1]); }
    if (Ar) { for (let x = x0; x < x0 + w; x += 2) l.set(x, y0 + 4, Ar[0]); l.set(x0 + 4, y0 + 2, L.crest != null ? L.crest : Ar[3]); }
    if (Z) for (let k = 0; k < 5; k++) { const x = x0 + (hash2(k, L.seed, 1) * w | 0), y = y0 + 1 + (hash2(k, L.seed, 2) * 5 | 0); l.set(x, y, Sk[1]); l.set(x + 1, y, Sk[0]); }
    stamp(s, l, mul(L.shirt, 0.38)); }
  let hand;
  if (dir === 1) { armSide(11, 18 + bob, f.sa || 0, false); const sw = f.sa || 0; hand = [11 + sw + 1.5 + Math.sign(sw), 24 + bob]; }
  // ---------------- front arms ----------------
  if (dir !== 1) {
    const arm = (x, sw, right) => { const l = layer(), C = sleeve, y0 = 18 + bob;
      if (Z && dir === 0) { l.rect(x, y0 + 1, 3, 3, C[2]); l.rect(x, y0 + 4, 3, 2, Sk[2]); l.set(x + 1, y0 + 4, Sk[3]); stamp(s, l, mul(L.shirt, 0.38)); return; }
      for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) l.set(x + i, y0 + j + sw, (right ? i === 2 : i === 0) ? C[1] : j === 0 ? C[3] : C[2]);
      l.rect(x, y0 + 5 + sw, 3, 2, Sk[2]); l.set(x + (right ? 0 : 2), y0 + 6 + sw, Sk[1]); if (dir === 0) l.set(x + 1, y0 + 5 + sw, Sk[3]);
      stamp(s, l, mul(L.shirt, 0.38)); };
    arm(4, f.sa || 0, false); arm(17, f.sb || 0, true);
    hand = dir === 0 ? [5.5, 23.5 + bob + (f.sa || 0)] : [18.5, 23.5 + bob + (f.sb || 0)];
  }
  // ---------------- head ----------------
  { const l = layer();
    l.ell(hx, hy, dir === 1 ? 6.6 : 7.1, 6.3, (u, v) => { const k = 0.55 - u * 0.28 - v * 0.38; return Sk[k > 0.78 ? 3 : k > 0.18 ? 2 : 1]; });
    if (dir === 1) { l.set(hx + 7, hy + 1, Sk[2]); l.set(hx + 6, hy + 2, Sk[1]); } // nose
    stamp(s, l, skinOut); }
  // ---------------- hair ----------------
  const style = L.hairStyle || 'short';
  if (style !== 'bald') { const l = layer();
    const shine = (x, y, u, v) => { const k = 0.6 - u * 0.32 - v * 0.42 + (((x + y * 2) % 5 === 0) ? 0.08 : 0); return Hr[k > 0.86 ? 3 : k > 0.42 ? 2 : k > 0.05 ? 1 : 0]; };
    if (dir === 0) {
      l.ell(hx, hy - 1.6, 7.8, 6, (u, v, x, y) => { const fringe = v < 0.08 + (Math.abs(u) > 0.66 ? 0.75 : 0) + ((x + (style === 'spiky' ? 1 : 0)) % 3 === 0 ? 0.18 : 0) - (Math.abs(u) < 0.15 ? 0.06 : 0); return fringe ? shine(x, y, u, v) : null; });
      if (style === 'long' || style === 'pony' && 0) { for (let y = hy; y < hy + 9; y++) { l.set(hx - 8, y, Hr[2]); l.set(hx - 7, y, Hr[1]); l.set(hx + 7, y, Hr[1]); l.set(hx + 8, y, Hr[0]); } }
    } else if (dir === 2) {
      l.ell(hx, hy - 1, 7.8, 6.6, (u, v, x, y) => shine(x, y, u, v));
      l.ell(hx, hy + 3, 6.6, 3.2, (u, v, x, y) => Hr[v > 0.3 ? 1 : 2]);
      if (style === 'long') for (let y = hy + 3; y < hy + 11; y++) for (let x = hx - 6; x <= hx + 6; x++) l.set(x, y, (x + y) % 5 === 0 ? Hr[1] : x < hx - 2 ? Hr[3] : Hr[2]);
      if (style === 'pony') for (let y = hy + 4; y < hy + 12; y++) { l.set(hx - 1, y, Hr[2]); l.set(hx, y, Hr[2]); l.set(hx + 1, y, Hr[1]); }
    } else {
      l.ell(hx - 0.8, hy - 1.4, 7.0, 6.1, (u, v, x, y) => (u < -0.1 - v * 0.35 || v < -0.3) ? shine(x, y, u, v) : null);
      for (let k = 0; k < 3; k++) l.set(hx + 2 + k, hy - 4 + (k === 2 ? 1 : 0), Hr[2]); // fringe tips
      if (style === 'long') for (let y = hy; y < hy + 9; y++) { l.set(hx - 6, y, Hr[2]); l.set(hx - 5, y, Hr[1]); l.set(hx - 7, y, Hr[1]); }
      if (style === 'pony') { for (let y = hy - 1; y < hy + 6; y++) { l.set(hx - 8 - (y > hy + 2 ? 1 : 0), y, Hr[2]); l.set(hx - 7 - (y > hy + 2 ? 1 : 0), y, Hr[1]); } l.set(hx - 6, hy - 1, Ss[2]); }
    }
    if (style === 'bun') { const bx = dir === 1 ? hx - 5 : hx; l.ell(bx, hy - 8, 3.2, 2.8, (u, v) => Hr[v < -0.3 ? 3 : u > 0.4 ? 1 : 2]); l.set(bx + 2, hy - 7, Ss[3]); }
    if (style === 'spiky') for (let k = -2; k <= 2; k++) { const x = hx + k * 3 - (dir === 1 ? 1 : 0); l.set(x, hy - 8, Hr[3]); l.set(x, hy - 9, Hr[2]); l.set(x + 1, hy - 8, Hr[2]); }
    if (L.beard && dir !== 2) { const bx = dir === 1 ? hx + 1 : hx - 3; for (let i = 0; i < (dir === 1 ? 4 : 7); i++) { l.set(bx + i, hy + 4, Hr[1]); if (i > 0 && i < (dir === 1 ? 3 : 6)) l.set(bx + i, hy + 5, Hr[0]); } }
    stamp(s, l, hairOut); }
  // ---------------- face ----------------
  if (dir !== 2) {
    const ey = hy + 1, iris = L.eyes || 0x3a2a54;
    const eye = (x) => {
      if (Z) { s.set(x, ey, 0x140808); s.set(x + 1, ey, 0x140808); s.set(x, ey + 1, 0xff4a3a); s.set(x + 1, ey + 1, 0x8a1a1a); return; }
      if (f.blink) { s.set(x, ey + 1, OUT); s.set(x + 1, ey + 1, OUT); return; }
      s.set(x, ey - 1, OUT); s.set(x + 1, ey - 1, OUT);
      s.set(x, ey, 0xffffff); s.set(x + 1, ey, OUT);
      s.set(x, ey + 1, iris); s.set(x + 1, ey + 1, mul(iris, 0.6));
      if (L.lash) s.set(x + (dir === 1 ? 2 : (x < hx ? -1 : 2)), ey - 1, OUT);
    };
    const blush = mix(L.skin, 0xff6a80, Z ? 0 : 0.5);
    if (dir === 0) { eye(hx - 4); eye(hx + 3); s.set(hx - 5, ey + 3, blush); s.set(hx - 4, ey + 3, blush); s.set(hx + 4, ey + 3, blush); s.set(hx + 5, ey + 3, blush);
      s.set(hx, ey + 3, Z ? 0x3a1a1a : mix(L.skin, 0x9a3a3a, 0.45)); if (Z) { s.set(hx - 1, ey + 3, 0x3a1a1a); s.set(hx + 1, ey + 3, 0x3a1a1a); } }
    else { eye(hx + 3); s.set(hx + 3, ey + 3, blush); s.set(hx + 4, ey + 3, blush); s.set(hx + 5, ey + 3, Z ? 0x3a1a1a : mix(L.skin, 0x9a3a3a, 0.45)); }
  }
  // ---------------- headgear ----------------
  if (L.hat) { const l = layer(), hc = R4(L.hatColor || 0xd8b850);
    if (L.hat === 'kasa') { l.poly([[hx - 11, hy - 1], [hx + 11, hy - 1], [hx + 3, hy - 9], [hx - 3, hy - 9]], (x, y) => y > hy - 3 ? hc[1] : (x + y * 2) % 4 === 0 ? hc[1] : x < hx - 2 ? hc[3] : hc[2]); for (let x = hx - 10; x <= hx + 10; x++) l.set(x, hy - 1, hc[0]); }
    else if (L.hat === 'helm') { l.ell(hx, hy - 3.5, 7.6, 4.8, (u, v) => v > 0.5 ? null : v < -0.45 ? hc[3] : u > 0.45 ? hc[1] : hc[2]);
      for (let x = hx - 9; x <= hx + 9; x++) { l.set(x, hy - 2, hc[3]); l.set(x, hy - 1, hc[1]); }
      if (dir !== 2) { l.rect(hx - 10, hy - 1, 2, 4, hc[1]); l.rect(hx + 8, hy - 1, 2, 4, hc[1]); }
      if (L.crest != null) { const C = R4(L.crest); l.set(hx, hy - 9, C[3]); l.set(hx - 1, hy - 10, C[2]); l.set(hx + 1, hy - 10, C[2]); l.set(hx - 2, hy - 11, C[3]); l.set(hx + 2, hy - 11, C[3]); l.set(hx, hy - 8, C[1]); } }
    else if (L.hat === 'hood') l.ell(hx, hy - 1, 8.2, 7.2, (u, v) => (dir === 0 && v > -0.38 && Math.abs(u) < 0.64) ? null : (dir === 1 && u > 0.28 && v > -0.42) ? null : hc[u > 0.45 ? 1 : v < -0.45 ? 3 : 2]);
    else if (L.hat === 'crown') { l.rect(hx - 4, hy - 9, 8, 3, (x, y) => y === hy - 9 && (x - hx) % 2 ? null : 0xe8c040); l.set(hx, hy - 8, 0xd8302a); }
    else if (L.hat === 'band') { for (let x = hx - 7; x <= hx + 7; x++) { l.set(x, hy - 4, hc[3]); l.set(x, hy - 3, hc[2]); } if (dir !== 0) { const kx = dir === 1 ? hx - 7 : hx; l.set(kx, hy - 2, hc[2]); l.set(kx - 1, hy - 1, hc[1]); l.set(kx + 1, hy - 1, hc[1]); } }
    else if (L.hat === 'eboshi') { l.rect(hx - 3, hy - 13, 6, 8, (x, y) => x === hx + 2 ? 0x101014 : y === hy - 13 ? 0x3a3a46 : 0x24242c); }
    stamp(s, l, mul(L.hatColor || 0x404040, 0.35)); }
  s.hand = hand; return s;
}

// animation tables
const WALK_F = [{ la: 1, lb: 0, sa: -1, sb: 1, bob: 0 }, { bob: -1 }, { la: 0, lb: 1, sa: 1, sb: -1, bob: 0 }, { bob: -1 }];
const WALK_S = [{ stride: 2, sa: -2, bob: 0 }, { stride: 0, sa: 0, bob: -1 }, { stride: -2, sa: 2, bob: 0 }, { stride: 0, sa: 0, bob: -1 }];
const IDLE = [{ bob: 0 }, { bob: 0 }, { bob: 1 }, { bob: 0, blink: 1 }];
const ACT = [{ sa: -2, sb: -1, bob: 0 }, { sa: 1, bob: 0 }, { sa: 2, bob: 1 }];
const cache = new Map();
export function lookKey(L) { return JSON.stringify(L); }
export function bakeChar(L) {
  const k = lookKey(L); if (cache.has(k)) return cache.get(k);
  L.seed = L.seed || 1;
  const res = { 0: {}, 1: {}, 2: {}, 3: {} };
  for (const dir of [0, 1, 2]) for (const [name, set] of [['idle', IDLE], ['walk', dir === 1 ? WALK_S : WALK_F], ['act', ACT]]) {
    const sp = set.map(f => drawChar(L, dir, Object.assign({}, f, L.zombie && name === 'walk' && dir !== 1 ? { sa: 0, sb: 0 } : {})));
    res[dir][name] = sp.map(x => x.canvas()); res[dir][name + 'H'] = sp.map(x => x.hand);
    if (dir === 1) { res[3][name] = res[1][name].map(cv => flip(cv)); res[3][name + 'H'] = sp.map(x => [FW - x.hand[0], x.hand[1]]); }
  }
  cache.set(k, res); return res;
}
function flip(cv) { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const x = c.getContext('2d'); x.scale(-1, 1); x.drawImage(cv, -cv.width, 0); return c; }

const PANTS = [0x5a6488, 0x7a5a44, 0x4a6a8a, 0x6a5a7a, 0x5a7a5a, 0x8a7a6a];
export function villagerLook(seed, extra = {}) {
  const r = mulberry32(seed), p = a => a[Math.floor(r() * a.length)];
  return Object.assign({ seed, skin: p(SKINS), hair: p(HAIRS.slice(0, 7)), hairStyle: p(['short', 'long', 'bun', 'pony', 'short', 'spiky']), shirt: p(SHIRTS), pants: p(PANTS), shoes: 0x6b4428, sash: p([0x2a2a46, 0xc8423a, 0xe8c040, 0x3a6a3a, 0xe87a9a]),
    hat: r() < 0.3 ? 'kasa' : r() < 0.2 ? 'band' : null, hatColor: p([0xd8b850, 0xc8a050, 0xe8433a, 0x3a6fc8]), beard: r() < 0.15, lash: r() < 0.5 }, extra);
}
export function soldierLook(seed, color, archer) {
  const r = mulberry32(seed);
  return { seed, skin: SKINS[Math.floor(r() * 4)], hair: HAIRS[Math.floor(r() * 5)], hairStyle: 'short', shirt: mul(color, 0.9), pants: 0x4a4a5a, shoes: 0x4a3426, sash: 0x2a2a36,
    armor: archer ? null : 0x9a9aa8, hat: archer ? 'hood' : 'helm', hatColor: archer ? mul(color, 0.75) : 0x8a8a98, crest: color };
}
export function zombieLook(seed, kind = 0) {
  const r = mulberry32(seed + 999);
  const skins = [0x8ab07a, 0x9ab89a, 0x7a9a6a, 0xa8b08a];
  return { seed, zombie: 1, skin: kind === 2 ? 0x7a8a9a : skins[Math.floor(r() * skins.length)], hair: [0x2c2430, 0x4e3224, 0x5a5a4a][Math.floor(r() * 3)], hairStyle: ['short', 'spiky', 'long', 'bald'][Math.floor(r() * 4)],
    shirt: mul([0x6a7a9a, 0x9a6a5a, 0x7a7a6a, 0x5a6a5a][Math.floor(r() * 4)], 0.85), pants: 0x5a5058, shoes: 0x3a3234, sash: 0x3a3a3a, hat: kind === 2 ? 'helm' : null, hatColor: 0x5a5a62 };
}
export function playerLook(o) {
  return { seed: 7, skin: SKINS[o.skin | 0], hair: HAIRS[o.hair | 0], hairStyle: o.style || 'short', shirt: SHIRTS[o.shirt | 0], pants: 0x6a7090, shoes: 0x7a5034, sash: 0x2a2a46, hat: o.hat || 'band', hatColor: 0xd8302a, lash: true };
}
