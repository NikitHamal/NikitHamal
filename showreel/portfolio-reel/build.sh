#!/usr/bin/env bash
# Full rebuild of the portfolio reel: render 1500 frames (4 parallel workers) -> score -> master -> mux -> checks.
# Needs: node + playwright (cd tools && npm i && npx playwright install chromium), python3 with numpy scipy soundfile pyloudnorm pillow, ffmpeg.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; cd "$HERE"
python3 -m http.server 8801 -d "$HERE" >/dev/null 2>&1 & S=$!; trap 'kill $S 2>/dev/null' EXIT; sleep 1
rm -rf frames; for r in "0 375" "375 750" "750 1125" "1125 1500"; do node tools/render.js $r frames & done; wait
python3 score.py
# master: loudness, then a limiter with enough headroom that the AAC encode stays under -1.5 dBTP
ffmpeg -y -loglevel error -i out/soundtrack_raw.wav -af "loudnorm=I=-13.6:TP=-2.6:LRA=11:linear=true,alimiter=limit=0.55:attack=0.5:release=50:level=false" -ar 48000 -c:a pcm_s24le out/soundtrack.wav
ffmpeg -y -loglevel error -framerate 60 -i frames/%04d.jpg -i out/soundtrack.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p -x264-params "colorprim=bt709:transfer=bt709:colormatrix=bt709" \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest out/reel.mp4
ffmpeg -y -loglevel error -ss 21.5 -i out/reel.mp4 -frames:v 1 out/poster.jpg
rm -rf sheet_frames && mkdir sheet_frames && for f in 60 175 285 368 540 680 780 900 960 1060 1100 1145 1205 1250 1440; do cp frames/$(printf %04d $f).jpg sheet_frames/; done
python3 sheet.py sheet_frames out/contact_sheet.png && rm -rf sheet_frames out/soundtrack_raw.wav
# spec checks: 1920x1080, 60 fps, 25.000 s, bt709; -14 LUFS +-0.5; true peak <= -1.5 dBTP
ffprobe -v error -show_entries stream=width,height,r_frame_rate,color_primaries,sample_rate:format=duration -of compact out/reel.mp4
ffmpeg -nostats -i out/reel.mp4 -af ebur128=peak=true -f null - 2>&1 | grep -E " I:| Peak:" | tail -2
