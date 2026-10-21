# Nik: learnings, findings and mistakes (keep appending; newest first)

Each entry: what we tried, the evidence (numbers, commit, run), and what we concluded. Scores are paired on the same
288 NikBench items (`--n 16`) vs the live model unless noted. Gates: understanding probes, stress (strict), chat_check,
persona, trap_check, NikBench/math within 2 pp, strictly better somewhere.

## 2026-10-21 (molab boxes, Claude + Local-A + Local-C)

### Findings

- **v4f shipped on the owner's call (07:45 UTC).** NikBench 72.2% vs v4c 62.5%, reason 39/48, word 6/48, traps 9/12,
  chat 15/15, but understanding 13/26 (v4c 19). The gate said no; the owner weighed reasoning + traps over the probes.
  Rollback file: `nik/web/model/nik-0.1.v4c.bin`.
- **GRPO on v4c does nothing at either lr.** v4j (lr 3e-6, 304 steps) NikBench 180/288 = live exactly; v4k (lr 1e-5,
  440 steps) 181/288. Ladder L2 0/12 for v4j, same as live. Only 0-6 of 32 groups carry signal per step: the model is
  either always right or always wrong on a problem, so a final-answer reward has almost nothing to push on. A next RL
  attempt needs a per-step reward, not more steps.
- **Stop the v4x fine-tune series.** v4d-v4k (8 runs) traded understanding for reasoning or did nothing. The levers
  left are the base (v5 from scratch on corpus_v2, box 2; v5w = 14 unique blocks, box 1) and the procedure itself.
- **The understanding drop after v4c comes from the base data, not the new generators.** Control run v4g = live v4c +
  v4c's own sft7 recipe (no frame/iter/names) on the rebuilt box data: understanding **15/26** (v4c 19), traps 2/12.
  Every fine-tune since the Kaggle data was dropped lost understanding (v4d 16, v4e 14, v4f 13, v4g 15). The box data
  differs in two ways: 96M-token replay corpus (the Kaggle one was 528M) and regenerated v1 chat rows. Fix: the audited
  corpus_v2 (Wikipedia + 14 Sakonii shards, ~880M tokens before dedup) as the base.
- **frame.py + iter.py (Local-C) are the first data to move word problems off zero.** v4d (sft8): NikBench 62.5 -> 68.8%
  (21 fixed / 3 broken, p<0.001), word 0 -> 5/48, reason 27 -> 33/48. v4f (v4d + names, gold x20, cap 100): NikBench
  72.2%, reason 39/48, word 6/48, math 96%, traps 9/12, but understanding 13/26 -> not shipped.
- **Keyword -> stored reply ("mero naam nikit ho" -> Nikit's biography).** Cause: "nikit" appeared almost only in persona
  rows; gold rows repeated 40x; small reply banks. Gate `nik/trap_check.py` (live v4c 5/12). Fixes: `names.py` (names as
  the user/friend/character), `--max-same-reply` cap, composed chat replies (27.5k distinct per 100k rows).
- **One fixed answer template leaks.** compose.py answered every word problem with "antya ma X hunchha"; v4f then
  answered "500 - 180 baki?" with "antya ma 500 rupiya hunchha" (no computation). Answer sentences now follow the question.
- **A reply cap that is too strict starves chat.** `--max-same-reply 30` removed 384k rows (most from chat.py's small
  banks). Cap 100 + composed replies instead.
- **Nik-Decide (non-autoregressive decision model, 5.3M):** v1 intent 100%, read-unknown 100%, lookup 90%, math-verify
  81.7%, **yes/no 49% (chance)**. v2 (claim/passage segments) identical, yes/no still 49%. A lexical heuristic gets 99.4%
  on the same rows, so the labels are fine. **v3 fixed it: yes/no 99.5%** (lookup 91.9%) by putting the claimed value into
  the options (`ho, <v>` / `haina, <v> haina`): with value-free options the deciding bit had to flow through the pooled
  question vector and never did; with the value in the option span, the option can attend to the passage (as in lookup).
- **Speculative decoding (DeepInfer DSpark, EAGLE-4) does not help Nik:** our WASM engine is compute-bound on CPU, so
  verifying k drafted tokens costs ~k passes. Nik already runs ~110-180 tok/s. Quality, not speed, is the bottleneck.
- **The 20M LLM is at a local optimum: every behavior SFT fixes identity and costs understanding/reason (Local-A).**
  la-b2 (55% pairs/15% identity, 2 epochs at 8.5e-4): hard bench 24 -> 34/73, identity **10 -> 19/20**, but reason
  -16.7pp (p=0.039), understanding 16/26, stress 57/103. la-b3 (20% pairs/10% identity/45% chat, lr 1.4e-4): identity
  **18/20**, persona 100, math 94.5%, chat 15/15, but understanding 15/26 and NikBench 59.7%. Weight soups v4c/la-b3 at
  0.5/0.7: identity 12-14/20, understanding 16/15. Conclusion: capacity reallocation, not a surface problem; do not ship
  an SFT candidate without the full gate. The identity fix itself is real and survives a 10% dose on unseen variants.
- **Leak audit of the new generators (Local-A, 5k rows each, exact + 8-gram against every eval set).** Three real leaks:
  (1) `vocab.py` generates the **exact** understanding probe `"river" lai nepali ma k bhanchha?` with gold `nadi` (it is
  in `EN_Q` x `PAIRS`), so that probe is no longer held out; also `khusi` maps to both `happy` and `happiness`, so the
  NE-direction question has two golds. (2) `chat.py` contains 4 exact `chat_check` prompts (`namaste! k chha?`,
  `malai momo dherai man parchha`, `k gardai chhau?`, `subha ratri`) - the sanity gate is no longer clean. (3) `names.py`
  generates `mero naam nikit ho` and `mero naam k ho?`, both of which are in `bench_hard.py` (the first is the intentional
  seen item; the pair `mero naam nikit ho. mero sathi ko naam ram ho.` -> `mero naam k ho?` is now half-trained). Fix the
  generators, not the gates: drop the exact eval strings / duplicate pair, or reserve a held-out variant.
- **`correct.py` is correct (Local-A, 5,000 rows).** Every `correct-now`/`correct-fix` answer contains the latest value
  and no old value leaks; 3,973/5,000 unique user threads; 0 formatting defects. The eval memory probe wording is not
  generated. `butwal -> lalitpur` co-occurs ~7/200,000 rows (both are in `L.PLACES`); exclude that pair if the probe
  must be strictly held out.
- **`names.py` does not teach "most recent name wins" (Local-A).** There is one name per row and no rename, and the
  follow-up only fires on the exact name question; the honest probe (`mero buwa ko naam k ho?`) asks a different slot and
  passed in la-b2/la-b3. No evidence of harm to the memory probes.
- **`reading_contrast.py` is SFT pair data, not pretraining corpus (Local-A).** 5,000 pairs = 10,000 rows, **0 audit
  failures**, 3,421 unique user texts, **5,000/5,000 pairs with different answers**, 1,503 user-intro rows with **0 bio
  answers**; 55% identity pairs / 45% general reading. Do not feed it to the 880M-token corpus_v2 pretraining run - use
  it in the SFT mix (`behavior_mix.py` already separates reading from identity).
- **`bench_hard.py` (Nik-Hard) status:** 73 items; live v4c **24/73** (identity 10/20, pairs 1/12, math 1/15, reason 6/10,
  reading 1/8, open 5/8); la-b2 34/73; la-b3 30/73. The identity item `mero naam nikit ho` and one half of a pair are now
  trained by `names.py`; use the unseen items only for a clean headline.

- **v4h** (v4f + sft11: correct.py, composed chat, varied answer sentences): NikBench 68.4% (+5.9 vs v4c, 19/2, p<0.001),
  word 6/48 (6/0, p=0.031), traps 9/12, math 95.5%, but understanding 15/26 and stress 59 -> not shipped. Same base-data
  pattern as v4g. Next: v5 from scratch on corpus_v2 (box 2) and GRPO from live v4c anchored by KL (v4i, box 1).

- **Nik-Decide in the browser**: `nik/web/decide.js` reproduces PyTorch logits exactly (0.0000 on the parity set); plain JS
  takes 0.2-0.5 s per decision (WASM-SIMD int8 port would bring it under ~50 ms). Router: `mero naam nikit ho` -> chat,
  `nikit ko ho?` -> persona, both at confidence 1.000.
- **GRPO needs mixed groups.** v4i (fixed difficulty, G=8): only 2-3 of 16 problem groups per step had any reward variance
  (all-correct or all-wrong groups give zero advantage). Adaptive per-skill difficulty (target 20-80% correct) + G=12 added.

- **corpus_v2 audit, pass 1: FAIL (as designed) on the INPUT.** 6.62M docs in -> **4.77M kept, ~473M tokens**; dup rate
  28% (1.73M exact + 122k near duplicates, mostly re-published news) > 5% limit; **47 docs contaminated** with eval text.
  Both groups are excluded from the kept output (`corpus_audit.py` skips them before writing). v5 refused to start, as it
  should. Pass 2 audits the KEPT corpus itself (expect 0% dup, 0 contamination) before anything trains on it.
  Lesson: a dup-rate gate measures the source; a second pass on the output is what proves the corpus is clean.

- **GRPO v1 (v4i, 30 min, B16 G8, lr 3e-6, fixed difficulty): no effect at all**: v4i = v4c on every gate (NikBench 62.5% with
  identical category counts, understanding 19, stress 64, traps 5/12). ~80 groups with signal in 30 min is too little.
- **Batched GRPO without a KV cache was slower** (1.6 min/step for 384 sequences: full recompute per token + per-row masks block
  the fast SDPA path). With KV-cached `generate_multi`: **0.14 min/step (11x)**, and adaptive difficulty gives 6-8 of 32 groups
  with signal; levels climb (div 6, compose 6, word 5) as the policy improves.

- **Nik-Hard paraphrase (new strict gate, `nik/hard/paraphrase.py`):** live v4c solves **1/12 items in all 5 phrasings**,
  17/60 phrasings. It computes `640 - 275 = 365` when asked bare and fails the same problem as a story; `cycle kasle kinyo?`
  is wrong in all 5 phrasings; English inputs are mostly garbled. This is the honest picture of how template-bound Nik is.

### Mistakes (do not repeat)

- **Audit pass 2 audited the wrong file.** It ran on `corpus_work/roman` (the raw input) again, not the kept
  `corpus_v2.jsonl`, so it re-reported the input's 28% dups and wasted ~60 min. The kept-output audit now runs beside v5.
- **Too many small fine-tunes in a row.** Eight v4x runs after v4c each tested a small mix change and none shipped. One
  negative result should have ended the series; the base-data problem was already known after v4g (control run).
- `pkill -f <pattern>` matched the shell running the pkill itself -> suspended shell -> frozen notebook kernel -> box lost.
  Use exact PIDs (`pgrep` then `kill`), never a pattern that also occurs in your own command line.
- Data builds + evals beside a training run on one box -> host OOM killed the run at 144/150 min.
- Results only on a molab box are lost when the box expires (410). Copy logs/JSONs into the repo as soon as they exist;
  checkpoint every 2000 steps.
- Comparing runs evaluated on different item sets (n=8 vs n=16) is not a paired comparison (ship_gate now says CANNOT DECIDE).
- 10% ledger rows = 32% of SFT tokens (rows are 3x longer): measure token share, not row share (`mix_budget.py`).
- A generator whose rows all fail the audit looks like a normal pass-rate in the build log (frame.py `steps` vs `think`).
  Every new generator posts `audit.py` kept/total on its own rows.
- A behavior SFT at 8.5e-4 for 5+ epochs turns the most frequent long answer into the default reply (Local-A la-b1:
  `khusi kasari hune?` -> Nikit bio). Cap behavior runs at ~2 epochs and print a general-chat probe at the end.
- I authored `nikit ko email? -> thaha chhaina` from memory; it contradicted the known public email and cost the persona
  gate (Local-A). Copy canonical public facts from the existing gold, never from memory.
- `pkill -f` again: it matched my own shell command and the kill never reached the trainer (Local-A). Use `/proc/<pid>/cwd`
  to identify your own processes, then `os.kill(pid)`.
- "Separate segment" is not "able to compare" (Local-A): the claim-as-extra-segment A/B scored 54.5% vs 64.5% for the
  baseline; the fix that worked was putting the claimed value in the options (v3). Test the mechanism, not the shape.

## 2026-10-20 (v4 -> v4c)
- Instruction pre-training from scratch (v4) beat the B300 model: NikBench 39.6 -> 63.2%, math 57 -> 93.5%.
- EMA 0.999 without warmup kept ~13% random init at step 2k -> garbage samples. Fixed with EMA warmup.
- Cutting everyday chat to ~1% made greetings trigger looping math scratchpads. chat.py + chat_check gate.
- Writing requests drifted into news text without writing data. write.py.
- Verified arithmetic must check completed equations (calc.py v2); forcing digits at the first "=" cost 4 pts.
- Arm A (20M from scratch, 300M tokens, sft6) matched v4b on understanding: the mix matters more than size so far.
