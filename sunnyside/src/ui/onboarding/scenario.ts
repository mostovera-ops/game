/**
 * ui/onboarding/scenario.ts — данные сжатой мини-недели (18-onboarding §3.3/§4.1/§4.2).
 *
 * ЧИСТЫЕ ДАННЫЕ, НЕ ЛОГИКА: 7 шагов t_day_1..7, каждый — {действие → чему учит →
 * награда → реплики NPC}. Реплики RU — из спеки §3.3 (внутриигровой текст-канон);
 * EN — вайб-перевод (canon §5 двуязычие). Награды детерминированы (§4.2) и заданы
 * ТЕКСТОМ — никаких эконом-расчётов в UI (реальные начисления — штатные системы).
 *
 * `target` — ключ подсветки-споллайта: компонент цели помечает себя
 * `data-onboarding-target="<key>"`, `Spotlight` наводит на него мягкое свечение и
 * стрелку. Подсветка НЕ блокирует экран (§5: «можно осмотреться»), поэтому
 * отсутствие цели в текущей сцене безопасно (best-effort).
 */

import type { Bilingual, NpcKey } from '@/types'

/** Косметические пресеты аватара (D11 — без влияния на геймплей, §2.1). */
export type AvatarPresetKey = 'sunny' | 'denim' | 'gingham' | 'overalls'

export interface AvatarPreset {
  key: AvatarPresetKey
  label: Bilingual
  /** Плоский цвет-заглушка (замена финальному портрету-ассету). */
  color: string
}

export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  { key: 'sunny', label: { en: 'Sunny', ru: 'Солнечный' }, color: '#d89a2b' },
  { key: 'denim', label: { en: 'Denim', ru: 'Джинса' }, color: '#3f6fd0' },
  { key: 'gingham', label: { en: 'Gingham', ru: 'Клетка' }, color: '#c63f33' },
  { key: 'overalls', label: { en: 'Overalls', ru: 'Комбинезон' }, color: '#0b9077' },
] as const

/** Ключи целей подсветки (споллайт наводится на `data-onboarding-target`). */
export type SpotlightTarget =
  | 'demand_board'
  | 'plot'
  | 'kitchen'
  | 'expeditions'
  | 'coop'
  | 'fair_stall'
  | 'shift'
  | 'weekly_check'

export interface DialogueLine {
  npc: NpcKey
  text: Bilingual
}

export interface MiniWeekStep {
  /** Канон-ключ сжатого дня. */
  id: `t_day_${1 | 2 | 3 | 4 | 5 | 6 | 7}`
  /** Номер дня 1..7 (для «День N из 7»). */
  day: number
  title: Bilingual
  /** Ведущий NPC шага (core-loop §3.9 распределяет по дням). */
  lead: NpcKey
  /** Цель подсветки-споллайта (опц.). */
  target?: SpotlightTarget
  /** Сжатый таймер шага в секундах (§4.1). Отсутствует — шаг чисто по действию. */
  timerSec?: number
  /** Подпись кнопки действия-гейта. */
  action: Bilingual
  /** Чему учит шаг (§3.3). */
  learn: Bilingual
  /** Детерминированная награда шага (§4.2), текстом. */
  reward: Bilingual
  /** Реплики NPC шага. */
  lines: DialogueLine[]
  /** t_day_6 — финальная мини-ярмарка с NPC-гостями (§2.2/§3.3). */
  miniFair?: boolean
}

/**
 * 7 шагов мини-недели. Тексты реплик — из 18-onboarding §3.3 (RU-канон + EN-вайб).
 * Тайминги — §4.1 (гипотезы), награды — §4.2 (детерминированы).
 */
export const MINI_WEEK_STEPS: readonly MiniWeekStep[] = [
  {
    id: 't_day_1',
    day: 1,
    title: { en: 'Plan', ru: 'План' },
    lead: 'npc_nana_opal',
    target: 'plot',
    timerSec: 10,
    action: { en: 'Sow two beds', ru: 'Засеять две грядки' },
    learn: {
      en: 'The basic loop: read demand, sow what the county needs.',
      ru: 'Базовый цикл: читаем спрос, сеем то, что нужно округу.',
    },
    reward: { en: '+2 sown beds', ru: '+2 засеянные грядки' },
    lines: [
      {
        npc: 'npc_nana_opal',
        text: {
          en: 'Well hello, sugar. The soil here is kind — what you sow feeds the whole county. Start with tomatoes, my diner ran on them. Go on, a bed won’t bite!',
          ru: 'Ну здравствуй, солнышко. Земля тут добрая — что посеешь, то и накормит округ. Начни с помидоров, у меня на них вся закусочная держалась. Смелей — грядка не кусается!',
        },
      },
      {
        npc: 'npc_whittaker',
        text: {
          en: 'Hold the hoe like I show you. Two beds of tomato — and off we go, they’ll be up by morning.',
          ru: 'Тяпку держи как я показываю. Две грядки под томат — и айда, к утру подрастут.',
        },
      },
    ],
  },
  {
    id: 't_day_2',
    day: 2,
    title: { en: 'Produce', ru: 'Производство' },
    lead: 'npc_nana_opal',
    target: 'kitchen',
    timerSec: 15,
    action: { en: 'Cook Tomato Soup', ru: 'Сварить томатный суп' },
    learn: {
      en: 'Harvest, then craft by recipe from the Recipe Box.',
      ru: 'Сбор урожая и крафт по рецепту из Коробки рецептов.',
    },
    reward: { en: 'Tomato Soup recipe pinned forever', ru: 'Рецепт «Томатный суп» закреплён навсегда' },
    lines: [
      {
        npc: 'npc_nana_opal',
        text: {
          en: 'Here she is — my recipe box, now yours. First one’s tomato soup, the family one. Set the pot, and when it smells right, take it off. Cooking is love times patience… and a timer, ha!',
          ru: 'Вот она, моя коробка рецептов — теперь твоя. Первый — томатный суп, семейный. Поставь кастрюлю, а как запахнет — снимай. Готовка это любовь, помноженная на терпение… и на таймер, ха!',
        },
      },
    ],
  },
  {
    id: 't_day_3',
    day: 3,
    title: { en: 'Expedition', ru: 'Экспедиция' },
    lead: 'npc_trucker_cody',
    target: 'expeditions',
    timerSec: 20,
    action: { en: 'Send the truck', ru: 'Отправить грузовик' },
    learn: {
      en: 'Expeditions open the world; a run timer, then restock.',
      ru: 'Экспедиции открывают мир: таймер рейса, потом пополнение склада.',
    },
    reward: { en: 'T1–T2 goods + Expeditions unlocked', ru: 'Сырьё T1–T2 + открыта иконка экспедиций' },
    lines: [
      {
        npc: 'npc_trucker_cody',
        text: {
          en: 'First run, rookie? Home County’s close — there and back in a minute. The far roads, all the way to California, open up once you’re seasoned. Take the truck!',
          ru: 'Первый рейс, салага? Home County рядом — сгоняю туда-обратно за минуту. Дороги дальше, до самой Калифорнии, откроются, как заматереешь. Держи кузов!',
        },
      },
      {
        npc: 'npc_nana_opal',
        text: {
          en: 'Cody’s a chatterbox, but he hauls honest. Listen to him about the roads.',
          ru: 'Коди — балабол, но возит честно. Слушай его про дороги.',
        },
      },
    ],
  },
  {
    id: 't_day_4',
    day: 4,
    title: { en: 'Push', ru: 'Разгон' },
    lead: 'npc_mayor_calloway',
    target: 'coop',
    action: { en: 'Turn in 3 soups', ru: 'Сдать 3 супа' },
    learn: {
      en: 'Positive-sum co-op: your contribution feeds the shared pot.',
      ru: 'Позитив-сумм кооперация: твой вклад идёт в общий котёл заказа.',
    },
    reward: { en: 'Co-op share: $30 + 🎟 1', ru: 'Доля кооп-награды: $30 + 🎟 1' },
    lines: [
      {
        npc: 'npc_mayor_calloway',
        text: {
          en: 'On behalf of the town — thank you, neighbor. See how it works? One pie feeds your pocket and the common ledger both. ’Round here helping pays better than hoarding.',
          ru: 'От лица города — спасибо, сосед. Видишь, как это работает? Один пирог кормит и твой карман, и общий счёт. У нас тут так заведено: помогать выгодней, чем жадничать.',
        },
      },
    ],
  },
  {
    id: 't_day_5',
    day: 5,
    title: { en: 'Prep', ru: 'Прожарка' },
    lead: 'npc_ricky_ray',
    target: 'fair_stall',
    action: { en: 'Bake a Cherry Pie', ru: 'Испечь вишнёвый пирог' },
    learn: {
      en: 'Weekdays feed Saturday: price the stall, bake tomorrow’s contest pie.',
      ru: 'Будни кормят субботу: цена на прилавке, пирог к завтрашнему конкурсу.',
    },
    reward: {
      en: 'Cherry Pie recipe pinned + 1 pie ready',
      ru: 'Рецепт «Вишнёвый пирог» закреплён + 1 готовый пирог',
    },
    lines: [
      {
        npc: 'npc_ricky_ray',
        text: {
          en: 'Ey-yo, county! WSUN here — Ricky Ray. Tomorrow’s the FA-A-AIR, kids! The new kid at Sunnyside is already firing up the grill. Cook plenty — the guests are coming in droves!',
          ru: 'Э-ге-гей, округ! На волне WSUN — Рикки Рэй. Завтра ЯР-МАР-КА, детки! Новенький на Sunnyside уже коптит гриль. Наготовь побольше — гости валом повалят!',
        },
      },
      {
        npc: 'npc_nana_opal',
        text: {
          en: 'Here’s one more family recipe — cherry pie. No fair without a pie, and this one’s our crown jewel. Bake one — you’ll need it tomorrow.',
          ru: 'Держи-ка ещё один семейный рецепт — вишнёвый пирог. На ярмарке без пирога никуда, а этот у нас коронный. Испеки один — завтра пригодится.',
        },
      },
    ],
  },
  {
    id: 't_day_6',
    day: 6,
    title: { en: 'Fair', ru: 'Ярмарка' },
    lead: 'npc_maybelle',
    target: 'shift',
    timerSec: 60,
    miniFair: true,
    action: { en: 'Serve the pie', ru: 'Подать пирог' },
    learn: {
      en: 'Two layers of the fair: passive stall + active shift; contests.',
      ru: 'Два слоя ярмарки: пассивный прилавок + активная смена; конкурсы.',
    },
    reward: {
      en: 'Stall takings + guaranteed first Blue Ribbon',
      ru: 'Выручка прилавка + гарантированная первая Синяя лента',
    },
    lines: [
      {
        npc: 'npc_maybelle',
        text: {
          en: 'Now then, let’s see this pie… Mm! For a first try — that’s a Blue Ribbon, child. Don’t get a big head, but know: we judge taste, not quantity. Hang the ribbon where folks can see it.',
          ru: 'Ну-с, посмотрим, что за пирог… М-м! Для первого раза — это Синяя лента, дитя. Не заносись, но знай: судим мы вкус, а не количество. Повесь ленту на видное место.',
        },
      },
      {
        npc: 'npc_nana_opal',
        text: {
          en: 'A Blue Ribbon! Oh, I got all teary. First of many, sugar.',
          ru: 'Синяя лента! Ох, я прямо прослезилась. Первая из многих, солнышко.',
        },
      },
    ],
  },
  {
    id: 't_day_7',
    day: 7,
    title: { en: 'Finale', ru: 'Финал' },
    lead: 'npc_grimsby',
    target: 'weekly_check',
    action: { en: 'Claim the Weekly Check', ru: 'Забрать Итог недели' },
    learn: {
      en: 'The weekly rhythm as a cycle; Route Pass as seasonal progress.',
      ru: 'Недельный ритм как цикл; Route Pass как сезонный прогресс.',
    },
    reward: {
      en: 'Weekly check $100 + T1 seeds + Route Pass tick + Cracker-Jack',
      ru: 'Недельный чек $100 + семена T1 + тик Route Pass + Cracker-Jack',
    },
    lines: [
      {
        npc: 'npc_grimsby',
        text: {
          en: 'Hmph. Glutton Grimsby never praises rookies. But your soup… tolerable. I’ll be back — and then, child, cook DOUBLE. Ha-ha-ha!',
          ru: 'Хм. Обжора Гримсби никогда не хвалит новичков. Но твой суп… терпимо. Я вернусь — и тогда, дитя, готовь ВДВОЕ. Ха-ха-ха!',
        },
      },
      {
        npc: 'npc_nana_opal',
        text: {
          en: 'That’s the whole week, sugar. Now you know the rhythm. Ahead — the real town, live neighbors. I’ll write. Go on, light up that sign. Y’all come back now!',
          ru: 'Вот и вся неделька, солнышко. Теперь ты знаешь ритм. Дальше — настоящий город, живые соседи. Я буду писать. Иди, зажигай вывеску. Y’all come back now!',
        },
      },
    ],
  },
] as const

/** NPC-гости финальной мини-ярмарки (§3.3 t_day_6, камео жителей). */
export const MINI_FAIR_GUESTS: readonly NpcKey[] = [
  'npc_maybelle',
  'npc_trucker_cody',
  'npc_mayor_calloway',
  'npc_ricky_ray',
] as const
