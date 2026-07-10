/**
 * engine/econ/farmValue.ts — агрегат Farm Value с капом косметики/коллекций (§3.5).
 *
 * FarmValue — НЕ валюта; скалярный статус для матчмейкинга лиг (canon §2.4). Мастер
 * весов — 13-progression §3.4.1; здесь — только жёсткий кап: Σ(косметика+коллекции) ≤
 * 15% итогового FarmValue (§3.5), чтобы «плативший за красоту» не считался сильнее
 * «игравшего». Это метод `EconSystem.farmValue`.
 *
 * ГРАНИЦА: чистая функция, ноль сети/three.
 */

import type { FarmValueAxes } from '@/types'
import { FARM_VALUE_SOFT_CAP } from './constants'

/**
 * Считает total из 4 осей с капом «мягких» осей (§3.5).
 * core = production + buildings; soft = collections + cosmetics.
 * cappedSoft = min(soft, core × cap/(1−cap)) → доля soft в total ≤ cap.
 */
export function farmValue(axes: Omit<FarmValueAxes, 'total'>): FarmValueAxes {
  const core = axes.production + axes.buildings
  const soft = axes.collections + axes.cosmetics
  const cap = FARM_VALUE_SOFT_CAP
  const cappedSoft = Math.min(soft, (core * cap) / (1 - cap))
  const total = Math.round(core + cappedSoft)
  return { ...axes, total }
}
