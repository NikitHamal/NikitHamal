#!/bin/bash
# Claude: L1 = live m50 -> 16k context: cfg.ctx 16384, NTK rope_base 403175 (512 -> 16384), 15 min at seq 16384 on
# sftb + 30% (tokens) long-context rows (longctx.py: needle / multi-needle / long chat, up to ~14k tokens), pure AR.
# Gated by full_gate (incl. bench_long). Resumable via Kaggle like job_en.sh. Run detached from /tmp/claude/repo.
set -x
PY=/tmp/uv-venv/bin/python; K=/tmp/uv-venv/bin/kaggle; U=iamnikithamal; T=${T:-l1}; O=/tmp/claude/$T
mkdir -p $O /tmp/kd; cd /tmp/claude/repo
echo "Claude $T $(date -u +%T)" > /tmp/gpu.lock
kget() { $K datasets download $U/$1 -f $2 -p /tmp/kd -q 2>/dev/null; [ -f /tmp/kd/$2.zip ] && (cd /tmp/kd && unzip -oq $2.zip && rm $2.zip); [ -f /tmp/kd/$2 ]; }
kput() { d=/tmp/kp_$1; n=$1; mkdir -p $d; shift; cp "$@" $d/; echo "{\"title\":\"$n\",\"id\":\"$U/$n\",\"licenses\":[{\"name\":\"CC0-1.0\"}]}" > $d/dataset-metadata.json; $K datasets create -p $d -q || $K datasets version -p $d -m update -q; }
mkdir -p data
for f in pre_train.bin pre_val.bin; do [ -f data/$f ] || { kget nik-replay-corpus-2026-10-21 $f && mv /tmp/kd/$f data/; }; done
B=$O/nik-0.1.$T.bin
if ! [ -f $B ] && ! { kget nik-$T-bin nik-0.1.$T.bin && mv /tmp/kd/nik-0.1.$T.bin $B; }; then
  [ -f data/sftb_tok.bin ] || NIK_REDUCE_SHARE=0 $PY nik/scripts/make_sft2.py --data data --parts 16 --seed 191 --name sftb \
     --teacher 700000 --gold-rep 20 --chat 300000 --write 60000 --names 40000 --max-same-reply 100 2>&1 | tail -3
  [ -f data/sftl_tok.bin ] || $PY nik/scripts/add_rows.py --data data --base sftb --name sftl --gen longctx=0.30
  $PY - <<'PYEOF'
import json, struct, sys, torch
sys.path.insert(0, 'nik')
from export import load_exported
src = 'nik/web/model/nik-0.1.bin'; raw = open(src, 'rb').read(); hl = struct.unpack('<I', raw[4:8])[0]
torch.save({'model': load_exported(src).state_dict(), 'cfg': json.loads(raw[8:8 + hl])['config']}, '/tmp/claude/init_live.pt')
PYEOF
  TR="$PY nik/train.py --stage sft --init /tmp/claude/init_live.pt --data data --sft-name sftl --out /tmp/claude/runs/$T --steps 100000000 --minutes 15 --bs 4 --accum 2 --lr 1e-4 --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0 --opt muon --ema 0.998 --ctx 16384 --set-ctx 16384 --rope-base 403175"
  $TR --compile > $O/train.log 2>&1 || $TR > $O/train.log 2>&1
  $PY nik/export.py --ckpt /tmp/claude/runs/$T/ckpt.pt --out $B && kput nik-$T-bin $B $O/train.log
fi
EN_DATA=data/english bash nik/scripts/full_gate.sh $B $T > $O/gate.log 2>&1
rm -f /tmp/gpu.lock; echo DONE > $O/done
