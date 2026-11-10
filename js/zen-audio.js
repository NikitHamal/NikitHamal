/**
 * ZEN SOUNDSCAPE - Web Audio Tibetan Singing Bowl & Chime Synthesis
 * Pure math synthesis: 0 bytes audio asset overhead, zero latency, warm harmonic resonance.
 */

(function () {
  'use strict';

  class ZenSoundEngine {
    constructor() {
      this.ctx = null;
      this.isMuted = true; // Respectful default: muted until user activates sound or clicks sound toggle
      this.hasInteracted = false;

      // Check stored preference
      try {
        const stored = localStorage.getItem('nikit-sound-muted');
        if (stored !== null) {
          this.isMuted = stored === 'true';
        }
      } catch (e) {}

      this.updateUI();
      this.bindControls();
    }

    initContext() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    bindControls() {
      const toggles = document.querySelectorAll('[data-sound-toggle]');
      toggles.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.initContext();
          this.isMuted = !this.isMuted;
          try {
            localStorage.setItem('nikit-sound-muted', String(this.isMuted));
          } catch (err) {}
          this.updateUI();

          if (!this.isMuted) {
            // Play gentle welcoming chime when unmuted
            this.playSingingBowl(432, 1.8);
          }
        });
      });
    }

    updateUI() {
      const toggles = document.querySelectorAll('[data-sound-toggle]');
      toggles.forEach((btn) => {
        btn.setAttribute('aria-pressed', String(!this.isMuted));
        btn.setAttribute('title', this.isMuted ? 'Soundscape muted (click to unmute)' : 'Soundscape active (click to mute)');
        const icon = btn.querySelector('.sound-icon');
        if (icon) {
          icon.innerHTML = this.isMuted
            ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
            : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
        }
        const text = btn.querySelector('.sound-label');
        if (text) {
          text.textContent = this.isMuted ? 'Muted' : 'Resonance On';
        }
      });
    }

    playSingingBowl(freq = 432, dur = 2.4) {
      if (this.isMuted) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      // Tibetan singing bowl harmonic ratios: 1x, 2.76x, 5.40x
      const partials = [
        { mult: 1.0, gain: 0.22, decay: dur },
        { mult: 2.76, gain: 0.12, decay: dur * 0.75 },
        { mult: 5.4, gain: 0.05, decay: dur * 0.45 },
        { mult: 8.93, gain: 0.02, decay: dur * 0.25 }
      ];

      partials.forEach((p) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * p.mult, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(p.gain, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + p.decay + 0.1);
      });
    }

    playChime(ratio = 0.5) {
      if (this.isMuted) return;
      // Pentatonic scale frequencies in Hz
      const scale = [384, 432, 480, 576, 648, 720];
      const idx = Math.floor(Math.max(0, Math.min(1, ratio)) * scale.length);
      const freq = scale[Math.min(idx, scale.length - 1)];
      this.playSingingBowl(freq, 1.4);
    }
  }

  window.ZenSound = new ZenSoundEngine();
})();
