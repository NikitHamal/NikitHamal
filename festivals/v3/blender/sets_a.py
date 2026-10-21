"""Sets for the open and the myth: lamp room, manuscript, Mahishasura, the gods' light + trishul, the moon, Rama's arrow.
Each set builder returns update(t, d) where t is seconds into the shot and d the shot length."""
import math
import bpy
import numpy as np
from mathutils import Vector
from lib import *
from lib import _set, _ramp


# ------------------------------------------------------------------ 1/2 lamp room
def set_lamp_room(sc, A, variant="open"):
    world(INK, 0)
    floor = prim("plane", "floor", noisy(mat("floor", (0.09, 0.045, 0.03), rough=0.75), 6, 0.5, 0.15, 0.3), size=8)
    wall = prim("plane", "wall", noisy(mat("wall", (0.16, 0.06, 0.035), rough=0.9), 3, 0.6, 0.05, 0.6), size=8, location=(0, 0.9, 2), rotation=(math.pi / 2, 0, 0))
    k = kalash("kalash", (0.16, 0.32, 0), 1.25)
    d, fl, li = diyo("diyo", (-0.02, 0, 0), 1.5, 70, 10)
    for i, (x, y) in enumerate([(-0.18, 0.12), (-0.24, 0.2), (0.32, 0.12), (0.05, -0.12)]):
        marigold("mg%d" % i, (x, y, 0.025), 0.028)
    fill = light("AREA", (-1.2, -1.0, 1.4), 6, (1.0, 0.6, 0.35), size=1.5, look=(0, 0, 0.1))
    haze, hv = volume_world(0.08, (1, 0.85, 0.7), 0.55)
    rnd = np.random.default_rng(7)
    dust_src = prim("ico_sphere", "dust", mat("dust", (1, 0.9, 0.8), rough=1.0), subdivisions=1, radius=0.0012)
    P = np.stack([rnd.uniform(-0.6, 0.6, 400), rnd.uniform(-0.4, 0.6, 400), rnd.uniform(0.0, 0.8, 400)], 1)
    dust = instance_points("dustp", dust_src, P)
    glare(sc, 1.0, 8, -0.55)
    if variant == "open":
        cam = camera((0.35, -1.25, 0.32), (0.05, 0.1, 0.12), 65, dof=1.2, fstop=1.8)
    else:
        cam = camera((0.1, -0.5, 0.12), (0.06, 0, 0.07), 85, dof=0.5, fstop=1.4)
    strike = A.get("strike", 1.0)

    def update(t, dur):
        u = t / dur
        if variant == "open":
            ig = ease_out((t - strike) / 0.6) if t > strike else 0.0
            flick = flicker(t)
            fl.scale = (0.75 * ig * (1 + 0.25 * math.sin(t * 9)), 0.75 * ig, 2.2 * ig * flick)
            li.data.energy = 15 * ig * flick
            fill.data.energy = 6 * ease(u * 1.6) * ig
            hv.inputs["Density"].default_value = 0.06 + 0.03 * ig
            aim(cam, lerp((0.35, -1.25, 0.32), (0.22, -0.78, 0.22), ease(u)), (0.05, 0.12, 0.12))
            cam.data.dof.focus_distance = (Vector(cam.location) - Vector((0.04, 0, 0.06))).length
        else:  # title: the flame fills the frame and grows
            flick = flicker(t, 3)
            fl.scale = (0.75 * (1 + 0.2 * math.sin(t * 9)), 0.75, 2.2 * flick)
            li.data.energy = 15 * flick
            aim(cam, lerp((0.1, -0.5, 0.12), (0.085, -0.22, 0.1), ease(u)), (0.065, 0, 0.075))
            cam.data.dof.focus_distance = (Vector(cam.location) - Vector((0.065, 0, 0.075))).length
        dust.location = (0.02 * math.sin(t * 0.3), 0, 0.01 * t)
    return update


# ------------------------------------------------------------------ 3 manuscript (Devi Mahatmya)
def set_manuscript(sc, A):
    world(INK, 0)
    table = prim("plane", "table", noisy(mat("wood", (0.12, 0.05, 0.02), rough=0.45, coat=0.3), 2.5, 0.6, 0.15, 0.2), size=6)
    cloth = prim("plane", "cloth", noisy(mat("redcloth", (0.35, 0.01, 0.015), rough=0.8, sss=0.05), 140, 0.4, 0.1, 0.5), size=1, location=(0, 0, 0.001))
    cloth.scale = (1.1, 0.5, 1)
    leaf_m = noisy(mat("palm", (0.62, 0.45, 0.22), rough=0.55, sss=0.08), 9, 0.3, 0.12, 0.15)
    leaves = []
    for i in range(9):  # the stack
        lf = prim("cube", "folio%d" % i, leaf_m, size=1, location=(0, 0, 0.004 + 0.0028 * i))
        lf.scale = (0.56, 0.062, 0.0012); bevel(lf, 0.001, 2)
        lf.rotation_euler = (0, 0, (i % 3 - 1) * 0.006)
        leaves.append(lf)
    top = text_plane("verse", A["tex"]["verse"], 0.54, (0, -0.0005, 0.0273), (0, 0, 0))
    top.scale = (0.54, 0.056, 1)
    for nm, x in (("coverL", 0), ):
        cv = prim("cube", "cover", noisy(mat("cover", (0.2, 0.07, 0.02), rough=0.5), 30, 0.4, 0.1, 0.4), size=1, location=(0.0, 0.11, 0.008))
        cv.scale = (0.58, 0.07, 0.012); bevel(cv, 0.003, 3)
    cord = curve_tube("cord", [(-0.12, -0.03, 0.033), (-0.12, -0.12, 0.012), (-0.05, -0.2, 0.002), (0.1, -0.24, 0.002)], 0.0025, mat("cordm", (0.55, 0.05, 0.03), rough=0.7))
    d, fl, li = diyo("diyo", (0.34, 0.16, 0), 1.0, 60, 6)
    key = light("SPOT", (0.6, -0.4, 0.5), 30, (1, 0.62, 0.32), size=0.15, look=(0, 0, 0.03), spot=0.9)
    rim = light("AREA", (-0.7, 0.6, 0.35), 4, (0.6, 0.35, 0.25), size=0.6, look=(0, 0, 0.03))
    volume_world(0.05, (1, 0.85, 0.7), 0.5)
    glare(sc, 1.1, 7, -0.6)
    cam = camera((-0.32, -0.2, 0.13), (-0.12, 0, 0.03), 70, dof=0.3, fstop=1.6)

    def update(t, dur):
        u = ease(t / dur)
        f = flicker(t); fl.scale = (0.75, 0.75, 2.2 * f); li.data.energy = 6 * f; key.data.energy = 30 * (0.9 + 0.1 * f)
        p = lerp((-0.32, -0.2, 0.13), (0.18, -0.17, 0.095), u)
        tgt = lerp((-0.16, 0, 0.031), (0.12, 0, 0.031), u)
        aim(cam, p, tgt); cam.data.dof.focus_distance = (Vector(p) - Vector(tgt)).length
    return update


# ------------------------------------------------------------------ 4 Mahishasura
def _horn(name, side, m, segs=1):
    pts = []
    for i in range(14):
        s = i / 13.0
        x = side * (0.18 + 0.75 * s - 0.2 * s * s)
        z = 0.05 + 0.22 * s + 0.35 * s ** 2.2
        y = -0.12 * s + 0.25 * s ** 3
        pts.append((x, y, z, (1 - s) ** 0.9 + 0.02))
    return curve_tube(name, pts, 0.085, m), pts


def set_demon(sc, A, variant="rise"):
    world((0.002, 0.0, 0.0), 0)
    sc.render.use_motion_blur = False
    hm = noisy(mat("hide", (0.012, 0.009, 0.008), rough=0.6, sss=0.02), 25, 0.5, 0.2, 0.6)
    mb = bpy.data.metaballs.new("head"); mb.resolution = mb.render_resolution = 0.03
    head = link(bpy.data.objects.new("head", mb)); mb.materials.append(hm)
    for (x, y, z, r) in [(0, 0, 0, 0.42), (0, -0.25, -0.18, 0.3), (0, -0.42, -0.32, 0.22), (0.22, 0.05, 0.05, 0.25), (-0.22, 0.05, 0.05, 0.25),
                         (0, 0.25, -0.35, 0.45), (0, 0.4, -0.75, 0.6)]:
        e = mb.elements.new(); e.co = (x, y, z); e.radius = r
    horn_m = noisy(mat("horn", (0.05, 0.04, 0.035), rough=0.35, coat=0.4), 40, 0.4, 0.15, 0.4)
    horns = [_horn("hornR", 1, horn_m)[0], _horn("hornL", -1, horn_m)[0]]
    eye_m = emission("ember", (1.0, 0.22, 0.03), 0.0)
    eyes = [prim("uv_sphere", "eye%d" % i, eye_m, radius=0.04, location=(s * 0.16, -0.37, 0.03)) for i, s in enumerate((1, -1))]
    for e in eyes: e.scale = (1.3, 0.6, 0.7)
    # cracked ground glowing from below
    g = prim("plane", "ground", None, size=14, location=(0, 0, -1.05))
    gm = bpy.data.materials.new("cracks"); gm.use_nodes = True; nt = gm.node_tree; p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (0.02, 0.015, 0.012, 1); p.inputs["Roughness"].default_value = 0.9
    vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.feature = "DISTANCE_TO_EDGE"; vor.inputs["Scale"].default_value = 3.0
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs[1].default_value = 0.0; mr.inputs[2].default_value = 0.035; mr.inputs[3].default_value = 1; mr.inputs[4].default_value = 0
    nt.links.new(vor.outputs["Distance"], mr.inputs[0])
    _set(p, ["Emission Color"], (1.0, 0.18, 0.02, 1))
    mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = 0.0
    nt.links.new(mr.outputs[0], mul.inputs[0]); nt.links.new(mul.outputs[0], p.inputs["Emission Strength"])
    g.data.materials.append(gm)
    crack_gain = mul.inputs[1]
    # smoke: a volume box with animated 4D noise density
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.6, -0.4)); sm = bpy.context.object; sm.scale = (5, 3, 2.4)
    smm = bpy.data.materials.new("smoke"); smm.use_nodes = True; nt = smm.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); vp = nt.nodes.new("ShaderNodeVolumePrincipled")
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.noise_dimensions = "4D"; nz.inputs["Scale"].default_value = 1.6; nz.inputs["Detail"].default_value = 6
    cr = nt.nodes.new("ShaderNodeMapRange"); cr.inputs[1].default_value = 0.48; cr.inputs[2].default_value = 0.75; cr.inputs[4].default_value = 2.5
    nt.links.new(nz.outputs["Fac"], cr.inputs[0]); nt.links.new(cr.outputs[0], vp.inputs["Density"])
    vp.inputs["Color"].default_value = (0.5, 0.45, 0.42, 1)
    nt.links.new(vp.outputs[0], out.inputs["Volume"]); sm.data.materials.append(smm); sm.visible_shadow = False
    smoke_w = nz.inputs["W"]
    rim = light("SPOT", (0, 2.2, 0.9), 900, (1.0, 0.16, 0.03), size=0.4, look=(0, 0, 0), spot=1.2)
    under = light("POINT", (0, -0.9, -0.95), 60, (1.0, 0.3, 0.05), size=0.3)
    top = light("AREA", (0.6, -1.4, 1.6), 25, (0.6, 0.6, 0.75), size=1.0, look=(0, 0, 0))
    glare(sc, 0.9, 8, -0.45)
    cam = camera((0, -3.2, -0.85), (0, 0, 0.05), 50, dof=3.0, fstop=2.8)
    root = bpy.data.objects.new("demon", None); link(root)
    for o in [head, *horns, *eyes]: o.parent = root

    def update(t, dur):
        u = t / dur
        smoke_w.default_value = t * 0.15
        if variant == "rise":
            root.location = (0, 0, lerp(-0.9, 0.0, ease(u * 1.3)))
            eye_m.node_tree.nodes["Emission"].inputs[1].default_value = 60 * ease((u - 0.45) / 0.15)
            crack_gain.default_value = 8 * ease((u - 0.2) / 0.5)
            aim(cam, lerp((0, -3.4, -0.9), (0.25, -2.6, -0.55), ease(u)), (0, 0, lerp(-0.2, 0.15, ease(u))))
        else:
            root.location = (0, 0, 0)
            eye_m.node_tree.nodes["Emission"].inputs[1].default_value = 60
            crack_gain.default_value = 8
        rim.data.energy = 900 * (0.9 + 0.1 * math.sin(t * 2.1))
    update.root = root; update.horns = horns; update.cam = cam
    return update


# ------------------------------------------------------------------ 5 the gods' light -> trishul
def trishul(name="trishul", m=None):
    m = m or gold()
    root = bpy.data.objects.new(name, None); link(root)
    shaft = prim("cylinder", name + "_shaft", m, radius=0.018, depth=2.2, location=(0, 0, -0.9), vertices=48); shaft.parent = root
    for z in (-0.05, 0.0, 0.18):
        ring = prim("torus", name + "_ring", m, major_radius=0.026, minor_radius=0.008, location=(0, 0, z)); ring.parent = root
    # centre blade: lathe-like diamond spear
    blade = []
    for i in range(12):
        s = i / 11.0; w = 0.06 * math.sin(math.pi * min(1, s * 1.25)) * (1 - s) ** 0.3
        blade.append((0, 0, 0.2 + 0.55 * s, w + 0.002))
    c = curve_tube(name + "_c", blade, 1.0, m); c.data.bevel_depth = 1.0; c.parent = root
    c.scale = (1, 0.35, 1)
    for side in (1, -1):
        pts = []
        for i in range(12):
            s = i / 11.0
            x = side * (0.03 + 0.2 * math.sin(s * 1.7) - 0.02 * s)
            z = 0.2 + 0.08 * s + 0.36 * s ** 2.3
            pts.append((x, 0, z, (0.045 * (1 - s) ** 0.8 + 0.002)))
        p = curve_tube(name + "_p%d" % side, pts, 1.0, m); p.data.bevel_depth = 1.0; p.parent = root
        p.scale = (1, 0.5, 1)
    cross = prim("cylinder", name + "_x", m, radius=0.022, depth=0.3, location=(0, 0, 0.2), rotation=(0, math.pi / 2, 0)); cross.parent = root
    # a small damaru below the prongs, and a red ribbon
    dm = lathe(name + "_damaru", [(0.04, -0.035), (0.012, 0.0), (0.04, 0.035)], 48, mat("damaru", (0.35, 0.08, 0.03), rough=0.5), True, True)
    dm.parent = root; dm.location = (0, 0, 0.05); dm.rotation_euler = (0, math.pi / 2, 0)
    rb = curve_tube(name + "_ribbon", [(0.02, 0, 0.1), (0.08, -0.02, 0.0), (0.06, 0.02, -0.15), (0.1, 0, -0.3)], 0.006, mat("ribbon", TIKA, rough=0.6))
    rb.data.extrude = 0.01; rb.parent = root
    return root


def set_tejas(sc, A):
    world(INK, 0)
    beam_m = emission("beam", (1.0, 0.8, 0.55), 30)
    beams = []
    rnd = np.random.default_rng(11)
    dirs = []
    for i in range(10):
        a = 2 * math.pi * i / 10 + rnd.uniform(-0.15, 0.15); el = rnd.uniform(-0.5, 0.9)
        d = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el) * 0.6 + 0.4, math.sin(el))).normalized()
        dirs.append(d)
        b = prim("cylinder", "beam%d" % i, beam_m, radius=0.006, depth=1.0, vertices=12)
        beams.append(b)
    core = prim("uv_sphere", "bindu", emission("bindu", (1, 0.1, 0.05), 0), radius=0.05)
    tr = trishul(); tr.location = (0, 0, -0.35); tr.scale = (0.001,) * 3
    key = light("AREA", (1.2, -1.5, 1.0), 0, (1, 0.8, 0.6), size=1.2, look=(0, 0, 0.2))
    rim = light("AREA", (-1.0, 1.4, 0.6), 0, (1, 0.3, 0.12), size=1.2, look=(0, 0, 0.2))
    volume_world(0.03, (1, 0.9, 0.8), 0.3)
    glare(sc, 0.8, 9, -0.35)
    cam = camera((0, -3.0, 0.15), (0, 0, 0.1), 60, dof=3.0, fstop=4)
    conv = A.get("converge", 0.42)

    def update(t, dur):
        u = t / dur
        k = ease(u / conv)  # beams travel in and shorten into the point
        for b, d in zip(beams, dirs):
            far = 6.0 * (1 - k) + 0.05; L = max(0.02, 4.0 * (1 - k) + 0.05)
            mid = d * (far + L / 2)
            b.location = mid
            b.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
            b.scale = (1, 1, L)
            b.hide_render = k >= 0.999
        bloom = ease((u - conv) / 0.08) * (1 - ease((u - conv - 0.12) / 0.25))
        core.data.materials[0].node_tree.nodes["Emission"].inputs[1].default_value = 200 * bloom + 40 * ease((u - conv * 0.6) / 0.3) * (1 - ease((u - conv - 0.05) / 0.2))
        core.scale = (1 + 3 * bloom,) * 3
        g = ease((u - conv - 0.02) / 0.3)
        tr.scale = (max(0.001, g),) * 3
        tr.location = (0, 0, -0.35 + 0.15 * g)
        tr.rotation_euler = (0, 0, (1 - g) * 2.5 + 0.15 * math.sin(t * 0.4))
        key.data.energy = 400 * g; rim.data.energy = 600 * g
        aim(cam, lerp((0, -3.0, 0.15), (0.35, -1.9, 0.35), ease(u)), (0, 0, lerp(0.05, 0.3, g)))
    return update


# ------------------------------------------------------------------ 6 nine nights; the tenth day
def set_moon(sc, A):
    world((0.0015, 0.002, 0.006), 1)
    mm = bpy.data.materials.new("moon"); mm.use_nodes = True; nt = mm.node_tree; p = nt.nodes["Principled BSDF"]
    p.inputs["Roughness"].default_value = 1.0
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 3.0; nz.inputs["Detail"].default_value = 10
    vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 9.0
    cr = nt.nodes.new("ShaderNodeValToRGB"); _ramp(cr, [(0.25, (0.25, 0.24, 0.23)), (0.6, (0.72, 0.7, 0.66))])
    nt.links.new(nz.outputs["Fac"], cr.inputs[0]); nt.links.new(cr.outputs[0], p.inputs["Base Color"])
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.35
    nt.links.new(vor.outputs["Distance"], bp.inputs["Height"]); nt.links.new(bp.outputs[0], p.inputs["Normal"])
    moon = prim("uv_sphere", "moon", mm, radius=1.0, segments=128, ring_count=64, location=(0, 12, 2.2))
    for f in moon.data.polygons: f.use_smooth = True
    sun = light("SUN", (0, 0, 0), 6, (1, 0.97, 0.92), size=0.01)
    stars_src = prim("ico_sphere", "star", emission("starm", (1, 1, 1), 6), subdivisions=1, radius=0.012)
    rnd = np.random.default_rng(5)
    S = np.stack([rnd.uniform(-14, 14, 700), np.full(700, 20.0) + rnd.uniform(0, 6, 700), rnd.uniform(-8, 22, 700)], 1)
    instance_points("stars", stars_src, S, None, rnd.uniform(0.3, 1.4, 700))
    # Mahishasura's horns as shards: many short pieces that start assembled and scatter on the tenth day
    horn_m = noisy(mat("horn", (0.03, 0.025, 0.02), rough=0.35, coat=0.4), 40, 0.4, 0.15, 0.4)
    shards = []
    for side in (1, -1):
        prev = None
        for i in range(26):
            s0, s1 = i / 26, (i + 1) / 26
            def P(s):
                return Vector((side * (0.18 + 0.75 * s - 0.2 * s * s), -0.12 * s + 0.25 * s ** 3, 0.05 + 0.22 * s + 0.35 * s ** 2.2))
            a, b = P(s0), P(s1); r = 0.085 * ((1 - s0) ** 0.9 + 0.02)
            c = prim("cylinder", "shard", horn_m, radius=r, depth=(b - a).length * 1.05, vertices=16, location=(a + b) / 2)
            c.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
            shards.append((c, Vector(c.location), c.rotation_euler.copy(), Vector((rnd.normal(side * 0.8, 0.5), rnd.normal(-0.6, 0.5), rnd.normal(1.0, 0.7))), Vector(rnd.normal(0, 4, 3))))
    hroot = bpy.data.objects.new("horns", None); link(hroot); hroot.location = (0, 3.0, -0.4); hroot.scale = (1.8,) * 3
    for c, *_ in shards: c.parent = hroot
    rim = light("SPOT", (0, 8, 1.6), 300, (1, 0.25, 0.08), size=0.4, look=(0, 3, 0), spot=0.9)
    glare(sc, 1.0, 8, -0.5)
    cam = camera((0, -2.2, -0.2), (0, 12, 2.0), 45, dof=6, fstop=5.6)
    shatter = A.get("shatter", 0.72)

    def update(t, dur):
        u = t / dur
        night = min(9.0, u / shatter * 9.0)  # waxing crescent (tithi 1) -> gibbous (tithi 10)
        phase = 0.07 + (night / 9.0) * 0.68  # illuminated fraction-ish via sun angle
        ang = math.acos(1 - 2 * phase)   # 0 = full, pi = new (sun behind)
        sdir = Vector((math.sin(ang), -math.cos(ang), 0.15)).normalized()
        sun.rotation_euler = (-sdir).to_track_quat("-Z", "Y").to_euler()
        k = ease((u - shatter) / (1 - shatter)) if u > shatter else 0
        tt = max(0.0, (u - shatter) * dur)
        for c, p0, r0, v, w in shards:
            c.location = p0 + v * tt * 1.2 + Vector((0, 0, -1.2 * tt * tt))
            c.rotation_euler = (r0.x + w.x * tt, r0.y + w.y * tt, r0.z + w.z * tt)
        rim.data.energy = 300 + 900 * (k > 0) * max(0, 1 - tt * 1.5)
        aim(cam, lerp((0, -2.2, -0.2), (0.15, -1.5, 0.0), ease(u)), (0, 12, 2.0))
    update.night = lambda u: min(9, int(u / shatter * 9) + 1)
    return update


# ------------------------------------------------------------------ 7 Rama: an arrow of light over a dusk sea
def set_sea(sc, A):
    world(sky=[(0.0, (0.55, 0.18, 0.06)), (0.18, (0.35, 0.09, 0.08)), (0.5, (0.06, 0.03, 0.07)), (1.0, (0.01, 0.01, 0.03))], strength=1.0)
    bpy.ops.mesh.primitive_plane_add(size=2); sea = bpy.context.object
    oc = sea.modifiers.new("ocean", "OCEAN"); oc.size = 1.0; oc.spatial_size = 60; oc.resolution = 14; oc.wave_scale = 0.9; oc.choppiness = 1.2
    oc.geometry_mode = "GENERATE"; oc.repeat_x = oc.repeat_y = 4
    sea.data.materials.append(mat("sea", (0.01, 0.015, 0.02), rough=0.06, ior=1.33))
    sun_disc = prim("uv_sphere", "sundisc", emission("sund", (1, 0.45, 0.12), 25), radius=4, location=(-30, 220, 6))
    sun = light("SUN", (0, 0, 0), 3, (1, 0.5, 0.2), size=0.02); sun.rotation_euler = (math.radians(86), 0, math.radians(190))
    isle = prim("cone", "lanka", mat("isle", (0.004, 0.003, 0.004), rough=0.9), radius1=30, radius2=4, depth=7, location=(40, 260, 0), vertices=64)
    isle.scale = (2.2, 0.5, 1)
    # bow (a bent limb with a string) and an arrow
    wood = noisy(mat("bow", (0.08, 0.03, 0.01), rough=0.4, coat=0.5), 50, 0.4, 0.1, 0.2)
    bow_pts = [(0.25 * math.sin(math.pi * s), 0, -0.9 + 1.8 * s, 1.0 - 0.4 * abs(s - 0.5)) for s in np.linspace(0, 1, 11)]
    bow = curve_tube("bow", bow_pts, 0.018, wood)
    string = curve_tube("string", [(0, 0, -0.9), (-0.32, 0, 0.0), (0, 0, 0.9)], 0.0025, mat("str", (0.8, 0.75, 0.6), rough=0.5))
    string.data.splines[0].type = "POLY"
    arrow = prim("cylinder", "arrow", emission("arrowm", (1.0, 0.8, 0.45), 60), radius=0.01, depth=1.2, vertices=12, rotation=(math.pi / 2, 0, 0))
    trail = prim("cylinder", "trail", emission("trailm", (1.0, 0.5, 0.15), 20), radius=0.006, depth=1.0, vertices=8, rotation=(math.pi / 2, 0, 0))
    rig = bpy.data.objects.new("bowrig", None); link(rig); rig.location = (-0.7, 1.5, 1.4); rig.rotation_euler = (0.05, 0, -0.15)
    for o in (bow, string): o.parent = rig
    glare(sc, 1.0, 8, -0.5)
    cam = camera((0, -2.0, 1.7), (0, 40, 2.5), 32, dof=2.6, fstop=2.8)
    release = A.get("release", 0.35)

    def update(t, dur):
        u = t / dur
        oc.time = t * 0.6
        drawn = 1 - ease((u - release) / 0.04) if u > release else ease(u / release)
        sp = string.data.splines[0]
        sp.points[1].co = (-0.05 - 0.27 * drawn, 0, 0.0, 1)
        if u < release:
            arrow.location = (rig.location[0] + 0.3 - 0.27 * drawn, rig.location[1] + 0.4, rig.location[2])
            trail.hide_render = True
        else:
            tt = (u - release) * dur
            p = Vector((rig.location[0] + 0.3, rig.location[1] + 0.4, rig.location[2])) + Vector((-0.6, 60, 1.2)) * (tt ** 1.1) * 0.6
            arrow.location = p; trail.hide_render = False
            L = min(30, 8 * tt + 1); trail.scale = (1, 1, L); trail.location = p - Vector((-0.6, 60, 1.2)).normalized() * (L / 2 + 0.6)
        aim(cam, lerp((0, -2.0, 1.7), (0.1, -1.7, 1.75), ease(u)), (0, 40, lerp(2.5, 3.0, ease(u))))
    return update
