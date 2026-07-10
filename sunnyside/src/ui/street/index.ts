/**
 * ui/street/index.ts — барель зоны «ui-event-street» / street (AGENTS.md §2).
 * Панель стрита (W2, участники/помощь-лимиты/вымпел) + профиль соседа (F8),
 * 19-ui-ux §3.2/§3.6, 11-town. Композиция оборачивает дерево в
 * `<SocialSystemProvider>` с реальным `SocialSystem`.
 */

export { StreetPanel } from './StreetPanel'
export { NeighborProfile } from './NeighborProfile'
export { SocialSystemProvider, useSocialSystem } from './SocialSystemContext'
export * from './format'
