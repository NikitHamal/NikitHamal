# reduce.py on CPU: does a rewrite trace teach two-step composition? (Sky, issue #9)

All runs are CPU micro-SFTs (2 cores) from the **live v4f** (`nik-0.1.bin`). Each one is
`nik/scripts/cpu_microsft.py --minutes 19 --lr 3e-4`, with about 700k tokens: replay (build.one 70% / chat 20% / write 10%)
plus the `reduce` share shown. Evaluation uses the real browser engine, greedy decoding:
the ladder (`word_procedure_probe.py --ladder`, 78 items), the held-out shape probe (`plan_force_probe.mjs`, F0 = 24 fresh
`a - (b x c)` items, a shape that reduce.py never generates), and NikBench `--n 4` (72 items).

| run | reduce share / version | L1 | **L2** | L3 | L4 | **held-out a-(bxc)** | NikBench n4 | reason | word |
|---|---|---|---|---|---|---|---|---|---|
| live v4f | - | 12 | **0** | 12 | 0 | **0/24** | 53/72 | 24/24 | 2/24 |
| control | 0% | 12 | 0 | 11 | 0 | 0/24 | 47/72 | 20 | 8 |
| r60 | 60% v1 (2-3 ops, inline steps) | 3 | 9 | 3 | 1 | 21/24 | 40/72 | 14 | 4 |
| r40 | 40% v1 + 30% one-op rows | 12 | 8 | 9 | 1 | 19/24 | 46/72 | 18 | 6 |
| r15 | 15% v1 + one-op rows | 10 | 6 | 9 | 0 | 17/24 | 45/72 | 20 | 0 |
| v2r40 | 40% v2 (steps in colmath format) | 11 | 11 | 12 | 1 | 12/24 | 45/72 | 16 | 0 |
| **v3r40** | 40% v3 (`(b x c) ko satta r rakhda: aba a - r baki chha`) | 9 | **11** | 11 | 1 | **21/24** | **49/72** | 18 | 2 |

Prefix forcing on live v4f (24 items): no prefix 0/24. Its own template with the correct inner result: 0/24. The forced
rewrite `aba a - r`: 9/24 (all 12 positive-result items correct, all 12 negative-result items wrong).

Findings:
1. L2 = 0 is an outer-operand **binding** failure (math2.bodmas has only `(a + b) x c`, so the outer operand is always last). A
   trace that re-writes the remaining expression after every step fixes it: L2 0 -> 11/12, and the held-out shape 0 -> 21/24.
   The control shows the gain is caused by the data.
2. Without one-op rows the model invents a second step for `39 - 8` (L1 12 -> 3), so stopping has to be taught.
3. Inline steps compete with the column routine (L3 12 -> 9); steps in colmath format keep L3. A bare rewrite was sometimes
   copied only partly (`aba 16 - (11 x 11)`); naming the substitution fixed that (12 -> 21/24).
4. The rest of the misses are the **sign decision** (`7 - 3` routed to rinatmak, `75 - 144` routed to the positive column path).
5. The bench drop vs live is mostly the CPU recipe (control 47/72). v3 is +2 over the control. Reduce does **not** transfer
   to story word problems: parsing a story into an expression is a separate, still-missing step.
