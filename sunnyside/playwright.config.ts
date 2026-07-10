import { defineConfig, devices } from '@playwright/test'

// Смоук-прогоны ключевых экранов через ?screen= + мок-Supabase (21-client §3.10).
// Не полноценный e2e с живым бэкендом — только «сцена смонтировалась, нет console-error, клик отзывается».
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  // Дефолтные 5 с на assertion слишком тесны под полным параллельным прогоном: один Vite-dev
  // обслуживает десятки тяжёлых R3F-страниц разом, и отдельные мутации/монтирование сцены
  // под CPU-контеншном превышают 5 с (в изоляции — мгновенно). Даём запас, чтобы блуждающие
  // таймауты не давали ложных красных. Гейт C7 требует 100% зелень при full-parallel.
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:5199',
    trace: 'on-first-retry',
  },
  projects: [
    // Обычный desktop-смоук (smoke/screens/game-loop) — mobile.spec.ts сюда НЕ входит
    // (см. testIgnore): он сам переключает вьюпорт по ходу файла (`test.use({ viewport })` в
    // каждом describe), прогон под desktop Chrome эти переключения не осмыслен бы задваивал.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    // mobile-viewport (19-ui-ux §4.4 «мобильный браузер», задача mobile-responsive): смоук
    // всех панелей/HUD на телефонных вьюпортах — тач-эмуляция (`hasTouch`/`isMobile`, реальные
    // tap-события, не click), сам файл проверяет ОБА целевых вьюпорта (375×667 iPhone SE —
    // самый тесный частый размер, 390×844 iPhone 12/13/14) через `test.use({ viewport })`
    // внутри `describe`, так что довольно одного project — двух отдельных не заводим.
    {
      name: 'mobile-viewport',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    },
  ],
  // Vite dev-сервер: `import.meta.env.DEV === true` ⇒ `isDebugEnabled()` пропускает
  // дип-линки `?screen=`/`?panel=` (в prod-preview они игнорируются гейтом §3.8, C9,
  // и смоук всех экранов был бы невозможен). Local-адаптер — по умолчанию (нет Supabase URL).
  webServer: {
    command: 'pnpm dev --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
