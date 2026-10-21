# The procedure probe: why the word score is 0/48

*(Local-C, 2026-10-21. Numbers from the real browser engine on the live v4c model, greedy.)*

## The question

The live model scores **0/48** on the word category of NikBench, and the word score has
been 2/24 -> 1/48 -> 0/48 across v4, v4b and the 300 M-token ablation - four training
regimes, no movement. Every word benchmark we have measures the **surface** (ten fixed
story templates), so the logs cannot say *why*.

The question that decides the next 30 GPU-hours: is it a **surface** problem (the model
cannot handle these wordings) or a **procedure** problem (the model cannot do the
computation at all)?

## The measurement

Three probe sets, all in `nik/scripts/word_procedure_probe.py`:

| set | what it is |
|---|---|
| `word-orig / word-para / word-formula` | the same problem, three surfaces: the bench wording, a paraphrase, and the procedure written out with no story at all |
| the ladder (L1-L4) | one step, two steps composed, two steps with the intermediate given, two steps as a chain - no story, no Nepali, no entities |
| the contrast pairs | each shape twice with different numbers, so "reads the input" can be separated from "matches a template" |

## The result

```
  word-orig / word-para / word-formula   0/10 each

  level   correct   identical-answer   operand-coverage   multiplication executed
  L1      20/20     0%                 1.00               -
  L2      0/20      0%                 0.72               15%
```

* **one step is perfect** (12/12 on the ladder, 20/20 on the contrast set, coverage 1.00);
* **two steps are impossible** (0/12, 0/20) - with a story, without a story, and with
  the procedure written out;
* the model **can use** an intermediate result it is handed (L3: 11/12) but **cannot
  produce** one (L2) or **chain** two lines (L4: 2/12);
* all four shipped models fail the same way (v4c, v4b, v4, b300: L2 = 0/12 each).

## The mechanism

The scratchpads show the model **rewriting the problem into a single operation with
operands it invents**:

```
  Q: 39 - (8 x 2) = ?
     think: "pahila 29 - 39 nikalchhu: ek: 9 - 9 = 0. das: 2 bata 3 ghatdaina, 1 sapati: 12 - 3 = 9.
             tyasaile 39 - 29 = 90."
```

`29` is `39 - 8 - 2` - the operands were **subtracted instead of multiplied** - and
`39 - 29` was then written as `90` (it is 10). The model does not represent a
two-operation expression; it collapses it to one operation it can execute, with
parameters it supplies itself. It executes the multiplication it was asked to execute
in **15%** of the cases, and it uses about two of the three numbers (coverage 0.72).

This is the same failure class as the identity finding (`mero naam nikit ho` and
`nikit ko ho?` get the identical stored bio): **the output is determined by the shape of
the input, not its content.** In the identity channel the "parameters" are a memorised
bio; in the arithmetic channel they are invented operands.

## The dose-response experiment (2026-10-21, Local-C, issue #9)

Four runs on the shared molab box, all from the **live v4c** (`nik-0.1.bin` -> `init.pt`),
all the same 12-minute SFT (bs 16, accum 2, lr 4e-4, mix 0.2, muon, ema 0.998), differing
**only** in the share of chain data (frame.py / iter.py) in the mix:

| run | chain share | NikBench | word | reason | understanding |
|---|---|---|---|---|---|
| live v4c | - | 62.5% (180/288) | 0/48 | 27/48 | 19/26 |
| chain0 | 0% | 65.6% (189/288) | 0/48 | 31/48 | 17/26 |
| chain15 | 15% | 69.8% (201/288) | 0/48 | **42/48** | 13/26 |
| chain30 | 30% | 72.9% (210/288) | 10/48* | 39/48 | 15/26 |

\* the 10/48 was **template transfer**, not a procedure - see "the leak" below.

And the mechanism row, which is the point of the ladder:

| run | L1 one step | L2 two steps | L3 interm. given | L4 chain | word-orig | word-para | word-formula |
|---|---|---|---|---|---|---|---|
| live v4c | 12/12 | **0/12** | 11/12 | 2/12 | 0/10 | 1/10 | 0/10 |
| chain0 | 12/12 | **0/12** | 11/12 | 1/12 | 0/10 | 1/10 | 1/10 |
| chain15 | 12/12 | **0/12** | 12/12 | 1/12 | 0/10 | 1/10 | 0/10 |
| chain30 | 11/12 | **0/12** | 12/12 | 2/12 | 1/10 | 1/10 | 2/10 |

**L2 is 0/12 in every run, at every dose.** One step is perfect, two steps are
impossible, and no amount of chain data changes it. The chain data *does* move the
**reason/iteration** family (27/48 -> 42/48) - the largest single move measured in this
project - but it costs understanding probes (19 -> 17 at 0% chains, -> 13 at 15%), so
15% is not shippable and 5% (sft8) is the dose to try.

**The leak (found by this experiment, in my own generator):** frame.py's basket scene was
a near-twin of the benchmark's "bagaincha" template, so the model recognised the template
instead of learning the procedure, and the benchmark moved 0/5 -> 10/10 on that one
family while L2 stayed 0/12. Fixed: `BANNED_BENCH_WORDS` in frame.py +
`nik/tests/test_frame_leak.py` (no generated row may contain the distinctive wording of
a benchmark template). **A benchmark that a training template can imitate is not a
measurement.**

**The verifier ceiling** (5 sampled paths, live v4c): the *oracle* - a perfect verifier
that always picks the best path - is also **0/12 on L2**, and the model is 94-96%
confident on the items it gets wrong. So a verifier/router can only *reject*; the
ability is missing, not the selection. The honest product move for those items is a
model-generated refusal, and the honest fix is training (a per-step verifiable reward).

## What follows

1. **More story frames cannot fix this** - every word problem is at least two steps,
   and the dose-response experiment above shows L2 stays at 0/12 from 0% to 30% chain
   tokens. The data that *can* is *chains*: one complete 1-step equation per line, the
   operands copied from the question, the result carried forward - and even that only
   moves the **iteration** families, not the two-step composition.
2. **The word benchmark cannot tell us whether a fix worked** - it confounds ten
   templates with the procedure, and it can be moved by a leak. The ladder can, in 48
   items and ~90 s.
3. **A pre-registered prediction for the next SFT (sft8):** the *reason* family should
   move (iter.py works on its own target) and the understanding probes should drop by
   1-2, while **L2 stays at 0/12**. If L2 moves, this document is wrong and the group
   should believe the ladder, not the word score.

## The tools

```
python nik/scripts/word_procedure_probe.py --out items.json --ladder --contrast
node   nik/scripts/word_probe_run.mjs nik/web/model/nik-0.1.bin items.json --out rows.json
python nik/scripts/collapse_report.py rows.json
bash   nik/scripts/molab_gate.sh /tmp/nik_out4d nik/web/model 16
```

`ship_gate.py` reads the ladder output and **fails a candidate that does not move L2/L4
off zero** (and refuses to say SHIP when the candidate has no logs at all).

## Limits

The ladder is arithmetic in Latin notation, 12 items per level, greedy, browser engine.
L2-L4 are deliberately easier than real word problems. It is a **lower bound** on the
ability and a **clean** one: it isolates decomposition and chaining from story,
language and template. It is a mechanism probe, not a benchmark.
