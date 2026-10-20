#!/usr/bin/env bash
# Render a reel on Kaggle's free CPUs:  bash festivals/kaggle/launch.sh dashain
# then: kaggle kernels status <user>/festival-reel-dashain ; kaggle kernels output <user>/festival-reel-dashain -p festivals/out
set -euo pipefail
FILM=${1:-dashain}; USER_=$(kaggle config view | awk '/username/ {print $3}'); D=$(mktemp -d)
sed "s/__FILM__/$FILM/" "$(dirname "$0")/run.py" > "$D/run.py"
cat > "$D/kernel-metadata.json" <<JSON
{ "id": "$USER_/festival-reel-$FILM", "title": "festival-reel-$FILM", "code_file": "run.py", "language": "python", "kernel_type": "script",
  "is_private": "true", "enable_gpu": "false", "enable_tpu": "false", "enable_internet": "true", "dataset_sources": [], "competition_sources": [], "kernel_sources": [], "model_sources": [] }
JSON
kaggle kernels push -p "$D"; echo "launched $USER_/festival-reel-$FILM"
