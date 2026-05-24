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

  // Pagination State
  let nextPageToken = null;
  let isFetching = false;

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

  async function loadAllPosts(pageToken = null) {
    const { apiKey, blogId } = window.BLOGGER_CONFIG || {};
    if (!apiKey || !blogId || apiKey === 'YOUR_API_KEY_HERE') {
      if (!pageToken) {
        console.warn('Blogger API config missing or placeholders used. Falling back to local posts.');

        const idx = await fetchJSON('posts/index.json');
        if (!idx || !Array.isArray(idx.posts)) return [];

        const posts = await Promise.all(
          idx.posts.map(slug => fetchJSON(`posts/${slug}.json`))
        );

        return posts
          .filter(Boolean)
          .sort((a, b) => new Date(b.date) - new Date(a.date));
      }
      return [];
    }

    let url = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts?key=${apiKey}&maxResults=9`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const data = await fetchJSON(url);

    if (!data || !data.items) {
      console.warn('No posts found from Blogger.');
      nextPageToken = null;
      return [];
    }

    nextPageToken = data.nextPageToken || null;

    return data.items.map(post => ({
      id: post.id,
      slug: post.id,
      title: post.title,
      date: post.published,
      category: 'Blogger',
      image: post.images ? post.images[0].url : null,
      contentHtml: post.content,
      isBlogger: true
    }));
  }

  function renderWritingCard(post) {
    const isBlogger = post.isBlogger;
    const imagePath = isBlogger ? post.image : resolveImagePath(post.image);
    const readingTime = estimateReadingTime(post.contentHtml).mins;
    const excerpt = post.excerpt || (htmlToText(post.contentHtml).substring(0, 120) + '...');
    const date = new Date(post.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const link = `read.html?${isBlogger ? 'id' : 'slug'}=${post.slug}`;

    return `
      <article class="writing-card">
        <a href="${link}" class="writing-card__link">
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
    updatePaginationControls();
  }

  function updatePaginationControls() {
    const container = $('#paginationContainer');
    if (!container) return;

    if (nextPageToken) {
      container.innerHTML = `
        <button id="loadMoreBtn" class="load-more-btn">
          <span>Load More Posts</span>
          <i class="ri-refresh-line"></i>
        </button>
      `;
      $('#loadMoreBtn').addEventListener('click', handleLoadMore);
    } else {
      container.innerHTML = '';
    }
  }

  async function handleLoadMore() {
    if (isFetching || !nextPageToken) return;

    const btn = $('#loadMoreBtn');
    if (btn) {
      btn.disabled = true;
      btn.classList.add('loading');
      btn.querySelector('span').textContent = 'Loading...';
    }

    isFetching = true;
    const newPosts = await loadAllPosts(nextPageToken);
    isFetching = false;

    if (newPosts.length > 0) {
      const grid = $('#postsGrid');
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = newPosts.map(renderWritingCard).join('');

      // Append nodes individually to trigger animations if necessary
      while (tempDiv.firstChild) {
        const el = tempDiv.firstChild;
        grid.appendChild(el);
        // Refresh intersection observer for new elements
        if (window.IntersectionObserver) {
          const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                obs.unobserve(entry.target);
              }
            });
          });
          if (el.nodeType === 1) observer.observe(el);
        }
      }
    }

    updatePaginationControls();
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
    const layout = $('.read-layout');

    if (!headings.length) {
      if (tocWrap) tocWrap.style.display = 'none';
      if (layout) layout.classList.add('no-sidebar');
      return;
    }

    if (tocWrap) tocWrap.style.display = '';
    if (layout) layout.classList.remove('no-sidebar');

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

  function cleanBloggerStyles(container) {
    // Blogger posts often contain nested divs, spans, and paragraphs with inline styles
    // (e.g. background-color: white; color: black; font-family: ...)
    // We want to remove these styles to make sure the site's dark mode design works perfectly.
    const styledElements = $$('[style]', container);
    styledElements.forEach((el) => {
      // Keep style on elements that genuinely need it (like maps, custom charts, videos or iframes)
      const tagName = el.tagName.toLowerCase();
      if (tagName === 'iframe' || tagName === 'video' || tagName === 'embed') return;
      
      // Let's remove typical blogger override properties from the style attribute
      el.style.background = '';
      el.style.backgroundColor = '';
      el.style.color = '';
      el.style.fontFamily = '';
      el.style.fontSize = '';
      el.style.lineHeight = '';
      
      // If the style attribute is now empty or only contains whitespace, remove it entirely
      if (!el.getAttribute('style') || el.getAttribute('style').trim() === '') {
        el.removeAttribute('style');
      }
    });

    // Blogger also uses bgcolor attribute on tables or divs sometimes
    $$('[bgcolor]', container).forEach(el => el.removeAttribute('bgcolor'));
    
    // Also remove legacy font styling attributes
    $$('font', container).forEach((font) => {
      font.removeAttribute('color');
      font.removeAttribute('face');
      font.removeAttribute('size');
    });

    // Remove empty paragraphs or spans that blogger might have generated for spacing
    // which can create huge gaps in the article
    $$('p, span', container).forEach((el) => {
      if (el.innerHTML.trim() === '&nbsp;' || el.innerHTML.trim() === '<br>') {
        el.style.margin = '0';
        el.style.padding = '0';
        el.style.height = '0';
      }
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
    const id = params.get('id');

    let post = null;

    if (id) {
      // Fetch from Blogger
      const { apiKey, blogId } = window.BLOGGER_CONFIG || {};
      if (apiKey && blogId && apiKey !== 'YOUR_API_KEY_HERE') {
        const url = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${id}?key=${apiKey}`;
        const data = await fetchJSON(url);
        if (data) {
          post = {
            id: data.id,
            title: data.title,
            date: data.published,
            category: 'Blogger',
            image: data.images ? data.images[0].url : null,
            contentHtml: data.content,
            isBlogger: true
          };
        }
      }
    } else if (slug) {
      // Fetch from Local
      post = await fetchJSON(`posts/${slug}.json`);
    }

    // Fallback to first available post if nothing found
    if (!post) {
      const allPosts = await loadAllPosts();
      post = allPosts[0];
    }

    if (!post) {
      body.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--gray);">Post not found.</p>';
      return;
    }

    const img = post.isBlogger ? post.image : resolveImagePath(post.image);
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
      if (img) {
        banner.style.backgroundImage = `url('${img}')`;
        banner.style.backgroundSize = 'cover';
        banner.style.backgroundPosition = 'center';
      } else {
        banner.style.display = 'none';
      }
    }

    body.innerHTML = post.contentHtml;
    cleanBloggerStyles(body);
    buildTOC();
    enhanceContentImages(body);

    // Update Meta Tags and Title
    const fullTitle = `${post.title} — Nikit Hamal`;
    document.title = fullTitle;

    const excerpt = post.excerpt || (htmlToText(post.contentHtml).substring(0, 160) + '...');
    const postUrl = window.location.href;
    const postImage = img ? (img.startsWith('http') ? img : `https://nikit.is-a.dev/${img}`) : 'https://nikit.is-a.dev/assets/nikit.jpg';

    // Update Open Graph
    if ($('#og-title')) $('#og-title').setAttribute('content', fullTitle);
    if ($('#og-desc')) $('#og-desc').setAttribute('content', excerpt);
    if ($('#og-url')) $('#og-url').setAttribute('content', postUrl);
    if ($('#og-image')) $('#og-image').setAttribute('content', postImage);

    // Update Twitter
    if ($('#twitter-title')) $('#twitter-title').setAttribute('content', fullTitle);
    if ($('#twitter-desc')) $('#twitter-desc').setAttribute('content', excerpt);
    if ($('#twitter-url')) $('#twitter-url').setAttribute('content', postUrl);
    if ($('#twitter-image')) $('#twitter-image').setAttribute('content', postImage);
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
