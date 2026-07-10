/**
 * ui/shop/format.ts — презентационные форматтеры экранов монетизации. Только
 * представление уже готовых чисел (каталог/wallet) — НИКАКИХ расчётов (AGENTS.md §0.3).
 */

/** `◉ 1,488` — цена в даймах, tabular-friendly группировка разрядов. */
export function dimes(amount: number): string {
  return `◉ ${Math.round(amount).toLocaleString('en-US')}`
}

/** `$9.99` — реал-цена (только для витрины пакетов Dimes, §9). */
export function usd(amount: number): string {
  return `$${amount.toFixed(2)}`
}

/** Скидка в процентах между «ценой врозь» и «ценой набора» (Full-Set/бандлы), округлённо вниз. */
export function discountPct(apart: number, bundled: number): number {
  if (apart <= 0) return 0
  return Math.round((1 - bundled / apart) * 100)
}

/** `YYYY-MM-DD` (UTC) от EpochMs — ключ дня для витринных «сегодня осталось N/K» счётчиков. */
export function dayKeyOf(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10)
}
