# Nik: learnings, findings and mistakes (keep appending; newest first)

Each entry: what we tried, the evidence (numbers, commit, run), and what we concluded. Scores are paired on the same
288 NikBench items (`--n 16`) vs the live model unless noted. Gates: understanding probes, stress (strict), chat_check,
persona, trap_check, NikBench/math within 2 pp, strictly better somewhere.

## 2026-10-21 (molab boxes, Claude + Local-A + Local-C)

### Findings
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

- **v4h** (v4f + sft11: correct.py, composed chat, varied answer sentences): NikBench 68.4% (+5.9 vs v4c, 19/2, p<0.001),
  word 6/48 (6/0, p=0.031), traps 9/12, math 95.5%, but understanding 15/26 and stress 59 -> not shipped. Same base-data
  pattern as v4g. Next: v5 from scratch on corpus_v2 (box 2) and GRPO from live v4c anchored by KL (v4i, box 1).

### Mistakes (do not repeat)
- `pkill -f <pattern>` matched the shell running the pkill itself -> suspended shell -> frozen notebook kernel -> box lost.
  Use exact PIDs (`pgrep` then `kill`), never a pattern that also occurs in your own command line.
- Data builds + evals beside a training run on one box -> host OOM killed the run at 144/150 min.
- Results only on a molab box are lost when the box expires (410). Copy logs/JSONs into the repo as soon as they exist;
  checkpoint every 2000 steps.
- Comparing runs evaluated on different item sets (n=8 vs n=16) is not a paired comparison (ship_gate now says CANNOT DECIDE).
- 10% ledger rows = 32% of SFT tokens (rows are 3x longer): measure token share, not row share (`mix_budget.py`).
- A generator whose rows all fail the audit looks like a normal pass-rate in the build log (frame.py `steps` vs `think`).
  Every new generator posts `audit.py` kept/total on its own rows.

## 2026-10-20 (v4 -> v4c)
- Instruction pre-training from scratch (v4) beat the B300 model: NikBench 39.6 -> 63.2%, math 57 -> 93.5%.
- EMA 0.999 without warmup kept ~13% random init at step 2k -> garbage samples. Fixed with EMA warmup.
- Cutting everyday chat to ~1% made greetings trigger looping math scratchpads. chat.py + chat_check gate.
- Writing requests drifted into news text without writing data. write.py.
- Verified arithmetic must check completed equations (calc.py v2); forcing digits at the first "=" cost 4 pts.
- Arm A (20M from scratch, 300M tokens, sft6) matched v4b on understanding: the mix matters more than size so far.
