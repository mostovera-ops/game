/**
 * app/PanelLauncher.tsx — HUD-лаунчер «панели» (фикс APP-1/APP-2, интегратор C3).
 *
 * ПРОБЛЕМА: `PanelHost` монтирует ВСЕ канон-панели `ui_*`, но продовый UI звал `openPanel()`
 * лишь для считанных из них (`ui_chat`/`ui_notif_log`/`ui_recipe_box`/`ui_shift` — свои
 * лаунчеры/сцена). Остальные — core-loop (`ui_demand_board`/`ui_shop`/`ui_coop_orders`/
 * `ui_potluck`/`ui_fair_stall`/`ui_appetite_meter`) и мета (`ui_route_pass`/`ui_prize_machine`/
 * `ui_neon_builder`/collections/`ui_contest_gallery`/`ui_pet_card`/`ui_mentor`/
 * `ui_vacation_toggle`/`ui_moving_truck`) — были достижимы ТОЛЬКО через dev-дип-линк `?panel=`,
 * выключенный в проде. Итог: смонтированы, но недоступны игроку.
 *
 * РЕШЕНИЕ (минимум из плана): единый HUD-лаунчер — одна кнопка, раскрывающая индекс всех
 * смонтированных панелей; каждый пункт зовёт `openPanel(key)`. Это НЕ заменяет будущие
 * контекстные входы (POI/фасады — зона сцен/ui), а гарантирует достижимость из прод-UI прямо
 * сейчас. Живёт в зоне композиции (`src/app/**`) — единственном месте, где панели встречаются
 * со своим монтированием (`PanelHost`); переиспользует `panelTitle` оттуда (без дубля `PANEL_TITLE`).
 *
 * Лаунчер показывается только после выпуска из FTUE (`phase === 'done'`), чтобы не заслонять
 * туториальный оверлей; во время открытой панели `Modal` рисуется поверх — конфликта z нет.
 *
 * Бейдж пункта `ui_daily_specials` (`ui-daily-club`, 16-retention §3.1): «новые спецблюда
 * дня, ещё не открыты» — `useDailySpecialsUnseen` (`ui/retention/shared.ts`), тот же приём,
 * что бейдж `NotificationBell` (снимается открытием панели, не персистится).
 */

import { useEffect, useState } from 'react'
import { useStore } from '@/state'
import { useFtueStore } from '@/ui/onboarding'
import { useDailySpecialsUnseen } from '@/ui/retention'
import type { UiScreenKey } from '@/types'
import { panelTitle } from './PanelHost'

/** Core-loop панели (APP-1): то, чему учит FTUE и где крутится экономика. */
const CORE_PANELS: readonly UiScreenKey[] = [
  'ui_demand_board',
  'ui_recipe_box',
  'ui_shop',
  'ui_coop_orders',
  'ui_potluck',
  'ui_fair_stall',
  'ui_appetite_meter',
] as const

/** Мета-панели (APP-2): прогрессия, коллекции, соц-механики, миграция. */
const MORE_PANELS: readonly UiScreenKey[] = [
  'ui_expeditions',
  'ui_daily_specials',
  'ui_regulars_club',
  'ui_route_pass',
  'ui_prize_machine',
  'ui_neon_builder',
  'ui_toy_shelf',
  'ui_ribbon_wall',
  'ui_postcards',
  'ui_photo_mode',
  'ui_contest_gallery',
  'ui_pet_card',
  'ui_mentor',
  'ui_vacation_toggle',
  'ui_moving_truck',
  'ui_mail_catalog',
] as const

export function PanelLauncher() {
  const locale = useStore((s) => s.ui.locale)
  const openPanel = useStore((s) => s.openPanel)
  const phase = useFtueStore((s) => s.phase)
  const dailySpecialsUnseen = useDailySpecialsUnseen()
  const [open, setOpen] = useState(false)

  // Escape закрывает меню (как у Modal) — вешаем слушатель только пока открыто.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // До выпуска из FTUE лаунчер не показываем (туториал сам ведёт игрока).
  if (phase !== 'done') return null

  const label = locale === 'ru' ? 'Панели' : 'Panels'
  const coreLabel = locale === 'ru' ? 'Основной цикл' : 'Core loop'
  const moreLabel = locale === 'ru' ? 'Ещё' : 'More'

  const item = (key: UiScreenKey) => (
    <button
      key={key}
      type="button"
      role="menuitem"
      data-testid={`panel-launcher-item-${key}`}
      onClick={() => {
        openPanel(key)
        setOpen(false)
      }}
      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-black/10"
      style={{ color: 'var(--ink)' }}
    >
      <span>{panelTitle(key, locale)}</span>
      {key === 'ui_daily_specials' && dailySpecialsUnseen && (
        <span
          data-testid="panel-launcher-badge-ui_daily_specials"
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: 'var(--cherry)' }}
        />
      )}
    </button>
  )

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-40 flex flex-col items-end sm:bottom-4 sm:right-4">
      {open && (
        <>
          {/* Клик-вне закрывает меню. Полноэкранный, но под кнопкой/меню по DOM-порядку. */}
          <div
            className="pointer-events-auto fixed inset-0"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            aria-label={label}
            data-testid="panel-launcher-menu"
            className="pointer-events-auto relative mb-2 max-h-[60vh] w-56 overflow-y-auto rounded-xl p-2"
            style={{ background: 'var(--card)', boxShadow: 'var(--shadow-print)' }}
          >
            <p className="hud-kicker mb-1 px-2 pb-1 text-xs font-black">{coreLabel}</p>
            {CORE_PANELS.map(item)}
            <p className="hud-kicker mb-1 mt-2 px-2 pb-1 text-xs font-black">{moreLabel}</p>
            {MORE_PANELS.map(item)}
          </div>
        </>
      )}
      <button
        type="button"
        data-testid="panel-launcher"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="hud-tap-target pointer-events-auto relative flex items-center justify-center rounded-full bg-black/40 p-2 text-lg leading-none text-white/90 hover:text-white"
      >
        <span aria-hidden>🗂️</span>
      </button>
    </div>
  )
}
