// Nikit Hamal — Portfolio interactions with GSAP
// Smooth, minimal animations inspired by Google-like clarity

(function () {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  // Feather icons
  document.addEventListener('DOMContentLoaded', () => {
    if (window.feather) window.feather.replace();
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
  document.addEventListener('DOMContentLoaded', () => {
    const links = $$('#nav-menu a');
    if (!links.length) return;
    const byHash = new Map(links.map((a) => [a.getAttribute('href'), a]));

    const setActive = (id) => {
      links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${id}`));
    };

    const sections = ['home','about','skills','projects','writing','contact']
      .map((id) => ({ id, el: id === 'home' ? document.querySelector('main#home') : document.getElementById(id) }))
      .filter((s) => s.el);

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id || 'home';
            setActive(id);
          }
        });
      }, { rootMargin: '-40% 0px -50% 0px', threshold: 0.1 });

      sections.forEach((s) => io.observe(s.el));
    } else if (window.ScrollTrigger) {
      // Fallback to ScrollTrigger if available
      sections.forEach((s) => {
        ScrollTrigger.create({
          trigger: s.el,
          start: 'top center',
          end: 'bottom center',
          onEnter: () => setActive(s.id),
          onEnterBack: () => setActive(s.id)
        });
      });
    } else {
      // Last-resort scroll listener
      const onScroll = () => {
        const y = window.scrollY + window.innerHeight * 0.35;
        let current = 'home';
        sections.forEach((s) => {
          const rect = s.el.getBoundingClientRect();
          const top = rect.top + window.scrollY;
          if (y >= top) current = s.id;
        });
        setActive(current);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  });

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGSAP);
  } else {
    initGSAP();
  }
})();
