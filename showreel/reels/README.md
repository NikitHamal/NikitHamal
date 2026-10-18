# Post reels (27 s each, vertical + landscape)

Reels made from six posts. Each one opens on its hook line, with no title card: the post's strongest sentences land word by word on a 100 BPM grid. Only the last 3.6 seconds show the title, "An essay by Nikit Hamal", the date and the post's address.

**Outputs:** `out/<slug>_vertical.mp4` (1080×1920) and `out/<slug>.mp4` (1920×1080). Both are 27 s, −14 LUFS, true peak ≤ −1.5 dBTP.

## The script lives in `reels.json`
Each reel is a list of blocks `{from, to, mode, kind, lines…}`:
- **Frames:** 60 fps, so one beat is 36 frames.
- **`mode`:** `light` (paper), `dark` (ink, used for the hooks and turns, always cut on the beat) or `pond` (the homepage koi pond behind the type).
- **`kind`:** the motion for that block.
- **Lines:** `{t, at, step, size, f, c, y}`. The words of `t` land one by one, starting `at` frames into the block and spaced `step` frames apart.

`film.js` (picture) and `score.py` (sound) both read this file, so changing a line or a time changes both.

| kind | what happens |
|---|---|
| `impact` | the lines land word by word: each word scales down out of a blur onto the grid |
| `strike` | each line is struck through in rose (every wrapped row) |
| `dis` | "Now their approval…" gains its "dis": **dis**approval |
| `center` | a centre point appears, then dissolves into rings that leave nothing in the middle: "There is no center to uncover." |
| `again` | "Read that again." The line underlines itself, word by word |
| `dog` | the site's `<pixel-dog>` chases its tail around the axis, then slows and sits |
| `wake` | the painted face, eyes shut, opens its eyes on "Waking happens." |
| `brackets` | "security." locks into brackets |
| `un` | "certainty." gains its "un" |
| `breaks` | "breaks." cracks and its letters fall |
| `wind` | the words blow away letter by letter, like wind through open palms |
| `couplets` | God is neither … nor … |
| `drops` | "ocean" dissolves into falling drops |
| `gather` | countless drops gather into one drop, which ripples out into the ocean |
| `swaps` | gold → mud, tears → laughter, humility → *defiance* (stands tall), worship → (silence, and the music drops out too) |

**Always present:**
- a giant outlined "ghost word" behind the type (SELF, DREAM, TRUST, GOD, YOU);
- a slow camera push with a small kick on every beat;
- a light sweep on each cut;
- story-style progress bars along the top;
- paper grain.

**Vertical layout:** every block's lines are measured and stacked (top, middle and bottom groups). Long lines wrap onto two rows instead of shrinking.

## Build
```sh
./build.sh                 # all six
./build.sh where-is-god    # one
```
