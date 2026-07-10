"""
Собирает и экспортирует ТОЛЬКО public/assets/props/hero.glb.

Отдельный скрипт, а не часть _build_and_export.py, по той же причине, что и
_export_bed.py: полный прогон переставляет сцену. Герой — самостоятельный
пропс, от расстановки не зависит.

Экспортируется отдельными корневыми объектами, а не одним смерженным мешем:
    HeroBody      — туловище + голова + белки глаз, origin в основании
    HeroLegL/R    — нога со ступнёй, origin В БЕДРЕ
    HeroPupilL/R  — зрачок, origin В ЦЕНТРЕ ГЛАЗНОГО ЯБЛОКА
    HeroLidTopL/R — верхнее веко, origin ТАМ ЖЕ
    HeroLidBotL/R — нижнее веко, origin ТАМ ЖЕ

Origin ног — в бедре, а не в основании bbox (как у прочих пропсов): ногу
качает поворот вокруг её origin, и от пятки она вращалась бы как маятник
из-под земли. Ходьбу анимирует код (src/scene/Hero.tsx), в GLB анимаций нет.

Герой смотрит в +Y (Blender). После Z-up → Y-up это −Z glTF, то есть
«вперёд» three.js. Ноги разнесены по ±X и там же остаются — поэтому
шаг в коде это поворот вокруг X.

Герой — единственный пропс со сглаженными нормалями: остальная сцена
намеренно фасеточная, а на персонаже гранёная голова читается как дефект.
Сглаживание по углу (SMOOTH_ANGLE) оставляет рёбра ступни и обод конуса
острыми. Материалы героя в three собираются в Hero.tsx, а не общим
lambert() из scene.ts, — тому нужен flatShading для всей сцены.

Глаз собран из четырёх частей. Белок — неподвижная сфера, она остаётся
внутри HeroBody. Зрачок и оба века — отдельные узлы, и origin у всех трёх
в центре глазного яблока: тогда любое движение глаза это чистый поворот
вокруг origin, без сдвигов. Зрачок ездит по сфере за курсором, веки
падают и наклоняются (см. src/scene/Hero.tsx).

Веко — не плоская заслонка, а половина сферической скорлупы чуть большего
радиуса, чем белок. Такая шапка при повороте вокруг X ведёт себя как
настоящее веко: край её экватора и есть линия, режущая глаз. Поворот вокруг
оси взгляда наклоняет эту линию — из этого и лепятся злость и грусть.

Веки уезжают в GLB уже повёрнутыми в позу «глаз открыт» (LID_*_REST): это
поза покоя, и код читает её из самого узла, а не хранит второй копией. Так
клиенты фудтрака, которые клонируют модель и ничего не анимируют, смотрят
на мир открытыми глазами.

Запуск:
    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python tools/_export_hero.py
"""
import math
import os
import bmesh
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "assets", "props", "hero.glb")

# --- пропорции (Blender Z-up, метры) --------------------------------------
# Все размеры заданы для базовой фигуры и множатся на SCALE: так пропорции
# не разъезжаются, а рост меняется одним числом.
SCALE = 1.5

FOOT_H = 0.03 * SCALE
FOOT_W = 0.085 * SCALE   # по X
FOOT_D = 0.13 * SCALE    # по Y, смещена вперёд
FOOT_Y = 0.025 * SCALE   # центр ступни впереди оси ноги
BEVEL = 0.010 * SCALE    # скругление ступни, как на эскизе

LEG_R = 0.032 * SCALE
LEG_DX = 0.058 * SCALE   # разнос ног от центра
HIP_Z = 0.33 * SCALE     # верх ноги = ось качания

BODY_BOT_Z = 0.295 * SCALE   # чуть ниже бедра — стык не разъезжается
BODY_TOP_Z = 0.645 * SCALE
BODY_R_BOT = 0.195 * SCALE
BODY_R_TOP = 0.075 * SCALE

HEAD_R = 0.072 * SCALE
HEAD_CYL = 0.085 * SCALE     # цилиндрическая часть капсулы

HEIGHT = 0.85 * SCALE        # макушка; для масштаба: грядка 0.28 высотой
HEAD_BOT_Z = HEIGHT - (HEAD_CYL + 2 * HEAD_R)  # входит в плечи

# --- глаза -----------------------------------------------------------------
EYE_R = 0.036 * SCALE    # белок; диаметр ≈ половина ширины головы
EYE_DX = 0.038 * SCALE   # разнос от оси головы
EYE_Z = 0.735 * SCALE    # высота центра, внутри цилиндра капсулы
EYE_Y = 0.050 * SCALE    # центр внутри головы — белок выпирает шаром наружу
PUPIL_R = 0.014 * SCALE
PUPIL_DIR = Vector((0.0, 1.0, 0.0))  # в позе покоя зрачок смотрит строго вперёд

# Веко — скорлупа поверх белка. Зазор нужен, иначе совпадающие сферы рябят.
LID_R = EYE_R * 1.06

# Поза покоя: купол откинут за глаз, глаз открыт. При π/2 край скорлупы уходит
# ровно на горизонт яблока и веко пропадает совсем, поэтому чуть меньше —
# верхнее прикрывает заметнее нижнего, как у людей.
LID_TOP_REST = 1.36   # рад, поворот вокруг X: + наклоняет верхний купол назад
LID_BOT_REST = -1.48  # у нижнего купола «назад» — это минус

# --- плотность сетки -------------------------------------------------------
# Силуэт должен читаться круглым: конус и голова — главные, ноги тоньше.
CONE_V = 64
LEG_V = 24
HEAD_SEG, HEAD_RING = 32, 16
EYE_SEG, EYE_RING = 24, 12
PUPIL_SEG, PUPIL_RING = 16, 8
LID_SEG, LID_RING = 24, 12

# Больше — и обод конуса начнёт «затекать» в бок, меньше — гранёная голова.
SMOOTH_ANGLE = math.radians(35)


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


def shade_smooth(obj):
    """Сглаженные нормали с сохранением острых рёбер (ступня, обод конуса).

    Оператор вешает модификатор «Smooth by Angle»; export_apply его запекает,
    и в GLB уезжают уже расщеплённые нормали.
    """
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    for poly in obj.data.polygons:
        poly.use_smooth = True
    bpy.ops.object.shade_smooth_by_angle(angle=SMOOTH_ANGLE)


def finish(obj, mat):
    obj.data.materials.append(mat)
    return obj


def join(objs, name):
    """Схлопывает objs в один объект с именем name. Активным становится первый."""
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
    """Origin объекта в мировую точку point (меш не двигается)."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.context.scene.cursor.location = point
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.context.scene.cursor.location = (0, 0, 0)


def build_leg(sign, mat):
    """Нога + ступня, origin в бедре. sign = +1 (левая, +X) или −1 (правая)."""
    x = sign * LEG_DX

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=LEG_V, radius=LEG_R, depth=HIP_Z, location=(x, 0, HIP_Z / 2)
    )
    leg = finish(bpy.context.active_object, mat)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, FOOT_Y, FOOT_H / 2))
    foot = bpy.context.active_object
    foot.scale = (FOOT_W, FOOT_D, FOOT_H)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Скруглённая ступня — bevel применяем до join, иначе он съест и ногу.
    mod = foot.modifiers.new(name="Bevel", type="BEVEL")
    mod.width = BEVEL
    mod.segments = 3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    finish(foot, mat)

    obj = join([leg, foot], "HeroLegL" if sign > 0 else "HeroLegR")
    set_origin(obj, (x, 0.0, HIP_Z))
    shade_smooth(obj)
    return obj


def eye_center(sign):
    return Vector((sign * EYE_DX, EYE_Y, EYE_Z))


def half_sphere(obj, keep_top):
    """Срезает половину сферы: оставляет грани выше (или ниже) её экватора.

    Режем по ЛОКАЛЬНОМУ z: bmesh видит вершины в системе объекта, а не мира,
    и сравнение с мировой высотой глаза выкосило бы либо всё, либо ничего.
    """
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    doomed = [f for f in bm.faces if (f.calc_center_median().z < 0.0) == keep_top]
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bm.to_mesh(mesh)
    bm.free()


def build_lid(sign, top, mat):
    """Веко: половина скорлупы над белком, origin в центре глазного яблока.

    Строится закрытым (край скорлупы проходит через центр глаза) и тут же
    отклоняется в позу покоя. Код в three читает эту позу из узла GLB.
    """
    center = eye_center(sign)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=LID_SEG, ring_count=LID_RING, radius=LID_R, location=center
    )
    lid = bpy.context.active_object
    half_sphere(lid, top)
    finish(lid, mat)

    side = "L" if sign > 0 else "R"
    lid.name = "HeroLid{}{}".format("Top" if top else "Bot", side)
    set_origin(lid, center)
    shade_smooth(lid)
    lid.rotation_euler = (LID_TOP_REST if top else LID_BOT_REST, 0.0, 0.0)
    return lid


def build_eye(sign, mat_skin, mat_white, mat_pupil):
    """Белок (влить в тело), зрачок и два века (отдельные узлы)."""
    center = eye_center(sign)

    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=EYE_SEG, ring_count=EYE_RING, radius=EYE_R, location=center
    )
    white = finish(bpy.context.active_object, mat_white)

    # Зрачок сдвинут по взгляду ровно настолько, чтобы шапочкой торчать из белка.
    look = PUPIL_DIR.normalized()
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=PUPIL_SEG, ring_count=PUPIL_RING, radius=PUPIL_R,
        location=center + look * (EYE_R - PUPIL_R * 0.6),
    )
    pupil = finish(bpy.context.active_object, mat_pupil)
    pupil.name = "HeroPupil" + ("L" if sign > 0 else "R")
    # Origin в центре яблока, а не зрачка: взгляд — поворот, а не сдвиг.
    set_origin(pupil, center)
    shade_smooth(pupil)

    lids = [build_lid(sign, True, mat_skin), build_lid(sign, False, mat_skin)]
    return white, [pupil, *lids]


def build_body(mat, mat_white, mat_pupil):
    """Конус-туловище + капсула-голова + глаза, origin в мировом нуле (на земле)."""
    bpy.ops.mesh.primitive_cone_add(
        vertices=CONE_V,
        radius1=BODY_R_BOT,
        radius2=BODY_R_TOP,
        depth=BODY_TOP_Z - BODY_BOT_Z,
        location=(0, 0, (BODY_BOT_Z + BODY_TOP_Z) / 2),
    )
    torso = finish(bpy.context.active_object, mat)

    # Капсула = цилиндр + две полусферы (в Blender нет примитива-капсулы).
    cyl_bot = HEAD_BOT_Z + HEAD_R
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=HEAD_SEG, radius=HEAD_R, depth=HEAD_CYL,
        location=(0, 0, cyl_bot + HEAD_CYL / 2),
    )
    neck = finish(bpy.context.active_object, mat)

    caps = []
    for z in (cyl_bot, cyl_bot + HEAD_CYL):
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=HEAD_SEG, ring_count=HEAD_RING, radius=HEAD_R, location=(0, 0, z)
        )
        caps.append(finish(bpy.context.active_object, mat))

    white_l, parts_l = build_eye(+1, mat, mat_white, mat_pupil)
    white_r, parts_r = build_eye(-1, mat, mat_white, mat_pupil)

    # Материал первого объекта становится нулевым слотом; порядок белков неважен,
    # GLB всё равно режет меш на примитивы по материалам. Зрачки и веки в тело
    # не вливаем — они узлы, их крутит код.
    obj = join([torso, neck, *caps, white_l, white_r], "HeroBody")
    set_origin(obj, (0.0, 0.0, 0.0))
    shade_smooth(obj)
    return obj, [*parts_l, *parts_r]


clear_scene()

mat_hero = make_mat("Hero", (0.10, 0.14, 0.20))
mat_eye = make_mat("HeroEyeWhite", (0.97, 0.97, 0.96))
mat_pupil = make_mat("HeroEyePupil", (0.05, 0.05, 0.07))

body, face = build_body(mat_hero, mat_eye, mat_pupil)
leg_l = build_leg(+1, mat_hero)
leg_r = build_leg(-1, mat_hero)
parts = [body, leg_l, leg_r, *face]

bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = body

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

tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in parts)
print("[hero] экспортирован герой: {} тр., высота {:.3f}, бедро z={:.3f}".format(
    tris, HEIGHT, HIP_Z))
for o in parts:
    print("  {:<10} origin={}".format(
        o.name, tuple(round(c, 3) for c in o.location)))
