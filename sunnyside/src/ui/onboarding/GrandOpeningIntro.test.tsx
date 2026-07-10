/**
 * @vitest-environment jsdom
 *
 * GrandOpeningIntro.test.tsx — выпуск на улицу (18-onboarding §3.4/§3.8): баннер ×2,
 * вручение фермы, автопредложение стрита, финал; резюм фазы после «перезагрузки».
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GrandOpeningIntro } from './GrandOpeningIntro'
import { OnboardingHost } from './OnboardingHost'
import { useFtueStore } from './store'

describe('GrandOpeningIntro (§3.4/§3.8)', () => {
  beforeEach(() => {
    useFtueStore.getState().reset()
    // Приводим стор в фазу выпуска.
    useFtueStore.setState({ phase: 'released', step: 6, farmName: 'Ромашка' })
  })

  it('показывает баннер ×2, имя фермы и предложение стрита', () => {
    render(<GrandOpeningIntro locale="ru" />)
    expect(screen.getByTestId('onboarding-grandopening-banner')).toBeTruthy()
    expect(screen.getByTestId('onboarding-farmname-label').textContent).toBe('Ромашка')
    expect(screen.getByTestId('onboarding-street-join')).toBeTruthy()
  })

  it('вступление в стрит зовёт колбэк и меняет вид', () => {
    const onStreetJoin = vi.fn()
    render(<GrandOpeningIntro locale="ru" onStreetJoin={onStreetJoin} />)
    fireEvent.click(screen.getByTestId('onboarding-street-join'))
    expect(onStreetJoin).toHaveBeenCalled()
    expect(useFtueStore.getState().streetJoined).toBe(true)
    expect(screen.getByTestId('onboarding-street-joined')).toBeTruthy()
  })

  it('финал зовёт onFinish и переводит FTUE в done', () => {
    const onFinish = vi.fn()
    render(<GrandOpeningIntro locale="ru" onFinish={onFinish} />)
    fireEvent.click(screen.getByTestId('onboarding-finish'))
    expect(onFinish).toHaveBeenCalled()
    expect(useFtueStore.getState().phase).toBe('done')
  })

  it('резюм: хост восстанавливает экран выпуска по персистнутой фазе (§3.2/O2)', () => {
    // Симулируем перезагрузку: новый монтаж хоста при phase=released.
    render(<OnboardingHost locale="ru" />)
    expect(screen.getByTestId('onboarding-release')).toBeTruthy()
  })

  it('после done хост показывает карточку цели дня, если задан personalDay (§3.5)', () => {
    useFtueStore.setState({ phase: 'done' })
    render(<OnboardingHost locale="ru" personalDay={2} />)
    expect(screen.getByTestId('onboarding-daily-goal')).toBeTruthy()
  })
})
