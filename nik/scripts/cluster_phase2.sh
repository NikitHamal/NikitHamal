#!/usr/bin/env bash
# Phase 2 on the cluster: same pretrained base, new SFT + RSI that teach understanding.
#   * SFT data v2 (make_sft2.py): no off-topic "write about X" rows, few fixed-answer chat rows,
#     500k audited teacher rows incl. ~100k understanding tasks (memory, reading, translation,
#     grammar, English, instructions) whose answers come from the user's own message
#   * pure autoregressive SFT + RSI (SFT_DIFF_W=0): all capacity on next-token quality
#
# Start it NOW in a second tmux window while pretraining runs (data build is CPU-only, ~1 min):
#   git pull && bash nik/scripts/cluster_phase2.sh
# It waits for pretraining to save its checkpoint, stops the old run before its SFT, and continues.
set -euo pipefail
cd "$(dirname "$0")/../.."
[ -z "${VIRTUAL_ENV:-}" ] && [ -f .venv/bin/activate ] && source .venv/bin/activate
OUT=${OUT:-out}
RUN=nik/runs/${PRESET:-nik-0.1}
[ -f data/sft2_tok.bin ] || python3 nik/scripts/make_sft2.py --data data --teacher 500000 2>&1 | grep -v "by category"
echo "[phase2 $(date -u +%H:%M:%S)] data ready; waiting for pretraining to finish"
# cluster_run.sh logs "sft N min" only after the pretrain checkpoint is saved
until grep -qE '\] sft [0-9]+ min' "$OUT/run.log" 2>/dev/null; do sleep 10; done
echo "[phase2 $(date -u +%H:%M:%S)] pretraining done; stopping the old SFT"
pkill -f 'cluster_run.sh' || true
pkill -f 'train.py --stage sft' || true
sleep 15
pkill -9 -f 'train.py --stage sft' || true
mv "$OUT/run.log" "$OUT/run-phase1.log"
SKIP_PRETRAIN=1 SFT_NAME=sft2 SFT_DIFF_W=0 SFT_MIN=${SFT_MIN:-12} RSI_MIN=${RSI_MIN:-50} COMPILE=0 bash nik/scripts/cluster_run.sh
