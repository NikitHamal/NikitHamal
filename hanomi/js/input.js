// Hanomi — keyboard, mouse and touch input.
export const Input = {
  keys: new Set(), hit: new Set(), mx: 0, my: 0, mdown: [false, false, false], mhit: [false, false, false], wheel: 0, onScreen: false,
  touch: false, joy: { on: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 }, tbtn: { use: false, alt: false, roll: false }, tbtnHit: { use: false, alt: false, roll: false },
  enabled: true,
  init(canvas) {
    this.cv = canvas;
    addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!this.keys.has(k)) this.hit.add(k);
      this.keys.add(k);
      if (['Tab', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && this.enabled) e.preventDefault();
    });
    addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; this.keys.delete(k); });
    addEventListener('blur', () => { this.keys.clear(); this.mdown = [false, false, false]; });
    canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { this.mx = e.clientX; this.my = e.clientY; this.onScreen = true; } });
    canvas.addEventListener('pointerleave', () => { this.onScreen = false; });
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') return;
      this.mx = e.clientX; this.my = e.clientY; this.mdown[e.button] = true; this.mhit[e.button] = true; e.preventDefault();
    });
    addEventListener('pointerup', e => { if (e.pointerType === 'mouse') this.mdown[e.button] = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  },
  // touch controls live in DOM (#touch); main wires them here
  bindTouch(root) {
    this.touch = true;
    const pad = root.querySelector('.t-pad'), knob = root.querySelector('.t-knob');
    const J = this.joy;
    const upd = (x, y) => { const dx = x - J.ox, dy = y - J.oy, d = Math.hypot(dx, dy), m = 44, k = d > m ? m / d : 1; J.x = dx * k / m; J.y = dy * k / m; knob.style.transform = `translate(${dx * k}px,${dy * k}px)`; };
    pad.addEventListener('pointerdown', e => { const r = pad.getBoundingClientRect(); J.on = true; J.id = e.pointerId; J.ox = r.left + r.width / 2; J.oy = r.top + r.height / 2; upd(e.clientX, e.clientY); pad.setPointerCapture(e.pointerId); e.preventDefault(); });
    pad.addEventListener('pointermove', e => { if (J.on && e.pointerId === J.id) upd(e.clientX, e.clientY); });
    const end = e => { if (e.pointerId !== J.id) return; J.on = false; J.x = J.y = 0; knob.style.transform = ''; };
    pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
    for (const b of root.querySelectorAll('[data-t]')) {
      const k = b.dataset.t;
      b.addEventListener('pointerdown', e => { this.tbtn[k] = true; this.tbtnHit[k] = true; b.classList.add('on'); e.preventDefault(); });
      const up = () => { this.tbtn[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    }
  },
  down(k) { return this.enabled && this.keys.has(k); },
  pressed(k) { return this.enabled && this.hit.has(k); },
  endFrame() { this.hit.clear(); this.mhit = [false, false, false]; this.wheel = 0; this.tbtnHit = { use: false, alt: false, roll: false }; },
};
