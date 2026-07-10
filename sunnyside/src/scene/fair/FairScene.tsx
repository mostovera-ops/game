/**
 * FairScene.tsx — ярмарочная площадь в фазе субботы (09-fair §2/§3, экран R1 19-ui-ux).
 *
 * 3D-ряд палаток на площади + прилавок игрока (Counter Shift stand) с кархопом, гостевые
 * машины 50-х, доска конкурсов. Поверх канваса — DOM-оверлей АКТИВНОЙ СМЕНЫ (главный
 * мини-геймплей, `@/ui/shift`), примонтированный через drei <Html> (ui/ остаётся чистым DOM
 * без three; сцена лишь размещает оверлей над площадью).
 *
 * ВСЯ ГРАФИКА — через заглушки мастер-реестра (`PlaceholderMesh`, 22-audio-visual §7): свои
 * меши/текстуры не заводим. Замена на финальный GLB — одной строкой в реестре, ноль правок тут.
 *
 * ГРАНИЦА (AGENTS.md §3): scene/ читает стор/системы, ноль @/net. Оверлей смены — @/ui/shift.
 *
 * `shiftSystem` (adapter-seams, зеркалит farm-ui-seams) — реальная `ShiftSystem`, которую
 * строит и прокидывает композиция (`App.tsx` → `scene/index.tsx`); дальше проходит через
 * `ShiftHost` в `ShiftScreen.submit` (`shift_submit`) — без неё чек печатается, но на сервер
 * не уходит (тёплый no-op фолбэк, см. `ui/shift/shiftSystemFallback.ts`).
 */

import { Html } from '@react-three/drei'
import { PlaceholderMesh } from '@/assets/placeholders/PlaceholderMesh'
import { ShiftHost } from '@/ui/shift'
import type { ShiftSystem } from '@/engine/contracts'
import { Lights, Ground, CameraRig } from '../common/Rig'

/** Позиции ряда палаток вдоль площади (соседские прилавки за спиной игрока). */
const TENT_ROW: [number, number, number][] = [
  [-9, 1, -6],
  [-4.5, 1, -6.6],
  [0, 1, -7],
  [4.5, 1, -6.6],
  [9, 1, -6],
]

/** Гостевые машины у площади (§2.3 «подъезжают машины 50-х»). */
const GUEST_CARS: { pos: [number, number, number]; vip?: boolean }[] = [
  { pos: [-6, 0.4, 5] },
  { pos: [-2.5, 0.4, 6] },
  { pos: [3, 0.4, 5.5], vip: true },
  { pos: [6.5, 0.4, 6] },
]

export function FairScene({ shiftSystem }: { shiftSystem?: ShiftSystem } = {}) {
  return (
    <>
      <Lights />
      <Ground size={40} />
      <CameraRig />

      {/* Ряд палаток соседей на площади */}
      {TENT_ROW.map((pos, i) => (
        <PlaceholderMesh key={i} id="fair_tent" position={pos} />
      ))}

      {/* Прилавок игрока по центру-переду: палатка + стойка смены + кархоп Пегги */}
      <PlaceholderMesh id="fair_tent" position={[0, 1.1, -2]} scale={1.15} />
      <PlaceholderMesh id="fair_shift_counter" position={[0, 0.5, 0.4]} />
      <PlaceholderMesh id="staff_peggy" position={[0, 0.9, -0.6]} />
      {/* Лоты на прилавке (пассив) */}
      <PlaceholderMesh id="fair_display_slot" position={[-0.7, 1.05, 0.4]} />
      <PlaceholderMesh id="fair_display_slot" position={[0.7, 1.05, 0.4]} />

      {/* Гостевые машины */}
      {GUEST_CARS.map((c, i) => (
        <PlaceholderMesh key={i} id={c.vip ? 'veh_guest_car_vip' : 'veh_guest_car'} position={c.pos} />
      ))}

      {/* Доска конкурсов ярмарки сбоку */}
      <PlaceholderMesh id="ui_contest_gallery_board" position={[-11, 1, 0]} rotation={[0, Math.PI / 6, 0]} />

      {/* DOM-оверлей активной смены поверх площади (ui/shift — чистый DOM) */}
      <Html fullscreen style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
        <ShiftHost shiftSystem={shiftSystem} />
      </Html>
    </>
  )
}
