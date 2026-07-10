/**
 * engine/progression/modifiers.ts — АГРЕГАТОР модификаторов прогрессии (13-progression).
 *
 * Единая точка, из которой соседние системы (ферма/крафт/маркет/экспедиции) читают
 * суммарный эффект прогрессии на нужный им канал: навыки стаффа (§3.1.1/§3.1.2),
 * синергии сетов (§3.1.5) и изученные узлы Know-How (§3.2.2–3.2.5) складываются
 * АДДИТИВНО (§3.1.5 «бонус синергии аддитивен к индивидуальным навыкам») в общий стек.
 *
 * Потребление — через контракт (объект `ProgressionModifiers` + `getModifier`), не
 * через внутренности: система крафта спрашивает `getModifier(bag, 'cooking_time_pct')`,
 * не зная, что сумма набралась из Bruno + Kitchen Brigade + Mise en Place + Cookery Mastery.
 *
 * ВАЖНО (анти-чит): это предсказание для UI/локальных прикидок; итог начисления —
 * серверный (AGENTS.md §0.3).
 *
 * ГРАНИЦА: чистые функции, ноль сети/three.
 */

import type { StaffKey } from '@/types'
import type { ModifierBag, ModifierContribution, ModifierKey } from './effects'
import { STAFF_POST } from './constants'
import { effectiveStaffSkill } from './staffSkills'
import { activeSynergies, type SynergyId } from './synergy'
import { KNOW_HOW_NODE_EFFECTS } from './knowHowEffects'

/** Состояние персонажа для агрегации (минимум, нужный для эффектов). */
export interface StaffAssignment {
  key: StaffKey
  level: number
  hired: boolean
  /** Пост, на который назначен (эффект только если === канонический пост, §3.1.3). */
  assignedPost?: string
}

/** Вход агрегатора: назначения стаффа + изученные узлы know-how. */
export interface ModifierState {
  staff: readonly StaffAssignment[]
  studiedNodes: readonly string[]
}

/** Результат агрегации — стек модификаторов + активные синергии + активный стафф. */
export interface ProgressionModifiers {
  /** Сумма дельт по каналам (аддитивно). */
  modifiers: ModifierBag
  /** Активные синергии (для UI-панели «что активно»). */
  activeSynergies: SynergyId[]
  /** Персонажи, дающие эффект (назначены на свой пост). */
  activeStaff: StaffKey[]
}

/** Активен ли персонаж: нанят и назначен на СВОЙ канонический пост (§3.1.3). */
export function isStaffActive(a: StaffAssignment): boolean {
  return a.hired && a.assignedPost === STAFF_POST[a.key]
}

/** Складывает вклад в аккумулятор (аддитивно). */
function addContribution(bag: Map<ModifierKey, number>, c: ModifierContribution): void {
  bag.set(c.key, (bag.get(c.key) ?? 0) + c.value)
}

/**
 * Агрегирует все модификаторы прогрессии в единый стек (§3.1.1/§3.1.5/§3.2).
 * Только АКТИВНЫЕ персонажи (на своём посту) дают навык и участвуют в синергиях.
 */
export function aggregateModifiers(state: ModifierState): ProgressionModifiers {
  const bag = new Map<ModifierKey, number>()

  // 1) Навыки активного стаффа (масштабированы уровнем).
  const active = state.staff.filter(isStaffActive)
  const activeSet = new Set<StaffKey>(active.map((a) => a.key))
  for (const a of active) {
    const skill = effectiveStaffSkill(a.key, a.level)
    if (skill) addContribution(bag, skill)
  }

  // 2) Синергии активных сетов (аддитивны к навыкам).
  const synergies = activeSynergies(activeSet)
  for (const syn of synergies) {
    for (const b of syn.bonuses) addContribution(bag, b)
  }

  // 3) Эффекты изученных узлов know-how (дедуп ключей).
  const seenNodes = new Set<string>()
  for (const node of state.studiedNodes) {
    if (seenNodes.has(node)) continue
    seenNodes.add(node)
    const effects = KNOW_HOW_NODE_EFFECTS[node]
    if (effects) for (const e of effects) addContribution(bag, e)
  }

  return {
    modifiers: Object.fromEntries(bag) as ModifierBag,
    activeSynergies: synergies.map((s) => s.id),
    activeStaff: [...activeSet],
  }
}

/** Значение канала из стека (0, если отсутствует). Публичный аксессор для систем. */
export function getModifier(bag: ModifierBag, key: ModifierKey): number {
  return bag[key] ?? 0
}
