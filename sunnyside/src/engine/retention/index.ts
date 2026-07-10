/**
 * engine/retention — система удержания (16-retention.md): генератор Daily Specials
 * (ротация фокуса, Sheriff Roy), Regular Streak («Завсегдатай» — заморозка/страховка/
 * бонусная шкала), Gone Fishin' (Vacation Mode) + Neighbor Sitter.
 *
 * Публичный барель зоны `engine/retention/` (AGENTS.md §2). Экспортирует:
 *   - мастер-числа спеки (`constants`);
 *   - генератор Daily Specials (`generator`) — ЧИСТАЯ функция, не ходит в adapter;
 *   - конечный автомат стрика (`streak`) — ЧИСТАЯ логика переходов/таблиц;
 *   - валидацию Vacation Mode + Neighbor Sitter (`vacation`);
 *   - фабрику `createRetentionSystem` (реализует сетевую поверхность из
 *     `engine/contracts.ts` — сигнатуры `streakCheck`/`streakInsure` из
 *     `ProgressionSystem`, `vacationStart`/`vacationEnd` из `BackendAdapter`).
 *
 * Импорт: `import { createRetentionSystem, generateDailySpecials, streakBonusPct } from '@/engine/retention'`.
 * ГРАНИЦА: ноль three/react/net/store — чистая логика (кроме `system.ts`, который
 * зовёт `SystemContext.applyMutation`, как и остальные системы — тот же паттерн,
 * что `engine/collections/system.ts`).
 */

export * from './constants'
export * from './generator'
export * from './streak'
export * from './vacation'
export { createRetentionSystem, type RetentionSystem } from './system'
