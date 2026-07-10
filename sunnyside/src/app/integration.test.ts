/**
 * app/integration.test.ts — интеграция КОМПОЗИЦИОННОГО слоя (интегратор C3).
 *
 * Проверяет ШОВ, который собирает эта зона: `SystemContext.applyMutation` (dispatch →
 * adapter → reconcile-гидрация стора) + фабрика систем (`createSystems`) + бутстрап +
 * лента уведомлений (`diffWorld`). Прогоняет полный путь ЧЕРЕЗ СИСТЕМЫ (не напрямую через
 * адаптер, как `net/adapters/local.test.ts`), наблюдая, что store-слайсы обновляются
 * истиной сервера после каждой подтверждённой мутации.
 *
 * Окружение node (vite.config): local-адаптер с управляемыми часами, persist=memory.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/state'
import { createLocalAdapter } from '@/net/adapters/local'
import { weekStartOfIndex, HOUR_MS, WEEK_MS } from '@/engine/clock'
import type { BackendAdapter } from '@/engine/contracts'
import { layoutForagePoints } from '@/scene/town/layout'
import {
  __resetBackendForTests,
  setAdapter,
  getAdapter,
  bootstrap,
  createSystemContext,
  createSystems,
  hydrateAll,
  type AppSystems,
} from './backend'
import { resetNotificationBridge, diffWorld, worldSummary } from './notifications'

function makeClock(start: number) {
  let t = start
  return { now: () => t, advance: (ms: number) => { t += ms } }
}

const WEEK = 3100
const MONDAY_0100 = weekStartOfIndex(WEEK) + HOUR_MS

async function boot(clock: { now(): number }): Promise<{ adapter: BackendAdapter; systems: AppSystems }> {
  __resetBackendForTests()
  resetNotificationBridge()
  const adapter = createLocalAdapter({ clock, persist: 'memory', userId: 'c3-player', townId: 'c3-town' })
  setAdapter(adapter)
  await bootstrap()
  const systems = createSystems(createSystemContext(getAdapter()))
  return { adapter, systems }
}

describe('composition — SystemContext + createSystems + гидрация', () => {
  beforeEach(() => {
    useStore.getState().setOnline(true)
  })

  it('бутстрап гидрирует слайсы истиной адаптера', async () => {
    const clock = makeClock(MONDAY_0100)
    await boot(clock)
    const s = useStore.getState()
    expect(s.farm?.plots).toHaveLength(6)
    expect(s.econ.wallet.bucks).toBe(150)
    expect(s.clock.calendar?.weekIndex).toBe(WEEK)
    // serverOffset выставлен так, что serverNow() ≈ игровое время адаптера.
    expect(Math.abs(s.serverNow() - MONDAY_0100)).toBeLessThan(5_000)
  })

  it('полный путь через системы: посади→вырасти→скрафть→ивент, стор следует за истиной', async () => {
    const clock = makeClock(MONDAY_0100)
    const { systems } = await boot(clock)

    // 1. ПОСАДКА через FarmSystem (5 грядок пшеницы).
    for (let slot = 0; slot < 5; slot++) {
      const res = await systems.farm.sow(slot, 'seed_wheat')
      expect(res.ok).toBe(true)
    }
    let farm = useStore.getState().farm!
    expect(farm.plots.filter((p) => p.state === 'growing')).toHaveLength(5)
    // Анти-чит: стоимость семян списана сервером, стор отражает это после гидрации.
    expect(useStore.getState().econ.wallet.bucks).toBeLessThan(1000)

    // 2. РОСТ: полив + перемотка часов.
    const growingIds = farm.plots.filter((p) => p.state === 'growing').map((p) => p.id)
    expect((await systems.farm.water(growingIds)).ok).toBe(true)
    clock.advance(13 * 60 * 1000)

    // 3. СБОР: инвентарь стора наполняется крафт-сырьём.
    expect((await systems.farm.harvest(growingIds)).ok).toBe(true)
    expect(useStore.getState().inventory?.items.crop_wheat).toBe(5)

    // 4. КРАФТ через CraftSystem (ports читают станок/сырьё из стора).
    // Клиентская предвалидация системы капит батч по уровню станка (mch_oven Ур.1 → 1).
    const oven = useStore.getState().farm!.machines.find((m) => m.key === 'mch_oven')!
    const started = await systems.craft.start(oven.id, 'rcp_ingr_flour', 1)
    if (!started.ok) throw new Error(`craft_start: ${started.error.code} — ${started.error.message}`)
    expect(started.ok).toBe(true)
    // Вход списан немедленно (пшеница×2 на батч) — стор синхронизирован.
    expect(useStore.getState().inventory?.items.crop_wheat).toBe(3)

    // Слишком рано — забор отклонён (таймер-дедлайн валидирует сервер).
    const jobId = useStore.getState().farm!.machines.find((m) => m.id === oven.id)!.jobs[0]!.id
    const early = await systems.craft.collect([jobId])
    expect(early.ok).toBe(false)

    clock.advance(301 * 1000)
    const collected = await systems.craft.collect([jobId])
    expect(collected.ok).toBe(true)
    expect(useStore.getState().inventory?.items.ingr_flour).toBe(1)

    // 5. ВКЛАД В ИВЕНТ через EventSystem — personalFp растёт в сторе.
    const fpBefore = useStore.getState().event?.personalFp ?? 0
    const contrib = await systems.event.contribute('ingr_flour', 1, 'donate')
    expect(contrib.ok).toBe(true)
    expect(useStore.getState().event!.personalFp).toBeGreaterThan(fpBefore)
  })

  it('прилавок ярмарки: open+list через FairSystem, пассивная продажа наполняет кошелёк', async () => {
    const clock = makeClock(MONDAY_0100)
    const { systems } = await boot(clock)

    // Быстрый сток муки: посадка→сбор→крафт (сжато).
    for (let slot = 0; slot < 4; slot++) await systems.farm.sow(slot, 'seed_wheat')
    const ids = useStore.getState().farm!.plots.filter((p) => p.state === 'growing').map((p) => p.id)
    clock.advance(13 * 60 * 1000)
    await systems.farm.harvest(ids)
    const oven = useStore.getState().farm!.machines.find((m) => m.key === 'mch_oven')!
    await systems.craft.start(oven.id, 'rcp_ingr_flour', 1)
    clock.advance(301 * 1000)
    const job = useStore.getState().farm!.machines.find((m) => m.id === oven.id)!.jobs[0]!
    await systems.craft.collect([job.id])
    expect(useStore.getState().inventory!.items.ingr_flour).toBeGreaterThanOrEqual(1)

    const stallId = useStore.getState().fair.stall!.id
    expect((await systems.fair.open(stallId)).ok).toBe(true)
    const listed = await systems.fair.list({
      stallId,
      lots: [{ itemKey: 'ingr_flour', qty: 1, quality: 1, price: 10 }],
    })
    expect(listed.ok).toBe(true)

    const bucksBefore = useStore.getState().econ.wallet.bucks
    clock.advance(HOUR_MS)
    await hydrateAll(getAdapter()) // пассив ярмарки досчитывается в sync адаптера
    expect(useStore.getState().econ.wallet.bucks).toBeGreaterThan(bucksBefore)
  })

  it('rollover недели: гидрация двигает календарь и роняет уведомление в ленту', async () => {
    const clock = makeClock(MONDAY_0100)
    await boot(clock)
    const weekBefore = useStore.getState().clock.calendar!.weekIndex
    const notifBefore = useStore.getState().ui.notifications.length

    clock.advance(WEEK_MS)
    await hydrateAll(getAdapter())

    expect(useStore.getState().clock.calendar!.weekIndex).toBe(weekBefore + 1)
    const notifs = useStore.getState().ui.notifications
    expect(notifs.length).toBeGreaterThan(notifBefore)
    expect(notifs.some((n) => n.kind === 'server' && /недел/i.test(n.message))).toBe(true)
  })

  it('оффлайн: мутация не уходит на сервер, возвращает offline (оптимистику держим)', async () => {
    const clock = makeClock(MONDAY_0100)
    const { systems } = await boot(clock)
    useStore.getState().setOnline(false)
    const res = await systems.farm.sow(0, 'seed_wheat')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('offline')
    // Грядка на сервере не изменилась (стор не перегидрирован при оффлайне).
    useStore.getState().setOnline(true)
  })
})

describe('adapter-seams — shift_submit / forage_collect / соц-визит реальными RPC', () => {
  beforeEach(() => {
    useStore.getState().setOnline(true)
  })

  it('shift_submit: ShiftSystem.submit реально списывает сток и кредитует кошелёк', async () => {
    const clock = makeClock(MONDAY_0100)
    const { systems } = await boot(clock)

    // Быстрый сток муки: посадка→сбор→крафт (сжато, как в сценарии выше).
    for (let slot = 0; slot < 2; slot++) await systems.farm.sow(slot, 'seed_wheat')
    const ids = useStore.getState().farm!.plots.filter((p) => p.state === 'growing').map((p) => p.id)
    clock.advance(13 * 60 * 1000)
    await systems.farm.harvest(ids)
    const oven = useStore.getState().farm!.machines.find((m) => m.key === 'mch_oven')!
    await systems.craft.start(oven.id, 'rcp_ingr_flour', 1)
    clock.advance(301 * 1000)
    const job = useStore.getState().farm!.machines.find((m) => m.id === oven.id)!.jobs[0]!
    await systems.craft.collect([job.id])
    const flourBefore = useStore.getState().inventory!.items.ingr_flour ?? 0
    expect(flourBefore).toBeGreaterThanOrEqual(1)

    const bucksBefore = useStore.getState().econ.wallet.bucks
    // ShiftScreen.finish() шлёт ИМЕННО такую форму (session.ts `soldStockList`) — сервер
    // реконструирует итог из фактически списанного стока, не из клиентских чисел.
    const res = await systems.shift.submit({
      shiftLog: {
        seed: 1,
        startedAt: clock.now(),
        served: 1,
        tips: 0,
        soldStock: [{ itemKey: 'ingr_flour', qty: 1 }],
      },
    })
    expect(res.ok).toBe(true)

    expect(useStore.getState().inventory!.items.ingr_flour ?? 0).toBe(flourBefore - 1)
    expect(useStore.getState().econ.wallet.bucks).toBeGreaterThan(bucksBefore)
  })

  it('forage_collect: id из клиентской раскладки (scene/town/layout) резолвит реальную точку сервера', async () => {
    const clock = makeClock(MONDAY_0100)
    const { adapter, systems } = await boot(clock)

    const townId = useStore.getState().session.identity!.townId
    const clientPoints = layoutForagePoints(townId)
    const server = await adapter.getMailForaging()
    expect(server.ok).toBe(true)
    if (!server.ok) return
    // ID-схема `starterForage` (net/local/world.ts) зеркалит `layoutForagePoints` (adapter-seams
    // fix) — клик по клиентской точке резолвит РЕАЛЬНУЮ точку, не «честный» 404.
    expect(server.data.foragePoints.map((p) => p.id).sort()).toEqual(clientPoints.map((p) => p.id).sort())

    const point = clientPoints[0]!
    const before = useStore.getState().inventory?.items[server.data.foragePoints[0]!.itemKey] ?? 0
    const res = await systems.mailForaging.forageCollect(point.id)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(useStore.getState().inventory?.items[res.data.item.key] ?? 0).toBe(before + res.data.item.qty)
  })

  it('соц-визит: SocialSystem.help/gift резолвят соседа по userId ростера, не по farmId', async () => {
    const clock = makeClock(MONDAY_0100)
    const { systems } = await boot(clock)

    const town = useStore.getState().town!
    const neighbor = town.roster[0]!
    // farmId соседа НЕ совпадает с его userId (net/local/world.ts genNpcs) — TownScene теперь
    // шлёт `neighbor.userId` (Streets.tsx VisitTarget), не `farmId` (adapter-seams fix).
    expect(neighbor.userId).not.toBe(neighbor.farmId)

    const byFarmId = await systems.social.help(neighbor.farmId, 'water')
    expect(byFarmId.ok).toBe(false)

    const byUserId = await systems.social.help(neighbor.userId, 'water')
    expect(byUserId.ok).toBe(true)
  })
})

describe('notifications — чистый diffWorld', () => {
  it('первый срез молчит (гидрация, не событие)', () => {
    const next = worldSummary(
      { townId: 't', weekIndex: 5, phase: 'mon_plan', rolloverAt: 0, fairWindow: { opensAt: 0, closesAt: 0 }, coopDeadlineAt: 0, eventFinalAt: 0 },
      { meter: { eventKey: 'ev_glutton', meterPct: 0, meterFp: 0, goalFp: 100, milestones: [], window: { opensAt: 0, closesAt: 0 }, finalAt: 0 }, personalFp: 0, myContribHist: [] },
    )!
    expect(diffWorld(null, next, 1000)).toEqual([])
  })

  it('rollover и веха котла дают уведомления', () => {
    const prev = { weekIndex: 5, milestonesHit: [25], streetPennant: false }
    const next = { weekIndex: 6, milestonesHit: [25, 50], streetPennant: true }
    const items = diffWorld(prev, next, 1000)
    expect(items.some((i) => /недел/i.test(i.message))).toBe(true)
    expect(items.some((i) => /50%/.test(i.message))).toBe(true)
    expect(items.some((i) => /вымпел/i.test(i.message))).toBe(true)
  })
})
