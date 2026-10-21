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

## The reading failure, and the scene that fixed it

The dose-response experiment above says *what* is missing (two steps).  A second
measurement says *where* the first step is missing, and it is not where we thought.

`nik/scripts/seq2step_probe.py` on the live model (22 items, 11 sentence-form + 11
chain-form of the same arithmetic):

```
the bare subtraction      "500 - 180 = ?"                            11/11
the same subtraction
in a sentence              "mero sanga 500 rupiya thiyo.              2/11
                          180 kharcha bhayo. kati baki?"
wrong answers:  2000 - 750  ->  "aba 2250 rupiya baki chha"
                1500 - 625  ->  "aba 1625 rupiya baki chha"
                1200 - 450  ->  "tapai ko kaam 1250 rupiya bhayo"
```

The arithmetic is fine.  The **reading** is not: the model does not bind the numbers
in a text to their roles, so it invents a plausible amount (2250 is not 2000-750, and
it is not in the question either).  This is the same "invented operand" mechanism the
ladder shows, one level down.

**The fix is a named data shape, not more data**: `frame.py`'s `scene_money_minus` -
"I had M, S was spent, what is left" - with 8 phrasings, both orders, a distractor,
and a trace that **names the two roles before computing**
(`paisa: 2000. kharcha: 750. hisab: 2000 - 750 = 1250.`).  The evaluation sentence is
never reproduced (different numbers *and* different wording), and the held-out probe
went **2/11 -> 10/11**.  The understanding probe that v4f lost
(`mero sanga 500 rupiya thiyo. 180 kharcha bhayo. kati baki?`) came back with it.

That is also the whole story of the "understanding drop" in one line: **it was a
reading failure wearing a math costume.**

## The two abilities are different, and the data that moves one does not move the other

| ability | measured by | v4c | v4f3 (shipped) |
|---|---|---|---|
| one step, bare | ladder L1 | 12/12 | 12/12 |
| one step, in a sentence | seq2step (sentence form) | 2/11 | **10/11** |
| one step, intermediate given | ladder L3 | 11/12 | 12/12 |
| **two steps, composed** | ladder L2 | **0/12** | **1/12** |
| two steps, in a sentence | the bench's word family | 0/48 | 2/48 |

So the reading is fixable with a named shape, and the **composition is not** - 0/12 in
every model ever built (v4c, v4b, v4, b300, v4h, v4j, la-b2, la-b3) and 1/12 now.
The bench's word family is 9/10 two-step templates, which is exactly why it sits at
0/48: the templates are not the problem, the composition is.  `nik/data/teacher/roles.py`
is the attempt at that: bind the numbers to their roles **and carry the intermediate
result** (`role: paisa = 500, wata = 3, ek ko = 150` / `hisab: 3 x 150 = 450; 500 - 450
= 50`), over many surfaces, with the held-out measurement in
`nik/scripts/roles_probe.py`.

## What we know about the forgetting tax (why every fine-tune looked worse)

Every fine-tune since v4c lost understanding probes (19/26 -> 17, 16, 14, 13, 15),
and the cause is **not** the new generators: @Claude's control (v4g: the same recipe,
no new generators, on the rebuilt box data) still lost 4.  The cause is the *pretrain
stage*: `run_v4.py` trains pretrain -> SFT, and the rebuilt corpus was **96M tokens**
where v4c had **528M**, so the SFT overwrote a model that was never pretrained
properly.  The tax is paid at every stage, and it is a tax on *knowledge*, not on
skill.

Two things remove it, and both are in the shipped v4f3: **one stage instead of two**
and **lr 2e-4 instead of 4e-4** (the tax is paid by the SFT's weight movement), plus
the mix rebuilt on main (so the vocab fix, `correct.py` and the held-out chat prompts
are in it).  The durable fix is the full corpus: 675M tokens, which is what v5 is
training on.

## The leak class, and how to keep it impossible

A benchmark that a training template can imitate is not a measurement.  The chain30
run moved the benchmark's "bagaincha" family from 0/5 to 10/10 with L2 still 0/12 -
the basket scene in `frame.py` was a near-twin of that template.  Three guards now
exist, and they are tests, not good intentions:

* `nik/tests/test_frame_leak.py` - no generated row may contain the distinctive
  wording of any benchmark word template (`BANNED_BENCH_WORDS`);
* `nik/tests/test_roles_leak.py` - the same for the grounded-role family, and it also
  asserts that no row reproduces an evaluation probe (it found 4 leaks on its first
  run: `kalam`, `bachat`, `chhut`, `km per hour` - all fixed at the source);
* `nik/scripts/leak_audit.py` (Local-A) - no *exact* eval prompt in the mix, with the
  gold mix's 8 writing/chat strings that the stress suite also uses (Claude's audit:
  the stress `write` category has been trained on in every mix since v4b - so the
  stress `write` number has never been a held-out number, and the gate now drops
  those rows).

## The file cap is now 30 MB (owner, 2026-10-21)

`nik/scripts/model_budget.py` has the cap; two new int8 presets use the extra
budget and are **not trained yet** (the owner: the family first, then the size):

| preset | params | file | shape | FLOPs/tok | KV f32 |
|---|---|---|---|---|---|
| nik-0.1 (shipped family) | 20.47M | 20.66 MB | 24 layers, d=384 | 0.079 | 12.6 MB |
| nik-0.1w | 23.61M | 23.84 MB | 28 layers, d=384 | 0.091 | 14.7 MB |
| **nik-0.1x** | 28.33M | 28.61 MB | **34 layers**, d=384 | 0.110 | 17.8 MB |
| **nik-0.1v** | 27.66M | 27.89 MB | 24 layers, **d=448** | 0.107 | 12.6 MB |

Both are int8, so the browser needs no new kernels; the cost is the FLOPs (1.34-1.38x
the flagship, i.e. roughly 128 tok/s instead of 176 in the browser).

## The family table: the forgetting tax is what you do not add

Five arms, one base (the live v4c), one stage each, lr 2e-4, the same seed, all paired
on the same 288 nested items (`bench.py --nested-items`):

| arm | mix | NikBench | word | reason | understanding | stress | traps | role probe | L2 |
|---|---|---|---|---|---|---|---|---|---|
| live v4c | - | 65.6% | 0/48 | 30/48 | 19/26 | 64 | 5/12 | 7/26 | 0/12 |
| **control** (no new shape) | sft13 | 69.8% | 2/48 | 35/48 | **16/26** | 65 | 8/12 | - | - |
| + the money scene | sft14 | 68.4% | 2/48 | 34/48 | **20/26** | 63 | 8/12 | 5/26 | 1/12 |
| **+ the role family (12%)** | sft15 | **71.9%** | **9/48** | **37/48** | **20/26** | **66** | **9/12** | **12/26** | **1/12** |
| + the role family (20%) | sft17 | 72.2% | 8/48 | 37/48 | 19/26 | 64 | 8/12 | 7/26 | 0/12 |

Three things this table says:

1. **The control arm is the important one.** The same recipe *without* a new data
   shape still loses understanding (19/26 -> 16/26).  So the "forgetting tax" is not
   fine-tuning, not the learning rate and not the stage count: **it is what the data
   does not contain.**  Every candidate in this project (v4d 16, v4e 14, v4f 13, v4g
   15, la-b3 15) is the same forgetting, measured at different prices.
2. **Each named shape pays the tax back and then some.**  The money scene: +4
   understanding, the held-out money probe 2/11 -> 10/11.  The role family: +3.5pp of
   bench, the held-out word family 0/48 -> 9/48, stress +2, traps +1, the role probe
   7/26 -> 12/26.
3. **The dose has a peak, and it is not "more".**  At 20% of the rows the role family
   is *worse* than at 12% on every axis (understanding 19 vs 20, stress 64 vs 66,
   traps 8 vs 9, the role probe 7/26 vs 12/26) for +0.3pp of bench.  A skill that is
   rare is not learned; a skill that is common starts to crowd out the others.

## The two champions, and the experiment that tries to join them

Measured on the **same 288 nested items** (`bench.py --nested-items`, `compare.py` pairs
by text) - the live model is v4f, and v4f4 is the understanding model:

| | live v4c | **live v4f** | **v4f4** |
|---|---|---|---|
| NikBench | 65.6% | **75.0%** (216/288) | 71.9% (207/288) |
| word family (held out) | 0/48 | **11/48** | 9/48 |
| reason | 30/48 | **41/48** | 37/48 |
| **understanding** | 19/26 | **13/26** | **20/26** |
| **stress** | 64/103 | 63/103 | **66/103** |
| trap_check | 5/12 | 9/12 | 9/12 |
| ladder L2 (two steps) | 0/12 | 0/12 | **1/12** |
| hard bench / identity | 24/73, 10/20 | - | **32/73, 16/20** |

So v4f is 3.1pp ahead on the bench and 7 probes behind on understanding.  A trade-off
is not a ship.  The question both champions point at is: **can a model have v4f's bench
and v4f4's understanding?**

**The reasoning that makes it plausible.**  A fine-tune of this base pays the forgetting
tax, and *that* is why v4f lost 6 understanding probes (the control arm: the same
recipe with no new data shape drops understanding 19/26 -> 16/26).  But @Claude's v4m
(v4f + the money scene, 20 min, lr 2e-4) went the wrong way - bench 72.2 -> 68.8,
understanding 13 -> 16 - and so did @Local-A's la-f4b (a full-mix stage on v4f4:
understanding 16, stress 60).  **A full-mix stage trades the bench for the
understanding; the tax is paid by the data, not by the learning rate.**

**So the polish stage has to be shape-heavy, not mix-heavy.**  `polish_mix.py
--shapes` builds a small mix that is mostly the *named shapes* (the money scene, the
grounded-role family, the iteration chains) plus the persona rows and the chat rows
and a 15% slice of the base mix - and then a **short** stage (10 min at lr 1e-4) on top
of v4f.  The hypothesis: the shapes pay the tax back and the small update keeps the
bench, because every row teaches a shape instead of a template.

## The shape-heavy polish: the first model whose two-step ladder moved

**P1 = the live v4f + a 10-minute stage on a shape-heavy mix** (60k rows of the named
shapes - the money scene, the grounded-role family, the iteration chains - + 50k chat
+ the persona rows + a 15% slice of the base mix, at lr 1e-4, with the corpus replay
at 20%):

| paired, same 288 nested items | live v4c | live v4f | v4f4 | **P1** |
|---|---|---|---|---|
| NikBench | 65.6% | **75.0%** | 71.9% | **73.6%** |
| word family (held out) | 0/48 | 11/48 | 9/48 | **13/48** |
| reason | 30/48 | 41/48 | 37/48 | 38/48 |
| understanding | 19/26 | 13/26 | 20/26 | **16/26** |
| stress | 64/103 | 63/103 | 66/103 | **64/103** (flags 0/120) |
| trap_check | 5/12 | 9/12 | 9/12 | 8/12 |
| **ladder L1 / L2 / L3 / L4** | 12/**0**/11/2 | - | 11/**1**/11/0 | 10/**5**/6/**5** |
| math / persona | 94.5 / 1.0 | - | 94 / 0.857 | 94.5 / **1.0** |

**L2 = 5/12 and L4 = 5/12.**  Every model ever built in this project scores **0/12 or
1/12** on L2 (v4c, v4b, v4, b300, v4h, v4f, v4j, v4m, la-b2, la-b3): L2 is "produce the
intermediate and carry it" (`39 - (8 x 2) = ?`), L3 is "use an intermediate you are
given" (`39 - 16 = ?`, 11/12 in every model).  **P1's L2 (5/12) is close to its own L3
(6/12) - the model now produces the intermediate about as well as it uses one.**  That
is the ability the whole project has been chasing, and it moved with *ten minutes of
training on the right rows*.

**Why a shape-heavy polish and not a full-mix stage:** a full-mix stage trades the
bench for the understanding (v4m: 72.2 -> 68.8 with understanding 13 -> 16; la-f4b:
understanding 16, stress 60) because the forgetting tax is paid by the *data*, and a
full mix does not contain the rows that pay it back.  A shape-heavy mix contains them:
the money scene teaches "bind two amounts in a sentence" (the one-step reading) and
the role family teaches "carry the intermediate" (the two-step composition) - and
those are exactly the two things the two champions each miss.

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
