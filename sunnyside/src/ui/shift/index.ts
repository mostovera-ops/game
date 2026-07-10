/**
 * ui/shift — активная смена у прилавка (09-fair §3.4–§3.6). Публичный барель зоны.
 *
 * Экспортирует хост-компонент (`ShiftHost` — гейт/старт/чек, монтируется сценой ярмарки),
 * экран мини-игры (`ShiftScreen`), чек (`Receipt`), чистый презентер (`session`) и пул блюд.
 * ГРАНИЦА (AGENTS.md §3): ui/ — DOM, ноль three/net.
 */

export { ShiftHost } from './ShiftHost'
export { ShiftScreen, type ShiftResult, type ShiftScreenProps } from './ShiftScreen'
export { Receipt, type ReceiptProps } from './Receipt'
export { NOOP_SHIFT_SYSTEM } from './shiftSystemFallback'
export * from './session'
export * from './pool'
