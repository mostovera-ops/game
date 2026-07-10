/**
 * ui/migration/index.ts — барель зоны «ui-migration» (AGENTS.md §2): переезды
 * (12-migration) — Moving Van, Town Browser, Street Caravan, Town Merge, Grand Reopening.
 * Композиция оборачивает дерево в `<TownSystemProvider>` с реальным `TownSystem`.
 */

export { MovingVan } from './MovingVan'
export { TownBrowser } from './TownBrowser'
export { CaravanVote } from './CaravanVote'
export { TownMergeBanner } from './TownMergeBanner'
export { GrandReopeningBanner } from './GrandReopeningBanner'
export { ContributionReceipt } from './ContributionReceipt'
export { TownSystemProvider, useTownSystem } from './TownSystemContext'
export { useTownListings } from './useTownListings'
export * from './format'
