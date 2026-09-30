"""Shared helpers for building Wolves With Your Friends models in Blender."""
import math
import bpy
from mathutils import Matrix, Vector

OUTLINE = True


def skin(name, verts, edges, radii, material, parent=None, subsurf=2, **kw):
    """One continuous organic mesh grown from a stick skeleton (Skin modifier)."""
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, edges, [])
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    m = o.modifiers.new("Skin", "SKIN")
    m.use_smooth_shade = True
    data = me.skin_vertices[0].data
    for i, r in enumerate(radii):
        data[i].radius = r if isinstance(r, tuple) else (r, r)
    data[0].use_root = True
    return finish(o, material, parent, smooth=False, subsurf=subsurf, **kw)


def frame(name, parent, loc, fdir, xhint, scale=1.0):
    """Empty whose local -Z points along fdir (e.g. down the forearm) and local X toward xhint."""
    e = empty(name, loc)
    z = -Vector(fdir).normalized()
    x = Vector(xhint)
    x = (x - z * x.dot(z)).normalized()
    y = z.cross(x)
    e.rotation_mode = "QUATERNION"
    e.rotation_quaternion = Matrix((x, y, z)).transposed().to_quaternion()
    e.scale = (scale, scale, scale)
    if parent:
        e.parent = parent
    return e


def hand(name, parent, loc, fdir, material, side, scale=1.0, pose="relaxed", xhint=(1, 0, 0)):
    """Five-finger hand. Fingers run down local -Z, spread along Y (index at -Y), palm faces -side*X."""
    h = frame(name, parent, loc, fdir, xhint, scale)
    p = -side  # palm direction along local X
    verts = [(0, 0, 0.01), (0, 0, -0.055)]
    radii = [(0.026, 0.038), (0.03, 0.052)]
    edges = [(0, 1)]
    fingers = [(-0.036, (0.035, 0.028, 0.022)), (-0.012, (0.04, 0.031, 0.024)),
               (0.012, (0.037, 0.029, 0.022)), (0.034, (0.029, 0.022, 0.018))]
    for y, segs in fingers:
        if pose == "fist":
            pts = [(0, y, -0.1), (p * 0.018, y, -0.132), (p * 0.05, y, -0.128), (p * 0.056, y, -0.1)]
        else:
            z, x, pts = -0.1, 0.0, [(0, y * 1.05, -0.1)]
            for i, s in enumerate(segs):
                z -= s
                x += p * (0.004 + 0.006 * i)
                pts.append((x, y * (1.1 + 0.05 * i), z))
        base = len(verts)
        for i, pt in enumerate(pts):
            verts.append(pt)
            radii.append(0.014 - 0.0012 * i)
            edges.append((1 if i == 0 else base + i - 1, base + i))
    base = len(verts)
    if pose == "fist":
        thumb = [(p * 0.012, -0.045, -0.045), (p * 0.04, -0.05, -0.08), (p * 0.062, -0.035, -0.1)]
    else:
        thumb = [(p * 0.008, -0.048, -0.045), (p * 0.018, -0.07, -0.078), (p * 0.024, -0.08, -0.104)]
    for i, pt in enumerate(thumb):
        verts.append(pt)
        radii.append(0.017 - 0.002 * i)
        edges.append((1 if i == 0 else base + i - 1, base + i))
    skin(name + "Mesh", verts, edges, radii, material, h, subsurf=2, width=0.006)
    return h


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, rough=0.6, metal=0.0, emit=0.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = emit
    m.diffuse_color = (*color, 1)
    return m


def outline_mat():
    m = bpy.data.materials.get("Outline")
    if m:
        return m
    m = bpy.data.materials.new("Outline")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (0.03, 0.02, 0.02, 1)
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    lp = nt.nodes.new("ShaderNodeLightPath")
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    nt.links.new(lp.outputs["Is Camera Ray"], inv.inputs[1])
    mx = nt.nodes.new("ShaderNodeMath")
    mx.operation = "MAXIMUM"
    nt.links.new(geo.outputs["Backfacing"], mx.inputs[0])
    nt.links.new(inv.outputs[0], mx.inputs[1])
    # black rim only for camera rays hitting the far side of the hull; invisible to light
    nt.links.new(mx.outputs[0], mix.inputs["Fac"])
    nt.links.new(em.outputs[0], mix.inputs[1])
    nt.links.new(tr.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return m


def finish(o, material, parent=None, smooth=True, subsurf=0, outline=True, width=0.012):
    o.data.materials.append(material)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    if subsurf:
        s = o.modifiers.new("Sub", "SUBSURF")
        s.levels = subsurf
        s.render_levels = subsurf
    if OUTLINE and outline:
        o.data.materials.append(outline_mat())
        sol = o.modifiers.new("Outline", "SOLIDIFY")
        sol.thickness = width
        sol.offset = 1
        sol.use_flip_normals = True
        sol.material_offset = 1
    if parent:
        o.parent = parent
    return o


def sphere(name, r, loc, scale=(1, 1, 1), material=None, parent=None, rot=(0, 0, 0), **kw):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=r, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    return finish(o, material, parent, **kw)


def cube(name, size, loc, scale=(1, 1, 1), material=None, parent=None, rot=(0, 0, 0), bevel=0.02, **kw):
    bpy.ops.mesh.primitive_cube_add(size=size, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    if bevel:
        b = o.modifiers.new("Bevel", "BEVEL")
        b.width = bevel
        b.segments = 3
    kw.setdefault("smooth", False)
    return finish(o, material, parent, **kw)


def cone(name, r1, r2, depth, loc, material=None, parent=None, rot=(0, 0, 0), scale=(1, 1, 1), **kw):
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    return finish(o, material, parent, **kw)


def torus(name, major, minor, loc, material=None, parent=None, rot=(0, 0, 0), scale=(1, 1, 1), **kw):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=48,
                                     minor_segments=16, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    return finish(o, material, parent, **kw)


def _orient(o, p1, p2):
    p1, p2 = Vector(p1), Vector(p2)
    d = p2 - p1
    o.location = (p1 + p2) / 2
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    return d.length


def tube(name, r, p1, p2, material=None, parent=None, r2=None, **kw):
    """Tapered cylinder from p1 to p2."""
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=r, radius2=r if r2 is None else r2, depth=1)
    o = bpy.context.object
    o.name = name
    o.scale.z = _orient(o, p1, p2)
    return finish(o, material, parent, **kw)


def strip(name, p1, p2, width, thick, material=None, parent=None, **kw):
    """Flat ribbon (ties, straps) from p1 to p2, facing -Y."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    o.name = name
    length = _orient(o, p1, p2)
    o.scale = (width, thick, length)
    b = o.modifiers.new("Bevel", "BEVEL")
    b.width = min(width, thick) * 0.3
    b.segments = 2
    kw.setdefault("smooth", False)
    return finish(o, material, parent, **kw)


def text(name, body, loc, size, material, parent=None, rot=(math.radians(90), 0, 0), extrude=0.004):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.body = body
    o.data.size = size
    o.data.extrude = extrude
    o.data.align_x = "CENTER"
    o.data.align_y = "CENTER"
    o.data.materials.append(material)
    if parent:
        o.parent = parent
    return o


def empty(name, loc):
    bpy.ops.object.empty_add(location=loc)
    o = bpy.context.object
    o.name = name
    return o


def studio(cam_loc, target, lens=50, wall_color=(0.55, 0.42, 0.33), floor_color=(0.18, 0.2, 0.3)):
    """Warm, cartoony preview studio: carpet floor, wall, three lights, camera."""
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "Medium High Contrast" if "Medium High Contrast" in [
        i.identifier for i in sc.view_settings.bl_rna.properties["look"].enum_items] else "None"
    w = bpy.data.worlds.new("World")
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.9, 0.75, 0.6, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    bpy.context.object.data.materials.append(mat("Carpet", floor_color, 0.95))
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 4, 0), rotation=(math.radians(90), 0, 0))
    bpy.context.object.data.materials.append(mat("Wall", wall_color, 0.9))
    for loc, energy, size, color in [((-4, -5, 6), 420, 4, (1, 0.9, 0.8)),
                                     ((5, -3, 4), 160, 3, (0.8, 0.85, 1)),
                                     ((0, 3, 5), 220, 3, (1, 0.8, 0.6))]:
        bpy.ops.object.light_add(type="AREA", location=loc)
        l = bpy.context.object
        l.data.energy = energy
        l.data.size = size
        l.data.color = color
        l.rotation_mode = "QUATERNION"
        l.rotation_quaternion = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y")
    bpy.ops.object.camera_add(location=cam_loc)
    c = bpy.context.object
    c.data.lens = lens
    c.rotation_mode = "QUATERNION"
    c.rotation_quaternion = (Vector(target) - Vector(cam_loc)).to_track_quat("-Z", "Y")
    sc.camera = c
    return c


def render(path, x=1200, y=900, samples=48):
    sc = bpy.context.scene
    sc.render.resolution_x = x
    sc.render.resolution_y = y
    sc.cycles.samples = samples
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
