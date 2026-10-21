"""Render the 3D plates for one shot (run on molab, Blender as a Python module: `pip install bpy`).
  python blender/render.py --shot 4 [--every 1] [--samples 48] [--scale 1.0] [--only 0,120] --out plates/
Writes plates/<frame>.png (global frame index from timeline.json) and plates/marks_<shot>.json (screen positions for labels)."""
import argparse, json, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bpy
import lib
import sets_a as A_
import sets_b as B_

ROOT = os.path.dirname(HERE)
SHOTS = {
    1: (A_.set_lamp_room, dict(variant="open", strike=1.0)),
    2: (A_.set_lamp_room, dict(variant="title")),
    3: (A_.set_manuscript, {}),
    4: (A_.set_demon, dict(variant="rise")),
    5: (A_.set_tejas, dict(converge=0.4)),
    6: (A_.set_moon, dict(shatter=0.74)),
    7: (A_.set_sea, dict(release=0.3)),
    8: (B_.set_map, dict(variant="rise")),
    9: (B_.set_taleju, {}),
    10: (B_.set_map, dict(variant="route")),
    12: (B_.set_jamara, dict(variant="grow")),
    13: (B_.set_fulpati, {}),
    14: (B_.set_lamps_tools, dict(cut=0.47)),
    15: (B_.set_thali, dict(variant="dashami")),
    16: (B_.set_valley, {}),
    17: (B_.set_ping, {}),
    18: (B_.set_bus, {}),
    19: (B_.set_lane, {}),
    20: (B_.set_thali, dict(variant="blessing")),
    21: (B_.set_thali, dict(variant="wish")),
    22: (B_.set_thali, dict(variant="wish")),
}


def assets():
    a = {"tex": {"verse": f"{ROOT}/build/type/verse.png"},
         "nepal": f"{ROOT}/../lib/nepal.json", "dem": f"{ROOT}/build/dem.npy"}
    if os.path.exists(f"{ROOT}/build/dem.json"):
        a["dem_bounds"] = json.load(open(f"{ROOT}/build/dem.json"))["bounds"]
    return a


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shot", type=int, required=True); ap.add_argument("--every", type=int, default=1)
    ap.add_argument("--samples", type=int, default=48); ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--only", default=""); ap.add_argument("--out", default=f"{ROOT}/build/plates")
    ap.add_argument("--w", type=int, default=1080); ap.add_argument("--h", type=int, default=1920)
    ap.add_argument("--t", type=float, default=None, help="render a single still at this shot time (seconds)")
    ap.add_argument("--still", default=None, help="output path for --t")
    a = ap.parse_args([x for x in sys.argv[1:] if x != "--"])
    tl = json.load(open(f"{ROOT}/timeline.json")); fps = tl["fps"]
    shot = next(s for s in tl["shots"] if s["id"] == a.shot)
    build, kw = SHOTS[a.shot]
    sc = lib.reset(int(a.w * a.scale), int(a.h * a.scale), a.samples)
    A = assets(); A.update(kw)
    variant = A.pop("variant", None)
    upd = build(sc, A, variant) if variant else build(sc, A)
    os.makedirs(a.out, exist_ok=True)
    if a.t is not None:
        upd(a.t, shot["dur"]); sc.render.filepath = a.still or f"{a.out}/still_{a.shot}.png"
        bpy.ops.render.render(write_still=True); return
    frames = range(shot["f0"], shot["f1"], a.every)
    if a.only: frames = [shot["f0"] + int(x) for x in a.only.split(",")]
    marks = {}
    t0 = time.time()
    for n, f in enumerate(frames):
        path = f"{a.out}/{f:05d}.png"
        t = (f - shot["f0"]) / fps
        upd(t, shot["dur"])
        if getattr(upd, "marks", None): marks[f] = upd.marks
        if os.path.exists(path): continue
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        if n % 10 == 0:
            el = time.time() - t0; print(f"shot {a.shot} frame {f} ({n + 1}/{len(frames)}) {el / (n + 1):.2f}s/f", flush=True)
    if marks: json.dump(marks, open(f"{a.out}/marks_{a.shot}.json", "w"))
    print("DONE shot", a.shot, flush=True)


if __name__ == "__main__":
    main()
