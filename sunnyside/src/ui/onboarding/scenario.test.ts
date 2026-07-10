/**
 * scenario.test.ts — целостность данных мини-недели (18-onboarding §3.3/§4.1/§4.2).
 * Ноль браузера: чистые данные.
 */
import { describe, it, expect } from 'vitest'
import { MINI_WEEK_STEPS, AVATAR_PRESETS, MINI_FAIR_GUESTS } from './scenario'
import { NPC_NAME } from './text'
import { NPC_KEYS } from '@/types'

describe('mini-week scenario', () => {
  it('ровно 7 шагов t_day_1..7 по порядку', () => {
    expect(MINI_WEEK_STEPS).toHaveLength(7)
    MINI_WEEK_STEPS.forEach((step, i) => {
      expect(step.id).toBe(`t_day_${i + 1}`)
      expect(step.day).toBe(i + 1)
    })
  })

  it('каждый шаг двуязычен и имеет хотя бы одну реплику', () => {
    for (const step of MINI_WEEK_STEPS) {
      expect(step.title.ru).toBeTruthy()
      expect(step.title.en).toBeTruthy()
      expect(step.learn.ru).toBeTruthy()
      expect(step.reward.ru).toBeTruthy()
      expect(step.lines.length).toBeGreaterThan(0)
      for (const line of step.lines) {
        expect(line.text.ru).toBeTruthy()
        expect(line.text.en).toBeTruthy()
        expect(NPC_KEYS).toContain(line.npc)
      }
    }
  })

  it('ровно один шаг — финальная мини-ярмарка (t_day_6)', () => {
    const fairSteps = MINI_WEEK_STEPS.filter((s) => s.miniFair)
    expect(fairSteps).toHaveLength(1)
    expect(fairSteps[0]?.id).toBe('t_day_6')
  })

  it('4 косметических пресета аватара, ключи уникальны', () => {
    expect(AVATAR_PRESETS).toHaveLength(4)
    const keys = new Set(AVATAR_PRESETS.map((p) => p.key))
    expect(keys.size).toBe(4)
  })

  it('гости мини-ярмарки — валидные NPC с именами', () => {
    for (const npc of MINI_FAIR_GUESTS) {
      expect(NPC_KEYS).toContain(npc)
      expect(NPC_NAME[npc].ru).toBeTruthy()
    }
  })
})
