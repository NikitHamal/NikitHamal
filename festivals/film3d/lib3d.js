// lib3d: procedural 3D models and helpers for the festival films (three.js r170, rendered headless in Chromium).
// Everything is built from code: lathes, extrusions, swept tubes, instanced grains and blades, canvas textures.
// Shading is kept light (Lambert / Standard with a PMREM room environment, no shadow maps) so software GL can
// render a 1080x1920 frame in well under a second.
import * as THREE from 'three';
import { RoomEnvironment } from '../lib/vendor/RoomEnvironment.js';
export { THREE };

// ---------- maths
export const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v, mix = (a, b, t) => a + (b - a) * t, prog = (t, a, b) => clamp((t - a) / (b - a));
function bez(x1, y1, x2, y2) { const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  return t => { if (t <= 0) return 0; if (t >= 1) return 1; let x = t; for (let i = 0; i < 8; i++) { const fx = ((ax * x + bx) * x + cx) * x - t, d = (3 * ax * x + 2 * bx) * x + cx; if (Math.abs(fx) < 1e-6 || !d) break; x -= fx / d; } return ((ay * x + by) * x + cy) * x; }; }
// cinetic house curves
export const E = { out: bez(.16, 1, .3, 1), outSoft: bez(.22, 1, .36, 1), in: bez(.7, 0, .84, 0), exit: bez(.55, .055, .675, .19), inOut: bez(.87, 0, .13, 1), smooth: bez(.65, 0, .35, 1),
  cam: bez(.48, .1, 0, .9), glide: bez(.47, .2, .15, 1), rest: bez(.45, 0, .1, 1), contact: bez(.55, 0, .9, .55), whip: bez(.6, 0, .15, 1), dolly: bez(.35, 0, .65, 1) };
export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const hash = (x, y = 0, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function noise2(x, y, s = 0) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); return mix(mix(a, b, u), mix(c, d, u), v); }
export function fbm2(x, y, s = 0, o = 5) { let v = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { v += a * noise2(x * f, y * f, s + i * 13); n += a; a *= 0.5; f *= 2.03; } return v / n; }
// ridged noise for sharp Himalayan crests
export function ridge2(x, y, s = 0, o = 5) { let v = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { const r = 1 - Math.abs(noise2(x * f, y * f, s + i * 7) * 2 - 1); v += a * r * r; n += a; a *= 0.5; f *= 2.1; } return v / n; }

// ---------- renderer + environment
export function makeRenderer(W, H) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  r.setPixelRatio(1); r.setSize(W, H, false); r.setClearColor(0x000000, 0); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0; r.outputColorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(r); const env = pm.fromScene(new RoomEnvironment(), 0.04).texture; return { r, cv, env };
}

// ---------- textures
export function canvasTex(w, h, draw, o = {}) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 4; if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...o.repeat); } return t; }
export function gradTex(stops, h = 512) { return canvasTex(4, h, (x, w, hh) => { const g = x.createLinearGradient(0, 0, 0, hh); for (const [t, c] of stops) g.addColorStop(t, c); x.fillStyle = g; x.fillRect(0, 0, w, hh);
  const d = x.getImageData(0, 0, w, hh); for (let i = 0; i < d.data.length; i += 4) { const n = (Math.random() - 0.5) * 3; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; } x.putImageData(d, 0, 0); }); }
// a sky dome with a vertical gradient (dithered, so it never bands) and an optional sun disc direction
export function skyDome(stops, r = 400) { const m = new THREE.MeshBasicMaterial({ map: gradTex(stops), side: THREE.BackSide, fog: false, depthWrite: false }); const g = new THREE.SphereGeometry(r, 48, 32);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 1 - clamp(uv.getY(i) * 1.0)); const s = new THREE.Mesh(g, m); s.renderOrder = -10; return s; }

// ---------- generic geometry helpers
// a swept tube whose radius follows rad(u): horns, tails, stems
export function taperTube(curve, rad, seg = 80, rs = 14) { const pos = [], idx = [], fr = curve.computeFrenetFrames(seg, false);
  for (let i = 0; i <= seg; i++) { const u = i / seg, p = curve.getPointAt(u), N = fr.normals[i], B = fr.binormals[i], r = rad(u);
    for (let j = 0; j <= rs; j++) { const a = j / rs * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); pos.push(p.x + r * (c * N.x + s * B.x), p.y + r * (c * N.y + s * B.y), p.z + r * (c * N.z + s * B.z)); } }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rs; j++) { const a = i * (rs + 1) + j, b = a + rs + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
export function lathe(profile, seg = 96) { return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg); }
export const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.6, metalness: o.metal ?? 0, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, side: o.side ?? THREE.FrontSide, flatShading: !!o.flat, transparent: !!o.transparent, opacity: o.opacity ?? 1, map: o.map || null, envMapIntensity: o.env ?? 1 });
export const lam = (color, o = {}) => new THREE.MeshLambertMaterial({ color, emissive: o.emissive ?? 0x000000, side: o.side ?? THREE.FrontSide, flatShading: !!o.flat, map: o.map || null, transparent: !!o.transparent, opacity: o.opacity ?? 1, vertexColors: !!o.vc });
export const basic = (color, o = {}) => new THREE.MeshBasicMaterial({ color, transparent: !!o.transparent, opacity: o.opacity ?? 1, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: o.depthWrite ?? !o.add, side: o.side ?? THREE.FrontSide, fog: o.fog ?? true, map: o.map || null });

// ---------- models
// Himalayan range: a wide strip of ridged-noise terrain, snow above a line, cool rock below, with a fishtail peak option
export function himalaya(o = {}) { const { w = 260, d = 60, seg = [260, 60], h = 38, seed = 3, snow = 0.42, peaks = [], rock = 0x5e6b80, rockD = 0x39404f, snowC = 0xf3f6fb, haze = null } = o;
  const g = new THREE.PlaneGeometry(w, d, seg[0], seg[1]); g.rotateX(-Math.PI / 2); const p = g.attributes.position, col = [], cR = new THREE.Color(rock), cD = new THREE.Color(rockD), cS = new THREE.Color(snowC), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), back = clamp((-z + d / 2) / d); let y = ridge2(x * 0.018, z * 0.03, seed, 6) * h * (0.35 + 0.65 * back) * (0.6 + 0.4 * fbm2(x * 0.006, 1, seed + 3, 2));
    for (const pk of peaks) { const dx = (x - pk.x) / pk.r, dz = (z - (pk.z ?? -d * 0.2)) / (pk.r * 0.8); y = Math.max(y, pk.h * Math.max(0, 1 - Math.pow(Math.hypot(dx, dz), pk.k ?? 1.25)) * (0.92 + 0.08 * ridge2(x * 0.1, z * 0.1, seed))); }
    p.setY(i, y); const t = y / h; c.copy(cD).lerp(cR, clamp(fbm2(x * 0.05, z * 0.05, seed + 5, 3)));
    const sn = clamp((t - snow + (fbm2(x * 0.08, z * 0.08, seed + 9, 3) - 0.5) * 0.25) * 6); c.lerp(cS, sn); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return new THREE.Mesh(g, lam(0xffffff, { vc: true })); }
// rolling hills / valley floor with vertex-coloured greens
export function hills(o = {}) { const { w = 260, d = 120, seg = [160, 80], h = 7, seed = 8, c0 = 0x2f5d40, c1 = 0x6a9a50 } = o; const g = new THREE.PlaneGeometry(w, d, seg[0], seg[1]); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = [], a = new THREE.Color(c0), b = new THREE.Color(c1), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = fbm2(x * 0.03, z * 0.04, seed, 4) * h; p.setY(i, y); c.copy(a).lerp(b, clamp(y / h * 1.3 + (fbm2(x * 0.2, z * 0.2, seed + 1, 2) - 0.5) * 0.3)); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return new THREE.Mesh(g, lam(0xffffff, { vc: true })); }
// the patang: a slightly bowed diamond with spine + spar, a paper texture split in two colours, and a ribbon tail
export function kite(c1, c2, o = {}) { const grp = new THREE.Group(), W = o.w ?? 1, H = o.h ?? 1.25, bow = 0.12;
  const tex = canvasTex(256, 320, (x, w, h) => { x.fillStyle = c1; x.fillRect(0, 0, w, h); x.fillStyle = c2; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w, h * 0.42); x.lineTo(w / 2, h * 0.42); x.closePath(); x.fill(); x.beginPath(); x.moveTo(w / 2, h); x.lineTo(0, h * 0.42); x.lineTo(w / 2, h * 0.42); x.closePath(); x.fill();
    x.globalAlpha = 0.12; for (let i = 0; i < 400; i++) { x.fillStyle = i % 2 ? '#fff' : '#000'; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
  const pts = [[0, H * 0.58], [W / 2, 0], [0, -H * 0.42], [-W / 2, 0]], cen = [0, 0, -bow];
  const pos = [], uv = []; const P = (x, y, z = 0) => { pos.push(x, y, z); uv.push(x / W + 0.5, 1 - (H * 0.58 - y) / H); };
  for (let i = 0; i < 4; i++) { const a = pts[i], b = pts[(i + 1) % 4]; P(cen[0], cen[1], cen[2]); P(a[0], a[1], 0); P(b[0], b[1], 0); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  const sail = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })); grp.add(sail);
  const stick = new THREE.MeshLambertMaterial({ color: 0x6a4a2a }); const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, H, 5), stick); sp.position.set(0, H * 0.08, -0.02); grp.add(sp);
  const cr = new THREE.Mesh(new THREE.TorusGeometry(W * 0.62, 0.01, 4, 24, Math.PI * 0.62), stick); cr.rotation.z = Math.PI * 0.19; cr.position.set(0, -W * 0.5, -0.03); grp.add(cr);
  // tail: a ribbon whose points are animated by the caller through grp.userData.tail(t)
  const tailN = 24, tg = new THREE.BufferGeometry(), tp = new Float32Array(tailN * 2 * 3); tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); const ti = []; for (let i = 0; i < tailN - 1; i++) { const a = i * 2; ti.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } tg.setIndex(ti);
  const tail = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ color: c2, side: THREE.DoubleSide })); grp.add(tail);
  grp.userData.tail = t => { for (let i = 0; i < tailN; i++) { const u = i / (tailN - 1), y = -H * 0.42 - u * H * 1.9, x = Math.sin(t * 5 + u * 6) * 0.18 * u + Math.sin(t * 2.3 + u * 3) * 0.1 * u, z = Math.cos(t * 4 + u * 5) * 0.12 * u, wd = 0.07 * (1 - u * 0.5);
    tp.set([x - wd, y, z, x + wd, y, z], i * 6); } tg.attributes.position.needsUpdate = true; tg.computeVertexNormals(); };
  grp.userData.tail(0); return grp; }
// a kite string from a to b with sag, as a thin line
export function stringLine(color = 0x1a1a24) { const n = 40, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }));
  l.userData.set = (a, b, sag = 1) => { for (let i = 0; i < n; i++) { const u = i / (n - 1); p.set([mix(a.x, b.x, u), mix(a.y, b.y, u) - Math.sin(u * Math.PI) * sag, mix(a.z, b.z, u)], i * 3); } g.attributes.position.needsUpdate = true; g.computeBoundingSphere(); }; return l; }
// Newar pagoda: plinth steps, brick tiers, wide eaves with gilded edges, a gajur finial; lit windows optional
export function pagoda(o = {}) { const { tiers = 3, s = 1, night = false } = o; const g = new THREE.Group();
  const brick = lam(night ? 0x2a1a1a : 0x8e3a26), dark = lam(night ? 0x150c0c : 0x5a2216), roofM = std(night ? 0x16121c : 0x2c2422, { rough: 0.8 }), goldM = std(0xd9a441, { metal: 1, rough: 0.3 }), woodM = lam(0x3a2216);
  let y = 0; for (let k = 0; k < 4; k++) { const w = (9 - k * 1.5) * s, h = 0.55 * s; const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), k % 2 ? dark : brick); m.position.y = y + h / 2; g.add(m); y += h; }
  for (let k = 0; k < tiers; k++) { const bw = (4.2 - k * 0.9) * s, bh = 1.7 * s, rw = (7.4 - k * 1.55) * s, rh = 1.2 * s;
    const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bw), brick); body.position.y = y + bh / 2; g.add(body);
    for (const [dx, dz, ry] of [[0, bw / 2 + 0.01, 0], [0, -bw / 2 - 0.01, Math.PI], [bw / 2 + 0.01, 0, Math.PI / 2], [-bw / 2 - 0.01, 0, -Math.PI / 2]]) { const win = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.4, bh * 0.55), night ? basic(0xffb347) : woodM); win.position.set(dx, y + bh * 0.5, dz); win.rotation.y = ry; g.add(win); }
    y += bh; const roof = new THREE.Mesh(new THREE.ConeGeometry(rw * 0.72, rh, 4, 1, true), roofM); roof.rotation.y = Math.PI / 4; roof.position.y = y + rh / 2 - 0.05; roof.material.side = THREE.DoubleSide; g.add(roof);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(rw * 0.72 * 0.98, 0.06 * s, 4, 4), goldM); rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 4; rim.position.y = y + 0.02; g.add(rim); y += rh * 0.55; }
  const fin = new THREE.Mesh(lathe([[0, 0], [0.35, 0], [0.4, 0.3], [0.2, 0.6], [0.32, 0.9], [0.12, 1.4], [0.18, 1.6], [0, 2.2]].map(([a, b]) => [a * s, b * s]), 24), goldM); fin.position.y = y; g.add(fin);
  g.userData.height = y + 2.2 * s; return g; }
// copper kalash with mango leaves and a coconut, sindoor swastika-free (a plain red mark)
export function kalash(o = {}) { const g = new THREE.Group(); const copper = std(0xb8673a, { metal: 1, rough: 0.32 });
  const body = new THREE.Mesh(lathe([[0, 0], [0.55, 0], [0.75, 0.15], [1.0, 0.6], [1.02, 0.95], [0.8, 1.35], [0.45, 1.55], [0.42, 1.75], [0.55, 1.85], [0.5, 1.9], [0, 1.9]], 64), copper); g.add(body);
  const mark = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), std(0xc8102e, { rough: 0.9 })); mark.position.set(0, 0.95, 1.03); g.add(mark);
  const leafG = new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.22, 0.45, 0, 1.0); s.quadraticCurveTo(-0.22, 0.45, 0, 0); return s; })(), 8);
  const leafM = lam(0x2f7a3a, { side: THREE.DoubleSide }); for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, l = new THREE.Mesh(leafG, leafM); l.position.set(Math.cos(a) * 0.4, 1.85, Math.sin(a) * 0.4); l.rotation.y = -a + Math.PI / 2; l.rotation.x = -0.7; g.add(l); }
  const coco = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), lam(0x6b4423)); coco.scale.y = 1.15; coco.position.y = 2.25; g.add(coco); return g; }
// brass thali with a heap of red tika rice (instanced grains), a curd bowl, jamara and a diyo
export function thali(o = {}) { const g = new THREE.Group(); const brass = std(0xd7a640, { metal: 1, rough: 0.28 });
  g.add(new THREE.Mesh(lathe([[0, 0], [2.6, 0], [2.95, 0.12], [3.05, 0.22], [2.95, 0.24], [2.6, 0.08], [0, 0.08]], 96), brass));
  const N = o.grains ?? 2600, gr = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.028, 0.07, 1, 4), lam(0xffffff), N), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), cc = new THREE.Color(), R = rng(11);
  for (let i = 0; i < N; i++) { const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 0.95, hgt = (1 - d / 0.95) ** 1.3 * 0.55; e.set(R() * 6, R() * 6, R() * 6); q.setFromEuler(e);
    m.compose(new THREE.Vector3(-0.9 + Math.cos(a) * d, 0.1 + hgt * R(), 0.4 + Math.sin(a) * d * 0.9), q, new THREE.Vector3(1, 1, 1)); gr.setMatrixAt(i, m); cc.setHSL(0.985 + R() * 0.02, 0.85, 0.32 + R() * 0.16); if (R() < 0.04) cc.set(0xf3e6d0); gr.setColorAt(i, cc); }
  g.add(gr); const bowl = new THREE.Mesh(lathe([[0, 0], [0.45, 0], [0.6, 0.35], [0.62, 0.38], [0, 0.38]], 48), std(0xc9a24a, { metal: 1, rough: 0.3 })); bowl.position.set(1.0, 0.08, 0.6); g.add(bowl);
  const curd = new THREE.Mesh(new THREE.CircleGeometry(0.56, 32), lam(0xfaf7ee)); curd.rotation.x = -Math.PI / 2; curd.position.set(1.0, 0.44, 0.6); g.add(curd);
  const jam = jamara({ n: 220, r: 0.45, h: 2.4, seed: 4 }); jam.position.set(0.6, 0.1, -1.2); g.add(jam); g.userData.jamara = jam;
  const dy = diyo(); dy.position.set(1.7, 0.08, -0.4); dy.scale.setScalar(0.8); g.add(dy); g.userData.diyo = dy;
  for (let k = 0; k < 6; k++) { const mg = marigold(); const a = k / 6 * Math.PI * 1.2 + 2.2; mg.position.set(Math.cos(a) * 2.4, 0.22, Math.sin(a) * 2.4); g.add(mg); } return g; }
// jamara: tapered blades, pale yellow at the root to yellow-green tips (grown in the dark); grow 0..1 and sway via update(t, grow)
export function jamara(o = {}) { const { n = 400, r = 1, h = 3, seed = 1 } = o; const R = rng(seed);
  const blade = new THREE.BufferGeometry(), segs = 6, pos = [], idx = [], col = []; for (let i = 0; i <= segs; i++) { const u = i / segs, w = 0.035 * (1 - u * 0.85); pos.push(-w, u, 0, w, u, 0); const c = new THREE.Color(0xf4efb4).lerp(new THREE.Color(0xb7c94a), u ** 1.4); col.push(c.r, c.g, c.b, c.r, c.g, c.b); if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); blade.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); blade.setIndex(idx); blade.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(blade, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), n); const B = []; for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r; B.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, h: h * (0.7 + 0.3 * R()), ry: R() * Math.PI, lean: (R() - 0.5) * 0.5, ph: R() * 6, del: R() * 0.25 }); }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  mesh.userData.update = (t, grow = 1) => { B.forEach((b, i) => { const gr = clamp((grow - b.del) / (1 - b.del)); e.set(b.lean + Math.sin(t * 1.3 + b.ph) * 0.06, b.ry, Math.sin(t * 1.1 + b.ph) * 0.05); q.setFromEuler(e); sc.set(1, Math.max(1e-3, b.h * gr), 1); p.set(b.x, 0, b.z); m.compose(p, q, sc); mesh.setMatrixAt(i, m); }); mesh.instanceMatrix.needsUpdate = true; };
  mesh.userData.update(0, 1); return mesh; }
// clay diyo with a living flame (an emissive teardrop + a warm point light); update(t, lit)
export function diyo() { const g = new THREE.Group(); const clay = lam(0x9a4a26);
  const bowl = new THREE.Mesh(lathe([[0, 0], [0.22, 0], [0.42, 0.12], [0.48, 0.2], [0.44, 0.22], [0.3, 0.12], [0, 0.12]], 32), clay); bowl.scale.z = 0.8; g.add(bowl);
  const fl = new THREE.Mesh(lathe(Array.from({ length: 12 }, (_, i) => { const u = i / 11; return [Math.sin(u * Math.PI) ** 0.8 * 0.09 * (1 - u * 0.6), u * 0.45]; }), 16), basic(0xffc860)); fl.position.set(0.3, 0.2, 0); g.add(fl);
  const core = new THREE.Mesh(lathe(Array.from({ length: 10 }, (_, i) => { const u = i / 9; return [Math.sin(u * Math.PI) * 0.045, u * 0.22]; }), 12), basic(0xfff6d8)); core.position.set(0.3, 0.2, 0); g.add(core);
  const L = new THREE.PointLight(0xffa040, 4, 6, 1.6); L.position.set(0.3, 0.45, 0); g.add(L);
  g.userData.update = (t, lit = 1) => { const k = (0.88 + 0.08 * Math.sin(t * 13) + 0.05 * Math.sin(t * 31 + 1)) * lit; fl.scale.set(lit, Math.max(0.001, k), lit); core.scale.set(lit, Math.max(0.001, k * 0.9), lit); fl.rotation.z = Math.sin(t * 5) * 0.06; L.intensity = 4 * k; fl.visible = core.visible = lit > 0.01; };
  return g; }
export function marigold(o = {}) { const g = new THREE.Group(); const R = rng(o.seed ?? 3); const pm = lam(0xff9a1c), pd = lam(0xe0610e);
  for (let i = 0; i < 26; i++) { const a = R() * Math.PI * 2, b = R() * 1.2, p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), i % 3 ? pm : pd); p.scale.set(1, 0.5, 1.4); p.position.set(Math.cos(a) * Math.sin(b) * 0.16, Math.cos(b) * 0.12, Math.sin(a) * Math.sin(b) * 0.16); p.lookAt(0, 0, 0); g.add(p); } return g; }
// trishul: extruded gilt trident with a sindoor knot; returns a group roughly 8 units tall
export function trishul() { const s = new THREE.Shape(); const W = 1.8;
  s.moveTo(-0.12, -6); s.lineTo(0.12, -6); s.lineTo(0.12, 0.2); s.lineTo(0.5, 0.2); s.bezierCurveTo(1.2, 0.3, W, 0.9, W * 0.98, 2.2); s.lineTo(W * 0.9, 2.9); s.bezierCurveTo(W * 0.7, 1.6, 1.0, 0.85, 0.42, 0.75);
  s.lineTo(0.2, 0.75); s.lineTo(0.2, 2.8); s.lineTo(0, 3.6); s.lineTo(-0.2, 2.8); s.lineTo(-0.2, 0.75); s.lineTo(-0.42, 0.75); s.bezierCurveTo(-1.0, 0.85, -W * 0.7, 1.6, -W * 0.9, 2.9); s.lineTo(-W * 0.98, 2.2); s.bezierCurveTo(-W, 0.9, -1.2, 0.3, -0.5, 0.2); s.lineTo(-0.12, 0.2); s.lineTo(-0.12, -6);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 24 }); geo.center(); geo.translate(0, 1.3, 0);
  const g = new THREE.Group(); g.add(new THREE.Mesh(geo, std(0xe0b04a, { metal: 1, rough: 0.22 })));
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), std(0xc8102e, { rough: 0.5 })); knot.position.set(0, -0.8, 0.1); g.add(knot);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 24), std(0xe0b04a, { metal: 1, rough: 0.25 })); band.rotation.x = Math.PI / 2; band.position.y = -0.45; g.add(band); return g; }
// the ten weapons of Durga, simplified: chakra, sword, bow, conch, lotus, bell, mace, axe, shield, arrow
export function weapons() { const gold = std(0xe0b04a, { metal: 1, rough: 0.25 }), steel = std(0xc8ccd4, { metal: 1, rough: 0.2 }), pink = lam(0xee6a9a), white = lam(0xf6efe4); const out = [];
  const add = (...ms) => { const g = new THREE.Group(); ms.forEach(m => g.add(m)); out.push(g); return g; };
  add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 40), gold), ...Array.from({ length: 8 }, (_, i) => { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.04), gold); sp.rotation.z = i * Math.PI / 8; return sp; }));
  { const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6, 0.03), steel); b.position.y = 0.6; const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), gold); const gp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8), gold); gp.position.y = -0.2; add(b, h, gp); }
  { const bw = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.04, 6, 30, Math.PI * 0.9), gold); bw.rotation.z = Math.PI * 0.55; add(bw); }
  { const c = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 16, 1), white); c.rotation.z = Math.PI / 2; const sp = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.06, 8, 20), white); sp.position.x = -0.35; add(c, sp); }
  add(...Array.from({ length: 8 }, (_, i) => { const p = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), pink); p.scale.set(0.45, 1, 0.2); p.position.set(Math.sin(i / 8 * 6.28) * 0.2, Math.cos(i / 8 * 6.28) * 0.2 + 0.1, 0); p.rotation.z = -i / 8 * 6.28; return p; }));
  { const b = new THREE.Mesh(lathe([[0, 0], [0.32, 0], [0.3, 0.1], [0.2, 0.45], [0.06, 0.55], [0.03, 0.8], [0, 0.8]], 24), gold); add(b); }
  { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), gold), b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), gold); b.position.y = 0.7; add(h, b); }
  { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8), gold), b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 16, 1, false, 0, Math.PI), steel); b.rotation.x = Math.PI / 2; b.position.set(0.15, 0.55, 0); add(h, b); }
  { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 32), gold), boss = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), steel); s.rotation.x = Math.PI / 2; boss.position.z = 0.06; add(s, boss); }
  { const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6), gold), tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 8), steel); tip.position.y = 0.9; add(sh, tip); }
  return out; }
// the moon, phase-correct: a sphere lit by its own sun direction (custom shader), with a soft maria texture
export function moonMat(phaseAngle = 0, tint = 0xf6efe0) { const tex = canvasTex(512, 256, (x, w, h) => { x.fillStyle = '#d8d2c4'; x.fillRect(0, 0, w, h); const R = rng(5); for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(90,88,96,${0.08 + R() * 0.16})`; x.beginPath(); x.ellipse(R() * w, h * 0.2 + R() * h * 0.6, 10 + R() * 50, 8 + R() * 30, R() * 3, 0, 7); x.fill(); }
    for (let i = 0; i < 300; i++) { x.strokeStyle = `rgba(255,255,255,${R() * 0.25})`; x.beginPath(); x.arc(R() * w, R() * h, 1 + R() * 5, 0, 7); x.stroke(); } });
  return new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, sun: { value: new THREE.Vector3(Math.sin(phaseAngle), 0, Math.cos(phaseAngle)) }, tint: { value: new THREE.Color(tint) }, earth: { value: 0.035 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: 'uniform sampler2D map; uniform vec3 sun; uniform vec3 tint; uniform float earth; varying vec2 vUv; varying vec3 vN; void main(){ float l=smoothstep(-0.03,0.12,dot(normalize(vN),normalize(sun))); vec3 c=texture2D(map,vUv).rgb*tint; gl_FragColor=vec4(c*(l+earth),1.0);\n#include <colorspace_fragment>\n}' }); }
// an extruded slab of Nepal from the official boundary (lon/lat pairs); returns { mesh, project(lon, lat) }
export function nepalSlab(pts, o = {}) { const { width = 20, depth = 0.6, top = 0xc8102e, side = 0x7a0a1c, edge = 0x003893 } = o; const x0 = 80.06, x1 = 88.2, y0 = 26.35, y1 = 30.47, k = width / (x1 - x0), lat = Math.cos(28.3 * Math.PI / 180);
  const P = (lon, la) => new THREE.Vector2((lon - (x0 + x1) / 2) * k, (la - (y0 + y1) / 2) * k / lat);
  const sh = new THREE.Shape(pts.map(([a, b]) => P(a, b))); const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 1 }); geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, [std(top, { rough: 0.55 }), std(side, { rough: 0.7 })]);
  const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(([a, b]) => { const v = P(a, b); return new THREE.Vector3(v.x, depth + 0.07, -v.y); })), new THREE.LineBasicMaterial({ color: edge }));
  const g = new THREE.Group(); g.add(mesh, outline); g.userData.project = (lon, la) => { const v = P(lon, la); return new THREE.Vector3(v.x, depth + 0.07, -v.y); }; g.userData.outline = outline; return g; }
// bamboo ping: four poles leaning to a lashed apex, two ropes and a seat; set(theta) swings it
export function ping(o = {}) { const { h = 10, rider = true } = o; const g = new THREE.Group(), bam = lam(0xc8a860), bamD = lam(0x9a8040), rope = lam(0xe8dcc0);
  const apex = new THREE.Vector3(0, h, 0); for (const [x, z] of [[-3, -1.5], [3, -1.5], [-3, 1.5], [3, 1.5]]) { const b = new THREE.Vector3(x, 0, z), mid = b.clone().add(apex).multiplyScalar(0.5), len = b.distanceTo(apex);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, len, 8), z < 0 ? bamD : bam); p.position.copy(mid); p.lookAt(apex); p.rotateX(Math.PI / 2); g.add(p); }
  const swing = new THREE.Group(); swing.position.copy(apex); g.add(swing); const L = h * 0.86;
  for (const z of [-0.45, 0.45]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, L, 5), rope); r.position.set(0, -L / 2, z); swing.add(r); }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 1.1), lam(0x6a4a2a)); seat.position.y = -L; swing.add(seat);
  if (rider) { const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.75, 4, 8), lam(0xc8102e)); body.position.y = -L + 0.75; swing.add(body); const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), lam(0x5a3a28)); head.position.y = -L + 1.45; swing.add(head);
    for (const z of [-0.2, 0.2]) { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.4, 2, 6), lam(0x2a2a3a)); leg.position.set(0, -L + 0.28, z * 0.5); swing.add(leg); const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.5, 2, 6), lam(0x5a3a28)); arm.position.set(0, -L + 1.2, z * 2.1); arm.rotation.x = z > 0 ? -0.4 : 0.4; swing.add(arm); } }
  g.userData.set = th => { swing.rotation.z = th; }; return g; }
// a valley town: instanced brick houses with tiled roofs and windows that can light up
export function town(o = {}) { const { n = 220, w = 120, d = 40, seed = 5, night = false } = o; const R = rng(seed), g = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0); const roof = new THREE.ConeGeometry(0.75, 0.5, 4); roof.rotateY(Math.PI / 4); roof.translate(0, 0.25, 0);
  const H = new THREE.InstancedMesh(box, lam(0xffffff), n), RF = new THREE.InstancedMesh(roof, lam(night ? 0x1a1418 : 0x3a2c28), n), m = new THREE.Matrix4(), c = new THREE.Color(), list = [];
  for (let i = 0; i < n; i++) { const x = (R() - 0.5) * w, z = (R() - 0.5) * d, sw = 1.2 + R() * 1.6, sh = 1.5 + R() * 3.5, sd = 1.2 + R() * 1.4; m.makeScale(sw, sh, sd); m.setPosition(x, 0, z); H.setMatrixAt(i, m);
    c.set(night ? 0x2a1c22 : [0x9c3b26, 0xb8553a, 0xd8c8b0, 0x8e3a26][Math.floor(R() * 4)]); H.setColorAt(i, c); m.makeScale(sw * 1.25, 0.9, sd * 1.25); m.setPosition(x, sh, z); RF.setMatrixAt(i, m); list.push({ x, z, sw, sh, sd }); }
  g.add(H, RF);
  const win = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.28, 0.36), basic(0xffffff), n * 4), mw = new THREE.Matrix4(); let k = 0;
  for (const b of list) for (let j = 0; j < 4; j++) { const fx = b.x + (j % 2 ? 0.3 : -0.3) * b.sw, fy = 0.8 + Math.floor(j / 2) * 1.1; if (fy > b.sh - 0.3) { mw.makeScale(0, 0, 0); win.setMatrixAt(k++, mw); continue; } mw.makeTranslation(fx, fy, b.z + b.sd / 2 + 0.02); win.setMatrixAt(k++, mw); win.setColorAt(k - 1, new THREE.Color(night ? 0xffb347 : 0x3a2216)); }
  g.add(win); g.userData.windows = win; return g; }
// soft round sprite texture (for smoke puffs, bokeh, sparks)
export function softTex(col = '#ffffff') { return canvasTex(128, 128, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }); }
// a palm-leaf folio (taadpatra) with a canvas texture of Devanagari lines
export function folio(lines, o = {}) { const tex = canvasTex(1600, 260, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d9b47a'); g.addColorStop(0.5, '#c99c5c'); g.addColorStop(1, '#a87a40'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.globalAlpha = 0.18; for (let i = 0; i < 90; i++) { x.fillStyle = i % 2 ? '#6a4420' : '#f0d8a8'; x.fillRect(0, Math.random() * h, w, 1); } x.globalAlpha = 1; x.fillStyle = '#2a1608'; x.font = '44px Tiro'; x.textBaseline = 'middle';
    lines.forEach((l, i) => { x.fillText(l, 80, 60 + i * 70); }); x.fillStyle = '#3a2010'; x.beginPath(); x.arc(w / 2, h / 2, 14, 0, 7); x.fill(); });
  const m = new THREE.Mesh(new THREE.BoxGeometry(12, 1.95, 0.04), [lam(0xa87a40), lam(0xa87a40), lam(0xa87a40), lam(0xa87a40), lam(0xffffff, { map: tex }), lam(0x8a6030)]); return m; }
// instanced horn shards for the shatter: sample points of a geometry and turn them into flying tetrahedra
export function shards(geo, n = 900, color = 0x0a0204, seed = 3) { const R = rng(seed), p = geo.attributes.position, im = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.12), lam(color, { flat: true }), n), data = [];
  for (let i = 0; i < n; i++) { const j = Math.floor(R() * p.count); data.push({ o: new THREE.Vector3(p.getX(j), p.getY(j), p.getZ(j)), v: new THREE.Vector3(R() - 0.5, R() * 0.8 + 0.1, R() - 0.5).normalize().multiplyScalar(4 + R() * 9), r: new THREE.Vector3(R() * 9, R() * 9, R() * 9), s: 0.5 + R() * 1.5 }); }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  im.userData.update = t => { data.forEach((d, i) => { v.copy(d.o).addScaledVector(d.v, t); v.y -= 4.9 * t * t * 0.4; e.set(d.r.x * t, d.r.y * t, d.r.z * t); q.setFromEuler(e); sc.setScalar(d.s * Math.max(0, 1 - t * 0.35)); m.compose(v, q, sc); im.setMatrixAt(i, m); }); im.instanceMatrix.needsUpdate = true; };
  im.userData.update(0); return im; }
