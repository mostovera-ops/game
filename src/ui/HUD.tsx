/**
 * HUD — обычный DOM поверх канваса. В фазе фермы: пипы недели, деньги,
 * инвентарь, выбор семени (1/2/3), «Закончить день». В фазе фудтрака:
 * таймер, очередь клиентов, кнопки блюд (1/2/3), итог недели.
 */
import { useEffect } from 'react'
import {
  CROPS,
  RECIPE_IDS,
  RECIPES,
  useGameStore,
  type CropId,
  type RecipeId,
} from '../game/store'

const CROP_EMOJI: Record<CropId, string> = { carrot: '🥕', greens: '🥬', tomato: '🍅' }
const CROP_NAME: Record<CropId, string> = { carrot: 'Морковь', greens: 'Зелень', tomato: 'Томат' }
const RECIPE_EMOJI: Record<RecipeId, string> = { salad: '🥗', soup: '🍲', taco: '🌮' }
const RECIPE_NAME: Record<RecipeId, string> = { salad: 'Салат', soup: 'Суп', taco: 'Тако' }

const panel = 'pointer-events-auto rounded-lg bg-[#241a20]/70 backdrop-blur'

function WeekBar() {
  const day = useGameStore((s) => s.day)
  const phase = useGameStore((s) => s.phase)
  const money = useGameStore((s) => s.money)
  return (
    <div className="flex items-start justify-between">
      <div className={`${panel} flex items-center gap-1.5 px-3 py-2`}>
        {Array.from({ length: 7 }).map((_, i) => {
          const d = i + 1
          const cur = d === day
          const done = d < day
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
              {d === 7 ? '🚚' : '🌱'}
            </div>
          )
        })}
        <span className="ml-2 text-xs opacity-80">
          {phase === 'farm' ? `День ${day} из 6` : 'День 7 — Фудтрак'}
        </span>
      </div>
      <div className={`${panel} px-4 py-2 text-lg font-bold text-[#f4b942]`}>💰 {money}</div>
    </div>
  )
}

function FarmControls() {
  const inventory = useGameStore((s) => s.inventory)
  const selectedSeed = useGameStore((s) => s.selectedSeed)
  const tool = useGameStore((s) => s.tool)
  const selectSeed = useGameStore((s) => s.selectSeed)
  const selectTool = useGameStore((s) => s.selectTool)
  const endDay = useGameStore((s) => s.endDay)

  return (
    <div className="flex items-end justify-between gap-3">
      <div className={`${panel} flex items-center gap-2 p-2`}>
        {CROPS.map((c, i) => (
          <button
            key={c}
            onClick={() => selectSeed(c)}
            title={CROP_NAME[c]}
            className={`flex flex-col items-center rounded-md px-3 py-1.5 text-2xl transition ${
              tool === 'seed' && selectedSeed === c
                ? 'bg-[#9fc25f]'
                : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <span>{CROP_EMOJI[c]}</span>
            <span className="text-[10px] opacity-70">{i + 1}</span>
          </button>
        ))}

        <div className="mx-1 h-10 w-px bg-white/15" />

        <button
          onClick={() => selectTool('can')}
          title="Лейка — полить росток"
          className={`flex flex-col items-center rounded-md px-3 py-1.5 text-2xl transition ${
            tool === 'can' ? 'bg-[#6db3f2]' : 'bg-white/5 hover:bg-white/10'
          }`}
        >
          <span>💧</span>
          <span className="text-[10px] opacity-70">4</span>
        </button>
      </div>

      <div className={`${panel} flex items-center gap-3 px-4 py-3`}>
        <div className="flex gap-2 text-sm">
          {CROPS.map((c) => (
            <span key={c} className="rounded bg-white/5 px-2 py-1">
              {CROP_EMOJI[c]} {inventory[c]}
            </span>
          ))}
        </div>
        <button
          onClick={endDay}
          className="rounded-md bg-[#6b8f3f] px-4 py-2 text-sm font-bold text-[#f0e4c9] transition hover:brightness-110"
        >
          Закончить день →
        </button>
      </div>
    </div>
  )
}

function TruckQueue() {
  const queue = useGameStore((s) => s.truck?.queue ?? [])
  const timeLeft = useGameStore((s) => s.truck?.timeLeft ?? 0)
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`${panel} px-4 py-1.5 text-sm`}>
        ⏱ {Math.ceil(timeLeft)}с
      </div>
      <div className="flex gap-3">
        {queue.map((c, i) => {
          const pct = Math.max(0, c.patience / c.maxPatience)
          return (
            <div key={i} className={`${panel} flex flex-col items-center gap-1 px-3 py-2`}>
              <span className="text-2xl">{RECIPE_EMOJI[c.want]}</span>
              <div className="h-1.5 w-10 overflow-hidden rounded bg-black/40">
                <div
                  className="h-full rounded"
                  style={{ width: `${pct * 100}%`, background: pct > 0.4 ? '#9fc25f' : '#d1453a' }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TruckControls() {
  const inventory = useGameStore((s) => s.inventory)
  const serveCustomer = useGameStore((s) => s.serveCustomer)
  return (
    <div className="flex items-end justify-between gap-3">
      <div className={`${panel} flex items-center gap-2 p-2`}>
        {RECIPE_IDS.map((r, i) => (
          <button
            key={r}
            onClick={() => serveCustomer(r)}
            title={RECIPE_NAME[r]}
            className="flex items-center gap-2 rounded-md bg-[#ff8b5e]/80 px-3 py-2 text-sm font-bold text-[#241a20] transition hover:brightness-110"
          >
            <span className="text-xl">{RECIPE_EMOJI[r]}</span>
            <span>
              {RECIPE_NAME[r]} · {RECIPES[r].price}💰
            </span>
            <span className="text-[10px] opacity-70">{i + 1}</span>
          </button>
        ))}
      </div>
      <div className={`${panel} flex gap-2 px-4 py-3 text-sm`}>
        {CROPS.map((c) => (
          <span key={c} className="rounded bg-white/5 px-2 py-1">
            {CROP_EMOJI[c]} {inventory[c]}
          </span>
        ))}
      </div>
    </div>
  )
}

function WeekSummary() {
  const truck = useGameStore((s) => s.truck)
  const money = useGameStore((s) => s.money)
  const nextWeek = useGameStore((s) => s.nextWeek)
  if (!truck?.ended) return null
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-[#241a33]/80">
      <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-[#f4b942] bg-[#241a20] px-10 py-8 text-center">
        <h2 className="text-xl font-bold uppercase tracking-wide text-[#f4b942]">Конец недели</h2>
        <p className="text-sm">
          Обслужено клиентов: <b>{truck.served}</b>
        </p>
        <p className="text-2xl font-bold text-[#ff8b5e]">💰 {money}</p>
        <button
          onClick={nextWeek}
          className="mt-1 rounded-md bg-[#6b8f3f] px-5 py-2 text-sm font-bold text-[#f0e4c9] transition hover:brightness-110"
        >
          Новая неделя →
        </button>
      </div>
    </div>
  )
}

export function HUD() {
  const phase = useGameStore((s) => s.phase)
  const selectSeed = useGameStore((s) => s.selectSeed)
  const selectTool = useGameStore((s) => s.selectTool)
  const serveCustomer = useGameStore((s) => s.serveCustomer)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '4') {
        if (phase === 'farm') selectTool('can') // лейка есть только на ферме
        return
      }
      const idx = { '1': 0, '2': 1, '3': 2 }[e.key]
      if (idx === undefined) return
      if (phase === 'farm') selectSeed(CROPS[idx])
      else serveCustomer(RECIPE_IDS[idx])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, selectSeed, selectTool, serveCustomer])

  return (
    <div className="pointer-events-none absolute inset-0 flex select-none flex-col justify-between p-4 font-mono text-[#f0e4c9]">
      <WeekBar />
      {phase === 'truck' && <TruckQueue />}
      {phase === 'farm' ? <FarmControls /> : <TruckControls />}
      <WeekSummary />
    </div>
  )
}
