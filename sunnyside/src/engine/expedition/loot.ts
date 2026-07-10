/**
 * engine/expedition/loot.ts — детерминированный ролл лута рейса (§4.2/§4.3).
 *
 * Модель слотов (§4.2, дословно): «слот лута» — НЕ жёсткая привязка «1 слот = 1
 * строка», а независимый ролл по ВСЕМ строкам таблицы стопа. Слот 1 всегда
 * закрывает форс топ-строку (100%, гарантия непустого рейса, P3). Каждый
 * следующий слот (сверх Capacity, включая `road_scenic_detour`, §3.8) снова
 * роллит по ВСЕМ строкам (форс-строка тоже, её шанс буквально 100% — значит
 * дополнительный слот детерминированно добавляет ещё одну порцию форс-продукта);
 * попадание в уже заполненную строку — стек (`+= baseQty × multiplier`).
 *
 * Фрагмент рецепта — независимый исход (не стекается количеством, либо есть,
 * либо нет за рейс); `road_hitchhiker` форсит его к гарантии (§3.8/§4.3).
 *
 * АНТИ-ЧИТ: чистая функция для UI-предпросмотра/локального теста распределения —
 * сервер (`expedition_collect`) — источник истины фактического лута (AGENTS.md §0.3).
 */
import { seededRng } from '@/engine/econ'
import type { ProductKey, StateKey } from '@/types'
import { lootTableForState } from './lootTable'
import { capacityLevelDef } from './upgrades'
import { BONUS_STAND_QTY_MULT, HITCHHIKER_FRAGMENT_CHANCE } from './constants'

export interface ExpeditionLootParams {
  stateKey: StateKey
  /** Уровень Capacity 0..5 (§3.4.2). */
  capacityLevel: number
  /** `road_scenic_detour` — +1 слот сверх Capacity на этот рейс (§3.8). */
  extraSlots?: number
  /** `road_bonus_stand` — +20% к количеству регионалки этого рейса (§3.8). */
  bonusStandActive?: boolean
  /** `road_hitchhiker` — гарантированный фрагмент рецепта (§3.8/§4.3). */
  hitchhikerActive?: boolean
  /** Сид рейса (сервер, детерминизм §4.2). */
  seed: number
}

export interface ExpeditionLootResult {
  items: { key: ProductKey; qty: number }[]
  fragmentAwarded: ProductKey | null
}

/** Ролл лута рейса — детерминирован от `seed` (§4.2/§4.3). */
export function rollExpeditionLoot(params: ExpeditionLootParams): ExpeditionLootResult {
  const table = lootTableForState(params.stateKey)
  if (table.length === 0) return { items: [], fragmentAwarded: null }

  const forcedRows = table.filter((r) => r.forced)
  const capacity = capacityLevelDef(params.capacityLevel)
  const totalSlots = capacity.slots + Math.max(0, params.extraSlots ?? 0)
  const qtyMult = capacity.multiplier * (params.bonusStandActive ? BONUS_STAND_QTY_MULT : 1)

  const rng = seededRng(params.seed)
  const qtyByKey = new Map<ProductKey, number>()
  let fragmentAwarded: ProductKey | null = null

  const addQty = (key: ProductKey, baseQty: number) => {
    qtyByKey.set(key, (qtyByKey.get(key) ?? 0) + baseQty * qtyMult)
  }

  // Слот 1 — форс топ-строки (§4.2, гарантия непустого рейса).
  for (const row of forcedRows) addQty(row.key, row.baseQty)

  // Слоты сверх первого — независимый ролл по ВСЕМ строкам таблицы (§4.2).
  const remainingSlots = Math.max(0, totalSlots - forcedRows.length)
  for (let slot = 0; slot < remainingSlots; slot++) {
    for (const row of table) {
      const hitChance = row.forced ? 1 : row.chance
      if (rng.next() >= hitChance) continue
      if (row.isFragment) {
        fragmentAwarded = row.key
      } else {
        addQty(row.key, row.baseQty)
      }
    }
  }

  // `road_hitchhiker` — независимая гарантия фрагмента (§3.8/§4.3), не альтернатива ролла выше.
  if (params.hitchhikerActive && HITCHHIKER_FRAGMENT_CHANCE >= 1) {
    const fragmentRow = table.find((r) => r.isFragment)
    if (fragmentRow) fragmentAwarded = fragmentRow.key
  }

  const items = [...qtyByKey.entries()]
    .filter(([, qty]) => qty > 0)
    .map(([key, qty]) => ({ key, qty: Math.round(qty) }))

  return { items, fragmentAwarded }
}
