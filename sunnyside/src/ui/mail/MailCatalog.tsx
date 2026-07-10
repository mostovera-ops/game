/**
 * ui/mail/MailCatalog.tsx — экран `ui_mail_catalog` (08-mail-foraging §3.1/§3.1.7):
 * недельная витрина Каталога почтой Мисс Винни. 12 позиций плиткой 4×3, бирки категорий,
 * цена штампом, кнопка Order, счётчик «осталось: N/лимит», бейдж Last Call с отсчётом.
 *
 * Витрина детерминирована движком (`catalogAt(serverNow())`) — одна на весь Город/неделю
 * (§3.1.2); клиент НЕ выдумывает состав, лишь рендерит. Заказ — через `MailForagingSystem`
 * (order → applyMutation → reconcile кошелька, AGENTS.md §0.3). «На пути» — отдельная
 * панель `ui_mailbox` (кнопка внизу).
 *
 * ГРАНИЦА: ноль three/net. Время — `serverNow()` стора (§0.4).
 */
import { useMemo } from 'react'
import { useStore } from '@/state'
import { weekNumberOf } from '@/engine/clock'
import { catalogAt, catalogItemOf, WEEKLY_ORDER_LIMIT_BY_CATEGORY, LAST_CALL_WINDOW_MS, MAX_ORDERS_IN_TRANSIT, type CatalogCategory, type MailCatalogItem } from '@/engine/mail-foraging'
import type { Wallet } from '@/types'
import { MAIL, PRINT_SHADOW, CATEGORY_COLOR } from './tokens'
import { priceLabel, countdown } from './format'
import { useMailSystem } from './MailSystemContext'
import { useMailSnapshot, useTick } from './useMail'

const CATEGORY_LABEL: Record<CatalogCategory, { en: string; ru: string }> = {
  rare_seeds: { en: 'Rare Seeds', ru: 'Редкие семена' },
  decor: { en: 'Decor', ru: 'Декор' },
  tools: { en: 'Tools', ru: 'Инструменты' },
}

function canAfford(wallet: Wallet, item: MailCatalogItem): boolean {
  return wallet[item.currency] >= item.price
}

export function MailCatalog() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const serverNow = useStore((s) => s.serverNow)
  const wallet = useStore((s) => s.econ.wallet)
  const openPanel = useStore((s) => s.openPanel)
  const pushToast = useStore((s) => s.pushToast)
  const mail = useMailSystem()
  const { orders, refresh } = useMailSnapshot()
  useTick(true)

  const now = serverNow()
  const catalog = useMemo(() => catalogAt(now), [now])
  const week = weekNumberOf(now)

  // Заказано на этой неделе по категории (in_transit + claimed текущей недели, §3.1.2).
  const usedByCat: Record<CatalogCategory, number> = { rare_seeds: 0, decor: 0, tools: 0 }
  let inTransit = 0
  for (const o of orders) {
    if (o.state === 'in_transit') inTransit++
    if (weekNumberOf(o.orderedAt) !== week) continue
    const cat = catalogItemOf(o.itemKey)?.category
    if (cat) usedByCat[cat]++
  }

  async function order(item: MailCatalogItem) {
    const res = await mail.order(item.key)
    refresh()
    if (res.ok) {
      pushToast({
        id: `mail_order_${Date.now()}`,
        kind: 'success',
        message: ru ? 'Заказ оформлен — Пит уже в пути!' : 'Order placed — Pete’s on the way!',
        createdAt: Date.now(),
        ttlMs: 3200,
      })
    }
    // Отказ (лимит/деньги/кап) — applyMutation уже показал тёплый тост.
  }

  return (
    <section
      data-testid="ui-mail-catalog"
      className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-xl p-4"
      style={{ background: MAIL.card, color: MAIL.ink, boxShadow: PRINT_SHADOW }}
    >
      <header className="flex items-baseline justify-between border-b border-dotted pb-2" style={{ borderColor: MAIL.chrome }}>
        <h2 className="text-lg font-black uppercase tracking-wide">
          {ru ? 'Каталог Винни' : 'Winnie’s Mail Order'}
        </h2>
        <span className="text-xs tabular-nums opacity-70">
          {ru ? 'На этой неделе' : 'This Week’s Finds'}
        </span>
      </header>

      <p className="text-xs tabular-nums opacity-70">
        {ru ? 'Кошелёк' : 'Wallet'}: ${Math.round(wallet.bucks).toLocaleString('en-US')} · ◉ {Math.round(wallet.dimes)}
      </p>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="mail-catalog-grid">
        {catalog.positions.map((pos) => {
          const item = pos.item
          const limit = WEEKLY_ORDER_LIMIT_BY_CATEGORY[item.category]
          const remaining = Math.max(0, limit - usedByCat[item.category])
          const affordable = canAfford(wallet, item)
          const transitFull = inTransit >= MAX_ORDERS_IN_TRANSIT
          const disabled = remaining <= 0 || !affordable || transitFull
          // Last Call: отсчёт показываем только в финальные 48ч недели (§3.1.2).
          const untilEnd = catalog.weekEnd - now
          const showLastCall = pos.lastCall && untilEnd <= LAST_CALL_WINDOW_MS && untilEnd > 0
          return (
            <li
              key={`${pos.slot}_${item.key}`}
              data-testid={`mail-item-${item.key}`}
              className="flex flex-col gap-1.5 rounded-lg border border-dashed p-2.5"
              style={{ borderColor: MAIL.chrome }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: CATEGORY_COLOR[item.category] }}
                  aria-hidden
                />
                <span className="text-[10px] font-bold uppercase tracking-wide opacity-60">
                  {ru ? CATEGORY_LABEL[item.category].ru : CATEGORY_LABEL[item.category].en}
                  {item.tier ? ` · T${item.tier}` : ''}
                </span>
              </div>
              <span className="text-sm font-bold leading-tight">{ru ? item.name.ru : item.name.en}</span>
              {showLastCall && (
                <span
                  data-testid={`mail-lastcall-${item.key}`}
                  className="w-fit rounded px-1.5 py-0.5 text-[10px] font-black uppercase text-white"
                  style={{ background: MAIL.cherry }}
                >
                  {ru ? 'Последний шанс' : 'Last Call'} · {countdown(untilEnd, locale)}
                </span>
              )}
              <div className="mt-auto flex items-center justify-between gap-1 pt-1">
                <span className="text-xs font-black tabular-nums">{priceLabel(item.price, item.currency)}</span>
                <span data-testid={`mail-remaining-${item.key}`} className="text-[10px] tabular-nums opacity-60">
                  {ru ? 'осталось' : 'left'} {remaining}/{limit}
                </span>
              </div>
              <button
                type="button"
                data-testid={`mail-order-${item.key}`}
                disabled={disabled}
                onClick={() => void order(item)}
                className="rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
                style={{ background: MAIL.teal }}
              >
                {remaining <= 0 ? (ru ? 'Лимит' : 'Maxed') : transitFull ? (ru ? 'Ящик полон' : 'Box full') : (ru ? 'Заказать' : 'Order')}
              </button>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        data-testid="mail-open-mailbox"
        onClick={() => openPanel('ui_mailbox')}
        className="mt-1 self-center rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide"
        style={{ background: MAIL.mustard, color: MAIL.board }}
      >
        {ru ? `На пути (${inTransit})` : `On the Way (${inTransit})`}
      </button>
    </section>
  )
}
