#!/bin/bash
# Claude, 2026-10-22: before box 1 ends (~20:55): fresh-item confirmations of k13 and s13 (run beside the gates, not
# beside training), then every candidate bin + gate dir + confirmation off the box (private Kaggle nik-final-1022).
set -x
cd /tmp/claude/repo
until grep -q "k13b trained" /tmp/claude/queue.log; do sleep 15; done
bash nik/scripts/confirm.sh /tmp/claude/k13/nik-0.1.k13.bin k13 > /tmp/claude/confirm_k13.log 2>&1
until grep -q "queue_k13s done" /tmp/claude/queue.log; do sleep 15; done
bash nik/scripts/confirm.sh /tmp/claude/s13/nik-0.1.s13.bin s13 > /tmp/claude/confirm_s13.log 2>&1
d=/tmp/kp_nik-final-1022; rm -rf $d; mkdir -p $d
for t in k13 k13b s13; do cp /tmp/claude/$t/nik-0.1.$t.bin $d/ 2>/dev/null; done
tar czf $d/gates_final.tgz -C /tmp gate_k13 gate_k13b gate_s13 gate_s12 gate_live 2>/dev/null
tar czf $d/confirm.tgz -C /tmp $(cd /tmp && ls -d confirm_* 2>/dev/null)
cp /tmp/claude/queue.log $d/queue.log
(cd $d && md5sum *.bin > md5.txt)
echo '{"title":"nik-final-1022","id":"iamnikithamal/nik-final-1022","licenses":[{"name":"CC0-1.0"}]}' > $d/dataset-metadata.json
/tmp/uv-venv/bin/kaggle datasets create -p $d -q || /tmp/uv-venv/bin/kaggle datasets version -p $d -m update -q
echo FINAL-DONE >> /tmp/claude/queue.log
