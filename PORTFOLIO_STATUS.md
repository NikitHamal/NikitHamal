# Nikit Hamal — Portfolio Overhaul Status (`PORTFOLIO_STATUS.md`)

## Vision & Concept: **“The Living Palm-Leaf & Pixel Sanctuary” (Śūnyatā & Craft)**
An original, museum-grade, non-laggy, deeply philosophical and artistic 2D pixel-art editorial portfolio for **Nikit Hamal** — Android & Full-Stack Engineer, Head of Operations at Consica Labs, creator of the sub-10MB browser LLM **Nik 0.1**, and writer of essays on Advaita / non-duality and self-observation from Nepal.

### Why This Overhaul
- **Problem with the previous full-page game**: Turning the entire site into a sprawling 2D game or hiding everything inside cramped accordions overwhelmed visitors and obscured the engineering and writing.
- **The Solution**: Ultra-clean editorial typography, generous breathing room, razor-sharp custom directional arrow iconography (`↗`, `→`, `↓` with diagonal hover slide), tactile manuscript hairlines, and **curated, jewel-box 2D pixel-art interactive canvases** that run at a silky 60fps with zero lag and automatic off-screen pause.

---

## Architectural & Creative Pillars

### 1. Typography & Iconography
- **Display & Philosophical Voice**: `Instrument Serif` + `Fraunces` (optical size, editorial italics) paired with subtle Devanagari philosophical epigraphs (`Tiro Devanagari Sanskrit`).
- **Interface & Prose**: `Plus Jakarta Sans` for effortless, crisp legibility.
- **Systems, Metrics & Interactive Consoles**: `JetBrains Mono` with tabular numerals.
- **Custom Vector Iconography**: Single-weight (`1.5px`) geometric SVG directional arrows (`↗`, `→`, `↓`, `↵`) with dual-ghost diagonal hover micro-animations (`translate(3px, -3px)`), custom pixel-grid badges, and bespoke architectural corner marks.

### 2. Four Atmospheric Themes (Time-of-Day + Manual Cycling)
- **Prabhāta (Dawn Paper)** — Warm Himalayan lokta parchment (`#F7F3EB`), vermilion seal accents (`#C84B31`), deep sumi ink (`#161513`).
- **Madhyāhna (Daylight Alabaster)** — Crisp editorial alabaster (`#FAF9F6`), bronze ochre (`#9A5B25`), forest pine (`#2A5C43`).
- **Sandhyā (Temple Dusk)** — Warm twilight obsidian-amber (`#171311`), butter-lamp gold (`#E5A94C`), terracotta ember (`#D96B43`).
- **Rātri (Starlit Night)** — Deep Himalayan night (`#0D0F14`), moonlit cyan-silver (`#7AA2F7`), sacred saffron (`#E09F3E`).

### 3. Curated, Silky-Smooth 2D Pixel-Art Dioramas & Micro-Experiences
1. **Hero Diorama — The Himalayan Courtyard & Astrolabe Window (`js/sanctuary-hero.js`)**:
   - Crisp integer-scaled (`image-rendering: pixelated`) 2D pixel-art diorama framed like an architectural temple window overlooking Machapuchare (Fishtail peak).
   - Features drifting mountain mist, swaying prayer flags, a flickering stone butter-lamp (*diyā*) you can click to light/bless, Nikit at his low wooden desk with a glowing terminal, and his interactive pixel Rottweiler companion sleeping/waking beside him.
   - Responds to the 4 atmospheric phases (Dawn, Day, Dusk, Night), cursor parallax, and click-to-cast fireflies/blossoms.
2. **Living Pixel Chronicle — 52-Week Sacred Garden of Craft (`js/sanctuary-app.js`)**:
   - Inspired by clean botanical contribution gardens: each day of engineering & writing blooms as a tiny 2D pixel sprout, lotus, pine, or golden lamp on a clean horizontal scroll canvas with instant day inspection.
3. **Then & Now — Interactive Portrait Comparison & Live-Eye Gallery (`js/painted.js` + Scrub Slider)**:
   - Interactive drag-to-compare Childhood (`kid`) vs Present (`now`) painted pixel/illustrated portrait slider, plus the full 6-stage life portrait strip (`now`, `curls`, `young`, `teen`, `kid`, `baby`) with live blinking/gaze-tracking eyes.
4. **Selected Works — Deep Architectural Case Studies + Live In-Card Nik 0.1 Console**:
   - **NEBians** (Kotlin, Jetpack Compose, Django — study materials, past papers & forum in one home, with custom crisp pixel-art device frame & interactive screen switcher).
   - **Nik 0.1** (Under-10MB Romanized-Nepali hybrid AR + diffusion transformer in WASM-SIMD — includes an interactive in-card mini prompt playground + direct link to `/chat`).
   - **Lami Nepal** (Flutter, Firebase, Pusher — matrimonial & spiritual platform with real-time chat & Nepali localization, with interactive pixel-art chat/kundali preview).
   - **AstroWeb** (SvelteKit, TypeScript — Vedic ephemeris, Kundali & Dasha engine with interactive live Nakshatra/planetary wheel).
5. **The Lineage ("One Question Led to the Next")**:
   - Numbered narrative timeline tracing how Nikit's path evolved from early Android experiments to NEBians, Lami Nepal, AstroWeb, Nik 0.1, and non-dual philosophical inquiry.
6. **The Sūtra Index & Slide-Over Manuscript Reader (`/writings` + Live Drawer)**:
   - Pulls all 27 real essays, reflections, and poems from `/posts/summary.json` and `/posts/<slug>.json`.
   - Category filtering (`All`, `Essays`, `Reflections`, `Poems`), instant search (`/`), hover thumbnail preview, and an **in-page Slide-Over Manuscript Reader Drawer** so visitors can read full essays immediately without losing scroll position, or open the dedicated `/writings/<slug>` page.
7. **Interactive Temple Reflection Pond & Hanomi Portal**:
   - Refined, lightweight, zero-lag footer reflection pond where visitors can release floating butter lamps (*diyās*) or feed koi, plus direct portal to the full 2D pixel village game (`hanomi/`).

---

## Milestone Checklist
- [x] **M1**: Workspace bootstrap, inspect git log & branches, create `PORTFOLIO_STATUS.md`, initial commit & push.
- [x] **M2**: Build master editorial + ancient philosophical stylesheet (`css/sanctuary.css`) with 4 atmospheric themes, custom arrow micro-interactions, and responsive grid.
- [x] **M3**: Build 60fps 2D pixel-art Himalayan Courtyard diorama, pixel botanical contribution garden, project device illustrations, and reflection pond (`js/sanctuary-canvas.js`).
- [x] **M4**: Build interactive application logic (`js/sanctuary-app.js`): live Nepal clock, 4-phase switcher, Childhood-vs-Present portrait drag slider, in-card Nik 0.1 live tester, essay filter & slide-over manuscript reader, and Web Audio singing-bowl chime.
- [x] **M5**: Assemble the overhauled `index.html` integrating all sections, SEO schema, painted portraits, and subpage links (`/writings`, `/chat`, `hanomi/`).
- [x] **M6**: Commit & push core overhaul, run headless Chromium visual QA (`1440x900` desktop & `390x844` mobile), inspect via native `Read`, polish SVG eyes on Drag-to-Compare portraits & Nik 0.1 pixel attention visualizer, clean up `shots/`, and push final commit.
