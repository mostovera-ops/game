/**
 * ui/progression/catalog.ts — read-only lookups поверх контент-каталогов (`@/data/catalogs`)
 * для экранов прогрессии (F6 Staff Board, F7 Know-How Tree, F3 Building Upgrade, C1 Profile).
 * Презентационный слой: имена/эффекты/стоимости для рендера карточек. НЕ источник игровых
 * правил — числа/формулы живут в `engine/progression` (см. AGENTS.md §0.3).
 *
 * ГРАНИЦА (AGENTS.md §3): ui/ читает @/types и @/data (контент, read-only), ноль
 * three/@react-three/@/net.
 */
import { staff } from '@/data/catalogs/staff'
import { knowHowNodes } from '@/data/catalogs/knowHow'
import { buildings } from '@/data/catalogs/buildings'
import type { StaffDef, KnowHowNodeDef, BuildingDef, BuildingLevelSchema } from '@/data/schema'
import type { z } from 'zod'
import type { BuildingKey, KnowHowBranch, Locale, StaffKey } from '@/types'

type BuildingLevel = z.infer<typeof BuildingLevelSchema>

const staffByKey = new Map<StaffKey, StaffDef>(staff.map((s) => [s.key, s]))
const knowHowByKey = new Map<string, KnowHowNodeDef>(knowHowNodes.map((n) => [n.key, n]))
const buildingByKey = new Map<BuildingKey, BuildingDef>(buildings.map((b) => [b.key, b]))

export function staffContent(key: StaffKey): StaffDef | undefined {
  return staffByKey.get(key)
}

export function knowHowContent(key: string): KnowHowNodeDef | undefined {
  return knowHowByKey.get(key)
}

export function buildingContent(key: BuildingKey): BuildingDef | undefined {
  return buildingByKey.get(key)
}

export function staffLabel(key: StaffKey, locale: Locale = 'ru'): string {
  return staffContent(key)?.name[locale] ?? key
}

export function knowHowLabel(key: string, locale: Locale = 'ru'): string {
  return knowHowContent(key)?.name[locale] ?? key
}

export function knowHowEffectLabel(key: string, locale: Locale = 'ru'): string {
  return knowHowContent(key)?.effect[locale] ?? ''
}

export function buildingLabel(key: BuildingKey, locale: Locale = 'ru'): string {
  return buildingContent(key)?.name[locale] ?? key
}

/** Все узлы одной ветки Know-How, в порядке тира (каталог уже отсортирован по тирам). */
export function nodesForBranch(branch: KnowHowBranch): KnowHowNodeDef[] {
  return knowHowNodes.filter((n) => n.branch === branch)
}

/** Данные уровня постройки (стоимость/время/эффект) — `undefined`, если уровень вне [1..maxLevel]. */
export function buildingLevel(key: BuildingKey, level: number): BuildingLevel | undefined {
  return buildingContent(key)?.levels.find((l) => l.level === level)
}
