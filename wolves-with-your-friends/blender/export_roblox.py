"""Export every character as a Roblox-ready FBX: one mesh, under the triangle limit, colors baked to one texture.

Run after lineup.py:  python3 export_roblox.py
Writes export/<Character>.fbx and export/<Character>.png
"""
import os

import bpy

D = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(D, "export")
os.makedirs(OUT, exist_ok=True)
MAX_TRIS = 18000  # Roblox MeshParts allow up to 20k triangles
TEX = 1024
CHARACTERS = ["RookieBroker", "Intern", "CryptoBro", "CEO", "SecurityGuard", "Receptionist", "TheChairman"]

bpy.ops.wm.open_mainfile(filepath=os.path.join(D, "full_cast.blend"))
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 1
scene.cycles.device = "CPU"


def descendants(obj):
    for c in obj.children:
        yield c
        yield from descendants(c)


def bake_one(name):
    root = bpy.data.objects[name]
    offset = root.matrix_world.translation.copy()
    parts = []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    sources = [o for o in descendants(root) if o.type in {"MESH", "FONT"}]
    for o in sources:
        for m in o.modifiers:
            if m.name == "Outline":
                m.show_viewport = False
                m.show_render = False
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for o in sources:
        ev = o.evaluated_get(depsgraph)
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=depsgraph)
        # keep only real materials (drop the outline slot)
        keep = [s for s in me.materials if s and s.name != "Outline"]
        me.materials.clear()
        for s in keep:
            me.materials.append(s)
        me.transform(o.matrix_world)
        me.transform(__import__("mathutils").Matrix.Translation(-offset))
        new = bpy.data.objects.new(o.name + "_x", me)
        scene.collection.objects.link(new)
        parts.append(new)
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name

    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if tris > MAX_TRIS:
        dec = obj.modifiers.new("Decimate", "DECIMATE")
        dec.ratio = MAX_TRIS / tris * 0.95
        bpy.ops.object.modifier_apply(modifier=dec.name)
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.004)
    bpy.ops.object.mode_set(mode="OBJECT")

    img = bpy.data.images.new(name + "_tex", TEX, TEX)
    for mat in obj.data.materials:
        nt = mat.node_tree
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = img
        nt.nodes.active = node
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.use_pass_color = True
    scene.render.bake.margin = 4
    bpy.ops.object.bake(type="DIFFUSE")
    img.filepath_raw = os.path.join(OUT, name + ".png")
    img.file_format = "PNG"
    img.save()

    # one clean material that points at the baked texture
    baked = bpy.data.materials.new(name + "_baked")
    baked.use_nodes = True
    tex = baked.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = img
    baked.node_tree.links.new(tex.outputs["Color"], baked.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
    obj.data.materials.clear()
    obj.data.materials.append(baked)

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.export_scene.fbx(filepath=os.path.join(OUT, name + ".fbx"), use_selection=True, apply_unit_scale=True,
                             path_mode="COPY", embed_textures=True, mesh_smooth_type="FACE")
    print(f"exported {name}: {tris} triangles")
    obj.hide_render = True


for n in CHARACTERS:
    bake_one(n)
print("DONE")
