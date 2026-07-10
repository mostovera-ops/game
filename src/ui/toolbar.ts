/**
 * Раскладка нижнего тулбара: десять ячеек, слева направо.
 *
 * Порядок фиксирован: сначала пакетики семян в порядке CROPS, затем лейка и
 * рука, затем собранный урожай. Пустого не показываем — ни нулей, ни блёклых
 * иконок: если семян нет, ячейку занимает следующий предмет.
 *
 * Отсюда же берутся горячие клавиши: цифра — номер ячейки, десятая ячейка это
 * «0». Раскладка живёт в одном месте, поэтому клавиша всегда бьёт в ту ячейку,
 * которую игрок видит.
 *
 * Чистая функция без React: её зовут и тулбар, и обработчик клавиш в HUD.
 */
import type { CropId, Inventory, Phase, Tool } from '../game/store'
import { CROPS } from '../game/store'

export const TOOLBAR_CELLS = 10

export type Cell =
  /** Пакетик семян: клик берёт их в руки. */
  | { kind: 'seed'; crop: CropId }
  /** Инструмент без запаса. */
  | { kind: 'tool'; tool: Exclude<Tool, 'seed'> }
  /** Собранный урожай: показывает счётчик, кликать нечего. */
  | { kind: 'crop'; crop: CropId; count: number }

/**
 * Ячейка и её горячая клавиша; null — пустая ячейка.
 *
 * В день торговли клавиша пустая: цифры там подают блюда, и подписывать ими
 * ячейки значит обещать то, чего не будет.
 */
export interface Slot {
  cell: Cell | null
  hotkey: string
}

/** Цифра ячейки: 1…9, затем 0. */
export function hotkeyFor(index: number): string {
  return String((index + 1) % 10)
}

/**
 * Что лежит в тулбаре при этих семенах и урожае.
 *
 * В день торговли инструменты не нужны — грядки на замке, — поэтому остаётся
 * только урожай: из него игрок собирает блюда.
 */
export function buildToolbar(phase: Phase, seeds: Inventory, inventory: Inventory): Slot[] {
  const cells: Cell[] = []

  if (phase === 'farm') {
    for (const crop of CROPS) {
      if (seeds[crop] > 0) cells.push({ kind: 'seed', crop })
    }
    cells.push({ kind: 'tool', tool: 'can' })
    cells.push({ kind: 'tool', tool: 'hand' })
  }

  for (const crop of CROPS) {
    if (inventory[crop] > 0) cells.push({ kind: 'crop', crop, count: inventory[crop] })
  }

  return Array.from({ length: TOOLBAR_CELLS }, (_, i) => ({
    cell: cells[i] ?? null,
    hotkey: phase === 'farm' ? hotkeyFor(i) : '',
  }))
}
