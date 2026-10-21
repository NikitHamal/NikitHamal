#!/usr/bin/env bash
# The box-side acceptance run: after a training run produces /tmp/nik_outX, this runs
# the *whole* comparison in one command, with the item set fixed for both models, and
# writes every artefact into the repo so the decision is reproducible.
#
#   bash nik/scripts/molab_gate.sh <new-model-dir> [live-model-dir] [n]
#
# e.g. bash nik/scripts/molab_gate.sh /tmp/nik_out4d nik/web/model 16
#
# Rules this script exists to enforce (issue #9):
#   * the same --n and the same item set for the live model and the candidate
#     (bench.py --nested-items, so --n 4 is a subset of --n 8 is a subset of --n 16);
#   * the paired comparison is the decision (compare.py pairs by text);
#   * the ship gate refuses to decide on non-comparable logs (exit 2 = CANNOT DECIDE);
#   * the multi-step ladder (L1-L4) is measured, because the word benchmark alone
#     cannot tell a surface failure from a procedure failure.
#
# Outputs (in nik/web/model/logs/<tag>/):
#   bench-*.json, understand-*.json, stress-*.json, eval-*.json, ladder-*.json
set -euo pipefail

NEW="${1:?usage: molab_gate.sh <new-model-dir> [live-model-dir] [n]}"
LIVE="${2:-nik/web/model}"
N="${3:-16}"
TAG="$(basename "${NEW%/}")"
OUT="nik/web/model/logs/${TAG}"
mkdir -p "$OUT"
cd "$(dirname "$0")/.."

echo "== 1/6 dump the item set once (both models score the SAME items) =="
python bench.py --dump "${OUT}/items_n${N}.json" --n "$N" --nested-items
python bench.py --dump "${OUT}/items_n${N}_plain.json" --n "$N"

echo "== 2/6 NikBench (candidate) =="
python bench.py --model "${NEW}/nik-0.1.bin" --n "$N" --nested-items \
  --out "${OUT}/bench-${TAG}.json" || true

echo "== 3/6 understanding / stress / eval / chat (candidate) =="
python eval_understand.py --model "${NEW}/nik-0.1.bin" --out "${OUT}/understand-${TAG}.json" || true
python stress.py --model "${NEW}/nik-0.1.bin" --out "${OUT}/stress-${TAG}.json" || true
python eval.py --model "${NEW}/nik-0.1.bin" --out "${OUT}/eval-${TAG}.json" || true
python chat_check.py --model "${NEW}/nik-0.1.bin" 2>&1 | tee "${OUT}/chat-${TAG}.log" || true

echo "== 4/6 the multi-step ladder (48 items, ~90 s) =="
python scripts/word_procedure_probe.py --out "${OUT}/ladder_items.json" --ladder
node scripts/word_probe_run.mjs "${NEW}/nik-0.1.bin" "${OUT}/ladder_items.json" \
  --out "${OUT}/ladder-${TAG}.json" || true

echo "== 5/6 the paired comparison (the decision) =="
python compare.py --old "${LIVE}/nik-0.1.bin" --new "${NEW}/nik-0.1.bin" \
  --items "${OUT}/items_n${N}.json" 2>&1 | tee "${OUT}/compare.txt" || true

echo "== 6/6 the ship gate (exit 0 ship / 1 do not ship / 2 cannot decide) =="
python scripts/ship_gate.py --old nik/web/model/logs/v4c --new "$OUT" | tee "${OUT}/gate.txt" || true

echo
echo "artefacts in $OUT - post the gate.txt and compare.txt in issue #9 before shipping."
echo "Do NOT ship on the aggregates alone: the gate's word-family and ladder rows are the decision."
