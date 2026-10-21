#!/usr/bin/env python3
"""Download the CC0 recordings in audio/sources.json (Freesound HQ previews) + the CC0 Nepali bansuri dhun on Wikimedia
Commons, and decode each to 48 kHz stereo WAV in build/audio/src/<key>.wav (needs ffmpeg)."""
import json, os, subprocess, urllib.request
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = f"{HERE}/build/audio/src"
EXTRA = {"bansuri_dhun": "https://upload.wikimedia.org/wikipedia/commons/5/50/%E0%A4%AC%E0%A4%BE%E0%A4%81%E0%A4%B8%E0%A5%81%E0%A4%B0%E0%A5%80%E0%A4%95%E0%A5%8B_%E0%A4%A7%E0%A5%81%E0%A4%A8_Basuri.ogg"}


def main():
    os.makedirs(OUT, exist_ok=True)
    S = json.load(open(f"{HERE}/audio/sources.json"))
    jobs = {k: v["mp3"] for k, v in S.items()}; jobs.update(EXTRA)
    for k, url in jobs.items():
        wav = f"{OUT}/{k}.wav"
        if os.path.exists(wav): continue
        raw = f"{OUT}/{k}.src"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (festivals v3 build)"})
        open(raw, "wb").write(urllib.request.urlopen(req, timeout=120).read())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", wav], check=True)
        os.remove(raw); print("got", k, flush=True)


main()
