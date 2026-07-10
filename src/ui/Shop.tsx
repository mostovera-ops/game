/**
 * Лавка семян — торговый интерфейс. Открывается, когда герой дошёл до прилавка
 * (см. Interactions в scene/Farm.tsx), поэтому «открыта ли лавка» держит стор,
 * а не локальный useState: команду подаёт сцена.
 *
 * Две колонки одной строки: слева лавка продаёт семена, справа скупает урожай.
 * Цены разведены (купить дороже, чем продать) — обратный прогон денег через
 * лавку невозможен, см. SEED_PRICE / SELL_PRICE в game/store.ts.
 *
 * Кнопка недоступна, когда сделка не состоится: нет денег на покупку, нет
 * урожая на продажу. Отказ показывать тостом то, что видно по кнопке, незачем.
 */
import { useEffect } from 'react'
import {
  CROPS,
  SEED_PRICE,
  SELL_PRICE,
  useGameStore,
  type CropId,
} from '../game/store'
import { CROP_EMOJI, CROP_NAME } from './crops'
import { SeedPacket } from './SeedPacket'

/** Сколько берут за раз. Пачка по три — ровно грядка. */
const BUY_LOTS = [1, 3] as const

const panel = 'rounded-lg bg-white/5'

function Row({ crop }: { crop: CropId }) {
  const seeds = useGameStore((s) => s.seeds[crop])
  const harvest = useGameStore((s) => s.inventory[crop])
  const money = useGameStore((s) => s.money)
  const buySeeds = useGameStore((s) => s.buySeeds)
  const sellCrops = useGameStore((s) => s.sellCrops)

  return (
    <div className={`${panel} flex flex-wrap items-center gap-3 p-3`}>
      <div className="flex min-w-36 items-center gap-2">
        <SeedPacket crop={crop} active={false} />
        <div className="flex flex-col">
          <span className="text-sm">{CROP_NAME[crop]}</span>
          <span className="text-[10px] opacity-50">
            семян: {seeds} · урожай: {harvest}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wide opacity-50">купить</span>
        {BUY_LOTS.map((qty) => {
          const cost = SEED_PRICE[crop] * qty
          const afford = money >= cost
          return (
            <button
              key={qty}
              disabled={!afford}
              onClick={() => buySeeds(crop, qty)}
              title={afford ? `${qty} шт. за ${cost}` : 'Не хватает денег'}
              className="rounded bg-[#6b8f3f] px-2.5 py-1.5 text-xs font-bold text-[#f0e4c9] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/30"
            >
              ×{qty} · {cost}💰
            </button>
          )
        })}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wide opacity-50">продать</span>
        <button
          disabled={harvest < 1}
          onClick={() => sellCrops(crop, 1)}
          title={harvest ? `Отдать 1 за ${SELL_PRICE[crop]}` : 'Нечего продавать'}
          className="rounded bg-[#f4b942] px-2.5 py-1.5 text-xs font-bold text-[#241a20] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/30"
        >
          {CROP_EMOJI[crop]} ×1 · +{SELL_PRICE[crop]}💰
        </button>
      </div>
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
        className="flex w-[40rem] max-w-[94vw] flex-col gap-3 rounded-xl border-2 border-[#f4b942] bg-[#241a20] p-6"
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
          Урожай выгоднее пустить на блюда: морковь в супе стоит втрое дороже, чем на прилавке.
          Продавайте, только чтобы дотянуть до новых семян.
        </p>
      </div>
    </div>
  )
}
