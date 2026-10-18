#!/usr/bin/env bash
# Full rebuild of the showreel: (optional) re-record scene clips -> render 900 frames -> score -> master -> mux -> checks.
#   ./build.sh            render + score + mux (uses the committed clips/)
#   ./build.sh --clips    also re-record clips/ from the live /preview page first (after changing pixel scenes)
# Needs: node + playwright (cd tools && npm i && npx playwright install chromium), python3 with numpy scipy soundfile pyloudnorm pillow, ffmpeg.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(dirname "$HERE")"; cd "$HERE"
python3 -m http.server 8799 -d "$HERE" >/dev/null 2>&1 & S1=$!
python3 -m http.server 8765 -d "$REPO" >/dev/null 2>&1 & S2=$!
trap 'kill $S1 $S2 2>/dev/null' EXIT; sleep 1
[ "${1:-}" = "--clips" ] && node tools/grabclips.js
rm -rf frames && node tools/render.js 0 900 1 frames
python3 score.py
ffmpeg -y -loglevel error -i out/soundtrack_raw.wav -af "loudnorm=I=-14:TP=-2.6:LRA=9:linear=true" -ar 48000 -c:a pcm_s24le out/soundtrack.wav
ffmpeg -y -loglevel error -framerate 60 -i frames/%04d.jpg -i out/soundtrack.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p -x264-params "colorprim=bt709:transfer=bt709:colormatrix=bt709" \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest out/showreel.mp4
ffmpeg -y -loglevel error -ss 7.0 -i out/showreel.mp4 -frames:v 1 out/poster.jpg
# the vertical cut (1080x1920): same film with ?v=portrait; three workers (each replays the pencil strokes first)
rm -rf frames_v; for r in "0 300" "300 600" "600 900"; do node tools/render.js $r 1 frames_v "http://localhost:8799/film.html?v=portrait" & done; wait
ffmpeg -y -loglevel error -framerate 60 -i frames_v/%04d.jpg -i out/soundtrack.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slower -crf 17 -pix_fmt yuv420p -x264-params "colorprim=bt709:transfer=bt709:colormatrix=bt709" \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest out/showreel_vertical.mp4
rm -rf frames_v
# contact sheet for review
rm -rf frames_sheet && mkdir frames_sheet && for f in 0 40 90 130 175 220 260 290 315 345 380 430 460 480 500 525 565 605 636 646 656 700 740 800 860; do cp frames/$(printf %04d $f).jpg frames_sheet/; done
python3 sheet.py frames_sheet out/contact_sheet.png && rm -rf frames_sheet
# spec checks: 1920x1080, 60 fps, 15.000 s, bt709; loudness -14 LUFS +-0.5, true peak <= -1.5 dBTP
ffprobe -v error -show_entries stream=width,height,r_frame_rate,color_primaries,sample_rate:format=duration -of compact out/showreel.mp4
ffmpeg -nostats -i out/showreel.mp4 -af ebur128=peak=true -f null - 2>&1 | grep -E " I:| Peak:" | tail -2
