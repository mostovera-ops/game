/** Озвучка через прокси /api/tts. Ключ живёт на сервере, сюда не попадает. */
export async function speak(text: string): Promise<HTMLAudioElement> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  if (!res.ok) {
    throw new Error(`tts failed: ${res.status} ${await res.text()}`)
  }

  const url = URL.createObjectURL(await res.blob())
  const audio = new Audio(url)
  audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true })
  await audio.play()
  return audio
}
