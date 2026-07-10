// Разовая генерация аудио-ассетов через ElevenLabs.
// Запуск: node tools/gen_audio.mjs [имя ...]
// Без аргументов генерирует всё, чего ещё нет. Существующие файлы не перезаписывает.
// Требует ELEVENLABS_API_KEY в .env. Результат коммитим — в рантайме API не дёргается.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public/assets/audio')

const MUSIC = {
  name: 'ambient-loop',
  endpoint: 'music',
  body: {
    // Осторожно с инструментовкой: щипковая нейлоновая гитара + маримба без
    // ритм-секции читаются как лютня, и трек уезжает в средневековье.
    // Отсюда пианино, мягкий бас, лёгкая перкуссия и прямые запреты.
    // Названия игр в промпте не писать — ElevenLabs отклоняет их как ToS violation.
    prompt:
      'Cozy, warm, melodic instrumental background music for a wholesome modern farming game. ' +
      'Lead: soft felt upright piano playing a simple gentle melody. ' +
      'Under it: warm sustained strings pad, soft upright bass, light brushed percussion keeping an easy pulse, ' +
      'occasional celesta sparkle. Relaxed tempo around 85 BPM. ' +
      'Contemporary major-key harmony with jazzy seventh and ninth chords, ii-V-I motion. ' +
      'Absolutely no lute, no harpsichord, no recorder, no harp, no plucked nylon guitar, no marimba. ' +
      'Nothing medieval, renaissance, baroque, folk or modal. No vocals. ' +
      'Even dynamics and consistent texture from start to finish so it can be looped seamlessly. ' +
      'Peaceful, nostalgic, hopeful, never sad. ' +
      'Inspired by the gentle, charming atmosphere of cozy farming and life simulation games.',
    music_length_ms: 60_000,
  },
}

const SFX = [
  {
    name: 'bird-chirp',
    text: 'Two or three small songbird chirps, clean and close, dry recording, silence between chirps. No music, no wind, no other animals.',
    duration_seconds: 3,
  },
  {
    name: 'wing-flutter',
    text: 'A small bird flapping its wings and taking off, quick soft flutter of feathers, close up. No music, no birdsong.',
    duration_seconds: 2,
  },
  {
    name: 'twig-snap',
    text: 'A single dry twig snapping underfoot on a forest floor, one crisp sharp crack, then silence. No music.',
    duration_seconds: 2,
  },
  {
    name: 'boar-grunt',
    text: 'A wild boar grunting low and throaty, two or three short grunts, muffled as if in nearby bushes. No music.',
    duration_seconds: 3,
  },
  {
    name: 'grasshopper',
    text: 'A grasshopper stridulating, short dry rhythmic chirping burst in a summer meadow, then silence. No music, no birds.',
    duration_seconds: 3,
  },
]

function loadApiKey() {
  const envPath = join(root, '.env')
  if (!existsSync(envPath)) {
    throw new Error('.env не найден. Скопируйте .env.example и впишите ключ.')
  }
  const line = readFileSync(envPath, 'utf8')
    .split('\n')
    .find((l) => l.startsWith('ELEVENLABS_API_KEY='))
  const key = line?.slice('ELEVENLABS_API_KEY='.length).trim()
  if (!key) throw new Error('ELEVENLABS_API_KEY пуст в .env')
  return key
}

async function generate(apiKey, task) {
  const outPath = join(outDir, `${task.name}.mp3`)
  if (existsSync(outPath)) {
    console.log(`skip  ${task.name}.mp3 (уже есть)`)
    return
  }

  const isMusic = task.endpoint === 'music'
  const url = isMusic
    ? 'https://api.elevenlabs.io/v1/music'
    : 'https://api.elevenlabs.io/v1/sound-generation'
  const body = isMusic
    ? task.body
    : { text: task.text, duration_seconds: task.duration_seconds }

  process.stdout.write(`gen   ${task.name}.mp3 ... `)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`${task.name}: HTTP ${res.status} ${await res.text()}`)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(outPath, buf)
  console.log(`${(buf.length / 1024).toFixed(0)} KB`)
}

const apiKey = loadApiKey()
mkdirSync(outDir, { recursive: true })

const wanted = process.argv.slice(2)
const all = [MUSIC, ...SFX]
const tasks = wanted.length ? all.filter((t) => wanted.includes(t.name)) : all

if (!tasks.length) {
  console.error(`Нечего генерировать. Доступно: ${all.map((t) => t.name).join(', ')}`)
  process.exit(1)
}

for (const task of tasks) {
  await generate(apiKey, task)
}
console.log('готово')
