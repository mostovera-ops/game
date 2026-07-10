// Разовая генерация аудио-ассетов через ElevenLabs.
// Запуск: node tools/gen_audio.mjs [имя ...]
// Без аргументов генерирует всё, чего ещё нет. Существующие файлы не перезаписывает —
// чтобы перегенерировать, удалите файл.
// Требует ELEVENLABS_API_KEY в .env. Результат коммитим — в рантайме API не дёргается.
//
// Названия существующих игр в промпт не писать: ElevenLabs отклоняет такой запрос
// как нарушение Terms of Service. Описывать надо жанр и инструменты.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public/assets/audio')

const MUSIC = [
  {
    name: 'ambient-loop',
    // Осторожно с инструментовкой: щипковая нейлоновая гитара + маримба без
    // ритм-секции читаются как лютня, и трек уезжает в средневековье.
    // Отсюда пианино, мягкий бас, лёгкая перкуссия и прямые запреты.
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
  {
    name: 'truck-day-loop',
    prompt:
      'Upbeat, cheerful instrumental background music for a busy food truck market day. ' +
      'Twangy electric guitar with spring reverb and tremolo carrying the melody, ' +
      'walking upright bass, brushed snare shuffle, warm honky-tonk piano, occasional lap steel slide. ' +
      'Style: American western swing crossed with 1950s roadside diner rockabilly. ' +
      'Medium tempo around 110 BPM, major key, playful and bustling but not frantic. No vocals. ' +
      'Even dynamics and consistent texture from start to finish so it can be looped seamlessly.',
    music_length_ms: 60_000,
  },
]

const SFX = [
  // --- эмбиент фермы ---
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

  // --- действия игрока ---
  {
    name: 'footstep-grass',
    // Один шаг, не серия: шаги в игре повторяются по таймеру ходьбы.
    text: 'A single footstep on grass, one soft crunch of dry grass and soil under a shoe, close up, dry recording, then silence. No music, one step only.',
    duration_seconds: 1,
  },
  // Блипа реплик здесь нет намеренно: минимум у генератора 0.5 с, а нужен тон
  // на 0.09 с для каждой буквы. Он синтезируется осциллятором — audio/engine.ts.
  {
    name: 'plant-seed',
    text: 'Hands patting loose garden soil, a small handful of dry earth crumbling into a hole, soft earthy rustle. Close up, dry recording. No music.',
    duration_seconds: 2,
  },
  {
    name: 'water-pour',
    text: 'Water pouring from a watering can onto garden soil, steady gentle stream splashing and soaking in, close up. No music.',
    duration_seconds: 3,
  },

  // --- день торговли ---
  {
    name: 'cash-register',
    text: 'A vintage mechanical cash register: one bright bell ding and the drawer sliding open. Single cha-ching, clean, then silence. No music.',
    duration_seconds: 2,
  },
  {
    name: 'dish-missed',
    text: 'A dull muffled bloop, one low pitched wet plop like something soft dropped into water. Short, deadened, then silence. No music.',
    duration_seconds: 2,
  },
  {
    name: 'crowd-murmur',
    // 22 с — потолок sound-generation. Крутим в цикле кроссфейдом, как музыку.
    text: 'Ambient murmur of a lively outdoor food market crowd, indistinct chatter and occasional laughter, mid distance, no distinct words, continuous and even throughout. No music.',
    duration_seconds: 22,
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

  const isMusic = 'music_length_ms' in task
  const url = isMusic
    ? 'https://api.elevenlabs.io/v1/music'
    : 'https://api.elevenlabs.io/v1/sound-generation'
  const body = isMusic
    ? { prompt: task.prompt, music_length_ms: task.music_length_ms }
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
const all = [...MUSIC, ...SFX]
const tasks = wanted.length ? all.filter((t) => wanted.includes(t.name)) : all

if (!tasks.length) {
  console.error(`Нечего генерировать. Доступно: ${all.map((t) => t.name).join(', ')}`)
  process.exit(1)
}

for (const task of tasks) {
  await generate(apiKey, task)
}
console.log('готово')
