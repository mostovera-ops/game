/**
 * ui/collections/PhotoMode.tsx — C7 Photo Mode / Kodachrome (docs/specs/19-ui-ux.md
 * §3.7 C7, 17-collections §2.6): ретро-фильтры + рамка-открытка с подписью фермы
 * и датой, `Snap` сохраняет PNG (скачивание) и опционально шлёт в галерею профиля.
 *
 * ГРАНИЦА (AGENTS.md §3): `ui/` не имеет права на `three`/`@react-three` — этот
 * компонент не рендерит 3D-сцену сам. Композиция (App.tsx) передаёт `getCanvas()`,
 * возвращающий уже смонтированный `<canvas>` R3F (обычный DOM/2D Canvas API —
 * `drawImage`/`filter` ниже работают с любым HTMLCanvasElement, не завязаны на
 * three). Заливка в галерею — `PhotoUploadReq/Res` живёт на `BackendAdapter`
 * напрямую (Edge Function), а не на `CollectionSystem` (contracts.ts); композиция
 * прокидывает `onUpload` колбэком — тот же приём, что `onGiftNeighbor` в
 * `ui/inventory/StorageOverlay.tsx`, чтобы этот файл не импортировал `@/net`.
 */
import { useRef, useState } from 'react'
import { useStore } from '@/state'
import { DINER, PRINT_SHADOW } from './tokens'

export type PhotoFilterKey = 'kodachrome' | 'sepia' | 'polaroid' | 'bw' | 'neon_night'

const FILTERS: Readonly<Record<PhotoFilterKey, { css: string; free: boolean; ru: string; en: string }>> = {
  kodachrome: { css: 'saturate(1.6) contrast(1.15) sepia(0.08)', free: true, ru: 'Kodachrome', en: 'Kodachrome' },
  sepia: { css: 'sepia(0.75) contrast(1.05)', free: true, ru: 'Сепия', en: 'Sepia' },
  polaroid: { css: 'saturate(0.9) contrast(0.95) brightness(1.05)', free: true, ru: 'Полароид', en: 'Polaroid' },
  bw: { css: 'grayscale(1) contrast(1.1)', free: true, ru: 'Ч/Б', en: 'Black & White' },
  neon_night: { css: 'saturate(2) hue-rotate(-10deg) contrast(1.3) brightness(0.9)', free: false, ru: 'Неоновая ночь', en: 'Neon Night' },
}

export interface PhotoModeProps {
  /** Возвращает смонтированный canvas сцены (композиция — App.tsx). `null`, если сцена не готова. */
  getCanvas?: () => HTMLCanvasElement | null
  /** Отправка снимка в галерею профиля (BackendAdapter.photoUpload) — прокидывается композицией. */
  onUpload?: (blob: Blob) => Promise<{ url: string } | null>
  onClose?: () => void
}

function renderFramed(source: HTMLCanvasElement, filterCss: string, caption: string): HTMLCanvasElement {
  const pad = 28
  const captionH = 56
  const out = document.createElement('canvas')
  out.width = source.width + pad * 2
  out.height = source.height + pad * 2 + captionH
  const ctx = out.getContext('2d')
  if (!ctx) return out
  ctx.fillStyle = '#FCF6E8'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.filter = filterCss
  ctx.drawImage(source, pad, pad)
  ctx.filter = 'none'
  ctx.fillStyle = DINER.ink
  ctx.font = 'bold 22px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(caption, out.width / 2, out.height - captionH / 2 + 8)
  return out
}

export function PhotoMode({ getCanvas, onUpload, onClose }: PhotoModeProps) {
  const locale = useStore((s) => s.ui.locale)
  const displayName = useStore((s) => s.session.identity?.displayName ?? 'Sunnyside')
  const addPhoto = useStore((s) => s.addPhoto)

  const [filter, setFilter] = useState<PhotoFilterKey>('kodachrome')
  const [status, setStatus] = useState<'idle' | 'busy' | 'error'>('idle')
  const [lastDataUrl, setLastDataUrl] = useState<string | null>(null)
  const linkRef = useRef<HTMLAnchorElement | null>(null)

  async function snap() {
    const source = getCanvas?.()
    if (!source) {
      setStatus('error')
      return
    }
    setStatus('busy')
    try {
      const date = new Date().toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US')
      const caption = `${displayName} · ${date}`
      const framed = renderFramed(source, FILTERS[filter].css, caption)
      const dataUrl = framed.toDataURL('image/png')
      setLastDataUrl(dataUrl)

      if (onUpload) {
        const blob = await new Promise<Blob | null>((resolve) => framed.toBlob(resolve, 'image/png'))
        if (blob) {
          const res = await onUpload(blob)
          if (res) {
            addPhoto({ id: `photo_${Date.now()}`, url: res.url, takenAt: Date.now(), filterKey: filter, frameKey: 'postcard' })
          }
        }
      }
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  function download() {
    if (!lastDataUrl || !linkRef.current) return
    linkRef.current.href = lastDataUrl
    linkRef.current.download = `sunnyside-${Date.now()}.png`
    linkRef.current.click()
  }

  return (
    <section
      data-testid="photo-mode"
      className="flex max-h-[80vh] w-full max-w-2xl flex-col gap-3 overflow-hidden rounded-2xl p-4"
      style={{ background: DINER.paper }}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-black uppercase tracking-wide" style={{ color: DINER.board }}>
          {locale === 'ru' ? 'Фотомод Kodachrome' : 'Kodachrome Photo Mode'}
        </h2>
        {onClose && (
          <button
            type="button"
            data-testid="photo-mode-close"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm font-bold"
            style={{ background: DINER.board, color: DINER.boardInk }}
          >
            {locale === 'ru' ? 'Закрыть' : 'Close'}
          </button>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(FILTERS) as PhotoFilterKey[]).map((k) => (
          <button
            key={k}
            type="button"
            data-testid={`photo-filter-${k}`}
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
            style={{
              background: filter === k ? DINER.cherry : DINER.card,
              color: filter === k ? 'white' : DINER.ink,
              border: `1px solid ${DINER.chrome}`,
            }}
          >
            {FILTERS[k][locale]}
            {!FILTERS[k].free && ' ◉'}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="photo-snap"
          onClick={snap}
          disabled={status === 'busy'}
          className="rounded-lg px-3 py-1.5 text-xs font-bold uppercase text-white disabled:opacity-50"
          style={{ background: DINER.teal }}
        >
          {status === 'busy' ? (locale === 'ru' ? 'Проявляем плёнку…' : 'Developing…') : locale === 'ru' ? 'Снять' : 'Snap'}
        </button>
        <button
          type="button"
          data-testid="photo-download"
          onClick={download}
          disabled={!lastDataUrl}
          className="rounded-lg px-3 py-1.5 text-xs font-bold uppercase text-white disabled:opacity-50"
          style={{ background: DINER.mustard }}
        >
          {locale === 'ru' ? 'Скачать PNG' : 'Download PNG'}
        </button>
        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
        <a ref={linkRef} data-testid="photo-download-link" className="hidden" />
      </div>

      {status === 'error' && (
        <p data-testid="photo-mode-error" className="text-xs" style={{ color: DINER.cherry }}>
          {locale === 'ru' ? 'Кадр не сохранился — сними ещё.' : "The shot didn't save — try again."}
        </p>
      )}

      {lastDataUrl && (
        <img
          data-testid="photo-preview"
          src={lastDataUrl}
          alt={locale === 'ru' ? 'Превью снимка' : 'Photo preview'}
          className="max-h-64 self-center rounded-xl border-2"
          style={{ borderColor: DINER.chrome, boxShadow: PRINT_SHADOW }}
        />
      )}
    </section>
  )
}
