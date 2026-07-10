/**
 * neonGlyphs.ts — чистое отображение сохранённой вывески игрока (`NeonSignConfig`, Neon
 * Builder, 17-collections §3.7 / canon §3.13) в примитивы сцены. Буквы — плоские
 * заглушки с эмиссией (AGENTS.md §5 «до GLB — примитивы»), не настоящий текст-шрифт.
 * Файл назван не `NeonSign.ts`, чтобы не конфликтовать по регистру с компонентом
 * `NeonSign.tsx` на файловых системах без учёта регистра (см. TS1149).
 *
 * `NEON_COLOR_HEX` ДУБЛИРУЕТ `ui/collections/tokens.ts` `NEON_COLORS` (те же id→hex) —
 * копия НАМЕРЕННАЯ, тем же паттерном, что уже документирован в докстринге того файла:
 * `scene/` не импортирует `ui/` (AGENTS.md §3 граф зависимостей — scene→ui не входит в
 * разрешённые направления, а `ui/` и так собственная зона другого агента, AGENTS.md §0.6).
 * Расхождение значений здесь означало бы баг ревью, не «два независимых стиля».
 *
 * ГРАНИЦА: чистые функции, ноль three/react.
 */

import type { NeonAnimationKey } from '@/types'

/** Неоновые цвета Neon Builder — id→hex (зеркало `ui/collections/tokens.ts` NEON_COLORS). */
export const NEON_COLOR_HEX: Readonly<Record<string, string>> = {
  cherry_red: '#FF3B5C',
  teal: '#2FE6C8',
  gold: '#FFD24C',
  purple: '#C86BFF',
  ice_blue: '#7FE0FF',
}

/** Фолбэк-цвет для неизвестного/пустого `colorIds` — canon §4.2 `pal_neon_pink`. */
export const NEON_FALLBACK_HEX = '#FF3F81'

/** Основной цвет вывески: первый выбранный `colorIds`, иначе фолбэк. */
export function resolveNeonHex(colorIds: readonly string[] | undefined): string {
  const first = colorIds?.[0]
  return (first !== undefined ? NEON_COLOR_HEX[first] : undefined) ?? NEON_FALLBACK_HEX
}

/** Одна «буква»-заглушка строки: символ + X-смещение (моноширинная раскладка). */
export interface NeonGlyph {
  char: string
  x: number
}

/** Шаг между буквами, юниты сцены. */
export const GLYPH_SPACING = 0.32

/** Раскладка символов строки моноширинным рядом, центрированным по X. Пробелы не рисуются. */
export function layoutNeonLine(line: string): NeonGlyph[] {
  const chars = [...line].filter((c) => c.trim().length > 0)
  const total = chars.length
  const startX = total > 0 ? -((total - 1) * GLYPH_SPACING) / 2 : 0
  return chars.map((char, i) => ({ char, x: startX + i * GLYPH_SPACING }))
}

/**
 * Доля свечения буквы №`index` в рендер-момент `t` (сек, `clock.elapsedTime` — презентация,
 * не игровая логика, см. `anim.ts`). `steady` — не мигает; `blink` — мягкое дыхание (P1
 * «дружелюбно», никогда не гаснет до нуля); `chase` — бегущая волна по буквам.
 */
export function neonGlowAt(animation: NeonAnimationKey, t: number, index: number): number {
  if (animation === 'steady') return 1
  if (animation === 'blink') return 0.775 + 0.225 * Math.sin(t * 3.5)
  const wave = Math.sin(t * 3 - index * 0.9)
  return 0.4 + 0.6 * Math.max(0, wave)
}
