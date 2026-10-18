/* sound.js — a quiet, hand-synthesised soundscape for the site. Web Audio only: no files, nothing to download.
 *  - music:    a slow generative piece — soft pad chords under music-box plucks on a pentatonic scale
 *              (D major by day, A minor by night), drenched in a generated reverb
 *  - ambience: rain, wind, thunder after lightning, birds by day and crickets at night, all following the live sky
 *  - sfx:      gentle ticks for buttons, rising / falling notes for sections, a chime arpeggio for day and night,
 *              droplets, sparkles, shooting stars, lanterns, a whoosh for back-to-top
 * Off by default (and browsers only allow audio after a tap anyway): the pixel speaker in the top bar turns it on,
 * and the choice is remembered. The music ducks while the koi pond (which has its own sounds) is on screen. */
(() => {
  'use strict';
  if (window.SiteSound) return;
  const D = document, R = D.documentElement;
  const KEY = 'site-sound';
  let on = false; try { on = localStorage.getItem(KEY) === 'on'; } catch (e) {}
  let ac = null, master, sfx, amb, music, verb, white, pink, brown, rainG, windG, windF, started = false, duck = 1;
  const rnd = Math.random, pick = a => a[Math.floor(rnd() * a.length)], clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  const isDark = () => R.getAttribute('data-theme') === 'dark';
  const DAY = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83];     // D major pentatonic
  const NIGHT = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79];   // A minor pentatonic
  const PROG = {
    day: [[50, 62, 66, 69, 76], [47, 59, 62, 66, 69], [43, 55, 59, 62, 66], [45, 57, 61, 64, 71]],      // Dadd9  Bm7  Gmaj7  A
    night: [[45, 57, 60, 64, 71], [41, 53, 57, 60, 64], [48, 55, 59, 64, 67], [43, 55, 57, 62, 67]]     // Am9  Fmaj7  Cmaj7  Gsus2
  };

  /* ---------- graph ---------- */
  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = .01; comp.release.value = .3;
    master.connect(comp); comp.connect(ac.destination);
    sfx = gain(.6, master); amb = gain(0, master); music = gain(0, master);
    verb = ac.createConvolver(); verb.buffer = impulse(3.2, 2.4); verb.connect(gain(.35, master));
    white = noiseBuf('white'); pink = noiseBuf('pink'); brown = noiseBuf('brown');
    rainG = gain(0, amb); loop(pink, [bq('highpass', 500), bq('lowpass', 3600)], rainG);
    windG = gain(0, amb); windF = bq('bandpass', 420, .9); loop(pink, [windF], windG);
    return true;
  }
  const gain = (v, to) => { const g = ac.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
  const bq = (type, f, q = .7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  function impulse(sec, decay) { const n = ac.sampleRate * sec | 0, b = ac.createBuffer(2, n, ac.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / n, decay); } return b; }
  function noiseBuf(kind) {
    const n = ac.sampleRate * 4 | 0, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < n; i++) { const w = rnd() * 2 - 1;
      if (kind === 'pink') { b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * .1848) * .11; }
      else if (kind === 'brown') { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return b;
  }
  function loop(buf, chain, to) { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; let n = s; for (const f of chain) { n.connect(f); n = f; } n.connect(to); s.start(0, rnd() * 3); return s; }

  /* ---------- voices ---------- */
  function tone({ f = 440, type = 'sine', t = 0, a = .005, d = .4, v = .1, to = sfx, send = .2, glide = 0, partial = 0, pan = 0 }) {
    const now = ac.currentTime + t, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, now); if (glide) o.frequency.exponentialRampToValueAtTime(glide, now + a + d * .6);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(v, now + a); g.gain.exponentialRampToValueAtTime(.0001, now + a + d);
    let out = g; if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    o.connect(g); out.connect(to); if (send) out.connect(gain(send, verb));
    o.start(now); o.stop(now + a + d + .05);
    if (partial) tone({ f: f * partial, t, a, d: d * .45, v: v * .22, to, send, pan });
  }
  function noise({ buf = white, t = 0, a = .01, d = .3, v = .1, type = 'bandpass', f = 1000, q = 1, f2 = 0, to = sfx, send = 0 }) {
    const now = ac.currentTime + t, s = ac.createBufferSource(); s.buffer = buf;
    const fl = bq(type, f, q); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, now + a + d);
    const g = ac.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(v, now + a); g.gain.exponentialRampToValueAtTime(.0001, now + a + d);
    s.connect(fl); fl.connect(g); g.connect(to); if (send) g.connect(gain(send, verb));
    s.start(now, rnd() * 2); s.stop(now + a + d + .1);
  }
  const bell = (m, t, v = .05, d = 1.2, send = .5) => tone({ f: mf(m), t, d, v, partial: 2.76, send, pan: (rnd() - .5) * .6 });

  const SFX = {
    tap() { tone({ f: mf(pick([86, 88, 91])), type: 'triangle', d: .09, v: .035, send: .04 }); },
    open() { tone({ f: mf(79), d: .22, v: .05, partial: 2.01, send: .15 }); tone({ f: mf(86), t: .055, d: .32, v: .05, partial: 2.01, send: .2 }); },
    close() { tone({ f: mf(86), d: .18, v: .04, partial: 2, send: .1 }); tone({ f: mf(79), t: .05, d: .26, v: .04, partial: 2, send: .15 }); },
    day() { [74, 78, 81, 86, 90].forEach((m, i) => bell(m, i * .075, .045, 1.3, .55)); },
    night() { [81, 76, 74, 69, 64].forEach((m, i) => bell(m, i * .095, .04, 1.7, .65)); tone({ f: mf(45), type: 'triangle', a: .7, d: 2.6, v: .035, send: .5 }); },
    weather() { noise({ buf: pink, a: .12, d: .55, v: .1, f: 450, f2: 2600, q: .8, send: .2 }); bell(pick([81, 83, 86]), .12, .025, .6, .4); },
    sparkle() { for (let i = 0; i < 5; i++) bell(pick(DAY) + 24, i * .05 + rnd() * .03, .02, .6, .6); },
    drop() { tone({ f: mf(pick([84, 86, 88, 91])), glide: mf(98), d: .09, v: .04, send: .2 }); tone({ f: mf(pick([79, 81])), t: .11, glide: mf(91), d: .07, v: .02, send: .2 }); },
    thunder() { const dist = rnd(), t = .2 + dist * 1.3; noise({ buf: brown, t, a: .06, d: 2.6 + dist, v: .55 * (1 - dist * .5), type: 'lowpass', f: 200 + (1 - dist) * 160, q: .4, to: amb, send: .35 }); if (dist < .35) noise({ t: t - .12, a: .002, d: .22, v: .18, type: 'highpass', f: 1400, to: amb, send: .3 }); },
    star() { tone({ f: mf(93), glide: mf(81), d: .8, v: .025, send: .65, partial: 2.76 }); },
    lantern() { bell(69, 0, .035, 1.6, .65); bell(76, .16, .028, 1.6, .65); },
    whoosh() { noise({ buf: pink, a: .25, d: .8, v: .12, f: 260, f2: 2000, q: 1.1, send: .25 }); bell(86, .35, .025, .9, .5); }
  };

  /* ---------- music: pad chords + music-box melody ---------- */
  let nextChord = 0, chordI = 0, nextNote = 0, melI = 4, mode = '';
  function chord(notes, when) {
    for (const m of notes) for (const det of [-7, 7]) {
      const o = ac.createOscillator(), g = ac.createGain(), lp = bq('lowpass', m < 52 ? 420 : 900);
      o.type = 'triangle'; o.frequency.value = mf(m); o.detune.value = det;
      const v = m < 52 ? .02 : .011;
      g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(v, when + 3.2); g.gain.setValueAtTime(v, when + 7.5); g.gain.linearRampToValueAtTime(0, when + 11);
      o.connect(lp); lp.connect(g); g.connect(music); g.connect(gain(.5, verb)); o.start(when); o.stop(when + 11.2);
    }
  }
  function musicTick() {
    if (!started) return; const now = ac.currentTime, night = isDark(), m = night ? 'night' : 'day';
    if (m !== mode) { mode = m; nextChord = Math.min(nextChord, now + .3); }
    if (now + .2 >= nextChord) { chord(PROG[m][chordI++ % 4], Math.max(now, nextChord)); nextChord = Math.max(now, nextChord) + 9; }
    const sc = night ? NIGHT : DAY;
    while (nextNote < now + .4) {
      if (rnd() < .58) { melI = clamp(melI + pick([-2, -1, -1, 0, 1, 1, 2]), 0, sc.length - 1); tone({ f: mf(sc[melI] + 12), t: Math.max(0, nextNote - now), a: .004, d: 1.8, v: .042, to: music, send: .6, partial: 2.0, pan: (rnd() - .5) * .5 }); }
      nextNote += pick([.6, .9, 1.2, 1.2, 1.8, 2.4]);
    }
  }

  /* ---------- ambience follows the sky ---------- */
  let birdT = 3, crickT = 2, lastAmb = 0;
  function ambTick() {
    if (!started) return; const now = ac.currentTime, dt = Math.min(1, now - lastAmb || .25); lastAmb = now;
    const P = (window.PixelSky && window.PixelSky.params) || { rain: 0, wind: 3, snow: 0, storm: 0 }, night = window.PixelSky ? window.PixelSky.night > .5 : isDark();
    rainG.gain.setTargetAtTime(clamp(P.rain, 0, 2) * .16, now, .8);
    const w = clamp((P.wind - 3) / 18, 0, 1); windG.gain.setTargetAtTime(.012 + w * .14 + P.snow * .03, now, 1.2);
    windF.frequency.setTargetAtTime(320 + Math.sin(now * .23) * 120 + w * 420, now, .9);
    amb.gain.setTargetAtTime(.9 * duck, now, .6); music.gain.setTargetAtTime(.75 * duck, now, 1.2);
    const calm = P.rain < .2 && P.snow < .2 && P.wind < 12;
    if (calm && !night && (birdT -= dt) < 0) { birdT = 4 + rnd() * 8; const n = 2 + (rnd() * 4 | 0), base = 2400 + rnd() * 1400, pan = (rnd() - .5) * 1.4;
      for (let i = 0; i < n; i++) tone({ f: base * (1 + rnd() * .15), glide: base * (1.25 + rnd() * .3), t: i * (.09 + rnd() * .05), a: .005, d: .07, v: .012, to: amb, send: .25, pan }); }
    if (calm && night && (crickT -= dt) < 0) { crickT = 1.5 + rnd() * 3.5; const pan = (rnd() - .5) * 1.4, f = 4300 + rnd() * 500;
      for (let k = 0; k < 2 + (rnd() * 2 | 0); k++) for (let i = 0; i < 3; i++) tone({ f, t: k * .32 + i * .045, a: .003, d: .028, v: .006, to: amb, send: .15, pan }); }
  }

  /* ---------- on / off ---------- */
  let timers = [];
  function start() {
    if (!init()) return; ac.resume && ac.resume();
    if (!started) { started = true; nextChord = ac.currentTime + .4; nextNote = ac.currentTime + 1.6; lastAmb = ac.currentTime; timers = [setInterval(musicTick, 120), setInterval(ambTick, 250)]; }
    master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(1, ac.currentTime, .5);
  }
  function stop() {
    if (!ac) return; master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(0, ac.currentTime, .2);
    setTimeout(() => { if (!on && ac) { timers.forEach(clearInterval); timers = []; started = false; ac.suspend && ac.suspend(); } }, 900);
  }
  function play(name) { if (on && started && SFX[name]) try { SFX[name](); } catch (e) {} }
  function set(v, btn) {
    on = v; try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch (e) {}
    if (v) { start(); setTimeout(() => play('open'), 60); } else stop();
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
    // remembered "on": browsers need a tap before audio may start, so start on the first one
    if (on) { const first = e => { if (e.target.closest && e.target.closest('.sound-toggle')) return; start(); D.removeEventListener('pointerdown', first, true); D.removeEventListener('keydown', first, true); };
      D.addEventListener('pointerdown', first, true); D.addEventListener('keydown', first, true); }
    // ui sounds
    D.addEventListener('click', e => {
      if (!on || !started || !e.target.closest) return;
      const acc = e.target.closest('.accordion-header');
      if (acc) { setTimeout(() => play(acc.closest('.accordion-item').classList.contains('open') ? 'open' : 'close'), 0); return; }
      if (e.target.closest('.sound-toggle, .theme-toggle, .weather-toggle, .ft-up, pixel-dog, .pond-section')) return;
      if (e.target.closest('button, a, .skill-orb, .painted-card')) play('tap');
    }, true);
    D.addEventListener('sky:sfx', e => play(e.detail));
    new MutationObserver(() => play(isDark() ? 'night' : 'day')).observe(R, { attributes: true, attributeFilter: ['data-theme'] });
    D.addEventListener('visibilitychange', () => { if (!ac || !on) return; if (D.hidden) ac.suspend && ac.suspend(); else if (started) ac.resume && ac.resume(); });
    // the koi pond has its own sounds: duck the music and ambience while it is on screen
    const pond = D.getElementById('pond');
    if (pond && 'IntersectionObserver' in window) new IntersectionObserver(es => { duck = es[es.length - 1].isIntersecting ? .25 : 1; }, { threshold: .3 }).observe(pond);
  }
  window.SiteSound = { play, get on() { return on; }, set: v => set(!!v) };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0)); else setTimeout(boot, 0);
})();
