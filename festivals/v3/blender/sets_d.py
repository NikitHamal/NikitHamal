"""Overhauled sets: the Ramayana shot (Rama's bow, the arrow across the sea, golden Lanka) and Fulpati (a carved, gilded
doli carrying the navapatrika - the nine plants - with the salute line firing at dusk). Uses Poly Haven CC0 scans when
downloaded (cliff, pomegranate, rifle, wood textures); falls back to procedural geometry otherwise."""
import math
import bpy
import numpy as np
from mathutils import Vector
from lib import *
from lib import _set, _ramp


# ------------------------------------------------------------------ shared botany
def leaf_mesh(name, L, W, m, n=18, fold=0.25, droop=0.35, tears=0, seed=0, shape="lance", petiole=0.0):
    """A leaf as a folded, drooping blade with a raised midrib. shape: lance (turmeric/ashoka), banana (long, parallel
    sides, torn into strips), heart (colocasia: wide base)."""
    rnd = np.random.default_rng(seed); V = []; F = []; cols = 7
    for i in range(n + 1):
        t = i / n
        if shape == "banana": w = W * (math.sin(math.pi * min(1, t * 1.4)) ** 0.25) * (1 - t ** 6)
        elif shape == "heart": w = W * math.sin(math.pi * (0.15 + 0.85 * t)) ** 0.6 * (1.25 - t)
        else: w = W * math.sin(math.pi * t) ** 0.8
        x = t * L; z = -droop * L * t * t
        for j in range(cols):
            s = (j / (cols - 1)) * 2 - 1
            V.append((x, s * w, z + fold * abs(s) * w))
    for i in range(n):
        for j in range(cols - 1):
            a = i * cols + j
            if tears and shape == "banana" and j != cols // 2 - 1 and j != cols // 2 and rnd.random() < tears * (i / n): continue
            F.append((a, a + cols, a + cols + 1, a + 1))
    o = mesh_obj(name, V, F, m); solidify(o, 0.0015)
    rib = curve_tube(name + "_rib", [(0, 0, 0.004), (L * 0.5, 0, -droop * L * 0.25 + 0.006), (L, 0, -droop * L + 0.002)], 0.004 if shape == "banana" else 0.0015, m)
    rib.parent = o
    if petiole:
        pt = curve_tube(name + "_pet", [(-petiole, 0, -petiole * 0.6), (-petiole * 0.4, 0, -petiole * 0.1), (0, 0, 0)], 0.006, m); pt.parent = o
    return o


def leaf_mat(name, col, vein=True):
    m = mat(name, col, rough=0.42, sss=0.15, coat=0.2)
    if vein:
        nt = m.node_tree; p = nt.nodes["Principled BSDF"]
        tc = nt.nodes.new("ShaderNodeTexCoord"); wv = nt.nodes.new("ShaderNodeTexWave"); wv.wave_type = "BANDS"; wv.inputs["Scale"].default_value = 60
        wv.bands_direction = "Y"; wv.inputs["Distortion"].default_value = 1.5
        nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
        mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "MULTIPLY"; mx.inputs[0].default_value = 0.25
        mx.inputs[6].default_value = (*col, 1); nt.links.new(wv.outputs["Color"], mx.inputs[7]); nt.links.new(mx.outputs[2], p.inputs["Base Color"])
        bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.15
        nt.links.new(wv.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs[0], p.inputs["Normal"])
    return m


def paddy(name, base, n=36, seed=5):
    """Ripe paddy: stalks that bow under drooping panicles of grain."""
    rnd = np.random.default_rng(seed)
    stalk_m = noisy(mat(name + "_s", (0.55, 0.5, 0.18), rough=0.55), 80, 0.3, 0.1, 0.05)
    grain = prim("uv_sphere", name + "_g", noisy(mat(name + "_gm", (0.82, 0.62, 0.22), rough=0.5), 300, 0.25, 0.1, 0.3), radius=0.0035, segments=8, ring_count=5)
    grain.scale = (1, 0.55, 0.55); bpy.ops.object.transform_apply(scale=True)
    G = []; R = []
    for i in range(n):
        a = rnd.random() * 6.28; r = rnd.uniform(0, 0.06); h = rnd.uniform(0.55, 0.8)
        b = Vector(base) + Vector((r * math.cos(a), r * math.sin(a), 0))
        lean = Vector((math.cos(a), math.sin(a), 0)) * rnd.uniform(0.08, 0.2)
        pts = [b, b + Vector((0, 0, h * 0.5)) + lean * 0.3, b + Vector((0, 0, h)) + lean, b + Vector((0, 0, h * 0.9)) + lean * 1.8]
        curve_tube(name + "%d" % i, [(*p, 1.0 - 0.5 * k / 3) for k, p in enumerate(pts)], 0.0018, stalk_m)
        for k in range(26):  # panicle: grains along the drooping tip
            t = k / 25; p = pts[2].lerp(pts[3], t) + Vector(rnd.normal(0, 0.008, 3)) + Vector((0, 0, -0.06 * t * t))
            G.append(tuple(p)); R.append(rnd.random(3) * 6.28)
    instance_points(name + "_grains", grain, np.array(G), np.array(R))


# ------------------------------------------------------------------ 7 Rama: the bow, the arrow, golden Lanka
def shikhara(name, h, m_gold, m_stone):
    prof = smooth_profile([(0.5, 0), (0.48, 0.15), (0.42, 0.4), (0.33, 0.62), (0.2, 0.8), (0.24, 0.84), (0.12, 0.9), (0.06, 1.0), (0.0, 1.08)], 4)
    o = lathe(name, [(r * h * 0.45, z * h) for r, z in prof], 16, m_gold, close_bottom=True)
    bands = o.modifiers.new("w", "WAVE"); bands.height = 0.0
    return o


def set_ramayana(sc, A):
    world(sky=[(0.0, (0.55, 0.18, 0.06)), (0.2, (0.3, 0.08, 0.08)), (1.0, (0.01, 0.01, 0.03))], strength=1.0)
    hdri_sky("belfast_sunset_puresky", 0.7, 4.2)
    bpy.ops.mesh.primitive_plane_add(size=2); sea = bpy.context.object
    oc = sea.modifiers.new("ocean", "OCEAN"); oc.size = 1.0; oc.spatial_size = 50; oc.resolution = 16; oc.wave_scale = 0.7; oc.choppiness = 1.3
    oc.geometry_mode = "GENERATE"; oc.repeat_x = oc.repeat_y = 8
    sea.data.materials.append(mat("sea", (0.004, 0.006, 0.009), rough=0.08, ior=1.33))
    # Lanka: a cliff island with a golden city
    gold_m = gold("lanka_gold"); stone = noisy(mat("lstone", (0.25, 0.2, 0.16), rough=0.8), 30, 0.4, 0.1, 0.4)
    cliff, cms = import_ph("coastal_cliff_01", (35, 330, -3), A.get("cliff_scale", 3.5), (0, 0, 2.2))
    top = 12.0
    if cliff is None:
        isle = prim("cone", "lanka", stone, radius1=40, radius2=10, depth=18, location=(35, 330, 0), vertices=48); isle.scale = (2.0, 0.6, 1)
    else:
        bpy.context.view_layer.update()
        zs = [(o.matrix_world @ Vector(c)).z for o in cms for c in o.bound_box]; top = max(zs) - 1.0
        for o in cms:
            for s_ in o.data.materials: s_.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.1, 0.08, 0.06, 1) if not s_.node_tree.nodes["Principled BSDF"].inputs["Base Color"].links else s_.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value
    rnd = np.random.default_rng(9); city_lights = []
    win = emission("lwin", (1.0, 0.55, 0.15), 4)
    for i in range(26):
        x = 35 + rnd.normal(0, 9); y = 330 + rnd.normal(0, 3); h = rnd.uniform(10, 26) * (1.5 if abs(x - 35) < 6 else 1.0)
        z = top + rnd.uniform(-1.5, 0.5)
        s = shikhara("tower%d" % i, h, gold_m, stone); s.location = (x, y, z)
        w = prim("cube", "w%d" % i, win, size=1, location=(x, y - h * 0.22, z + h * 0.3)); w.scale = (h * 0.06, 0.2, h * 0.09)
    fire = light("POINT", (35, 318, top + 12), 0, (1.0, 0.45, 0.12), size=6)
    burst = prim("uv_sphere", "burst", emission("burstm", (1.0, 0.7, 0.35), 0), radius=5, location=(35, 322, top + 10))
    # the bow: a lacquered recurve limb, a red-wrapped grip, gold nocks, a string drawn to the cheek
    lac = pbr("lacquered_cherry_wood", noisy(mat("bowwood", (0.12, 0.03, 0.015), rough=0.25, coat=0.8), 50, 0.3, 0.1, 0.1), 4.0)
    pts = []
    for s in np.linspace(-1, 1, 15):
        y = 0.95 * s; x = 0.22 * (1 - s * s) - 0.08 * max(0, abs(s) - 0.8) / 0.2 * (1 if True else 0)
        pts.append((x, 0, y, 1.0 - 0.55 * abs(s) ** 1.5))
    bow = curve_tube("bow", pts, 0.022, lac)
    grip = []
    for k in range(9):
        g = prim("torus", "grip%d" % k, mat("gripm", (0.5, 0.02, 0.02), rough=0.7), major_radius=0.024, minor_radius=0.0045, location=(0.22, 0, -0.08 + k * 0.02), rotation=(math.pi / 2, 0, 0))
        grip.append(g)
    nocks = [prim("uv_sphere", "nock%d" % k, gold("nockg"), radius=0.018, location=(pts[0 if k == 0 else -1][0], 0, pts[0 if k == 0 else -1][2])) for k in (0, 1)]
    string = curve_tube("string", [(pts[0][0], 0, pts[0][2]), (-0.32, 0, 0.0), (pts[-1][0], 0, pts[-1][2])], 0.0022, mat("str", (0.85, 0.8, 0.65), rough=0.5))
    string.data.splines[0].type = "POLY"
    arrow = bpy.data.objects.new("arrow", None); link(arrow)
    shaft = prim("cylinder", "shaft", noisy(mat("shaftm", (0.5, 0.36, 0.2), rough=0.5), 80, 0.3, 0.1, 0.1), radius=0.006, depth=1.0, location=(0.2, 0, 0), rotation=(0, math.pi / 2, 0)); shaft.parent = arrow
    head = prim("cone", "head", gold("headg"), radius1=0.02, radius2=0.0, depth=0.08, location=(0.74, 0, 0), rotation=(0, math.pi / 2, 0)); head.scale = (1, 0.35, 1); head.parent = arrow
    glow_m = emission("tipglow", (1.0, 0.75, 0.4), 0); tip = prim("uv_sphere", "tip", glow_m, radius=0.02, location=(0.78, 0, 0)); tip.parent = arrow
    for k in range(3):
        a = k * 2 * math.pi / 3
        f = mesh_obj("fletch%d" % k, [(-0.28, 0, 0), (-0.14, 0, 0), (-0.17, 0.035 * math.cos(a), 0.035 * math.sin(a)), (-0.3, 0.03 * math.cos(a), 0.03 * math.sin(a))], [(0, 1, 2, 3)],
                     mat("feather", (0.92, 0.9, 0.85), rough=0.8, sss=0.2), smooth=False)
        f.parent = arrow
    rig = bpy.data.objects.new("bowrig", None); link(rig); rig.location = (0.55, 1.4, 1.55); rig.rotation_euler = (0, 0, math.pi / 2 + 0.05)
    for o in (bow, string, *grip, *nocks): o.parent = rig
    trail = prim("cylinder", "trail", emission("trailm", (1.0, 0.6, 0.2), 25), radius=0.03, depth=1.0, vertices=12)
    light("AREA", (2.5, 0.5, 2.5), 60, (1.0, 0.6, 0.35), size=2, look=(0.55, 1.4, 1.5))
    glare(sc, 1.0, 8, -0.45)
    cam = camera((0.15, -0.6, 1.5), (20, 330, 10), 40, dof=2.1, fstop=2.8)
    release = A.get("release", 0.3)
    target = Vector((35, 322, top + 10))

    def update(t, dur):
        u = t / dur
        oc.time = t * 0.6
        drawn = 1 - ease((u - release) / 0.03) if u > release else ease(u / (release * 0.6))
        string.data.splines[0].points[1].co = (-0.05 - 0.27 * drawn, 0, 0.0, 1)
        start = rig.matrix_world @ Vector((-0.05 - 0.27 * drawn, 0, 0))
        if u <= release:
            arrow.location = start + Vector((0, 0.3, 0)); arrow.rotation_euler = Vector((0, 1, 0.0)).to_track_quat("X", "Z").to_euler()
            glow_m.node_tree.nodes["Emission"].inputs[1].default_value = 30 * drawn
            trail.hide_render = True
        else:
            k = min(1.0, ((u - release) / 0.3) ** 1.3)
            p = start.lerp(target, k) + Vector((0, 0, 25 * math.sin(math.pi * k) * 0.4))
            nxt = start.lerp(target, min(1, k + 0.01)) + Vector((0, 0, 25 * math.sin(math.pi * min(1, k + 0.01)) * 0.4))
            arrow.location = p; d = (nxt - p).normalized() if (nxt - p).length > 1e-6 else Vector((0, 1, 0))
            arrow.rotation_euler = d.to_track_quat("X", "Z").to_euler(); arrow.scale = (1 + 20 * k,) * 3
            glow_m.node_tree.nodes["Emission"].inputs[1].default_value = 120
            L = min(60.0, 5 + 120 * k); trail.hide_render = k >= 1
            trail.scale = (1 + 10 * k, 1 + 10 * k, L); trail.location = p - d * (L / 2); trail.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        B = rig.location
        if u <= release:   # side close-up of the drawn bow, Lanka soft behind
            aim(cam, B + Vector((-1.45, -0.55, 0.05 + 0.04 * u)), B + Vector((0.0, 0.3, 0.02))); cam.data.lens = 35
            cam.data.dof.focus_distance = 1.5; cam.data.dof.aperture_fstop = 2.2
        else:              # over the shoulder: the arrow's line to Lanka
            aim(cam, (0.15, -0.6, 1.5), (20, 330, 10)); cam.data.lens = 40; cam.data.dof.focus_distance = 60; cam.data.dof.aperture_fstop = 5.6
        hit = (u - (release + 0.3)) * dur
        fire.data.energy = 0 if hit < 0 else 4e6 * math.exp(-hit * 1.5) + 6e5
        burst.data.materials[0].node_tree.nodes["Emission"].inputs[1].default_value = 0 if hit < 0 else 60 * math.exp(-hit * 2.5)
        burst.scale = (1 + 1.5 * max(0, hit),) * 3; burst.hide_render = hit < 0 or hit > 0.5
        arrow.hide_render = hit > 0
    return update


# ------------------------------------------------------------------ 13 Fulpati: the doli, the nine plants, the salute
def set_fulpati2(sc, A):
    world(sky=[(0.0, (0.55, 0.25, 0.12)), (0.22, (0.22, 0.1, 0.1)), (1.0, (0.02, 0.02, 0.04))], strength=0.9)
    hdri_light("kiara_9_dusk", 0.6)
    ground = prim("plane", "tundikhel", pbr("aerial_grass_rock", noisy(mat("grass", (0.05, 0.08, 0.02), rough=0.9), 2, 0.5, 0.05, 0.3), 0.15, (0.6, 0.6, 0.5)), size=300)
    wood = pbr("dark_wood", noisy(mat("dw", (0.07, 0.03, 0.015), rough=0.4, coat=0.5), 40, 0.3, 0.1, 0.2), 3.0)
    g = gold("doli_gold"); red = pbr("fabric_pattern_07", noisy(mat("redv", (0.45, 0.01, 0.02), rough=0.8, sss=0.05), 120, 0.3, 0.1, 0.4), 6.0, (0.9, 0.08, 0.08))
    root = bpy.data.objects.new("doli", None); link(root)
    def add(o): o.parent = root; return o
    base = add(prim("cube", "base", wood, size=1, location=(0, 0, 0.62))); base.scale = (1.3, 0.9, 0.12); bevel(base, 0.02, 3)
    trim = add(prim("cube", "trim", g, size=1, location=(0, 0, 0.69))); trim.scale = (1.34, 0.94, 0.03); bevel(trim, 0.01, 2)
    skirt = add(prim("cube", "skirt", red, size=1, location=(0, 0, 0.46))); skirt.scale = (1.28, 0.88, 0.3)
    for y in (-0.36, 0.36):
        add(prim("cylinder", "pole", wood, radius=0.035, depth=4.2, location=(0, y, 0.55), rotation=(0, math.pi / 2, 0), vertices=24))
        for x in (-2.1, 2.1): add(prim("uv_sphere", "polecap", g, radius=0.05, location=(x, y, 0.55)))
    post_prof = smooth_profile([(0.04, 0), (0.05, 0.05), (0.03, 0.12), (0.035, 0.4), (0.05, 0.45), (0.03, 0.5), (0.03, 0.95), (0.05, 1.0), (0.035, 1.05)], 3)
    for x in (-0.6, 0.6):
        for y in (-0.4, 0.4):
            p = add(lathe("post", post_prof, 24, g)); p.location = (x, y, 0.71); p.scale = (1, 1, 1.6)
    # tiered canopy: two flared pyramids (lathe, 4 segments) with gilt finish, and a gajur
    for k, (s, z) in enumerate(((1.0, 2.38), (0.66, 2.66), (0.4, 2.88))):
        prof = [(0.0, 0.32 * s), (0.25 * s, 0.25 * s), (0.6 * s, 0.1 * s), (0.88 * s, 0.0), (0.92 * s, -0.04 * s)]
        r = add(lathe("roof%d" % k, prof, 4, g)); r.location = (0, 0, z); r.rotation_euler = (0, 0, math.pi / 4); r.scale = (1.2, 0.85, 1)
    gaj = add(lathe("gajur", smooth_profile([(0.08, 0), (0.09, 0.05), (0.05, 0.12), (0.07, 0.17), (0.03, 0.26), (0.0, 0.36)], 4), 32, g, close_bottom=True)); gaj.location = (0, 0, 3.0)
    for x in (-0.6, 0.6):  # drapes tied back at the four posts
        for y in (-0.4, 0.4):
            V = []; Fc = []; cols, rows = 6, 12
            for i in range(rows + 1):
                for j in range(cols + 1):
                    s_ = j / cols; z = 2.36 - 1.5 * i / rows; pinch = 0.25 + 0.75 * abs(i / rows - 0.45) * 1.6
                    V.append((x - math.copysign(0.22 * s_ * pinch, x), y + 0.03 * math.sin(j * 2.3 + i * 0.3), z))
            for i in range(rows):
                for j in range(cols):
                    q = i * (cols + 1) + j; Fc.append((q, q + 1, q + cols + 2, q + cols + 1))
            d = add(mesh_obj("drape", V, Fc, red)); solidify(d, 0.004)
    for edge in range(4):
        for i in range(14):
            t = i / 13
            x, y = [(-0.62 + 1.24 * t, -0.46), (0.62, -0.46 + 0.92 * t), (0.62 - 1.24 * t, 0.46), (-0.62, 0.46 - 0.92 * t)][edge]
            add(marigold("mg%d_%d" % (edge, i), (x, y, 2.32 - 0.12 * math.sin(math.pi * t)), 0.035))
    # the navapatrika: nine plants bundled upright on the doli
    banana = leaf_mat("banana", (0.1, 0.32, 0.06)); colo = leaf_mat("colocasia", (0.06, 0.25, 0.08)); turm = leaf_mat("turmeric", (0.14, 0.38, 0.08))
    ashoka = leaf_mat("ashoka", (0.03, 0.16, 0.04)); jayanti = leaf_mat("jayanti", (0.12, 0.3, 0.07))
    rnd = np.random.default_rng(7); bundle = Vector((0.05, 0.0, 0.69))
    def plant(o, yaw, tilt, z0=0.0):
        o.location = bundle + Vector((0.03 * math.cos(yaw), 0.03 * math.sin(yaw), z0)); o.rotation_euler = (0, -math.pi / 2 + tilt, yaw); add(o)
    for k in range(3): plant(leaf_mesh("banana%d" % k, 1.25, 0.2, banana, 22, 0.15, 0.55, tears=0.35, seed=k, shape="banana"), k * 2.1 + 0.3, 0.32)
    for k in range(2): plant(leaf_mesh("colo%d" % k, 0.42, 0.2, colo, 14, 0.1, 0.25, shape="heart", petiole=0.55, seed=10 + k), k * 3.1 + 1.0, 0.45, 0.5)
    for k in range(4): plant(leaf_mesh("turm%d" % k, 0.6, 0.06, turm, 14, 0.2, 0.2, seed=20 + k), k * 1.6 + 0.6, 0.18 + 0.08 * k)
    for k in range(6): plant(leaf_mesh("ash%d" % k, 0.22, 0.03, ashoka, 10, 0.2, 0.1, seed=30 + k), rnd.random() * 6.28, rnd.uniform(0.3, 0.9), rnd.uniform(0.5, 0.8))
    for k in range(4): plant(leaf_mesh("jay%d" % k, 0.18, 0.025, jayanti, 10, 0.2, 0.1, seed=40 + k), rnd.random() * 6.28, rnd.uniform(0.4, 1.0), rnd.uniform(0.3, 0.6))
    paddy("paddy", tuple(bundle + Vector((0.0, 0.02, 0))), 30)
    tie = add(prim("torus", "tie", red, major_radius=0.09, minor_radius=0.025, location=tuple(bundle + Vector((0, 0, 0.18)))))
    tie2 = add(prim("torus", "tie2", mat("white", (0.9, 0.88, 0.82), rough=0.8), major_radius=0.092, minor_radius=0.012, location=tuple(bundle + Vector((0, 0, 0.24)))))
    pom, _ = import_ph("food_pomegranate_01", (0, 0, 0), 1.0)
    for k, (x, y) in enumerate([(-0.32, -0.25), (-0.2, -0.32), (0.36, -0.28)]):
        if pom is not None: add(dup_tree(pom, (x, y, 0.7), (0, 0, k)))
        else: add(prim("uv_sphere", "pom%d" % k, mat("pomm", (0.55, 0.04, 0.05), rough=0.35, coat=0.3), radius=0.045, location=(x, y, 0.74)))
    if pom is not None: pom.hide_render = True; [c.__setattr__("hide_render", True) for c in pom.children]
    bel_m = noisy(mat("bel", (0.55, 0.55, 0.2), rough=0.6), 60, 0.4, 0.1, 0.4)
    for k, (x, y) in enumerate([(0.3, 0.25), (0.42, 0.18)]): add(prim("uv_sphere", "bel%d" % k, bel_m, radius=0.05, location=(x, y, 0.75)))
    root.location = (0, 0, 0.0); root.rotation_euler = (0, 0, 0.35)
    # the salute line at Tundikhel: soldiers with rifles raised, out of focus behind
    rifle, _ = import_ph("bolt_action_rifle_7_62", (0, 0, 0), 1.0)
    olive = noisy(mat("uniform", (0.06, 0.07, 0.04), rough=0.8), 60, 0.3, 0.1, 0.3); skin = mat("skin2", (0.25, 0.14, 0.09), rough=0.6, sss=0.2)
    muzzles = []; flash_m = emission("flash", (1.0, 0.75, 0.4), 0); smoke_parts = []
    for i in range(22):
        x = -16 + i * 1.5; y = 22 + (i % 2) * 0.4
        body = prim("cylinder", "body%d" % i, olive, radius=0.2, depth=1.1, location=(x, y, 0.95), vertices=16); body.scale = (1, 0.7, 1)
        legs = prim("cylinder", "legs%d" % i, olive, radius=0.16, depth=0.9, location=(x, y, 0.45), vertices=12); legs.scale = (1, 0.6, 1)
        hd = prim("uv_sphere", "head%d" % i, skin, radius=0.12, location=(x, y, 1.62))
        cap = prim("cylinder", "cap%d" % i, olive, radius=0.13, depth=0.08, location=(x, y, 1.74), vertices=16)
        tipp = Vector((x + 0.35, y - 0.1, 2.35))
        if rifle is not None:
            r = dup_tree(rifle, (x + 0.15, y - 0.1, 1.45), (0, -0.9, math.pi / 2))
        else:
            r = prim("cylinder", "rifle%d" % i, mat("gun", (0.05, 0.04, 0.03), rough=0.4, metal=0.5), radius=0.025, depth=1.1, location=(x + 0.2, y - 0.1, 1.9), rotation=(0, 0.6, 0))
        fl = prim("cone", "mflash%d" % i, flash_m, radius1=0.12, radius2=0.0, depth=0.5, location=tuple(tipp), rotation=(0, 0.65, 0)); muzzles.append(fl)
    if rifle is not None: rifle.hide_render = True; [c.__setattr__("hide_render", True) for c in rifle.children]
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.5, 22, 2.6)); sm = bpy.context.object; sm.scale = (36, 3, 1.6)
    smm = bpy.data.materials.new("smoke"); smm.use_nodes = True; nt = smm.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); vp = nt.nodes.new("ShaderNodeVolumePrincipled")
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.noise_dimensions = "4D"; nz.inputs["Scale"].default_value = 1.2
    cr = nt.nodes.new("ShaderNodeMapRange"); cr.inputs[1].default_value = 0.5; cr.inputs[2].default_value = 0.75; cr.inputs[4].default_value = 0.0
    nt.links.new(nz.outputs["Fac"], cr.inputs[0]); nt.links.new(cr.outputs[0], vp.inputs["Density"]); vp.inputs["Color"].default_value = (0.8, 0.78, 0.75, 1)
    nt.links.new(vp.outputs[0], out.inputs["Volume"]); sm.data.materials.append(smm); sm.visible_shadow = False
    smoke_amt = cr.inputs[4]
    salute = light("AREA", (0, 21, 3.0), 0, (1.0, 0.7, 0.4), size=30, look=(0, 0, 1))
    key = light("AREA", (2.2, -2.4, 2.4), 220, (1, 0.72, 0.5), size=1.5, look=(0, 0, 1.2))
    rim = light("AREA", (-1.8, 2.0, 2.2), 140, (1, 0.5, 0.25), size=1.2, look=(0, 0, 1.2))
    glare(sc, 1.0, 8, -0.5)
    cam = camera((2.7, -4.6, 1.3), (0.0, 0.0, 1.45), 40, dof=5.3, fstop=2.8)
    shots = A.get("volleys", [0.55, 0.68, 0.81])

    def update(t, dur):
        u = t / dur; e = 0.0; since = None
        for v in shots:
            dt = (u - v) * dur
            if 0 <= dt < 0.25: e = max(e, 1 - dt / 0.25)
            if dt >= 0: since = dt
        flash_m.node_tree.nodes["Emission"].inputs[1].default_value = 120 * e
        salute.data.energy = 9000 * e
        smoke_amt.default_value = 0.0 if since is None else min(1.2, 0.6 + 0.3 * len([v for v in shots if u >= v]))
        nz.inputs["W"].default_value = t * 0.2
        aim(cam, lerp((2.7, -4.6, 1.3), (2.0, -3.9, 1.4), ease(u)), (0.0, 0.0, 1.45))
    return update
