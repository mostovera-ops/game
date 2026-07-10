/**
 * ShopHome.tsx — `ui_shop` Shop (19-ui-ux §4.2 навигация: «доступен из marquee-валют и
 * Profile-меню «☰», НЕ отдельная таб-иконка → {Cosmetics · Boosters · Bundles · Dimes}
 * · [Prize Machine] · [Route Pass]»). Таб-переключатель на четыре под-экрана этого файла;
 * Prize Machine/Route Pass — отдельные canon-панели (`ui_prize_machine`/`ui_route_pass`),
 * открываются своими входами (POI/marquee), не вложены сюда как таб.
 */
import { useState } from 'react'
import { useStore } from '@/state'
import { DINER, PRINT_SHADOW } from './tokens'
import { CosmeticsShop } from './CosmeticsShop'
import { Boosters } from './Boosters'
import { EventBundles } from './EventBundles'
import { DimesShop } from './DimesShop'

type ShopTab = 'cosmetics' | 'boosters' | 'bundles' | 'dimes'

const TAB_LABEL: Record<ShopTab, { en: string; ru: string }> = {
  cosmetics: { en: 'Cosmetics', ru: 'Косметика' },
  boosters: { en: 'Boosters', ru: 'Бустеры' },
  bundles: { en: 'Bundles', ru: 'Бандлы' },
  dimes: { en: 'Dimes', ru: 'Даймы' },
}

const TABS: readonly ShopTab[] = ['cosmetics', 'boosters', 'bundles', 'dimes']

export function ShopHome() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const [tab, setTab] = useState<ShopTab>('cosmetics')

  return (
    <div data-testid="ui-shop" className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-3">
      <div
        data-testid="shop-tabs"
        className="mx-auto flex gap-1.5 rounded-full p-1"
        style={{ background: DINER.board, boxShadow: PRINT_SHADOW }}
      >
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            data-testid={`shop-tab-${t}`}
            onClick={() => setTab(t)}
            className="rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
            style={{
              background: tab === t ? DINER.cherry : 'transparent',
              color: tab === t ? 'white' : DINER.boardInk,
            }}
          >
            {ru ? TAB_LABEL[t].ru : TAB_LABEL[t].en}
          </button>
        ))}
      </div>

      {tab === 'cosmetics' && <CosmeticsShop />}
      {tab === 'boosters' && <Boosters />}
      {tab === 'bundles' && <EventBundles />}
      {tab === 'dimes' && <DimesShop />}
    </div>
  )
}
