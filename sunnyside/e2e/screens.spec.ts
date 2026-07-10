/**
 * screens.spec.ts — расширенный Playwright-смоук всех экранов (AGENTS.md §4 уровень 2,
 * 21-client §3.10). Каркас в `smoke.spec.ts` покрывает ферму; здесь — ПОЛНЫЙ обход:
 *   · стартовый рендер (canvas + бренд + навигация смонтированы),
 *   · каждая из 4 сцен через `?screen=` (farm/town/fair/shift),
 *   · переключение сцен кликом по нижней навигации (farm↔town↔fair),
 *   · каждая канон-панель `ui_*` через `?panel=` (модалка видима, DOM смонтирован).
 *
 * Дип-линки `?screen=`/`?panel=` работают только при `isDebugEnabled()` (§3.8): под
 * vite dev (`import.meta.env.DEV`) — да; local-адаптер по умолчанию (нет Supabase URL).
 * Не пиксельно (это дизайн-ревью) — только «смонтировалось, нет console-error, ключевой
 * `data-testid` на месте, базовый клик отзывается».
 */

import { test, expect } from '@playwright/test'
import { collectConsoleErrors, PANELS, SCENES } from './shared'

test.describe('стартовый рендер', () => {
  test('приложение поднимается: canvas, бренд и навигация на месте, нет console-error', async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page)
    await page.goto('/')

    await expect(page.getByTestId('brand')).toHaveText('Sunnyside')
    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.getByTestId('scene-switch')).toBeVisible()
    // Дефолтная сцена — ферма (scene-слайс), пока игрок не перешёл.
    await expect(page.getByTestId('active-scene')).toHaveText('farm')

    expect(errors, `console errors:\n${errors.join('\n')}`).toHaveLength(0)
  })
})

test.describe('сцены через ?screen=', () => {
  for (const scene of SCENES) {
    test(`сцена «${scene}» монтируется через ?screen=${scene}`, async ({ page }) => {
      const errors = collectConsoleErrors(page)
      await page.goto(`/?screen=${scene}`)

      // HUD жив (бренд), 3D-канвас смонтирован, активная сцена = запрошенной.
      await expect(page.getByTestId('brand')).toHaveText('Sunnyside')
      await expect(page.locator('canvas')).toBeVisible()
      await expect(page.getByTestId('active-scene')).toHaveText(scene)

      expect(errors, `console errors on ?screen=${scene}:\n${errors.join('\n')}`).toHaveLength(0)
    })
  }
})

test.describe('переключение сцен кликом', () => {
  test('нижняя навигация: farm → town → fair → farm, канвас пересобирается без ошибок', async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page)
    await page.goto('/?screen=farm')
    await expect(page.getByTestId('active-scene')).toHaveText('farm')

    for (const scene of ['town', 'fair', 'farm'] as const) {
      await page.getByTestId(`scene-btn-${scene}`).click()
      await expect(page.getByTestId('active-scene')).toHaveText(scene)
      await expect(page.locator('canvas')).toBeVisible()
    }

    expect(errors, `console errors:\n${errors.join('\n')}`).toHaveLength(0)
  })
})

test.describe('панели через ?panel=', () => {
  for (const panel of PANELS) {
    test(`панель «${panel}» открывается через ?panel=${panel}`, async ({ page }) => {
      const errors = collectConsoleErrors(page)
      await page.goto(`/?panel=${panel}`)

      // Модалка панели смонтирована и видима (единый каркас Modal → data-testid=modal-<key>).
      await expect(page.getByTestId(`modal-${panel}`)).toBeVisible()
      // Крестик закрытия отрисован (interactive-якорь). Само закрытие проверяем через
      // Escape (правило навигации Modal) — не зависит от вьюпорта: у высоких sheet-панелей
      // хедер уходит выше кромки экрана, и клик по крестику был бы флаки.
      await expect(page.getByTestId(`modal-close-${panel}`)).toBeAttached()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId(`modal-${panel}`)).toHaveCount(0)

      expect(errors, `console errors on ?panel=${panel}:\n${errors.join('\n')}`).toHaveLength(0)
    })
  }
})

test.describe('панель ui_shift через ?panel= на сцене fair', () => {
  test('панель «ui_shift» открывается через ?screen=fair&panel=ui_shift', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await page.goto('/?screen=fair&panel=ui_shift')

    // Модалка панели смонтирована и видима (общий каркас Modal → data-testid=modal-<key>),
    // хотя сама она собрана в ui/shift/ShiftHost, а не в PanelHost.
    await expect(page.getByTestId('modal-ui_shift')).toBeVisible()
    await expect(page.getByTestId('modal-close-ui_shift')).toBeAttached()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('modal-ui_shift')).toHaveCount(0)

    expect(errors, `console errors on ?screen=fair&panel=ui_shift:\n${errors.join('\n')}`).toHaveLength(0)
  })
})
