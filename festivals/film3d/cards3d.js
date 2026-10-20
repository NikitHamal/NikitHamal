// Dashain cards v2: 3D stills (the film's own models) with Nepali typography, laid out per platform size.
// cards3d.html?d=thali&w=1080&h=1350  ->  window.CARDS.render(name, W, H) returns the composed canvas.
import { THREE, E, clamp, mix, rng, hash, makeRenderer, skyDome, himalaya, hills, kite, stringLine, pagoda, kalash, thali, jamara, diyo, trishul, weapons, nepalSlab, town, lam, std, basic } from './lib3d.js';
const RED = '#e0283c', GOLD = '#f2c14e', CREAM = '#fff6e4', INK = '#120c0c';
const SIGN = '— निकित हमाल';
let R3 = null, NEPAL = null;
const out = document.getElementById('c'), cx = out.getContext('2d');
function lay(W, H) { const r = W / H; return { W, H, u: Math.min(W, H) / 1080, land: r > 1.25, tall: r < 0.66, sq: r >= 0.9 && r <= 1.25 }; }
function T(s, x, y, size, o = {}) { cx.save(); cx.font = `${o.weight || 700} ${size}px ${o.fam || 'Mukta'}`; cx.textAlign = o.align || 'center'; cx.textBaseline = 'alphabetic'; cx.fillStyle = o.col || CREAM;
  if (o.maxW) { const w = cx.measureText(s).width; if (w > o.maxW) { size *= o.maxW / w; cx.font = `${o.weight || 700} ${size}px ${o.fam || 'Mukta'}`; } }
  if (o.shadow !== false) { cx.shadowColor = 'rgba(0,0,0,0.45)'; cx.shadowBlur = size * 0.3; cx.shadowOffsetY = size * 0.04; } cx.globalAlpha = o.alpha ?? 1; cx.fillText(s, x, y); cx.restore(); return size; }
function wrap(s, maxW, size, weight = 500) { cx.save(); cx.font = `${weight} ${size}px Mukta`; const words = s.split(' '), lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (cx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); cx.restore(); return lines; }
function para(s, x, y, size, maxW, o = {}) { const ls = wrap(s, maxW, size, o.weight || 500); ls.forEach((l, i) => T(l, x, y + i * size * 1.35, size, { weight: o.weight || 500, align: o.align, col: o.col, alpha: o.alpha })); return y + ls.length * size * 1.35; }
function vignette(W, H, a = 0.55, top = 0.0) { const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(0,0,0,${top})`); g.addColorStop(0.45, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); cx.fillStyle = g; cx.fillRect(0, 0, W, H); }
function sideShade(W, H, a = 0.6) { const g = cx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, 'rgba(0,0,0,0)'); cx.fillStyle = g; cx.fillRect(0, 0, W, H); }
function rule(x, y, w, col = GOLD) { cx.save(); cx.fillStyle = col; cx.fillRect(x, y, w, 3); cx.beginPath(); cx.arc(x + w / 2, y + 1.5, 8, 0, 7); cx.fillStyle = RED; cx.fill(); cx.restore(); }
function shoot(scene, cam, W, H) { R3.r.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); R3.r.render(scene, cam); cx.drawImage(R3.cv, 0, 0, W, H); }
// fit a camera's distance so an object of half-width hw and half-height hh fills the frame
function fitDist(cam, hw, hh, W, H) { const vf = Math.tan(cam.fov * Math.PI / 360), hf = vf * W / H; return Math.max(hh / vf, hw / hf); }

const D = {};
// 1. THALI: the tika thali, close and warm; the full wish and a line of the blessing
D.thali = (W, H) => { const L = lay(W, H); const s = new THREE.Scene(); s.background = new THREE.Color(0x2a070c); s.environment = R3.env; s.add(new THREE.AmbientLight(0x4a1a12, 1)); const k = new THREE.DirectionalLight(0xfff0d8, 2.6); k.position.set(4, 9, 6); s.add(k); const r2 = new THREE.PointLight(0xff5a40, 30, 30); r2.position.set(-5, 3, -4); s.add(r2);
  const th = thali({ grains: 3200 }); s.add(th); th.userData.diyo.userData.update(0.4, 1); const cl = new THREE.Mesh(new THREE.CircleGeometry(40, 64), lam(0x5a0814)); cl.rotation.x = -Math.PI / 2; cl.position.y = -0.02; s.add(cl);
  const cam = new THREE.PerspectiveCamera(32, W / H, 0.1, 200); const d = fitDist(cam, 3.6, 2.6, W, H) * (L.land ? 1.0 : L.tall ? 0.95 : 1.15);
  if (L.land) { cam.position.set(4 + d * 0.35, d * 0.62, d * 0.75); cam.lookAt(-1.8, 0.2, 0); } else { cam.position.set(d * 0.3, d * 0.85, d * 0.62); cam.lookAt(-0.2, L.tall ? 3.4 : 2.2, -0.2); }
  shoot(s, cam, W, H); const u = L.u;
  if (L.land) { sideShade(W, H, 0.75); const x = W * 0.06, mw = W * 0.42; T('विजया दशमी २०८३', x, H * 0.3, 104 * u, { align: 'left', col: CREAM, weight: 800, maxW: mw }); T('को हार्दिक मंगलमय शुभकामना', x, H * 0.3 + 70 * u, 46 * u, { align: 'left', weight: 500, maxW: mw }); rule(x, H * 0.3 + 110 * u, 160 * u);
    let y = para('रातो टीका र जमरासँगै ठूलाबडाको आशीर्वाद: लामो आयु, सुस्वास्थ्य, सुख, शान्ति र समृद्धि सधैँ तपाईंको साथमा रहोस्।', x, H * 0.3 + 180 * u, 34 * u, mw, { align: 'left' }); T(SIGN, x, H - 80 * u, 38 * u, { align: 'left', weight: 600, col: GOLD }); }
  else { vignette(W, H, 0.0, 0.75); const top = L.tall ? 230 : 120; T('विजया दशमी', W / 2, top * u + 90 * u, 128 * u, { weight: 800, col: CREAM, maxW: W * 0.88 }); T('२०८३', W / 2, top * u + 170 * u, 64 * u, { weight: 700, col: GOLD });
    T('को हार्दिक मंगलमय शुभकामना', W / 2, top * u + 240 * u, 46 * u, { weight: 500, maxW: W * 0.88 }); rule(W / 2 - 80 * u, top * u + 278 * u, 160 * u);
    para('रातो टीका र जमरासँगै ठूलाबडाको आशीर्वाद: लामो आयु, सुस्वास्थ्य, सुख, शान्ति र समृद्धि सधैँ तपाईंको साथमा रहोस्।', W / 2, top * u + 340 * u, 33 * u, W * 0.8);
    const g = cx.createLinearGradient(0, H * 0.82, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)'); cx.fillStyle = g; cx.fillRect(0, H * 0.82, W, H * 0.18); T(SIGN, W / 2, H - 70 * u, 40 * u, { weight: 600, col: GOLD }); } };

// 2. CHANGA: kites over the valley and the Himalaya; a wish about height and breadth
D.changa = (W, H) => { const L = lay(W, H); const s = new THREE.Scene(); s.add(skyDome([[0, '#17468c'], [0.4, '#3a82d2'], [0.72, '#9ccbf0'], [1, '#eaf4fa']])); s.fog = new THREE.Fog(0xb9d8ef, 60, 260); s.add(new THREE.HemisphereLight(0xdfefff, 0x5a6a50, 1.6)); const sun = new THREE.DirectionalLight(0xfff2dc, 2.4); sun.position.set(-30, 40, 20); s.add(sun);
  const mt = himalaya({ peaks: [{ x: 14, h: 46, r: 22 }, { x: 20, h: 43, r: 10, z: -10 }, { x: -60, h: 36, r: 26 }, { x: 80, h: 33, r: 22 }], h: 30 }); mt.position.set(0, -6, -170); s.add(mt); const hl = hills({ w: 300, d: 140, h: 9 }); hl.position.set(0, -14, -60); s.add(hl); const tw = town({ n: 260, w: 140, d: 40 }); tw.position.set(0, -10, -40); s.add(tw); const pg = pagoda({ s: 1 }); pg.position.set(-14, -10, -30); s.add(pg);
  const cols = [['#d7192a', '#f2b733'], ['#1f5fd0', '#f4f4f4'], ['#ff8a1c', '#ffffff'], ['#2fae4a', '#f2e24a'], ['#c2185b', '#ffffff'], ['#ffd400', '#d7192a']]; const R = rng(L.land ? 3 : 5);
  const hero = kite(...cols[0]); hero.scale.setScalar(1.3); hero.position.set(L.land ? 3.2 : 1.3, L.land ? 1.2 : -0.2, -3); hero.rotation.set(0.1, 0.25, -0.2); hero.userData.tail(1.3); s.add(hero);
  const st = stringLine(0x1a1a28); s.add(st); st.userData.set(hero.position.clone(), new THREE.Vector3(-6, -14, 4), 1.5);
  for (let i = 0; i < 16; i++) { const k = kite(...cols[1 + i % 5]); k.position.set((R() - 0.5) * 50, 2 + R() * 26, -14 - R() * 60); k.scale.setScalar(1.3 + R()); k.rotation.set(0.1, (R() - 0.5) * 0.6, (R() - 0.5) * 0.5); k.userData.tail(i); s.add(k); const sl = stringLine(0x1a1a28); s.add(sl); sl.userData.set(k.position.clone(), new THREE.Vector3(k.position.x * 0.6, -10, -30), 2); }
  const cam = new THREE.PerspectiveCamera(L.land ? 42 : 48, W / H, 0.1, 1200); cam.position.set(0, 0.6, 9); cam.lookAt(L.land ? 1.4 : 0.5, L.land ? 2.6 : 3.2, -10); shoot(s, cam, W, H); const u = L.u;
  if (L.land) { sideShade(W, H, 0.55); const x = W * 0.06, mw = W * 0.44; T('शुभ दशैँ', x, H * 0.36, 150 * u, { align: 'left', weight: 800 }); T('२०८३', x, H * 0.36 + 80 * u, 60 * u, { align: 'left', col: GOLD });
    para('खुसी आकाशजत्तिकै फराकिलो होस्, सपना चङ्गाजस्तै अग्लो उडोस्। बडा दशैँको हार्दिक शुभकामना।', x, H * 0.36 + 150 * u, 36 * u, mw, { align: 'left' }); T(SIGN, x, H - 70 * u, 38 * u, { align: 'left', weight: 600, col: GOLD }); }
  else { vignette(W, H, 0.65, 0.35); T('शुभ दशैँ', W / 2, (L.tall ? 330 : 200) * u, 170 * u, { weight: 800 }); T('२०८३', W / 2, (L.tall ? 420 : 285) * u, 64 * u, { col: GOLD });
    const yb = H - (L.tall ? 420 : 300) * u; para('खुसी आकाशजत्तिकै फराकिलो होस्, सपना चङ्गाजस्तै अग्लो उडोस्।', W / 2, yb, 40 * u, W * 0.82); T('बडा दशैँको हार्दिक शुभकामना', W / 2, yb + 130 * u, 44 * u, { col: GOLD, maxW: W * 0.86 }); T(SIGN, W / 2, H - 70 * u, 40 * u, { weight: 600 }); } };

// 3. VIJAYA: the gilt trishul in its ring of ten weapons; truth over untruth
D.vijaya = (W, H) => { const L = lay(W, H); const s = new THREE.Scene(); s.background = new THREE.Color(0x0b0508); s.environment = R3.env; s.add(new THREE.AmbientLight(0x302018, 1)); const k = new THREE.DirectionalLight(0xfff0d8, 2.4); k.position.set(3, 6, 8); s.add(k); const b = new THREE.DirectionalLight(0xff4030, 2); b.position.set(-4, 2, -6); s.add(b);
  const tr = trishul(); tr.position.set(0, 0.4, 0); s.add(tr); const W10 = weapons(); W10.forEach((w, i) => { const a = i / 10 * Math.PI * 2 + 0.3; w.position.set(Math.cos(a) * 4.2, Math.sin(a) * 4.2 + 1.2, 0); w.rotation.set(i, i * 0.7, 0); w.scale.setScalar(0.9); s.add(w); });
  const halo = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.25, 160), basic(0xf2c14e, { transparent: true, opacity: 0.6 })); halo.position.set(0, 1.2, -0.6); s.add(halo);
  const cam = new THREE.PerspectiveCamera(36, W / H, 0.1, 200); const d = fitDist(cam, 5.4, 6.4, W, H); cam.position.set(L.land ? -4 : 0, 1.0, d * (L.land ? 1.0 : 1.05)); cam.lookAt(L.land ? -4 : 0, L.land ? 1.0 : (L.tall ? 1.6 : 2.4), 0); shoot(s, cam, W, H); const u = L.u;
  if (L.land) { const x = W * 0.06, mw = W * 0.4; T('विजया दशमी', x, H * 0.34, 110 * u, { align: 'left', weight: 800, col: GOLD, maxW: mw }); T('असत्यमाथि सत्यको, अन्धकारमाथि उज्यालोको विजय', x, H * 0.34 + 70 * u, 34 * u, { align: 'left', maxW: mw, weight: 500 });
    para('नौ रात शक्तिको आराधना, दशौँ दिन विजयको उत्सव। मा दुर्गाले सबैलाई शक्ति, साहस र सद्बुद्धि दिऊन्।', x, H * 0.34 + 140 * u, 32 * u, mw, { align: 'left' }); T(SIGN, x, H - 70 * u, 38 * u, { align: 'left', weight: 600, col: GOLD }); }
  else { vignette(W, H, 0.7, 0.5); T('विजया दशमी', W / 2, (L.tall ? 250 : 150) * u, 130 * u, { weight: 800, col: GOLD, maxW: W * 0.9 }); T('असत्यमाथि सत्यको विजय', W / 2, (L.tall ? 330 : 225) * u, 46 * u, { weight: 500 });
    const yb = H - (L.tall ? 380 : 250) * u; para('नौ रात शक्तिको आराधना, दशौँ दिन विजयको उत्सव। मा दुर्गाले सबैलाई शक्ति, साहस र सद्बुद्धि दिऊन्।', W / 2, yb, 36 * u, W * 0.84); T(SIGN, W / 2, H - 70 * u, 40 * u, { weight: 600, col: GOLD }); } };

// 4. JAMARA: the kalash, the barley grown in the dark, a diyo; from Ghatasthapana to Kojagrat
D.jamara = (W, H) => { const L = lay(W, H); const s = new THREE.Scene(); s.background = new THREE.Color(0x0a0605); s.environment = R3.env; s.add(new THREE.AmbientLight(0x2a1810, 0.9)); const key = new THREE.SpotLight(0xffd8a0, 160, 40, 0.7, 0.6, 1.4); key.position.set(3, 10, 7); s.add(key, key.target);
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.5, 64), lam(0x8a6a3a)); sand.position.y = -0.25; s.add(sand); const k = kalash(); k.position.set(-3.6, -0.5, -1.4); k.scale.setScalar(1.25); s.add(k); const dy = diyo(); dy.position.set(-1.8, 0, 2.6); dy.scale.setScalar(1.5); dy.userData.update(0.3, 1); s.add(dy);
  const jam = jamara({ n: 1100, r: 2.9, h: 3.4, seed: 2 }); jam.userData.update(0.6, 1); s.add(jam);
  const cam = new THREE.PerspectiveCamera(36, W / H, 0.1, 200); const d = fitDist(cam, 4.5, 3.4, W, H); cam.position.set(L.land ? -3.2 : d * 0.25, d * 0.42, d * (L.land ? 1.05 : 0.92)); cam.lookAt(L.land ? -5.2 : -0.6, L.tall ? 0.2 : 1.4, 0); shoot(s, cam, W, H); const u = L.u;
  if (L.land) { sideShade(W, H, 0.7); const x = W * 0.06, mw = W * 0.4; T('घटस्थापनादेखि', x, H * 0.3, 60 * u, { align: 'left', weight: 500 }); T('कोजाग्रतसम्म', x, H * 0.3 + 90 * u, 96 * u, { align: 'left', weight: 800, col: GOLD });
    para('घाम नदेखी उम्रिएको पहेँलो जमराझैँ, अँध्यारोमा पनि उज्यालो बाटो देख्न सकियोस्। बडा दशैँ २०८३ को शुभकामना।', x, H * 0.3 + 160 * u, 34 * u, mw, { align: 'left' }); T(SIGN, x, H - 70 * u, 38 * u, { align: 'left', weight: 600, col: GOLD }); }
  else { vignette(W, H, 0.75, 0.55); T('घटस्थापनादेखि', W / 2, (L.tall ? 240 : 140) * u, 60 * u, { weight: 500 }); T('कोजाग्रतसम्म', W / 2, (L.tall ? 340 : 235) * u, 110 * u, { weight: 800, col: GOLD });
    const yb = H - (L.tall ? 400 : 270) * u; para('घाम नदेखी उम्रिएको पहेँलो जमराझैँ, अँध्यारोमा पनि उज्यालो बाटो देख्न सकियोस्।', W / 2, yb, 38 * u, W * 0.84); T('बडा दशैँ २०८३ को शुभकामना', W / 2, yb + 130 * u, 42 * u, { col: GOLD }); T(SIGN, W / 2, H - 60 * u, 38 * u, { weight: 600 }); } };

// 5. GHAR: the official map as a slab, Kathmandu in red; wherever you are, home for Dashain
D.ghar = (W, H) => { const L = lay(W, H); const s = new THREE.Scene(); s.background = new THREE.Color(0x0a1230); s.environment = R3.env; s.add(new THREE.HemisphereLight(0xcfe0ff, 0x101830, 0.8)); const k = new THREE.DirectionalLight(0xfff0e0, 1.6); k.position.set(-6, 12, 8); s.add(k);
  const slab = nepalSlab(NEPAL.pts, { width: 9.5, top: 0x9a0a1e, side: 0x4a0510 }); s.add(slab); const fl = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), lam(0x0c1638)); fl.rotation.x = -Math.PI / 2; fl.position.y = -0.05; s.add(fl);
  const p = slab.userData.project(85.32, 27.71); const dot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 12), basic(0xffffff)); dot.position.copy(p); s.add(dot); for (const rr of [0.32, 0.6, 0.9]) { const r = new THREE.Mesh(new THREE.RingGeometry(rr, rr + 0.04, 64), basic(0xffffff, { transparent: true, opacity: 0.9 - rr * 0.7 })); r.rotation.x = -Math.PI / 2; r.position.copy(p); s.add(r); }
  const cam = new THREE.PerspectiveCamera(32, W / H, 0.1, 400); const d = fitDist(cam, 5.4, 3.2, W, H) * (L.land ? 1.9 : 1.15); cam.position.set(L.land ? -4.5 : 0, d * 0.82, d * 0.6); cam.lookAt(L.land ? -4.5 : 0, 0, L.land ? 0.4 : (L.tall ? -0.6 : -1.6)); shoot(s, cam, W, H); const u = L.u;
  const msg = 'संसारको जुनसुकै कुनामा भए पनि, दशैँले सबैलाई घर बोलाउँछ। आफन्तसँगको भेट, टीका र आशीर्वादको यो पर्वको हार्दिक शुभकामना।';
  if (L.land) { const x = W * 0.06, mw = W * 0.36; T('जहाँ भए पनि', x, H * 0.3, 56 * u, { align: 'left', weight: 500 }); T('दशैँमा घर', x, H * 0.3 + 100 * u, 118 * u, { align: 'left', weight: 800, col: CREAM, maxW: mw }); para(msg, x, H * 0.3 + 170 * u, 30 * u, mw, { align: 'left' }); T(SIGN, x, H - 70 * u, 36 * u, { align: 'left', weight: 600, col: GOLD }); }
  else { T('जहाँ भए पनि', W / 2, (L.tall ? 300 : 170) * u, 60 * u, { weight: 500 }); T('दशैँमा घर', W / 2, (L.tall ? 420 : 285) * u, 140 * u, { weight: 800 }); const yb = H - (L.tall ? 470 : 300) * u; para(msg, W / 2, yb, 36 * u, W * 0.84); T('बडा दशैँ २०८३', W / 2, H - 140 * u, 44 * u, { col: GOLD }); T(SIGN, W / 2, H - 70 * u, 38 * u, { weight: 600 }); } };

async function ready() { R3 = makeRenderer(1080, 1080); NEPAL = await (await fetch('../lib/nepal.json')).json(); await PX.fonts([{ spec: '500 40px Mukta' }, { spec: '700 40px Mukta' }, { spec: '800 40px Mukta' }]); }
function render(name, W, H) { out.width = W; out.height = H; cx.clearRect(0, 0, W, H); D[name](W, H); return out; }
window.CARDS = { ready, render, list: () => Object.keys(D) };
