// NEOBRUTALIST PORTFOLIO - Enhanced Animations & Interactions
// Nikit Hamal - Ultra Creative JavaScript with Advanced GSAP Animations

(function () {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  // ============= UTILITY FUNCTIONS =============
  function htmlToText(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    return (tmp.textContent || tmp.innerText || '').trim();
  }

  function estimateReadingTime(html) {
    const words = htmlToText(html).split(/\s+/).filter(Boolean).length;
    const mins = Math.max(1, Math.round(words / 220));
    return { mins, words };
  }

  function resolveImagePath(src) {
    if (!src) return null;
    if (/^https?:\/\//i.test(src)) return src;
    if (src.startsWith('/') || src.startsWith('assets/')) return src;
    return `assets/${src}`;
  }

  function svgPlaceholder(text = 'No image') {
    const svg = encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#FFD93D'/><stop offset='100%' stop-color='#FF3366'/></linearGradient></defs><rect width='100%' height='100%' fill='url(#g)'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Outfit,Arial,sans-serif' font-size='48' font-weight='900' fill='#000'>${text}</text></svg>`);
    return `url("data:image/svg+xml,${svg}")`;
  }

  function svgDataURI(text = 'No image') {
    const svg = encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#FFD93D'/><stop offset='100%' stop-color='#FF3366'/></linearGradient></defs><rect width='100%' height='100%' fill='url(#g)'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Outfit,Arial,sans-serif' font-size='48' font-weight='900' fill='#000'>${text}</text></svg>`);
    return `data:image/svg+xml,${svg}`;
  }

  async function preloadImage(url) {
    return new Promise((resolve) => {
      if (!url) return resolve(false);
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  async function hydrateMedia(root = document) {
    const nodes = Array.from(root.querySelectorAll('[data-bg]'));
    await Promise.all(nodes.map(async (el) => {
      const src = el.getAttribute('data-bg');
      if (!src) return;
      const ok = await preloadImage(src);
      if (ok) {
        el.style.backgroundImage = `url('${src}')`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
      } else {
        el.style.backgroundImage = svgPlaceholder('Image unavailable');
        el.style.backgroundSize = 'cover';
      }
    }));
  }

  // ============= MODAL DIALOGS =============
  document.addEventListener('DOMContentLoaded', () => {
    const avatar = document.getElementById('avatarImg');
    const card = document.getElementById('profileCard');
    const photoDialog = document.getElementById('photoDialog');
    const profileDialog = document.getElementById('profileDialog');

    if (!photoDialog || !profileDialog) return;

    const openDialog = (dlg) => {
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
      document.body.style.overflow = 'hidden';
    };

    const closeDialog = (dlg) => {
      if (typeof dlg.close === 'function') dlg.close();
      else dlg.removeAttribute('open');
      document.body.style.overflow = '';
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

      // Escape key
      dlg.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDialog(dlg);
      });
    });

    if (avatar) {
      avatar.addEventListener('click', (e) => {
        e.stopPropagation();
        openDialog(photoDialog);
      });
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

  // ============= MOBILE NAVIGATION =============
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

    // Close on link click
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

  // ============= ADVANCED GSAP ANIMATIONS =============
  function initGSAP() {
    if (!window.gsap) return;
    const gsap = window.gsap;
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

    // Enhanced blob animations with rotation and scale
    gsap.to('.blob-a', {
      x: '+=100',
      y: '+=80',
      scale: 1.2,
      rotation: 45,
      duration: 25,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut'
    });

    gsap.to('.blob-b', {
      x: '-=120',
      y: '-=90',
      scale: 0.8,
      rotation: -60,
      duration: 30,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut'
    });

    // EPIC HERO INTRO SEQUENCE
    const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    heroTl
      // Header slides down with bounce
      .from('.site-header', {
        y: -100,
        opacity: 0,
        duration: 0.8,
        ease: 'back.out(1.7)'
      })
      // Kicker pops in
      .from('.hero .kicker', {
        scale: 0,
        opacity: 0,
        rotation: -10,
        duration: 0.6,
        ease: 'back.out(2)'
      }, '-=0.3')
      // Title reveals with gradient effect
      .from('.hero__title', {
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: 'power4.out'
      }, '-=0.2')
      // Subtitle fades in with slide
      .from('.hero__subtitle', {
        y: 30,
        opacity: 0,
        duration: 0.7
      }, '-=0.3')
      // Buttons pop with stagger
      .from('.hero__cta .btn', {
        scale: 0,
        opacity: 0,
        rotation: 10,
        stagger: 0.1,
        duration: 0.5,
        ease: 'back.out(2)'
      }, '-=0.4')
      // Social icons bounce in
      .from('.social a', {
        y: 30,
        opacity: 0,
        rotation: 360,
        stagger: 0.08,
        duration: 0.6,
        ease: 'elastic.out(1, 0.5)'
      }, '-=0.5')
      // Profile card slides in
      .from('.hero__visual .card.glass.profile', {
        x: 100,
        opacity: 0,
        rotation: 5,
        duration: 0.8,
        ease: 'back.out(1.4)'
      }, '-=0.6')
      // Stats reveal with bounce
      .from('.hero__visual .stat', {
        scale: 0,
        opacity: 0,
        stagger: 0.1,
        duration: 0.6,
        ease: 'back.out(2)'
      }, '-=0.5');

    // Add floating animation to hero elements
    gsap.to('.hero__visual .card.glass.profile', {
      y: -10,
      duration: 3,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut'
    });

    gsap.to('.stat', {
      y: -5,
      stagger: 0.2,
      duration: 2.5,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut'
    });

    // ============= SCROLL-TRIGGERED ANIMATIONS =============
    if (window.ScrollTrigger) {
      // Section titles with dynamic entrance
      gsap.utils.toArray('.section-title, .section h2').forEach((title) => {
        gsap.from(title, {
          scrollTrigger: {
            trigger: title,
            start: 'top 85%',
            toggleActions: 'play none none reverse'
          },
          scale: 0.8,
          opacity: 0,
          y: 50,
          rotation: -3,
          duration: 0.8,
          ease: 'back.out(1.5)'
        });
      });

      // Cards fly in with 3D effect
      gsap.utils.toArray('.card, .skill-category, .project, .writing-card').forEach((card, i) => {
        gsap.from(card, {
          scrollTrigger: {
            trigger: card,
            start: 'top 90%',
            toggleActions: 'play none none reverse'
          },
          y: 80,
          opacity: 0,
          rotationX: -45,
          scale: 0.9,
          duration: 0.8,
          delay: (i % 3) * 0.1,
          ease: 'power3.out'
        });
      });

      // About chips with bounce
      gsap.utils.toArray('.about-chip').forEach((chip, i) => {
        gsap.from(chip, {
          scrollTrigger: {
            trigger: chip,
            start: 'top 90%',
            toggleActions: 'play none none reverse'
          },
          x: i % 2 === 0 ? -100 : 100,
          opacity: 0,
          rotation: i % 2 === 0 ? -10 : 10,
          duration: 0.8,
          ease: 'back.out(1.5)'
        });
      });

      // Exploring items slide with creative timing
      gsap.utils.toArray('.exploring-item').forEach((item, i) => {
        gsap.from(item, {
          scrollTrigger: {
            trigger: item,
            start: 'top 90%',
            toggleActions: 'play none none reverse'
          },
          x: -100,
          opacity: 0,
          duration: 0.7,
          delay: i * 0.15,
          ease: 'power2.out'
        });
      });

      // Skills list items with typewriter effect
      gsap.utils.toArray('.skill-list li').forEach((li, i) => {
        gsap.from(li, {
          scrollTrigger: {
            trigger: li,
            start: 'top 95%',
            toggleActions: 'play none none reverse'
          },
          x: -50,
          opacity: 0,
          duration: 0.5,
          delay: (i % 5) * 0.08,
          ease: 'power2.out'
        });
      });

      // Parallax effect on project media
      $$('.card__media, .writing-card__media').forEach((media) => {
        gsap.fromTo(media,
          { yPercent: -15 },
          {
            yPercent: 15,
            ease: 'none',
            scrollTrigger: {
              trigger: media,
              scrub: 0.5,
              start: 'top bottom',
              end: 'bottom top'
            }
          }
        );
      });

      // Contact section with dramatic entrance
      gsap.from('.contact-title', {
        scrollTrigger: {
          trigger: '.contact',
          start: 'top 80%',
          toggleActions: 'play none none reverse'
        },
        scale: 0.5,
        opacity: 0,
        y: 100,
        duration: 1,
        ease: 'elastic.out(1, 0.6)'
      });

      gsap.from('.contact-link', {
        scrollTrigger: {
          trigger: '.contact-links',
          start: 'top 85%',
          toggleActions: 'play none none reverse'
        },
        y: 60,
        opacity: 0,
        stagger: 0.1,
        duration: 0.6,
        ease: 'back.out(1.5)'
      });

      // About image with zoom effect
      gsap.from('.about-image-container', {
        scrollTrigger: {
          trigger: '.about-image-container',
          start: 'top 80%',
          toggleActions: 'play none none reverse'
        },
        scale: 0.8,
        opacity: 0,
        rotation: -5,
        duration: 1,
        ease: 'power3.out'
      });

      // Header hide/show on scroll
      let lastScroll = 0;
      ScrollTrigger.create({
        start: 'top -100',
        end: 99999,
        onUpdate: (self) => {
          const currentScroll = self.scroll();
          if (currentScroll > lastScroll && currentScroll > 200) {
            gsap.to('.site-header', {
              y: -120,
              duration: 0.3,
              ease: 'power2.in'
            });
          } else {
            gsap.to('.site-header', {
              y: 0,
              duration: 0.3,
              ease: 'power2.out'
            });
          }
          lastScroll = currentScroll;
        }
      });
    }

    // Add hover animations to buttons
    $$('.btn, .link, .contact-link').forEach((btn) => {
      btn.addEventListener('mouseenter', () => {
        gsap.to(btn, {
          scale: 1.05,
          duration: 0.3,
          ease: 'back.out(2)'
        });
      });
      btn.addEventListener('mouseleave', () => {
        gsap.to(btn, {
          scale: 1,
          duration: 0.3,
          ease: 'power2.out'
        });
      });
    });

    // Add magnetic effect to social icons
    $$('.social a').forEach((icon) => {
      icon.addEventListener('mousemove', (e) => {
        const rect = icon.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        gsap.to(icon, {
          x: x * 0.3,
          y: y * 0.3,
          duration: 0.3,
          ease: 'power2.out'
        });
      });

      icon.addEventListener('mouseleave', () => {
        gsap.to(icon, {
          x: 0,
          y: 0,
          duration: 0.5,
          ease: 'elastic.out(1, 0.5)'
        });
      });
    });
  }

  // ============= WRITING & READ PAGES =============
  async function fetchJSON(url) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e) {
      console.warn('Failed to fetch', url, e);
      return null;
    }
  }

  async function loadAllPosts() {
    const idx = await fetchJSON('posts/index.json');
    if (!idx || !Array.isArray(idx.posts)) return [];
    const posts = await Promise.all(idx.posts.map(async (slug) => {
      const data = await fetchJSON(`posts/${slug}.json`);
      return data;
    }));
    return posts.filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function renderWritingPage(posts) {
    const grid = document.getElementById('postsGrid');
    if (!grid) return;
    if (!posts || posts.length === 0) {
      grid.innerHTML = '<p class="muted" style="text-align: center; padding: 60px 20px; font-size: 1.2rem;">No posts yet. Epic content coming soon! 🚀</p>';
      return;
    }

    const html = posts.map(post => {
      const imagePath = resolveImagePath(post.image);
      const readingTime = estimateReadingTime(post.contentHtml).mins;
      const excerpt = htmlToText(post.contentHtml).substring(0, 120) + '...';

      return `
      <article class="writing-card">
        <a href="read.html?slug=${post.slug}" class="writing-card__link">
          <div class="writing-card__media" style="background-image: ${imagePath ? `url('${imagePath}')` : svgPlaceholder(post.title)}"></div>
          <div class="writing-card__body">
            <span class="writing-card__category">${post.category || 'Article'}</span>
            <h3 class="writing-card__title">${post.title}</h3>
            <p class="writing-card__excerpt">${excerpt}</p>
            <div class="writing-card__meta">
              <time datetime="${post.date}">${new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>
              <span>•</span>
              <span>${readingTime} min read</span>
            </div>
          </div>
        </a>
      </article>
    `;
    }).join('');

    grid.innerHTML = html;
  }

  async function initWriting() {
    if (!document.getElementById('postsGrid')) return;
    const posts = await loadAllPosts();
    renderWritingPage(posts);
  }

  async function initRead() {
    const body = document.getElementById('readBody');
    if (!body) return;
    const params = new URLSearchParams(location.search);
    const slug = params.get('slug');
    const data = slug ? await fetchJSON(`posts/${slug}.json`) : null;
    const post = data || (await loadAllPosts())[0];
    if (!post) return;
    const img = resolveImagePath(post.image);
    const meta = document.getElementById('readMeta');
    const titleEl = document.getElementById('readTitle');
    const catEl = document.getElementById('readCategory');
    const banner = document.getElementById('readBanner');

    titleEl.textContent = post.title;
    catEl.textContent = post.category || 'Article';
    const rt = estimateReadingTime(post.contentHtml).mins;
    meta.textContent = `${new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • ${rt} min read`;

    if (banner) {
      banner.setAttribute('data-bg', img || '');
      hydrateMedia(document);
    }
    body.innerHTML = post.contentHtml;

    buildTOC();
    enhanceContentImages(body);
  }

  function slugify(text) {
    return (text || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  function buildTOC() {
    const container = document.getElementById('readBody');
    const list = document.getElementById('tocList');
    if (!container || !list) return;
    list.innerHTML = '';
    const headings = Array.from(container.querySelectorAll('h2, h3'));
    const tocWrap = document.getElementById('toc');
    if (!headings.length) {
      if (tocWrap) tocWrap.style.display = 'none';
      return;
    } else {
      if (tocWrap) tocWrap.style.display = '';
    }
    headings.forEach((h) => {
      if (!h.id) h.id = slugify(h.textContent);
      const depth = h.tagName.toLowerCase() === 'h3' ? 2 : 1;
      const li = document.createElement('li');
      if (depth === 2) li.classList.add('depth-2');
      const a = document.createElement('a');
      a.href = `#${h.id}`;
      a.textContent = h.textContent;
      li.appendChild(a);
      list.appendChild(li);
    });

    // Scrollspy
    const links = Array.from(list.querySelectorAll('a'));
    const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const id = e.target.id;
          links.forEach((l) => l.classList.remove('active'));
          const active = map.get(id);
          if (active) active.classList.add('active');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: [0, 1] });
    headings.forEach((h) => io.observe(h));

    // Smooth scroll
    list.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a) return;
      e.preventDefault();
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function enhanceContentImages(container) {
    const imgs = Array.from(container.querySelectorAll('img'));
    imgs.forEach((img) => {
      img.loading = 'lazy';
      img.decoding = 'async';
      const fallback = svgDataURI(img.alt || 'Image');
      img.addEventListener('error', () => { img.src = fallback; });
    });
  }

  async function initWritingPreview() {
    const container = document.getElementById('writing-preview');
    if (!container) return;

    const posts = await loadAllPosts();
    if (!posts || posts.length === 0) {
      container.innerHTML = '<p class="muted" style="text-align: center; padding: 40px 20px; font-size: 1.1rem;">Amazing content coming soon! 🎨</p>';
      return;
    }

    const recentPosts = posts.slice(0, 2);
    const html = recentPosts.map(post => {
      const imagePath = resolveImagePath(post.image);
      const readingTime = estimateReadingTime(post.contentHtml).mins;
      const excerpt = htmlToText(post.contentHtml).substring(0, 120) + '...';

      return `
      <article class="writing-card">
        <a href="read.html?slug=${post.slug}" class="writing-card__link">
          <div class="writing-card__media" style="background-image: ${imagePath ? `url('${imagePath}')` : svgPlaceholder(post.title)}"></div>
          <div class="writing-card__body">
            <span class="writing-card__category">${post.category || 'Article'}</span>
            <h3 class="writing-card__title">${post.title}</h3>
            <p class="writing-card__excerpt">${excerpt}</p>
            <div class="writing-card__meta">
              <time datetime="${post.date}">${new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>
              <span>•</span>
              <span>${readingTime} min read</span>
            </div>
          </div>
        </a>
      </article>
    `;
    }).join('');

    container.innerHTML = html;
  }

  // ============= INITIALIZATION =============
  const schedule = (cb) => {
    if ('requestIdleCallback' in window) return requestIdleCallback(cb, { timeout: 1500 });
    return setTimeout(cb, 0);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      schedule(initGSAP);
      schedule(initWriting);
      schedule(initRead);
      schedule(initWritingPreview);
    });
  } else {
    schedule(initGSAP);
    schedule(initWriting);
    schedule(initRead);
    schedule(initWritingPreview);
  }

  // Add cursor trail effect (optional creative touch)
  let cursorTrail = [];
  const maxTrail = 20;

  document.addEventListener('mousemove', (e) => {
    if (window.innerWidth < 768) return; // Disable on mobile

    const dot = document.createElement('div');
    dot.style.cssText = `
      position: fixed;
      width: 8px;
      height: 8px;
      background: linear-gradient(135deg, #FF3366, #FFD93D);
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      left: ${e.clientX - 4}px;
      top: ${e.clientY - 4}px;
      opacity: 0.6;
      transition: opacity 0.5s;
    `;
    document.body.appendChild(dot);
    cursorTrail.push(dot);

    if (cursorTrail.length > maxTrail) {
      const oldest = cursorTrail.shift();
      if (oldest) oldest.remove();
    }

    setTimeout(() => {
      dot.style.opacity = '0';
      setTimeout(() => dot.remove(), 500);
    }, 300);
  });

  console.log('%c🚀 NEOBRUTALIST PORTFOLIO LOADED! 🎨', 'font-size: 20px; font-weight: bold; color: #FF3366; text-shadow: 2px 2px 0 #000;');
  console.log('%cBuilt with ❤️ by Nikit Hamal', 'font-size: 14px; color: #FFD93D;');
})();
