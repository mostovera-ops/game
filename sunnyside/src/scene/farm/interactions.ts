/**
 * interactions.ts — чистая логика клика по грядке (02-farm §2.1/§3.4).
 *
 * ЗАЧЕМ: тап по готовой грядке → сбор; по пустой → посев (Seed Picker); по растущей →
 * уход/полив. Здесь — только РАЗРЕШЕНИЕ намерения из состояния грядки и производные для
 * рендера (готовность, прогресс роста, курсор). Никаких расчётов награды/качества/цены —
 * это движок/сервер (AGENTS.md §0.3). `readyAt`/`serverNow` только сравниваются, не
 * начисляют (21-client §3.6 «таймер истёк ≠ начислено»).
 *
 * ГРАНИЦА: чистые функции, ноль three/react.
 */

import type { EpochMs, Plot, PlotState } from '@/types'

/** Контекст-действие по клику на грядку. */
export type PlotAction = 'sow' | 'water' | 'harvest' | 'none'

/**
 * Визуальное состояние грядки с учётом дедлайна: растущая грядка, чей `readyAt` уже
 * прошёл по серверному времени, показывается готовой (спелой) — до фактического забора.
 * Это НЕ начисление (сбор — отдельная подтверждаемая мутация), только отображение.
 */
export function plotVisualState(plot: Plot, now: EpochMs): PlotState {
  if (plot.state === 'growing' && plot.readyAt !== undefined && now >= plot.readyAt) {
    return 'ready'
  }
  return plot.state
}

/** Действие по клику, исходя из ВИЗУАЛЬНОГО состояния (растущая+созревшая → сбор). */
export function plotAction(visualState: PlotState): PlotAction {
  switch (visualState) {
    case 'empty':
      return 'sow'
    case 'growing':
      return 'water'
    case 'ready':
      return 'harvest'
    // withered в игре не существует как «брак» (P3), но если пришло — разбираем как сбор.
    case 'withered':
      return 'harvest'
  }
}

/** Действие по клику на грядку с учётом времени (композиция visual+action). */
export function resolvePlotAction(plot: Plot, now: EpochMs): PlotAction {
  return plotAction(plotVisualState(plot, now))
}

/** Курсор-подсказка: любая грядка кликабельна (посев/уход/сбор) → «указатель». */
export function plotCursor(): 'pointer' {
  return 'pointer'
}

/** Готова ли грядка к сбору по серверному времени (для «Собрать всё» и хинтов). */
export function isPlotReady(plot: Plot, now: EpochMs): boolean {
  return plotVisualState(plot, now) === 'ready'
}

/**
 * Прогресс роста 0..1 для рендера (масштаб рассады, покачивание). Требует `plantedAt`
 * и `readyAt`; готовая грядка → 1, пустая → 0. Клампится в [0,1].
 */
export function growthProgress(plot: Plot, now: EpochMs): number {
  if (plot.state === 'ready') return 1
  if (plot.state === 'empty' || plot.state === 'withered') return 0
  const { plantedAt, readyAt } = plot
  if (plantedAt === undefined || readyAt === undefined || readyAt <= plantedAt) {
    return plot.state === 'growing' ? 0.5 : 0
  }
  const p = (now - plantedAt) / (readyAt - plantedAt)
  return Math.max(0, Math.min(1, p))
}
