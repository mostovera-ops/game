# Задачи для Claude Code

Контекст живёт в `CLAUDE.md` и подтягивается автоматически. Промты ниже — то, что кидаешь в чат. Один промт — одна сессия. Каждая начинается с `/clear`.

---

## Подготовка репозитория

```
mkdir farm-truck && cd farm-truck && git init
mkdir -p tools reference
cp ~/blender_scene_scripts.py tools/
cp ~/farm-truck-game.html reference/
cp ~/CLAUDE.md .
git add -A && git commit -m "context"
claude
```

---

## Задача 0 — Экспортёр

```
Прочитай tools/blender_scene_scripts.py целиком. Это 7 bpy-скриптов, которые
генерируют сцену фермы. Обрати внимание на скрипт 04: он двигает origin в
основание bbox для объектов Greens* и Carrot*, но не для TomatoBush.

Напиши tools/08_export.py — восьмой скрипт в серии, запускается через
`blender --background scene.blend --python tools/08_export.py`.

Выгружает:

1. public/assets/props/<name>.glb — по файлу на уникальный пропс. Объект в
   origin, Y-up, модификаторы применены, анимации не экспортируем.
   Пропсы: house, greenhouse, food_truck, brick_path, raised_bed, log_table,
   sit_log, ladybug, carrot, greens, tomato_bush, tree, bush.
   Деревья и кусты группируй по mesh datablock, не по имени объекта.
   Ground не экспортируем.

2. Перед экспортом carrot, greens, tomato_bush принудительно ставь origin
   в основание bbox: min z, центр по xy. Для tomato_bush это исправление
   бага, для двух других no-op. Без этого растения будут расти из воздуха.

3. public/assets/scene-layout.json:
   {
     "props":  [{ "asset": "tree", "position": [x,y,z], "rotationY": rad, "scale": [x,y,z] }],
     "plots":  [{ "id": 0, "bed": [x,y,z], "slots": [[x,y,z], [x,y,z], [x,y,z], [x,y,z]] }],
     "ground": { "size": 40, "material": "Grass" },
     "camera": { "position": [x,y,z], "target": [x,y,z], "isOrtho": bool },
     "sun":    { "direction": [x,y,z], "color": "#hex", "energy": float }
   }
   Всё уже в Y-up.
   Растения в "props" НЕ идут — только позиции слотов в plots[].slots.
   RaisedBed в "props" тоже не идёт — она в plots[].bed.

4. public/assets/palette.json — {"MaterialName": "#rrggbb"}, base_color из
   Principled BSDF, в sRGB.

5. В stdout — сводка: список пропсов, число инстансов каждого, треугольники
   на пропс, суммарные треугольники сцены.

Запусти скрипт и покажи мне сводку.
```

Перед тем как идти дальше: открой любой из `carrot.glb` / `tomato_bush.glb` и убедись, что origin в основании. Если суммарно больше ~50k треугольников — остановись, напиши мне.

---

## Задача 1 — Сцена

```
Подними проект по стеку из CLAUDE.md. Ассеты уже в public/assets/.

Задача — отрендерить ферму. Игровой логики нет, состояния нет.

- <Canvas shadows>, ортокамера из scene-layout.json. OrbitControls временно
  включены. Добавь r3f-perf.
- <Farm /> читает scene-layout.json, раскладывает props. useGLTF + preload.
- tree и bush — через <Instances>/<Instance> из drei.
- house, greenhouse, brick_path, log_table, sit_log — смержи через
  BufferGeometryUtils.mergeGeometries, сгруппировав по материалу.
- Ground — planeGeometry 40x40, receiveShadow, цвет palette.Grass.
- directionalLight из sun: castShadow, shadow-mapSize 2048, frustum вручную
  подогнан под сцену 40x40. Плюс ambientLight ~0.5.
- castShadow только у house, greenhouse, food_truck, tree, raised_bed.
- Растения и грядки пока не рисуем.
- Покачивание не делаем.

Готово, когда ферма рендерится в 60fps. Назови число draw calls из Perf.
```

Больше ~80 draw calls — стоп, разбираемся.

---

## Задача 2 — Цикл фермы

```
Прочитай reference/farm-truck-game.html. Это 2D-прототип. Бери оттуда правила,
отрисовку игнорируй.

Плотов не 6, как в прототипе, а 12 слотов: 3 грядки × 4 слота.
slotId = `${bedIndex}:${slotIndex}`.

1. src/game/store.ts, zustand + persist в localStorage.
   Состояние: day, phase, money, slots[12], inventory, selectedSeed.
   Переходы: plant, water, harvest, endDay, serve. Чистые функции.
   Ни одного импорта из three или react в этом файле.

2. src/game/store.test.ts, vitest:
   - посадил → полил → endDay → полил → endDay → stage === 2 → harvest →
     inventory вырос на 1
   - посадил → endDay без полива → слот пуст
   - endDay на дне 6 → phase === 'truck'

3. <Slot slotId> в scene/. По состоянию рендерит культуру со scale:
   stage 0 → 0.15, stage 1 → 0.55, stage 2 → 1.0. Между стадиями tween ~400мс.
   Пустой слот — ничего.

4. Клик по слоту: пусто → посадить selectedSeed, растёт → полить,
   созрело → собрать. Raycast по невидимым box-хитбоксам над слотами,
   не по геометрии растений: она меняется.
   Ховер — подсветка и cursor: pointer.

5. Полито → материал Soil этой грядки темнеет (lerp к 0.6× базового цвета).

6. Покачивание растений: onBeforeCompile у материалов культур, смещение
   вершин по синусу от uTime и мировой позиции, амплитуда пропорциональна
   высоте вершины. Один uniform на сцену. Референс амплитуды и периода —
   функция animate_sway в скрипте 04.

7. HUD в src/ui/, обычный DOM: 7 пипов недели, деньги, инвентарь,
   выбор семени (клавиши 1/2/3), кнопка «Закончить день».

8. endDay() не перезагружает сцену. Стадии перетекают через tween.

Фудтрак, персонажа, ходьбу — не делай.
```

---

## Что кидать в чат между задачами

- `посмотри на draw calls и предложи, что смержить`
- `напиши vitest на <кейс>, не трогая store.ts, потом почини store, если тест красный`
- `origin у tomato_bush не в основании, куст висит над грядкой — почини в 08_export.py и перезапусти экспорт`
