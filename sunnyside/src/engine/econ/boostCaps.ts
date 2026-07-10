/**
 * engine/econ/boostCaps.ts — мастер-таблица дневных кэпов бустеров (14-economy §4.7,
 * R5, DECISIONS-B «09/02/04-кэпы»). Единственный источник истины для чисел; профильные
 * модули (`02-farm` Fertilizer, `04-machines` Overtime, `07-expeditions` Rush) ссылаются
 * сюда вместо локальных цифр (см. §4.7: «эта спека даёт мастер-таблицу»).
 *
 * Правило пула (R5): суммарно бустеры из пула — жёсткий верх `BOOST_POOL_DAILY_CAP`
 * (6/день). Штучные кэпы (Fertilizer 4, Overtime 3, Rush 1) — под-лимиты, которые НЕ
 * могут превысить пул (4+3=7 > 6 → срабатывает потолок пула). Instant-skip таймеров
 * (§3.8) — вне пула (продажа времени, не дохода), здесь не учитывается.
 *
 * ГРАНИЦА: чистые данные + функции, ноль сети/three.
 */

/** Жёсткий верх суммарных активаций бустеров ИЗ ПУЛА в сутки на игрока (§4.7). */
export const BOOST_POOL_DAILY_CAP = 6

/** Штучный кэп/день: Fertilizer (только `$`, `◉` запрещён — R6, `02-farm.md §3.7`). */
export const FERTILIZER_DAILY_CAP = 4
/** Штучный кэп/день: Overtime станка (`◉` или `$`, `04-machines.md §3.8/§4.5`). */
export const OVERTIME_DAILY_CAP = 3
/** Штучный кэп/день: Rush/Truck Contract экспедиции (`◉`, `07-expeditions.md`). */
export const RUSH_DAILY_CAP = 1

/** Бустеры, которые расходуют общий пул (§4.7). Instant-skip таймеров — вне пула. */
export type PooledBooster = 'fertilizer' | 'overtime' | 'rush'

/** Штучный дневной кэп конкретного пул-бустера. */
export function poolBoosterDailyCap(kind: PooledBooster): number {
  switch (kind) {
    case 'fertilizer':
      return FERTILIZER_DAILY_CAP
    case 'overtime':
      return OVERTIME_DAILY_CAP
    case 'rush':
      return RUSH_DAILY_CAP
  }
}

/** Сколько ещё активаций из общего пула доступно сегодня (никогда не отрицательно). */
export function boostPoolRemaining(usedInPoolToday: number): number {
  return Math.max(0, BOOST_POOL_DAILY_CAP - Math.max(0, usedInPoolToday))
}

/**
 * Можно ли активировать ещё один пул-бустер данного вида сегодня (§4.7): и штучный
 * кэп конкретного бустера, и общий пул должны иметь запас (пул — жёсткий верх, R5).
 */
export function canActivatePoolBoost(
  kind: PooledBooster,
  usedOfKindToday: number,
  usedInPoolToday: number,
): boolean {
  return usedOfKindToday < poolBoosterDailyCap(kind) && usedInPoolToday < BOOST_POOL_DAILY_CAP
}
