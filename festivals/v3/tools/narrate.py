#!/usr/bin/env python3
"""Nepali narration, one clip per line of lines.json (edge-tts, ne-NP-SagarNeural) -> audio/vo/NN.mp3 + durations."""
import asyncio, json, os, subprocess, sys
import edge_tts
from mutagen.mp3 import MP3
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE = os.environ.get("VOICE", "ne-NP-SagarNeural")
async def main():
    L = json.load(open(f"{HERE}/lines.json")); os.makedirs(f"{HERE}/audio/vo", exist_ok=True)
    for r in L:
        if not r.get("speak"): continue
        out = f"{HERE}/audio/vo/{r['id']:02d}.mp3"
        if not os.path.exists(out):
            await edge_tts.Communicate(r["speak"], VOICE, rate=r.get("rate", "-6%"), pitch="-4Hz").save(out)
        r["vo_dur"] = round(MP3(out).info.length, 3)
        print(r["id"], round(r["vo_dur"], 2))
    json.dump(L, open(f"{HERE}/lines.json", "w"), ensure_ascii=False, indent=1)
asyncio.run(main())
