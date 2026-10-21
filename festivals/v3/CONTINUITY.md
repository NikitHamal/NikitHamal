# festivals/v3 — CONTINUITY (Agent B)

Branch: `agent-b/festivals-v3` (never main). The other agent's festival work (`festivals/film`, `festivals/film3d`, `festivals/out`) is untouched; v3 lives only in `festivals/v3/`.

## Owner brief (2026-10-21)
- Rebuild the Dashain reel: history and culture first, the wish only at the very end. Nepali-only narration and captions.
- Better sound: generated/CC0, no attribution needed. No weak SVG; 3D scenes, plus pixel art only where it is genuinely good.
- Fresh Dashain and Tihar stills.
- Map of Nepal in its 2020 official shape (Lipulekh, Kalapani, Limpiyadhura).
- **Renders on molab (marimo pair) only.** Never render locally. If the sandbox says "terminated", tell the owner.
- At most one subagent. Push often. On `409 …awaiting reimbursement settlement`: push, note the next step, continue elsewhere.

## State
- [x] Cloned; read the v1 (pixel) and v2 (three.js) engines and the contact sheet. v2 weaknesses: flat low-poly look, opens on a kite fight, fragmentary copy, no narration, too many stock SFX.
- [ ] **BLOCKED: no molab URL/token yet.** The owner said they would paste it; it was missing from the message, and I have asked for it.
- [ ] Research + Nepali narration script (`script.md`)
- [ ] Narration (ElevenLabs v3, Nepali), score (ElevenLabs music), SFX (ElevenLabs sound generation)
- [ ] Blender (bpy, Cycles GPU) scene code, Nepali type layer, compositor
- [ ] Render the film on molab; then the stills (5 Dashain + 5 Tihar × 3 sizes)
