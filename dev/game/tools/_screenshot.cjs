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
  await page.waitForTimeout(2000)

  const stats = await page.evaluate(() => window.__render || null)
  await page.screenshot({ path: OUT })
  console.log('render stats:', JSON.stringify(stats))
  if (errors.length) console.log('console errors:\n  ' + errors.slice(0, 12).join('\n  '))
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
