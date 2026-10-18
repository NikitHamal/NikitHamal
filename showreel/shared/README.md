# shared/: the engine and media the showreel films use

- **`lib.js`** (`LIB`) holds:
  - easing;
  - type helpers: `typed`, `rise`, `wordsIn`;
  - the painted portrait with live eyes: `loadPortrait`, `portrait`, `eyeTrack`. The eyes support gaze keyframes, blinks and winks, with a skin-toned lid and a lash line when closed.
  - the site's real `<pixel-dog>` rig: `dogKit`, with poses sleep / sit / stand / walk / run and the "z"s;
  - the pond footage: `loadClip`, `cover`;
  - the `<pixel-scene>` vignettes: `loadScenes`, `scene`;
  - the essays' line-art motion forms: `loadForms`, `form`, which draws them on stroke by stroke;
  - sub-frame motion blur: `blurFrame`.
- **`fonts.css` + `fonts/`**: JetBrains Mono, Newsreader (regular and italic) and Plus Jakarta Sans for the site; Poppins, Cinzel Decorative and Material Icons Round for the app UIs. All are OFL or Apache.
- **`art/`**: the painted portraits with their eyes painted out, plus their live-eye SVGs (from `preview/art/<id>`).
- **`pond/`**: the homepage koi pond (`js/pond.js`) recorded at day, golden hour, night and rain.
  - `land_*` files are 640×360 (shown at 3× nearest-neighbour).
  - `port_*` files are 540×960.
  - Encoded as VP9 4:4:4, so the pixels stay crisp.
  - Re-record with `node tools/pondclip.js <outdir> 1920 1080` (or `1080 1920`) while the repo is served on :8765, then encode with `ffmpeg -framerate 30 -i %03d.png -c:v libvpx-vp9 -pix_fmt yuv444p -crf 20 -b:v 0`.
- **`scenes/`**: the 18 `<pixel-scene>` vignettes from `js/pixel-scenes.js`, as 90-frame 64×64 strips. Re-record with `node tools/scenes.js <dir>`, then assemble the strips.

Films load `../../js/pixel-dog.js` and `../../js/motion-forms*.js` straight from the site, so serve the repo root.
