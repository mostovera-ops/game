import { describe, it, expect } from 'vitest'
import {
  ACHIEVEMENT_PREDICATES,
  evaluateAchievements,
  newlyUnlockedAchievements,
  hasPredicateForAllAchievements,
  type AchievementStats,
} from './achievements'
import { achievements } from '@/data/catalogs/achievements'

/** Снапшот статистики "всё на нуле" — ни одно условие не должно проходить. */
function zeroStats(): AchievementStats {
  return {
    cropsHarvested: 0,
    animalsPurchased: 0,
    barnFilledFull: false,
    recipesByTier: {
      1: { unlocked: 0, total: 10 },
      2: { unlocked: 0, total: 10 },
      3: { unlocked: 0, total: 10 },
      4: { unlocked: 0, total: 10 },
      5: { unlocked: 0, total: 10 },
    },
    secretRecipesUnlocked: 0,
    farmValue: 0,
    recipesAt5Star: 0,
    dishesCookedTotal: 0,
    bluePlatesAssembled: 0,
    bluePlatesSold: 0,
    mysteryPlatesReceived: 0,
    fairParticipated: false,
    shiftsActive: 0,
    bestComboStreakInShift: 0,
    dishesSoldAtFair: 0,
    blueRibbonsTotal: 0,
    contestWins: { pie: 0, giantVeg: 0, bestWindow: 0 },
    divisionsWonIn: new Set(),
    coopContributions: 0,
    potluckContributions: 0,
    neighborGiftsSent: 0,
    mentoredFirstTime: false,
    menteesToGrandOpening: 0,
    streetCaravanParticipated: false,
    townMergeSurvived: false,
    expeditionsCompleted: 0,
    wave1StatesUnlocked: 0,
    postcardAlbumComplete: false,
    foragingCount: 0,
    mailOrdersCount: 0,
    staffMaxLevel: { gus: false, buck: false },
    streakDays: 0,
    streakRecoveries: 0,
    vacationReturned: false,
    toysOwnedTotal: 0,
    toySeriesCompleted: 0,
    neonSignsAssembled: 0,
    decorSlotsFilled: 0,
    decorSlotsTotal: 40,
    cosmeticSetsCompleted: 0,
    photosTaken: 0,
    eventMilestonesReached: 0,
    townProjectsContributedCount: 0,
    townProjectsTotal: 6,
    fairPatronStatus: false,
  }
}

describe('реестр предикатов покрывает все 63 таблички каталога', () => {
  it('каждый ключ каталога имеет предикат', () => {
    expect(hasPredicateForAllAchievements()).toBe(true)
  })

  it('63 записи в каталоге (17-collections §3.5 итог)', () => {
    expect(achievements.length).toBe(63)
  })

  it('нет предикатов на несуществующие ключи (модуль бы упал при импорте иначе)', () => {
    const catalogKeys = new Set(achievements.map((a) => a.key))
    for (const key of Object.keys(ACHIEVEMENT_PREDICATES)) {
      expect(catalogKeys.has(key)).toBe(true)
    }
  })
})

describe('evaluateAchievements', () => {
  it('нулевая статистика не разблокирует ничего', () => {
    expect(evaluateAchievements(zeroStats())).toEqual([])
  })

  it('первый урожай разблокирует ровно ach_first_harvest среди фермерских', () => {
    const stats = { ...zeroStats(), cropsHarvested: 1 }
    expect(evaluateAchievements(stats)).toContain('ach_first_harvest')
    expect(evaluateAchievements(stats)).not.toContain('ach_100_crops')
  })

  it('C1: одно действие может удовлетворить 2+ условиям одновременно (1000 блюд ⇒ и 100, и 1000)', () => {
    const stats = { ...zeroStats(), dishesCookedTotal: 1000 }
    const unlocked = evaluateAchievements(stats)
    expect(unlocked).toContain('ach_100_dishes')
    expect(unlocked).toContain('ach_1000_dishes')
    expect(unlocked).not.toContain('ach_10000_dishes')
  })

  it('все тиры рецептов разблокированы ⇒ ach_all_t1..t5', () => {
    const stats = zeroStats()
    for (const tier of [1, 2, 3, 4, 5] as const) {
      stats.recipesByTier[tier] = { unlocked: 10, total: 10 }
    }
    const unlocked = evaluateAchievements(stats)
    expect(unlocked).toEqual(
      expect.arrayContaining(['ach_all_t1', 'ach_all_t2', 'ach_all_t3', 'ach_all_t4', 'ach_all_t5']),
    )
  })

  it('все 4 дивизиона выиграны ⇒ ach_all_divisions', () => {
    const stats = {
      ...zeroStats(),
      divisionsWonIn: new Set(['rookie', 'county', 'state', 'legend'] as const),
    }
    expect(evaluateAchievements(stats)).toContain('ach_all_divisions')
  })

  it('неполный набор дивизионов не засчитывает ach_all_divisions', () => {
    const stats = { ...zeroStats(), divisionsWonIn: new Set(['rookie', 'county'] as const) }
    expect(evaluateAchievements(stats)).not.toContain('ach_all_divisions')
  })

  it('полные декор-слоты (0 из 0) не засчитываются — нет слотов вообще', () => {
    const stats = { ...zeroStats(), decorSlotsTotal: 0, decorSlotsFilled: 0 }
    expect(evaluateAchievements(stats)).not.toContain('ach_full_decor_slots')
  })

  it('полные декор-слоты (N из N, N>0) засчитываются', () => {
    const stats = { ...zeroStats(), decorSlotsTotal: 5, decorSlotsFilled: 5 }
    expect(evaluateAchievements(stats)).toContain('ach_full_decor_slots')
  })
})

describe('newlyUnlockedAchievements', () => {
  it('не повторяет уже полученные ключи', () => {
    const stats = { ...zeroStats(), cropsHarvested: 1000 }
    const already = new Set(['ach_first_harvest', 'ach_100_crops'])
    const fresh = newlyUnlockedAchievements(stats, already)
    expect(fresh).toContain('ach_1000_crops')
    expect(fresh).not.toContain('ach_first_harvest')
    expect(fresh).not.toContain('ach_100_crops')
  })
})
