/**
 * engine/progression/effects.ts — словарь числовых каналов эффектов (ModifierKey) и
 * общая форма вклада модификатора. Общий тип для источников (стафф / синергии / know-how)
 * и агрегатора (modifiers.ts) — вынесен отдельно, чтобы избежать циклов импорта.
 *
 * ГРАНИЦА: чистые типы/данные, ноль сети/three.
 *
 * Числа-каналы соответствуют ЯВНО заданным процентам/флэтам в спеке 13-progression
 * (§3.1.1 навыки стаффа, §3.1.5 синергии, §3.2.2–3.2.5 узлы know-how). Качественные
 * эффекты («unlock», «+guests», «+bonus» без числа) НЕ моделируются числом (не выдумываем).
 */

/**
 * Канал эффекта — цель, на которую складываются проценты/флэты из всех источников.
 * `*_pct` — процентная дельта (знак = направление: −время быстрее, +ценность выше);
 * прочие — флэтовые единицы (грядки авто-полива, размер партии, звёзды mastery).
 */
export type ModifierKey =
  // кухня / рецепты
  | 'cooking_time_pct'
  | 'prep_time_pct'
  | 'dish_value_pct'
  | 'mastery_gain_pct'
  | 'pastry_mastery_star'
  | 'grill_batch'
  | 'machine_batch'
  | 'overnight_value_pct'
  | 'blue_plate_price_pct'
  | 'menu_price_pct'
  | 'dish_bucks_pct'
  | 'kitchen_machine_slot'
  // прилавок / доход
  | 'tips_pct'
  | 'shake_soda_value_pct'
  | 'drive_in_value_pct'
  | 'bucks_income_pct'
  | 'coop_reward_pct'
  // ферма / грядки / сад
  | 'yield_pct'
  | 'select_t1_pct'
  | 'select_t2_pct'
  | 'select_global_pct'
  | 'grow_time_t1_pct'
  | 'tree_grow_time_pct'
  | 'honey_yield_pct'
  | 'auto_water_plots'
  | 'farm_cycle_pct'
  | 'animal_cycle_pct'
  // склад
  | 'silo_capacity_pct'
  | 'icehouse_capacity_pct'
  | 'storage_capacity_pct'
  // стройка / экономика закупок
  | 'building_cost_pct'
  | 'machine_build_time_pct'
  | 'input_price_pct'
  | 'mail_price_pct'
  // экспедиции / civics
  | 'expedition_time_pct'
  | 'expedition_cost_pct'
  | 'expedition_fuel_pct'
  | 'town_project_pct'
  | 'appetite_contribution_pct'
  | 'mail_delivery_time_pct'

/** Один вклад в канал эффекта. */
export interface ModifierContribution {
  key: ModifierKey
  value: number
}

/** Сумма дельт по каналам (может отсутствовать ключ = 0). */
export type ModifierBag = Partial<Record<ModifierKey, number>>
