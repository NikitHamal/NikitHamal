#!/usr/bin/env bash
# Launch Nik training on Kaggle from any machine with the Kaggle CLI configured
# (~/.kaggle/access_token or KAGGLE_API_TOKEN). Usage:
#   bash nik/scripts/kaggle_launch.sh smoke     # ~15 min end-to-end check
#   bash nik/scripts/kaggle_launch.sh full      # the real ~11 h run
#   kaggle kernels status <user>/nik-train-<mode>
#   kaggle kernels output <user>/nik-train-<mode> -p out/
set -euo pipefail
MODE=${1:-smoke}
USER_=$(kaggle config view | awk '/username/ {print $3}')
D=$(mktemp -d)
sed "s/__MODE__/$MODE/" "$(dirname "$0")/kaggle_run.py" > "$D/nik_train.py"
cat > "$D/kernel-metadata.json" <<JSON
{ "id": "$USER_/nik-train-$MODE", "title": "nik-train-$MODE", "code_file": "nik_train.py",
  "language": "python", "kernel_type": "script", "is_private": "true",
  "enable_gpu": "true", "enable_tpu": "false", "enable_internet": "true",
  "dataset_sources": [], "competition_sources": [], "kernel_sources": [], "model_sources": [] }
JSON
kaggle kernels push -p "$D" --accelerator "${ACCELERATOR:-NvidiaTeslaT4}"
echo "launched $USER_/nik-train-$MODE"
