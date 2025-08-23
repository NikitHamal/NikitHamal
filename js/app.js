// Nikit Hamal — Portfolio interactions with GSAP
// Smooth, minimal animations inspired by Google-like clarity

(function () {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  // Feather icons
  document.addEventListener('DOMContentLoaded', () => {
    if (window.feather) window.feather.replace();
  });

  // Photo/Profile dialogs
  document.addEventListener('DOMContentLoaded', () => {
    const avatar = document.getElementById('avatarImg');
    const card = document.getElementById('profileCard');
    const photoDialog = document.getElementById('photoDialog');
    const profileDialog = document.getElementById('profileDialog');

    if (!photoDialog || !profileDialog) return;

    const openDialog = (dlg) => {
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    };
    const closeDialog = (dlg) => {
      if (typeof dlg.close === 'function') dlg.close();
      else dlg.removeAttribute('open');
    };

    // Close buttons
    [photoDialog, profileDialog].forEach((dlg) => {
      const btn = dlg.querySelector('[data-close]');
      if (btn) btn.addEventListener('click', () => closeDialog(dlg));
      // Backdrop click to close
      dlg.addEventListener('click', (e) => {
        const rect = dlg.getBoundingClientRect();
        const inDialog = (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        );
        if (!inDialog) closeDialog(dlg);
      });
      // Escape (native for dialog, but fallback for non-support)
      dlg.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDialog(dlg);
      });
    });

    if (avatar) {
      avatar.addEventListener('click', (e) => {
        e.stopPropagation();
        openDialog(photoDialog);
      });
      // Keyboard accessibility
      avatar.setAttribute('tabindex', '0');
      avatar.setAttribute('role', 'button');
      avatar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDialog(photoDialog);
        }
      });
    }

    if (card) {
      card.addEventListener('click', () => openDialog(profileDialog));
      card.setAttribute('tabindex', '0');
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDialog(profileDialog);
        }
      });
    }
  });

  // Current year
  document.addEventListener('DOMContentLoaded', () => {
    const y = new Date().getFullYear();
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = y;
  });

  // Mobile nav toggle
  document.addEventListener('DOMContentLoaded', () => {
    const toggle = $('.nav__toggle');
    const menu = $('#nav-menu');
    if (!toggle || !menu) return;

    const setState = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('open', open);
    };

    toggle.addEventListener('click', () => {
      const isOpen = menu.classList.contains('open');
      setState(!isOpen);
    });

    // Close on link click (mobile)
    $$('#nav-menu a').forEach((a) =>
      a.addEventListener('click', () => setState(false))
    );

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!menu.classList.contains('open')) return;
      const within = menu.contains(e.target) || toggle.contains(e.target);
      if (!within) setState(false);
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setState(false);
    });
  });

  // Active nav highlighting on scroll
  // (Removed) Active nav highlighting on scroll

  // GSAP animations
  function initGSAP() {
    if (!window.gsap) return;
    const gsap = window.gsap;
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

    // Subtle background blob motion
    gsap.to('.blob-a', { xPercent: 6, yPercent: 4, duration: 20, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    gsap.to('.blob-b', { xPercent: -6, yPercent: -6, duration: 24, yoyo: true, repeat: -1, ease: 'sine.inOut' });

    // Hero intro timeline
    const heroTl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    heroTl
      .from('.site-header', { y: -30, opacity: 0, duration: 0.5 })
      .from('.hero .kicker', { y: 16, opacity: 0, duration: 0.4 }, '-=0.1')
      .from('.hero__title', { y: 16, opacity: 0, duration: 0.5 }, '-=0.1')
      .from('.hero__subtitle', { y: 14, opacity: 0, duration: 0.5 }, '-=0.2')
      .from('.hero__cta .btn', { y: 12, opacity: 0, stagger: 0.08, duration: 0.35 }, '-=0.2')
      .from('.social a', { y: 12, opacity: 0, stagger: 0.06, duration: 0.3 }, '-=0.3')
      .from('.hero__visual .card.glass.profile', { y: 20, opacity: 0, duration: 0.45 }, '-=0.2')
      .from('.hero__visual .stat', { y: 14, opacity: 0, stagger: 0.06, duration: 0.35 }, '-=0.2');

    // Section reveals using ScrollTrigger.batch for performance
    if (window.ScrollTrigger) {
      const batch = (targets, vars = {}) => ScrollTrigger.batch(targets, vars);

      batch('.section h2', {
        start: 'top 80%',
        onEnter: (els) => gsap.fromTo(els, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: 'power2.out' }),
      });

      batch('.card, .skill, .project, .item', {
        start: 'top 85%',
        onEnter: (els) => gsap.fromTo(els, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.08, ease: 'power2.out' }),
      });

      // Parallax for media banners in projects
      $$('.project .card__media').forEach((el) => {
        gsap.fromTo(el, { yPercent: -8 }, {
          yPercent: 8,
          ease: 'none',
          scrollTrigger: { trigger: el, scrub: 0.3, start: 'top bottom', end: 'bottom top' }
        });
      });
    }
  }

  const schedule = (cb) => {
    if ('requestIdleCallback' in window) return requestIdleCallback(cb, { timeout: 1000 });
    return setTimeout(cb, 0);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => schedule(initGSAP));
  } else {
    schedule(initGSAP);
  }
})();
