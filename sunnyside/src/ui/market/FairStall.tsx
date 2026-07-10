/**
 * FairStall.tsx — прилавок ярмарки (ui_fair_stall, 19-ui-ux §3.4 R2, 09-fair §3.2/§3.3/§3.6).
 * Пассивная витрина: выкладка лотов из стока, ценовой ползунок в коридоре тира, прогноз
 * продаж «≈N/окно» (Ticket/Stub-талон-стиль §4.5 — ценники прилавка). Все формулы
 * (коридор цены, эластичность, прогноз SellRate) — из `@/engine/fair` (09-fair §3.3),
 * НЕ дублируются здесь (AGENTS.md §0.3).
 *
 * ГРАНИЦА (AGENTS.md §3): ui/ не ходит в @/net. Мутации (`fair_list`/`fair_tent_upgrade`)
 * идут через `FairSystem` (DI-контекст, см. `FairSystemContext.tsx`) — реальную сборку
 * системы (адаптер) делает композиция/бутстрап, вне зоны ui-market-orders.
 *
 * TODO(owner: net-local, вне зоны ui-market-orders): `LocalBackendAdapter.fairList`
 * (src/net/adapters/local.ts) заменяет `w.fair.lots` целиком и списывает qty КАЖДОГО
 * лота запроса заново на каждый вызов — повторная выкладка уже выставленного лота
 * задвоит резерв стока. Спека 09-fair §3.2 ожидает аддитивный restock без потерь;
 * этот компонент шлёт `FairListReq` по контракту как есть — фикс семантики адаптера
 * не в этой зоне (AGENTS.md §2).
 */

import { useMemo, useState } from 'react'
import { useStore } from '@/state'
import type { FairListReq, ProductKey, Quality, Tier } from '@/types'
import { ingredients } from '@/data/catalogs/ingredients'
import {
  priceBounds,
  refPrice,
  pricePressure,
  sellRate,
  stackCap,
  TENT_TIERS,
  type TentLevel,
} from '@/engine/fair'
import { useFairSystem } from './FairSystemContext'
import { money } from './format'
import { DINER, PRINT_SHADOW } from './tokens'

const FAIR_WINDOW_HOURS = 36

function productDef(key: ProductKey) {
  return ingredients.find((i) => i.key === key)
}

function tentLevelOf(level: number): TentLevel {
  return Math.min(5, Math.max(1, Math.round(level))) as TentLevel
}

export function FairStall() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const stall = useStore((s) => s.fair.stall)
  const inventory = useStore((s) => s.inventory)
  const demand = useStore((s) => s.demand)
  const fair = useFairSystem()

  const dishStacks = useMemo(
    () => (inventory?.stacks ?? []).filter((st) => st.itemClass === 'dish' && st.qty > 0),
    [inventory],
  )

  const [pickKey, setPickKey] = useState<ProductKey>('')
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const pickedDef = pickKey ? productDef(pickKey) : undefined
  const pickedTier: Tier = pickedDef?.tier ?? 1
  const bounds = priceBounds(pickedTier)
  const effectivePrice = price ?? refPrice(pickedTier)
  const demandMult = pickedDef?.demandCategory ? (demand?.board[pickedDef.demandCategory] ?? 1) : 1

  if (!stall) {
    return (
      <section
        data-testid="ui-fair-stall"
        className="pointer-events-auto mx-auto w-full max-w-lg rounded-xl p-4"
        style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
      >
        <p data-testid="fair-stall-empty" className="py-6 text-center italic opacity-70">
          {ru ? 'Витрина пуста — выложи сток.' : 'The counter is empty — set out your stock.'}
        </p>
      </section>
    )
  }

  const level = tentLevelOf(stall.level)
  const tent = TENT_TIERS[level]
  const canUpgrade = level < 5

  const projectedUnits = (tier: Tier, priceSet: number, stars: number): number => {
    const rate = sellRate({ tier, demand: demandMult, priceSet, stars, lStall: tent.lStall })
    return Math.round(rate * FAIR_WINDOW_HOURS)
  }

  async function handleAddLot() {
    if (!pickKey || qty <= 0 || !stall) return
    const cap = stackCap(pickedTier)
    const alreadyListed = stall.lots.find((l) => l.itemKey === pickKey)?.remaining ?? 0
    const safeQty = Math.max(0, Math.min(qty, cap - alreadyListed))
    if (safeQty <= 0) return
    const nextLots: FairListReq['lots'] = [
      ...stall.lots.map((l) => ({ itemKey: l.itemKey, qty: l.remaining, quality: l.quality, price: l.price })),
      {
        itemKey: pickKey,
        qty: safeQty,
        quality: (dishStacks.find((s) => s.key === pickKey)?.quality ?? 1) as Quality,
        price: effectivePrice,
      },
    ]
    setBusy(true)
    try {
      const res = await fair.list({ stallId: stall.id, lots: nextLots })
      if (res.ok) {
        setPickKey('')
        setQty(1)
        setPrice(null)
      } else {
        useStore.getState().pushToast({
          id: `fair_list_err_${Date.now()}`,
          kind: 'warn',
          message: ru ? `Не получилось выложить: ${res.error.message}` : `Couldn’t list it: ${res.error.message}`,
          createdAt: Date.now(),
          ttlMs: 6000,
        })
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleRemoveLot(lotId: string) {
    if (!stall) return
    const nextLots: FairListReq['lots'] = stall.lots
      .filter((l) => l.id !== lotId)
      .map((l) => ({ itemKey: l.itemKey, qty: l.remaining, quality: l.quality, price: l.price }))
    setBusy(true)
    try {
      await fair.list({ stallId: stall.id, lots: nextLots })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      data-testid="ui-fair-stall"
      className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <header className="flex items-center justify-between border-b border-dotted pb-2" style={{ borderColor: DINER.chrome }}>
        <h2 className="text-lg font-black uppercase tracking-wide">
          {ru ? 'Прилавок ярмарки' : 'Fair Stall'}
        </h2>
        <span data-testid="fair-stall-slots" className="text-sm font-semibold tabular-nums opacity-70">
          {ru ? 'Ур.' : 'Lv.'} {level} · {stall.lots.length}/{stall.displaySlots}
        </span>
      </header>

      {stall.lots.length === 0 ? (
        <p data-testid="fair-stall-lots-empty" className="py-4 text-center italic opacity-70">
          {ru ? 'Витрина пуста — выложи сток.' : 'The counter is empty — set out your stock.'}
        </p>
      ) : (
        <ul data-testid="fair-stall-lots" className="flex flex-col gap-1.5">
          {stall.lots.map((lot) => {
            const def = productDef(lot.itemKey)
            const tier = def?.tier ?? 1
            const units = projectedUnits(tier, lot.price, lot.quality)
            return (
              <li
                key={lot.id}
                data-testid={`fair-lot-${lot.itemKey}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-1.5 text-sm tabular-nums"
                style={{ borderColor: DINER.chrome }}
              >
                <span className="font-semibold">
                  {ru ? (def?.name.ru ?? lot.itemKey) : (def?.name.en ?? lot.itemKey)} · {lot.remaining}/{lot.qty}
                </span>
                <span className="font-bold" style={{ color: DINER.cherry }}>
                  {money(lot.price)}
                </span>
                <span className="text-xs opacity-60">
                  ≈{units}/{ru ? 'окно' : 'window'}
                </span>
                <button
                  type="button"
                  data-testid={`fair-lot-remove-${lot.itemKey}`}
                  disabled={busy}
                  onClick={() => void handleRemoveLot(lot.id)}
                  className="rounded px-2 py-1 text-xs font-bold disabled:opacity-40"
                  style={{ background: DINER.chrome, color: DINER.board }}
                >
                  {ru ? 'Снять' : 'Pull'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="rounded-lg border border-dashed p-3" style={{ borderColor: DINER.chrome }}>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: DINER.mustard }}>
          {ru ? 'Выложить лот' : 'List a lot'}
        </h3>
        {dishStacks.length === 0 ? (
          <p className="text-sm italic opacity-60">
            {ru ? 'Нет готовых блюд на складе.' : 'No finished dishes in storage.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <select
              data-testid="fair-pick-item"
              value={pickKey}
              onChange={(e) => setPickKey(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
              style={{ borderColor: DINER.chrome }}
            >
              <option value="">{ru ? 'Выбери блюдо…' : 'Pick a dish…'}</option>
              {dishStacks.map((st) => (
                <option key={st.key} value={st.key}>
                  {(ru ? productDef(st.key)?.name.ru : productDef(st.key)?.name.en) ?? st.key} ({ru ? 'сток' : 'stock'} {st.qty})
                </option>
              ))}
            </select>

            {pickKey && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  {ru ? 'Кол-во' : 'Qty'}
                  <input
                    data-testid="fair-pick-qty"
                    type="number"
                    min={1}
                    max={dishStacks.find((s) => s.key === pickKey)?.qty ?? 1}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 rounded border px-2 py-1"
                    style={{ borderColor: DINER.chrome }}
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm">
                  {ru ? 'Цена' : 'Price'} ({money(bounds.min)}–{money(bounds.max)}, {ru ? 'референс' : 'ref'} {money(refPrice(pickedTier))})
                  <input
                    data-testid="fair-pick-price"
                    type="range"
                    min={bounds.min}
                    max={bounds.max}
                    step={1}
                    value={effectivePrice}
                    onChange={(e) => setPrice(Number(e.target.value))}
                  />
                  <span className="tabular-nums font-mono">{money(effectivePrice)}</span>
                </label>

                <p data-testid="fair-pick-preview" className="text-xs opacity-70">
                  {ru ? 'Прогноз: продастся ≈' : 'Forecast: will sell ≈'}
                  {projectedUnits(pickedTier, effectivePrice, 1)}/{ru ? 'окно' : 'window'}
                  {' '}(P={pricePressure(pickedTier, effectivePrice).toFixed(2)})
                </p>

                <button
                  type="button"
                  data-testid="fair-add-lot"
                  disabled={busy}
                  onClick={() => void handleAddLot()}
                  className="self-start rounded-lg px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-40"
                  style={{ background: DINER.cherry }}
                >
                  {ru ? 'Выложить' : 'List it'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-dotted pt-2" style={{ borderColor: DINER.chrome }}>
        <span className="text-xs opacity-60">
          {ru ? 'Апгрейд палатки' : 'Tent upgrade'}:{' '}
          {canUpgrade ? TENT_TIERS[(level + 1) as TentLevel].displaySlots : tent.displaySlots}{' '}
          {ru ? 'слотов' : 'slots'}
        </span>
        <button
          type="button"
          data-testid="fair-upgrade-tent"
          disabled={!canUpgrade || busy}
          onClick={() => void fair.upgradeTent()}
          className="rounded-lg px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-40"
          style={{ background: DINER.board }}
        >
          Upgrade Tent
        </button>
      </footer>
    </section>
  )
}
