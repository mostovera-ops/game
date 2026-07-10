/**
 * catalogs/decor.test.ts — валидация каталога декора двора/интерьера
 * (`decorItems`, `cosmetics.ts`). Не часть `CONTENT_CATALOGS`/`validate.test.ts`
 * (см. комментарий в шапке `cosmetics.ts` — локальная схема, общий
 * `schema.ts` не трогаем без согласования, AGENTS.md §2/§3).
 */

import { describe, it, expect } from 'vitest'
import { decorItems, DecorItemDefSchema } from './cosmetics'
import { assertUniqueKeys } from '../schema'

describe('decorItems (17-collections.md §3.9/§3.10)', () => {
  it('все 42 записи каталога запуска валидны по DecorItemDefSchema', () => {
    for (const item of decorItems) {
      const res = DecorItemDefSchema.safeParse(item)
      expect(res.success, res.success ? '' : res.error?.toString()).toBe(true)
    }
  })

  it('ровно 42 предмета в каталоге запуска (17-collections.md §3.9 итог)', () => {
    expect(decorItems.length).toBe(42)
  })

  it('ключи уникальны', () => {
    expect(() => assertUniqueKeys(decorItems.map((i) => i.key), 'decorItems')).not.toThrow()
  })

  it('распределение по линиям соответствует спеке (12/12/10/8)', () => {
    const byLine = new Map<string, number>()
    for (const item of decorItems) {
      byLine.set(item.line, (byLine.get(item.line) ?? 0) + 1)
    }
    expect(byLine.get('farmhouse')).toBe(12)
    expect(byLine.get('diner_chrome')).toBe(12)
    expect(byLine.get('route66_roadside')).toBe(10)
    expect(byLine.get('seasonal_event')).toBe(8)
  })
})
