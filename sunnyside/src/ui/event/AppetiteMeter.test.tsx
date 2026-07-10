/**
 * @vitest-environment jsdom
 *
 * AppetiteMeter.test.tsx — рендер (V1) + Grimsby banner (V2). Читает только
 * `event`-слайс стора (мок, серверная истина) — компонент сам ничего не считает.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useStore } from '@/state'
import { AppetiteMeter } from './AppetiteMeter'
import type { EventSnapshot } from '@/types'

function seedEvent(overrides: Partial<EventSnapshot> = {}) {
  const now = Date.now()
  const snapshot: EventSnapshot = {
    meter: {
      eventKey: 'ev_glutton',
      meterPct: 42,
      meterFp: 42_000,
      goalFp: 100_000,
      milestones: [
        { pct: 25, reward: 'T3 seeds', hit: true },
        { pct: 50, reward: 'decor + 🎟', hit: false },
        { pct: 75, reward: 'weekly boost', hit: false },
        { pct: 100, reward: 'parade + frame', hit: false },
      ],
      window: { opensAt: now - 3_600_000, closesAt: now + 40 * 3_600_000 },
      finalAt: now + 6 * 3_600_000,
    },
    personalFp: 1234,
    streetPennant: false,
    myContribHist: [],
    ...overrides,
  }
  useStore.getState().setEvent(snapshot)
}

describe('AppetiteMeter (V1/V2)', () => {
  beforeEach(() => {
    useStore.setState({ ui: { ...useStore.getState().ui, locale: 'ru' }, event: null })
  })

  it('показывает пустое состояние без снапшота ивента', () => {
    render(<AppetiteMeter />)
    expect(screen.getByTestId('appetite-meter-empty')).toBeTruthy()
  })

  it('рендерит шкалу, вехи и личный вклад из снапшота', () => {
    seedEvent()
    render(<AppetiteMeter />)
    expect(screen.getByTestId('appetite-meter-pct').textContent).toContain('42')
    expect(screen.getByTestId('appetite-meter-milestone-25')).toBeTruthy()
    expect(screen.getByTestId('appetite-meter-reward-25').textContent).toContain('✓')
    expect(screen.getByTestId('appetite-meter-personal-fp')).toBeTruthy()
  })

  it('вымпел стрита отражает streetPennant из снапшота', () => {
    seedEvent({ streetPennant: true })
    render(<AppetiteMeter />)
    expect(screen.getByTestId('appetite-meter-pennant').textContent).toContain('🚩')
  })

  it('показывает баннер капризов Гримсби в теме ev_glutton', () => {
    seedEvent()
    render(<AppetiteMeter />)
    expect(screen.getByTestId('grimsby-banner')).toBeTruthy()
    expect(screen.getByTestId('grimsby-craves')).toBeTruthy()
  })

  it('не показывает баннер Гримсби в других темах', () => {
    const now = Date.now()
    seedEvent({
      meter: {
        eventKey: 'ev_big_festival',
        meterPct: 10,
        meterFp: 10_000,
        goalFp: 100_000,
        milestones: [
          { pct: 25, reward: 'T3 seeds', hit: false },
          { pct: 50, reward: 'decor + 🎟', hit: false },
          { pct: 75, reward: 'weekly boost', hit: false },
          { pct: 100, reward: 'parade + frame', hit: false },
        ],
        window: { opensAt: now, closesAt: now + 40 * 3_600_000 },
        finalAt: now + 6 * 3_600_000,
      },
    })
    render(<AppetiteMeter />)
    expect(screen.queryByTestId('grimsby-banner')).toBeNull()
  })
})
