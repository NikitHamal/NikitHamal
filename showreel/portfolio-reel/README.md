# Portfolio reel: "Nikit Hamal" (25 s)

A motion-graphics reel about the person behind nikit.is-a.dev, made entirely in code. Nothing in it comes from `/preview` except the painted portrait and its live eyes.

- **Spec:** 1920×1080, 60 fps, 1500 frames, 120 BPM (beat = 30 f, bar = 120 f), BT.709 colour tags, AAC 48 kHz, loudness −14 LUFS, true peak ≤ −1.5 dBTP.
- **Final output:** `out/reel.mp4`. Also in `out/`: `soundtrack.wav`, `poster.jpg`, and `contact_sheet.png` (15 key frames).
- **Device:** the site's own `> ` prompt. Every act is typed in as one of the homepage section headers: `> SIDE PROJECTS & WORK`, `> SKILLS & EXPERIENCE`, `> OPERATIONS`, `> ESSAYS & WRITING`.
- **Brand:** taken from the site. Background `#faf9f6`; the writing act uses the warm page colour `#f4ede2`. Ink `#18181b`, sakura pink `#d9779a`. Type: JetBrains Mono, Newsreader (regular and italic), Plus Jakarta Sans for the app UIs. The site's sparkles, sakura petals and pixel pup also appear.

## Acts (frames @ 60 fps)
| frames | act | sound |
|---|---|---|
| 0–240 | `> hi, i'm nikit` is typed. The homepage avatar pops in, and its eyes follow the caret and blink. It opens into the full painted portrait, the serif name lands, and he **winks** (f222). | a key per character, a pop, piano on the name, a wink "tink", a riser |
| 240–600 | **NEBians**, Material 3 phone UI with cards popping in and a GPA bar. It swipes to **Lami Nepal**, where chat bubbles arrive. The phone morphs into a browser: **AstroWeb**, where a North-Indian kundali chart draws itself, planets land in the houses and the dasha bars grow. | the groove enters (Am F C G); impact, UI pops, a marimba per chart line, pings for the planets |
| 600–720 | the window collapses, and 14 stack icons burst out into a grid: Kotlin, Compose, Android, Python, Django, Svelte, TS, JS, Firebase, Tailwind, Redis, MySQL, Git, Flutter | an ascending marimba note per icon |
| 720–840 | Consica Labs card ("Head of Operations"). A checklist ticks off on 8ths and the quarter bar fills to 100%. | check pops and a rising tone, then a chime |
| 840–1140 | the page turns warm and petals fall. "Be yourself." is typed, then struck out. "*Which self are you talking about?*" The essay titles scroll past and land on "Where is God?", whose lines then rise in: "God is neither in, *nor out.*" … | breakdown with no drums: felt piano, typewriter keys, pencil scratch on the strike, a flick per title passing, a bell on the landing, a riser |
| 1140–1260 | montage on 8ths: 8 earlier moments, each pushed in, with a reel counter. The last cut is the eyes, close, winking. | the drop: impacts and crashes on every cut |
| 1260–1500 | the homepage header, rebuilt: avatar circle, the serif name with the sleeping pixel pup and its "z"s, a typed intro, and `nikit.is-a.dev` with the site's wavy underline. The pup sits up and he winks one last time (f1428). | the music stops; one hit on the name, keys, the pup snoring, a final tink |

## Files
- **`film.js`**, the whole film. `window.film.frame(f)` draws frame `f`, and frames are independent. The `T` object at the top holds every cue.
  - Eyes come from `assets/now_eyes.svg`, parsed into canvas paths (`parseEyes`/`drawEyes`). `eyeState(f)` holds the look keyframes, `BLINKS` and `WINKS`.
  - Motion blur comes from 10 sub-frame samples over the `FAST` ranges.
- **`score.py`**, the soundtrack: numpy/scipy voices placed on the same frame cues. Its `T` dict mirrors `film.js`, so move a cue in both.
- **`tools/render.js from to outdir url`** renders a frame range. Ranges can run in parallel.
- **`tools/stills.js outdir url f1 f2 …`** renders single frames for review.
- **`sheet.py`** makes a contact sheet.
- **`assets/`** holds:
  - fonts (OFL);
  - the painted portrait without eyes, plus the eyes SVG;
  - the NEBians and Lami logos;
  - devicon SVGs (MIT);
  - the site's pixel pup and sakura SVGs.

  The Consica and AstroWeb marks are redrawn as vectors in code (`consica()` and `screenAstro()`).

## Rebuild
```sh
cd showreel/portfolio-reel/tools && npm i && npx playwright install chromium && cd ..
pip install numpy scipy soundfile pyloudnorm pillow    # and ffmpeg on PATH
./build.sh
```

## Common edits
- **Copy:** search `film.js` for the text, e.g. `typed(...)` and `rise(...)` calls, the `TITLES` list, and the `L` lines in `actWrite`.
- **App UIs:** `phoneScreenNEB`, `phoneScreenLami`, `screenAstro`. The tech icons are listed in `ICONS`.
- **Timing:** `T` in `film.js` plus `T` in `score.py`. The length is `TOTAL` in both, plus the ranges in `build.sh`.
- **Montage picks:** `MONT` lists `[source frame, zoom, focus x, focus y]`. `null` means the live close-up of the eyes.
