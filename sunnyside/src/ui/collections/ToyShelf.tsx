/**
 * ui/collections/ToyShelf.tsx — C4 Toy Shelf + M2 Prize Machine (docs/specs/19-ui-ux.md
 * §3.7 C4 / §3.8 M2, 17-collections §2.4/§3.4): «вендинг-автомат у входа» — полки
 * по 5 сериям, силуэты недостающих фигурок, открытый pity («до Rare: N» / «до
 * Chase: N»), кнопка `Spin`.
 *
 * Реальный дроп/pity — СЕРВЕР (`CollectionSystem.pullPrize` → adapter, анти-чит
 * AGENTS.md §0.3); pity, отображаемый до первого пулла в этой сессии, — открытый
 * начальный счётчик `initialPity` (engine/collections/prizeMachine.ts), после
 * пулла заменяется на `pityAfter` из ответа. Это НЕ повторяет формулу дропа
 * локально для реального пулла — только держит счётчик для UI между вызовами.
 */
import { useMemo, useState } from 'react'
import { useStore } from '@/state'
import { TOY_SERIES_KEYS, type ToySeriesKey, type Toy } from '@/types/collections'
import type { PrizePity } from '@/types/monetization'
import { toys as toyCatalog } from '@/data/catalogs/toys'
import type { ToyDef } from '@/data/schema'
import { initialPity } from '@/engine/collections'
import { useCollectionSystem } from './CollectionSystemContext'
import { DINER, PRINT_SHADOW } from './tokens'

const SERIES_LABEL: Record<ToySeriesKey, { ru: string; en: string }> = {
  toy_highway_dinos: { ru: 'Динозавры шоссе', en: 'Highway Dinos' },
  toy_cosmos_57: { ru: 'Космос-57', en: 'Cosmos-57' },
  toy_route_critters: { ru: 'Зверушки трассы', en: 'Route Critters' },
  toy_chrome_rockets: { ru: 'Хромовые ракеты', en: 'Chrome Rockets' },
  toy_diner_mascots: { ru: 'Талисманы дайнера', en: 'Diner Mascots' },
}

// Fallback стабильной ссылкой — иначе zustand useSyncExternalStore видит «новый»
// объект на каждом вызове селектора и уходит в бесконечный ре-рендер.
const EMPTY_TOYS: Readonly<Record<string, Toy>> = {}

export interface ToyShelfProps {
  onClose?: () => void
}

export function ToyShelf({ onClose }: ToyShelfProps) {
  const locale = useStore((s) => s.ui.locale)
  const ownedToys = useStore((s) => s.collections?.toys ?? EMPTY_TOYS)
  const system = useCollectionSystem()

  const [activeSeries, setActiveSeries] = useState<ToySeriesKey>(TOY_SERIES_KEYS[0] ?? 'toy_highway_dinos')
  const [pity, setPity] = useState<Record<ToySeriesKey, PrizePity>>(() => {
    const init: Partial<Record<ToySeriesKey, PrizePity>> = {}
    for (const s of TOY_SERIES_KEYS) init[s] = initialPity(s)
    return init as Record<ToySeriesKey, PrizePity>
  })
  const [spinning, setSpinning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toysBySeries = useMemo(() => {
    const map = new Map<ToySeriesKey, ToyDef[]>()
    for (const s of TOY_SERIES_KEYS) map.set(s, [])
    for (const t of toyCatalog as ToyDef[]) map.get(t.series)?.push(t)
    return map
  }, [])

  const activeToys = toysBySeries.get(activeSeries) ?? []
  const activePity = pity[activeSeries]
  const rareLeft = Math.max(0, activePity.rareCap - activePity.pullsSinceRare)
  const chaseLeft = Math.max(0, activePity.chaseCap - activePity.pullsSinceChase)

  async function spin() {
    setSpinning(true)
    setError(null)
    const res = await system.pullPrize({ seriesKey: activeSeries, count: 1 })
    setSpinning(false)
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    setPity((prev) => ({ ...prev, [activeSeries]: res.data.pityAfter }))
  }

  return (
    <section
      data-testid="toy-shelf"
      className="flex max-h-[80vh] w-full max-w-4xl flex-col gap-3 overflow-hidden rounded-2xl p-4"
      style={{ background: DINER.paper }}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-black uppercase tracking-wide" style={{ color: DINER.board }}>
          {locale === 'ru' ? 'Полка игрушек' : 'Toy Shelf'}
        </h2>
        {onClose && (
          <button
            type="button"
            data-testid="toy-shelf-close"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm font-bold"
            style={{ background: DINER.board, color: DINER.boardInk }}
          >
            {locale === 'ru' ? 'Закрыть' : 'Close'}
          </button>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {TOY_SERIES_KEYS.map((s) => (
          <button
            key={s}
            type="button"
            data-testid={`toy-shelf-series-tab-${s}`}
            aria-pressed={activeSeries === s}
            onClick={() => setActiveSeries(s)}
            className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
            style={{
              background: activeSeries === s ? DINER.cherry : DINER.card,
              color: activeSeries === s ? 'white' : DINER.ink,
              border: `1px solid ${DINER.chrome}`,
            }}
          >
            {SERIES_LABEL[s][locale]}
          </button>
        ))}
      </div>

      <div
        data-testid="prize-machine-pity"
        className="flex flex-wrap items-center gap-4 rounded-xl border-2 p-3 text-xs"
        style={{ background: DINER.board, color: DINER.boardInk, borderColor: DINER.chrome, boxShadow: PRINT_SHADOW }}
      >
        <span data-testid="prize-machine-pity-rare" className="tabular-nums">
          {locale === 'ru' ? 'До Rare' : 'Until Rare'}: {rareLeft}
        </span>
        <span data-testid="prize-machine-pity-chase" className="tabular-nums">
          {locale === 'ru' ? 'До Chase' : 'Until Chase'}: {chaseLeft}
        </span>
        <button
          type="button"
          data-testid="prize-machine-spin"
          onClick={spin}
          disabled={spinning}
          className="ml-auto rounded-lg px-3 py-1 text-[11px] font-bold uppercase text-white disabled:opacity-50"
          style={{ background: DINER.cherry }}
        >
          {spinning ? (locale === 'ru' ? 'Крутим…' : 'Spinning…') : locale === 'ru' ? 'Крутить' : 'Spin'}
        </button>
      </div>
      {error && (
        <p data-testid="prize-machine-error" className="text-xs" style={{ color: DINER.cherry }}>
          {locale === 'ru' ? 'Автомат заело — попытка вернётся.' : 'Machine jammed — your spin is refunded.'} ({error})
        </p>
      )}

      {activeToys.length === 0 ? (
        <p data-testid="toy-shelf-empty" className="text-xs italic opacity-70">
          {locale === 'ru' ? 'Полка ждёт первую игрушку.' : 'The shelf is waiting for its first toy.'}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
          {activeToys.map((t) => {
            const owned = ownedToys[t.key]
            const have = Boolean(owned?.owned)
            return (
              <li
                key={t.key}
                data-testid={`toy-${t.key}`}
                data-owned={have}
                className="flex flex-col items-center gap-1 rounded-xl border-2 p-2 text-center text-[11px]"
                style={{
                  background: have ? DINER.card : '#EFE6D2',
                  borderColor: DINER.chrome,
                  boxShadow: PRINT_SHADOW,
                  color: have ? DINER.ink : DINER.inkMuted,
                  opacity: have ? 1 : 0.5,
                }}
              >
                <span className="text-2xl" aria-hidden>
                  {have ? '🧸' : '❔'}
                </span>
                <p className="font-bold">{have ? t.name[locale] : '???'}</p>
                <span className="uppercase" style={{ color: DINER.mustard }}>
                  {t.rarity}
                </span>
                {owned && owned.duplicate > 0 && (
                  <span data-testid={`toy-dupe-${t.key}`} className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: DINER.teal }}>
                    {locale === 'ru' ? `дублей: ${owned.duplicate}` : `dupes: ${owned.duplicate}`}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
