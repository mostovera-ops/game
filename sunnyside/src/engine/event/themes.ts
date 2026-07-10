/**
 * engine/event/themes.ts — множители M_theme прочих тем + диспетчер (§3.10–3.12, §4.3).
 *
 * The Big Festival (палатки + Balance Bonus), Drive-in Night (evening window),
 * Harvest Homecoming (combo/variety), State Fair Showdown (нейтральная шкала).
 * Glutton вынесен в `grimsby.ts`.
 *
 * ЧИСТАЯ логика: ноль сети/three/state.
 */

import type { EpochMs } from '@/types'
import {
  DRIVEIN_CATEGORIES,
  DRIVEIN_EVENING_END_HOUR,
  DRIVEIN_EVENING_MULT,
  DRIVEIN_EVENING_START_HOUR,
  FESTIVAL_BALANCE_COEFF,
  FESTIVAL_CATEGORY_TENT,
  FESTIVAL_TENT_SHARE,
  HARVEST_COMBO_MULT,
  HARVEST_VARIETY_BONUS,
  type DishCategory,
  type FestivalTent,
} from './constants'
import { gluttonMultiplier } from './grimsby'

// ── The Big Festival (§3.10, §4.9) ────────────────────────────────────────────

/** Палатка, в которую маршрутизируется блюдо категории (§3.10). */
export function tentForCategory(category: DishCategory): FestivalTent {
  return FESTIVAL_CATEGORY_TENT[category]
}

/** Под-цель палатки (§3.10): доля от Goal_100. Сумма долей = Goal_100. */
export function festivalSubGoal(tent: FestivalTent, goal100: number): number {
  return FESTIVAL_TENT_SHARE[tent] * goal100
}

/**
 * Ratio баланса палаток (§3.10): min/max НОРМИРОВАННЫХ заполнений
 * `fill_t = FP_tent / SubGoal_tent` — не абсолютный FP (иначе Concessions всегда
 * доминировала бы). `∈ [0; 1]`; идеальный баланс → 1. Если max=0 → 0.
 */
export function festivalBalanceRatio(
  tentFp: Readonly<Record<FestivalTent, number>>,
  goal100: number,
): number {
  const fills = (Object.keys(FESTIVAL_TENT_SHARE) as FestivalTent[]).map((tent) => {
    const subGoal = festivalSubGoal(tent, goal100)
    return subGoal > 0 ? Math.max(0, tentFp[tent] ?? 0) / subGoal : 0
  })
  const min = Math.min(...fills)
  const max = Math.max(...fills)
  if (max <= 0) return 0
  return min / max
}

/** Balance Bonus (§3.10): M_theme = 1 + 0.25×ratio. Идеальный баланс → ×1.25. */
export function festivalBalanceMultiplier(ratio: number): number {
  const r = Math.max(0, Math.min(1, ratio))
  return 1 + FESTIVAL_BALANCE_COEFF * r
}

// ── Drive-in Night (§3.11) ────────────────────────────────────────────────────

/** Серверный час UTC из абсолютного времени (детерминированно, для evening window). */
export function utcHour(now: EpochMs): number {
  return new Date(now).getUTCHours()
}

/** Попадает ли час в вечернее окно 18:00–02:00 UTC (§3.11). */
export function isEveningWindow(hour: number): boolean {
  // Окно оборачивается через полночь: [18..24) ∪ [0..2).
  return hour >= DRIVEIN_EVENING_START_HOUR || hour < DRIVEIN_EVENING_END_HOUR
}

/**
 * M_theme Drive-in (§3.11): снеки/напитки ×1.5 в вечернее окно, иначе ×1.0.
 * Базовый вклад круглосуточен — множится только вечером (компромисс таймзон, EV11).
 */
export function driveInMultiplier(category: DishCategory, now: EpochMs): number {
  if (DRIVEIN_CATEGORIES.includes(category) && isEveningWindow(utcHour(now))) {
    return DRIVEIN_EVENING_MULT
  }
  return 1.0
}

// ── Harvest Homecoming (§3.11) ────────────────────────────────────────────────

/** Combo Bonus (§3.11): Blue Plate Special (блюдо+гарнир+напиток) → ×1.5 всем трём. */
export function harvestComboMultiplier(isCombo: boolean): number {
  return isCombo ? HARVEST_COMBO_MULT : 1.0
}

/**
 * Variety Streak (§3.11): если игрок за уикенд внёс блюда из ВСЕХ 4 категорий —
 * разовый +10% к личному FP. Возвращает множитель к personal_fp.
 */
export function varietyStreakBonus(categoriesContributed: ReadonlySet<DishCategory>): number {
  return categoriesContributed.size >= 4 ? 1 + HARVEST_VARIETY_BONUS : 1.0
}

// ── Диспетчер M_theme (§3.3, §4.3) ────────────────────────────────────────────

/** Контекст темы для разрешения M_theme одного блюда. Поля опциональны по теме. */
export interface ThemeContext {
  /** Glutton: индекс фазы + активный Grand Craving. */
  phaseIndex?: number
  grandCraving?: DishCategory | null
  /** Festival: заранее посчитанный ratio баланса палаток. */
  balanceRatio?: number
  /** Drive-in: серверное время (для evening window). */
  now?: EpochMs
  /** Harvest: является ли блюдо частью Blue Plate combo. */
  isCombo?: boolean
}

/**
 * Единый M_theme блюда по теме (§3.3): темы отличаются ТОЛЬКО этим множителем и
 * структурой меры. Showdown — нейтральная шкала (versus в скоринге, не в M_theme).
 */
export function themeMultiplier(
  theme:
    | 'ev_glutton'
    | 'ev_big_festival'
    | 'ev_harvest_homecoming'
    | 'ev_drivein_night'
    | 'ev_state_fair_showdown',
  category: DishCategory,
  ctx: ThemeContext = {},
): number {
  switch (theme) {
    case 'ev_glutton':
      return gluttonMultiplier(category, ctx.phaseIndex ?? 0, ctx.grandCraving ?? null)
    case 'ev_big_festival':
      return festivalBalanceMultiplier(ctx.balanceRatio ?? 0)
    case 'ev_harvest_homecoming':
      return harvestComboMultiplier(ctx.isCombo ?? false)
    case 'ev_drivein_night':
      return ctx.now != null ? driveInMultiplier(category, ctx.now) : 1.0
    case 'ev_state_fair_showdown':
      return 1.0
    default:
      return 1.0
  }
}
