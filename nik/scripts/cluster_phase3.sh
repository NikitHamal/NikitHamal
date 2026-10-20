#!/usr/bin/env bash
# Phase 3: SFT that generalises. Phase 2 memorised its templates (SFT val loss 0.056, ~8 epochs,
# 3/26 on the understanding probes), so this run uses
#   * 1.5M teacher rows with user-side surface augmentation (many phrasings, casual spellings,
#     prefixes, code-mixing; data/teacher/augment.py) -> about 1.5 epochs instead of 8
#   * 30% pretraining text mixed in (keeps general language), pure autoregressive
#   * the same pretrained base, trained fresh (not on top of the memorised SFT)
# Then it scores sft / rsi / v3 on eval.py + eval_understand.py and re-uploads out/.
#
# Start now (data builds on CPU while RSI runs; training waits for phase 2 to finish):
#   git pull && tmux new -d -s phase3 'bash nik/scripts/cluster_phase3.sh 2>&1 | tee out/phase3.log'
set -euo pipefail
cd "$(dirname "$0")/../.."
[ -z "${VIRTUAL_ENV:-}" ] && [ -f .venv/bin/activate ] && source .venv/bin/activate
OUT=${OUT:-out}
PRESET=${PRESET:-nik-0.1}
RUN=nik/runs/$PRESET
MIN=${SFT3_MIN:-10}
say() { echo "[phase3 $(date -u +%H:%M:%S)] $*"; }
NGPU=$(python3 -c "import torch; print(max(1, torch.cuda.device_count()))")
LAUNCH="torchrun --standalone --nproc_per_node $NGPU"; [ "$NGPU" = "1" ] && LAUNCH=python3

[ -f data/sft3_tok.bin ] || nice -n 10 python3 nik/scripts/make_sft2.py --data data --teacher 1500000 --parts 12 --seed 31 --name sft3 2>&1 | grep -v "by category"
say "data ready; waiting for phase 2 (RSI + eval + upload) to finish"
while pgrep -f 'bash .*nik/scripts/cluster_run\.sh' >/dev/null || pgrep -f 'nik/rsi.py' >/dev/null; do sleep 15; done
say "phase 2 finished; SFT v3 for $MIN min"
$LAUNCH nik/train.py --stage sft --init "$RUN/pre/ckpt.pt" --data data --sft-name sft3 --diff-weight 0 --out "$RUN/sft3" --steps 100000000 \
  --minutes "$MIN" --bs 32 --lr 1e-3 --warmup 100 --eval-every 500 --mix 0.3 --opt muon --ema 0.998 2>&1 | tee "$OUT/sft3.log" | grep -E "eval|final" || true
cp "$RUN/sft3/log.jsonl" "$OUT/sft3-log.jsonl"
python3 nik/export.py --ckpt "$RUN/sft3/ckpt.pt" --out "$OUT/$PRESET.v3.bin"
python3 nik/eval.py --model "$OUT/$PRESET.v3.bin" --data data --n-math 300 --out "$OUT/eval-v3.json" | head -8
[ -f "$OUT/$PRESET.rsi.bin" ] && python3 nik/eval_understand.py --model "$OUT/$PRESET.rsi.bin" --out "$OUT/understand-rsi.json" | tail -1
python3 nik/eval_understand.py --model "$OUT/$PRESET.v3.bin" --out "$OUT/understand-v3.json" | tail -1
cp "$RUN/sft3/ckpt.pt" "$OUT/ckpt-sft3.pt"
say "done"
if command -v kaggle >/dev/null; then
  kaggle datasets version -p "$OUT" -m "phase3 $(date -u +%F-%H%M)" -q && say "uploaded phase 3 to kaggle dataset nik-cluster-out"
fi
