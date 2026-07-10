/**
 * engine/event/constants.ts — каноничные константы серверного ивента (10-server-event).
 *
 * ВСЕ ЧИСЛА — ИЗ СПЕКИ 10-server-event (прошла ревью Фаза B), не выдуманы. При
 * расхождении канон (`00-canon.md`) — истина. Ссылки на параграфы спеки — рядом.
 *
 * ГРАНИЦА (AGENTS.md §3): ноль импортов three / react / net / state. Чистые числа/типы.
 */

import type { Tier } from '@/types'

// ── Категории блюд (§3.1; нейминг-кандидат, требует канона §8) ────────────────
/**
 * Ось категорий блюда — нужна темам (палатки фестиваля, капризы Гримсби).
 * Канон её ещё НЕ фиксирует (10-server-event §8 п.1) → держим локально в модуле
 * ивента как нейминг-кандидат. Ровно 4 (§3.1).
 */
export type DishCategory = 'cat_snacks' | 'cat_grill' | 'cat_desserts' | 'cat_drinks'

export const DISH_CATEGORIES: readonly DishCategory[] = [
  'cat_snacks',
  'cat_grill',
  'cat_desserts',
  'cat_drinks',
] as const

// ── Base Fill Points по тиру (§4.1) ──────────────────────────────────────────
/**
 * BFP(tier) — базовые аппетит-очки блюда по тиру. Шкала КОМПРЕССИРОВАНА
 * относительно цены (§3.3): T5 = 62× FP от T1, но стоит 150× → T1 эффективнее по
 * FP/бакс, T5 — по FP/слот (канон E9 «ранние тиры живы»).
 */
export const BASE_FILL_POINTS: Readonly<Record<Tier, number>> = {
  1: 10,
  2: 28,
  3: 80,
  4: 220,
  5: 620,
} as const

// ── Множитель качества Q (§4.2; мастер mech_mastery, 06-recipes §3.3 R18) ─────
/** Q = 1 + QUALITY_STAR_COEFF × stars, stars ∈ {0..5} → 1.00 … 1.40. */
export const QUALITY_STAR_COEFF = 0.08
export const MAX_MASTERY_STARS = 5

// ── Канальный множитель K_channel (§4.4) ─────────────────────────────────────
/** Пожертвование ценнее продажи: donate ×1.10, passive (авто-продажа) ×1.00. */
export const CHANNEL_MULT: Readonly<Record<'donate' | 'passive', number>> = {
  donate: 1.1,
  passive: 1.0,
} as const

/** `🎟 1` за каждые 500 FP пожертвованных, кап `🎟 10`/уикенд (§4.4). */
export const DONATION_FP_PER_TICKET = 500
export const DONATION_TICKET_CAP = 10

// ── Динамическая цель Goal_100 (§3.15) ───────────────────────────────────────
/** Целевой вклад эффективных FP на активного игрока (тюнинг-ручка, §3.15). */
export const GOAL_FP_PER_ACTIVE = 2800
/** Клампы актива: пол 30 (малый город посилен), потолок 80 (анти-накрутка). */
export const N_EFF_MIN = 30
export const N_EFF_MAX = 80
/** Goal_100 округляется до ближайшей 1000 (§3.15). */
export const GOAL_ROUND_STEP = 1000

// ── Серверные вехи (§3.4) ────────────────────────────────────────────────────
export type MilestonePct = 25 | 50 | 75 | 100
export type StretchPct = 125 | 150
/** Базовые вехи «награды всем жителям». */
export const MILESTONE_PCTS: readonly MilestonePct[] = [25, 50, 75, 100] as const
/** Мягкие stretch-вехи (только `🎟`, убывающе; кап наград на 150%, §3.4). */
export const STRETCH_PCTS: readonly StretchPct[] = [125, 150] as const

// ── Freshness анти-флуд F(category) (§3.14, канон E7) ─────────────────────────
/** Порог потока категории за окно 60 мин = 8% Goal_100 (при нём F=1.0). */
export const FRESHNESS_FLOOD_PCT = 0.08
/** Наклон спада: F = 1 − 0.5×(recent/threshold). При двойном перекорме → пол. */
export const FRESHNESS_SLOPE = 0.5
/** Пол/потолок freshness — категорию нельзя «убить» совсем. */
export const FRESHNESS_FLOOR = 0.5
export const FRESHNESS_CEIL = 1.0
/** Скользящее окно накопления `recent` (мин) и полное восстановление (мин). */
export const FRESHNESS_WINDOW_MIN = 60
export const FRESHNESS_RECOVERY_MIN = 120

// ── Тема: The Glutton Comes to Town (§3.9, §4.8) ─────────────────────────────
/** Длина фазы-каприза — 4 ч (~11 фаз на окно 44 ч). */
export const GLUTTON_PHASE_HOURS = 4
/** Множители фазы: craves / likes / bored / прочее. */
export const GLUTTON_CRAVES_MULT = 2.0
export const GLUTTON_LIKES_MULT = 1.3
export const GLUTTON_BORED_MULT = 0.6
export const GLUTTON_NEUTRAL_MULT = 1.0
/**
 * Grand Craving — АБСОЛЮТНЫЙ множитель целевой категории (заменяет фазовый, не
 * поверх; прочие категории на это время ×1.0). 2 ч, триггер ~50% и ~90% шкалы. */
export const GLUTTON_GRAND_CRAVING_MULT = 3.0
export const GLUTTON_GRAND_CRAVING_HOURS = 2
/** Пороги шкалы (в %), на пересечении которых включается Grand Craving. */
export const GLUTTON_GRAND_CRAVING_TRIGGERS: readonly number[] = [50, 90] as const
/** Clean Plate: ≥6% Goal_100 в craved-категорию за фазу → +5% FP категории в шкалу. */
export const GLUTTON_CLEAN_PLATE_PCT = 0.06
export const GLUTTON_CLEAN_PLATE_BONUS = 0.05
/**
 * Фиксированный цикл craved-категории по фазам (§3.9): любой пояс застаёт каждую.
 * Индекс фазы `% 4` даёт позицию; на позиции — какая категория craves/likes/bored. */
export interface GluttonPhaseDef {
  craves: DishCategory
  likes: DishCategory
  bored: DishCategory
}
export const GLUTTON_PHASE_CYCLE: readonly GluttonPhaseDef[] = [
  // P1: «Гримсби хочет сла-адкого!»
  { craves: 'cat_desserts', likes: 'cat_drinks', bored: 'cat_grill' },
  // P2: «Дайте ему мяса с огня!»
  { craves: 'cat_grill', likes: 'cat_snacks', bored: 'cat_drinks' },
  // P3: «Что-нибудь похрустеть!»
  { craves: 'cat_snacks', likes: 'cat_desserts', bored: 'cat_drinks' },
  // P4: «В горле пересохло!»
  { craves: 'cat_drinks', likes: 'cat_grill', bored: 'cat_snacks' },
] as const

// ── Тема: The Big Festival (§3.10, §4.9) ─────────────────────────────────────
export type FestivalTent = 'tent_concessions' | 'tent_grill' | 'tent_sweets'
/**
 * Доли под-целей палаток (сумма = Goal_100). Concessions покрывает 2 категории
 * (snacks+drinks) → доля 2/4; Grill и Sweets — по 1/4 (§3.10). */
export const FESTIVAL_TENT_SHARE: Readonly<Record<FestivalTent, number>> = {
  tent_concessions: 2 / 4,
  tent_grill: 1 / 4,
  tent_sweets: 1 / 4,
} as const
/** Маршрутизация категории блюда в палатку (§3.10). */
export const FESTIVAL_CATEGORY_TENT: Readonly<Record<DishCategory, FestivalTent>> = {
  cat_snacks: 'tent_concessions',
  cat_drinks: 'tent_concessions',
  cat_grill: 'tent_grill',
  cat_desserts: 'tent_sweets',
} as const
/** Balance Bonus: M_theme = 1 + 0.25×(min/max нормированных заполнений). */
export const FESTIVAL_BALANCE_COEFF = 0.25

// ── Сезонки: Drive-in Night / Harvest Homecoming (§3.11, §4.3) ───────────────
/** Evening window: снеки/напитки ×1.5 в серверные часы 18:00–02:00 UTC. */
export const DRIVEIN_EVENING_MULT = 1.5
export const DRIVEIN_EVENING_START_HOUR = 18 // включительно
export const DRIVEIN_EVENING_END_HOUR = 2 // до 02:00 (не включая)
export const DRIVEIN_CATEGORIES: readonly DishCategory[] = ['cat_snacks', 'cat_drinks'] as const
/** Harvest: Blue Plate combo ×1.5; Variety Streak (все 4 категории) +10% личного FP. */
export const HARVEST_COMBO_MULT = 1.5
export const HARVEST_VARIETY_BONUS = 0.1

// ── Личные вехи → сундуки (§3.5, §4.5) ───────────────────────────────────────
export type ChestKey = 'chest_bronze' | 'chest_silver' | 'chest_gold' | 'chest_platinum'
/** Базовые пороги FP (лига Sprout ×1.00). Bronze — participation-floor (§3.5). */
export const CHEST_BASE_THRESHOLD: Readonly<Record<ChestKey, number>> = {
  chest_bronze: 600,
  chest_silver: 1600,
  chest_gold: 3200,
  chest_platinum: 6000,
} as const

// ── Вклад стрита → вымпел (§3.6, §4.6) ───────────────────────────────────────
export type PennantKey = 'pennant_bronze' | 'pennant_silver' | 'pennant_gold'
/** Пороги FP-на-участника (StreetScore). Center Stage — топ-1, вне порога. */
export const PENNANT_THRESHOLD: Readonly<Record<PennantKey, number>> = {
  pennant_bronze: 1500,
  pennant_silver: 2500,
  pennant_gold: 4000,
} as const
/** Пол делителя StreetScore — не даёт «стриту из 1–2 ферм» космический per-capita (§3.6). */
export const STREET_MIN_FLOOR = 5
/** Adopt-a-Tent: FP усыновлённой палатки считаются ×2 к вымпелу стрита (§3.10). */
export const FESTIVAL_ADOPT_MULT = 2

// ── Лиги по историческому вкладу (§3.7, §4.7) ────────────────────────────────
export type LeagueKey = 'lg_sprout' | 'lg_cook' | 'lg_chef' | 'lg_head_chef' | 'lg_legend'
export interface LeagueDef {
  key: LeagueKey
  /** Порог накопленного за сезон FP (season FP). */
  minSeasonFp: number
  /** Множитель порогов сундуков Silver+ (челлендж растёт с лигой). */
  chestThresholdMult: number
}
/** Пять лиг по накопленному за сезон Route Pass FP (§4.7). Отсортированы по возрастанию. */
export const LEAGUES: readonly LeagueDef[] = [
  { key: 'lg_sprout', minSeasonFp: 0, chestThresholdMult: 1.0 },
  { key: 'lg_cook', minSeasonFp: 15_000, chestThresholdMult: 1.15 },
  { key: 'lg_chef', minSeasonFp: 50_000, chestThresholdMult: 1.3 },
  { key: 'lg_head_chef', minSeasonFp: 120_000, chestThresholdMult: 1.5 },
  { key: 'lg_legend', minSeasonFp: 260_000, chestThresholdMult: 1.7 },
] as const
/** Перенос league_score между сезонами — мягкий сброс 25% (§3.7, §4.7). */
export const LEAGUE_SEASON_CARRY = 0.25
