/**
 * MINIMALIST PORTFOLIO - Nikit Hamal
 * Clean, modern JavaScript with Accordion & Minimal Aesthetics
 */

(function () {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  // ============================================
  // CLEAN TRACKING PARAMS (fbclid, gclid, utm_*, …)
  // Social/ad redirects append junk like ?slug=x&fbclid=…. The post still
  // loads (URLSearchParams ignores extras), but the junk stays in the
  // address bar and leaks into og:url / copied links. Strip it in place.
  // ============================================

  const TRACKING_PARAMS = new Set([
    'fbclid', 'gclid', 'gbraid', 'wbraid', 'msclkid', 'dclid',
    'ttclid', 'twclid', 'igshid', 'yclid', 'zanpid', 'scop',
    'mc_cid', 'mc_eid', '_ga', '_gl', '_openstat',
    'vero_conv', 'vero_id', 'mkt_tok', 'fb_action_ids',
    'fb_action_types', 'fb_source', 'fb_ref'
  ]);

  function isTrackingParam(name) {
    const n = name.toLowerCase();
    return TRACKING_PARAMS.has(n) || n.startsWith('utm_');
  }

  function stripTrackingParams() {
    try {
      const url = new URL(window.location.href);
      // Collect first: deleting inside forEach skips entries.
      const junk = [];
      url.searchParams.forEach((_, name) => {
        if (isTrackingParam(name)) junk.push(name);
      });
      if (junk.length) {
        junk.forEach((name) => url.searchParams.delete(name));
        window.history.replaceState(null, '', url.toString());
      }
    } catch (e) {}
  }

  let nextPageToken = null;
  let isFetching = false;

  // ============================================
  // THEMES & PALETTES (Default, Sepia, Slate)
  // ============================================

  const PALETTE_COLORS = {
    default: { light: '#faf9f6', dark: '#0e0e10' },
    sepia: { light: '#f4ede2', dark: '#181512' },
    slate: { light: '#f1f4f8', dark: '#0c121e' }
  };

  function applyPalette(palette, save = true) {
    const valid = ['default', 'sepia', 'slate'].includes(palette) ? palette : 'default';
    document.documentElement.setAttribute('data-palette', valid);
    if (save) {
      try {
        localStorage.setItem('reader-palette', valid);
      } catch (e) {}
    }
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      const colors = PALETTE_COLORS[valid] || PALETTE_COLORS.default;
      metaTheme.setAttribute('content', currentTheme === 'dark' ? colors.dark : colors.light);
    }
    document.querySelectorAll('[data-set-palette]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.setPalette === valid));
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const currentPalette = document.documentElement.getAttribute('data-palette') || 'default';
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      const colors = PALETTE_COLORS[currentPalette] || PALETTE_COLORS.default;
      metaTheme.setAttribute('content', theme === 'dark' ? colors.dark : colors.light);
    }
  }

  function initTheme() {
    const storedPalette = localStorage.getItem('reader-palette') || 'default';
    applyPalette(storedPalette, false);

    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored || (prefersDark ? 'dark' : 'light');
    applyTheme(theme);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });

    document.querySelectorAll('.theme-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem('theme', next);
      });
    });
  }

  // ============================================
  // ACCORDION NAVIGATION
  // ============================================

  function initAccordions() {
    const items = $$('.accordion-item');
    items.forEach((item, index) => {
      const btn = item.querySelector('.accordion-header');
      if (!btn) return;

      // Expand ABOUT section by default
      if (index === 0) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }

      btn.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        item.classList.toggle('open', !isOpen);
        btn.setAttribute('aria-expanded', String(!isOpen));
      });
    });
  }

  // ============================================
  // MODALS & DIALOGS
  // ============================================

  function initModals() {
    const helpBtn = $('#helpBtn');
    const helpModal = $('#helpModal');
    const closeHelpBtn = $('#closeHelpModal');
    const avatarContainer = $('#avatarContainer');
    const avatarImg = $('#avatarImg');
    const photoDialog = $('#photoDialog');

    const openDlg = (dlg) => {
      if (!dlg) return;
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    };

    const closeDlg = (dlg) => {
      if (!dlg) return;
      if (typeof dlg.close === 'function') dlg.close();
      else dlg.removeAttribute('open');
    };

    if (helpBtn && helpModal) {
      helpBtn.addEventListener('click', () => openDlg(helpModal));
    }
    if (closeHelpBtn && helpModal) {
      closeHelpBtn.addEventListener('click', () => closeDlg(helpModal));
    }

    if (avatarContainer && photoDialog) {
      avatarContainer.addEventListener('click', () => openDlg(photoDialog));
    } else if (avatarImg && photoDialog) {
      avatarImg.addEventListener('click', () => openDlg(photoDialog));
    }

    $$('.minimal-modal, .modal').forEach((dlg) => {
      const closeBtn = dlg.querySelector('[data-close]');
      if (closeBtn) closeBtn.addEventListener('click', () => closeDlg(dlg));

      dlg.addEventListener('click', (e) => {
        const rect = dlg.getBoundingClientRect();
        const inDialog = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (!inDialog) closeDlg(dlg);
      });

      dlg.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDlg(dlg);
      });
    });
  }

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
    if (src.startsWith('/')) return src;
    if (src.startsWith('assets/')) return `/${src}`;
    return `/assets/${src}`;
  }

  function svgPlaceholder(text = 'No image') {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const bg = theme === 'dark' ? '%23161616' : '%23f5f5f5';
    const fg = theme === 'dark' ? '%23999' : '%23525252';
    const svg = encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'><rect width='100%' height='100%' fill='${bg}'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='48' font-weight='700' fill='${fg}'>${text}</text></svg>`);
    return `url("data:image/svg+xml,${svg}")`;
  }

  // ============================================
  // WRITING / BLOG
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
        const idx = await fetchJSON('/posts/index.json');
        if (!idx || !Array.isArray(idx.posts)) return [];
        const posts = await Promise.all(idx.posts.map(slug => fetchJSON(`/posts/${slug}.json`)));
        return posts.filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date));
      }
      return [];
    }

    let url = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts?key=${apiKey}&maxResults=9`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const data = await fetchJSON(url);
    if (!data || !data.items) { nextPageToken = null; return []; }

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

  function ogThumbFor(post, cls) {
    const slug = (post.slug || '').trim();
    const src = slug ? `/assets/og/${slug}.png` : '/assets/og-image.png';
    const alt = String(post.title || '').replace(/"/g, '&quot;');
    return `<img src="${src}" alt="${alt}" class="${cls}" loading="lazy" onerror="this.onerror=null;this.src='/assets/og-image.png'" />`;
  }

  // Canonical link target for a post. Local posts use the pretty
  // /writings/<slug> URL; Blogger posts (no static page) keep read.html?id=.
  function postLink(post) {
    if (post.isBlogger) return `/read.html?id=${post.slug}`;
    return `/writings/${post.slug}`;
  }

  function renderMinimalWritingItem(post) {
    const cardVisual = ogThumbFor(post, 'writing-mini-thumb');
    const link = postLink(post);
    const date = new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const readingTime = estimateReadingTime(post.contentHtml).mins;

    return `
      <a href="${link}" class="writing-mini-item">
        <div class="writing-mini-thumb-wrap">
          ${cardVisual}
        </div>
        <div class="writing-mini-content">
          <div class="writing-mini-title">${post.title}</div>
          <div class="writing-mini-meta">${date} &bull; ${readingTime} min read</div>
        </div>
      </a>
    `;
  }

  function renderWritingCard(post) {
    const cardVisual = ogThumbFor(post, 'writing-card__thumb');
    const readingTime = estimateReadingTime(post.contentHtml).mins;
    const excerpt = post.excerpt || (htmlToText(post.contentHtml).substring(0, 140) + '...');
    const date = new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const link = postLink(post);

    return `
      <article class="writing-card">
        <a href="${link}" class="writing-card__link">
          <div class="writing-card__body">
            <span class="writing-card__category">${post.category || 'Essay'}</span>
            <h3 class="writing-card__title">${post.title}</h3>
            <p class="writing-card__excerpt">${excerpt}</p>
            <div class="writing-card__meta">
              <time datetime="${post.date}">${date}</time>
              <span>&middot;</span>
              <span>${readingTime} min read</span>
            </div>
          </div>
          <div class="writing-card__thumb-wrap">
            ${cardVisual}
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
      container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Essays coming soon.</p>';
      return;
    }
    container.innerHTML = posts.slice(0, 4).map(renderMinimalWritingItem).join('');
  }

  const WRITING_PAGE_SIZE = 6;
  const WRITING_CATS = [
    { key: 'all', label: 'All' },
    { key: 'essay', label: 'Essays' },
    { key: 'reflection', label: 'Reflections' },
    { key: 'poem', label: 'Poems' },
  ];

  function isBloggerMode() {
    const { apiKey, blogId } = window.BLOGGER_CONFIG || {};
    return Boolean(apiKey && blogId && apiKey !== 'YOUR_API_KEY_HERE');
  }

  async function initWritingPage() {
    const grid = $('#postsGrid');
    if (!grid) return;

    // Legacy Blogger path (API-driven with Load More) — unchanged behavior.
    if (isBloggerMode()) {
      const posts = await loadAllPosts();
      if (!posts || posts.length === 0) {
        grid.innerHTML = '<p style="text-align:center;padding:60px 20px;color:var(--text-muted);grid-column:1/-1;">No posts yet.</p>';
        return;
      }
      grid.innerHTML = posts.map(renderWritingCard).join('');
      updatePaginationControls();
      return;
    }

    const all = await loadAllPosts();
    if (!all || all.length === 0) {
      grid.innerHTML = '<p style="text-align:center;padding:60px 20px;color:var(--text-muted);grid-column:1/-1;">No posts yet.</p>';
      return;
    }

    const searchInput = $('#writingSearch');
    const chipsBox = $('#filterChips');
    const pager = $('#paginationContainer');
    const meta = $('#resultsMeta');
    const state = { q: '', cat: 'all', page: 1 };

    // Chip counts.
    const counts = { all: all.length, essay: 0, reflection: 0, poem: 0 };
    all.forEach((p) => {
      const c = String(p.category || '').toLowerCase();
      if (counts[c] !== undefined) counts[c]++;
    });
    if (chipsBox) {
      chipsBox.querySelectorAll('.filter-chip').forEach((chip) => {
        const c = chip.dataset.cat;
        const def = WRITING_CATS.find((d) => d.key === c);
        const label = def ? def.label : c;
        chip.innerHTML = '';
        const t = document.createElement('span');
        t.textContent = label;
        const n = document.createElement('span');
        n.className = 'chip-count';
        n.textContent = counts[c] !== undefined ? counts[c] : 0;
        chip.append(t, n);
      });
      chipsBox.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;
        state.cat = chip.dataset.cat;
        state.page = 1;
        chipsBox.querySelectorAll('.filter-chip').forEach((b) => b.classList.toggle('is-active', b === chip));
        render(true);
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        state.q = searchInput.value;
        state.page = 1;
        render(true);
      });
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchInput.value) {
          searchInput.value = '';
          state.q = '';
          state.page = 1;
          render(true);
        }
      });
      // "/" or Ctrl/Cmd+K focuses the filter from anywhere on this page.
      document.addEventListener('keydown', (e) => {
        const tag = (e.target.tagName || '').toUpperCase();
        if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.target.isContentEditable) return;
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          searchInput.focus();
        } else if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          searchInput.focus();
        }
      });
    }

    function filtered() {
      const q = state.q.trim().toLowerCase();
      return all.filter((p) => {
        if (state.cat !== 'all' && String(p.category || '').toLowerCase() !== state.cat) return false;
        if (q) {
          const hay = `${p.title || ''} ${(p.excerpt || '')}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
    }

    function renderPager(pages) {
      if (!pager) return;
      if (pages <= 1) { pager.innerHTML = ''; return; }
      const nums = [];
      for (let i = 1; i <= pages; i++) {
        if (pages <= 7 || i === 1 || i === pages || Math.abs(i - state.page) <= 1) nums.push(i);
        else if (nums[nums.length - 1] !== '…') nums.push('…');
      }
      let html = '<nav class="page-nav" aria-label="Pages">';
      html += `<button type="button" class="page-btn" data-page="${state.page - 1}"${state.page <= 1 ? ' disabled' : ''} aria-label="Previous page">←</button>`;
      nums.forEach((n) => {
        if (n === '…') html += '<span class="page-ellipsis">…</span>';
        else html += `<button type="button" class="page-btn${n === state.page ? ' is-current' : ''}" data-page="${n}"${n === state.page ? ' aria-current="page"' : ''}>${n}</button>`;
      });
      html += `<button type="button" class="page-btn" data-page="${state.page + 1}"${state.page >= pages ? ' disabled' : ''} aria-label="Next page">→</button>`;
      html += '</nav>';
      pager.innerHTML = html;
      pager.querySelectorAll('.page-btn[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const p = +btn.dataset.page;
          if (!p || p === state.page) return;
          state.page = p;
          render(false);
          const anchor = $('#writing-content');
          if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }

    function render(fromFilter) {
      void fromFilter;
      const list = filtered();
      const pages = Math.max(1, Math.ceil(list.length / WRITING_PAGE_SIZE));
      state.page = Math.min(Math.max(1, state.page), pages);
      const start = (state.page - 1) * WRITING_PAGE_SIZE;
      const slice = list.slice(start, start + WRITING_PAGE_SIZE);
      if (!slice.length) {
        grid.innerHTML = '<p style="text-align:center;padding:60px 20px;color:var(--text-muted);grid-column:1/-1;">Nothing matches. Try a different search or category.</p>';
      } else {
        grid.innerHTML = slice.map(renderWritingCard).join('');
      }
      if (meta) {
        const catLabel = state.cat === 'all' ? '' : ` in ${(WRITING_CATS.find((d) => d.key === state.cat) || {}).label || state.cat}`;
        meta.textContent = list.length === all.length && !state.q
          ? `${all.length} posts`
          : `${list.length} of ${all.length}${catLabel}`;
      }
      renderPager(pages);
    }

    render(false);
  }

  function updatePaginationControls() {
    const container = $('#paginationContainer');
    if (!container) return;
    if (nextPageToken) {
      container.innerHTML = '<button id="loadMoreBtn" class="load-more-btn"><span>Load More Posts</span><i class="ri-refresh-line"></i></button>';
      $('#loadMoreBtn').addEventListener('click', handleLoadMore);
    } else {
      container.innerHTML = '';
    }
  }

  async function handleLoadMore() {
    if (isFetching || !nextPageToken) return;
    const btn = $('#loadMoreBtn');
    if (btn) { btn.disabled = true; btn.classList.add('loading'); btn.querySelector('span').textContent = 'Loading...'; }
    isFetching = true;
    const newPosts = await loadAllPosts(nextPageToken);
    isFetching = false;
    if (newPosts.length > 0) {
      const grid = $('#postsGrid');
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = newPosts.map(renderWritingCard).join('');
      while (tempDiv.firstChild) {
        const el = tempDiv.firstChild;
        grid.appendChild(el);
      }
    }
    updatePaginationControls();
  }

  // ============================================
  // READ PAGE
  // ============================================

  function slugify(text) {
    return (text || '').toString().trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
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
  }

  function cleanBloggerStyles(element) {
    if (!element) return;
    const styledEls = $$('[style]', element);
    styledEls.forEach(el => {
      el.removeAttribute('style');
    });
  }

  function structureProseSections(body) {
    if (!body || body.querySelector('.passage')) return;

    // Normalize unformatted prose (e.g. posts with double <br> or <div> blocks instead of <p>)
    const initialParas = Array.from(body.querySelectorAll('p')).filter(p => p.textContent.trim().length > 10);
    if (initialParas.length <= 1) {
      // 1. If any <p> contains double <br>, split into separate <p> tags
      initialParas.forEach(p => {
        if (/<br\s*\/?>\s*<br\s*\/?>/i.test(p.innerHTML)) {
          const parts = p.innerHTML.split(/<br\s*\/?>\s*<br\s*\/?>/gi);
          if (parts.length > 1) {
            const frag = document.createDocumentFragment();
            for (let i = 0; i < parts.length; i++) {
              const part = parts[i].trim();
              if (!part) continue;
              if (i === parts.length - 1 && /^~?\s*proofread/i.test(part.replace(/<[^>]+>/g, '').trim()) && frag.lastChild) {
                frag.lastChild.innerHTML += `<br><br>${part}`;
                continue;
              }
              const newP = document.createElement('p');
              newP.innerHTML = part;
              frag.appendChild(newP);
            }
            if (frag.childNodes.length > 0) {
              p.parentNode.replaceChild(frag, p);
            }
          }
        }
      });

      // 2. If still <= 1 <p>, check for content divs or loose double <br> in body
      const remainingParas = Array.from(body.querySelectorAll('p')).filter(p => p.textContent.trim().length > 10);
      if (remainingParas.length <= 1) {
        const divs = Array.from(body.querySelectorAll('div')).filter(d => {
          if (d.classList.contains('separator') || d.querySelector('img, figure, svg, iframe')) return false;
          return d.textContent.trim().length > 15;
        });
        if (divs.length > 1) {
          divs.forEach(d => {
            const p = document.createElement('p');
            p.innerHTML = d.innerHTML;
            d.parentNode.replaceChild(p, d);
          });
        } else if (/<br\s*\/?>\s*<br\s*\/?>/i.test(body.innerHTML)) {
          const rawHTML = body.innerHTML;
          const parts = rawHTML.split(/<br\s*\/?>\s*<br\s*\/?>/gi);
          if (parts.length > 1) {
            body.innerHTML = parts.map((pt) => {
              const trimmed = pt.trim();
              if (!trimmed) return '';
              if (/^<(p|figure|div|blockquote|h[1-6])/i.test(trimmed)) return trimmed;
              return `<p>${trimmed}</p>`;
            }).join('');
          }
        }

        // 3. If still <= 1 <p> and the paragraph is long, split on sentence clusters
        const finalCheckParas = Array.from(body.querySelectorAll('p')).filter(p => p.textContent.trim().length > 10);
        if (finalCheckParas.length === 1 && finalCheckParas[0].textContent.trim().length > 320) {
          const singleP = finalCheckParas[0];
          const text = singleP.innerHTML.trim();
          // Split by sentence terminators followed by spaces and opening quotes/caps
          const sentences = text.split(/(?<=[.?!])\s+(?=[A-Z“"‘'—])/g);
          if (sentences.length > 1) {
            const frag = document.createDocumentFragment();
            let chunk = '';
            for (let i = 0; i < sentences.length; i++) {
              chunk += (chunk ? ' ' : '') + sentences[i];
              if (chunk.length >= 280 || i === sentences.length - 1) {
                const newP = document.createElement('p');
                newP.innerHTML = chunk;
                frag.appendChild(newP);
                chunk = '';
              }
            }
            if (frag.childNodes.length > 1) {
              singleP.parentNode.replaceChild(frag, singleP);
            }
          }
        }
      }
    }

    // Find all readable paragraphs and blockquotes
    const elements = Array.from(body.querySelectorAll('p, blockquote')).filter(el => {
      if (el.tagName.toLowerCase() === 'p' && el.parentElement && el.parentElement.tagName.toLowerCase() === 'blockquote') {
        return false;
      }
      return el.textContent.trim().length > 10;
    });

    const total = elements.length;
    if (total === 0) return;

    elements.forEach((el, index) => {
      const idx = index + 1;
      const numStr = String(idx).padStart(2, '0');

      const section = document.createElement('section');
      section.className = 'passage';
      section.id = `passage-${idx}`;
      section.setAttribute('aria-label', `Passage ${idx} of ${total}`);

      const num = document.createElement('span');
      num.className = 'passage-number ui';
      num.setAttribute('aria-hidden', 'true');
      num.textContent = numStr;

      el.parentNode.insertBefore(section, el);
      section.appendChild(num);
      section.appendChild(el);
    });
  }

  function enhanceContentImages(element) {
    if (!element) return;
    const images = $$('img', element);
    images.forEach(img => {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('data:')) {
        img.loading = 'lazy';
      }
    });
  }

  async function initReadPage() {
    const body = $('#readBody');
    if (!body) return;

    const params = new URLSearchParams(window.location.search);
    // Pretty URLs look like /writings/<slug> (served from writings/<slug>/index.html).
    const pathSlug = (window.location.pathname.match(/^\/writings\/([^/]+)\/?$/) || [])[1];
    const slug = (pathSlug ? decodeURIComponent(pathSlug) : null) || params.get('slug');
    const id = params.get('id');
    let post = null;

    if (id) {
      const { apiKey, blogId } = window.BLOGGER_CONFIG || {};
      if (apiKey && blogId && apiKey !== 'YOUR_API_KEY_HERE') {
        const url = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${id}?key=${apiKey}`;
        const data = await fetchJSON(url);
        if (data) {
          post = { id: data.id, title: data.title, date: data.published, category: 'Blogger', image: data.images ? data.images[0].url : null, contentHtml: data.content, isBlogger: true };
        }
      }
    } else if (slug) {
      post = await fetchJSON(`/posts/${slug}.json`);
    }

    if (!post) {
      const allPosts = await loadAllPosts();
      post = allPosts[0];
    }

    if (!post) {
      body.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-muted);">Post not found.</p>';
      return;
    }

    const img = post.isBlogger ? post.image : resolveImagePath(post.image);
    const meta = $('#readMeta');
    const titleEl = $('#readTitle');
    const catEl = $('#readCategory');
    const banner = $('#readBanner');

    if (titleEl) titleEl.textContent = post.title;
    if (catEl) catEl.textContent = post.category || 'Article';

    // Show only this post's category decor (poem blooms / essay sparkles / reflection pebbles).
    const decorCat = String(post.category || '').toLowerCase();
    if (['poem', 'essay', 'reflection'].includes(decorCat)) {
      document.body.dataset.decor = decorCat;
    }

    const rt = estimateReadingTime(post.contentHtml).mins;
    const date = new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (meta) meta.textContent = `${date} \u2022 ${rt} min read`;

    // Assigned motion form hero
    const coverArt = $('#readCoverArt');
    if (coverArt) {
      if (typeof window.getMotionFormSvg === 'function') {
        coverArt.innerHTML = window.getMotionFormSvg(post.slug || post.id || post.title);
        coverArt.style.display = 'block';
      } else {
        coverArt.style.display = 'none';
      }
    }

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
    structureProseSections(body);
    buildTOC();
    enhanceContentImages(body);
    initReaderDock();

    // Reading progress line
    window.addEventListener('scroll', () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        const progress = Math.min(1, Math.max(0, window.scrollY / scrollHeight));
        document.documentElement.style.setProperty('--progress', progress);
      }
    }, { passive: true });

    const fullTitle = `${post.title} \u2014 Nikit Hamal`;
    document.title = fullTitle;

    const postSlug = post.slug || slug || '';
    const postOgCard = postSlug ? `https://nikit.is-a.dev/assets/og/${postSlug}.png` : 'https://nikit.is-a.dev/assets/og-image.png';
    const postImage = img ? (img.startsWith('http') ? img : `https://nikit.is-a.dev/${img}`) : postOgCard;
    const excerpt = post.excerpt || (htmlToText(post.contentHtml).substring(0, 150) + '...');
    // The canonical + address-bar URL is always the pretty one for local posts,
    // so old-style read.html?slug= links (incl. fbclid variants) present cleanly.
    const postUrl = (!post.isBlogger && postSlug)
      ? `https://nikit.is-a.dev/writings/${postSlug}`
      : window.location.href;
    if (postUrl !== window.location.href) {
      try { window.history.replaceState(null, '', postUrl); } catch (e) {}
    }

    if ($('#og-title')) $('#og-title').setAttribute('content', fullTitle);
    if ($('#og-desc')) $('#og-desc').setAttribute('content', excerpt);
    if ($('#og-url')) $('#og-url').setAttribute('content', postUrl);
    if ($('#canonical-url')) $('#canonical-url').setAttribute('href', postUrl);
    if ($('#og-image')) $('#og-image').setAttribute('content', postImage);
    if ($('#twitter-title')) $('#twitter-title').setAttribute('content', fullTitle);
    if ($('#twitter-desc')) $('#twitter-desc').setAttribute('content', excerpt);
    if ($('#twitter-url')) $('#twitter-url').setAttribute('content', postUrl);
    if ($('#twitter-image')) $('#twitter-image').setAttribute('content', postImage);
  }

  // ============================================
  // READER DOCK & READING MODE
  // ============================================

  function initReaderDock() {
    const dock = $('#readerDock');
    if (!dock) return;

    const body = $('#readBody');
    if (!body) return;

    const prevBtn = $('#dockPrev');
    const nextBtn = $('#dockNext');
    const countEl = $('#dockCount');
    const focusBtn = $('#dockFocus');
    const settingsBtn = $('#dockSettings');
    const panel = $('#readSettingsPanel');
    const closeBtn = $('#closeSettings');
    const toast = $('#readToast');
    const root = document.documentElement;

    // Find readable sections/passages in body
    let passages = Array.from(body.querySelectorAll('.passage'));
    if (!passages.length) {
      passages = Array.from(body.querySelectorAll('p, h2, h3, blockquote, figure')).filter(el => {
        return el.textContent.trim().length > 15;
      });
    }

    if (!passages.length) {
      passages = [body];
    }

    const total = passages.length;
    let current = 0;
    let focus = false;
    let quietTimer = null;
    let toastTimer = null;
    let ticking = false;

    const storageKey = 'nikit-reader-settings-v3';
    const defaults = {
      font: root.getAttribute('data-font') || 'sans',
      size: 16,
      leading: 1.8,
      motion: !matchMedia('(prefers-reduced-motion: reduce)').matches
    };

    let settings = { ...defaults };
    try {
      let saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (!saved) {
        const v2 = JSON.parse(localStorage.getItem('nikit-reader-settings-v2') || 'null');
        if (v2 && typeof v2 === 'object') {
          saved = { ...v2 };
          if (saved.size === 20) saved.size = 16;
        }
      }
      if (saved && typeof saved === 'object') settings = { ...defaults, ...saved };
    } catch (e) {}

    function saveSettings() {
      try {
        localStorage.setItem(storageKey, JSON.stringify(settings));
      } catch (e) {}
    }

    function showToast(text) {
      if (!toast) return;
      clearTimeout(toastTimer);
      toast.textContent = text;
      toast.classList.add('shown');
      toastTimer = setTimeout(() => toast.classList.remove('shown'), 3200);
    }

    function applySettings() {
      root.setAttribute('data-font', settings.font);
      root.style.setProperty('--text-size', settings.size + 'px');
      root.style.setProperty('--leading', settings.leading);
      root.classList.toggle('motion-off', !settings.motion);

      if (body) {
        body.style.setProperty('--text-size', settings.size + 'px');
        body.style.setProperty('--leading', settings.leading);
      }

      const activePalette = root.getAttribute('data-palette') || 'default';
      $$('[data-set-palette]').forEach(b => {
        b.setAttribute('aria-pressed', String(b.dataset.setPalette === activePalette));
      });

      const sizeInput = $('#fontSizeRange');
      const sizeOutput = $('#fontSizeValue');
      if (sizeInput) sizeInput.value = settings.size;
      if (sizeOutput) sizeOutput.textContent = settings.size;

      const leadingInput = $('#lineHeightRange');
      const leadingOutput = $('#lineHeightValue');
      if (leadingInput) leadingInput.value = settings.leading;
      if (leadingOutput) leadingOutput.textContent = Number(settings.leading).toFixed(2);

      const motionInput = $('#motionToggle');
      if (motionInput) motionInput.checked = settings.motion;

      $$('[data-set-font]').forEach(b => {
        b.setAttribute('aria-pressed', String(b.dataset.setFont === settings.font));
      });
    }

    function update() {
      ticking = false;
      const target = window.innerHeight * 0.32;
      let best = 0;
      for (let i = 0; i < total; i++) {
        const top = passages[i].getBoundingClientRect().top;
        if (top <= target) {
          best = i;
        } else {
          break;
        }
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 6) {
        best = total - 1;
      }
      current = best;
      passages.forEach((p, i) => p.classList.toggle('is-current', i === current));

      if (countEl) {
        const label = `${String(current + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
        countEl.textContent = label;
        countEl.setAttribute('aria-label', `Section ${current + 1} of ${total}`);
      }

      if (prevBtn) prevBtn.disabled = current === 0;
      if (nextBtn) nextBtn.disabled = current === total - 1;
    }

    function requestTick() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    function goTo(index) {
      const i = Math.max(0, Math.min(total - 1, index));
      const target = passages[i];
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.22;
      window.scrollTo({ top, behavior: settings.motion ? 'smooth' : 'instant' });
      wake();
      if (focus) showToast(`Section ${i + 1} of ${total}`);
    }

    function wake() {
      dock.classList.remove('quiet');
      clearTimeout(quietTimer);
      quietTimer = setTimeout(() => {
        if (!panel || panel.hidden) {
          dock.classList.add('quiet');
        }
      }, 4200);
    }

    function toggleFocus() {
      focus = !focus;
      document.body.classList.toggle('focus-mode', focus);
      if (focusBtn) focusBtn.setAttribute('aria-pressed', String(focus));
      showToast(focus ? 'Focus on. Use arrows to move between sections.' : 'All sections restored.');
      wake();
      if (focus) goTo(current);
    }

    function openSettings() {
      if (!panel) return;
      panel.hidden = false;
      if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'true');
      wake();
    }

    function closeSettings() {
      if (!panel) return;
      panel.hidden = true;
      if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'false');
      wake();
    }

    if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1));
    if (focusBtn) focusBtn.addEventListener('click', toggleFocus);
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        if (panel && !panel.hidden) closeSettings();
        else openSettings();
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeSettings);

    document.addEventListener('pointerdown', (e) => {
      if (panel && !panel.hidden && !panel.contains(e.target) && !e.target.closest('#dockSettings')) {
        closeSettings();
      }
    });



    $$('[data-set-palette]').forEach(b => {
      b.addEventListener('click', () => {
        const pal = b.dataset.setPalette;
        applyPalette(pal);
        showToast(`${pal.charAt(0).toUpperCase() + pal.slice(1)} palette`);
      });
    });

    $$('[data-set-font]').forEach(b => {
      b.addEventListener('click', () => {
        settings.font = b.dataset.setFont;
        applySettings();
        saveSettings();
        showToast(settings.font === 'serif' ? 'Serif typeface' : 'Sans typeface');
      });
    });

    const sizeInput = $('#fontSizeRange');
    if (sizeInput) {
      sizeInput.addEventListener('input', (e) => {
        settings.size = Number(e.target.value);
        applySettings();
        saveSettings();
      });
    }

    const leadingInput = $('#lineHeightRange');
    if (leadingInput) {
      leadingInput.addEventListener('input', (e) => {
        settings.leading = Number(e.target.value);
        applySettings();
        saveSettings();
      });
    }

    const motionInput = $('#motionToggle');
    if (motionInput) {
      motionInput.addEventListener('change', (e) => {
        settings.motion = e.target.checked;
        applySettings();
        saveSettings();
      });
    }

    const resetBtn = $('#resetReadingSettings');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        settings = { ...defaults };
        applyPalette('default');
        applySettings();
        saveSettings();
        showToast('Reading settings restored.');
      });
    }

    document.addEventListener('keydown', (e) => {
      const tag = e.target.tagName;
      if (e.key === 'Escape') {
        if (panel && !panel.hidden) closeSettings();
        else if (focus) toggleFocus();
        return;
      }
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      if (panel && !panel.hidden) return;

      const key = e.key.toLowerCase();
      if (key === 'arrowright') {
        e.preventDefault();
        goTo(current + 1);
      } else if (key === 'arrowleft') {
        e.preventDefault();
        goTo(current - 1);
      } else if (key === 'f') {
        e.preventDefault();
        toggleFocus();
      } else if (key === 't') {
        e.preventDefault();
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
        localStorage.setItem('theme', nextTheme);
        showToast(nextTheme === 'dark' ? 'Dark mode' : 'Light mode');
      }
      wake();
    });

    window.addEventListener('scroll', () => {
      requestTick();
      wake();
    }, { passive: true });

    window.addEventListener('resize', requestTick, { passive: true });
    dock.addEventListener('pointerenter', wake);
    dock.addEventListener('focusin', wake);

    applySettings();
    update();
    wake();
  }

  // ============================================
  // SITE HEADER (sticky nav, contact shortcut, command palette)
  // ============================================

  function openContactSection() {
    const item = $('.accordion-item[data-accordion="contact"]');
    if (!item) {
      // No contact section on this view (e.g. /writings shares the same
      // header) — take the user home and open it there.
      location.href = '/#contact';
      return;
    }
    const btn = item.querySelector('.accordion-header');
    if (btn && !item.classList.contains('open')) btn.click();
    item.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function initSiteHeader() {
    const header = $('.site-header');
    if (header) {
      const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 8);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    const contactBtn = $('#navContact');
    if (contactBtn) contactBtn.addEventListener('click', openContactSection);
  }

  // ============================================
  // INIT
  // ============================================

  function init() {
    stripTrackingParams();
    initTheme();
    initSiteHeader();
    initAccordions();
    if (location.hash === '#contact') openContactSection();
    initModals();
    initWritingPreview();
    initWritingPage();
    initReadPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();