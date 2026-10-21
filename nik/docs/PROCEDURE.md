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

## What follows

1. **More story frames cannot fix this** - every word problem is at least two steps.
   The data that can is *chains*: one complete 1-step equation per line, the operands
   copied from the question, the result carried forward. `data/teacher/frame.py` and
   `data/teacher/iter.py` are already written in exactly that shape.
2. **The word benchmark cannot tell us whether a fix worked** - it confounds ten
   templates with the procedure. The ladder can, in 48 items and ~90 s.
3. **A pre-registered prediction for the next SFT (sft8):** the ladder should move
   (L2/L4 up) *even if the word benchmark stays at 0/48*. If L2 does not move, the next
   move is a bigger share of chain data (or RL with a per-step verifiable reward) - not
   more story variety.

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
