/**
 * ui/orders/format.ts — презентационные хелперы для доски кооп-заказов и potluck-стола
 * (11-town §кооп/потлак, 19-ui-ux §3.6 W5/W4). Только форматирование готовых чисел —
 * дедлайны и вклад приходят из `state/coop.ts` (серверная истина), здесь их не считаем.
 */

/** Остаток времени до дедлайна в компактном RU-виде («2ч 15м», «истёк»). Вход — уже
 * посчитанная разница мс (обычно `deadlineAt - serverNow()`), не Date.now() напрямую. */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'истёк'
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h <= 0) return `${m}м`
  return `${h}ч ${m}м`
}

/** Прогресс требования заказа в процентах, клампленный [0,100]. */
export function reqProgressPct(filled: number, qty: number): number {
  if (qty <= 0) return 100
  return Math.min(100, Math.max(0, Math.round((100 * filled) / qty)))
}
