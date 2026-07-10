/**
 * engine/event — серверный уикенд-ивент (10-server-event, canon §3.5).
 *
 * СОСТАВ:
 *   • constants   — каноничные числа спеки (BFP, множители, пороги лиг/сундуков/вымпелов).
 *   • conversion  — блюдо → Fill Points (§3.3, §4.1–4.4) + тикеты за донат.
 *   • milestones  — Goal_100 автоскейл от DAU + детект пересечения вех (§3.4/§3.15).
 *   • grimsby     — тема Glutton: фазы-капризы, Grand Craving, Clean Plate (§3.9).
 *   • themes      — Festival (палатки/баланс), Drive-in (evening), Harvest (combo) + диспетчер M_theme.
 *   • freshness   — анти-флуд F(category) (§3.14, канон E7).
 *   • leagues     — лиги по историческому вкладу + личные сундуки (§3.5/§3.7).
 *   • pennant     — вклад стрита → вымпел per-capita (§3.6).
 *   • versus      — State Fair Showdown per-capita скоринг (§3.12).
 *   • system      — фабрика EventSystem (event_contribute через adapter, §3.2).
 *
 * Импорт: `import { createEventSystem, dishFp, goal100 } from '@/engine/event'`.
 *
 * ГРАНИЦА (AGENTS.md §3): ЧИСТАЯ логика — ноль three/react/net/state. Node-тестируемо.
 * АНТИ-ЧИТ (§0.3): формулы — предсказание для UI, НИКОГДА не источник начисления;
 * истину меры/наград реконструирует сервер (§3.13).
 */

export * from './constants'
export * from './conversion'
export * from './milestones'
export * from './grimsby'
export * from './themes'
export * from './freshness'
export * from './leagues'
export * from './pennant'
export * from './versus'
export { createEventSystem } from './system'
