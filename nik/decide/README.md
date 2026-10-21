# Nik-Decide: tiny non-autoregressive decision model

One forward pass over `[bos] question [eos] (passage [eos]) option_1 [eos] ... option_k [eos]` (bidirectional encoder,
5.4M params, our tokenizer); each option span is scored against the question; softmax -> typed answer + confidence.
Jev-style "decision model": no token-by-token generation, so it answers in one pass.

| version | change | yes/no | lookup | intent | unknown | math-verify |
|---|---|---|---|---|---|---|
| v1 | one segment, mean-pooled question | 49% | 90.0% | 100% | 100% | 81.7% |
| v2 | claim + passage segments, [bos] summary | 49% | 89.7% | 100% | 100% | 80.7% |
| **v3** | **claimed value inside the options** | **99.7%** | **92.9%** | **100%** | **100%** | **82.8%** |

Held-out accuracy (different seed), 15-20 min on one RTX PRO 6000. Checkpoint: `checkpoints/decide-v3-fp16.pt`
(fp16 state dict of `decider.Decider`). Train: `python nik/decide/train.py --minutes 20 --out nik/runs/decide`.
Lesson: with value-free options (`ho`/`haina`) the deciding bit had to flow through the pooled question vector and never
did; putting the claimed value into each option lets the option span attend to the passage, as in lookup.
Next: int8 export + `nik/web/decide.js` (browser), routing in /chat, verifier for self-consistency paths.
