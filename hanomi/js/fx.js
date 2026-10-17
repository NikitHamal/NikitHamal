// Hanomi — lightweight particle system (pooled), drawn as tiny pixel rects.
import { rand, TAU } from './util.js';
const MAX = 900;
export class FX {
  constructor() { this.p = []; for (let i = 0; i < MAX; i++) this.p.push({ on: false }); this.n = 0; this.shakeT = 0; this.shakeA = 0; }
  spawn(o) {
    let q = null; for (let k = 0; k < 40; k++) { const c = this.p[(this.n++) % MAX]; if (!c.on) { q = c; break; } }
    if (!q) q = this.p[(this.n++) % MAX];
    q.on = true; q.x = o.x; q.y = o.y; q.z = o.z || 0; q.vx = o.vx || 0; q.vy = o.vy || 0; q.vz = o.vz || 0; q.g = o.g ?? 0; q.life = 0; q.max = o.life || 1;
    q.c = o.c || '#fff'; q.s = o.s || 1; q.k = o.k || 'dot'; q.drag = o.drag ?? 1; q.ph = Math.random() * TAU; q.top = !!o.top; q.fade = o.fade ?? true; q.c2 = o.c2; q.txt = o.txt;
    return q;
  }
  burst(x, y, n, cols, o = {}) {
    for (let i = 0; i < n; i++) { const a = rand(TAU), sp = rand(o.sp0 || 15, o.sp1 || 50);
      this.spawn({ x, y, z: o.z ?? rand(2, 8), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: rand(o.vz0 ?? 20, o.vz1 ?? 60), g: o.g ?? 160, life: rand(o.l0 || 0.4, o.l1 || 0.8), c: cols[(Math.random() * cols.length) | 0], s: o.s || 1, drag: o.drag ?? 0.9, k: o.k || 'dot' }); }
  }
  shake(a, t = 0.2) { if (a > this.shakeA) { this.shakeA = a; this.shakeT = t; } }
  update(dt) {
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeA = 0; }
    for (const q of this.p) {
      if (!q.on) continue; q.life += dt; if (q.life >= q.max) { q.on = false; continue; }
      const d = Math.pow(q.drag, dt * 60);
      q.vx *= d; q.vy *= d; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.g) { q.vz -= q.g * dt; q.z += q.vz * dt; if (q.z < 0) { q.z = 0; q.vz *= -0.3; q.vx *= 0.6; q.vy *= 0.6; } }
      else q.z += q.vz * dt;
      if (q.k === 'petal' || q.k === 'leaf') { q.x += Math.sin(q.life * 3 + q.ph) * 12 * dt; }
    }
  }
  draw(ctx, ox, oy, top) {
    for (const q of this.p) {
      if (!q.on || q.top !== top) continue;
      const t = q.life / q.max, x = Math.round(q.x - ox), y = Math.round(q.y - oy - q.z);
      if (q.fade && t > 0.75 && ((q.life * 20) | 0) % 2) continue;
      ctx.fillStyle = q.c;
      if (q.k === 'petal') { const f = ((q.life * 6 + q.ph) | 0) % 3; ctx.fillRect(x, y, f === 1 ? 1 : 2, f === 1 ? 2 : 1); }
      else if (q.k === 'ring') { const r = Math.round(1 + t * q.s); ctx.fillRect(x - r, y, 1, 1); ctx.fillRect(x + r, y, 1, 1); ctx.fillRect(x, y - (r >> 1), 1, 1); ctx.fillRect(x, y + (r >> 1), 1, 1); }
      else if (q.k === 'heart') { ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x - 1, y + 1, 3, 1); ctx.fillRect(x, y + 2, 1, 1); }
      else if (q.k === 'spark') { ctx.fillRect(x, y, 1, 1); if (t < 0.5) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); } }
      else if (q.k === 'smoke') { const r = Math.round(1 + t * q.s); ctx.globalAlpha = 0.5 * (1 - t); ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }
      else if (q.k === 'glow') { const a = 0.5 + 0.5 * Math.sin(q.life * 4 + q.ph); ctx.globalAlpha = a; ctx.fillRect(x, y, 1, 1); ctx.globalAlpha = a * 0.35; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); ctx.globalAlpha = 1; }
      else if (q.k === 'z') { ctx.fillRect(x, y, 3, 1); ctx.fillRect(x + 1, y + 1, 1, 1); ctx.fillRect(x, y + 2, 3, 1); }
      else ctx.fillRect(x, y, q.s, q.s);
    }
  }
}
