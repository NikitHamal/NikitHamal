# Nik — continuity file (read this first)

Anyone (human or AI agent) picking up this project: this file is the single source of truth for
goals, state, decisions, and open tasks. Update it whenever something important changes.

## Owner and goals
- Owner: Nikit Hamal (portfolio repo `NikitHamal/NikitHamal`, GitHub Pages site https://nikit.is-a.dev).
  Timezone Asia/Kathmandu.
- **Nik 0.1**: a tiny LLM built from scratch that speaks romanized Nepali, reasons (think blocks), is strong
  at math, knows about Nikit (persona), and runs fully in the browser at `/chat`. Every reply must be
  model-generated (no if/else preset replies). Size cap: **25 MB** int8.
- **NikTTS**: tiny native-sounding Nepali text-to-speech for `/chat` ("suna" button).
- The owner wants real understanding (not template recall), strong math/reasoning, honest benchmarks.
- Push everything to `main` often (code, data scripts, docs, models, logs).

## Rules the owner set
- Local (sandbox) training runs max ~20 min; big runs go to Kaggle (CLI) or a rented node.
- Never put credentials (Kaggle token, GitHub tokens) in the repo or logs.
- Chat UI: clean, full-width, subtle pixel-art touches; no dog/sky/topbar.
- Don't ship a model unless it beats the live one on the evals below.
- **Other agents push to this same `main` branch (e.g. `festivals/`: festival videos, photos, wish cards). Never delete,
  revert or overwrite their files or commits.** Always `git fetch && git merge --ff-only origin/main` (or rebase) before
  committing, and push only your own changed paths. (2026-10-20: an old full-tree push helper deleted `festivals/` twice;
  the festival agent restored it in 247f5f7. The helper is now diff-based and aborts on conflicts.)

## Layout (all under `nik/`)
- `model.py` NikLM (decoder-only, RMSNorm, RoPE, QK-norm, SwiGLU, GQA, tied emb, weight-shared blocks,
  abacus digit embeddings). Hybrid AR + block-diffusion loss; `--diff-weight 0` = pure AR (now used for SFT/RSI).
- `train.py` (stages pretrain/sft, Muon, EMA, DDP), `prepare.py` (tokenize), `export.py` (int8 .bin "NIK1"),
  `eval.py` (math/persona/ppl), `eval_understand.py` (27 hand-written understanding probes),
  `bench.py` (NikBench: serious held-out math+reasoning benchmark, per-category), `rsi.py` (verified self-improvement).
- `data/teacher/` audited synthetic teacher data: `math_gen.py`, `math2.py`, `reason_gen.py`, `reason2.py`,
  `understand.py`, `understand2.py`, `explain*.py`, `colmath.py` (column-algorithm arithmetic scratchpads),
  `augment.py` (user-side phrasing augmentation), `verify.py` (exact fraction checker of every equation),
  `audit.py`, `build.py` (mixes + audits; any size).
- `scripts/`: `make_sft2.py` (SFT mix builder), `kaggle_launch.sh <mode>` (Kaggle jobs: full, rsiN, tts2, sft3, math4),
  `kaggle_*.py` runners, `cluster_run.sh` + `cluster_phase{2,3,4}.sh` (multi-GPU node), `publish.py`.
- `web/` browser engine (`nik.js`, WASM SIMD int8 kernel, `worker.js`), `web/model/` live model + manifest + logs,
  `web/tts/` live TTS. Chat page: `/chat/index.html`.
- `tts/` NikTTS v1 (live) and v2 (phoneme front-end + flow-matching decoder; training on Kaggle).
- `docs/` ARCHITECTURE, DATA, TRAINING, RESEARCH, IDEAS, CLUSTER.

## History (short)
1. nano/small local models -> Kaggle 10 h run (nik-0.1 v1: math 22.5%, persona 7/7, ppl 22.8).
2. 2026-10-20 rented 8x B300 node: pretrain val ppl 13.7 -> phase-2 SFT (understanding data, pure AR) + RSI:
   math 58% (eval.py), persona 100%, ppl 19.3, held-out RSI acc 82.7%. **This is the live model** (shipped 12:30 UTC).
   Node lost credits at 12:13 UTC; phase 3 (augmented SFT) was lost; the pretrain checkpoint was lost too
   (only the int8 .bin survives; `scripts/kaggle_sft3.py` shows how to turn a .bin back into a training init).
3. Findings: understanding probes 3/26 (vs 25/39 in-distribution) => surface-template overfitting;
   fix = `augment.py` phrasing augmentation. Math: 3-digit addition broken because the training scratchpads
   used size-specific tricks ("das ko thau") => fix = uniform column algorithm (`colmath.py`).

4. NikBench baseline, live model (n=4/category, 72 items): **43.1%** overall: arith 47.9% (add5 0/4, sub3 0/4, div4 0/4), reason 66.7%,
   **multi-step word problems 0/12**. The model doesn't read word problems; it recites the closest training problem with its numbers.
   Fix: `data/teacher/compose.py`: compositional problems (random 2-5 event chains, distractors, steps grounded per sentence),
   after Physics of LMs 2.1 (iGSM). 14% of the mix; colmath 10%.

5. Harness bug (fixed 2026-10-20): SFT batches were random windows over concatenated conversations, so most windows started
   mid-conversation and trained answers whose question was cut off (a direct cause of "answers without reading").
   `train.py Batches` now starts SFT windows at <|bos|>. Every SFT/RSI before this fix had the bug.

6. Flaw hunt with the real browser engine (`node nik/web/test_engine.mjs <bin> <items.json> greedy|browser|vote5`, items from
   `python nik/bench.py --dump items.json --n 6`). Live model on 108 items: greedy 30.6%, chat defaults 34.3%, vote5 31.5%.
   Fixed: repetition penalty hit digits (and compounded per repeat), replies capped at 200 tokens (cut reasoning),
   Devanagari input not understood (now `web/romanize.js`, parity 3003/3003 with the Python romanizer),
   math edge cases added to colmath (zero, negative results, 7-digit, decimal compare, unit facts).
   Found: old chat rows' "bujheko: <canonical intent>" thinks map any question to one of ~120 stored intents = the
   memorisation engine; make_sft2 drops every v1 row that has a think.

## Teacher data (2026-10-20 owner decision)
No external or open-weight teacher models. The coding agent (Claude) is the teacher: hand-written gold conversations in
`nik/data/gold/*.jsonl` (`{"cat","messages":[{role,content,steps?}]}`, `steps` = worked solution, mapped to think),
plus hand-written generators in `nik/data/teacher/`. No subagents (see AGENTS.md).

## NEXT BOX: one command (Claude, 2026-10-23 night)
1. Connect (pair URL + token from the owner), then in the kernel: `git clone https://github.com/NikitHamal/NikitHamal.git
   /tmp/v2/repo`, write the Kaggle token to `~/.kaggle/access_token` (never into the repo).
2. `setsid nohup bash /tmp/v2/repo/nik/agents/molab/jobs/run_v2.sh > /tmp/v2/run.log 2>&1 &` - downloads the data
   (Kaggle nik-p8m-mix, replay, English, nik-selfdistill-1022), builds the v2 mix in ONE pass
   (`nik/scripts/build_mix_v2.py`: k13's recipe + the hand-written data `nik/data/hand/hand.jsonl` at 6% of tokens),
   trains 3 seeds (850 steps, KL 1.0 to m50), gates each, soups them, gates + confirms, uploads all to Kaggle
   `nik-v2-run`. Progress: `/tmp/v2/progress.log`. ~1.5-2 h. Ship only by hand (`scripts/ship_model.py`).
3. Hand-written data (owner's request, 2026-10-22 night): `nik/data/hand/` (STYLE.md, check.py, raw/, hand.jsonl).

## HANDOVER (read first if you are the next Claude) - updated 2026-10-24 ~13:00 UTC (session 4: box, live)
**Now:** owner's molab box (RTX PRO 6000, ~11h50 from 12:04 UTC; the first box of the day was reclaimed after 10 min).
Two GPU lanes run side by side; everything is visible live: the notebook dashboard (`nik/agents/molab/nikdash.py`,
one cell + `mo.ui.refresh`), the public page https://nikit.is-a.dev/lab/ (fed by `nik/agents/molab/live_pusher.py`
from the driving sandbox into the body of issue #12), and new candidates on https://nikit.is-a.dev/chat/?model=preview
(`scripts/preview_model.py`; the default model is still m50).
- **Lane v2** (`jobs/run_v2.sh`, /tmp/v2): last session's plan, hand data 6% with the KL anchor everywhere, 3 seeds +
  soup + gates. v2s14: understanding 21, math 98, RW items 37, everyday 18/60, EN ppl 14, but NO SHIP (nested 218,
  owner 24/25, EN reply 53); on fresh chat prompts it answers word-for-word like m50 (the anchor held it in place).
- **Lane v3** (`jobs/setup_v3.sh` + `jobs/arm.sh` + `jobs/after.sh`, /tmp/v3, outputs /tmp/nik_runs/<tag>): hand rows
  KL-free (`build_mix_v2 --hand-nokl`, mask 2/3), 2% of hand conversations held out (`--hand-holdout 0.02`,
  `scripts/hand_eval.py`). v3s14 (hand 10%, 1500 steps), then v4s14 (hand math/reasoning keep the anchor +
  column rows 8%: the nested-drift fix), v3d (Nik-deep: `--set-repeat 3`, 36 layers from the same 20M params).
- Bins + gate dirs + logs go to private Kaggle `nik-v2-run` every ~3 min (`jobs/saver.sh`; `jobs/restore.sh`).
- Open: English rows are still KL-anchored to m50 (which writes no usable English): `--nokl-src english` is ready.

## HANDOVER (read first if you are the next Claude) - updated 2026-10-24 ~01:30 UTC (session 3: data only, no box)
**Now:** hand-writing teaching data toward 100k+ examples (owner's overnight goal), then build the v2 mix and train
on the next box (`nik/agents/molab/jobs/run_v2.sh`), then the ship gate vs live m50. No box until the owner gives one.
- `nik/data/hand/`: STYLE.md (house style), BRIEF.md (writing-helper brief + checker gotchas), check.py (compiler +
  validator; needs CPU torch installed or the eval guard is incomplete), raw/<writer>/, hand.jsonl.
- Total **36,104 examples, 0 rejects** (b267b7a): math-word 5,763, reasoning 4,779, reading 3,760, translate 3,478,
  instructions 3,282, knowledge 3,062, english 2,269, write 2,164, multiturn 2,042, chat 1,983, advice 1,755,
  honesty 1,624, persona 143 (lead). Writers this session: G reading, H multiturn + honesty, I math-word, J translate
  + instructions, K reasoning, L chat + advice, M (folder m2) knowledge, N english (stopped by an API error), O write,
  P reading + multiturn, Q honesty + memory, R formats + money, T math-word + reasoning (S: API timeout, nothing saved).
  Near-duplicate first turns (3-gram Jaccard >= 0.8, same category): 33 pairs, ~10 real (0.03%).
- **Raw `C:` lines** = context-only Nik turns (never trained), for slips the user corrects. **build_mix_v2 now
  expands hand conversations** into one row per trained Nik turn, history as /chat sends it (no thinks, context only).
  On the box: check `mix.log` for the `hand: N conversations -> M rows` line and the manifest `unique` count; raise
  `--share hand` (via `MIX_ARGS`) so every hand row is seen at least once. Watch the owner-cases gate row.
- Loop: 2 helpers per round, each its own folder, 6-8 files; lead runs the full check, audits reading quotes,
  samples by eye, sweeps spellings, pushes with the running total (`state.json` tracks progress on /agents).
- Owner decisions still open from session 2: card `ship-s13-1022`, `gate-rule-1022b` (see below).

## HANDOVER (session 2) - updated 2026-10-22 ~20:40 UTC (box 1 ended ~20:55)
**Full handover prompt: `nik/agents/HANDOVER.md`.** Live model = **m50 (unchanged)**. Live /chat code improved today
(main): pencil fixes (grouped numbers, signs, clock times), plain digits for `1,200`, consistency vote (m50 held-out chat
71 -> 77), re-ask on empty replies. Box 1 is gone after ~20:55; everything is on private Kaggle (below).

**Best candidate: s13** = (k13 + k13b)/2, md5 619ab4cc (Kaggle `nik-final-1022`). vs m50: RW items 37 vs 25 (16 fixed /
4 broken, p=0.01), math 99 vs 94, everyday 20 vs 6 (/60), traps 27, reading 6, money 19, EN ppl 229 -> 12.4, smoke 4/4,
**fresh items 865 vs 855** (`confirm.sh`). Loses: understanding 17 vs 19 (honest "not told" -> invented father's name,
"sunita ... bahini engineer", "we are reading" -> "uni padhdai chhin"), nested 220 vs 222, owner cases 24/25 vs 25.
k13 (md5 47629680, Kaggle `nik-k13-bin`): fresh 859 vs 855, smoke 4/4. k13b: owner cases 25/25 but und 16.
**k13c** (seed 16 of k13's recipe, 850 steps) was trained in the box's last minutes and is **UNGATED** (Kaggle
`nik-k13c-bin`): next session, gate it and try the 3-way soup (k13 + k13b + k13c)/3 before training anything new.
**Owner decision pending:** card `ship-s13-1022` (keep live and fix understanding / ship s13 / ship k13) and the older
`gate-rule-1022b`. To ship s13: `python nik/scripts/ship_model.py --bin s13.bin --tag s13 --prev-tag m50 --gate
gate_s13 --live-gate gate_live ...` (gate dirs in `gates_final.tgz` on `nik-final-1022`), push, DECISION in #11.

**Recipe (from m50, KL 1.0 to m50, 850 steps, Muon lr 1e-4, bs 128 x accum 2, seq 512, diffusion 0.3):** mix p8mxs =
p8mx (k2) + multiturn/needles + everyday 3% + colrows 4% + money1 2% + lookup 2.5% + mention 1.5%, repaired by
`fix_mix.py`, hand-written follow-ups replaced by the live model's own (`web/selfdistill.mjs`, Kaggle
`nik-selfdistill-1022`). Jobs: `nik/agents/molab/jobs/queue_k13.sh`, `queue_k13s.sh`.

**Next session, in order:** (1) owner's answer -> ship or not; (2) if not: held-out data for the 3 understanding items,
keep the self-distilled follow-ups, then seeds + soup + `confirm.sh`; (3) self-distill (the live model's own outputs,
kept if verified) any other behaviour a polish erodes; (4) harness: `generate_ar` step cap (`6799701`).

## Session context - 2026-10-21 ~16:45 UTC (new Claude session; covers Claude's + Sky's roles)
- **Live: m50** = 0.5·v4r2 + 0.5·v4r3 (same-parent blend, both v4f + reduce.py 25-30%). Paired vs v4f: NikBench plain 72.6% (72.2),
  nested 77.1% (75.0), ladder L2 0 -> 12/12, understanding 19/26 (13), traps 9 (9), math 94% (96). Rollback: nik/web/model/nik-0.1.v4f.bin.
  Logs nik/web/model/logs/m50/. Runner-up: Local-C p8 (PR #10, tied; traps 8). Candidates are on Kaggle `iamnikithamal/nik-candidates-2026-10-21`
  (m50, p8, v4r3; private).
- **Boxes die often (410).** Three boxes were lost today. Keep every candidate .bin off the box as soon as it is gated (sandbox + Kaggle dataset).
  Box-to-box: relay through the sandbox (`marimo /api/kernel/execute`, 700 KB base64 reads, 3 MB writes, md5 both ends).
- `MULTITURN_SHARE` stays 0: two box runs (v4r2m, v4r6) show it costs reason next to reduce (37 -> 35, 39 -> 30).

## Session context (update every session) - 2026-10-21 ~05:50 UTC
- **Live:** v4f (shipped 2026-10-21 on the owner's call over the understanding gate: NikBench 72.2%, reason 39/48, word 6/48, traps 9/12, understanding 13/26). Rollback: nik/web/model/nik-0.1.v4c.bin.
- **Boxes (molab only, never Kaggle):** box 1 runs LLM jobs via `nik/scripts/molab_run.sh`-style scripts, dashboard auto-detects runs
  + scoreboard vs live; box 2 runs Nik-Decide (`nik/decide/`) and corpus_v2 (`/tmp/corpus_v2`, audit running). Boxes expire;
  the owner provides new URL+token; local agents are watch-only.
- **Shipped 2026-10-21:** `/decide` (https://nikit.is-a.dev/decide): Nik-Decide v3 in the browser (nik/web/decide.js, decide-v3.bin).
- **In flight:** GRPO v2 runs v4j (box 2, lr 3e-6) and v4k (box 1, lr 1e-5) from live v4c; corpus_v2 audit pass 2 on the kept corpus (box 2).
- **Next:** if corpus_v2 audit passes -> tokenise as the replay/pretrain base on the box, re-run the best recipe on it
  (fixes the understanding drop); then Nik-Hard (Local-A) as the main gate; Nik-Decide yes/no fix; GRPO on verifiable tasks.
- **Read `nik/docs/LEARNINGS.md`** before planning: findings, mistakes, numbers.

## Rule (2026-10-21): molab only, never Kaggle. If molab is down, tell the owner and wait for new keys.

## 2026-10-20 late night: v4c shipped (live on /chat), multi-agent team
- **Live: v4c** = v4b + 15 min SFT on sft7 (Grounded Ledger 4%, grounded read.py, weekday ordinal). Paired McNemar vs v4b (288 items):
  reasoning +12.5 pp (p=0.031); understanding 19/26 (16), stress 64/103 (59), chat 15/15, persona 1.0, math 94.5%. Word problems still ~0/48.
  Logs: nik/web/model/logs/v4c (incl. compare.txt). Previous: nik-0.1.v4b.bin, nik-0.1.v4.bin, nik-0.1.b300.bin.
- Team (issue #9 design review, #8 coordination): Claude (molab GPU, merges, shipping), Codex (reading/grounding), Local-A Qoder (ledger.py,
  compare.py, bench_ledger.py, ledger-engine guard branch), Local-C MiniMax (model_budget.py, bench_latency.mjs, quant_probe.py, frame.py,
  iter.py, mix_budget.py). Decisions by paired evals (compare.py), gates: understanding, stress, chat_check, persona, NikBench/math within 2 pp.
- Ablation (300M tokens, sft6): arm A (20M from scratch) = NikBench 61.1%, understanding 17/26 => the data mix matters more than size so far.
  Ternary (BitLinear, nik-0.2t) is implemented but parked until a token-matched capacity test; browser cost measured 3.4-4x slower.
- molab box was recycled once (old URL 410): all /tmp state is lost when that happens; keep results in the repo / Kaggle dataset nik-ship.
- Never `pkill -f` with a pattern that also matches your own command (it froze the notebook kernel once).
- TTS: Kyutai Pocket TTS v3 has an official new-language fine-tuning recipe (finetune_language.yaml); Nepali data: OpenSLR 43 (2.3 h) +
  OpenSLR 54 (~160 h). Phonon (gradium) has no training code and its browser runtime (xn) loads only its own checkpoints. Open TTS track in #9.

## 2026-10-20 night: v4b shipped
- v4b = v4 + 40 min balanced SFT on sft6: NikBench 66.0% (82/96 arith, 2/24 word, 11/24 reason), understanding **16/26** (v4: 4/26),
  eval.py math 95.5%, persona 1.0, chat_check 15/15, stress.py strict **59/103** (v4: 38), browser engine greedy 22/36 (v4 19, B300 13).
  Previous: nik-0.1.v4.bin, nik-0.1.b300.bin. Logs nik/web/model/logs/v4b/. Leak check: chat.py/write.py user turns vs probes ->
  only the setup turn of one memory probe is similar (food preference), never a scored question.
- RSI on v4b running on molab (nik/runs/v4brsi); ship only if it beats v4b.
- Next targets: word problems (0-2/24: regressed during v4 pre-training after step 7k, likely compose.py surface memorisation),
  reasoning 11/24, reading 4/10, translation 5/10. Next mix sft7: fixed read.py (Codex), more word problems with varied prose.

## 2026-10-20 evening (Claude, workspace-50): v4 shipped
- **Live on /chat: v4** (instruction pre-training from scratch, `run_v4.py`, 150 min on molab): NikBench 63.2% (was 39.6%),
  eval.py math 93.5% (57%), understanding 5/26 (3/26), chat_check 15/15 (11/15), stress.py 38/103 (24/103), persona 0.86 (1.0).
  Previous model: `nik/web/model/nik-0.1.b300.bin`. Logs: `nik/web/model/logs/v4/`.
- Lessons: (1) EMA 0.999 without warmup kept random init -> garbage samples/ckpts (fixed: EMA warmup). (2) Cutting everyday chat to
  ~1% made greetings trigger looping math scratchpads (fixed: `chat.py`, `chat_check.py` gate). (3) Writing requests drift into news
  text without writing data (`write.py`). (4) Verified arithmetic must check *completed* equations, not force at the first "="
  (`calc.py` v2: +1 pt; v1 cost 4 pts). (5) Don't run data builds + evals beside a training run: host OOM killed the run at 144/150 min.
- Running: **v4b** = v4 + 40 min balanced SFT (`sft6`: 30% chat.py, 6% write.py, read.py, skills.py, gold x40) + RSI, out `/tmp/nik_out4b/`
  on molab. Ship if it beats v4 on NikBench + understanding + chat_check + stress.py.
- Tools: `nik/stress.py` (120 prompts), `nik/chat_check.py`, `nik/scripts/live_eval.py`, `nik/calc.py` (+ /chat "exact arithmetic").
- Moving files molab -> repo: upload a Kaggle dataset from molab (`iamnikithamal/nik-ship`), download with `kaggle datasets download -f`.
- Other agents: coordinate in GitHub issue #8. **Codex (GPT-6, "Agent C")** joined 2026-10-20 18:10 UTC: found + fixed a read.py
  grounding bug (543/100k rows asserted an unstated weekday), added `nik/data/teacher/grounding.py` (wired into audit.py for read-*),
  strict read scoring in stress.py (`nik/read_scoring.py`, `--category`), tests in `nik/tests/`, report `nik/reports/reading-codex/`.
  Merged to main (f67f7b4) after Claude's review. Strict CPU baseline of live v4: stress read 0/10, understanding 4/26.

## Current state / open tasks (update me)
- [ ] **v4 on molab (running since 2026-10-20 ~15:05 UTC, driven by Claude via marimo pair)**: `nik/scripts/run_v4.py --bs 256
      --pre-min 150 --sft-min 25 --rsi-min 30`: instruction pre-training FROM SCRATCH (55% corpus + 45% conversations incl.
      gold x16, user-token loss 0.1), then SFT (+0.3 diffusion so SSBD keeps working), then RSI. Out: `/tmp/nik_out4/` on the
      molab box (`summary.json`, bins, logs). bs 256 + compile = ~300k tok/s, 54 GB VRAM. v3 (SFT on the live model) was
      stopped at 37 min: same memorising base, samples still wrong, and it halved v4's GPU share.
      Notebook: `nik/notebooks/nik_molab.py` (pipeline picker, detached runs, live log).
      Mid-run v4 snapshots (NikBench n=8): 32 min 66.7% (arith 81/96, word 5/24, reason 10/24), understanding 6/26;
      59 min 66.7%, understanding 4/26 (live: 39.6%, 3/26). Math up a lot; reading/translation still weak.
- [ ] **v5 queued on molab** (`/tmp/chain_v5.sh` starts it when v4 ends): `run_v4.py --data-name sft5 --tag v5 --sched wsd
      --pre-min 180`, out `/tmp/nik_out5/`. sft5 = teacher v5 (read.py reading worlds 14%, skills.py 10%, 2.29M unique rows)
      + 549 gold x16. Compare v4 vs v5 vs live; ship the best only if it beats live.
- [ ] Kaggle `nik-train-sft3` (queued 2026-10-20 ~12:35 UTC) clones main when it starts, so it trains on augmented phrasing + column math
      (colmath.py) from the live model and runs NikBench before/after. Fetch: `kaggle kernels output iamnikithamal/nik-train-sft3 -p /tmp/sft3 --file-pattern '^out/'`.
- [x] TTS v2 shipped 2026-10-20 (native Nepali phonemes + 60k lexicon, OT-CFM decoder 10 steps, vocoder fine-tune; 9.9 MB;
      3 s of speech in 0.12 s on CPU). v1 archived in `nik/web/tts/v1/` (to roll back, copy its files up one level).
      Automatic ASR scoring was not possible (transcription API returned 402); the owner checks `nik/web/tts/samples/` by ear.
- [ ] After any new model: run `eval.py`, `eval_understand.py`, `bench.py` on live vs new; ship only if better; update manifest + this file.
- Kaggle dataset `iamnikithamal/nik-cluster-out` holds the B300 phase-2 models and logs. The owner was asked to rotate the Kaggle token.

## How to push (sandbox without git credentials)
`git fetch -q && git merge --ff-only origin/main` first, commit, then push via the GitHub API helper (outside the repo;
it uploads only the paths your local commits changed since the merge-base, on top of the current remote head, and aborts
if another agent changed the same path):
`python3 -I /tmp/tools/ghpush.py /workspace/NikitHamal NikitHamal/NikitHamal main main && git fetch -q && git reset -q --soft origin/main`.
With normal git credentials, plain `git push origin main` works.
