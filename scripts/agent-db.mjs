#!/usr/bin/env node
/**
 * Sunnyside — агентский CLI поверх схемы `agents` (миграция 0021_agents_memory).
 *
 * Канал: тот же, что у scripts/db-apply.mjs — Supabase Management API
 * `POST /v1/projects/<ref>/database/query` через `curl -4` (node fetch виснет
 * на IPv6 к api.supabase.com). SQL исполняется ролью postgres (superuser
 * Management API), поэтому обходит RLS и видит схему `agents`.
 *
 * Токен (порядок как в db-apply.mjs): env SUPABASE_ACCESS_TOKEN → .env.sunnyside
 * в корне репо → Keychain "Supabase Sunnyside PAT". Запись "Supabase CLI" НЕ
 * читаем — она вызывает GUI-запрос пароля. Токен в файлы не пишем.
 *
 * КОНТРАКТ (фиксирован для всей волны агентов):
 *   checkin     --agent <имя> [--task <id>]          дайджест: задачи, логи, память
 *   task-add    --title <t> --desc <d> [--owner <o>]
 *   task-update --id <n> --status <s> [--note <text>]
 *   log         --agent <a> --action <act> --summary <s> [--task <id>] [--files a,b]
 *   memory-set  --key <k> --title <t> --content <c> [--tags a,b]
 *   memory-get  --key <k>
 *   memory-list
 *
 * status ∈ {pending,in_progress,review,done,blocked}
 * action ∈ {start,finish,decision,blocker,handoff}
 *
 * Exit-коды: 0 — успех; 1 — ошибка выполнения/сети; 2 — ошибка использования.
 */
import { execSync, spawnSync } from 'node:child_process'
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'pvautnecztynbnzrrdra'
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`

// ── token ──────────────────────────────────────────────────────────────────
function getToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim()
  // Основной источник — .env.sunnyside в корне репо (гитигнорен).
  try {
    const env = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.env.sunnyside'), 'utf8')
    const m = env.match(/^SUPABASE_ACCESS_TOKEN=(sbp_\S+)/m)
    if (m) return m[1]
  } catch { /* нет файла */ }
  // ТОЛЬКО наша запись. Запись "Supabase CLI" НЕ ЧИТАТЬ — вызывает GUI-запрос пароля Keychain!
  try {
    const t = execSync(`security find-generic-password -s "Supabase Sunnyside PAT" -w`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim()
    if (t.startsWith('sbp_')) return t
  } catch { /* fallthrough */ }
  fail('Не найден access token (env SUPABASE_ACCESS_TOKEN / .env.sunnyside / Keychain "Supabase Sunnyside PAT").')
}
const TOKEN = getToken()

// ── curl -4 channel (как в db-apply.mjs) ─────────────────────────────────────
function query(sql, { timeoutSec = 60, retries = 2 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'agdb-'))
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
    lastErr = new Error(`curl exit=${r.status} http=${code}: ${String(body).slice(0, 500)}`)
    const transient = r.status !== 0 || /^(5\d\d|429|408)$/.test(code)
    if (!transient || attempt === retries) throw lastErr
    process.stderr.write(`  (ретрай ${attempt + 1}/${retries})\n`)
    const until = Date.now() + 3000 * (attempt + 1)
    while (Date.now() < until) { /* busy-wait: без async в CLI */ }
  }
  throw lastErr
}

// ── SQL-литералы ─────────────────────────────────────────────────────────────
function lit(s) {
  if (s === undefined || s === null) return 'null'
  return `'${String(s).replace(/'/g, "''")}'`
}
function litArr(items) {
  if (!items || !items.length) return `'{}'::text[]`
  return `array[${items.map(lit).join(',')}]::text[]`
}
function litInt(n) {
  if (n === undefined || n === null || n === '') return 'null'
  if (!/^-?\d+$/.test(String(n))) fail(`Ожидалось целое, получено: ${n}`)
  return String(n)
}

// ── arg-парсер: --key value ─────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) { out[key] = true }
      else { out[key] = next; i++ }
    }
  }
  return out
}
function need(args, name) {
  if (args[name] === undefined || args[name] === true) fail(`Обязательный флаг --${name} не задан.`, 2)
  return String(args[name])
}

function fail(msg, code = 1) { process.stderr.write(`✗ ${msg}\n`); process.exit(code) }
function fmtTime(ts) { return ts ? String(ts).replace('T', ' ').replace(/\.\d+.*$/, '').replace('+00:00', 'Z').replace('Z', ' UTC') : '—' }

const STATUSES = ['pending', 'in_progress', 'review', 'done', 'blocked']
const ACTIONS = ['start', 'finish', 'decision', 'blocker', 'handoff']

// ── команды ──────────────────────────────────────────────────────────────────
function cmdCheckin(args) {
  const agent = need(args, 'agent')
  const task = args.task !== undefined && args.task !== true ? litInt(args.task) : null

  const open = query(`select id, title, status, owner, depends_on
    from agents.tasks
    where status <> 'done'
    order by (status='blocked') desc, (status='in_progress') desc, id asc`)
  const logs = query(`select id, at, agent, action, task_id, summary
    from agents.log order by at desc, id desc limit 20`)
  const mem = query(`select key, title, updated_at from agents.memory order by key asc`)

  let focus = null
  if (task) {
    const rows = query(`select id, title, status, owner, description from agents.tasks where id = ${task}`)
    focus = rows[0] || null
  }

  print(`\n═══ CHECK-IN · агент «${agent}» · ${fmtTime(new Date().toISOString())} ═══`)

  if (focus) {
    print(`\n▸ Фокус-задача #${focus.id} [${focus.status}] ${focus.title}`)
    if (focus.owner) print(`  owner: ${focus.owner}`)
    if (focus.description) print(`  ${focus.description}`)
  } else if (task) {
    print(`\n▸ Фокус-задача #${task.replace(/[^0-9-]/g, '')}: не найдена.`)
  }

  print(`\n▸ Открытые задачи (${open.length}):`)
  if (!open.length) print('  — нет открытых задач —')
  for (const t of open) {
    const dep = Array.isArray(t.depends_on) && t.depends_on.length ? ` deps:[${t.depends_on.join(',')}]` : ''
    print(`  #${t.id} [${t.status}] ${t.title}${t.owner ? ` (${t.owner})` : ''}${dep}`)
  }

  print(`\n▸ Последние логи (${logs.length}):`)
  if (!logs.length) print('  — журнал пуст —')
  for (const l of logs) {
    print(`  ${fmtTime(l.at)} · ${l.agent || '?'} · ${l.action}${l.task_id ? ` #${l.task_id}` : ''} — ${l.summary || ''}`)
  }

  print(`\n▸ Ключи памяти (${mem.length}):`)
  if (!mem.length) print('  — память пуста —')
  for (const m of mem) print(`  ${m.key}${m.title ? ` — ${m.title}` : ''}  (${fmtTime(m.updated_at)})`)
  print('')
}

function cmdTaskAdd(args) {
  const title = need(args, 'title')
  const desc = args.desc !== undefined && args.desc !== true ? String(args.desc) : null
  const owner = args.owner !== undefined && args.owner !== true ? String(args.owner) : null
  const rows = query(`insert into agents.tasks (title, description, owner)
    values (${lit(title)}, ${lit(desc)}, ${lit(owner)})
    returning id, title, status`)
  const t = rows[0]
  print(`✓ Задача #${t.id} создана [${t.status}]: ${t.title}`)
}

function cmdTaskUpdate(args) {
  const id = litInt(need(args, 'id'))
  const status = need(args, 'status')
  if (!STATUSES.includes(status)) fail(`Недопустимый status «${status}». Допустимо: ${STATUSES.join(', ')}`, 2)
  const note = args.note !== undefined && args.note !== true ? String(args.note) : null
  const rows = query(`update agents.tasks set status = ${lit(status)}, updated_at = now()
    where id = ${id} returning id, title, status`)
  if (!rows.length) fail(`Задача #${id} не найдена.`)
  const t = rows[0]
  // Заметку фиксируем в журнале, чтобы она пережила обновление и попала в checkin.
  if (note) {
    query(`insert into agents.log (agent, action, task_id, summary)
      values ('task-update', 'decision', ${id}, ${lit(note)})`)
  }
  print(`✓ Задача #${t.id} → [${t.status}]: ${t.title}${note ? `\n  note: ${note}` : ''}`)
}

function cmdLog(args) {
  const agent = need(args, 'agent')
  const action = need(args, 'action')
  if (!ACTIONS.includes(action)) fail(`Недопустимый action «${action}». Допустимо: ${ACTIONS.join(', ')}`, 2)
  const summary = need(args, 'summary')
  const taskId = args.task !== undefined && args.task !== true ? litInt(args.task) : 'null'
  const files = args.files !== undefined && args.files !== true
    ? String(args.files).split(',').map((f) => f.trim()).filter(Boolean)
    : []
  const rows = query(`insert into agents.log (agent, action, task_id, summary, files)
    values (${lit(agent)}, ${lit(action)}, ${taskId}, ${lit(summary)}, ${litArr(files)})
    returning id, at`)
  const l = rows[0]
  print(`✓ Лог #${l.id} · ${action} · ${agent}${taskId !== 'null' ? ` #${taskId}` : ''} — ${summary}`)
}

function cmdMemorySet(args) {
  const key = need(args, 'key')
  const title = args.title !== undefined && args.title !== true ? String(args.title) : null
  const content = need(args, 'content')
  const tags = args.tags !== undefined && args.tags !== true
    ? String(args.tags).split(',').map((t) => t.trim()).filter(Boolean)
    : []
  const author = args.author !== undefined && args.author !== true ? String(args.author) : null
  const rows = query(`insert into agents.memory (key, title, content, tags, author, updated_at)
    values (${lit(key)}, ${lit(title)}, ${lit(content)}, ${litArr(tags)}, ${lit(author)}, now())
    on conflict (key) do update set
      title = excluded.title, content = excluded.content,
      tags = excluded.tags, author = excluded.author, updated_at = now()
    returning key, (xmax <> 0) as updated`)
  const m = rows[0]
  print(`✓ Память «${m.key}» ${m.updated ? 'обновлена' : 'создана'}.`)
}

function cmdMemoryGet(args) {
  const key = need(args, 'key')
  const rows = query(`select key, title, content, tags, author, updated_at
    from agents.memory where key = ${lit(key)}`)
  if (!rows.length) fail(`Память «${key}» не найдена.`)
  const m = rows[0]
  print(`\n── ${m.key} ──`)
  if (m.title) print(`title:   ${m.title}`)
  if (Array.isArray(m.tags) && m.tags.length) print(`tags:    ${m.tags.join(', ')}`)
  if (m.author) print(`author:  ${m.author}`)
  print(`updated: ${fmtTime(m.updated_at)}`)
  print(`\n${m.content}\n`)
}

function cmdMemoryList() {
  const rows = query(`select key, title, tags, updated_at from agents.memory order by key asc`)
  if (!rows.length) { print('— память пуста —'); return }
  print(`Ключей памяти: ${rows.length}`)
  for (const m of rows) {
    const tags = Array.isArray(m.tags) && m.tags.length ? `  [${m.tags.join(', ')}]` : ''
    print(`  ${m.key}${m.title ? ` — ${m.title}` : ''}${tags}  (${fmtTime(m.updated_at)})`)
  }
}

function print(s) { process.stdout.write(s + '\n') }

function usage() {
  print(`agent-db — CLI агентской памяти/задач/журнала (схема agents).

Команды:
  checkin     --agent <имя> [--task <id>]
  task-add    --title <t> --desc <d> [--owner <o>]
  task-update --id <n> --status <${STATUSES.join('|')}> [--note <text>]
  log         --agent <a> --action <${ACTIONS.join('|')}> --summary <s> [--task <id>] [--files a,b]
  memory-set  --key <k> --title <t> --content <c> [--tags a,b] [--author <a>]
  memory-get  --key <k>
  memory-list`)
}

// ── диспетчер ────────────────────────────────────────────────────────────────
function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  const args = parseArgs(rest)
  try {
    switch (cmd) {
      case 'checkin': return cmdCheckin(args)
      case 'task-add': return cmdTaskAdd(args)
      case 'task-update': return cmdTaskUpdate(args)
      case 'log': return cmdLog(args)
      case 'memory-set': return cmdMemorySet(args)
      case 'memory-get': return cmdMemoryGet(args)
      case 'memory-list': return cmdMemoryList(args)
      case undefined:
      case '-h':
      case '--help':
      case 'help': usage(); return process.exit(0)
      default: fail(`Неизвестная команда «${cmd}».`, 2)
    }
  } catch (e) {
    fail(e.message || String(e))
  }
}
main()
