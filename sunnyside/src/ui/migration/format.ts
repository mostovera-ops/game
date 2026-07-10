/**
 * ui/migration/format.ts — презентационные хелперы для переездов (12-migration). Только
 * форматирование уже посчитанных сервером чисел (кулдаун/тэлли/кворум) — истина из
 * `TownSnapshot`/`MigrateFarmRes`, здесь их не считаем (AGENTS.md §0.3).
 */
import type { MigrationProposal } from '@/types'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

/** Остаток кулдауна Moving Van в компактном виде («5д 3ч», «1ч 20м», «готов»). */
export function formatCooldown(remainingMs: number, ru: boolean): string {
  if (remainingMs <= 0) return ru ? 'готов' : 'ready'
  const days = Math.floor(remainingMs / DAY_MS)
  const hours = Math.floor((remainingMs % DAY_MS) / HOUR_MS)
  const minutes = Math.floor((remainingMs % HOUR_MS) / 60_000)
  if (days > 0) return ru ? `${days}д ${hours}ч` : `${days}d ${hours}h`
  if (hours > 0) return ru ? `${hours}ч ${minutes}м` : `${hours}h ${minutes}m`
  return ru ? `${minutes}м` : `${minutes}m`
}

/** Статус голосования, выведенный из тэлли/кворума/окна (12-migration §3.2.1/§3.3.3). Только
 * для UI-отображения — сама механика (кто прошёл) уже решена сервером/local-симуляцией. */
export type MigrationStatus = 'open' | 'passed' | 'failed'

export function migrationStatus(proposal: MigrationProposal, now: number): MigrationStatus {
  if (proposal.tally.yes >= proposal.tally.quorum) return 'passed'
  if (now >= proposal.votingWindow.closesAt) return 'failed'
  return 'open'
}

/** Прогресс тэлли к кворуму в процентах, клампленный [0,100] (для полоски прогресса). */
export function quorumProgressPct(yes: number, quorum: number): number {
  if (quorum <= 0) return 100
  return Math.min(100, Math.max(0, Math.round((100 * yes) / quorum)))
}

/** Остаток окна голосования («2д 4ч», «истекло») — тот же компактный формат, что и кулдаун. */
export function formatVotingRemaining(ms: number, ru: boolean): string {
  if (ms <= 0) return ru ? 'истекло' : 'expired'
  return formatCooldown(ms, ru)
}
