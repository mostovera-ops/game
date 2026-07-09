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

/** slotId = `${bedIndex}:${slotIndex}` — 3 грядки × 4 слота = 12 слотов. */
export type SlotId = string

export interface Slot {
  id: SlotId
  crop: CropId | null
  stage: Stage
  watered: boolean
}

export type Inventory = Record<CropId, number>

export const BEDS = 3
export const SLOTS_PER_BED = 4

/** Все 12 идентификаторов слотов в порядке грядка→слот. */
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

function emptySlots(): Slot[] {
  return SLOT_IDS.map((id) => ({ id, crop: null, stage: 0, watered: false }))
}

function emptyInventory(): Inventory {
  return { carrot: 0, greens: 0, tomato: 0 }
}

interface GameData {
  day: number
  phase: Phase
  money: number
  slots: Slot[]
  inventory: Inventory
  selectedSeed: CropId
}

interface GameActions {
  selectSeed: (seed: CropId) => void
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

      selectSeed: (seed) => set({ selectedSeed: seed }),

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
          return { slots, day, phase }
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

      resetGame: () => set(initialData()),
    }),
    {
      name: 'farm-truck',
      storage,
      // Персистим только данные, не экшены.
      partialize: (s): GameData => ({
        day: s.day,
        phase: s.phase,
        money: s.money,
        slots: s.slots,
        inventory: s.inventory,
        selectedSeed: s.selectedSeed,
      }),
    },
  ),
)

// Доступ к стору из DevTools / скриншот-харнеса.
if (typeof window !== 'undefined') {
  ;(window as unknown as { __game?: unknown }).__game = useGameStore
}
