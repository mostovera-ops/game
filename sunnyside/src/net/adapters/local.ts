/**
 * local.ts — LocalBackendAdapter: полная эмуляция бэкенда в браузере/тестах.
 *
 * НАЗНАЧЕНИЕ: dev/оффлайн/тесты/Playwright-смоуки без живого Supabase. Реализует ВЕСЬ
 * контракт `BackendAdapter` (engine/contracts.ts) поверх систем движка (`@/engine/*`) и
 * контент-каталогов (`@/data/*`). Персист — IndexedDB (idb) через persist.ts; в node/vitest
 * автоматически падает на in-memory стор.
 *
 * АНТИ-ЧИТ ПАРИТЕТ (21-client §3.5, 20-backend §3.7): мутации валидируются серверно
 * (таймеры-дедлайны, инвентарь, стоимости в валюте) и реконструируют результат сами —
 * клиентские числа игнорируются, тот же контракт, что у SupabaseBackendAdapter.
 *
 * ГОРОД: 25 NPC-соседей, кооп-заказы стрита, ивент с ботами (town.ts) — делают
 * мультиплеер-механики тестируемыми оффлайн (11-town / 10-server-event). Недельный
 * rollover — лениво по serverNow (clock-система, canon §2.3).
 *
 * ЧАСЫ: инъектируемый `clock` (по умолчанию Date.now) — тест «перематывает» время и
 * наблюдает рост грядок/крафта/котла и rollover.
 *
 * ГРАНИЦА: владелец файла — агент net-local (AGENTS.md). `net/` может импортировать
 * `@/engine`, `@/data`, `@/types`. Ноль scene/three.
 */

import type {
  BackendAdapter,
  RealtimeHandler,
  Unsubscribe,
} from '@/engine/contracts'
import type {
  RpcResult,
  RpcErrorCode,
  UUID,
  EpochMs,
  Quality,
  ProductKey,
  StorageKind,
  Wallet,
  FarmSnapshot,
  InventorySnapshot,
  InventoryItem,
  ServerCalendar,
  DemandBoard,
  TownSnapshot,
  Stall,
  Contest,
  EventSnapshot,
  AppetiteMeter,
  EventMilestone,
  ProgressionSnapshot,
  CollectionsSnapshot,
  MailForagingSnapshot,
  MachineJob,
  FairLot,
  Expedition,
  MailOrder,
  CollectedItem,
  LedgerEntry,
  CurrencyKey,
  BuildingKey,
  FarmValueAxes,
  SowReq, SowRes,
  WaterReq, WaterRes,
  HarvestReq, HarvestRes,
  CraftStartReq, CraftStartRes,
  CraftCollectReq, CraftCollectRes,
  SellToMarketReq, SellToMarketRes,
  BuildingUpgradeReq, BuildingUpgradeRes,
  FeedAnimalReq, FeedAnimalRes,
  CollectAnimalProductReq, CollectAnimalProductRes,
  RenamePetReq, AffectionGiftReq, AffectionGiftRes,
  FairOpenReq, FairOpenRes,
  FairListReq, FairListRes,
  FairTentUpgradeRes,
  ContestEnterReq, ContestEnterRes,
  ContestVoteReq,
  ShiftSubmitReq, ShiftSubmitRes,
  CoopContributeReq, CoopContributeRes,
  PotluckContributeReq, PotluckContributeRes,
  EventContributeReq, EventContributeRes,
  HelpNeighborReq, GiftSendReq, NeighborSitReq,
  ChatPostReq, ChatPostRes,
  ResearchStartReq, ResearchStartRes,
  StaffAssignReq, StaffUpgradeReq, StaffUpgradeRes,
  ExpeditionStartReq, ExpeditionStartRes,
  ExpeditionCollectReq, ExpeditionCollectRes,
  MailOrderReq, MailOrderRes,
  MailSpeedupReq, MailSpeedupRes,
  MailClaimReq, MailClaimRes,
  ForageClaimReq, ForageCollectReq, ForageRes, FishCastRes,
  StreakCheckRes, StreakInsureRes, VacationRes,
  DecorPurchaseReq, DecorPlaceReq, NeonSaveReq,
  RecipeExperimentReq, RecipeExperimentRes,
  PrizePullReq, PrizePullRes,
  MigrationProposeReq, MigrationProposeRes,
  MigrationVoteReq, MigrationVoteRes,
  IapVerifyReq, IapVerifyRes,
  MigrateFarmReq, MigrateFarmRes,
  TownListing,
  PhotoUploadReq, PhotoUploadRes,
  RealtimeChannelKind,
  WeekPhase,
} from '@/types'
import {
  weekNumberOf,
  weekStartOfIndex,
  buildCalendar,
  phaseAt,
  EVENT_FINALE_OFFSET,
  DAY_MS,
  HOUR_MS,
} from '@/engine/clock'
import { salePrice } from '@/engine/econ/pricing'
import { grandOpeningMultiplier, type GrandOpeningState } from '@/engine/econ/grandOpening'
import { siloCapacity, icehouseCapacity, storageUpgradeCost } from '@/engine/inventory'
import { dishFp } from '@/engine/event/conversion'
import { meterPct as calcMeterPct, hitMilestones } from '@/engine/event/milestones'
import { hashString } from '@/engine/econ/rng'
import {
  getStateContent,
  getPostcardForState,
  expeditionDurationMs,
  closedRegionsCoveringStop,
  rollExpeditionLoot,
  rollRoadEventForTrip,
  duplicatePostcardBucks,
  shouldAwardPostcard,
  totalRouteSlots,
  SCENIC_DETOUR_EXTRA_SLOTS,
  NEW_FRIEND_TICKETS,
} from '@/engine/expedition'
import {
  levelForXp,
  farmValue as computeFarmValue,
  type FarmValueInput,
} from '@/engine/progression'
import { animals as animalDefs } from '@/data/catalogs/animals'
import { knowHowNodes } from '@/data/catalogs/knowHow'

import {
  productInfo,
  cropForSeed,
  cropInfo,
  recipe as recipeDef,
  machine as machineDef,
  building as buildingDef,
  demandMultiplier,
} from '../local/catalog'
import {
  createInitialWorld,
  nextId,
  MOVING_VAN_COOLDOWN_MS,
  GRAND_REOPENING_MS,
  type LocalWorld,
} from '../local/world'
import { createWorldStore, type WorldStore } from '../local/persist'
import {
  simulateTown,
  catchUpRollover,
  generateCoopOrders,
  generateContests,
  generateTownListings,
  quorumFor,
  simulateBotVotes,
} from '../local/town'

// ── Константы локального сервера ────────────────────────────────────────────────────
const DEFAULT_USER_ID = 'local-dev-player'
const DEFAULT_TOWN_ID = 'local-town'
/** Пассивная скорость ярмарки (units/час на лот) — для тестируемой продажи оффлайн. */
const FAIR_SALE_UNITS_PER_HOUR = 4
/** Окно эффективности полива и продление wateredUntil. */
const WATER_WINDOW_MS = 30 * 60 * 1000
/**
 * NET-6: паритет качества сбора с сервером (0011 public.harvest / game_configs.harvest_quality,
 * 02-farm §3.6/§4.3). P(Select) = база + бонус вовремя-полива, капается сверху; при сборе —
 * независимый бросок (Math.random). Минимальный исход всегда Normal (P3, без порчи).
 */
const HARVEST_SELECT_BASE_PCT = 0.1
const HARVEST_SELECT_WATER_BONUS_PCT = 0.15
const HARVEST_SELECT_CAP_PCT = 0.9
/** Минимальный игровой интервал между визитами «сосед полил грядки» (S4, 11-town §пуш). */
const NEIGHBOR_VISIT_COOLDOWN_MS = 2 * HOUR_MS

// ── Каталожные мини-индексы ──────────────────────────────────────────────────────────
const ANIMAL_CYCLE_MIN: Record<string, number> = {}
for (const a of animalDefs) ANIMAL_CYCLE_MIN[a.kind] = a.cycleMin
const KNOWHOW_BY_KEY = new Map<string, { pointsCost: number; studySec: number }>()
for (const n of knowHowNodes) KNOWHOW_BY_KEY.set(n.key, { pointsCost: n.pointsCost, studySec: n.studySec })

// ── Результат-хелперы ─────────────────────────────────────────────────────────────────
function ok<T>(data: T): RpcResult<T> {
  return { ok: true, data }
}
function err<T>(code: RpcErrorCode, message: string): RpcResult<T> {
  return { ok: false, error: { code, message } }
}

/**
 * Множитель Grand Opening ×2 (14-economy §3.10, mech_grand_opening) для Bucks-дохода.
 * Локальный адаптер триггерит только базовый вариант — фиксированные 7×24ч от старта
 * мира (`w.createdAt`), переживающие недельный ролловер (не привязан к серверной неделе).
 * Merge/Caravan/win-back триггеры — вне скоупа локального стаба (нет соответствующих RPC).
 */
function grandOpeningBucksMult(createdAt: EpochMs, t: EpochMs): number {
  const state: GrandOpeningState = { activatedAt: createdAt, kind: 'standard' }
  return grandOpeningMultiplier(state, t)
}

export interface LocalAdapterOptions {
  /** Инъектируемые часы (тест перематывает время). По умолчанию Date.now. */
  clock?: { now(): EpochMs }
  /** Режим персиста: 'auto' (idb в браузере / память в node), 'memory', 'idb'. */
  persist?: 'auto' | 'memory' | 'idb'
  /** Готовый стор (для тестов кросс-инстанс персиста / общего IndexedDB). Приоритетнее `persist`. */
  store?: WorldStore
  userId?: UUID
  townId?: UUID
}

export function createLocalAdapter(opts: LocalAdapterOptions = {}): BackendAdapter {
  const now = (): EpochMs => opts.clock?.now() ?? Date.now()
  const store: WorldStore = opts.store ?? createWorldStore(opts.persist ?? 'auto')
  const userId = opts.userId ?? DEFAULT_USER_ID
  const townId = opts.townId ?? DEFAULT_TOWN_ID

  let world: LocalWorld | null = null

  // ── Событийный канал (S4 нотификации, 19-ui-ux §3.1/§4.3) ──
  // local ЭМИТИТ по своим тикам (внутри `sync`, на каждое чтение снапшота) — ровно тот
  // же контракт `subscribe(channel, handler)`, каким supabase будет рассылать Realtime
  // CDC-события (20-backend §3.5). Дедуп-состояние ниже — сессионное (не персистится
  // в `LocalWorld`): переоткрытие вкладки не разряжает бэклог прошедших событий залпом,
  // ровно как первичная гидрация — не «событие» (app/notifications.ts `noteHydration`).
  const channelHandlers: Partial<Record<RealtimeChannelKind, Set<RealtimeHandler>>> = {}
  function emit(channel: RealtimeChannelKind, message: string): void {
    const set = channelHandlers[channel]
    if (!set || set.size === 0) return
    for (const h of set) h({ message })
  }
  let lastWeekPhase: WeekPhase | null = null
  const notifiedMailOrders = new Set<UUID>()
  const notifiedExpeditions = new Set<UUID>()
  const notifiedCoopOrders = new Set<UUID>()
  let lastNeighborVisitAt: EpochMs | null = null

  /**
   * «Сосед полил твои грядки» (лучший пуш жанра, 11-town §1/canon P3): раз в
   * `NEIGHBOR_VISIT_COOLDOWN_MS` игрового времени сосед поливает одну неполитую
   * растущую грядку — реальный игровой эффект (не только текст тоста), детерминирован
   * от id грядки (стабильный «визитёр» на грядку).
   */
  function simulateNeighborWatering(w: LocalWorld, t: EpochMs): void {
    if (lastNeighborVisitAt === null) {
      lastNeighborVisitAt = t // первая гидрация — не событие, только точка отсчёта
      return
    }
    if (t - lastNeighborVisitAt < NEIGHBOR_VISIT_COOLDOWN_MS) return
    const thirsty = w.plots.find((p) => p.state === 'growing' && (!p.wateredUntil || p.wateredUntil < t))
    if (!thirsty) return
    thirsty.wateredUntil = t + WATER_WINDOW_MS
    thirsty.version += 1
    lastNeighborVisitAt = t
    const neighbor = w.npcs.length > 0 ? w.npcs[hashString(thirsty.id) % w.npcs.length] : undefined
    emit('street_board', `${neighbor?.displayName ?? 'Сосед'} полил твои грядки`)
  }

  /**
   * Диф-детект доменных событий адаптера → событийный канал: почта доставлена, грузовик
   * вернулся, началась ярмарка, кооп-заказ выполнен (+ визит соседа выше). Вызывается из
   * `sync` на каждое чтение снапшота — идемпотентно (дедуп по id/фазе).
   */
  function emitDomainEvents(w: LocalWorld, t: EpochMs): void {
    const phase = phaseAt(t)
    if (lastWeekPhase !== null && lastWeekPhase !== phase && phase === 'sat_fair') {
      emit('fair', 'Ярмарка открылась — витрина ждёт сток!')
    }
    lastWeekPhase = phase

    for (const order of w.mailOrders) {
      if (order.state === 'in_transit' && t >= order.deliverAt && !notifiedMailOrders.has(order.id)) {
        notifiedMailOrders.add(order.id)
        emit('inbox', 'Пришла посылка из каталога — загляни в почту')
      }
    }

    for (const exp of w.expeditions) {
      if (exp.state === 'en_route' && t >= exp.returnAt && !notifiedExpeditions.has(exp.id)) {
        notifiedExpeditions.add(exp.id)
        const state = getStateContent(exp.stateKey)
        emit('inbox', `Грузовик вернулся из ${state?.name.ru ?? exp.stateKey}!`)
      }
    }

    for (const order of w.coopOrders) {
      if (notifiedCoopOrders.has(order.id)) continue
      const totalQty = order.requirements.reduce((s, r) => s + r.qty, 0)
      const totalFilled = order.requirements.reduce((s, r) => s + r.filled, 0)
      if (totalQty > 0 && totalFilled >= totalQty) {
        notifiedCoopOrders.add(order.id)
        emit('street_board', 'Кооп-заказ стрита выполнен — награда начислена!')
      }
    }

    simulateNeighborWatering(w, t)
  }

  // ── Жизненный цикл мира ──
  async function ensureWorld(): Promise<LocalWorld> {
    if (world) return world
    const loaded = await store.load(userId)
    if (loaded) {
      world = loaded
    } else {
      const fresh = createInitialWorld(userId, townId, now())
      fresh.coopOrders = generateCoopOrders(fresh, fresh.weekIndex)
      fresh.contests = generateContests(fresh, fresh.weekIndex)
      world = fresh
      await store.save(world)
    }
    return world
  }

  async function persist(): Promise<void> {
    if (world) await store.save(world)
  }

  /** Догнать серверное состояние к `now`: rollover, боты, дозревшие таймеры, ярмарка. */
  function sync(w: LocalWorld): void {
    const t = now()
    catchUpRollover(w, weekNumberOf(t))
    processBuildingTimers(w, t)
    processFairSales(w, t)
    simulateTown(w, t)
    // Grand Reopening (12-migration §3.3.4/§4.3) — буфф на 7 дней, снимается автоматически.
    if (w.grandReopening.active && t >= w.grandReopening.endsAt) {
      w.grandReopening = { active: false, endsAt: 0 }
    }
    emitDomainEvents(w, t)
  }

  // ── Валютный леджер ──
  function credit(w: LocalWorld, currency: CurrencyKey, amount: number, reason: string): void {
    if (amount <= 0) return
    w.wallet[currency] += amount
    pushLedger(w, currency, amount, reason)
  }
  function debit(w: LocalWorld, currency: CurrencyKey, amount: number, reason: string): boolean {
    if (amount <= 0) return true
    if (w.wallet[currency] < amount) return false
    w.wallet[currency] -= amount
    pushLedger(w, currency, -amount, reason)
    return true
  }
  function pushLedger(w: LocalWorld, currency: CurrencyKey, delta: number, reason: string): void {
    w.ledger.push({
      id: nextId(w, 'ledger'),
      currency,
      delta,
      balanceAfter: w.wallet[currency],
      reason,
      at: new Date(now()).toISOString(),
    } satisfies LedgerEntry)
    if (w.ledger.length > 500) w.ledger.splice(0, w.ledger.length - 500)
  }

  // ── Инвентарь ──
  function qtyOf(w: LocalWorld, key: ProductKey): number {
    return w.stacks.reduce((s, st) => (st.key === key ? s + st.qty : s), 0)
  }
  function usedInStorage(w: LocalWorld, kind: StorageKind): number {
    return w.stacks.reduce((s, st) => (productInfo(st.key).storage === kind ? s + st.qty : s), 0)
  }
  function storageLimit(w: LocalWorld, kind: StorageKind): number {
    if (kind === 'silo') return siloCapacity(w.buildings.bld_silo?.level ?? 1)
    if (kind === 'icehouse') return icehouseCapacity(w.buildings.bld_icehouse?.level ?? 1)
    return Number.POSITIVE_INFINITY
  }
  /** Кладёт qty с учётом лимита хранилища; вернёт реально положенное (излишек — canon E3, отбрасывается локально). */
  function addItem(w: LocalWorld, key: ProductKey, qty: number, quality: Quality): number {
    const info = productInfo(key)
    const limit = storageLimit(w, info.storage)
    const free = limit - usedInStorage(w, info.storage)
    const stored = Math.max(0, Math.min(qty, free))
    if (stored <= 0) return 0
    const stack = w.stacks.find((st) => st.key === key && st.quality === quality)
    if (stack) stack.qty += stored
    else w.stacks.push({ key, qty: stored, quality, itemClass: info.itemClass })
    return stored
  }
  /** Снимает qty (с самого низкого качества вверх). Вернёт false, если не хватило. */
  function removeItem(w: LocalWorld, key: ProductKey, qty: number): boolean {
    if (qtyOf(w, key) < qty) return false
    let remaining = qty
    const stacks = w.stacks.filter((st) => st.key === key).sort((a, b) => a.quality - b.quality)
    for (const st of stacks) {
      if (remaining <= 0) break
      const take = Math.min(st.qty, remaining)
      st.qty -= take
      remaining -= take
    }
    w.stacks = w.stacks.filter((st) => st.qty > 0)
    return true
  }

  // ── Дозревание построек / пассивные продажи ярмарки ──
  function processBuildingTimers(w: LocalWorld, t: EpochMs): void {
    for (const key of Object.keys(w.buildings) as (keyof typeof w.buildings)[]) {
      const b = w.buildings[key]
      if (b?.upgradeReadyAt && t >= b.upgradeReadyAt) {
        b.level += 1
        b.upgradeReadyAt = undefined
        b.version += 1
      }
    }
  }
  function processFairSales(w: LocalWorld, t: EpochMs): void {
    if (!w.fair.openedAt) {
      w.fairSalesCursor = t
      return
    }
    const hours = Math.max(0, (t - w.fairSalesCursor) / HOUR_MS)
    if (hours <= 0) return
    for (const lot of w.fair.lots) {
      if (lot.remaining <= 0) continue
      const sold = Math.min(lot.remaining, Math.floor(FAIR_SALE_UNITS_PER_HOUR * hours))
      if (sold <= 0) continue
      lot.remaining -= sold
      const goMult = grandOpeningBucksMult(w.createdAt, t)
      credit(w, 'bucks', Math.round(lot.price * sold * goMult), 'fair_passive_sale')
    }
    w.fairSalesCursor = t
  }

  function awardXp(w: LocalWorld, amount: number): void {
    w.xp += amount
    w.routePass.xp += amount
    // Farm Level = функция XP по мастер-кривой прогрессии (13-progression §3.5.1),
    // а не независимый счётчик — иначе уровень фермы «зависает» на 1 навсегда.
    w.farmLevel = levelForXp(w.xp).level
  }

  /**
   * Пересчитывает Farm Value по мастер-формуле прогрессии (13-progression §3.4.1)
   * из реального состояния локального мира. `animalFv`/`recipeMasteryStars`/`decorScore`
   * приходят как входы от 03-animals/04-machines/collections-декора — эти системы ещё
   * не пишут числовой вклад в `LocalWorld`, поэтому передаются нулём (честно, не выдумываем);
   * `orchardPlots` локальный мир не выделяет отдельно от полевых грядок (единый пул `plots`).
   */
  function recomputeFarmValue(w: LocalWorld): FarmValueAxes {
    const buildingLevels: Partial<Record<BuildingKey, number>> = {}
    for (const key of Object.keys(w.buildings) as BuildingKey[]) {
      const b = w.buildings[key]
      if (b) buildingLevels[key] = b.level
    }
    const input: FarmValueInput = {
      buildingLevels,
      staffLevels: Object.values(w.staff)
        .filter((s): s is NonNullable<typeof s> => !!s?.hired)
        .map((s) => s.level),
      knowHowNodeCount: Object.values(w.knowHow.nodes).filter((n) => n?.studied).length,
      fieldPlots: w.plots.length,
      orchardPlots: 0,
      animalFv: 0,
      recipeMasteryStars: 0,
      toys: Object.values(w.toys).filter((t) => t.owned).length,
      ribbons: w.ribbons.length,
      postcards: w.postcards.filter((p) => p.owned).length,
      decorScore: 0,
    }
    return computeFarmValue(input)
  }

  // ── Снапшот-билдеры ──
  function farmSnapshot(w: LocalWorld): FarmSnapshot {
    w.farmValue = recomputeFarmValue(w)
    return {
      farmId: `${w.userId}-farm`,
      farmLevel: w.farmLevel,
      plots: w.plots,
      buildings: w.buildings,
      machines: w.machines,
      animals: w.animals,
      farmValue: w.farmValue,
      vacationUntil: w.vacationUntil,
    }
  }
  function inventorySnapshot(w: LocalWorld): InventorySnapshot {
    const items: Record<ProductKey, number> = {}
    for (const st of w.stacks) items[st.key] = (items[st.key] ?? 0) + st.qty
    return {
      items,
      stacks: w.stacks.map((st) => ({ ...st } satisfies InventoryItem)),
      limits: {
        silo: siloCapacity(w.buildings.bld_silo?.level ?? 1),
        icehouse: icehouseCapacity(w.buildings.bld_icehouse?.level ?? 1),
        general: Number.POSITIVE_INFINITY,
      },
    }
  }
  function eventSnapshot(w: LocalWorld): EventSnapshot {
    const ws = weekStartOfIndex(w.weekIndex)
    const milestones: EventMilestone[] = ([25, 50, 75, 100] as const).map((pct) => ({
      pct,
      reward: milestoneReward(pct),
      hit: w.event.milestonesHit.includes(pct),
    }))
    const meter: AppetiteMeter = {
      eventKey: w.event.eventKey,
      meterPct: calcMeterPct(w.event.meterFp, w.event.goalFp),
      meterFp: w.event.meterFp,
      goalFp: w.event.goalFp,
      milestones,
      window: { opensAt: ws, closesAt: ws + EVENT_FINALE_OFFSET },
      finalAt: ws + EVENT_FINALE_OFFSET,
    }
    return {
      meter,
      personalFp: w.event.personalFp,
      streetPennant: w.event.streetPennant,
      myContribHist: w.event.contribHist,
    }
  }
  function townSnapshot(w: LocalWorld): TownSnapshot {
    return {
      townId: w.townId,
      streets: w.streets,
      projects: w.projects,
      roster: w.npcs.map((n) => ({
        userId: n.userId,
        farmId: n.farmId,
        displayName: n.displayName,
        streetId: n.streetId,
      })),
      coopOrders: w.coopOrders,
      potluck: w.potluck,
      migrations: w.migrations,
      movingVan: w.movingVan,
      grandReopening: w.grandReopening,
    }
  }
  function progressionSnapshot(w: LocalWorld): ProgressionSnapshot {
    return {
      farmId: `${w.userId}-farm`,
      farmLevel: w.farmLevel,
      xp: w.xp,
      knowHow: w.knowHow,
      staff: w.staff,
      routePass: w.routePass,
      streak: w.streak,
      staffTokens: w.staffTokens,
    }
  }

  function milestoneReward(pct: 25 | 50 | 75 | 100): string {
    // canon §3.5: 25% семена T3 · 50% декор+тикеты · 75% буст недели · 100% парад+рамка.
    switch (pct) {
      case 25: return 'T3 seeds'
      case 50: return 'decor + 🎟'
      case 75: return 'weekly boost'
      case 100: return 'parade + frame'
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════════
  // Реализация BackendAdapter
  // ══════════════════════════════════════════════════════════════════════════════════
  const adapter: BackendAdapter = {
    kind: 'local',

    // ── lifecycle / session / clock ──
    async init() {
      await ensureWorld()
    },
    async dispose() {
      await persist()
    },
    async ensureSession() {
      await ensureWorld()
      return ok({ userId })
    },
    async getServerTime() {
      return ok({ serverNow: now() })
    },

    // ── reads ──
    async getWallet() {
      const w = await ensureWorld(); sync(w); await persist()
      return ok<Wallet>({ ...w.wallet })
    },
    async getFarm() {
      const w = await ensureWorld(); sync(w); await persist()
      return ok(farmSnapshot(w))
    },
    async getInventory() {
      const w = await ensureWorld(); sync(w)
      return ok(inventorySnapshot(w))
    },
    async getCalendar() {
      const w = await ensureWorld(); sync(w); await persist()
      return ok<ServerCalendar>(buildCalendar(now(), w.townId, w.weekIndex))
    },
    async getDemandBoard() {
      const w = await ensureWorld(); sync(w)
      return ok<DemandBoard>(w.demand)
    },
    async getTown() {
      const w = await ensureWorld(); sync(w); await persist()
      return ok(townSnapshot(w))
    },
    async getFairStall() {
      const w = await ensureWorld(); sync(w); await persist()
      return ok<Stall>(w.fair)
    },
    async getContests() {
      const w = await ensureWorld(); sync(w)
      return ok<Contest[]>(w.contests)
    },
    async getEvent() {
      const w = await ensureWorld(); sync(w); await persist()
      return ok(eventSnapshot(w))
    },
    async getProgression() {
      const w = await ensureWorld(); sync(w)
      return ok(progressionSnapshot(w))
    },
    async getCollections() {
      const w = await ensureWorld()
      return ok<CollectionsSnapshot>({
        toys: w.toys,
        cosmetics: w.cosmetics,
        postcards: w.postcards,
        ribbons: w.ribbons,
      })
    },
    async getMailForaging() {
      const w = await ensureWorld(); sync(w)
      return ok<MailForagingSnapshot>({ orders: w.mailOrders, foragePoints: w.foragePoints })
    },
    async listTowns() {
      const w = await ensureWorld()
      return ok<TownListing[]>(generateTownListings(w))
    },

    // ── realtime (локально — эмитит по своим тикам, см. `emitDomainEvents`/`sync` выше) ──
    subscribe(channel, handler: RealtimeHandler): Unsubscribe {
      const set = channelHandlers[channel] ?? (channelHandlers[channel] = new Set())
      set.add(handler)
      return () => set.delete(handler)
    },

    // ── ферма/производство ──
    async sow(req: SowReq) {
      const w = await ensureWorld(); sync(w)
      const plot = w.plots.find((p) => p.slot === req.slot)
      if (!plot) return err('not_found', `нет грядки в слоте ${req.slot}`)
      if (plot.state !== 'empty') return err('conflict', 'грядка занята')
      const crop = cropForSeed(req.seedKey)
      if (!crop) return err('invalid_payload', `неизвестное семя ${req.seedKey}`)
      if (!debit(w, 'bucks', crop.seedCost, 'sow_seed')) return err('insufficient_funds', 'не хватает $ на семя')
      const t = now()
      plot.state = 'growing'
      plot.seedKey = req.seedKey
      plot.cropKey = crop.cropKey
      plot.plantedAt = t
      plot.readyAt = t + crop.growSec * 1000
      plot.quality = undefined
      plot.wateredUntil = undefined
      plot.version += 1
      await persist()
      return ok<SowRes>({ plot: { ...plot } })
    },
    async water(req: WaterReq) {
      const w = await ensureWorld(); sync(w)
      const t = now()
      let watered = 0
      for (const id of req.plotIds) {
        const plot = w.plots.find((p) => p.id === id)
        if (plot && plot.state === 'growing') {
          plot.wateredUntil = t + WATER_WINDOW_MS
          plot.version += 1
          watered += 1
        }
      }
      await persist()
      return ok<WaterRes>({ watered })
    },
    async harvest(req: HarvestReq) {
      const w = await ensureWorld(); sync(w)
      const t = now()
      const items: CollectedItem[] = []
      for (const id of req.plotIds) {
        const plot = w.plots.find((p) => p.id === id)
        if (!plot || plot.state !== 'growing' || !plot.readyAt || t < plot.readyAt) continue
        const crop = plot.cropKey ? cropInfo(plot.cropKey) : undefined
        const cropKey = plot.cropKey
        if (!crop || !cropKey) continue
        // NET-6: тот же вероятностный ролл, что и сервер (public.harvest) — не детерминированный
        // «полив → всегда Select». База +бонус полива, кап, независимый бросок при сборе.
        const pSelect = Math.min(
          HARVEST_SELECT_BASE_PCT + (plot.wateredUntil ? HARVEST_SELECT_WATER_BONUS_PCT : 0),
          HARVEST_SELECT_CAP_PCT,
        )
        const quality: Quality = Math.random() < pSelect ? 2 : 1
        addItem(w, cropKey, crop.yieldQty, quality)
        items.push({ key: cropKey, qty: crop.yieldQty, quality })
        plot.state = 'empty'
        plot.seedKey = undefined
        plot.cropKey = undefined
        plot.plantedAt = undefined
        plot.readyAt = undefined
        plot.wateredUntil = undefined
        plot.quality = undefined
        plot.version += 1
      }
      if (items.length === 0) return err('not_ready', 'ни одна грядка не готова')
      awardXp(w, items.length)
      await persist()
      return ok<HarvestRes>({ items })
    },
    async craftStart(req: CraftStartReq) {
      const w = await ensureWorld(); sync(w)
      const inst = w.machines.find((m) => m.id === req.machineId)
      if (!inst) return err('not_found', `нет станка ${req.machineId}`)
      const rec = recipeDef(req.recipeKey)
      if (!rec) return err('invalid_payload', `неизвестный рецепт ${req.recipeKey}`)
      if (rec.machineKey !== inst.key) return err('invalid_payload', 'рецепт не для этого станка')
      const cat = machineDef(inst.key)
      const slots = cat?.slots ?? 1
      const active = inst.jobs.filter((j) => j.state === 'cooking').length
      if (active >= slots) return err('cap_reached', 'все слоты станка заняты')
      const batch = Math.max(1, Math.floor(req.batch))
      // Проверка входов.
      for (const input of rec.inputs) {
        if (qtyOf(w, input.key) < input.qty * batch) {
          return err('insufficient_stock', `не хватает ${input.key}`)
        }
      }
      for (const input of rec.inputs) removeItem(w, input.key, input.qty * batch)
      const t = now()
      const job: MachineJob = {
        version: 1,
        id: nextId(w, 'job'),
        machineId: inst.id,
        recipeKey: req.recipeKey,
        batch,
        state: 'cooking',
        startedAt: t,
        readyAt: t + rec.baseCraftSec * 1000,
      }
      inst.jobs.push(job)
      await persist()
      return ok<CraftStartRes>({ job: { ...job } })
    },
    async craftCollect(req: CraftCollectReq) {
      const w = await ensureWorld(); sync(w)
      const t = now()
      const items: CollectedItem[] = []
      let masteryDelta = 0
      for (const inst of w.machines) {
        for (const job of inst.jobs) {
          if (!req.jobIds.includes(job.id)) continue
          if (job.state !== 'cooking' || t < job.readyAt) continue
          const rec = recipeDef(job.recipeKey)
          if (!rec) continue
          const qty = rec.output.qty * job.batch
          const quality: Quality = 1
          addItem(w, rec.output.key, qty, quality)
          items.push({ key: rec.output.key, qty, quality })
          masteryDelta += job.batch
          job.state = 'collected'
        }
        inst.jobs = inst.jobs.filter((j) => j.state !== 'collected')
      }
      if (items.length === 0) return err('not_ready', 'ни одно задание не готово')
      awardXp(w, masteryDelta)
      await persist()
      return ok<CraftCollectRes>({ items, masteryDelta })
    },
    async sellToMarket(req: SellToMarketReq) {
      const w = await ensureWorld(); sync(w)
      if (qtyOf(w, req.itemKey) < req.qty) return err('insufficient_stock', 'не хватает стока')
      const info = productInfo(req.itemKey)
      const demandMult = demandMultiplier(w.demand.board, info.demandCategory)
      const unit = salePrice(info.basePrice, demandMult, 1, 1)
      removeItem(w, req.itemKey, req.qty)
      const goMult = grandOpeningBucksMult(w.createdAt, now())
      const revenue = Math.round(unit * req.qty * goMult)
      credit(w, 'bucks', revenue, 'sell_to_market')
      await persist()
      return ok<SellToMarketRes>({ revenue })
    },
    async buildingUpgrade(req: BuildingUpgradeReq) {
      const w = await ensureWorld(); sync(w)
      const key = req.buildingKey as keyof typeof w.buildings
      const b = w.buildings[key]
      if (!b) return err('not_found', `нет постройки ${req.buildingKey}`)
      if (b.upgradeReadyAt) return err('conflict', 'апгрейд уже идёт')
      const def = buildingDef(req.buildingKey)
      const nextLevel = b.level + 1
      if (def && nextLevel > def.maxLevel) return err('cap_reached', 'достигнут максимум уровня')
      const levelDef = def?.levels.find((l) => l.level === nextLevel)
      const cost = levelDef?.upgradeCostBucks ?? storageUpgradeCost(nextLevel)
      const upgradeSec = levelDef?.upgradeSec ?? 300
      if (!debit(w, 'bucks', cost, 'building_upgrade')) return err('insufficient_funds', 'не хватает $')
      const readyAt = now() + upgradeSec * 1000
      b.upgradeReadyAt = readyAt
      b.version += 1
      await persist()
      return ok<BuildingUpgradeRes>({ upgradeReadyAt: readyAt })
    },

    // ── животные ──
    async feedAnimal(req: FeedAnimalReq) {
      const w = await ensureWorld(); sync(w)
      const t = now()
      let fed = 0
      for (const id of req.animalIds) {
        const a = w.animals.find((an) => an.id === id)
        if (!a) continue
        if (a.productReadyAt && t < a.productReadyAt) continue
        const cycleMin = ANIMAL_CYCLE_MIN[a.kind] ?? 30
        a.productReadyAt = t + cycleMin * 60 * 1000
        a.version += 1
        fed += 1
      }
      await persist()
      return ok<FeedAnimalRes>({ fed })
    },
    async collectAnimalProduct(req: CollectAnimalProductReq) {
      const w = await ensureWorld(); sync(w)
      const t = now()
      const items: CollectedItem[] = []
      for (const id of req.animalIds) {
        const a = w.animals.find((an) => an.id === id)
        if (!a || !a.productReadyAt || t < a.productReadyAt) continue
        const quality: Quality = a.affection >= 3 ? 2 : 1
        addItem(w, a.productKey, 1, quality)
        items.push({ key: a.productKey, qty: 1, quality })
        a.productReadyAt = undefined
        a.lastQuality = quality
        a.version += 1
      }
      if (items.length === 0) return err('not_ready', 'продукт не готов')
      await persist()
      return ok<CollectAnimalProductRes>({ items })
    },
    async renamePet(req: RenamePetReq) {
      const w = await ensureWorld()
      const a = w.animals.find((an) => an.id === req.animalId)
      if (!a) return err<void>('not_found', 'нет животного')
      a.name = req.name
      a.version += 1
      await persist()
      return ok<void>(undefined)
    },
    async affectionGift(req: AffectionGiftReq) {
      const w = await ensureWorld(); sync(w)
      const a = w.animals.find((an) => an.id === req.animalId)
      if (!a) return err('not_found', 'нет животного')
      if (!removeItem(w, req.giftKey, 1)) return err('insufficient_stock', 'нет подарка в инвентаре')
      a.affection = Math.min(5, a.affection + 1)
      a.version += 1
      await persist()
      return ok<AffectionGiftRes>({ affection: a.affection })
    },

    // ── ярмарка/смена ──
    async fairOpen(_req: FairOpenReq) {
      const w = await ensureWorld(); sync(w)
      const t = now()
      w.fair.openedAt = t
      w.fairSalesCursor = t
      w.fair.version += 1
      await persist()
      return ok<FairOpenRes>({ openedAt: t })
    },
    async fairList(req: FairListReq) {
      const w = await ensureWorld(); sync(w)
      if (req.lots.length > w.fair.displaySlots) return err('cap_reached', 'больше слотов витрины, чем есть')
      // Проверяем сток под все лоты, затем резервируем.
      for (const lot of req.lots) {
        if (qtyOf(w, lot.itemKey) < lot.qty) return err('insufficient_stock', `не хватает ${lot.itemKey}`)
      }
      const lots: FairLot[] = []
      for (const lot of req.lots) {
        removeItem(w, lot.itemKey, lot.qty)
        lots.push({
          id: nextId(w, 'lot'),
          itemKey: lot.itemKey,
          qty: lot.qty,
          remaining: lot.qty,
          quality: lot.quality,
          price: lot.price,
        })
      }
      w.fair.lots = lots
      if (!w.fair.openedAt) {
        w.fair.openedAt = now()
        w.fairSalesCursor = now()
      }
      w.fair.version += 1
      await persist()
      return ok<FairListRes>({ stall: { ...w.fair } })
    },
    async fairTentUpgrade() {
      const w = await ensureWorld(); sync(w)
      const cost = 200 * w.fair.level // простая линейная гипотеза; мастер — 09-fair
      if (!debit(w, 'bucks', cost, 'fair_tent_upgrade')) return err('insufficient_funds', 'не хватает $')
      w.fair.level += 1
      w.fair.displaySlots += 1
      w.fair.version += 1
      await persist()
      return ok<FairTentUpgradeRes>({ stallLevel: w.fair.level, displaySlots: w.fair.displaySlots })
    },
    async contestEnter(req: ContestEnterReq) {
      const w = await ensureWorld(); sync(w)
      const contest = w.contests.find((c) => c.key === req.contestKey)
      if (!contest) return err('not_found', 'нет такого конкурса')
      if (contest.phase !== 'entry') return err('window_closed', 'приём заявок закрыт')
      if (contest.myEntry) return err('conflict', 'уже подана заявка')
      const entryId = nextId(w, 'entry')
      const entry = { id: entryId, playerId: w.userId, payload: req.payload, votes: 0 }
      contest.entries.push(entry)
      contest.myEntry = entry
      await persist()
      return ok<ContestEnterRes>({ entryId })
    },
    async contestVote(req: ContestVoteReq) {
      const w = await ensureWorld(); sync(w)
      const contest = w.contests.find((c) => c.id === req.contestId)
      if (!contest) return err<void>('not_found', 'нет конкурса')
      const entry = contest.entries.find((e) => e.id === req.entryId)
      if (!entry) return err<void>('not_found', 'нет заявки')
      entry.votes += 1
      await persist()
      return ok<void>(undefined)
    },
    async shiftSubmit(req: ShiftSubmitReq) {
      const w = await ensureWorld(); sync(w)
      // Сервер реконструирует итог из фактически списанного стока (анти-чит §3.6).
      let revenue = 0
      for (const s of req.shiftLog.soldStock) {
        const have = qtyOf(w, s.itemKey)
        const sell = Math.min(have, s.qty)
        if (sell <= 0) continue
        removeItem(w, s.itemKey, sell)
        revenue += productInfo(s.itemKey).basePrice * sell
      }
      const tips = Math.round(revenue * 0.15)
      const fairScore = Math.round(revenue)
      const goMult = grandOpeningBucksMult(w.createdAt, now())
      credit(w, 'bucks', Math.round((revenue + tips) * goMult), 'shift_revenue')
      awardXp(w, req.shiftLog.served)
      await persist()
      return ok<ShiftSubmitRes>({ tips, fairScore, tickets: 0, fp: 0 })
    },

    // ── кооп/город/ивент ──
    async coopContribute(req: CoopContributeReq) {
      const w = await ensureWorld(); sync(w)
      const order = w.coopOrders.find((o) => o.id === req.orderId)
      if (!order) return err('not_found', 'нет кооп-заказа')
      if (now() > order.deadlineAt) return err('window_closed', 'дедлайн кооп-заказа прошёл')
      const requirement = order.requirements.find((r) => r.itemKey === req.itemKey)
      if (!requirement) return err('invalid_payload', 'этот предмет не нужен заказу')
      if (qtyOf(w, req.itemKey) < req.qty) return err('insufficient_stock', 'не хватает стока')
      const add = Math.min(req.qty, requirement.qty - requirement.filled)
      if (add <= 0) return err('conflict', 'требование уже закрыто')
      removeItem(w, req.itemKey, add)
      requirement.filled += add
      order.myContribution[req.itemKey] = (order.myContribution[req.itemKey] ?? 0) + add
      order.version += 1
      const totalQty = order.requirements.reduce((s, r) => s + r.qty, 0)
      const totalFilled = order.requirements.reduce((s, r) => s + r.filled, 0)
      const progress = totalQty > 0 ? (100 * totalFilled) / totalQty : 100
      if (totalFilled >= totalQty) credit(w, 'tickets', 5, 'coop_reward')
      await persist()
      return ok<CoopContributeRes>({ progress })
    },
    async potluckContribute(req: PotluckContributeReq) {
      const w = await ensureWorld(); sync(w)
      if (qtyOf(w, req.itemKey) < req.qty) return err('insufficient_stock', 'не хватает стока')
      removeItem(w, req.itemKey, req.qty)
      const score = productInfo(req.itemKey).basePrice * req.qty
      w.potluck.totalScore += score
      w.potluck.myScore += score
      if (w.potluck.totalScore >= 1000) w.potluck.buffActive = true
      await persist()
      return ok<PotluckContributeRes>({ totalScore: w.potluck.totalScore })
    },
    async eventContribute(req: EventContributeReq) {
      const w = await ensureWorld(); sync(w)
      if (qtyOf(w, req.itemKey) < req.qty) return err('insufficient_stock', 'не хватает стока')
      removeItem(w, req.itemKey, req.qty)
      const tier = productInfo(req.itemKey).tier
      const perUnit = dishFp({ tier, stars: 0, channel: req.channel })
      const fp = perUnit * req.qty
      const prevFp = w.event.meterFp
      w.event.meterFp += fp
      w.event.personalFp += fp
      w.event.contribHist.push({
        playerId: w.userId,
        itemKey: req.itemKey,
        qty: req.qty,
        fp,
        channel: req.channel,
        at: now(),
      })
      const crossed = hitMilestones(w.event.meterFp, w.event.goalFp)
        .filter((p): p is 25 | 50 | 75 | 100 => p === 25 || p === 50 || p === 75 || p === 100)
        .filter((p) => !w.event.milestonesHit.includes(p) && (prevFp / w.event.goalFp) * 100 < p)
      for (const p of crossed) if (!w.event.milestonesHit.includes(p)) w.event.milestonesHit.push(p)
      await persist()
      return ok<EventContributeRes>({
        meterPct: calcMeterPct(w.event.meterFp, w.event.goalFp),
        personalFp: w.event.personalFp,
        milestonesHit: crossed,
      })
    },

    // ── соц ──
    async helpNeighbor(req: HelpNeighborReq) {
      const w = await ensureWorld()
      if (!w.npcs.some((n) => n.userId === req.targetId)) return err<void>('not_found', 'нет соседа')
      return ok<void>(undefined)
    },
    async giftSend(req: GiftSendReq) {
      const w = await ensureWorld(); sync(w)
      if (!w.npcs.some((n) => n.userId === req.toId)) return err<void>('not_found', 'нет соседа')
      if (!removeItem(w, req.itemKey, req.qty)) return err<void>('insufficient_stock', 'нет стока для подарка')
      await persist()
      return ok<void>(undefined)
    },
    async neighborSit(req: NeighborSitReq) {
      const w = await ensureWorld()
      if (!w.npcs.some((n) => n.userId === req.hostId)) return err<void>('not_found', 'нет соседа')
      return ok<void>(undefined)
    },
    async chatPost(_req: ChatPostReq) {
      const w = await ensureWorld()
      return ok<ChatPostRes>({ messageId: nextId(w, 'msg') })
    },

    // ── прогрессия/стафф ──
    async researchStart(req: ResearchStartReq) {
      const w = await ensureWorld(); sync(w)
      const nodeCfg = KNOWHOW_BY_KEY.get(req.nodeKey)
      if (!nodeCfg) return err('invalid_payload', 'неизвестный узел know-how')
      if (w.knowHow.points < nodeCfg.pointsCost) return err('insufficient_funds', 'не хватает очков know-how')
      const existing = w.knowHow.nodes[req.nodeKey]
      if (existing?.studied) return err('conflict', 'узел уже изучен')
      w.knowHow.points -= nodeCfg.pointsCost
      const studyReadyAt = now() + nodeCfg.studySec * 1000
      w.knowHow.nodes[req.nodeKey] = {
        version: (existing?.version ?? 0) + 1,
        key: req.nodeKey,
        branch: (knowHowNodes.find((n) => n.key === req.nodeKey)?.branch) ?? 'kh_agronomy',
        studied: nodeCfg.studySec === 0,
        studyReadyAt: nodeCfg.studySec === 0 ? undefined : studyReadyAt,
        prereqs: [],
      }
      await persist()
      return ok<ResearchStartRes>({ studyReadyAt })
    },
    async staffAssign(req: StaffAssignReq) {
      const w = await ensureWorld()
      const cur = w.staff[req.staffKey]
      w.staff[req.staffKey] = {
        version: (cur?.version ?? 0) + 1,
        key: req.staffKey,
        level: cur?.level ?? 1,
        hired: true,
        assignedPost: req.post,
      }
      await persist()
      return ok<void>(undefined)
    },
    async staffUpgrade(req: StaffUpgradeReq) {
      const w = await ensureWorld()
      const cur = w.staff[req.staffKey]
      if (!cur?.hired) return err('not_found', 'стафф не нанят')
      if (w.staffTokens < 1) return err('insufficient_funds', 'не хватает staff tokens')
      w.staffTokens -= 1
      cur.level += 1
      cur.version += 1
      await persist()
      return ok<StaffUpgradeRes>({ level: cur.level })
    },

    // ── экспедиции/почта/фуражинг ──
    async expeditionStart(req: ExpeditionStartReq) {
      const w = await ensureWorld(); sync(w)
      if (!getStateContent(req.stateKey)) {
        return err('not_found', `штат «${req.stateKey}» отсутствует в каталоге states.ts`)
      }
      // X3 (07-expeditions): без свободного слота маршрута — отказ, апселл на Route Slots.
      // Апгрейды Route Slots/Speed/Capacity (§3.4) пока не персистятся в LocalWorld
      // (нет building/RPC для веток грузовика) — TODO(truck-агент): завести состояние
      // и передавать реальные уровни сюда вместо базовых значений (1 слот, Speed 0).
      const hasStaffBuck = w.staff.staff_buck?.hired === true && w.staff.staff_buck?.assignedPost === 'Yard'
      const activeCount = w.expeditions.filter((e) => e.state === 'en_route').length
      if (activeCount >= totalRouteSlots(1, hasStaffBuck)) {
        return err('cap_reached', 'все грузовики в пути — нет свободного слота маршрута')
      }
      const hasStaffGus = w.staff.staff_gus?.hired === true && w.staff.staff_gus?.assignedPost === 'Yard'
      const ownedStates = new Set(w.postcards.filter((p) => p.owned && p.stateKey).map((p) => p.stateKey!))
      const durMs = expeditionDurationMs({
        stateKey: req.stateKey,
        speedLevel: 0,
        hasStaffGus,
        closedRegionsCoveringStop: closedRegionsCoveringStop(req.stateKey, ownedStates),
      })
      const t = now()
      const exp: Expedition = {
        version: 1,
        id: nextId(w, 'exp'),
        stateKey: req.stateKey,
        routeSlot: req.routeSlot,
        state: 'en_route',
        startedAt: t,
        returnAt: t + durMs,
      }
      w.expeditions.push(exp)
      await persist()
      return ok<ExpeditionStartRes>({ expedition: { ...exp } })
    },
    async expeditionCollect(req: ExpeditionCollectReq) {
      const w = await ensureWorld(); sync(w)
      const t = now()
      const items: CollectedItem[] = []
      for (const exp of w.expeditions) {
        if (!req.expIds.includes(exp.id)) continue
        if (exp.state === 'collected' || t < exp.returnAt) continue

        const tier = getStateContent(exp.stateKey)?.tier ?? 1
        // Сид рейса — детерминирован от id экспедиции (стабилен между collect-попытками).
        const seed = hashString(exp.id)
        const event = rollRoadEventForTrip(seed, false) // основной рейс, не Truck Contract (§3.8/§4.4)
        const loot = rollExpeditionLoot({
          stateKey: exp.stateKey,
          capacityLevel: 0, // TODO(truck-агент): см. комментарий в expeditionStart
          extraSlots: event === 'road_scenic_detour' ? SCENIC_DETOUR_EXTRA_SLOTS : 0,
          bonusStandActive: event === 'road_bonus_stand',
          hitchhikerActive: event === 'road_hitchhiker',
          seed,
        })
        for (const l of loot.items) {
          addItem(w, l.key, l.qty, 1)
          items.push({ key: l.key, qty: l.qty, quality: 1 })
        }
        if (loot.fragmentAwarded) {
          addItem(w, loot.fragmentAwarded, 1, 1)
          items.push({ key: loot.fragmentAwarded, qty: 1, quality: 1 })
        }

        // Открытки (§3.3/§3.7, X5/X9): первый визит — гарантия, никогда не пропускается;
        // повторный — дубликат детерминированно конвертируется в `$` (road_local_fair удваивает).
        const existingPostcard = w.postcards.find((p) => p.stateKey === exp.stateKey)
        if (shouldAwardPostcard(existingPostcard?.owned ?? false)) {
          if (existingPostcard) existingPostcard.owned = true
          else {
            const def = getPostcardForState(exp.stateKey)
            w.postcards.push({ key: def?.key ?? `postcard_${exp.stateKey}`, stateKey: exp.stateKey, owned: true })
          }
        } else {
          credit(w, 'bucks', duplicatePostcardBucks(tier, event === 'road_local_fair'), 'expedition_duplicate_postcard')
        }

        // road_new_friend (§3.8) — символическая капля 🎟 Tickets.
        if (event === 'road_new_friend') credit(w, 'tickets', NEW_FRIEND_TICKETS, 'expedition_road_event')

        exp.loot = loot.items
        exp.state = 'collected'
      }
      w.expeditions = w.expeditions.filter((e) => e.state !== 'collected')
      if (items.length === 0) return err('not_ready', 'грузовик ещё в пути')
      await persist()
      return ok<ExpeditionCollectRes>({ items })
    },
    async mailOrder(req: MailOrderReq) {
      const w = await ensureWorld(); sync(w)
      if (w.mailOrders.filter((o) => o.state === 'in_transit').length >= 5) {
        return err('cap_reached', 'уже 5 заказов в пути')
      }
      const t = now()
      const order: MailOrder = {
        version: 1,
        id: nextId(w, 'mail'),
        itemKey: req.itemKey,
        qty: 1,
        state: 'in_transit',
        orderedAt: t,
        deliverAt: t + 8 * HOUR_MS,
      }
      w.mailOrders.push(order)
      await persist()
      return ok<MailOrderRes>({ orderId: order.id, deliverAt: order.deliverAt })
    },
    async mailSpeedup(req: MailSpeedupReq) {
      const w = await ensureWorld(); sync(w)
      const order = w.mailOrders.find((o) => o.id === req.orderId)
      if (!order) return err('not_found', 'нет заказа')
      if (!debit(w, 'dimes', 5, 'mail_speedup')) return err('insufficient_funds', 'не хватает ◉')
      order.deliverAt = now()
      order.version += 1
      await persist()
      return ok<MailSpeedupRes>({ deliverAt: order.deliverAt })
    },
    async mailClaim(req: MailClaimReq) {
      const w = await ensureWorld(); sync(w)
      const t = now()
      const items: CollectedItem[] = []
      for (const order of w.mailOrders) {
        if (!req.orderIds.includes(order.id)) continue
        if (order.state === 'claimed' || t < order.deliverAt) continue
        addItem(w, order.itemKey, order.qty, 1)
        items.push({ key: order.itemKey, qty: order.qty, quality: 1 })
        order.state = 'claimed'
      }
      w.mailOrders = w.mailOrders.filter((o) => o.state !== 'claimed')
      if (items.length === 0) return err('not_ready', 'заказ ещё не доставлен')
      await persist()
      return ok<MailClaimRes>({ items })
    },
    async forageClaim(req: ForageClaimReq) {
      const w = await ensureWorld(); sync(w)
      return claimForage(w, req.pointId)
    },
    async forageCollect(req: ForageCollectReq) {
      const w = await ensureWorld(); sync(w)
      return claimForage(w, req.pointId)
    },
    async fishCast() {
      const w = await ensureWorld(); sync(w)
      const catchItem = { itemKey: 'crop_catfish', quality: 1 as Quality, rarity: 'common' as const }
      addItem(w, catchItem.itemKey, 1, 1)
      await persist()
      return ok<FishCastRes>({ catch: catchItem })
    },

    // ── стрик/отпуск/декор/секретки ──
    async streakCheck() {
      const w = await ensureWorld(); sync(w)
      const today = Math.floor(now() / DAY_MS)
      if (today > w.streakLastDay) {
        // Пропущено >1 суток → заморозка (E2), иначе +1 день.
        if (today - w.streakLastDay === 1) w.streak.streakDays += 1
        else w.streak.state = 'frozen'
        w.streakLastDay = today
      }
      await persist()
      return ok<StreakCheckRes>({ streakDays: w.streak.streakDays, state: w.streak.state })
    },
    async streakInsure() {
      const w = await ensureWorld(); sync(w)
      if (!debit(w, 'tickets', 3, 'streak_insure')) return err('insufficient_funds', 'не хватает 🎟')
      const insuredUntil = now() + 2 * DAY_MS
      w.streak.state = 'insured'
      w.streak.insuredUntil = insuredUntil
      await persist()
      return ok<StreakInsureRes>({ insuredUntil })
    },
    async vacationStart() {
      const w = await ensureWorld()
      const vacationUntil = now() + 7 * DAY_MS
      w.vacationUntil = vacationUntil
      await persist()
      return ok<VacationRes>({ vacationUntil })
    },
    async vacationEnd() {
      const w = await ensureWorld()
      w.vacationUntil = undefined
      await persist()
      return ok<VacationRes>({ vacationUntil: now() })
    },
    async decorPurchase(req: DecorPurchaseReq) {
      const w = await ensureWorld(); sync(w)
      const price = productInfo(req.decorKey).basePrice || 100
      if (!debit(w, 'bucks', price, 'decor_purchase')) return err<void>('insufficient_funds', 'не хватает $')
      addItem(w, req.decorKey, 1, 1)
      await persist()
      return ok<void>(undefined)
    },
    async decorPlace(_req: DecorPlaceReq) {
      await ensureWorld()
      return ok<void>(undefined)
    },
    async neonSave(_req: NeonSaveReq) {
      await ensureWorld()
      return ok<void>(undefined)
    },
    async recipeExperiment(req: RecipeExperimentReq) {
      const w = await ensureWorld(); sync(w)
      // Проверяем и списываем входы эксперимента; секретку локально не открываем (result: null).
      for (const inp of req.inputs) {
        if (qtyOf(w, inp.key) < inp.qty) return err('insufficient_stock', `не хватает ${inp.key}`)
      }
      for (const inp of req.inputs) removeItem(w, inp.key, inp.qty)
      await persist()
      return ok<RecipeExperimentRes>({ result: null })
    },

    // ── коллекции/монетизация ──
    async prizePull(req: PrizePullReq) {
      const w = await ensureWorld(); sync(w)
      const count = Math.max(1, Math.floor(req.count))
      const dimeCost = 10 * count
      if (!debit(w, 'dimes', dimeCost, 'prize_pull')) return err('insufficient_funds', 'не хватает ◉')
      const results = []
      for (let i = 0; i < count; i++) {
        const toyKey = `${req.seriesKey}_${(Object.keys(w.toys).length % 8) + 1}`
        const duplicate = Boolean(w.toys[toyKey]?.owned)
        w.toys[toyKey] = {
          key: toyKey,
          series: req.seriesKey,
          owned: true,
          duplicate: (w.toys[toyKey]?.duplicate ?? 0) + (duplicate ? 1 : 0),
        }
        results.push({ toyKey, rarity: 'common' as const, duplicate })
      }
      const outcome: PrizePullRes = {
        results,
        pityAfter: { series: req.seriesKey, pullsSinceRare: 0, pullsSinceChase: 0, rareCap: 10, chaseCap: 40 },
      }
      await persist()
      return ok<PrizePullRes>(outcome)
    },

    // ── edge functions (переезды, 12-migration) ──
    async migrationPropose(req: MigrationProposeReq) {
      const w = await ensureWorld(); sync(w)
      // Одно активное предложение на цель за раз (edge case G9 — упрощённо: один на весь мир,
      // локальная симуляция не моделирует параллельные города).
      const already = w.migrations.find(
        (m) => m.kind === req.kind && now() < m.votingWindow.closesAt && m.tally.yes < m.tally.quorum,
      )
      if (already) return err('conflict', 'уже есть активное голосование этого типа')
      const t = now()
      const proposalId = nextId(w, 'mig')
      const quorum = quorumFor(w, req.kind, req.streetId)
      // Соседи «молча» голосуют детерминированно к моменту создания предложения (как боты
      // кооп/ивента, §симуляция) — игрок видит уже частично заполненный тэлли и добавляет
      // свой голос (`migrationVote`) поверх.
      const bots = simulateBotVotes(w, proposalId, req.kind, req.streetId)
      // 72ч для каравана (§3.2.1, гипотеза), календарная неделя для town_merge упрощена до
      // 7 дней от момента рассылки (§3.3.3 — точная привязка к Вс 23:59 UTC — зона clock).
      const windowMs = req.kind === 'street_caravan' ? 3 * DAY_MS : 7 * DAY_MS
      w.migrations.push({
        version: 1,
        id: proposalId,
        kind: req.kind,
        targetTownId: req.targetTown,
        streetId: req.streetId,
        votingWindow: { opensAt: t, closesAt: t + windowMs },
        tally: { yes: bots.yes, no: bots.no, quorum },
      })
      await persist()
      return ok<MigrationProposeRes>({ proposalId })
    },
    async migrationVote(req: MigrationVoteReq) {
      const w = await ensureWorld(); sync(w)
      const prop = w.migrations.find((m) => m.id === req.proposalId)
      if (!prop) return err('not_found', 'нет предложения')
      if (prop.myVote) return err('conflict', 'уже проголосовано')
      if (now() >= prop.votingWindow.closesAt) return err('window_closed', 'окно голосования закрылось')
      if (req.vote === 'yes') prop.tally.yes += 1
      else prop.tally.no += 1
      prop.myVote = req.vote
      prop.version += 1
      // Town Merge: кворум набран → сразу запускаем Grand Reopening (§3.3.4) — local-упрощение,
      // полноценный перенос стритов между городами вне зоны локальной симуляции одного мира.
      if (prop.kind === 'town_merge' && prop.tally.yes >= prop.tally.quorum && !w.grandReopening.active) {
        w.grandReopening = { active: true, endsAt: now() + GRAND_REOPENING_MS }
      }
      await persist()
      return ok<MigrationVoteRes>({ yes: prop.tally.yes, no: prop.tally.no })
    },
    async migrateFarm(req: MigrateFarmReq) {
      const w = await ensureWorld(); sync(w)
      const t = now()
      if (t < w.movingVan.cooldownUntil) {
        return err('not_ready', 'кулдаун переезда ещё не истёк')
      }
      if (req.targetTown === w.townId) {
        return err('invalid_payload', 'нельзя переехать в свой же город')
      }
      // Конвертация личного вклада в Town Projects → 🎟 Tickets (§3.4/§4.4): курс 50:1, кэп
      // 500/переезд; остаток не сгорает — переносится как carryover до следующего переезда.
      const CONVERSION_RATE = 50
      const CONVERSION_CAP_TICKETS = 500
      const totalContribution = Object.values(w.projects).reduce(
        (sum, p) => sum + (p?.myContribution ?? 0),
        0,
      )
      const ticketsRaw = Math.floor(totalContribution / CONVERSION_RATE)
      const ticketsAwarded = Math.min(ticketsRaw, CONVERSION_CAP_TICKETS)
      const convertedBucks = ticketsAwarded * CONVERSION_RATE
      const carryoverBucks = Math.max(0, totalContribution - convertedBucks)
      if (ticketsAwarded > 0) credit(w, 'tickets', ticketsAwarded, 'migration_contribution_convert')
      // Личный вклад обнуляется (уже конвертирован) — прогресс самого проекта не откатывается
      // (§3.4: «уезжающий игрок просто больше не числится вкладчиком»).
      for (const key of Object.keys(w.projects) as (keyof typeof w.projects)[]) {
        const p = w.projects[key]
        if (p) p.myContribution = 0
      }
      const cooldownUntil = t + MOVING_VAN_COOLDOWN_MS
      w.movingVan = { cooldownUntil }
      await persist()
      return ok<MigrateFarmRes>({ ticketsAwarded, convertedBucks, carryoverBucks, cooldownUntil })
    },
    async iapVerify(_req: IapVerifyReq) {
      const w = await ensureWorld()
      const dimes = 100
      credit(w, 'dimes', dimes, 'iap_grant')
      await persist()
      return ok<IapVerifyRes>({ purchaseId: nextId(w, 'iap'), dimes })
    },
    async photoUpload(_req: PhotoUploadReq) {
      const w = await ensureWorld()
      return ok<PhotoUploadRes>({ url: `local://photo/${nextId(w, 'photo')}` })
    },
  }

  // ── Общий фуражинг (claim/collect идентичны локально) ──
  function claimForage(w: LocalWorld, pointId: UUID): RpcResult<ForageRes> {
    const point = w.foragePoints.find((p) => p.id === pointId)
    if (!point) return err('not_found', 'нет точки фуражинга')
    if (point.remaining <= 0) return err('cap_reached', 'точка исчерпана на сегодня')
    point.remaining -= 1
    addItem(w, point.itemKey, 1, 1)
    void persist()
    return ok<ForageRes>({ item: { key: point.itemKey, qty: 1, quality: 1 } })
  }

  return adapter
}
