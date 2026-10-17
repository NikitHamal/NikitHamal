/*!
 * 3D me — a small dependency-free WebGL viewer.
 * Each age is a figurine built in the browser from two light assets:
 *   depth.png (R = relief depth, G = head mask, B = body mask; 200×250, from tools/depth3d.py — the
 *   face depth is the real 3D face mesh measured from the photo) + the painting as its texture.
 * Bust = the relief (front + a closed back) on a plinth. Full body = the same bust continued by a
 * modelled torso, arms, legs and shoes in that age's clothes. The head turns to follow the pointer,
 * breathes, and can be orbited by dragging. One canvas, one shader, buffers freed on every switch.
 */
(() => {
'use strict';
const host = document.getElementById('me3d');
if (!host) return;
const DPR = Math.min(2, devicePixelRatio || 1);
const cv = document.createElement('canvas'); host.appendChild(cv);
let gl;

// ---------------- tiny math
const m4 = {
  persp(f, a, n, fa) { const t = 1 / Math.tan(f / 2), nf = 1 / (n - fa); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) * nf, -1, 0, 0, 2 * fa * n * nf, 0]; },
  mul(a, b) { const o = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; },
  tr(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; },
  ry(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; },
  rx(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; },
  sc(x, y, z) { return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]; },
};

// ---------------- shader
const VS = `
attribute vec3 p; attribute vec3 n; attribute vec2 uv; attribute vec3 c; attribute vec2 f; // f.x = texture mix, f.y = head weight
uniform mat4 P, V, M, Hm; uniform float breath;
varying vec3 vn, vw; varying vec2 vuv; varying vec3 vc; varying float vt;
void main(){
  vec4 q = vec4(p, 1.0); vec3 nn = n;
  q.y += breath * (q.y + 6.0) * 0.004 * (1.0 - f.y);
  vec4 qh = Hm * q; q = mix(q, qh, f.y); nn = normalize(mix(nn, mat3(Hm) * nn, f.y));
  vec4 w = M * q; vw = w.xyz; vn = mat3(M) * nn; vuv = uv; vc = c; vt = f.x;
  gl_Position = P * V * w;
}`;
const FS = `
precision mediump float;
uniform sampler2D T; uniform vec3 eye;
varying vec3 vn, vw; varying vec2 vuv; varying vec3 vc; varying float vt;
void main(){
  vec3 N = normalize(vn); if (!gl_FrontFacing) N = -N;
  vec3 L1 = normalize(vec3(-0.5, 0.65, 0.8)), L2 = normalize(vec3(0.7, 0.2, 0.4));
  vec3 Vd = normalize(eye - vw);
  float d1 = max(dot(N, L1), 0.0), d2 = max(dot(N, L2), 0.0), rim = pow(1.0 - max(dot(N, Vd), 0.0), 3.0);
  vec3 base = mix(vc, texture2D(T, vuv).rgb, vt);
  // the painting already carries its own light: textured areas get gentle shading, solid parts full
  float shade = mix(0.42 + 0.62 * d1 + 0.16 * d2, 0.8 + 0.28 * d1 + 0.06 * d2, vt);
  vec3 col = base * shade + rim * vec3(1.0, 0.95, 0.88) * 0.16;
  float h = dot(normalize(vec3(0.3, 1.0, 0.2)), reflect(-L1, N)); col += pow(max(h, 0.0), 24.0) * 0.05 * (1.0 - vt);
  gl_FragColor = vec4(col, 1.0);
}`;
let prog, loc = {};
function initGL() {
  gl = cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false }) ; if (!gl) return false;
  gl.getExtension('OES_element_index_uint');
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(o)); return o; };
  prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
  for (const a of ['p', 'n', 'uv', 'c', 'f']) loc[a] = gl.getAttribLocation(prog, a);
  for (const u of ['P', 'V', 'M', 'Hm', 'T', 'eye', 'breath']) loc[u] = gl.getUniformLocation(prog, u);
  gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);
  return true;
}

// ---------------- geometry builder (interleaved: p3 n3 uv2 c3 f2 = 13 floats)
function Geo() { this.v = []; this.i = []; this.n = 0; }
Geo.prototype.vert = function (x, y, z, u, v, c, t, h) { this.v.push(x, y, z, 0, 0, 0, u, v, c[0], c[1], c[2], t, h); return this.n++; };
Geo.prototype.tri = function (a, b, c) { this.i.push(a, b, c); };
Geo.prototype.normals = function () {   // smooth per-vertex normals
  const v = this.v, S = 13;
  for (let k = 0; k < this.i.length; k += 3) {
    const a = this.i[k] * S, b = this.i[k + 1] * S, c = this.i[k + 2] * S;
    const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2], wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    for (const o of [a, b, c]) { v[o + 3] += nx; v[o + 4] += ny; v[o + 5] += nz; }
  }
  for (let o = 0; o < v.length; o += S) { const l = Math.hypot(v[o + 3], v[o + 4], v[o + 5]) || 1; v[o + 3] /= l; v[o + 4] /= l; v[o + 5] /= l; }
};
const col = a => a.map(x => x / 255);

// relief from the depth map: front surface (painted) + back surface (flat colours), meeting at the silhouette
function relief(g, D, meta) {
  const { w, h, data } = D, k = 800 / w / 100, zk = meta.zmax / 255 / 100;
  const cx = meta.chin[0] / 100, cy = meta.chin[1] / 100;
  const hairC = col(meta.hair), clothC = col(meta.cloth);
  const front = new Int32Array(w * h).fill(-1), back = new Int32Array(w * h).fill(-1);
  const at = (x, y) => (y * w + x) * 4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = at(x, y); if (data[o + 2] < 110) continue;
    const X = x * k - cx, Y = -(y * k - cy), z = data[o] * zk, hw = data[o + 1] / 255;
    front[y * w + x] = g.vert(X, Y, z, (x + 0.5) / w, (y + 0.5) / h, clothC, 1, hw);
    back[y * w + x] = g.vert(X, Y, -z * 0.55, 0, 0, hw > 0.5 ? hairC : clothC, 0, hw);
  }
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const a = y * w + x, b = a + 1, c = a + w, d = c + 1;
    if (front[a] < 0 || front[b] < 0 || front[c] < 0 || front[d] < 0) continue;
    g.tri(front[a], front[c], front[b]); g.tri(front[b], front[c], front[d]);
    g.tri(back[a], back[b], back[c]); g.tri(back[b], back[d], back[c]);
  }
  // stitch the outline so front and back close up
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const a = y * w + x;
    for (const [p, q] of [[a, a + 1], [a, a + w]]) {
      if (front[p] < 0 || front[q] < 0) continue;
      const pn = p === a ? [a - w, a + w] : [a - 1, a + 1];
      // edge on the boundary if a neighbour across it is empty
      const across = p + 1 === q ? [p - w, p + w] : [p - 1, p + 1];
      if (across.some(i => i < 0 || i >= w * h || front[i] < 0)) { g.tri(front[p], back[p], front[q]); g.tri(front[q], back[p], back[q]); }
    }
  }
}

// lathe-style body part: rings of (y, rx, rz) around (x, z), optional colour per ring
function tube(g, x0, z0, rings, cols, seg = 22, tilt = 0) {
  const base = g.n;
  rings.forEach(([y, rx, rz], r) => {
    const c = cols[Math.min(r, cols.length - 1)], dx = Math.sin(tilt) * (rings[0][0] - y);
    for (let s = 0; s <= seg; s++) { const a = s / seg * Math.PI * 2; g.vert(x0 + dx + Math.cos(a) * rx, y, z0 + Math.sin(a) * rz, 0, 0, c, 0, 0); }
  });
  for (let r = 0; r < rings.length - 1; r++) for (let s = 0; s < seg; s++) {
    const a = base + r * (seg + 1) + s, b = a + 1, c = a + seg + 1, d = c + 1; g.tri(a, b, c); g.tri(b, d, c);
  }
}
const ellipsoid = (g, x, y, z, rx, ry, rz, c) => { const R = []; for (let i = 0; i <= 10; i++) { const t = i / 10 * Math.PI; R.push([y + Math.cos(t) * ry, Math.sin(t) * rx + 1e-3, Math.sin(t) * rz + 1e-3]); } tube(g, x, z, R, [c], 18); };

function build(D, meta, full) {
  const g = new Geo(); relief(g, D, meta);
  const cy = meta.chin[1] / 100, cutY = -(10 - cy) + 0.02;           // where the painting ends (y=1000px)
  const span = (meta.bottom[1] - meta.bottom[0]) / 100, bx = ((meta.bottom[0] + meta.bottom[1]) / 2 - meta.chin[0]) / 100;
  const dep = Math.max(0.6, meta.bottomDepth / 100);
  const Hh = meta.fh / 72;                                             // head height in world units
  if (!full) {   // plinth hides the cut
    const wood = col([150, 112, 82]), wood2 = col([122, 88, 62]);
    tube(g, bx, -0.05, [[cutY + 0.25, span * 0.47, dep * 1.15], [cutY - 0.05, span * 0.5, dep * 1.25], [cutY - 0.55, span * 0.5, dep * 1.25], [cutY - 0.6, span * 0.46, dep * 1.15]], [col(meta.cloth), wood, wood2, wood2], 40);
    g.normals(); return { g, top: meta.chin[1] / 100 - meta.top[1] / 100 + 1.4, bottom: cutY - 0.6 };
  }
  const crown = (meta.chin[1] - meta.top[1]) / 100 + Hh * 0.3, ground = crown - meta.heads * Hh;
  const waist = crown - Hh * (meta.heads * 0.47), crotch = crown - Hh * (meta.heads * 0.56);   // figurine proportions: bigger head, shorter legs
  const cloth = col(meta.cloth), clothD = cloth.map(v => v * 0.82), pants = col(meta.pants), skin = col(meta.skin), shoe = col(meta.shoe);
  const tw = span * 0.34, td = dep * 0.95;
  // torso (continues the bust, slight taper), hips
  tube(g, bx, -0.05, [[cutY + 0.3, tw * 1.03, td], [cutY - 0.4, tw, td * 0.98], [waist, tw * 0.86, td * 0.86], [waist - 0.15, tw * 0.88, td * 0.88]], [cloth, cloth, cloth, clothD], 36);
  tube(g, bx, -0.05, [[waist - 0.05, tw * 0.87, td * 0.86], [crotch + 0.2, tw * 0.9, td * 0.85], [crotch - 0.05, tw * 0.6, td * 0.6]], [pants], 36);
  // legs + shoes
  const legR = tw * 0.47;
  for (const s of [-1, 1]) {
    const lx = bx + s * tw * 0.5;
    tube(g, lx, -0.05, [[crotch + 0.3, legR * 1.02, legR * 1.0], [crotch - (crotch - ground) * 0.48, legR * 0.9, legR * 0.88], [ground + 0.4, legR * 0.78, legR * 0.76], [ground + 0.25, legR * 0.76, legR * 0.74]], [pants], 20);
    ellipsoid(g, lx + s * 0.04, ground + 0.18, legR * 0.35, legR * 0.9, 0.22, legR * 1.45, shoe);
  }
  // arms hang from the bust's sides
  const armR = Math.max(0.3, span * 0.085), wrist = crown - Hh * meta.heads * 0.52;
  for (const s of [-1, 1]) {
    const ax = bx + s * (span / 2 - armR * 1.1), sl = meta.sleeve;
    const elbow = cutY - (cutY - wrist) * 0.45, sleeveEnd = cutY - (cutY - wrist) * sl;
    const rings = [[cutY + 0.25, armR, armR], [elbow, armR * 0.88, armR * 0.9], [wrist, armR * 0.7, armR * 0.72]];
    const cols = rings.map(r => (r[0] >= sleeveEnd - 1e-3 ? cloth : skin));
    if (sl < 0.99) { rings.splice(1, 0, [sleeveEnd + 0.01, armR * 0.95, armR * 0.96], [sleeveEnd - 0.01, armR * 0.82, armR * 0.84]); cols.splice(0, cols.length, cloth, cloth, skin, skin, skin); }
    tube(g, ax, -0.05, rings, cols, 18, s * -0.05);
    ellipsoid(g, ax + s * 0.02 - s * Math.sin(0.05) * (cutY - wrist), wrist - armR * 0.9, 0, armR * 0.78, armR * 1.15, armR * 0.6, skin);
  }
  g.normals(); return { g, top: crown, bottom: ground };
}

// ---------------- assets
let manifest; const files = {};
const blob = (f, type) => files[f] || (files[f] = (manifest = manifest || fetch('art/index.json').then(r => r.json()))
  .then(m => Promise.all(Array.from({ length: m[f] }, (_, i) => fetch(`art/${f}.${i}`).then(r => r.arrayBuffer())))).then(p => new Blob(p, { type })));
let META; const metaP = () => META ? Promise.resolve(META) : fetch('art/me3d.json').then(r => r.json()).then(m => (META = m));
async function depth(id) {
  const bm = await createImageBitmap(await blob(`${id}/depth.png`, 'image/png'), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bm, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height); bm.close(); c.width = 0; return { w: d.width, h: d.height, data: d.data };
}

// ---------------- scene state
const S = { id: 'now', full: false, yaw: 0, pitch: 0.06, vyaw: 0, drag: null, look: { x: 0, y: 0 }, lookT: { x: 0, y: 0 }, idle: 0, t: 0, model: null, tex: null, vb: null, ib: null, count: 0, frame: { top: 1, bottom: -1 } };
let job = 0;
async function load(id, full) {
  const my = ++job; S.id = id; S.full = full; host.classList.add('loading');
  const [meta, D, img] = await Promise.all([metaP(), depth(id), blob(`${id}/paint.webp`, 'image/webp').then(b => createImageBitmap(b))]);
  if (my !== job) { img.close(); return; }
  const m = build(D, meta[id], full);
  // upload (old buffers freed first)
  if (S.vb) { gl.deleteBuffer(S.vb); gl.deleteBuffer(S.ib); }
  S.vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, S.vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(m.g.v), gl.STATIC_DRAW);
  S.ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, S.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(m.g.i), gl.STATIC_DRAW);
  S.count = m.g.i.length;
  if (!S.tex) S.tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, S.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img); img.close();
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  S.frame = { top: m.top, bottom: m.bottom }; S.meta = meta[id]; host.classList.remove('loading');
  host.dataset.tris = (S.count / 3).toLocaleString();
  const st = document.getElementById('me3dStatus'); if (st) st.textContent = `${(S.count / 3).toLocaleString()} triangles`;
}

// ---------------- render loop (only while on screen)
function frame() {
  const w = Math.round(host.clientWidth * DPR), h = Math.round(host.clientHeight * DPR);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if (!S.count) return;
  const top = S.frame.top, bot = S.frame.bottom, mid = (top + bot) / 2, size = top - bot;
  const fov = 0.5, dist = size / 2 / Math.tan(fov / 2) * 1.12 + 2;
  const P = m4.persp(fov, w / h, 0.5, 200);
  const V = m4.mul(m4.tr(0, -mid, -dist), m4.mul(m4.rx(S.pitch), m4.ry(S.yaw)));
  // camera position for rim light
  const eye = [Math.sin(-S.yaw) * dist, mid, Math.cos(S.yaw) * dist];
  // head: turn toward the pointer around the neck
  const nk = -0.35, Hm = m4.mul(m4.tr(0, nk, 0), m4.mul(m4.ry(S.look.x * 0.42), m4.mul(m4.rx(-S.look.y * 0.22), m4.tr(0, -nk, 0))));
  gl.useProgram(prog);
  gl.uniformMatrix4fv(loc.P, false, P); gl.uniformMatrix4fv(loc.V, false, V); gl.uniformMatrix4fv(loc.M, false, m4.tr(0, 0, 0)); gl.uniformMatrix4fv(loc.Hm, false, Hm);
  gl.uniform3fv(loc.eye, eye); gl.uniform1f(loc.breath, Math.sin(S.t * 2.1)); gl.uniform1i(loc.T, 0);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S.tex);
  gl.bindBuffer(gl.ARRAY_BUFFER, S.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, S.ib);
  const B = 13 * 4;
  [['p', 3, 0], ['n', 3, 12], ['uv', 2, 24], ['c', 3, 32], ['f', 2, 44]].forEach(([a, n, o]) => { gl.enableVertexAttribArray(loc[a]); gl.vertexAttribPointer(loc[a], n, gl.FLOAT, false, B, o); });
  gl.drawElements(gl.TRIANGLES, S.count, gl.UNSIGNED_INT, 0);
}
let px = 0, py = 0, lastIn = 0, vis = false, last = performance.now();
function tick(now) {
  if (!vis) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; S.t += dt;
  const idle = (now - lastIn) / 1000;
  if (!S.drag) {
    if (idle > 4) { S.vyaw = 0; S.yaw += (Math.sin(S.t * 0.35) * 0.55 - S.yaw) * (1 - Math.pow(0.4, dt)); S.lookT.x = Math.sin(S.t * 0.6) * 0.5; S.lookT.y = Math.sin(S.t * 0.4) * 0.2; }  // idle: gentle turntable sway, looking around
    else { S.yaw += S.vyaw * dt; S.vyaw *= Math.pow(0.05, dt); }
  }
  S.look.x += (S.lookT.x - S.look.x) * (1 - Math.pow(0.003, dt)); S.look.y += (S.lookT.y - S.look.y) * (1 - Math.pow(0.003, dt));
  frame(); requestAnimationFrame(tick);
}
host.addEventListener('pointerdown', e => { S.drag = { x: e.clientX, y: e.clientY, yaw: S.yaw, pitch: S.pitch, t: performance.now() }; host.setPointerCapture(e.pointerId); lastIn = performance.now(); });
host.addEventListener('pointermove', e => { if (!S.drag) return; const nyaw = S.drag.yaw + (e.clientX - S.drag.x) * 0.01; S.vyaw = (nyaw - S.yaw) * 60; S.yaw = nyaw; S.pitch = Math.max(-0.35, Math.min(0.5, S.drag.pitch + (e.clientY - S.drag.y) * 0.005)); lastIn = performance.now(); });
host.addEventListener('pointerup', () => { S.drag = null; lastIn = performance.now(); });
addEventListener('pointermove', e => {
  const r = host.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
  if (!S.drag) { lastIn = performance.now(); S.lookT.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 0.8))); S.lookT.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height * 0.3)) / (r.height * 0.8))); }
}, { passive: true });

// ---------------- UI
const ids = [['baby', 'Baby'], ['kid', 'Kid'], ['teen', 'Teen'], ['young', 'Young'], ['curls', 'Curls'], ['now', 'Now']];
const chips = document.getElementById('me3dChips');
ids.forEach(([id, label]) => { const b = document.createElement('button'); b.textContent = label; b.dataset.id = id; b.onclick = () => { mark(id); load(id, S.full); }; chips.appendChild(b); });
const mark = id => [...chips.children].forEach(b => b.classList.toggle('on', b.dataset.id === id));
const fb = document.getElementById('me3dBody'); fb.onclick = () => { S.full = !S.full; fb.textContent = S.full ? 'view: full body' : 'view: half body'; load(S.id, S.full); };
new IntersectionObserver(e => {
  vis = e[0].isIntersecting;
  if (vis && !gl) { if (!initGL()) { host.textContent = 'WebGL is not available in this browser.'; return; } mark('now'); load('now', false); }
  if (vis) { last = performance.now(); requestAnimationFrame(tick); }
}, { rootMargin: '100px 0px' }).observe(host);
})();
