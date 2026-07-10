"""
Собирает и экспортирует ТОЛЬКО public/assets/props/seed_store.glb —
лавку семян, у которой герой покупает семена.

Отдельный скрипт, а не часть _build_and_export.py, по той же причине, что и
_export_bed.py: полный прогон переставляет сцену. Лавка — самостоятельный
пропс, от расстановки не зависит.

Лицом (прилавком) лавка смотрит в −Y (Blender), как дверь дома. После
Z-up → Y-up это +Z glTF — сторона, с которой стоит камера. В scene-layout.json
пропс кладётся с rotationY = 0.

Материалы (имена важны — по ним game/scene подменяет цвет из palette.json):
    StoreWood     каркас, стойки, задняя стенка
    StoreCounter  столешница
    StoreRoof     навес
    StoreAwning   подзор по переднему краю навеса
    StoreSign     вывеска
    SeedSack      мешки с семенами у лавки
    SeedCarrot / SeedGreens / SeedTomato   ящики с семенами на прилавке

Ящики намеренно НЕ используют CarrotBody/Greens/TomatoFruit: те материалы
качает шейдер ветра (scene/sway.ts), и деревянные ящики бы колыхались.

Скрипт дописывает свои цвета в palette.json (остальные ключи не трогает).

Запуск:
    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python tools/_export_seed_store.py
"""
import json
import os

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "assets", "props", "seed_store.glb")
PALETTE = os.path.join(ROOT, "public", "assets", "palette.json")

# --- пропорции (Blender Z-up, метры) --------------------------------------
# Для масштаба: дом 3×3×2, рост героя 1.275, верх грядки z = 0.295.
W = 2.30          # ширина лавки
DEPTH = 1.10      # глубина (между передними и задними стойками)
POST_R = 0.055
POST_H = 2.00     # передние стойки; задние выше — навес наклонён вперёд
BACK_POST_H = 2.20
ROOF_TILT = 9.0   # градусов, перед ниже задка

COUNTER_H = 0.88  # тумба прилавка
TOP_Z = 0.97      # верх столешницы: сюда встают ящики с семенами

# sRGB — ровно то, что уедет в palette.json.
COLORS = {
    "StoreWood": "#a3805c",
    "StoreCounter": "#c9a87c",
    "StoreRoof": "#8f6a4a",
    "StoreAwning": "#e2685f",
    "StoreSign": "#f3e2b8",
    "SeedSack": "#d9c79a",
    "SeedCarrot": "#edad59",
    "SeedGreens": "#89cb7c",
    "SeedTomato": "#e75950",
}

# Семена в ящиках: смещение по X и материал.
CRATES = [(-0.70, "SeedCarrot"), (0.0, "SeedGreens"), (0.70, "SeedTomato")]


def srgb_to_linear(c):
    """Канал sRGB [0..1] → линейный (обратно к lin_to_srgb из 08_export.py)."""
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def linear_rgb(hex_color):
    h = hex_color.lstrip("#")
    return tuple(srgb_to_linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def mat(name):
    """Материал по имени; создаётся один раз (скрипт зовут и в открытой сцене)."""
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    m = bpy.data.materials.new(name)
    m.use_nodes = False
    m.diffuse_color = (*linear_rgb(COLORS[name]), 1.0)
    return m


def shade_flat(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = False


def finish(obj, name):
    obj.data.materials.append(mat(name))
    shade_flat(obj)
    return obj


def add_cube(loc, dims, name, rot_x=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.scale = dims
    obj.rotation_euler[0] = rot_x
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return finish(obj, name)


def add_cyl(loc, radius, depth, name, verts=10):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=verts, radius=radius, depth=depth, location=loc
    )
    return finish(bpy.context.active_object, name)


def bbox_base_center(obj):
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    xs = [c.x for c in corners]
    ys = [c.y for c in corners]
    zs = [c.z for c in corners]
    return Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)))


def add_sack(x, y):
    """Мешок семян: цилиндр с перехваченной горловиной."""
    body = add_cyl((x, y, 0.22), 0.24, 0.44, "SeedSack", verts=8)
    neck = add_cyl((x, y, 0.48), 0.10, 0.14, "SeedSack", verts=8)
    return [body, neck]


def build():
    """Строит лавку в текущей сцене. Возвращает один смерженный объект."""
    from math import radians

    parts = []
    fy = -DEPTH / 2  # передняя линия стоек
    by = DEPTH / 2   # задняя

    # Прилавок: тумба и столешница со свесом.
    parts.append(add_cube((0, fy + 0.25, COUNTER_H / 2),
                          (W - 0.20, 0.40, COUNTER_H), "StoreWood"))
    parts.append(add_cube((0, fy + 0.23, TOP_Z - 0.04),
                          (W + 0.10, 0.60, 0.08), "StoreCounter"))

    # Задняя стенка с вывеской.
    parts.append(add_cube((0, by - 0.03, 0.90), (W, 0.10, 1.80), "StoreWood"))
    parts.append(add_cube((0, by - 0.11, 1.62), (1.50, 0.06, 0.42), "StoreSign"))

    # Стойки.
    px = W / 2 - POST_R
    for x in (-px, px):
        parts.append(add_cyl((x, fy, POST_H / 2), POST_R, POST_H, "StoreWood"))
        parts.append(add_cyl((x, by, BACK_POST_H / 2), POST_R, BACK_POST_H, "StoreWood"))

    # Навес: наклонён вперёд, поэтому поворот вокруг X (+X поднимает +Y).
    tilt = radians(ROOF_TILT)
    roof_d = 1.50
    parts.append(add_cube((0, 0, 2.15), (W + 0.40, roof_d, 0.09), "StoreRoof", rot_x=tilt))

    # Подзор по переднему краю навеса — считаем край, а не подбираем на глаз.
    from math import cos, sin
    edge_y = -roof_d / 2 * cos(tilt)
    edge_z = 2.15 - roof_d / 2 * sin(tilt) - 0.045
    parts.append(add_cube((0, edge_y, edge_z - 0.10),
                          (W + 0.40, 0.06, 0.20), "StoreAwning"))

    # Ящики с семенами на столешнице.
    for x, seed_mat in CRATES:
        parts.append(add_cube((x, fy + 0.23, TOP_Z + 0.10), (0.34, 0.34, 0.20), seed_mat))

    # Мешки у левой стойки, снаружи навеса.
    parts.extend(add_sack(-px - 0.30, fy + 0.10))
    parts.extend(add_sack(px + 0.32, fy + 0.05))

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    store = bpy.context.active_object
    store.name = "SeedStore"

    # Origin в основание bbox — как это делает export_prop() в 08_export.py.
    store.location = store.location - bbox_base_center(store)
    bpy.context.view_layer.update()
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return store


def merge_palette():
    """Дописывает цвета лавки в palette.json, не трогая чужие ключи."""
    with open(PALETTE, encoding="utf-8") as f:
        palette = json.load(f)
    palette.update(COLORS)
    with open(PALETTE, "w", encoding="utf-8") as f:
        json.dump(palette, f, indent=2, sort_keys=True, ensure_ascii=False)


def main():
    clear_scene()
    store = build()

    bpy.ops.object.select_all(action="DESELECT")
    store.select_set(True)
    bpy.context.view_layer.objects.active = store
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
    merge_palette()

    tris = sum(len(p.vertices) - 2 for p in store.data.polygons)
    dim = store.dimensions
    print("[seed_store] экспортирована лавка: {} тр., {:.2f}×{:.2f}×{:.2f} м".format(
        tris, dim.x, dim.y, dim.z))


if __name__ == "__main__":
    main()
