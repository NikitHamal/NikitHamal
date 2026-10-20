// Film engine for the festival reels: a vertical 1080x1920 frame built from a 180x320 PX raster (6x nearest-neighbour)
// plus a full-res type layer. A film is a list of shots on a beat grid; every shot draws as a pure function of its
// local time, so any frame can be rendered alone (parallel workers, no accumulation).
'use strict';
const ENG = (() => {
  const { Raster, clamp, mix, prog, E, hex, bayer, hash } = PX;
  const W = 1080, H = 1920, S = 6, w = W / S, h = H / S, FPS = 30;
  const A = new Raster(w, h), B = new Raster(w, h);
  // 8x8 Bayer for smoother pixel dissolves
  const B8 = (() => { const m = [[0]]; let M = m; for (let n = 1; n < 8; n *= 2) { const N = []; for (let y = 0; y < n * 2; y++) { N.push([]); for (let x = 0; x < n * 2; x++) N[y].push(4 * M[y % n][x % n] + [0, 2, 3, 1][(y >= n) * 2 + (x >= n)]); } M = N; } return M.map(r => r.map(v => (v + 0.5) / 64)); })();
  const b8 = (x, y) => B8[y & 7][x & 7];
  // transitions: mask(x, y, k) -> true when the incoming shot shows at (x, y) for progress k
  const TR = {
    dither: (x, y, k) => b8(x, y) < k,
    iris: (x, y, k, o = {}) => Math.hypot(x - (o.cx ?? w / 2), y - (o.cy ?? h / 2)) < k * Math.hypot(w, h) * 0.62 + (b8(x, y) - 0.5) * 6,
    wipeDown: (x, y, k) => y < k * (h + 24) - 12 + Math.sin(x * 0.2) * 4 + (b8(x, y) - 0.5) * 8,
    wipeUp: (x, y, k) => (h - y) < k * (h + 24) - 12 + Math.sin(x * 0.2) * 4 + (b8(x, y) - 0.5) * 8,
    blocks: (x, y, k) => hash(Math.floor(x / 10), Math.floor(y / 10), 3) < k,
    diag: (x, y, k) => (x + y * 0.56) / (w + h * 0.56) < k * 1.15 - 0.075 + (b8(x, y) - 0.5) * 0.06,
    cut: () => true,
  };
  function comp(dst, src, mask, k, o) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask(x, y, k, o)) dst.b[y * w + x] = src.b[y * w + x]; }

  // ---------- full-res type helpers
  function T(c, s, x, y, size, fam, col, o = {}) {
    const { align = 'center', weight = 400, ls = 0, alpha = 1, shadow = null, italic = false, maxW = 0, base = 'alphabetic' } = o; if (alpha <= 0) return 0;
    c.save(); c.globalAlpha *= alpha; c.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${fam}`; c.letterSpacing = ls + 'px'; c.textAlign = align; c.textBaseline = base;
    if (maxW) { const mw = c.measureText(s).width; if (mw > maxW) { size *= maxW / mw; c.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${fam}`; } }
    if (shadow) { c.shadowColor = shadow[0]; c.shadowBlur = shadow[1]; c.shadowOffsetX = shadow[2] || 0; c.shadowOffsetY = shadow[3] || 0; }
    c.fillStyle = col; c.fillText(s, x, y); const mw = c.measureText(s).width; c.restore(); return mw; }
  // a line that rises in (per word, staggered) and fades out; lt in seconds, [t0, t1] visible window
  function line(c, s, lt, t0, t1, x, y, size, fam, col, o = {}) {
    if (lt < t0 || lt > t1 + 0.4) return; const words = s.split(' '), st = o.stagger ?? 0.06, out = E.in(prog(lt, t1, t1 + 0.35));
    c.save(); c.font = `${o.italic ? 'italic ' : ''}${o.weight || 400} ${size}px ${fam}`; c.letterSpacing = (o.ls || 0) + 'px';
    const sp = c.measureText(' ').width, ws = words.map(q => c.measureText(q).width), tot = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1), k0 = o.maxW && tot > o.maxW ? o.maxW / tot : 1; c.restore();
    let cx = (o.align === 'left' ? x : o.align === 'right' ? x - tot * k0 : x - tot * k0 / 2);
    words.forEach((q, i) => { const u = E.out(prog(lt, t0 + i * st, t0 + i * st + 0.45)); if (u > 0) T(c, q, cx, y + (1 - u) * size * 0.45 - out * size * 0.3, size * k0, fam, col, { ...o, align: 'left', alpha: u * (1 - out) * (o.alpha ?? 1), maxW: 0 }); cx += (ws[i] + sp) * k0; });
  }
  // typewriter for small pixel-font labels
  function typed(c, s, lt, t0, t1, x, y, size, col, o = {}) { if (lt < t0 || lt > t1 + 0.3) return; const n = Math.min(s.length, Math.floor((lt - t0) * (o.rate || 40))); const out = prog(lt, t1, t1 + 0.3);
    T(c, s.slice(0, n) + (n < s.length && Math.floor(lt * 8) % 2 ? '▌' : ''), x, y, size, o.fam || 'SilkB', col, { align: o.align || 'center', ls: o.ls ?? size * 0.18, alpha: 1 - out, shadow: o.shadow }); }
  // chapter tag: "01 · THE STORY" with a bar that draws on
  function chapter(c, num, label, lt, t0, t1, col = '#fff', y = 150) { if (lt < t0 || lt > t1 + 0.3) return; const u = E.out(prog(lt, t0, t0 + 0.5)), out = prog(lt, t1, t1 + 0.3);
    c.save(); c.globalAlpha = 1 - out; c.fillStyle = col; c.fillRect(W / 2 - 160 * u, y + 26, 320 * u, 3); c.restore(); typed(c, num + ' · ' + label, lt, t0 + 0.1, t1, W / 2, y, 26, col, { rate: 36 }); }

  // ---------- film runner
  function make(spec) {
    const { shots, total, post, overlay, load } = spec; let started = false;
    // shots: [{ a, b, draw(R, lt, f, film), ov(c, lt, f), tr: 'dither' | ..., td: frames, to: {} }]
    function at(f) { for (let i = shots.length - 1; i >= 0; i--) if (f >= shots[i].a) return i; return 0; }
    function frame(f, c) {
      const i = at(f), s = shots[i], lt = (f - s.a) / FPS; A.ox = A.oy = 0; s.draw(A, lt, f, s);
      const td = s.td ?? 0; let k = 1;
      if (i > 0 && td > 0 && f - s.a < td) { const p = shots[i - 1]; k = (f - s.a) / td; B.ox = B.oy = 0; p.draw(B, (f - p.a) / FPS, f, p); comp(B, A, TR[s.tr || 'dither'], E.smooth(k), s.to || {}); A.b.set(B.b); }
      if (post) post(A, f);
      const sh = spec.shake ? spec.shake(f) : 0, sx = sh ? Math.round((hash(f, 1) - 0.5) * sh) * S / 2 : 0, sy = sh ? Math.round((hash(f, 2) - 0.5) * sh) * S / 2 : 0;
      c.fillStyle = '#000'; c.fillRect(0, 0, W, H); A.blit(c, S, sx - (sh ? S : 0), sy - (sh ? S : 0), (w + (sh ? 2 : 0)) * S, (h + (sh ? 2 : 0)) * S);
      if (i > 0 && td > 0 && f - s.a < td && shots[i - 1].ov) { c.save(); c.globalAlpha = 1 - E.smooth(k); const p = shots[i - 1]; p.ov(c, (f - p.a) / FPS, f, p); c.restore(); }
      if (s.ov) { c.save(); c.globalAlpha = td > 0 && i > 0 ? E.smooth(clamp(k * 1.5)) : 1; s.ov(c, lt, f, s); c.restore(); }
      if (overlay) overlay(c, f);
    }
    return { W, H, FPS, total, frame, load: async () => { if (load) await load(); started = true; } };
  }
  return { W, H, S, w, h, FPS, A, B, TR, b8, comp, T, line, typed, chapter, make };
})();
