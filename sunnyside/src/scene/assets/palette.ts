/**
 * palette.ts — доступ к плоской палитре (21-client §3.7).
 *
 * Источник для КОДА — `./palette.data.json` (Vite запрещает импорт из public/).
 * `public/palette.json` — зеркало для арт-пайплайна/внешних тулов (22-audio-visual);
 * держи оба файла синхронными (или сгенерируй public из src на этапе сборки арта).
 *
 * Именованные цвета, НЕ hex в компонентах. Меняем настроение — правим оба JSON.
 */

import paletteJson from './palette.data.json'

export type PaletteName = Exclude<keyof typeof paletteJson, '_note'>

const palette = paletteJson as Record<string, string>

/** Цвет по имени палитры. Неизвестное имя → magenta-маркер (заметно в dev). */
export function color(name: PaletteName | string): string {
  return palette[name] ?? '#ff00ff'
}
