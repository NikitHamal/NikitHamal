// Hanomi — chibi characters (player, villagers, soldiers, zombies). 24x32 frames, feet at (12,30).
import { Spr, mix, mul } from '../pix.js';
import { hash2, hashStr, mulberry32, clamp } from '../util.js';

export const FW = 24, FH = 32, FX = 12, FY = 30;
export const SKINS = [0xf6d2b0, 0xe8b88e, 0xc8946a, 0x9a6844, 0x6e4a32];
export const HAIRS = [0x2a2028, 0x4a3022, 0x7a4a2a, 0xc88a3a, 0xe8d090, 0xb8402a, 0x8a8a96, 0x3a4a7a, 0xd88aa8];
export const SHIRTS = [0x3a6fc8, 0xc8423a, 0x2f9a6a, 0xd8a23a, 0x7a46b8, 0xe8e0d0, 0x3a3a46, 0xd86a8a, 0x5a8a9a];
const OUT = 0x24171c;
const ramp3 = c => [mul(c, 0.68), c, mix(c, 0xfff4d8, 0.28)];

function part(dst, w, h, paint, outline = OUT) { const p = new Spr(w, h); paint(p); p.outline(outline); dst.draw(p, 0, 0); }

// dir: 0 down, 1 right, 2 up.  anim frame params: bob, legA, legB (lift), armA, armB (swing), act (attack phase 0..3)
function drawChar(L, dir, fr) {
  const s = new Spr(FW, FH);
  const Sk = ramp3(L.skin), Hr = ramp3(L.hair), Sh = ramp3(L.shirt), Pn = ramp3(L.pants), Sb = ramp3(L.shoes);
  const Z = L.zombie, bob = fr.bob || 0, hy = 11 + bob + (Z ? 1 : 0), hx = 12 + (Z && dir === 1 ? 1 : 0);
  const armor = L.armor != null ? ramp3(L.armor) : null;
  // ---------- legs ----------
  const leg = (x, lift, fwd = 0) => part(s, FW, FH, p => {
    const top = 24 + bob, bot = 29 - lift; p.rect(x, top, 3, bot - top + 1, (xx) => xx === x ? Pn[2] : xx === x + 2 ? Pn[0] : Pn[1]);
    p.rect(x - (dir === 1 ? 0 : 0) + fwd, bot, dir === 1 ? 4 : 3, 2, (xx, yy) => yy === bot ? Sb[2] : Sb[1]);
  });
  if (dir === 1) { leg(10 + (fr.legB > 0 ? -1 : 0), fr.legB, -1); leg(12 + (fr.legA > 0 ? 1 : 0), fr.legA, 0); }
  else { leg(9, fr.legA); leg(13, fr.legB); }
  // ---------- back arm (side view) ----------
  const arm = (x, y, len, sw, zfwd) => part(s, FW, FH, p => {
    if (zfwd && dir === 1) { p.rect(x, y, 7, 3, (xx, yy) => yy === y ? (armor ? armor[2] : Sh[2]) : (armor ? armor[1] : Sh[1])); p.rect(x + 6, y, 2, 3, Sk[1]); return; }
    p.rect(x, y + sw, 3, len, (xx, yy) => yy - y - sw < 2 ? (armor ? armor[2] : Sh[2]) : (xx === x ? Sh[2] : Sh[1]));
    p.rect(x, y + sw + len, 3, 2, (xx) => xx === x ? Sk[2] : Sk[1]);
  });
  if (dir === 1) arm(10, 18 + bob, 5, -(fr.armA || 0), Z);
  // ---------- torso ----------
  part(s, FW, FH, p => {
    const x0 = dir === 1 ? 9 : 7, w = dir === 1 ? 7 : 10, y0 = 17 + bob, h = 8;
    p.rect(x0, y0, w, h, (x, y) => { const u = (x - x0) / w; let c = u < 0.25 ? Sh[2] : u > 0.78 ? Sh[0] : Sh[1]; if (armor && y < y0 + 5) c = u < 0.3 ? armor[2] : u > 0.75 ? armor[0] : armor[1]; return c; });
    // kimono collar / sash
    if (!armor && dir === 0) { p.line(x0 + 3, y0, x0 + 5, y0 + 3, mix(L.shirt, 0xffffff, 0.55)); p.line(x0 + 7, y0, x0 + 5, y0 + 3, Sh[0]); }
    if (dir !== 2) p.rect(x0, y0 + 5, w, 2, L.sash != null ? L.sash : mul(L.shirt, 0.5)); else p.rect(x0, y0 + 5, w, 2, L.sash != null ? L.sash : mul(L.shirt, 0.5));
    if (armor) for (let x = x0; x < x0 + w; x += 2) p.set(x, y0 + 4, armor[0]);
    if (Z) for (let k = 0; k < 4; k++) { const x = x0 + (hash2(k, L.seed, 1) * w | 0), y = y0 + (hash2(k, L.seed, 2) * 6 | 0); p.set(x, y, Sk[0]); p.set(x + 1, y, Sk[1]); }
  });
  // ---------- front arms ----------
  if (dir === 0 || dir === 2) {
    if (Z && dir === 0) { // arms reaching toward the camera
      part(s, FW, FH, p => { p.rect(6, 19 + bob, 3, 4, Sh[1]); p.rect(15, 19 + bob, 3, 4, Sh[1]); p.rect(6, 22 + bob, 3, 2, Sk[1]); p.rect(15, 22 + bob, 3, 2, Sk[1]); });
    } else {
      arm(5, 18 + bob, 4, fr.armA || 0, false); arm(16, 18 + bob, 4, fr.armB || 0, false);
    }
  }
  // ---------- head ----------
  part(s, FW, FH, p => {
    // neck shadow
    p.ell(hx, hy, dir === 1 ? 6.6 : 7.2, 6.4, (u, v) => { const l = 0.5 - u * 0.3 - v * 0.4; return Sk[l > 0.62 ? 2 : l > 0.15 ? 1 : 0]; });
    // ears
    if (dir === 1) p.set(hx - 2, hy + 1, Sk[0]);
    // hair
    const style = L.hairStyle || 'short';
    if (style !== 'bald') {
      p.ell(hx + (dir === 1 ? -1 : 0), hy - 1.5, dir === 1 ? 6.8 : 7.6, 5.8, (u, v, x, y) => {
        const fringe = dir === 0 ? (v < 0.05 + (Math.abs(u) > 0.62 ? 0.7 : 0) + ((x + (style === 'spiky' ? 0 : 1)) % 3 === 0 ? 0.12 : 0))
          : dir === 2 ? true : (u < -0.05 - v * 0.35 || v < -0.32);
        if (!fringe) return null;
        const l = 0.55 - u * 0.3 - v * 0.5; return Hr[l > 0.7 ? 2 : l > 0.2 ? 1 : 0];
      });
      if (dir === 2) p.ell(hx, hy + 2, 7, 4.5, (u, v) => Hr[v < -0.4 ? 2 : u > 0.5 ? 0 : 1]);
      if (style === 'long') { if (dir === 0) { p.rect(hx - 8, hy, 2, 8, Hr[1]); p.rect(hx + 6, hy, 2, 8, Hr[0]); } else if (dir === 2) p.rect(hx - 6, hy + 2, 12, 7, (x, y) => Hr[(x + y) % 4 ? 1 : 0]); else p.rect(hx - 6, hy, 3, 9, Hr[1]); }
      if (style === 'bun') { const bx = dir === 1 ? hx - 5 : hx; p.ell(bx, hy - 7, 3, 2.6, (u, v) => Hr[v < -0.2 ? 2 : 1]); }
      if (style === 'pony') { if (dir === 1) p.rect(hx - 8, hy - 2, 3, 7, Hr[1]); else if (dir === 2) p.rect(hx - 1, hy + 2, 3, 8, Hr[0]); }
      if (style === 'spiky') for (let k = -2; k <= 2; k++) { const x = hx + k * 3 - (dir === 1 ? 1 : 0); p.set(x, hy - 7, Hr[2]); p.set(x, hy - 8, Hr[1]); }
    }
    if (L.beard && dir !== 2) p.rect(dir === 1 ? hx + 1 : hx - 3, hy + 4, dir === 1 ? 4 : 7, 2, Hr[0]);
  });
  // ---------- face ----------
  if (dir !== 2) {
    const ey = hy + 1, eye = (x) => {
      if (Z) { s.set(x, ey, 0x1a0a0a); s.set(x, ey + 1, 0xd8302a); return; }
      if (fr.blink) { s.set(x, ey + 1, OUT); return; }
      s.set(x, ey, OUT); s.set(x, ey + 1, OUT); s.set(x, ey - (L.lash ? 1 : 0), OUT);
      s.set(x, ey, mix(0xffffff, L.eyes || 0x3a2a4a, 0.2));
    };
    if (dir === 0) { eye(hx - 3); eye(hx + 3); s.set(hx - 5, ey + 2, mix(L.skin, 0xff7a8a, Z ? 0 : 0.45)); s.set(hx + 5, ey + 2, mix(L.skin, 0xff7a8a, Z ? 0 : 0.45)); if (Z) s.rect(hx - 1, ey + 3, 3, 1, 0x3a1a1a); }
    else { eye(hx + 3); s.set(hx + 2, ey + 2, mix(L.skin, 0xff7a8a, Z ? 0 : 0.45)); if (Z) s.set(hx + 4, ey + 3, 0x3a1a1a); }
  }
  // ---------- headgear ----------
  if (L.hat) part(s, FW, FH, p => {
    const hc = ramp3(L.hatColor || 0xd8b850);
    if (L.hat === 'kasa') { p.poly([[hx - 11, hy - 1], [hx + 11, hy - 1], [hx + 2, hy - 9], [hx - 2, hy - 9]], (x, y) => y > hy - 3 ? hc[0] : (x + y) % 3 === 0 ? hc[0] : x < hx ? hc[2] : hc[1]); }
    else if (L.hat === 'helm') { p.ell(hx, hy - 3.5, 7.4, 4.6, (u, v) => v > 0.5 ? null : v < -0.4 ? hc[2] : u > 0.4 ? hc[0] : hc[1]); p.rect(hx - 8, hy - 2, 16, 2, (x, y) => y === hy - 2 ? hc[2] : hc[0]); if (dir !== 2) { p.rect(hx - 9, hy - 1, 2, 4, hc[0]); p.rect(hx + 7, hy - 1, 2, 4, hc[0]); } if (L.crest != null) { p.rect(hx - 1, hy - 10, 2, 3, L.crest); p.set(hx - 2, hy - 10, L.crest); p.set(hx + 1, hy - 10, L.crest); } }
    else if (L.hat === 'hood') { p.ell(hx, hy - 1, 8, 7, (u, v) => (dir === 0 && v > -0.35 && Math.abs(u) < 0.62) ? null : (dir === 1 && u > 0.3 && v > -0.4) ? null : hc[u > 0.4 ? 0 : v < -0.4 ? 2 : 1]); }
    else if (L.hat === 'crown') { p.rect(hx - 4, hy - 9, 8, 3, (x, y) => y === hy - 9 && (x - hx) % 2 ? null : 0xe8c040); p.set(hx, hy - 8, 0xd8302a); }
    else if (L.hat === 'band') { p.rect(hx - 7, hy - 4, 14, 2, hc[1]); if (dir === 2 || dir === 1) p.rect(hx - 7, hy - 3, 2, 4, hc[0]); }
    else if (L.hat === 'eboshi') { p.rect(hx - 3, hy - 12, 6, 7, (x, y) => x === hx + 2 ? 0x101014 : 0x24242c); }
  });
  return s;
}

const WALK = [{ legA: 0, legB: 1, armA: 1, armB: -1, bob: 0 }, { legA: 0, legB: 0, bob: -1 }, { legA: 1, legB: 0, armA: -1, armB: 1, bob: 0 }, { legA: 0, legB: 0, bob: -1 }];
const IDLE = [{ bob: 0 }, { bob: 0, blink: 0 }, { bob: 1 }, { bob: 0, blink: 1 }];
const ACT = [{ armA: -2, bob: 0 }, { armA: 1, bob: 0 }, { armA: 2, bob: 1 }];
const cache = new Map();
export function lookKey(L) { return JSON.stringify(L); }
export function bakeChar(L) {
  const k = lookKey(L); if (cache.has(k)) return cache.get(k);
  L.seed = L.seed || 1;
  const res = { 0: {}, 1: {}, 2: {}, 3: {} };
  for (const dir of [0, 1, 2]) for (const [name, set] of [['idle', IDLE], ['walk', WALK], ['act', ACT]]) {
    res[dir][name] = set.map(f => drawChar(L, dir, Object.assign({}, f, L.zombie && name === 'walk' ? { armA: 0, armB: 0 } : {})).canvas());
    if (dir === 1) res[3][name] = res[1][name].map(cv => flip(cv));
  }
  cache.set(k, res); return res;
}
function flip(cv) { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const x = c.getContext('2d'); x.scale(-1, 1); x.drawImage(cv, -cv.width, 0); return c; }

// look generators
export function villagerLook(seed, extra = {}) {
  const r = mulberry32(seed), p = a => a[Math.floor(r() * a.length)];
  return Object.assign({ seed, skin: p(SKINS), hair: p(HAIRS.slice(0, 7)), hairStyle: p(['short', 'long', 'bun', 'pony', 'short', 'spiky']), shirt: p(SHIRTS), pants: p([0x3a3a46, 0x4a3a2a, 0x2a3a5a, 0x5a4a3a]), shoes: 0x3a2418, sash: p([0x2a2a36, 0xc8423a, 0xe8c040, 0x3a5a2a]),
    hat: r() < 0.3 ? 'kasa' : r() < 0.2 ? 'band' : null, hatColor: p([0xd8b850, 0xc8a050, 0xe8433a, 0x3a6fc8]), beard: r() < 0.15, lash: r() < 0.5 }, extra);
}
export function soldierLook(seed, color, archer) {
  const r = mulberry32(seed);
  return { seed, skin: SKINS[Math.floor(r() * 4)], hair: HAIRS[Math.floor(r() * 5)], hairStyle: 'short', shirt: mul(color, 0.85), pants: 0x2a2a36, shoes: 0x241812, sash: 0x1e1e26,
    armor: archer ? null : 0x8a8a98, hat: archer ? 'hood' : 'helm', hatColor: archer ? mul(color, 0.7) : 0x7a7a88, crest: color };
}
export function zombieLook(seed, kind = 0) {
  const r = mulberry32(seed + 999);
  const skins = [0x7aa06a, 0x8aa88a, 0x6a8a5a, 0x9aa07a];
  return { seed, zombie: 1, skin: kind === 2 ? 0x6a7a8a : skins[Math.floor(r() * skins.length)], hair: [0x2a2028, 0x4a3022, 0x5a5a4a][Math.floor(r() * 3)], hairStyle: ['short', 'spiky', 'long', 'bald'][Math.floor(r() * 4)],
    shirt: mul([0x5a6a8a, 0x8a5a4a, 0x6a6a5a, 0x4a5a4a][Math.floor(r() * 4)], 0.8), pants: 0x3a3438, shoes: 0x2a2224, sash: 0x2a2a2a, hat: kind === 2 ? 'helm' : null, hatColor: 0x4a4a52 };
}
export function playerLook(o) {
  return { seed: 7, skin: SKINS[o.skin | 0], hair: HAIRS[o.hair | 0], hairStyle: o.style || 'short', shirt: SHIRTS[o.shirt | 0], pants: 0x2e3040, shoes: 0x3a2418, sash: 0x2a2a36, hat: o.hat || 'band', hatColor: 0xd8302a, lash: true };
}
