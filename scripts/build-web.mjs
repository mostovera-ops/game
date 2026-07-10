#!/usr/bin/env node
/**
 * build-web.mjs — оркестратор сборки для Vercel.
 *
 * Собирает ДВЕ независимые игры в единое дерево dist/:
 *   dist/                — статичная страница-развилка (web/landing/index.html)
 *   dist/classic/        — «классика» второго разработчика (корневой Vite-проект, base=/)
 *   dist/sunnyside/      — наша игра (sunnyside/, base=/sunnyside/)
 *
 * Идемпотентно, Node ≥ 18, без внешних зависимостей (только node:*).
 * Запуск: `node scripts/build-web.mjs` из корня репо.
 */

import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  rmSync,
  cpSync,
  renameSync,
  readdirSync,
  readFileSync,
} from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DIST = join(ROOT, 'dist')
const DIST_CLASSIC = join(DIST, 'classic')
const DIST_SUNNY = join(DIST, 'sunnyside')

/** Печать шага с разделителем — читаемый лог в Vercel. */
function step(msg) {
  process.stdout.write(`\n\x1b[1m▶ ${msg}\x1b[0m\n`)
}

/**
 * Запуск команды с наследованием stdio. Бросает при ненулевом коде —
 * чтобы Vercel-сборка падала явно, а не отдавала полупустое дерево.
 */
function run(cmd, args, cwd) {
  process.stdout.write(`  $ ${cmd} ${args.join(' ')}  (cwd: ${cwd})\n`)
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    // pnpm/vite ставятся как .cmd на Windows; shell:true делает вызов кросс-платформенным.
    shell: process.platform === 'win32',
  })
  if (res.status !== 0) {
    throw new Error(`Команда провалилась (код ${res.status}): ${cmd} ${args.join(' ')}`)
  }
}

/** Пустая директория назначения — идемпотентность: повторный прогон не копит мусор. */
function freshDir(dir) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
}

// ─────────────────────────────────────────────────────────────────────────────
// Старт
// ─────────────────────────────────────────────────────────────────────────────
step('build-web: старт единого дерева dist/')
freshDir(DIST)

// ─────────────────────────────────────────────────────────────────────────────
// (а) КЛАССИКА — корневой проект второго разработчика. base=/ НЕ меняем:
//     он собирается ровно как `pnpm build`, а мы лишь перекладываем результат
//     в dist/classic/. Ассеты у него абсолютные (/assets/*) — под /classic/
//     страница подтягивает их с корня, где лежит и наш landing; они не конфликтуют,
//     так как имена ассетов хешированы. Проверяем факт ниже.
// ─────────────────────────────────────────────────────────────────────────────
step('(а) Классика: pnpm install + pnpm build (корень, base=/)')
run('pnpm', ['install'], ROOT)
run('pnpm', ['build'], ROOT)

// Корневой vite кладёт всё в dist/ (тот же, что мы только что создали).
// Забираем index.html + сопутствующие статик-файлы в dist/classic/, оставив dist/
// под landing и подпапки игр. Ассеты (dist/assets/*) остаются на месте — они
// адресуются классикой как /assets/* и должны жить в корне выдачи.
step('    Перенос собранной классики в dist/classic/')
freshDir(DIST_CLASSIC)
const rootHtml = join(DIST, 'index.html')
if (!existsSync(rootHtml)) {
  throw new Error('Ожидался dist/index.html после корневой сборки — не найден.')
}
// index.html классики → dist/classic/index.html
renameSync(rootHtml, join(DIST_CLASSIC, 'index.html'))

// Факт-проверка: ассеты классики абсолютные (/assets/*), значит должны остаться
// в корне dist/. Если бы vite положил их относительно — план переноса был бы иным.
const classicHtml = readFileSync(join(DIST_CLASSIC, 'index.html'), 'utf8')
const absAssetRefs = [...classicHtml.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1])
process.stdout.write(
  `    Абсолютные ссылки в classic/index.html: ${
    absAssetRefs.length ? absAssetRefs.join(', ') : '(нет)'
  }\n`,
)
for (const ref of absAssetRefs) {
  // ref вида "/assets/index-xxxx.js" → проверяем, что файл реально лежит в dist/<ref>.
  const onDisk = join(DIST, ref.replace(/^\//, ''))
  if (!existsSync(onDisk)) {
    throw new Error(
      `Классика ссылается на ${ref}, но файла нет в dist (${onDisk}). ` +
        `Проверь base/переклад ассетов.`,
    )
  }
}
process.stdout.write('    OK: все абсолютные ассеты классики присутствуют в корне dist/.\n')

// ─────────────────────────────────────────────────────────────────────────────
// (б) SUNNYSIDE — наша игра, base=/sunnyside/. Собираем как их build-скрипт
//     (tsc -b затем vite build), но с переопределённым base под подпуть.
// ─────────────────────────────────────────────────────────────────────────────
step('(б) Sunnyside: pnpm install + tsc -b + vite build --base=/sunnyside/')
// --ignore-workspace: в корне лежит pnpm-workspace.yaml второго разработчика,
// делающий корень workspace-рутом. sunnyside в нём НЕ член, поэтому обычный
// `pnpm install` внутри sunnyside/ ставит НОЛЬ зависимостей (пустой node_modules)
// и весь tsc падает «Cannot find module». --ignore-workspace ставит собственный
// package.json игры автономно. --prod=false — форсим devDependencies (tsc, vite,
// @types/*, testing-library) даже при NODE_ENV=production, который Vercel задаёт.
run('pnpm', ['install', '--ignore-workspace', '--prod=false'], join(ROOT, 'sunnyside'))
// tsc -b — как в sunnyside "build": сначала типы (strict-гейт), затем бандл.
run('pnpm', ['exec', 'tsc', '-b'], join(ROOT, 'sunnyside'))
run('pnpm', ['exec', 'vite', 'build', '--base=/sunnyside/'], join(ROOT, 'sunnyside'))

step('    Копирование sunnyside/dist/* в dist/sunnyside/')
const sunnyBuilt = join(ROOT, 'sunnyside', 'dist')
if (!existsSync(join(sunnyBuilt, 'index.html'))) {
  throw new Error('Ожидался sunnyside/dist/index.html после сборки — не найден.')
}
freshDir(DIST_SUNNY)
for (const entry of readdirSync(sunnyBuilt)) {
  cpSync(join(sunnyBuilt, entry), join(DIST_SUNNY, entry), { recursive: true })
}
process.stdout.write('    OK: sunnyside скопирован в dist/sunnyside/.\n')

// ─────────────────────────────────────────────────────────────────────────────
// (в) LANDING — статичная развилка в корень выдачи.
// ─────────────────────────────────────────────────────────────────────────────
step('(в) Landing: web/landing/index.html → dist/index.html')
const landingSrc = join(ROOT, 'web', 'landing', 'index.html')
if (!existsSync(landingSrc)) {
  throw new Error(`Не найден landing: ${landingSrc}`)
}
cpSync(landingSrc, join(DIST, 'index.html'))
// Копируем и сопутствующие ассеты landing, если появятся (сейчас страница инлайн-only).
for (const entry of readdirSync(join(ROOT, 'web', 'landing'))) {
  if (entry === 'index.html') continue
  cpSync(join(ROOT, 'web', 'landing', entry), join(DIST, entry), { recursive: true })
}

// ─────────────────────────────────────────────────────────────────────────────
// Финал — краткое дерево верхнего уровня.
// ─────────────────────────────────────────────────────────────────────────────
step('Готово. Дерево dist/ (верхний уровень):')
for (const entry of readdirSync(DIST).sort()) {
  process.stdout.write(`  dist/${entry}\n`)
}
process.stdout.write('\n\x1b[32m✓ build-web завершён успешно.\x1b[0m\n')
