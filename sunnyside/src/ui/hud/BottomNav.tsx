/**
 * BottomNav.tsx — нижняя навигация сцен (19-ui-ux §3.1 S2 bottom action-dock,
 * упрощённо до Farm/Town/Fair для текущего v0.2-скоупа клиента: `Kitchen`/`Diner`/
 * `Collection` — отдельные табы каталога §4.2, вне скоупа зоны `hud-nav`).
 *
 * Ярмарка «по фазе» (задача зоны): кнопка Fair видна всегда (без наказания —
 * P3), но приглушена вне окна ярмарки (`isWindowOpen`, чистая функция
 * `engine/clock` — не дублируем расчёт окна). Клик работает всегда — экран
 * Fairground сам показывает E-состояние «готовится» вне окна (19-ui-ux U3).
 */

import { useStore } from '@/state'
import { isWindowOpen } from '@/engine/clock'
import { useSound } from '@/ui/useSound'
import { NAV_SCENES, NAV_SCENE_LABEL, pick } from './labels'

export function BottomNav() {
  const active = useStore((s) => s.scene.active)
  const goto = useStore((s) => s.goto)
  const calendar = useStore((s) => s.clock.calendar)
  const serverNow = useStore((s) => s.serverNow)
  const locale = useStore((s) => s.ui.locale)
  const sound = useSound()

  const fairOpen = calendar ? isWindowOpen(calendar.fairWindow, serverNow()) : true

  return (
    <nav
      data-testid="scene-switch"
      className="hud-marquee pointer-events-auto flex gap-2 self-center rounded-full p-1.5"
    >
      {NAV_SCENES.map((key) => {
        const muted = key === 'fair' && !fairOpen
        const isActive = active === key
        return (
          <button
            key={key}
            data-testid={`scene-btn-${key}`}
            onClick={() => {
              sound.play('ui_click')
              goto(key)
            }}
            className={
              'rounded-full px-4 py-1.5 text-sm font-semibold transition ' +
              (isActive
                ? 'text-white'
                : muted
                  ? 'text-white/40 hover:text-white/60'
                  : 'text-white/70 hover:text-white')
            }
            style={isActive ? { background: 'var(--cherry)' } : undefined}
          >
            {pick(NAV_SCENE_LABEL[key], locale)}
          </button>
        )
      })}
    </nav>
  )
}
