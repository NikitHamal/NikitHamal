#!/usr/bin/env python3
"""Nepali narration with ElevenLabs v3 (premade voice speaking Nepali; key in $ELEVEN_KEY, never in the repo)
-> audio/vo/NN.mp3 + exact word timings from the character alignment, then timeline.py.
Free-plan output: credit "Voice: ElevenLabs" (elevenlabs.io) wherever the film is posted."""
import base64, json, os, subprocess, sys, time, urllib.request
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = os.environ["ELEVEN_KEY"]; VOICE = os.environ.get("EL_VOICE", "JBFqnCBsd6RMkjVDRZzb")  # George - warm storyteller
SETTINGS = {"stability": 0.5, "similarity_boost": 0.8, "style": 0.0, "use_speaker_boost": True}


def tts(text):
    body = {"text": text, "model_id": "eleven_v3", "language_code": "ne", "voice_settings": SETTINGS}
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps?output_format=mp3_44100_128",
                                 data=json.dumps(body).encode(), headers={"xi-api-key": KEY, "Content-Type": "application/json"})
    for attempt in range(3):
        try: return json.load(urllib.request.urlopen(req, timeout=180))
        except Exception as e:
            print("retry", e); time.sleep(5)
    raise SystemExit("tts failed")


def words_from(al, text):
    ch, st, en = al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]
    out = []; cur = ""; s0 = None
    for c, a, b in zip(ch, st, en):
        if c.isspace():
            if cur: out.append([cur, round(s0, 3), round(prev, 3)]); cur = ""
            continue
        if not cur: s0 = a
        cur += c; prev = b
    if cur: out.append([cur, round(s0, 3), round(prev, 3)])
    import re
    clean = []
    for w, a, b in out:
        w2 = re.sub(r"\[[^\]]*\]", "", w).strip(".…'\"")
        if w2 and w2 not in ("—",) and not re.fullmatch(r"[\W_]+", w2): clean.append([w2, a, b])
    return clean


def main():
    only = [int(x) for x in sys.argv[1:]]
    L = json.load(open(f"{HERE}/lines.json"))
    for r in L:
        if not r.get("speak") or (only and r["id"] not in only): continue
        d = tts(r.get("speak_v3") or r["speak"]); out = f"{HERE}/audio/vo/{r['id']:02d}.mp3"
        open(out, "wb").write(base64.b64decode(d["audio_base64"]))
        al = d.get("normalized_alignment") or d["alignment"]
        r["words"] = words_from(d["alignment"], r["speak"]); r["vo_dur"] = round(d["alignment"]["character_end_times_seconds"][-1] + 0.25, 3)
        r["voice"] = f"ElevenLabs eleven_v3 {VOICE}"
        print(r["id"], r["vo_dur"], len(r["words"]), flush=True)
    json.dump(L, open(f"{HERE}/lines.json", "w"), ensure_ascii=False, indent=1)
    subprocess.run([sys.executable, f"{HERE}/timeline.py"], check=True)


main()
