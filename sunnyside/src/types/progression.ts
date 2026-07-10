/**
 * progression.ts — уровень фермы, Know-How, стафф, Route Pass (13-progression, canon §3.2/§3.9).
 * Know-How и Staff Tokens — НЕ валюты, а state игрока.
 */

import type { UUID, EpochMs, Versioned } from './common'
import type { StaffPost } from './machines'

// ── Know-How (Research → 4 ветки, canon §3.9) ─────────────────────────────────

export type KnowHowBranch = 'kh_agronomy' | 'kh_cookery' | 'kh_commerce' | 'kh_civics'

export const KNOW_HOW_BRANCHES: readonly KnowHowBranch[] = [
  'kh_agronomy',
  'kh_cookery',
  'kh_commerce',
  'kh_civics',
] as const

/** Узел дерева исследований. research_start требует изученных предков + Know-How Points. */
export interface KnowHowNode extends Versioned {
  key: string // kh_<branch>_<node>
  branch: KnowHowBranch
  studied: boolean
  /** Активен таймер исследования. */
  studyReadyAt?: EpochMs
  prereqs: string[]
}

export interface KnowHowState {
  /** Очки исследований (player_know_how.points — НЕ валюта). */
  points: number
  /** Слотов активного исследования (2-й слот — за dimes). */
  activeSlots: number
  nodes: Record<string, KnowHowNode>
}

// ── Стафф (Heroes → Staff, canon §3.2) ────────────────────────────────────────

export type StaffKey =
  | 'staff_bruno'
  | 'staff_rosalind'
  | 'staff_marty'
  | 'staff_peggy'
  | 'staff_dizzy'
  | 'staff_lorraine'
  | 'staff_hank'
  | 'staff_clara'
  | 'staff_ada'
  | 'staff_gus'
  | 'staff_buck'
  | 'staff_vernon'

export const STAFF_KEYS: readonly StaffKey[] = [
  'staff_bruno',
  'staff_rosalind',
  'staff_marty',
  'staff_peggy',
  'staff_dizzy',
  'staff_lorraine',
  'staff_hank',
  'staff_clara',
  'staff_ada',
  'staff_gus',
  'staff_buck',
  'staff_vernon',
] as const

/** Нанятый стафф. Апгрейд — staff tokens (НЕ валюта). Гача силы запрещена (D5). */
export interface StaffMember extends Versioned {
  key: StaffKey
  level: number
  hired: boolean
  /** Назначенный пост (staff_assign). */
  assignedPost?: StaffPost
}

// ── Route Pass (ui_route_pass, canon гардрейл — щедрый фри-трек) ───────────────

export type RoutePassTrack = 'free' | 'premium'

export interface RoutePass {
  season: number
  tier: number
  xp: number
  track: RoutePassTrack
  claimedFree: number[]
  claimedPremium: number[]
}

// ── Стрик завсегдатая (mech_regular_streak, streak_check) ──────────────────────

export type StreakState = 'active' | 'frozen' | 'insured' | 'broken'

export interface RegularStreak {
  streakDays: number
  state: StreakState
  insuredUntil?: EpochMs // streak_insure (за tickets, E2)
}

/** Снапшот прогрессии (progression-слайс). */
export interface ProgressionSnapshot {
  farmId: UUID
  farmLevel: number
  xp: number
  knowHow: KnowHowState
  staff: Partial<Record<StaffKey, StaffMember>>
  routePass: RoutePass
  streak: RegularStreak
  staffTokens: number // player_state_counters.staff_tokens (НЕ валюта)
}
