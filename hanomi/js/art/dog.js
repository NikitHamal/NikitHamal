// Hanomi — in-game dog sprites, baked from the portfolio's <pixel-dog> rig (../js/pixel-dog.js).
// The rig renders at its native size; we bake each pose, halve it with a feature-preserving
// mode filter and re-outline it so it sits naturally next to 16px-tile characters.
import { Spr } from '../pix.js';

const PRIORITY = { 8: 3, 27: 3, 18: 3, 10: 2, 17: 2, 12: 1.6, 13: 1.6, 1: 1.3 };

function rigOrNull() { const C = window.customElements && customElements.get('pixel-dog'); return C && C.rig; }

function shift(P, dx, dy) {
  for (const k of ['b', 'th', 'ne', 'ch', 'hd', 'tl']) { P[k][0] += dx; P[k][1] += dy; }
  for (const l of P.legs) { l[0] += dx; l[1] += dy; l[2] += dx * 0.5; l[3] += dy * 0.5; }
}
function headMove(P, dx, dy) { P.hd[0] += dx; P.hd[1] += dy; P.ne[0] += dx * 0.4; P.ne[1] += dy * 0.4; }

const EXTRA = {
  wolf: { fur: '6a6e78', fur2: 'c8ccd4', tan: '6a6e78', eyes: 'f2c23a', collar: '6a6e78', outline: '1c2128', pattern: 'mask', ears: 'pointy', tail: 'saber' },
  shadow: { fur: '2a2630', fur2: '4a4250', tan: '2a2630', eyes: 'e8302a', collar: '2a2630', outline: '0e0c10', pattern: 'solid', ears: 'pointy', tail: 'saber' },
};
export function lookFor(breed) {
  const R = rigOrNull(); const B = EXTRA[breed] || R.BREEDS[breed] || R.BREEDS.bernese;
  const V = Object.assign({}, B); V.m = R.PATTERNS[V.pattern] || {}; return V;
}

function poseSet(R) {
  const { cp, gait, WALK_PH, RUN_PH, poses: Q } = R;
  const out = {};
  const wag = (P, a) => { P.tl[2] += a; };
  out.walk = [], out.run = [], out.idle = [], out.sit = [], out.sleep = [], out.happy = [], out.bark = [], out.lie = [], out.sniff = [];
  for (let i = 0; i < 8; i++) {
    const ph = i / 8 * Math.PI * 2, P = cp(Q.STAND); gait(P, ph, 3.4, 2.6, WALK_PH);
    if (Math.sin(ph * 2) > 0.3) shift(P, 0, -1); wag(P, Math.sin(ph) * 0.2); out.walk.push(P);
  }
  for (let i = 0; i < 6; i++) {
    const ph = i / 6 * Math.PI * 2, P = cp(Q.STAND); gait(P, ph, 6, 4, RUN_PH); shift(P, 0, -(Math.sin(ph) + 1) * 1.2);
    P.b[4] = Math.sin(ph + 0.6) * 0.08; P.ears = [-2.5, 2, -2, 2]; P.mouth = 'pant'; P.tl[4] = 0.6; P.tl[2] += Math.sin(ph * 2) * 0.15; out.run.push(P);
  }
  for (let i = 0; i < 4; i++) { const P = cp(Q.STAND); wag(P, Math.sin(i / 4 * Math.PI * 2) * 0.3); if (i === 2) P.eye = 'blink'; out.idle.push(P); }
  for (let i = 0; i < 4; i++) { const P = cp(Q.SIT); wag(P, Math.sin(i / 4 * Math.PI * 2) * 0.12); if (i >= 2) P.mouth = 'pant'; out.sit.push(P); }
  for (let i = 0; i < 2; i++) { const P = cp(Q.SLEEP); P.b[3] += i ? 0.3 : -0.2; out.sleep.push(P); }
  for (let i = 0; i < 4; i++) { const P = cp(Q.SIT); P.eye = 'happy'; P.blush = 1; P.ears = [-2.5, 2.5, -2, 2.5]; headMove(P, 0, -1); P.muz = -1; P.mouth = 'pant'; wag(P, Math.sin(i / 4 * Math.PI * 2) * 0.35); out.happy.push(P); }
  for (let i = 0; i < 2; i++) { const P = cp(Q.STAND); headMove(P, 0, -1); P.muz = -1; P.ears = [0.5, -1, 0.5, -1]; P.tl[4] = 0.5; if (i) P.mouth = 'bark'; out.bark.push(P); }
  { const P = cp(Q.LIE); out.lie.push(P); const P2 = cp(Q.LIE); P2.eye = 'half'; out.lie.push(P2); }
  for (let i = 0; i < 2; i++) { const P = cp(Q.SNIFF); P.hd[1] += i; out.sniff.push(P); }
  return out;
}

function halve(L, w, h) {
  const W2 = Math.ceil(w / 2), H2 = Math.ceil(h / 2), o = new Uint8Array(W2 * H2);
  const cnt = new Map();
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
    cnt.clear(); let n = 0;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const xx = x * 2 + i, yy = y * 2 + j; if (xx >= w || yy >= h) continue;
      const c = L.b[yy * w + xx]; if (!c) continue; n++;
      cnt.set(c, (cnt.get(c) || 0) + (PRIORITY[c] || 1));
    }
    if (n < 2) { // keep isolated feature pixels (eyes, nose, tongue)
      if (n === 1) for (const [c] of cnt) if ((PRIORITY[c] || 0) >= 2) o[y * W2 + x] = c;
      continue;
    }
    let best = 0, bw = -1; for (const [c, k] of cnt) if (k > bw) { bw = k; best = c; }
    o[y * W2 + x] = best;
  }
  return { b: o, w: W2, h: H2 };
}

const cache = new Map();
// returns { frames: {walk:[cv...],...}, w, h, ox, oy } ; ox/oy = ground-contact anchor (centre of the dog's paws)
export function bakeDog(breed) {
  if (cache.has(breed)) return cache.get(breed);
  const R = rigOrNull(); if (!R) return null;
  const V = lookFor(breed), pal = R.buildPal(V), poses = poseSet(R);
  const L = R.mk(R.DW, R.H);
  const res = { frames: {}, full: {}, w: 0, h: 0 };
  const outline = pal[1];
  for (const k in poses) {
    res.frames[k] = poses[k].map(P => {
      R.drawDog(L, P, V);
      const hv = halve(L, R.DW, R.H), s = new Spr(hv.w, hv.h);
      for (let i = 0; i < hv.b.length; i++) if (hv.b[i]) s.d[i] = pal[hv.b[i]];
      // re-outline at the new scale with the breed's own outline colour
      const src = s.d.slice();
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
        const i = y * s.w + x; if (src[i]) continue;
        const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < s.w && yy < s.h && src[yy * s.w + xx];
        if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) s.d[i] = outline;
      }
      return { n: s.canvas(), f: s.flipX().canvas() };
    });
    res.w = Math.ceil(R.DW / 2); res.h = Math.ceil(R.H / 2);
  }
  res.ox = Math.round(R.X0 / 2); res.oy = Math.round(R.G / 2);
  cache.set(breed, res);
  return res;
}
