/**
 * HUD — обычный DOM поверх канваса (не в 3D). Пипы недели, деньги, инвентарь,
 * выбор семени (клавиши 1/2/3), кнопка «Закончить день».
 */
import { useEffect } from 'react'
import { CROPS, useGameStore, type CropId } from '../game/store'

const CROP_EMOJI: Record<CropId, string> = { carrot: '🥕', greens: '🥬', tomato: '🍅' }
const CROP_NAME: Record<CropId, string> = { carrot: 'Морковь', greens: 'Зелень', tomato: 'Томат' }

export function HUD() {
  const day = useGameStore((s) => s.day)
  const money = useGameStore((s) => s.money)
  const phase = useGameStore((s) => s.phase)
  const inventory = useGameStore((s) => s.inventory)
  const selectedSeed = useGameStore((s) => s.selectedSeed)
  const selectSeed = useGameStore((s) => s.selectSeed)
  const endDay = useGameStore((s) => s.endDay)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1') selectSeed('carrot')
      else if (e.key === '2') selectSeed('greens')
      else if (e.key === '3') selectSeed('tomato')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectSeed])

  return (
    <div className="pointer-events-none absolute inset-0 flex select-none flex-col justify-between p-4 font-mono text-[#f0e4c9]">
      {/* верх: неделя + деньги */}
      <div className="flex items-start justify-between">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg bg-[#241a20]/70 px-3 py-2 backdrop-blur">
          {Array.from({ length: 7 }).map((_, i) => {
            const d = i + 1
            const done = d < day
            const cur = d === day
            const truck = d === 7
            return (
              <div
                key={i}
                className={`grid h-6 w-6 place-items-center rounded-full text-xs transition ${
                  cur
                    ? 'scale-110 bg-[#f4b942] text-[#241a20]'
                    : done
                      ? 'bg-[#6b8f3f]'
                      : 'bg-white/10 text-white/40'
                }`}
              >
                {truck ? '🚚' : '🌱'}
              </div>
            )
          })}
          <span className="ml-2 text-xs opacity-80">
            {phase === 'farm' ? `День ${day} из 6` : 'День 7 — Фудтрак'}
          </span>
        </div>
        <div className="pointer-events-auto rounded-lg bg-[#241a20]/70 px-4 py-2 text-lg font-bold text-[#f4b942] backdrop-blur">
          💰 {money}
        </div>
      </div>

      {/* низ: семена, инвентарь, конец дня */}
      <div className="flex items-end justify-between gap-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-[#241a20]/70 p-2 backdrop-blur">
          {CROPS.map((c, i) => (
            <button
              key={c}
              onClick={() => selectSeed(c)}
              title={CROP_NAME[c]}
              className={`flex flex-col items-center rounded-md px-3 py-1.5 text-2xl transition ${
                selectedSeed === c ? 'bg-[#9fc25f]' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <span>{CROP_EMOJI[c]}</span>
              <span className="text-[10px] opacity-70">{i + 1}</span>
            </button>
          ))}
        </div>

        <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-[#241a20]/70 px-4 py-3 backdrop-blur">
          <div className="flex gap-2 text-sm">
            {CROPS.map((c) => (
              <span key={c} className="rounded bg-white/5 px-2 py-1">
                {CROP_EMOJI[c]} {inventory[c]}
              </span>
            ))}
          </div>
          {phase === 'farm' && (
            <button
              onClick={endDay}
              className="rounded-md bg-[#6b8f3f] px-4 py-2 text-sm font-bold text-[#f0e4c9] transition hover:brightness-110"
            >
              Закончить день →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
