/**
 * engine/craft/overtime.ts — `mech_overtime` (04-machines.md §3.8/§4.5): за Даймы станок
 * получает +1 временный слот очереди на 24ч. Дневной кэп — 3 активации/сутки на игрока,
 * суммарно по ВСЕМ станкам (значение-мастер `14-economy.md` §4.7, входит в общий пул
 * бустов 6/день). Овертайм НЕ ускоряет уже стоящую партию — только даёт слот постановки
 * (§3.8). Чистая логика — таймеры/кэп/цена, ноль сети/стейта (кэп/счётчик — забота
 * вызывающего слайса, здесь только предикаты).
 */
import type { EpochMs } from '@/types'
import { canActivatePoolBoost } from '@/engine/econ/boostCaps'

/** Длительность овертайм-слота — 24 часа (§3.8/§4.5). */
export const OVERTIME_DURATION_MS = 24 * 60 * 60 * 1000

/**
 * Дневной кэп активаций овертайма (=3), суммарно по станкам. Мастер-число — в
 * `@/engine/econ/boostCaps` (14-economy §4.7); здесь только ре-экспорт, локальной копии нет.
 */
export { OVERTIME_DAILY_CAP } from '@/engine/econ/boostCaps'

/** Стоимость активации овертайма в Даймах `◉` по уровню станка (§4.5). */
export function overtimeCost(machineLevel: number): number {
  if (machineLevel >= 5) return 40
  if (machineLevel >= 3) return 25
  return 15
}

export interface OvertimeSlot {
  /** serverNow() на момент покупки овертайма — таймер строго дедлайн, не отсчёт (21-client §3.6). */
  activatedAt: EpochMs
}

/** Овертайм-слот всё ещё даёт +1 к ёмкости очереди (в пределах 24ч от активации). */
export function isOvertimeActive(slot: OvertimeSlot | undefined, now: EpochMs): boolean {
  if (!slot) return false
  return now - slot.activatedAt < OVERTIME_DURATION_MS
}

/**
 * Момент истечения овертайм-слота (для UI-предупреждения «за 2ч до истечения», M4/§5).
 */
export function overtimeExpiresAt(slot: OvertimeSlot): EpochMs {
  return slot.activatedAt + OVERTIME_DURATION_MS
}

/**
 * Можно ли купить ещё овертайм сегодня. Проверяет И штучный кэп овертайма (3/сутки), И
 * общий пул бустеров (6/день, §4.7) — делегирует мастер-предикату `canActivatePoolBoost`.
 * @param overtimesToday — активаций овертайма уже сегодня.
 * @param poolUsedToday — активаций из общего пула бустеров уже сегодня (fertilizer+overtime+rush).
 */
export function canActivateOvertime(overtimesToday: number, poolUsedToday: number): boolean {
  return canActivatePoolBoost('overtime', overtimesToday, poolUsedToday)
}
