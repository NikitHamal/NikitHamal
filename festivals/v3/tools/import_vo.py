#!/usr/bin/env python3
"""Import a re-recorded narration: narration/takes/NN.(wav|mp3|m4a|flac), or one long takes/all.* split on silences.
-> audio/vo/NN.mp3 (trimmed, mono 48 kHz), new vo_dur and estimated word timings in lines.json, then timeline.py.
Word timings: the voiced stretch of each clip is divided among the words by length in aksharas (Devanagari units),
nudged onto the nearest pauses in the energy envelope, so the captions keep lighting up as each word is spoken."""
import glob, json, os, re, subprocess, sys
import numpy as np
import soundfile as sf
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); TAKES = f"{HERE}/narration/takes"; SR = 48000


def decode(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def env(y, hop=480):
    n = len(y) // hop; return np.sqrt(np.mean(y[:n * hop].reshape(n, hop) ** 2, 1) + 1e-12)


def trim(y, pad=0.12):
    e = env(y); th = max(e.max() * 0.03, 1e-4); on = np.where(e > th)[0]
    if not len(on): return y
    a = max(0, on[0] * 480 - int(pad * SR)); b = min(len(y), (on[-1] + 1) * 480 + int(pad * SR)); return y[a:b]


def aksharas(w):
    return max(1, len(re.findall(r"[अ-हक़-ॡॲ-ॿ]", w)))


def words_timing(y, words):
    e = env(y); t = np.arange(len(e)) * 480 / SR; th = e.max() * 0.06
    v = np.where(e > th)[0]; t0, t1 = (t[v[0]], t[v[-1]] + 0.01) if len(v) else (0, len(y) / SR)
    wts = np.array([aksharas(w) for w in words], float); cum = np.concatenate([[0], np.cumsum(wts)]) / wts.sum()
    bounds = t0 + cum * (t1 - t0)
    quiet = e < th * 1.5
    for i in range(1, len(bounds) - 1):  # snap inner boundaries to a nearby pause if one is within 120 ms
        j = int(bounds[i] * SR / 480); lo, hi = max(0, j - 12), min(len(e), j + 12)
        q = np.where(quiet[lo:hi])[0]
        if len(q): bounds[i] = (lo + q[np.argmin(np.abs(q + lo - j))]) * 480 / SR
    return [[w, round(float(bounds[i]), 3), round(float(bounds[i + 1]), 3)] for i, w in enumerate(words)]


def split_long(y, n):
    e = env(y); quiet = e < e.max() * 0.03; gaps = []; i = 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]: j += 1
            gaps.append((j - i, i, j)); i = j
        else: i += 1
    cuts = sorted(sorted(gaps, reverse=True)[:n - 1], key=lambda g: g[1])
    edges = [0] + [((a + b) // 2) * 480 for _, a, b in cuts] + [len(y)]
    return [y[edges[k]:edges[k + 1]] for k in range(n)]


def align_el(mp3, text):
    """Exact word timings from ElevenLabs forced alignment (free with any key in $ELEVEN_KEY)."""
    key = os.environ.get("ELEVEN_KEY")
    if not key: return None
    r = subprocess.run(["curl", "-s", "-X", "POST", "https://api.elevenlabs.io/v1/forced-alignment", "-H", f"xi-api-key: {key}",
                        "-F", f"file=@{mp3}", "-F", f"text={text}"], capture_output=True, text=True)
    try: ws = json.loads(r.stdout)["words"]
    except Exception: return None
    return [[w["text"], round(w["start"], 3), round(w["end"], 3)] for w in ws if w["text"].strip() and w["text"].strip() != "—"]


def main():
    L = json.load(open(f"{HERE}/lines.json")); voiced = [r for r in L if r.get("speak")]
    files = {int(os.path.basename(p)[:2]): p for p in glob.glob(f"{TAKES}/[0-9][0-9].*")}
    longs = glob.glob(f"{TAKES}/all.*")
    clips = {}
    if longs and not files:
        for r, y in zip(voiced, split_long(decode(longs[0]), len(voiced))): clips[r["id"]] = y
    else:
        for r in voiced:
            if r["id"] in files: clips[r["id"]] = decode(files[r["id"]])
    if not clips: sys.exit("no takes found in narration/takes/")
    for r in voiced:
        if r["id"] not in clips: print("keeping old clip for line", r["id"]); continue
        y = trim(clips[r["id"]]); y = y / (np.abs(y).max() + 1e-9) * 0.9
        wav = f"/tmp/vo_{r['id']:02d}.wav"; sf.write(wav, y, SR)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", "192k", f"{HERE}/audio/vo/{r['id']:02d}.mp3"], check=True)
        r["vo_dur"] = round(len(y) / SR, 3)
        r["words"] = align_el(f"{HERE}/audio/vo/{r['id']:02d}.mp3", r["speak"]) or words_timing(y, r["speak"].split()); r["voice"] = "owner take"
        print(f"line {r['id']:2d}: {r['vo_dur']:.2f} s, {len(r['words'])} words")
    json.dump(L, open(f"{HERE}/lines.json", "w"), ensure_ascii=False, indent=1)
    subprocess.run([sys.executable, f"{HERE}/timeline.py"], check=True)


main()
