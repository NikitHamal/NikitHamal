# Builds the page assets from the two code drawings:
#   paint*  = colour SVG (illustrate.py) glazed over the pencil drawing (pencil.py)
#   *_ne    = same without eyes (eyes are drawn live on the page so they can look around and blink)
#   eyes.svg = the eye groups from the colour SVG, in the same 800x1000 space
import io, os, re, json, numpy as np, cv2
from PIL import Image
out = '/workspace/NikitHamal/_preview/art'; man = json.load(open(f'{out}/index.json'))
def put(rel, data):
    d = os.path.dirname(f'{out}/{rel}'); [os.remove(os.path.join(d, f)) for f in os.listdir(d) if f.startswith(os.path.basename(rel) + '.')]
    n = 0
    for i in range(0, len(data), 85000): open(f'{out}/{rel}.{n}', 'wb').write(data[i:i + 85000]); n += 1
    man[rel] = n
def webp(rel, im, w):
    b = io.BytesIO(); im.resize((w, int(w * 1.25)), Image.LANCZOS).save(b, 'WEBP', quality=88, method=6); put(rel, b.getvalue())
for id in ['baby', 'kid', 'teen', 'young', 'curls', 'now']:
    lm = np.array(json.load(open(f'/tmp/mp/{id}_lm.json'))['lm'])
    eyem = np.zeros((1000, 800), np.uint8)
    for ids in ([33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7], [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249]):
        cv2.fillPoly(eyem, [lm[ids].astype(np.int32)], 255)
    eyem = cv2.dilate(eyem, np.ones((9, 9)))
    pen = np.asarray(Image.open(f'/tmp/pencil/{id}_tone.png').convert('RGB').resize((800, 1000)))
    pen_ne = cv2.inpaint(pen, eyem, 7, cv2.INPAINT_TELEA)
    for suf, pimg in (('', pen), ('_ne', pen_ne)):
        c = np.asarray(Image.open(f'/tmp/mp/r_{id}{suf}.png').convert('RGB')).astype(np.float32) / 255
        p = cv2.cvtColor(pimg, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255; p = (p / (np.percentile(p, 98) + 1e-6)).clip(0, 1); k = 0.42
        im = Image.fromarray((c * (1 - k + k * p[..., None]) * 255).clip(0, 255).astype(np.uint8))
        if not suf: im.save(f'/tmp/mp/w_{id}.png')
        webp(f'{id}/paint{suf}.webp', im, 600); webp(f'{id}/paintlarge{suf}.webp', im, 800)
    pi = Image.fromarray(pen_ne); webp(f'{id}/still_ne.webp', pi, 600); webp(f'{id}/large_ne.webp', pi, 800)
    svg = open(f'/tmp/mp/{id}.svg').read()
    eyes = re.findall(r'<g class="eye eye-[lr]".*?</g></g>(?:<path[^>]*/>)*', svg, re.S)
    # rebuild eye groups robustly: take each eye group by balanced <g> matching
    groups = []; i = 0
    for m in re.finditer(r'<g class="eye eye-[lr]"', svg):
        j, depth = m.start(), 0
        for t in re.finditer(r'<(/?)g\b[^>]*?(/?)>', svg[j:]):
            if t.group(2): continue
            depth += -1 if t.group(1) else 1
            if depth == 0: groups.append(svg[j:j + t.end()]); break
    put(f'{id}/eyes.svg', ''.join(groups).encode())
json.dump(man, open(f'{out}/index.json', 'w'), separators=(',', ':'))
print('ok', len(man))
