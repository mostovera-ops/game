/**
 * ui/event/format.ts — презентационные хелперы экрана серверного ивента
 * (10-server-event, 19-ui-ux §3.5). Только форматирование уже посчитанных чисел —
 * `meterPct`/`personalFp`/пороги приходят из стора (`state/event.ts`, серверная
 * истина) или из чистых формул `@/engine/event` (предпросмотр, не начисление,
 * AGENTS.md §0.3). Здесь — ноль повторного счёта.
 */

/** Клампит и округляет процент шкалы для отображения (0..999, шкала растёт визуально до 200%). */
export function clampPct(pct: number): number {
  return Math.max(0, Math.round(pct * 10) / 10)
}

/** Остаток времени до финала в компактном виде («6ч 12м», «финал!»). */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'финал!'
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h <= 0) return `${m}м`
  return `${h}ч ${m}м`
}

/** Компактное число FP (10 200 → "10.2k") для узких плашек. */
export function formatFp(fp: number): string {
  const n = Math.round(fp)
  if (Math.abs(n) < 10_000) return n.toLocaleString('ru-RU')
  return `${(n / 1000).toFixed(1)}k`
}
