// Проверка клика по слоту: проецируем мировую позицию слота в пиксель,
// кликаем по канвасу, смотрим, что состояние в сторе изменилось.
// node tools/_clicktest.cjs <url>
const { chromium } = require('/opt/node22/lib/node_modules/playwright')
const URL = process.argv[2] || 'http://localhost:4175/'

;(async () => {
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist', '--no-sandbox'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !!(window.__game && window.__r3f), { timeout: 30000 })
  await page.waitForTimeout(1200)

  // Свежая игра, целевой слот 1:0.
  const SLOT = '1:0'
  const pt = await page.evaluate((slotId) => {
    const store = window.__game
    store.getState().resetGame()
    store.getState().selectSeed('carrot')
    // мировая позиция слота из scene-layout
    return fetch('/assets/scene-layout.json').then((r) => r.json()).then((layout) => {
      const [bed, si] = slotId.split(':').map(Number)
      const plot = layout.plots.find((p) => p.id === bed)
      const pos = plot.slots[si]
      return window.__r3f.project(pos[0], pos[1] + 0.25, pos[2]) // целимся в центр хитбокса
    })
  }, SLOT)

  const state = async () => page.evaluate((s) => {
    const slot = window.__game.getState().slots.find((x) => x.id === s)
    return { crop: slot.crop, stage: slot.stage, watered: slot.watered }
  }, SLOT)

  console.log('slot pixel:', JSON.stringify(pt))
  console.log('before   :', JSON.stringify(await state()))

  await page.mouse.click(pt.x, pt.y)
  await page.waitForTimeout(200)
  console.log('after 1  :', JSON.stringify(await state()), '(ожидаем: посажена carrot, stage 0)')

  await page.mouse.click(pt.x, pt.y)
  await page.waitForTimeout(200)
  console.log('after 2  :', JSON.stringify(await state()), '(ожидаем: watered=true)')

  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
