/**
 * HUD — обычный DOM поверх канваса.
 *
 * Внизу единый тулбар героя: чем он действует (пакетики семян, лейка, рука)
 * и что у него в сумке (собранные ресурсы). Раньше семена и инвентарь жили в
 * разных углах экрана, хотя это одна и та же «экипировка».
 *
 * Сверху — неделя и деньги, справа внизу — действие фазы: закончить день или
 * подать блюдо. События (продал, клиент ушёл, урожай) всплывают тостами: стор
 * отдаёт вид события, текст собирается здесь.
 */
import { useEffect } from 'react'
import {
  CROPS,
  RECIPE_IDS,
  RECIPES,
  useGameStore,
  type CropId,
  type Notice,
  type RecipeId,
  type Tool,
} from '../game/store'
import { SeedPacket } from './SeedPacket'

const CROP_EMOJI: Record<CropId, string> = { carrot: '🥕', greens: '🥬', tomato: '🍅' }
const CROP_NAME: Record<CropId, string> = { carrot: 'Морковь', greens: 'Зелень', tomato: 'Томат' }
const RECIPE_EMOJI: Record<RecipeId, string> = { salad: '🥗', soup: '🍲', taco: '🌮' }
const RECIPE_NAME: Record<RecipeId, string> = { salad: 'Салат', soup: 'Суп', taco: 'Тако' }

const panel = 'pointer-events-auto rounded-lg bg-[#241a20]/70 backdrop-blur'

/** Тост: текст и тон по виду события. Тон — единственный носитель «плохо/хорошо». */
type Tone = 'good' | 'warn' | 'bad'

function noticeText(n: Notice): { text: string; tone: Tone } {
  switch (n.kind) {
    case 'served':
      return {
        text: `${RECIPE_EMOJI[n.recipe!]} ${RECIPE_NAME[n.recipe!]} продан · +${n.amount}💰`,
        tone: 'good',
      }
    case 'wrong-dish':
      return {
        text: `Клиент ожидает другое блюдо: ${RECIPE_EMOJI[n.recipe!]} ${RECIPE_NAME[n.recipe!]}`,
        tone: 'warn',
      }
    case 'no-ingredients':
      return { text: `Не хватает ресурсов на ${RECIPE_NAME[n.recipe!]}`, tone: 'bad' }
    case 'no-customer':
      return { text: 'Очередь пуста — некому подавать', tone: 'warn' }
    case 'customer-left':
      return {
        text: `Клиент ушёл, не дождавшись ${RECIPE_EMOJI[n.recipe!]} ${RECIPE_NAME[n.recipe!]}`,
        tone: 'bad',
      }
    case 'time-up':
      return { text: 'Время вышло — ярмарка закрыта', tone: 'warn' }
    case 'harvest':
      return n.amount! > 1
        ? { text: `Удачный сбор! ${CROP_EMOJI[n.crop!]} +${n.amount}`, tone: 'good' }
        : { text: `${CROP_EMOJI[n.crop!]} +${n.amount}`, tone: 'good' }
    case 'withered':
      return {
        text: `Без полива погибло растений: ${n.amount}`,
        tone: 'bad',
      }
    case 'too-far':
      return { text: 'Слишком далеко — подойдите к грядке', tone: 'warn' }
  }
}

const TONE_CLASS: Record<Tone, string> = {
  good: 'border-[#9fc25f] text-[#dff0c0]',
  warn: 'border-[#f4b942] text-[#f7e3b8]',
  bad: 'border-[#ff8b5e] text-[#ffd7c7]',
}

const NOTICE_MS = 2600

function Toast({ notice }: { notice: Notice }) {
  const dismiss = useGameStore((s) => s.dismissNotice)
  useEffect(() => {
    const t = setTimeout(() => dismiss(notice.id), NOTICE_MS)
    return () => clearTimeout(t)
  }, [notice.id, dismiss])

  const { text, tone } = noticeText(notice)
  return (
    <div
      onClick={() => dismiss(notice.id)}
      className={`${panel} cursor-pointer border-l-4 px-3 py-2 text-xs ${TONE_CLASS[tone]}`}
    >
      {text}
    </div>
  )
}

function Toasts() {
  const notices = useGameStore((s) => s.notices)
  if (!notices.length) return null
  return (
    <div className="pointer-events-none absolute right-4 top-16 flex w-64 flex-col gap-1.5">
      {notices.map((n) => (
        <Toast key={n.id} notice={n} />
      ))}
    </div>
  )
}

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

function ToolButton({
  active,
  hint,
  hotkey,
  onClick,
  activeClass,
  children,
}: {
  active: boolean
  hint: string
  hotkey: string
  onClick: () => void
  activeClass: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={hint}
      className={`relative grid h-12 w-12 place-items-center rounded-md text-2xl transition ${
        active ? activeClass : 'bg-white/5 hover:bg-white/10'
      }`}
    >
      {children}
      <span className="absolute bottom-0 right-1 text-[9px] opacity-60">{hotkey}</span>
    </button>
  )
}

/** Единый тулбар внизу: слева инструменты, справа сумка с ресурсами. */
function Toolbar() {
  const phase = useGameStore((s) => s.phase)
  const inventory = useGameStore((s) => s.inventory)
  const selectedSeed = useGameStore((s) => s.selectedSeed)
  const tool = useGameStore((s) => s.tool)
  const selectSeed = useGameStore((s) => s.selectSeed)
  const selectTool = useGameStore((s) => s.selectTool)

  const farm = phase === 'farm'

  return (
    <div className={`${panel} flex flex-wrap items-center gap-2 p-2`}>
      {farm && (
        <>
          {CROPS.map((c, i) => (
            <ToolButton
              key={c}
              active={tool === 'seed' && selectedSeed === c}
              activeClass="bg-[#9fc25f]"
              hint={`Семена: ${CROP_NAME[c]}`}
              hotkey={String(i + 1)}
              onClick={() => selectSeed(c)}
            >
              <SeedPacket crop={c} active={tool === 'seed' && selectedSeed === c} />
            </ToolButton>
          ))}

          <ToolButton
            active={tool === 'can'}
            activeClass="bg-[#6db3f2]"
            hint="Лейка — полить росток"
            hotkey="4"
            onClick={() => selectTool('can')}
          >
            💧
          </ToolButton>

          <ToolButton
            active={tool === 'hand'}
            activeClass="bg-[#f4b942]"
            hint="Рука — собрать созревшее"
            hotkey="5"
            onClick={() => selectTool('hand')}
          >
            ✋
          </ToolButton>

          <div className="mx-1 h-10 w-px bg-white/15" />
        </>
      )}

      <span className="px-1 text-[9px] uppercase tracking-wide opacity-50">сумка</span>
      {CROPS.map((c) => (
        <div
          key={c}
          title={CROP_NAME[c]}
          className="flex items-center gap-1 rounded bg-white/5 px-2 py-1.5 text-sm"
        >
          <span>{CROP_EMOJI[c]}</span>
          <span className="font-bold">{inventory[c]}</span>
        </div>
      ))}
    </div>
  )
}

function TruckQueue() {
  const queue = useGameStore((s) => s.truck?.queue ?? [])
  const timeLeft = useGameStore((s) => s.truck?.timeLeft ?? 0)
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`${panel} px-4 py-1.5 text-sm`}>⏱ {Math.ceil(timeLeft)}с</div>
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

function FarmAction() {
  const endDay = useGameStore((s) => s.endDay)
  return (
    <button
      onClick={endDay}
      className="pointer-events-auto rounded-md bg-[#6b8f3f] px-4 py-2 text-sm font-bold text-[#f0e4c9] transition hover:brightness-110"
    >
      Закончить день →
    </button>
  )
}

function TruckAction() {
  const serveCustomer = useGameStore((s) => s.serveCustomer)
  return (
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

/** 1–3 семена, 4 лейка, 5 рука; в фазе фудтрака 1–3 подают блюдо. */
const TOOL_KEYS: Record<string, Tool> = { '4': 'can', '5': 'hand' }

export function HUD() {
  const phase = useGameStore((s) => s.phase)
  const selectSeed = useGameStore((s) => s.selectSeed)
  const selectTool = useGameStore((s) => s.selectTool)
  const serveCustomer = useGameStore((s) => s.serveCustomer)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const asTool = TOOL_KEYS[e.key]
      if (asTool) {
        if (phase === 'farm') selectTool(asTool) // лейка и рука есть только на ферме
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
    <div className="pointer-events-none absolute inset-0 select-none p-4 font-mono text-[#f0e4c9]">
      <WeekBar />
      <Toasts />

      {phase === 'truck' && (
        <div className="absolute left-1/2 top-20 -translate-x-1/2">
          <TruckQueue />
        </div>
      )}

      {/* Нижний ряд: экипировка героя слева, действие фазы справа.
          На узком экране переносится, иначе кнопка фазы уезжает за край. */}
      <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-between gap-3">
        <Toolbar />
        {phase === 'farm' ? <FarmAction /> : <TruckAction />}
      </div>

      <WeekSummary />
    </div>
  )
}
