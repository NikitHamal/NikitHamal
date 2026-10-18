"""Graphite pencil portrait, drawn stroke by stroke.
Tone comes from thousands of short pencil strokes placed where the drawing is still lighter than the
reference, each following the form (isophote flow) blended with a diagonal hatch; then crisp pencil
lines for the features from face landmarks. Output: stroke list (for the timelapse) + preview png."""
import sys, json, math, random, struct, numpy as np, cv2
from PIL import Image
W, H = 800, 1000

def load(name):
    img = np.asarray(Image.open(f'/tmp/paint/ref/{name}_st.png').convert('RGB')).astype(np.float32)
    cat = np.load(f'/tmp/mp/{name}_cat.npy'); lm = np.array(json.load(open(f'/tmp/mp/{name}_lm.json'))['lm'])
    return img, cat, lm

def target(img, cat, name):
    cat = cat.copy()
    person = (cat > 0).astype(np.uint8); n, lab, st, _ = cv2.connectedComponentsWithStats(person); keep = lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
    if name == 'kid': pass
    lum = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    if name == 'baby': lum = cv2.bilateralFilter(cv2.GaussianBlur(lum, (0, 0), 1.6), 9, 0.08, 6)   # old printed photo: lose the halftone dots
    if name == 'kid':  # no garland: paint the shirt through where it was
        hsv = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2HSV); low = np.arange(cat.shape[0])[:, None] > 560
        gm = (((hsv[..., 0] >= 8) & (hsv[..., 0] <= 32) & (hsv[..., 1] > 90) & (hsv[..., 2] > 120)) | (cat == 5)) & low
        gm = cv2.morphologyEx(gm.astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((25, 25))); gm = cv2.dilate(gm, np.ones((19, 19)))
        lum = cv2.inpaint((lum * 255).astype(np.uint8), gm, 21, cv2.INPAINT_TELEA).astype(np.float32) / 255
        cat = cat.copy(); cat[gm > 0] = 4
    # values: the person's own light range mapped onto paper→graphite, plus a little local sharpening
    v = lum[keep]; lo, hi = np.percentile(v, 2), np.percentile(v, 99)
    t = np.clip(1 - (lum - lo) / (hi - lo + 1e-6), 0, 1) ** 1.25
    face = (cat == 3) | (cat == 2)
    t = t + 0.7 * (t - cv2.GaussianBlur(t, (0, 0), 6))
    t = np.where(face, t * 0.8, t)
    t = np.where(cat == 1, np.clip(t * 1.1 + 0.08, 0, 0.97), t)
    if name in ('curls',):   # the completed crown (above the photo's original top edge): mirror the real hair's texture up into it
        ys_ = np.arange(cat.shape[0]); cr = (cat == 1) & (ys_[:, None] < 212)
        yy_, xx_ = np.nonzero(cr); ym = np.clip(2 * 212 - yy_, 0, cat.shape[0] - 1)
        src = t[ym, xx_]; ok = cat[ym, xx_] == 1
        t[yy_[ok], xx_[ok]] = np.maximum(src[ok], 0.7 if name == 'young' else 0.55)
        t[yy_[~ok], xx_[~ok]] = 0.78
    t = np.clip(t, 0, 0.97)
    al = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 2.5)
    return np.clip(t * al, 0, 1), keep, lum, face

def flow(lum, sigma):
    g = cv2.GaussianBlur(lum, (0, 0), 2)
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=5); gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=5)
    jxx = cv2.GaussianBlur(gx * gx, (0, 0), sigma); jyy = cv2.GaussianBlur(gy * gy, (0, 0), sigma); jxy = cv2.GaussianBlur(gx * gy, (0, 0), sigma)
    ang = 0.5 * np.arctan2(2 * jxy, jxx - jyy) + np.pi / 2
    coh = np.sqrt((jxx - jyy) ** 2 + 4 * jxy ** 2) / (jxx + jyy + 1e-6)
    return ang, coh

def draw(name, out):
    rnd = random.Random(5); np.random.seed(5)
    img, cat, lm = load(name); T, keep, lum, face = target(img, cat, name)
    ang, coh = flow(lum, 8); hair = cat == 1
    # 1) blending stump: a soft smudged graphite base (what artists do with a tortillon)
    smudge = cv2.GaussianBlur(T, (0, 0), 3.0) * 0.55
    C = smudge.copy(); strokes = []
    # feature zone (eyes, brows, nose, mouth) gets the fine pencil work
    fz = np.zeros((H, W), np.uint8); cv2.fillPoly(fz, [cv2.convexHull(lm[[70, 63, 105, 66, 107, 336, 296, 334, 293, 300, 263, 454 if False else 446, 291, 17, 61, 226, 33]].astype(np.int32))], 1)
    fz = cv2.dilate(fz, np.ones((15, 15))) > 0
    passes = [  # (length, width, alpha, step, follow form, coverage, angle, zone)
        (60, 1.6, 0.10, 3, 0.25, 0.80, -58, None), (46, 1.4, 0.10, 3, 0.25, 0.90, 32, None),
        (26, 1.2, 0.12, 2, 0.8, 0.96, -58, None), (10, 1.0, 0.16, 1.5, 0.9, 1.0, -58, fz)]
    for pi, (L, wd, a, stp, follow, goal, hdeg, zone) in enumerate(passes):
        HATCH = math.radians(hdeg)
        for it in range(40):
            deficit = np.clip(T * goal - C, 0, 1)
            if zone is not None: deficit = deficit * zone
            tot = deficit.sum()
            if tot < 200: break
            p = deficit.ravel() / tot; k = min(1500, int(tot / (a * L * wd) * 0.5) + 40)
            idx = np.random.choice(p.size, k, p=p); layer = np.zeros((H, W), np.float32)
            for i in idx:
                y0, x0 = divmod(int(i), W); pts = [(x0 + 0.5, y0 + 0.5)]
                for dirn in (1, -1):
                    cx, cy = x0 + 0.5, y0 + 0.5; ldx = None; seg = []
                    for _ in range(int(L / 2 / stp)):
                        xi, yi = int(cx), int(cy)
                        fa = ang[yi, xi]; f = 0.95 if hair[yi, xi] else follow * min(1, coh[yi, xi] * 2)
                        dx = math.cos(fa) * f + math.cos(HATCH) * (1 - f); dy = math.sin(fa) * f + math.sin(HATCH) * (1 - f)
                        mm = math.hypot(dx, dy) or 1; dx, dy = dx / mm, dy / mm
                        if ldx is None: dx, dy = dx * dirn, dy * dirn
                        elif dx * ldx + dy * ldy < 0: dx, dy = -dx, -dy
                        ldx, ldy = dx, dy; cx += dx * stp; cy += dy * stp
                        if not (0 <= cx < W - 1 and 0 <= cy < H - 1) or T[int(cy), int(cx)] * goal < C[int(cy), int(cx)] - 0.02: break
                        seg.append((cx, cy))
                    pts = seg[::-1] + pts if dirn == 1 else pts + seg
                if len(pts) < 3: continue
                arr = np.array(pts, np.float32)
                cv2.polylines(layer, [np.round(arr * 4).astype(np.int32).reshape(-1, 1, 2)], False, a, max(1, int(round(wd))), cv2.LINE_AA, shift=2)
                strokes.append((pi, arr))
            C = 1 - (1 - C) * (1 - np.clip(layer, 0, 0.6))
        print(name, 'pass', pi, 'strokes', len(strokes), 'meanC', round(float(C.mean()), 3), file=sys.stderr)
    # 2) crisp pencil work on the features
    det = np.zeros((H, W), np.float32)
    def pl(pts, a, w):
        arr = np.array(pts, np.float32); cv2.polylines(det, [np.round(arr * 4).astype(np.int32).reshape(-1, 1, 2)], False, a, max(1, int(round(w))), cv2.LINE_AA, shift=2); strokes.append((9, arr))
    def smooth(pts, n=24):
        pts = np.array(pts, np.float32); t_ = np.linspace(0, len(pts) - 1, n); out = []
        for u in t_:
            i = min(int(u), len(pts) - 2); f = u - i; out.append(pts[i] * (1 - f) + pts[i + 1] * f)
        out = np.array(out); return cv2.GaussianBlur(out.reshape(-1, 1, 2), (1, 5), 0).reshape(-1, 2) if len(out) > 5 else out
    for up, lo in (([33, 246, 161, 160, 159, 158, 157, 173, 133], [33, 7, 163, 144, 145, 153, 154, 155, 133]), ([263, 466, 388, 387, 386, 385, 384, 398, 362], [263, 249, 390, 373, 374, 380, 381, 382, 362])):
        pl(smooth(lm[up]), 0.7, 2.2); pl(smooth(lm[lo][2:-1]), 0.25, 1.1)
    for c, rr in ((468, (469, 471)), (473, (474, 476))):
        if len(lm) > 477:
            r = np.linalg.norm(lm[rr[0]] - lm[rr[1]]) / 2; ci = np.zeros((H, W), np.float32)
            cv2.circle(ci, tuple(np.round(lm[c] * 4).astype(int)), int(r * 0.92 * 4), 0.42, -1, cv2.LINE_AA, shift=2); cv2.circle(ci, tuple(np.round(lm[c] * 4).astype(int)), int(r * 0.42 * 4), 0.8, -1, cv2.LINE_AA, shift=2)
            hl = (lm[c] - [r * 0.35, r * 0.4]); cv2.circle(ci, tuple(np.round(hl * 4).astype(int)), int(r * 0.28 * 4), -2, -1, cv2.LINE_AA, shift=2)
            det = np.maximum(det, ci * 0) + 0; C[:] = np.clip(np.where(ci < 0, C * 0.15, 1 - (1 - C) * (1 - np.clip(ci, 0, 1))), 0, 1)
    pl(smooth(lm[[78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308]]), 0.75, 2.0)
    C = 1 - (1 - C) * (1 - np.clip(det, 0, 0.9))
    return C, strokes, lm, T

if __name__ == '__main__':
    name = sys.argv[1]; C, strokes, lm, T = draw(name, None)
    paper = np.array([246, 243, 236], np.float32); graphite = np.array([46, 46, 52], np.float32)
    im = paper * (1 - C[..., None]) + graphite * C[..., None]
    Image.fromarray(np.clip(im, 0, 255).astype(np.uint8)).save(f'/tmp/pencil/{name}_tone.png')
    Image.fromarray(((1 - T) * 255).astype(np.uint8)).save(f'/tmp/pencil/{name}_T.png')
    sm = cv2.GaussianBlur(T, (0, 0), 3.0) * 0.55
    Image.fromarray(np.clip(paper * (1 - sm[..., None]) + graphite * sm[..., None], 0, 255).astype(np.uint8)).save(f'/tmp/pencil/{name}_smudge.png')
    # stroke list for the time-lapse: pass table + strokes (points thinned to every 3rd, int8 deltas)
    PASS = {0: (1.6, 0.10), 1: (1.4, 0.10), 2: (1.2, 0.12), 3: (1.0, 0.16), 9: (2.0, 0.6)}
    out = bytearray(b'PCL1') + struct.pack('<HHI', W, H, len(strokes)) + struct.pack('<B', len(PASS))
    for k, (w, a) in PASS.items(): out += struct.pack('<Bff', k, w, a)
    for pi, arr in strokes:
        pts = np.vstack([arr[::3], arr[-1:]]) if len(arr) > 4 else arr
        pts = np.round(pts).astype(int)[:255]
        out += struct.pack('<BBHH', pi, len(pts), max(0, min(W - 1, pts[0][0])), max(0, min(H - 1, pts[0][1])))
        for (ax, ay), (bx, by) in zip(pts, pts[1:]): out += struct.pack('<bb', max(-127, min(127, bx - ax)), max(-127, min(127, by - ay)))
    open(f'/tmp/pencil/{name}.pcl', 'wb').write(bytes(out)); print(name, 'pcl', len(out), file=sys.stderr)
