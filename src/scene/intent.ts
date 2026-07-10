/**
 * Отложенное действие: «подойти к точке и сделать там дело».
 *
 * Ни клик по грядке, ни клик по лавке, ни клик по болтливому пропсу не
 * срабатывают на месте — все ставят намерение и ведут героя. Дело выполняется,
 * когда герой вошёл в reach и довернулся лицом к цели (Interactions в Farm.tsx).
 *
 * Мутабельный синглтон, а не zustand: намерение читается каждый кадр, и гонять
 * его через React незачем. Отдельный модуль по той же причине, что heroTarget:
 * экспорт не-компонента из файла с компонентом ломает Fast Refresh.
 */
import type { ForageId } from '../game/store'
import { hero } from './heroState'

interface Target {
  /** Мировые координаты цели: по ним меряем, дотянулся ли герой. */
  x: number
  z: number
  /**
   * С какого расстояния до цели дело считается сделанным.
   *
   * У слота это REACH: он маленький, герой встаёт вплотную. У лавки цель —
   * центр пропса, а сама лавка ему коллайдер: ближе, чем на полкорпуса, герой
   * не подойдёт, и REACH до центра не дотягивается. Поэтому радиус свой.
   */
  reach: number
}

export type Intent =
  /** Поработать со слотом: что именно — решает инструмент в руках. */
  | (Target & { kind: 'slot'; id: string })
  /** Подойти к прилавку и открыть торговлю. */
  | (Target & { kind: 'shop' })
  /** Подойти к пропсу и произнести реплику. */
  | (Target & { kind: 'speak'; text: string })
  /** Подойти к находке в лесу и подобрать её. */
  | (Target & { kind: 'forage'; id: string; item: ForageId })

export const intent: { current: Intent | null } = { current: null }

export function setIntent(next: Intent): void {
  intent.current = next
}

/** Снять намерение: игрок передумал (пошёл на WASD, кликнул в землю). */
export function clearIntent(): void {
  intent.current = null
  // Доворот жил ради этого намерения — ждать его больше некому.
  hero.faceAt = null
  hero.facing = true
}

// Доступ из DevTools и автопроверок. В прод-сборку не попадает.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __intent?: unknown }).__intent = intent
}
