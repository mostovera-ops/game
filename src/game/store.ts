/**
 * Состояние и правила фермы. НОЛЬ импортов из three и @react-three/* —
 * этот модуль обязан тестироваться без браузера (см. CLAUDE.md).
 *
 * Правила взяты из reference/farm-truck-game.html (логика, не отрисовка):
 *   - полил → на следующий день stage + 1 (макс 2);
 *   - не полил и stage < 2 → растение погибает, слот пустеет;
 *   - дни 1–6 — фаза 'farm', день 7 — фаза 'truck'.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  emptyToolbar,
  moveItem,
  reconcileToolbar,
  type ToolbarLayout,
} from './toolbar'

export type CropId = 'carrot' | 'greens' | 'tomato'
export type RecipeId = 'salad' | 'soup' | 'taco'
export type Phase = 'farm' | 'truck'
export type Stage = 0 | 1 | 2

/** Чем игрок действует по слоту: сажает, поливает или собирает руками. */
export type Tool = 'seed' | 'can' | 'hand'

/** slotId = `${bedIndex}:${slotIndex}` — 3 грядки × 3 слота = 9 слотов. */
export type SlotId = string

export interface Slot {
  id: SlotId
  crop: CropId | null
  stage: Stage
  watered: boolean
  /** Удачное растение: при сборе даст 2 единицы вместо 1. Решается при созревании. */
  lucky: boolean
}

/** Шанс, что созревшее растение окажется удачным (1 к 10). */
export const LUCKY_CHANCE = 0.1
export const LUCKY_YIELD = 2

/**
 * Сделает ли клик этим инструментом по этому слоту хоть что-нибудь. По тому же
 * правилу слот рисует курсор и подсветку, а <Interactions> решает, доводить ли
 * дело до конца, когда герой пришёл.
 *
 * Лейка берёт любой слот, даже пустой и созревший: выяснять, что именно можно
 * полить, — забота игры, а не игрока. На рост это не влияет, см. endDay: пустой
 * слот всё равно останется пустым, созревший — созревшим.
 */
export function slotActionable(slot: Slot, tool: Tool): boolean {
  if (tool === 'can') return true
  if (tool === 'hand') return !!slot.crop && slot.stage === 2
  return !slot.crop
}

/**
 * Событие для тоста в HUD. Стор хранит только вид события и его данные —
 * текст живёт в ui/, чтобы game/ не знал про язык интерфейса.
 */
export type NoticeKind =
  | 'served'
  | 'wrong-dish'
  | 'no-ingredients'
  | 'no-customer'
  | 'customer-left'
  | 'time-up'
  | 'harvest'
  | 'withered'
  | 'too-far'
  | 'no-seeds'
  | 'no-money'
  | 'bought'
  | 'skipped'

export interface Notice {
  id: number
  kind: NoticeKind
  recipe?: RecipeId
  crop?: CropId
  amount?: number
}

/** Сколько тостов держим на экране одновременно. */
const MAX_NOTICES = 4

export type Inventory = Record<CropId, number>

/**
 * Цвет одежды героя. Хранится строкой `#rrggbb`: сцена красит им материал
 * `Hero`, портрет в инвентаре — тот же цвет. Значение по умолчанию совпадает
 * с `Hero` в palette.json — game/ не имеет права читать ассеты, поэтому дубль.
 */
export const HERO_COLOR_DEFAULT = '#3d4f63'

/** Из чего игрок выбирает. Порядок — порядок кнопок в инвентаре. */
export const HERO_COLORS: readonly string[] = [
  HERO_COLOR_DEFAULT,
  '#7a4b52',
  '#8c6239',
  '#4e6b3f',
  '#5b4a7d',
  '#2f6f6b',
  '#c47669',
  '#d9c58b',
]

export const BEDS = 3
export const SLOTS_PER_BED = 3

/** Все 9 идентификаторов слотов в порядке грядка→слот. */
export const SLOT_IDS: SlotId[] = Array.from({ length: BEDS }, (_, bed) =>
  Array.from({ length: SLOTS_PER_BED }, (_, slot) => `${bed}:${slot}`),
).flat()

export const CROPS: CropId[] = ['carrot', 'greens', 'tomato']

/** Индекс грядки из slotId (`${bed}:${slot}`). */
export function bedOf(slotId: SlotId): number {
  return Number(slotId.split(':')[0])
}

export const RECIPES: Record<
  RecipeId,
  { needs: Partial<Record<CropId, number>>; price: number }
> = {
  salad: { needs: { tomato: 1, greens: 1 }, price: 8 },
  soup: { needs: { carrot: 2 }, price: 6 },
  taco: { needs: { carrot: 1, tomato: 1, greens: 1 }, price: 14 },
}

/**
 * Экономика лавки. Лавка только продаёт семена: скупки урожая нет, и весь
 * урожай уходит в блюда. Единственный источник денег — день фудтрака.
 *
 * Маржа блюда за вычетом семян: суп +2, салат +3, тако +7. Тако — цель недели,
 * суп — способ не остаться без денег.
 */
export const SEED_PRICE: Record<CropId, number> = { carrot: 2, greens: 2, tomato: 3 }

/** По три семени каждой культуры — ровно на все девять слотов. */
export const START_SEEDS = 3

/**
 * Стартовый капитал. Полная пересадка всех девяти слотов стоит 21 — на монету
 * больше, чем есть. Первую неделю засеваем стартовыми семенами, а деньги
 * приходят только с ярмарки.
 */
export const START_MONEY = 20

export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[]

/**
 * Сколько порций блюда герой соберёт из того, что в сумке.
 *
 * Ограничивает самый дефицитный ингредиент. Это число HUD пишет на кнопке
 * выдачи вместо цены: игроку важно, хватит ли, а не сколько это стоит.
 */
export function craftableCount(recipe: RecipeId, inventory: Inventory): number {
  const needs = RECIPES[recipe].needs
  const ids = Object.keys(needs) as CropId[]
  return ids.reduce((min, crop) => Math.min(min, Math.floor(inventory[crop] / needs[crop]!)), Infinity)
}

export interface Customer {
  /**
   * Стабильный id клиента. Нужен сцене: очередь сдвигается при каждой продаже,
   * и без id человечек в 3D «перескакивал» бы в чужую модель вместо того,
   * чтобы шагнуть вперёд.
   */
  id: number
  /**
   * Что клиент заказал. null — он ещё идёт к окну и ничего не просил.
   *
   * Заказ рождается у самого окна (customerReady), а не при появлении клиента:
   * иначе кнопки выдачи предлагали бы подать блюдо тому, кто ещё за деревьями,
   * и игрок бил бы по ним наугад.
   */
  want: RecipeId | null
  patience: number
  maxPatience: number
}

/** Состояние дня фудтрака (день 7). null в фазе фермы. */
export interface TruckState {
  timeLeft: number
  queue: Customer[]
  served: number
  spawnTimer: number
  nextSpawnIn: number
  ended: boolean
  nextCustomerId: number
}

const TRUCK_SECONDS = 60
const MAX_QUEUE = 4
const PATIENCE = 16

function initialTruck(): TruckState {
  return {
    timeLeft: TRUCK_SECONDS,
    queue: [],
    served: 0,
    spawnTimer: 0,
    nextSpawnIn: 2.5,
    ended: false,
    nextCustomerId: 1,
  }
}

function emptySlots(): Slot[] {
  return SLOT_IDS.map((id) => ({ id, crop: null, stage: 0, watered: false, lucky: false }))
}

const emptySlot = (id: SlotId): Slot => ({
  id,
  crop: null,
  stage: 0,
  watered: false,
  lucky: false,
})

function emptyInventory(): Inventory {
  return { carrot: 0, greens: 0, tomato: 0 }
}

function startingSeeds(): Inventory {
  return { carrot: START_SEEDS, greens: START_SEEDS, tomato: START_SEEDS }
}

/** Результат подачи блюда клиенту. */
export type ServeResult = 'ok' | 'no-customer' | 'wrong-dish' | 'no-ingredients'

interface GameData {
  day: number
  phase: Phase
  money: number
  slots: Slot[]
  inventory: Inventory
  /** Семена на руках. Посадка тратит одно, лавка продаёт новые. */
  seeds: Inventory
  selectedSeed: CropId
  tool: Tool
  truck: TruckState | null
  /**
   * Открыта ли лавка. Не персистится: это состояние экрана.
   *
   * Живёт в сторе, а не в useState HUD (как инвентарь по E), потому что
   * открывает её сцена — герой, дошедший до прилавка.
   */
  shopOpen: boolean
  /**
   * Раскладка тулбара: что в какой ячейке лежит. Персистится — игрок
   * раскладывает предметы под себя, и после перезагрузки они там же.
   */
  toolbar: ToolbarLayout
  /** Цвет одежды героя, `#rrggbb`. */
  heroColor: string
  /** Играет ли музыка. Звуки и природа от этого не зависят. */
  musicOn: boolean
  /** Очередь тостов. Не персистится: события живут только в текущей сессии. */
  notices: Notice[]
  nextNoticeId: number
}

interface GameActions {
  /** Выбрать семя — заодно берёт в руки семена, а не другой инструмент. */
  selectSeed: (seed: CropId) => void
  /** Переключить инструмент (семена / лейка / рука). */
  selectTool: (tool: Tool) => void
  /** Перекрасить одежду героя. */
  setHeroColor: (color: string) => void
  /** Включить/выключить музыку. Звуки продолжают играть. */
  toggleMusic: () => void
  /** Убрать тост по id (истёк таймер или клик). */
  dismissNotice: (id: number) => void
  /** Сообщить о событии без данных. Подряд один и тот же вид не дублируется. */
  notify: (kind: NoticeKind) => void
  /** Открыть лавку — зовёт сцена, когда герой дошёл до прилавка. */
  openShop: () => void
  closeShop: () => void
  /** Купить семена. Не хватает денег — ничего не меняется, летит тост. */
  buySeeds: (crop: CropId, qty: number) => void
  /** Посадить выбранное семя в пустой слот. Тратит одно семя. */
  plant: (slotId: SlotId) => void
  /** Полить растущий слот (stage < 2). */
  water: (slotId: SlotId) => void
  /** Собрать созревший слот (stage === 2) → +1, у удачного +2. */
  harvest: (slotId: SlotId) => void
  /** Конец дня: рост политых, гибель неполитых, смена фазы на день 7. */
  endDay: () => void
  /** Приготовить блюдо, если хватает ингредиентов. Возвращает успех. */
  serve: (recipeId: RecipeId) => boolean
  /** Тик дня фудтрака (спавн клиентов, терпение, таймер). */
  tickTruck: (dt: number) => void
  /** Подать блюдо первому клиенту очереди. */
  serveCustomer: (recipeId: RecipeId) => ServeResult
  /** Отпустить первого в очереди, ничего ему не подав. */
  skipCustomer: () => void
  /** Клиент дошёл до окна — он придумывает заказ, и терпение пошло. */
  customerReady: (id: number) => void
  /** Перетащить предмет тулбара из ячейки в ячейку. */
  moveToolbarItem: (from: number, to: number) => void
  /** Начать новую неделю (день 1; грядки, деньги и инвентарь остаются). */
  nextWeek: () => void
  /** Полный сброс к первому дню. */
  resetGame: () => void
}

export type GameState = GameData & GameActions

function initialData(): GameData {
  return {
    day: 1,
    phase: 'farm',
    money: START_MONEY,
    slots: emptySlots(),
    inventory: emptyInventory(),
    seeds: startingSeeds(),
    selectedSeed: 'carrot',
    tool: 'seed',
    truck: null,
    toolbar: reconcileToolbar(emptyToolbar(), startingSeeds(), emptyInventory()),
    shopOpen: false,
    heroColor: HERO_COLOR_DEFAULT,
    musicOn: true,
    notices: [],
    nextNoticeId: 1,
  }
}

/**
 * Патч раскладки тулбара под новые семена/инвентарь. Зовётся из каждого
 * действия, которое их меняет: кончившийся предмет освобождает ячейку,
 * появившийся садится в первую свободную.
 */
function withToolbar(layout: ToolbarLayout, seeds: Inventory, inventory: Inventory) {
  return { toolbar: reconcileToolbar(layout, seeds, inventory) }
}

/** Добавляет тост, вытесняя самые старые. Возвращает патч для set(). */
function withNotice(s: GameData, notice: Omit<Notice, 'id'>) {
  const next = [...s.notices, { ...notice, id: s.nextNoticeId }]
  return {
    notices: next.slice(-MAX_NOTICES),
    nextNoticeId: s.nextNoticeId + 1,
  }
}

// В браузере — localStorage; в тестах/SSR (node) — память, без падений.
const storage = createJSONStorage<GameData>(() =>
  typeof localStorage !== 'undefined' ? localStorage : memoryStorage(),
)

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  }
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...initialData(),

      selectSeed: (seed) => set({ selectedSeed: seed, tool: 'seed' }),

      selectTool: (tool) => set({ tool }),

      setHeroColor: (heroColor) => set({ heroColor }),

      toggleMusic: () => set((s) => ({ musicOn: !s.musicOn })),

      dismissNotice: (id) =>
        set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),

      notify: (kind) =>
        set((s) => {
          // Клик по дальней грядке легко повторить трижды — не копим одинаковые.
          if (s.notices.at(-1)?.kind === kind) return {}
          return withNotice(s, { kind })
        }),

      openShop: () => set({ shopOpen: true }),

      closeShop: () => set({ shopOpen: false }),

      buySeeds: (crop, qty) =>
        set((s) => {
          const cost = SEED_PRICE[crop] * qty
          if (qty <= 0) return {}
          if (s.money < cost) return withNotice(s, { kind: 'no-money' })
          const seeds = { ...s.seeds, [crop]: s.seeds[crop] + qty }
          return {
            money: s.money - cost,
            seeds,
            ...withToolbar(s.toolbar, seeds, s.inventory),
            ...withNotice(s, { kind: 'bought', crop, amount: qty }),
          }
        }),

      plant: (slotId) =>
        set((s) => {
          const slot = s.slots.find((x) => x.id === slotId)
          if (!slot || slot.crop) return {}
          const crop = s.selectedSeed
          if (s.seeds[crop] < 1) return withNotice(s, { kind: 'no-seeds', crop })
          const seeds = { ...s.seeds, [crop]: s.seeds[crop] - 1 }
          return {
            seeds,
            ...withToolbar(s.toolbar, seeds, s.inventory),
            // Полив принадлежит земле, а не растению: посадка в мокрую грядку
            // не высушивает её.
            slots: s.slots.map((x) =>
              x.id === slotId ? { ...x, crop, stage: 0 as Stage, lucky: false } : x,
            ),
          }
        }),

      // Поливается любой слот: пустой, растущий, созревший. Рост от этого не
      // меняется — endDay смотрит на watered только у растущего растения.
      water: (slotId) =>
        set((s) => ({
          slots: s.slots.map((slot) => (slot.id === slotId ? { ...slot, watered: true } : slot)),
        })),

      harvest: (slotId) =>
        set((s) => {
          const slot = s.slots.find((x) => x.id === slotId)
          if (!slot || !slot.crop || slot.stage !== 2) return {}
          const crop = slot.crop
          const amount = slot.lucky ? LUCKY_YIELD : 1
          const inventory = { ...s.inventory, [crop]: s.inventory[crop] + amount }
          return {
            // Грядка остаётся политой: собрали растение, а не воду из земли.
            slots: s.slots.map((x) =>
              x.id === slotId ? { ...emptySlot(x.id), watered: x.watered } : x,
            ),
            inventory,
            ...withToolbar(s.toolbar, s.seeds, inventory),
            ...withNotice(s, { kind: 'harvest', crop, amount }),
          }
        }),

      endDay: () =>
        set((s) => {
          let withered = 0
          const slots = s.slots.map((slot): Slot => {
            if (!slot.crop) return { ...slot, watered: false }
            if (slot.watered) {
              const stage = Math.min(2, slot.stage + 1) as Stage
              // Удачу бросаем один раз — в момент созревания.
              const lucky = stage === 2 && slot.stage < 2
                ? Math.random() < LUCKY_CHANCE
                : slot.lucky
              return { ...slot, stage, watered: false, lucky }
            }
            // Не полили: растущее погибает, созревшее (stage 2) остаётся.
            if (slot.stage < 2) {
              withered++
              return emptySlot(slot.id)
            }
            return { ...slot, watered: false }
          })
          const day = s.day + 1
          const phase: Phase = day > 6 ? 'truck' : 'farm'
          // На дне 7 открываем фудтрек — заводим очередь и таймер.
          const truck = phase === 'truck' ? initialTruck() : s.truck
          return {
            slots,
            day,
            phase,
            truck,
            ...(withered ? withNotice(s, { kind: 'withered', amount: withered }) : {}),
          }
        }),

      serve: (recipeId) => {
        const s = get()
        if (s.phase !== 'truck') return false
        const recipe = RECIPES[recipeId]
        const needs = Object.keys(recipe.needs) as CropId[]
        if (needs.some((crop) => s.inventory[crop] < (recipe.needs[crop] ?? 0))) {
          return false
        }
        const inventory = { ...s.inventory }
        for (const crop of needs) inventory[crop] -= recipe.needs[crop] ?? 0
        set({ inventory, money: s.money + recipe.price, ...withToolbar(s.toolbar, s.seeds, inventory) })
        return true
      },

      tickTruck: (dt) =>
        set((s) => {
          const t = s.truck
          if (!t || t.ended) return {}
          const timeLeft = t.timeLeft - dt
          if (timeLeft <= 0) {
            return {
              truck: { ...t, timeLeft: 0, ended: true },
              ...withNotice(s, { kind: 'time-up' }),
            }
          }
          // Терпение убывает только у тех, кто уже сделал заказ: дорога к окну
          // его не тратит. Ушедших клиентов убираем — и сообщаем о них.
          const ticked = t.queue.map((c) =>
            c.want ? { ...c, patience: c.patience - dt } : c,
          )
          const left = ticked.filter((c) => c.patience <= 0)
          let queue = ticked.filter((c) => c.patience > 0)
          let notice = {}
          if (left.length) notice = withNotice(s, { kind: 'customer-left', recipe: left[0].want! })
          let spawnTimer = t.spawnTimer + dt
          let nextSpawnIn = t.nextSpawnIn
          let nextCustomerId = t.nextCustomerId
          if (spawnTimer >= nextSpawnIn && queue.length < MAX_QUEUE) {
            spawnTimer = 0
            nextSpawnIn = 3 + Math.random() * 3
            // Без заказа: его клиент придумает, дойдя до окна.
            queue = [...queue, { id: nextCustomerId, want: null, patience: PATIENCE, maxPatience: PATIENCE }]
            nextCustomerId++
          }
          return {
            truck: { ...t, timeLeft, queue, spawnTimer, nextSpawnIn, nextCustomerId },
            ...notice,
          }
        }),

      serveCustomer: (recipeId) => {
        const s = get()
        const t = s.truck
        if (!t || t.ended || t.queue.length === 0) {
          set(withNotice(s, { kind: 'no-customer' }))
          return 'no-customer'
        }
        const front = t.queue[0]
        // Дошёл, но заказать не успел — подавать нечего.
        if (!front.want) {
          set(withNotice(s, { kind: 'no-customer' }))
          return 'no-customer'
        }
        if (front.want !== recipeId) {
          set(withNotice(s, { kind: 'wrong-dish', recipe: front.want }))
          return 'wrong-dish'
        }
        const recipe = RECIPES[recipeId]
        const needs = Object.keys(recipe.needs) as CropId[]
        if (needs.some((crop) => s.inventory[crop] < (recipe.needs[crop] ?? 0))) {
          set(withNotice(s, { kind: 'no-ingredients', recipe: recipeId }))
          return 'no-ingredients'
        }
        const inventory = { ...s.inventory }
        for (const crop of needs) inventory[crop] -= recipe.needs[crop] ?? 0
        set({
          inventory,
          ...withToolbar(s.toolbar, s.seeds, inventory),
          money: s.money + recipe.price,
          truck: { ...t, served: t.served + 1, queue: t.queue.slice(1) },
          ...withNotice(s, { kind: 'served', recipe: recipeId, amount: recipe.price }),
        })
        return 'ok'
      },

      // Заказ, который нечем закрыть, держит очередь: пропускаем его руками,
      // не дожидаясь, пока у клиента кончится терпение.
      skipCustomer: () =>
        set((s) => {
          const t = s.truck
          if (!t || t.ended || t.queue.length === 0) {
            return withNotice(s, { kind: 'no-customer' })
          }
          const front = t.queue[0]
          if (!front.want) return withNotice(s, { kind: 'no-customer' })
          return {
            truck: { ...t, queue: t.queue.slice(1) },
            ...withNotice(s, { kind: 'skipped', recipe: front.want }),
          }
        }),

      // Заказ рождается здесь, а не при появлении клиента: сцена зовёт это,
      // когда человечек дошёл до окна. Просить умеет только первый в очереди —
      // остальные ещё стоят за ним и в окно не смотрят.
      customerReady: (id) =>
        set((s) => {
          const t = s.truck
          if (!t || t.ended) return {}
          const front = t.queue[0]
          if (!front || front.id !== id || front.want) return {}
          const want = RECIPE_IDS[Math.floor(Math.random() * RECIPE_IDS.length)]
          return {
            truck: {
              ...t,
              queue: [{ ...front, want, patience: front.maxPatience }, ...t.queue.slice(1)],
            },
          }
        }),

      moveToolbarItem: (from, to) => set((s) => ({ toolbar: moveItem(s.toolbar, from, to) })),

      // Семена, деньги и грядки переезжают в новую неделю: это и есть
      // накопленный прогресс. Даром семян больше не выдают — только лавка.
      // Грядки не подметаем: несобранный урожай и всходы — тоже труд игрока,
      // и ярмарка не повод их выкорчёвывать.
      nextWeek: () =>
        set(() => ({
          day: 1,
          phase: 'farm',
          truck: null,
          shopOpen: false,
          notices: [],
        })),

      // Музыка переживает сброс: это настройка звука, а не игровой прогресс.
      resetGame: () => set((s) => ({ ...initialData(), musicOn: s.musicOn })),
    }),
    {
      name: 'farm-truck',
      storage,
      // v1: грядка стала 3-слотовой, появился инструмент — старые id (`bed:3`)
      //     больше не существуют, поэтому грядки сбрасываем.
      // v2: у слота появилось поле lucky; дописываем его, грядки не трогаем.
      // v3: у героя появился цвет одежды, у клиента — id. Обе правки родились
      //     параллельно и попали в одну версию: сохранения v2 чинятся сразу от
      //     обеих, иначе половина осталась бы битой.
      // v4: семена стали ресурсом. Старому сохранению выдаём стартовый набор
      //     и стартовые деньги сверху: раньше семена были бесплатны и копить
      //     на них было незачем, так что честного баланса из него не достать.
      // День и инвентарь переживают все миграции.
      // v5: кнопка музыки в HUD. Старому сохранению включаем её — так было
      //     до появления кнопки, и молчащая после обновления игра выглядела
      //     бы поломкой, а не настройкой.
      // v6: у тулбара появилась своя раскладка — предметы держатся ячеек и
      //     не сдвигаются, когда сосед кончился. Старому сохранению собираем
      //     её из того, чем герой владеет.
      version: 6,
      migrate: (persisted, from) => {
        let s = persisted as GameData
        if (from < 1) s = { ...s, slots: emptySlots(), tool: 'seed' }
        if (from < 2) {
          s = { ...s, slots: s.slots.map((slot) => ({ ...slot, lucky: Boolean(slot.lucky) })) }
        }
        if (from < 3) {
          s = { ...s, heroColor: HERO_COLOR_DEFAULT }
          if (s.truck) {
            const queue = s.truck.queue.map((c, i) => ({ ...c, id: i + 1 }))
            s = { ...s, truck: { ...s.truck, queue, nextCustomerId: queue.length + 1 } }
          }
        }
        if (from < 4) s = { ...s, seeds: startingSeeds(), money: s.money + START_MONEY }
        if (from < 5) s = { ...s, musicOn: true }
        if (from < 6) s = { ...s, toolbar: reconcileToolbar(emptyToolbar(), s.seeds, s.inventory) }
        return s
      },
      // Персистим только данные, не экшены. Тосты — сессионные, их не храним.
      partialize: (s): GameData => ({
        day: s.day,
        phase: s.phase,
        money: s.money,
        slots: s.slots,
        inventory: s.inventory,
        seeds: s.seeds,
        selectedSeed: s.selectedSeed,
        tool: s.tool,
        truck: s.truck,
        toolbar: s.toolbar,
        shopOpen: false, // лавка закрывается вместе с вкладкой
        heroColor: s.heroColor,
        musicOn: s.musicOn,
        notices: [],
        nextNoticeId: 1,
      }),
    },
  ),
)

// Доступ к стору из DevTools / скриншот-харнеса.
if (typeof window !== 'undefined') {
  ;(window as unknown as { __game?: unknown }).__game = useGameStore
}
