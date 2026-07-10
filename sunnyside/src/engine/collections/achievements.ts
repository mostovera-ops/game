/**
 * engine/collections/achievements.ts — предикаты Achievement Wall, 63 таблички
 * (17-collections.md §3.5, каталог `@/data/catalogs/achievements.ts`).
 *
 * ЧИСТАЯ логика: превращает снапшот игровой статистики (`AchievementStats`,
 * агрегируется из разных слайсов — эта система в них не лезет, AGENTS.md §3
 * граница импортов) в множество ключей ачивок, чьё условие выполнено ПРЯМО
 * СЕЙЧАС. Разблокировка/персист самого факта `unlocked_at` — серверная истина
 * (`player_achievements`, 17-collections §4.1) через `applyMutation`; этот модуль
 * не решает, была ли табличка УЖЕ выдана — только «условие удовлетворено ли
 * сейчас», сравнение с уже разблокированными (`CollectionsSnapshot`/прогрессией)
 * делает вызывающий слайс.
 *
 * C1 (17-collections Edge cases): если одно действие удовлетворяет 2+ условиям
 * одновременно — `evaluateAchievements` естественно возвращает оба ключа в одном
 * вызове (стек тостов — забота UI-слоя).
 */

import { achievements } from '@/data/catalogs/achievements'

/** Ровно 4 дивизиона конкурсов (17-collections §3.2.1). */
export type ContestDivision = 'rookie' | 'county' | 'state' | 'legend'

/**
 * Снапшот статистики игрока, необходимой для проверки всех 63 предикатов.
 * Собирается вызывающим слайсом из разных источников (farm/craft/fair/social/
 * expeditions/progression/collections) — этот модуль их не читает напрямую.
 */
export interface AchievementStats {
  cropsHarvested: number
  animalsPurchased: number
  barnFilledFull: boolean
  /** Число разблокированных / всего рецептов по тиру (T1..T5), для `ach_all_t*`. */
  recipesByTier: Record<1 | 2 | 3 | 4 | 5, { unlocked: number; total: number }>
  secretRecipesUnlocked: number
  farmValue: number
  recipesAt5Star: number
  dishesCookedTotal: number
  bluePlatesAssembled: number
  bluePlatesSold: number
  mysteryPlatesReceived: number
  fairParticipated: boolean
  shiftsActive: number
  bestComboStreakInShift: number
  dishesSoldAtFair: number
  blueRibbonsTotal: number
  contestWins: { pie: number; giantVeg: number; bestWindow: number }
  divisionsWonIn: ReadonlySet<ContestDivision>
  coopContributions: number
  potluckContributions: number
  neighborGiftsSent: number
  mentoredFirstTime: boolean
  menteesToGrandOpening: number
  streetCaravanParticipated: boolean
  townMergeSurvived: boolean
  expeditionsCompleted: number
  wave1StatesUnlocked: number
  postcardAlbumComplete: boolean
  foragingCount: number
  mailOrdersCount: number
  staffMaxLevel: { gus: boolean; buck: boolean }
  streakDays: number
  streakRecoveries: number
  vacationReturned: boolean
  toysOwnedTotal: number
  toySeriesCompleted: number
  neonSignsAssembled: number
  decorSlotsFilled: number
  decorSlotsTotal: number
  cosmeticSetsCompleted: number
  photosTaken: number
  eventMilestonesReached: number
  townProjectsContributedCount: number
  townProjectsTotal: number
  fairPatronStatus: boolean
}

type Predicate = (stats: AchievementStats) => boolean

const allTierUnlocked = (tier: 1 | 2 | 3 | 4 | 5): Predicate => (s) => {
  const t = s.recipesByTier[tier]
  return t.total > 0 && t.unlocked >= t.total
}

/** Реестр предикатов по ключу ачивки (17-collections §3.5.1–§3.5.8, дословный порядок). */
export const ACHIEVEMENT_PREDICATES: Readonly<Record<string, Predicate>> = {
  // §3.5.1 Ферма и производство
  ach_first_harvest: (s) => s.cropsHarvested >= 1,
  ach_100_crops: (s) => s.cropsHarvested >= 100,
  ach_1000_crops: (s) => s.cropsHarvested >= 1000,
  ach_first_animal: (s) => s.animalsPurchased >= 1,
  ach_barn_full: (s) => s.barnFilledFull,
  ach_all_t1: allTierUnlocked(1),
  ach_all_t2: allTierUnlocked(2),
  ach_all_t3: allTierUnlocked(3),
  ach_all_t4: allTierUnlocked(4),
  ach_all_t5: allTierUnlocked(5),
  ach_first_secret_recipe: (s) => s.secretRecipesUnlocked >= 1,
  ach_farm_value_10k: (s) => s.farmValue >= 10_000,

  // §3.5.2 Кухня и mastery
  ach_first_5star: (s) => s.recipesAt5Star >= 1,
  ach_10_5star: (s) => s.recipesAt5Star >= 10,
  ach_100_dishes: (s) => s.dishesCookedTotal >= 100,
  ach_1000_dishes: (s) => s.dishesCookedTotal >= 1000,
  ach_10000_dishes: (s) => s.dishesCookedTotal >= 10_000,
  ach_first_blue_plate: (s) => s.bluePlatesAssembled >= 1,
  ach_50_blue_plate: (s) => s.bluePlatesSold >= 50,
  ach_mystery_plate_5: (s) => s.mysteryPlatesReceived >= 5,

  // §3.5.3 Ярмарка и конкурсы
  ach_first_fair: (s) => s.fairParticipated,
  ach_first_shift: (s) => s.shiftsActive >= 1,
  ach_combo_10: (s) => s.bestComboStreakInShift >= 10,
  ach_1000_dishes_sold: (s) => s.dishesSoldAtFair >= 1000,
  ach_first_ribbon: (s) => s.blueRibbonsTotal >= 1,
  ach_10_ribbons: (s) => s.blueRibbonsTotal >= 10,
  ach_pie_champion_3: (s) => s.contestWins.pie >= 3,
  ach_giant_veg_champion_3: (s) => s.contestWins.giantVeg >= 3,
  ach_best_window_champion_3: (s) => s.contestWins.bestWindow >= 3,
  ach_all_divisions: (s) =>
    (['rookie', 'county', 'state', 'legend'] as const).every((d) => s.divisionsWonIn.has(d)),

  // §3.5.4 Кооп и стрит
  ach_first_coop_order: (s) => s.coopContributions >= 1,
  ach_50_coop_orders: (s) => s.coopContributions >= 50,
  ach_first_potluck: (s) => s.potluckContributions >= 1,
  ach_gift_10_neighbors: (s) => s.neighborGiftsSent >= 10,
  ach_mentor_first: (s) => s.mentoredFirstTime,
  ach_mentor_10: (s) => s.menteesToGrandOpening >= 10,
  ach_street_caravan: (s) => s.streetCaravanParticipated,
  ach_town_merge_survivor: (s) => s.townMergeSurvived,

  // §3.5.5 Экспедиции и открытки
  ach_first_expedition: (s) => s.expeditionsCompleted >= 1,
  ach_all_wave1_states: (s) => s.wave1StatesUnlocked >= 8,
  ach_full_postcard_album: (s) => s.postcardAlbumComplete,
  ach_100_expeditions: (s) => s.expeditionsCompleted >= 100,
  ach_first_foraging: (s) => s.foragingCount >= 1,
  ach_mail_catalog_first: (s) => s.mailOrdersCount >= 1,
  ach_gus_max_level: (s) => s.staffMaxLevel.gus,
  ach_buck_max_level: (s) => s.staffMaxLevel.buck,

  // §3.5.6 Стрик и завсегдатаи
  ach_streak_7: (s) => s.streakDays >= 7,
  ach_streak_30: (s) => s.streakDays >= 30,
  ach_streak_100: (s) => s.streakDays >= 100,
  ach_streak_365: (s) => s.streakDays >= 365,
  ach_streak_recovered_5: (s) => s.streakRecoveries >= 5,
  ach_gone_fishin_return: (s) => s.vacationReturned,

  // §3.5.7 Коллекции и косметика
  ach_first_toy: (s) => s.toysOwnedTotal >= 1,
  ach_complete_toy_series: (s) => s.toySeriesCompleted >= 1,
  ach_all_toy_series: (s) => s.toySeriesCompleted >= 5,
  ach_first_neon: (s) => s.neonSignsAssembled >= 1,
  ach_full_decor_slots: (s) => s.decorSlotsTotal > 0 && s.decorSlotsFilled >= s.decorSlotsTotal,
  ach_cosmetic_set_complete: (s) => s.cosmeticSetsCompleted >= 1,
  ach_100_photos: (s) => s.photosTaken >= 100,

  // §3.5.8 Общегородские и особые
  ach_first_event_milestone: (s) => s.eventMilestonesReached >= 1,
  ach_town_project_contributor: (s) => s.townProjectsContributedCount >= 1,
  ach_all_town_projects: (s) =>
    s.townProjectsTotal > 0 && s.townProjectsContributedCount >= s.townProjectsTotal,
  ach_fair_patron: (s) => s.fairPatronStatus,
}

const catalogKeys = new Set(achievements.map((a) => a.key))
for (const key of Object.keys(ACHIEVEMENT_PREDICATES)) {
  if (!catalogKeys.has(key)) {
    throw new Error(`achievements.ts: предикат для незарегистрированного ключа каталога «${key}»`)
  }
}

/** Все ключи ачивок, чьё условие выполнено данным снапшотом статистики. */
export function evaluateAchievements(stats: AchievementStats): string[] {
  const unlocked: string[] = []
  for (const def of achievements) {
    const predicate = ACHIEVEMENT_PREDICATES[def.key]
    if (predicate && predicate(stats)) unlocked.push(def.key)
  }
  return unlocked
}

/** Новые разблокировки: условие выполнено сейчас, но ключа ещё нет среди уже полученных. */
export function newlyUnlockedAchievements(stats: AchievementStats, alreadyUnlocked: ReadonlySet<string>): string[] {
  return evaluateAchievements(stats).filter((key) => !alreadyUnlocked.has(key))
}

/** Полнота реестра: каждый ключ каталога должен иметь предикат (иначе — незавершённая работа). */
export function hasPredicateForAllAchievements(): boolean {
  return achievements.every((a) => typeof ACHIEVEMENT_PREDICATES[a.key] === 'function')
}
