/**
 * ui/shift/session.ts — ПРЕЗЕНТЕР активной смены (09-fair §3.4–§3.6). Чистый, без React/three.
 *
 * ЧТО ЭТО. Тонкий контроллер поверх `engine/fair`: держит состояние прогона смены (кого
 * обслужили / у кого таймаут) и СОБИРАЕТ view-model для DOM-компонента. Весь СКОРИНГ —
 * в движке (`scoreShift`/`nextCombo`/`comboMultiplier`/`patienceRemaining`/`generateQueue`);
 * здесь ноль формул начисления (AGENTS.md §0.3 «клиент не считает награду сам»). Очередь
 * детерминирована серверным seed (анти-чит §3.6) — движок строит её из seed, презентер лишь
 * разрешает гостей во времени и зеркалит итог для показа.
 *
 * ПОЧЕМУ ОТДЕЛЬНО ОТ КОМПОНЕНТА. Node-тестируемо (vitest, environment node — как весь engine/
 * state): ключевые взаимодействия (подача двигает комбо, таймаут сбрасывает, тотал = движок)
 * покрыты без jsdom. React-обёртка (`ShiftScreen.tsx`) — только рендер этого view-model.
 *
 * ГРАНИЦА (AGENTS.md §3): импортирует лишь `@/engine/fair`, `@/types`, локальный `./pool`.
 */

import type { Tier } from '@/types/common'
import type { ProductKey } from '@/types/ingredients'
import {
  generateQueue,
  patienceRemaining,
  phaseAt,
  nextCombo,
  comboMultiplier,
  scoreShift,
  shiftDurationSec,
  TENT_TIERS,
  type SimGuest,
  type ServedOrder,
  type OrderKind,
  type ShiftScoreResult,
  type ShiftPhase,
  type TentLevel,
} from '@/engine/fair'
import { dishByKey, type DishDef } from './pool'

// ════════════════════════════════════════════════════════════════════════════
// Состояние прогона (иммутабельное — редьюсеры возвращают новый объект)
// ════════════════════════════════════════════════════════════════════════════

/** Один разрешённый гость: обслужен (normal/blue_plate) либо таймаут (house_special). */
export interface Resolution {
  guestId: string
  kind: OrderKind
}

export interface RunState {
  seed: number
  durationSec: number
  tentLevel: TentLevel
  pool: DishDef[]
  guests: SimGuest[]
  /** В порядке разрешения — определяет последовательность комбо (движок nextCombo). */
  resolutions: Resolution[]
  /** §3.9 Carhop Peggy назначена — +15% чаевые (в скоринг движка). */
  peggy: boolean
  /** §3.9 Bookkeeper Ada — ×1.05 Bucks (в скоринг движка). */
  bucksMult: number
  /**
   * Фактически списанный сток за смену (ключ блюда → кол-во подано), собирается по мере
   * успешных подач (`resolveGuest`). Идёт в `ShiftLog.soldStock` на `shift_submit` —
   * сервер реконструирует итог именно из него (анти-чит §3.6, AGENTS.md §0.3): клиент
   * не начисляет награду сам, только сообщает, что фактически ушло с подноса.
   */
  soldStock: Partial<Record<ProductKey, number>>
}

export interface InitRunOpts {
  seed: number
  tentLevel: TentLevel
  pool: DishDef[]
  peggy?: boolean
  bucksMult?: number
}

/** Собирает прогон: длительность и очередь берутся из движка по seed/уровню палатки. */
export function initRun(opts: InitRunOpts): RunState {
  const durationSec = shiftDurationSec(opts.tentLevel)
  const dishPool = opts.pool.map((d) => ({ key: d.key, tier: d.tier }))
  const guests = generateQueue({
    seed: opts.seed,
    durationSec,
    tentLevel: opts.tentLevel,
    dishPool,
  })
  return {
    seed: opts.seed,
    durationSec,
    tentLevel: opts.tentLevel,
    pool: opts.pool,
    guests,
    resolutions: [],
    peggy: opts.peggy ?? false,
    bucksMult: opts.bucksMult ?? 1,
    soldStock: {},
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Разрешение гостей (подача / таймаут)
// ════════════════════════════════════════════════════════════════════════════

function resolvedIds(run: RunState): Set<string> {
  return new Set(run.resolutions.map((r) => r.guestId))
}

/**
 * Разрешить гостя (идемпотентно: повторное разрешение того же id игнорится).
 * `servedItems` — ключи блюд, реально снятых с подноса при успешной подаче (normal/
 * blue_plate); на таймауте (`house_special`) поднос не расходуется — не передаём.
 * Аккумулируется в `run.soldStock` для будущего `shift_submit` (см. `soldStockList`).
 */
export function resolveGuest(
  run: RunState,
  guestId: string,
  kind: OrderKind,
  servedItems?: ProductKey[],
): RunState {
  if (resolvedIds(run).has(guestId)) return run
  if (!run.guests.some((g) => g.id === guestId)) return run
  const soldStock =
    servedItems && servedItems.length > 0 ? addSoldStock(run.soldStock, servedItems) : run.soldStock
  return { ...run, resolutions: [...run.resolutions, { guestId, kind }], soldStock }
}

function addSoldStock(
  current: Partial<Record<ProductKey, number>>,
  items: ProductKey[],
): Partial<Record<ProductKey, number>> {
  const next = { ...current }
  for (const key of items) next[key] = (next[key] ?? 0) + 1
  return next
}

/** Разворачивает `run.soldStock` в форму `ShiftLog.soldStock` (стабильный порядок ключей). */
export function soldStockList(run: RunState): { itemKey: ProductKey; qty: number }[] {
  return Object.entries(run.soldStock)
    .filter((entry): entry is [string, number] => (entry[1] ?? 0) > 0)
    .map(([itemKey, qty]) => ({ itemKey: itemKey as ProductKey, qty }))
}

/**
 * Гости, уже появившиеся к `nowSec` и ещё не разрешённые, в порядке очереди (спавн).
 * Спавн — из детерминированной очереди движка (`spawnAtMs`).
 */
export function pendingGuests(run: RunState, nowSec: number): SimGuest[] {
  const done = resolvedIds(run)
  return run.guests
    .filter((g) => !done.has(g.id) && g.spawnAtMs / 1000 <= nowSec)
    .sort((a, b) => a.spawnAtMs - b.spawnAtMs)
}

/** Видимая очередь у стойки (длина по уровню палатки, §3.5/§3.6). */
export function visibleQueue(run: RunState, nowSec: number): SimGuest[] {
  return pendingGuests(run, nowSec).slice(0, TENT_TIERS[run.tentLevel].queueLen)
}

/** Остаток терпения гостя [0..1] (движок §3.5) — для колечка над головой. */
export function guestPatience(guest: SimGuest, nowSec: number): number {
  return patienceRemaining(guest, nowSec)
}

/**
 * Авто-таймаут: все ожидающие гости с истёкшим терпением → House Special (§4.6, combo сброс).
 * Вызывается компонентом на каждом тике перед рендером; порядок — по очереди (детерминизм combo).
 */
export function sweepTimeouts(run: RunState, nowSec: number): RunState {
  let next = run
  for (const g of pendingGuests(run, nowSec)) {
    if (patienceRemaining(g, nowSec) <= 0) next = resolveGuest(next, g.id, 'house_special')
  }
  return next
}

// ════════════════════════════════════════════════════════════════════════════
// Сборка ServedOrder[] и агрегаты — всё через движок (скоринг не дублируется)
// ════════════════════════════════════════════════════════════════════════════

function starsOf(run: RunState, guest: SimGuest): number {
  return dishByKey(run.pool, guest.wants.dishKey)?.stars ?? 0
}

function outcomeOf(kind: OrderKind): 'success' | 'blue_plate' | 'timeout' {
  if (kind === 'house_special') return 'timeout'
  if (kind === 'blue_plate') return 'blue_plate'
  return 'success'
}

/**
 * Разворачивает разрешения в `ServedOrder[]` движка, проставляя `comboStreak` НА МОМЕНТ подачи
 * (движок требует согласованные стрики; используем `nextCombo` при прогоне — §3.6 контракт).
 */
export function builtOrders(run: RunState): ServedOrder[] {
  const byId = new Map(run.guests.map((g) => [g.id, g]))
  const orders: ServedOrder[] = []
  let streak = 0
  for (const res of run.resolutions) {
    const g = byId.get(res.guestId)
    if (!g) continue
    orders.push({
      kind: res.kind,
      dishTiers: g.dishTiers as Tier[],
      stars: starsOf(run, g),
      comboStreak: streak,
      vip: g.vip,
    })
    streak = nextCombo(streak, outcomeOf(res.kind))
  }
  return orders
}

/** Текущий combo-стрик (после последнего разрешения) — движок nextCombo. */
export function currentCombo(run: RunState): number {
  let streak = 0
  for (const res of run.resolutions) streak = nextCombo(streak, outcomeOf(res.kind))
  return streak
}

/** Пиковый combo за смену (для «Лучшей серии» в чеке, §4.10). */
export function maxCombo(run: RunState): number {
  let streak = 0
  let max = 0
  for (const res of run.resolutions) {
    streak = nextCombo(streak, outcomeOf(res.kind))
    if (streak > max) max = streak
  }
  return max
}

/** Текущий множитель чаевых по combo (движок §3.5): 1.0 / 1.25 / 1.5 / 2.0. */
export function currentTipMultiplier(run: RunState): number {
  return comboMultiplier(currentCombo(run))
}

/** Итог смены (движок `scoreShift`) — FairScore/Bucks/Tips/tickets/served для HUD и чека. */
export function totals(run: RunState): ShiftScoreResult {
  return scoreShift(builtOrders(run), {
    peggy: run.peggy,
    tentLevel: run.tentLevel,
    bucksMult: run.bucksMult,
  })
}

// ════════════════════════════════════════════════════════════════════════════
// Сборка подноса (Tray) — это UI-сопоставление, НЕ скоринг
// ════════════════════════════════════════════════════════════════════════════

/** Мультимножество тиров, отсортированное (для сравнения подноса и заказа). */
export function tierMultiset(tiers: number[]): number[] {
  return [...tiers].sort((a, b) => a - b)
}

/**
 * Поднос собран верно, если его состав по тирам совпадает с заказом гостя (`dishTiers` движка).
 * Сопоставление по тиру — заказы движка несут тиры блюд; ключи мульти-заказа движок не хранит,
 * поэтому матч по тиру (единичный заказ = один тир = конкретное блюдо в показе).
 */
export function trayMatches(trayTiers: number[], wantTiers: number[]): boolean {
  if (trayTiers.length !== wantTiers.length) return false
  const a = tierMultiset(trayTiers)
  const b = tierMultiset(wantTiers)
  return a.every((t, i) => t === b[i])
}

// ════════════════════════════════════════════════════════════════════════════
// Тайминги смены (для полосы таймера и фазы) — из движка
// ════════════════════════════════════════════════════════════════════════════

/** Доля прошедшего времени [0..1] для полосы-таймера. */
export function elapsedFraction(run: RunState, nowSec: number): number {
  if (run.durationSec <= 0) return 1
  return Math.min(1, Math.max(0, nowSec / run.durationSec))
}

/** Смена завершена по времени. */
export function isOver(run: RunState, nowSec: number): boolean {
  return nowSec >= run.durationSec
}

/** Текущая фаза (warmup/rush/last_call) — движок §3.4. */
export function currentPhase(nowSec: number): ShiftPhase {
  return phaseAt(nowSec)
}

/** Детерминированный seed локальной очереди из времени старта (зеркалит engine/fair/system). */
export function deriveSeed(startedAtMs: number): number {
  return (((startedAtMs >>> 0) ^ 0x9e3779b9) >>> 0)
}
