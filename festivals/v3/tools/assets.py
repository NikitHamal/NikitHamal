#!/usr/bin/env python3
"""CC0 assets from Poly Haven (polyhaven.com, all CC0: no attribution required) -> build/ph/
models (glTF 2k), HDRIs (2k .hdr, used for light and reflections only) and PBR textures (2k: diffuse, roughness, GL normal)."""
import json, os, urllib.request
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = f"{HERE}/build/ph"
UA = {"User-Agent": "festivals-v3-build/1.0 (github.com/NikitHamal)"}
MODELS = ["bull_head", "food_pomegranate_01", "bolt_action_rifle_7_62", "coastal_cliff_01"]
HDRIS = ["brown_photostudio_02", "dikhololo_night", "kiara_9_dusk", "belfast_sunset_puresky", "kiara_8_sunset", "cobblestone_street_night"]
TEXTURES = ["castle_brick_02_red", "brown_mud_dry", "coast_sand_01", "clay_roof_tiles", "brick_pavement_02", "bamboo_veneer",
            "cobblestone_floor_04", "aerial_grass_rock", "fabric_pattern_07", "brown_leather", "clay_plaster", "bark_brown_02", "lacquered_cherry_wood", "dark_wood", "medieval_wood"]


def get(url, path):
    if os.path.exists(path): return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r: open(path, "wb").write(r.read())


def files(asset):
    with urllib.request.urlopen(urllib.request.Request(f"https://api.polyhaven.com/files/{asset}", headers=UA), timeout=60) as r: return json.load(r)


def main():
    for m in MODELS:
        g = files(m)["gltf"]["2k"]["gltf"]; d = f"{OUT}/models/{m}"
        get(g["url"], f"{d}/{m}.gltf")
        for rel, v in g.get("include", {}).items(): get(v["url"], f"{d}/{rel}")
        print("model", m, flush=True)
    for h in HDRIS:
        get(files(h)["hdri"]["2k"]["hdr"]["url"], f"{OUT}/hdri/{h}.hdr"); print("hdri", h, flush=True)
    for t in TEXTURES:
        f = files(t)
        for kind, key in (("diff", "Diffuse"), ("rough", "Rough"), ("nor", "nor_gl")):
            if key in f and "2k" in f[key]:
                ext = "jpg" if "jpg" in f[key]["2k"] else list(f[key]["2k"])[0]
                get(f[key]["2k"][ext]["url"], f"{OUT}/tex/{t}/{kind}.{ext}")
        print("texture", t, flush=True)


main()
