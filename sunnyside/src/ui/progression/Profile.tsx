/**
 * ui/progression/Profile.tsx — C1 Profile panel (Farm Value + разбивка) + F9 Farm Level/XP
 * Bar (docs/specs/19-ui-ux.md §3.2 F9 / §3.7 C1, 13-progression.md §3.4/§3.5).
 *
 * Farm Value (`farm.farmValue`) — серверный агрегат (FarmSnapshot), здесь только читаем и
 * подписываем разбивку по осям + статус-титул (презентационная таблица порогов §3.4.3,
 * не формула — формула/кап живут в `engine/progression`/`engine/econ`, AGENTS.md §0.3).
 *
 * XP-полоса — предсказание для UI (`engine/progression` xpToNext/cumulativeXp, чистые
 * функции без сети), уровень фермы берём из `ProgressionSnapshot.farmLevel` (серверная
 * истина), а не пересчитываем его из XP заново.
 */
import { useStore } from '@/state'
import { xpToNext, cumulativeXp } from '@/engine/progression'
import { DINER, PRINT_SHADOW } from './tokens'

/** Статус-титулы по порогу Farm Value (13-progression.md §3.4.3, гипотеза). Презентация. */
const FARM_VALUE_TITLES: readonly { threshold: number; en: string; ru: string }[] = [
  { threshold: 130000, en: 'County Landmark', ru: 'Достопримечательность округа' },
  { threshold: 80000, en: 'Route 66 Legend', ru: 'Легенда Раут-66' },
  { threshold: 45000, en: 'State Fair Regular', ru: 'Завсегдатай ярмарки штата' },
  { threshold: 25000, en: 'Highway Landmark', ru: 'Веха шоссе' },
  { threshold: 12000, en: 'County Favorite', ru: 'Любимец округа' },
  { threshold: 6000, en: 'Blue Plate Kitchen', ru: 'Кухня «сет дня»' },
  { threshold: 2500, en: 'Corner Diner', ru: 'Дайнер на углу' },
  { threshold: 0, en: 'Roadside Stand', ru: 'Придорожный лоток' },
]

function farmValueTitle(total: number, ru: boolean): string {
  const hit = FARM_VALUE_TITLES.find((t) => total >= t.threshold) ?? FARM_VALUE_TITLES[FARM_VALUE_TITLES.length - 1]!
  return ru ? hit.ru : hit.en
}

export function Profile() {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const farm = useStore((s) => s.farm)
  const progression = useStore((s) => s.progression)

  if (!farm || !progression) {
    return (
      <section
        data-testid="profile-panel"
        className="pointer-events-auto mx-auto w-full max-w-xl rounded-xl p-4"
        style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
      >
        <p className="py-6 text-center italic opacity-70">{ru ? 'Профиль ещё не загружен.' : 'Profile not loaded yet.'}</p>
      </section>
    )
  }

  const level = progression.farmLevel
  const need = xpToNext(level)
  const base = cumulativeXp(level)
  const intoLevel = Math.max(0, progression.xp - base)
  const pct = need > 0 ? Math.min(100, Math.round((intoLevel / need) * 100)) : 100
  const fv = farm.farmValue
  const title = farmValueTitle(fv.total, ru)

  const axes: readonly { key: keyof typeof fv; en: string; ru: string }[] = [
    { key: 'production', en: 'Production', ru: 'Производство' },
    { key: 'buildings', en: 'Buildings', ru: 'Постройки' },
    { key: 'collections', en: 'Collections', ru: 'Коллекции' },
    { key: 'cosmetics', en: 'Cosmetics', ru: 'Косметика' },
  ]

  return (
    <section
      data-testid="profile-panel"
      className="pointer-events-auto mx-auto flex w-full max-w-xl flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <h2 className="border-b border-dotted pb-2 text-lg font-black uppercase tracking-wide" style={{ borderColor: DINER.chrome }}>
        {ru ? 'Профиль — мой дайнер' : 'Profile — My Diner'}
      </h2>

      <div data-testid="profile-xp-bar" className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-sm tabular-nums">
          <span className="font-bold">{ru ? `Уровень ${level}` : `Level ${level}`}</span>
          <span className="opacity-70">
            {need > 0 ? `${intoLevel} / ${need} XP` : ru ? 'Макс. уровень' : 'Max level'}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded" style={{ background: DINER.chrome }}>
          <div className="h-full" style={{ width: `${pct}%`, background: DINER.teal }} />
        </div>
      </div>

      <div className="rounded-lg p-3" style={{ background: DINER.board, color: DINER.boardInk }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: DINER.mustard }}>
            {ru ? 'Стоимость фермы' : 'Farm Value'}
          </span>
          <span data-testid="profile-farm-value-total" className="tabular-nums font-black">
            {Math.round(fv.total)}
          </span>
        </div>
        <p data-testid="profile-farm-value-title" className="mt-1 text-sm italic" style={{ color: DINER.mustard }}>
          {title}
        </p>
        <ul className="mt-2 flex flex-col gap-1 text-xs tabular-nums">
          {axes.map((a) => (
            <li key={a.key} data-testid={`profile-fv-axis-${a.key}`} className="flex items-center justify-between">
              <span>{ru ? a.ru : a.en}</span>
              <span>{Math.round(fv[a.key] as number)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
