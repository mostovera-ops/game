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

// ════════════════════════════════════════════════════════════════════════════
// БЛОК 2 — Бутстрап нового anon-игрока + полный набор get_*-снапшотов через АДАПТЕР
// (0011 srv-core). Проверяет: ленивый bootstrap из read-снапшота (player+farm+набор)
// и что адаптер НЕ получает not_found ни на одном чтении T1-гидрации.
// ════════════════════════════════════════════════════════════════════════════

/** Детерминированный id seed-города Sunnyside (public.ensure_seed_world, 0011). */
const SEED_TOWN = '00000000-0000-0000-0000-00005eed0001'

describe.runIf(RUN)('supabase cloud — bootstrap нового игрока + get_*-снапшоты (gated)', () => {
  let svc: SupabaseClient
  let adapter: BackendAdapter
  let uid = ''

  beforeAll(async () => {
    if (!URL || !PUB || !SECRET) {
      throw new Error('SUPABASE_TEST=1, но нет SUPABASE_URL/PUBLISHABLE_KEY/SECRET_KEY в env')
    }
    svc = createClient(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } })
    adapter = createSupabaseAdapter({
      url: URL, publishableKey: PUB, queueStore: createMutationQueueStore('memory'),
    })
    uid = unwrap(await adapter.ensureSession()).userId
  }, 60_000)

  afterAll(async () => {
    try { if (uid) await svc.from('players').delete().eq('id', uid) } catch { /* noop */ }
    try { if (uid) await svc.from('audit_logs').delete().eq('actor_id', uid) } catch { /* noop */ }
    try { if (uid) await svc.auth.admin.deleteUser(uid) } catch { /* noop */ }
    try { await adapter.dispose() } catch { /* noop */ }
  }, 60_000)

  it('B1) getFarm лениво создаёт игрока в seed-городе (6 грядок, ферма)', async () => {
    const farm = unwrap(await adapter.getFarm()) as unknown as {
      farmId: string; plots: unknown[]; buildings: Record<string, unknown>
    }
    expect(farm.farmId).toMatch(/^[0-9a-f-]{36}$/)
    expect(farm.plots.length).toBe(6)               // onboarding §3.1: 6 грядок
    expect(Object.keys(farm.buildings).length).toBeGreaterThanOrEqual(8)

    // Игрок реально создан bootstrap-ом и приписан к seed-городу Sunnyside.
    const p = await svc.from('players').select('town_id').eq('id', uid).single()
    expect(p.data?.town_id).toBe(SEED_TOWN)
  })

  it('B2) стартовый кошелёк — 1000◈ / 40◉ (приветственный подарок через леджер)', async () => {
    const w = unwrap(await adapter.getWallet()) as unknown as Record<string, number>
    expect(w.bucks).toBe(1000)
    expect(w.dimes).toBe(40)
  })

  it('B3) полная T1-гидрация: ВСЕ get_*-снапшоты ok (адаптер не получает not_found)', async () => {
    // Каждый метод чтения BackendAdapter, на который замаплен READ_RPC (0011).
    const reads: [string, () => Promise<{ ok: boolean; error?: { code: string; message: string } }>][] = [
      ['getServerTime', () => adapter.getServerTime()],
      ['getWallet', () => adapter.getWallet()],
      ['getFarm', () => adapter.getFarm()],
      ['getInventory', () => adapter.getInventory()],
      ['getCalendar', () => adapter.getCalendar()],
      ['getDemandBoard', () => adapter.getDemandBoard()],
      ['getTown', () => adapter.getTown()],
      ['getFairStall', () => adapter.getFairStall()],
      ['getContests', () => adapter.getContests()],
      ['getEvent', () => adapter.getEvent()],
      ['getProgression', () => adapter.getProgression()],
      ['getCollections', () => adapter.getCollections()],
      ['getMailForaging', () => adapter.getMailForaging()],
    ]
    for (const [name, fn] of reads) {
      const r = await fn()
      const detail = r.ok ? '' : `${r.error?.code}: ${r.error?.message}`
      expect(r.ok, `${name} → ${detail}`).toBe(true)
      if (!r.ok) expect(r.error?.code).not.toBe('not_found')
    }
  })

  it('B4) get_inventory отражает стартовые семена T1 (seed_tomato×6, seed_lettuce×4)', async () => {
    const inv = unwrap(await adapter.getInventory()) as unknown as { items: Record<string, number> }
    expect(inv.items.seed_tomato).toBe(6)
    expect(inv.items.seed_lettuce).toBe(4)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// БЛОК 3 — Мультиплеер: два anon-игрока в ОДНОМ городе (seed Sunnyside).
// Проверяет социальный слой «одна истина, один шлюз» вживую (RPC под JWT игрока):
//   чат доходит до соседа (RLS town-канала), помощь соседу — обе стороны,
//   подарок, вклад в кооп-заказ и в ивент — агрегируются между игроками.
// Игроки логинятся анонимно и бутстрапятся ленивым read-RPC (get_farm → ensure_bootstrap).
// ════════════════════════════════════════════════════════════════════════════

describe.runIf(RUN)('supabase cloud — мультиплеер: два anon в одном городе (gated)', () => {
  let svc: SupabaseClient
  let A: SupabaseClient
  let B: SupabaseClient
  let uidA = ''
  let uidB = ''
  let townId = ''
  let week = 0
  let orderId = ''
  const tag = Math.random().toString(36).slice(2, 8)

  beforeAll(async () => {
    if (!URL || !PUB || !SECRET) {
      throw new Error('SUPABASE_TEST=1, но нет SUPABASE_URL/PUBLISHABLE_KEY/SECRET_KEY в env')
    }
    svc = createClient(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } })
    A = createClient(URL, PUB, { auth: { persistSession: false } })
    B = createClient(URL, PUB, { auth: { persistSession: false } })

    const ra = await A.auth.signInAnonymously()
    if (ra.error || !ra.data.user) throw new Error('anon A sign-in failed: ' + ra.error?.message)
    uidA = ra.data.user.id
    const rb = await B.auth.signInAnonymously()
    if (rb.error || !rb.data.user) throw new Error('anon B sign-in failed: ' + rb.error?.message)
    uidB = rb.data.user.id

    // Бутстрап обоих ленивым read-RPC (ensure_bootstrap внутри get_farm) — оба в seed-город.
    const fa = await A.rpc('get_farm'); if (fa.error) throw fa.error
    const fb = await B.rpc('get_farm'); if (fb.error) throw fb.error

    const pa = await svc.from('players').select('town_id').eq('id', uidA).single()
    if (pa.error) throw pa.error
    townId = pa.data!.town_id as string
    const t = await svc.from('towns').select('current_week_index').eq('id', townId).single()
    if (t.error) throw t.error
    week = t.data!.current_week_index as number

    // Робастность к продвижению недели cron-ом: гарантируем event_week для ТЕКУЩЕЙ недели
    // (не сбрасывая существующий meter — измеряем дельту), и открытый кооп-заказ.
    const ew = await svc.from('event_weeks').select('id').eq('town_id', townId).eq('week_index', week).maybeSingle()
    if (!ew.data) {
      const ins = await svc.from('event_weeks').insert({
        town_id: townId, week_index: week, theme_key: 'ev_mp_test', goal_100: 1_000_000, meter_fp: 0, settled: false,
      })
      if (ins.error) throw ins.error
    }
    const ord = await svc.from('orders').insert({
      town_id: townId, week_index: week, requirements: [{ item_key: 'seed_tomato', qty: 20 }],
      deadline: new Date(Date.now() + 3_600_000).toISOString(), state: 'open', reward: { label: 'mp_test' },
    }).select('id').single()
    if (ord.error) throw ord.error
    orderId = ord.data!.id as string
  }, 90_000)

  afterAll(async () => {
    try { if (orderId) await svc.from('orders').delete().eq('id', orderId) } catch { /* noop */ }
    try { await svc.from('chat_messages').delete().eq('channel', 'town:' + townId).in('author_id', [uidA, uidB]) } catch { /* noop */ }
    try { if (uidA || uidB) await svc.from('players').delete().in('id', [uidA, uidB].filter(Boolean)) } catch { /* noop */ }
    try { await svc.from('audit_logs').delete().in('actor_id', [uidA, uidB].filter(Boolean)) } catch { /* noop */ }
    try { if (uidA) await svc.auth.admin.deleteUser(uidA) } catch { /* noop */ }
    try { if (uidB) await svc.auth.admin.deleteUser(uidB) } catch { /* noop */ }
  }, 60_000)

  it('M1) оба игрока — в одном (seed) городе и в общем ростере get_town', async () => {
    expect(townId).toBe(SEED_TOWN)
    expect(uidA).not.toBe(uidB)
    const tn = await A.rpc('get_town')
    expect(tn.error).toBeNull()
    const roster = ((tn.data as { roster?: { userId: string }[] })?.roster ?? [])
    const ids = roster.map((r) => r.userId)
    expect(ids).toContain(uidA)
    expect(ids).toContain(uidB)
  })

  it('M2) чат: A постит в town-канал — сообщение доходит до B (RLS town-канала)', async () => {
    const body = 'howdy neighbor ' + tag
    const post = await A.rpc('chat_post', { p_channel_kind: 'town', p_body: body })
    expect(post.error).toBeNull()
    expect((post.data as { channel: string }).channel).toBe('town:' + townId)

    // Сосед B (та же town) читает town-канал под своей сессией — RLS пускает.
    const seen = await B.from('chat_messages').select('body,author_id').eq('channel', 'town:' + townId)
    expect(seen.error).toBeNull()
    const mine = (seen.data ?? []).find((m: { body: string }) => m.body === body)
    expect(mine).toBeTruthy()
    expect(mine!.author_id).toBe(uidA)
  })

  it('M3) помощь соседу: A→B и B→A — обе стороны записаны', async () => {
    const h1 = await A.rpc('help_neighbor', { p_target: uidB, p_action: 'water' })
    expect(h1.error).toBeNull()
    const h2 = await B.rpc('help_neighbor', { p_target: uidA, p_action: 'water' })
    expect(h2.error).toBeNull()

    const ab = await svc.from('help_actions').select('id').eq('actor_id', uidA).eq('target_id', uidB)
    const ba = await svc.from('help_actions').select('id').eq('actor_id', uidB).eq('target_id', uidA)
    expect((ab.data ?? []).length).toBeGreaterThanOrEqual(1)
    expect((ba.data ?? []).length).toBeGreaterThanOrEqual(1)
  })

  it('M4) подарок: A → B зафиксирован (сток списан у отправителя)', async () => {
    const g = await A.rpc('gift_send', { p_to: uidB, p_item_key: 'seed_tomato', p_qty: 1 })
    expect(g.error).toBeNull()
    const row = await svc.from('gifts').select('qty').eq('from_id', uidA).eq('to_id', uidB).eq('item_key', 'seed_tomato')
    expect((row.data ?? []).length).toBeGreaterThanOrEqual(1)
    // Сток отправителя уменьшился (6 стартовых − 1 подарок = 5).
    const inv = await svc.from('inventory').select('qty')
      .eq('item_key', 'seed_tomato').eq('quality', 0)
      .in('farm_id', [(await svc.from('farms').select('id').eq('player_id', uidA).single()).data!.id])
      .single()
    expect(inv.data?.qty).toBe(5)
  })

  it('M5) кооп-заказ: вклад A и B агрегируется в progress заказа', async () => {
    const c1 = await A.rpc('coop_contribute', { p_order: orderId, p_item_key: 'seed_tomato', p_qty: 2 })
    expect(c1.error).toBeNull()
    const c2 = await B.rpc('coop_contribute', { p_order: orderId, p_item_key: 'seed_tomato', p_qty: 3 })
    expect(c2.error).toBeNull()

    const ord = await svc.from('orders').select('progress').eq('id', orderId).single()
    expect((ord.data!.progress as Record<string, number>).seed_tomato).toBe(5)  // 2 (A) + 3 (B)
    const contribs = await svc.from('order_contributions').select('player_id').eq('order_id', orderId)
    expect(new Set((contribs.data ?? []).map((r: { player_id: string }) => r.player_id)).size).toBe(2)
  })

  it('M6) ивент: вклад A и B агрегируется в общий meter недели', async () => {
    const meter = async (): Promise<number> => {
      const r = await svc.from('event_weeks').select('meter_fp').eq('town_id', townId).eq('week_index', week).single()
      return Number(r.data!.meter_fp)
    }
    const m0 = await meter()
    const e1 = await A.rpc('event_contribute', { p_item_key: 'seed_lettuce', p_qty: 1, p_channel: 'contrib_donate' })
    expect(e1.error).toBeNull()
    const m1 = await meter()
    const e2 = await B.rpc('event_contribute', { p_item_key: 'seed_lettuce', p_qty: 1, p_channel: 'contrib_donate' })
    expect(e2.error).toBeNull()
    const m2 = await meter()

    const dA = m1 - m0
    const dB = m2 - m1
    expect(dA).toBeGreaterThan(0)              // вклад A поднял метр
    expect(dB).toBeGreaterThan(0)              // вклад B поднял метр
    expect(m2 - m0).toBe(dA + dB)              // агрегация обоих вкладов
    // Персональные вклады обоих учтены.
    const ew = await svc.from('event_weeks').select('id').eq('town_id', townId).eq('week_index', week).single()
    const pc = await svc.from('personal_contributions').select('player_id').eq('event_week_id', ew.data!.id)
    const set = new Set((pc.data ?? []).map((r: { player_id: string }) => r.player_id))
    expect(set.has(uidA) && set.has(uidB)).toBe(true)
  })
})
