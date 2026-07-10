/**
 * Раскладка тулбара: десять ячеек, и в каждой лежит конкретный предмет.
 *
 * Раскладка — состояние, а не производная от инвентаря. Предмет занимает
 * ячейку и остаётся в ней, пока не кончится: истратил последнее семя моркови —
 * её ячейка пустеет, но соседи не сдвигаются. Игрок привыкает к тому, что под
 * цифрой 3 всегда одно и то же, и может переложить предметы как хочет.
 *
 * Новый предмет садится в первую свободную ячейку слева. Это единственное
 * место, где раскладка решает за игрока: остальное он двигает сам.
 *
 * Чистые функции без React и без zustand: их зовёт стор, а тесты — напрямую.
 */
import type { CropId, Inventory } from './store'
import { CROPS } from './store'

export const TOOLBAR_CELLS = 10

export type ToolbarItem =
  /** Пакетик семян: клик берёт их в руки. */
  | { kind: 'seed'; crop: CropId }
  /** Собранный урожай: кликать нечего, только счётчик. */
  | { kind: 'crop'; crop: CropId }

export type ToolbarLayout = (ToolbarItem | null)[]

export function emptyToolbar(): ToolbarLayout {
  return Array.from({ length: TOOLBAR_CELLS }, () => null)
}

/** Сколько штук этого предмета у героя. Ноль — предмета нет. */
export function itemCount(item: ToolbarItem, seeds: Inventory, inventory: Inventory): number {
  return item.kind === 'seed' ? seeds[item.crop] : inventory[item.crop]
}

const same = (a: ToolbarItem, b: ToolbarItem) => a.kind === b.kind && a.crop === b.crop

/**
 * Приводит раскладку в соответствие с тем, чем герой владеет.
 *
 * Кончившийся предмет освобождает свою ячейку; появившийся садится в первую
 * свободную слева. Всё остальное остаётся на местах — в этом и смысл.
 *
 * Зовётся после каждого изменения seeds/inventory: посадки, сбора, покупки,
 * выдачи блюда. Дешевле, чем следить за каждым переходом счётчика через ноль.
 */
export function reconcileToolbar(
  layout: ToolbarLayout,
  seeds: Inventory,
  inventory: Inventory,
): ToolbarLayout {
  const next: ToolbarLayout = layout
    .slice(0, TOOLBAR_CELLS)
    .map((item) => (item && itemCount(item, seeds, inventory) > 0 ? item : null))
  while (next.length < TOOLBAR_CELLS) next.push(null)

  const present = (item: ToolbarItem) => next.some((x) => x && same(x, item))
  const wanted: ToolbarItem[] = [
    ...CROPS.map((crop): ToolbarItem => ({ kind: 'seed', crop })),
    ...CROPS.map((crop): ToolbarItem => ({ kind: 'crop', crop })),
  ]

  for (const item of wanted) {
    if (itemCount(item, seeds, inventory) === 0 || present(item)) continue
    const free = next.indexOf(null)
    if (free < 0) break // все десять заняты — новому предмету некуда сесть
    next[free] = item
  }
  return next
}

/**
 * Перекладывает предмет из ячейки в ячейку. Занятая цель — обмен местами:
 * иначе игрок, промахнувшись, терял бы предмет из-под курсора.
 */
export function moveItem(layout: ToolbarLayout, from: number, to: number): ToolbarLayout {
  const ok = (i: number) => i >= 0 && i < TOOLBAR_CELLS
  if (!ok(from) || !ok(to) || from === to || !layout[from]) return layout
  const next = [...layout]
  next[to] = layout[from]
  next[from] = layout[to]
  return next
}

/** Цифра ячейки: 1…9, затем 0. */
export function hotkeyFor(index: number): string {
  return String((index + 1) % 10)
}
