/**
 * SoundSettingsButton.tsx — иконка-переключатель панели громкости (audio-wiring, 22-av §5).
 * Тот же визуальный паттерн, что `NotificationBell` (круглая кнопка в marquee) — открывает
 * `SoundSettingsPanel` (свой backdrop, не canon `Modal`, см. её докстринг).
 */

import { useStore } from '@/state'

export function SoundSettingsButton() {
  const open = useStore((s) => s.setSoundSettingsOpen)

  return (
    <button
      type="button"
      data-testid="sound-settings-btn"
      aria-label="Sound settings"
      onClick={() => open(true)}
      className="pointer-events-auto rounded-full bg-black/40 p-2 text-lg leading-none text-white/90 hover:text-white"
    >
      <span aria-hidden>🔊</span>
    </button>
  )
}
