# The curls photo crops the top of the head: shrink each photo into the canvas and grow a
# complete rounded crown of hair above the old edge, textured from the hair just below it.
import json, sys, numpy as np, cv2
from PIL import Image
for id in sys.argv[1:]:
    img = np.asarray(Image.open(f'/tmp/paint/ref/{id}_st.png.orig').convert('RGB')); cat = np.load(f'/tmp/mp/{id}_cat.npy.orig'); meta = json.load(open(f'/tmp/mp/{id}_lm.json.orig'))
    k = 0.8; W, H = 800, 1000; nw, nh = int(W * k), int(H * k); ox, oy = (W - nw) // 2, H - nh
    sm = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA); sc = cv2.resize(cat, (nw, nh), interpolation=cv2.INTER_NEAREST)
    big = cv2.copyMakeBorder(sm, oy, 0, ox, W - nw - ox, cv2.BORDER_REFLECT)
    bc = cv2.copyMakeBorder(sc, oy, 0, ox, W - nw - ox, cv2.BORDER_REPLICATE)
    side = np.zeros((H, W), bool); side[:, :ox] = True; side[:, ox + nw:] = True
    bc[side & (bc != 4)] = 0; bc[:oy] = 0
    xs = np.nonzero(sc[2] == 1)[0]
    if len(xs) < 10: xs = np.nonzero(sc[2] > 0)[0]
    lmr = np.array(meta['lm']); fh = (lmr[152][1] - lmr[10][1]) * k; head = np.linalg.norm(lmr[234] - lmr[454]) * k
    cxr = (lmr[234][0] + lmr[454][0]) / 2 * k + ox
    a = max((xs.max() - xs.min()) / 2 * 1.02, head * 0.64); b = head * (0.3 if id == 'young' else 0.36); cy = oy + b * 0.32
    yy, xx = np.mgrid[0:H, 0:W]; ang = np.arctan2(yy - cy, xx - cxr)
    r = np.sqrt(((xx - cxr) / a) ** 2 + ((yy - cy) / b) ** 2) * (1 + 0.035 * np.sin(ang * 9 + 1.3) + 0.02 * np.sin(ang * 17))
    crown = (r <= 1) & ((yy < oy + 2) | ((bc == 0) & (yy < cy + b * 0.5))); bc[crown] = 1   # also bridge any gap down to the real hair
    bg = np.median(img[cat == 0], 0) if (cat == 0).sum() > 100 else np.array([240, 236, 230])
    out = big.copy(); out[:oy][~crown[:oy]] = bg; out[side & (bc != 4)] = bg
    # texture: inpaint from the real hair, then add the fine strand texture of the reflected hair on top
    refl = out.copy(); fill = cv2.inpaint(out, (crown * 255).astype(np.uint8), 21, cv2.INPAINT_TELEA)
    hi = refl.astype(np.float32) - cv2.GaussianBlur(refl.astype(np.float32), (0, 0), 3)
    tex = np.clip(fill.astype(np.float32) + hi * 0.8, 0, 255)
    edge = np.clip((1 - r) * 5, 0, 1)[..., None]
    realhair = (bc == 1) & ~crown
    mu, sd = out[realhair].astype(np.float32).mean(0), out[realhair].astype(np.float32).std(0) + 1
    tm, ts = tex[crown].mean(0), tex[crown].std(0) + 1
    tex = (tex - tm) / ts * sd + mu                     # match the real hair's colour and contrast
    out = np.where(crown[..., None], np.clip(tex * (0.85 + 0.15 * edge), 0, 255), out).astype(np.uint8)
    # feather the seam where the photo was cut
    band = slice(max(0, oy - 18), oy + 18); hb = (bc[band] == 1)[..., None]
    sm_ = cv2.GaussianBlur(out[band].astype(np.float32), (1, 0), sigmaX=0.1, sigmaY=9) if False else cv2.GaussianBlur(out[band].astype(np.float32), (3, 31), 0)
    out[band] = np.where(hb, sm_, out[band]).astype(np.uint8)
    Image.fromarray(out).save(f'/tmp/paint/ref/{id}_st.png'); np.save(f'/tmp/mp/{id}_cat.npy', bc)
    L = lmr.copy(); L[:, 0] = L[:, 0] * k + ox; L[:, 1] = L[:, 1] * k + oy
    json.dump({'W': W, 'H': H, 'lm': L.tolist()}, open(f'/tmp/mp/{id}_lm.json', 'w'))
    Image.fromarray(np.where((bc == 1)[..., None], [30, 30, 30], np.where((bc > 0)[..., None], [200, 160, 140], [255, 255, 255])).astype(np.uint8)).save(f'/tmp/mp/{id}_crown_dbg.png')
    print(id, 'crown', crown.sum())
