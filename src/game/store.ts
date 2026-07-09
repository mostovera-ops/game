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

export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[]

export interface Customer {
  want: RecipeId
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

/** Результат подачи блюда клиенту. */
export type ServeResult = 'ok' | 'no-customer' | 'wrong-dish' | 'no-ingredients'

interface GameData {
  day: number
  phase: Phase
  money: number
  slots: Slot[]
  inventory: Inventory
  selectedSeed: CropId
  tool: Tool
  truck: TruckState | null
  /** Очередь тостов. Не персистится: события живут только в текущей сессии. */
  notices: Notice[]
  nextNoticeId: number
}

interface GameActions {
  /** Выбрать семя — заодно берёт в руки семена, а не другой инструмент. */
  selectSeed: (seed: CropId) => void
  /** Переключить инструмент (семена / лейка / рука). */
  selectTool: (tool: Tool) => void
  /** Убрать тост по id (истёк таймер или клик). */
  dismissNotice: (id: number) => void
  /** Сообщить о событии без данных. Подряд один и тот же вид не дублируется. */
  notify: (kind: NoticeKind) => void
  /** Посадить выбранное семя в пустой слот. */
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
  /** Начать новую неделю (день 1, чистые грядки; деньги/инвентарь остаются). */
  nextWeek: () => void
  /** Полный сброс к первому дню. */
  resetGame: () => void
}

export type GameState = GameData & GameActions

function initialData(): GameData {
  return {
    day: 1,
    phase: 'farm',
    money: 0,
    slots: emptySlots(),
    inventory: emptyInventory(),
    selectedSeed: 'carrot',
    tool: 'seed',
    truck: null,
    notices: [],
    nextNoticeId: 1,
  }
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

      dismissNotice: (id) =>
        set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),

      notify: (kind) =>
        set((s) => {
          // Клик по дальней грядке легко повторить трижды — не копим одинаковые.
          if (s.notices.at(-1)?.kind === kind) return {}
          return withNotice(s, { kind })
        }),

      plant: (slotId) =>
        set((s) => ({
          slots: s.slots.map((slot) =>
            slot.id === slotId && !slot.crop
              ? { ...slot, crop: s.selectedSeed, stage: 0, watered: false, lucky: false }
              : slot,
          ),
        })),

      water: (slotId) =>
        set((s) => ({
          slots: s.slots.map((slot) =>
            slot.id === slotId && slot.crop && slot.stage < 2
              ? { ...slot, watered: true }
              : slot,
          ),
        })),

      harvest: (slotId) =>
        set((s) => {
          const slot = s.slots.find((x) => x.id === slotId)
          if (!slot || !slot.crop || slot.stage !== 2) return {}
          const crop = slot.crop
          const amount = slot.lucky ? LUCKY_YIELD : 1
          return {
            slots: s.slots.map((x) => (x.id === slotId ? emptySlot(x.id) : x)),
            inventory: { ...s.inventory, [crop]: s.inventory[crop] + amount },
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
        set({ inventory, money: s.money + recipe.price })
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
          // Терпение убывает, ушедших клиентов убираем — и сообщаем о них.
          const ticked = t.queue.map((c) => ({ ...c, patience: c.patience - dt }))
          const left = ticked.filter((c) => c.patience <= 0)
          let queue = ticked.filter((c) => c.patience > 0)
          let notice = {}
          if (left.length) notice = withNotice(s, { kind: 'customer-left', recipe: left[0].want })
          let spawnTimer = t.spawnTimer + dt
          let nextSpawnIn = t.nextSpawnIn
          if (spawnTimer >= nextSpawnIn && queue.length < MAX_QUEUE) {
            spawnTimer = 0
            nextSpawnIn = 3 + Math.random() * 3
            const want = RECIPE_IDS[Math.floor(Math.random() * RECIPE_IDS.length)]
            queue = [...queue, { want, patience: PATIENCE, maxPatience: PATIENCE }]
          }
          return { truck: { ...t, timeLeft, queue, spawnTimer, nextSpawnIn }, ...notice }
        }),

      serveCustomer: (recipeId) => {
        const s = get()
        const t = s.truck
        if (!t || t.ended || t.queue.length === 0) {
          set(withNotice(s, { kind: 'no-customer' }))
          return 'no-customer'
        }
        const front = t.queue[0]
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
          money: s.money + recipe.price,
          truck: { ...t, served: t.served + 1, queue: t.queue.slice(1) },
          ...withNotice(s, { kind: 'served', recipe: recipeId, amount: recipe.price }),
        })
        return 'ok'
      },

      nextWeek: () =>
        set(() => ({
          day: 1,
          phase: 'farm',
          slots: emptySlots(),
          truck: null,
          notices: [],
        })),

      resetGame: () => set(initialData()),
    }),
    {
      name: 'farm-truck',
      storage,
      // v1: грядка стала 3-слотовой, появился инструмент — старые id (`bed:3`)
      //     больше не существуют, поэтому грядки сбрасываем.
      // v2: у слота появилось поле lucky; дописываем его, грядки не трогаем.
      // Деньги, день и инвентарь переживают обе миграции.
      version: 2,
      migrate: (persisted, from) => {
        let s = persisted as GameData
        if (from < 1) s = { ...s, slots: emptySlots(), tool: 'seed' }
        if (from < 2) {
          s = { ...s, slots: s.slots.map((slot) => ({ ...slot, lucky: Boolean(slot.lucky) })) }
        }
        return s
      },
      // Персистим только данные, не экшены. Тосты — сессионные, их не храним.
      partialize: (s): GameData => ({
        day: s.day,
        phase: s.phase,
        money: s.money,
        slots: s.slots,
        inventory: s.inventory,
        selectedSeed: s.selectedSeed,
        tool: s.tool,
        truck: s.truck,
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
