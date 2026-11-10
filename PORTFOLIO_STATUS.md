# Portfolio overhaul: status

Branch: `portfolio/scriptorium` (never pushed to `main`, per owner request).

## Concept
"The Scriptorium": a calm, illuminated-manuscript homepage with pixel art used only where it matters.
- Paper, ink, vermilion and gold. Fraunces (display), Geist (text), Geist Mono and Pixelify Sans (labels), Tiro Devanagari (mantras).
- One arched "window" with a live, procedurally rendered Himalayan scene (dithered sky, parallax ranges, stupa, prayer flags, meditating seeker).
- Time of day (dawn, day, dusk, night) drives the scene and the colour of the entire page. Defaults to the visitor's local time.
- Pixel mandala that dissolves and re-forms (impermanence), four tiny animated project plates, a lake footer where you light butter lamps.
- Hand-drawn arrow icons with a swap-on-hover motion.

## Files (all new, under `site/`, plus the root `index.html`)
- `site/site.css`: design system and layout
- `site/pixel.js`: tiny software rasteriser, palette helpers, Bayer dither
- `site/scene.js`: hero arch scene, the day cycle
- `site/art.js`: mandala, project plates, footer lake
- `site/main.js`: nav, phase switch, reveals, essays list, mantra cycler, clipboard
- `index.html`: markup

Other pages (`writings/`, `chat/`, `hanomi/`, `nik/`, ...) are untouched.

## Progress
- [x] Plan, repo recon
- [ ] Core build and first push
- [ ] Visual QA at 1440x900 and 390x844, fixes
- [ ] Final polish push

## Notes
- No build step: static HTML/CSS/JS for GitHub Pages.
- Never commit the GitHub PAT. Owner should rotate it.
