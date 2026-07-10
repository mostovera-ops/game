/**
 * net/local/world.ts — модель локального «мира» (серверная истина) LocalBackendAdapter.
 *
 * Это состояние, которое настоящий бэкенд держал бы в Postgres; локально оно живёт в
 * IndexedDB (persist.ts) и мутируется RPC-методами адаптера (local.ts). Форма
 * специально плоская и сериализуемая (structuredClone-friendly): ноль классов/Map/Set,
 * только простые объекты/массивы — чтобы idb клала её без кастомной сериализации.
 *
 * ГРАНИЦА: `net/` может импортировать `@/engine`, `@/data`, `@/types`.
 */

import type {
  UUID,
  EpochMs,
  Wallet,
  Plot,
  Building,
  BuildingKey,
  MachineInstance,
  Animal,
  FarmValueAxes,
  InventoryItem,
  Stall,
  Contest,
  EventKey,
  EventContribution,
  CoopOrder,
  Potluck,
  MigrationProposal,
  Street,
  TownProjectKey,
  TownProject,
  Expedition,
  MailOrder,
  ForagePoint,
  KnowHowState,
  StaffMember,
  StaffKey,
  RoutePass,
  RegularStreak,
  Toy,
  Cosmetic,
  CosmeticKey,
  Postcard,
  Ribbon,
  LedgerEntry,
  DemandBoard,
} from '@/types'
import type { MovingVanStatus, GrandReopeningState } from '@/types'
import { EVENT_KEYS } from '@/types'
import { weekNumberOf, DAY_MS } from '@/engine/clock'
import { generateWeeklyDemand } from '@/engine/econ/demand'
import { goal100 } from '@/engine/event/milestones'
import { hashSeed, seededRng } from '@/engine/econ/rng'
import { forageDayIndex } from '@/engine/mail-foraging/forage'
import {
  FORAGE_KINDS as FORAGE_POINT_KINDS,
  INSTANCES_PER_TOWN,
  POOL_PER_INSTANCE_PER_DAY,
  type ForagePointKind,
} from '@/engine/mail-foraging/constants'

/** Мин. срок в текущем городе перед первым переездом (12-migration §3.1.2, гипотеза). */
export const MIN_TOWN_TENURE_MS = 3 * DAY_MS

/** Кулдаун личного Moving Van/каравана Стрита между переездами (12-migration §3.1.2, canon). */
export const MOVING_VAN_COOLDOWN_MS = 14 * DAY_MS

/** Длительность буффов Grand Reopening (12-migration §3.3.4/§4.3). */
export const GRAND_REOPENING_MS = 7 * DAY_MS

/**
 * Собрать `DemandBoard` (types/economy) из чистой недельной генерации спроса
 * (engine/econ/demand). Доска — по 4 метам-категориям (cat_grill/bakery/drinks/produce),
 * детерминирована seed(week, town). Ностальгия-пул для локали пуст (не тянем каталог T1
 * сюда), поэтому nostalgia = [].
 */
export function makeDemandBoard(weekIndex: number, townId: UUID): DemandBoard {
  const weekly = generateWeeklyDemand(weekIndex, townId)
  return {
    weekIndex,
    seed: weekly.seed,
    board: { ...weekly.dCat },
    nostalgia: weekly.nostalgia.map((n) => n.productKey),
  }
}

/**
 * Схема-версия мира: bump при ломающем изменении формы → persist.ts сбросит кэш.
 * v2 (ui-migration): добавлены `movingVan`/`grandReopening` (12-migration).
 * v3 (foraging-world, BL-4): `foragePoints` — спека-микс 23 инстансов (6/10/4/3,
 * §3.2.6) вместо 6 обобщённых точек; добавлены `forageDay`/`forageDailyCounts`.
 */
export const WORLD_SCHEMA_VERSION = 3

/** Симулированный сосед города (для кооп/ивент-ботов и ростера town). */
export interface LocalNpc {
  userId: UUID
  farmId: UUID
  displayName: string
  streetId: UUID
  /** Эффективные FP/час, которые сосед жертвует в котёл ивента (детерминирован seed). */
  eventFpPerHour: number
  /** Предметов/час, которыми сосед закрывает кооп-заказы стрита. */
  coopItemsPerHour: number
}

export interface LocalEventState {
  eventKey: EventKey
  meterFp: number
  goalFp: number
  personalFp: number
  milestonesHit: (25 | 50 | 75 | 100)[]
  contribHist: EventContribution[]
  streetPennant: boolean
}

/** Полная серверная истина одного игрока+города в локальном режиме. */
export interface LocalWorld {
  schemaVersion: number
  userId: UUID
  townId: UUID
  townSeed: number
  createdAt: EpochMs
  /** Последняя обработанная серверная неделя (rollover догоняет до weekNumberOf(now)). */
  weekIndex: number
  /** Момент последней симуляции ботов (кооп/ивент), для дельта-начисления. */
  lastSimAt: EpochMs

  // ── Экономика/ферма ──
  wallet: Wallet
  farmLevel: number
  xp: number
  plots: Plot[]
  buildings: Partial<Record<BuildingKey, Building>>
  machines: MachineInstance[]
  animals: Animal[]
  farmValue: FarmValueAxes
  vacationUntil?: EpochMs

  // ── Инвентарь ──
  stacks: InventoryItem[]

  // ── Ярмарка ──
  fair: Stall
  contests: Contest[]
  /** До какого момента уже прокручены пассивные продажи ярмарки. */
  fairSalesCursor: EpochMs

  // ── Ивент ──
  event: LocalEventState

  // ── Кооп/город ──
  coopOrders: CoopOrder[]
  potluck: Potluck
  migrations: MigrationProposal[]
  streets: Street[]
  projects: Partial<Record<TownProjectKey, TownProject>>
  npcs: LocalNpc[]
  /** Статус личного Moving Van (12-migration §3.1.2) — кулдаун между переездами. */
  movingVan: MovingVanStatus
  /** Grand Reopening (12-migration §3.3.4) — включается по успешному голосованию Town Merge. */
  grandReopening: GrandReopeningState

  // ── Экспедиции/почта/фуражинг ──
  expeditions: Expedition[]
  mailOrders: MailOrder[]
  foragePoints: ForagePoint[]
  /** Индекс суток фуражинга (`forageDayIndex`) последнего респавна (§3.2.2, 06:00 UTC). */
  forageDay: number
  /** Личные суточные счётчики сборов/забросов, суммарно по типу точки (не по инстансу), §3.2.3. */
  forageDailyCounts: Partial<Record<ForagePointKind, number>>

  // ── Прогрессия ──
  knowHow: KnowHowState
  staff: Partial<Record<StaffKey, StaffMember>>
  routePass: RoutePass
  streak: RegularStreak
  staffTokens: number
  /** Индекс UTC-суток последнего streak_check (детект нового дня). */
  streakLastDay: number

  // ── Коллекции ──
  toys: Record<string, Toy>
  cosmetics: Partial<Record<CosmeticKey, Cosmetic>>
  postcards: Postcard[]
  ribbons: Ribbon[]

  // ── Демоборд недели ──
  demand: DemandBoard

  // ── Аудит валют (проекция баланса) ──
  ledger: LedgerEntry[]

  /** Монотонный счётчик для генерации детерминированных id внутри сессии. */
  idCounter: number
}

// ── Пул имён соседей (50-е Americana) ────────────────────────────────────────────────
const NPC_FIRST = [
  'Betty', 'Dolores', 'Frank', 'Marge', 'Chuck', 'Eleanor', 'Gus', 'Mabel', 'Roy', 'Wanda',
  'Earl', 'Judy', 'Clyde', 'Peggy', 'Norm', 'Sylvia', 'Ray', 'Gloria', 'Herb', 'Rita',
  'Stan', 'Lorraine', 'Vern', 'Faye', 'Cliff',
]

/** Кол-во симулированных соседей (задание интегратора: 25 NPC). */
export const LOCAL_NPC_COUNT = 25

/** Имена стритов берём из канонного пула §3.3 (первые — референс-город). */
const STREET_NAMES = ['Maple Street', 'Cherry Lane', 'Honey Road', 'Chrome Avenue']

/** Кол-во стритов города: 25 соседей + игрок → 2 стрита (canon §2.4: 10–20 ферм/стрит). */
const STREET_COUNT = 2

/** Детерминированные id стритов (`${townId}-street-N`) — стабильны между запусками. */
function streetIdsFor(townId: UUID): UUID[] {
  return Array.from({ length: STREET_COUNT }, (_, s) => `${townId}-street-${s}`)
}

/** Детеминированный id: `${prefix}-${townSeed}-${n}` (стабилен между запусками). */
export function makeId(world: Pick<LocalWorld, 'townSeed'>, prefix: string, n: number): UUID {
  return `${prefix}-${world.townSeed.toString(16)}-${n}`
}

function genNpcs(townId: UUID, townSeed: number, streetIds: UUID[]): LocalNpc[] {
  const rng = seededRng(townSeed ^ 0x9e3779b9)
  const out: LocalNpc[] = []
  for (let i = 0; i < LOCAL_NPC_COUNT; i++) {
    const name = NPC_FIRST[i % NPC_FIRST.length] ?? `Neighbor ${i + 1}`
    const streetId = streetIds[i % streetIds.length] ?? streetIds[0] ?? `${townId}-street-0`
    out.push({
      userId: `npc-${townSeed.toString(16)}-${i}`,
      farmId: `npcfarm-${townSeed.toString(16)}-${i}`,
      displayName: name,
      streetId,
      // 200..1400 эффективных FP/час — 25 соседей вместе наполняют котёл за уикенд.
      eventFpPerHour: Math.round(rng.uniform(200, 1400)),
      // 2..10 предметов/час на кооп-заказы стрита.
      coopItemsPerHour: Math.round(rng.uniform(2, 10)),
    })
  }
  return out
}

/**
 * Собрать стриты, НАСЕЛЁННЫЕ фермами соседей: `Street.farmIds` = фермы npc, чей `streetId`
 * указывает на этот стрит (стабильный порядок — по индексу npc). `memberCount` = число
 * этих ферм. Town-сцена рендерит фермы прямо из `farmIds` (без обходного группирования
 * ростера — canon §2.4: улица знает свои фермы). Игрок в ростер/`farmIds` не входит
 * (его ферма — отдельный маркер сцены), поэтому счётчик считает только соседей.
 */
function genStreets(streetIds: UUID[], npcs: readonly LocalNpc[]): Street[] {
  return streetIds.map((id, s) => {
    const farmIds = npcs.filter((n) => n.streetId === id).map((n) => n.farmId)
    return {
      id,
      name: STREET_NAMES[s] ?? `Street ${s + 1}`,
      memberCount: farmIds.length,
      farmIds,
    }
  })
}

/** Начальные грядки (House Ур.1 = 6 грядок, buildings.ts эффект-текст). */
const STARTER_PLOTS = 6

function starterBuildings(): Partial<Record<BuildingKey, Building>> {
  const keys: BuildingKey[] = [
    'bld_house', 'bld_kitchen', 'bld_diner', 'bld_barn', 'bld_coop', 'bld_garage', 'bld_silo', 'bld_icehouse',
  ]
  const out: Partial<Record<BuildingKey, Building>> = {}
  for (const key of keys) out[key] = { version: 1, key, level: 1 }
  return out
}

function starterMachines(prefix: string): MachineInstance[] {
  // Стартовые станки: Grill/Oven/Churn (MVP-подмножество, достаточно для крафт-цикла).
  return ['mch_grill', 'mch_oven', 'mch_churn'].map((key, i) => ({
    id: `${prefix}-machine-${i}`,
    key,
    level: 1,
    jobs: [],
  }))
}

function starterAnimals(prefix: string): Animal[] {
  return [
    { version: 1, id: `${prefix}-animal-0`, kind: 'chicken', housing: 'bld_coop', affection: 0, productKey: 'egg' },
    { version: 1, id: `${prefix}-animal-1`, kind: 'cow', housing: 'bld_barn', affection: 0, productKey: 'milk' },
  ]
}

/**
 * Реальный продукт-ключ (существующий каталог, `data/catalogs/ingredients.ts`) по типу точки
 * фуражинга (08-mail-foraging §3.2.1/§3.2.5). `wild_beehive` реюзает обычный `honey` (нет
 * отдельного «дикого» SKU в каталоге — спека §8 ОВ-4 оставляет тег `Wild` открытым вопросом,
 * не заводим новую каталожную позицию только ради этого). Mushroom Patch отдаёт common-гриб;
 * редкий Truffle (§3.2.5, шанс) — вне скоупа BL-4 (RNG-улов не входит в респавн/лимиты).
 */
const FORAGE_ITEM_BY_KIND: Record<ForagePointKind, string> = {
  mushroom: 'crop_field_mushroom',
  berry: 'crop_blackberry',
  wild_beehive: 'honey',
  fishing: 'crop_catfish',
}

/**
 * Точки фуражинга обочины (mech_foraging, 08-mail-foraging §3.2): спека-микс §3.2.6 — 6
 * Mushroom Patch / 10 Berry Bush / 4 Wild Beehive / 3 Fishing Spot = 23 инстанса на Город
 * (`INSTANCES_PER_TOWN`), пул/инстанс/день из `POOL_PER_INSTANCE_PER_DAY` (§3.2.2).
 *
 * ID-схема `forage-<townId>-<i>` (глобальный индекс по всем 4 типам, в порядке
 * `FORAGE_POINT_KINDS`) НАМЕРЕННО зеркалит `scene/town/layout.ts` `layoutForagePoints(townId)`
 * (adapter-seams): сцена не гидрирует реальный `MailForagingSnapshot.foragePoints` (нет ещё
 * net-bootstrap подписки на снапшот в этой зоне), а рисует детерминированный клиентский
 * плейсхолдер той же формы — но с ЭТИМИ ЖЕ id, чтобы клик реально резолвил ту же точку на
 * сервере вместо честного always-404. Суммарное число точек должно совпадать с дефолтом
 * `layoutForagePoints` (23, см. её докстринг).
 */
function starterForage(townId: UUID): ForagePoint[] {
  const out: ForagePoint[] = []
  let i = 0
  for (const kind of FORAGE_POINT_KINDS) {
    const count = INSTANCES_PER_TOWN[kind]
    const pool = POOL_PER_INSTANCE_PER_DAY[kind]
    for (let k = 0; k < count; k++) {
      out.push({ id: `forage-${townId}-${i}`, kind, itemKey: FORAGE_ITEM_BY_KIND[kind], remaining: pool })
      i += 1
    }
  }
  return out
}

/**
 * Респавн точек фуражинга + сброс личных суточных лимитов (08-mail-foraging §3.2.2/§3.2.3):
 * ежедневно в 06:00 UTC (`forageDayIndex`) пул каждого инстанса восстанавливается до
 * `POOL_PER_INSTANCE_PER_DAY`, личные счётчики (`forageDailyCounts`) обнуляются. Идемпотентно
 * за сутки — повторный вызов в те же сутки фуражинга не мутирует мир (`false`). Тихое событие
 * (§4.4: респавн — без пуша), поэтому не эмитит realtime-уведомление — вызывающий (`sync`) это
 * не делает намеренно.
 */
export function respawnForageIfNeeded(world: LocalWorld, t: EpochMs): boolean {
  const day = forageDayIndex(t)
  if (world.forageDay === day) return false
  world.forageDay = day
  world.forageDailyCounts = {}
  for (const point of world.foragePoints) {
    const pool = POOL_PER_INSTANCE_PER_DAY[point.kind as ForagePointKind]
    if (pool !== undefined) point.remaining = pool
  }
  return true
}

const ZERO_FARM_VALUE: FarmValueAxes = { production: 0, buildings: 0, collections: 0, cosmetics: 0, total: 0 }

/**
 * Создать свежий мир для (userId, townId) на момент `now`. Детерминирован от townId:
 * один и тот же город → те же соседи/демоборд/сид, что и на «настоящем» сервере.
 */
export function createInitialWorld(userId: UUID, townId: UUID, now: EpochMs): LocalWorld {
  const weekIndex = weekNumberOf(now)
  const townSeed = hashSeed(0, townId)
  const prefix = `w-${townSeed.toString(16)}`

  const streetIds = streetIdsFor(townId)
  const npcs = genNpcs(townId, townSeed, streetIds)
  const streets = genStreets(streetIds, npcs)

  const plots: Plot[] = []
  for (let i = 0; i < STARTER_PLOTS; i++) {
    plots.push({ version: 1, id: `${prefix}-plot-${i}`, slot: i, state: 'empty' })
  }

  const demand = makeDemandBoard(weekIndex, townId)

  // Цель ивента считаем от эффективного актива города (соседи + игрок), canon §3.15.
  const goalFp = goal100(LOCAL_NPC_COUNT + 1)
  const eventKey: EventKey = EVENT_KEYS[weekIndex % EVENT_KEYS.length] ?? 'ev_glutton'

  return {
    schemaVersion: WORLD_SCHEMA_VERSION,
    userId,
    townId,
    townSeed,
    createdAt: now,
    weekIndex,
    lastSimAt: now,

    // Стартовый кошелёк новичка — $150 / ◉5 (18-onboarding §3.1; паритет с серверным
    // game_configs.onboarding, миграция 0015). Балансы не персистятся (анти-подмена).
    wallet: { bucks: 150, dimes: 5, tickets: 0, ribbons: 0 },
    farmLevel: 1,
    xp: 0,
    plots,
    buildings: starterBuildings(),
    machines: starterMachines(prefix),
    animals: starterAnimals(prefix),
    farmValue: { ...ZERO_FARM_VALUE },

    stacks: [],

    fair: { version: 1, id: `${prefix}-stall`, level: 1, displaySlots: 3, lots: [] },
    contests: [],
    fairSalesCursor: now,

    event: {
      eventKey,
      meterFp: 0,
      goalFp,
      personalFp: 0,
      milestonesHit: [],
      contribHist: [],
      streetPennant: false,
    },

    coopOrders: [],
    potluck: { weekIndex, totalScore: 0, myScore: 0, buffActive: false },
    migrations: [],
    streets,
    projects: {},
    npcs,
    // Мин. срок в городе перед первым переездом (§3.1.2) — не 14-дневный кулдаун, а
    // разовое "обвыкнуться" окно; после первого реального переезда migrateFarm
    // перезапишет это полным MOVING_VAN_COOLDOWN_MS.
    movingVan: { cooldownUntil: now + MIN_TOWN_TENURE_MS },
    grandReopening: { active: false, endsAt: 0 },

    expeditions: [],
    mailOrders: [],
    foragePoints: starterForage(townId),
    forageDay: forageDayIndex(now),
    forageDailyCounts: {},

    knowHow: { points: 0, activeSlots: 1, nodes: {} },
    staff: {},
    routePass: { season: 1, tier: 0, xp: 0, track: 'free', claimedFree: [], claimedPremium: [] },
    streak: { streakDays: 1, state: 'active' },
    staffTokens: 0,
    streakLastDay: Math.floor(now / 86_400_000),

    toys: {},
    cosmetics: {},
    postcards: [],
    ribbons: [],

    demand,

    ledger: [],
    idCounter: 0,
  }
}

/** Следующий детерминированный id (мутирует idCounter). */
export function nextId(world: LocalWorld, prefix: string): UUID {
  world.idCounter += 1
  return makeId(world, prefix, world.idCounter)
}
