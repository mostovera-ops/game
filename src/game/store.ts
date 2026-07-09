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

/** Чем игрок действует по слоту: сажает семя или поливает из лейки. */
export type Tool = 'seed' | 'can'

/** slotId = `${bedIndex}:${slotIndex}` — 3 грядки × 3 слота = 9 слотов. */
export type SlotId = string

export interface Slot {
  id: SlotId
  crop: CropId | null
  stage: Stage
  watered: boolean
}

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
  return SLOT_IDS.map((id) => ({ id, crop: null, stage: 0, watered: false }))
}

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
}

interface GameActions {
  /** Выбрать семя — заодно берёт в руки семена, а не лейку. */
  selectSeed: (seed: CropId) => void
  /** Переключить инструмент (семена ↔ лейка). */
  selectTool: (tool: Tool) => void
  /** Посадить выбранное семя в пустой слот. */
  plant: (slotId: SlotId) => void
  /** Полить растущий слот (stage < 2). */
  water: (slotId: SlotId) => void
  /** Собрать созревший слот (stage === 2) → +1 в инвентарь. */
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

      plant: (slotId) =>
        set((s) => ({
          slots: s.slots.map((slot) =>
            slot.id === slotId && !slot.crop
              ? { ...slot, crop: s.selectedSeed, stage: 0, watered: false }
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
          return {
            slots: s.slots.map((x) =>
              x.id === slotId
                ? { ...x, crop: null, stage: 0, watered: false }
                : x,
            ),
            inventory: { ...s.inventory, [crop]: s.inventory[crop] + 1 },
          }
        }),

      endDay: () =>
        set((s) => {
          const slots = s.slots.map((slot): Slot => {
            if (!slot.crop) return { ...slot, watered: false }
            if (slot.watered) {
              const stage = Math.min(2, slot.stage + 1) as Stage
              return { ...slot, stage, watered: false }
            }
            // Не полили: растущее погибает, созревшее (stage 2) остаётся.
            if (slot.stage < 2) {
              return { ...slot, crop: null, stage: 0, watered: false }
            }
            return { ...slot, watered: false }
          })
          const day = s.day + 1
          const phase: Phase = day > 6 ? 'truck' : 'farm'
          // На дне 7 открываем фудтрек — заводим очередь и таймер.
          const truck = phase === 'truck' ? initialTruck() : s.truck
          return { slots, day, phase, truck }
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
            return { truck: { ...t, timeLeft: 0, ended: true } }
          }
          // Терпение убывает, ушедших клиентов убираем.
          let queue = t.queue
            .map((c) => ({ ...c, patience: c.patience - dt }))
            .filter((c) => c.patience > 0)
          let spawnTimer = t.spawnTimer + dt
          let nextSpawnIn = t.nextSpawnIn
          if (spawnTimer >= nextSpawnIn && queue.length < MAX_QUEUE) {
            spawnTimer = 0
            nextSpawnIn = 3 + Math.random() * 3
            const want = RECIPE_IDS[Math.floor(Math.random() * RECIPE_IDS.length)]
            queue = [...queue, { want, patience: PATIENCE, maxPatience: PATIENCE }]
          }
          return { truck: { ...t, timeLeft, queue, spawnTimer, nextSpawnIn } }
        }),

      serveCustomer: (recipeId) => {
        const s = get()
        const t = s.truck
        if (!t || t.ended || t.queue.length === 0) return 'no-customer'
        const front = t.queue[0]
        if (front.want !== recipeId) return 'wrong-dish'
        const recipe = RECIPES[recipeId]
        const needs = Object.keys(recipe.needs) as CropId[]
        if (needs.some((crop) => s.inventory[crop] < (recipe.needs[crop] ?? 0))) {
          return 'no-ingredients'
        }
        const inventory = { ...s.inventory }
        for (const crop of needs) inventory[crop] -= recipe.needs[crop] ?? 0
        set({
          inventory,
          money: s.money + recipe.price,
          truck: { ...t, served: t.served + 1, queue: t.queue.slice(1) },
        })
        return 'ok'
      },

      nextWeek: () =>
        set(() => ({
          day: 1,
          phase: 'farm',
          slots: emptySlots(),
          truck: null,
        })),

      resetGame: () => set(initialData()),
    }),
    {
      name: 'farm-truck',
      storage,
      // v1: грядка стала 3-слотовой, появился инструмент. Сохранения v0 держат
      // 12 слотов — их id (`bed:3`) больше не существуют, поэтому грядки
      // сбрасываем; деньги, инвентарь и день игрока остаются.
      version: 1,
      migrate: (persisted, from) => {
        const s = persisted as Partial<GameData>
        if (from >= 1) return s as GameData
        return { ...s, slots: emptySlots(), tool: 'seed' } as GameData
      },
      // Персистим только данные, не экшены.
      partialize: (s): GameData => ({
        day: s.day,
        phase: s.phase,
        money: s.money,
        slots: s.slots,
        inventory: s.inventory,
        selectedSeed: s.selectedSeed,
        tool: s.tool,
        truck: s.truck,
      }),
    },
  ),
)

// Доступ к стору из DevTools / скриншот-харнеса.
if (typeof window !== 'undefined') {
  ;(window as unknown as { __game?: unknown }).__game = useGameStore
}
