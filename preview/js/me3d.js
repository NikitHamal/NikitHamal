/*!
 * 3D me — a small dependency-free WebGL viewer for the sculpted figurines.
 * Each age is one mesh sculpted in code (tools/sculpt3d.py): a signed-distance-field figure —
 * skull + the real measured 3D face, ears, neck, hair sculpted for that age, and a full body —
 * meshed with marching cubes and decimated. Vertex colours carry the painted portrait on the face.
 * Half body / full body are two framings of the same figure. The head follows the pointer,
 * the chest breathes, drag to orbit; buffers are freed on every switch.
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
  float chest = smoothstep(-2.6, -1.2, q.y) * (1.0 - smoothstep(-0.9, -0.5, q.y)); q.xz *= 1.0 + breath * 0.012 * chest;
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
  vec3 base = mix(vc, texture2D(T, vuv).rgb, vt);   // the painting, mapped onto the measured face
  // the painting already carries its own light: textured areas get gentle shading, solid parts full
  float shade = mix(0.38 + 0.66 * d1 + 0.18 * d2, 0.74 + 0.34 * d1 + 0.08 * d2, vt);
  vec3 col = base * shade + rim * vec3(1.0, 0.95, 0.88) * 0.16 * (1.0 - vt * 0.85);
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

// ---------------- assets: art/<id>/figure.me3d (chunked, listed in art/index.json)
let manifest; const files = {};
const blob = f => files[f] || (files[f] = (manifest = manifest || fetch('art/index.json').then(r => r.json()))
  .then(m => Promise.all(Array.from({ length: m[f] }, (_, i) => fetch(`art/${f}.${i}`).then(r => r.arrayBuffer())))).then(p => new Blob(p)));
function parse(buf) {
  const dv = new DataView(buf); let o = 4; const nv = dv.getUint32(o, true), nf = dv.getUint32(o + 4, true); o += 8;
  const lo = [0, 1, 2].map(i => dv.getFloat32(o + i * 4, true)), hi = [0, 1, 2].map(i => dv.getFloat32(o + 12 + i * 4, true)); o += 24;
  const ground = dv.getFloat32(o, true), halfBottom = dv.getFloat32(o + 4, true), crown = dv.getFloat32(o + 8, true); o += 16;
  const q = new Uint16Array(buf.slice(o, o + nv * 6)); o += nv * 6;
  const nb = new Int8Array(buf, o, nv * 3); o += nv * 3; const cb = new Uint8Array(buf, o, nv * 3); o += nv * 3;
  const pb = new Uint8Array(buf, o, nv); o += nv; const wb = new Uint8Array(buf, o, nv); o += nv; const ub = new Uint16Array(buf.slice(o, o + nv * 4)); o += nv * 4;
  const isz = dv.getUint8(o); o += 1; const idx = isz === 4 ? new Uint32Array(buf.slice(o, o + nf * 12)) : new Uint16Array(buf.slice(o, o + nf * 6));
  const v = new Float32Array(nv * 13);
  for (let i = 0; i < nv; i++) {
    const k = i * 13;
    for (let a = 0; a < 3; a++) { v[k + a] = lo[a] + q[i * 3 + a] / 65535 * (hi[a] - lo[a]); v[k + 3 + a] = nb[i * 3 + a] / 127; v[k + 8 + a] = cb[i * 3 + a] / 255; }
    v[k + 6] = ub[i * 2] / 65535; v[k + 7] = ub[i * 2 + 1] / 65535; v[k + 11] = pb[i] / 255; v[k + 12] = wb[i] / 255;
  }
  return { v, idx, isz, ground, halfBottom, crown };
}

// ---------------- scene state
const S = { id: 'now', full: false, yaw: 0, pitch: 0.04, vyaw: 0, drag: null, look: { x: 0, y: 0 }, lookT: { x: 0, y: 0 }, t: 0, vb: null, ib: null, count: 0, itype: 0, frame: { top: 1, bottom: -1 } };
let job = 0, want = 'now'; const meshes = {};
async function load(id, full) {
  if (!gl && !initGL()) return;
  const my = ++job; S.full = full; host.classList.add('loading');
  if (S.id !== id || !S.count) {
    const m = meshes[id] || (meshes[id] = blob(`${id}/figure.me3d`).then(b => b.arrayBuffer()).then(parse));
    const M = await m; if (my !== job) return;
    if (S.vb) { gl.deleteBuffer(S.vb); gl.deleteBuffer(S.ib); }
    S.vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, S.vb); gl.bufferData(gl.ARRAY_BUFFER, M.v, gl.STATIC_DRAW);
    S.ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, S.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, M.idx, gl.STATIC_DRAW);
    S.count = M.idx.length; S.itype = M.isz === 4 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT; S.M = M; S.id = id;
    const img = await createImageBitmap(await blob(`${id}/paintlarge.webp`));
    if (!S.tex) S.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, S.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img); img.close();
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    delete meshes[id];   // the GPU has it now; drop the CPU copy
    meshes[id] = Promise.resolve(M);
  }
  const M = S.M;
  S.frame = { top: M.crown + 0.06, bottom: M.ground + 0.02 };
  host.classList.remove('loading');
  const st = document.getElementById('me3dStatus'); if (st) st.textContent = `${(S.count / 3).toLocaleString()} triangles`;
}

// ---------------- render loop (only while on screen)
function frame() {
  const w = Math.round(host.clientWidth * DPR), h = Math.round(host.clientHeight * DPR);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if (!S.count) return;
  const top = S.frame.top, bot = S.frame.bottom, mid = (top + bot) / 2, size = top - bot;
  const fov = 0.42, dist = size / 2 / Math.tan(fov / 2) * 1.08 + 0.6;
  const P = m4.persp(fov, w / h, 0.1, 100);
  const V = m4.mul(m4.tr(0, -mid, -dist), m4.mul(m4.rx(S.pitch), m4.ry(S.yaw)));
  // camera position for rim light
  const eye = [Math.sin(-S.yaw) * dist, mid, Math.cos(S.yaw) * dist];
  // head: turn toward the pointer around the neck
  const nk = -0.55, Hm = m4.mul(m4.tr(0, nk, 0), m4.mul(m4.ry(S.look.x * 0.42), m4.mul(m4.rx(-S.look.y * 0.22), m4.tr(0, -nk, 0))));
  gl.useProgram(prog);
  gl.uniformMatrix4fv(loc.P, false, P); gl.uniformMatrix4fv(loc.V, false, V); gl.uniformMatrix4fv(loc.M, false, m4.tr(0, 0, 0)); gl.uniformMatrix4fv(loc.Hm, false, Hm);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S.tex);
  gl.uniform3fv(loc.eye, eye); gl.uniform1f(loc.breath, Math.sin(S.t * 2.1)); gl.uniform1i(loc.T, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, S.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, S.ib);
  const B = 13 * 4;
  [['p', 3, 0], ['n', 3, 12], ['uv', 2, 24], ['c', 3, 32], ['f', 2, 44]].forEach(([a, n, o]) => { gl.enableVertexAttribArray(loc[a]); gl.vertexAttribPointer(loc[a], n, gl.FLOAT, false, B, o); });
  gl.drawElements(gl.TRIANGLES, S.count, S.itype, 0);
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
ids.forEach(([id, label]) => { const b = document.createElement('button'); b.textContent = label; b.dataset.id = id; b.onclick = () => { mark(id); want = id; S.count = S.id === id ? S.count : 0; load(id, S.full); }; chips.appendChild(b); });
const mark = id => [...chips.children].forEach(b => b.classList.toggle('on', b.dataset.id === id));
const fb = document.getElementById('me3dBody'); if (fb) fb.onclick = () => { const full = !S.full; fb.textContent = full ? 'view: full body' : 'view: half body'; load(want, full); };
new IntersectionObserver(e => {
  vis = e[0].isIntersecting;
  if (vis && !S.count && !job) { if (!gl && !initGL()) { host.textContent = 'WebGL is not available in this browser.'; return; } mark('now'); load('now', false); }
  if (vis) { last = performance.now(); requestAnimationFrame(tick); }
}, { rootMargin: '100px 0px' }).observe(host);
})();
