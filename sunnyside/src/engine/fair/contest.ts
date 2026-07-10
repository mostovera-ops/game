/**
 * engine/fair/contest.ts — ЧИСТЫЕ формулы конкурсов ярмарки (09-fair §3.7/§3.8/§4.7).
 *
 * Три конкурса, единый скор:
 *   ContestScore = W_npc × NPC_score + W_vote × VoteShare
 * Веса по конкурсу (§3.8): pie_week 0.5/0.5 · giant_veg 1.0/0.0 · best_window 0.0/1.0.
 *
 * Giant Vegetable (§4.7) — полностью детерминированная метрика веса (голосов нет):
 *   Weight_raw = W_base × (1 + 0.15×fert_ticks) × quality_mult × agronomy_bonus
 *   Weight     = min(Weight_raw, W_cap)          // жёсткий потолок ПЕРЕД скорингом (анти-P2W D11)
 *   FinalScore = Weight / W_cap                  // нормировка культуры → [0..1]
 *
 * Брекеты — дивизионы по Farm Value (§3.7): Bronze/Silver/Gold трети города;
 * минимум 6 заявок в дивизионе, иначе схлопывание вверх (F8) — «лента = достижение, не явка».
 *
 * ГРАНИЦА/АНТИ-ЧИТ: ноль сети/three/store; NPC-метрику и Farm Value считает сервер,
 * здесь — только скоринг/ранжирование для UI-предпросмотра галереи (contracts.ts ContestSystem).
 */

import type { ContestKey } from '@/types/fair'
import type { UUID } from '@/types/common'

import {
  AGRONOMY_BONUS_MAX,
  AGRONOMY_BONUS_MIN,
  CONTEST_WEIGHTS,
  FERTILIZER_TICK_BONUS,
  FERTILIZER_TICKS_MAX,
  GIANT_VEG_W_BASE,
  GIANT_VEG_W_CAP,
  MIN_ENTRIES_PER_DIVISION,
  NPC_SCORE_MAX,
  QUALITY_MULT_MAX,
  QUALITY_MULT_MIN,
  type GiantVegCrop,
} from './constants'

// ════════════════════════════════════════════════════════════════════════════
// Общий скор заявки (§3.8)
// ════════════════════════════════════════════════════════════════════════════

/**
 * ContestScore = W_npc × NPC_norm + W_vote × VoteShare, результат в [0..1].
 * - `npcScore` ∈ [0,100] нормируется /100 (§3.8 диапазон Miss Maybelle).
 * - `voteShare` ∈ [0,1] — доля голосов заявки от всех голосов конкурса (§3.8, «голос=1 балл»).
 * Нормировка обоих слагаемых к [0,1] — решение формулы (спека фиксирует веса, не шкалу);
 * так 0.5/0.5 pie_week даёт честный баланс качество↔популярность.
 */
export function contestScore(key: ContestKey, npcScore: number, voteShare: number): number {
  const w = CONTEST_WEIGHTS[key]
  const npcNorm = clamp01(npcScore / NPC_SCORE_MAX)
  const votes = clamp01(voteShare)
  return w.npc * npcNorm + w.vote * votes
}

/** Доля голосов заявки от всех валидных голосов конкурса (§3.8). Пустой конкурс → 0. */
export function voteShare(entryVotes: number, totalVotes: number): number {
  if (totalVotes <= 0) return 0
  return clamp01(Math.max(0, entryVotes) / totalVotes)
}

// ════════════════════════════════════════════════════════════════════════════
// Giant Vegetable — детерминированный вес (§4.7)
// ════════════════════════════════════════════════════════════════════════════

export interface GiantVegInput {
  crop: GiantVegCrop
  /** Циклы под удобрением (0..6), +0.15 каждый (§4.7). */
  fertilizerTicks: number
  /** Качество грядки (1.0…1.5, 02-farm). */
  qualityMult: number
  /** Know-How Agronomy (1.0…1.25, kh_agronomy). */
  agronomyBonus: number
}

export interface GiantVegResult {
  /** Вес до потолка (для тай-брейка — кто ближе подошёл «естественно»). */
  weightRaw: number
  /** Вес после жёсткого потолка культуры. */
  weight: number
  /** Нормированный балл [0..1] — ранжирование дивизиона (§4.7). */
  finalScore: number
}

/**
 * §4.7: качество входит в вес ОДИН раз (через quality_mult и agronomy_bonus) —
 * отдельного ×Quality в итоге нет (устранён двойной учёт). Потолок применяется ДО
 * нормировки → деньги (удобрение за Dimes) не пробивают W_cap и не дают балл >1 (анти-P2W D11).
 */
export function giantVegScore(input: GiantVegInput): GiantVegResult {
  const wBase = GIANT_VEG_W_BASE[input.crop]
  const wCap = GIANT_VEG_W_CAP[input.crop]

  const ticks = clampRange(input.fertilizerTicks, 0, FERTILIZER_TICKS_MAX)
  const quality = clampRange(input.qualityMult, QUALITY_MULT_MIN, QUALITY_MULT_MAX)
  const agronomy = clampRange(input.agronomyBonus, AGRONOMY_BONUS_MIN, AGRONOMY_BONUS_MAX)

  const weightRaw = wBase * (1 + FERTILIZER_TICK_BONUS * ticks) * quality * agronomy
  const weight = Math.min(weightRaw, wCap)
  const finalScore = weight / wCap // ∈ (0..1]

  return { weightRaw, weight, finalScore }
}

// ════════════════════════════════════════════════════════════════════════════
// Дивизионы (брекеты) по Farm Value (§3.7)
// ════════════════════════════════════════════════════════════════════════════

export type Division = 'bronze' | 'silver' | 'gold'

/**
 * Дивизион игрока по его Farm Value и порогам третей города (§3.7):
 * нижняя треть → bronze, средняя → silver, верхняя → gold.
 * `lowerThird`/`upperThird` — динамические границы (перцентили города, mech_farm_value).
 */
export function divisionForFarmValue(farmValue: number, lowerThird: number, upperThird: number): Division {
  if (farmValue >= upperThird) return 'gold'
  if (farmValue >= lowerThird) return 'silver'
  return 'bronze'
}

/** Одна заявка на скоринг/ранжирование внутри дивизиона. */
export interface ScoredEntry {
  id: UUID
  playerId: UUID
  division: Division
  score: number
  /** Тай-брейк (напр. weightRaw для giant_veg, §4.7): больше — выше при равенстве score. */
  tieBreak?: number
}

/** Итог ранжирования заявки: место (1-based), лента. */
export interface RankedEntry extends ScoredEntry {
  rank: number
  blueRibbon: boolean // 1-е место (§4.8)
  honorableMention: boolean // 2–3 места (§4.8, малая лента)
}

/**
 * §3.7 F8: если в дивизионе < 6 заявок — схлопываем вверх (bronze→silver→gold),
 * чтобы лента значила достижение, а не явку. Возвращает эффективный дивизион каждой
 * заявки после слияний. Слияние идёт снизу вверх: недобравшие bronze вливаются в silver,
 * если и объединение silver всё ещё < 6 — всё вливается в gold.
 */
export function collapseDivisions(entries: ScoredEntry[]): ScoredEntry[] {
  const count = (d: Division): number => entries.filter((e) => e.division === d).length

  // Итоговый маппинг исходного дивизиона → эффективный.
  const map: Record<Division, Division> = { bronze: 'bronze', silver: 'silver', gold: 'gold' }

  if (count('bronze') > 0 && count('bronze') < MIN_ENTRIES_PER_DIVISION) {
    map.bronze = 'silver'
  }
  // После возможного вливания bronze в silver проверяем объединённый silver.
  const silverEffective = entries.filter((e) => map[e.division] === 'silver').length
  if (silverEffective > 0 && silverEffective < MIN_ENTRIES_PER_DIVISION) {
    map.bronze = 'gold'
    map.silver = 'gold'
  }

  return entries.map((e) => ({ ...e, division: map[e.division] }))
}

/**
 * Ранжирует заявки ВНУТРИ каждого дивизиона (после `collapseDivisions`): сорт по score
 * убыв., тай-брейк по `tieBreak` убыв. 1-е место → Blue Ribbon, 2–3 → Honorable Mention (§4.8).
 * Разные дивизионы ранжируются независимо (своя таблица, §3.7).
 */
export function rankDivision(entries: ScoredEntry[]): RankedEntry[] {
  const byDiv = new Map<Division, ScoredEntry[]>()
  for (const e of entries) {
    const arr = byDiv.get(e.division) ?? []
    arr.push(e)
    byDiv.set(e.division, arr)
  }

  const result: RankedEntry[] = []
  for (const arr of byDiv.values()) {
    const sorted = [...arr].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return (b.tieBreak ?? 0) - (a.tieBreak ?? 0)
    })
    sorted.forEach((e, i) => {
      const rank = i + 1
      result.push({
        ...e,
        rank,
        blueRibbon: rank === 1,
        honorableMention: rank === 2 || rank === 3,
      })
    })
  }
  return result
}

// ════════════════════════════════════════════════════════════════════════════
// Утилиты
// ════════════════════════════════════════════════════════════════════════════

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

function clampRange(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}
