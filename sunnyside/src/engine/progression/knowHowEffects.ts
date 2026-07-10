/**
 * engine/progression/knowHowEffects.ts — числовые эффекты изученных узлов Know-How
 * (13-progression §3.2.2–3.2.5).
 *
 * Каталог узлов (`data/catalogs/knowHow.ts`) хранит ТОЛЬКО контент (имена, стоимость,
 * время) — числовые эффекты «система прогрессии считает сама» (комментарий каталога).
 * Здесь — карта `nodeKey → вклады в стек модификаторов` для узлов с ЯВНЫМ числом в
 * таблицах §3.2.2–3.2.5. Качественные узлы (unlock тира грядки, «+bonus», Greenhouse,
 * Test Kitchen, гейты слотов маршрута и т.п.) не имеют числового вклада — не выдумываем.
 *
 * Ключи узлов — `kh_<branch>_<slug>` (совпадают с `data/catalogs/knowHow.ts`).
 *
 * ГРАНИЦА: чистые данные, ноль сети/three (модуль НЕ импортирует src/data — карта
 * автономна, чтобы граница engine→types оставалась чистой; сверка ключей — в тестах).
 */

import type { ModifierContribution } from './effects'

/** Числовые эффекты по узлам know-how (§3.2.2–3.2.5). Узлы вне карты — качественные. */
export const KNOW_HOW_NODE_EFFECTS: Readonly<Record<string, readonly ModifierContribution[]>> = {
  // ── Agronomy (§3.2.2) ──
  kh_agronomy_green_thumb: [{ key: 'select_t1_pct', value: 5 }],
  kh_agronomy_quick_sprout: [{ key: 'grow_time_t1_pct', value: -5 }],
  kh_agronomy_crop_rotation: [{ key: 'yield_pct', value: 5 }],
  kh_agronomy_orchard_care: [{ key: 'tree_grow_time_pct', value: -10 }],
  kh_agronomy_prize_seeds: [{ key: 'select_t2_pct', value: 5 }],
  kh_agronomy_bee_friendly: [{ key: 'honey_yield_pct', value: 10 }],
  kh_agronomy_drip_lines: [{ key: 'auto_water_plots', value: 2 }],
  kh_agronomy_soil_science: [{ key: 'yield_pct', value: 10 }],
  kh_agronomy_master_gardener: [{ key: 'select_global_pct', value: 5 }],
  kh_agronomy_agronomy_mastery: [{ key: 'select_global_pct', value: 5 }],

  // ── Cookery (§3.2.3) ──
  kh_cookery_mise_en_place: [{ key: 'cooking_time_pct', value: -5 }],
  kh_cookery_batch_cooking: [{ key: 'machine_batch', value: 1 }],
  kh_cookery_recipe_sense: [{ key: 'mastery_gain_pct', value: 5 }],
  kh_cookery_sharp_knives: [{ key: 'prep_time_pct', value: -5 }],
  kh_cookery_second_oven: [{ key: 'kitchen_machine_slot', value: 1 }],
  kh_cookery_sauce_base: [{ key: 'dish_value_pct', value: 5 }],
  kh_cookery_pastry_arts: [{ key: 'pastry_mastery_star', value: 1 }],
  kh_cookery_grill_mastery: [{ key: 'grill_batch', value: 1 }],
  kh_cookery_slow_low: [{ key: 'overnight_value_pct', value: 15 }],
  kh_cookery_plating: [{ key: 'tips_pct', value: 5 }],
  kh_cookery_prep_crew: [{ key: 'cooking_time_pct', value: -5 }],
  kh_cookery_cookery_mastery: [
    { key: 'cooking_time_pct', value: -5 },
    { key: 'machine_batch', value: 1 },
  ],

  // ── Commerce (§3.2.4) ──
  kh_commerce_penny_saver: [{ key: 'building_cost_pct', value: -5 }],
  kh_commerce_good_tips: [{ key: 'tips_pct', value: 5 }],
  kh_commerce_grain_bins: [{ key: 'silo_capacity_pct', value: 25 }],
  kh_commerce_cold_storage: [{ key: 'icehouse_capacity_pct', value: 25 }],
  kh_commerce_wholesale: [{ key: 'input_price_pct', value: -10 }],
  kh_commerce_menu_pricing: [{ key: 'menu_price_pct', value: 5 }],
  kh_commerce_bulk_sales: [{ key: 'coop_reward_pct', value: 10 }],
  kh_commerce_bookkeeping: [{ key: 'bucks_income_pct', value: 5 }],
  kh_commerce_premium_combo: [{ key: 'blue_plate_price_pct', value: 10 }],
  kh_commerce_warehouse: [{ key: 'storage_capacity_pct', value: 15 }],
  kh_commerce_bargaining: [{ key: 'mail_price_pct', value: -15 }],
  kh_commerce_commerce_mastery: [{ key: 'bucks_income_pct', value: 5 }],

  // ── Civics (§3.2.5) ──
  kh_civics_convoy: [{ key: 'expedition_time_pct', value: -5 }],
  kh_civics_town_spirit: [{ key: 'appetite_contribution_pct', value: 5 }],
  kh_civics_postal_pull: [{ key: 'mail_delivery_time_pct', value: -20 }],
  kh_civics_volunteer: [{ key: 'town_project_pct', value: 10 }],
  kh_civics_road_crew: [{ key: 'expedition_cost_pct', value: -10 }],
}
