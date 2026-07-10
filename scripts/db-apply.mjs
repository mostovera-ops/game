#!/usr/bin/env node
/**
 * Sunnyside — применение миграций к Supabase через Management API.
 *
 * Использование:
 *   node scripts/db-apply.mjs           # применить все новые миграции
 *   node scripts/db-apply.mjs --status  # показать применённые/ожидающие
 *   node scripts/db-apply.mjs --dry     # показать, что было бы применено
 *
 * Токен: env SUPABASE_ACCESS_TOKEN, иначе macOS Keychain ("Supabase CLI",
 * затем "Supabase Sunnyside PAT"). Токен в файлы не пишем.
 * Реестр применённого — таблица public._sunnyside_migrations в самой БД.
 */
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations')
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'pvautnecztynbnzrrdra'
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`

function getToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim()
  for (const service of ['Supabase CLI', 'Supabase Sunnyside PAT']) {
    try {
      const t = execSync(`security find-generic-password -s ${JSON.stringify(service)} -w`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
      if (t.startsWith('sbp_')) return t
    } catch { /* try next */ }
  }
  console.error('Не найден access token (env SUPABASE_ACCESS_TOKEN или Keychain).')
  process.exit(1)
}

const TOKEN = getToken()

import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'

// node fetch виснет на IPv6 к api.supabase.com на этой машине — ходим через curl -4
async function query(sql, { timeoutSec = 90, retries = 2 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dbq-'))
  const bodyFile = join(dir, 'body.json')
  writeFileSync(bodyFile, JSON.stringify({ query: sql }))
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    const r = spawnSync('curl', [
      '-4', '-s', '--max-time', String(timeoutSec),
      '-w', '\n%{http_code}',
      '-X', 'POST', API,
      '-H', `Authorization: Bearer ${TOKEN}`,
      '-H', 'Content-Type: application/json',
      '--data-binary', `@${bodyFile}`,
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    const out = (r.stdout || '').trimEnd()
    const nl = out.lastIndexOf('\n')
    const code = nl >= 0 ? out.slice(nl + 1) : ''
    const body = nl >= 0 ? out.slice(0, nl) : out
    if (r.status === 0 && code.startsWith('2')) {
      try { return JSON.parse(body) } catch { return body }
    }
    lastErr = new Error(`curl exit=${r.status} http=${code}: ${body.slice(0, 500)}`)
    const transient = r.status !== 0 || /^(5\d\d|429|408)$/.test(code)
    if (!transient || attempt === retries) throw lastErr
    console.error(`  (ретрай ${attempt + 1}/${retries})`)
    await new Promise((res) => setTimeout(res, 3000 * (attempt + 1)))
  }
  throw lastErr
}

async function main() {
  const mode = process.argv[2] || '--apply'

  await query(`create table if not exists public._sunnyside_migrations(
    name text primary key,
    applied_at timestamptz not null default now()
  )`)

  const appliedRows = await query('select name from public._sunnyside_migrations order by name')
  const applied = new Set(appliedRows.map((r) => r.name))

  const files = existsSync(MIGRATIONS_DIR)
    ? readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
    : []
  const pending = files.filter((f) => !applied.has(f))

  if (mode === '--status' || mode === '--dry') {
    console.log(`Применено: ${applied.size}`)
    for (const f of files) console.log(`  ${applied.has(f) ? '✅' : '⏳'} ${f}`)
    if (mode === '--dry') console.log(`\nБыло бы применено: ${pending.length}`)
    return
  }

  if (!pending.length) { console.log('Все миграции уже применены.'); return }

  for (const f of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8')
    process.stdout.write(`▶ ${f} ... `)
    try {
      // одна миграция = одна транзакция
      await query(`begin;\n${sql}\ncommit;`)
      await query(`insert into public._sunnyside_migrations(name) values (${sqlLit(f)})`)
      console.log('OK')
    } catch (e) {
      console.log('FAIL')
      console.error(`\nОшибка в ${f}:\n${e.message}`)
      console.error('Миграция не записана как применённая. Исправь SQL и перезапусти.')
      process.exit(1)
    }
  }
  console.log(`\nГотово: применено ${pending.length}.`)
}

function sqlLit(s) { return `'${s.replace(/'/g, "''")}'` }

main().catch((e) => { console.error(e); process.exit(1) })
