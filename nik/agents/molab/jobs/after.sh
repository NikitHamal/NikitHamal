#!/bin/bash
# Claude, 2026-10-24: start one arm when a file exists (a GPU slot frees up when another lane's .bin appears).
#   setsid nohup bash nik/agents/molab/jobs/after.sh <file> TAG MIX STEPS SEED [args] > /tmp/v3/after_TAG.log 2>&1 &
F=$1; shift
while [ ! -f "$F" ]; do sleep 30; done
echo "$(date -u +%FT%T) $F exists: starting $*"
exec bash /tmp/v3/repo/nik/agents/molab/jobs/arm.sh "$@" > /tmp/v3/arm_$1.log 2>&1
