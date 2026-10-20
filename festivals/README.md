# Festivals: Dashain & Tihar 2083

A 3D motion film and wish cards for Bada Dashain 2083, all in Nepali. Everything is built in code: three.js models rendered headless in Chromium, a Devanagari type layer, and pixel-art accents. The film is scored with licensed recordings that need no attribution.

| | |
|---|---|
| **`out/dashain.mp4`** | **"विजया"**: 1080×1920, 30 fps, about 75 s, −14 LUFS. All copy in Nepali. |
| **`out/cards_v2/dashain/`** | 5 designs × 5 sizes = 25 PNGs, 3D-rendered, Nepali copy |
| `out/dashain_poster.jpg` | poster frame |

Tihar v2 (same 3D pipeline) follows.

## The film: "विजया"

It starts in the middle of a kite fight, goes back 1,500 years, then walks through every day of Bada Dashain and ends with a tika on *you*. One **red tika dot** runs through every shot as the story device:
- the heart of the cut kite;
- the *bindu* the gods' light pours into, and from which Durga's trishul blooms;
- Kathmandu on the map;
- the marker on the fifteen-moon strip;
- the heap on the thali;
- finally, the tika that floods the screen.

| section | what you see | copy (Nepali fragments) |
|---|---|---|
| **कट** 0–7 s | 3D kites over the valley and Machhapuchhre; the strings saw, sparks, *चेट!* (in pixel Devanagari), and the red kite tumbles away | असोजको आकाश · एउटा धागो · चुँडियो |
| **कथा** 7–28 s | Devi Mahatmya folios with real verses (या देवी सर्वभूतेषु…). Mahishasura: tapered horns, ember eyes, cracked ground. Three beams of the gods' light meet in the red bindu, which blooms into a gilt trishul ringed by the ten weapons. Nine phase-correct moons, one per beat, with the name of each Navadurga. On the tenth day the horns shatter. | करिब १५०० वर्षअघि · देवी माहात्म्य · महिषासुर · कुनै देवताले होइन · कुनै पुरुषले होइन · देवताहरूको तेज · एउटै शक्तिमा · दुर्गा · शैलपुत्री … सिद्धिदात्री · दशौँ दिन · विजय · विजया = जित, दशमी = दशौँ तिथि |
| **नेपाल** 28–55 s | The official 2020 map (with Lipulekh, Kalapani and Limpiyadhura) rises as a slab, with Gorkha and Kathmandu pulsing. Then the days, over a pixel-art strip of fifteen waxing moons: **घटस्थापना** (kalash, barley grown in the dark), **फूलपाती** (a three-gun salute), **महाअष्टमी** (Taleju at night), **महानवमी** (the doors that open once a year), **विजया दशमी** (a 3D brass thali with 2,400 rice grains, curd, jamara and a diyo; the blessing as a rotating slot), **कोजाग्रत पूर्णिमा** | बडा दशैँ · १५ दिनको महान चाड · घाम नदेखेको जमरा · गोरखाबाट हनुमानढोका · वर्षमा एक दिन खुल्ने तलेजु · अश्वत्थामा जस्तो आयु … · “को जागर्ति?” |
| **जीवन** 55–61 s | Bamboo ping, kites, a bus home with people on the roof, elders giving tika in turn | पिङ · चङ्गा · घर फर्किने बाटो · ठूलाबडाको आशीर्वाद |
| **टीका** 61–65 s | The thali rises to you; a thumb of red rice comes at the lens and the frame floods red | र यो वर्ष · टीका तपाईंलाई |
| **शुभकामना** 65–75 s | A red field of tika rice and 3D jamara. The kite cut in the opening seconds drifts back down, is caught, and flies again. | विजया दशमी २०८३ को हार्दिक मंगलमय शुभकामना · जे चुँडियो · त्यो फेरि उडोस् · — निकित हमाल |

**Craft rules** follow [cinetic](https://github.com/Leonxlnx/cinetic):
- one story device;
- copy in 1–4 word fragments that take turns with the picture, the newest arriving in the accent;
- house easing curves (out / cam / dolly / contact / rest);
- a signature red iris at the open, middle and close;
- every sound is caused by something on screen.

**Sound** (`film3d/score_dashain.py`). There are three music beds, each cut on its own beat grid, so the picture cuts land on beats:
- festive, 129 BPM, for the kite fight;
- epic drums, 117.5 BPM, with taiko under Mahishasura, for the myth;
- devotional flute and percussion, 80.7 BPM, for Nepal and the days.

A Nepali bansuri solo sits under the tika. The recorded SFX are placed on picture events:
- crowd cheers at *चेट!*;
- a braam into the past;
- palm-leaf rustles per folio;
- buffalo snorts and a growl for Mahishasura;
- a conch, an epic hit and the big ghanta when Durga's trishul forms;
- a bell on nights 1, 5 and 9;
- the victory hit and cheer;
- rice pouring at Ghatasthapana;
- three real cannon shots at Fulpati;
- temple bells and crickets at Taleju;
- the Patan Durbar bell-and-conch ambience under the thali;
- the stamp: impact plus ghanta.

All sources are Mixkit free licences and CC0 (Freesound, Wikimedia Commons), listed in `audio/SOURCES.md`. Mixkit forbids redistributing its files on their own, so they are **not committed**: `tools/fetch_audio.py` downloads them at build time.

## Cards v2 (film3d/cards3d.js)

| design | picture | message |
|---|---|---|
| `thali` | the brass tika thali, close and warm | विजया दशमी २०८३ को हार्दिक मंगलमय शुभकामना + the blessing of long life, health, happiness, peace and prosperity |
| `changa` | kites over the valley and the Himalaya | शुभ दशैँ २०८३: खुसी आकाशजत्तिकै फराकिलो होस्, सपना चङ्गाजस्तै अग्लो उडोस् |
| `vijaya` | the gilt trishul and its ring of ten weapons | असत्यमाथि सत्यको विजय + नौ रात शक्तिको आराधना… |
| `jamara` | the kalash and a bed of jamara by lamplight | घटस्थापनादेखि कोजाग्रतसम्म + the jamara metaphor |
| `ghar` | the official map, Kathmandu pulsing | जहाँ भए पनि, दशैँमा घर |

Each design comes in five sizes:

| size | dimensions | use |
|---|---|---|
| `square` | 1080×1080 | feed |
| `portrait` | 1080×1350 | Instagram 4:5 |
| `story` | 1080×1920 | stories, reels, status |
| `landscape` | 1920×1080 | YouTube, X |
| `link` | 1200×630 | Facebook, LinkedIn |

## Engine

- **`film3d/lib3d.js`**: procedural models.
  - Ridged-noise Himalaya with snow by height, and hills.
  - An instanced valley town with lit windows; a Newar pagoda; a bowed paper kite with a ribbon tail; sagging strings.
  - The trishul (extruded) and the ten weapons; tapered swept horns; shatter shards.
  - Phase-correct moons (a custom shader); a palm-leaf folio with a Devanagari canvas texture.
  - The extruded official map of Nepal; a copper kalash; a brass thali with instanced rice; instanced jamara blades that grow and sway.
  - A clay diyo with a flickering flame and light; marigolds; a bamboo ping.
- **`film3d/dashain.js`**: shots on the beat grids, the Nepali type layer, transitions (cut, red iris, pixel dissolve, whip), and the pixel-art moon strip and *चेट!* from `lib/px.js`.
- **`lib/nepal.json`**: Nepal's official 2020 boundary, including Lipulekh, Kalapani and Limpiyadhura.
- **Fonts** (all OFL): Mukta (all Nepali copy), Tiro Devanagari Sanskrit (verses on the folios), Yatra One (the pixel shout).
- **`film/`, `cards/`**: the v1 pixel engine. It is kept as the pixel-art layer and for the Tihar build.

## Build

```sh
pip install numpy scipy soundfile pyloudnorm librosa pillow playwright && python -m playwright install chromium   # + ffmpeg
./build3d.sh                                   # fetch audio, score, render 2,254 frames, mux -> out/dashain.mp4
python3 tools/cards3d.py                       # all 25 cards (or: python3 tools/cards3d.py thali)
python3 tools/render.py dashain --page festivals/film3d/index.html --frames 0,500,1900 --out /tmp/stills
```

**Rendering cost.** Software WebGL (SwiftShader) renders a 1080×1920 frame in about 0.5–0.8 s per CPU worker. `kaggle/launch.sh` runs the same build on Kaggle's free CPUs.
