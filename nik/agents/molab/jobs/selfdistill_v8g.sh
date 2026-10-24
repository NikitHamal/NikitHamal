#!/bin/bash
# Claude, 2026-10-24: self-distilled follow-ups from the NEW live model v8g (as k13 did from m50): v8g answers the first
# turn and a follow-up (`kati rey?`, `pakka ho?`, ...) through the exact /chat path; kept only if both answers state
# the gold and the follow-up's think ends on the gold. 16 node shards on the CPU (the GPU stays with the trainings).
#   setsid nohup bash nik/agents/molab/jobs/selfdistill_v8g.sh > /tmp/v3/sd_v8g.log 2>&1 &
set -u
cd /tmp/v3/repo; PY=/tmp/uv-venv/bin/python; O=/tmp/v3/sd_v8g; mkdir -p $O
ev() { echo "$(date -u +%FT%T) $*" >> /tmp/nik_dash/events.log; }
[ -s $O/prompts.jsonl ] || $PY nik/scripts/followup_prompts.py --n 12000 --seed 83 --out $O/prompts.jsonl
ev "selfdistill v8g: 12,000 follow-up conversations through the /chat path (16 CPU shards)"
for i in $(seq 0 15); do
  [ -s $O/rows_$i.jsonl ] || nice -n 8 node nik/web/selfdistill.mjs --model nik/web/model/nik-0.1.bin --in $O/prompts.jsonl --out $O/rows_$i.jsonl --shard $i/16 --seed 5 > $O/shard_$i.log 2>&1 &
done
wait
cat $O/rows_*.jsonl > data_v3/followup_self_v8g.jsonl
ev "selfdistill v8g: kept $(wc -l < data_v3/followup_self_v8g.jsonl) of 12,000 (both answers state the gold)"
