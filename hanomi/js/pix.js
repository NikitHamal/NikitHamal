// Hanomi — tiny pixel-art raster: draw into RGBA buffers, then bake to canvases.
import { clamp, hash2, bayer } from './util.js';

const abgr = (h, a = 255) => ((a << 24) | ((h & 255) << 16) | (h & 0xff00) | ((h >> 16) & 255)) >>> 0;
export const toHex = c => ((c & 255) << 16) | (c & 0xff00) | ((c >> 16) & 255);

export class Spr {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { x |= 0; y |= 0; return this.in(x, y) ? this.d[y * this.w + x] : 0; }
  set(x, y, h, a = 255) { x = Math.floor(x); y = Math.floor(y); if (!this.in(x, y) || h == null || h < 0) return; this.d[y * this.w + x] = abgr(h, a); }
  setRaw(x, y, c) { x = Math.floor(x); y = Math.floor(y); if (this.in(x, y)) this.d[y * this.w + x] = c; }
  has(x, y) { return (this.get(x, y) >>> 24) > 0; }
  hex(x, y) { return toHex(this.get(x, y)); }
  blend(x, y, h, a) {
    x = Math.floor(x); y = Math.floor(y); if (!this.in(x, y)) return;
    const i = y * this.w + x, c = this.d[i];
    if (!(c >>> 24)) { this.d[i] = abgr(h, Math.round(a * 255)); return; }
    const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
    const R = (h >> 16) & 255, G = (h >> 8) & 255, B = h & 255;
    this.d[i] = ((c & 0xff000000) | (Math.round(b + (B - b) * a) << 16) | (Math.round(g + (G - g) * a) << 8) | Math.round(r + (R - r) * a)) >>> 0;
  }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, typeof c === 'function' ? c(x + i, y + j, i, j) : c); }
  // filled ellipse with an optional shader(u,v,x,y) → colour ; u,v in -1..1
  ell(cx, cy, rx, ry, c) {
    const fn = typeof c === 'function';
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry;
        if (u * u + v * v <= 1) { const col = fn ? c(u, v, x, y) : c; if (col != null && col >= 0) this.set(x, y, col); }
      }
  }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy, k = 0;
    for (;;) { this.set(x0, y0, typeof c === 'function' ? c(k++) : c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  // thick tapered stroke
  stroke(x0, y0, x1, y1, w0, w1, c) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let i = 0; i <= n; i++) { const t = i / n, r = (w0 + (w1 - w0) * t) / 2; this.ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, Math.max(0.5, r), Math.max(0.5, r), typeof c === 'function' ? c(t) : c); }
  }
  poly(pts, c) {
    let y0 = 1e9, y1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const xs = [], py = y + 0.5;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= py && b[1] > py) || (b[1] <= py && a[1] > py)) xs.push(a[0] + (py - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, typeof c === 'function' ? c(x, y) : c);
    }
  }
  // 1px outline around opaque pixels. mode: 'out' (outside), sel(x,y,neighbourHex) to colour by neighbour
  outline(c, diag = false) {
    const { w, h, d } = this, src = d.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (src[i] >>> 24) continue;
      const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && (src[yy * w + xx] >>> 24);
      let hit = n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1);
      if (!hit && diag) hit = n(x - 1, y - 1) || n(x + 1, y - 1) || n(x - 1, y + 1) || n(x + 1, y + 1);
      if (hit) { let col = c; if (typeof c === 'function') { const nb = n(x, y - 1) ? src[(y - 1) * w + x] : n(x, y + 1) ? src[(y + 1) * w + x] : n(x - 1, y) ? src[y * w + x - 1] : src[y * w + x + 1]; col = c(toHex(nb), x, y); } if (col != null) d[i] = abgr(col); }
    }
    return this;
  }
  // darken opaque pixels whose (dx,dy) neighbour is empty — cheap form shading
  rim(dx, dy, f, only) {
    const { w, h, d } = this, src = d.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, c = src[i]; if (!(c >>> 24)) continue;
      const xx = x + dx, yy = y + dy, empty = !(xx >= 0 && yy >= 0 && xx < w && yy < h) || !(src[yy * w + xx] >>> 24);
      if (empty && (!only || only(toHex(c)))) d[i] = abgr(typeof f === 'function' ? f(toHex(c)) : mul(toHex(c), f), c >>> 24);
    }
    return this;
  }
  map(fn) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const i = y * this.w + x, c = this.d[i]; if (!(c >>> 24)) continue; const r = fn(toHex(c), x, y); if (r != null) this.d[i] = abgr(r, c >>> 24); } return this; }
  draw(o, ox, oy, flip = false) { for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) { const c = o.d[y * o.w + (flip ? o.w - 1 - x : x)]; if (c >>> 24) this.setRaw(ox + x, oy + y, c); } return this; }
  flipX() { const s = new Spr(this.w, this.h); s.draw(this, 0, 0, true); return s; }
  canvas() {
    const cv = document.createElement('canvas'); cv.width = this.w; cv.height = this.h;
    const cx = cv.getContext('2d'), im = cx.createImageData(this.w, this.h);
    new Uint32Array(im.data.buffer).set(this.d); cx.putImageData(im, 0, 0); return cv;
  }
}
export const mul = (h, f) => { const c = s => clamp(Math.round(((h >> s) & 255) * f), 0, 255); return (c(16) << 16) | (c(8) << 8) | c(0); };
export const mix = (a, b, t) => { const c = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (c(16) << 16) | (c(8) << 8) | c(0); };
// pick from a colour ramp with dithering at band edges: v in 0..1
export const band = (ramp, v, x, y, dith = 0.5) => {
  const f = clamp(v, 0, 0.9999) * ramp.length, i = Math.floor(f), fr = f - i;
  return ramp[clamp(i + (fr - 0.5 > (bayer(x, y) - 0.5) * dith * 2 && fr > 0.5 ? 1 : 0), 0, ramp.length - 1)];
};
export const noiseAt = (x, y, s = 0) => hash2(x, y, s);

// atlas: pack many canvases into a few big sheets (fewer texture binds)
export class Atlas {
  constructor(size = 1024) { this.size = size; this.sheets = []; this.newSheet(); }
  newSheet() { const c = document.createElement('canvas'); c.width = c.height = this.size; this.cv = c; this.cx = c.getContext('2d'); this.x = 0; this.y = 0; this.rowH = 0; this.sheets.push(c); }
  add(src) {
    const w = src.width, h = src.height;
    if (this.x + w > this.size) { this.x = 0; this.y += this.rowH + 1; this.rowH = 0; }
    if (this.y + h > this.size) this.newSheet();
    this.cx.drawImage(src, this.x, this.y);
    const r = { img: this.cv, x: this.x, y: this.y, w, h };
    this.x += w + 1; this.rowH = Math.max(this.rowH, h); return r;
  }
}
