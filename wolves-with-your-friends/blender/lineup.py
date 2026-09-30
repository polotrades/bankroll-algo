"""Full-cast lineup: loads cast.blend and brings in the two heroes from heroes.blend."""
import os
import bpy
from mathutils import Vector

D = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.open_mainfile(filepath=os.path.join(D, "cast.blend"))
with bpy.data.libraries.load(os.path.join(D, "heroes.blend")) as (src, dst):
    dst.objects = [n for n in src.objects if not n.startswith(("Plane", "Camera", "Area", "Title"))]
for o in dst.objects:
    if o:
        bpy.context.scene.collection.objects.link(o)
bpy.data.objects["RookieBroker"].location.x = -4.9
bpy.data.objects["TheChairman"].location.x = 4.9
sc = bpy.context.scene
cam = sc.camera
cam.data.lens = 28
cam.location = (0, -11.5, 2.3)
cam.rotation_mode = "QUATERNION"
cam.rotation_quaternion = (Vector((0, 0, 1.25)) - cam.location).to_track_quat("-Z", "Y")
sc.render.resolution_x, sc.render.resolution_y = 1800, 800
sc.cycles.samples = 32
sc.render.filepath = os.path.join(D, "renders", "full_cast.png")
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(D, "full_cast.blend"))
print("DONE")
