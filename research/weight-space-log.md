# Weight-Space Programming on nik 0.1 — reconnaissance log

Lead: https://rikiyat.github.io/blog/weight-space-programming/ (frontier LLMs reading/writing weights directly, no gradients).
Subject: the live `nik/web/model/nik-0.1.bin` (v12p), 20.47M stored params, 12 unique blocks x 2 repeats = 24 effective layers,
d=384, 12 heads / 4 KV heads, int8 per-row weights + f32 norms, tied embedding, abacus digit embeddings.

**Verdict (honest): no robust improvement. Two small edits looked good on the dev screen (+3/48), did not replicate on a
288-item untouched test set (0 gain on the hard items, -4 on arithmetic) and were indistinguishable from random edits of
the same form. Negative result; the useful by-products are the tooling, the measured sensitivity map and the error taxonomy.**

## Reproduce
```
python3 research/inspect_weights.py nik/web/model/nik-0.1.bin          # step 1: statistics (output saved in research/inspect_output.txt)
python3 eval/gen_sets.py --seed 7001 --n 8  --out eval/sets/dev_7001_n8.json     # DEV  (144 items; tuning only)
python3 eval/gen_sets.py --seed 9001 --n 16 --out eval/sets/test_9001_n16.json   # TEST (288 items; never used for selection)
python3 research/wsp_search.py                                         # step 3: search (~35 min on 4 cores), log: research/wsp_search_log.jsonl
python3 research/wsp_validate.py --edits research/wsp_best_edits.json --controls 4   # step 4: held-out test + 125-suite + random controls
```
All evaluation runs the real browser engine (`nik/web/nik.js` + WASM-SIMD int8 kernel under Node) via `eval/wasm_runner.mjs`, greedy,
calculator off (`raw` mode = the weights themselves). Edited models are written with `research/nikbin.py` / `wsp_edit.py`
(no gradient, no optimiser; a no-op edit is verified to give byte-identical generations).

## Step 0 — baselines (live model, raw greedy)
| set | arithmetic | word problems | reasoning | total |
|---|---|---|---|---|
| dev (seed 7001, n=8)   | 93/96 | 5/24  | 19/24 | 117/144 |
| test (seed 9001, n=16) | 188/192 | 10/48 | 38/48 | 236/288 |
| 125-item suite (Milestone 1) | exact 12/15, word 4/15 | | | 76/125 (re-run: identical, 0 item differences) |

The fresh sets come from the NikBench generators (`nik/bench.py`; pure-Python item generation, torch stubbed). Caveat: v12p's
training mix included "the word forms NikBench uses", so these are not fully held-out for the *live* model — they are fine for
paired A/B tests of edits, not for claims about generalisation.

## Step 1 — what the weights look like (`research/inspect_output.txt`)
* Norm gains grow ~80x with depth: `n1` mean 0.033 (block 0) -> 2.72 (block 11); final norm mean 2.35. The model is trained with *shared* gains for both repeats of a block.
* Block 0's attention-input gain is ~0.03 (max 0.19): layer-0 attention is almost muted. Hypothesis "this is a bug, restore it" was tested (below): it is load-bearing.
* int8 saturation is tiny everywhere (0.25-0.27% of weights at +-127), per-row scale CV is small -> no obvious quantisation outliers.
* Heavy tails (kurtosis z>1.8 within matrix type): `b9.q` (5.4), `b10.kv`, `b0.o`, `b11.up`, `b11.down` (6.1).
* Per-head o-proj norms: typical 6.5-7.5; outliers b10h3 (10.81), b9h9 (10.32), b10h4 (9.30), b9h8/b9h2 (8.5-8.6).

## Step 2 — causal measurements on the weights (dev screen = 48 hard dev items + 24 arithmetic guard items)
Screen score of the unedited model: word 5/24, reason 19/24, arithmetic guard 23/24 (hard = 24).

| hypothesis / edit | result |
|---|---|
| restore layer-0 attention: `n1` of block 0 x4 / x10 | **model collapses (0/72)** — layer 0 is extremely sensitive; the tiny gain is calibrated, not a bug |
| ablate / halve the 5 largest-norm heads (b10h3, b9h9, b10h4, b9h8, b9h2) | **no change at all** (hard = 24 for every ablation): these heads are redundant for this task family |
| per-repeat residual gates (`rgate`, 24 effective layers, x0.8 and x1.25 each = 48 single edits) | every single edit within 22-26 of 24 (noise band of 48 items is about +-3) |
| greedy composition of the top single edits | best program `rg[6][0]*=0.8, rg[2][1]*=0.8`: dev hard 27 vs 24 |

`rgate` is not new machinery: `nik/model.py` and `nik/web/nik.js` already implement per-repeat residual gates (trained in the
nik-deep experiments). Adding 24 f32 scalars to the container and setting `cfg.rgate=true` is therefore a *pure weight-space edit*
that gives the otherwise weight-shared network 24 independently scalable layers: a 24-number "program" (0.0001% of the file).

## Step 3 — held-out validation (`research/results/wsp_validation.json`)
| model | test arith | test word | test reason | **test total /288** | suite /125 | suite multi-turn |
|---|---|---|---|---|---|---|
| live | 188 | 10 | 38 | **236** | 76 | 10 |
| selected program | 184 | 10 | 38 | **232** | 76 | 13 |
| random control 0 | 186 | 10 | 38 | 234 | 76 | 11 |
| random control 1 | 183 | 12 | 38 | 233 | 71 | 9 |
| random control 2 | 184 | 9 | 37 | 230 | 70 | 9 |
| random control 3 | 188 | 9 | 39 | 236 | **80** | 13 |

Reading: the selected program's dev gain (+3 on 48 items) is a winner's-curse artefact — it was picked as the best of ~70 tried
edits (60 single edits + 11 compositions). On 96 untouched hard items it gains exactly 0; on arithmetic it loses 4. The multi-turn +3 is matched by random control 3
(+3) and the suite total by control 3 (+4 for a random edit!), so single-run differences of +-4 items are noise at this sample size.
**The edit is not shipped.** The protocol (dev / test / suite / random controls) is the main contribution here; any future
"edit helped" claim should pass it.

## Step 4 — by-products
* **int8 activation quantisation costs nothing measurable.** Browser path (int8 weights x int8 per-token activations) vs the float-activation JS path on the same weights: dev 117/144 vs 118/144 (word 5 vs 6; the float path is *not* better by more than 1 item). There is no quantisation loss left to recover by calibration. (Test set not run for the float path: 5x slower, would not change the conclusion.)
* **Error taxonomy of the word-problem failures** (`research/results/word_error_taxonomy.txt`; live model, 72 dev+test word problems, 15 correct, 57 wrong):
  42% contain a *false equation* (`28 - 32 = 6`), 17% use an operand that is not in the question, 39% use grounded numbers in the wrong structure (e.g. `45 / 3` for "3 notebooks cost?"), 2% answer differently from their own last result.
  The 42% is already fixable at inference time — production `/chat` runs the exact calculator (`calc: true`) that `raw` mode disables.
  The 39% is a genuine understanding failure; it is not something a handful of gate scalars can repair.

## Why it failed here (and what the paper's success implies)
The paper's wins come from a *specific loop-like failure* in a large reasoning model (e.g. a repeated-token attractor) that a
frontier model can localise by reading weights. nik's failures are not loops: they are distributed semantic errors in a 20M model
that is already trained to the edge of its capacity (v12p is an SFT'd model with a KL anchor). With one scalar per layer as the
only action space and 72 screening items, the search cannot find (and cannot distinguish from noise) a repair for a
capacity-limited failure. Things not tried that the paper's recipe would suggest: (1) a logit-lens attribution at the operator
token to find the layers that decide `x` vs `/` (needs a JS hook that dumps per-block residuals; ~1 session), (2) editing individual
MLP neurons selected by activation contrast between correct/incorrect operator-choice prompts, (3) an `n_repeat=3` function-preserving depth growth with gates `[1,1,0]`, then *opening* the third pass by search (`wsp_edit.py` can write the gates; whether `nik.js` runs `n_repeat=3` containers correctly is untested).
