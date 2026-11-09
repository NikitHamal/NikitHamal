# HANOMI — status tracker (read this first)

Goal: (1) public `NikitHamal/hanomi` repo + GitHub Pages with the original web game, (2) a from-scratch native C++ Windows rebuild: lightweight, fast, better than the web original, properly rigged characters.

## Where things live
| What | Where |
|---|---|
| Original web game (verbatim) | `hanomi/` in this repo; copy at `NikitHamal/hanomi` root (served by Pages: https://nikithamal.github.io/hanomi/) |
| C++ rebuild | `hanomi-native/` here (branch `hanomi-native`); `native/` in `NikitHamal/hanomi` |
| Windows download | GitHub Release `v0.1.0-native` on `NikitHamal/hanomi` (`hanomi.exe`) |
| Build | `make -C hanomi-native win` (mingw-w64) / `make headless` (QA) |
| QA scripts | `hanomi-native/qa/*.txt` run by the headless backend (screenshots + perf) |

## Milestones
- [x] M1 — `NikitHamal/hanomi` created (public), web game copied, Pages enabled (commit `2e59a91`)
- [x] M2 — engine: software renderer, font, noise, world gen, chunk bake, live water, lighting, weather
- [x] M3 — rigged characters (humanoid FK/IK + spring hair/scarf, 9-species quadruped rig, per-action poses)
- [x] M4 — gameplay: farming, fishing mini-game, mining, building, crafting (all web recipes), combat, animals + breeding, dog + fetch, villages, clans (ally/war/vassal/tribute), army, Blood Moon raid, goals, shrines, koi, death satchel
- [x] M5 — audio synth (SFX + generative music + ambience), save/load (`%APPDATA%\Hanomi\hanomi.sav`)
- [x] M6 — UI/menus (koi-pond title, bag/crafting, trade, chest, dialogue, map, realm, journal, settings), Win32 exe, CI workflow
- [ ] M7 — polish backlog (below)

## Verified (headless Linux build; the Windows exe is cross-compiled and was NOT run on real Windows or Wine in this session)
- 1440x810 window -> 480x270 logical, avg frame 2.4-3.6 ms CPU (software render), worst hitch ~25-40 ms on new-chunk generation
- scripted runs: village day/night/rain, combat poses, 12 animals/enemies, Blood Moon raid (31+ entities), save/load round-trip, every menu, clan village + chief dialogue, far travel (2000 tiles) — no crashes

## Decisions / notes
- No external libs: Win32 GDI + waveOut + XInput (LoadLibrary) -> ~0.8 MB exe.
- Art is procedural (coherent palette, zero asset weight). HF dataset `Angais/pixel-art-atlas-1.4m` was **not evaluated or used**; could feed offline icon inspiration later (licence unchecked).
- Windows headers define `IN`/`near`/`far`; main.cpp `#undef`s them after including windows.h.

## Parity gaps / backlog vs web original
- house interiors (enter houses) — not ported
- treasure-dig mini-game (glinting soil is drawn but digging with a hoe is not wired)
- chief tasks are simple fetch quests; fishing line has no physics
- chunk-generation hitch on fast travel (move gen to a worker thread)
- touch controls are n/a on desktop; gamepad is basic
- Windows exe untested on real Windows (verify the first launch, audio device, fullscreen toggle)
