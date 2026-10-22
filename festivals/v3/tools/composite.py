#!/usr/bin/env python3
"""Compositor (run on molab): 3D plates + the Chromium type layer + the pixel-art calendar -> build/frames/NNNNN.jpg.
Captions reveal word by word on the narrator's measured word timings; the spoken word is lit in marigold, then settles."""
import json, math, os, sys
from multiprocessing import Pool
import numpy as np
from PIL import Image, ImageFilter
ROOTV = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILM = os.environ.get("FILM", "dashain")
HERE = ROOTV if FILM == "dashain" else f"{ROOTV}/{FILM}"
B = f"{ROOTV}/build" if FILM == "dashain" else f"{ROOTV}/build_{FILM}"
TL = json.load(open(f"{HERE}/timeline.json")); FPS = TL["fps"]; W, H = TL["w"], TL["h"]
LINES = {r["id"]: r for r in json.load(open(f"{HERE}/lines.json"))}
SPEC = dict(title=2, wish=(21, 22), pixel=11, nights=6, labels=(8, 10), flood=20) if FILM == "dashain" else \
       dict(title=2, wish=(18, 19), pixel=8, nights=None, labels=(), flood=None, ns=14)
SHOTS = TL["shots"]; BY = {s["id"]: s for s in SHOTS}
ACCENT = np.array([255, 179, 71], np.float32); TIKA = np.array([170, 8, 18], np.float32)
DAY_OF_SHOT = {11: 1, 12: 1, 13: 7, 14: 8, 15: 10, 16: 15} if FILM == "dashain" else {7: 1, 8: 2, 9: 3, 10: 3, 11: 3, 12: 4, 13: 4, 14: 4, 15: 5}
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


# ------------------------------------------------------------ Tihar pixel art: five diyas, and the Kukur Tihar dog
DIYA = ["...Y...", "..YOY..", "..OYO..", "...O...", "KbbbbbK", ".KbbbK.", "..KKK.."]
DOGL = """
................
....KK..........
...KbbK.........
...KbbbK........
...KbbBBKKKKKKKK
...KbBBBBBBBBBBB
....KBBBBBBBBBBR
....KBBBBBBBBBBR
....KBBBBBBBBBBB
...KBBBBKKKBBBBB
...KBBBKEWKBBBBB
...KBBBKEEKBBBBB
...KBBBBKKBBBBLL
...KBBBBBBBBBLLL
....KBBBBBBBLLLL
....KBBBBBBLLLKK
.....KBBBBBLLKNN
.....KBBBBBLLLKK
......KBBBBLLLLL
......KKBBBBLLLL
.....OoOYOoOYOoO
....oOYOoOYOoOYO
.....KoOoOoOoOoO
.....KBBBBLLLLLL
....KBBBBBLLLLLL
....KBBBBBLLLLLL
...KBBBBBBLLLLLL
...KBBBBBBBLLLLL
...KBBBKBBBLLLLL
...KBBBKBBBBLLLL
...KBBBKBBBBKLLL
...KBLLKBLLLKLLL
...KKKKKKKKKKKKK
"""
PAL = {"K": (30, 16, 12), "b": (92, 52, 28), "B": (150, 92, 48), "L": (226, 186, 132), "E": (16, 10, 10), "W": (255, 255, 255),
       "N": (40, 22, 20), "O": (255, 140, 20), "o": (220, 84, 10), "Y": (255, 205, 40), "R": (200, 14, 30)}


def _sprite(rows, mirror=True, pal=PAL):
    rows = [r for r in rows.strip("\n").split("\n")] if isinstance(rows, str) else rows
    if mirror: rows = [r + r[::-1] for r in rows]
    h, w = len(rows), max(len(r) for r in rows); im = np.zeros((h, w, 4), np.float32)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c in pal: im[y, x] = (*[v / 255 for v in pal[c]], 1)
    return im


def diya_strip(day, mag=5):
    n = 5; cell = 9; gap = 5; w = n * cell + (n - 1) * gap; im = np.zeros((10, w, 4), np.float32)
    for i in range(n):
        sp = _sprite(DIYA, mirror=False, pal={**PAL, "b": (150, 70, 40)})
        if i + 1 > day: sp[:4, :, :3] *= 0.25   # unlit flame
        x = i * (cell + gap) + 1; im[0:7, x:x + 7] = sp
        if i + 1 == day: im[8:10, x:x + 7] = [0.85, 0.05, 0.08, 1]
    return np.repeat(np.repeat(im, mag, 0), mag, 1)


def pixel_dog_scene(t):
    px = 6; lw, lh = W // px, H // px
    yy = np.linspace(0, 1, lh)[:, None, None]
    img = (np.array([14, 10, 30]) * (1 - yy) + np.array([70, 18, 26]) * yy) * np.ones((1, lw, 1))
    rng = np.random.default_rng(2)
    for _ in range(lw * lh // 160):
        x, y = rng.integers(0, lw), rng.integers(0, int(lh * 0.5)); tw = 0.6 + 0.4 * math.sin(t * 3 + x)
        img[y, x] = np.array([255, 236, 200]) * tw
    dw, dh = lw // 2, int(lh * 0.36); dx = (lw - dw) // 2; dy = int(lh * 0.62) - dh
    img[dy - 2:dy + dh, dx - 2:dx + dw + 2] = (40, 16, 10); img[dy:dy + dh, dx:dx + dw] = (255, 170, 70); img[dy + 2:dy + dh, dx + 2:dx + dw - 2] = (255, 200, 110)
    floor = int(lh * 0.62); img[floor:] = (70, 30, 20); img[floor:floor + 1] = (120, 55, 30)
    for k in range(0, lw, 4):
        yk = dy - 4 + int(2 * math.sin(k / 3)); img[yk:yk + 2, k:k + 2] = (255, 140, 20) if (k // 4) % 2 else (255, 205, 40)
    def blit(sp, x0, y0, s=1):
        sp = np.repeat(np.repeat(sp, s, 0), s, 1); hh, ww = sp.shape[:2]
        reg = img[y0:y0 + hh, x0:x0 + ww]; a = sp[:reg.shape[0], :reg.shape[1], 3:4]
        img[y0:y0 + hh, x0:x0 + ww] = reg * (1 - a) + sp[:reg.shape[0], :reg.shape[1], :3] * 255 * a
    dog = _sprite(DOGL); s = 3; gx = (lw - dog.shape[1] * s) // 2; gy = floor + 6 - dog.shape[0] * s
    bob = int(round(math.sin(t * 7) * 0.6))
    blit(dog, gx, gy + bob, s)
    # tail: a little wagging stub to the right of the body
    ta = math.sin(t * 14) * 0.9
    for k in range(6):
        x = gx + dog.shape[1] * s - 2 + int(k * math.cos(ta)); y = gy + dog.shape[0] * s - 18 - int(k * (0.8 + math.sin(ta) * 0.6))
        img[max(0, y):y + 2, x:x + 2] = (150, 92, 48)
    di = _sprite(DIYA, mirror=False, pal={**PAL, "b": (150, 70, 40)})
    for k in range(6):
        x = int(lw * (0.06 + 0.17 * k)); f = 1 if math.sin(t * 9 + k * 2) > -0.3 else 0
        d2 = di.copy(); d2[0, :, :3] *= f
        blit(d2, x, floor + 14, 2)
    up = np.repeat(np.repeat(img.astype(np.float32), px, 0), px, 1)
    out = np.zeros((H, W, 3), np.float32); out[:up.shape[0], :up.shape[1]] = up[:H, :W]
    return out


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
    g = rng.normal(0, 2.4, (H // 2, W // 2, 1)).astype(np.float32)
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
    src = SPEC["wish"][0] if sid == SPEC["wish"][1] else sid
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
    if KEYS is not None and sid != SPEC["pixel"]: return plate_keys(f, sid)
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
    if sid == SPEC["pixel"]: fr = bg_pixel(t) if FILM == "dashain" else pixel_dog_scene(t)
    else: fr = plate(f, sid)
    # transitions: section change = dip through black; otherwise a short dissolve from the last frame of the previous shot
    i = SHOTS.index(s)
    if i > 0 and sid != 2:
        prev = SHOTS[i - 1]; sec_change = prev["section"] != s["section"]
        L = 0.5 if sec_change else 0.3
        if tl < L:
            k = ease(tl / L)
            if sec_change: fr = fr * k
            else:
                pf = (bg_pixel(prev["start"] + prev["dur"]) if FILM == "dashain" else pixel_dog_scene(prev["start"] + prev["dur"])) if prev["id"] == SPEC["pixel"] else plate(prev["f1"] - 1, prev["id"])
                if SPEC["flood"] and sid == SPEC["flood"] + 1: pf = np.ones_like(fr) * TIKA
                fr = pf * (1 - k) + fr * k
    if i < len(SHOTS) - 1 and SHOTS[i + 1]["section"] != s["section"] and sid != SPEC["flood"]:
        fr = fr * (1 - ease((tl - (s["dur"] - 0.45)) / 0.45))
    if sid == 1: fr = fr * ease(tl / 1.2)
    # blessing -> the frame floods tika red as the rice reaches the lens; the wish shot begins red and clears
    if SPEC["flood"] and sid == SPEC["flood"]: fr = fr * (1 - ease((u - 0.8) / 0.2)) + TIKA * ease((u - 0.8) / 0.2)
    if SPEC["flood"] and sid == SPEC["flood"] + 1: fr = fr * ease(tl / 1.2) + TIKA * (1 - ease(tl / 1.2))
    # type
    W0, W1 = SPEC["wish"]
    if sid == SPEC["title"]:
        ti = img(f"{B}/type/title.png"); k = ease(tl / 0.9); sc_ = 0.92 + 0.08 * ease(tl / 3.0)
        over(fr, ti, (W - ti.shape[1] * sc_) / 2, 760 + (1 - k) * 30, k * (1 - ease((tl - 2.7) / 0.5)), scale=sc_)
    elif sid in (W0, W1):
        wi = img(f"{B}/type/wish.png")
        k = ease((t - BY[W0]["start"] - 0.8) / 0.8) * (1 - ease((t - (TL["duration"] - 0.8)) / 0.8))
        over(fr, wi, (W - wi.shape[1]) / 2, 1080 + (1 - k) * 24, k)
        if sid == W1:
            si = img(f"{B}/type/sign.png"); k2 = ease((tl - 0.3) / 0.6) * (1 - ease((t - (TL["duration"] - 0.8)) / 0.8))
            over(fr, si, (W - si.shape[1]) / 2, 1560, k2)
        if sid == W0 and os.path.exists(f"{B}/type/cap_{W0}.json"): caption(fr, W0, t)
    else:
        caption(fr, sid, t)
    if SPEC.get("ns") and sid == SPEC["ns"]:
        ns = img(f"{B}/type/ns.png"); k = ease((u - 0.25) / 0.2)
        over(fr, ns, (W - ns.shape[1]) / 2, 330 + (1 - k) * 30, k * (1 - ease((u - 0.93) / 0.07)))
    if sid == SPEC["nights"]:  # the nine nights, one Navadurga per night
        sh = 0.74; n = min(9, int(u / sh * 9) + 1) if u < sh else None
        if n:
            ln = img(f"{B}/type/night_{n}.png"); tn = (u * s["dur"]) - (n - 1) * sh * s["dur"] / 9
            a = ease(tn / 0.25) * (1 - ease((tn - sh * s["dur"] / 9 + 0.15) / 0.15))
            over(fr, ln, (W - ln.shape[1]) / 2, 250, a)
    if sid in SPEC["labels"]:
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
    if FILM == "tihar" and sid in DAY_OF_SHOT:
        st = diya_strip(DAY_OF_SHOT[sid], 5); over(fr, st, (W - st.shape[1]) / 2, 150, 0.95)
    if FILM == "dashain" and sid in DAY_OF_SHOT:  # pixel calendar: centre-stage in shot 11, docked at the top for the days
        day = DAY_OF_SHOT[sid]
        if sid == 14 and u > 0.47: day = 9
        if sid == 11:
            st = strip(1, (7, 8, 9, 10, 15), mag=3); k = ease(tl / 0.6)
            over(fr, st, (W - st.shape[1]) / 2, 820, k)
        else:
            st = strip(day, (1, 7, 8, 9, 10, 15), mag=2)
            over(fr, st, (W - st.shape[1]) / 2, 170, 0.95)
    fr = finish(fr, f)
    Image.fromarray(fr.astype(np.uint8)).save(out, quality=97, subsampling=0)


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
