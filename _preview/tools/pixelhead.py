# Symmetric pixel head (30x32) for "pixel me", built like a pixel artist would:
# silhouette = the painting's head shape made mirror-symmetric; skin/hair colours from the painting;
# every feature hand-placed in mirrored pairs; light from the upper left (one shading step).
import json, numpy as np, cv2
from PIL import Image
W, H = 30, 32
paint = np.asarray(Image.open('/tmp/mp/w_now.png').convert('RGB')).astype(np.float32)
cat = np.load('/tmp/mp/now_cat.npy'); lm = np.array(json.load(open('/tmp/mp/now_lm.json'))['lm'])
chin, top = lm[152], lm[10]; fh = chin[1] - top[1]; cx = (lm[234][0] + lm[454][0]) / 2; fw = np.linalg.norm(lm[234] - lm[454])
x0, x1 = cx - fw * 0.95, cx + fw * 0.95; y0 = top[1] - fh * 0.62; s = W / (x1 - x0)
PAD = 300
def samp(mask):
    m = np.pad(mask.astype(np.float32), PAD)[int(y0) + PAD:int(y0 + H / s) + PAD, int(x0) + PAD:int(x1) + PAD]
    return cv2.resize(m, (W, H), interpolation=cv2.INTER_AREA)
yy = np.arange(cat.shape[0])[:, None]
hairM = samp((cat == 1) & (yy < chin[1] + fh * 0.02)); faceM = samp(((cat == 3) | (cat == 2)) & (yy < chin[1] + fh * 0.02))
sym = lambda a: (a + a[:, ::-1]) / 2
# face = the measured face outline (jaw, chin, cheekbones), mirrored to be symmetric, rasterised
OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
poly = np.stack([(lm[OVAL, 0] - x0) * s, (lm[OVAL, 1] - y0) * s], 1)
mirror = poly.copy(); mirror[:, 0] = W - mirror[:, 0]
# pair each point with its mirrored partner (same index order reversed) and average → symmetric outline
mir = mirror[::-1]; mir = np.roll(mir, 1, 0)   # OVAL is a loop starting at the forehead centre
sympoly = (poly + mir) / 2
fm = np.zeros((H * 8, W * 8), np.uint8); cv2.fillPoly(fm, [np.round(sympoly * 8).astype(np.int32)], 1)
faceO = cv2.resize(fm.astype(np.float32), (W, H), interpolation=cv2.INTER_AREA) > 0.5
faceO = faceO | faceO[:, ::-1]
hair = (sym(hairM) > 0.42)
face = faceO & ~(hair & (np.arange(H)[:, None] < int(round((lm[105][1] - y0) * s)) - 1))   # hair covers the forehead only above the brows
hair = (hair | faceO) & ~face   # forehead under the fringe is hair
# ears: small, at eye–nose height, just outside the face
eyR = int(round((np.mean(lm[[159, 145], 1]) - y0) * s)); noseR = int(round((lm[2][1] - y0) * s))
rows = np.nonzero(face.any(1))[0]
ear = np.zeros_like(face)
for y in range(eyR, noseR + 1):
    xs = np.nonzero(face[y])[0]
    if len(xs): ear[y, max(0, xs.min() - 1)] = True; ear[y, min(W - 1, xs.max() + 1)] = True
sil = hair | face | ear
from scipy.ndimage import binary_fill_holes
holes = binary_fill_holes(sil) & ~sil; hair = hair | holes; sil = sil | holes   # no gaps between fringe and forehead
# colours from the painting
sk = np.median(paint[cat == 3], 0); hc = np.array([34, 26, 23.])
SK = [[226, 176, 138], [206, 150, 112], [180, 126, 92], [150, 100, 72]]   # light, base, shade, deep — warm medium brown
HR = [[24, 18, 16], [38, 29, 26], [62, 48, 42]]                                       # dark, mid, sheen
OUT = [40, 27, 24]; BROW = [30, 21, 18]; WHITE = [232, 222, 210]; IRIS = [44, 26, 16]; LIP = [146, 86, 72]; STACHE = [48, 34, 28]
img = np.zeros((H, W, 4), np.uint8)
def put(x, y, c):
    if 0 <= x < W and 0 <= y < H: img[y, x, :3] = c; img[y, x, 3] = 255
def pair(x, y, c): put(x, y, c); put(W - 1 - x, y, c)        # mirrored pair
# skin with one shading step: right side & under-features darker (light from upper left)
fx = np.nonzero(face.any(0))[0]; fy = np.nonzero(face.any(1))[0]; fl, fr, ft, fb = fx.min(), fx.max(), fy.min(), fy.max()
for y in range(H):
    for x in range(W):
        if face[y, x] or ear[y, x]:
            c = SK[1] if face[y, x] else SK[2]
            if x >= fr - 1 or (x >= fr - 3 and y > ft + 9) or (y >= fb - 1): c = SK[2]
            if x <= fl + 1 and y < ft + 8: c = SK[0]
            if face[y, x] and (y + 1 >= H or not face[y + 1, x]): c = SK[2]                       # jawline underside
            put(x, y, c)
        elif hair[y, x]:
            put(x, y, HR[0] if (x + y) % 7 else HR[1])
# hair sheen: a couple of symmetric highlight strands near the part, and the centre part line
for y in range(2, 9):
    pair(W // 2 - 4 - (y // 3), y, HR[2] if y % 3 else HR[1]); pair(W // 2 - 8 - (y // 2), y + 3, HR[1])
for y in range(1, 6): put(W // 2 - 1, y, SK[3]) if hair[y, W // 2 - 1] and y > 2 else None
# feature layout from the measured face, then made symmetric
ex = int(round((cx - lm[33][0]) * s * 0 + (np.mean(lm[[33, 133], 0]) - x0) * s - 0.5)); eyeL = min(ex, W - 1 - ex); ey = int(round((np.mean(lm[[159, 145], 1]) - y0) * s))
bY = ey - 3; nY = int(round((lm[2][1] - y0) * s)); mY = int(round((lm[13][1] - y0) * s)); cY = int(round((lm[152][1] - y0) * s))
mid = W // 2   # columns mid-1 | mid are the centre pair
for dx in (-1, 0, 1): pair(eyeL + dx, ey, WHITE); pair(eyeL + dx, ey - 1, BROW)             # eye white + upper lid
pair(eyeL, ey, IRIS)                                                                         # irises, centred: looking straight out
for dx in (-2, -1, 0, 1, 2): pair(eyeL + dx, bY, BROW)                                        # brows
pair(eyeL - 3, bY + 1, BROW)   # outer brow tails
for y in range(ey + 1, nY - 1): put(mid, y, SK[2])                                           # nose bridge shade (right of centre)
for y in range(ey + 2, nY - 1): put(mid - 1, y, SK[0])                                       # and its lit side
pair(mid - 2, nY, SK[3]); put(mid - 1, nY, SK[2]); put(mid, nY, SK[2]); put(mid - 1, nY - 1, SK[0])   # nostrils + tip
for dx in range(-3, 3): put(mid + dx, mY - 1, STACHE)                                         # moustache
pair(mid - 4, mY, STACHE)
for dx in range(-2, 2): put(mid + dx, mY + 1, LIP)                                            # mouth
pair(mid - 3, mY + 1, SK[2])
for dx in (-1, 0): put(mid + dx, cY - 1, STACHE); put(mid + dx, cY - 2, STACHE)               # chin patch
pair(fl, ey + 2, SK[2]); pair(fl, ey + 3, SK[3])                                             # ears hint
# selective outline: dark warm brown around the silhouette
a = img[..., 3] > 0; o = np.zeros_like(a)
for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)): o |= np.roll(np.roll(a, dy, 0), dx, 1)
o &= ~a; img[o, :3] = OUT; img[o, 3] = 255
info = dict(w=W, h=H, eyes=[[eyeL, ey], [W - 1 - eyeL, ey]], eyeL=eyeL, mouth=[mid, mY + 1], chin=[mid, cY], skin=SK[1], skinShade=SK[2])
Image.fromarray(img, 'RGBA').save('/tmp/px/head.png'); json.dump(info, open('/tmp/px/head.json', 'w'))
Image.fromarray(img, 'RGBA').resize((W * 12, H * 12), Image.NEAREST).save('/tmp/px/head_big.png'); print(info)
