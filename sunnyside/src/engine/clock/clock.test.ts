/**
 * clock.test.ts — исчерпывающие граничные тесты системы календаря/времени
 * (01-core-loop). Запускается в node без браузера (граница game↔scene, §3.1).
 *
 * Ground truth времени строится через `Date.UTC(...)` — это UTC-эталон, поэтому
 * тесты сами по себе DST-иммунны и проверяют, что фазы/якоря не зависят от TZ.
 *
 * Эталонные недели:
 *   • Зимняя: Пн 2024-01-01 00:00 UTC
 *   • Летняя: Пн 2024-07-01 00:00 UTC  (для проверки DST-иммунности)
 */

import { describe, it, expect } from 'vitest'
import type { RpcResult } from '@/types'
import {
  // constants
  WEEK_MS,
  DAY_MS,
  HOUR_MS,
  FAIR_WINDOW_MS,
  GRAND_OPENING_MS,
  SEASON_LENGTH_WEEKS,
  ROLLOVER_OFFSET,
  // calendar
  weekNumberOf,
  weekStartOf,
  weekStartOfIndex,
  offsetInWeek,
  phaseAt,
  phaseAtOffset,
  weekAnchors,
  nextAnchor,
  type AnchorCode,
  fairWindowOf,
  isWindowOpen,
  contestEntryWindowOf,
  contestVoteWindowOf,
  buildCalendar,
  seasonProgress,
  seasonEndAt,
  isWithinSeasonRewardGrace,
  // tutorial
  TUTORIAL_STEPS,
  tutorialIndexOf,
  tutorialStep,
  tutorialNext,
  isTutorialComplete,
  tutorialProgress,
  entryPhase,
  grandOpeningWindow,
  isGrandOpeningActive,
  grandOpeningRemainingMs,
  // system
  computeOffset,
  createClockSystem,
} from './index'

// Эталонная зимняя неделя (Пн 2024-01-01 00:00:00 UTC).
const WS = Date.UTC(2024, 0, 1, 0, 0, 0, 0)
// Эталонная летняя неделя (Пн 2024-07-01 00:00:00 UTC).
const WS_SUMMER = Date.UTC(2024, 6, 1, 0, 0, 0, 0)

describe('нарезка недель', () => {
  it('WS — понедельник 00:00 UTC — это начало своей недели', () => {
    expect(weekStartOf(WS)).toBe(WS)
    expect(offsetInWeek(WS)).toBe(0)
  })
  it('любой момент внутри недели возвращает тот же Пн 00:00', () => {
    expect(weekStartOf(WS + 3 * DAY_MS + 12345)).toBe(WS)
    expect(weekStartOf(WS + WEEK_MS - 1)).toBe(WS)
  })
  it('ровно следующий Пн 00:00 — уже новая неделя', () => {
    expect(weekStartOf(WS + WEEK_MS)).toBe(WS + WEEK_MS)
  })
  it('weekNumberOf монотонен, weekStartOfIndex — обратная функция', () => {
    const n = weekNumberOf(WS)
    expect(weekNumberOf(WS + WEEK_MS)).toBe(n + 1)
    expect(weekStartOfIndex(n)).toBe(WS)
    expect(weekStartOfIndex(n + 5)).toBe(WS + 5 * WEEK_MS)
  })
  it('эталонная неделя выровнена: Пн 2024-01-01 действительно Пн 00:00', () => {
    // Пн 2024-01-01 — понедельник (getUTCDay===1), проверяем инвариант нарезки.
    expect(new Date(WS).getUTCDay()).toBe(1)
    expect(new Date(weekStartOf(WS_SUMMER)).getUTCDay()).toBe(1)
  })
})

describe('phaseAt — границы фаз (полуоткрытые интервалы)', () => {
  const cases: Array<[number, string]> = [
    [WS, 'mon_plan'],
    [WS + DAY_MS - 1, 'mon_plan'],
    [Date.UTC(2024, 0, 2), 'tue_produce'],
    [Date.UTC(2024, 0, 3) - 1, 'tue_produce'],
    [Date.UTC(2024, 0, 3), 'wed_expedition'],
    [Date.UTC(2024, 0, 4) - 1, 'wed_expedition'],
    [Date.UTC(2024, 0, 4), 'thu_push'],
    [Date.UTC(2024, 0, 4, 23, 59, 59), 'thu_push'], // A5 Co-op дедлайн — ещё push
    [Date.UTC(2024, 0, 5) - 1, 'thu_push'],
    [Date.UTC(2024, 0, 5), 'fri_prep'],
    [Date.UTC(2024, 0, 6) - 1, 'fri_prep'],
    [Date.UTC(2024, 0, 6), 'sat_fair'], // A8 Сб 00:00 — ярмарка
    [Date.UTC(2024, 0, 7, 12) - 1, 'sat_fair'], // за 1мс до закрытия — ещё ярмарка
    [Date.UTC(2024, 0, 7, 12), 'sun_event'], // A10 Вс 12:00 — финал/тихий вечер
    [Date.UTC(2024, 0, 7, 20), 'sun_event'], // A12 Вс 20:00
    [Date.UTC(2024, 0, 7, 23, 59, 59), 'sun_event'], // A14 rollover
    [WS + WEEK_MS - 1, 'sun_event'], // последняя мс недели
    [WS + WEEK_MS, 'mon_plan'], // ровно rollover → новая неделя
  ]
  it.each(cases)('phaseAt(%i) === %s', (t, phase) => {
    expect(phaseAt(t)).toBe(phase)
  })

  it('phaseAtOffset согласован с phaseAt', () => {
    for (const [t] of cases) {
      expect(phaseAtOffset(offsetInWeek(t))).toBe(phaseAt(t))
    }
  })
})

describe('DST-иммунность: якоря в UTC независимо от сезона', () => {
  it('зимняя и летняя недели дают одинаковую фазу для одинакового смещения', () => {
    for (const off of [0, DAY_MS, 3 * DAY_MS, 5 * DAY_MS, 5 * DAY_MS + 12 * HOUR_MS, WEEK_MS - 1]) {
      expect(phaseAt(WS + off)).toBe(phaseAt(WS_SUMMER + off))
    }
  })
  it('якоря летней недели смещены ровно на целое число недель от зимней', () => {
    const winter = weekAnchors(WS)
    const summer = weekAnchors(WS_SUMMER)
    const deltaWeeks = (WS_SUMMER - WS) / WEEK_MS
    expect(Number.isInteger(deltaWeeks)).toBe(true)
    winter.forEach((a, i) => {
      const s = summer[i]!
      expect(s.code).toBe(a.code)
      expect(s.at - a.at).toBe(deltaWeeks * WEEK_MS)
    })
  })
})

describe('weekAnchors — точные UTC-моменты (canon §4.1)', () => {
  const a = Object.fromEntries(weekAnchors(WS).map((x) => [x.code, x.at])) as Record<
    AnchorCode,
    number
  >
  it('A0 начало недели = Пн 00:00', () => expect(a.A0).toBe(WS))
  it('A5 Co-op дедлайн = Чт 23:59:59', () =>
    expect(a.A5).toBe(Date.UTC(2024, 0, 4, 23, 59, 59)))
  it('A8 открытие ярмарки = Сб 00:00', () => expect(a.A8).toBe(Date.UTC(2024, 0, 6)))
  it('A10 закрытие ярмарки = Вс 12:00 (A8 + 36 ч)', () => {
    expect(a.A10).toBe(Date.UTC(2024, 0, 7, 12))
    expect(a.A10 - a.A8).toBe(FAIR_WINDOW_MS)
  })
  it('A12 финал ивента = Вс 20:00', () => expect(a.A12).toBe(Date.UTC(2024, 0, 7, 20)))
  it('A14 rollover = Вс 23:59:59', () => expect(a.A14).toBe(Date.UTC(2024, 0, 7, 23, 59, 59)))
  it('якоря строго возрастают', () => {
    const ats = weekAnchors(WS).map((x) => x.at)
    for (let i = 1; i < ats.length; i++) expect(ats[i]!).toBeGreaterThan(ats[i - 1]!)
  })
})

describe('nextAnchor — ближайший якорь строго после t (§4.3)', () => {
  it('в начале недели следующий якорь — A2 (Вт 00:00)', () => {
    const n = nextAnchor(WS)
    expect(n.code).toBe('A2')
    expect(n.at).toBe(Date.UTC(2024, 0, 2))
  })
  it('сразу после A5 следующий — A6 (Пт 00:00)', () => {
    const n = nextAnchor(Date.UTC(2024, 0, 4, 23, 59, 59) + 1)
    expect(n.code).toBe('A6')
    expect(n.at).toBe(Date.UTC(2024, 0, 5))
  })
  it('после A14 (rollover) следующий — A0 новой недели (нет мёртвой зоны)', () => {
    const n = nextAnchor(Date.UTC(2024, 0, 7, 23, 59, 59) + 1)
    expect(n.code).toBe('A0')
    expect(n.at).toBe(WS + WEEK_MS)
    expect(n.at).toBe(Date.UTC(2024, 0, 8))
  })
})

describe('окно ярмарки', () => {
  const w = fairWindowOf(WS)
  it('окно = Сб 00:00 → Вс 12:00, ширина 36 ч', () => {
    expect(w.opensAt).toBe(Date.UTC(2024, 0, 6))
    expect(w.closesAt).toBe(Date.UTC(2024, 0, 7, 12))
    expect(w.closesAt - w.opensAt).toBe(FAIR_WINDOW_MS)
  })
  it('isWindowOpen: открыто на opensAt, закрыто на closesAt (полуоткрытое)', () => {
    expect(isWindowOpen(w, w.opensAt)).toBe(true)
    expect(isWindowOpen(w, w.closesAt - 1)).toBe(true)
    expect(isWindowOpen(w, w.closesAt)).toBe(false)
    expect(isWindowOpen(w, w.opensAt - 1)).toBe(false)
  })
})

describe('окна конкурсов (§3.2/§3.5, гипотеза)', () => {
  it('приём заявок Сб 00:00 → Сб 12:00 (12 ч)', () => {
    const w = contestEntryWindowOf(WS)
    expect(w.opensAt).toBe(Date.UTC(2024, 0, 6))
    expect(w.closesAt).toBe(Date.UTC(2024, 0, 6, 12))
  })
  it('голосование Сб 12:00 → Вс 12:00 (24 ч), стыкуется с приёмом заявок', () => {
    const entry = contestEntryWindowOf(WS)
    const vote = contestVoteWindowOf(WS)
    expect(vote.opensAt).toBe(entry.closesAt)
    expect(vote.closesAt).toBe(Date.UTC(2024, 0, 7, 12))
    expect(vote.closesAt).toBe(fairWindowOf(WS).closesAt) // = A10, закрытие ярмарки
  })
})

describe('buildCalendar — детерминированный снапшот', () => {
  it('поля соответствуют якорям недели', () => {
    const t = WS + 2 * DAY_MS // среда
    const cal = buildCalendar(t, 'town-1')
    expect(cal.townId).toBe('town-1')
    expect(cal.weekIndex).toBe(weekNumberOf(t))
    expect(cal.phase).toBe('wed_expedition')
    expect(cal.rolloverAt).toBe(Date.UTC(2024, 0, 7, 23, 59, 59))
    expect(cal.coopDeadlineAt).toBe(Date.UTC(2024, 0, 4, 23, 59, 59))
    expect(cal.eventFinalAt).toBe(Date.UTC(2024, 0, 7, 20))
    expect(cal.fairWindow.opensAt).toBe(Date.UTC(2024, 0, 6))
    expect(cal.fairWindow.closesAt).toBe(Date.UTC(2024, 0, 7, 12))
  })
  it('weekIndex можно переопределить серверным значением', () => {
    expect(buildCalendar(WS, 't', 42).weekIndex).toBe(42)
  })
})

describe('seasonProgress — сезон 8 недель (§3.8/§4.4)', () => {
  it('первая неделя сезона', () => {
    const p = seasonProgress(100, 100)
    expect(p).toEqual({ seasonIndex: 0, weekInSeason: 1, weeksRemaining: 8, isFinalWeek: false })
  })
  it('последняя (8-я) неделя сезона — финал', () => {
    const p = seasonProgress(107, 100)
    expect(p.weekInSeason).toBe(SEASON_LENGTH_WEEKS)
    expect(p.weeksRemaining).toBe(1)
    expect(p.isFinalWeek).toBe(true)
  })
  it('следующая неделя после финала — новый сезон, неделя 1', () => {
    const p = seasonProgress(108, 100)
    expect(p.seasonIndex).toBe(1)
    expect(p.weekInSeason).toBe(1)
  })
  it('неделя до старта сезона: корректный отрицательный seasonIndex, weekInSeason в 1..8', () => {
    const p = seasonProgress(99, 100)
    expect(p.seasonIndex).toBe(-1)
    expect(p.weekInSeason).toBe(8)
  })
})

describe('seasonEndAt / isWithinSeasonRewardGrace (§3.8 C10, гипотеза)', () => {
  it('конец сезона 0 — rollover его 8-й недели', () => {
    const end = seasonEndAt(100, 0)
    expect(end).toBe(weekStartOfIndex(107) + ROLLOVER_OFFSET)
  })
  it('grace-окно 72ч после конца сезона', () => {
    const end = seasonEndAt(100, 0)
    expect(isWithinSeasonRewardGrace(end, end)).toBe(true)
    expect(isWithinSeasonRewardGrace(end, end + 72 * HOUR_MS - 1)).toBe(true)
    expect(isWithinSeasonRewardGrace(end, end + 72 * HOUR_MS)).toBe(false)
    expect(isWithinSeasonRewardGrace(end, end - 1)).toBe(false)
  })
})

describe('Tutorial Mini-Week (§3.9)', () => {
  it('ровно 7 сжатых дней в каноничном порядке', () => {
    expect(TUTORIAL_STEPS).toHaveLength(7)
    expect(TUTORIAL_STEPS.map((s) => s.key)).toEqual([
      't_day_1', 't_day_2', 't_day_3', 't_day_4', 't_day_5', 't_day_6', 't_day_7',
    ])
  })
  it('прообразы фаз совпадают с ролями дней недели', () => {
    expect(TUTORIAL_STEPS.map((s) => s.prototypePhase)).toEqual([
      'mon_plan', 'tue_produce', 'wed_expedition', 'thu_push', 'fri_prep', 'sat_fair', 'sun_event',
    ])
  })
  it('сжатые таймеры из спеки (§3.9)', () => {
    expect(tutorialStep('t_day_1')?.timerSec).toBe(10)
    expect(tutorialStep('t_day_2')?.timerSec).toBe(15)
    expect(tutorialStep('t_day_3')?.timerSec).toBe(20)
    expect(tutorialStep('t_day_6')?.timerSec).toBe(60)
  })
  it('степ-автомат: цепочка next до завершения', () => {
    expect(tutorialNext('t_day_1')).toBe('t_day_2')
    expect(tutorialNext('t_day_6')).toBe('t_day_7')
    expect(tutorialNext('t_day_7')).toBeNull()
  })
  it('неизвестный ключ → next null, index -1', () => {
    expect(tutorialNext('t_day_x' as never)).toBeNull()
    expect(tutorialIndexOf('t_day_x' as never)).toBe(-1)
    expect(tutorialStep('t_day_x' as never)).toBeUndefined()
  })
  it('isTutorialComplete только на t_day_7', () => {
    expect(isTutorialComplete('t_day_6')).toBe(false)
    expect(isTutorialComplete('t_day_7')).toBe(true)
  })
  it('tutorialProgress', () => {
    expect(tutorialProgress('t_day_1')).toEqual({ index: 1, total: 7, remaining: 6 })
    expect(tutorialProgress('t_day_7')).toEqual({ index: 7, total: 7, remaining: 0 })
  })
})

describe('вливание новичка + Grand Opening (§3.10)', () => {
  it('entryPhase = текущая реальная фаза сервера', () => {
    expect(entryPhase(Date.UTC(2024, 0, 3, 14))).toBe('wed_expedition') // §3.10 пример
    expect(entryPhase(Date.UTC(2024, 0, 6, 5))).toBe('sat_fair') // вошёл в ярмарку — сразу прилавок (C8)
  })
  it('Grand Opening: фиксированное окно 7×24 ч ×2, переживает границу недели', () => {
    const activated = Date.UTC(2024, 0, 6, 5) // суббота
    const w = grandOpeningWindow(activated)
    expect(w.mult).toBe(2)
    expect(w.closesAt - w.opensAt).toBe(GRAND_OPENING_MS)
    expect(w.closesAt).toBe(activated + 7 * DAY_MS)
    // Пересекает rollover (Вс 23:59:59) свободно:
    expect(w.closesAt).toBeGreaterThan(Date.UTC(2024, 0, 7, 23, 59, 59))
  })
  it('isGrandOpeningActive — полуоткрытое окно', () => {
    const a = 1_000_000
    expect(isGrandOpeningActive(a, a)).toBe(true)
    expect(isGrandOpeningActive(a, a + GRAND_OPENING_MS - 1)).toBe(true)
    expect(isGrandOpeningActive(a, a + GRAND_OPENING_MS)).toBe(false)
    expect(isGrandOpeningActive(a, a - 1)).toBe(false)
  })
  it('grandOpeningRemainingMs', () => {
    const a = 1_000_000
    expect(grandOpeningRemainingMs(a, a)).toBe(GRAND_OPENING_MS)
    expect(grandOpeningRemainingMs(a, a + GRAND_OPENING_MS)).toBe(0)
    expect(grandOpeningRemainingMs(a, a + GRAND_OPENING_MS + 5)).toBe(-5)
  })
})

describe('computeOffset — медиана с поправкой на RTT/2 (§3.3)', () => {
  it('пустой набор → 0', () => {
    expect(computeOffset([])).toBe(0)
  })
  it('один сэмпл: offset = serverNow − середина окна запроса', () => {
    // localMid = 0 + 100/2 = 50; offset = 1000 − 50 = 950
    expect(computeOffset([{ localBefore: 0, serverNow: 1000, localAfter: 100 }])).toBe(950)
  })
  it('нечётное число — центральный элемент; устойчив к выбросу', () => {
    const s = [
      { localBefore: 0, serverNow: 1000, localAfter: 0 }, // 1000
      { localBefore: 0, serverNow: 1005, localAfter: 0 }, // 1005
      { localBefore: 0, serverNow: 9999, localAfter: 0 }, // выброс 9999
    ]
    expect(computeOffset(s)).toBe(1005)
  })
  it('чётное число — среднее двух центральных', () => {
    const s = [
      { localBefore: 0, serverNow: 1000, localAfter: 0 },
      { localBefore: 0, serverNow: 1010, localAfter: 0 },
    ]
    expect(computeOffset(s)).toBe(1005)
  })
})

describe('createClockSystem — фабрика ClockSystem (§3.6)', () => {
  const okTime = (serverNow: number): Promise<RpcResult<{ serverNow: number }>> =>
    Promise.resolve({ ok: true, data: { serverNow } })

  it('serverNow() = локальные часы + offset после sync', async () => {
    const clock = createClockSystem({
      adapter: { getServerTime: () => okTime(5000) },
      now: () => 1000, // rtt=0 → offset = 5000 − 1000 = 4000
      samples: 1,
    })
    await clock.sync()
    expect(clock.serverNow()).toBe(5000)
  })

  it('isReady заблокирован до успешного sync (C4)', () => {
    const clock = createClockSystem({
      adapter: { getServerTime: () => okTime(5000) },
      now: () => 1000,
    })
    // без sync: serverNow есть, но isReady=false
    expect(clock.serverNow()).toBe(1000)
    expect(clock.isReady(0)).toBe(false)
  })

  it('после sync: isReady и remainingMs корректны', async () => {
    const clock = createClockSystem({
      adapter: { getServerTime: () => okTime(5000) },
      now: () => 1000,
      samples: 1,
    })
    await clock.sync()
    expect(clock.isReady(4000)).toBe(true) // serverNow 5000 ≥ 4000
    expect(clock.isReady(6000)).toBe(false)
    expect(clock.remainingMs(6000)).toBe(1000)
    expect(clock.remainingMs(4000)).toBe(-1000) // отрицательный до забора — норма
  })

  it('все ответы неуспешны → остаётся несинхронизированным', async () => {
    const clock = createClockSystem({
      adapter: {
        getServerTime: () =>
          Promise.resolve<RpcResult<{ serverNow: number }>>({
            ok: false,
            error: { code: 'offline', message: 'no net' },
          }),
      },
      now: () => 1000,
      samples: 3,
    })
    await clock.sync()
    expect(clock.isReady(0)).toBe(false)
    expect(clock.serverNow()).toBe(1000) // offset остался 0
  })
})
