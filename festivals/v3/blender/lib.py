"""Blender (bpy) helpers for the v3 festival films and stills: scene setup, materials, procedural models.
Everything is built from code; nothing is loaded from .blend files. Units: metres, Z up."""
import math, random
import bpy, bmesh
import numpy as np
from mathutils import Vector, Euler, Matrix

# palette (linear-ish sRGB triples, picked by eye for AgX)
INK = (0.006, 0.004, 0.004)
TIKA = (0.60, 0.015, 0.02)
VERMILION = (0.80, 0.06, 0.02)
MARIGOLD = (1.0, 0.36, 0.02)
BRASS = (0.92, 0.62, 0.26)
GOLD = (1.0, 0.71, 0.29)
CLAY = (0.42, 0.16, 0.07)
JAMARA = (0.85, 0.78, 0.22)
SNOW = (0.85, 0.88, 0.95)


# ---------------------------------------------------------------- scene
def reset(w=1080, h=1920, samples=64, engine="CYCLES"):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = engine
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = w, h, 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.render.film_transparent = False
    sc.render.use_persistent_data = True
    try:
        sc.view_settings.view_transform = "AgX"
        sc.view_settings.look = "AgX - Punchy"
    except TypeError:
        sc.view_settings.view_transform = "Filmic"
        sc.view_settings.look = "High Contrast"
    if engine == "CYCLES":
        cy = sc.cycles
        cy.samples = samples
        cy.use_adaptive_sampling = True
        cy.adaptive_threshold = 0.02
        cy.use_denoising = True
        try: cy.denoiser = "OPENIMAGEDENOISE"
        except TypeError: pass
        cy.max_bounces, cy.diffuse_bounces, cy.glossy_bounces, cy.transmission_bounces = 8, 3, 4, 6
        cy.volume_bounces = 1
        cy.caustics_reflective = cy.caustics_refractive = False
        cy.blur_glossy = 1.0
        _gpu(cy)
    world(INK, 0.0)
    return sc


def _gpu(cy):
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA", "HIP", "ONEAPI"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            devs = [d for d in prefs.devices if d.type == kind]
            if devs:
                for d in prefs.devices: d.use = d.type == kind
                cy.device = "GPU"
                print("cycles device:", kind, [d.name for d in devs])
                return
        except TypeError:
            continue
    cy.device = "CPU"
    print("cycles device: CPU")


def world(color=INK, strength=1.0, sky=None):
    w = bpy.data.worlds.get("W") or bpy.data.worlds.new("W")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld"); bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    if sky:  # gradient sky: list of (pos, rgb) along view elevation
        tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs[1].default_value, mr.inputs[2].default_value = -0.15, 0.9
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        _ramp(ramp, sky)
        nt.links.new(tc.outputs["Generated"], sep.inputs[0])
        nrm = nt.nodes.new("ShaderNodeVectorMath"); nrm.operation = "NORMALIZE"
        nt.links.new(tc.outputs["Generated"], nrm.inputs[0])
        nt.links.new(nrm.outputs[0], sep.inputs[0])
        nt.links.new(sep.outputs["Z"], mr.inputs[0]); nt.links.new(mr.outputs[0], ramp.inputs[0])
        nt.links.new(ramp.outputs[0], bg.inputs[0])
    else:
        bg.inputs[0].default_value = (*color, 1)
    nt.links.new(bg.outputs[0], out.inputs[0])
    return w


def _ramp(ramp, stops):
    el = ramp.color_ramp.elements
    while len(el) > 1: el.remove(el[-1])
    el[0].position = stops[0][0]; el[0].color = (*stops[0][1], 1)
    for p, c in stops[1:]:
        e = el.new(p); e.color = (*c, 1)


def volume_world(density=0.02, color=(1, 1, 1), anisotropy=0.4):
    """Haze that catches light shafts (a big cube with volume scatter; cheaper and more controllable than world volume)."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object; o.name = "haze"; o.scale = (60, 60, 40)
    m = bpy.data.materials.new("haze"); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); v = nt.nodes.new("ShaderNodeVolumePrincipled")
    v.inputs["Density"].default_value = density; v.inputs["Color"].default_value = (*color, 1)
    v.inputs["Anisotropy"].default_value = anisotropy
    nt.links.new(v.outputs[0], out.inputs["Volume"])
    o.data.materials.append(m); o.visible_shadow = False
    return o, v


def camera(loc, look, lens=50, dof=None, fstop=2.0, name="cam"):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.sensor_width = 36; cd.sensor_fit = "AUTO"
    cd.clip_start, cd.clip_end = 0.01, 5000
    c = bpy.data.objects.new(name, cd); bpy.context.scene.collection.objects.link(c)
    bpy.context.scene.camera = c
    aim(c, loc, look)
    if dof is not None:
        cd.dof.use_dof = True; cd.dof.focus_distance = dof; cd.dof.aperture_fstop = fstop
    return c


def aim(cam, loc, look, roll=0.0):
    cam.location = Vector(loc)
    d = Vector(look) - Vector(loc)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    if roll: cam.rotation_euler.rotate_axis("Z", roll)


def light(kind, loc, energy, color=(1, 1, 1), size=0.1, look=None, spot=None, name=None):
    ld = bpy.data.lights.new(name or kind, kind); ld.energy = energy; ld.color = color
    if kind in ("POINT", "SPOT"): ld.shadow_soft_size = size
    if kind == "AREA": ld.size = size
    if kind == "SUN": ld.angle = size
    if kind == "SPOT" and spot: ld.spot_size = spot; ld.spot_blend = 0.6
    o = bpy.data.objects.new(ld.name, ld); bpy.context.scene.collection.objects.link(o); o.location = loc
    if look is not None:
        o.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o


# ---------------------------------------------------------------- materials
def mat(name, color=(0.8, 0.8, 0.8), rough=0.5, metal=0.0, emit=None, emit_strength=0.0, alpha=1.0,
        transmission=0.0, sss=0.0, coat=0.0, aniso=0.0, ior=1.45):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["IOR"].default_value = ior
    _set(p, ["Transmission Weight", "Transmission"], transmission)
    _set(p, ["Subsurface Weight", "Subsurface"], sss)
    _set(p, ["Coat Weight", "Clearcoat"], coat)
    _set(p, ["Anisotropic"], aniso)
    if emit is not None:
        _set(p, ["Emission Color", "Emission"], (*emit, 1))
        _set(p, ["Emission Strength"], emit_strength)
    if alpha < 1:
        p.inputs["Alpha"].default_value = alpha
    return m


def _set(node, names, v):
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = v; return


def emission(name, color, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); e = nt.nodes.new("ShaderNodeEmission")
    e.inputs[0].default_value = (*color, 1); e.inputs[1].default_value = strength
    nt.links.new(e.outputs[0], out.inputs[0]); return m


def noisy(m, scale=40.0, amount=0.25, rough_var=0.25, bump=0.15, detail=8.0):
    """Break up a Principled material: colour variation, roughness variation and micro bump from noise."""
    nt = m.node_tree; p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord"); nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale; nz.inputs["Detail"].default_value = detail
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    base = p.inputs["Base Color"].default_value[:3]
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
    mix.inputs[0].default_value = amount
    mix.inputs[6].default_value = (*base, 1)
    nt.links.new(nz.outputs["Color"], mix.inputs[7])
    nt.links.new(mix.outputs[2], p.inputs["Base Color"])
    r0 = p.inputs["Roughness"].default_value
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs[3].default_value = max(0, r0 - rough_var); mr.inputs[4].default_value = min(1, r0 + rough_var)
    nt.links.new(nz.outputs["Fac"], mr.inputs[0]); nt.links.new(mr.outputs[0], p.inputs["Roughness"])
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs[0], p.inputs["Normal"])
    return m


def image_mat(name, path, emit=0.0, rough=0.6, alpha=False):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; p = nt.nodes["Principled BSDF"]
    tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = bpy.data.images.load(path)
    nt.links.new(tx.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = rough
    if emit:
        _set(p, ["Emission Strength"], emit)
        nt.links.new(tx.outputs["Color"], p.inputs["Emission Color"] if "Emission Color" in p.inputs else p.inputs["Emission"])
    if alpha:
        nt.links.new(tx.outputs["Alpha"], p.inputs["Alpha"])
    return m, tx


def flame_mat(name="flame", strength=40.0):
    """Teardrop flame: hot white core -> marigold rim, by generated Z; transparent edges via fresnel."""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    lw = nt.nodes.new("ShaderNodeLayerWeight"); lw.inputs[0].default_value = 0.35
    ramp = nt.nodes.new("ShaderNodeValToRGB"); _ramp(ramp, [(0.0, (1, 0.93, 0.75)), (0.45, (1, 0.55, 0.12)), (1.0, (0.9, 0.18, 0.02))])
    nt.links.new(lw.outputs["Facing"], ramp.inputs[0])
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs[1].default_value = strength
    nt.links.new(ramp.outputs[0], em.inputs[0])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    inv = nt.nodes.new("ShaderNodeMath"); inv.operation = "POWER"; inv.inputs[1].default_value = 2.2
    nt.links.new(lw.outputs["Facing"], inv.inputs[0])
    nt.links.new(inv.outputs[0], mix.inputs[0]); nt.links.new(em.outputs[0], mix.inputs[1]); nt.links.new(tr.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    return m, em


def brass(name="brass", tarnish=0.25):
    return noisy(mat(name, BRASS, rough=0.22, metal=1.0, aniso=0.3), scale=18, amount=tarnish, rough_var=0.12, bump=0.05)


def gold(name="gold"):
    return noisy(mat(name, GOLD, rough=0.16, metal=1.0), scale=30, amount=0.12, rough_var=0.06, bump=0.02)


def clay(name="clay"):
    return noisy(mat(name, CLAY, rough=0.85), scale=60, amount=0.35, rough_var=0.1, bump=0.35)


# ---------------------------------------------------------------- geometry
def link(obj, coll=None):
    (coll or bpy.context.scene.collection).objects.link(obj); return obj


def mesh_obj(name, verts, faces, m=None, smooth=True):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces]); me.update()
    o = link(bpy.data.objects.new(name, me))
    if m: me.materials.append(m)
    if smooth:
        for p in me.polygons: p.use_smooth = True
    return o


def lathe(name, profile, seg=96, m=None, close_top=False, close_bottom=False):
    """Revolve a (r, z) profile around Z. Profile from bottom to top."""
    V = []; F = []; n = len(profile)
    for i in range(seg):
        a = 2 * math.pi * i / seg; ca, sa = math.cos(a), math.sin(a)
        for r, z in profile: V.append((r * ca, r * sa, z))
    for i in range(seg):
        j = (i + 1) % seg
        for k in range(n - 1):
            F.append((i * n + k, j * n + k, j * n + k + 1, i * n + k + 1))
    if close_bottom:
        V.append((0, 0, profile[0][1])); c = len(V) - 1
        for i in range(seg): F.append((c, ((i + 1) % seg) * n, i * n))
    if close_top:
        V.append((0, 0, profile[-1][1])); c = len(V) - 1
        for i in range(seg): F.append((c, i * n + n - 1, ((i + 1) % seg) * n + n - 1))
    o = mesh_obj(name, V, F, m)
    return o


def smooth_profile(pts, steps=6):
    """Catmull-Rom through (r, z) control points."""
    P = [pts[0]] + list(pts) + [pts[-1]]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = map(np.array, (P[i - 1], P[i], P[i + 1], P[i + 2]))
        for s in range(steps):
            t = s / steps
            out.append(tuple(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)))
    out.append(tuple(pts[-1])); return out


def subsurf(o, levels=2):
    md = o.modifiers.new("ss", "SUBSURF"); md.levels = md.render_levels = levels; return o


def solidify(o, t=0.01):
    md = o.modifiers.new("sol", "SOLIDIFY"); md.thickness = t; return o


def bevel(o, w=0.005, seg=2):
    md = o.modifiers.new("bev", "BEVEL"); md.width = w; md.segments = seg; return o


def prim(kind, name, m=None, **kw):
    getattr(bpy.ops.mesh, "primitive_%s_add" % kind)(**kw)
    o = bpy.context.object; o.name = name
    if m: o.data.materials.append(m)
    return o


def curve_tube(name, pts, radius=0.01, m=None, taper=None, res=12, cyclic=False):
    cd = bpy.data.curves.new(name, "CURVE"); cd.dimensions = "3D"; cd.bevel_depth = radius; cd.bevel_resolution = 4
    cd.resolution_u = res; cd.use_fill_caps = True
    sp = cd.splines.new("NURBS" if len(pts) > 3 else "POLY"); sp.points.add(len(pts) - 1)
    for p, q in zip(sp.points, pts):
        p.co = (*q[:3], 1.0); p.radius = q[3] if len(q) > 3 else 1.0
    sp.use_endpoint_u = True; sp.order_u = min(4, len(pts)); sp.use_cyclic_u = cyclic
    o = link(bpy.data.objects.new(name, cd))
    if m: cd.materials.append(m)
    return o


def instance_points(name, src, points, rots=None, scales=None):
    """Instance one mesh at many points with per-instance rotation/scale (via a vertex mesh + geometry nodes)."""
    me = bpy.data.meshes.new(name + "_pts"); me.from_pydata([tuple(p) for p in points], [], []); me.update()
    n = len(points)
    rots = np.zeros((n, 3)) if rots is None else np.asarray(rots, float)
    scales = np.ones((n, 3)) if scales is None else np.asarray(scales, float)
    if scales.ndim == 1: scales = np.repeat(scales[:, None], 3, 1)
    a = me.attributes.new("rot", "FLOAT_VECTOR", "POINT"); a.data.foreach_set("vector", rots.ravel())
    b = me.attributes.new("scl", "FLOAT_VECTOR", "POINT"); b.data.foreach_set("vector", scales.ravel())
    o = link(bpy.data.objects.new(name, me))
    ng = bpy.data.node_groups.new(name + "_gn", "GeometryNodeTree")
    _gn_io(ng)
    nodes, links = ng.nodes, ng.links
    gi = nodes["Group Input"]; go = nodes["Group Output"]
    iop = nodes.new("GeometryNodeInstanceOnPoints"); oi = nodes.new("GeometryNodeObjectInfo")
    oi.inputs[0].default_value = src; oi.transform_space = "ORIGINAL"
    ra = nodes.new("GeometryNodeInputNamedAttribute"); ra.data_type = "FLOAT_VECTOR"; ra.inputs[0].default_value = "rot"
    sa = nodes.new("GeometryNodeInputNamedAttribute"); sa.data_type = "FLOAT_VECTOR"; sa.inputs[0].default_value = "scl"
    real = nodes.new("GeometryNodeRealizeInstances")
    links.new(gi.outputs[0], iop.inputs["Points"]); links.new(oi.outputs["Geometry"], iop.inputs["Instance"])
    links.new(ra.outputs["Attribute"], iop.inputs["Rotation"]); links.new(sa.outputs["Attribute"], iop.inputs["Scale"])
    links.new(iop.outputs[0], real.inputs[0]); links.new(real.outputs[0], go.inputs[0])
    md = o.modifiers.new("gn", "NODES"); md.node_group = ng
    src.hide_render = True; src.hide_viewport = True
    for s in src.data.materials: o.data.materials.append(s)
    return o


def _gn_io(ng):
    if hasattr(ng, "interface"):
        ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
        ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    else:
        ng.inputs.new("NodeSocketGeometry", "Geometry"); ng.outputs.new("NodeSocketGeometry", "Geometry")
    ng.nodes.new("NodeGroupInput"); ng.nodes.new("NodeGroupOutput")


def text_plane(name, path, width, loc=(0, 0, 0), rot=(math.pi / 2, 0, 0), emit=0.0, alpha=True):
    img = bpy.data.images.load(path); ar = img.size[1] / max(1, img.size[0])
    o = prim("plane", name, size=1, location=loc, rotation=rot); o.scale = (width, width * ar, 1)
    m, tx = image_mat(name, path, emit=emit, alpha=alpha); tx.image = img
    o.data.materials.append(m)
    return o


# ---------------------------------------------------------------- props shared by several shots
def diyo(name="diyo", loc=(0, 0, 0), scale=1.0, flame_strength=60.0, light_w=6.0):
    """A clay diyo (lathe), a ghee wick and a teardrop flame with its own warm light. Returns (root, flame, light)."""
    prof = smooth_profile([(0.0, 0.0), (0.03, 0.0), (0.045, 0.006), (0.06, 0.022), (0.064, 0.03), (0.058, 0.031), (0.045, 0.018), (0.0, 0.016)], 5)
    body = lathe(name, prof, 64, clay(name + "_clay"))
    body.scale = (scale, scale * 0.82, scale); body.location = loc
    lip = prim("uv_sphere", name + "_lip", mat(name + "_ghee", (0.9, 0.7, 0.3), rough=0.2), radius=0.006, location=(0.05, 0, 0.026))
    lip.scale = (2.2, 0.8, 0.5); lip.parent = body
    fl = prim("uv_sphere", name + "_flame", None, radius=0.01, location=(0.055, 0, 0.045), segments=24, ring_count=16)
    fl.scale = (0.75, 0.75, 2.2); fl.parent = body
    fm, em = flame_mat(name + "_fm", flame_strength); fl.data.materials.append(fm); fl.visible_shadow = False
    for p in fl.data.polygons: p.use_smooth = True
    li = light("POINT", (0, 0, 0), light_w * scale * scale, (1.0, 0.55, 0.2), size=0.006 * scale)
    li.parent = fl; li.location = (0, 0, 0.0)
    return body, fl, li


def flicker(t, seed=0):
    return 0.86 + 0.08 * math.sin(t * 23.0 + seed) + 0.05 * math.sin(t * 37.0 + 2 * seed) + 0.03 * math.sin(t * 61.0 + 3 * seed)


def kalash(name="kalash", loc=(0, 0, 0), scale=1.0):
    prof = smooth_profile([(0, 0), (0.05, 0), (0.06, 0.01), (0.1, 0.06), (0.115, 0.11), (0.1, 0.16), (0.055, 0.2), (0.045, 0.215), (0.06, 0.235), (0.062, 0.24), (0.045, 0.24)], 6)
    o = lathe(name, prof, 96, brass(name + "_b")); o.location = loc; o.scale = (scale,) * 3
    # mango leaves fanned out of the mouth and a red-cloth-wrapped coconut
    lm = noisy(mat(name + "_leaf", (0.05, 0.2, 0.03), rough=0.45, sss=0.1), 80, 0.2, 0.1, 0.05)
    for i in range(7):
        a = 2 * math.pi * i / 7
        lf = _leaf(name + "_leaf%d" % i, 0.11, 0.035, lm)
        lf.parent = o; lf.location = (0.03 * math.cos(a), 0.03 * math.sin(a), 0.235)
        lf.rotation_euler = (0, 1.0, a)
    co = prim("uv_sphere", name + "_coconut", noisy(mat(name + "_cloth", TIKA, rough=0.7, sss=0.05), 120, 0.3, 0.1, 0.2), radius=0.055, location=(0, 0, 0.29))
    co.scale = (1, 1, 1.15); co.parent = o
    for p in co.data.polygons: p.use_smooth = True
    return o


def _leaf(name, length, width, m, n=10):
    V = []; F = []
    for i in range(n + 1):
        t = i / n; w = width * math.sin(math.pi * t) ** 0.8; z = 0.15 * length * math.sin(math.pi * t)
        V += [(t * length, -w, z - abs(w) * 0.2), (t * length, 0, z), (t * length, w, z - abs(w) * 0.2)]
    for i in range(n):
        a = i * 3
        F += [(a, a + 3, a + 4, a + 1), (a + 1, a + 4, a + 5, a + 2)]
    return mesh_obj(name, V, F, m)


def marigold(name, loc, r=0.03, m=None):
    """A ball of petals: an icosphere with displaced spikes (cheap, reads well at distance)."""
    m = m or noisy(mat("marigold", MARIGOLD, rough=0.55, sss=0.25), 300, 0.35, 0.1, 0.6)
    o = prim("ico_sphere", name, m, subdivisions=3, radius=r, location=loc)
    tx = bpy.data.textures.new(name + "_tx", "VORONOI"); tx.noise_scale = r * 0.3
    d = o.modifiers.new("d", "DISPLACE"); d.texture = tx; d.strength = r * 0.35
    for p in o.data.polygons: p.use_smooth = True
    return o


def rice_heap(name, center, radius, height, n=2500, color=TIKA, seed=1):
    """Grains of red tika rice heaped in a dome (instanced capsules)."""
    rnd = np.random.default_rng(seed)
    g = prim("uv_sphere", name + "_grain", noisy(mat(name + "_m", color, rough=0.45, sss=0.2), 400, 0.25, 0.1, 0.1), radius=0.0022, segments=10, ring_count=6)
    g.scale = (1, 0.45, 0.45)
    for p in g.data.polygons: p.use_smooth = True
    bpy.ops.object.transform_apply(scale=True)
    r = radius * np.sqrt(rnd.random(n)); a = rnd.random(n) * 2 * np.pi
    z = height * (1 - (r / radius) ** 2) * rnd.uniform(0.7, 1.0, n)
    P = np.stack([center[0] + r * np.cos(a), center[1] + r * np.sin(a), center[2] + z], 1)
    R = rnd.random((n, 3)) * np.pi * 2
    return instance_points(name, g, P, R, rnd.uniform(0.8, 1.25, n))


def jamara(name, center, radius, n=900, height=0.25, color=JAMARA, seed=3):
    """Pale-yellow barley shoots grown in the dark: instanced bent blades. Returns (obj, blade_src) so growth can scale them."""
    rnd = np.random.default_rng(seed)
    V = []; F = []; seg = 8
    for i in range(seg + 1):
        t = i / seg; w = 0.0025 * (1 - t * 0.85); x = 0.04 * t * t
        V += [(x - w * 0, -w, t), (x, w, t)]
    for i in range(seg): a = i * 2; F.append((a, a + 2, a + 3, a + 1))
    m = noisy(mat(name + "_m", color, rough=0.5, sss=0.35), 50, 0.3, 0.1, 0.0)
    src = mesh_obj(name + "_blade", V, F, m)
    solidify(src, 0.0006)
    r = radius * np.sqrt(rnd.random(n)); a = rnd.random(n) * 2 * np.pi
    P = np.stack([center[0] + r * np.cos(a), center[1] + r * np.sin(a), np.full(n, center[2])], 1)
    R = np.stack([rnd.normal(0, 0.12, n), rnd.normal(0, 0.12, n), rnd.random(n) * 2 * np.pi], 1)
    hs = height * rnd.uniform(0.6, 1.1, n)
    S = np.stack([np.ones(n) * 1.0, np.ones(n), hs], 1)
    return instance_points(name, src, P, R, S), src


def ease(t):  # house ease-in-out (quintic)
    t = min(1.0, max(0.0, t)); return t * t * t * (t * (6 * t - 15) + 10)


def ease_out(t):
    t = min(1.0, max(0.0, t)); return 1 - (1 - t) ** 3


def lerp(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b)) if isinstance(a, (tuple, list)) else a + (b - a) * t


def glare(scene, threshold=1.2, size=8, mix=-0.6, streaks=False):
    """Compositor bloom (Glare node, Fog Glow); works headless."""
    scene.use_nodes = True; nt = scene.node_tree; nt.nodes.clear()
    rl = nt.nodes.new("CompositorNodeRLayers"); co = nt.nodes.new("CompositorNodeComposite")
    g = nt.nodes.new("CompositorNodeGlare")
    try: g.glare_type = "STREAKS" if streaks else "FOG_GLOW"
    except TypeError: pass
    for attr, v in (("threshold", threshold), ("size", size), ("mix", mix), ("quality", "HIGH")):
        if hasattr(g, attr):
            try: setattr(g, attr, v)
            except Exception: pass
    for nm, v in (("Threshold", threshold), ("Size", size / 9.0)):
        if nm in g.inputs:
            try: g.inputs[nm].default_value = v
            except Exception: pass
    nt.links.new(rl.outputs["Image"], g.inputs["Image"]); nt.links.new(g.outputs["Image"], co.inputs["Image"])
    return g


# ---------------------------------------------------------------- Poly Haven (CC0) lighting + textures, optional
import os as _os
PH = _os.path.join(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))), "build", "ph")


def hdri_light(name, strength=0.4, rot=0.0):
    """Light and reflections from a real HDRI while the camera keeps seeing the set's own background
    (Light Path 'Is Camera Ray' switches between them). No-op if the HDRI is not downloaded."""
    path = f"{PH}/hdri/{name}.hdr"
    if not _os.path.exists(path): return False
    w = bpy.context.scene.world; nt = w.node_tree
    out = next(n for n in nt.nodes if n.type == "OUTPUT_WORLD"); cam_side = out.inputs[0].links[0].from_socket
    env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(path)
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Rotation"].default_value[2] = rot
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"]); nt.links.new(mp.outputs[0], env.inputs["Vector"])
    bg = nt.nodes.new("ShaderNodeBackground"); bg.inputs["Strength"].default_value = strength
    nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    lp = nt.nodes.new("ShaderNodeLightPath"); mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0]); nt.links.new(bg.outputs[0], mix.inputs[1]); nt.links.new(cam_side, mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    return True


def hdri_sky(name, strength=1.0, rot=0.0):
    """The HDRI as the whole world, seen by the camera too (use pure-sky HDRIs)."""
    path = f"{PH}/hdri/{name}.hdr"
    if not _os.path.exists(path): return False
    w = bpy.context.scene.world; nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld"); env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(path)
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Rotation"].default_value[2] = rot
    bg = nt.nodes.new("ShaderNodeBackground"); bg.inputs["Strength"].default_value = strength
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"]); nt.links.new(mp.outputs[0], env.inputs["Vector"])
    nt.links.new(env.outputs["Color"], bg.inputs["Color"]); nt.links.new(bg.outputs[0], out.inputs[0])
    return True


def pbr(tex, fallback, scale=1.0, tint=None, bump=1.0):
    """A scanned PBR material (diffuse/roughness/normal, box-projected on object coordinates) or the fallback."""
    d = f"{PH}/tex/{tex}"
    if not _os.path.exists(f"{d}/diff.jpg"): return fallback
    m = bpy.data.materials.new("pbr_" + tex); m.use_nodes = True; nt = m.node_tree; p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (scale,) * 3
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    def img(kind, non_color):
        f = next((f"{d}/{kind}.{e}" for e in ("jpg", "png", "exr") if _os.path.exists(f"{d}/{kind}.{e}")), None)
        if not f: return None
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(f); t.projection = "BOX"; t.projection_blend = 0.25
        if non_color: t.image.colorspace_settings.name = "Non-Color"
        nt.links.new(mp.outputs[0], t.inputs["Vector"]); return t
    dt = img("diff", False); rt = img("rough", True); nm = img("nor", True)
    if tint is not None:
        mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "MULTIPLY"; mx.inputs[0].default_value = 1.0
        mx.inputs[7].default_value = (*tint, 1); nt.links.new(dt.outputs["Color"], mx.inputs[6]); nt.links.new(mx.outputs[2], p.inputs["Base Color"])
    else:
        nt.links.new(dt.outputs["Color"], p.inputs["Base Color"])
    if rt: nt.links.new(rt.outputs["Color"], p.inputs["Roughness"])
    if nm:
        n = nt.nodes.new("ShaderNodeNormalMap"); n.inputs["Strength"].default_value = bump
        nt.links.new(nm.outputs["Color"], n.inputs["Color"]); nt.links.new(n.outputs[0], p.inputs["Normal"])
    return m
