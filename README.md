# Nikit Hamal — Portfolio & Writing

Static portfolio and essays site, live at <https://nikit.is-a.dev/> (GitHub Pages, custom domain via `CNAME`). Plain HTML/CSS/JS — no build step, no dependencies.

## Pages

- `/` (`index.html`) — profile header, accordion sections (about, skills, projects, writing preview, contact), sticky site header, light/dark toggle.
- `/writings` (`writing.html` + generated `writings/index.html`) — essays listing with live search (`/` to focus), category chips (All / Essays / Reflections / Poems with counts), and numbered pagination (6 per page).
- `/writings/<slug>` (`read.html` + generated `writings/<slug>/index.html`) — reader view with per-category decor and baked OG/meta tags.
- Old URLs keep working: `/writing.html`, `/read.html?slug=…`, `/<slug>.html`. Canonicals and `og:url` point at the pretty versions.

## Content: posts

- `posts/index.json` — the slug list (source of truth for listing order and page generation).
- `posts/<slug>.json` — title, excerpt, `category` (`essay` | `reflection` | `poem`), date, read time, `contentHtml`.
- Category drives the card art, the reader-page decor group, and the filter chips.

To add or edit a post: update the JSON, then regenerate (below).

## Theming & decor

- The `*` toggle flips `data-theme` light/dark; palettes (`data-palette`: default / sepia / slate) recolor the whole site.
- Decor ink and bloom accents (`--decor-ink`, `--bloom-fill/stroke/core` in `css/styles.css`) are tuned per theme so the fixed micro-motifs (sparkle, plus, bloom, pebble, ripple, ring, moon, diamond, tri-dots, wave) hold even contrast in every mode.
- Read pages show only the current post's category decor group.

## Social / OG cards

- `assets/og/<slug>.png` (1200x630) per post, `assets/og-image.png` as the home/writings fallback. Card thumbnails on the site reuse the same PNGs.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000/ and http://localhost:8000/writings
```

## Generators (local-only, gitignored under `tools/`)

```bash
node tools/build_pretty_urls.js       # rebuild writings/, per-post meta/OG/canonical, sitemap.xml
node tools/generate_post_og_cards.js  # rebuild the 1200x630 OG PNGs (motifs from cute_elements.js)
```

Re-run the pretty-URL builder after adding, removing, or editing posts.

## Repo map

```text
index.html / writing.html / read.html   page shells (sources for generated pages)
writings/                               generated pretty URLs (do not hand-edit)
posts/                                  post JSON + index.json
assets/og/                              per-post OG cards + og-image.png fallback
css/  js/                               styles, app logic, card visuals, motion forms
tools/                                  local generators (gitignored, not deployed)
sitemap.xml  robots.txt  CNAME          SEO + domain (keep committed)
google88efa99d76dbf62a.html            Google Search Console verification (keep committed)
the-lie-of-being-yourself.html         legacy per-post page (keep for old links)
```

## Deployment

Push to `main` and GitHub Pages serves it. Nothing to build.

## Contact

- Email: iamnikithamal@gmail.com
- LinkedIn: <https://www.linkedin.com/in/nikithamal>
- X: <https://twitter.com/nikithamal>
- GitHub: <https://github.com/NikitHamal>
