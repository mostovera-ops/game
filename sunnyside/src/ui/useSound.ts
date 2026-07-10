/**
 * ui/useSound.ts — единая точка входа для игровых триггеров звука (audio-wiring,
 * 22-audio-visual.md §SFX/§7.3). Тонкая обёртка над синтез-стабами `assets/placeholders/
 * sound.ts`: call-сайты в сценах/HUD называют ДОМЕННОЕ событие (`'harvest'`, `'sale'`…),
 * не низкоуровневую `SfxCategory` — так замена синтеза на реальные сэмплы (Фаза D) не
 * требует трогать сцену/HUD, только эту карту.
 *
 * ЗАЧЕМ ХУК, А НЕ ПРЯМОЙ ИМПОРТ `playSfx` ВЕЗДЕ: одна точка для будущих правок (напр.
 * per-event cooldown/дедуп) и единый грепаемый список игровых звуковых триггеров —
 * AGENTS.md «не размазывай по 50 файлам». Системные/фоновые триггеры (музыка по сцене/
 * фазе, эмбиент, вехи ивента, смена фазы недели, громкость шин) не идут через
 * компонентные call-сайты вообще — их ведёт `app/soundBridge.ts` (событийная шина
 * поверх стора), это модуль — только для реакций на явные действия игрока/UI.
 *
 * ГРАНИЦА: `ui/` — ноль three/net (AGENTS.md §3). Импортирует только assets/placeholders
 * (лист, как `PlaceholderMesh`/`registry`) — не `@/state`, не `@/net`.
 */

import { playSfx, type SfxCategory } from '@/assets/placeholders/sound'

/**
 * Доменные звуковые события игрока/UI (не путать с `SfxCategory` — той владеет синтез).
 * Список — 1:1 с триггерами задачи audio-wiring: сбор/полив/посев, крафт-готово, продажа/
 * чаевые смены, клики UI, мягкая ошибка UI, уведомления (почта/сосед/джукбокс).
 */
export type SoundEvent =
  | 'sow'
  | 'water'
  | 'harvest'
  | 'feed'
  | 'craft_ready'
  | 'sale'
  | 'tip_bonus'
  | 'event_milestone'
  | 'contest_win'
  | 'ui_click'
  | 'ui_error'
  | 'notification_mail'
  | 'notification_neighbor'
  | 'notification_jukebox'
  | 'week_phase'

const EVENT_TO_SFX: Record<SoundEvent, SfxCategory> = {
  sow: 'farm_action',
  water: 'farm_action',
  harvest: 'farm_action',
  feed: 'animals_generic',
  craft_ready: 'cooking_ready',
  sale: 'diner_cash',
  tip_bonus: 'sale_mastery',
  event_milestone: 'event_milestone',
  contest_win: 'contest_win',
  ui_click: 'ui_success',
  ui_error: 'ui_error',
  notification_mail: 'notification_mail',
  notification_neighbor: 'notification_neighbor',
  notification_jukebox: 'notification_jukebox',
  week_phase: 'week_phase_change',
}

export interface UseSound {
  /** Проиграть доменное звуковое событие (no-op тишина, пока звук не разблокирован жестом). */
  play: (event: SoundEvent) => void
}

function play(event: SoundEvent): void {
  playSfx(EVENT_TO_SFX[event])
}

/** Стабильная (module-level) ссылка — безопасно класть в deps `useMemo`/`useCallback`
 * без инвалидации на каждый рендер (звук — рантайм-синглтон, не React-состояние). */
const STABLE: UseSound = { play }

/**
 * Хук доступа к звуку из компонентов сцены/HUD. Не хранит React-состояние — просто даёт
 * стабильную, легко мокаемую в тестах точку вызова вместо прямого импорта `playSfx` в
 * каждом файле.
 */
export function useSound(): UseSound {
  return STABLE
}
