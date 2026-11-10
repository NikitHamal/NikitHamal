/**
 * ZEN HIMALAYAN SANCTUARY - 2D Pixel Art Interactive Canvas
 * Handcrafted for Nikit Hamal's Portfolio
 * High-performance, 60fps, zero-lag, self-contained procedural pixel art.
 * Automatically pauses when offscreen via IntersectionObserver.
 */

(function () {
  'use strict';

  class ZenSanctuary {
    constructor(canvasId, containerId) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;
      this.container = document.getElementById(containerId) || this.canvas.parentElement;
      this.ctx = this.canvas.getContext('2d', { alpha: false });

      // Internal virtual pixel resolution (crisp retro rendering)
      this.vw = 320;
      this.vh = 200;
      this.scale = 1;

      // Offscreen buffer for crisp pixel rendering
      this.buffer = document.createElement('canvas');
      this.buffer.width = this.vw;
      this.buffer.height = this.vh;
      this.bctx = this.buffer.getContext('2d', { alpha: false });

      // Time of day: 'day', 'sunset', 'night'
      this.timeMode = 'sunset';
      this.timeProg = 0.5; // 0 = day, 0.5 = sunset, 1 = night
      this.targetProg = 0.5;

      // Interactive state
      this.mouse = { x: -100, y: -100, vx: 0, vy: 0, active: false };
      this.ripples = [];
      this.petals = [];
      this.stars = [];
      this.koi = [];
      this.tick = 0;
      this.isRunning = false;
      this.rafId = null;

      this.initStars();
      this.initPetals();
      this.initKoi();
      this.setupResize();
      this.setupEvents();
      this.setupObserver();
    }

    initStars() {
      this.stars = [];
      for (let i = 0; i < 45; i++) {
        this.stars.push({
          x: Math.floor(Math.random() * this.vw),
          y: Math.floor(Math.random() * (this.vh * 0.48)),
          brightness: Math.random(),
          speed: 0.02 + Math.random() * 0.04,
          size: Math.random() > 0.85 ? 2 : 1
        });
      }
    }

    initPetals() {
      this.petals = [];
      for (let i = 0; i < 30; i++) {
        this.petals.push({
          x: Math.random() * this.vw,
          y: Math.random() * this.vh,
          vx: 0.3 + Math.random() * 0.6,
          vy: 0.4 + Math.random() * 0.5,
          swing: Math.random() * Math.PI * 2,
          swingSpeed: 0.04 + Math.random() * 0.04,
          size: Math.random() > 0.6 ? 2 : 1,
          color: Math.random() > 0.5 ? '#fbcfe8' : '#f472b6'
        });
      }
    }

    initKoi() {
      this.koi = [
        {
          x: 210,
          y: 165,
          targetX: 210,
          targetY: 165,
          angle: -0.3,
          speed: 0.5,
          color: '#f97316',
          bellyColor: '#ffffff',
          tailAngle: 0,
          size: 7
        },
        {
          x: 250,
          y: 175,
          targetX: 250,
          targetY: 175,
          angle: 2.8,
          speed: 0.42,
          color: '#ef4444',
          bellyColor: '#fed7aa',
          tailAngle: 1.5,
          size: 6
        },
        {
          x: 180,
          y: 178,
          targetX: 180,
          targetY: 178,
          angle: 0.8,
          speed: 0.38,
          color: '#fbbf24',
          bellyColor: '#fef3c7',
          tailAngle: 3.1,
          size: 5
        }
      ];
    }

    setupResize() {
      const resize = () => {
        const rect = this.container.getBoundingClientRect();
        const displayWidth = Math.max(280, Math.floor(rect.width));
        const displayHeight = Math.max(180, Math.floor(rect.height || (rect.width * 0.62)));

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';

        this.ctx.imageSmoothingEnabled = false;
        this.scale = displayWidth / this.vw;
      };

      window.addEventListener('resize', resize, { passive: true });
      resize();
    }

    setupEvents() {
      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const scaleX = this.vw / rect.width;
        const scaleY = this.vh / rect.height;
        return {
          x: (clientX - rect.left) * scaleX,
          y: (clientY - rect.top) * scaleY
        };
      };

      const onPointerMove = (e) => {
        const pos = getPos(e);
        this.mouse.vx = pos.x - this.mouse.x;
        this.mouse.vy = pos.y - this.mouse.y;
        this.mouse.x = pos.x;
        this.mouse.y = pos.y;
        this.mouse.active = true;

        // Fish shy away slightly or swim towards ripple
        if (pos.y > 140) {
          this.koi.forEach((k) => {
            const dx = k.x - pos.x;
            const dy = k.y - pos.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 40 && dist > 5) {
              k.targetX = Math.min(300, Math.max(150, k.x + (dx / dist) * 20));
              k.targetY = Math.min(188, Math.max(145, k.y + (dy / dist) * 20));
            }
          });
        }
      };

      const onPointerDown = (e) => {
        const pos = getPos(e);
        this.createRipple(pos.x, pos.y);
        this.scatterPetals(pos.x, pos.y);

        // Sound trigger event
        if (window.ZenSound && typeof window.ZenSound.playChime === 'function') {
          window.ZenSound.playChime(pos.x / this.vw);
        }
      };

      this.canvas.addEventListener('mousemove', onPointerMove, { passive: true });
      this.canvas.addEventListener('touchmove', onPointerMove, { passive: true });
      this.canvas.addEventListener('mousedown', onPointerDown);
      this.canvas.addEventListener('touchstart', onPointerDown, { passive: true });

      this.canvas.addEventListener('mouseleave', () => {
        this.mouse.active = false;
        this.mouse.x = -100;
        this.mouse.y = -100;
      });

      // Quick time preset buttons
      const timeBtns = document.querySelectorAll('[data-zen-time]');
      timeBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const mode = btn.getAttribute('data-zen-time');
          this.setTimeMode(mode);
          timeBtns.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
    }

    setupObserver() {
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                this.start();
              } else {
                this.stop();
              }
            });
          },
          { threshold: 0.05 }
        );
        observer.observe(this.canvas);
      } else {
        this.start();
      }
    }

    setTimeMode(mode) {
      this.timeMode = mode;
      if (mode === 'day') this.targetProg = 0.0;
      else if (mode === 'sunset') this.targetProg = 0.5;
      else if (mode === 'night') this.targetProg = 1.0;
    }

    createRipple(x, y) {
      if (y < 135) y = 145 + Math.random() * 30; // Ripple in pond
      this.ripples.push({
        x: Math.floor(x),
        y: Math.floor(y),
        radius: 1,
        maxRadius: 18 + Math.random() * 10,
        alpha: 0.9
      });
    }

    scatterPetals(x, y) {
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 2;
        this.petals.push({
          x: x || 70,
          y: y || 60,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          swing: Math.random() * Math.PI * 2,
          swingSpeed: 0.08,
          size: Math.random() > 0.5 ? 2 : 1,
          color: Math.random() > 0.5 ? '#fbcfe8' : '#f43f5e',
          temp: true,
          life: 90
        });
      }
    }

    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      const loop = () => {
        if (!this.isRunning) return;
        this.update();
        this.render();
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    }

    stop() {
      this.isRunning = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }

    update() {
      this.tick++;

      // Smooth time transition
      this.timeProg += (this.targetProg - this.timeProg) * 0.04;

      // Ripples
      for (let i = this.ripples.length - 1; i >= 0; i--) {
        const r = this.ripples[i];
        r.radius += 0.45;
        r.alpha -= 0.018;
        if (r.alpha <= 0 || r.radius >= r.maxRadius) {
          this.ripples.splice(i, 1);
        }
      }

      // Petals
      const wind = Math.sin(this.tick * 0.02) * 0.4;
      for (let i = this.petals.length - 1; i >= 0; i--) {
        const p = this.petals[i];
        p.swing += p.swingSpeed;
        p.x += p.vx + wind + Math.sin(p.swing) * 0.3;
        p.y += p.vy;

        // Interaction with mouse
        if (this.mouse.active) {
          const dx = p.x - this.mouse.x;
          const dy = p.y - this.mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 28) {
            p.x += (dx / dist) * 1.5;
            p.y += (dy / dist) * 1.5;
          }
        }

        if (p.temp) {
          p.life--;
          if (p.life <= 0) this.petals.splice(i, 1);
        } else {
          if (p.y > this.vh) {
            p.y = -5;
            p.x = Math.random() * (this.vw * 0.6);
          }
          if (p.x > this.vw) p.x = -5;
        }
      }

      // Ambient ripples in pond
      if (this.tick % 80 === 0 && Math.random() > 0.3) {
        const rx = 160 + Math.random() * 130;
        const ry = 145 + Math.random() * 40;
        this.createRipple(rx, ry);
      }

      // Koi AI
      this.koi.forEach((k, idx) => {
        k.tailAngle += 0.18 + k.speed * 0.1;

        // Roam within pond bounds (x: 155..295, y: 145..188)
        if (Math.hypot(k.x - k.targetX, k.y - k.targetY) < 12 || Math.random() < 0.01) {
          k.targetX = 160 + Math.random() * 125;
          k.targetY = 146 + Math.random() * 40;
        }

        const angleToTarget = Math.atan2(k.targetY - k.y, k.targetX - k.x);
        let diff = angleToTarget - k.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        k.angle += diff * 0.05;
        k.x += Math.cos(k.angle) * k.speed;
        k.y += Math.sin(k.angle) * k.speed;

        // Keep inside water bounds
        k.x = Math.max(152, Math.min(296, k.x));
        k.y = Math.max(144, Math.min(188, k.y));
      });
    }

    // Color interpolator helper
    lerpColor(c1, c2, t) {
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * t),
        Math.round(c1[1] + (c2[1] - c1[1]) * t),
        Math.round(c1[2] + (c2[2] - c1[2]) * t)
      ];
    }

    render() {
      const b = this.bctx;
      const t = this.timeProg;

      // Color sets [day, sunset, night]
      // Sky gradients
      const skyDayTop = [160, 205, 235];
      const skyDayBottom = [230, 240, 248];

      const skySetTop = [75, 45, 95];
      const skySetBottom = [238, 120, 85];

      const skyNightTop = [12, 14, 28];
      const skyNightBottom = [32, 28, 55];

      let topCol, botCol;
      if (t < 0.5) {
        const u = t * 2;
        topCol = this.lerpColor(skyDayTop, skySetTop, u);
        botCol = this.lerpColor(skyDayBottom, skySetBottom, u);
      } else {
        const u = (t - 0.5) * 2;
        topCol = this.lerpColor(skySetTop, skyNightTop, u);
        botCol = this.lerpColor(skySetBottom, skyNightBottom, u);
      }

      // Draw Sky
      const skyGrad = b.createLinearGradient(0, 0, 0, this.vh * 0.65);
      skyGrad.addColorStop(0, `rgb(${topCol[0]},${topCol[1]},${topCol[2]})`);
      skyGrad.addColorStop(1, `rgb(${botCol[0]},${botCol[1]},${botCol[2]})`);
      b.fillStyle = skyGrad;
      b.fillRect(0, 0, this.vw, this.vh);

      // Stars & Moon (Night)
      if (t > 0.2) {
        const starAlpha = Math.min(1, (t - 0.2) * 1.3);
        b.save();
        b.globalAlpha = starAlpha;
        this.stars.forEach((s) => {
          const twinkle = 0.5 + Math.sin(this.tick * s.speed + s.x) * 0.5;
          b.fillStyle = twinkle > 0.7 ? '#ffffff' : '#fde68a';
          b.fillRect(s.x, s.y, s.size, s.size);
        });

        // Golden Crescent / Full Moon
        const moonAlpha = Math.min(1, (t - 0.3) * 1.5);
        b.globalAlpha = moonAlpha;
        b.fillStyle = '#fef08a';
        b.beginPath();
        b.arc(260, 36, 11, 0, Math.PI * 2);
        b.fill();
        // Subtle crescent shadow
        b.fillStyle = `rgb(${topCol[0]},${topCol[1]},${topCol[2]})`;
        b.beginPath();
        b.arc(256, 34, 10, 0, Math.PI * 2);
        b.fill();
        b.restore();
      }

      // Sun (Day & Sunset)
      if (t < 0.8) {
        const sunAlpha = Math.max(0, 1 - (t - 0.3) * 2);
        const sunY = 32 + t * 45;
        b.save();
        b.globalAlpha = sunAlpha;
        // Warm sun glow
        b.fillStyle = t > 0.3 ? '#f97316' : '#fef08a';
        b.beginPath();
        b.arc(245, sunY, 13, 0, Math.PI * 2);
        b.fill();
        b.restore();
      }

      // Distant Himalayan Peaks (Machapuchare / sacred range)
      this.drawMountainRange(b, t);

      // Midground: Pine hills and ancient stone wall
      this.drawHillsAndGround(b, t);

      // Water pond (Mountain spring)
      this.drawPond(b, t);

      // Koi fish
      this.drawKoi(b);

      // Ripples
      this.drawRipples(b, t);

      // Ancient Stone Pagoda Lantern
      this.drawShrineLantern(b, t);

      // Contemplative Character / Sage sitting in meditation
      this.drawContemplator(b, t);

      // Cherry blossom / ancient pine tree branch
      this.drawTreeAndBlossoms(b, t);

      // Floating wind petals
      this.drawPetals(b);

      // Temple frame border / subtle pixel vignette
      b.strokeStyle = t > 0.5 ? 'rgba(0,0,0,0.3)' : 'rgba(28,25,23,0.12)';
      b.lineWidth = 1;
      b.strokeRect(0.5, 0.5, this.vw - 1, this.vh - 1);

      // Blit offscreen buffer to display canvas crisp without blurring
      this.ctx.drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height);
    }

    drawMountainRange(b, t) {
      // Mountain colors based on time
      let snowCol = '#f8fafc';
      let rockCol = '#64748b';
      let shadeCol = '#475569';

      if (t > 0.2 && t <= 0.7) {
        // Sunset alpenglow
        snowCol = '#fecdd3';
        rockCol = '#881337';
        shadeCol = '#4c0519';
      } else if (t > 0.7) {
        // Night
        snowCol = '#94a3b8';
        rockCol = '#1e293b';
        shadeCol = '#0f172a';
      }

      // Peak 1: Left Himalayan ridge
      b.fillStyle = shadeCol;
      b.beginPath();
      b.moveTo(0, 120);
      b.lineTo(35, 80);
      b.lineTo(60, 95);
      b.lineTo(95, 62);
      b.lineTo(135, 110);
      b.lineTo(135, 130);
      b.lineTo(0, 130);
      b.fill();

      // Peak 2: Main sacred peak (Machapuchare Fishtail form)
      b.fillStyle = rockCol;
      b.beginPath();
      b.moveTo(110, 125);
      b.lineTo(155, 48); // Left twin tip
      b.lineTo(168, 62); // Saddle
      b.lineTo(182, 42); // High Fishtail peak
      b.lineTo(240, 115);
      b.lineTo(240, 130);
      b.lineTo(110, 130);
      b.fill();

      // Snow caps on sacred peak
      b.fillStyle = snowCol;
      b.beginPath();
      b.moveTo(155, 48);
      b.lineTo(168, 62);
      b.lineTo(182, 42);
      b.lineTo(195, 64);
      b.lineTo(188, 70);
      b.lineTo(178, 62);
      b.lineTo(165, 74);
      b.lineTo(148, 62);
      b.closePath();
      b.fill();

      // Snow streaks (pixel details)
      b.fillRect(174, 63, 3, 10);
      b.fillRect(158, 65, 2, 8);
      b.fillRect(184, 72, 2, 7);

      // Peak 3: Far right gentle mountain
      b.fillStyle = shadeCol;
      b.beginPath();
      b.moveTo(220, 120);
      b.lineTo(270, 72);
      b.lineTo(320, 115);
      b.lineTo(320, 130);
      b.lineTo(220, 130);
      b.fill();

      // Snow cap right
      b.fillStyle = snowCol;
      b.beginPath();
      b.moveTo(270, 72);
      b.lineTo(282, 84);
      b.lineTo(262, 84);
      b.closePath();
      b.fill();
    }

    drawHillsAndGround(b, t) {
      let hillCol = t > 0.6 ? '#14231b' : (t > 0.3 ? '#22382c' : '#2d4f3b');
      let groundCol = t > 0.6 ? '#1b1917' : (t > 0.3 ? '#292524' : '#44403c');
      let grassCol = t > 0.6 ? '#1c281e' : (t > 0.3 ? '#2d4432' : '#3f6244');

      // Midground rolling hill with tiny pine silhouettes
      b.fillStyle = hillCol;
      b.beginPath();
      b.moveTo(0, 115);
      b.bezierCurveTo(80, 100, 140, 118, 220, 112);
      b.bezierCurveTo(270, 108, 300, 115, 320, 120);
      b.lineTo(320, 142);
      b.lineTo(0, 142);
      b.fill();

      // Distant micro pine trees on ridge
      b.fillStyle = t > 0.6 ? '#0f1712' : '#192b1f';
      const pines = [18, 25, 32, 75, 82, 90, 105, 225, 235, 280, 292];
      pines.forEach((px) => {
        b.fillRect(px, 104, 2, 8);
        b.fillRect(px - 1, 106, 4, 2);
        b.fillRect(px - 2, 109, 6, 2);
      });

      // Foreground stone garden & shore
      b.fillStyle = groundCol;
      b.fillRect(0, 135, this.vw, this.vh - 135);

      // Moss / stone patches
      b.fillStyle = grassCol;
      b.fillRect(0, 134, 150, 6);
      b.fillRect(10, 138, 45, 12);
      b.fillRect(70, 136, 60, 18);
      b.fillRect(0, 145, 145, 55);

      // Ancient stone stepping stones near pond edge
      b.fillStyle = t > 0.6 ? '#292524' : '#57534e';
      b.fillRect(128, 148, 14, 8);
      b.fillRect(118, 160, 16, 9);
      b.fillRect(108, 174, 18, 10);
      b.fillRect(92, 184, 20, 11);

      // Stone highlights
      b.fillStyle = t > 0.6 ? '#3f3c39' : '#78716c';
      b.fillRect(129, 148, 12, 2);
      b.fillRect(119, 160, 14, 2);
      b.fillRect(109, 174, 16, 2);
    }

    drawPond(b, t) {
      // Clear mountain spring water
      let pondCol = t > 0.6 ? '#0f172a' : (t > 0.3 ? '#162e3b' : '#1e4b5f');
      let waterReflect = t > 0.6 ? '#1e293b' : (t > 0.3 ? '#3b2b3b' : '#33697e');

      // Pond basin on the right side
      b.fillStyle = pondCol;
      b.beginPath();
      b.moveTo(145, 144);
      b.bezierCurveTo(180, 138, 280, 139, 310, 145);
      b.bezierCurveTo(318, 155, 318, 185, 305, 192);
      b.bezierCurveTo(270, 198, 170, 198, 142, 188);
      b.bezierCurveTo(138, 170, 138, 155, 145, 144);
      b.fill();

      // Subtle water shimmer lines
      b.fillStyle = waterReflect;
      const waveOffset = Math.sin(this.tick * 0.04) * 2;
      b.fillRect(170 + waveOffset, 150, 40, 1);
      b.fillRect(230 - waveOffset, 154, 50, 1);
      b.fillRect(185 + waveOffset, 162, 60, 1);
      b.fillRect(160 - waveOffset, 172, 75, 1);
      b.fillRect(210 + waveOffset, 180, 50, 1);

      // Natural pond edge rocks
      b.fillStyle = t > 0.6 ? '#211f1d' : '#44403c';
      const edgeRocks = [
        [144, 144, 7, 5],
        [158, 141, 9, 6],
        [190, 139, 11, 6],
        [220, 138, 10, 5],
        [250, 139, 12, 6],
        [285, 141, 14, 7],
        [308, 148, 8, 8],
        [140, 182, 10, 8],
        [155, 191, 14, 7],
        [190, 194, 12, 6],
        [240, 195, 15, 6],
        [280, 192, 14, 7]
      ];
      edgeRocks.forEach(([rx, ry, rw, rh]) => {
        b.fillRect(rx, ry, rw, rh);
      });
    }

    drawKoi(b) {
      this.koi.forEach((k) => {
        b.save();
        b.translate(k.x, k.y);
        b.rotate(k.angle);

        // Body
        b.fillStyle = k.color;
        b.beginPath();
        b.ellipse(0, 0, k.size, k.size * 0.45, 0, 0, Math.PI * 2);
        b.fill();

        // White/Gold belly patch
        b.fillStyle = k.bellyColor;
        b.beginPath();
        b.ellipse(1, 0, k.size * 0.5, k.size * 0.25, 0, 0, Math.PI * 2);
        b.fill();

        // Head pixel
        b.fillStyle = '#1c1917';
        b.fillRect(k.size * 0.8, -1, 1, 1);
        b.fillRect(k.size * 0.8, 1, 1, 1);

        // Tail fin (oscillates)
        const tailWiggle = Math.sin(k.tailAngle) * 0.4;
        b.save();
        b.translate(-k.size + 1, 0);
        b.rotate(tailWiggle);
        b.fillStyle = k.color;
        b.beginPath();
        b.moveTo(0, 0);
        b.lineTo(-4, -2.5);
        b.lineTo(-3, 0);
        b.lineTo(-4, 2.5);
        b.closePath();
        b.fill();
        b.restore();

        // Pectoral fins
        b.fillStyle = k.color;
        b.fillRect(1, -k.size * 0.5 - 1, 2, 2);
        b.fillRect(1, k.size * 0.5, 2, 2);

        b.restore();
      });
    }

    drawRipples(b, t) {
      const rippleCol = t > 0.6 ? 'rgba(255,255,255,' : 'rgba(224,242,254,';
      this.ripples.forEach((r) => {
        b.strokeStyle = rippleCol + (r.alpha * 0.7) + ')';
        b.lineWidth = 1;
        b.beginPath();
        b.ellipse(r.x, r.y, r.radius, r.radius * 0.45, 0, 0, Math.PI * 2);
        b.stroke();
      });
    }

    drawShrineLantern(b, t) {
      const lx = 78;
      const ly = 138;

      // Stone color
      const stoneBase = t > 0.6 ? '#292524' : '#57534e';
      const stoneShade = t > 0.6 ? '#1c1917' : '#44403c';

      // Base pedestal
      b.fillStyle = stoneShade;
      b.fillRect(lx - 8, ly + 22, 16, 4);
      b.fillRect(lx - 5, ly + 14, 10, 8);
      b.fillStyle = stoneBase;
      b.fillRect(lx - 7, ly + 21, 14, 2);

      // Middle post
      b.fillStyle = stoneShade;
      b.fillRect(lx - 3, ly + 7, 6, 7);

      // Lantern chamber platform
      b.fillStyle = stoneBase;
      b.fillRect(lx - 7, ly + 5, 14, 3);

      // Light chamber (Fire flame)
      const isNight = t > 0.4;
      const flameAlpha = isNight ? 0.95 : 0.4;
      const flicker = Math.sin(this.tick * 0.25) * 1.2;

      // Warm glow behind lantern
      if (isNight) {
        const glowGrad = b.createRadialGradient(lx, ly, 1, lx, ly, 28);
        glowGrad.addColorStop(0, 'rgba(251, 191, 36, 0.4)');
        glowGrad.addColorStop(1, 'rgba(251, 191, 36, 0.0)');
        b.fillStyle = glowGrad;
        b.beginPath();
        b.arc(lx, ly, 28, 0, Math.PI * 2);
        b.fill();
      }

      // Chamber lattice
      b.fillStyle = '#fed7aa';
      b.fillRect(lx - 4, ly - 3, 8, 8);
      // Flame
      b.fillStyle = '#f97316';
      b.fillRect(lx - 2 + Math.round(flicker * 0.3), ly - 1, 4, 5);
      b.fillStyle = '#fef08a';
      b.fillRect(lx - 1, ly, 2, 3);

      // Chamber wooden struts
      b.fillStyle = stoneShade;
      b.fillRect(lx - 5, ly - 4, 2, 10);
      b.fillRect(lx + 3, ly - 4, 2, 10);
      b.fillRect(lx - 1, ly - 4, 2, 10);

      // Pagoda tiered roof
      b.fillStyle = stoneBase;
      b.beginPath();
      b.moveTo(lx - 10, ly - 4);
      b.lineTo(lx, ly - 12);
      b.lineTo(lx + 10, ly - 4);
      b.closePath();
      b.fill();

      // Eaves upturn
      b.fillStyle = stoneShade;
      b.fillRect(lx - 12, ly - 5, 3, 2);
      b.fillRect(lx + 9, ly - 5, 3, 2);

      // Lotus finial ornament on top
      b.fillStyle = '#f59e0b';
      b.fillRect(lx - 1, ly - 14, 2, 3);
      b.fillRect(lx - 2, ly - 13, 4, 1);
    }

    drawContemplator(b, t) {
      // Small meditative figure sitting on a flat stone
      const cx = 40;
      const cy = 152;

      // Robe color (Tibetan maroon or saffron monk robe)
      const robeCol = t > 0.6 ? '#7c2d12' : '#9a3412';
      const skinCol = '#fed7aa';

      // Flat sitting stone
      b.fillStyle = t > 0.6 ? '#292524' : '#44403c';
      b.fillRect(cx - 8, cy + 12, 16, 4);

      // Legs folded in lotus pose
      b.fillStyle = robeCol;
      b.fillRect(cx - 6, cy + 8, 12, 4);
      b.fillRect(cx - 7, cy + 9, 14, 3);

      // Torso & Robe
      b.fillRect(cx - 4, cy + 1, 8, 8);

      // Subtle breathing motion (1 pixel every ~2 seconds)
      const breath = Math.sin(this.tick * 0.05) > 0 ? 0 : 1;

      // Head
      b.fillStyle = skinCol;
      b.fillRect(cx - 2, cy - 3 - breath, 4, 4);

      // Topknot / hair
      b.fillStyle = '#1c1917';
      b.fillRect(cx - 1, cy - 4 - breath, 2, 1);

      // Peaceful closed eyes
      b.fillStyle = '#78350f';
      b.fillRect(cx + 1, cy - 1 - breath, 1, 1);

      // Rottie companion resting nearby quietly
      const dx = cx - 18;
      const dy = cy + 10;
      b.fillStyle = '#1c1917'; // rottie dark coat
      b.fillRect(dx, dy, 9, 5); // body
      b.fillRect(dx - 3, dy + 1, 4, 3); // head resting on paws
      b.fillStyle = '#b45309'; // tan markings
      b.fillRect(dx - 2, dy + 2, 2, 2);
      b.fillRect(dx + 1, dy + 4, 2, 1);
    }

    drawTreeAndBlossoms(b, t) {
      // Ancient Himalayan Pine & Sakura branch extending over the sanctuary
      const trunkCol = t > 0.6 ? '#1c1917' : '#3e2723';
      const pineFoliage = t > 0.6 ? '#14281d' : '#224a33';

      b.fillStyle = trunkCol;

      // Main trunk on far left
      b.fillRect(0, 40, 14, 120);
      b.fillRect(0, 60, 20, 18);

      // Branch extending right towards center
      b.beginPath();
      b.moveTo(14, 70);
      b.lineTo(45, 62);
      b.lineTo(85, 54);
      b.lineTo(120, 52);
      b.lineTo(118, 56);
      b.lineTo(82, 59);
      b.lineTo(44, 68);
      b.lineTo(14, 76);
      b.closePath();
      b.fill();

      // Branch fork drooping down towards lantern
      b.beginPath();
      b.moveTo(60, 62);
      b.lineTo(80, 78);
      b.lineTo(95, 86);
      b.lineTo(94, 88);
      b.lineTo(78, 80);
      b.lineTo(58, 65);
      b.closePath();
      b.fill();

      // Lush cloud foliage (Pine needles + Sakura blossoms)
      b.fillStyle = pineFoliage;
      const pineClusters = [
        [35, 50, 28, 16],
        [70, 42, 34, 18],
        [105, 44, 26, 14],
        [75, 72, 24, 13],
        [15, 38, 26, 16]
      ];
      pineClusters.forEach(([px, py, pw, ph]) => {
        b.beginPath();
        b.ellipse(px + pw / 2, py + ph / 2, pw / 2, ph / 2, 0, 0, Math.PI * 2);
        b.fill();
      });

      // Pink Sakura blossom clusters along the branch
      const blossoms = [
        [32, 48, '#fbcfe8'],
        [38, 54, '#f472b6'],
        [46, 45, '#f43f5e'],
        [68, 38, '#fbcfe8'],
        [76, 44, '#f472b6'],
        [84, 40, '#fbcfe8'],
        [98, 42, '#f43f5e'],
        [112, 48, '#fbcfe8'],
        [122, 53, '#f472b6'],
        [72, 74, '#fbcfe8'],
        [82, 80, '#f43f5e'],
        [92, 84, '#fbcfe8']
      ];
      blossoms.forEach(([bx, by, col]) => {
        b.fillStyle = col;
        b.fillRect(bx, by, 3, 3);
        b.fillRect(bx + 1, by - 1, 1, 1);
        b.fillRect(bx + 1, by + 3, 1, 1);
        b.fillRect(bx - 1, by + 1, 1, 1);
        b.fillRect(bx + 3, by + 1, 1, 1);
        // Golden pollen core
        b.fillStyle = '#fef08a';
        b.fillRect(bx + 1, by + 1, 1, 1);
      });
    }

    drawPetals(b) {
      this.petals.forEach((p) => {
        b.fillStyle = p.color;
        b.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
      });
    }
  }

  // Expose globally
  window.ZenSanctuary = ZenSanctuary;

  // Auto initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new ZenSanctuary('zenCanvas', 'zenSanctuaryContainer');
    });
  } else {
    new ZenSanctuary('zenCanvas', 'zenSanctuaryContainer');
  }
})();
