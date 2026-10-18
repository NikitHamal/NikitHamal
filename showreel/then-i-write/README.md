# "then, I write.": the artistic / philosophical reel (32 s, landscape + vertical)

The writer's reel: no apps, no company, only his words and the portfolio's own art.

- **Outputs:**
  - `out/then-i-write.mp4`: 1920×1080
  - `out/then-i-write_vertical.mp4`: 1080×1920, a hand-laid-out portrait cut
  - `out/soundtrack.wav`
  - `out/poster.jpg`
- **Spec:** 60 fps, 1920 frames, 80 BPM (beat = 45 f, bar = 180 f), BT.709, AAC 48 kHz, −14 LUFS, true peak ≤ −1.5 dBTP.
- **Device:** the **enso**, the brush circle from the essays' motion forms. It opens the film with the painting blooming inside it, becomes the window onto the koi pond, and closes the film around the name.
- **Look:** warm writing-page paper with grain and vignette, Newsreader regular and italic, the essays' line-art "motion forms" drawn stroke by stroke, the writing pages' pixel vignettes, the homepage koi pond, and the site's pixel pup asleep in its sploot.

## Acts (frames @ 60 fps)
| frames | act | words |
|---|---|---|
| 0–360 | the enso's guides and brush circle draw; the painting blooms inside, eyes closed, then opens its eyes | "hi, I'm Nikit." → "*then, I write.*" |
| 360–540 | "Be yourself." typed, then struck out in rose over the witness-eye form | "*Which self are you talking about?*" (The lie of "being yourself") |
| 540–720 | three paintings, three ages, glancing at each other, then at you | "We never met." / "*Do you see, how many Nikits are there?*" (We never met) |
| 720–1260 | six floating worlds, each with its own essay's line form and a line from an essay: sakura, moon rabbit, lantern, torii, heron, Fuji | Take me as I am · Everything is thought · Wisdom cannot be taught · There is only one step |
| 1260–1590 | an enso opens onto the koi pond at golden hour, which turns to night | "countless drops, / *for the boundless sea,*" … "a guiding star, / *for the lost to see.*" (You) |
| 1590–1920 | the pond closes into the enso around the painting, then the name; the pup sleeps; a last wink | Nikit Hamal · *writing about the self.* · nikit.is-a.dev/writing |

## Sound (`score.py`)
- **Bed:** a drone and felt piano, one chord per bar (D major / B minor).
- **Words:** a koto-style Karplus-Strong pluck for each word, and a glass tone for each portrait.
- **The enso:** a brush on paper as it draws, and a temple bell when it closes.
- **Writing:** pen-nib taps while "Be yourself." is typed, and a brush stroke as it's struck out.
- **Worlds:** a soft pulse under all six, and one foley per world: wind chime, moon chime, lantern bell, wood blocks, water drops, mountain wind.
- **Pond:** water and falling drops at golden hour, then crickets at night.
- **Ending:** a deep bell under the name, the pup snoring, and a tink on the final wink.
- **Mix:** sends go through a stereo convolution reverb.

## Edit
- `T` in `film.js`, mirrored in `score.py`, holds the timing.
- `ISLES` sets each world's vignette, form, quote and essay.
- `LY` holds the per-orientation layout.
- Forms are picked by their vol2 names: see `window.MOTION_FORMS_VOL2_NAMES` in `js/motion-forms-vol2.js`.
- Rebuild with `./build.sh`; the engine and media live in `../shared`.
