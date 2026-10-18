#!/usr/bin/env bash
# Build one post reel (both cuts) or all of them:  ./build.sh [slug ...]
# -> out/<slug>.mp4 (1920x1080) and out/<slug>_vertical.mp4 (1080x1920), 27 s each.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../.." && pwd)"; cd "$HERE"
POSTS="${*:-$(python3 -c "import json;print(' '.join(k for k in json.load(open('reels.json')) if k != '_doc'))")}"
if ! curl -s -o /dev/null http://localhost:8765/; then python3 -m http.server 8765 -d "$REPO" >/dev/null 2>&1 & S=$!; trap 'kill $S 2>/dev/null' EXIT; sleep 1; fi
FR="${FRAMES_DIR:-$HERE/frames}"
for P in $POSTS; do
  python3 score.py "$P"
  ffmpeg -y -loglevel error -i "out/${P}_raw.wav" -af "loudnorm=I=-14.2:TP=-2.6:LRA=11:linear=true,alimiter=limit=0.6:attack=0.5:release=50:level=false" -ar 48000 -c:a pcm_s24le "out/$P.wav"
  for V in portrait landscape; do
    Q2="&v=$V"; NAME="$P"; [ $V = portrait ] && NAME="${P}_vertical"
    # one pass in order: the pixel scenes carry state from frame to frame
    rm -rf "$FR"; node tools/render.js 0 1620 "$FR" "http://localhost:8765/showreel/reels/film.html?post=$P$Q2"
    ffmpeg -y -loglevel error -framerate 60 -i "$FR/%04d.jpg" -i "out/$P.wav" -map 0:v -map 1:a -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p \
      -x264-params "colorprim=bt709:transfer=bt709:colormatrix=bt709" -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest "out/$NAME.mp4"
  done
  rm -f "out/${P}_raw.wav" "out/$P.wav"; rm -rf "$FR"
done
