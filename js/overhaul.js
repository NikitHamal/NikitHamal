/**
 * NIKIT HAMAL PORTFOLIO OVERHAUL — Interactive Engine
 * Handles live Kathmandu clock, theme switcher, quote engine,
 * essay reader drawer, Nik 0.1 mini-neural tester, and clipboard.
 */

(function () {
  'use strict';

  // 1. KATHMANDU LIVE CLOCK (UTC+5:45)
  function initKathmanduClock() {
    const clockEl = document.getElementById('kathmanduClock');
    if (!clockEl) return;

    function update() {
      const now = new Date();
      // Kathmandu is UTC+5:45 (345 minutes offset)
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const ktmTime = new Date(utc + 345 * 60000);

      const hours = String(ktmTime.getHours()).padStart(2, '0');
      const minutes = String(ktmTime.getMinutes()).padStart(2, '0');
      const seconds = String(ktmTime.getSeconds()).padStart(2, '0');
      clockEl.textContent = `${hours}:${minutes}:${seconds} NST`;
    }

    update();
    setInterval(update, 1000);
  }

  // 2. THEME ENGINE (Parchment, Obsidian, Mist)
  function initThemeEngine() {
    const root = document.documentElement;
    const themePills = document.querySelectorAll('[data-set-theme]');

    function applyTheme(theme, save = true) {
      const valid = ['parchment', 'obsidian', 'mist'].includes(theme) ? theme : 'parchment';
      root.setAttribute('data-theme', valid);
      // Synchronize with legacy data-theme if needed for other scripts
      if (valid === 'obsidian') root.setAttribute('data-theme', 'dark');
      else root.setAttribute('data-theme', valid);

      themePills.forEach((p) => {
        const isActive = p.getAttribute('data-set-theme') === valid;
        p.classList.toggle('active', isActive);
        p.setAttribute('aria-pressed', String(isActive));
      });

      // Update meta theme-color
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        if (valid === 'obsidian') meta.setAttribute('content', '#0c0a09');
        else if (valid === 'mist') meta.setAttribute('content', '#f1f4f1');
        else meta.setAttribute('content', '#faf7f2');
      }

      if (save) {
        try {
          localStorage.setItem('nikit-theme-mode', valid);
        } catch (e) {}
      }

      // Also notify ZenSanctuary canvas if active
      if (window.zenCanvasInstance) {
        const canvasMode = valid === 'obsidian' ? 'night' : (valid === 'mist' ? 'day' : 'sunset');
        window.zenCanvasInstance.setTimeMode(canvasMode);
      }
    }

    let savedTheme = 'parchment';
    try {
      savedTheme = localStorage.getItem('nikit-theme-mode') || 'parchment';
    } catch (e) {}

    // Respect system preference if not explicitly set
    if (!localStorage.getItem('nikit-theme-mode') && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      savedTheme = 'obsidian';
    }

    applyTheme(savedTheme, false);

    themePills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const target = pill.getAttribute('data-set-theme');
        applyTheme(target, true);
        if (window.ZenSound) {
          window.ZenSound.playChime(0.6);
        }
      });
    });
  }

  // 3. CONTEMPLATIVE REFLECTION ENGINE (Real quotes from Nikit's essays)
  const REFLECTIONS = [
    {
      quote: "You say you want trust, but what you really want is security. Trust only exists where there is uncertainty.",
      source: "You Never Trusted Anyone"
    },
    {
      quote: "The dog sees the tail. The dog wants the tail. There is something philosophically devastating about it.",
      source: "The Wrong Guy Trying to Wake Up"
    },
    {
      quote: "You say, 'I just want to be myself.' Which self are you talking about? The observer or the observed?",
      source: "The Lie of 'Being Yourself'"
    },
    {
      quote: "Pleasure is what we seek to fill emptiness; happiness is the quiet completeness of being.",
      source: "How to Be Happy"
    },
    {
      quote: "Unity is often a pretense. True meeting only begins when separation is directly seen without defense.",
      source: "Unity is a Lie"
    },
    {
      quote: "In stillness, code and consciousness meet without friction.",
      source: "Philosophical Notebooks"
    }
  ];

  function initReflectionEngine() {
    const textEl = document.getElementById('quoteText');
    const srcEl = document.getElementById('quoteSource');
    const nextBtn = document.getElementById('nextQuoteBtn');
    if (!textEl || !nextBtn) return;

    let idx = 0;

    function renderReflection(i) {
      const item = REFLECTIONS[i];
      textEl.style.opacity = '0';
      textEl.style.transform = 'translateY(4px)';

      setTimeout(() => {
        textEl.textContent = `“${item.quote}”`;
        if (srcEl) srcEl.textContent = `— ${item.source}`;
        textEl.style.transition = 'all 0.25s ease';
        textEl.style.opacity = '1';
        textEl.style.transform = 'translateY(0)';
      }, 150);
    }

    nextBtn.addEventListener('click', () => {
      idx = (idx + 1) % REFLECTIONS.length;
      renderReflection(idx);
      if (window.ZenSound) window.ZenSound.playChime(0.3 + (idx / REFLECTIONS.length) * 0.5);
    });

    renderReflection(0);
  }

  // 4. ESSAY QUICK-READ DRAWER
  const ESSAY_DATA = {
    'the-lie-of-being-yourself': {
      title: 'The Lie of “Being Yourself”',
      cat: 'Essay · Non-Duality',
      mins: '14 min read',
      body: `
        <p>You say, “I just want to be myself.” What do you mean by that? Which self are you talking about? The one who was laughing with someone yesterday, or the one who doesn't want to get out of bed this morning? The confident version you show in interviews, or the anxious child sitting alone in the dark?</p>
        <p>When you say “myself,” you assume there is an entity—fixed, continuous, authentic—hiding behind your masks waiting to be unveiled. But if you observe closely, you will find only a stream of conditioning, memories, and reactions.</p>
        <p>The desire to "be yourself" is often just another identity project: you want to perform the role of someone who is untethered, grounded, and unique. What happens when you drop the project entirely?</p>
      `,
      slug: 'the-lie-of-being-yourself'
    },
    'the-wrong-guy-trying-to-wake-up': {
      title: 'The Wrong Guy Trying to Wake Up',
      cat: 'Essay · Consciousness',
      mins: '13 min read',
      body: `
        <p>Look at a dog chasing its tail. Really look. It is one of the most common things you have ever seen and yet there is something philosophically devastating about it. The dog sees the tail. The dog wants the tail. It does not realize that the pursuer is the pursued.</p>
        <p>In spiritual seeking, the ego decides it wants to achieve enlightenment. The very mechanism creating division now appoints itself as the seeker of unity. It buys books, meditates for hours, and accumulates spiritual credentials.</p>
        <p>The entity trying to wake up is the sleep itself. When this paradox is recognized, the frantic pursuit comes to an organic halt.</p>
      `,
      slug: 'the-wrong-guy-trying-to-wake-up'
    },
    'you-never-trusted-anyone-2': {
      title: 'You Never Trusted Anyone',
      cat: 'Essay · Inquiry',
      mins: '6 min read',
      body: `
        <p>You say you want trust, but what you really want is security. Trust can only exist where there is uncertainty, but security is the demand to remove uncertainty.</p>
        <p>If you have guarantees, insurance, and predictable outcomes, trust is not needed. You call it trust only when you feel confident that the other person will not hurt your self-image. That is not trust; that is an unspoken contract.</p>
        <p>Real trust begins when you accept that the other person is free, independent, and capable of anything—and you remain open without armoring.</p>
      `,
      slug: 'you-never-trusted-anyone-2'
    },
    'how-to-be-happy-2': {
      title: 'How to Be Happy',
      cat: 'Reflection · Mind',
      mins: '5 min read',
      body: `
        <p>Here, happiness is fundamentally different from pleasure. Pleasure is something we seek to fill our emptiness, our boredom, to escape from pain and loneliness.</p>
        <p>Happiness is the state of being when we are complete in the present moment, without the demand for psychological expansion. It is not something you acquire; it is the natural quietude that emerges when self-seeking subsides.</p>
      `,
      slug: 'how-to-be-happy-2'
    },
    'unity-is-a-lie': {
      title: 'Unity is a Lie',
      cat: 'Essay · Society & Self',
      mins: '4 min read',
      body: `
        <p>Unity is often nothing but a pretense. Whether it is a nation, a community, or a philosophy, an imposed unity always requires an external enemy or an internal suppression of differences.</p>
        <p>True meeting is not homogenization. It is the capacity to relate without psychological projection, recognizing our shared nature without needing uniformity.</p>
      `,
      slug: 'unity-is-a-lie'
    }
  };

  function initEssayDrawer() {
    const modal = document.getElementById('readerModal');
    const closeBtn = document.getElementById('readerCloseBtn');
    const metaEl = document.getElementById('readerMeta');
    const titleEl = document.getElementById('readerTitle');
    const bodyEl = document.getElementById('readerBody');
    const fullLink = document.getElementById('readerFullLink');
    if (!modal) return;

    function openEssay(slug) {
      const data = ESSAY_DATA[slug] || {
        title: 'Philosophical Reflection',
        cat: 'Essay',
        mins: 'Read online',
        body: '<p>Read this reflection in full on Nikit\'s writings collection.</p>',
        slug: slug
      };

      if (metaEl) metaEl.textContent = `${data.cat} · ${data.mins}`;
      if (titleEl) titleEl.textContent = data.title;
      if (bodyEl) bodyEl.innerHTML = data.body;
      if (fullLink) fullLink.setAttribute('href', `/writings/${data.slug || slug}`);

      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      if (window.ZenSound) window.ZenSound.playChime(0.5);
    }

    function closeDrawer() {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    document.querySelectorAll('[data-open-essay]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const slug = el.getAttribute('data-open-essay');
        openEssay(slug);
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeDrawer();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) {
        closeDrawer();
      }
    });
  }

  // 5. NIK 0.1 IN-CARD MINI NEURAL TESTER
  function initNikTester() {
    const input = document.getElementById('nikMiniInput');
    const sendBtn = document.getElementById('nikMiniSend');
    const output = document.getElementById('nikMiniOutput');
    if (!input || !sendBtn || !output) return;

    const RESPONSES = {
      'namaste': 'Namaste! Ma Nik 0.1 hu—a compact Romanized-Nepali neural model built from scratch. Tapailai k bare sodhna man chha?',
      'who are you': 'Ma Nikit Hamal le banayeko in-browser LLM hu (<10 MB, WASM-SIMD kernel). Zero-cloud, local inference in your browser!',
      'architecture': 'Hybrid AR + diffusion transformer, custom byte-level Romanized tokenizer, and direct C++ WASM SIMD matrix multiplications.',
      'consciousness': 'Thought creates the boundary between observer and observed. When thought settles, pure attention remains.',
      'nebians': 'NEBians is our native Android app + Django ecosystem helping over 100k+ students study for NEB board exams across Nepal.'
    };

    function runInference(query) {
      const q = (query || input.value || '').trim().toLowerCase();
      if (!q) return;

      output.innerHTML = `<span style="color:var(--accent-amber)">Thinking (WASM-SIMD kernel)...</span>`;

      setTimeout(() => {
        let matched = 'Sahi ho! Full Romanized-Nepali neural capabilities test garna, click below to open /chat.';
        for (const [k, v] of Object.entries(RESPONSES)) {
          if (q.includes(k)) {
            matched = v;
            break;
          }
        }
        output.innerHTML = `<strong>Nik 0.1:</strong> ${matched}`;
        if (window.ZenSound) window.ZenSound.playChime(0.7);
      }, 400);
    }

    sendBtn.addEventListener('click', () => runInference());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runInference();
    });

    // Preset chips
    document.querySelectorAll('[data-nik-chip]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-nik-chip');
        input.value = text;
        runInference(text);
      });
    });
  }

  // 6. ONE-CLICK EMAIL COPY
  function initEmailCopy() {
    const copyBtn = document.getElementById('copyEmailBtn');
    const toast = document.getElementById('copyToast');
    if (!copyBtn) return;

    copyBtn.addEventListener('click', () => {
      const email = 'iamnikithamal@gmail.com';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(() => showToast());
      } else {
        const ta = document.createElement('textarea');
        ta.value = email;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast();
      }
    });

    function showToast() {
      if (toast) {
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), 2400);
      }
      if (window.ZenSound) window.ZenSound.playChime(0.8);
    }
  }

  // 7. SPRINKLE PETALS BUTTON
  function initBlossomButton() {
    const btn = document.getElementById('scatterPetalsBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (window.zenCanvasInstance) {
        window.zenCanvasInstance.scatterPetals(160, 60);
      }
      if (window.ZenSound) {
        window.ZenSound.playChime(0.4);
      }
    });
  }

  // INITIALIZATION
  document.addEventListener('DOMContentLoaded', () => {
    initKathmanduClock();
    initThemeEngine();
    initReflectionEngine();
    initEssayDrawer();
    initNikTester();
    initEmailCopy();
    initBlossomButton();
  });
})();
