/**
 * Подписи культур и блюд для HUD. Стор хранит только id — язык интерфейса
 * живёт здесь. Отдельный модуль, потому что подписи нужны и тулбару, и
 * инвентарю, а импортировать их друг у друга значило бы завязать цикл.
 */
import type { CropId, RecipeId } from '../game/store'

export const CROP_EMOJI: Record<CropId, string> = { carrot: '🥕', greens: '🥬', tomato: '🍅' }
export const CROP_NAME: Record<CropId, string> = {
  carrot: 'Морковь',
  greens: 'Зелень',
  tomato: 'Томат',
}

export const RECIPE_EMOJI: Record<RecipeId, string> = { salad: '🥗', soup: '🍲', taco: '🌮' }
export const RECIPE_NAME: Record<RecipeId, string> = {
  salad: 'Салат',
  soup: 'Суп',
  taco: 'Тако',
}
