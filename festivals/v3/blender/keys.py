"""Keyframe stills for the CPU build: per shot, the camera is locked at one pose and only light and action change
between keys (a diyo striking, a door opening, the moon waxing, jamara growing, volleys, the shatter). The compositor
dissolves between keys and adds a slow 2D push. Run:  python blender/keys.py [shot ...] [--samples 16] [--scale 0.8]
-> build/keys/s<shot>_<k>.png  (+ build/keys/marks.json for map labels)."""
import json, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bpy
import lib
from render import SHOTS, assets
ROOT = os.path.dirname(HERE)
NIGHT = [round((n + 0.5) / 9 * 0.74, 3) for n in range(9)]
# shot: (camera u, [key u ...], dissolve seconds)
KEYS = {
    1: (0.5, [0.05, 0.3, 0.92], 0.5), 2: (0.5, [0.5], 0), 3: (0.5, [0.5], 0), 4: (0.6, [0.12, 0.45, 0.72], 1.2),
    5: (0.75, [0.02, 0.14, 0.26, 0.36, 0.42, 0.55, 0.85], 0.6), 6: (0.5, NIGHT + [0.765, 0.8, 0.86, 0.95], 0.35),
    7: (0.5, [0.2, 0.33, 0.45, 0.7], 0.5), 8: (1.0, [0.3, 0.55, 0.95], 1.0), 9: (0.6, [0.3, 0.75], 0.8),
    10: (0.5, [0.1, 0.3, 0.5, 0.7, 0.92], 0.7), 12: (0.6, [0.05, 0.2, 0.35, 0.5, 0.7, 0.95], 0.9),
    13: (0.5, [0.3, 0.55, 0.6, 0.68, 0.74, 0.81, 0.9], 0.12), 14: (None, [0.2, 0.75], 0.4), 15: (0.5, [0.5], 0),
    16: (0.75, [0.2, 0.7], 0.8), 17: (0.5, [0.5], 0), 18: (0.5, [0.5], 0), 19: (0.5, [0.5], 0),
    20: (0.62, [0.4, 0.7, 0.8, 0.92], 0.5), 21: (0.5, [0.5], 0),
}


def main():
    threads = int(os.environ.get("THREADS", "0"))
    args = [a for a in sys.argv[1:] if a != "--"]
    opt = {"--samples": 16, "--scale": 0.8}
    for k in list(opt):
        if k in args: i = args.index(k); opt[k] = type(opt[k])(args[i + 1]); del args[i:i + 2]
    shots = [int(a) for a in args] or list(KEYS)
    tl = json.load(open(f"{ROOT}/timeline.json")); S = {s["id"]: s for s in tl["shots"]}
    out = f"{ROOT}/build/keys"; os.makedirs(out, exist_ok=True)
    mpath = f"{out}/marks.json"; marks = json.load(open(mpath)) if os.path.exists(mpath) else {}
    json.dump({str(k): v for k, v in KEYS.items()}, open(f"{out}/keys.json", "w"))
    for sid in shots:
        camu, us, _ = KEYS[sid]; d = S[sid]["dur"]
        todo = [k for k in range(len(us)) if not os.path.exists(f"{out}/s{sid}_{k}.png")]
        if not todo: continue
        build, kw = SHOTS[sid]
        sc = lib.reset(int(1080 * opt["--scale"]), int(1920 * opt["--scale"]), opt["--samples"])
        if threads: sc.render.threads_mode = "FIXED"; sc.render.threads = threads
        A = assets(); A.update(kw); variant = A.pop("variant", None)
        upd = build(sc, A, variant) if variant else build(sc, A)
        for k in todo:
            t0 = time.time(); u = us[k]
            if camu is not None:
                upd(camu * d, d); bpy.context.view_layer.update()
                cam = sc.camera; M = cam.matrix_world.copy(); fd = cam.data.dof.focus_distance
            upd(u * d, d)
            if camu is not None:
                cam.matrix_world = M; cam.data.dof.focus_distance = fd
            bpy.context.view_layer.update()
            if sid in (8, 10): marks[f"{sid}_{k}"] = _remark(sc, upd)
            sc.render.filepath = f"{out}/s{sid}_{k}.png"
            if not os.environ.get("DRYKEYS"): bpy.ops.render.render(write_still=True)
            print(f"key s{sid}_{k} u={u} {time.time() - t0:.0f}s", flush=True)
            json.dump(marks, open(mpath, "w"))


def _remark(sc, upd):
    # sets_b.set_map stores world positions on the closure; recompute screen positions against the locked camera
    from bpy_extras.object_utils import world_to_camera_view
    root = bpy.data.objects["map"]; out = {}
    for k, v in upd.world.items():
        c = world_to_camera_view(sc, sc.camera, root.matrix_world @ v); out[k] = (c.x, 1 - c.y, c.z)
    return out


main()
