// "विजया": the Dashain film, v2. 1080x1920, 30 fps, about 75 s, 3D (three.js) with a type layer and pixel-art accents.
// The cut times sit on the beat grids of the three music beds that score.py lays under them:
//   A  0.00-7.43 s   festive bed (129.2 BPM, 0.4644 s/beat)   kite fight, the cut
//   B  7.43-28.36 s  epic drums  (117.5 BPM, 0.5106 s/beat)   the Devi Mahatmya, Mahishasura, Durga, Navaratri, victory
//   C  28.36-75.1 s  devotional bed (80.7 BPM, 0.7435 s/beat) Nepal, the fifteen days, life, the tika on you, the wish
// Story device: one red tika dot. It is the cut kite's heart, the bindu Durga is born from, Kathmandu on the map,
// the marker on the fifteen-moon strip, the tika on the thali, and finally the tika on the viewer's forehead.
// All copy is Nepali, in fragments of one to four words.
import { THREE, E, clamp, mix, prog, rng, hash, makeRenderer, skyDome, himalaya, hills, kite, stringLine, pagoda, kalash, thali, jamara, diyo, marigold, trishul, weapons, moonMat, nepalSlab, ping, town, softTex, folio, shards, taperTube, lam, std, basic, canvasTex } from './lib3d.js';

const W = 1080, H = 1920, FPS = 30;
const bA = 60 / 129.2, bB = 60 / 117.5, bC = 60 / 80.7;
const tA = 0, tB = 16 * bA, tC = tB + 41 * bB;                 // section starts (s)
const C_ = n => tC + n * bC, B_ = n => tB + n * bB, A_ = n => tA + n * bA;
export const CUES = { CUT: A_(10), B: tB, MAHISH: B_(8), DURGA: B_(16), DURGA_FORM: B_(20), NAVA: B_(26), VICTORY: B_(35), C: tC, MAP: C_(0), GHATA: C_(7), FUL: C_(13), CANNON: [C_(14), C_(15), C_(16)], ASHT: C_(17), NAVM: C_(20), TIKA: C_(23), KOJA: C_(32), LIFE: C_(36), POV: C_(44), STAMP: C_(47), WISH: C_(49), END: C_(61) };
const TOTAL = Math.round((CUES.END + 1.4) * FPS);
const RED = 0xc8102e, REDC = '#e0283c', INK = '#0f0d0e', PAPER = '#f4f2ee', GOLD = '#f2c14e';

// ---------- the type layer (Mukta, Devanagari; fragments rise in, hold, leave whole)
const out = document.getElementById('c'), cx = out.getContext('2d');
function frag(s, t, t0, t1, x, y, size, o = {}) { if (t < t0 || t > t1 + 0.4) return; const u = E.out(prog(t, t0, t0 + 0.45)), v = E.exit(prog(t, t1, t1 + 0.35)); const col = o.col || PAPER;
  cx.save(); cx.globalAlpha = u * (1 - v) * (o.alpha ?? 1); cx.font = `${o.weight || 700} ${size}px Mukta`; cx.textAlign = o.align || 'center'; cx.textBaseline = 'alphabetic';
  if (o.shadow !== false) { cx.shadowColor = 'rgba(0,0,0,0.45)'; cx.shadowBlur = size * 0.35; cx.shadowOffsetY = size * 0.05; }
  let fs = size; if (o.maxW) { const w = cx.measureText(s).width; if (w > o.maxW) { fs = size * o.maxW / w; cx.font = `${o.weight || 700} ${fs}px Mukta`; } }
  // the newest fragment arrives in the accent and relaxes to its colour (cinetic: "new arrives in the accent")
  const relax = o.accent ? clamp((t - t0 - 0.25) / 0.6) : 1; cx.fillStyle = o.accent ? lerpHex(o.accent, col, relax) : col;
  cx.fillText(s, x, y + (1 - u) * size * 0.32 - v * size * 0.18); cx.restore(); }
function lerpHex(a, b, t) { const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16); const c = s => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t); return `rgb(${c(16)},${c(8)},${c(0)})`; }
function scrim(t, t0, t1, y = 1520, k = 0.5) { if (t < t0 - 0.2 || t > t1 + 0.6) return; const a = clamp((t - t0 + 0.2) * 3) * (1 - clamp((t - t1) / 0.6)); const g = cx.createLinearGradient(0, y - 300, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, `rgba(0,0,0,${k * a})`); g.addColorStop(1, `rgba(0,0,0,${k * a})`); cx.fillStyle = g; cx.fillRect(0, y - 300, W, H - y + 300); }
const NP = n => String(n).replace(/\d/g, d => '०१२३४५६७८९'[d]);

// pixel-art accent: the fifteen-moon strip (Pratipada to Purnima) drawn on a PX raster, the red dot on today
const strip = new PX.Raster(180, 22);
function moonStrip(day, t, a = 1) { if (a <= 0) return; const R = strip; R.clear(0); for (let d = 1; d <= 15; d++) { const x = 10 + (d - 1) * 11.4, y = 11, on = d === day;
    PX.K.moon(R, x, y, on ? 4 : 3, Math.min(0.5, d / 30), on ? PX.hex('#fff6e0') : d < day ? PX.hex('#d8d0c0') : PX.hex('#6a6a80'), PX.hex('#1c1c2a')); if (on) { R.disc(x, y + 8, 1.5, PX.hex(REDC)); } }
  R.commit(); cx.save(); cx.globalAlpha = a; cx.imageSmoothingEnabled = false; cx.drawImage(R.cv, 0, 70, 1080, 132); cx.restore();
  cx.save(); cx.globalAlpha = a; cx.font = '700 30px Mukta'; cx.fillStyle = PAPER; cx.textAlign = 'center'; cx.shadowColor = 'rgba(0,0,0,.5)'; cx.shadowBlur = 8; cx.fillText(NP(day) + ' / १५', (10 + (day - 1) * 11.4) * 6, 240); cx.restore(); }

// ---------- renderer and shots
const { r, cv: glc, env } = makeRenderer(W, H); const prevC = document.createElement('canvas'); prevC.width = W; prevC.height = H; const pcx = prevC.getContext('2d');
const SH = [];
function shot(a, b, build, o = {}) { SH.push({ a, b, build, o, s: null }); }
function cam(fov = 38) { return new THREE.PerspectiveCamera(fov, W / H, 0.1, 1200); }
let NEPAL = null;

// 0. KITES: Ashoj sky over the valley, the red kite and the blue kite saw at each other; the red one is cut (CUT)
shot(0, CUES.B, () => {
  const s = new THREE.Scene(); s.add(skyDome([[0, '#1d4f9a'], [0.45, '#3f86d6'], [0.75, '#9ccbf0'], [1, '#e9f3fa']])); s.fog = new THREE.Fog(0xb9d8ef, 60, 260);
  s.add(new THREE.HemisphereLight(0xdfefff, 0x5a6a50, 1.6)); const sun = new THREE.DirectionalLight(0xfff2dc, 2.4); sun.position.set(-30, 40, 20); s.add(sun);
  const mt = himalaya({ peaks: [{ x: 20, h: 44, r: 22 }, { x: 26, h: 41, r: 10, z: -10 }, { x: -60, h: 36, r: 26 }, { x: 80, h: 33, r: 22 }], h: 30 }); mt.position.set(0, -6, -170); s.add(mt);
  const hl = hills({ w: 300, d: 140, h: 9 }); hl.position.set(0, -14, -60); s.add(hl); const tw = town({ n: 260, w: 140, d: 40 }); tw.position.set(0, -10, -40); s.add(tw);
  const pg = pagoda({ s: 1 }); pg.position.set(-14, -10, -30); s.add(pg);
  const red = kite('#d7192a', '#f2b733'), blue = kite('#1f5fd0', '#f4f4f4'); s.add(red, blue); const others = [];
  const R = rng(7), cols = [['#ff8a1c', '#ffffff'], ['#2fae4a', '#f2e24a'], ['#c2185b', '#ffffff'], ['#ffd400', '#d7192a'], ['#1fb5a6', '#ffffff'], ['#7a3a1a', '#f2b733']];
  for (let i = 0; i < 14; i++) { const k = kite(...cols[i % 6]); k.position.set((R() - 0.5) * 60, 4 + R() * 26, -20 - R() * 70); k.scale.setScalar(1.4 + R()); k.userData.ph = R() * 6; s.add(k); others.push(k); }
  const sR = stringLine(0x1a1a28), sB = stringLine(0x22224a), sR2 = stringLine(0x1a1a28); s.add(sR, sB, sR2);
  const spark = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(60 * 3), 3)), new THREE.PointsMaterial({ color: 0xffe6a0, size: 0.06, transparent: true, opacity: 0.9 })); s.add(spark);
  const c = cam(40);
  return { s, c, update(t) {
    const cut = t - CUES.CUT, X = new THREE.Vector3(0.6 + Math.sin(t * 1.7) * 0.15, -1.2 + Math.sin(t * 1.3) * 0.1, -2);   // where the strings cross
    // camera: rides the fight, then follows the cut kite as it falls away
    const fall = clamp(cut / 2.8), cp = new THREE.Vector3(mix(-1.2, 0.4, E.cam(prog(t, 0, 4.6))), mix(0.4, -0.6, E.cam(prog(t, 0, 4.6))) - E.in(fall) * 7, mix(9, 7.5, E.cam(prog(t, 0, 4.6))));
    c.position.copy(cp);
    red.position.set(-1.6 + Math.sin(t * 1.4) * 0.35, 2.4 + Math.sin(t * 1.9) * 0.25, -3); red.rotation.set(0.15, 0.25 + Math.sin(t * 1.3) * 0.15, -0.25 + Math.sin(t * 2.1) * 0.12); red.userData.tail(t);
    blue.position.set(2.0 + Math.sin(t * 1.6 + 1) * 0.3, 3.0 + Math.sin(t * 2.3) * 0.22, -4); blue.rotation.set(0.1, -0.3, 0.3 + Math.sin(t * 1.7) * 0.12); blue.userData.tail(t + 2);
    if (cut > 0) { red.position.x += cut * 0.8 + Math.sin(cut * 4) * 0.4; red.position.y -= E.in(fall) * 9 + cut * 0.6; red.rotation.z += cut * 3.2 + cut * cut * 1.5; red.rotation.x += cut * 1.4; }
    c.lookAt(cut > 0 ? red.position.clone().lerp(X, 0.2) : new THREE.Vector3(0.2, 1.6, -3.4));
    const redAnchor = red.position.clone().add(new THREE.Vector3(0, 0.1, 0)), blueAnchor = blue.position.clone().add(new THREE.Vector3(0, 0.1, 0));
    if (cut <= 0) { sR.userData.set(redAnchor, X, 0.15); sR2.userData.set(X, new THREE.Vector3(-8, -12, 4), 1.2); sB.userData.set(blueAnchor, X, 0.1); }
    else { sR.userData.set(redAnchor, redAnchor.clone().add(new THREE.Vector3(-0.6, -2.5 + Math.sin(cut * 6) * 0.3, 0.2)), 0.2); sR2.userData.set(X.clone().add(new THREE.Vector3(0, -cut * 2, 0)), new THREE.Vector3(-8, -12, 4), 1.2); sB.userData.set(blueAnchor, X, 0.1); }
    sB.visible = true; const sp = spark.geometry.attributes.position; const sw = clamp((t - 2.2) / 2.4);
    for (let i = 0; i < 60; i++) { const a = hash(i, Math.floor(t * 30)) * 6.28, d = hash(i, Math.floor(t * 30) + 7) * 0.35 * sw; sp.setXYZ(i, X.x + Math.cos(a) * d, X.y + Math.sin(a) * d, X.z + (hash(i, 3) - 0.5) * 0.2); } sp.needsUpdate = true; spark.visible = cut < 0.1 && sw > 0;
    others.forEach((k, i) => { k.userData.tail(t + i); k.rotation.set(0.1, Math.sin(t * 0.7 + k.userData.ph) * 0.3, Math.sin(t * 1.1 + k.userData.ph) * 0.25); k.position.y += Math.sin(t * 1.3 + k.userData.ph) * 0.004; });
  }, ov(t) {
    scrim(t, 0.3, 2.6, 1560, 0.35); frag('असोजको आकाश', t, 0.4, 2.5, W / 2, 1620, 92, { accent: REDC });
    if (t >= CUES.CUT && t < CUES.CUT + 1.4) { const k = E.out(prog(t, CUES.CUT, CUES.CUT + 0.25)), v = prog(t, CUES.CUT + 1.0, CUES.CUT + 1.4); const R = strip; R.clear(0);   // the shout, set in pixel Devanagari
      const pr = new PX.Raster(150, 70); pr.text('चेट!', 75, 54, '48px Yatra', PX.hex('#ffffff'), { outline: PX.hex('#0f0d0e'), shadow: PX.hex(REDC), sdx: 3, sdy: 3 }); pr.commit(); cx.save(); cx.globalAlpha = 1 - v; cx.imageSmoothingEnabled = false; const sc = 7 * mix(0.8, 1, k); cx.drawImage(pr.cv, W / 2 - 75 * sc, 330 - 35 * sc, 150 * sc, 70 * sc); cx.restore(); }
    scrim(t, 5.2, 7.2, 1560, 0.35); frag('एउटा धागो', t, 5.3, 7.1, W / 2, 1600, 80); frag('चुँडियो', t, 5.8, 7.1, W / 2, 1700, 80, { accent: REDC });
  } };
});

// 1. THE TEXT: palm-leaf folios of the Devi Mahatmya, raking lamp light; one folio per beat
shot(CUES.B, CUES.MAHISH, () => {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x0d0806); s.fog = new THREE.Fog(0x0d0806, 14, 34);
  s.add(new THREE.AmbientLight(0x402818, 0.6)); const L = new THREE.PointLight(0xffb060, 60, 40, 1.6); L.position.set(-4, 5, 6); s.add(L); const L2 = new THREE.DirectionalLight(0x6080ff, 0.3); L2.position.set(5, -2, 3); s.add(L2);
  const verses = [['या देवी सर्वभूतेषु शक्तिरूपेण संस्थिता ।', 'नमस्तस्यै नमस्तस्यै नमस्तस्यै नमो नमः ॥'], ['सर्वमङ्गलमाङ्गल्ये शिवे सर्वार्थसाधिके ।', 'शरण्ये त्र्यम्बके गौरि नारायणि नमोऽस्तु ते ॥'], ['या देवी सर्वभूतेषु मातृरूपेण संस्थिता ।', 'नमस्तस्यै नमस्तस्यै नमस्तस्यै नमो नमः ॥'],
    ['जयन्ती मङ्गला काली भद्रकाली कपालिनी ।', 'दुर्गा क्षमा शिवा धात्री स्वाहा स्वधा नमोऽस्तु ते ॥'], ['या देवी सर्वभूतेषु बुद्धिरूपेण संस्थिता ।', 'नमस्तस्यै नमस्तस्यै नमस्तस्यै नमो नमः ॥'], ['या देवी सर्वभूतेषु शान्तिरूपेण संस्थिता ।', 'नमस्तस्यै नमस्तस्यै नमस्तस्यै नमो नमः ॥']];
  const F = verses.map((v, i) => { const m = folio(v); m.userData.i = i; s.add(m); return m; });
  const c = cam(34); return { s, c, update(t) { const lt = t - CUES.B; c.position.set(mix(-0.6, 0.6, E.dolly(prog(lt, 0, 4.1))), mix(9, 7, E.dolly(prog(lt, 0, 4.1))), mix(24, 20, E.dolly(prog(lt, 0, 4.1)))); c.lookAt(0, 0, 0);
    F.forEach((m, i) => { const u = E.rest(prog(lt, i * bB, i * bB + 0.55)); m.position.set(mix(-14, (i % 2 ? 0.25 : -0.25), u), -2.8 + i * 1.05, mix(-3, 0, u)); m.rotation.set(-1.2 + i * 0.02, (i - 2.5) * 0.035 + (1 - u) * 0.8, 0); }); },
    ov(t) { const lt = t - CUES.B; scrim(t, CUES.B + 0.2, CUES.MAHISH, 1500, 0.5); frag('करिब १५०० वर्षअघि', t, CUES.B + 0.25, CUES.B + 1.9, W / 2, 1560, 74); frag('देवी माहात्म्य', t, CUES.B + 2.05, CUES.MAHISH - 0.1, W / 2, 1600, 112, { accent: GOLD, col: GOLD });
      frag('मार्कण्डेय पुराणको अंश', t, CUES.B + 2.4, CUES.MAHISH - 0.1, W / 2, 1690, 46, { weight: 500 }); } };
});

// 2. MAHISHASURA: horns out of the dark, ember eyes, cracked red ground; slow push in
let HORN_GEOS = [];
shot(CUES.MAHISH, CUES.DURGA, () => {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x070203); s.fog = new THREE.FogExp2(0x1a0306, 0.03); s.environment = env;
  s.add(new THREE.AmbientLight(0x200608, 1)); const rim = new THREE.DirectionalLight(0xff3020, 6); rim.position.set(0, 5, -6); const rim2 = new THREE.DirectionalLight(0xff7040, 2.5); rim2.position.set(6, 6, 2); s.add(rim2); s.add(rim); const key = new THREE.PointLight(0xff5a2a, 30, 30); key.position.set(0, -2, 5); s.add(key);
  const dark = std(0x1a0c0c, { rough: 0.3, env: 0.5 }), grp = new THREE.Group(); s.add(grp);
  for (const sd of [-1, 1]) { const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(sd * 1.2, 0.6, 0), new THREE.Vector3(sd * 3.4, 0.9, -0.4), new THREE.Vector3(sd * 5.0, 2.6, -0.6), new THREE.Vector3(sd * 4.6, 4.6, -0.2), new THREE.Vector3(sd * 3.6, 5.6, 0.3)]);
    const g = taperTube(curve, u => 0.62 * (1 - u) ** 0.9 + 0.02, 90, 16); HORN_GEOS.push(g); grp.add(new THREE.Mesh(g, dark)); }
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.9, 72, 48), dark); const hp = head.geometry.attributes.position; for (let i = 0; i < hp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(hp, i); v.y *= 0.95; v.z *= 1.15; if (v.y < 0) v.z += -v.y * 0.5; v.multiplyScalar(1 + (fbmLite(v) - 0.5) * 0.12); hp.setXYZ(i, v.x, v.y, v.z); } head.geometry.computeVertexNormals(); head.position.y = -0.2; grp.add(head);
  const eyeM = basic(0xff2a10); for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8), eyeM); e.scale.set(1.6, 0.6, 0.6); e.position.set(sd * 0.75, 0.25, 1.75); grp.add(e); }
  const glowM = new THREE.SpriteMaterial({ map: softTex('#ff3a1a'), color: 0xff4020, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }); for (const sd of [-1, 1]) { const g = new THREE.Sprite(glowM); g.scale.setScalar(1.6); g.position.set(sd * 0.75, 0.25, 1.9); grp.add(g); }
  const crack = canvasTex(1024, 1024, (x, w, h) => { x.fillStyle = '#0a0304'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ff3a12'; x.lineCap = 'round'; const R = rng(4); for (let k = 0; k < 40; k++) { let px = w / 2 + (R() - 0.5) * 200, py = h / 2 + (R() - 0.5) * 200; x.lineWidth = 1 + R() * 3; x.beginPath(); x.moveTo(px, py); for (let j = 0; j < 14; j++) { px += (R() - 0.5) * 90; py += (R() - 0.5) * 90; x.lineTo(px, py); } x.stroke(); } });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: crack, transparent: false })); ground.rotation.x = -Math.PI / 2; ground.position.y = -3.4; s.add(ground);
  const embers = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(300 * 3), 3)), new THREE.PointsMaterial({ color: 0xff7a2a, size: 0.05, transparent: true, opacity: 0.85 })); s.add(embers);
  const c = cam(36); s.userData.grp = grp; return { s, c, update(t) { const lt = t - CUES.MAHISH, k = E.dolly(prog(lt, 0, 4.1)); c.position.set(Math.sin(lt * 0.3) * 0.6, mix(0.6, 1.4, k), mix(22, 17, k)); c.lookAt(0, 1.8, 0);
    grp.scale.setScalar(1 + Math.sin(lt * 2.4) * 0.01); key.intensity = 26 + Math.sin(lt * 7) * 4; const ep = embers.geometry.attributes.position; for (let i = 0; i < 300; i++) { const y = ((hash(i, 1) * 10 + lt * (0.6 + hash(i, 2))) % 10) - 3.4; ep.setXYZ(i, (hash(i, 3) - 0.5) * 16 + Math.sin(lt + i) * 0.2, y, (hash(i, 4) - 0.5) * 8); } ep.needsUpdate = true; },
    ov(t) { scrim(t, CUES.MAHISH + 0.2, CUES.DURGA, 1500, 0.4); frag('महिषासुर', t, CUES.MAHISH + 0.3, CUES.MAHISH + 1.9, W / 2, 1620, 150, { accent: REDC });
      frag('कुनै देवताले होइन', t, CUES.MAHISH + 2.05, CUES.DURGA - 0.15, W / 2, 1560, 70); frag('कुनै पुरुषले होइन', t, CUES.MAHISH + 2.8, CUES.DURGA - 0.15, W / 2, 1660, 70, { accent: REDC }); } };
});
function fbmLite(v) { return (Math.sin(v.x * 3.1 + v.y * 1.7) + Math.sin(v.y * 4.3 + v.z * 2.1) + Math.sin(v.z * 5.2 + v.x * 1.3)) / 6 + 0.5; }

// 3. DURGA: three beams of the gods' light meet in one red point; the bindu blooms into a gilt trishul ringed by ten weapons
shot(CUES.DURGA, CUES.NAVA, () => {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x050307); s.environment = env;
  s.add(new THREE.AmbientLight(0x302018, 1)); const key = new THREE.DirectionalLight(0xfff0d8, 2.2); key.position.set(3, 6, 8); s.add(key); const back = new THREE.DirectionalLight(0xff5040, 1.6); back.position.set(-4, 2, -6); s.add(back);
  const beamM = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const beams = [[-9, 10, -2, 0xffd68a], [9, 10, -2, 0xffffff], [0, -10, -3, 0xff8a6a]].map(([x, y, z, c]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.06, 1, 16, 1, true), beamM(c)); m.userData.from = new THREE.Vector3(x, y, z); s.add(m); return m; });
  const bindu = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 16), basic(RED)); s.add(bindu);
  const tr = trishul(); tr.scale.setScalar(0.9); s.add(tr); const W10 = weapons(), ring = new THREE.Group(); W10.forEach((w, i) => { const a = i / 10 * Math.PI * 2; w.position.set(Math.cos(a) * 4.2, Math.sin(a) * 4.2 + 1.2, 0); w.userData.a = a; w.scale.setScalar(0.9); ring.add(w); }); s.add(ring);
  const halo = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.24, 128), basic(0xf2c14e, { transparent: true, opacity: 0.7 })); halo.position.set(0, 1.2, -0.6); s.add(halo);
  const c = cam(38); return { s, c, update(t) { const lt = t - CUES.DURGA, conv = E.out(prog(lt, -0.5, 1.4)), form = E.out(prog(t, CUES.DURGA_FORM, CUES.DURGA_FORM + 1.0));
    beams.forEach(b => { const a = b.userData.from, e = a.clone().lerp(new THREE.Vector3(0, 1.2, 0), conv); const mid = a.clone().add(e).multiplyScalar(0.5); b.position.copy(mid); b.scale.set(1, a.distanceTo(e) + 0.001, 1); b.lookAt(e); b.rotateX(Math.PI / 2); b.visible = form < 0.6; b.material.opacity = 0.85 * (1 - form); });
    bindu.position.set(0, 1.2, 0); bindu.scale.setScalar(conv * (1 + form * 0.2)); bindu.visible = conv > 0.01;
    tr.visible = form > 0; tr.scale.setScalar(0.9 * form); tr.position.set(0, mix(-1, 0.4, form), -0.2); tr.rotation.y = mix(-1.2, 0, form) + Math.sin(lt * 0.6) * 0.12;
    ring.visible = form > 0; ring.rotation.z = lt * 0.12; W10.forEach((w, i) => { const k = E.out(prog(t, CUES.DURGA_FORM + 0.2 + i * 0.06, CUES.DURGA_FORM + 0.9 + i * 0.06)); w.scale.setScalar(0.9 * k); w.rotation.set(lt * 0.5 + i, lt * 0.7, -ring.rotation.z); });
    halo.scale.setScalar(form); halo.visible = form > 0; c.position.set(Math.sin(lt * 0.25) * 1.2, 1.2, mix(15, 12.5, E.dolly(prog(lt, 0, 5.1)))); c.lookAt(0, 1.0, 0); },
    ov(t) { scrim(t, CUES.DURGA + 0.2, CUES.NAVA, 1500, 0.4); frag('देवताहरूको तेज', t, CUES.DURGA + 0.3, CUES.DURGA + 1.65, W / 2, 1600, 84); frag('एउटै शक्तिमा', t, CUES.DURGA + 2.15, CUES.DURGA_FORM - 0.1, W / 2, 1600, 84, { accent: REDC });
      frag('दुर्गा', t, CUES.DURGA_FORM + 0.25, CUES.NAVA - 0.1, W / 2, 1660, 230, { accent: REDC, col: GOLD }); } };
});

// 4. NAVARATRI: nine moons on an arc, one per beat, each a night; the names of the nine Durgas rotate in one slot
const NAVADURGA = ['शैलपुत्री', 'ब्रह्मचारिणी', 'चन्द्रघण्टा', 'कूष्माण्डा', 'स्कन्दमाता', 'कात्यायनी', 'कालरात्रि', 'महागौरी', 'सिद्धिदात्री'];
shot(CUES.NAVA, CUES.VICTORY, () => {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x05060f); const M = [];
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 1500 * 3 }, (_, i) => (hash(i, 9) - 0.5) * (i % 3 === 2 ? 40 : 120)).map((v, i) => i % 3 === 2 ? v - 60 : v), 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.7 })); s.add(stars);
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1.05, 48, 32), moonMat(Math.PI * (0.18 + i * 0.075))); m.position.set(((i % 3) - 1) * 2.75, 7.2 - Math.floor(i / 3) * 2.75, 0); M.push(m); s.add(m); }
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 12), basic(RED)); s.add(dot);
  const c = cam(40); return { s, c, update(t) { const lt = t - CUES.NAVA, n = Math.min(8, Math.floor(lt / bB));
    M.forEach((m, i) => { const on = i <= n, k = E.out(prog(lt, i * bB, i * bB + 0.35)); m.scale.setScalar(on ? mix(0.6, i === n ? 1.12 : 1, k) : 0.6); m.material.uniforms.earth.value = on ? 0.035 : 0.0; m.material.uniforms.tint.value.set(on ? 0xf6efe0 : 0x343448); m.rotation.y = lt * 0.2; });
    const cur = M[n].position; dot.position.set(cur.x, cur.y - 1.32, 0.5); c.position.set(0, 3.0, 21); c.lookAt(0, 3.4, 0); },
    ov(t) { const lt = t - CUES.NAVA, n = Math.min(8, Math.floor(lt / bB)); scrim(t, CUES.NAVA, CUES.VICTORY, 1500, 0.45);
      frag('नवरात्रि', t, CUES.NAVA + 0.05, CUES.VICTORY - 0.1, W / 2, 1460, 64, { col: GOLD, weight: 800 });
      const t0 = CUES.NAVA + n * bB; frag(NAVADURGA[n], t, t0, Math.min(t0 + bB - 0.12, CUES.VICTORY - 0.1), W / 2, 1640, 120, { accent: REDC, maxW: 960 });
      frag(NP(n + 1) + ' औँ रात', t, CUES.NAVA + 0.05, CUES.VICTORY - 0.1, W / 2, 1740, 44, { weight: 500, alpha: 0.85 }); } };
});

// 5. VICTORY: the horns shatter on the tenth day
shot(CUES.VICTORY, CUES.C, () => {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x120306); s.add(new THREE.AmbientLight(0x502018, 1.4)); const L = new THREE.DirectionalLight(0xffd8a0, 2.5); L.position.set(0, 4, 8); s.add(L);
  const sh = []; for (const g of HORN_GEOS) { const m = shards(g, 700, 0x1a0508, 3 + sh.length); s.add(m); sh.push(m); }
  const gold = shards(new THREE.SphereGeometry(1.8, 24, 16), 500, 0xe0b04a, 9); s.add(gold); sh.push(gold);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 16), basic(RED)); dot.position.set(0, 1.5, 1); s.add(dot);
  const c = cam(38); return { s, c, update(t) { const lt = t - CUES.VICTORY; sh.forEach(m => m.userData.update(E.out(clamp(lt / 2.4)) * 2.2)); dot.scale.setScalar(1 + E.out(clamp(lt / 3)) * 1.5); c.position.set(0, 1.5, mix(13, 15, E.out(clamp(lt / 3)))); c.lookAt(0, 1.5, 0); },
    ov(t) { scrim(t, CUES.VICTORY + 0.1, CUES.C, 1460, 0.45); frag('दशौँ दिन', t, CUES.VICTORY + 0.25, CUES.C - 0.1, W / 2, 1460, 74); frag('विजय', t, CUES.VICTORY + 0.75, CUES.C - 0.1, W / 2, 1660, 210, { accent: REDC, col: GOLD });
      frag('विजया = जित  ·  दशमी = दशौँ तिथि', t, CUES.VICTORY + 1.5, CUES.C - 0.1, W / 2, 1770, 44, { weight: 500 }); } };
}, { tr: 'cut' });

// 6. NEPAL: the official map rises as a slab; Gorkha and Kathmandu pulse; "Bada Dashain, fifteen days"
shot(CUES.MAP, CUES.GHATA, () => {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x0a1230); s.environment = env; s.fog = new THREE.Fog(0x0a1230, 30, 70);
  s.add(new THREE.HemisphereLight(0xcfe0ff, 0x101830, 0.8)); const L = new THREE.DirectionalLight(0xfff0e0, 1.6); L.position.set(-6, 12, 8); s.add(L);
  const slab = nepalSlab(NEPAL.pts, { width: 9.5, top: 0x9a0a1e, side: 0x4a0510 }); slab.rotation.y = 0.0; s.add(slab); const ring = (lon, la) => { const g = new THREE.Group(), p = slab.userData.project(lon, la); const d = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 12), basic(0xffffff)); d.position.copy(p); g.add(d);
    const r = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 48), basic(0xffffff, { transparent: true, opacity: 0.8 })); r.rotation.x = -Math.PI / 2; r.position.copy(p); g.add(r); g.userData.r = r; s.add(g); return g; };
  const ktm = ring(85.32, 27.71), gor = ring(84.63, 28.0); ktm.children[0].material = basic(RED);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), lam(0x0c1638)); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.05; s.add(floor);
  const c = cam(36); return { s, c, update(t) { const lt = t - CUES.MAP, k = E.cam(prog(lt, 0, 3.4)); slab.position.y = mix(-1.2, 0, E.out(prog(lt, 0, 1.2)));
    c.position.set(mix(-1, 0.6, k), mix(40, 26, k), mix(4, 18, k)); c.lookAt(0.2, 0, 1.2);
    for (const [g, d] of [[ktm, 0], [gor, 0.35]]) { const p = (lt * 0.9 + d) % 1; g.userData.r.scale.setScalar(1 + p * 3); g.userData.r.material.opacity = 0.8 * (1 - p); g.visible = lt > 1.0; } },
    ov(t) { scrim(t, CUES.MAP + 0.3, CUES.GHATA, 1500, 0.45); frag('नेपालमा', t, CUES.MAP + 0.3, CUES.MAP + 1.7, W / 2, 1560, 74); frag('बडा दशैँ', t, CUES.MAP + 1.85, CUES.GHATA - 0.1, W / 2, 1600, 150, { accent: REDC });
      frag('१५ दिनको महान चाड', t, CUES.MAP + 2.6, CUES.GHATA - 0.1, W / 2, 1710, 58, { weight: 500 });
    } };
});

// 7. DAY 1 · GHATASTHAPANA: a dark room, a kalash, barley sown in sand grows into pale-gold jamara (time-lapse)
shot(CUES.GHATA, CUES.FUL, () => {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x080504); s.environment = env; s.add(new THREE.AmbientLight(0x2a1810, 0.8)); const key = new THREE.SpotLight(0xffd8a0, 120, 30, 0.6, 0.6, 1.4); key.position.set(2, 9, 6); s.add(key, key.target);
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.5, 64), lam(0x8a6a3a)); sand.position.y = -0.25; s.add(sand); const top = new THREE.Mesh(new THREE.CircleGeometry(3.2, 64), lam(0xa8844a)); top.rotation.x = -Math.PI / 2; top.position.y = 0.01; s.add(top);
  const k = kalash(); k.position.set(-3.6, -0.5, -1.4); k.scale.setScalar(1.25); s.add(k); const dy = diyo(); dy.position.set(-1.6, 0, 2.6); dy.scale.setScalar(1.5); s.add(dy);
  const jam = jamara({ n: 900, r: 2.9, h: 3.2, seed: 2 }); s.add(jam);
  const c = cam(36); return { s, c, update(t) { const lt = t - CUES.GHATA; dy.userData.update(t, 1); jam.userData.update(t, E.inOut(prog(lt, 0.6, 4.2)));
    c.position.set(mix(4, 2.5, E.dolly(prog(lt, 0, 4.4))), mix(4.5, 3.2, E.dolly(prog(lt, 0, 4.4))), mix(10, 8.5, E.dolly(prog(lt, 0, 4.4)))); c.lookAt(-0.6, 1.2, 0); },
    ov(t) { moonStrip(1, t, clamp((t - CUES.GHATA) * 3)); scrim(t, CUES.GHATA + 0.2, CUES.FUL, 1500, 0.45); frag('घटस्थापना', t, CUES.GHATA + 0.25, CUES.GHATA + 2.1, W / 2, 1620, 120, { accent: REDC });
      frag('अँध्यारो कोठामा जौ', t, CUES.GHATA + 2.55, CUES.FUL - 0.1, W / 2, 1560, 66); frag('घाम नदेखेको जमरा', t, CUES.GHATA + 3.0, CUES.FUL - 0.1, W / 2, 1660, 66, { accent: GOLD }); } };
});

// 8. DAY 7 · FULPATI: a gun salute at Tundikhel as the sacred flowers from Gorkha reach Hanuman Dhoka
shot(CUES.FUL, CUES.ASHT, () => {
  const s = new THREE.Scene(); s.add(skyDome([[0, '#2a6fc8'], [0.6, '#8cc0ea'], [1, '#e8f2f8']])); s.fog = new THREE.Fog(0xcfe2f0, 30, 160); s.add(new THREE.HemisphereLight(0xe8f4ff, 0x506040, 1.6)); const sun = new THREE.DirectionalLight(0xfff0d8, 2); sun.position.set(10, 20, 10); s.add(sun);
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), lam(0x6a9a50)); gr.rotation.x = -Math.PI / 2; s.add(gr); const mt = himalaya({ h: 26, seed: 6, peaks: [{ x: -20, h: 34, r: 20 }] }); mt.position.set(0, -2, -150); s.add(mt);
  const pg = pagoda({ s: 1.2 }); pg.position.set(-9, 0, -26); s.add(pg); const tw = town({ n: 120, w: 90, d: 20, seed: 9 }); tw.position.set(0, 0, -40); s.add(tw);
  const guns = [], smoke = [], smM = new THREE.SpriteMaterial({ map: softTex('#f4f4f4'), color: 0xf2f2f2, transparent: true, opacity: 0.9, depthWrite: false });
  for (let k = 0; k < 3; k++) { const g = new THREE.Group(); const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 3, 16), std(0x2a2e2a, { metal: 0.6, rough: 0.4 })); barrel.rotation.z = Math.PI / 2 - 0.35; barrel.position.y = 1.2; g.add(barrel);
    for (const z of [-0.6, 0.6]) { const wh = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.1, 8, 24), lam(0x4a3020)); wh.position.set(-0.4, 0.6, z); g.add(wh); } g.position.set(-5 + k * 5, 0, -6 - k * 2); g.rotation.y = 0.6; s.add(g); guns.push(g);
    const pf = []; for (let j = 0; j < 12; j++) { const sp = new THREE.Sprite(smM.clone()); sp.visible = false; s.add(sp); pf.push(sp); } smoke.push(pf); }
  const c = cam(38); return { s, c, update(t) { const lt = t - CUES.FUL; c.position.set(mix(6, 3, E.dolly(prog(lt, 0, 3))), 3.2, mix(12, 10, E.dolly(prog(lt, 0, 3)))); c.lookAt(-2, 2, -10);
    guns.forEach((g, k) => { const bt = t - CUES.CANNON[k]; const muzzle = g.localToWorld(new THREE.Vector3(1.3, 1.75, 0)); smoke[k].forEach((sp, j) => { const a = bt - j * 0.02; sp.visible = a > 0; if (a > 0) { sp.position.copy(muzzle).add(new THREE.Vector3(a * (2 + j * 0.3), a * (1 + j * 0.15), -a * 0.5)); sp.scale.setScalar(0.6 + a * (2.5 + j * 0.2)); sp.material.opacity = 0.85 * clamp(1 - a / 2.4); } }); g.position.x = -5 + k * 5 - (bt > 0 && bt < 0.25 ? Math.sin(bt / 0.25 * Math.PI) * 0.3 : 0); }); },
    ov(t) { moonStrip(7, t, clamp((t - CUES.FUL) * 3)); scrim(t, CUES.FUL + 0.15, CUES.ASHT, 1500, 0.45); frag('फूलपाती', t, CUES.FUL + 0.2, CUES.ASHT - 0.1, W / 2, 1560, 110, { accent: REDC }); frag('गोरखाबाट हनुमानढोका', t, CUES.FUL + 0.8, CUES.ASHT - 0.1, W / 2, 1660, 58, { weight: 500 }); } };
}, { tr: 'pixel' });

// 9. DAY 8 + 9: the night of Kalaratri at Taleju, then the doors that open only once a year
shot(CUES.ASHT, CUES.TIKA, () => {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x05060c); s.fog = new THREE.Fog(0x05060c, 20, 60); s.add(new THREE.AmbientLight(0x1a2040, 1.2)); const moonL = new THREE.DirectionalLight(0x8aa0d8, 0.8); moonL.position.set(-8, 10, 4); s.add(moonL);
  const pg = pagoda({ s: 1.4, tiers: 3, night: true }); s.add(pg); const lamps = []; for (let k = 0; k < 18; k++) { const d = diyo(); const a = k / 18 * Math.PI * 2; d.position.set(Math.cos(a) * 7.5, 0.05, Math.sin(a) * 7.5); d.scale.setScalar(0.8); s.add(d); lamps.push(d); }
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), lam(0x141018)); gr.rotation.x = -Math.PI / 2; s.add(gr);
  const doorM = std(0x5a2a14, { rough: 0.7 }), doors = [-1, 1].map(sd => { const p = new THREE.Group(); const d = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.08), doorM); d.position.x = sd * 0.55; p.add(d); p.position.set(sd * 1.1, 4.2, 3.0); s.add(p); return p; });
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), basic(0xffc060)); inner.position.set(0, 5.3, 2.96); s.add(inner); const innerL = new THREE.PointLight(0xffb050, 0, 20, 1.5); innerL.position.set(0, 5.3, 4.5); s.add(innerL);
  const c = cam(40); return { s, c, update(t) { const nav = t >= CUES.NAVM, lt = t - CUES.ASHT; lamps.forEach((d, i) => d.userData.update(t + i, clamp((lt - i * 0.04) * 3)));
    const open = nav ? E.inOut(prog(t, CUES.NAVM + 0.3, CUES.NAVM + 1.6)) : 0; doors.forEach((p, i) => { p.rotation.y = (i ? -1 : 1) * open * 1.7; }); innerL.intensity = open * 40; inner.visible = open > 0.01;
    if (!nav) { c.position.set(Math.sin(lt * 0.3) * 4 + 8, 7, 36); c.lookAt(0, 9, 0); } else { const k = E.dolly(prog(t, CUES.NAVM, CUES.TIKA)); c.position.set(0, 6, mix(26, 18, k)); c.lookAt(0, 6.5, 0); } },
    ov(t) { const nav = t >= CUES.NAVM; moonStrip(nav ? 9 : 8, t, 1); scrim(t, CUES.ASHT, CUES.TIKA, 1500, 0.45);
      frag('महाअष्टमी', t, CUES.ASHT + 0.1, CUES.NAVM - 0.1, W / 2, 1560, 110, { accent: REDC }); frag('कालरात्रिको पूजा', t, CUES.ASHT + 0.7, CUES.NAVM - 0.1, W / 2, 1660, 58, { weight: 500 });
      frag('महानवमी', t, CUES.NAVM + 0.1, CUES.TIKA - 0.1, W / 2, 1560, 110, { accent: REDC }); frag('वर्षमा एक दिन खुल्ने तलेजु', t, CUES.NAVM + 0.7, CUES.TIKA - 0.1, W / 2, 1660, 58, { weight: 500 }); } };
}, { tr: 'iris' });

// 10. DAY 10 · VIJAYA DASHAMI: the thali, the blessing (a stem with a rotating slot: "...जस्तो ...")
const BLESS = [['अश्वत्थामा जस्तो', 'आयु'], ['दशरथ जस्तो', 'धन'], ['राम जस्तो', 'विजय'], ['कर्ण जस्तो', 'दान'], ['बलराम जस्तो', 'बल'], ['विदुर जस्तो', 'ज्ञान']];
shot(CUES.TIKA, CUES.KOJA, () => {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x1a0608); s.environment = env; s.add(new THREE.AmbientLight(0x3a1810, 1)); const L = new THREE.DirectionalLight(0xfff0d8, 2.4); L.position.set(4, 8, 6); s.add(L); const L2 = new THREE.PointLight(0xff6040, 20, 20); L2.position.set(-4, 2, -3); s.add(L2);
  const th = thali({ grains: 2400 }); s.add(th); const cloth = new THREE.Mesh(new THREE.CircleGeometry(30, 64), lam(0x6a0c18)); cloth.rotation.x = -Math.PI / 2; cloth.position.y = -0.02; s.add(cloth);
  const c = cam(34); return { s, c, update(t) { const lt = t - CUES.TIKA, a = 0.6 + lt * 0.09; c.position.set(Math.sin(a) * 8.5, mix(6.5, 4.8, E.dolly(prog(lt, 0, 6.7))), Math.cos(a) * 8.5); c.lookAt(-0.2, 0.4, 0); th.userData.diyo.userData.update(t, 1); th.userData.jamara.userData.update(t, 1); },
    ov(t) { moonStrip(10, t, 1); scrim(t, CUES.TIKA, CUES.KOJA, 1440, 0.5); frag('विजया दशमी', t, CUES.TIKA + 0.1, CUES.TIKA + 2.1, W / 2, 1600, 120, { accent: REDC }); frag('रातो टीका, जमरा र आशीर्वाद', t, CUES.TIKA + 0.7, CUES.TIKA + 2.1, W / 2, 1700, 54, { weight: 500 });
      const t0 = CUES.TIKA + 2.25, per = (CUES.KOJA - 0.15 - t0) / BLESS.length; if (t >= t0) { frag('जस्तो…', t, t0, CUES.KOJA - 0.15, W / 2, 1480, 1, { alpha: 0 }); const i = Math.min(BLESS.length - 1, Math.floor((t - t0) / per)), s0 = t0 + i * per;
        frag(BLESS[i][0], t, s0, s0 + per - 0.12, W / 2, 1570, 66, { weight: 500 }); frag(BLESS[i][1], t, s0 + 0.12, s0 + per - 0.12, W / 2, 1700, 130, { accent: REDC, col: GOLD }); } } };
}, { tr: 'cut' });

// 11. DAY 15 · KOJAGRAT PURNIMA: the full moon over a lit town; "को जागर्ति?" (who is awake?)
shot(CUES.KOJA, CUES.LIFE, () => {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x04060e); s.add(new THREE.AmbientLight(0x2a3050, 1.3)); const mL = new THREE.DirectionalLight(0xbfd0ff, 0.9); mL.position.set(0, 10, -10); s.add(mL);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 64, 48), moonMat(0)); moon.position.set(0, 18, -70); s.add(moon); const tw = town({ n: 260, w: 110, d: 30, seed: 12, night: true }); tw.position.set(0, -2, -30); s.add(tw);
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), lam(0x0a0a14)); gr.rotation.x = -Math.PI / 2; gr.position.y = -2; s.add(gr);
  const c = cam(40); return { s, c, update(t) { const lt = t - CUES.KOJA; moon.position.y = mix(12, 18, E.out(prog(lt, 0, 2.9))); c.position.set(0, 2, 14); c.lookAt(0, 9, -40); },
    ov(t) { moonStrip(15, t, 1); scrim(t, CUES.KOJA, CUES.LIFE, 1500, 0.45); frag('कोजाग्रत पूर्णिमा', t, CUES.KOJA + 0.1, CUES.LIFE - 0.1, W / 2, 1560, 96, { accent: REDC }); frag('“को जागर्ति?”', t, CUES.KOJA + 0.8, CUES.LIFE - 0.1, W / 2, 1680, 80, { col: GOLD });
      frag('लक्ष्मी सोध्छिन्: को जाग्दैछ?', t, CUES.KOJA + 1.4, CUES.LIFE - 0.1, W / 2, 1770, 44, { weight: 500 }); } };
}, { tr: 'pixel' });

// 12. LIFE: four vignettes, two beats each: ping, changa, the road home, the elders
shot(CUES.LIFE, CUES.POV, () => {
  const s = new THREE.Scene(); s.add(skyDome([[0, '#2b3d7a'], [0.45, '#d8704a'], [0.8, '#ffc27a'], [1, '#ffe2b0']])); s.fog = new THREE.Fog(0xf0b080, 30, 150); s.add(new THREE.HemisphereLight(0xffe0c0, 0x403040, 1.4)); const sun = new THREE.DirectionalLight(0xffc890, 2.2); sun.position.set(-20, 8, -30); s.add(sun);
  const gr = hills({ w: 300, d: 200, h: 1.2, c0: 0x8a6a2a, c1: 0xc8a040 }); gr.position.y = -1.3; s.add(gr); const mt = himalaya({ h: 30, seed: 11, rock: 0x7a5a6a, rockD: 0x4a3a50, snowC: 0xffd8c0, peaks: [{ x: 10, h: 40, r: 18 }] }); mt.position.set(0, -4, -160); s.add(mt);
  const pg = ping({ h: 10 }); pg.position.set(0, 0, 0); s.add(pg); const ks = []; const cols = [['#d7192a', '#f2b733'], ['#1f5fd0', '#ffffff'], ['#2fae4a', '#ffd400']]; for (let i = 0; i < 16; i++) { const k = kite(...cols[i % 3]); k.position.set((hash(i, 1) - 0.5) * 22, 8 + hash(i, 2) * 18, -4 - hash(i, 3) * 26); k.scale.setScalar(2.2); s.add(k); ks.push(k); }
  const bus = new THREE.Group(); { const b = new THREE.Mesh(new THREE.BoxGeometry(6, 2.2, 2.2), std(0x1f8a6a, { rough: 0.5 })); b.position.y = 1.6; bus.add(b); const st = new THREE.Mesh(new THREE.BoxGeometry(6.02, 0.25, 2.22), lam(0xf2b733)); st.position.y = 1.2; bus.add(st);
    for (let i = 0; i < 5; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.7), lam(0x9ad0f0)); w.position.set(-2.2 + i * 1.1, 2.0, 1.11); bus.add(w); } for (const x of [-2, 2]) for (const z of [-1.1, 1.1]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16), lam(0x111111)); wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.5, z); bus.add(wh); }
    for (let i = 0; i < 9; i++) { const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.4, 2, 6), lam([0xc8102e, 0xffd400, 0x1f5fd0, 0xffffff][i % 4])); p.position.set(-2.6 + i * 0.65, 3.1, (i % 2 - 0.5) * 0.8); bus.add(p); } }
  bus.position.set(0, 0, 4); s.add(bus);
  const elder = new THREE.Group(); { const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.0, 4, 10), lam(0xf4f0e6)); body.position.y = 1.1; elder.add(body); const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 14), lam(0x8a5a3a)); head.position.y = 2.2; elder.add(head); const topi = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.28, 16), lam(0x3a2a60)); topi.position.y = 2.55; elder.add(topi); }
  elder.position.set(-1.2, 0, 2); s.add(elder); const kidsG = new THREE.Group(); for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.6 + i * 0.12, 4, 8), lam([0xc8102e, 0xffd400, 0x2fae4a, 0x1f5fd0][i])); p.position.set(0.6 + i * 0.9, 0.7 + i * 0.06, 2.3); kidsG.add(p); const h = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 10), lam(0x8a5a3a)); h.position.set(0.6 + i * 0.9, 1.5 + i * 0.12, 2.3); kidsG.add(h); const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), basic(RED)); dot.position.set(0.6 + i * 0.9, 1.6 + i * 0.12, 2.53); kidsG.add(dot); } s.add(kidsG);
  const c = cam(40); return { s, c, update(t) { const lt = t - CUES.LIFE, i = Math.min(3, Math.floor(lt / (2 * bC))), lt2 = lt - i * 2 * bC;
    pg.visible = i === 0; ks.forEach(k => k.visible = i === 1); bus.visible = i === 2; elder.visible = kidsG.visible = i === 3; pg.userData.set(Math.sin(lt * Math.PI * 2 / (4 * bC)) * 0.8);
    ks.forEach((k, j) => { k.userData.tail(t + j); k.rotation.set(0.1, Math.sin(t + j) * 0.3, Math.sin(t * 1.2 + j) * 0.2); });
    if (i === 0) { c.position.set(16, 5, 24); c.lookAt(0, 5.5, 0); } else if (i === 1) { c.position.set(0, 2, 10); c.lookAt(0, 16, -20); } else if (i === 2) { bus.position.x = mix(-6, 6, lt2 / (2 * bC)); c.position.set(0, 3.5, 24); c.lookAt(0, 2.6, 0); } else { c.position.set(1.2, 1.9, 9.5); c.lookAt(1.0, 1.2, 2); } },
    ov(t) { const lt = t - CUES.LIFE, i = Math.min(3, Math.floor(lt / (2 * bC))), s0 = CUES.LIFE + i * 2 * bC; const L = [['पिङ', 'बाँसको, गाउँ मिलेर'], ['चङ्गा', 'हरेक छतबाट'], ['घर फर्किने बाटो', 'सिङ्गो देश घरतिर'], ['ठूलाबडाको आशीर्वाद', 'पालैपालो']][i];
      scrim(t, CUES.LIFE, CUES.POV, 1520, 0.4); frag(L[0], t, s0 + 0.05, s0 + 2 * bC - 0.1, W / 2, 1620, 120, { accent: REDC, maxW: 980 }); frag(L[1], t, s0 + 0.3, s0 + 2 * bC - 0.1, W / 2, 1720, 52, { weight: 500 }); } };
}, { tr: 'whip' });

// 13. POV: the thali rises to you; a thumb of red tika comes at the lens (STAMP) and the frame floods red
shot(CUES.POV, CUES.WISH, () => {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x140806); s.environment = env; s.add(new THREE.AmbientLight(0x4a2010, 1)); const L = new THREE.DirectionalLight(0xffe8c8, 2.4); L.position.set(2, 6, 6); s.add(L);
  const bokeh = []; const bm = new THREE.SpriteMaterial({ map: softTex('#ffb060'), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }); for (let i = 0; i < 30; i++) { const b = new THREE.Sprite(bm); b.position.set((hash(i, 1) - 0.5) * 30, (hash(i, 2) - 0.5) * 40, -20 - hash(i, 3) * 10); b.scale.setScalar(2 + hash(i, 4) * 4); s.add(b); bokeh.push(b); }
  const th = thali({ grains: 1800 }); th.position.set(0, -4.5, -2); th.rotation.x = 0.5; s.add(th);
  const N = 900, gr = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.03, 0.08, 1, 4), lam(0xffffff), N), D = []; const cc = new THREE.Color(); for (let i = 0; i < N; i++) { D.push({ a: hash(i, 1) * 6.28, r: Math.sqrt(hash(i, 2)) * 0.5, z: hash(i, 3) * 0.3, rot: hash(i, 4) * 6 }); cc.setHSL(0.985 + hash(i, 5) * 0.02, 0.85, 0.3 + hash(i, 6) * 0.16); gr.setColorAt(i, cc); } s.add(gr);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const c = cam(40); return { s, c, update(t) { const k = E.contact(prog(t, CUES.POV + 0.4, CUES.STAMP)); th.position.y = mix(-6, -4.0, E.out(prog(t, CUES.POV, CUES.POV + 1.5))); c.position.set(0, 0, 8); c.lookAt(0, -0.5, 0);
    const cz = mix(-2, 7.6, k), cy = mix(-3.3, 0, k); D.forEach((d, i) => { e.set(d.rot, d.rot * 2, 0); q.setFromEuler(e); v.set(Math.cos(d.a) * d.r * (1 + k * 0.4), cy + Math.sin(d.a) * d.r * (1 + k * 0.4), cz + d.z); m4.compose(v, q, one); gr.setMatrixAt(i, m4); }); gr.instanceMatrix.needsUpdate = true; gr.visible = t < CUES.STAMP; },
    ov(t) { scrim(t, CUES.POV, CUES.STAMP - 0.2, 1500, 0.4); frag('र यो वर्ष', t, CUES.POV + 0.1, CUES.STAMP - 0.2, W / 2, 1560, 84); frag('टीका तपाईंलाई', t, CUES.POV + 0.9, CUES.STAMP - 0.2, W / 2, 1670, 96, { accent: REDC });
      if (t >= CUES.STAMP) { const k = E.out(prog(t, CUES.STAMP, CUES.STAMP + 0.5)); cx.save(); cx.fillStyle = REDC; cx.beginPath(); cx.arc(W / 2, H * 0.47, k * H * 1.2, 0, 7); cx.fill(); grains(t, k); cx.restore(); } } };
});
function grains(t, k) { const R = rng(31); for (let i = 0; i < 1400; i++) { const a = R() * 6.28, d = Math.sqrt(R()) * k * 1400, x = W / 2 + Math.cos(a) * d, y = H * 0.47 + Math.sin(a) * d * 1.4; cx.save(); cx.translate(x, y); cx.rotate(R() * 3); const L = 14 + R() * 8; cx.fillStyle = R() < 0.06 ? '#f6e8d4' : `hsl(${352 + R() * 8},${80 + R() * 12}%,${34 + R() * 20}%)`; cx.beginPath(); cx.ellipse(0, 0, L / 2, L * 0.22, 0, 0, 7); cx.fill(); cx.restore(); } }

// 14. THE WISH: red field of tika rice, jamara rising in 3D, the cut kite drifts down, is caught and flies again
shot(CUES.WISH, CUES.END + 1.4, () => {
  const s = new THREE.Scene(); s.background = null; s.add(new THREE.AmbientLight(0xffe0d0, 1.4)); const L = new THREE.DirectionalLight(0xfff0e0, 2); L.position.set(3, 6, 8); s.add(L);
  const jl = jamara({ n: 420, r: 2.2, h: 9, seed: 7 }), jr = jamara({ n: 420, r: 2.2, h: 9, seed: 8 }); jl.position.set(-5.4, -11, 0); jr.position.set(5.4, -11, 0); s.add(jl, jr);
  const kt = kite('#d7192a', '#f2b733'); kt.scale.setScalar(1.1); s.add(kt); const str = stringLine(0x3a0a10); s.add(str);
  const c = cam(40); c.position.set(0, 0, 18); c.lookAt(0, 0, 0); return { s, c, bg: true, update(t) { const lt = t - CUES.WISH; jl.userData.update(t, E.out(prog(lt, 0, 1.8))); jr.userData.update(t + 1, E.out(prog(lt, 0.15, 1.95)));
    const tc = 4.4; let kp; if (lt < tc) { const u = E.out(prog(lt, 0, tc)); kp = new THREE.Vector3(mix(3, -0.6, u) + Math.sin(lt * 2) * 0.8 * (1 - u), mix(11, -3.6, u), 0); kt.rotation.set(0, 0, Math.sin(lt * 2.4) * 0.6 * (1 - u) + 2.4 * (1 - u)); }
    else { const u = E.in(prog(lt, tc + 0.6, tc + 3.6)); kp = new THREE.Vector3(mix(-0.6, 3.2, u) + Math.sin(lt * 1.6) * 0.2, mix(-3.6, 12, u), 0); kt.rotation.set(0, 0, Math.sin(lt * 2) * 0.12); }
    kt.position.copy(kp); kt.userData.tail(t); str.visible = lt > tc; str.userData.set(kp, new THREE.Vector3(-1.2, -14, 2), 1.2); },
    ov(t) { const lt = t - CUES.WISH; frag('विजया दशमी २०८३', t, CUES.WISH + 0.15, CUES.END + 2, W / 2, 470, 120, { col: '#fff6e4', accent: GOLD, maxW: 980 }); frag('को हार्दिक मंगलमय शुभकामना', t, CUES.WISH + 0.7, CUES.END + 2, W / 2, 570, 60, { weight: 500, col: PAPER, maxW: 980 });
      frag('जे चुँडियो', t, CUES.WISH + 2.4, CUES.END + 2, W / 2, 1180, 78); frag('त्यो फेरि उडोस्', t, CUES.WISH + 4.6, CUES.END + 2, W / 2, 1290, 96, { accent: GOLD });
      frag('— निकित हमाल', t, CUES.WISH + 6.8, CUES.END + 2, W / 2, 1760, 56, { weight: 600, col: PAPER }); } };
}, { tr: 'cut' });

// ---------- frame assembly
function drawRice(t) { cx.fillStyle = REDC; cx.fillRect(0, 0, W, H); const g = cx.createRadialGradient(W / 2, H * 0.32, 50, W / 2, H * 0.5, H * 0.8); g.addColorStop(0, 'rgba(255,190,120,0.25)'); g.addColorStop(1, 'rgba(60,0,10,0.35)'); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  const R = rng(77); for (let i = 0; i < 2200; i++) { const x = R() * W, y = R() * H; cx.save(); cx.translate(x, y); cx.rotate(R() * 3); const L = 12 + R() * 7; cx.fillStyle = R() < 0.05 ? 'rgba(246,232,212,0.9)' : `hsla(${350 + R() * 10},${78 + R() * 14}%,${32 + R() * 22}%,0.9)`; cx.beginPath(); cx.ellipse(0, 0, L / 2, L * 0.22, 0, 0, 7); cx.fill(); cx.restore(); } }
let built = false;
function renderShot(sh, t) { if (!sh.s) sh.s = sh.build(); const st = sh.s; st.update(t); r.render(st.s, st.c); return st; }
function frame(f) { const t = f / FPS; let i = SH.length - 1; while (i > 0 && t < SH[i].a) i--; const sh = SH[i], tr = sh.o.tr || 'cut', td = { iris: 0.55, pixel: 0.45, whip: 0.35, cut: 0 }[tr];
  cx.clearRect(0, 0, W, H); cx.fillStyle = INK; cx.fillRect(0, 0, W, H);
  const inTr = i > 0 && td > 0 && t < sh.a + td;
  if (inTr) { const p = SH[i - 1]; renderShot(p, t); pcx.clearRect(0, 0, W, H); if (p.s.bg) drawRiceTo(pcx); pcx.drawImage(glc, 0, 0); }
  if (sh.s?.bg || (!sh.s && i === SH.length - 1)) drawRice(t); const st = renderShot(sh, t); cx.drawImage(glc, 0, 0);
  if (inTr) { const k = E.inOut(clamp((t - sh.a) / td)); cx.save();
    if (tr === 'iris') { cx.beginPath(); cx.rect(0, 0, W, H); cx.arc(W / 2, H * 0.45, k * H * 0.75, 0, Math.PI * 2, true); cx.clip('evenodd'); cx.drawImage(prevC, 0, 0); cx.restore(); cx.save(); cx.strokeStyle = REDC; cx.lineWidth = 14 * (1 - k); cx.beginPath(); cx.arc(W / 2, H * 0.45, k * H * 0.75, 0, 7); cx.stroke(); }
    else if (tr === 'pixel') { const B = 24; for (let y = 0; y < H; y += B) for (let x = 0; x < W; x += B) { if (hash(x / B, y / B, 5) > k) cx.drawImage(prevC, x, y, B, B, x, y, B, B); } }
    else if (tr === 'whip') { cx.globalAlpha = 1 - k; cx.drawImage(prevC, -k * W * 0.6, 0); cx.globalAlpha = 1; cx.drawImage(glc, (1 - k) * W * 0.4, 0); }
    cx.restore(); if (SH[i - 1].s.ov) { cx.save(); cx.globalAlpha = 1 - k; SH[i - 1].s.ov(t); cx.restore(); } }
  if (st.ov) st.ov(t);
  // global film grain at ~1.5% (cinetic: grain is global or absent) and the open/close fades
  const a = Math.max(1 - f / 6, prog(f, TOTAL - 20, TOTAL)); if (a > 0) { cx.fillStyle = `rgba(0,0,0,${a})`; cx.fillRect(0, 0, W, H); } }
function drawRiceTo(x2) { const keep = cx; x2.fillStyle = REDC; x2.fillRect(0, 0, W, H); }
async function load() { NEPAL = await (await fetch('../lib/nepal.json')).json(); for (const sh of SH) sh.s = sh.build(); built = true; }
window.FILM = { W, H, FPS, total: TOTAL, frame, load, CUES };
