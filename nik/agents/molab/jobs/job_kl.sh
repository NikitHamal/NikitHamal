#!/bin/bash
# Claude: KL-anchored arms from the live m50 (train.py --ref m50 --kl), two in parallel on one GPU, then full_gate both.
#   k1 = p8m's exact recipe + KL 1.0           (clean A/B: does the anchor remove p8m's regressions?)
#   k2 = p8m mix + English 10% (+ english_basic) + abstain 3% + format_ask 3% (tokens) + KL 1.0  (the candidate)
# Run detached from /tmp/claude/repo on a box that already has data/sftb.jsonl and data/english (job_en.sh did that).
set -x
PY=/tmp/uv-venv/bin/python; KL=${KL:-1.0}; MIN=${MIN:-24}
cd /tmp/claude/repo && git pull -q
echo "Claude k1+k2 (KL arms) $(date -u +%T)" > /tmp/gpu.lock
[ -d /tmp/claude/lc ] || git clone -q -b local-c/procedure-probe https://github.com/NikitHamal/NikitHamal.git /tmp/claude/lc
[ -f data/p8m_tok.bin ] || (cd /tmp/claude/lc && $PY nik/scripts/chain_mix.py --data /tmp/claude/repo/data --base sftb --name p8m --frame 0.05 --iter 0.05 --roles 0.12 --reduce 0.08 --persona 20000 2>&1 | tail -3)
[ -f data_en/p8me_tok.bin ] || $PY nik/scripts/add_english.py --data data --out data_en --base p8m --name p8me --en data/english --share 0.10
[ -f data_en/p8mx_tok.bin ] || $PY nik/scripts/add_rows.py --data data_en --base p8me --name p8mx --gen abstain=0.03 --gen format_ask=0.03
$PY nik/scripts/leak_audit.py data_en/p8mx.jsonl --exact-only > /tmp/claude/leak_p8mx.txt 2>&1
$PY - <<'PYEOF'
import json, struct, sys, torch
sys.path.insert(0, 'nik')
from export import load_exported
src = 'nik/web/model/nik-0.1.bin'; raw = open(src, 'rb').read(); hl = struct.unpack('<I', raw[4:8])[0]
torch.save({'model': load_exported(src).state_dict(), 'cfg': json.loads(raw[8:8 + hl])['config']}, '/tmp/claude/init_live.pt')
PYEOF
run() {  # tag data mix
  T=$1; mkdir -p /tmp/claude/$T
  TR="$PY nik/train.py --stage sft --init /tmp/claude/init_live.pt --data $2 --sft-name $3 --out /tmp/claude/runs/$T --steps 100000000 --minutes $MIN --bs 128 --accum 2 --lr 1e-4 --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998 --ref nik/web/model/nik-0.1.bin --kl $KL"
  $TR --compile > /tmp/claude/$T/train.log 2>&1 || $TR > /tmp/claude/$T/train.log 2>&1
  $PY nik/export.py --ckpt /tmp/claude/runs/$T/ckpt.pt --out /tmp/claude/$T/nik-0.1.$T.bin
}
run ${T1:-k1} data p8m &
sleep 30; run ${T2:-k2} data_en p8mx &
wait
EN_DATA=data/english bash nik/scripts/full_gate.sh /tmp/claude/${T1:-k1}/nik-0.1.${T1:-k1}.bin ${T1:-k1} > /tmp/claude/gate_k1.log 2>&1 &
EN_DATA=data/english bash nik/scripts/full_gate.sh /tmp/claude/${T2:-k2}/nik-0.1.${T2:-k2}.bin ${T2:-k2} > /tmp/claude/gate_k2.log 2>&1 &
wait
rm -f /tmp/gpu.lock; echo DONE > /tmp/claude/kl.done
