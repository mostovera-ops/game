/**
 * shop.test.ts — ShopSlice: pity-кэш, scrap-оценка, дневные счётчики бустеров.
 * Чистый редьюсер-смоук (node, без браузера), как store.test.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './index'
import { pityOrDefault, SCRAP_ON_DUPLICATE } from './shop'
import { initialPity } from '@/engine/collections'

describe('ShopSlice', () => {
  beforeEach(() => {
    useStore.setState({ shop: { prizePity: {}, scrap: 0, boosterUsageToday: {} } })
  })

  it('pityOrDefault возвращает initialPity, пока сервер ничего не прислал', () => {
    const pity = pityOrDefault(useStore.getState().shop.prizePity, 'toy_cosmos_57')
    expect(pity).toEqual(initialPity('toy_cosmos_57'))
  })

  it('setPrizePity сохраняет pityAfter от сервера, замещая локальный дефолт', () => {
    const pity = { series: 'toy_cosmos_57' as const, pullsSinceRare: 3, pullsSinceChase: 12, rareCap: 10, chaseCap: 40 }
    useStore.getState().setPrizePity(pity)
    expect(useStore.getState().shop.prizePity.toy_cosmos_57).toEqual(pity)
  })

  it('addScrapFromDuplicates суммирует scrap-выход по таблице редкостей', () => {
    useStore.getState().addScrapFromDuplicates(['common', 'rare'])
    expect(useStore.getState().shop.scrap).toBe(SCRAP_ON_DUPLICATE.common + SCRAP_ON_DUPLICATE.rare)
  })

  it('trySpendScrap списывает при достаточном балансе и отказывает иначе', () => {
    useStore.getState().addScrapFromDuplicates(['chase']) // 80
    expect(useStore.getState().trySpendScrap(70)).toBe(true)
    expect(useStore.getState().shop.scrap).toBe(10)
    expect(useStore.getState().trySpendScrap(70)).toBe(false)
    expect(useStore.getState().shop.scrap).toBe(10) // не списалось при отказе
  })

  it('recordBoosterUse инкрементирует счётчик по ключу дня', () => {
    useStore.getState().recordBoosterUse('bst_overtime:2026-07-10')
    useStore.getState().recordBoosterUse('bst_overtime:2026-07-10')
    expect(useStore.getState().shop.boosterUsageToday['bst_overtime:2026-07-10']).toBe(2)
  })
})
