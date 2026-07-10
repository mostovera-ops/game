/**
 * engine/craft — станки кухни: очереди, апгрейд-кривая, цепочки полуфабрикатов, овертайм
 * (docs/specs/04-machines.md). ЧИСТАЯ логика (AGENTS.md §3): ноль three/react/net.
 * Реализует `CraftSystem` (engine/contracts.ts); данные — `@/data/catalogs/{machines,recipes}`.
 *
 * Использование: `import { createCraftSystem } from '@/engine/craft'`.
 */
export * from './levels'
export * from './catalog'
export * from './chain'
export * from './overtime'
export * from './system'
