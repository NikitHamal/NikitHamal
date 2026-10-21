#!/usr/bin/env python3
"""Compositor (run on molab): 3D plates + the Chromium type layer + the pixel-art calendar -> build/frames/NNNNN.jpg.
Captions reveal word by word on the narrator's measured word timings; the spoken word is lit in marigold, then settles."""
import json, math, os, sys
from multiprocessing import Pool
import numpy as np
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); B = f"{HERE}/build"
TL = json.load(open(f"{HERE}/timeline.json")); FPS = TL["fps"]; W, H = TL["w"], TL["h"]
LINES = {r["id"]: r for r in json.load(open(f"{HERE}/lines.json"))}
SHOTS = TL["shots"]; BY = {s["id"]: s for s in SHOTS}
ACCENT = np.array([255, 179, 71], np.float32); TIKA = np.array([170, 8, 18], np.float32)
DAY_OF_SHOT = {11: 1, 12: 1, 13: 7, 14: 8, 15: 10, 16: 15}
_cache = {}


def img(path):
    if path not in _cache:
        _cache[path] = np.asarray(Image.open(path).convert("RGBA")).astype(np.float32) / 255.0 if os.path.exists(path) else None
    return _cache[path]


def ease(t):
    t = min(1.0, max(0.0, t)); return t * t * t * (t * (6 * t - 15) + 10)


def over(dst, src, x, y, alpha=1.0, tint=None, tint_k=0.0, scale=1.0):
    """Alpha-composite src (HxWx4, 0..1) onto dst (HxWx3, 0..255 float) with its top-left at (x, y)."""
    if src is None or alpha <= 0.001: return
    if scale != 1.0:
        h, w = src.shape[:2]
        im = Image.fromarray((src * 255).astype(np.uint8), "RGBA").resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
        src = np.asarray(im).astype(np.float32) / 255.0
    h, w = src.shape[:2]; x, y = int(round(x)), int(round(y))
    x0, y0 = max(0, x), max(0, y); x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0: return
    s = src[y0 - y:y1 - y, x0 - x:x1 - x]
    rgb = s[..., :3] * 255.0
    if tint is not None and tint_k > 0: rgb = rgb * (1 - tint_k) + (rgb / 255.0) * tint * tint_k * 1.0 + 0 * rgb
    a = s[..., 3:4] * alpha
    d = dst[y0:y1, x0:x1]; d[:] = d * (1 - a) + rgb * a


# ------------------------------------------------------------ pixel-art moon calendar (15 tithis of Shukla paksha)
def moon_sprite(day, px=18, lit=True):
    """A pixel moon on a px*px grid: illuminated fraction for tithi `day` (1..15), waxing (lit from the right)."""
    yy, xx = np.mgrid[0:px, 0:px] + 0.5; c = px / 2; r = px / 2 - 1
    d = (xx - c) ** 2 + (yy - c) ** 2 <= r * r
    k = day / 15.0                                      # fraction of the way from new to full
    tx = np.cos(np.pi * k)                              # terminator position, +1 = new, -1 = full
    xn = (xx - c) / r; yn = np.clip((yy - c) / r, -1, 1); half = np.sqrt(np.maximum(0, 1 - yn ** 2))
    litm = d & (xn >= tx * half)
    out = np.zeros((px, px, 4), np.float32)
    dark = np.array([0.16, 0.15, 0.2, 1.0]); bright = np.array([1.0, 0.93, 0.78, 1.0]) if lit else np.array([0.55, 0.5, 0.45, 1.0])
    out[d] = dark; out[litm] = bright
    rim = d & ~((xx - c) ** 2 + (yy - c) ** 2 <= (r - 1) ** 2); out[rim & ~litm] = [0.3, 0.28, 0.35, 1]
    return out


def strip(active, highlight=(), cell=18, gap=6, mag=4):
    n = 15; w = n * cell + (n - 1) * gap; im = np.zeros((cell + 10, w, 4), np.float32)
    for i in range(n):
        s = moon_sprite(i + 1, cell, lit=i + 1 <= active)
        x = i * (cell + gap); im[0:cell, x:x + cell] = s
        if i + 1 == active:
            im[cell + 4:cell + 8, x + 3:x + cell - 3] = [0.85, 0.05, 0.08, 1]      # red tika marker under today
        elif i + 1 in highlight:
            im[cell + 5:cell + 7, x + 7:x + cell - 7] = [1.0, 0.7, 0.28, 1]
    big = np.repeat(np.repeat(im, mag, 0), mag, 1)
    return big


# ------------------------------------------------------------ captions
def caption(dst, sid, t_abs):
    r = LINES[sid]; s = BY[sid]
    meta_p = f"{B}/type/cap_{sid}.json"
    if not os.path.exists(meta_p) or not s.get("vo_at"): return
    meta = json.load(open(meta_p)); words = meta["words"]; spoken = r.get("words", [])
    end = s["start"] + s["dur"]
    out_k = 1 - ease((t_abs - (end - 0.35)) / 0.3)
    n, m = len(words), max(1, len(spoken))
    for k, (box, w) in enumerate(zip(meta["boxes"], words)):
        j = min(m - 1, int(round(k * (m - 1) / max(1, n - 1)))) if spoken else 0
        w0 = s["vo_at"] + (spoken[j][1] if spoken else k * 0.3) - 0.08
        w1 = s["vo_at"] + (spoken[j][2] if spoken else k * 0.3 + 0.3)
        a = ease((t_abs - w0) / 0.28) * out_k
        if a <= 0: continue
        rise = (1 - ease((t_abs - w0) / 0.4)) * 22
        hot = 1.0 if w0 <= t_abs <= w1 else max(0.0, 1 - (t_abs - w1) / 0.5) if t_abs > w1 else 0.0
        over(dst, img(f"{B}/type/cap_{sid}/w{k}.png"), box[0], box[1] + rise, a, ACCENT, 0.85 * hot)
    kick = img(f"{B}/type/kick_{sid}.png")
    if kick is not None:
        top = min(b[1] for b in meta["boxes"])
        ka = ease((t_abs - s["start"] - 0.15) / 0.4) * out_k
        over(dst, kick, (W - kick.shape[1]) / 2, top - kick.shape[0] - 6 + (1 - ka) * 10, ka)


def grade(fr, t, rng):
    yy, xx = np.mgrid[0:H, 0:W]
    return fr


VIG = None


def finish(fr, f):
    global VIG
    if VIG is None:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        d = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2)
        VIG = (1 - 0.38 * np.clip(d - 0.35, 0, 1) ** 1.6)[..., None].astype(np.float32)
    rng = np.random.default_rng(f)
    g = rng.normal(0, 4.2, (H // 2, W // 2, 1)).astype(np.float32)
    g = np.repeat(np.repeat(g, 2, 0), 2, 1)
    return np.clip(fr * VIG + g, 0, 255)


def _load(p):
    im = Image.open(p).convert("RGB")
    if im.size != (W, H): im = im.resize((W, H), Image.LANCZOS)   # plates may be rendered below 1080x1920
    return np.asarray(im).astype(np.float32)


KEYS = json.load(open(f"{B}/keys/keys.json")) if os.path.exists(f"{B}/keys/keys.json") else None
KMARKS = json.load(open(f"{B}/keys/marks.json")) if os.path.exists(f"{B}/keys/marks.json") else {}
_kc = {}


def _key(sid, k):
    p = f"{B}/keys/s{sid}_{k}.png"
    if p not in _kc: _kc[p] = Image.open(p).convert("RGB") if os.path.exists(p) else Image.new("RGB", (W, H))
    return _kc[p]


def push(sid, u):
    """The 2D camera on a locked key: a slow push-in with a small drift; returns the crop window (x0, y0, w, h) in 0..1."""
    z = 1.0 + 0.085 * ease(u); cw, ch = 1 / z, 1 / z
    dx = [0.5, 0.45, 0.55, 0.5][sid % 4]; dy = [0.5, 0.52, 0.48, 0.46][(sid // 4) % 4]
    cx = 0.5 + (dx - 0.5) * ease(u); cy = 0.5 + (dy - 0.5) * ease(u)
    return min(max(0.0, cx - cw / 2), 1 - cw), min(max(0.0, cy - ch / 2), 1 - ch), cw, ch


def key_blend(sid, t, d):
    """Which key(s) show at shot time t: hold each key, dissolve around the midpoint between key times."""
    src = 21 if sid == 22 else sid
    us = KEYS[str(src)][1]; xf = KEYS[str(src)][2]; tk = [x * d for x in us]
    if src != sid: return [(src, 0, 1.0)]
    for k in range(len(tk) - 1):
        m = (tk[k] + tk[k + 1]) / 2; w = max(1e-3, min(xf, tk[k + 1] - tk[k]))
        if t < m + w / 2:
            a = ease((t - (m - w / 2)) / w)
            return [(src, k, 1 - a), (src, k + 1, a)] if a > 0 else [(src, k, 1.0)]
    return [(src, len(tk) - 1, 1.0)]


def plate_keys(f, sid):
    s = BY[sid]; t = f / FPS - s["start"]; u = t / s["dur"]
    x0, y0, cw, ch = push(sid, u); out = None
    for src, k, a in key_blend(sid, t, s["dur"]):
        im = _key(src, k); iw, ih = im.size
        box = (x0 * iw, y0 * ih, (x0 + cw) * iw, (y0 + ch) * ih)
        arr = np.asarray(im.resize((W, H), Image.BICUBIC, box=box)).astype(np.float32)
        out = arr * a if out is None else out + arr * a
    return out


def key_marks(sid, f):
    s = BY[sid]; t = f / FPS - s["start"]; u = t / s["dur"]
    src, k, a = max(key_blend(sid, t, s["dur"]), key=lambda x: x[2])
    mk = KMARKS.get(f"{sid}_{k}")
    if not mk: return None
    x0, y0, cw, ch = push(sid, u)
    return {n: ((x - x0) / cw, (y - y0) / ch, z) for n, (x, y, z) in mk.items()}


def plate(f, sid):
    if KEYS is not None and sid != 11: return plate_keys(f, sid)
    p = f"{B}/plates/{f:05d}.png"
    if os.path.exists(p): return _load(p)
    # missing frame (e.g. plates rendered on twos): nearest earlier existing frame inside the shot
    s = BY[sid]
    for g in range(f - 1, s["f0"] - 1, -1):
        q = f"{B}/plates/{g:05d}.png"
        if os.path.exists(q): return _load(q)
    return np.zeros((H, W, 3), np.float32)


def bg_pixel(t):
    """Shot 11 background: deep night gradient with slow drifting pixel stars (the one pixel-art interlude)."""
    yy = np.linspace(0, 1, H)[:, None, None]
    fr = (np.array([8, 6, 18]) * (1 - yy) + np.array([40, 8, 14]) * yy) * np.ones((1, W, 1))
    rng = np.random.default_rng(3); n = 160
    xs = rng.integers(0, W // 6, n) * 6; ys = rng.integers(0, H // 6, n) * 6; ph = rng.random(n) * 6.28
    for x, y, p_ in zip(xs, ys, ph):
        b = 120 + 120 * (0.5 + 0.5 * math.sin(t * 2 + p_))
        fr[y:y + 6, x:x + 6] = b
    return fr.astype(np.float32)


def frame(f):
    out = f"{B}/frames/{f:05d}.jpg"
    if os.path.exists(out): return
    t = f / FPS
    s = next(x for x in SHOTS if x["f0"] <= f < x["f1"]) if f < SHOTS[-1]["f1"] else SHOTS[-1]
    sid = s["id"]; tl = t - s["start"]; u = tl / s["dur"]
    fr = bg_pixel(t) if sid == 11 else plate(f, sid)
    # transitions: section change = dip through black; otherwise a short dissolve from the last frame of the previous shot
    i = SHOTS.index(s)
    if i > 0 and sid != 2:
        prev = SHOTS[i - 1]; sec_change = prev["section"] != s["section"]
        L = 0.5 if sec_change else 0.3
        if tl < L:
            k = ease(tl / L)
            if sec_change: fr = fr * k
            else:
                pf = bg_pixel(prev["start"] + prev["dur"]) if prev["id"] == 11 else plate(prev["f1"] - 1, prev["id"])
                if sid == 21: pf = np.ones_like(fr) * TIKA
                fr = pf * (1 - k) + fr * k
    if i < len(SHOTS) - 1 and SHOTS[i + 1]["section"] != s["section"] and sid not in (20,):
        fr = fr * (1 - ease((tl - (s["dur"] - 0.45)) / 0.45))
    if sid == 1: fr = fr * ease(tl / 1.2)
    # blessing -> the frame floods tika red as the rice reaches the lens; the wish shot begins red and clears
    if sid == 20: fr = fr * (1 - ease((u - 0.8) / 0.2)) + TIKA * ease((u - 0.8) / 0.2)
    if sid == 21: fr = fr * ease(tl / 1.2) + TIKA * (1 - ease(tl / 1.2))
    # type
    if sid == 2:
        ti = img(f"{B}/type/title.png"); k = ease(tl / 0.9); sc_ = 0.92 + 0.08 * ease(tl / 3.0)
        over(fr, ti, (W - ti.shape[1] * sc_) / 2, 760 + (1 - k) * 30, k * (1 - ease((tl - 2.7) / 0.5)), scale=sc_)
    elif sid in (21, 22):
        wi = img(f"{B}/type/wish.png")
        k = ease((t - BY[21]["start"] - 0.8) / 0.8) * (1 - ease((t - (TL["duration"] - 0.8)) / 0.8))
        over(fr, wi, (W - wi.shape[1]) / 2, 1080 + (1 - k) * 24, k)
        if sid == 22:
            si = img(f"{B}/type/sign.png"); k2 = ease((tl - 0.3) / 0.6) * (1 - ease((t - (TL["duration"] - 0.8)) / 0.8))
            over(fr, si, (W - si.shape[1]) / 2, 1560, k2)
        if sid == 21: caption(fr, 21, t) if os.path.exists(f"{B}/type/cap_21.json") else None
    else:
        caption(fr, sid, t)
    if sid == 6:  # the nine nights, one Navadurga per night
        sh = 0.74; n = min(9, int(u / sh * 9) + 1) if u < sh else None
        if n:
            ln = img(f"{B}/type/night_{n}.png"); tn = (u * s["dur"]) - (n - 1) * sh * s["dur"] / 9
            a = ease(tn / 0.25) * (1 - ease((tn - sh * s["dur"] / 9 + 0.15) / 0.15))
            over(fr, ln, (W - ln.shape[1]) / 2, 250, a)
    if sid in (8, 10):
        mp = f"{B}/plates/marks_{sid}.json"
        if KEYS is not None or os.path.exists(mp):
            mk = key_marks(sid, f) if KEYS is not None else json.load(open(mp)).get(str(f))
            if mk:
                for name, (x, y, z) in mk.items():
                    if sid == 8 and name == "gorkha": continue
                    lb = img(f"{B}/type/label_{name}.png")
                    a = ease((u - (0.6 if sid == 8 else 0.1)) / 0.15)
                    if name == "west": a *= ease((u - 0.7) / 0.15)
                    px, py = x * W, y * H
                    fr[int(py) - 1:int(py) + 2, int(px) - 1:int(px) + 2] = fr[int(py) - 1:int(py) + 2, int(px) - 1:int(px) + 2] * (1 - a) + 255 * a
                    over(fr, lb, min(max(24, px - lb.shape[1] / 2), W - lb.shape[1] - 24), py - lb.shape[0] - 18, a)
    if sid in DAY_OF_SHOT:  # pixel calendar: centre-stage in shot 11, docked at the top for the days
        day = DAY_OF_SHOT[sid]
        if sid == 14 and u > 0.47: day = 9
        if sid == 11:
            st = strip(1, (7, 8, 9, 10, 15), mag=3); k = ease(tl / 0.6)
            over(fr, st, (W - st.shape[1]) / 2, 820, k)
        else:
            st = strip(day, (1, 7, 8, 9, 10, 15), mag=2)
            over(fr, st, (W - st.shape[1]) / 2, 170, 0.95)
    fr = finish(fr, f)
    Image.fromarray(fr.astype(np.uint8)).save(out, quality=94, subsampling=0)


if __name__ == "__main__":
    os.makedirs(f"{B}/frames", exist_ok=True)
    fs = range(TL["frames"])
    if len(sys.argv) > 1 and sys.argv[1] == "--only": fs = [int(x) for x in sys.argv[2].split(",")]
    if len(sys.argv) > 1 and sys.argv[1] == "--shots":
        ids = [int(x) for x in sys.argv[2].split(",")]; fs = [f for s in SHOTS if s["id"] in ids for f in range(s["f0"], s["f1"])]
    with Pool(int(os.environ.get("WORKERS", os.cpu_count() or 4))) as p:
        for k, _ in enumerate(p.imap_unordered(frame, fs, chunksize=8)):
            if k % 300 == 0: print("composite", k, flush=True)
    print("composite done")
