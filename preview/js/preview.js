(() => {
'use strict';
const K = Portrait.keys, ST = Portrait.STAGES, $ = s => document.querySelector(s);
const card = (k, cls = '', inner = Portrait.svg(k)) => {
  const fig = document.createElement('figure'); fig.className = 'card ' + cls;
  fig.innerHTML = `<div class="art">${inner}</div><figcaption><b>${ST[k].label}</b><span>${ST[k].age}</span></figcaption>`;
  return fig;
};

/* ---------- 01 hero: crossfade through the stages ---------- */
const frame = $('#heroFrame'), range = $('#heroRange'), ticks = $('#heroTicks'), playBtn = $('#heroPlay');
const layers = K.map(k => { const d = document.createElement('div'); d.className = 'layer alive'; d.innerHTML = Portrait.svg(k); frame.appendChild(d); return d; });
K.forEach((k, i) => { const li = document.createElement('li'); li.textContent = ST[k].label; li.onclick = () => { stop(); setT(i); }; ticks.appendChild(li); });
function setT(t) {
  range.value = t;
  layers.forEach((l, i) => { const d = Math.abs(t - i), o = Math.max(0, 1 - d); l.style.opacity = o; l.style.transform = `scale(${1 + (i - t) * 0.04}) translateY(${(t - i) * 2}%)`; l.style.visibility = o > 0 ? 'visible' : 'hidden'; });
  [...ticks.children].forEach((li, i) => li.classList.toggle('on', Math.round(t) === i));
}
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, t0 = performance.now(), base = 0;
function stop() { playing = false; playBtn.textContent = 'play'; playBtn.setAttribute('aria-pressed', 'false'); }
playBtn.onclick = () => { if (playing) stop(); else { playing = true; base = +range.value; t0 = performance.now(); playBtn.textContent = 'pause'; playBtn.setAttribute('aria-pressed', 'true'); } };
range.oninput = () => { stop(); setT(+range.value); };
function heroLoop(now) {
  if (playing) { // hold on each stage, then glide to the next
    const e = (now - t0) / 1000, per = 2.6, n = K.length, c = (base + e / per) % n, i = Math.floor(c), fr = c - i, glide = Math.max(0, (fr - 0.6) / 0.4), s = glide * glide * (3 - 2 * glide);
    setT(i === n - 1 ? (s > 0 ? (n - 1) * (1 - s) : n - 1) : i + s);
  }
  requestAnimationFrame(heroLoop);
}
setT(0); requestAnimationFrame(heroLoop);

/* ---------- 02 stills ---------- */
K.forEach(k => $('#stills').appendChild(card(k)));

/* ---------- 03 alive ---------- */
const alive = [...layers];
K.forEach(k => {
  const c = card(k, 'alivec'); c.querySelector('.art').classList.add('alive'); $('#alive').appendChild(c); alive.push(c.querySelector('.art'));
  c.onclick = () => { const a = c.querySelector('.art'); a.classList.add('happy'); blink(a); setTimeout(() => a.classList.remove('happy'), 1400); };
});
function blink(el) { el.querySelectorAll('.p-lid').forEach(l => { l.style.transform = 'scaleY(1)'; setTimeout(() => (l.style.transform = 'scaleY(0)'), 130); }); }
alive.forEach(el => { const go = () => { blink(el); if (Math.random() < 0.2) setTimeout(() => blink(el), 260); setTimeout(go, 2200 + Math.random() * 3800); }; setTimeout(go, 500 + Math.random() * 3000); });
let px = innerWidth / 2, py = innerHeight / 3;
addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; look(); }, { passive: true });
function look() {
  for (const el of alive) {
    const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
    const sc = 360 / r.width, ex = r.left + r.width / 2, ey = r.top + r.height * 0.42;
    let dx = (px - ex) * sc, dy = (py - ey) * sc; const m = Math.hypot(dx, dy) || 1, k = Math.min(1, m / 400);
    dx = dx / m * 6 * k; dy = dy / m * 3.5 * k;
    el.querySelectorAll('.p-iris').forEach(i => (i.style.transform = `translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px)`));
    const h = el.querySelector('.p-head'); if (h) h.style.transform = `rotate(${(dx * 0.35).toFixed(2)}deg) translate(${(dx * 0.6).toFixed(2)}px,${(dy * 0.6).toFixed(2)}px)`;
  }
}
addEventListener('scroll', look, { passive: true }); look();

/* ---------- 04 line drawings ---------- */
K.forEach(k => {
  const c = card(k, 'lines'); const art = c.querySelector('.art'); art.classList.add('ink');
  art.querySelectorAll('path,circle,ellipse').forEach((p, i) => { p.setAttribute('pathLength', '1'); p.style.animationDelay = (i * 0.035).toFixed(3) + 's'; });
  $('#lines').appendChild(c);
  c.onclick = () => { art.classList.remove('go'); void art.offsetWidth; art.classList.add('go'); };
  new IntersectionObserver((en, o) => { if (en[0].isIntersecting) { art.classList.add('go'); o.disconnect(); } }, { threshold: 0.35 }).observe(c);
});

/* ---------- 05 pixel versions ---------- */
const PW = 60, PH = 77;
K.forEach(k => {
  const c = card(k, '', ''); const art = c.querySelector('.art'), cv = document.createElement('canvas'); cv.width = PW; cv.height = PH; art.appendChild(cv); $('#pixels').appendChild(c);
  const img = new Image();
  img.onload = () => {
    const big = document.createElement('canvas'); big.width = PW * 4; big.height = PH * 4; const b = big.getContext('2d'); b.drawImage(img, 0, 0, big.width, big.height);
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = true; x.drawImage(big, 0, 0, PW, PH);
    const d = x.getImageData(0, 0, PW, PH), a = d.data;
    // quantise each channel to a small ramp, harden alpha, then draw a 1px dark outline
    for (let i = 0; i < a.length; i += 4) { for (let j = 0; j < 3; j++) a[i + j] = Math.round(a[i + j] / 18) * 18; a[i + 3] = a[i + 3] > 110 ? 255 : 0; }
    const solid = (X, Y) => X >= 0 && Y >= 0 && X < PW && Y < PH && a[(Y * PW + X) * 4 + 3] > 0, out = [];
    for (let Y = 0; Y < PH; Y++) for (let X = 0; X < PW; X++) if (!solid(X, Y) && (solid(X - 1, Y) || solid(X + 1, Y) || solid(X, Y - 1) || solid(X, Y + 1))) out.push((Y * PW + X) * 4);
    for (const o of out) { a[o] = 42; a[o + 1] = 30; a[o + 2] = 26; a[o + 3] = 255; }
    x.putImageData(d, 0, 0);
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(Portrait.svg(k, { flat: true }).replace('<svg ', `<svg width="${PW * 4}" height="${PH * 4}" `));
});

/* ---------- 06 lineup: everyone grows taller ---------- */
const heights = [150, 190, 228, 252, 262];
K.forEach((k, i) => { const f = document.createElement('figure'); f.innerHTML = Portrait.svg(k).replace('<svg ', `<svg height="${heights[i]}" `) + `<span>${ST[k].label}</span>`; $('#lineup').appendChild(f); });
})();
