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

## 2026-10-20 night: v4b shipped (live on /chat)
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
