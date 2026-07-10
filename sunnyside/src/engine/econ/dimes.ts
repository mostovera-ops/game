/**
 * engine/econ/dimes.ts — прайсинг Dimes-ускорений производственных таймеров (§3.8).
 *
 * Каноничная формула (§3.8, мастер прайсинга скипа грядка/станок/стройка):
 *     dimes(t_min) = t ≤ 1 ? 0 : ceil(0.41 × t^0.53)
 * Вогнутая кривая (b=0.53<1): длинный таймер дороже суммарно, но дешевле за минуту.
 * Последняя минута — бесплатно. Цена считается от ОСТАТКА (пересчёт в реалтайме).
 *
 * Экспедиции (◉1=30мин) и доставка каталога (◉1=4ч, кэп ◉5) — ИСКЛЮЧЕНИЯ со своими
 * курсами (§3.8, таблица), они НЕ считаются этой формулой; здесь их нет.
 *
 * ГРАНИЦА: чистая функция, ноль сети/three.
 */

import type { DimeSpeedupInput } from '@/types'
import { DIME_A, DIME_B, DIME_FREE_MIN } from './constants'

/**
 * Стоимость мгновенного завершения по остатку времени (§3.8).
 * Калибровка §3.8: 5м→1, 15м→2, 60м→4, 240м→8, 480м→11, 1440м→20, 4320м→35.
 */
export function dimeSpeedupCost({ remainingMin }: DimeSpeedupInput): number {
  if (remainingMin <= DIME_FREE_MIN) return 0
  return Math.ceil(DIME_A * Math.pow(remainingMin, DIME_B))
}

/**
 * Батч-скип: сумма поштучных цен БЕЗ скидки (§3.8, анти-абуз массового скипа перед
 * ярмаркой). Вход — массив остатков (мин) по слотам.
 */
export function dimeBatchSpeedupCost(remainings: readonly number[]): number {
  return remainings.reduce((sum, remainingMin) => sum + dimeSpeedupCost({ remainingMin }), 0)
}
