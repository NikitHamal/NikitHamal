#!/bin/bash
# Claude, 2026-10-24: score each snapshot of a long run as soon as it appears (curve.py), until the run's final .bin
# is scored.   setsid nohup bash nik/agents/molab/jobs/curve_watch.sh v7L > /tmp/v3/curve_v7L.log 2>&1 &
T=$1; R=/tmp/nik_runs/$T; cd /tmp/v3/repo
while true; do
  nice -n 12 /tmp/uv-venv/bin/python nik/scripts/curve.py --run $R --tag $T > /dev/null 2>&1
  grep -q '"final"' $R/curve.json 2> /dev/null && break
  sleep 120
done
