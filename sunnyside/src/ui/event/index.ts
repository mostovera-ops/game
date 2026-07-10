/**
 * ui/event/index.ts — барель зоны «ui-event-street» / event (AGENTS.md §2).
 * Appetite Meter (V1) + Grimsby Phase Banner (V2) + Contribution Ledger (V3),
 * 19-ui-ux §3.5, 10-server-event. Композиция оборачивает дерево в
 * `<EventSystemProvider>` с реальным `EventSystem`.
 */

export { AppetiteMeter } from './AppetiteMeter'
export { GrimsbyBanner } from './GrimsbyBanner'
export { ContributionLedger } from './ContributionLedger'
export { EventSystemProvider, useEventSystem } from './EventSystemContext'
export * from './format'
