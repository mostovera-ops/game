/**
 * @vitest-environment jsdom
 *
 * MiniWeek.test.tsx — под-фазы шага {реплики → действие → награда} и переход к
 * следующему дню (18-onboarding §3.3). Проверяем прогон одного шага и финальный
 * выпуск через хост.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MiniWeek } from './MiniWeek'
import { OnboardingHost } from './OnboardingHost'
import { useFtueStore } from './store'
import { MINI_WEEK_STEPS } from './scenario'

/** Прокликать реплики диалога до кнопки действия. */
function clickThroughDialogue() {
  // «Пропустить» реплики за один клик (доступно, пока не последняя).
  const skip = screen.queryByTestId('onboarding-dialogue-skip')
  if (skip) fireEvent.click(skip)
  else fireEvent.click(screen.getByTestId('onboarding-dialogue-next'))
}

describe('MiniWeek (§3.3)', () => {
  beforeEach(() => {
    useFtueStore.getState().reset()
    useFtueStore.getState().startMiniWeek()
  })

  it('шаг проходит talk → act → reward и переводит на следующий день', () => {
    render(<MiniWeek locale="ru" />)
    // День 1 из 7
    expect(screen.getByTestId('onboarding-daycounter').textContent).toContain('1')
    // talk → act
    clickThroughDialogue()
    expect(screen.getByTestId('onboarding-act')).toBeTruthy()
    // act → reward
    fireEvent.click(screen.getByTestId('onboarding-action'))
    expect(screen.getByTestId('onboarding-reward')).toBeTruthy()
    // reward → следующий день
    fireEvent.click(screen.getByTestId('onboarding-nextday'))
    expect(useFtueStore.getState().step).toBe(1)
    expect(screen.getByTestId('onboarding-daycounter').textContent).toContain('2')
  })

  it('t_day_6 показывает мини-ярмарку и ленту в награде', () => {
    // Перепрыгиваем на шаг мини-ярмарки (index 5 = t_day_6).
    const fairIdx = MINI_WEEK_STEPS.findIndex((s) => s.miniFair)
    act(() => {
      useFtueStore.setState({ step: fairIdx })
    })
    render(<MiniWeek locale="ru" />)
    clickThroughDialogue()
    expect(screen.getByTestId('onboarding-minifair')).toBeTruthy()
    fireEvent.click(screen.getByTestId('onboarding-action'))
    expect(screen.getByTestId('onboarding-blue-ribbon')).toBeTruthy()
  })

  it('прогон всех 7 дней доводит FTUE до экрана выпуска', () => {
    render(<OnboardingHost locale="ru" />)
    for (let i = 0; i < MINI_WEEK_STEPS.length; i++) {
      clickThroughDialogue()
      fireEvent.click(screen.getByTestId('onboarding-action'))
      fireEvent.click(screen.getByTestId('onboarding-nextday'))
    }
    expect(useFtueStore.getState().phase).toBe('released')
    expect(screen.getByTestId('onboarding-release')).toBeTruthy()
  })
})
