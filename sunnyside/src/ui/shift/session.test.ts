/**
 * ui/shift/session.test.ts — юниты презентера смены (vitest, environment node).
 *
 * Проверяем КЛЮЧЕВЫЕ ВЗАИМОДЕЙСТВИЯ смены без DOM: подача двигает combo, таймаут сбрасывает,
 * агрегаты берутся из движка (`scoreShift`), сборка подноса матчится по тирам. Скоринг сам
 * покрыт в `engine/fair/*.test.ts` — здесь только оркестрация презентера.
 */

import { describe, it, expect } from 'vitest'
import { scoreShift, type TentLevel } from '@/engine/fair'
import type { DishDef } from './pool'
import {
  initRun,
  resolveGuest,
  pendingGuests,
  visibleQueue,
  sweepTimeouts,
  builtOrders,
  currentCombo,
  maxCombo,
  currentTipMultiplier,
  totals,
  trayMatches,
  tierMultiset,
  elapsedFraction,
  isOver,
  deriveSeed,
} from './session'

const POOL: DishDef[] = [
  { key: 'dish_a', tier: 1, label: 'A', emoji: '🍞', color: '#fff', stars: 0 },
  { key: 'dish_b', tier: 2, label: 'B', emoji: '🥞', color: '#fff', stars: 3 },
  { key: 'dish_c', tier: 3, label: 'C', emoji: '🥧', color: '#fff', stars: 5 },
]

const SEED = 12345
const LEVEL: TentLevel = 1

function freshRun() {
  return initRun({ seed: SEED, tentLevel: LEVEL, pool: POOL })
}

describe('initRun', () => {
  it('строит детерминированную непустую очередь из seed', () => {
    const run = initRun({ seed: SEED, tentLevel: LEVEL, pool: POOL })
    expect(run.guests.length).toBeGreaterThan(0)
    expect(run.durationSec).toBe(660) // TENT_TIERS[1].timerSec
    // Детерминизм: тот же seed → та же длина очереди.
    const again = initRun({ seed: SEED, tentLevel: LEVEL, pool: POOL })
    expect(again.guests.length).toBe(run.guests.length)
  })

  it('пустой пул блюд → пустая очередь (гейт входа F2)', () => {
    const run = initRun({ seed: SEED, tentLevel: LEVEL, pool: [] })
    expect(run.guests).toHaveLength(0)
  })
})

describe('resolveGuest', () => {
  it('идемпотентен и игнорит неизвестный id', () => {
    const run = freshRun()
    const id = run.guests[0]!.id
    const once = resolveGuest(run, id, 'normal')
    const twice = resolveGuest(once, id, 'normal')
    expect(once.resolutions).toHaveLength(1)
    expect(twice.resolutions).toHaveLength(1)
    const ghost = resolveGuest(run, 'nope', 'normal')
    expect(ghost.resolutions).toHaveLength(0)
  })
})

describe('combo (движок nextCombo)', () => {
  it('успешные подачи растят combo, таймаут сбрасывает в 0', () => {
    let run = freshRun()
    const order = pendingGuests(run, run.durationSec)
    run = resolveGuest(run, order[0]!.id, 'normal')
    run = resolveGuest(run, order[1]!.id, 'normal')
    run = resolveGuest(run, order[2]!.id, 'normal')
    expect(currentCombo(run)).toBe(3)
    expect(maxCombo(run)).toBe(3)
    // Таймаут (House Special) обнуляет серию.
    run = resolveGuest(run, order[3]!.id, 'house_special')
    expect(currentCombo(run)).toBe(0)
    expect(maxCombo(run)).toBe(3) // пик сохранён
  })

  it('множитель чаевых поднимается на пороге combo (движок COMBO_TIERS)', () => {
    let run = freshRun()
    expect(currentTipMultiplier(run)).toBe(1.0)
    const order = pendingGuests(run, run.durationSec)
    for (let i = 0; i < 3; i++) run = resolveGuest(run, order[i]!.id, 'normal')
    expect(currentTipMultiplier(run)).toBe(1.25) // combo 3 → ×1.25
  })
})

describe('totals — зеркало движка scoreShift', () => {
  it('агрегат презентера идентичен прямому scoreShift(builtOrders)', () => {
    let run = freshRun()
    const order = pendingGuests(run, run.durationSec)
    run = resolveGuest(run, order[0]!.id, 'normal')
    run = resolveGuest(run, order[1]!.id, 'normal')
    run = resolveGuest(run, order[2]!.id, 'house_special')

    const direct = scoreShift(builtOrders(run), {
      peggy: run.peggy,
      tentLevel: run.tentLevel,
      bucksMult: run.bucksMult,
    })
    expect(totals(run)).toEqual(direct)
  })

  it('served считает только успешные подачи (House Special не в счёте)', () => {
    let run = freshRun()
    const order = pendingGuests(run, run.durationSec)
    run = resolveGuest(run, order[0]!.id, 'normal')
    run = resolveGuest(run, order[1]!.id, 'house_special')
    run = resolveGuest(run, order[2]!.id, 'normal')
    const t = totals(run)
    expect(t.served).toBe(2)
    expect(t.bucks).toBeGreaterThan(0)
    expect(t.fairScore).toBeGreaterThan(0)
  })
})

describe('sweepTimeouts', () => {
  it('гость с истёкшим терпением авто-разрешается как House Special', () => {
    const run = freshRun()
    const first = pendingGuests(run, run.durationSec)[0]!
    // Время сильно за терпением первого гостя → таймаут.
    const nowSec = first.spawnAtMs / 1000 + first.patienceSec + 1
    const swept = sweepTimeouts(run, nowSec)
    const res = swept.resolutions.find((r) => r.guestId === first.id)
    expect(res?.kind).toBe('house_special')
  })
})

describe('очередь и тайминги', () => {
  it('pendingGuests не показывает ещё не появившихся; visibleQueue ограничена палаткой', () => {
    const run = freshRun()
    // На t=0 никто ещё не спавнился (первый спавн — на интервале фазы).
    expect(pendingGuests(run, 0)).toHaveLength(0)
    const all = pendingGuests(run, run.durationSec)
    expect(all.length).toBe(run.guests.length)
    expect(visibleQueue(run, run.durationSec).length).toBeLessThanOrEqual(4) // TENT_TIERS[1].queueLen
  })

  it('elapsedFraction клампится [0..1]; isOver на длительности', () => {
    const run = freshRun()
    expect(elapsedFraction(run, -5)).toBe(0)
    expect(elapsedFraction(run, run.durationSec * 2)).toBe(1)
    expect(elapsedFraction(run, run.durationSec / 2)).toBeCloseTo(0.5, 5)
    expect(isOver(run, run.durationSec)).toBe(true)
    expect(isOver(run, run.durationSec - 1)).toBe(false)
  })
})

describe('сборка подноса (матч по тирам)', () => {
  it('trayMatches — по мультимножеству тиров, порядок неважен', () => {
    expect(trayMatches([1, 2], [2, 1])).toBe(true)
    expect(trayMatches([1], [1, 1])).toBe(false)
    expect(trayMatches([3, 3, 1], [1, 3, 3])).toBe(true)
    expect(trayMatches([2], [3])).toBe(false)
    expect(trayMatches([], [])).toBe(true)
  })

  it('tierMultiset сортирует, не мутируя вход', () => {
    const src = [3, 1, 2]
    expect(tierMultiset(src)).toEqual([1, 2, 3])
    expect(src).toEqual([3, 1, 2])
  })
})

describe('deriveSeed', () => {
  it('детерминирован и 32-битный', () => {
    expect(deriveSeed(1000)).toBe(deriveSeed(1000))
    expect(deriveSeed(1000)).not.toBe(deriveSeed(1001))
    expect(deriveSeed(1000)).toBeGreaterThanOrEqual(0)
  })
})
