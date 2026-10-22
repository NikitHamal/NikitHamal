#!/usr/bin/env python3
"""Split one continuous narration take into the per-line clips: ElevenLabs forced alignment of the whole take against the
whole script gives every word's time; each line is cut in the middle of the pause before its first word.
  ELEVEN_KEY=... python tools/split_take.py narration/all.mp3
-> audio/vo/NN.mp3, exact word timings + vo_dur in lines.json, then timeline.py."""
import json, os, re, subprocess, sys
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
take = sys.argv[1]; key = os.environ["ELEVEN_KEY"]
L = json.load(open(f"{HERE}/lines.json")); voiced = [r for r in L if r.get("speak")]
script = " ".join(r["speak"] for r in voiced)
r = subprocess.run(["curl", "-s", "-X", "POST", "https://api.elevenlabs.io/v1/forced-alignment", "-H", f"xi-api-key: {key}",
                    "-F", f"file=@{take}", "--form-string", f"text={script}"], capture_output=True, text=True)
words = [w for w in json.loads(r.stdout)["words"] if w["text"].strip()]
toks = []  # map aligned words back to lines by counting the script's whitespace tokens
for r_ in voiced:
    for t in r_["speak"].split(): toks.append(r_["id"])
assert len(words) == len(toks), (len(words), len(toks))
from mutagen.mp3 import MP3
dur = MP3(take).info.length
spans = {}
for w, lid in zip(words, toks):
    a, b = spans.get(lid, (1e9, 0)); spans[lid] = (min(a, w["start"]), max(b, w["end"]))
ids = [r_["id"] for r_ in voiced]
cuts = {}
for k, lid in enumerate(ids):
    s, e = spans[lid]
    s0 = 0.0 if k == 0 else (spans[ids[k - 1]][1] + s) / 2
    e0 = dur if k == len(ids) - 1 else (e + spans[ids[k + 1]][0]) / 2
    s0 = max(s0, s - 0.35); e0 = min(e0, e + 0.45)
    cuts[lid] = (s0, e0)
for k, r_ in enumerate(voiced):
    s0, e0 = cuts[r_["id"]]
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", take, "-ss", f"{s0:.3f}", "-to", f"{e0:.3f}", "-af", "afade=t=in:d=0.02,areverse,afade=t=in:d=0.06,areverse",
                    "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "192k", f"{HERE}/audio/vo/{r_['id']:02d}.mp3"], check=True)
    r_["words"] = [[w["text"], round(w["start"] - s0, 3), round(w["end"] - s0, 3)] for w, lid in zip(words, toks) if lid == r_["id"]]
    r_["vo_dur"] = round(e0 - s0, 3); r_["voice"] = "owner take (ElevenLabs, Kaanchi), split by forced alignment"
    print(f"line {r_['id']:2d}: {s0:7.2f}-{e0:7.2f}  {r_['vo_dur']:.2f}s  {r_['words'][0][0]} … {r_['words'][-1][0]}")
json.dump(L, open(f"{HERE}/lines.json", "w"), ensure_ascii=False, indent=1)
subprocess.run([sys.executable, f"{HERE}/timeline.py"], check=True)
