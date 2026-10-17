/*!
 * Stroke player: every portrait on this page is a list of brush strokes computed by code
 * (tools/paint.py) and painted live onto a canvas here. No image files are used.
 * Format PNT1: W,H,nLayers,bgTop,bgBot; per layer: radius,count; per stroke: rgb,n,x0,y0,(dx,dy)*
 */
(() => {
'use strict';
const cache = {};
// stroke files are split into small parts (data/<name>.<i>), listed in data/index.json
let manifest;
function load(url) {
  const name = url.replace(/^.*\//, '').replace(/\.bin$/, ''), base = url.slice(0, url.lastIndexOf('/') + 1);
  manifest = manifest || fetch(base + 'index.json').then(r => r.json());
  return cache[url] || (cache[url] = manifest.then(m => Promise.all(Array.from({ length: m[name] }, (_, i) => fetch(`${base}${name}.${i}`).then(r => r.arrayBuffer()))))
    .then(parts => { const len = parts.reduce((a, p) => a + p.byteLength, 0), all = new Uint8Array(len); let o = 0; for (const p of parts) { all.set(new Uint8Array(p), o); o += p.byteLength; } return parse(all.buffer); }));
}
function parse(buf) {
  const v = new DataView(buf), u8 = new Uint8Array(buf); let o = 4;
  const W = v.getUint16(o, true), H = v.getUint16(o + 2, true), nl = v.getUint8(o + 4); o += 5;
  const bgTop = [u8[o], u8[o + 1], u8[o + 2]], bgBot = [u8[o + 3], u8[o + 4], u8[o + 5]]; o += 6;
  const layers = [];
  for (let l = 0; l < nl; l++) {
    const R = v.getFloat32(o, true), n = v.getUint32(o + 4, true); o += 8;
    const strokes = new Array(n);
    for (let i = 0; i < n; i++) {
      const col = `rgb(${u8[o]},${u8[o + 1]},${u8[o + 2]})`, np = u8[o + 3]; let x = v.getUint16(o + 4, true), y = v.getUint16(o + 6, true); o += 8;
      const pts = new Int16Array(np * 2); pts[0] = x; pts[1] = y;
      for (let k = 1; k < np; k++) { x += v.getInt8(o); y += v.getInt8(o + 1); o += 2; pts[k * 2] = x; pts[k * 2 + 1] = y; }
      strokes[i] = { col, pts };
    }
    layers.push({ R, strokes });
  }
  const total = layers.reduce((a, l) => a + l.strokes.length, 0);
  return { W, H, bgTop, bgBot, layers, total };
}
function stroke(ctx, R, s) {
  const p = s.pts; ctx.strokeStyle = ctx.fillStyle = s.col;
  if (p.length === 2) { ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(0.6, R), 0, 6.283); ctx.fill(); return; }
  ctx.lineWidth = Math.max(1, R * 2); ctx.beginPath(); ctx.moveTo(p[0], p[1]);
  for (let k = 2; k < p.length; k += 2) ctx.lineTo(p[k], p[k + 1]);
  ctx.stroke();
}
function setup(cv, d, scale) {
  cv.width = d.W * scale; cv.height = d.H * scale; const ctx = cv.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.lineCap = ctx.lineJoin = 'round'; return ctx;
}
function background(ctx, d) {
  const g = ctx.createLinearGradient(0, 0, 0, d.H); g.addColorStop(0, `rgb(${d.bgTop})`); g.addColorStop(1, `rgb(${d.bgBot})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, d.W, d.H);
}
// instant render
function draw(cv, d, scale = 2) { const ctx = setup(cv, d, scale); background(ctx, d); for (const l of d.layers) for (const s of l.strokes) stroke(ctx, l.R, s); }
// animated render: coarse strokes first, fine detail last. `over` keeps whatever is already on the canvas
function play(cv, d, { duration = 6000, scale = 2, over = false, onDone } = {}) {
  let ctx;
  if (over && cv.width === d.W * scale) { ctx = cv.getContext('2d'); ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.lineCap = ctx.lineJoin = 'round'; }
  else { ctx = setup(cv, d, scale); background(ctx, d); }
  const seq = []; d.layers.forEach((l, li) => l.strokes.forEach(s => seq.push(li, s)));
  // later layers have many more strokes; weight time so each layer gets a fair share
  const nl = d.layers.length, layerStart = [], share = d.layers.map((l, i) => 1 + i * 0.35), tot = share.reduce((a, b) => a + b, 0);
  let acc = 0; share.forEach((s, i) => { layerStart[i] = acc; acc += s / tot; });
  const idxStart = []; let c = 0; d.layers.forEach((l, i) => { idxStart[i] = c; c += l.strokes.length; });
  let done = 0, t0 = performance.now(), stopped = false;
  const target = t => { // strokes that should be painted at normalised time t
    const e = 1 - Math.pow(1 - t, 1.6); let li = nl - 1; while (li > 0 && layerStart[li] > e) li--;
    const span = (li < nl - 1 ? layerStart[li + 1] : 1) - layerStart[li], f = Math.min(1, (e - layerStart[li]) / span);
    return idxStart[li] + Math.floor(d.layers[li].strokes.length * f);
  };
  function frame(now) {
    if (stopped) return;
    const t = Math.min(1, (now - t0) / duration), upto = t >= 1 ? d.total : target(t);
    while (done < upto) { const li = seq[done * 2], s = seq[done * 2 + 1]; stroke(ctx, d.layers[li].R, s); done++; }
    if (t < 1) requestAnimationFrame(frame); else onDone && onDone();
  }
  requestAnimationFrame(frame);
  return { stop() { stopped = true; } };
}
window.Strokes = { load, draw, play };
})();
