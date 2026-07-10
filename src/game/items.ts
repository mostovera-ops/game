/**
 * Предметы, которыми герой владеет: культуры и лесные находки.
 *
 * Отдельный модуль, а не часть store.ts, из-за цикла: раскладку тулбара считает
 * toolbar.ts, стор её хранит и потому импортирует toolbar, а toolbar'у нужны
 * списки предметов. Кольцо `store → toolbar → store` рушило загрузку модуля —
 * стор успевал позвать emptyToolbar раньше, чем toolbar.ts доисполнялся.
 *
 * Здесь только данные о предметах: ни правил, ни состояния. Оба модуля берут их
 * отсюда и друг о друге не знают.
 */

export type CropId = 'carrot' | 'greens' | 'tomato'

/**
 * Лесные находки. Их не сажают и не покупают — их находят, поэтому у них нет
 * ни семян, ни цены. Отдельный тип от CropId: в грядку гриб не воткнёшь.
 */
export type ForageId = 'mushroom' | 'egg'

/** Всё, что лежит в сумке героя: и урожай, и находки. */
export type ItemId = CropId | ForageId

/** Сумка героя. Находки лежат в ней рядом с урожаем — тратятся они одинаково. */
export type Inventory = Record<ItemId, number>

/** Семена на руках. Только культуры: находки не сеют. */
export type Seeds = Record<CropId, number>

export const CROPS: CropId[] = ['carrot', 'greens', 'tomato']

export const FORAGE_IDS: ForageId[] = ['mushroom', 'egg']

/** Порядок ячеек в сумке: сперва урожай, потом находки. */
export const ITEM_IDS: ItemId[] = [...CROPS, ...FORAGE_IDS]
