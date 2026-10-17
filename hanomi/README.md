# Hanomi

A small, living pixel-art sandbox at **`/hanomi/`**, built directly into Nikit's static portfolio. No build step, engine, server, account, paid asset, or runtime dependency. Serve the repository normally; GitHub Pages resolves `hanomi/index.html` automatically.

## Play

Start a named world with an optional text seed. Walk with **WASD / arrows**, run with **Shift**, interact with **E**, and use tools with **Space** or a mouse click. **1–6** selects axe, pickaxe, hoe, fishing rod, sword, and seeds. **B** opens the backpack, **C** crafting, **J** the journal, **M** the map, and **Escape** pauses. Small screens have a thumbstick and action buttons.

- Meet Hana for seeds. Till grass, plant, and harvest after 70 seconds of world time. Sleeping also grows crops.
- Chop trees, mine rock and iron, gather berries, hunt deer, and cook at the village fire. Nourishment supports healing.
- Cast beside the river or southern lake; press Space when the float gets a bite. The village koi are protected.
- Craft and place cottages, palisades, and lanterns. Choose **Place** in the backpack, face a clear spot, then press Space.
- Momo follows or stays, and his friendship persists. His interaction uses the original `js/pixel-dog.js` unchanged.
- Visit Stillwater at the village pond to open the original `js/pond.js` unchanged in a dedicated iframe. Leaving unloads it.
- Adopt hens, make feed from turnips, and collect eggs. Trade harvests and fish with Ren.
- Recruit guards, survive night creatures, and upgrade to an iron sword. Guards fight and can fall in battle.
- Visit the council or settlement banners. Give harvests to Willow Commune and Amber Reach to form alliances and receive daily tribute. Raid with at least three guards, travel to that settlement, and defeat its five defenders. Victory brings resources and damages relations.
- Follow the field journal's milestones for coin rewards, or wander without objectives.

## Saves

Worlds autosave every 20 seconds of active play, on pause, on hiding the tab, and when leaving. Time pauses in menus and while visiting the interactive pond. Multiple worlds are kept in browser `localStorage` under `hanomi.worlds.v1`. Pausing offers a JSON export; the home screen imports validated world files. Save files include seed, player, inventory, modified resources, crops, structures, adopted hens, pets, guards, relations, and unfinished raids. Browser storage is local, not cloud sync; export before clearing site data.

## Design and performance

`game.js` contains the renderer, procedural artwork, deterministic terrain, simulation, UI, and versioned save contract. Canvas runs at a logical 2× pixel scale. Terrain textures are generated into a bounded LRU cache of 256px chunks. Props use a spatial grid for collision and interaction; visible sprites are culled and depth-sorted. Frame time is capped after stalls, UI updates are throttled, and rendering stops behind menus and hidden tabs. All sprite and terrain art is created once or cached; there are no per-frame image downloads. Reduced motion removes drifting petals. Sound effects are optional and synthesized locally.

This is a **single-player, finite seeded valley** (144 × 144 tiles), with two neighboring settlements. Diplomacy and raids are deliberately small-scale. It has no multiplayer, infinite terrain, complex national economy, or interior dungeon system. Actors use local collision sliding rather than global pathfinding, so dense forests and player-built mazes can obstruct followers. The portfolio's original dog and pond source files remain untouched.

## Verify

From the repository root:

```sh
npm ci
npx playwright install --with-deps chromium
npm run check
npm test
```

The test runner serves the site on an ephemeral local port and uses real Chromium, without engine test hooks. It covers new worlds, movement, saving/resuming, gathering, crafting/placement persistence, farming, fishing timing, original dog/pond integrations, army combat and raid persistence, import/export validation, mobile dialogs, and thumbstick movement. Playwright is a development-only dependency.

To run locally without any Node tooling:

```sh
python3 -m http.server 8000
# Open http://localhost:8000/hanomi/
```
