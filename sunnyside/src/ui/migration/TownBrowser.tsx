/**
 * ui/migration/TownBrowser.tsx — Town Browser (`ui_town_browser`, нейминг-кандидат,
 * 12-migration §3.1.3): вкладка внутри `ui_moving_truck` — список/фильтр городов,
 * превью «что переедет/останется» (§3.1.1), подтверждение личного Moving Van.
 *
 * ГРАНИЦА: читает список через `TownSystem.listTowns()` (DI, `TownSystemContext`) — `ui/`
 * не ходит в `@/net` напрямую (AGENTS.md §3). Подтверждение — `TownSystem.moveFarm`,
 * истина (тикеты/кулдаун) приходит в ответе (`MigrateFarmRes`), не считается на клиенте.
 */
import { useMemo, useState } from 'react'
import { useStore } from '@/state'
import type { TownListing, MigrateFarmRes } from '@/types'
import { DINER } from '../market/tokens'
import { useTownSystem } from './TownSystemContext'
import { useTownListings } from './useTownListings'

/** Чек-лист «что переедет / что нет» (12-migration §3.1.1) — статичный, не серверные данные. */
const CHECKLIST: { key: string; ru: string; en: string; keeps: boolean }[] = [
  { key: 'farm', ru: 'Ферма, постройки, планировка', en: 'Farm, buildings, layout', keeps: true },
  { key: 'inventory', ru: 'Склад и инвентарь', en: 'Storage & inventory', keeps: true },
  { key: 'wallet', ru: 'Валюты ($ ◉ 🎟 🎀)', en: 'Currencies ($ ◉ 🎟 🎀)', keeps: true },
  { key: 'staff', ru: 'Стафф, посты, Know-How', en: 'Staff, posts, Know-How', keeps: true },
  { key: 'recipes', ru: 'Рецепты и Mastery', en: 'Recipes & Mastery', keeps: true },
  { key: 'collections', ru: 'Коллекции, Route Pass, косметика', en: 'Collections, Route Pass, cosmetics', keeps: true },
  { key: 'friends', ru: 'Друзья и стрик', en: 'Friends & streak', keeps: true },
  { key: 'street', ru: 'Членство в старом Стрите', en: 'Old Street membership', keeps: false },
  { key: 'week', ru: 'Позиция в текущей неделе города', en: 'This town’s current week progress', keeps: false },
]

interface TownBrowserProps {
  /** Успешный переезд — MovingVan показывает Contribution Receipt поверх. */
  onMoved: (targetTownName: string, res: MigrateFarmRes) => void
}

export function TownBrowser({ onMoved }: TownBrowserProps) {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const town = useStore((s) => s.town)
  const serverNow = useStore((s) => s.serverNow)
  const townSystem = useTownSystem()
  const { listings, loading } = useTownListings()

  const [onlyRecommended, setOnlyRecommended] = useState(false)
  const [onlyFriends, setOnlyFriends] = useState(false)
  const [selected, setSelected] = useState<TownListing | null>(null)
  const [busy, setBusy] = useState(false)

  const cooldownUntil = town?.movingVan.cooldownUntil ?? 0
  const onCooldown = serverNow() < cooldownUntil

  const filtered = useMemo(
    () =>
      listings.filter(
        (t) => (!onlyRecommended || t.recommended) && (!onlyFriends || t.hasFriends),
      ),
    [listings, onlyRecommended, onlyFriends],
  )

  async function confirmMove(target: TownListing) {
    setBusy(true)
    try {
      const res = await townSystem.moveFarm(target.townId)
      if (res.ok) {
        setSelected(null)
        onMoved(target.name, res.data)
      }
      // Отказ (кулдаун истёк неожиданно/оффлайн) — тост уже показан ctx.applyMutation.
    } finally {
      setBusy(false)
    }
  }

  if (selected) {
    return (
      <section data-testid="town-browse-preview" className="flex flex-col gap-3 p-1">
        <h3 className="text-base font-black uppercase tracking-wide">
          {ru ? `Переехать в ${selected.name}?` : `Move to ${selected.name}?`}
        </h3>
        <p className="text-xs opacity-70">
          {ru
            ? 'Твой прогресс переедет с тобой. Это можно сделать снова через 14 дней.'
            : 'Your progress moves with you. You can do this again in 14 days.'}
        </p>
        <ul className="flex flex-col gap-1 text-sm">
          {CHECKLIST.map((c) => (
            <li key={c.key} data-testid={`town-browse-checklist-${c.key}`} className="flex items-center gap-2">
              <span aria-hidden style={{ color: c.keeps ? DINER.teal : DINER.cherry }}>
                {c.keeps ? '✓' : '✕'}
              </span>
              <span>{ru ? c.ru : c.en}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            data-testid="town-browse-cancel-preview"
            onClick={() => setSelected(null)}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-bold uppercase tracking-wide"
            style={{ background: DINER.chrome, color: DINER.board }}
          >
            {ru ? 'Назад' : 'Back'}
          </button>
          <button
            type="button"
            data-testid="town-browse-confirm-move"
            disabled={busy || onCooldown}
            onClick={() => void confirmMove(selected)}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-40"
            style={{ background: DINER.cherry }}
          >
            {ru ? 'Переехать' : 'Move here'}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section data-testid="ui-town-browser" className="flex flex-col gap-3 p-1">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="town-browse-filter-recommended"
          onClick={() => setOnlyRecommended((v) => !v)}
          aria-pressed={onlyRecommended}
          className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{
            background: onlyRecommended ? DINER.teal : DINER.chrome,
            color: onlyRecommended ? '#fff' : DINER.board,
          }}
        >
          {ru ? 'Рекомендованные' : 'Recommended'}
        </button>
        <button
          type="button"
          data-testid="town-browse-filter-friends"
          onClick={() => setOnlyFriends((v) => !v)}
          aria-pressed={onlyFriends}
          className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{
            background: onlyFriends ? DINER.teal : DINER.chrome,
            color: onlyFriends ? '#fff' : DINER.board,
          }}
        >
          {ru ? 'Где мои друзья' : 'Where my friends are'}
        </button>
      </div>

      {loading ? (
        <p className="py-6 text-center italic opacity-70">{ru ? 'Загружаем города…' : 'Loading towns…'}</p>
      ) : filtered.length === 0 ? (
        <p data-testid="town-browse-empty" className="py-6 text-center italic opacity-70">
          {ru ? 'Ничего не найдено по фильтрам.' : 'No towns match these filters.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="town-browse-list">
          {filtered.map((t) => (
            <li
              key={t.townId}
              data-testid={`town-browse-card-${t.townId}`}
              className="flex items-center justify-between rounded-lg border border-dashed p-3"
              style={{ borderColor: DINER.chrome }}
            >
              <div>
                <div className="flex items-center gap-2 font-bold">
                  {t.name}
                  {t.recommended && (
                    <span
                      data-testid={`town-browse-recommended-${t.townId}`}
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white"
                      style={{ background: DINER.teal }}
                    >
                      {ru ? 'топ' : 'top'}
                    </span>
                  )}
                  {t.hasFriends && (
                    <span
                      data-testid={`town-browse-friends-${t.townId}`}
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white"
                      style={{ background: DINER.mustard }}
                    >
                      {ru ? 'друзья' : 'friends'}
                    </span>
                  )}
                </div>
                <div className="text-xs opacity-70">
                  {t.residents}/{t.capacity} · {t.freeStreets}/{t.totalStreets} {ru ? 'своб. улиц' : 'free streets'}
                  {' · DAU ~'}
                  {t.dauAvg}
                </div>
              </div>
              <button
                type="button"
                data-testid={`town-browse-select-${t.townId}`}
                onClick={() => setSelected(t)}
                className="rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white"
                style={{ background: DINER.cherry }}
              >
                {ru ? 'Переехать' : 'Move'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {onCooldown && (
        <p data-testid="town-browse-cooldown-note" className="text-center text-xs italic opacity-70">
          {ru
            ? 'Грузовик ещё отдыхает — можно смотреть, переехать пока нельзя.'
            : 'The truck is still resting — browsing is fine, moving isn’t yet.'}
        </p>
      )}
    </section>
  )
}
