/**
 * ui/inventory/StorageOverlay.tsx — F4 Storage / Silo & Icehouse (docs/specs/19-ui-ux.md
 * §3.2 F4): полки-витрина стока, лимиты Silo/Icehouse, индикация переполнения (canon E3 —
 * жёлтая рамка, НЕ красная), Gift/Potluck/Upgrade — делегируются композиции.
 *
 * Лимиты/резерв/буфер перелива — `InventorySystem` (engine/inventory), см.
 * `InventorySystemContext.tsx`. Компонент не пересчитывает лимиты сам — только читает
 * `InventorySnapshot` (истина сервера, `state/inventory.ts`) и вызывает систему для
 * презентационных производных (ёмкость по уровню постройки).
 */
import { useMemo, useState } from 'react'
import { useStore } from '@/state'
import type { ItemClass, ProductKey, StorageKind, BuildingKey, Building } from '@/types'
import { ingredientContent, productLabel } from '@/ui/kitchen/catalog'
import { DINER, PRINT_SHADOW } from '@/ui/kitchen/tokens'
import { useInventorySystem } from './InventorySystemContext'

// TODO(c3): стабильные пустые ссылки (см. RecipeBox) — `?? {}` роняло бы
// useSyncExternalStore «infinite loop» при null-слайсах.
const EMPTY_ITEMS = {} as Record<ProductKey, number>
const EMPTY_BUILDINGS: Partial<Record<BuildingKey, Building>> = {}

const STORAGE_LABEL: Record<StorageKind, { ru: string; en: string }> = {
  silo: { ru: 'Силос', en: 'Silo' },
  icehouse: { ru: 'Ледник', en: 'Icehouse' },
  general: { ru: 'Общий склад', en: 'General' },
}

const CATEGORY_LABEL: Record<ItemClass, { ru: string; en: string }> = {
  seed: { ru: 'Семена', en: 'Seeds' },
  crop: { ru: 'Урожай', en: 'Crops' },
  animal_product: { ru: 'Продукты фермы', en: 'Animal products' },
  ingredient: { ru: 'Полуфабрикаты', en: 'Ingredients' },
  dish: { ru: 'Блюда', en: 'Dishes' },
  feed: { ru: 'Корм', en: 'Feed' },
  material: { ru: 'Материалы', en: 'Materials' },
  decor: { ru: 'Декор', en: 'Decor' },
  tool: { ru: 'Инструменты', en: 'Tools' },
  special: { ru: 'Особое', en: 'Особое' },
}

interface StackRow {
  key: ProductKey
  qty: number
  itemClass: ItemClass
}

export interface StorageOverlayProps {
  onGiftNeighbor?: (itemKey: ProductKey, qty: number) => void
  onAddPotluck?: (itemKey: ProductKey, qty: number) => void
  onUpgrade?: (kind: 'silo' | 'icehouse') => void
  onClose?: () => void
}

export function StorageOverlay({ onGiftNeighbor, onAddPotluck, onUpgrade, onClose }: StorageOverlayProps) {
  const locale = useStore((s) => s.ui.locale)
  const items = useStore((s) => s.inventory?.items ?? EMPTY_ITEMS)
  const buildings = useStore((s) => s.farm?.buildings ?? EMPTY_BUILDINGS)
  const serverNow = useStore((s) => s.serverNow)
  const inventorySystem = useInventorySystem()

  const [categoryFilter, setCategoryFilter] = useState<'all' | ItemClass>('all')
  const [kindFilter, setKindFilter] = useState<'all' | StorageKind>('all')

  const siloLevel = buildings.bld_silo?.level ?? 1
  const icehouseLevel = buildings.bld_icehouse?.level ?? 1
  const limits = inventorySystem.storageLimits(siloLevel, icehouseLevel)
  const overflowEntries = inventorySystem.listOverflow()

  const { rows, totals } = useMemo(() => {
    const grouped: Record<StorageKind, StackRow[]> = { silo: [], icehouse: [], general: [] }
    const sums: Record<StorageKind, number> = { silo: 0, icehouse: 0, general: 0 }
    for (const [key, qty] of Object.entries(items)) {
      if (qty <= 0) continue
      const def = ingredientContent(key)
      const kind: StorageKind = def?.storage ?? 'general'
      const itemClass: ItemClass = def?.itemClass ?? 'material'
      sums[kind] += qty
      grouped[kind].push({ key, qty, itemClass })
    }
    return { rows: grouped, totals: sums }
  }, [items])

  const kinds: StorageKind[] = kindFilter === 'all' ? ['silo', 'icehouse', 'general'] : [kindFilter]

  return (
    <section
      data-testid="storage-overlay"
      className="flex max-h-[80vh] w-full max-w-3xl flex-col gap-3 overflow-hidden rounded-2xl p-4"
      style={{ background: DINER.paper }}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-black uppercase tracking-wide" style={{ color: DINER.board }}>
          {locale === 'ru' ? 'Склад' : 'Storage'}
        </h2>
        {onClose && (
          <button
            type="button"
            data-testid="storage-close"
            onClick={onClose}
            className="hud-tap-target flex items-center justify-center rounded-full px-3 py-1 text-sm font-bold"
            style={{ background: DINER.board, color: DINER.boardInk }}
          >
            {locale === 'ru' ? 'Закрыть' : 'Close'}
          </button>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {(['all', 'silo', 'icehouse', 'general'] as const).map((k) => (
          <button
            key={k}
            type="button"
            data-testid={`storage-kind-tab-${k}`}
            aria-pressed={kindFilter === k}
            onClick={() => setKindFilter(k)}
            className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
            style={{
              background: kindFilter === k ? DINER.cherry : DINER.card,
              color: kindFilter === k ? 'white' : DINER.ink,
              border: `1px solid ${DINER.chrome}`,
            }}
          >
            {k === 'all' ? (locale === 'ru' ? 'Всё' : 'All') : STORAGE_LABEL[k][locale]}
          </button>
        ))}

        <select
          data-testid="storage-category-filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'all' | ItemClass)}
          className="ml-auto rounded-lg border px-2 py-1 text-xs"
          style={{ borderColor: DINER.chrome, background: DINER.card, color: DINER.ink }}
        >
          <option value="all">{locale === 'ru' ? 'Все категории' : 'All categories'}</option>
          {(Object.keys(CATEGORY_LABEL) as ItemClass[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c][locale]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto">
        {kinds.map((kind) => {
          const limit = limits[kind]
          const total = totals[kind]
          const isInfinite = !Number.isFinite(limit)
          const overflowing = !isInfinite && total > limit
          const filtered = rows[kind].filter((r) => categoryFilter === 'all' || r.itemClass === categoryFilter)

          return (
            <div
              key={kind}
              data-testid={`storage-shelf-${kind}`}
              data-overflowing={overflowing}
              className="rounded-xl border-2 p-3"
              style={{
                background: DINER.card,
                borderColor: overflowing ? DINER.mustard : DINER.chrome,
                boxShadow: PRINT_SHADOW,
                color: DINER.ink,
              }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black uppercase tracking-wide" style={{ color: DINER.board }}>
                  {STORAGE_LABEL[kind][locale]}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-xs font-bold">
                    {total} / {isInfinite ? '∞' : limit}
                  </span>
                  {(kind === 'silo' || kind === 'icehouse') && onUpgrade && (
                    <button
                      type="button"
                      data-testid={`storage-upgrade-${kind}`}
                      onClick={() => onUpgrade(kind)}
                      className="rounded-lg px-2 py-1 text-[11px] font-bold uppercase text-white"
                      style={{ background: DINER.teal }}
                    >
                      {locale === 'ru' ? 'Расширить' : 'Upgrade'}
                    </button>
                  )}
                </div>
              </div>

              {!isInfinite && (
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full" style={{ background: DINER.paper }}>
                  <div
                    data-testid={`storage-fill-${kind}`}
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (total / Math.max(1, limit)) * 100)}%`,
                      background: overflowing ? DINER.mustard : DINER.teal,
                    }}
                  />
                </div>
              )}

              {filtered.length === 0 ? (
                <p className="mt-2 text-xs italic opacity-70">{locale === 'ru' ? 'Полки пусты' : 'Shelves are empty'}</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1 text-xs">
                  {filtered.map((row) => (
                    <li key={row.key} className="flex items-center justify-between tabular-nums">
                      <span>{productLabel(row.key, locale)}</span>
                      <span className="flex items-center gap-2">
                        ×{row.qty}
                        {onGiftNeighbor && (
                          <button
                            type="button"
                            data-testid={`storage-gift-${row.key}`}
                            onClick={() => onGiftNeighbor(row.key, row.qty)}
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                            style={{ background: DINER.cherry }}
                          >
                            {locale === 'ru' ? 'Подарить' : 'Gift'}
                          </button>
                        )}
                        {onAddPotluck && (
                          <button
                            type="button"
                            data-testid={`storage-potluck-${row.key}`}
                            onClick={() => onAddPotluck(row.key, row.qty)}
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                            style={{ background: DINER.mustard }}
                          >
                            {locale === 'ru' ? 'В стол стрита' : 'Potluck'}
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}

        {overflowEntries.length > 0 && (
          <div
            data-testid="storage-overflow-buffer"
            className="rounded-xl border-2 border-dashed p-3 text-xs"
            style={{ borderColor: DINER.mustard, background: DINER.card, color: DINER.ink }}
          >
            <h3 className="font-black uppercase" style={{ color: DINER.mustard }}>
              {locale === 'ru' ? 'Буфер перелива (24ч)' : 'Overflow buffer (24h)'}
            </h3>
            <ul className="mt-1 flex flex-col gap-0.5 tabular-nums">
              {overflowEntries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between">
                  <span>
                    {productLabel(entry.itemKey, locale)} ×{entry.qty}
                  </span>
                  <span>{Math.max(0, Math.ceil((entry.expiresAt - serverNow()) / 3_600_000))}h</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
