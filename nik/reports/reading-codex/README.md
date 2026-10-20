# Reading investigation, 2026-10-20 (Codex)

Base: `7b0a7fc`. Live v4 SHA256: `44707c82953681daa2eef7b3e9357bde5740f9e247d5329b8ed71e80df467783`.
CPU PyTorch, int8 weights dequantized to fp32, no arithmetic correction. No training and no molab access.
Coordinated/ACKed in issue #8. No external teachers or subagents.

## Findings

| Check | Result | Interpretation |
|---|---:|---|
| Stress read, old substring score | 1/10 | Sole pass is `2 ra 3/3 = 2/3 hunchha.`; not a meaningful correct answer |
| Same read subset, stricter score | 0/10 | Rejects fractions/multiple conflicting numbers as count answers |
| Understanding | 4/26 | CPU int8-derived baseline; saved GPU checkpoint scored 5/26 |
| NikBench `--n 2` | 20/36 | Arithmetic 17/24, words 0/6, reasoning 3/6; small baseline, not comparable to n=8 as an improvement |
| Fresh generated lookups, seed 9381 | 1/24 lexical | The sole match is also incoherent: `duitai barabar bhag: 20 / 10 = 1.`; gold 20 appears incidentally |
| Old read generator, 100k samples, seed 821 | 543 unstated weekday answers | 342 lookup, 201 memory; 1,682 weekday questions total |
| Same sample stream with venue fix | 0 unstated weekday answers | No model-quality claim; only data-defect removal |

Natural sentences fail at entity/attribute binding, negation, unknown facts, and retrieval versus arithmetic.
Fresh synthetic lookup questions also fail, so this v4 result does not support a purely natural-prose wording explanation.
However v4 trained on sft4 **without read.py**, which landed after the run began. This baseline cannot establish
whether the architecture can learn reading, nor whether read.py-style training generalizes. Test v4b first.

## Changes

- `read.py`: all venue renderings now include the weekday that questions can ask for.
- `grounding.py`: literal evidence quotes must occur in user context; lookup/final memory/English gold must occur
  at token boundaries in user context; intermediate memory weekday answers are checked too. Comparisons require
  two literal source quotes. Unknown-attribute checks recognize the five attribute types of `not_mentioned`.
- `audit.py`: invokes grounding checks for read-* rows, so future teacher builds reject unsupported examples.
- `stress.py`: read-only lexical scoring is stricter; `--category read` reproduces this targeted evaluation.
- `reading_probe.py`: reproducible fresh generated lookup screening. Probe outputs remain evaluation artifacts.

Checker limits: substring support does not prove entity binding, temporal correctness, negation, uniqueness or
coreference. Unknown checks cover this generator's rendering grammar, not arbitrary prose. Summary/moral answers
can paraphrase and are excluded from extractive checks. Yes/no rows currently get quote checks, not entailment proof.
Question text is user context too; future provenance annotations could distinguish passage from question more strongly.
No stress prompt, expected answer, or its paraphrase was added to training data.

## Validation

```
python -m unittest discover -s nik/tests -v
python nik/data/teacher/grounding.py --samples 100000 --seed 821 --out grounding-after.json
python nik/data/teacher/build.py --n 1000 --seed 52 --out teacher-smoke.jsonl
python nik/data/gold/check.py
OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 python nik/stress.py --model nik/web/model/nik-0.1.bin --category read --out stress-read-strict.json
OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 python nik/eval_understand.py --model nik/web/model/nik-0.1.bin --out understand-cpu.json
OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 python nik/bench.py --model nik/web/model/nik-0.1.bin --n 2 --out nikbench-cpu-n2.json
python nik/scripts/reading_probe.py --n 24 --seed 9381 --out lookup.json
```

Six regression checks pass. Grounding CLI sampled 100k rows per module: read 100k checked; understand 19,913
eligible rows checked; understand2 27,097 eligible rows checked. All checks pass. Other task types are explicitly skipped.
Gold: 549 conversations, zero problems. Teacher build: 1,000 rows retained of 1,400 generated.
Fresh lookup artifact used the pre-fix imported generator; later reproduction uses the fixed venue rendering and
therefore is not token-identical for venue examples. Model and seed are preserved; do not claim exact equivalence.

## Recommended next experiment

Evaluate v4b's int8 export on these unchanged stress prompts plus fresh generator samples, using both CPU and browser
engine. If synthetic lookup improves but natural read does not, add independently authored prose worlds (pronouns,
negation, event order, distractors) with structured provenance. Keep story templates/lexical combinations disjoint
between train and evaluation. Compare a bounded SFT with versus without that data under the same token budget,
seed and export; require gains in strict reading and retained math/chat scores. Architecture changes should follow
that controlled experiment, not precede it. No long training has been started here.
