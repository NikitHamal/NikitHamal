/**
 * NEOBRUTALIST PORTFOLIO - Nikit Hamal
 * Clean, modern JavaScript with CSS-only animations
 * No GSAP dependencies
 */

(function () {
  'use strict';

  // DOM Helpers
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

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
    const svg = encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#FFD000'/><stop offset='100%' stop-color='#FF6B6B'/></linearGradient></defs><rect width='100%' height='100%' fill='url(#g)'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Outfit,Arial,sans-serif' font-size='48' font-weight='900' fill='#0a0a0a'>${text}</text></svg>`);
    return `url("data:image/svg+xml,${svg}")`;
  }

  function svgDataURI(text = 'No image') {
    const svg = encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#FFD000'/><stop offset='100%' stop-color='#FF6B6B'/></linearGradient></defs><rect width='100%' height='100%' fill='url(#g)'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Outfit,Arial,sans-serif' font-size='48' font-weight='900' fill='#0a0a0a'>${text}</text></svg>`);
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
    const nodes = $$('[data-bg]', root);
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

  // ============================================
  // HEADER SCROLL EFFECT
  // ============================================

  function initHeaderScroll() {
    const header = $('.header');
    if (!header) return;

    let lastScroll = 0;
    let ticking = false;

    function updateHeader() {
      const currentScroll = window.scrollY;

      if (currentScroll > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }

      lastScroll = currentScroll;
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateHeader);
        ticking = true;
      }
    }, { passive: true });
  }

  // ============================================
  // MOBILE NAVIGATION
  // ============================================

  function initMobileNav() {
    const toggle = $('.nav-toggle');
    const menu = $('#nav-menu');
    if (!toggle || !menu) return;

    const setState = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';

      // Update toggle icon
      const icon = toggle.querySelector('i');
      if (icon) {
        icon.className = open ? 'ri-close-line' : 'ri-menu-4-line';
      }
    };

    toggle.addEventListener('click', () => {
      const isOpen = menu.classList.contains('open');
      setState(!isOpen);
    });

    // Close on link click
    $$('#nav-menu a').forEach((link) => {
      link.addEventListener('click', () => setState(false));
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!menu.classList.contains('open')) return;
      const within = menu.contains(e.target) || toggle.contains(e.target);
      if (!within) setState(false);
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        setState(false);
      }
    });
  }

  // ============================================
  // MODAL DIALOGS
  // ============================================

  function initModals() {
    const avatar = $('#avatarImg');
    const card = $('#profileCard');
    const photoDialog = $('#photoDialog');
    const profileDialog = $('#profileDialog');

    if (!photoDialog || !profileDialog) return;

    const openDialog = (dlg) => {
      if (typeof dlg.showModal === 'function') {
        dlg.showModal();
      } else {
        dlg.setAttribute('open', '');
      }
      document.body.style.overflow = 'hidden';
    };

    const closeDialog = (dlg) => {
      if (typeof dlg.close === 'function') {
        dlg.close();
      } else {
        dlg.removeAttribute('open');
      }
      document.body.style.overflow = '';
    };

    // Close buttons
    [photoDialog, profileDialog].forEach((dlg) => {
      const btn = dlg.querySelector('[data-close]');
      if (btn) {
        btn.addEventListener('click', () => closeDialog(dlg));
      }

      // Backdrop click
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

    // Avatar click opens photo
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

    // Card click opens profile
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
  }

  // ============================================
  // INTERSECTION OBSERVER FOR ANIMATIONS
  // ============================================

  function initScrollAnimations() {
    // Create observer for fade-in animations
    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -50px 0px',
      threshold: 0.1
    };

    const animateOnScroll = (entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    };

    const observer = new IntersectionObserver(animateOnScroll, observerOptions);

    // Observe sections and cards
    $$('.section, .skill-card, .project-card, .writing-card, .explore-card, .contact-link').forEach(el => {
      el.classList.add('animate-ready');
      observer.observe(el);
    });
  }

  // ============================================
  // SMOOTH SCROLL FOR ANCHOR LINKS
  // ============================================

  function initSmoothScroll() {
    $$('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        if (targetId === '#') return;

        const target = $(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // ============================================
  // WRITING / BLOG FUNCTIONALITY
  // ============================================

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

    const posts = await Promise.all(
      idx.posts.map(slug => fetchJSON(`posts/${slug}.json`))
    );

    return posts
      .filter(Boolean)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function renderWritingCard(post) {
    const imagePath = resolveImagePath(post.image);
    const readingTime = estimateReadingTime(post.contentHtml).mins;
    const excerpt = htmlToText(post.contentHtml).substring(0, 120) + '...';
    const date = new Date(post.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    return `
      <article class="writing-card">
        <a href="read.html?slug=${post.slug}" class="writing-card__link">
          <div class="writing-card__media" style="background-image: ${imagePath ? `url('${imagePath}')` : svgPlaceholder(post.title)}"></div>
          <div class="writing-card__body">
            <span class="writing-card__category">${post.category || 'Article'}</span>
            <h3 class="writing-card__title">${post.title}</h3>
            <p class="writing-card__excerpt">${excerpt}</p>
            <div class="writing-card__meta">
              <time datetime="${post.date}">${date}</time>
              <span>•</span>
              <span>${readingTime} min read</span>
            </div>
          </div>
        </a>
      </article>
    `;
  }

  async function initWritingPreview() {
    const container = $('#writing-preview');
    if (!container) return;

    const posts = await loadAllPosts();

    if (!posts || posts.length === 0) {
      container.innerHTML = `
        <p style="text-align: center; padding: 40px 20px; color: var(--gray);">
          Amazing content coming soon!
        </p>
      `;
      return;
    }

    const recentPosts = posts.slice(0, 2);
    container.innerHTML = recentPosts.map(renderWritingCard).join('');
  }

  async function initWritingPage() {
    const grid = $('#postsGrid');
    if (!grid) return;

    const posts = await loadAllPosts();

    if (!posts || posts.length === 0) {
      grid.innerHTML = `
        <p style="text-align: center; padding: 60px 20px; color: var(--gray); grid-column: 1 / -1;">
          No posts yet. Epic content coming soon!
        </p>
      `;
      return;
    }

    grid.innerHTML = posts.map(renderWritingCard).join('');
  }

  // ============================================
  // READ PAGE FUNCTIONALITY
  // ============================================

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
    const container = $('#readBody');
    const list = $('#tocList');
    if (!container || !list) return;

    list.innerHTML = '';
    const headings = $$('h2, h3', container);
    const tocWrap = $('#toc');

    if (!headings.length) {
      if (tocWrap) tocWrap.style.display = 'none';
      return;
    }

    if (tocWrap) tocWrap.style.display = '';

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
    const links = $$('a', list);
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

    // Smooth scroll for TOC links
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
    $$('img', container).forEach((img) => {
      img.loading = 'lazy';
      img.decoding = 'async';
      const fallback = svgDataURI(img.alt || 'Image');
      img.addEventListener('error', () => { img.src = fallback; });
    });
  }

  async function initReadPage() {
    const body = $('#readBody');
    if (!body) return;

    const params = new URLSearchParams(location.search);
    const slug = params.get('slug');
    const data = slug ? await fetchJSON(`posts/${slug}.json`) : null;
    const post = data || (await loadAllPosts())[0];

    if (!post) return;

    const img = resolveImagePath(post.image);
    const meta = $('#readMeta');
    const titleEl = $('#readTitle');
    const catEl = $('#readCategory');
    const banner = $('#readBanner');

    if (titleEl) titleEl.textContent = post.title;
    if (catEl) catEl.textContent = post.category || 'Article';

    const rt = estimateReadingTime(post.contentHtml).mins;
    const date = new Date(post.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    if (meta) meta.textContent = `${date} • ${rt} min read`;

    if (banner) {
      banner.setAttribute('data-bg', img || '');
      hydrateMedia(document);
    }

    body.innerHTML = post.contentHtml;
    buildTOC();
    enhanceContentImages(body);
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  function init() {
    initHeaderScroll();
    initMobileNav();
    initModals();
    initSmoothScroll();
    initScrollAnimations();
    initWritingPreview();
    initWritingPage();
    initReadPage();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
