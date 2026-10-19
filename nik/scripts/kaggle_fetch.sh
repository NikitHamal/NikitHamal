#!/usr/bin/env bash
# Download a finished Kaggle run and publish it to /chat.
#   bash nik/scripts/kaggle_fetch.sh full      (then commit + push nik/web/model)
set -euo pipefail
shopt -s nullglob
cd "$(dirname "$0")/../.."
MODE=${1:-full}
USER_=$(kaggle config view | awk '/username/ {print $3}')
O=$(mktemp -d)
for t in 1 2 3 4 5; do kaggle kernels output "$USER_/nik-train-$MODE" -p "$O" -o -q --file-pattern "^out/" && break; echo "retry in 60s"; sleep 60; done
ls -la "$O" "$O/out" 2>/dev/null || true
SRC=$O/out; [ -d "$SRC" ] || SRC=$O
if [[ "$MODE" == tts* ]]; then                      # voice: publish the ONNX graphs + samples
  mkdir -p nik/web/tts nik/web/tts/samples
  cp "$SRC"/tts/*.onnx "$SRC"/tts/tts.json nik/web/tts/
  cp "$SRC"/sample*.wav nik/web/tts/samples/ 2>/dev/null || true
  cp "$SRC"/*.log.jsonl nik/web/tts/ 2>/dev/null || true
  echo "published voice to nik/web/tts"; exit 0
fi
P=$(ls "$SRC"/*.bin | head -1); NAME=$(basename "$P" .bin)
cp "$P" "nik/web/model/$NAME.bin"
mkdir -p nik/web/model/logs
for f in "$SRC"/*.json "$SRC"/*.jsonl "$SRC"/*.log; do [ -f "$f" ] && cp "$f" "nik/web/model/logs/$NAME-$(basename "$f")"; done
python3 - "$NAME" "$SRC" <<'PY'
import datetime, json, os, sys
name, src = sys.argv[1], sys.argv[2]
ev = {}
for t in ('rsi', 'rft', 'sft'):
    p = f'{src}/eval-{t}.json'
    if os.path.exists(p):
        ev[t] = {k: v for k, v in json.load(open(p)).items() if k != 'samples'}
best = json.load(open(f'{src}/summary.json')).get('best', 'sft') if os.path.exists(f'{src}/summary.json') else 'sft'
man = {'name': name.replace('nik-', 'nik '), 'file': f'{name}.bin', 'bytes': os.path.getsize(f'nik/web/model/{name}.bin'),
       'version': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'),
       'trained': f'kaggle 2xT4 · {best}', 'eval': ev.get(best, {}), 'note': 'trained on Kaggle by nik/scripts/kaggle_run.py'}
json.dump(man, open('nik/web/model/manifest.json', 'w'), indent=2)
print(json.dumps(man, indent=2))
PY
echo "published nik/web/model/$NAME.bin"
