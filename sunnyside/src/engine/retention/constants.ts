/**
 * engine/retention/constants.ts — мастер-числа `docs/specs/16-retention.md`.
 *
 * ВСЕ значения помечены гипотезой там, где спека сама помечает их гипотезой
 * (§4.1–§4.4) — ничего не выдумано сверх таблиц спеки; финальная калибровка
 * (14-economy.md) может их заменить, но канал синхронизации уже зафиксирован
 * там (см. §4.3 примечание спеки). Изменения чисел — правкой этого файла, не
 * магическими константами в формулах.
 *
 * ГРАНИЦА (AGENTS.md §3): ноль three/react/net. Чистые данные.
 */

import type { DailySpecialTemplate } from '@/data/schema'

/**
 * `data/schema.ts` — стабильная зона владения архитектуры (AGENTS.md §2), не
 * правим её мимоходом ради экспорта типа-алиаса: выводим категорию из уже
 * экспортированного `DailySpecialTemplate['category']` вместо правки схемы.
 */
export type DailySpecialCategory = DailySpecialTemplate['category']

// ── Daily Specials — фокус-категории (§3.1/§3.2) ──────────────────────────────

/** 4 «производственные» категории — максимум 1 задача каждой на день (anti-repeat §3.1 п.a). */
export const NON_COMMUNITY_CATEGORIES: readonly DailySpecialCategory[] = [
  'Field',
  'Kitchen',
  'Counter',
  'Yard',
] as const

/** Кросс-категория — может дублироваться до 1 раза (т.е. максимум 2 записи/день, §3.1 п.a). */
export const COMMUNITY_CATEGORY: DailySpecialCategory = 'Community'

/** Сколько задач выдаётся на игровой день (§3.1, §1 TL;DR). */
export const DAILY_SPECIALS_COUNT = 3

/** Максимум повторов `Community` за день (единственное исключение из anti-repeat, §3.1 п.a). */
export const MAX_COMMUNITY_PER_DAY = 2

// ── Скейлинг по бракету Farm Value (§3.1, таблица бракетов) ───────────────────

export interface FarmValueBracketRow {
  /** Титул бракета (13-progression §3.4.3) — информационная метка, НЕ канон-ключ (правило 7). */
  label: string
  /** Нижняя граница мгновенного Farm Value бракета (включительно). */
  minFarmValue: number
  /** Множитель `target` (число единиц шаблона). */
  targetMult: number
  /** Множитель `reward_bucks` (используется econ-слоем при переводе в итоговые `$`). */
  rewardMult: number
}

/** Таблица §3.1 (гипотеза, финальная калибровка — плейтест + 14-economy.md). */
export const FARM_VALUE_BRACKETS: readonly FarmValueBracketRow[] = [
  { label: 'Roadside Stand', minFarmValue: 0, targetMult: 1.0, rewardMult: 1.0 },
  { label: 'Corner Diner', minFarmValue: 2_500, targetMult: 1.2, rewardMult: 1.3 },
  { label: 'Blue Plate Kitchen', minFarmValue: 6_000, targetMult: 1.5, rewardMult: 1.6 },
  { label: 'County Favorite', minFarmValue: 12_000, targetMult: 1.8, rewardMult: 2.0 },
  { label: 'Highway Landmark', minFarmValue: 25_000, targetMult: 2.2, rewardMult: 2.5 },
  { label: 'State Fair Regular', minFarmValue: 45_000, targetMult: 2.6, rewardMult: 3.0 },
  { label: 'Route 66 Legend', minFarmValue: 80_000, targetMult: 3.0, rewardMult: 3.5 },
  { label: 'County Landmark', minFarmValue: 130_000, targetMult: 3.4, rewardMult: 4.0 },
] as const

// ── Daily Specials — награды per-day (§4.1, модель — не per-template) ─────────

/** Разовый бонус `$` при 2/3 или 3/3 (гипотеза §4.1). */
export const DAY_COMPLETE_BONUS_BUCKS = 40

/** Шанс `🎟 1` при ровно 2/3 (гипотеза §4.1, один бросок за день). */
export const TICKET_CHANCE_AT_2_OF_3 = 0.2

// ── Regular Streak — бонус к выручке прилавка (§4.2) ──────────────────────────

export interface DayRangeRow<V> {
  /** Нижняя граница диапазона дней стрика (включительно). */
  minDays: number
  value: V
}

/** Таблица §4.2 (бонус к Bucks-выручке прилавка, % — уже как доля 0..0.4). */
export const STREAK_BONUS_TABLE: readonly DayRangeRow<number>[] = [
  { minDays: 1, value: 0 },
  { minDays: 3, value: 0.1 },
  { minDays: 7, value: 0.18 },
  { minDays: 14, value: 0.26 },
  { minDays: 21, value: 0.34 },
  { minDays: 30, value: 0.4 },
] as const

/** Таблица §4.3 (цена страховки в `🎟`, растёт со стажем стрика на момент пропуска). */
export const STREAK_INSURANCE_PRICE_TABLE: readonly DayRangeRow<number>[] = [
  { minDays: 1, value: 2 },
  { minDays: 7, value: 4 },
  { minDays: 14, value: 6 },
  { minDays: 21, value: 8 },
  { minDays: 30, value: 10 },
] as const

/** Длительность бесплатной заморозки/оплаченной страховки — 24ч (§3.3). */
export const STREAK_FREEZE_MS = 24 * 60 * 60 * 1000

/** Не более 2 бесплатных заморозок в календарный месяц (§3.3), счётчик — атрибут месяца. */
export const FREE_FREEZES_PER_MONTH = 2

// ── Gone Fishin' / Vacation Mode (§3.5) ────────────────────────────────────────

export const VACATION_MIN_DAYS = 3
export const VACATION_MAX_DAYS = 30

/** Минимум простоя на «реальной» ферме между двумя Vacation Mode (§3.5, анти-абьюз). */
export const VACATION_REACTIVATION_COOLDOWN_MS = 24 * 60 * 60 * 1000

// ── Neighbor Sitter (§4.4) ──────────────────────────────────────────────────────

/** Награда первому за игровой день соседу, присмотревшему за фермой в отпуске (гипотеза §4.4). */
export const NEIGHBOR_SIT_TICKET_REWARD = 1
export const NEIGHBOR_SIT_BUCKS_REWARD = 10

// ── Общий хелпер для таблиц-диапазонов (§4.2/§4.3 — одна форма, разные значения) ──

/**
 * Возвращает `value` последней строки таблицы, чей `minDays` ≤ `days` (таблица
 * отсортирована по возрастанию `minDays`). `days < table[0].minDays` — берёт
 * первую строку (нет отрицательных стриков).
 */
export function lookupByDayRange<V>(table: readonly DayRangeRow<V>[], days: number): V {
  let result = table[0]!.value
  for (const row of table) {
    if (days >= row.minDays) result = row.value
    else break
  }
  return result
}

/** Бракет Farm Value по мгновенному значению (§3.1) — последняя строка, чей порог пройден. */
export function farmValueBracket(farmValueTotal: number): FarmValueBracketRow {
  let result = FARM_VALUE_BRACKETS[0]!
  for (const row of FARM_VALUE_BRACKETS) {
    if (farmValueTotal >= row.minFarmValue) result = row
    else break
  }
  return result
}
