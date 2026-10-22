#!/bin/bash
# Claude: same-parent blends of k2 (the closest candidate: only nested -4, ladder -1, traps -2 vs m50):
# kb70 = m50 + 0.70 (k2 - m50), kb85 = m50 + 0.85 (k2 - m50); full_gate both vs m50. The loop's round 0 considers them.
PY=/tmp/uv-venv/bin/python; cd /tmp/claude/repo
mkdir -p /tmp/claude/kb70 /tmp/claude/kb85
$PY nik/scripts/merge.py --base nik/web/model/nik-0.1.bin --models /tmp/claude/k2/nik-0.1.k2.bin --method linear --weights 0.70 --out /tmp/claude/kb70/nik-0.1.kb70.bin
$PY nik/scripts/merge.py --base nik/web/model/nik-0.1.bin --models /tmp/claude/k2/nik-0.1.k2.bin --method linear --weights 0.85 --out /tmp/claude/kb85/nik-0.1.kb85.bin
EN_DATA=data/english bash nik/scripts/full_gate.sh /tmp/claude/kb70/nik-0.1.kb70.bin kb70 > /tmp/claude/gate_kb70.log 2>&1 &
EN_DATA=data/english bash nik/scripts/full_gate.sh /tmp/claude/kb85/nik-0.1.kb85.bin kb85 > /tmp/claude/gate_kb85.log 2>&1 &
wait; echo DONE > /tmp/claude/kb.done
