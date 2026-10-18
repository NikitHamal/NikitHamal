# Level the head (eyes horizontal) without rotating the shoulders: rotate everything above the neck,
# fading the rotation to zero across the neck so the body stays put.
import json, math, sys, numpy as np, cv2
from PIL import Image
for s in sys.argv[1:]:
    lm = np.array(json.load(open(f'/tmp/mp/{s}_lm.json'))['lm'])
    roll = math.degrees(math.atan2(lm[263][1] - lm[33][1], lm[263][0] - lm[33][0]))
    im = np.asarray(Image.open(f'/tmp/paint/ref/{s}_full.png').convert('RGB'))
    if abs(roll) < 1.5: Image.fromarray(im).save(f'/tmp/paint/ref/{s}_st.png'); print(s, 'kept'); continue
    H, W = im.shape[:2]; fh = np.linalg.norm(lm[152] - lm[10])
    px, py = lm[152][0], lm[152][1] + fh * 0.35            # pivot: base of the neck
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    t = np.clip((py + fh * 0.15 - yy) / (fh * 0.45), 0, 1); w = t * t * (3 - 2 * t)   # 1 on the head, 0 below the neck
    a = np.radians(roll) * w                                  # inverse map: sample source rotated by +roll
    dx, dy = xx - px, yy - py
    mx = (px + dx * np.cos(a) - dy * np.sin(a)).astype(np.float32); my = (py + dx * np.sin(a) + dy * np.cos(a)).astype(np.float32)
    out = cv2.remap(im, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    Image.fromarray(out).save(f'/tmp/paint/ref/{s}_st.png'); print(s, 'levelled', round(roll, 1))
