"""
============================================================================
  08 — ЭКСПОРТЁР: Blender → public/assets/
============================================================================

  Восьмой скрипт в серии tools/blender_scene_scripts.py (01–07 строят сцену).
  Запускать на готовой сцене (после 01→07):

      blender --background reference/scene.blend --python tools/08_export.py

  Выгружает:
    public/assets/props/<name>.glb   — по файлу на уникальный пропс,
                                       Y-up, модификаторы применены, без анимаций
    public/assets/scene-layout.json  — раскладка сцены (координаты уже Y-up)
    public/assets/palette.json       — {"Material": "#rrggbb"} (base_color, sRGB)

  И печатает в stdout сводку: пропсы, число инстансов, треугольники.

  Конвертация Z-up → Y-up происходит ТОЛЬКО здесь (как и требует CLAUDE.md).
  glTF-экспортёр делает это для мешей сам (export_yup=True); для чисел в
  scene-layout.json конвертируем вручную: (x, y, z)_blender → (x, z, -y)_gltf.
============================================================================
"""

import bpy
import json
import math
import os

from mathutils import Vector

# --------------------------------------------------------------------------
# Пути
# --------------------------------------------------------------------------

# __file__ указывает на этот скрипт (tools/08_export.py) при запуске
# через `blender --python`. Корень репозитория — на уровень выше tools/.
def find_repo_root():
    """Работает и из CLI (`blender --python tools/08_export.py`), и из
    текстового редактора Blender (Scripting → Run)."""
    # 1) CLI: у скрипта есть __file__ → корень на уровень выше tools/.
    try:
        here = os.path.dirname(os.path.abspath(__file__))
        return os.path.dirname(here) if os.path.basename(here) == "tools" else here
    except NameError:
        pass
    # 2) GUI: __file__ нет — берём путь открытого .blend.
    blend = bpy.data.filepath
    if blend:
        d = os.path.dirname(blend)
        # scene.blend лежит в reference/ → корень уровнем выше.
        return os.path.dirname(d) if os.path.basename(d) == "reference" else d
    # 3) Фолбэк — текущая папка.
    return os.getcwd()


REPO_ROOT = find_repo_root()
ASSETS_DIR = os.path.join(REPO_ROOT, "public", "assets")
PROPS_DIR = os.path.join(ASSETS_DIR, "props")
os.makedirs(PROPS_DIR, exist_ok=True)
print("[08_export] корень проекта:", REPO_ROOT)
print("[08_export] пишу ассеты в:", ASSETS_DIR)


# --------------------------------------------------------------------------
# Конвертация координат и цвета
# --------------------------------------------------------------------------

def to_yup(v):
    """Blender Z-up → glTF Y-up: (x, y, z) → (x, z, -y)."""
    return [v[0], v[2], -v[1]]


def lin_to_srgb(c):
    """Линейный канал (Blender) → sRGB [0..1]."""
    c = max(0.0, min(1.0, c))
    if c <= 0.0031308:
        return 12.92 * c
    return 1.055 * (c ** (1.0 / 2.4)) - 0.055


def hex_color(linear_rgb):
    """Линейный RGB → '#rrggbb' в sRGB."""
    r, g, b = (round(lin_to_srgb(x) * 255) for x in linear_rgb[:3])
    return "#{:02x}{:02x}{:02x}".format(r, g, b)


def principled(mat):
    """Узел Principled BSDF материала, либо None."""
    if not mat or not mat.use_nodes:
        return None
    return mat.node_tree.nodes.get("Principled BSDF")


# --------------------------------------------------------------------------
# Геометрия: мировой bbox, основание, число треугольников
# --------------------------------------------------------------------------

def eval_mesh(obj):
    """Меш с применёнными модификаторами (evaluated). Вызвать to_mesh_clear
    на объекте после использования."""
    deps = bpy.context.evaluated_depsgraph_get()
    return obj.evaluated_get(deps).to_mesh()


def world_verts(obj):
    """Мировые координаты вершин с учётом модификаторов."""
    ev = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = ev.to_mesh()
    mw = obj.matrix_world
    pts = [mw @ v.co for v in me.vertices]
    ev.to_mesh_clear()
    return pts


def bbox_base_center(obj):
    """Центр основания bbox в мире: (центр XY, min Z)."""
    pts = world_verts(obj)
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    return Vector((
        (min(xs) + max(xs)) / 2.0,
        (min(ys) + max(ys)) / 2.0,
        min(zs),
    ))


def bbox_size(obj):
    """Габариты bbox (dx, dy, dz) в мире."""
    pts = world_verts(obj)
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    return Vector((max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)))


def tri_count(obj):
    """Число треугольников меша с модификаторами."""
    ev = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = ev.to_mesh()
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    ev.to_mesh_clear()
    return n


# --------------------------------------------------------------------------
# Экспорт одного пропса
# --------------------------------------------------------------------------

def export_prop(src_obj, name, bake_rotation):
    """
    Экспортирует копию src_obj в props/<name>.glb с origin в основании bbox
    (центр XY, min Z, в мировом нуле) — растения/пропсы «стоят от земли».

    bake_rotation=True  — поворот объекта запекается в геометрию (одиночные
                          пропсы: дом, теплица, фудтрак…). В scene-layout у них
                          rotationY = 0, потому что поворот уже в меше.
    bake_rotation=False — поворот снимается, геометрия каноническая, не повёрнута
                          (деревья/кусты для инстансинга; грядки и растения,
                          которые игра сама поворачивает/ставит по слотам).

    Возвращает число треугольников.
    """
    bpy.ops.object.select_all(action="DESELECT")

    # Копия с независимыми данными, чтобы не портить сцену.
    dup = src_obj.copy()
    dup.data = src_obj.data.copy()
    bpy.context.collection.objects.link(dup)

    if not bake_rotation:
        dup.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()

    # Сдвигаем так, чтобы основание bbox попало в мировой ноль.
    origin = bbox_base_center(dup)
    dup.location = dup.location - origin
    bpy.context.view_layer.update()

    # Применяем всё: меш «садится» на новый origin, поворот запекается
    # (или уже обнулён выше для канонических пропсов).
    bpy.ops.object.select_all(action="DESELECT")
    dup.select_set(True)
    bpy.context.view_layer.objects.active = dup
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    tris = tri_count(dup)

    out = os.path.join(PROPS_DIR, name + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        use_selection=True,
        export_yup=True,          # Z-up → Y-up
        export_apply=True,        # применить модификаторы
        export_animations=False,  # анимации не выгружаем
        export_cameras=False,
        export_lights=False,
    )

    bpy.data.objects.remove(dup, do_unlink=True)
    return tris


# --------------------------------------------------------------------------
# Классификация объектов сцены
# --------------------------------------------------------------------------

def first_material_name(obj):
    if not obj.data or not getattr(obj.data, "materials", None):
        return None
    mats = obj.data.materials
    if not mats:
        return None
    # Материал первого полигона — надёжнее, чем слот 0.
    if obj.data.polygons:
        idx = obj.data.polygons[0].material_index
        if idx < len(mats) and mats[idx]:
            return mats[idx].name
    return mats[0].name if mats[0] else None


def collect():
    """
    Раскладывает меш-объекты сцены по категориям пропсов.

    Деревья и кусты группируем по геометрии/материалу (а не по имени
    объекта): после separate_loose в скрипте 04 куски цветов тоже носят
    имя Bush_*, но у них материал Flower* — их в пропс «bush» не берём.
    """
    cats = {
        "house": [], "greenhouse": [], "food_truck": [], "brick_path": [],
        "log_table": [], "sit_log": [], "ladybug": [], "raised_bed": [],
        "carrot": [], "greens": [], "tomato_bush": [], "tree": [], "bush": [],
    }

    exact = {
        "House": "house",
        "Greenhouse": "greenhouse",
        "FoodTruck": "food_truck",
        "BrickPath": "brick_path",
        "LogTable": "log_table",
        "Ladybug": "ladybug",
    }

    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        name = obj.name
        if name == "Ground":
            continue  # землю не экспортируем — рисуется planeGeometry в коде

        if name in exact:
            cats[exact[name]].append(obj)
        elif name.startswith("SitLog"):
            cats["sit_log"].append(obj)
        elif name.startswith("RaisedBed"):
            cats["raised_bed"].append(obj)
        elif name.startswith("Carrot"):
            cats["carrot"].append(obj)
        elif name.startswith("Greens"):
            cats["greens"].append(obj)
        elif name.startswith("TomatoBush"):
            cats["tomato_bush"].append(obj)
        elif name.startswith("Tree_"):
            cats["tree"].append(obj)
        elif name.startswith("Bush_"):
            mat = first_material_name(obj) or ""
            if mat.startswith("Flower"):
                continue  # отделённый цветок, не тело куста
            cats["bush"].append(obj)

    return cats


# --------------------------------------------------------------------------
# scene-layout.json
# --------------------------------------------------------------------------

# Пропсы, которые попадают в scene-layout["props"] (позиция + поворот + масштаб).
# Растения (carrot/greens/tomato_bush) НЕ идут — они появляются в plots[].slots.
# RaisedBed НЕ идёт — она в plots[].bed. Ground рисуется кодом.
LAYOUT_PROPS = ["house", "greenhouse", "food_truck", "brick_path",
                "log_table", "sit_log", "ladybug", "tree", "bush"]

# Офсеты 3 слотов посадки по X от центра грядки (CLAUDE.md).
# Симметрично: центр + два края, внутри почвы (её полуширина 0.736).
SLOT_OFFSETS_X = [-0.45, 0.0, 0.45]
# Верх почвы, а не рамки: почва приподнята на SOIL_LIFT в blender_scene_scripts.py.
BED_TOP_Z = 0.295


def instance_entry(obj, asset, ref_height):
    """Одна запись в props[]: позиция (основание, Y-up), rotationY, scale.

    Для деревьев/кустов масштаб восстанавливаем из отношения высот bbox
    к эталонному мешу — в create_tree/create_bush масштаб запечён в
    геометрию (object.scale == 1), поэтому эталонный GLB один, а
    вариативность размера отдаём инстансам."""
    base = bbox_base_center(obj)
    if ref_height and ref_height > 1e-6:
        s = bbox_size(obj).z / ref_height
    else:
        s = 1.0
    # Поворот одиночных пропсов запечён в GLB (см. export_prop), а деревья/кусты
    # в сцене не повёрнуты — поэтому rotationY здесь всегда 0.
    return {
        "asset": asset,
        "position": [round(c, 4) for c in to_yup(base)],
        "rotationY": 0.0,
        "scale": [round(s, 4), round(s, 4), round(s, 4)],
    }


def build_plots(beds):
    """plots[]: по грядке — позиция bed, её поворот и 3 слота посадки.
    Слоты идут вдоль локальной оси грядки (ширина), поэтому офсеты
    поворачиваем на угол грядки — иначе на повёрнутой грядке растения
    сядут криво. Сортируем по (x, y) для стабильных id между запусками."""
    beds_sorted = sorted(beds, key=lambda o: (round(o.location.x, 2),
                                               round(o.location.y, 2)))
    plots = []
    for i, bed in enumerate(beds_sorted):
        base = bbox_base_center(bed)
        cx, cy = base.x, base.y
        theta = bed.rotation_euler.z
        cos_t, sin_t = math.cos(theta), math.sin(theta)
        slots = []
        for ox in SLOT_OFFSETS_X:
            # локальный офсет (ox, 0) поворачиваем на угол грядки
            wx = cx + ox * cos_t
            wy = cy + ox * sin_t
            slots.append([round(c, 4) for c in to_yup(Vector((wx, wy, BED_TOP_Z)))])
        plots.append({
            "id": i,
            "bed": [round(c, 4) for c in to_yup(Vector((cx, cy, 0.0)))],
            "bedRotationY": round(theta, 5),
            "slots": slots,
        })
    return plots


def build_camera():
    cam = bpy.context.scene.camera
    if not cam:
        return {"position": [0, 0, 0], "target": [0, 0, 0], "isOrtho": False}
    loc = cam.matrix_world.translation
    forward = cam.matrix_world.to_quaternion() @ Vector((0.0, 0.0, -1.0))
    target = loc + forward * loc.length  # точка перед камерой ~в центре сцены
    return {
        "position": [round(c, 4) for c in to_yup(loc)],
        "target": [round(c, 4) for c in to_yup(target)],
        "isOrtho": cam.data.type == "ORTHO",
    }


def build_sun():
    sun = next((o for o in bpy.data.objects
                if o.type == "LIGHT" and o.data.type == "SUN"), None)
    if not sun:
        return {"direction": [0, -1, 0], "color": "#ffffff", "energy": 1.0}
    direction = sun.matrix_world.to_quaternion() @ Vector((0.0, 0.0, -1.0))
    return {
        "direction": [round(c, 4) for c in to_yup(direction.normalized())],
        "color": hex_color(sun.data.color),
        "energy": round(sun.data.energy, 3),
    }


def build_palette():
    palette = {}
    for mat in bpy.data.materials:
        bsdf = principled(mat)
        if not bsdf:
            continue
        base = bsdf.inputs["Base Color"].default_value
        palette[mat.name] = hex_color(base)
    return palette


# --------------------------------------------------------------------------
# Главный проход
# --------------------------------------------------------------------------

def main():
    cats = collect()

    # Эталонные высоты для восстановления масштаба инстансов деревьев/кустов.
    ref_height = {}
    for key in ("tree", "bush"):
        if cats[key]:
            ref_height[key] = bbox_size(cats[key][0]).z

    exported = {}   # asset -> tris (эталонный меш)
    counts = {}     # asset -> число инстансов в сцене

    all_assets = ["house", "greenhouse", "food_truck", "brick_path",
                  "raised_bed", "log_table", "sit_log", "ladybug",
                  "carrot", "greens", "tomato_bush", "tree", "bush"]

    # Одиночные пропсы: поворот запекаем в GLB (rotationY=0 в layout).
    # Остальные (деревья/кусты для инстансинга, грядки и растения, которые
    # игра сама ставит/поворачивает) — каноническая, не повёрнутая геометрия.
    BAKE_ROTATION = {"house", "greenhouse", "food_truck", "brick_path",
                     "log_table", "sit_log", "ladybug"}

    for asset in all_assets:
        objs = cats[asset]
        counts[asset] = len(objs)
        if not objs:
            print("  [!] нет объектов для пропса:", asset)
            continue
        # Один GLB на пропс — экспортируем эталон (первый объект категории).
        rep = objs[0]
        exported[asset] = export_prop(rep, asset, bake_rotation=(asset in BAKE_ROTATION))

    # --- scene-layout.json ---
    props_list = []
    for asset in LAYOUT_PROPS:
        rh = ref_height.get(asset)
        for obj in cats[asset]:
            props_list.append(instance_entry(obj, asset, rh))

    layout = {
        "props": props_list,
        "plots": build_plots(cats["raised_bed"]),
        "ground": {"size": 40, "material": "Grass"},
        "camera": build_camera(),
        "sun": build_sun(),
    }
    with open(os.path.join(ASSETS_DIR, "scene-layout.json"), "w") as f:
        json.dump(layout, f, indent=2, ensure_ascii=False)

    # --- palette.json ---
    palette = build_palette()
    with open(os.path.join(ASSETS_DIR, "palette.json"), "w") as f:
        json.dump(palette, f, indent=2, ensure_ascii=False)

    # --- Сводка ---
    print("\n" + "=" * 60)
    print("  ЭКСПОРТ ЗАВЕРШЁН →", ASSETS_DIR)
    print("=" * 60)
    print("  {:<14} {:>7} {:>10} {:>12}".format("пропс", "инст.", "тр/шт", "тр·инст"))
    print("  " + "-" * 45)
    total = 0
    for asset in all_assets:
        if asset not in exported:
            continue
        tris = exported[asset]
        n = counts[asset]
        sub = tris * n
        total += sub
        print("  {:<14} {:>7} {:>10} {:>12}".format(asset, n, tris, sub))
    print("  " + "-" * 45)
    print("  {:<14} {:>7} {:>10} {:>12,}".format("ИТОГО", "", "", total))
    print("=" * 60)
    print("  props в layout: {} инстансов".format(len(props_list)))
    print("  plots: {}, материалов в палитре: {}".format(
        len(layout["plots"]), len(palette)))
    if total > 50000:
        print("\n  ⚠ БОЛЬШЕ ~50k ТРЕУГОЛЬНИКОВ — стоит остановиться и разобраться.")
    print()


if __name__ == "__main__":
    main()
