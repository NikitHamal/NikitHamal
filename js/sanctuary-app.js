/**
 * NIKIT HAMAL — SANCTUARY APPLICATION ENGINE (js/sanctuary-app.js)
 */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // =========================================================================
  // 1. PURE WEB AUDIO TIBETAN SINGING BOWL SYNTHESIZER
  // =========================================================================
  let audioCtx = null;
  let soundEnabled = false;

  function playBowlChime(baseFreq = 432) {
    if (!soundEnabled) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      const partials = [
        { mult: 1.0, gain: 0.08, dur: 2.2 },
        { mult: 2.756, gain: 0.03, dur: 1.5 },
        { mult: 5.404, gain: 0.012, dur: 0.9 }
      ];

      partials.forEach((p) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq * p.mult, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(p.gain, now + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + p.dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + p.dur + 0.05);
      });
    } catch (e) {}
  }

  window.SanctuaryAudio = {
    chime: playBowlChime,
    isEnabled: () => soundEnabled
  };

  function initSoundToggle() {
    const btn = $('#soundToggleBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      btn.setAttribute('aria-pressed', String(soundEnabled));
      btn.title = soundEnabled ? 'Mute temple singing bowl' : 'Enable subtle singing bowl chimes';
      if (soundEnabled) {
        playBowlChime(528);
        showToast('Singing bowl resonance enabled');
      } else {
        showToast('Audio muted');
      }
    });
  }

  // =========================================================================
  // 2. TOAST NOTIFICATION HELPER
  // =========================================================================
  let toastTimer = null;
  function showToast(msg) {
    const el = $('#sanctuaryToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('is-visible');
    }, 2600);
  }
  window.showSanctuaryToast = showToast;

  // =========================================================================
  // 3. FOUR-PHASE ATMOSPHERIC THEME CONTROLLER + PIXEL-STEPPED REVEAL
  // =========================================================================
  const PHASE_META_COLORS = {
    dawn: '#f6efe4',
    day: '#faf8f4',
    dusk: '#171311',
    night: '#0c0f14'
  };

  function applyPhase(phase, save = true) {
    const valid = ['dawn', 'day', 'dusk', 'night'].includes(phase) ? phase : 'day';
    const isDark = valid === 'dusk' || valid === 'night';
    document.documentElement.setAttribute('data-phase', valid);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', PHASE_META_COLORS[valid]);

    $$('[data-phase-select]').forEach((btn) => {
      btn.setAttribute('aria-checked', String(btn.dataset.phaseSelect === valid));
    });

    const badge = $('#dioramaPhaseBadge');
    if (badge) {
      const labels = {
        dawn: 'Prabhāta · Dawn Alpenglow',
        day: 'Madhyāhna · Clear Himalayan Day',
        dusk: 'Sandhyā · Temple Butter-Lamp Dusk',
        night: 'Rātri · Starlit Machapuchare'
      };
      badge.textContent = labels[valid];
    }

    if (save) {
      try {
        localStorage.setItem('nh-sanctuary-phase', valid);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
      } catch (e) {}
    }
  }

  function transitionToPhase(nextPhase, sourceBtn) {
    const current = document.documentElement.getAttribute('data-phase') || 'day';
    if (current === nextPhase) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !reduce && sourceBtn) {
      const rect = sourceBtn.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      ) + 40;
      const B = window.innerWidth < 600 ? 20 : 28;
      const pixelCircle = (r) => {
        if (r < 1) return `polygon(${x}px ${y}px, ${x}px ${y}px, ${x}px ${y}px)`;
        const rows = Math.ceil(r / B), right = [], left = [];
        for (let i = -rows; i < rows; i++) {
          const m = Math.abs((i + 0.5) * B);
          const w = Math.round(Math.sqrt(Math.max(0, r * r - m * m)) / B) * B;
          const y0 = y + i * B, y1 = y0 + B;
          right.push(`${x + w}px ${y0}px`, `${x + w}px ${y1}px`);
          left.unshift(`${x - w}px ${y1}px`, `${x - w}px ${y0}px`);
        }
        return `polygon(${right.concat(left).join(',')})`;
      };
      const FRAMES = 18;
      const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
      const keyframes = [];
      for (let k = 0; k <= FRAMES; k++) {
        keyframes.push({ clipPath: pixelCircle(endRadius * easeInOut(k / FRAMES)), easing: 'steps(1, end)' });
      }
      document.documentElement.classList.add('vt-theme');
      const vt = document.startViewTransition(() => applyPhase(nextPhase, true));
      vt.ready.then(() => {
        document.documentElement.animate(keyframes, {
          duration: 720,
          pseudoElement: '::view-transition-new(root)'
        });
      }).catch(() => {});
      vt.finished.finally(() => document.documentElement.classList.remove('vt-theme'));
    } else {
      applyPhase(nextPhase, true);
    }

    const freqs = { dawn: 432, day: 528, dusk: 396, night: 639 };
    playBowlChime(freqs[nextPhase] || 432);
  }

  function initPhaseSwitcher() {
    const current = document.documentElement.getAttribute('data-phase') || 'day';
    applyPhase(current, false);

    $$('[data-phase-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        transitionToPhase(btn.dataset.phaseSelect, btn);
      });
    });
  }

  // =========================================================================
  // 4. LIVE KATHMANDU CLOCK (Asia/Kathmandu · UTC+5:45) & SCROLL BAR
  // =========================================================================
  function initClockAndScroll() {
    const clockEl = $('#nepalClock');
    function updateClock() {
      if (!clockEl) return;
      try {
        const fmt = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kathmandu',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        clockEl.textContent = `${fmt.format(new Date())} NPT`;
      } catch (e) {
        clockEl.textContent = 'KTM · NPT';
      }
    }
    updateClock();
    setInterval(updateClock, 15000);

    const barFill = $('#scrollProgressFill');
    if (barFill) {
      window.addEventListener('scroll', () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        barFill.style.transform = `scaleX(${pct.toFixed(4)})`;
      }, { passive: true });
    }
  }

  // =========================================================================
  // 5. CYCLING PHILOSOPHICAL SUTRAS
  // =========================================================================
  const SUTRAS = [
    { deva: 'नेति नेति', en: 'Neti Neti — Not the construct, not the persona' },
    { deva: 'द्रष्टा दृश्य विवेक', en: 'The observer is never the observed state' },
    { deva: 'सहज स्थिति', en: 'Effort clouds the effortless · Simplicity in architecture' },
    { deva: 'शून्यता र शिल्प', en: 'Stillness in consciousness · Precision in code' },
    { deva: 'एकं सद्विप्रा बहुधा', en: 'One truth, expressed across many interfaces' }
  ];
  let sutraIdx = 0;

  function initSutraCycler() {
    const pill = $('#sutraPill');
    const devaEl = $('#sutraDeva');
    const enEl = $('#sutraEn');
    if (!pill || !devaEl || !enEl) return;

    pill.addEventListener('click', () => {
      sutraIdx = (sutraIdx + 1) % SUTRAS.length;
      const item = SUTRAS[sutraIdx];
      devaEl.textContent = item.deva;
      enEl.textContent = item.en;
      playBowlChime(528);
    });
  }

  // =========================================================================
  // 6. INTERACTIVE NIK 0.1 IN-CARD LLM TERMINAL PLAYGROUND
  // =========================================================================
  const NIK_RESPONSES = {
    math: {
      prompt: '962 - 288 kati huncha?',
      think: '<think> ekai: 2 bata 8 ghatdaina, das bata 1 sapati liyo -> 12 - 8 = 4. das: 5 bata 8 ghatdaina, saya bata 1 sapati -> 15 - 8 = 7. saya: 8 - 2 = 6. </think>',
      reply: '962 bata 288 ghatauda 674 huncha. (Ekai: 12 - 8 = 4, Das: 15 - 8 = 7, Saya: 8 - 2 = 6).'
    },
    peace: {
      prompt: 'man ko shanti ke ho?',
      think: '<think> question asks about inner peace (man ko shanti) in Romanized Nepali. Answer with calm reflective clarity. </think>',
      reply: 'Man ko shanti bhaneko bichar haru ko abhav haina, tara aafno bichar lai bina kunai sangharsha herna sakne sahaj awastha ho.'
    },
    arch: {
      prompt: 'timi kasari browser ma chalchau?',
      think: '<think> explain Nik 0.1 architecture: <10MB weights, custom tokenizer, hybrid AR + diffusion transformer, WASM-SIMD. </think>',
      reply: 'Ma 10 MB bhanda sano Romanized-Nepali LLM hu. Mero custom tokenizer ra WASM-SIMD kernel sidhai tapai ko browser bhitra bin-server chalcha.'
    }
  };

  function runNikPrompt(keyOrText) {
    const userEl = $('#nikConsoleUser');
    const thinkEl = $('#nikConsoleThink');
    const replyEl = $('#nikConsoleReply');
    if (!userEl || !thinkEl || !replyEl) return;

    let entry = NIK_RESPONSES[keyOrText];
    if (!entry) {
      const q = String(keyOrText || '').trim();
      if (!q) return;
      // Check if simple arithmetic expression
      const m = q.match(/(\d+)\s*([\+\-\*])\s*(\d+)/);
      if (m) {
        const a = parseInt(m[1], 10), op = m[2], b = parseInt(m[3], 10);
        const res = op === '+' ? a + b : op === '-' ? a - b : a * b;
        entry = {
          prompt: q,
          think: `<think> step-by-step column evaluation: ${a} ${op} ${b} -> verified exact integer result = ${res}. </think>`,
          reply: `${a} ${op} ${b} ko uttar ${res} huncha.`
        };
      } else {
        entry = {
          prompt: q,
          think: `<think> tokenizing Romanized-Nepali / English input (${q.length} chars) -> 6-layer hybrid AR+diffusion pass in WASM-SIMD... </think>`,
          reply: `Tapai ko prashna "${q}" ramro cha. Purano v8g bhanda v12p model le 2,304 NikBench items ma 1,908 score lyayeko cha — pura kura garna /chat kholnuhos!`
        };
      }
    }

    userEl.innerHTML = `<strong>prompt &gt;</strong> ${entry.prompt.replace(/</g, '&lt;')}`;
    thinkEl.textContent = entry.think;
    replyEl.innerHTML = `<span class="nik-streaming">...</span>`;

    let i = 0;
    const text = entry.reply;
    const timer = setInterval(() => {
      i += 4;
      if (i >= text.length) {
        clearInterval(timer);
        replyEl.innerHTML = `${text} <span class="nik-tok-speed">[92.4 tok/s · WASM-SIMD v12p]</span>`;
      } else {
        replyEl.textContent = text.slice(0, i) + '▋';
      }
    }, 24);
  }

  function initNikConsole() {
    $$('[data-nik-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('[data-nik-preset]').forEach((b) => b.classList.toggle('is-active', b === btn));
        runNikPrompt(btn.dataset.nikPreset);
        playBowlChime(580);
      });
    });

    const form = $('#nikPromptForm');
    const input = $('#nikPromptInput');
    if (form && input) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!input.value.trim()) return;
        runNikPrompt(input.value.trim());
        input.value = '';
      });
    }
  }

  // =========================================================================
  // 7. INTERACTIVE DRAG-TO-COMPARE PORTRAIT SLIDER (Childhood vs Present)
  // =========================================================================
  function initPortraitCompare() {
    const stage = $('#portraitCompareStage');
    const readout = $('#comparePercentReadout');
    if (!stage) return;

    // Mount painted portraits + SVG eyes inside the comparator layers
    stage.querySelectorAll('[data-painted]').forEach(async (el, idx) => {
      const id = el.dataset.painted;
      if (!id) return;
      el.classList.add('painted');
      el.textContent = '';
      const img = new Image();
      img.src = `assets/painted/${id}.webp`;
      img.alt = el.dataset.alt || 'Nikit Hamal, painted portrait';
      img.decoding = 'async';
      img.draggable = false;
      el.appendChild(img);
      try {
        const res = await fetch(`assets/painted/${id}-eyes.svg`);
        if (res.ok) {
          const svgRaw = await res.text();
          const ov = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          ov.setAttribute('viewBox', '0 0 800 1000');
          ov.setAttribute('class', 'painted-eyes');
          ov.setAttribute('aria-hidden', 'true');
          ov.setAttribute('preserveAspectRatio', 'xMidYMid slice');
          const sfx = `cmp-${id}-${idx}`;
          ov.innerHTML = svgRaw
            .replace(/id="([^"]+)"/g, `id="$1-${sfx}"`)
            .replace(/url\(#([^)]+)\)/g, `url(#$1-${sfx})`);
          el.appendChild(ov);
        }
      } catch (e) {}
    });

    let dragging = false;

    function setSplit(pct) {
      const clamped = Math.max(4, Math.min(96, pct));
      stage.style.setProperty('--split', `${clamped.toFixed(1)}%`);
      if (readout) {
        readout.textContent = clamped < 35
          ? 'Viewing Present Day (Now)'
          : clamped > 65
          ? 'Viewing Childhood (Then)'
          : 'Drag handle to compare · Then & Now';
      }
    }

    function moveFromEvent(e) {
      const r = stage.getBoundingClientRect();
      if (!r.width) return;
      const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
      const pct = ((clientX - r.left) / r.width) * 100;
      setSplit(pct);
    }

    stage.addEventListener('pointerdown', (e) => {
      dragging = true;
      stage.setPointerCapture && stage.setPointerCapture(e.pointerId);
      moveFromEvent(e);
    });
    stage.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      moveFromEvent(e);
    });
    window.addEventListener('pointerup', () => {
      dragging = false;
    });

    $$('[data-compare-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setSplit( parseFloat(btn.dataset.comparePreset) || 50 );
      });
    });
  }

  // =========================================================================
  // 8. WRITINGS & SUTRAS ENGINE + SLIDE-OVER MANUSCRIPT READER DRAWER
  // =========================================================================
  const FALLBACK_POSTS = [
    {
      slug: 'the-lie-of-being-yourself',
      title: 'The lie of “being yourself”',
      date: '2026-09-22T12:00:00-08:00',
      category: 'Essay',
      featured: true,
      mins: 14,
      excerpt: 'You say, “I just want to be myself.” What do you mean by that? Which self are you talking about? The one who was laughing yesterday, or the one who wants to disappear today?'
    },
    {
      slug: 'the-wrong-guy-trying-to-wake-up',
      title: 'The Wrong Guy Trying to Wake Up',
      date: '2026-02-14T15:05:00-08:00',
      category: 'Essay',
      featured: true,
      mins: 13,
      excerpt: 'Look at a dog chasing its tail. Really look. It is one of the most common things you have ever seen and yet there is something philosophically devastating about it.'
    },
    {
      slug: 'you-never-trusted-anyone-2',
      title: 'You never trusted anyone (2)',
      date: '2026-01-23T21:23:00-08:00',
      category: 'Essay',
      featured: true,
      mins: 6,
      excerpt: 'You say you want trust, but what you really want is security. Trust can only exist where there is uncertainty, but security is the demand to remove uncertainty.'
    },
    {
      slug: 'how-to-be-happy-2',
      title: 'How to be happy (2)',
      date: '2026-01-01T01:33:00-08:00',
      category: 'Essay',
      featured: true,
      mins: 5,
      excerpt: 'Here, happiness is different from pleasure. Pleasure is something we seek to fill our emptiness. Happiness is the state of being when we are complete in ourselves.'
    },
    {
      slug: 'unity-is-a-lie',
      title: 'Unity is a lie',
      date: '2025-10-02T22:15:00-07:00',
      category: 'Essay',
      mins: 4,
      excerpt: 'Whether it is a nation, a community, or a religion, true unity cannot be manufactured by thought—because thought itself is division.'
    },
    {
      slug: 'everything-is-thought',
      title: 'Everything is thought',
      date: '2025-02-20T12:00:00-08:00',
      category: 'Essay',
      mins: 5,
      excerpt: 'Every boundary you experience between the observer and the world is drawn by memory and recognition.'
    },
    {
      slug: 'wisdom-cannot-be-taught',
      title: 'Wisdom cannot be taught',
      date: '2025-02-15T12:00:00-08:00',
      category: 'Reflection',
      mins: 4,
      excerpt: 'Information can be transmitted from one memory to another; seeing must happen in the quietness of your own attention.'
    },
    {
      slug: 'there-is-only-one-step',
      title: 'There is only one step',
      date: '2025-02-10T12:00:00-08:00',
      category: 'Reflection',
      mins: 3,
      excerpt: 'The mind loves gradual paths because time allows the ego to postpone ending.'
    }
  ];

  let allPosts = FALLBACK_POSTS.slice();
  let activeCat = 'all';
  let searchQuery = '';

  function formatShortDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return '';
    }
  }

  function arrowSvgUpRight() {
    return `<span class="arrow-icon arrow-icon--ur" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M7 17L17 7M8.5 7H17v8.5"/></svg>
      <svg viewBox="0 0 24 24"><path d="M7 17L17 7M8.5 7H17v8.5"/></svg>
    </span>`;
  }

  function renderFeaturedEssays(posts) {
    const grid = $('#featuredEssaysGrid');
    if (!grid) return;
    const top4 = posts.slice(0, 4);
    grid.innerHTML = top4.map((p) => {
      const thumb = `/assets/og/thumb/${p.slug}.webp`;
      const dateStr = formatShortDate(p.date);
      return `
        <article class="essay-feature-card">
          <a href="/writings/${p.slug}" class="essay-feature-card__media" aria-label="Read ${p.title}">
            <img src="${thumb}" alt="${p.title.replace(/"/g, '&quot;')}" loading="lazy" decoding="async" width="640" height="336" onerror="this.onerror=null;this.src='/assets/og/thumb/og-image.webp'" />
          </a>
          <div class="essay-feature-card__body">
            <div>
              <div class="essay-meta-top">
                <span class="essay-cat-pill">${p.category || 'Essay'}</span>
                <span>${dateStr} &middot; ${p.mins || 5} min read</span>
              </div>
              <h3 class="essay-feature-card__title">
                <a href="/writings/${p.slug}">${p.title}</a>
              </h3>
              <p class="essay-feature-card__excerpt">${p.excerpt || ''}</p>
            </div>
            <div class="essay-card-actions">
              <button type="button" class="essay-quick-read-btn" data-open-reader="${p.slug}">
                Quick Read in Drawer
              </button>
              <a href="/writings/${p.slug}" class="essay-full-link">
                Full Essay ${arrowSvgUpRight()}
              </a>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderSutraLedger() {
    const container = $('#sutraLedgerList');
    if (!container) return;

    const q = searchQuery.trim().toLowerCase();
    const filtered = allPosts.filter((p) => {
      const catMatch = activeCat === 'all' || String(p.category || '').toLowerCase() === activeCat;
      if (!catMatch) return false;
      if (!q) return true;
      return (
        String(p.title || '').toLowerCase().includes(q) ||
        String(p.excerpt || '').toLowerCase().includes(q)
      );
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div style="padding:28px 20px;text-align:center;color:var(--ink-muted);font-family:var(--font-mono);font-size:0.8rem;">No matching writings found. Try clearing your filter.</div>`;
      return;
    }

    container.innerHTML = filtered.slice(0, 12).map((p, idx) => {
      const num = String(idx + 1).padStart(2, '0');
      const dateStr = formatShortDate(p.date);
      return `
        <div class="sutra-row">
          <span class="sutra-row__idx">${num}</span>
          <div class="sutra-row__main">
            <h4 class="sutra-row__title"><a href="/writings/${p.slug}">${p.title}</a></h4>
            <p class="sutra-row__excerpt">${p.excerpt || ''}</p>
          </div>
          <span class="sutra-row__meta">${p.category || 'Essay'} &middot; ${dateStr} &middot; ${p.mins || 4}m</span>
          <div class="sutra-row__actions">
            <button type="button" class="essay-quick-read-btn" data-open-reader="${p.slug}">Preview</button>
            <a href="/writings/${p.slug}" class="essay-full-link" aria-label="Open ${p.title}">${arrowSvgUpRight()}</a>
          </div>
        </div>
      `;
    }).join('');
  }

  function updateCategoryCounts() {
    const counts = { all: allPosts.length, essay: 0, reflection: 0, poem: 0 };
    allPosts.forEach((p) => {
      const c = String(p.category || '').toLowerCase();
      if (counts[c] !== undefined) counts[c]++;
    });
    $$('[data-writing-cat]').forEach((btn) => {
      const c = btn.dataset.writingCat;
      const countSpan = btn.querySelector('.writing-filter-btn__count');
      if (countSpan && counts[c] !== undefined) {
        countSpan.textContent = counts[c];
      }
    });
  }

  async function initWritingsSection() {
    // Immediate zero-CLS render from fallback
    renderFeaturedEssays(allPosts);
    renderSutraLedger();
    updateCategoryCounts();

    // Fetch complete 27-post summary
    try {
      const res = await fetch('/posts/summary.json');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.posts) && data.posts.length) {
          allPosts = data.posts.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
          renderFeaturedEssays(allPosts);
          renderSutraLedger();
          updateCategoryCounts();
        }
      }
    } catch (e) {}

    // Filter buttons
    $$('[data-writing-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeCat = btn.dataset.writingCat || 'all';
        $$('[data-writing-cat]').forEach((b) => b.classList.toggle('is-active', b === btn));
        renderSutraLedger();
      });
    });

    // Search input
    const searchInput = $('#sutraSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value;
        renderSutraLedger();
      });
      window.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== searchInput && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
          const rect = searchInput.getBoundingClientRect();
          if (rect.top > -200 && rect.bottom < window.innerHeight + 200) {
            e.preventDefault();
            searchInput.focus();
          }
        }
      });
    }

    // Delegate Quick-Read Drawer clicks
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-open-reader]');
      if (btn) {
        e.preventDefault();
        openManuscriptReader(btn.dataset.openReader);
      }
    });
  }

  // Slide-Over Manuscript Reader Drawer
  async function openManuscriptReader(slug) {
    const drawer = $('#readerDrawer');
    const backdrop = $('#readerBackdrop');
    const titleEl = $('#readerDrawerTitle');
    const metaEl = $('#readerDrawerMeta');
    const contentEl = $('#readerDrawerContent');
    const fullLinkEl = $('#readerDrawerFullLink');
    if (!drawer || !backdrop) return;

    const summaryItem = allPosts.find((p) => p.slug === slug) || { title: slug, category: 'Essay', mins: 5 };
    titleEl.textContent = summaryItem.title;
    metaEl.textContent = `${summaryItem.category || 'Essay'} · ${summaryItem.mins || 5} min read`;
    fullLinkEl.href = `/writings/${slug}`;
    contentEl.innerHTML = `<p style="font-family:var(--font-mono);font-size:0.82rem;color:var(--ink-muted);">Unrolling manuscript from /posts/${slug}.json…</p>`;

    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    playBowlChime(528);

    try {
      const res = await fetch(`/posts/${slug}.json`);
      if (res.ok) {
        const post = await res.json();
        if (post && post.contentHtml) {
          titleEl.textContent = post.title || summaryItem.title;
          metaEl.textContent = `${post.category || 'Essay'} · ${formatShortDate(post.date)} · ${summaryItem.mins || 6} min read`;
          contentEl.innerHTML = post.contentHtml;
          return;
        }
      }
    } catch (e) {}

    contentEl.innerHTML = `<p>${summaryItem.excerpt || ''}</p><p><a href="/writings/${slug}" class="btn-sanctuary btn-sanctuary--primary">Continue reading on full page &rarr;</a></p>`;
  }

  function closeManuscriptReader() {
    const drawer = $('#readerDrawer');
    const backdrop = $('#readerBackdrop');
    if (!drawer || !backdrop) return;
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  function initReaderDrawer() {
    const closeBtn = $('#readerDrawerClose');
    const backdrop = $('#readerBackdrop');
    if (closeBtn) closeBtn.addEventListener('click', closeManuscriptReader);
    if (backdrop) backdrop.addEventListener('click', closeManuscriptReader);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeManuscriptReader();
    });
  }

  // =========================================================================
  // 9. EMAIL COPY & CONTACT ACTIONS
  // =========================================================================
  function initContactCopy() {
    $$('[data-copy-email]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const email = btn.dataset.copyEmail || 'iamnikithamal@gmail.com';
        try {
          await navigator.clipboard.writeText(email);
          showToast(`Copied ${email} to clipboard`);
          playBowlChime(639);
        } catch (e) {
          window.location.href = `mailto:${email}`;
        }
      });
    });
  }

  // =========================================================================
  // BOOTSTRAP
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    initSoundToggle();
    initPhaseSwitcher();
    initClockAndScroll();
    initSutraCycler();
    initNikConsole();
    initPortraitCompare();
    initWritingsSection();
    initReaderDrawer();
    initContactCopy();
  });
})();
