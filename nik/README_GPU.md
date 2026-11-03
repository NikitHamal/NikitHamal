# Training Nik on one consumer GPU (RTX 3060 / 3090 / 4090)

Everything here is runnable today; what is **measured** and what is **extrapolated** is marked. No GPU was available when this
was written, so nothing in the "expected" columns was measured on a GPU.

## What is verified (CPU, `python nik/tests/test_gpu_pipeline.py`, 4 tests, ~5 s)
* `curate`: language-ID (English vs Romanized Nepali by stop-word rate, Devanagari rejected), quality filters (length, repetition, digit dumps, link spam), exact + MinHash-LSH near-duplicate removal, character-level EN/NE balancing.
* `plan`: every `.py` it references exists (`build_corpus.py`, `gen_sft.py`, `tokenizer.py`, `prepare.py`, `train.py`, `export.py`, `eval/run_eval.py`).
* `smoke`: 3 Muon+AdamW steps of the real hybrid AR+diffusion loss on a fake batch with the `nik-nano` preset (loss 16.73 -> 16.10 -> 15.47), int8 export with `export.py`, fp32 vs int8 top-1 agreement 99.2%, and the exported file generates tokens in the **browser engine** (`eval/wasm_runner.mjs`, WASM int8) — i.e. train -> export -> browser path is wired end to end.

## 0. Environment
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cu124     # pick the wheel for your driver
pip install -r nik/requirements-gpu.txt
python nik/tests/test_gpu_pipeline.py                                    # must print OK before you spend GPU hours
```

## 1. Data (English + Romanized Nepali)
```bash
python nik/data/build_corpus.py --out data --shards 2          # Nepali Wikipedia + news -> romanised, deduped: data/pretrain.txt  (~10 min CPU / shard)
#   English: one document per line in data/english.txt (see nik/scripts/add_english.py for the sources the project used; any
#   permissive English corpus works, 200-400 MB of text is plenty for 20M params)
python nik/scripts/train_gpu.py curate --inputs data/pretrain.txt data/english.txt --out data/pretrain_bi.txt --en-frac 0.45
python nik/data/gen_sft.py --out data/sft.jsonl --n 120000      # chat / arithmetic / reasoning SFT rows, all hand-written generators (no external teacher model)
```
Why 45% English: nik is a Romanized-Nepali-first model, but its English reading, grammar and translation items score lower than its
Nepali ones in `eval/results/baseline.json`; the curation step guarantees the ratio is by characters, not by documents.

## 2. Exact commands for your card
```bash
python nik/scripts/train_gpu.py plan --profile rtx4090     # prints the full sequence (corpus, curate, tokenizer, tokenize, pretrain, sft, export, eval)
python nik/scripts/train_gpu.py run  --profile rtx4090     # executes it; stages whose output exists are skipped, pretraining resumes
```
| profile | micro-batch (512-token windows) | accum | notes |
|---|---|---|---|
| `rtx4090` | 64 | 1 | bf16 autocast, `torch.compile`, Muon + AdamW, EMA 0.999, WSD schedule |
| `rtx3090` | 48 | 1 | same |
| `rtx3060` (12 GB) | 16 | 3 | activation checkpointing (`--grad-ckpt`) |
| `cpu-nano` | 8 | 1 | 2M-param `nik-nano`, only for checking the plumbing |

Hyper-parameters (from `nik/docs/TRAINING.md` and the repo's own ablations; peak LR 3e-3 is shared by Muon and AdamW because Muon
updates are RMS-matched): pretrain 40k steps x 64 x 512 = **1.3 B tokens** (about 3x Chinchilla for 20M params; the project's earlier
runs used 0.26 B), 500 warm-up steps, WSD decay over the last 20%, weight decay 0.1, grad-clip 1.0, hybrid loss (AR + block-diffusion)
for pretraining, **pure AR (`--diff-weight 0`) for SFT**, SFT 8k steps at LR 1e-3 with 20% pretrain windows mixed in. Do not change the
tokenizer once trained: it is shared by every checkpoint and the browser.

## 3. Expected cost (EXTRAPOLATED from the T4 numbers in `nik/docs/TRAINING.md`: 17.3k clean tok/s AR, 7.3k tok/s two-stream; a 4090 is roughly 5-6x a T4 with bf16 + compile)
| | 4090 | 3090 | 3060 12 GB |
|---|---|---|---|
| tokens/s, hybrid loss | ~40k | ~30k | ~10k |
| pretrain 1.3 B tokens | ~9 h | ~12 h | ~36 h |
| SFT 8k steps (AR only) | ~1 h | ~1.3 h | ~4 h |
| peak memory | ~10-14 GB (bs 64) | ~10-14 GB (bs 48) | ~8 GB with `--grad-ckpt` |
Treat all of these as +-50% until you have a first `tokens/s` line from `train.py`; reduce `bs` if you hit OOM (the batch is 2x longer in the two-stream phase).

## 4. Acceptance (project rule: ship only if it beats the live model)
```bash
python eval/run_eval.py --model nik/runs/bilingual/nik-bilingual.bin --out nik/runs/bilingual/eval.json   # compare with eval/results/baseline.json: 76/125 (60.8%)
python nik/bench.py --model nik/runs/bilingual/nik-bilingual.bin --n 15                                      # NikBench (needs torch)
```
Expected metrics: **unknown — this recipe has not been run.** The only defensible prior is that a from-scratch 20M model trained on
~5x more tokens with a cleaner bilingual mix should improve the English-comprehension and Romanized-Nepali sub-scores of the 125-item suite
(baseline 14/25 and 17/25); arithmetic and word-problem quality depend on the SFT generators (`nik/data/teacher/`), not on this
step. Run `eval/run_eval.py` with at least 2 seeds of training before believing a +-4 item difference (see
`research/weight-space-log.md` for how large the noise is).
