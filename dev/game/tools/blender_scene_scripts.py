"""
============================================================================
  ФЕРМА → ФУДТРАК — Все скрипты сборки low-poly сцены в Blender
============================================================================

  Запускать последовательно в Blender (Edit → Preferences → Add-ons → MCP,
  или вставлять по одному в Scripting → Text Editor → Run Script).

  Blender 5.1 / Python 3.x
  Порядок выполнения: 01 → 02 → 03 → 04 → 05 → 06 → 07

  Скрипты 02 и 03 — это фиксы масштаба, которые удаляют и пересоздают
  дом, дорожку, грядки и теплицу. Если строишь с нуля — можно
  пропустить 01 и запускать сразу 03 (он содержит финальные версии).
============================================================================
"""


# ======================================================================
# 01 — НАЧАЛЬНАЯ СЦЕНА: земля, дом, лес, кусты с цветами, освещение
# ======================================================================

import bpy, random, math

random.seed(42)

def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

clear_scene()

def make_mat(name, color, roughness=0.9):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
    return mat

mat_grass = make_mat("Grass", (0.35, 0.55, 0.2))
mat_trunk = make_mat("Trunk", (0.32, 0.2, 0.12))
mat_leaves1 = make_mat("Leaves1", (0.09, 0.35, 0.14))
mat_leaves2 = make_mat("Leaves2", (0.13, 0.45, 0.18))
mat_wall = make_mat("Wall", (0.85, 0.75, 0.55))
mat_roof = make_mat("Roof", (0.55, 0.18, 0.14))
mat_door = make_mat("Door", (0.25, 0.14, 0.08))
mat_window = make_mat("Window", (0.6, 0.8, 0.9), 0.2)
mat_bush = make_mat("Bush", (0.14, 0.4, 0.16))
flower_colors = [(0.95,0.3,0.4), (0.95,0.85,0.2), (0.95,0.95,0.95), (0.6,0.3,0.8)]
flower_mats = [make_mat(f"Flower{i}", c, 0.4) for i,c in enumerate(flower_colors)]

def shade_flat(obj):
    for p in obj.data.polygons:
        p.use_smooth = False

# --- Земля ---
bpy.ops.mesh.primitive_plane_add(size=40, location=(0,0,0))
ground = bpy.context.active_object
ground.name = "Ground"
ground.data.materials.append(mat_grass)

# --- Дом (первая версия — позже пересобирается в скрипте 03) ---
house_w, house_d, house_h = 3.0, 3.0, 2.0
bpy.ops.mesh.primitive_cube_add(size=1, location=(0,0,house_h/2))
walls = bpy.context.active_object
walls.name = "House_Walls"
walls.scale = (house_w/2, house_d/2, house_h/2)
bpy.ops.object.transform_apply(scale=True)
walls.data.materials.append(mat_wall)
shade_flat(walls)

bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=house_w*0.8, depth=1.4, location=(0,0,house_h+0.7))
roof = bpy.context.active_object
roof.name = "House_Roof"
roof.rotation_euler[2] = math.radians(45)
bpy.ops.object.transform_apply(rotation=True)
roof.data.materials.append(mat_roof)
shade_flat(roof)

# Дверь (передняя стена -Y)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -house_d/2 - 0.02, 0.55))
door = bpy.context.active_object
door.name = "Door"
door.scale = (0.5, 0.05, 0.55)
bpy.ops.object.transform_apply(scale=True)
door.data.materials.append(mat_door)
shade_flat(door)

# Окна на фасаде
for wx in (-0.9, 0.9):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(wx, -house_d/2 - 0.02, 1.3))
    win = bpy.context.active_object
    win.name = "Window"
    win.scale = (0.3, 0.05, 0.3)
    bpy.ops.object.transform_apply(scale=True)
    win.data.materials.append(mat_window)
    shade_flat(win)

# --- Генератор ёлок ---
def create_tree(x, y, scale=1.0):
    trunk_h = 0.6*scale
    bpy.ops.mesh.primitive_cylinder_add(radius=0.08*scale, depth=trunk_h, vertices=6, location=(x,y,trunk_h/2))
    trunk = bpy.context.active_object
    trunk.data.materials.append(mat_trunk)
    shade_flat(trunk)

    parts = [trunk]
    tiers = 3
    base_r = 0.65*scale
    base_h = 0.9*scale
    z = trunk_h
    for i in range(tiers):
        r = base_r * (1 - i*0.22)
        h = base_h * (1 - i*0.12)
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=r, depth=h, location=(x,y,z + h/2*0.85))
        cone = bpy.context.active_object
        mat = mat_leaves1 if i % 2 == 0 else mat_leaves2
        cone.data.materials.append(mat)
        shade_flat(cone)
        parts.append(cone)
        z += h*0.55

    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    tree = bpy.context.active_object
    tree.name = f"Tree_{x:.1f}_{y:.1f}"
    return tree

# Лес по периметру поляны
num_trees = 55
for i in range(num_trees):
    angle = random.uniform(0, math.pi*2)
    radius = random.uniform(7.5, 16)
    x = math.cos(angle)*radius
    y = math.sin(angle)*radius
    s = random.uniform(0.8, 1.5)
    create_tree(x, y, s)

# Дополнительные деревья ближе к опушке
extra = 10
tries = 0
placed = 0
while placed < extra and tries < 200:
    tries += 1
    x = random.uniform(-9, 9)
    y = random.uniform(-9, 9)
    if abs(x) < 4.5 and abs(y) < 4.5:
        continue
    if math.hypot(x,y) > 16:
        continue
    s = random.uniform(0.7, 1.3)
    create_tree(x, y, s)
    placed += 1

# --- Кусты с цветами у двери ---
def create_bush(x, y, scale=1.0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.35*scale, location=(x,y,0.3*scale))
    bush = bpy.context.active_object
    bush.scale = (1.2, 1.0, 0.8)
    bpy.ops.object.transform_apply(scale=True)
    bush.data.materials.append(mat_bush)
    shade_flat(bush)
    bush.name = f"Bush_{x:.1f}_{y:.1f}"

    parts = [bush]
    n_flowers = random.randint(4,6)
    for i in range(n_flowers):
        fx = x + random.uniform(-0.3,0.3)*scale
        fy = y + random.uniform(-0.25,0.25)*scale
        fz = 0.35*scale + random.uniform(0.05,0.2)*scale
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.06*scale, location=(fx,fy,fz))
        fl = bpy.context.active_object
        mat = random.choice(flower_mats)
        fl.data.materials.append(mat)
        shade_flat(fl)
        parts.append(fl)

    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    return bpy.context.active_object

door_y = -house_d/2 - 0.6
create_bush(-1.4, door_y, 1.1)
create_bush(1.4, door_y, 1.1)

# --- Освещение и камера ---
bpy.ops.object.light_add(type='SUN', location=(10,-10,15))
sun = bpy.context.active_object
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(55), 0, math.radians(35))

bpy.ops.object.camera_add(location=(9, -12, 6), rotation=(math.radians(70), 0, math.radians(35)))
cam = bpy.context.active_object
bpy.context.scene.camera = cam


# ======================================================================
# 02 — ДОБАВЛЕНИЕ: окна по сторонам, кирпичная дорожка, зона костра,
#       сад (грядки + зелень + морковь + помидоры + теплица)
#       ⚠ Этот скрипт содержал баг масштаба (cube size=1 + scale/2).
#       Скрипт 03 ниже пересоздаёт эти объекты с правильным масштабом.
# ======================================================================

import bpy, bmesh, math, random

random.seed(7)

def make_mat(name, color, roughness=0.9, emission=0.0):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission
            bsdf.inputs["Emission Color"].default_value = (*color, 1.0)
    return mat

def shade_flat(obj):
    for p in obj.data.polygons:
        p.use_smooth = False

def world_bbox_minz(obj):
    coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
    return min(c.z for c in coords)

def sit_on_ground(obj):
    minz = world_bbox_minz(obj)
    obj.location.z -= minz

def join_objects(objs, active=None, name=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]
    bpy.ops.object.join()
    result_obj = bpy.context.active_object
    if name:
        result_obj.name = name
    return result_obj

house_w, house_d, house_h = 3.0, 3.0, 2.0
mat_window = make_mat("Window", (0.6, 0.8, 0.9), 0.2)

def add_window(x, y, z, rot_z, sx=0.3, sy=0.05, sz=0.3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
    win = bpy.context.active_object
    win.rotation_euler[2] = math.radians(rot_z)
    win.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    win.data.materials.append(mat_window)
    shade_flat(win)
    win.name = "Window_extra"
    return win

# Дополнительные окна (бока + задняя стена)
add_window(-house_w/2 - 0.02, 0, 1.3, 90)
add_window(house_w/2 + 0.02, 0, 1.3, 90)
add_window(0, house_d/2 + 0.02, 1.3, 0)

# Объединить все части дома
house_prefixes = ("House_Walls", "House_Roof", "Door", "Window")
house_objs = [o for o in bpy.data.objects if o.name.startswith(house_prefixes)]
walls_obj = bpy.data.objects.get("House_Walls")
house = join_objects(house_objs, active=walls_obj, name="House")
sit_on_ground(house)

# Кусты — на землю
bush_objs = [o for o in bpy.data.objects if o.name.startswith("Bush_")]
for b in bush_objs:
    sit_on_ground(b)

# --- Кирпичная дорожка ---
mat_brick = make_mat("Brick", (0.55, 0.22, 0.16), 0.85)
path_y = -house_d/2 - 0.6
brick_len, brick_wid, brick_h = 0.4, 0.22, 0.08
bricks = []
x = -9.0
while x <= 9.0:
    for row, yo in enumerate((-0.18, 0.18)):
        jitter_x = random.uniform(-0.02, 0.02)
        jitter_rot = random.uniform(-4, 4)
        bx = x + (0.2 if row == 1 else 0.0) + jitter_x
        by = path_y + yo
        bpy.ops.mesh.primitive_cube_add(size=1, location=(bx, by, brick_h/2))
        brick = bpy.context.active_object
        brick.scale = (brick_len/2, brick_wid/2, brick_h/2)
        brick.rotation_euler[2] = math.radians(jitter_rot)
        bpy.ops.object.transform_apply(rotation=True, scale=True)
        brick.data.materials.append(mat_brick)
        shade_flat(brick)
        bricks.append(brick)
    x += brick_len + 0.05

path = join_objects(bricks, name="BrickPath")

# --- ЗОНА КОСТРА (правая часть) ---
fire_x, fire_y = 6.5, -2.0

mat_stone = make_mat("Stone", (0.5, 0.5, 0.5), 0.95)
mat_wood_log = make_mat("WoodLog", (0.28, 0.17, 0.1), 0.85)
mat_fire_outer = make_mat("FireOuter", (0.9, 0.35, 0.05), 0.4, emission=2.0)
mat_fire_inner = make_mat("FireInner", (1.0, 0.8, 0.1), 0.4, emission=3.0)
mat_table_top = make_mat("TableTop", (0.45, 0.3, 0.18), 0.8)

# Камни по кругу
stones = []
n_stones = 9
for i in range(n_stones):
    ang = 2*math.pi*i/n_stones
    sx = fire_x + math.cos(ang)*0.65
    sy = fire_y + math.sin(ang)*0.65
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=random.uniform(0.12, 0.18), location=(sx, sy, 0.1))
    st = bpy.context.active_object
    st.scale.z = 0.6
    bpy.ops.object.transform_apply(scale=True)
    st.data.materials.append(mat_stone)
    shade_flat(st)
    stones.append(st)

# Дрова
fuel = []
for rot in (20, -25, 70):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.7, vertices=6, location=(fire_x, fire_y, 0.08))
    lg = bpy.context.active_object
    lg.rotation_euler = (math.radians(90), 0, math.radians(rot))
    bpy.ops.object.transform_apply(rotation=True)
    lg.data.materials.append(mat_wood_log)
    shade_flat(lg)
    fuel.append(lg)

# Пламя (два конуса)
bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=0.28, depth=0.7, location=(fire_x, fire_y, 0.35))
flame_outer = bpy.context.active_object
flame_outer.data.materials.append(mat_fire_outer)
shade_flat(flame_outer)

bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.15, depth=0.45, location=(fire_x, fire_y, 0.45))
flame_inner = bpy.context.active_object
flame_inner.data.materials.append(mat_fire_inner)
shade_flat(flame_inner)

campfire_parts = stones + fuel + [flame_outer, flame_inner]
campfire = join_objects(campfire_parts, name="Campfire")

# Точечный свет костра
bpy.ops.object.light_add(type='POINT', location=(fire_x, fire_y, 0.5))
fire_light = bpy.context.active_object
fire_light.data.energy = 120
fire_light.data.color = (1.0, 0.55, 0.15)
fire_light.name = "FireLight"

# Два бревна-сиденья
def add_sitting_log(x, y, rot_z):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=1.3, vertices=8, location=(x, y, 0.22))
    log = bpy.context.active_object
    log.rotation_euler = (math.radians(90), 0, math.radians(rot_z))
    bpy.ops.object.transform_apply(rotation=True)
    log.data.materials.append(mat_wood_log)
    shade_flat(log)
    log.name = "SitLog"
    sit_on_ground(log)
    return log

add_sitting_log(fire_x - 0.2, fire_y + 1.3, 10)
add_sitting_log(fire_x + 1.3, fire_y - 0.6, 100)

# Бревно-стол
bpy.ops.mesh.primitive_cylinder_add(radius=0.35, depth=0.55, vertices=8, location=(fire_x + 1.4, fire_y + 1.2, 0.275))
table = bpy.context.active_object
table.data.materials.append(mat_wood_log)
shade_flat(table)

bpy.ops.mesh.primitive_cylinder_add(radius=0.38, depth=0.05, vertices=8, location=(fire_x + 1.4, fire_y + 1.2, 0.58))
table_top = bpy.context.active_object
table_top.data.materials.append(mat_table_top)
shade_flat(table_top)

table = join_objects([table, table_top], name="LogTable")
sit_on_ground(table)

# --- САД (левая часть) ---
mat_soil = make_mat("Soil", (0.28, 0.18, 0.12), 0.95)
mat_bed_wood = make_mat("BedWood", (0.42, 0.28, 0.16), 0.85)
mat_greens = make_mat("Greens", (0.25, 0.6, 0.2), 0.7)
mat_carrot_body = make_mat("CarrotBody", (0.85, 0.42, 0.1), 0.6)
mat_carrot_top = make_mat("CarrotTop", (0.2, 0.55, 0.18), 0.7)
mat_tomato_leaf = make_mat("TomatoLeaf", (0.2, 0.5, 0.15), 0.7)
mat_tomato_fruit = make_mat("TomatoFruit", (0.8, 0.1, 0.08), 0.4)
mat_glass = make_mat("GreenhouseGlass", (0.75, 0.9, 0.95), 0.15)
mat_frame = make_mat("GreenhouseFrame", (0.9, 0.9, 0.9), 0.6)

def add_raised_bed(x, y, w=1.6, d=0.6, h=0.28):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, h/2))
    frame = bpy.context.active_object
    frame.scale = (w/2, d/2, h/2)
    bpy.ops.object.transform_apply(scale=True)
    frame.data.materials.append(mat_bed_wood)
    shade_flat(frame)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, h*0.75))
    soil = bpy.context.active_object
    soil.scale = (w/2*0.92, d/2*0.85, h/2*0.5)
    bpy.ops.object.transform_apply(scale=True)
    soil.data.materials.append(mat_soil)
    shade_flat(soil)

    bed = join_objects([frame, soil], name="RaisedBed")
    sit_on_ground(bed)
    return bed, x, y, h

def add_greens_tuft(x, y, base_z):
    parts = []
    for i in range(5):
        ox = x + random.uniform(-0.15, 0.15)
        oy = y + random.uniform(-0.15, 0.15)
        h = random.uniform(0.18, 0.3)
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.02, depth=h, location=(ox, oy, base_z + h/2))
        blade = bpy.context.active_object
        blade.rotation_euler = (random.uniform(-0.2, 0.2), random.uniform(-0.2, 0.2), random.uniform(0, 6.28))
        bpy.ops.object.transform_apply(rotation=True)
        blade.data.materials.append(mat_greens)
        shade_flat(blade)
        parts.append(blade)
    return join_objects(parts, name="Greens")

def add_carrot(x, y, base_z):
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.05, depth=0.12, location=(x, y, base_z + 0.02))
    body = bpy.context.active_object
    body.rotation_euler[0] = math.radians(180)
    bpy.ops.object.transform_apply(rotation=True)
    body.data.materials.append(mat_carrot_body)
    shade_flat(body)

    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.015, depth=0.14, location=(x, y, base_z + 0.1))
    top = bpy.context.active_object
    top.data.materials.append(mat_carrot_top)
    shade_flat(top)
    return join_objects([body, top], name="Carrot")

def add_tomato_bush(x, y, base_z):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.22, location=(x, y, base_z + 0.2))
    bush = bpy.context.active_object
    bush.data.materials.append(mat_tomato_leaf)
    shade_flat(bush)
    parts = [bush]
    for i in range(4):
        fx = x + random.uniform(-0.15, 0.15)
        fy = y + random.uniform(-0.15, 0.15)
        fz = base_z + 0.15 + random.uniform(0, 0.2)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.04, location=(fx, fy, fz))
        fr = bpy.context.active_object
        fr.data.materials.append(mat_tomato_fruit)
        shade_flat(fr)
        parts.append(fr)
    return join_objects(parts, name="TomatoBush")

bed_positions = [(-6.0, -1.6), (-6.0, -2.6), (-7.8, -2.1)]
for bx, by in bed_positions:
    bed, cx, cy, bh = add_raised_bed(bx, by)
    top_z = bh
    add_greens_tuft(cx - 0.45, cy, top_z)
    add_carrot(cx - 0.1, cy, top_z)
    add_carrot(cx + 0.15, cy, top_z)
    add_tomato_bush(cx + 0.5, cy, top_z)

# --- Теплица ---
gh_x, gh_y = -9.0, -2.0
gh_w, gh_d, gh_h = 1.8, 1.4, 1.3
bpy.ops.mesh.primitive_cube_add(size=1, location=(gh_x, gh_y, gh_h/2))
gh_body = bpy.context.active_object
gh_body.scale = (gh_w/2, gh_d/2, gh_h/2)
bpy.ops.object.transform_apply(scale=True)
gh_body.data.materials.append(mat_glass)
shade_flat(gh_body)

bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=gh_w*0.78, depth=0.7, location=(gh_x, gh_y, gh_h + 0.35))
gh_roof = bpy.context.active_object
gh_roof.rotation_euler[2] = math.radians(45)
bpy.ops.object.transform_apply(rotation=True)
gh_roof.data.materials.append(mat_glass)
shade_flat(gh_roof)

frame_parts = []
for cx_off in (-gh_w/2, gh_w/2):
    for cy_off in (-gh_d/2, gh_d/2):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=gh_h, vertices=4, location=(gh_x+cx_off, gh_y+cy_off, gh_h/2))
        post = bpy.context.active_object
        post.data.materials.append(mat_frame)
        shade_flat(post)
        frame_parts.append(post)

greenhouse = join_objects([gh_body, gh_roof] + frame_parts, name="Greenhouse")
sit_on_ground(greenhouse)


# ======================================================================
# 03 — ФИКС МАСШТАБА: пересборка дома, дорожки, грядок, теплицы
#       Удаляет объекты из скриптов 01–02 и пересоздаёт с правильным
#       масштабом (cube size=1 → scale = ПОЛНЫЙ размер, не половина).
# ======================================================================

import bpy, math, random

random.seed(7)

def make_mat(name, color, roughness=0.9):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
    return mat

def shade_flat(obj):
    for p in obj.data.polygons:
        p.use_smooth = False

def world_bbox_minz(obj):
    coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
    return min(c.z for c in coords)

def sit_on_ground(obj):
    minz = world_bbox_minz(obj)
    obj.location.z -= minz

def join_objects(objs, active=None, name=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]
    bpy.ops.object.join()
    r = bpy.context.active_object
    if name:
        r.name = name
    return r

# Удаляем сломанные объекты
for nm in ("House", "BrickPath", "Greenhouse", "RaisedBed", "RaisedBed.001", "RaisedBed.002"):
    o = bpy.data.objects.get(nm)
    if o:
        bpy.data.objects.remove(o, do_unlink=True)

mat_wall = make_mat("Wall", (0.85, 0.75, 0.55))
mat_roof = make_mat("Roof", (0.55, 0.18, 0.14))
mat_door = make_mat("Door", (0.25, 0.14, 0.08))
mat_window = make_mat("Window", (0.6, 0.8, 0.9), 0.2)
mat_brick = make_mat("Brick", (0.55, 0.22, 0.16), 0.85)
mat_soil = make_mat("Soil", (0.28, 0.18, 0.12), 0.95)
mat_bed_wood = make_mat("BedWood", (0.42, 0.28, 0.16), 0.85)
mat_glass = make_mat("GreenhouseGlass", (0.75, 0.9, 0.95), 0.15)
mat_frame = make_mat("GreenhouseFrame", (0.9, 0.9, 0.9), 0.6)

house_w, house_d, house_h = 3.0, 3.0, 2.0

# --- Стены (исправленный масштаб) ---
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, house_h/2))
walls = bpy.context.active_object
walls.name = "H_Walls"
walls.scale = (house_w, house_d, house_h)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
walls.data.materials.append(mat_wall)
shade_flat(walls)

# --- Крыша ---
overhang = 0.5
roof_r = (house_w/2 + overhang) / math.cos(math.radians(45))
roof_h = 1.1
bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=roof_r, depth=roof_h, location=(0, 0, house_h + roof_h/2))
roof = bpy.context.active_object
roof.name = "H_Roof"
roof.rotation_euler[2] = math.radians(45)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
roof.data.materials.append(mat_roof)
shade_flat(roof)

# --- Дверь ---
door_w, door_h, door_t = 0.8, 1.4, 0.08
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -house_d/2 - door_t/2, door_h/2))
door = bpy.context.active_object
door.name = "H_Door"
door.scale = (door_w, door_t, door_h)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
door.data.materials.append(mat_door)
shade_flat(door)

# --- Окна (5 штук, без rotation) ---
def add_window(cx, cy, cz, facing, w=0.5, h=0.5, t=0.06):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz))
    win = bpy.context.active_object
    if facing in ('front', 'back'):
        win.scale = (w, t, h)
    else:
        win.scale = (t, w, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    win.data.materials.append(mat_window)
    shade_flat(win)
    win.name = "H_Window"
    return win

wz = 1.25
windows = [
    add_window(-0.8, -house_d/2 - 0.03, wz, 'front'),
    add_window(0.8, -house_d/2 - 0.03, wz, 'front'),
    add_window(-house_w/2 - 0.03, 0, wz, 'left'),
    add_window(house_w/2 + 0.03, 0, wz, 'right'),
    add_window(0, house_d/2 + 0.03, wz, 'back'),
]

house = join_objects([walls, roof, door] + windows, active=walls, name="House")
sit_on_ground(house)

# --- Дорожка (исправленный масштаб) ---
path_y = -house_d/2 - 0.6
brick_len, brick_wid, brick_h = 0.4, 0.22, 0.08
bricks = []
x = -9.0
while x <= 9.0:
    for row, yo in enumerate((-0.18, 0.18)):
        jitter_x = random.uniform(-0.02, 0.02)
        jitter_rot = random.uniform(-4, 4)
        bx = x + (0.2 if row == 1 else 0.0) + jitter_x
        by = path_y + yo
        bpy.ops.mesh.primitive_cube_add(size=1, location=(bx, by, brick_h/2))
        brick = bpy.context.active_object
        brick.scale = (brick_len, brick_wid, brick_h)
        brick.rotation_euler[2] = math.radians(jitter_rot)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        brick.data.materials.append(mat_brick)
        shade_flat(brick)
        bricks.append(brick)
    x += brick_len + 0.05

path = join_objects(bricks, name="BrickPath")
sit_on_ground(path)

# --- Грядки (исправленный масштаб) ---
def add_raised_bed(x, y, w=1.6, d=0.6, h=0.28):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, h/2))
    frame = bpy.context.active_object
    frame.scale = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    frame.data.materials.append(mat_bed_wood)
    shade_flat(frame)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, h*0.75))
    soil = bpy.context.active_object
    soil.scale = (w*0.92, d*0.85, h*0.5)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    soil.data.materials.append(mat_soil)
    shade_flat(soil)

    bed = join_objects([frame, soil], name="RaisedBed")
    sit_on_ground(bed)
    return bed

bed_positions = [(-6.0, -1.6), (-6.0, -2.6), (-7.8, -2.1)]
beds = [add_raised_bed(bx, by) for bx, by in bed_positions]

# --- Теплица (исправленный масштаб) ---
gh_x, gh_y = -9.0, -2.0
gh_w, gh_d, gh_h = 1.8, 1.4, 1.3
bpy.ops.mesh.primitive_cube_add(size=1, location=(gh_x, gh_y, gh_h/2))
gh_body = bpy.context.active_object
gh_body.scale = (gh_w, gh_d, gh_h)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
gh_body.data.materials.append(mat_glass)
shade_flat(gh_body)

bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=gh_w*0.78, depth=0.7, location=(gh_x, gh_y, gh_h + 0.35))
gh_roof = bpy.context.active_object
gh_roof.rotation_euler[2] = math.radians(45)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
gh_roof.data.materials.append(mat_glass)
shade_flat(gh_roof)

frame_parts = []
for cx_off in (-gh_w/2, gh_w/2):
    for cy_off in (-gh_d/2, gh_d/2):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=gh_h, vertices=4, location=(gh_x+cx_off, gh_y+cy_off, gh_h/2))
        post = bpy.context.active_object
        post.data.materials.append(mat_frame)
        shade_flat(post)
        frame_parts.append(post)

greenhouse = join_objects([gh_body, gh_roof] + frame_parts, name="Greenhouse")
sit_on_ground(greenhouse)


# ======================================================================
# 04 — АНИМАЦИЯ: пульсация костра, цветение бутонов, покачивание ветром
# ======================================================================

import bpy, math, random, mathutils

random.seed(123)
scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = 260
scene.frame_current = 1

def get_action_fcurves(action):
    """Совместимость с Blender 5.1 (Layered Actions)."""
    out = []
    if action is None:
        return out
    if hasattr(action, "fcurves"):
        try:
            fc = list(action.fcurves)
            if fc:
                return fc
        except Exception:
            pass
    try:
        for layer in action.layers:
            for strip in layer.strips:
                cbs = getattr(strip, "channelbags", None)
                if cbs:
                    for cb in cbs:
                        out.extend(list(cb.fcurves))
    except Exception:
        pass
    return out

def add_cycle(fcurve):
    m = fcurve.modifiers.new(type='CYCLES')
    m.mode_before = 'REPEAT'
    m.mode_after = 'REPEAT'

def bezier_all(fcurve):
    for kp in fcurve.keyframe_points:
        kp.interpolation = 'BEZIER'
        kp.handle_left_type = 'AUTO_CLAMPED'
        kp.handle_right_type = 'AUTO_CLAMPED'

# --- A) Пламя костра: полупрозрачность + пульсация свечения ---
def animate_fire(mat_name, period, low, high, phase):
    mat = bpy.data.materials.get(mat_name)
    if not mat or not mat.use_nodes:
        return
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if not bsdf:
        return
    if "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = 0.45
    mat.blend_method = 'BLEND'
    if "Emission Strength" not in bsdf.inputs:
        return
    inp = bsdf.inputs["Emission Strength"]
    base = 1 + phase
    seq = [(base, low), (base+period*0.25, high), (base+period*0.5, low*1.1),
           (base+period*0.75, high*0.75), (base+period, low)]
    for f, v in seq:
        inp.default_value = v
        inp.keyframe_insert(data_path="default_value", frame=f)
    action = mat.node_tree.animation_data.action
    for fc in get_action_fcurves(action):
        bezier_all(fc)
        add_cycle(fc)

animate_fire("FireOuter", period=55, low=1.3, high=2.8, phase=0)
animate_fire("FireInner", period=42, low=2.0, high=3.8, phase=8)

# --- B) Разделение цветов из кустов и анимация bloom ---
def separate_loose(obj_name):
    obj = bpy.data.objects.get(obj_name)
    if not obj:
        return []
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='LOOSE')
    bpy.ops.object.mode_set(mode='OBJECT')
    return list(bpy.context.selected_objects)

for bname in ["Bush_-1.4_-2.1", "Bush_1.4_-2.1"]:
    separate_loose(bname)

# --- C) Покачивание зелени / моркови ---
def bbox_world_base(obj):
    coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
    xs = [c.x for c in coords]; ys = [c.y for c in coords]; zs = [c.z for c in coords]
    return mathutils.Vector(((min(xs)+max(xs))/2, (min(ys)+max(ys))/2, min(zs)))

def set_origin(obj, point):
    saved = bpy.context.scene.cursor.location.copy()
    bpy.context.scene.cursor.location = point
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.context.scene.cursor.location = saved

def animate_sway(obj, amp_deg, period, phase, axis_index):
    base = 1 + phase
    amp = math.radians(amp_deg)
    seq = [(base, 0), (base+period*0.25, amp), (base+period*0.5, -amp*0.3),
           (base+period*0.75, amp*0.6), (base+period, 0)]
    for f, v in seq:
        rot = list(obj.rotation_euler)
        rot[axis_index] = v
        obj.rotation_euler = rot
        obj.keyframe_insert(data_path="rotation_euler", index=axis_index, frame=f)
    action = obj.animation_data.action if obj.animation_data else None
    for fc in get_action_fcurves(action):
        if fc.data_path == "rotation_euler" and fc.array_index == axis_index:
            bezier_all(fc)
            add_cycle(fc)

sway_targets = [o for o in bpy.data.objects if o.name.startswith("Greens") or o.name.startswith("Carrot")]
for o in sway_targets:
    pt = bbox_world_base(o)
    set_origin(o, pt)
    axis = random.choice([0, 1])
    animate_sway(o, amp_deg=random.uniform(5, 11), period=random.uniform(45, 85), phase=random.uniform(0, 60), axis_index=axis)


# ======================================================================
# 05 — АНИМАЦИЯ ЦВЕТОВ (bloom): отдельный проход после separate_loose
# ======================================================================

import bpy, math, random

random.seed(321)

def get_action_fcurves(action):
    out = []
    if action is None:
        return out
    if hasattr(action, "fcurves"):
        try:
            fc = list(action.fcurves)
            if fc:
                return fc
        except Exception:
            pass
    try:
        for layer in action.layers:
            for strip in layer.strips:
                cbs = getattr(strip, "channelbags", None)
                if cbs:
                    for cb in cbs:
                        out.extend(list(cb.fcurves))
    except Exception:
        pass
    return out

def add_cycle(fcurve):
    m = fcurve.modifiers.new(type='CYCLES')
    m.mode_before = 'REPEAT'
    m.mode_after = 'REPEAT'

def bezier_all(fcurve):
    for kp in fcurve.keyframe_points:
        kp.interpolation = 'BEZIER'
        kp.handle_left_type = 'AUTO_CLAMPED'
        kp.handle_right_type = 'AUTO_CLAMPED'

def real_material_name(obj):
    if not obj.data.polygons:
        return None
    idx = obj.data.polygons[0].material_index
    mats = obj.data.materials
    if idx < len(mats) and mats[idx]:
        return mats[idx].name
    return None

candidate_names = ["Bush_-1.4_-2.002","Bush_-1.4_-2.003","Bush_-1.4_-2.004","Bush_-1.4_-2.005","Bush_-1.4_-2.1",
                    "Bush_1.4_-2.002","Bush_1.4_-2.003","Bush_1.4_-2.004","Bush_1.4_-2.005",
                    "Bush_1.4_-2.006","Bush_1.4_-2.007","Bush_1.4_-2.1"]

flower_objs = []
for name in candidate_names:
    o = bpy.data.objects.get(name)
    if not o:
        continue
    mn = real_material_name(o)
    if mn and mn.startswith("Flower"):
        flower_objs.append(o)

def animate_bloom(obj, period, phase, closed=0.35, opened=1.15):
    base = 1 + phase
    seq = [(base, closed), (base+period*0.22, opened*0.65), (base+period*0.45, opened),
           (base+period*0.75, opened*0.55), (base+period, closed)]
    for f, v in seq:
        obj.scale = (v, v, v)
        obj.keyframe_insert(data_path="scale", frame=f)
    action = obj.animation_data.action if obj.animation_data else None
    for fc in get_action_fcurves(action):
        if fc.data_path == "scale":
            bezier_all(fc)
            add_cycle(fc)

for fo in flower_objs:
    animate_bloom(fo, period=random.uniform(160, 220), phase=random.uniform(0, 120))


# ======================================================================
# 06 — БОЖЬЯ КОРОВКА: сборка модели + анимация маршрута
# ======================================================================

import bpy, math, random

random.seed(55)

def make_mat(name, color, roughness=0.9):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
    return mat

def shade_flat(obj):
    for p in obj.data.polygons:
        p.use_smooth = False

def world_bbox_minz(obj):
    coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
    return min(c.z for c in coords)

def sit_on_ground(obj):
    minz = world_bbox_minz(obj)
    obj.location.z -= minz

def join_objects(objs, active=None, name=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]
    bpy.ops.object.join()
    r = bpy.context.active_object
    if name:
        r.name = name
    return r

def get_action_fcurves(action):
    out = []
    if action is None:
        return out
    if hasattr(action, "fcurves"):
        try:
            fc = list(action.fcurves)
            if fc:
                return fc
        except Exception:
            pass
    try:
        for layer in action.layers:
            for strip in layer.strips:
                cbs = getattr(strip, "channelbags", None)
                if cbs:
                    for cb in cbs:
                        out.extend(list(cb.fcurves))
    except Exception:
        pass
    return out

def add_cycle(fcurve):
    m = fcurve.modifiers.new(type='CYCLES')
    m.mode_before = 'REPEAT'
    m.mode_after = 'REPEAT'

def bezier_all(fcurve):
    for kp in fcurve.keyframe_points:
        kp.interpolation = 'BEZIER'
        kp.handle_left_type = 'AUTO_CLAMPED'
        kp.handle_right_type = 'AUTO_CLAMPED'

# Удалить старую, если есть
old = bpy.data.objects.get("Ladybug")
if old:
    bpy.data.objects.remove(old, do_unlink=True)

mat_lb_red = make_mat("LadybugRed", (0.85, 0.08, 0.05), 0.35)
mat_lb_black = make_mat("LadybugBlack", (0.03, 0.03, 0.03), 0.4)

# --- Модель божьей коровки (forward = +X) ---
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.22, location=(0, 0, 0.13))
body = bpy.context.active_object
body.scale = (1.0, 1.15, 0.62)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
body.data.materials.append(mat_lb_red)
shade_flat(body)
parts = [body]

# Голова
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.09, location=(0.24, 0, 0.11))
head = bpy.context.active_object
head.data.materials.append(mat_lb_black)
shade_flat(head)
parts.append(head)

# Центральная полоска
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.02, 0, 0.24))
line = bpy.context.active_object
line.scale = (0.24, 0.02, 0.02)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
line.data.materials.append(mat_lb_black)
shade_flat(line)
parts.append(line)

# Пятнышки
spot_positions = [(-0.05, 0.13, 0.22), (-0.05, -0.13, 0.22), (0.05, 0.2, 0.19),
                   (0.05, -0.2, 0.19), (-0.16, 0.08, 0.18), (-0.16, -0.08, 0.18)]
for sx, sy, sz in spot_positions:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.035, location=(sx, sy, sz))
    sp = bpy.context.active_object
    sp.data.materials.append(mat_lb_black)
    shade_flat(sp)
    parts.append(sp)

# Усики
for ay in (0.05, -0.05):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.008, depth=0.14, vertices=5, location=(0.32, ay, 0.17))
    an = bpy.context.active_object
    an.rotation_euler = (0, math.radians(60), 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    an.data.materials.append(mat_lb_black)
    shade_flat(an)
    parts.append(an)

bug = join_objects(parts, name="Ladybug")
sit_on_ground(bug)
belly_offset = bug.location.z

# --- Анимация маршрута ---
path_y = -2.1

# (кадр, x, y, высота_брюшка, поворот_Z_град, наклон_X_град)
timeline = [
    (1,   -2.5, path_y,        0.08, 0,   0),
    (20,  -1.5, path_y,        0.10, 6,   0),
    (40,  -0.5, path_y,        0.065,-5,  0),
    (60,   0.5, path_y,        0.10, 6,   0),
    (80,   2.0, path_y,        0.08, 0,   0),
    (92,   2.4, path_y+0.3,    0.40, 35, -20),   # взлёт
    (106,  4.3, -1.4,          1.30, 55,  0),     # полёт к бревну
    (120,  6.0, -0.75,         0.55, 75,  18),    # посадка на бревно
    (132,  5.8, -0.75,         0.42, 90,  0),     # ползёт по бревну
    (172,  6.8, -0.65,         0.42, 90,  0),     # ползёт по бревну
    (186,  7.0, -0.55,         0.70, 110,-18),    # взлёт с бревна
    (202,  3.3, -1.3,          1.30, 150, 0),     # полёт обратно
    (216, -1.0, path_y+0.3,    0.40, 175, 18),    # снижение
    (232, -2.5, path_y,        0.08, 180, 0),     # посадка на дорожку
    (260, -2.5, path_y,        0.08, 0,   0),     # разворот → замыкание цикла
]

for f, x, y, bz, rz, rx in timeline:
    bug.location = (x, y, bz + belly_offset)
    bug.keyframe_insert(data_path="location", frame=f)
    rot = list(bug.rotation_euler)
    rot[2] = math.radians(rz)
    rot[0] = math.radians(rx)
    bug.rotation_euler = rot
    bug.keyframe_insert(data_path="rotation_euler", index=2, frame=f)
    bug.keyframe_insert(data_path="rotation_euler", index=0, frame=f)

action = bug.animation_data.action if bug.animation_data else None
for fc in get_action_fcurves(action):
    bezier_all(fc)
    add_cycle(fc)

bpy.context.scene.frame_current = 1


# ======================================================================
# 07 — ФУДТРАК: замена костра на low-poly фудтрак
# ======================================================================

import bpy, math

def make_mat(name, color, roughness=0.9):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
    return mat

def shade_flat(obj):
    for p in obj.data.polygons:
        p.use_smooth = False

def join_objects(objs, active=None, name=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]
    bpy.ops.object.join()
    r = bpy.context.active_object
    if name:
        r.name = name
    return r

def world_bbox_minz(obj):
    coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
    return min(c.z for c in coords)

def sit_on_ground(obj):
    minz = world_bbox_minz(obj)
    obj.location.z -= minz

# Удаляем костёр и его свет
for nm in ["Campfire", "FireLight"]:
    o = bpy.data.objects.get(nm)
    if o:
        bpy.data.objects.remove(o, do_unlink=True)

truck_x, truck_y = 6.5, -2.0

mat_truck_body = make_mat("TruckBody", (0.95, 0.72, 0.18), 0.5)
mat_truck_roof = make_mat("TruckRoof", (0.22, 0.62, 0.55), 0.6)
mat_truck_trim = make_mat("TruckTrim", (0.9, 0.9, 0.88), 0.5)
mat_truck_wheel = make_mat("TruckWheel", (0.08, 0.08, 0.08), 0.7)
mat_truck_window = make_mat("TruckWindow", (0.55, 0.78, 0.88), 0.15)
mat_truck_counter = make_mat("TruckCounter", (0.42, 0.28, 0.16), 0.7)
mat_truck_awning = make_mat("TruckAwning", (0.85, 0.25, 0.2), 0.5)

parts = []

# Кузов
body_w, body_d, body_h = 3.6, 1.8, 1.6
bpy.ops.mesh.primitive_cube_add(size=1, location=(truck_x, truck_y, body_h/2))
body = bpy.context.active_object
body.scale = (body_w, body_d, body_h)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
body.data.materials.append(mat_truck_body)
shade_flat(body)
parts.append(body)

# Крыша
roof_h = 0.12
bpy.ops.mesh.primitive_cube_add(size=1, location=(truck_x, truck_y, body_h + roof_h/2))
roof = bpy.context.active_object
roof.scale = (body_w + 0.15, body_d + 0.1, roof_h)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
roof.data.materials.append(mat_truck_roof)
shade_flat(roof)
parts.append(roof)

# Кабина
cab_w, cab_d, cab_h = 1.0, body_d, 1.3
cab_x = truck_x + body_w/2 + cab_w/2 - 0.05
bpy.ops.mesh.primitive_cube_add(size=1, location=(cab_x, truck_y, cab_h/2))
cab = bpy.context.active_object
cab.scale = (cab_w, cab_d, cab_h)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
cab.data.materials.append(mat_truck_roof)
shade_flat(cab)
parts.append(cab)

# Лобовое стекло
bpy.ops.mesh.primitive_cube_add(size=1, location=(cab_x + cab_w/2 + 0.03, truck_y, cab_h*0.6))
ws = bpy.context.active_object
ws.scale = (0.06, cab_d*0.75, cab_h*0.4)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
ws.data.materials.append(mat_truck_window)
shade_flat(ws)
parts.append(ws)

# Раздаточное окно (на -Y)
win_w, win_h = 1.8, 0.9
bpy.ops.mesh.primitive_cube_add(size=1, location=(truck_x - 0.3, truck_y - body_d/2 - 0.04, body_h*0.55))
swin = bpy.context.active_object
swin.scale = (win_w, 0.08, win_h)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
swin.data.materials.append(mat_truck_window)
shade_flat(swin)
parts.append(swin)

# Прилавок
bpy.ops.mesh.primitive_cube_add(size=1, location=(truck_x - 0.3, truck_y - body_d/2 - 0.25, body_h*0.55 - win_h/2 - 0.06))
counter = bpy.context.active_object
counter.scale = (win_w + 0.3, 0.4, 0.08)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
counter.data.materials.append(mat_truck_counter)
shade_flat(counter)
parts.append(counter)

# Навес
bpy.ops.mesh.primitive_cube_add(size=1, location=(truck_x - 0.3, truck_y - body_d/2 - 0.6, body_h + 0.15))
awning = bpy.context.active_object
awning.scale = (win_w + 0.6, 0.9, 0.06)
awning.rotation_euler[0] = math.radians(-12)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
awning.data.materials.append(mat_truck_awning)
shade_flat(awning)
parts.append(awning)

# Стойки навеса
for pole_x_off in (-win_w/2 - 0.15, win_w/2 + 0.15):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.7, vertices=6,
        location=(truck_x - 0.3 + pole_x_off, truck_y - body_d/2 - 0.9, body_h*0.55 + 0.2))
    pole = bpy.context.active_object
    pole.data.materials.append(mat_truck_trim)
    shade_flat(pole)
    parts.append(pole)

# Колёса (4 штуки)
wheel_r = 0.25
for wx_off in (-body_w/2 + 0.5, cab_x - truck_x):
    for wy_off in (-body_d/2, body_d/2):
        bpy.ops.mesh.primitive_cylinder_add(radius=wheel_r, depth=0.16, vertices=10,
            location=(truck_x + wx_off, truck_y + wy_off, wheel_r))
        wh = bpy.context.active_object
        wh.rotation_euler[0] = math.radians(90)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        wh.data.materials.append(mat_truck_wheel)
        shade_flat(wh)
        parts.append(wh)

# Декоративная полоса
bpy.ops.mesh.primitive_cube_add(size=1, location=(truck_x, truck_y - body_d/2 - 0.04, body_h*0.22))
stripe = bpy.context.active_object
stripe.scale = (body_w + 0.1, 0.06, 0.12)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
stripe.data.materials.append(mat_truck_trim)
shade_flat(stripe)
parts.append(stripe)

truck = join_objects(parts, name="FoodTruck")
sit_on_ground(truck)
