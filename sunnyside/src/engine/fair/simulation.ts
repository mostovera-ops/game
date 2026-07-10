/**
 * engine/fair/simulation.ts — ДЕТЕРМИНИРОВАННАЯ генерация очереди смены (09-fair §3.4/§3.5).
 *
 * Очередь посетителей строится из серверного `seed` (анти-чит §3.6): один seed → одна
 * очередь у всех, клиент не влияет на состав. Смена тикает локально ради отзывчивости, но
 * итог (списанный сток) валидируется сервером на shift_submit — эти функции только рисуют
 * ход смены (спавн, терпение) для UI, не начисляют.
 *
 * PRNG — mulberry32 (быстрый, детерминированный, без зависимостей). Пул блюд заказа
 * приходит извне (реальный сток игрока, §3.5) — здесь только тайминг/структура очереди.
 *
 * ГРАНИЦА: ноль сети/three/store.
 */

import type { ShiftGuest, RecipeOrder } from '@/types/fair'
import type { ProductKey } from '@/types/ingredients'

import {
  PHASE_PARAMS,
  RUSH_END_SEC,
  TENT_PATIENCE_BONUS_SEC_AT_L3,
  VIP_PATIENCE_BONUS_SEC,
  WARMUP_END_SEC,
  type ShiftPhase,
  type TentLevel,
} from './constants'

/** mulberry32 — детерминированный PRNG [0,1) от 32-битного seed. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return function rng(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Фаза смены по секунде от старта (§3.4): warm-up 0–60, rush 60–480, last_call 480+. */
export function phaseAt(elapsedSec: number): ShiftPhase {
  if (elapsedSec < WARMUP_END_SEC) return 'warmup'
  if (elapsedSec < RUSH_END_SEC) return 'rush'
  return 'last_call'
}

/** Взвешенный размер заказа Rush 1–3 (50/35/15%, §3.5). Прочие фазы — равномерно в [min,max]. */
function rollOrderSize(phase: ShiftPhase, r: number): number {
  const p = PHASE_PARAMS[phase]
  if (phase === 'rush') {
    if (r < 0.5) return 1
    if (r < 0.85) return 2
    return 3
  }
  const span = p.maxOrderDishes - p.minOrderDishes
  return p.minOrderDishes + Math.round(r * span)
}

export interface GenerateQueueInput {
  seed: number
  durationSec: number
  tentLevel: TentLevel
  /**
   * Пул доступных блюд игрока (ключи + тир для скоринга). Заказ собирается ТОЛЬКО из
   * реального стока (§3.5); при узком пуле блюда повторяются, смена остаётся проходимой (F3).
   */
  dishPool: { key: ProductKey; tier: number }[]
}

/** Гость с расширенными полями симуляции (тиры блюд для scoring, флаг VIP). */
export interface SimGuest extends ShiftGuest {
  vip: boolean
  patienceSec: number
  dishTiers: number[]
}

/**
 * Строит детерминированную очередь смены по seed (§3.4/§3.5). Спавн идёт по интервалу
 * фазы до конца длительности; каждый гость получает заказ из пула, таймер терпения фазы
 * (+2 с с ур.3 палатки §3.6, +5 с VIP §3.5). Пустой пул → пустая очередь (гейт входа F2).
 */
export function generateQueue({ seed, durationSec, tentLevel, dishPool }: GenerateQueueInput): SimGuest[] {
  const guests: SimGuest[] = []
  if (dishPool.length === 0 || durationSec <= 0) return guests

  const rng = makeRng(seed)
  const patienceTentBonus = tentLevel >= 3 ? TENT_PATIENCE_BONUS_SEC_AT_L3 : 0

  let t = 0
  let index = 0
  // Первый спавн — на интервале первой фазы (не в 0.0, лёгкий разогрев).
  t += PHASE_PARAMS[phaseAt(0)].spawnIntervalSec

  while (t < durationSec) {
    const phase = phaseAt(t)
    const params = PHASE_PARAMS[phase]

    const size = rollOrderSize(phase, rng())
    const vip = rng() < params.vipChance

    const dishTiers: number[] = []
    const wants: RecipeOrder = { dishKey: dishPool[0]!.key, qty: size }
    // Собираем size блюд из пула (детерминированно), первый задаёт основной dishKey заказа.
    for (let d = 0; d < size; d++) {
      const pick = dishPool[Math.floor(rng() * dishPool.length)]!
      dishTiers.push(pick.tier)
      if (d === 0) wants.dishKey = pick.key
    }

    const patienceSec = params.patienceSec + patienceTentBonus + (vip ? VIP_PATIENCE_BONUS_SEC : 0)

    guests.push({
      id: `g${index}`,
      wants,
      patience: 1,
      spawnAtMs: Math.round(t * 1000),
      vip,
      patienceSec,
      dishTiers,
    })

    index++
    t += params.spawnIntervalSec
  }

  return guests
}

/**
 * Остаток терпения гостя [0..1] на момент `nowSec` от старта смены (§3.5, для рендера
 * колечка над головой). До спавна — 1; после истечения — 0 (таймаут → House Special).
 */
export function patienceRemaining(guest: SimGuest, nowSec: number): number {
  const spawnSec = guest.spawnAtMs / 1000
  if (nowSec <= spawnSec) return 1
  const elapsed = nowSec - spawnSec
  return Math.min(1, Math.max(0, 1 - elapsed / guest.patienceSec))
}
