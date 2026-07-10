/**
 * anim.ts — чистые кривые процедурных анимаций сцены фермы (наследие прототипа: «pop»,
 * покачивание растений). Время анимаций — рендер-время (performance.now/clock.elapsedTime),
 * НЕ игровое serverNow (это не игровая логика, а презентация — AGENTS.md §0.4 не про рендер).
 *
 * ГРАНИЦА: чистые функции, ноль three/react. Node-тестируемо.
 */

/** Длительность «pop»-анимации сбора по умолчанию, мс. */
export const POP_DURATION_MS = 360

/** Результат тика «pop»: масштаб множителя и признак завершения. */
export interface PopTick {
  scale: number
  done: boolean
}

/**
 * «Pop» при сборе: культура сначала подскакивает (масштаб до 1.4 в середине), затем
 * схлопывается в 0 — визуальный «сбор в руку». `elapsedMs` — сколько прошло с клика.
 */
export function popTick(elapsedMs: number, durationMs: number = POP_DURATION_MS): PopTick {
  const d = durationMs > 0 ? durationMs : POP_DURATION_MS
  const t = Math.max(0, Math.min(1, elapsedMs / d))
  const PEAK = 1.4
  let scale: number
  if (t < 0.5) {
    // 1 → 1.4 (подскок)
    scale = 1 + (PEAK - 1) * (t / 0.5)
  } else {
    // 1.4 → 0 (схлопывание)
    scale = PEAK * (1 - (t - 0.5) / 0.5)
  }
  return { scale: Math.max(0, scale), done: t >= 1 }
}

/**
 * Покачивание растения: малый угол по Z (радианы) от рендер-времени. `phase` разводит
 * соседние грядки, чтобы поле «дышало» не в унисон. Амплитуда мала (лёгкий sway).
 */
export function swayRotation(timeSec: number, phase: number = 0, amplitude: number = 0.08): number {
  return amplitude * Math.sin(timeSec * 1.5 + phase)
}

/** Масштаб рассады по прогрессу роста 0..1: от ростка (0.2) до полной культуры (1). */
export function growScale(progress: number): number {
  const p = Math.max(0, Math.min(1, progress))
  return 0.2 + 0.8 * p
}

/**
 * «Дыхание» готовой к сбору грядки: лёгкий подскок по Y + пульс масштаба — приглашение
 * тапнуть (02-farm §2.1 «иконка над грядкой»). Возвращает смещение Y и множитель масштаба.
 */
export function readyPulse(timeSec: number, phase: number = 0): { bobY: number; scale: number } {
  return {
    bobY: 0.06 + 0.05 * Math.sin(timeSec * 2 + phase),
    scale: 1 + 0.05 * Math.sin(timeSec * 3 + phase),
  }
}
