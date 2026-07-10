/**
 * ui/collections/Postcards.tsx — C5 Postcards album (docs/specs/19-ui-ux.md §3.7 C5,
 * 17-collections §2.3): «почтовый альбом путешествий» — сетка открыток «Greetings
 * from…», прогресс сетов региона, индикатор баффа собранного сета.
 *
 * Сеты/баффы — чистая логика `engine/collections/postcards.ts` (POSTCARD_SETS,
 * allPostcardSetProgress); эта карточка не пересчитывает баффы сама, только
 * отображает производную. Владение открыткой приходит только с сервера
 * (экспедиции завершают штат) — открытку нельзя купить (17-collections §3.3).
 */
import { useMemo } from 'react'
import { useStore } from '@/state'
import { postcards as postcardCatalog } from '@/data/catalogs/postcards'
import type { Postcard } from '@/types'
import { allPostcardSetProgress, type PostcardSetBuff } from '@/engine/collections'
import { DINER, PRINT_SHADOW } from './tokens'

function buffLabel(buff: PostcardSetBuff, locale: 'ru' | 'en'): string {
  switch (buff.kind) {
    case 'expedition_truck_speed_pct':
      return locale === 'ru' ? `+${buff.valuePct}% скорость грузовика` : `+${buff.valuePct}% truck speed`
    case 'expedition_time_pct':
      return locale === 'ru' ? `${buff.valuePct}% время экспедиции` : `${buff.valuePct}% expedition time`
    case 'expedition_highlight_yield_pct':
      return locale === 'ru' ? `+${buff.valuePct}% выход хайлайтов` : `+${buff.valuePct}% highlight yield`
    case 'expedition_extra_route_slot':
      return locale === 'ru' ? `+${buff.slots} слот маршрута` : `+${buff.slots} route slot`
    case 'profile_frame_and_bonus':
      return locale === 'ru' ? `Рамка профиля + ${buff.ticketsBonus} 🎟` : `Profile frame + ${buff.ticketsBonus} 🎟`
    default:
      return ''
  }
}

// Fallback стабильной ссылкой — иначе zustand useSyncExternalStore видит «новый»
// массив на каждом вызове селектора и уходит в бесконечный ре-рендер.
const EMPTY_POSTCARDS: readonly Postcard[] = []

export interface PostcardsProps {
  onClose?: () => void
}

export function Postcards({ onClose }: PostcardsProps) {
  const locale = useStore((s) => s.ui.locale)
  const postcards = useStore((s) => s.collections?.postcards ?? EMPTY_POSTCARDS)

  const owned = useMemo(() => new Set(postcards.filter((p) => p.owned).map((p) => p.key)), [postcards])
  const setProgress = useMemo(() => allPostcardSetProgress(owned), [owned])

  return (
    <section
      data-testid="postcards-album"
      className="flex max-h-[80vh] w-full max-w-4xl flex-col gap-3 overflow-hidden rounded-2xl p-4"
      style={{ background: DINER.paper }}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-black uppercase tracking-wide" style={{ color: DINER.board }}>
          {locale === 'ru' ? 'Открытки «Приветствия из…»' : 'Greetings from… Postcards'}
        </h2>
        {onClose && (
          <button
            type="button"
            data-testid="postcards-close"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm font-bold"
            style={{ background: DINER.board, color: DINER.boardInk }}
          >
            {locale === 'ru' ? 'Закрыть' : 'Close'}
          </button>
        )}
      </header>

      {owned.size === 0 && (
        <p data-testid="postcards-empty" className="text-xs italic opacity-70">
          {locale === 'ru' ? 'Первую открытку привезёт грузовик.' : 'The truck will bring your first postcard.'}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
        {postcardCatalog.map((def) => {
          const have = owned.has(def.key)
          return (
            <article
              key={def.key}
              data-testid={`postcard-${def.key}`}
              data-owned={have}
              className="flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center text-xs"
              style={{
                background: have ? DINER.card : '#EFE6D2',
                borderColor: DINER.chrome,
                boxShadow: PRINT_SHADOW,
                color: have ? DINER.ink : DINER.inkMuted,
                opacity: have ? 1 : 0.6,
              }}
            >
              <span className="text-2xl" aria-hidden>
                🏞️
              </span>
              <p className="font-bold">{def.name[locale]}</p>
            </article>
          )
        })}
      </div>

      <h3 className="mt-2 font-black uppercase tracking-wide" style={{ color: DINER.board }}>
        {locale === 'ru' ? 'Сеты и баффы' : 'Sets & buffs'}
      </h3>
      <ul className="flex flex-col gap-2">
        {setProgress.map((p) => (
          <li
            key={p.set.key}
            data-testid={`postcard-set-${p.set.key}`}
            data-complete={p.complete}
            className="flex items-center justify-between rounded-xl border-2 px-3 py-2 text-xs"
            style={{
              background: DINER.card,
              borderColor: p.complete ? DINER.teal : DINER.chrome,
              boxShadow: PRINT_SHADOW,
              color: DINER.ink,
            }}
          >
            <span className="font-bold uppercase">{p.set.key.replace('postcards_', '').replace(/_/g, ' ')}</span>
            <span className="tabular-nums">
              {p.have}/{p.total}
            </span>
            <span className="font-bold" style={{ color: p.complete ? DINER.teal : DINER.mustard }}>
              {p.complete ? buffLabel(p.set.buff, locale) : locale === 'ru' ? 'не собран' : 'incomplete'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
