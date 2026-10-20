#!/usr/bin/env bash
# Nik 0.1 on a rented multi-GPU node (tested target: 8x NVIDIA B300). One command:
#
#   export KAGGLE_API_TOKEN=...                       # to fetch prebuilt data + upload results
#   git clone https://github.com/NikitHamal/NikitHamal.git && cd NikitHamal
#   BUDGET_MIN=150 bash nik/scripts/cluster_run.sh
#
# Everything is time-capped from BUDGET_MIN (wall clock for training, data download excluded):
#   pretrain 57% | SFT 10% | eval 4% | RSI (parallel, gated) 25% | final 4%
# Results: ./out (model .bin, evals, logs) + uploaded to the private Kaggle dataset
# <user>/nik-cluster-out, so Claude can fetch and publish it.
set -euo pipefail
cd "$(dirname "$0")/../.."
# use the node venv made by setup_node.sh if present
[ -z "${VIRTUAL_ENV:-}" ] && [ -f .venv/bin/activate ] && source .venv/bin/activate
python3 -c "import torch" 2>/dev/null || { echo "PyTorch missing: run  bash nik/scripts/setup_node.sh  first"; exit 1; }
BUDGET_MIN=${BUDGET_MIN:-150}
PRESET=${PRESET:-nik-0.1}
BS=${BS:-64}                      # per GPU; 8 GPUs x 64 x 513 = 263k tokens / step
SFT_BS=${SFT_BS:-32}
OUT=${OUT:-out}
RUN=nik/runs/$PRESET
mkdir -p "$OUT" data
T0=$(date +%s)
log() { echo "[nik $(date -u +%H:%M:%S) +$(( ($(date +%s) - T0) / 60 ))m] $*" | tee -a "$OUT/run.log"; }
pct() { python3 -c "print(max(1, int($BUDGET_MIN * $1 / 100)))"; }

python3 -m pip -q install numpy pyarrow kaggle 2>/dev/null || true
NGPU=$(python3 -c "import torch; print(max(1, torch.cuda.device_count()))")
python3 -c "import torch; print('torch', torch.__version__, 'gpus', torch.cuda.device_count(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'cpu', 'bf16', torch.cuda.is_available() and torch.cuda.is_bf16_supported())" | tee -a "$OUT/run.log"
LAUNCH="torchrun --standalone --nproc_per_node $NGPU"
[ "$NGPU" = "1" ] && LAUNCH=python3

# ---- data: download the prebuilt, tokenized dataset (built for free on Kaggle CPU)
if [ ! -f data/pre_train.bin ]; then
  if [ -n "${KAGGLE_API_TOKEN:-}" ] || [ -f ~/.kaggle/access_token ] || [ -f ~/.kaggle/kaggle.json ]; then
    log "downloading prebuilt data from Kaggle"
    for t in 1 2 3 4 5; do kaggle kernels output "${KAGGLE_DATA_KERNEL:-iamnikithamal/nik-data}" -p . -o -q --file-pattern '^data/' && break; sleep 30; done
  fi
  if [ ! -f data/pre_train.bin ]; then
    log "no prebuilt data: building locally with all CPUs (slower)"
    python3 nik/data/build_corpus.py --out data --shards 14 --stories 200000 --teacher 150000
    python3 nik/data/gen_sft.py --out data/sft.jsonl --n 150000 --corpus data/pretrain.txt
    python3 nik/data/teacher/build.py --n 120000 --seed 1 --out data/teacher.jsonl && cat data/teacher.jsonl >> data/sft.jsonl
    python3 nik/prepare.py --data data
  fi
fi
ls -la data | tee -a "$OUT/run.log"
T0=$(date +%s)   # the training budget starts now

SKIP_PRETRAIN=${SKIP_PRETRAIN:-0}  # 1 = reuse $RUN/pre/ckpt.pt (phase 2: new SFT data / settings)
SFT_NAME=${SFT_NAME:-sft}          # data/<name>_tok.bin
SFT_DIFF_W=${SFT_DIFF_W:-1.0}      # 0 = pure autoregressive SFT + RSI (all capacity on next-token quality)
# ---- torch.compile smoke test (falls back to eager if the stack can't compile)
COMPILE_FLAG=""
if [ "${COMPILE:-1}" = "1" ] && [ "$SKIP_PRETRAIN" != "1" ]; then
  if timeout 600 $LAUNCH nik/train.py --stage pretrain --preset "$PRESET" --data data --out /tmp/nik_compile_test --steps 12 --bs "$BS" \
       --eval-every 1000000 --opt muon --diff-frac 0.25 --compile > "$OUT/compile_test.log" 2>&1; then
    COMPILE_FLAG="--compile"; log "torch.compile OK"
  else
    log "torch.compile failed, using eager (see compile_test.log)"
  fi
fi

# ---- pretrain (Muon, bf16, windowed diffusion stream, time-annealed LR)
PRE_MIN=$(pct 57)
if [ "$SKIP_PRETRAIN" = "1" ] && [ -f "$RUN/pre/ckpt.pt" ]; then
  log "skipping pretrain (reusing $RUN/pre/ckpt.pt)"
else
log "pretrain ${PRE_MIN} min on $NGPU GPUs"
$LAUNCH nik/train.py --stage pretrain --preset "$PRESET" --data data --out "$RUN/pre" --steps 100000000 --minutes "$PRE_MIN" \
  --bs "$BS" --lr 3e-3 --warmup 300 --eval-every 1000 --opt muon --diff-frac 0.25 $COMPILE_FLAG 2>&1 | tee "$OUT/pretrain.log" | grep -E "eval|final|step [0-9]*000 " || true
fi
cp "$RUN/pre/log.jsonl" "$OUT/pretrain-log.jsonl"

# ---- SFT (chat + persona + 120k audited teacher examples)
SFT_MIN=${SFT_MIN:-$(pct 10)}
log "sft ${SFT_MIN} min"
$LAUNCH nik/train.py --stage sft --init "$RUN/pre/ckpt.pt" --data data --sft-name "$SFT_NAME" --diff-weight "$SFT_DIFF_W" --out "$RUN/sft" --steps 100000000 --minutes "$SFT_MIN" \
  --bs "$SFT_BS" --lr 1e-3 --warmup 100 --eval-every 500 --mix 0.15 --opt muon --ema 0.998 --diff-frac 0.25 $COMPILE_FLAG 2>&1 | tee "$OUT/sft.log" | grep -E "eval|final" || true
cp "$RUN/sft/log.jsonl" "$OUT/sft-log.jsonl"
python3 nik/export.py --ckpt "$RUN/sft/ckpt.pt" --out "$OUT/$PRESET.bin"
python3 nik/eval.py --model "$OUT/$PRESET.bin" --data data --n-math 300 --out "$OUT/eval-sft.json" | tee "$OUT/eval-sft.log" | head -8
cp "$RUN/sft/ckpt.pt" "$OUT/ckpt-sft.pt"

# ---- RSI: parallel verified self-improvement with a held-out promotion gate
RSI_MIN=${RSI_MIN:-$(pct 25)}
log "rsi ${RSI_MIN} min"
python3 nik/rsi.py --init "$RUN/sft/ckpt.pt" --data data --out "$RUN/rsi" --generations 20 --problems $((NGPU * 250)) --k 8 \
  --collect-min 6 --train-min 5 --bs "$SFT_BS" --heldout-n 6 --diff-weight "$SFT_DIFF_W" --workers "$NGPU" --launch "$LAUNCH" --budget-min "$RSI_MIN" 2>&1 | tee "$OUT/rsi.log" | grep -E "^gen|final" || true
cp "$RUN/rsi/log.jsonl" "$OUT/rsi-log.jsonl" 2>/dev/null || true
if [ -f "$RUN/rsi/champion.pt" ]; then
  python3 nik/export.py --ckpt "$RUN/rsi/champion.pt" --out "$OUT/$PRESET.rsi.bin"
  python3 nik/eval.py --model "$OUT/$PRESET.rsi.bin" --data data --n-math 300 --out "$OUT/eval-rsi.json" | head -8
fi

# ---- keep the better model by eval (math + persona), upload results
python3 - "$OUT" "$PRESET" <<'PY'
import json, os, shutil, sys
out, p = sys.argv[1], sys.argv[2]
def sc(t):
    try:
        d = json.load(open(f'{out}/eval-{t}.json')); return d['math_acc'] + d['persona_acc']
    except Exception:
        return -1
best = 'rsi' if sc('rsi') > sc('sft') else 'sft'
if best == 'rsi':
    shutil.copy(f'{out}/{p}.rsi.bin', f'{out}/{p}.bin')
json.dump({'best': best, 'sft': sc('sft'), 'rsi': sc('rsi')}, open(f'{out}/summary.json', 'w'))
print('best', best)
PY
cp nik/web/model/tokenizer.json "$OUT/"
log "done"
if [ "${UPLOAD:-1}" = "1" ] && command -v kaggle >/dev/null && { [ -n "${KAGGLE_API_TOKEN:-}" ] || [ -f ~/.kaggle/access_token ]; }; then
  U=$(kaggle config view | awk '/username/ {print $3}')
  rm -f "$OUT"/ckpt-*.pt.tmp
  printf '{"title":"nik-cluster-out","id":"%s/nik-cluster-out","licenses":[{"name":"CC0-1.0"}]}' "$U" > "$OUT/dataset-metadata.json"
  kaggle datasets create -p "$OUT" -q 2>/dev/null || kaggle datasets version -p "$OUT" -m "run $(date -u +%F-%H%M)" -q
  log "uploaded to kaggle dataset $U/nik-cluster-out (private)"
fi
