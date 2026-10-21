# How to train the next Nik

*(Local-C, 2026-10-21. Every number here was measured in this project and is paired on
the same item set; the commands are the ones that produced the models. Nothing in this
document is a guess.)*

## 0. What we are trying to buy

Three abilities, in the order the product needs them:

| ability | how it is measured | where it was before | where it is now |
|---|---|---|---|
| **the two-step composition** (produce an intermediate result and carry it) | the ladder: `nik/scripts/word_procedure_probe.py --ladder` (L2 = `39 - (8 x 2) = ?`) | **0/12** in every model (v4c, v4b, v4, b300, v4h, v4f, v4j, v4m, v5, la-b2, la-b3) | **12/12** |
| **the reading** (bind the numbers in a text to their roles) | `nik/scripts/seq2step_probe.py` (a subtraction in a sentence) and `nik/scripts/roles_probe.py` (26 held-out grounded items) | 2/11 and 7/26 | **10/11** and 12/26 |
| **the understanding** (the 26 probes: reading, memory, translation, grammar) | `nik/eval_understand.py` (0 exact hits in the mix - the leak audit) | 13/26 (v4f) | **19-20/26** |

The held-out word family of NikBench (48 items, 9 of 10 templates are two-step) is the
product-facing number: **0/48 -> 17/48**.

## 1. The two lessons that decide everything

1. **The forgetting tax is what the data does not contain.**  A control arm (the same
   recipe, *no* new data shape) drops the understanding probes 19/26 -> 16/26.  Every
   named family pays it back: the money scene +4, the role family +3.5pp of bench and
   the word family 0/48 -> 9/48, `reduce.py` the two-step ladder 0/12 -> 12/12.  So a
   fine-tune does not "cost" understanding - a fine-tune on a mix that lacks the rows
   does.
2. **Small doses of the right rows beat large doses.**  The role family peaks at 12% of
   the rows (at 20% it is worse on every axis).  `reduce.py` at 40% takes L2 to 12/12
   but crowds out `iter.py` and costs 7 reason items; at 8-18% it gives L2 12/12 *and*
   the reason family holds.  A skill that is rare is not learned; a skill that is common
   starts to crowd out the others.

## 2. The recipe (from the live model - 20 minutes on one GPU)

```bash
# 1. the mix: the named families, the shapes, and a small slice of the base mix
python nik/scripts/polish_mix.py --data data --base sft13 --name sft31 \
  --families "roles:90000,frame:45000,iter:25000,math:110000,colmath:50000,\
understand:50000,read:40000,skills:40000,vocab:12000,correct:20000,reduce:110000" \
  --persona 25000 --chat 80000 --share 0.10

# 2. the stage: 20 minutes from the live model, lr 2e-4
python nik/train.py --stage sft --init <live>.pt --data data --sft-name sft31 \
  --out nik/runs/next --steps 100000000 --minutes 20 --bs 16 --accum 2 --lr 2e-4 \
  --warmup 50 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998
```

The shares, and why each one:

| what | share | why (measured) |
|---|---|---|
| the grounded-role family (`roles.py`) | 12% of the rows | the peak: at 20% it is worse on every axis |
| `reduce.py` (Sky's symbolic two-step) | 8% flat, 110k in the family mix | 40% costs 7 reason items; 8-18% gives L2 12/12 with the reason held |
| the iteration chains (`iter.py`) | 25k | the reason family |
| the money scene (`frame.py`) | 45k | the one-step reading (2/11 -> 10/11) |
| the arithmetic (math + colmath) | ~25% | the bench's arith family and the stress items |
| the understanding families (understand / read / skills / vocab / correct) | ~25% | the 26 understanding probes are **not** taught by the arithmetic half of the base mix |
| the persona rows (augmented) | 20-25k | the persona gate (1.0) and the identity probes |
| the everyday chat rows | 75-80k | the chat style |
| the base mix | a **10% slice** | the general capability - with 0% the model collapses (58.3%) |

## 3. From scratch instead (if the corpus is the thing you want to change)

`sft16` = the v5 mix + the 12% role family + the gate-prompt filter.  The from-scratch
run on the clean 473M-token corpus (v5) scored **61.5% nested, the understanding
17/26, the traps 10/12, the ladder L2 1/12** - i.e. it is *not* the corpus that is
missing, it is the mix.  A from-scratch run should carry stage B (the shapes + the
role family + `reduce` + the named understanding families) with the shares above.

## 4. The gates (and what each one is worth)

```bash
python nik/bench.py --model <bin> --n 16 --nested-items --out <dir>/bench-<tag>.json
python nik/eval_understand.py --model <bin> --out <dir>/understand-<tag>.json
python nik/scripts/word_procedure_probe.py --out items.json --ladder --contrast
node nik/scripts/word_probe_run.mjs <bin> items.json --out <dir>/ladder-<tag>.json
python nik/scripts/collapse_report.py <dir>/ladder-<tag>.json
python nik/scripts/ship_gate.py --old nik/web/model/logs/<the live model> --new <dir>
```

**Pair the comparisons.**  `bench.py` draws its items from one RNG stream, so `--n 8` and
`--n 16` share only 17 of 140 items; use `--nested-items` (a deterministic set) on both
sides, or `compare.py` (which pairs by text).  A gate that says "NOT COMPARABLE" is not
a pass - it is a missing measurement.

**What is not decision-grade** (Local-A's leak audit, `nik/scripts/leak_audit.py`):
the `stress.py` and `chat_check` prompts appear verbatim thousands of times in every
mix we have trained on, so the stress deltas are inside the contamination for *every*
model, including the live one.  The understanding probes have 0 exact hits (they are
held out by `nik/data/teacher/build.py`) and the bench items are held out by
`nik/tests/test_frame_leak.py` and `nik/tests/test_roles_leak.py` - **those are the
numbers to rank models on.**

## 5. The leak guards (do not remove them)

* `nik/tests/test_frame_leak.py` - no generated row may contain the distinctive wording
  of a benchmark word template.
* `nik/tests/test_roles_leak.py` - the same for the role family, and no row may
  reproduce an evaluation probe.  It found 4 leaks in its own file on the first run
  (`kalam`, `bachat`, `chhut`, `km per hour`) - all fixed at the source, not filtered.
* `nik/scripts/leak_audit.py` (Local-A) - the mix-level audit: no exact
  `eval_understand` / `stress` / `chat_check` prompt in the training rows.
* `nik/data/teacher/build.py` - drops the evaluation probes from the teacher rows.

A benchmark that a training template can imitate is not a measurement: the chain30 run
moved the benchmark's "bagaincha" family from 0/5 to 10/10 with the procedure probe
still at 0/12.
