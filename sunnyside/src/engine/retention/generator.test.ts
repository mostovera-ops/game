import { describe, expect, it } from 'vitest'
import { dailySpecialTemplates } from '@/data/catalogs/dailySpecials'
import { generateDailySpecials } from './generator'
import { DAILY_SPECIALS_COUNT, NON_COMMUNITY_CATEGORIES } from './constants'

describe('generateDailySpecials', () => {
  it('генерирует ровно 3 задачи из полного пула (все категории доступны)', () => {
    const result = generateDailySpecials({ farmValueTotal: 0, seed: 1 })
    expect(result.specials).toHaveLength(DAILY_SPECIALS_COUNT)
  })

  it('никогда не выбирает шаблон вне availableTemplateKeys (недоступные игроку задачи не выпадают)', () => {
    const onlyField = dailySpecialTemplates.filter((t) => t.category === 'Field').map((t) => t.key)
    for (let seed = 0; seed < 50; seed++) {
      const result = generateDailySpecials({
        farmValueTotal: 0,
        seed,
        availableTemplateKeys: new Set(onlyField),
      })
      for (const s of result.specials) {
        expect(onlyField).toContain(s.templateKey)
      }
    }
  })

  it('не выпадает НИ ОДНОЙ задачи, если у игрока нет доступных шаблонов вовсе', () => {
    const result = generateDailySpecials({ farmValueTotal: 0, seed: 7, availableTemplateKeys: new Set() })
    expect(result.specials).toHaveLength(0)
    expect(result.mainFocusCategory).toBeNull()
  })

  it('деградирует мягко: при доступности только 2 категорий выдаёт максимум 2 задачи (без Community)', () => {
    const restricted = dailySpecialTemplates.filter((t) => t.category === 'Field' || t.category === 'Kitchen')
    const result = generateDailySpecials(
      { farmValueTotal: 0, seed: 3, availableTemplateKeys: new Set(restricted.map((t) => t.key)) },
    )
    expect(result.specials.length).toBeLessThanOrEqual(2)
    const categories = new Set(result.specials.map((s) => s.category))
    expect(categories.has('Counter')).toBe(false)
    expect(categories.has('Yard')).toBe(false)
  })

  it('не повторяет НЕ-Community категорию дважды в одном дне (anti-repeat §3.1 п.a)', () => {
    for (let seed = 0; seed < 100; seed++) {
      const result = generateDailySpecials({ farmValueTotal: 0, seed })
      const nonCommunityCats = result.specials
        .map((s) => s.category)
        .filter((c) => c !== 'Community')
      const seen = new Set(nonCommunityCats)
      expect(seen.size).toBe(nonCommunityCats.length)
    }
  })

  it('Community может встретиться максимум дважды, а не больше', () => {
    for (let seed = 0; seed < 100; seed++) {
      const result = generateDailySpecials({ farmValueTotal: 0, seed })
      const communityCount = result.specials.filter((s) => s.category === 'Community').length
      expect(communityCount).toBeLessThanOrEqual(2)
    }
  })

  it('никогда не выбирает один и тот же templateKey дважды в один день', () => {
    for (let seed = 0; seed < 100; seed++) {
      const result = generateDailySpecials({ farmValueTotal: 0, seed })
      const keys = result.specials.map((s) => s.templateKey)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('главный фокус вчерашнего дня не может быть главным фокусом сегодня (anti-repeat §3.1 п.b)', () => {
    for (const prev of NON_COMMUNITY_CATEGORIES) {
      for (let seed = 0; seed < 30; seed++) {
        const result = generateDailySpecials({ farmValueTotal: 0, seed, previousMainFocusCategory: prev })
        if (result.mainFocusCategory !== null) {
          expect(result.mainFocusCategory).not.toBe(prev)
        }
      }
    }
  })

  it('ровно один слот помечен isMainFocus, совпадающий с mainFocusCategory', () => {
    const result = generateDailySpecials({ farmValueTotal: 0, seed: 42 })
    const mainSlots = result.specials.filter((s) => s.isMainFocus)
    expect(mainSlots).toHaveLength(1)
    expect(mainSlots[0]!.category).toBe(result.mainFocusCategory)
  })

  it('детерминирована: одинаковый вход даёт одинаковый выход', () => {
    const a = generateDailySpecials({ farmValueTotal: 12_500, seed: 999 })
    const b = generateDailySpecials({ farmValueTotal: 12_500, seed: 999 })
    expect(a).toEqual(b)
  })

  it('скейлит targetQty по бракету Farm Value (§3.1) — выше бракет → выше цель', () => {
    const low = generateDailySpecials({ farmValueTotal: 0, seed: 5 })
    const high = generateDailySpecials({ farmValueTotal: 200_000, seed: 5 })
    // Один и тот же seed → тот же выбор шаблонов/категорий, разный только масштаб цели.
    expect(low.specials.map((s) => s.templateKey)).toEqual(high.specials.map((s) => s.templateKey))
    for (let i = 0; i < low.specials.length; i++) {
      expect(high.specials[i]!.targetQty).toBeGreaterThanOrEqual(low.specials[i]!.targetQty)
    }
  })

  it('принимает availableTemplateKeys как обычный readonly-массив (не только Set)', () => {
    const keys = dailySpecialTemplates.slice(0, 5).map((t) => t.key)
    const result = generateDailySpecials({ farmValueTotal: 0, seed: 11, availableTemplateKeys: keys })
    for (const s of result.specials) expect(keys).toContain(s.templateKey)
  })
})
