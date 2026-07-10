/**
 * Plot.tsx — одна интерактивная грядка A-слота (02-farm §2.1/§3.4).
 *
 * Рендерит заглушку земли (`plot_field_*`) + культуру (`crop_*`) по реестру. Клик разрешает
 * контекст-действие (посев/полив/сбор) из состояния грядки (чистая `interactions.ts`) и
 * диспатчит его через `useFarmActions`. Пустая грядка → `pickSeed` открывает Seed Picker
 * (`ui/farm/SeedPicker`, F1 19-ui-ux §3.2) вместо хардкода культуры — сам посев уходит через
 * `FarmSystem`/adapter. Сбор проигрывает «pop» (масштаб-твин), растущая культура покачивается,
 * готовая — «дышит». Курсор-подсказка на ховере.
 *
 * Позицию слота задаёт родитель (`PlotField`); здесь всё локально к грядке.
 */

import { memo, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { Plot as PlotData } from '@/types'
import { useStore } from '@/state'
import { PlaceholderMesh } from '@/assets/placeholders/PlaceholderMesh'
import { useHoverCursor } from '../common/useHoverCursor'
import { cropAssetId, plotAssetId } from './assetMap'
import { growthProgress, plotVisualState, resolvePlotAction } from './interactions'
import { growScale, popTick, readyPulse, swayRotation } from './anim'
import { useFarmActions } from './systems'

/** База высоты культуры над грядкой (чтобы не тонула в земле). */
const CROP_BASE_Y = 0.28

export const Plot = memo(function Plot({ plot }: { plot: PlotData }) {
  const actions = useFarmActions()
  const serverNow = useStore((s) => s.serverNow)
  const cropGroup = useRef<Group>(null)
  const popStart = useRef<number | null>(null)
  const collected = useRef(false)
  const { onPointerOver, onPointerOut } = useHoverCursor()

  const now = serverNow()
  const vis = plotVisualState(plot, now)
  const cropId = cropAssetId(plot.cropKey ?? plot.seedKey)
  const baseScale = growScale(growthProgress(plot, now))

  // Сброс анимационного состояния, когда грядка стала пустой (после сбора/ресинка).
  useEffect(() => {
    if (plot.state === 'empty') {
      popStart.current = null
      collected.current = false
    }
  }, [plot.state])

  useFrame((state) => {
    const g = cropGroup.current
    if (!g) return
    const t = state.clock.elapsedTime

    // «Pop» сбора имеет приоритет: подскок → схлопывание → фактический диспатч harvest.
    if (popStart.current != null) {
      const { scale, done } = popTick(performance.now() - popStart.current)
      g.scale.setScalar(baseScale * scale)
      if (done && !collected.current) {
        collected.current = true
        popStart.current = null
        actions.harvest([plot.id])
      }
      return
    }
    if (collected.current) return

    g.rotation.z = swayRotation(t, plot.slot)
    if (vis === 'ready') {
      const { bobY, scale } = readyPulse(t, plot.slot)
      g.position.y = CROP_BASE_Y + bobY
      g.scale.setScalar(baseScale * scale)
    } else {
      g.position.y = CROP_BASE_Y
      g.scale.setScalar(baseScale)
    }
  })

  function handleClick(e: { stopPropagation: () => void }) {
    e.stopPropagation()
    const action = resolvePlotAction(plot, serverNow())
    if (action === 'harvest') {
      // Запускаем pop; harvest диспатчится по завершении анимации (см. useFrame).
      if (popStart.current == null) popStart.current = performance.now()
    } else if (action === 'sow') {
      // F1 Seed Picker (farm-ui-seams): открываем выбор культуры вместо хардкода —
      // сам посев (через FarmSystem/adapter) делает `ui/farm/SeedPicker`.
      actions.pickSeed(plot.slot)
    } else if (action === 'water') {
      actions.water([plot.id])
    }
  }

  return (
    <group onClick={handleClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
      <PlaceholderMesh id={plotAssetId(0)} />
      {cropId !== null && !collected.current && (
        <group ref={cropGroup} position={[0, CROP_BASE_Y, 0]}>
          <PlaceholderMesh id={cropId} />
        </group>
      )}
    </group>
  )
})
