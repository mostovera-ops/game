/**
 * supabase.cloud.test.ts — GATED интеграционный сьют против РЕАЛЬНОГО проекта
 * Supabase (`pvautnecztynbnzrrdra`, farm-truck-game). Проверяет C4-контракт
 * SupabaseBackendAdapter «одна истина, один шлюз» вживую, не на моках.
 *
 * ЗАПУСК: только когда `SUPABASE_TEST=1` И заданы ключи проекта в env
 *   (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY).
 * В обычном `vitest run` (без env) весь блок SKIP — сеть/секреты не нужны.
 * Секреты НИКОГДА не хардкодятся: читаются из env (значения — в .env.sunnyside,
 * который в .gitignore). Требует Node 22+ (нативный WebSocket для supabase-js).
 *
 * ЧТО ПОКРЫВАЕТ (T1-цикл + RLS):
 *  1) анонимный вход через адаптер (ensureSession → auth.signInAnonymously);
 *  2) T1-петля горячего пути: sow → (dev-timeskip) → harvest → craft_start →
 *     (timeskip) → craft_collect → sell_to_market → wallet_get. Таймеры (5–15 мин)
 *     ускоряются service_role-функцией `test_advance_timers` (миграция 0009) через
 *     сервисный SQL-канал (supabase-js под secret-ключом) — клиенту она недоступна;
 *  3) RLS: под анонимной (authenticated) ролью нельзя читать чужое (кросс-город)
 *     и нельзя писать в игровые таблицы напрямую; без сессии (роль anon) — deny-all;
 *     свои строки читаются.
 *
 * Мир (город/конфиг/рынок) и «онбординг» (player+farm+plots+machine+recipe+seed)
 * поднимаются service_role-каналом — это серверная точка, недоступная клиенту
 * (в проде — Edge/матчмейкинг). Клиентский путь идёт СТРОГО через адаптер/RPC.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdapter, createMutationQueueStore } from './supabase'
import type { BackendAdapter } from '@/engine/contracts'
import type { RpcResult } from '@/types'

const RUN = process.env.SUPABASE_TEST === '1'
const URL = process.env.SUPABASE_URL ?? ''
const PUB = process.env.SUPABASE_PUBLISHABLE_KEY ?? ''
const SECRET = process.env.SUPABASE_SECRET_KEY ?? ''

/** Активная версия конфига (детерминированный id сида 0007). */
const CONFIG_VERSION = '00000000-0000-0000-0000-0000000c0f19'
const WEEK_INDEX = 900001 // изолированный «тестовый» индекс недели (не пересекается с cron)

function unwrap<T>(r: RpcResult<T>): T {
  if (!r.ok) throw new Error(`rpc ${r.error.code}: ${r.error.message}`)
  return r.data
}

describe.runIf(RUN)('supabase cloud adapter — T1 loop + RLS (gated)', () => {
  let svc: SupabaseClient
  let adapter: BackendAdapter
  let anonB: SupabaseClient
  let rawAnon: SupabaseClient

  const runId = Math.random().toString(36).slice(2, 8)
  let uidA = ''
  let uidB = ''
  let townA = ''
  let townB = ''
  let farmA = ''
  let farmB = ''
  let machineA = ''
  const plotIds: string[] = []

  beforeAll(async () => {
    if (!URL || !PUB || !SECRET) {
      throw new Error('SUPABASE_TEST=1, но нет SUPABASE_URL/PUBLISHABLE_KEY/SECRET_KEY в env')
    }
    svc = createClient(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } })

    // ── Клиент A: адаптер под тестом (анонимный вход) ──
    adapter = createSupabaseAdapter({
      url: URL,
      publishableKey: PUB,
      queueStore: createMutationQueueStore('memory'),
    })
    const sess = unwrap(await adapter.ensureSession())
    uidA = sess.userId

    // ── Клиент B: второй анонимный игрок (для RLS-проверок из чужой сессии) ──
    anonB = createClient(URL, PUB, { auth: { persistSession: false } })
    const bRes = await anonB.auth.signInAnonymously()
    if (bRes.error || !bRes.data.user) throw new Error('anonB sign-in failed: ' + bRes.error?.message)
    uidB = bRes.data.user.id

    // ── Клиент без сессии (роль anon) ──
    rawAnon = createClient(URL, PUB, { auth: { persistSession: false } })

    // ── Мир: два города (разные шарды) + рынок города A ──
    const tA = await svc.from('towns').insert({
      name: `ZZ_CLOUDTEST_${runId}_A`, status: 'open',
      active_config_version_id: CONFIG_VERSION, current_week_index: WEEK_INDEX,
    }).select('id').single()
    if (tA.error) throw tA.error
    townA = tA.data.id as string

    const tB = await svc.from('towns').insert({
      name: `ZZ_CLOUDTEST_${runId}_B`, status: 'open',
      active_config_version_id: CONFIG_VERSION, current_week_index: WEEK_INDEX,
    }).select('id').single()
    if (tB.error) throw tB.error
    townB = tB.data.id as string

    const mw = await svc.from('market_weeks').insert({
      town_id: townA, week_index: WEEK_INDEX,
      demand: { produce: 1.2, grain: 1.0, dairy: 1.0 },
    })
    if (mw.error) throw mw.error

    // ── Онбординг игрока A (город A): player + farm + 3 грядки + станок + рецепт + семена ──
    const pA = await svc.from('players').insert({
      id: uidA, handle: `cloudA_${runId}`, town_id: townA, created_week: WEEK_INDEX,
    })
    if (pA.error) throw pA.error
    const fA = await svc.from('farms').insert({
      player_id: uidA, town_id: townA, config_version_id: CONFIG_VERSION,
    }).select('id').single()
    if (fA.error) throw fA.error
    farmA = fA.data.id as string

    const plotsIns = await svc.from('plots').insert(
      [0, 1, 2].map((slot_index) => ({ farm_id: farmA, slot_index, state: 'empty' })),
    )
    if (plotsIns.error) throw plotsIns.error

    const mach = await svc.from('machines').insert({
      farm_id: farmA, machine_key: 'stove', slots: 2, level: 1,
    }).select('id').single()
    if (mach.error) throw mach.error
    machineA = mach.data.id as string

    const rec = await svc.from('recipes').insert({
      player_id: uidA, recipe_key: 'recipe_tomato_soup', source: 'base',
    })
    if (rec.error) throw rec.error

    const seed = await svc.from('inventory').insert({
      farm_id: farmA, item_key: 'seed_tomato', item_class: 'seed', qty: 3, quality: 0,
    })
    if (seed.error) throw seed.error

    // ── Игрок B (город B): своя приватная строка склада (для RLS) ──
    const pB = await svc.from('players').insert({
      id: uidB, handle: `cloudB_${runId}`, town_id: townB, created_week: WEEK_INDEX,
    })
    if (pB.error) throw pB.error
    const fB = await svc.from('farms').insert({
      player_id: uidB, town_id: townB, config_version_id: CONFIG_VERSION,
    }).select('id').single()
    if (fB.error) throw fB.error
    farmB = fB.data.id as string
    const invB = await svc.from('inventory').insert({
      farm_id: farmB, item_key: 'secret_item', item_class: 'crop', qty: 7, quality: 0,
    })
    if (invB.error) throw invB.error
  }, 60_000)

  afterAll(async () => {
    // Каскад от players/towns снимает почти всё; чистим и auth-пользователей.
    try { if (uidA || uidB) await svc.from('players').delete().in('id', [uidA, uidB].filter(Boolean)) } catch { /* noop */ }
    try { if (townA || townB) await svc.from('towns').delete().in('id', [townA, townB].filter(Boolean)) } catch { /* noop */ }
    try { if (uidA) await svc.from('audit_logs').delete().eq('actor_id', uidA) } catch { /* noop */ }
    try { if (uidA) await svc.auth.admin.deleteUser(uidA) } catch { /* noop */ }
    try { if (uidB) await svc.auth.admin.deleteUser(uidB) } catch { /* noop */ }
    try { await adapter.dispose() } catch { /* noop */ }
  }, 60_000)

  it('1) анонимная сессия установлена адаптером', () => {
    expect(uidA).toMatch(/^[0-9a-f-]{36}$/)
    expect(uidB).toMatch(/^[0-9a-f-]{36}$/)
    expect(uidA).not.toBe(uidB)
  })

  it('2) sow: сажает tomato на 3 грядки (серверный таймер 8 мин)', async () => {
    for (let slot = 0; slot < 3; slot++) {
      const d = unwrap(await adapter.sow({ slot, seedKey: 'seed_tomato' })) as unknown as {
        plot: string; ready_min: number
      }
      expect(d.plot).toMatch(/^[0-9a-f-]{36}$/)
      expect(d.ready_min).toBe(8)
      plotIds.push(d.plot)
    }
    // Семена списаны (склад пуст по seed_tomato).
    const inv = await svc.from('inventory').select('qty').eq('farm_id', farmA).eq('item_key', 'seed_tomato').single()
    expect(inv.data?.qty).toBe(0)
  })

  it('3) dev-timeskip: грядки созревают (service_role only)', async () => {
    const adv = await svc.rpc('test_advance_timers', { p_farm: farmA, p_minutes: 12 })
    expect(adv.error).toBeNull()
    expect((adv.data as { plots: number }).plots).toBeGreaterThanOrEqual(3)
    const ready = await svc.from('plots').select('state').eq('farm_id', farmA).eq('state', 'ready')
    expect(ready.data?.length).toBe(3)
  })

  it('3b) timeskip недоступен клиенту (authenticated) — deny', async () => {
    const bad = await anonB.rpc('test_advance_timers', { p_farm: farmB, p_minutes: 12 })
    expect(bad.error).not.toBeNull()
  })

  it('4) harvest: собирает 3 tomato', async () => {
    const d = unwrap(await adapter.harvest({ plotIds })) as unknown as {
      items: { key: string; qty: number; quality: number }[]
    }
    expect(d.items.length).toBe(3)
    expect(d.items.every((i) => i.key === 'tomato')).toBe(true)
    const inv = await svc.from('inventory').select('qty,quality').eq('farm_id', farmA).eq('item_key', 'tomato')
    const total = (inv.data ?? []).reduce((s: number, r: { qty: number }) => s + r.qty, 0)
    expect(total).toBe(3)
  })

  it('5) craft_start: списывает 2 tomato (any-quality fix), заводит партию', async () => {
    const d = unwrap(await adapter.craftStart({ machineId: machineA, recipeKey: 'recipe_tomato_soup', batch: 1 })) as unknown as {
      job: string; ready_min: number
    }
    expect(d.job).toMatch(/^[0-9a-f-]{36}$/)
    expect(d.ready_min).toBe(15)
    // Ключевая проверка фикса ДЫРА-1: собранный tomato (quality 1) списан рецептом (quality 0).
    const inv = await svc.from('inventory').select('qty').eq('farm_id', farmA).eq('item_key', 'tomato')
    const total = (inv.data ?? []).reduce((s: number, r: { qty: number }) => s + r.qty, 0)
    expect(total).toBe(1)
    ;(globalThis as Record<string, unknown>).__jobA = d.job
  })

  it('6) craft_collect: после timeskip забирает tomato_soup', async () => {
    const adv = await svc.rpc('test_advance_timers', { p_farm: farmA, p_minutes: 20 })
    expect(adv.error).toBeNull()
    const jobA = (globalThis as Record<string, unknown>).__jobA as string
    const d = unwrap(await adapter.craftCollect({ jobIds: [jobA] })) as unknown as {
      items: { key: string }[]; mastery_delta: number
    }
    expect(d.items.some((i) => i.key === 'tomato_soup')).toBe(true)
    const inv = await svc.from('inventory').select('qty').eq('farm_id', farmA).eq('item_key', 'tomato_soup').single()
    expect(inv.data?.qty).toBe(1)
  })

  it('7) sell_to_market: продаёт tomato + tomato_soup, кошелёк растёт', async () => {
    const rTomato = unwrap(await adapter.sellToMarket({ itemKey: 'tomato', qty: 1 })) as unknown as { revenue: number }
    expect(rTomato.revenue).toBe(3) // base 3 × demand produce 1.2 = 3.6 → floor 3
    const rSoup = unwrap(await adapter.sellToMarket({ itemKey: 'tomato_soup', qty: 1 })) as unknown as { revenue: number }
    expect(rSoup.revenue).toBeGreaterThanOrEqual(1)

    const wallet = unwrap(await adapter.getWallet()) as unknown as Record<string, number>
    expect(wallet.bucks).toBe(rTomato.revenue + rSoup.revenue)
    expect(wallet.bucks).toBeGreaterThan(0)
  })

  // ── RLS ──────────────────────────────────────────────────────────────────
  it('8) RLS: свою строку склада читать МОЖНО', async () => {
    const own = await anonB.from('inventory').select('item_key,qty').eq('farm_id', farmB)
    expect(own.error).toBeNull()
    expect((own.data ?? []).some((r: { item_key: string }) => r.item_key === 'secret_item')).toBe(true)
  })

  it('9) RLS: чужой склад/игрока (другой город) читать НЕЛЬЗЯ', async () => {
    const foreignInv = await anonB.from('inventory').select('item_key').eq('farm_id', farmA)
    expect(foreignInv.error).toBeNull()
    expect(foreignInv.data?.length).toBe(0)

    const foreignPlayer = await anonB.from('players').select('id').eq('id', uidA)
    expect(foreignPlayer.data?.length).toBe(0)
  })

  it('10) RLS: прямая запись клиента ЗАПРЕЩЕНА (нет write-политики)', async () => {
    const hack = await anonB.from('inventory').insert({
      farm_id: farmB, item_key: 'hack_dupe', item_class: 'crop', qty: 999, quality: 0,
    })
    expect(hack.error).not.toBeNull()
    // Убеждаемся, что строка не появилась (проверяем сервисным каналом).
    const check = await svc.from('inventory').select('id').eq('farm_id', farmB).eq('item_key', 'hack_dupe')
    expect(check.data?.length).toBe(0)
  })

  it('11) RLS: без сессии (роль anon) — deny-all на публичных таблицах', async () => {
    const noSession = await rawAnon.from('towns').select('id').eq('id', townA)
    expect(noSession.data?.length ?? 0).toBe(0)
  })
})
