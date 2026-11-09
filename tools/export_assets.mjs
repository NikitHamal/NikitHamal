// Hanomi asset exporter: runs the ORIGINAL web game's art code (js/art/*.js, shared/pixel-dog.js) under Node with a tiny
// canvas shim and packs every static sprite into native/res/assets.bin (LZ4-style block compressed).
// Usage: sh tools/export.sh   (copies js/ + shared/ to a temp dir with "type":"module", then runs this file)
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const ROOT = path.resolve(process.argv[2] || '.'), OUT = process.argv[3] || 'native/res/assets.bin';

/* ---------- canvas / DOM shim (just enough for the art modules) ---------- */
class Ctx {
  constructor(cv) { this.cv = cv; this.sx = 1; this.fillStyle = '#000'; this.imageSmoothingEnabled = false; this.globalAlpha = 1; this.globalCompositeOperation = 'source-over'; }
  createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }
  putImageData(im) { this.cv._px = new Uint32Array(im.data.buffer.slice(0)); this.cv.width = im.width; this.cv.height = im.height; }
  _ensure() { if (!this.cv._px || this.cv._px.length !== this.cv.width * this.cv.height) this.cv._px = new Uint32Array(this.cv.width * this.cv.height); return this.cv._px; }
  scale(x) { this.sx *= x; } save() { } restore() { this.sx = 1; } translate() { } clearRect() { this._ensure().fill(0); } fillRect() { } setTransform() { }
  drawImage(src, ...a) {
    const d = this._ensure(), W = this.cv.width, H = this.cv.height, sp = src._px || new Uint32Array(src.width * src.height);
    let sx = 0, sy = 0, sw = src.width, sh = src.height, dx, dy, dw, dh;
    if (a.length === 2) { [dx, dy] = a; dw = sw; dh = sh; } else if (a.length === 4) { [dx, dy, dw, dh] = a; } else { [sx, sy, sw, sh, dx, dy, dw, dh] = a; }
    if (this.sx < 0) { dx = -dx - dw; }
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      const px = dx + x, py = dy + y; if (px < 0 || py < 0 || px >= W || py >= H) continue;
      let u = Math.floor((x + 0.5) * sw / dw); if (this.sx < 0) u = sw - 1 - u; const v = Math.floor((y + 0.5) * sh / dh);
      const c = sp[(sy + v) * src.width + sx + u]; if (c >>> 24) d[py * W + px] = c;
    }
  }
}
class Cv { constructor() { this.width = 300; this.height = 150; this._px = null; } getContext() { return this._cx || (this._cx = new Ctx(this)); } toDataURL() { return ''; } addEventListener() { } }
const noop = () => { };
globalThis.document = { createElement: () => new Cv(), documentElement: { style: { setProperty: noop } }, addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], fonts: { ready: Promise.resolve() }, hidden: false, body: {} };
globalThis.window = globalThis; globalThis.addEventListener = noop; globalThis.removeEventListener = noop; globalThis.devicePixelRatio = 1;
globalThis.requestAnimationFrame = noop; globalThis.cancelAnimationFrame = noop; globalThis.matchMedia = () => ({ matches: false, addEventListener: noop });
globalThis.IntersectionObserver = class { observe() { } disconnect() { } }; globalThis.ResizeObserver = globalThis.IntersectionObserver;
globalThis.HTMLElement = class { attachShadow() { return { appendChild: noop, innerHTML: '', querySelector: () => null }; } setAttribute() { } getAttribute() { return null; } };
globalThis.localStorage = { getItem: () => null, setItem: noop };
let DogCls = null; globalThis.customElements = { define: (n, c) => { DogCls = c; }, get: n => DogCls };
try { globalThis.navigator = { userAgent: 'node' }; } catch (e) { }
globalThis.innerWidth = 1280; globalThis.innerHeight = 720;

const J = p => import(pathToFileURL(path.join(ROOT, p)).href);
const { Spr, mix, mul } = await J('js/pix.js');
const NAT = await J('js/art/nature.js'), STR = await J('js/art/structures.js'), ICO = await J('js/art/icons.js'), ANI = await J('js/art/animals.js');
const { ITEMS } = await J('js/items.js'); const { NATION_COLORS } = await J('js/world.js');

/* ---------- collect ---------- */
const ents = [];
const add = (name, cv, o = {}) => ents.push({ name, w: cv.width, h: cv.height, ax: o.ax ?? 0, ay: o.ay ?? 0, shx: o.sh ? o.sh[0] : -1, shy: o.sh ? o.sh[1] : -1, lights: o.lights || [], px: cv._px, mask: o.mask || null });

NAT.bakeNature(); STR.bakeStructures();
for (const [k, s] of Object.entries(NAT.S)) add(k, s.cv, s);
const SKIP = /^(house_|banner_|stall_)/;
for (const [k, s] of Object.entries(STR.S)) { if (SKIP.test(k) || k === 'koipond' || !s.cv) continue; add(k, s.cv, s); }
ICO.bakeIcons(ITEMS); for (const [k, cv] of Object.entries(ICO.ICON)) add('icon:' + k, cv);
const COLS = [...NATION_COLORS, 0xe87a9a, 0xd8486a];
for (const c of COLS) { STR.bannerSprite(c); STR.stallSprite(c); for (let f = 0; f < 4; f++) { const s = STR.S['banner_' + c + '_' + f]; add(`banner:${c}:${f}`, s.cv, s); } const st = STR.S['stall_' + c]; add('stall:' + c, st.cv, st); }

// houses: colour-independent base + class mask (1 = nc, 2 = nc*0.7, 3 = nc lightened)
const houseKeys = []; for (const w of [4, 5, 6]) for (const h of [3, 4]) for (let st = 0; st < 4; st++) houseKeys.push([w, h, st, false]); houseKeys.push([8, 4, 2, true]);
const CA = 0x2a4a7a, CB = 0xe0902a, CC = 0x30c070;
const pk = h => ((255 << 24) | ((h & 255) << 16) | (h & 0xff00) | ((h >> 16) & 255)) >>> 0;
for (const [w, h, st, hall] of houseKeys) {
  const door = w >> 1, mk = c => STR.houseSprite(w, h, st, { hall, door, color: c });
  const a = mk(CA), b = mk(CB), c = mk(CC), pa = a.cv._px, pb = b.cv._px, pc = c.cv._px, mask = new Uint8Array(pa.length);
  const cand = col => [col, mul(col, 0.7), mix(col, 0xffffff, 0.25)].map(pk);
  const ca = cand(CA), cb = cand(CB), cc = cand(CC); let bad = 0;
  const cm = (col, f) => pk(mul(col, f)); const cA3 = [CA, mul(CA, 0.7), mix(CA, 0xffffff, 0.25)], cB3 = [CB, mul(CB, 0.7), mix(CB, 0xffffff, 0.25)], cC3 = [CC, mul(CC, 0.7), mix(CC, 0xffffff, 0.25)];
  for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) { let k = ca.indexOf(pa[i]);
    if (k >= 0 && cb[k] === pb[i] && cc[k] === pc[i]) { mask[i] = k + 1; continue; }
    k = -1; for (let q = 0; q < 3 && k < 0; q++) for (let f = 30; f <= 95; f++) if (cm(cA3[q], f / 100) === pa[i] && cm(cB3[q], f / 100) === pb[i] && cm(cC3[q], f / 100) === pc[i]) { k = q; globalThis.__f = f; break; }
    if (k < 0) { bad++; mask[i] = 1; } else mask[i] = 4 + k; }
  if (bad) console.warn('house mask mismatch', w, h, st, bad);
  add(`house:${w}:${h}:${st}:${hall ? 1 : 0}`, a.cv, { ax: a.ax, ay: a.ay, lights: a.lights, mask });
}

// animals (walk x6, idle x2) incl. shorn sheep
for (const kind of ANI.ANIMALS) for (const v of kind === 'sheep' ? ['', 'shorn'] : ['']) {
  const A = ANI.bakeAnimal(kind, v); A.walk.forEach((f, i) => add(`an:${kind}${v}:walk:${i}`, f.n)); A.idle.forEach((f, i) => add(`an:${kind}${v}:idle:${i}`, f.n));
}
// dogs (the portfolio's <pixel-dog> rig, halved by the game's own baker)
await J('shared/pixel-dog.js'); const DOG = await J('js/art/dog.js');
const BREEDS = ['bernese', 'shiba', 'husky', 'golden', 'collie', 'rottie', 'lab', 'wolf', 'shadow'];
const dogMeta = [];
for (const b of BREEDS) {
  const D = DOG.bakeDog(b); if (!D) { console.error('dog rig unavailable'); process.exit(1); }
  dogMeta.push([b, D.w, D.h, D.ox, D.oy]);
  for (const [pose, arr] of Object.entries(D.frames)) arr.forEach((f, i) => add(`dog:${b}:${pose}:${i}`, f.n, { ax: D.ox, ay: D.oy }));
}
// HUD glyphs + coin (copied from main.js)
{ const heart = v => { const s = new Spr(9, 9); const rows = ['.xx...xx.', 'xxxx.xxxx', 'xxxxxxxxx', 'xxxxxxxxx', '.xxxxxxx.', '..xxxxx..', '...xxx...', '....x....'];
    rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== 'x') return; const full = v === 2 || (v === 1 && x < 5); s.set(x, y, full ? (x < 3 && y < 3 && y > 0 ? 0xff9a9a : 0xe8384a) : 0x4a3038); })); s.set(1, 1, v ? 0xffd0d0 : 0x6a5058); s.outline(0x1e1014); return s; };
  const bowl = v => { const s = new Spr(9, 9); if (v) for (let x = 1; x < 8; x++) { const top = v === 2 ? 2 + Math.abs(x - 4) * 0.5 : 4; for (let y = Math.round(top); y < 5; y++) s.set(x, y, y === Math.round(top) ? 0xffffff : 0xece6da); }
    for (let x = 0; x < 9; x++) s.set(x, 5, 0x3a6ab8); for (let x = 1; x < 8; x++) s.set(x, 6, 0x2a4a90); for (let x = 2; x < 7; x++) s.set(x, 7, 0x2a4a90); s.set(0, 5, 0x6a9ae8);
    if (!v) for (let x = 1; x < 8; x++) s.set(x, 4, 0x4a3a40); s.outline(0x1e1014); return s; };
  for (const v of [0, 1, 2]) { add('hud:heart' + v, heart(v).canvas()); add('hud:bowl' + v, bowl(v).canvas()); }
  const coin = new Spr(16, 16); coin.ell(8, 8, 5.5, 5.5, (u, v) => (u * u + v * v > 0.55) ? (u + v < 0 ? 0xffe27a : 0xc8902a) : (u + v < -0.3 ? 0xfff2b0 : 0xf2c23a)); coin.rect(7, 6, 2, 4, 0xc8902a); coin.outline(0x5a3a10); add('icon:coin', coin.canvas()); }

/* ---------- pack ---------- */
const parts = []; const u16 = v => { const b = Buffer.alloc(2); b.writeUInt16LE(v & 0xffff); return b; }, i16 = v => { const b = Buffer.alloc(2); b.writeInt16LE(v); return b; }, u32 = v => { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); return b; };
parts.push(u32(0x48414e4f), u32(ents.length));
for (const e of ents) {
  const nm = Buffer.from(e.name); parts.push(u16(nm.length), nm, u16(e.w), u16(e.h), i16(e.ax), i16(e.ay), i16(e.shx), i16(e.shy), Buffer.from([e.lights.length, e.mask ? 1 : 0]));
  for (const L of e.lights) { parts.push(i16(L.x), i16(L.y), i16(L.w), i16(L.h), Buffer.from([L.lantern ? 1 : 0])); }
  const px = e.px || new Uint32Array(e.w * e.h); parts.push(Buffer.from(px.buffer, px.byteOffset, px.byteLength)); if (e.mask) parts.push(Buffer.from(e.mask));
}
parts.push(u16(dogMeta.length)); for (const [b, w, h, ox, oy] of dogMeta) { const nm = Buffer.from(b); parts.push(Buffer.from([nm.length]), nm, u16(w), u16(h), u16(ox), u16(oy)); }
const raw = Buffer.concat(parts);
function lz4(src) { // LZ4 block format (greedy, 64K window)
  const out = [], ht = new Int32Array(1 << 16).fill(-1); let i = 0, anchor = 0; const n = src.length;
  const lenBytes = (l) => { const a = []; while (l >= 255) { a.push(255); l -= 255; } a.push(l); return a; };
  const hash = p => (Math.imul(src.readUInt32LE(p), 2654435761) >>> 16) & 0xffff;
  while (i + 12 < n) {
    const h = hash(i), ref = ht[h]; ht[h] = i;
    if (ref >= 0 && i - ref < 65535 && src.readUInt32LE(ref) === src.readUInt32LE(i)) {
      let m = 4; while (i + m < n - 5 && src[ref + m] === src[i + m]) m++;
      const lit = i - anchor, tok = (Math.min(lit, 15) << 4) | Math.min(m - 4, 15); out.push(Buffer.from([tok]));
      if (lit >= 15) out.push(Buffer.from(lenBytes(lit - 15))); out.push(src.subarray(anchor, i)); out.push(Buffer.from([(i - ref) & 255, (i - ref) >> 8]));
      if (m - 4 >= 15) out.push(Buffer.from(lenBytes(m - 4 - 15))); i += m; anchor = i;
    } else i++;
  }
  const lit = n - anchor; out.push(Buffer.from([Math.min(lit, 15) << 4])); if (lit >= 15) out.push(Buffer.from(lenBytes(lit - 15))); out.push(src.subarray(anchor)); return Buffer.concat(out);
}
const comp = lz4(raw); fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([u32(raw.length), comp]));
console.log("outline factor", globalThis.__f); console.log(`exported ${ents.length} sprites, raw ${(raw.length / 1024) | 0} KB -> ${((comp.length + 4) / 1024) | 0} KB`);
