/**
 * data/schema.ts — zod-схемы всех контент-каталогов Sunnyside.
 *
 * Контент (баланс/дизайн-данные) живёт в `src/data/catalogs/*.ts` — простые
 * TS-модули с именованным экспортом массива записей (см. таблицу `CONTENT_CATALOGS`
 * внизу файла — это единый источник правды для загрузчика и для `validate.test.ts`).
 *
 * ГРАНИЦА (AGENTS.md §3): этот файл — часть `types`-подобного домена, ноль `three`/`scene`/`net`.
 * Зависимость только на `zod` и на типы-константы `@/types` (переиспользуем канонические
 * перечни ключей — `STATE_KEYS`, `BUILDING_KEYS`, ... — чтобы не дублировать источник правды).
 *
 * Naming: инфер-типы контента называются с суффиксом там, где рантайм-тип с тем же
 * коротким именем уже занят в `@/types` (напр. `Animal` — экземпляр на ферме, поэтому
 * контент-запись каталога животных называется `AnimalDef`).
 *
 * Источники: 00-canon.md (нейминг-реестр §3), 03-animals, 04-machines, 05-ingredients,
 * 06-recipes, 07-expeditions, 08-mail-foraging, 11-town §3 (town projects/stages),
 * 13-progression (know-how, staff, route pass), 15-monetization, 16-retention
 * (Daily Specials §3.2), 17-collections (toys/cosmetics/postcards/achievements §3.5).
 */

import { z } from 'zod'
import {
  STATE_KEYS,
  BUILDING_KEYS,
  STAFF_KEYS,
  KNOW_HOW_BRANCHES,
  TOY_SERIES_KEYS,
  COSMETIC_KEYS,
  TOWN_PROJECT_KEYS,
} from '@/types'
import type {
  StateKey,
  BuildingKey,
  StaffKey,
  KnowHowBranch,
  ToySeriesKey,
  CosmeticKey,
  TownProjectKey,
} from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// 0. Примитивы (common.ts, currency.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** Двуязычная подпись — RU/EN обязательны (canon §5: словарь UI RU/EN). */
export const BilingualSchema = z
  .object({
    en: z.string().min(1, 'en-подпись не может быть пустой'),
    ru: z.string().min(1, 'ru-подпись не может быть пустой'),
  })
  .strict()

/** Tier T1–T5 (canon §2.2). Ровно 5 ступеней, литералами (не просто число 1..5). */
export const TierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
])

/** Quality 1..5 (affection/housing/mastery, 05-ingredients). */
export const QualitySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
])

/**
 * Ключ канона — английский snake_case (00-canon.md §5: «в коде/БД — только
 * английский ключ»). Не форсируем конкретный префикс здесь: реестр префиксов
 * (`crop_`, `seed_`, `prod_`, `dish_`, ...) — гипотеза в комментариях `@/types`,
 * не зафиксирован как закрытый список в каноне §3. Конкретные закрытые перечни
 * (штаты/постройки/стафф/...) валидируются отдельными `z.enum` ниже.
 */
const KEY_PATTERN = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/

export const CanonKeySchema = z
  .string()
  .regex(KEY_PATTERN, 'ключ канона должен быть английским snake_case')

/** Ключ продукта/предмета инвентаря (ingredients.ts ProductKey). */
export const ProductKeySchema = CanonKeySchema
/** Ключ рецепта (recipes.ts RecipeKey). */
export const RecipeKeySchema = CanonKeySchema
/** Ключ станка (machines.ts MachineKey). */
export const MachineKeySchema = CanonKeySchema

/** Валюты — ровно 4, закрытый список (currency.ts CurrencyKey, canon §2.1). */
export const CurrencyKeySchema = z.enum(['bucks', 'dimes', 'tickets', 'ribbons'])

/** Класс предмета (ingredients.ts ItemClass). */
export const ItemClassSchema = z.enum([
  'seed',
  'crop',
  'animal_product',
  'ingredient',
  'dish',
  'feed',
  'material',
  'decor',
  'tool',
  'special',
])

/** Хранилище (ingredients.ts StorageKind). */
export const StorageKindSchema = z.enum(['silo', 'icehouse', 'general'])

/** Пост стаффа (machines.ts StaffPost). */
export const StaffPostSchema = z.enum(['Kitchen', 'Field', 'Counter', 'Yard'])

/** Категория спроса (economy.ts DemandCategory) — открытый список + известные константы. */
export const DemandCategorySchema = z.string().min(1)

/** Запись «ключ канона → количество» (CountMap<K>, common.ts). */
export const CountMapSchema = z.record(CanonKeySchema, z.number().int().positive())

// ─────────────────────────────────────────────────────────────────────────────
// Закрытые перечни, переиспользованные из @/types (единый источник правды —
// не дублируем список значений, только оборачиваем в z.enum).
// ─────────────────────────────────────────────────────────────────────────────

export const StateKeySchema = z.enum(STATE_KEYS as [StateKey, ...StateKey[]])
export const BuildingKeySchema = z.enum(BUILDING_KEYS as [BuildingKey, ...BuildingKey[]])
export const StaffKeySchema = z.enum(STAFF_KEYS as [StaffKey, ...StaffKey[]])
export const KnowHowBranchSchema = z.enum(KNOW_HOW_BRANCHES as [KnowHowBranch, ...KnowHowBranch[]])
export const ToySeriesKeySchema = z.enum(TOY_SERIES_KEYS as [ToySeriesKey, ...ToySeriesKey[]])
export const CosmeticSetKeySchema = z.enum(COSMETIC_KEYS as [CosmeticKey, ...CosmeticKey[]])
export const TownProjectKeySchema = z.enum(TOWN_PROJECT_KEYS as [TownProjectKey, ...TownProjectKey[]])

// ─────────────────────────────────────────────────────────────────────────────
// 1. Ingredient (05-ingredients) — content-суперсет ProductDef.
// ─────────────────────────────────────────────────────────────────────────────

export const IngredientSchema = z
  .object({
    key: ProductKeySchema,
    name: BilingualSchema,
    itemClass: ItemClassSchema,
    tier: TierSchema,
    storage: StorageKindSchema,
    /** Базовая цена продажи NPC-рынку, $ (14-economy). */
    basePrice: z.number().nonnegative(),
    demandCategory: DemandCategorySchema.optional(),
    assetKey: z.string().min(1).optional(),
  })
  .strict()

export type Ingredient = z.infer<typeof IngredientSchema>

// ─────────────────────────────────────────────────────────────────────────────
// 2. Recipe (06-recipes)
// ─────────────────────────────────────────────────────────────────────────────

export const RecipeInputSchema = z
  .object({
    key: ProductKeySchema,
    qty: z.number().int().positive(),
  })
  .strict()

export const RecipeUnlockSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('level'), farmLevel: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal('state'), stateKey: StateKeySchema }).strict(),
  z.object({ kind: z.literal('experiment') }).strict(),
  z.object({ kind: z.literal('starter') }).strict(),
])

export const RecipeSchema = z
  .object({
    key: RecipeKeySchema,
    name: BilingualSchema,
    tier: TierSchema,
    machineKey: MachineKeySchema,
    inputs: z.array(RecipeInputSchema).min(1, 'у рецепта должен быть хотя бы один вход'),
    output: z
      .object({
        key: ProductKeySchema,
        qty: z.number().int().positive(),
        itemClass: ItemClassSchema,
      })
      .strict(),
    /** Базовое время цикла, сек (модификаторы — стафф/know-how, 14-economy). */
    baseCraftSec: z.number().int().positive(),
    unlock: RecipeUnlockSchema,
  })
  .strict()

export type Recipe = z.infer<typeof RecipeSchema>

/** Mastery-опоры рецепта (не сам прогресс игрока — это конфиг верхних/нижних границ). */
export const RecipeMasteryConfigSchema = z
  .object({
    recipeKey: RecipeKeySchema,
    maxStars: z.number().int().positive(),
    qualityBonusPerStar: z.number().nonnegative(),
  })
  .strict()

/** Blue Plate Special — конфиг сета (main/side/drink должны существовать в каталоге рецептов). */
export const BluePlateSchema = z
  .object({
    key: CanonKeySchema,
    main: RecipeKeySchema,
    side: RecipeKeySchema,
    drink: RecipeKeySchema,
    priceBonusPct: z.number().positive(),
  })
  .strict()

export type BluePlate = z.infer<typeof BluePlateSchema>

// ─────────────────────────────────────────────────────────────────────────────
// 3. Machine (04-machines)
// ─────────────────────────────────────────────────────────────────────────────

export const MachineSchema = z
  .object({
    key: MachineKeySchema,
    name: BilingualSchema,
    post: StaffPostSchema,
    /** Сколько параллельных заданий (слотов очереди) держит станок. */
    slots: z.number().int().positive(),
    maxLevel: z.number().int().positive(),
    /**
     * Цена первого апгрейда станка (Ур.1→2), $ (`14-economy.md §4.2`). Апгрейд станков —
     * «главный Bucks-синк» (`14-economy.md §3.3/§4.7`) и следует единой геометрической
     * кривой ×2.2/уровень: `upgrade_cost(L→L+1) = baseCost × 2.2^(L-1)` (см. `§4.2` формула,
     * идентичная механике `BuildingLevelSchema`, но без предвычисленной таблицы — кривая
     * чисто геометрическая, посчитать может любой потребитель по формуле выше).
     */
    baseCost: z.number().positive(),
    assetKey: z.string().min(1).optional(),
  })
  .strict()

export type Machine = z.infer<typeof MachineSchema>

// ─────────────────────────────────────────────────────────────────────────────
// 4. Animal (03-animals) — контент-описание вида, НЕ экземпляр на ферме (см. `Animal`
//    в @/types/animals.ts — тот про игрока: id/affection/productReadyAt).
// ─────────────────────────────────────────────────────────────────────────────

/** Вид животного (03-animals: куры/коровы/свиньи/козы/овцы/пчёлы). */
export const AnimalKindSchema = z.enum(['chicken', 'cow', 'pig', 'goat', 'sheep', 'bee'])

/** Жильё (влияет на housing-бонус качества). */
export const AnimalHousingSchema = z.enum(['bld_barn', 'bld_coop', 'bld_apiary'])

export const AnimalDefSchema = z
  .object({
    kind: AnimalKindSchema,
    name: BilingualSchema,
    housing: AnimalHousingSchema,
    /** Продукт, который даёт животное (яйца/молоко/мёд/...). */
    productKey: ProductKeySchema,
    tier: TierSchema,
    /** Базовое время цикла, мин (03-animals §3.2: циклов/час = 60/cycle_min). */
    cycleMin: z.number().positive(),
    unlockLevel: z.number().int().nonnegative().optional(),
    assetKey: z.string().min(1).optional(),
  })
  .strict()

export type AnimalDef = z.infer<typeof AnimalDefSchema>

// ─────────────────────────────────────────────────────────────────────────────
// 5. Crop (02-farm) — грядки: семя → урожай.
// ─────────────────────────────────────────────────────────────────────────────

export const CropDefSchema = z
  .object({
    /** Ключ семени (itemClass 'seed' в Ingredient-каталоге). */
    seedKey: ProductKeySchema,
    /** Ключ урожая (itemClass 'crop' в Ingredient-каталоге). */
    cropKey: ProductKeySchema,
    name: BilingualSchema,
    tier: TierSchema,
    /** Время роста, сек. */
    growSec: z.number().int().positive(),
    /** Урожай за сбор (без бонусов стаффа/know-how). */
    yieldQty: z.number().int().positive(),
    /** Цена покупки семени, $. */
    seedCost: z.number().nonnegative(),
    unlockLevel: z.number().int().nonnegative().optional(),
    assetKey: z.string().min(1).optional(),
  })
  .strict()

export type CropDef = z.infer<typeof CropDefSchema>

// ─────────────────────────────────────────────────────────────────────────────
// 6. StaffMember (13-progression §3.2, canon §3.2) — контент-запись архетипа,
//    НЕ прогресс найма игрока (тот — `StaffMember` в @/types/progression.ts).
// ─────────────────────────────────────────────────────────────────────────────

export const StaffDefSchema = z
  .object({
    key: StaffKeySchema,
    name: BilingualSchema,
    /** Основной пост назначения (canon §3.2 таблица). */
    post: StaffPostSchema,
    /** Текстовое описание навыка (гипотеза-числа — 13-progression). */
    skillDescription: BilingualSchema,
    maxLevel: z.number().int().positive(),
    /** Стоимость найма, $ (0 — сюжетный/ивентовый найм). */
    hireCostBucks: z.number().nonnegative(),
    assetKey: z.string().min(1).optional(),
  })
  .strict()

export type StaffDef = z.infer<typeof StaffDefSchema>

// ─────────────────────────────────────────────────────────────────────────────
// 7. KnowHowNode (13-progression §3.9) — контент дерева исследований,
//    НЕ прогресс игрока (тот — `KnowHowNode` в @/types/progression.ts, есть `studied`).
// ─────────────────────────────────────────────────────────────────────────────

export const KnowHowNodeDefSchema = z
  .object({
    /** kh_<branch>_<node> (progression.ts комментарий). */
    key: z.string().regex(/^kh_[a-z0-9]+(_[a-z0-9]+)+$/, 'ожидается kh_<branch>_<node>'),
    branch: KnowHowBranchSchema,
    name: BilingualSchema,
    effect: BilingualSchema,
    /** Ключи предков-узлов (research_start требует изученных предков). */
    prereqs: z.array(z.string()),
    pointsCost: z.number().int().positive(),
    /** Время исследования, сек (0 — мгновенно). */
    studySec: z.number().int().nonnegative(),
  })
  .strict()

export type KnowHowNodeDef = z.infer<typeof KnowHowNodeDefSchema>

// ─────────────────────────────────────────────────────────────────────────────
// 8. Building (02-farm §3.8, canon §3.8) — контент построек по уровням,
//    НЕ экземпляр на ферме (тот — `Building` в @/types/farm.ts, есть `level`).
// ─────────────────────────────────────────────────────────────────────────────

export const BuildingLevelSchema = z
  .object({
    level: z.number().int().positive(),
    upgradeCostBucks: z.number().nonnegative(),
    upgradeSec: z.number().int().nonnegative(),
    effect: BilingualSchema.optional(),
  })
  .strict()

export const BuildingDefSchema = z
  .object({
    key: BuildingKeySchema,
    name: BilingualSchema,
    maxLevel: z.number().int().positive(),
    levels: z.array(BuildingLevelSchema).min(1, 'нужен хотя бы уровень 1'),
    assetKey: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((building, ctx) => {
    if (building.levels.length !== building.maxLevel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `levels.length (${building.levels.length}) должен совпадать с maxLevel (${building.maxLevel})`,
        path: ['levels'],
      })
    }
    const seen = new Set<number>()
    building.levels.forEach((lvl, idx) => {
      if (seen.has(lvl.level)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `дублирующийся level=${lvl.level}`,
          path: ['levels', idx, 'level'],
        })
      }
      seen.add(lvl.level)
    })
    for (let l = 1; l <= building.maxLevel; l++) {
      if (!seen.has(l)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `отсутствует запись для level=${l} (levels должны покрывать 1..maxLevel без пропусков)`,
          path: ['levels'],
        })
      }
    }
  })

export type BuildingDef = z.infer<typeof BuildingDefSchema>

// ─────────────────────────────────────────────────────────────────────────────
// 9. State/Expedition (07-expeditions) — контент штата роуд-трипа, совместим
//    со `StateDef` из @/types/expeditions.ts (+ name, т.к. это контент-каталог).
// ─────────────────────────────────────────────────────────────────────────────

export const StateContentSchema = z
  .object({
    key: StateKeySchema,
    name: BilingualSchema,
    tier: TierSchema,
    /** Хайлайт-продукты, что открывает штат (highlights.length ≥ 1). */
    highlights: z.array(ProductKeySchema).min(1),
    /** Позиция в лестнице роуд-трипа (0 = st_home). */
    routeSlot: z.number().int().nonnegative().optional(),
  })
  .strict()

export type StateContent = z.infer<typeof StateContentSchema>

// ─────────────────────────────────────────────────────────────────────────────
// 10. TownProject (11-town §3) — контент коллективной постройки по этапам.
// ─────────────────────────────────────────────────────────────────────────────

export const TownProjectStageSchema = z
  .object({
    stage: z.number().int().positive(),
    goalBucks: z.number().nonnegative(),
    /** Ресурсы-требования этапа (доски/гвозди/неон-трубки, 11-town §3). */
    goalResources: CountMapSchema.optional(),
    reward: BilingualSchema,
  })
  .strict()

export const TownProjectDefSchema = z
  .object({
    key: TownProjectKeySchema,
    name: BilingualSchema,
    /** 3 этапа — гипотеза 11-town §3; держим как ≥1 для гибкости баланса. */
    stages: z.array(TownProjectStageSchema).min(1),
  })
  .strict()
  .superRefine((project, ctx) => {
    const stageNums = project.stages.map((s) => s.stage)
    const seen = new Set<number>()
    stageNums.forEach((s, idx) => {
      if (seen.has(s)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `дублирующийся stage=${s}`,
          path: ['stages', idx, 'stage'],
        })
      }
      seen.add(s)
    })
  })

export type TownProjectDef = z.infer<typeof TownProjectDefSchema>

// ─────────────────────────────────────────────────────────────────────────────
// 11. Achievement (17-collections §3.5) — 63 таблички Achievement Wall.
// ─────────────────────────────────────────────────────────────────────────────

export const AchievementSchema = z
  .object({
    key: z.string().regex(/^ach_[a-z0-9_]+$/, 'ожидается ach_<...>'),
    /** Категория из 17-collections §3.5 (свободная строка — RU-заголовки категорий). */
    category: z.string().min(1),
    condition: BilingualSchema,
    /** Название таблички-награды («Five-Star Kitchen» и т.п.), сама табличка не даёт силы. */
    rewardTitle: z.string().min(1),
    hidden: z.boolean().optional(),
  })
  .strict()

export type Achievement = z.infer<typeof AchievementSchema>

// ─────────────────────────────────────────────────────────────────────────────
// 12. Postcard (17-collections, mech_greetings_postcard) — контент открытки,
//     НЕ владение игрока (тот — `Postcard` в @/types/collections.ts, есть `owned`).
// ─────────────────────────────────────────────────────────────────────────────

export const PostcardDefSchema = z
  .object({
    key: z.string().regex(/^postcard_[a-z0-9_]+$/, 'ожидается postcard_<...>'),
    name: BilingualSchema,
    /** Открытка штата волны 1 (1/штат) ИЛИ ивентовая (eventKey). */
    stateKey: StateKeySchema.optional(),
    eventKey: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((postcard, ctx) => {
    if (!postcard.stateKey && !postcard.eventKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'открытка должна быть привязана либо к stateKey, либо к eventKey',
        path: ['stateKey'],
      })
    }
  })

export type PostcardDef = z.infer<typeof PostcardDefSchema>

// ─────────────────────────────────────────────────────────────────────────────
// 13. Toy (17-collections §3.10, Prize Machine) — контент игрушки,
//     НЕ владение игрока (тот — `Toy` в @/types/collections.ts, есть `owned`).
// ─────────────────────────────────────────────────────────────────────────────

export const ToyRaritySchema = z.enum(['common', 'uncommon', 'rare', 'chase'])

export const ToyDefSchema = z
  .object({
    /** toy_<series>_<n> (collections.ts комментарий). */
    key: z.string().regex(/^toy_[a-z0-9]+(_[a-z0-9]+)+$/, 'ожидается toy_<series>_<n>'),
    series: ToySeriesKeySchema,
    name: BilingualSchema,
    rarity: ToyRaritySchema,
  })
  .strict()

export type ToyDef = z.infer<typeof ToyDefSchema>

// ─────────────────────────────────────────────────────────────────────────────
// 14. CosmeticItem (17-collections §3.11) — отдельный предмет косметик-сета
//     (сам сет `cos_googie`/... — закрытый список CosmeticKey/CosmeticSetKeySchema).
// ─────────────────────────────────────────────────────────────────────────────

export const CosmeticTargetSchema = z.enum(['diner', 'truck', 'staff', 'sign', 'interior'])

export const CosmeticItemSchema = z
  .object({
    key: CanonKeySchema,
    setKey: CosmeticSetKeySchema,
    name: BilingualSchema,
    target: CosmeticTargetSchema,
    priceDimes: z.number().int().nonnegative().optional(),
    priceBucks: z.number().nonnegative().optional(),
    /** Как получить, если не за деньги (Prize Machine/ачивка/ивент). */
    obtainedVia: z.enum(['purchase', 'prize_machine', 'achievement', 'event']).optional(),
  })
  .strict()

export type CosmeticItem = z.infer<typeof CosmeticItemSchema>

// ─────────────────────────────────────────────────────────────────────────────
// 15. PassTrack (13-progression, ui_route_pass) — таблица наград сезона.
// ─────────────────────────────────────────────────────────────────────────────

export const RewardSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('currency'), currency: CurrencyKeySchema, qty: z.number().positive() }).strict(),
  z.object({ kind: z.literal('item'), itemKey: ProductKeySchema, qty: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal('cosmetic'), cosmeticKey: z.string() }).strict(),
  z.object({ kind: z.literal('toy'), toyKey: z.string() }).strict(),
])

export type Reward = z.infer<typeof RewardSchema>

export const PassTierSchema = z
  .object({
    tier: z.number().int().positive(),
    xpRequired: z.number().int().nonnegative(),
    freeReward: RewardSchema.optional(),
    premiumReward: RewardSchema.optional(),
  })
  .strict()

export const PassTrackSchema = z
  .object({
    season: z.number().int().positive(),
    name: BilingualSchema,
    tiers: z.array(PassTierSchema).min(1),
  })
  .strict()
  .superRefine((track, ctx) => {
    const seen = new Set<number>()
    track.tiers.forEach((t, idx) => {
      if (seen.has(t.tier)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `дублирующийся tier=${t.tier}`,
          path: ['tiers', idx, 'tier'],
        })
      }
      seen.add(t.tier)
    })
  })

export type PassTrack = z.infer<typeof PassTrackSchema>

// ─────────────────────────────────────────────────────────────────────────────
// 16. DailySpecialTemplate (16-retention §3.2, Sheriff Roy) — пул 38 шаблонов,
//     НЕ выданное игроку задание дня (тот — `DailySpecial` в @/types/recipes.ts).
// ─────────────────────────────────────────────────────────────────────────────

export const DailySpecialCategorySchema = z.enum(['Kitchen', 'Field', 'Counter', 'Yard', 'Community'])

export const DailySpecialTemplateSchema = z
  .object({
    key: z.string().regex(/^dsp_[a-z0-9_]+$/, 'ожидается dsp_<...>'),
    category: DailySpecialCategorySchema,
    name: BilingualSchema,
    /** Пул рецептов, из которых сервер выбирает конкретное задание (пусто = любой рецепт категории). */
    recipePoolKeys: z.array(RecipeKeySchema).optional(),
    targetQty: z.number().int().positive(),
    rewardHint: z.string().min(1),
  })
  .strict()

export type DailySpecialTemplate = z.infer<typeof DailySpecialTemplateSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Реестр каталогов — единый источник правды для загрузчика (`validate.test.ts`)
// и для будущих авторов контента (`src/data/catalogs/*.ts`).
//
// Каждый файл каталога — именованный экспорт МАССИВА записей под именем `exportName`.
// Файл может отсутствовать (контент ещё не написан) — тогда каталог просто
// пропускается (см. `validate.test.ts`: `it.skip`).
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogSpec {
  /** Человеко-читаемое имя (для сообщений об ошибках). */
  name: string
  /** Имя файла в `src/data/catalogs/` (без расширения) — контракт для авторов контента. */
  file: string
  /** Имя именованного экспорта — массив записей каталога. */
  exportName: string
  schema: z.ZodTypeAny
  /** Извлекает уникальный ключ записи (для проверки дублей). */
  keyOf: (item: unknown) => string
}

const keyOfDefault = (item: unknown): string => {
  if (item && typeof item === 'object' && 'key' in item) {
    return String((item as { key: unknown }).key)
  }
  throw new Error('keyOf: запись без поля `key` — передай keyOf явно в CatalogSpec')
}

export const CONTENT_CATALOGS: readonly CatalogSpec[] = [
  { name: 'Ingredient', file: 'ingredients', exportName: 'ingredients', schema: IngredientSchema, keyOf: keyOfDefault },
  { name: 'Recipe', file: 'recipes', exportName: 'recipes', schema: RecipeSchema, keyOf: keyOfDefault },
  { name: 'Machine', file: 'machines', exportName: 'machines', schema: MachineSchema, keyOf: keyOfDefault },
  { name: 'AnimalDef', file: 'animals', exportName: 'animals', schema: AnimalDefSchema, keyOf: (i) => (i as AnimalDef).kind },
  { name: 'CropDef', file: 'crops', exportName: 'crops', schema: CropDefSchema, keyOf: (i) => (i as CropDef).seedKey },
  { name: 'StaffDef', file: 'staff', exportName: 'staff', schema: StaffDefSchema, keyOf: keyOfDefault },
  { name: 'KnowHowNodeDef', file: 'knowHow', exportName: 'knowHowNodes', schema: KnowHowNodeDefSchema, keyOf: keyOfDefault },
  { name: 'BuildingDef', file: 'buildings', exportName: 'buildings', schema: BuildingDefSchema, keyOf: keyOfDefault },
  { name: 'StateContent', file: 'states', exportName: 'states', schema: StateContentSchema, keyOf: keyOfDefault },
  { name: 'TownProjectDef', file: 'townProjects', exportName: 'townProjects', schema: TownProjectDefSchema, keyOf: keyOfDefault },
  { name: 'Achievement', file: 'achievements', exportName: 'achievements', schema: AchievementSchema, keyOf: keyOfDefault },
  { name: 'PostcardDef', file: 'postcards', exportName: 'postcards', schema: PostcardDefSchema, keyOf: keyOfDefault },
  { name: 'ToyDef', file: 'toys', exportName: 'toys', schema: ToyDefSchema, keyOf: keyOfDefault },
  { name: 'CosmeticItem', file: 'cosmetics', exportName: 'cosmeticItems', schema: CosmeticItemSchema, keyOf: keyOfDefault },
  { name: 'PassTrack', file: 'passTracks', exportName: 'passTracks', schema: PassTrackSchema, keyOf: (i) => String((i as PassTrack).season) },
  {
    name: 'DailySpecialTemplate',
    file: 'dailySpecials',
    exportName: 'dailySpecialTemplates',
    schema: DailySpecialTemplateSchema,
    keyOf: keyOfDefault,
  },
]

/** Парсит массив записей каталога через схему, кидает с указанием индекса/каталога при ошибке. */
export function parseCatalog<T>(schema: z.ZodType<T>, items: unknown[], catalogName: string): T[] {
  return items.map((item, idx) => {
    const res = schema.safeParse(item)
    if (!res.success) {
      throw new Error(`[${catalogName}] запись #${idx} не прошла валидацию:\n${res.error.toString()}`)
    }
    return res.data
  })
}

/** Бросает, если среди `keys` есть дубликаты (используется для проверки уникальности ключей каталога). */
export function assertUniqueKeys(keys: string[], catalogName: string): void {
  const seen = new Map<string, number>()
  keys.forEach((k, idx) => {
    if (seen.has(k)) {
      throw new Error(`[${catalogName}] дублирующийся ключ "${k}" (записи #${seen.get(k)} и #${idx})`)
    }
    seen.set(k, idx)
  })
}
