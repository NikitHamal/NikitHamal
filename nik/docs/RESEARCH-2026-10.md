# Research review — 19 October 2026

Search provider returned HTTP 402. These primary papers were fetched directly; this is a targeted review, not an exhaustive latest-literature survey.

- [Tiny Recursive Models, October 2025](https://arxiv.org/abs/2510.04871): shared computation and iterative refinement can help small puzzle models. The reported 7M model is not evidence of fluent open-ended chat at this size. Nik's repeated blocks are a related parameter-saving experiment, not a reproduction of TRM.
- [LLaDA, revised October 2025](https://arxiv.org/abs/2502.09992): masked diffusion supports language generation at 8B scale. It does not establish superior speed or quality for our tiny CPU/browser budget. Keep causal generation as the default; measure diffusion acceptance before claiming acceleration.
- [RWKV-5/6](https://arxiv.org/abs/2404.05892): recurrent states reduce sequence memory; rewriting the existing transformer into RWKV would require retraining and a new parity-tested runtime. Deferred pending baseline evidence.
- [TinyStories](https://arxiv.org/abs/2305.07759): focused clean text enables useful learning with small models. Motivates a narrow Romanized Nepali/persona/math curriculum, not a claim that a short CPU run yields general reasoning.

Selected baseline: existing from-scratch NikLM, tied byte-BPE embeddings, GQA, RMSNorm, RoPE, SwiGLU, row-int8 export and its custom WASM SIMD kernel. No pretrained network or hosted answer API. Ship an honestly labeled small trained checkpoint first; train the full <10,000,000-byte configuration on user hardware later.

Metrics required: held-out prompt exact match, held-out language loss, quantized/runtime logit parity, prompt-to-first-token, generated tokens/second including prefill, actual downloaded bytes. Old documentation's 390 tok/s and parity figures were inherited without benchmark artifacts and must not be treated as verified results for this release. Thinking delimiters and step-by-step training targets alone do not prove reasoning. No claim of Nepal's first model or a novel breakthrough is substantiated.
