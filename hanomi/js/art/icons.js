// Hanomi — 16x16 item icons.
import { Spr, mix, mul } from '../pix.js';
import { mulberry32, clamp } from '../util.js';
import { S as NS } from './nature.js';
import { S as SS } from './structures.js';

const r3 = c => [mul(c, 0.66), c, mix(c, 0xfff6dc, 0.35)];
const OUT = 0x221820;
export const ICON = {};
const fin = (s, o = OUT) => { s.outline(o); return s; };
const handle = (s, x0, y0, x1, y1) => s.stroke(x0, y0, x1, y1, 2, 2, t => t < 0.5 ? 0x8a5a34 : 0x6b4428);
function blob(s, cx, cy, rx, ry, c, light = 0.6) { const R = r3(c); s.ell(cx, cy, rx, ry, (u, v) => R[(0.4 - u * 0.4 - v * 0.6) > light ? 2 : (0.4 - u * 0.4 - v * 0.6) > -0.1 ? 1 : 0]); }

const P = {
  wood: s => { s.ell(8, 10, 6.5, 3.6, (u, v) => r3(0x8a5a34)[v < 0 ? 2 : 1]); s.rect(2, 6, 12, 4, (x, y) => y === 6 ? 0xb07c48 : 0x8a5a34); s.ell(13, 8, 2.2, 3.4, (u, v) => (u * u + v * v < 0.35) ? 0xc8945a : 0xe8c08a); },
  stick: s => { s.stroke(3, 13, 13, 3, 2, 1.5, 0x8a5a34); s.set(8, 7, 0x6b4428); s.set(10, 8, 0x5a8a3a); },
  stone: s => blob(s, 8, 9, 6, 4.8, 0x8e8983),
  flint: s => { s.poly([[4, 12], [8, 3], [13, 9], [9, 13]], (x, y) => x + y < 15 ? 0x6a6a7a : 0x3a3a4a); s.line(7, 6, 10, 10, 0x9a9aaa); },
  fiber: s => { for (let k = 0; k < 5; k++) s.line(4 + k * 2, 14, 6 + k, 3 + (k % 2) * 2, [0x4a8a3a, 0x6aaa4a, 0x3a7a32][k % 3]); },
  rope: s => { for (let k = 0; k < 3; k++) s.ell(8, 8 + k * 0.5, 6 - k * 1.6, 5 - k * 1.3, (u, v) => (u * u + v * v > 0.55) ? (v < 0 ? 0xe0c08a : 0xb8945a) : null); },
  coal: s => blob(s, 8, 9, 5.5, 4.6, 0x3a3436),
  iron_ore: s => { blob(s, 8, 9, 6, 5, 0x8e8983); for (const [x, y] of [[6, 7], [10, 9], [7, 11]]) { s.set(x, y, 0xe8b88a); s.set(x + 1, y, 0xc88a5a); } },
  gold_ore: s => { blob(s, 8, 9, 6, 5, 0x8e8983); for (const [x, y] of [[6, 7], [10, 9], [7, 11]]) { s.set(x, y, 0xfff08a); s.set(x + 1, y, 0xf2c23a); } },
  iron: s => ingot(s, 0xb8bcc8), gold: s => ingot(s, 0xf2c23a),
  jade: s => { s.poly([[8, 2], [13, 7], [8, 14], [3, 7]], (x, y) => x < 8 ? (y < 7 ? 0xb0ffe0 : 0x3ad8a0) : (y < 7 ? 0x3ad8a0 : 0x1a7a5a)); s.set(7, 5, 0xffffff); },
  leather: s => { s.poly([[3, 4], [13, 3], [12, 13], [4, 12]], (x, y) => ((x + y) % 5 ? 0xa86a3a : 0x8a5228)); },
  wool: s => { for (const [x, y] of [[6, 7], [10, 7], [8, 10], [5, 10], [11, 10]]) blob(s, x, y, 3, 2.6, 0xf2eee6, 0.3); },
  feather: s => { s.line(4, 13, 12, 3, 0xe8e0d0); for (let k = 0; k < 7; k++) { s.line(5 + k, 11 - k, 3 + k, 9 - k, 0xf6f2ea); s.line(5 + k, 11 - k, 7 + k, 12 - k, 0xd8d0c0); } },
  bone: s => { s.stroke(4, 12, 12, 4, 2.4, 2.4, 0xf2ecd8); for (const [x, y] of [[3, 11], [5, 13], [11, 3], [13, 5]]) s.ell(x, y, 1.6, 1.6, 0xf2ecd8); },
  petals: s => { for (const [x, y, c] of [[5, 6, 0xf6b8ca], [10, 5, 0xffd8e4], [8, 10, 0xea98b0], [12, 11, 0xf6b8ca]]) s.ell(x, y, 2.4, 1.6, c); },
  flower: s => { s.line(8, 14, 8, 8, 0x3a7a3a); s.set(7, 11, 0x5a9a4a); for (const [x, y] of [[8, 4], [5, 6], [11, 6], [6, 8], [10, 8]]) s.ell(x, y, 1.8, 1.8, 0x9cc8f4); s.set(8, 6, 0xf2c24a); },
  lotus: s => { s.ell(8, 11, 6, 2.5, 0x4a9a48); for (const [x, y] of [[8, 5], [5, 7], [11, 7]]) s.ell(x, y, 2, 3, 0xf6b8ca); s.set(8, 8, 0xfff2a0); },
  egg: s => blob(s, 8, 9, 4, 5.2, 0xf2e8d2),
  wheat: s => { for (let k = 0; k < 3; k++) { s.line(5 + k * 3, 14, 6 + k * 2, 4, 0xc89a3a); s.ell(6 + k * 2, 5, 1.4, 2.5, 0xf2d06a); } s.rect(5, 10, 7, 1, 0x8a6a2a); },
  rice: s => { s.ell(8, 10, 6, 4, (u, v) => v < -0.2 ? 0xf6f2e6 : 0x8a5a34); s.rect(2, 9, 12, 2, 0x6b4428); s.set(7, 7, 0xffffff); },
  rotten: s => blob(s, 8, 9, 5, 4, 0x7a8a4a),
  berries: s => { for (const [x, y] of [[6, 9], [10, 9], [8, 6], [8, 11]]) blob(s, x, y, 2.4, 2.4, 0x8a2a5a, 0.2); s.set(9, 3, 0x3a7a3a); s.set(10, 2, 0x3a7a3a); },
  apple: s => { blob(s, 8, 9, 5.5, 5, 0xd8302a); s.line(8, 4, 9, 2, 0x5a3820); s.ell(11, 3, 2, 1.2, 0x4a9a3a); },
  carrot: s => { s.poly([[4, 7], [10, 5], [13, 14]], (x, y) => x < 9 ? 0xffa04a : 0xe8702a); s.line(4, 6, 3, 2, 0x4a9a3a); s.line(5, 5, 6, 1, 0x6ab84a); s.line(4, 6, 1, 4, 0x3a7a32); },
  tomato: s => { blob(s, 8, 9, 5.5, 4.8, 0xe03a2a); s.rect(6, 4, 5, 1, 0x3a8a3a); s.set(8, 3, 0x3a8a3a); },
  pumpkin: s => { blob(s, 8, 9, 6.5, 5, 0xf07a22); s.line(8, 5, 8, 13, 0xc85a1a); s.line(5, 6, 5, 12, 0xc85a1a); s.line(11, 6, 11, 12, 0xc85a1a); s.rect(7, 2, 2, 3, 0x5a4a2a); },
  mushroom: s => { s.rect(7, 8, 3, 6, 0xece2cc); blob(s, 8, 7, 6, 3.6, 0xd8403a); s.set(6, 5, 0xffffff); s.set(10, 6, 0xffffff); },
  milk: s => { s.rect(5, 5, 6, 9, (x, y) => y < 8 ? 0xd8e8f0 : (x < 7 ? 0xffffff : 0xe8eef2)); s.rect(6, 2, 4, 3, 0xb8c8d8); s.rect(5, 9, 6, 2, 0x5a8ad8); },
  raw_meat: s => { s.ell(8, 9, 6, 4.5, (u, v) => v < -0.3 ? 0xff8a8a : (u * u + v * v < 0.2 ? 0xf2d8d8 : 0xd84a5a)); s.rect(12, 4, 2, 4, 0xf2ecd8); },
  cooked_meat: s => { s.ell(8, 9, 6, 4.5, (u, v) => v < -0.3 ? 0xc8784a : (u * u + v * v < 0.2 ? 0xe8b080 : 0x8a4a2a)); s.rect(12, 4, 2, 4, 0xf2ecd8); s.line(4, 9, 11, 9, 0x5a2a1a); },
  raw_fish: s => fish(s, 0x7a9ab8), cooked_fish: s => { fish(s, 0xb8784a); s.line(1, 14, 14, 1, 0x8a5a34); },
  fish_carp: s => fish(s, 0x9a8a5a), fish_trout: s => fish(s, 0x8aa86a, 0xf08a8a), fish_salmon: s => fish(s, 0xe88a6a), fish_catfish: s => fish(s, 0x6a6a5a),
  fish_eel: s => { s.stroke(2, 10, 6, 6, 3, 3, 0x4a5a3a); s.stroke(6, 6, 10, 11, 3, 3, 0x5a6a42); s.stroke(10, 11, 14, 5, 3, 2, 0x4a5a3a); s.set(13, 5, 0x1a1414); },
  fish_golden: s => fish(s, 0xf2c23a, 0xffffff),
  bread: s => { s.ell(8, 9, 6.5, 4, (u, v) => v < -0.2 ? 0xe8a85a : 0xc8783a); for (let k = 0; k < 3; k++) s.line(5 + k * 3, 7, 6 + k * 3, 9, 0xf2d8a0); },
  onigiri: s => { s.poly([[8, 2], [14, 13], [2, 13]], (x, y) => y > 9 && x > 5 && x < 11 ? 0x1e2a1e : (y < 6 ? 0xffffff : 0xf2f0ea)); },
  stew: s => { s.ell(8, 9, 6.5, 3, 0xc8783a); s.set(6, 8, 0xf07a22); s.set(10, 9, 0xe8dcc0); s.ell(8, 12, 6, 3, (u, v) => v > 0 ? 0x6b4428 : 0x8a5a34); s.rect(2, 9, 12, 1, 0x8a5a34); },
  sushi: s => { s.ell(8, 11, 6, 2.8, 0xf6f2e6); s.ell(8, 8, 6, 2.4, (u, v) => (u * 3 | 0) % 2 ? 0xf08a6a : 0xffb090); s.rect(7, 7, 2, 6, 0x1e2a1e); },
  pie: s => { s.ell(8, 10, 7, 3.6, (u, v) => v < 0 ? 0xf07a22 : 0xc8945a); s.ell(8, 9, 5, 2, 0xffa04a); s.rect(1, 10, 14, 2, 0xc8945a); },
  mochi: s => { s.line(8, 2, 8, 14, 0xc8a070); for (const [y, c] of [[4, 0xf6b8ca], [8, 0xffffff], [12, 0x9ccc6a]]) blob(s, 8, y, 3, 2.2, c, 0.3); },
  wheat_seeds: s => seeds(s, 0xd8b850), tomato_seeds: s => seeds(s, 0xf2e2a8), pumpkin_seeds: s => seeds(s, 0xf2ead2), rice_seeds: s => { seeds(s, 0x9ad86a); },
  acorn: s => { blob(s, 8, 10, 4, 4, 0xa8743a); s.ell(8, 6.5, 4.6, 2.2, 0x6b4428); s.set(8, 3, 0x5a3820); },
  pinecone: s => { blob(s, 8, 9, 4, 5.5, 0x8a5a34); for (let y = 5; y < 14; y += 2) s.line(5, y, 11, y, 0x5a3820); },
  sakura_sapling: s => { s.line(8, 14, 8, 7, 0x5a3820); blob(s, 8, 5, 4, 3, 0xf6b8ca, 0.3); s.ell(8, 14, 4, 1.5, 0x8a5a34); },
  sapling: s => { s.line(8, 14, 8, 7, 0x6b4428); blob(s, 8, 5, 4, 3, 0x5ea24a, 0.3); s.ell(8, 14, 4, 1.5, 0x8a5a34); },
  axe_wood: s => axe(s, 0xb07c48), axe_stone: s => axe(s, 0x8e8983), axe_iron: s => axe(s, 0xc8ccd8),
  pick_wood: s => pick(s, 0xb07c48), pick_stone: s => pick(s, 0x8e8983), pick_iron: s => pick(s, 0xc8ccd8),
  hoe_wood: s => hoe(s, 0xb07c48), hoe_iron: s => hoe(s, 0xc8ccd8),
  sword_wood: s => sword(s, 0xc8945a), sword_stone: s => sword(s, 0x9a958e), sword_iron: s => sword(s, 0xd8dce8),
  katana: s => { s.line(3, 13, 13, 2, 0xe8f6f2); s.line(4, 13, 14, 2, 0x8ad8c0); s.line(13, 2, 14, 1, 0xffffff); s.rect(4, 10, 3, 3, 0xe8c040); s.stroke(1, 15, 4, 12, 2, 2, 0x1e2a3a); },
  spear: s => { s.line(2, 14, 11, 5, 0x8a5a34); s.line(3, 14, 12, 5, 0x6b4428); s.poly([[10, 4], [14, 1], [13, 6]], 0xc8ccd8); s.set(13, 2, 0xffffff); },
  bow: s => { for (let a = -1.2; a <= 1.2; a += 0.08) { const x = 6 + Math.cos(a) * 7, y = 8 + Math.sin(a) * 7; s.set(x, y, 0x8a5a34); s.set(x - 1, y, 0x6b4428); } s.line(7, 1, 7, 15, 0xe8e0d0); },
  arrow: s => { s.line(3, 13, 12, 4, 0xb07c48); s.poly([[11, 3], [14, 2], [13, 5]], 0xc8ccd8); s.line(2, 12, 4, 14, 0xf2f2f2); s.line(3, 11, 5, 13, 0xd84a4a); },
  rod: s => { s.line(2, 14, 13, 2, 0x8a5a34); s.line(13, 2, 14, 10, 0xe8e8f0); s.ell(14, 11, 1.4, 1.4, 0xe03a2a); s.ell(4, 12, 1.8, 1.8, 0x5a5a62); },
  can: s => { s.rect(3, 6, 8, 7, (x, y) => x < 5 ? 0x9ab8d8 : 0x6a8ab8); s.line(11, 8, 14, 5, 0x6a8ab8); s.rect(5, 3, 4, 3, 0x4a6a98); },
  shears: s => { s.line(4, 12, 12, 4, 0xd8dce8); s.line(4, 4, 12, 12, 0xb8bcc8); s.ell(4, 12, 2, 2, 0xd84a4a); s.ell(4, 4, 2, 2, 0xd84a4a); },
  bucket: s => { s.poly([[3, 5], [13, 5], [11, 14], [5, 14]], (x) => x < 7 ? 0xd8dce8 : 0xa8acb8); s.line(3, 5, 8, 1, 0x6a6a72); s.line(8, 1, 13, 5, 0x6a6a72); },
  armor_leather: s => armor(s, 0xa86a3a), armor_iron: s => { armor(s, 0x8a8a98); s.rect(4, 6, 8, 1, 0xc8423a); s.rect(4, 9, 8, 1, 0xc8423a); },
  dog_treat: s => { s.stroke(4, 8, 12, 8, 3, 3, 0xc89458); for (const [x, y] of [[3, 6], [3, 10], [13, 6], [13, 10]]) s.ell(x, y, 1.8, 1.8, 0xc89458); s.set(8, 7, 0xe8b880); },
  wood_wall: s => block(s, 0x9e6c44, 0x6b4428), stone_wall: s => block(s, 0xaaaaae, 0x6a6a72),
  wood_floor: s => { s.rect(1, 4, 14, 9, (x, y) => (y % 3 === 0 || (x + (y > 6 ? 4 : 0)) % 8 === 0) ? 0x6b4428 : 0xa06d44); },
  cobble: s => { s.rect(1, 4, 14, 9, 0x6f7378); for (const [x, y] of [[4, 6], [10, 6], [7, 10], [13, 10], [2, 10]]) s.ell(x, y, 2.4, 1.6, 0xa1a5a8); },
};
function ingot(s, c) { const R = r3(c); s.poly([[2, 11], [14, 11], [12, 6], [4, 6]], (x, y) => y < 8 ? R[2] : R[1]); s.rect(2, 11, 12, 2, R[0]); }
function fish(s, c, fin2) { const R = r3(c); s.ell(7, 8, 5.5, 3.2, (u, v) => R[v < -0.3 ? 2 : v > 0.4 ? 0 : 1]); s.poly([[11, 8], [15, 4], [15, 12]], R[0]); s.set(4, 7, 0x1a1414); if (fin2) s.line(6, 5, 9, 5, fin2); }
function seeds(s, c) { s.poly([[3, 4], [13, 4], [13, 14], [3, 14]], (x, y) => y < 6 ? 0xc8a070 : 0xe8d8b0); for (const [x, y] of [[6, 9], [9, 8], [7, 11], [10, 11]]) { s.set(x, y, c); s.set(x + 1, y, mul(c, 0.7)); } s.rect(3, 6, 10, 1, 0x8a5a34); }
function axe(s, c) { handle(s, 4, 14, 10, 3); const R = r3(c); s.poly([[8, 2], [14, 4], [13, 9], [9, 6]], (x, y) => x + y < 13 ? R[2] : R[1]); }
function pick(s, c) { handle(s, 4, 14, 9, 5); const R = r3(c); for (let a = -1; a <= 1; a += 0.1) { const x = 9 + a * 6, y = 4 + a * a * 2.5 - 1; s.ell(x, y, 1.3, 1.3, a < 0 ? R[2] : R[1]); } }
function hoe(s, c) { handle(s, 3, 14, 11, 3); const R = r3(c); s.rect(9, 2, 6, 3, (x, y) => y === 2 ? R[2] : R[1]); s.rect(13, 5, 2, 2, R[0]); }
function sword(s, c) { const R = r3(c); s.stroke(4, 12, 13, 3, 2.6, 2, t => R[1]); s.line(5, 11, 13, 3, R[2]); s.line(3, 9, 7, 13, 0x8a6a2a); s.stroke(1, 15, 4, 12, 2, 2, 0x5a3820); }
function armor(s, c) { const R = r3(c); s.poly([[3, 3], [6, 2], [8, 4], [10, 2], [13, 3], [12, 13], [4, 13]], (x, y) => x < 6 ? R[2] : x > 10 ? R[0] : R[1]); }
function block(s, top, face) { s.rect(2, 2, 12, 8, (x, y) => (x === 2 || y === 2) ? mix(top, 0xffffff, 0.2) : top); s.rect(2, 10, 12, 4, face); }

function fromSprite(spr) { // fit a world sprite into 16x16
  const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const k = Math.min(1, 15 / Math.max(spr.w, spr.h)), w = Math.max(1, Math.round(spr.w * k)), h = Math.max(1, Math.round(spr.h * k));
  x.drawImage(spr.cv, 0, 0, spr.w, spr.h, Math.round((16 - w) / 2), Math.round((16 - h) / 2), w, h); return c;
}
const FROM = { torch: 'torch0', campfire: 'fire0', chest: 'chest', bench: 'bench', furnace: 'furnace0', anvil: 'anvil', bed: 'bed', fence: 'fence10', gate: 'gate0', lantern: 'lantern', scarecrow: 'scarecrow', spikes: 'spikes', tower: 'tower', pot: 'pot0', barrel: 'barrel' };
export function bakeIcons(items) {
  for (const id in items) {
    if (FROM[id] && SS[FROM[id]]) { ICON[id] = fromSprite(SS[FROM[id]]); continue; }
    const s = new Spr(16, 16); (P[id] || (q => { q.rect(4, 4, 8, 8, 0xff00ff); }))(s); fin(s); ICON[id] = s.canvas();
  }
  return ICON;
}
