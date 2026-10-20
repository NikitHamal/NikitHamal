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

## Current state / open tasks (update me)
- [ ] Kaggle `nik-train-sft3` (queued 2026-10-20 ~12:35 UTC) clones main when it starts, so it trains on augmented phrasing + column math
      (colmath.py) from the live model and runs NikBench before/after. Fetch: `kaggle kernels output iamnikithamal/nik-train-sft3 -p /tmp/sft3 --file-pattern '^out/'`.
- [ ] Kaggle `nik-train-tts2` (TTS v2) running; when done: `kaggle kernels output iamnikithamal/nik-train-tts2 -p /tmp/tts2 --file-pattern '^out/'`,
      compare with v1, publish to `nik/web/tts/` only if clearly better.
- [ ] After any new model: run `eval.py`, `eval_understand.py`, `bench.py` on live vs new; ship only if better; update manifest + this file.
- Kaggle dataset `iamnikithamal/nik-cluster-out` holds the B300 phase-2 models and logs. The owner was asked to rotate the Kaggle token.

## How to push (sandbox without git credentials)
Commit locally, then push the tree via the GitHub API helper (outside the repo):
`python3 -I /tmp/tools/ghpush.py /workspace/NikitHamal NikitHamal/NikitHamal main main && git fetch -q && git reset -q --soft origin/main`.
With normal git credentials, plain `git push origin main` works.
