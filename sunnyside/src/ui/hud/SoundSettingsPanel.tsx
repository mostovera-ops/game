/**
 * SoundSettingsPanel.tsx — «Настройки звука» (audio-wiring, 22-av §5 «Три независимых
 * слайдера: Музыка / SFX / Ambient»). Экран `ui_settings` ещё не заведён в File Map канона
 * (00-canon.md, 22-av §5/§9 п.8 — открытый вопрос), поэтому это НЕ `Modal`/`ui_*`-панель
 * (AGENTS.md §0.7 — не выдумываем canon-ключ), а контекстный оверлей своего backdrop'а —
 * тот же паттерн, что F4 Storage (`../hud/HudRoot`→`ui.storageOpen`, см. `app/PanelHost.tsx`
 * `StorageHost`): `ui.soundSettingsOpen` + `setSoundSettingsOpen`, свой независимый крестик.
 *
 * Значения слайдеров пишутся в `ui.volume` (persist whitelist, `state/index.ts`) — реальное
 * применение к шинам Web Audio ведёт `app/soundBridge.ts` (подписка на этот же стор-путь),
 * этот компонент НЕ ходит в `assets/placeholders/sound` напрямую (ui — только стор).
 */

import { useStore } from '@/state'
import type { VolumeSettings } from '@/state/ui'

const SLIDER_ROWS: { bus: keyof VolumeSettings; ru: string; en: string; icon: string }[] = [
  { bus: 'music', ru: 'Музыка', en: 'Music', icon: '🎵' },
  { bus: 'sfx', ru: 'Звуки', en: 'SFX', icon: '🔔' },
  { bus: 'ambient', ru: 'Эмбиент', en: 'Ambient', icon: '🌙' },
]

export function SoundSettingsPanel() {
  const open = useStore((s) => s.ui.soundSettingsOpen)
  const locale = useStore((s) => s.ui.locale)
  const volume = useStore((s) => s.ui.volume)
  const setVolume = useStore((s) => s.setVolume)
  const close = () => useStore.getState().setSoundSettingsOpen(false)

  if (!open) return null
  const ru = locale === 'ru'

  return (
    <div
      data-testid="modal-ui_sound_settings"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ru ? 'Настройки звука' : 'Sound settings'}
        className="hud-receipt pointer-events-auto w-full max-w-sm rounded-t-2xl p-4 md:m-4 md:rounded-[var(--radius-diner)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hud-kicker mb-3 flex items-center justify-between pb-2 text-sm">
          <span>{ru ? 'Настройки звука' : 'Sound settings'}</span>
          <button
            type="button"
            data-testid="modal-close-ui_sound_settings"
            aria-label="Close"
            onClick={close}
            className="rounded-full px-2 text-base leading-none opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {SLIDER_ROWS.map((row) => (
            <label key={row.bus} className="flex flex-col gap-1 text-sm" style={{ color: 'var(--ink)' }}>
              <span className="flex items-center justify-between">
                <span>
                  <span aria-hidden>{row.icon}</span> {ru ? row.ru : row.en}
                </span>
                <span className="tabular-nums opacity-70">{Math.round(volume[row.bus] * 100)}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(volume[row.bus] * 100)}
                data-testid={`sound-volume-${row.bus}`}
                onChange={(e) => setVolume(row.bus, Number(e.target.value) / 100)}
                style={{ accentColor: 'var(--cherry)' }}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
