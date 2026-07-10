/**
 * Что грядка говорит игроку: подпись по ховеру и реплика героя на клик,
 * который ничего не даст.
 *
 * Отдельный модуль, а не кусок Slot.tsx: чистые функции, ни three, ни React —
 * их можно проверить тестом, а не кликами в браузере.
 */
import type { CropId, Slot as SlotState, Tool } from '../game/store'

/** Названия культур для подсказки. Дубль ui/crops.ts: scene/ туда не ходит. */
const CROP_TITLE: Record<CropId, string> = {
  carrot: '🥕 Морковь',
  greens: '🥬 Зелень',
  tomato: '🍅 Томат',
}

/**
 * Сколько ночей растению до созревания: политое поднимается на стадию за ночь,
 * значит их столько, сколько стадий не хватает.
 */
export function nightsLeft(stage: number): number {
  return Math.max(0, 2 - stage)
}

/** «1 день», «2 дня» — считать надо, а не приписывать «дн.». */
export function days(n: number): string {
  return n === 1 ? '1 день' : `${n} дня`
}

function ripeLine(stage: number): string {
  const left = nightsLeft(stage)
  return left === 0 ? 'Созрело — можно собирать' : `До урожая: ${days(left)}`
}

/** Полив читается значком: капля — сухо, галочка — полито. */
const waterLine = (watered: boolean) => (watered ? '✅ Полито' : '💧 Не полито')

/**
 * Что показать по ховеру.
 *
 * Про полив говорим только растущему: пустой грядке он ничего не обещает, а
 * созревшей уже не нужен — собирают её и сухой.
 */
export function slotLabel(slot: SlotState): { title: string; lines: string[] } {
  if (!slot.crop) return { title: 'Пустая грядка', lines: ['Тут можно посадить семена'] }
  const ripe = slot.stage === 2
  return {
    title: CROP_TITLE[slot.crop],
    lines: ripe ? [ripeLine(slot.stage)] : [ripeLine(slot.stage), waterLine(slot.watered)],
  }
}

/**
 * Что герой скажет на клик, который ничего не даст. null — клик сработает.
 *
 * Молчать нельзя: игрок ткнул, курсор показал «нельзя», а почему — непонятно.
 * Реплика произносится сразу, на месте: она про то, что у героя в руках, а не
 * про грядку, и идти ради неё через полкарты незачем.
 *
 * `hasAnySeed` — есть ли у героя семена вообще, `hasSeed` — есть ли выбранный
 * сорт. Пустая сумка важнее инструмента в руках: советовать «выбери семена»
 * тому, у кого их нет ни одного, — издевательство.
 */
export function refusal(
  slot: SlotState,
  tool: Tool,
  hasSeed: boolean,
  hasAnySeed: boolean,
): string | null {
  if (!slot.crop) {
    if (!hasAnySeed) return 'У меня нет семян для посадки. Нужно купить.'
    if (tool !== 'seed') return 'Мне надо выбрать семена для посадки.'
    if (!hasSeed) return 'Эти семена кончились. Надо выбрать другие.'
    return null
  }
  if (tool === 'hand' && slot.stage < 2) {
    const wait = `Пока рано. Урожай будет через ${days(nightsLeft(slot.stage))}.`
    // Сухой росток до урожая и не доживёт — герой напоминает об этом сразу.
    return slot.watered ? wait : `${wait} Сейчас его надо полить.`
  }
  return null
}
