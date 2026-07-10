#!/usr/bin/env node
/**
 * Sunnyside — Фаза D: генератор таблицы всех ассетов игры.
 *
 * Читает мастер-реестр `sunnyside/src/assets/placeholders/registry.ts` (registry-converge,
 * единственный источник данных по ассетам) и эмитит `docs/ASSETS.md` — таблицу ВСЕХ ассетов
 * (модели/текстуры/UI/VFX/анимации/музыка/SFX), сгруппированную по категориям, с требованиями
 * к финалу, описанием текущей заглушки и приоритетом P0–P2.
 *
 * `registry.ts` не имеет внешних импортов (самодостаточный модуль) — читаем его исходник,
 * транспилируем TS→JS через компилятор TypeScript (уже установлен в sunnyside/node_modules,
 * без добавления зависимостей) и импортируем результат как ESM, чтобы переиспользовать
 * официальные хелперы реестра (`assetRegistry`, `listByCategory`, `categoryCounts`) вместо
 * хрупкого ручного парсинга объектных литералов (реестр строится императивно — циклами/push).
 *
 * Использование:
 *   node scripts/gen-assets-table.mjs           # сгенерировать docs/ASSETS.md
 *   node scripts/gen-assets-table.mjs --check    # сгенерировать в память и сверить с файлом
 *                                                 # на диске (exit 1 при расхождении, для CI)
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REGISTRY_TS = join(ROOT, 'sunnyside', 'src', 'assets', 'placeholders', 'registry.ts')
const OUT_MD = join(ROOT, 'docs', 'ASSETS.md')
const TS_COMPILER = join(ROOT, 'sunnyside', 'node_modules', 'typescript', 'lib', 'typescript.js')
const SPEC_AV = 'docs/specs/22-audio-visual.md'

// ── 1) Загрузка реестра: TS → JS в темп-файл → dynamic import ───────────────

async function loadRegistryModule() {
  if (!existsSync(REGISTRY_TS)) {
    throw new Error(`Реестр не найден: ${REGISTRY_TS}`)
  }
  if (!existsSync(TS_COMPILER)) {
    throw new Error(
      `Компилятор TypeScript не найден: ${TS_COMPILER}\n` +
        'Ожидается установленным в sunnyside/node_modules (devDependency "typescript").',
    )
  }
  const ts = (await import(pathToFileURL(TS_COMPILER).href)).default
  const source = readFileSync(REGISTRY_TS, 'utf8')
  const { outputText, diagnostics } = ts.transpileModule(source, {
    fileName: 'registry.ts',
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      isolatedModules: true,
    },
    reportDiagnostics: true,
  })
  if (diagnostics && diagnostics.length > 0) {
    const msg = diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n')
    console.error('Предупреждения транспиляции registry.ts:\n' + msg)
  }
  const dir = mkdtempSync(join(tmpdir(), 'gen-assets-'))
  const tmpFile = join(dir, 'registry.mjs')
  writeFileSync(tmpFile, outputText)
  try {
    return await import(pathToFileURL(tmpFile).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ── 2) Приоритет P0–P2: эвристика по категории/id/usedIn ────────────────────
//
// P0 (ядро геймплея) — цикл посадка→готовка→продажа: постройки/грядки/культуры фермы,
//   животные, станки, стафф, ингредиенты, ключевые HUD-иконки валют, продажа на Fair/Shift,
//   базовая обратная связь (VFX/SFX/музыка/анимация) этого цикла.
// P1 (мета) — надстроенные системы: экспедиции/транспорт, форейджинг-система (кроме
//   декоративных придорожных точек), город/Town Projects, конкурсы ярмарки, коллекции/
//   ачивки/игрушки/косметика, серверный ивент, NPC, монетизация/ретеншн-экраны — и всё,
//   что не попало явно в P0/P2 (безопасный дефолт).
// P2 (декор) — каталог декора (`decor_*`), окружение/атмосфера (`env_*`, кроме `env_fence_*`
//   — это механика расширения земли, не декор), фотофильтры Photo Mode.
//
// Эвристика для сортировки бэклога арт/аудио-агента (Фаза D), не приоритет разработки кода.

const P0_EXACT = new Set([
  'ui_icon_bucks',
  'ui_icon_dimes',
  'ui_icon_tickets',
  'ui_icon_ribbons',
  'ui_icon_daynight',
  'fair_tent',
  'fair_display_slot',
  'fair_shift_counter',
  'fair_tray',
  'env_fence_locked',
  'env_fence_open',
  'anim_squash_stretch',
  'anim_sway_wind',
  'anim_anticipation',
  'vfx_dust_puff',
  'vfx_steam',
  'vfx_sale_sparkle',
  'vfx_money_popup',
  'vfx_water_droplets',
  'sfx_ui_success',
  'sfx_ui_error',
  'sfx_farm_action',
  'sfx_cooking_ready',
  'sfx_diner_cash',
  'sfx_sale_mastery',
  'music_farm_day',
  'music_farm_night',
  'music_shift',
  'music_menu',
])
const P0_PREFIXES = ['bld_', 'plot_', 'an_', 'mch_', 'staff_', 'item_']
const P0_CROP_EXACT = new Set([
  'crop_tomato',
  'crop_lettuce',
  'crop_potato',
  'crop_wheat',
  'crop_corn',
  'crop_strawberry',
  'crop_cherry_tree',
  'crop_peach_tree',
])
const P2_EXACT = new Set(['crop_greens', 'crop_carrot'])
const P2_PREFIXES = ['decor_', 'env_', 'ui_photo_filter_']

function derivePriority(entry) {
  const id = entry.id
  if (P0_EXACT.has(id) || P0_CROP_EXACT.has(id)) return 'P0'
  if (P0_PREFIXES.some((p) => id.startsWith(p))) return 'P0'
  if (P2_EXACT.has(id)) return 'P2'
  if (P2_PREFIXES.some((p) => id.startsWith(p))) return 'P2'
  return 'P1'
}

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2 }

// ── 3) Форматирование ячеек ──────────────────────────────────────────────────

function cell(v) {
  return String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()
}

/** Округление до 1e-4 — гасит артефакты плавающей точки (напр. `r * 0.55`) в размерах заглушек. */
function fmtNum(n) {
  return Math.round(n * 10000) / 10000
}
function fmtSize(size) {
  return size.map(fmtNum).join('×')
}

/** Описание текущей 3D/спрайт-заглушки (примитив-геометрия) для model/vfx-записей. */
function describePrimitivePlaceholder(placeholder) {
  if (!placeholder) return null
  if (placeholder.shape === 'group' && placeholder.parts) {
    return placeholder.parts
      .map((part) => `${part.shape}[${fmtSize(part.size)}] ${part.color}`)
      .join(' + ')
  }
  const sizeStr = placeholder.size ? `[${fmtSize(placeholder.size)}]` : ''
  let s = `${placeholder.shape}${sizeStr} ${placeholder.color ?? ''}`.trim()
  if (placeholder.accent) s += ` + акцент ${placeholder.accent}`
  if (placeholder.scale !== undefined) s += ` ×${placeholder.scale}`
  return s
}

/**
 * Заглушка сейчас — для model/vfx с примитив-геометрией: форма+цвет.
 * Для texture/ui/music/sfx без геометрии: вытаскиваем "STUB: …" из final.format,
 * либо помечаем generic-заглушкой (без 3D — рисуется generic-DOM/иконка-плейсхолдер).
 */
function currentStub(entry) {
  const prim = describePrimitivePlaceholder(entry.placeholder)
  if (prim) return prim
  const m = /^STUB:\s*([^;]+)/i.exec(entry.final.format ?? '')
  if (m) return m[1].trim()
  return 'generic-плейсхолдер (без 3D-геометрии/спрайта)'
}

/** Требования к финалу: полигоны/draw calls/стиль/формат/длительность/заметки. */
function finalRequirement(entry) {
  const f = entry.final
  const stubMatch = /;\s*финал\s*—\s*(.+)$/i.exec(f.format ?? '')
  const format = stubMatch ? stubMatch[1].trim() : f.format
  const bits = []
  if (f.tris) bits.push(`tris ${f.tris[0]}–${f.tris[1]}`)
  if (f.drawCalls !== undefined) bits.push(`draw calls ${f.drawCalls}`)
  if (f.style) bits.push(f.style)
  if (format) bits.push(`формат: ${format}`)
  if (f.duration) bits.push(`длительность: ${f.duration}`)
  if (f.notes) bits.push(f.notes)
  return bits.join('; ')
}

function renderTable(entries) {
  const header =
    '| id | Название | Где используется | Спека-источник | Требования к финалу | Заглушка сейчас | Приоритет |\n' +
    '|---|---|---|---|---|---|---|\n'
  const rows = entries
    .slice()
    .sort((a, b) => {
      const pa = PRIORITY_ORDER[derivePriority(a)]
      const pb = PRIORITY_ORDER[derivePriority(b)]
      if (pa !== pb) return pa - pb
      return a.id.localeCompare(b.id)
    })
    .map((e) => {
      const usedIn = e.usedIn.join(', ')
      const specSource = e.specSource.join(', ')
      return `| \`${cell(e.id)}\` | ${cell(e.label)} | ${cell(usedIn)} | ${cell(specSource)} | ${cell(finalRequirement(e))} | ${cell(currentStub(e))} | ${derivePriority(e)} |`
    })
    .join('\n')
  return header + rows + '\n'
}

// ── 4) Сборка docs/ASSETS.md ────────────────────────────────────────────────

const CATEGORY_LABEL = {
  model: 'Модели (model)',
  texture: 'Текстуры/иконки (texture)',
  ui: 'UI-элементы (ui)',
  vfx: 'VFX',
  animation: 'Анимационные принципы (animation)',
}
const VISUAL_CATEGORIES = ['model', 'texture', 'ui', 'vfx', 'animation']

function buildMarkdown(mod) {
  const { assetRegistry, listByCategory, categoryCounts, ASSET_IDS } = mod
  const entries = Object.values(assetRegistry)
  const counts = categoryCounts()

  const priorityCounts = { P0: 0, P1: 0, P2: 0 }
  for (const e of entries) priorityCounts[derivePriority(e)] += 1

  const lines = []
  lines.push('# ASSETS.md — Фаза D: таблица всех ассетов Sunnyside')
  lines.push('')
  lines.push(
    '> Автосгенерировано `scripts/gen-assets-table.mjs` — **не редактировать руками**. ' +
      'Источник правды — `sunnyside/src/assets/placeholders/registry.ts` (единственный мастер-реестр, ' +
      'registry-converge); правь его и перегоняй `node scripts/gen-assets-table.mjs` заново.',
  )
  lines.push(`> Спека-первоисточник аудио/арт-требований: \`${SPEC_AV}\`.`)
  lines.push(`> Дата генерации: ${new Date().toISOString().slice(0, 10)}.`)
  lines.push('')
  lines.push(
    `Всего записей реестра: **${ASSET_IDS.length}**. По категориям: ` +
      Object.entries(counts)
        .map(([k, v]) => `${k}=${v}`)
        .join(' · ') +
      '. По приоритету: ' +
      Object.entries(priorityCounts)
        .map(([k, v]) => `${k}=${v}`)
        .join(' · ') +
      '.',
  )
  lines.push('')
  lines.push('## Методология приоритетов (P0–P2)')
  lines.push('')
  lines.push(
    'Приоритет — эвристика для сортировки бэклога арт/аудио-агента, выведенная из категории/id/usedIn ' +
      '(не приоритет разработки кода):',
  )
  lines.push('')
  lines.push(
    '- **P0 (ядро геймплея)** — цикл посадка → готовка → продажа: постройки/грядки/культуры фермы, ' +
      'животные, станки, стафф, иконки ингредиентов, ключевые HUD-иконки валют, продажа на Fair/Shift, ' +
      'и базовая обратная связь этого цикла (VFX/SFX/музыка/анимация).',
  )
  lines.push(
    '- **P1 (мета)** — надстроенные системы поверх ядра: экспедиции/транспорт, почта/форейджинг ' +
      '(кроме декоративных придорожных точек), город/Town Projects, конкурсы ярмарки, коллекции/ачивки/' +
      'игрушки/косметика, серверный ивент, NPC, монетизация/ретеншн-экраны, вторичные SFX/музыка — ' +
      'безопасный дефолт для всего, что не попало явно в P0/P2.',
  )
  lines.push(
    '- **P2 (декор)** — каталог декора (`decor_*`), окружение/атмосфера (`env_*`, кроме `env_fence_*` — ' +
      'это механика расширения земли, не декор), фотофильтры Photo Mode.',
  )
  lines.push('')

  for (const cat of VISUAL_CATEGORIES) {
    const catEntries = listByCategory(cat)
    lines.push(`## ${CATEGORY_LABEL[cat]} (${catEntries.length})`)
    lines.push('')
    lines.push(renderTable(catEntries))
  }

  // Аудио — отдельная секция (музыкальные контексты + SFX).
  lines.push('## Аудио')
  lines.push('')
  lines.push(
    'Обе подкатегории — рантайм-заглушки (Web Audio синтез, без файлов сэмплов) до прихода финального ' +
      `аудио-пайплайна (${SPEC_AV} §4.7/§4.8/§7.3). Колонка «Заглушка сейчас» — текущий синтез-стаб; ` +
      '«Требования к финалу» включают целевой формат/длительность/настроение-стиль.',
  )
  lines.push('')
  const music = listByCategory('music')
  lines.push(`### Музыка — контексты (${music.length})`)
  lines.push('')
  lines.push(renderTable(music))

  const sfx = listByCategory('sfx')
  lines.push(`### SFX (${sfx.length})`)
  lines.push('')
  lines.push(renderTable(sfx))

  return lines.join('\n') + '\n'
}

// ── 5) main ──────────────────────────────────────────────────────────────────

async function main() {
  const mod = await loadRegistryModule()
  const markdown = buildMarkdown(mod)

  if (process.argv.includes('--check')) {
    const onDisk = existsSync(OUT_MD) ? readFileSync(OUT_MD, 'utf8') : null
    if (onDisk !== markdown) {
      console.error(`${OUT_MD} устарел относительно registry.ts — перегони: node scripts/gen-assets-table.mjs`)
      process.exit(1)
    }
    console.log(`${OUT_MD} актуален (${mod.ASSET_IDS.length} записей).`)
    return
  }

  writeFileSync(OUT_MD, markdown)
  console.log(`Записано ${OUT_MD} (${mod.ASSET_IDS.length} записей реестра).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
