declare const process: { env: Record<string, string | undefined> }

export const config = { runtime: 'edge' }

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'
const MAX_TEXT_LENGTH = 500

// Ограничение частоты. Память живёт в инстансе edge-функции, а инстансов много,
// поэтому это защита от случайного цикла в коде, а не от намеренного абьюза.
// Настоящая защита — свежий ключ и лимиты на стороне ElevenLabs.
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX_REQUESTS = 20
const hits = new Map<string, number[]>()

function allowedOrigins(): string[] {
  const configured = process.env.ALLOWED_ORIGIN
  if (configured) return configured.split(',').map((s) => s.trim())
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL
  return prod ? [`https://${prod}`] : []
}

/** Origin подделывается вне браузера. Отсекает чужие сайты, не отсекает curl. */
function originAllowed(req: Request): boolean {
  const allowed = allowedOrigins()
  if (allowed.length === 0) {
    // Локально ограничивать нечем. На Vercel пустой список означает, что
    // конфигурацию забыли, — закрываемся, а не пускаем всех.
    return process.env.VERCEL !== '1'
  }
  const origin = req.headers.get('origin')
  return origin !== null && allowed.includes(origin)
}

function rateLimited(req: Request): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const now = Date.now()

  // Иначе Map копит запись на каждый когда-либо заходивший IP.
  for (const [key, times] of hits) {
    if (times.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(key)
  }

  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_MAX_REQUESTS) {
    hits.set(ip, recent)
    return true
  }
  recent.push(now)
  hits.set(ip, recent)
  return false
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }
  if (!originAllowed(req)) {
    return new Response('forbidden', { status: 403 })
  }
  if (rateLimited(req)) {
    return new Response('too many requests', { status: 429 })
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return new Response('ELEVENLABS_API_KEY is not set', { status: 500 })
  }

  const body: unknown = await req.json()
  const text =
    typeof body === 'object' && body !== null && 'text' in body ? body.text : undefined

  if (typeof text !== 'string' || text.length === 0) {
    return new Response('body.text must be a non-empty string', { status: 400 })
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return new Response(`body.text must be at most ${MAX_TEXT_LENGTH} chars`, { status: 400 })
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID

  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'content-type': 'application/json',
      accept: 'audio/mpeg',
    },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
  })

  if (!upstream.ok || upstream.body === null) {
    const detail = await upstream.text()
    return new Response(`elevenlabs: ${upstream.status} ${detail}`, { status: 502 })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': 'audio/mpeg',
      'cache-control': 'no-store',
    },
  })
}
