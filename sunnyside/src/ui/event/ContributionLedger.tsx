/**
 * ContributionLedger.tsx — V3 Contribution Ledger (`ui_contribution_ledger`,
 * 19-ui-ux §3.5, 10-server-event §3.5/§3.7). Личные вехи вклада → сундуки
 * (Bronze/Silver/Gold/Platinum) + лига по историческому вкладу + прямое
 * пожертвование в котёл (`contrib_donate`, канал донат ценнее продажи, §4.4).
 *
 * ГРАНИЦА (AGENTS.md §0.3): пороги сундуков/лига — ЧИСТЫЕ формулы `@/engine/event`
 * (`chestsUnlocked`/`chestThreshold`/`leagueForScore`), предпросмотр по уже
 * пришедшему `event.personalFp` (серверная истина). Мутация вклада —
 * `EventSystem.contribute` (DI, `EventSystemContext.tsx`); сервер реконструирует
 * фактический FP (§3.13) — здесь только оптимистичный предпросмотр цены/награды.
 *
 * ПРИМЕЧАНИЕ: `league_score` (накопленный за сезон FP, §3.7) ещё не приходит в
 * `EventSnapshot` — серверная агрегация сезона не подключена (v0.4, вне скоупа этой
 * зоны). До появления поля лига показывается базовой `Sprout` (мультипликатор ×1.00),
 * что не меняет корректность порогов Bronze (participation-floor, §3.5) — не
 * выдумываем данные, которых ещё нет.
 */

import { useState } from 'react'
import { useStore } from '@/state'
import type { ProductKey } from '@/types'
import { ingredients } from '@/data/catalogs/ingredients'
import { chestsUnlocked, chestThreshold, dishFp, leagueForScore, type ChestKey } from '@/engine/event'
import { DINER, PRINT_SHADOW } from '../market/tokens'
import { useEventSystem } from './EventSystemContext'
import { formatFp } from './format'

const CHEST_LABEL: Record<ChestKey, { en: string; ru: string }> = {
  chest_bronze: { en: 'Bronze', ru: 'Бронза' },
  chest_silver: { en: 'Silver', ru: 'Серебро' },
  chest_gold: { en: 'Gold', ru: 'Золото' },
  chest_platinum: { en: 'Platinum', ru: 'Платина' },
}
const CHEST_ORDER: ChestKey[] = ['chest_bronze', 'chest_silver', 'chest_gold', 'chest_platinum']

function productName(key: ProductKey, ru: boolean): string {
  const def = ingredients.find((i) => i.key === key)
  return (ru ? def?.name.ru : def?.name.en) ?? key
}
function productTier(key: ProductKey) {
  return ingredients.find((i) => i.key === key)?.tier ?? 1
}

export function ContributionLedger() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const event = useStore((s) => s.event)
  const inventory = useStore((s) => s.inventory)
  const eventSystem = useEventSystem()

  const [pickKey, setPickKey] = useState<ProductKey>('')
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)

  const dishStacks = (inventory?.stacks ?? []).filter((st) => st.itemClass === 'dish' && st.qty > 0)

  if (!event) {
    return (
      <section
        data-testid="ui-contribution-ledger"
        className="pointer-events-auto mx-auto w-full max-w-md rounded-xl p-4"
        style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
      >
        <p data-testid="contribution-ledger-empty" className="py-6 text-center italic opacity-70">
          {ru ? 'Внеси первое блюдо в котёл.' : 'Bring your first dish to the cauldron.'}
        </p>
      </section>
    )
  }

  // Лига-заглушка Sprout до подключения season-агрегата (см. шапку файла).
  const league = leagueForScore(0)
  const unlocked = new Set(chestsUnlocked(event.personalFp, league, event.personalFp > 0))

  const previewTier = pickKey ? productTier(pickKey) : 1
  const previewFp = pickKey ? dishFp({ tier: previewTier, stars: 0, channel: 'donate' }) * qty : 0

  async function handleDonate() {
    if (!pickKey || qty <= 0) return
    setBusy(true)
    try {
      const res = await eventSystem.contribute(pickKey, qty, 'donate')
      if (res.ok) {
        setPickKey('')
        setQty(1)
      } else {
        useStore.getState().pushToast({
          id: `event_donate_err_${Date.now()}`,
          kind: 'warn',
          message: ru ? `Не получилось: ${res.error.message}` : `Couldn’t donate: ${res.error.message}`,
          createdAt: Date.now(),
          ttlMs: 6000,
        })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      data-testid="ui-contribution-ledger"
      className="pointer-events-auto mx-auto flex w-full max-w-md flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <header className="flex items-center justify-between border-b border-dotted pb-2" style={{ borderColor: DINER.chrome }}>
        <h2 className="text-lg font-black uppercase tracking-wide">
          {ru ? 'Вклад · вехи и сундуки' : 'Contribution · milestones & chests'}
        </h2>
        <span data-testid="event-league-badge" className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ background: DINER.teal }}>
          {ru ? 'Лига' : 'League'}: {league.key}
        </span>
      </header>

      <div className="tabular-nums text-sm">
        {ru ? 'Твой FP за уикенд' : 'Your FP this weekend'}:{' '}
        <span data-testid="contribution-personal-fp" className="font-bold">
          {formatFp(event.personalFp)}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5" data-testid="chest-ladder">
        {CHEST_ORDER.map((chest) => {
          const threshold = chestThreshold(chest, league)
          const got = unlocked.has(chest)
          return (
            <li
              key={chest}
              data-testid={`chest-row-${chest}`}
              className="flex items-center justify-between rounded border border-dashed px-2 py-1 text-sm"
              style={{ borderColor: DINER.chrome, opacity: got ? 1 : 0.6 }}
            >
              <span>
                {got ? '✓ ' : ''}
                {ru ? CHEST_LABEL[chest].ru : CHEST_LABEL[chest].en}
              </span>
              <span className="tabular-nums opacity-70">{formatFp(threshold)} FP</span>
            </li>
          )
        })}
      </ul>

      <div className="rounded-lg border border-dashed p-3" style={{ borderColor: DINER.chrome }}>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: DINER.mustard }}>
          {ru ? 'Внести в котёл (донат)' : 'Donate to the cauldron'}
        </h3>
        {dishStacks.length === 0 ? (
          <p className="text-sm italic opacity-60">
            {ru ? 'Нет готовых блюд на складе.' : 'No finished dishes in storage.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <select
              data-testid="event-donate-pick-item"
              value={pickKey}
              onChange={(e) => setPickKey(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
              style={{ borderColor: DINER.chrome }}
            >
              <option value="">{ru ? 'Выбери блюдо…' : 'Pick a dish…'}</option>
              {dishStacks.map((st) => (
                <option key={st.key} value={st.key}>
                  {productName(st.key, ru)} ({ru ? 'сток' : 'stock'} {st.qty})
                </option>
              ))}
            </select>
            {pickKey && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  {ru ? 'Кол-во' : 'Qty'}
                  <input
                    data-testid="event-donate-qty"
                    type="number"
                    min={1}
                    max={dishStacks.find((s) => s.key === pickKey)?.qty ?? 1}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 rounded border px-2 py-1"
                    style={{ borderColor: DINER.chrome }}
                  />
                </label>
                <p data-testid="event-donate-preview" className="tabular-nums text-xs opacity-70">
                  {ru ? 'Примерно' : 'About'} +{formatFp(previewFp)} FP
                </p>
              </>
            )}
            <button
              type="button"
              data-testid="event-donate-btn"
              disabled={!pickKey || busy}
              onClick={() => void handleDonate()}
              className="self-start rounded-lg px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-40"
              style={{ background: DINER.cherry }}
            >
              {ru ? 'Внести' : 'Donate'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
