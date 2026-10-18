// Reels for posts: 27 s, 100 BPM (beat = 36 f). ?post=<slug>[&v=portrait]. The script and timing live in reels.json (shared with score.py).
// No title card up front: every reel opens on its hook line, cuts between paper and ink on the beat, sets a giant ghost word behind
// the type, lands words on the grid, and only at the end shows the title, the name and the address. Engine: ../shared/lib.js.
'use strict';
const { E, clamp, prog, mix, hash, font } = LIB;
const Q = new URLSearchParams(location.search), PORT = Q.get('v') === 'portrait', SLUG = Q.get('post') || 'the-lie-of-being-yourself';
const W = PORT ? 1080 : 1920, H = PORT ? 1920 : 1080, CX = W / 2, CY = H / 2, TOTAL = 1620, END = 1404, BEAT = 36, LH = PORT ? 150 : 96;
const C = { paper: '#f4ede2', ink: '#1d1a17', ink2: '#5b544c', mute: '#8a8178', pink: '#c9607f', pinkD: '#e98aa6', blush: '#ffd2df', night: '#14110e', line: 'rgba(29,26,23,0.18)' };
let R, A = {};
const col = (name, dark) => ({ paper: C.paper, ink: dark ? C.paper : C.ink, ink2: dark ? 'rgba(244,237,226,0.7)' : C.ink2, pink: dark ? C.pinkD : C.pink, blush: C.blush }[name] || C.ink);
function fit(c, text, kind, size, maxW = W * 0.88) { font(c, kind, size); const w = c.measureText(text).width; return w > maxW ? size * maxW / w : size; }
const blockAt = f => R.beats.find(b => f >= b.from && f < b.to);

// ---- word landing: each word drops in from a slight scale with a blur, on the grid
function land(c, L, f, b, dark, opt = {}) {
  const want = L.size * (PORT ? 1.12 : 1), color = opt.col || col(L.c, dark), out = E.exit(prog(f, b.to - 16, b.to)), f0 = b.from + L.at;
  font(c, L.f, want); const natural = c.measureText(L.t).width, maxW = W * 0.86, ws = L.t.split(' ');
  // on the narrow frame a long line wraps onto two lines (split nearest the middle) instead of shrinking
  let rows = [ws];
  if (PORT && !L.nowrap && natural > maxW && ws.length > 2) { let best = 1, bd = 1e9; for (let k = 1; k < ws.length; k++) { font(c, L.f, want); const d = Math.abs(c.measureText(ws.slice(0, k).join(' ')).width - c.measureText(ws.slice(k).join(' ')).width); if (d < bd) { bd = d; best = k; } } rows = [ws.slice(0, best), ws.slice(best)]; }
  let size = want; for (const r of rows) size = Math.min(size, fit(c, r.join(' '), L.f, want, maxW));
  const yc = (opt.y ?? (L.py != null ? L.py : CY + L.y * LH)), lh2 = size * 1.12, xs = []; let idx = 0, yLast = 0;
  rows.forEach((r, ri) => { const y = yc + (ri - (rows.length - 1) / 2) * lh2 + size * 0.32; yLast = y; font(c, L.f, size); const sp = c.measureText(' ').width, wd = r.map(w => c.measureText(w).width), tot = wd.reduce((p, q) => p + q, 0) + sp * (r.length - 1); let x = CX - tot / 2;
    r.forEach((w, i) => { const t0 = f0 + idx * L.step, u = E.out(prog(f, t0, t0 + 14)); xs.push([x, x + wd[i], y]); idx++;
      if (u > 0) { c.save(); c.globalAlpha *= u * (1 - out) * (opt.a ?? 1); if (u < 1 || out > 0) c.filter = `blur(${((1 - u) * 9 + out * 8).toFixed(1)}px)`; const s = mix(1.16, 1, u);
        c.translate(x + wd[i] / 2, y + (1 - u) * 14 - out * 12); c.scale(s, s); font(c, L.f, size); c.fillStyle = color; c.textAlign = 'center'; c.fillText(w, 0, 0); c.restore(); }
      x += wd[i] + sp; }); });
  return { xs, y: yLast, size, rows: rows.length };
}
// ---- vertical layout: lines stack by measured height in three groups (top / middle / bottom), each centred where the script put it
function measure(c, L) { const want = L.size * (PORT ? 1.12 : 1), maxW = W * (PORT ? 0.86 : 0.88), ws = L.t.split(' '); font(c, L.f, want); if (!PORT || L.nowrap || c.measureText(L.t).width <= maxW || ws.length <= 2) return { rows: 1, size: fit(c, L.t, L.f, want, maxW) };
  let best = 1, bd = 1e9; for (let k = 1; k < ws.length; k++) { const d = Math.abs(c.measureText(ws.slice(0, k).join(' ')).width - c.measureText(ws.slice(k).join(' ')).width); if (d < bd) { bd = d; best = k; } }
  return { rows: 2, size: Math.min(fit(c, ws.slice(0, best).join(' '), L.f, want, maxW), fit(c, ws.slice(best).join(' '), L.f, want, maxW)) }; }
function layoutPortrait(c) {
  for (const b of R.beats) {
    if (b.kind === 'dis') b.lines[1].nowrap = true; if (b.kind === 'breaks') b.lines[1].nowrap = true; if (b.kind === 'wind') b.lines.forEach(L => L.nowrap = true);
    const groups = { top: [], mid: [], bot: [] }; b.lines.forEach(L => groups[L.y <= -2 ? 'top' : L.y >= 2 ? 'bot' : 'mid'].push(L));
    for (const g of Object.values(groups)) { if (!g.length) continue; const ms = g.map(L => measure(c, L)), hs = ms.map(m => m.rows * m.size * 1.12), gaps = ms.map(m => m.size * 0.42);
      const total = hs.reduce((p, q) => p + q, 0) + gaps.slice(0, -1).reduce((p, q) => p + q, 0), centre = CY + (g.reduce((p, L) => p + L.y, 0) / g.length) * LH; let y = centre - total / 2;
      g.forEach((L, i) => { L.py = y + hs[i] / 2; y += hs[i] + gaps[i]; }); }
  }
}
// ---- the giant ghost word behind everything
function ghost(c, f, dark) { const word = R.ghost, s = (PORT ? H * 0.34 : H * 0.62), z = 1 + 0.05 * Math.sin(f / 180), dx = Math.sin(f / 240) * 30;
  c.save(); font(c, 'serif', fit(c, word, 'serif', s, W * 1.3)); c.textAlign = 'center'; c.lineWidth = 1.5; c.strokeStyle = dark ? 'rgba(244,237,226,0.07)' : 'rgba(29,26,23,0.06)';
  c.translate(CX + dx, CY + s * 0.34); c.scale(z, z); c.strokeText(word, 0, 0); c.restore(); }
// ---- backgrounds
function bg(c, f, b) {
  if (b && b.mode === 'pond') { const clip = A[b.clip], k = ((Math.floor((f - b.from) / 2) % 150) + 150) % 150, z = mix(1.2, 1.06, prog(f, b.from, b.to)); LIB.cover(c, clip[k], 0, 0, W, H, z, 0.5, 0.48); c.fillStyle = 'rgba(12,10,8,0.38)'; c.fillRect(0, 0, W, H); return true; }
  const dark = b && b.mode === 'dark';
  c.fillStyle = dark ? C.night : C.paper; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(CX + Math.sin(f / 90) * W * 0.12, CY * 0.9, Math.min(W, H) * 0.1, CX, CY, Math.hypot(W, H) * 0.62);
  if (dark) { g.addColorStop(0, 'rgba(90,70,55,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0.35)'); } else { g.addColorStop(0, 'rgba(255,252,246,0.55)'); g.addColorStop(1, 'rgba(150,120,90,0.16)'); }
  c.fillStyle = g; c.fillRect(0, 0, W, H); return dark;
}
// ---- story-style progress bars at the top: one segment per block, plus the end
function bars(c, f, dark) {
  const segs = [...R.beats.map(b => [b.from, b.to]), [END, TOTAL]], n = segs.length, m = PORT ? 40 : 520, y = PORT ? 64 : 34, gap = 8, w = (W - m * 2 - gap * (n - 1)) / n;
  segs.forEach(([a, b], i) => { const x = m + i * (w + gap), p = prog(f, a, b); c.fillStyle = dark ? 'rgba(244,237,226,0.22)' : 'rgba(29,26,23,0.14)'; c.beginPath(); c.roundRect(x, y, w, 3, 1.5); c.fill();
    if (p > 0) { c.fillStyle = dark ? 'rgba(244,237,226,0.85)' : 'rgba(29,26,23,0.7)'; c.beginPath(); c.roundRect(x, y, Math.max(3, w * p), 3, 1.5); c.fill(); } });
}
function points(text, kind, size, step) {
  const cv = document.createElement('canvas'), x = cv.getContext('2d', { willReadFrequently: true }); font(x, kind, size); const w = Math.ceil(x.measureText(text).width) + 20, h = Math.ceil(size * 1.4);
  cv.width = w; cv.height = h; font(x, kind, size); x.fillStyle = '#000'; x.fillText(text, 10, size * 1.05); const d = x.getImageData(0, 0, w, h).data, pts = [];
  for (let yy = 0; yy < h; yy += step) for (let xx = 0; xx < w; xx += step) if (d[(yy * w + xx) * 4 + 3] > 128) pts.push([xx - w / 2, yy - size * 1.05]);
  return pts;
}
function card(c, P, f, cx, cy, h, a = 1) { if (a <= 0) return; const w = h * 0.8; c.save(); c.globalAlpha *= a; c.translate(cx, cy);
  c.save(); c.shadowColor = 'rgba(60,40,20,0.2)'; c.shadowBlur = h * 0.08; c.shadowOffsetY = h * 0.03; c.fillStyle = '#efe7da'; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, h * 0.04); c.fill(); c.restore();
  LIB.portrait(c, P, f, 0, 0, h, 0, [w, h], 500); c.restore(); }

// ---- the special kinds (lines are always landed by `land`; these add the motion)
const KIND = {
  impact(c, f, b, dark) { b.lines.forEach(L => land(c, L, f, b, dark)); },
  strike(c, f, b, dark) { b.lines.forEach((L, i) => { const r = land(c, L, f, b, dark), s = E.out(prog(f, b.from + b.strikes[i], b.from + b.strikes[i] + 16));
    if (s > 0) { const rowsY = [...new Set(r.xs.map(q => q[2]))]; rowsY.forEach(ry => { const seg = r.xs.filter(q => q[2] === ry), x0 = seg[0][0], x1 = seg[seg.length - 1][1], yy = ry - r.size * 0.3; c.save(); c.globalAlpha *= 1 - E.exit(prog(f, b.to - 16, b.to)); c.strokeStyle = col('pink', dark); c.lineWidth = r.size * 0.06; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0 - 14, yy + 4); c.lineTo(x0 - 14 + (x1 - x0 + 28) * s, yy - 6 * s); c.stroke(); c.restore(); }); } }); },
  dis(c, f, b, dark) {   // "Now their approval guides you." -> "Now their disapproval guides you."
    land(c, b.lines[0], f, b, dark); const L = b.lines[1], d = E.inOut(prog(f, b.from + b.dis, b.from + b.dis + 26));
    if (d <= 0) { land(c, L, f, b, dark); return; }
    const size = fit(c, 'Now their disapproval guides you.', L.f, L.size * (PORT ? 1.12 : 1), W * 0.86), y = (L.py ?? CY + L.y * LH) + size * 0.32, out = E.exit(prog(f, b.to - 16, b.to)); font(c, L.f, size);
    const a = 'Now their ', dis = 'dis', bb = 'approval guides you.', wa = c.measureText(a).width, wd = c.measureText(dis).width * d, wb = c.measureText(bb).width, x0 = CX - (wa + wd + wb) / 2;
    c.save(); c.globalAlpha *= 1 - out; c.fillStyle = col(L.c, dark); c.fillText(a, x0, y); c.fillText(bb, x0 + wa + wd, y);
    c.save(); c.beginPath(); c.rect(x0 + wa, y - size, wd, size * 1.4); c.clip(); c.fillStyle = C.paper; c.font = `italic 700 ${size}px SerifI`; font(c, 'serifI', size); c.fillStyle = dark ? C.paper : C.ink; c.globalAlpha *= d; c.fillText(dis, x0 + wa, y); c.restore();
    c.strokeStyle = col('pink', dark); c.lineWidth = 2; c.globalAlpha *= E.out(prog(f, b.from + b.dis + 20, b.from + b.dis + 40)); c.beginPath(); c.moveTo(x0 + wa, y + 14); c.lineTo(x0 + wa + wd, y + 14); c.stroke(); c.restore(); },
  center(c, f, b, dark) {   // a centre point appears, then dissolves into rings that leave nothing at the middle
    const t0 = b.from, cy = CY - (PORT ? 120 : 90), dot = E.out(prog(f, t0, t0 + 20)) * (1 - E.inOut(prog(f, t0 + 40, t0 + 70)));
    c.save(); c.fillStyle = col('ink', dark); c.globalAlpha = dot; c.beginPath(); c.arc(CX, cy, 10, 0, 7); c.fill(); c.restore();
    for (let k = 0; k < 4; k++) { const p = prog(f, t0 + 40 + k * 12, t0 + 140 + k * 12); if (p <= 0 || p >= 1) continue; c.save(); c.strokeStyle = col('pink', dark); c.globalAlpha = (1 - p) * 0.8; c.lineWidth = 2; c.beginPath(); c.arc(CX, cy, 10 + E.out(p) * (PORT ? 420 : 460), 0, 7); c.stroke(); c.restore(); }
    b.lines.forEach(L => land(c, L, f, b, dark)); },
  again(c, f, b, dark) {   // "Read that again." — and the line reads itself again, word by word, underlined
    const r = land(c, b.lines[0], f, b, dark); land(c, b.lines[1], f, b, dark); const ag = b.from + b.again;
    if (f >= ag) { const ws = b.lines[0].t.split(' '); ws.forEach((w, i) => { const u = prog(f, ag + i * 6, ag + i * 6 + 10); if (u <= 0) return; const [x0, x1, yy] = r.xs[i]; c.save(); c.globalAlpha *= (1 - E.exit(prog(f, b.to - 16, b.to))) * Math.min(1, u * 2); c.strokeStyle = col('pink', dark); c.lineWidth = 3; c.beginPath(); c.moveTo(x0, yy + 16); c.lineTo(x0 + (x1 - x0) * E.out(u), yy + 16); c.stroke(); c.restore(); }); } },
  dog(c, f, b, dark) {
    const lf = f - b.from, ds = PORT ? 6.2 : 5.6, R0 = ds * 26, gy = CY + R0 * 0.35, rx = R0 * 0.95, ry = R0 * 0.22, stop = b.stop, stopU = E.inOut(prog(lf, stop - 60, stop)), t = f / 60;
    const ang = A.angAt(lf, stop), settle = E.inOut(prog(lf, stop - 30, stop + 10)), px = CX + Math.cos(ang) * rx * (1 - settle), py = gy + Math.sin(ang) * ry * (1 - settle), face = Math.sin(ang) >= 0 ? -1 : 1;
    c.save(); c.globalAlpha *= 1 - E.exit(prog(f, b.to - 16, b.to)); c.strokeStyle = C.line; c.setLineDash([3, 9]); c.lineWidth = 1.5; c.globalAlpha *= 1 - stopU; c.beginPath(); c.ellipse(CX, gy, rx, ry, 0, 0, 7); c.stroke(); c.restore();
    c.save(); c.globalAlpha *= 1 - E.exit(prog(f, b.to - 16, b.to)); if (lf < stop + 4) A.dog.draw(c, px, py, ds * (1 + Math.sin(ang) * 0.08 * (1 - settle)), 'run', t * (1 + 1.4 * (1 - stopU)), { face }); else A.dog.draw(c, CX, gy, ds, 'sit', t, { wag: 0.3, face: 1 }); c.restore();
    b.lines.forEach(L => land(c, L, f, b, dark)); },
  wake(c, f, b, dark) {
    const lf = f - b.from, h = PORT ? 720 : 520, cy = CY - (PORT ? 140 : 70), a = E.out(prog(lf, 110, 150)) * (1 - E.exit(prog(f, b.to - 16, b.to)));
    land(c, b.lines[0], f, { ...b, to: b.from + 120 }, dark, { y: CY });
    if (a > 0) { const fl = E.out(prog(lf, b.open, b.open + 16)); if (fl > 0 && fl < 1) { c.save(); c.globalAlpha = (1 - fl) * 0.45; c.fillStyle = '#fffaf0'; c.fillRect(0, 0, W, H); c.restore(); } card(c, A.now, f, CX, cy, h, a); }
    land(c, b.lines[1], f, b, dark, { y: cy + h / 2 + (PORT ? 130 : 80) }); land(c, b.lines[2], f, b, dark, { y: cy + h / 2 + (PORT ? 290 : 160) }); },
  brackets(c, f, b, dark) {
    b.lines.forEach(L => land(c, L, f, b, dark)); const u = E.out(prog(f, b.from + 90, b.from + 118)), lk = E.inOut(prog(f, b.from + b.lock, b.from + b.lock + 30)), out = E.exit(prog(f, b.to - 16, b.to)), sz = fit(c, b.word, 'serifI', PORT ? 130 : 140), y = CY + 1.1 * LH + sz * 0.3;
    if (u <= 0) return; c.save(); c.globalAlpha *= u * (1 - out); font(c, 'serifI', sz); c.textAlign = 'center'; c.fillStyle = col('pink', dark); c.fillText(b.word, CX, y); const w = c.measureText(b.word).width;
    if (lk > 0) { c.strokeStyle = col('ink', dark); c.lineWidth = 3; const pad = mix(90, 28, lk), x0 = CX - w / 2 - pad, x1 = CX + w / 2 + pad, y0 = y - sz * 0.85, y1 = y + sz * 0.3, k = 24;
      c.beginPath(); c.moveTo(x0 + k, y0); c.lineTo(x0, y0); c.lineTo(x0, y1); c.lineTo(x0 + k, y1); c.moveTo(x1 - k, y0); c.lineTo(x1, y0); c.lineTo(x1, y1); c.lineTo(x1 - k, y1); c.globalAlpha *= lk; c.stroke(); } c.restore(); },
  un(c, f, b, dark) {
    b.lines.forEach(L => land(c, L, f, b, dark)); const u = E.out(prog(f, b.from + 70, b.from + 98)), un = E.inOut(prog(f, b.from + b.un, b.from + b.un + 34)), out = E.exit(prog(f, b.to - 16, b.to)), sz = fit(c, 'un' + b.word, 'serifI', PORT ? 130 : 150), y = CY + 1.0 * LH + sz * 0.32;
    if (u <= 0) return; font(c, 'serifI', sz); const wc = c.measureText(b.word).width, wu = c.measureText('un').width; c.save(); c.globalAlpha *= u * (1 - out); const x0 = CX - (wc + wu * un) / 2;
    c.fillStyle = col('ink', dark); c.fillText(b.word, x0 + wu * un, y + (1 - u) * 20); if (un > 0) { c.globalAlpha *= un; c.fillStyle = col('pink', dark); c.filter = `blur(${((1 - un) * 6).toFixed(1)}px)`; c.fillText('un', x0 - (1 - un) * 70, y); } c.restore(); },
  breaks(c, f, b, dark) {   // the word "breaks." cracks and its letters fall
    land(c, b.lines[0], f, b, dark); const L = b.lines[1], ck = b.from + b.crack;
    if (f < ck) { land(c, L, f, b, dark); return; }
    const size = fit(c, L.t, L.f, L.size * (PORT ? 1.12 : 1), W * 0.86), y = (L.py ?? CY + L.y * LH) + size * 0.32, out = E.exit(prog(f, b.to - 16, b.to)); font(c, L.f, size); const pre = 'it is security that ', w1 = c.measureText(pre).width, w2 = c.measureText('breaks.').width, x0 = CX - (w1 + w2) / 2;
    c.save(); c.globalAlpha *= 1 - out; c.fillStyle = col(L.c, dark); c.fillText(pre, x0, y); let lx = x0 + w1;
    [...'breaks.'].forEach((ch, i) => { const cw = c.measureText(ch).width, d = prog(f, ck + i * 2, ck + 40 + i * 2), g = d * d; c.save(); c.translate(lx + cw / 2 + (i - 3) * 6 * d, y + g * (PORT ? 520 : 420) * (0.7 + hash(i) * 0.6)); c.rotate((hash(i + 3) - 0.5) * 2.4 * d); c.globalAlpha *= 1 - d * 0.9; c.fillText(ch, -cw / 2, 0); c.restore(); lx += cw; });
    const cr = E.out(prog(f, ck - 2, ck + 6)); c.strokeStyle = col('pink', dark); c.lineWidth = 2; c.globalAlpha *= cr * (1 - prog(f, ck + 10, ck + 40)); c.beginPath(); const cx0 = x0 + w1 + w2 * 0.45; c.moveTo(cx0, y - size); c.lineTo(cx0 + 12, y - size * 0.6); c.lineTo(cx0 - 8, y - size * 0.3); c.lineTo(cx0 + 6, y + 10); c.stroke(); c.restore(); },
  wind(c, f, b, dark) {   // the words blow away, letter by letter, like wind through open palms
    const bl = b.from + b.blow; if (f < bl) { b.lines.forEach(L => land(c, L, f, b, dark)); return; }
    b.lines.forEach((L, li) => { const size = fit(c, L.t, L.f, L.size * (PORT ? 1.12 : 1), W * 0.86), y = (L.py ?? CY + L.y * LH) + size * 0.32; font(c, L.f, size); const tw = c.measureText(L.t).width; let lx = CX - tw / 2;
      [...L.t].forEach((ch, i) => { const cw = c.measureText(ch).width, d = E.inOut(prog(f, bl + (i / L.t.length) * 30 + li * 6, bl + 70 + (i / L.t.length) * 30 + li * 6)); c.save(); c.globalAlpha *= 1 - d;
        if (d > 0) c.filter = `blur(${(d * 6).toFixed(1)}px)`; c.translate(lx + cw / 2 + d * (W * 0.5) * (0.6 + hash(i + li * 40)), y - d * 120 * (hash(i * 3 + li) - 0.3) + Math.sin(d * 6 + i) * 20 * d); c.rotate(d * (hash(i + 9) - 0.5) * 2); font(c, L.f, size); c.fillStyle = col(L.c, dark); c.textAlign = 'center'; c.fillText(ch, 0, 0); c.restore(); lx += cw; }); });
    // a few streaks of air
    for (let k = 0; k < 7; k++) { const p = prog(f, bl + k * 6, bl + 60 + k * 6); if (p <= 0 || p >= 1) continue; const yy = CY + (hash(k) - 0.5) * LH * 3, x = mix(-200, W + 200, E.inOut(p)); c.save(); c.strokeStyle = col('ink2', dark); c.globalAlpha = Math.sin(p * Math.PI) * 0.35; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 220, yy); c.quadraticCurveTo(x - 110, yy - 18, x, yy); c.stroke(); c.restore(); } },
  couplets(c, f, b, dark) {
    const n = b.pairs.length, seg = (b.to - b.from) / n; b.pairs.forEach(([a, bb], i) => { const s = b.from + i * seg, e = s + seg, sub = { from: s, to: e };
      land(c, { t: a, at: 4, step: 9, size: 92, f: 'serif', c: 'ink', y: -0.55, py: PORT ? CY - 70 : null }, f, sub, dark); land(c, { t: bb, at: 44, step: 12, size: 92, f: 'serifI', c: 'pink', y: 0.6, py: PORT ? CY + 70 : null }, f, sub, dark);
      const u = E.inOut(prog(f, s + 50, s + 80)) * (1 - E.exit(prog(f, e - 16, e))); if (u > 0) { c.save(); c.strokeStyle = col('pink', dark); c.globalAlpha = 0.6 * u; c.lineWidth = 2; const hw = (PORT ? 220 : 300) * u, ly = CY + 1.25 * LH; c.beginPath(); c.moveTo(CX - hw, ly); c.lineTo(CX + hw, ly); c.stroke(); c.restore(); } }); },
  drops(c, f, b, dark) {
    b.lines.forEach(L => land(c, L, f, b, dark)); const lf = f - b.from, out = E.exit(prog(f, b.to - 16, b.to)), dr = prog(lf, b.fall, b.fall + 150);
    A.ocean.forEach(([px, py], i) => { const h1 = hash(i), d = clamp(dr * 1.6 - h1 * 0.6), g = d * d, x = CX + px + (h1 - 0.5) * 50 * d, y = CY + 40 + py + g * (H * 0.5) * (0.6 + hash(i + 3));
      c.globalAlpha = E.out(prog(lf, 4 + h1 * 30, 30 + h1 * 30)) * (1 - d * 0.85) * (1 - out); c.fillStyle = d > 0.02 ? '#5b7b8c' : col('ink', dark); c.beginPath(); c.arc(x, y, d > 0.02 ? 2.8 : 2.4, 0, 7); c.fill(); }); c.globalAlpha = 1; },
  gather(c, f, b, dark) {   // countless drops become one drop, which becomes the ocean
    b.lines.forEach(L => land(c, L, f, b, dark)); const lf = f - b.from, out = E.exit(prog(f, b.to - 16, b.to)), g = E.inOut(prog(lf, b.gather, b.gather + 70)), cy = CY;
    A.scatter.forEach(([x, y], i) => { const tx = CX, ty = cy, u = clamp(g * 1.2 - hash(i) * 0.2); c.globalAlpha = E.out(prog(lf, 4 + hash(i + 2) * 40, 30 + hash(i + 2) * 40)) * (1 - out) * (1 - prog(lf, b.gather + 66, b.gather + 74)); c.fillStyle = '#5b7b8c'; c.beginPath(); c.arc(mix(x, tx, u), mix(y, ty, u), 2.6, 0, 7); c.fill(); });
    const one = E.out(prog(lf, b.gather + 62, b.gather + 80)) * (1 - out); if (one > 0) { c.globalAlpha = one; c.fillStyle = '#5b7b8c'; c.beginPath(); c.arc(CX, cy, 9, 0, 7); c.fill();
      for (let k = 0; k < 5; k++) { const p = prog(lf, b.gather + 80 + k * 16, b.gather + 200 + k * 16); if (p <= 0 || p >= 1) continue; c.save(); c.strokeStyle = '#5b7b8c'; c.globalAlpha = (1 - p) * 0.7 * (1 - out); c.lineWidth = 2; c.beginPath(); c.ellipse(CX, cy, 9 + E.out(p) * (PORT ? 460 : 620), (9 + E.out(p) * (PORT ? 460 : 620)) * 0.42, 0, 0, 7); c.stroke(); c.restore(); } }
    c.globalAlpha = 1; },
  swaps(c, f, b, dark) {
    const n = b.swaps.length, seg = (b.to - b.from) / n, S = PORT ? 170 : 200;
    b.swaps.forEach(([lead, a, bb], i) => { const s = b.from + i * seg, e = s + seg, sw = s + 60, sub = { from: s, to: e };
      if (f < s || f >= e) return; land(c, { t: lead, at: 4, step: 7, size: 64, f: 'serif', c: 'ink2', y: -2.2, py: PORT ? CY - 300 : null }, f, sub, dark); land(c, { t: 'I offer him', at: 54, step: 9, size: 56, f: 'serifI', c: 'ink2', y: 2.1, py: PORT ? CY + 260 : null }, f, sub, dark);
      const m = E.inOut(prog(f, sw, sw + 26)), out = E.exit(prog(f, e - 16, e)), y = CY + S * 0.33, ca = i === 0 ? '#b8892b' : i === 1 ? '#5b7b8c' : col('ink', dark);
      c.save(); c.globalAlpha *= (1 - m) * E.out(prog(f, s + 10, s + 34)) * (1 - out); c.filter = m > 0 ? `blur(${(m * 12).toFixed(1)}px)` : 'none'; font(c, 'serifI', fit(c, a, 'serifI', S)); c.textAlign = 'center'; c.fillStyle = ca; c.fillText(a, CX, y - m * 30); c.restore();
      if (bb) { c.save(); c.globalAlpha *= m * (1 - out); c.filter = m < 1 ? `blur(${((1 - m) * 12).toFixed(1)}px)` : 'none'; font(c, 'serif', fit(c, bb, 'serif', S)); c.textAlign = 'center'; c.fillStyle = i === 0 ? '#6b4a2e' : col('pink', dark);
          if (bb === 'defiance') { c.translate(CX, y); c.scale(1, mix(0.6, 1.25, m)); c.fillText(bb, 0, 0); } else c.fillText(bb, CX, y + (1 - m) * 30); c.restore(); }
      else { const u = E.out(prog(f, sw + 30, sw + 50)) * (1 - out); c.save(); c.globalAlpha *= u; font(c, 'mono', PORT ? 26 : 22, 500); c.letterSpacing = '8px'; c.fillStyle = C.mute; c.textAlign = 'center'; c.fillText('( SILENCE )', CX, y - S * 0.3); c.restore(); } }); },
};
// ---- the end: only now the title, the name and the address
function endCard(c, f) {
  const u = E.out(prog(f, END, END + 30)); bg(c, f, null); ghost(c, f, false);
  const h = PORT ? 420 : 300, cy = PORT ? CY - 300 : CY - 220; card(c, A.now, f, CX, cy + (1 - u) * 20, h, u);
  const ty = cy + h / 2 + (PORT ? 150 : 120), s = fit(c, R.title, 'serif', PORT ? 92 : 100, W * 0.86); LIB.wordsIn(c, R.title, f, END + 16, 5, CX, ty, s, 'serif', C.ink, 'center');
  const v = E.out(prog(f, END + 46, END + 72)); c.save(); c.globalAlpha = v; font(c, 'serifI', PORT ? 50 : 44); c.textAlign = 'center'; c.fillStyle = C.ink2; c.fillText(R.cat + ' by Nikit Hamal', CX, ty + (PORT ? 90 : 76));
  font(c, 'mono', PORT ? 22 : 18, 500); c.letterSpacing = '5px'; c.fillStyle = C.mute; c.fillText(R.date.toUpperCase(), CX, ty + (PORT ? 150 : 124)); c.restore();
  const url = 'nikit.is-a.dev/writings/' + SLUG, w = E.out(prog(f, END + 70, END + 96)); c.save(); c.globalAlpha = w; font(c, 'mono', fit(c, url, 'mono', PORT ? 28 : 26, W * 0.9), 500); c.textAlign = 'center'; c.fillStyle = C.ink; c.fillText(url, CX, ty + (PORT ? 240 : 200));
  const uw = c.measureText(url).width; c.strokeStyle = C.pink; c.lineWidth = 2; c.beginPath(); c.moveTo(CX - uw / 2, ty + (PORT ? 258 : 216)); c.lineTo(CX - uw / 2 + uw * E.inOut(prog(f, END + 90, END + 130)), ty + (PORT ? 258 : 216)); c.stroke(); c.restore();
}
function grain(c, f) { c.save(); c.globalAlpha = 0.07; c.globalCompositeOperation = 'overlay'; const ox = (hash(Math.floor(f / 2)) * 512) | 0, oy = (hash(Math.floor(f / 2) + 7) * 512) | 0; for (let y = -oy; y < H; y += 512) for (let x = -ox; x < W; x += 512) c.drawImage(A.grain, x, y); c.restore(); }
function draw(c, f) {
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none'; c.imageSmoothingEnabled = true;
  if (f >= END) { endCard(c, f); bars(c, f, false); grain(c, f); return; }
  const b = blockAt(f), dark = bg(c, f, b);
  // camera: a slow push through each block, and a small kick on every beat
  const lp = prog(f, b.from, b.to), kick = 0.006 * Math.exp(-((f - b.from) % BEAT) / 5), z = 1 + lp * 0.035 + kick;
  c.save(); c.translate(CX, CY); c.scale(z, z); c.translate(-CX, -CY);
  if (b.mode !== 'pond') ghost(c, f, dark);
  KIND[b.kind](c, f, b, dark || b.mode === 'pond');
  c.restore();
  // a soft light sweeps through on each cut
  const lk = prog(f, b.from, b.from + 18); if (lk < 1 && b.from > 0) { c.save(); c.globalAlpha = (1 - lk) * 0.22; const g = c.createLinearGradient(mix(-W, W, lk), 0, mix(0, W * 2, lk), 0); g.addColorStop(0, 'rgba(255,240,220,0)'); g.addColorStop(0.5, 'rgba(255,240,220,1)'); g.addColorStop(1, 'rgba(255,240,220,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore(); }
  bars(c, f, dark || b.mode === 'pond'); grain(c, f);
}
async function load() {
  await LIB.fonts(); R = (await (await fetch('reels.json')).json())[SLUG]; layoutPortrait(document.getElementById('c').getContext('2d'));
  A.dog = LIB.dogKit('rottie'); A.now = await LIB.loadPortrait('../shared/art', 'now', LIB.eyeTrack({ keys: [[0, 0, 0], [END, 0, 0], [END + 60, 0, 0.1], [TOTAL, 0, 0]], blinks: [END + 120], winks: [[END + 170, 'l']] }));
  const wk = R.beats.find(b => b.kind === 'wake'); if (wk) { const base = A.now.track; A.now = { ...A.now, track: f => { const s = base(f); if (f < wk.from + wk.open) { s.L = 0; s.R = 0; } else if (f < wk.from + wk.open + 8) { const o = (f - wk.from - wk.open) / 8; s.L = s.R = o; } return s; } }; }
  A.ocean = points('ocean', 'serifI', PORT ? 240 : 280, 5);
  A.scatter = Array.from({ length: 420 }, (_, i) => [CX + (hash(i * 1.3) - 0.5) * W * 0.9, CY + (hash(i * 2.7) - 0.5) * H * 0.55]);
  const dg = R.beats.find(b => b.kind === 'dog'); if (dg) { const angs = [0]; for (let k = 1; k <= 400; k++) { const sp = mix(1.6, 4.4, E.smooth(prog(k, 0, 140))) * (1 - E.inOut(prog(k, dg.stop - 60, dg.stop))); angs.push(angs[k - 1] + sp * 0.022); } A.angAt = (lf) => angs[Math.max(0, Math.min(400, Math.round(lf)))]; }
  if (R.beats.some(b => b.mode === 'pond')) { const o = PORT ? 'port' : 'land'; A.golden = await LIB.loadClip(`../shared/pond/${o}_golden.webm`, 150); A.night = await LIB.loadClip(`../shared/pond/${o}_night.webm`, 150); }
  A.grain = document.createElement('canvas'); A.grain.width = 512; A.grain.height = 512; const g = A.grain.getContext('2d'), id = g.createImageData(512, 512); let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (rnd() - 0.5) * 70; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } g.putImageData(id, 0, 0);
}
const cv = document.getElementById('c'); cv.width = W; cv.height = H;
const frame = LIB.blurFrame(cv, draw, [], 8);
window.film = { load, frame, TOTAL, W, H };
