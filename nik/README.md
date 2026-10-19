# Nik 0.1: a tiny romanized-Nepali LLM, built from scratch

> "namaste! ma nik ho, nikit hamal le sunya dekhi banayeko sano nepali AI."

Nik is a language model for **romanized Nepali** (Nepali typed in Latin letters, the way people text: *"k chha khabar?"*).
It was built entirely from scratch: our own romanizer, tokenizer, architecture, training loop, int8 export and a
dependency-free JavaScript inference engine. It runs **in the browser** on nikit.is-a.dev.

| | |
|---|---|
| Parameters | ~8.3M (nik-0.1), 2.0M (nik-nano) |
| File size | < 10 MB (int8, per-row scales) |
| Architecture | NikLM: hybrid autoregressive and block-diffusion transformer |
| Decoding | **SSBD**, self-speculative block diffusion (draft in parallel, verify causally, same weights) |
| Reasoning | `<|think|> … <|/think|>` traces before answering |
| Runtime | JS + a hand-written WASM-SIMD int8 GEMM kernel (~390 tok/s on a 2-vCPU VM), Web Worker, no server, works offline |

Work in progress. See `docs/` for the architecture, data pipeline and training guide.
