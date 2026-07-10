/**
 * engine/retention/generator.ts — генератор трёх Daily Specials на игровой день
 * (`ui_daily_specials`, Sheriff Roy, 16-retention.md §3.1/§3.2).
 *
 * ЧИСТАЯ функция от (пул шаблонов, доступность игроку, Farm Value, вчерашний
 * главный фокус, детерминированный сид). Ноль сети/three — сервер (или dev-мок)
 * зовёт это с реальным `availableTemplateKeys`, посчитанным из разблокировок
 * игрока (постройки/тиры/рецепты — источники вне зоны владения этого модуля,
 * AGENTS.md §2: retention не лезет в чужие каталоги построек/рецептов).
 *
 * Anti-repeat (§3.1):
 *   (a) не более 1 задачи каждой из Field/Kitchen/Counter/Yard в день; Community
 *       может повторяться максимум дважды (MAX_COMMUNITY_PER_DAY).
 *   (b) категория, бывшая «главным фокусом» вчера, не может быть главным фокусом
 *       сегодня (не запрещает ей просто присутствовать вторым/третьим слотом).
 *
 * «Не выпадают недоступные игроку задачи» — гарантируется тем, что генератор
 * ВСЕГДА фильтрует пул по `availableTemplateKeys` ДО выбора (если параметр не
 * передан — доступен весь пул, режим "все разблокировано", напр. дев/тесты).
 */

import { dailySpecialTemplates } from '@/data/catalogs/dailySpecials'
import type { DailySpecialTemplate } from '@/data/schema'
import type { Bilingual } from '@/types'
import { seededRng } from '@/engine/econ/rng'
import {
  COMMUNITY_CATEGORY,
  DAILY_SPECIALS_COUNT,
  MAX_COMMUNITY_PER_DAY,
  NON_COMMUNITY_CATEGORIES,
  farmValueBracket,
  type DailySpecialCategory,
} from './constants'

export interface GenerateDailySpecialsInput {
  /** Мгновенный (не трейлинг-максимум) Farm Value игрока — скейлит `target` (§3.1). */
  farmValueTotal: number
  /** Категория, бывшая главным фокусом вчера (§3.1 п.b); `null`/`undefined` — нет истории (day 1). */
  previousMainFocusCategory?: DailySpecialCategory | null
  /**
   * Ключи шаблонов, доступных игроку прямо сейчас (разблокированные постройки/тиры/
   * рецепты — считает вызывающий). `undefined` — весь пул доступен.
   */
  availableTemplateKeys?: ReadonlySet<string> | readonly string[]
  /** Детерминированный сид (напр. `hashString(playerId + ':' + dayIndex)`, canon §3.6 — тот же приём). */
  seed: number
}

export interface GeneratedDailySpecial {
  templateKey: string
  category: DailySpecialCategory
  name: Bilingual
  /** `template.targetQty × bracket.targetMult`, округлено вверх (§3.1). */
  targetQty: number
  /** Помечен ли этот слот главным фокусом дня (влияет только на косметический лидерборд, §3.1). */
  isMainFocus: boolean
}

export interface GenerateDailySpecialsResult {
  specials: GeneratedDailySpecial[]
  /** `null`, если ни один непустой слот не подходит под правило anti-repeat (вырожденный случай пустого пула). */
  mainFocusCategory: DailySpecialCategory | null
}

function isAvailable(
  key: string,
  availableTemplateKeys: GenerateDailySpecialsInput['availableTemplateKeys'],
): boolean {
  if (availableTemplateKeys === undefined) return true
  if (Array.isArray(availableTemplateKeys)) return availableTemplateKeys.includes(key)
  return (availableTemplateKeys as ReadonlySet<string>).has(key)
}

/** Группирует доступный пул по фокус-категории (порядок внутри категории сохранён). */
function groupByCategory(
  pool: readonly DailySpecialTemplate[],
): Map<DailySpecialCategory, DailySpecialTemplate[]> {
  const map = new Map<DailySpecialCategory, DailySpecialTemplate[]>()
  for (const tpl of pool) {
    const arr = map.get(tpl.category)
    if (arr) arr.push(tpl)
    else map.set(tpl.category, [tpl])
  }
  return map
}

/**
 * Выбирает multiset категорий на день (≤DAILY_SPECIALS_COUNT), уважая правило (a):
 * не-community категории — максимум по одной каждая; community добивает остаток,
 * не более MAX_COMMUNITY_PER_DAY раз. Категории без доступных шаблонов пропускаются.
 */
function pickCategories(
  byCategory: Map<DailySpecialCategory, DailySpecialTemplate[]>,
  rng: ReturnType<typeof seededRng>,
): DailySpecialCategory[] {
  const nonCommunityAvailable = NON_COMMUNITY_CATEGORIES.filter(
    (cat) => (byCategory.get(cat)?.length ?? 0) > 0,
  )
  const shuffled = rng.sample(nonCommunityAvailable, nonCommunityAvailable.length)
  const chosen: DailySpecialCategory[] = shuffled.slice(0, DAILY_SPECIALS_COUNT)

  const communityPoolSize = byCategory.get(COMMUNITY_CATEGORY)?.length ?? 0
  let communityAdded = 0
  while (
    chosen.length < DAILY_SPECIALS_COUNT &&
    communityAdded < Math.min(MAX_COMMUNITY_PER_DAY, communityPoolSize)
  ) {
    chosen.push(COMMUNITY_CATEGORY)
    communityAdded += 1
  }
  return chosen
}

/** Главный фокус — первая выбранная не-Community категория, отличная от вчерашней (§3.1 п.b). */
function pickMainFocus(
  chosen: readonly DailySpecialCategory[],
  previousMain: DailySpecialCategory | null | undefined,
): DailySpecialCategory | null {
  if (chosen.length === 0) return null
  const nonRepeatNonCommunity = chosen.find((c) => c !== COMMUNITY_CATEGORY && c !== previousMain)
  if (nonRepeatNonCommunity) return nonRepeatNonCommunity
  const nonRepeatAny = chosen.find((c) => c !== previousMain)
  if (nonRepeatAny) return nonRepeatAny
  return chosen[0]!
}

/**
 * Генерирует набор Daily Specials на день. Детерминирована по `seed` — тот же
 * вход (пул/доступность/farmValue/фокус/сид) всегда даёт тот же результат
 * (важно для «сгенерировано, но не показано до первого входа», §3.1).
 */
export function generateDailySpecials(
  input: GenerateDailySpecialsInput,
  templatePool: readonly DailySpecialTemplate[] = dailySpecialTemplates,
): GenerateDailySpecialsResult {
  const rng = seededRng(input.seed)
  const bracket = farmValueBracket(input.farmValueTotal)

  const availablePool = templatePool.filter((tpl) => isAvailable(tpl.key, input.availableTemplateKeys))
  const byCategory = groupByCategory(availablePool)

  const chosenCategories = pickCategories(byCategory, rng)
  const mainFocusCategory = pickMainFocus(chosenCategories, input.previousMainFocusCategory)

  // Не даём выбрать один и тот же template дважды (важно для Community ×2).
  const usedKeys = new Set<string>()
  const specials: GeneratedDailySpecial[] = []
  let mainAssigned = false

  for (const category of chosenCategories) {
    const candidates = (byCategory.get(category) ?? []).filter((tpl) => !usedKeys.has(tpl.key))
    if (candidates.length === 0) continue // пул категории исчерпан (все уже выбраны) — пропускаем слот
    const [picked] = rng.sample(candidates, 1)
    if (!picked) continue
    usedKeys.add(picked.key)

    const isMain = category === mainFocusCategory && !mainAssigned
    if (isMain) mainAssigned = true

    specials.push({
      templateKey: picked.key,
      category: picked.category,
      name: picked.name,
      targetQty: Math.ceil(picked.targetQty * bracket.targetMult),
      isMainFocus: isMain,
    })
  }

  return { specials, mainFocusCategory: mainAssigned ? mainFocusCategory : null }
}
