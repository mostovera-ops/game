/**
 * mentorStore.test.ts — редьюсеры локального пул/пары-стора менторства (чистая логика,
 * без DOM — `@vitest-environment node` подошёл бы, но zustand `create` работает в обоих).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useMentorStore } from './mentorStore'

describe('mentorStore', () => {
  beforeEach(() => {
    useMentorStore.getState().reset()
  })

  it('по умолчанию — не в пуле, без пар', () => {
    const s = useMentorStore.getState()
    expect(s.poolOptIn).toBe(false)
    expect(s.links).toEqual([])
    expect(s.celebrated).toEqual([])
  })

  it('setPoolOptIn переключает флаг пула', () => {
    useMentorStore.getState().setPoolOptIn(true)
    expect(useMentorStore.getState().poolOptIn).toBe(true)
  })

  it('addLink добавляет пару менти→ментор', () => {
    useMentorStore.getState().addLink({ partnerId: 'p1', partnerName: 'Nana Opal', myRole: 'mentee', since: 100 })
    const links = useMentorStore.getState().links
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({ partnerId: 'p1', myRole: 'mentee' })
  })

  it('менти может иметь только ОДНОГО ментора одновременно — вторая заявка игнорируется', () => {
    useMentorStore.getState().addLink({ partnerId: 'p1', partnerName: 'A', myRole: 'mentee', since: 1 })
    useMentorStore.getState().addLink({ partnerId: 'p2', partnerName: 'B', myRole: 'mentee', since: 2 })
    expect(useMentorStore.getState().links).toHaveLength(1)
  })

  it('ментор ведёт максимум 2 менти одновременно (11-town §3.7 анти-фарм)', () => {
    const { addLink } = useMentorStore.getState()
    addLink({ partnerId: 'm1', partnerName: 'A', myRole: 'mentor', since: 1 })
    addLink({ partnerId: 'm2', partnerName: 'B', myRole: 'mentor', since: 2 })
    addLink({ partnerId: 'm3', partnerName: 'C', myRole: 'mentor', since: 3 })
    expect(useMentorStore.getState().links).toHaveLength(2)
  })

  it('не дублирует уже существующего партнёра', () => {
    const { addLink } = useMentorStore.getState()
    addLink({ partnerId: 'p1', partnerName: 'A', myRole: 'mentor', since: 1 })
    addLink({ partnerId: 'p1', partnerName: 'A', myRole: 'mentor', since: 2 })
    expect(useMentorStore.getState().links).toHaveLength(1)
  })

  it('removeLink убирает пару по partnerId', () => {
    const { addLink, removeLink } = useMentorStore.getState()
    addLink({ partnerId: 'p1', partnerName: 'A', myRole: 'mentee', since: 1 })
    removeLink('p1')
    expect(useMentorStore.getState().links).toEqual([])
  })

  it('markCelebrated отмечает веху ровно один раз', () => {
    const { markCelebrated } = useMentorStore.getState()
    markCelebrated('farm_level_5')
    markCelebrated('farm_level_5')
    expect(useMentorStore.getState().celebrated).toEqual(['farm_level_5'])
  })
})
