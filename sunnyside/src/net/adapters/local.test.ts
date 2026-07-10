/**
 * local.test.ts — интеграционные тесты LocalBackendAdapter.
 *
 * Гоняются в environment:'node' (vite.config) — без IndexedDB, persist падает на
 * in-memory стор (persist.ts). Инъектируем управляемые часы, чтобы «перематывать»
 * игровое время и наблюдать рост грядок/крафта, пассивную ярмарку, ботов ивента и
 * недельный rollover без реального ожидания.
 */

import { describe, it, expect } from 'vitest'
import {
  weekStartOfIndex, weekNumberOf, WEEK_MS, HOUR_MS, DAY_MS, FAIR_OPEN_OFFSET,
  FAIR_CLOSE_OFFSET, COOP_DEADLINE_OFFSET,
} from '@/engine/clock'
import type { FarmSnapshot, InventorySnapshot, Plot, TownProject } from '@/types'
import { createLocalAdapter } from './local'
import { createWorldStore } from '../local/persist'
import { productInfo } from '../local/catalog'

/** Управляемые часы: тест двигает `t`. */
function makeClock(start: number): { now(): number; advance(ms: number): void } {
  let t = start
  return { now: () => t, advance: (ms: number) => { t += ms } }
}

/** Понедельник 01:00 UTC недели `week` — начало игровой недели + запас до rollover. */
const WEEK = 3000
const MONDAY_0100 = weekStartOfIndex(WEEK) + HOUR_MS

function newAdapter(clock: { now(): number }) {
  return createLocalAdapter({ clock, persist: 'memory', userId: 'test-player', townId: 'test-town' })
}

async function unwrap<T>(p: Promise<{ ok: true; data: T } | { ok: false; error: { code: string; message: string } }>): Promise<T> {
  const r = await p
  if (!r.ok) throw new Error(`RPC failed: ${r.error.code} — ${r.error.message}`)
  return r.data
}

describe('LocalBackendAdapter — жизненный цикл и чтения', () => {
  it('init + ensureSession + getServerTime', async () => {
    const clock = makeClock(MONDAY_0100)
    const a = newAdapter(clock)
    await a.init()
    const session = await unwrap(a.ensureSession())
    expect(session.userId).toBe('test-player')
    const st = await unwrap(a.getServerTime())
    expect(st.serverNow).toBe(MONDAY_0100)
  })

  it('стартовая ферма: 6 грядок, стартовые постройки и станки', async () => {
    const a = newAdapter(makeClock(MONDAY_0100))
    const farm: FarmSnapshot = await unwrap(a.getFarm())
    expect(farm.plots).toHaveLength(6)
    expect(farm.buildings.bld_kitchen?.level).toBe(1)
    expect(farm.machines.some((m) => m.key === 'mch_oven')).toBe(true)
  })

  it('календарь: weekIndex = weekNumberOf(now)', async () => {
    const a = newAdapter(makeClock(MONDAY_0100))
    const cal = await unwrap(a.getCalendar())
    expect(cal.weekIndex).toBe(weekNumberOf(MONDAY_0100))
    expect(cal.phase).toBe('mon_plan')
  })
})

describe('LocalBackendAdapter — полный цикл посади→вырасти→скрафть→продай→ивент→rollover', () => {
  it('прогоняет весь недельный цикл', async () => {
    const clock = makeClock(MONDAY_0100)
    const a = newAdapter(clock)
    await a.init()

    // 1. ПОСАДИ: 5 грядок пшеницы.
    const farm0 = await unwrap(a.getFarm())
    const walletStart = await unwrap(a.getWallet())
    for (let slot = 0; slot < 5; slot++) {
      const res = await unwrap(a.sow({ slot, seedKey: 'seed_wheat' }))
      expect(res.plot.state).toBe('growing')
    }
    // Списалась стоимость семян (анти-чит: сервер валидирует стоимость).
    const walletAfterSow = await unwrap(a.getWallet())
    expect(walletAfterSow.bucks).toBeLessThan(walletStart.bucks)

    // 2. ВЫРАСТИ: пшеница 12 мин; поливаем и перематываем время.
    const growing = (await unwrap(a.getFarm())).plots.filter((p: Plot) => p.state === 'growing')
    await unwrap(a.water({ plotIds: growing.map((p) => p.id) }))
    clock.advance(13 * 60 * 1000)

    const harvest = await unwrap(a.harvest({ plotIds: growing.map((p) => p.id) }))
    expect(harvest.items.reduce((s, i) => s + i.qty, 0)).toBe(5)
    const invAfterHarvest: InventorySnapshot = await unwrap(a.getInventory())
    expect(invAfterHarvest.items.crop_wheat).toBe(5)

    // 3. СКРАФТЬ: муку на печи, партия 2 (входы пшеница×4).
    const oven = farm0.machines.find((m) => m.key === 'mch_oven')!
    const started = await unwrap(a.craftStart({ machineId: oven.id, recipeKey: 'rcp_ingr_flour', batch: 2 }))
    expect(started.job.state).toBe('cooking')
    // Вход списан немедленно (осталась 1 пшеница).
    expect((await unwrap(a.getInventory())).items.crop_wheat).toBe(1)

    // Забрать раньше времени нельзя (таймер-дедлайн).
    const early = await a.craftCollect({ jobIds: [started.job.id] })
    expect(early.ok).toBe(false)

    clock.advance(301 * 1000)
    const collected = await unwrap(a.craftCollect({ jobIds: [started.job.id] }))
    expect(collected.items[0]?.key).toBe('ingr_flour')
    expect(collected.items[0]?.qty).toBe(2)

    // 4. ПРОДАЙ НА ЯРМАРКЕ: выставляем муку, пассивная продажа за окно.
    await unwrap(a.fairOpen({ stallId: 'x' }))
    await unwrap(a.fairList({ stallId: 'x', lots: [{ itemKey: 'ingr_flour', qty: 1, quality: 1, price: 10 }] }))
    const bucksBeforeFair = (await unwrap(a.getWallet())).bucks
    clock.advance(HOUR_MS) // пассив продаёт ≥1 ед.
    const bucksAfterFair = (await unwrap(a.getWallet())).bucks
    expect(bucksAfterFair).toBeGreaterThan(bucksBeforeFair)

    // 5. ВКЛАД В ИВЕНТ: жертвуем оставшуюся муку в котёл (донат ценнее).
    const evBefore = await unwrap(a.getEvent())
    const contrib = await unwrap(a.eventContribute({ itemKey: 'ingr_flour', qty: 1, channel: 'donate' }))
    expect(contrib.personalFp).toBeGreaterThan(0)
    const evAfter = await unwrap(a.getEvent())
    expect(evAfter.personalFp).toBeGreaterThanOrEqual(evBefore.personalFp + 1)

    // 6. ROLLOVER НЕДЕЛИ: перематываем в следующую неделю.
    const calBefore = await unwrap(a.getCalendar())
    clock.advance(WEEK_MS)
    const calAfter = await unwrap(a.getCalendar())
    expect(calAfter.weekIndex).toBe(calBefore.weekIndex + 1)
    // Личный вклад ивента обнулился на новой неделе.
    const evNewWeek = await unwrap(a.getEvent())
    expect(evNewWeek.personalFp).toBe(0)
    expect(evNewWeek.meter.eventKey).toBeDefined()
  })
})

describe('LocalBackendAdapter — граница закрытия окна ярмарки (TEST-2)', () => {
  it('фиксирует контракт: processFairSales продаёт по прошедшим часам и НЕ смотрит FAIR_CLOSE_OFFSET — ' +
    'пассивные продажи продолжаются в промежутке Вс 12:00→23:59 (закрытие окна ≠ остановка продаж, ' +
    'останавливает только rollover). Регресс-тест текущего поведения (fairOpen/fairList тоже не проверяют фазу).', async () => {
    const store = createWorldStore('memory')
    const clock = makeClock(MONDAY_0100)
    const a1 = createLocalAdapter({ clock, store, userId: 'p-fair-window', townId: 't-fair-window' })
    await a1.init()

    // Большой сток, чтобы лот не истощился раньше границы (сток — не предмет теста).
    const world = await store.load('p-fair-window')
    world!.stacks.push({ key: 'crop_wheat', qty: 100_000, quality: 1, itemClass: productInfo('crop_wheat').itemClass })
    await store.save(world!)

    const a2 = createLocalAdapter({ clock, store, userId: 'p-fair-window', townId: 't-fair-window' })
    await unwrap(a2.fairOpen({ stallId: 'x' }))
    await unwrap(a2.fairList({ stallId: 'x', lots: [{ itemKey: 'crop_wheat', qty: 100_000, quality: 1, price: 10 }] }))

    // Продвигаем РОВНО до границы закрытия окна ярмарки (Сб 00:00 + FAIR_WINDOW = Вс 12:00).
    const closeAt = weekStartOfIndex(WEEK) + FAIR_CLOSE_OFFSET
    clock.advance(closeAt - clock.now())
    const atClose = await unwrap(a2.getFairStall())
    const remainingAtClose = atClose.lots[0]!.remaining

    // Ещё 2 часа ПОСЛЕ закрытия окна (всё ещё та же неделя, до rollover Вс 23:59:59) —
    // текущий код продолжает продавать: остаток УМЕНЬШАЕТСЯ, а не замирает на границе.
    clock.advance(2 * HOUR_MS)
    const pastClose = await unwrap(a2.getFairStall())
    expect(pastClose.lots[0]!.remaining).toBeLessThan(remainingAtClose)
  })
})

describe('LocalBackendAdapter — многонедельный catch-up rollover (TEST-1)', () => {
  it('перематывает часы на 3 недели ЗА РАЗ — catchUpRollover прогоняет все 3 resetWeek атомарно', async () => {
    const clock = makeClock(MONDAY_0100)
    const a = newAdapter(clock)
    await a.init()

    const calBefore = await unwrap(a.getCalendar())
    const progBefore = await unwrap(a.getProgression())
    // `progBefore.routePass` — ЖИВАЯ ссылка на `world.routePass` (progressionSnapshot не
    // клонирует, как и townSnapshot в migrationVote-тесте) — копируем число ДО мутации,
    // иначе после catchUpRollover `progBefore` «задним числом» отразит уже новый tier.
    const tierBefore = progBefore.routePass.tier

    // Копим состояние ТЕКУЩЕЙ недели, которое rollover обязан смести/обнулить:
    // незакрытый лот на ярмарке + личный вклад в ивент.
    await unwrap(a.sow({ slot: 0, seedKey: 'seed_wheat' }))
    await unwrap(a.sow({ slot: 1, seedKey: 'seed_wheat' }))
    clock.advance(13 * 60 * 1000)
    const growing = (await unwrap(a.getFarm())).plots.filter((p: Plot) => p.state === 'growing')
    await unwrap(a.harvest({ plotIds: growing.map((p) => p.id) }))
    await unwrap(a.fairOpen({ stallId: 'x' }))
    await unwrap(a.fairList({ stallId: 'x', lots: [{ itemKey: 'crop_wheat', qty: 1, quality: 1, price: 5 }] }))
    const contrib = await unwrap(a.eventContribute({ itemKey: 'crop_wheat', qty: 1, channel: 'donate' }))
    expect(contrib.personalFp).toBeGreaterThan(0)

    // Перематываем разом 3 недели вперёд (а не по одной — воспроизводит Vacation/долгий afk).
    clock.advance(3 * WEEK_MS)
    const calAfter = await unwrap(a.getCalendar())
    const progAfter = await unwrap(a.getProgression())
    const townAfter = await unwrap(a.getTown())
    const contestsAfter = await unwrap(a.getContests())
    const fairAfter = await unwrap(a.getFairStall())
    const eventAfter = await unwrap(a.getEvent())

    // (a) weekIndex продвинулся ровно на 3, а не на 1 (catch-up не «залипает» на первой неделе).
    expect(calAfter.weekIndex).toBe(calBefore.weekIndex + 3)

    // (b) Route Pass тикнул ровно 3 раза (по одному тику за смётённую неделю, кап 100).
    expect(progAfter.routePass.tier).toBe(Math.min(tierBefore + 3, 100))
    expect(progAfter.routePass.xp).toBe(0)

    // (c) Кооп-заказы/конкурсы/ивент принадлежат ФИНАЛЬНОЙ неделе catch-up (seed/дедлайн
    // соответствуют calAfter.weekIndex, а не промежуточным week+1/week+2).
    const finalWeekStart = weekStartOfIndex(calAfter.weekIndex)
    for (const order of townAfter.coopOrders) {
      expect(order.id).toContain(`-coop-${calAfter.weekIndex}-`)
      expect(order.deadlineAt).toBe(finalWeekStart + COOP_DEADLINE_OFFSET)
    }
    for (const contest of contestsAfter) {
      expect(contest.id).toContain(`-contest-${calAfter.weekIndex}-`)
      expect(contest.entryWindow.closesAt).toBe(finalWeekStart + FAIR_OPEN_OFFSET)
    }
    expect(eventAfter.meter.window.opensAt).toBe(finalWeekStart)

    // (d) Нет остаточных fair-лотов/личного вклада ивента промежуточных недель — обнулены.
    expect(fairAfter.lots).toHaveLength(0)
    expect(fairAfter.openedAt).toBeUndefined()
    expect(eventAfter.personalFp).toBe(0)
  })
})

describe('LocalBackendAdapter — симулированный город (25 NPC, кооп, ивент-боты)', () => {
  it('ростер города — 25 соседей и стриты', async () => {
    const a = newAdapter(makeClock(MONDAY_0100))
    const town = await unwrap(a.getTown())
    expect(town.roster).toHaveLength(25)
    expect(town.streets.length).toBeGreaterThanOrEqual(2)
    expect(town.coopOrders.length).toBeGreaterThan(0)
  })

  it('боты наполняют котёл ивента со временем', async () => {
    const clock = makeClock(MONDAY_0100)
    const a = newAdapter(clock)
    const ev0 = await unwrap(a.getEvent())
    clock.advance(6 * HOUR_MS)
    const ev1 = await unwrap(a.getEvent())
    expect(ev1.meter.meterFp).toBeGreaterThan(ev0.meter.meterFp)
    expect(ev1.meter.goalFp).toBeGreaterThan(0)
  })

  it('боты закрывают требования кооп-заказа со временем', async () => {
    const clock = makeClock(MONDAY_0100)
    const a = newAdapter(clock)
    const before = await unwrap(a.getTown())
    const filledBefore = before.coopOrders[0]!.requirements.reduce((s, r) => s + r.filled, 0)
    clock.advance(12 * HOUR_MS)
    const after = await unwrap(a.getTown())
    const filledAfter = after.coopOrders[0]!.requirements.reduce((s, r) => s + r.filled, 0)
    expect(filledAfter).toBeGreaterThan(filledBefore)
  })
})

describe('LocalBackendAdapter — персист (эмуляция IndexedDB через общий стор)', () => {
  it('состояние мира переживает пересоздание адаптера', async () => {
    const store = createWorldStore('memory')
    const clock = makeClock(MONDAY_0100)
    const a1 = createLocalAdapter({ clock, store, userId: 'p', townId: 't' })
    await a1.init()
    await unwrap(a1.sow({ slot: 2, seedKey: 'seed_tomato' }))
    const walletA1 = await unwrap(a1.getWallet())

    // Новый инстанс адаптера поверх ТОГО ЖЕ стора — читает сохранённый мир.
    const a2 = createLocalAdapter({ clock, store, userId: 'p', townId: 't' })
    const farm = await unwrap(a2.getFarm())
    expect(farm.plots.find((p) => p.slot === 2)?.state).toBe('growing')
    const walletA2 = await unwrap(a2.getWallet())
    expect(walletA2.bucks).toBe(walletA1.bucks)
  })
})

describe('LocalBackendAdapter — событийный канал (subscribe эмитит по своим тикам, S4)', () => {
  it('почта доставлена → канал inbox', async () => {
    const clock = makeClock(MONDAY_0100)
    const a = newAdapter(clock)
    const events: string[] = []
    a.subscribe('inbox', (payload) => events.push(String((payload as { message: string }).message)))
    await unwrap(a.mailOrder({ itemKey: 'egg' }))
    clock.advance(8 * HOUR_MS + 60_000)
    await a.getFarm() // читает снапшот → sync() → emitDomainEvents
    expect(events.some((m) => /посылк/i.test(m))).toBe(true)
  })

  it('грузовик вернулся → канал inbox', async () => {
    const clock = makeClock(MONDAY_0100)
    const a = newAdapter(clock)
    const events: string[] = []
    a.subscribe('inbox', (payload) => events.push(String((payload as { message: string }).message)))
    await unwrap(a.expeditionStart({ stateKey: 'st_illinois', routeSlot: 0 }))
    clock.advance(24 * HOUR_MS) // с запасом, дольше любой длительности рейса тира 1
    await a.getFarm()
    expect(events.some((m) => /грузовик/i.test(m))).toBe(true)
  })

  it('ярмарка открылась (фаза недели → sat_fair) → канал fair', async () => {
    const clock = makeClock(MONDAY_0100)
    const a = newAdapter(clock)
    const events: string[] = []
    a.subscribe('fair', (payload) => events.push(String((payload as { message: string }).message)))
    await a.getCalendar() // первая гидрация — фиксирует стартовую фазу, не событие
    clock.advance(FAIR_OPEN_OFFSET - HOUR_MS + 60_000) // пересекаем Сб 00:00
    await a.getCalendar()
    expect(events.some((m) => /ярмарка/i.test(m))).toBe(true)
  })

  it('кооп-заказ выполнен (боты закрывают требования) → канал street_board', async () => {
    const clock = makeClock(MONDAY_0100)
    const a = newAdapter(clock)
    const events: string[] = []
    a.subscribe('street_board', (payload) => events.push(String((payload as { message: string }).message)))
    await a.getTown() // baseline
    clock.advance(20 * HOUR_MS) // до дедлайна Чт 23:59, ботам хватает мощности закрыть заказы
    await a.getTown()
    expect(events.some((m) => /кооп-заказ/i.test(m))).toBe(true)
  })

  it('сосед полил грядки → реальный эффект (wateredUntil) + канал street_board', async () => {
    const clock = makeClock(MONDAY_0100)
    const a = newAdapter(clock)
    const events: string[] = []
    a.subscribe('street_board', (payload) => events.push(String((payload as { message: string }).message)))
    await a.getFarm() // baseline визита соседа
    await unwrap(a.sow({ slot: 0, seedKey: 'seed_wheat' }))
    clock.advance(2 * HOUR_MS + 60_000)
    const farm = await unwrap(a.getFarm())
    expect(events.some((m) => /полил/i.test(m))).toBe(true)
    const plot = farm.plots.find((p) => p.slot === 0)!
    expect(plot.wateredUntil).toBeGreaterThanOrEqual(clock.now())
  })
})

describe('LocalBackendAdapter — анти-чит валидация', () => {
  it('sow в занятую грядку — conflict', async () => {
    const a = newAdapter(makeClock(MONDAY_0100))
    await unwrap(a.sow({ slot: 0, seedKey: 'seed_tomato' }))
    const again = await a.sow({ slot: 0, seedKey: 'seed_tomato' })
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.error.code).toBe('conflict')
  })

  it('craft без входов — insufficient_stock', async () => {
    const a = newAdapter(makeClock(MONDAY_0100))
    const farm = await unwrap(a.getFarm())
    const oven = farm.machines.find((m) => m.key === 'mch_oven')!
    const res = await a.craftStart({ machineId: oven.id, recipeKey: 'rcp_ingr_flour', batch: 1 })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('insufficient_stock')
  })

  it('продажа отсутствующего стока — insufficient_stock', async () => {
    const a = newAdapter(makeClock(MONDAY_0100))
    const res = await a.sellToMarket({ itemKey: 'crop_tomato', qty: 10 })
    expect(res.ok).toBe(false)
  })

  it('кооп-вклад после дедлайна — window_closed', async () => {
    const clock = makeClock(MONDAY_0100)
    const a = newAdapter(clock)
    const town = await unwrap(a.getTown())
    const order = town.coopOrders[0]!
    // Дедлайн Чт 23:59; перематываем в Пт (в ту же неделю — до rollover Вс 23:59).
    clock.advance(4 * 24 * HOUR_MS)
    const res = await a.coopContribute({ orderId: order.id, itemKey: order.requirements[0]!.itemKey, qty: 1 })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('window_closed')
  })

  // TEST-3: граница `now() > order.deadlineAt` в coopContribute — half-open интервал:
  // ровно `deadlineAt` ещё успех, `deadlineAt + 1` уже window_closed. Ловит ошибку ⇄ (`>` вместо `>=`).
  it('кооп-вклад РОВНО на deadlineAt — ещё успех (полуоткрытый интервал)', async () => {
    const store = createWorldStore('memory')
    const clock = makeClock(MONDAY_0100)
    const a1 = createLocalAdapter({ clock, store, userId: 'p-coop-eq', townId: 't-coop-eq' })
    await a1.init()
    const town = await unwrap(a1.getTown())
    const order = town.coopOrders[0]!
    const itemKey = order.requirements[0]!.itemKey

    // Инжектируем сток + раздуваем qty требования напрямую в сторе (сток и объём — не предмет
    // теста, только граница дедлайна): иначе боты (simulateTown) сами закроют требование за
    // ~4 игровых дня до дедлайна, и ответ будет `conflict` вместо проверки границы окна.
    const world = await store.load('p-coop-eq')
    const req = world!.coopOrders.find((o) => o.id === order.id)!.requirements[0]!
    req.qty = 1_000_000
    world!.stacks.push({ key: itemKey, qty: 5, quality: 1, itemClass: productInfo(itemKey).itemClass })
    await store.save(world!)

    clock.advance(order.deadlineAt - clock.now())
    expect(clock.now()).toBe(order.deadlineAt)
    const a2 = createLocalAdapter({ clock, store, userId: 'p-coop-eq', townId: 't-coop-eq' })
    const res = await a2.coopContribute({ orderId: order.id, itemKey, qty: 1 })
    expect(res.ok).toBe(true)
  })

  it('кооп-вклад на deadlineAt + 1мс — window_closed', async () => {
    const store = createWorldStore('memory')
    const clock = makeClock(MONDAY_0100)
    const a1 = createLocalAdapter({ clock, store, userId: 'p-coop-gt', townId: 't-coop-gt' })
    await a1.init()
    const town = await unwrap(a1.getTown())
    const order = town.coopOrders[0]!
    const itemKey = order.requirements[0]!.itemKey

    const world = await store.load('p-coop-gt')
    const req = world!.coopOrders.find((o) => o.id === order.id)!.requirements[0]!
    req.qty = 1_000_000
    world!.stacks.push({ key: itemKey, qty: 5, quality: 1, itemClass: productInfo(itemKey).itemClass })
    await store.save(world!)

    clock.advance(order.deadlineAt - clock.now() + 1)
    const a2 = createLocalAdapter({ clock, store, userId: 'p-coop-gt', townId: 't-coop-gt' })
    const res = await a2.coopContribute({ orderId: order.id, itemKey, qty: 1 })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('window_closed')
  })
})

describe('LocalBackendAdapter — переезды (12-migration)', () => {
  it('movingVan.cooldownUntil стартует как createdAt + 3 дня (мин. срок в городе, §3.1.2)', async () => {
    const a = newAdapter(makeClock(MONDAY_0100))
    const town = await unwrap(a.getTown())
    expect(town.movingVan.cooldownUntil).toBe(MONDAY_0100 + 3 * DAY_MS)
  })

  it('migrateFarm до истечения кулдауна — not_ready', async () => {
    const a = newAdapter(makeClock(MONDAY_0100))
    const res = await a.migrateFarm({ targetTown: 'town-elsewhere' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('not_ready')
  })

  it('migrateFarm в свой же город — invalid_payload', async () => {
    const clock = makeClock(MONDAY_0100)
    const a = newAdapter(clock)
    await a.init() // мир создаётся сейчас (createdAt=MONDAY_0100) — до перемотки кулдауна
    clock.advance(3 * DAY_MS + 1)
    const res = await a.migrateFarm({ targetTown: 'test-town' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('invalid_payload')
  })

  it('migrateFarm после кулдауна: конвертирует вклад в тикеты (курс 50:1, §4.4), сдвигает кулдаун на 14 дней', async () => {
    const store = createWorldStore('memory')
    const clock = makeClock(MONDAY_0100)
    const a1 = createLocalAdapter({ clock, store, userId: 'p-move', townId: 't-move' })
    await a1.init()
    clock.advance(3 * DAY_MS + 1)

    const world = await store.load('p-move')
    expect(world).not.toBeNull()
    world!.projects.tp_drive_in = {
      version: 1, key: 'tp_drive_in', progress: 100, goal: 1000, built: false, myContribution: 4200,
    } satisfies TownProject
    await store.save(world!)

    // Свежий инстанс поверх того же стора подхватывает изменённый мир (как в тесте персиста).
    const a2 = createLocalAdapter({ clock, store, userId: 'p-move', townId: 't-move' })
    const res = await unwrap(a2.migrateFarm({ targetTown: 'town-elsewhere' }))
    expect(res.ticketsAwarded).toBe(84) // floor(4200/50)
    expect(res.convertedBucks).toBe(4200)
    expect(res.carryoverBucks).toBe(0)
    expect(res.cooldownUntil).toBe(clock.now() + 14 * DAY_MS)

    const wallet = await unwrap(a2.getWallet())
    expect(wallet.tickets).toBe(84)
    const town = await unwrap(a2.getTown())
    expect(town.movingVan.cooldownUntil).toBe(clock.now() + 14 * DAY_MS)
    expect(town.projects.tp_drive_in?.myContribution).toBe(0) // не «в натуре» — обнулён, конвертирован
  })

  it('migrateFarm: конверсия капается в 🎟500/переезд, остаток — carryover (не сгорает, §3.4)', async () => {
    const store = createWorldStore('memory')
    const clock = makeClock(MONDAY_0100)
    const a1 = createLocalAdapter({ clock, store, userId: 'p-cap', townId: 't-cap' })
    await a1.init()
    clock.advance(3 * DAY_MS + 1)

    const world = await store.load('p-cap')
    world!.projects.tp_drive_in = {
      version: 1, key: 'tp_drive_in', progress: 100, goal: 100_000, built: false, myContribution: 30_000,
    } satisfies TownProject
    await store.save(world!)

    const a2 = createLocalAdapter({ clock, store, userId: 'p-cap', townId: 't-cap' })
    const res = await unwrap(a2.migrateFarm({ targetTown: 'town-elsewhere' }))
    expect(res.ticketsAwarded).toBe(500)
    expect(res.convertedBucks).toBe(25_000)
    expect(res.carryoverBucks).toBe(5_000)
  })

  it('listTowns: непустой и детерминированный список (стабилен между вызовами)', async () => {
    const a = newAdapter(makeClock(MONDAY_0100))
    const list1 = await unwrap(a.listTowns())
    const list2 = await unwrap(a.listTowns())
    expect(list1.length).toBeGreaterThan(0)
    expect(list1).toEqual(list2)
  })

  it('migrationPropose(street_caravan): кворум = 60% состава Стрита-инициатора (§3.2.1), боты только из этого стрита', async () => {
    const clock = makeClock(MONDAY_0100)
    const a = newAdapter(clock)
    const town = await unwrap(a.getTown())
    const street = town.streets[0]!
    const { proposalId } = await unwrap(
      a.migrationPropose({ kind: 'street_caravan', targetTown: 'town-elsewhere', streetId: street.id }),
    )
    const after = await unwrap(a.getTown())
    const prop = after.migrations.find((m) => m.id === proposalId)!
    expect(prop.streetId).toBe(street.id)
    expect(prop.tally.quorum).toBe(Math.max(1, Math.ceil((street.memberCount + 1) * 0.6)))
    expect(prop.tally.yes + prop.tally.no).toBeLessThanOrEqual(street.memberCount)
  })

  it('migrationVote: голос игрока учитывается один раз — повторный голос conflict', async () => {
    const clock = makeClock(MONDAY_0100)
    const a = newAdapter(clock)
    const town = await unwrap(a.getTown())
    const street = town.streets[0]!
    const { proposalId } = await unwrap(
      a.migrationPropose({ kind: 'street_caravan', targetTown: 'town-elsewhere', streetId: street.id }),
    )
    const before = (await unwrap(a.getTown())).migrations.find((m) => m.id === proposalId)!
    // Копируем число до мутации — `before` ссылается на ЖИВОЙ объект тэлли (townSnapshot не
    // клонирует), иначе после `migrationVote` он «задним числом» отразит уже новый tally.
    const beforeYes = before.tally.yes
    const voted = await unwrap(a.migrationVote({ proposalId, vote: 'yes' }))
    expect(voted.yes).toBe(beforeYes + 1)

    const again = await a.migrationVote({ proposalId, vote: 'yes' })
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.error.code).toBe('conflict')
  })

  it('migrationVote(town_merge): кворум набран → включает Grand Reopening (§3.3.4, local-упрощение)', async () => {
    const store = createWorldStore('memory')
    const clock = makeClock(MONDAY_0100)
    const a1 = createLocalAdapter({ clock, store, userId: 'p-merge', townId: 't-merge' })
    await a1.init()
    const { proposalId } = await unwrap(
      a1.migrationPropose({ kind: 'town_merge', targetTown: 'town-elsewhere' }),
    )

    // Форсируем тэлли к порогу кворума детерминированно (не полагаемся на случайных ботов) —
    // тот же приём, что и в тесте персиста: мутируем мир напрямую через общий стор.
    const world = await store.load('p-merge')
    const prop = world!.migrations.find((m) => m.id === proposalId)!
    prop.tally = { yes: prop.tally.quorum - 1, no: 0, quorum: prop.tally.quorum }
    await store.save(world!)

    const a2 = createLocalAdapter({ clock, store, userId: 'p-merge', townId: 't-merge' })
    expect((await unwrap(a2.getTown())).grandReopening?.active).toBe(false)
    await unwrap(a2.migrationVote({ proposalId, vote: 'yes' }))

    const after = await unwrap(a2.getTown())
    expect(after.grandReopening?.active).toBe(true)
    expect(after.grandReopening?.endsAt).toBe(clock.now() + 7 * DAY_MS)
  })

  it('Grand Reopening истекает автоматически по endsAt (§4.3 — 7 дней)', async () => {
    const store = createWorldStore('memory')
    const clock = makeClock(MONDAY_0100)
    const a1 = createLocalAdapter({ clock, store, userId: 'p-gr', townId: 't-gr' })
    await a1.init()
    const { proposalId } = await unwrap(a1.migrationPropose({ kind: 'town_merge', targetTown: 'town-elsewhere' }))
    const world = await store.load('p-gr')
    const prop = world!.migrations.find((m) => m.id === proposalId)!
    prop.tally = { yes: prop.tally.quorum, no: 0, quorum: prop.tally.quorum }
    await store.save(world!)

    const a2 = createLocalAdapter({ clock, store, userId: 'p-gr', townId: 't-gr' })
    await unwrap(a2.migrationVote({ proposalId, vote: 'no' }))
    expect((await unwrap(a2.getTown())).grandReopening?.active).toBe(true)

    clock.advance(7 * DAY_MS + 1)
    expect((await unwrap(a2.getTown())).grandReopening?.active).toBe(false)
  })
})
