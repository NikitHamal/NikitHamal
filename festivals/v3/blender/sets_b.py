"""Sets for Nepal, the days and the people: relief map, Taleju, jamara, Fulpati, lamps + tools, thali, valley at full moon,
linge ping + kites, the bus home, the lane of doorways, the red field."""
import json, math
import bpy
import numpy as np
from mathutils import Vector
from lib import *
from lib import _set, _ramp

K = 1.0; LON0, LAT0 = 84.1, 28.4; COSL = math.cos(math.radians(28.3)); ZEX = 0.05  # units per km of elevation


def ll(lon, lat, z=0.0):
    return Vector(((lon - LON0) * COSL * K, (lat - LAT0) * K, z))


def _inside(px, py, poly):
    x = poly[:, 0]; y = poly[:, 1]; x2 = np.roll(x, -1); y2 = np.roll(y, -1)
    ins = np.zeros(px.shape, bool)
    for a, b, c, d in zip(x, y, x2, y2):
        cond = ((b > py) != (d > py)) & (px < (c - a) * (py - b) / (d - b + 1e-12) + a)
        ins ^= cond
    return ins


# ------------------------------------------------------------------ 8/10 relief map of Nepal (2020 official boundary)
def set_map(sc, A, variant="rise"):
    world(INK, 0)
    poly = np.array(json.load(open(A["nepal"]))["pts"])
    dem = np.load(A["dem"])                 # metres, rows = lat descending, cols = lon ascending
    lon0, lon1, lat0, lat1 = A["dem_bounds"]
    NX, NY = 640, 330
    lons = np.linspace(poly[:, 0].min() - 0.02, poly[:, 0].max() + 0.02, NX)
    lats = np.linspace(poly[:, 1].min() - 0.02, poly[:, 1].max() + 0.02, NY)
    LO, LA = np.meshgrid(lons, lats)
    ci = np.clip(((LO - lon0) / (lon1 - lon0) * (dem.shape[1] - 1)).astype(int), 0, dem.shape[1] - 1)
    ri = np.clip(((lat1 - LA) / (lat1 - lat0) * (dem.shape[0] - 1)).astype(int), 0, dem.shape[0] - 1)
    H = np.maximum(dem[ri, ci], 0) / 1000.0
    ins = _inside(LO, LA, poly)
    V = np.stack([(LO - LON0) * COSL * K, (LA - LAT0) * K, 0.06 + H * ZEX], -1).reshape(-1, 3)
    idx = np.arange(NX * NY).reshape(NY, NX)
    q = ins[:-1, :-1] & ins[1:, :-1] & ins[:-1, 1:] & ins[1:, 1:]
    a = idx[:-1, :-1][q]; b = idx[:-1, 1:][q]; c = idx[1:, 1:][q]; d = idx[1:, :-1][q]
    F = np.stack([a, b, c, d], 1)
    me = bpy.data.meshes.new("relief"); me.from_pydata(V.tolist(), [], F.tolist()); me.update(calc_edges=True)
    hgt = me.attributes.new("h", "FLOAT", "POINT"); hgt.data.foreach_set("value", np.repeat(H.ravel(), 1))
    for p in me.polygons: p.use_smooth = True
    relief = link(bpy.data.objects.new("relief", me))
    rm = bpy.data.materials.new("terrain"); rm.use_nodes = True; nt = rm.node_tree; pb = nt.nodes["Principled BSDF"]
    at = nt.nodes.new("ShaderNodeAttribute"); at.attribute_name = "h"
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs[2].default_value = 8.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    _ramp(ramp, [(0.0, (0.32, 0.36, 0.12)), (0.06, (0.16, 0.24, 0.07)), (0.2, (0.07, 0.14, 0.05)), (0.42, (0.22, 0.18, 0.14)), (0.6, (0.42, 0.4, 0.38)), (0.66, (0.92, 0.94, 0.98))])
    nt.links.new(at.outputs["Fac"], mr.inputs[0]); nt.links.new(mr.outputs[0], ramp.inputs[0]); nt.links.new(ramp.outputs[0], pb.inputs["Base Color"])
    pb.inputs["Roughness"].default_value = 0.85
    relief.data.materials.append(rm)
    # side walls: the outline extruded down (a slab), deep red
    P = [ll(x, y) for x, y in poly]
    n = len(P); WV = []; WF = []
    for i, p in enumerate(P):
        WV += [(p.x, p.y, 0.06), (p.x, p.y, -0.12)]
    for i in range(n):
        j = (i + 1) % n; WF.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    wall = mesh_obj("wall", WV, WF, noisy(mat("slab", (0.32, 0.015, 0.02), rough=0.5, coat=0.3), 30, 0.2, 0.1, 0.05), smooth=False)
    edge = curve_tube("edge", [(*ll(x, y, 0.062), 1) for x, y in list(poly) + [poly[0]]], 0.006, emission("edgem", (1.0, 0.75, 0.5), 3))
    edge.data.splines[0].type = "POLY"
    # places
    ktm = ll(85.324, 27.717); gorkha = ll(84.630, 28.004)
    def hz(v):
        i = int(np.clip((v.y / K + LAT0 - lats[0]) / (lats[-1] - lats[0]) * (NY - 1), 0, NY - 1))
        j = int(np.clip((v.x / (COSL * K) + LON0 - lons[0]) / (lons[-1] - lons[0]) * (NX - 1), 0, NX - 1))
        return 0.06 + H[i, j] * ZEX
    ktm.z = hz(ktm); gorkha.z = hz(gorkha)
    pin_m = emission("pin", (1.0, 0.08, 0.04), 0)
    pin_k = prim("uv_sphere", "ktm", pin_m, radius=0.035, location=ktm + Vector((0, 0, 0.03)))
    pin_g = prim("uv_sphere", "gorkha", emission("ping", (1.0, 0.6, 0.2), 0), radius=0.03, location=gorkha + Vector((0, 0, 0.03)))
    # Fulpati route: Gorkha -> (Dhading) Jeevanpur -> Jamal; a glowing thread lifted above the hills
    via = [gorkha, ll(84.85, 27.93), ll(85.02, 27.83), ll(85.18, 27.75), ktm]
    route = curve_tube("route", [(v.x, v.y, hz(v) + 0.05 + 0.08 * math.sin(math.pi * i / 4), 1) for i, v in enumerate(via)], 0.008, emission("routem", (1.0, 0.75, 0.3), 12))
    route.data.bevel_factor_mapping_end = "SPLINE"; route.data.bevel_factor_end = 0.0
    sun = light("SUN", (0, 0, 0), 3.5, (1.0, 0.85, 0.7), size=0.03); sun.rotation_euler = (math.radians(62), 0, math.radians(-35))
    skyl = light("AREA", (0, -8, 6), 120, (0.5, 0.6, 1.0), size=8, look=(0, 0, 0))
    glare(sc, 1.0, 7, -0.6)
    cam = camera((0.0, -19.0, 10.0), (0.2, 0.3, 0), 50, dof=21, fstop=11)
    root = bpy.data.objects.new("map", None); link(root)
    for o in (relief, wall, edge, pin_k, pin_g, route): o.parent = root
    marks = {"ktm": ktm + Vector((0, 0, 0.06)), "gorkha": gorkha + Vector((0, 0, 0.06)),
             "west": ll(80.62, 30.2, 0.12)}

    def update(t, dur):
        u = t / dur
        if variant == "rise":
            k = ease(u / 0.55)
            root.location = (0, 0, lerp(-1.2, 0, k)); root.rotation_euler = (lerp(-0.5, 0, k), 0, lerp(0.25, 0, k))
            pin_m.node_tree.nodes["Emission"].inputs[1].default_value = 40 * ease((u - 0.55) / 0.15) * (0.75 + 0.25 * math.sin(t * 6))
            aim(cam, lerp((0.0, -15.5, 15.5), (0.25, -12.0, 12.5), ease(u)), (lerp(0.15, 0.3, ease(u)), 0.25, 0))
            cam.data.dof.focus_distance = (Vector(cam.location) - Vector((0.6, 0.3, 0))).length
            route.data.bevel_factor_end = 0.0
        else:  # route: the camera comes down close over Gorkha and follows the thread to Kathmandu
            pin_m.node_tree.nodes["Emission"].inputs[1].default_value = 40 * (0.75 + 0.25 * math.sin(t * 6))
            pin_g.data.materials[0].node_tree.nodes["Emission"].inputs[1].default_value = 30
            route.data.bevel_factor_end = ease((u - 0.15) / 0.65)
            mid = lerp(gorkha, ktm, lerp(0.35, 0.65, ease(u)))
            aim(cam, Vector(mid) + Vector((0.05, lerp(-2.3, -1.9, ease(u)), lerp(1.8, 1.45, ease(u)))), Vector(mid) + Vector((0, 0.1, 0)))
            cam.data.dof.focus_distance = (Vector(cam.location) - Vector(mid)).length
        mk = {}
        bpy.context.view_layer.update()
        from bpy_extras.object_utils import world_to_camera_view
        for k_, v in marks.items():
            w = root.matrix_world @ v
            c = world_to_camera_view(sc, cam, w); mk[k_] = (c.x, 1 - c.y, c.z)
        update.marks = mk
    update.marks = {}; update.world = marks
    return update


# ------------------------------------------------------------------ 9 Taleju at Hanuman Dhoka, night
def pagoda(name, tiers=3, base=2.2, plinth_steps=12, roof_m=None, wall_m=None):
    root = bpy.data.objects.new(name, None); link(root)
    brick = wall_m or pbr("castle_brick_02_red", noisy(mat("brick", (0.28, 0.06, 0.035), rough=0.8), 60, 0.4, 0.1, 0.4), 1.6)
    stone = noisy(mat("stone", (0.25, 0.23, 0.2), rough=0.85), 20, 0.4, 0.1, 0.4)
    roof_m = roof_m or noisy(mat("gilt", (0.9, 0.6, 0.25), rough=0.3, metal=1.0), 35, 0.4, 0.12, 0.1)
    wood = noisy(mat("wood", (0.06, 0.025, 0.012), rough=0.6), 50, 0.4, 0.1, 0.3)
    z = 0.0; s = base * 2.2
    for i in range(plinth_steps):  # stepped plinth
        st = prim("cube", "step%d" % i, stone if i % 2 == 0 else brick, size=1, location=(0, 0, z + 0.09)); st.scale = (s, s, 0.18); st.parent = root
        z += 0.18; s -= base * 1.1 / plinth_steps
    body_w = base; zb = z
    for i in range(tiers):
        h = 0.9 - 0.15 * i
        b = prim("cube", "body%d" % i, brick, size=1, location=(0, 0, z + h / 2)); b.scale = (body_w, body_w, h); b.parent = root
        # carved wooden band + struts
        band = prim("cube", "band%d" % i, wood, size=1, location=(0, 0, z + h - 0.06)); band.scale = (body_w * 1.02, body_w * 1.02, 0.12); band.parent = root
        z += h
        ov = body_w * 0.62 + 0.25
        rf = prim("cone", "roof%d" % i, roof_m, radius1=ov * 1.41, radius2=body_w * 0.42, depth=0.45, vertices=4, location=(0, 0, z + 0.18))
        rf.rotation_euler = (0, 0, math.pi / 4); rf.parent = root
        bel = rf.modifiers.new("b", "BEVEL"); bel.width = 0.03; bel.segments = 3
        for k in range(4):  # struts
            for j in (-1, 0, 1):
                a = k * math.pi / 2
                pos = Vector((math.cos(a) * body_w * 0.52 + -math.sin(a) * j * body_w * 0.32, math.sin(a) * body_w * 0.52 + math.cos(a) * j * body_w * 0.32, z - 0.3))
                stt = prim("cube", "strut", wood, size=1, location=pos); stt.scale = (0.05, 0.05, 0.55)
                stt.rotation_euler = (-math.sin(a) * 0.55, math.cos(a) * 0.55, 0); stt.parent = root
        z += 0.36; body_w *= 0.72
    g = lathe("gajur", smooth_profile([(0.16, 0), (0.18, 0.08), (0.1, 0.2), (0.14, 0.3), (0.06, 0.45), (0.08, 0.55), (0.0, 0.8)], 5), 48, roof_m, close_bottom=True)
    g.location = (0, 0, z - 0.1); g.parent = root
    door = prim("plane", "door", emission("doorlight", (1.0, 0.55, 0.2), 0), size=1, location=(0, -base / 2 - 0.002, zb + 0.32), rotation=(math.pi / 2, 0, 0))
    door.scale = (0.32, 0.55, 1); door.parent = root
    return root, door, zb


def set_taleju(sc, A):
    world(sky=[(0.0, (0.03, 0.03, 0.06)), (0.3, (0.012, 0.014, 0.04)), (1.0, (0.002, 0.003, 0.01))], strength=1.0)
    hdri_light("dikhololo_night", 0.6)
    ground = prim("plane", "square", pbr("cobblestone_floor_04", noisy(mat("paving", (0.12, 0.1, 0.09), rough=0.6), 8, 0.4, 0.2, 0.3), 0.8, (0.6, 0.55, 0.5)), size=80)
    tem, door, zb = pagoda("taleju")
    moon = light("SUN", (0, 0, 0), 0.35, (0.6, 0.7, 1.0), size=0.02); moon.rotation_euler = (math.radians(55), 0, math.radians(30))
    rnd = np.random.default_rng(4)
    lamps = []
    for i in range(26):
        a = 2 * math.pi * i / 26; r = 3.7
        d, fl, li = diyo("lamp%d" % i, (r * math.cos(a), r * math.sin(a), 0.0), 2.0, 80, 2.5)
        lamps.append((fl, li, rnd.random() * 10))
    doorl = light("AREA", (0, -1.5, zb + 0.35), 0, (1.0, 0.55, 0.2), size=0.4, look=(0, -5, zb))
    haze, hv = volume_world(0.012, (0.8, 0.85, 1.0), 0.3)
    stars_src = prim("ico_sphere", "star", emission("starm", (1, 1, 1), 5), subdivisions=1, radius=0.03)
    S = np.stack([rnd.uniform(-40, 40, 500), rnd.uniform(30, 50, 500), rnd.uniform(5, 45, 500)], 1)
    instance_points("stars", stars_src, S, None, rnd.uniform(0.3, 1.5, 500))
    glare(sc, 1.0, 8, -0.5)
    cam = camera((1.0, -9.5, 0.6), (0, 0, 3.5), 35, dof=9, fstop=4)
    dm = door.data.materials[0].node_tree.nodes["Emission"]

    def update(t, dur):
        u = t / dur
        for fl, li, s in lamps:
            f = flicker(t, s); fl.scale = (0.75, 0.75, 2.2 * f); li.data.energy = 2.5 * f
        open_ = ease((u - 0.45) / 0.25)
        dm.inputs[1].default_value = 30 * open_; doorl.data.energy = 120 * open_
        aim(cam, lerp((1.6, -10.5, 0.5), (0.4, -7.2, 1.4), ease(u)), (0, 0, lerp(4.2, 2.6, ease(u))))
    return update


# ------------------------------------------------------------------ 12 Ghatasthapana: jamara grows in the dark
def set_jamara(sc, A, variant="grow"):
    world(INK, 0)
    hdri_light("brown_photostudio_02", 0.12)
    floor = prim("plane", "floor", pbr("brown_mud_dry", noisy(mat("mud", (0.1, 0.06, 0.04), rough=0.9), 4, 0.5, 0.05, 0.5), 2.0, (0.45, 0.32, 0.26)), size=6)
    bed = prim("cylinder", "bed", pbr("coast_sand_01", noisy(mat("sand", (0.32, 0.25, 0.16), rough=0.95), 300, 0.4, 0.05, 0.9), 6.0), radius=0.35, depth=0.06, location=(0, 0, 0.03), vertices=96)
    k = kalash("kalash", (0, 0, 0.06), 1.1)
    jam, blade = jamara("jam", (0, 0, 0.06), 0.33, 2600, 0.3)
    light("AREA", (0.6, -0.7, 0.7), 18, (1.0, 0.7, 0.4), size=0.5, look=(0, 0, 0.12))
    jam_mask = []
    d, fl, li = diyo("diyo", (0.42, -0.25, 0), 1.2, 60, 7)
    slit = light("AREA", (-1.5, 0.4, 0.8), 0, (1.0, 0.8, 0.55), size=0.05, look=(0, 0, 0.1))
    haze, hv = volume_world(0.05, (1, 0.85, 0.7), 0.6)
    glare(sc, 1.1, 7, -0.6)
    cam = camera((0.05, -1.2, 0.22), (0, 0, 0.16), 55, dof=1.2, fstop=2.2)

    def update(t, dur):
        u = t / dur
        g = ease(u * 0.95) if variant == "grow" else 1.0
        jam.scale = (1, 1, max(0.03, g))
        f = flicker(t); fl.scale = (0.75, 0.75, 2.2 * f); li.data.energy = 7 * f
        aim(cam, lerp((0.35, -0.95, 0.16), (-0.2, -0.8, 0.26), ease(u)), (0, 0, lerp(0.07, 0.15, g)))
        cam.data.dof.focus_distance = (Vector(cam.location) - Vector((0, -0.2, 0.15))).length
    return update


# ------------------------------------------------------------------ 13 Fulpati: the nine plants, the salute
def set_fulpati(sc, A):
    world(sky=[(0.0, (0.5, 0.22, 0.1)), (0.25, (0.2, 0.08, 0.07)), (1.0, (0.02, 0.015, 0.03))], strength=0.8)
    hdri_light("kiara_9_dusk", 0.5)
    ground = prim("plane", "tundikhel", noisy(mat("grass", (0.05, 0.08, 0.02), rough=0.9), 2, 0.5, 0.05, 0.3), size=300)
    # palanquin (doli) with the bundle
    red = noisy(mat("doli", (0.45, 0.02, 0.02), rough=0.55, sss=0.05), 80, 0.3, 0.1, 0.3)
    g = gold("trim")
    box = prim("cube", "doli", red, size=1, location=(0, 0, 0.75)); box.scale = (0.7, 0.5, 0.35); bevel(box, 0.02, 3)
    for y in (-0.3, 0.3):
        pole = prim("cylinder", "pole", g, radius=0.03, depth=3.0, location=(0, y, 0.75), rotation=(0, math.pi / 2, 0))
    leaf_m = noisy(mat("banana", (0.06, 0.25, 0.04), rough=0.4, sss=0.2), 30, 0.3, 0.1, 0.1)
    rnd = np.random.default_rng(9)
    for i in range(9):  # banana, turmeric, ashoka, colocasia... as tall leaves fanned up out of the doli
        lf = _blade_leaf("lf%d" % i, rnd.uniform(0.7, 1.2), rnd.uniform(0.08, 0.16), leaf_m)
        lf.location = (rnd.uniform(-0.2, 0.2), rnd.uniform(-0.12, 0.12), 0.92); lf.rotation_euler = (rnd.uniform(-0.35, 0.35), -math.pi / 2 + rnd.uniform(-0.3, 0.3), rnd.uniform(0, 6.28))
    paddy_m = noisy(mat("paddy", (0.75, 0.6, 0.2), rough=0.6), 60, 0.3, 0.1, 0.1)
    for i in range(30):
        x, y = rnd.uniform(-0.15, 0.15), rnd.uniform(-0.1, 0.1)
        curve_tube("paddy%d" % i, [(x, y, 0.9), (x * 1.5, y * 1.5, 1.3), (x * 2.5 + 0.06, y * 2.5, 1.55)], 0.003, paddy_m)
    for i, (c, r) in enumerate([((0.7, 0.05, 0.04), 0.06), ((0.6, 0.65, 0.3), 0.07), ((0.7, 0.05, 0.04), 0.055)]):
        f = prim("uv_sphere", "fruit%d" % i, mat("fruit%d" % i, c, rough=0.35, coat=0.3), radius=r, location=(-0.25 + 0.22 * i, -0.28, 1.12))
    for i in range(5):
        marigold("mgf%d" % i, (-0.3 + 0.15 * i, -0.26, 0.98), 0.03)
    # the salute: a line of muzzle flashes far behind (with smoke), out of focus
    flashes = []
    fm = emission("flash", (1.0, 0.7, 0.35), 0)
    for i in range(24):
        x = -14 + i * 1.2
        f = prim("uv_sphere", "flash%d" % i, fm, radius=0.25, location=(x, 30 + rnd.uniform(-0.5, 0.5), 1.4))
        f.scale = (1.6, 1, 0.8); flashes.append(f)
    key = light("AREA", (1.5, -2.0, 2.0), 160, (1, 0.75, 0.5), size=1.2, look=(0, 0, 1))
    rim = light("AREA", (-1, 2, 1.8), 80, (1, 0.5, 0.25), size=1.0, look=(0, 0, 1))
    salute = light("POINT", (0, 30, 2), 0, (1, 0.7, 0.4), size=3)
    volume_world(0.012, (1, 0.9, 0.8), 0.5)
    glare(sc, 1.0, 8, -0.5)
    cam = camera((1.6, -2.6, 1.1), (0, 0, 1.15), 50, dof=3.0, fstop=1.8)
    shots = A.get("volleys", [0.55, 0.68, 0.81])

    def update(t, dur):
        u = t / dur
        e = 0.0
        for v in shots:
            dt = (u - v) * dur
            if 0 <= dt < 0.25: e = max(e, 1 - dt / 0.25)
        fm.node_tree.nodes["Emission"].inputs[1].default_value = 80 * e
        salute.data.energy = 30000 * e
        aim(cam, lerp((1.6, -2.6, 1.1), (0.7, -2.0, 1.25), ease(u)), (0, 0, 1.15))
    return update


def _blade_leaf(name, L, W, m, n=12):
    V = []; F = []
    for i in range(n + 1):
        t = i / n; w = W * math.sin(math.pi * min(1, t * 1.05)) ** 0.7; z = 0.12 * L * t * t
        V += [(t * L, -w, z + w * 0.15), (t * L, 0, z), (t * L, w, z + w * 0.15)]
    for i in range(n):
        a = i * 3; F += [(a, a + 3, a + 4, a + 1), (a + 1, a + 4, a + 5, a + 2)]
    o = mesh_obj(name, V, F, m); solidify(o, 0.002); return o


# ------------------------------------------------------------------ 14 Ashtami lamps / Navami tools
def khukuri(name, m_blade, m_handle):
    """The khukuri: a recurved blade (extruded outline with a bevel) and a horn handle."""
    pts = [(0.0, 0.0), (0.06, 0.012), (0.14, 0.03), (0.22, 0.045), (0.28, 0.04), (0.33, 0.02), (0.355, -0.01), (0.34, -0.035),
           (0.29, -0.03), (0.22, -0.012), (0.14, -0.004), (0.07, -0.012), (0.035, -0.02), (0.02, -0.012), (0.0, -0.016)]
    cd = bpy.data.curves.new(name, "CURVE"); cd.dimensions = "2D"; cd.fill_mode = "BOTH"; cd.extrude = 0.003; cd.bevel_depth = 0.0012
    sp = cd.splines.new("POLY"); sp.points.add(len(pts) - 1)
    for p, (x, y) in zip(sp.points, pts): p.co = (x, y, 0, 1)
    sp.use_cyclic_u = True
    o = link(bpy.data.objects.new(name, cd)); cd.materials.append(m_blade)
    h = prim("cylinder", name + "_h", m_handle, radius=0.014, depth=0.12, location=(-0.06, -0.004, 0), rotation=(0, math.pi / 2, 0), vertices=24)
    h.parent = o
    return o


def set_lamps_tools(sc, A):
    world(INK, 0)
    hdri_light("brown_photostudio_02", 0.12)
    floor = prim("plane", "floor", noisy(mat("stonefl", (0.08, 0.06, 0.05), rough=0.5), 5, 0.4, 0.2, 0.2), size=20)
    rnd = np.random.default_rng(2)
    src_body = lathe("lampsrc", smooth_profile([(0.0, 0.0), (0.03, 0.0), (0.045, 0.006), (0.06, 0.022), (0.064, 0.03), (0.058, 0.031), (0.045, 0.018), (0.0, 0.016)], 4), 32, clay("lampclay"))
    src_fl = prim("uv_sphere", "flsrc", flame_mat("lampfl", 50)[0], radius=0.01, location=(0.0, 0, 0.045), segments=16, ring_count=10); src_fl.scale = (0.75, 0.75, 2.2)
    P = []
    for i in range(18):
        for j in range(14):
            P.append(((j - 6.5) * 0.17 + rnd.normal(0, 0.01), i * 0.17 + rnd.normal(0, 0.01), 0))
    P = np.array(P)
    lamps = instance_points("lamps", src_body, P, np.stack([np.zeros(len(P)), np.zeros(len(P)), rnd.random(len(P)) * 6.28], 1))
    fls = instance_points("flames", src_fl, P + np.array([0, 0, 0.045]), None, rnd.uniform(0.8, 1.2, len(P)))
    plights = []
    for i in range(0, 18, 3):
        for j in range(0, 14, 4):
            plights.append(light("POINT", ((j - 6.5) * 0.17, i * 0.17, 0.12), 1.2, (1, 0.55, 0.2), size=0.05))
    lamp_root = bpy.data.objects.new("lampset", None); link(lamp_root)
    for o in [lamps, fls, *plights]: o.parent = lamp_root
    # Navami: tools on red cloth, tika on the blades, marigold garland
    tool_root = bpy.data.objects.new("toolset", None); link(tool_root); tool_root.location = (40, 0, 0)
    cloth = prim("plane", "cloth", noisy(mat("cloth", (0.4, 0.01, 0.015), rough=0.85, sss=0.05), 140, 0.35, 0.05, 0.6), size=1.2); cloth.parent = tool_root
    steel = noisy(mat("steel", (0.6, 0.6, 0.62), rough=0.18, metal=1.0, aniso=0.5), 60, 0.2, 0.08, 0.02)
    horn = noisy(mat("hornh", (0.07, 0.04, 0.02), rough=0.35, coat=0.5), 50, 0.4, 0.1, 0.2)
    kh = khukuri("khukuri", steel, horn); kh.parent = tool_root; kh.location = (-0.05, 0.05, 0.02); kh.rotation_euler = (0, 0, 0.25)
    sickle = curve_tube("hasiya", [(0.0, -0.18, 0.012), (0.12, -0.2, 0.012), (0.22, -0.14, 0.012), (0.25, -0.05, 0.012), (0.2, 0.02, 0.012)], 0.006, steel)
    sickle.data.extrude = 0.001; sickle.parent = tool_root
    for i, (x, y) in enumerate([(0.12, 0.06), (0.2, -0.12)]):
        dot = prim("uv_sphere", "tika%d" % i, noisy(mat("tikadot", TIKA, rough=0.6, sss=0.1), 300, 0.3, 0.1, 0.5), radius=0.012, location=(x, y, 0.026))
        dot.scale = (1, 1, 0.3); dot.parent = tool_root
    for i in range(16):
        a = i / 15
        mg = marigold("garl%d" % i, (-0.35 + 0.7 * a, 0.22 + 0.05 * math.sin(a * 6), 0.03), 0.026); mg.parent = tool_root
    tkey = light("AREA", (40.4, -0.5, 0.8), 30, (1, 0.8, 0.6), size=0.6, look=(40, 0, 0)); tkey.parent = None
    trim = light("AREA", (39.5, 0.6, 0.4), 12, (1, 0.5, 0.3), size=0.5, look=(40, 0, 0))
    volume_world(0.05, (1, 0.85, 0.7), 0.5)
    glare(sc, 1.0, 8, -0.5)
    cam = camera((0, -0.6, 0.3), (0, 1.2, 0.0), 40, dof=1.0, fstop=1.4)
    cut = A.get("cut", 0.48)

    def update(t, dur):
        u = t / dur
        for i, l in enumerate(plights): l.data.energy = 1.2 * flicker(t, i)
        if u < cut:
            v = ease(u / cut)
            aim(cam, lerp((0.0, -0.7, 0.22), (0.1, -0.35, 0.16), v), (0, 1.0, 0.02))
            cam.data.dof.focus_distance = lerp(0.9, 0.6, v); cam.data.dof.aperture_fstop = 1.4
        else:
            v = ease((u - cut) / (1 - cut))
            aim(cam, lerp((40.25, -0.55, 0.45), (40.1, -0.4, 0.3), v), (40.05, 0, 0.0))
            cam.data.dof.focus_distance = (Vector(cam.location) - Vector((40.05, 0, 0))).length; cam.data.dof.aperture_fstop = 2.8
    return update


# ------------------------------------------------------------------ 15/20/21/22 the thali (Vijaya Dashami)
def set_thali(sc, A, variant="dashami"):
    world(INK, 0)
    hdri_light("brown_photostudio_02", 0.12)
    base_m = noisy(mat("velvet", (0.3, 0.004, 0.01), rough=0.95, sss=0.05), 200, 0.35, 0.05, 0.6)
    table = prim("plane", "table", base_m, size=6)
    prof = smooth_profile([(0.0, 0.0), (0.2, 0.0), (0.235, 0.008), (0.25, 0.022), (0.262, 0.028), (0.258, 0.03), (0.24, 0.022), (0.2, 0.008), (0.0, 0.008)], 6)
    thali = lathe("thali", prof, 128, brass("thalib", 0.18))
    rice = rice_heap("rice", (-0.05, -0.04, 0.01), 0.1, 0.055, 4500)
    bowl = lathe("bowl", smooth_profile([(0.0, 0.0), (0.03, 0.0), (0.05, 0.02), (0.055, 0.04), (0.05, 0.042), (0.045, 0.022), (0.0, 0.012)], 5), 64, brass("bowlb", 0.22))
    bowl.location = (0.11, 0.06, 0.008)
    curd = prim("uv_sphere", "curd", mat("curd", (0.95, 0.93, 0.85), rough=0.25, sss=0.6), radius=0.044, location=(0.11, 0.06, 0.028)); curd.scale = (1, 1, 0.35)
    jam, blade = jamara("jam", (0.08, -0.1, 0.01), 0.04, 260, 0.2)
    tie = prim("torus", "tie", mat("thread", (0.85, 0.1, 0.05), rough=0.6), major_radius=0.022, minor_radius=0.003, location=(0.08, -0.1, 0.04))
    d, fl, li = diyo("diyo", (-0.13, 0.12, 0.008), 0.9, 60, 4)
    for i in range(9):
        a = 2 * math.pi * i / 9
        marigold("mgt%d" % i, (0.31 * math.cos(a), 0.31 * math.sin(a), 0.03), 0.03)
    key = light("AREA", (0.5, -0.6, 0.9), 40, (1, 0.8, 0.6), size=0.6, look=(0, 0, 0))
    rim = light("AREA", (-0.6, 0.7, 0.35), 18, (1, 0.45, 0.25), size=0.5, look=(0, 0, 0))
    volume_world(0.03, (1, 0.85, 0.7), 0.5)
    glare(sc, 1.0, 8, -0.5)
    cam = camera((0, -0.7, 0.75), (0, 0, 0), 45, dof=1.0, fstop=2.0)
    # flood: grains that fly to the lens on the blessing
    flood = None
    if variant == "blessing":
        flood = rice_heap("flood", (0, 0, 0), 0.08, 0.02, 2500, seed=4)
        flood.hide_render = True

    def update(t, dur):
        u = t / dur
        f = flicker(t); fl.scale = (0.75, 0.75, 2.2 * f); li.data.energy = 4 * f
        if variant == "dashami":
            a = lerp(-0.6, 0.35, ease(u))
            p = (0.75 * math.sin(a), -0.75 * math.cos(a), lerp(0.85, 0.42, ease(u)))
            aim(cam, p, (0, 0, 0.02)); cam.data.dof.focus_distance = Vector(p).length
        elif variant == "blessing":
            v = ease(u)
            p = lerp((0.1, -0.5, 0.3), (-0.02, -0.16, 0.1), v)
            aim(cam, p, (-0.05, -0.04, 0.03)); cam.data.dof.focus_distance = (Vector(p) - Vector((-0.05, -0.04, 0.03))).length
            if u > 0.62:
                flood.hide_render = False; k = ease((u - 0.62) / 0.3)
                flood.location = lerp((-0.05, -0.04, 0.06), (p[0], p[1] + 0.02, p[2]), k); flood.scale = (1 + 4 * k,) * 3
        else:  # wish / sign: high, still, the thali small in a red field
            p = (0.0, -0.18, 1.25 - 0.08 * ease(u))
            aim(cam, p, (0, 0.04, 0)); cam.data.lens = 45; cam.data.dof.focus_distance = Vector(p).length; cam.data.dof.aperture_fstop = 4
    return update


# ------------------------------------------------------------------ 16 Kojagrat: valley under the full moon
def houses(name, n, area, seed=1, lit_frac=0.15):
    rnd = np.random.default_rng(seed)
    brick = pbr("castle_brick_02_red", noisy(mat("hbrick", (0.25, 0.08, 0.05), rough=0.85), 30, 0.4, 0.1, 0.3), 1.2)
    tile = pbr("clay_roof_tiles", noisy(mat("tile", (0.12, 0.05, 0.035), rough=0.7), 40, 0.4, 0.1, 0.3), 1.0, (0.6, 0.4, 0.35))
    win = emission("win", (1.0, 0.6, 0.25), 6)
    hb = prim("cube", name + "_b", brick, size=1); hb.scale = (1, 0.8, 1.6); bpy.ops.object.transform_apply(scale=True)
    hr = prim("cone", name + "_r", tile, radius1=0.9, radius2=0.05, depth=0.5, vertices=4, location=(0, 0, 1.05)); hr.rotation_euler = (0, 0, math.pi / 4); hr.scale = (1, 0.85, 1)
    bpy.ops.object.select_all(action="DESELECT"); hb.select_set(True); hr.select_set(True); bpy.context.view_layer.objects.active = hb; bpy.ops.object.join()
    hw = prim("cube", name + "_w", win, size=1, location=(0, -0.41, 0.25)); hw.scale = (0.22, 0.02, 0.28); bpy.ops.object.transform_apply(scale=True, location=False)
    x0, x1, y0, y1 = area
    P = np.stack([rnd.uniform(x0, x1, n), rnd.uniform(y0, y1, n), np.zeros(n)], 1)
    R = np.stack([np.zeros(n), np.zeros(n), rnd.integers(0, 4, n) * math.pi / 2 + rnd.normal(0, 0.05, n)], 1)
    S = rnd.uniform(0.7, 1.25, n)
    H = instance_points(name, hb, P, R, S)
    lit = rnd.random(n) < lit_frac
    W = instance_points(name + "_lit", hw, P[lit], R[lit], S[lit])
    return H, W, P


def set_valley(sc, A):
    world(sky=[(0.0, (0.02, 0.03, 0.07)), (0.35, (0.01, 0.014, 0.04)), (1.0, (0.002, 0.003, 0.012))], strength=1.0)
    hdri_light("dikhololo_night", 0.6)
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=200, y_subdivisions=200, size=400); hills = bpy.context.object
    tx = bpy.data.textures.new("hills", "CLOUDS"); tx.noise_scale = 1.4
    dm = hills.modifiers.new("d", "DISPLACE"); dm.texture = tx; dm.strength = 1.0; dm.texture_coords = "GLOBAL"
    hills.data.materials.append(noisy(mat("hillm", (0.03, 0.05, 0.03), rough=0.9), 0.5, 0.4, 0.05, 0.2))
    ridge = prim("cone", "ridge", mat("ridgem", (0.01, 0.012, 0.02), rough=0.95), radius1=180, radius2=20, depth=40, vertices=7, location=(0, 260, -5))
    ridge.scale = (2.5, 0.4, 1)
    H, W, P = houses("town", 420, (-14, 14, 4, 40), 3, 0.22)
    hero_m = emission("hero", (1.0, 0.6, 0.25), 0)
    hero = prim("cube", "herowin", hero_m, size=1, location=(0.6, 6.5, 0.45)); hero.scale = (0.22, 0.02, 0.28)
    hb = prim("cube", "herohouse", noisy(mat("hb2", (0.25, 0.08, 0.05), rough=0.85), 30, 0.4, 0.1, 0.3), size=1, location=(0.6, 6.92, 0.8)); hb.scale = (1, 0.8, 1.6)
    moon_d = prim("uv_sphere", "moondisc", emission("moonm", (1.0, 0.95, 0.85), 18), radius=6, location=(-18, 230, 38))
    moon = light("SUN", (0, 0, 0), 2.5, (0.7, 0.8, 1.0), size=0.02); moon.rotation_euler = (math.radians(70), 0, math.radians(165))
    haze, hv = volume_world(0.004, (0.7, 0.8, 1.0), 0.6)
    hl = light("POINT", (0.6, 6.2, 0.45), 0, (1, 0.6, 0.25), size=0.1)
    glare(sc, 1.0, 9, -0.5)
    cam = camera((0.0, -4.0, 2.0), (0, 30, 3.0), 40, dof=10, fstop=5.6)

    def update(t, dur):
        u = t / dur
        k = ease((u - 0.35) / 0.25)
        hero_m.node_tree.nodes["Emission"].inputs[1].default_value = 40 * k * flicker(t)
        hl.data.energy = 8 * k
        moon_d.location = (-18, 230, lerp(30, 42, ease(u)))
        aim(cam, lerp((0.4, -4.5, 2.2), (0.2, -1.2, 1.3), ease(u)), lerp((0, 40, 6.0), (0.6, 6.9, 0.9), ease((u - 0.3) / 0.7)))
        cam.data.dof.focus_distance = (Vector(cam.location) - Vector((0.6, 6.5, 0.45))).length
    return update


# ------------------------------------------------------------------ 17 linge ping and kites
def kite(name, color, size=0.5):
    V = [(0, 0, size * 0.65), (size * 0.42, 0, 0.05), (0, 0, -size * 0.45), (-size * 0.42, 0, 0.05)]
    k = mesh_obj(name, V, [(0, 1, 2, 3)], mat(name + "_p", color, rough=0.6, sss=0.4), smooth=False)
    tail = curve_tube(name + "_tail", [(0, 0, -size * 0.45), (0.05, 0, -size * 0.8), (-0.04, 0, -size * 1.1), (0.05, 0, -size * 1.4)], 0.008, mat(name + "_t", (1, 1, 1), rough=0.6))
    tail.data.extrude = 0.02; tail.parent = k
    return k


def set_ping(sc, A):
    world(sky=[(0.0, (0.95, 0.62, 0.32)), (0.25, (0.55, 0.55, 0.65)), (1.0, (0.18, 0.3, 0.55))], strength=1.2)
    hdri_sky("belfast_sunset_puresky", 0.9, 1.2) or True
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=220, y_subdivisions=220, size=300); hills = bpy.context.object
    tx = bpy.data.textures.new("terr", "CLOUDS"); tx.noise_scale = 1.8
    dm = hills.modifiers.new("d", "DISPLACE"); dm.texture = tx; dm.strength = 4.0; dm.texture_coords = "GLOBAL"
    hills.data.materials.append(pbr("aerial_grass_rock", noisy(mat("terraces", (0.18, 0.2, 0.05), rough=0.9), 0.6, 0.45, 0.05, 0.3), 0.05))
    snow = prim("cone", "himal", noisy(mat("snow", SNOW, rough=0.5, sss=0.1), 4, 0.3, 0.1, 0.8), radius1=60, radius2=2, depth=45, vertices=9, location=(-30, 220, 0))
    snow.scale = (1.6, 0.6, 1)
    bam = pbr("bamboo_veneer", noisy(mat("bamboo", (0.55, 0.45, 0.22), rough=0.45, coat=0.3), 40, 0.3, 0.1, 0.2), 3.0)
    top = Vector((0, 4, 9.5))
    for (x, y) in [(-2.6, 2.4), (2.6, 2.4), (-2.4, 5.6), (2.4, 5.6)]:
        b = Vector((x, y, 0)); mid = (b + top) / 2
        c = prim("cylinder", "bam", bam, radius=0.09, depth=(top - b).length, location=mid, vertices=24)
        c.rotation_euler = (top - b).to_track_quat("Z", "Y").to_euler()
    rope_m = mat("rope", (0.45, 0.35, 0.2), rough=0.8)
    swing = bpy.data.objects.new("swing", None); link(swing); swing.location = top
    for dx in (-0.25, 0.25):
        r = prim("cylinder", "rope", rope_m, radius=0.02, depth=8.6, location=(dx, 0, -4.3), vertices=8); r.parent = swing
    seat = prim("cube", "seat", bam, size=1, location=(0, 0, -8.6)); seat.scale = (0.7, 0.18, 0.06); seat.parent = swing
    kid = prim("uv_sphere", "kid", mat("kid", (0.5, 0.05, 0.08), rough=0.7), radius=0.3, location=(0, 0, -8.15)); kid.scale = (0.8, 0.6, 1.4); kid.parent = swing
    head = prim("uv_sphere", "kidh", mat("skin", (0.35, 0.2, 0.12), rough=0.6, sss=0.3), radius=0.17, location=(0, 0, -7.55)); head.parent = swing
    kites = []
    for i, c in enumerate([(0.8, 0.05, 0.05), (0.05, 0.25, 0.8), (1.0, 0.7, 0.05), (0.1, 0.6, 0.2), (0.85, 0.2, 0.6), (0.95, 0.4, 0.05)]):
        k = kite("kite%d" % i, c, 0.8); k.location = (-10 + 4.5 * i, 30 + 6 * (i % 2), 14 + 3 * (i % 3)); kites.append((k, i))
    sun = light("SUN", (0, 0, 0), 4.5, (1.0, 0.78, 0.55), size=0.02); sun.rotation_euler = (math.radians(78), 0, math.radians(200))
    volume_world(0.0015, (1.0, 0.85, 0.7), 0.7)
    glare(sc, 1.2, 8, -0.6)
    cam = camera((1.0, -10, 1.2), (0, 4, 6.5), 28, dof=12, fstop=8)

    def update(t, dur):
        u = t / dur
        swing.rotation_euler = (0.55 * math.sin(t * 2 * math.pi / 3.6), 0, 0)
        for k, i in kites:
            k.rotation_euler = (0.2 * math.sin(t * 1.3 + i), 0.25 * math.sin(t * 0.9 + 2 * i), 0.3 * math.sin(t * 0.7 + i))
            k.location.z = 14 + 3 * (i % 3) + 0.6 * math.sin(t * 0.8 + i)
        aim(cam, lerp((1.0, -10, 1.2), (-1.5, -7, 1.6), ease(u)), lerp((0, 4, 6.5), (0, 20, 11), ease(u)))
    return update


# ------------------------------------------------------------------ 18 the bus home: a stream of lights up a switchback
def set_bus(sc, A):
    world(sky=[(0.0, (0.05, 0.05, 0.1)), (0.3, (0.012, 0.015, 0.04)), (1.0, (0.002, 0.003, 0.01))], strength=1.0)
    hdri_light("dikhololo_night", 0.6)
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=160, y_subdivisions=160, size=200); hill = bpy.context.object
    tx = bpy.data.textures.new("h", "CLOUDS"); tx.noise_scale = 2.0
    dm = hill.modifiers.new("d", "DISPLACE"); dm.texture = tx; dm.strength = 3.0
    hill.data.materials.append(mat("hillb", (0.02, 0.025, 0.02), rough=0.95))
    slope = prim("cone", "mountain", mat("mt", (0.015, 0.016, 0.018), rough=0.9), radius1=60, radius2=3, depth=30, vertices=64, location=(0, 70, 15))
    # a zig-zag road up the mountain face
    road = []
    for i in range(9):
        z = 1 + i * 3.0; r = 60 - 57 * z / 30 + 0.8; side = 1 if i % 2 == 0 else -1
        for s in np.linspace(-1, 1, 12) * side:
            a = math.pi * 1.5 + s * 0.45
            road.append(Vector((r * math.cos(a) * 0.95, 70 + r * math.sin(a) * 0.95, z + (s * side + 1) * 1.5)))
    curve_tube("road", [(*p, 1) for p in road], 0.25, mat("roadm", (0.04, 0.04, 0.04), rough=0.9))
    L = np.cumsum([0] + [(road[i + 1] - road[i]).length for i in range(len(road) - 1)])
    head_m = emission("headl", (1.0, 0.92, 0.75), 30); tail_m = emission("taill", (1.0, 0.1, 0.05), 20)
    cars = []
    for i in range(22):
        h = prim("uv_sphere", "car%d" % i, head_m if i % 3 else tail_m, radius=0.35)
        cars.append((h, i / 22.0))
    # the hero bus in the foreground: a lit box, luggage on the roof
    bus = bpy.data.objects.new("bus", None); link(bus)
    body = prim("cube", "busbody", noisy(mat("busm", (0.05, 0.2, 0.12), rough=0.5, coat=0.4), 20, 0.3, 0.1, 0.1), size=1); body.scale = (2.4, 10, 2.8); body.parent = bus; body.location = (0, 0, 1.9)
    for j in range(8):
        w = prim("cube", "bw%d" % j, emission("buswin", (1.0, 0.75, 0.45), 6), size=1, location=(-1.21, -4 + j * 1.1, 2.4)); w.scale = (0.02, 0.85, 0.8); w.parent = bus
    for j in range(6):
        bag = prim("cube", "bag%d" % j, mat("bag%d" % j, [(0.5, 0.1, 0.05), (0.1, 0.2, 0.5), (0.6, 0.5, 0.1), (0.2, 0.4, 0.2)][j % 4], rough=0.8), size=1, location=(0, -3.5 + j * 1.4, 3.6))
        bag.scale = (2.0, 1.1, 0.7); bevel(bag, 0.1, 2); bag.parent = bus
    hl = light("SPOT", (0, -5.2, 1.2), 3000, (1, 0.9, 0.75), size=0.2, spot=0.9); hl.parent = bus; hl.rotation_euler = (math.radians(95), 0, 0)
    volume_world(0.01, (0.8, 0.85, 1.0), 0.6)
    moon = light("SUN", (0, 0, 0), 1.2, (0.6, 0.7, 1.0), size=0.02); moon.rotation_euler = (math.radians(60), 0, math.radians(30))
    glare(sc, 1.0, 9, -0.45)
    sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = 1.0
    cam = camera((7.0, -4.0, 2.2), (0, 40, 9.0), 30, dof=20, fstop=4)

    def update(t, dur):
        u = t / dur
        for h, off in cars:
            s = ((off + t * 0.012) % 1.0) * L[-1]
            i = int(np.searchsorted(L, s)) - 1; i = max(0, min(len(road) - 2, i))
            f = (s - L[i]) / max(1e-6, L[i + 1] - L[i])
            h.location = road[i].lerp(road[i + 1], f) + Vector((0, 0, 0.4))
        bus.location = (3.2, lerp(2, 22, u), 0); bus.rotation_euler = (0, 0, 0)
        aim(cam, lerp((7.0, -4.0, 2.2), (6.5, -1.0, 2.6), ease(u)), lerp((0, 40, 9), (0, 50, 11), ease(u)))
    return update


# ------------------------------------------------------------------ 19 a lane of doorways at dusk, a lamp at each
def set_lane(sc, A):
    world(sky=[(0.0, (0.25, 0.12, 0.1)), (0.3, (0.06, 0.04, 0.08)), (1.0, (0.01, 0.01, 0.03))], strength=3.0)
    hdri_light("dikhololo_night", 0.6)
    light("AREA", (0, 26, 3), 400, (1.0, 0.6, 0.3), size=4, look=(0, 0, 1))
    ground = prim("plane", "lane", pbr("brick_pavement_02", noisy(mat("bricks", (0.2, 0.08, 0.05), rough=0.75), 25, 0.5, 0.2, 0.5), 0.7), size=60)
    rnd = np.random.default_rng(12)
    cols = [(0.5, 0.05, 0.05), (0.08, 0.18, 0.45), (0.55, 0.38, 0.08), (0.1, 0.35, 0.18), (0.4, 0.12, 0.35), (0.9, 0.85, 0.75), (0.08, 0.06, 0.05)]
    lights_ = []
    for side in (-1, 1):
        for i in range(10):
            y = i * 2.4 + (1.2 if side > 0 else 0)
            wall = prim("cube", "wall", pbr("castle_brick_02_red" if i % 2 else "clay_plaster", noisy(mat("w%d%d" % (side, i), (0.28, 0.1, 0.06), rough=0.85), 30, 0.4, 0.1, 0.3), 0.8, None if i % 2 else (0.75, 0.5, 0.4)), size=1, location=(side * 2.2, y, 2.5)); wall.scale = (0.4, 2.3, 5)
            door = prim("cube", "door", noisy(mat("d%d%d" % (side, i), cols[(i + (side > 0) * 3) % len(cols)], rough=0.6), 40, 0.3, 0.1, 0.3), size=1, location=(side * 1.99, y, 0.95)); door.scale = (0.05, 0.9, 1.9)
            frame = prim("cube", "frame", noisy(mat("fr", (0.06, 0.03, 0.015), rough=0.6), 60, 0.3, 0.1, 0.4), size=1, location=(side * 1.98, y, 1.0)); frame.scale = (0.06, 1.15, 2.15)
            win = prim("cube", "win", emission("lw%d%d" % (side, i), (1, 0.6, 0.25), 3 + 4 * rnd.random()), size=1, location=(side * 1.99, y, 3.3)); win.scale = (0.03, 0.6, 0.7)
            d, fl, li = diyo("dl%d%d" % (side, i), (side * 1.75, y, 0.0), 2.0, 70, 6.0)
            lights_.append((fl, li, rnd.random() * 9))
            for k in range(3):
                marigold("mgl", (side * 1.95, y - 0.4 + 0.4 * k, 2.05), 0.06)
    volume_world(0.02, (1, 0.85, 0.75), 0.5)
    glare(sc, 1.0, 8, -0.5)
    cam = camera((0, -3, 1.4), (0, 20, 1.2), 32, dof=6, fstop=2.4)

    def update(t, dur):
        u = t / dur
        for fl, li, s in lights_:
            f = flicker(t, s); fl.scale = (0.75, 0.75, 2.2 * f); li.data.energy = 6.0 * f
        aim(cam, lerp((0, -3, 1.2), (0.0, 6.5, 1.1), ease(u)), lerp((0, 20, 1.0), (0, 26, 0.9), ease(u)))
        cam.data.dof.focus_distance = 4.0
    return update
