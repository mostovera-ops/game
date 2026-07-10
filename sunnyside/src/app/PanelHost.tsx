/**
 * app/PanelHost.tsx — монтирование ВСЕХ канон-панелей (`ui_*`) в единый модальный
 * каркас (`Modal`), управляемый одним источником истины `ui.activePanel` (интегратор C3).
 *
 * ПОЧЕМУ ЗДЕСЬ, А НЕ В HudRoot: каждая панель принадлежит своей ui-зоне и требует
 * СВОЙ System-провайдер (`ui/` не собирает системы — граница). Композиция (`src/app/**`)
 * — единственное место, где панели встречаются со своими системами (`SystemsProvider`),
 * поэтому здесь. `ui_notif_log` НЕ дублируем — он уже смонтирован в `HudRoot/OverlayHost`.
 *
 * Каждая Modal рендерит `null`, пока `activePanel !== panelKey` (см. `Modal`), поэтому
 * держать их все смонтированными дёшево — открыта максимум одна (правило навигации #2).
 *
 * `ui_shift` — ОСОБЫЙ СЛУЧАЙ: тоже унифицирован на `Modal`/`ui.activePanel` (modal-unify), но
 * своя Modal смонтирована не здесь, а в `ui/shift/ShiftHost` (варинт `fullscreen`), которую
 * сцена ярмарки монтирует через `<Html>` (`scene/fair/FairScene.tsx`) — панель-мини-геймплей
 * требует полноэкранного DOM-дерева поверх канваса, а не карточки в этом хосте. Источник
 * истины по-прежнему один (`ui.activePanel === 'ui_shift'`), крестик/Escape/«Назад»/z-порядок
 * — из общего `Modal`, дип-линк `?panel=ui_shift` работает как у остальных панелей.
 *
 * Панели без готового компонента в текущем скоупе (`ui_daily_specials`/`ui_moving_truck`/
 * `ui_regulars_club`/`ui_expeditions`) пока не монтируются — их заведут профильные ui-агенты
 * (TODO(c3) в их зонах).
 *
 * FARM-UI-SEAMS: `ui_recipe_box` теперь хостит K1 Machine Queues + K2 Recipe Box
 * (`KitchenPanel` ниже) — раньше был смонтирован только K2, а K1 не был достижим из
 * running app. F1 Seed Picker (`SeedPicker`) и F4 Storage (`StorageHost`) — контекстные
 * `SHEET` без canon-ключа (см. их докстринги) — не через `Modal`/`activePanel`, но
 * смонтированы здесь же (композиция — единственное место, где панели встречают системы).
 *
 * УСТОЙЧИВОСТЬ (интегратор C3):
 *  - ВСЕ Modal смонтированы С НАЧАЛА (неактивные = `null` внутри), поэтому дип-линк/клик
 *    лишь ПЕРЕКЛЮЧАЕТ `active` уже смонтированной Modal — а не монтирует её «сразу
 *    активной». Это важно: маунт-с-active=true в StrictMode двойным прогоном history-эффекта
 *    Modal (`history.back()`→popstate) сам бы себя закрыл. Не гейтим PanelHost по гидрации:
 *    корневой источник «infinite loop» (нестабильные `?? {}`/`?? []` селекторы) починен
 *    в самих панелях (стабильные пустые ссылки, TODO(c3) там же).
 *  - ГРАНИЦА ОШИБКИ: каждая панель обёрнута в `PanelBoundary` — исключение внутри одной
 *    панели показывает тёплый фолбэк, а не гасит весь HUD/сцену.
 */

import { Component, useEffect, useState, type ReactNode } from 'react'
import { useStore } from '@/state'
import { Modal } from '@/ui/hud/Modal'
import type { Bilingual, Locale, UUID, UiScreenKey } from '@/types'
import { MachineQueues, RecipeBox } from '@/ui/kitchen'
import { StorageOverlay } from '@/ui/inventory'
import { SeedPicker } from '@/ui/farm'
import { useBuildingsSystem } from '@/ui/progression'
import { DemandBoardScreen, FairStall } from '@/ui/market'
import { CoopOrders, Potluck } from '@/ui/orders'
import { ContributionLedger } from '@/ui/event'
import { ShopHome, RoutePass, PrizeMachine } from '@/ui/shop'
import { ToyShelf, RibbonWall, Postcards, NeonBuilder, PhotoMode } from '@/ui/collections'
import { getAdapter } from './backend'

/** Заголовки панелей (letterboard-kicker, 19-ui-ux §3.0). RU/EN. */
const PANEL_TITLE: Partial<Record<UiScreenKey, Bilingual>> = {
  ui_shop: { en: 'Shop', ru: 'Лавка' },
  ui_demand_board: { en: 'Demand Board', ru: 'Доска спроса' },
  ui_coop_orders: { en: 'Co-op Orders', ru: 'Кооп-заказы' },
  ui_recipe_box: { en: 'Recipe Box', ru: 'Картотека рецептов' },
  ui_fair_stall: { en: 'Fair Stall', ru: 'Прилавок ярмарки' },
  ui_appetite_meter: { en: 'Grimsby’s Appetite', ru: 'Аппетит Гримсби' },
  ui_prize_machine: { en: 'Prize Machine', ru: 'Автомат призов' },
  ui_neon_builder: { en: 'Neon Builder', ru: 'Неоновая вывеска' },
  ui_route_pass: { en: 'Route Pass', ru: 'Дорожный пропуск' },
  ui_photo_mode: { en: 'Photo Mode', ru: 'Фото-режим' },
  ui_toy_shelf: { en: 'Toy Shelf', ru: 'Полка игрушек' },
  ui_ribbon_wall: { en: 'Ribbon Wall', ru: 'Стена лент' },
  ui_postcards: { en: 'Postcards', ru: 'Открытки' },
  ui_potluck: { en: 'Potluck', ru: 'Общий стол' },
}

function title(key: UiScreenKey, locale: Locale): string {
  const b = PANEL_TITLE[key]
  return b ? (locale === 'ru' ? b.ru : b.en) : key
}

/** Достаёт смонтированный canvas сцены для фото-режима (единственный <canvas> App). */
function sceneCanvas(): HTMLCanvasElement | null {
  return typeof document === 'undefined' ? null : document.querySelector('canvas')
}

/**
 * Граница ошибки одной панели: ловит исключение внутри контента, показывает тёплый
 * фолбэк вместо гашения всего дерева. `resetKey` (активная панель) сбрасывает границу
 * при смене панели — прошлая ошибка не «залипает».
 */
class PanelBoundary extends Component<
  { resetKey: UiScreenKey | null; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidUpdate(prev: { resetKey: UiScreenKey | null }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="p-4 text-center text-sm opacity-80" style={{ color: 'var(--board-ink, #333)' }}>
          Панель прилегла отдохнуть. Закрой и открой снова — всё вернётся.
        </div>
      )
    }
    return this.props.children
  }
}

/**
 * KitchenPanel — единая Kitchen-панель (canon `ui_recipe_box`, farm-ui-seams): хостит
 * K1 Machine Queues И K2 Recipe Box в одном модальном каркасе — Kitchen/K1 не имеет
 * ОТДЕЛЬНОГО canon-ключа (AGENTS.md §0.7, не выдумываем ключ сущности без PR в
 * `00-canon.md`), поэтому обе панели кухни живут под единственным существующим
 * `ui_recipe_box`, переключаясь локальным видом.
 *
 * Клик по станку в сцене (`Machines.tsx` → `useFarmActions().openKitchen(machineId)` →
 * `ui.kitchenMachineId`) открывает панель на K1 с подсветкой его строки (§MachineQueues
 * `focusMachineId`). «Queue dish» в K1 — переключает на K2, отфильтрованную под этот
 * станок (`RecipeBox.machineId`, уже поддерживалось); «Закрыть» в К2 возвращает к K1
 * (крестик самой Modal — единственный, кто закрывает панель целиком).
 */
function KitchenPanel() {
  const activePanel = useStore((s) => s.ui.activePanel)
  const kitchenMachineId = useStore((s) => s.ui.kitchenMachineId)
  const [view, setView] = useState<'queues' | 'recipes'>('queues')
  const [recipeMachineId, setRecipeMachineId] = useState<UUID | undefined>(undefined)

  // Каждое (пере)открытие панели — заново с обзора очередей (K1), не залипаем на прошлом K2.
  useEffect(() => {
    if (activePanel === 'ui_recipe_box') {
      setView('queues')
      setRecipeMachineId(undefined)
    }
  }, [activePanel])

  if (view === 'recipes') {
    return <RecipeBox machineId={recipeMachineId} onClose={() => setView('queues')} />
  }
  return (
    <MachineQueues
      focusMachineId={kitchenMachineId}
      onQueueDish={(machineId) => {
        setRecipeMachineId(machineId)
        setView('recipes')
      }}
    />
  )
}

/**
 * StorageHost — F4 Storage (farm-ui-seams): клик по Silo/Icehouse в сцене
 * (`Buildings.tsx` → `useFarmActions().openStorage()` → `ui.storageOpen`) открывает эту
 * карточку. F4 — контекстный `POI → SHEET` без canon `ui_*` ключа (как F1 Seed Picker,
 * см. `ui/farm/SeedPicker.tsx`) — самостоятельный backdrop, не через общий `Modal`/
 * `ui.activePanel`. Upgrade — через `BuildingsSystem` (тот же узкий срез `FarmSystem`,
 * что и F3 Building Upgrade); Gift/Potluck compose — отдельный шов (не в этом скоупе).
 */
function StorageHost() {
  const open = useStore((s) => s.ui.storageOpen)
  const buildingsSystem = useBuildingsSystem()
  const close = () => useStore.getState().setStorageOpen(false)

  if (!open) return null

  return (
    <div
      data-testid="modal-ui_storage"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center"
      onClick={close}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <StorageOverlay
          onClose={close}
          onUpgrade={(kind) => void buildingsSystem.upgradeBuilding(kind === 'silo' ? 'bld_silo' : 'bld_icehouse')}
        />
      </div>
    </div>
  )
}

export function PanelHost() {
  const locale = useStore((s) => s.ui.locale)
  const activePanel = useStore((s) => s.ui.activePanel)
  const close = () => useStore.getState().openPanel(null)
  const t = (k: UiScreenKey) => title(k, locale)

  /** Modal + граница ошибки одним хелпером (единый стиль для всех панелей). */
  const panel = (key: UiScreenKey, node: ReactNode, variant?: 'overlay' | 'sheet') => (
    <Modal panelKey={key} title={t(key)} variant={variant}>
      <PanelBoundary resetKey={activePanel}>{node}</PanelBoundary>
    </Modal>
  )

  return (
    <>
      {panel('ui_shop', <ShopHome />, 'sheet')}
      {panel('ui_demand_board', <DemandBoardScreen />)}
      {panel('ui_coop_orders', <CoopOrders />)}
      {panel('ui_potluck', <Potluck />)}
      {panel('ui_recipe_box', <KitchenPanel />)}
      {panel('ui_fair_stall', <FairStall />)}
      {panel('ui_appetite_meter', <ContributionLedger />)}
      {panel('ui_prize_machine', <PrizeMachine />)}
      {panel('ui_route_pass', <RoutePass />, 'sheet')}
      {panel('ui_neon_builder', <NeonBuilder onClose={close} onSaved={close} />)}
      {panel('ui_toy_shelf', <ToyShelf onClose={close} />)}
      {panel('ui_ribbon_wall', <RibbonWall onClose={close} />)}
      {panel('ui_postcards', <Postcards onClose={close} />)}
      {panel(
        'ui_photo_mode',
        <PhotoMode
          getCanvas={sceneCanvas}
          onUpload={async (blob) => {
            const res = await getAdapter().photoUpload({ image: blob })
            return res.ok ? { url: res.data.url } : null
          }}
          onClose={close}
        />,
      )}

      {/* F1 Seed Picker / F4 Storage — контекстные SHEET без canon-ключа (см. докстринги
          `SeedPicker`/`StorageHost` выше): свои backdrop'ы, не через `Modal`/`activePanel`. */}
      <SeedPicker />
      <StorageHost />
    </>
  )
}
