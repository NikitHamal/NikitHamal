# Hanomi — native C++ build

A from-scratch C++17 rebuild of the Hanomi sakura-village survival game. One self-contained `hanomi.exe` (~0.8 MB, no DLLs, no asset files): all art is generated procedurally at start-up, all audio is synthesised.

## Build
```
make win        # needs mingw-w64 (x86_64-w64-mingw32-g++) -> build/hanomi.exe
make headless   # Linux QA backend: runs a script, dumps PPM screenshots, prints perf
build/hanomi_headless qa/smoke.txt shots   # then: convert shots/x.ppm -filter point -resize 300% x.png
```

## Controls
WASD/arrows move · Shift sprint · Space dodge-roll · LMB/J use · RMB/E interact · 1-8/wheel hotbar · Q drop · Tab bag+crafting · M map · N realm · G journal · Esc pause · F11 fullscreen · F2 screenshot · XInput pad (A use, X interact, B roll).

## Architecture (`src/`, single translation unit)
| file | what |
|---|---|
| `core.h` | math, hash/noise (same as the web original), colour ramps, software framebuffer, shaded capsules, 5x7 pixel font |
| `data.h` | tiles/blocks/objects, 97 items, all recipes |
| `world.h` | infinite world: biomes, ores, rivers, shrines, villages (roads, houses, pens, fields), chunks, saves |
| `art.h` | procedural sprites: ground (edge-blended at bake), blocks, trees, crops, buildings, 97 item icons |
| `rig.h` | **skeletal rigs**: humanoid FK + 2-bone IK arms/legs, spring-chain hair & scarf, per-action poses (swing, chop, thrust, bow draw, bend, eat, cast), roll/death; quadruped rig with diagonal gait for 9 species |
| `audio.h` | SFX bank + generative music (koto, shakuhachi, pad, taiko; day/night/battle moods) + rain/wind/cricket ambience |
| `game.h`, `ai.h` | player actions, farming, fishing mini-game, combat, nations/alliances/conquest, Blood Moon raids, weather, goals, villagers/soldiers/zombies/animals/dog AI |
| `render.h` | chunk bake, live animated water + foam, y-sorted sprites, wind sway, dynamic lighting, rain/snow/petals |
| `ui.h` | HUD, minimap, bag/crafting, trade, chest, chief dialogue, map, realm, journal, koi-pond title |
| `main.cpp` | Win32 backend (GDI integer-scaled blit, waveOut, XInput) and headless QA backend |
