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
import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  craftableCount,
  RECIPES,
  useGameStore,
  type ItemId,
  type Notice,
  type RecipeId,
  type Tool,
} from '../game/store'
import { getHoveredOrder, subscribeOrderHover } from '../scene/orderHover'
import { ITEM_EMOJI, ITEM_NAME, RECIPE_EMOJI, RECIPE_NAME } from './crops'
import { HeroPortrait } from './HeroPortrait'
import { Inventory } from './Inventory'
import { RecipeBook } from './RecipeBook'
import { SeedPacket } from './SeedPacket'
import { Shop } from './Shop'
import { buildToolbar, hotkeyFor, TOOLBAR_CELLS, type Slot } from './toolbar'

/** Клавиши ячеек тулбара в их порядке: 1…9, 0. */
const TOOLBAR_KEYS = Array.from({ length: TOOLBAR_CELLS }, (_, i) => hotkeyFor(i))

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
        ? { text: `Удачный сбор! ${ITEM_EMOJI[n.crop!]} +${n.amount}`, tone: 'good' }
        : { text: `${ITEM_EMOJI[n.crop!]} +${n.amount}`, tone: 'good' }
    case 'foraged':
      return { text: `Находка: ${ITEM_EMOJI[n.item!]} ${ITEM_NAME[n.item!]}`, tone: 'good' }
    case 'recipe-found':
      return {
        text: `Новый рецепт: ${RECIPE_EMOJI[n.recipe!]} ${RECIPE_NAME[n.recipe!]} — смотрите книгу (B)`,
        tone: 'good',
      }
    case 'withered':
      return {
        text: `Без полива погибло растений: ${n.amount}`,
        tone: 'bad',
      }
    case 'too-far':
      return { text: 'Слишком далеко — подойдите к грядке', tone: 'warn' }
    case 'no-seeds':
      return {
        text: `${ITEM_NAME[n.crop!]}: семена кончились — купите в лавке`,
        tone: 'warn',
      }
    case 'no-money':
      return { text: 'Не хватает денег', tone: 'bad' }
    case 'bought':
      return { text: `Куплено семян: ${ITEM_EMOJI[n.crop!]} ×${n.amount}`, tone: 'good' }
    case 'skipped':
      return {
        text: `Заказ пропущен: ${RECIPE_EMOJI[n.recipe!]} ${RECIPE_NAME[n.recipe!]}`,
        tone: 'warn',
      }
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
      <div className="flex items-center gap-2">
        <MusicToggle />
        <div className={`${panel} px-4 py-2 text-lg font-bold text-[#f4b942]`}>💰 {money}</div>
      </div>
    </div>
  )
}

/** Глушит только музыку: шаги, природа и толпа продолжают звучать. */
function MusicToggle() {
  const musicOn = useGameStore((s) => s.musicOn)
  const toggleMusic = useGameStore((s) => s.toggleMusic)
  const label = musicOn ? 'Выключить музыку' : 'Включить музыку'
  return (
    <button
      onClick={toggleMusic}
      title={label}
      aria-label={label}
      aria-pressed={musicOn}
      className={`${panel} pointer-events-auto grid h-11 w-11 place-items-center text-lg transition hover:brightness-125 ${
        musicOn ? 'text-[#f4b942]' : 'text-white/40'
      }`}
    >
      {musicOn ? '🎵' : '🔇'}
    </button>
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

/**
 * Действия героя. Клавиши буквенные: цифры разобраны ячейками инвентаря, а
 * WASD и E уже заняты ходьбой и сумкой.
 */
const ACTIONS: {
  tool: Exclude<Tool, 'seed'>
  glyph: string
  hint: string
  hotkey: string
  code: string
  activeClass: string
}[] = [
  {
    tool: 'can',
    glyph: '💧',
    hint: 'Полить (Q)',
    hotkey: 'Q',
    code: 'KeyQ',
    activeClass: 'bg-[#6db3f2]',
  },
  {
    tool: 'hand',
    glyph: '✋',
    hint: 'Собрать (R)',
    hotkey: 'R',
    code: 'KeyR',
    activeClass: 'bg-[#f4b942]',
  },
]

/**
 * Пустая ячейка: рамка есть, содержимого нет. Цифру не пишем — нажимать нечего,
 * а подписанная клавиша обещала бы действие.
 */
function EmptyCell() {
  return <div className="h-12 w-12 rounded-md bg-black/20" />
}

/** Лейка и рука: не имущество, а действия — поэтому отдельно от ячеек. */
function Actions() {
  const tool = useGameStore((s) => s.tool)
  const selectTool = useGameStore((s) => s.selectTool)
  return (
    <div className="flex items-center gap-2">
      {ACTIONS.map((a) => (
        <ToolButton
          key={a.tool}
          active={tool === a.tool}
          activeClass={a.activeClass}
          hint={a.hint}
          hotkey={a.hotkey}
          onClick={() => selectTool(a.tool)}
        >
          {a.glyph}
        </ToolButton>
      ))}
    </div>
  )
}

function ToolbarCell({ slot }: { slot: Slot }) {
  const selectedSeed = useGameStore((s) => s.selectedSeed)
  const tool = useGameStore((s) => s.tool)
  const seeds = useGameStore((s) => s.seeds)
  const selectSeed = useGameStore((s) => s.selectSeed)

  const cell = slot.cell
  if (!cell) return <EmptyCell />

  if (cell.kind === 'seed') {
    const active = tool === 'seed' && selectedSeed === cell.crop
    return (
      <ToolButton
        active={active}
        activeClass="bg-[#9fc25f]"
        hint={`Семена: ${ITEM_NAME[cell.crop]} — ${seeds[cell.crop]} шт.`}
        hotkey={slot.hotkey}
        onClick={() => selectSeed(cell.crop)}
      >
        <SeedPacket crop={cell.crop} active={active} />
        <span className="absolute left-1 top-0 text-[9px] font-bold opacity-80">
          {seeds[cell.crop]}
        </span>
      </ToolButton>
    )
  }

  // Урожай и находки: они не инструмент, кликать нечего — только счётчик.
  return (
    <div
      title={ITEM_NAME[cell.item]}
      className="relative grid h-12 w-12 place-items-center rounded-md bg-white/5 text-2xl"
    >
      <span>{ITEM_EMOJI[cell.item]}</span>
      <span className="absolute left-1 top-0 text-[9px] font-bold opacity-80">{cell.count}</span>
    </div>
  )
}

/**
 * Нижняя панель: слева герой, посередине десять ячеек инвентаря, справа —
 * действия (лейка и рука).
 *
 * Урожай лежит в тех же ячейках, что и семена: это одна экипировка, а не два
 * разных списка. Чего нет — того нет: ни нулей, ни приглушённых иконок.
 * Действия отделены чертой: они не имущество, их нельзя потратить.
 */
function Toolbar({
  onOpenInventory,
  onOpenBook,
}: {
  onOpenInventory: () => void
  onOpenBook: () => void
}) {
  const phase = useGameStore((s) => s.phase)
  const heroColor = useGameStore((s) => s.heroColor)
  const inventory = useGameStore((s) => s.inventory)
  const seeds = useGameStore((s) => s.seeds)

  const slots = buildToolbar(phase, seeds, inventory)

  return (
    <div className={`${panel} flex items-center gap-2 p-2`}>
      <button
        onClick={onOpenInventory}
        title="Инвентарь героя (E)"
        className="relative grid h-12 w-12 place-items-center rounded-md bg-white/5 transition hover:bg-white/10"
      >
        <HeroPortrait color={heroColor} className="h-9" />
        <span className="absolute bottom-0 right-1 text-[9px] opacity-60">E</span>
      </button>

      <button
        onClick={onOpenBook}
        title="Книга рецептов (B)"
        className="relative grid h-12 w-12 place-items-center rounded-md bg-white/5 text-2xl transition hover:bg-white/10"
      >
        📖
        <span className="absolute bottom-0 right-1 text-[9px] opacity-60">B</span>
      </button>

      <div className="mx-1 h-10 w-px bg-white/15" />

      {slots.map((slot, i) => (
        <ToolbarCell key={i} slot={slot} />
      ))}

      {/* Действия — только на ферме: в день торговли грядки на замке. */}
      {phase === 'farm' && (
        <>
          <div className="mx-1 h-10 w-px bg-white/15" />
          <Actions />
        </>
      )}
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

/**
 * Кнопка выдачи. Число справа — сколько таких порций герой соберёт из того,
 * что в сумке. Не цена и не номер клавиши: у прилавка важно, хватит ли.
 */
function DishCard({ recipe }: { recipe: RecipeId }) {
  const serveCustomer = useGameStore((s) => s.serveCustomer)
  const inventory = useGameStore((s) => s.inventory)
  const count = craftableCount(recipe, inventory)

  return (
    <button
      onClick={() => serveCustomer(recipe)}
      title={`${RECIPE_NAME[recipe]}: можно собрать ${count}`}
      className={`relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-[#241a20] transition hover:brightness-110 ${
        count > 0 ? 'bg-[#ff8b5e]/90' : 'bg-[#ff8b5e]/40'
      }`}
    >
      <span className="text-xl">{RECIPE_EMOJI[recipe]}</span>
      <span>{RECIPE_NAME[recipe]}</span>
      <span
        className={`ml-1 min-w-5 rounded px-1.5 py-0.5 text-center text-xs ${
          count > 0 ? 'bg-[#241a20]/25' : 'bg-[#241a20]/10 opacity-60'
        }`}
      >
        {count}
      </span>
    </button>
  )
}

/** Выдавать можно только освоенное: клиенты и заказывают только его. */
function TruckAction() {
  const skipCustomer = useGameStore((s) => s.skipCustomer)
  const hasQueue = useGameStore((s) => (s.truck?.queue.length ?? 0) > 0)
  const knownRecipes = useGameStore((s) => s.knownRecipes)

  return (
    <div className={`${panel} flex flex-col items-start gap-1.5 p-2`}>
      <span className="px-1 text-[9px] uppercase tracking-wide opacity-50">выдать</span>
      {/* Рецептов может стать пять — на узком экране ряд переносится. */}
      <div className="flex flex-wrap items-center gap-2">
        {knownRecipes.map((r) => (
          <DishCard key={r} recipe={r} />
        ))}

        <div className="mx-1 h-9 w-px bg-white/15" />

        <button
          onClick={skipCustomer}
          disabled={!hasQueue}
          title="Отпустить первого в очереди, ничего не подав"
          className="rounded-md bg-white/10 px-3 py-2 text-sm font-bold transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Пропустить заказ
        </button>
      </div>
    </div>
  )
}

/**
 * Состав заказа — по ховеру облачка над клиентом. Панель встаёт у курсора и
 * говорит ровно то, что нужно решить: хватит ли того, что в сумке.
 */
function OrderTooltip() {
  const hovered = useSyncExternalStore(subscribeOrderHover, getHoveredOrder, getHoveredOrder)
  const inventory = useGameStore((s) => s.inventory)
  if (!hovered) return null

  const needs = RECIPES[hovered.recipe].needs
  return (
    <div
      className="pointer-events-none fixed z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-[#f4b942]/60 bg-[#241a20]/95 px-3 py-2 text-xs"
      style={{ left: hovered.x, top: hovered.y - 12 }}
    >
      <div className="mb-1 flex items-center gap-2 font-bold text-[#f4b942]">
        <span>{RECIPE_EMOJI[hovered.recipe]}</span>
        <span>{RECIPE_NAME[hovered.recipe]}</span>
        <span className="ml-auto">{RECIPES[hovered.recipe].price}💰</span>
      </div>
      {(Object.keys(needs) as ItemId[]).map((c) => {
        const need = needs[c] ?? 0
        const have = inventory[c]
        return (
          <div
            key={c}
            className={`flex items-center justify-between gap-4 ${
              have >= need ? 'opacity-80' : 'text-[#ff8b5e]'
            }`}
          >
            <span>
              {ITEM_EMOJI[c]} {ITEM_NAME[c]}
            </span>
            <span className="font-mono">
              {have}/{need}
            </span>
          </div>
        )
      })}
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
  const seeds = useGameStore((s) => s.seeds)
  const inventory = useGameStore((s) => s.inventory)
  const knownRecipes = useGameStore((s) => s.knownRecipes)
  const selectSeed = useGameStore((s) => s.selectSeed)
  const selectTool = useGameStore((s) => s.selectTool)
  const serveCustomer = useGameStore((s) => s.serveCustomer)
  const shopOpen = useGameStore((s) => s.shopOpen)
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shopOpen) return // за прилавком не до инструментов
      // По code, а не по key: на кириллической раскладке это та же клавиша.
      if (e.code === 'KeyE') {
        setInventoryOpen((v) => !v)
        return
      }
      if (e.code === 'KeyB') {
        setBookOpen((v) => !v)
        return
      }
      if (inventoryOpen || bookOpen) return // за модалкой инструменты не переключаем

      // В день торговли цифры подают блюда — ровно в том порядке, в каком они
      // нарисованы на кнопках выдачи, то есть в порядке освоенных рецептов.
      if (phase === 'truck') {
        const dish = TOOLBAR_KEYS.indexOf(e.key)
        if (dish >= 0 && dish < knownRecipes.length) serveCustomer(knownRecipes[dish])
        return
      }

      // Действия — по букве: цифры разобраны ячейками инвентаря.
      const action = ACTIONS.find((a) => a.code === e.code)
      if (action) {
        selectTool(action.tool)
        return
      }

      // На ферме цифра — номер ячейки тулбара, ровно та, что под ней нарисована.
      const index = TOOLBAR_KEYS.indexOf(e.key)
      if (index < 0) return
      const cell = buildToolbar(phase, seeds, inventory)[index].cell
      if (cell?.kind === 'seed') selectSeed(cell.crop)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    phase,
    seeds,
    inventory,
    knownRecipes,
    selectSeed,
    selectTool,
    serveCustomer,
    inventoryOpen,
    bookOpen,
    shopOpen,
  ])

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
        <Toolbar
          onOpenInventory={() => setInventoryOpen(true)}
          onOpenBook={() => setBookOpen(true)}
        />
        {phase === 'farm' ? <FarmAction /> : <TruckAction />}
      </div>

      {phase === 'truck' && <OrderTooltip />}

      {inventoryOpen && <Inventory onClose={() => setInventoryOpen(false)} />}
      {bookOpen && <RecipeBook onClose={() => setBookOpen(false)} />}
      {shopOpen && <Shop />}

      <WeekSummary />
    </div>
  )
}
