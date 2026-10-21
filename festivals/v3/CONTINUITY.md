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
- [ ] **BLOCKED on molab URL/token (owner to paste).** Not one pixel has been rendered yet.
- [ ] On molab:
  1. `bash festivals/v3/build.sh setup dem type audio`.
  2. Test stills: `python blender/render.py --shot N --t 2 --samples 32 --still /tmp/sN.png` for every shot. Fix, then iterate.
  3. Run `plates composite mux`.
  4. Pull `out/dashain_v3.mp4` back to the repo: base64 chunks via the marimo execute API.
- [ ] Stills: 5 Dashain + 5 Tihar designs × 3 sizes, as 3D scenes that reuse these sets. The Kukur Tihar dog stays pixel art; it is the one place pixel art is genuinely good.

## How to push from this sandbox
There are no git credentials here. Pushes go through the GitHub connector (Git Data API): `/workspace/tools/ghpush.py`, wrapped by `/workspace/tools/push.sh "msg" paths...`. Both are outside the repo. Re-create them if the sandbox is reset; see the commit history of this file.
