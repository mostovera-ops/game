// Headless-скриншот собранной игры. Не часть игры — dev-утилита.
// node tools/_screenshot.cjs <url> <out.png>
const { chromium } = require('/opt/node22/lib/node_modules/playwright')

const URL = process.argv[2] || 'http://localhost:4173/'
const OUT = process.argv[3] || 'farm.png'

;(async () => {
  const browser = await chromium.launch({
    args: [
      '--use-angle=swiftshader',
      '--use-gl=angle',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
    ],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  try {
    await page.waitForFunction(() => window.__render && window.__render.calls > 0, { timeout: 30000 })
  } catch {
    console.log('WARN: __render.calls stayed 0 (scene may not have rendered)')
  }

  if (process.argv[4] === 'seed') {
    await page.waitForFunction(() => !!window.__game, { timeout: 10000 })
    await page.evaluate(() => {
      const store = window.__game
      const preset = {
        '0:0': { crop: 'carrot', stage: 2, watered: true },
        '0:1': { crop: 'greens', stage: 1, watered: true },
        '0:2': { crop: 'tomato', stage: 2, watered: false },
        '1:0': { crop: 'carrot', stage: 1, watered: false },
        '1:2': { crop: 'greens', stage: 0, watered: true },
        '2:1': { crop: 'tomato', stage: 2, watered: true },
      }
      store.setState({
        day: 3,
        money: 0,
        inventory: { carrot: 2, greens: 1, tomato: 3 },
        slots: store.getState().slots.map((s) => (preset[s.id] ? { ...s, ...preset[s.id] } : s)),
      })
    })
  }

  if (process.argv[4] === 'truck') {
    await page.waitForFunction(() => !!window.__game, { timeout: 10000 })
    await page.evaluate(() => {
      const store = window.__game
      store.setState({
        day: 7,
        phase: 'truck',
        money: 22,
        inventory: { carrot: 4, greens: 3, tomato: 3 },
        truck: {
          timeLeft: 45,
          queue: [
            { want: 'taco', patience: 13, maxPatience: 16 },
            { want: 'soup', patience: 8, maxPatience: 16 },
            { want: 'salad', patience: 4, maxPatience: 16 },
          ],
          served: 2,
          spawnTimer: 0,
          nextSpawnIn: 3,
          ended: false,
        },
      })
    })
    await page.waitForTimeout(2200) // дать камере доехать до фудтрека
  }

  await page.waitForTimeout(2500)

  const stats = await page.evaluate(() => window.__render || null)
  await page.screenshot({ path: OUT })
  console.log('render stats:', JSON.stringify(stats))
  if (errors.length) console.log('console errors:\n  ' + errors.slice(0, 12).join('\n  '))
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
