#!/usr/bin/env bash
# Phase 4 (optional, uses leftover node time): verified self-improvement (RSI) on top of the
# phase-3 model, then score and re-upload. Starts by itself once phase 3 has uploaded.
#   git pull && tmux new -d -s phase4 'bash nik/scripts/cluster_phase4.sh 2>&1 | tee out/phase4.log'
set -euo pipefail
cd "$(dirname "$0")/../.."
[ -z "${VIRTUAL_ENV:-}" ] && [ -f .venv/bin/activate ] && source .venv/bin/activate
OUT=${OUT:-out}
PRESET=${PRESET:-nik-0.1}
RUN=nik/runs/$PRESET
BUDGET=${RSI4_MIN:-25}
say() { echo "[phase4 $(date -u +%H:%M:%S)] $*"; }
NGPU=$(python3 -c "import torch; print(max(1, torch.cuda.device_count()))")
LAUNCH="torchrun --standalone --nproc_per_node $NGPU"; [ "$NGPU" = "1" ] && LAUNCH=python3
say "waiting for phase 3 to upload"
until grep -q 'uploaded phase 3\|\] done' "$OUT/phase3.log" 2>/dev/null && ! pgrep -f 'cluster_phase3\.sh' >/dev/null; do sleep 15; done
[ -f "$RUN/sft3/ckpt.pt" ] || { say "no phase-3 checkpoint, nothing to do"; exit 0; }
say "RSI on v3 for $BUDGET min"
python3 nik/rsi.py --init "$RUN/sft3/ckpt.pt" --data data --out "$RUN/rsi4" --generations 20 --problems $((NGPU * 250)) --k 8 \
  --collect-min 5 --train-min 4 --bs 32 --heldout-n 6 --diff-weight 0 --workers "$NGPU" --launch "$LAUNCH" --budget-min "$BUDGET" \
  2>&1 | tee "$OUT/rsi4.log" | grep -E "^gen|final" || true
cp "$RUN/rsi4/log.jsonl" "$OUT/rsi4-log.jsonl" 2>/dev/null || true
if [ -f "$RUN/rsi4/champion.pt" ]; then
  python3 nik/export.py --ckpt "$RUN/rsi4/champion.pt" --out "$OUT/$PRESET.v3rsi.bin"
  python3 nik/eval.py --model "$OUT/$PRESET.v3rsi.bin" --data data --n-math 300 --out "$OUT/eval-v3rsi.json" | head -8
  python3 nik/eval_understand.py --model "$OUT/$PRESET.v3rsi.bin" --out "$OUT/understand-v3rsi.json" | tail -1
fi
say "done"
command -v kaggle >/dev/null && kaggle datasets version -p "$OUT" -m "phase4 $(date -u +%F-%H%M)" -q && say "uploaded phase 4 to kaggle dataset nik-cluster-out"
