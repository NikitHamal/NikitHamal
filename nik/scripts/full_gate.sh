#!/bin/bash
# The full ship gate (Claude, 2026-10-21): every gate in parallel on one box, candidate vs the live model on the SAME
# items, then gate_verdict.py prints one table and SHIP only if the candidate is >= live on every row.
#   bash nik/scripts/full_gate.sh <candidate.bin> <tag> [live.bin]
# Live results are cached in /tmp/gate_live (computed once per box). Outputs: /tmp/gate_<tag>/ + verdict.txt
set -u
B=$1; T=$2; LB=${3:-nik/web/model/nik-0.1.bin}
PY=${PY:-/tmp/uv-venv/bin/python}; command -v $PY >/dev/null || PY=python3
cd "$(dirname "$0")/../.."
# each eval process is GPU-bound; torch's default CPU pool (one thread per core) x ~15 processes starved a training run
# sharing the box (k4: 133k -> 48k tok/s beside 8 bench runs)
export OMP_NUM_THREADS=${OMP_NUM_THREADS:-2} MKL_NUM_THREADS=${MKL_NUM_THREADS:-2}
[ -f /tmp/ladder/items.json ] || { mkdir -p /tmp/ladder; $PY nik/scripts/word_procedure_probe.py --out /tmp/ladder/items.json --ladder > /dev/null 2>&1; }
# Cached results are only comparable if the code that produced them is the same: each code-dependent row is stamped
# with a hash of its code, and a stale row is rerun (the live cache once mixed an old calc.py with a new one).
stamp() { cat "$@" 2>/dev/null | md5sum | cut -c1-12; }
CHAT_V=$(stamp nik/web/chat_audit.mjs nik/web/vote.js nik/web/context.js nik/web/nik.js nik/tests/chat/*.json)
RW_V=$(stamp nik/calc.py nik/bench_rw.py)
fresh() {  # dir name version files...: drop the files if the dir's stamp for `name` differs
  local o=$1 n=$2 v=$3; shift 3
  [ "$(cat $o/.v_$n 2>/dev/null)" = "$v" ] || { (cd $o && rm -f "$@"); echo $v > $o/.v_$n; }
}
run() {  # tag bin outdir
  t=$1; b=$2; o=$3; mkdir -p $o
  fresh $o chat $CHAT_V everyday.txt money.txt followups.txt
  fresh $o rw $RW_V rw.json rw.txt
  [ -f $o/bench.json ]   || $PY nik/bench.py --model $b --n 16 --out $o/bench.json > $o/bench.txt 2>&1 &
  [ -f $o/nbench.json ]  || $PY nik/bench.py --model $b --n 16 --nested-items --out $o/nbench.json > $o/nbench.txt 2>&1 &
  [ -f $o/und.json ]     || $PY nik/eval_understand.py --model $b --out $o/und.json > $o/und.txt 2>&1 &
  [ -f $o/eval.json ]    || $PY nik/eval.py --model $b --data data --n-math 200 --out $o/eval.json > $o/eval.txt 2>&1 &
  [ -f $o/rw.json ]      || $PY nik/bench_rw.py --model $b --out $o/rw.json > $o/rw.txt 2>&1 &
  [ -f $o/shape.json ]   || $PY nik/scripts/shape_probe.py --model $b --out $o/shape.json > $o/shape.txt 2>&1 &
  [ -f $o/reading.json ] || $PY nik/bench_reading.py --model $b --out $o/reading.json > $o/reading.txt 2>&1 &
  [ -f $o/ladder.json ]  || node nik/scripts/word_probe_run.mjs $b /tmp/ladder/items.json --out $o/ladder.json > $o/ladder.txt 2>&1 &
  # trap/chat write .txt even when they crash: rerun unless the file holds a score (kb70/kb85 kept a stale traceback)
  grep -q 'trap check:' $o/trap.txt 2>/dev/null  || $PY nik/trap_check.py --model $b > $o/trap.txt 2>&1 &
  grep -q 'chat sanity:' $o/chat.txt 2>/dev/null || $PY nik/chat_check.py --model $b > $o/chat.txt 2>&1 &
  # /chat as users see it (worker path: context packing, pencil, sampler, vote 5; seeded): held-out everyday questions
  # (*_heldout.json is guarded out of every mix by make_sft2) and follow-ups (common phrases, a sanity row)
  grep -q '^score' $o/everyday.txt 2>/dev/null  || node nik/web/chat_audit.mjs --model $b --quiet nik/tests/chat/everyday_heldout.json > $o/everyday.txt 2>&1 &
  grep -q '^score' $o/followups.txt 2>/dev/null || node nik/web/chat_audit.mjs --model $b --quiet nik/tests/chat/followups.json > $o/followups.txt 2>&1 &
  grep -q '^score' $o/money.txt 2>/dev/null     || node nik/web/chat_audit.mjs --model $b --quiet nik/tests/chat/money_heldout.json > $o/money.txt 2>&1 &
  [ -f $o/stress.json ]  || $PY nik/stress.py --model $b --out $o/stress.json > $o/stress.txt 2>&1 &
  [ -f $o/long.json ]    || $PY nik/bench_long.py --model $b --out $o/long.json > $o/long.txt 2>&1 &
  if [ -f ${EN_DATA:-data/english}/en_heldout.jsonl ]; then
    [ -f $o/en.json ]    || $PY nik/bench_en.py --model $b --data ${EN_DATA:-data/english} --out $o/en.json > $o/en.txt 2>&1 &
  fi
}
LD=${LIVE_DIR:-/tmp/gate_live}
run live $LB $LD
run $T $B /tmp/gate_$T
wait
$PY nik/scripts/gate_verdict.py $LD /tmp/gate_$T $T | tee /tmp/gate_$T/verdict.txt
