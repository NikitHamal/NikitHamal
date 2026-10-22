#!/usr/bin/env python3
"""Type pass (run on molab): Chromium shapes all Devanagari (Pillow on its own cannot), and we keep the pixels.
Outputs build/type/:
  verse.png                      palm-leaf manuscript texture (Tiro Devanagari Sanskrit, ink)
  cap_<id>/w<k>.png + cap_<id>.json   caption words, each its own transparent PNG, with its box in frame pixels
  kick_<id>.png                  section kicker (small accent label above the caption)
  label_<name>.png               map labels; night_<n>.png Navadurga names; title.png; wish.png; sign.png
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
ROOTV = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILM = os.environ.get("FILM", "dashain")
HERE = ROOTV if FILM == "dashain" else f"{ROOTV}/{FILM}"
OUT = f"{ROOTV}/build/type" if FILM == "dashain" else f"{ROOTV}/build_{FILM}/type"
FONTS = os.path.abspath(f"{ROOTV}/../fonts")

CSS = f"""
@font-face {{ font-family: Mukta; src: url(file://{FONTS}/Mukta-Medium.ttf); font-weight: 500; }}
@font-face {{ font-family: Mukta; src: url(file://{FONTS}/Mukta-Bold.ttf); font-weight: 700; }}
@font-face {{ font-family: Mukta; src: url(file://{FONTS}/Mukta-ExtraBold.ttf); font-weight: 800; }}
@font-face {{ font-family: Tiro; src: url(file://{FONTS}/TiroDevanagariSanskrit-Regular.ttf); }}
@font-face {{ font-family: Yatra; src: url(file://{FONTS}/YatraOne-Regular.ttf); }}
html, body {{ margin: 0; background: transparent; }}
#stage {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; }}
.cap {{ position: absolute; left: 90px; width: 900px; text-align: center; font-family: Mukta; font-weight: 500;
        font-size: 62px; line-height: 1.32; color: #fff8ee; text-shadow: 0 2px 14px rgba(0,0,0,.55); }}
.cap span {{ display: inline-block; margin: 0 .14em; }}
"""

KICK = {1: "", 3: "देवी माहात्म्य", 4: "महिषासुर", 5: "दुर्गा", 6: "नवरात्र", 7: "रामायण", 8: "नेपाल", 9: "हनुमानढोका · तलेजु",
        10: "गोरखा → काठमाडौँ", 11: "पन्ध्र दिन", 12: "१ · घटस्थापना", 13: "७ · फूलपाती", 14: "८ · अष्टमी  /  ९ · नवमी",
        15: "१० · विजया दशमी", 16: "१५ · कोजाग्रत पूर्णिमा", 17: "आकाश", 18: "घर", 19: "मिलन", 20: "आशीर्वाद"}
NIGHTS = ["शैलपुत्री", "ब्रह्मचारिणी", "चन्द्रघण्टा", "कुष्माण्डा", "स्कन्दमाता", "कात्यायनी", "कालरात्रि", "महागौरी", "सिद्धिदात्री"]
ORD = ["पहिलो", "दोस्रो", "तेस्रो", "चौथो", "पाँचौँ", "छैटौँ", "सातौँ", "आठौँ", "नवौँ"]
LABELS = {"ktm": "काठमाडौँ", "gorkha": "गोरखा", "west": "लिम्पियाधुरा · लिपुलेक · कालापानी"}
if FILM == "tihar":
    KICK = {3: "यमपञ्चक", 4: "यम र यमुना", 5: "यमुनाको वचन", 6: "पाँच दिन", 7: "१ · काग तिहार", 8: "२ · कुकुर तिहार", 9: "३ · गाई तिहार · लक्ष्मी पूजा",
            10: "३ · औँसीको रात", 11: "भैलो · देउसी", 12: "४ · गोवर्धन पूजा · गोरु तिहार", 13: "४ · म्ह पूजा", 14: "नेपाल संवत्", 15: "५ · भाइटीका", 16: "आशीर्वाद", 17: "माया"}
VERSE = ("या देवी सर्वभूतेषु शक्तिरूपेण संस्थिता। नमस्तस्यै नमस्तस्यै नमस्तस्यै नमो नमः॥ "
         "या देवी सर्वभूतेषु मातृरूपेण संस्थिता। नमस्तस्यै नमस्तस्यै नमस्तस्यै नमो नमः॥ "
         "या देवी सर्वभूतेषु बुद्धिरूपेण संस्थिता। नमस्तस्यै नमस्तस्यै नमस्तस्यै नमो नमः॥")


async def shot_el(page, html, path, w, h, sel="#x"):
    await page.set_viewport_size({"width": w, "height": h})
    await page.set_content(f"<style>{CSS}</style>{html}"); await page.evaluate("document.fonts.ready")
    await page.locator(sel).screenshot(path=path, omit_background=True)


async def main():
    os.makedirs(OUT, exist_ok=True)
    L = json.load(open(f"{HERE}/lines.json"))
    async with async_playwright() as p:
        b = await p.chromium.launch(); page = await b.new_page(device_scale_factor=1)
        # palm-leaf texture: three lines of verse, ink with slight warmth, on transparent
        await shot_el(page, f"""<div id=x style="width:3840px;height:400px;display:flex;flex-direction:column;justify-content:center;
            padding:0 140px;box-sizing:border-box;font-family:Tiro;font-size:84px;line-height:118px;color:#2a120a;opacity:.9;
            white-space:nowrap;overflow:hidden">{''.join(f'<div>{v.strip()}॥</div>' for v in VERSE.split('॥') if v.strip())}</div>""", f"{OUT}/verse.png", 3840, 400)
        for r in L:
            if r["id"] in ((2, 21, 22) if FILM == "dashain" else (2, 18, 19)): continue
            words = r["text"].split()
            spans = "".join(f'<span id=w{k}>{w}</span>' for k, w in enumerate(words))
            await page.set_viewport_size({"width": 1080, "height": 1920})
            await page.set_content(f"<style>{CSS}</style><div id=stage><div class=cap id=cap style='top:1180px'>{spans}</div></div>")
            await page.evaluate("document.fonts.ready")
            d = f"{OUT}/cap_{r['id']}"; os.makedirs(d, exist_ok=True); boxes = []
            for k in range(len(words)):
                loc = page.locator(f"#w{k}"); bb = await loc.bounding_box()
                pad = 22
                clip = {"x": bb["x"] - pad, "y": bb["y"] - pad, "width": bb["width"] + 2 * pad, "height": bb["height"] + 2 * pad}
                await page.evaluate(f"""for (const s of document.querySelectorAll('.cap span')) s.style.visibility = s.id === 'w{k}' ? 'visible' : 'hidden'""")
                await page.screenshot(path=f"{d}/w{k}.png", clip=clip, omit_background=True)
                boxes.append([round(clip["x"]), round(clip["y"]), round(clip["width"]), round(clip["height"])])
            json.dump({"words": words, "boxes": boxes}, open(f"{d}.json", "w"), ensure_ascii=False)
            if KICK.get(r["id"]):
                await shot_el(page, f"""<div id=x style="display:inline-block;padding:10px 24px;font-family:Mukta;font-weight:700;font-size:34px;
                    letter-spacing:.06em;color:#ffb347;border-top:3px solid #d8202a">{KICK[r['id']]}</div>""", f"{OUT}/kick_{r['id']}.png", 1080, 300)
        for k, v in LABELS.items():
            await shot_el(page, f"""<div id=x style="display:inline-block;padding:6px 16px;font-family:Mukta;font-weight:700;font-size:{30 if k=='west' else 40}px;
                color:#fff4e0;text-shadow:0 2px 10px rgba(0,0,0,.8)">{v}</div>""", f"{OUT}/label_{k}.png", 1080, 300)
        for n in range(9):
            await shot_el(page, f"""<div id=x style="display:inline-block;text-align:center;padding:10px 20px;font-family:Mukta;color:#fff4e0">
                <div style="font-weight:700;font-size:30px;letter-spacing:.08em;color:#ffb347">{ORD[n]} रात</div>
                <div style="font-weight:800;font-size:72px;line-height:1.1;text-shadow:0 2px 16px rgba(0,0,0,.7)">{NIGHTS[n]}</div></div>""", f"{OUT}/night_{n + 1}.png", 1080, 400)
        TITLE = "दशैँ" if FILM == "dashain" else "तिहार"
        await shot_el(page, f"""<div id=x style="display:inline-block;padding:40px 60px;font-family:Mukta;font-weight:800;font-size:{300 if FILM == 'dashain' else 260}px;line-height:1.1;
            color:#fff1dc;text-shadow:0 0 60px rgba(255,140,40,.55)">{TITLE}</div>""", f"{OUT}/title.png", 1080, 700)
        if FILM == "tihar":
            await shot_el(page, """<div id=x style="display:inline-block;text-align:center;padding:20px 40px;font-family:Mukta;color:#fff4e0">
                <div style="font-weight:700;font-size:36px;letter-spacing:.08em;color:#ffcf6e">नेपाल संवत्</div>
                <div style="font-weight:800;font-size:220px;line-height:1.05;text-shadow:0 0 50px rgba(255,170,60,.5)">११४७</div></div>""", f"{OUT}/ns.png", 1080, 600)
        await shot_el(page, """<div id=x style="display:inline-block;width:960px;text-align:center;font-family:Mukta;color:#fff4e6">
            <div style="font-weight:700;font-size:40px;letter-spacing:.06em;color:#ffcf6e">""" + ("विजया दशमी २०८३" if FILM == "dashain" else "शुभ दीपावली · तिहार २०८३") + """</div>
            <div style="font-weight:800;font-size:96px;line-height:1.15;margin-top:18px;text-shadow:0 4px 30px rgba(0,0,0,.5)">""" + ("हार्दिक मंगलमय<br>शुभकामना" if FILM == "dashain" else "हार्दिक<br>शुभकामना") + """</div></div>""",
            f"{OUT}/wish.png", 1080, 800)
        await shot_el(page, """<div id=x style="display:inline-block;padding:10px 30px;font-family:Mukta;font-weight:700;font-size:46px;color:#fff4e6">— निकित हमाल</div>""",
            f"{OUT}/sign.png", 1080, 300)
        await b.close()
    print("type done")

asyncio.run(main())
