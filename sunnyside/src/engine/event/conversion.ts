/**
 * engine/event/conversion.ts — конверсия блюда в Fill Points (§3.3, §4.1–4.4).
 *
 * ЧИСТАЯ логика (AGENTS.md §3): ноль сети/three/state. Детерминизм. Это ТОЛЬКО
 * предсказание для UI («примерно +N FP в котёл») и локальная бухгалтерия шкалы —
 * НИКОГДА не источник начисления (анти-чит §0.3): истину меры даёт сервер
 * (Edge Function атомарно инкрементит meter_fp, §3.13).
 *
 * Формула (§3.3):
 *   FP_dish = BFP(tier) × Q(quality) × M_theme × F(category) × K_channel
 */

import type { Tier } from '@/types'
import {
  BASE_FILL_POINTS,
  CHANNEL_MULT,
  DONATION_FP_PER_TICKET,
  DONATION_TICKET_CAP,
  MAX_MASTERY_STARS,
  QUALITY_STAR_COEFF,
} from './constants'

/** BFP(tier) — базовые аппетит-очки блюда по тиру (§4.1). */
export function baseFillPoints(tier: Tier): number {
  return BASE_FILL_POINTS[tier]
}

/**
 * Q(quality) — множитель мастерства ★ (§4.2): 1 + 0.08×stars, stars ∈ {0..5}
 * → 1.00 … 1.40. Значения вне диапазона кламп­ятся (защита от мусорного ввода).
 */
export function qualityMult(stars: number): number {
  const s = Math.max(0, Math.min(MAX_MASTERY_STARS, Math.floor(stars)))
  return 1 + QUALITY_STAR_COEFF * s
}

/** K_channel — пожертвование ценнее продажи (§4.4). */
export function channelMult(channel: 'donate' | 'passive'): number {
  return CHANNEL_MULT[channel]
}

/** Аргументы конверсии одного блюда. `mTheme`/`freshness` — уже разрешённые множители. */
export interface DishFpInput {
  tier: Tier
  /** Мастерство ★, 0..5 (§4.2). */
  stars: number
  channel: 'donate' | 'passive'
  /**
   * M_theme — множитель темы (фаза Гримсби / баланс палаток / evening / combo).
   * База 1.0; разрешается функциями `themes.ts` / `grimsby.ts`. По умолчанию 1.0.
   */
  mTheme?: number
  /** F(category) — freshness ∈ [0.5; 1.0] (§3.14). По умолчанию 1.0 (норма потока). */
  freshness?: number
}

/**
 * FP одного блюда (§3.3). Не округляется — мера копится по всем блюдам всех
 * игроков, округление — на уровне UI. Отрицательные множители не допускаются
 * (кламп в 0), чтобы вклад не «вычитал» из котла.
 */
export function dishFp(input: DishFpInput): number {
  const mTheme = Math.max(0, input.mTheme ?? 1)
  const freshness = Math.max(0, input.freshness ?? 1)
  return (
    baseFillPoints(input.tier) *
    qualityMult(input.stars) *
    mTheme *
    freshness *
    channelMult(input.channel)
  )
}

/**
 * Городская мера (§3.3): Meter_FP = Σ FP_dish. Тонкая обёртка для явности —
 * сумма вкладов за окно уикенда.
 */
export function meterFp(contributions: readonly number[]): number {
  return contributions.reduce((acc, fp) => acc + Math.max(0, fp), 0)
}

/**
 * `🎟` за пожертвования (§4.4): `🎟 1` за каждые 500 FP пожертвованных, кап `🎟 10`
 * за уикенд. `donatedFp` — суммарный FP, влитый КАНАЛОМ donate за уикенд.
 */
export function donationTickets(donatedFp: number): number {
  const earned = Math.floor(Math.max(0, donatedFp) / DONATION_FP_PER_TICKET)
  return Math.min(DONATION_TICKET_CAP, earned)
}
