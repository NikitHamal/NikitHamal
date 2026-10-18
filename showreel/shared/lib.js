// Shared engine for the showreel films (landscape 1920x1080 and portrait 1080x1920).
// Everything here is deterministic in the frame number, so motion blur can re-draw sub-frames.
// Pieces: easing + type helpers, the painted portrait with live eyes (blink / wink / gaze), the site's
// <pixel-dog> rig (js/pixel-dog.js), the homepage koi pond footage (shared/pond/*.webm), the writing
// pages' <pixel-scene> vignettes (shared/scenes/*.png) and the essays' line-art motion forms (js/motion-forms*.js).
'use strict';
const LIB = (() => {
  // ---- easing + helpers
  function bez(x1, y1, x2, y2) { const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    return t => { if (t <= 0) return 0; if (t >= 1) return 1; let x = t; for (let i = 0; i < 8; i++) { const fx = ((ax * x + bx) * x + cx) * x - t, d = (3 * ax * x + 2 * bx) * x + cx; if (Math.abs(fx) < 1e-6 || !d) break; x -= fx / d; } return ((ay * x + by) * x + cy) * x; }; }
  const E = { out: bez(.16, 1, .3, 1), inOut: bez(.87, 0, .13, 1), smooth: bez(.65, 0, .35, 1), exit: bez(.55, .055, .675, .19), whip: bez(.6, 0, .15, 1), soft: bez(.33, 0, .2, 1), drift: bez(.4, 0, .6, 1) };
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), prog = (f, a, b) => clamp((f - a) / (b - a)), mix = (a, b, t) => a + (b - a) * t;
  const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
  const img = src => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => j(new Error('load ' + src)); i.src = src; });

  // ---- type (families are declared in shared/fonts.css)
  const FAM = { mono: 'Mono', serif: 'Serif', serifI: 'SerifI', sans: 'Sans', pop: 'Poppins', cinzel: 'Cinzel', icon: 'MIcons' };
  function font(c, kind, size, weight = 400) { c.font = kind === 'serifI' ? `italic ${weight} ${size}px SerifI` : `${weight} ${size}px ${FAM[kind] || kind}`; }
  async function fonts() {
    for (const s of ['400 40px Mono', '700 40px Mono', '400 100px Serif', 'italic 400 100px SerifI', '600 40px Sans', '700 40px Sans', '400 40px Poppins', '500 40px Poppins', '600 40px Poppins', '700 40px Poppins', '800 40px Poppins', '400 40px Cinzel', '700 40px Cinzel', '400 40px MIcons'])
      await document.fonts.load(s, s.includes('MIcons') ? 'home' : 'Aa');
  }
  // text typed at `rate` frames per character, with a block caret while typing and blinking after
  function typed(c, text, f, f0, x, y, size, o = {}) {
    const { kind = 'mono', weight = 400, col = '#18181b', rate = 3, caret = true, caretUntil = 1e9, align = 'left', caretCol = col } = o;
    if (f < f0) return x; const n = Math.min(text.length, Math.floor((f - f0) / rate) + 1), s = text.slice(0, n);
    c.save(); font(c, kind, size, weight); c.fillStyle = col; c.textBaseline = 'alphabetic';
    const full = c.measureText(text).width, x0 = align === 'center' ? x - full / 2 : align === 'right' ? x - full : x; c.fillText(s, x0, y); const xe = x0 + c.measureText(s).width;
    if (caret && f < caretUntil && (n < text.length || Math.floor((f - f0) / 15) % 2 === 0)) { c.fillStyle = caretCol; c.globalAlpha *= 0.85; c.fillRect(xe + size * 0.08, y - size * 0.78, size * 0.5, size * 0.95); }
    c.restore(); return xe;
  }
  // a fragment that rises in (no overshoot) and exits as a whole
  function rise(c, text, f, inF, outF, x, y, size, kind = 'serif', col = '#18181b', align = 'center', weight = 400, dur = 22) {
    if (f < inF || f > outF + 14) return; const u = E.out(prog(f, inF, inF + dur)), e = E.exit(prog(f, outF, outF + 14));
    c.save(); font(c, kind, size, weight); c.textAlign = align; c.fillStyle = col; c.globalAlpha *= u * (1 - e); c.fillText(text, x, y + (1 - u) * size * 0.35 - e * size * 0.2); c.restore();
  }
  // words arriving one by one (each rises and un-blurs), laid out on one line; returns the line width
  function wordsIn(c, text, f, f0, step, x, y, size, kind = 'serif', col = '#18181b', align = 'center', outF = 1e9) {
    const ws = text.split(' '); font(c, kind, size); const sp = c.measureText(' ').width, wd = ws.map(w => c.measureText(w).width), tot = wd.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
    let wx = align === 'center' ? x - tot / 2 : align === 'right' ? x - tot : x; const e = E.exit(prog(f, outF, outF + 16));
    ws.forEach((w, i) => { const u = E.out(prog(f, f0 + i * step, f0 + i * step + 26)); if (u > 0) { c.save(); font(c, kind, size); c.fillStyle = col; c.globalAlpha *= u * (1 - e); if (u < 1) c.filter = `blur(${((1 - u) * 6).toFixed(1)}px)`; c.fillText(w, wx, y + (1 - u) * size * 0.3 - e * size * 0.15); c.restore(); } wx += wd[i] + sp; });
    return tot;
  }

  // ---- the painted portrait + live eyes (preview/art/<id>/eyes.svg, parsed into canvas paths)
  function parseEyes(txt) {
    const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${txt}</svg>`, 'image/svg+xml');
    return [...doc.querySelectorAll('g.eye')].map(g => {
      const [ox, oy] = g.getAttribute('style').match(/[\d.]+/g).map(Number), clip = new Path2D(g.querySelector('clipPath path').getAttribute('d'));
      const kids = [...g.children].filter(k => k.tagName !== 'clipPath'), white = kids[0], inner = kids[1], strokes = kids.slice(2);
      const iris = [...inner.querySelectorAll('.iris circle')].map(c => ({ x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), r: +c.getAttribute('r'), fill: c.getAttribute('fill') }));
      const sp = p => ({ p: new Path2D(p.getAttribute('d')), stroke: p.getAttribute('stroke'), w: +p.getAttribute('stroke-width'), a: +(p.getAttribute('stroke-opacity') || p.getAttribute('opacity') || 1) });
      const nums = white.getAttribute('d').match(/-?[\d.]+/g).map(Number), xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
      return { side: g.classList.contains('eye-l') ? 'l' : 'r', ox, oy, clip, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], white: { p: new Path2D(white.getAttribute('d')), fill: white.getAttribute('fill') }, iris, shade: sp(inner.querySelector(':scope > path')), strokes: strokes.map(sp) };
    });
  }
  function lid(f, at, hold = 3) { const d = f - at; if (d < 0 || d > 10 + hold) return 1; return d < 3 ? 1 - d / 3 : d < 3 + hold ? 0 : clamp((d - 3 - hold) / 6); }
  // eyes over time: gaze keyframes [f, x, y] (-1..1), blink frames, winks [f, 'l'|'r'], optional override(f) -> {lx, ly}
  function eyeTrack({ keys = [[0, 0, 0]], blinks = [], winks = [], over = null }) {
    return f => {
      let i = 0; while (i < keys.length - 1 && keys[i + 1][0] <= f) i++;
      const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)], u = b === a ? 0 : E.smooth(prog(f, b[0] - 14, b[0]));
      let lx = mix(a[1], b[1], u), ly = mix(a[2], b[2], u); const o = over && over(f); if (o) { lx = o.lx; ly = o.ly; }
      let L = 1, R = 1; for (const b2 of blinks) { const v = lid(f, b2); L = Math.min(L, v); R = Math.min(R, v); }
      for (const [at, s] of winks) { const v = lid(f, at, 14); if (s === 'l') L = Math.min(L, v); else R = Math.min(R, v); }
      return { lx, ly, L, R };
    };
  }
  function drawEyes(c, eyes, st) {
    for (const e of eyes) {
      const open = e.side === 'l' ? st.L : st.R, sy = mix(0.1, 1, open);
      if (open < 1 && e.lid) {   // the closing lid: skin sampled from the painting just above and below the eye
        c.save(); const g = c.createLinearGradient(0, e.oy - 22, 0, e.oy + 14); g.addColorStop(0, e.lid[0]); g.addColorStop(1, e.lid[1]);
        c.globalAlpha *= clamp((1 - open) * 1.6); c.filter = 'blur(5px)'; c.fillStyle = g; c.translate(e.ox, e.oy); c.scale(1.12, 1.45); c.translate(-e.ox, -e.oy); c.fill(e.white.p); c.restore(); }
      c.save(); c.translate(e.ox, e.oy); c.scale(1, sy); c.translate(-e.ox, -e.oy);
      if (open > 0.25) {
        c.fillStyle = e.white.fill; c.fill(e.white.p);
        c.save(); c.clip(e.clip); c.translate(st.lx * 12, st.ly * 7); for (const ir of e.iris) { c.fillStyle = ir.fill; c.beginPath(); c.arc(ir.x, ir.y, ir.r, 0, 7); c.fill(); } c.restore();
        c.save(); c.clip(e.clip); c.globalAlpha *= e.shade.a; c.strokeStyle = e.shade.stroke; c.lineWidth = e.shade.w; c.stroke(e.shade.p); c.restore();
      }
      if (open < 0.3) { c.restore(); const [x0, y0, x1, y1] = e.box, my = (y0 + y1) / 2 + 2, k = 1 - open / 0.3;
        c.save(); c.globalAlpha *= k; c.strokeStyle = '#1d1714'; c.lineCap = 'round'; c.lineWidth = 4.5; c.beginPath(); c.moveTo(x0 + 2, my - 2); c.quadraticCurveTo((x0 + x1) / 2, my + (y1 - y0) * 0.55, x1 - 2, my - 3); c.stroke();
        c.restore(); continue; }
      const ga = c.globalAlpha; for (const s of e.strokes) { c.globalAlpha = ga * s.a; c.strokeStyle = s.stroke; c.lineCap = 'round'; c.lineWidth = s.w / Math.max(sy, 0.45); c.stroke(s.p); } c.globalAlpha = ga;
      c.restore();
    }
  }
  // portrait (800x1000 art space) centred at cx,cy with height h; clipped to a box [cw, ch] whose corner radius
  // goes from 18 px (round=0) to a full circle (round=1); `focus` is the art-space y kept at the box centre.
  function portrait(c, P, f, cx, cy, h, round = 0, box = null, focus = 500) {
    const s = h / 1000, w = 800 * s, cw = box ? box[0] : w, ch = box ? box[1] : h, r = mix(18, Math.min(cw, ch) / 2, round);
    c.save(); c.translate(cx, cy); c.beginPath(); c.roundRect(-cw / 2, -ch / 2, cw, ch, r); c.clip();
    c.translate(-w / 2, -focus * s); c.scale(s, s); c.drawImage(P.paint, 0, 0); drawEyes(c, P.eyes, P.track(f)); c.restore();
  }
  async function loadPortrait(base, id, track) {
    const paint = await img(`${base}/${id}_paint.webp`), eyes = parseEyes(await (await fetch(`${base}/${id}_eyes.svg`)).text());
    const cv = document.createElement('canvas'); cv.width = 800; cv.height = 1000; const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(paint, 0, 0);
    const at = (px, py) => { const d = x.getImageData(px - 6, py - 3, 12, 6).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; return `rgb(${r / n | 0},${g / n | 0},${b / n | 0})`; };
    for (const e of eyes) e.lid = [at(e.ox, e.oy - 30), at(e.ox, e.oy + 26)];
    return { paint, eyes, track };
  }

  // ---- the site's pixel dog (<pixel-dog> rig from js/pixel-dog.js, breed "rottie" as on the homepage)
  const ZS = ['XXXX', '..X.', '.X..', 'XXXX'], ZB = ['XXXXX', '...X.', '..X..', '.X...', 'XXXXX'];
  function dogKit(breed = 'rottie') {
    const R = customElements.get('pixel-dog').rig, V = Object.assign({}, R.BREEDS[breed]); V.m = R.PATTERNS[V.pattern] || {};
    const pal = R.buildPal(V), L = R.mk(R.DW, R.H), T = new Uint8Array(R.DW * R.H), cv = document.createElement('canvas'); cv.width = R.DW; cv.height = R.H;
    const x = cv.getContext('2d'), im = x.createImageData(R.DW, R.H), px = new Uint32Array(im.data.buffer);
    // pose at time t (seconds): 'sleep' | 'sit' | 'stand' | 'lie' | 'walk' | 'run'; o: {wag, eye, mouth, ph}
    function pose(kind, t, o = {}) {
      const base = { sleep: 'SLEEP_SPLOOT', sit: 'SIT', stand: 'STAND', lie: 'LIE', walk: 'STAND', run: 'STAND', bow: 'BOW', jump: 'JUMP' }[kind];
      const P = R.cp(R.poses[base]);
      if (kind === 'sleep') {   // the site's sleep (js/pixel-dog.js 'sleep'): the sploot — melty breathing, swaying tail, blep in and out, dream twitches
        const br = Math.sin(t * 1.5); P.b[3] += br * 0.45; P.b[2] += br * 0.35; P.tl[2] += Math.sin(t * 2.2) * 0.15; P.mouth = Math.sin(t * 0.8) > -0.55 ? 'blep' : 'closed';
        const dr = (t % 12) - 7; if (dr > 0 && dr < 2) { P.legs[0][4] += Math.sin(t * 14) * 1.3; P.legs[2][4] += Math.sin(t * 14 + 1.5) * 1.3; P.tl[2] += Math.sin(t * 12) * 0.3; }
      } else { const br = Math.sin(t * 2.2); P.b[3] += br * 0.25; P.ch[1] += br * 0.25; }
      if (kind === 'walk') { R.gait(P, t * 7, 3.4, 2.6, R.WALK_PH); if (Math.sin(t * 14) > 0.3) { for (const k of ['b', 'th', 'ne', 'ch', 'hd', 'tl']) P[k][1] -= 1; } P.tl[2] += Math.sin(t * 8) * 0.2; }
      if (kind === 'run') { R.gait(P, t * 13, 6, 4, R.RUN_PH); P.b[4] = Math.sin(t * 13 + 0.6) * 0.08; P.ears = [-2.5, 2, -2, 2]; P.mouth = 'pant'; P.tl[4] = 0.6; P.tl[2] += Math.sin(t * 26) * 0.15; }
      if (o.wag) P.tl[2] += Math.sin(t * (o.wagF || 17)) * o.wag;
      if (o.eye) P.eye = o.eye; if (o.mouth) P.mouth = o.mouth; if (o.headDy) { P.hd[1] += o.headDy; P.ne[1] += o.headDy * 0.4; }
      return P;
    }
    const head = P => [P.hd[0], P.hd[1]];
    function sprite(P) { L.b.fill(0); R.drawDog(L, P, V); R.outline(L, T); for (let i = 0; i < L.b.length; i++) px[i] = pal[L.b[i]]; x.putImageData(im, 0, 0); return cv; }
    // draw with the paws on (gx, gy); `scale` px per dog pixel; face 1 = right, -1 = left
    function draw(c, gx, gy, scale, kind, t, o = {}) {
      const P = pose(kind, t, o), s = sprite(P), f = o.face || 1; c.save(); c.imageSmoothingEnabled = false;
      c.fillStyle = 'rgba(43,36,32,0.16)'; c.beginPath(); c.ellipse(gx - f * 2 * scale, gy + scale * 0.5, scale * 17, scale * 1.3, 0, 0, 7); c.fill();
      if (kind === 'sleep') { const r = Math.min(3.2, 0.6 + t * 0.12); if (r > 0.6) { c.fillStyle = 'rgba(207,234,255,0.92)'; c.beginPath(); c.ellipse(gx + f * (P.hd[0] + 8.5) * scale, gy + 0.6 * scale, r * scale, 0.7 * scale, 0, 0, 7); c.fill(); } }   // drool puddle
      c.translate(Math.round(gx), Math.round(gy)); c.scale((o.face || 1) * scale, scale); c.drawImage(s, -R.X0, -R.G); c.restore();
    }
    // the sleeping "z"s exactly as the site spawns them: every 1.6 s from the head, drifting up, small glyph then big, blinking out
    function zzz(c, gx, gy, scale, t, col = '#9a7a63', a = 1, face = 1) {
      const P = pose('sleep', t), hx = gx + face * (P.hd[0] + 4) * scale, hy = gy + (P.hd[1] - 9) * scale;
      for (let k = Math.floor((t - 2.8) / 1.6); k <= Math.floor(t / 1.6); k++) {
        const life = t - k * 1.6; if (life < 0 || life > 2.8) continue; if (life > 2.8 * 0.72 && Math.floor(life * 18) % 2 === 0) continue;
        const g = life < 1.1 ? ZS : ZB, ph = hash(k) * 6, x = hx + face * 3.5 * life * scale + Math.sin(life * 2.5 + ph) * 1.5 * scale, y = hy - 5 * life * scale;
        c.save(); c.globalAlpha *= a; c.fillStyle = col; g.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === 'X') c.fillRect(Math.round(x + i * scale), Math.round(y + j * scale), Math.ceil(scale), Math.ceil(scale)); }); c.restore();
      }
    }
    return { draw, zzz, R };
  }

  // ---- koi pond footage (homepage js/pond.js, recorded by shared/tools/pondclip.js); decoded to bitmaps once
  async function loadClip(url, n = 150, fps = 30) {
    const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = url;
    await new Promise((r, j) => { v.onloadeddata = r; v.onerror = () => j(new Error('clip ' + url)); });
    const out = [], N = Math.min(n, Math.floor(v.duration * fps));
    for (let i = 0; i < N; i++) { v.currentTime = (i + 0.5) / fps; await new Promise(r => { v.onseeked = r; }); out.push(await createImageBitmap(v)); }
    return out;
  }
  // nearest-neighbour "cover" of a pixel clip into a rect, with a zoom and a focus point (0..1)
  function cover(c, im, X, Y, w, h, zoom = 1, fx = 0.5, fy = 0.5) {
    const iw = im.width, ih = im.height, s = Math.max(w / iw, h / ih) * zoom, dw = iw * s, dh = ih * s;
    c.save(); c.beginPath(); c.rect(X, Y, w, h); c.clip(); c.imageSmoothingEnabled = false;
    c.drawImage(im, X + (w - dw) * fx, Y + (h - dh) * fy, dw, dh); c.restore();
  }
  // ---- <pixel-scene> vignettes (64x64, 90-frame strips recorded by shared/tools/scenes.js)
  async function loadScenes(base, names) { const o = {}; for (const n of names) o[n] = await img(`${base}/${n}.png`); return o; }
  function scene(c, sheet, f, cx, cy, size, fps = 30) {
    const k = Math.floor(Math.max(0, f) / (60 / fps)) % 90; c.save(); c.imageSmoothingEnabled = false;
    c.drawImage(sheet, k * 64, 0, 64, 64, Math.round(cx - size / 2), Math.round(cy - size / 2), size, size); c.restore();
  }

  // ---- motion forms (the essays' line-art covers): each SVG is sampled into polylines once, then drawn on
  function loadForms() {
    const all = window.ALL_MOTION_FORMS || [], host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-9999px;top:0;width:452px;height:452px;color:#000';
    document.body.appendChild(host); const forms = [];
    for (const svg of all) {
      host.innerHTML = svg; const root = host.querySelector('svg'); root.setAttribute('width', 452); root.setAttribute('height', 452);
      const els = [...root.querySelectorAll('path,circle,ellipse,line,polyline,polygon,rect')], lines = [];
      for (const el of els) {
        const cs = getComputedStyle(el); let a = 1; for (let p = el; p && p !== root; p = p.parentElement) a *= +(getComputedStyle(p).opacity || 1);
        const len = el.getTotalLength ? el.getTotalLength() : 0; if (!len) continue;
        const m = el.getCTM(), n = Math.max(8, Math.min(1400, Math.ceil(len / 1.5))), pts = new Float32Array(n * 2 + 2);
        for (let i = 0; i <= n; i++) { const q = el.getPointAtLength(len * i / n), x = m.a * q.x + m.c * q.y + m.e, y = m.b * q.x + m.d * q.y + m.f; pts[i * 2] = x - 226; pts[i * 2 + 1] = y - 226; }
        const dash = cs.strokeDasharray && cs.strokeDasharray !== 'none' ? cs.strokeDasharray.split(/[ ,]+/).map(parseFloat).filter(v => v >= 0) : null;
        const fill = cs.fill && cs.fill !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(cs.fill), stroke = cs.stroke && cs.stroke !== 'none';
        lines.push({ pts, n, len, w: parseFloat(cs.strokeWidth) || 1, a: a * (+cs.strokeOpacity || 1), fa: a * (+cs.fillOpacity || 1), dash, fill, stroke, cls: (el.closest('[class]') || el).getAttribute('class') || '' });
      }
      forms.push(lines);
    }
    host.remove(); return forms;
  }
  // draw form `F` centred at cx,cy at `size` px; p = 0..1 draw-on progress (staggered per element); spin for orbit groups
  // only: 'guide' (the faint construction lines) | 'main' (the drawing itself) | undefined (both)
  function form(c, F, cx, cy, size, p = 1, col = '#18181b', spin = 0, wk = 1, only) {
    const s = size / 452; c.save(); c.translate(cx, cy); c.scale(s, s); c.lineCap = 'round'; c.lineJoin = 'round';
    F.forEach((L, i) => {
      if (only && (only === 'guide') !== (L.a < 0.5)) return;
      const u = clamp(p * (F.length * 0.5 + 1) - i * 0.5); if (u <= 0) return; const ga = c.globalAlpha;
      c.save(); if (/orbit/.test(L.cls)) c.rotate(spin * (/slow/.test(L.cls) ? 0.5 : 1));
      const k = Math.max(1, Math.round(L.n * u)); c.beginPath(); c.moveTo(L.pts[0], L.pts[1]); for (let j = 1; j <= k; j++) c.lineTo(L.pts[j * 2], L.pts[j * 2 + 1]);
      if (L.fill && u >= 1) { c.fillStyle = col; c.globalAlpha = ga * L.fa; c.fill(); }
      if (L.stroke) { c.strokeStyle = col; c.globalAlpha = ga * L.a; c.lineWidth = L.w * wk / Math.min(1, s * 1.2); if (L.dash) c.setLineDash(L.dash); c.stroke(); }
      c.restore(); c.globalAlpha = ga;
    });
    c.restore();
  }

  // ---- motion blur: frames inside FAST ranges are averaged from n sub-frame samples
  function blurFrame(cv, draw, FAST, n = 10) {
    const x = cv.getContext('2d'), acc = document.createElement('canvas'); acc.width = cv.width; acc.height = cv.height; const ax = acc.getContext('2d');
    return f => {
      const r = FAST.find(([a, b]) => f >= a && f <= b); if (!r) { draw(x, f); return; }
      const k = r[2] || n; ax.clearRect(0, 0, acc.width, acc.height);
      for (let i = 0; i < k; i++) { draw(x, f - 0.5 + (i + 0.5) / k); ax.globalAlpha = 1 / (i + 1); ax.drawImage(cv, 0, 0); }
      ax.globalAlpha = 1; x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.filter = 'none'; x.drawImage(acc, 0, 0);
    };
  }
  return { E, bez, clamp, prog, mix, hash, img, font, fonts, typed, rise, wordsIn, parseEyes, eyeTrack, drawEyes, portrait, loadPortrait, dogKit, loadClip, cover, loadScenes, scene, loadForms, form, blurFrame };
})();
