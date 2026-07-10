/**
 * HudRoot.tsx — DOM-оверлей поверх канваса (21-client §5, зона `hud-nav`).
 *
 * Композиция: верхний marquee (бренд, плашка дня+таймер, валюты×4, Farm Value,
 * колокол нотификаций, net-плашка), нижняя навигация сцен по фазе, тост-стек,
 * единый модальный каркас (`OverlayHost`/`Modal`), dev-таймскип.
 *
 * Полные экраны/панели других контекстов (Farm/Kitchen/Fair/…) строят их
 * ui-агенты поверх того же `Modal` (`./Modal.tsx`) — см. `OverlayHost.tsx`.
 * `data-testid` — якоря для Playwright-смоуков (AGENTS.md §4).
 *
 * AUDIO-WIRING: звуковая шина (`app/soundBridge.ts` — музыка по сцене/фазе, эмбиент ночи,
 * вехи ивента, крафт-готово, смена фазы недели, синк громкости) запускается здесь, один
 * раз на монтирование HUD (единственный корень, живёт всё приложение) — не в `App.tsx`,
 * чтобы не трогать композиционный файл вне зоны audio-wiring (AGENTS.md §2/§6).
 */

import { useEffect } from 'react'
import './tokens.css'
import { useStore } from '@/state'
import { CurrencyBar } from './CurrencyBar'
import { DayPhaseBanner } from './DayPhaseBanner'
import { NotificationBell } from './NotificationBell'
import { SoundSettingsButton } from './SoundSettingsButton'
import { SoundSettingsPanel } from './SoundSettingsPanel'
import { ChatLauncher } from '@/ui/chat'
import { NetPlaque } from './NetPlaque'
import { BottomNav } from './BottomNav'
import { ToastStack } from './ToastStack'
import { OverlayHost } from './OverlayHost'
import { DevTimeskip } from './DevTimeskip'
import { initSoundBridge } from '@/app/soundBridge'

export function HudRoot() {
  const scene = useStore((s) => s.scene.active)

  useEffect(() => initSoundBridge(), [])

  return (
    <div
      className={
        'pointer-events-none absolute inset-0 flex flex-col justify-between ' +
        // Safe-area (19-ui-ux §4.4): базовый паддинг (совпадает с прежним p-3/sm:p-4), но
        // растёт под чёлку/жест-бар/home-indicator, где он есть (`env(...)`, требует
        // `viewport-fit=cover`, index.html). На устройствах без выреза `max()` даёт тот же p-3.
        'pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] ' +
        'pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] ' +
        'sm:pt-[max(1rem,env(safe-area-inset-top))] sm:pb-[max(1rem,env(safe-area-inset-bottom))] ' +
        'sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]'
      }
    >
      {/* Верхний ряд: бренд + плашка дня + валюты + колокол + net-плашка */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1
            data-testid="brand"
            className="pointer-events-none select-none text-2xl font-black tracking-wide"
            style={{ color: 'var(--board-ink)', textShadow: '0 2px 0 rgba(0,0,0,.35)' }}
          >
            Sunnyside
          </h1>
          <DayPhaseBanner />
        </div>
        {/*
         * `flex-wrap` + `justify-end`: на узких телефонных вьюпортах (xs 360–599px, §4.4)
         * валюты×4 + Farm Value + 3 иконки + net-плашка + dev-таймскип (dev-only) не влезают в
         * одну строку — без wrap правая группа раздувала страницу за пределы вьюпорта
         * (горизонтальный скролл, найдено `e2e/mobile.spec.ts`). С wrap она сама переносится на
         * вторую строку под брендом, а не толкает документ вширь.
         */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <CurrencyBar />
          <ChatLauncher />
          <NotificationBell />
          <SoundSettingsButton />
          <NetPlaque />
          <DevTimeskip />
        </div>
      </div>

      {/* Нижний ряд: переключатель сцен (прод-навигация = стор, не URL) */}
      <BottomNav />

      {/* Оверлеи: тосты (не блокируют) + модальный каркас (блокирует, поверх сцены). */}
      <ToastStack />
      <OverlayHost />
      <SoundSettingsPanel />

      {/* Скрытый якорь для смоуков, читающих активную сцену без доступа к стору. */}
      <span data-testid="active-scene" className="hidden">
        {scene}
      </span>
    </div>
  )
}
