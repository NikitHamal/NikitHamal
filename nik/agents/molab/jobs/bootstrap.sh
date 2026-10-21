#!/bin/bash
# runs on a fresh box: repo, kaggle token (written by runner), replay corpus from Kaggle
PY=/tmp/uv-venv/bin/python
$PY -m pip -q install numpy pyarrow kaggle > /dev/null 2>&1
[ -d /tmp/NikitHamal ] || git clone -q https://github.com/NikitHamal/NikitHamal.git /tmp/NikitHamal
mkdir -p /tmp/NikitHamal/data /tmp/ladder && cd /tmp/NikitHamal/data
if [ ! -f pre_train.bin ]; then
  for f in pre_train.bin pre_val.bin; do /tmp/uv-venv/bin/kaggle datasets download iamnikithamal/nik-replay-corpus-2026-10-21 -f $f -p /tmp/kc -q; [ -f /tmp/kc/$f.zip ] && (cd /tmp/kc && unzip -oq $f.zip); mv /tmp/kc/$f . ; done
fi
cd /tmp/NikitHamal && $PY nik/data/build_corpus.py --help > /dev/null 2>&1
ls -la /tmp/NikitHamal/data > /tmp/bootstrap.done
