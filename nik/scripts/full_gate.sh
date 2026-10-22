#!/bin/bash
# The full ship gate (Claude, 2026-10-21): every gate in parallel on one box, candidate vs the live model on the SAME
# items, then gate_verdict.py prints one table and SHIP only if the candidate is >= live on every row.
#   bash nik/scripts/full_gate.sh <candidate.bin> <tag> [live.bin]
# Live results are cached in /tmp/gate_live (computed once per box). Outputs: /tmp/gate_<tag>/ + verdict.txt
set -u
B=$1; T=$2; LB=${3:-nik/web/model/nik-0.1.bin}
PY=${PY:-/tmp/uv-venv/bin/python}; command -v $PY >/dev/null || PY=python3
cd "$(dirname "$0")/../.."
[ -f /tmp/ladder/items.json ] || { mkdir -p /tmp/ladder; $PY nik/scripts/word_procedure_probe.py --out /tmp/ladder/items.json --ladder > /dev/null 2>&1; }
run() {  # tag bin outdir
  t=$1; b=$2; o=$3; mkdir -p $o
  [ -f $o/bench.json ]   || $PY nik/bench.py --model $b --n 16 --out $o/bench.json > $o/bench.txt 2>&1 &
  [ -f $o/nbench.json ]  || $PY nik/bench.py --model $b --n 16 --nested-items --out $o/nbench.json > $o/nbench.txt 2>&1 &
  [ -f $o/und.json ]     || $PY nik/eval_understand.py --model $b --out $o/und.json > $o/und.txt 2>&1 &
  [ -f $o/eval.json ]    || $PY nik/eval.py --model $b --data data --n-math 200 --out $o/eval.json > $o/eval.txt 2>&1 &
  [ -f $o/rw.json ]      || $PY nik/bench_rw.py --model $b --out $o/rw.json > $o/rw.txt 2>&1 &
  [ -f $o/shape.json ]   || $PY nik/scripts/shape_probe.py --model $b --out $o/shape.json > $o/shape.txt 2>&1 &
  [ -f $o/reading.json ] || $PY nik/bench_reading.py --model $b --out $o/reading.json > $o/reading.txt 2>&1 &
  [ -f $o/ladder.json ]  || node nik/scripts/word_probe_run.mjs $b /tmp/ladder/items.json --out $o/ladder.json > $o/ladder.txt 2>&1 &
  [ -f $o/trap.txt ]     || $PY nik/trap_check.py --model $b > $o/trap.txt 2>&1 &
  [ -f $o/chat.txt ]     || $PY nik/chat_check.py --model $b > $o/chat.txt 2>&1 &
  [ -f $o/stress.json ]  || $PY nik/stress.py --model $b --out $o/stress.json > $o/stress.txt 2>&1 &
  if [ -f ${EN_DATA:-data/english}/en_heldout.jsonl ]; then
    [ -f $o/en.json ]    || $PY nik/bench_en.py --model $b --data ${EN_DATA:-data/english} --out $o/en.json > $o/en.txt 2>&1 &
  fi
}
run live $LB /tmp/gate_live
run $T $B /tmp/gate_$T
wait
$PY nik/scripts/gate_verdict.py /tmp/gate_live /tmp/gate_$T $T | tee /tmp/gate_$T/verdict.txt
