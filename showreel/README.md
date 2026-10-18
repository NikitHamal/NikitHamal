# "Drawn in code": Nikit Hamal showreel (15 s)

> More films: **`portfolio-reel/`** (29 s; the person behind the portfolio: apps, stack, operations, essays, pond) and **`then-i-write/`** (32 s; the writer's reel). Both come in landscape and vertical cuts, built on the shared engine in `shared/`.

A 15-second motion-graphics showreel built entirely in code: a canvas frame function rendered headless, plus a synthesised score and sound effects.
Spec: 1920×1080, 60 fps, 900 frames, 120 BPM (beat = 30 f, bar = 120 f), BT.709 colour tags, AAC 48 kHz, loudness −14 LUFS, true peak ≤ −1.5 dBTP.
The craft rules come from the [cinetic](https://github.com/Leonxlnx/cinetic) skill. That repo only ships its SKILL.md, so the tooling here is custom.
See `BRIEF.md` for the spec, brand and banned list, and `TREATMENT.md` for the beat sheet.

**Final output:** `out/showreel.mp4`. Also in `out/`: the mastered `soundtrack.wav`, `poster.jpg`, and `contact_sheet.png` (25 key frames).

## Layout
| path | what |
|---|---|
| `film.html` / `film.js` | the film. `window.film.load()` loads the assets, and `window.film.frame(f)` draws frame `f` onto `#c`. Everything is a function of the frame number. |
| `score.py` | the soundtrack: numpy/scipy synth voices placed on picture cues, normalised to −14 LUFS. Writes `out/soundtrack_raw.wav`. |
| `build.sh` | the full pipeline. It serves the files, renders 900 frames, scores, masters, muxes, makes a poster and contact sheet, and runs the spec checks. |
| `tools/render.js` | Playwright frame renderer: `node tools/render.js from to step outdir url`. Renders in order, because the pencil replay accumulates. |
| `tools/grabclips.js` | re-records the live `/preview` pixel scenes into `clips/<stageId>/000-071.png`, and the mascot into `clips/mascot/` (48 PNGs). |
| `sheet.py` | contact sheet: `python3 sheet.py <dir of jpgs> out.png` |
| `assets/` | `paint_<age>.png`: the six painted portraits, rasterised from `preview/art/<age>`. `now.pcl`: pencil stroke data, replayed as the drawing. `now_tone.png`, `now_smudge.png`: pencil shading layers. `pixelhead.png`: the pixel me. `jakarta.ttf`: Plus Jakarta Sans (OFL). |
| `clips/` | the real footage of each pixel scene and the mascot. |

## Rebuild
```sh
cd showreel/tools && npm i && npx playwright install chromium && cd ..
pip install numpy scipy soundfile pyloudnorm pillow     # and ffmpeg on PATH
./build.sh            # uses the committed clips
./build.sh --clips    # re-record clips from /preview first (do this after changing any pixel scene or the mascot)
```
`build.sh` serves `showreel/` on :8799 and the repo root on :8765. It writes the frames to `frames/`, which git ignores.

## Where to change things
- **Timing.** The `T` object at the top of `film.js` holds every act's frame ranges. If you move a cue, move its sound too: the frame numbers in `score.py` (`STOP`, `HIT`, `BREAK`, the whoosh apexes, the pluck, bleep and tick frames) mirror `T`.
- **Copy.** Calls to `words(...)` in `film.js`: "one line", "becomes me.", "every age", "in pixels", "all drawn" / "in code.", and the name and URL in the lockup.
- **Colours and type.** `C` in `film.js` (paper, ink, terracotta accent, mute). The font face is in `film.html`.
- **Which scenes it whips through, and their order.** `SCENES` in `film.js`. The tree clip is the zoom-out shot; the 4×3 wall layout is in the act-6 code.
- **Motion blur.** Sub-frame accumulation in `film.frame`: 16 samples for whips and the pull, 8 for other fast ranges, 1 elsewhere.
- **Music and sound effects.** `score.py`: the voices (kick, clap, hat, pluck, bass, pad, whoosh, tick, bleep, pencil scratch, bell), then the arrangement. A minor; one chord per bar: Am F C G Am F C.
- **Length.** `TOTAL` in `film.js`, `DUR` in `score.py`, and the frame count in `build.sh`.

## Acts (60 fps)
| frames | act |
|---|---|
| 0–150 | the ink line enters already moving and replays the pencil portrait: "one line" |
| 150–300 | a diagonal colour wipe, with the line as its edge; sketch becomes painting: "becomes me." |
| 300–420 | match cut into a film strip of every age, baby to now, stepping every 15 f: "every age" |
| 420–510 | the painting pixelates in steps, cuts to the pixel sakura scene on my face, then zooms out: "in pixels" |
| 510–630 | whip pans through campfire, rain, desk, fishing, stargazing and snow, with the ink line on each seam |
| 630–750 | snow shrinks into a 4×3 wall of everything: "all drawn" + "in code." |
| 750–900 | the line clears to paper, the music stops, one hit, "Nikit Hamal", "nikit.is-a.dev" |
