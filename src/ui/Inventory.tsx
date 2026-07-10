/**
 * Инвентарь героя — модалка по клавише E: портрет, выбор цвета одежды и сумка.
 *
 * Открытость держит HUD в useState, а не стор: это состояние экрана, а не игры,
 * и в localStorage ему делать нечего. Цвет, наоборот, персистится стором —
 * герой должен остаться перекрашенным после перезагрузки.
 */
import { useEffect } from 'react'
import { CROPS, HERO_COLORS, useGameStore } from '../game/store'
import { CROP_EMOJI, CROP_NAME } from './crops'
import { HeroPortrait } from './HeroPortrait'

export function Inventory({ onClose }: { onClose: () => void }) {
  const inventory = useGameStore((s) => s.inventory)
  const seeds = useGameStore((s) => s.seeds)
  const money = useGameStore((s) => s.money)
  const heroColor = useGameStore((s) => s.heroColor)
  const setHeroColor = useGameStore((s) => s.setHeroColor)

  // Escape закрывает; E ловится в HUD, чтобы одна клавиша и открывала, и закрывала.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-[#241a33]/70"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-[34rem] max-w-[92vw] flex-col gap-5 rounded-xl border-2 border-[#f4b942] bg-[#241a20] p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#f4b942]">Инвентарь</h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-0.5 text-xs opacity-60 transition hover:opacity-100"
          >
            E / Esc ✕
          </button>
        </div>

        <div className="flex gap-6">
          <div className="grid h-44 w-36 shrink-0 place-items-center rounded-lg bg-[#3b4a2e]">
            <HeroPortrait color={heroColor} className="h-40" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-[9px] uppercase tracking-wide opacity-50">Цвет одежды</span>
              <div className="flex flex-wrap gap-2">
                {HERO_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setHeroColor(c)}
                    title={c}
                    style={{ background: c }}
                    className={`h-8 w-8 rounded-full border-2 transition hover:scale-110 ${
                      c === heroColor ? 'border-[#f4b942]' : 'border-white/20'
                    }`}
                  />
                ))}
                {/* Пипетка: восемь кнопок — быстрый выбор, а не потолок. */}
                <label
                  title="Свой цвет"
                  className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border-2 border-dashed border-white/30 text-xs transition hover:scale-110"
                >
                  🎨
                  <input
                    type="color"
                    value={heroColor}
                    onChange={(e) => setHeroColor(e.target.value)}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[9px] uppercase tracking-wide opacity-50">
                Сумка — урожай и семена
              </span>
              <div className="flex flex-wrap gap-2">
                {CROPS.map((c) => (
                  <div
                    key={c}
                    title={`${CROP_NAME[c]}: урожай ${inventory[c]}, семян ${seeds[c]}`}
                    className="flex items-center gap-2 rounded bg-white/5 px-3 py-2 text-sm"
                  >
                    <span>{CROP_EMOJI[c]}</span>
                    <span className="font-bold">{inventory[c]}</span>
                    <span className="opacity-40">·</span>
                    <span className="opacity-60">🌱 {seeds[c]}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 rounded bg-white/5 px-3 py-2 text-sm font-bold text-[#f4b942]">
                  💰 {money}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
