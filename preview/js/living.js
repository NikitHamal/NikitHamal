/*!
 * Living paintings — one shared WebGL context animates every painted portrait on the page.
 * Each portrait is the painting (without eyes) warped per pixel by its motion map
 * (art/<id>/motion.png: R = hair freedom, G = head, B = chest, from tools/motion.py):
 *   • hair sways in a soft breeze with occasional gusts; loose ends move most, roots barely
 *   • brush the hair with the cursor / finger and it follows the stroke, then settles
 *   • tap to send a little ripple through the hair
 *   • the head turns gently toward you (the live eyes are moved in sync), the chest breathes
 * Frames are rendered into the shared canvas and copied to each visible portrait's own canvas.
 */
window.Living = (() => {
'use strict';
const DPR = Math.min(2, devicePixelRatio || 1), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FW = 24, FH = 30;   // brush field resolution
let gl, prog, loc = {}, buf, glc, getBlob, pivots;
const items = new Set();

const VS = 'attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }';
const FS = `precision highp float;
varying vec2 uv; uniform sampler2D img, mot, fld;
uniform float t, wind, breath, ang, gust; uniform vec2 hd, piv, asp;
void main(){
  vec4 m = texture2D(mot, uv);
  vec2 f = (texture2D(fld, uv).rg - 0.5) * 2.0;                 // brushed velocity field
  // breeze: two travelling waves, stronger lower down the hair, plus a gust front sweeping across
  float w1 = sin(t * 1.6 + uv.y * 9.0 + uv.x * 3.0), w2 = sin(t * 2.7 - uv.y * 14.0 + uv.x * 7.0);
  float g = gust * smoothstep(0.0, 0.3, 1.0 - abs(uv.x - fract(t * 0.23) * 1.6 + 0.3));
  vec2 hair = vec2(w1 * 0.6 + w2 * 0.25 + g * 1.4, w2 * 0.25 + abs(w1) * 0.12) * wind * 0.0085 + f * 0.045;
  vec2 q = uv - hair * m.r;
  // head turn: rotate the head region about the neck pivot (in aspect-correct space)
  vec2 d = (q - piv) * asp; float a = -ang * m.g; d = mat2(cos(a), sin(a), -sin(a), cos(a)) * d;
  q = mix(q, piv + d / asp, m.g) - hd * m.g;
  // breathing: the chest swells a touch
  q.y -= breath * 0.0028 * m.b; q.x = mix(q.x, 0.5 + (q.x - 0.5) / (1.0 + breath * 0.004), m.b);
  gl_FragColor = vec4(texture2D(img, clamp(q, 0.0, 1.0)).rgb, 1.0);
}`;

function init() {
  glc = document.createElement('canvas');
  gl = glc.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
  if (!gl) return false;
  const sh = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
  for (const u of ['img', 'mot', 'fld', 't', 'wind', 'breath', 'ang', 'gust', 'hd', 'piv', 'asp']) loc[u] = gl.getUniformLocation(prog, u);
  buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const pl = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(pl); gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(loc.img, 0); gl.uniform1i(loc.mot, 1); gl.uniform1i(loc.fld, 2);
  return true;
}
const texCache = {};
function texture(key, src) {
  return texCache[key] || (texCache[key] = src().then(bm => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bm); bm.close && bm.close();
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  }));
}
const bitmapOf = f => getBlob(f).then(b => createImageBitmap(b));

// ---- one portrait
async function attach(el, id, variant, opts = {}) {
  if (!gl && !init()) return null;
  pivots = pivots || await fetch('art/motion.json').then(r => r.json());
  const [img, mot] = await Promise.all([texture(id + variant, () => bitmapOf(`${id}/${variant}.webp`)), texture(id + 'm', () => bitmapOf(`${id}/motion.png`))]);
  detach(el);
  const cv = document.createElement('canvas'); cv.className = 'living'; el.insertBefore(cv, el.querySelector('svg.eyes'));
  const fldTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, fldTex);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  const it = { el, id, cv, ctx: cv.getContext('2d'), img, mot, fldTex, vx: new Float32Array(FW * FH), vy: new Float32Array(FW * FH), bytes: new Uint8Array(FW * FH * 4),
    piv: pivots[id], fps: opts.fps || 30, last: 0, seed: Math.random() * 100, visible: true, lp: null, ripple: 0, head: { a: 0, x: 0, y: 0 } };
  it.io = new IntersectionObserver(e => (it.visible = e[0].isIntersecting), { rootMargin: '50px 0px' }); it.io.observe(el);
  const local = e => { const r = el.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  it.onMove = e => {   // brushing: add the pointer's velocity into the field around it
    const [x, y] = local(e); if (it.lp) { const dx = x - it.lp[0], dy = y - it.lp[1]; splat(it, x, y, dx * 9, dy * 9, 0.09); } it.lp = [x, y];
  };
  it.onLeave = () => (it.lp = null);
  it.onDown = e => { const [x, y] = local(e); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; splat(it, x + Math.cos(a) * 0.05, y + Math.sin(a) * 0.05, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.06); } };
  el.addEventListener('pointermove', it.onMove); el.addEventListener('pointerleave', it.onLeave); el.addEventListener('pointerdown', it.onDown);
  items.add(it); el._living = it; start(); return it;
}
function detach(el) {
  const it = el._living; if (!it) return;
  items.delete(it); it.io.disconnect(); gl.deleteTexture(it.fldTex); it.cv.remove();
  el.removeEventListener('pointermove', it.onMove); el.removeEventListener('pointerleave', it.onLeave); el.removeEventListener('pointerdown', it.onDown);
  const ov = el.querySelector('svg.eyes'); if (ov) ov.style.transform = ''; el._living = null;
}
function splat(it, x, y, vx, vy, r) {
  for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) {
    const dx = (i + 0.5) / FW - x, dy = (j + 0.5) / FH - y, w = Math.exp(-(dx * dx + dy * dy) / (r * r));
    if (w < 0.01) continue; const k = j * FW + i; it.vx[k] += vx * w; it.vy[k] += vy * w;
  }
}
function stepField(it, dt) {
  const vx = it.vx, vy = it.vy, decay = Math.pow(0.06, dt);   // spring back to rest in ~1s
  for (let k = 0; k < vx.length; k++) {
    const i = k % FW, j = (k / FW) | 0;
    const nx = (vx[k - (i > 0)] + vx[k + (i < FW - 1)] + vx[k - (j > 0) * FW] + vx[k + (j < FH - 1) * FW]) / 4, ny = (vy[k - (i > 0)] + vy[k + (i < FW - 1)] + vy[k - (j > 0) * FW] + vy[k + (j < FH - 1) * FW]) / 4;
    vx[k] = (vx[k] * 0.8 + nx * 0.2) * decay; vy[k] = (vy[k] * 0.8 + ny * 0.2) * decay;
    const b = k * 4; it.bytes[b] = Math.max(0, Math.min(255, 128 + vx[k] * 127)); it.bytes[b + 1] = Math.max(0, Math.min(255, 128 + vy[k] * 127)); it.bytes[b + 3] = 255;
  }
}

// ---- loop
let running = false, t0 = performance.now(), lastT = t0, gustT = 0, gust = 0;
function start() { if (!running) { running = true; requestAnimationFrame(loop); } }
function loop(now) {
  if (!items.size) { running = false; return; }
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; const t = (now - t0) / 1000;
  // gusts: every so often the breeze picks up for a couple of seconds
  gustT -= dt; if (gustT < 0) { gustT = 5 + Math.random() * 7; gust = 1; } gust *= Math.pow(0.45, dt);
  for (const it of items) {
    if (!it.visible || document.hidden) continue;
    if (now - it.last < 1000 / it.fps - 2) continue; const idt = Math.min(0.1, (now - (it.last || now)) / 1000); it.last = now;
    stepField(it, idt);
    const r = it.el.getBoundingClientRect(), w = Math.round(r.width * DPR), h = Math.round(r.height * DPR); if (!w || !h) continue;
    if (it.cv.width !== w || it.cv.height !== h) { it.cv.width = w; it.cv.height = h; }
    if (glc.width < w || glc.height < h) { glc.width = Math.max(glc.width, w); glc.height = Math.max(glc.height, h); }
    // head follows the gaze set by preview.js (el._g), eased
    const g = it.el._g || { x: 0, y: 0 }, hd = it.head, k = 1 - Math.pow(0.02, idt);
    hd.a += (g.x * 0.035 - hd.a) * k; hd.x += (g.x * 0.004 - hd.x) * k; hd.y += (g.y * 0.003 - hd.y) * k;
    const breath = Math.sin(t * 1.9 + it.seed);
    gl.viewport(0, glc.height - h, w, h);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, it.img);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, it.mot);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, it.fldTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, FW, FH, 0, gl.RGBA, gl.UNSIGNED_BYTE, it.bytes);
    gl.uniform1f(loc.t, reduce ? 0 : t + it.seed); gl.uniform1f(loc.wind, reduce ? 0 : 1); gl.uniform1f(loc.gust, reduce ? 0 : gust);
    gl.uniform1f(loc.breath, reduce ? 0 : breath); gl.uniform1f(loc.ang, hd.a); gl.uniform2f(loc.hd, hd.x, hd.y);
    gl.uniform2f(loc.piv, it.piv.neck[0], it.piv.neck[1]); gl.uniform2f(loc.asp, 1, h / w);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    it.ctx.drawImage(glc, 0, 0, w, h, 0, 0, w, h);
    // keep the live eyes glued to the turning head
    const ov = it.el.querySelector('svg.eyes');
    if (ov) { ov.style.transformOrigin = `${it.piv.neck[0] * 100}% ${it.piv.neck[1] * 100}%`; ov.style.transform = `translate(${(hd.x * 100).toFixed(3)}%,${(hd.y * 100).toFixed(3)}%) rotate(${(hd.a * 57.2958).toFixed(3)}deg)`; }
  }
  requestAnimationFrame(loop);
}
return { setLoader(fn) { getBlob = fn; }, attach, detach };
})();
