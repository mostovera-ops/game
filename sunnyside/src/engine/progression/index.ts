/**
 * engine/progression/index.ts — публичный барьер системы «Прогрессия» (13-progression.md).
 *
 * Скоуп владения (AGENTS.md §2, задача агента «Progression»):
 *  - XP-кривая уровня фермы 1–60 (§3.5.1) — `xp.ts`;
 *  - МАСТЕР-формула Farm Value + веса осей, кап 15% косметики делегируется econ (§3.4.1) —
 *    `farmValue.ts`;
 *  - агрегатор модификаторов для соседних систем: навыки стаффа (§3.1.1/§3.1.2),
 *    синергии сетов (§3.1.5), эффекты узлов Know-How (§3.2.2–3.2.5) — `modifiers.ts`
 *    (+ данные `staffSkills.ts`/`synergy.ts`/`knowHowEffects.ts`);
 *  - реализация `ProgressionSystem` из `engine/contracts.ts` — `system.ts`.
 *
 * ВНЕ скоупа этого модуля (соседние системы/контент):
 *  - кап 15% косметики Farm Value → `engine/econ` (`EconSystem.farmValue`), переиспользуется;
 *  - контент-каталоги (имена/стоимости/время стаффа, know-how, построек) →
 *    `data/catalogs/{staff,knowHow,buildings}.ts` (контент-агент);
 *  - `animal_fv` (03-animals) и mastery★ (04-machines) — приходят как входы Farm Value,
 *    не считаются здесь.
 *
 * ГРАНИЦА: чистая логика, ноль three/react/net (AGENTS.md §0.2). Импортирует `@/types`
 * и `@/engine/econ` (кап FV) — оба внутри `engine`.
 */

// ── Константы (числа из спеки 13-progression §3.4/§3.5/§4) ──
export {
  FARM_LEVEL_CAP,
  XP_CURVE_BASE,
  XP_CURVE_EXPONENT,
  STAFF_MAX_LEVEL,
  STAFF_LEVEL_MULTIPLIERS,
  STAFF_UPGRADE_TOKEN_COST,
  STAFF_POST,
  BUILDING_FV_EXPONENT,
  BUILDING_FV_WEIGHTS,
  STAFF_FV_PER_LEVEL,
  KNOW_HOW_FV_PER_NODE,
  FIELD_PLOT_FV,
  ORCHARD_PLOT_FV,
  RECIPE_STAR_FV,
  TOY_FV,
  RIBBON_FV,
  POSTCARD_FV,
  DECOR_FV_PER_SCORE,
} from './constants'

// ── XP-кривая 1–60 ──
export { xpToNext, cumulativeXp, levelForXp } from './xp'
export type { LevelProgress } from './xp'

// ── Farm Value (мастер-формула + веса) ──
export {
  farmValue,
  farmValueAxes,
  buildingsAxis,
  productionAxis,
  collectionsAxis,
  cosmeticsAxis,
} from './farmValue'
export type { FarmValueInput } from './farmValue'

// ── Модификаторы (агрегатор для соседних систем) ──
export { aggregateModifiers, getModifier, isStaffActive } from './modifiers'
export type { ModifierState, StaffAssignment, ProgressionModifiers } from './modifiers'
export type { ModifierKey, ModifierBag, ModifierContribution } from './effects'

// ── Данные/хелперы стаффа, синергий, know-how ──
export {
  staffLevelMultiplier,
  staffUpgradeCost,
  staffUpgradeCostCumulative,
  effectiveStaffSkill,
  STAFF_BASE_SKILL,
} from './staffSkills'
export type { StaffBaseSkill } from './staffSkills'
export {
  SYNERGIES,
  isSynergyActive,
  activeSynergies,
} from './synergy'
export type { SynergyId, SynergyDef } from './synergy'
export { KNOW_HOW_NODE_EFFECTS } from './knowHowEffects'

// ── Фабрика системы (контракт ProgressionSystem) ──
export { createProgressionSystem } from './system'
