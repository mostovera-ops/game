/**
 * check-boundaries.mjs — статический страж границ модулей (21-client §3.1, AGENTS.md).
 *
 * Правило game↔scene жёсткое: логика (types/engine/state) не знает three/@react-three и
 * не лезет в рендер. scene/ui не дёргают net напрямую (только через системы/стор).
 * Нарушение — это баг ревью, а не «прагматичное решение».
 *
 * Запуск: `pnpm lint:boundary` (или `node scripts/check-boundaries.mjs`).
 * Ноль зависимостей, работает по исходникам без сборки.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(root, 'src')

/** [префикс каталога, [запрещённые подстроки импорта], человекочитаемая причина]. */
const RULES = [
  ['src/types', ['three', '@react-three', '@/engine', '@/state', '@/net', '@/scene', '@/ui'],
    'types — чистый словарь: ноль three/react и ноль зависимостей от других слоёв'],
  ['src/engine', ['three', '@react-three', '@/state', '@/net', '@/scene', '@/ui'],
    'engine зависит только от @/types (контракты + чистые формулы, node-тестируемо)'],
  ['src/state', ['three', '@react-three', '@/scene', '@/ui', '@/net'],
    'state (сторы) не импортирует three/scene/ui/net — только @/types и @/engine'],
  ['src/scene', ['@/net'],
    'scene не дёргает net напрямую — только через системы (engine) и стор'],
  ['src/ui', ['three', '@react-three', '@/net'],
    'ui — DOM-оверлей: не импортирует three и не ходит в net напрямую'],
]

const IMPORT_RE = /(?:import|export)\s[^'"]*from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

const violations = []
for (const file of walk(SRC)) {
  const rel = relative(root, file).replaceAll('\\', '/')
  const rule = RULES.find(([prefix]) => rel.startsWith(prefix))
  if (!rule) continue
  const [, forbidden, reason] = rule
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2] ?? ''
    for (const bad of forbidden) {
      const hit = bad.startsWith('@/') ? spec === bad || spec.startsWith(bad + '/') : spec === bad || spec.startsWith(bad + '/')
      if (hit) violations.push({ rel, spec, reason })
    }
  }
}

if (violations.length) {
  console.error('\n✗ Нарушения границ модулей:\n')
  for (const v of violations) console.error(`  ${v.rel}\n    импортирует "${v.spec}" — ${v.reason}\n`)
  console.error(`Итого: ${violations.length}. Правь импорт, не границу (AGENTS.md).\n`)
  process.exit(1)
}
console.log('✓ Границы модулей соблюдены.')
