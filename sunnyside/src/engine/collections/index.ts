/**
 * engine/collections — барель системы коллекций (docs/specs/17-collections.md,
 * 06-recipes.md R18 mastery). Чистая логика: mastery Recipe Box, сеты открыток →
 * баффы, ачивки-предикаты, pity Prize Machine. Ноль three/react/net — только
 * `@/types`, `@/data/catalogs` (read-only) и `@/engine/contracts` (AGENTS.md §3).
 */

export { createCollectionSystem } from './system'

export {
  masteryTierFor,
  nextMasteryTier,
  craftsToNextStar,
  masteryProgress,
  applyMasteryTime,
  applyMasteryPrice,
  RECIPE_MASTERY_CURVE,
} from './mastery'
export type { MasteryProgress, MasteryTier } from './mastery'

export {
  POSTCARD_SETS,
  isPostcardSetComplete,
  postcardSetProgress,
  completedPostcardSets,
  allPostcardSetProgress,
} from './postcards'
export type { PostcardSetKey, PostcardSetDef, PostcardSetBuff, PostcardSetProgress } from './postcards'

export { ACHIEVEMENT_PREDICATES, evaluateAchievements, newlyUnlockedAchievements, hasPredicateForAllAchievements } from './achievements'
export type { AchievementStats, ContestDivision } from './achievements'

export {
  DROP_RATES,
  PITY_RARE_CAP,
  PITY_CHASE_CAP,
  initialPity,
  rollRarity,
  pullOnce,
  toysOf,
  pickToy,
  simulatePulls,
} from './prizeMachine'
export type { Rng, PitySingleResult, PrizePullResultItem, PrizePullSimOutcome } from './prizeMachine'
