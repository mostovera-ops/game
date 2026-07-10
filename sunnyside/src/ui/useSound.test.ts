/**
 * useSound.test.ts — маппинг доменных событий (audio-wiring) на низкоуровневые SfxCategory.
 * Мокаем `assets/placeholders/sound` целиком — не проверяем сам синтез (см. `sound.test.ts`),
 * только то, что каждое доменное событие зовёт ОЖИДАЕМУЮ категорию (grep-контракт задачи:
 * сбор/полив/посев → farm_action, крафт-готово → cooking_ready, продажа → diner_cash…).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSound } from './useSound'

vi.mock('@/assets/placeholders/sound', () => ({
  playSfx: vi.fn(),
}))

import { playSfx } from '@/assets/placeholders/sound'

describe('useSound — доменное событие → SfxCategory', () => {
  beforeEach(() => {
    vi.mocked(playSfx).mockClear()
  })

  it.each([
    ['sow', 'farm_action'],
    ['water', 'farm_action'],
    ['harvest', 'farm_action'],
    ['feed', 'animals_generic'],
    ['craft_ready', 'cooking_ready'],
    ['sale', 'diner_cash'],
    ['tip_bonus', 'sale_mastery'],
    ['event_milestone', 'event_milestone'],
    ['contest_win', 'contest_win'],
    ['ui_click', 'ui_success'],
    ['ui_error', 'ui_error'],
    ['notification_mail', 'notification_mail'],
    ['notification_neighbor', 'notification_neighbor'],
    ['notification_jukebox', 'notification_jukebox'],
    ['week_phase', 'week_phase_change'],
  ] as const)('play(%s) → playSfx(%s)', (event, category) => {
    useSound().play(event)
    expect(playSfx).toHaveBeenCalledWith(category)
  })

  it('возвращает стабильную ссылку между вызовами (безопасно в deps useMemo)', () => {
    expect(useSound()).toBe(useSound())
  })
})
