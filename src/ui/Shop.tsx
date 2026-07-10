/**
 * Лавка семян. Открывается, когда герой дошёл до прилавка (см. Interactions в
 * scene/Farm.tsx), поэтому «открыта ли лавка» держит стор, а не локальный
 * useState: команду подаёт сцена.
 *
 * Лавка только продаёт семена. Скупки урожая нет: весь урожай уходит в блюда,
 * а деньги приносит ярмарка.
 *
 * Кнопка недоступна, когда денег не хватает. Показывать тостом то, что видно
 * по кнопке, незачем.
 */
import { useEffect } from 'react'
import { CROPS, SEED_PRICE, useGameStore, type CropId } from '../game/store'
import { CROP_NAME } from './crops'
import { SeedPacket } from './SeedPacket'

const panel = 'rounded-lg bg-white/5'

function Row({ crop }: { crop: CropId }) {
  const seeds = useGameStore((s) => s.seeds[crop])
  const money = useGameStore((s) => s.money)
  const buySeeds = useGameStore((s) => s.buySeeds)

  const cost = SEED_PRICE[crop]
  const afford = money >= cost

  return (
    <div className={`${panel} flex flex-wrap items-center gap-3 p-3`}>
      <div className="flex min-w-36 items-center gap-2">
        <SeedPacket crop={crop} active={false} />
        <div className="flex flex-col">
          <span className="text-sm">{CROP_NAME[crop]}</span>
          <span className="text-[10px] opacity-50">семян: {seeds}</span>
        </div>
      </div>

      <button
        disabled={!afford}
        onClick={() => buySeeds(crop, 1)}
        title={afford ? `Одно семя за ${cost}` : 'Не хватает денег'}
        className="ml-auto rounded bg-[#6b8f3f] px-3 py-2 text-xs font-bold text-[#f0e4c9] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/30"
      >
        Купить ×1 · {cost}💰
      </button>
    </div>
  )
}

export function Shop() {
  const money = useGameStore((s) => s.money)
  const closeShop = useGameStore((s) => s.closeShop)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeShop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeShop])

  return (
    <div
      onClick={closeShop}
      className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-[#241a33]/70"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-[34rem] max-w-[94vw] flex-col gap-3 rounded-xl border-2 border-[#f4b942] bg-[#241a20] p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#f4b942]">Лавка семян</h2>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-[#f4b942]">💰 {money}</span>
            <button
              onClick={closeShop}
              className="rounded px-2 py-0.5 text-xs opacity-60 transition hover:opacity-100"
            >
              Esc ✕
            </button>
          </div>
        </div>

        {CROPS.map((c) => (
          <Row key={c} crop={c} />
        ))}

        <p className="text-[10px] leading-relaxed opacity-40">
          Деньги приносит только ярмарка: урожай не скупают, его пускают на блюда.
        </p>
      </div>
    </div>
  )
}
