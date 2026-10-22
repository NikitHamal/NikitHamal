# festivals/v3 — CONTINUITY (Agent B)

Branch: `agent-b/festivals-v3` (never main). The other agent's festival work (`festivals/film`, `festivals/film3d`, `festivals/out`) is untouched; v3 lives only in `festivals/v3/`.

## Owner brief (2026-10-21)
- Rebuild the Dashain reel: history and culture first, the wish only at the very end. Nepali-only narration and captions.
- Better sound: generated/CC0, no attribution needed. No weak SVG; 3D scenes, plus pixel art only where it is genuinely good.
- Fresh Dashain and Tihar stills.
- Map of Nepal in its 2020 official shape (Lipulekh, Kalapani, Limpiyadhura).
- **Renders on molab (marimo pair) only.** Never render locally. If the sandbox says "terminated", tell the owner.
- At most one subagent. Push often. On `409 …awaiting reimbursement settlement`: push, note the next step, continue elsewhere.

## State (update every push)
- [x] Cloned the repo and read the v1 (pixel) and v2 (three.js) engines and the contact sheet. v2's weak points:
  - a flat, low-poly look;
  - it opens on a kite fight;
  - the copy is fragmentary;
  - there is no narration;
  - it uses a pile of stock SFX.
- [x] `script.md`: 22 shots, all in Nepali, with sourced fact notes. History comes first (Devi Mahatmya, Mahishasura, Durga, the nine nights, Rama), then Nepal (the 2020 map, Taleju, Fulpati from Gorkha in 1825 BS), then the days (1, 7, 8, 9, 10 and 15), then the people (ping, kites, the journey home, plurality). The blessing and the wish come only at the end.
- [x] Narration: `tools/narrate.py`.
  - Voice: edge-tts `ne-NP-SagarNeural`, with word timings for synced captions.
  - **The gateway (ElevenLabs/Fish) returned 402 insufficient credits**, so edge-tts was the free fallback.
  - Licence caveat: this is Microsoft's neural voice, not CC0. Swap in a human Nepali VO or ElevenLabs once credits exist: replace `audio/vo/*.mp3`, rerun `narrate.py` (durations + word timings), then `timeline.py`.
- [x] `timeline.py`: 143.4 s at 30 fps (4,301 frames), built from the measured clip lengths.
- [x] Sound:
  - `audio/sources.json` lists 42 Freesound recordings, **each licence verified CC0 on its page**, plus the CC0 Wikimedia bansuri dhun.
  - `tools/sfx.py` is an original synth for braam, impacts, risers, whooshes, shimmer, 8-bit blips and the metal shing. No samples, so no licence applies.
  - `tools/score.py` tunes every melodic source to D, places sound on picture events and ducks the music under the voice, mastering to −14 LUFS.
- [x] 3D: Blender as a Python module (bpy 4.2, Cycles on the molab GPU).
  - `blender/lib.py`: lathe-modelled brass and clay, flames, rice/jamara instancing, compositor bloom.
  - `sets_a.py`: lamp room, palm-leaf manuscript, Mahishasura (metaballs, horns, volumetric smoke, glowing cracks), the gods' beams converging into a gilt trishul, physically lit waxing moon with the horns shattering, Rama's arrow over an ocean-modifier sea.
  - `sets_b.py`: real-elevation relief of Nepal from AWS Terrain Tiles, inside the 2020 boundary (Limpiyadhura, Lipulekh, Kalapani labelled) with the Gorkha → Kathmandu Fulpati thread; Taleju on its stepped plinth; jamara growing in the dark; Fulpati doli + salute; 252 Ashtami lamps; khukuri/hasiya with tika; thali with 4,500 rice grains; valley at Kojagrat; linge ping + kites; night bus + switchback lights; lane of doorways.
- [x] Type: `tools/type_render.py` uses Chromium, because Pillow here has no raqm and so cannot shape Devanagari. It produces per-word PNGs. `tools/composite.py` handles word-synced reveals, kickers, map labels, the Navadurga names, the pixel-art moon calendar (the only pixel element), transitions, grain and vignette.
- [x] API check without rendering: `blender/render.py --shot N --dry` builds each set in bpy 4.2 and steps its animation. All 21 film shots and the 4 Tihar sets pass. Map framing was checked numerically: Nepal fills the frame width, and the Limpiyadhura/Lipulekh/Kalapani, Gorkha and Kathmandu marks are on screen.
- [x] **Render route that works (2026-10-21):** GPU molab boxes died within 2–10 min, 4 times. The owner then allowed CPU and gave a 20-core / 160 GB CPU molab box (`/tmp/reels`; it rebooted once and lost /tmp).
  - The CPU build is `cpu_build.sh`.
  - Per shot, `blender/keys.py` renders 1–13 Cycles **keyframe stills** with the camera locked; only light and action change between them.
  - `tools/composite.py` dissolves between the keys and adds a slow 2D push. Then come the type layer, the pixel calendar and grain.
  - A full pass takes about 35–45 min on 20 cores.
  - `/workspace/tools/sync.py` copies every key and output off the box as it lands. `sync.py up` restores the keys after a reboot.
- [x] **First full cut delivered** (`out/dashain_v3_small.mp4`, 720p review copy, 2:23). Owner: "great", but:
  - (a) the TTS is poor, so the owner will record a better voice. The **narration pack** is in `narration/` (SCRIPT.md, NN.txt, batch txt). `tools/import_vo.py` re-times the film and captions to their takes.
  - (b) some visuals are not realistic.
- [x] **Realism pass (pass 2, rendering now):**
  - Poly Haven CC0 assets via `tools/assets.py`.
  - **Mahishasura** is the scanned `bull_head` sculpture, re-toned as a dark bronze idol, with ember eyes, smoke and glowing cracks.
  - HDRI light and reflections everywhere; the camera still sees each set's own background.
  - Real sunset sky over the sea (rotation 4.2) and over the ping.
  - Scanned PBR textures: brick (Taleju, houses, lane), plaster, earth, sand, roof tiles, bamboo, cobbles, grass-rock.
  - Smooth terrain; moon phases fixed (waxing); Navadurga names moved above the moon.
- [x] **Pass 3 (delivered):** Ramayana and Fulpati rebuilt from scratch (`blender/sets_d.py`).
  - Ramayana: a lacquered recurve bow with a fletched arrow (side close-up), then over the shoulder as the arrow hits golden Lanka on a CC0 cliff.
  - Fulpati: a gilded three-tier doli carrying the navapatrika, with CC0 pomegranate and rifle scans and the salute line with smoke.
  - The 30 wish cards are in `out/cards_v3/` (JPEG q95).
- [x] **Voice (ElevenLabs, owner's free key, kept only in `/workspace/tools/el.env`):**
  - The free API refuses library voices, including the owner's pick Kaanchi `BTUIboFmihb87sfmikzP` ("paid plan required"). Kaanchi is saved in the account; the owner can generate on the website.
  - Current voice: premade **George** on `eleven_v3` speaking Nepali, with the **expressive v3 script** (`narration/script_v3_expressive.txt`; tags stripped from the captions).
  - Every line is verified with Scribe STT: lines 7 and 11 were regenerated after mishearings; line 21 only differs because of numerals.
  - Word timings come from the v3 alignment. `tools/import_vo.py` uses **forced alignment** (free) for owner takes.
  - Credit: "Voice: ElevenLabs".
- [x] **Pass 4 delivered** (2:40):
  - Expressive ElevenLabs narration. Review copy: `out/dashain_v3_small.mp4`.
  - 1080×1920 share copy (about 20 MB) delivered in chat; the chat attachment cap is about 20–24 MB.
  - The 6 Mbps master (125 MB) is on the box at `out/dashain_v3_master.mp4` and in the sandbox at `/workspace/pulled/v3/out/`.
  - Laxmi Puja card fixed. Deepawali (houses still dark) and kites (hazy) are improved but still weak.
- Transfer speed: `/workspace/tools/mxpy.py` is a direct Python client for the marimo execute API, at 0.7 s per 700 KB chunk. `execute-code.sh` takes about 35 s per chunk because of jq. `bigpull.py` does resumable pulls with an md5 check.
- [ ] Next:
  - Pull the pass-4 film and master, deliver.
  - If the owner pushes Kaanchi takes: run `ELEVEN_KEY=… python tools/import_vo.py`, then `cpu_build.sh` (composite + score only).
  - Possible polish: shot 5 (early beam keys are dark), shot 18 (bus), kalash leaves.

- [x] **2026-10-22.**
  - The owner recorded the Dashain narration as **one continuous Kaanchi take** (`narration/all.mp3`). `tools/split_take.py` splits it per line with ElevenLabs forced alignment against the whole script. Note the `--form-string` fix: a `;` in the text was truncating the curl form.
  - New CPU box `sb-0e9be4d28bfdcc98`.
  - **HQ build:** native 1080×1920 keys at 64 spp, grain 2.4, CRF 17 film plus a 12 Mbps `*_1080p.mp4`. Downloads come straight from the notebook status cell (`mo.download` per file in `out/`).
- [x] **Tihar film** (`tihar/`):
  - Script with sourced notes.
  - Expressive George narration, Scribe-checked.
  - Sets in `blender/sets_t.py`: valley lighting up, Yama–Yamuna oil ring with Yama's buffalo shadow, dawn crows, milk bowl → rangoli, garlanded ox, Mha Puja top.
  - `blender/shots_tihar.py` (SHOTS + KEYS).
  - The type pass and compositor are film-aware via `FILM=tihar`: 5-diya pixel calendar, animated pixel Kukur Tihar dog, NS 1147.
  - `tools/score_tihar.py`; build with `tihar_build.sh` (outputs in `build_tihar/`, `out/tihar_v3*.mp4`).
  - The owner may record Kaanchi for Tihar: see `tihar/narration/README.md`.
- Gotcha: two builds running `fetch_audio.py` at the same time corrupt the shared `.src` downloads. Run audio once, then the other film.

- [x] **Delivered 2026-10-22 (HD):**
  - `dashain_v3_1080p.mp4` (220 MB, 2:23, Kaanchi voice) and `tihar_v3_1080p.mp4` (213 MB, 2:19, George expressive first cut). Both are 12 Mbps 1080×1920, plus CRF-17 masters of about 560 MB.
  - Download buttons are in the molab notebook status cell. Backups are in the sandbox at `/workspace/pulled/hd/`; previews were posted in chat.
  - Captions sit on a soft scrim (`composite.scrim`). `recut.sh` re-composites and re-encodes both films from existing keys and scores in about 8 min.
- [ ] Next:
  - When the owner pushes `tihar/narration/all.mp3` (Kaanchi), run `tools/split_take.py` with `FILM_DIR=…/tihar`.
  - Then on the box: `FILM=tihar python tools/type_render.py`, then `score_tihar.py` → `out/tihar_score.m4a`, then `FILMS=tihar bash recut.sh`.

## Delivery limits (measured)
- Connector pushes carry blobs up to about 8 MB; 30 MB fails with HTTP 413. So the repo copy of the film has to be at most about 8 MB (or split per section), and the full-quality master goes to the owner as a chat attachment (`actl asset put`).
- molab → here: base64 chunks through the marimo execute API (see `nik/docs/LEARNINGS.md`: 700 KB reads, md5 on both ends).

## How to push from this sandbox
There are no git credentials here. Pushes go through the GitHub connector (Git Data API): `/workspace/tools/ghpush.py`, which runs in actl's own venv (`/app/py/.venv/bin/python`) and calls `ApiClient` in-process (so there is no argv limit) and respects `.gitignore`. It is wrapped by `/workspace/tools/push.sh "msg" paths...`. Both are outside the repo. Re-create them if the sandbox is reset; see the commit history of this file.
