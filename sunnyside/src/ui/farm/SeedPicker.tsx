/**
 * ui/farm/SeedPicker.tsx — F1 Seed Picker (docs/specs/19-ui-ux.md §3.2 F1, farm-ui-seams).
 *
 * Клик по ПУСТОЙ грядке (`scene/farm/Plot.tsx` → `useFarmActions().pickSeed`) кладёт слот в
 * `ui.seedPickerSlot` — эта сетка культур появляется поверх сцены и на выбор культуры сеет
 * ЧЕРЕЗ АДАПТЕР (`FarmSystem.sow`, DI — `FarmSystemContext`), не локальным хардкодом.
 *
 * F1 — контекстный `POI → SHEET` (19-ui-ux §3.2), у него нет canon `ui_*` ключа (в отличие
 * от `ui_recipe_box` и т.п.) — поэтому оверлей самостоятельный (свой fixed-backdrop), а не
 * через общий `Modal`/`ui.activePanel` (тот каркас — только для canon-панелей, AGENTS.md §0.7:
 * не выдумываем новый ключ сущности без PR в 00-canon.md).
 *
 * Список культур — только те, что заведены в реестре заглушек (`KNOWN_CROP_ASSETS`
 * сцены-фермы; политика заглушек AGENTS.md §5: не показываем то, что не можем нарисовать
 * по-настоящему, даже с фолбэком).
 */
import { useState } from 'react'
import { useStore } from '@/state'
import { crops } from '@/data/catalogs/crops'
import type { ProductKey } from '@/types'
import { DINER, PRINT_SHADOW } from '@/ui/kitchen/tokens'
import { useFarmSystem } from './FarmSystemContext'

/** Культуры сцены-фермы, для которых заведена заглушка (см. `scene/farm/assetMap.ts`). */
const KNOWN_CROP_KEYS = new Set<ProductKey>([
  'crop_tomato',
  'crop_lettuce',
  'crop_potato',
  'crop_wheat',
  'crop_corn',
  'crop_strawberry',
  'crop_cherry',
])

function formatGrow(growSec: number, locale: 'ru' | 'en'): string {
  const min = Math.round(growSec / 60)
  return locale === 'ru' ? `${min} мин` : `${min} min`
}

export function SeedPicker() {
  const slot = useStore((s) => s.ui.seedPickerSlot)
  const locale = useStore((s) => s.ui.locale)
  const farmSystem = useFarmSystem()
  const [sowingKey, setSowingKey] = useState<ProductKey | null>(null)

  if (slot === null) return null

  const close = () => useStore.getState().setSeedPickerSlot(null)

  const options = crops.filter((c) => KNOWN_CROP_KEYS.has(c.cropKey))

  async function pick(seedKey: ProductKey) {
    if (sowingKey) return
    setSowingKey(seedKey)
    try {
      const res = await farmSystem.sow(slot as number, seedKey)
      // Тёплый тост при отказе уже кладёт `SystemContext.applyMutation` (композиция) —
      // здесь просто закрываем оверлей только при успехе, чтобы можно было попробовать снова.
      if (res.ok) close()
    } finally {
      setSowingKey(null)
    }
  }

  return (
    <div
      data-testid="seed-picker"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={locale === 'ru' ? 'Что посадим?' : 'What should we plant?'}
        className="hud-receipt pointer-events-auto w-full max-w-lg rounded-t-2xl p-4 md:m-4 md:rounded-[var(--radius-diner)]"
        onClick={(e) => e.stopPropagation()}
        style={{ background: DINER.paper }}
      >
        <header className="hud-kicker mb-3 flex items-center justify-between pb-2 text-sm">
          <span>{locale === 'ru' ? 'Что посадим?' : 'What should we plant?'}</span>
          <button
            type="button"
            data-testid="seed-picker-close"
            aria-label="Close"
            onClick={close}
            className="rounded-full px-2 text-base leading-none opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </header>

        {options.length === 0 ? (
          <p className="italic opacity-70">{locale === 'ru' ? 'Семян пока нет' : 'No seeds yet'}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {options.map((crop) => (
              <button
                key={crop.seedKey}
                type="button"
                data-testid={`seed-picker-option-${crop.seedKey}`}
                disabled={sowingKey !== null}
                onClick={() => void pick(crop.seedKey)}
                className="flex flex-col items-start gap-0.5 rounded-xl p-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: DINER.card, boxShadow: PRINT_SHADOW, color: '#2b2118' }}
              >
                <span className="font-black uppercase tracking-wide" style={{ color: DINER.board }}>
                  {crop.name[locale]}
                </span>
                <span className="text-xs tabular-nums opacity-80">
                  T{crop.tier} · {formatGrow(crop.growSec, locale)}
                  {sowingKey === crop.seedKey ? (locale === 'ru' ? ' · Сеем…' : ' · Sowing…') : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
