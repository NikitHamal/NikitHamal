/* sound.js — a quiet soundscape for the site, built to stay light.
 *  - UI sounds:  real recorded clicks / toggles / pops from Kenney's "Interface Sounds" (CC0), packed into one tiny
 *                sprite (assets/sfx/ui.wav) that is only downloaded once sound is switched on
 *  - music:      a slow generative piece: soft pad chords under kalimba-like phrases on a pentatonic scale
 *                (D major by day, A minor by night)
 *  - ambience:   rain, wind, thunder after lightning, birds by day and crickets at night, following the live sky
 * Engineering: two shared reverb sends (no per-note reverb plumbing), a short generated reverb, a hard cap on
 * simultaneous voices, a scheduler that re-syncs instead of "catching up" after the tab sleeps, and the audio
 * context suspends while the tab is hidden or sound is off. Off by default; the pixel speaker turns it on. */
(() => {
  'use strict';
  if (window.SiteSound) return;
  const D = document, R = D.documentElement;
  const KEY = 'site-sound', SPRITE_URL = '/assets/sfx/ui.wav?v=1';
  const SPRITE = { tap: [0, .0404], tap2: [.0904, .0551], toggle: [.1955, .1364], open: [.382, .2254], close: [.6573, .2254], drop: [.9327, .1882], glass: [1.1709, .2756], pluck: [1.4965, .1617] };
  const coarse = matchMedia('(pointer: coarse)').matches;
  let on = false; try { on = localStorage.getItem(KEY) === 'on'; } catch (e) {}
  let ac = null, master, sfx, amb, music, sendS, sendM, pink, brown, rainG, windG, windF, sprite = null, started = false, duck = 1, voices = 0;
  // real ambience (CC0 recordings, see assets/sfx/LICENSE.txt), fetched only when that weather first needs them
  let rainLP, rainRecG, windRecG, windSrc = null, rec = {}, recLoading = {};
  const MAX_VOICES = coarse ? 18 : 28;
  const rnd = Math.random, pick = a => a[Math.floor(rnd() * a.length)], clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  const isDark = () => R.getAttribute('data-theme') === 'dark';
  const DAY = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83];
  const NIGHT = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79];
  const PROG = {
    day: [[50, 62, 66, 69, 76], [47, 59, 62, 66, 69], [43, 55, 59, 62, 66], [45, 57, 61, 64, 71]],
    night: [[45, 57, 60, 64, 71], [41, 53, 57, 60, 64], [48, 55, 59, 64, 67], [43, 55, 57, 62, 67]]
  };

  /* ---------- graph (built once, on the first tap after sound is switched on) ---------- */
  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ac = new AC({ latencyHint: 'interactive' }); } catch (e) { ac = new AC(); }
    master = ac.createGain(); master.gain.value = 0;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = .005; comp.release.value = .25;
    master.connect(comp); comp.connect(ac.destination);
    sfx = gain(.7, master); amb = gain(0, master); music = gain(0, master);
    const verb = ac.createConvolver(); verb.buffer = impulse(coarse ? 1.6 : 2.1, 2.6); verb.connect(gain(.42, master));
    sendS = gain(.18, verb); sendM = gain(.5, verb);      // shared sends: one per bus
    pink = noiseBuf(true); brown = noiseBuf(false);
    // synthesized beds play until the real recordings arrive (and stay as a quiet texture under them)
    rainG = gain(0, amb); loop(pink, [bq('highpass', 500), bq('lowpass', 3600)], rainG);
    windG = gain(0, amb); windF = bq('bandpass', 420, .9); loop(pink, [windF], windG);
    rainLP = bq('lowpass', 9000); rainRecG = gain(0, amb); rainLP.connect(rainRecG);
    windRecG = gain(0, amb);
    loadSprite();
    return true;
  }
  const gain = (v, to) => { const g = ac.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
  const bq = (type, f, q = .7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  function impulse(sec, decay) { const sr = ac.sampleRate, n = sr * sec | 0, b = ac.createBuffer(2, n, sr); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / n, decay); } return b; }
  function noiseBuf(isPink) {
    const n = ac.sampleRate * 3 | 0, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < n; i++) { const w = rnd() * 2 - 1;
      if (isPink) { b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * .1848) * .11; }
      else { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } }
    return b;
  }
  function loop(buf, chain, to) { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; let n = s; for (const f of chain) { n.connect(f); n = f; } n.connect(to); s.start(0, rnd() * 2); }
  function decode(buf) { return new Promise((ok, no) => { const p = ac.decodeAudioData(buf, ok, no); if (p && p.then) p.then(ok, no); }); }
  function need(name) {
    if (rec[name] || recLoading[name]) return rec[name] || null; recLoading[name] = true;
    fetch(`/assets/sfx/${name}.m4a?v=1`).then(r => r.arrayBuffer()).then(decode).then(buf => { rec[name] = buf; onRec(name, buf); }).catch(() => { recLoading[name] = false; });
    return null;
  }
  function onRec(name, buf) {
    if (name === 'rain') { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(rainLP); s.start(0, Math.random() * buf.duration); }
    if (name === 'wind') { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(windRecG); s.start(0, Math.random() * buf.duration); windSrc = s; }
  }
  function loadSprite() {
    fetch(SPRITE_URL).then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => { const p = ac.decodeAudioData(b, ok, no); if (p && p.then) p.then(ok, no); })).then(buf => { sprite = buf; }).catch(() => {});
  }

  /* ---------- voices ---------- */
  const track = node => { voices++; node.onended = () => { voices--; }; };
  function tone({ f = 440, type = 'sine', t = 0, a = .005, d = .4, v = .1, to = sfx, send = sendS, glide = 0, partial = 0, pan = 0, essential = false }) {
    if (!essential && voices > MAX_VOICES) return;
    const now = ac.currentTime + t, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, now); if (glide) o.frequency.exponentialRampToValueAtTime(glide, now + a + d * .6);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(v, now + a); g.gain.exponentialRampToValueAtTime(.0001, now + a + d);
    let out = g; if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    o.connect(g); out.connect(to); if (send) out.connect(send);
    track(o); o.start(now); o.stop(now + a + d + .05);
    if (partial) tone({ f: f * partial, t, a, d: d * .4, v: v * .2, to, send, pan, essential });
  }
  function noise({ buf = pink, t = 0, a = .01, d = .3, v = .1, type = 'bandpass', f = 1000, q = 1, f2 = 0, to = sfx, send = null }) {
    const now = ac.currentTime + t, s = ac.createBufferSource(); s.buffer = buf;
    const fl = bq(type, f, q); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, now + a + d);
    const g = ac.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(v, now + a); g.gain.exponentialRampToValueAtTime(.0001, now + a + d);
    s.connect(fl); fl.connect(g); g.connect(to); if (send) g.connect(send);
    track(s); s.start(now, rnd() * 1.5); s.stop(now + a + d + .1);
  }
  // a slice of the Kenney sprite, slightly varied in pitch so repeats never sound mechanical
  function sample(name, v = .5, rate = 1, t = 0) {
    if (!sprite) return false; const [off, dur] = SPRITE[name], s = ac.createBufferSource(), g = gain(v, sfx);
    s.buffer = sprite; s.playbackRate.value = rate * (1 + (rnd() - .5) * .06); s.connect(g); track(s);
    s.start(ac.currentTime + t, off, dur); return true;
  }
  const bell = (m, t, v = .05, d = 1.2) => tone({ f: mf(m), t, d, v, partial: 2.76, send: sendM, pan: (rnd() - .5) * .6, essential: true });

  const SFX = {
    tap() { sample(rnd() < .5 ? 'tap' : 'tap2', .32) || tone({ f: mf(pick([86, 88, 91])), type: 'triangle', d: .08, v: .03, send: null }); },
    toggle() { sample('toggle', .4) || tone({ f: mf(81), d: .1, v: .04 }); },
    open() { sample('open', .34) || (tone({ f: mf(79), d: .2, v: .04, partial: 2 }), tone({ f: mf(86), t: .05, d: .28, v: .04, partial: 2 })); },
    close() { sample('close', .3) || (tone({ f: mf(86), d: .16, v: .035, partial: 2 }), tone({ f: mf(79), t: .05, d: .22, v: .035, partial: 2 })); },
    day() { [74, 78, 81, 86, 90].forEach((m, i) => bell(m, i * .075, .04, 1.3)); },
    night() { [81, 76, 74, 69, 64].forEach((m, i) => bell(m, i * .095, .036, 1.6)); tone({ f: mf(45), type: 'triangle', a: .7, d: 2.4, v: .03, send: sendM, essential: true }); },
    weather() { sample('toggle', .35, .85); noise({ a: .12, d: .5, v: .08, f: 450, f2: 2400, q: .8, send: sendS }); },
    sparkle() { sample('glass', .4) || [0, 1, 2].forEach(i => bell(pick(DAY) + 24, i * .06, .02, .5)); },
    drop() { sample('drop', .45, 1.1) || tone({ f: mf(88), glide: mf(98), d: .09, v: .04 }); },
    thunder() {
      const dist = rnd(), buf = rec.thunder || need('thunder');
      if (buf) {   // the real roll: near = the crack from the top, far = later in the roll, slower and darker
        const s = ac.createBufferSource(), lp = bq('lowpass', 900 + (1 - dist) * 5000), g = gain(.95 - dist * .45, amb);
        s.buffer = buf; s.playbackRate.value = (.82 + rnd() * .2) * (1 - dist * .1); s.connect(lp); lp.connect(g); g.connect(sendS); track(s);
        s.start(ac.currentTime + .15 + dist * 1.2, dist < .4 ? 0 : 1.5 + rnd() * 3); return;
      }
      const t = .2 + dist * 1.3; noise({ buf: brown, t, a: .06, d: 2.4 + dist, v: .5 * (1 - dist * .5), type: 'lowpass', f: 200 + (1 - dist) * 160, q: .4, to: amb, send: sendS }); if (dist < .35) noise({ t: t - .12, a: .002, d: .2, v: .16, type: 'highpass', f: 1400, to: amb }); },
    star() { tone({ f: mf(93), glide: mf(81), d: .8, v: .022, send: sendM, partial: 2.76, essential: true }); },
    lantern() { sample('pluck', .35, .8) ; bell(69, .05, .03, 1.5); bell(76, .2, .024, 1.5); },
    whoosh() { noise({ a: .25, d: .75, v: .1, f: 260, f2: 2000, q: 1.1, send: sendS }); sample('open', .25, .9, .3); }
  };

  /* ---------- music ---------- */
  let nextChord = 0, chordI = 0, nextNote = 0, phrase = [], phraseI = 0, mode = '';
  function chord(notes, when) {
    for (const m of notes) for (const det of coarse ? [0] : [-7, 7]) {
      const o = ac.createOscillator(), g = ac.createGain(), lp = bq('lowpass', m < 52 ? 420 : 900);
      o.type = 'triangle'; o.frequency.value = mf(m); o.detune.value = det;
      const v = (m < 52 ? .02 : .011) * (coarse ? 1.4 : 1);
      g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(v, when + 3.2); g.gain.setValueAtTime(v, when + 7.5); g.gain.linearRampToValueAtTime(0, when + 11);
      o.connect(lp); lp.connect(g); g.connect(music); g.connect(sendM); track(o); o.start(when); o.stop(when + 11.2);
    }
  }
  // kalimba: a sine with a tiny pitch blip on the attack and a quiet 3rd partial
  function kalimba(m, t, v = .045) { const f = mf(m); tone({ f: f * 1.01, glide: f, t, a: .003, d: 1.5, v, to: music, send: sendM, pan: (rnd() - .5) * .5 }); tone({ f: f * 3, t, a: .002, d: .25, v: v * .18, to: music, send: null }); }
  function newPhrase(sc) {   // a short motif that walks the scale and resolves, then a rest
    let i = 2 + (rnd() * 4 | 0); const out = [], len = 3 + (rnd() * 4 | 0);
    for (let k = 0; k < len; k++) { out.push([sc[i], pick([.45, .6, .6, .9])]); i = clamp(i + pick([-2, -1, 1, 1, 2]), 0, sc.length - 1); }
    out.push([sc[pick([0, 2, 5])], 1.8]); out.push([null, 2 + rnd() * 3]); return out;
  }
  function musicTick() {
    if (!started) return; const now = ac.currentTime, night = isDark(), m = night ? 'night' : 'day';
    // re-sync instead of firing a burst of overdue notes (after the tab slept, or a hiccup)
    if (nextNote < now - .25) nextNote = now + .1; if (nextChord < now - 1) nextChord = now + .1;
    if (m !== mode) { mode = m; phrase = []; nextChord = Math.min(nextChord, now + .3); }
    if (now + .2 >= nextChord) { chord(PROG[m][chordI++ % 4], Math.max(now, nextChord)); nextChord = Math.max(now, nextChord) + 9; }
    while (nextNote < now + .35) {
      if (phraseI >= phrase.length) { phrase = newPhrase(night ? NIGHT : DAY); phraseI = 0; }
      const [note, dur] = phrase[phraseI++]; if (note) kalimba(note + 12, Math.max(0, nextNote - now));
      nextNote += dur;
    }
  }

  /* ---------- ambience ---------- */
  let birdT = 3, crickT = 2, lastAmb = 0;
  function ambTick() {
    if (!started) return; const now = ac.currentTime, dt = clamp(now - lastAmb, 0, 1); lastAmb = now;
    const P = (window.PixelSky && window.PixelSky.params) || { rain: 0, wind: 3, snow: 0, storm: 0 }, night = window.PixelSky ? window.PixelSky.night > .5 : isDark();
    const rainAmt = clamp(P.rain, 0, 2), w = clamp((P.wind - 3) / 18, 0, 1);
    if (rainAmt > .05) need('rain'); if (w > .2 || P.snow > .2) need('wind'); if (P.storm > .6) need('thunder');
    // recorded rain carries the sound; the synth bed fades back to a whisper once it has loaded
    rainRecG.gain.setTargetAtTime(rainAmt * .55, now, .9); rainLP.frequency.setTargetAtTime(9000 - P.storm * 4500, now, 1);
    rainG.gain.setTargetAtTime(rainAmt * (rec.rain ? .03 : .2), now, .8);
    // wind: the recording swells and speeds up with the gusts; snow gets a soft, slow hush of it
    const gust = .65 + .35 * Math.sin(now * .37) * Math.sin(now * .11 + 1);
    windRecG.gain.setTargetAtTime((w * .7 * gust + P.snow * .18 + P.storm * .12) * (rec.wind ? 1 : 0), now, 1.1);
    if (windSrc) windSrc.playbackRate.setTargetAtTime(.75 + w * .45 * gust - P.snow * .1, now, 1.5);
    windG.gain.setTargetAtTime(.01 + (w * gust * .14 + P.snow * .03) * (rec.wind ? .35 : 1), now, 1.2);
    windF.frequency.setTargetAtTime(320 + Math.sin(now * .23) * 120 + w * 420, now, .9);
    amb.gain.setTargetAtTime(.9 * duck, now, .6); music.gain.setTargetAtTime(.7 * duck, now, 1.2);
    const calm = P.rain < .2 && P.snow < .2 && P.wind < 12;
    if (calm && !night && (birdT -= dt) < 0) { birdT = 5 + rnd() * 9; const n = 2 + (rnd() * 3 | 0), base = 2400 + rnd() * 1300, pan = (rnd() - .5) * 1.4;
      for (let i = 0; i < n; i++) tone({ f: base * (1 + rnd() * .15), glide: base * (1.25 + rnd() * .3), t: i * (.09 + rnd() * .05), a: .005, d: .07, v: .011, to: amb, send: sendS, pan }); }
    if (calm && night && (crickT -= dt) < 0) { crickT = 2 + rnd() * 4; const pan = (rnd() - .5) * 1.4, f = 4300 + rnd() * 500;
      for (let k = 0; k < 2; k++) for (let i = 0; i < 3; i++) tone({ f, t: k * .32 + i * .045, a: .003, d: .028, v: .005, to: amb, send: null, pan }); }
  }

  /* ---------- on / off ---------- */
  let timers = [];
  function start() {
    if (!init()) return; if (ac.state !== 'running' && ac.resume) ac.resume();
    if (!started) { started = true; nextChord = ac.currentTime + .4; nextNote = ac.currentTime + 1.4; lastAmb = ac.currentTime; timers = [setInterval(musicTick, 150), setInterval(ambTick, 300)]; }
    master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(.9, ac.currentTime, .5);
  }
  function stop() {
    if (!ac) return; master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(0, ac.currentTime, .15);
    setTimeout(() => { if (!on && ac) { timers.forEach(clearInterval); timers = []; started = false; if (ac.suspend) ac.suspend(); } }, 700);
  }
  function play(name) { if (on && started && ac && ac.state === 'running' && SFX[name]) try { SFX[name](); } catch (e) {} }
  function set(v, btn) {
    on = v; try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch (e) {}
    if (v) { start(); setTimeout(() => play('toggle'), 80); } else { play('toggle'); stop(); }
    D.querySelectorAll('.sound-toggle').forEach(b => { b.setAttribute('aria-pressed', String(v)); b.classList.toggle('is-on', v); b.title = v ? 'Sound: on' : 'Sound: off'; });
    if (btn && window.PixelSky_tip) window.PixelSky_tip(btn, v ? 'Sound on' : 'Sound off');
  }

  /* ---------- the speaker button ---------- */
  const SPEAKER = ['............', '....k.......', '...kk.......', 'kkkkk.......', 'kkkkk.......', 'kkkkk.......', 'kkkkk.......', '...kk.......', '....k.......', '............'];
  const px = (pts, cls) => `<g class="${cls}">${pts.map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`).join('')}</g>`;
  function speakerSVG() {
    let body = ''; SPEAKER.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === 'k') body += `<rect x="${x}" y="${y}" width="1" height="1"/>`; });
    return `<svg viewBox="0 0 12 10" aria-hidden="true" shape-rendering="crispEdges" fill="currentColor"><g>${body}</g>` +
      px([[7, 3], [8, 4], [8, 5], [7, 6]], 'sp-w1') + px([[9, 1], [10, 2], [11, 3], [11, 4], [11, 5], [11, 6], [10, 7], [9, 8]], 'sp-w2') +
      px([[7, 3], [8, 4], [9, 5], [10, 6], [10, 3], [9, 4], [8, 5], [7, 6]], 'sp-x') + '</svg>';
  }
  function boot() {
    const anchor = D.querySelector('.weather-toggle') || D.querySelector('.theme-toggle'); if (!anchor || D.querySelector('.sound-toggle')) return;
    const b = D.createElement('button'); b.type = 'button'; b.className = 'sound-toggle'; b.setAttribute('aria-label', 'Sound (music and effects)');
    b.innerHTML = speakerSVG(); anchor.parentNode.insertBefore(b, anchor);
    b.addEventListener('click', () => set(!on, b));
    D.querySelectorAll('.sound-toggle').forEach(x => { x.setAttribute('aria-pressed', String(on)); x.classList.toggle('is-on', on); x.title = on ? 'Sound: on' : 'Sound: off'; });
    // remembered "on": audio may only start inside a user gesture (iOS wants touchend / click, not pointerdown)
    // keep trying on every gesture until the context is really running: iOS ignores some gesture types
    const evs = ['pointerup', 'touchend', 'click', 'keydown'], unlock = e => {
      if (!on || (e.target.closest && e.target.closest('.sound-toggle'))) return;
      start(); if (ac && ac.state === 'running') evs.forEach(n => D.removeEventListener(n, unlock, true));
    };
    evs.forEach(n => D.addEventListener(n, unlock, true));
    D.addEventListener('click', e => {
      if (!on || !started || !e.target.closest) return;
      const acc = e.target.closest('.accordion-header');
      if (acc) { setTimeout(() => play(acc.closest('.accordion-item').classList.contains('open') ? 'open' : 'close'), 0); return; }
      if (e.target.closest('.sound-toggle, .theme-toggle, .ft-up, pixel-dog, .pond-section')) return;
      if (e.target.closest('.weather-toggle')) return;               // its own sound comes from the sky event
      if (e.target.closest('button, a, .skill-orb, .painted-card')) play('tap');
    }, true);
    D.addEventListener('sky:sfx', e => play(e.detail));
    new MutationObserver(() => play(isDark() ? 'night' : 'day')).observe(R, { attributes: true, attributeFilter: ['data-theme'] });
    D.addEventListener('visibilitychange', () => { if (!ac || !on) return; if (D.hidden) { if (ac.suspend) ac.suspend(); } else if (started && ac.resume) ac.resume(); });
    const pond = D.getElementById('pond');
    if (pond && 'IntersectionObserver' in window) new IntersectionObserver(es => { duck = es[es.length - 1].isIntersecting ? .25 : 1; }, { threshold: .3 }).observe(pond);
  }
  window.SiteSound = { play, get on() { return on; }, set: v => set(!!v) };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0)); else setTimeout(boot, 0);
})();
