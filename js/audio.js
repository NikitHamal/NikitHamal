// Hanomi audio engine: every sound is synthesized with the Web Audio API.
// No assets, no libraries. Nothing touches browser globals until init().

let ctx = null;
let master = null, comp = null, sfxBus = null, musicBus = null, ambBus = null;
let reverb = null, reverbOut = null;
let noiseBuf = null;
let voices = 0;
const MAX_VOICES = 40;
const lastPlay = Object.create(null);
const vol = { master: 0.8, sfx: 0.8, music: 0.55 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

// ---------------------------------------------------------------- graph setup
function buildGraph() {
  master = ctx.createGain();
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 12;
  comp.ratio.value = 3;
  comp.attack.value = 0.01;
  comp.release.value = 0.25;
  master.connect(comp);
  comp.connect(ctx.destination);

  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  ambBus = ctx.createGain();
  sfxBus.connect(master);
  musicBus.connect(master);
  ambBus.connect(sfxBus);

  // shared white-noise buffer (2s)
  const sr = ctx.sampleRate;
  noiseBuf = ctx.createBuffer(1, sr * 2, sr);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  // generated stereo impulse (~2.2s, darkening exponential tail)
  const len = Math.floor(sr * 2.2);
  const ir = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const x = i / len;
      const k = 0.25 + 0.7 * x; // more lowpass as tail decays
      lp += (1 - k) * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.pow(1 - x, 3.2) * (i < sr * 0.012 ? i / (sr * 0.012) : 1);
    }
  }
  reverb = ctx.createConvolver();
  reverb.buffer = ir;
  reverbOut = ctx.createGain();
  reverbOut.gain.value = 0.32;
  reverb.connect(reverbOut);
  reverbOut.connect(master);
  applyVolume(true);
}

function applyVolume(instant) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const set = (p, v) => (instant ? p.setValueAtTime(v, t) : p.setTargetAtTime(v, t, 0.08));
  set(master.gain, vol.master * 0.9);
  set(sfxBus.gain, vol.sfx * 0.9);
  set(musicBus.gain, vol.music * 0.9);
}

// ---------------------------------------------------------------- primitives
function cleanup(src, nodes) {
  src.onended = () => {
    try { src.disconnect(); for (const n of nodes) n.disconnect(); } catch (e) { /* ignore */ }
  };
}

// oscillator tone with exp decay. o: {type,f,f2,fd,t,a,d,v,lp,lp2,q,vib:{rate,depth}}
function tone(out, o) {
  const t = o.t, a = num(o.a, 0.005), d = o.d;
  const osc = ctx.createOscillator();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + num(o.fd, a + d));
  if (o.det) osc.detune.value = o.det;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.v, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  const nodes = [g];
  let node = osc;
  if (o.lp) {
    const f = ctx.createBiquadFilter();
    f.type = o.ft || 'lowpass';
    f.frequency.setValueAtTime(o.lp, t);
    if (o.lp2) f.frequency.exponentialRampToValueAtTime(o.lp2, t + a + d);
    f.Q.value = num(o.q, 0.7);
    osc.connect(f);
    node = f;
    nodes.push(f);
  }
  let lfo = null;
  if (o.vib) {
    lfo = ctx.createOscillator();
    lfo.frequency.value = o.vib.rate;
    const lg = ctx.createGain();
    lg.gain.value = o.vib.depth;
    lfo.connect(lg);
    lg.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + a + d + 0.05);
    cleanup(lfo, [lg]);
  }
  node.connect(g);
  g.connect(out);
  osc.start(t);
  osc.stop(t + a + d + 0.05);
  cleanup(osc, nodes);
  return osc;
}

// filtered noise burst. o: {t,a,d,v,type,f,f2,q}
function nz(out, o) {
  const t = o.t, a = num(o.a, 0.002), d = o.d;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime(o.f, t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + a + d);
  f.Q.value = num(o.q, 1);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.v, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  src.connect(f);
  f.connect(g);
  g.connect(out);
  const dur = a + d + 0.05;
  src.start(t, Math.random() * Math.max(0, 1.9 - dur), dur);
  cleanup(src, [f, g]);
  return src;
}

// Karplus-Strong koto pluck, pre-rendered per midi note and cached.
const pluckCache = new Map();
function pluckBuf(midi) {
  midi = Math.round(midi);
  let e = pluckCache.get(midi);
  if (e) return e;
  const sr = ctx.sampleRate;
  const f = mtof(midi);
  const N = Math.max(2, Math.round(sr / f - 0.5));
  const actual = sr / (N + 0.5);
  const dur = midi < 50 ? 3.2 : midi < 70 ? 2.6 : 1.9;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  // excitation: softened noise with pluck-position comb (koto-ish nasal attack)
  let lp = 0;
  const ex = new Float32Array(N);
  for (let i = 0; i < N; i++) { lp += 0.55 * ((Math.random() * 2 - 1) - lp); ex[i] = lp; }
  const pp = Math.max(1, Math.floor(N * 0.18));
  for (let i = 0; i < N; i++) d[i] = ex[i] - 0.6 * ex[(i + pp) % N];
  const rho = Math.pow(0.001, 1 / (dur * actual * 1.1));
  d[N] = d[0] * rho;
  for (let i = N + 1; i < len; i++) d[i] = rho * 0.5 * (d[i - N] + d[i - N - 1]);
  let peak = 0;
  const scan = Math.min(len, N * 6);
  for (let i = 0; i < scan; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; }
  const norm = peak > 0 ? 0.9 / peak : 1;
  const fade = Math.floor(sr * 0.05);
  for (let i = 0; i < len; i++) {
    let k = norm;
    if (i < 16) k *= i / 16;
    if (i > len - fade) k *= (len - i) / fade;
    d[i] *= k;
  }
  e = { buf, rate: f / actual };
  pluckCache.set(midi, e);
  return e;
}

function koto(out, midi, t, v, pitch = 1, bright = 1) {
  const e = pluckBuf(midi);
  const src = ctx.createBufferSource();
  src.buffer = e.buf;
  src.playbackRate.value = e.rate * pitch;
  const g = ctx.createGain();
  g.gain.value = v;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = Math.min(12000, mtof(midi) * 7 * bright + 600);
  src.connect(f);
  f.connect(g);
  g.connect(out);
  src.start(t);
  cleanup(src, [f, g]);
  return src;
}

function flute(out, midi, t, dur, v) {
  const f = mtof(midi);
  const end = t + dur;
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  o1.type = 'sine';
  o2.type = 'triangle';
  o2.detune.value = 4;
  for (const o of [o1, o2]) {
    o.frequency.setValueAtTime(f * 0.982, t);
    o.frequency.linearRampToValueAtTime(f, t + 0.09);
  }
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = f * 2.2;
  const vib = ctx.createOscillator();
  vib.frequency.value = 4.8 + Math.random() * 0.6;
  const vg = ctx.createGain();
  vg.gain.setValueAtTime(0, t);
  vg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.7, dur * 0.6));
  vib.connect(vg);
  vg.connect(o1.frequency);
  vg.connect(o2.frequency);
  const mix = ctx.createGain();
  mix.gain.value = 0.5;
  o2.connect(lp);
  lp.connect(mix);
  o1.connect(mix);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(v, t + 0.14);
  g.gain.linearRampToValueAtTime(v * 0.8, t + Math.max(0.15, dur * 0.7));
  g.gain.setTargetAtTime(0.0001, end, 0.12);
  mix.connect(g);
  // breath
  const n = ctx.createBufferSource();
  n.buffer = noiseBuf;
  n.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = f * 2;
  bp.Q.value = 1.2;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.0001, t);
  bg.gain.linearRampToValueAtTime(v * 0.35, t + 0.05);
  bg.gain.linearRampToValueAtTime(v * 0.09, t + 0.25);
  bg.gain.setTargetAtTime(0.0001, end, 0.1);
  n.connect(bp);
  bp.connect(bg);
  bg.connect(out);
  g.connect(out);
  const stop = end + 0.8;
  for (const s of [o1, o2, vib, n]) { s.start(t); s.stop(stop); }
  cleanup(o1, [mix, g]);
  cleanup(o2, [lp]);
  cleanup(vib, [vg]);
  cleanup(n, [bp, bg]);
}

function pad(out, midis, t, dur, v) {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 650;
  lp.Q.value = 0.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(v, t + 1.6);
  g.gain.setValueAtTime(v, t + Math.max(1.6, dur));
  g.gain.linearRampToValueAtTime(0.0001, t + Math.max(1.6, dur) + 1.8);
  lp.connect(g);
  g.connect(out);
  const stop = t + Math.max(1.6, dur) + 1.9;
  let first = null;
  for (const m of midis) {
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m);
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(stop);
      if (!first) { first = o; cleanup(o, [lp, g]); } else cleanup(o, []);
    }
  }
}

function taiko(out, t, v, big = true, scale = 1) {
  v *= scale;
  const f0 = big ? 115 : 175;
  tone(out, { t, f: f0, f2: f0 * 0.45, fd: 0.25, a: 0.003, d: big ? 0.6 : 0.3, v: v });
  tone(out, { t, f: f0 * 1.6, f2: f0 * 0.8, fd: 0.1, a: 0.002, d: 0.12, v: v * 0.25 });
  nz(out, { t, type: 'lowpass', f: big ? 500 : 900, d: 0.08, v: v * 0.5 });
}

// ---------------------------------------------------------------- SFX
const YO = [0, 2, 5, 7, 9];
const rnd = (a, b) => a + Math.random() * (b - a);

// each: [fn(out, t, p) -> duration, reverbSend]
const SFX = {
  chop: [(o, t, p) => {
    tone(o, { t, type: 'triangle', f: 230 * p, f2: 140 * p, d: 0.09, v: 0.38 });
    tone(o, { t, f: 520 * p, f2: 300 * p, d: 0.04, v: 0.16 });
    nz(o, { t, f: 1700 * p, q: 1.2, d: 0.08, v: 0.22 });
    return 0.15;
  }, 0.08],
  mine: [(o, t, p) => {
    tone(o, { t, f: 2350 * p, d: 0.14, v: 0.1 });
    tone(o, { t, f: 3650 * p, d: 0.08, v: 0.05 });
    nz(o, { t, type: 'highpass', f: 3000, d: 0.05, v: 0.16 });
    nz(o, { t, f: 850 * p, q: 0.9, d: 0.1, v: 0.16 });
    return 0.2;
  }, 0.12],
  break: [(o, t, p) => {
    nz(o, { t, type: 'lowpass', f: 2200 * p, f2: 300, d: 0.35, v: 0.3 });
    for (let i = 0; i < 5; i++) nz(o, { t: t + i * 0.045 + rnd(0, 0.02), f: rnd(500, 2200) * p, q: 2, d: 0.05, v: 0.14 });
    tone(o, { t, f: 140 * p, f2: 60, d: 0.18, v: 0.25 });
    return 0.45;
  }, 0.1],
  hit: [(o, t, p) => {
    tone(o, { t, f: 165 * p, f2: 70 * p, d: 0.12, v: 0.42 });
    nz(o, { t, type: 'lowpass', f: 900, d: 0.07, v: 0.18 });
    return 0.18;
  }, 0.03],
  hurt: [(o, t, p) => {
    tone(o, { t, f: 125 * p, f2: 50, d: 0.2, v: 0.45 });
    tone(o, { t: t + 0.02, type: 'triangle', f: 620 * p, f2: 300 * p, d: 0.13, v: 0.11 });
    nz(o, { t, type: 'lowpass', f: 600, d: 0.08, v: 0.15 });
    return 0.25;
  }, 0.04],
  swing: [(o, t, p) => {
    nz(o, { t, f: 600 * p, f2: 2400 * p, q: 1.6, a: 0.06, d: 0.13, v: 0.32 });
    return 0.22;
  }, 0.03],
  pickup: [(o, t, p) => {
    tone(o, { t, type: 'triangle', f: 880 * p, d: 0.07, v: 0.11 });
    tone(o, { t, f: 880 * p, d: 0.07, v: 0.06 });
    tone(o, { t: t + 0.07, type: 'triangle', f: 1320 * p, d: 0.16, v: 0.11 });
    tone(o, { t: t + 0.07, f: 1320 * p, d: 0.16, v: 0.06 });
    return 0.28;
  }, 0.15],
  place: [(o, t, p) => {
    tone(o, { t, type: 'triangle', f: 310 * p, f2: 180 * p, d: 0.07, v: 0.32 });
    nz(o, { t, f: 1200 * p, q: 2, d: 0.04, v: 0.18 });
    return 0.12;
  }, 0.06],
  eat: [(o, t, p) => {
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.12 + rnd(0, 0.02);
      nz(o, { t: tt, f: rnd(1300, 2600) * p, q: 0.8, d: 0.06, v: 0.2 - i * 0.03 });
      nz(o, { t: tt, type: 'highpass', f: 4000, d: 0.03, v: 0.07 });
    }
    return 0.42;
  }, 0.02],
  splash: [(o, t, p) => {
    nz(o, { t, type: 'lowpass', f: 4200 * p, f2: 500, a: 0.01, d: 0.45, v: 0.3 });
    nz(o, { t: t + 0.05, f: 2600 * p, q: 0.8, d: 0.2, v: 0.12 });
    tone(o, { t: t + 0.02, f: 320 * p, f2: 900 * p, d: 0.08, v: 0.08 });
    tone(o, { t: t + 0.12, f: 450 * p, f2: 1200 * p, d: 0.06, v: 0.05 });
    return 0.55;
  }, 0.2],
  cast: [(o, t, p) => {
    nz(o, { t, f: 3200 * p, f2: 1100 * p, q: 6, a: 0.05, d: 0.3, v: 0.14 });
    tone(o, { t, f: 1900 * p, f2: 900 * p, a: 0.03, d: 0.28, v: 0.025 });
    return 0.4;
  }, 0.1],
  bite: [(o, t, p) => {
    tone(o, { t, f: 520 * p, f2: 170 * p, d: 0.1, v: 0.28 });
    nz(o, { t, type: 'lowpass', f: 1500, d: 0.06, v: 0.1 });
    tone(o, { t: t + 0.09, f: 2093 * p, a: 0.003, d: 0.6, v: 0.08 });
    tone(o, { t: t + 0.09, f: 2093 * 2.76 * p, a: 0.003, d: 0.25, v: 0.02 });
    return 0.75;
  }, 0.3],
  reel: [(o, t, p) => {
    for (let i = 0; i < 12; i++) {
      const tt = t + i * 0.026;
      nz(o, { t: tt, type: 'highpass', f: 3200, d: 0.012, v: 0.12 });
      tone(o, { t: tt, type: 'triangle', f: 1750 * p, d: 0.012, v: 0.04 });
    }
    return 0.36;
  }, 0.02],
  catch: [(o, t, p) => {
    [74, 78, 81, 86].forEach((m, i) => koto(o, m, t + i * 0.09, 0.32, p));
    return 1.6;
  }, 0.35],
  bark: [(o, t, p) => {
    tone(o, { t, type: 'sawtooth', f: 720 * p, f2: 380 * p, a: 0.008, d: 0.1, v: 0.16, lp: 1300, q: 4 });
    tone(o, { t, f: 540 * p, f2: 300 * p, a: 0.008, d: 0.1, v: 0.14 });
    nz(o, { t, f: 1100, q: 1.5, d: 0.04, v: 0.06 });
    return 0.16;
  }, 0.06],
  growl: [(o, t, p) => {
    tone(o, { t, type: 'sawtooth', f: 78 * p, f2: 62 * p, a: 0.12, d: 0.4, v: 0.16, lp: 380, q: 2, vib: { rate: 22, depth: 6 } });
    nz(o, { t, type: 'lowpass', f: 320, a: 0.1, d: 0.4, v: 0.12 });
    return 0.6;
  }, 0.05],
  zombie: [(o, t, p) => {
    tone(o, { t, type: 'sawtooth', f: 112 * p, f2: 84 * p, a: 0.22, d: 0.6, v: 0.13, lp: 480, lp2: 700, q: 3, vib: { rate: 5, depth: 5 } });
    tone(o, { t, type: 'sawtooth', f: 168 * p, f2: 125 * p, a: 0.25, d: 0.5, v: 0.04, lp: 700, q: 6, vib: { rate: 4.4, depth: 6 } });
    nz(o, { t, f: 600, q: 1, a: 0.2, d: 0.5, v: 0.04 });
    return 0.9;
  }, 0.25],
  zombieDie: [(o, t, p) => {
    tone(o, { t, type: 'sawtooth', f: 125 * p, f2: 48 * p, a: 0.05, d: 0.65, v: 0.15, lp: 650, lp2: 250, q: 3, vib: { rate: 6, depth: 6 } });
    nz(o, { t: t + 0.3, type: 'lowpass', f: 1800, f2: 250, d: 0.3, v: 0.2 });
    for (let i = 0; i < 4; i++) nz(o, { t: t + 0.32 + i * 0.05, f: rnd(400, 1600), q: 2, d: 0.05, v: 0.1 });
    return 0.8;
  }, 0.2],
  arrow: [(o, t, p) => {
    tone(o, { t, type: 'triangle', f: 230 * p, f2: 205 * p, d: 0.16, v: 0.18 });
    tone(o, { t, f: 460 * p, d: 0.08, v: 0.05 });
    nz(o, { t: t + 0.02, f: 2200 * p, f2: 800 * p, q: 3, a: 0.02, d: 0.18, v: 0.12 });
    return 0.25;
  }, 0.08],
  coin: [(o, t, p) => {
    tone(o, { t, type: 'square', f: 988 * p, d: 0.07, v: 0.06, lp: 3000 });
    tone(o, { t, f: 988 * p, d: 0.07, v: 0.06 });
    tone(o, { t: t + 0.075, type: 'square', f: 1319 * p, d: 0.35, v: 0.06, lp: 3500 });
    tone(o, { t: t + 0.075, f: 1319 * p, d: 0.35, v: 0.07 });
    return 0.5;
  }, 0.2],
  click: [(o, t, p) => {
    tone(o, { t, f: 1800 * p, a: 0.002, d: 0.025, v: 0.08 });
    nz(o, { t, type: 'highpass', f: 4000, d: 0.01, v: 0.04 });
    return 0.05;
  }, 0],
  hover: [(o, t, p) => {
    tone(o, { t, f: 2400 * p, a: 0.002, d: 0.02, v: 0.022 });
    return 0.04;
  }, 0],
  error: [(o, t, p) => {
    tone(o, { t, type: 'square', f: 165 * p, d: 0.09, v: 0.09, lp: 600 });
    tone(o, { t: t + 0.13, type: 'square', f: 150 * p, d: 0.1, v: 0.09, lp: 600 });
    return 0.28;
  }, 0.02],
  open: [(o, t, p) => {
    nz(o, { t, f: 400, f2: 1600, q: 1.2, a: 0.06, d: 0.12, v: 0.06 });
    koto(o, 81, t + 0.04, 0.2, p);
    return 0.6;
  }, 0.2],
  close: [(o, t, p) => {
    nz(o, { t, f: 1600, f2: 400, q: 1.2, a: 0.04, d: 0.12, v: 0.06 });
    koto(o, 74, t + 0.03, 0.18, p);
    return 0.6;
  }, 0.2],
  craft: [(o, t, p) => {
    tone(o, { t, f: 2600 * p, d: 0.2, v: 0.08 });
    tone(o, { t, f: 3900 * p, d: 0.1, v: 0.03 });
    nz(o, { t, f: 2500, q: 1.5, d: 0.03, v: 0.14 });
    for (let i = 0; i < 3; i++) {
      const m = 86 + YO[(Math.random() * 5) | 0] + (i ? 0 : 0);
      tone(o, { t: t + 0.09 + i * 0.06, f: mtof(m + i * 2) * p, d: 0.18, v: 0.035 });
    }
    return 0.45;
  }, 0.3],
  till: [(o, t, p) => {
    nz(o, { t, f: 850 * p, f2: 380 * p, q: 1, a: 0.02, d: 0.16, v: 0.26 });
    nz(o, { t, type: 'lowpass', f: 400, d: 0.1, v: 0.18 });
    return 0.22;
  }, 0.02],
  water: [(o, t, p) => {
    nz(o, { t, f: 3000, q: 0.7, a: 0.1, d: 0.42, v: 0.1 });
    for (let i = 0; i < 8; i++) {
      const f = rnd(800, 1700) * p;
      tone(o, { t: t + rnd(0, 0.45), f, f2: f * 1.5, a: 0.002, d: 0.04, v: 0.035 });
    }
    return 0.6;
  }, 0.1],
  plant: [(o, t, p) => {
    nz(o, { t, type: 'lowpass', f: 520 * p, d: 0.08, v: 0.42 });
    nz(o, { t: t + 0.1, type: 'lowpass', f: 450 * p, d: 0.07, v: 0.16 });
    return 0.2;
  }, 0.02],
  harvest: [(o, t, p) => {
    tone(o, { t, f: 400 * p, f2: 950 * p, d: 0.06, v: 0.18 });
    koto(o, 86, t + 0.03, 0.16, p);
    nz(o, { t, type: 'highpass', f: 3000, a: 0.02, d: 0.14, v: 0.07 });
    return 0.5;
  }, 0.15],
  door: [(o, t, p) => {
    nz(o, { t, f: 500 * p, f2: 900 * p, q: 1.2, a: 0.1, d: 0.33, v: 0.18 });
    nz(o, { t, type: 'lowpass', f: 220, a: 0.1, d: 0.33, v: 0.1 });
    tone(o, { t: t + 0.42, type: 'triangle', f: 130 * p, d: 0.06, v: 0.14 });
    nz(o, { t: t + 0.42, f: 900, q: 2, d: 0.03, v: 0.08 });
    return 0.55;
  }, 0.08],
  step: [(o, t, p) => {
    nz(o, { t, type: 'lowpass', f: 650 * p, f2: 280, d: 0.06, v: 0.12 });
    return 0.1;
  }, 0],
  bell: [(o, t, p) => {
    const b = 82 * p;
    const parts = [[0.5, 0.4, 4.6], [1, 0.32, 4.2], [1.004, 0.22, 4.0], [1.2, 0.16, 3.0], [1.5, 0.1, 2.4],
      [2, 0.13, 2.6], [2.74, 0.07, 1.7], [3.76, 0.045, 1.1], [5.4, 0.025, 0.6]];
    for (const [r, v, d] of parts) tone(o, { t, f: b * r, a: 0.004, d, v: v * 0.55 });
    nz(o, { t, type: 'lowpass', f: 700, d: 0.15, v: 0.2 });
    return 4.8;
  }, 0.6],
  horn: [(o, t, p) => {
    const f = 73.4 * p, d = 2.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(180, t);
    lp.frequency.linearRampToValueAtTime(850, t + 0.9);
    lp.frequency.linearRampToValueAtTime(300, t + d);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.6);
    g.gain.setValueAtTime(0.16, t + 1.7);
    g.gain.linearRampToValueAtTime(0.0001, t + d);
    lp.connect(g);
    g.connect(o);
    [[1, 0], [1, 9], [2, -5], [1.5, 4]].forEach(([r, det], i) => {
      const s = ctx.createOscillator();
      s.type = 'sawtooth';
      s.frequency.setValueAtTime(f * r * 0.95, t);
      s.frequency.linearRampToValueAtTime(f * r, t + 0.5);
      s.detune.value = det;
      const sg = ctx.createGain();
      sg.gain.value = i === 3 ? 0.25 : i === 2 ? 0.4 : 0.6;
      s.connect(sg);
      sg.connect(lp);
      s.start(t);
      s.stop(t + d + 0.05);
      cleanup(s, i === 0 ? [sg, lp, g] : [sg]);
    });
    nz(o, { t, f: 400, q: 1, a: 0.5, d: 1.8, v: 0.03 });
    return d + 0.1;
  }, 0.45],
  levelup: [(o, t, p) => {
    for (let i = 0; i < 8; i++) {
      const m = 74 + YO[i % 5] + 12 * Math.floor(i / 5);
      tone(o, { t: t + i * 0.06, type: 'triangle', f: mtof(m) * p, d: 0.22, v: 0.08 });
      tone(o, { t: t + i * 0.06, f: mtof(m) * p * 2, d: 0.12, v: 0.025 });
    }
    tone(o, { t: t + 0.5, f: mtof(98) * p, d: 0.5, v: 0.04 });
    return 1.1;
  }, 0.35],
  pet: [(o, t, p) => {
    tone(o, { t, f: 1200 * p, f2: 1800 * p, d: 0.08, v: 0.09 });
    tone(o, { t: t + 0.09, f: 1600 * p, f2: 2400 * p, d: 0.1, v: 0.07 });
    tone(o, { t: t + 0.16, f: 3200 * p, d: 0.15, v: 0.025 });
    return 0.35;
  }, 0.2],
  chicken: [(o, t, p) => {
    tone(o, { t, type: 'sawtooth', f: 620 * p, f2: 450 * p, d: 0.05, v: 0.08, lp: 1800, q: 5 });
    tone(o, { t: t + 0.09, type: 'sawtooth', f: 720 * p, f2: 500 * p, d: 0.07, v: 0.09, lp: 1900, q: 5 });
    tone(o, { t: t + 0.2, type: 'sawtooth', f: 650 * p, f2: 480 * p, d: 0.05, v: 0.06, lp: 1800, q: 5 });
    return 0.3;
  }, 0.05],
  cow: [(o, t, p) => {
    tone(o, { t, type: 'sawtooth', f: 145 * p, f2: 108 * p, a: 0.15, d: 0.75, v: 0.13, lp: 420, lp2: 700, q: 3, vib: { rate: 4, depth: 2 } });
    tone(o, { t, type: 'sawtooth', f: 145 * p, f2: 108 * p, a: 0.18, d: 0.7, v: 0.04, lp: 900, q: 8, det: 8 });
    return 0.95;
  }, 0.1],
  sheep: [(o, t, p) => {
    tone(o, { t, type: 'sawtooth', f: 340 * p, f2: 310 * p, a: 0.05, d: 0.5, v: 0.08, lp: 1700, q: 3, vib: { rate: 7.5, depth: 14 } });
    tone(o, { t, f: 340 * p, f2: 310 * p, a: 0.05, d: 0.45, v: 0.04, vib: { rate: 7.5, depth: 14 } });
    return 0.6;
  }, 0.1],
  fire: [(o, t, p) => {
    nz(o, { t, type: 'lowpass', f: 650, a: 0.1, d: 0.35, v: 0.1 });
    for (let i = 0; i < 9; i++) nz(o, { t: t + rnd(0, 0.42), type: 'highpass', f: rnd(1800, 5000) * p, d: rnd(0.006, 0.02), v: rnd(0.04, 0.13) });
    return 0.5;
  }, 0.05],
  death: [(o, t, p) => {
    [82, 81, 79, 75, 74].forEach((m, i) => koto(o, m - 12, t + i * 0.3 + (i === 4 ? 0.15 : 0), 0.3, p));
    koto(o, 50, t + 1.35, 0.22, p);
    return 3.2;
  }, 0.5],
  save: [(o, t, p) => {
    tone(o, { t, f: 1175 * p, a: 0.004, d: 0.6, v: 0.08 });
    tone(o, { t, f: 1175 * 2.76 * p, a: 0.004, d: 0.2, v: 0.015 });
    tone(o, { t: t + 0.12, f: 1568 * p, a: 0.004, d: 0.9, v: 0.08 });
    tone(o, { t: t + 0.12, f: 1568 * 2.76 * p, a: 0.004, d: 0.25, v: 0.015 });
    return 1.1;
  }, 0.4],
  drum: [(o, t) => { taiko(o, t, 0.5, true); return 0.7; }, 0.25],
};

function playSfx(name, opts) {
  const def = SFX[name];
  if (!def) return;
  const now = ctx.currentTime;
  if (lastPlay[name] !== undefined && now - lastPlay[name] < 0.04 && now >= lastPlay[name]) return;
  if (voices >= MAX_VOICES) return;
  lastPlay[name] = now;
  opts = opts || {};
  const v = clamp(num(opts.vol, 1), 0, 1);
  if (v <= 0.001) return;
  const p = clamp(num(opts.pitch, 1), 0.1, 8) * (1 + (Math.random() - 0.5) * 0.08);
  const out = ctx.createGain();
  out.gain.value = v;
  let tail = out;
  let pan = null;
  if (ctx.createStereoPanner) {
    pan = ctx.createStereoPanner();
    pan.pan.value = clamp(num(opts.pan, 0), -1, 1);
    out.connect(pan);
    tail = pan;
  }
  tail.connect(sfxBus);
  let send = null;
  if (def[1] > 0) {
    send = ctx.createGain();
    send.gain.value = def[1];
    tail.connect(send);
    send.connect(reverb);
  }
  voices++;
  let dur = 0.5;
  try { dur = def[0](out, now + 0.005, p) || 0.5; } catch (e) { /* ignore */ }
  setTimeout(() => {
    voices--;
    try { out.disconnect(); if (pan) pan.disconnect(); if (send) send.disconnect(); } catch (e) { /* ignore */ }
  }, (dur + 0.6) * 1000);
}

// ---------------------------------------------------------------- music
const SCALES = { yo: [0, 2, 5, 7, 9], in: [0, 1, 5, 7, 8], hira: [0, 2, 3, 7, 8] };
function degMidi(root, scale, deg) {
  const n = scale.length;
  return root + scale[((deg % n) + n) % n] + 12 * Math.floor(deg / n);
}
function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function fixLens(notes) {
  for (let i = 0; i < notes.length; i++) notes[i].len = (i + 1 < notes.length ? notes[i + 1].s : 8) - notes[i].s;
  return notes;
}
function makeMotif(rng, density, lo = 1, hi = 7) {
  const notes = [];
  let d = lo + 1 + Math.floor(rng() * Math.max(1, hi - lo - 2));
  for (let s = 0; s < 8; s++) {
    if (rng() < (s % 2 === 0 ? density : density * 0.45)) {
      notes.push({ s, d });
      const r = rng();
      d += r < 0.35 ? 1 : r < 0.7 ? -1 : r < 0.82 ? 2 : r < 0.94 ? -2 : 0;
      d = clamp(d, lo, hi);
    }
  }
  if (!notes.length) notes.push({ s: 0, d });
  return fixLens(notes);
}
function vary(m, rng) {
  let n = m.map((x) => ({ ...x }));
  const r = rng();
  if (r < 0.3) { const k = rng() < 0.5 ? 1 : -1; n.forEach((x, i) => { if (i >= n.length / 2) x.d += k; }); }
  else if (r < 0.55) n[n.length - 1].d += rng() < 0.5 ? 1 : -1;
  else if (r < 0.75 && n.length > 2) n.splice(1 + Math.floor(rng() * (n.length - 1)), 1);
  else if (r < 0.9) { const a = n[0].d; n.forEach((x) => { x.d = a - (x.d - a); }); }
  n.forEach((x) => { x.d = clamp(x.d, 0, 9); });
  return fixLens(n);
}
function cadence(m) {
  const n = m.filter((x) => x.s < 4).map((x) => ({ ...x }));
  const last = n.length ? n[n.length - 1].d : 5;
  n.push({ s: n.length && n[n.length - 1].s >= 3 ? 5 : 4, d: last >= 3 ? 5 : 0 });
  return fixLens(n);
}

function nextPhrase(p, density, lo, hi) {
  if (!p.A || p.bar % 8 === 0 && p.rng() < 0.5) p.A = makeMotif(p.rng, density, lo, hi);
  const B = makeMotif(p.rng, density, lo, hi);
  p.phrase = [p.A, vary(p.A, p.rng), B, cadence(vary(p.A, p.rng))];
}

const MODES = {
  title: {
    bpm: 70,
    bar(p, t0, sp, out) {
      const sc = SCALES.hira, prog = [0, -1, 2, 3];
      const r = prog[p.bar % 4];
      const arp = [0, 2, 4, 5, 4, 2];
      for (let s = 0; s < 6; s++) {
        if (s > 0 && p.rng() < 0.15) continue;
        koto(out, degMidi(52, sc, r + arp[s]), t0 + s * sp + (p.rng() - 0.5) * 0.015, s === 0 ? 0.26 : 0.17);
      }
      if (p.bar % 2 === 0) pad(out, [degMidi(40, sc, r), degMidi(40, sc, r) + 7], t0, sp * 16, 0.035);
      if (p.bar % 8 === 0) p.fl = p.rng() < 0.7;
      if (p.bar % 4 === 0) nextPhrase(p, 0.4, 2, 8);
      if (p.fl && p.bar % 8 >= 4) {
        for (const n of p.phrase[p.bar % 4]) flute(out, degMidi(64, sc, n.d), t0 + n.s * sp, n.len * sp * 0.92, 0.09);
      }
    },
  },
  day: {
    bpm: 84,
    bar(p, t0, sp, out) {
      const sc = SCALES.yo, prog = [0, 2, 3, 0];
      const r = prog[p.bar % 4];
      const root = degMidi(50, sc, r);
      if (p.bar % 4 === 0) nextPhrase(p, 0.5, 1, 8);
      const phraseIdx = Math.floor(p.bar / 4);
      const active = phraseIdx % 3 !== 2;
      if (p.bar % 2 === 0) pad(out, [root - 12, root - 5, root], t0, sp * 16, 0.03);
      if (p.rng() < 0.8) koto(out, root, t0, 0.2);
      if (p.rng() < 0.45) koto(out, root + 7, t0 + 4 * sp, 0.13);
      if (active && (p.bar % 4 === 3 || p.rng() > 0.15)) {
        for (const n of p.phrase[p.bar % 4]) {
          const tt = t0 + n.s * sp + (p.rng() - 0.5) * 0.012;
          koto(out, degMidi(62, sc, n.d), tt, n.s % 4 === 0 ? 0.24 : 0.18);
          if (p.rng() < 0.2) koto(out, degMidi(62, sc, n.d - 2), tt + 0.02, 0.09);
        }
      } else if (p.rng() < 0.5) {
        koto(out, degMidi(74, sc, Math.floor(p.rng() * 5)), t0 + (2 + Math.floor(p.rng() * 4)) * sp, 0.1);
      }
    },
  },
  night: {
    bpm: 60,
    bar(p, t0, sp, out) {
      const sc = SCALES.in, prog = [0, 0, 3, 2];
      const r = prog[p.bar % 4];
      const root = degMidi(50, sc, r);
      if (p.bar % 4 === 0) nextPhrase(p, 0.32, 1, 7);
      if (p.bar % 2 === 0) pad(out, [root - 12, root - 5], t0, sp * 16, 0.025);
      koto(out, root - 12 < 38 ? root : root - 12, t0, 0.2, 1, 0.7);
      if (p.rng() < 0.4) koto(out, root + 7 - 12, t0 + 5 * sp, 0.12, 1, 0.7);
      const phraseIdx = Math.floor(p.bar / 4);
      if (phraseIdx % 2 === 0 && p.bar % 4 !== 2) {
        for (const n of p.phrase[p.bar % 4]) flute(out, degMidi(62, sc, n.d), t0 + n.s * sp, n.len * sp * 0.9, 0.1);
      } else if (p.rng() < 0.3) {
        koto(out, degMidi(74, sc, Math.floor(p.rng() * 5)), t0 + (1 + Math.floor(p.rng() * 6)) * sp, 0.08);
      }
    },
  },
  battle: {
    bpm: 120,
    bar(p, t0, sp, out) {
      const sc = SCALES.in;
      const ost = p.bar % 4 === 3 ? [0, 1, 2, 3, 4, 3, 2, 1] : [0, 0, 2, 0, 1, 0, 2, 3];
      const shift = [0, 0, 2, -1][Math.floor(p.bar / 4) % 4];
      for (let s = 0; s < 8; s++) koto(out, degMidi(45, sc, ost[s] + shift), t0 + s * sp, s % 2 ? 0.08 : 0.12, 1, 0.6);
      if (p.bar % 8 === 7) {
        taiko(out, t0, 0.42, true, 0.5);
        taiko(out, t0 + 2 * sp, 0.2, false, 0.5);
        taiko(out, t0 + 3 * sp, 0.22, false, 0.5);
        for (let s = 4; s < 8; s++) taiko(out, t0 + s * sp, 0.18 + (s - 4) * 0.06, s === 7, 0.5);
      } else {
        taiko(out, t0, 0.42, true, 0.5);
        taiko(out, t0 + 3 * sp, 0.2, false, 0.5);
        taiko(out, t0 + 4 * sp, 0.34, true, 0.5);
        taiko(out, t0 + 6 * sp, 0.18, false, 0.5);
        if (p.rng() < 0.4) taiko(out, t0 + 7 * sp, 0.12, false, 0.5);
      }
      if (p.bar % 4 === 0) pad(out, [38, 45], t0, sp * 32, 0.03);
    },
  },
};

let players = [];
let curMode = 'off';
let schedTimer = null;
let seedCounter = 1;

function startPlayer(mode) {
  const def = MODES[mode];
  if (!def) return;
  const out = ctx.createGain();
  const now = ctx.currentTime;
  out.gain.setValueAtTime(0.0001, now);
  out.gain.linearRampToValueAtTime(1, now + 2);
  out.connect(musicBus);
  const send = ctx.createGain();
  send.gain.value = 0.4;
  out.connect(send);
  send.connect(reverb);
  players.push({
    mode, def, out, send, bar: 0, next: now + 0.1, sp: 60 / def.bpm / 2,
    rng: mulberry((mode.length * 7919 + seedCounter++ * 104729 + ((Math.random() * 1e6) | 0)) | 0),
    stopped: false,
  });
}

function fadePlayers() {
  const now = ctx.currentTime;
  for (const p of players) {
    if (p.stopped) continue;
    p.stopped = true;
    p.out.gain.cancelScheduledValues(now);
    p.out.gain.setValueAtTime(Math.max(0.0001, p.out.gain.value), now);
    p.out.gain.linearRampToValueAtTime(0.0001, now + 2);
    const pl = p;
    setTimeout(() => {
      try { pl.out.disconnect(); pl.send.disconnect(); } catch (e) { /* ignore */ }
      players = players.filter((x) => x !== pl);
    }, (2.2 + pl.sp * 8) * 1000);
  }
}

function tick() {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  for (const p of players) {
    if (p.stopped) continue;
    if (p.next < now - 0.2) p.next = now + 0.05; // recover from throttling
    while (p.next < now + 0.3) {
      try { p.def.bar(p, p.next, p.sp, p.out); } catch (e) { /* ignore */ }
      p.next += p.sp * 8;
      p.bar++;
    }
  }
}

function setMusic(mode) {
  if (mode === curMode) return;
  curMode = mode;
  if (!ctx) return;
  fadePlayers();
  if (MODES[mode]) startPlayer(mode);
  if (!schedTimer) schedTimer = setInterval(tick, 100);
  tick();
}

// ---------------------------------------------------------------- ambient beds
const AMB_MAX = { rain: 0.13, wind: 0.24, night: 0.03, water: 0.24 };
const ambTarget = { rain: 0, wind: 0, night: 0, water: 0 };
const ambLast = { rain: 0, wind: 0, night: 0, water: 0 };
const beds = {};

function loopNoise() {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  s.start(0, Math.random() * 1.9);
  return s;
}
function lfo(freq, depth, target, type = 'sine') {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = depth;
  o.connect(g);
  g.connect(target);
  o.start();
  return o;
}
function filt(type, f, q = 0.7) {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}

const BED_BUILD = {
  rain(g) {
    const a = loopNoise(), hp = filt('highpass', 900), lp = filt('lowpass', 6500), ga = ctx.createGain();
    ga.gain.value = 0.55;
    a.connect(hp); hp.connect(lp); lp.connect(ga); ga.connect(g);
    const b = loopNoise(), lp2 = filt('lowpass', 380), gb = ctx.createGain();
    gb.gain.value = 0.7;
    b.connect(lp2); lp2.connect(gb); gb.connect(g);
    lfo(0.11, 0.12, ga.gain);
  },
  wind(g) {
    const a = loopNoise(), bp = filt('bandpass', 480, 0.9), ga = ctx.createGain();
    ga.gain.value = 0.6;
    a.connect(bp); bp.connect(ga); ga.connect(g);
    lfo(0.07, 260, bp.frequency);
    lfo(0.13, 0.32, ga.gain);
    lfo(0.031, 0.15, ga.gain);
  },
  night(g) {
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 127.5 - 1; curve[i] = clamp((x - 0.45) * 6, 0, 1); }
    [[4300, 31, 0.83, -0.5], [4750, 26, 0.61, 0.55]].forEach(([f, pr, gr, pn]) => {
      const c = ctx.createOscillator();
      c.frequency.value = f;
      c.start();
      const am = ctx.createGain();
      am.gain.value = 0.5;
      c.connect(am);
      lfo(pr, 0.5, am.gain);
      const gate = ctx.createGain();
      gate.gain.value = 0;
      am.connect(gate);
      const go = ctx.createOscillator();
      go.frequency.value = gr;
      const sh = ctx.createWaveShaper();
      sh.curve = curve;
      go.connect(sh); sh.connect(gate.gain);
      go.start();
      let tail = gate;
      if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pn; gate.connect(p); tail = p; }
      tail.connect(g);
    });
  },
  water(g) {
    const a = loopNoise(), lp = filt('lowpass', 480), ga = ctx.createGain();
    ga.gain.value = 0.5;
    a.connect(lp); lp.connect(ga); ga.connect(g);
    lfo(0.23, 0.25, ga.gain);
    lfo(0.41, 0.18, ga.gain);
    const b = loopNoise(), bp = filt('bandpass', 1300, 2), gb = ctx.createGain();
    gb.gain.value = 0.12;
    b.connect(bp); bp.connect(gb); gb.connect(g);
    lfo(0.33, 0.1, gb.gain);
    lfo(0.17, 300, bp.frequency);
  },
};

function applyAmbient() {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const k in ambTarget) {
    const v = ambTarget[k];
    if (Math.abs(v - ambLast[k]) < 0.01 && (v > 0 || ambLast[k] === 0)) continue;
    ambLast[k] = v;
    if (!beds[k]) {
      if (v < 0.005) continue;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(ambBus);
      try { BED_BUILD[k](g); } catch (e) { /* ignore */ }
      beds[k] = g;
    }
    beds[k].gain.setTargetAtTime(v * AMB_MAX[k], now, 0.6);
  }
}

// ---------------------------------------------------------------- public API
let pendingMode = 'off';
let suspendedByUser = false;

export const Audio = {
  init() {
    try {
      if (!ctx) {
        const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
        if (!AC) return;
        ctx = new AC();
        buildGraph();
        if (pendingMode !== 'off') { const m = pendingMode; curMode = 'off'; setMusic(m); }
        applyAmbient();
      }
      if (ctx.state === 'suspended' && !suspendedByUser) {
        const r = ctx.resume();
        if (r && r.catch) r.catch(() => {});
      }
    } catch (e) { ctx = null; }
  },
  get ready() {
    return !!ctx && ctx.state === 'running';
  },
  setVolume(o) {
    try {
      if (!o) return;
      if (typeof o.master === 'number') vol.master = clamp(o.master, 0, 1);
      if (typeof o.sfx === 'number') vol.sfx = clamp(o.sfx, 0, 1);
      if (typeof o.music === 'number') vol.music = clamp(o.music, 0, 1);
      applyVolume(false);
    } catch (e) { /* ignore */ }
  },
  play(name, opts) {
    try { if (ctx && master) playSfx(name, opts); } catch (e) { /* ignore */ }
  },
  music(mode) {
    try {
      if (!(mode in MODES) && mode !== 'off') return;
      pendingMode = mode;
      if (!ctx) { curMode = mode; return; }
      setMusic(mode);
    } catch (e) { /* ignore */ }
  },
  ambient(o) {
    try {
      if (!o) return;
      for (const k in ambTarget) if (typeof o[k] === 'number' && isFinite(o[k])) ambTarget[k] = clamp(o[k], 0, 1);
      applyAmbient();
    } catch (e) { /* ignore */ }
  },
  suspend(on) {
    try {
      suspendedByUser = !!on;
      if (!ctx) return;
      const r = on ? ctx.suspend() : ctx.resume();
      if (r && r.catch) r.catch(() => {});
    } catch (e) { /* ignore */ }
  },
};

export default Audio;
