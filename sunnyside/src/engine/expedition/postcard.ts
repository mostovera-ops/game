/**
 * engine/expedition/postcard.ts — правила открыток `mech_greetings_postcard` (§3.3/§3.7).
 *
 * Открывающий рейс — гарантированная открытка (не дублируется дальше). Повторный
 * рейс в уже открытый стоп: дубликат-открытка ВСЕГДА детерминированно конвертируется
 * в `$` = 15 × тир лута (гипотеза §3.3); `road_local_fair` (§3.8) удваивает эту сумму.
 * Фрагмент рецепта на повторном рейсе — отдельный независимый ролл лут-таблицы
 * (см. `loot.ts`), НЕ альтернатива конвертации — оба источника независимы.
 */
import type { Tier } from '@/types'
import { DUPLICATE_POSTCARD_BUCKS_PER_TIER, LOCAL_FAIR_POSTCARD_MULT } from './constants'

/** `$`, в которые конвертируется дубликат-открытка (§3.3). */
export function duplicatePostcardBucks(tier: Tier, localFairActive: boolean): number {
  const base = DUPLICATE_POSTCARD_BUCKS_PER_TIER * tier
  return localFairActive ? base * LOCAL_FAIR_POSTCARD_MULT : base
}

/**
 * Нужно ли выдать открытку на этом рейсе (X5/X9 — открытка не может быть пропущена):
 * первый визит в стоп ИЛИ флаг «открытка получена» ещё не установлен (баг-кейс миграции).
 */
export function shouldAwardPostcard(alreadyOwned: boolean): boolean {
  return !alreadyOwned
}
