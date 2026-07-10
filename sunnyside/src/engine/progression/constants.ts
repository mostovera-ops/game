/**
 * engine/progression/constants.ts — числовые константы прогрессии (13-progression §3.4/§3.5/§4).
 *
 * ВСЕ числа — ИЗ СПЕКИ 13-progression (помечены там как «гипотеза» до калибровки в
 * 14-economy.md). Ничего не выдумано: ссылки на параграфы в комментариях.
 *
 * ГРАНИЦА: чистые данные, ноль сети/three/react (AGENTS.md §0.2).
 */

import type { BuildingKey, StaffPost } from '@/types'
import type { StaffKey } from '@/types'

// ── Farm Level / XP (§3.5.1, §4.6) ────────────────────────────────────────────

/** Кап уровня фермы на MVP (§3.5.1: «Farm Level 60 — кап на MVP»). */
export const FARM_LEVEL_CAP = 60

/** Множитель XP-кривой: XP_to_next(L) = round(80 × L^1.8) (§3.5.1/§4.6). */
export const XP_CURVE_BASE = 80
/** Показатель XP-кривой (§3.5.1): плавное замедление без «стены». */
export const XP_CURVE_EXPONENT = 1.8

// ── Стафф (§3.1.2, §4.1) ──────────────────────────────────────────────────────

/** 5 уровней на персонажа (§3.1.2). */
export const STAFF_MAX_LEVEL = 5

/**
 * Множитель к величине базового навыка по уровню (§3.1.2/§4.1):
 * Ур.1 ×1.00 · Ур.2 ×1.25 · Ур.3 ×1.50 · Ур.4 ×1.75 · Ур.5 ×2.00.
 * Индекс = level−1. Линейно: 1 + 0.25·(level−1).
 */
export const STAFF_LEVEL_MULTIPLIERS: readonly number[] = [1.0, 1.25, 1.5, 1.75, 2.0]

/**
 * Стоимость апгрейда стаффа в его жетонах ЗА переход НА уровень L (§4.1):
 * →2: 10 · →3: 25 · →4: 60 · →5: 140 (кумулятивно 10/35/95/235).
 * Ключ = целевой уровень.
 */
export const STAFF_UPGRADE_TOKEN_COST: Readonly<Record<number, number>> = {
  2: 10,
  3: 25,
  4: 60,
  5: 140,
}

/** Канонический пост каждого персонажа (§3.1.1, таблица ростера). */
export const STAFF_POST: Readonly<Record<StaffKey, StaffPost>> = {
  staff_bruno: 'Kitchen',
  staff_rosalind: 'Kitchen',
  staff_marty: 'Kitchen',
  staff_peggy: 'Counter',
  staff_dizzy: 'Counter',
  staff_lorraine: 'Counter',
  staff_hank: 'Field',
  staff_clara: 'Field',
  staff_ada: 'Yard',
  staff_gus: 'Yard',
  staff_buck: 'Yard',
  staff_vernon: 'Yard',
}

// ── Farm Value веса (§3.4.1 / §4.5) ───────────────────────────────────────────

/** Экспонента вклада постройки: level^1.5 × W_bld (§3.4.1/§4.5). */
export const BUILDING_FV_EXPONENT = 1.5

/**
 * Веса построек W_bld (§3.4.1/§4.5): House 120 · Diner 100 · Kitchen 100 ·
 * Garage 80 · Barn 70 · Coop 50 · Silo 40 · Icehouse 40.
 *
 * `bld_apiary` (9-я постройка) — веса В СПЕКЕ НЕТ (§3.4.1 даёт W_bld только для 8
 * из 9 построек). Не выдумываем: apiary отсутствует в карте → вклад 0 (ожидает
 * калибровки в 14-economy / PR к канону). Partial-тип фиксирует это на уровне типов.
 */
export const BUILDING_FV_WEIGHTS: Readonly<Partial<Record<BuildingKey, number>>> = {
  bld_house: 120,
  bld_diner: 100,
  bld_kitchen: 100,
  bld_garage: 80,
  bld_barn: 70,
  bld_coop: 50,
  bld_silo: 40,
  bld_icehouse: 40,
}

/** Вес одного уровня стаффа в Farm Value: staff_level × 40 (§3.4.1/§4.5). */
export const STAFF_FV_PER_LEVEL = 40
/** Вес одного изученного узла Know-How: × 60 (§3.4.1/§4.5). */
export const KNOW_HOW_FV_PER_NODE = 60
/** Вес одной грядки поля: × 15 (§3.4.1/§4.5). */
export const FIELD_PLOT_FV = 15
/** Вес одной грядки сада: × 25 (§3.4.1/§4.5). */
export const ORCHARD_PLOT_FV = 25
/** Вес одной звезды mastery рецепта: × 10 (§3.4.1/§4.5). */
export const RECIPE_STAR_FV = 10

/** Вес одной игрушки (в cosmetic_fv): × 20 (§3.4.1/§4.5). */
export const TOY_FV = 20
/** Вес одной ленты (в cosmetic_fv): × 100 (§3.4.1/§4.5). */
export const RIBBON_FV = 100
/** Вес одной открытки (в cosmetic_fv): × 15 (§3.4.1/§4.5). */
export const POSTCARD_FV = 15
/** Вес балла декора (в cosmetic_fv): × 5 (§3.4.1/§4.5). */
export const DECOR_FV_PER_SCORE = 5
