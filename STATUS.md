# HANOMI — status tracker (read this first)

Goal: public `NikitHamal/hanomi` repo + GitHub Pages web original (repo root) + a native C++ Windows rebuild that is **the same game, same sprites, same world**, only lighter and smoother.

## v2 (current) — 1:1 port of the web game
V1 used invented procedural art and looked nothing like the web game. V2 is a faithful port:

| Layer | How it matches the web game |
|---|---|
| Sprites (trees, crops, structures, icons, animals, dogs, banners, stalls, houses, HUD glyphs) | `tools/export_assets.mjs` runs the **original `js/art/*.js` + `shared/pixel-dog.js`** under Node with a canvas shim and packs 813 sprites into `native/res/assets.bin` (550 KB, LZ4) which is embedded in the exe. Houses are exported colour-independent with a class mask so nation colours apply at runtime. |
| Terrain / walls / water glints | `terrain.h` = line-by-line port of `art/terrain.js` (same noise tables, jitter, voronoi cobble, turf lips, foam, ore walls). |
| Characters | `chars.h` = port of `art/chars.js` (layered, sel-outlined 24x32 chibi; villager/soldier/zombie/player looks use the same seeds + RNG). |
| World | `world.h` = port of `defs.js`, `items.js`, `world.js` (identical hash/noise/RNG => same world for a seed, same villages, same recipes). |
| Rules | `game.h` + `logic.h` = port of `game.js`, `entities.js`, `player.js`, `fx.js` (villager routines, soldiers, zombies, Blood Moon, wolves, farming, fishing mini-game, mining, building, nations/war/ally/vassal, interiors, goals, shrines, treasure digging, tool swing arcs, bow/spear/torch props). |
| Renderer | `render.h` = port of `render.js` (chunk layers, y-sorted drawables, shadows, dusk multiply, night light holes + warm glow + window glow, rain/snow, fish shadows, birds, petals, fireflies, koi pond). |
| UI | `ui.h`/`ui2.h`: full-resolution HUD + panels using the original CSS palette, ink/wood frames and the **Pixelify Sans** font (stb_truetype, embedded). Minimap, hotbar, hearts/bowls, toasts, banner, bubbles, fishing bar, satchel+crafting, chest, market, dialogue, chief tasks, realm, map, journal, settings, title screen with koi pond. |
| Audio | V1 synth (`audio.h`): SFX + generative music + ambience. |

## Visual QA (HTML vs native, 1280x720)
Reference shots from the web game were captured with headless Chromium (Playwright); native shots with `hanomi_headless` (`native/qa/*.txt`). World, villages, characters, dog, hats, houses, night lighting and panels match; remaining visible differences listed below.

## Known gaps / backlog
- Koi pond is a simplified sim (shape, koi, lilies, ripples, feeding) — the 1685-line `koipond.js` is not ported.
- Web audio engine (`audio.js`, 996 lines) is approximated by the V1 synth, not ported note-for-note.
- Satchel UI: no category tabs/split-stack/durability tooltip yet; trade/chief dialogues are simplified.
- Terrain chunk bake hitches (~40 ms) when entering new chunks; move to a worker thread.
- Windows exe verified to build (mingw-w64 posix); only the Linux headless build was *run* in this sandbox.

## Build
`sh tools/export.sh` (regenerate sprites) · `make -C native win` (hanomi.exe) · `make -C native headless` (QA; `python3 tools/ppm2png.py shots/*.ppm`).
Releases: https://github.com/NikitHamal/hanomi/releases
