#!/bin/bash
# Claude, 2026-10-24: the last hours of the box, unattended-safe. Every candidate that finishes gets its gate; at the
# end (or when told) the best candidate by "rows better than live minus rows worse" with a fresh-item confirmation is
# written to /tmp/nik_dash/best.txt, and everything is pushed to Kaggle (saver.sh already runs every 3 min).
#   setsid nohup bash nik/agents/molab/jobs/endgame.sh > /tmp/v3/endgame.log 2>&1 &
cd /tmp/v3/repo; PY=/tmp/uv-venv/bin/python
ev() { echo "$(date -u +%FT%T) $*" >> /tmp/nik_dash/events.log; }
score() {  # verdict file -> "<plus> <minus>" over gating rows
  awk '/REGRESSION/ && !/\*/ {m++} / \+ *$/ && !/\*/ {p++} END {print p+0, m+0}' $1
}
while true; do
  best=""; bs=-99
  for v in /tmp/gate_*/verdict.txt; do
    t=${v#/tmp/gate_}; t=${t%/verdict.txt}
    case $t in live*|m50*) continue;; esac
    # only verdicts computed against the current live model (v8g) count: older gates were vs m50
    grep -q "live" $v || continue
    [ "$(cat /tmp/gate_$t.live_dir 2> /dev/null)" = "/tmp/gate_live_ec36dd35c469" ] || [ $v -nt /tmp/nik_runs/v8g/nik-0.1.v8g.bin.shipped ] || continue
    read p m <<< "$(score $v)"
    s=$((p - 2 * m))
    [ $s -gt $bs ] && { bs=$s; best="$t (+$p / -$m)"; }
  done
  echo "$(date -u +%FT%T) best by gate rows (plus - 2 x minus) vs live v8g: $best" > /tmp/nik_dash/best.txt
  sleep 300
done
