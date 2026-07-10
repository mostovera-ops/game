/**
 * engine/fair — система Ярмарки (09-fair): пассивный прилавок, активная смена, конкурсы.
 *
 * Публичный барель зоны `engine/fair/` (AGENTS.md §2). Экспортирует:
 *   - фабрики систем (реализуют contracts.ts): createFairSystem / createShiftSystem /
 *     createContestSystem;
 *   - ЧИСТЫЕ формулы (предсказание для UI, не источник начисления): продажи прилавка
 *     (`sales`), скоринг смены (`scoring`), конкурсы (`contest`), детерминированная
 *     очередь смены (`simulation`);
 *   - мастер-числа спеки (`constants`).
 *
 * Импорт: `import { createFairSystem, sellRate, scoreShift } from '@/engine/fair'`.
 * ГРАНИЦА: ноль three/react/net/store — чистая логика, node-тестируемо.
 */

export * from './constants'
export * from './sales'
export * from './scoring'
export * from './contest'
export * from './simulation'
export {
  createFairSystem,
  createShiftSystem,
  createContestSystem,
  shiftDurationSec,
  sessionPhase,
  type ShiftSession,
  type ShiftSystemExt,
  type ShiftStartOpts,
} from './system'
