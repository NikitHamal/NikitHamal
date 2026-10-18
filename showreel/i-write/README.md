# "I write.": the typographic film (56 s, landscape + vertical)

Only his words and his painted faces: no illustration, no apps. Every frame is symmetrical about one vertical axis.

- **Outputs:** `out/i-write.mp4` (1920×1080) and `out/i-write_vertical.mp4` (1080×1920, hand-laid-out, not a crop).
- **Spec:** 60 fps, 3360 frames, 80 BPM (beat = 45 f, bar = 180 f), −14 LUFS, true peak ≤ −1.5 dBTP.
- **Device:** the letter **I**.
  1. "hi, I'm Nikit." is typed. Every letter but the I falls away, and the I becomes "I write.".
  2. The I grows into the axis of the frame, then splits into three: baby, curls and today.
  3. Every essay that follows asks the same question of it: *which* I?
  4. It ends where it began: the name, and "I write.".

## Scenes (frames @ 60 fps)
| frames | scene | from |
|---|---|---|
| 0–300 | "hi, I'm Nikit." → the letters fall, the I stays → "I *write.*" | — |
| 300–490 | the I grows into the axis, then splits into three | — |
| 480–780 | three painted faces (baby, curls, now), whole and uncropped, glancing at each other: "We never met." / "*how many Nikits are there?*" | We never met |
| 790–960 | "You and I only meet / *the idea of ours* / about others", the idea mirrored like water | We never met |
| 966–1196 | "Be yourself." struck out → "*Which self are you talking about?*" | The lie of "being yourself" |
| 1204–1440 | "I" and "You" drift toward the axis but never touch; they melt, and only *love* is left | "I" and "You" cannot Love |
| 1446–1620 | "Either a person is selfish, / *or they are not.*" The sentence parts down the middle: "*There is nothing in between.*" | Unity is a lie |
| 1626–1800 | UNITY flies apart letter by letter: "*is nothing but a pretense.*" | Unity is a lie |
| 1806–1990 | "Everything is *thought.*" echoes outward → "Out of mind, there is nothing." → the frame and the music go silent | Everything is thought |
| 1990–2250 | the titles scroll to "Where is God?", then three couplets | Where is God? |
| 2256–2520 | the painting dreams with its eyes shut: "Before waking up, all is a dream." → "There is only one single step." → the eyes open: "Just wake up, *and all is finished.*" | There is only one step |
| 2524–2820 | the koi pond, opened by a circle on the axis, goes from golden hour to night: "countless drops, *for the boundless sea,*" … "a guiding star, *for the lost to see,*" | You (poem) |
| 2830–3000 | baby → curls → now become one face: "Take me as I am, *whatever I may be.*" | Take me as I am |
| 3000–3360 | the face, "Nikit Hamal", "*I write.*", nikit.is-a.dev/writing, the pup asleep in its sploot, a last wink | — |

## Files
- `film.js`: `T` holds the cues, and each scene is one `s…()` function.
  - `?v=portrait` switches the layout.
  - `K` scales the type for the narrow frame.
  - `fit()` keeps every line inside the frame.
- `score.py`: the score, built on the same cues.
  - Felt piano and drone, a koto pluck per word, a glass tone per face, pen nibs for typed words, a brush for the strike.
  - Left/right voices for "I" and "You".
  - The one full silence comes after "there is nothing".
- `build.sh`: renders both cuts, then scores, masters and muxes. The engine and media live in `../shared`.
