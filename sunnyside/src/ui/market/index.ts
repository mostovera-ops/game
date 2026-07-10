/**
 * ui/market/index.ts — барель зоны «ui-market-orders» / market (AGENTS.md §2).
 * Доска спроса недели (W6) + прилавок ярмарки (R2, 09-fair §прилавок, 19-ui-ux §3.4/§3.6).
 * Композиция (App.tsx/бутстрап) оборачивает дерево `FairStall` в `<FairSystemProvider>`
 * с реальным `FairSystem` (см. `FairSystemContext.tsx` — почему через контекст).
 */

export { DemandBoardScreen } from './DemandBoard'
export { FairStall } from './FairStall'
export { FairSystemProvider, useFairSystem } from './FairSystemContext'
export * from './format'
export { DINER, PRINT_SHADOW } from './tokens'
