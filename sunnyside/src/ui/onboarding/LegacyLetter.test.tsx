/**
 * @vitest-environment jsdom
 *
 * LegacyLetter.test.tsx — экран письма (18-onboarding §2.1/§3.7): имя, аватар,
 * Begin, скип-гейт по флагу.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LegacyLetter } from './LegacyLetter'
import { OnboardingHost } from './OnboardingHost'
import { useFtueStore } from './store'

describe('LegacyLetter (§2.1/§3.7)', () => {
  beforeEach(() => useFtueStore.getState().reset())

  it('рендерит письмо и стартовое имя фермы', () => {
    render(<LegacyLetter locale="ru" />)
    expect(screen.getByTestId('onboarding-letter')).toBeTruthy()
    expect((screen.getByTestId('onboarding-farmname') as HTMLInputElement).value).toBe('Sunnyside')
  })

  it('ввод имени и выбор аватара пишутся в стор', () => {
    render(<LegacyLetter locale="ru" />)
    fireEvent.change(screen.getByTestId('onboarding-farmname'), { target: { value: 'Ромашка' } })
    fireEvent.click(screen.getByTestId('onboarding-avatar-denim'))
    expect(useFtueStore.getState().farmName).toBe('Ромашка')
    expect(useFtueStore.getState().avatar).toBe('denim')
  })

  it('скип-кнопка скрыта без права и видна с ним', () => {
    const { rerender } = render(<LegacyLetter locale="ru" canSkip={false} />)
    expect(screen.queryByTestId('onboarding-skip')).toBeNull()
    rerender(<LegacyLetter locale="ru" canSkip />)
    expect(screen.getByTestId('onboarding-skip')).toBeTruthy()
  })

  it('Begin запускает мини-неделю через хост', () => {
    render(<OnboardingHost locale="ru" />)
    fireEvent.click(screen.getByTestId('onboarding-begin'))
    expect(useFtueStore.getState().phase).toBe('mini_week')
    expect(screen.getByTestId('onboarding-miniweek')).toBeTruthy()
  })

  it('Skip опытного игрока сразу выпускает (§3.7)', () => {
    render(<OnboardingHost locale="ru" canSkip />)
    fireEvent.click(screen.getByTestId('onboarding-skip'))
    expect(useFtueStore.getState().skipped).toBe(true)
    expect(screen.getByTestId('onboarding-release')).toBeTruthy()
  })
})
