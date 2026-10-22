#!/bin/bash
# Local-C on the owner's CPU box: measure the p11 candidate exactly like the baseline.
#   bash nik/scripts/measure_local.sh <bin> p11
set -uo pipefail
ROOT=${ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}
cd "$ROOT"
export PYTHONUNBUFFERED=1
export CUDA_VISIBLE_DEVICES=""
BIN=${1:?usage: measure_local.sh <bin> <tag>}
TAG=${2:?usage: measure_local.sh <bin> <tag>}
LOGDIR="nik/web/model/logs/$TAG"
OUT=${OUT:-/tmp/measure_$TAG}
mkdir -p "$LOGDIR" "$OUT"
say() { echo "[$TAG $(date +%H:%M:%S)] $*" | tee -a "$OUT/run.log"; }

say "the bench (nested, the same item set as the live model)"
python nik/bench.py --model "$BIN" --n 16 --nested-items --out "$LOGDIR/bench-$TAG.json" > "$OUT/bench.log" 2>&1
grep -aE "overall|reason |word |arith " "$OUT/bench.log" | tail -4

say "the understanding probes"
python nik/eval_understand.py --model "$BIN" --out "$LOGDIR/understand-$TAG.json" > "$OUT/und.log" 2>&1
tail -1 "$OUT/und.log"

say "the math + persona eval"
python nik/eval.py --model "$BIN" --data data --n-math 200 --out "$LOGDIR/eval-$TAG.json" > "$OUT/eval.log" 2>&1
tail -2 "$OUT/eval.log"

say "the traps"
python nik/trap_check.py --model "$BIN" > "$LOGDIR/trap-$TAG.log" 2>&1 || true
tail -2 "$LOGDIR/trap-$TAG.log"

say "the chat check"
python nik/chat_check.py --model "$BIN" > "$LOGDIR/chat-$TAG.log" 2>&1 || true
tail -1 "$LOGDIR/chat-$TAG.log"

say "the stress"
python nik/stress.py --model "$BIN" --out "$LOGDIR/stress-$TAG.json" > "$OUT/stress.log" 2>&1
tail -1 "$OUT/stress.log"

say "the shape probe (the mechanism, with the paraphrase block)"
python nik/scripts/shape_probe.py --model "$BIN" --out "$LOGDIR/shape-$TAG.json" 2>&1 | head -3

say "the role probe"
python nik/scripts/roles_probe.py --model "$BIN" --out "$LOGDIR/roles-$TAG.json" 2>&1 | head -2

say "the procedure ladder"
python nik/scripts/word_procedure_probe.py --out "$OUT/ladder_items.json" --ladder --contrast 2>&1 | tail -2
node nik/scripts/word_probe_run.mjs "$BIN" "$OUT/ladder_items.json" --out "$LOGDIR/ladder-$TAG.json" 2>&1 | tail -4
python nik/scripts/collapse_report.py "$LOGDIR/ladder-$TAG.json" 2>&1 | tail -5

say "the gate: the owner's +5 on every metric, against the live model (the same item set)"
python nik/scripts/ship_gate.py --old nik/web/model/logs/m50live --new "$LOGDIR" --target 5 2>&1 | head -45

say "done - the logs are in $LOGDIR"
