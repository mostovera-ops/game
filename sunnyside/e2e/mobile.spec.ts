/**
 * mobile.spec.ts — Playwright-проект `mobile-viewport` (19-ui-ux §4.4 «мобильный браузер»,
 * задача mobile-responsive). Смоук ВСЕХ HUD/панелей на телефонных вьюпортах с тач-эмуляцией
 * (`hasTouch`/`isMobile`, playwright.config.ts) — не пиксельный дизайн-ревью (это design-review),
 * а структурная проверка:
 *   · нет горизонтального скролла страницы (панели/леттерборды скроллятся ВНУТРИ себя, не раздувая
 *     вьюпорт, см. `Modal.tsx` `max-h-[...]` + `overflow-y-auto`);
 *   · нижняя навигация видима целиком (не обрезана нижним краем/safe-area) и не перекрыта;
 *   · ключевые тач-таргеты (нижняя навигация, marquee-иконки, крестик Modal) ≥ 44×44 px;
 *   · каждая канон-панель открывается (deep-link `?panel=`), карточка не превышает высоту
 *     вьюпорта (внутренний скролл вместо раздутия страницы), закрывается по Escape;
 *   · переключение сцен настоящим `tap()` (не `click()`) работает, канвас переживает пересборку;
 *   · канвас держит `touch-action: none` (жесты орбит-камеры/pinch-zoom не утекают в скролл
 *     страницы — ставит сам `OrbitControls` при монтировании, three.js `OrbitControls.js`).
 *
 * Один project (`mobile-viewport`, playwright.config.ts) — оба целевых вьюпорта (§4.4) заданы
 * прямо в файле через `test.use({ viewport })` на каждый `describe`, так что отдельного второго
 * project под второй размер не заводим.
 *
 * Переиспользует `PANELS`/`SCENES`/`collectConsoleErrors` из `./shared.ts` (тот же канон-
 * список экранов/панелей, что и `screens.spec.ts` — одна точка правды, не дублируем при
 * добавлении новой панели).
 */

import { test, expect, type Page } from '@playwright/test'
import { collectConsoleErrors, PANELS, SCENES } from './shared'

const VIEWPORTS = [
  { label: '375×667 (iPhone SE)', width: 375, height: 667 },
  { label: '390×844 (iPhone 12/13/14)', width: 390, height: 844 },
] as const

/** Нет горизонтального скролла страницы — вся раскладка вмещается в вьюпорт (§4.4). */
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'document.documentElement.scrollWidth не должен превышать window.innerWidth').toBeLessThanOrEqual(1)
}

/** Bounding box элемента ≥ 44×44 px (тач-таргет, §4.4 «тач-правила: минимальный интерактив 44×44»). */
async function expectTapTarget(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox()
  expect(box, `элемент ${testId} должен быть на экране`).not.toBeNull()
  expect(box!.width, `${testId}: ширина тач-таргета < 44px`).toBeGreaterThanOrEqual(44)
  expect(box!.height, `${testId}: высота тач-таргета < 44px`).toBeGreaterThanOrEqual(44)
}

for (const viewport of VIEWPORTS) {
  test.describe(`вьюпорт ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('стартовый рендер: canvas, бренд, нижняя навигация — без горизонтального скролла', async ({ page }) => {
      const errors = collectConsoleErrors(page)
      await page.goto('/?screen=farm')

      await expect(page.getByTestId('brand')).toBeVisible()
      await expect(page.locator('canvas')).toBeVisible()
      await expect(page.getByTestId('scene-switch')).toBeVisible()
      await expectNoHorizontalOverflow(page)

      expect(errors, `console errors:\n${errors.join('\n')}`).toHaveLength(0)
    })

    test('нижняя навигация: тач-таргеты ≥44px, целиком видна и не залезает за нижний край вьюпорта', async ({
      page,
    }) => {
      await page.goto('/?screen=farm')

      for (const scene of SCENES.filter((s) => s !== 'shift')) {
        await expectTapTarget(page, `scene-btn-${scene}`)
      }

      const navBox = await page.getByTestId('scene-switch').boundingBox()
      expect(navBox).not.toBeNull()
      // Нижний край навигации — внутри вьюпорта (не обрезан/не заведён под системный жест-бар).
      expect(navBox!.y + navBox!.height).toBeLessThanOrEqual(viewport.height)
      expect(navBox!.y).toBeGreaterThan(0)
    })

    test('переключение сцен настоящим тапом (не click) работает, канвас переживает пересборку', async ({ page }) => {
      const errors = collectConsoleErrors(page)
      await page.goto('/?screen=farm')
      await expect(page.getByTestId('active-scene')).toHaveText('farm')

      for (const scene of ['town', 'fair', 'farm'] as const) {
        await page.getByTestId(`scene-btn-${scene}`).tap()
        await expect(page.getByTestId('active-scene')).toHaveText(scene)
        await expect(page.locator('canvas')).toBeVisible()
      }

      await expectNoHorizontalOverflow(page)
      expect(errors, `console errors:\n${errors.join('\n')}`).toHaveLength(0)
    })

    test('marquee-иконки (колокол/чат/звук) — тач-таргет ≥44px', async ({ page }) => {
      await page.goto('/?screen=farm')
      await expectTapTarget(page, 'notif-bell')
      await expectTapTarget(page, 'chat-launcher')
      await expectTapTarget(page, 'sound-settings-btn')
    })

    test('канвас: touch-action none где-то в цепочке предков (жесты орбит-камеры/pinch-zoom не утекают в скролл страницы)', async ({
      page,
    }) => {
      // Эффективный touch-action браузера — пересечение значения элемента И ВСЕХ его предков
      // (CSS Touch Action spec), а не только собственного computed-style канваса: r3f `<Canvas
      // style={...}>` кладёт пользовательский style на СВОЙ внешний wrapper-div (двумя уровнями
      // выше самого `<canvas>`, `react-three-fiber.esm.js`), не на сам элемент `<canvas>`, — но
      // для реального поведения тач-жестов это тот же эффект, что и `none` на самом канвасе.
      await page.goto('/?screen=farm')
      const hasNoneInChain = await page.locator('canvas').evaluate((el) => {
        let node: HTMLElement | null = el
        for (let i = 0; i < 6 && node; i++) {
          if (getComputedStyle(node).touchAction === 'none') return true
          node = node.parentElement
        }
        return false
      })
      expect(hasNoneInChain, 'ни канвас, ни его предки (до 6 уровней) не выставили touch-action:none').toBe(true)
    })

    test.describe('панели через ?panel=: карточка помещается по высоте, скроллится внутри себя, закрывается', () => {
      for (const panel of PANELS) {
        test(`«${panel}»: открыта, крестик ≥44px, нет горизонтального скролла, закрывается`, async ({ page }) => {
          const errors = collectConsoleErrors(page)
          await page.goto(`/?panel=${panel}`)

          await expect(page.getByTestId(`modal-${panel}`)).toBeVisible()
          await expectNoHorizontalOverflow(page)
          await expectTapTarget(page, `modal-close-${panel}`)

          // Карточка панели (role=dialog, Modal.tsx) сама ограничена по высоте (`max-h-[...]`)
          // и скроллится внутри себя — не раздувает страницу за пределы вьюпорта телефона.
          const dialogBox = await page.getByRole('dialog').boundingBox()
          expect(dialogBox, `панель ${panel}: role=dialog должен быть на экране`).not.toBeNull()
          expect(dialogBox!.height, `панель ${panel}: карточка выше вьюпорта`).toBeLessThanOrEqual(viewport.height)
          expect(dialogBox!.y, `панель ${panel}: карточка уходит выше вьюпорта`).toBeGreaterThanOrEqual(0)

          await page.keyboard.press('Escape')
          await expect(page.getByTestId(`modal-${panel}`)).toHaveCount(0)

          expect(errors, `console errors on ?panel=${panel}:\n${errors.join('\n')}`).toHaveLength(0)
        })
      }
    })

    test('панель ui_shift (fullscreen, сцена fair): крестик доступен тач-таргетом, без console-error', async ({
      page,
    }) => {
      const errors = collectConsoleErrors(page)
      await page.goto('/?screen=fair&panel=ui_shift')

      await expect(page.getByTestId('modal-ui_shift')).toBeVisible()
      await expectTapTarget(page, 'modal-close-ui_shift')
      await expectNoHorizontalOverflow(page)

      await page.keyboard.press('Escape')
      await expect(page.getByTestId('modal-ui_shift')).toHaveCount(0)

      expect(errors, `console errors on ?screen=fair&panel=ui_shift:\n${errors.join('\n')}`).toHaveLength(0)
    })
  })
}
