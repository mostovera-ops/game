"""
Собирает и экспортирует живность и лесные находки в public/assets/props/.

    critter_butterfly.glb   BugBody · BugWingL · BugWingR
    critter_ladybug.glb     BugBody · BugWingL · BugWingR
    critter_beetle.glb      BugBody · BugWingL · BugWingR
    critter_bee.glb         BugBody · BugWingL · BugWingR
    bird.glb                BirdBody · BirdWingL · BirdWingR
    rabbit.glb              RabbitBody · RabbitEarL · RabbitEarR
    boar.glb                BoarBody · BoarLegFL/FR/BL/BR · BoarTail
    mushroom.glb            Mushroom    — съедобный, коричневая шапка без точек
    toadstool.glb           Toadstool   — мухомор, в супе ему не место
    nest.glb                Nest · Egg

Отдельный скрипт, а не часть _build_and_export.py, по той же причине, что
_export_hero.py и _export_bed.py: полный прогон переставляет сцену. Живность
от расстановки не зависит вовсе — она в scene-layout.json не попадает,
позиции ей каждый кадр считает код.

Анимаций в GLB нет — как и у героя. Дают их движки в src/scene/wildlife/:
взмах крыла это поворот узла, прыжок кролика — движение всей группы. Поэтому
здесь важны не формы, а ORIGIN каждого узла: он и есть ось вращения.

Соглашения (Blender Z-up):
  * «Вперёд» у всех — +Y. После Z-up → Y-up это −Z glTF, то есть «вперёд»
    three.js: узел с rotation.y = 0 смотрит туда, куда ожидает код.
  * Origin корневого узла — в основании (min z, центр по xy). Значит
    group.position.y — это высота земли (или ветки) под существом, а не
    его брюха.
  * Крыло качается вокруг продольной оси тела. Это Blender +Y, а после
    конвертации — glTF −Z: во three взмах это `wing.rotation.z`.
  * Нога и хвост качаются вокруг поперечной оси: Blender +X → glTF +X,
    во three это `leg.rotation.x`, как у ног героя.

Цвета живут здесь и допечатываются в public/assets/palette.json (upsert по
ключу). 08_export.py палитру перезаписывает целиком из .blend, где живности
нет, — после полного прогона экспортёра этот скрипт надо запустить следом.

Запуск:
    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python tools/_export_wildlife.py

Переменная окружения WILDLIFE_RENDER=<dir> дополнительно рендерит каждый
пропс в PNG — быстрый способ посмотреть, что собралось, не открывая GUI.
"""
import json
import math
import os

import bmesh
import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROPS = os.path.join(ROOT, "public", "assets", "props")
PALETTE = os.path.join(ROOT, "public", "assets", "palette.json")
RENDER_DIR = os.environ.get("WILDLIFE_RENDER")

# --- палитра ---------------------------------------------------------------
# Ключ — имя материала, оно же ключ в palette.json: игра красит меши по нему,
# а не по цвету из GLB (см. applyPalette в src/assets/scene.ts).
COLORS = {
    "ButterflyBody": "#4a3b4f",
    "ButterflyWing": "#efb6d6",
    "BugWing": "#dfe9ef",
    "LadybugShell": "#ed503f",
    "LadybugSpot": "#303030",
    "BeetleShell": "#5f8f5a",
    "BeetleBody": "#2e3a2e",
    "BeeBody": "#f2c14e",
    "BeeStripe": "#3a3226",
    "BirdBody": "#6d8fbf",
    "BirdWing": "#4f6f9c",
    "BirdBeak": "#f2a03d",
    "BirdEye": "#201a16",
    "RabbitFur": "#d8ccbb",
    "RabbitTail": "#f4efe6",
    "RabbitEye": "#2a2420",
    "BoarHide": "#6b5747",
    "BoarSnout": "#8f7361",
    "BoarTusk": "#f0e6d2",
    "BoarEye": "#201a16",
    "MushroomCap": "#7a5334",
    "MushroomStem": "#e6d6b8",
    "ToadstoolCap": "#b1503f",
    "ToadstoolStem": "#efe3cd",
    "ToadstoolSpot": "#f6f0e2",
    "NestTwig": "#8a6b48",
    "NestEgg": "#f6efdd",
}

# Ключи, которые скрипт писал раньше и больше не пишет. upsert_palette их
# вычищает: сам он только добавляет, и брошенный цвет жил бы в palette.json
# вечно, сбивая с толку следующего читателя.
RETIRED = ["MushroomSpot"]


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def make_mat(name):
    """Материал по имени из COLORS. Цвет в Blender линейный, в палитре — sRGB."""
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat
    hex_rgb = COLORS[name]
    rgb = [srgb_to_linear(int(hex_rgb[i:i + 2], 16) / 255) for i in (1, 3, 5)]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = False
    mat.diffuse_color = (*rgb, 1.0)
    return mat


# --- примитивы -------------------------------------------------------------
# Живность фасеточная, как и вся сцена: shade_flat, никаких сглаженных нормалей.


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def finish(obj, mat, scale=None, rot=None):
    if scale:
        obj.scale = scale
    if rot:
        obj.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    obj.data.materials.append(make_mat(mat))
    return obj


def ico(loc, scale, mat, subdiv=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=1.0, location=loc)
    return finish(bpy.context.active_object, mat, scale)


def uv(loc, scale, mat, seg=10, ring=6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=ring, radius=1.0, location=loc)
    return finish(bpy.context.active_object, mat, scale)


def dome(loc, scale, mat, seg=12, ring=6):
    """Верхняя половина сферы: срез по локальному z, плоское дно на z=loc.z."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=ring, radius=1.0, location=loc)
    obj = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.delete(
        bm, geom=[f for f in bm.faces if f.calc_center_median().z < 0.0], context="FACES"
    )
    bm.to_mesh(obj.data)
    bm.free()
    return finish(obj, mat, scale)


def box(loc, scale, mat, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    return finish(bpy.context.active_object, mat, scale, rot)


def cyl(loc, radius, depth, mat, verts=8, rot=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    return finish(bpy.context.active_object, mat, None, rot)


def cone(loc, r1, r2, depth, mat, verts=8, rot=None):
    bpy.ops.mesh.primitive_cone_add(
        vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc
    )
    return finish(bpy.context.active_object, mat, None, rot)


def torus(loc, major, minor, mat, major_seg=12, minor_seg=6):
    bpy.ops.mesh.primitive_torus_add(
        location=loc, major_radius=major, minor_radius=minor,
        major_segments=major_seg, minor_segments=minor_seg,
    )
    return finish(bpy.context.active_object, mat)


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    return obj


def set_origin(obj, point):
    """Origin объекта в мировую точку point; меш остаётся на месте."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.context.scene.cursor.location = point
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.context.scene.cursor.location = (0, 0, 0)


def ground_origin(obj):
    """Origin в основание bbox: min z, центр по xy. Так group.position.y = земля."""
    corners = [obj.matrix_world @ v.co for v in obj.data.vertices]
    xs = [c.x for c in corners]
    ys = [c.y for c in corners]
    set_origin(obj, ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(c.z for c in corners)))


def tris(objs):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)


# --- насекомые --------------------------------------------------------------
# У всех четверых один и тот же риг: BugBody + BugWingL/R. Крылья висят на
# продольной оси тела (x = 0), поэтому взмах — чистый поворот вокруг неё, без
# сдвигов. Один компонент <Bug> в коде обслуживает все четыре GLB.


def bug_wings(hinge_z, mat, blades):
    """Пара крыльев, origin обеих — на оси тела, на высоте hinge_z.

    blades: [(dx, y, z, sx, sy)] — половинки для ЛЕВОГО крыла (+X),
    правое зеркалим по X.
    """
    out = []
    for sign, side in ((+1, "L"), (-1, "R")):
        parts = [
            ico((sign * dx, y, z), (sx, sy, 0.004), mat)
            for dx, y, z, sx, sy in blades
        ]
        wing = join(parts, "BugWing" + side)
        set_origin(wing, (0.0, 0.0, hinge_z))
        out.append(wing)
    return out


def build_butterfly():
    body = join(
        [
            uv((0, 0, 0.016), (0.011, 0.042, 0.016), "ButterflyBody", 8, 5),
            uv((0, 0.046, 0.020), (0.013, 0.013, 0.013), "ButterflyBody", 8, 5),
            # усики
            cyl((0.010, 0.062, 0.030), 0.0018, 0.032, "ButterflyBody", 5,
                rot=(math.radians(-55), 0, math.radians(-18))),
            cyl((-0.010, 0.062, 0.030), 0.0018, 0.032, "ButterflyBody", 5,
                rot=(math.radians(-55), 0, math.radians(18))),
        ],
        "BugBody",
    )
    ground_origin(body)
    wings = bug_wings(
        0.026, "ButterflyWing",
        [(0.082, 0.022, 0.026, 0.080, 0.062),   # переднее крыло
         (0.060, -0.048, 0.026, 0.055, 0.046)],  # заднее
    )
    return [body, *wings]


def build_ladybug():
    shell = dome((0, 0, 0.004), (0.046, 0.056, 0.040), "LadybugShell")
    spots = [
        uv((sx, sy, 0.0), (0.012, 0.012, 0.012), "LadybugSpot", 6, 4)
        for sx, sy in ((0.020, 0.020), (-0.020, 0.020), (0.024, -0.020), (-0.024, -0.020))
    ]
    # Пятна сидят на скорлупе: поднимаем их на её поверхность, а не в центр.
    for spot, (sx, sy) in zip(spots, ((0.020, 0.020), (-0.020, 0.020),
                                      (0.024, -0.020), (-0.024, -0.020))):
        t = 1 - (sx / 0.046) ** 2 - (sy / 0.056) ** 2
        spot.location.z = 0.004 + 0.040 * math.sqrt(max(t, 0.0)) - 0.004
    body = join(
        [
            shell,
            *spots,
            box((0, -0.004, 0.042), (0.005, 0.086, 0.006), "LadybugSpot"),  # шов надкрылий
            uv((0, 0.050, 0.018), (0.024, 0.022, 0.020), "LadybugSpot", 8, 5),  # голова
        ],
        "BugBody",
    )
    ground_origin(body)
    # Крыло чуть уже скорлупы: в полёте оно из-под неё выглядывает, а не
    # накрывает жука серой пластиной. На земле код его и вовсе прячет.
    wings = bug_wings(0.038, "BugWing", [(0.040, -0.008, 0.038, 0.038, 0.046)])
    return [body, *wings]


def build_beetle():
    body = join(
        [
            dome((0, 0, 0.004), (0.034, 0.058, 0.030), "BeetleShell"),
            box((0, -0.004, 0.032), (0.004, 0.090, 0.005), "BeetleBody"),
            uv((0, 0.052, 0.014), (0.020, 0.020, 0.016), "BeetleBody", 8, 5),
            cyl((0.008, 0.076, 0.024), 0.0016, 0.030, "BeetleBody", 5,
                rot=(math.radians(-60), 0, math.radians(-14))),
            cyl((-0.008, 0.076, 0.024), 0.0016, 0.030, "BeetleBody", 5,
                rot=(math.radians(-60), 0, math.radians(14))),
        ],
        "BugBody",
    )
    ground_origin(body)
    wings = bug_wings(0.030, "BugWing", [(0.038, -0.008, 0.030, 0.036, 0.050)])
    return [body, *wings]


BEE_RX, BEE_RY, BEE_RZ = 0.021, 0.044, 0.020


def bee_stripe(y):
    """Полоска — не кубик поперёк брюшка, а кольцо по его обводу.

    Радиус берём с самого эллипсоида на этой высоте y и добавляем 4%:
    полоска обнимает тело, а не торчит из него углами.
    """
    k = math.sqrt(max(1 - (y / BEE_RY) ** 2, 0.0)) * 1.04
    return uv((0, y, 0.020), (BEE_RX * k, 0.007, BEE_RZ * k), "BeeStripe", 10, 6)


def build_bee():
    body = join(
        [
            uv((0, 0, 0.020), (BEE_RX, BEE_RY, BEE_RZ), "BeeBody", 10, 6),
            *[bee_stripe(y) for y in (0.014, -0.008, -0.030)],
            uv((0, 0.048, 0.020), (0.018, 0.016, 0.017), "BeeStripe", 8, 5),
            cyl((0.007, 0.058, 0.032), 0.0016, 0.024, "BeeStripe", 5,
                rot=(math.radians(-55), 0, math.radians(-14))),
            cyl((-0.007, 0.058, 0.032), 0.0016, 0.024, "BeeStripe", 5,
                rot=(math.radians(-55), 0, math.radians(14))),
        ],
        "BugBody",
    )
    ground_origin(body)
    wings = bug_wings(0.036, "BugWing", [(0.030, 0.008, 0.036, 0.028, 0.034)])
    return [body, *wings]


# --- птица -----------------------------------------------------------------
# Летает всегда, поэтому origin тела не в лапках, а в основании корпуса:
# высота в коде — это высота полёта, лап у неё нет.


def build_bird():
    body = join(
        [
            uv((0, 0, 0.048), (0.040, 0.085, 0.040), "BirdBody", 10, 6),
            uv((0, 0.080, 0.070), (0.036, 0.036, 0.034), "BirdBody", 10, 6),
            cone((0, 0.120, 0.068), 0.017, 0.0, 0.050, "BirdBeak", 6,
                 rot=(math.radians(-90), 0, 0)),
            # хвост клином назад и чуть вверх
            box((0, -0.105, 0.055), (0.055, 0.075, 0.008), "BirdWing",
                rot=(math.radians(10), 0, 0)),
            uv((0.017, 0.088, 0.082), (0.007, 0.007, 0.007), "BirdEye", 6, 4),
            uv((-0.017, 0.088, 0.082), (0.007, 0.007, 0.007), "BirdEye", 6, 4),
        ],
        "BirdBody",
    )
    ground_origin(body)

    wings = []
    for sign, side in ((+1, "L"), (-1, "R")):
        # Крыло сужается к концу: два сегмента вместо одной лопасти.
        wing = join(
            [
                ico((sign * 0.075, 0.010, 0.062), (0.075, 0.055, 0.006), "BirdWing"),
                ico((sign * 0.170, -0.020, 0.062), (0.055, 0.038, 0.005), "BirdWing"),
            ],
            "BirdWing" + side,
        )
        set_origin(wing, (0.0, 0.0, 0.062))
        wings.append(wing)
    return [body, *wings]


# --- кролик ----------------------------------------------------------------
# Уши — отдельные узлы с origin в основании: код кладёт их назад на прыжке.


def build_rabbit():
    body = join(
        [
            uv((0, -0.015, 0.115), (0.075, 0.105, 0.085), "RabbitFur", 10, 6),
            uv((0, 0.095, 0.165), (0.058, 0.055, 0.055), "RabbitFur", 10, 6),   # голова
            uv((0, 0.140, 0.140), (0.030, 0.030, 0.025), "RabbitFur", 8, 5),    # мордочка
            uv((0, -0.115, 0.135), (0.038, 0.030, 0.036), "RabbitTail", 8, 5),  # хвост
            uv((0.036, 0.126, 0.180), (0.011, 0.010, 0.011), "RabbitEye", 6, 4),
            uv((-0.036, 0.126, 0.180), (0.011, 0.010, 0.011), "RabbitEye", 6, 4),
            # Лапы — короткие столбики: кролик почти всегда в прыжке или сидит.
            cyl((0.048, 0.055, 0.032), 0.024, 0.064, "RabbitFur", 6),
            cyl((-0.048, 0.055, 0.032), 0.024, 0.064, "RabbitFur", 6),
            cyl((0.052, -0.075, 0.036), 0.030, 0.072, "RabbitFur", 6),
            cyl((-0.052, -0.075, 0.036), 0.030, 0.072, "RabbitFur", 6),
        ],
        "RabbitBody",
    )
    ground_origin(body)

    ears = []
    for sign, side in ((+1, "L"), (-1, "R")):
        ear = uv((sign * 0.026, 0.082, 0.255), (0.016, 0.013, 0.055), "RabbitFur", 8, 5)
        ear.name = "RabbitEar" + side
        set_origin(ear, (sign * 0.026, 0.082, 0.200))
        ears.append(ear)
    return [body, *ears]


# --- кабанчик --------------------------------------------------------------
# Ноги с origin в бедре — как у героя: шаг это поворот вокруг X.


# Кабан приземистый: ноги короче половины высоты тела, иначе он читается
# не кабаном, а собакой на ходулях.
BOAR_HIP_Z = 0.175
BOAR_LEGS = {"FL": (0.088, 0.145), "FR": (-0.088, 0.145), "BL": (0.094, -0.155), "BR": (-0.094, -0.155)}


def build_boar():
    body = join(
        [
            uv((0, 0, 0.285), (0.145, 0.245, 0.140), "BoarHide", 12, 7),
            # загривок горбом — по нему кабан и читается кабаном
            uv((0, 0.070, 0.375), (0.115, 0.130, 0.075), "BoarHide", 10, 6),
            uv((0, 0.250, 0.255), (0.108, 0.100, 0.100), "BoarHide", 10, 6),   # голова
            cone((0, 0.350, 0.220), 0.058, 0.045, 0.090, "BoarSnout", 8,
                 rot=(math.radians(-90), 0, 0)),                               # рыло
            # клыки: наружу и вверх
            cone((0.044, 0.348, 0.205), 0.010, 0.0, 0.058, "BoarTusk", 5,
                 rot=(math.radians(-150), 0, math.radians(20))),
            cone((-0.044, 0.348, 0.205), 0.010, 0.0, 0.058, "BoarTusk", 5,
                 rot=(math.radians(-150), 0, math.radians(-20))),
            cone((0.068, 0.240, 0.335), 0.034, 0.0, 0.072, "BoarHide", 5,
                 rot=(math.radians(-20), math.radians(30), 0)),                # ухо
            cone((-0.068, 0.240, 0.335), 0.034, 0.0, 0.072, "BoarHide", 5,
                 rot=(math.radians(-20), math.radians(-30), 0)),
            uv((0.070, 0.295, 0.300), (0.013, 0.011, 0.013), "BoarEye", 6, 4),
            uv((-0.070, 0.295, 0.300), (0.013, 0.011, 0.013), "BoarEye", 6, 4),
        ],
        "BoarBody",
    )
    ground_origin(body)

    legs = []
    for side, (x, y) in BOAR_LEGS.items():
        leg = join(
            [
                cyl((x, y, BOAR_HIP_Z / 2 + 0.026), 0.036, BOAR_HIP_Z - 0.026, "BoarHide", 6),
                cyl((x, y, 0.013), 0.040, 0.026, "BoarEye", 6),  # копытце
            ],
            "BoarLeg" + side,
        )
        set_origin(leg, (x, y, BOAR_HIP_Z))
        legs.append(leg)

    tail = cyl((0, -0.248, 0.300), 0.010, 0.090, "BoarHide", 5,
               rot=(math.radians(70), 0, 0))
    tail.name = "BoarTail"
    set_origin(tail, (0.0, -0.235, 0.330))
    return [body, *legs, tail]


# --- находки ---------------------------------------------------------------


def build_mushroom():
    """Съедобный гриб: коричневая шапка без единой точки, толстая ножка.

    Читается издалека именно отсутствием пятен — рядом растёт мухомор ровно
    того же силуэта, и спутать их игрок не должен.
    """
    cap = dome((0, 0, 0.100), (0.092, 0.092, 0.058), "MushroomCap")
    # Ножка боровика: книзу толще. Без утолщения гриб выглядит поганкой.
    stem = cone((0, 0, 0.052), 0.040, 0.029, 0.104, "MushroomStem", 10)
    obj = join([cap, stem], "Mushroom")
    ground_origin(obj)
    return [obj]


def build_toadstool():
    """Мухомор: красная шапка в белую крапину. Не собирается, только пугает."""
    cap = dome((0, 0, 0.110), (0.085, 0.085, 0.062), "ToadstoolCap")
    spots = []
    for sx, sy in ((0.030, 0.018), (-0.026, 0.030), (0.006, -0.038), (-0.040, -0.020)):
        t = 1 - (sx / 0.085) ** 2 - (sy / 0.085) ** 2
        spots.append(uv((sx, sy, 0.110 + 0.062 * math.sqrt(max(t, 0.0)) - 0.006),
                        (0.014, 0.014, 0.010), "ToadstoolSpot", 6, 4))
    stem = cone((0, 0, 0.058), 0.030, 0.022, 0.116, "ToadstoolStem", 10)
    obj = join([cap, *spots, stem], "Toadstool")
    ground_origin(obj)
    return [obj]


def build_nest():
    nest = join(
        [
            torus((0, 0, 0.048), 0.130, 0.048, "NestTwig"),
            cyl((0, 0, 0.022), 0.115, 0.030, "NestTwig", 12),  # дно, иначе тор просвечивает
        ],
        "Nest",
    )
    ground_origin(nest)
    # Яйцо — отдельный узел: игра гасит его, когда герой забрал находку.
    egg = uv((0, 0, 0.075), (0.042, 0.042, 0.052), "NestEgg", 10, 6)
    egg.name = "Egg"
    ground_origin(egg)
    return [nest, egg]


# --- экспорт ---------------------------------------------------------------

CREATURES = [
    ("critter_butterfly", build_butterfly),
    ("critter_ladybug", build_ladybug),
    ("critter_beetle", build_beetle),
    ("critter_bee", build_bee),
    ("bird", build_bird),
    ("rabbit", build_rabbit),
    ("boar", build_boar),
    ("mushroom", build_mushroom),
    ("toadstool", build_toadstool),
    ("nest", build_nest),
]


def render(name, parts):
    """Служебный рендер пропса в PNG: посмотреть сборку, не открывая GUI."""
    size = max(
        (o.matrix_world @ v.co)[i] for o in parts for v in o.data.vertices for i in range(3)
    )
    dist = max(size, 0.05) * 3.6
    bpy.ops.object.camera_add(location=(dist, -dist, dist * 0.75))
    cam = bpy.context.active_object
    cam.rotation_euler = (math.radians(60), 0, math.radians(45))
    bpy.context.scene.camera = cam
    bpy.ops.object.light_add(type="SUN", location=(dist, -dist, dist * 2))
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = scene.render.resolution_y = 400
    scene.render.filepath = os.path.join(RENDER_DIR, name + ".png")
    bpy.ops.render.render(write_still=True)


def export(name, parts):
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(PROPS, name + ".glb"),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )


def upsert_palette(used):
    """Дописывает цвета живности в palette.json, не трогая остальные ключи."""
    with open(PALETTE, encoding="utf-8") as f:
        palette = json.load(f)
    for name in RETIRED:
        palette.pop(name, None)
    palette.update({name: COLORS[name] for name in sorted(used)})
    with open(PALETTE, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(palette.items())), f, indent=2, ensure_ascii=False)
        f.write("\n")


used_materials = set()
total = 0

for name, build in CREATURES:
    clear_scene()
    parts = build()
    export(name, parts)
    if RENDER_DIR:
        render(name, parts)
    used_materials.update(m.name for o in parts for m in o.data.materials)
    n = tris(parts)
    total += n
    print("[wildlife] {:<20} {:>5} тр.  узлы: {}".format(
        name + ".glb", n, ", ".join(o.name for o in parts)))

upsert_palette(used_materials)
print("[wildlife] всего {} тр., материалов в палитре: {}".format(total, len(used_materials)))
