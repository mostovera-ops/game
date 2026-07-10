/**
 * shared.ts — общие фикстуры Playwright-смоуков (AGENTS.md §4 уровень 2): список сцен/канон-
 * панелей и хелпер сбора console-error. НЕ файл-спека (без `.spec.ts` — Playwright не даёт
 * одному спек-файлу импортировать другой, "test file should not import test file", поэтому
 * общие константы вынесены сюда, а `screens.spec.ts`/`mobile.spec.ts` оба берут их отсюда —
 * одна точка правды при добавлении новой панели, не дублируем список в двух местах).
 */

import type { Page } from '@playwright/test'

/** Подписка на console-error страницы. Возвращает массив, наполняемый по ходу теста. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(String(e)))
  return errors
}

/** 4 сцены-корня (canon §3.12, SCENE_KEYS). Ровно один <Canvas> на активную. */
export const SCENES = ['farm', 'town', 'fair', 'shift'] as const

/**
 * Канон-панели `ui_*`, реально смонтированные в модальном каркасе (PanelHost + OverlayHost
 * для ui_notif_log). Четыре ключа (ui_daily_specials/ui_moving_truck/ui_regulars_club/
 * ui_expeditions) — задокументированный TODO профильных ui-агентов, ещё не монтируются,
 * поэтому в смоук не включены.
 *
 * `ui_shift` — унифицирован на общем `Modal`/`ui.activePanel` (modal-unify), но своя Modal
 * смонтирована не в `PanelHost`, а в `ui/shift/ShiftHost` (вариант `fullscreen`), которую
 * монтирует ТОЛЬКО сцена ярмарки (`scene/fair/FairScene.tsx`) — проверяется отдельно, с
 * `?screen=fair`, см. соответствующие тесты в `screens.spec.ts`/`mobile.spec.ts`.
 */
export const PANELS = [
  'ui_notif_log',
  'ui_shop',
  'ui_demand_board',
  'ui_coop_orders',
  'ui_potluck',
  'ui_recipe_box',
  'ui_fair_stall',
  'ui_appetite_meter',
  'ui_prize_machine',
  'ui_route_pass',
  'ui_neon_builder',
  'ui_toy_shelf',
  'ui_ribbon_wall',
  'ui_postcards',
  'ui_photo_mode',
] as const
