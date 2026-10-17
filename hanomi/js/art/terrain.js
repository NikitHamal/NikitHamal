// Hanomi — per-pixel terrain baker. Each chunk becomes two canvases:
//   water: depth-shaded water (drawn first, then animated highlights over it)
//   ground: land with organic jittered borders, turf lips, banks, foam (transparent over water)
import { TS, CS, CPX, G, HARD } from '../defs.js';
import { mulberry32, bayer, hash2, hash2i, clamp, fbm } from '../util.js';

const M = 20, SZ = CPX + M * 2;
const pk = (h, a = 255) => ((a << 24) | ((h & 255) << 16) | (h & 0xff00) | ((h >> 16) & 255)) >>> 0;
const RAMPS = {
  [G.GRASS]: [0x3f7d3c, 0x4e9443, 0x5fa84b, 0x74bb57],
  [G.FOREST]: [0x2c5636, 0x34663c, 0x3e7543, 0x4a834b],
  [G.SAKURA]: [0x5a9a4c, 0x68a953, 0x79b75d, 0x8cc469],
  [G.MARSH]: [0x3b4d31, 0x465a37, 0x51673d, 0x5e7445],
  [G.SNOW]: [0xbccbe0, 0xd0dceb, 0xe2eaf4, 0xf2f6fb],
  [G.SAND]: [0xd2b072, 0xdfc183, 0xe9cf95, 0xf2dcab],
  [G.DIRT]: [0x76503a, 0x855c40, 0x946849, 0xa27553],
  [G.PATH]: [0xa27c55, 0xb18a5f, 0xbf986b, 0xcca679],
  [G.ROCK]: [0x6b6763, 0x7a7570, 0x88837d, 0x96918a],
  [G.TILLED]: [0x5a3b27, 0x6a472f, 0x7a5437, 0x88603f],
  [G.WET]: [0x3a2619, 0x45301f, 0x513925, 0x5c412b],
  [G.WOOD]: [0x7d5032, 0x8f5f3b, 0xa06d44, 0xb07c4f],
  [G.COBBLE]: [0x6f7378, 0x7f8388, 0x8f9398, 0xa1a5a8],
  [G.PLAZA]: [0x8a8178, 0x9a9087, 0xa99f95, 0xb8aea3],
};
const P = {}; for (const k in RAMPS) P[k] = RAMPS[k].map(h => pk(h));
const GRASSY = new Uint8Array(32); [G.GRASS, G.FOREST, G.SAKURA, G.MARSH, G.SNOW].forEach(g => GRASSY[g] = 1);
const WATERY = new Uint8Array(32); WATERY[G.WATER] = WATERY[G.DEEP] = 1;
const LOW = new Uint8Array(32); [G.PATH, G.DIRT, G.SAND, G.PLAZA, G.COBBLE, G.TILLED, G.WET, G.ROCK, G.WOOD].forEach(g => LOW[g] = 1);

// ---- tileable textures ----
function wrapNoise(N, period, seed, oct = 3) {
  const out = new Float32Array(N * N);
  for (let o = 0, amp = 1, per = period, tot = 0; o < oct; o++, amp *= 0.5, per *= 2) {
    const cell = N / per;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), ux = fx - ix, uy = fy - iy;
      const sx = ux * ux * (3 - 2 * ux), sy = uy * uy * (3 - 2 * uy);
      const h = (a, b) => hash2((a % per + per) % per, (b % per + per) % per, seed + o);
      const v = h(ix, iy) + (h(ix + 1, iy) - h(ix, iy)) * sx + (h(ix, iy + 1) - h(ix, iy)) * sy + (h(ix, iy) - h(ix + 1, iy) - h(ix, iy + 1) + h(ix + 1, iy + 1)) * sx * sy;
      out[y * N + x] += v * amp;
    }
    tot += amp; if (o === oct - 1) for (let i = 0; i < out.length; i++) out[i] /= tot;
  }
  return out;
}
const N128 = wrapNoise(128, 4, 11, 4), JX = wrapNoise(64, 4, 21, 2), JY = wrapNoise(64, 4, 31, 2), FINE = wrapNoise(64, 16, 41, 2);
const JX2 = wrapNoise(64, 16, 51, 1), JY2 = wrapNoise(64, 16, 61, 1);
const JXi = new Int8Array(4096), JYi = new Int8Array(4096);
for (let i = 0; i < 4096; i++) { JXi[i] = Math.round((JX[i] - 0.5) * 13 + (JX2[i] - 0.5) * 5); JYi[i] = Math.round((JY[i] - 0.5) * 13 + (JY2[i] - 0.5) * 5); }
// tufts: 0 none, 1 dark blade, 2 light blade
const TUFT = new Uint8Array(4096);
{ const r = mulberry32(5); for (let k = 0; k < 150; k++) { const x = (r() * 64) | 0, y = (r() * 64) | 0, kind = r();
  const put = (dx, dy, v) => { TUFT[((y + dy) & 63) * 64 + ((x + dx) & 63)] = v; };
  if (kind < 0.55) { put(0, 0, 1); put(2, 0, 1); put(1, 1, 1); put(1, 0, 2); }
  else if (kind < 0.85) { put(0, 0, 1); put(0, 1, 1); put(1, -1, 2); }
  else { put(0, 0, 2); put(1, 1, 1); } } }
// cobble voronoi (period 48)
const VC = new Int16Array(48 * 48), VE = new Uint8Array(48 * 48);
{ const r = mulberry32(9), pts = []; for (let gy = 0; gy < 6; gy++) for (let gx = 0; gx < 6; gx++) pts.push([(gx + 0.2 + r() * 0.6) * 8, (gy + 0.2 + r() * 0.6) * 8]);
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) { let b1 = 1e9, b2 = 1e9, id = 0;
    for (let k = 0; k < pts.length; k++) for (let oy = -48; oy <= 48; oy += 48) for (let ox = -48; ox <= 48; ox += 48) {
      const d = Math.hypot(x - pts[k][0] - ox, (y - pts[k][1] - oy) * 1.15); if (d < b1) { b2 = b1; b1 = d; id = k; } else if (d < b2) b2 = d; }
    VC[y * 48 + x] = id; VE[y * 48 + x] = b2 - b1 < 1.3 ? 1 : 0; } }

const FLOWER_COLS = [0xffffff, 0xf7d84a, 0xf28fb0, 0x9cc8f4, 0xe8615a, 0xc89cf0];
const W1 = [0x7fd3cf, 0x64c1c6, 0x4caabb, 0x3b92ae, 0x2f7aa0, 0x276592, 0x215582].map(h => pk(h));
const BANK = [0x5e4a2e, 0x4c3b25, 0x3a2e1f].map(h => pk(h)), FOAM = pk(0xeaf7f2), FOAM2 = pk(0xbfe7e4);

const mat = new Uint8Array(SZ * SZ), dist = new Float32Array(SZ * SZ), LG = new Float32Array(33 * 33);
let tg = new Uint8Array((CS + 4) * (CS + 4));

export function bakeChunk(world, c) {
  const x0 = c.cx * CPX, y0 = c.cy * CPX, TG = CS + 4;
  // tile grid with 2-tile margin
  let anyWater = false;
  for (let j = -2; j < CS + 2; j++) for (let i = -2; i < CS + 2; i++) {
    let g;
    if (i >= 0 && j >= 0 && i < CS && j < CS) g = c.g[j * CS + i];
    else g = world.ground(c.cx * CS + i, c.cy * CS + j);
    tg[(j + 2) * TG + (i + 2)] = g; if (WATERY[g]) anyWater = true;
  }
  const tileAt = (px, py) => { const tx = clamp(Math.floor(px / TS), -2, CS + 1), ty = clamp(Math.floor(py / TS), -2, CS + 1); return tg[(ty + 2) * TG + tx + 2]; };
  // material map with jitter
  for (let py = -M; py < CPX + M; py++) for (let px = -M; px < CPX + M; px++) {
    const wx = x0 + px, wy = y0 + py, ji = ((wy & 63) << 6) | (wx & 63);
    const A = tileAt(px, py);
    let m = A;
    if (!HARD.has(A)) { const J = tileAt(px + JXi[ji], py + JYi[ji]); if (!HARD.has(J)) m = J; }
    mat[(py + M) * SZ + px + M] = m;
  }
  // distance to land (water only)
  if (anyWater) {
    for (let i = 0; i < SZ * SZ; i++) dist[i] = WATERY[mat[i]] ? 1e4 : 0;
    for (let y = 1; y < SZ; y++) for (let x = 1; x < SZ - 1; x++) { const i = y * SZ + x; if (dist[i] === 0) continue;
      dist[i] = Math.min(dist[i], dist[i - 1] + 1, dist[i - SZ] + 1, dist[i - SZ - 1] + 1.41, dist[i - SZ + 1] + 1.41); }
    for (let y = SZ - 2; y >= 0; y--) for (let x = SZ - 2; x > 0; x--) { const i = y * SZ + x; if (dist[i] === 0) continue;
      dist[i] = Math.min(dist[i], dist[i + 1] + 1, dist[i + SZ] + 1, dist[i + SZ + 1] + 1.41, dist[i + SZ - 1] + 1.41); }
  }
  if (!c.cv) { c.cv = document.createElement('canvas'); c.cv.width = c.cv.height = CPX; c.cx2d = c.cv.getContext('2d'); }
  const gimg = c.cx2d.createImageData(CPX, CPX), go = new Uint32Array(gimg.data.buffer);
  let wo = null, wimg = null;
  if (anyWater) {
    if (!c.wcv) { c.wcv = document.createElement('canvas'); c.wcv.width = c.wcv.height = CPX; c.wx2d = c.wcv.getContext('2d'); }
    wimg = c.wx2d.createImageData(CPX, CPX); wo = new Uint32Array(wimg.data.buffer);
  } else c.wcv = null;
  c.hasWater = anyWater;
  const MA = (px, py) => mat[(py + M) * SZ + px + M];
  const wallAbove = new Uint8Array((CS + 2) * (CS + 2));
  for (let j = 0; j < CS; j++) for (let i = 0; i < CS; i++) { const b = j > 0 ? c.b[(j - 1) * CS + i] : world.block(c.cx * CS + i, c.cy * CS - 1); wallAbove[(j + 1) * (CS + 2) + i + 1] = (b && b !== 8) ? 1 : 0; }
  for (let j = 0; j < 33; j++) for (let i = 0; i < 33; i++) LG[j * 33 + i] = fbm((x0 + i * 8) / 70, (y0 + j * 8) / 70, 555, 3);
  const low = (px, py) => { const fx = px / 8, fy = py / 8, ix = fx | 0, iy = fy | 0, ux = fx - ix, uy = fy - iy, a = LG[iy * 33 + ix], b = LG[iy * 33 + ix + 1], c2 = LG[iy * 33 + ix + 33], d = LG[iy * 33 + ix + 34];
    return a + (b - a) * ux + (c2 - a) * uy + (a - b - c2 + d) * ux * uy; };
  for (let py = 0; py < CPX; py++) for (let px = 0; px < CPX; px++) {
    const wx = x0 + px, wy = y0 + py, o = py * CPX + px, mi = (py + M) * SZ + px + M, m = mat[mi];
    const b = bayer(wx, wy);
    if (WATERY[m]) {
      const d = dist[mi], deep = m === G.DEEP ? 1 : 0;
      let v = clamp(d / 34, 0, 1) * 0.75 + deep * 0.25 + (N128[((wy & 127) << 7) | (wx & 127)] - 0.5) * 0.18;
      let k = Math.floor(v * (W1.length - 1) + b * 0.9); k = clamp(k, 0, W1.length - 1);
      wo[o] = W1[k];
      // north bank: earth face under land
      let bank = -1; for (let k2 = 1; k2 <= 3; k2++) if (!WATERY[mat[mi - SZ * k2]]) { bank = k2 - 1; break; }
      if (bank >= 0) { go[o] = BANK[bank]; continue; }
      if (d < 1.5) { go[o] = (b > 0.35) ? FOAM : FOAM2; continue; }
      if (d < 2.5 && b > 0.6) { go[o] = FOAM2; continue; }
      if (bank < 0 && WATERY[mat[mi - SZ * 4]] === 0 && b > 0.5) { wo[o] = W1[Math.max(0, k - 1)]; }
      go[o] = 0; continue;
    }
    const ramp = P[m] || P[G.GRASS];
    let col;
    if (m === G.TILLED || m === G.WET) {
      const ly = wy & 15, lx = wx & 15, n = FINE[((wy & 63) << 6) | (wx & 63)];
      // soft soil with little clods (lit top-left, shaded bottom-right)
      let v = n > 0.58 ? 2 : 1;
      const cx3 = Math.floor(wx / 3), cy3 = Math.floor(wy / 3), hh = hash2(cx3, cy3, 33);
      if (hh < 0.3) { const ox = wx - cx3 * 3, oy = wy - cy3 * 3; v = (ox + oy <= 1) ? 3 : (ox + oy >= 3) ? 0 : 2; }
      const up = tileAt(px, py - TS), dn = tileAt(px, py + TS), lf = tileAt(px - TS, py), rt = tileAt(px + TS, py);
      const soil = g => g === G.TILLED || g === G.WET;
      if ((lx === 0 && !soil(lf)) || (lx === 15 && !soil(rt)) || (ly === 15 && !soil(dn))) v = 0;
      else if (ly === 0 && !soil(up)) v = 0;
      else if (ly === 1 && !soil(up)) v = 3;
      else if (lx === 0 || ly === 0) v = Math.max(0, v - 1);
      col = ramp[v];
    } else if (m === G.WOOD) {
      const ly = wy & 15, row = (wy >> 2), seamX = (hash2i(row, 3, 7) & 15), lx = wx & 15;
      let v = 2 + (FINE[((wy & 63) << 6) | ((wx * 3) & 63)] > 0.6 ? 1 : 0) - (FINE[((row & 63) << 6) | 5] > 0.6 ? 1 : 0);
      if ((wy & 3) === 3) v = 0; else if ((wy & 3) === 0) v = Math.min(3, v + 1);
      if (((wx + seamX * 5) & 15) === 0) v = 0;
      if (((wx + seamX * 5) & 15) === 2 && (wy & 3) === 1) v = 0;
      col = ramp[clamp(v, 0, 3)];
      void ly; void lx;
    } else if (m === G.PLAZA || m === G.COBBLE) {
      const qx = (wx % 48 + 48) % 48, qy = (wy % 48 + 48) % 48, qi = qy * 48 + qx;
      if (VE[qi]) col = ramp[0] - 0;
      else {
        const cid = VC[qi], h = hash2(cid, Math.floor(wx / 48) * 7 + Math.floor(wy / 48), 3);
        let v = 1 + (h > 0.66 ? 1 : 0) + (h < 0.2 ? -1 : 0);
        const qu = ((wy - 1) % 48 + 48) % 48 * 48 + qx;
        if (VE[qu]) v++; const qd = ((wy + 1) % 48 + 48) % 48 * 48 + qx; if (VE[qd]) v--;
        col = ramp[clamp(v, 0, 3)];
      }
      if (VE[qi]) col = pk(m === G.PLAZA ? 0x6a625a : 0x55595e);
    } else {
      let v = 0.5 + (low(px, py) - 0.5) * 1.9 + (N128[((wy & 127) << 7) | (wx & 127)] - 0.5) * 0.45 + (FINE[((wy & 63) << 6) | (wx & 63)] - 0.5) * 0.22;
      let k = Math.floor(v * 4 + (b - 0.5) * 0.9); k = clamp(k, 0, 3);
      col = ramp[k];
      if (GRASSY[m]) {
        const t = TUFT[((wy & 63) << 6) | (wx & 63)];
        if (t === 1) col = ramp[Math.max(0, k - 1)]; else if (t === 2) col = ramp[Math.min(3, k + 1)];
        if (m === G.SAKURA && hash2(wx, wy, 9) < 0.012) col = pk(hash2(wx, wy, 10) < 0.5 ? 0xf4b2c8 : 0xffd9e6);
        if (m === G.FOREST && hash2(wx, wy, 11) < 0.006) col = pk(0x8a6a2c);
        if (m === G.SNOW && hash2(wx, wy, 12) < 0.004) col = pk(0xffffff);
      } else if (m === G.PATH || m === G.DIRT || m === G.SAND) {
        const h = hash2(wx >> 1, wy >> 1, 13);
        if (h < 0.018) col = pk(m === G.SAND ? 0xc49e64 : 0x7d6a58); else if (h < 0.026) col = pk(m === G.SAND ? 0xfff0cf : 0xd8c8b0);
      } else if (m === G.ROCK) {
        const n = FINE[((wy & 63) << 6) | (wx & 63)]; if (Math.abs(n - 0.5) < 0.018) col = ramp[0];
        else if (hash2(wx, wy, 14) < 0.01) col = ramp[3];
      }
    }
    // flowers baked into meadow grass
    if (m === G.GRASS || m === G.SAKURA) {
      const tx = wx >> 4, ty = wy >> 4, h = hash2(tx, ty, 21);
      if (h < 0.07) { const fx = (hash2i(tx, ty, 22) & 11) + 2, fy = (hash2i(tx, ty, 23) & 11) + 2, lx = wx & 15, ly = wy & 15, fc = FLOWER_COLS[hash2i(tx, ty, 24) % FLOWER_COLS.length];
        const dx = lx - fx, dy = ly - fy;
        if (dx === 0 && dy === 0) col = pk(0xf2c24a);
        else if (Math.abs(dx) + Math.abs(dy) === 1) col = pk(dy === 1 ? (fc === 0xffffff ? 0xd8d8e8 : fc) : fc);
        else if (dx === 0 && dy === 2) col = pk(0x2f6a32);
      }
    }
    // edges: turf lip and shadow below grass, wet sand
    const up = MA(px, py - 1), dn = MA(px, py + 1), lf = MA(px - 1, py), rt = MA(px + 1, py);
    if (GRASSY[m]) {
      if (LOW[dn] || WATERY[dn]) col = pk(m === G.SNOW ? 0x9aaac4 : 0x2c5a2e);
      else if (LOW[lf] || LOW[rt] || LOW[up]) col = ramp[0];
      else if (LOW[MA(px, py + 2)]) col = ramp[Math.min(3, 3)];
    } else if (LOW[m]) {
      if (GRASSY[up]) col = mulC(col, 0.78); else if (GRASSY[MA(px, py - 2)]) col = mulC(col, 0.9);
      if (m === G.SAND && (WATERY[dn] || WATERY[up] || WATERY[lf] || WATERY[rt] || WATERY[MA(px, py + 2)] || WATERY[MA(px, py + 3)])) col = mulC(col, 0.86);
    }
    { const ty2 = Math.floor(py / TS), ly2 = py - ty2 * TS; if (ly2 < 4 && wallAbove[(ty2 + 1) * (CS + 2) + Math.floor(px / TS) + 1]) col = mulC(col, ly2 < 2 ? 0.62 : 0.8); }
    go[o] = col;
  }
  c.cx2d.putImageData(gimg, 0, 0);
  if (wo) c.wx2d.putImageData(wimg, 0, 0);
  c.dirty = false;
}
function mulC(c, f) { const r = (c & 255) * f, g = ((c >> 8) & 255) * f, b = ((c >> 16) & 255) * f; return ((c & 0xff000000) | (b << 16) | (g << 8) | r) >>> 0; }

// animated water highlights (tileable 64x64 frames)
export function makeWaterFx() {
  const frames = [];
  const r = mulberry32(3), streaks = [];
  for (let k = 0; k < 22; k++) streaks.push({ x: r() * 64, y: r() * 64, l: 2 + r() * 5, ph: r() * Math.PI * 2, sp: 0.6 + r() * 0.8 });
  for (let f = 0; f < 16; f++) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
    for (const s of streaks) {
      const a = Math.sin(f / 16 * Math.PI * 2 * s.sp + s.ph); if (a < 0.1) continue;
      const len = Math.round(s.l * a), sx = Math.round(s.x + f * 0.5) & 63, sy = Math.round(s.y) & 63;
      x.fillStyle = a > 0.7 ? 'rgba(225,250,250,0.55)' : 'rgba(190,235,240,0.35)';
      for (let i = 0; i < len; i++) x.fillRect((sx + i) & 63, sy, 1, 1);
    }
    frames.push(cv);
  }
  return frames;
}

/* ---------------- walls: continuous-texture 3/4 blocks, baked per chunk ---------------- */
// canvas origin = chunk top-left shifted up by WH so the first row's raised tops fit.
export const WH = 12;
const WM = {
  1: { top: [0x625e5c, 0x726e6a, 0x807b76, 0x8e8983, 0xa49e96], face: [0x3e3a38, 0x4c4744, 0x5a5552, 0x6a6460], out: 0x26221f },
  9: { top: [0x4a4852, 0x585662, 0x666472, 0x747282, 0x86849a], face: [0x24222a, 0x2e2c34, 0x3a3842, 0x46444e], out: 0x141218 },
  6: { top: [0x6a4228, 0x7a5032, 0x8c5e3a, 0x9e6c44, 0xb07c50], face: [0x3e2614, 0x4a2e1a, 0x5a3820, 0x6b4428], out: 0x22140a, wood: 1 },
  7: { top: [0x7a7a80, 0x8a8a90, 0x9a9aa0, 0xaaaab0, 0xbcbcc2], face: [0x46464e, 0x54545c, 0x62626a, 0x72727a], out: 0x1e1e24, brick: 1 },
};
const ORE = { 2: [0x1a1818, 0x2e2a2a, 0x4a4644], 3: [0x8a5236, 0xc8845a, 0xf0b88a], 4: [0xa8741a, 0xf2c23a, 0xfff08a], 5: [0x1a7a5a, 0x3ad8a0, 0xc0ffe8] };
const ISWALL = new Uint8Array(16); [1, 2, 3, 4, 5, 6, 7, 9].forEach(b => ISWALL[b] = 1);
const NATB = new Uint8Array(16); [1, 2, 3, 4, 5, 9].forEach(b => NATB[b] = 1);
const MOSS = [pk(0x4a6a32), pk(0x5a7e3a), pk(0x6e9446)];
export function bakeWalls(world, c) {
  const x0 = c.cx * CS, y0 = c.cy * CS, TG = CS + 2;
  const bg = new Uint8Array(TG * TG); let any = false;
  for (let j = -1; j <= CS; j++) for (let i = -1; i <= CS; i++) {
    const b = (i >= 0 && j >= 0 && i < CS && j < CS) ? c.b[j * CS + i] : world.block(x0 + i, y0 + j);
    bg[(j + 1) * TG + i + 1] = ISWALL[b] ? b : 0; if (ISWALL[b] && i >= 0 && j >= 0 && i < CS && j < CS) any = true;
  }
  c.wrows = new Uint8Array(CS);
  if (!any) { c.wallcv = null; return; }
  const H = CPX + WH;
  if (!c.wallcv) { c.wallcv = document.createElement('canvas'); c.wallcv.width = CPX; c.wallcv.height = H; c.wl2d = c.wallcv.getContext('2d'); }
  const img = c.wl2d.createImageData(CPX, H), o = new Uint32Array(img.data.buffer);
  const B_ = (i, j) => bg[(j + 1) * TG + i + 1];
  const con = (b, n) => n && (NATB[b] ? NATB[n] : n === b);
  for (let j = 0; j < CS; j++) for (let i = 0; i < CS; i++) {
    const b = B_(i, j); if (!b) continue; c.wrows[j] = 1;
    const mat = WM[NATB[b] ? (b === 9 || b === 5 ? 9 : 1) : b];
    const N = con(b, B_(i, j - 1)), S = con(b, B_(i, j + 1)), E = con(b, B_(i + 1, j)), W = con(b, B_(i - 1, j));
    const wx0 = (x0 + i) * TS, wy0 = (y0 + j) * TS;
    const ore = ORE[b];
    // top face: canvas rows j*16 .. j*16+16  (world y wy0-12 .. wy0+4)
    for (let ly = 0; ly < 16; ly++) for (let lx = 0; lx < 16; lx++) {
      const wx = wx0 + lx, wy = wy0 - WH + ly, cyy = j * 16 + ly, idx = cyy * CPX + i * 16 + lx;
      let q;
      if (mat.wood) { q = ((wy + 1) % 5 === 0) ? 0 : 2 + ((FINE[((wy & 63) << 6) | ((wx * 2) & 63)] > 0.55) ? 1 : 0); if (((wx + ((wy / 5) | 0) * 7) & 15) === 0) q = 1; }
      else if (mat.brick) { const row = Math.floor(wy / 4), off = (row & 1) * 4; q = ((wy & 3) === 3 || ((wx + off) & 7) === 7) ? 0 : ((wy & 3) === 0 ? 4 : 2 + (hash2(Math.floor((wx + off) / 8), row, 5) > 0.6 ? 1 : 0)); }
      else {
        const qx = ((wx % 48) + 48) % 48, qy = ((wy % 48) + 48) % 48, qi = qy * 48 + qx;
        const cell = VC[qi], hh = hash2(cell, Math.floor(wx / 48) * 31 + Math.floor(wy / 48), 7);
        q = 2 + (hh > 0.72 ? 1 : 0) - (hh < 0.2 ? 1 : 0);
        if (VE[qi]) q = (hash2(wx >> 2, wy >> 2, 4) < 0.5 ? 0 : 1); else { const up = ((((wy - 1) % 48) + 48) % 48) * 48 + qx, lf = qy * 48 + (((wx - 1) % 48 + 48) % 48); if (VE[up] || VE[lf]) q = Math.min(4, q + 1); }
        if (FINE[((wy & 63) << 6) | (wx & 63)] > 0.7 && !VE[qi]) q = Math.max(0, q - 1);
      }
      let col = mat.top[Math.max(0, Math.min(4, q))];
      if (!N && ly === 0) col = mat.out; else if (!N && ly === 1) col = mat.top[4];
      if (!W && lx === 0) col = mat.out; else if (!W && lx === 1 && ly > 0) col = mat.top[Math.min(4, q + 1)];
      if (!E && lx === 15) col = mat.out; else if (!E && lx === 14 && ly > 0) col = mat.top[Math.max(0, q - 1)];
      if (!S && ly === 15) col = mat.top[4];
      if (NATB[b] && !mat.wood && N && W && E && fbm(wx / 22, wy / 22, 91, 2) > 0.62 && hash2(wx, wy, 3) < 0.85 && ly > 1) col = MOSS[q > 2 ? 2 : q > 1 ? 1 : 0];
      o[idx] = (col === MOSS[0] || col === MOSS[1] || col === MOSS[2]) ? col : pk(col);
    }
    // front face
    if (!S) for (let ly = 16; ly < 28; ly++) for (let lx = 0; lx < 16; lx++) {
      const wx = wx0 + lx, wy = wy0 - WH + ly, idx = (j * 16 + ly) * CPX + i * 16 + lx, fy = ly - 16;
      let q;
      if (mat.wood) q = (wx & 3) === 0 ? 0 : (wx & 3) === 1 ? 3 : 2;
      else if (mat.brick) { const off = ((fy >> 2) & 1) * 4; q = ((fy & 3) === 3 || ((wx + off) & 7) === 7) ? 0 : (fy & 3) === 0 ? 3 : 2; }
      else { q = fy < 1 ? 3 : 2 - (fy > 8 ? 1 : 0); const n = FINE[((wy & 63) << 6) | ((wx * 2) & 63)]; if (n > 0.64) q--; if (((wx + (hash2i(wx >> 3, 1, 9) & 3)) % 7) === 0 && fy > 1) q = 0; if (fy === 4 && hash2(wx >> 2, wy, 2) < 0.5) q = Math.max(0, q - 1); }
      let col = mat.face[Math.max(0, Math.min(3, q))];
      if (fy === 11) col = mat.out;
      if ((!W && lx === 0) || (!E && lx === 15)) col = mat.out;
      o[idx] = pk(col);
    }
    if (ore) { // clustered ore nuggets on top and face
      const n = 2 + (hash2i(x0 + i, y0 + j, 11) & 1) + (b === 5 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const lx = 2 + (hash2i(x0 + i, y0 + j, 20 + k) % 12), ly = 2 + (hash2i(x0 + i, y0 + j, 40 + k) % (S ? 12 : 22));
        const put = (dx, dy, cc) => { const yy = j * 16 + ly + dy, xx = i * 16 + lx + dx; if (xx >= i * 16 + 1 && xx < i * 16 + 15 && yy >= j * 16 + 1 && yy < j * 16 + (S ? 16 : 27)) o[yy * CPX + xx] = pk(cc); };
        if (b === 5) { put(0, -2, ore[2]); put(0, -1, ore[1]); put(0, 0, ore[1]); put(1, 0, ore[0]); put(-1, 1, ore[1]); put(0, 1, ore[0]); put(1, 1, ore[0]); }
        else { put(0, 0, ore[1]); put(1, 0, ore[0]); put(0, 1, ore[0]); put(1, 1, ore[0]); put(-1, 0, ore[2]); put(0, -1, ore[2]); }
      }
    }
  }
  c.wl2d.putImageData(img, 0, 0); c.wrv = c.rv;
}
