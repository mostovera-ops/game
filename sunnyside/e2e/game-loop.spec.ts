/**
 * game-loop.spec.ts — ГЛАВНЫЙ интеграционный e2e: ПОЛНЫЙ игровой цикл через UI на
 * local-адаптере с ускоренным временем (кнопка DevTimeskip). Один сквозной прогон:
 *
 *   seed picker → посадка → рост (таймскип) → сбор → крафт муки (кухня) →
 *   прилавок ярмарки → смена (shift_submit) → вклад в котёл ивента →
 *   проверка, что валюта (bucks) и XP выросли, мука скрафчена, personalFp вырос.
 *
 * ЧТО «через UI»: seed picker (посадка), DevTimeskip (рост/дозревание крафта), кухня
 * (K1 очереди → K2 картотека → «Готовить»/«Забрать»), смена у прилавка (старт → подача →
 * «Закончить» → shift_submit) — всё настоящий DOM.
 *
 * ЧТО через dev-мост `window.sunnyside` (App.tsx, только dev): сбор урожая — это POI-клик по
 * 3D-грядке (Playwright не бьёт по WebGL-объектам надёжно), а выкладка на прилавок и донат в
 * котёл в текущем UI гейтятся до готовых блюд (`dish_*`), тогда как ранний сток — полуфабрикат
 * `ingr_flour`. Эти три шва прогоняются через реальные системы движка (тот же путь, что покрыт
 * зелёным `app/integration.test.ts`), но в живом браузерном приложении: настоящие стор,
 * адаптер, бутстрап, гидрация. Экономику считает сервер (адаптер), клиент только наблюдает.
 *
 * Local-адаптер по умолчанию (нет Supabase URL); `?screen=farm` пропускает FTUE (§3.8).
 */

import { test, expect, type Page } from '@playwright/test'

interface Snap {
  bucks: number
  xp: number
  farmLevel: number
  wheat: number
  flour: number
  personalFp: number
  growing: number
}

/** Слепок серверной истины из живого стора (через dev-мост window.sunnyside). */
async function snapshot(page: Page): Promise<Snap> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (window as any).sunnyside.useStore.getState()
    return {
      bucks: s.econ.wallet.bucks as number,
      xp: (s.progression?.xp ?? 0) as number,
      farmLevel: (s.progression?.farmLevel ?? 1) as number,
      wheat: (s.inventory?.items?.crop_wheat ?? 0) as number,
      flour: (s.inventory?.items?.ingr_flour ?? 0) as number,
      personalFp: (s.event?.personalFp ?? 0) as number,
      growing: (s.farm?.plots?.filter((p: { state: string }) => p.state === 'growing').length ?? 0) as number,
    }
  })
}

/** Кликнуть DevTimeskip (+1ч к clock.serverOffset) n раз — дозревает грядки/крафт/ярмарку. */
async function timeskip(page: Page, n = 1): Promise<void> {
  for (let i = 0; i < n; i++) await page.getByTestId('dev-timeskip').click()
}

/** id стартовой печи (mch_oven) из стора — строки станков адресуются по нему. */
async function ovenId(page: Page): Promise<string> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (window as any).sunnyside.useStore.getState()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return s.farm.machines.find((m: any) => m.key === 'mch_oven').id as string
  })
}

test('полный игровой цикл: посадка → сбор → крафт → прилавок → смена → ивент, валюта и XP растут', async ({
  page,
}) => {
  // Самый тяжёлый смоук (посадка→сбор→крафт→прилавок→смена→ивент, R3F-сцена + гидрация).
  // В изоляции ~55–60 с; под нагрузкой полного параллельного прогона один Vite-dev обслуживает
  // десятки тяжёлых страниц разом → даём двойной запас, чтобы контеншн не давал ложных таймаутов.
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(String(e)))

  // ── Бутстрап: ферма смонтирована, dev-мост систем и гидрация фермы готовы ──
  await page.goto('/?screen=farm')
  await expect(page.getByTestId('brand')).toHaveText('Sunnyside')
  await expect(page.locator('canvas')).toBeVisible()
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const w = (window as any).sunnyside
          return !!w?.systems?.farm && !!w.useStore.getState().farm && !!w.useStore.getState().progression
        }),
      // Бутстрап R3F-сцены + гидрация под нагрузкой полного параллельного прогона может
      // превысить дефолтные 5 с poll (тест сам живёт в бюджете 90 с) — даём запас.
      { timeout: 30_000 },
    )
    .toBe(true)
  // Онлайн (мутации уходят на адаптер, а не остаются оптимистичным кэшем).
  await page.evaluate(() => (window as any).sunnyside.useStore.getState().setOnline(true)) // eslint-disable-line @typescript-eslint/no-explicit-any

  const before = await snapshot(page)
  expect(before.growing).toBe(0)

  // ── 1. ПОСАДКА (seed picker, настоящий DOM). 4 грядки пшеницы → 4 сырья → 2 партии муки ──
  const SOW = 4
  for (let slot = 0; slot < SOW; slot++) {
    await page.evaluate((s) => (window as any).sunnyside.useStore.getState().setSeedPickerSlot(s), slot) // eslint-disable-line @typescript-eslint/no-explicit-any
    await expect(page.getByTestId('seed-picker')).toBeVisible()
    await page.getByTestId('seed-picker-option-seed_wheat').click()
    // Seed Picker закрывается только при успешном посеве через адаптер (истина сервера).
    await expect(page.getByTestId('seed-picker')).toBeHidden()
  }
  await expect.poll(async () => (await snapshot(page)).growing).toBe(SOW)

  // ── 2. РОСТ: ускоряем время (пшеница 12 мин ≪ 2ч) ──
  await timeskip(page, 2)

  // ── 3. СБОР (POI-клик по грядке → dev-мост систем): сырьё в инвентарь, XP растёт ──
  await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = (window as any).sunnyside
    const st = w.useStore.getState()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = st.farm.plots.filter((p: any) => p.state === 'growing').map((p: any) => p.id)
    await w.systems.farm.harvest(ids)
  })
  await expect.poll(async () => (await snapshot(page)).wheat).toBeGreaterThanOrEqual(SOW)

  // ── 4. КРАФТ МУКИ (кухня, настоящий DOM). Печь Ур.1 = 1 слот → две партии по очереди ──
  const oven = await ovenId(page)
  for (let batch = 0; batch < 2; batch++) {
    // Открыть Kitchen-панель (POI-клик по станку в сцене вызывает тот же openPanel).
    await page.evaluate(() => (window as any).sunnyside.useStore.getState().openPanel('ui_recipe_box')) // eslint-disable-line @typescript-eslint/no-explicit-any
    await expect(page.getByTestId('machine-queues')).toBeVisible()
    // K1 «Поставить» → K2 картотека, отфильтрованная под печь.
    await page.getByTestId(`machine-queue-btn-${oven}`).click()
    await expect(page.getByTestId('recipe-box')).toBeVisible()
    // «Готовить» на карточке Муки (starter, есть пшеница×2 → кнопка активна).
    const flourCard = page.getByTestId('recipe-card-rcp_ingr_flour')
    await flourCard.getByTestId('recipe-cook-btn').click()
    // Партия встала в очередь печи (craft_start списал пшеницу на сервере).
    await expect
      .poll(async () =>
        page.evaluate((id) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const m = (window as any).sunnyside.useStore.getState().farm.machines.find((x: any) => x.id === id)
          return (m?.jobs?.length ?? 0) as number
        }, oven),
      )
      .toBeGreaterThan(0)
    // Закрыть панель, ускорить время (мука 5 мин ≪ 1ч), забрать в K1.
    await page.evaluate(() => (window as any).sunnyside.useStore.getState().openPanel(null)) // eslint-disable-line @typescript-eslint/no-explicit-any
    await timeskip(page, 1)
    await page.evaluate(() => (window as any).sunnyside.useStore.getState().openPanel('ui_recipe_box')) // eslint-disable-line @typescript-eslint/no-explicit-any
    const collectBtn = page.getByTestId(`machine-collect-btn-${oven}`)
    await expect(collectBtn).toBeEnabled()
    await collectBtn.click()
    await expect.poll(async () => (await snapshot(page)).flour).toBe(batch + 1)
    await page.evaluate(() => (window as any).sunnyside.useStore.getState().openPanel(null)) // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  const afterCraft = await snapshot(page)
  expect(afterCraft.flour).toBe(2)
  expect(afterCraft.xp).toBeGreaterThan(before.xp) // сбор + крафт уже начислили XP

  // ── 5. ПРИЛАВОК ЯРМАРКИ (dish-гейт UI → dev-мост систем): выкладываем муку, пассивная
  //       продажа за окно наполняет кошелёк (istina сервера через гидрацию после таймскипа) ──
  await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = (window as any).sunnyside
    const stallId = w.useStore.getState().fair.stall.id
    await w.systems.fair.open(stallId)
    await w.systems.fair.list({ stallId, lots: [{ itemKey: 'ingr_flour', qty: 1, quality: 1, price: 10 }] })
  })
  const bucksBeforeFair = (await snapshot(page)).bucks
  await timeskip(page, 2) // окно ярмарки капает; clock-resync перегидрирует кошелёк
  await expect.poll(async () => (await snapshot(page)).bucks).toBeGreaterThan(bucksBeforeFair)

  // ── 6. СМЕНА У ПРИЛАВКА (настоящий DOM, shift_submit). Переходим на ярмарку, стартуем смену,
  //       подаём хотя бы одного гостя (XP от «подано»), затем «Закончить» → shift_submit ──
  await page.getByTestId('scene-btn-fair').click()
  await expect(page.getByTestId('active-scene')).toHaveText('fair')
  const xpBeforeShift = (await snapshot(page)).xp
  await page.evaluate(() => (window as any).sunnyside.useStore.getState().openPanel('ui_shift')) // eslint-disable-line @typescript-eslint/no-explicit-any
  await expect(page.getByTestId('shift-screen')).toBeVisible()

  // Best-effort подача: для активного гостя перебираем сток, оставляя ту раскладку, при которой
  // «Подать» активна (совпадение по тирам, session.trayMatches). Никогда не валит тест (P3 —
  // провала нет): даже без подачи «Закончить» всё равно шлёт shift_submit.
  const served = await serveOneGuest(page)

  await page.getByTestId('shift-end').click()
  // Чек напечатан → shift_submit ушёл на адаптер (served → XP на сервере).
  await expect(page.getByTestId('shift-receipt')).toBeVisible()
  await page.getByTestId('receipt-close').click()

  // ── 7. ВКЛАД В КОТЁЛ ИВЕНТА (dish-гейт UI → dev-мост систем): донат оставшейся муки,
  //       personalFp растёт (канал donate ценнее продажи) ──
  await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = (window as any).sunnyside
    await w.systems.event.contribute('ingr_flour', 1, 'donate')
  })

  // ── 8. ИТОГ: валюта и XP выросли за цикл, мука израсходована, вклад в ивент засчитан ──
  const after = await snapshot(page)
  expect(after.bucks).toBeGreaterThan(before.bucks)
  expect(after.xp).toBeGreaterThan(before.xp)
  expect(after.xp).toBeGreaterThanOrEqual(xpBeforeShift) // смена не уменьшила XP
  expect(after.personalFp).toBeGreaterThan(before.personalFp)
  expect(after.flour).toBe(0) // 1 на прилавок + 1 в котёл
  expect(errors, `console errors:\n${errors.join('\n')}`).toHaveLength(0)

  // Точные числа — в лог прогона (reporter=list) для отчёта интегратора.
  // eslint-disable-next-line no-console
  console.log(
    'GAME_LOOP_NUMBERS ' +
      JSON.stringify({ before, afterCraft, servedInShift: served, after }),
  )
})

/**
 * Пытается собрать поднос под активный заказ и подать. Возвращает true при успешной подаче.
 * Дожидается появления гостя (спавн очереди во времени), затем перебирает чипы стока: для
 * каждого добавляет его на поднос до 3 раз (одиночные/повторные заказы одного тира), проверяя
 * после каждого добавления, стала ли «Подать» активной (совпадение по тирам, session.trayMatches).
 * Не совпало — очищает поднос и пробует следующий чип. Best-effort (P3 — провала нет): даже без
 * подачи «Закончить» всё равно шлёт shift_submit, тест на этом не падает.
 */
async function serveOneGuest(page: Page): Promise<boolean> {
  const serve = page.getByTestId('shift-serve')
  const stock = page.getByTestId('shift-stock')
  // Первый гость фазы разогрева спавнится на ~8-й секунде смены (spawnIntervalSec=8, §3.5) —
  // ждём его с запасом. Заказы разогрева одиночные (min=max=1 блюдо), матч по тиру тривиален.
  try {
    await page.getByTestId('shift-guest').first().waitFor({ state: 'visible', timeout: 15000 })
  } catch {
    return false
  }
  const clearTray = async () => {
    const tray = page.getByTestId('shift-tray').locator('button')
    for (let n = await tray.count(); n > 0; n = await tray.count()) await tray.nth(n - 1).click()
  }
  const count = await stock.count()
  for (let i = 0; i < count; i++) {
    await clearTray()
    for (let add = 0; add < 3; add++) {
      await stock.nth(i).click()
      if (await serve.isEnabled()) {
        await serve.click()
        return true
      }
    }
  }
  await clearTray()
  return false
}
