#!/bin/bash
# Claude, 2026-10-24: v11 = the next ship candidate from the live model v8g. Waits for the self-distilled follow-ups of
# v8g (selfdistill_v8g.sh), builds mix v11 (v10 + v8g's own follow-ups as selfrows at 2.5% + verified self-answers of
# v8g from RFT round r1g at 4%), then trains v11g FROM v8g with the gated anchor TO v8g (keep what v8g knows, learn the
# fixes), 900 steps.
set -u
cd /tmp/v3/repo; J=nik/agents/molab/jobs
while [ ! -s data_v3/followup_self_v8g.jsonl ] || [ ! -s data_v3/rft_r1g.jsonl ]; do sleep 60; done
export MIXNAME=v11 SELFROWS=data_v3/followup_self_v8g.jsonl
export MIXARGS="--share hand=0.12 --share colrows=0.08 --share colbig=0.02 --share surfmath=0.03 --share groups=0.03 --share selfrows=0.025 --rft data_v3/rft_r1g.jsonl --share rft=0.04 --hand-nokl --hand-colthink --nokl-src english,colbig,surfmath,rft --hand-holdout 0.02"
bash $J/setup_v3.sh > /tmp/v3/setup_v11.log 2>&1 || exit 1
INIT=nik/web/model/nik-0.1.bin REF=nik/web/model/nik-0.1.bin bash $J/arm.sh v11g v11 900 19 --kl-gate
