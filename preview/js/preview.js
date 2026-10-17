(() => {
'use strict';
const STAGES = [
  { id: 'baby', label: 'Baby' }, { id: 'kid', label: 'Kid' }, { id: 'teen', label: 'Teen' },
  { id: 'young', label: 'Young' }, { id: 'curls', label: 'Curls' }, { id: 'now', label: 'Now' }];
const url = (id, kind) => `data/${id}${kind === 'graphite' ? '-graphite' : ''}.bin`;
const $ = s => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const visible = (el, fn, th = 0.25) => new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { o.disconnect(); fn(); } }, { threshold: th, rootMargin: '200px 0px' }).observe(el);

/* ---- hero: one canvas, each stage painted over the last ---- */
const hero = $('#heroCanvas'), chips = $('#heroChips'), status = $('#heroStatus'); let cur = 0, run = null, auto = !reduce, timer = 0, kind = 'paint';
STAGES.forEach((s, i) => { const b = document.createElement('button'); b.textContent = s.label; b.onclick = () => { auto = false; $('#heroAuto').textContent = 'autoplay: off'; go(i); }; chips.appendChild(b); });
async function go(i) {
  cur = i; clearTimeout(timer); run && run.stop();
  [...chips.children].forEach((b, k) => b.classList.toggle('on', k === i));
  status.textContent = 'painting…';
  const d = await Strokes.load(url(STAGES[i].id, kind));
  if (cur !== i) return;
  if (reduce) { Strokes.draw(hero, d); status.textContent = `${d.total.toLocaleString()} strokes`; return; }
  run = Strokes.play(hero, d, { duration: 5200, over: true, onDone: () => {
    status.textContent = `${d.total.toLocaleString()} strokes`;
    if (auto) timer = setTimeout(() => go((cur + 1) % STAGES.length), 2600);
  } });
  STAGES.forEach((s, k) => k > i && k < i + 2 && Strokes.load(url(s.id, kind)));
}
$('#heroAuto').onclick = e => { auto = !auto; e.target.textContent = 'autoplay: ' + (auto ? 'on' : 'off'); if (auto) go((cur + 1) % STAGES.length); };
$('#heroKind').onclick = e => { kind = kind === 'paint' ? 'graphite' : 'paint'; e.target.textContent = kind === 'paint' ? 'medium: oil' : 'medium: graphite'; hero.width = 1; go(cur); };
visible(hero, () => go(0), 0.1);

/* ---- static galleries ---- */
function gallery(el, k) {
  for (const s of STAGES) {
    const fig = document.createElement('figure'); fig.className = 'card'; const cv = document.createElement('canvas'); cv.width = 520; cv.height = 650;
    fig.innerHTML = `<figcaption><b>${s.label}</b><span>${k === 'graphite' ? 'graphite' : 'oil'}</span></figcaption>`; fig.prepend(cv); el.appendChild(fig);
    visible(fig, () => Strokes.load(url(s.id, k)).then(d => { Strokes.draw(cv, d, 1.5); fig.classList.add('ready'); fig.querySelector('span').textContent = `${d.total.toLocaleString()} strokes`; }));
    fig.onclick = () => openBig(s, k);
  }
}
gallery($('#paintings'), 'paint'); gallery($('#graphite'), 'graphite');

/* ---- animated: each one paints itself, loops ---- */
for (const s of STAGES) for (const k of ['paint', 'graphite']) {
  const fig = document.createElement('figure'); fig.className = 'card live'; const cv = document.createElement('canvas'); cv.width = 520; cv.height = 650;
  fig.innerHTML = `<figcaption><b>${s.label}</b><span>${k === 'graphite' ? 'graphite' : 'oil'} · time-lapse</span></figcaption>`; fig.prepend(cv);
  (k === 'paint' ? $('#livePaint') : $('#liveGraphite')).appendChild(fig);
  let r; const loop = d => { r = Strokes.play(cv, d, { duration: 7000 + Math.random() * 2000, scale: 1.5, onDone: () => setTimeout(() => loop(d), 3500) }); };
  visible(fig, () => Strokes.load(url(s.id, k)).then(d => (reduce ? Strokes.draw(cv, d, 1.5) : loop(d))));
}

/* ---- lightbox ---- */
const lb = $('#lightbox'), lbc = $('#lbCanvas');
async function openBig(s, k) {
  lb.hidden = false; $('#lbTitle').textContent = `${s.label} · ${k === 'graphite' ? 'graphite' : 'oil'}`;
  const d = await Strokes.load(url(s.id, k)); Strokes.draw(lbc, d, 2.5);
  $('#lbSave').onclick = () => { const a = document.createElement('a'); a.download = `nikit-${s.id}-${k}.png`; a.href = lbc.toDataURL('image/png'); a.click(); };
  $('#lbReplay').onclick = () => Strokes.play(lbc, d, { duration: 6000, scale: 2.5 });
}
lb.onclick = e => { if (e.target === lb || e.target.id === 'lbClose') lb.hidden = true; };
addEventListener('keydown', e => { if (e.key === 'Escape') lb.hidden = true; });
})();
