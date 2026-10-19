# Nik 0.1: a tiny romanized-Nepali LLM, built from scratch

> "namaste! ma nik ho, nikit hamal le sunya dekhi banayeko sano nepali AI."

Nik is a language model for **romanized Nepali** (Nepali typed in Latin letters, the way people text: *"k chha khabar?"*).
It was built entirely from scratch: our own romanizer, tokenizer, architecture, training loop, int8 export and a
dependency-free JavaScript inference engine. It runs **in the browser** on nikit.is-a.dev.

| | |
|---|---|
| Parameters | 20.5M (nik-0.1 flagship), 8.3M (nik-small), 2.0M (nik-nano preview) |
| File size | 20.7 MB flagship, under the 25 MB cap (int8, per-row scales) |
| Architecture | NikLM: hybrid autoregressive and block-diffusion transformer |
| Decoding | **SSBD**, self-speculative block diffusion (draft in parallel, verify causally, same weights) |
| Reasoning | `<|think|> … <|/think|>` traces before answering |
| Runtime | JS + a hand-written WASM-SIMD int8 GEMM kernel (~390 tok/s on a 2-vCPU VM), Web Worker, no server, works offline |

Work in progress. See `docs/` for the architecture, data pipeline and training guide.

## Train the real model (one click)

[![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/NikitHamal/NikitHamal/blob/main/nik/notebooks/nik_train.ipynb)

On Kaggle: *New Notebook → File → Import notebook → GitHub* → `NikitHamal/NikitHamal` → `nik/notebooks/nik_train.ipynb`. Turn on the GPU and internet, then run all cells. The pipeline is resumable, and the last cell pushes the trained weights. `/chat` switches to them automatically because it reads `nik/web/model/manifest.json`.

## Status

| model | where trained | size | notes |
|---|---|---|---|
| `nik-nano` (live now) | 2-vCPU sandbox, ~30–60 min total | 2.1 MB | preview: fluent romanized Nepali and correct persona facts; arithmetic is not reliable yet |
| `nik-0.1` | **your GPU run** (Kaggle T4, ~4–5 h, resumable) | 20.7 MB | 10× the parameters, 24 effective layers, about 25× the training tokens |

Eval (`python nik/eval.py --model nik/web/model/<name>.bin --data data`) for the CPU preview: persona facts 6/7, math 0/40, val ppl 278, SSBD 1.75 tok/pass.

## Layout

```
nik/
  data/romanize.py       Devanagari -> casual romanized Nepali (lexicon + rules)
  data/build_corpus.py   download, romanize, clean, dedupe -> pretrain.txt
  data/gen_sft.py        chat / persona / reasoning / math / writing SFT data
  data/chat_seed.py      120 hand-written conversation intents
  tokenizer.py           byte-level BPE from scratch (4096 vocab, single-digit numbers)
  model.py               NikLM: hybrid AR + block-diffusion transformer, SSBD decoding
  train.py prepare.py    training loop (CPU/CUDA/MPS, fp16/bf16, resumable)
  export.py eval.py      int8 export (<10 MB), evaluation suite
  scripts/pipeline.sh    end-to-end pipeline; scripts/publish.py updates manifest.json
  notebooks/             Colab / Kaggle notebook
  web/nik.js worker.js   browser engine (tokenizer, KV cache, sampling, SSBD)
  web/kernels/qgemm.wat  hand-written WASM SIMD int8 GEMM (602 bytes)
  web/model/             published weights, tokenizer, manifest, logs
chat/index.html          the /chat page
```
