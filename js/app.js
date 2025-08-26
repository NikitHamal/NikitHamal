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
  // Initialize writing/read pages after DOM ready
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
    const svg = encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#e5e7eb'/><stop offset='100%' stop-color='#cbd5e1'/></linearGradient></defs><rect width='100%' height='100%' fill='url(#g)'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Inter,Arial,sans-serif' font-size='42' fill='#475569' opacity='0.6'>${text}</text></svg>`);
    return `url("data:image/svg+xml,${svg}")`;
  }
  function svgDataURI(text = 'No image') {
    const svg = encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#e5e7eb'/><stop offset='100%' stop-color='#cbd5e1'/></linearGradient></defs><rect width='100%' height='100%' fill='url(#g)'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Inter,Arial,sans-serif' font-size='42' fill='#475569' opacity='0.6'>${text}</text></svg>`);
    return `data:image/svg+xml,${svg}`;
  }
  function preloadImage(url) {
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
      if (!src) return; // leave gradient placeholder
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
    return posts.filter(Boolean).sort((a,b) => new Date(b.date) - new Date(a.date));
  }
  function renderWritingPage(posts) {
    const grid = document.getElementById('postsGrid');
    if (!grid) return;
    if (!posts.length) { grid.innerHTML = '<p class="muted">No posts yet.</p>'; return; }
    const featured = posts.find(p => p.featured) || posts[0];
    const rest = posts.filter(p => p.slug !== featured.slug).slice(0, 6);
    const featImg = resolveImagePath(featured.image);
    const featRT = estimateReadingTime(featured.contentHtml).mins;
    const featCard = `
<article class="post featured">
  <a class="post__link" href="read.html?slug=${featured.slug}">
    <div class="post__media banner" aria-hidden="true" data-bg="${featImg || ''}"></div>
    <div class="post__body">
      <span class="badge">Featured</span>
      <h3>${featured.title}</h3>
      <div class="meta"><span>${new Date(featured.date).toLocaleDateString('en-US',{month:'short', day:'numeric', year:'numeric'})}</span><span>•</span><span>${featRT} min read</span></div>
    </div>
  </a>
</article>`;
    const sideCards = rest.map(p => {
      const img = resolveImagePath(p.image);
      const rt = estimateReadingTime(p.contentHtml).mins;
      return `
<article class="post card-sm">
  <a class="post__link" href="read.html?slug=${p.slug}">
    <div class="thumb" aria-hidden="true" data-bg="${img || ''}"></div>
    <div class="post__body">
      <span class="badge muted">${p.category || 'Post'}</span>
      <h4>${p.title}</h4>
      <div class="meta"><span>${new Date(p.date).toLocaleDateString('en-US',{month:'short', day:'numeric', year:'numeric'})}</span><span>•</span><span>${rt} min read</span></div>
    </div>
  </a>
</article>`;
    }).join('');
    grid.innerHTML = featCard + `\n<div class="side">${sideCards}</div>`;
    hydrateMedia(grid);
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
    catEl.textContent = post.category || 'Post';
    const rt = estimateReadingTime(post.contentHtml).mins;
    meta.textContent = `${new Date(post.date).toLocaleDateString('en-US',{month:'short', day:'numeric', year:'numeric'})} • ${rt} min read`;
    if (banner) {
      banner.setAttribute('data-bg', img || '');
      hydrateMedia(document);
    }
    body.innerHTML = post.contentHtml;

    // Generate Table of Contents from h2/h3
    buildTOC();
    // Enhance inline images in article
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
    if (!headings.length) { if (tocWrap) tocWrap.style.display = 'none'; return; } else { if (tocWrap) tocWrap.style.display = ''; }
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
      container.innerHTML = '<p class="muted" style="text-align: center;">No posts yet. Check back soon!</p>';
      return;
    }

    const recentPosts = posts.slice(0, 2);
    const html = recentPosts.map(post => {
      const imagePath = resolveImagePath(post.image);
      const readingTime = estimateReadingTime(post.contentHtml).mins;
      const excerpt = htmlToText(post.contentHtml).substring(0, 100) + '...';

      return `
      <article class="writing-card">
        <a href="read.html?slug=${post.slug}" class="writing-card__link">
          <div class="writing-card__media" style="background-image: ${imagePath ? `url('${imagePath}')` : svgPlaceholder(post.title)}"></div>
          <div class="writing-card__body">
            <span class="writing-card__category">${post.category || 'Essay'}</span>
            <h3 class="writing-card__title">${post.title}</h3>
            <p class="writing-card__excerpt">${excerpt}</p>
            <div class="writing-card__meta">
              <time datetime="${post.date}">${new Date(post.date).toLocaleDateString('en-US',{month:'short', year:'numeric'})}</time>
              <span>&bull;</span>
              <span>${readingTime} min read</span>
            </div>
          </div>
        </a>
      </article>
    `;
    }).join('');

    container.innerHTML = html;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      schedule(initWriting);
      schedule(initRead);
      schedule(initWritingPreview);
    });
  } else {
    schedule(initWriting);
    schedule(initRead);
    schedule(initWritingPreview);
  }
})();
