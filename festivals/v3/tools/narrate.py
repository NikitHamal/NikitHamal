#!/usr/bin/env python3
"""Nepali narration, one clip per line of lines.json (edge-tts, ne-NP-SagarNeural) -> audio/vo/NN.mp3,
with per-word timings (seconds into the clip) saved back to lines.json as `words` for the synced captions."""
import asyncio, json, os
import edge_tts
from mutagen.mp3 import MP3
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE = os.environ.get("VOICE", "ne-NP-SagarNeural")


async def one(r, out):
    c = edge_tts.Communicate(r["speak"], VOICE, rate=r.get("rate", "+0%"), pitch="-4Hz", boundary="WordBoundary")
    words = []
    with open(out, "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio": f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append([ch["text"], ch["offset"] / 1e7, (ch["offset"] + ch["duration"]) / 1e7])
    return words


async def main():
    L = json.load(open(f"{HERE}/lines.json")); os.makedirs(f"{HERE}/audio/vo", exist_ok=True)
    for r in L:
        if not r.get("speak"): continue
        out = f"{HERE}/audio/vo/{r['id']:02d}.mp3"
        if not os.path.exists(out) or "words" not in r:
            r["words"] = await one(r, out)
        r["vo_dur"] = round(MP3(out).info.length, 3)
        print(r["id"], r["vo_dur"], len(r["words"]))
    json.dump(L, open(f"{HERE}/lines.json", "w"), ensure_ascii=False, indent=1)
asyncio.run(main())
