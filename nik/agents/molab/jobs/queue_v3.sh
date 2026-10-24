#!/bin/bash
# Claude, 2026-10-24: lane v3, pipelined: the next arm starts training as soon as the previous arm's .bin exists
# (its hand eval + gate run in the background, beside the next training; at most one v3 training at a time).
#   setsid nohup bash nik/agents/molab/jobs/queue_v3.sh "TAG MIX STEPS SEED [args]" "TAG2 ..." > /tmp/v3/queue.log 2>&1 &
# An arm line may be prefixed by WAIT=<tag> to start only after that arm's bin exists (default: the previous arm).
J=/tmp/v3/repo/nik/agents/molab/jobs
prev=${PREV:-}
for spec in "$@"; do
  set -- $spec; TAG=$1
  if [ -n "$prev" ]; then
    while [ ! -f /tmp/nik_runs/$prev/nik-0.1.$prev.bin ]; do sleep 30; done
  fi
  [ -f /tmp/nik_runs/$TAG/nik-0.1.$TAG.bin ] && [ -f /tmp/gate_$TAG/verdict.txt ] && { prev=$TAG; continue; }
  echo "$(date -u +%FT%T) start $spec"
  bash $J/arm.sh $spec > /tmp/v3/arm_$TAG.log 2>&1 &
  prev=$TAG
done
wait
