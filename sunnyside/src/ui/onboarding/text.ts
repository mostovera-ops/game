/**
 * ui/onboarding/text.ts — RU/EN словарь UI-хрома FTUE (18-onboarding §5, canon §5).
 * Чистые данные + геттер `t()`. Ноль логики. Ключи канона — английские; строки — RU/EN.
 */

import type { Bilingual, Locale, NpcKey } from '@/types'

export function t(b: Bilingual, locale: Locale): string {
  return locale === 'ru' ? b.ru : b.en
}

/** Экранные имена NPC для подписи портрета-диалога (§3.9). */
export const NPC_NAME: Record<NpcKey, Bilingual> = {
  npc_nana_opal: { en: 'Nana Opal', ru: 'Бабушка Опал' },
  npc_whittaker: { en: 'Old Man Whittaker', ru: 'Старик Уиттакер' },
  npc_trucker_cody: { en: 'Trucker Cody', ru: 'Дальнобойщик Коди' },
  npc_mayor_calloway: { en: 'Mayor Calloway', ru: 'Мэр Кэллоуэй' },
  npc_ricky_ray: { en: 'DJ Ricky Ray', ru: 'Диджей Рикки Рэй' },
  npc_maybelle: { en: 'Miss Maybelle', ru: 'Мисс Мэйбл' },
  npc_grimsby: { en: 'Grimsby', ru: 'Гримсби' },
  npc_postman_pete: { en: 'Postman Pete', ru: 'Почтальон Пит' },
  npc_sheriff_roy: { en: 'Sheriff Roy', ru: 'Шериф Рой' },
  npc_winnie: { en: 'Winnie', ru: 'Винни' },
}

export const TX = {
  // ── Экран письма-наследства (ui_legacy_letter, §2.1) ──
  letterStamp: { en: 'Greetings from Sunnyside', ru: 'Приветы из Санисайда' },
  letterTitle: { en: 'A letter from Nana Opal', ru: 'Письмо от Бабушки Опал' },
  letterBody: {
    en: 'Sugar — by the time you read this I’ll be down in Florida with my sister, soaking up the sun. The farm-diner off Route 66 is yours now: the keys, the recipe box, and one job — grow it, cook it, feed the whole county. Light up that old sign for me. Y’all come back now!',
    ru: 'Солнышко, пока ты читаешь это, я уже во Флориде у сестры, греюсь на солнце. Ферма-закусочная у Route 66 теперь твоя: ключи, коробка рецептов и один наказ — вырасти, приготовь, накорми весь округ. Зажги для меня старую вывеску. Y’all come back now!',
  },
  farmNameLabel: { en: 'Name your farm', ru: 'Назови ферму' },
  avatarLabel: { en: 'Pick a look', ru: 'Выбери образ' },
  begin: { en: 'Take the keys', ru: 'Взять ключи' },
  skip: { en: 'I know how it works → skip', ru: 'Я знаю, как тут всё устроено → пропустить' },

  // ── Диалог NPC (§5 UI-правила) ──
  next: { en: 'Next', ru: 'Дальше' },
  skipLine: { en: 'Skip', ru: 'Пропустить' },
  doStep: { en: 'Do it', ru: 'Сделать' },
  learnKicker: { en: 'Learning', ru: 'Учимся' },
  rewardKicker: { en: 'Reward', ru: 'Награда' },
  dayCounter: { en: 'Day', ru: 'День' },
  of: { en: 'of', ru: 'из' },

  // ── Мини-ярмарка (§3.3 t_day_6) ──
  miniFairTitle: { en: 'Your first fair', ru: 'Твоя первая ярмарка' },
  miniFairGuests: { en: 'Guests are arriving', ru: 'Гости прибывают' },
  blueRibbon: { en: 'Blue Ribbon', ru: 'Синяя лента' },

  // ── Экран выпуска / Grand Opening (ui_grand_opening_intro, §3.4) ──
  releaseTitle: { en: 'Grand Opening', ru: 'Гранд-опенинг' },
  releaseBody: {
    en: 'Nana waves from the porch, Whittaker shakes your hand, and the sign flickers to life. Time to join the living town.',
    ru: 'Бабушка машет с крыльца, Уиттакер жмёт руку, и вывеска зажигается. Пора влиться в живой город.',
  },
  grandOpeningBanner: { en: '×2 income · 7 days', ru: '×2 доход · 7 дней' },
  handoverTitle: { en: 'The farm is yours', ru: 'Ферма — твоя' },

  // ── Автопредложение стрита (§3.8) ──
  streetTitle: { en: 'A street welcomes you', ru: 'Стрит встречает тебя' },
  streetBody: {
    en: 'Maple Row has an open spot and lively neighbors. Join them and bring a dish to the potluck.',
    ru: 'На Кленовой улице есть свободное место и живые соседи. Присоединяйся и принеси блюдо на стол стрита.',
  },
  streetJoin: { en: 'Join the street', ru: 'Вступить на стрит' },
  streetLater: { en: 'Maybe later', ru: 'Позже' },
  streetJoined: { en: 'You joined the street!', ru: 'Ты на стрите!' },

  lightSign: { en: 'Light the sign', ru: 'Зажечь вывеску' },

  // ── Скип-записка (§3.7) ──
  skipNote: {
    en: 'You’ve done this before, sugar — I won’t nag. Keys are on the hook, the recipe box is yours. Go light the sign.',
    ru: 'Тебе не впервой, солнышко — не буду занудствовать. Ключи на месте, коробка рецептов твоя. Иди зажигай вывеску.',
  },
} as const

/**
 * Цели первых реальных дней D1–D7 (§3.5) — мягкая карточка «на сегодня».
 * Показывается после выпуска; не жёсткий квест-лог (§3.5 правила чек-поинтов).
 */
export interface DailyGoal {
  day: number
  goal: Bilingual
  reveals: Bilingual
}

export const DAILY_GOALS: readonly DailyGoal[] = [
  {
    day: 1,
    goal: { en: 'Cook your first real batch', ru: 'Приготовь первую реальную партию' },
    reveals: { en: 'Base loop + street + Grand Opening', ru: 'Базовый цикл + стрит + Гранд-опенинг' },
  },
  {
    day: 2,
    goal: { en: 'Check the mail, claim a Cracker-Jack toy', ru: 'Проверь почту, забери игрушку Cracker-Jack' },
    reveals: { en: 'Mail Catalog, Daily Specials, Prize Machine', ru: 'Каталог, Спецблюда, Prize Machine' },
  },
  {
    day: 3,
    goal: { en: 'Send a real expedition to Illinois', ru: 'Отправь настоящую экспедицию в Иллинойс' },
    reveals: { en: 'Expeditions (far stops), neighbor help', ru: 'Экспедиции (дальние стопы), помощь соседу' },
  },
  {
    day: 4,
    goal: { en: 'Join a street Co-op Order and Potluck', ru: 'Вступи в кооп-заказ стрита и стол стрита' },
    reveals: { en: 'Co-op Orders, Street Potluck', ru: 'Кооп-заказы, Стол стрита' },
  },
  {
    day: 5,
    goal: { en: 'Stock up and build a Blue Plate Special', ru: 'Наготовь сток и собери Сет дня' },
    reveals: { en: 'Blue Plate Special, fair prep', ru: 'Сет дня, подготовка к ярмарке' },
  },
  {
    day: 6,
    goal: { en: 'Work your first live fair', ru: 'Отработай первую живую ярмарку' },
    reveals: { en: 'Full Fair with real people', ru: 'Полная ярмарка с живыми людьми' },
  },
  {
    day: 7,
    goal: { en: 'Live to the weekly finale', ru: 'Доживи до финала недели' },
    reveals: { en: 'Weekly rollover, Route Pass tick', ru: 'Недельный ролловер, тик Route Pass' },
  },
] as const
