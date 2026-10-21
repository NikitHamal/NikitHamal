"""Tihar sets for the stills: the valley lit for Deepawali, Laxmi Puja rangoli + footprints, the Bhai Tika saptarangi
thali with makhamali garlands, and a Mha Puja mandala."""
import math
import bpy
import numpy as np
from mathutils import Vector
from lib import *
from lib import _set, _ramp
import sets_b as B_

SAPTA = [(0.75, 0.02, 0.03), (1.0, 0.45, 0.02), (1.0, 0.82, 0.05), (0.08, 0.45, 0.1), (0.05, 0.25, 0.75), (0.3, 0.05, 0.5), (0.95, 0.95, 0.92)]


def _powder(name, color):
    return noisy(mat(name, color, rough=0.95, sss=0.05), 900, 0.25, 0.03, 0.4, 3)


def set_valley_lit(sc, A):
    """Deepawali: every window and every parapet lit; strings of lamps; a few sky lanterns."""
    world(sky=[(0.0, (0.03, 0.02, 0.05)), (0.35, (0.01, 0.01, 0.035)), (1.0, (0.002, 0.002, 0.01))], strength=1.0)
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=200, y_subdivisions=200, size=400); hills = bpy.context.object
    tx = bpy.data.textures.new("hills", "CLOUDS"); tx.noise_scale = 1.4
    dm = hills.modifiers.new("d", "DISPLACE"); dm.texture = tx; dm.strength = 1.0; dm.texture_coords = "GLOBAL"
    hills.data.materials.append(mat("hillm", (0.02, 0.03, 0.02), rough=0.9))
    H, Wn, P = B_.houses("town", 520, (-16, 16, 3, 44), 8, 0.85)
    rnd = np.random.default_rng(6)
    src = prim("ico_sphere", "bulb", emission("bulbm", (1.0, 0.62, 0.22), 25), subdivisions=1, radius=0.035)
    pts = []
    for (x, y, _) in P[rnd.random(len(P)) < 0.5]:
        for k in range(14):
            pts.append((x - 0.5 + k / 13, y - 0.42, 1.65 + 0.03 * math.sin(k)))
    instance_points("strings", src, np.array(pts))
    lan_m = emission("lantern", (1.0, 0.5, 0.15), 18)
    for i in range(14):
        l = prim("cylinder", "lan%d" % i, lan_m, radius=0.25, depth=0.4, location=(rnd.uniform(-10, 10), rnd.uniform(12, 40), rnd.uniform(5, 16)))
    hdri_light("dikhololo_night", 1.2)
    moon = light("SUN", (0, 0, 0), 1.6, (0.65, 0.75, 1.0), size=0.02); moon.rotation_euler = (math.radians(62), 0, math.radians(160))
    light("AREA", (0, 8, 6), 600, (1.0, 0.6, 0.3), size=20, look=(0, 20, 0))
    volume_world(0.004, (1.0, 0.8, 0.6), 0.6)
    glare(sc, 1.0, 8, -0.5)
    cam = camera((0.0, -3.0, 3.2), (0, 26, 0.8), 38, dof=12, fstop=4)
    return lambda t, d: None


def _texture(name, rgba):
    h, w = rgba.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(np.flipud(rgba).astype(np.float32).ravel()); img.pack()
    return img


def rangoli_rgba(n=1024, seed=0):
    """A rangoli/mandala drawn procedurally: petals in rings, saptarangi bands, a lotus centre."""
    yy, xx = np.mgrid[0:n, 0:n] / n - 0.5; r = np.sqrt(xx ** 2 + yy ** 2) * 2; a = np.arctan2(yy, xx)
    out = np.zeros((n, n, 4), np.float32)
    def paint(mask, c): out[mask] = (*c, 1.0)
    paint(r < 0.98, (0.75, 0.05, 0.05))
    for i, rr in enumerate(np.linspace(0.92, 0.2, 7)):
        petals = 8 + 4 * i
        edge = rr - 0.07 * (0.5 + 0.5 * np.cos(petals * a)) ** 2
        paint((r < edge) & (r > edge - 0.085), SAPTA[i % 7])
    paint(r < 0.14, (1.0, 0.82, 0.05)); paint(r < 0.06, (0.95, 0.95, 0.92))
    dots = (np.abs(r - 0.955) < 0.012) & ((np.cos(48 * a)) > 0.6); paint(dots, (0.95, 0.95, 0.92))
    return out


def set_rangoli(sc, A):
    """Laxmi Puja: a rangoli at the threshold, red footprints leading in, diyos in a ring, marigold torans."""
    world(INK, 0)
    floor = prim("plane", "floor", noisy(mat("mudfloor", (0.25, 0.14, 0.08), rough=0.9), 6, 0.4, 0.05, 0.3), size=10)
    rg = prim("plane", "rangoli", None, size=1.6, location=(0, 0, 0.002))
    m = bpy.data.materials.new("rang"); m.use_nodes = True; nt = m.node_tree; p = nt.nodes["Principled BSDF"]
    tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = _texture("rangoli", rangoli_rgba())
    nt.links.new(tx.outputs["Color"], p.inputs["Base Color"]); nt.links.new(tx.outputs["Alpha"], p.inputs["Alpha"])
    p.inputs["Roughness"].default_value = 0.95
    bp = nt.nodes.new("ShaderNodeBump"); nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 900
    bp.inputs["Strength"].default_value = 0.5; nt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs[0], p.inputs["Normal"])
    rg.data.materials.append(m)
    foot = _powder("footred", (0.65, 0.02, 0.03))
    for i in range(6):  # Laxmi's footprints walking in from the door
        side = 1 if i % 2 else -1
        f = prim("uv_sphere", "foot%d" % i, foot, radius=0.05, location=(side * 0.07, 1.0 + i * 0.22, 0.001)); f.scale = (0.55, 1.0, 0.02)
        for k in range(5):
            tz = prim("uv_sphere", "toe", foot, radius=0.012, location=(side * 0.07 + (k - 2) * 0.017, 1.0 + i * 0.22 - 0.065, 0.001)); tz.scale = (1, 1, 0.1)
    lamps = []
    for i in range(16):
        a = 2 * math.pi * i / 16
        lamps.append(diyo("ld%d" % i, (0.95 * math.cos(a), 0.95 * math.sin(a), 0), 1.6, 80, 3.0))
    door = prim("cube", "doorframe", noisy(mat("frame", (0.07, 0.03, 0.015), rough=0.6), 60, 0.3, 0.1, 0.4), size=1, location=(0, 2.6, 1.1)); door.scale = (1.4, 0.15, 2.2)
    glow = prim("plane", "doorglow", emission("dg", (1.0, 0.55, 0.2), 2.2), size=1, location=(0, 2.52, 1.0), rotation=(math.pi / 2, 0, 0)); glow.scale = (1.1, 2.0, 1)
    for i in range(22):
        marigold("toran%d" % i, (-0.7 + 1.4 * i / 21, 2.45, 2.15 - 0.25 * math.sin(math.pi * i / 21)), 0.045)
    hdri_light("brown_photostudio_02", 0.25)
    light("AREA", (0.0, -1.2, 2.4), 45, (1.0, 0.75, 0.5), size=1.5, look=(0, 0.2, 0))
    volume_world(0.015, (1, 0.85, 0.7), 0.5)
    glare(sc, 1.4, 7, -0.65)
    camera((0.0, -2.0, 2.3), (0, 0.55, 0.0), 30, dof=2.9, fstop=4)
    return lambda t, d: None


def set_bhai(sc, A):
    """Bhai Tika: the brass thali with seven powder heaps, makhamali garlands, walnuts, dubo and a diyo."""
    world(INK, 0)
    table = prim("plane", "table", noisy(mat("velvet", (0.2, 0.01, 0.12), rough=0.95, sss=0.05), 200, 0.35, 0.05, 0.6), size=6)
    prof = smooth_profile([(0.0, 0.0), (0.2, 0.0), (0.235, 0.008), (0.25, 0.022), (0.262, 0.028), (0.258, 0.03), (0.24, 0.022), (0.2, 0.008), (0.0, 0.008)], 6)
    lathe("thali", prof, 128, brass("thalib", 0.18))
    for i, c in enumerate(SAPTA):
        a = 2 * math.pi * i / 7
        h = prim("uv_sphere", "heap%d" % i, _powder("p%d" % i, c), radius=0.045, location=(0.14 * math.cos(a), 0.14 * math.sin(a), 0.008)); h.scale = (1, 1, 0.45)
    amar = noisy(mat("makhamali", (0.42, 0.02, 0.35), rough=0.7, sss=0.2), 400, 0.3, 0.1, 0.8)
    for g in range(2):
        for i in range(26):
            a = 2 * math.pi * i / 26
            f = prim("ico_sphere", "mk", amar, subdivisions=2, radius=0.022, location=((0.36 + 0.05 * g) * math.cos(a), (0.36 + 0.05 * g) * math.sin(a) - 0.02 * g, 0.022))
            f.scale = (1, 1, 1.2)
    wal = noisy(mat("walnut", (0.3, 0.18, 0.08), rough=0.8), 60, 0.4, 0.1, 1.2)
    for i in range(3):
        o = prim("uv_sphere", "okhar%d" % i, wal, radius=0.03, location=(0.05 * i - 0.05, 0.0, 0.035)); o.scale = (1, 0.85, 0.9)
        md = o.modifiers.new("d", "DISPLACE"); md.texture = bpy.data.textures.new("w%d" % i, "VORONOI"); md.strength = 0.008
    for i in range(40):
        a = np.random.default_rng(i).random() * 6.28
        curve_tube("dubo%d" % i, [(0.02 * math.cos(a), -0.06 + 0.02 * math.sin(a), 0.01), (0.07 * math.cos(a), -0.06 + 0.07 * math.sin(a), 0.03), (0.12 * math.cos(a), -0.06 + 0.12 * math.sin(a), 0.015)], 0.0015, mat("dubo", (0.1, 0.35, 0.05), rough=0.5))
    diyo("diyo", (-0.08, 0.2, 0.008), 1.0, 60, 4)
    light("AREA", (0.5, -0.6, 0.9), 40, (1, 0.8, 0.6), size=0.6, look=(0, 0, 0))
    light("AREA", (-0.6, 0.7, 0.35), 16, (1, 0.45, 0.6), size=0.5, look=(0, 0, 0))
    volume_world(0.02, (1, 0.85, 0.75), 0.5)
    glare(sc, 1.0, 8, -0.5)
    camera((0.0, -0.62, 0.7), (0, 0, 0), 42, dof=0.95, fstop=3.2)
    return lambda t, d: None


def set_mha(sc, A):
    """Mha Puja: concentric rings of coloured grain (a mandala for one's own body), lamps, fruit and flowers."""
    world(INK, 0)
    floor = prim("plane", "floor", noisy(mat("floor", (0.12, 0.05, 0.03), rough=0.85), 6, 0.4, 0.05, 0.3), size=8)
    rnd = np.random.default_rng(3)
    grain = prim("uv_sphere", "g", None, radius=0.004, segments=8, ring_count=5); grain.scale = (1, 0.5, 0.5)
    for i, (r0, r1, c) in enumerate([(0.0, 0.07, SAPTA[2]), (0.07, 0.12, SAPTA[0]), (0.12, 0.17, SAPTA[6]), (0.17, 0.23, SAPTA[3]),
                                     (0.23, 0.28, SAPTA[1]), (0.28, 0.33, SAPTA[4]), (0.33, 0.38, SAPTA[5]), (0.38, 0.44, SAPTA[0])]):
        n = int(5000 * (r1 ** 2 - r0 ** 2) / 0.19 + 300)
        rr = np.sqrt(rnd.uniform(r0 ** 2, r1 ** 2, n)); aa = rnd.random(n) * 6.28
        g = grain.copy(); g.data = grain.data.copy(); link(g); g.data.materials.append(_powder("mg%d" % i, c))
        instance_points("ring%d" % i, g, np.stack([rr * np.cos(aa), rr * np.sin(aa), np.full(n, 0.004)], 1), rnd.random((n, 3)) * 6.28)
    grain.hide_render = True
    for i in range(12):
        a = 2 * math.pi * i / 12
        diyo("m%d" % i, (0.55 * math.cos(a), 0.55 * math.sin(a), 0), 1.4, 80, 3)
    for i in range(8):
        a = 2 * math.pi * (i + 0.5) / 8
        marigold("f%d" % i, (0.49 * math.cos(a), 0.49 * math.sin(a), 0.03), 0.035)
    sukunda = lathe("sukunda", smooth_profile([(0, 0), (0.06, 0), (0.08, 0.03), (0.05, 0.07), (0.03, 0.12), (0.045, 0.2), (0.0, 0.26)], 5), 64, brass("sk", 0.2))
    sukunda.location = (0, 0.75, 0)
    light("AREA", (0.6, -0.8, 1.2), 30, (1, 0.8, 0.6), size=0.8, look=(0, 0, 0))
    volume_world(0.02, (1, 0.85, 0.7), 0.5)
    glare(sc, 1.0, 8, -0.5)
    camera((0.0, -0.9, 1.1), (0, 0.05, 0), 40, dof=1.4, fstop=4)
    return lambda t, d: None
