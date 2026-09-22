/**
 * DYNAMIC CARD VISUALS - Nikit Hamal
 * Pure code-generated minimalist SVG illustrations for writing cards.
 * Generates custom, high-contrast, category-themed vector art with
 * cute elements (connected full flower blossoms, geometric forms, zen ripples, sparkle stars).
 */

(function () {
  'use strict';

  // Helper: Create Plump Connected Flower Blossom (No stems, full connected petals)
  function createFlowerBlossom(cx, cy, r, petals = 5, rot = 0) {
    let d = '';
    for (let i = 0; i < petals; i++) {
      const a1 = rot + (i * 2 * Math.PI) / petals;
      const a2 = rot + ((i + 1) * 2 * Math.PI) / petals;
      const mid = rot + ((i + 0.5) * 2 * Math.PI) / petals;
      const bx1 = cx + Math.cos(a1) * (r * 0.22);
      const by1 = cy + Math.sin(a1) * (r * 0.22);
      const tx = cx + Math.cos(mid) * r;
      const ty = cy + Math.sin(mid) * r;
      const bx2 = cx + Math.cos(a2) * (r * 0.22);
      const by2 = cy + Math.sin(a2) * (r * 0.22);
      const cp1x = cx + Math.cos(mid - 0.26) * (r * 1.15);
      const cp1y = cy + Math.sin(mid - 0.26) * (r * 1.15);
      const cp2x = cx + Math.cos(mid + 0.26) * (r * 1.15);
      const cp2y = cy + Math.sin(mid + 0.26) * (r * 1.15);
      if (i === 0) d += `M ${bx1.toFixed(1)} ${by1.toFixed(1)} `;
      d += `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${tx.toFixed(1)} ${ty.toFixed(1)} `;
      d += `C ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${bx2.toFixed(1)} ${by2.toFixed(1)} `;
    }
    d += 'Z';
    const centerR = Math.max(2.5, (r * 0.22).toFixed(1));
    const innerRingR = Math.max(4, (r * 0.38).toFixed(1));

    return `
      <g class="flower-blossom">
        <path d="${d}" class="flower-petal" />
        <circle cx="${cx}" cy="${cy}" r="${innerRingR}" class="flower-inner-ring" fill="none" stroke-dasharray="1.5 2" />
        <circle cx="${cx}" cy="${cy}" r="${centerR}" class="flower-center" />
      </g>
    `;
  }

  // Helper: Cute 4-Point Sparkle Star
  function createSparkle(cx, cy, r) {
    const ir = r * 0.22;
    const d = `M ${cx} ${cy - r} Q ${cx} ${cy - ir} ${cx + ir} ${cy} Q ${cx} ${cy + ir} ${cx} ${cy + r} Q ${cx} ${cy + ir} ${cx - ir} ${cy} Q ${cx} ${cy - ir} ${cx} ${cy - r} Z`;
    return `<path d="${d}" class="sparkle-star" />`;
  }

  // Helper: Hash function for deterministic variety
  function hashSlug(slug = '') {
    let hash = 2166136261;
    for (let i = 0; i < slug.length; i++) {
      hash ^= slug.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash);
  }

  // POEM ART GENERATORS (Cute connected full flower blossoms & floral bouquets)
  const POEM_TEMPLATES = [
    // 1. Triple Connected Cherry Blossom Bouquet with Floating Mini Flowers
    (w, h) => `
      <g class="art-graphic art-poem">
        ${createFlowerBlossom(w * 0.58, h * 0.48, 38, 5, 0.2)}
        ${createFlowerBlossom(w * 0.36, h * 0.62, 26, 5, 0.7)}
        ${createFlowerBlossom(w * 0.74, h * 0.68, 22, 6, 0.4)}
        ${createFlowerBlossom(w * 0.38, h * 0.32, 16, 5, 1.1)}
        ${createFlowerBlossom(w * 0.78, h * 0.30, 14, 5, 0.5)}
        ${createSparkle(w * 0.22, h * 0.42, 6)}
        ${createSparkle(w * 0.65, h * 0.18, 5)}
        ${createSparkle(w * 0.88, h * 0.55, 4.5)}
        <circle cx="${w * 0.25}" cy="${h * 0.72}" r="2" class="cute-dot" />
        <circle cx="${w * 0.52}" cy="${h * 0.82}" r="2" class="cute-dot" />
      </g>
    `,

    // 2. Floral Mandala: 6-Petal Connected Jasmine Center with Orbiting Blossoms
    (w, h) => `
      <g class="art-graphic art-poem">
        <circle cx="${w * 0.54}" cy="${h * 0.5}" r="52" fill="none" stroke-dasharray="2 4" class="orbit-guide" />
        ${createFlowerBlossom(w * 0.54, h * 0.5, 34, 6, 0.1)}
        ${createFlowerBlossom(w * 0.54 + 52 * Math.cos(0.4), h * 0.5 + 52 * Math.sin(0.4), 16, 5, 0.2)}
        ${createFlowerBlossom(w * 0.54 + 52 * Math.cos(2.2), h * 0.5 + 52 * Math.sin(2.2), 15, 5, 0.9)}
        ${createFlowerBlossom(w * 0.54 + 52 * Math.cos(4.1), h * 0.5 + 52 * Math.sin(4.1), 16, 5, 1.4)}
        ${createSparkle(w * 0.28, h * 0.30, 6)}
        ${createSparkle(w * 0.80, h * 0.72, 6)}
        ${createSparkle(w * 0.76, h * 0.25, 4)}
      </g>
    `,

    // 3. Gentle Floral Constellation: 8-Petal Daisy and Connected Baby Blossoms
    (w, h) => `
      <g class="art-graphic art-poem">
        <path d="M ${w * 0.25} ${h * 0.65} Q ${w * 0.5} ${h * 0.25} ${w * 0.82} ${h * 0.45}" fill="none" stroke-dasharray="2 4" class="orbit-guide" />
        ${createFlowerBlossom(w * 0.48, h * 0.42, 36, 8, 0.3)}
        ${createFlowerBlossom(w * 0.28, h * 0.60, 24, 6, 0.8)}
        ${createFlowerBlossom(w * 0.75, h * 0.48, 22, 5, 0.5)}
        ${createFlowerBlossom(w * 0.62, h * 0.75, 15, 5, 1.2)}
        ${createSparkle(w * 0.35, h * 0.22, 5.5)}
        ${createSparkle(w * 0.84, h * 0.28, 5)}
        <circle cx="${w * 0.20}" cy="${h * 0.40}" r="2" class="cute-dot" />
        <circle cx="${w * 0.68}" cy="${h * 0.22}" r="2" class="cute-dot" />
      </g>
    `
  ];

  // ESSAY ART GENERATORS (Minimalist Geometric & Generative Vector Forms)
  const ESSAY_TEMPLATES = [
    // 1. Concentric Resonance Orbits with Coordinate Crosshairs
    (w, h) => {
      const cx = w * 0.55, cy = h * 0.5;
      return `
        <g class="art-graphic art-essay">
          <line x1="${cx - 65}" y1="${cy}" x2="${cx + 65}" y2="${cy}" class="geo-axis" />
          <line x1="${cx}" y1="${cy - 55}" x2="${cx}" y2="${cy + 55}" class="geo-axis" />
          <circle cx="${cx}" cy="${cy}" r="54" class="geo-ring-subtle" stroke-dasharray="2 4" />
          <circle cx="${cx}" cy="${cy}" r="42" class="geo-ring" />
          <circle cx="${cx}" cy="${cy}" r="30" class="geo-ring" />
          <circle cx="${cx}" cy="${cy}" r="18" class="geo-ring-bold" />
          <circle cx="${cx}" cy="${cy}" r="4" class="geo-node" />
          <circle cx="${cx + 42 * Math.cos(0.7)}" cy="${cy + 42 * Math.sin(0.7)}" r="3" class="geo-node" />
          <circle cx="${cx + 30 * Math.cos(2.8)}" cy="${cy + 30 * Math.sin(2.8)}" r="2.5" class="geo-node" />
          ${createSparkle(w * 0.24, h * 0.32, 6)}
          ${createSparkle(w * 0.82, h * 0.68, 5)}
        </g>
      `;
    },

    // 2. Nested Harmonic Astroid Star & Solar Halo
    (w, h) => {
      const cx = w * 0.54, cy = h * 0.5;
      return `
        <g class="art-graphic art-essay">
          <circle cx="${cx}" cy="${cy}" r="50" class="geo-ring-subtle" stroke-dasharray="1 5" />
          <circle cx="${cx}" cy="${cy}" r="38" class="geo-ring" />
          <path d="M ${cx} ${cy - 46} Q ${cx} ${cy} ${cx + 46} ${cy} Q ${cx} ${cy} ${cx} ${cy + 46} Q ${cx} ${cy} ${cx - 46} ${cy} Q ${cx} ${cy} ${cx} ${cy - 46} Z" class="geo-shape" />
          <path d="M ${cx} ${cy - 30} Q ${cx} ${cy} ${cx + 30} ${cy} Q ${cx} ${cy} ${cx} ${cy + 30} Q ${cx} ${cy} ${cx - 30} ${cy} Q ${cx} ${cy} ${cx} ${cy - 30} Z" class="geo-shape-bold" />
          <circle cx="${cx}" cy="${cy}" r="3.5" class="geo-node" />
          ${createSparkle(w * 0.22, h * 0.28, 5.5)}
          ${createSparkle(w * 0.84, h * 0.35, 5)}
          ${createSparkle(w * 0.78, h * 0.74, 4)}
        </g>
      `;
    },

    // 3. Wave Interference & Ribbon Oscillation
    (w, h) => {
      const cx = w * 0.52, cy = h * 0.5;
      let waves = '';
      for (let i = -3; i <= 3; i++) {
        const offset = i * 7;
        const opacity = (1 - Math.abs(i) * 0.22).toFixed(2);
        waves += `<path d="M ${cx - 65} ${cy + offset} C ${cx - 25} ${cy + offset - 26}, ${cx + 25} ${cy + offset + 26}, ${cx + 65} ${cy + offset}" class="geo-wave" opacity="${opacity}" />`;
      }
      return `
        <g class="art-graphic art-essay">
          <circle cx="${cx}" cy="${cy}" r="50" class="geo-ring-subtle" stroke-dasharray="2 4" />
          ${waves}
          <circle cx="${cx}" cy="${cy}" r="4" class="geo-node" />
          ${createSparkle(w * 0.22, h * 0.68, 5.5)}
          ${createSparkle(w * 0.82, h * 0.26, 5)}
        </g>
      `;
    },

    // 4. Sacred Geometric Hexagon / Matrix Web
    (w, h) => {
      const cx = w * 0.54, cy = h * 0.5;
      const r = 44;
      let hex = '';
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        hex += (i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)} ` : `L ${x.toFixed(1)} ${y.toFixed(1)} `);
      }
      hex += 'Z';
      return `
        <g class="art-graphic art-essay">
          <circle cx="${cx}" cy="${cy}" r="52" class="geo-ring-subtle" stroke-dasharray="2 3" />
          <path d="${hex}" class="geo-shape" />
          <path d="${hex}" class="geo-shape" transform="rotate(30 ${cx} ${cy})" stroke-dasharray="3 3" opacity="0.6" />
          <circle cx="${cx}" cy="${cy}" r="22" class="geo-ring-bold" />
          <circle cx="${cx}" cy="${cy}" r="4" class="geo-node" />
          ${createSparkle(w * 0.24, h * 0.25, 6)}
          ${createSparkle(w * 0.82, h * 0.70, 5)}
        </g>
      `;
    },

    // 5. Lissajous Torus Knot
    (w, h) => {
      const cx = w * 0.54, cy = h * 0.5;
      let d = '';
      for (let t = 0; t <= 120; t++) {
        const angle = (t / 120) * Math.PI * 2;
        const x = cx + Math.sin(3 * angle) * 44;
        const y = cy + Math.sin(4 * angle) * 38;
        d += (t === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)} ` : `L ${x.toFixed(1)} ${y.toFixed(1)} `);
      }
      return `
        <g class="art-graphic art-essay">
          <circle cx="${cx}" cy="${cy}" r="50" class="geo-ring-subtle" stroke-dasharray="1 5" />
          <path d="${d}" class="geo-shape-bold" fill="none" />
          <circle cx="${cx}" cy="${cy}" r="3.5" class="geo-node" />
          ${createSparkle(w * 0.22, h * 0.35, 5)}
          ${createSparkle(w * 0.84, h * 0.65, 5.5)}
        </g>
      `;
    }
  ];

  // REFLECTION ART GENERATORS (Zen ripples, moon crescents, celestial auroras)
  const REFLECTION_TEMPLATES = [
    // 1. Concentric Water Ripples with Floating Droplet
    (w, h) => {
      const cx = w * 0.54, cy = h * 0.52;
      return `
        <g class="art-graphic art-reflection">
          <ellipse cx="${cx}" cy="${cy}" rx="58" ry="24" class="zen-ripple" stroke-dasharray="2 4" />
          <ellipse cx="${cx}" cy="${cy}" rx="46" ry="19" class="zen-ripple" />
          <ellipse cx="${cx}" cy="${cy}" rx="34" ry="14" class="zen-ripple-bold" />
          <ellipse cx="${cx}" cy="${cy}" rx="22" ry="9" class="zen-ripple" />
          <circle cx="${cx}" cy="${cy - 20}" r="3.5" class="zen-drop" />
          <path d="M ${cx} ${cy - 26} Q ${cx - 3.5} ${cy - 19} ${cx} ${cy - 16} Q ${cx + 3.5} ${cy - 19} ${cx} ${cy - 26} Z" class="zen-drop-shape" />
          ${createSparkle(w * 0.24, h * 0.28, 6)}
          ${createSparkle(w * 0.80, h * 0.68, 5)}
        </g>
      `;
    },

    // 2. Crescent Moon Cradle & Floating Stars
    (w, h) => {
      const cx = w * 0.54, cy = h * 0.5;
      return `
        <g class="art-graphic art-reflection">
          <circle cx="${cx}" cy="${cy}" r="48" class="zen-aura" stroke-dasharray="2 4" />
          <!-- Elegant Crescent Moon -->
          <path d="M ${cx - 10} ${cy - 38} A 40 40 0 1 0 ${cx + 28} ${cy + 22} A 32 32 0 1 1 ${cx - 10} ${cy - 38} Z" class="zen-moon" />
          ${createSparkle(cx + 8, cy - 12, 6.5)}
          ${createSparkle(cx - 22, cy + 24, 4.5)}
          ${createSparkle(w * 0.24, h * 0.40, 5)}
          ${createSparkle(w * 0.84, h * 0.32, 5.5)}
          <circle cx="${w * 0.78}" cy="${h * 0.68}" r="2" class="zen-dot" />
        </g>
      `;
    },

    // 3. Meditative Aura Rings with Glowing Center Pearl
    (w, h) => {
      const cx = w * 0.54, cy = h * 0.5;
      return `
        <g class="art-graphic art-reflection">
          <circle cx="${cx}" cy="${cy}" r="52" class="zen-aura" stroke-dasharray="1 5" />
          <circle cx="${cx}" cy="${cy}" r="42" class="zen-ring" />
          <circle cx="${cx}" cy="${cy}" r="32" class="zen-ring-bold" />
          <circle cx="${cx}" cy="${cy}" r="22" class="zen-ring" />
          <circle cx="${cx}" cy="${cy}" r="12" class="zen-ring-bold" />
          <circle cx="${cx}" cy="${cy}" r="4" class="zen-pearl" />
          ${createSparkle(w * 0.24, h * 0.24, 6)}
          ${createSparkle(w * 0.82, h * 0.75, 5)}
        </g>
      `;
    },

    // 4. Möbius Infinity Horizon Ribbon
    (w, h) => {
      const cx = w * 0.54, cy = h * 0.5;
      const d = `M ${cx - 48} ${cy} C ${cx - 48} ${cy - 30}, ${cx - 8} ${cy - 30}, ${cx} ${cy} C ${cx + 8} ${cy + 30}, ${cx + 48} ${cy + 30}, ${cx + 48} ${cy} C ${cx + 48} ${cy - 30}, ${cx + 8} ${cy - 30}, ${cx} ${cy} C ${cx - 8} ${cy + 30}, ${cx - 48} ${cy + 30}, ${cx - 48} ${cy} Z`;
      return `
        <g class="art-graphic art-reflection">
          <circle cx="${cx}" cy="${cy}" r="52" class="zen-aura" stroke-dasharray="2 4" />
          <path d="${d}" class="zen-mobius" fill="none" />
          <circle cx="${cx - 28}" cy="${cy}" r="3" class="zen-pearl" />
          <circle cx="${cx + 28}" cy="${cy}" r="3" class="zen-pearl" />
          ${createSparkle(w * 0.22, h * 0.32, 5.5)}
          ${createSparkle(w * 0.84, h * 0.65, 5)}
        </g>
      `;
    }
  ];

  /**
   * Main Render Function: Generates the dynamic code-based SVG thumbnail.
   * @param {Object} post - The post object containing slug, category, title.
   * @param {boolean} isMini - True for home page mini item, false for full writing card.
   */
  window.renderDynamicCardThumb = function (post, isMini = false) {
    const rawCat = (post.category || 'Essay').toLowerCase();
    const slug = (post.slug || post.id || '').toLowerCase();
    const hash = hashSlug(slug);

    let catType = 'essay';
    let catLabel = 'ESSAY';
    if (rawCat.includes('poem')) {
      catType = 'poem';
      catLabel = 'POEM';
    } else if (rawCat.includes('reflection')) {
      catType = 'reflection';
      catLabel = 'REFLECTION';
    }

    const w = isMini ? 120 : 240;
    const h = isMini ? 80 : 150;

    let artContent = '';
    if (catType === 'poem') {
      const idx = hash % POEM_TEMPLATES.length;
      artContent = POEM_TEMPLATES[idx](w, h);
    } else if (catType === 'reflection') {
      const idx = hash % REFLECTION_TEMPLATES.length;
      artContent = REFLECTION_TEMPLATES[idx](w, h);
    } else {
      // For flagship post "The lie of being yourself", use the signature whirlwind
      if (slug.includes('the-lie-of-being-yourself') || slug.includes('being-yourself')) {
        artContent = ESSAY_TEMPLATES[0](w, h);
      } else {
        const idx = hash % ESSAY_TEMPLATES.length;
        artContent = ESSAY_TEMPLATES[idx](w, h);
      }
    }

    // Hairline inner border & corner marks
    const inset = isMini ? 5 : 8;
    const innerW = w - inset * 2;
    const innerH = h - inset * 2;

    const cornerMarks = isMini ? '' : `
      <g class="card-art-crosshairs">
        <path d="M ${inset + 6} ${inset + 4} v 6 m -3 -3 h 6" />
        <path d="M ${w - inset - 6} ${inset + 4} v 6 m -3 -3 h 6" />
        <path d="M ${inset + 6} ${h - inset - 4} v 6 m -3 -3 h 6" />
        <path d="M ${w - inset - 6} ${h - inset - 4} v 6 m -3 -3 h 6" />
      </g>
    `;

    // Funky Little Avatar Peeking from the Border at the Bottom-Left Corner
    const avatarSize = isMini ? 26 : 38;
    const avatarX = inset + 2;
    const avatarY = h - avatarSize - inset + 3;

    const peepAvatar = `
      <g class="card-art-avatar">
        <image href="assets/avatar-tilt.svg" x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" preserveAspectRatio="xMidYMid meet" opacity="0.95" />
      </g>
    `;

    const tagBadge = isMini ? '' : (() => {
      const label = catLabel || 'ESSAY';
      const bw = Math.max(46, Math.min(92, label.length * 6 + 16));
      const bh = 18;
      const bx = inset + 10;
      const by = inset + 10;
      const tx = bx + bw / 2;
      const ty = by + bh / 2 + 0.5;
      return `
      <g class="card-art-tag">
        <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${bh / 2}" class="card-art-tag-bg" />
        <text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central" class="card-art-tag-text">${label}</text>
      </g>`;
    })();

    return `
      <svg class="dynamic-card-thumb dynamic-card-thumb--${catType}" viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <rect width="100%" height="100%" class="card-art-bg" />
        <rect x="${inset}" y="${inset}" width="${innerW}" height="${innerH}" rx="6" class="card-art-border" fill="none" />
        ${cornerMarks}
        ${tagBadge}
        ${artContent}
        ${peepAvatar}
      </svg>
    `;
  };
})();
