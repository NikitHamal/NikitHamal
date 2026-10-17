/*!
 * Nikit — an original illustrated character, drawn in SVG at five life stages.
 * Every shape is authored here (no photo tracing). One parametric face, five stages:
 * baby, kid, teen, young adult, now. Animation hooks are exposed as classes:
 *   .p-head (tilt/bob), .p-breath (shoulders), .p-lids (blink), .p-iris (look),
 *   .p-hairB / .p-hairF (sway), .p-brows (expression)
 */
(() => {
'use strict';
const SK = { base: '#c48a62', light: '#dba47b', mid: '#b47852', shade: '#9a6244', deep: '#7c4a33', lip: '#a65a4c', lipD: '#97503f', blush: '#e08b78' };
const HR = { base: '#1b1513', mid: '#2a201c', hi: '#4a3a32', rim: '#6b5446' };
const EY = { white: '#f6efe8', iris: '#3a2214', iris2: '#5a3820', pupil: '#120a08' };

// stage parameters — proportions shift from round baby to long young-adult face
const STAGES = {
  baby:  { label: 'Baby',        age: 'first years', head: [200, 238], rx: 104, ry: 112, cheek: 1.0,  jaw: 0.86, chinY: 352, eyeY: 262, eyeDX: 44, eyeW: 22, eyeH: 15, iris: 10.5, browY: 222, browW: 26, browT: 3.2, noseY: 300, noseW: 12, mouthY: 322, mouthW: 18, earY: 270, earS: 0.9, neck: 30, shoulder: 120, shirt: '#f2c94c', collar: 'onesie', hair: 'baby', facial: 0 },
  kid:   { label: 'Kid',         age: 'school years',    head: [200, 228], rx: 92,  ry: 112, cheek: 0.96, jaw: 0.8,  chinY: 352, eyeY: 248, eyeDX: 42, eyeW: 21, eyeH: 13, iris: 9.2,  browY: 214, browW: 28, browT: 3.6, noseY: 292, noseW: 14, mouthY: 322, mouthW: 26, earY: 256, earS: 1.05, neck: 36, shoulder: 136, shirt: '#3d6fb6', collar: 'polo', hair: 'kid', facial: 0 },
  teen:  { label: 'Teen',        age: 'teenage years',   head: [200, 222], rx: 86,  ry: 118, cheek: 0.92, jaw: 0.74, chinY: 354, eyeY: 238, eyeDX: 40, eyeW: 21, eyeH: 11.5, iris: 8.4, browY: 206, browW: 30, browT: 4.0, noseY: 290, noseW: 15, mouthY: 322, mouthW: 30, earY: 248, earS: 1.0, neck: 50, shoulder: 152, shirt: '#6b4f8f', collar: 'shirt', hair: 'teen', facial: 0.1 },
  young: { label: 'Young adult', age: '18-ish',    head: [200, 220], rx: 84,  ry: 122, cheek: 0.9,  jaw: 0.72, chinY: 358, eyeY: 236, eyeDX: 40, eyeW: 21, eyeH: 11,   iris: 8.2, browY: 203, browW: 31, browT: 4.4, noseY: 292, noseW: 16, mouthY: 326, mouthW: 31, earY: 246, earS: 1.0, neck: 56, shoulder: 168, shirt: '#2f2b2a', collar: 'jacket', hair: 'curly', facial: 0.45 },
  now:   { label: 'Now',         age: 'today',           head: [200, 220], rx: 82,  ry: 126, cheek: 0.88, jaw: 0.7,  chinY: 362, eyeY: 236, eyeDX: 39, eyeW: 21, eyeH: 10.5, iris: 8.0, browY: 203, browW: 31, browT: 4.4, noseY: 294, noseW: 16, mouthY: 330, mouthW: 33, earY: 246, earS: 1.0, neck: 58, shoulder: 172, shirt: '#f1ede6', collar: 'tee', hair: 'long', facial: 1 },
};

const f = n => (Math.round(n * 10) / 10);
const P = pts => pts.map(p => typeof p === 'string' ? p : f(p)).join(' ');

function facePath(S) {
  const [cx, cy] = S.head, rx = S.rx, top = cy - S.ry, ch = S.chinY, cw = rx * S.jaw;
  return P(['M', cx, top,
    'C', cx + rx * 0.62, top, cx + rx, cy - S.ry * 0.55, cx + rx, cy - S.ry * 0.05,           // temple
    'C', cx + rx * S.cheek, cy + S.ry * 0.35, cx + cw, ch - 40, cx + cw * 0.55, ch - 12,     // cheek -> jaw
    'C', cx + cw * 0.3, ch, cx - cw * 0.3, ch, cx - cw * 0.55, ch - 12,                     // chin
    'C', cx - cw, ch - 40, cx - rx * S.cheek, cy + S.ry * 0.35, cx - rx, cy - S.ry * 0.05,
    'C', cx - rx, cy - S.ry * 0.55, cx - rx * 0.62, top, cx, top, 'Z']);
}
function ear(S, side) {
  const [cx] = S.head, x = cx + side * (S.rx - 4), y = S.earY, s = S.earS;
  const d = P(['M', x, y - 22 * s, 'C', x + side * 20 * s, y - 30 * s, x + side * 26 * s, y + 6 * s, x + side * 10 * s, y + 26 * s, 'C', x + side * 4 * s, y + 30 * s, x, y + 24 * s, x, y + 16 * s, 'Z']);
  const inner = P(['M', x + side * 4 * s, y - 12 * s, 'C', x + side * 16 * s, y - 16 * s, x + side * 18 * s, y + 4 * s, x + side * 8 * s, y + 16 * s]);
  return `<path d="${d}" fill="${SK.mid}"/><path d="${inner}" fill="none" stroke="${SK.shade}" stroke-width="3" stroke-linecap="round"/>`;
}
function eye(S, side, id) {
  const [cx] = S.head, x = cx + side * S.eyeDX, y = S.eyeY, w = S.eyeW, h = S.eyeH, ir = S.iris;
  const almond = P(['M', x - w, y + 1, 'C', x - w * 0.55, y - h * 1.25, x + w * 0.45, y - h * 1.2, x + w, y - (side > 0 ? 1 : 1), 'C', x + w * 0.5, y + h * 0.95, x - w * 0.5, y + h * 0.95, x - w, y + 1, 'Z']);
  const lid = P(['M', x - w - 2, y + 2, 'C', x - w * 0.55, y - h * 1.35, x + w * 0.45, y - h * 1.3, x + w + 3, y - 1]);
  const crease = P(['M', x - w * 0.7, y - h * 1.15, 'C', x - w * 0.2, y - h * 1.9, x + w * 0.5, y - h * 1.75, x + w * 0.85, y - h * 0.9]);
  return `<g class="p-eye">
    <path d="${crease}" fill="none" stroke="${SK.shade}" stroke-width="2.2" stroke-linecap="round" opacity="0.7"/>
    <clipPath id="${id}"><path d="${almond}"/></clipPath>
    <path d="${almond}" fill="${EY.white}"/>
    <g clip-path="url(#${id})"><g class="p-iris"><circle cx="${f(x)}" cy="${f(y + 0.5)}" r="${ir}" fill="${EY.iris}"/><circle cx="${f(x)}" cy="${f(y + 0.5)}" r="${f(ir * 0.68)}" fill="${EY.iris2}" opacity="0.55"/><circle cx="${f(x)}" cy="${f(y + 0.5)}" r="${f(ir * 0.42)}" fill="${EY.pupil}"/><circle cx="${f(x - ir * 0.35)}" cy="${f(y - ir * 0.35)}" r="${f(ir * 0.26)}" fill="#fff"/><circle cx="${f(x + ir * 0.35)}" cy="${f(y + ir * 0.3)}" r="${f(ir * 0.12)}" fill="#fff" opacity="0.7"/></g>
      <path d="${P(['M', x - w, y - h * 1.6, 'L', x + w, y - h * 1.6, 'L', x + w, y - h * 0.15, 'C', x + w * 0.4, y - h * 0.9, x - w * 0.4, y - h * 0.9, x - w, y - h * 0.15, 'Z'])}" fill="${SK.deep}" opacity="0.22" class="p-tint"/>
      <g class="p-lid" style="transform-origin:${f(x)}px ${f(y - h * 1.3)}px;transform:scaleY(0)"><path d="${P(['M', x - w - 3, y - h * 1.6, 'L', x + w + 3, y - h * 1.6, 'L', x + w + 3, y + h * 1.2, 'L', x - w - 3, y + h * 1.2, 'Z'])}" fill="${SK.mid}"/><path d="${P(['M', x - w, y + 1, 'C', x - w * 0.4, y + h * 0.75, x + w * 0.4, y + h * 0.75, x + w, y])}" fill="none" stroke="#1e1210" stroke-width="3" stroke-linecap="round"/></g></g>
    <path d="${lid}" fill="none" stroke="#1e1210" stroke-width="${S.eyeH > 14 ? 3 : 3.4}" stroke-linecap="round"/>
    <path d="${P(['M', x + side * w * 0.95, y - 2, 'L', x + side * (w + 6), y - 5])}" stroke="#1e1210" stroke-width="2.4" stroke-linecap="round"/>
    <path d="${P(['M', x - w * 0.7, y + h * 0.8, 'C', x - w * 0.2, y + h * 1.15, x + w * 0.4, y + h * 1.1, x + w * 0.8, y + h * 0.6])}" fill="none" stroke="${SK.shade}" stroke-width="1.6" opacity="0.6"/>
  </g>`;
}
function brow(S, side) {
  const [cx] = S.head, x0 = cx + side * (S.eyeDX - S.browW * 0.55), x1 = cx + side * (S.eyeDX + S.browW * 0.75), y = S.browY, t = S.browT;
  const d = P(['M', x0, y + 2, 'C', x0 + side * S.browW * 0.4, y - t * 1.3, x1 - side * S.browW * 0.4, y - t * 1.6, x1, y + 3, 'C', x1 - side * S.browW * 0.45, y - t * 0.2, x0 + side * S.browW * 0.4, y + t * 0.2, x0, y + t + 2, 'Z']);
  return `<path d="${d}" fill="${HR.base}"/>`;
}
function nose(S) {
  const [cx] = S.head, y = S.noseY, w = S.noseW, top = S.eyeY + 8;
  return `<path d="${P(['M', cx + 4, top, 'C', cx + 8, top + (y - top) * 0.5, cx + w * 0.55, y - 12, cx + w * 0.75, y - 2])}" fill="none" stroke="${SK.shade}" stroke-width="3.2" stroke-linecap="round" opacity="0.55"/>
    <path d="${P(['M', cx - w, y - 2, 'C', cx - w * 0.9, y + 8, cx - 4, y + 10, cx, y + 6, 'C', cx + 4, y + 10, cx + w * 0.9, y + 8, cx + w, y - 2])}" fill="none" stroke="${SK.deep}" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="${f(cx - w * 0.45)}" cy="${f(y + 3)}" rx="${f(w * 0.22)}" ry="2.2" fill="${SK.deep}" opacity="0.8"/><ellipse cx="${f(cx + w * 0.45)}" cy="${f(y + 3)}" rx="${f(w * 0.22)}" ry="2.2" fill="${SK.deep}" opacity="0.8"/>
    <ellipse class="p-tint" cx="${f(cx - 3)}" cy="${f(y - 6)}" rx="${f(w * 0.3)}" ry="${f(w * 0.24)}" fill="${SK.light}" opacity="0.7"/>`;
}
function mouth(S, smile = 1) {
  const [cx] = S.head, y = S.mouthY, w = S.mouthW, s = smile;
  const upper = P(['M', cx - w, y, 'C', cx - w * 0.5, y - 5, cx - w * 0.2, y - 6 + s, cx, y - 3, 'C', cx + w * 0.2, y - 6 + s, cx + w * 0.5, y - 5, cx + w, y, 'C', cx + w * 0.4, y + 2, cx - w * 0.4, y + 2, cx - w, y, 'Z']);
  const lower = P(['M', cx - w * 0.8, y + 1, 'C', cx - w * 0.4, y + 12, cx + w * 0.4, y + 12, cx + w * 0.8, y + 1, 'C', cx + w * 0.4, y + 3, cx - w * 0.4, y + 3, cx - w * 0.8, y + 1, 'Z']);
  return `<g class="p-mouth"><path d="${lower}" fill="${SK.lip}"/><path d="${upper}" fill="${SK.lipD}"/>
    <path d="${P(['M', cx - w - 2, y - 1 - s * 2, 'C', cx - w * 0.4, y + 3 + s, cx + w * 0.4, y + 3 + s, cx + w + 2, y - 1 - s * 2])}" fill="none" stroke="#5a2a24" stroke-width="2.4" stroke-linecap="round"/>
    <path d="${P(['M', cx - w * 0.35, y + 8, 'C', cx - w * 0.1, y + 10, cx + w * 0.1, y + 10, cx + w * 0.35, y + 8])}" class="p-tint" fill="none" stroke="#f0b090" stroke-width="2" opacity="0.5" stroke-linecap="round"/></g>`;
}
function facialHair(S) {
  if (S.facial <= 0) return '';
  const [cx] = S.head, y = S.mouthY, w = S.mouthW, a = S.facial;
  const must = P(['M', cx - w * 1.05, y + 2, 'C', cx - w * 0.9, y - 8, cx - w * 0.4, y - 13, cx, y - 9, 'C', cx + w * 0.4, y - 13, cx + w * 0.9, y - 8, cx + w * 1.05, y + 2, 'C', cx + w * 0.6, y - 5, cx + w * 0.3, y - 6, cx, y - 4, 'C', cx - w * 0.3, y - 6, cx - w * 0.6, y - 5, cx - w * 1.05, y + 2, 'Z']);
  const chin = P(['M', cx - 9, y + 20, 'C', cx - 7, y + 30, cx + 7, y + 30, cx + 9, y + 20, 'C', cx + 4, y + 23, cx - 4, y + 23, cx - 9, y + 20, 'Z']);
  return `<g class="p-facial" opacity="${0.35 + a * 0.55}"><path d="${must}" fill="${HR.mid}"/>${a > 0.6 ? `<path d="${chin}" fill="${HR.mid}"/>` : ''}</g>`;
}
function shoulders(S) {
  const [cx] = S.head, top = S.chinY - 14, sw = S.shoulder, nw = S.neck, by = 500;
  const neck = P(['M', cx - nw * 0.62, top - 30, 'L', cx - nw * 0.7, top + 40, 'C', cx - nw * 0.3, top + 52, cx + nw * 0.3, top + 52, cx + nw * 0.7, top + 40, 'L', cx + nw * 0.62, top - 30, 'Z']);
  const body = P(['M', cx - nw * 0.9, top + 34, 'C', cx - sw * 0.6, top + 44, cx - sw, top + 62, cx - sw - 14, by, 'L', cx + sw + 14, by, 'C', cx + sw, top + 62, cx + sw * 0.6, top + 44, cx + nw * 0.9, top + 34, 'Z']);
  const c = S.shirt; let collar = '';
  if (S.collar === 'tee') collar = `<path d="${P(['M', cx - nw * 0.85, top + 34, 'C', cx - nw * 0.4, top + 62, cx + nw * 0.4, top + 62, cx + nw * 0.85, top + 34])}" fill="none" stroke="#d9d2c6" stroke-width="7" stroke-linecap="round"/>`;
  if (S.collar === 'onesie') collar = `<path d="${P(['M', cx - nw * 1.1, top + 34, 'C', cx - nw * 0.4, top + 70, cx + nw * 0.4, top + 70, cx + nw * 1.1, top + 34])}" fill="none" stroke="#e0a83a" stroke-width="6"/><circle cx="${cx}" cy="${top + 92}" r="5" fill="#fff6e0"/><circle cx="${cx}" cy="${top + 116}" r="5" fill="#fff6e0"/>`;
  if (S.collar === 'polo') collar = `<path d="${P(['M', cx - nw * 1.2, top + 30, 'L', cx - 4, top + 66, 'L', cx - nw * 0.4, top + 48, 'Z'])}" fill="#f4f1ea"/><path d="${P(['M', cx + nw * 1.2, top + 30, 'L', cx + 4, top + 66, 'L', cx + nw * 0.4, top + 48, 'Z'])}" fill="#e8e3d8"/><path d="${P(['M', cx, top + 66, 'L', cx, top + 110])}" stroke="#2c5590" stroke-width="3"/><circle cx="${cx}" cy="${top + 80}" r="3.4" fill="#f4f1ea"/><circle cx="${cx}" cy="${top + 98}" r="3.4" fill="#f4f1ea"/>`;
  if (S.collar === 'shirt') collar = `<path d="${P(['M', cx - nw * 1.1, top + 26, 'L', cx - 2, top + 64, 'L', cx - nw * 0.9, top + 62, 'Z'])}" fill="#7f62a4"/><path d="${P(['M', cx + nw * 1.1, top + 26, 'L', cx + 2, top + 64, 'L', cx + nw * 0.9, top + 62, 'Z'])}" fill="#5a417a"/><path d="${P(['M', cx, top + 64, 'L', cx, by])}" stroke="#4a3466" stroke-width="3"/>`;
  if (S.collar === 'jacket') collar = `<path d="${P(['M', cx - nw * 0.8, top + 36, 'C', cx - nw * 0.3, top + 60, cx + nw * 0.3, top + 60, cx + nw * 0.8, top + 36, 'L', cx + 30, by, 'L', cx - 30, by, 'Z'])}" fill="#ece6dc"/><path d="${P(['M', cx - nw * 1.1, top + 30, 'L', cx - 28, by])}" stroke="#1a1716" stroke-width="10"/><path d="${P(['M', cx + nw * 1.1, top + 30, 'L', cx + 28, by])}" stroke="#1a1716" stroke-width="10"/><path d="${P(['M', cx + 26, top + 80, 'L', cx + 26, by])}" stroke="#9a948c" stroke-width="2"/>`;
  return `<g class="p-breath"><path d="${body}" fill="${c}"/><path class="p-tint" d="${body}" fill="url(#shirtShade)" opacity="${S.flat ? 0 : 1}"/>${collar}</g>
    <path d="${neck}" fill="${SK.mid}"/><path d="${P(['M', cx - nw * 0.7, top - 10, 'C', cx - nw * 0.2, top + 14, cx + nw * 0.4, top + 14, cx + nw * 0.7, top - 10, 'L', cx + nw * 0.7, top - 30, 'L', cx - nw * 0.7, top - 30, 'Z'])}" fill="${SK.deep}" opacity="0.35" class="p-tint"/>`;
}

/* ---------------- hair: built from a mass + many tapered locks ---------------- */
// tapered lock from root (x0,y0) to tip (x1,y1); w = root width, bend = sideways curve
function lock(x0, y0, x1, y1, w, bend = 0) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const mx = x0 + dx * 0.5 + nx * bend, my = y0 + dy * 0.5 + ny * bend;
  return P(['M', x0 - nx * w, y0 - ny * w, 'Q', mx - nx * w * 0.7, my - ny * w * 0.7, x1, y1, 'Q', mx + nx * w * 0.7, my + ny * w * 0.7, x0 + nx * w, y0 + ny * w, 'Z']);
}
// wavy closed outline around an ellipse, from angle a0 to a1 (radians, 0 = right, clockwise in svg)
function scallop(cx, cy, rx, ry, a0, a1, n, amp, seed = 1) {
  const pts = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, r = 1 + (i % 2 ? amp : 0) * (0.7 + 0.3 * Math.sin(i * 2.3 + seed)); pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]); }
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) { const [px, py] = pts[i - 1], [qx, qy] = pts[i], a = a0 + (a1 - a0) * (i - 0.5) / n; const bx = (px + qx) / 2 + Math.cos(a) * rx * amp * 0.9, by = (py + qy) / 2 + Math.sin(a) * ry * amp * 0.9; d += ` Q ${f(bx)} ${f(by)} ${f(qx)} ${f(qy)}`; }
  return d;
}
function hair(S) {
  const [cx, cy] = S.head, rx = S.rx, top = cy - S.ry;
  const G = 'url(#hairG)', fill = (d, c = G, extra = '') => `<path d="${d}" fill="${c}"${extra}/>`;
  const shine = (arr, w = 2.2, op = 0.6) => arr.map(d => `<path d="${d}" fill="none" stroke="${HR.hi}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`).join('');
  // skull cap: covers the top of the head down to hairline yH at the temples
  const skullY = (x, pad = 0) => cy - (S.ry + pad) * Math.sqrt(Math.max(0, 1 - ((x - cx) / (rx + pad)) ** 2));
  const cap = (yH, puff = 6, hl = 40) => { const ax = rx + puff, ay = S.ry + puff, sy = Math.sqrt(Math.max(0, 1 - ((yH - cy) / ay) ** 2)); const xs = ax * sy;
    return `M ${f(cx - xs)} ${f(yH)} A ${f(ax)} ${f(ay)} 0 0 1 ${f(cx + xs)} ${f(yH)} C ${f(cx + rx * 0.7)} ${f(top + hl)} ${f(cx - rx * 0.7)} ${f(top + hl)} ${f(cx - xs)} ${f(yH)} Z`; };
  if (S.hair === 'baby') {
    let w = fill(cap(cy - 50, 2, 34), HR.mid, ' opacity="0.35"');
    for (const [x0, x1, y1, b] of [[-40, -50, 40, -6], [-20, -26, 38, -5], [0, 2, 36, 4], [20, 28, 36, 5], [40, 52, 42, 6]]) w += `<path d="${P(['M', cx + x0, top + 4, 'Q', cx + (x0 + x1) / 2 + b, top + y1 * 0.5, cx + x1, top + y1])}" fill="none" stroke="${HR.mid}" stroke-width="3.2" stroke-linecap="round" opacity="0.8"/>`;
    w += `<path d="${P(['M', cx + 2, top + 2, 'C', cx + 8, top - 16, cx - 10, top - 22, cx - 12, top - 10])}" fill="none" stroke="${HR.mid}" stroke-width="4" stroke-linecap="round"/>`;
    return { back: '', front: w };
  }
  if (S.hair === 'kid') {
    let w = fill(cap(cy - 2, 8, 30));
    for (let i = 0; i < 11; i++) { const t = i / 10, x0 = cx - rx * 0.8 + t * rx * 1.6, x1 = x0 + (t - 0.5) * 14 + 4, y1 = S.browY - 16 + Math.sin(i * 1.7) * 4 + Math.abs(t - 0.5) * 20; w += fill(lock(x0, skullY(x0) + 4, x1, y1, 13, (i % 2 ? 3 : -3))); }
    w += fill(lock(cx - rx - 2, cy - 40, cx - rx + 6, S.earY - 8, 10, -2)) + fill(lock(cx + rx + 2, cy - 40, cx + rx - 6, S.earY - 8, 10, 2));
    w += shine([P(['M', cx - 44, top + 8, 'C', cx - 20, top - 2, cx + 20, top - 2, cx + 44, top + 8]), P(['M', cx - 18, top + 26, 'L', cx - 16, top + 48]), P(['M', cx + 14, top + 24, 'L', cx + 16, top + 46])], 2.4, 0.55);
    return { back: '', front: w };
  }
  if (S.hair === 'teen') {
    let w = fill(cap(cy - 6, 12, 36));
    for (let i = 0; i < 10; i++) { const t = i / 9, x0 = cx - rx * 0.7 + t * rx * 1.5, y0 = top - 4 + Math.abs(t - 0.4) * 10; w += fill(lock(x0, y0, x0 - 34 + t * 10, S.browY - 10 + (1 - t) * 6 - t * 24, 15 * (1 - Math.abs(t - 0.5) * 0.9), 8)); }
    w += fill(lock(cx - rx - 6, cy - 50, cx - rx + 2, S.earY - 2, 13, -3)) + fill(lock(cx + rx + 6, cy - 50, cx + rx - 4, S.earY - 14, 11, 3));
    w += shine([P(['M', cx - 50, top + 6, 'C', cx - 10, top - 14, cx + 40, top - 10, cx + 70, top + 14]), P(['M', cx + 10, top + 20, 'C', cx - 6, top + 40, cx - 24, top + 54, cx - 40, top + 64]), P(['M', cx + 44, top + 22, 'C', cx + 30, top + 40, cx + 18, top + 48, cx + 4, top + 54])], 2.4, 0.6);
    return { back: '', front: w };
  }
  if (S.hair === 'curly') {
    const back = fill(scallop(cx, top + 92, rx + 30, 108, Math.PI * 0.94, Math.PI * 2.06, 18, 0.1, 2) + ' Z');
    let w = fill(cap(cy - 10, 16, 36));
    // wavy fringe tumbling forward
    for (let i = 0; i < 9; i++) { const t = i / 8, x0 = cx - rx * 0.75 + t * rx * 1.5, y1 = S.browY - 12 + Math.sin(i * 2.1) * 6 + Math.abs(t - 0.5) * 18; w += fill(lock(x0, skullY(x0, 14) + 8, x0 + (i % 2 ? 12 : -10), y1, 15, i % 2 ? 12 : -12)); }
    w += fill(lock(cx - rx - 14, cy - 60, cx - rx + 2, S.earY - 4, 16, -10)) + fill(lock(cx + rx + 14, cy - 60, cx + rx - 2, S.earY - 6, 16, 10));
    let curls = ''; for (const [dx, dy, r] of [[-78, -4, 10], [-52, -26, 11], [-20, -38, 12], [16, -40, 12], [50, -28, 11], [80, -6, 10], [-36, 6, 9], [0, -2, 10], [34, 4, 9], [-92, 30, 8], [94, 30, 8]]) curls += `<path d="${P(['M', cx + dx - r, top + dy + 30, 'C', cx + dx - r, top + dy + 26 - r, cx + dx + r, top + dy + 26 - r, cx + dx + r * 0.6, top + dy + 32])}" fill="none" stroke="${HR.hi}" stroke-width="2.6" stroke-linecap="round" opacity="0.65"/>`;
    return { back, front: w + curls };
  }
  // long, wavy, centre-parted — today
  const back = P(['M', cx - rx - 18, cy - 30, 'C', cx - rx - 40, cy + 60, cx - rx - 30, cy + 150, cx - rx - 50, cy + 200, 'Q', cx - rx - 10, cy + 214, cx - rx + 26, cy + 176,
    'L', cx + rx - 26, cy + 176, 'Q', cx + rx + 10, cy + 214, cx + rx + 50, cy + 200, 'C', cx + rx + 30, cy + 150, cx + rx + 40, cy + 60, cx + rx + 18, cy - 30, 'C', cx + rx + 10, top - 34, cx - rx - 10, top - 34, cx - rx - 18, cy - 30, 'Z']);
  let L = fill(cap(cy - 30, 14, 20)), R = '';
  // each side: locks from the part, sweeping over the temple and falling in waves past the jaw
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    for (const side of [-1, 1]) {
      const x0 = cx + side * (4 + t * 30), y0 = top - 4 + t * 10, xm = cx + side * (rx * (0.72 + t * 0.32)), ym = top + 70 + t * 20;
      const x1 = cx + side * (rx + 6 + t * 26 + (i % 2) * 8), y1 = cy + 120 + t * 50 + (i % 3) * 8;
      const d = P(['M', x0, y0, 'C', xm - side * 14, ym - 50, xm - side * 6, ym, xm + side * 2, ym + 30, 'C', xm + side * (16 + t * 6), ym + 80, x1 - side * 18, y1 - 50, x1, y1,
        'C', x1 - side * 6, y1 - 30, xm + side * (22 - t * 8), ym + 70, xm + side * 16, ym + 24, 'C', xm + side * 14, ym - 10, x0 + side * 20, y0 + 2, x0 + side * 4, y0, 'Z']);
      const str = fill(d) + shine([P(['M', x0 + side * 6, y0 + 4, 'C', xm - side * 6, ym - 40, xm, ym, xm + side * 8, ym + 40])], 2, 0.5);
      if (side < 0) L += str; else R += str;
    }
  }
  return { back: `<path class="p-hairB" d="${back}" fill="${HR.base}"/>`, front: `<g class="p-hairL">${L}</g><g class="p-hairR">${R}</g>` };
}

function svg(stageKey, o = {}) {
  const S = STAGES[stageKey], uid = (o.id || stageKey) + Math.random().toString(36).slice(2, 6), [cx, cy] = S.head;
  S.flat = !!o.flat; const H = hair(S);
  const shade = P(['M', cx + S.rx * 0.25, cy - S.ry * 0.9, 'C', cx + S.rx * 1.05, cy - S.ry * 0.6, cx + S.rx * 1.02, cy + S.ry * 0.3, cx + S.rx * S.jaw * 0.55, S.chinY - 10, 'C', cx + S.rx * 0.55, cy + S.ry * 0.25, cx + S.rx * 0.6, cy - S.ry * 0.3, cx + S.rx * 0.25, cy - S.ry * 0.9, 'Z']);
  const body = `
    <defs>
      <linearGradient id="hairG${uid}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${HR.mid}"/><stop offset="0.55" stop-color="${HR.base}"/><stop offset="1" stop-color="#110d0c"/></linearGradient>
      <radialGradient id="faceG${uid}" cx="0.42" cy="0.38" r="0.75"><stop offset="0" stop-color="${SK.light}"/><stop offset="0.55" stop-color="${SK.base}"/><stop offset="1" stop-color="${SK.mid}"/></radialGradient>
      <filter id="soft${uid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
      <linearGradient id="shirtShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.12"/><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/></linearGradient>
    </defs>
    ${H.back.replace(/url\(#hairG\)/g, `url(#hairG${uid})`)}
    ${shoulders(S)}
    <g class="p-head" style="transform-origin:${cx}px ${S.chinY}px">
      ${ear(S, -1)}${ear(S, 1)}
      <path d="${facePath(S)}" fill="${o.flat ? SK.base : `url(#faceG${uid})`}"/>
      ${o.flat ? '' : `<path class="p-shade" d="${shade}" fill="${SK.deep}" opacity="0.2" filter="url(#soft${uid})"/>`}
      <ellipse class="p-blush" cx="${f(cx - S.eyeDX - 4)}" cy="${f(S.noseY + 4)}" rx="${f(S.eyeW * 0.9)}" ry="${f(S.eyeH * 0.8)}" fill="${SK.blush}" opacity="${S.hair === 'baby' ? 0.45 : 0.18}"/>
      <ellipse class="p-blush" cx="${f(cx + S.eyeDX + 4)}" cy="${f(S.noseY + 4)}" rx="${f(S.eyeW * 0.9)}" ry="${f(S.eyeH * 0.8)}" fill="${SK.blush}" opacity="${S.hair === 'baby' ? 0.45 : 0.14}"/>
      ${nose(S)}${mouth(S, S.hair === 'baby' || S.hair === 'kid' ? 2 : 1)}${facialHair(S)}
      <g class="p-eyes">${eye(S, -1, 'el' + uid)}${eye(S, 1, 'er' + uid)}</g>
      <g class="p-brows">${brow(S, -1)}${brow(S, 1)}</g>
      ${H.front.replace(/url\(#hairG\)/g, `url(#hairG${uid})`)}
    </g>`;
  if (o.flat) { /* flat colours for pixel sprites */ }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${o.viewBox || '20 40 360 460'}" class="portrait p-${stageKey}" role="img" aria-label="Illustration of Nikit — ${S.label}">${body}</svg>`;
}
window.Portrait = { svg, STAGES, keys: Object.keys(STAGES) };
})();
