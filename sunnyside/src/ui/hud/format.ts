/**
 * format.ts — чистые презентационные форматтеры HUD. НИКАКИХ игровых расчётов
 * (AGENTS.md §0.3) — только представление уже готовых чисел/времени.
 */

/** `12480` → `12,480`; используется вместе с `.tabular-nums` (index.css). */
export function formatAmount(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

/** Остаток времени → `H:MM:SS` / `M:SS`. Отрицательное/NaN → `0:00` (готово). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}
