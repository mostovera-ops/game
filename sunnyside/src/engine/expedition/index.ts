/**
 * engine/expedition — роуд-трип грузовика (docs/specs/07-expeditions.md).
 *
 * СОСТАВ:
 *   • constants   — каноничные/гипотеза-числа спеки (тайминги, апгрейды, Send Cost, события).
 *   • catalog     — lookup над `@/data/catalogs/{states,postcards}`.
 *   • duration    — формула длительности рейса (§4.1).
 *   • upgrades    — таблицы Speed/Capacity/Route Slots (§3.4).
 *   • sendCost    — Send Cost + ◉-ускорение (§3.5).
 *   • roadEvents  — дорожные события в пути, только позитив (§3.8/§4.4, P3).
 *   • lootTable   — лут-таблицы по штатам T3–T5 (§4.2).
 *   • loot        — детерминированный ролл лута рейса (§4.2/§4.3).
 *   • postcard    — правила открыток/дубликат-конвертации (§3.3/§3.7).
 *   • regionSet   — регионы открыток + бонус времени (§3.7/§4.1, O5).
 *   • system      — фабрика `ExpeditionSystem` (expedition_start/collect через adapter).
 *
 * Импорт: `import { createExpeditionSystem, rollExpeditionLoot } from '@/engine/expedition'`.
 *
 * ГРАНИЦА (AGENTS.md §3): ЧИСТАЯ логика — ноль three/react/net/state. Node-тестируемо.
 * АНТИ-ЧИТ (§0.3): формулы/роллы здесь — предсказание для UI и тесты распределения;
 * истину лута/таймеров реконструирует сервер (`expedition_start`/`expedition_collect`).
 */
export * from './constants'
export * from './catalog'
export * from './duration'
export * from './upgrades'
export * from './sendCost'
export * from './roadEvents'
export * from './lootTable'
export * from './loot'
export * from './postcard'
export * from './regionSet'
export { createExpeditionSystem } from './system'
