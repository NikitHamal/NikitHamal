#!/bin/bash
# Claude: p8m (live m50 + 12 min lr 1e-4 on p8's mix) as resumable stages; every stage's output goes to Kaggle,
# a new box skips finished stages (molab GPU boxes are reclaimed after 15-45 min).
set -x
PY=/tmp/uv-venv/bin/python; K=/tmp/uv-venv/bin/kaggle; U=iamnikithamal; T=p8m
while [ ! -f /tmp/bootstrap.done ]; do sleep 10; done
kget() { $K datasets download $U/$1 -f $2 -p /tmp/kd -q 2>/dev/null; [ -f /tmp/kd/$2.zip ] && (cd /tmp/kd && unzip -oq $2.zip && rm $2.zip); [ -f /tmp/kd/$2 ]; }
kput() { d=/tmp/kp_$1; mkdir -p $d; shift_name=$1; shift; cp "$@" $d/; echo "{\"title\":\"$shift_name\",\"id\":\"$U/$shift_name\",\"licenses\":[{\"name\":\"CC0-1.0\"}]}" > $d/dataset-metadata.json; $K datasets create -p $d -q || $K datasets version -p $d -m update -q; }
cd /tmp/NikitHamal; mkdir -p /tmp/kd /tmp/nik_out_$T
# S1 mix
if ! [ -f data/${T}_tok.bin ]; then
  if kget nik-$T-mix ${T}_tok.bin && kget nik-$T-mix ${T}_mask.bin; then mv /tmp/kd/${T}_tok.bin /tmp/kd/${T}_mask.bin data/
  else
    [ -d /tmp/nik_lc ] || git clone -q -b local-c/procedure-probe https://github.com/NikitHamal/NikitHamal.git /tmp/nik_lc
    [ -f data/sftb_tok.bin ] || NIK_REDUCE_SHARE=0 $PY nik/scripts/make_sft2.py --data data --parts 16 --seed 191 --name sftb --teacher 700000 --gold-rep 20 --chat 300000 --write 60000 --names 40000 --max-same-reply 100 2>&1 | tail -3
    (cd /tmp/nik_lc && $PY nik/scripts/chain_mix.py --data /tmp/NikitHamal/data --base sftb --name $T --frame 0.05 --iter 0.05 --roles 0.12 --reduce 0.08 --persona 20000 2>&1 | tail -4)
    $PY nik/scripts/leak_audit.py data/$T.jsonl --exact-only > /tmp/nik_out_$T/leak.txt 2>&1
    kput nik-$T-mix data/${T}_tok.bin data/${T}_mask.bin /tmp/nik_out_$T/leak.txt
  fi
fi
# S2 train
B=/tmp/nik_out_$T/nik-0.1.$T.bin
if ! [ -f $B ]; then
  if kget nik-$T-bin nik-0.1.$T.bin; then mv /tmp/kd/nik-0.1.$T.bin $B
  else
    $PY - <<'PYEOF'
import json, struct, sys, torch
sys.path.insert(0, 'nik')
from export import load_exported
src = 'nik/web/model/nik-0.1.bin'; raw = open(src, 'rb').read(); hl = struct.unpack('<I', raw[4:8])[0]
torch.save({'model': load_exported(src).state_dict(), 'cfg': json.loads(raw[8:8 + hl])['config']}, 'init_live.pt')
PYEOF
    TR="$PY nik/train.py --stage sft --init init_live.pt --data data --sft-name $T --out nik/runs/$T --steps 100000000 --minutes 12 --bs 128 --accum 2 --lr 1e-4 --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998"
    $TR --compile > /tmp/nik_out_$T/train.log 2>&1 || $TR > /tmp/nik_out_$T/train.log 2>&1
    $PY nik/export.py --ckpt nik/runs/$T/ckpt.pt --out $B && kput nik-$T-bin $B /tmp/nik_out_$T/train.log
  fi
fi
# S3 gate (all parallel) vs the live model, same box
O=/tmp/nik_out_$T; L=/tmp/nik_out_live; mkdir -p $L
[ -f /tmp/ladder/items.json ] || $PY nik/scripts/word_procedure_probe.py --out /tmp/ladder/items.json --ladder > /dev/null 2>&1
for m in "$T:$B:$O" "live:nik/web/model/nik-0.1.bin:$L"; do IFS=: read t b o <<< "$m"
  [ -f $o/nbench-$t.json ] || $PY nik/bench.py --model $b --n 16 --nested-items --out $o/nbench-$t.json > $o/nbench-$t.txt 2>&1 &
  [ -f $o/bench-$t.json ] || $PY nik/bench.py --model $b --n 16 --out $o/bench-$t.json > $o/bench-$t.txt 2>&1 &
  [ -f $o/und-$t.json ] || $PY nik/eval_understand.py --model $b --out $o/und-$t.json > $o/und-$t.txt 2>&1 &
  [ -f $o/trap-$t.txt ] || $PY nik/trap_check.py --model $b > $o/trap-$t.txt 2>&1 &
  [ -f $o/eval-$t.json ] || $PY nik/eval.py --model $b --data data --n-math 200 --out $o/eval-$t.json > $o/eval-$t.txt 2>&1 &
  [ -f $o/ladder-$t.json ] || node nik/scripts/word_probe_run.mjs $b /tmp/ladder/items.json --out $o/ladder-$t.json > $o/ladder-$t.txt 2>&1 &
  [ -f $o/reading-$t.json ] || $PY nik/bench_reading.py --model $b --out $o/reading-$t.json > $o/reading-$t.txt 2>&1 &
done
wait
$PY nik/compare.py --a $L/bench-live.json --b $O/bench-$T.json --label-a m50 --label-b $T --by-cat > $O/compare.txt 2>&1
$PY nik/compare.py --a $L/nbench-live.json --b $O/nbench-$T.json --label-a m50 --label-b $T --by-cat > $O/ncompare.txt 2>&1
tar czf /tmp/gate-$T.tgz -C /tmp nik_out_$T nik_out_live --exclude='*.bin' && kput nik-$T-gate /tmp/gate-$T.tgz
echo DONE > $O/all.done
