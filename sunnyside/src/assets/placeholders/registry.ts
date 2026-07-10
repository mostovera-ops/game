/**
 * registry.ts — МАСТЕР-РЕЕСТР заглушек всей игры (22-audio-visual.md §7 «Политика заглушек»).
 *
 * Это источник данных для таблицы ассетов Фазы D (см. docs/specs/22-audio-visual.md §7.1,
 * "Мастер-список ассетов … `21-client.md §3.7` (`assetRegistry`)").
 * ЕДИНСТВЕННЫЙ реестр ассетов проекта (registry-converge): все 4 сцены (`farm`/`town`/`fair`/
 * `shift`) рисуют через `<PlaceholderMesh id/>` (`./PlaceholderMesh.tsx`) по ключам отсюда —
 * прежний тонкий рантайм-реестр `src/scene/assets/registry.ts` + `<Prop assetKey/>` удалён.
 * Полный каталог ВСЕХ ассетов игры (модели, текстуры, UI, VFX, анимации, музыка, sfx) с
 * требованиями к финалу — покрывает спеки 02–04, 07, 09–11, 17, 19, 22 целиком.
 *
 * Конвенции примитивов-заглушек — 22-audio-visual.md §7.1/§7.2/§7.2а:
 *   Культура → box (приплюснутый) · Постройка → box+крыша-призма · Станок → box+cylinder ·
 *   Животное → capsule+sphere · Персонаж → capsule+sphere+badge · Транспорт → box+4×cylinder ·
 *   Декор/вывеска → box/plane тонкий · VFX → quad-спрайт · Town Project → box/group-композит ·
 *   Игрушка → sphere/capsule упрощённый · Env-проп → cone/sphere+cylinder.
 *
 * Правило нейминга (§7.3): любой ключ здесь — будущий `PLACEHOLDER_<id>` (модель) или
 * `STUB_<id>` (звук) в grep-чек-листе перед релизом — сам `id` уже несёт эту семантику,
 * отдельного префикса в строке не нужно (см. PlaceholderMesh.tsx/sound.ts).
 *
 * Ключи = ключи канона, где они существуют (`bld_*`, `st_*`, `tp_*`, `toy_*`, `cos_*`, `npc_*`,
 * `staff_*`, `mch_*`), плюс рабочие категории вне канон-реестра (`crop_*`, `veh_*`, `decor_*`,
 * `vfx_*`, `sfx_*`, `music_*`, `env_*`, `ui_*`, `ach_*`, `anim_*`) — помечены (нейминг-кандидат)
 * в комментариях там, где сам канон ещё не завёл ключ (см. 04-machines §8, 07-expeditions §8).
 */

// ── Типы ──────────────────────────────────────────────────────────────────

/** Категория будущего ассета (Фаза D: таблица ассетов). */
export type AssetCategory = 'model' | 'texture' | 'ui' | 'vfx' | 'animation' | 'music' | 'sfx'

/** Примитивная форма заглушки (22-av §7.1). `group` — композит из нескольких частей. */
export type PrimitiveShape = 'box' | 'sphere' | 'capsule' | 'plane' | 'cone' | 'cylinder' | 'group'

/** Одна часть композитной заглушки (группы). */
export interface PlaceholderPart {
  shape: Exclude<PrimitiveShape, 'group'>
  /** [ширина/радиус, высота, глубина] в условных юнитах сцены (21-client). */
  size: [number, number, number]
  /** Ключ CANON_PALETTE либо произвольный hex. */
  color: string
  offset?: [number, number, number]
  rotation?: [number, number, number]
}

/** Спецификация примитива-заглушки для одного ассета. */
export interface PlaceholderSpec {
  shape: PrimitiveShape
  size?: [number, number, number]
  color?: string
  /** Акцентный цвет (напр. полоса-вывеска на постройке, §7.1). */
  accent?: string
  /** Доп. равномерный масштаб поверх size (напр. рост культуры по стадии). */
  scale?: number
  /** Для shape:'group' — набор частей; иначе игнорируется. */
  parts?: PlaceholderPart[]
}

/** Требования к финальному ассету (наполняется художником/аудио-дизайнером в Фазе D). */
export interface FinalAssetRequirements {
  /** Полигональный бюджет [min,max] треугольников (22-av §4.1). Не применимо к texture/ui/sfx/music. */
  tris?: [number, number]
  /** Draw calls (гипотеза, 22-av §4.1). */
  drawCalls?: number
  /** Художественный стиль/референс. */
  style: string
  /** Формат финального файла. */
  format: string
  /** Длительность (vfx/sfx/music/animation) — сек/мс, диапазон текстом (22-av §4.4/§4.8/§7.3). */
  duration?: string
  /** Доп. заметки, формулы, ссылки на конкретную строку спеки. */
  notes?: string
}

/** Запись реестра: один будущий ассет игры. */
export interface AssetEntry {
  id: string
  /** Короткая человекочитаемая подпись (EN) — для дев-лейбла и таблицы Фазы D. */
  label: string
  category: AssetCategory
  /** Где используется (сцена/экран/механика) — свободный текст, канон-ключи предпочтительны. */
  usedIn: string[]
  /** Спека(и)-источник, напр. '02-farm.md §3.2'. */
  specSource: string[]
  final: FinalAssetRequirements
  /** Пусто для category без 3D-геометрии (ui/texture/music/sfx) — рендерится генерик-плейсхолдер. */
  placeholder?: PlaceholderSpec
}

// ── Канон-палитра заглушек (22-av §4.2/§4.3/§7.2/§7.2а) ─────────────────────

/**
 * Именованные цвета заглушек. НЕ hex в компонентах — только через `color(key)`.
 * Разделы точно следуют таблицам 22-audio-visual.md; финальные hex — арт-дирекшн sign-off
 * (см. 22-av §9 Открытые вопросы, пп.1-2).
 */
export const CANON_PALETTE = {
  // §4.2 — 5 базовых тонов дня + неон-акценты ночи (эмиссия, только для вывесок/ночи)
  pal_cherry: '#C33B3B',
  pal_teal: '#4FA79A',
  pal_mustard: '#E0A93E',
  pal_cream: '#F3E6C8',
  pal_chrome: '#C7CCD1',
  pal_chrome_dark: '#9AA0A6',
  pal_neon_pink: '#FF3F81',
  pal_neon_cyan: '#2FD8FF',
  pal_neon_yellow: '#FFE94A',

  // §4.3 — тир-цвета T1–T5 (только служебная индикация редкости/тира, не сценовая геометрия)
  tier_t1: '#8FA37A',
  tier_t2: '#5B8DBE',
  tier_t3: '#8B6BC7',
  tier_t4: '#E08A3C',
  tier_t5: '#E8C24A',

  // §7.2а — цвет-код по типу постройки (заглушка, все 9 из канона §3.8)
  bld_house: '#F3E6C8',
  bld_barn: '#E0A93E',
  bld_coop: '#6B9B4F',
  bld_kitchen: '#C33B3B',
  bld_diner: '#4FA79A',
  bld_garage: '#E0A93E',
  bld_silo: '#C7CCD1',
  bld_icehouse: '#9AA0A6',
  bld_apiary: '#FFE94A',

  // §7.2 — цвет-код по посту стаффа (персонажи Staff/NPC)
  post_kitchen: '#C33B3B',
  post_field: '#6B9B4F',
  post_counter: '#4FA79A',
  post_yard: '#E0A93E',

  // Env-пропсы (§7.1 «Env-пропсы»)
  env_leaves: '#55A069',
  env_trunk: '#997C61',
  env_grass: '#A0C47C',
  env_grass_dark: '#69AA6F',
  env_asphalt: '#4A4A52',
  env_road_line: '#F3F3F1',
  env_sky_day: '#BFE3F2',
  env_sky_dusk: '#F6B8A0',
  env_water: '#7FB8D6',
  env_stone: '#9A9A94',

  // Животные — пастельные тона по виду (§7.1 таблица «Животное»)
  animal_hen: '#F3E6C8',
  animal_cow_base: '#F3E6C8',
  animal_cow_spots: '#2B2B2E',
  animal_pig: '#F2A6B0',
  animal_bee_base: '#FFE94A',
  animal_bee_stripe: '#2B2B2E',
  animal_goat: '#EDE6D6',
  animal_turkey: '#8A5A3B',
  animal_sheep: '#F0EEE4',
  animal_sheep_face: '#4A4A52',

  // Культуры (canon-referenced §5-ingredients примеры, для box-заглушек грядки)
  crop_tomato: '#E75950',
  crop_lettuce: '#89CB7C',
  crop_potato: '#C79A5B',
  crop_wheat: '#E6C667',
  crop_corn: '#F4CF4A',
  crop_strawberry: '#E14E6B',
  crop_cherry: '#B02E3A',
  crop_peach: '#F1A15E',

  // Игрушки — 5 условных цветов серии (§7.1, отдельная последовательность, не тир-палитра)
  toy_series_1: '#F995AA',
  toy_series_2: '#F9ED7C',
  toy_series_3: '#CB95E7',
  toy_series_4: '#81CEC4',
  toy_series_5: '#ED897C',

  // Редкость Prize Machine (canon 15-monetization §3.3 — común/uncommon/rare/chase)
  rarity_common: '#C7CCD1',
  rarity_uncommon: '#5B8DBE',
  rarity_rare: '#8B6BC7',
  rarity_chase: '#E8C24A',

  // Косметик-сеты (canon §3.11 — акцент производный от §4.2, кандидат до sign-off, 22-av §9 п.9)
  cos_googie: '#E0A93E',
  cos_chrome: '#C7CCD1',
  cos_tiki: '#55A069',
  cos_xmas_55: '#C33B3B',

  // Валюты (canon §2.1 — только для иконок HUD)
  currency_bucks: '#7FBE6A',
  currency_dimes: '#5B8DBE',
  currency_tickets: '#F2B544',
  currency_ribbons: '#3F6FD0',

  // Разное
  neutral_grey: '#B8B8B8',
  fair_tent_canvas: '#E2523B',
  paper_cream: '#F5ECD6',
} as const

export type PaletteKey = keyof typeof CANON_PALETTE

/** Цвет по имени палитры. Неизвестное имя → magenta-маркер (заметно в dev, V3 22-av §8). */
export function color(name: PaletteKey | string): string {
  return (CANON_PALETTE as Record<string, string>)[name] ?? '#ff00ff'
}

// ── Шорткаты для составления PlaceholderSpec ────────────────────────────────

function box(size: [number, number, number], colorKey: string, accent?: string): PlaceholderSpec {
  return accent !== undefined ? { shape: 'box', size, color: colorKey, accent } : { shape: 'box', size, color: colorKey }
}
function sphereShape(r: number, colorKey: string): PlaceholderSpec {
  return { shape: 'sphere', size: [r, r, r], color: colorKey }
}
function capsuleShape(r: number, h: number, colorKey: string, accent?: string): PlaceholderSpec {
  return accent !== undefined
    ? { shape: 'capsule', size: [r, h, r], color: colorKey, accent }
    : { shape: 'capsule', size: [r, h, r], color: colorKey }
}
function coneShape(r: number, h: number, colorKey: string): PlaceholderSpec {
  return { shape: 'cone', size: [r, h, r], color: colorKey }
}
function cylinderShape(r: number, h: number, colorKey: string): PlaceholderSpec {
  return { shape: 'cylinder', size: [r, h, r], color: colorKey }
}
function planeShape(w: number, d: number, colorKey: string): PlaceholderSpec {
  return { shape: 'plane', size: [w, 0.02, d], color: colorKey }
}
function groupShape(parts: PlaceholderPart[]): PlaceholderSpec {
  return { shape: 'group', parts }
}

/** Фабрика записи реестра — сокращает бойлерплейт при массовом заполнении. */
function def(
  id: string,
  label: string,
  category: AssetCategory,
  usedIn: string[],
  specSource: string[],
  final: FinalAssetRequirements,
  placeholder?: PlaceholderSpec,
): AssetEntry {
  return placeholder !== undefined
    ? { id, label, category, usedIn, specSource, final, placeholder }
    : { id, label, category, usedIn, specSource, final }
}

// Общие FinalAssetRequirements-пресеты по типу объекта (22-av §4.1) — переиспользуются ниже.
const STYLE_LOWPOLY = 'low-poly, cel-shading 2-3 тона (база/тень/блик), без текстур на геометрии, плоские цвета'
const HERO_BUILDING: Pick<FinalAssetRequirements, 'tris' | 'drawCalls' | 'style' | 'format'> = {
  tris: [1200, 1800],
  drawCalls: 2,
  style: STYLE_LOWPOLY,
  format: 'glb (draco)',
}
const MEDIUM_BUILDING: Pick<FinalAssetRequirements, 'tris' | 'drawCalls' | 'style' | 'format'> = {
  tris: [600, 1000],
  drawCalls: 1,
  style: STYLE_LOWPOLY,
  format: 'glb (draco)',
}
const MACHINE_BUDGET: Pick<FinalAssetRequirements, 'tris' | 'drawCalls' | 'style' | 'format'> = {
  tris: [300, 600],
  drawCalls: 1,
  style: STYLE_LOWPOLY,
  format: 'glb (draco)',
}
const PLOT_BUDGET: Pick<FinalAssetRequirements, 'tris' | 'style' | 'format'> = {
  tris: [80, 150],
  style: `${STYLE_LOWPOLY}; 3-4 LOD-стадии роста, инстансинг`,
  format: 'glb (draco)',
}
const ANIMAL_BUDGET: Pick<FinalAssetRequirements, 'tris' | 'drawCalls' | 'style' | 'format'> = {
  tris: [250, 450],
  drawCalls: 1,
  style: `${STYLE_LOWPOLY}; именованный питомец — доп. бюджет лица/окраса без текстур`,
  format: 'glb (draco)',
}
const CHARACTER_BUDGET: Pick<FinalAssetRequirements, 'tris' | 'drawCalls' | 'style' | 'format'> = {
  tris: [700, 1100],
  drawCalls: 2,
  style: `${STYLE_LOWPOLY}; rigged, базовый скелет 12-18 костей`,
  format: 'glb (draco, с анимацией)',
}
const VEHICLE_BUDGET: Pick<FinalAssetRequirements, 'tris' | 'drawCalls' | 'style' | 'format'> = {
  tris: [800, 1300],
  drawCalls: 1,
  style: `${STYLE_LOWPOLY}; кузов + 4 колеса как отдельные простые цилиндры`,
  format: 'glb (draco)',
}
const SMALL_PROP_BUDGET: Pick<FinalAssetRequirements, 'tris' | 'style' | 'format'> = {
  tris: [50, 200],
  style: `${STYLE_LOWPOLY}; батчинг/инстансинг`,
  format: 'glb (draco)',
}
const VFX_BUDGET: Pick<FinalAssetRequirements, 'tris' | 'style' | 'format'> = {
  tris: [0, 20],
  style: 'billboard/quad-спрайт, инстансинг частиц, не object-heavy симуляция',
  format: 'png-атлас спрайтов + кривая (json)',
}
const TEXTURE_2D: Pick<FinalAssetRequirements, 'style' | 'format'> = {
  style: 'ретро-иллюстрация 1950-х, плоский вектор/гуашь-look',
  format: 'png/webp, 512×512 (или пропорция карточки)',
}
const UI_CHROME: Pick<FinalAssetRequirements, 'style' | 'format'> = {
  style: '19-ui-ux дизайн-система, плотный но не шумный UI (22-av §5)',
  format: 'svg/png (2x/3x)',
}

// ── Реестр: собираем секциями, соответствующими спекам ──────────────────────

const entries: AssetEntry[] = []

// 1) ПОСТРОЙКИ ФЕРМЫ (canon §3.8, 02-farm/13-progression) — 9 шт.
entries.push(
  def(
    'bld_house',
    'House',
    'model',
    ['FarmScene', 'ui_moving_truck'],
    ['00-canon.md §3.8', '02-farm.md §3.2', '13-progression.md §3.3.1'],
    HERO_BUILDING,
    box([3, 2, 3], 'bld_house'),
  ),
  def(
    'bld_barn',
    'Barn',
    'model',
    ['FarmScene'],
    ['00-canon.md §3.8', '03-animals.md §3.4'],
    MEDIUM_BUILDING,
    box([3, 3, 3], 'bld_barn'),
  ),
  def(
    'bld_coop',
    'Coop',
    'model',
    ['FarmScene'],
    ['00-canon.md §3.8', '03-animals.md §3.4'],
    MEDIUM_BUILDING,
    box([2, 1.6, 2], 'bld_coop'),
  ),
  def(
    'bld_kitchen',
    'Kitchen',
    'model',
    ['FarmScene'],
    ['00-canon.md §3.8', '04-machines.md §3.1'],
    HERO_BUILDING,
    groupShape([
      { shape: 'box', size: [2.6, 2, 2.2], color: 'bld_kitchen' },
      { shape: 'cone', size: [0.4, 0.4, 1], color: 'pal_chrome_dark', offset: [0.8, 1.6, 0] },
    ]),
  ),
  def(
    'bld_diner',
    'Diner',
    'model',
    ['FarmScene', 'ui_shift', 'ui_fair_stall'],
    ['00-canon.md §3.8', '09-fair.md §3.2'],
    HERO_BUILDING,
    groupShape([
      { shape: 'box', size: [3, 2, 2.5], color: 'bld_diner' },
      { shape: 'box', size: [3.4, 0.2, 1.2], color: 'pal_chrome', offset: [0, 1.2, 1.4] },
      { shape: 'cylinder', size: [0.2, 0.2, 1.6], color: 'pal_neon_pink', offset: [1.2, 2.4, 0] },
    ]),
  ),
  def(
    'bld_garage',
    'Garage',
    'model',
    ['FarmScene', 'ui_expeditions'],
    ['00-canon.md §3.8', '07-expeditions.md §6'],
    MEDIUM_BUILDING,
    box([3, 2, 2], 'bld_garage'),
  ),
  def(
    'bld_silo',
    'Silo',
    'model',
    ['FarmScene'],
    ['00-canon.md §3.8', '02-farm.md §3.11'],
    MEDIUM_BUILDING,
    cylinderShape(1, 4, 'bld_silo'),
  ),
  def(
    'bld_icehouse',
    'Icehouse',
    'model',
    ['FarmScene'],
    ['00-canon.md §3.8', '02-farm.md §3.11'],
    MEDIUM_BUILDING,
    box([2, 2, 2], 'bld_icehouse'),
  ),
  def(
    'bld_apiary',
    'Apiary',
    'model',
    ['FarmScene'],
    ['00-canon.md §3.8', '03-animals.md §3.4'],
    MEDIUM_BUILDING,
    groupShape([
      { shape: 'box', size: [1.2, 0.9, 1.2], color: 'bld_apiary' },
      { shape: 'cylinder', size: [0.35, 0.35, 0.5], color: 'pal_mustard', offset: [0.8, 0.5, 0.8] },
      { shape: 'cylinder', size: [0.35, 0.35, 0.5], color: 'pal_mustard', offset: [-0.8, 0.5, 0.8] },
    ]),
  ),
)

// 2) ЗЕМЛЯ, ГРЯДКИ, КУЛЬТУРЫ (02-farm.md) — тиры грядки, культуры, склад
entries.push(
  def(
    'plot_field_basic',
    'Basic Plot (ground)',
    'model',
    ['FarmScene grid'],
    ['02-farm.md §3.3'],
    PLOT_BUDGET,
    planeShape(1.4, 1.4, 'crop_potato'),
  ),
  def(
    'plot_field_tilled',
    'Tilled Plot (ground)',
    'model',
    ['FarmScene grid'],
    ['02-farm.md §3.3'],
    PLOT_BUDGET,
    planeShape(1.4, 1.4, 'env_trunk'),
  ),
  def(
    'plot_field_raised',
    'Raised Bed (ground)',
    'model',
    ['FarmScene grid'],
    ['02-farm.md §3.3'],
    PLOT_BUDGET,
    box([1.4, 0.2, 1.4], 'env_trunk'),
  ),
  def(
    'plot_field_irrigated',
    'Irrigated Bed (ground)',
    'model',
    ['FarmScene grid'],
    ['02-farm.md §3.3'],
    PLOT_BUDGET,
    groupShape([
      { shape: 'box', size: [1.4, 0.2, 1.4], color: 'env_trunk' },
      { shape: 'cylinder', size: [0.05, 0.05, 1.4], color: 'env_water', offset: [0, 0.15, 0] },
    ]),
  ),
  def(
    'plot_orchard',
    'Orchard Plot (ground)',
    'model',
    ['FarmScene grid'],
    ['02-farm.md §3.5'],
    PLOT_BUDGET,
    planeShape(2, 2, 'env_grass_dark'),
  ),
  def(
    'crop_tomato',
    'Tomato (T1)',
    'model',
    ['FarmScene plots', 'ui_recipe_box'],
    ['02-farm.md §4.5', '00-canon.md §2.2'],
    PLOT_BUDGET,
    sphereShape(0.2, 'crop_tomato'),
  ),
  def(
    'crop_lettuce',
    'Lettuce (T1)',
    'model',
    ['FarmScene plots'],
    ['02-farm.md §4.5'],
    PLOT_BUDGET,
    coneShape(0.2, 0.3, 'crop_lettuce'),
  ),
  def(
    'crop_potato',
    'Potato (T1)',
    'model',
    ['FarmScene plots'],
    ['02-farm.md §4.5'],
    PLOT_BUDGET,
    sphereShape(0.18, 'crop_potato'),
  ),
  def(
    'crop_wheat',
    'Wheat (T1)',
    'model',
    ['FarmScene plots', 'mch_mill', 'mch_oven'],
    ['02-farm.md §4.5', '04-machines.md §3.5'],
    PLOT_BUDGET,
    coneShape(0.15, 0.5, 'crop_wheat'),
  ),
  def(
    'crop_corn',
    'Corn (T2)',
    'model',
    ['FarmScene plots'],
    ['02-farm.md §4.5'],
    PLOT_BUDGET,
    cylinderShape(0.12, 0.4, 'crop_corn'),
  ),
  def(
    'crop_strawberry',
    'Strawberry (T2)',
    'model',
    ['FarmScene plots'],
    ['02-farm.md §4.5'],
    PLOT_BUDGET,
    sphereShape(0.15, 'crop_strawberry'),
  ),
  def(
    'crop_cherry_tree',
    'Cherry Orchard (T3, batch)',
    'model',
    ['FarmScene orchard plots'],
    ['02-farm.md §3.5/§4.5'],
    { tris: [200, 350], style: STYLE_LOWPOLY, format: 'glb (draco)' },
    groupShape([
      { shape: 'cylinder', size: [0.2, 0.2, 1.2], color: 'env_trunk' },
      { shape: 'cone', size: [0.9, 0.9, 1.6], color: 'env_leaves', offset: [0, 1.2, 0] },
      { shape: 'sphere', size: [0.08, 0.08, 0.08], color: 'crop_cherry', offset: [0.4, 1.4, 0.2] },
    ]),
  ),
  def(
    'crop_peach_tree',
    'Peach Orchard (T4)',
    'model',
    ['FarmScene orchard plots'],
    ['02-farm.md §3.5', '00-canon.md §3.4 st_georgia'],
    { tris: [250, 400], style: STYLE_LOWPOLY, format: 'glb (draco)' },
    groupShape([
      { shape: 'cylinder', size: [0.25, 0.25, 1.4], color: 'env_trunk' },
      { shape: 'cone', size: [1.0, 1.0, 1.8], color: 'env_leaves', offset: [0, 1.4, 0] },
      { shape: 'sphere', size: [0.12, 0.12, 0.12], color: 'crop_peach', offset: [0.5, 1.6, 0.2] },
    ]),
  ),
  // Форажинг-заглушки обочины (08-mail-foraging §3.2, 11-town §3.1 Roadside) — реюз
  // формы crop-конусов под herb/flower (нейминг-кандидат вне канон-тиров культур §4.5,
  // canon-ключа для форажинг-предметов пока нет; см. town/layout.ts FORAGE_ASSET_BY_KIND).
  def(
    'crop_greens',
    'Wild Greens/Herb (forage, icon+prop)',
    'model',
    ['TownScene roadside forage points'],
    ['08-mail-foraging.md §3.2', '11-town.md §3.1'],
    PLOT_BUDGET,
    coneShape(0.18, 0.28, 'env_grass'),
  ),
  def(
    'crop_carrot',
    'Wild Flower (forage, icon+prop)',
    'model',
    ['TownScene roadside forage points'],
    ['08-mail-foraging.md §3.2', '11-town.md §3.1'],
    PLOT_BUDGET,
    coneShape(0.16, 0.26, 'crop_strawberry'),
  ),
  def('item_feed_grain', 'Grain Feed (icon)', 'texture', ['ui_recipe_box', 'inventory'], ['03-animals.md §3.2.1'], TEXTURE_2D),
  def('item_feed_hay', 'Hay Feed (icon)', 'texture', ['ui_recipe_box', 'inventory'], ['03-animals.md §3.2.1'], TEXTURE_2D),
  def('item_feed_pollen_mix', 'Pollen Mix (icon)', 'texture', ['ui_recipe_box', 'inventory'], ['03-animals.md §3.2.1'], TEXTURE_2D),
  def(
    'env_fence_locked',
    'Land Expansion — locked fence',
    'model',
    ['FarmScene grid boundary'],
    ['02-farm.md §3.1'],
    SMALL_PROP_BUDGET,
    box([1.4, 0.6, 0.05], 'env_trunk'),
  ),
  def(
    'env_fence_open',
    'Land Expansion — unlocked fence',
    'model',
    ['FarmScene grid boundary'],
    ['02-farm.md §3.1'],
    SMALL_PROP_BUDGET,
    box([1.4, 0.5, 0.05], 'pal_chrome'),
  ),
)

// 3) ЖИВОТНЫЕ (03-animals.md) — 6 видов, canon-ключи an_*
type AnimalDef = { id: string; label: string; color: string; accent?: string; r: number; h: number }
const ANIMALS: AnimalDef[] = [
  { id: 'an_hen', label: 'Hen', color: 'animal_hen', r: 0.18, h: 0.3 },
  { id: 'an_cow', label: 'Dairy Cow', color: 'animal_cow_base', accent: 'animal_cow_spots', r: 0.35, h: 0.6 },
  { id: 'an_pig', label: 'Pig', color: 'animal_pig', r: 0.3, h: 0.45 },
  { id: 'an_bee', label: 'Bee Hive', color: 'animal_bee_base', accent: 'animal_bee_stripe', r: 0.2, h: 0.3 },
  { id: 'an_goat', label: 'Dairy Goat', color: 'animal_goat', r: 0.28, h: 0.5 },
  { id: 'an_turkey', label: 'Turkey', color: 'animal_turkey', r: 0.22, h: 0.4 },
  // an_sheep: `AnimalKind` (@/types/animals.ts) содержит `sheep` в закрытом enum, но
  // 03-animals.md §3.1 описывает 6-й вид как `an_turkey` — расхождение канона задокументировано
  // в data/catalogs/animals.ts (TODO(architecture)). Заглушка здесь заводится независимо от
  // разрешения того спора — `assetMap.ts` (farm) мапит `sheep` сюда напрямую (без стенд-ина).
  { id: 'an_sheep', label: 'Sheep', color: 'animal_sheep', accent: 'animal_sheep_face', r: 0.3, h: 0.45 },
]
for (const a of ANIMALS) {
  entries.push(
    def(
      a.id,
      a.label,
      'model',
      ['FarmScene coop/barn/apiary'],
      ['03-animals.md §3.1/§3.1.1', '00-canon.md §3 (animal roster)'],
      ANIMAL_BUDGET,
      groupShape([
        { shape: 'capsule', size: [a.r, a.h, a.r], color: a.color },
        { shape: 'sphere', size: [a.r * 0.55, a.r * 0.55, a.r * 0.55], color: a.accent ?? a.color, offset: [0, a.h * 0.55, a.r * 0.7] },
      ]),
    ),
  )
}
entries.push(
  def('item_egg', 'Egg (icon)', 'texture', ['ui_recipe_box', 'inventory'], ['03-animals.md §3.2'], TEXTURE_2D),
  def('item_milk', 'Milk (icon)', 'texture', ['ui_recipe_box', 'inventory'], ['03-animals.md §3.2'], TEXTURE_2D),
  def('item_bacon', 'Bacon (icon)', 'texture', ['ui_recipe_box', 'inventory'], ['03-animals.md §3.2'], TEXTURE_2D),
  def('item_lard', 'Lard (icon)', 'texture', ['ui_recipe_box', 'inventory'], ['03-animals.md §3.2'], TEXTURE_2D),
  def('item_honey', 'Honey (icon)', 'texture', ['ui_recipe_box', 'inventory'], ['03-animals.md §3.2'], TEXTURE_2D),
  def('item_beeswax', 'Beeswax (icon)', 'texture', ['ui_recipe_box', 'inventory'], ['03-animals.md §3.2'], TEXTURE_2D),
  def('item_goat_milk', 'Goat Milk (icon)', 'texture', ['ui_recipe_box', 'inventory'], ['03-animals.md §3.2'], TEXTURE_2D),
  def('item_chevre_curd', 'Chèvre Curd (icon)', 'texture', ['ui_recipe_box', 'inventory'], ['03-animals.md §3.2'], TEXTURE_2D),
  def('item_turkey_meat', 'Turkey Meat (icon)', 'texture', ['ui_recipe_box', 'inventory'], ['03-animals.md §3.2'], TEXTURE_2D),
  def('item_feather', 'Feather (icon)', 'texture', ['ui_recipe_box', 'inventory'], ['03-animals.md §3.2'], TEXTURE_2D),
)

// 4) СТАНКИ И ПОЛУФАБРИКАТЫ (04-machines.md) — 10 станков, canon-кандидаты mch_*
type MachineDef = { id: string; label: string; color: string; kettle: 'cylinder' | 'box' }
const MACHINES: MachineDef[] = [
  { id: 'mch_grill', label: 'Grill', color: 'pal_cherry', kettle: 'box' },
  { id: 'mch_oven', label: 'Oven', color: 'pal_mustard', kettle: 'box' },
  { id: 'mch_churn', label: 'Churn', color: 'pal_cream', kettle: 'cylinder' },
  { id: 'mch_soda_fountain', label: 'Soda Fountain', color: 'pal_teal', kettle: 'cylinder' },
  { id: 'mch_ice_cream', label: 'Ice Cream Maker', color: 'pal_chrome', kettle: 'cylinder' },
  { id: 'mch_coffee', label: 'Coffee Percolator', color: 'env_trunk', kettle: 'cylinder' },
  { id: 'mch_fryer', label: 'Fryer', color: 'pal_chrome_dark', kettle: 'box' },
  { id: 'mch_mill', label: 'Mill', color: 'crop_wheat', kettle: 'cylinder' },
  { id: 'mch_smoker', label: 'Smoker', color: 'pal_chrome_dark', kettle: 'cylinder' },
  { id: 'mch_steam_kettle', label: 'Steam Kettle', color: 'pal_teal', kettle: 'cylinder' },
]
for (const m of MACHINES) {
  entries.push(
    def(
      m.id,
      m.label,
      'model',
      ['ShiftScene/Kitchen slots', 'ui_recipe_box'],
      ['04-machines.md §3.2', '00-canon.md §3.8 bld_kitchen'],
      MACHINE_BUDGET,
      groupShape([
        { shape: 'box', size: [0.6, 0.5, 0.5], color: 'pal_chrome' },
        { shape: m.kettle, size: [0.3, 0.3, 0.4], color: m.color, offset: [0, 0.45, 0] },
      ]),
    ),
  )
}
entries.push(
  def('item_flour', 'Flour (полуфабрикат, icon)', 'texture', ['ui_recipe_box'], ['04-machines.md §4.4'], TEXTURE_2D),
  def('item_dough', 'Dough (полуфабрикат, icon)', 'texture', ['ui_recipe_box'], ['04-machines.md §4.4'], TEXTURE_2D),
  def('item_pie_crust', 'Pie Crust (полуфабрикат, icon)', 'texture', ['ui_recipe_box'], ['04-machines.md §4.4'], TEXTURE_2D),
  def('item_butter', 'Butter (полуфабрикат, icon)', 'texture', ['ui_recipe_box'], ['04-machines.md §4.4'], TEXTURE_2D),
  def('item_cheese', 'Cheese (полуфабрикат, icon)', 'texture', ['ui_recipe_box'], ['04-machines.md §4.4'], TEXTURE_2D),
  def(
    'item_marinated_beef',
    'Marinated Beef (полуфабрикат, icon)',
    'texture',
    ['ui_recipe_box'],
    ['04-machines.md §4.4'],
    TEXTURE_2D,
  ),
  def(
    'item_roasted_beans',
    'Roasted Beans (полуфабрикат, icon)',
    'texture',
    ['ui_recipe_box'],
    ['04-machines.md §4.4'],
    TEXTURE_2D,
  ),
)

// 5) ЭКСПЕДИЦИИ: транспорт + открытки штатов (07-expeditions.md)
entries.push(
  def(
    'veh_route_truck',
    'Route Truck (экспедиционный грузовик)',
    'model',
    ['ui_expeditions', 'TownScene roads'],
    ['00-canon.md §3.13 veh_route_truck', '07-expeditions.md §3.4'],
    VEHICLE_BUDGET,
    groupShape([
      { shape: 'box', size: [1.6, 0.7, 0.8], color: 'pal_teal' },
      { shape: 'cylinder', size: [0.25, 0.25, 0.2], color: 'pal_chrome_dark', offset: [0.6, -0.35, 0.45] },
      { shape: 'cylinder', size: [0.25, 0.25, 0.2], color: 'pal_chrome_dark', offset: [0.6, -0.35, -0.45] },
      { shape: 'cylinder', size: [0.25, 0.25, 0.2], color: 'pal_chrome_dark', offset: [-0.6, -0.35, 0.45] },
      { shape: 'cylinder', size: [0.25, 0.25, 0.2], color: 'pal_chrome_dark', offset: [-0.6, -0.35, -0.45] },
    ]),
  ),
  def(
    'veh_route_truck_upgraded',
    'Route Truck — Speed/Capacity max skin',
    'model',
    ['ui_expeditions (панель апгрейдов, превью модели)'],
    ['07-expeditions.md §3.4'],
    VEHICLE_BUDGET,
    groupShape([
      { shape: 'box', size: [1.8, 0.75, 0.85], color: 'pal_chrome' },
      { shape: 'cylinder', size: [0.28, 0.28, 0.22], color: 'pal_chrome_dark', offset: [0.65, -0.37, 0.48] },
      { shape: 'cylinder', size: [0.28, 0.28, 0.22], color: 'pal_chrome_dark', offset: [0.65, -0.37, -0.48] },
      { shape: 'cylinder', size: [0.28, 0.28, 0.22], color: 'pal_chrome_dark', offset: [-0.65, -0.37, 0.48] },
      { shape: 'cylinder', size: [0.28, 0.28, 0.22], color: 'pal_chrome_dark', offset: [-0.65, -0.37, -0.48] },
    ]),
  ),
  def(
    'veh_moving_van',
    'Moving Van (mech_moving_truck)',
    'model',
    ['ui_moving_truck'],
    ['00-canon.md §3.13 mech_moving_truck'],
    VEHICLE_BUDGET,
    box([1.7, 0.9, 0.9], 'pal_cream'),
  ),
  def(
    'veh_mail_truck',
    'Postman Pete mail truck',
    'model',
    ['ui_mail_catalog', 'TownScene roads'],
    ['08-mail-foraging.md', '00-canon.md §3.1 npc_postman_pete'],
    VEHICLE_BUDGET,
    box([1.4, 0.8, 0.8], 'pal_mustard'),
  ),
  def(
    'veh_truck_contract',
    'Truck Contract express mini-truck',
    'model',
    ['ui_expeditions (контракт)'],
    ['07-expeditions.md §3.6'],
    { tris: [500, 900], drawCalls: 1, style: STYLE_LOWPOLY, format: 'glb (draco)' },
    box([1.1, 0.55, 0.65], 'pal_neon_yellow'),
  ),
  def(
    'veh_guest_car',
    'Fair guest car (generic 50s)',
    'model',
    ['ui_shift', 'ui_fair_stall'],
    ['09-fair.md §2.3'],
    VEHICLE_BUDGET,
    box([1.5, 0.6, 0.7], 'pal_teal'),
  ),
  def(
    'veh_guest_car_vip',
    'Fair VIP guest car',
    'model',
    ['ui_shift (VIP-гость)'],
    ['09-fair.md §3.5'],
    VEHICLE_BUDGET,
    box([1.5, 0.6, 0.7], 'pal_chrome', 'pal_neon_pink'),
  ),
)
const STATES: Array<{ id: string; label: string }> = [
  { id: 'st_home', label: 'Home County' },
  { id: 'st_illinois', label: 'Illinois / Chicago' },
  { id: 'st_tennessee', label: 'Tennessee / Nashville' },
  { id: 'st_georgia', label: 'Georgia' },
  { id: 'st_louisiana', label: 'Louisiana / New Orleans' },
  { id: 'st_texas', label: 'Texas' },
  { id: 'st_maine', label: 'Maine' },
  { id: 'st_california', label: 'California' },
]
for (const s of STATES) {
  entries.push(
    def(
      s.id,
      `Postcard — ${s.label}`,
      'texture',
      ['ui_postcards', 'ui_expeditions (кузов-сундук)'],
      ['00-canon.md §3.4', '07-expeditions.md §3.7', '17-collections.md §3.3'],
      { ...TEXTURE_2D, style: 'ретро-открытка 1950-х штата, лицо=иллюстрация/оборот=штамп даты', format: 'png, 600×900 (портрет)' },
    ),
  )
}
entries.push(
  def(
    'env_state_marker',
    'Expedition map pin (generic)',
    'model',
    ['ui_expeditions map'],
    ['07-expeditions.md §5'],
    SMALL_PROP_BUDGET,
    coneShape(0.08, 0.25, 'pal_cherry'),
  ),
)

// 6) ЯРМАРКА (09-fair.md)
entries.push(
  def(
    'fair_tent',
    'Fair Tent (палатка ярмарки)',
    'model',
    ['ui_fair_stall', 'TownScene fairground'],
    ['09-fair.md §3.2', '00-canon.md §3.8 bld_diner'],
    MEDIUM_BUILDING,
    groupShape([
      { shape: 'cone', size: [1.4, 1.4, 1.2], color: 'fair_tent_canvas' },
      { shape: 'box', size: [2, 1.2, 1.6], color: 'pal_cream', offset: [0, -0.6, 0] },
    ]),
  ),
  def(
    'fair_display_slot',
    'Display Slot (лот на прилавке)',
    'model',
    ['ui_fair_stall'],
    ['09-fair.md §3.2'],
    SMALL_PROP_BUDGET,
    box([0.5, 0.05, 0.5], 'pal_chrome'),
  ),
  def(
    'fair_shift_counter',
    'Counter Shift stand',
    'model',
    ['ui_shift'],
    ['09-fair.md §3.4'],
    MEDIUM_BUILDING,
    box([2.2, 1.0, 0.6], 'pal_teal', 'pal_chrome'),
  ),
  def('fair_tray', 'Tray (поднос, icon+small prop)', 'texture', ['ui_shift'], ['09-fair.md §3.5'], TEXTURE_2D),
  def(
    'ui_combo_banner',
    '×2 TIPS! combo banner',
    'ui',
    ['ui_shift'],
    ['09-fair.md §3.5'],
    UI_CHROME,
  ),
  def(
    'ui_contest_gallery_board',
    'Contest Gallery board',
    'model',
    ['ui_fair_stall (галерея конкурсов)'],
    ['09-fair.md §3.7'],
    MEDIUM_BUILDING,
    box([2, 1.5, 0.1], 'pal_cream', 'pal_cherry'),
  ),
  def(
    'ui_weekly_check_paper',
    'Weekly Check receipt paper',
    'ui',
    ['Weekly Check screen'],
    ['09-fair.md §2.5/§4.10'],
    { style: 'бумажный чек дайнера, моноширинные числа (tabular-nums)', format: 'svg/png шаблон + текстовые слоты' },
  ),
)

// 7) ГОРОД: TOWN PROJECTS ×3 этапа (11-town.md §3.8, canon §3.7) — 18 записей
type TownProjectDef = { id: string; label: string; color: string }
const TOWN_PROJECTS: TownProjectDef[] = [
  { id: 'tp_drive_in', label: 'Drive-in Theater', color: 'pal_cherry' },
  { id: 'tp_ferris_wheel', label: 'Ferris Wheel', color: 'pal_chrome' },
  { id: 'tp_radio_wsun', label: 'Radio Station WSUN', color: 'pal_mustard' },
  { id: 'tp_bandstand', label: 'Town Bandstand', color: 'env_trunk' },
  { id: 'tp_water_tower', label: 'Water Tower', color: 'pal_chrome_dark' },
  { id: 'tp_welcome_arch', label: 'Highway Welcome Arch', color: 'pal_neon_cyan' },
]
const STAGE_LABEL = ['Stage 1 (леса)', 'Stage 2 (каркас)', 'Stage 3 (готово)'] as const
for (const proj of TOWN_PROJECTS) {
  for (let stage = 0; stage < 3; stage++) {
    const scale = 0.5 + stage * 0.25 // леса меньше/бледнее, готово — полный масштаб
    entries.push(
      def(
        `${proj.id}_stage${stage + 1}`,
        `${proj.label} — ${STAGE_LABEL[stage]}`,
        'model',
        ['TownScene fairground'],
        ['00-canon.md §3.7', '11-town.md §3.8.1/§3.8.2'],
        { tris: [400, 1200], drawCalls: 1, style: STYLE_LOWPOLY, format: 'glb (draco)' },
        groupShape([
          { shape: 'box', size: [1.2 * scale, 1.2 * scale, 1.2 * scale], color: stage < 2 ? 'neutral_grey' : proj.color },
          { shape: 'cylinder', size: [0.5 * scale, 0.5 * scale, 1.6 * scale], color: proj.color, offset: [0, 1.0 * scale, 0] },
        ]),
      ),
    )
  }
}
entries.push(
  def(
    'town_street_sign',
    'Street name placard (env decor)',
    'model',
    ['TownScene streets'],
    ['11-town.md §2.1', '00-canon.md §3.3 (пул имён стритов)'],
    SMALL_PROP_BUDGET,
    box([0.5, 0.3, 0.03], 'pal_chrome', 'pal_cherry'),
  ),
  def(
    'ui_coop_orders_board',
    'Co-op Orders board',
    'model',
    ['ui_coop_orders'],
    ['11-town.md §3.5'],
    MEDIUM_BUILDING,
    box([1.6, 1.2, 0.1], 'pal_cream', 'pal_teal'),
  ),
  def(
    'ui_potluck_table',
    'Street Potluck table',
    'model',
    ['ui_potluck'],
    ['11-town.md §3.6'],
    MEDIUM_BUILDING,
    box([2, 0.9, 1], 'env_trunk', 'pal_cream'),
  ),
  def(
    'ui_emote_sticker_pack',
    'Emote Stickers (12 базовых, атлас)',
    'texture',
    ['ui_chat'],
    ['11-town.md §3.9'],
    { style: '50-е ретро-стикеры (pie/nice sign/thanks/…)', format: 'png-атлас (12 иконок 128×128)' },
  ),
  def(
    'town_fountain_centerpiece',
    'Fairground centerpiece (до постройки Town Projects)',
    'model',
    ['TownScene fairground'],
    ['11-town.md §3.1'],
    MEDIUM_BUILDING,
    cylinderShape(1.2, 0.8, 'pal_chrome'),
  ),
)

// 8) СЕРВЕРНЫЙ ИВЕНТ (10-server-event.md)
entries.push(
  def(
    'event_cauldron',
    'Cauldron (общий котёл)',
    'model',
    ['ui_appetite_meter'],
    ['10-server-event.md §3.1', '00-canon.md §5 Cauldron'],
    HERO_BUILDING,
    groupShape([
      { shape: 'cylinder', size: [1, 1, 0.9], color: 'pal_chrome_dark' },
      { shape: 'cone', size: [0.9, 0.9, 0.3], color: 'pal_neon_yellow', offset: [0, 0.6, 0] },
    ]),
  ),
  def(
    'event_appetite_meter_gauge',
    'Appetite Meter gauge (шкала на площади)',
    'model',
    ['ui_appetite_meter'],
    ['10-server-event.md §3.3/§5'],
    MEDIUM_BUILDING,
    box([0.3, 3, 0.3], 'pal_chrome', 'pal_neon_pink'),
  ),
  def(
    'event_festival_tent_concessions',
    'Festival Tent — Concessions',
    'model',
    ['ui_appetite_meter (Festival theme)'],
    ['10-server-event.md §3.10'],
    MEDIUM_BUILDING,
    coneShape(1.1, 1.1, 'pal_mustard'),
  ),
  def(
    'event_festival_tent_grill',
    'Festival Tent — Grill',
    'model',
    ['ui_appetite_meter (Festival theme)'],
    ['10-server-event.md §3.10'],
    MEDIUM_BUILDING,
    coneShape(1.1, 1.1, 'pal_cherry'),
  ),
  def(
    'event_festival_tent_sweets',
    'Festival Tent — Sweets',
    'model',
    ['ui_appetite_meter (Festival theme)'],
    ['10-server-event.md §3.10'],
    MEDIUM_BUILDING,
    coneShape(1.1, 1.1, 'pal_teal'),
  ),
  def(
    'ui_glutton_phase_banner',
    'Glutton Phase Banner',
    'ui',
    ['ui_appetite_meter (Glutton theme)'],
    ['10-server-event.md §3.9'],
    UI_CHROME,
  ),
  def(
    'ui_versus_scoreboard',
    'Versus Scoreboard (State Fair Showdown)',
    'ui',
    ['ui_appetite_meter (Showdown theme)'],
    ['10-server-event.md §3.12'],
    UI_CHROME,
  ),
)

// 9) КОЛЛЕКЦИИ И ДЕКОР (17-collections.md)
entries.push(
  def(
    'ui_recipe_box_prop',
    'Recipe Box (3D prop в кухне)',
    'model',
    ['ui_recipe_box'],
    ['17-collections.md §2.1/§3.1'],
    SMALL_PROP_BUDGET,
    box([0.5, 0.35, 0.35], 'env_trunk', 'pal_cream'),
  ),
  def(
    'ui_ribbon_wall_prop',
    'Ribbon Wall (стена, 24 слота)',
    'model',
    ['ui_ribbon_wall'],
    ['17-collections.md §3.2'],
    MEDIUM_BUILDING,
    planeShape(3, 2, 'pal_cream'),
  ),
  def(
    'ui_postcards_album_prop',
    'Postcards Album (prop)',
    'model',
    ['ui_postcards'],
    ['17-collections.md §3.3'],
    SMALL_PROP_BUDGET,
    box([0.4, 0.3, 0.05], 'pal_teal'),
  ),
  def(
    'ui_toy_shelf_prop',
    'Toy Shelf (полка, 5 рядов)',
    'model',
    ['ui_toy_shelf'],
    ['17-collections.md §3.4'],
    MEDIUM_BUILDING,
    box([2, 1.4, 0.4], 'env_trunk'),
  ),
  def(
    'ui_prize_machine_prop',
    'Prize Machine (капсульный автомат)',
    'model',
    ['ui_prize_machine'],
    ['17-collections.md §2.4/§3.4'],
    MEDIUM_BUILDING,
    groupShape([
      { shape: 'cylinder', size: [0.4, 0.4, 1.0], color: 'pal_chrome' },
      { shape: 'sphere', size: [0.35, 0.35, 0.35], color: 'pal_neon_cyan', offset: [0, 0.65, 0] },
    ]),
  ),
  def(
    'ui_achievement_wall_prop',
    'Achievement Wall (латунные таблички)',
    'model',
    ['ui_achievement_wall'],
    ['17-collections.md §3.5'],
    MEDIUM_BUILDING,
    planeShape(3, 1.6, 'pal_mustard'),
  ),
  def(
    'ach_plaque_bronze',
    'Achievement plaque — bronze tier',
    'model',
    ['ui_achievement_wall (63 ачивки, общий шаблон)'],
    ['17-collections.md §3.5 (63 таблички ach_*)'],
    SMALL_PROP_BUDGET,
    planeShape(0.3, 0.2, 'env_trunk'),
  ),
  def(
    'ach_plaque_silver',
    'Achievement plaque — silver tier',
    'model',
    ['ui_achievement_wall'],
    ['17-collections.md §3.5'],
    SMALL_PROP_BUDGET,
    planeShape(0.3, 0.2, 'pal_chrome'),
  ),
  def(
    'ach_plaque_gold',
    'Achievement plaque — gold tier',
    'model',
    ['ui_achievement_wall'],
    ['17-collections.md §3.5'],
    SMALL_PROP_BUDGET,
    planeShape(0.3, 0.2, 'pal_mustard'),
  ),
  def(
    'ach_plaque_special',
    'Achievement plaque — special/gilded (напр. Fair Patron)',
    'model',
    ['ui_achievement_wall'],
    ['17-collections.md §3.5.8 ach_fair_patron'],
    SMALL_PROP_BUDGET,
    planeShape(0.3, 0.2, 'pal_neon_yellow'),
  ),
  def(
    'ui_neon_builder_sign',
    'Neon Builder — вывеска (базовый шаблон)',
    'model',
    ['ui_neon_builder', 'bld_diner фасад'],
    ['17-collections.md §2.7/§3.7'],
    { tris: [100, 300], drawCalls: 1, style: STYLE_LOWPOLY, format: 'glb (draco) + emissive-материал под bloom' },
    groupShape([
      { shape: 'box', size: [2, 0.4, 0.05], color: 'pal_chrome' },
      { shape: 'box', size: [1.8, 0.25, 0.03], color: 'pal_neon_pink', offset: [0, 0, 0.02] },
    ]),
  ),
)
// Photo Mode — фильтры (LUT-текстуры)
const PHOTO_FILTERS = ['kodachrome', 'sepia', 'polaroid', 'bw', 'neon_night'] as const
for (const f of PHOTO_FILTERS) {
  entries.push(
    def(
      `ui_photo_filter_${f}`,
      `Photo Mode filter — ${f}`,
      'texture',
      ['ui_photo_mode'],
      ['17-collections.md §3.6'],
      { style: 'LUT-текстура пост-фильтра ретро-плёнки', format: 'png LUT 256×16 (или 32×32×32 cube)' },
    ),
  )
}
// Toy series × rarity (canon §3.10, 5 серий × 4 редкости)
const TOY_SERIES: Array<{ id: string; label: string; color: string }> = [
  { id: 'toy_highway_dinos', label: 'Highway Dinos', color: 'toy_series_1' },
  { id: 'toy_cosmos_57', label: 'Cosmos-57', color: 'toy_series_2' },
  { id: 'toy_route_critters', label: 'Route Critters', color: 'toy_series_3' },
  { id: 'toy_chrome_rockets', label: 'Chrome Rockets', color: 'toy_series_4' },
  { id: 'toy_diner_mascots', label: 'Diner Mascots', color: 'toy_series_5' },
]
const RARITIES: Array<{ key: string; label: string; color: string }> = [
  { key: 'common', label: 'Common', color: 'rarity_common' },
  { key: 'uncommon', label: 'Uncommon', color: 'rarity_uncommon' },
  { key: 'rare', label: 'Rare', color: 'rarity_rare' },
  { key: 'chase', label: 'Chase', color: 'rarity_chase' },
]
for (const series of TOY_SERIES) {
  for (const rarity of RARITIES) {
    entries.push(
      def(
        `${series.id}_${rarity.key}`,
        `${series.label} — ${rarity.label} figure`,
        'model',
        ['ui_toy_shelf', 'ui_prize_machine'],
        ['00-canon.md §3.10', '17-collections.md §3.4', '15-monetization.md §3.3'],
        SMALL_PROP_BUDGET,
        capsuleShape(0.12, 0.22, series.color, rarity.color),
      ),
    )
  }
}
// Косметик-сеты (canon §3.11) — тинт-материалы, не отдельная геометрия
const COSMETIC_SETS: Array<{ id: string; label: string; color: string }> = [
  { id: 'cos_googie', label: 'Googie tint', color: 'cos_googie' },
  { id: 'cos_chrome', label: 'Chrome tint', color: 'cos_chrome' },
  { id: 'cos_tiki', label: 'Tiki tint', color: 'cos_tiki' },
  { id: 'cos_xmas_55', label: 'Xmas-55 tint', color: 'cos_xmas_55' },
]
for (const set of COSMETIC_SETS) {
  entries.push(
    def(
      set.id,
      set.label,
      'texture',
      ['bld_diner/veh_route_truck/staff/neon sign material override'],
      ['00-canon.md §3.11', '22-audio-visual.md §7.1 (cos_* — тинт, не геометрия)'],
      { style: 'цветовой/материальный тинт поверх базового placeholder-примитива (не меняет форму/tris)', format: 'material override (hex/PBR-preset)' },
    ),
  )
}
// Каталог декора запуска (17-collections §3.10) — 42 предмета, ровно как в спеке
type DecorDef = { id: string; label: string; plane?: boolean; accent: string }
const DECOR_FARMHOUSE: DecorDef[] = [
  { id: 'decor_picket_fence_section', label: 'Picket Fence Section', accent: 'pal_cream' },
  { id: 'decor_flower_bed_marigolds', label: 'Flower Bed — Marigolds', accent: 'pal_mustard' },
  { id: 'decor_flower_bed_roses', label: 'Flower Bed — Roses', accent: 'pal_cherry' },
  { id: 'decor_wooden_bench', label: 'Wooden Bench', accent: 'env_trunk' },
  { id: 'decor_rustic_mailbox', label: 'Rustic Mailbox', accent: 'env_trunk' },
  { id: 'decor_wagon_wheel', label: 'Wagon Wheel Decor', accent: 'env_trunk' },
  { id: 'decor_scarecrow', label: 'Scarecrow', accent: 'crop_wheat' },
  { id: 'decor_well', label: 'Well Decor', accent: 'env_stone' },
  { id: 'decor_hay_bale_stack', label: 'Hay Bale Stack', accent: 'crop_wheat' },
  { id: 'decor_rocking_chair_porch', label: 'Rocking Chair Porch', accent: 'env_trunk' },
  { id: 'decor_lantern_post', label: 'Lantern Post', accent: 'pal_neon_yellow' },
  { id: 'decor_vegetable_cart_display', label: 'Vegetable Cart Display', accent: 'crop_tomato' },
]
const DECOR_DINER_CHROME: DecorDef[] = [
  { id: 'decor_chrome_bar_stool', label: 'Chrome Bar Stool', accent: 'pal_chrome' },
  { id: 'decor_checkerboard_floor_tiles', label: 'Checkerboard Floor Tile Set', plane: true, accent: 'pal_chrome' },
  { id: 'decor_classic_jukebox', label: 'Classic Jukebox', accent: 'pal_neon_pink' },
  { id: 'decor_booth_seating_red_vinyl', label: 'Booth Seating — Red Vinyl', accent: 'pal_cherry' },
  { id: 'decor_milkshake_counter_display', label: 'Milkshake Counter Display', accent: 'pal_teal' },
  { id: 'decor_retro_wall_clock', label: 'Retro Wall Clock', plane: true, accent: 'pal_chrome' },
  { id: 'decor_neon_open_sign', label: 'Neon "Open" Window Sign', plane: true, accent: 'pal_neon_pink' },
  { id: 'decor_chrome_napkin_dispenser', label: 'Chrome Napkin Dispenser', accent: 'pal_chrome' },
  { id: 'decor_diner_counter_bell', label: 'Diner Counter Bell', accent: 'pal_chrome' },
  { id: 'decor_framed_menu_board', label: 'Framed Menu Board', plane: true, accent: 'env_trunk' },
  { id: 'decor_soda_fountain_display', label: 'Soda Fountain Display', accent: 'pal_teal' },
  { id: 'decor_checkered_curtains', label: 'Checkered Curtains', plane: true, accent: 'pal_cherry' },
]
const DECOR_ROUTE66: DecorDef[] = [
  { id: 'decor_roadside_gas_pump', label: 'Roadside Gas Pump Replica', accent: 'pal_cherry' },
  { id: 'decor_route66_shield_sign', label: 'Route 66 Shield Sign', plane: true, accent: 'pal_chrome' },
  { id: 'decor_vintage_truck', label: 'Vintage Truck Decor', accent: 'pal_teal' },
  { id: 'decor_awning_striped', label: 'Awning — Striped', plane: true, accent: 'pal_cherry' },
  { id: 'decor_window_flower_box', label: 'Window Flower Box', accent: 'pal_mustard' },
  { id: 'decor_welcome_doormat', label: 'Welcome Doormat', plane: true, accent: 'pal_cream' },
  { id: 'decor_drivein_speaker_post', label: 'Drive-in Speaker Post', accent: 'pal_chrome_dark' },
  { id: 'decor_checkerboard_walkway', label: 'Checkerboard Walkway', plane: true, accent: 'pal_chrome' },
  { id: 'decor_campfire_pit', label: 'Campfire Pit', accent: 'pal_neon_yellow' },
  { id: 'decor_mascot_statue_cow', label: 'Mascot Statue — Cow', accent: 'animal_cow_base' },
]
const DECOR_SEASONAL: DecorDef[] = [
  { id: 'decor_harvest_cornucopia', label: 'Harvest Cornucopia Display', accent: 'pal_mustard' },
  { id: 'decor_drivein_movie_screen_mini', label: 'Drive-in Movie Screen Mini', plane: true, accent: 'pal_chrome' },
  { id: 'decor_xmas55_wreath', label: 'Xmas-55 Wreath', plane: true, accent: 'cos_xmas_55' },
  { id: 'decor_xmas55_string_lights', label: 'Xmas-55 String Lights', plane: true, accent: 'pal_neon_cyan' },
  { id: 'decor_tiki_torch_pair', label: 'Tiki Torch Pair', accent: 'cos_tiki' },
  { id: 'decor_tiki_bar_mask', label: 'Tiki Bar Mask', plane: true, accent: 'cos_tiki' },
  { id: 'decor_googie_starburst_sign', label: 'Googie Starburst Sign', plane: true, accent: 'cos_googie' },
  { id: 'decor_chrome_rocket_fin', label: 'Chrome Rocket Fin Decor', accent: 'cos_chrome' },
]
const DECOR_ALL: Array<[DecorDef[], string]> = [
  [DECOR_FARMHOUSE, '17-collections.md §3.10.1 (Farmhouse, двор)'],
  [DECOR_DINER_CHROME, '17-collections.md §3.10.2 (Diner Chrome, интерьер)'],
  [DECOR_ROUTE66, '17-collections.md §3.10.3 (Route 66 Roadside, фасад+территория)'],
  [DECOR_SEASONAL, '17-collections.md §3.10.4 (Seasonal & Event)'],
]
for (const [list, specSrc] of DECOR_ALL) {
  for (const d of list) {
    entries.push(
      def(
        d.id,
        d.label,
        'model',
        ['ui_decor_editor (A-слоты двор/фасад/интерьер/территория)'],
        [specSrc],
        SMALL_PROP_BUDGET,
        d.plane === true ? planeShape(0.4, 0.3, 'pal_chrome') : box([0.35, 0.35, 0.35], 'pal_chrome', d.accent),
      ),
    )
  }
}

// 10) UI-ЭКРАНЫ ОБЩЕГО НАЗНАЧЕНИЯ (19-ui-ux.md, canon §3.12)
entries.push(
  def('ui_icon_bucks', 'Currency icon — Bucks ($)', 'ui', ['HUD'], ['00-canon.md §2.1'], { ...UI_CHROME, format: 'svg, монохром + акцент currency_bucks' }),
  def('ui_icon_dimes', 'Currency icon — Dimes (◉)', 'ui', ['HUD'], ['00-canon.md §2.1'], { ...UI_CHROME, format: 'svg, монохром + акцент currency_dimes' }),
  def('ui_icon_tickets', 'Currency icon — Tickets (🎟)', 'ui', ['HUD'], ['00-canon.md §2.1'], { ...UI_CHROME, format: 'svg, монохром + акцент currency_tickets' }),
  def('ui_icon_ribbons', 'Currency icon — Ribbons (🎀)', 'ui', ['HUD'], ['00-canon.md §2.1'], { ...UI_CHROME, format: 'svg, монохром + акцент currency_ribbons' }),
  def('ui_icon_daynight', 'HUD день/ночь индикатор (солнце/луна)', 'ui', ['HUD'], ['22-audio-visual.md §5'], UI_CHROME),
  def('ui_route_pass_track', 'Route Pass — трек наград (баннер)', 'ui', ['ui_route_pass'], ['15-monetization.md'], UI_CHROME),
  def('ui_daily_specials_board', 'Daily Specials board', 'model', ['ui_daily_specials'], ['00-canon.md §3.13 mech_daily_special'], MEDIUM_BUILDING, box([1.4, 1, 0.1], 'pal_cream', 'pal_cherry')),
  def('ui_moving_van_screen', 'Moving Van screen overlay', 'ui', ['ui_moving_truck'], ['12-migration.md'], UI_CHROME),
  def('ui_regulars_club_card', 'Regulars\' Club — streak card', 'ui', ['ui_regulars_club'], ['16-retention.md', '00-canon.md §3.13 mech_regular_streak'], UI_CHROME),
)

// 11) ПЕРСОНАЖИ: NPC (10, canon §3.1)
type NpcDef = { id: string; label: string; accent: string }
const NPCS: NpcDef[] = [
  { id: 'npc_grimsby', label: 'Grimsby', accent: 'pal_cherry' },
  { id: 'npc_nana_opal', label: 'Nana Opal', accent: 'pal_cream' },
  { id: 'npc_postman_pete', label: 'Postman Pete', accent: 'pal_mustard' },
  { id: 'npc_mayor_calloway', label: 'Mayor Calloway', accent: 'pal_chrome' },
  { id: 'npc_whittaker', label: 'Old Man Whittaker', accent: 'env_trunk' },
  { id: 'npc_maybelle', label: 'Miss Maybelle', accent: 'pal_neon_pink' },
  { id: 'npc_ricky_ray', label: 'DJ Ricky Ray', accent: 'pal_neon_cyan' },
  { id: 'npc_trucker_cody', label: 'Trucker Cody', accent: 'pal_teal' },
  { id: 'npc_sheriff_roy', label: 'Sheriff Roy', accent: 'pal_chrome_dark' },
  { id: 'npc_winnie', label: 'Winnie', accent: 'pal_mustard' },
]
for (const n of NPCS) {
  entries.push(
    def(
      n.id,
      n.label,
      'model',
      ['FarmScene/TownScene NPC spawn points'],
      ['00-canon.md §3.1'],
      CHARACTER_BUDGET,
      groupShape([
        { shape: 'capsule', size: [0.25, 0.9, 0.25], color: 'pal_cream' },
        { shape: 'sphere', size: [0.16, 0.16, 0.16], color: 'pal_cream', offset: [0, 0.65, 0] },
        { shape: 'box', size: [0.12, 0.12, 0.03], color: n.accent, offset: [0, 0.15, 0.25] },
      ]),
    ),
  )
}

// 12) ПЕРСОНАЖИ: STAFF (12, canon §3.2) — цвет по посту (22-av §7.2)
type StaffDef = { id: string; label: string; post: 'post_kitchen' | 'post_field' | 'post_counter' | 'post_yard' }
const STAFF: StaffDef[] = [
  { id: 'staff_bruno', label: 'Chef Bruno', post: 'post_kitchen' },
  { id: 'staff_rosalind', label: 'Pastry Chef Rosalind', post: 'post_kitchen' },
  { id: 'staff_marty', label: 'Grill Master Marty', post: 'post_kitchen' },
  { id: 'staff_peggy', label: 'Carhop Peggy', post: 'post_counter' },
  { id: 'staff_dizzy', label: 'Soda Jerk Dizzy', post: 'post_counter' },
  { id: 'staff_lorraine', label: 'Hostess Lorraine', post: 'post_counter' },
  { id: 'staff_hank', label: 'Farmhand Hank', post: 'post_field' },
  { id: 'staff_clara', label: 'Dairymaid Clara', post: 'post_field' },
  { id: 'staff_ada', label: 'Bookkeeper Ada', post: 'post_yard' },
  { id: 'staff_gus', label: 'Mechanic Gus', post: 'post_yard' },
  { id: 'staff_buck', label: 'Trucker Buck', post: 'post_yard' },
  { id: 'staff_vernon', label: 'Handyman Vernon', post: 'post_yard' },
]
for (const s of STAFF) {
  entries.push(
    def(
      s.id,
      s.label,
      'model',
      ['FarmScene staff posts (Kitchen/Field/Counter/Yard)'],
      ['00-canon.md §3.2', '22-audio-visual.md §7.2 (цвет-код поста)'],
      CHARACTER_BUDGET,
      groupShape([
        { shape: 'capsule', size: [0.25, 0.9, 0.25], color: 'pal_chrome' },
        { shape: 'sphere', size: [0.16, 0.16, 0.16], color: 'pal_cream', offset: [0, 0.65, 0] },
        { shape: 'box', size: [0.14, 0.14, 0.03], color: s.post, offset: [0, 0.15, 0.25] },
      ]),
    ),
  )
}

// 13) ОКРУЖЕНИЕ (env_*, 22-av §7.1 «Env-пропсы», переиспользуется на всех сценах)
entries.push(
  def('env_tree', 'Tree (env)', 'model', ['FarmScene/TownScene environment'], ['22-audio-visual.md §7.1'], { ...SMALL_PROP_BUDGET, style: `${STYLE_LOWPOLY}; инстансинг` }, groupShape([
    { shape: 'cylinder', size: [0.15, 0.15, 1], color: 'env_trunk' },
    { shape: 'cone', size: [0.7, 0.7, 1.4], color: 'env_leaves', offset: [0, 1, 0] },
  ])),
  def('env_bush', 'Bush (env)', 'model', ['FarmScene/TownScene environment'], ['22-audio-visual.md §7.1'], SMALL_PROP_BUDGET, sphereShape(0.4, 'env_leaves')),
  def('env_road', 'Road segment (env)', 'model', ['TownScene streets'], ['22-audio-visual.md §7.1'], SMALL_PROP_BUDGET, planeShape(2, 6, 'env_asphalt')),
  def('env_sidewalk', 'Sidewalk segment (env)', 'model', ['TownScene streets'], ['22-audio-visual.md §7.1'], SMALL_PROP_BUDGET, planeShape(1, 6, 'env_stone')),
  def('env_crosswalk', 'Crosswalk stripes (env)', 'texture', ['TownScene streets'], ['22-audio-visual.md §7.1'], TEXTURE_2D),
  def('env_streetlamp', 'Streetlamp (env)', 'model', ['TownScene/FarmScene'], ['22-audio-visual.md §7.1'], SMALL_PROP_BUDGET, groupShape([
    { shape: 'cylinder', size: [0.05, 0.05, 1.4], color: 'pal_chrome_dark' },
    { shape: 'sphere', size: [0.15, 0.15, 0.15], color: 'pal_neon_yellow', offset: [0, 0.75, 0] },
  ])),
  def('env_rock', 'Rock cluster (env)', 'model', ['FarmScene/TownScene environment'], ['22-audio-visual.md §7.1'], SMALL_PROP_BUDGET, sphereShape(0.3, 'env_stone')),
  def('env_grass_patch', 'Grass patch (ground texture)', 'texture', ['FarmScene/TownScene ground'], ['22-audio-visual.md §7.1'], TEXTURE_2D),
  def(
    'env_cloud',
    'Cloud sprite (sky)',
    'vfx',
    ['sky dome, все сцены'],
    ['22-audio-visual.md §3.6 день/ночь'],
    VFX_BUDGET,
    planeShape(1.2, 0.6, 'pal_cream'),
  ),
  def(
    'env_star_sprite',
    'Star sprite (ночное небо)',
    'vfx',
    ['sky dome, ночная фаза'],
    ['22-audio-visual.md §4.5'],
    VFX_BUDGET,
    planeShape(0.05, 0.05, 'pal_cream'),
  ),
  def('env_puddle', 'Puddle (после полива, env)', 'model', ['FarmScene plots'], ['22-audio-visual.md §7.1'], SMALL_PROP_BUDGET, planeShape(0.4, 0.3, 'env_water')),
  def('env_billboard_route66', 'Route 66 billboard (env)', 'model', ['TownScene roadside'], ['11-town.md §3.1 (Roadside)'], SMALL_PROP_BUDGET, planeShape(1.2, 0.8, 'pal_chrome')),
  def('env_town_impostor_farm', 'Town impostor billboard — соседняя ферма (LOD)', 'texture', ['TownScene (город рисуется импосторами, 21-client §3.9)'], ['21-client.md §3.9', '22-audio-visual.md §4.1'], { style: 'billboard-импостор LOD миниатюры фермы для карты города', format: 'png атлас (баким сцену в текстуру)' }),
)

// 14) VFX-РЕЕСТР (22-audio-visual.md §4.4) — 12 эффектов
type VfxDef = { id: string; label: string; trigger: string; duration: string; spriteColor: string }
const VFX_LIST: VfxDef[] = [
  { id: 'vfx_dust_puff', label: 'Dust Puff', trigger: 'полив/вспашка/шаги', duration: '400-600 мс', spriteColor: 'pal_cream' },
  { id: 'vfx_steam', label: 'Steam', trigger: 'готовка на станке', duration: 'непрерывно пока станок активен', spriteColor: 'pal_cream' },
  { id: 'vfx_sale_sparkle', label: 'Sale Sparkle', trigger: 'продажа на Fair Stall/Shift', duration: '500 мс', spriteColor: 'pal_neon_yellow' },
  { id: 'vfx_money_popup', label: 'Money popup (+$NN)', trigger: 'получение Bucks', duration: '800 мс', spriteColor: 'pal_mustard' },
  { id: 'vfx_mastery_glow', label: 'Mastery Upgrade Glow', trigger: 'рецепт получает ★', duration: '1.2 с', spriteColor: 'tier_t3' },
  { id: 'vfx_confetti', label: 'Contest Confetti', trigger: 'победа в конкурсе', duration: '2 с', spriteColor: 'pal_cherry' },
  { id: 'vfx_neon_pulse', label: 'Neon Pulse', trigger: 'активация вывески ночью', duration: 'непрерывно, период 3 с', spriteColor: 'pal_neon_pink' },
  { id: 'vfx_water_droplets', label: 'Water Droplets', trigger: 'полив грядки/животного', duration: '500 мс', spriteColor: 'env_water' },
  { id: 'vfx_fireflies', label: 'Fireflies (ambient)', trigger: 'ночная фаза', duration: 'постоянно ночью, 5-10 одновременно', spriteColor: 'pal_neon_yellow' },
  { id: 'vfx_chimney_smoke', label: 'Chimney Smoke', trigger: 'дайнер активен', duration: 'непрерывно в рабочие часы', spriteColor: 'pal_chrome_dark' },
  { id: 'vfx_guest_arrival_puff', label: 'Guest Arrival Puff', trigger: 'новый гость подъехал', duration: '300 мс', spriteColor: 'pal_cream' },
  { id: 'vfx_meter_tick_glow', label: 'Meter Tick Glow', trigger: 'веха Appetite Meter (25/50/75/100%)', duration: '1.5 с', spriteColor: 'pal_neon_yellow' },
]
for (const v of VFX_LIST) {
  entries.push(
    def(
      v.id,
      v.label,
      'vfx',
      ['см. триггер'],
      ['22-audio-visual.md §4.4'],
      { ...VFX_BUDGET, duration: v.duration, notes: `Триггер: ${v.trigger}` },
      planeShape(0.3, 0.3, v.spriteColor),
    ),
  )
}

// 15) АНИМАЦИОННЫЕ ПРИНЦИПЫ (22-av §3.4) — процедурные/клипы
entries.push(
  def('anim_squash_stretch', 'Squash-stretch (лайт)', 'animation', ['сбор урожая, прыжок животного, поп станка'], ['22-audio-visual.md §3.4'], { style: 'масштаб ±10-15% (не мультяшный экстрим)', format: 'GLTF anim clip / шейдер-параметр', duration: '150-300 мс' }),
  def('anim_sway_wind', 'Sway растений (процедурный ветер)', 'animation', ['грядки T1-T3, деревья T4'], ['22-audio-visual.md §3.4'], { style: 'амплитуда 3-5° (деревья 1-2°), период 2-3 с, фаза сдвинута по X/Z', format: 'вершинный шейдер (процедурный, без клипа)' }),
  def('anim_idle_bob', 'Idle bob персонажей', 'animation', ['Staff/NPC на статичных экранах'], ['22-audio-visual.md §3.4'], { style: 'вертикальный боб ±3 см, период ~2 с + жест раз в 8-12 с', format: 'GLTF anim clip (loop)' }),
  def('anim_anticipation', 'Anticipation (замах)', 'animation', ['активные интеракции игрока (полив/сбор)'], ['22-audio-visual.md §3.4'], { style: 'короткий кадр подготовки 150-200 мс перед действием', format: 'GLTF anim clip', duration: '150-200 мс' }),
  def('anim_pop_celebrate', 'Контекстный «поп»-жест (успех)', 'animation', ['Mastery upgrade, победа конкурса, Blue Ribbon'], ['22-audio-visual.md §3.4'], { style: 'уникальная эмоция-анимация 400-600 мс, привязана к VFX', format: 'GLTF anim clip', duration: '400-600 мс' }),
)

// 16) МУЗЫКА — контекстные заглушки (22-av §4.8, §7.3) — 6 контекстов
type MusicDef = { id: string; label: string; bpm: string }
const MUSIC_LIST: MusicDef[] = [
  { id: 'music_farm_day', label: 'Ферма — день (джаз-лаунж)', bpm: '80-90 BPM' },
  { id: 'music_farm_night', label: 'Ферма — ночь (джаз-лаунж медленный)', bpm: '65-75 BPM' },
  { id: 'music_shift', label: 'Активная смена (рокабилли)', bpm: '145-160 BPM' },
  { id: 'music_fair', label: 'Ярмарка (рокабилли/свинг-гибрид)', bpm: '130-145 BPM' },
  { id: 'music_event_final', label: 'Финал ивента (кульминационный кросс-жанр)', bpm: '150-170 BPM, нарастание' },
  { id: 'music_menu', label: 'Меню/лоадеры (джаз-лаунж минимал)', bpm: '70 BPM' },
]
for (const m of MUSIC_LIST) {
  entries.push(
    def(m.id, m.label, 'music', ['адаптивный микс по контексту (22-av §3.7)'], ['22-audio-visual.md §4.8', '22-audio-visual.md §7.3 (STUB_MUSIC_<context>)'], {
      style: `${m.bpm}; инструментал (гитара/контрабас/щётки-барабаны/сакс), 3-4 стема (bass+drums/rhythm/melody/brass)`,
      format: 'STUB: WebAudio 2-осц. чиптюн-луп в рантайме; финал — mp3/ogg стемы',
      duration: '90-120 с луп (бесшовный)',
    }),
  )
}

// 17) SFX — категории и синтез-заглушки (22-av §4.7/§7.3) — 13 стабов
type SfxDef = { id: string; label: string; category: string; synth: string; duration: string }
const SFX_LIST: SfxDef[] = [
  { id: 'sfx_ui_success', label: 'UI успех/подтверждение', category: 'UI', synth: 'sine 440→554 Hz', duration: '120 мс' },
  { id: 'sfx_ui_error', label: 'UI ошибка/мягкий отказ', category: 'UI', synth: 'triangle 392→330 Hz', duration: '150 мс' },
  { id: 'sfx_farm_action', label: 'Farm (полив/сбор)', category: 'Farm', synth: 'square 300 Hz, decay 40 мс', duration: '80 мс' },
  { id: 'sfx_cooking_ready', label: 'Cooking (готово, тройной пинг)', category: 'Cooking', synth: 'triangle 3×600 Hz, интервал 150 мс', duration: '450 мс' },
  { id: 'sfx_diner_cash', label: 'Diner/Counter (касса, арпеджио 3 ноты)', category: 'Diner/Counter', synth: 'sine C-E-G (523/659/784 Hz)', duration: '270 мс' },
  { id: 'sfx_sale_mastery', label: 'Sale/Mastery upgrade (арпеджио 5 нот)', category: 'Diner/Counter', synth: 'пентатоника от 440 Hz, вибрато', duration: '300 мс' },
  { id: 'sfx_contest_win', label: 'Contest win / Event milestone (аккорд)', category: 'Event', synth: 'sawtooth C-major триада, envelope 1000 мс', duration: '1000 мс' },
  { id: 'sfx_ambient_night', label: 'Ambient (ночной фон, белый шум)', category: 'Ambient', synth: 'white noise buffer, gain 0.05', duration: 'постоянно' },
  { id: 'sfx_animals_generic', label: 'Animals (кудахтанье/мычание/жужжание/хрюканье)', category: 'Animals', synth: 'square/triangle короткий, тёплый тембр', duration: '200-400 мс' },
  { id: 'sfx_fair_crowd', label: 'Fair (гул толпы/аплодисменты/клаксон)', category: 'Fair', synth: 'noise+square слоями', duration: '1-3 с (петля/one-shot)' },
  { id: 'sfx_notification_mail', label: 'Notification — почта (гудок грузовика)', category: 'Notification', synth: 'square двутон', duration: '300 мс' },
  { id: 'sfx_notification_neighbor', label: 'Notification — сосед помог', category: 'Notification', synth: 'sine восходящий блип', duration: '200 мс' },
  { id: 'sfx_notification_jukebox', label: 'Notification — jukebox-стингер', category: 'Notification', synth: 'sine аккорд короткий', duration: '250 мс' },
]
for (const s of SFX_LIST) {
  entries.push(
    def(s.id, s.label, 'sfx', [`SFX-категория: ${s.category}`], ['22-audio-visual.md §4.7', '22-audio-visual.md §7.3'], {
      style: `синтез-заглушка: ${s.synth} (Web Audio OscillatorNode+GainNode envelope, без хранения файла)`,
      format: 'STUB: WebAudio синтез в рантайме; финал — короткий wav/mp3-сэмпл, мягкая атака (пилларс P3)',
      duration: s.duration,
    }),
  )
}

// ── Индекс реестра ───────────────────────────────────────────────────────

/** Полный реестр: ключ = id ассета. */
export const assetRegistry: Record<string, AssetEntry> = entries.reduce<Record<string, AssetEntry>>((acc, e) => {
  acc[e.id] = e
  return acc
}, {})

/** Достать запись реестра (или undefined, если ключ ещё не заведён). */
export function getAsset(id: string): AssetEntry | undefined {
  return assetRegistry[id]
}

/** Все id реестра (для тестов покрытия / grep перед релизом, 22-av §7.3). */
export const ASSET_IDS: readonly string[] = entries.map((e) => e.id)

/** Записи по категории (Фаза D: разбивка таблицы ассетов по типу). */
export function listByCategory(category: AssetCategory): AssetEntry[] {
  return entries.filter((e) => e.category === category)
}

/** Сводка count по категориям — быстрый sanity-check охвата реестра. */
export function categoryCounts(): Record<AssetCategory, number> {
  const out: Record<AssetCategory, number> = { model: 0, texture: 0, ui: 0, vfx: 0, animation: 0, music: 0, sfx: 0 }
  for (const e of entries) out[e.category] += 1
  return out
}
