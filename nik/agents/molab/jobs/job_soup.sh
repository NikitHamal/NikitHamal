#!/bin/bash
# Claude, 2026-10-22: soups of the KL-anchored arms (all children of m50). Each arm's drops sit on different rows
# (k2: nested/ladder/traps, k3: nested/reading/traps/EN reply) while the gains are shared (math, RW, understanding), so
# averaging children keeps the shared gains and cancels per-run drift (model soups, Wortsman et al. 2022).
#   u23 = (k2 + k3) / 2 (linear), t23 = TIES(k2, k3). Gates start with r1's gate (gates share the GPU well).
# Each gate gets its own copy of the live dir: concurrent gates writing the same missing live files would race.
PY=/tmp/uv-venv/bin/python; cd /tmp/claude/repo
M=nik/web/model/nik-0.1.bin; K2=/tmp/claude/k2/nik-0.1.k2.bin; K3=/tmp/claude/k3/nik-0.1.k3.bin
mkdir -p /tmp/claude/u23 /tmp/claude/t23
$PY nik/scripts/merge.py --base $M --models $K2 $K3 --method linear --weights 0.5 0.5 --out /tmp/claude/u23/nik-0.1.u23.bin
$PY nik/scripts/merge.py --base $M --models $K2 $K3 --method ties --out /tmp/claude/t23/nik-0.1.t23.bin
md5sum /tmp/claude/u23/*.bin /tmp/claude/t23/*.bin $K2 $K3
while [ ! -f /tmp/claude/r1/nik-0.1.r1.bin ]; do sleep 20; done
for T in u23 t23; do
  rm -rf /tmp/gate_live_$T; mkdir -p /tmp/gate_live_$T; cp /tmp/gate_live/*.* /tmp/gate_live_$T/
  LIVE_DIR=/tmp/gate_live_$T EN_DATA=data/english bash nik/scripts/full_gate.sh /tmp/claude/$T/nik-0.1.$T.bin $T > /tmp/claude/gate_$T.log 2>&1 &
done
wait; echo DONE > /tmp/claude/soup.done
