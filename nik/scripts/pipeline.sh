#!/usr/bin/env bash
# Safe default: preparation only. Training must be selected explicitly.
set -euo pipefail
cd "$(dirname "$0")/../.."
MODE=${1:-prepare}
PYTHON=${PYTHON:-python}
DATA=${DATA:-data}
RUN=${RUN:-nik/runs/nik-0.1}
"$PYTHON" nik/data/build_seed.py --out "$DATA"
"$PYTHON" nik/prepare.py --data "$DATA" --workers 2
case "$MODE" in
 prepare) echo 'Prepared original seed. Add reviewed data before a serious full-model run.' ;;
 smoke) "$PYTHON" nik/smoke_train.py --minutes "${MINUTES:-10}" --out "$RUN/smoke" ;;
 train)
  "$PYTHON" nik/train.py --stage pretrain --preset nik-0.1 --data "$DATA" --out "$RUN/pre" --minutes 18 --bs "${BS:-8}" --ctx "${CTX:-128}" --resume
  echo 'Stopped after one bounded pretraining session. Continue with --resume, then run SFT separately. Nothing published.' ;;
 *) echo 'Usage: pipeline.sh [prepare|smoke|train]'; exit 2 ;;
esac
