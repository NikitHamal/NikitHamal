#!/usr/bin/env python3
"""Wish cards (molab): Chromium lays out the Nepali copy per design and size over the 3D plate (or the pixel-art scene for
Kukur Tihar), then grain + export -> out/cards_v3/<festival>/<design>-<size>-<w>x<h>.png"""
import asyncio, base64, os
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); B = f"{HERE}/build/stills"
FONTS = os.path.abspath(f"{HERE}/../fonts")
SIZES = {"portrait": (1080, 1350), "story": (1080, 1920), "landscape": (1920, 1080)}
COPY = {
    "dashain-thali": ("विजया दशमी २०८३", "हार्दिक मंगलमय शुभकामना", "आयु, आरोग्य, सुख, शान्ति र समृद्धिको कामना"),
    "dashain-vijaya": ("विजया दशमी", "असत्यमाथि सत्यको विजय", "नौ रातको शक्ति, दशौँ दिनको जित — शुभ दशैँ २०८३"),
    "dashain-ghar": ("बडा दशैँ २०८३", "जहाँ भए पनि, दशैँमा घर", "लिम्पियाधुरादेखि मेचीसम्म, हरेक आँगनमा आशीर्वाद"),
    "dashain-changa": ("शुभ दशैँ", "सपना चङ्गाजस्तै अग्लो उडोस्", "खुसी असोजको आकाशजत्तिकै फराकिलो होस्"),
    "dashain-jamara": ("घटस्थापनादेखि कोजाग्रतसम्म", "जमराजस्तै हरियो, उज्यालो वर्ष", "बडा दशैँ २०८३ को हार्दिक शुभकामना"),
    "tihar-deepawali": ("शुभ दीपावली २०८३", "हरेक झ्यालमा उज्यालो", "तिहारको हार्दिक शुभकामना"),
    "tihar-laxmi": ("लक्ष्मी पूजा", "घर-घरमा सुख, समृद्धि र उज्यालो", "शुभ दीपावली २०८३"),
    "tihar-kukur": ("कुकुर तिहार", "इमानदार साथीलाई माला र टीका", "शुभ तिहार २०८३"),
    "tihar-bhai": ("भाइटीका", "दिदीबहिनी र दाजुभाइको माया अमर रहोस्", "सप्तरङ्गी टीका, मखमली माला — शुभ तिहार २०८३"),
    "tihar-mha": ("म्ह पूजा", "न्हूदँया भिन्तुना", "नेपाल संवत् ११४७ को शुभकामना"),
}
ACC = {"dashain": "#ffb347", "tihar": "#ffd36e"}

# ---------------------------------------------------------------- Kukur Tihar: a hand-placed pixel dog (left half, mirrored)
DOG = """
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
DIYA = ["..Y..", ".YOY.", "..O..", "KbbbK", ".KKK."]
DPAL = {**PAL, "b": (150, 70, 40)}


def sprite(rows, pal, mirror=True):
    rows = [r for r in rows.strip("\n").split("\n")] if isinstance(rows, str) else rows
    if mirror: rows = [r + r[::-1] for r in rows]
    h, w = len(rows), max(len(r) for r in rows); im = np.zeros((h, w, 4), np.uint8)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c in pal: im[y, x] = (*pal[c], 255)
    return im


def pixel_scene(w, h):
    """A low-res night doorway: stars, a lit doorway, a row of diyos and the dog, upscaled with hard pixels."""
    px = 6 if w < 1500 else 8; lw, lh = w // px, h // px
    yy = np.linspace(0, 1, lh)[:, None]
    img = (np.array([14, 10, 30]) * (1 - yy) + np.array([60, 14, 22]) * yy)[:, None, :].repeat(lw, 1)
    img = np.broadcast_to(img.reshape(lh, 1, 3) if img.ndim == 2 else img, (lh, lw, 3)).copy()
    rng = np.random.default_rng(2)
    for _ in range(lw * lh // 180):
        x, y = rng.integers(0, lw), rng.integers(0, int(lh * 0.55)); img[y, x] = (255, 236, 200) if rng.random() < 0.5 else (170, 160, 200)
    dw, dh = lw // 3, int(lh * 0.42); dx = (lw - dw) // 2 if w <= h else int(lw * 0.62); dy = int(lh * 0.66) - dh
    img[dy - 2:dy + dh, dx - 2:dx + dw + 2] = (40, 16, 10)
    img[dy:dy + dh, dx:dx + dw] = (255, 160, 60)
    img[dy + 2:dy + dh, dx + 2:dx + dw - 2] = (255, 196, 96)
    floor = int(lh * 0.66); img[floor:] = (70, 30, 20); img[floor:floor + 1] = (110, 50, 28)
    for k in range(0, lw, 4):  # a marigold toran across the top of the door
        yk = dy - 3 + int(2 * np.sin(k / 3)); img[yk:yk + 2, k:k + 2] = (255, 140, 20) if (k // 4) % 2 else (255, 205, 40)
    def blit(sp, x0, y0, s=1):
        sp = np.repeat(np.repeat(sp, s, 0), s, 1); hh, ww = sp.shape[:2]
        reg = img[y0:y0 + hh, x0:x0 + ww]; a = sp[:reg.shape[0], :reg.shape[1], 3:4] / 255.0
        img[y0:y0 + hh, x0:x0 + ww] = reg * (1 - a) + sp[:reg.shape[0], :reg.shape[1], :3] * a
    dog = sprite(DOG, PAL); s = max(1, int(lh * 0.36 / dog.shape[0]))
    gx = (lw - dog.shape[1] * s) // 2 if w <= h else int(lw * 0.62) + (dw - dog.shape[1] * s) // 2
    blit(dog, gx, floor + 4 - dog.shape[0] * s + int(lh * 0.06), s)
    di = sprite(DIYA, DPAL, mirror=False)
    for k in range(7):
        x = int(lw * (0.08 + 0.14 * k)); blit(di, x, floor + int(lh * 0.12), max(1, s // 2 + 1))
    up = np.repeat(np.repeat(img.astype(np.uint8), px, 0), px, 1)
    out = np.zeros((h, w, 3), np.uint8); out[:up.shape[0], :up.shape[1]] = up[:h, :w]
    return out


def layout(design, size, w, h):
    fest = design.split("-")[0]; kick, head, sub = COPY[design]; acc = ACC[fest]
    land = w > h
    box = (f"left:110px;top:0;bottom:0;width:{int(w * 0.42)}px;justify-content:center;text-align:left" if land else
           f"left:80px;right:80px;bottom:{int(h * (0.14 if size == 'story' else 0.08))}px;text-align:center")
    scrim = ("linear-gradient(90deg,rgba(0,0,0,.72),rgba(0,0,0,.35) 45%,rgba(0,0,0,0) 70%)" if land else
             "linear-gradient(0deg,rgba(0,0,0,.78),rgba(0,0,0,.42) 35%,rgba(0,0,0,0) 62%)")
    hs = 92 if land else (96 if size == "story" else 84)
    return f"""<style>
@font-face {{ font-family: Mukta; src: url(file://{FONTS}/Mukta-Bold.ttf); font-weight: 700; }}
@font-face {{ font-family: Mukta; src: url(file://{FONTS}/Mukta-ExtraBold.ttf); font-weight: 800; }}
@font-face {{ font-family: Mukta; src: url(file://{FONTS}/Mukta-Medium.ttf); font-weight: 500; }}
html,body{{margin:0;width:{w}px;height:{h}px;overflow:hidden;background:transparent}}
#s{{position:absolute;inset:0;background:{scrim}}}
#c{{position:absolute;{box};display:flex;flex-direction:column;font-family:Mukta;color:#fff6ea}}
.k{{font-weight:700;font-size:38px;letter-spacing:.05em;color:{acc};padding-top:12px;border-top:4px solid #d8202a;align-self:{'flex-start' if land else 'center'}}}
.h{{font-weight:800;font-size:{hs}px;line-height:1.16;margin-top:22px;text-shadow:0 4px 28px rgba(0,0,0,.45)}}
.p{{font-weight:500;font-size:40px;line-height:1.4;margin-top:22px;color:#ffe9cc}}
.sig{{font-weight:700;font-size:30px;margin-top:36px;color:#ffffffb0}}
</style><div id=s></div><div id=c><div class=k>{kick}</div><div class=h>{head}</div><div class=p>{sub}</div><div class=sig>— निकित हमाल</div></div>"""


async def main():
    os.makedirs(f"{B}/type", exist_ok=True)
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page()
        for design in COPY:
            fest = design.split("-")[0]; od = f"{HERE}/out/cards_v3/{fest}"; os.makedirs(od, exist_ok=True)
            for size, (w, h) in SIZES.items():
                await pg.set_viewport_size({"width": w, "height": h})
                await pg.set_content(layout(design, size, w, h)); await pg.evaluate("document.fonts.ready")
                tp = f"{B}/type/{design}-{size}.png"; await pg.screenshot(path=tp, omit_background=True)
                if design == "tihar-kukur": base = pixel_scene(w, h).astype(np.float32)
                else:
                    pp = f"{B}/plates/{design}-{size}.png"
                    if not os.path.exists(pp): print("missing plate", pp); continue
                    base = np.asarray(Image.open(pp).convert("RGB")).astype(np.float32)
                ty = np.asarray(Image.open(tp).convert("RGBA")).astype(np.float32) / 255
                fr = base * (1 - ty[..., 3:]) + ty[..., :3] * 255 * ty[..., 3:]
                if design != "tihar-kukur": fr += np.random.default_rng(1).normal(0, 3.0, fr.shape[:2])[..., None]
                Image.fromarray(np.clip(fr, 0, 255).astype(np.uint8)).save(f"{od}/{design}-{size}-{w}x{h}.png", optimize=True)
                print("card", design, size, flush=True)
        await br.close()

asyncio.run(main())
