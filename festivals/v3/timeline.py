#!/usr/bin/env python3
"""Shot timing from the measured narration: lines.json -> timeline.json (seconds and frames at 30 fps).
Every shot holds its clip plus breathing room; a section change gets a longer breath for the music to speak."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__)); FPS = 30
PRE, POST, SECTION_BREATH = 0.4, 0.6, 0.9
FIXED = {2: 3.2, 22: 4.0}            # title card, signature
OPEN_BLACK = 1.5                      # darkness + the diyo striking before the first word
L = json.load(open(f"{HERE}/lines.json"))
t = 0.0; shots = []; prev_sec = None
for r in L:
    if r["id"] == 1: pre = OPEN_BLACK
    else: pre = PRE + (SECTION_BREATH if prev_sec and r["section"] != prev_sec else 0)
    dur = FIXED.get(r["id"]) or (pre + r["vo_dur"] + POST)
    if r["id"] in FIXED: pre = 0
    s = {"id": r["id"], "section": r["section"], "start": round(t, 3), "dur": round(dur, 3),
         "vo_at": round(t + pre, 3) if r.get("speak") else None, "vo_dur": r.get("vo_dur"),
         "text": r["text"], "f0": round(t * FPS), "f1": round((t + dur) * FPS)}
    shots.append(s); t += dur; prev_sec = r["section"]
json.dump({"fps": FPS, "w": 1080, "h": 1920, "duration": round(t, 3), "frames": round(t * FPS), "shots": shots},
          open(f"{HERE}/timeline.json", "w"), ensure_ascii=False, indent=1)
for s in shots: print(f"{s['id']:2d} {s['section']:8s} {s['start']:6.2f} +{s['dur']:5.2f}  f{s['f0']}-{s['f1']}")
print("total", round(t, 2), "s")
