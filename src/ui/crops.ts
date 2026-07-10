/**
 * Подписи предметов и блюд для HUD. Стор хранит только id — язык интерфейса
 * живёт здесь. Отдельный модуль, потому что подписи нужны и тулбару, и
 * инвентарю, и книге рецептов, а импортировать их друг у друга значило бы
 * завязать цикл.
 *
 * Ключ — ItemId, а не CropId: в сумке рядом с урожаем лежат лесные находки,
 * и рисуются они теми же ячейками.
 */
import type { ForageId, ItemId, RecipeId } from '../game/store'

export const ITEM_EMOJI: Record<ItemId, string> = {
  carrot: '🥕',
  greens: '🥬',
  tomato: '🍅',
  mushroom: '🍄',
  egg: '🥚',
}

export const ITEM_NAME: Record<ItemId, string> = {
  carrot: 'Морковь',
  greens: 'Зелень',
  tomato: 'Томат',
  mushroom: 'Гриб',
  egg: 'Яйцо',
}

export const RECIPE_EMOJI: Record<RecipeId, string> = {
  salad: '🥗',
  soup: '🍲',
  taco: '🌮',
  mushroom_soup: '🍜',
  omelette: '🍳',
}

export const RECIPE_NAME: Record<RecipeId, string> = {
  salad: 'Салат',
  soup: 'Суп',
  taco: 'Тако',
  mushroom_soup: 'Грибной суп',
  omelette: 'Яичница',
}

/** Где искать находку. Подсказка в книге рецептов под закрытым рецептом. */
export const FORAGE_HINT: Record<ForageId, string> = {
  mushroom: 'Найдите гриб в лесу',
  egg: 'Найдите птичье гнездо в лесу',
}
