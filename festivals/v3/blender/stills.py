"""Still plates for the wish cards (molab):  python blender/stills.py [design ...] [--samples 256]
5 Dashain + 4 Tihar 3D designs x 3 sizes -> build/stills/plates/<design>-<size>.png  (the Kukur Tihar card is pixel art,
drawn in tools/stills_composite.py)."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bpy
import lib
import sets_a as A_
import sets_b as B_
import sets_c as C_
from render import assets
ROOT = os.path.dirname(HERE)
SIZES = {"portrait": (1080, 1350), "story": (1080, 1920), "landscape": (1920, 1080)}
DESIGNS = {
    "dashain-thali": (B_.set_thali, dict(variant="dashami"), 5.0, 7.0),
    "dashain-vijaya": (A_.set_tejas, dict(converge=0.4), 6.3, 7.0),
    "dashain-ghar": (B_.set_map, dict(variant="rise"), 6.2, 6.7),
    "dashain-changa": (B_.set_ping, {}, 3.0, 8.0),
    "dashain-jamara": (B_.set_jamara, dict(variant="still"), 4.0, 6.6),
    "tihar-deepawali": (C_.set_valley_lit, {}, 0, 1),
    "tihar-laxmi": (C_.set_rangoli, {}, 0, 1),
    "tihar-bhai": (C_.set_bhai, {}, 0, 1),
    "tihar-mha": (C_.set_mha, {}, 0, 1),
}


def main():
    args = [a for a in sys.argv[1:] if a != "--"]
    samples = 256
    if "--samples" in args:
        i = args.index("--samples"); samples = int(args[i + 1]); del args[i:i + 2]
    names = args or list(DESIGNS)
    out = f"{ROOT}/build/stills/plates"; os.makedirs(out, exist_ok=True)
    for name in names:
        build, kw, t, d = DESIGNS[name]
        for size, (w, h) in SIZES.items():
            path = f"{out}/{name}-{size}.png"
            if os.path.exists(path): continue
            sc = lib.reset(w, h, samples)
            A = assets(); A.update(kw); variant = A.pop("variant", None)
            upd = build(sc, A, variant) if variant else build(sc, A)
            upd(t, d)
            if w > h and sc.camera: sc.camera.data.lens *= 0.8   # a little wider for 16:9
            sc.render.filepath = path; bpy.ops.render.render(write_still=True)
            print("still", name, size, flush=True)


main()
