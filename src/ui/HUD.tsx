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
 *
 * По E открывается инвентарь героя — портрет и цвет одежды.
 */
import { useEffect, useState } from 'react'
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
import { CROP_EMOJI, CROP_NAME, RECIPE_EMOJI, RECIPE_NAME } from './crops'
import { HeroPortrait } from './HeroPortrait'
import { Inventory } from './Inventory'
import { SeedPacket } from './SeedPacket'
import { Shop } from './Shop'

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
    case 'no-seeds':
      return {
        text: `${CROP_NAME[n.crop!]}: семена кончились — купите в лавке`,
        tone: 'warn',
      }
    case 'no-money':
      return { text: 'Не хватает денег', tone: 'bad' }
    case 'bought':
      return { text: `Куплено семян: ${CROP_EMOJI[n.crop!]} ×${n.amount}`, tone: 'good' }
    case 'sold':
      return { text: `${CROP_EMOJI[n.crop!]} продан · +${n.amount}💰`, tone: 'good' }
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

/**
 * Тосты. На ферме — справа, чтобы не лезть в грядки. В день торговли — по
 * центру над очередью: «не хватает ресурсов» относится к заказу, на который
 * игрок смотрит, и читать это в углу экрана неудобно.
 */
function Toasts() {
  const notices = useGameStore((s) => s.notices)
  const phase = useGameStore((s) => s.phase)
  if (!notices.length) return null

  const place =
    phase === 'truck'
      ? 'left-1/2 top-28 -translate-x-1/2 items-center'
      : 'right-4 top-16 w-64'

  return (
    <div className={`pointer-events-none absolute flex flex-col gap-1.5 ${place}`}>
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
function Toolbar({ onOpenInventory }: { onOpenInventory: () => void }) {
  const phase = useGameStore((s) => s.phase)
  const heroColor = useGameStore((s) => s.heroColor)
  const inventory = useGameStore((s) => s.inventory)
  const seeds = useGameStore((s) => s.seeds)
  const selectedSeed = useGameStore((s) => s.selectedSeed)
  const tool = useGameStore((s) => s.tool)
  const selectSeed = useGameStore((s) => s.selectSeed)
  const selectTool = useGameStore((s) => s.selectTool)

  const farm = phase === 'farm'

  return (
    <div className={`${panel} flex flex-wrap items-center gap-2 p-2`}>
      <button
        onClick={onOpenInventory}
        title="Инвентарь героя (E)"
        className="relative grid h-12 w-12 place-items-center rounded-md bg-white/5 transition hover:bg-white/10"
      >
        <HeroPortrait color={heroColor} className="h-9" />
        <span className="absolute bottom-0 right-1 text-[9px] opacity-60">E</span>
      </button>

      <div className="mx-1 h-10 w-px bg-white/15" />

      {farm && (
        <>
          {CROPS.map((c, i) => (
            <ToolButton
              key={c}
              active={tool === 'seed' && selectedSeed === c}
              activeClass="bg-[#9fc25f]"
              hint={
                seeds[c]
                  ? `Семена: ${CROP_NAME[c]} — ${seeds[c]} шт.`
                  : `Семена: ${CROP_NAME[c]} — кончились, купите в лавке`
              }
              hotkey={String(i + 1)}
              onClick={() => selectSeed(c)}
            >
              {/* Пустой пакетик приглушён: сажать нечем, пока не сходишь в лавку. */}
              <span className={seeds[c] ? '' : 'opacity-30'}>
                <SeedPacket crop={c} active={tool === 'seed' && selectedSeed === c} />
              </span>
              <span className="absolute left-1 top-0 text-[9px] font-bold opacity-80">
                {seeds[c]}
              </span>
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

/**
 * Часы дня торговли. Очередь сюда больше не рисуем: клиенты стоят в сцене
 * живыми человечками, и дублировать их иконками — значит показывать одно и то
 * же дважды.
 */
function TruckClock() {
  const timeLeft = useGameStore((s) => s.truck?.timeLeft ?? 0)
  return <div className={`${panel} px-4 py-1.5 text-sm`}>⏱ {Math.ceil(timeLeft)}с</div>
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

/** Хватает ли в сумке ингредиентов на блюдо — от этого блёкнет карточка. */
function canCook(recipe: RecipeId, inventory: Record<CropId, number>): boolean {
  const needs = RECIPES[recipe].needs
  return (Object.keys(needs) as CropId[]).every((c) => inventory[c] >= (needs[c] ?? 0))
}

/**
 * Карточка блюда. Свёрнутая — эмодзи и цена; под курсором разворачивается и
 * показывает состав. Состав нужен ровно в тот миг, когда игрок примеряется
 * к кнопке, поэтому он живёт в ховере, а не занимает место постоянно.
 */
function DishCard({ recipe, hotkey }: { recipe: RecipeId; hotkey: number }) {
  const serveCustomer = useGameStore((s) => s.serveCustomer)
  const inventory = useGameStore((s) => s.inventory)
  const [open, setOpen] = useState(false)

  const needs = RECIPES[recipe].needs
  const enough = canCook(recipe, inventory)

  return (
    <button
      onClick={() => serveCustomer(recipe)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      className={`relative flex flex-col items-start gap-1 rounded-md px-3 py-2 text-sm font-bold text-[#241a20] transition hover:brightness-110 ${
        enough ? 'bg-[#ff8b5e]/90' : 'bg-[#ff8b5e]/40'
      }`}
    >
      <span className="flex items-center gap-2">
        <span className="text-xl">{RECIPE_EMOJI[recipe]}</span>
        <span>
          {RECIPE_NAME[recipe]} · {RECIPES[recipe].price}💰
        </span>
        <span className="text-[10px] opacity-70">{hotkey}</span>
      </span>

      {open && (
        <span className="flex w-full flex-col gap-0.5 border-t border-[#241a20]/25 pt-1 text-[11px] font-normal">
          {(Object.keys(needs) as CropId[]).map((c) => {
            const need = needs[c] ?? 0
            const have = inventory[c]
            return (
              <span
                key={c}
                className={`flex items-center justify-between gap-3 ${
                  have >= need ? '' : 'text-[#7a1f12]'
                }`}
              >
                <span>
                  {CROP_EMOJI[c]} {CROP_NAME[c]}
                </span>
                <span className="font-mono">
                  {have}/{need}
                </span>
              </span>
            )
          })}
          <span className="mt-0.5 flex items-center justify-between gap-3 border-t border-[#241a20]/25 pt-0.5">
            <span>Выручка</span>
            <span className="font-mono">{RECIPES[recipe].price} 💰</span>
          </span>
        </span>
      )}
    </button>
  )
}

function TruckAction() {
  return (
    <div className={`${panel} flex items-end gap-2 p-2`}>
      {RECIPE_IDS.map((r, i) => (
        <DishCard key={r} recipe={r} hotkey={i + 1} />
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
  const shopOpen = useGameStore((s) => s.shopOpen)
  const [inventoryOpen, setInventoryOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shopOpen) return // за прилавком не до инструментов
      // По code, а не по key: на кириллической раскладке это та же клавиша.
      if (e.code === 'KeyE') {
        setInventoryOpen((v) => !v)
        return
      }
      if (inventoryOpen) return // за модалкой инструменты не переключаем
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
  }, [phase, selectSeed, selectTool, serveCustomer, inventoryOpen, shopOpen])

  return (
    <div className="pointer-events-none absolute inset-0 select-none p-4 font-mono text-[#f0e4c9]">
      <WeekBar />

      {phase === 'truck' && (
        <div className="absolute left-1/2 top-16 -translate-x-1/2">
          <TruckClock />
        </div>
      )}

      <Toasts />

      {/* Нижний ряд: экипировка героя слева, действие фазы справа.
          На узком экране переносится, иначе кнопка фазы уезжает за край. */}
      <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-between gap-3">
        <Toolbar onOpenInventory={() => setInventoryOpen(true)} />
        {phase === 'farm' ? <FarmAction /> : <TruckAction />}
      </div>

      {inventoryOpen && <Inventory onClose={() => setInventoryOpen(false)} />}
      {shopOpen && <Shop />}

      <WeekSummary />
    </div>
  )
}
