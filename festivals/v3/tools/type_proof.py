#!/usr/bin/env python3
"""Proof sheet of every Devanagari word used on screen (both films), set in the caption font -> build/type_proof.png"""
import asyncio, json, os, re
from playwright.async_api import async_playwright
V = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); FONTS = os.path.abspath(f"{V}/../fonts")
words = []
for p in (f"{V}/lines.json", f"{V}/tihar/lines.json"):
    for r in json.load(open(p)):
        for w in re.findall(r"[ऀ-ॿ]+", r["text"]):
            if "्" in w and w not in words: words.append(w)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1400, "height": 1800})
        html = f"""<style>@font-face{{font-family:Deva;src:url(file://{FONTS}/NotoSansDevanagari-Variable.ttf);font-weight:100 900}}
        @font-face{{font-family:Mukta;src:url(file://{FONTS}/Mukta-Medium.ttf)}}
        body{{background:#111;color:#fff;margin:20px;display:grid;grid-template-columns:repeat(4,1fr);gap:6px 26px}}
        div{{font:500 34px Deva}} span{{font:500 22px Mukta;color:#888;margin-left:8px}}</style>""" + "".join(f"<div>{w}<span>{w}</span></div>" for w in words)
        await pg.set_content(html); await pg.evaluate("Promise.all([document.fonts.load('500 34px Deva','अ'),document.fonts.load('22px Mukta','अ')]).then(()=>document.fonts.ready)")
        await pg.screenshot(path=f"{V}/build/type_proof.png", full_page=True); await b.close()
asyncio.run(main())
