# Long chats: memory and intelligence after the first few turns (Sky, issue #9)

All numbers: live v4f (`nik-0.1.bin`), the real `nik.js` engine, greedy decoding, prompt budget 55% of 512 (unchanged).

## What was wrong
- **Cross-turn number leakage.** NikBench items asked after 8 ordinary exchanges score 6/60 with the old worker policy;
  the same items single-turn score 46/60. After `18 x 7 kati?`, `38 x 26` is solved as `18 x 6`. No answer was truncated.
- **Recall needs adjacency.** A fact 4 exchanges back is recalled 0/16 times, even when it is in the prompt 16/16 times.

## What context.js does (worker.js -> contextFor)
1. Standalone problem (2+ numbers, or 1 number with no follow-up word and not about the user) -> its single-turn prompt.
2. Question about the user -> the earlier exchange that shares content words is moved, in order, next to the question.
3. Over budget -> older Nik replies are shortened to their first sentence, then the least useful exchanges are dropped.
4. Otherwise -> the old policy, byte-identical.

| | old | context.js | single-turn |
|---|---|---|---|
| `longchat_bench.mjs` (60 NikBench items after 8 exchanges) | 6/60 | **46/60** | 46/60 |
| `memory_long.mjs` recall at k = 0/2/4/6/8 | 11/5/0/0/0 | **11/11/11/12/10** | - |
| prompts changed on single-turn bench (288) + ladder (78) | - | 0 | - |
| prompts changed on eval_understand + multi-turn stress (37) | - | 0 | - |

Tests: `node nik/web/test_context.mjs`.

## Training side: multiturn.py (CPU micro-SFT, 19 min, whole-row windows of 512, from live v4f)
| | live v4f | control (0%) | multiturn 30% |
|---|---|---|---|
| longchat_bench, OLD policy (the raw model) | 6/60 | 11/60 | **17/60** |
| memory_long recall, OLD policy, k=0/2/4/8 | 16/64 | 23/64 | **32/64** |
| memory_long recall, context.js | 43/64 | 51/64 | 47/64 |
| single-turn (longchat items / bench n4) | 46/60, 53/72 | 38/60, 44/72 | 37/60, 45/72 |
Reading: the data makes the raw model more robust to history (+6 long-chat, +9 recall vs control), with single-turn tied
with the control. The CPU recipe itself costs single-turn accuracy (46 -> 38), so the box run decides.
