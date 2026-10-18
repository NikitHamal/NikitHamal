"""Pixel sakura for /preview — built the way the writings-page sakura is (crown of overlapping lit
clumps over a noisy blob silhouette, ragged underside with hanging tufts, sparkles), but at 3× the
size with extra care: hue-shifted 10-step ramp, light from the upper left, back/front crown layers,
branches showing through gaps, flared roots with bark streaks, moss, and a petal carpet.
Layers: trunk.png, back.png (crown behind the branches), front.png; tree.json carries the anchors.
usage: python3 pixeltree.py <outdir>"""
import sys, os, json, math, random, numpy as np
from PIL import Image
R = random.Random(7)
W, H = 200, 190; CX, GY = 100, 182
hx = lambda h: (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))
P = [hx(h) for h in ('#2e1530', '#4a1f45', '#6e2b5c', '#953a70', '#b94f84', '#d66b97', '#ea8dab', '#f6b2c3', '#ffd7df', '#fff1f3')]
BARK = [hx(h) for h in ('#1f120e', '#352019', '#4e2f22', '#6a412e', '#87573c', '#a4704d')]
MOSS = [hx(h) for h in ('#4a5a34', '#5a6b3c')]
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0

def h2(x, y, s): v = math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return v - math.floor(v)
def noise(x, y, s):
    ix, iy = math.floor(x), math.floor(y); fx, fy = x - ix, y - iy; u, v = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b, c, d = h2(ix, iy, s), h2(ix + 1, iy, s), h2(ix, iy + 1, s), h2(ix + 1, iy + 1, s)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
def pick(pal, l): return pal[max(0, min(len(pal) - 1, round(l * (len(pal) - 1))))]

class L:
    def __init__(s): s.a = np.zeros((H, W, 4), np.uint8)
    def set(s, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < W and 0 <= y < H: s.a[y, x, :3] = c; s.a[y, x, 3] = 255
    def has(s, x, y): return 0 <= x < W and 0 <= y < H and s.a[int(y), int(x), 3] > 0

def bark(Lr, x0, y0, x1, y1, w0, w1, seed, lit=True):
    n = int(math.hypot(x1 - x0, y1 - y0) * 2) + 2
    for i in range(n + 1):
        t = i / n; x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t; w = w0 + (w1 - w0) * t
        dx, dy = (x1 - x0), (y1 - y0); ln = math.hypot(dx, dy) or 1; nx, ny = -dy / ln, dx / ln
        k = -w / 2
        while k <= w / 2:
            u = k / (w / 2 + 0.01); px, py = x + nx * k, y + ny * k
            c = BARK[5] if u < -0.6 else BARK[4] if u < -0.15 else BARK[3] if u < 0.35 else BARK[2] if u < 0.75 else BARK[1]
            if not lit: c = BARK[max(1, BARK.index(c) - 1)]
            if h2(int(px), int(py) // 3, seed) < 0.13 and -0.4 < u < 0.7: c = BARK[1]          # bark streaks
            Lr.set(px, py, c); k += 0.5

trunk, back, front = L(), L(), L()
for dx, w in ((-20, 6), (19, 6), (-11, 7), (10, 7)): bark(trunk, CX + dx, GY + 1, CX + dx * 0.25, GY - 16, w, 9, 3)
bark(trunk, CX, GY + 1, CX - 2, GY - 40, 19, 15, 5); bark(trunk, CX - 2, GY - 40, CX + 2, GY - 70, 15, 12, 6)
bark(trunk, CX + 1, GY - 66, CX - 22, GY - 96, 9, 5, 7); bark(trunk, CX - 22, GY - 96, CX - 48, GY - 108, 5, 2.5, 8)
bark(trunk, CX + 2, GY - 66, CX + 26, GY - 98, 9, 5, 9); bark(trunk, CX + 26, GY - 98, CX + 52, GY - 104, 5, 2.5, 10)
bark(trunk, CX, GY - 70, CX + 4, GY - 110, 7, 3, 11)
for y in range(GY - 58, GY - 20):
    for x in range(CX + 3, CX + 10):
        if trunk.has(x, y) and noise(x * 0.4, y * 0.2, 3) > 0.74: trunk.set(x, y, MOSS[0])
a = trunk.a[..., 3] > 0; o = np.zeros_like(a)
for dy, dx in ((0, 1), (1, 0)): o |= np.roll(np.roll(a, dy, 0), dx, 1)
o &= ~a; o[GY + 2:] = False; trunk.a[o, :3] = BARK[0]; trunk.a[o, 3] = 255

CY = GY - 120
blobs = [(CX, CY - 4, 52, 34), (CX - 56, CY + 16, 30, 22), (CX + 58, CY + 18, 30, 22), (CX - 24, CY - 26, 34, 24), (CX + 28, CY - 28, 32, 22),
         (CX - 4, CY + 22, 46, 18), (CX - 70, CY + 34, 16, 12), (CX + 72, CY + 36, 16, 12)]
top, bot = CY - 56, CY + 50
def inside(x, y, seed):
    best = -9
    for cx, cy, rx, ry in blobs:
        u, v = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry; best = max(best, 1 - (u * u + v * v))
    return best + (noise(x * 0.18, y * 0.18, seed) - 0.5) * 0.55 > 0
light = lambda x, y, s: 0.8 - (y - top) / (bot - top) * 0.55 - (x - (CX - 26)) / W * 0.34 + (noise(x * 0.07, y * 0.09, s) - 0.5) * 0.3

def paint_crown(Lr, seed, dark, frac, holes):
    ins = np.zeros((H, W), bool)
    for y in range(max(0, top - 6), min(H, bot + 6)):
        for x in range(W):
            if inside(x, y, seed) and h2(x // 3, y // 3, seed + 9) < frac: ins[y, x] = True
    if holes:
        for _ in range(26):
            hx_, hy_ = R.uniform(CX - 60, CX + 60), R.uniform(CY - 30, CY + 30)
            for y in range(int(hy_ - 3), int(hy_ + 4)):
                for x in range(int(hx_ - 4), int(hx_ + 5)):
                    if ((x - hx_) / 4) ** 2 + ((y - hy_) / 3) ** 2 < 1 and 0 <= x < W and 0 <= y < H: ins[y, x] = False
    for y in range(H):
        for x in range(W):
            if ins[y, x]: Lr.set(x, y, pick(P, light(x, y, seed) - 0.14 - dark))
    cl = []
    for _ in range(1300):
        x, y = R.uniform(0, W - 1), R.uniform(top, bot)
        if 0 <= int(y) < H and ins[int(y), int(x)]: cl.append((x, y, R.uniform(3.2, 6.4)))
    cl.sort(key=lambda c: c[1])
    for cx, cy, rr in cl:
        Lc = light(cx, cy, seed) - dark
        for y in range(int(cy - rr), int(cy + rr) + 1):
            for x in range(int(cx - rr * 1.1), int(cx + rr * 1.1) + 1):
                u, v = (x + 0.5 - cx) / (rr * 1.1), (y + 0.5 - cy) / rr
                if u * u + v * v > 1 or not (0 <= x < W and 0 <= y < H) or not ins[y, x]: continue
                d2 = u * u + v * v
                l = Lc + (0.2 if (u + v) < -0.55 else 0.1 if (u + v) < -0.1 else -0.02 if (u + v) < 0.5 else -0.18) - (0.12 if d2 > 0.82 and (u + v) > 0 else 0)
                Lr.set(x, y, pick(P, l))
    for x in range(W):
        ys = np.nonzero(ins[:, x])[0]
        if len(ys) == 0 or ys[-1] <= top + 4: continue
        y = ys[-1]; Lr.set(x, y, P[0])
        if h2(x, 1, seed) < 0.35: Lr.set(x, y + 1, P[1])
        if h2(x, 2, seed) < 0.15: Lr.set(x, y + 2, P[0])
    for x in range(W):
        ys = np.nonzero(ins[:, x])[0]
        if len(ys) and x < CX + 20: Lr.set(x, ys[0], pick(P, 0.9))
    for _ in range(40):
        x, y = R.randrange(W), R.randrange(top, int(top + (bot - top) * 0.5))
        if 0 <= y < H and ins[y, x]: Lr.set(x, y, P[-1])
paint_crown(back, 21, 0.14, 1.0, False)
paint_crown(front, 22, 0.0, 0.93, True)
carpet = []
for _ in range(220):
    x = CX + R.gauss(0, 34); y = GY + R.uniform(-1, 4)
    carpet.append([round(x - CX), round(y - GY), R.choice([5, 6, 7, 8])])

out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/px/tree'; os.makedirs(out, exist_ok=True)
for n, Lr in (('trunk', trunk), ('back', back), ('front', front)): Image.fromarray(Lr.a, 'RGBA').save(f'{out}/{n}.png', optimize=True)
json.dump(dict(w=W, h=H, cx=CX, gy=GY, crownTop=top, crownBot=bot, petals=[list(P[i]) for i in (5, 6, 7, 8)], carpet=carpet), open(f'{out}/tree.json', 'w'))
prev = Image.new('RGBA', (W, H), (246, 236, 228, 255))
for n in ('back', 'trunk', 'front'): prev.alpha_composite(Image.open(f'{out}/{n}.png'))
prev.convert('RGB').resize((W * 4, H * 4), Image.NEAREST).save('/tmp/px/tree_prev.png')
