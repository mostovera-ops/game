/**
 * TownScene.tsx — город (11-town): площадь с ярмарочным кругом (Town Projects по
 * стадиям стройки), улицы-стриты с фермами соседей (из local-симуляции — `town` слайс,
 * гидратируемый `adapter.getTown()`), точки фуражинга обочины, визит на чужую ферму.
 *
 * ГРАНИЦА (AGENTS.md §3): читает `state` селекторами, вызывает системы (`engine`).
 * Ноль `@/net` — раскладка/логика вынесены в `layout.ts` (чистые функции) и подкомпоненты.
 *
 * СИСТЕМЫ (adapter-seams, зеркалит `scene/farm/systems.tsx` farm-ui-seams — прокидка
 * ЧЕРЕЗ ПРОПЫ, а не ambient-контекст поверх `<Canvas>`): композиция строит `AppSystems`
 * один раз в `App.tsx` и прокидывает `{ social, mailForaging }` сюда через `scene/index.tsx`
 * (`ActiveScene`). Без пропа (юниты/сторибук сцены) — тёплый no-op фолбэк ниже: клики
 * дают тост-отклик, но НЕ уходят на сервер (истинный путь — только с реальными системами).
 *
 * `handleHelp`/`handleGift`/`handleForageCollect` — реальные RPC (`help_neighbor`/
 * `gift_send`/`forage_collect`), не локальная тост-симуляция: истина (кошелёк/сток/
 * дневной лимит) — с сервера, клиент не начисляет награду сам (AGENTS.md §0.3). Провала
 * нет (P3) — отказ адаптера (оффлайн/лимит/нет стока) гасится тёплым тостом, не красным.
 *
 * Точки фуражинга — детерминированный клиентский плейсхолдер (`layoutForagePoints`,
 * см. `layout.ts`), но с ID-схемой, зеркалящей `starterForage` local-мира (`forage-
 * <townId>-<i>`) — клик реально резолвит ту же точку на сервере (а не «честный» 404).
 */

import { useCallback, useMemo, useState } from 'react'
import { Billboard, Html, Text } from '@react-three/drei'
import { Lights, Ground, CameraRig } from '../common/Rig'
import { PerfHud } from '../common/PerfHud'
import { useStore } from '@/state'
import type { HelpActionType } from '@/types'
import { TownProjects } from './TownProjects'
import { Streets, type VisitTarget } from './Streets'
import { ForagePoints } from './ForagePoints'
import { FarmVisitPanel } from './FarmVisitPanel'
import { layoutForagePoints } from './layout'
import { NOOP_TOWN_SYSTEMS, type TownSystems } from './townSystemsFallback'

/** Дневной лимит помощи — гипотеза 11-town §3.3.2/§4.1 (20/день). Локальная UX-подсказка,
 *  истина лимита — серверная (не считаем награду сами, AGENTS.md §0.3). */
const HELP_DAILY_LIMIT_HYPOTHESIS = 20

export function TownScene({ systems }: { systems?: TownSystems } = {}) {
  const town = useStore((s) => s.town)
  const ownFarmId = useStore((s) => s.session.identity?.farmId)
  const inventory = useStore((s) => s.inventory)
  const pushToast = useStore((s) => s.pushToast)
  const serverNow = useStore((s) => s.serverNow)
  const { social, mailForaging } = systems ?? NOOP_TOWN_SYSTEMS

  const [selectedFarm, setSelectedFarm] = useState<VisitTarget | null>(null)
  const [collectedForageIds, setCollectedForageIds] = useState<ReadonlySet<string>>(new Set())
  const [helpsUsedToday, setHelpsUsedToday] = useState(0)

  const foragePoints = useMemo(() => layoutForagePoints(town?.townId ?? 'town-default'), [town?.townId])

  // useCallback: `Streets`/`ForagePoints` — `React.memo` (scene-perf, §3.9), стабильная
  // ссылка на колбэк нужна, иначе пропы меняются каждый ре-рендер и memo не работает.
  const handleSelectFarm = useCallback((farm: VisitTarget) => {
    setSelectedFarm(farm)
  }, [])

  const handleCloseVisit = useCallback(() => {
    setSelectedFarm(null)
  }, [])

  async function handleHelp(type: HelpActionType) {
    if (!selectedFarm) return
    if (helpsUsedToday >= HELP_DAILY_LIMIT_HYPOTHESIS) {
      pushToast({
        id: `visit-help-limit-${serverNow()}`,
        kind: 'info',
        message: 'На сегодня помощей хватит — загляни завтра 🙂',
        createdAt: serverNow(),
        ttlMs: 4000,
      })
      return
    }
    const res = await social.help(selectedFarm.userId, type)
    if (res.ok) setHelpsUsedToday((n) => n + 1)
    pushToast({
      id: `visit-help-${type}-${serverNow()}`,
      kind: res.ok ? 'success' : 'info',
      message: res.ok
        ? `Помог(ла) соседу «${selectedFarm.displayName}»`
        : 'Не получилось помочь — попробуй ещё раз',
      createdAt: serverNow(),
      ttlMs: 4000,
    })
  }

  async function handleGift() {
    if (!selectedFarm) return
    // Быстрый подарок: первый непустой стек склада, 1 шт. Выбор конкретного стака игроком
    // (Gift compose, F4/11-town §3.4) — отдельная UI-задача вне этого шва (adapter-seams
    // отвечает только за проводку мутации в adapter, не за экран выбора подарка).
    const stack = inventory?.stacks.find((s) => s.qty > 0)
    if (!stack) {
      pushToast({
        id: `visit-gift-empty-${serverNow()}`,
        kind: 'info',
        message: 'Нечего дарить — сначала наготовь',
        createdAt: serverNow(),
        ttlMs: 4000,
      })
      return
    }
    const res = await social.gift(selectedFarm.userId, stack.key, 1)
    pushToast({
      id: `visit-gift-${serverNow()}`,
      kind: res.ok ? 'success' : 'info',
      message: res.ok
        ? `Подарок отправлен соседу «${selectedFarm.displayName}»`
        : 'Не получилось отправить подарок — попробуй ещё раз',
      createdAt: serverNow(),
      ttlMs: 4000,
    })
  }

  const handleForageCollect = useCallback(
    async (pointId: string) => {
      const res = await mailForaging.forageCollect(pointId)
      if (res.ok) {
        setCollectedForageIds((prev) => new Set(prev).add(pointId))
        pushToast({
          id: `forage-${pointId}-${serverNow()}`,
          kind: 'success',
          message: 'Собрано на обочине!',
          createdAt: serverNow(),
          ttlMs: 3000,
        })
        return
      }
      pushToast({
        id: `forage-${pointId}-fail-${serverNow()}`,
        kind: 'info',
        message: 'Не получилось собрать — попробуй ещё раз',
        createdAt: serverNow(),
        ttlMs: 3000,
      })
    },
    [mailForaging, pushToast, serverNow],
  )

  return (
    <>
      <Lights />
      <Ground size={70} />
      <CameraRig />
      <PerfHud />

      <TownProjects projects={town?.projects ?? {}} />
      <Streets
        streets={town?.streets ?? []}
        roster={town?.roster ?? []}
        ownFarmId={ownFarmId}
        onSelectFarm={handleSelectFarm}
      />
      <ForagePoints points={foragePoints} collectedIds={collectedForageIds} onCollect={handleForageCollect} />

      {!town && (
        <Billboard position={[0, 5, 0]}>
          <Text fontSize={0.4} color="#2b2b2e" outlineWidth={0.02} outlineColor="#f5ecd6" anchorX="center" anchorY="bottom">
            Открываем карту города…
          </Text>
        </Billboard>
      )}

      {selectedFarm && (
        <Html fullscreen>
          <FarmVisitPanel
            farm={selectedFarm}
            onClose={handleCloseVisit}
            onHelp={handleHelp}
            onGift={handleGift}
            helpsLeftToday={Math.max(0, HELP_DAILY_LIMIT_HYPOTHESIS - helpsUsedToday)}
            giftDisabled={!inventory?.stacks.some((s) => s.qty > 0)}
          />
        </Html>
      )}
    </>
  )
}
