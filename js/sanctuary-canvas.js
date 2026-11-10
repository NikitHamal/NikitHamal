/**
 * NIKIT HAMAL — 2D PIXEL-ART SANCTUARY CANVASES (js/sanctuary-canvas.js)
 * Zero-lag integer-grid pixel rendering with IntersectionObserver lifecycle.
 */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const visibleCanvases = new Set();

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) visibleCanvases.add(e.target);
          else visibleCanvases.delete(e.target);
        });
      }, { rootMargin: '200px 0px' })
    : null;

  function watchCanvas(canvas) {
    if (!canvas) return;
    if (io) io.observe(canvas);
    else visibleCanvases.add(canvas);
  }

  function currentPhase() {
    return document.documentElement.getAttribute('data-phase') || 'day';
  }

  // Helper: integer pixel rect
  function pxRect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  // =========================================================================
  // 1. BRAND PIXEL SEAL (24x24 flickering temple butter-lamp / astrolabe)
  // =========================================================================
  const sealCanvas = document.getElementById('brandSealCanvas');
  const sealCtx = sealCanvas ? sealCanvas.getContext('2d') : null;
  if (sealCanvas && sealCtx) {
    sealCanvas.width = 16;
    sealCanvas.height = 16;
    sealCtx.imageSmoothingEnabled = false;
    watchCanvas(sealCanvas);
  }

  function drawSeal(t) {
    if (!sealCtx || !visibleCanvases.has(sealCanvas)) return;
    const phase = currentPhase();
    const isDark = phase === 'dusk' || phase === 'night';
    sealCtx.clearRect(0, 0, 16, 16);

    // Background disk
    pxRect(sealCtx, 1, 1, 14, 14, isDark ? '#181d28' : '#efe7da');
    // Border corners
    pxRect(sealCtx, 2, 1, 12, 1, '#c84b31');
    pxRect(sealCtx, 2, 14, 12, 1, '#c84b31');
    pxRect(sealCtx, 1, 2, 1, 12, '#c84b31');
    pxRect(sealCtx, 14, 2, 1, 12, '#c84b31');

    // Diya bowl (terracotta)
    pxRect(sealCtx, 4, 10, 8, 2, '#b84a27');
    pxRect(sealCtx, 5, 12, 6, 1, '#8c3419');

    // Flame flicker
    const fl = Math.sin(t * 0.008) > 0 ? 1 : 0;
    pxRect(sealCtx, 7, 5 + fl, 2, 5 - fl, '#f3a833');
    pxRect(sealCtx, 7, 7, 2, 3, '#fff3b0');
    pxRect(sealCtx, 7 + (fl ? 0 : 1), 4, 1, 1, '#e07a5f');
  }

  // =========================================================================
  // 2. HERO DIORAMA: THE HIMALAYAN SANCTUARY WINDOW (192 x 136 logical px)
  // =========================================================================
  const heroCanvas = document.getElementById('heroDioramaCanvas');
  const heroCtx = heroCanvas ? heroCanvas.getContext('2d') : null;
  const W = 192, H = 136;

  const heroState = {
    lampBoost: 0.4,
    lampsLit: 1,
    dogAwake: 0, // >0 means awake timer
    lanterns: [],
    petals: [],
    stars: [],
    clouds: [
      { x: 18, y: 28, w: 26, speed: 0.012 },
      { x: 96, y: 20, w: 34, speed: 0.008 },
      { x: 152, y: 34, w: 22, speed: 0.015 }
    ],
    pointerX: 0.5,
    pointerY: 0.5
  };

  // Seed stars & petals
  for (let i = 0; i < 36; i++) {
    heroState.stars.push({
      x: (i * 37 + 13) % (W - 24) + 12,
      y: (i * 23 + 7) % 62 + 8,
      phase: i * 0.9,
      bright: i % 3 === 0
    });
  }
  for (let i = 0; i < 16; i++) {
    heroState.petals.push({
      x: (i * 19) % W,
      y: (i * 11) % H,
      vx: 0.08 + (i % 3) * 0.03,
      vy: 0.12 + (i % 4) * 0.03,
      c: i % 2 === 0 ? '#f4a4b8' : '#ffd6e0'
    });
  }
  // Initial floating lantern
  heroState.lanterns.push({ x: 132, y: 64, vy: 0.06, phase: 1.2 });

  if (heroCanvas && heroCtx) {
    heroCanvas.width = W;
    heroCanvas.height = H;
    heroCtx.imageSmoothingEnabled = false;
    watchCanvas(heroCanvas);

    heroCanvas.addEventListener('pointermove', (e) => {
      const r = heroCanvas.getBoundingClientRect();
      if (!r.width) return;
      heroState.pointerX = (e.clientX - r.left) / r.width;
      heroState.pointerY = (e.clientY - r.top) / r.height;
    }, { passive: true });

    heroCanvas.addEventListener('click', (e) => {
      const r = heroCanvas.getBoundingClientRect();
      const lx = ((e.clientX - r.left) / r.width) * W;
      const ly = ((e.clientY - r.top) / r.height) * H;

      // Check if clicked near Rottie dog (x: 112..142, y: 102..124)
      if (lx >= 106 && lx <= 148 && ly >= 96 && ly <= 128) {
        triggerDogWake();
        return;
      }
      // Check if clicked near Butter Lamp (x: 82..105, y: 96..124)
      if (lx >= 78 && lx <= 106 && ly >= 92 && ly <= 126) {
        triggerKindleLamp();
        return;
      }
      // Otherwise spawn a floating sky lantern at click position
      spawnSkyLantern(lx, Math.min(ly, 96));
    });
  }

  function spawnSkyLantern(x, y) {
    heroState.lanterns.push({
      x: Math.max(18, Math.min(W - 18, x || (60 + Math.random() * 80))),
      y: y || 88,
      vy: 0.09 + Math.random() * 0.05,
      phase: Math.random() * 6.28
    });
    if (heroState.lanterns.length > 14) heroState.lanterns.shift();
    heroState.lampsLit++;
    updateDioramaStatus(`Lantern released · ${heroState.lampsLit} blessings glowing`);
    if (window.SanctuaryAudio) window.SanctuaryAudio.chime(528);
  }

  function triggerKindleLamp() {
    heroState.lampBoost = 1.4;
    heroState.lampsLit++;
    spawnSkyLantern(92 + (Math.random() * 16 - 8), 96);
    updateDioramaStatus(`Butter lamp kindled · Agni aura active`);
    if (window.SanctuaryAudio) window.SanctuaryAudio.chime(639);
  }

  function triggerDogWake() {
    heroState.dogAwake = 240; // ~4 seconds of tail wag & heart
    updateDioramaStatus(`Rottie companion awake ♥ · Tail wagging`);
    if (window.SanctuaryAudio) window.SanctuaryAudio.chime(432);
  }

  function updateDioramaStatus(msg) {
    const el = document.getElementById('dioramaStatusText');
    if (el) el.textContent = msg;
  }

  // Expose actions for buttons below the diorama
  window.SanctuaryDiorama = {
    kindle: triggerKindleLamp,
    wakeDog: triggerDogWake,
    releaseLantern: () => spawnSkyLantern(54 + Math.random() * 84, 86)
  };

  const PALETTES = {
    dawn: {
      sky: ['#2b2340', '#5e3c58', '#a85a5c', '#e08963', '#f5c181'],
      mtnFar: '#594157',
      mtnMid: '#3d2d44',
      mtnSnow: '#FAD6A5',
      mtnShadow: '#463249',
      mist: 'rgba(246, 214, 180, 0.22)',
      celestial: '#ffe3a8',
      isNight: false
    },
    day: {
      sky: ['#3d6cb9', '#5a8bd6', '#83aee8', '#b5d2f2', '#e4effa'],
      mtnFar: '#6b88b8',
      mtnMid: '#435d8a',
      mtnSnow: '#ffffff',
      mtnShadow: '#7b99c9',
      mist: 'rgba(255, 255, 255, 0.28)',
      celestial: '#fff6cc',
      isNight: false
    },
    dusk: {
      sky: ['#141020', '#2b192e', '#59253a', '#993d3d', '#d97642'],
      mtnFar: '#381e30',
      mtnMid: '#221320',
      mtnSnow: '#f29f6d',
      mtnShadow: '#4a2434',
      mist: 'rgba(217, 118, 66, 0.18)',
      celestial: '#ffae52',
      isNight: true
    },
    night: {
      sky: ['#070a12', '#0d1322', '#141e33', '#1c2942', '#263654'],
      mtnFar: '#182238',
      mtnMid: '#101726',
      mtnSnow: '#9ab3d9',
      mtnShadow: '#1e2c47',
      mist: 'rgba(122, 162, 247, 0.12)',
      celestial: '#eef4ff',
      isNight: true
    }
  };

  function drawHeroDiorama(t) {
    if (!heroCtx || !visibleCanvases.has(heroCanvas)) return;
    const phase = currentPhase();
    const pal = PALETTES[phase] || PALETTES.day;

    // 1. Stepped Sky Gradient Bands
    const bandH = Math.ceil(98 / pal.sky.length);
    for (let i = 0; i < pal.sky.length; i++) {
      pxRect(heroCtx, 0, i * bandH, W, bandH + 1, pal.sky[i]);
    }

    // Dithered transition lines between sky bands
    for (let i = 1; i < pal.sky.length; i++) {
      const y = i * bandH;
      heroCtx.fillStyle = pal.sky[i - 1];
      for (let x = 0; x < W; x += 2) {
        heroCtx.fillRect(x + (y % 2), y, 1, 1);
      }
    }

    // 2. Stars (in night / dusk / dawn top sky)
    if (phase === 'night' || phase === 'dusk' || phase === 'dawn') {
      const maxStarY = phase === 'night' ? 68 : 34;
      heroState.stars.forEach((st) => {
        if (st.y > maxStarY) return;
        const tw = Math.sin(t * 0.004 + st.phase);
        if (tw > -0.2) {
          pxRect(heroCtx, st.x, st.y, 1, 1, tw > 0.6 && st.bright ? '#ffffff' : '#b8c7e0');
        }
      });
    }

    // 3. Celestial Body (Sun or Crescent Moon)
    const cx = phase === 'dawn' ? 142 : phase === 'day' ? 136 : phase === 'dusk' ? 146 : 144;
    const cy = phase === 'dawn' ? 46 : phase === 'day' ? 26 : phase === 'dusk' ? 52 : 24;
    if (phase === 'night') {
      // Pixel Crescent Moon
      pxRect(heroCtx, cx - 4, cy - 4, 9, 9, '#eef4ff');
      pxRect(heroCtx, cx - 5, cy - 2, 11, 5, '#eef4ff');
      pxRect(heroCtx, cx - 2, cy - 5, 5, 11, '#eef4ff');
      // Carve shadow for crescent
      pxRect(heroCtx, cx - 5, cy - 4, 6, 7, pal.sky[1]);
    } else {
      // Sun with warm pixel halo
      pxRect(heroCtx, cx - 6, cy - 6, 13, 13, pal.sky[pal.sky.length - 1]);
      pxRect(heroCtx, cx - 4, cy - 4, 9, 9, pal.celestial);
      pxRect(heroCtx, cx - 5, cy - 2, 11, 5, pal.celestial);
      pxRect(heroCtx, cx - 2, cy - 5, 5, 11, pal.celestial);
    }

    // 4. Drifting Pixel Clouds
    heroState.clouds.forEach((cl) => {
      if (!reduceMotion) {
        cl.x += cl.speed;
        if (cl.x > W + 20) cl.x = -cl.w - 10;
      }
      const cloudCol = phase === 'night' ? '#24334f' : phase === 'dusk' ? '#7a3b46' : '#f8f5ef';
      const cx0 = Math.round(cl.x);
      pxRect(heroCtx, cx0 + 4, cl.y, cl.w - 8, 3, cloudCol);
      pxRect(heroCtx, cx0, cl.y + 2, cl.w, 3, cloudCol);
    });

    // 5. Sacred Machapuchare (Fishtail Peak) & Annapurna Ridge
    const pxOff = Math.round((heroState.pointerX - 0.5) * 4);
    drawMachapuchare(heroCtx, 96 + pxOff, 24, pal);

    // 6. Valley Mist Strip
    heroCtx.fillStyle = pal.mist;
    heroCtx.fillRect(0, 76, W, 8);
    heroCtx.fillRect(0, 82, W, 5);

    // 7. Floating Sky Lanterns / Fireflies
    for (let i = heroState.lanterns.length - 1; i >= 0; i--) {
      const ln = heroState.lanterns[i];
      if (!reduceMotion) {
        ln.y -= ln.vy;
        ln.x += Math.sin(t * 0.003 + ln.phase) * 0.08;
      }
      const lx = Math.round(ln.x), ly = Math.round(ln.y);
      pxRect(heroCtx, lx - 1, ly - 1, 3, 4, '#e07a3c');
      pxRect(heroCtx, lx, ly, 1, 2, '#fff3b0');
      if (ly < 6) {
        ln.y = 92;
      }
    }

    // 8. Swaying Himalayan Prayer Flags (Lungta) across upper window
    const flagColors = ['#3b78b8', '#f4f1ea', '#c84b31', '#3b8c62', '#e5a93c'];
    for (let i = 0; i < 15; i++) {
      const fx = 16 + i * 11;
      const sag = Math.round(Math.sin((i / 14) * Math.PI) * 7 + Math.sin(t * 0.004 + i * 0.5) * 1.2);
      const fy = 14 + sag;
      // String pixel
      pxRect(heroCtx, fx, fy - 1, 11, 1, '#3a2e28');
      // Flag cloth
      if (i < 14) {
        pxRect(heroCtx, fx + 2, fy, 6, 5, flagColors[i % 5]);
        pxRect(heroCtx, fx + 3, fy + 5, 4, 1, flagColors[i % 5]);
      }
    }

    // 9. Courtyard Stone Terrace Floor (y: 94..136)
    const floorTop = 94;
    pxRect(heroCtx, 0, floorTop, W, H - floorTop, pal.isNight ? '#16171d' : '#d8cfc0');
    pxRect(heroCtx, 0, floorTop, W, 2, pal.isNight ? '#282a36' : '#b5a895');
    // Stone tile joints
    for (let tx = 14; tx < W; tx += 24) {
      pxRect(heroCtx, tx, floorTop + 2, 1, H - floorTop - 2, pal.isNight ? '#111217' : '#c4b8a6');
    }
    pxRect(heroCtx, 0, 112, W, 1, pal.isNight ? '#111217' : '#c4b8a6');

    // 10. Overhanging Sakura / Rhododendron Tree Branch (Left side)
    pxRect(heroCtx, 10, 26, 16, 4, '#3b261e');
    pxRect(heroCtx, 22, 29, 14, 3, '#3b261e');
    pxRect(heroCtx, 32, 31, 8, 2, '#3b261e');
    // Blossom clusters
    const blossoms = [
      [14, 22, 12, 6], [24, 24, 14, 6], [34, 28, 10, 5], [18, 28, 10, 5]
    ];
    blossoms.forEach(([bx, by, bw, bh], idx) => {
      pxRect(heroCtx, bx, by, bw, bh, idx % 2 === 0 ? '#e68fa5' : '#f4b8c8');
      pxRect(heroCtx, bx + 2, by + 1, bw - 4, bh - 2, '#ffdbe5');
    });

    // Drifting Petals
    heroState.petals.forEach((pt) => {
      if (!reduceMotion) {
        pt.x += pt.vx;
        pt.y += pt.vy;
        if (pt.x > W - 12) pt.x = 14;
        if (pt.y > 122) pt.y = 26;
      }
      pxRect(heroCtx, pt.x, pt.y, 2, 1, pt.c);
    });

    // 11. Engineer (Nikit) Seated at Low Wooden Studio Desk (x: 36..76, y: 78..118)
    // Woven meditation mat
    pxRect(heroCtx, 30, 112, 46, 5, '#8c3b2b');
    pxRect(heroCtx, 32, 113, 42, 3, '#c86446');
    // Seated figure (back/three-quarter profile)
    // Head & dark hair
    pxRect(heroCtx, 42, 80, 9, 9, '#d69f7e');
    pxRect(heroCtx, 41, 78, 10, 5, '#1c1817');
    pxRect(heroCtx, 41, 81, 3, 5, '#1c1817');
    // Kurta / shawl torso
    pxRect(heroCtx, 38, 89, 15, 16, pal.isNight ? '#34495e' : '#2c4a3e');
    pxRect(heroCtx, 36, 93, 19, 12, pal.isNight ? '#2c3e50' : '#233b31');
    // Crossed legs
    pxRect(heroCtx, 35, 105, 22, 7, '#1f242d');

    // Low wooden desk & glowing pixel laptop (x: 56..78)
    pxRect(heroCtx, 55, 101, 24, 3, '#6e472b');
    pxRect(heroCtx, 57, 104, 3, 9, '#4f321d');
    pxRect(heroCtx, 74, 104, 3, 9, '#4f321d');
    // Laptop screen & base
    pxRect(heroCtx, 58, 99, 14, 2, '#9aa5b4');
    pxRect(heroCtx, 63, 90, 10, 9, '#28303d');
    pxRect(heroCtx, 64, 91, 8, 7, '#111924');
    // Scrolling pixel code lines on screen
    const codeTick = Math.floor(t / 280) % 3;
    pxRect(heroCtx, 65, 92 + (codeTick === 0 ? 1 : 0), 5, 1, '#56c288');
    pxRect(heroCtx, 65, 94, 6, 1, '#e5a94c');
    pxRect(heroCtx, 65, 96, 4, 1, '#7aa2f7');
    // Steaming tea cup on desk
    pxRect(heroCtx, 56, 98, 3, 3, '#f0e6d2');
    if (Math.floor(t / 400) % 2 === 0) {
      pxRect(heroCtx, 57, 95, 1, 2, 'rgba(255,255,255,0.6)');
    }

    // 12. Stone Temple Butter Lamp (Diyā) at center-right (x: 88..100, y: 98..116)
    if (heroState.lampBoost > 0.4) heroState.lampBoost = Math.max(0.4, heroState.lampBoost - 0.008);
    // Warm aura glow
    const glowR = Math.round(12 + heroState.lampBoost * 10 + Math.sin(t * 0.01) * 2);
    heroCtx.fillStyle = 'rgba(243, 168, 51, 0.16)';
    heroCtx.fillRect(93 - glowR, 98 - glowR / 2, glowR * 2, glowR);
    // Pedestal
    pxRect(heroCtx, 89, 111, 10, 4, '#5a554c');
    pxRect(heroCtx, 91, 105, 6, 6, '#736d62');
    pxRect(heroCtx, 88, 102, 12, 3, '#8c583a');
    // Flickering flame
    const fShift = Math.sin(t * 0.012) > 0 ? 1 : 0;
    const fH = heroState.lampBoost > 0.7 ? 8 : 5;
    pxRect(heroCtx, 92, 102 - fH, 4, fH, '#f39c12');
    pxRect(heroCtx, 93, 102 - fH + 1, 2, fH - 1, '#fff5b8');
    pxRect(heroCtx, 93 + fShift, 101 - fH, 1, 2, '#e74c3c');

    // 13. Pixel Rottweiler Companion (x: 116..142, y: 102..116)
    const isAwake = heroState.dogAwake > 0;
    if (isAwake) heroState.dogAwake--;
    // Rug under dog
    pxRect(heroCtx, 112, 113, 32, 3, '#5c6b57');
    if (isAwake) {
      // Sitting / Alert Rottie with wagging tail
      const wag = Math.floor(t / 110) % 2;
      // Body
      pxRect(heroCtx, 118, 104, 15, 9, '#1c1a17');
      // Tan chest & paws
      pxRect(heroCtx, 117, 106, 4, 5, '#c87d3b');
      pxRect(heroCtx, 116, 111, 4, 3, '#c87d3b');
      pxRect(heroCtx, 129, 111, 4, 3, '#c87d3b');
      // Head
      pxRect(heroCtx, 114, 98, 9, 8, '#1c1a17');
      pxRect(heroCtx, 112, 101, 4, 4, '#1c1a17'); // snout
      pxRect(heroCtx, 113, 102, 3, 2, '#c87d3b'); // tan muzzle
      pxRect(heroCtx, 115, 99, 1, 1, '#ffffff');  // bright eye
      // Wagging tail
      pxRect(heroCtx, 133, 102 + wag * 2, 4, 2, '#1c1a17');
      // Floating Pixel Heart ♥ above Rottie
      const hy = 89 - Math.round((240 - heroState.dogAwake) * 0.03) % 6;
      pxRect(heroCtx, 117, hy, 2, 2, '#e05263');
      pxRect(heroCtx, 120, hy, 2, 2, '#e05263');
      pxRect(heroCtx, 116, hy + 1, 7, 2, '#e05263');
      pxRect(heroCtx, 117, hy + 3, 5, 1, '#e05263');
      pxRect(heroCtx, 118, hy + 4, 3, 1, '#e05263');
      pxRect(heroCtx, 119, hy + 5, 1, 1, '#e05263');
    } else {
      // Sleeping Rottie (breathing)
      const breath = Math.sin(t * 0.003) > 0.3 ? 1 : 0;
      pxRect(heroCtx, 118, 107 - breath, 16, 6 + breath, '#1c1a17');
      pxRect(heroCtx, 113, 108, 7, 5, '#1c1a17');
      pxRect(heroCtx, 113, 110, 4, 3, '#c87d3b');
      pxRect(heroCtx, 134, 110, 4, 2, '#c87d3b');
      // Little 'z' sleep bubble
      if (Math.floor(t / 700) % 2 === 0) {
        pxRect(heroCtx, 114, 102, 3, 1, '#b8c7e0');
        pxRect(heroCtx, 115, 103, 1, 1, '#b8c7e0');
        pxRect(heroCtx, 114, 104, 3, 1, '#b8c7e0');
      }
    }

    // 14. Carved Himalayan Timber Arch Frame (Foreground Architectural Window)
    const woodDark = '#241812';
    const woodMid = '#3b271d';
    const woodTrim = '#8c583a';
    // Outer pillars
    pxRect(heroCtx, 0, 0, 10, H, woodDark);
    pxRect(heroCtx, W - 10, 0, 10, H, woodDark);
    pxRect(heroCtx, 8, 10, 2, H - 20, woodTrim);
    pxRect(heroCtx, W - 10, 10, 2, H - 20, woodTrim);
    // Top lintel & stepped Newari arch brackets
    pxRect(heroCtx, 0, 0, W, 10, woodDark);
    pxRect(heroCtx, 10, 8, W - 20, 2, woodTrim);
    // Stepped corbels in top corners
    pxRect(heroCtx, 10, 10, 14, 4, woodMid);
    pxRect(heroCtx, 10, 14, 9, 4, woodMid);
    pxRect(heroCtx, 10, 18, 5, 4, woodMid);
    pxRect(heroCtx, W - 24, 10, 14, 4, woodMid);
    pxRect(heroCtx, W - 19, 14, 9, 4, woodMid);
    pxRect(heroCtx, W - 15, 18, 5, 4, woodMid);
    // Bottom window sill
    pxRect(heroCtx, 0, H - 8, W, 8, woodDark);
    pxRect(heroCtx, 8, H - 10, W - 16, 2, woodTrim);
  }

  function drawMachapuchare(ctx, peakX, peakY, pal) {
    // Distant ridge on left & right
    for (let y = 0; y < 44; y++) {
      const wL = Math.round(y * 1.9);
      pxRect(ctx, 48 - wL, 42 + y, wL * 2, 1, pal.mtnFar);
      const wR = Math.round(y * 1.7);
      pxRect(ctx, 148 - wR, 44 + y, wR * 2, 1, pal.mtnFar);
    }
    // Iconic Machapuchare steep spire
    for (let y = 0; y < 58; y++) {
      // Double fishtail notch at the very top (y: 0..4)
      if (y < 4) {
        pxRect(ctx, peakX - 3 - y, peakY + y, 2 + y, 1, pal.mtnSnow);
        pxRect(ctx, peakX + 2, peakY + y, 2 + y, 1, pal.mtnShadow);
        continue;
      }
      const leftSpread = Math.round(y * 0.92);
      const rightSpread = Math.round(y * 1.05);
      // Left sunlit snow face
      pxRect(ctx, peakX - leftSpread, peakY + y, leftSpread, 1, y < 38 ? pal.mtnSnow : pal.mtnMid);
      // Right shadow ridge
      pxRect(ctx, peakX, peakY + y, rightSpread, 1, y < 30 ? pal.mtnShadow : pal.mtnMid);
      // Central ridge crags
      if (y % 3 === 0 && y < 42) {
        pxRect(ctx, peakX - 2, peakY + y, 3, 2, pal.mtnMid);
      }
    }
  }

  // =========================================================================
  // 3. 365-DAY PIXEL BOTANICAL CHRONICLE GARDEN (376 x 54 logical px)
  // =========================================================================
  const gardenCanvas = document.getElementById('gardenCanvas');
  const gardenCtx = gardenCanvas ? gardenCanvas.getContext('2d') : null;
  const GW = 376, GH = 54;
  const WEEKS = 52;
  const gardenData = [];
  let activeGardenFilter = 'all';
  let hoveredWeek = -1;

  const CATEGORIES = ['systems', 'llm', 'writing', 'systems'];
  const SAMPLE_NOTES = [
    'Shipped Nik 0.1 v12p WASM-SIMD kernel & 2,304 NikBench evals',
    'NEBians Android Jetpack Compose study feed & offline cache',
    'Essay draft: "The lie of being yourself" — non-dual inquiry',
    'Lami Nepal Pusher real-time chat & Devanagari localization',
    'AstroWeb sidereal Lahiri ephemeris & Vimshottari Dasha engine',
    'Django + Redis API latency optimization at Consica Labs',
    'Essay reflection: "The Wrong Guy Trying to Wake Up"',
    'Trained hybrid AR + diffusion transformer tokenizer in PyTorch'
  ];

  for (let w = 0; w < WEEKS; w++) {
    const seed = (w * 37 + 19) % 100;
    const level = seed < 12 ? 0 : seed < 34 ? 1 : seed < 60 ? 2 : seed < 82 ? 3 : seed < 93 ? 4 : 5;
    const cat = CATEGORIES[w % CATEGORIES.length];
    const commits = level === 0 ? 2 : level * 7 + (w % 5);
    gardenData.push({
      week: w,
      level,
      cat,
      commits,
      note: SAMPLE_NOTES[w % SAMPLE_NOTES.length]
    });
  }

  if (gardenCanvas && gardenCtx) {
    gardenCanvas.width = GW;
    gardenCanvas.height = GH;
    gardenCtx.imageSmoothingEnabled = false;
    watchCanvas(gardenCanvas);

    gardenCanvas.addEventListener('pointermove', (e) => {
      const r = gardenCanvas.getBoundingClientRect();
      if (!r.width) return;
      const x = ((e.clientX - r.left) / r.width) * GW;
      const wk = Math.max(0, Math.min(WEEKS - 1, Math.floor((x - 6) / 7)));
      if (wk !== hoveredWeek) {
        hoveredWeek = wk;
        const item = gardenData[wk];
        const readout = document.getElementById('gardenInspectReadout');
        if (readout && item) {
          readout.textContent = `Week ${wk + 1}/52 · ${item.commits} contributions — ${item.note}`;
        }
      }
    }, { passive: true });

    gardenCanvas.addEventListener('pointerleave', () => {
      hoveredWeek = -1;
    });
  }

  window.setGardenFilter = function (cat) {
    activeGardenFilter = cat || 'all';
  };

  function drawGarden(t) {
    if (!gardenCtx || !visibleCanvases.has(gardenCanvas)) return;
    const phase = currentPhase();
    const isDark = phase === 'dusk' || phase === 'night';

    gardenCtx.clearRect(0, 0, GW, GH);
    // Background sky/paper strip
    pxRect(gardenCtx, 0, 0, GW, GH, isDark ? '#151922' : '#f2ece1');
    // Terraced stone wall soil at bottom (y: 42..54)
    pxRect(gardenCtx, 0, 42, GW, 12, isDark ? '#23201d' : '#d5c8b4');
    pxRect(gardenCtx, 0, 42, GW, 2, isDark ? '#3a342e' : '#b3a38d');

    for (let w = 0; w < WEEKS; w++) {
      const d = gardenData[w];
      const match = activeGardenFilter === 'all' || d.cat === activeGardenFilter;
      const lvl = match ? d.level : 0;
      const x = 7 + w * 7;
      const isHover = w === hoveredWeek;
      const sway = (!reduceMotion && (isHover || lvl >= 3))
        ? Math.round(Math.sin(t * 0.004 + w * 0.7) * (isHover ? 1.4 : 0.6))
        : 0;

      // Soil stone marker
      pxRect(gardenCtx, x, 44, 5, 4, isHover ? '#e07a5f' : (isDark ? '#302b27' : '#bfb09c'));

      if (lvl === 0) {
        // Moss pebble
        pxRect(gardenCtx, x + 1, 40, 3, 2, isDark ? '#3d4b41' : '#96ab94');
      } else if (lvl === 1) {
        // Sprout
        pxRect(gardenCtx, x + 2, 35, 1, 7, '#589c68');
        pxRect(gardenCtx, x + 1 + sway, 34, 3, 2, '#82c98d');
      } else if (lvl === 2) {
        // Mountain Fern
        pxRect(gardenCtx, x + 2, 29, 1, 13, '#3b7d4f');
        pxRect(gardenCtx, x + sway, 31, 5, 3, '#589c68');
        pxRect(gardenCtx, x + 1 + sway, 27, 3, 3, '#82c98d');
      } else if (lvl === 3) {
        // Tall Bamboo Shoot
        pxRect(gardenCtx, x + 2, 21, 1, 21, '#2b6e46');
        pxRect(gardenCtx, x + sway, 26, 5, 2, '#4d9260');
        pxRect(gardenCtx, x + sway, 20, 5, 3, '#74b882');
      } else if (lvl === 4) {
        // Blooming Himalayan Lotus
        pxRect(gardenCtx, x + 2, 22, 1, 20, '#2b6e46');
        pxRect(gardenCtx, x + sway, 29, 5, 2, '#4d9260');
        pxRect(gardenCtx, x + sway, 18, 5, 4, '#e07a5f');
        pxRect(gardenCtx, x + 1 + sway, 16, 3, 3, '#f7b2a1');
      } else {
        // Golden Temple Pine & Blossom (Peak Craft)
        pxRect(gardenCtx, x + 2, 16, 1, 26, '#5c3c24');
        pxRect(gardenCtx, x - 1 + sway, 24, 7, 4, '#2b6e46');
        pxRect(gardenCtx, x + sway, 18, 5, 5, '#3b8c5a');
        pxRect(gardenCtx, x + 1 + sway, 13, 3, 4, '#f3a833');
        pxRect(gardenCtx, x + 2 + sway, 12, 1, 2, '#fff3b0');
      }
    }
  }

  // =========================================================================
  // 4. PROJECT MONOGRAPH INTERACTIVE STAGES (NEBians, Lami Nepal, AstroWeb)
  // =========================================================================
  const projModes = { nebians: 0, lami: 0, astro: 0 };
  window.setProjectStageMode = function (proj, idx, btn) {
    projModes[proj] = idx;
    if (btn && btn.parentElement) {
      Array.from(btn.parentElement.querySelectorAll('.stage-tab-btn')).forEach((b) => {
        b.setAttribute('aria-selected', String(b === btn));
      });
    }
    if (window.SanctuaryAudio) window.SanctuaryAudio.chime(480 + idx * 60);
  };

  const nebCanvas = document.getElementById('nebiansCanvas');
  const nebCtx = nebCanvas ? nebCanvas.getContext('2d') : null;
  if (nebCanvas && nebCtx) {
    nebCanvas.width = 180;
    nebCanvas.height = 105;
    nebCtx.imageSmoothingEnabled = false;
    watchCanvas(nebCanvas);
  }

  function drawNebiansStage(t) {
    if (!nebCtx || !visibleCanvases.has(nebCanvas)) return;
    const isDark = currentPhase() === 'dusk' || currentPhase() === 'night';
    const mode = projModes.nebians || 0;
    nebCtx.clearRect(0, 0, 180, 105);

    pxRect(nebCtx, 0, 0, 180, 105, isDark ? '#141923' : '#f4EFE6');
    // Left Android Phone Frame (x: 14..74, y: 8..97)
    pxRect(nebCtx, 14, 8, 60, 89, '#1f242d');
    pxRect(nebCtx, 16, 11, 56, 83, isDark ? '#0e131a' : '#ffffff');
    // Top Material 3 app bar
    pxRect(nebCtx, 16, 11, 56, 11, '#2b5b84');
    pxRect(nebCtx, 20, 15, 24, 3, '#ffffff');

    // Right Web / Architecture Companion Panel (x: 84..168, y: 12..93)
    pxRect(nebCtx, 84, 12, 84, 81, isDark ? '#1c2230' : '#ffffff');
    pxRect(nebCtx, 84, 12, 84, 9, '#356859');
    pxRect(nebCtx, 88, 15, 36, 3, '#e8f5e9');

    if (mode === 0) {
      // Mode 0: Unified Study Feed & Past Papers
      pxRect(nebCtx, 20, 26, 48, 16, isDark ? '#1e293b' : '#e8f0f8');
      pxRect(nebCtx, 23, 29, 28, 3, '#2b5b84');
      pxRect(nebCtx, 23, 35, 38, 2, '#7b8a9e');

      pxRect(nebCtx, 20, 46, 48, 16, isDark ? '#1e293b' : '#f5ebe6');
      pxRect(nebCtx, 23, 49, 32, 3, '#c84b31');
      pxRect(nebCtx, 23, 55, 34, 2, '#7b8a9e');

      pxRect(nebCtx, 20, 66, 48, 18, isDark ? '#1e293b' : '#e8f4ec');
      pxRect(nebCtx, 23, 69, 26, 3, '#2e6b4e');

      // Right panel: Live Past Paper Syllabus nodes
      for (let r = 0; r < 4; r++) {
        const y = 27 + r * 15;
        pxRect(nebCtx, 90, y, 72, 11, isDark ? '#252d3d' : '#f4f1ea');
        pxRect(nebCtx, 93, y + 3, 8, 5, r % 2 === 0 ? '#2b5b84' : '#e07a5f');
        pxRect(nebCtx, 105, y + 4, 42, 3, isDark ? '#9aa7bd' : '#4a463f');
      }
    } else if (mode === 1) {
      // Mode 1: AI Study Arena & Instant Solver
      pxRect(nebCtx, 20, 26, 48, 22, '#243447');
      pxRect(nebCtx, 23, 30, 36, 3, '#f3a833');
      pxRect(nebCtx, 23, 36, 40, 2, '#a3b8cc');
      const pulse = Math.floor(t / 300) % 2;
      pxRect(nebCtx, 20, 52, 48, 28, isDark ? '#1b2636' : '#edf7f0');
      pxRect(nebCtx, 23, 56, 32 + pulse * 6, 3, '#2e6b4e');
      pxRect(nebCtx, 23, 63, 40, 2, '#6c8096');
      pxRect(nebCtx, 23, 69, 28, 2, '#6c8096');

      // Right panel: Neural / Django REST latency bars
      for (let b = 0; b < 6; b++) {
        const bh = 18 + ((b * 13 + Math.floor(t / 250)) % 34);
        pxRect(nebCtx, 94 + b * 11, 84 - bh, 7, bh, b % 2 === 0 ? '#356859' : '#e09f3e');
      }
    } else {
      // Mode 2: Student Discussion Forum & Exam Results
      for (let c = 0; c < 3; c++) {
        const y = 26 + c * 21;
        pxRect(nebCtx, 20, y, 48, 17, isDark ? '#1e2633' : '#f3efe6');
        pxRect(nebCtx, 23, y + 4, 6, 6, '#e07a5f');
        pxRect(nebCtx, 32, y + 4, 30, 3, '#2b5b84');
        pxRect(nebCtx, 32, y + 10, 24, 2, '#8c96a6');
      }
      // Right panel: GPA / Result distribution curve
      pxRect(nebCtx, 92, 28, 68, 54, isDark ? '#141821' : '#f7f4ec');
      pxRect(nebCtx, 98, 66, 10, 12, '#5a8bd6');
      pxRect(nebCtx, 112, 54, 10, 24, '#3b78b8');
      pxRect(nebCtx, 126, 38, 10, 40, '#2e6b4e');
      pxRect(nebCtx, 140, 46, 10, 32, '#e09f3e');
    }
  }

  // Lami Nepal Interactive Canvas
  const lamiCanvas = document.getElementById('lamiCanvas');
  const lamiCtx = lamiCanvas ? lamiCanvas.getContext('2d') : null;
  if (lamiCanvas && lamiCtx) {
    lamiCanvas.width = 180;
    lamiCanvas.height = 105;
    lamiCtx.imageSmoothingEnabled = false;
    watchCanvas(lamiCanvas);
  }

  function drawLamiStage(t) {
    if (!lamiCtx || !visibleCanvases.has(lamiCanvas)) return;
    const isDark = currentPhase() === 'dusk' || currentPhase() === 'night';
    const mode = projModes.lami || 0;
    lamiCtx.clearRect(0, 0, 180, 105);

    pxRect(lamiCtx, 0, 0, 180, 105, isDark ? '#1a1416' : '#f8efe8');
    // Crimson / Vermilion Nepali cultural header bar
    pxRect(lamiCtx, 16, 10, 148, 12, '#b83b2b');
    pxRect(lamiCtx, 22, 14, 42, 4, '#fff3d6');
    pxRect(lamiCtx, 16, 22, 148, 73, isDark ? '#241b1d' : '#ffffff');

    if (mode === 0) {
      // Profile & Ashta-Koota Gun Milan compatibility
      pxRect(lamiCtx, 24, 30, 52, 56, isDark ? '#302326' : '#fbf5ee');
      pxRect(lamiCtx, 38, 36, 24, 24, '#e07a5f');
      pxRect(lamiCtx, 30, 66, 40, 4, '#b83b2b');
      pxRect(lamiCtx, 34, 74, 32, 3, '#8c7a70');

      // Compatibility score meter (32 / 36 Gunas)
      pxRect(lamiCtx, 86, 30, 70, 26, isDark ? '#302326' : '#fdf7f2');
      pxRect(lamiCtx, 92, 36, 44, 4, '#b83b2b');
      pxRect(lamiCtx, 92, 45, 56, 5, '#e6d5c3');
      pxRect(lamiCtx, 92, 45, 48, 5, '#2e6b4e');

      pxRect(lamiCtx, 86, 62, 70, 24, isDark ? '#302326' : '#fdf7f2');
      pxRect(lamiCtx, 92, 68, 52, 4, '#d9822b');
      pxRect(lamiCtx, 92, 76, 38, 3, '#8c7a70');
    } else {
      // Real-time Pusher & FCM Chat bubbles
      const shift = Math.floor(t / 500) % 2;
      pxRect(lamiCtx, 26, 30, 78, 14, isDark ? '#33262a' : '#f2e8df');
      pxRect(lamiCtx, 32, 35, 58, 4, isDark ? '#e6d5c8' : '#4a3b36');

      pxRect(lamiCtx, 74, 50, 80, 14, '#b83b2b');
      pxRect(lamiCtx, 80, 55, 62, 4, '#ffffff');

      pxRect(lamiCtx, 26, 70, 64 + shift * 6, 14, isDark ? '#33262a' : '#f2e8df');
      pxRect(lamiCtx, 32, 75, 44, 4, '#e07a5f');
    }
  }

  // AstroWeb Interactive Vedic Kundali & Ephemeris Canvas
  const astroCanvas = document.getElementById('astroCanvas');
  const astroCtx = astroCanvas ? astroCanvas.getContext('2d') : null;
  if (astroCanvas && astroCtx) {
    astroCanvas.width = 180;
    astroCanvas.height = 105;
    astroCtx.imageSmoothingEnabled = false;
    watchCanvas(astroCanvas);
  }

  function drawAstroStage(t) {
    if (!astroCtx || !visibleCanvases.has(astroCanvas)) return;
    const mode = projModes.astro || 0;
    astroCtx.clearRect(0, 0, 180, 105);

    pxRect(astroCtx, 0, 0, 180, 105, '#12151f');

    // Left: North-Indian Diamond Lagna Kundali Chart (x: 14..94, y: 12..92)
    const x0 = 14, y0 = 12, sz = 80;
    astroCtx.strokeStyle = '#e09f3e';
    astroCtx.lineWidth = 1;
    astroCtx.strokeRect(x0 + 0.5, y0 + 0.5, sz, sz);
    astroCtx.beginPath();
    // Diagonals
    astroCtx.moveTo(x0, y0);
    astroCtx.lineTo(x0 + sz, y0 + sz);
    astroCtx.moveTo(x0 + sz, y0);
    astroCtx.lineTo(x0, y0 + sz);
    // Inner diamond
    astroCtx.moveTo(x0 + sz / 2, y0);
    astroCtx.lineTo(x0 + sz, y0 + sz / 2);
    astroCtx.lineTo(x0 + sz / 2, y0 + sz);
    astroCtx.lineTo(x0, y0 + sz / 2);
    astroCtx.closePath();
    astroCtx.stroke();

    // Highlight active Bhava (House) dot based on mode
    const houseCenters = [
      [54, 30], [34, 20], [22, 32], [34, 52],
      [22, 72], [34, 84], [54, 72], [74, 84],
      [86, 72], [74, 52], [86, 32], [74, 20]
    ];
    houseCenters.forEach(([hx, hy], idx) => {
      const isFocus = (idx % 3) === mode;
      pxRect(astroCtx, hx - 1, hy - 1, isFocus ? 4 : 2, isFocus ? 4 : 2, isFocus ? '#fff3b0' : '#7aa2f7');
    });

    // Right: Rotating Pixel Nakshatra / Planetary Ephemeris Wheel (center: 138, 52)
    const cx = 138, cy = 52;
    astroCtx.strokeStyle = 'rgba(224, 159, 62, 0.35)';
    astroCtx.beginPath();
    astroCtx.arc(cx, cy, 34, 0, Math.PI * 2);
    astroCtx.stroke();
    astroCtx.beginPath();
    astroCtx.arc(cx, cy, 20, 0, Math.PI * 2);
    astroCtx.stroke();

    // Sun at center
    pxRect(astroCtx, cx - 2, cy - 2, 5, 5, '#f3a833');
    // Orbiting Grahas
    const grahas = [
      { r: 14, sp: 0.0012, c: '#7aa2f7' },
      { r: 22, sp: -0.0008, c: '#e07a5f' },
      { r: 30, sp: 0.0005, c: '#56c288' },
      { r: 34, sp: 0.0003, c: '#f5c181' }
    ];
    grahas.forEach((g, idx) => {
      const ang = (reduceMotion ? 1 : t * g.sp) + idx * 1.7 + mode * 0.9;
      const gx = cx + Math.cos(ang) * g.r;
      const gy = cy + Math.sin(ang) * g.r;
      pxRect(astroCtx, gx - 2, gy - 2, 4, 4, g.c);
    });
  }

  // =========================================================================
  // 5. FOOTER TEMPLE REFLECTION LAKE & FLOATING BUTTER LAMPS (240 x 84 px)
  // =========================================================================
  const lakeCanvas = document.getElementById('lakeCanvas');
  const lakeCtx = lakeCanvas ? lakeCanvas.getContext('2d') : null;
  const LW = 240, LH = 84;
  const lakeState = {
    diyas: [
      { x: 52, y: 38, vx: 0.025, phase: 0.4 },
      { x: 118, y: 52, vx: 0.018, phase: 2.1 },
      { x: 184, y: 34, vx: 0.022, phase: 4.0 }
    ],
    koi: [
      { x: 70, y: 62, vx: 0.14, c: '#e05a36' },
      { x: 160, y: 46, vx: -0.11, c: '#f2c14e' },
      { x: 110, y: 70, vx: 0.09, c: '#f4ede2' }
    ],
    ripples: []
  };

  if (lakeCanvas && lakeCtx) {
    lakeCanvas.width = LW;
    lakeCanvas.height = LH;
    lakeCtx.imageSmoothingEnabled = false;
    watchCanvas(lakeCanvas);

    lakeCanvas.addEventListener('click', (e) => {
      const r = lakeCanvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * LW;
      const y = Math.max(22, Math.min(LH - 10, ((e.clientY - r.top) / r.height) * LH));
      lakeState.diyas.push({ x, y, vx: 0.02 + Math.random() * 0.015, phase: Math.random() * 6 });
      if (lakeState.diyas.length > 12) lakeState.diyas.shift();
      lakeState.ripples.push({ x, y, r: 2, maxR: 22 });
      const countEl = document.getElementById('lakeLampCount');
      if (countEl) countEl.textContent = `${lakeState.diyas.length} lamps floating`;
      if (window.SanctuaryAudio) window.SanctuaryAudio.chime(528);
    });
  }

  function drawLake(t) {
    if (!lakeCtx || !visibleCanvases.has(lakeCanvas)) return;
    lakeCtx.clearRect(0, 0, LW, LH);

    // Deep water gradient
    pxRect(lakeCtx, 0, 0, LW, 18, '#151c28');
    pxRect(lakeCtx, 0, 18, LW, 28, '#101824');
    pxRect(lakeCtx, 0, 46, LW, 38, '#0b111b');

    // Stone Ghat steps along top edge (y: 0..16)
    for (let s = 0; s < 3; s++) {
      pxRect(lakeCtx, 0, s * 5, LW, 4, s === 0 ? '#2b2927' : s === 1 ? '#22201e' : '#1a1917');
    }

    // Swimming pixel Koi beneath the surface
    lakeState.koi.forEach((k, idx) => {
      if (!reduceMotion) {
        k.x += k.vx;
        if (k.x > LW + 12) k.x = -10;
        if (k.x < -12) k.x = LW + 10;
      }
      const wag = Math.sin(t * 0.008 + idx) > 0 ? 1 : -1;
      const kx = Math.round(k.x), ky = Math.round(k.y);
      pxRect(lakeCtx, kx, ky, 6, 3, k.c);
      pxRect(lakeCtx, k.vx > 0 ? kx - 2 : kx + 6, ky + wag, 2, 2, '#ffffff');
    });

    // Expanding Water Ripples
    for (let i = lakeState.ripples.length - 1; i >= 0; i--) {
      const rp = lakeState.ripples[i];
      rp.r += 0.18;
      if (rp.r >= rp.maxR) {
        lakeState.ripples.splice(i, 1);
        continue;
      }
      lakeCtx.strokeStyle = `rgba(243, 184, 82, ${(1 - rp.r / rp.maxR) * 0.55})`;
      lakeCtx.beginPath();
      lakeCtx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.42, 0, 0, Math.PI * 2);
      lakeCtx.stroke();
    }

    // Floating Butter Lamps (Diyās) & Shimmering Water Reflections
    lakeState.diyas.forEach((d) => {
      if (!reduceMotion) {
        d.x += d.vx;
        d.y += Math.sin(t * 0.002 + d.phase) * 0.03;
        if (d.x > LW - 8) d.x = 8;
      }
      const dx = Math.round(d.x), dy = Math.round(d.y);
      // Shimmering reflection bars in water below lamp
      const fl = Math.sin(t * 0.01 + d.phase) > 0 ? 1 : 0;
      pxRect(lakeCtx, dx - 3 + fl, dy + 4, 7, 1, 'rgba(243, 168, 51, 0.55)');
      pxRect(lakeCtx, dx - 2, dy + 6, 5, 1, 'rgba(243, 168, 51, 0.35)');
      pxRect(lakeCtx, dx - 1 - fl, dy + 8, 3, 1, 'rgba(243, 168, 51, 0.2)');
      // Leaf/clay bowl
      pxRect(lakeCtx, dx - 2, dy + 1, 5, 2, '#9e472a');
      // Flame
      pxRect(lakeCtx, dx - 1, dy - 2, 3, 3, '#f3a833');
      pxRect(lakeCtx, dx, dy - 3 + fl, 1, 3, '#fff6c2');
    });
  }

  // =========================================================================
  // MASTER ANIMATION LOOP (Only ticks visible canvases)
  // =========================================================================
  function loop(now) {
    if (visibleCanvases.size > 0) {
      drawSeal(now);
      drawHeroDiorama(now);
      drawGarden(now);
      drawNebiansStage(now);
      drawLamiStage(now);
      drawAstroStage(now);
      drawLake(now);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
