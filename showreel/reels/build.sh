#!/usr/bin/env bash
# Build one post reel (both cuts) or all of them:  ./build.sh [slug ...]
# -> out/<slug>.mp4 (1920x1080) and out/<slug>_vertical.mp4 (1080x1920), 27 s each.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../.." && pwd)"; cd "$HERE"
POSTS="${*:-the-lie-of-being-yourself the-wrong-guy-trying-to-wake-up you-never-trusted-anyone-2 where-is-god i-offer-my-curse-to-god you}"
python3 -m http.server 8765 -d "$REPO" >/dev/null 2>&1 & S=$!; trap 'kill $S 2>/dev/null' EXIT; sleep 1
FR="${FRAMES_DIR:-$HERE/frames}"
for P in $POSTS; do
  python3 score.py "$P"
  ffmpeg -y -loglevel error -i "out/${P}_raw.wav" -af "loudnorm=I=-14.2:TP=-2.6:LRA=11:linear=true,alimiter=limit=0.6:attack=0.5:release=50:level=false" -ar 48000 -c:a pcm_s24le "out/$P.wav"
  for V in portrait landscape; do
    Q2="&v=$V"; NAME="$P"; [ $V = portrait ] && NAME="${P}_vertical"
    rm -rf "$FR"; for r in "0 540" "540 1080" "1080 1620"; do node tools/render.js $r "$FR" "http://localhost:8765/showreel/reels/film.html?post=$P$Q2" & done; wait
    ffmpeg -y -loglevel error -framerate 60 -i "$FR/%04d.jpg" -i "out/$P.wav" -map 0:v -map 1:a -c:v libx264 -preset slower -crf 21 -pix_fmt yuv420p \
      -x264-params "colorprim=bt709:transfer=bt709:colormatrix=bt709" -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest "out/$NAME.mp4"
  done
  rm -f "out/${P}_raw.wav" "out/$P.wav"; rm -rf "$FR"
done
