/**
 * Rig.tsx — общие узлы сцены: свет, земля, орбит-камера (21-client §3.3 «common»).
 * Переиспользуется всеми 4 сценами. PerfGate/LOD/имперостеры добавят scene-агенты (§3.9).
 */

import { OrbitControls } from '@react-three/drei'
import { color } from '../assets/palette'

export function Lights() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 10, 4]} intensity={1.1} castShadow />
    </>
  )
}

export function Ground({ size = 40 }: { size?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshLambertMaterial color={color('grass')} />
    </mesh>
  )
}

/** Полу-топ-даун орбитальная камера с ограниченным зумом (ферма/ярмарка). */
export function CameraRig() {
  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      minDistance={6}
      maxDistance={22}
      minPolarAngle={0.25}
      maxPolarAngle={Math.PI / 2.3}
    />
  )
}
