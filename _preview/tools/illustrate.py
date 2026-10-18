"""Code-drawn illustration: measures the face (landmarks) + regions (segmentation) and
authors an SVG drawing from scratch — ink contours, flowing hair strands, stubble, flat colour + cel shading."""
import sys, json, math, random, re, numpy as np, cv2
from PIL import Image
random.seed(11); np.random.seed(11)
INK = '#1d1714'

def smooth_path(pts, closed=False, t=0.5):
    pts = [tuple(p) for p in pts]
    if len(pts) < 2: return ''
    if closed: P = [pts[-1]] + pts + [pts[0], pts[1]]
    else: P = [pts[0]] + pts + [pts[-1]]
    d = f'M{P[1][0]:.0f},{P[1][1]:.0f}'
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) * t / 3, p1[1] + (p2[1] - p0[1]) * t / 3)
        c2 = (p2[0] - (p3[0] - p1[0]) * t / 3, p2[1] - (p3[1] - p1[1]) * t / 3)
        d += f'C{c1[0]:.0f},{c1[1]:.0f} {c2[0]:.0f},{c2[1]:.0f} {p2[0]:.0f},{p2[1]:.0f}'
    return d + ('Z' if closed else '')

def resample(pts, step):
    pts = np.asarray(pts, float); out = [pts[0]]; acc = 0
    for a, b in zip(pts, pts[1:]):
        seg = np.linalg.norm(b - a)
        while acc + seg >= step:
            r = (step - acc) / seg; a = a + (b - a) * r; out.append(a); seg = np.linalg.norm(b - a); acc = 0
        acc += seg
    return np.array(out)

def contours(mask, min_area=200, eps=1.2, step=7, blur=2.5):
    m = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), blur) > 0.5
    k5 = np.ones((5, 5), np.uint8); m = cv2.morphologyEx(cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, k5), cv2.MORPH_CLOSE, k5) > 0  # no slivers
    cs, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); out = []
    for c in cs:
        if cv2.contourArea(c) < min_area: continue
        p = c.reshape(-1, 2).astype(float); p = resample(np.vstack([p, p[:1]]), step)
        if len(p) > 4: out.append(p)
    return out

def open_runs(p, W, H, m=4):
    # split a closed contour wherever it runs along the picture edge, so no frame line gets drawn
    ok = (p[:, 0] > m) & (p[:, 0] < W - m) & (p[:, 1] > m) & (p[:, 1] < H - m)
    if ok.all(): return [(p, True)]
    k = int(np.argmin(ok)); p, ok = np.roll(p, -k, 0), np.roll(ok, -k); runs, cur = [], []
    for q, o in zip(p, ok):
        if o: cur.append(q)
        elif cur: runs.append(cur); cur = []
    if cur: runs.append(cur)
    return [(np.array(r), False) for r in runs if len(r) > 2]

def hexc(c): c = np.clip(c, 0, 255).astype(int); return '#%02x%02x%02x' % tuple(c)

class Drawing:
    def __init__(s, W, H): s.W, s.H = W, H; s.fill = []; s.shade = []; s.ink = []; s.detail = []; s.soft = []
    def line(s, d, w=2.4, col=INK, layer='ink', op=1, cls=''):
        getattr(s, layer).append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w:.2f}" stroke-linecap="round" stroke-linejoin="round"{f" opacity=\"{op}\"" if op < 1 else ""}{f" class=\"{cls}\"" if cls else ""}/>')
    def shape(s, d, col, layer='fill', op=1, cls=''):
        getattr(s, layer).append(f'<path d="{d}" fill="{col}"{f" opacity=\"{op:.2f}\"" if op < 1 else ""}{f" class=\"{cls}\"" if cls else ""}/>')
    soft = []; skinclip = ''; hatch = ''
    def backdrop(s, seed):
        return f'<rect class="bgfill" width="{s.W}" height="{s.H}" fill="#f6f1e9"/>'
    def svg(s, eyes='', seed=1):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s.W} {s.H}"><defs><filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>'
                f'{s.backdrop(seed)}<g class="fills">{"".join(s.fill)}</g><g class="shades">{"".join(s.shade)}</g><clipPath id="skinclip">{s.skinclip}</clipPath><g clip-path="url(#skinclip)"><g class="soft" filter="url(#soft)">{"".join(s.soft)}</g></g>'
                f'<g class="hatch" style="display:none" fill="none" stroke="#3a2c26" stroke-width="0.9" stroke-linecap="round" opacity="0.45">{s.hatch}</g><g class="inks">{"".join(s.ink)}</g><g class="details">{"".join(s.detail)}</g>{eyes}</svg>')

def flow_lines(D, mask, lum, col, n_seeds=900, step=3.0, maxlen=60, sep=5, w=(0.9, 1.9), op=0.85, smooth=6):
    """Hair strands: streamlines of the structure-tensor orientation, kept apart by an occupancy grid."""
    H, W = mask.shape
    g = cv2.GaussianBlur(lum, (0, 0), 2.0)
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=5); gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=5)
    jxx = cv2.GaussianBlur(gx * gx, (0, 0), smooth); jyy = cv2.GaussianBlur(gy * gy, (0, 0), smooth); jxy = cv2.GaussianBlur(gx * gy, (0, 0), smooth)
    ang = 0.5 * np.arctan2(2 * jxy, jxx - jyy) + np.pi / 2  # along the strands
    occ = np.zeros((H // sep + 1, W // sep + 1), bool)
    ys, xs = np.nonzero(mask); idx = np.random.permutation(len(xs))[:n_seeds * 3]; made = 0
    for k in idx:
        if made >= n_seeds: break
        x0, y0 = float(xs[k]), float(ys[k])
        if occ[int(y0) // sep, int(x0) // sep]: continue
        line = []
        for dirn in (1, -1):
            x, y = x0, y0; pts = []; pdx = pdy = None
            for _ in range(int(maxlen / step)):
                xi, yi = int(x), int(y)
                if not (0 <= xi < W and 0 <= yi < H) or not mask[yi, xi]: break
                a = ang[yi, xi]; dx, dy = math.cos(a) * dirn, math.sin(a) * dirn
                if pdx is not None and dx * pdx + dy * pdy < 0: dx, dy = -dx, -dy
                pdx, pdy = dx, dy; x += dx * step; y += dy * step
                if occ[int(y) // sep if 0 <= y < H else 0, int(x) // sep if 0 <= x < W else 0] and len(pts) > 2: break
                pts.append((x, y))
            line = (pts[::-1] + [(x0, y0)] + line) if dirn == -1 else pts
        if len(line) < 5: continue
        for (x, y) in line:
            if 0 <= x < W and 0 <= y < H: occ[int(y) // sep, int(x) // sep] = True
        dark = 1 - float(np.mean([lum[int(min(H-1,y)), int(min(W-1,x))] for x, y in line])) / 255
        D.line(smooth_path(line[::2] + [line[-1]]), w=w[0] + (w[1] - w[0]) * dark, col=col, layer='detail', op=op); made += 1
    return made

def build(name, style_hair_n=900, beard_on=True, other_on=True):
    global BROW_K, LIFT_K; BROW_K = {'baby': 0.55, 'kid': 0.6, 'teen': 0.8}.get(name, 1.0); LIFT_K = {'baby': 0.35, 'kid': 0.35, 'teen': 0.7}.get(name, 1.0)
    meta = json.load(open(f'/tmp/mp/{name}_lm.json')); lm = np.array(meta['lm']); W, H = meta['W'], meta['H']
    cat = np.load(f'/tmp/mp/{name}_cat.npy'); img = np.asarray(Image.open(f'/tmp/paint/ref/{name}_st.png').convert('RGB')).astype(np.float32)
    lum = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
    hair, bskin, fskin, cloth, other = [cat == i for i in (1, 2, 3, 4, 5)]
    if not other_on: cloth |= other; other = np.zeros_like(other)
    fh = np.zeros(other.shape, np.uint8); cv2.fillPoly(fh, [cv2.convexHull(np.array(json.load(open(f'/tmp/mp/{name}_lm.json'))['lm'])[:468].astype(np.int32))], 1)
    nb, lb, sb, _ = cv2.connectedComponentsWithStats(other.astype(np.uint8))
    for j in range(1, nb):
        if (fh[lb == j]).mean() > 0.5 or sb[j, cv2.CC_STAT_AREA] < 3000: other[lb == j] = False; fskin[lb == j] = True; bskin[lb == j] = False
    skin = bskin | fskin
    if name == 'baby':
        k_ = np.ones((15, 15), np.uint8)
        skin = cv2.GaussianBlur(cv2.morphologyEx(cv2.morphologyEx(skin.astype(np.uint8), cv2.MORPH_CLOSE, k_), cv2.MORPH_OPEN, k_).astype(np.float32), (0, 0), 3) > 0.5
    # keep the main person only: largest component of the union
    person = (cat > 0).astype(np.uint8); n, lab, st, _ = cv2.connectedComponentsWithStats(person); big = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]); keep = lab == big
    hair &= keep; skin &= keep; cloth &= keep; other &= keep; fskin &= keep
    med = lambda m: np.median(img[m], 0) if m.sum() > 50 else np.array([120, 100, 90.])
    skin_c = med(fskin & (lum > np.percentile(lum[fskin], 35))); hair_c = med(hair); cloth_c = med(cloth); other_c = med(other)
    # stylise colours: warm the skin a little, keep hair near-black
    # stylised palette: warm brown skin at the photo's brightness, near-black hair, clothes nudged warm
    import colorsys
    hh, ll, ss = colorsys.rgb_to_hls(*(skin_c / 255)); skin_c = np.array(colorsys.hls_to_rgb(0.062, float(np.clip(0.55 + (ll - 0.55) * 0.6, 0.48, 0.64)), {'young': 0.33, 'teen': 0.37}.get(name, 0.44))) * 255
    hair_c = np.array([38, 30, 28.]); cloth_c = np.where(np.mean(cloth_c) > 140, np.array([238, 233, 224.]), cloth_c); cloth_c = cloth_c * 0.8 + np.mean(cloth_c) * 0.1 + np.array([12, 8, 0]); other_c = other_c * 0.9 + np.mean(other_c) * 0.1
    D = Drawing(W, H)
    fill_region = lambda m, c, layer='fill', op=1: [D.shape(smooth_path(p, True), hexc(c), layer, op) for p in contours(m, 300)]
    # ---- flat colour
    hair = cv2.morphologyEx(hair.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9))) > 0
    fill_region(cloth, cloth_c); fill_region(other, other_c); fill_region(skin, skin_c); [D.shape(smooth_path(p, True), hexc(hair_c)) for p in contours(hair, 2500, blur=3.5)]
    D.skinclip = ''.join(f'<path d="{smooth_path(p, True)}"/>' for p in contours(skin, 300))
    # ---- cel shading (two tones) from relative luminance inside each region
    def cel(m, base, levels=((0.80, 0.78), (0.62, 0.6)), hi=None, blur=5):
        if m.sum() < 200: return
        L = cv2.GaussianBlur(lum, (0, 0), blur); ref = np.median(L[m])
        sh = lambda mm, c, op=1: [D.shape(smooth_path(p, True), hexc(c), 'shade', op) for p in contours(mm, 900, step=9, blur=4)]
        for thr, k in levels: sh(m & (L < ref * thr), base * k)
        if hi: sh(m & (L > ref * hi[0]), np.minimum(255, base * hi[1]), 0.8)
    # ---- painted tones: many soft bands whose colours come from the photo itself, white-balanced so the
    # region's median lands on the stylised base colour (keeps real warmth/redness variation, consistent tone)
    def plaid(m):
        # buffalo check: red ground, translucent black bands both ways → dark squares where they cross
        clip = ''.join(f'<path d="{smooth_path(p, True)}"/>' for p in contours(m, 300))
        s_ = np.linalg.norm(lm[234] - lm[454]) / 300; cx0 = lm[152][0]; y0 = lm[152][1]; sp = 84 * s_; bw = 42 * s_; g = []
        for i in range(-12, 13):
            x = cx0 + i * sp; g.append(f'<rect x="{x:.0f}" y="{y0-40:.0f}" width="{bw:.0f}" height="1100" fill="#1d1416" opacity=".55"/>')
            y = y0 + 20 + i * sp; g.append(f'<rect x="0" y="{y:.0f}" width="800" height="{bw:.0f}" fill="#1d1416" opacity=".55"/>')
        for i in range(-24, 25):   # thin weave lines
            x = cx0 + i * sp / 2 + sp / 4; g.append(f'<rect x="{x:.0f}" y="{y0-40:.0f}" width="1.6" height="1100" fill="#000" opacity=".12"/>')
        D.shade.append(f'<clipPath id="plaidclip">{clip}</clipPath><g clip-path="url(#plaidclip)"><rect width="800" height="1000" fill="#b0262c"/>{"".join(g)}</g>')
        Lc = cv2.GaussianBlur(lum, (0, 0), 9); refc = np.median(Lc[m])
        for thr, op in ((0.8, 0.28), (0.62, 0.3)):
            [D.shape(smooth_path(p, True), '#000000', 'shade', op) for p in contours(m & (Lc < refc * thr), 500, step=8, blur=4)]
        [D.shape(smooth_path(p, True), '#ffffff', 'shade', 0.1) for p in contours(m & (Lc > refc * 1.25), 500, step=8, blur=4)]
        # placket + buttons
        D.line(f'M{cx0:.0f},{y0+70:.0f}L{cx0+4:.0f},1000', 1.6, op=0.5)
        for b in range(3): D.shape(f'M{cx0-5:.0f},{y0+120+b*90:.0f}a5,5 0 1,0 10,0a5,5 0 1,0 -10,0Z', '#14100f', 'detail', 0.9)
    def bands(m, base, n, layer, med_from=None, min_area=120, blur_px=4.0, sat=1.08, mix=0.0, tint=None):
        if m.sum() < 400: return None
        mf = med_from if med_from is not None else m
        gain = np.clip(base / np.maximum(1, np.median(img[mf], 0)), 0.5, 2.2)
        C = cv2.GaussianBlur(np.clip(img * gain, 0, 255), (0, 0), 3)
        g_ = C.mean(2, keepdims=True); C = np.clip(g_ + (C - g_) * sat, 0, 255)
        Lb = cv2.GaussianBlur(lum, (0, 0), blur_px); qs = np.quantile(Lb[m], np.linspace(0, 1, n + 1)[1:-1]); mid = n // 2
        if tint is not None: C = C.mean(2, keepdims=True) * tint                    # neutralise colour casts (e.g. sky in hair)
        col = lambda sel: (np.median(C[sel], 0) * (1 - mix) + base * mix) if sel.sum() > 30 else None
        for k in range(mid - 1, -1, -1):           # shadows: biggest (lightest) first, darkest last
            c = col(m & (Lb < qs[k]) & (Lb >= (qs[k - 1] if k else -1)))
            if c is not None: [D.shape(smooth_path(p, True), hexc(c), layer) for p in contours(m & (Lb < qs[k]), min_area, step=5, blur=2)]
        for k in range(mid, n - 1):                # lights: biggest first, brightest last
            c = col(m & (Lb >= qs[k]) & (Lb < (qs[k + 1] if k + 1 < n - 1 else 999)))
            if c is not None: [D.shape(smooth_path(p, True), hexc(c), layer) for p in contours(m & (Lb >= qs[k]), min_area, step=5, blur=2)]
        return gain
    skin_gain = bands(skin, skin_c, 22, 'soft', med_from=fskin, mix=0.08, blur_px=1.8, min_area=30)
    (bands(cloth, cloth_c, 6, 'shade', min_area=500, blur_px=7, sat=0.9, mix=0.35) if other_on else plaid(cloth))
    bands(hair, hair_c, 5, 'shade', min_area=300, blur_px=3, tint=np.array([1.06, 0.98, 0.93]), mix=0.2)
    cel(other, other_c, ((0.75, 0.8),), hi=(1.3, 1.12), blur=9)
    # cheeks
    # ---- graphite hatching, shown only in line-art mode
    hatch = []; Lh = cv2.GaussianBlur(lum, (0, 0), 3); refh = np.median(Lh[fskin])
    for thr, ang, sp in ((0.78, 0.95, 11), (0.64, 0.35, 9)):
        m = (skin & (Lh < refh * thr)).astype(np.uint8); m = cv2.erode(m, np.ones((3, 3)))
        dx, dy = math.cos(ang), math.sin(ang); nx, ny = -dy, dx; L_ = int(math.hypot(W, H))
        for o in range(-L_, L_, sp):
            run = []
            for t in range(-L_, L_, 3):
                x, y = W / 2 + nx * o + dx * t, H / 2 + ny * o + dy * t
                inside = 0 <= x < W and 0 <= y < H and m[int(y), int(x)]
                if inside: run.append((x, y))
                elif run:
                    if len(run) > 3: hatch.append(f'<path d="M{run[0][0]:.0f},{run[0][1]:.0f}L{run[-1][0]:.0f},{run[-1][1]:.0f}"/>')
                    run = []
    D.hatch = ''.join(hatch)
    # ---- outline ink: silhouette of person, hair edge, clothes edge
    for p in contours(keep, 2000, step=8): [D.line(smooth_path(r, c), 2.4) for r, c in open_runs(p, W, H)]
    for p in contours(hair, 2500, step=7, blur=3.5): [D.line(smooth_path(r, c), 2.4) for r, c in open_runs(p, W, H)]
    for p in contours(cloth, 600, step=8): [D.line(smooth_path(r, c), 2.2) for r, c in open_runs(p, W, H)]
    for p in contours(other, 300, step=6): [D.line(smooth_path(r, c), 2.0) for r, c in open_runs(p, W, H)]
    # ---- hair strands
    flow_lines(D, cv2.erode(hair.astype(np.uint8), np.ones((5, 5)), 1) > 0, lum, '#0c0908', n_seeds=style_hair_n, sep=6, maxlen=90, w=(0.9, 2.0))
    flow_lines(D, cv2.erode(hair.astype(np.uint8), np.ones((5, 5)), 1) > 0, 255 - lum, '#7d6a60', n_seeds=style_hair_n // 3, sep=9, maxlen=60, w=(0.8, 1.4), op=0.6)
    # ---- clothes folds + accessories: strongest edges only
    for m, thr, w in ((cloth, 28, 1.5), (other, 50, 1.3)):
        if m.sum() < 500 or (m is cloth and not other_on): continue
        e = cv2.Canny(cv2.GaussianBlur(lum, (0, 0), 2.2).astype(np.uint8), thr, thr * 2.2) & (cv2.erode(m.astype(np.uint8), np.ones((9, 9))) * 255)
        cs, _ = cv2.findContours(e, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
        for c in sorted(cs, key=lambda c: -cv2.arcLength(c, False))[:12]:
            if cv2.arcLength(c, False) < 160: break
            p = c.reshape(-1, 2); p = p[:len(p) // 2 + 1]  # contour of a thin edge runs out and back
            D.line(smooth_path(resample(p, 6)), w, layer='detail', op=0.8)
    # ---- face features from landmarks
    P = lambda ids: lm[ids]
    eye_h = np.linalg.norm(lm[159] - lm[145]); face_w = np.linalg.norm(lm[234] - lm[454]); s = face_w / 300
    eyes = ''
    for up, lo, ir, side in (([33, 246, 161, 160, 159, 158, 157, 173, 133], [33, 7, 163, 144, 145, 153, 154, 155, 133], 468, 'l'),
                             ([263, 466, 388, 387, 386, 385, 384, 398, 362], [263, 249, 390, 373, 374, 380, 381, 382, 362], 473, 'r')):
        U, L = P(up), P(lo); shape = smooth_path(list(U) + list(L[::-1][1:-1]), True)
        c = lm[ir] if len(lm) > 477 else (U.mean(0) + L.mean(0)) / 2
        r = (np.linalg.norm(lm[ir + 1] - lm[ir + 3]) / 2 if len(lm) > 477 else eye_h * 0.6) * 1.02
        cx, cy = (U[0] + U[-1]) / 2
        g = f'<g class="eye eye-{side}" style="transform-origin:{cx:.1f}px {cy:.1f}px"><clipPath id="clip-{name}-{side}"><path d="{shape}"/></clipPath>'
        g += f'<path d="{shape}" fill="#e8dcd0"/><g clip-path="url(#clip-{name}-{side})"><g class="iris"><circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="{r:.1f}" fill="#4a2e1e"/><circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="{r*0.62:.1f}" fill="#22140d"/>'
        g += f'<circle cx="{c[0]-r*0.35:.1f}" cy="{c[1]-r*0.38:.1f}" r="{r*0.24:.1f}" fill="#fff"/></g><path d="{smooth_path(list(U))}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="{eye_h*0.5:.1f}"/></g>'
        g += f'<path d="{smooth_path(list(U))}" fill="none" stroke="{INK}" stroke-width="{3.4*s+1:.2f}" stroke-linecap="round"/>'
        g += f'<path d="{smooth_path(list(L[2:-1]))}" fill="none" stroke="{INK}" stroke-width="{1.3*s+0.4:.2f}" stroke-linecap="round" opacity=".7"/>'
        cr = U.copy(); cr[:, 1] -= eye_h * 0.75; cr = cr[2:-1]
        g += '</g>'   # (no drawn lid crease: it read as a stray line under the brow)
        eyes += g
    for up, lo in (([70, 63, 105, 66, 107], [46, 53, 52, 65, 55]), ([300, 293, 334, 296, 336], [276, 283, 282, 295, 285])):
        U, L = P(up), P(lo); D.shape(smooth_path(list(U) + list(L[::-1]), True), hexc(hair_c * 1.2), 'shade', 0.7)
        # brow hairs: short strokes that grow outward and up, like real brows (inner end = index -1)
        Uc, Lc = resample(U[::-1], 2), resample(L[::-1], 2); n_ = min(len(Uc), len(Lc)); Uc, Lc = Uc[:n_], Lc[:n_]
        rb = random.Random(int(U[0][0]))
        for k in range(46):
            t = k / 45; j = min(n_ - 2, int(t * (n_ - 1)))
            u_, l_ = Uc[j], Lc[j]; th = np.linalg.norm(u_ - l_) + 1e-3
            tang = Uc[min(n_ - 1, j + 1)] - Uc[j]; tang = tang / (np.linalg.norm(tang) + 1e-6)
            base = l_ + (u_ - l_) * rb.uniform(0.05, 0.55)
            lift = (0.9 - 0.65 * t) * LIFT_K                # inner hairs stand up, outer ones lie flat (less so on kids)
            dirv = tang * (1 - lift) + (u_ - l_) / th * lift; dirv = dirv / (np.linalg.norm(dirv) + 1e-6)
            tip = base + dirv * th * rb.uniform(0.9, 1.4) * (0.75 if LIFT_K < 1 else 1)
            mid = (base + tip) / 2 + np.array([-dirv[1], dirv[0]]) * th * 0.08
            D.line(f'M{base[0]:.1f},{base[1]:.1f}Q{mid[0]:.1f},{mid[1]:.1f} {tip[0]:.1f},{tip[1]:.1f}', (0.9 + 0.5 * (1 - abs(t - 0.45))) * s + 0.3, col='#1a1210', op=round(rb.uniform(0.55, 0.9) * BROW_K, 2))
    for side in ([127, 234, 93, 132], [356, 454, 323, 361]): D.line(smooth_path(list(P(side))), 2.0 * s + 0.5, op=0.0 if name == 'baby' else 0.8)
    # ears: inner fold drawn as the outward half of an eroded ear contour
    oval = np.zeros_like(lum, np.uint8); cv2.fillPoly(oval, [P([10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]).astype(np.int32)], 1)
    earm = (skin & (cv2.dilate(oval, np.ones((5, 5))) == 0)).astype(np.uint8); earm[:int(lm[105][1])] = 0; earm[int(lm[2][1] + 20 * s):] = 0
    n_, lab_, st_, cen_ = cv2.connectedComponentsWithStats(earm)
    for j in range(1, n_):
        if st_[j, cv2.CC_STAT_AREA] < 600 * s * s: continue
        em = cv2.erode((lab_ == j).astype(np.uint8), np.ones((int(9 * s) + 1, int(9 * s) + 1)))
        cs, _ = cv2.findContours(em, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        if not cs: continue
        c = max(cs, key=cv2.contourArea).reshape(-1, 2).astype(float); out = (c[:, 0] < lm[1][0]) == (cen_[j][0] < lm[1][0])
        keep_ = np.abs(c[:, 0] - lm[1][0]) > np.abs(cen_[j][0] - lm[1][0]) - 2 * s
        if keep_.all() or not keep_.any(): continue
        k0 = int(np.argmin(keep_)); c, keep_ = np.roll(c, -k0, 0), np.roll(keep_, -k0)   # walk the contour in order
        runs, cur = [], []
        for q, o in zip(c, keep_):
            if o: cur.append(q)
            elif cur: runs.append(cur); cur = []
        if cur: runs.append(cur)
        side = max(runs, key=len)
        if len(side) > 6: D.line(smooth_path(list(resample(np.array(side), 6))), 1.8 * s + 0.4, op=0.75)
    jaw = P([132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361])
    D.line(smooth_path(list(jaw)), 1.5 * s + 0.4, op=0.45)
    # nose
    # nose: form comes from the photo's own light (local tonal pass), then a few precise ink marks
    Ln = cv2.GaussianBlur(lum, (0, 0), 1.8)
    # fine form: high-pass of the face's light (nose bridge & tip, ala, lids, lips, cheek folds), stacked as
    # translucent darker / lighter glazes so it has no hard region edges
    hp = Ln - cv2.GaussianBlur(Ln, (0, 0), 9 * s); fm = fskin & ~cv2.dilate(hair.astype(np.uint8), np.ones((5, 5))).astype(bool)
    # only around the nose (soft-edged ellipse from the brows to the upper lip) so cheeks don't get creases
    nz = np.zeros_like(lum, np.float32); ncen = (lm[6] + lm[2]) / 2; nax = (np.linalg.norm(lm[133] - lm[362]) * 0.95, np.linalg.norm(lm[6] - lm[2]) * 0.62)
    cv2.ellipse(nz, (int(ncen[0]), int(ncen[1])), (int(nax[0]), int(nax[1])), 0, 0, 360, 1, -1); nz = cv2.GaussianBlur(nz, (0, 0), 6 * s)
    hp = hp * nz
    for t_, k, op in ((-5, 0.86, 0.32), (-10, 0.8, 0.32), (-17, 0.72, 0.3)):
        for p in contours(fm & (hp < t_), 18 * s * s, step=3, blur=1.3): D.shape(smooth_path(p, True), hexc(skin_c * k), 'soft', op)
    for t_, k, op in ((5, 1.08, 0.32), (10, 1.15, 0.3)):
        for p in contours(fm & (hp > t_), 18 * s * s, step=3, blur=1.3): D.shape(smooth_path(p, True), hexc(np.minimum(255, skin_c * k)), 'soft', op)
    nc = (lm[98] + lm[327]) / 2; nc[1] = lm[2][1]; w_ = np.linalg.norm(lm[64] - lm[294])
    ex = (lm[327] - lm[98]) / (np.linalg.norm(lm[327] - lm[98]) + 1e-6); ey = np.array([-ex[1], ex[0]])
    Q = lambda x, y: nc + ex * x * w_ + ey * y * w_
    # nostrils: the real dark openings under the tip, traced from the photo
    zone = np.zeros_like(lum, np.uint8); cv2.fillPoly(zone, [np.array([Q(-0.42, -0.13), Q(0.42, -0.13), Q(0.42, 0.06), Q(-0.42, 0.06)]).astype(np.int32)], 1)
    zone = (zone > 0) & skin
    for sd in (-1, 1):   # one nostril per side, each traced from its own darkest pixels
        half = zone.copy(); cut = int(round(nc[0]))
        if sd < 0: half[:, cut:] = False
        else: half[:, :cut] = False
        if half.sum() < 30: continue
        dk = half & (Ln < np.percentile(Ln[half], 12)); ys_, xs_ = np.nonzero(dk)
        if len(xs_) < 6: continue
        cx_, cy_ = xs_.mean(), ys_.mean(); cov = np.cov(np.vstack([xs_, ys_])); ev, evec = np.linalg.eigh(cov)
        ang = math.degrees(math.atan2(evec[1, 1], evec[0, 1])); ang = ((ang + 90) % 180) - 90; ang = max(-35, min(35, ang))
        rx, ry = w_ * 0.08, w_ * 0.034
        D.shape(f'M{cx_-rx:.1f},{cy_:.1f}a{rx:.1f},{ry:.1f} {ang:.0f} 1,0 {2*rx:.1f},0a{rx:.1f},{ry:.1f} {ang:.0f} 1,0 {-2*rx:.1f},0Z', '#3a2219', 'soft', 0.55)
    for sd in (-1, 1):   # alar crease: a short curve hugging each nostril wing
        pass
    # lips
    ou = P([61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]); ol = P([291, 375, 321, 405, 314, 17, 84, 181, 91, 146])
    lip_c = med(np.zeros_like(hair)) if False else img[int(lm[17][1]) - 4, int(lm[17][0])]
    iu = P([308, 415, 310, 311, 312, 13, 82, 81, 80, 191, 78]); il = P([78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308])
    lm_ = np.zeros_like(lum, np.uint8); cv2.fillPoly(lm_, [np.vstack([ou, ol]).astype(np.int32)], 1)
    lipPh = np.median(np.clip(img[lm_ > 0] * (skin_gain if skin_gain is not None else 1), 0, 255), 0) if lm_.sum() > 20 else skin_c * 0.8
    lipPh = lipPh * 0.75 + (skin_c * 0.78 + np.array([30, 0, 0])) * 0.25
    lipU = lipPh * 0.86; lipL = np.minimum(255, lipPh * 1.04)
    D.shape(smooth_path(list(ou) + list(iu), True), hexc(lipU), 'soft', 0.62)
    D.shape(smooth_path(list(il) + list(ol[::-1][1:-1]), True), hexc(lipL), 'soft', 0.55)
    lc = (lm[14] + lm[17]) / 2; lw = np.linalg.norm(lm[61] - lm[291])
    D.shape(f'M{lc[0]-lw*0.16:.1f},{lc[1]-1:.1f}a{lw*0.16:.1f},{lw*0.045:.1f} 0 1,0 {lw*0.32:.1f},0a{lw*0.16:.1f},{lw*0.045:.1f} 0 1,0 {-lw*0.32:.1f},0Z', hexc(np.minimum(255, lipL * 1.25)), 'soft', 0.6)
    ml = P([78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308])
    D.line(smooth_path(list(ml)), 1.5 * s + 0.4, op=0.6)          # full mouth line, light at the corners
    D.line(smooth_path(list(ml[2:-2])), 1.9 * s + 0.4, op=0.75)    # darker in the middle
    D.line(smooth_path(list(ou[2:-2])), 1.1 * s + 0.3, op=0.35); D.line(smooth_path(list(ol[3:-2])), 1.1 * s + 0.3, op=0.25)
    for i in (61, 291): D.line(smooth_path([lm[i], lm[i] + [(-4 if i == 61 else 4) * s, 2 * s]]), 1.8 * s, op=0.7)
    # ---- stubble / mustache: stipple where the lower face is darker than the cheeks
    lower = np.zeros_like(lum, np.uint8); cv2.fillPoly(lower, [P([132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 436, 425, 411, 427, 207, 205, 216, 206, 203, 36, 129, 98, 97, 2, 326, 327, 358, 266, 423, 426, 436]).astype(np.int32)], 1)
    mouth = np.zeros_like(lower); cv2.fillPoly(mouth, [np.vstack([ou, ol]).astype(np.int32)], 1); mouth = cv2.dilate(mouth, np.ones((5, 5)))
    cheek = np.median(lum[(fskin) & (lum > 0)]); L2 = cv2.GaussianBlur(lum, (0, 0), 1.5)
    beard = (lower > 0) & (mouth == 0) & (L2 < cheek * 0.8) & fskin; beard[int(lm[152][1]) + 2:] = False
    ys, xs = np.nonzero(beard); k = min(len(xs), int(beard.sum() / 14)) if beard_on else 0
    rb = random.Random(3); mcx = lm[0][0]; upper_y = lm[0][1]
    for j in np.random.choice(len(xs), k, replace=False) if k else []:
        x, y = xs[j], ys[j]; d = min(1, (cheek * 0.8 - L2[y, x]) / (cheek * 0.35))
        if y < upper_y:   # mustache: hairs sweep down and out from the middle
            a = math.pi / 2 + (0.9 if x < mcx else -0.9) * min(1, abs(x - mcx) / (12 * s)) * 0.7 + rb.uniform(-0.2, 0.2); ln = (4 + 4 * d) * s
        else:             # chin / jaw: hairs point down, following the jaw
            a = math.pi / 2 + (x - mcx) / (60 * s) * 0.6 + rb.uniform(-0.3, 0.3); ln = (3 + 3 * d) * s
        D.line(f'M{x:.1f},{y:.1f}l{math.cos(a)*ln:.1f},{math.sin(a)*ln:.1f}', 0.7 * s + 0.25, col='#1f1712', op=round(0.25 + 0.5 * d, 2))
    # jaw/chin + ear inner lines from strong edges in skin
    e = cv2.Canny(cv2.GaussianBlur(lum, (0, 0), 2.6).astype(np.uint8), 40, 90) & (cv2.erode(skin.astype(np.uint8), np.ones((7, 7))) * 255)
    feat = np.zeros_like(lower); cv2.fillPoly(feat, [cv2.convexHull(P(list(range(0, 468))).astype(np.int32))], 1)
    e &= ((cv2.dilate(feat, np.ones((9, 9))) == 0) | (cv2.dilate(feat, np.ones((9, 9))) - cv2.erode(feat, np.ones((25, 25))) > 0)).astype(np.uint8) * 255
    cs, _ = cv2.findContours(e, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    for c in sorted(cs, key=lambda c: -cv2.arcLength(c, False))[:(0 if name in ('baby', 'kid') else 16)]:
        if cv2.arcLength(c, False) < 60: break
        p = c.reshape(-1, 2); p = p[:len(p) // 2 + 1]; D.line(smooth_path(resample(p, 6)), 1.6, op=0.75, layer='detail')
    import re
    out = D.svg(eyes, seed=sum(map(ord, name)))
    for i in ('soft', 'sky', 'skinclip', 'plaidclip'): out = out.replace(f'id="{i}"', f'id="{name}-{i}"').replace(f'url(#{i})', f'url(#{name}-{i})')
    open(f'/tmp/mp/{name}.svg', 'w').write(out); return D

if __name__ == '__main__':
    for n in sys.argv[1:]: build(n, beard_on=n in ('young', 'curls', 'now'), other_on=n != 'kid'); print(n)
