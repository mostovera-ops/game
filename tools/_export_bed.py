"""
Пересобирает ТОЛЬКО public/assets/props/raised_bed.glb.

Зачем отдельный скрипт, а не полный прогон _build_and_export.py:
полный прогон переставляет сцену (теплица, фудтрак, лавки, дорожка уезжают
на позиции из скриптов, которые расходятся с закоммиченным
scene-layout.json). Грядка же — самостоятельный пропс: её геометрия
целиком задаётся add_raised_bed() и от расстановки сцены не зависит.

Геометрия совпадает с blender_scene_scripts.py::add_raised_bed —
держи их в согласии.

Запуск:
    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python tools/_export_bed.py
"""
import os
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "assets", "props", "raised_bed.glb")

# --- те же константы, что в blender_scene_scripts.py -----------------------
SOIL_LIFT = 0.015
BED_H = 0.28
W, D = 1.6, 0.6


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def make_mat(name, rgb):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = False
    mat.diffuse_color = (*rgb, 1.0)
    return mat


def shade_flat(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = False


def add_cube(loc, scale, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    shade_flat(obj)
    return obj


def bbox_base_center(obj):
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    xs = [c.x for c in corners]
    ys = [c.y for c in corners]
    zs = [c.z for c in corners]
    return Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)))


clear_scene()

mat_bed_wood = make_mat("BedWood", (0.42, 0.28, 0.16))
mat_soil = make_mat("Soil", (0.28, 0.18, 0.12))

frame = add_cube((0, 0, BED_H / 2), (W, D, BED_H), mat_bed_wood)

# Верх почвы выше верха рамки на SOIL_LIFT: совпадающие грани дают z-fighting.
soil_h = BED_H * 0.5
soil_z = BED_H + SOIL_LIFT - soil_h / 2
soil = add_cube((0, 0, soil_z), (W * 0.92, D * 0.85, soil_h), mat_soil)

bpy.ops.object.select_all(action="DESELECT")
frame.select_set(True)
soil.select_set(True)
bpy.context.view_layer.objects.active = frame
bpy.ops.object.join()
bed = bpy.context.active_object
bed.name = "RaisedBed"

# Origin в основание bbox — как это делает export_prop() в 08_export.py.
bed.location = bed.location - bbox_base_center(bed)
bpy.context.view_layer.update()
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

bpy.ops.object.select_all(action="DESELECT")
bed.select_set(True)
bpy.context.view_layer.objects.active = bed
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
)

tris = sum(len(p.vertices) - 2 for p in bed.data.polygons)
print("[bed] экспортирована грядка: {} тр., верх почвы z={:.3f}".format(
    tris, BED_H + SOIL_LIFT))
