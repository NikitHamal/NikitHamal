#!/usr/bin/env bash
# Launch Nik training on Kaggle from any machine with the Kaggle CLI configured
# (~/.kaggle/access_token or KAGGLE_API_TOKEN). Usage:
#   bash nik/scripts/kaggle_launch.sh smoke     # ~15 min end-to-end check
#   bash nik/scripts/kaggle_launch.sh full      # the real ~11 h run
#   bash nik/scripts/kaggle_launch.sh tts-smoke | tts   # NikTTS (~6 h full)
#   bash nik/scripts/kaggle_launch.sh rsi1      # ~3 h RSI segment from the full run; rsi2, rsi3, ... continue from the previous segment
#   kaggle kernels status <user>/nik-train-<mode>
#   kaggle kernels output <user>/nik-train-<mode> -p out/
set -euo pipefail
MODE=${1:-smoke}
USER_=$(kaggle config view | awk '/username/ {print $3}')
D=$(mktemp -d)
SRC=kaggle_run.py; SOURCES='[]'
case "$MODE" in
  rsi1) SRC=kaggle_rsi.py; SOURCES="[\"$USER_/nik-train-full\"]";;
  rsi*) SRC=kaggle_rsi.py; N=${MODE#rsi}; SOURCES="[\"$USER_/nik-train-full\", \"$USER_/nik-train-rsi$((N-1))\"]";;
esac
case "$MODE" in tts*) SRC=kaggle_tts.py;; esac
sed "s/__MODE__/$MODE/" "$(dirname "$0")/$SRC" > "$D/nik_train.py"
cat > "$D/kernel-metadata.json" <<JSON
{ "id": "$USER_/nik-train-$MODE", "title": "nik-train-$MODE", "code_file": "nik_train.py",
  "language": "python", "kernel_type": "script", "is_private": "true",
  "enable_gpu": "true", "enable_tpu": "false", "enable_internet": "true",
  "dataset_sources": [], "competition_sources": [], "kernel_sources": $SOURCES, "model_sources": [] }
JSON
kaggle kernels push -p "$D" --accelerator "${ACCELERATOR:-NvidiaTeslaT4}"
echo "launched $USER_/nik-train-$MODE"
