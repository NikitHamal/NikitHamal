"""Tihar sets: the valley lighting up, the Yama-Yamuna legend (oil ring, dubo, makhamali, a buffalo-horned shadow),
crows at dawn (Kag Tihar), the milk bowl (Gai Tihar), the garlanded ox (Govardhan / Goru Tihar)."""
import math
import bpy
import numpy as np
from mathutils import Vector
from lib import *
from lib import _set, _ramp
import sets_b as B_
import sets_c as C_

MAKHAMALI = (0.42, 0.02, 0.35)


def makhamali(name, loc, r=0.022, m=None):
    m = m or noisy(mat("makhamali", MAKHAMALI, rough=0.7, sss=0.2), 500, 0.3, 0.1, 0.9)
    o = prim("ico_sphere", name, m, subdivisions=3, radius=r, location=loc); o.scale = (1, 1, 1.25)
    tx = bpy.data.textures.new(name + "_t", "VORONOI"); tx.noise_scale = r * 0.25
    d = o.modifiers.new("d", "DISPLACE"); d.texture = tx; d.strength = r * 0.25
    for p in o.data.polygons: p.use_smooth = True
    return o


# ------------------------------------------------------------------ valley lighting up, street by street
def set_valley_glow(sc, A, variant="grow"):
    world(sky=[(0.0, (0.05, 0.03, 0.06)), (0.3, (0.012, 0.012, 0.035)), (1.0, (0.002, 0.002, 0.01))], strength=1.0)
    hdri_light("dikhololo_night", 1.0)
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=300, y_subdivisions=300, size=400); hills = bpy.context.object
    for p_ in hills.data.polygons: p_.use_smooth = True
    tx = bpy.data.textures.new("hills", "CLOUDS"); tx.noise_scale = 1.4
    dm = hills.modifiers.new("d", "DISPLACE"); dm.texture = tx; dm.strength = 1.0; dm.texture_coords = "GLOBAL"
    hills.data.materials.append(pbr("aerial_grass_rock", mat("hillm", (0.02, 0.03, 0.02), rough=0.9), 0.05, (0.25, 0.25, 0.25)))
    ridge = prim("cone", "ridge", mat("ridgem", (0.008, 0.01, 0.018), rough=0.95), radius1=180, radius2=20, depth=40, vertices=9, location=(0, 260, -5)); ridge.scale = (2.5, 0.4, 1)
    H, W0, P = B_.houses("town", 520, (-16, 16, 3, 44), 8, 0.0)
    rnd = np.random.default_rng(6)
    rank = rnd.random(len(P)) * 0.6 + (np.abs(P[:, 0]) / 16) * 0.4   # light spreads out from the middle of the valley
    bulb = prim("ico_sphere", "bulb", emission("bulbm", (1.0, 0.6, 0.2), 30), subdivisions=1, radius=0.035)
    win = emission("winT", (1.0, 0.58, 0.22), 8)
    groups = []
    for g in range(5):
        sel = (rank >= g / 5) & (rank < (g + 1) / 5)
        pts = []; wins = []
        for (x, y, _) in P[sel]:
            for k in range(12): pts.append((x - 0.48 + k / 11 * 0.96, y - 0.42, 1.62 + 0.03 * math.sin(k)))
            for zz in (0.25, 0.85): wins.append((x, y - 0.41, zz))
        b2 = bulb.copy(); b2.data = bulb.data; link(b2)
        s_ = instance_points("strings%d" % g, b2, np.array(pts) if pts else np.zeros((1, 3)))
        wsrc = prim("cube", "wsrc%d" % g, win, size=1); wsrc.scale = (0.22, 0.02, 0.28); bpy.ops.object.transform_apply(scale=True)
        w_ = instance_points("wins%d" % g, wsrc, np.array(wins) if wins else np.zeros((1, 3)))
        groups.append((s_, w_))
    bulb.hide_render = True
    lan_m = emission("lantern", (1.0, 0.5, 0.15), 18)
    for i in range(10):
        prim("cylinder", "lan%d" % i, lan_m, radius=0.25, depth=0.4, location=(rnd.uniform(-10, 10), rnd.uniform(14, 40), rnd.uniform(6, 16)))
    moon = light("SUN", (0, 0, 0), 1.2, (0.65, 0.75, 1.0), size=0.02); moon.rotation_euler = (math.radians(62), 0, math.radians(160))
    fill = light("AREA", (0, 10, 7), 0, (1.0, 0.6, 0.3), size=24, look=(0, 22, 0))
    volume_world(0.004, (1.0, 0.8, 0.6), 0.6)
    glare(sc, 1.0, 8, -0.5)
    cam = camera((0.0, -3.0, 3.0), (0, 26, 1.0), 36, dof=14, fstop=4)

    def update(t, dur):
        u = t / dur
        lit = 1.0 if variant == "full" else min(1.0, 0.1 + u * 1.05)
        n = 0
        for g, (s_, w_) in enumerate(groups):
            on = lit > g / 5; s_.hide_render = not on; w_.hide_render = not on; n += on
        fill.data.energy = 120 * n
        if variant == "grow": aim(cam, lerp((0.0, -3.0, 3.0), (0.3, -1.5, 2.6), ease(u)), (0, 26, 1.0))
        else: aim(cam, (0.0, -4.0, 4.2), (0, 26, 0.6))
    return update


# ------------------------------------------------------------------ the Yama-Yamuna legend
def set_yama(sc, A, variant="shadow"):
    world(INK, 0); hdri_light("brown_photostudio_02", 0.06)
    floor = prim("plane", "floor", pbr("brown_mud_dry", noisy(mat("floor", (0.09, 0.05, 0.03), rough=0.8), 6, 0.5, 0.1, 0.3), 2.0, (0.45, 0.32, 0.26)), size=10)
    copper = noisy(mat("copper", (0.95, 0.5, 0.32), rough=0.25, metal=1.0), 30, 0.3, 0.1, 0.05)
    oil_m = mat("oil", (0.6, 0.38, 0.06), rough=0.03, coat=1.0, ior=1.47)
    R = 0.32
    ring_pts = [(R * math.cos(a), R * math.sin(a), 0.002, 1.0) for a in np.linspace(0, 2 * math.pi, 64)]
    ring = curve_tube("oilring", ring_pts, 0.012, oil_m); ring.data.splines[0].type = "POLY"; ring.scale = (1, 1, 0.12)
    ring.data.bevel_factor_mapping_end = "SPLINE"
    # karuwa (spouted copper water vessel)
    kar = lathe("karuwa", smooth_profile([(0.0, 0.0), (0.045, 0.0), (0.075, 0.04), (0.08, 0.08), (0.06, 0.12), (0.035, 0.15), (0.04, 0.17), (0.03, 0.18)], 6), 64, copper)
    spout = curve_tube("spout", [(0.06, 0, 0.07), (0.11, 0, 0.1), (0.15, 0, 0.14)], 0.009, copper); spout.parent = kar
    stream = prim("cylinder", "stream", oil_m, radius=0.0035, depth=1.0, vertices=12)
    # dubo grass: fine blades around the ring; makhamali flowers half-ring; a diyo
    rnd = np.random.default_rng(3)
    blade = mesh_obj("dubo_b", [(0, -0.0015, 0), (0, 0.0015, 0), (0.006, 0.0006, 0.05), (0.012, 0, 0.09)], [(0, 1, 2), (2, 1, 3)] if False else [(0, 1, 2, 3)],
                     mat("dubo", (0.12, 0.38, 0.06), rough=0.5, sss=0.2), smooth=False)
    pts = []; rots = []
    for k in range(260):
        a = rnd.random() * 2 * math.pi; rr = R + rnd.normal(0.07, 0.025)
        pts.append((rr * math.cos(a), rr * math.sin(a), 0)); rots.append((rnd.normal(0, 0.4), rnd.normal(0, 0.4), rnd.random() * 6.28))
    instance_points("dubo", blade, np.array(pts), np.array(rots), rnd.uniform(0.6, 1.3, len(pts)))
    mk = noisy(mat("makhamali", MAKHAMALI, rough=0.7, sss=0.2), 500, 0.3, 0.1, 0.9)
    for k in range(22):
        a = math.pi * (0.15 + 0.7 * k / 21)
        makhamali("mk%d" % k, ((R + 0.16) * math.cos(a), (R + 0.16) * math.sin(a), 0.022), 0.022, mk)
    d, fl, li = diyo("diyo", (0.0, 0.0, 0.0), 1.6, 70, 10)
    tika = prim("uv_sphere", "tikabowl", brass("tb"), radius=0.05, location=(-0.2, -0.05, 0.02)); tika.scale = (1, 1, 0.4)
    red = prim("uv_sphere", "tikared", noisy(mat("tikam", TIKA, rough=0.6, sss=0.2), 300, 0.3, 0.1, 0.6), radius=0.04, location=(-0.2, -0.05, 0.032)); red.scale = (1, 1, 0.3)
    # Yama's buffalo: the scanned head, deep in shadow, a cold rim of light
    head_root, heads = import_ph("bull_head", (0, 1.9, -0.25), 2.6, (0, 0, math.pi))
    rim = light("SPOT", (0, 3.6, 1.6), 0, (0.45, 0.55, 1.0), size=0.3, look=(0, 1.9, 0.5), spot=0.9)
    warm = light("AREA", (0.6, -0.8, 0.9), 6, (1.0, 0.6, 0.35), size=0.6, look=(0, 0, 0))
    volume_world(0.05, (1, 0.85, 0.75), 0.5)
    glare(sc, 1.0, 8, -0.55)
    cam = camera((0.0, -1.3, 0.75), (0, 0.6, 0.15), 40, dof=1.4, fstop=2.2)

    def update(t, dur):
        u = t / dur; f = flicker(t)
        fl.scale = (0.75, 0.75, 2.2 * f); li.data.energy = 10 * f
        ring.data.bevel_factor_end = 1.0; kar.hide_render = True; stream.hide_render = True
        if head_root:
            for h in heads: h.hide_render = variant not in ("shadow", "calm")
        if variant == "shadow":
            rim.data.energy = 900 * ease((u - 0.1) / 0.6); ring.data.bevel_factor_end = 0.0
            aim(cam, lerp((0.0, -1.6, 0.6), (0.0, -1.2, 0.7), ease(u)), (0, 1.0, 0.45))
            cam.data.dof.focus_distance = 1.6; cam.data.dof.aperture_fstop = 2.8
        elif variant == "pour":
            k = ease(u * 1.05); ring.data.bevel_factor_end = max(0.001, k)
            a = 2 * math.pi * k; tip = Vector((R * math.cos(a), R * math.sin(a), 0.0))
            kar.hide_render = False; kar.location = tip + Vector((-0.13 * math.cos(a), -0.13 * math.sin(a), 0.16)); kar.rotation_euler = (0, 0.75, a)
            stream.hide_render = False; stream.location = tip + Vector((0, 0, 0.07)); stream.scale = (1, 1, 0.14)
            aim(cam, (0.25, -0.75, 0.62), (0, 0, 0.03)); cam.data.dof.focus_distance = 0.95
        elif variant == "close":
            aim(cam, lerp((0.42, -0.28, 0.13), (0.36, -0.16, 0.12), ease(u)), (0.22, 0.18, 0.02)); cam.data.dof.focus_distance = 0.42; cam.data.dof.aperture_fstop = 2.0
        elif variant == "calm":
            rim.data.energy = 900 * (1 - ease(u * 1.3))
            aim(cam, (0.0, -1.3, 0.72), (0, 0.8, 0.3)); cam.data.dof.focus_distance = 1.45
        else:  # complete: overhead, shining
            aim(cam, (0.0, -0.25, 1.3), (0, 0.02, 0)); cam.data.dof.focus_distance = 1.33; cam.data.dof.aperture_fstop = 5.6
            warm.data.energy = 14
    return update


# ------------------------------------------------------------------ Kag Tihar: crows on a tiled ridge at dawn
def crow(name, loc, yaw, peck=0.0, m=None, s=1.0):
    """A house crow in side profile (reads as a silhouette against the dawn): round head, heavy beak, oval body tilted
    forward, folded wings, long wedge tail, thin legs."""
    m = m or mat("feather", (0.004, 0.004, 0.005), rough=0.45, coat=0.3)
    root = bpy.data.objects.new(name, None); link(root)
    mb = bpy.data.metaballs.new(name + "_mb"); mb.resolution = mb.render_resolution = 0.004; mb.threshold = 0.6
    body = link(bpy.data.objects.new(name + "_b", mb)); mb.materials.append(m); body.parent = root
    hx, hz = 0.1 + 0.05 * peck, 0.2 - 0.09 * peck
    for (x, z, r, sx, sz) in [(0.0, 0.11, 0.07, 1.6, 1.0), (0.05, 0.13, 0.05, 1.2, 1.0), (-0.07, 0.1, 0.05, 1.5, 0.8), (-0.14, 0.09, 0.03, 1.6, 0.6),
                              (hx, hz, 0.042, 1.1, 1.0), (hx - 0.03, hz - 0.03, 0.035, 1.0, 1.0)]:
        e = mb.elements.new(type="ELLIPSOID"); e.co = (x, 0, z); e.radius = r; e.size_x = sx * r; e.size_y = r * 0.9; e.size_z = sz * r
    beak = prim("cone", name + "_k", m, radius1=0.014, radius2=0.0015, depth=0.06, location=(hx + 0.05, 0, hz - 0.005 - 0.02 * peck),
                rotation=(0, math.pi / 2 + 0.25 + 0.6 * peck, 0)); beak.scale = (0.8, 1, 1); beak.parent = root
    tail = mesh_obj(name + "_t", [(-0.14, -0.022, 0.095), (-0.14, 0.022, 0.095), (-0.3, 0.04, 0.05), (-0.31, 0.0, 0.045), (-0.3, -0.04, 0.05)],
                    [(0, 1, 2, 3), (0, 3, 4)], m, smooth=False); solidify(tail, 0.004); tail.parent = root
    for sd in (-1, 1):
        leg = prim("cylinder", name + "_l", m, radius=0.0035, depth=0.065, location=(0.0, sd * 0.018, 0.035), rotation=(0, 0.15, 0)); leg.parent = root
    root.location = loc; root.rotation_euler = (0, 0, yaw); root.scale = (s, s, s)
    return root


def set_crows(sc, A):
    world(sky=[(0.0, (1.0, 0.5, 0.16)), (0.08, (1.0, 0.62, 0.3)), (0.3, (0.75, 0.45, 0.4)), (0.7, (0.25, 0.25, 0.42)), (1.0, (0.08, 0.1, 0.25))], strength=2.2)
    tiles = pbr("clay_roof_tiles", noisy(mat("tile", (0.2, 0.08, 0.05), rough=0.7), 40, 0.4, 0.1, 0.3), 2.5, (0.5, 0.35, 0.3))
    for s in (-1, 1):
        r = prim("cube", "roof%d" % s, tiles, size=1, location=(0, s * 1.05, -0.62)); r.scale = (12, 2.4, 0.08); r.rotation_euler = (s * -0.52, 0, 0)
    ridge = prim("cylinder", "ridge", tiles, radius=0.07, depth=12, location=(0, 0, 0.0), rotation=(0, math.pi / 2, 0))
    gaj = lathe("gajur", smooth_profile([(0.08, 0), (0.09, 0.05), (0.05, 0.12), (0.07, 0.17), (0.03, 0.26), (0.0, 0.42)], 4), 32, gold("g"), close_bottom=True); gaj.location = (2.9, 0, 0.05)
    plate = prim("cylinder", "tapari", noisy(mat("leafplate", (0.25, 0.3, 0.08), rough=0.6), 60, 0.4, 0.1, 0.3), radius=0.15, depth=0.012, location=(0.55, -0.05, 0.075), vertices=48)
    rice = rice_heap("rice", (0.55, -0.05, 0.085), 0.08, 0.03, 700, color=(0.95, 0.92, 0.85))
    marigold("mgc", (0.62, 0.0, 0.1), 0.03)
    sunl = light("SUN", (0, 0, 0), 2.5, (1.0, 0.65, 0.35), size=0.04); sunl.rotation_euler = (math.radians(84), 0, math.radians(180))
    sun_disc = prim("uv_sphere", "sun", emission("sund", (1.0, 0.7, 0.35), 40), radius=5, location=(4, 160, 9))
    for i, (x, h) in enumerate([(-60, 25), (-10, 35), (40, 22), (90, 30)]):
        hl = prim("cone", "hill%d" % i, mat("hm%d" % i, (0.2, 0.08, 0.06), rough=0.9), radius1=60, radius2=8, depth=h, vertices=7, location=(x, 260, 0))
    volume_world(0.006, (1.0, 0.75, 0.55), 0.75)
    glare(sc, 0.9, 9, -0.4)
    cam = camera((1.0, -2.3, -0.12), (1.1, 0.0, 0.22), 50, dof=2.3, fstop=2.8)
    fm = mat("feather", (0.004, 0.004, 0.005), rough=0.45, coat=0.3)
    poses = [
        [(0.0, 0.0, 0.0, 0), (0.85, 0.0, math.pi, 0.0), (1.6, 0.0, 0.0, 0.0), (2.3, 0.0, math.pi, 0.2)],
        [(0.25, 0.0, 0.0, 0.3), (0.82, 0.0, math.pi, 0.9), (1.55, 0.0, 0.0, 0.0), (2.2, 0.0, math.pi, 0.0)],
        [(0.38, 0.0, 0.0, 1.0), (0.75, 0.0, math.pi, 1.0), (1.4, 0.0, 0.0, 0.2), (2.35, 0.0, math.pi, 0.5)],
    ]
    built = {}

    def update(t, dur):
        u = t / dur; k = 0 if u < 0.38 else (1 if u < 0.7 else 2)
        for c in built.values():
            c.hide_render = True
            for ch in c.children: ch.hide_render = True
        for i, (x, y, yaw, peck) in enumerate(poses[k]):
            key = (k, i)
            if key not in built: built[key] = crow("crow%d_%d" % key, (x, y, 0.06), yaw, peck, fm, 1.2)
            c = built[key]; c.hide_render = False
            for ch in c.children: ch.hide_render = False
        aim(cam, lerp((1.0, -2.3, -0.12), (1.05, -2.05, -0.08), ease(u)), (1.1, 0.0, 0.22))
    return update


# ------------------------------------------------------------------ Gai Tihar milk bowl -> Laxmi Puja rangoli (two scenes, one shot)
def set_gai_laxmi(sc, A):
    upd_r = C_.set_rangoli(sc, A)        # the rangoli + footprints + lamps at the origin, with its own camera
    cam_r = sc.camera
    off = Vector((40, 0, 0))
    floor = prim("plane", "floor2", pbr("brown_mud_dry", mat("f2", (0.1, 0.06, 0.04), rough=0.8), 2.0, (0.5, 0.36, 0.28)), size=3, location=off)
    bowl = lathe("milkbowl", smooth_profile([(0.0, 0.0), (0.06, 0.0), (0.11, 0.03), (0.13, 0.07), (0.128, 0.075), (0.115, 0.04), (0.0, 0.012)], 6), 96, brass("mb"))
    bowl.location = off
    milk = prim("cylinder", "milk", mat("milk", (0.93, 0.9, 0.82), rough=0.28, sss=0.25), radius=0.112, depth=0.004, location=off + Vector((0, 0, 0.062)), vertices=96)
    for i in range(7): marigold("mgm%d" % i, tuple(off + Vector((0.2 * math.cos(i), 0.2 * math.sin(i) - 0.02, 0.03))), 0.03)
    tika = prim("uv_sphere", "tk", noisy(mat("tk2", TIKA, rough=0.6), 300, 0.3, 0.1, 0.5), radius=0.03, location=off + Vector((-0.17, -0.12, 0.012))); tika.scale = (1, 1, 0.3)
    bell = lathe("cowbell", smooth_profile([(0.0, 0.1), (0.02, 0.1), (0.035, 0.07), (0.05, 0.02), (0.055, 0.0)], 5), 48, brass("bell"))
    bell.location = off + Vector((0.18, 0.15, 0.0))
    light("AREA", tuple(off + Vector((0.5, -0.7, 0.9))), 40, (1, 0.85, 0.65), size=0.8, look=tuple(off))
    camm = camera((0, 0, 0), (0, 0, 0), 50, dof=0.7, fstop=2.4, name="cam_milk")
    aim(camm, off + Vector((0.0, -0.55, 0.42)), off + Vector((0, 0, 0.04)))

    def update(t, dur):
        u = t / dur
        upd_r(t, dur)
        if u < 0.45: sc.camera = camm
        else:
            sc.camera = cam_r
            aim(cam_r, lerp((0.0, -0.9, 2.6), (0.0, -2.0, 2.3), ease((u - 0.45) / 0.55)), (0, 0.55, 0.0))
    return update


# ------------------------------------------------------------------ Govardhan / Goru Tihar: the garlanded ox
def set_ox(sc, A):
    world(INK, 0); hdri_light("brown_photostudio_02", 0.15)
    floor = prim("plane", "floor", pbr("brown_mud_dry", mat("f", (0.1, 0.06, 0.04), rough=0.8), 1.5, (0.5, 0.36, 0.28)), size=10)
    root, heads = import_ph("bull_head", (0, 0, -0.2), 3.0, (0, 0, 0))
    if heads:  # warm, living tone instead of dark bronze
        for h in heads:
            m = h.data.materials[0]; p = m.node_tree.nodes["Principled BSDF"]
            src = [l.from_socket for l in m.node_tree.links if l.to_socket == p.inputs["Base Color"]]
            if src:
                mx = m.node_tree.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "MULTIPLY"; mx.inputs[0].default_value = 1.0
                mx.inputs[7].default_value = (0.9, 0.62, 0.45, 1); m.node_tree.links.new(src[0], mx.inputs[6]); m.node_tree.links.new(mx.outputs[2], p.inputs["Base Color"])
    rnd = np.random.default_rng(12)   # a loose double marigold garland, drooping at the front
    for strand, (r0, z0, drop) in enumerate(((0.31, 0.32, 0.12), (0.34, 0.24, 0.2))):
        for i in range(34):
            a = 2 * math.pi * i / 34; front = max(0.0, -math.sin(a))
            c = (1.0, 0.36 + 0.3 * rnd.random(), 0.02)
            marigold("g%d_%d" % (strand, i), (r0 * math.cos(a), 0.02 + (r0 * 0.75) * math.sin(a), z0 - drop * front ** 2 + rnd.normal(0, 0.008)),
                     0.036 + 0.01 * rnd.random(), noisy(mat("mgo%d" % (i % 4), c, rough=0.55, sss=0.25), 300, 0.35, 0.1, 0.6))
    tk = prim("uv_sphere", "tika", noisy(mat("tk", TIKA, rough=0.6, sss=0.2), 300, 0.3, 0.1, 0.6), radius=0.03, location=(0.0, -0.33, 0.86)); tk.scale = (1, 0.25, 1.4)
    lamps = [diyo("od%d" % i, (x, -0.55, 0.0), 1.6, 70, 6) for i, x in enumerate((-0.45, 0.45))]
    light("AREA", (0.9, -1.4, 1.6), 60, (1.0, 0.7, 0.45), size=1.0, look=(0, 0, 0.8))
    light("AREA", (-1.0, 0.8, 1.4), 40, (1.0, 0.5, 0.25), size=1.0, look=(0, 0, 0.8))
    volume_world(0.03, (1, 0.85, 0.7), 0.5)
    glare(sc, 1.0, 8, -0.5)
    cam = camera((0.35, -2.6, 0.8), (0, 0, 0.62), 50, dof=2.6, fstop=2.4)

    def update(t, dur):
        u = t / dur
        for fl_ in [l[1] for l in lamps]: fl_.scale = (0.75, 0.75, 2.2 * flicker(t))
        aim(cam, lerp((0.35, -2.6, 0.8), (0.2, -2.2, 0.82), ease(u)), (0, 0, 0.62))
    return update


def set_mha_top(sc, A):
    upd = C_.set_mha(sc, A)
    def update(t, dur):
        aim(sc.camera, (0.0, -0.05, 1.6 - 0.15 * ease(t / dur)), (0, 0.0, 0)); sc.camera.data.dof.focus_distance = 1.5
    return update


def set_rangoli_top(sc, A):
    upd = C_.set_rangoli(sc, A)
    def update(t, dur):
        aim(sc.camera, (0.0, 0.0, 3.4 - 0.2 * ease(t / dur)), (0, 0.05, 0)); sc.camera.data.lens = 28; sc.camera.data.dof.focus_distance = 3.3
    return update
