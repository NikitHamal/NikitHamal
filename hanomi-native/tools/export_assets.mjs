// Exports every pre-baked sprite of the ORIGINAL Hanomi web game (run in headless Chromium) into one PNG atlas + manifest.
// Usage (repo root): cd tools && npm i playwright && cd .. && node tools/export_assets.mjs
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import zlib from 'zlib';
const ROOT = path.resolve(process.cwd());
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); }).listen(8123);
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:8123/hanomi/index.html'); await page.waitForSelector('#loading.off', { state: 'attached', timeout: 20000 }); await page.waitForTimeout(800);
const out = await page.evaluate(async () => {
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
  const grab = cv => { const c = cv.getContext('2d'); const d = c.getImageData(0, 0, cv.width, cv.height); return { w: cv.width, h: cv.height, d: b64(new Uint8Array(d.data.buffer)) }; };
  const E = [];
  const add = (name, cv, extra = {}) => E.push(Object.assign({ name }, grab(cv), extra));
  const NS = (await import('/hanomi/js/art/nature.js')).S, SS = (await import('/hanomi/js/art/structures.js')).S;
  for (const k in NS) { const s = NS[k]; if (s && s.cv) add('n:' + k, s.cv, { ax: s.ax, ay: s.ay, sh: s.sh || [-1, -1] }); }
  for (const k in SS) { const s = SS[k]; if (s && s.cv && !k.startsWith('house_') && !k.startsWith('banner_') && !k.startsWith('stall_')) add('s:' + k, s.cv, { ax: s.ax, ay: s.ay, sh: s.sh || [-1, -1], lights: s.lights || [] }); }
  const IC = (await import('/hanomi/js/art/icons.js')).ICON; for (const k in IC) add('i:' + k, IC[k]);
  const cs = getComputedStyle(document.documentElement);
  for (const nm of ['heart', 'bowl']) for (let v = 0; v < 3; v++) { const m = /url\((.*)\)/.exec(cs.getPropertyValue('--' + nm + v).trim()); if (!m) continue;
    const im = new Image(); im.src = m[1].replace(/^["']|["']$/g, ''); await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); add('h:' + nm + v, c); }
  const AN = await import('/hanomi/js/art/animals.js');
  for (const kind of AN.ANIMALS) for (const variant of (kind === 'sheep' ? ['', 'shorn'] : [''])) { const a = AN.bakeAnimal(kind, variant); const tag = 'a:' + kind + (variant ? ':' + variant : '');
    a.walk.forEach((f, i) => add(tag + ':walk:' + i, f.n)); a.idle.forEach((f, i) => add(tag + ':idle:' + i, f.n)); }
  const DG = await import('/hanomi/js/art/dog.js'); const dogMeta = {};
  for (const br of ['bernese', 'shiba', 'husky', 'golden', 'collie', 'rottie', 'lab', 'wolf', 'shadow']) { const d = DG.bakeDog(br); if (!d) continue; dogMeta[br] = [d.w, d.h, d.ox, d.oy];
    for (const pose in d.frames) d.frames[pose].forEach((cv, i) => add('d:' + br + ':' + pose + ':' + i, cv.n || cv)); }
  return { E, animals: AN.ANIMALS, dogMeta };
});
await browser.close(); srv.close();
if (errs.length) console.log('page errors:', errs.slice(0, 5));
// shelf-pack
const items = out.E.map(e => ({ ...e, px: Buffer.from(e.d, 'base64') })); items.sort((a, b) => b.h - a.h || b.w - a.w);
const AW = 1024; let x = 0, y = 0, rowH = 0; for (const it of items) { if (x + it.w > AW) { x = 0; y += rowH + 1; rowH = 0; } it.x = x; it.y = y; x += it.w + 1; rowH = Math.max(rowH, it.h); }
const AH = Math.pow(2, Math.ceil(Math.log2(y + rowH))); const buf = Buffer.alloc(AW * AH * 4);
for (const it of items) for (let j = 0; j < it.h; j++) it.px.copy(buf, ((it.y + j) * AW + it.x) * 4, j * it.w * 4, (j + 1) * it.w * 4);
function crc32(b) { let c, t = crc32.t || (crc32.t = Array.from({ length: 256 }, (_, n) => { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; })); c = 0xffffffff; for (const v of b) c = t[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); }
const raw = Buffer.alloc((AW * 4 + 1) * AH); for (let j = 0; j < AH; j++) { raw[j * (AW * 4 + 1)] = 0; buf.copy(raw, j * (AW * 4 + 1) + 1, j * AW * 4, (j + 1) * AW * 4); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(AW, 0); ihdr.writeUInt32BE(AH, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.mkdirSync('hanomi-native/assets', { recursive: true });
fs.writeFileSync('hanomi-native/assets/atlas.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
let man = `# name x y w h ax ay shx shy lights(x,y,w,h,flag;...)\nATLAS ${AW} ${AH}\nANIMALS ${out.animals.join(',')}\n`;
for (const [k, v] of Object.entries(out.dogMeta)) man += `DOG ${k} ${v.join(' ')}\n`;
for (const it of items) { const L = (it.lights || []).map(l => [l.x, l.y, l.w, l.h, l.dim ? 1 : l.lantern ? 2 : 0].join(',')).join(';');
  man += `${it.name} ${it.x} ${it.y} ${it.w} ${it.h} ${it.ax ?? 0} ${it.ay ?? 0} ${it.sh ? it.sh[0] : -1} ${it.sh ? it.sh[1] : -1} ${L || '-'}\n`; }
fs.writeFileSync('hanomi-native/assets/atlas.txt', man);
console.log('sprites', items.length, 'atlas', AW, 'x', AH, 'bytes', fs.statSync('hanomi-native/assets/atlas.png').size);
