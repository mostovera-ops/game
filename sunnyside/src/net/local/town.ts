/**
 * net/local/town.ts — симуляция «города» для локального режима: 25 NPC-соседей,
 * кооп-заказы стрита, ивент с ботами, недельный rollover. Делает мультиплеер-механики
 * ТЕСТИРУЕМЫМИ оффлайн (11-town / 10-server-event).
 *
 * ПРИНЦИП: боты копят вклад детерминированно от прошедшего игрового времени
 * (serverNow), а не по таймеру реального wall-clock — поэтому тест может «перемотать»
 * инъектированные часы и увидеть, как наполняется котёл ивента / закрываются кооп-заказы.
 *
 * ГРАНИЦА: `net/` может импортировать `@/engine`, `@/types`, локальные модули.
 */

import type { EpochMs, CoopOrder, Contest, ProductKey, TownListing, MigrationKind, UUID } from '@/types'
import {
  weekStartOfIndex,
  EVENT_FINALE_OFFSET,
  FAIR_OPEN_OFFSET,
  FAIR_CLOSE_OFFSET,
  COOP_DEADLINE_OFFSET,
  HOUR_MS,
} from '@/engine/clock'
import { goal100, hitMilestones } from '@/engine/event/milestones'
import { seededRng, hashString } from '@/engine/econ/rng'
import { EVENT_KEYS } from '@/types'
import type { LocalWorld } from './world'
import { makeDemandBoard, LOCAL_NPC_COUNT } from './world'

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

// ── Кооп-заказы (canon §2.4/C11: пул стрита, ≤10 участников) ─────────────────────────

/** Базовые предметы кооп-заказов волны 1 (ранние тиры — доступны всем участникам). */
const COOP_ITEM_POOL: ProductKey[] = ['crop_tomato', 'crop_wheat', 'egg', 'milk', 'crop_corn', 'crop_potato']

/**
 * Сгенерировать 2 кооп-заказа недели. Каждый — 1–2 требования по 20–40 ед.; дедлайн —
 * Чт 23:59 (canon §2.3). Детерминирован seed(town, week).
 */
export function generateCoopOrders(world: LocalWorld, weekIndex: number): CoopOrder[] {
  const rng = seededRng((world.townSeed ^ weekIndex) >>> 0)
  const deadlineAt = weekStartOfIndex(weekIndex) + COOP_DEADLINE_OFFSET
  const orders: CoopOrder[] = []
  for (let i = 0; i < 2; i++) {
    const reqCount = 1 + (rng.next() < 0.5 ? 1 : 0)
    const items = rng.sample(COOP_ITEM_POOL, reqCount)
    orders.push({
      version: 1,
      id: `${world.townId}-coop-${weekIndex}-${i}`,
      requirements: items.map((itemKey) => ({ itemKey, qty: 20 + Math.round(rng.uniform(0, 20)), filled: 0 })),
      deadlineAt,
      myContribution: {},
      reward: '🎟 5',
    })
  }
  return orders
}

// ── Конкурсы ярмарки (canon §3.6) ────────────────────────────────────────────────────

export function generateContests(world: LocalWorld, weekIndex: number): Contest[] {
  const ws = weekStartOfIndex(weekIndex)
  const entryWindow = { opensAt: ws, closesAt: ws + FAIR_OPEN_OFFSET }
  const votingWindow = { opensAt: ws + FAIR_OPEN_OFFSET, closesAt: ws + FAIR_CLOSE_OFFSET }
  const keys = ['ct_pie_week', 'ct_giant_veg', 'ct_best_window'] as const
  return keys.map((key, i) => ({
    id: `${world.townId}-contest-${weekIndex}-${i}`,
    key,
    phase: 'entry' as const,
    entryWindow,
    votingWindow,
    entries: [],
  }))
}

// ── Симуляция ботов (ивент + кооп) от прошедшего игрового времени ────────────────────

/**
 * Догнать вклад ботов до момента `now`. Боты копят:
 *  • FP в котёл ивента — весь уикенд (week_start → event_final Вс 20:00);
 *  • предметы в кооп-заказы стрита — до дедлайна (Чт 23:59).
 * Идемпотентно по `lastSimAt` (повторный вызов без хода времени ничего не добавит).
 */
export function simulateTown(world: LocalWorld, now: EpochMs): void {
  const ws = weekStartOfIndex(world.weekIndex)

  // ── Ивент: наполнение котла ботами в окне [week_start, event_final] ──
  const evStart = ws
  const evEnd = ws + EVENT_FINALE_OFFSET
  const evFrom = clamp(world.lastSimAt, evStart, evEnd)
  const evTo = clamp(now, evStart, evEnd)
  const evHours = Math.max(0, (evTo - evFrom) / HOUR_MS)
  if (evHours > 0) {
    const cityFpPerHour = world.npcs.reduce((s, n) => s + n.eventFpPerHour, 0)
    const cap = world.event.goalFp * 1.5 // stretch-потолок 150% (event/constants)
    world.event.meterFp = Math.min(cap, world.event.meterFp + cityFpPerHour * evHours)
    // Пересчёт достигнутых базовых вех (25/50/75/100), без stretch.
    const base = hitMilestones(world.event.meterFp, world.event.goalFp).filter(
      (p): p is 25 | 50 | 75 | 100 => p === 25 || p === 50 || p === 75 || p === 100,
    )
    world.event.milestonesHit = base
  }

  // ── Кооп: боты закрывают требования в окне [week_start, coop_deadline] ──
  const coopEnd = ws + COOP_DEADLINE_OFFSET
  const coopFrom = clamp(world.lastSimAt, ws, coopEnd)
  const coopTo = clamp(now, ws, coopEnd)
  const coopHours = Math.max(0, (coopTo - coopFrom) / HOUR_MS)
  if (coopHours > 0 && world.coopOrders.length > 0) {
    const cityItemsPerHour = world.npcs.reduce((s, n) => s + n.coopItemsPerHour, 0)
    // Половину «мощности» стрита пускаем в кооп (другая половина — свои фермы соседей).
    let budget = Math.floor((cityItemsPerHour * coopHours) / 2)
    for (const order of world.coopOrders) {
      for (const req of order.requirements) {
        if (budget <= 0) break
        const need = req.qty - req.filled
        if (need <= 0) continue
        const add = Math.min(need, budget)
        req.filled += add
        budget -= add
      }
    }
  }

  world.lastSimAt = Math.max(world.lastSimAt, now)
}

// ── Недельный rollover ────────────────────────────────────────────────────────────────

/**
 * Пересобрать недельное состояние мира на неделю `weekIndex` (Вс 23:59 rollover, §2.3):
 * новый демоборд, свежий ивент/цель, кооп-заказы, конкурсы, обнулённый прилавок/potluck,
 * тик Route Pass. Растущие грядки/крафт/экспедиции (дедлайн-таймеры) переживают rollover.
 */
export function resetWeek(world: LocalWorld, weekIndex: number): void {
  world.weekIndex = weekIndex
  world.demand = makeDemandBoard(weekIndex, world.townId)

  world.fair.lots = []
  world.fair.openedAt = undefined
  world.fair.version += 1
  world.fairSalesCursor = weekStartOfIndex(weekIndex)

  const eventKey = EVENT_KEYS[weekIndex % EVENT_KEYS.length] ?? 'ev_glutton'
  world.event = {
    eventKey,
    meterFp: 0,
    goalFp: goal100(LOCAL_NPC_COUNT + 1),
    personalFp: 0,
    milestonesHit: [],
    contribHist: [],
    streetPennant: false,
  }

  world.coopOrders = generateCoopOrders(world, weekIndex)
  world.contests = generateContests(world, weekIndex)
  world.potluck = { weekIndex, totalScore: 0, myScore: 0, buffActive: false }

  // Route Pass: ровно один сезонный тик за завершённую неделю (clock: PASS_TICKS_PER_SEASON).
  world.routePass.tier = Math.min(world.routePass.tier + 1, 100)
  world.routePass.xp = 0

  // Боты стартуют с начала новой недели.
  world.lastSimAt = weekStartOfIndex(weekIndex)
}

/**
 * Догнать недельный rollover до `targetWeek` (лениво, при пересечении границы недели по
 * serverNow). Возвращает число обработанных ролловеров.
 */
export function catchUpRollover(world: LocalWorld, targetWeek: number): number {
  let count = 0
  while (world.weekIndex < targetWeek) {
    resetWeek(world, world.weekIndex + 1)
    count += 1
  }
  return count
}

// ── Town Browser (12-migration §3.1.3) ────────────────────────────────────────────────

/** Пул имён-кандидатов городов-приёмников (Americana 50-х, placeholder — не canon-ключи). */
const TOWN_NAME_POOL = [
  'Maple Grove', 'Cedar Falls', 'Pinehurst', 'Elm Corners', 'Sunnyvale Junction',
  'Clover Bend', 'Birchwood', 'Hollyhock', 'Amber Fields', 'Sparrow Crossing',
]

/**
 * Список городов, открытых для переезда (`BackendAdapter.listTowns`, §3.1.3). Детерминирован
 * от `townSeed` текущего игрока — стабильный список между вызовами/тестами. Локальная
 * симуляция не держит настоящие соседние миры: карточки — правдоподобные плейсхолдер-данные,
 * ДОСТАТОЧНЫЕ для UI Town Browser (фильтры/превью/подтверждение), не полноценные шарды.
 */
export function generateTownListings(world: LocalWorld): TownListing[] {
  const rng = seededRng((world.townSeed ^ 0x7157b40) >>> 0)
  return TOWN_NAME_POOL.map((name, i) => {
    const capacity = 200
    const residents = Math.round(rng.uniform(40, 190))
    const totalStreets = Math.max(2, Math.round(residents / 15))
    const freeStreets = residents < capacity * 0.85 ? Math.round(rng.uniform(0, 3)) : 0
    const dauAvg = Math.round(rng.uniform(15, 90))
    const hasFriends = rng.next() < 0.3
    const recommended = freeStreets >= 3 && dauAvg >= 40
    return {
      townId: `town-${world.townSeed.toString(16)}-${i}`,
      name,
      residents,
      capacity,
      freeStreets,
      totalStreets,
      dauAvg,
      languageTag: 'en',
      hasFriends,
      recommended,
    }
  })
}

// ── Голосование переездов (Street Caravan / Town Merge, §3.2.1/§3.3.3) ────────────────

/**
 * Кворум голосования (население берётся из локальной симуляции, гипотезы спеки):
 *  - `street_caravan`: 60% состава Стрита-инициатора (§3.2.1);
 *  - `town_merge`: 50% активных жителей города-донора (§3.3.3, кворум угасающего города —
 *    приёмная сторона не моделируется отдельным миром в local-симуляции);
 *  - `moving_van` не голосуется (прямой `migrateFarm`) — кворум 1 (не используется).
 */
export function quorumFor(world: LocalWorld, kind: MigrationKind, streetId?: UUID): number {
  if (kind === 'street_caravan') {
    const street = world.streets.find((s) => s.id === streetId)
    const size = (street?.memberCount ?? 0) + 1 // + сам инициатор
    return Math.max(1, Math.ceil(size * 0.6))
  }
  if (kind === 'town_merge') {
    const size = world.npcs.length + 1
    return Math.max(1, Math.ceil(size * 0.5))
  }
  return 1
}

/**
 * Симулирует голоса соседей на момент создания предложения (детерминировано от
 * `proposalId` — та же логика, что и боты кооп/ивента: чистая функция от seed, не от
 * wall-clock). Дружелюбный тон канона (P3) — соседи по умолчанию скорее «за» (70%).
 */
export function simulateBotVotes(
  world: LocalWorld,
  proposalId: string,
  kind: MigrationKind,
  streetId?: UUID,
): { yes: number; no: number } {
  const pool = kind === 'street_caravan' ? world.npcs.filter((n) => n.streetId === streetId) : world.npcs
  const rng = seededRng(hashString(proposalId))
  let yes = 0
  let no = 0
  for (let i = 0; i < pool.length; i++) {
    if (rng.next() < 0.7) yes += 1
    else no += 1
  }
  return { yes, no }
}
