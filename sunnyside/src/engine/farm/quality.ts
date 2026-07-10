/**
 * engine/farm/quality.ts — P(Select): вероятность отборного урожая, 02-farm §3.6/§4.3.
 *
 * АНТИ-ЧИТ (AGENTS.md §0.3): это ЧИСТАЯ формула-предсказание для UI (тултип грядки,
 * §5 «индикатор накопленного P(Select)») — НЕ источник начисления. Реальное качество
 * урожая приходит из `HarvestRes.items[].quality` (сервер, `BackendAdapter.harvest`);
 * клиент никогда не решает за сервер, что выпало.
 *
 * Формула — аддитивная сумма вкладов, капается сверху (02-farm §3.6, гипотеза-баланс,
 * финализация в 14-economy.md):
 *   P(Select) = base(10%) + care_bonus(≤35%) + fertilizer_bonus(≤20%)
 *             + plot_tier_bonus(≤15%) + agronomy_knowhow_bonus(≤15%)
 *   CAP: P(Select) ≤ 90%
 *
 * ГРАНИЦА: ноль three/react/net.
 */

import { plotTierDef, type PlotTier } from './plotTier'

export const SELECT_CHANCE_BASE = 0.1
export const SELECT_CHANCE_CAP = 0.9

/** Максимальные вклады ухода за цикл (02-farm §3.6/§4.3), сумма ≤ 0.35. */
export const CARE_BONUS_MAX = {
  wateredOnTime: 0.15,
  weededResolved: 0.1,
  crowsShooed: 0.1,
} as const

/** Удобрение качества (Quality Fertilizer, 02-farm §3.7): +20%, не стакается с Growth-типом. */
export const FERTILIZER_QUALITY_BONUS = 0.2

/** Агрономия (`kh_agronomy`) — тиры дерева 2/4/6 дают +5/+10/+15% (02-farm §3.6/§4.3). */
export const AGRONOMY_BONUS_BY_LEVEL: Readonly<Record<2 | 4 | 6, number>> = {
  2: 0.05,
  4: 0.1,
  6: 0.15,
}

export interface SelectChanceInput {
  /** Полив выполнен в окне эффективности (первые 50% таймера) либо авто (Hank/Irrigated). */
  wateredOnTime?: boolean
  /** Сорняк убран в grace-окне (§3.4) — только ручное действие (§3.9). */
  weededResolved?: boolean
  /** Вороны отогнаны в окне реакции (§3.4) — только ручное действие (§3.9). */
  crowsShooed?: boolean
  /** Применено Quality Fertilizer в этом цикле этой грядки (§3.7 — эксклюзивно с Growth). */
  qualityFertilizerApplied?: boolean
  /** Тир грядки (Basic/Tilled/Raised/Irrigated), §3.3. */
  plotTier: PlotTier
  /** Наивысший пройденный тир ветки `kh_agronomy` (0, если нет ни одного из 2/4/6). */
  agronomyLevel?: 0 | 2 | 4 | 6
}

/**
 * Считает предсказанный `P(Select)` для UI. Каждый бонус берётся не более одного
 * раза за цикл (дедуп полива Hank/Irrigated — забота вызывающей стороны, §3.9 ОВ#1:
 * эта функция принимает уже дедуплицированный флаг `wateredOnTime`).
 */
export function selectChance(input: SelectChanceInput): number {
  const care =
    (input.wateredOnTime ? CARE_BONUS_MAX.wateredOnTime : 0) +
    (input.weededResolved ? CARE_BONUS_MAX.weededResolved : 0) +
    (input.crowsShooed ? CARE_BONUS_MAX.crowsShooed : 0)

  const fertilizer = input.qualityFertilizerApplied ? FERTILIZER_QUALITY_BONUS : 0
  const plotBonus = plotTierDef(input.plotTier).selectChanceBonus
  const agronomy = input.agronomyLevel ? AGRONOMY_BONUS_BY_LEVEL[input.agronomyLevel] : 0

  const total = SELECT_CHANCE_BASE + care + fertilizer + plotBonus + agronomy
  return Math.min(SELECT_CHANCE_CAP, total)
}
