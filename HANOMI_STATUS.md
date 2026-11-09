# HANOMI — status tracker (read this first)

Goal: (1) public `NikitHamal/hanomi` repo + GitHub Pages with the original web game, (2) a from-scratch native C++ Windows rebuild that is lightweight, fast, and better than the web original, with properly rigged characters.

## Where things live
| What | Where |
|---|---|
| Original web game (verbatim) | `hanomi/` in this repo; copy at `NikitHamal/hanomi` (root, served by Pages) |
| C++ rebuild source | `hanomi-native/` here; `native/` in `NikitHamal/hanomi` |
| Build | `make -C hanomi-native win` (mingw-w64 → `hanomi.exe`) / `make headless` (Linux QA build, dumps PPM frames) |

## Milestones
- [x] M1 — `NikitHamal/hanomi` created (public), web game copied, Pages enabled (`main` /root) — commit `2e59a91`
- [ ] M2 — C++ engine: software renderer, font, noise, world gen, chunk bake
- [ ] M3 — Rigged characters (skeletal FK/IK humanoid + quadruped) + animation set
- [ ] M4 — Gameplay: farming, fishing, mining, building, crafting, combat, animals, dog, villages, clans/army, blood moon, goals
- [ ] M5 — Audio synth (SFX + generative music + ambience), save/load
- [ ] M6 — UI/menus, polish, perf pass, CI build, release

## Decisions / notes
- Toolchain: mingw-w64 (g++ 12 posix) cross-compiles; no external libs (Win32 GDI + waveOut) => tiny exe, no DLLs.
- Rendering is 100% software at an integer-scaled low-res framebuffer (≈480x270) for crisp pixel art; QA is done by a headless Linux backend that writes PPM → PNG.
- HF dataset `Angais/pixel-art-atlas-1.4m` (16x16 sprites): **not used**. Art is generated procedurally in-engine (coherent palette, zero asset weight, no licence ambiguity). Could be used later offline for item-icon inspiration.
- Interiors of houses (web "enter house") are a known parity gap, tracked below.

## Parity gaps vs web original (update as closed)
- house interiors
- chief tasks / treasure-dig minigame details (basic versions only)
