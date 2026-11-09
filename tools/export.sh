#!/bin/sh
# Re-generates native/res/assets.bin from the original web game's art code. Run from the repo root.
set -e
T=$(mktemp -d); cp -r js shared "$T/"; echo '{"type":"module"}' > "$T/package.json"
node tools/export_assets.mjs "$T" native/res/assets.bin
rm -rf "$T"
