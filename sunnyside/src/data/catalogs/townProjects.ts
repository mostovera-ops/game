/**
 * catalogs/townProjects.ts — контент 6 Town Projects (11-town §3.8, канон §3.7).
 *
 * Источник цифр: `docs/specs/11-town.md` §3.8.2 (реестр проектов) + §4.5 (сводка
 * стоимости/баффа). Обе таблицы согласованы (Σ этапов §3.8.2 == Σ §4.5).
 *
 * ВАЖНО про `goalResources`: 11-town §3.8.1 говорит, что каждый этап требует
 * "$ + ресурсы (стройматериалы-крафт: доски, гвозди, неон-трубки...)", но
 * КОНКРЕТНЫЕ количества ресурсов на этап спека НЕ даёт (только $-суммы —
 * §3.8.2/§4.5). Раздел 7 спеки прямо помечает баффы/стоимости как "гипотезы,
 * требуют баланс-спеки" (11-town §8 п.3). Числа `goalBucks` ниже — из спеки
 * дословно; `goalResources` намеренно ОПУСТИМ (поле опционально в схеме) —
 * не выдумываем количества стройматериалов, которых нет в источнике. Когда
 * баланс-спека дополнит §3.8 конкретными qty на этап — дозаполнить это поле.
 *
 * `reward` на этап (BilingualSchema, обязателен по TownProjectStageSchema):
 * для этапов 1–2 — визуальная веха стройки (леса → каркас), для финального
 * этапа — постоянный бафф города дословно из §3.8.2/§4.5. Мэр `npc_mayor_calloway`
 * ведёт проект; разовый 🎟-дроп по доле вклада и «плашка донора» — общие для
 * всех проектов (§3.8.1), в тексте награды последнего этапа не дублируются.
 *
 * Порядок разблокировки (гейт 0→0→1→1→2→2, §3.8.2 хвост) — это игровая
 * последовательность открытия, а не поле контент-схемы `TownProjectDefSchema`
 * (там нет `unlockGate`); зафиксировано только в комментариях ниже для будущего
 * потребителя (town-система, не в скоупе этого каталога).
 */

import type { TownProjectDef } from '../schema'

export const townProjects: TownProjectDef[] = [
  // Гейт 0 (открыт с начала) — «инфраструктура», дешевле.
  {
    key: 'tp_radio_wsun',
    name: { en: 'Radio Station WSUN', ru: 'Радиостанция WSUN' },
    stages: [
      {
        stage: 1,
        goalBucks: 25_000,
        reward: {
          en: 'Groundbreaking: the radio tower footing is poured on the edge of town.',
          ru: 'Закладка фундамента: у края города заливают основание радиовышки.',
        },
      },
      {
        stage: 2,
        goalBucks: 50_000,
        reward: {
          en: "The tower's frame rises — wires and lamps are being strung.",
          ru: 'Каркас вышки поднялся — тянут провода и лампы.',
        },
      },
      {
        stage: 3,
        goalBucks: 100_000,
        reward: {
          en: 'WSUN goes live: a blinking beacon on the town skyline. Permanent buff — Demand Board forecast one day early (Sunday evening) + 1 extra Daily Special slot; boosts Ricky Ray.',
          ru: 'WSUN выходит в эфир: мигающий огонь на горизонте города. Постоянный бафф — анонс Demand Board на день раньше (воскресенье вечером) + доп. слот Daily Special; усиливает Рикки Рэя.',
        },
      },
    ],
  },
  {
    key: 'tp_bandstand',
    name: { en: 'Town Bandstand', ru: 'Городская эстрада' },
    stages: [
      {
        stage: 1,
        goalBucks: 20_000,
        reward: {
          en: 'A wooden platform is staked out on the square.',
          ru: 'На площади размечена деревянная площадка.',
        },
      },
      {
        stage: 2,
        goalBucks: 45_000,
        reward: {
          en: 'The bandstand takes shape — timber and fresh paint go up.',
          ru: 'Эстрада обретает форму — дерево и свежая краска.',
        },
      },
      {
        stage: 3,
        goalBucks: 90_000,
        reward: {
          en: 'Grand opening with a live band on the square. Permanent buff — +5% to every street’s Potluck buff; live music plays on weekends.',
          ru: 'Открытие с живым оркестром на площади. Постоянный бафф — +5% ко всем potluck-баффам стритов; живая музыка по выходным.',
        },
      },
    ],
  },
  // Гейт 1 (после ≥1 завершённого проекта) — престиж.
  {
    key: 'tp_drive_in',
    name: { en: 'Drive-in Theater', ru: 'Автокино' },
    stages: [
      {
        stage: 1,
        goalBucks: 30_000,
        reward: {
          en: 'The lot is graded and the screen scaffolding goes up along the shoulder.',
          ru: 'Расчищена площадка, у обочины поднимаются леса под экран.',
        },
      },
      {
        stage: 2,
        goalBucks: 60_000,
        reward: {
          en: 'The screen frame stands and rows for cars are marked out.',
          ru: 'Каркас экрана готов, размечены ряды для машин.',
        },
      },
      {
        stage: 3,
        goalBucks: 120_000,
        reward: {
          en: 'Opening night — the screen lights up at dusk. Permanent buff — +10% tips locally in the 18:00–24:00 window; unlocks the ev_drivein_night season.',
          ru: 'Премьера — экран загорается в сумерках. Постоянный бафф — +10% чаевых локально в окне 18:00–24:00; открывает сезонку ev_drivein_night.',
        },
      },
    ],
  },
  {
    key: 'tp_ferris_wheel',
    name: { en: 'Ferris Wheel', ru: 'Колесо обозрения' },
    stages: [
      {
        stage: 1,
        goalBucks: 40_000,
        reward: {
          en: 'The foundation ring is set in the center of the fairground.',
          ru: 'В центре ярмарочной площади заложено кольцо-основание.',
        },
      },
      {
        stage: 2,
        goalBucks: 80_000,
        reward: {
          en: 'Steel spokes and neon trim go up around the hub.',
          ru: 'Вокруг ступицы поднимаются стальные спицы и неоновая окантовка.',
        },
      },
      {
        stage: 3,
        goalBucks: 160_000,
        reward: {
          en: 'The wheel turns for the first time, neon glowing at the heart of the square. Permanent buff — +5% fair visitors town-wide; new ui_photo_mode photo spot.',
          ru: 'Колесо совершает первый оборот, неон светится в центре площади. Постоянный бафф — +5% посетителей ярмарки по всему городу; новая фото-точка ui_photo_mode.',
        },
      },
    ],
  },
  // Гейт 2 (после ≥2 завершённых проектов) — масштаб зрелого города.
  {
    key: 'tp_water_tower',
    name: { en: 'Water Tower', ru: 'Водонапорная башня' },
    stages: [
      {
        stage: 1,
        goalBucks: 35_000,
        reward: {
          en: 'Piles are driven for the tower legs on the horizon.',
          ru: 'На горизонте забиты сваи под опоры башни.',
        },
      },
      {
        stage: 2,
        goalBucks: 70_000,
        reward: {
          en: 'The steel legs and plumbing rise toward the tank.',
          ru: 'Стальные опоры и трубы поднимаются к баку.',
        },
      },
      {
        stage: 3,
        goalBucks: 140_000,
        reward: {
          en: "The town logo is painted on the tank against the skyline. Permanent buff — raises the town's storage cap and grants everyone +1 free Water Help/day; +10% to the silo buff for Harvest-tier streets.",
          ru: 'На баке на фоне неба нарисован логотип города. Постоянный бафф — повышает лимит склада города и даёт всем +1 бесплатный Water Help/день; +10% к силос-баффу Harvest-стритов.',
        },
      },
    ],
  },
  {
    key: 'tp_welcome_arch',
    name: { en: 'Highway Welcome Arch', ru: 'Приветственная арка шоссе' },
    stages: [
      {
        stage: 1,
        goalBucks: 30_000,
        reward: {
          en: 'Concrete footings are poured at the town entrance off Route 66.',
          ru: 'У въезда в город с шоссе Route 66 заливают бетонные опоры.',
        },
      },
      {
        stage: 2,
        goalBucks: 55_000,
        reward: {
          en: 'The arch frame spans the road, neon tubing being fitted.',
          ru: 'Каркас арки перекрывает дорогу, монтируются неоновые трубки.',
        },
      },
      {
        stage: 3,
        goalBucks: 110_000,
        reward: {
          en: 'The neon arch lights up over the highway entrance. Permanent buff — +25% "welcome bonus" for every street that relocates in; unlocks 2 extra free streets for new arrivals.',
          ru: 'Неоновая арка загорается над въездом с шоссе. Постоянный бафф — +25% «награда за гостеприимство» за каждый приехавший стрит; открывает 2 доп. свободные улицы под заселение.',
        },
      },
    ],
  },
]
