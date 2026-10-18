# Portfolio reel: "Nikit Hamal" (29 s, landscape + vertical)

A motion-graphics reel about the person behind nikit.is-a.dev, made entirely in code from the main site. Nothing in it comes from `/preview` except the painted portrait and its live eyes.

- **Outputs:**
  - `out/reel.mp4`: 1920×1080
  - `out/reel_vertical.mp4`: 1080×1920, a hand-laid-out portrait cut, not a crop
  - `out/soundtrack.wav`
  - `out/poster.jpg`
  - `out/contact_sheet.png`
- **Spec:** 60 fps, 1740 frames, 120 BPM (beat = 30 f, bar = 120 f), BT.709 colour tags, AAC 48 kHz, loudness −14 LUFS, true peak ≤ −1.5 dBTP.
- **Device:** the site's `> ` prompt. Each act is typed in as a homepage section header.
- **Engine:** `../shared/lib.js`. See `../shared/README.md`.

## Acts (frames @ 60 fps)
| frames | act |
|---|---|
| 0–240 | `> hi, i'm nikit` is typed. The homepage avatar (head and shoulders) pops in, its eyes follow the caret and blink. It opens into the full painting, the name lands, and he winks. |
| 240–660 | The real apps, redrawn from their actual screens (Play Store screenshots and the live sites):<br>• **NEBians**: Digital Library → tap → Resource page.<br>• **Lami Nepal**: "Namaste, Nikit!" home with the date strip hopping → tap Matches.<br>• **AstroWeb**: the phone morphs into a browser showing the light Cinzel dashboard → tap Kundali → North-Indian chart drawing itself, with the planetary positions table. |
| 660–780 | the window collapses; 14 stack icons burst into a grid |
| 780–900 | Consica Labs, Head of Operations: the checklist ticks off and the quarter bar fills |
| 900–1260 | the essays: "Be yourself." struck out → "*Which self are you talking about?*" → titles scroll to "Where is God?" → three couplets ("God is neither in, *nor out.*" …), each arriving word by word out of a blur and clearing before the next |
| 1260–1380 | `> POND`: the homepage koi pond (real footage of `js/pond.js`), revealed through a widening circle, with food landing |
| 1380–1500 | montage on 8ths: 8 earlier moments, ending on a close-up wink |
| 1500–1740 | the homepage header rebuilt. The real `<pixel-dog>` (rottie) sleeps by the name in the site's sploot, with its tongue blep and the site's "z"s; it is startled awake, sits up wagging, then a last wink and `nikit.is-a.dev`. |

The AstroWeb chart is a sample chart, not anyone's real birth data. The app text was copied from the real screens: NEBians resources, Lami's "Client ID" cards and Tulasi Guru card.

## Files
- **`film.js`**, the film. `?v=portrait` switches to the portrait layout.
  - `T` holds the cues.
  - `LY` holds the per-orientation layout, including the montage picks.
  - The app screens are `screenNEB`, `screenLami`, `screenAstro` and `chartPage`, drawn at a logical 412×860 phone size.
- **`score.py`**, the soundtrack. Its `T` mirrors `film.js`.
- **`build.sh`** serves the repo, scores and masters the audio, renders both orientations, then muxes and checks.
- **`tools/render.js from to outdir url`** renders a frame range.
- **`tools/stills.js outdir url f…`** renders single frames for review.
- **`assets/`** holds the app logos, devicons (MIT) and sakura petals. Everything else comes from `../shared` or the site itself: `js/pixel-dog.js` and `js/pond.js` (via the recorded clips).
