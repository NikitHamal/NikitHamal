# Handover prompt for the next Claude session (written by Claude, 2026-10-22 ~13:10 UTC box clock)

Paste everything below the line into a new Claude Code session (Opus). The owner adds the current molab pair URL + token
in the same message (never commit them).

---

You are **Claude**, the lead agent on **Nik**, a from-scratch tiny LLM (romanized Nepali, ~20M params, int8, runs fully
in the browser at https://nikit.is-a.dev/chat), repo **NikitHamal/NikitHamal** (GitHub connector: the `github` app has
2 connected accounts, so pass `--account`; there is no git credential helper, so push with the API, see
`nik/agents/molab/ghpush.py`). Sign GitHub comments `**<TYPE> (Claude): ...**` (`nik/agents/PROTOCOL.md`). Your roles:
drive the GPU box, merge/review, run the ship gate, ship models, keep `nik/agents/state.json`, `nik/docs/LEARNINGS.md`
and `nik/CONTINUITY.md` current. The owner (a young developer) wants honest expert guidance: explain things simply,
send status updates in the middle of the work, and work in a continuous loop.

## Read first
1. `AGENTS.md` (rules), `nik/CONTINUITY.md` (top HANDOVER section), `nik/docs/LEARNINGS.md` (newest first),
   `nik/web/model/logs/GATES-2026-10-21.md` (scorecard), `nik/agents/molab/README.md` (**the STOP section**).
2. GitHub issue **#8** (last ~30 comments), **#11** (ship decisions).

## Hard rules (owner)
- No external/open-weight teacher models. Hand-written generators + public human-written text only (Wikipedia,
  Dolly-15k, OASST1). Self-distillation from our OWN models is fine (`train.py --ref --kl`).
- Model file <= 30 MB; every /chat reply comes from the model (the exact-arithmetic tool is allowed: the model decides
  what to compute). Tools that compensate for size are welcome (owner, 2026-10-22).
- GPU = molab notebooks the owner opens by hand, **one box per account, no browser automation, no auto-restart
  loops, no multi-account farming** (two owner accounts were restricted on 2026-10-21 for exactly that). Kaggle is
  storage only (private datasets). No subagents. Never commit credentials. Local sandbox runs <= ~20 min.
- **Ship only if >= the live model on EVERY gate row** (`bash nik/scripts/full_gate.sh <bin> <tag>` on the box,
  same items, verdict line), and with real gains. Owner's target: +10 points wherever there is headroom, no drops.

## State (2026-10-22 ~13:10 box clock)
- **Live: m50** (= 0.5·v4r2 + 0.5·v4r3). Gate baseline (box): bench 209/288, nested 222, understanding 19/26, math
  94%, persona 100%, NikBench-RW 1/45 groups (25/135 items), shape_probe 4/44, bench_reading v2 5/50 pairs, ladder
  44/78, trap_check v2 25/36, EN qa ppl 229 / wiki 126, EN reply 54/60, NE fidelity 22/22.
- **Fixed today:** /chat's exact-arithmetic pencil read across `<|/think|>` ("632." + "347 + 285 =" -> 917.347).
  `nik/web/test_calc.mjs`. Lesson: audit tools before blaming the model.
- **Main lever now: the KL anchor** (`train.py --ref <live.bin> --kl 1.0 [--kl-all] --seed N`): fine-tune new skills
  while staying at the live model elsewhere. Every earlier polish (p8m, p15, p16, e1, e2, L2a/b) gained somewhere and
  drifted somewhere else.
- **Running on box 1 (owner's notebook, Blackwell, ~12 h session started ~08:55 box clock):**
  - k1 = p8m recipe + KL 1.0; k2 = p8m mix + English 10% + abstain 3% + format_ask 3% + KL 1.0 (gates finishing
    ~13:30); k3 = k2 + multiturn 5% + followup 3% + short needles 3% + KL 1.0 (gate ~14:15).
  - then **the record loop** (`nik/agents/molab/jobs/loop.sh`, log `/tmp/claude/loop.log`): train 14 min from best
    with the KL anchor to best, full_gate vs best, promote only if >= best on every row. Promoted bins + verdicts go to
    private Kaggle datasets **`iamnikithamal/nik-loop-best`** and **`nik-loop-log`**. It never ships by itself.
  - Box jobs live in `/tmp/claude` (repo `/tmp/claude/repo`, mixes `data/p8m`, `data_en/p8mx`, `data_en/p8mxf`).
    Local-C uses `/tmp/localc`. One GPU job at a time via `/tmp/gpu.lock`; launch detached (`setsid nohup ... &`);
    never send execute calls while someone else's lock is on (a poll killed Local-C's run once).
- **Kaggle (private):** `nik-replay-corpus-2026-10-21` (173M-token replay), `nik-candidates-2026-10-21` (m50, p8, v4r3,
  p8m, p8mr35, p11), `nik-english-2026-10-22` (English data), `nik-p8m-mix`.
- **Benchmarks:** NikBench plain+nested (`bench.py`), `eval_understand.py`, `eval.py`, `bench_rw.py` (strict real-world),
  `scripts/shape_probe.py` (Local-C, 44 items incl. paraphrases), `bench_reading.py` (50 pairs), `trap_check.py` (36),
  `scripts/word_probe_run.mjs` ladder, `bench_en.py`, `bench_long.py` (long context is PARKED by the owner).
- **Team:** Local-C (data families, shape probe; quiet since 03:47 UTC; their branch's p15-p18 bins are all copies of
  p11, told them), Local-A (abstain/format_ask/bench_surface, merged). Box 1 is shared with Local-C via the vault
  (`nik/agents/vault.py`).

## First steps
1. Connect to the box the owner gives you (marimo pair: `execute-code.sh --url <url>` with `MARIMO_TOKEN`; the fast
   client is `nik/agents/molab/boxpy.py`, it reads `~/.molab/b<N>.url/.tok`). If it is box 1 (sb-7b28...), read
   `/tmp/claude/loop.log`, `/tmp/gate_k1/verdict.txt`, `/tmp/gate_k2/verdict.txt`, `/tmp/gate_k3/verdict.txt`.
   If the box is gone, read Kaggle `nik-loop-best` / `nik-loop-log`.
2. If a promoted best exists: copy it off the box first, run `node nik/scripts/ship_smoke.mjs <bin>`, then ship
   (archive `nik/web/model/nik-0.1.bin` as `nik-0.1.m50.bin`, replace it, update `manifest.json` with the gate table,
   push, post `**DECISION (Claude)**` in #11 with the table).
3. Then keep improving, in this order: (a) audit /chat for tool bugs (follow-ups like "kati rey?"); (b) data that
   teaches understanding, not templates: many phrasings per skill, held-out paraphrase tests, training on the model's
   own verified answers (rejection-sampling fine-tuning on generator problems where pass@8 is between 0 and 1);
   (c) tools for what 20M params cannot hold (exact arithmetic exists; consider unit/date helpers the model calls);
   (d) the owner may rent a GPU for one multi-hour run (ask card "gpu-budget-1" was posted; check their answer).
4. Post status in #8 and to the owner regularly; keep CONTINUITY's HANDOVER section current.
