/**
 * ui/expeditions/ExpeditionsPanel.tsx — экран роуд-трипа грузовика (`ui_expeditions`,
 * 07-expeditions §5). Карта-лента штатов волны 1, выбор маршрута с таймингом/стоимостью,
 * отправка (`expedition_start`), прогресс активных рейсов, сбор груза (`expedition_collect`),
 * полученные открытки.
 *
 * ГРАНИЦА (AGENTS.md §3): DOM поверх канваса, ноль three/net. Истина (returnAt/лут/открытки)
 * — сервер: панель читает снапшот через `ExpeditionSystem.list` (по требованию), тайминги/
 * стоимости показывает ПРЕДСКАЗАНИЕМ из чистых формул `@/engine/expedition` (§4.1/§3.5),
 * а начисление/списание не считает сама (§0.3). Обратный отсчёт — от `serverNow()` (§0.4).
 */
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/state'
import type { CollectedItem, Postcard, ProductKey, RpcError, StateKey } from '@/types'
import {
  averageSendCost,
  baseDurationHours,
  closedRegionsCoveringStop,
  expeditionDurationMs,
  getStateContent,
  orderedStateKeys,
} from '@/engine/expedition'
import { states } from '@/data/catalogs/states'
import { postcards as postcardCatalog } from '@/data/catalogs/postcards'
import { ingredients } from '@/data/catalogs/ingredients'
import { useExpeditionSystem } from './ExpeditionSystemContext'
import { useExpeditions } from './useExpeditions'
import { DINER, PRINT_SHADOW } from './tokens'

type Locale = 'ru' | 'en'

// Стабильные пустые ссылки — иначе zustand-селектор видит «новый» массив на каждый вызов
// и уходит в бесконечный ре-рендер (тот же приём, что в `ui/collections/Postcards.tsx`).
const EMPTY_POSTCARDS: readonly Postcard[] = []

const NAME_BY_KEY: ReadonlyMap<ProductKey, { en: string; ru: string }> = new Map(
  ingredients.map((i) => [i.key, i.name]),
)
function productName(key: ProductKey, locale: Locale): string {
  const n = NAME_BY_KEY.get(key)
  return n ? n[locale] : key
}

function stateName(key: StateKey, locale: Locale): string {
  const c = getStateContent(key)
  return c ? c.name[locale] : key
}

/** ms → «6ч 12м» / «12м 30с» / «готово». */
function formatRemaining(ms: number, locale: Locale): string {
  if (ms <= 0) return locale === 'ru' ? 'готово' : 'ready'
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return locale === 'ru' ? `${h}ч ${m}м` : `${h}h ${m}m`
  const s = Math.floor((ms % 60_000) / 1000)
  return locale === 'ru' ? `${m}м ${s}с` : `${m}m ${s}s`
}

function formatDurationHours(ms: number, locale: Locale): string {
  const h = ms / 3_600_000
  const label = h >= 1 ? `${Math.round(h)}` : h.toFixed(1)
  return locale === 'ru' ? `~${label}ч` : `~${label}h`
}

/** Статус стопа на карте-ленте (§3.1). */
type StopStatus = 'locked' | 'unvisited' | 'visited'

interface StopModel {
  key: StateKey
  tier: number
  status: StopStatus
  highlights: ProductKey[]
  baseHours: number
  durationMs: number
  sendCost: number
}

/**
 * Лестница открытия (§3.1): `st_home` открыт всегда; каждый следующий стоп открыт,
 * когда собрана открытка предыдущего (= завершён открывающий рейс, §3.3). Локальное
 * правило MVP; серверные предусловия (Garage/уровень фермы) — вне UI-задачи.
 */
function buildStops(
  ownedStates: ReadonlySet<StateKey>,
  speedLevel: number,
  hasStaffGus: boolean,
): StopModel[] {
  const ordered = orderedStateKeys()
  return ordered.map((key, i) => {
    const content = getStateContent(key)
    const tier = content?.tier ?? 1
    const status: StopStatus = ownedStates.has(key)
      ? 'visited'
      : i === 0 || ownedStates.has(ordered[i - 1]!)
        ? 'unvisited'
        : 'locked'
    return {
      key,
      tier,
      status,
      highlights: content?.highlights ?? [],
      baseHours: baseDurationHours(key),
      durationMs: expeditionDurationMs({
        stateKey: key,
        speedLevel,
        hasStaffGus,
        closedRegionsCoveringStop: closedRegionsCoveringStop(key, ownedStates),
      }),
      sendCost: averageSendCost(tier),
    }
  })
}

export interface ExpeditionsPanelProps {
  onOpenPostcards?: () => void
}

export function ExpeditionsPanel({ onOpenPostcards }: ExpeditionsPanelProps) {
  const locale = useStore((s) => s.ui.locale) as Locale
  const serverNow = useStore((s) => s.serverNow)
  const bucks = useStore((s) => s.econ.wallet.bucks)
  const dimes = useStore((s) => s.econ.wallet.dimes)
  const postcards = useStore((s) => s.collections?.postcards ?? EMPTY_POSTCARDS)

  const system = useExpeditionSystem()
  const { snapshot, loading, error, refetch } = useExpeditions()

  const [selected, setSelected] = useState<StateKey | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<RpcError | null>(null)
  const [lastCargo, setLastCargo] = useState<CollectedItem[] | null>(null)

  // Тикер обратного отсчёта: перерисовка раз в секунду (таймеры считаются от serverNow()).
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  const ownedStates = useMemo(
    () => new Set(postcards.filter((p) => p.owned && p.stateKey).map((p) => p.stateKey as StateKey)),
    [postcards],
  )
  const speedLevel = snapshot?.speedLevel ?? 0
  const hasStaffGus = snapshot?.hasStaffGus ?? false
  const stops = useMemo(
    () => buildStops(ownedStates, speedLevel, hasStaffGus),
    [ownedStates, speedLevel, hasStaffGus],
  )

  const active = snapshot?.expeditions ?? []
  const totalSlots = snapshot?.routeSlots ?? 1
  const freeSlots = Math.max(0, totalSlots - active.length)
  const now = serverNow()

  async function send(stateKey: StateKey) {
    if (busy || freeSlots <= 0) return
    // Первый свободный индекс слота маршрута (0..totalSlots-1), не занятый активным рейсом.
    const used = new Set(active.map((e) => e.routeSlot))
    let routeSlot = 0
    while (used.has(routeSlot)) routeSlot += 1
    setBusy(true)
    setActionError(null)
    const res = await system.start({ stateKey, routeSlot })
    setBusy(false)
    if (res.ok) {
      setSelected(null)
      refetch()
    } else {
      setActionError(res.error)
    }
  }

  async function collect(expId: string) {
    if (busy) return
    setBusy(true)
    setActionError(null)
    const res = await system.collect([expId])
    setBusy(false)
    if (res.ok) {
      setLastCargo(res.data.items)
      refetch()
    } else {
      setActionError(res.error)
    }
  }

  const ownedPostcardDefs = postcardCatalog.filter((def) => ownedStates.has(def.stateKey as StateKey))

  if (error) {
    return (
      <div data-testid="expeditions-error" className="p-4 text-center" style={{ color: DINER.ink }}>
        <p className="mb-3 text-sm">
          {locale === 'ru'
            ? 'Гараж не отвечает — грузовик где-то на трассе.'
            : 'The garage is quiet — the truck is somewhere on the road.'}
        </p>
        <button
          type="button"
          data-testid="expeditions-retry"
          onClick={refetch}
          className="rounded-full px-4 py-2 text-sm font-bold"
          style={{ background: DINER.board, color: DINER.boardInk }}
        >
          {locale === 'ru' ? 'Ещё раз' : 'Retry'}
        </button>
      </div>
    )
  }

  return (
    <section
      data-testid="expeditions-panel"
      className="flex w-full max-w-2xl flex-col gap-3"
      style={{ color: DINER.ink }}
    >
      {/* Шапка: слоты маршрута + стафф + кошелёк */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold">
          <span
            data-testid="expeditions-slots"
            className="rounded-full px-3 py-1"
            style={{ background: DINER.board, color: DINER.boardInk }}
          >
            🚚 {active.length}/{totalSlots} {locale === 'ru' ? 'в пути' : 'on the road'}
          </span>
          {hasStaffGus && (
            <span className="rounded-full px-2 py-1 text-xs" style={{ background: DINER.teal, color: '#fff' }}>
              {locale === 'ru' ? 'Гас −15%' : 'Gus −15%'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm font-bold tabular-nums">
          <span>${Math.floor(bucks)}</span>
          <span>◉ {Math.floor(dimes)}</span>
        </div>
      </header>

      {loading && !snapshot && (
        <p data-testid="expeditions-loading" className="text-xs italic" style={{ color: DINER.inkMuted }}>
          {locale === 'ru' ? 'Заводим мотор…' : 'Starting the engine…'}
        </p>
      )}

      {/* Активные рейсы */}
      {active.length > 0 && (
        <div className="flex flex-col gap-2" data-testid="expeditions-active">
          {active.map((exp) => {
            const remaining = exp.returnAt - now
            const ready = remaining <= 0
            const total = Math.max(1, exp.returnAt - exp.startedAt)
            const pct = Math.max(0, Math.min(100, ((now - exp.startedAt) / total) * 100))
            return (
              <div
                key={exp.id}
                data-testid={`expedition-active-${exp.id}`}
                className="rounded-xl p-3"
                style={{ background: DINER.card, boxShadow: PRINT_SHADOW }}
              >
                <div className="mb-1 flex items-center justify-between text-sm font-black">
                  <span>{stateName(exp.stateKey, locale)}</span>
                  <span
                    className="tabular-nums"
                    style={{ color: ready ? DINER.teal : DINER.inkMuted }}
                  >
                    {formatRemaining(remaining, locale)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: DINER.chrome }}>
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${ready ? 100 : pct}%`, background: ready ? DINER.teal : DINER.mustard }}
                  />
                </div>
                {ready && (
                  <button
                    type="button"
                    data-testid={`expedition-collect-${exp.id}`}
                    disabled={busy}
                    onClick={() => void collect(exp.id)}
                    className="mt-2 w-full rounded-full py-2 text-sm font-black disabled:opacity-50"
                    style={{ background: DINER.cherry, color: '#fff' }}
                  >
                    {locale === 'ru' ? 'Разгрузить кузов' : 'Unload the cargo'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Пойманный груз последнего сбора (кузов-сундук, §5) */}
      {lastCargo && (
        <div
          data-testid="expeditions-cargo"
          className="rounded-xl p-3"
          style={{ background: DINER.card, border: `2px dashed ${DINER.mustard}` }}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-black">{locale === 'ru' ? 'Привезли' : 'Brought back'}</span>
            <button
              type="button"
              data-testid="expeditions-cargo-dismiss"
              onClick={() => setLastCargo(null)}
              className="text-xs font-bold"
              style={{ color: DINER.inkMuted }}
            >
              {locale === 'ru' ? 'Ок' : 'OK'}
            </button>
          </div>
          {lastCargo.length === 0 ? (
            <p className="text-xs italic" style={{ color: DINER.inkMuted }}>
              {locale === 'ru' ? 'Кузов пуст.' : 'The cargo bed is empty.'}
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {lastCargo.map((it, i) => (
                <li
                  key={`${it.key}-${i}`}
                  className="rounded-full px-2 py-1 text-xs font-bold"
                  style={{ background: DINER.paper }}
                >
                  📦 {productName(it.key, locale)} ×{it.qty}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {actionError && (
        <p data-testid="expeditions-action-error" className="text-xs font-bold" style={{ color: DINER.cherry }}>
          {actionError.message}
        </p>
      )}

      {/* Карта-лента штатов волны 1 (§3.1) */}
      <div>
        <p className="mb-1 text-xs font-black uppercase tracking-wide" style={{ color: DINER.inkMuted }}>
          {locale === 'ru' ? 'Маршруты — волна 1' : 'Routes — Wave 1'}
        </p>
        {freeSlots <= 0 && (
          <p data-testid="expeditions-no-slots" className="mb-2 text-xs italic" style={{ color: DINER.cherry }}>
            {locale === 'ru'
              ? 'Все грузовики в пути — дождись возвращения.'
              : 'All trucks are on the road — wait for one to return.'}
          </p>
        )}
        <ol className="flex flex-col gap-2">
          {stops.map((stop) => {
            const locked = stop.status === 'locked'
            const isSelected = selected === stop.key
            const canSend = !locked && freeSlots > 0 && !busy
            return (
              <li
                key={stop.key}
                data-testid={`expedition-stop-${stop.key}`}
                data-status={stop.status}
              >
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => setSelected(isSelected ? null : stop.key)}
                  className="w-full rounded-xl p-3 text-left disabled:cursor-not-allowed disabled:opacity-45"
                  style={{
                    background: isSelected ? DINER.board : DINER.card,
                    color: isSelected ? DINER.boardInk : DINER.ink,
                    boxShadow: PRINT_SHADOW,
                    outline: stop.status === 'visited' ? `2px solid ${DINER.teal}` : 'none',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black">
                      {locked && '🔒 '}
                      {stateName(stop.key, locale)}
                    </span>
                    <span className="text-xs font-bold" style={{ opacity: 0.8 }}>
                      T{stop.tier} · {formatDurationHours(stop.durationMs, locale)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs" style={{ opacity: 0.85 }}>
                    <span>
                      {stop.highlights.map((h) => productName(h, locale)).join(' · ') || '—'}
                    </span>
                    <span className="tabular-nums">
                      {stop.sendCost > 0 ? `$${stop.sendCost}` : locale === 'ru' ? 'бесплатно' : 'free'}
                    </span>
                  </div>
                </button>

                {isSelected && !locked && (
                  <div className="mt-1 flex items-center justify-between rounded-b-xl px-3 pb-1">
                    <span className="text-xs" style={{ color: DINER.inkMuted }}>
                      {stop.status === 'visited'
                        ? locale === 'ru'
                          ? 'Повторный рейс за регионалкой'
                          : 'Repeat run for regional goods'
                        : locale === 'ru'
                          ? 'Открывающий рейс — привезёт открытку'
                          : 'First run — brings a postcard'}
                    </span>
                    <button
                      type="button"
                      data-testid="expedition-send"
                      disabled={!canSend}
                      onClick={() => void send(stop.key)}
                      className="rounded-full px-4 py-2 text-sm font-black disabled:opacity-50"
                      style={{ background: DINER.cherry, color: '#fff' }}
                    >
                      {locale === 'ru' ? 'Отправить' : 'Send off'}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </div>

      {/* Полученные открытки (§3.7) */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wide" style={{ color: DINER.inkMuted }}>
            {locale === 'ru' ? 'Открытки' : 'Postcards'} · {ownedPostcardDefs.length}/{states.length}
          </p>
          {onOpenPostcards && (
            <button
              type="button"
              data-testid="expeditions-open-postcards"
              onClick={onOpenPostcards}
              className="text-xs font-bold underline"
              style={{ color: DINER.teal }}
            >
              {locale === 'ru' ? 'Альбом' : 'Album'}
            </button>
          )}
        </div>
        {ownedPostcardDefs.length === 0 ? (
          <p data-testid="expeditions-postcards-empty" className="text-xs italic" style={{ color: DINER.inkMuted }}>
            {locale === 'ru' ? 'Первую открытку привезёт грузовик.' : 'The truck will bring your first postcard.'}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2" data-testid="expeditions-postcards">
            {ownedPostcardDefs.map((def) => (
              <li
                key={def.key}
                className="rounded-lg px-2 py-1 text-xs font-bold"
                style={{ background: DINER.card, boxShadow: PRINT_SHADOW }}
              >
                ✉️ {def.name[locale]}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
