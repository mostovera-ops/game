/**
 * smoke.spec.ts — пример Playwright-смоука (21-client §3.10). Не пиксельный e2e:
 * «сцена смонтировалась (canvas есть), нет console-error, ключевой DOM присутствует,
 * базовый клик даёт отклик». Прогон через ?screen= + мок-бэкенд (local-адаптер).
 *
 * Полные сценарии (farm/fair/shift/town/offline) дописывают e2e-агенты. Здесь — каркас.
 */

import { test, expect } from '@playwright/test'

test('ферма монтируется, бренд и canvas на месте, нет console-error', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  await page.goto('/?screen=farm')

  await expect(page.getByTestId('brand')).toHaveText('Sunnyside')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByTestId('scene-switch')).toBeVisible()

  // Базовый клик по переключателю сцен — отклик без ошибок.
  await page.getByTestId('scene-btn-fair').click()

  expect(errors, `console errors:\n${errors.join('\n')}`).toHaveLength(0)
})
