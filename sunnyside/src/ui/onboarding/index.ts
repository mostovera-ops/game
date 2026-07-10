/**
 * ui/onboarding — публичный бэррел зоны FTUE (18-onboarding).
 * Композиция монтирует `<OnboardingHost/>` поверх HUD (см. док в OnboardingHost.tsx).
 */

export { OnboardingHost } from './OnboardingHost'
export type { OnboardingHostProps } from './OnboardingHost'
export { LegacyLetter } from './LegacyLetter'
export { MiniWeek } from './MiniWeek'
export { GrandOpeningIntro } from './GrandOpeningIntro'
export { DailyGoalCard } from './DailyGoalCard'
export { useFtueStore } from './store'
export type { FtuePhase, FtueState } from './store'
export { MINI_WEEK_STEPS, AVATAR_PRESETS } from './scenario'
export type { MiniWeekStep, AvatarPresetKey } from './scenario'
