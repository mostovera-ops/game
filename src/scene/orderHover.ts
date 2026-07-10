/**
 * Заказ, на который сейчас навёл курсор игрок.
 *
 * Состав блюда показывается по ховеру облачка над клиентом, а рисует его HUD
 * (обычный DOM). Мостом между сценой и HUD служит этот внешний стор — тот же
 * приём, что и heroSpeech: одно поле, менять чаще некуда, тащить ради него
 * zustand незачем.
 *
 * Храним и id клиента: два соседа могут хотеть одно и то же блюдо, а гаснуть
 * подсказка должна ровно от того, с кого курсор ушёл.
 */
import type { RecipeId } from '../game/store'

export interface HoveredOrder {
  customerId: number
  recipe: RecipeId
  /** Экранные координаты курсора — подсказка встаёт рядом. */
  x: number
  y: number
}

let hovered: HoveredOrder | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function hoverOrder(next: HoveredOrder): void {
  hovered = next
  emit()
}

/** Снять подсветку, если курсор ушёл именно с этого клиента. */
export function unhoverOrder(customerId: number): void {
  if (hovered?.customerId !== customerId) return
  hovered = null
  emit()
}

export function subscribeOrderHover(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getHoveredOrder(): HoveredOrder | null {
  return hovered
}
