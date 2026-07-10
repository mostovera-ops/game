/**
 * ui/progression/Buildings.tsx — F3 Building Upgrade / ui_buildings (docs/specs/19-ui-ux.md
 * §3.2 F3, 13-progression.md §3.3): список 9 построек, текущий/след. уровень, стоимость и
 * время апгрейда, что открывает; House — мастер-гейт (`max_level(любая) = house_level`).
 *
 * Таймер апгрейда — модель «дедлайн» (`building.upgradeReadyAt`, 21-client §3.6). Мутация
 * (`building_upgrade`) — через узкий срез `BuildingsSystem` (DI-контекст, см.
 * `BuildingsSystemContext.tsx`); сервер — истина, здесь только чтение/форматирование.
 * Стоимость/время читаются из контент-каталога (`@/data/catalogs/buildings`), не считаются.
 */
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/state'
import { BUILDING_KEYS } from '@/types'
import type { BuildingKey } from '@/types'
import { buildingContent, buildingLabel, buildingLevel } from './catalog'
import { useBuildingsSystem } from './BuildingsSystemContext'
import { DINER, PRINT_SHADOW } from './tokens'

function formatRemaining(ms: number, ru: boolean): string {
  if (ms <= 0) return ru ? 'Готово' : 'Ready'
  const totalMin = Math.ceil(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}${ru ? 'ч' : 'h'} ${m}${ru ? 'м' : 'm'}` : `${m}${ru ? 'м' : 'm'}`
}

const TICK_MS = 1000

export interface BuildingsProps {
  onClose?: () => void
}

export function Buildings({ onClose }: BuildingsProps) {
  const locale = useStore((s) => s.ui.locale)
  const ru = locale === 'ru'
  const farm = useStore((s) => s.farm)
  const serverNow = useStore((s) => s.serverNow)
  const system = useBuildingsSystem()
  const [busyKey, setBusyKey] = useState<BuildingKey | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), TICK_MS)
    return () => clearInterval(id)
  }, [])

  const now = useMemo(() => serverNow(), [serverNow, tick])

  if (!farm) {
    return (
      <section
        data-testid="buildings-panel"
        className="pointer-events-auto mx-auto w-full max-w-2xl rounded-xl p-4"
        style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
      >
        <p className="py-6 text-center italic opacity-70">{ru ? 'Ферма ещё не загружена.' : 'Farm not loaded yet.'}</p>
      </section>
    )
  }

  const houseLevel = farm.buildings.bld_house?.level ?? 1

  async function upgrade(key: BuildingKey) {
    setBusyKey(key)
    try {
      const res = await system.upgradeBuilding(key)
      if (!res.ok) {
        useStore.getState().pushToast({
          id: `building_upgrade_err_${Date.now()}`,
          kind: 'warn',
          message: ru ? `Стройка не началась: ${res.error.message}` : `Upgrade didn’t start: ${res.error.message}`,
          createdAt: Date.now(),
          ttlMs: 6000,
        })
      }
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section
      data-testid="buildings-panel"
      className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-xl p-4"
      style={{ background: DINER.card, color: DINER.board, boxShadow: PRINT_SHADOW }}
    >
      <div className="flex items-center justify-between border-b border-dotted pb-2" style={{ borderColor: DINER.chrome }}>
        <h2 className="text-lg font-black uppercase tracking-wide">{ru ? 'Постройки' : 'Buildings'}</h2>
        {onClose && (
          <button
            type="button"
            data-testid="buildings-close"
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-wide"
            style={{ background: DINER.chrome }}
          >
            {ru ? 'Закрыть' : 'Close'}
          </button>
        )}
      </div>

      <ul className="flex flex-col gap-2" data-testid="buildings-list">
        {BUILDING_KEYS.map((key) => {
          const content = buildingContent(key)
          if (!content) return null
          const building = farm.buildings[key]
          const level = building?.level ?? 1
          const maxLevel = content.maxLevel
          const atCatalogMax = level >= maxLevel
          const nextLevel = level + 1
          const houseGated = key !== 'bld_house' && nextLevel > houseLevel
          const nextData = atCatalogMax ? undefined : buildingLevel(key, nextLevel)
          const upgradeReadyAt = building?.upgradeReadyAt
          const upgrading = upgradeReadyAt !== undefined
          const ready = upgrading && upgradeReadyAt <= now
          const blocked = atCatalogMax || houseGated || upgrading

          return (
            <li
              key={key}
              data-testid={`building-row-${key}`}
              className="flex items-center justify-between gap-2 rounded-lg p-2"
              style={{ background: DINER.board, color: DINER.boardInk }}
            >
              <div className="flex flex-col">
                <span className="font-bold" style={{ color: DINER.mustard }}>
                  {buildingLabel(key, locale)} · {ru ? 'Ур.' : 'Lv.'}
                  {level}/{maxLevel}
                </span>
                {nextData?.effect && <span className="text-xs opacity-80">{nextData.effect[locale]}</span>}
                {atCatalogMax && (
                  <span className="text-xs italic opacity-70">{ru ? 'Лучший в округе!' : 'Best in the county!'}</span>
                )}
                {houseGated && !atCatalogMax && (
                  <span className="text-xs italic opacity-70">
                    {ru ? 'Сначала подними Дом' : 'Upgrade the House first'}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 text-xs tabular-nums">
                {upgrading && upgradeReadyAt !== undefined ? (
                  <span data-testid={`building-timer-${key}`} className="opacity-80">
                    {ready
                      ? ru
                        ? 'Стройка завершена'
                        : 'Build complete'
                      : formatRemaining(upgradeReadyAt - now, ru)}
                  </span>
                ) : (
                  nextData && (
                    <span>
                      ${nextData.upgradeCostBucks} · {formatRemaining(nextData.upgradeSec * 1000, ru)}
                    </span>
                  )
                )}
                <button
                  type="button"
                  data-testid={`building-upgrade-${key}`}
                  disabled={busyKey === key || blocked}
                  onClick={() => void upgrade(key)}
                  className="rounded-lg px-2 py-1 font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: DINER.cherry, color: 'white' }}
                >
                  {ru ? 'Улучшить' : 'Upgrade'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
