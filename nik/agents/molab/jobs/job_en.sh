#!/bin/bash
# Claude: e1 = live m50 + 12 min lr 1e-4 on sftb (the v4f-shaped base mix that held the bench for p8m) + 10% English
# chat rows (Dolly/OASST1, human-written) with English Simple Wikipedia in the replay; gated by full_gate (+ bench_en).
# Resumable: each stage's output goes to a private Kaggle dataset; a new box skips finished stages.
# Run detached from a main clone at /tmp/claude/repo (data/ = the replay corpus from Kaggle).
set -x
PY=/tmp/uv-venv/bin/python; K=/tmp/uv-venv/bin/kaggle; U=iamnikithamal; T=e1; O=/tmp/claude/$T
mkdir -p $O /tmp/kd; cd /tmp/claude/repo
echo "Claude $T $(date -u +%T)" > /tmp/gpu.lock
kget() { $K datasets download $U/$1 -f $2 -p /tmp/kd -q 2>/dev/null; [ -f /tmp/kd/$2.zip ] && (cd /tmp/kd && unzip -oq $2.zip && rm $2.zip); [ -f /tmp/kd/$2 ]; }
kput() { d=/tmp/kp_$1; n=$1; mkdir -p $d; shift; cp "$@" $d/; echo "{\"title\":\"$n\",\"id\":\"$U/$n\",\"licenses\":[{\"name\":\"CC0-1.0\"}]}" > $d/dataset-metadata.json; $K datasets create -p $d -q || $K datasets version -p $d -m update -q; }
mkdir -p data data/english
for f in pre_train.bin pre_val.bin; do [ -f data/$f ] || { kget nik-replay-corpus-2026-10-21 $f && mv /tmp/kd/$f data/; }; done
for f in en_sft.jsonl en_wiki.txt en_heldout.jsonl en_wiki_heldout.txt; do [ -f data/english/$f ] || { kget nik-english-2026-10-22 $f && mv /tmp/kd/$f data/english/; }; done
B=$O/nik-0.1.$T.bin
if ! [ -f $B ] && ! { kget nik-$T-bin nik-0.1.$T.bin && mv /tmp/kd/nik-0.1.$T.bin $B; }; then
  [ -f data/sftb_tok.bin ] || NIK_REDUCE_SHARE=0 $PY nik/scripts/make_sft2.py --data data --parts 16 --seed 191 --name sftb \
     --teacher 700000 --gold-rep 20 --chat 300000 --write 60000 --names 40000 --max-same-reply 100 2>&1 | tail -3
  [ -f data_en/sfte_tok.bin ] || $PY nik/scripts/add_english.py --data data --out data_en --base sftb --name sfte --en data/english --share 0.10
  $PY nik/scripts/leak_audit.py data_en/sfte.jsonl --exact-only > $O/leak.txt 2>&1
  $PY - <<'PYEOF'
import json, struct, sys, torch
sys.path.insert(0, 'nik')
from export import load_exported
src = 'nik/web/model/nik-0.1.bin'; raw = open(src, 'rb').read(); hl = struct.unpack('<I', raw[4:8])[0]
torch.save({'model': load_exported(src).state_dict(), 'cfg': json.loads(raw[8:8 + hl])['config']}, '/tmp/claude/init_live.pt')
PYEOF
  TR="$PY nik/train.py --stage sft --init /tmp/claude/init_live.pt --data data_en --sft-name sfte --out /tmp/claude/runs/$T --steps 100000000 --minutes 12 --bs 128 --accum 2 --lr 1e-4 --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998"
  $TR --compile > $O/train.log 2>&1 || $TR > $O/train.log 2>&1
  $PY nik/export.py --ckpt /tmp/claude/runs/$T/ckpt.pt --out $B && kput nik-$T-bin $B $O/train.log $O/leak.txt
fi
EN_DATA=data/english bash nik/scripts/full_gate.sh $B $T > $O/gate.log 2>&1
tar czf /tmp/gate-$T.tgz -C /tmp gate_$T gate_live && kput nik-$T-gate /tmp/gate-$T.tgz
rm -f /tmp/gpu.lock; echo DONE > $O/done
