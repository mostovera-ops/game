/**
 * Potluck.tsx — potluck-стол стрита (ui_potluck, 19-ui-ux §3.6 W4, 11-town §потлак).
 * Общий стол перед ярмаркой: приноси блюдо → бафф стриту на субботу.
 *
 * Читает `coop.potluck` (истина серверная). Мутация (`potluck_contribute`) — через
 * `CoopSystem.potluck` (DI-контекст, см. `CoopSystemContext.tsx`); ui/ не ходит в
 * @/net (AGENTS.md §3) — проводку делает вызывающий/бутстрап.
 */

import { useState } from 'react'
import { useStore } from '@/state'
import type { ProductKey } from '@/types'
import { ingredients } from '@/data/catalogs/ingredients'
import { money } from '../market/format'
import { DINER, PRINT_SHADOW } from '../market/tokens'
import { useCoopSystem } from './CoopSystemContext'

function productName(key: ProductKey, ru: boolean): string {
  const def = ingredients.find((i) => i.key === key)
  return (ru ? def?.name.ru : def?.name.en) ?? key
}

/** Порог общего балла стола для баффа (зеркалит `LocalBackendAdapter.potluckContribute`
 * §11-town — только для прогресс-бара, истина/переключение баффа — сервер). */
const POTLUCK_BUFF_GOAL = 1000

export function Potluck() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const potluck = useStore((s) => s.coop.potluck)
  const inventory = useStore((s) => s.inventory)
  const coop = useCoopSystem()

  const [pickKey, setPickKey] = useState<ProductKey>('')
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)

  const dishStacks = (inventory?.stacks ?? []).filter((st) => st.itemClass === 'dish' && st.qty > 0)

  if (!potluck) {
    return (
      <section
        data-testid="ui-potluck"
        className="pointer-events-auto mx-auto w-full max-w-md rounded-xl p-4"
        style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
      >
        <p data-testid="potluck-empty" className="py-6 text-center italic opacity-70">
          {ru ? 'Стол пуст — принеси первое блюдо.' : 'The table is empty — bring the first dish.'}
        </p>
      </section>
    )
  }

  const pct = Math.min(100, Math.max(0, Math.round((100 * potluck.totalScore) / POTLUCK_BUFF_GOAL)))

  async function handleBring() {
    if (!pickKey || qty <= 0 || !potluck) return
    setBusy(true)
    try {
      const res = await coop.potluck(potluck.weekIndex, pickKey, qty)
      if (res.ok) {
        setPickKey('')
        setQty(1)
      } else {
        useStore.getState().pushToast({
          id: `potluck_err_${Date.now()}`,
          kind: 'warn',
          message: ru ? `Не получилось: ${res.error.message}` : `Couldn’t bring it: ${res.error.message}`,
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
      data-testid="ui-potluck"
      className="pointer-events-auto mx-auto flex w-full max-w-md flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <header className="flex items-center justify-between border-b border-dotted pb-2" style={{ borderColor: DINER.chrome }}>
        <h2 className="text-lg font-black uppercase tracking-wide">
          {ru ? 'Стол стрита · Potluck' : 'Street Potluck'}
        </h2>
        {potluck.buffActive && (
          <span
            data-testid="potluck-buff-active"
            className="rounded px-2 py-0.5 text-xs font-bold text-white"
            style={{ background: DINER.teal }}
          >
            {ru ? 'Бафф активен' : 'Buff active'}
          </span>
        )}
      </header>

      <div className="flex items-center justify-between text-sm tabular-nums">
        <span>
          {ru ? 'Общий вклад' : 'Total'}: <span className="font-mono">{money(potluck.totalScore)}</span>
        </span>
        <span>
          {ru ? 'Твой вклад' : 'Your share'}: <span className="font-mono">{money(potluck.myScore)}</span>
        </span>
      </div>

      <div className="h-3 w-full overflow-hidden rounded" style={{ background: DINER.chrome }}>
        <div data-testid="potluck-progress-bar" className="h-full" style={{ width: `${pct}%`, background: DINER.teal }} />
      </div>

      <div className="rounded-lg border border-dashed p-3" style={{ borderColor: DINER.chrome }}>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: DINER.mustard }}>
          {ru ? 'Принести блюдо' : 'Bring a dish'}
        </h3>
        {dishStacks.length === 0 ? (
          <p className="text-sm italic opacity-60">
            {ru ? 'Нет готовых блюд на складе.' : 'No finished dishes in storage.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <select
              data-testid="potluck-pick-item"
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
              <label className="flex items-center gap-2 text-sm">
                {ru ? 'Кол-во' : 'Qty'}
                <input
                  data-testid="potluck-pick-qty"
                  type="number"
                  min={1}
                  max={dishStacks.find((s) => s.key === pickKey)?.qty ?? 1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 rounded border px-2 py-1"
                  style={{ borderColor: DINER.chrome }}
                />
              </label>
            )}
            <button
              type="button"
              data-testid="potluck-bring-dish"
              disabled={!pickKey || busy}
              onClick={() => void handleBring()}
              className="self-start rounded-lg px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-40"
              style={{ background: DINER.cherry }}
            >
              {ru ? 'Принести' : 'Bring dish'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
