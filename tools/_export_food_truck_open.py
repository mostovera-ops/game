"""
Собирает и экспортирует ТОЛЬКО public/assets/props/food_truck_open.glb —
вторую модель фудтрака: с раздаточным окном, которое открывается, и интерьером,
внутри которого в день торговли стоит герой.

Отдельный скрипт, а не часть _build_and_export.py, по той же причине, что и
_export_bed.py: полный прогон переставляет сцену.

Габариты и посадка — от старого food_truck, но шасси поднято
-----------------------------------------------------------
Кузов 3.6×1.8, кабина и раздаточное окно повторяют tools/blender_scene_scripts.py
(блок фудтрака). Пропс встаёт на то же место, тем же курсом и с тем же масштабом
0.711 — в scene-layout.json у него позиция старого грузовика, rotationY = 0.9269
и scale = 0.711.

Отличие в шасси: колёса больше и опущены, между ними рама, а кузов поднят на
LIFT над землёй. Из-за этого герой в окне оказывается выше своих клиентов, а
прилавок приходится им по грудь. Внутри герой стоит в полный рост, но без ног:
интерьер ниже 1.275, а ног за прилавком всё равно не видно (см. Hero.tsx).

Совпадающие грани дают z-fighting — рябь на бортах. Поэтому пол ужат до
внутренних размеров, накладки и обшивка утоплены в стенку на EPS, а кабина
начинается ровно там, где кончается борт.

Чем отличается от food_truck.glb
--------------------------------
1. Кузов не монолитный куб, а оболочка из панелей: раздаточное окно —
   настоящая дыра, а не стеклянная пластина. Сквозь неё видно интерьер.
2. Окно закрывает створка, а под неё встают подпорки. Оба — отдельные объекты,
   дети кузова: у смерженной геометрии нет своего трансформа, а их надо двигать.
   `Hatch` с origin на линии петли: игра поворачивает его вокруг локального X на
   HATCH_OPEN_DEG. `HatchProps` с origin на прилавке: игра тянет ему scale по
   вертикали от 0 до 1. В GLB створка закрыта, стойки в полный рост.
   Створка заменила прежние навес и стойки: в закрытом положении их некуда
   девать, а открытая створка сама работает навесом.
3. Внутри пол, светлая обшивка, кухонная стойка с плитой, холодильник,
   полка с банками и меловая доска меню.

Ориентация — как у остальных пропсов: раздача смотрит в −Y (Blender), после
Z-up → Y-up это +Z glTF. Геометрия каноническая, не повёрнутая: поворот и
масштаб живут в scene-layout.json, потому что вокруг них считает truckStage.ts.
Полный прогон 08_export.py про этот пропс не знает и вернёт в раскладку старый
`food_truck` — после него запись придётся поправить руками.

Материалы (имена важны — по ним scene подменяет цвет из palette.json).
Первые семь совпадают с food_truck.glb, чтобы оба грузовика были одного цвета:
    TruckBody TruckRoof TruckTrim TruckWheel TruckWindow TruckCounter TruckAwning
Новые, только для интерьера:
    TruckFloor TruckWall TruckFridge TruckStove TruckPot TruckShelf TruckMenu
    TruckLamp

Скрипт дописывает свои цвета в palette.json (остальные ключи не трогает).

Запуск:
    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python tools/_export_food_truck_open.py
"""
import json
import os

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "assets", "props", "food_truck_open.glb")
PALETTE = os.path.join(ROOT, "public", "assets", "palette.json")

# --- пропорции (Blender Z-up, метры) --------------------------------------
# Кузов, кабина и раздаточное окно — от старого food_truck, но шасси поднято:
# грузовик стоит на больших колёсах, и герой в окне оказывается выше клиентов.
BODY_X = 1.8           # полуширина кузова по X (длина 3.6)
BODY_Y = 0.9           # полуглубина по Y (ширина 1.8)
LIFT = 0.85            # низ кузова над землёй
BODY_Z0 = LIFT
BODY_Z1 = LIFT + 1.60  # верх кузова

WALL = 0.07            # толщина стенки
LINING = 0.03          # обшивка изнутри
EPS = 0.005            # на столько накладки утоплены в стенку

# Совпадающие грани дают z-fighting — рябь. Поэтому пол не во всю ширину
# кузова, а по внутренним размерам: иначе его бок лежал бы в плоскости борта.
FLOOR_Z = BODY_Z0 + 0.05   # верх пола

ROOF_Z = 0.12          # толщина крыши (её низ — потолок интерьера)
ROOF_OVER_X = 0.075
ROOF_OVER_Y = 0.05

# Раздаточное окно в передней (−Y) стенке. Выше и просторнее старого: герой
# стоит в нём в полный рост (ног не видно, их закрывает прилавок).
WIN_X0, WIN_X1 = -1.20, 0.60
WIN_Z0, WIN_Z1 = BODY_Z0 + 0.35, BODY_Z0 + 1.50
WIN_CX = (WIN_X0 + WIN_X1) / 2

COUNTER_Z = BODY_Z0 + 0.33   # верх прилавка снаружи
WORK_Z = BODY_Z0 + 0.72      # верх рабочей стойки внутри

# Створка. В модели она закрыта: висит на петле по верхнему краю проёма и
# перекрывает его. Открытая створка — поворот на HATCH_OPEN_DEG вокруг петли:
# −90° приводит её в горизонт, ещё −HATCH_TILT приподнимает нос.
#
# Наклон обязан быть круче, чем угол камеры дня 7 над горизонтом (18°). Луч из
# окна к камере выходит ниже петли и поднимается быстрее пологой створки —
# та бы его перехватила, и вместо героя мы бы видели её изнанку.
HATCH_LEN = 1.13
HATCH_TILT = 30.0
HATCH_OPEN_DEG = -(90.0 + HATCH_TILT)

HINGE_Y = -BODY_Y - 0.035   # средняя плоскость створки, с зазором от борта
HINGE_Z = WIN_Z1

# Подпорки открытой створки: две стойки с прилавка, по краям проёма.
PROP_X = (WIN_CX - 1.00, WIN_CX + 1.00)
PROP_Y = -1.30
PROP_R = 0.035

CAB_X0, CAB_X1 = BODY_X, BODY_X + 1.00
CAB_Z1 = BODY_Z0 + 1.30
WHEEL_R = 0.45
FRAME_Z0 = 0.55        # рама между колёсами, под кузовом

# Где внутри стоит герой: по центру проёма, в 0.50 м вглубь от передней стенки.
# Ближе — упрётся в подоконник, глубже — верх проёма срежет ему голову: камера
# дня 7 смотрит на окно сверху.
HERO_LOCAL = (WIN_CX, -BODY_Y + 0.50)

# sRGB. Первые семь — как в palette.json у food_truck, чтобы не разъехались.
COLORS = {
    "TruckBody": "#f9dd76",
    "TruckRoof": "#81cec4",
    "TruckTrim": "#f3f3f1",
    "TruckWheel": "#505050",
    "TruckWindow": "#c4e5f1",
    "TruckCounter": "#ad906f",
    "TruckAwning": "#ed897c",
    "TruckFloor": "#6b5a4a",
    "TruckWall": "#e9e5da",
    "TruckFridge": "#cfd6d8",
    "TruckStove": "#3c4045",
    "TruckPot": "#9aa3a8",
    "TruckShelf": "#b08a62",
    "TruckMenu": "#4a4a45",
    "TruckLamp": "#ffe9a8",
}


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
    """Материал по имени; создаётся один раз (скрипт зовут и в открытой сцене).

    Цвет кладём и в diffuse_color (solid viewport), и в Principled: палитру
    08_export.py читает из Base Color.
    """
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    m = bpy.data.materials.new(name)
    rgba = (*linear_rgb(COLORS[name]), 1.0)
    m.diffuse_color = rgba
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
    return m


def shade_flat(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = False


def finish(obj, name):
    obj.data.materials.append(mat(name))
    shade_flat(obj)
    return obj


def add_cube(loc, dims, name):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.scale = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name)


def add_box(x0, x1, y0, y1, z0, z1, name):
    """Куб по границам, а не по центру и размеру: панели оболочки удобнее
    задавать краями — так видно, что проём и стенки сходятся без щели."""
    return add_cube(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
                    (x1 - x0, y1 - y0, z1 - z0), name)


def add_cyl(loc, radius, depth, name, verts=10, rot_x=0.0):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=verts, radius=radius, depth=depth, location=loc
    )
    obj = bpy.context.active_object
    obj.rotation_euler[0] = rot_x
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return finish(obj, name)


def bbox_base_center(objs):
    corners = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    xs = [c.x for c in corners]
    ys = [c.y for c in corners]
    zs = [c.z for c in corners]
    return Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)))


# --------------------------------------------------------------------------
# Сборка
# --------------------------------------------------------------------------

def build_shell():
    """Оболочка кузова: пол, три глухие стенки и передняя с проёмом."""
    p = []
    fy0, fy1 = -BODY_Y, -BODY_Y + WALL      # передняя стенка (−Y)
    ix, iy = BODY_X - WALL, BODY_Y - WALL   # внутренние грани стенок

    # Пол по внутренним размерам: во всю ширину его бок совпал бы с бортом.
    p.append(add_box(-ix, ix, -iy, iy, BODY_Z0, FLOOR_Z, "TruckFloor"))

    p.append(add_box(-BODY_X, BODY_X, iy, BODY_Y, BODY_Z0, BODY_Z1, "TruckBody"))
    for sx in (-1, 1):
        x_out, x_in = sx * BODY_X, sx * ix
        p.append(add_box(min(x_out, x_in), max(x_out, x_in),
                         -BODY_Y, BODY_Y, BODY_Z0, BODY_Z1, "TruckBody"))

    # Передняя стенка — четыре панели вокруг проёма.
    p.append(add_box(-BODY_X, BODY_X, fy0, fy1, BODY_Z0, WIN_Z0, "TruckBody"))
    p.append(add_box(-BODY_X, BODY_X, fy0, fy1, WIN_Z1, BODY_Z1, "TruckBody"))
    p.append(add_box(-BODY_X, WIN_X0, fy0, fy1, WIN_Z0, WIN_Z1, "TruckBody"))
    p.append(add_box(WIN_X1, BODY_X, fy0, fy1, WIN_Z0, WIN_Z1, "TruckBody"))

    # Крыша. Её нижняя грань и есть потолок интерьера.
    p.append(add_box(-BODY_X - ROOF_OVER_X, BODY_X + ROOF_OVER_X,
                     -BODY_Y - ROOF_OVER_Y, BODY_Y + ROOF_OVER_Y,
                     BODY_Z1, BODY_Z1 + ROOF_Z, "TruckRoof"))

    # Обшивка изнутри: интерьер не должен быть кислотно-жёлтым. Каждая панель
    # на EPS утоплена в стенку — грани не должны лежать в одной плоскости.
    p.append(add_box(-ix, ix, iy - LINING, iy + EPS, FLOOR_Z, BODY_Z1, "TruckWall"))
    p.append(add_box(-ix, ix, -iy - EPS, -iy + LINING, FLOOR_Z, WIN_Z0, "TruckWall"))
    for sx in (-1, 1):
        x_in, x_lin = sx * (ix + EPS), sx * (ix - LINING)
        p.append(add_box(min(x_in, x_lin), max(x_in, x_lin),
                         -iy, iy, FLOOR_Z, BODY_Z1, "TruckWall"))
    p.append(add_box(-ix, ix, -iy, iy, BODY_Z1 - LINING, BODY_Z1 + EPS, "TruckWall"))
    return p


def build_window():
    """Прилавок снаружи и подоконник изнутри."""
    return [
        add_box(WIN_X0 - 0.15, WIN_X1 + 0.15, -1.35, -BODY_Y + EPS,
                COUNTER_Z - 0.08, COUNTER_Z, "TruckCounter"),
        add_box(WIN_X0, WIN_X1, -BODY_Y + WALL, -BODY_Y + 0.28,
                WIN_Z0 - 0.05, WIN_Z0, "TruckCounter"),
    ]


def build_hatch():
    """Створка в закрытом положении: висит от петли вниз, вровень со стенкой."""
    w = WIN_X1 - WIN_X0 + 0.30
    return [
        add_cube((WIN_CX, HINGE_Y, HINGE_Z - HATCH_LEN / 2), (w, 0.06, HATCH_LEN),
                 "TruckBody"),
        # Подзор по свободному краю: та же красная полоса, что у старого навеса.
        add_cube((WIN_CX, HINGE_Y, HINGE_Z - HATCH_LEN + 0.07), (w, 0.07, 0.14),
                 "TruckAwning"),
    ]


def prop_height():
    """Длина подпорки: от прилавка до нижней грани открытой створки.

    Створка открыта — это плоскость через петлю, поднимающаяся наружу под
    HATCH_TILT. Считаем, а не подбираем: изменится наклон — вырастут стойки.
    """
    from math import radians, tan
    under = HINGE_Z + (abs(PROP_Y) - abs(HINGE_Y)) * tan(radians(HATCH_TILT)) - 0.05
    return under - COUNTER_Z


def build_props():
    """Подпорки: две стойки от прилавка, растут вместе с открытием створки.

    Отдельный объект: игра тянет ему scale по вертикали от 0 (створка закрыта)
    до 1. Поэтому геометрия идёт вверх от нуля — origin окажется на прилавке.
    """
    h = prop_height()
    return [add_cyl((px, PROP_Y, COUNTER_Z + h / 2), PROP_R, h, "TruckTrim", verts=6)
            for px in PROP_X]


def build_interior():
    """Кухня: стойка с плитой, холодильник, полка, доска меню, лампа.

    Всё, что должно читаться снаружи, лежит в полосе проёма по Z
    (WIN_Z0…WIN_Z1). Полка и лампа — выше макушки героя (FLOOR_Z + 1.17).
    """
    p = []
    ix, iy = BODY_X - WALL - LINING, BODY_Y - WALL - LINING
    f = FLOOR_Z

    # Холодильник в дальнем от кабины углу, дверцей к окну.
    p.append(add_box(-ix, -1.00, 0.15, iy, f, f + 1.05, "TruckFridge"))
    p.append(add_cyl((-1.06, 0.20, f + 0.65), 0.02, 0.30, "TruckTrim", verts=6))

    # Рабочая стойка вдоль задней стенки.
    p.append(add_box(-0.90, 0.90, 0.30, iy, f, WORK_Z - 0.06, "TruckShelf"))
    p.append(add_box(-0.95, 0.95, 0.25, iy, WORK_Z - 0.06, WORK_Z, "TruckCounter"))

    # Плита и две кастрюли на ней.
    p.append(add_box(-0.80, -0.20, 0.35, 0.72, WORK_Z, WORK_Z + 0.04, "TruckStove"))
    for px in (-0.64, -0.34):
        p.append(add_cyl((px, 0.54, WORK_Z + 0.12), 0.10, 0.15, "TruckPot", verts=10))

    # Разделочная доска.
    p.append(add_box(0.05, 0.55, 0.35, 0.72, WORK_Z, WORK_Z + 0.03, "TruckShelf"))

    # Доска меню на задней стенке: справа от героя, целиком в проёме.
    p.append(add_box(0.20, 0.85, iy - 0.03, iy, f + 0.85, f + 1.20, "TruckMenu"))

    # Полка слева, выше макушки героя, и банки на ней.
    p.append(add_box(-0.90, -0.10, iy - 0.22, iy, f + 1.23, f + 1.27, "TruckShelf"))
    for px in (-0.75, -0.50, -0.25):
        p.append(add_cyl((px, iy - 0.11, f + 1.335), 0.06, 0.13, "TruckPot", verts=8))

    # Лампа под потолком у окна: шнур и плафон.
    p.append(add_cyl((WIN_CX, -0.45, BODY_Z1 - 0.08), 0.01, 0.14, "TruckTrim", verts=6))
    p.append(add_cyl((WIN_CX, -0.45, BODY_Z1 - 0.19), 0.09, 0.08, "TruckLamp", verts=10))
    return p


def build_chassis():
    """Кабина, лобовое стекло, рама, большие колёса, полоса по борту."""
    import math
    p = []
    p.append(add_box(CAB_X0, CAB_X1, -BODY_Y, BODY_Y, BODY_Z0, CAB_Z1, "TruckRoof"))
    p.append(add_box(CAB_X1, CAB_X1 + 0.06, -0.675, 0.675,
                     BODY_Z0 + 0.52, BODY_Z0 + 1.04, "TruckWindow"))

    # Рама: закрывает просвет между колёсами под поднятым кузовом.
    p.append(add_box(-1.70, CAB_X1 - 0.10, -0.75, 0.75, FRAME_Z0, BODY_Z0, "TruckWheel"))

    for wx in (-1.30, 2.25):
        for wy in (-BODY_Y, BODY_Y):
            p.append(add_cyl((wx, wy, WHEEL_R), WHEEL_R, 0.18, "TruckWheel",
                             verts=12, rot_x=math.pi / 2))

    p.append(add_box(-BODY_X - 0.05, BODY_X + 0.05, -BODY_Y - 0.065, -BODY_Y + EPS,
                     BODY_Z0 + 0.08, BODY_Z0 + 0.20, "TruckTrim"))
    return p


def join(parts, name):
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    return obj


def set_origin(obj, point):
    """Ставит origin объекта в заданную точку (через 3D-курсор)."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.context.scene.cursor.location = point
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.context.scene.cursor.location = (0, 0, 0)


def build():
    """Строит фудтрак в текущей сцене.

    Возвращает (кузов, створка, подпорки, сдвиг). Створка и подпорки — не
    смержены с кузовом: у смерженной геометрии нет своего трансформа, а их надо
    двигать. Origin створки стоит на линии петли (игре хватает поворота вокруг
    локального X), origin подпорок — на прилавке (игре хватает scale по вертикали).
    """
    body = join(build_shell() + build_window() + build_interior() + build_chassis(),
                "FoodTruckOpen")
    hatch = join(build_hatch(), "Hatch")
    props = join(build_props(), "HatchProps")

    set_origin(hatch, (WIN_CX, HINGE_Y, HINGE_Z))
    set_origin(props, (WIN_CX, PROP_Y, COUNTER_Z))

    # Origin пропса — в основание общего bbox, как в export_prop() из 08_export.py.
    shift = bbox_base_center([body, hatch, props])
    for obj in (body, hatch, props):
        obj.location = obj.location - shift
    bpy.context.view_layer.update()

    # Кузов «садится» на новый origin; детям location не применяем — он и есть
    # их точка вращения. Кузов после этого в мировом нуле, и родительство
    # ничего не сдвинет.
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    for child in (hatch, props):
        child.parent = body
        child.matrix_parent_inverse = body.matrix_world.inverted()
    bpy.context.view_layer.update()
    return body, hatch, props, shift


def merge_palette():
    """Дописывает цвета фудтрака в palette.json, не трогая чужие ключи."""
    with open(PALETTE, encoding="utf-8") as f:
        palette = json.load(f)
    palette.update(COLORS)
    with open(PALETTE, "w", encoding="utf-8") as f:
        json.dump(palette, f, indent=2, sort_keys=True, ensure_ascii=False)


def main():
    clear_scene()
    truck, hatch, props, shift = build()

    bpy.ops.object.select_all(action="DESELECT")
    for o in (truck, hatch, props):
        o.select_set(True)
    bpy.context.view_layer.objects.active = truck
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

    tris = sum(len(p.vertices) - 2 for o in (truck, hatch, props) for p in o.data.polygons)
    # Числа для scene/truckStage.ts. Всё относительно origin пропса, в осях
    # glTF ((x, y, z)_blender → (x, z, −y)) и ДО масштаба из scene-layout.json.
    print("[food_truck_open] {} тр., {} + {} + {}".format(
        tris, truck.name, hatch.name, props.name))
    print("[food_truck_open] пол (glTF y):            {:.4f}".format(FLOOR_Z))
    print("[food_truck_open] плоскость окна (glTF z): {:.4f}".format(BODY_Y + shift.y))
    print("[food_truck_open] середина проёма (glTF x):{:.4f}".format(WIN_CX - shift.x))
    print("[food_truck_open] герой внутри (glTF z):   {:.4f}".format(
        -(HERO_LOCAL[1] - shift.y)))
    print("[food_truck_open] створка открыта при rotation.x = {:.1f}°".format(
        HATCH_OPEN_DEG))


if __name__ == "__main__":
    main()
