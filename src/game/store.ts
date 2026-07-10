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
import { resetClock } from './dayClock'
import { emptyToolbar, moveItem, reconcileToolbar, type ToolbarLayout } from './toolbar'
import { BUILDABLES, nextRot, placeable, type Placement } from './buildables'
import type { Placed, Rot } from './grid'
import type { CropId, ForageId, Inventory, ItemId, Seeds } from './items'

// Предметы живут в items.ts — иначе store и toolbar импортировали бы друг
// друга по кругу. Реэкспорт, чтобы остальной код по-прежнему брал их отсюда.
export { CROPS, FORAGE_IDS, ITEM_IDS } from './items'
export type { CropId, ForageId, Inventory, ItemId, Seeds } from './items'
export type { BuildableId, Placement } from './buildables'

export type RecipeId = 'salad' | 'soup' | 'taco' | 'mushroom_soup' | 'omelette'
export type Phase = 'farm' | 'truck'
export type Stage = 0 | 1 | 2

/** Чем игрок действует по слоту: сажает, поливает или собирает руками. */
export type Tool = 'seed' | 'can' | 'hand'

/**
 * slotId = `${placementId}:${slotIndex}`. Грядок может стать больше или меньше,
 * поэтому в id стоит id размещения, а не его номер в массиве: переставленная
 * грядка не должна забирать чужой урожай.
 */
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
  | 'no-food'
  | 'harvest'
  | 'withered'
  | 'too-far'
  | 'no-seeds'
  | 'no-money'
  | 'bought'
  | 'skipped'
  | 'foraged'
  | 'recipe-found'

export interface Notice {
  id: number
  kind: NoticeKind
  recipe?: RecipeId
  crop?: CropId
  item?: ForageId
  amount?: number
}

/** Сколько тостов держим на экране одновременно. */
const MAX_NOTICES = 4

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

/**
 * Три грядки, с которых начинается ферма, уже на клетках сетки.
 *
 * Координаты — те же места к востоку от дома, где грядки стояли и раньше,
 * только округлённые до клетки: сдвиг не превышает четверти метра, а поворот
 * в 86° стал ровными 90°.
 */
export const INITIAL_PLACEMENTS: readonly Placement[] = [
  { id: 'bed-1', def: 'raised_bed', gx: 7, gz: 2, rot: 0 },
  { id: 'bed-2', def: 'raised_bed', gx: 8, gz: -4, rot: 1 },
  { id: 'bed-3', def: 'raised_bed', gx: 10, gz: -4, rot: 3 },
]

/** Идентификаторы слотов посадки одного размещения. Пусто у того, во что не сеют. */
export function slotIdsOf(p: Placement): SlotId[] {
  return BUILDABLES[p.def].slotCells.map((_, i) => `${p.id}:${i}`)
}

/** Все 9 идентификаторов слотов стартовой фермы, в порядке грядка→слот. */
export const SLOT_IDS: SlotId[] = INITIAL_PLACEMENTS.flatMap(slotIdsOf)

/** id грядки из slotId (`bed-1:2`). */
export function bedOf(slotId: SlotId): string {
  return slotId.slice(0, slotId.lastIndexOf(':'))
}

export const RECIPES: Record<
  RecipeId,
  { needs: Partial<Record<ItemId, number>>; price: number }
> = {
  salad: { needs: { tomato: 1, greens: 1 }, price: 8 },
  soup: { needs: { carrot: 2 }, price: 6 },
  taco: { needs: { carrot: 1, tomato: 1, greens: 1 }, price: 14 },
  // Находки достаются даром, поэтому в обоих блюдах есть и грядочный
  // ингредиент: иначе лес кормил бы лучше фермы, и грядки стали бы не нужны.
  mushroom_soup: { needs: { mushroom: 2, carrot: 1 }, price: 12 },
  omelette: { needs: { egg: 2, greens: 1 }, price: 11 },
}

/** Что герой умеет готовить с самого начала. Остальное открывает лес. */
export const BASE_RECIPE_IDS: RecipeId[] = ['salad', 'soup', 'taco']

/** Первая находка такого вида открывает рецепт. */
export const FORAGE_RECIPE: Record<ForageId, RecipeId> = {
  mushroom: 'mushroom_soup',
  egg: 'omelette',
}

/**
 * Шанс, что за ночь находка вернётся на своё место.
 *
 * Раньше возвращались все и каждую ночь — лес отдавал 24 гриба и 12 яиц за
 * неделю при спросе в четыре и четыре. Бесплатные ингредиенты обесценивали
 * грядки, и экономика держалась только на том, что игрок не ходил в лес.
 *
 * Числа сняты со спроса. За день ярмарки игрок обслуживает 8–10 клиентов,
 * заказы равномерны по пяти рецептам — значит за неделю у него просят около
 * двух грибных супов (4 гриба) и двух яичниц (4 яйца).
 *
 * Три грибные точки при 0.2 дают ≈6 грибов за неделю: спрос закрыт с запасом.
 * Единственное гнездо при 0.5 — ≈3.5 яйца, то есть меньше двух порций. Яичница
 * так и задумана: её не наготовишь впрок.
 */
export const MUSHROOM_REGROW = 0.2
export const EGG_REGROW = 0.5

/** Шанс восстановления точки по её id (`mushroom:0`, `egg:0`). */
export function regrowChance(spotId: string): number {
  return spotId.startsWith('egg:') ? EGG_REGROW : MUSHROOM_REGROW
}

/**
 * Прогоняет ночь над собранными точками и возвращает те, что остались пустыми.
 *
 * Чистая функция с явным источником случайности: иначе ночь в лесу нельзя
 * проверить тестом, не подменяя Math.random глобально.
 */
export function regrowForage(taken: readonly string[], rand: () => number = Math.random): string[] {
  return taken.filter((id) => rand() >= regrowChance(id))
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
  const ids = Object.keys(needs) as ItemId[]
  return ids.reduce((min, item) => Math.min(min, Math.floor(inventory[item] / needs[item]!)), Infinity)
}

/**
 * Что герой прямо сейчас в состоянии приготовить. Только это и показывает меню
 * выдачи: кнопка блюда, на которое не хватает, — приглашение к ошибке.
 *
 * Список пуст — торговать нечем, и день ярмарки на этом кончается.
 */
export function cookableRecipes(knownRecipes: RecipeId[], inventory: Inventory): RecipeId[] {
  return knownRecipes.filter((r) => craftableCount(r, inventory) > 0)
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
  return { carrot: 0, greens: 0, tomato: 0, mushroom: 0, egg: 0 }
}

function startingSeeds(): Seeds {
  return { carrot: START_SEEDS, greens: START_SEEDS, tomato: START_SEEDS }
}

/** Результат подачи блюда клиенту. */
export type ServeResult = 'ok' | 'no-customer' | 'wrong-dish' | 'no-ingredients'

interface GameData {
  day: number
  phase: Phase
  money: number
  /** Что и где стоит на сетке двора. Персистится: это планировка игрока. */
  placements: Placement[]
  slots: Slot[]
  inventory: Inventory
  /** Семена на руках. Посадка тратит одно, лавка продаёт новые. */
  seeds: Seeds
  selectedSeed: CropId
  tool: Tool
  /**
   * Рецепты, которые герой уже знает. Клиенты заказывают только их: спрашивать
   * грибной суп у повара, не видевшего гриба, некому.
   */
  knownRecipes: RecipeId[]
  /**
   * Что из леса уже подобрано сегодня. Точки собирательства расставляет сцена,
   * стор помнит только их id — иначе game/ пришлось бы знать про координаты.
   * Чистится в endDay: за ночь в лесу вырастает новое.
   */
  takenForage: string[]
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
  /**
   * Играет ли фон: музыка, птицы, стрекот, гул толпы. Звуки действий (шаги,
   * вода, серп, касса) от этого флага не зависят. Имя историческое — раньше
   * кнопка глушила только музыку.
   */
  musicOn: boolean
  /**
   * Открыт ли режим планировки. Не персистится: это состояние экрана, и
   * вкладка должна открываться в игре, а не в редакторе.
   */
  buildMode: boolean
  /**
   * Объект «в руках» игрока: его id и поворот, который тот ему накрутил.
   * Пока он в руках, сам объект стоит на старом месте — по двору едет призрак.
   * Не персистится вместе с buildMode: поднятая грядка должна опуститься.
   */
  drag: { id: string; rot: Rot } | null
  /**
   * Клетки, занятые неподвижным: домом, теплицей, лавкой, деревьями. Их коробки
   * известны только по GLB, поэтому сцена считает их сама и кладёт сюда, а
   * стор принимает как данность (см. CLAUDE.md о границе game/ и scene/).
   * Не персистится: сцена пересчитает при загрузке.
   */
  staticCells: string[]
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
  /**
   * Подобрать находку. Первая находка каждого вида открывает свой рецепт.
   * Повторный вызов по той же точке ничего не делает: собрать гриб дважды нельзя.
   */
  collectForage: (spotId: string, item: ForageId) => void
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
  /** Сцена сообщает, какие клетки заняты неподвижным. Зовётся один раз. */
  setStaticCells: (cells: string[]) => void
  /** Войти в режим планировки и выйти из него. В день ярмарки не работает. */
  toggleBuild: () => void
  /** Взять объект в руки (поднять). Заново взять уже поднятый — опустить на месте. */
  grabPlacement: (id: string) => void
  /** Повернуть объект в руках на четверть оборота. */
  rotateDrag: () => void
  /** Отпустить руки, ничего не поставив (Esc). */
  cancelDrag: () => void
  /**
   * Опустить объект из рук в клетку (gx, gz) с текущим поворотом. Возвращает
   * успех: некуда — руки остаются занятыми, объект не двигается.
   * Растения переезжают вместе с грядкой: они состояние слота, а не мира.
   */
  dropPlacement: (gx: number, gz: number) => boolean
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
    placements: INITIAL_PLACEMENTS.map((p) => ({ ...p })),
    slots: emptySlots(),
    inventory: emptyInventory(),
    seeds: startingSeeds(),
    selectedSeed: 'carrot',
    tool: 'seed',
    knownRecipes: [...BASE_RECIPE_IDS],
    takenForage: [],
    truck: null,
    toolbar: reconcileToolbar(emptyToolbar(), startingSeeds(), emptyInventory()),
    shopOpen: false,
    heroColor: HERO_COLOR_DEFAULT,
    musicOn: true,
    buildMode: false,
    drag: null,
    staticCells: [],
    notices: [],
    nextNoticeId: 1,
  }
}

/**
 * Патч раскладки тулбара под новые семена/сумку. Зовётся из каждого действия,
 * которое их меняет: кончившийся предмет освобождает ячейку, появившийся
 * садится в первую свободную.
 */
function withToolbar(layout: ToolbarLayout, seeds: Seeds, inventory: Inventory) {
  return { toolbar: reconcileToolbar(layout, seeds, inventory) }
}

/**
 * Добавляет тосты, вытесняя самые старые. Возвращает патч для set().
 *
 * Несколько сразу — не роскошь: находка гриба это и «подобрал», и «открыт
 * рецепт», а два вызова подряд второй раз читали бы устаревшее s.notices.
 */
function withNotice(s: GameData, ...notices: Omit<Notice, 'id'>[]) {
  const next = [...s.notices]
  let id = s.nextNoticeId
  for (const notice of notices) next.push({ ...notice, id: id++ })
  return { notices: next.slice(-MAX_NOTICES), nextNoticeId: id }
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

      collectForage: (spotId, item) =>
        set((s) => {
          if (s.takenForage.includes(spotId)) return {}
          const recipe = FORAGE_RECIPE[item]
          const found = !s.knownRecipes.includes(recipe)
          const inventory = { ...s.inventory, [item]: s.inventory[item] + 1 }
          return {
            takenForage: [...s.takenForage, spotId],
            inventory,
            ...withToolbar(s.toolbar, s.seeds, inventory),
            knownRecipes: found ? [...s.knownRecipes, recipe] : s.knownRecipes,
            ...withNotice(
              s,
              { kind: 'foraged', item },
              ...(found ? [{ kind: 'recipe-found' as const, recipe }] : []),
            ),
          }
        }),

      // Часы суток тикают снаружи стора (см. dayClock): сутки кончились сами или
      // игрок нажал «Закончить день» — в обоих случаях наступает утро.
      endDay: () => {
        resetClock()
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
            // Планировку двора на ярмарку с собой не берут.
            buildMode: phase === 'truck' ? false : s.buildMode,
            drag: phase === 'truck' ? null : s.drag,
            // Лес отрастает не весь и не сразу: каждая собранная точка бросает
            // свой шанс вернуться (см. MUSHROOM_REGROW / EGG_REGROW).
            takenForage: regrowForage(s.takenForage),
            ...(withered ? withNotice(s, { kind: 'withered', amount: withered }) : {}),
          }
        })
      },

      serve: (recipeId) => {
        const s = get()
        if (s.phase !== 'truck') return false
        const recipe = RECIPES[recipeId]
        const needs = Object.keys(recipe.needs) as ItemId[]
        if (needs.some((item) => s.inventory[item] < (recipe.needs[item] ?? 0))) {
          return false
        }
        const inventory = { ...s.inventory }
        for (const item of needs) inventory[item] -= recipe.needs[item] ?? 0
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
          // Ни на одно блюдо не хватает — торговать нечем. Держать очередь до
          // конца таймера незачем: ничего, кроме отказов, герой ей не выдаст.
          if (!cookableRecipes(s.knownRecipes, s.inventory).length) {
            return {
              truck: { ...t, timeLeft, ended: true },
              ...withNotice(s, { kind: 'no-food' }),
            }
          }
          // Терпение убывает, ушедших клиентов убираем — и сообщаем о них.
          // Терпение убывает только у тех, кто уже сделал заказ: дорога к окну
          // его не тратит.
          const ticked = t.queue.map((c) => (c.want ? { ...c, patience: c.patience - dt } : c))
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
            queue = [
              ...queue,
              { id: nextCustomerId, want: null, patience: PATIENCE, maxPatience: PATIENCE },
            ]
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
        const needs = Object.keys(recipe.needs) as ItemId[]
        if (needs.some((item) => s.inventory[item] < (recipe.needs[item] ?? 0))) {
          set(withNotice(s, { kind: 'no-ingredients', recipe: recipeId }))
          return 'no-ingredients'
        }
        const inventory = { ...s.inventory }
        for (const item of needs) inventory[item] -= recipe.needs[item] ?? 0
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
      // остальные ещё стоят за ним и в окно не смотрят. Хочет он только то,
      // что герой умеет готовить.
      customerReady: (id) =>
        set((s) => {
          const t = s.truck
          if (!t || t.ended) return {}
          const front = t.queue[0]
          if (!front || front.id !== id || front.want) return {}
          const want = s.knownRecipes[Math.floor(Math.random() * s.knownRecipes.length)]
          return {
            truck: {
              ...t,
              queue: [{ ...front, want, patience: front.maxPatience }, ...t.queue.slice(1)],
            },
          }
        }),

      moveToolbarItem: (from, to) => set((s) => ({ toolbar: moveItem(s.toolbar, from, to) })),

      setStaticCells: (staticCells) => set({ staticCells }),

      // В день ярмарки герой за прилавком, а двор — за тридевять земель.
      toggleBuild: () =>
        set((s) =>
          s.phase === 'farm'
            ? { buildMode: !s.buildMode, drag: null }
            : { buildMode: false, drag: null },
        ),

      grabPlacement: (id) =>
        set((s) => {
          if (!s.buildMode) return {}
          const p = s.placements.find((x) => x.id === id)
          if (!p || !BUILDABLES[p.def].movable) return {}
          // Клик по уже поднятой грядке — передумал: опускаем как было.
          if (s.drag?.id === id) return { drag: null }
          return { drag: { id, rot: p.rot } }
        }),

      rotateDrag: () =>
        set((s) => (s.drag ? { drag: { ...s.drag, rot: nextRot(s.drag.rot) } } : {})),

      cancelDrag: () => set({ drag: null }),

      dropPlacement: (gx, gz) => {
        const s = get()
        if (!s.drag) return false
        const { id, rot } = s.drag
        const p = s.placements.find((x) => x.id === id)
        if (!p) return false
        const target: Placed = { gx, gz, rot }
        if (!placeable(s.placements, s.staticCells, p.def, target, id)) return false
        set({
          placements: s.placements.map((x) => (x.id === id ? { ...x, ...target } : x)),
          drag: null,
        })
        return true
      },

      // Семена, деньги и грядки переезжают в новую неделю: это и есть
      // накопленный прогресс. Даром семян больше не выдают — только лавка.
      // Грядки не подметаем: несобранный урожай и всходы — тоже труд игрока,
      // и ярмарка не повод их выкорчёвывать.
      // Знание рецептов тоже переезжает: гриб, найденный однажды, не
      // забывается. Лес, наоборот, поднимается целиком: за ярмарку и дорогу
      // обратно успевает вырасти всё, что игрок унёс.
      nextWeek: () => {
        resetClock()
        set(() => ({
          day: 1,
          phase: 'farm',
          takenForage: [],
          truck: null,
          shopOpen: false,
          buildMode: false,
          drag: null,
          notices: [],
        }))
      },

      // Музыка переживает сброс: это настройка звука, а не игровой прогресс.
      // Занятые клетки — тем более: это обмер сцены, а сцена не перезагружается.
      resetGame: () => {
        resetClock()
        set((s) => ({ ...initialData(), musicOn: s.musicOn, staticCells: s.staticCells }))
      },
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
      // v5: кнопка музыки в HUD. Старому сохранению включаем её — так было
      //     до появления кнопки, и молчащая после обновления игра выглядела
      //     бы поломкой, а не настройкой.
      // v6: появились лесные находки и открываемые рецепты. Старому сохранению
      //     дописываем нулевые находки и базовые рецепты: гриба он не видел.
      //     Своим номером, а не внутри v5: та уже уехала в прод, и сохранения
      //     на ней существуют — им находки тоже надо дописать.
      // v7: у тулбара появилась своя раскладка — предметы держатся ячеек и не
      //     сдвигаются, когда сосед кончился. Собираем её из того, чем герой
      //     владеет.
      // v8: грядки встали на сетку и научились двигаться. Позиция уехала из
      //     scene-layout.json в стор, а slotId `0:1` стал `bed-1:1`. Старые
      //     грядки садятся на ближайшие клетки, посевы переезжают вместе с ними.
      // День и инвентарь переживают все миграции.
      version: 8,
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
        if (from < 6) {
          s = {
            ...s,
            inventory: { ...emptyInventory(), ...s.inventory },
            knownRecipes: [...BASE_RECIPE_IDS],
            takenForage: [],
          }
          // Клиент из сохранения мог хотеть блюдо, которого герой ещё не знает?
          // Нет: до v6 других блюд не было. Очередь не трогаем.
        }
        if (from < 7) s = { ...s, toolbar: reconcileToolbar(emptyToolbar(), s.seeds, s.inventory) }
        if (from < 8) {
          // Грядки нумеровались индексом в scene-layout.json, слоты — `${bed}:${i}`.
          // Порядок INITIAL_PLACEMENTS повторяет тот же порядок, так что урожай
          // остаётся ровно там, где рос.
          const placements = INITIAL_PLACEMENTS.map((p) => ({ ...p }))
          s = {
            ...s,
            placements,
            slots: s.slots.map((slot) => {
              const [bed, i] = slot.id.split(':')
              const p = placements[Number(bed)]
              return p ? { ...slot, id: `${p.id}:${i}` } : slot
            }),
            buildMode: false,
            drag: null,
            staticCells: [],
          }
        }
        return s
      },
      // Персистим только данные, не экшены. Тосты — сессионные, их не храним.
      partialize: (s): GameData => ({
        day: s.day,
        phase: s.phase,
        money: s.money,
        placements: s.placements,
        slots: s.slots,
        inventory: s.inventory,
        seeds: s.seeds,
        selectedSeed: s.selectedSeed,
        tool: s.tool,
        knownRecipes: s.knownRecipes,
        takenForage: s.takenForage,
        truck: s.truck,
        toolbar: s.toolbar,
        shopOpen: false, // лавка закрывается вместе с вкладкой
        heroColor: s.heroColor,
        musicOn: s.musicOn,
        buildMode: false, // вкладка открывается в игре, а не в редакторе
        drag: null, // поднятая грядка опускается вместе с вкладкой
        staticCells: [], // обмер сцены, а не сохранение
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
