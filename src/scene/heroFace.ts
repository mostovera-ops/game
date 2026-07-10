/**
 * Выражение лица героя: во что поставлены веки прямо сейчас.
 *
 * Живёт рядом с heroSpeech и устроен так же — внешний стор для
 * useSyncExternalStore. Выражение сбрасывается по таймеру: гримаса это отклик
 * на событие, а не состояние, и висеть на лице вечно она не должна.
 *
 * game/ про мимику не знает: он бросает `notices` (пропал урожай, нет
 * ингредиентов), а перевод события в гримасу живёт здесь, как перевод события
 * в текст живёт в ui/HUD.tsx.
 *
 * Числа — поза каждого века: `lid` доля закрытия от позы покоя (0 — открыт,
 * 1 — сомкнут), `roll` наклон линии века вокруг оси взгляда. Знак roll задан
 * для левого глаза, правому его зеркалят.
 */
import type { NoticeKind } from '../game/store'

export type Expression = 'neutral' | 'happy' | 'angry' | 'sad'

export interface LidPose {
  /** Верхнее веко: 0 — как в позе покоя, 1 — опущено до центра глаза. */
  top: number
  /** Нижнее веко, та же шкала. */
  bottom: number
  /** Наклон линии верхнего века, рад. Плюс — внутренний угол вниз. */
  roll: number
}

export const POSES: Record<Expression, LidPose> = {
  neutral: { top: 0, bottom: 0, roll: 0 },
  // Злость: веки надвинуты, внутренние углы вниз — брови домиком наоборот.
  angry: { top: 0.62, bottom: 0.1, roll: 0.75 },
  // Грусть: то же прикрытие, но линия падает наружу.
  sad: { top: 0.5, bottom: 0.05, roll: -0.6 },
  // Радость: щурится снизу, верхнее веко почти не мешает — «улыбка глазами».
  happy: { top: 0.12, bottom: 0.62, roll: -0.12 },
}

/** Событие игры → гримаса. Всё, чего здесь нет, лицо не трогает. */
const BY_NOTICE: Partial<Record<NoticeKind, Expression>> = {
  withered: 'angry', // урожай пропал без полива
  'wrong-dish': 'angry', // блюдо не то, продажа сорвалась
  'no-customer': 'angry', // подавать некому
  'no-ingredients': 'sad', // хотел приготовить, да не из чего
}

/** Сколько гримаса держится на лице. */
export const EXPRESSION_MS = 2200

let current: Expression = 'neutral'
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

export function getExpression(): Expression {
  return current
}

export function subscribeFace(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function setExpression(next: Expression): void {
  clearTimeout(timer)
  current = next
  listeners.forEach((fn) => fn())
  if (next === 'neutral') return
  timer = setTimeout(() => setExpression('neutral'), EXPRESSION_MS)
}

/** Отреагировать на игровое событие. Удачный сбор (amount > 1) — радость. */
export function faceForNotice(kind: NoticeKind, amount?: number): void {
  if (kind === 'harvest') {
    if ((amount ?? 1) > 1) setExpression('happy')
    return
  }
  const next = BY_NOTICE[kind]
  if (next) setExpression(next)
}

// Доступ из DevTools и автопроверок. В прод-сборку не попадает.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __face?: unknown }).__face = { get: getExpression, set: setExpression }
}
