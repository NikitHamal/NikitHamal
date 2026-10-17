/*!
 * Mini-me: the site mascot (assets/avatar-upright.svg) given a full body, and a life.
 * The head, hair, cheeks and eye shapes are taken from the mascot SVG at runtime; the body
 * (tee, arms, jeans, sneakers) is drawn here in the same flat style. Everything is animated
 * procedurally on one rAF loop that only runs while the stage is on screen.
 *
 * Moves: idle breathing + hair sway, blinking, eyes and head follow the pointer, walks to where
 * you point, wave on arrival, hop when tapped (hearts), pick him up and drop him, dance, and
 * idle states — looks around → stretches & yawns → sits → falls asleep (Zzz) → wakes up startled.
 */
(() => {
'use strict';
const stage = document.getElementById('mascotStage');
if (!stage) return;
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const ease = t => t * t * (3 - 2 * t);

// ---- palette (matches the mascot)
const C = { shirt: '#8e4585', shirtDark: '#763a6f', skin: '#edbba4', skinDark: '#d49b7c', jeans: '#2f4566', jeansDark: '#24364f', shoe: '#f5f2ee', sole: '#c9c2bb', lace: '#d6cfc8', hair: '#1b1b1b' };
const FOOT_Y = 2880; // mascot units; the head art spans 0..1600

async function build() {
  const src = await fetch('/assets/avatar-upright.svg').then(r => r.text());
  const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
  const svg = el('svg', { class: 'mascot-svg', role: 'img', 'aria-label': 'Animated mascot of Nikit. Point to walk him, tap to make him hop, drag to pick him up.' }, stage);
  const defs = el('defs', {}, svg); defs.innerHTML = doc.querySelector('defs').innerHTML.replace(/neutral-navy-/g, 'mm-');
  const take = id => { const n = doc.getElementById('neutral-navy-' + id); const c = document.importNode(n, true); c.removeAttribute('id'); c.querySelectorAll('[id]').forEach(x => x.setAttribute('id', 'mm-' + x.id.replace('neutral-navy-', ''))); return c; };
  const fixUrls = n => { n.querySelectorAll('*').forEach(x => { for (const a of ['fill', 'stroke']) { const v = x.getAttribute(a); if (v && v.includes('neutral-navy-')) x.setAttribute(a, v.replace(/neutral-navy-/g, 'mm-')); } }); const v = n.getAttribute && n.getAttribute('fill'); if (v && v.includes('neutral-navy-')) n.setAttribute('fill', v.replace(/neutral-navy-/g, 'mm-')); return n; };

  const shadow = el('ellipse', { class: 'm-shadow', rx: 300, ry: 46, fill: '#3b2a24', opacity: 0.16 });
  const fx = el('g', { class: 'm-fx' });
  const root = el('g', { class: 'm-root' }); svg.append(shadow, root, fx);
  const body = el('g', {}, root);                      // squash & stretch around the feet
  const lean = el('g', {}, body);                      // whole-body lean / sway

  // back hair follows the head
  const backHair = el('g', {}, lean); backHair.appendChild(fixUrls(take('back-hair-upright')));
  const hairSway = backHair;

  // legs (hip pivots) — thigh+shin as one jean leg, sneaker at the end; a knee lets him sit
  const leg = side => {
    const hip = el('g', {}, lean), thigh = el('g', {}, hip), shin = el('g', {}, thigh);
    el('path', { d: 'M0 0 L0 300', stroke: C.jeans, 'stroke-width': 200, 'stroke-linecap': 'round' }, thigh);
    el('path', { d: `M${side * -40} 30 L${side * -40} 260`, stroke: C.jeansDark, 'stroke-width': 26, 'stroke-linecap': 'round', opacity: 0.5 }, thigh);
    el('path', { d: 'M0 300 L0 600', stroke: C.jeans, 'stroke-width': 190, 'stroke-linecap': 'round' }, shin);
    el('path', { d: `M${side * 70} 560 L${side * 70} 640`, stroke: C.jeansDark, 'stroke-width': 30, 'stroke-linecap': 'round', opacity: 0.4 }, shin);
    const shoe = el('g', {}, shin);
    el('path', { d: `M${-110 + side * 20} 640 Q${-120 + side * 20} 560 ${-20 + side * 20} 575 L${60 + side * 30} 590 Q${150 + side * 40} 600 ${150 + side * 40} 660 L${150 + side * 40} 690 L${-110 + side * 20} 690 Z`, fill: C.shoe }, shoe);
    el('path', { d: `M${-112 + side * 20} 690 L${150 + side * 40} 690`, stroke: C.sole, 'stroke-width': 26, 'stroke-linecap': 'round' }, shoe);
    el('path', { d: `M${-30 + side * 20} 600 L${30 + side * 25} 610 M${-34 + side * 20} 625 L${32 + side * 25} 636`, stroke: C.lace, 'stroke-width': 12, 'stroke-linecap': 'round' }, shoe);
    return { hip, thigh, shin, x: 800 + side * 125, y: 2150 };
  };
  const legL = leg(-1), legR = leg(1);

  // torso: the mascot's shirt (narrowed) + the rest of the tee
  const torso = el('g', {}, lean);
  el('path', { d: 'M470 1540 Q462 1900 486 2190 Q800 2240 1114 2190 Q1138 1900 1130 1540 Z', fill: C.shirt }, torso);
  const shirt = fixUrls(take('shirt')); shirt.removeAttribute('style'); shirt.setAttribute('fill', C.shirt); shirt.setAttribute('transform', 'translate(800 0) scale(0.6 1) translate(-800 0)'); torso.appendChild(shirt);
  el('path', { d: 'M486 2150 Q800 2200 1114 2150', stroke: C.shirtDark, 'stroke-width': 18, fill: 'none', opacity: 0.6, 'stroke-linecap': 'round' }, torso);
  el('path', { d: 'M560 1700 Q600 1950 590 2120 M1040 1700 Q1000 1950 1010 2120', stroke: C.shirtDark, 'stroke-width': 14, fill: 'none', opacity: 0.35, 'stroke-linecap': 'round' }, torso);

  // arms: shoulder → elbow → hand; sleeve over the upper arm
  const arm = side => {
    const sh = el('g', {}, lean), fore = el('g', {});
    el('path', { d: 'M0 40 L0 330', stroke: C.skin, 'stroke-width': 118, 'stroke-linecap': 'round' }, sh);
    sh.appendChild(fore);
    el('path', { d: 'M0 0 L0 300', stroke: C.skin, 'stroke-width': 112, 'stroke-linecap': 'round' }, fore);
    el('path', { d: `M${side * -38} 120 L${side * -38} 260`, stroke: C.skinDark, 'stroke-width': 18, 'stroke-linecap': 'round', opacity: 0.35 }, fore);
    el('circle', { cx: 0, cy: 330, r: 78, fill: C.skin }, fore);
    el('path', { d: `M${side * 30} 300 Q${side * 70} 330 ${side * 44} 372`, stroke: C.skinDark, 'stroke-width': 14, fill: 'none', 'stroke-linecap': 'round', opacity: 0.5 }, fore);
    el('path', { d: `M${-100} -40 Q0 -90 100 -40 L118 190 Q0 230 -118 190 Z`, fill: C.shirt }, sh);
    el('path', { d: 'M-116 186 Q0 226 116 186', stroke: C.shirtDark, 'stroke-width': 16, fill: 'none', opacity: 0.6, 'stroke-linecap': 'round' }, sh);
    return { sh, fore, x: 800 + side * 345, y: 1440 };
  };
  const armL = arm(-1), armR = arm(1);

  // head: neck, face, cheeks, eyes, front hair — straight from the mascot
  const head = el('g', {}, lean); head.appendChild(fixUrls(take('upright-head')));
  const eyeShapes = side => ({
    track: head.querySelector(`#mm-${side}-eye-tracker`),
    blink: head.querySelector(`#mm-${side}-eye-blink`),
    open: head.querySelector(`#mm-${side}-eye-open`), happy: head.querySelector(`#mm-${side}-eye-happy`), closed: head.querySelector(`#mm-${side}-eye-closed`) });
  const eyes = [eyeShapes('left'), eyeShapes('right')];
  const cheeks = [head.querySelector('#mm-left-cheek'), head.querySelector('#mm-right-cheek')];
  lean.append(armL.sh, armR.sh);   // arms in front of the head, so a wave or a dance stays visible

  return { svg, shadow, fx, root, body, lean, hairSway, legL, legR, torso, armL, armR, head, eyes, cheeks };
}

build().then(M => {
  // ---------- state
  const S = {
    x: 0, vx: 0, target: null, face: 0, t: 0, k: 0.17, W: 600, H: 560, ground: 520,
    y: 0, vy: 0, squash: 0, mode: 'idle', modeT: 0, lastInput: performance.now(),
    gaze: { x: 0, y: 0 }, gazeT: { x: 0, y: 0 }, pointer: null, blinkT: 2, blinkDur: 0, eyeMode: 'open',
    hover: false, drag: null, wave: 0, dance: 0, sleepZ: 0, particles: [],
  };
  function layout() {
    const r = stage.getBoundingClientRect(); S.W = r.width; S.H = r.height;
    S.k = clamp((S.H - 40) / 2950, 0.1, 0.22); S.ground = S.H - 26;
    M.svg.setAttribute('viewBox', `0 0 ${S.W} ${S.H}`); if (!S.x) S.x = S.W * 0.5;
  }
  layout(); addEventListener('resize', layout);

  // ---------- input
  const local = e => { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onMascot = p => Math.abs(p.x - S.x) < 360 * S.k && p.y > S.ground - 2950 * S.k + S.y && p.y < S.ground + 20;
  const wake = () => {
    const was = S.mode; S.lastInput = performance.now();
    if (was === 'sleep' || was === 'sit') { setMode('startle'); }
    else if (was === 'yawn' || was === 'lookaround') setMode('idle');
  };
  stage.addEventListener('pointermove', e => {
    const p = local(e); S.pointer = p; wake(); S.hover = onMascot(p);
    if (S.drag) { S.drag.x = p.x; S.drag.y = p.y; }
  });
  stage.addEventListener('pointerleave', () => { S.pointer = null; S.hover = false; });
  stage.addEventListener('pointerdown', e => {
    const p = local(e); wake(); stage.setPointerCapture(e.pointerId);
    if (onMascot(p)) { S.drag = { x: p.x, y: p.y, x0: p.x, y0: p.y, moved: false, t: performance.now() }; }
    else { S.target = p.x; setMode('walk'); }
  });
  stage.addEventListener('pointerup', e => {
    if (!S.drag) return; const d = S.drag; S.drag = null;
    if (!d.moved) { hop(); return; }
    S.vy = 0; setMode('fall');
  });
  addEventListener('pointermove', e => { if (!S.pointer) { const r = stage.getBoundingClientRect(); if (e.clientY > r.top - 300 && e.clientY < r.bottom + 300) { S.far = { x: e.clientX - r.left, y: e.clientY - r.top }; } } }, { passive: true });
  document.querySelectorAll('[data-mascot]').forEach(b => b.addEventListener('click', () => { S.lastInput = performance.now(); const a = b.dataset.mascot; if (a === 'hop') hop(); else setMode(a); }));

  function setMode(m) { S.mode = m; S.modeT = 0; if (m === 'wave') S.wave = 0; if (m === 'dance') S.dance = 0; }
  function hop() { if (S.mode === 'fall' || S.mode === 'crouch' || S.y < -5) return; setMode('crouch'); }
  function launch() { S.vy = -1100; S.squash = -0.16; setMode('hop'); for (let i = 0; i < 4; i++) spawn('heart', S.x + (Math.random() - 0.5) * 160 * S.k * 4, S.ground - 2700 * S.k); }
  function dust(n, spread) { for (let i = 0; i < n; i++) S.particles.push({ kind: 'dust', x: S.x + (Math.random() - 0.5) * spread, y: S.ground - 4, vx: (Math.random() - 0.5) * 90, vy: -10 - Math.random() * 25, life: 0, max: 0.55 + Math.random() * 0.3, r: 4 + Math.random() * 5 }); }
  function spawn(kind, x, y) { S.particles.push({ kind, x, y, vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 40, life: 0, max: kind === 'z' ? 2.6 : 1.6, rot: (Math.random() - 0.5) * 40 }); }

  // ---------- eyes
  function setEyes(mode) {
    if (mode === S.eyeMode) return; S.eyeMode = mode;
    for (const e of M.eyes) { e.open.setAttribute('display', mode === 'open' ? 'inline' : 'none'); e.happy.setAttribute('display', mode === 'happy' ? 'inline' : 'none'); e.closed.setAttribute('display', mode === 'closed' ? 'inline' : 'none'); }
  }

  // ---------- tiny transform helpers
  const tf = (g, s) => g.setAttribute('transform', s);
  const rot = (g, a, x, y) => tf(g, `rotate(${a.toFixed(2)} ${x} ${y})`);

  // ---------- main loop (runs only while visible)
  let visible = false, last = performance.now();
  new IntersectionObserver(e => { visible = e[0].isIntersecting; if (visible) { last = performance.now(); requestAnimationFrame(loop); } }, { threshold: 0.05 }).observe(stage);
  function loop(now) {
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; S.t += dt; S.modeT += dt; S.dt = dt;
    update(dt, now); draw();
    requestAnimationFrame(loop);
  }

  function update(dt, now) {
    const idleFor = (now - S.lastInput) / 1000;
    // idle ladder
    if (S.mode === 'idle') {
      if (idleFor > 6 && idleFor < 6 + dt * 2) setMode('lookaround');
      else if (idleFor > 14 && S.modeT > 3) setMode('yawn');
    }
    if (S.mode === 'lookaround' && S.modeT > 4) setMode('idle');
    if (S.mode === 'yawn' && S.modeT > 3.2) setMode(idleFor > 20 ? 'sit' : 'idle');
    if (S.mode === 'sit' && S.modeT > 4) setMode('sleep');
    if (S.mode === 'startle' && S.modeT > 0.9) setMode('wave');
    if (S.mode === 'wave' && S.modeT > 2.2) setMode('idle');
    if (S.mode === 'crouch' && S.modeT > 0.16) launch();
    if (S.mode === 'hop' && S.y >= 0 && S.vy >= 0 && S.modeT > 0.2) setMode('land');
    if (S.mode === 'land' && S.modeT > 0.35) setMode('idle');
    if (S.mode === 'dance' && S.modeT > 6) setMode('idle');

    // walking toward the target
    if (S.mode === 'walk' && S.target != null) {
      const dx = S.target - S.x, sp = 520 * S.k * 4.2;
      if (Math.abs(dx) < 6) { S.target = null; setMode('wave'); }
      else { S.face = Math.sign(dx); S.x += clamp(dx, -sp * dt, sp * dt); const ph = Math.floor(S.t * 9 / Math.PI); if (ph !== S.step) { S.step = ph; dust(2, 120 * S.k); } }
    }
    S.x = clamp(S.x, 320 * S.k, S.W - 320 * S.k);

    // gravity: hop, fall after a drag
    if (S.drag) { S.drag.moved = S.drag.moved || Math.hypot(S.drag.x - S.drag.x0, S.drag.y - S.drag.y0) > 6; if (S.drag.moved) { S.mode = 'held'; S.x = S.drag.x; S.y = Math.min(0, S.drag.y - S.drag.y0); } }
    else if (S.y < 0 || S.vy < 0) {
      S.vy += 4200 * dt * (S.k / 0.17); S.y += S.vy * dt * (S.k / 0.17);
      if (S.y >= 0) { S.y = 0; S.squash = clamp(S.vy / 9000, 0.08, 0.24); dust(8, 260 * S.k); S.vy = 0; if (S.mode === 'fall') setMode('startle'); }
    }
    S.squash *= Math.pow(0.0008, dt);

    // gaze target: pointer (or far pointer), wandering when looking around, down when sleepy
    let gx = 0, gy = 0;
    const p = S.pointer || S.far;
    if (p && S.mode !== 'lookaround') { const hx = S.x, hy = S.ground - 2150 * S.k + S.y; const dx = p.x - hx, dy = p.y - hy, m = Math.hypot(dx, dy) || 1; gx = dx / m * Math.min(1, m / 300); gy = dy / m * Math.min(1, m / 300); }
    if (S.mode === 'lookaround') { gx = Math.sin(S.modeT * 1.6) * 0.95; gy = Math.sin(S.modeT * 0.7) * 0.25; }
    if (S.mode === 'walk') gx = S.face * 0.8;
    S.gazeT.x = gx; S.gazeT.y = gy;
    S.gaze.x = lerp(S.gaze.x, S.gazeT.x, 1 - Math.pow(0.002, dt)); S.gaze.y = lerp(S.gaze.y, S.gazeT.y, 1 - Math.pow(0.002, dt));

    // blink
    S.blinkT -= dt; if (S.blinkT <= 0) { S.blinkDur = 0.13; S.blinkT = 2 + Math.random() * 4; if (Math.random() < 0.2) S.blinkT = 0.25; }
    S.blinkDur -= dt;
    let em = 'open';
    if (S.mode === 'sleep' || (S.mode === 'yawn' && S.modeT > 0.6 && S.modeT < 2.4) || (S.mode === 'sit' && S.modeT > 2.5)) em = 'closed';
    else if (S.hover || S.mode === 'hop' || S.mode === 'land' || S.mode === 'dance' || S.mode === 'wave' || S.mode === 'held') em = 'happy';
    else if (S.blinkDur > 0) em = 'closed';
    setEyes(em);

    // particles
    if (S.mode === 'sleep') { S.sleepZ -= dt; if (S.sleepZ <= 0) { S.sleepZ = 1.1; spawn('z', S.x + 230 * S.k, S.ground - 2300 * S.k); } }
    if (S.mode === 'dance' && Math.random() < dt * 2.2) spawn('note', S.x + (Math.random() - 0.5) * 900 * S.k, S.ground - 2500 * S.k);
    for (const q of S.particles) { q.life += dt; q.x += q.vx * dt + (q.kind === 'z' ? Math.sin(q.life * 3) * 14 * dt : 0); q.y += q.vy * dt; }
    S.particles = S.particles.filter(q => q.life < q.max);
  }

  function draw() {
    const t = S.t, k = S.k, m = S.mode, mt = S.modeT;
    // pose parameters (degrees, mascot units)
    let breath = Math.sin(t * 2.2), headRot = S.gaze.x * 7 + Math.sin(t * 1.1) * 1.2, headDy = breath * 6, leanA = 0, bodyDy = 0;
    let aL = 9 + Math.sin(t * 2.2) * 2, aR = -9 - Math.sin(t * 2.2 + 0.4) * 2, fL = 6, fR = -6;
    let lL = 0, lR = 0, kL = 0, kR = 0, hairA = Math.sin(t * 1.7) * 1.4 - S.gaze.x * 2;
    if (m === 'walk') {
      const ph = t * 9; lL = Math.sin(ph) * 22; lR = -lL; kL = Math.max(0, -Math.sin(ph)) * 30; kR = Math.max(0, Math.sin(ph)) * 30;
      aL = 9 - Math.sin(ph) * 20; aR = -9 - Math.sin(ph) * 20; fL = 14; fR = -14; bodyDy = -Math.abs(Math.cos(ph)) * 30; leanA = S.face * 3; hairA += -S.face * 5;
    }
    if (m === 'wave' || m === 'startle') {
      const w = ease(clamp(mt / 0.35, 0, 1)); aR = lerp(aR, -140, w); fR = lerp(fR, 25 + Math.sin(mt * 14) * 28, w); headRot += 4;
      if (m === 'startle') { bodyDy = -Math.sin(clamp(mt / 0.5, 0, 1) * Math.PI) * 120; aL = lerp(aL, 60, w); }
    }
    if (m === 'yawn') {
      const u = Math.sin(clamp(mt / 3.2, 0, 1) * Math.PI); aL = lerp(aL, 160, u); aR = lerp(aR, -160, u); fL = lerp(fL, -14, u); fR = lerp(fR, 14, u); headRot = lerp(headRot, -6, u); bodyDy = -u * 40;
    }
    if (m === 'sit' || m === 'sleep') {
      const u = ease(clamp((m === 'sleep' ? 1 : mt / 1.2), 0, 1));
      lL = lerp(lL, 84, u); lR = lerp(lR, -84, u); kL = lerp(kL, -142, u); kR = lerp(kR, 142, u); bodyDy = u * 600;   // cross-legged
      aL = lerp(aL, 22, u); aR = lerp(aR, -22, u); fL = lerp(fL, -30, u); fR = lerp(fR, 30, u);
      if (m === 'sleep') { headRot = 16 + Math.sin(t * 1.3) * 2; headDy = 30 + Math.sin(t * 1.3) * 14; breath = Math.sin(t * 1.3) * 1.6; }
    }
    if (m === 'dance') {
      const b = t * 7.5; bodyDy = -Math.abs(Math.sin(b)) * 70; leanA = Math.sin(b) * 7; headRot = -Math.sin(b) * 10;
      aL = 140 + Math.sin(b) * 25; aR = -140 + Math.sin(b + Math.PI) * 25; fL = -25 - Math.sin(b * 2) * 25; fR = 25 + Math.sin(b * 2) * 25;
      lL = Math.sin(b) * 14; lR = Math.sin(b) * 14; kL = Math.max(0, Math.sin(b)) * 25; kR = Math.max(0, -Math.sin(b)) * 25; hairA += Math.sin(b) * 6;
    }
    if (m === 'held') {
      const sw = Math.sin(t * 6) * 10; lL = sw + 6; lR = sw - 6; kL = 10; kR = -10; aL = 140; aR = -140; fL = -10; fR = 10; headRot = sw * 0.5;
    }
    if (m === 'hop') { aL = 70; aR = -70; fL = -20; fR = 20; kL = 30; kR = -30; lL = -10; lR = 10; }
    if (m === 'lookaround') headRot = S.gaze.x * 10;

    if (m === 'crouch') { const u = ease(clamp(mt / 0.16, 0, 1)); bodyDy = u * 160; kL = u * 40; kR = -u * 40; lL = -u * 18; lR = u * 18; aL = 30; aR = -30; headRot -= 3; }
    if (m === 'land') { const u = 1 - clamp(mt / 0.35, 0, 1); bodyDy = u * 110; kL = u * 30; kR = -u * 30; aL = 35 * u + 9; aR = -35 * u - 9; }
    if (m === 'idle') { const w = Math.sin(t * 0.55); leanA += w * 1.6; lL += w * 1.5; lR += w * 1.5; headRot -= w * 1.2; }   // slow weight shift
    // blend toward the target pose (critically damped) so every state change flows instead of snapping
    const target = { headRot, headDy, leanA, bodyDy, aL, aR, fL, fR, lL, lR, kL, kR };
    const P = S.pose || (S.pose = { ...target }), V = S.poseV || (S.poseV = {}), fast = m === 'walk' || m === 'dance' || m === 'crouch' || m === 'held' || m === 'wave' || m === 'startle';
    const w0 = fast ? 26 : 13, dtt = S.dt || 0.016;
    for (const key in target) {   // spring-damper per channel
      const v = V[key] || 0, x = P[key], a = w0 * w0 * (target[key] - x) - 2 * w0 * v;
      V[key] = v + a * dtt; P[key] = x + V[key] * dtt;
    }
    ({ headRot, headDy, leanA, bodyDy, aL, aR, fL, fR, lL, lR, kL, kR } = P);
    // hair follow-through: lags behind head turns and body movement
    const hv = (S.x - (S.px || S.x)) / Math.max(1e-3, dtt) / (S.k * 4000); S.px = S.x;
    const hs = S.hairS || (S.hairS = { x: 0, v: 0 }), drive = -(V.headRot || 0) * 0.05 - hv * 6 - (S.vy || 0) * 0.0015;
    hs.v += (drive - hs.x) * 60 * dtt - hs.v * 7 * dtt; hs.x += hs.v * dtt; hairA += clamp(hs.x, -9, 9);
    // whole figure
    const sq = S.squash, sx = 1 + sq * 0.6, sy = 1 - sq;
    tf(M.root, `translate(${S.x.toFixed(1)} ${(S.ground + S.y).toFixed(1)}) scale(${k}) translate(-800 ${-FOOT_Y})`);
    tf(M.body, `translate(800 ${FOOT_Y}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(-800 ${-FOOT_Y + bodyDy})`);
    rot(M.lean, leanA, 800, 2150);
    tf(M.torso, `translate(800 2190) scale(1 ${(1 + breath * 0.008).toFixed(4)}) translate(-800 -2190)`);
    // limbs
    const leg = (L, a, kn) => { tf(L.hip, `translate(${L.x} ${L.y})`); tf(L.thigh, `rotate(${a.toFixed(1)})`); tf(L.shin, `rotate(${kn.toFixed(1)} 0 300)`); };
    leg(M.legL, lL, kL); leg(M.legR, lR, kR);
    const arm = (A, a, f) => { tf(A.sh, `translate(${A.x} ${A.y + breath * 4}) rotate(${a.toFixed(1)})`); tf(A.fore, `translate(0 330) rotate(${f.toFixed(1)})`); };
    arm(M.armL, aL, fL); arm(M.armR, aR, fR);
    // head + hair
    const headT = `translate(0 ${headDy.toFixed(1)}) rotate(${headRot.toFixed(2)} 800 1330)`;
    tf(M.head, headT); tf(M.hairSway, `${headT} rotate(${hairA.toFixed(2)} 800 420)`);
    // eyes look around (eye frame ≈ upright in head space)
    const ex = S.gaze.x * 34, ey = S.gaze.y * 22 + (m === 'sleep' ? 8 : 0);
    for (const e of M.eyes) if (e.track) tf(e.track, `translate(${ex.toFixed(1)} ${ey.toFixed(1)})`);
    const blush = S.hover || m === 'dance' || m === 'held' ? 1.9 : 1;
    M.cheeks.forEach(c => c && (c.style.opacity = blush));
    // shadow shrinks as he leaves the ground
    const lift = clamp(-S.y / (900 * k), 0, 1);
    M.shadow.setAttribute('cx', S.x.toFixed(1)); M.shadow.setAttribute('cy', (S.ground + 4).toFixed(1));
    M.shadow.setAttribute('rx', (300 * k * (1 - lift * 0.5) * (m === 'sit' || m === 'sleep' ? 1.25 : 1)).toFixed(1)); M.shadow.setAttribute('ry', (46 * k * (1 - lift * 0.5)).toFixed(1));
    M.shadow.setAttribute('opacity', (0.16 * (1 - lift * 0.6)).toFixed(3));
    // particles
    let html = '';
    for (const q of S.particles) {
      const a = Math.min(1, q.life * 4) * (1 - q.life / q.max), sz = q.kind === 'z' ? 16 + q.life * 10 : 20;
      if (q.kind === 'z') html += `<text x="${q.x.toFixed(1)}" y="${q.y.toFixed(1)}" font-size="${sz.toFixed(0)}" font-family="JetBrains Mono,monospace" font-weight="600" fill="#5b4a7a" opacity="${a.toFixed(2)}">z</text>`;
      else if (q.kind === 'heart') html += `<path transform="translate(${q.x.toFixed(1)} ${q.y.toFixed(1)}) rotate(${q.rot.toFixed(0)}) scale(${(sz / 20).toFixed(2)})" d="M0 6 C-12 -4 -6 -14 0 -7 C6 -14 12 -4 0 6Z" fill="#e0607e" opacity="${a.toFixed(2)}"/>`;
      else if (q.kind === 'dust') html += `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${(q.r * (1 + q.life * 2)).toFixed(1)}" fill="#cbb9a2" opacity="${(0.5 * (1 - q.life / q.max)).toFixed(2)}"/>`;
      else html += `<text x="${q.x.toFixed(1)}" y="${q.y.toFixed(1)}" font-size="22" fill="#8e4585" opacity="${a.toFixed(2)}">♪</text>`;
    }
    M.fx.innerHTML = html;
    stage.dataset.mode = m;
  }
  if (reduce) { draw(); }
  // say hi when he first comes into view
  setTimeout(() => S.mode === 'idle' && setMode('wave'), 900);
}).catch(e => console.warn('mascot failed', e));
})();
