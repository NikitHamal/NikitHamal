# NikLM architecture

Nik 0.1 is one small transformer that can generate in **two modes with the same weights**, plus a browser runtime that fuses them.

## 1. Backbone: deep, thin, shared

| | nik-0.1 | nik-mini | nik-nano |
|---|---|---|---|
| width `d` | 288 | 224 | 160 |
| unique blocks × repeats | 8 × 2 = **16 effective layers** | 6 × 2 | 5 × 2 |
| heads / KV heads (GQA) | 9 / 3 | 7 / 1 | 5 / 1 |
| SwiGLU hidden | 768 | 608 | 432 |
| vocab / context | 4096 / 512 | 4096 / 384 | 4096 / 256 |
| params | 8.26M | 4.06M | 2.00M |
| int8 file | ~8.3 MB | ~4.1 MB | ~2.1 MB |

Choices for the sub-10M regime, mostly following MobileLLM (Liu et al., ICML 2024), which showed that at this size depth beats width and parameter sharing is nearly free quality:

- **Immediate block-wise weight sharing.** Each block runs twice back to back. That gives 16 layers of computation from 8 layers of parameters. The repeat reuses weights already in cache, so it is cheap in the browser too.
- **SwiGLU, RMSNorm (pre-norm), RoPE, and QK-norm.** QK-norm normalizes each head's queries and keys, which keeps attention logits bounded at the high learning rates a tiny model wants.
- **GQA (3 KV heads).** This cuts the KV cache by 3×.
- **Tied input/output embedding.** With a 4096-token vocab, the embedding is 1.2M params and is paid for once.
- **Small custom BPE vocab (4096).** It is trained only on romanized Nepali, at about 3.97 characters per token. Digits are always single tokens, so arithmetic works digit by digit.

## 2. Hybrid objective: AR + block diffusion in one forward pass

Each training window of `L` tokens is fed as a **two-stream sequence** `[x_noisy ; x_clean]` of length `2L`. Both streams share positions `0..L-1`:

```
                 keys:  noisy                    clean
queries noisy   same block only (bidirectional)  clean tokens of earlier blocks
queries clean   never                            causal (j <= i)
```

- The **clean stream** is an ordinary causal language model, trained with an AR next-token loss.
- The **noisy stream** splits the sequence into blocks of `B = 8` tokens. Each block gets its own masking rate `t ~ U(0.1, 1)`, and masked tokens become `<|mask|>`. A noisy token sees the **clean** prefix before its block and every token inside its own block. This is the masked-diffusion (MDLM / LLaDA) loss, arranged block-autoregressively as in BD3-LM (Arriola et al., ICLR 2025) and Fast-dLLM v2.
- The block grid starts at a **random phase** in every step. Because of that, the model learns to denoise a block that starts *anywhere*, which is what inference needs.

A single `F.scaled_dot_product_attention` call with a boolean mask computes both losses. There is no second model and no second pass.

## 3. SSBD: self-speculative block diffusion (decoding)

Speculative decoding normally needs a separate draft model: Medusa heads, EAGLE, or DFlash's 5-layer block-diffusion drafter (2026). Nik drafts with **itself**:

```
state: KV cache of committed tokens, t0 = next token sampled from the AR head
loop:
  1. draft  : run [t0, M, M, ..., M] (B slots) as a bidirectional block -> argmax per slot
  2. verify : run [t0, d1, ..., d_{B-1}] causally -> AR distribution at every slot
              walk left to right: sample s_j from the AR head;
              keep d_j while s_j == d_j, otherwise emit s_j and stop
  3. commit accepted tokens to the KV cache; the first rejected sample becomes the next t0
```

- **Lossless.** Every emitted token is drawn from the AR head's distribution; a draft is only a guess that we keep when it coincides with that draw. Greedy SSBD output is token-for-token identical to greedy AR output.
- **Zero extra weights.** The draft head *is* the model, so the browser downloads one file.
- **Fewer sequential steps.** Each iteration emits `1 + accepted` tokens for 2 passes over `B` tokens. A batched pass reuses every weight row across `B` tokens, which is faster per token than `B` separate single-token passes (`nik.js` uses register blocking).

The `/chat` page shows `tok/pass` for each answer so you can watch the acceptance rate.

## 4. Thinking

The SFT data teaches Nik to open hard turns with `<|think|> … <|/think|>`, a short step-by-step trace in romanized Nepali (column arithmetic with carries, weekday walks, comparisons), and only then answer. The model itself decides whether to think: easy small-talk turns skip it. The UI shows the trace as a collapsible "socheko" (thought) block.

## 5. Runtime (`web/nik.js` + `web/kernels/qgemm.wat`)

- An ES module running in a Web Worker. It has no libraries; the one custom kernel is assembled from hand-written WebAssembly text.
- **`qgemm`, a WASM SIMD128 int8 GEMM.** Weights stay int8 in wasm memory, about 8 MB, never expanded to f32. Activations are quantized per token (absmax/127) just before each matmul. The inner loop sign-extends 16 int8 lanes to i16 and accumulates with `i32x4.dot_i16x8_s`, processing two tokens per weight-row load. The kernel is 602 bytes.
- If WASM SIMD is unavailable, the engine falls back to an f32 JS path with 4-row register blocking.
- KV cache per effective layer, chunked prefill, and a sliding window at the context limit.
- Sampling: temperature, nucleus (top-p), and a repetition penalty over the last 48 tokens.
- Parity: the f32 path matches PyTorch to 8e-7. The int8 path stays within about 2% of the logit range, with the same argmax on test prompts.

Measured on a 2-vCPU cloud VM with Node 24 and nik-0.1 (8.26M params):

| backend | 1-token step | throughput | 8-token batched pass |
|---|---|---|---|
| JS f32 | 24.0 ms | 42 tok/s | 4.75× a 1-token step |
| **WASM SIMD int8** | **2.6 ms** | **~390 tok/s** | 6.3× a 1-token step |

**What this means for SSBD.** On a CPU, the int8 kernel makes the model compute-bound, so a batched pass of `B` tokens costs almost `B` single steps. Plain AR is therefore the fastest choice there, and `/chat` defaults to it. SSBD wins when a step is memory- or latency-bound (GPU / WebGPU, larger models), and it still cuts the number of *sequential* steps. The `/chat` settings let you switch modes and compare `tok/pass`.

Roadmap: a WebGPU backend (where SSBD pays off), merging the verify pass with the next draft into one pass, and 4-bit weights.

## References

- Liu et al., *MobileLLM: Optimizing Sub-billion Parameter Language Models for On-Device Use Cases*, ICML 2024.
- Sahoo et al., *Simple and Effective Masked Diffusion Language Models (MDLM)*, NeurIPS 2024.
- Nie et al., *Large Language Diffusion Models (LLaDA)*, 2025.
- Arriola et al., *Block Diffusion: Interpolating Between Autoregressive and Diffusion Language Models (BD3-LM)*, ICLR 2025.
- Wu et al., *Fast-dLLM / Fast-dLLM v2*, ICLR 2026.
- *DFlash: Block Diffusion for Flash Speculative Decoding*, arXiv 2602.06036 (2026).
- Leviathan et al., *Fast Inference from Transformers via Speculative Decoding*, ICML 2023.
- Eldan & Li, *TinyStories*, 2023: small models plus clean, focused data.
