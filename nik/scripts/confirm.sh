#!/bin/bash
# Fresh-item confirmation for a gate winner (Claude, 2026-10-22). A candidate picked because it was >= live on the gate's
# FIXED items is partly picked for luck on those items; before shipping, re-score it and live on NikBench items they have
# never been selected on (plain + nested, seeds 7 and 11: 4 x 288 new items) and print the paired flips.
#   bash nik/scripts/confirm.sh <candidate.bin> <tag> [live.bin]
set -u
B=$1; T=$2; LB=${3:-nik/web/model/nik-0.1.bin}
PY=${PY:-/tmp/uv-venv/bin/python}; command -v $PY >/dev/null || PY=python3
cd "$(dirname "$0")/../.."
# each eval process is GPU-bound; torch's default CPU pool (one thread per core) x ~15 processes starved a training run
# sharing the box (k4: 133k -> 48k tok/s beside 8 bench runs)
export OMP_NUM_THREADS=${OMP_NUM_THREADS:-2} MKL_NUM_THREADS=${MKL_NUM_THREADS:-2}
run() {  # bin dir seed
  mkdir -p $2
  [ -f $2/bench.json ]  || $PY nik/bench.py --model $1 --n 16 --seed $3 --out $2/bench.json > $2/bench.txt 2>&1 &
  [ -f $2/nbench.json ] || $PY nik/bench.py --model $1 --n 16 --seed $3 --nested-items --out $2/nbench.json > $2/nbench.txt 2>&1 &
}
for S in 7 11; do run $LB /tmp/confirm_live_s$S $S; run $B /tmp/confirm_${T}_s$S $S; done
wait
for S in 7 11; do $PY nik/scripts/gate_flips.py /tmp/confirm_live_s$S /tmp/confirm_${T}_s$S | grep -E '^==|^row|^bench|^nested'; done | tee /tmp/confirm_$T.txt
